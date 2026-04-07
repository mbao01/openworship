// Local WebSocket display server — OBS-compatible fullscreen projection.
// Pushes content events to the browser display page on port 9000.

use futures_util::{SinkExt, StreamExt};
use serde::Serialize;
use std::net::SocketAddr;
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::{accept_async, tungstenite::Message};

pub const WS_PORT: u16 = 9000;

#[derive(Serialize, Clone)]
pub struct ContentEvent {
    pub kind: String,
    pub reference: String,
    pub text: String,
}

pub fn hardcoded_verse() -> ContentEvent {
    ContentEvent {
        kind: "scripture".into(),
        reference: "John 3:16".into(),
        text: "For God so loved the world that he gave his one and only Son, \
               that whoever believes in him shall not perish but have eternal life."
            .into(),
    }
}

/// Start the WebSocket display server. Runs indefinitely; spawn as a background task.
pub async fn start_server() {
    let addr = SocketAddr::from(([127, 0, 0, 1], WS_PORT));
    let listener = TcpListener::bind(addr)
        .await
        .expect("Failed to bind display WebSocket port 9000");

    while let Ok((stream, _)) = listener.accept().await {
        tokio::spawn(handle_client(stream));
    }
}

async fn handle_client(stream: TcpStream) {
    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(_) => return,
    };

    let (mut sender, mut receiver) = ws_stream.split();

    // Send the hardcoded verse immediately on connection.
    let verse = hardcoded_verse();
    if let Ok(msg) = serde_json::to_string(&verse) {
        let _ = sender.send(Message::Text(msg.into())).await;
    }

    // Drain incoming messages to keep the connection alive.
    while let Some(Ok(_)) = receiver.next().await {}
}
