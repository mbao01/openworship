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
    <div className="fixed inset-0 bg-void font-sans flex flex-col text-chalk">
      <header className="flex items-center justify-between px-6 py-3 bg-obsidian border-b border-iron shrink-0">
        <span className="text-[0.7rem] font-semibold tracking-[0.2em] text-ash uppercase">
          SPEAKER NOTES
        </span>
        <span
          className={`text-[0.65rem] font-semibold tracking-[0.18em] uppercase ${
            connected ? "text-gold" : "text-smoke"
          }`}
        >
          {connected ? "LIVE" : "CONNECTING…"}
        </span>
      </header>

      {slide ? (
        <main className="flex-1 flex flex-col px-8 pt-8 pb-6 gap-4 overflow-hidden">
          <div className="flex items-baseline gap-4">
            <span className="text-[1rem] font-semibold tracking-[0.1em] text-gold [font-variant:small-caps]">
              {slide.title}
            </span>
            <span className="font-mono text-[0.8rem] text-ash">
              {slide.slideIndex + 1} / {slide.totalSlides}
            </span>
          </div>
          <div className="flex-1 text-[clamp(2rem,4vw,4.5rem)] font-normal leading-[1.4] text-chalk whitespace-pre-wrap overflow-auto">
            {slide.text}
          </div>
          {slide.slideIndex + 1 < slide.totalSlides && (
            <div className="text-[0.75rem] font-normal tracking-[0.1em] text-smoke text-right">
              Press ▶ on the operator panel to advance
            </div>
          )}
        </main>
      ) : (
        <main className="flex-1 flex flex-col items-center justify-center gap-3 text-ash text-[1.1rem]">
          <p>Waiting for sermon notes…</p>
          <p className="text-[0.85rem] text-smoke">
            The operator will push notes when the message begins.
          </p>
        </main>
      )}
    </div>
  );
}
