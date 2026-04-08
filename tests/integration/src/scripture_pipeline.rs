//! Integration test: full scripture pipeline
//!
//! Tests the end-to-end flow: DB seed → search index build → verse lookup.
//! Validates that ow-db, ow-search, and ow-core work together correctly.

use anyhow::Result;

/// Build a search engine from a freshly seeded database.
fn build_engine() -> Result<ow_search::SearchEngine> {
    let conn = ow_db::open_and_seed()?;
    let verses = ow_db::get_all_verses(&conn)?;
    let engine = ow_search::SearchEngine::build(&verses)?;
    Ok(engine)
}

#[test]
fn pipeline_db_to_search_index_roundtrip() -> Result<()> {
    let conn = ow_db::open_and_seed()?;
    let translations = ow_db::list_translations(&conn)?;
    let verses = ow_db::get_all_verses(&conn)?;

    // Seed data should have 3 translations
    assert_eq!(translations.len(), 3);
    assert!(!verses.is_empty());

    // Build search index from DB data
    let engine = ow_search::SearchEngine::build(&verses)?;

    // Every verse in the DB should be findable by exact reference
    for translation in &translations {
        let results = engine.search(
            "John 3:16",
            Some(&translation.abbreviation),
            10,
        )?;
        assert!(
            !results.is_empty(),
            "John 3:16 not found for {}",
            translation.abbreviation
        );
        assert_eq!(results[0].translation, translation.abbreviation);
    }

    Ok(())
}

#[test]
fn pipeline_all_db_verses_indexed() -> Result<()> {
    let conn = ow_db::open_and_seed()?;
    let verses = ow_db::get_all_verses(&conn)?;
    let engine = ow_search::SearchEngine::build(&verses)?;

    // Spot-check: each translation's Genesis 1:1 should be in the index
    for abbrev in &["KJV", "WEB", "BSB"] {
        let results = engine.search("Genesis 1:1", Some(abbrev), 5)?;
        assert_eq!(
            results.len(),
            1,
            "Expected exactly 1 Genesis 1:1 for {abbrev}, got {}",
            results.len()
        );
        assert!(results[0].text.contains("beginning"));
    }

    Ok(())
}

#[test]
fn pipeline_search_result_fields_match_db() -> Result<()> {
    let conn = ow_db::open_and_seed()?;
    let verses = ow_db::get_all_verses(&conn)?;
    let engine = ow_search::SearchEngine::build(&verses)?;

    let search_results = engine.search("John 3:16", Some("KJV"), 1)?;
    assert_eq!(search_results.len(), 1);

    let search_verse = &search_results[0];
    let db_verse = verses
        .iter()
        .find(|v| {
            v.translation == "KJV" && v.book == "John" && v.chapter == 3 && v.verse == 16
        })
        .expect("John 3:16 KJV must exist in DB");

    // Fields from search should match the DB source
    assert_eq!(search_verse.translation, db_verse.translation);
    assert_eq!(search_verse.book, db_verse.book);
    assert_eq!(search_verse.chapter, db_verse.chapter);
    assert_eq!(search_verse.verse, db_verse.verse);
    assert_eq!(search_verse.text, db_verse.text);

    Ok(())
}

#[test]
fn pipeline_free_text_search_across_translations() -> Result<()> {
    let engine = build_engine()?;

    // "shepherd" appears in Psalms 23 across all translations
    let results = engine.search("shepherd", None, 50)?;
    assert!(!results.is_empty());

    let translations: std::collections::HashSet<&str> =
        results.iter().map(|r| r.translation.as_str()).collect();

    // Should find results in at least KJV and WEB
    assert!(
        translations.contains("KJV"),
        "Expected shepherd results in KJV"
    );
    assert!(
        translations.contains("WEB"),
        "Expected shepherd results in WEB"
    );

    Ok(())
}

#[test]
fn pipeline_chapter_search_returns_all_verses() -> Result<()> {
    let engine = build_engine()?;

    // Psalms 23 has 6 verses in seed data for KJV
    let results = engine.search("Psalms 23", Some("KJV"), 20)?;
    assert_eq!(results.len(), 6, "Psalms 23 KJV should have 6 seed verses");

    // All results should be from Psalms chapter 23
    for r in &results {
        assert_eq!(r.book, "Psalms");
        assert_eq!(r.chapter, 23);
        assert_eq!(r.translation, "KJV");
    }

    Ok(())
}

#[test]
fn pipeline_queue_item_from_search_result() -> Result<()> {
    let engine = build_engine()?;

    let results = engine.search("John 3:16", Some("KJV"), 1)?;
    assert_eq!(results.len(), 1);

    let verse = &results[0];

    // Create a QueueItem from the search result (simulates the detection pipeline)
    let item = ow_core::QueueItem::new(
        verse.reference.clone(),
        verse.text.clone(),
        verse.translation.clone(),
    );

    assert_eq!(item.reference, "John 3:16");
    assert_eq!(item.translation, "KJV");
    assert!(item.text.contains("God so loved"));
    assert_eq!(item.status, ow_core::QueueStatus::Pending);
    assert!(!item.id.is_empty());

    Ok(())
}

#[test]
fn pipeline_serialization_roundtrip() -> Result<()> {
    let engine = build_engine()?;
    let results = engine.search("John 3:16", Some("KJV"), 1)?;
    let verse = &results[0];

    let item = ow_core::QueueItem::new(
        verse.reference.clone(),
        verse.text.clone(),
        verse.translation.clone(),
    );

    // Serialize to JSON and back
    let json = serde_json::to_string(&item)?;
    let deserialized: ow_core::QueueItem = serde_json::from_str(&json)?;

    assert_eq!(deserialized.reference, item.reference);
    assert_eq!(deserialized.text, item.text);
    assert_eq!(deserialized.translation, item.translation);
    assert_eq!(deserialized.status, item.status);
    assert_eq!(deserialized.id, item.id);

    Ok(())
}
