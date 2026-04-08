import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "../lib/tauri";
import type { TranslationInfo, VerseResult } from "../lib/types";

export function ScriptureSearch() {
  const [query, setQuery] = useState("");
  const [translation, setTranslation] = useState("KJV");
  const [translations, setTranslations] = useState<TranslationInfo[]>([]);
  const [results, setResults] = useState<VerseResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pushed, setPushed] = useState<{ reference: string; translation: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    invoke<TranslationInfo[]>("list_translations")
      .then(setTranslations)
      .catch(() => {});
  }, []);

  const runSearch = useCallback(
    async (q: string, t: string) => {
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
    },
    []
  );

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val, translation), 220);
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
            data-qa="scripture-search-input"
            className="w-full bg-transparent border-none border-b border-b-iron/60 outline-none py-2 text-chalk font-sans text-sm tracking-wide transition-colors placeholder:text-smoke focus:border-b-gold focus:[box-shadow:0_2px_0_-1px_rgba(201,168,76,0.15)]"
            type="text"
            placeholder={'Search \u2014 e.g. John 3:16 or \u201cshepherd\u201d'}
            value={query}
            onChange={handleQueryChange}
            autoComplete="off"
            spellCheck={false}
          />
          {isSearching && (
            <span
              className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border border-smoke border-t-gold animate-spin"
              aria-hidden="true"
            />
          )}
        </div>
        <select
          data-qa="scripture-search-translation"
          className="bg-obsidian border-none border-b border-b-iron/60 text-ash font-mono text-[11px] tracking-[0.06em] py-2 px-1 outline-none cursor-pointer min-w-[52px] transition-colors focus:border-b-gold focus:text-chalk"
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
            const isLive = pushed?.reference === v.reference && pushed?.translation === v.translation;
            return (
              <li
                key={`${v.translation}-${v.reference}-${i}`}
                className={`bg-obsidian border rounded-sm px-4 py-3 cursor-pointer outline-none transition-all hover:bg-slate hover:border-smoke focus:bg-slate focus:border-smoke${isLive ? " border-gold-muted bg-slate" : " border-iron/40"}`}
                onClick={() => handlePush(v)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && handlePush(v)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-chalk tracking-[0.04em]">{v.reference}</span>
                  <span className="font-mono text-[10px] text-ash tracking-[0.08em]">{v.translation}</span>
                  {isLive && (
                    <span
                      className="w-2 h-2 rounded-full bg-gold [box-shadow:0_0_4px_var(--color-gold)] ml-auto"
                      aria-label="Live"
                    />
                  )}
                </div>
                <p className="m-0 text-[13px] leading-[1.55] text-ash">{v.text}</p>
              </li>
            );
          })}
        </ul>
      )}

      {/* Empty state */}
      {query.trim() && !isSearching && results.length === 0 && (
        <p className="text-xs text-smoke py-4 m-0">No results for "{query}"</p>
      )}
    </div>
  );
}
