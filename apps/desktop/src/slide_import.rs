/*!
 * slide_import.rs — OPE-159: Import PowerPoint (.pptx) and PDF files as display slides.
 *
 * Each PPTX slide and PDF page becomes an `ArtifactEntry` in the artifacts DB.
 * Text content is extracted for Tantivy full-text search indexability.
 * Thumbnails are generated via LibreOffice (PPTX) and platform PDF renderers.
 */

use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};

use crate::artifacts::{ArtifactEntry, ArtifactsDb};

// ─── Public API types ─────────────────────────────────────────────────────────

/// The result of importing a single PPTX slide or PDF page.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlideImportResult {
    /// The artifact entry created in the DB.
    pub artifact: ArtifactEntry,
    /// 0-based slide/page index within the source file.
    pub slide_index: usize,
    /// Extracted text content (empty when not extractable).
    pub text_content: String,
    /// Absolute path of the original source file.
    pub source_file: String,
}

// ─── PPTX Import ─────────────────────────────────────────────────────────────

/// Import one or more `.pptx` files, creating one artifact per slide.
pub fn import_pptx(
    db: &mut ArtifactsDb,
    service_id: Option<String>,
    parent_path: Option<String>,
    source_paths: Vec<String>,
) -> anyhow::Result<Vec<SlideImportResult>> {
    let mut results = Vec::new();

    for src in &source_paths {
        let src_path = Path::new(src);
        let stem = src_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("presentation");

        // Open the ZIP archive.
        let file = std::fs::File::open(src_path)?;
        let mut archive = zip::ZipArchive::new(file)?;

        // Collect slide XML names in order.
        let slide_names = collect_slide_names(&mut archive);
        if slide_names.is_empty() {
            // Fallback: try any slide-like XML.
            let fallback = fallback_slide_names(&mut archive);
            for (idx, name) in fallback.iter().enumerate() {
                let text = extract_slide_text(&mut archive, name);
                let title = format!("{} — Slide {}", stem, idx + 1);
                let artifact = store_text_slide(
                    db,
                    service_id.clone(),
                    parent_path.clone(),
                    &title,
                    &text,
                )?;
                results.push(SlideImportResult {
                    artifact,
                    slide_index: idx,
                    text_content: text,
                    source_file: src.clone(),
                });
            }
            continue;
        }

        // Try to render slides via LibreOffice.
        let render_dir = make_tmp_dir("ow_pptx_render");
        let render_ok = render_dir.is_some()
            && render_pptx_libreoffice(src_path, render_dir.as_deref().unwrap());
        let rendered_pngs: Vec<PathBuf> = if render_ok {
            collect_numbered_pngs(render_dir.as_deref().unwrap())
        } else {
            vec![]
        };

        // Extract PPTX embedded thumbnail (used as slide 0 fallback).
        let pptx_thumb = extract_pptx_thumbnail(&mut archive);

        for (idx, slide_name) in slide_names.iter().enumerate() {
            let text = extract_slide_text(&mut archive, slide_name);
            let title = format!("{} — Slide {}", stem, idx + 1);
            let safe_title = sanitize_filename(&title);

            let artifact = if let Some(img_path) = rendered_pngs.get(idx) {
                let bytes = std::fs::read(img_path).unwrap_or_default();
                crate::artifacts::write_artifact_bytes(
                    db,
                    service_id.clone(),
                    parent_path.clone(),
                    format!("{}.png", safe_title),
                    bytes,
                )?
            } else if idx == 0 {
                if let Some(bytes) = pptx_thumb.clone() {
                    crate::artifacts::write_artifact_bytes(
                        db,
                        service_id.clone(),
                        parent_path.clone(),
                        format!("{}.jpeg", safe_title),
                        bytes,
                    )?
                } else {
                    store_text_slide(db, service_id.clone(), parent_path.clone(), &title, &text)?
                }
            } else {
                store_text_slide(db, service_id.clone(), parent_path.clone(), &title, &text)?
            };

            results.push(SlideImportResult {
                artifact,
                slide_index: idx,
                text_content: text,
                source_file: src.clone(),
            });
        }

        if let Some(dir) = render_dir {
            let _ = std::fs::remove_dir_all(dir);
        }
    }

    Ok(results)
}

// ─── PDF Import ──────────────────────────────────────────────────────────────

/// Import one or more `.pdf` files, creating one artifact per page.
pub fn import_pdf(
    db: &mut ArtifactsDb,
    service_id: Option<String>,
    parent_path: Option<String>,
    source_paths: Vec<String>,
) -> anyhow::Result<Vec<SlideImportResult>> {
    let mut results = Vec::new();

    for src in &source_paths {
        let src_path = Path::new(src);
        let stem = src_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("document");

        // Extract text per page via lopdf.
        let page_texts = extract_pdf_text(src_path);
        let page_count = page_texts.len().max(1);

        // Render pages to PNGs (best-effort).
        let render_dir = make_tmp_dir("ow_pdf_render");
        let rendered_pngs: Vec<PathBuf> = if let Some(ref dir) = render_dir {
            render_pdf_pages(src_path, dir)
        } else {
            vec![]
        };

        for idx in 0..page_count {
            let text = page_texts.get(idx).cloned().unwrap_or_default();
            let title = format!("{} — Page {}", stem, idx + 1);
            let safe_title = sanitize_filename(&title);

            let artifact = if let Some(img_path) = rendered_pngs.get(idx) {
                let bytes = std::fs::read(img_path).unwrap_or_default();
                if bytes.is_empty() {
                    store_text_slide(db, service_id.clone(), parent_path.clone(), &title, &text)?
                } else {
                    crate::artifacts::write_artifact_bytes(
                        db,
                        service_id.clone(),
                        parent_path.clone(),
                        format!("{}.png", safe_title),
                        bytes,
                    )?
                }
            } else {
                store_text_slide(db, service_id.clone(), parent_path.clone(), &title, &text)?
            };

            results.push(SlideImportResult {
                artifact,
                slide_index: idx,
                text_content: text,
                source_file: src.clone(),
            });
        }

        if let Some(dir) = render_dir {
            let _ = std::fs::remove_dir_all(dir);
        }
    }

    Ok(results)
}

// ─── PPTX helpers ─────────────────────────────────────────────────────────────

/// Returns slide XML entry names in sorted order (e.g. `["ppt/slides/slide1.xml", ...]`).
fn collect_slide_names(archive: &mut zip::ZipArchive<std::fs::File>) -> Vec<String> {
    let mut names: Vec<String> = (0..archive.len())
        .filter_map(|i| {
            let entry = archive.by_index(i).ok()?;
            let name = entry.name().to_owned();
            if name.starts_with("ppt/slides/slide")
                && name.ends_with(".xml")
                && !name.contains("/_rels/")
            {
                Some(name)
            } else {
                None
            }
        })
        .collect();
    // Sort numerically by the slide number at the end of the filename.
    names.sort_by_key(|n| {
        let digits: String = n
            .chars()
            .rev()
            .take_while(|c: &char| c.is_ascii_digit())
            .collect::<String>()
            .chars()
            .rev()
            .collect();
        digits.parse::<usize>().unwrap_or(0)
    });
    names
}

/// Fallback: return slide-like XML names when the primary heuristic finds none.
fn fallback_slide_names(archive: &mut zip::ZipArchive<std::fs::File>) -> Vec<String> {
    (0..archive.len())
        .filter_map(|i| {
            let entry = archive.by_index(i).ok()?;
            let name = entry.name().to_owned();
            if name.starts_with("ppt/slides/") && name.ends_with(".xml") {
                Some(name)
            } else {
                None
            }
        })
        .take(32) // safety cap
        .collect()
}

/// Extracts all `<a:t>` text nodes from a slide XML entry, joined with spaces.
fn extract_slide_text(archive: &mut zip::ZipArchive<std::fs::File>, slide_name: &str) -> String {
    use quick_xml::events::Event;
    use quick_xml::Reader;

    let Ok(mut entry) = archive.by_name(slide_name) else {
        return String::new();
    };
    let mut xml = String::new();
    if entry.read_to_string(&mut xml).is_err() {
        return String::new();
    }

    let mut reader = Reader::from_str(&xml);
    reader.config_mut().trim_text(true);
    let mut buf = Vec::new();
    let mut texts = Vec::new();
    let mut in_text = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) | Ok(Event::Empty(ref e)) => {
                in_text = e.local_name().as_ref() == b"t";
            }
            Ok(Event::Text(e)) if in_text => {
                if let Ok(s) = e.unescape() {
                    let trimmed = s.trim().to_owned();
                    if !trimmed.is_empty() {
                        texts.push(trimmed);
                    }
                }
                in_text = false;
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }

    texts.join(" ")
}

/// Tries to extract the embedded thumbnail from `docProps/thumbnail.*`.
fn extract_pptx_thumbnail(archive: &mut zip::ZipArchive<std::fs::File>) -> Option<Vec<u8>> {
    let thumb_name = (0..archive.len()).find_map(|i| {
        let entry = archive.by_index(i).ok()?;
        let name = entry.name().to_owned();
        if name.starts_with("docProps/thumbnail") {
            Some(name)
        } else {
            None
        }
    })?;

    let mut entry = archive.by_name(&thumb_name).ok()?;
    let mut buf: Vec<u8> = Vec::new();
    entry.read_to_end(&mut buf).ok()?;
    if buf.is_empty() {
        None
    } else {
        Some(buf)
    }
}

/// Renders all slides to PNGs using LibreOffice headless.
/// Returns true if LibreOffice ran and exited successfully.
fn render_pptx_libreoffice(src: &Path, out_dir: &Path) -> bool {
    let Some(lo) = find_libreoffice_binary() else {
        return false;
    };

    Command::new(&lo)
        .args([
            "--headless",
            "--convert-to",
            "png:impress_png_Export",
            "--outdir",
        ])
        .arg(out_dir)
        .arg(src)
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Searches common install locations for the LibreOffice executable.
fn find_libreoffice_binary() -> Option<PathBuf> {
    let candidates = [
        "/usr/bin/libreoffice",
        "/usr/bin/soffice",
        "/usr/local/bin/libreoffice",
        "/usr/local/bin/soffice",
        "/opt/libreoffice/program/soffice",
        "/Applications/LibreOffice.app/Contents/MacOS/soffice",
        "libreoffice",
        "soffice",
    ];
    for c in &candidates {
        let p = PathBuf::from(c);
        if p.exists() {
            return Some(p);
        }
        if Command::new("which")
            .arg(c)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
        {
            return Some(PathBuf::from(c));
        }
    }
    None
}

// ─── PDF helpers ─────────────────────────────────────────────────────────────

/// Extracts text from each PDF page using lopdf.
fn extract_pdf_text(path: &Path) -> Vec<String> {
    let Ok(doc) = lopdf::Document::load(path) else {
        return vec![];
    };

    // get_pages() returns a BTreeMap<page_number, object_id>
    let page_ids: Vec<_> = doc.get_pages().into_values().collect();
    let mut texts = Vec::with_capacity(page_ids.len());

    for page_id in page_ids {
        let text = doc
            .extract_text(&[page_id.0])
            .unwrap_or_default()
            .trim()
            .to_owned();
        texts.push(text);
    }

    texts
}

/// Renders PDF pages to PNGs via the best available renderer on this machine.
fn render_pdf_pages(src: &Path, out_dir: &Path) -> Vec<PathBuf> {
    if render_pdf_ghostscript(src, out_dir) {
        return collect_numbered_pngs(out_dir);
    }
    if render_pdf_pdftoppm(src, out_dir) {
        return collect_numbered_pngs(out_dir);
    }
    if render_pdf_mutool(src, out_dir) {
        return collect_numbered_pngs(out_dir);
    }
    #[cfg(target_os = "macos")]
    if render_pdf_sips(src, out_dir) {
        return collect_numbered_pngs(out_dir);
    }
    vec![]
}

fn render_pdf_ghostscript(src: &Path, out_dir: &Path) -> bool {
    let output_pattern = out_dir.join("page-%04d.png");
    Command::new("gs")
        .args(["-dNOPAUSE", "-dBATCH", "-sDEVICE=pngalpha", "-r144"])
        .arg(format!("-sOutputFile={}", output_pattern.display()))
        .arg(src)
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn render_pdf_pdftoppm(src: &Path, out_dir: &Path) -> bool {
    let prefix = out_dir.join("page");
    Command::new("pdftoppm")
        .args(["-png", "-r", "144"])
        .arg(src)
        .arg(&prefix)
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn render_pdf_mutool(src: &Path, out_dir: &Path) -> bool {
    let output_pattern = out_dir.join("page-%d.png");
    Command::new("mutool")
        .arg("convert")
        .args(["-F", "png", "-o"])
        .arg(&output_pattern)
        .arg(src)
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

#[cfg(target_os = "macos")]
fn render_pdf_sips(src: &Path, out_dir: &Path) -> bool {
    // sips can handle single-page PDFs.
    let out = out_dir.join("page-0001.png");
    Command::new("sips")
        .args(["--setProperty", "format", "png"])
        .arg(src)
        .args(["--out"])
        .arg(&out)
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

/// Collects all `.png` files in `dir` sorted by filename.
fn collect_numbered_pngs(dir: &Path) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return vec![];
    };
    let mut pngs: Vec<PathBuf> = entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().and_then(|e| e.to_str()) == Some("png"))
        .collect();
    pngs.sort();
    pngs
}

/// Creates a temp directory for rendering. Returns None on failure.
fn make_tmp_dir(prefix: &str) -> Option<PathBuf> {
    let dir = std::env::temp_dir().join(format!("{}_{}", prefix, std::process::id()));
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir)
}

/// Stores a text-only artifact (no image).
fn store_text_slide(
    db: &mut ArtifactsDb,
    service_id: Option<String>,
    parent_path: Option<String>,
    title: &str,
    text: &str,
) -> anyhow::Result<ArtifactEntry> {
    let file_name = format!("{}.txt", sanitize_filename(title));
    crate::artifacts::write_artifact_bytes(
        db,
        service_id,
        parent_path,
        file_name,
        text.as_bytes().to_vec(),
    )
}

/// Replaces characters that are unsafe in filenames.
fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c => c,
        })
        .collect()
}

// ─── Unit tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_removes_unsafe_chars() {
        assert_eq!(
            sanitize_filename("Hello / World: Slide?"),
            "Hello _ World_ Slide_"
        );
    }

    #[test]
    fn sanitize_pass_through_normal() {
        assert_eq!(
            sanitize_filename("My Sermon Notes.png"),
            "My Sermon Notes.png"
        );
    }

    #[test]
    fn collect_numbered_pngs_sorts_correctly() {
        let dir = std::env::temp_dir().join("ow_test_pngs_sort");
        std::fs::create_dir_all(&dir).unwrap();
        for n in &["page-0003.png", "page-0001.png", "page-0002.png"] {
            std::fs::write(dir.join(n), b"x").unwrap();
        }
        let pngs = collect_numbered_pngs(&dir);
        let names: Vec<_> = pngs
            .iter()
            .map(|p| p.file_name().unwrap().to_str().unwrap())
            .collect();
        assert_eq!(names, ["page-0001.png", "page-0002.png", "page-0003.png"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn make_tmp_dir_creates_dir() {
        let dir = make_tmp_dir("ow_test_mk").unwrap();
        assert!(dir.exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn libreoffice_not_found_returns_false() {
        // Renders false when a non-existent binary is used.
        let tmp = std::env::temp_dir().join("ow_lo_test");
        std::fs::create_dir_all(&tmp).unwrap();
        let fake_src = PathBuf::from("/nonexistent/file.pptx");
        assert!(!render_pptx_libreoffice(&fake_src, &tmp));
        let _ = std::fs::remove_dir_all(&tmp);
    }
}
