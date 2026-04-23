import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DetectionMode } from "../lib/types";
import { toastError } from "../lib/toast";

const MODES: { value: DetectionMode; label: string }[] = [
  { value: "auto", label: "AUTO" },
  { value: "copilot", label: "COPILOT" },
  { value: "airplane", label: "AIRPLANE" },
  { value: "offline", label: "OFFLINE" },
];

interface Props {
  onModeChange?: (mode: DetectionMode) => void;
}

export function ModeToolbar({ onModeChange }: Props) {
  const [mode, setMode] = useState<DetectionMode>("copilot");

  useEffect(() => {
    invoke<DetectionMode>("get_detection_mode")
      .then((m) => {
        setMode(m);
        onModeChange?.(m);
      })
      .catch(toastError("Failed to load detection mode"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleModeChange(next: DetectionMode) {
    invoke("set_detection_mode", { mode: next })
      .then(() => {
        setMode(next);
        onModeChange?.(next);
      })
      .catch(toastError("Failed to change detection mode"));
  }

  return (
    <div
      className="flex h-9 shrink-0 items-center border-b border-line bg-bg-1 px-4"
      role="toolbar"
      aria-label="Detection mode"
    >
      <div
        className="flex h-full items-stretch gap-0"
        role="group"
        aria-label="Mode"
      >
        {MODES.map(({ value, label }) => (
          <button
            key={value}
            data-qa={`mode-btn-${value}`}
            className={`cursor-pointer border-b-2 border-none bg-transparent px-4 font-sans text-[11px] font-medium tracking-[0.1em] transition-all uppercase${
              mode === value
                ? "border-b-accent text-ink"
                : "border-b-transparent text-ink-3 hover:text-ink"
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
