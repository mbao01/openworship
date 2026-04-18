import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { TranscriptEvent } from "@/lib/types";

const MAX_LINES = 60;

export interface TranscriptLine {
  text: string;
  offset_ms: number;
  is_current: boolean;
}

export interface UseTranscriptReturn {
  lines: TranscriptLine[];
  isActive: boolean;
}

/**
 * Subscribes to the `stt://transcript` Tauri event and maintains a rolling
 * window of transcript lines for the Live screen transcript panel.
 */
export function useTranscript(): UseTranscriptReturn {
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [isActive, setIsActive] = useState(false);
  const activeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEvent = useCallback((event: { payload: TranscriptEvent }) => {
    const { text, offset_ms, mic_active } = event.payload;

    setIsActive(mic_active);
    if (activeTimeoutRef.current) clearTimeout(activeTimeoutRef.current);
    activeTimeoutRef.current = setTimeout(() => setIsActive(false), 3000);

    if (!text.trim()) return;

    setLines((prev) => {
      const updated = prev.map((l) => ({ ...l, is_current: false }));
      const next: TranscriptLine = { text, offset_ms, is_current: true };
      return [...updated, next].slice(-MAX_LINES);
    });
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<TranscriptEvent>("stt://transcript", handleEvent).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
      if (activeTimeoutRef.current) clearTimeout(activeTimeoutRef.current);
    };
  }, [handleEvent]);

  return { lines, isActive };
}
