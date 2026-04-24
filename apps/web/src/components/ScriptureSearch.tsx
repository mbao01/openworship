import { useCallback, useEffect, useRef, useState } from "react";
import { useDebounce } from "../hooks/use-debounce";
import { invoke } from "../lib/tauri";
import type { TranslationInfo, VerseResult } from "../lib/types";
import { BIBLE_BOOKS } from "../lib/bible-books";

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
  return BIBLE_BOOKS.filter((b) => b.toLowerCase().startsWith(lower)).slice(
    0,
    7,
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function ScriptureSearch() {
  const [query, setQuery] = useState("");
  const [translation, setTranslation] = useState("KJV");
  const [translations, setTranslations] = useState<TranslationInfo[]>([]);
  const [results, setResults] = useState<VerseResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pushed, setPushed] = useState<{
    reference: string;
    translation: string;
  } | null>(null);

  // Combobox state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    invoke<TranslationInfo[]>("list_translations")
      .then(setTranslations)
      .catch((err) => console.error(err));
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

  const scheduleSearch = useDebounce(runSearch, 220);

  // Derive suggestions from current input
  const prefix = bookPrefix(query);
  const suggestions =
    dropdownOpen && isTypingBookName(query) ? matchingBooks(prefix) : [];

  const selectBook = useCallback((book: string) => {
    const next = book + " ";
    setQuery(next);
    setDropdownOpen(false);
    setHighlighted(0);
    inputRef.current?.focus();
    // Don't fire a search yet — wait for user to add chapter
  }, []);

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
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            data-qa="scripture-search-input"
            className="w-full border-b border-none border-b-line/60 bg-transparent py-2 font-sans text-sm tracking-wide text-ink transition-colors outline-none placeholder:text-muted focus:border-b-accent focus:[box-shadow:0_2px_0_-1px_rgba(201,168,76,0.15)]"
            type="text"
            placeholder={"Book, chapter:verse or keyword"}
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (isTypingBookName(query) && query.trim().length > 0)
                setDropdownOpen(true);
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
              className="absolute top-1/2 right-0 h-2.5 w-2.5 -translate-y-1/2 animate-spin rounded-full border border-muted border-t-accent"
              aria-hidden="true"
            />
          )}

          {/* Book suggestions dropdown */}
          {dropdownOpen && suggestions.length > 0 && (
            <ul
              ref={listRef}
              role="listbox"
              className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-sm border border-line bg-bg-1 shadow-lg"
            >
              {suggestions.map((book, i) => (
                <li
                  key={book}
                  role="option"
                  aria-selected={i === highlighted}
                  className={`cursor-pointer px-3 py-1.5 font-sans text-sm tracking-wide transition-colors ${
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
          className="min-w-[52px] cursor-pointer border-b border-none border-b-line/60 bg-bg-1 px-1 py-2 font-mono text-[11px] tracking-[0.06em] text-ink-3 transition-colors outline-none focus:border-b-accent focus:text-ink"
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
        <ul className="mt-2 flex list-none flex-col gap-px p-0" role="list">
          {results.map((v, i) => {
            const isLive =
              pushed?.reference === v.reference &&
              pushed?.translation === v.translation;
            return (
              <li
                key={`${v.translation}-${v.reference}-${i}`}
                className={`cursor-pointer rounded-sm border bg-bg-1 px-4 py-3 transition-all outline-none hover:border-line-strong hover:bg-bg-2 focus:bg-bg-2 focus:border-line-strong${isLive ? "border-accent/60 bg-bg-2" : "border-line/40"}`}
                onClick={() => handlePush(v)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && handlePush(v)}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-xs font-medium tracking-[0.04em] text-ink">
                    {v.reference}
                  </span>
                  <span className="font-mono text-[10px] tracking-[0.08em] text-ink-3">
                    {v.translation}
                  </span>
                  {isLive && (
                    <span
                      className="ml-auto h-2 w-2 rounded-full bg-accent [box-shadow:0_0_4px_var(--color-accent)]"
                      aria-label="Live"
                    />
                  )}
                </div>
                <p className="m-0 text-[13px] leading-[1.55] text-ink-3">
                  {v.text}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {/* Empty state */}
      {query.trim() && !isSearching && results.length === 0 && (
        <p className="m-0 py-4 text-xs text-muted">No results for "{query}"</p>
      )}
    </div>
  );
}
