import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "../lib/tauri";
import type { TranslationInfo, VerseResult } from "../lib/types";

// ─── Bible book list (canonical names matching Rust normalize_book) ────────────

const BIBLE_BOOKS = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
  "Joshua", "Judges", "Ruth",
  "1 Samuel", "2 Samuel", "1 Kings", "2 Kings",
  "1 Chronicles", "2 Chronicles",
  "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
  "Ecclesiastes", "Song of Solomon",
  "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel",
  "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah",
  "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
  "Matthew", "Mark", "Luke", "John", "Acts", "Romans",
  "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
  "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
  "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews",
  "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John",
  "Jude", "Revelation",
];

// Extract the book-name portion of a query (text before the first digit)
function bookPrefix(input: string): string {
  const m = input.match(/^([^0-9]+)/);
  return m ? m[1].trim() : "";
}

// True when the user is still typing a book name (no chapter number yet)
function isTypingBookName(input: string): boolean {
  return /^[^0-9]+$/.test(input.trim());
}

function matchingBooks(prefix: string): string[] {
  if (!prefix || prefix.length < 1) return [];
  const lower = prefix.toLowerCase();
  return BIBLE_BOOKS.filter((b) => b.toLowerCase().startsWith(lower)).slice(0, 7);
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function ScriptureSearch() {
  const [query, setQuery] = useState("");
  const [translation, setTranslation] = useState("KJV");
  const [translations, setTranslations] = useState<TranslationInfo[]>([]);
  const [results, setResults] = useState<VerseResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pushed, setPushed] = useState<{ reference: string; translation: string } | null>(null);

  // Combobox state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    invoke<TranslationInfo[]>("list_translations")
      .then(setTranslations)
      .catch(() => {});
  }, []);

  const runSearch = useCallback(async (q: string, t: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await invoke<VerseResult[]>("search_scriptures", {
        query: q,
        translation: t || null,
      });
      setResults(res);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const scheduleSearch = useCallback(
    (q: string, t: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => runSearch(q, t), 220);
    },
    [runSearch]
  );

  // Derive suggestions from current input
  const prefix = bookPrefix(query);
  const suggestions = dropdownOpen && isTypingBookName(query) ? matchingBooks(prefix) : [];

  const selectBook = useCallback(
    (book: string) => {
      const next = book + " ";
      setQuery(next);
      setDropdownOpen(false);
      setHighlighted(0);
      inputRef.current?.focus();
      // Don't fire a search yet — wait for user to add chapter
    },
    []
  );

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setHighlighted(0);
    // Show dropdown only while typing a book name
    setDropdownOpen(isTypingBookName(val) && val.trim().length > 0);
    scheduleSearch(val, translation);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!dropdownOpen || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (suggestions[highlighted]) {
        e.preventDefault();
        selectBook(suggestions[highlighted]);
      }
    } else if (e.key === "Escape") {
      setDropdownOpen(false);
    }
  };

  const handleTranslationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setTranslation(val);
    if (query.trim()) runSearch(query, val);
  };

  const handlePush = async (verse: VerseResult) => {
    try {
      await invoke("push_to_display", {
        reference: verse.reference,
        text: verse.text,
        translation: verse.translation,
      });
      setPushed({ reference: verse.reference, translation: verse.translation });
      setTimeout(() => setPushed(null), 2000);
    } catch {
      // silently ignore when display is not connected
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Controls row */}
      <div className="flex gap-3 items-center">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            data-qa="scripture-search-input"
            className="w-full bg-transparent border-none border-b border-b-line/60 outline-none py-2 text-ink font-sans text-sm tracking-wide transition-colors placeholder:text-muted focus:border-b-accent focus:[box-shadow:0_2px_0_-1px_rgba(201,168,76,0.15)]"
            type="text"
            placeholder={"Book, chapter:verse or keyword"}
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (isTypingBookName(query) && query.trim().length > 0) setDropdownOpen(true);
            }}
            onBlur={() => {
              // Delay so click on suggestion registers first
              setTimeout(() => setDropdownOpen(false), 150);
            }}
            autoComplete="off"
            spellCheck={false}
            aria-autocomplete="list"
            aria-expanded={dropdownOpen && suggestions.length > 0}
            aria-haspopup="listbox"
          />
          {isSearching && (
            <span
              className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border border-muted border-t-accent animate-spin"
              aria-hidden="true"
            />
          )}

          {/* Book suggestions dropdown */}
          {dropdownOpen && suggestions.length > 0 && (
            <ul
              ref={listRef}
              role="listbox"
              className="absolute left-0 right-0 top-full mt-1 z-50 bg-bg-1 border border-line rounded-sm shadow-lg overflow-hidden"
            >
              {suggestions.map((book, i) => (
                <li
                  key={book}
                  role="option"
                  aria-selected={i === highlighted}
                  className={`px-3 py-1.5 text-sm cursor-pointer transition-colors font-sans tracking-wide ${
                    i === highlighted
                      ? "bg-line text-ink"
                      : "text-ink-3 hover:bg-line/60 hover:text-ink"
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent blur before click
                    selectBook(book);
                  }}
                  onMouseEnter={() => setHighlighted(i)}
                >
                  {book}
                </li>
              ))}
            </ul>
          )}
        </div>
        <select
          data-qa="scripture-search-translation"
          className="bg-bg-1 border-none border-b border-b-line/60 text-ink-3 font-mono text-[11px] tracking-[0.06em] py-2 px-1 outline-none cursor-pointer min-w-[52px] transition-colors focus:border-b-accent focus:text-ink"
          value={translation}
          onChange={handleTranslationChange}
        >
          {translations.map((t) => (
            <option key={t.id} value={t.abbreviation}>
              {t.abbreviation}
            </option>
          ))}
        </select>
      </div>

      {/* Results list */}
      {results.length > 0 && (
        <ul className="list-none mt-2 p-0 flex flex-col gap-px" role="list">
          {results.map((v, i) => {
            const isLive =
              pushed?.reference === v.reference && pushed?.translation === v.translation;
            return (
              <li
                key={`${v.translation}-${v.reference}-${i}`}
                className={`bg-bg-1 border rounded-sm px-4 py-3 cursor-pointer outline-none transition-all hover:bg-bg-2 hover:border-line-strong focus:bg-bg-2 focus:border-line-strong${isLive ? " border-accent/60 bg-bg-2" : " border-line/40"}`}
                onClick={() => handlePush(v)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && handlePush(v)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-ink tracking-[0.04em]">
                    {v.reference}
                  </span>
                  <span className="font-mono text-[10px] text-ink-3 tracking-[0.08em]">
                    {v.translation}
                  </span>
                  {isLive && (
                    <span
                      className="w-2 h-2 rounded-full bg-accent [box-shadow:0_0_4px_var(--color-accent)] ml-auto"
                      aria-label="Live"
                    />
                  )}
                </div>
                <p className="m-0 text-[13px] leading-[1.55] text-ink-3">{v.text}</p>
              </li>
            );
          })}
        </ul>
      )}

      {/* Empty state */}
      {query.trim() && !isSearching && results.length === 0 && (
        <p className="text-xs text-muted py-4 m-0">No results for "{query}"</p>
      )}
    </div>
  );
}
