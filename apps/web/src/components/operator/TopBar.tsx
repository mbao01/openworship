import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { DetectionMode } from "../../lib/types";
import { getAudioLevel, startStt, stopStt } from "../../lib/commands/audio";
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

export function TopBar({
  mode,
  onModeChange,
  onOpenCmdK,
  onPush,
}: TopBarProps) {
  const [micActive, setMicActive] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [inputLabel, setInputLabel] = useState("INPUT");

  // Subscribe to stt://transcript events for mic_active state
  useEffect(() => {
    const unlisten = listen<{ mic_active: boolean }>(
      "stt://transcript",
      (event) => {
        setMicActive(event.payload.mic_active);
      },
    );
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
      getAudioLevel()
        .then(setAudioLevel)
        .catch(() => {});
    }, 100);
    return () => clearInterval(id);
  }, [micActive]);

  // Load audio settings on mount
  useEffect(() => {
    try {
      getAudioSettings().then((s) =>
        setInputLabel(s.audio_input_device || "INPUT"),
      );
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

  const handleMicToggle = async () => {
    if (micActive) {
      await stopStt().catch(() => {});
      setMicActive(false);
    } else {
      await startStt().catch(() => {});
      setMicActive(true);
    }
  };

  function handleModeChange(next: DetectionMode) {
    invoke("set_detection_mode", { mode: next })
      .then(() => onModeChange(next))
      .catch(toastError("Failed to change detection mode"));
  }

  return (
    <header
      data-qa="operator-titlebar"
      className="grid h-[52px] shrink-0 grid-cols-[auto_1fr_auto] items-center gap-6 border-b border-line bg-bg-1 px-[18px]"
    >
      {/* Brand */}
      <div className="flex h-[52px] items-center gap-2.5 border-r border-line pr-[18px] font-serif text-[17px] tracking-[-0.01em] text-ink">
        <BrandMark />
        <span data-qa="operator-appname">openworship</span>
      </div>

      {/* Center: mode switcher + mic */}
      <div className="flex items-center justify-center gap-2.5">
        <div className="flex overflow-hidden rounded border border-line-strong bg-bg-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              className={`cursor-pointer border-r border-line px-3.5 py-1.5 font-mono text-[10px] tracking-[0.12em] uppercase transition-all last:border-r-0 ${
                mode === m.value
                  ? "bg-accent font-semibold text-accent-foreground"
                  : "text-ink-3 hover:bg-bg-3 hover:text-ink"
              }`}
              onClick={() => handleModeChange(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Mic group */}
        <button
          className="flex h-[52px] cursor-pointer items-center gap-2.5 border-l border-line pl-3 transition-colors hover:bg-bg-2/50"
          onClick={handleMicToggle}
          title={micActive ? "Stop microphone" : "Start microphone"}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              micActive ? "animate-[blink_2s_infinite] bg-live" : "bg-bg-4"
            }`}
          />
          <LevelBars level={audioLevel} active={micActive} />
          <span className="font-mono text-[10.5px] tracking-[0.05em] text-ink-3 uppercase">
            {inputLabel}
          </span>
        </button>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1.5">
        <button
          className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-line bg-bg-2 px-3 py-1.5 text-xs text-ink-2 transition-all hover:border-line-strong hover:bg-bg-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onOpenCmdK}
        >
          <SearchIcon />
          Search
          <kbd className="rounded-sm bg-bg-4 px-1 py-px font-mono text-[10px] text-ink-3">
            ⌘K
          </kbd>
        </button>
        <button
          className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-accent bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onPush}
        >
          Push
          <kbd className="rounded-sm bg-black/20 px-1 py-px font-mono text-[10px] text-black/60">
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
    <span className="relative h-5 w-2 bg-ink">
      <span className="absolute top-0 left-full ml-0.5 h-5 w-0.5 bg-accent" />
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
    <span className="flex h-4 items-end gap-[2px]">
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
    <div className="flex h-[52px] items-center gap-2 border-l border-line px-3 font-mono text-[11px] tracking-[0.08em] text-ink-3">
      <span>Service</span>
      <strong className="font-medium text-ink">{`${h}:${m}:${s}`}</strong>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
