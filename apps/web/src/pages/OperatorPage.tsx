import { useEffect, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { DetectionQueue } from "../components/DetectionQueue";
import { ModeToolbar } from "../components/ModeToolbar";
import { ScriptureSearch } from "../components/ScriptureSearch";
import { SchedulePanel } from "../components/SchedulePanel";
import { SettingsModal } from "../components/SettingsModal";
import { TranscriptPanel } from "../components/TranscriptPanel";
import { invoke } from "../lib/tauri";
import type {
  ChurchIdentity,
  DetectionMode,
  QueueItem,
  ThemeMode,
} from "../lib/types";
import { toastError } from "../lib/toast";
import { TitleBar } from "@/components/TitleBar";

interface OperatorPageProps {
  identity: ChurchIdentity;
  onOpenArtifacts?: () => void;
  theme?: ThemeMode;
  onSetTheme?: (mode: ThemeMode) => void;
}

// ─── Mini Preview Panel ───────────────────────────────────────────────────────

interface MiniDisplayProps {
  label: string;
  item: QueueItem | null;
  isLive?: boolean;
  onApprove?: () => void;
  onSkip?: () => void;
  onClear?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

function MiniDisplay({
  label,
  item,
  isLive,
  onApprove,
  onSkip,
  onClear,
  onPrev,
  onNext,
}: MiniDisplayProps) {
  const isSong = item?.kind === "song";
  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Panel label row */}
      <div className="flex items-center gap-2 mb-1.5 px-0.5">
        <span className="text-[9px] font-semibold tracking-[0.16em] text-smoke uppercase">
          {label}
        </span>
        {isLive && item && (
          <span className="w-1.5 h-1.5 rounded-full bg-gold [box-shadow:0_0_6px_var(--color-gold)] shrink-0" />
        )}
      </div>
      {/* Display panel — 16:9 aspect ratio, centered content */}
      <div
        className={`relative bg-void rounded-[3px] overflow-hidden flex flex-col items-center justify-center p-6 border aspect-video w-full ${
          isLive && item
            ? "border-gold/40 [box-shadow:inset_0_0_40px_rgba(201,168,76,0.04)]"
            : "border-iron/60"
        }`}
        aria-label={`${label} display`}
      >
        {item ? (
          <div className="flex flex-col items-center justify-center text-center max-w-[85%]">
            {/* Body text — centered */}
            <p
              className={`m-0 leading-[1.6] text-chalk ${isSong ? "font-serif text-[15px] italic" : "font-serif text-[14px]"}`}
            >
              {isSong ? item.reference : item.text}
            </p>
            {/* Reference — below text, centered */}
            <div className="mt-3">
              <span className="font-sans text-[10px] font-medium tracking-[0.16em] text-gold uppercase">
                {isSong ? "" : item.reference}
              </span>
              {!isSong && item.translation && (
                <span className="font-sans text-[9px] tracking-wider text-ash/60 ml-2">
                  {item.translation}
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="m-0 text-[11px] text-smoke/40 text-center tracking-wider uppercase">
            {label === "PREVIEW" ? "No pending content" : "Display cleared"}
          </p>
        )}
      </div>
      {/* Action buttons below panel */}
      {label === "PREVIEW" && (
        <div className="flex gap-2 mt-2 px-0.5">
          <button
            className="text-[10px] font-medium tracking-widest uppercase px-3 py-1 rounded-[3px] border border-gold text-gold bg-transparent cursor-pointer transition-colors hover:bg-gold/10 disabled:opacity-30 disabled:cursor-default"
            onClick={onApprove}
            disabled={!item}
          >
            APPROVE
          </button>
          <button
            className="text-[10px] font-medium tracking-widest uppercase px-3 py-1 rounded-[3px] border border-iron text-smoke bg-transparent cursor-pointer transition-colors hover:border-ash hover:text-chalk disabled:opacity-30 disabled:cursor-default"
            onClick={onSkip}
            disabled={!item}
          >
            SKIP
          </button>
        </div>
      )}
      {label === "LIVE" && (
        <div className="flex items-center gap-2 mt-2 px-0.5">
          <button
            className="text-smoke hover:text-chalk bg-transparent border border-iron rounded-[3px] w-6 h-6 flex items-center justify-center cursor-pointer transition-colors"
            onClick={onPrev}
            aria-label="Previous"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M6 2L3 5l3 3"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            className="text-[10px] font-medium tracking-widest uppercase px-3 py-1 rounded-[3px] border border-iron text-smoke bg-transparent cursor-pointer transition-colors hover:border-ash hover:text-chalk"
            onClick={onClear}
          >
            CLEAR CONTENT
          </button>
          <button
            className="text-smoke hover:text-chalk bg-transparent border border-iron rounded-[3px] w-6 h-6 flex items-center justify-center cursor-pointer transition-colors"
            onClick={onNext}
            aria-label="Next"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M4 2l3 3-3 3"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Full-width Preview Panels ────────────────────────────────────────────────

function PreviewPanels() {
  const [items, setItems] = useState<QueueItem[]>([]);

  useEffect(() => {
    invoke<QueueItem[]>("get_queue")
      .then(setItems)
      .catch(toastError("Failed to load queue"));
    let unlisten: UnlistenFn | null = null;
    listen<QueueItem[]>("detection://queue-updated", (e) =>
      setItems(e.payload),
    ).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  const pending = items.find((i) => i.status === "pending") ?? null;
  const live = items.find((i) => i.status === "live") ?? null;

  return (
    <div className="flex gap-3 px-4 pt-3 pb-4 border-b border-iron shrink-0">
      <MiniDisplay
        label="PREVIEW"
        item={pending}
        onApprove={() => {
          if (pending)
            invoke("approve_item", { itemId: pending.id }).catch(
              toastError("Failed to approve item"),
            );
        }}
        onSkip={() => {
          if (pending)
            invoke("skip_item", { itemId: pending.id }).catch(
              toastError("Failed to skip item"),
            );
        }}
      />
      <MiniDisplay
        label="LIVE"
        item={live}
        isLive
        onClear={() => {
          invoke("clear_live").catch(toastError("Failed to clear live item"));
        }}
        onPrev={() => {
          invoke("prev_item").catch(
            toastError("Failed to go to previous item"),
          );
        }}
        onNext={() => {
          invoke("next_item").catch(toastError("Failed to go to next item"));
        }}
      />
    </div>
  );
}

// ─── Detection Log ────────────────────────────────────────────────────────────

interface LogEntry {
  id: number;
  ts: number;
  label: string;
  reference: string;
}

let _logId = 0;

function DetectionLog() {
  const [entries, setEntries] = useState<LogEntry[]>([]);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    listen<QueueItem[]>("detection://queue-updated", (e) => {
      const live = e.payload.find((i) => i.status === "live");
      if (live) {
        setEntries((prev) => {
          const last = prev[prev.length - 1];
          if (last?.reference === live.reference) return prev;
          const entry: LogEntry = {
            id: ++_logId,
            ts: Date.now(),
            label: live.kind === "song" ? "♪ SONG" : "MATCH",
            reference: live.reference,
          };
          return [...prev.slice(-19), entry];
        });
      }
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  const fmt = (ts: number) => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col min-h-0 overflow-hidden pt-3">
      <span className="text-[10px] font-medium tracking-[0.14em] text-smoke uppercase mb-2 shrink-0">
        DETECTION LOG
      </span>
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-0.5 [scrollbar-width:thin] [scrollbar-color:var(--color-iron)_transparent]">
        {entries.length === 0 ? (
          <p className="text-[11px] text-smoke/60 m-0">No events yet.</p>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="flex items-baseline gap-2">
              <span className="font-mono text-[9px] text-smoke shrink-0">
                {fmt(e.ts)}
              </span>
              <span className="text-[10px] text-ash shrink-0">{e.label}</span>
              <span className="text-[10px] text-gold truncate">
                {e.reference}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function OperatorPage({
  identity,
  onOpenArtifacts,
  theme = "system",
  onSetTheme,
}: OperatorPageProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [activeMode, setActiveMode] = useState<DetectionMode>("copilot");

  return (
    <div
      data-qa="operator-root"
      className="flex flex-col h-screen bg-void-100 text-chalk font-sans overflow-hidden"
    >
      <TitleBar
        identity={identity}
        activeMode={activeMode}
        onOpenArtifacts={onOpenArtifacts}
        theme={theme}
        onSetTheme={onSetTheme}
        setSettingsOpen={setSettingsOpen}
      />

      {settingsOpen && (
        <SettingsModal
          identity={identity}
          theme={theme}
          onSetTheme={onSetTheme}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* ── Mode toolbar ─────────────────────────────────────────────────── */}
      <ModeToolbar onModeChange={setActiveMode} />

      {/* ── Full-width preview panels ─────────────────────────────────────── */}
      <PreviewPanels />

      {/* ── Main three-column layout ──────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left — Schedule + Content Bank ─────────────────────────────── */}
        <aside
          data-qa="operator-col-left"
          data-open={leftOpen}
          className={[
            "flex flex-col shrink-0 bg-obsidian border-r border-iron overflow-hidden",
            "transition-[width] duration-200 ease-linear",
            leftOpen ? "w-56" : "w-10",
          ].join(" ")}
        >
          {/* Collapse toggle */}
          <button
            className="h-8 shrink-0 flex items-center justify-center text-smoke hover:text-chalk border-b border-iron transition-colors bg-transparent cursor-pointer"
            onClick={() => setLeftOpen((v) => !v)}
            title={
              leftOpen ? "Collapse schedule panel" : "Expand schedule panel"
            }
            aria-label={
              leftOpen ? "Collapse schedule panel" : "Expand schedule panel"
            }
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
            >
              {leftOpen ? (
                <path
                  d="M9 3L5 7l4 4"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <path
                  d="M5 3l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </button>

          {/* Expanded content */}
          {leftOpen && (
            <>
              {/* Content Bank — scripture search */}
              <div className="shrink-0 p-4 border-b border-iron">
                <span className="block text-[10px] font-medium tracking-[0.14em] text-smoke uppercase mb-3">
                  CONTENT BANK
                </span>
                <div
                  className="overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--color-iron)_transparent]"
                  style={{ maxHeight: "200px" }}
                >
                  <ScriptureSearch />
                </div>
              </div>

              {/* Schedule */}
              <div className="flex-1 overflow-y-auto p-4 min-h-0 [scrollbar-width:thin] [scrollbar-color:var(--color-iron)_transparent]">
                <SchedulePanel />
              </div>
            </>
          )}

          {/* Icon rail when collapsed */}
          {!leftOpen && (
            <div className="flex flex-col items-center pt-3 gap-3">
              {/* Search icon for Content Bank */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                className="text-smoke shrink-0"
                aria-label="Content Bank"
              >
                <circle
                  cx="6"
                  cy="6"
                  r="4"
                  stroke="currentColor"
                  strokeWidth="1.1"
                />
                <path
                  d="M9.5 9.5L12.5 12.5"
                  stroke="currentColor"
                  strokeWidth="1.1"
                  strokeLinecap="round"
                />
              </svg>
              {/* Calendar icon for Schedule */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                className="text-smoke shrink-0"
                aria-label="Schedule"
              >
                <rect
                  x="1.5"
                  y="2.5"
                  width="11"
                  height="10"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="1.1"
                />
                <path d="M1.5 5.5h11" stroke="currentColor" strokeWidth="1.1" />
                <path
                  d="M4.5 1v3M9.5 1v3"
                  stroke="currentColor"
                  strokeWidth="1.1"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          )}
        </aside>

        {/* Center — Transcript ─────────────────────────────────────────── */}
        <main
          data-qa="operator-col-center"
          className="flex flex-col flex-1 overflow-hidden min-h-0 bg-void"
        >
          <div className="flex-1 overflow-hidden min-h-0">
            <TranscriptPanel />
          </div>
        </main>

        {/* Right — Queue + Detection Log ───────────────────────────────── */}
        <aside
          data-qa="operator-col-right"
          data-open={rightOpen}
          className={[
            "flex flex-col shrink-0 bg-obsidian border-l border-iron overflow-hidden",
            "transition-[width] duration-200 ease-linear",
            rightOpen ? "w-60" : "w-10",
          ].join(" ")}
        >
          {/* Collapse toggle */}
          <button
            className="h-8 shrink-0 flex items-center justify-center text-smoke hover:text-chalk border-b border-iron transition-colors bg-transparent cursor-pointer"
            onClick={() => setRightOpen((v) => !v)}
            title={rightOpen ? "Collapse queue panel" : "Expand queue panel"}
            aria-label={
              rightOpen ? "Collapse queue panel" : "Expand queue panel"
            }
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
            >
              {rightOpen ? (
                <path
                  d="M5 3l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <path
                  d="M9 3L5 7l4 4"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </button>

          {/* Expanded content */}
          {rightOpen && (
            <>
              {/* Queue (top ~65%) */}
              <div className="flex-1 overflow-hidden min-h-0 p-4 flex flex-col">
                <DetectionQueue />
              </div>

              {/* Divider */}
              <div className="h-px bg-iron shrink-0" />

              {/* Detection Log (bottom ~35%) */}
              <div
                className="shrink-0 overflow-hidden flex flex-col px-4 pb-4"
                style={{ height: "35%" }}
              >
                <DetectionLog />
              </div>
            </>
          )}

          {/* Icon rail when collapsed */}
          {!rightOpen && (
            <div className="flex flex-col items-center pt-3 gap-3">
              {/* Queue icon */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                className="text-smoke shrink-0"
                aria-label="Queue"
              >
                <path
                  d="M2 4h10M2 7h10M2 10h6"
                  stroke="currentColor"
                  strokeWidth="1.1"
                  strokeLinecap="round"
                />
              </svg>
              {/* Log icon */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                className="text-smoke shrink-0"
                aria-label="Detection Log"
              >
                <rect
                  x="1.5"
                  y="1.5"
                  width="11"
                  height="11"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="1.1"
                />
                <path
                  d="M4 5h6M4 7.5h4M4 10h2"
                  stroke="currentColor"
                  strokeWidth="1.1"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
