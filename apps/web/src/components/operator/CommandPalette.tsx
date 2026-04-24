import { useCallback, useEffect, useRef, useState } from "react";
import { useDebounce } from "../../hooks/use-debounce";
import {
  BookOpenIcon,
  CornerDownLeftIcon,
  MusicIcon,
  SearchIcon,
  SquareIcon,
} from "lucide-react";
import { invoke } from "../../lib/tauri";
import { toastError } from "../../lib/toast";
import { clearLive } from "../../lib/commands/detection";
import type { VerseResult, Song } from "../../lib/types";

interface CommandPaletteProps {
  onClose: () => void;
}

interface ResultGroup {
  group: string;
  items: ResultItem[];
}

interface ResultItem {
  glyph: React.ReactNode;
  main: string;
  sub: string;
  onSelect: () => void;
}

// Selectors for focusable elements within the dialog
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function CommandPalette({ onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [scriptureResults, setScriptureResults] = useState<VerseResult[]>([]);
  const [songResults, setSongResults] = useState<Song[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Remember element that opened the palette so we can restore focus on close
  const returnFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement;
    inputRef.current?.focus();
    return () => {
      // Restore focus to trigger element when palette unmounts
      if (returnFocusRef.current instanceof HTMLElement) {
        returnFocusRef.current.focus();
      }
    };
  }, []);

  // Focus trap: keep Tab/Shift+Tab inside the dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trapFocus = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    dialog.addEventListener("keydown", trapFocus);
    return () => dialog.removeEventListener("keydown", trapFocus);
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
        invoke<VerseResult[]>("search_scriptures", {
          query: q,
          translation: null,
        }),
        invoke<Song[]>("search_songs", { query: q, limit: 5 }),
      ]);
      setScriptureResults(scripture.slice(0, 5));
      setSongResults(songs);
      setSelected(0);
    } catch {
      // silent
    }
  }, []);

  const debouncedSearch = useDebounce(runSearch, 180);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    debouncedSearch(val);
  };

  const handlePushScripture = async (v: VerseResult) => {
    try {
      await invoke("push_to_display", {
        reference: v.reference,
        text: v.text,
        translation: v.translation,
      });
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
        glyph: <BookOpenIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
        main: `${v.reference} · "${v.text.slice(0, 50)}…"`,
        sub: `${v.translation} · library`,
        onSelect: () => handlePushScripture(v),
      })),
    });
  }
  if (songResults.length > 0) {
    groups.push({
      group: "Lyrics",
      items: songResults.map((s) => ({
        glyph: <MusicIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
        main: s.title,
        sub: `${s.artist || "Hymn"} · in library`,
        onSelect: () => handlePushSong(s),
      })),
    });
  }
  if (query.trim()) {
    groups.push({
      group: "Actions",
      items: [
        {
          glyph: <SquareIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
          main: "Black display",
          sub: "Action",
          onSelect: () => {
            clearLive().catch(toastError("Failed to clear display"));
            onClose();
          },
        },
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
    } else if (e.key === "Home") {
      e.preventDefault();
      setSelected(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setSelected(Math.max(0, totalCount - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      flatItems[selected]?.onSelect();
    }
  };

  let flatIdx = 0;

  return (
    // Backdrop — click-outside to close; aria-hidden so AT skips directly to dialog
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center bg-black/50 pt-[14vh] backdrop-blur-sm"
      onClick={onClose}
      aria-hidden="true"
    >
      {/* Dialog — WCAG 4.1.2: role=dialog, aria-modal, aria-labelledby */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cmdk-label"
        className="w-[640px] max-w-[92vw] overflow-hidden rounded-lg border border-line-strong bg-bg-1"
        style={{ boxShadow: "0 40px 100px -20px rgba(0,0,0,0.6)" }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        // Remove aria-hidden from the backdrop that wraps this dialog
        aria-hidden={undefined}
      >
        {/* Live region: announces result count changes to screen readers */}
        <span
          id="cmdk-result-count"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {totalCount > 0 ? `${totalCount} ${totalCount === 1 ? "result" : "results"}` : query.trim() ? "No results" : ""}
        </span>

        {/* Input */}
        <div className="flex items-center gap-3 border-b border-line px-[22px] py-[18px]">
          <span className="flex items-center text-accent" aria-hidden="true">
            <SearchIcon className="h-5 w-5 shrink-0" />
          </span>
          <input
            id="cmdk-label"
            ref={inputRef}
            role="combobox"
            aria-expanded={totalCount > 0}
            aria-controls="cmdk-listbox"
            aria-autocomplete="list"
            aria-activedescendant={totalCount > 0 ? `cmdk-option-${selected}` : undefined}
            className="flex-1 border-0 bg-transparent font-serif text-[22px] tracking-[-0.01em] text-ink outline-none placeholder:text-ink-3 placeholder:italic focus:ring-0"
            placeholder="Search scripture, lyrics, slides, or commands ..."
            value={query}
            onChange={handleChange}
          />
          <span className="font-mono text-[10px] tracking-[0.1em] text-ink-3 uppercase" aria-hidden="true">
            {totalCount} results
          </span>
        </div>

        {/* Results — listbox semantics for keyboard navigation announcement */}
        <div
          id="cmdk-listbox"
          role="listbox"
          aria-label="Search results"
          className="max-h-[50vh] overflow-y-auto py-2"
        >
          {groups.map((g) => (
            <div key={g.group} role="group" aria-label={g.group}>
              <div
                className="px-[22px] pt-2 pb-1 font-mono text-[9.5px] tracking-[0.14em] text-ink-3 uppercase"
                aria-hidden="true"
              >
                {g.group}
              </div>
              {g.items.map((item) => {
                const idx = flatIdx++;
                return (
                  <div
                    key={`${g.group}-${idx}`}
                    id={`cmdk-option-${idx}`}
                    role="option"
                    aria-selected={idx === selected}
                    className={`grid cursor-pointer grid-cols-[28px_1fr_auto] items-center gap-3.5 px-[22px] py-2.5 transition-colors ${
                      idx === selected
                        ? "bg-accent-soft"
                        : "hover:bg-accent-soft"
                    }`}
                    onClick={item.onSelect}
                  >
                    <span className="flex items-center text-accent" aria-hidden="true">
                      {item.glyph}
                    </span>
                    <div>
                      <div className="truncate text-[13.5px] text-ink">
                        {item.main}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] tracking-[0.06em] text-ink-3 uppercase">
                        {item.sub}
                      </div>
                    </div>
                    <span className="flex items-center text-ink-3" aria-hidden="true">
                      <CornerDownLeftIcon className="h-3.5 w-3.5 shrink-0" />
                    </span>
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
        <div className="flex items-center gap-4 border-t border-line px-[22px] py-2.5 font-mono text-[10px] tracking-[0.08em] text-ink-3 uppercase" aria-hidden="true">
          <span>
            <kbd className="mr-1 rounded-sm bg-bg-3 px-1.5 py-0.5 text-ink-2">
              ↑↓
            </kbd>{" "}
            navigate
          </span>
          <span>
            <kbd className="mr-1 rounded-sm bg-bg-3 px-1.5 py-0.5 text-ink-2">
              ↵
            </kbd>{" "}
            push
          </span>
          <span>
            <kbd className="mr-1 rounded-sm bg-bg-3 px-1.5 py-0.5 text-ink-2">
              ⇧↵
            </kbd>{" "}
            queue
          </span>
          <span>
            <kbd className="mr-1 rounded-sm bg-bg-3 px-1.5 py-0.5 text-ink-2">
              esc
            </kbd>{" "}
            close
          </span>
          <span className="ml-auto">
            searching · scripture · lyrics · slides
          </span>
        </div>
      </div>
    </div>
  );
}
