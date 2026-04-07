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
