import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  BookOpenIcon,
  CircleIcon,
  CornerDownLeftIcon,
  MicIcon,
  MicOffIcon,
  MusicIcon,
  PaperclipIcon,
  PlayIcon,
  PresentationIcon,
  SearchIcon,
} from "lucide-react";
import { startStt, stopStt, getSttStatus } from "../../lib/commands/audio";
import { searchScriptures, pushToDisplay } from "../../lib/commands/content";
import { addItemToActiveProject } from "../../lib/commands/projects";
import {
  listRecentArtifacts,
  readThumbnail,
} from "../../lib/commands/artifacts";
import { useQueue } from "../../hooks/use-queue";
import { useTranslations } from "../../hooks/use-translations";
import type {
  ArtifactEntry,
  DetectionMode,
  QueueItem,
  TranscriptEvent,
  VerseResult,
  Song,
  AnnouncementItem,
} from "../../lib/types";
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
      {/* Library – top half */}
      <div className="flex flex-col h-1/2 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 h-9 shrink-0 border-b border-line bg-bg-1">
          <span className="font-mono text-[10px] text-ink-3 tracking-[0.14em] uppercase">
            Library
          </span>
        </div>

        {/* Tabs */}
        <div className="flex px-2 border-b border-line bg-bg-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`px-3 py-2.5 font-mono text-[9.5px] tracking-[0.12em] uppercase mb-[-1px] border-b transition-colors cursor-pointer ${
                tab === t.id
                  ? "text-ink border-accent"
                  : "text-ink-3 border-transparent hover:text-ink-2"
              }`}
              onClick={() => {
                setTab(t.id);
                setQuery("");
                setScriptureResults([]);
                setSongResults([]);
              }}
            >
              {t.label}
              {t.count && (
                <span className="ml-1.5 text-muted text-[9px]">{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-3 py-2.5 border-b border-line">
          <input
            className="w-full px-2.5 py-[7px] bg-bg-2 border border-line rounded text-ink text-xs focus:border-line-strong"
            placeholder={placeholder}
            value={query}
            onChange={handleQueryChange}
          />
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {tab === "scripture" &&
            scriptureResults.map((v, i) => (
              <div
                key={`${v.translation}-${v.reference}-${i}`}
                className="grid grid-cols-[20px_1fr_auto] gap-2.5 px-3.5 py-2 items-center border-b border-transparent text-ink-2 cursor-pointer transition-colors hover:bg-bg-2 hover:text-ink"
                onClick={() => handlePush(v.reference, v.text, v.translation)}
              >
                <span className="text-accent flex items-center justify-center">
                  <BookOpenIcon className="w-3.5 h-3.5 shrink-0" />
                </span>
                <div>
                  <div className="font-serif italic text-sm">{v.reference}</div>
                  <div className="font-mono text-[9.5px] text-ink-3 tracking-[0.06em]">
                    {v.translation}
                  </div>
                </div>
                <span className="text-ink-3 flex items-center">
                  <CornerDownLeftIcon className="w-3.5 h-3.5 shrink-0" />
                </span>
              </div>
            ))}

          {tab === "lyrics" &&
            songResults.map((s) => (
              <div
                key={s.id}
                className="grid grid-cols-[20px_1fr_auto] gap-2.5 px-3.5 py-2 items-center border-b border-transparent text-ink-2 cursor-pointer transition-colors hover:bg-bg-2 hover:text-ink"
                onClick={() => handlePushSong(s)}
              >
                <span className="text-accent flex items-center justify-center">
                  <MusicIcon className="w-3.5 h-3.5 shrink-0" />
                </span>
                <div>
                  <div className="font-medium text-sm">{s.title}</div>
                  {s.artist && (
                    <div className="font-mono text-[9.5px] text-ink-3 tracking-[0.06em]">
                      {s.artist}
                    </div>
                  )}
                </div>
                <span className="text-ink-3 flex items-center">
                  <CornerDownLeftIcon className="w-3.5 h-3.5 shrink-0" />
                </span>
              </div>
            ))}

          {tab === "slides" &&
            slides.length > 0 &&
            slides.map((slide) => (
              <div
                key={slide.id}
                className="grid grid-cols-[20px_1fr_auto] gap-2.5 px-3.5 py-2 items-center border-b border-transparent text-ink-2 cursor-pointer transition-colors hover:bg-bg-2 hover:text-ink"
                onClick={() =>
                  pushAnnouncementToDisplay(slide.id).catch(
                    toastError("Failed to push slide"),
                  )
                }
              >
                <span className="text-accent flex items-center justify-center">
                  <PresentationIcon className="w-3.5 h-3.5 shrink-0" />
                </span>
                <div>
                  <div className="font-medium text-sm">{slide.title}</div>
                  {slide.body && (
                    <div className="font-mono text-[9.5px] text-ink-3 tracking-[0.06em] line-clamp-1">
                      {slide.body}
                    </div>
                  )}
                </div>
                <span className="text-ink-3 flex items-center">
                  <CornerDownLeftIcon className="w-3.5 h-3.5 shrink-0" />
                </span>
              </div>
            ))}

          {tab === "slides" && slides.length === 0 && (
            <div className="px-3.5 py-6 flex flex-col items-center justify-center gap-2 text-xs text-muted">
              <PresentationIcon className="w-5 h-5" />
              No slides loaded
            </div>
          )}

          {query.trim() &&
            !isSearching &&
            scriptureResults.length === 0 &&
            songResults.length === 0 &&
            tab !== "slides" && (
              <div className="px-3.5 py-6 text-center text-xs text-muted">
                No results for &ldquo;{query}&rdquo;
              </div>
            )}
        </div>
      </div>

      {/* Assets – bottom half */}
      <AssetsPanel />
    </section>
  );
}

function ThumbnailImage({
  artifactId,
  thumbnailPath,
  className,
}: {
  artifactId: string;
  thumbnailPath: string | null;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!thumbnailPath) return;
    let revoked = false;
    let url: string | null = null;
    readThumbnail(artifactId)
      .then((bytes) => {
        if (revoked) return;
        const blob = new Blob([new Uint8Array(bytes)], { type: "image/jpeg" });
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => setSrc(null));
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [artifactId, thumbnailPath]);

  if (!thumbnailPath || !src) {
    return null;
  }
  return (
    <img
      src={src}
      alt=""
      className={className || "w-full h-full object-cover rounded"}
    />
  );
}

function AssetsPanel() {
  const [assets, setAssets] = useState<ArtifactEntry[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [assetQuery, setAssetQuery] = useState("");

  useEffect(() => {
    listRecentArtifacts(50)
      .then(setAssets)
      .catch(() => {});
  }, []);

  const filtered = (
    assetQuery.trim()
      ? assets.filter((a) =>
          a.name.toLowerCase().includes(assetQuery.toLowerCase()),
        )
      : assets
  ).filter(
    (a) => a.name !== "_thumbnails" && !a.path.includes("/_thumbnails/"),
  );

  const handlePushAsset = async (asset: ArtifactEntry) => {
    try {
      await invoke("push_artifact_to_display", { artifactId: asset.id });
    } catch (e) {
      toastError("Failed to push asset")(e);
    }
  };

  return (
    <div className="flex flex-col h-1/2 overflow-hidden border-t border-line">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 h-9 shrink-0 border-b border-line bg-bg-1">
        <span className="font-mono text-[10px] text-ink-3 tracking-[0.14em] uppercase">
          Assets
        </span>
        <button
          className="text-ink-3 hover:text-ink transition-colors cursor-pointer"
          onClick={() => setSearchOpen((v) => !v)}
        >
          <SearchIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search (toggled) */}
      {searchOpen && (
        <div className="px-3 py-2.5 border-b border-line">
          <input
            className="w-full px-2.5 py-[7px] bg-bg-2 border border-line rounded text-ink text-xs focus:border-line-strong"
            placeholder="Filter assets..."
            value={assetQuery}
            onChange={(e) => setAssetQuery(e.target.value)}
            autoFocus
          />
        </div>
      )}

      {/* Asset grid */}
      <div className="grid grid-cols-3 gap-1 p-2 overflow-y-auto">
        {filtered.map((asset) => (
          <div
            key={asset.id}
            className="group relative aspect-square bg-bg-2 rounded border border-line overflow-hidden"
          >
            {/* Thumbnail or icon */}
            {asset.thumbnail_path ? (
              <ThumbnailImage
                artifactId={asset.id}
                thumbnailPath={asset.thumbnail_path}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-ink-3">
                <PaperclipIcon className="w-5 h-5" />
              </div>
            )}
            {/* Name at bottom */}
            <div className="absolute bottom-0 left-0 right-0 bg-bg/80 px-1.5 py-0.5">
              <span className="text-[9px] text-ink truncate block">
                {asset.name}
              </span>
            </div>
            {/* Hover actions */}
            <div className="absolute top-0.5 right-0.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                className="p-1 rounded bg-bg/80 text-ink-3 hover:text-accent transition-colors cursor-pointer"
                title="Push to display"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePushAsset(asset);
                }}
              >
                <PlayIcon className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-2 px-3.5 py-6 text-center text-xs text-muted">
            {assetQuery.trim() ? "No matching assets" : "No recent assets"}
          </div>
        )}
      </div>
    </div>
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
        <span>DISPLAY OUTPUT</span>
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
          <span className="relative inline-flex items-center gap-1.5 px-[11px] py-[7px] font-mono text-[9.5px] tracking-[0.1em] uppercase text-white bg-live border border-live rounded">
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
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-bg-2 border border-line rounded font-mono text-[10px] tracking-[0.1em] uppercase text-ink-2">
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

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"]);
const VIDEO_EXTS = new Set(["mp4", "webm", "mov"]);
const AUDIO_EXTS = new Set(["mp3", "wav", "ogg"]);

function AssetRenderer({ artifactRef, filename }: { artifactRef: string; filename?: string }) {
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

  if (IMAGE_EXTS.has(ext)) {
    return <img src={src} alt="" className="max-w-full max-h-full object-contain" />;
  }
  if (VIDEO_EXTS.has(ext)) {
    return <video src={src} controls className="max-w-full max-h-full" />;
  }
  if (AUDIO_EXTS.has(ext)) {
    return (
      <div className="flex flex-col items-center gap-3">
        <MusicIcon className="w-12 h-12 text-accent" />
        <audio src={src} controls />
      </div>
    );
  }
  // PDF or other — show filename with icon
  return (
    <div className="flex flex-col items-center gap-2 text-ink-2">
      <PaperclipIcon className="w-10 h-10" />
      <span className="font-mono text-xs">{artifactId}</span>
    </div>
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
          {item.image_url?.startsWith("artifact:") ? (
            <div className="w-full h-full flex items-center justify-center">
              <AssetRenderer artifactRef={item.image_url} filename={item.reference} />
            </div>
          ) : !isSong ? (
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
          ) : (
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
  let cls = "inline-flex items-center gap-1.5 px-[11px] py-[7px] font-mono text-[9.5px] tracking-[0.1em] uppercase border rounded transition-colors cursor-pointer";
  if (primary) {
    cls += " bg-accent text-accent-foreground border-accent font-semibold hover:bg-accent-hover";
  } else if (danger) {
    cls += " text-danger border-danger bg-bg-2 hover:bg-bg-3";
  } else {
    cls += " text-ink-2 border-line bg-bg-2 hover:bg-bg-3 hover:text-ink hover:border-line-strong";
  }
  if (disabled) cls += " opacity-40 pointer-events-none cursor-not-allowed";

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
  const [micActive, setMicActive] = useState(false);

  useEffect(() => {
    getSttStatus().then(s => setMicActive(s === "running")).catch(() => {});
  }, []);

  const handleMicToggle = async () => {
    if (micActive) {
      await stopStt().catch(() => {});
      setMicActive(false);
    } else {
      await startStt().catch(() => {});
      setMicActive(true);
    }
  };

  return (
    <section className="flex flex-col w-[340px] shrink-0 border-l border-line overflow-hidden">
      {/* Queue */}
      <div className="flex items-center justify-between px-3.5 h-9 shrink-0 border-b border-line bg-bg-1">
        <span className="font-mono text-[10px] text-ink-3 tracking-[0.14em] uppercase">
          Queue ·{" "}
          <strong className="text-ink-2 font-medium">AI-detected</strong>
        </span>
        <span className="font-mono text-[10px] text-ink-3">
          {visible.length} items
        </span>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Queue items - equal third */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {visible.map((item) => (
            <QueueItemCard
              key={item.id}
              item={item}
              onApprove={() =>
                approve(item.id).catch(toastError("Failed to approve"))
              }
              onReject={() =>
                skip(item.id).catch(toastError("Failed to reject"))
              }
            />
          ))}
          {visible.length === 0 && (
            <div className="px-3.5 py-6 flex flex-col items-center justify-center gap-2 text-xs text-muted">
              <SearchIcon className="w-5 h-5" />
              No detections yet
            </div>
          )}
        </div>

        {/* Context panel - equal third */}
        <div className="flex flex-col flex-1 min-h-0">
          <ContextPanel live={live} />
        </div>

        {/* Transcript header */}
        <div className="flex items-center justify-between px-3.5 h-9 shrink-0 border-t border-line border-b border-line bg-bg-1">
          <span className="font-mono text-[10px] text-ink-3 tracking-[0.14em] uppercase">
            Transcript ·{" "}
            <strong className="text-ink-2 font-medium">live</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              className={`px-2 py-0.5 font-mono text-[9px] tracking-[0.1em] uppercase border rounded transition-colors cursor-pointer ${
                micActive
                  ? "text-live border-live/40 hover:bg-live/10"
                  : "text-ink-3 border-line hover:text-ink hover:border-line-strong"
              }`}
              onClick={handleMicToggle}
            >
              {micActive ? (
                <MicIcon className="w-3 h-3 shrink-0 inline mr-1" />
              ) : (
                <MicOffIcon className="w-3 h-3 shrink-0 inline mr-1" />
              )}
              {micActive ? "Stop" : "Start"}
            </button>
            <span className="font-mono text-[10px] text-ink-3">10s</span>
          </div>
        </div>

        {/* Transcript body - equal third */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <TranscriptBody />
        </div>
      </div>
    </section>
  );
}

function mergeVerses(verses: VerseResult[]): {
  reference: string;
  text: string;
  translation: string;
} {
  if (verses.length === 0) return { reference: "", text: "", translation: "" };
  if (verses.length === 1)
    return {
      reference: verses[0].reference,
      text: verses[0].text,
      translation: verses[0].translation,
    };
  const first = verses[0];
  const last = verses[verses.length - 1];
  const firstVerse = first.reference.split(":").pop() || "";
  const lastVerse = last.reference.split(":").pop() || "";
  const bookChapter = first.reference.split(":")[0];
  return {
    reference: `${bookChapter}:${firstVerse}-${lastVerse}`,
    text: verses.map((v) => v.text).join(" "),
    translation: first.translation,
  };
}

function ContextPanel({ live }: { live: QueueItem | null }) {
  const [contextVerses, setContextVerses] = useState<VerseResult[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(),
  );
  const lastClickedIndex = useRef<number | null>(null);

  useEffect(() => {
    if (!live || live.kind !== "scripture") {
      setContextVerses([]);
      setSelectedIndices(new Set());
      return;
    }
    // Extract book + chapter from reference (e.g. "Romans 8:38-39" → "Romans 8")
    const match = live.reference.match(/^(.+?)\s+(\d+)/);
    if (!match) return;
    const bookChapter = `${match[1]} ${match[2]}`;
    searchScriptures(bookChapter)
      .then((verses) => {
        verses.sort((a, b) => {
          const aNum = parseInt(a.reference.split(":").pop() || "0");
          const bNum = parseInt(b.reference.split(":").pop() || "0");
          return aNum - bNum;
        });
        setContextVerses(verses);
        setSelectedIndices(new Set());
      })
      .catch(() => setContextVerses([]));
  }, [live?.reference, live?.kind]);

  const contextLabel = live?.reference ?? "none";

  // Song sections
  const songSections: string[] = [];
  if (live?.kind === "song" && live.text) {
    const parts = live.text
      .split(
        /\n\n|\[(?:Verse|Chorus|Bridge|Pre-Chorus|Outro|Intro|Tag)[^\]]*\]/i,
      )
      .filter((s) => s.trim());
    songSections.push(...parts);
  }

  const handleVerseClick = (e: React.MouseEvent, index: number) => {
    const v = contextVerses[index];
    const isMeta = e.metaKey || e.ctrlKey;
    const isShift = e.shiftKey;

    if (isMeta) {
      // Toggle individual verse in selection
      setSelectedIndices((prev) => {
        const next = new Set(prev);
        if (next.has(index)) {
          next.delete(index);
        } else {
          next.add(index);
        }
        return next;
      });
      lastClickedIndex.current = index;
    } else if (isShift && lastClickedIndex.current !== null) {
      // Range select
      const start = Math.min(lastClickedIndex.current, index);
      const end = Math.max(lastClickedIndex.current, index);
      setSelectedIndices((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) {
          next.add(i);
        }
        return next;
      });
    } else {
      // Normal click → push to preview
      addItemToActiveProject(v.reference, v.text, v.translation).catch(
        toastError("Failed to add to preview"),
      );
      lastClickedIndex.current = index;
    }
  };

  const handlePushSelected = () => {
    const sorted = Array.from(selectedIndices).sort((a, b) => a - b);
    const verses = sorted.map((i) => contextVerses[i]);
    const merged = mergeVerses(verses);
    pushToDisplay(merged.reference, merged.text, merged.translation).catch(
      toastError("Failed to push to live"),
    );
    setSelectedIndices(new Set());
  };

  const handleQueueSelected = () => {
    const sorted = Array.from(selectedIndices).sort((a, b) => a - b);
    const verses = sorted.map((i) => contextVerses[i]);
    const merged = mergeVerses(verses);
    addItemToActiveProject(
      merged.reference,
      merged.text,
      merged.translation,
    ).catch(toastError("Failed to queue"));
    setSelectedIndices(new Set());
  };

  return (
    <>
      {/* Context header */}
      <div className="flex items-center justify-between px-3.5 h-9 shrink-0 border-t border-line border-b border-line bg-bg-1">
        <span className="font-mono text-[10px] text-ink-3 tracking-[0.14em] uppercase">
          Context ·{" "}
          <strong className="text-ink-2 font-medium">{contextLabel}</strong>
        </span>
      </div>

      {/* Context content */}
      <div className="relative flex-1 min-h-0 overflow-y-auto">
        {live?.kind === "scripture" &&
          contextVerses.map((v, i) => {
            const isActive = live.reference === v.reference;
            const isSelected = selectedIndices.has(i);
            return (
              <div
                key={`${v.reference}-${i}`}
                className={`group flex items-center gap-2 px-3.5 py-2 transition-colors cursor-pointer hover:bg-bg-2 ${
                  isSelected
                    ? "bg-accent-soft border-l-2 border-l-accent"
                    : isActive
                      ? "bg-accent-soft"
                      : ""
                }`}
                onClick={(e) => handleVerseClick(e, i)}
              >
                <span className="font-mono text-[9px] text-ink-3 shrink-0 w-5 text-right">
                  {v.reference.split(":").pop()}
                </span>
                <span className="flex-1 text-xs text-ink-2 leading-[1.4] line-clamp-2">
                  {v.text}
                </span>
                <button
                  type="button"
                  className="shrink-0 p-1.5 rounded text-ink-3 hover:text-accent hover:bg-accent-soft transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                  title="Push to live"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    pushToDisplay(v.reference, v.text, v.translation).catch(
                      toastError("Failed to push"),
                    );
                  }}
                >
                  <PlayIcon className="w-4 h-4" />
                </button>
              </div>
            );
          })}

        {live?.kind === "song" &&
          songSections.map((section, i) => (
            <div
              key={i}
              className="flex items-start gap-2 px-3.5 py-2 transition-colors hover:bg-bg-2"
            >
              <span className="flex-1 text-xs text-ink-2 leading-[1.5] whitespace-pre-line">
                {section.trim()}
              </span>
              <button
                className="shrink-0 p-1 rounded text-ink-3 hover:text-accent hover:bg-accent-soft transition-colors mt-0.5"
                title="Push to live"
                onClick={() =>
                  pushToDisplay(live.reference, section.trim(), "").catch(
                    toastError("Failed to push"),
                  )
                }
              >
                <PlayIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

        {(!live || (live.kind !== "scripture" && live.kind !== "song")) && (
          <div className="px-3.5 py-6 flex flex-col items-center justify-center gap-2 text-xs text-muted">
            <CircleIcon className="w-5 h-5" />
            No content on screen
          </div>
        )}

        {/* Multi-select action bar */}
        {selectedIndices.size >= 2 && (
          <div className="sticky bottom-0 flex items-center justify-between px-3.5 py-2 bg-bg-1 border-t border-line">
            <span className="text-xs text-ink-3">
              {selectedIndices.size} verses selected
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={handlePushSelected}
                className="px-2.5 py-1 font-mono text-[9px] tracking-[0.1em] uppercase border border-accent text-accent-foreground bg-accent rounded transition-colors hover:bg-accent-hover cursor-pointer"
              >
                Push to live
              </button>
              <button
                onClick={handleQueueSelected}
                className="px-2.5 py-1 font-mono text-[9px] tracking-[0.1em] uppercase border border-line text-ink-2 rounded bg-bg-2 transition-colors hover:bg-bg-3 hover:text-ink cursor-pointer"
              >
                Queue
              </button>
              <button
                onClick={() => setSelectedIndices(new Set())}
                className="px-2.5 py-1 font-mono text-[9px] tracking-[0.1em] uppercase text-ink-3 rounded transition-colors hover:text-ink hover:bg-bg-2 cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>
    </>
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
            className="px-2.5 py-1 font-mono text-[9px] tracking-[0.1em] uppercase border border-accent text-accent rounded bg-bg-1 transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onApprove(); }}
          >
            Push
          </button>
          <button
            className="px-2.5 py-1 font-mono text-[9px] tracking-[0.1em] uppercase border border-line text-ink-2 rounded bg-bg-1 transition-colors hover:bg-bg-3 hover:text-ink cursor-pointer"
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
  const [sentences, setSentences] = useState<string[]>([""]);
  const [micActive, setMicActive] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sentences]);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    listen<TranscriptEvent>("stt://transcript", (event) => {
      const evt = event.payload;
      setMicActive(evt.mic_active);
      setSentences((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        updated[lastIdx] = (updated[lastIdx] + " " + evt.text).trim();
        // If the text ends with sentence-ending punctuation, start a new sentence
        if (/[.?!]$/.test(evt.text.trim())) {
          updated.push("");
        }
        return updated;
      });
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  const nonEmpty = sentences.filter((s) => s.trim());

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3.5 font-serif text-[15px] leading-[1.55] text-ink-3 tracking-[-0.003em]">
      {nonEmpty.map((sentence, i) => {
        const isLast =
          i === nonEmpty.length - 1 &&
          sentences[sentences.length - 1].trim() !== "";
        return (
          <p key={i} className={`mb-2.5 ${isLast ? "text-ink italic" : ""}`}>
            {sentence}
          </p>
        );
      })}
      {nonEmpty.length === 0 && (
        <div className="text-muted italic flex items-center gap-2 justify-center">
          {micActive ? null : <MicOffIcon className="w-4 h-4" />}
          {"\u00B7"} {micActive ? "listening" : "mic off"} {"\u00B7"}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
