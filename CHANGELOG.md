# Changelog

All notable changes to OpenWorship are documented here.

## [0.3.0.0] - 2026-04-08

### Added

- **Scripture Detection Pipeline** (`ow-detect` crate): Regex-based scripture reference parser supporting colon form ("John 3:16"), chapter-only ("John 3"), spoken form ("John chapter three verse sixteen"), and spoken chapter ("first Corinthians thirteen"). 5-pass deduplication with chapter-only suppression when verse-level ref exists for same book+chapter.
- **Detection Pipeline**: `DetectionPipeline` subscribes to STT broadcast, applies 30s per-reference cooldown, routes detected verses to display (Auto) or operator queue (Copilot) based on current operating mode.
- **ContentQueue**: `VecDeque`-backed queue (max 20 items) with `Pending`, `Approved`, `Dismissed` statuses and snapshot/approve/dismiss/clear operations.
- **Operating Modes**: Auto (detected verses push directly to display), Copilot (operator approves each verse), Airplane (detection paused), Offline (STT inactive).
- **Tauri Commands**: `get_queue`, `approve_verse`, `dismiss_verse`, `clear_queue`, `get_mode`, `set_mode` — full operator control over the detection pipeline.
- **ModeBar UI**: Segmented control with AUTO/COPILOT/AIRPLANE/OFFLINE buttons; Gold underline on active mode; persists mode via Tauri backend.
- **DetectionQueue UI**: Polls queue every 1s in active modes; pending verses show SHOW/DISMISS action buttons in Copilot mode; approved show "SHOWN" badge; dismissed show "DISMISSED" badge; empty-state and mode-specific status messages.

### Changed

- Replaced `ow-core` ScriptureDetector + `detection.rs` Tauri command with the new `ow-detect` crate architecture.
- Replaced `ModeToolbar.tsx` with `ModeBar.tsx` (Sacred Monochrome segmented control design).
- Operator right column now renders `ModeBar` + `DetectionQueue` wired to live mode state.
- `AppState.search` is now `Arc<SearchEngine>` (shared between search commands and the detection pipeline).

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

