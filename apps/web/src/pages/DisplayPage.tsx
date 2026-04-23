import { useCallback, useEffect, useRef, useState } from "react";
import {
  DisplayContent,
  REF_WIDTH,
  REF_HEIGHT,
  type DisplayContentEvent,
} from "@/components/display/DisplayContent";

interface ContentEvent extends DisplayContentEvent {
  line_index?: number;
  duration_secs?: number;
  slide_index?: number;
  total_slides?: number;
  background_url?: string;
  background_type?: string;
}

const WS_URL = "ws://127.0.0.1:9000";
const RECONNECT_DELAY_MS = 2000;
const AUTO_ADVANCE_SECS = 6;
const LINES_PER_CHUNK = 2;

function splitLyrics(lyrics: string): string[] {
  const chunks: string[] = [];
  let current: string[] = [];
  let lyricLineCount = 0;

  for (const rawLine of lyrics.split("\n")) {
    const line = rawLine.trim();
    const isSectionHeader =
      /^\[.*\]$/.test(line) ||
      /^(verse|chorus|bridge|pre-chorus|prechorus|intro|outro|tag)\b/i.test(
        line,
      );

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
  const [backgroundValue, setBackgroundValue] = useState<string | null>(null);
  const [backgroundType, setBackgroundType] = useState<string | null>(null);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const advanceLyric = () => {
    if (chunkIndex + 1 < lyricChunks.length) {
      setChunkIndex(chunkIndex + 1);
    }
  };

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

  useEffect(() => {
    if (lyricChunks.length === 0) return;
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
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
            setBackgroundValue(event.background_url || null);
            setBackgroundType(event.background_type || null);
            return;
          }

          if (event.kind === "song") {
            const chunks = splitLyrics(event.text);
            setLyricChunks(chunks);
            setChunkIndex(event.line_index ?? 0);
            setCountdownSecs(null);
            if (countdownInterval.current)
              clearInterval(countdownInterval.current);
            setContent(event);
          } else if (event.kind === "song_advance") {
            setChunkIndex(event.line_index ?? 0);
          } else if (event.kind === "countdown") {
            setLyricChunks([]);
            setChunkIndex(0);
            if (autoAdvanceTimer.current)
              clearTimeout(autoAdvanceTimer.current);
            setContent(event);
            startCountdown(event.duration_secs ?? 60);
          } else if (event.kind === "sermon_note") {
            // Ignore on projection display
          } else if (event.kind === "clear") {
            setLyricChunks([]);
            setChunkIndex(0);
            setCountdownSecs(null);
            if (autoAdvanceTimer.current)
              clearTimeout(autoAdvanceTimer.current);
            if (countdownInterval.current)
              clearInterval(countdownInterval.current);
            setContent(null);
          } else {
            setLyricChunks([]);
            setChunkIndex(0);
            setCountdownSecs(null);
            if (autoAdvanceTimer.current)
              clearTimeout(autoAdvanceTimer.current);
            if (countdownInterval.current)
              clearInterval(countdownInterval.current);
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
  const currentChunk =
    isSong && lyricChunks.length > 0 ? (lyricChunks[chunkIndex] ?? "") : null;

  // Scale to fill the entire viewport — stretch independently on X and Y
  // so the content covers the full display regardless of aspect ratio.
  const [scaleX, setScaleX] = useState(() => window.innerWidth / REF_WIDTH);
  const [scaleY, setScaleY] = useState(() => window.innerHeight / REF_HEIGHT);

  useEffect(() => {
    const update = () => {
      setScaleX(window.innerWidth / REF_WIDTH);
      setScaleY(window.innerHeight / REF_HEIGHT);
    };
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div
      data-qa="display-root"
      className="fixed inset-0 overflow-hidden bg-[#050403] font-sans"
    >
      <div
        style={{
          width: REF_WIDTH,
          height: REF_HEIGHT,
          transform: `scale(${scaleX}, ${scaleY})`,
          transformOrigin: "top left",
        }}
      >
        <DisplayContent
          content={content}
          backgroundValue={backgroundValue}
          backgroundType={backgroundType}
          currentChunk={currentChunk}
          totalChunks={lyricChunks.length}
          chunkIndex={chunkIndex}
          countdownSecs={countdownSecs}
          onAdvanceLyric={advanceLyric}
        />
      </div>
      <div data-qa="display-idle" className="hidden" aria-hidden={connected} />
    </div>
  );
}
