# Integration Tests

Cross-crate integration tests for the OpenWorship Rust backend. These tests validate that `ow-db`, `ow-search`, and `ow-core` work together correctly through the full scripture pipeline.

## Prerequisites

- **Rust** stable toolchain (see `rust-toolchain.toml` in repo root)

## Setup

No additional setup is required. The integration test crate (`ow-integration-tests`) is a member of the Cargo workspace and uses the same dependencies as the main crates.

```sh
# Ensure you can build the workspace
cargo check
```

## Running Tests

### All integration tests

```sh
task integration:test
# or
cargo test --package ow-integration-tests
```

### A specific test file

```sh
cargo test --package ow-integration-tests --test scripture_pipeline
cargo test --package ow-integration-tests --test detection_search
```

### A specific test

```sh
cargo test --package ow-integration-tests --test detection_search detect_and_lookup_single_reference
```

### With output (see println! in tests)

```sh
cargo test --package ow-integration-tests -- --nocapture
```

## Test Structure

```
tests/integration/
├── Cargo.toml                      # Crate manifest (depends on ow-core, ow-db, ow-search)
└── src/
    ├── scripture_pipeline.rs       # DB → search index roundtrip tests (7 tests)
    └── detection_search.rs         # Detection → search lookup pipeline tests (8 tests)
```

### scripture_pipeline.rs

Tests the data flow from SQLite DB to Tantivy search index:

- DB seed → index build → verse lookup roundtrip
- All translations indexed and searchable
- Search result fields match DB source data
- Free-text search across translations
- Chapter search returns all verses
- QueueItem creation from search results
- JSON serialization roundtrip

### detection_search.rs

Tests the live detection pipeline (what happens when a speaker mentions a verse):

- Single reference detection and lookup
- Multiple references in one utterance
- Natural speech format ("chapter X verse Y")
- Chapter-only detection
- Abbreviated book names
- Full pipeline: detect → search → queue
- Detection mode serialization
- False positive prevention

## Cleanup

Integration tests use in-memory SQLite and in-memory Tantivy indexes — no files are written to disk, so no cleanup is needed.

To clean compiled test artifacts:

```sh
cargo clean
```
