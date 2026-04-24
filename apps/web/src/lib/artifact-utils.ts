import type { ArtifactCategory } from "./types";

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function mimeCategory(mime: string | null): ArtifactCategory {
  if (!mime) return "other";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (
    mime.includes("pdf") ||
    mime.includes("document") ||
    mime.startsWith("text/")
  )
    return "document";
  if (mime.includes("presentation") || mime.includes("powerpoint"))
    return "slide";
  return "other";
}

export function formatStorageBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

export const ARTIFACT_FILTERS: Array<{
  label: string;
  value: ArtifactCategory | "all";
}> = [
  { label: "All", value: "all" },
  { label: "Images", value: "image" },
  { label: "Videos", value: "video" },
  { label: "Audio", value: "audio" },
  { label: "Documents", value: "document" },
  { label: "Slides", value: "slide" },
];

export function fileIconChar(mime: string | null, isDir: boolean): string {
  if (isDir) return "📁";
  const cat = mimeCategory(mime);
  return cat === "image"
    ? "🖼"
    : cat === "video"
      ? "🎬"
      : cat === "audio"
        ? "🎵"
        : cat === "document"
          ? "📄"
          : cat === "slide"
            ? "📊"
            : "📎";
}
