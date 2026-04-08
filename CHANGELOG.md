# Changelog

All notable changes to OpenWorship are documented here.

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

