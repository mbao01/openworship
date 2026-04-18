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
}

/**
 * Tracks Whisper model installation state.
 *
 * Subscribes to `stt://model-download-progress` for real-time progress
 * and exposes `download()` to trigger the download.
 * Used by AudioSection in Settings.
 */
export function useWhisperModel(): UseWhisperModelReturn {
  const [installed, setInstalled] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    checkWhisperModel()
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
  }, []);

  const download = useCallback(async () => {
    setDownloading(true);
    setProgress(0);
    try {
      await downloadWhisperModel();
    } catch (e) {
      console.error("[use-whisper-model] download failed:", e);
      setDownloading(false);
    }
  }, []);

  return { installed, downloading, progress, download };
}
