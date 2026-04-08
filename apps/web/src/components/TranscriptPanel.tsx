import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { TranscriptEvent } from "../lib/types";

interface TranscriptEntry {
  id: number;
  text: string;
  offset_ms: number;
}

interface Props {
  /** Rolling context window in seconds. Entries older than this are removed. Default 10. */
  contextWindowSeconds?: number;
}

export function TranscriptPanel({ contextWindowSeconds = 10 }: Props) {
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [micActive, setMicActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sttWarning, setSttWarning] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  // Auto-scroll to bottom whenever entries change.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  // Subscribe to transcript events from the Tauri backend.
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    listen<TranscriptEvent>("stt://transcript", (event) => {
      const evt = event.payload;
      setMicActive(evt.mic_active);
      setEntries((prev) => {
        const newEntry: TranscriptEntry = {
          id: ++idRef.current,
          text: evt.text,
          offset_ms: evt.offset_ms,
        };
        const windowMs = contextWindowSeconds * 1000;
        const cutoff = evt.offset_ms - windowMs;
        return [...prev.filter((e) => e.offset_ms >= cutoff), newEntry];
      });
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [contextWindowSeconds]);

  // Listen for backend fallback errors (e.g. Deepgram → offline).
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    listen<string>("stt://error", (event) => {
      setSttWarning(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  function handleToggle() {
    if (micActive) {
      invoke("stop_stt").catch(console.error);
      setMicActive(false);
      setSttWarning(null);
    } else {
      setError(null);
      setSttWarning(null);
      invoke("start_stt").catch((err: unknown) => {
        setError(String(err));
      });
    }
  }

  return (
    <div className="transcript-panel">
      <div className="transcript-header">
        <div className="transcript-label">
          {micActive && <span className="transcript-pulse" aria-hidden="true" />}
          <span className="transcript-title">TRANSCRIPT</span>
        </div>
        <button
          className={`transcript-toggle ${micActive ? "transcript-toggle--active" : ""}`}
          onClick={handleToggle}
          aria-label={micActive ? "Stop microphone" : "Start microphone"}
        >
          {micActive ? "STOP MIC" : "START MIC"}
        </button>
      </div>

      {sttWarning && (
        <div className="transcript-stt-warning" role="alert">
          <span>{sttWarning}</span>
          <button
            className="transcript-stt-warning__dismiss"
            onClick={() => setSttWarning(null)}
            aria-label="Dismiss warning"
          >
            ✕
          </button>
        </div>
      )}

      <div className="transcript-body" role="log" aria-live="polite" aria-label="Live transcript">
        {entries.length === 0 && !error && (
          <p className="transcript-empty">
            {micActive ? "Listening…" : "Press START MIC to begin transcription."}
          </p>
        )}
        {error && <p className="transcript-error">{error}</p>}
        {entries.map((entry) => (
          <p key={entry.id} className="transcript-line">
            {entry.text}
          </p>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
