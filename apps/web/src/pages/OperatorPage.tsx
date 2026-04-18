import { useState } from "react";
import { useQueue } from "../hooks/use-queue";
import { useTranslations } from "../hooks/use-translations";
import { DetectionQueue } from "../components/DetectionQueue";
import { ModeToolbar } from "../components/ModeToolbar";
import { ScriptureSearch } from "../components/ScriptureSearch";
import { SchedulePanel } from "../components/SchedulePanel";
import { SettingsModal } from "../components/SettingsModal";
import { TranscriptPanel } from "../components/TranscriptPanel";
import type { ChurchIdentity, DetectionMode, QueueItem } from "../lib/types";
import { toastError } from "../lib/toast";

interface OperatorPageProps {
  identity: ChurchIdentity;
  onOpenArtifacts?: () => void;
}

// ─── Translation Switcher ────────────────────────────────────────────────────

function TranslationSwitcher() {
  const { translations, active, setActive } = useTranslations();

  if (translations.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <label
        className="text-[10px] text-muted tracking-[0.06em] uppercase"
        htmlFor="translation-select"
      >
        Translation
      </label>
      <select
        data-qa="translation-select"
        id="translation-select"
        className="appearance-none bg-bg-2 text-ink border border-line rounded-[3px] text-[11px] font-mono pt-[2px] pb-[2px] pl-[6px] pr-5 cursor-pointer min-w-[52px] transition-colors focus:outline focus:outline-1 focus:outline-accent focus:outline-offset-[1px]"
        value={active}
        onChange={(e) => setActive(e.target.value).catch(toastError("Failed to switch translation"))}
        title="Switch Bible translation"
      >
        {translations.map((t) => (
          <option key={t.id} value={t.id}>{t.abbreviation}</option>
        ))}
      </select>
    </div>
  );
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

function MiniDisplay({ label, item, isLive, onApprove, onSkip, onClear, onPrev, onNext }: MiniDisplayProps) {
  const isSong = item?.kind === "song";
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex items-center gap-2 mb-1.5 px-0.5">
        <span className="text-[9px] font-semibold tracking-[0.16em] text-ink-3 uppercase">{label}</span>
        {isLive && item && (
          <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
        )}
      </div>
      <div
        className={`relative bg-bg rounded-[3px] overflow-hidden flex flex-col items-center justify-center p-6 border aspect-video w-full ${
          isLive && item ? "border-accent/40" : "border-line"
        }`}
        aria-label={`${label} display`}
      >
        {item ? (
          <div className="flex flex-col items-center justify-center text-center max-w-[85%]">
            <p className={`m-0 leading-[1.6] text-ink ${isSong ? "font-serif text-[15px] italic" : "font-serif text-[14px]"}`}>
              {isSong ? item.reference : item.text}
            </p>
            <div className="mt-3">
              <span className="font-sans text-[10px] font-medium tracking-[0.16em] text-accent uppercase">
                {isSong ? "" : item.reference}
              </span>
              {!isSong && item.translation && (
                <span className="font-sans text-[9px] tracking-wider text-ink-3 ml-2">
                  {item.translation}
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="m-0 text-[11px] text-muted text-center tracking-wider uppercase">
            {label === "PREVIEW" ? "No pending content" : "Display cleared"}
          </p>
        )}
      </div>
      {label === "PREVIEW" && (
        <div className="flex gap-2 mt-2 px-0.5">
          <button
            className="text-[10px] font-medium tracking-[0.1em] uppercase px-3 py-1 rounded-[3px] border border-accent text-accent bg-transparent cursor-pointer transition-colors hover:bg-accent-soft disabled:opacity-30 disabled:cursor-default"
            onClick={onApprove}
            disabled={!item}
          >
            APPROVE
          </button>
          <button
            className="text-[10px] font-medium tracking-[0.1em] uppercase px-3 py-1 rounded-[3px] border border-line text-ink-3 bg-transparent cursor-pointer transition-colors hover:border-line-strong hover:text-ink disabled:opacity-30 disabled:cursor-default"
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
            className="text-ink-3 hover:text-ink bg-transparent border border-line rounded-[3px] w-6 h-6 flex items-center justify-center cursor-pointer transition-colors"
            onClick={onPrev}
            aria-label="Previous"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M6 2L3 5l3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button
            className="text-[10px] font-medium tracking-[0.1em] uppercase px-3 py-1 rounded-[3px] border border-line text-ink-3 bg-transparent cursor-pointer transition-colors hover:border-line-strong hover:text-ink"
            onClick={onClear}
          >
            CLEAR CONTENT
          </button>
          <button
            className="text-ink-3 hover:text-ink bg-transparent border border-line rounded-[3px] w-6 h-6 flex items-center justify-center cursor-pointer transition-colors"
            onClick={onNext}
            aria-label="Next"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M4 2l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Full-width Preview Panels ────────────────────────────────────────────────

function PreviewPanels() {
  const { queue, live, approve, skip, clearLive, next, prev } = useQueue();
  const pending = queue[0] ?? null;

  return (
    <div className="flex gap-3 px-4 pt-3 pb-4 border-b border-line shrink-0">
      <MiniDisplay
        label="PREVIEW"
        item={pending}
        onApprove={() => pending && approve(pending.id).catch(toastError("Failed to approve item"))}
        onSkip={() => pending && skip(pending.id).catch(toastError("Failed to skip item"))}
      />
      <MiniDisplay
        label="LIVE"
        item={live}
        isLive
        onClear={() => clearLive().catch(toastError("Failed to clear live item"))}
        onPrev={() => prev().catch(toastError("Failed to go to previous item"))}
        onNext={() => next().catch(toastError("Failed to go to next item"))}
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
  const { live } = useQueue();

  // Track live item changes to build the log
  const lastLiveRef = useState<string | null>(null);
  if (live && live.reference !== lastLiveRef[0]) {
    lastLiveRef[1](live.reference);
    setEntries((prev) => {
      const last = prev[prev.length - 1];
      if (last?.reference === live.reference) return prev;
      return [
        ...prev.slice(-19),
        {
          id: ++_logId,
          ts: Date.now(),
          label: live.kind === "song" ? "♪ SONG" : "MATCH",
          reference: live.reference,
        },
      ];
    });
  }

  const fmt = (ts: number) => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col min-h-0 overflow-hidden pt-3">
      <span className="text-[10px] font-medium tracking-[0.14em] text-ink-3 uppercase mb-2 shrink-0">
        DETECTION LOG
      </span>
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-0.5 [scrollbar-width:thin] [scrollbar-color:var(--color-line-strong)_transparent]">
        {entries.length === 0 ? (
          <p className="text-[11px] text-muted m-0">No events yet.</p>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="flex items-baseline gap-2">
              <span className="font-mono text-[9px] text-ink-3 shrink-0">{fmt(e.ts)}</span>
              <span className="text-[10px] text-ink-2 shrink-0">{e.label}</span>
              <span className="text-[10px] text-accent truncate">{e.reference}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── OperatorPage ─────────────────────────────────────────────────────────────

const MODE_LABEL: Record<DetectionMode, string> = {
  auto: "AUTO",
  copilot: "COPILOT",
  airplane: "AIRPLANE",
  offline: "OFFLINE",
};

const MODE_COLOR: Record<DetectionMode, string> = {
  auto:     "text-accent border-accent/40",
  copilot:  "text-ink border-line",
  airplane: "text-danger border-danger/40",
  offline:  "text-ink-3 border-line/40",
};

const MODE_DESCRIPTION: Record<DetectionMode, string> = {
  auto:     "Auto — detections go live immediately",
  copilot:  "Copilot — detections queue for approval",
  airplane: "Airplane — detection disabled",
  offline:  "Offline — local detection only",
};

export function OperatorPage({ identity, onOpenArtifacts }: OperatorPageProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [displayView, setDisplayView] = useState<"audience" | "stage">("audience");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [activeMode, setActiveMode] = useState<DetectionMode>("copilot");

  return (
    <div data-qa="operator-root" className="flex flex-col h-screen bg-bg text-ink font-sans overflow-hidden">

      {/* ── Title bar ────────────────────────────────────────────────────── */}
      <header data-qa="operator-titlebar" className="h-9 bg-bg-1 flex items-center justify-between px-4 border-b border-line shrink-0">
        <div className="flex items-center gap-2">
          <span data-qa="operator-appname" className="font-serif text-[15px] text-ink">openworship</span>
          <span className="text-ink-3" aria-hidden="true">/</span>
          <span data-qa="operator-branch" className="font-mono text-[11px] text-ink-3 tracking-[0.04em]">{identity.branch_name}</span>
        </div>
        <div className="flex items-center gap-3">
          <span
            data-qa="active-mode-badge"
            className={`font-mono text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-[3px] border ${MODE_COLOR[activeMode]}`}
            title={MODE_DESCRIPTION[activeMode]}
          >
            {MODE_LABEL[activeMode]}
          </span>
          <TranslationSwitcher />

          {/* AUDIENCE / STAGE toggle */}
          <div className="flex items-stretch h-5 rounded overflow-hidden border border-line">
            {(["audience", "stage"] as const).map((v) => (
              <button
                key={v}
                className={`font-mono text-[10px] tracking-[0.1em] px-3 border-none cursor-pointer transition-colors uppercase border-r border-line last:border-r-0 ${
                  displayView === v
                    ? "bg-accent text-[#1A0D00] font-semibold"
                    : "bg-transparent text-ink-3 hover:text-ink"
                }`}
                onClick={() => setDisplayView(v)}
                aria-pressed={displayView === v}
              >
                {v}
              </button>
            ))}
          </div>

          {onOpenArtifacts && (
            <button
              data-qa="open-artifacts-btn"
              className="bg-transparent border-none text-ink-3 cursor-pointer p-1 flex items-center justify-center transition-colors hover:text-ink"
              onClick={onOpenArtifacts}
              title="Artifacts"
              aria-label="Open artifacts"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </button>
          )}
          <button
            data-qa="open-settings-btn"
            className="bg-transparent border-none text-ink-3 cursor-pointer p-1 flex items-center justify-center transition-colors hover:text-ink"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            aria-label="Open settings"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M6.5 1h3l.5 1.5a5.5 5.5 0 0 1 1.2.7l1.5-.5 1.5 2.6-1.2 1a5.6 5.6 0 0 1 0 1.4l1.2 1-1.5 2.6-1.5-.5a5.5 5.5 0 0 1-1.2.7L9.5 15h-3l-.5-1.5a5.5 5.5 0 0 1-1.2-.7l-1.5.5L1.8 10.8l1.2-1a5.6 5.6 0 0 1 0-1.4l-1.2-1 1.5-2.6 1.5.5A5.5 5.5 0 0 1 6 2.5L6.5 1Z"
                stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"
              />
              <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        </div>
      </header>

      {settingsOpen && (
        <SettingsModal
          identity={identity}
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
            "flex flex-col shrink-0 bg-bg-1 border-r border-line overflow-hidden",
            "transition-[width] duration-200 ease-linear",
            leftOpen ? "w-56" : "w-10",
          ].join(" ")}
        >
          {/* Collapse toggle */}
          <button
            className="h-8 shrink-0 flex items-center justify-center text-ink-3 hover:text-ink border-b border-line transition-colors bg-transparent cursor-pointer"
            onClick={() => setLeftOpen((v) => !v)}
            title={leftOpen ? "Collapse schedule panel" : "Expand schedule panel"}
            aria-label={leftOpen ? "Collapse schedule panel" : "Expand schedule panel"}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              {leftOpen ? (
                <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
          </button>

          {leftOpen && (
            <>
              <div className="shrink-0 p-4 border-b border-line">
                <span className="block text-[10px] font-medium tracking-[0.14em] text-ink-3 uppercase mb-3">
                  CONTENT BANK
                </span>
                <div className="overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--color-line-strong)_transparent]" style={{ maxHeight: "200px" }}>
                  <ScriptureSearch />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 min-h-0 [scrollbar-width:thin] [scrollbar-color:var(--color-line-strong)_transparent]">
                <SchedulePanel />
              </div>
            </>
          )}

          {!leftOpen && (
            <div className="flex flex-col items-center pt-3 gap-3">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-ink-3 shrink-0" aria-label="Content Bank">
                <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.1" />
                <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-ink-3 shrink-0" aria-label="Schedule">
                <rect x="1.5" y="2.5" width="11" height="10" rx="1" stroke="currentColor" strokeWidth="1.1" />
                <path d="M1.5 5.5h11" stroke="currentColor" strokeWidth="1.1" />
                <path d="M4.5 1v3M9.5 1v3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
            </div>
          )}
        </aside>

        {/* Center — Transcript ─────────────────────────────────────────── */}
        <main data-qa="operator-col-center" className="flex flex-col flex-1 overflow-hidden min-h-0 bg-bg">
          <div className="flex-1 overflow-hidden min-h-0">
            <TranscriptPanel />
          </div>
        </main>

        {/* Right — Queue + Detection Log ───────────────────────────────── */}
        <aside
          data-qa="operator-col-right"
          data-open={rightOpen}
          className={[
            "flex flex-col shrink-0 bg-bg-1 border-l border-line overflow-hidden",
            "transition-[width] duration-200 ease-linear",
            rightOpen ? "w-60" : "w-10",
          ].join(" ")}
        >
          <button
            className="h-8 shrink-0 flex items-center justify-center text-ink-3 hover:text-ink border-b border-line transition-colors bg-transparent cursor-pointer"
            onClick={() => setRightOpen((v) => !v)}
            title={rightOpen ? "Collapse queue panel" : "Expand queue panel"}
            aria-label={rightOpen ? "Collapse queue panel" : "Expand queue panel"}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              {rightOpen ? (
                <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
          </button>

          {rightOpen && (
            <>
              <div className="flex-1 overflow-hidden min-h-0 p-4 flex flex-col">
                <DetectionQueue />
              </div>
              <div className="h-px bg-line shrink-0" />
              <div className="shrink-0 overflow-hidden flex flex-col px-4 pb-4" style={{ height: "35%" }}>
                <DetectionLog />
              </div>
            </>
          )}

          {!rightOpen && (
            <div className="flex flex-col items-center pt-3 gap-3">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-ink-3 shrink-0" aria-label="Queue">
                <path d="M2 4h10M2 7h10M2 10h6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-ink-3 shrink-0" aria-label="Detection Log">
                <rect x="1.5" y="1.5" width="11" height="11" rx="1" stroke="currentColor" strokeWidth="1.1" />
                <path d="M4 5h6M4 7.5h4M4 10h2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
