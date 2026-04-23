import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpenIcon,
  CornerDownLeftIcon,
  SearchIcon,
  ListIcon,
} from "lucide-react";
import { BIBLE_BOOKS_ALPHA } from "../../../lib/bible-books";
import {
  searchScriptures,
  getBookChapters,
  getChapterVerses,
} from "../../../lib/commands/content";
import { Combobox } from "../../ui/combobox";
import type { VerseResult } from "../../../lib/types";

interface ScriptureSearchPanelProps {
  onPush: (reference: string, text: string, translation: string) => void;
}

export function ScriptureSearchPanel({ onPush }: ScriptureSearchPanelProps) {
  const [mode, setMode] = useState<"text" | "select">("text");
  const [results, setResults] = useState<VerseResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Text mode state
  const [query, setQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Select mode state
  const [book, setBook] = useState("");
  const [chapters, setChapters] = useState<number[]>([]);
  const [chapter, setChapter] = useState("");
  const [verses, setVerses] = useState<number[]>([]);
  const [fromVerse, setFromVerse] = useState("");
  const [toVerse, setToVerse] = useState("");

  // ── Text mode search ───────────────────────────────────────────────────────

  const runTextSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await searchScriptures(q);
      setResults(res);
    } catch {
      // silent
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runTextSearch(val), 220);
  };

  // ── Select mode cascading ─────────────────────────────────────────────────

  // When book changes → fetch chapters, reset downstream
  useEffect(() => {
    if (!book) {
      setChapters([]);
      setChapter("");
      setVerses([]);
      setFromVerse("");
      setToVerse("");
      setResults([]);
      return;
    }
    getBookChapters(book)
      .then((chs) => {
        setChapters(chs);
        // Auto-select first chapter so verses load immediately
        setChapter(chs.length > 0 ? String(chs[0]) : "");
        setVerses([]);
        setFromVerse("");
        setToVerse("");
        setResults([]);
      })
      .catch(() => setChapters([]));
  }, [book]);

  // When chapter changes → fetch verses, default fromVerse to 1
  useEffect(() => {
    if (!book || !chapter) {
      setVerses([]);
      setFromVerse("");
      setToVerse("");
      return;
    }
    getChapterVerses(book, Number(chapter))
      .then((vs) => {
        setVerses(vs);
        setFromVerse(vs.length > 0 ? String(vs[0]) : "");
        setToVerse(vs.length > 0 ? String(vs[vs.length - 1]) : "");
      })
      .catch(() => setVerses([]));
  }, [book, chapter]);

  // Auto-search when book + chapter + fromVerse are set
  useEffect(() => {
    if (mode !== "select" || !book || !chapter || !fromVerse) return;

    const q =
      toVerse && toVerse !== fromVerse
        ? `${book} ${chapter}:${fromVerse}-${toVerse}`
        : `${book} ${chapter}:${fromVerse}`;

    setIsSearching(true);
    searchScriptures(q)
      .then(setResults)
      .catch((err) => console.error(err))
      .finally(() => setIsSearching(false));
  }, [mode, book, chapter, fromVerse, toVerse]);

  // ── Mode toggle ────────────────────────────────────────────────────────────

  const handleModeSwitch = (next: "text" | "select") => {
    setMode(next);
    setResults([]);
    setQuery("");
    setBook("");
  };

  // ── Filtered "to" verse options ────────────────────────────────────────────

  const toVerseOptions = fromVerse
    ? verses.filter((v) => v >= Number(fromVerse))
    : verses;

  // ── Combobox options ────────────────────────────────────────────────────────

  const bookOptions = BIBLE_BOOKS_ALPHA.map((b) => ({ value: b, label: b }));
  const chapterOptions = chapters.map((c) => ({
    value: String(c),
    label: String(c),
  }));
  const verseOptions = verses.map((v) => ({
    value: String(v),
    label: String(v),
  }));
  const toVerseOpts = toVerseOptions.map((v) => ({
    value: String(v),
    label: String(v),
  }));

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Search / Select area */}
      <div className="border-b border-line px-3 py-2.5">
        {/* Mode toggle + text input — joined into one element */}
        {mode === "text" && (
          <div className="flex h-[26px] overflow-hidden rounded border border-line bg-bg-2">
            <button
              type="button"
              className="shrink-0 cursor-pointer border-r border-line bg-accent px-2 font-mono text-[9px] font-semibold tracking-widest text-accent-foreground uppercase transition-colors"
              onClick={() => handleModeSwitch("select")}
              title="Browse by book/chapter/verse"
            >
              <ListIcon className="h-3 w-3" />
            </button>
            <input
              className="min-w-0 flex-1 bg-transparent px-2.5 text-xs text-ink outline-0 placeholder:text-ink-3"
              placeholder="Romans 8:38 ..."
              value={query}
              onChange={handleQueryChange}
            />
          </div>
        )}

        {/* Mode toggle + all combobox fields — single joined element */}
        {mode === "select" && (
          <div className="flex h-[26px] overflow-hidden rounded border border-line bg-bg-2">
            <button
              type="button"
              className="shrink-0 cursor-pointer border-r border-line bg-accent px-2 font-mono text-[9px] font-semibold tracking-widest text-accent-foreground uppercase transition-colors"
              onClick={() => handleModeSwitch("text")}
              title="Free-text search"
            >
              <SearchIcon className="h-3 w-3" />
            </button>
            <div className="min-w-0 flex-[2] border-r border-line">
              <Combobox
                value={book}
                onChange={setBook}
                options={bookOptions}
                placeholder="Book"
                className="rounded-none border-0"
              />
            </div>
            <div className="w-[40px] shrink-0 border-r border-line">
              <Combobox
                value={chapter}
                onChange={setChapter}
                options={chapterOptions}
                placeholder="Ch"
                disabled={chapters.length === 0}
                className="rounded-none border-0"
              />
            </div>
            <div className="w-[44px] shrink-0 border-r border-line">
              <Combobox
                value={fromVerse}
                onChange={(v) => {
                  setFromVerse(v);
                  setToVerse("");
                }}
                options={verseOptions}
                placeholder="From"
                disabled={verses.length === 0}
                className="rounded-none border-0"
              />
            </div>
            <div className="w-[38px] shrink-0">
              <Combobox
                value={toVerse}
                onChange={setToVerse}
                options={toVerseOpts}
                placeholder="To"
                disabled={!fromVerse}
                className="rounded-none border-0"
              />
            </div>
          </div>
        )}
      </div>

      {/* Results list */}
      <div className="flex-1 overflow-y-auto">
        {results.map((v, i) => (
          <div
            key={`${v.translation}-${v.reference}-${i}`}
            className="grid cursor-pointer grid-cols-[20px_1fr_auto] items-center gap-2.5 border-b border-transparent px-3.5 py-2 text-ink-2 transition-colors hover:bg-bg-2 hover:text-ink"
            onClick={() => onPush(v.reference, v.text, v.translation)}
          >
            <span className="flex items-center justify-center text-accent">
              <BookOpenIcon className="h-2 w-2 shrink-0" />
            </span>
            <div>
              <div className="font-serif text-sm italic">{v.reference}</div>
              <div className="font-mono text-[9.5px] tracking-[0.06em] text-ink-3">
                {v.translation}
              </div>
            </div>
            <span className="flex items-center text-ink-3">
              <CornerDownLeftIcon className="h-2 w-2 shrink-0" />
            </span>
          </div>
        ))}

        {mode === "text" &&
          query.trim() &&
          !isSearching &&
          results.length === 0 && (
            <div className="px-3.5 py-6 text-center text-xs text-muted">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

        {mode === "select" &&
          book &&
          chapter &&
          fromVerse &&
          !isSearching &&
          results.length === 0 && (
            <div className="px-3.5 py-6 text-center text-xs text-muted">
              No verses found
            </div>
          )}
      </div>
    </div>
  );
}
