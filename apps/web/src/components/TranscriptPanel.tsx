import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { TranscriptEvent } from "../lib/types";
import { toastError } from "../lib/toast";

// Multipliers for each bar to create a natural equalizer spread
const BAR_MULTIPLIERS = [0.65, 0.85, 1.0, 0.9, 0.7];

function AudioLevelBars({ level }: { level: number }) {
  // Boost visibility (same factor as SettingsModal VU meter)
  const boosted = Math.min(1, level * 3);
  const clipping = level > 0.8;
  return (
    <span className="flex h-3 items-end gap-[2px]" aria-hidden="true">
      {BAR_MULTIPLIERS.map((m, i) => {
        const pct = Math.max(0.12, boosted * m);
        return (
          <span
            key={i}
            className={`w-[2px] rounded-sm transition-all duration-75 ${clipping ? "bg-danger" : "bg-accent"}`}
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
  const [lowSignal, setLowSignal] = useState(false);
  const [noTranscript, setNoTranscript] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const lowSignalTicks = useRef(0);
  /** Ticks (100ms each) with audio signal but no transcript events. */
  const signalNoTextTicks = useRef(0);
  const lastEntryCount = useRef(0);

  // Auto-scroll to bottom whenever entries change.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  // Poll audio level every 100ms whenever the mic is active.
  // After 5 s of very low signal (<0.02 RMS), show a "check your mic" hint.
  // After 8 s of good signal but 0 transcript entries, show a "no transcription" hint.
  useEffect(() => {
    if (!micActive) {
      lowSignalTicks.current = 0;
      signalNoTextTicks.current = 0;
      lastEntryCount.current = 0;
      setLowSignal(false);
      setNoTranscript(false);
      return;
    }
    const id = setInterval(async () => {
      const level = await invoke<number>("get_audio_level");
      setAudioLevel(level);
      if (level < 0.02) {
        lowSignalTicks.current += 1;
        if (lowSignalTicks.current >= 10) setLowSignal(true);
      } else {
        lowSignalTicks.current = 0;
        setLowSignal(false);
      }
      // Track "has audio but no transcript" condition.
      setEntries((prev) => {
        if (level >= 0.02 && prev.length === lastEntryCount.current) {
          signalNoTextTicks.current += 1;
          if (signalNoTextTicks.current >= 16) setNoTranscript(true);
        } else {
          signalNoTextTicks.current = 0;
          lastEntryCount.current = prev.length;
          setNoTranscript(false);
        }
        return prev; // no mutation
      });
    }, 500);
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
      invoke("stop_stt").catch(toastError("Failed to stop transcription"));
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
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-line px-6 py-4">
        <div className="flex items-center gap-2">
          {micActive && (
            <span
              className="inline-block h-2 w-2 shrink-0 animate-[transcript-pulse_1.5s_ease-in-out_infinite] rounded-full bg-accent [box-shadow:0_0_0_4px_color-mix(in_srgb,var(--color-accent)_25%,transparent)]"
              aria-hidden="true"
            />
          )}
          <span className="text-[11px] font-medium tracking-[0.12em] text-ink-3 uppercase">
            LIVE SPEECH TRANSCRIPT
          </span>
          <AudioLevelBars level={audioLevel} />
        </div>
        <button
          data-qa="transcript-toggle-btn"
          className={`cursor-pointer rounded bg-transparent px-[10px] py-1 font-sans text-[11px] font-medium tracking-[0.08em] transition-colors uppercase${
            micActive
              ? "border border-accent text-accent"
              : "border border-line text-ink hover:border-line-strong"
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
          className="flex shrink-0 items-center justify-between gap-2 border-b border-[rgba(201,168,76,0.2)] bg-[rgba(201,168,76,0.07)] px-6 py-2"
          role="alert"
        >
          <span className="text-[11px] leading-[1.4] tracking-wide text-accent/60">
            {sttWarning}
          </span>
          <button
            data-qa="transcript-stt-warning-dismiss"
            className="shrink-0 cursor-pointer border-none bg-transparent px-1 py-0.5 text-[10px] leading-none text-muted transition-colors hover:text-ink-3"
            onClick={() => setSttWarning(null)}
            aria-label="Dismiss warning"
          >
            ✕
          </button>
        </div>
      )}

      {/* Low-signal hint */}
      {lowSignal && (
        <div
          className="flex shrink-0 items-center gap-2 border-b border-[rgba(196,76,76,0.2)] bg-[rgba(196,76,76,0.07)] px-6 py-2"
          role="alert"
        >
          <span className="text-[11px] leading-[1.4] tracking-wide text-danger">
            Very low audio signal — check that the correct microphone is
            selected in Settings.
          </span>
        </div>
      )}

      {/* Audio present but no transcription hint */}
      {noTranscript && !lowSignal && (
        <div
          className="flex shrink-0 items-center gap-2 border-b border-[rgba(201,168,76,0.2)] bg-[rgba(201,168,76,0.07)] px-6 py-2"
          role="alert"
        >
          <span className="text-[11px] leading-[1.4] tracking-wide text-accent/60">
            Audio detected but no transcription — try re-downloading the model
            in Settings &rarr; Audio, or restart the mic.
          </span>
        </div>
      )}

      {/* Body */}
      <div
        className="min-h-0 flex-1 overflow-y-auto px-6 py-6 [scrollbar-color:var(--color-line-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-line"
        role="log"
        aria-live="polite"
        aria-label="Live transcript"
      >
        {entries.length === 0 && !error && (
          <p className="m-0 text-sm text-muted">
            {micActive
              ? "Listening ..."
              : "Press START MIC to begin transcription."}
          </p>
        )}
        {error && <p className="m-0 mb-2 text-[13px] text-danger">{error}</p>}
        {entries.map((entry) => (
          <p
            key={entry.id}
            className="m-0 mb-2 animate-[transcript-line-in_150ms_ease-out] text-base leading-relaxed font-normal text-ink"
          >
            {entry.text}
          </p>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
