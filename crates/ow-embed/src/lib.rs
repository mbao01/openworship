//! Semantic scripture matching via local text embeddings.
//!
//! Provides:
//! - [`Embedder`] — trait abstracting over embedding backends (sync).
//! - [`LocalEmbedder`] — bundled fastembed (ONNX Runtime + nomic-embed-text-v1.5).
//! - [`SemanticIndex`] — in-memory cosine-similarity search over all embedded verses.
//! - [`SemanticMatch`] — a matched verse with a similarity score.
//!
//! When the `ollama` feature is enabled, [`OllamaClient`] is also available as an
//! alternative backend that delegates to a running Ollama server.

use anyhow::Result;
use ow_search::VerseResult;
use serde::Serialize;
use std::path::Path;

// ─── Embedder trait ─────────────────────────────────────────────────────────

/// Trait abstracting over embedding backends.
///
/// All methods are **sync**. Callers running in an async context should wrap
/// calls with `tokio::task::spawn_blocking`.
pub trait Embedder: Send + Sync {
    /// Generate a dense embedding vector for a single text.
    fn embed(&self, text: &str) -> Result<Vec<f32>>;

    /// Embed a batch of texts. Returns embeddings in the same order.
    fn embed_batch(&self, texts: &[&str]) -> Result<Vec<Vec<f32>>> {
        texts.iter().map(|t| self.embed(t)).collect()
    }
}

// ─── LocalEmbedder (fastembed / ONNX Runtime) ───────────────────────────────

/// Bundled embedding model using fastembed (ONNX Runtime + nomic-embed-text-v1.5).
///
/// The model is auto-downloaded on first use (~137 MB) and cached at
/// `~/.cache/fastembed/`. No external server required.
pub struct LocalEmbedder {
    model: std::sync::Mutex<fastembed::TextEmbedding>,
}

impl LocalEmbedder {
    /// Initialise the local embedding model.
    ///
    /// On first run this downloads the ONNX weights (~137 MB) into
    /// `~/.openworship/.cache/fastembed/`. Subsequent launches load from cache.
    pub fn new() -> Result<Self> {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
        let cache_dir = std::path::PathBuf::from(home)
            .join(".openworship")
            .join(".cache")
            .join("fastembed");

        let model = fastembed::TextEmbedding::try_new(
            fastembed::InitOptions::new(fastembed::EmbeddingModel::NomicEmbedTextV15)
                .with_cache_dir(cache_dir)
                .with_show_download_progress(true),
        )?;
        Ok(Self {
            model: std::sync::Mutex::new(model),
        })
    }
}

impl Embedder for LocalEmbedder {
    fn embed(&self, text: &str) -> Result<Vec<f32>> {
        let model = self.model.lock().map_err(|e| anyhow::anyhow!("lock poisoned: {e}"))?;
        let mut results = model.embed(vec![text], None)?;
        results
            .pop()
            .ok_or_else(|| anyhow::anyhow!("empty embedding result"))
    }

    fn embed_batch(&self, texts: &[&str]) -> Result<Vec<Vec<f32>>> {
        let model = self.model.lock().map_err(|e| anyhow::anyhow!("lock poisoned: {e}"))?;
        let owned: Vec<String> = texts.iter().map(|s| s.to_string()).collect();
        model.embed(owned, None)
    }
}

// ─── OllamaClient (optional, feature-gated) ────────────────────────────────

#[cfg(feature = "ollama")]
mod ollama {
    use anyhow::{bail, Context, Result};
    use serde::{Deserialize, Serialize};

    const DEFAULT_OLLAMA_URL: &str = "http://localhost:11434";
    const EMBED_MODEL: &str = "nomic-embed-text";

    /// Async HTTP client for the Ollama local inference server.
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

        pub async fn is_available(&self) -> bool {
            let url = format!("{}/api/version", self.base_url);
            match self.client.get(&url).send().await {
                Ok(resp) if resp.status().is_success() => {
                    let version_ok = resp.json::<VersionResponse>().await.is_ok();
                    if !version_ok {
                        return false;
                    }
                    self.embed_async("test").await.is_ok()
                }
                _ => false,
            }
        }

        pub async fn embed_async(&self, text: &str) -> Result<Vec<f32>> {
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
    }

    impl Default for OllamaClient {
        fn default() -> Self {
            Self::new()
        }
    }

    impl super::Embedder for OllamaClient {
        fn embed(&self, text: &str) -> Result<Vec<f32>> {
            // Block on the async method. Only suitable from a blocking context.
            let rt = tokio::runtime::Handle::current();
            rt.block_on(self.embed_async(text))
        }
    }
}

#[cfg(feature = "ollama")]
pub use ollama::OllamaClient;

// ─── Cosine similarity ────────────────────────────────────────────────────────

/// Cosine similarity in `[−1, 1]`.  Returns 0.0 for zero-length vectors.
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    debug_assert_eq!(a.len(), b.len(), "embedding dimension mismatch");
    if a.is_empty() || b.is_empty() {
        return 0.0;
    }
    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm_a == 0.0 || norm_b == 0.0 {
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
/// Built at startup by embedding every verse through the configured
/// [`Embedder`].  Exposes [`SemanticIndex::search`] for cosine-similarity
/// lookup.
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

    /// Serialize the index to a binary file using bincode.
    pub fn save(&self, path: &Path) -> Result<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let encoded = bincode::serde::encode_to_vec(&self.entries, bincode::config::standard())
            .map_err(|e| anyhow::anyhow!("bincode encode error: {e}"))?;
        std::fs::write(path, encoded)?;
        Ok(())
    }

    /// Deserialize an index from a binary file produced by [`save`].
    pub fn load(path: &Path) -> Result<Self> {
        let data = std::fs::read(path)?;
        let (entries, _): (Vec<(VerseResult, Vec<f32>)>, _) =
            bincode::serde::decode_from_slice(&data, bincode::config::standard())
                .map_err(|e| anyhow::anyhow!("bincode decode error: {e}"))?;
        Ok(Self { entries })
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

/// Embed all `verses` via the given [`Embedder`] and return a ready
/// [`SemanticIndex`].
///
/// This is a **sync** function. Callers should run it inside
/// `tokio::task::spawn_blocking` so the main thread is never blocked.
/// Verses are embedded in batches of 256 for throughput.
pub fn build_index(
    embedder: &dyn Embedder,
    verses: &[VerseResult],
) -> Result<SemanticIndex> {
    let total = verses.len();
    eprintln!("[embed] building semantic index for {total} verses…");

    let texts: Vec<&str> = verses.iter().map(|v| v.text.as_str()).collect();

    let mut all_embeddings = Vec::with_capacity(total);
    for chunk in texts.chunks(256) {
        let embeddings = embedder.embed_batch(chunk)?;
        all_embeddings.extend(embeddings);
        eprintln!("[embed] {}/{total} verses embedded", all_embeddings.len());
    }

    let entries: Vec<_> = verses.iter().cloned().zip(all_embeddings).collect();

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
            score: 1.0,
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
