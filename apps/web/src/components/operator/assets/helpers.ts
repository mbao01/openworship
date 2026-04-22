import type { ArtifactCategory, ArtifactEntry } from "../../../lib/types";
import {
  FolderIcon,
  FileIcon,
  ImageIcon,
  VideoIcon,
  Music2Icon,
  FileTextIcon,
  PresentationIcon,
} from "lucide-react";
import { createElement } from "react";

// ── Helpers ──────────────────────────────────────────────────────────────────

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

export function guessMimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
    webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp", ico: "image/x-icon",
    mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
    mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", flac: "audio/flac",
    pdf: "application/pdf",
    txt: "text/plain", md: "text/markdown", json: "application/json",
  };
  return map[ext] || "application/octet-stream";
}

export function formatStorageBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

// ── Shared constants ─────────────────────────────────────────────────────────

export const iconCls = "w-3.5 h-3.5 shrink-0";

// ── File icon ────────────────────────────────────────────────────────────────

export function fileIcon(e: ArtifactEntry, size: "sm" | "lg" = "sm") {
  const cls = size === "lg" ? "w-7 h-7 shrink-0" : iconCls;
  if (e.is_dir)
    return createElement("span", { className: "text-accent/80" },
      createElement(FolderIcon, { className: cls }));
  const cat = mimeCategory(e.mime_type);
  const colorCls =
    cat === "image" ? "text-[#7ba6d4]" :
    cat === "video" ? "text-[#9a7dd4]" :
    cat === "audio" ? "text-[#7dd4a0]" :
    cat === "document" ? "text-[#d4a07d]" :
    cat === "slide" ? "text-[#d47d7d]" :
    "text-ink-3";
  const IconComponent =
    cat === "image" ? ImageIcon :
    cat === "video" ? VideoIcon :
    cat === "audio" ? Music2Icon :
    cat === "document" ? FileTextIcon :
    cat === "slide" ? PresentationIcon :
    FileIcon;
  return createElement("span", { className: colorCls },
    createElement(IconComponent, { className: cls }));
}
