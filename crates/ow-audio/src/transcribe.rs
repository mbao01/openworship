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

#[cfg(feature = "whisper")]
impl Transcriber for WhisperTranscriber {
    fn transcribe(&mut self, samples: &[f32]) -> Result<String> {
        use whisper_rs::FullParams;
        let mut params = FullParams::new(whisper_rs::SamplingStrategy::Greedy { best_of: 1 });
        params.set_language(Some("en"));
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);
        params.set_single_segment(true);

        // Whisper requires >= 1 second of audio (16_000 samples at 16 kHz).
        // Pad with silence if the chunk is slightly short due to sample rate
        // conversion rounding. Use 16_160 (1.01 s) as the target rather than
        // the bare minimum so a 1-sample rounding error at the C boundary
        // cannot still trigger the "input too short" log.
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
                out.push_str(seg.trim_matches(char::is_whitespace));
                out.push(' ');
            }
        }
        Ok(out.trim().to_string())
    }
}

/// Returns the canonical path where the primary Whisper model should live.
/// This is the file that `download_whisper_model` writes to.
#[cfg(feature = "whisper")]
pub fn default_model_path() -> std::path::PathBuf {
    let home = std::env::var("HOME").unwrap_or_default();
    std::path::PathBuf::from(home)
        .join(".openworship")
        .join("models")
        .join("ggml-base.en.bin")
}

/// Resolve the model path using:
/// 1. `OPENWORSHIP_WHISPER_MODEL` env var
/// 2. `~/.openworship/models/ggml-base.en.bin` (preferred)
/// 3. `~/.openworship/models/ggml-tiny.en.bin`  (legacy fallback)
#[cfg(feature = "whisper")]
pub fn resolve_model_path() -> Result<std::path::PathBuf> {
    if let Ok(p) = std::env::var("OPENWORSHIP_WHISPER_MODEL") {
        let path = std::path::PathBuf::from(p);
        if path.exists() {
            return Ok(path);
        }
    }
    let home = std::env::var("HOME").unwrap_or_default();
    let models_dir = std::path::PathBuf::from(&home).join(".openworship").join("models");
    for name in ["ggml-base.en.bin", "ggml-tiny.en.bin"] {
        let path = models_dir.join(name);
        if path.exists() {
            return Ok(path);
        }
    }
    anyhow::bail!("Whisper model not found. Use Settings → Audio → Download Model to get ggml-base.en.bin")
}
