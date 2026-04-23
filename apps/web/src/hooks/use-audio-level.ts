import { useEffect, useRef, useState } from "react";
import { getAudioLevel } from "@/lib/commands/audio";

const DEFAULT_INTERVAL_MS = 200;

/**
 * Polls `get_audio_level` at a regular interval and returns the current level
 * as a normalized float [0–1].
 *
 * Used by the VU meter in the TopBar and AudioSection.
 *
 * @param interval  Poll interval in milliseconds (default: 100ms)
 */
export function useAudioLevel(interval = DEFAULT_INTERVAL_MS): number {
  const [level, setLevel] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(async () => {
      try {
        const l = await getAudioLevel();
        setLevel(l);
      } catch {
        setLevel(0);
      }
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [interval]);

  return level;
}
