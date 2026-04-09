# Changelog

All notable changes to OpenWorship are documented here.

## [0.3.1.1] - 2026-04-09

### Changed

- `MockTranscriber` removed from the public API of `ow-audio`. It now lives exclusively inside `#[cfg(test)]` in `lib.rs` — test coverage is unchanged, but the mock is no longer accidentally importable by downstream crates or the desktop app.
- Debug-only STT fallback (`#[cfg(debug_assertions)]` block using `MockTranscriber`) removed from `start_stt_with_settings`. Debug builds without a Whisper model now surface the same "no backend available" error as release builds, preventing silent no-op transcription in debug sessions.

## [0.3.1.0] - 2026-04-08

### Added

- **Artifacts Screen**: Standalone local file manager accessible from the Operator titlebar. Browse, organize, and open media files (images, video, audio, documents, presentations) associated with each service — or the global local library.
- **List + Grid Views**: Toggle between a compact table view (name, type, size, date) and an icon grid view. Filter by file type via pill buttons (Image, Video, Audio, Document, Slide, Archive).
- **Folder Navigation**: Create folders, navigate into them with breadcrumb trails, and rename or move files via right-click context menu.
- **Sidebar Navigation**: Three built-in views (All Files, Recent, Starred) plus per-service folders for open service projects.
- **File Import**: Import files from disk into the artifacts library via a file picker. Files are copied into the configured base directory.
- **Star + Rename + Delete**: Star any artifact for quick access; rename files and folders; delete with confirmation (directories warn before removing all contents).
- **ArtifactsDb (SQLite)**: Lightweight metadata index at `~/.openworship/artifacts.db` — stores path, MIME type, star state, timestamps. The actual files live on the filesystem; the DB is just an index.
- **13 Tauri Commands**: `list_artifacts`, `list_recent_artifacts`, `list_starred_artifacts`, `search_artifacts`, `create_artifact_dir`, `import_artifact_file`, `rename_artifact`, `delete_artifact`, `move_artifact`, `star_artifact`, `get_artifacts_settings`, `set_artifacts_base_path`, `open_artifact`.
- **`/artifacts` Route**: Accessible from the grid-icon button in the Operator titlebar; returns to the main view with the Back button.

### Fixed

- Path traversal blocked: `create_dir`, `rename_artifact`, and `move_artifact` now validate names and assert the resolved path stays within the artifacts base directory.
- Active service projects now shown in Artifacts sidebar (was incorrectly showing closed projects).
- Search input debounced (300 ms) to avoid SQLite lock contention on fast typing.
- Delete operations now require confirmation; directory deletes warn that contents will be permanently removed.
- `rename_artifact` SQL prefix-replace now uses `substr()` instead of `replace()` to avoid corrupting paths where the folder name appeared as a mid-string substring.
- DB entries deleted before filesystem operations in `delete_artifact` so a crash mid-delete doesn't leave ghost rows pointing to missing files.

## [0.3.0.0] - 2026-04-08

### Added

- **Multi-Translation Live Switcher**: Operator titlebar dropdown lets the operator switch Bible translation in real time; the live queue item is re-fetched in the new translation and pushed to the display immediately (`switch_live_translation` Tauri command)
- **Confidence Scoring**: `VerseResult` now carries a normalized BM25 confidence score (0.0–1.0) for every search result; exact reference lookups return `1.0`; detection queue renders a visual confidence bar per item
- **Lyrics Detection Thresholds**: `AudioSettings` gains `lyrics_threshold_auto` (default 0.70) and `lyrics_threshold_copilot` (default 0.78) fields with slider controls in SettingsModal
- **`get_active_translation` Tauri command**: Frontend can query the currently active translation without a full state reload

### Fixed

- BM25 score normalization floor changed from `1.0` to `f32::EPSILON` so the top result always scores `1.0` even on weak matches (short corpus, single-result sets)
- `parseFloat` NaN guard added to all four threshold sliders in SettingsModal (`semantic_threshold_auto`, `semantic_threshold_copilot`, `lyrics_threshold_auto`, `lyrics_threshold_copilot`) to prevent `NaN` from propagating into Rust settings
- `TranslationSwitcher.load()` wrapped in `try/catch` so backend-not-ready startup errors are silently swallowed rather than surfaced as unhandled rejections
- Removed dead `enqueue_item` wrapper from `detection.rs` (Clippy: never used; all callers already used `enqueue_item_inner`)

## [0.2.0.0] - 2026-04-08

### Added

- **Offline STT Pipeline**: `ow-audio` crate with `AudioCapturer` (cpal mic input, 16 kHz, linear-interpolation resampler), `SttEngine` (tokio broadcast, atomic stop flag), `MockTranscriber` (counter-based, works in CI without a microphone), and `WhisperTranscriber` (feature-gated `whisper` — real Whisper.cpp transcription via whisper-rs when a ggml model is present)
- **Tauri STT Commands**: `start_stt`, `stop_stt`, `get_stt_status` — start/stop the mic and stream transcript events to the frontend via `stt://transcript`
- **TranscriptPanel UI**: Operator center column shows a rolling 10-second transcript window with auto-scroll, live-pulse dot (Gold, 8px) while the mic is active, and a single start/stop button
- **3-Column Operator Layout**: Operator page restructured to left (Scripture Search, 25%), center (Live Transcript, 50%), right (Queue placeholder, 25%) per DESIGN.md spec

### Fixed

- Mutex poison guard in `start_stt` — command now returns an error string instead of panicking if the STT engine mutex is poisoned

## [0.1.0.0] - 2026-04-08

### Added

- **Scripture Database**: SQLite in-memory Bible DB seeded with KJV, WEB, and BSB translations covering Genesis 1, Psalms 23, Isaiah 40, Matthew 5, John 1/3/11/14, Romans 8, 1 Corinthians 13, and Philippians 4
- **Tantivy Search Index**: In-memory full-text index built at startup from the Bible DB; supports exact scripture reference lookup ("John 3:16", "Psalms 23") and free-text keyword search ("shepherd", "God so loved")
- **Reference Parser**: Normalizes book aliases ("jn" → John, "ps" / "psalm" → Psalms, "1 Cor" → 1 Corinthians) for natural-language reference input
- **Translation Selector**: Operator can filter search results by KJV, WEB, or BSB and switch translations mid-search
- **WebSocket Push**: Selecting a search result sends the verse to the fullscreen display via the existing WebSocket broadcast
- **ScriptureSearch UI**: Operator panel with debounced search input (220ms), live result list, translation dropdown, live-dot indicator (8px Gold) when a verse is on screen, and empty-state message
- **Operator Page Shell**: Sacred Monochrome layout — Void titlebar, Obsidian body, Iron bottom-border inputs, Gold on focus

### Fixed

- `chapter` and `verse` fields now stored in the Tantivy index so `VerseResult` returns accurate numeric coordinates
- `search()` with `limit=0` returns an empty vec instead of panicking
- Live indicator on search results now keyed on `{reference, translation}` so same verse in multiple translations highlights independently

