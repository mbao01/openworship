import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DetectionMode } from "../lib/types";

const MODES: { value: DetectionMode; label: string }[] = [
  { value: "auto",     label: "AUTO" },
  { value: "copilot",  label: "COPILOT" },
  { value: "airplane", label: "AIRPLANE" },
  { value: "offline",  label: "OFFLINE" },
];

interface Props {
  onModeChange?: (mode: DetectionMode) => void;
}

export function ModeToolbar({ onModeChange }: Props) {
  const [mode, setMode] = useState<DetectionMode>("copilot");

  useEffect(() => {
    invoke<DetectionMode>("get_detection_mode")
      .then((m) => { setMode(m); onModeChange?.(m); })
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleModeChange(next: DetectionMode) {
    invoke("set_detection_mode", { mode: next })
      .then(() => { setMode(next); onModeChange?.(next); })
      .catch(console.error);
  }

  return (
    <div
      className="h-9 bg-obsidian border-b border-iron flex items-center px-4 shrink-0"
      role="toolbar"
      aria-label="Detection mode"
    >
      <div className="flex items-stretch h-full gap-0" role="group" aria-label="Mode">
        {MODES.map(({ value, label }) => (
          <button
            key={value}
            data-qa={`mode-btn-${value}`}
            className={`font-sans text-[11px] font-medium tracking-[0.1em] bg-transparent border-none border-b-2 px-4 cursor-pointer transition-all uppercase${
              mode === value
                ? " text-chalk border-b-gold"
                : " text-ash border-b-transparent hover:text-chalk"
            }`}
            onClick={() => handleModeChange(value)}
            aria-pressed={mode === value}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
