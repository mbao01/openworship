import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  BookOpenIcon,
  CornerDownLeftIcon,
  MusicIcon,
  PresentationIcon,
} from "lucide-react";
import type {
  VerseResult,
  Song,
  AnnouncementItem,
} from "../../../lib/types";
import { toastError } from "../../../lib/toast";
import { listAnnouncements, pushAnnouncementToDisplay } from "../../../lib/commands/annotations";
import { AssetsPanel } from "./AssetsPanel";

export function LibraryPanel() {
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
      {/* Library -- top half */}
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

      {/* Assets -- bottom half */}
      <AssetsPanel />
    </section>
  );
}
