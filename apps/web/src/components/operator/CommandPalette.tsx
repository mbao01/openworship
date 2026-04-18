import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "../../lib/tauri";
import { toastError } from "../../lib/toast";
import type { VerseResult, Song } from "../../lib/types";

interface CommandPaletteProps {
  onClose: () => void;
}

interface ResultGroup {
  group: string;
  items: ResultItem[];
}

interface ResultItem {
  glyph: string;
  main: string;
  sub: string;
  onSelect: () => void;
}

export function CommandPalette({ onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [scriptureResults, setScriptureResults] = useState<VerseResult[]>([]);
  const [songResults, setSongResults] = useState<Song[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setScriptureResults([]);
      setSongResults([]);
      return;
    }
    try {
      const [scripture, songs] = await Promise.all([
        invoke<VerseResult[]>("search_scriptures", { query: q, translation: null }),
        invoke<Song[]>("search_songs", { query: q, limit: 5 }),
      ]);
      setScriptureResults(scripture.slice(0, 5));
      setSongResults(songs);
      setSelected(0);
    } catch {
      // silent
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), 180);
  };

  const handlePushScripture = async (v: VerseResult) => {
    try {
      await invoke("push_to_display", { reference: v.reference, text: v.text, translation: v.translation });
      onClose();
    } catch (e) {
      toastError("Failed to push")(e);
    }
  };

  const handlePushSong = async (s: Song) => {
    try {
      await invoke("push_song_to_display", { id: s.id });
      onClose();
    } catch (e) {
      toastError("Failed to push song")(e);
    }
  };

  // Build flat result groups
  const groups: ResultGroup[] = [];
  if (scriptureResults.length > 0) {
    groups.push({
      group: "Scripture",
      items: scriptureResults.map((v) => ({
        glyph: "\u00A7",
        main: `${v.reference} \u00B7 \u201C${v.text.slice(0, 50)}\u2026\u201D`,
        sub: `${v.translation} \u00B7 library`,
        onSelect: () => handlePushScripture(v),
      })),
    });
  }
  if (songResults.length > 0) {
    groups.push({
      group: "Lyrics",
      items: songResults.map((s) => ({
        glyph: "\u266A",
        main: s.title,
        sub: `${s.artist || "Hymn"} \u00B7 in library`,
        onSelect: () => handlePushSong(s),
      })),
    });
  }
  if (query.trim()) {
    groups.push({
      group: "Actions",
      items: [
        { glyph: "\u25A1", main: "Black display", sub: "Action", onSelect: onClose },
      ],
    });
  }

  const flatItems = groups.flatMap((g) => g.items);
  const totalCount = flatItems.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, totalCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      flatItems[selected]?.onSelect();
    }
  };

  let flatIdx = 0;

  return (
    <div
      className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[14vh]"
      onClick={onClose}
    >
      <div
        className="w-[640px] max-w-[92vw] bg-bg-1 border border-line-strong rounded-lg overflow-hidden"
        style={{ boxShadow: "0 40px 100px -20px rgba(0,0,0,0.6)" }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-[22px] py-[18px] border-b border-line">
          <span className="text-accent font-serif text-[22px] italic">{"\u2315"}</span>
          <input
            ref={inputRef}
            className="flex-1 bg-transparent border-0 font-serif text-[22px] text-ink tracking-[-0.01em] placeholder:text-ink-3 placeholder:italic"
            placeholder="Search scripture, lyrics, slides, or commands\u2026"
            value={query}
            onChange={handleChange}
          />
          <span className="font-mono text-[10px] text-ink-3 tracking-[0.1em] uppercase">
            {totalCount} results
          </span>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto py-2">
          {groups.map((g) => (
            <div key={g.group}>
              <div className="px-[22px] pt-2 pb-1 font-mono text-[9.5px] text-ink-3 tracking-[0.14em] uppercase">
                {g.group}
              </div>
              {g.items.map((item) => {
                const idx = flatIdx++;
                return (
                  <div
                    key={`${g.group}-${idx}`}
                    className={`grid grid-cols-[28px_1fr_auto] gap-3.5 px-[22px] py-2.5 cursor-pointer items-center ${
                      idx === selected ? "bg-accent-soft" : "hover:bg-accent-soft"
                    }`}
                    onClick={item.onSelect}
                  >
                    <span className="font-serif italic text-base text-accent">{item.glyph}</span>
                    <div>
                      <div className="text-[13.5px] text-ink truncate">{item.main}</div>
                      <div className="font-mono text-[10px] text-ink-3 tracking-[0.06em] mt-0.5 uppercase">{item.sub}</div>
                    </div>
                    <span className="font-mono text-[10px] text-ink-3">{"\u21B5"}</span>
                  </div>
                );
              })}
            </div>
          ))}
          {query.trim() && totalCount === 0 && (
            <div className="px-[22px] py-6 text-center text-sm text-muted">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-4 items-center px-[22px] py-2.5 border-t border-line font-mono text-[10px] text-ink-3 tracking-[0.08em] uppercase">
          <span><kbd className="bg-bg-3 px-1.5 py-0.5 rounded-sm mr-1 text-ink-2">{"\u2191\u2193"}</kbd> navigate</span>
          <span><kbd className="bg-bg-3 px-1.5 py-0.5 rounded-sm mr-1 text-ink-2">{"\u21B5"}</kbd> push</span>
          <span><kbd className="bg-bg-3 px-1.5 py-0.5 rounded-sm mr-1 text-ink-2">{"\u21E7\u21B5"}</kbd> queue</span>
          <span><kbd className="bg-bg-3 px-1.5 py-0.5 rounded-sm mr-1 text-ink-2">esc</kbd> close</span>
          <span className="ml-auto">searching {"\u00B7"} scripture {"\u00B7"} lyrics {"\u00B7"} slides</span>
        </div>
      </div>
    </div>
  );
}
