import { useCallback, useEffect, useRef, useState } from "react";
import { getAudioSettings, setAudioSettings } from "@/lib/commands/settings";
import type { AudioSettings } from "@/lib/types";

export interface UseAudioSettingsReturn {
  settings: AudioSettings | null;
  loading: boolean;
  /** Merge a partial update into local state immediately (does not save). */
  update: (patch: Partial<AudioSettings>) => void;
  /** Persist current settings to the backend. */
  save: () => Promise<void>;
}

const DEBOUNCE_MS = 600;

/**
 * Loads and manages AudioSettings from the Rust backend.
 *
 * Exposes `update` for immediate local state changes and `save` for
 * debounce-safe persistence. Used by AudioSection and AppearanceSection.
 */
export function useAudioSettings(): UseAudioSettingsReturn {
  const [settings, setSettings] = useState<AudioSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<AudioSettings | null>(null);

  useEffect(() => {
    getAudioSettings()
      .then((s) => setSettings(s))
      .catch((e) => console.error("[use-audio-settings] load failed:", e))
      .finally(() => setLoading(false));
  }, []);

  const save = useCallback(async () => {
    const toSave = pendingRef.current ?? settings;
    if (!toSave) return;
    try {
      await setAudioSettings(toSave);
    } catch (e) {
      console.error("[use-audio-settings] save failed:", e);
    }
  }, [settings]);

  const update = useCallback((patch: Partial<AudioSettings>) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      pendingRef.current = next;

      // Debounced auto-save
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await setAudioSettings(next);
          pendingRef.current = null;
        } catch (e) {
          console.error("[use-audio-settings] debounced save failed:", e);
        }
      }, DEBOUNCE_MS);

      return next;
    });
  }, []);

  return { settings, loading, update, save };
}
