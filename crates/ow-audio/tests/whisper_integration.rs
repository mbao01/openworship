//! Integration test: load the real Whisper model and verify transcription
//! produces segments. Requires the model file at ~/.openworship/models/.
//! Skipped in CI (model won't be present).

#[cfg(feature = "whisper")]
mod whisper_tests {
    use ow_audio::{WhisperTranscriber, resolve_model_path};
    use ow_audio::Transcriber;

    fn skip_if_no_model() -> Option<std::path::PathBuf> {
        resolve_model_path().ok()
    }

    #[test]
    fn transcribe_tone_filters_hallucinations() {
        let Some(model_path) = skip_if_no_model() else {
            eprintln!("SKIP: no whisper model found");
            return;
        };
        eprintln!("Using model: {}", model_path.display());

        let mut t = WhisperTranscriber::new(&model_path).expect("Failed to load model");

        // 2s of mixed-frequency tone at 16kHz — matches default chunk_ms=2000
        // Whisper hears this as "(humming)" which the hallucination filter strips.
        let samples: Vec<f32> = (0..32000)
            .map(|i| {
                let t = i as f32 / 16000.0;
                0.3 * (440.0 * 2.0 * std::f32::consts::PI * t).sin()
                    + 0.2 * (880.0 * 2.0 * std::f32::consts::PI * t).sin()
            })
            .collect();

        let result = t.transcribe(&samples).expect("transcribe() should not error");
        eprintln!("Transcription result (should be empty after filter): {:?}", result);
        // After hallucination filtering, non-speech audio should produce empty text
        assert!(
            result.is_empty(),
            "Expected hallucination to be filtered, got: {result:?}"
        );
    }

    #[test]
    fn transcribe_silence_does_not_error() {
        let Some(model_path) = skip_if_no_model() else {
            eprintln!("SKIP: no whisper model found");
            return;
        };

        let mut t = WhisperTranscriber::new(&model_path).expect("Failed to load model");
        let silence = vec![0.0f32; 32000]; // 2s silence

        let result = t.transcribe(&silence).expect("transcribe() should not error");
        eprintln!("Silence transcription result: {:?}", result);
    }
}
