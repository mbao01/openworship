//! Pre-builds the semantic scripture embedding index for a single Bible
//! translation and writes it to disk.
//!
//! Run:
//!   cargo run -p ow-embed-builder -- --translation KJV
//!   cargo run -p ow-embed-builder -- --translation WEB --output-dir path/to/dir
//!   cargo run -p ow-embed-builder -- --translation BSB --force
//!
//! Arguments:
//!   --translation <CODE>   Required. Translation abbreviation (KJV, WEB, BSB).
//!   --output-dir <path>    Optional. Directory for output files. Default: apps/desktop/resources
//!   --force                Optional. Rebuild even if Bible data is unchanged.
//!
//! Output files (per translation):
//!   <output-dir>/scripture_index_<CODE>.bin     — binary embedding index
//!   <output-dir>/scripture_index_<CODE>.sha256  — hash of source data
//!
//! The tool computes a SHA-256 checksum of the translation's source file and
//! skips regeneration if the existing index was built from the same data.

use anyhow::{bail, Context, Result};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};

const BIBLE_DATA_DIR: &str = "crates/ow-db/data";

/// Map a translation abbreviation to its source data filename.
fn translation_filename(code: &str) -> Option<&'static str> {
    match code.to_uppercase().as_str() {
        "KJV" => Some("kjv.txt"),
        "WEB" => Some("web.txt"),
        "BSB" => Some("bsb.txt"),
        _ => None,
    }
}

fn compute_translation_hash(data_dir: &Path, filename: &str) -> Result<String> {
    let path = data_dir.join(filename);
    let content = std::fs::read(&path)
        .with_context(|| format!("failed to read {}", path.display()))?;
    let mut hasher = Sha256::new();
    hasher.update(&content);
    Ok(format!("{:x}", hasher.finalize()))
}

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();

    let mut translation: Option<String> = None;
    let mut output_dir = PathBuf::from("apps/desktop/resources");
    let mut force = false;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--translation" => {
                i += 1;
                if let Some(v) = args.get(i) {
                    translation = Some(v.to_uppercase());
                }
            }
            "--output-dir" => {
                i += 1;
                if let Some(v) = args.get(i) {
                    output_dir = PathBuf::from(v);
                }
            }
            "--force" => force = true,
            _ => {}
        }
        i += 1;
    }

    // ── Require --translation ─────────────────────────────────────────────────
    let translation = match translation {
        Some(t) => t,
        None => bail!(
            "missing required argument: --translation <CODE>\n\
             Valid codes: KJV, WEB, BSB\n\
             Example: cargo run -p ow-embed-builder -- --translation KJV"
        ),
    };

    let source_file = match translation_filename(&translation) {
        Some(f) => f,
        None => bail!(
            "unknown translation '{translation}'. Valid codes: KJV, WEB, BSB"
        ),
    };

    let index_path = output_dir.join(format!("scripture_index_{translation}.bin"));
    let hash_path = output_dir.join(format!("scripture_index_{translation}.sha256"));

    // ── Compute hash of this translation's source data ───────────────────────
    let data_dir = PathBuf::from(BIBLE_DATA_DIR);
    let current_hash = compute_translation_hash(&data_dir, source_file)
        .context("failed to compute Bible data hash")?;

    // ── Skip if unchanged ─────────────────────────────────────────────────────
    if !force && hash_path.exists() && index_path.exists() {
        let stored_hash = std::fs::read_to_string(&hash_path)
            .unwrap_or_default()
            .trim()
            .to_string();
        if stored_hash == current_hash {
            println!(
                "[embed-builder] {translation}: data unchanged (hash={:.12}…), skipping rebuild.",
                current_hash
            );
            println!("[embed-builder] Index: {}", index_path.display());
            return Ok(());
        }
        println!("[embed-builder] {translation}: hash changed — rebuilding index.");
    }

    // ── Load verses for this translation only ─────────────────────────────────
    println!("[embed-builder] {translation}: loading verses…");
    let db = ow_db::open_and_seed().context("failed to open Bible DB")?;
    let verses = ow_db::get_verses_by_translation(&db, &translation)
        .with_context(|| format!("failed to load verses for {translation}"))?;

    if verses.is_empty() {
        bail!("no verses found for translation '{translation}' — check the translation code");
    }

    println!("[embed-builder] {translation}: {} verses loaded.", verses.len());

    let verse_results: Vec<ow_search::VerseResult> = verses
        .iter()
        .map(|v| ow_search::VerseResult {
            translation: v.translation.clone(),
            book: v.book.clone(),
            chapter: v.chapter,
            verse: v.verse,
            text: v.text.clone(),
            reference: v.reference.clone(),
            score: 1.0,
        })
        .collect();

    // ── Initialise embedder ───────────────────────────────────────────────────
    println!("[embed-builder] {translation}: initialising LocalEmbedder (fastembed)…");
    let embedder = ow_embed::LocalEmbedder::new().context("failed to initialise embedding model")?;

    // ── Build index ───────────────────────────────────────────────────────────
    println!(
        "[embed-builder] {translation}: building semantic index ({} verses)…",
        verse_results.len()
    );
    let index = ow_embed::build_index(&embedder, &verse_results)
        .with_context(|| format!("failed to build semantic index for {translation}"))?;
    println!("[embed-builder] {translation}: index built ({} entries).", index.len());

    // ── Serialise to disk ─────────────────────────────────────────────────────
    std::fs::create_dir_all(&output_dir)
        .with_context(|| format!("failed to create output dir: {}", output_dir.display()))?;

    index.save(&index_path)
        .with_context(|| format!("failed to save index to {}", index_path.display()))?;
    std::fs::write(&hash_path, &current_hash)
        .with_context(|| format!("failed to write hash to {}", hash_path.display()))?;

    let size_mb = std::fs::metadata(&index_path)?.len() as f64 / 1_048_576.0;
    println!(
        "[embed-builder] {translation}: done. Index: {} ({:.1} MB), hash: {:.12}…",
        index_path.display(),
        size_mb,
        current_hash
    );

    Ok(())
}
