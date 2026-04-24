import { useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { ArtifactEntry, CloudSyncInfo } from "../../lib/types";
import { invoke } from "../../lib/tauri";
import { formatBytes, formatDate, fileIconChar } from "../../lib/artifact-utils";

export function ArtifactPreviewPanel({
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
  const isImage = mime.startsWith("image/");
  const isVideo = mime.startsWith("video/");
  const isAudio = mime.startsWith("audio/");
  const isPdf = mime.includes("pdf");
  const isText = mime.startsWith("text/") && !isPdf;

  const [fileSrc, setFileSrc] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textTruncated, setTextTruncated] = useState(false);
  const [textLoading, setTextLoading] = useState(false);

  useEffect(() => {
    if ((isImage || isVideo || isAudio || isPdf) && entry.path) {
      try {
        setFileSrc(convertFileSrc(entry.path));
      } catch {
        setFileSrc(null);
      }
    } else {
      setFileSrc(null);
    }
    setTextContent(null);
    setTextTruncated(false);
  }, [entry.path, isImage, isVideo, isAudio, isPdf]);

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

  return (
    <div className="flex w-[260px] shrink-0 flex-col overflow-hidden border-l border-line bg-bg-1">
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
          ✕
        </button>
      </div>

      {/* Render area */}
      <div className="mx-3 mb-2 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[4px] border border-line bg-bg">
        {isImage && fileSrc ? (
          <img
            src={fileSrc}
            alt={entry.name}
            className="h-full w-full object-contain"
            onError={() => setFileSrc(null)}
          />
        ) : isVideo && fileSrc ? (
          <video
            src={fileSrc}
            controls
            className="h-full w-full object-contain"
          />
        ) : isAudio && fileSrc ? (
          <div className="flex w-full flex-col items-center gap-3 p-3">
            <span className="text-[32px]">🎵</span>
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
              <span className="text-[10px] text-muted">Loading…</span>
            ) : textContent !== null ? (
              <>
                <pre className="m-0 font-mono text-[10px] leading-[1.5] break-words whitespace-pre-wrap text-ink-3">
                  {textContent}
                </pre>
                {textTruncated && (
                  <p className="m-0 mt-2 text-[9px] text-muted italic">
                    — truncated at 64 KB —
                  </p>
                )}
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-muted">
                <span className="text-[28px]">{fileIconChar(entry.mime_type, entry.is_dir)}</span>
                <span className="font-mono text-[10px]">{ext}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted">
            <span className="text-[28px]">{fileIconChar(entry.mime_type, entry.is_dir)}</span>
            <span className="font-mono text-[10px]">{ext}</span>
          </div>
        )}
      </div>

      {/* Metadata footer */}
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
          className="w-full cursor-pointer rounded-[3px] border border-line bg-transparent py-[6px] font-sans text-[11px] text-ink-3 transition-colors hover:border-line-strong hover:text-ink"
          onClick={() => onShare(entry)}
        >
          Share…
        </button>
      </div>
    </div>
  );
}
