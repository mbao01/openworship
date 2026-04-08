import { useCallback, useEffect, useRef, useState } from "react";

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

  // Lyric context lines for opacity hierarchy (Stitch design: past=30%, adjacent=50%, active=100%)
  function lyricContentLines(chunk: string): string[] {
    return chunk.split("\n").filter((l) => {
      const t = l.trim();
      return (
        t !== "" &&
        !/^\[.*\]$/.test(t) &&
        !/^(verse|chorus|bridge|pre-chorus|prechorus|intro|outro|tag)\b/i.test(t)
      );
    });
  }
  const prevContextLine = (() => {
    if (!isSong || chunkIndex <= 0) return null;
    const lines = lyricContentLines(lyricChunks[chunkIndex - 1] ?? "");
    return lines.length > 0 ? lines[lines.length - 1]! : null;
  })();
  const nextContextLine =
    isSong && chunkIndex < lyricChunks.length - 1
      ? lyricContentLines(lyricChunks[chunkIndex + 1] ?? "")[0] ?? null
      : null;

  // Format mm:ss for countdown
  const fmtCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div data-qa="display-root" className="fixed inset-0 bg-void overflow-hidden font-sans">
      {content ? (
        <>
          {isSong ? (
            <>
              {/* Song title header — fixed at top-left per Stitch design */}
              <div className="absolute top-[8vh] left-[10%]">
                <span className="block font-sans text-xl font-medium tracking-[0.15em] [font-variant:small-caps] text-gold">
                  {content.reference}
                </span>
              </div>

              {/* Lyric stack with opacity hierarchy */}
              <div
                data-qa="display-content"
                className="absolute top-[25%] left-[10%] w-[60vw] flex flex-col gap-4 cursor-pointer outline-none"
                onClick={() => advanceLyric(lyricChunks, chunkIndex)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === " " && advanceLyric(lyricChunks, chunkIndex)}
                aria-label="Next lyric"
              >
                {/* Previous context line — 30% opacity */}
                {prevContextLine && (
                  <p className="m-0 font-serif text-[2.4rem] leading-[1.2] text-chalk text-left opacity-30 select-none">
                    {prevContextLine}
                  </p>
                )}

                {/* Active chunk lines — full opacity, large */}
                {(currentChunk ?? "").split("\n").map((line, i) => {
                  const isHeader =
                    /^\[.*\]$/.test(line.trim()) ||
                    /^(verse|chorus|bridge|pre-chorus|prechorus|intro|outro|tag)\b/i.test(
                      line.trim()
                    );
                  return isHeader ? (
                    <p key={i} className="m-0 font-sans text-[0.85rem] font-medium tracking-[0.18em] uppercase text-smoke">
                      {line || "\u00A0"}
                    </p>
                  ) : (
                    <p key={i} className="m-0 font-serif text-[clamp(2.8rem,5vw,5rem)] font-semibold leading-[1.2] text-chalk text-left">
                      {line || "\u00A0"}
                    </p>
                  );
                })}

                {/* Next context line — 50% opacity */}
                {nextContextLine && (
                  <p className="m-0 font-serif text-[2.4rem] leading-[1.2] text-chalk text-left opacity-50 select-none">
                    {nextContextLine}
                  </p>
                )}
              </div>

              {/* Progress indicator */}
              {lyricChunks.length > 1 && (
                <span
                  className="absolute bottom-6 right-[10%] font-sans text-[0.7rem] tracking-[0.12em] text-smoke opacity-60"
                  aria-hidden="true"
                >
                  {chunkIndex + 1} / {lyricChunks.length}
                </span>
              )}
            </>
          ) : (
        <div data-qa="display-content" className="absolute top-1/2 left-[10%] -translate-y-1/2 max-w-[55vw]">
          {isCountdown ? (
            <div className="flex flex-col items-start gap-4">
              {content.reference && (
                <span className="font-sans text-xl font-medium tracking-[0.12em] [font-variant:small-caps] text-gold">
                  {content.reference}
                </span>
              )}
              <span
                className={`font-mono text-[clamp(6rem,14vw,14rem)] font-semibold leading-none tracking-[0.05em] transition-colors duration-500 ${
                  (countdownSecs ?? 0) <= 10 ? "text-ember" : "text-chalk"
                }`}
              >
                {fmtCountdown(countdownSecs ?? 0)}
              </span>
            </div>
          ) : isAnnouncement ? (
            <div className="flex flex-col gap-4">
              {content.image_url && (
                <img
                  className="max-w-[40vw] max-h-[35vh] object-contain rounded-sm mb-2"
                  src={content.image_url}
                  alt=""
                />
              )}
              <span className="font-sans text-[clamp(1.5rem,3vw,3rem)] font-semibold tracking-[0.08em] text-gold">
                {content.reference}
              </span>
              {content.text && (
                <p className="m-0 font-sans text-[clamp(1.8rem,3.5vw,4rem)] font-normal leading-[1.3] text-chalk">
                  {content.text}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="mb-6">
                <span className="block font-sans text-xl font-medium tracking-[0.15em] [font-variant:small-caps] text-gold">
                  {content.reference}
                </span>
                {content.translation && (
                  <span className="block font-sans text-sm tracking-widest text-ash font-normal mt-1">
                    {content.translation}
                  </span>
                )}
              </div>
              <p className="m-0 font-serif text-[clamp(3rem,6vw,6rem)] font-semibold italic leading-[1.15] text-chalk text-left">
                {content.text}
              </p>
            </>
          )}
        </div>
          )}
        </>
      ) : (
        <div data-qa="display-idle" className="hidden" aria-hidden={connected} />
      )}
      <span data-qa="display-watermark" className="absolute bottom-6 left-[10%] font-sans text-xs tracking-[0.2em] text-smoke lowercase select-none">
        openworship
      </span>
    </div>
  );
}
