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
        className="mb-2 w-full rounded border border-line bg-bg-2 px-3 py-2 text-sm text-ink"
        placeholder="Search scripture ..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
      />
      {loading && <div className="py-2 text-xs text-ink-3">Searching...</div>}
      {results.length > 0 && (
        <div className="mb-2 overflow-hidden rounded-lg border border-line">
          {results.map((v, i) => (
            <button
              key={`${v.reference}-${v.translation}-${i}`}
              className="w-full cursor-pointer border-b border-line px-3.5 py-2.5 text-left transition-colors last:border-b-0 hover:bg-bg-2"
              onClick={async () => {
                try {
                  await onAdd(v);
                } catch (e) {
                  toastError("Failed to add item")(e);
                }
              }}
            >
              <span className="text-[12.5px] text-ink">{v.reference}</span>
              <span className="ml-2 font-mono text-[9.5px] tracking-[0.08em] text-ink-3 uppercase">
                {v.translation}
              </span>
              <span className="mt-0.5 line-clamp-1 block text-xs text-ink-3">
                {v.text}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
