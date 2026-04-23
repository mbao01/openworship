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
              prev ? { ...prev, slideIndex: ev.slide_index } : prev,
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
    invoke("rewind_sermon_note").catch(
      toastError("Failed to go to previous slide"),
    );
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
    <div className="fixed inset-0 flex flex-col bg-bg font-sans text-ink">
      <header className="flex shrink-0 items-center justify-between border-b border-line bg-bg-1 px-6 py-3">
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
        <main className="flex flex-1 flex-col gap-4 overflow-hidden px-8 pt-8 pb-6">
          <div className="flex items-baseline gap-4">
            <span className="text-[1rem] font-semibold tracking-[0.1em] text-accent [font-variant:small-caps]">
              {slide.title}
            </span>
            <span className="font-mono text-[0.8rem] text-ink-3">
              {slide.slideIndex + 1} / {slide.totalSlides}
            </span>
          </div>
          <div className="flex-1 overflow-auto text-[clamp(2rem,4vw,4.5rem)] leading-[1.4] font-normal whitespace-pre-wrap text-ink">
            {slide.text}
          </div>
          <div className="flex shrink-0 items-center justify-between">
            <button
              onClick={handlePrev}
              disabled={isFirst}
              aria-label="Previous slide"
              title="Previous slide (←)"
              className="cursor-pointer rounded-sm border border-line bg-transparent px-5 py-2 font-sans text-[0.75rem] font-medium tracking-[0.1em] text-ink uppercase transition-all hover:border-line-strong disabled:cursor-default disabled:opacity-30"
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
              className="cursor-pointer rounded-sm border border-line bg-transparent px-5 py-2 font-sans text-[0.75rem] font-medium tracking-[0.1em] text-ink uppercase transition-all hover:border-line-strong disabled:cursor-default disabled:opacity-30"
            >
              NEXT →
            </button>
          </div>
        </main>
      ) : (
        <main className="flex flex-1 flex-col items-center justify-center gap-3 text-[1.1rem] text-ink-3">
          <p>Waiting for sermon notes…</p>
          <p className="text-[0.85rem] text-muted">
            The operator will push notes when the message begins.
          </p>
        </main>
      )}
    </div>
  );
}
