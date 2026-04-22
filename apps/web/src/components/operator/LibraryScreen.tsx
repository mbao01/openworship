import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpenIcon, CircleIcon, MusicIcon } from "lucide-react";
import { invoke } from "../../lib/tauri";
import { toastError } from "../../lib/toast";
import { addItemToActiveProject } from "../../lib/commands/projects";
import { searchSongs, pushSongToDisplay } from "../../lib/commands/songs";
import type { Song, VerseResult } from "../../lib/types";

type LibraryTab = "scripture" | "songs";

export function LibraryScreen() {
  const [tab, setTab] = useState<LibraryTab>("scripture");
  const [results, setResults] = useState<VerseResult[]>([]);
  const [songResults, setSongResults] = useState<Song[]>([]);
  const [selected, setSelected] = useState(0);
  const [query, setQuery] = useState("");
  const [, setIsSearching] = useState(false);
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load some default results
  useEffect(() => {
    invoke<VerseResult[]>("search_scriptures", { query: "Romans 8", translation: null })
      .then(setResults)
      .catch(() => {});
  }, []);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setIsSearching(true);
    try {
      if (tab === "scripture") {
        const res = await invoke<VerseResult[]>("search_scriptures", { query: q, translation: null });
        setResults(res);
      } else {
        const res = await searchSongs(q);
        setSongResults(res);
      }
      setSelected(0);
    } catch (e) {
      toastError("Search failed")(e);
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

  const handleTabChange = (t: LibraryTab) => {
    setTab(t);
    setSelected(0);
    setQuery("");
    if (t === "songs") {
      setSongResults([]);
    }
  };

  const handlePush = async (v: VerseResult) => {
    try {
      await invoke("push_to_display", { reference: v.reference, text: v.text, translation: v.translation });
    } catch (e) {
      toastError("Failed to push")(e);
    }
  };

  const handleQueue = (v: VerseResult) => {
    addItemToActiveProject(v.reference, v.text, v.translation).catch(
      toastError("Failed to queue"),
    );
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  const handleSongClick = (song: Song) => {
    pushSongToDisplay(song.id).catch(toastError("Failed to push song"));
  };

  const current = tab === "scripture" ? results[selected] : null;
  const currentSong = tab === "songs" ? songResults[selected] : null;

  return (
    <div className="flex-1 grid grid-cols-[1fr_2fr] h-full overflow-hidden">
      {/* Left: content list */}
      <div className="flex flex-col border-r border-line overflow-hidden">
        <div className="flex items-center justify-between px-3.5 h-9 shrink-0 border-b border-line bg-bg-1">
          <span className="font-mono text-[10px] text-ink-3 tracking-[0.14em] uppercase">
            Content bank ·{" "}
            <strong className="text-ink-2 font-medium">
              {tab === "scripture" ? "scripture" : "songs"}
            </strong>
          </span>
          <span className="font-mono text-[10px] text-ink-3">
            {tab === "scripture" ? results.length : songResults.length} results
          </span>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-line bg-bg-1">
          <button
            className={`flex-1 px-3 py-1.5 text-[11px] font-mono tracking-[0.08em] uppercase transition-colors cursor-pointer ${
              tab === "scripture"
                ? "text-accent border-b-2 border-accent"
                : "text-ink-3 hover:text-ink-2"
            }`}
            onClick={() => handleTabChange("scripture")}
          >
            Scripture
          </button>
          <button
            className={`flex-1 px-3 py-1.5 text-[11px] font-mono tracking-[0.08em] uppercase transition-colors cursor-pointer ${
              tab === "songs"
                ? "text-accent border-b-2 border-accent"
                : "text-ink-3 hover:text-ink-2"
            }`}
            onClick={() => handleTabChange("songs")}
          >
            Songs
          </button>
        </div>

        <div className="px-3 py-2.5 border-b border-line">
          <input
            className="w-full px-2.5 py-[7px] bg-bg-2 border border-line rounded text-ink text-xs focus:border-accent focus:outline-none"
            placeholder={
              tab === "scripture"
                ? "Search 31,000 verses across 50 translations ..."
                : "Search songs by title, artist, or lyrics ..."
            }
            value={query}
            onChange={handleQueryChange}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {tab === "scripture" &&
            results.map((v, i) => (
              <div
                key={`${v.translation}-${v.reference}-${i}`}
                className={`grid grid-cols-[20px_1fr_auto] gap-2.5 px-3.5 py-2 items-center border-b border-transparent cursor-pointer transition-colors ${
                  selected === i
                    ? "bg-accent-soft text-ink border-accent"
                    : "text-ink-2 hover:bg-bg-2 hover:text-ink"
                }`}
                onClick={() => setSelected(i)}
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
                <span className="font-mono text-[9.5px] text-ink-3">
                  {i + 1}
                </span>
              </div>
            ))}
          {tab === "songs" &&
            songResults.map((s, i) => (
              <div
                key={s.id}
                className={`grid grid-cols-[20px_1fr_auto] gap-2.5 px-3.5 py-2 items-center border-b border-transparent cursor-pointer transition-colors ${
                  selected === i
                    ? "bg-accent-soft text-ink border-accent"
                    : "text-ink-2 hover:bg-bg-2 hover:text-ink"
                }`}
                onClick={() => setSelected(i)}
              >
                <span className="text-accent flex items-center justify-center">
                  <MusicIcon className="w-3.5 h-3.5 shrink-0" />
                </span>
                <div>
                  <div className="font-serif italic text-sm">{s.title}</div>
                  <div className="font-mono text-[9.5px] text-ink-3 tracking-[0.06em]">
                    {s.artist || "Unknown artist"}
                  </div>
                </div>
                <span className="font-mono text-[9.5px] text-ink-3">
                  {i + 1}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Right: detail */}
      <div className="overflow-y-auto px-14 py-10">
        <div className="font-mono text-[10px] text-ink-3 tracking-[0.14em] uppercase mb-6 inline-flex items-center gap-1">
          <CircleIcon className="w-3.5 h-3.5 shrink-0" fill="currentColor" />{" "}
          DETAIL VIEW
        </div>
        {tab === "scripture" && current ? (
          <div className="p-8 bg-bg-1 border border-line rounded-lg max-w-[700px]">
            <div className="font-serif italic text-[38px] tracking-[-0.02em] text-accent mb-2">
              {current.reference}
            </div>
            <div className="font-mono text-[10px] text-ink-3 tracking-[0.2em] uppercase mb-7">
              {current.translation}
            </div>
            <div className="font-serif italic text-[19px] leading-[1.55] text-ink mb-5">
              {current.text}
            </div>
            <div className="flex gap-2.5 pt-5 border-t border-line mt-5">
              <button
                className="inline-flex items-center gap-1.5 px-3 py-[7px] text-xs font-semibold rounded border border-accent bg-accent text-accent-foreground cursor-pointer"
                onClick={() => handlePush(current)}
              >
                Push to display
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-3 py-[7px] text-xs rounded border border-line bg-bg-2 text-ink-2 hover:text-ink hover:border-line-strong cursor-pointer"
                onClick={() => handleQueue(current)}
              >
                Queue next
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-3 py-[7px] text-xs rounded border border-line bg-bg-2 text-ink-2 hover:text-ink hover:border-line-strong cursor-pointer"
                onClick={() => handleCopy(current.text)}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        ) : tab === "songs" && currentSong ? (
          <div className="p-8 bg-bg-1 border border-line rounded-lg max-w-[700px]">
            <div className="font-serif italic text-[38px] tracking-[-0.02em] text-accent mb-2">
              {currentSong.title}
            </div>
            <div className="font-mono text-[10px] text-ink-3 tracking-[0.2em] uppercase mb-7">
              {currentSong.artist || "Unknown artist"}
              {currentSong.ccli_number && ` · CCLI ${currentSong.ccli_number}`}
            </div>
            <div className="font-serif italic text-[16px] leading-[1.65] text-ink mb-5 whitespace-pre-wrap">
              {currentSong.lyrics}
            </div>
            <div className="flex gap-2.5 pt-5 border-t border-line mt-5">
              <button
                className="inline-flex items-center gap-1.5 px-3 py-[7px] text-xs font-semibold rounded border border-accent bg-accent text-accent-foreground cursor-pointer"
                onClick={() => handleSongClick(currentSong)}
              >
                Push to display
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-3 py-[7px] text-xs rounded border border-line bg-bg-2 text-ink-2 hover:text-ink hover:border-line-strong cursor-pointer"
                onClick={() => handleCopy(currentSong.lyrics)}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-sm text-muted gap-2">
            {tab === "scripture" ? (
              <>
                <BookOpenIcon className="w-6 h-6 text-muted/60" />
                Select a verse to view details
              </>
            ) : (
              <>
                <MusicIcon className="w-6 h-6 text-muted/60" />
                Search for a song to view details
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
