import { useEffect, useState } from "react";
import { XIcon, Music2Icon } from "lucide-react";
import { invoke } from "../../../lib/tauri";
import type { ArtifactEntry, CloudSyncInfo } from "../../../lib/types";
import { formatBytes, formatDate, guessMimeFromExt } from "./helpers";

export function PreviewPanel({
  entry,
  syncInfo,
  onClose,
  onShare,
}: {
  entry: ArtifactEntry;
  syncInfo: CloudSyncInfo | undefined;
  onClose: () => void;
  onShare: (e: ArtifactEntry) => void;
}) {
  const mime = entry.mime_type ?? "";
  const fileExt = entry.name.split(".").pop()?.toLowerCase() ?? "";
  const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"];
  const VIDEO_EXTS = ["mp4", "webm", "mov", "avi", "mkv"];
  const AUDIO_EXTS = ["mp3", "wav", "ogg", "flac", "aac", "m4a"];
  const isImage = mime.startsWith("image/") || IMAGE_EXTS.includes(fileExt);
  const isVideo = mime.startsWith("video/") || VIDEO_EXTS.includes(fileExt);
  const isAudio = mime.startsWith("audio/") || AUDIO_EXTS.includes(fileExt);
  const isPdf = mime.includes("pdf") || fileExt === "pdf";
  const isText =
    (mime.startsWith("text/") ||
      [
        "txt",
        "md",
        "json",
        "xml",
        "csv",
        "log",
        "yml",
        "yaml",
        "toml",
      ].includes(fileExt)) &&
    !isPdf;

  const [fileSrc, setFileSrc] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textTruncated, setTextTruncated] = useState(false);
  const [textLoading, setTextLoading] = useState(false);

  useEffect(() => {
    let revoked = false;
    let blobUrl: string | null = null;

    if (isVideo && entry.id) {
      // Videos: use owmedia:// streaming protocol (no blob, no blocking)
      setFileSrc(`owmedia://localhost/${entry.id}`);
    } else if ((isImage || isAudio || isPdf) && entry.id) {
      invoke<number[]>("read_artifact_bytes", { id: entry.id })
        .then((bytes) => {
          if (revoked) return;
          const arr = new Uint8Array(bytes);
          const mime = entry.mime_type || guessMimeFromExt(fileExt);
          const blob = new Blob([arr], { type: mime });
          blobUrl = URL.createObjectURL(blob);
          setFileSrc(blobUrl);
        })
        .catch(() => {
          setFileSrc(null);
        });
    } else {
      setFileSrc(null);
    }
    setTextContent(null);
    setTextTruncated(false);

    return () => {
      revoked = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mime_type is derived from entry, recalculated on id change
  }, [entry.id, fileExt, isImage, isVideo, isAudio, isPdf]);

  useEffect(() => {
    if (!isText || !entry.id) return;
    setTextLoading(true);
    invoke<[string, boolean]>("read_text_file", {
      id: entry.id,
      maxBytes: 65536,
    })
      .then(([text, truncated]) => {
        setTextContent(text);
        setTextTruncated(truncated);
      })
      .catch(() => setTextContent(null))
      .finally(() => setTextLoading(false));
  }, [entry.id, isText]);

  const ext = entry.name.split(".").pop()?.toUpperCase() ?? "—";
  const canPreview =
    !entry.is_dir && (isImage || isVideo || isAudio || isPdf || isText);

  return (
    <div
      className={`fixed right-6 bottom-6 z-[50] flex w-[320px] animate-[fade-in_150ms_ease-out] flex-col overflow-hidden rounded-lg border border-line-strong bg-bg-1 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] ${canPreview ? "h-[400px]" : ""}`}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-3 pt-3 pb-2">
        <span className="text-[9px] font-semibold tracking-[0.12em] text-muted uppercase">
          Preview
        </span>
        <button
          className="cursor-pointer rounded border-none bg-transparent px-1 py-[2px] text-[12px] text-muted transition-colors hover:text-ink-3"
          onClick={onClose}
          aria-label="Close preview"
        >
          <XIcon className="h-3 w-3 shrink-0" />
        </button>
      </div>

      {/* Render area */}
      {canPreview && (
        <div className="mx-3 mb-2 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[4px] border border-line bg-bg">
          {isImage && fileSrc ? (
            <img
              src={fileSrc}
              alt={entry.name}
              className="h-full w-full object-contain"
              onError={() => {
                setFileSrc(null);
              }}
            />
          ) : isVideo && fileSrc ? (
            <video
              src={fileSrc}
              controls
              className="h-full w-full object-contain"
            />
          ) : isAudio && fileSrc ? (
            <div className="flex w-full flex-col items-center gap-3 p-3">
              <Music2Icon className="h-8 w-8 text-muted" />
              <audio src={fileSrc} controls className="w-full" />
            </div>
          ) : isPdf && fileSrc ? (
            <iframe
              src={fileSrc}
              title={entry.name}
              className="h-full w-full border-none"
            />
          ) : isText ? (
            <div className="h-full w-full overflow-auto p-2">
              {textLoading ? (
                <span className="text-[10px] text-muted">Loading&hellip;</span>
              ) : textContent !== null ? (
                <>
                  <pre className="m-0 font-mono text-[10px] leading-[1.5] break-words whitespace-pre-wrap text-ink-3">
                    {textContent}
                  </pre>
                  {textTruncated && (
                    <p className="m-0 mt-2 text-[9px] text-muted italic">
                      &mdash; truncated at 64 KB &mdash;
                    </p>
                  )}
                </>
              ) : (
                <span className="text-[10px] text-muted">Unable to load</span>
              )}
            </div>
          ) : (
            <span className="text-[10px] text-muted">Loading&hellip;</span>
          )}
        </div>
      )}

      {/* Compact metadata footer */}
      <div className="flex shrink-0 flex-col gap-[6px] px-3 pb-3">
        <p
          className="m-0 truncate text-[11px] leading-[1.3] font-medium break-words text-ink"
          title={entry.name}
        >
          {entry.name}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {entry.mime_type && (
            <span className="font-mono text-[10px] text-muted">{ext}</span>
          )}
          {!entry.is_dir && entry.size_bytes > 0 && (
            <span className="font-mono text-[10px] text-muted">
              {formatBytes(entry.size_bytes)}
            </span>
          )}
          <span className="font-mono text-[10px] text-muted">
            {formatDate(entry.modified_at_ms)}
          </span>
          {syncInfo?.sync_enabled && (
            <span className="font-mono text-[10px] text-muted capitalize">
              {syncInfo.status.replace("_", " ")}
            </span>
          )}
        </div>
        <button
          className="w-full cursor-pointer rounded border border-line bg-transparent py-[6px] font-sans text-[11px] text-ink-3 transition-colors hover:border-line-strong hover:text-ink"
          onClick={() => onShare(entry)}
        >
          Share...
        </button>
      </div>
    </div>
  );
}
