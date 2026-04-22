/**
 * Shared display content renderer.
 *
 * Renders at a fixed reference resolution (1920×1080) using pixel values.
 * The parent container is responsible for scaling — either:
 * - Fullscreen: container is the viewport, CSS maps 1:1
 * - Preview: container uses transform:scale() to shrink from 1920×1080
 *
 * This ensures the Live preview is a pixel-perfect scaled replica of the Display.
 */

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

/** Reference resolution — all pixel values are designed for this size. */
export const REF_WIDTH = 1920;
export const REF_HEIGHT = 1080;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DisplayContentEvent {
  kind: string;
  reference: string;
  text: string;
  translation: string;
  image_url?: string;
}

interface DisplayContentProps {
  content: DisplayContentEvent | null;
  backgroundValue?: string | null;
  /** Hint for blob: URLs — "video" renders a <video>, anything else an <img>. */
  backgroundType?: string | null;
  currentChunk?: string | null;
  totalChunks?: number;
  chunkIndex?: number;
  countdownSecs?: number | null;
  onAdvanceLyric?: () => void;
  /** When true, shows "no content" placeholder when content is null. */
  showEmptyState?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"]);
const VIDEO_EXTS = new Set(["mp4", "webm", "mov"]);

function ArtifactImage({
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
  if (VIDEO_EXTS.has(ext))
    return (
      <video
        src={src}
        autoPlay
        loop
        muted
        className="max-h-full max-w-full object-contain"
      />
    );
  if (IMAGE_EXTS.has(ext) || !ext)
    return (
      <img src={src} alt="" className="max-h-full max-w-full object-contain" />
    );
  return null;
}

function fmtCountdown(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Renders display content at 1920×1080 reference resolution.
 * Place inside a container with `width:1920px; height:1080px` (or scaled).
 */
export function DisplayContent({
  content,
  backgroundValue,
  backgroundType,
  currentChunk,
  totalChunks = 0,
  chunkIndex = 0,
  countdownSecs,
  onAdvanceLyric,
  showEmptyState = false,
}: DisplayContentProps) {
  const isSong = content?.kind === "song";
  const isCountdown = content?.kind === "countdown";

  return (
    <div
      style={{ width: REF_WIDTH, height: REF_HEIGHT }}
      className="relative overflow-hidden bg-[#050403] text-[#F5EFDF]"
    >
      {/* Background */}
      {backgroundValue && (
        <div className="absolute inset-0 z-0">
          {backgroundValue.startsWith("data:video/") ||
          backgroundType === "video" ||
          backgroundValue.includes("asset.localhost") ? (
            <video
              key={backgroundValue}
              src={backgroundValue}
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-cover"
            />
          ) : backgroundValue.startsWith("data:image/") ||
            backgroundValue.startsWith("blob:") ? (
            <img
              src={backgroundValue}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="h-full w-full"
              style={{ background: backgroundValue }}
            />
          )}
        </div>
      )}

      {/* Content — all sizes in px designed for 1920×1080 */}
      <div
        className="absolute inset-0 z-10 flex flex-col justify-center"
        style={{
          padding: "65px 154px" /* ~6% / ~8% of 1920×1080 */,
          textShadow:
            "0 2px 4px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.6), 0 0 2px rgba(0,0,0,0.9)",
          WebkitTextStroke: "0.5px rgba(0,0,0,0.3)",
        }}
      >
        {content ? (
          <>
            {content.image_url?.startsWith("artifact:") ? (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ padding: 43 }}
              >
                <ArtifactImage
                  artifactRef={content.image_url}
                  filename={content.reference}
                />
              </div>
            ) : isSong ? (
              <>
                <div
                  className="flex cursor-pointer flex-col outline-none"
                  style={{ gap: 22 }}
                  onClick={onAdvanceLyric}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === " " && onAdvanceLyric?.()}
                >
                  <div
                    className="font-mono tracking-[0.22em] text-accent uppercase"
                    style={{ fontSize: 18, marginBottom: 10 }}
                  >
                    {content.reference}
                  </div>
                  {(currentChunk ?? "").split("\n").map((line, i) => {
                    const isHeader =
                      /^\[.*\]$/.test(line.trim()) ||
                      /^(verse|chorus|bridge|pre-chorus|prechorus|intro|outro|tag)\b/i.test(
                        line.trim(),
                      );
                    return isHeader ? (
                      <p
                        key={i}
                        className="m-0 font-sans font-medium tracking-[0.18em] text-muted uppercase"
                        style={{ fontSize: 15 }}
                      >
                        {line || "\u00A0"}
                      </p>
                    ) : (
                      <p
                        key={i}
                        className="m-0 font-serif leading-[1.2] font-semibold text-[#F5EFDF]"
                        style={{ fontSize: 72 }}
                      >
                        {line || "\u00A0"}
                      </p>
                    );
                  })}
                </div>
                {totalChunks > 1 && (
                  <span
                    className="absolute font-mono tracking-[0.12em] text-muted opacity-60"
                    style={{ bottom: 32, right: 154, fontSize: 14 }}
                  >
                    {chunkIndex + 1} / {totalChunks}
                  </span>
                )}
              </>
            ) : isCountdown ? (
              <div className="flex flex-col" style={{ gap: 22 }}>
                {content.reference && (
                  <span
                    className="font-mono tracking-[0.22em] text-accent uppercase"
                    style={{ fontSize: 18 }}
                  >
                    {content.reference}
                  </span>
                )}
                <span
                  className={`font-mono leading-none font-semibold tracking-[0.05em] transition-colors duration-500 ${
                    (countdownSecs ?? 0) <= 10
                      ? "text-danger"
                      : "text-[#F5EFDF]"
                  }`}
                  style={{ fontSize: 220 }}
                >
                  {fmtCountdown(countdownSecs ?? 0)}
                </span>
              </div>
            ) : (
              /* Scripture / announcement */
              <div className="flex flex-col" style={{ gap: 16 }}>
                <div
                  className="font-mono tracking-[0.22em] text-accent uppercase"
                  style={{ fontSize: 18 }}
                >
                  {content.reference}
                  {content.translation && (
                    <span
                      className="text-[#F5EFDF]/50"
                      style={{ marginLeft: 8 }}
                    >
                      · {content.translation}
                    </span>
                  )}
                </div>
                <div
                  className="font-serif leading-[1.35] tracking-[-0.01em] text-[#F5EFDF] italic"
                  style={{ fontSize: 72, maxWidth: 1344 /* ~70% of 1920 */ }}
                >
                  &ldquo;{content.text}&rdquo;
                </div>
              </div>
            )}
          </>
        ) : showEmptyState ? (
          <div
            className="w-full text-center font-mono tracking-[0.2em] text-[#3A332C] uppercase"
            style={{ fontSize: 14 }}
          >
            — no content on screen —
          </div>
        ) : null}
      </div>

      {/* Watermark */}
      <span
        data-qa="display-watermark"
        className="absolute z-10 font-sans tracking-[0.2em] text-muted lowercase select-none"
        style={{ bottom: 32, left: "10%", fontSize: 12 }}
      >
        openworship
      </span>
    </div>
  );
}
