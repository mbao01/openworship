//! Deepgram online STT backend — streams 16 kHz PCM audio over WebSocket and
//! receives transcripts asynchronously.
//!
//! Only compiled when the `deepgram` feature is enabled.

#![cfg(feature = "deepgram")]

use crate::transcribe::Transcriber;
use anyhow::Result;
use futures_util::{SinkExt, StreamExt};
use std::sync::{Arc, Mutex};
use tokio_tungstenite::{
    connect_async,
    tungstenite::{client::IntoClientRequest, Message},
};

const DEEPGRAM_URL: &str =
    "wss://api.deepgram.com/v1/listen\
     ?encoding=linear16\
     &sample_rate=16000\
     &channels=1\
     &language=en\
     &model=nova-2\
     &interim_results=true\
     &punctuate=true";

/// Streams microphone audio to the Deepgram WebSocket API and collects
/// transcripts into a shared buffer.
///
/// The struct implements [`Transcriber`]: each call to [`transcribe`] sends the
/// current audio chunk to Deepgram and drains any transcript that has arrived
/// since the previous call. This keeps the caller's synchronous worker loop
/// unchanged while achieving real-time streaming latency.
///
/// A dedicated single-threaded Tokio runtime lives inside the struct so that
/// the networking tasks are independent of Tauri's runtime.
pub struct DeepgramTranscriber {
    audio_tx: tokio::sync::mpsc::Sender<Vec<f32>>,
    transcript_buf: Arc<Mutex<String>>,
    /// Keeps the runtime alive for the lifetime of the transcriber.
    _rt: tokio::runtime::Runtime,
}

impl DeepgramTranscriber {
    /// Create a new transcriber and immediately start the background WebSocket
    /// session for the given API key.
    pub fn new(api_key: &str) -> Result<Self> {
        let rt = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_all()
            .build()?;

        let (audio_tx, audio_rx) = tokio::sync::mpsc::channel::<Vec<f32>>(32);
        let transcript_buf: Arc<Mutex<String>> = Arc::new(Mutex::new(String::new()));
        let buf_clone = transcript_buf.clone();
        let api_key = api_key.to_owned();

        rt.spawn(async move {
            if let Err(e) = run_session(api_key, audio_rx, buf_clone).await {
                eprintln!("[ow-audio/deepgram] session error: {e}");
            }
        });

        Ok(Self { audio_tx, transcript_buf, _rt: rt })
    }
}

impl Transcriber for DeepgramTranscriber {
    /// Send `samples` to Deepgram and return any transcript that has arrived
    /// since the last call.  Returns `Ok("")` when nothing has arrived yet —
    /// the engine will silently skip empty strings.
    fn transcribe(&mut self, samples: &[f32]) -> Result<String> {
        // try_send is sync and non-blocking; drop the chunk if the channel is full.
        let _ = self.audio_tx.try_send(samples.to_vec());

        let mut buf = self.transcript_buf.lock().unwrap_or_else(|e| e.into_inner());
        if buf.is_empty() {
            Ok(String::new())
        } else {
            Ok(std::mem::take(&mut *buf))
        }
    }
}

// ─── Background async session ─────────────────────────────────────────────────

async fn run_session(
    api_key: String,
    mut audio_rx: tokio::sync::mpsc::Receiver<Vec<f32>>,
    transcript_buf: Arc<Mutex<String>>,
) -> Result<()> {
    let mut request = DEEPGRAM_URL.into_client_request()?;
    request.headers_mut().insert(
        "Authorization",
        format!("Token {api_key}").parse()?,
    );

    let (ws_stream, _) = connect_async(request).await?;
    let (mut write, mut read) = ws_stream.split();

    // Reader: parse Deepgram JSON responses and append to the shared buffer.
    let buf_clone = transcript_buf.clone();
    tokio::spawn(async move {
        while let Some(msg) = read.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    if let Some(t) = parse_transcript(&text) {
                        if !t.is_empty() {
                            let mut buf = buf_clone.lock().unwrap_or_else(|e| e.into_inner());
                            if !buf.is_empty() {
                                buf.push(' ');
                            }
                            buf.push_str(&t);
                        }
                    }
                }
                Ok(Message::Close(_)) | Err(_) => break,
                _ => {}
            }
        }
    });

    // Writer: receive f32 audio chunks and forward as 16-bit PCM binary frames.
    while let Some(samples) = audio_rx.recv().await {
        let bytes = f32_to_i16_le(samples.as_slice());
        if write.send(Message::Binary(bytes.into())).await.is_err() {
            break;
        }
    }

    // Send a CloseStream message so Deepgram finalises any in-progress utterance.
    let _ = write.send(Message::Text(r#"{"type":"CloseStream"}"#.into())).await;

    Ok(())
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/// Extract transcript text from a Deepgram `Results` JSON message.
fn parse_transcript(json: &str) -> Option<String> {
    let v: serde_json::Value = serde_json::from_str(json).ok()?;
    if v["type"].as_str()? != "Results" {
        return None;
    }
    let transcript = v["channel"]["alternatives"][0]["transcript"].as_str()?;
    Some(transcript.trim().to_owned())
}

/// Convert mono f32 samples (−1.0 … 1.0) to 16-bit signed PCM, little-endian.
fn f32_to_i16_le(samples: &[f32]) -> Vec<u8> {
    let mut out = Vec::with_capacity(samples.len() * 2);
    for &s in samples {
        let pcm = (s.clamp(-1.0, 1.0) * i16::MAX as f32) as i16;
        out.extend_from_slice(&pcm.to_le_bytes());
    }
    out
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_valid_results_message() {
        let json = r#"{
            "type": "Results",
            "channel": {
                "alternatives": [{"transcript": "hello world", "confidence": 0.99}]
            },
            "is_final": true
        }"#;
        assert_eq!(parse_transcript(json).as_deref(), Some("hello world"));
    }

    #[test]
    fn parse_ignores_non_results_type() {
        let json = r#"{"type":"Metadata","request_id":"abc"}"#;
        assert!(parse_transcript(json).is_none());
    }

    #[test]
    fn parse_empty_transcript() {
        let json = r#"{
            "type": "Results",
            "channel": {"alternatives": [{"transcript": "  ", "confidence": 0.0}]},
            "is_final": false
        }"#;
        // Trimmed empty string → caller should skip it.
        assert_eq!(parse_transcript(json).as_deref(), Some(""));
    }

    #[test]
    fn f32_to_i16_le_silence() {
        let bytes = f32_to_i16_le(&[0.0_f32; 4]);
        assert_eq!(bytes, vec![0u8; 8]);
    }

    #[test]
    fn f32_to_i16_le_positive_full_scale() {
        let bytes = f32_to_i16_le(&[1.0_f32]);
        let val = i16::from_le_bytes([bytes[0], bytes[1]]);
        assert_eq!(val, i16::MAX);
    }

    #[test]
    fn f32_to_i16_le_clamps_out_of_range() {
        let bytes = f32_to_i16_le(&[2.0_f32, -2.0_f32]);
        let pos = i16::from_le_bytes([bytes[0], bytes[1]]);
        let neg = i16::from_le_bytes([bytes[2], bytes[3]]);
        assert_eq!(pos, i16::MAX);
        // −2.0 clamped to −1.0 → i16::MIN+1 (cast from -1.0 * 32767.0)
        assert!(neg < 0);
    }
}
