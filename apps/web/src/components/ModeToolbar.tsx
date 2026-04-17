import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DetectionMode } from "../lib/types";
import { toastError } from "../lib/toast";
import { BroadcastModeControl } from "./BroadcastModeControl";

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
      .catch(toastError("Failed to load detection mode"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleModeChange(next: DetectionMode) {
    invoke("set_detection_mode", { mode: next })
      .then(() => { setMode(next); onModeChange?.(next); })
      .catch(toastError("Failed to change detection mode"));
  }

  return (
    <div
      className="flex p-1.5 border-b border-iron"
      role="toolbar"
      aria-label="Detection mode"
    >
      <BroadcastModeControl
        modes={MODES}
        selected={mode}
        onModeChange={(mode) => handleModeChange(mode)}
      />
    </div>
  );
}
