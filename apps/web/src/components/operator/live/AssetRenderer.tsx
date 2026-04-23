import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MusicIcon, PaperclipIcon } from "lucide-react";

export const IMAGE_EXTS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp",
]);
export const VIDEO_EXTS = new Set(["mp4", "webm", "mov"]);
export const AUDIO_EXTS = new Set(["mp3", "wav", "ogg"]);

export function AssetRenderer({
  artifactRef,
  filename,
}: {
  artifactRef: string;
  filename?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const artifactId = artifactRef.replace("artifact:", "");
  const ext = (filename || artifactId).split(".").pop()?.toLowerCase() || "";

  useEffect(() => {
    let revoked = false;
    let url: string | null = null;
    invoke<number[]>("read_artifact_bytes", { id: artifactId })
      .then((bytes) => {
        if (revoked) return;
        const blob = new Blob([new Uint8Array(bytes)]);
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => setSrc(null));
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [artifactId]);

  if (!src) return null;

  if (IMAGE_EXTS.has(ext)) {
    return (
      <img src={src} alt="" className="max-h-full max-w-full object-contain" />
    );
  }
  if (VIDEO_EXTS.has(ext)) {
    return <video src={src} controls className="max-h-full max-w-full" />;
  }
  if (AUDIO_EXTS.has(ext)) {
    return (
      <div className="flex flex-col items-center gap-3">
        <MusicIcon className="h-12 w-12 text-accent" />
        <audio src={src} controls />
      </div>
    );
  }
  // PDF or other — show filename with icon
  return (
    <div className="flex flex-col items-center gap-2 text-ink-2">
      <PaperclipIcon className="h-10 w-10" />
      <span className="font-mono text-xs">{artifactId}</span>
    </div>
  );
}
