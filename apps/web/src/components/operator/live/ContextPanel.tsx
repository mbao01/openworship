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
      <div className="flex h-9 shrink-0 items-center justify-between border-t border-b border-line bg-bg-1 px-3.5">
        <span className="font-mono text-[10px] tracking-[0.14em] text-ink-3 uppercase">
          Context ·{" "}
          <strong className="font-medium text-ink-2">{contextLabel}</strong>
        </span>
      </div>

      {/* Context content */}
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {live?.kind === "scripture" &&
          contextVerses.map((v, i) => {
            const isActive = live.reference === v.reference;
            const isSelected = selectedIndices.has(i);
            return (
              <div
                key={`${v.reference}-${i}`}
                className={`group flex cursor-pointer items-center gap-2 px-3.5 py-2 transition-colors hover:bg-bg-2 ${
                  isSelected
                    ? "border-l-2 border-l-accent bg-accent-soft"
                    : isActive
                      ? "bg-accent-soft"
                      : ""
                }`}
                onClick={(e) => handleVerseClick(e, i)}
              >
                <span className="w-5 shrink-0 text-right font-mono text-[9px] text-ink-3">
                  {v.reference.split(":").pop()}
                </span>
                <span className="line-clamp-2 flex-1 text-xs leading-[1.4] text-ink-2">
                  {v.text}
                </span>
                <button
                  type="button"
                  className="shrink-0 cursor-pointer rounded p-1.5 text-ink-3 opacity-0 transition-colors group-hover:opacity-100 hover:bg-accent-soft hover:text-accent"
                  title="Push to live"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    pushToDisplay(v.reference, v.text, v.translation).catch(
                      toastError("Failed to push"),
                    );
                  }}
                >
                  <PlayIcon className="h-4 w-4" />
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
              <span className="flex-1 text-xs leading-[1.5] whitespace-pre-line text-ink-2">
                {section.trim()}
              </span>
              <button
                className="mt-0.5 shrink-0 rounded p-1 text-ink-3 transition-colors hover:bg-accent-soft hover:text-accent"
                title="Push to live"
                onClick={() =>
                  pushToDisplay(live.reference, section.trim(), "").catch(
                    toastError("Failed to push"),
                  )
                }
              >
                <PlayIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

        {(!live || (live.kind !== "scripture" && live.kind !== "song")) && (
          <div className="flex flex-col items-center justify-center gap-2 px-3.5 py-6 text-xs text-muted">
            <CircleIcon className="h-5 w-5" />
            No content on screen
          </div>
        )}

        {/* Multi-select action bar */}
        {selectedIndices.size >= 2 && (
          <div className="sticky bottom-0 flex items-center justify-between border-t border-line bg-bg-1 px-3.5 py-2">
            <span className="text-xs text-ink-3">
              {selectedIndices.size} verses selected
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={handlePushSelected}
                className="cursor-pointer rounded border border-accent bg-accent px-2.5 py-1 font-mono text-[9px] tracking-[0.1em] text-accent-foreground uppercase transition-colors hover:bg-accent-hover"
              >
                Push to live
              </button>
              <button
                onClick={handleQueueSelected}
                className="cursor-pointer rounded border border-line bg-bg-2 px-2.5 py-1 font-mono text-[9px] tracking-[0.1em] text-ink-2 uppercase transition-colors hover:bg-bg-3 hover:text-ink"
              >
                Queue
              </button>
              <button
                onClick={() => setSelectedIndices(new Set())}
                className="cursor-pointer rounded px-2.5 py-1 font-mono text-[9px] tracking-[0.1em] text-ink-3 uppercase transition-colors hover:bg-bg-2 hover:text-ink"
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
