import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ContentEvent {
  kind: string;
  reference: string;
  text: string;
  translation: string;
  line_index?: number;
  image_url?: string;
  duration_secs?: number;
  slide_index?: number;
  total_slides?: number;
  background_url?: string;
}

const WS_URL = "ws://127.0.0.1:9000";
const RECONNECT_DELAY_MS = 2000;
/** Seconds to hold each lyric chunk before auto-advancing. */
const AUTO_ADVANCE_SECS = 6;
/** Lines of lyrics shown per display chunk. */
const LINES_PER_CHUNK = 2;

/** Split lyrics into display chunks of `LINES_PER_CHUNK` lyric lines. */
function splitLyrics(lyrics: string): string[] {
  const chunks: string[] = [];
  let current: string[] = [];
  let lyricLineCount = 0;

  for (const rawLine of lyrics.split("\n")) {
    const line = rawLine.trim();
    const isSectionHeader =
      /^\[.*\]$/.test(line) ||
      /^(verse|chorus|bridge|pre-chorus|prechorus|intro|outro|tag)\b/i.test(line);

    if (isSectionHeader) {
      if (current.length > 0) {
        chunks.push(current.join("\n"));
        current = [];
        lyricLineCount = 0;
      }
      current.push(line);
    } else if (line === "") {
      if (current.length > 0) current.push("");
    } else {
      current.push(line);
      lyricLineCount++;
      if (lyricLineCount >= LINES_PER_CHUNK) {
        chunks.push(current.join("\n"));
        current = [];
        lyricLineCount = 0;
      }
    }
  }
  if (current.length > 0) chunks.push(current.join("\n"));
  return chunks.filter((c) => c.trim() !== "");
}

const DISPLAY_IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"]);
const DISPLAY_VIDEO_EXTS = new Set(["mp4", "webm", "mov"]);
const DISPLAY_AUDIO_EXTS = new Set(["mp3", "wav", "ogg"]);

function ArtifactMedia({ artifactRef, filename, className }: { artifactRef: string; filename?: string; className?: string }) {
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
    return () => { revoked = true; if (url) URL.revokeObjectURL(url); };
  }, [artifactId]);

  if (!src) return null;

  if (DISPLAY_IMAGE_EXTS.has(ext)) {
    return <img className={className || "max-w-[40vw] max-h-[35vh] object-contain rounded-sm mb-2"} src={src} alt="" />;
  }
  if (DISPLAY_VIDEO_EXTS.has(ext)) {
    return <video src={src} controls className={className || "max-w-[60vw] max-h-[50vh] rounded-sm mb-2"} />;
  }
  if (DISPLAY_AUDIO_EXTS.has(ext)) {
    return (
      <div className="flex flex-col items-center gap-4 mb-2">
        <span className="font-sans text-lg text-ink-3">{artifactId}</span>
        <audio src={src} controls />
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2 text-ink-3 mb-2">
      <span className="font-sans text-lg">{artifactId}</span>
    </div>
  );
}

export function DisplayPage() {
  const [content, setContent] = useState<ContentEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const [lyricChunks, setLyricChunks] = useState<string[]>([]);
  const [chunkIndex, setChunkIndex] = useState(0);
  const [countdownSecs, setCountdownSecs] = useState<number | null>(null);
  const [backgroundValue, setBackgroundValue] = useState<string | null>(null);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Advance lyric chunk by one step.
  const advanceLyric = (chunks: string[], idx: number) => {
    if (idx + 1 < chunks.length) {
      setChunkIndex(idx + 1);
    }
  };

  // Start a countdown from `secs` to 0, then clear.
  const startCountdown = useCallback((secs: number) => {
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    setCountdownSecs(secs);
    countdownInterval.current = setInterval(() => {
      setCountdownSecs((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownInterval.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Reset auto-advance timer when chunk changes.
  useEffect(() => {
    if (lyricChunks.length === 0) return;
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    // Don't auto-advance on the last chunk.
    if (chunkIndex < lyricChunks.length - 1) {
      autoAdvanceTimer.current = setTimeout(() => {
        setChunkIndex((prev) => Math.min(prev + 1, lyricChunks.length - 1));
      }, AUTO_ADVANCE_SECS * 1000);
    }
    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    };
  }, [chunkIndex, lyricChunks]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let destroyed = false;

    function connect() {
      if (destroyed) return;
      ws = new WebSocket(WS_URL);

      ws.onopen = () => setConnected(true);

      ws.onmessage = (evt) => {
        try {
          const event = JSON.parse(evt.data as string) as ContentEvent;

          if (event.kind === "set_background") {
            // Background change — does not affect content.
            // The backend resolves preset IDs to CSS gradients and
            // artifact IDs to base64 data URLs, so the value is
            // directly usable here.
            const bgUrl = event.background_url || null;
            setBackgroundValue(bgUrl);
            return;
          }

          if (event.kind === "song") {
            // New song — parse lyrics and start from first chunk.
            const chunks = splitLyrics(event.text);
            setLyricChunks(chunks);
            setChunkIndex(event.line_index ?? 0);
            setCountdownSecs(null);
            if (countdownInterval.current) clearInterval(countdownInterval.current);
            setContent(event);
          } else if (event.kind === "song_advance") {
            // Speech-pacing advance from backend.
            setChunkIndex(event.line_index ?? 0);
          } else if (event.kind === "countdown") {
            // Start a visual countdown timer.
            setLyricChunks([]);
            setChunkIndex(0);
            if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
            setContent(event);
            startCountdown(event.duration_secs ?? 60);
          } else if (event.kind === "sermon_note") {
            // Sermon notes go to the speaker page, not the main display.
            // Ignore on the projection display.
          } else {
            // Scripture, announcement, custom_slide — clear song/countdown state.
            setLyricChunks([]);
            setChunkIndex(0);
            setCountdownSecs(null);
            if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
            if (countdownInterval.current) clearInterval(countdownInterval.current);
            setContent(event);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!destroyed) setTimeout(connect, RECONNECT_DELAY_MS);
      };

      ws.onerror = () => ws?.close();
    }

    connect();
    return () => {
      destroyed = true;
      ws?.close();
    };
  }, [startCountdown]);

  const isSong = content?.kind === "song";
  const isCountdown = content?.kind === "countdown";
  const currentChunk =
    isSong && lyricChunks.length > 0 ? lyricChunks[chunkIndex] ?? "" : null;

  // Format mm:ss for countdown
  const fmtCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div data-qa="display-root" className="fixed inset-0 bg-bg overflow-hidden font-sans">
      {/* Background layer — behind all content */}
      {backgroundValue && (
        <div className="absolute inset-0 z-0">
          {backgroundValue.startsWith("data:video/") ? (
            <video
              src={backgroundValue}
              autoPlay
              loop
              muted
              className="w-full h-full object-cover"
            />
          ) : backgroundValue.startsWith("data:image/") ? (
            <img
              src={backgroundValue}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            /* CSS gradient or solid color */
            <div
              className="w-full h-full"
              style={{ background: backgroundValue }}
            />
          )}
        </div>
      )}

      {content ? (
        <div
          className="absolute inset-0 z-10 flex flex-col justify-center px-[8vw] py-[6vh]"
          style={{
            textShadow:
              "0 2px 4px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.6), 0 0 2px rgba(0,0,0,0.9)",
            WebkitTextStroke: "0.5px rgba(0,0,0,0.3)",
          }}
        >
          {content.image_url?.startsWith("artifact:") ? (
            /* Artifact centered, preserving aspect ratio — matches live preview */
            <div className="absolute inset-0 flex items-center justify-center p-[4vh]">
              <ArtifactMedia
                artifactRef={content.image_url}
                filename={content.reference}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          ) : isSong ? (
            <>
              {/* Song: title + lyrics centered */}
              <div
                data-qa="display-content"
                className="flex flex-col gap-[2vh] cursor-pointer outline-none"
                onClick={() => advanceLyric(lyricChunks, chunkIndex)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === " " && advanceLyric(lyricChunks, chunkIndex)}
                aria-label="Next lyric"
              >
                <div className="font-mono text-[clamp(0.8rem,1.5vw,1.2rem)] tracking-[0.22em] uppercase text-accent mb-[1vh]">
                  {content.reference}
                </div>
                {(currentChunk ?? "").split("\n").map((line, i) => {
                  const isHeader =
                    /^\[.*\]$/.test(line.trim()) ||
                    /^(verse|chorus|bridge|pre-chorus|prechorus|intro|outro|tag)\b/i.test(line.trim());
                  return isHeader ? (
                    <p key={i} className="m-0 font-sans text-[clamp(0.7rem,1.2vw,1rem)] font-medium tracking-[0.18em] uppercase text-muted">
                      {line || "\u00A0"}
                    </p>
                  ) : (
                    <p key={i} className="m-0 font-serif text-[clamp(2rem,4.5vw,5rem)] font-semibold leading-[1.2] text-[#F5EFDF]">
                      {line || "\u00A0"}
                    </p>
                  );
                })}
              </div>
              {lyricChunks.length > 1 && (
                <span className="absolute bottom-[3vh] right-[8vw] font-mono text-[clamp(0.6rem,1vw,0.8rem)] tracking-[0.12em] text-muted opacity-60">
                  {chunkIndex + 1} / {lyricChunks.length}
                </span>
              )}
            </>
          ) : isCountdown ? (
            /* Countdown timer */
            <div data-qa="display-content" className="flex flex-col gap-[2vh]">
              {content.reference && (
                <span className="font-mono text-[clamp(0.8rem,1.5vw,1.2rem)] tracking-[0.22em] uppercase text-accent">
                  {content.reference}
                </span>
              )}
              <span
                className={`font-mono text-[clamp(6rem,14vw,14rem)] font-semibold leading-none tracking-[0.05em] transition-colors duration-500 ${
                  (countdownSecs ?? 0) <= 10 ? "text-danger" : "text-[#F5EFDF]"
                }`}
              >
                {fmtCountdown(countdownSecs ?? 0)}
              </span>
            </div>
          ) : (
            /* Scripture / announcement — matches live preview exactly */
            <div data-qa="display-content" className="flex flex-col gap-[1.5vh]">
              <div className="font-mono text-[clamp(0.8rem,1.5vw,1.2rem)] tracking-[0.22em] uppercase text-accent">
                {content.reference}
                {content.translation && (
                  <span className="text-[#F5EFDF]/50 ml-2">· {content.translation}</span>
                )}
              </div>
              <div
                className="font-serif italic leading-[1.35] tracking-[-0.01em] max-w-[70vw] text-[#F5EFDF]"
                style={{ fontSize: "clamp(2rem,4.5vw,5rem)" }}
              >
                &ldquo;{content.text}&rdquo;
              </div>
            </div>
          )}
        </div>
      ) : (
        <div data-qa="display-idle" className="hidden" aria-hidden={connected} />
      )}
      <span data-qa="display-watermark" className="absolute bottom-6 left-[10%] font-sans text-xs tracking-[0.2em] text-muted lowercase select-none">
        openworship
      </span>
    </div>
  );
}
