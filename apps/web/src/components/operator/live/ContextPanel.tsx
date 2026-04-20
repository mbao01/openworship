import { useEffect, useRef, useState } from "react";
import { CircleIcon, PlayIcon } from "lucide-react";
import { searchScriptures, pushToDisplay } from "../../../lib/commands/content";
import { addItemToActiveProject } from "../../../lib/commands/projects";
import type { QueueItem, VerseResult } from "../../../lib/types";
import { toastError } from "../../../lib/toast";

function mergeVerses(verses: VerseResult[]): {
  reference: string;
  text: string;
  translation: string;
} {
  if (verses.length === 0) return { reference: "", text: "", translation: "" };
  if (verses.length === 1)
    return {
      reference: verses[0].reference,
      text: verses[0].text,
      translation: verses[0].translation,
    };
  const first = verses[0];
  const last = verses[verses.length - 1];
  const firstVerse = first.reference.split(":").pop() || "";
  const lastVerse = last.reference.split(":").pop() || "";
  const bookChapter = first.reference.split(":")[0];
  return {
    reference: `${bookChapter}:${firstVerse}-${lastVerse}`,
    text: verses.map((v) => v.text).join(" "),
    translation: first.translation,
  };
}

export function ContextPanel({ live }: { live: QueueItem | null }) {
  const [contextVerses, setContextVerses] = useState<VerseResult[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(),
  );
  const lastClickedIndex = useRef<number | null>(null);

  useEffect(() => {
    if (!live || live.kind !== "scripture") {
      setContextVerses([]);
      setSelectedIndices(new Set());
      return;
    }
    // Extract book + chapter from reference (e.g. "Romans 8:38-39" -> "Romans 8")
    const match = live.reference.match(/^(.+?)\s+(\d+)/);
    if (!match) return;
    const bookChapter = `${match[1]} ${match[2]}`;
    searchScriptures(bookChapter)
      .then((verses) => {
        verses.sort((a, b) => {
          const aNum = parseInt(a.reference.split(":").pop() || "0");
          const bNum = parseInt(b.reference.split(":").pop() || "0");
          return aNum - bNum;
        });
        setContextVerses(verses);
        setSelectedIndices(new Set());
      })
      .catch(() => setContextVerses([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only reload when reference or kind changes
  }, [live?.reference, live?.kind]);

  const contextLabel = live?.reference ?? "none";

  // Song sections
  const songSections: string[] = [];
  if (live?.kind === "song" && live.text) {
    const parts = live.text
      .split(
        /\n\n|\[(?:Verse|Chorus|Bridge|Pre-Chorus|Outro|Intro|Tag)[^\]]*\]/i,
      )
      .filter((s) => s.trim());
    songSections.push(...parts);
  }

  const handleVerseClick = (e: React.MouseEvent, index: number) => {
    const v = contextVerses[index];
    const isMeta = e.metaKey || e.ctrlKey;
    const isShift = e.shiftKey;

    if (isMeta) {
      // Toggle individual verse in selection
      setSelectedIndices((prev) => {
        const next = new Set(prev);
        if (next.has(index)) {
          next.delete(index);
        } else {
          next.add(index);
        }
        return next;
      });
      lastClickedIndex.current = index;
    } else if (isShift && lastClickedIndex.current !== null) {
      // Range select
      const start = Math.min(lastClickedIndex.current, index);
      const end = Math.max(lastClickedIndex.current, index);
      setSelectedIndices((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) {
          next.add(i);
        }
        return next;
      });
    } else {
      // Normal click -> push to preview
      addItemToActiveProject(v.reference, v.text, v.translation).catch(
        toastError("Failed to add to preview"),
      );
      lastClickedIndex.current = index;
    }
  };

  const handlePushSelected = () => {
    const sorted = Array.from(selectedIndices).sort((a, b) => a - b);
    const verses = sorted.map((i) => contextVerses[i]);
    const merged = mergeVerses(verses);
    pushToDisplay(merged.reference, merged.text, merged.translation).catch(
      toastError("Failed to push to live"),
    );
    setSelectedIndices(new Set());
  };

  const handleQueueSelected = () => {
    const sorted = Array.from(selectedIndices).sort((a, b) => a - b);
    const verses = sorted.map((i) => contextVerses[i]);
    const merged = mergeVerses(verses);
    addItemToActiveProject(
      merged.reference,
      merged.text,
      merged.translation,
    ).catch(toastError("Failed to queue"));
    setSelectedIndices(new Set());
  };

  return (
    <>
      {/* Context header */}
      <div className="flex items-center justify-between px-3.5 h-9 shrink-0 border-t border-line border-b border-line bg-bg-1">
        <span className="font-mono text-[10px] text-ink-3 tracking-[0.14em] uppercase">
          Context ·{" "}
          <strong className="text-ink-2 font-medium">{contextLabel}</strong>
        </span>
      </div>

      {/* Context content */}
      <div className="relative flex-1 min-h-0 overflow-y-auto">
        {live?.kind === "scripture" &&
          contextVerses.map((v, i) => {
            const isActive = live.reference === v.reference;
            const isSelected = selectedIndices.has(i);
            return (
              <div
                key={`${v.reference}-${i}`}
                className={`group flex items-center gap-2 px-3.5 py-2 transition-colors cursor-pointer hover:bg-bg-2 ${
                  isSelected
                    ? "bg-accent-soft border-l-2 border-l-accent"
                    : isActive
                      ? "bg-accent-soft"
                      : ""
                }`}
                onClick={(e) => handleVerseClick(e, i)}
              >
                <span className="font-mono text-[9px] text-ink-3 shrink-0 w-5 text-right">
                  {v.reference.split(":").pop()}
                </span>
                <span className="flex-1 text-xs text-ink-2 leading-[1.4] line-clamp-2">
                  {v.text}
                </span>
                <button
                  type="button"
                  className="shrink-0 p-1.5 rounded text-ink-3 hover:text-accent hover:bg-accent-soft transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                  title="Push to live"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    pushToDisplay(v.reference, v.text, v.translation).catch(
                      toastError("Failed to push"),
                    );
                  }}
                >
                  <PlayIcon className="w-4 h-4" />
                </button>
              </div>
            );
          })}

        {live?.kind === "song" &&
          songSections.map((section, i) => (
            <div
              key={i}
              className="flex items-start gap-2 px-3.5 py-2 transition-colors hover:bg-bg-2"
            >
              <span className="flex-1 text-xs text-ink-2 leading-[1.5] whitespace-pre-line">
                {section.trim()}
              </span>
              <button
                className="shrink-0 p-1 rounded text-ink-3 hover:text-accent hover:bg-accent-soft transition-colors mt-0.5"
                title="Push to live"
                onClick={() =>
                  pushToDisplay(live.reference, section.trim(), "").catch(
                    toastError("Failed to push"),
                  )
                }
              >
                <PlayIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

        {(!live || (live.kind !== "scripture" && live.kind !== "song")) && (
          <div className="px-3.5 py-6 flex flex-col items-center justify-center gap-2 text-xs text-muted">
            <CircleIcon className="w-5 h-5" />
            No content on screen
          </div>
        )}

        {/* Multi-select action bar */}
        {selectedIndices.size >= 2 && (
          <div className="sticky bottom-0 flex items-center justify-between px-3.5 py-2 bg-bg-1 border-t border-line">
            <span className="text-xs text-ink-3">
              {selectedIndices.size} verses selected
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={handlePushSelected}
                className="px-2.5 py-1 font-mono text-[9px] tracking-[0.1em] uppercase border border-accent text-accent-foreground bg-accent rounded transition-colors hover:bg-accent-hover cursor-pointer"
              >
                Push to live
              </button>
              <button
                onClick={handleQueueSelected}
                className="px-2.5 py-1 font-mono text-[9px] tracking-[0.1em] uppercase border border-line text-ink-2 rounded bg-bg-2 transition-colors hover:bg-bg-3 hover:text-ink cursor-pointer"
              >
                Queue
              </button>
              <button
                onClick={() => setSelectedIndices(new Set())}
                className="px-2.5 py-1 font-mono text-[9px] tracking-[0.1em] uppercase text-ink-3 rounded transition-colors hover:text-ink hover:bg-bg-2 cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
