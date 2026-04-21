import { useEffect, useRef, useState } from "react";
import { toastError } from "@/lib/toast";
import type { VerseResult } from "@/lib/types";
import { searchScriptures } from "@/lib/commands/content";

export function AddItemSearch({
  onAdd,
}: {
  onAdd: (v: VerseResult) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VerseResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchScriptures(q);
        setResults(res);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  return (
    <div>
      <input
        ref={inputRef}
        className="w-full px-3 py-2 bg-bg-2 border border-line rounded text-ink text-sm mb-2"
        placeholder="Search scripture\u2026"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
      />
      {loading && <div className="text-xs text-ink-3 py-2">Searching...</div>}
      {results.length > 0 && (
        <div className="border border-line rounded-lg overflow-hidden mb-2">
          {results.map((v, i) => (
            <button
              key={`${v.reference}-${v.translation}-${i}`}
              className="w-full text-left px-3.5 py-2.5 border-b border-line last:border-b-0 transition-colors hover:bg-bg-2 cursor-pointer"
              onClick={async () => {
                try {
                  await onAdd(v);
                } catch (e) {
                  toastError("Failed to add item")(e);
                }
              }}
            >
              <span className="text-[12.5px] text-ink">{v.reference}</span>
              <span className="ml-2 font-mono text-[9.5px] text-ink-3 tracking-[0.08em] uppercase">
                {v.translation}
              </span>
              <span className="block text-xs text-ink-3 mt-0.5 line-clamp-1">
                {v.text}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
