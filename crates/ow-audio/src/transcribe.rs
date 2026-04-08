use anyhow::Result;

/// Synchronously transcribes a chunk of 16 kHz mono f32 audio to text.
pub trait Transcriber: Send + 'static {
    fn transcribe(&mut self, samples: &[f32]) -> Result<String>;
}

// ---------------------------------------------------------------------------
// Mock transcriber (always available, used in tests and when model is absent)
// ---------------------------------------------------------------------------

/// A transcriber that returns a fixed or generated string — useful for tests
/// and UI development without a real model.
pub struct MockTranscriber {
    counter: u32,
}

impl MockTranscriber {
    pub fn new() -> Self {
        Self { counter: 0 }
    }
}

impl Default for MockTranscriber {
    fn default() -> Self {
        Self::new()
    }
}

impl Transcriber for MockTranscriber {
    fn transcribe(&mut self, _samples: &[f32]) -> Result<String> {
        self.counter += 1;
        Ok(format!("[mock transcript {}]", self.counter))
    }
}

// ---------------------------------------------------------------------------
// Real Whisper transcriber (only compiled with the `whisper` feature)
// ---------------------------------------------------------------------------

#[cfg(feature = "whisper")]
pub struct WhisperTranscriber {
    ctx: whisper_rs::WhisperContext,
    state: whisper_rs::WhisperState<'static>,
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
        // SAFETY: state borrows ctx; we box both together so lifetimes align.
        let ctx = Box::leak(Box::new(ctx));
        let state = ctx
            .create_state()
            .map_err(|e| anyhow::anyhow!("Failed to create whisper state: {e}"))?;
        Ok(Self { ctx: unsafe { std::ptr::read(ctx as *const _) }, state })
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

        self.state
            .full(params, samples)
            .map_err(|e| anyhow::anyhow!("Whisper transcription error: {e}"))?;

        let n = self.state.full_n_segments().map_err(|e| anyhow::anyhow!("{e}"))?;
        let mut out = String::new();
        for i in 0..n {
            if let Ok(seg) = self.state.full_get_segment_text(i) {
                out.push_str(seg.trim());
                out.push(' ');
            }
        }
        Ok(out.trim().to_string())
    }
}

/// Resolve the model path using:
/// 1. `OPENWORSHIP_WHISPER_MODEL` env var
/// 2. `~/.openworship/models/ggml-tiny.en.bin`
#[cfg(feature = "whisper")]
pub fn resolve_model_path() -> Result<std::path::PathBuf> {
    if let Ok(p) = std::env::var("OPENWORSHIP_WHISPER_MODEL") {
        let path = std::path::PathBuf::from(p);
        if path.exists() {
            return Ok(path);
        }
    }
    let home = std::env::var("HOME").unwrap_or_default();
    let default = std::path::PathBuf::from(home)
        .join(".openworship")
        .join("models")
        .join("ggml-tiny.en.bin");
    if default.exists() {
        return Ok(default);
    }
    bail!(
        "Whisper model not found. Set OPENWORSHIP_WHISPER_MODEL or run scripts/download-whisper-model.sh"
    )
}
