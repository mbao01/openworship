use anyhow::Result;

/// Synchronously transcribes a chunk of 16 kHz mono f32 audio to text.
pub trait Transcriber: Send + 'static {
    fn transcribe(&mut self, samples: &[f32]) -> Result<String>;
}

// ---------------------------------------------------------------------------
// Real Whisper transcriber (only compiled with the `whisper` feature)
// ---------------------------------------------------------------------------

#[cfg(feature = "whisper")]
pub struct WhisperTranscriber {
    state: whisper_rs::WhisperState,
}

#[cfg(feature = "whisper")]
impl WhisperTranscriber {
    /// Create a new transcriber, loading the ggml model from `model_path`.
    pub fn new(model_path: &std::path::Path) -> Result<Self> {
        use whisper_rs::{WhisperContext, WhisperContextParameters};
        anyhow::ensure!(model_path.exists(), "Model not found: {}", model_path.display());
        let ctx = WhisperContext::new_with_params(
            model_path.to_str().unwrap(),
            WhisperContextParameters::default(),
        )
        .map_err(|e| anyhow::anyhow!("Failed to load whisper model: {e}"))?;
        let state = ctx
            .create_state()
            .map_err(|e| anyhow::anyhow!("Failed to create whisper state: {e}"))?;
        Ok(Self { state })
    }

    /// Try to load from the standard model resolution path.
    pub fn from_env() -> Result<Self> {
        let path = resolve_model_path()?;
        Self::new(&path)
    }
}

/// Returns `true` if the text is a Whisper hallucination token rather than
/// real transcribed speech. Whisper commonly emits bracketed/parenthesised
/// sound descriptions and filler tokens when it hears non-speech audio.
#[cfg(feature = "whisper")]
fn is_hallucination(text: &str) -> bool {
    let s = text.trim();
    if s.is_empty() {
        return true;
    }
    // Anything wrapped in [...] or (...) is a sound description, not speech.
    // e.g. "[Silence]", "[BLANK_AUDIO]", "(humming)", "(keyboard clicking)"
    if (s.starts_with('[') && s.ends_with(']'))
        || (s.starts_with('(') && s.ends_with(')'))
    {
        return true;
    }
    // Catch common hallucinations that appear without brackets.
    let lower = s.to_lowercase();
    matches!(
        lower.as_str(),
        "blank_audio"
            | "silence"
            | "you"
            | "thank you."
            | "thanks for watching."
            | "thanks for watching!"
            | "thank you for watching."
            | "thank you for watching!"
            | "subscribe"
            | "♪"
            | "..."
            | "!"
    )
}

#[cfg(feature = "whisper")]
impl Transcriber for WhisperTranscriber {
    fn transcribe(&mut self, samples: &[f32]) -> Result<String> {
        use whisper_rs::FullParams;
        // Beam search produces significantly better word boundaries than greedy.
        let mut params = FullParams::new(whisper_rs::SamplingStrategy::BeamSearch {
            beam_size: 5,
            patience: 1.0,
        });
        params.set_language(Some("en"));
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);
        params.set_print_special(false);
        // Allow multiple segments — a 5s window can contain 2-3 natural phrases.
        params.set_single_segment(false);
        // Each sliding window is independent; enabling context with overlapping
        // windows causes repetition artifacts.
        params.set_no_context(true);
        // With the larger 5s window, the default no-speech threshold works well
        // to filter silence segments. 0.6 is the Whisper default.
        params.set_no_speech_thold(0.6);

        // Whisper requires >= 1 s of audio, but in practice needs ≥1.5 s to
        // produce any segments at all. Our default chunk is 2 s (32_000 samples).
        // This padding is a safety net for edge cases / sample-rate rounding.
        const MIN_SAMPLES: usize = 16_160;
        let buf;
        let input = if samples.len() < MIN_SAMPLES {
            buf = {
                let mut v = samples.to_vec();
                v.resize(MIN_SAMPLES, 0.0);
                v
            };
            &buf
        } else {
            samples
        };

        self.state
            .full(params, input)
            .map_err(|e| anyhow::anyhow!("Whisper transcription error: {e}"))?;

        let n = self.state.full_n_segments().map_err(|e| anyhow::anyhow!("{e}"))?;
        let mut out = String::new();
        for i in 0..n {
            if let Ok(seg) = self.state.full_get_segment_text(i) {
                let trimmed = seg.trim();
                if !is_hallucination(trimmed) {
                    out.push_str(trimmed);
                    out.push(' ');
                }
            }
        }
        let result = out.trim().to_string();
        Ok(result)
    }
}

/// Returns the models directory (`~/.openworship/models/`).
#[cfg(feature = "whisper")]
pub fn models_dir() -> std::path::PathBuf {
    let home = std::env::var("HOME").unwrap_or_default();
    std::path::PathBuf::from(home)
        .join(".openworship")
        .join("models")
}

/// Returns the canonical path for a specific model filename.
#[cfg(feature = "whisper")]
pub fn model_path_for(filename: &str) -> std::path::PathBuf {
    models_dir().join(filename)
}

/// Returns the canonical path where the primary Whisper model should live.
/// Defaults to base.en; callers that know the configured model should use `model_path_for()`.
#[cfg(feature = "whisper")]
pub fn default_model_path() -> std::path::PathBuf {
    model_path_for("ggml-base.en.bin")
}

/// Check whether a specific model file exists.
#[cfg(feature = "whisper")]
pub fn check_model(filename: &str) -> bool {
    model_path_for(filename).exists()
}

/// Resolve the model path using:
/// 1. `OPENWORSHIP_WHISPER_MODEL` env var
/// 2. The requested model filename (if provided)
/// 3. `~/.openworship/models/ggml-base.en.bin` (fallback)
/// 4. `~/.openworship/models/ggml-tiny.en.bin`  (legacy fallback)
#[cfg(feature = "whisper")]
pub fn resolve_model_path() -> Result<std::path::PathBuf> {
    resolve_model_path_for(None)
}

/// Resolve the model path for a specific model filename, with fallback chain.
#[cfg(feature = "whisper")]
pub fn resolve_model_path_for(preferred_filename: Option<&str>) -> Result<std::path::PathBuf> {
    if let Ok(p) = std::env::var("OPENWORSHIP_WHISPER_MODEL") {
        let path = std::path::PathBuf::from(p);
        if path.exists() {
            return Ok(path);
        }
    }
    let dir = models_dir();
    // Build fallback chain: preferred → base → tiny
    let mut candidates: Vec<&str> = Vec::new();
    if let Some(pref) = preferred_filename {
        candidates.push(pref);
    }
    for fallback in ["ggml-base.en.bin", "ggml-tiny.en.bin"] {
        if !candidates.contains(&fallback) {
            candidates.push(fallback);
        }
    }
    for name in &candidates {
        let path = dir.join(name);
        if path.exists() {
            return Ok(path);
        }
    }
    anyhow::bail!(
        "Whisper model not found. Use Settings → Audio → Download Model to install one."
    )
}
