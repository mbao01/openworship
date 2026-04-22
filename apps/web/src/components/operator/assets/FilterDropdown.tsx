/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState } from "react";
import {
  ImageIcon,
  VideoIcon,
  Music2Icon,
  FileTextIcon,
  PresentationIcon,
  FilterIcon,
  ChevronDownIcon,
} from "lucide-react";
import type { ArtifactCategory } from "../../../lib/types";
import { iconCls } from "./helpers";

export const CATEGORY_LABELS: Record<string, string> = {
  image: "Images",
  video: "Videos",
  audio: "Audio",
  document: "Documents",
  slide: "Slides",
};

export const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  image: <ImageIcon className={iconCls} />,
  video: <VideoIcon className={iconCls} />,
  audio: <Music2Icon className={iconCls} />,
  document: <FileTextIcon className={iconCls} />,
  slide: <PresentationIcon className={iconCls} />,
};

export function FilterDropdown({
  activeFilters,
  allSelected,
  onToggle,
  onToggleAll,
}: {
  activeFilters: Set<ArtifactCategory>;
  allSelected: boolean;
  onToggle: (cat: ArtifactCategory) => void;
  onToggleAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const count = activeFilters.size;
  const label = allSelected ? "All types" : `${count} type${count !== 1 ? "s" : ""}`;

  return (
    <div className="relative" ref={ref}>
      <button
        className={`flex items-center gap-1.5 font-sans text-[11px] px-2.5 py-[5px] rounded border cursor-pointer transition-colors ${
          !allSelected
            ? "text-accent border-accent/40 bg-accent-soft"
            : "text-ink-3 border-line hover:text-ink hover:border-line-strong"
        }`}
        onClick={() => setOpen((v) => !v)}
      >
        <FilterIcon className="w-3 h-3 shrink-0" />
        {label}
        <ChevronDownIcon
          className={`w-3 h-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-[200] bg-bg-1 border border-line-strong rounded-lg py-1 min-w-[180px] shadow-lg">
          <button
            className="flex items-center gap-2.5 w-full text-left px-3 py-1.5 text-[12px] text-ink transition-colors hover:bg-bg-2 cursor-pointer"
            onClick={onToggleAll}
          >
            <span
              className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[9px] font-bold shrink-0 ${
                allSelected
                  ? "bg-accent border-accent text-accent-foreground"
                  : "border-line-strong"
              }`}
            >
              {allSelected ? "✓" : ""}
            </span>
            <span className="font-medium">All types</span>
          </button>
          <div className="h-px bg-line my-1 mx-2" />
          {(
            Object.entries(CATEGORY_LABELS) as [ArtifactCategory, string][]
          ).map(([cat, catLabel]) => (
            <button
              key={cat}
              className="flex items-center gap-2.5 w-full text-left px-3 py-1.5 text-[12px] text-ink transition-colors hover:bg-bg-2 cursor-pointer"
              onClick={() => onToggle(cat)}
            >
              <span
                className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[9px] font-bold shrink-0 ${
                  activeFilters.has(cat)
                    ? "bg-accent border-accent text-accent-foreground"
                    : "border-line-strong"
                }`}
              >
                {activeFilters.has(cat) ? "\u2713" : ""}
              </span>
              <span className="text-ink-3">{CATEGORY_ICONS[cat]}</span>
              {catLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
