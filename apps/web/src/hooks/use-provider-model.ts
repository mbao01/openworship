import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  checkProviderModel,
  downloadProviderModel,
} from "@/lib/commands/audio";

export interface UseProviderModelReturn {
  installed: boolean;
  downloading: boolean;
  progress: number;
  download: (modelId: string) => Promise<void>;
}

interface DownloadProgressEvent {
  percent: number | null;
  provider: string;
  model: string;
}

/**
 * Generic hook for tracking model installation state for any STT provider.
 *
 * @param providerId - Provider ID (e.g. "whisper", "vosk")
 * @param modelId - Model ID to check/track (e.g. "small")
 */
export function useProviderModel(
  providerId: string,
  modelId?: string,
): UseProviderModelReturn {
  const [installed, setInstalled] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!modelId) {
      setInstalled(false);
      return;
    }
    checkProviderModel(providerId, modelId)
      .then((ok) => setInstalled(ok))
      .catch(() => setInstalled(false));

    let unlisten: (() => void) | undefined;
    listen<DownloadProgressEvent>("stt://model-download-progress", (event) => {
      // Only react to events for this provider + model
      if (
        event.payload.provider === providerId &&
        event.payload.model === modelId
      ) {
        setProgress(event.payload.percent ?? 0);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    let unlistenComplete: (() => void) | undefined;
    listen<{ provider: string; model: string }>(
      "stt://model-download-complete",
      (event) => {
        if (
          event.payload.provider === providerId &&
          event.payload.model === modelId
        ) {
          setDownloading(false);
          setInstalled(true);
          setProgress(0);
        }
      },
    ).then((fn) => {
      unlistenComplete = fn;
    });

    return () => {
      unlisten?.();
      unlistenComplete?.();
    };
  }, [providerId, modelId]);

  const download = useCallback(
    async (id: string) => {
      setDownloading(true);
      setProgress(0);
      try {
        await downloadProviderModel(providerId, id);
      } catch (e) {
        console.error(
          `[use-provider-model] download failed for ${providerId}/${id}:`,
          e,
        );
        setDownloading(false);
      }
    },
    [providerId],
  );

  return { installed, downloading, progress, download };
}
