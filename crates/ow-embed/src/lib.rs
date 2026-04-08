//! Semantic scripture matching via Ollama nomic-embed-text embeddings.
//!
//! Provides:
//! - [`OllamaClient`] — async HTTP client for the Ollama embeddings API.
//! - [`SemanticIndex`] — in-memory cosine-similarity search over all embedded verses.
//! - [`SemanticMatch`] — a matched verse with a similarity score.
//!
//! Graceful degradation: when Ollama is not running, [`OllamaClient::is_available`]
//! returns `false` and callers can skip semantic search entirely.

use anyhow::{bail, Context, Result};
use ow_search::VerseResult;
use serde::{Deserialize, Serialize};

// ─── Default Ollama base URL ──────────────────────────────────────────────────

const DEFAULT_OLLAMA_URL: &str = "http://localhost:11434";
const EMBED_MODEL: &str = "nomic-embed-text";

// ─── Ollama HTTP client ───────────────────────────────────────────────────────

/// Async HTTP client for the Ollama local inference server.
///
/// Calls `/api/embeddings` to generate dense vector embeddings using the
/// `nomic-embed-text` model.
#[derive(Clone)]
pub struct OllamaClient {
    base_url: String,
    client: reqwest::Client,
}

#[derive(Serialize)]
struct EmbedRequest<'a> {
    model: &'a str,
    prompt: &'a str,
}

#[derive(Deserialize)]
struct EmbedResponse {
    embedding: Vec<f32>,
}

#[derive(Deserialize)]
struct VersionResponse {
    #[allow(dead_code)]
    version: String,
}

impl OllamaClient {
    /// Create a client pointing at the default Ollama URL (`http://localhost:11434`).
    pub fn new() -> Self {
        Self::with_url(DEFAULT_OLLAMA_URL)
    }

    pub fn with_url(base_url: &str) -> Self {
        Self {
            base_url: base_url.trim_end_matches('/').to_owned(),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("failed to build reqwest client"),
        }
    }

    /// Return `true` if Ollama is reachable and `nomic-embed-text` is available.
    pub async fn is_available(&self) -> bool {
        let url = format!("{}/api/version", self.base_url);
        match self.client.get(&url).send().await {
            Ok(resp) if resp.status().is_success() => {
                // Also check the model is pulled
                let version_ok = resp.json::<VersionResponse>().await.is_ok();
                if !version_ok {
                    return false;
                }
                // Quick check: try a tiny embed; fail fast
                self.embed("test").await.is_ok()
            }
            _ => false,
        }
    }

    /// Generate a dense embedding vector for the given text.
    pub async fn embed(&self, text: &str) -> Result<Vec<f32>> {
        let url = format!("{}/api/embeddings", self.base_url);
        let resp = self
            .client
            .post(&url)
            .json(&EmbedRequest {
                model: EMBED_MODEL,
                prompt: text,
            })
            .send()
            .await
            .context("failed to reach Ollama")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            bail!("Ollama returned {status}: {body}");
        }

        let data: EmbedResponse = resp
            .json()
            .await
            .context("failed to parse Ollama embedding response")?;

        if data.embedding.is_empty() {
            bail!("Ollama returned empty embedding");
        }

        Ok(data.embedding)
    }

    /// Embed a batch of texts sequentially. Returns embeddings in the same order.
    ///
    /// Unlike a true batch API this just calls [`embed`] for each item, which
    /// is fine for the startup pre-embedding path where latency is not critical.
    pub async fn embed_batch(&self, texts: &[&str]) -> Result<Vec<Vec<f32>>> {
        let mut results = Vec::with_capacity(texts.len());
        for text in texts {
            results.push(self.embed(text).await?);
        }
        Ok(results)
    }
}

impl Default for OllamaClient {
    fn default() -> Self {
        Self::new()
    }
}

// ─── Cosine similarity ────────────────────────────────────────────────────────

/// Cosine similarity in `[−1, 1]`.  Returns 0.0 for zero-length vectors.
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    // Dimension mismatch produces meaningless similarity — return 0.0 rather
    // than silently truncating via zip (which debug_assert alone would allow in
    // release builds).
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    // Use an epsilon guard rather than exact zero — a subnormal norm would pass
    // the == 0.0 check and cause division by a tiny value, producing ±Inf that
    // then clamps to ±1.0, matching everything at max similarity.
    if norm_a < f32::EPSILON || norm_b < f32::EPSILON {
        return 0.0;
    }
    (dot / (norm_a * norm_b)).clamp(-1.0, 1.0)
}

// ─── SemanticMatch ────────────────────────────────────────────────────────────

/// A verse that matched a semantic query, with its similarity score.
#[derive(Debug, Clone, Serialize)]
pub struct SemanticMatch {
    pub verse: VerseResult,
    /// Cosine similarity in `[0, 1]` (after clamping to non-negative).
    pub score: f32,
}

// ─── SemanticIndex ────────────────────────────────────────────────────────────

/// In-memory vector index of embedded scripture verses.
///
/// Built at startup by embedding every verse through Ollama.  Exposes
/// [`SemanticIndex::search`] for cosine-similarity lookup.
pub struct SemanticIndex {
    entries: Vec<(VerseResult, Vec<f32>)>,
}

impl SemanticIndex {
    /// Build an index from pre-computed `(verse, embedding)` pairs.
    pub fn new(entries: Vec<(VerseResult, Vec<f32>)>) -> Self {
        Self { entries }
    }

    /// Return the number of indexed verses.
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Search the index for verses semantically similar to `query_embedding`.
    ///
    /// Returns up to `limit` results whose cosine similarity exceeds
    /// `threshold`.  Results are sorted by descending similarity.
    pub fn search(
        &self,
        query_embedding: &[f32],
        threshold: f32,
        limit: usize,
    ) -> Vec<SemanticMatch> {
        let mut scored: Vec<SemanticMatch> = self
            .entries
            .iter()
            .filter_map(|(verse, emb)| {
                let score = cosine_similarity(query_embedding, emb).max(0.0);
                if score >= threshold {
                    Some(SemanticMatch {
                        verse: verse.clone(),
                        score,
                    })
                } else {
                    None
                }
            })
            .collect();

        // Sort by descending similarity.
        scored.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        scored.truncate(limit);
        scored
    }
}

// ─── Index builder ────────────────────────────────────────────────────────────

/// Embed all `verses` via `client` and return a ready [`SemanticIndex`].
///
/// This is called from a background Tokio task at app startup so that the
/// main thread is never blocked.  Progress is logged to stderr.
pub async fn build_index(
    client: &OllamaClient,
    verses: &[VerseResult],
) -> Result<SemanticIndex> {
    let total = verses.len();
    eprintln!("[embed] building semantic index for {total} verses…");

    let mut entries = Vec::with_capacity(total);
    for (i, verse) in verses.iter().enumerate() {
        // Embed the verse text (not the reference) for best semantic coverage.
        let embedding = client
            .embed(&verse.text)
            .await
            .with_context(|| format!("failed to embed verse {}", verse.reference))?;

        entries.push((verse.clone(), embedding));

        if (i + 1) % 100 == 0 || i + 1 == total {
            eprintln!("[embed] {}/{total} verses embedded", i + 1);
        }
    }

    eprintln!("[embed] semantic index ready ({total} verses)");
    Ok(SemanticIndex::new(entries))
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn make_verse(reference: &str, text: &str) -> VerseResult {
        VerseResult {
            translation: "KJV".into(),
            book: "John".into(),
            chapter: 3,
            verse: 16,
            text: text.into(),
            reference: reference.into(),
        }
    }

    #[test]
    fn cosine_identical() {
        let v = vec![1.0_f32, 0.0, 0.0];
        assert!((cosine_similarity(&v, &v) - 1.0).abs() < 1e-6);
    }

    #[test]
    fn cosine_orthogonal() {
        let a = vec![1.0_f32, 0.0];
        let b = vec![0.0_f32, 1.0];
        assert!(cosine_similarity(&a, &b).abs() < 1e-6);
    }

    #[test]
    fn cosine_zero_vector() {
        let a = vec![0.0_f32, 0.0];
        let b = vec![1.0_f32, 0.0];
        assert_eq!(cosine_similarity(&a, &b), 0.0);
    }

    #[test]
    fn semantic_index_search_above_threshold() {
        let verse = make_verse("John 3:16", "For God so loved the world");
        // Same embedding → similarity = 1.0
        let emb = vec![1.0_f32, 0.0, 0.0];
        let index = SemanticIndex::new(vec![(verse.clone(), emb.clone())]);

        let results = index.search(&emb, 0.5, 5);
        assert_eq!(results.len(), 1);
        assert!((results[0].score - 1.0).abs() < 1e-6);
    }

    #[test]
    fn semantic_index_search_below_threshold() {
        let verse = make_verse("John 3:16", "For God so loved the world");
        let emb = vec![1.0_f32, 0.0, 0.0];
        let index = SemanticIndex::new(vec![(verse, emb)]);

        // Orthogonal query → similarity = 0
        let query = vec![0.0_f32, 1.0, 0.0];
        let results = index.search(&query, 0.5, 5);
        assert!(results.is_empty());
    }

    #[test]
    fn semantic_index_sorted_descending() {
        let v1 = make_verse("John 3:16", "For God so loved the world");
        let v2 = make_verse("Psalm 23:1", "The Lord is my shepherd");

        // v1 embedding aligns with query, v2 partially does.
        let emb1 = vec![1.0_f32, 0.0];
        let emb2 = vec![0.8_f32, 0.6];
        let index = SemanticIndex::new(vec![(v1, emb1), (v2, emb2)]);

        let query = vec![1.0_f32, 0.0];
        let results = index.search(&query, 0.0, 10);
        assert_eq!(results.len(), 2);
        assert!(results[0].score >= results[1].score);
    }
}
