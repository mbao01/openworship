import { useCallback, useEffect, useState } from "react";
import { getDetectionMode, setDetectionMode as saveDetectionMode } from "@/lib/commands/detection";
import type { DetectionMode } from "@/lib/types";

export interface UseDetectionModeReturn {
  mode: DetectionMode;
  setMode: (mode: DetectionMode) => Promise<void>;
}

/**
 * Loads and persists the AI detection mode (auto / copilot / airplane / offline).
 * Used by the TopBar mode switcher in OperatorPage.
 */
export function useDetectionMode(): UseDetectionModeReturn {
  const [mode, setModeState] = useState<DetectionMode>("copilot");

  useEffect(() => {
    getDetectionMode()
      .then((m) => setModeState(m))
      .catch((e) => console.error("[use-detection-mode] load failed:", e));
  }, []);

  const setMode = useCallback(async (next: DetectionMode) => {
    setModeState(next);
    try {
      await saveDetectionMode(next);
    } catch (e) {
      console.error("[use-detection-mode] save failed:", e);
    }
  }, []);

  return { mode, setMode };
}
