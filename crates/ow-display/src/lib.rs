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
        }
    }

    /// Send a full song to the display (all lyrics, artist attribution).
    ///
    /// `reference` = song title, `text` = newline-separated lyrics,
    /// `translation` = artist name.
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
        }
    }
}

/// Start the WebSocket display server.
/// Pass a `broadcast::Sender<ContentEvent>` — each accepted client subscribes
/// to it and receives events pushed from the desktop app.
pub async fn start_server(tx: broadcast::Sender<ContentEvent>) {
    let addr = SocketAddr::from(([127, 0, 0, 1], WS_PORT));
    let listener = TcpListener::bind(addr)
        .await
        .expect("Failed to bind display WebSocket port 9000");

    while let Ok((stream, _)) = listener.accept().await {
        let rx = tx.subscribe();
        tokio::spawn(handle_client(stream, rx));
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
