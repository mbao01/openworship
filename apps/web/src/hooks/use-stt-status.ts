/**
 * @module hooks/use-stt-status
 *
 * Polls the Tauri backend for STT pipeline status at 5-second intervals.
 * Emits a toast when the engine enters or exits the Whisper fallback mode
 * (i.e., Deepgram unavailable → local Whisper active, or Deepgram restored).
 */

import { useEffect, useRef, useState } from "react";
import {
  getSttStatus,
  isSttActive,
  sttFallbackReason,
} from "@/lib/commands/audio";
import { toast } from "@/lib/toast";

export interface SttStatusState {
  /** True when STT is active (running or in fallback mode). */
  isActive: boolean;
  /**
   * Non-null when the primary backend (Deepgram) is unavailable and the
   * engine has automatically fallen back to local Whisper.
   * Contains a short human-readable reason (e.g. "network unreachable").
   */
  fallbackReason: string | null;
  /** True if the status could not be fetched (e.g. backend not yet ready). */
  error: boolean;
}

const POLL_INTERVAL_MS = 5_000;

/**
 * Polls the STT status every 5 seconds and notifies the user when the
 * engine degrades to or recovers from Whisper fallback mode.
 *
 * @returns Current {@link SttStatusState}.
 */
export function useSTTStatus(): SttStatusState {
  const [state, setState] = useState<SttStatusState>({
    isActive: false,
    fallbackReason: null,
    error: false,
  });

  // Track previous fallback state so we only toast on *transitions*.
  const prevFallbackRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const status = await getSttStatus();
        if (cancelled) return;

        const isActive = isSttActive(status);
        const fallbackReason = sttFallbackReason(status);

        // Notify on fallback transitions (not on every poll tick).
        if (fallbackReason !== null && prevFallbackRef.current === null) {
          toast.info(
            `STT switched to local Whisper — Deepgram unavailable (${fallbackReason})`,
          );
        } else if (fallbackReason === null && prevFallbackRef.current !== null) {
          toast.success("Deepgram restored — STT back to cloud mode");
        }
        prevFallbackRef.current = fallbackReason;

        setState({ isActive, fallbackReason, error: false });
      } catch {
        if (!cancelled) {
          setState((prev) => ({ ...prev, error: true }));
        }
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return state;
}
