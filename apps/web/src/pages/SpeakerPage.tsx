/**
 * Speaker display — shows sermon note slides on the preacher's monitor.
 *
 * Route: /speaker
 *
 * Connects to the same WebSocket as the main display but only renders
 * `sermon_note` and `sermon_note_advance` events. This page is opened
 * on a secondary monitor or the preacher's laptop.
 *
 * Navigation: prev/next buttons + keyboard shortcuts (ArrowLeft/ArrowRight/Space).
 * The speaker can advance or rewind slides locally via Tauri commands, which
 * also push the updated slide to the main display.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "../lib/tauri";
import { toastError } from "../lib/toast";

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

  const handleNext = useCallback(() => {
    invoke("advance_sermon_note").catch(toastError("Failed to advance slide"));
  }, []);

  const handlePrev = useCallback(() => {
    invoke("rewind_sermon_note").catch(toastError("Failed to go to previous slide"));
  }, []);

  // Keyboard shortcuts: ArrowRight / Space → next, ArrowLeft → prev.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!slide) return;
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [slide, handleNext, handlePrev]);

  const isFirst = slide ? slide.slideIndex === 0 : true;
  const isLast = slide ? slide.slideIndex + 1 >= slide.totalSlides : true;

  return (
    <div className="fixed inset-0 bg-bg font-sans flex flex-col text-ink">
      <header className="flex items-center justify-between px-6 py-3 bg-bg-1 border-b border-line shrink-0">
        <span className="text-[0.7rem] font-semibold tracking-[0.2em] text-ink-3 uppercase">
          SPEAKER NOTES
        </span>
        <span
          className={`text-[0.65rem] font-semibold tracking-[0.18em] uppercase ${
            connected ? "text-accent" : "text-muted"
          }`}
        >
          {connected ? "LIVE" : "CONNECTING…"}
        </span>
      </header>

      {slide ? (
        <main className="flex-1 flex flex-col px-8 pt-8 pb-6 gap-4 overflow-hidden">
          <div className="flex items-baseline gap-4">
            <span className="text-[1rem] font-semibold tracking-[0.1em] text-accent [font-variant:small-caps]">
              {slide.title}
            </span>
            <span className="font-mono text-[0.8rem] text-ink-3">
              {slide.slideIndex + 1} / {slide.totalSlides}
            </span>
          </div>
          <div className="flex-1 text-[clamp(2rem,4vw,4.5rem)] font-normal leading-[1.4] text-ink whitespace-pre-wrap overflow-auto">
            {slide.text}
          </div>
          <div className="flex items-center justify-between shrink-0">
            <button
              onClick={handlePrev}
              disabled={isFirst}
              aria-label="Previous slide"
              title="Previous slide (←)"
              className="font-sans text-[0.75rem] font-medium tracking-[0.1em] text-ink bg-transparent border border-line rounded-sm px-5 py-2 cursor-pointer transition-all uppercase hover:border-line-strong disabled:opacity-30 disabled:cursor-default"
            >
              ← PREV
            </button>
            <span className="text-[0.7rem] tracking-[0.08em] text-muted">
              ← → or Space to navigate
            </span>
            <button
              onClick={handleNext}
              disabled={isLast}
              aria-label="Next slide"
              title="Next slide (→ or Space)"
              className="font-sans text-[0.75rem] font-medium tracking-[0.1em] text-ink bg-transparent border border-line rounded-sm px-5 py-2 cursor-pointer transition-all uppercase hover:border-line-strong disabled:opacity-30 disabled:cursor-default"
            >
              NEXT →
            </button>
          </div>
        </main>
      ) : (
        <main className="flex-1 flex flex-col items-center justify-center gap-3 text-ink-3 text-[1.1rem]">
          <p>Waiting for sermon notes…</p>
          <p className="text-[0.85rem] text-muted">
            The operator will push notes when the message begins.
          </p>
        </main>
      )}
    </div>
  );
}
