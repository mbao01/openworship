import { useCallback, useEffect, useRef, useState } from "react";
import "../styles/display.css";

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

export function DisplayPage() {
  const [content, setContent] = useState<ContentEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const [lyricChunks, setLyricChunks] = useState<string[]>([]);
  const [chunkIndex, setChunkIndex] = useState(0);
  const [countdownSecs, setCountdownSecs] = useState<number | null>(null);
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
  const isAnnouncement =
    content?.kind === "announcement" || content?.kind === "custom_slide";
  const currentChunk =
    isSong && lyricChunks.length > 0 ? lyricChunks[chunkIndex] ?? "" : null;

  // Format mm:ss for countdown
  const fmtCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="display-root">
      {content ? (
        <div className="display-content">
          {isSong ? (
            <>
              <span className="display-reference display-song-title">
                {content.reference}
              </span>
              <div
                className="display-lyrics"
                onClick={() => advanceLyric(lyricChunks, chunkIndex)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) =>
                  e.key === " " && advanceLyric(lyricChunks, chunkIndex)
                }
                aria-label="Next lyric"
              >
                {(currentChunk ?? "").split("\n").map((line, i) => {
                  const isHeader =
                    /^\[.*\]$/.test(line.trim()) ||
                    /^(verse|chorus|bridge|pre-chorus|prechorus|intro|outro|tag)\b/i.test(
                      line.trim()
                    );
                  return (
                    <p
                      key={i}
                      className={
                        isHeader ? "display-lyric-header" : "display-lyric-line"
                      }
                    >
                      {line || "\u00A0"}
                    </p>
                  );
                })}
              </div>
              {content.translation && (
                <span className="display-song-artist">{content.translation}</span>
              )}
              {lyricChunks.length > 1 && (
                <span className="display-lyric-progress" aria-hidden="true">
                  {chunkIndex + 1} / {lyricChunks.length}
                </span>
              )}
            </>
          ) : isCountdown ? (
            <div className="display-countdown">
              {content.reference && (
                <span className="display-countdown__label">{content.reference}</span>
              )}
              <span
                className={`display-countdown__time ${
                  (countdownSecs ?? 0) <= 10 ? "display-countdown__time--urgent" : ""
                }`}
              >
                {fmtCountdown(countdownSecs ?? 0)}
              </span>
            </div>
          ) : isAnnouncement ? (
            <div className="display-announcement">
              {content.image_url && (
                <img
                  className="display-announcement__image"
                  src={content.image_url}
                  alt=""
                />
              )}
              <span className="display-reference display-announcement__title">
                {content.reference}
              </span>
              {content.text && (
                <p className="display-announcement__body">{content.text}</p>
              )}
            </div>
          ) : (
            <>
              <span className="display-reference">{content.reference}</span>
              <p className="display-verse">{content.text}</p>
            </>
          )}
        </div>
      ) : (
        <div className="display-idle" aria-hidden={connected} />
      )}
      <span className="display-watermark">openworship</span>
    </div>
  );
}
