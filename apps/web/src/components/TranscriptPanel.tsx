import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { TranscriptEvent } from "../lib/types";

// Multipliers for each bar to create a natural equalizer spread
const BAR_MULTIPLIERS = [0.65, 0.85, 1.0, 0.9, 0.7];

function AudioLevelBars({ level }: { level: number }) {
  // Boost visibility (same factor as SettingsModal VU meter)
  const boosted = Math.min(1, level * 3);
  const clipping = level > 0.8;
  return (
    <span className="flex items-end gap-[2px] h-3" aria-hidden="true">
      {BAR_MULTIPLIERS.map((m, i) => {
        const pct = Math.max(0.12, boosted * m);
        return (
          <span
            key={i}
            className={`w-[2px] rounded-sm transition-all duration-75 ${clipping ? "bg-ember" : "bg-gold"}`}
            style={{ height: `${Math.round(pct * 100)}%` }}
          />
        );
      })}
    </span>
  );
}

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
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sttWarning, setSttWarning] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  // Auto-scroll to bottom whenever entries change.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  // Poll audio level every 100ms whenever the mic is active.
  useEffect(() => {
    if (!micActive) return;
    const id = setInterval(async () => {
      const level = await invoke<number>("get_audio_level");
      setAudioLevel(level);
    }, 100);
    return () => clearInterval(id);
  }, [micActive]);

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
      setAudioLevel(0);
      setSttWarning(null);
    } else {
      setError(null);
      setSttWarning(null);
      setMicActive(true);
      invoke("start_stt").catch((err: unknown) => {
        setMicActive(false);
        setError(String(err));
      });
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-iron shrink-0">
        <div className="flex items-center gap-2">
          {micActive && (
            <span
              className="inline-block w-2 h-2 rounded-full bg-gold [box-shadow:0_0_0_4px_color-mix(in_srgb,var(--color-gold)_25%,transparent)] animate-[transcript-pulse_1.5s_ease-in-out_infinite] shrink-0"
              aria-hidden="true"
            />
          )}
          <span className="text-[11px] font-medium tracking-[0.12em] text-ash uppercase">
            TRANSCRIPT
          </span>
          <AudioLevelBars level={audioLevel} />
        </div>
        <button
          data-qa="transcript-toggle-btn"
          className={`font-sans text-[11px] font-medium tracking-[0.08em] bg-transparent rounded px-[10px] py-1 cursor-pointer transition-colors uppercase${
            micActive
              ? " border border-gold text-gold"
              : " border border-iron text-chalk hover:border-ash"
          }`}
          onClick={handleToggle}
          aria-label={micActive ? "Stop microphone" : "Start microphone"}
        >
          {micActive ? "STOP MIC" : "START MIC"}
        </button>
      </div>

      {/* STT warning banner */}
      {sttWarning && (
        <div
          className="flex items-center justify-between gap-2 px-6 py-2 bg-[rgba(201,168,76,0.07)] border-b border-[rgba(201,168,76,0.2)] shrink-0"
          role="alert"
        >
          <span className="text-[11px] text-gold-muted tracking-wide leading-[1.4]">
            {sttWarning}
          </span>
          <button
            data-qa="transcript-stt-warning-dismiss"
            className="bg-transparent border-none text-smoke cursor-pointer text-[10px] px-1 py-0.5 shrink-0 transition-colors leading-none hover:text-ash"
            onClick={() => setSttWarning(null)}
            aria-label="Dismiss warning"
          >
            ✕
          </button>
        </div>
      )}

      {/* Body */}
      <div
        className="flex-1 overflow-y-auto px-6 py-6 min-h-0 [scrollbar-width:thin] [scrollbar-color:var(--color-iron)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-iron [&::-webkit-scrollbar-thumb]:rounded-sm"
        role="log"
        aria-live="polite"
        aria-label="Live transcript"
      >
        {entries.length === 0 && !error && (
          <p className="text-sm text-smoke m-0">
            {micActive
              ? "Listening\u2026"
              : "Press START MIC to begin transcription."}
          </p>
        )}
        {error && <p className="text-[13px] text-ember m-0 mb-2">{error}</p>}
        {entries.map((entry) => (
          <p
            key={entry.id}
            className="text-base font-normal leading-relaxed text-chalk m-0 mb-2 animate-[transcript-line-in_150ms_ease-out]"
          >
            {entry.text}
          </p>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
