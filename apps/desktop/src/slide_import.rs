//! PPTX and PDF slide import — converts external slide decks into
//! `AnnouncementItem` display slides that OpenWorship can push to the display.
//!
//! # PPTX (PowerPoint)
//! A `.pptx` file is a ZIP archive following the Open Packaging Convention.
//! Each slide lives at `ppt/slides/slide{N}.xml`.  Text runs (`<a:t>`) are
//! extracted in document order; placeholder type (title vs. body) is used to
//! separate the heading from body text.
//!
//! # PDF
//! PDF text is extracted using `lopdf`.  Text objects are collected per-page
//! and joined into a single body string.  Extraction is best-effort — some PDFs
//! store text as glyph indices that cannot be decoded without the embedded font;
//! those pages fall back to a placeholder body.

use anyhow::{Context, Result};
use std::io::Read;
use std::path::Path;

// ─── Public output type ───────────────────────────────────────────────────────

/// A single imported slide before it is persisted as an `AnnouncementItem`.
#[derive(Debug, Clone)]
pub struct ParsedSlide {
    /// Slide heading (title placeholder, or "Slide N" fallback).
    pub title: String,
    /// Body text extracted from the slide content area.
    pub body: String,
}

// ─── PPTX ────────────────────────────────────────────────────────────────────

/// Extract slides from a `.pptx` file as text.
///
/// Returns one `ParsedSlide` per slide, in presentation order.
pub fn import_pptx(path: &Path) -> Result<Vec<ParsedSlide>> {
    let file = std::fs::File::open(path)
        .with_context(|| format!("cannot open PPTX: {}", path.display()))?;
    let mut archive =
        zip::ZipArchive::new(file).context("not a valid PPTX/ZIP archive")?;

    // Collect slide file names so we can sort them numerically.
    let slide_names: Vec<String> = (0..archive.len())
        .filter_map(|i| {
            let name = archive.by_index(i).ok()?.name().to_string();
            if name.starts_with("ppt/slides/slide")
                && name.ends_with(".xml")
                && !name.contains("Layout")
                && !name.contains("Master")
            {
                Some(name)
            } else {
                None
            }
        })
        .collect();

    // Sort: slide1.xml < slide2.xml < slide10.xml
    let mut slide_names = slide_names;
    slide_names.sort_by_key(|n| {
        n.trim_start_matches("ppt/slides/slide")
            .trim_end_matches(".xml")
            .parse::<u32>()
            .unwrap_or(0)
    });

    let mut slides = Vec::with_capacity(slide_names.len());
    for (idx, name) in slide_names.iter().enumerate() {
        let mut entry = archive
            .by_name(name)
            .with_context(|| format!("missing slide entry {name}"))?;
        let mut xml_bytes = Vec::new();
        entry.read_to_end(&mut xml_bytes)?;
        let xml = String::from_utf8_lossy(&xml_bytes);
        let parsed = parse_slide_xml(&xml, idx + 1);
        slides.push(parsed);
    }

    Ok(slides)
}

/// Parse a single slide XML, returning title + body text.
fn parse_slide_xml(xml: &str, slide_num: usize) -> ParsedSlide {
    use quick_xml::events::Event;
    use quick_xml::Reader;

    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);

    // We track:
    //   - Whether we're inside a title placeholder (<p:ph type="title"|"ctrTitle">)
    //   - Whether we're inside a text run (<a:t>)
    let mut in_title_ph = false;
    let mut in_text_run = false;
    let mut title_parts: Vec<String> = Vec::new();
    let mut body_parts: Vec<String> = Vec::new();
    // Stack depth of <p:sp> so we can reset on </p:sp>
    let mut sp_depth: u32 = 0;
    let mut in_sp = false;
    let mut current_is_title = false;

    loop {
        match reader.read_event() {
            Ok(Event::Start(ref e)) => {
                let qname = e.name();
                let local = local_name(qname.as_ref());
                match local {
                    b"sp" => {
                        in_sp = true;
                        sp_depth += 1;
                        current_is_title = false;
                        in_title_ph = false;
                    }
                    b"ph" if in_sp => {
                        // Check type attribute for title indicators
                        for attr in e.attributes().flatten() {
                            if attr.key.as_ref() == b"type" {
                                let val = attr.value.as_ref();
                                if val == b"title" || val == b"ctrTitle" || val == b"subTitle" {
                                    current_is_title = true;
                                    in_title_ph = true;
                                }
                            }
                        }
                    }
                    b"t" => {
                        in_text_run = true;
                    }
                    _ => {}
                }
            }
            Ok(Event::End(ref e)) => {
                let qname = e.name();
                let local = local_name(qname.as_ref());
                match local {
                    b"sp" => {
                        sp_depth = sp_depth.saturating_sub(1);
                        if sp_depth == 0 {
                            in_sp = false;
                            current_is_title = false;
                            in_title_ph = false;
                        }
                    }
                    b"t" => {
                        in_text_run = false;
                    }
                    b"p" if in_title_ph || current_is_title => {
                        title_parts.push("\n".into());
                    }
                    b"p" => {
                        body_parts.push("\n".into());
                    }
                    _ => {}
                }
            }
            Ok(Event::Text(ref e)) if in_text_run => {
                let text = e.unescape().unwrap_or_default().to_string();
                if !text.trim().is_empty() {
                    if in_title_ph || current_is_title {
                        title_parts.push(text);
                    } else {
                        body_parts.push(text);
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
    }

    let title = join_text(&title_parts)
        .unwrap_or_else(|| format!("Slide {slide_num}"));
    let body = join_text(&body_parts).unwrap_or_default();

    ParsedSlide { title, body }
}

/// Strip namespace prefix from an element name byte slice.
fn local_name(name: &[u8]) -> &[u8] {
    name.iter()
        .position(|&b| b == b':')
        .map(|i| &name[i + 1..])
        .unwrap_or(name)
}

/// Join text fragments, trim, and return `None` if empty.
fn join_text(parts: &[String]) -> Option<String> {
    let joined = parts.join("").trim().to_string();
    // Remove leading/trailing standalone newlines
    let trimmed = joined
        .lines()
        .map(|l| l.trim())
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string();
    if trimmed.is_empty() { None } else { Some(trimmed) }
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

/// Extract pages from a `.pdf` file as text slides.
///
/// Returns one `ParsedSlide` per page.  Text extraction is best-effort;
/// pages that contain only images or use non-decodable encodings will have
/// an empty body.
pub fn import_pdf(path: &Path) -> Result<Vec<ParsedSlide>> {
    let doc = lopdf::Document::load(path)
        .with_context(|| format!("cannot open PDF: {}", path.display()))?;

    // page_iter() yields ObjectId = (u32, u16) in lopdf
    let pages: Vec<lopdf::ObjectId> = doc.page_iter().collect();
    let mut slides = Vec::with_capacity(pages.len());

    for (idx, page_id) in pages.iter().enumerate() {
        let page_num = idx + 1;
        let title = format!("Page {page_num}");

        // Extract all text objects from the page's content stream(s).
        let body = extract_pdf_page_text(&doc, *page_id)
            .unwrap_or_default()
            .trim()
            .to_string();

        slides.push(ParsedSlide { title, body });
    }
    Ok(slides)
}

/// Extract text from a single PDF page by walking the content streams.
fn extract_pdf_page_text(doc: &lopdf::Document, page_id: lopdf::ObjectId) -> Option<String> {
    use lopdf::content::Content;

    let page_dict = doc.get_page_content(page_id).ok()?;
    let content = Content::decode(&page_dict).ok()?;

    let mut text = String::new();
    let mut in_text = false;

    for op in &content.operations {
        match op.operator.as_str() {
            "BT" => {
                in_text = true;
            }
            "ET" => {
                in_text = false;
                if !text.ends_with('\n') {
                    text.push('\n');
                }
            }
            "Tj" | "TJ" | "'" | "\"" if in_text => {
                extract_text_operands(&op.operands, &mut text);
            }
            "Td" | "TD" | "T*" if in_text && !text.ends_with('\n') => {
                // Line advance — insert newline
                text.push('\n');
            }
            _ => {}
        }
    }

    if text.trim().is_empty() {
        None
    } else {
        Some(text)
    }
}

/// Decode PDF text operands (string or array of strings/numbers).
fn extract_text_operands(operands: &[lopdf::Object], out: &mut String) {
    use lopdf::Object;
    for obj in operands {
        match obj {
            Object::String(bytes, _) => {
                // Try UTF-16 BE (BOM FF FE or FE FF), fall back to latin-1
                if bytes.len() >= 2 && bytes[0] == 0xFE && bytes[1] == 0xFF {
                    // UTF-16 BE
                    let chars: String = bytes[2..]
                        .chunks_exact(2)
                        .flat_map(|c| char::from_u32(u32::from(c[0]) << 8 | u32::from(c[1])))
                        .collect();
                    out.push_str(&chars);
                } else {
                    // Latin-1 / PDFDoc encoding
                    let s: String = bytes.iter().map(|&b| b as char).collect();
                    out.push_str(&s);
                }
            }
            Object::Array(items) => {
                for item in items {
                    match item {
                        Object::String(bytes, _) => {
                            let s: String = bytes.iter().map(|&b| b as char).collect();
                            out.push_str(&s);
                        }
                        Object::Real(n) if *n < -100.0 => {
                            // Large negative kerning = word space
                            out.push(' ');
                        }
                        _ => {}
                    }
                }
            }
            _ => {}
        }
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn local_name_strips_prefix() {
        assert_eq!(local_name(b"a:t"), b"t");
        assert_eq!(local_name(b"p:sp"), b"sp");
        assert_eq!(local_name(b"sp"), b"sp");
    }

    #[test]
    fn join_text_trims_whitespace() {
        let parts = vec!["  Hello  ".into(), "\n".into(), "World".into()];
        assert_eq!(join_text(&parts), Some("Hello\nWorld".into()));
    }

    #[test]
    fn join_text_empty_returns_none() {
        assert_eq!(join_text(&["\n".into(), "  ".into()]), None);
    }
}
