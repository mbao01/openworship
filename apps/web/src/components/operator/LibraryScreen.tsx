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
    invoke<VerseResult[]>("search_scriptures", {
      query: "Romans 8",
      translation: null,
    })
      .then(setResults)
      .catch((err) => console.error(err));
  }, []);

  const runSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) return;
      setIsSearching(true);
      try {
        if (tab === "scripture") {
          const res = await invoke<VerseResult[]>("search_scriptures", {
            query: q,
            translation: null,
          });
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
    },
    [tab],
  );

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
      await invoke("push_to_display", {
        reference: v.reference,
        text: v.text,
        translation: v.translation,
      });
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
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch((err) => console.error(err));
  };

  const handleSongClick = (song: Song) => {
    pushSongToDisplay(song.id).catch(toastError("Failed to push song"));
  };

  const current = tab === "scripture" ? results[selected] : null;
  const currentSong = tab === "songs" ? songResults[selected] : null;

  return (
    <div className="grid h-full flex-1 grid-cols-[1fr_2fr] overflow-hidden">
      {/* Left: content list */}
      <div className="flex flex-col overflow-hidden border-r border-line">
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-line bg-bg-1 px-3.5">
          <span className="font-mono text-[10px] tracking-[0.14em] text-ink-3 uppercase">
            Content bank ·{" "}
            <strong className="font-medium text-ink-2">
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
            className={`flex-1 cursor-pointer px-3 py-1.5 font-mono text-[11px] tracking-[0.08em] uppercase transition-colors ${
              tab === "scripture"
                ? "border-b-2 border-accent text-accent"
                : "text-ink-3 hover:text-ink-2"
            }`}
            onClick={() => handleTabChange("scripture")}
          >
            Scripture
          </button>
          <button
            className={`flex-1 cursor-pointer px-3 py-1.5 font-mono text-[11px] tracking-[0.08em] uppercase transition-colors ${
              tab === "songs"
                ? "border-b-2 border-accent text-accent"
                : "text-ink-3 hover:text-ink-2"
            }`}
            onClick={() => handleTabChange("songs")}
          >
            Songs
          </button>
        </div>

        <div className="border-b border-line px-3 py-2.5">
          <input
            className="w-full rounded border border-line bg-bg-2 px-2.5 py-[7px] text-xs text-ink focus:border-accent focus:outline-none"
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
                className={`grid cursor-pointer grid-cols-[20px_1fr_auto] items-center gap-2.5 border-b border-transparent px-3.5 py-2 transition-colors ${
                  selected === i
                    ? "border-accent bg-accent-soft text-ink"
                    : "text-ink-2 hover:bg-bg-2 hover:text-ink"
                }`}
                onClick={() => setSelected(i)}
              >
                <span className="flex items-center justify-center text-accent">
                  <BookOpenIcon className="h-3.5 w-3.5 shrink-0" />
                </span>
                <div>
                  <div className="font-serif text-sm italic">{v.reference}</div>
                  <div className="font-mono text-[9.5px] tracking-[0.06em] text-ink-3">
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
                className={`grid cursor-pointer grid-cols-[20px_1fr_auto] items-center gap-2.5 border-b border-transparent px-3.5 py-2 transition-colors ${
                  selected === i
                    ? "border-accent bg-accent-soft text-ink"
                    : "text-ink-2 hover:bg-bg-2 hover:text-ink"
                }`}
                onClick={() => setSelected(i)}
              >
                <span className="flex items-center justify-center text-accent">
                  <MusicIcon className="h-3.5 w-3.5 shrink-0" />
                </span>
                <div>
                  <div className="font-serif text-sm italic">{s.title}</div>
                  <div className="font-mono text-[9.5px] tracking-[0.06em] text-ink-3">
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
        <div className="mb-6 inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.14em] text-ink-3 uppercase">
          <CircleIcon className="h-3.5 w-3.5 shrink-0" fill="currentColor" />{" "}
          DETAIL VIEW
        </div>
        {tab === "scripture" && current ? (
          <div className="max-w-[700px] rounded-lg border border-line bg-bg-1 p-8">
            <div className="mb-2 font-serif text-[38px] tracking-[-0.02em] text-accent italic">
              {current.reference}
            </div>
            <div className="mb-7 font-mono text-[10px] tracking-[0.2em] text-ink-3 uppercase">
              {current.translation}
            </div>
            <div className="mb-5 font-serif text-[19px] leading-[1.55] text-ink italic">
              {current.text}
            </div>
            <div className="mt-5 flex gap-2.5 border-t border-line pt-5">
              <button
                className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-accent bg-accent px-3 py-[7px] text-xs font-semibold text-accent-foreground"
                onClick={() => handlePush(current)}
              >
                Push to display
              </button>
              <button
                className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-line bg-bg-2 px-3 py-[7px] text-xs text-ink-2 hover:border-line-strong hover:text-ink"
                onClick={() => handleQueue(current)}
              >
                Queue next
              </button>
              <button
                className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-line bg-bg-2 px-3 py-[7px] text-xs text-ink-2 hover:border-line-strong hover:text-ink"
                onClick={() => handleCopy(current.text)}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        ) : tab === "songs" && currentSong ? (
          <div className="max-w-[700px] rounded-lg border border-line bg-bg-1 p-8">
            <div className="mb-2 font-serif text-[38px] tracking-[-0.02em] text-accent italic">
              {currentSong.title}
            </div>
            <div className="mb-7 font-mono text-[10px] tracking-[0.2em] text-ink-3 uppercase">
              {currentSong.artist || "Unknown artist"}
              {currentSong.ccli_number && ` · CCLI ${currentSong.ccli_number}`}
            </div>
            <div className="mb-5 font-serif text-[16px] leading-[1.65] whitespace-pre-wrap text-ink italic">
              {currentSong.lyrics}
            </div>
            <div className="mt-5 flex gap-2.5 border-t border-line pt-5">
              <button
                className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-accent bg-accent px-3 py-[7px] text-xs font-semibold text-accent-foreground"
                onClick={() => handleSongClick(currentSong)}
              >
                Push to display
              </button>
              <button
                className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-line bg-bg-2 px-3 py-[7px] text-xs text-ink-2 hover:border-line-strong hover:text-ink"
                onClick={() => handleCopy(currentSong.lyrics)}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted">
            {tab === "scripture" ? (
              <>
                <BookOpenIcon className="h-6 w-6 text-muted/60" />
                Select a verse to view details
              </>
            ) : (
              <>
                <MusicIcon className="h-6 w-6 text-muted/60" />
                Search for a song to view details
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
