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
  const isText = (mime.startsWith("text/") || ["txt", "md", "json", "xml", "csv", "log", "yml", "yaml", "toml"].includes(fileExt)) && !isPdf;

  const [fileSrc, setFileSrc] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textTruncated, setTextTruncated] = useState(false);
  const [textLoading, setTextLoading] = useState(false);

  useEffect(() => {
    let revoked = false;
    let blobUrl: string | null = null;

    if ((isImage || isVideo || isAudio || isPdf) && entry.id) {
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
    invoke<[string, boolean]>("read_text_file", { id: entry.id, maxBytes: 65536 })
      .then(([text, truncated]) => {
        setTextContent(text);
        setTextTruncated(truncated);
      })
      .catch(() => setTextContent(null))
      .finally(() => setTextLoading(false));
  }, [entry.id, isText]);

  const ext = entry.name.split(".").pop()?.toUpperCase() ?? "—";
  const canPreview = !entry.is_dir && (isImage || isVideo || isAudio || isPdf || isText);

  return (
    <div className={`fixed bottom-6 right-6 w-[320px] bg-bg-1 border border-line-strong rounded-lg flex flex-col overflow-hidden shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] z-[50] animate-[fade-in_150ms_ease-out] ${canPreview ? "h-[400px]" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0">
        <span className="text-[9px] font-semibold tracking-[0.12em] uppercase text-muted">Preview</span>
        <button
          className="bg-transparent border-none text-muted cursor-pointer text-[12px] px-1 py-[2px] rounded hover:text-ink-3 transition-colors"
          onClick={onClose}
          aria-label="Close preview"
        >
          <XIcon className="w-3 h-3 shrink-0" />
        </button>
      </div>

      {/* Render area */}
      {canPreview && (
        <div className="mx-3 mb-2 rounded-[4px] overflow-hidden bg-bg border border-line flex-1 flex items-center justify-center min-h-0">
          {isImage && fileSrc ? (
            <img
              src={fileSrc}
              alt={entry.name}
              className="w-full h-full object-contain"
              onError={() => { setFileSrc(null); }}
            />
          ) : isVideo && fileSrc ? (
            <video
              src={fileSrc}
              controls
              className="w-full h-full object-contain"
            />
          ) : isAudio && fileSrc ? (
            <div className="flex flex-col items-center gap-3 p-3 w-full">
              <Music2Icon className="w-8 h-8 text-muted" />
              <audio src={fileSrc} controls className="w-full" />
            </div>
          ) : isPdf && fileSrc ? (
            <iframe
              src={fileSrc}
              title={entry.name}
              className="w-full h-full border-none"
            />
          ) : isText ? (
            <div className="w-full h-full overflow-auto p-2">
              {textLoading ? (
                <span className="text-[10px] text-muted">Loading&hellip;</span>
              ) : textContent !== null ? (
                <>
                  <pre className="text-[10px] font-mono text-ink-3 m-0 whitespace-pre-wrap break-words leading-[1.5]">
                    {textContent}
                  </pre>
                  {textTruncated && (
                    <p className="text-[9px] text-muted mt-2 m-0 italic">&mdash; truncated at 64 KB &mdash;</p>
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
      <div className="px-3 pb-3 shrink-0 flex flex-col gap-[6px]">
        <p className="text-[11px] font-medium text-ink m-0 break-words leading-[1.3] truncate" title={entry.name}>
          {entry.name}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {entry.mime_type && (
            <span className="text-[10px] font-mono text-muted">{ext}</span>
          )}
          {!entry.is_dir && entry.size_bytes > 0 && (
            <span className="text-[10px] font-mono text-muted">{formatBytes(entry.size_bytes)}</span>
          )}
          <span className="text-[10px] font-mono text-muted">{formatDate(entry.modified_at_ms)}</span>
          {syncInfo?.sync_enabled && (
            <span className="text-[10px] font-mono text-muted capitalize">{syncInfo.status.replace("_", " ")}</span>
          )}
        </div>
        <button
          className="w-full bg-transparent border border-line rounded text-ink-3 font-sans text-[11px] py-[6px] cursor-pointer transition-colors hover:text-ink hover:border-line-strong"
          onClick={() => onShare(entry)}
        >
          Share...
        </button>
      </div>
    </div>
  );
}
