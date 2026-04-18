import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "../../lib/tauri";
import { toastError } from "../../lib/toast";
import type { VerseResult } from "../../lib/types";

export function LibraryScreen() {
  const [results, setResults] = useState<VerseResult[]>([]);
  const [selected, setSelected] = useState(0);
  const [query, setQuery] = useState("");
  const [, setIsSearching] = useState(false);
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
      const res = await invoke<VerseResult[]>("search_scriptures", { query: q, translation: null });
      setResults(res);
      setSelected(0);
    } catch (e) {
      toastError("Search failed")(e);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), 220);
  };

  const handlePush = async (v: VerseResult) => {
    try {
      await invoke("push_to_display", { reference: v.reference, text: v.text, translation: v.translation });
    } catch (e) {
      toastError("Failed to push")(e);
    }
  };

  const current = results[selected];

  return (
    <div className="flex-1 grid grid-cols-[1fr_2fr] h-full overflow-hidden">
      {/* Left: content list */}
      <div className="flex flex-col border-r border-line overflow-hidden">
        <div className="flex items-center justify-between px-3.5 h-9 shrink-0 border-b border-line bg-bg-1">
          <span className="font-mono text-[10px] text-ink-3 tracking-[0.14em] uppercase">
            Content bank {"\u00B7"} <strong className="text-ink-2 font-medium">scripture</strong>
          </span>
          <span className="font-mono text-[10px] text-ink-3">{results.length} results</span>
        </div>
        <div className="px-3 py-2.5 border-b border-line">
          <input
            className="w-full px-2.5 py-[7px] bg-bg-2 border border-line rounded-[3px] text-ink text-xs focus:border-line-strong"
            placeholder="Search 31,000 verses across 50 translations\u2026"
            value={query}
            onChange={handleQueryChange}
          />
        </div>
        <div className="flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--color-bg-3)_transparent]">
          {results.map((v, i) => (
            <div
              key={`${v.translation}-${v.reference}-${i}`}
              className={`grid grid-cols-[20px_1fr_auto] gap-2.5 px-3.5 py-2 items-center border-b border-transparent cursor-pointer transition-colors ${
                selected === i
                  ? "bg-accent-soft text-ink border-accent"
                  : "text-ink-2 hover:bg-bg-2 hover:text-ink"
              }`}
              onClick={() => setSelected(i)}
            >
              <span className="font-serif italic text-sm text-accent text-center">{"\u00A7"}</span>
              <div>
                <div className="font-serif italic text-sm">{v.reference}</div>
                <div className="font-mono text-[9.5px] text-ink-3 tracking-[0.06em]">{v.translation}</div>
              </div>
              <span className="font-mono text-[9.5px] text-ink-3">{i + 1}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right: detail */}
      <div className="overflow-y-auto px-14 py-10">
        <div className="font-mono text-[10px] text-ink-3 tracking-[0.14em] uppercase mb-6">
          {"\u25CF"} DETAIL VIEW
        </div>
        {current ? (
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
                className="inline-flex items-center gap-1.5 px-3 py-[7px] text-xs font-semibold rounded border border-accent bg-accent text-[#1A0D00]"
                onClick={() => handlePush(current)}
              >
                Push to display
              </button>
              <button className="inline-flex items-center gap-1.5 px-3 py-[7px] text-xs rounded border border-line bg-bg-2 text-ink-2 hover:text-ink hover:border-line-strong">
                Queue next
              </button>
              <button className="inline-flex items-center gap-1.5 px-3 py-[7px] text-xs rounded border border-line bg-bg-2 text-ink-2 hover:text-ink hover:border-line-strong">
                Copy
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted">Select a verse to view details</div>
        )}
      </div>
    </div>
  );
}
