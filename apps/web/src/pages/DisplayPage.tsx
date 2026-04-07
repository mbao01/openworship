import { useEffect, useState } from "react";
import "../styles/display.css";

interface ContentEvent {
  kind: string;
  reference: string;
  text: string;
}

const WS_URL = "ws://127.0.0.1:9000";
const RECONNECT_DELAY_MS = 2000;

export function DisplayPage() {
  const [content, setContent] = useState<ContentEvent | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let destroyed = false;

    function connect() {
      if (destroyed) return;
      ws = new WebSocket(WS_URL);

      ws.onopen = () => setConnected(true);

      ws.onmessage = (evt) => {
        try {
          const event = JSON.parse(evt.data as string) as ContentEvent;
          setContent(event);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!destroyed) {
          setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };

      ws.onerror = () => ws?.close();
    }

    connect();
    return () => {
      destroyed = true;
      ws?.close();
    };
  }, []);

  return (
    <div className="display-root">
      {content ? (
        <div className="display-content">
          <span className="display-reference">{content.reference}</span>
          <p className="display-verse">{content.text}</p>
        </div>
      ) : (
        <div className="display-idle" aria-hidden={connected} />
      )}
      <span className="display-watermark">openworship</span>
    </div>
  );
}
