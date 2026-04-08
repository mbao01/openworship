import { useEffect, useState } from "react";
import { invoke } from "../lib/tauri";
import type { OperatingMode } from "../lib/types";

const MODES: { value: OperatingMode; label: string }[] = [
  { value: "auto", label: "AUTO" },
  { value: "copilot", label: "COPILOT" },
  { value: "airplane", label: "AIRPLANE" },
  { value: "offline", label: "OFFLINE" },
];

interface Props {
  onModeChange?: (mode: OperatingMode) => void;
}

export function ModeBar({ onModeChange }: Props) {
  const [mode, setMode] = useState<OperatingMode>("auto");

  useEffect(() => {
    invoke<OperatingMode>("get_mode")
      .then(setMode)
      .catch(() => {});
  }, []);

  async function handleSelect(next: OperatingMode) {
    try {
      await invoke("set_mode", { mode: next });
      setMode(next);
      onModeChange?.(next);
    } catch {
      // ignore — backend not available in browser preview
    }
  }

  return (
    <div className="mode-bar" role="group" aria-label="Detection mode">
      {MODES.map(({ value, label }) => (
        <button
          key={value}
          className={`mode-bar__btn${mode === value ? " mode-bar__btn--active" : ""}`}
          onClick={() => handleSelect(value)}
          aria-pressed={mode === value}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
