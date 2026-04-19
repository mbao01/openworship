import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { DetectionMode } from "../../lib/types";
import { getAudioLevel } from "../../lib/commands/audio";
import { getAudioSettings } from "../../lib/commands/settings";
import { toastError } from "../../lib/toast";

interface TopBarProps {
  mode: DetectionMode;
  onModeChange: (mode: DetectionMode) => void;
  onOpenCmdK: () => void;
  onPush?: () => void;
}

const MODES: { value: DetectionMode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "copilot", label: "Copilot" },
  { value: "airplane", label: "Airplane" },
  { value: "offline", label: "Offline" },
];

export function TopBar({ mode, onModeChange, onOpenCmdK, onPush }: TopBarProps) {
  const [micActive, setMicActive] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [inputLabel, setInputLabel] = useState("INPUT");

  // Subscribe to stt://transcript events for mic_active state
  useEffect(() => {
    const unlisten = listen<{ mic_active: boolean }>("stt://transcript", (event) => {
      setMicActive(event.payload.mic_active);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Poll audio level at 100ms when mic is active
  useEffect(() => {
    if (!micActive) {
      setAudioLevel(0);
      return;
    }
    const id = setInterval(() => {
      getAudioLevel().then(setAudioLevel).catch(() => {});
    }, 100);
    return () => clearInterval(id);
  }, [micActive]);

  // Load audio settings on mount
  useEffect(() => {
    try {
      getAudioSettings().then((s) => setInputLabel(s.audio_input_device || "INPUT"));
    } catch {
      // ignore
    }
  }, []);

  // Load initial mode from backend
  useEffect(() => {
    invoke<DetectionMode>("get_detection_mode")
      .then(onModeChange)
      .catch(toastError("Failed to load detection mode"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleModeChange(next: DetectionMode) {
    invoke("set_detection_mode", { mode: next })
      .then(() => onModeChange(next))
      .catch(toastError("Failed to change detection mode"));
  }

  return (
    <header className="h-[52px] shrink-0 grid grid-cols-[auto_1fr_auto] items-center gap-6 px-[18px] bg-bg-1 border-b border-line">
      {/* Brand */}
      <div className="flex items-center gap-2.5 font-serif text-[17px] tracking-[-0.01em] text-ink pr-[18px] border-r border-line h-[52px]">
        <BrandMark />
        openworship
      </div>

      {/* Center: mode switcher + mic */}
      <div className="flex items-center gap-2.5 justify-center">
        <div className="flex border border-line-strong rounded overflow-hidden bg-bg-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              className={`px-3.5 py-[7px] font-mono text-[10px] tracking-[0.12em] uppercase transition-all border-r border-line last:border-r-0 ${
                mode === m.value
                  ? "bg-accent text-[#1A0D00] font-semibold"
                  : "text-ink-3 hover:text-ink hover:bg-bg-3"
              }`}
              onClick={() => handleModeChange(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Mic group */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-line h-[52px]">
          <span
            className={`w-2 h-2 rounded-full ${
              micActive ? "bg-live animate-[blink_2s_infinite]" : "bg-bg-4"
            }`}
          />
          <LevelBars level={audioLevel} active={micActive} />
          <span className="font-mono text-[10.5px] tracking-[0.05em] uppercase text-ink-3">
            {inputLabel}
          </span>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1.5">
        <button
          className="inline-flex items-center gap-1.5 px-3 py-[7px] text-xs text-ink-2 rounded border border-line bg-bg-2 transition-all hover:text-ink hover:border-line-strong hover:bg-bg-3"
          onClick={onOpenCmdK}
        >
          <SearchIcon />
          Search
          <kbd className="font-mono text-[10px] px-1 py-px bg-bg-4 rounded-sm text-ink-3">
            ⌘K
          </kbd>
        </button>
        <button
          className="inline-flex items-center gap-1.5 px-3 py-[7px] text-xs font-semibold rounded border border-accent bg-accent text-[#1A0D00] transition-all hover:bg-accent-hover"
          onClick={onPush}
        >
          Push
          <kbd className="font-mono text-[10px] px-1 py-px bg-black/20 rounded-sm text-black/60">
            Space
          </kbd>
        </button>
        <Clock />
      </div>
    </header>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function BrandMark() {
  return (
    <span className="relative w-2 h-5 bg-ink">
      <span className="absolute left-full ml-0.5 top-0 w-0.5 h-5 bg-accent" />
    </span>
  );
}

function LevelBars({ level, active }: { level: number; active?: boolean }) {
  // Generate 10 bars with natural dropoff
  const bars = Array.from({ length: 10 }, (_, i) => {
    const dropoff = Math.max(0, 1 - i * 0.12);
    const value = active ? level * dropoff : 0;
    return value;
  });

  return (
    <span className="flex gap-[2px] items-end h-4">
      {bars.map((v, i) => {
        const h = Math.max(2, v * 16);
        const hot = v > 0.85;
        const on = v > 0.2;
        return (
          <span
            key={i}
            className={`w-[3px] rounded-[1px] transition-all duration-75 ${
              hot ? "bg-live" : on ? "bg-accent" : "bg-bg-4"
            }`}
            style={{ height: h }}
          />
        );
      })}
    </span>
  );
}

function Clock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const h = time.getHours();
  const m = String(time.getMinutes()).padStart(2, "0");
  const s = String(time.getSeconds()).padStart(2, "0");

  return (
    <div className="font-mono text-[11px] text-ink-3 tracking-[0.08em] px-3 border-l border-line h-[52px] flex items-center gap-2">
      <span>Service</span>
      <strong className="text-ink font-medium">{`${h}:${m}:${s}`}</strong>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
