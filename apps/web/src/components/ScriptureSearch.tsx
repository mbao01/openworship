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
    <div className="scripture-search">
      <div className="scripture-search__controls">
        <div className="scripture-search__input-wrap">
          <input
            className="scripture-search__input"
            type="text"
            placeholder={'Search \u2014 e.g. John 3:16 or \u201cshepherd\u201d'}
            value={query}
            onChange={handleQueryChange}
            autoComplete="off"
            spellCheck={false}
          />
          {isSearching && <span className="scripture-search__spinner" />}
        </div>
        <select
          className="scripture-search__select"
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

      {results.length > 0 && (
        <ul className="scripture-search__results" role="list">
          {results.map((v, i) => {
            const isLive = pushed?.reference === v.reference && pushed?.translation === v.translation;
            return (
              <li
                key={`${v.translation}-${v.reference}-${i}`}
                className={`scripture-search__result${isLive ? " scripture-search__result--live" : ""}`}
                onClick={() => handlePush(v)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && handlePush(v)}
              >
                <div className="scripture-search__result-meta">
                  <span className="scripture-search__reference">{v.reference}</span>
                  <span className="scripture-search__translation">{v.translation}</span>
                  {isLive && <span className="scripture-search__live-dot" aria-label="Live" />}
                </div>
                <p className="scripture-search__verse-text">{v.text}</p>
              </li>
            );
          })}
        </ul>
      )}

      {query.trim() && !isSearching && results.length === 0 && (
        <p className="scripture-search__empty">No results for "{query}"</p>
      )}
    </div>
  );
}
