import { useCallback, useEffect, useState } from "react";
import { useDebounce } from "../../../hooks/use-debounce";
import { invoke } from "@tauri-apps/api/core";
import {
  CornerDownLeftIcon,
  MusicIcon,
  PresentationIcon,
  UploadIcon,
} from "lucide-react";
import type { Song, AnnouncementItem } from "../../../lib/types";
import { toastError } from "../../../lib/toast";
import {
  listAnnouncements,
  pushAnnouncementToDisplay,
  importPptxSlides,
  importPdfSlides,
} from "../../../lib/commands/annotations";
import { AssetsPanel } from "./AssetsPanel";
import { ScriptureSearchPanel } from "./ScriptureSearchPanel";

export function LibraryPanel() {
  const [tab, setTab] = useState<"scripture" | "lyrics" | "slides">(
    "scripture",
  );
  const [query, setQuery] = useState("");
  const [songResults, setSongResults] = useState<Song[]>([]);
  const [slides, setSlides] = useState<AnnouncementItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (tab === "slides") {
      listAnnouncements()
        .then(setSlides)
        .catch((err) => console.error(err));
    }
  }, [tab]);

  const runSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setSongResults([]);
        return;
      }
      if (tab !== "lyrics") return;
      setIsSearching(true);
      try {
        const res = await invoke<Song[]>("search_songs", {
          query: q,
          limit: 20,
        });
        setSongResults(res);
      } catch {
        // silent
      } finally {
        setIsSearching(false);
      }
    },
    [tab],
  );

  const debouncedSearch = useDebounce(runSearch, 220);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    debouncedSearch(val);
  };

  const handlePush = async (
    reference: string,
    text: string,
    translation: string,
  ) => {
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

  const [importing, setImporting] = useState(false);

  const handleImportSlides = async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple: false,
      filters: [{ name: "Slides", extensions: ["pptx", "pdf"] }],
    });
    if (!selected) return;
    const filePath = typeof selected === "string" ? selected : selected[0];
    setImporting(true);
    try {
      const ext = filePath.split(".").pop()?.toLowerCase();
      let created: AnnouncementItem[];
      if (ext === "pptx") {
        created = await importPptxSlides(filePath);
      } else if (ext === "pdf") {
        created = await importPdfSlides(filePath);
      } else {
        return;
      }
      setSlides((prev) => [...prev, ...created]);
      setTab("slides");
    } catch (e) {
      toastError("Failed to import slides")(e);
    } finally {
      setImporting(false);
    }
  };

  const tabs = [
    { id: "scripture" as const, label: "Scripture", count: "31k" },
    { id: "lyrics" as const, label: "Lyrics", count: "" },
    { id: "slides" as const, label: "Slides", count: "" },
  ];

  const placeholder =
    tab === "lyrics"
      ? "song title, opening line ..."
      : "slide title ...";

  return (
    <section className="flex w-[280px] shrink-0 flex-col overflow-hidden border-r border-line bg-bg">
      {/* Library -- top half */}
      <div className="flex h-1/2 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-line bg-bg-1 px-3.5">
          <span
            data-qa="content-bank-toggle-label"
            className="font-mono text-[10px] tracking-[0.14em] text-ink-3 uppercase"
          >
            Library
          </span>
          {tab === "slides" && (
            <button
              className="inline-flex cursor-pointer items-center gap-1 rounded border border-line bg-bg-2 px-2 py-1 font-mono text-[9px] tracking-[0.1em] text-ink-2 uppercase transition-colors hover:bg-bg-3 hover:text-ink disabled:pointer-events-none disabled:opacity-40"
              onClick={handleImportSlides}
              disabled={importing}
              title="Import slides from PPTX or PDF"
            >
              <UploadIcon className="h-2.5 w-2.5" />
              {importing ? "Importing…" : "Import"}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-line bg-bg-1 px-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`-mb-px flex flex-1 cursor-pointer flex-col items-center justify-start gap-0.5 border-b px-3 py-2.5 font-mono text-[10px] tracking-[0.12em] uppercase transition-colors ${
                tab === t.id
                  ? "border-accent text-ink"
                  : "border-transparent text-ink-3 hover:text-ink-2"
              }`}
              onClick={() => {
                setTab(t.id);
                setQuery("");
                setSongResults([]);
              }}
            >
              <span>{t.label}</span>
              <span className="m-auto text-[9px] text-muted">
                {t.count || "—"}
              </span>
            </button>
          ))}
        </div>

        {/* Scripture panel (has its own search UI) */}
        {tab === "scripture" && (
          <ScriptureSearchPanel onPush={handlePush} />
        )}

        {/* Search input for lyrics/slides */}
        {tab !== "scripture" && (
          <div className="border-b border-line px-3 py-2.5">
            <input
              className="w-full rounded border border-line bg-bg-2 px-2.5 py-[7px] text-xs text-ink focus:border-line-strong"
              placeholder={placeholder}
              value={query}
              onChange={handleQueryChange}
            />
          </div>
        )}

        {/* Results for lyrics/slides */}
        <div className={`flex-1 overflow-y-auto ${tab === "scripture" ? "hidden" : ""}`}>
          {tab === "lyrics" &&
            songResults.map((s) => (
              <div
                key={s.id}
                className="grid cursor-pointer grid-cols-[20px_1fr_auto] items-center gap-2.5 border-b border-transparent px-3.5 py-2 text-ink-2 transition-colors hover:bg-bg-2 hover:text-ink"
                onClick={() => handlePushSong(s)}
              >
                <span className="flex items-center justify-center text-accent">
                  <MusicIcon className="h-2 w-2 shrink-0" />
                </span>
                <div>
                  <div className="text-sm font-medium">{s.title}</div>
                  {s.artist && (
                    <div className="font-mono text-[9.5px] tracking-[0.06em] text-ink-3">
                      {s.artist}
                    </div>
                  )}
                </div>
                <span className="flex items-center text-ink-3">
                  <CornerDownLeftIcon className="h-2 w-2 shrink-0" />
                </span>
              </div>
            ))}

          {tab === "slides" &&
            slides.length > 0 &&
            slides.map((slide) => (
              <div
                key={slide.id}
                className="grid cursor-pointer grid-cols-[20px_1fr_auto] items-center gap-2.5 border-b border-transparent px-3.5 py-2 text-ink-2 transition-colors hover:bg-bg-2 hover:text-ink"
                onClick={() =>
                  pushAnnouncementToDisplay(slide.id).catch(
                    toastError("Failed to push slide"),
                  )
                }
              >
                <span className="flex items-center justify-center text-accent">
                  <PresentationIcon className="h-2 w-2 shrink-0" />
                </span>
                <div>
                  <div className="text-sm font-medium">{slide.title}</div>
                  {slide.body && (
                    <div className="line-clamp-1 font-mono text-[9.5px] tracking-[0.06em] text-ink-3">
                      {slide.body}
                    </div>
                  )}
                </div>
                <span className="flex items-center text-ink-3">
                  <CornerDownLeftIcon className="h-2 w-2 shrink-0" />
                </span>
              </div>
            ))}

          {tab === "slides" && slides.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 px-3.5 py-8 text-center text-xs text-muted">
              <PresentationIcon className="h-5 w-5" />
              <span>No slides yet</span>
              <button
                className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-line bg-bg-2 px-3 py-1.5 font-mono text-[9px] tracking-[0.1em] text-ink-2 uppercase transition-colors hover:bg-bg-3 hover:text-ink disabled:pointer-events-none disabled:opacity-40"
                onClick={handleImportSlides}
                disabled={importing}
              >
                <UploadIcon className="h-3 w-3" />
                Import PPTX or PDF
              </button>
            </div>
          )}

          {query.trim() &&
            !isSearching &&
            songResults.length === 0 &&
            tab === "lyrics" && (
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
