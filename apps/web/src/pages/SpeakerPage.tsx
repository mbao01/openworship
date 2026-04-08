/**
 * Speaker display — shows sermon note slides on the preacher's monitor.
 *
 * Route: /speaker
 *
 * Connects to the same WebSocket as the main display but only renders
 * `sermon_note` and `sermon_note_advance` events. This page is opened
 * on a secondary monitor or the preacher's laptop.
 *
 * The operator controls which slide is shown via the Operator Page.
 */
import { useEffect, useRef, useState } from "react";
import "../styles/speaker.css";

const WS_URL = "ws://127.0.0.1:9000";
const RECONNECT_DELAY_MS = 2000;

interface SermonNoteEvent {
  kind: "sermon_note" | "sermon_note_advance";
  reference: string; // note title
  text: string; // slide text (empty for advance events)
  slide_index: number;
  total_slides?: number;
}

interface SlideState {
  title: string;
  text: string;
  slideIndex: number;
  totalSlides: number;
}

export function SpeakerPage() {
  const [slide, setSlide] = useState<SlideState | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onmessage = (msg) => {
        try {
          const ev = JSON.parse(msg.data as string) as SermonNoteEvent & {
            kind: string;
          };
          if (ev.kind === "sermon_note") {
            setSlide({
              title: ev.reference,
              text: ev.text,
              slideIndex: ev.slide_index,
              totalSlides: ev.total_slides ?? 1,
            });
          } else if (ev.kind === "sermon_note_advance") {
            // Advance updates the index but we wait for the next full
            // sermon_note event which carries the new text.
            setSlide((prev) =>
              prev ? { ...prev, slideIndex: ev.slide_index } : prev
            );
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
      };

      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, []);

  return (
    <div className="speaker-page">
      <header className="speaker-header">
        <span className="speaker-header__label">SPEAKER NOTES</span>
        <span
          className={`speaker-header__status ${connected ? "speaker-header__status--connected" : ""}`}
        >
          {connected ? "LIVE" : "CONNECTING…"}
        </span>
      </header>

      {slide ? (
        <main className="speaker-slide">
          <div className="speaker-slide__meta">
            <span className="speaker-slide__title">{slide.title}</span>
            <span className="speaker-slide__counter">
              {slide.slideIndex + 1} / {slide.totalSlides}
            </span>
          </div>
          <div className="speaker-slide__text">{slide.text}</div>
          {slide.slideIndex + 1 < slide.totalSlides && (
            <div className="speaker-slide__next-hint">
              Press ▶ on the operator panel to advance
            </div>
          )}
        </main>
      ) : (
        <main className="speaker-empty">
          <p>Waiting for sermon notes…</p>
          <p className="speaker-empty__sub">
            The operator will push notes when the message begins.
          </p>
        </main>
      )}
    </div>
  );
}
