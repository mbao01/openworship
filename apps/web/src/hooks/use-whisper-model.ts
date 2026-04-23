import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { checkWhisperModel, downloadWhisperModel } from "@/lib/commands/audio";

export interface UseWhisperModelReturn {
  installed: boolean;
  downloading: boolean;
  progress: number;
  download: () => Promise<void>;
}

interface DownloadProgressEvent {
  progress: number;
  done: boolean;
  model?: string;
}

/**
 * Tracks Whisper model installation state.
 *
 * @param modelFilename - Specific model file to check/download (e.g. "ggml-small.en.bin").
 *   If omitted, checks for any usable model via the fallback chain.
 */
export function useWhisperModel(modelFilename?: string): UseWhisperModelReturn {
  const [installed, setInstalled] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    checkWhisperModel(modelFilename)
      .then((ok) => setInstalled(ok))
      .catch(() => setInstalled(false));

    let unlisten: (() => void) | undefined;
    listen<DownloadProgressEvent>("stt://model-download-progress", (event) => {
      setProgress(event.payload.progress);
      if (event.payload.done) {
        setDownloading(false);
        setInstalled(true);
        setProgress(0);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [modelFilename]);

  const download = useCallback(async () => {
    setDownloading(true);
    setProgress(0);
    try {
      await downloadWhisperModel(modelFilename);
    } catch (e) {
      console.error("[use-whisper-model] download failed:", e);
      setDownloading(false);
    }
  }, [modelFilename]);

  return { installed, downloading, progress, download };
}
