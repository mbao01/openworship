import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  BookOpenIcon,
  CircleIcon,
  CornerDownLeftIcon,
  MusicIcon,
  PresentationIcon,
} from "lucide-react";
import { useQueue } from "../../hooks/use-queue";
import { useTranslations } from "../../hooks/use-translations";
import type { DetectionMode, QueueItem, TranscriptEvent, VerseResult, Song, AnnouncementItem } from "../../lib/types";
import { toastError } from "../../lib/toast";
import { listAnnouncements, pushAnnouncementToDisplay } from "../../lib/commands/annotations";

interface LiveScreenProps {
  mode: DetectionMode;
}

export function LiveScreen({ mode }: LiveScreenProps) {
  return (
    <>
      <LibraryPanel />
      <StagePanel mode={mode} />
      <QueueTranscriptPanel />
    </>
  );
}

// ─── Library Panel (left, 280px) ─────────────────────────────────────────────

function LibraryPanel() {
  const [tab, setTab] = useState<"scripture" | "lyrics" | "slides">("scripture");
  const [query, setQuery] = useState("");
  const [scriptureResults, setScriptureResults] = useState<VerseResult[]>([]);
  const [songResults, setSongResults] = useState<Song[]>([]);
  const [slides, setSlides] = useState<AnnouncementItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (tab === "slides") {
      listAnnouncements().then(setSlides).catch(() => {});
    }
  }, [tab]);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setScriptureResults([]);
      setSongResults([]);
      return;
    }
    setIsSearching(true);
    try {
      if (tab === "scripture") {
        const res = await invoke<VerseResult[]>("search_scriptures", { query: q, translation: null });
        setScriptureResults(res);
      } else if (tab === "lyrics") {
        const res = await invoke<Song[]>("search_songs", { query: q, limit: 20 });
        setSongResults(res);
      }
    } catch {
      // silent
    } finally {
      setIsSearching(false);
    }
  }, [tab]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), 220);
  };

  const handlePush = async (reference: string, text: string, translation: string) => {
    try {
      await invoke("push_to_display", { reference, text, translation });
    } catch (e) {
      toastError("Failed to push to display")(e);
    }
  };

  const handlePushSong = async (song: Song) => {
    try {
      await invoke("push_song_to_display", { id: song.id });
    } catch (e) {
      toastError("Failed to push song")(e);
    }
  };

  const tabs = [
    { id: "scripture" as const, label: "Scripture", count: "31k" },
    { id: "lyrics" as const, label: "Lyrics", count: "" },
    { id: "slides" as const, label: "Slides", count: "" },
  ];

  const placeholder =
    tab === "scripture" ? "Romans 8:38\u2026" :
    tab === "lyrics" ? "song title, opening line\u2026" :
    "slide title\u2026";

  return (
    <section className="flex flex-col w-[280px] shrink-0 bg-bg border-r border-line overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 h-9 shrink-0 border-b border-line bg-bg-1">
        <span className="font-mono text-[10px] text-ink-3 tracking-[0.14em] uppercase">Library</span>
        <button className="w-[22px] h-[22px] flex items-center justify-center rounded-[3px] text-ink-3 text-[13px] hover:bg-bg-3 hover:text-ink">
          +
        </button>
      </div>

      {/* Tabs */}
      <div className="flex px-2 border-b border-line bg-bg-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`px-3 py-2.5 font-mono text-[9.5px] tracking-[0.12em] uppercase mb-[-1px] border-b transition-colors ${
              tab === t.id
                ? "text-ink border-accent"
                : "text-ink-3 border-transparent hover:text-ink-2"
            }`}
            onClick={() => { setTab(t.id); setQuery(""); setScriptureResults([]); setSongResults([]); }}
          >
            {t.label}
            {t.count && <span className="ml-1.5 text-muted text-[9px]">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-3 py-2.5 border-b border-line">
        <input
          className="w-full px-2.5 py-[7px] bg-bg-2 border border-line rounded-[3px] text-ink text-xs focus:border-line-strong"
          placeholder={placeholder}
          value={query}
          onChange={handleQueryChange}
        />
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--color-bg-3)_transparent]">
        {tab === "scripture" && scriptureResults.map((v, i) => (
          <div
            key={`${v.translation}-${v.reference}-${i}`}
            className="grid grid-cols-[20px_1fr_auto] gap-2.5 px-3.5 py-2 items-center border-b border-transparent text-ink-2 cursor-pointer transition-colors hover:bg-bg-2 hover:text-ink"
            onClick={() => handlePush(v.reference, v.text, v.translation)}
          >
            <span className="text-accent flex items-center justify-center"><BookOpenIcon className="w-3.5 h-3.5 shrink-0" /></span>
            <div>
              <div className="font-serif italic text-sm">{v.reference}</div>
              <div className="font-mono text-[9.5px] text-ink-3 tracking-[0.06em]">{v.translation}</div>
            </div>
            <span className="text-ink-3 flex items-center"><CornerDownLeftIcon className="w-3.5 h-3.5 shrink-0" /></span>
          </div>
        ))}

        {tab === "lyrics" && songResults.map((s) => (
          <div
            key={s.id}
            className="grid grid-cols-[20px_1fr_auto] gap-2.5 px-3.5 py-2 items-center border-b border-transparent text-ink-2 cursor-pointer transition-colors hover:bg-bg-2 hover:text-ink"
            onClick={() => handlePushSong(s)}
          >
            <span className="text-accent flex items-center justify-center"><MusicIcon className="w-3.5 h-3.5 shrink-0" /></span>
            <div>
              <div className="font-medium text-sm">{s.title}</div>
              {s.artist && <div className="font-mono text-[9.5px] text-ink-3 tracking-[0.06em]">{s.artist}</div>}
            </div>
            <span className="text-ink-3 flex items-center"><CornerDownLeftIcon className="w-3.5 h-3.5 shrink-0" /></span>
          </div>
        ))}

        {tab === "slides" && slides.length > 0 && slides.map((slide) => (
          <div
            key={slide.id}
            className="grid grid-cols-[20px_1fr_auto] gap-2.5 px-3.5 py-2 items-center border-b border-transparent text-ink-2 cursor-pointer transition-colors hover:bg-bg-2 hover:text-ink"
            onClick={() => pushAnnouncementToDisplay(slide.id).catch(toastError("Failed to push slide"))}
          >
            <span className="text-accent flex items-center justify-center"><PresentationIcon className="w-3.5 h-3.5 shrink-0" /></span>
            <div>
              <div className="font-medium text-sm">{slide.title}</div>
              {slide.body && <div className="font-mono text-[9.5px] text-ink-3 tracking-[0.06em] line-clamp-1">{slide.body}</div>}
            </div>
            <span className="text-ink-3 flex items-center"><CornerDownLeftIcon className="w-3.5 h-3.5 shrink-0" /></span>
          </div>
        ))}

        {tab === "slides" && slides.length === 0 && (
          <div className="px-3.5 py-6 text-center text-xs text-muted">
            No slides loaded
          </div>
        )}

        {query.trim() && !isSearching && scriptureResults.length === 0 && songResults.length === 0 && tab !== "slides" && (
          <div className="px-3.5 py-6 text-center text-xs text-muted">
            No results for &ldquo;{query}&rdquo;
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Stage Panel (center, flex-1) ────────────────────────────────────────────

function StagePanel({ mode }: { mode: DetectionMode }) {
  const { queue, live, approve, skip, clearLive, rejectLive } = useQueue();
  const { translations, active: activeTranslation, setActive: setActiveTranslation } = useTranslations();
  const pending = queue[0] ?? null;

  return (
    <section className="flex-1 flex flex-col bg-bg overflow-hidden">
      {/* Note strip */}
      <div className="flex justify-between items-center px-3.5 py-1.5 font-mono text-[9.5px] tracking-[0.12em] uppercase text-ink-3 bg-bg-1 border-b border-line">
        <span>
          <span className="inline-block w-[5px] h-[5px] rounded-full bg-accent mr-1.5" />
          {mode.toUpperCase()} MODE · listening · rolling 10s context
        </span>
        <span>DISPLAY OUTPUT · 1920 × 1080</span>
      </div>

      {/* Dual display preview */}
      <div className="flex-1 p-4 flex items-center justify-center overflow-hidden" style={{
        background: "repeating-linear-gradient(45deg, var(--color-bg-1) 0 1px, transparent 1px 10px), var(--color-bg)",
      }}>
        <div className="w-full max-w-[760px] h-full flex flex-col gap-3.5 justify-center">
          {/* LIVE screen */}
          <DisplayScreen label="LIVE" labelColor="inherit" item={live} />
          {/* PREVIEW screen */}
          <DisplayScreen label="PREVIEW" labelColor="rgba(201,167,106,0.75)" item={pending} dimmed />
        </div>
      </div>

      {/* Stage toolbar */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-t border-line bg-bg-1 h-[52px] shrink-0">
        <div className="flex gap-1">
          <span className="relative inline-flex items-center gap-1.5 px-[11px] py-[7px] font-mono text-[9.5px] tracking-[0.1em] uppercase text-white bg-live border border-live rounded-[3px]">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-[blink_1.4s_infinite]" />
            LIVE
          </span>
        </div>
        <div className="flex gap-1 pl-2.5 ml-1.5 border-l border-line">
          <StageBtn
            primary
            label="Push next"
            kbd="Space"
            onClick={() => pending && approve(pending.id).catch(toastError("Failed to approve"))}
            disabled={!pending}
          />
          <StageBtn label="Skip" kbd="X" onClick={() => pending && skip(pending.id).catch(toastError("Failed to skip"))} disabled={!pending} />
          <StageBtn label="Not this one" kbd="N" onClick={() => rejectLive().catch(toastError("Failed to reject"))} />
        </div>
        <div className="flex gap-1 pl-2.5 ml-1.5 border-l border-line">
          <StageBtn label="Black" kbd="B" onClick={() => clearLive().catch(toastError("Failed to clear"))} />
          <StageBtn label="Clear" onClick={() => clearLive().catch(toastError("Failed to clear"))} />
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-bg-2 border border-line rounded-[3px] font-mono text-[10px] tracking-[0.1em] uppercase text-ink-2">
          Translation
          <select
            className="bg-transparent border-0 text-accent font-mono text-[10px] tracking-[0.1em] uppercase p-0 outline-0 cursor-pointer"
            value={activeTranslation}
            onChange={(e) => setActiveTranslation(e.target.value).catch(toastError("Failed to switch translation"))}
          >
            {translations.map((t) => (
              <option key={t.id} value={t.id} className="bg-bg-2">{t.abbreviation}</option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}

function DisplayScreen({ label, labelColor, item, dimmed }: {
  label: string;
  labelColor: string;
  item: QueueItem | null;
  dimmed?: boolean;
}) {
  const isSong = item?.kind === "song";
  const isLive = label === "LIVE";
  const marker = isLive
    ? <CircleIcon className="w-3 h-3 shrink-0 inline" fill="currentColor" />
    : <CircleIcon className="w-3 h-3 shrink-0 inline" />;
  const sublabel = isLive ? "ON SCREEN" : "CUED NEXT";

  return (
    <div
      className={`relative w-full aspect-video bg-[#050403] text-[#F5EFDF] px-11 py-8 flex flex-col justify-center border border-line-strong overflow-hidden ${
        dimmed ? "opacity-[0.78] hover:opacity-[0.92] border-[rgba(201,167,106,0.35)]" : ""
      }`}
      style={{
        boxShadow: dimmed
          ? "0 8px 24px -12px rgba(0,0,0,0.6), inset 0 0 80px rgba(0,0,0,0.7)"
          : "0 20px 60px -20px rgba(0,0,0,0.6), inset 0 0 120px rgba(0,0,0,0.6)",
      }}
    >
      {/* Label bar */}
      <div className="absolute top-0 left-0 right-0 px-4 py-2 flex justify-between font-mono text-[9.5px] tracking-[0.18em] uppercase" style={{ color: dimmed ? labelColor : "rgba(245,239,223,0.5)" }}>
        <span className="inline-flex items-center gap-1">{marker} {label} · {sublabel}</span>
        <span>openworship</span>
      </div>

      {item ? (
        <>
          {!isSong && (
            <>
              <div className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-accent mb-3" style={dimmed ? { color: "rgba(201,167,106,0.6)" } : undefined}>
                {item.reference} · {item.translation}
              </div>
              <div
                className="font-serif italic leading-[1.35] tracking-[-0.01em] max-w-[48ch]"
                style={{
                  fontSize: "clamp(15px, 1.7vw, 22px)",
                  color: dimmed ? "rgba(245,239,223,0.72)" : "#F5EFDF",
                }}
              >
                &ldquo;{item.text}&rdquo;
              </div>
            </>
          )}
          {isSong && (
            <div className="font-serif text-center w-full" style={{ fontSize: "clamp(15px, 1.7vw, 22px)" }}>
              <div>{item.reference}</div>
            </div>
          )}
        </>
      ) : (
        <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-center w-full text-[#3A332C]">
          — {isLive ? "no content" : "nothing cued"} —
        </div>
      )}
    </div>
  );
}

function StageBtn({ label, kbd, primary, onClick, disabled, danger }: {
  label: string;
  kbd?: string;
  primary?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  let cls = "inline-flex items-center gap-1.5 px-[11px] py-[7px] font-mono text-[9.5px] tracking-[0.1em] uppercase border rounded-[3px] transition-colors";
  if (primary) {
    cls += " bg-accent text-[#1A0D00] border-accent font-semibold hover:bg-accent-hover";
  } else if (danger) {
    cls += " text-danger border-danger bg-bg-2 hover:bg-bg-3";
  } else {
    cls += " text-ink-2 border-line bg-bg-2 hover:bg-bg-3 hover:text-ink hover:border-line-strong";
  }
  if (disabled) cls += " opacity-40 pointer-events-none";

  return (
    <button className={cls} onClick={onClick} disabled={disabled}>
      {label}
      {kbd && (
        <kbd className={`font-mono text-[8.5px] px-1 py-px rounded-sm ${
          primary ? "bg-black/20 text-black/60" : "bg-bg-4 text-ink-3"
        }`}>
          {kbd}
        </kbd>
      )}
    </button>
  );
}

// ─── Queue + Transcript Panel (right, 340px) ─────────────────────────────────

function QueueTranscriptPanel() {
  const { queue, live, approve, skip } = useQueue();
  const visible = [...(live ? [live] : []), ...queue].slice(0, 10);

  return (
    <section className="flex flex-col w-[340px] shrink-0 border-l border-line overflow-hidden">
      {/* Queue */}
      <div className="flex items-center justify-between px-3.5 h-9 shrink-0 border-b border-line bg-bg-1">
        <span className="font-mono text-[10px] text-ink-3 tracking-[0.14em] uppercase">
          Queue · <strong className="text-ink-2 font-medium">AI-detected</strong>
        </span>
        <span className="font-mono text-[10px] text-ink-3">{visible.length} items</span>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Queue items (top half) */}
        <div className="flex-[0_0_auto] max-h-[50%] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--color-bg-3)_transparent]">
          {visible.map((item) => (
            <QueueItemCard
              key={item.id}
              item={item}
              onApprove={() => approve(item.id).catch(toastError("Failed to approve"))}
              onReject={() => skip(item.id).catch(toastError("Failed to reject"))}
            />
          ))}
          {visible.length === 0 && (
            <div className="px-3.5 py-6 text-center text-xs text-muted">No detections yet</div>
          )}
        </div>

        {/* Transcript */}
        <div className="flex items-center justify-between px-3.5 h-9 shrink-0 border-t border-line border-b border-line bg-bg-1">
          <span className="font-mono text-[10px] text-ink-3 tracking-[0.14em] uppercase">
            Transcript · <strong className="text-ink-2 font-medium">live</strong>
          </span>
          <span className="font-mono text-[10px] text-ink-3">10s</span>
        </div>
        <TranscriptBody />
      </div>
    </section>
  );
}

function QueueItemCard({ item, onApprove, onReject }: {
  item: QueueItem;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isLive = item.status === "live";
  const isNext = item.status === "pending" && !isLive;
  const confidencePct = item.confidence != null ? Math.round(item.confidence * 100) : null;
  const tagLabel = isLive ? `On screen${confidencePct != null ? ` · ${confidencePct}%` : ""}` :
                   isNext ? `Next${confidencePct != null ? ` · ${confidencePct}%` : ""}` :
                   `Detected${confidencePct != null ? ` · ${confidencePct}%` : ""}`;

  return (
    <div className={`relative px-3.5 py-3 border-b border-line cursor-pointer transition-colors hover:bg-bg-2 ${isLive ? "bg-bg-2" : ""}`}>
      {isLive && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-live" />}
      {isNext && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent" />}

      <div className="flex justify-between items-baseline mb-1.5">
        <span className={`font-mono text-[9.5px] tracking-[0.14em] uppercase ${
          isLive ? "text-live" : isNext ? "text-accent" : "text-ink-3"
        }`}>
          {tagLabel}
        </span>
        {confidencePct != null && (
          <span className="font-mono text-[10px] text-ink-2">
            <strong className="text-accent font-semibold">{confidencePct}</strong>%
          </span>
        )}
      </div>

      <div className="font-serif italic text-base text-ink mb-1 tracking-[-0.005em]">
        {item.reference}
      </div>
      <div className="text-[11.5px] text-ink-3 font-serif leading-[1.4] mb-2 line-clamp-2">
        {item.text}
      </div>

      {/* Confidence bar */}
      {confidencePct != null && (
        <div className={`relative h-0.5 bg-line mt-1.5 ${isLive ? "" : ""}`}>
          <div
            className={`absolute inset-0 ${isLive ? "bg-live" : "bg-accent"}`}
            style={{ width: `${confidencePct}%` }}
          />
        </div>
      )}

      {/* Actions */}
      {!isLive && (
        <div className="flex gap-1.5 mt-2">
          <button
            className="px-2.5 py-1 font-mono text-[9px] tracking-[0.1em] uppercase border border-accent text-accent rounded-[3px] bg-bg-1 transition-colors hover:bg-accent hover:text-[#1A0D00]"
            onClick={(e) => { e.stopPropagation(); onApprove(); }}
          >
            Push
          </button>
          <button
            className="px-2.5 py-1 font-mono text-[9px] tracking-[0.1em] uppercase border border-line text-ink-2 rounded-[3px] bg-bg-1 transition-colors hover:bg-bg-3 hover:text-ink"
            onClick={(e) => { e.stopPropagation(); onReject(); }}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

function TranscriptBody() {
  const [entries, setEntries] = useState<{ id: number; text: string; offset_ms: number }[]>([]);
  const [micActive, setMicActive] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    listen<TranscriptEvent>("stt://transcript", (event) => {
      const evt = event.payload;
      setMicActive(evt.mic_active);
      setEntries((prev) => {
        const newEntry = { id: ++idRef.current, text: evt.text, offset_ms: evt.offset_ms };
        const cutoff = evt.offset_ms - 10000;
        return [...prev.filter((e) => e.offset_ms >= cutoff), newEntry];
      });
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  const fmt = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3.5 font-serif text-[15px] leading-[1.55] text-ink-3 tracking-[-0.003em] [scrollbar-width:thin] [scrollbar-color:var(--color-bg-3)_transparent]">
      {entries.map((entry, i) => {
        const isCurrent = i === entries.length - 1;
        return (
          <div key={entry.id} className={`mb-2.5 ${isCurrent ? "text-ink italic" : ""}`}>
            <span className="font-mono text-[9px] text-muted tracking-[0.08em] uppercase mr-2">
              {fmt(entry.offset_ms)}
            </span>
            {entry.text}
          </div>
        );
      })}
      {entries.length === 0 && (
        <div className="text-muted italic">· {micActive ? "listening" : "mic off"} ·</div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
