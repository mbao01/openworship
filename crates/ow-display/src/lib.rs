// Local WebSocket display server — OBS-compatible fullscreen projection.
// Accepts a broadcast::Sender<ContentEvent> so the desktop app can push
// verse content to all connected display clients on port 9000.

use futures_util::{SinkExt, StreamExt};
use serde::Serialize;
use std::net::SocketAddr;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::broadcast;
use tokio_tungstenite::{accept_async, tungstenite::Message};

pub const WS_PORT: u16 = 9000;

#[derive(Serialize, Clone, Debug)]
pub struct ContentEvent {
    pub kind: String,
    pub reference: String,
    pub text: String,
    pub translation: String,
    /// For `kind = "song_advance"`: the lyric chunk index to display next.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line_index: Option<u32>,
    /// For `kind = "announcement"` or `"custom_slide"`: optional image URL.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
    /// For `kind = "countdown"`: total duration in seconds.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_secs: Option<u32>,
    /// For `kind = "sermon_note"` or `"sermon_note_advance"`: slide index.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slide_index: Option<u32>,
    /// For `kind = "sermon_note"`: total slide count.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_slides: Option<u32>,
    /// For `kind = "set_background"`: artifact ID or preset ID for the background.
    /// `None` or empty clears the background.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub background_url: Option<String>,
    /// For `kind = "set_background"`: media type hint ("video", "image", or "gradient").
    #[serde(skip_serializing_if = "Option::is_none")]
    pub background_type: Option<String>,
}

impl ContentEvent {
    pub fn scripture(
        reference: impl Into<String>,
        text: impl Into<String>,
        translation: impl Into<String>,
    ) -> Self {
        Self {
            kind: "scripture".into(),
            reference: reference.into(),
            text: text.into(),
            translation: translation.into(),
            line_index: None,
            image_url: None,
            duration_secs: None,
            slide_index: None,
            total_slides: None,
            background_url: None,
            background_type: None,
        }
    }

    /// Send a full song to the display (all lyrics, artist attribution).
    pub fn song(
        title: impl Into<String>,
        lyrics: impl Into<String>,
        artist: impl Into<String>,
    ) -> Self {
        Self {
            kind: "song".into(),
            reference: title.into(),
            text: lyrics.into(),
            translation: artist.into(),
            line_index: Some(0),
            image_url: None,
            duration_secs: None,
            slide_index: None,
            total_slides: None,
            background_url: None,
            background_type: None,
        }
    }

    /// Advance the currently-displayed song to lyric chunk `index`.
    pub fn song_advance(title: impl Into<String>, index: u32) -> Self {
        Self {
            kind: "song_advance".into(),
            reference: title.into(),
            text: String::new(),
            translation: String::new(),
            line_index: Some(index),
            image_url: None,
            duration_secs: None,
            slide_index: None,
            total_slides: None,
            background_url: None,
            background_type: None,
        }
    }

    /// Push an announcement to the main display.
    pub fn announcement(
        title: impl Into<String>,
        body: impl Into<String>,
        image_url: Option<String>,
    ) -> Self {
        Self {
            kind: "announcement".into(),
            reference: title.into(),
            text: body.into(),
            translation: String::new(),
            line_index: None,
            image_url,
            duration_secs: None,
            slide_index: None,
            total_slides: None,
            background_url: None,
            background_type: None,
        }
    }

    /// Push a custom slide to the main display.
    pub fn custom_slide(
        title: impl Into<String>,
        body: impl Into<String>,
        image_url: Option<String>,
    ) -> Self {
        Self {
            kind: "custom_slide".into(),
            reference: title.into(),
            text: body.into(),
            translation: String::new(),
            line_index: None,
            image_url,
            duration_secs: None,
            slide_index: None,
            total_slides: None,
            background_url: None,
            background_type: None,
        }
    }

    /// Start a countdown timer on the main display.
    pub fn countdown(title: impl Into<String>, duration_secs: u32) -> Self {
        Self {
            kind: "countdown".into(),
            reference: title.into(),
            text: String::new(),
            translation: String::new(),
            line_index: None,
            image_url: None,
            duration_secs: Some(duration_secs),
            slide_index: None,
            total_slides: None,
            background_url: None,
            background_type: None,
        }
    }

    /// Push a sermon note slide to the speaker display.
    pub fn sermon_note(
        title: impl Into<String>,
        text: impl Into<String>,
        slide_index: u32,
        total_slides: u32,
    ) -> Self {
        Self {
            kind: "sermon_note".into(),
            reference: title.into(),
            text: text.into(),
            translation: String::new(),
            line_index: None,
            image_url: None,
            duration_secs: None,
            slide_index: Some(slide_index),
            total_slides: Some(total_slides),
            background_url: None,
            background_type: None,
        }
    }

    /// Advance the speaker display to the next sermon note slide.
    pub fn sermon_note_advance(title: impl Into<String>, slide_index: u32) -> Self {
        Self {
            kind: "sermon_note_advance".into(),
            reference: title.into(),
            text: String::new(),
            translation: String::new(),
            line_index: None,
            image_url: None,
            duration_secs: None,
            slide_index: Some(slide_index),
            total_slides: None,
            background_url: None,
            background_type: None,
        }
    }

    /// Clear the display (send blank content to connected clients).
    pub fn clear() -> Self {
        Self {
            kind: "clear".into(),
            reference: String::new(),
            text: String::new(),
            translation: String::new(),
            line_index: None,
            image_url: None,
            duration_secs: None,
            slide_index: None,
            total_slides: None,
            background_url: None,
            background_type: None,
        }
    }

    /// Set the display background. `url` is an artifact ID (e.g. "artifact:abc123")
    /// or a preset ID (e.g. "preset:dark_gradient").
    pub fn set_background(url: impl Into<String>, bg_type: Option<&str>) -> Self {
        Self {
            kind: "set_background".into(),
            reference: String::new(),
            text: String::new(),
            translation: String::new(),
            line_index: None,
            image_url: None,
            duration_secs: None,
            slide_index: None,
            total_slides: None,
            background_url: Some(url.into()),
            background_type: bg_type.map(|s| s.to_string()),
        }
    }

    /// Clear the display background (return to solid black).
    pub fn clear_background() -> Self {
        Self {
            kind: "set_background".into(),
            reference: String::new(),
            text: String::new(),
            translation: String::new(),
            line_index: None,
            image_url: None,
            duration_secs: None,
            slide_index: None,
            total_slides: None,
            background_url: None,
            background_type: None,
        }
    }
}

/// Try to bind a TCP listener on `WS_PORT`, falling back to the next 9
/// consecutive ports. Returns the bound `std::net::TcpListener` and the
/// port it was bound on, or `None` if all ports are unavailable.
pub fn bind_listener() -> Option<(std::net::TcpListener, u16)> {
    (WS_PORT..WS_PORT + 10).find_map(|port| {
        let addr = SocketAddr::from(([127, 0, 0, 1], port));
        match std::net::TcpListener::bind(addr) {
            Ok(l) => {
                let _ = l.set_nonblocking(true); // required for tokio::net::TcpListener::from_std
                if port != WS_PORT {
                    eprintln!(
                        "[display] port {WS_PORT} in use — bound display server on port {port}"
                    );
                }
                // tokio::net::TcpListener::from_std requires the socket to be
                // in non-blocking mode; set it here so callers don't have to
                // remember (OPE-198 fix for the second startup panic).
                if let Err(e) = l.set_nonblocking(true) {
                    eprintln!("[display] set_nonblocking failed on port {port}: {e}");
                    return None;
                }
                Some((l, port))
            }
            Err(_) => None,
        }
    })
}

/// Run the WebSocket accept loop on an already-bound listener.
/// Pass a `broadcast::Sender<ContentEvent>` — each accepted client subscribes
/// to it and receives events pushed from the desktop app.
pub async fn run_server(std_listener: std::net::TcpListener, tx: broadcast::Sender<ContentEvent>) {
    let listener = match TcpListener::from_std(std_listener) {
        Ok(l) => l,
        Err(e) => {
            eprintln!("[display] failed to convert listener to async: {e}");
            return;
        }
    };

    while let Ok((stream, _)) = listener.accept().await {
        let rx = tx.subscribe();
        tokio::spawn(handle_client(stream, rx));
    }
}

/// Start the WebSocket display server.
/// Convenience wrapper: calls [`bind_listener`] then [`run_server`].
/// Tries `WS_PORT` first, then falls back to the next 9 consecutive ports.
/// If none are available, logs a warning and returns without panicking.
pub async fn start_server(tx: broadcast::Sender<ContentEvent>) {
    match bind_listener() {
        Some((listener, _port)) => run_server(listener, tx).await,
        None => {
            eprintln!(
                "[display] WARNING: could not bind display WebSocket server on any port \
                 {WS_PORT}–{}. Display output will be unavailable.",
                WS_PORT + 9
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scripture_event_has_correct_kind_and_fields() {
        let ev = ContentEvent::scripture("John 3:16", "For God so loved the world", "KJV");
        assert_eq!(ev.kind, "scripture");
        assert_eq!(ev.reference, "John 3:16");
        assert_eq!(ev.text, "For God so loved the world");
        assert_eq!(ev.translation, "KJV");
        assert!(ev.line_index.is_none());
        assert!(ev.image_url.is_none());
    }

    #[test]
    fn song_event_has_correct_kind_and_starts_at_line_0() {
        let ev = ContentEvent::song("Amazing Grace", "Amazing grace, how sweet", "John Newton");
        assert_eq!(ev.kind, "song");
        assert_eq!(ev.reference, "Amazing Grace");
        assert_eq!(ev.text, "Amazing grace, how sweet");
        assert_eq!(ev.translation, "John Newton");
        assert_eq!(ev.line_index, Some(0));
    }

    #[test]
    fn song_advance_event_has_correct_index() {
        let ev = ContentEvent::song_advance("Amazing Grace", 3);
        assert_eq!(ev.kind, "song_advance");
        assert_eq!(ev.reference, "Amazing Grace");
        assert_eq!(ev.line_index, Some(3));
        assert!(ev.text.is_empty());
    }

    #[test]
    fn announcement_event_has_correct_kind() {
        let ev = ContentEvent::announcement(
            "Sunday Service",
            "Welcome everyone!",
            Some("http://example.com/img.jpg".to_string()),
        );
        assert_eq!(ev.kind, "announcement");
        assert_eq!(ev.reference, "Sunday Service");
        assert_eq!(ev.text, "Welcome everyone!");
        assert_eq!(ev.image_url.as_deref(), Some("http://example.com/img.jpg"));
    }

    #[test]
    fn announcement_event_without_image() {
        let ev = ContentEvent::announcement("Notice", "No image here", None);
        assert_eq!(ev.kind, "announcement");
        assert!(ev.image_url.is_none());
    }

    #[test]
    fn custom_slide_event_has_correct_kind() {
        let ev = ContentEvent::custom_slide("My Slide", "Slide body text", None);
        assert_eq!(ev.kind, "custom_slide");
        assert_eq!(ev.reference, "My Slide");
        assert_eq!(ev.text, "Slide body text");
    }

    #[test]
    fn countdown_event_has_correct_duration() {
        let ev = ContentEvent::countdown("Pre-service", 300);
        assert_eq!(ev.kind, "countdown");
        assert_eq!(ev.reference, "Pre-service");
        assert_eq!(ev.duration_secs, Some(300));
        assert!(ev.text.is_empty());
    }

    #[test]
    fn sermon_note_event_has_slide_info() {
        let ev = ContentEvent::sermon_note("Grace and Truth", "Slide content", 1, 5);
        assert_eq!(ev.kind, "sermon_note");
        assert_eq!(ev.reference, "Grace and Truth");
        assert_eq!(ev.text, "Slide content");
        assert_eq!(ev.slide_index, Some(1));
        assert_eq!(ev.total_slides, Some(5));
    }

    #[test]
    fn sermon_note_advance_event_has_slide_index() {
        let ev = ContentEvent::sermon_note_advance("Grace and Truth", 2);
        assert_eq!(ev.kind, "sermon_note_advance");
        assert_eq!(ev.slide_index, Some(2));
        assert!(ev.total_slides.is_none());
    }

    #[test]
    fn clear_event_has_empty_fields() {
        let ev = ContentEvent::clear();
        assert_eq!(ev.kind, "clear");
        assert!(ev.reference.is_empty());
        assert!(ev.text.is_empty());
        assert!(ev.translation.is_empty());
        assert!(ev.line_index.is_none());
    }

    #[test]
    fn set_background_event_sets_url_and_type() {
        let ev = ContentEvent::set_background("preset:dark_gradient", Some("gradient"));
        assert_eq!(ev.kind, "set_background");
        assert_eq!(ev.background_url.as_deref(), Some("preset:dark_gradient"));
        assert_eq!(ev.background_type.as_deref(), Some("gradient"));
    }

    #[test]
    fn set_background_without_type() {
        let ev = ContentEvent::set_background("artifact:abc123", None);
        assert_eq!(ev.background_url.as_deref(), Some("artifact:abc123"));
        assert!(ev.background_type.is_none());
    }

    #[test]
    fn clear_background_has_none_url() {
        let ev = ContentEvent::clear_background();
        assert_eq!(ev.kind, "set_background");
        assert!(ev.background_url.is_none());
        assert!(ev.background_type.is_none());
    }

    #[test]
    fn content_event_is_cloneable() {
        let ev = ContentEvent::scripture("John 1:1", "In the beginning was the Word", "ESV");
        let cloned = ev.clone();
        assert_eq!(ev.kind, cloned.kind);
        assert_eq!(ev.reference, cloned.reference);
    }

    #[test]
    fn ws_port_constant_is_9000() {
        assert_eq!(WS_PORT, 9000);
    }
}

async fn handle_client(stream: TcpStream, mut rx: broadcast::Receiver<ContentEvent>) {
    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(_) => return,
    };

    let (mut sender, mut receiver) = ws_stream.split();

    loop {
        tokio::select! {
            event = rx.recv() => {
                match event {
                    Ok(ev) => {
                        if let Ok(msg) = serde_json::to_string(&ev) {
                            if sender.send(Message::Text(msg.into())).await.is_err() {
                                break;
                            }
                        }
                    }
                    Err(broadcast::error::RecvError::Closed) => break,
                    Err(broadcast::error::RecvError::Lagged(_)) => continue,
                }
            },
            msg = receiver.next() => {
                match msg {
                    Some(Ok(_)) => {},
                    _ => break,
                }
            }
        }
    }
}
