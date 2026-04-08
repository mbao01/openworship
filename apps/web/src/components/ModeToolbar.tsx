import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DetectionMode } from "../lib/types";

const MODES: { value: DetectionMode; label: string }[] = [
  { value: "auto",     label: "AUTO" },
  { value: "copilot",  label: "COPILOT" },
  { value: "airplane", label: "AIRPLANE" },
  { value: "offline",  label: "OFFLINE" },
];

export function ModeToolbar() {
  const [mode, setMode] = useState<DetectionMode>("copilot");

  useEffect(() => {
    invoke<DetectionMode>("get_detection_mode")
      .then(setMode)
      .catch(console.error);
  }, []);

  function handleModeChange(next: DetectionMode) {
    invoke("set_detection_mode", { mode: next })
      .then(() => setMode(next))
      .catch(console.error);
  }

  return (
    <div className="mode-toolbar" role="toolbar" aria-label="Detection mode">
      <div className="mode-toolbar__segment" role="group" aria-label="Mode">
        {MODES.map(({ value, label }) => (
          <button
            key={value}
            className={`mode-toolbar__btn${mode === value ? " mode-toolbar__btn--active" : ""}`}
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
