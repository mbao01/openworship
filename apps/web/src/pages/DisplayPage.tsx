import { useEffect, useRef, useState } from "react";
import "../styles/display.css";

interface ContentEvent {
  kind: string;        // "scripture" | "song" | "song_advance"
  reference: string;   // verse ref or song title
  text: string;        // verse text or full lyrics (newline-separated)
  translation: string; // translation abbrev or artist name
  line_index?: number; // chunk index for song/song_advance events
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
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Advance lyric chunk by one step.
  const advanceLyric = (chunks: string[], idx: number) => {
    if (idx + 1 < chunks.length) {
      setChunkIndex(idx + 1);
    }
  };

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
            setContent(event);
          } else if (event.kind === "song_advance") {
            // Speech-pacing advance from backend.
            setChunkIndex(event.line_index ?? 0);
          } else {
            // Scripture or other content — clear song state.
            setLyricChunks([]);
            setChunkIndex(0);
            if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
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
  }, []);

  const isSong = content?.kind === "song";
  const currentChunk =
    isSong && lyricChunks.length > 0 ? lyricChunks[chunkIndex] ?? "" : null;

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
