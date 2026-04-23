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
  const artifactId = artifactRef.replace("artifact:", "");
  const ext = (filename || artifactId).split(".").pop()?.toLowerCase() || "";
  const src = `owmedia://localhost/${artifactId}`;

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
