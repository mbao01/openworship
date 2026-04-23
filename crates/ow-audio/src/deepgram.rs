//! Deepgram online STT backend — streams 16 kHz PCM audio over WebSocket and
//! receives transcripts asynchronously, with automatic reconnection.
//!
//! Only compiled when the `deepgram` feature is enabled.

#![cfg(feature = "deepgram")]

use crate::event::DeepgramConnectionEvent;
use crate::transcribe::Transcriber;
use anyhow::Result;
use futures_util::{SinkExt, StreamExt};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::{mpsc, oneshot};
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

/// Exponential backoff parameters for reconnection.
const INITIAL_BACKOFF_SECS: u64 = 1;
const MAX_BACKOFF_SECS: u64 = 30;

/// What caused a single WebSocket session to end.
enum SessionOutcome {
    /// The audio channel was closed — clean shutdown requested.
    AudioClosed,
    /// The WebSocket disconnected unexpectedly — should reconnect.
    WsDisconnected,
}

/// Streams microphone audio to the Deepgram WebSocket API and collects
/// transcripts into a shared buffer.
///
/// The struct implements [`Transcriber`]: each call to [`transcribe`] sends the
/// current audio chunk to Deepgram and drains any transcript that has arrived
/// since the previous call.
///
/// A dedicated Tokio runtime lives inside the struct so that the networking
/// tasks are independent of Tauri's runtime. The background task automatically
/// reconnects with exponential backoff when the WebSocket drops.
pub struct DeepgramTranscriber {
    audio_tx: mpsc::Sender<Vec<f32>>,
    transcript_buf: Arc<Mutex<String>>,
    /// Keeps the runtime alive for the lifetime of the transcriber.
    _rt: tokio::runtime::Runtime,
}

impl DeepgramTranscriber {
    /// Create a new transcriber without connection event reporting.
    pub fn new(api_key: &str) -> Result<Self> {
        Self::new_with_events(api_key, None)
    }

    /// Create a new transcriber. Connection state changes are sent on
    /// `connection_tx` so callers can forward them as Tauri events.
    ///
    /// Use `"stt://deepgram-connection"` as the event name on the Tauri side.
    pub fn new_with_events(
        api_key: &str,
        connection_tx: Option<mpsc::Sender<DeepgramConnectionEvent>>,
    ) -> Result<Self> {
        let rt = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_all()
            .build()?;

        let (audio_tx, audio_rx) = mpsc::channel::<Vec<f32>>(32);
        let transcript_buf: Arc<Mutex<String>> = Arc::new(Mutex::new(String::new()));
        let buf_clone = transcript_buf.clone();
        let api_key = api_key.to_owned();

        rt.spawn(async move {
            run_reconnect_loop(api_key, audio_rx, buf_clone, connection_tx).await;
        });

        Ok(Self { audio_tx, transcript_buf, _rt: rt })
    }
}

impl Transcriber for DeepgramTranscriber {
    /// Send `samples` to Deepgram and return any transcript that has arrived
    /// since the last call.  Returns `Ok("")` when nothing has arrived yet —
    /// the engine will silently skip empty strings.
    fn transcribe(&mut self, samples: &[f32]) -> Result<String> {
        // try_send is sync and non-blocking; drops the chunk if the channel is full.
        let _ = self.audio_tx.try_send(samples.to_vec());

        let mut buf = self.transcript_buf.lock().unwrap_or_else(|e| e.into_inner());
        if buf.is_empty() {
            Ok(String::new())
        } else {
            Ok(std::mem::take(&mut *buf))
        }
    }
}

// ─── Reconnection loop ────────────────────────────────────────────────────────

/// Top-level background task: runs WebSocket sessions with exponential backoff
/// reconnection on unexpected disconnects.
async fn run_reconnect_loop(
    api_key: String,
    mut audio_rx: mpsc::Receiver<Vec<f32>>,
    transcript_buf: Arc<Mutex<String>>,
    connection_tx: Option<mpsc::Sender<DeepgramConnectionEvent>>,
) {
    let mut backoff_secs = INITIAL_BACKOFF_SECS;
    let mut attempt: u32 = 0;

    loop {
        let result = run_one_session(
            &api_key,
            &mut audio_rx,
            &transcript_buf,
            &connection_tx,
            attempt > 0,
        )
        .await;

        match result {
            Ok(SessionOutcome::AudioClosed) => break,
            Ok(SessionOutcome::WsDisconnected) => {
                attempt += 1;
                eprintln!(
                    "[deepgram] WebSocket disconnected — reconnecting in {backoff_secs}s \
                     (attempt {attempt})"
                );
            }
            Err(e) => {
                attempt += 1;
                eprintln!(
                    "[deepgram] connection error: {e} — retrying in {backoff_secs}s \
                     (attempt {attempt})"
                );
            }
        }

        // Notify the frontend that reconnection is in progress.
        if let Some(ref tx) = connection_tx {
            let _ = tx.try_send(DeepgramConnectionEvent::Reconnecting {
                attempt,
                delay_secs: backoff_secs,
            });
        }

        // Drain stale audio that accumulated while the connection was down so
        // Deepgram gets fresh audio on reconnect rather than a burst of old frames.
        while audio_rx.try_recv().is_ok() {}

        tokio::time::sleep(Duration::from_secs(backoff_secs)).await;

        // Exit cleanly if the audio channel was closed while we were sleeping.
        if audio_rx.is_closed() {
            break;
        }

        // Double the backoff for next time, capped at MAX_BACKOFF_SECS.
        backoff_secs = (backoff_secs * 2).min(MAX_BACKOFF_SECS);
    }
}

/// Run a single WebSocket session until it ends (cleanly or by error/disconnect).
///
/// - Returns `Ok(AudioClosed)` when `audio_rx` is closed (clean shutdown).
/// - Returns `Ok(WsDisconnected)` when the WebSocket drops unexpectedly.
/// - Returns `Err(…)` when the initial connection attempt fails.
///
/// `is_reconnect` controls whether a successful connect emits `Restored`.
async fn run_one_session(
    api_key: &str,
    audio_rx: &mut mpsc::Receiver<Vec<f32>>,
    transcript_buf: &Arc<Mutex<String>>,
    connection_tx: &Option<mpsc::Sender<DeepgramConnectionEvent>>,
    is_reconnect: bool,
) -> Result<SessionOutcome> {
    let mut request = DEEPGRAM_URL.into_client_request()?;
    request
        .headers_mut()
        .insert("Authorization", format!("Token {api_key}").parse()?);

    let (ws_stream, _) = connect_async(request).await?;

    // Successfully (re)connected — notify frontend.
    if is_reconnect {
        eprintln!("[deepgram] reconnected successfully");
        if let Some(ref tx) = connection_tx {
            let _ = tx.try_send(DeepgramConnectionEvent::Restored);
        }
    }

    let (mut write, mut read) = ws_stream.split();

    // Reader task: parse Deepgram JSON responses and detect WebSocket close.
    let buf_clone = transcript_buf.clone();
    let (ws_closed_tx, ws_closed_rx) = oneshot::channel::<()>();

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
                Ok(Message::Close(_)) | Err(_) => {
                    let _ = ws_closed_tx.send(());
                    break;
                }
                _ => {}
            }
        }
        // ws_closed_tx is dropped here if the stream ended without a Close frame,
        // which also signals ws_closed_rx in the writer below.
    });

    // Writer loop: forward audio chunks and react to reader-detected closes.
    let mut ws_closed_rx = ws_closed_rx;
    loop {
        tokio::select! {
            recv = audio_rx.recv() => {
                match recv {
                    Some(samples) => {
                        let bytes = f32_to_i16_le(samples.as_slice());
                        if write.send(Message::Binary(bytes.into())).await.is_err() {
                            return Ok(SessionOutcome::WsDisconnected);
                        }
                    }
                    None => {
                        // Audio channel closed — send CloseStream and exit cleanly.
                        let _ = write
                            .send(Message::Text(r#"{"type":"CloseStream"}"#.into()))
                            .await;
                        return Ok(SessionOutcome::AudioClosed);
                    }
                }
            }
            _ = &mut ws_closed_rx => {
                // Reader task detected WebSocket close/error.
                return Ok(SessionOutcome::WsDisconnected);
            }
        }
    }
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

    #[test]
    fn backoff_doubles_and_caps() {
        let mut b = INITIAL_BACKOFF_SECS;
        for _ in 0..10 {
            b = (b * 2).min(MAX_BACKOFF_SECS);
        }
        assert_eq!(b, MAX_BACKOFF_SECS);
    }

    #[test]
    fn connection_event_reconnecting_serializes() {
        let evt = DeepgramConnectionEvent::Reconnecting { attempt: 3, delay_secs: 8 };
        let json = serde_json::to_string(&evt).unwrap();
        assert!(json.contains("\"status\":\"reconnecting\""), "got: {json}");
        assert!(json.contains("\"attempt\":3"), "got: {json}");
        assert!(json.contains("\"delay_secs\":8"), "got: {json}");
    }

    #[test]
    fn connection_event_restored_serializes() {
        let evt = DeepgramConnectionEvent::Restored;
        let json = serde_json::to_string(&evt).unwrap();
        assert!(json.contains("\"status\":\"restored\""), "got: {json}");
    }
}
