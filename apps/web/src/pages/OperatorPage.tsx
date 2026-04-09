import { useCallback, useEffect, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { DetectionQueue } from "../components/DetectionQueue";
import { ModeToolbar } from "../components/ModeToolbar";
import { ScriptureSearch } from "../components/ScriptureSearch";
import { SchedulePanel } from "../components/SchedulePanel";
import { SettingsModal } from "../components/SettingsModal";
import { TranscriptPanel } from "../components/TranscriptPanel";
import { invoke } from "../lib/tauri";
import type { ChurchIdentity, QueueItem, ThemeMode, TranslationInfo } from "../lib/types";

interface OperatorPageProps {
  identity: ChurchIdentity;
  onOpenArtifacts?: () => void;
  theme?: ThemeMode;
  onSetTheme?: (mode: ThemeMode) => void;
}

// ─── Translation Switcher ────────────────────────────────────────────────────

function TranslationSwitcher() {
  const [translations, setTranslations] = useState<TranslationInfo[]>([]);
  const [active, setActive] = useState("KJV");

  const load = useCallback(async () => {
    try {
      const [list, current] = await Promise.all([
        invoke<TranslationInfo[]>("list_translations"),
        invoke<string>("get_active_translation"),
      ]);
      setTranslations(list);
      setActive(current);
    } catch {
      // Backend not ready yet
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const translation = e.target.value;
    setActive(translation);
    try {
      await invoke("switch_live_translation", { translation });
    } catch {
      load();
    }
  };

  if (translations.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <label className="text-[10px] text-smoke tracking-[0.06em] uppercase" htmlFor="translation-select">
        Translation
      </label>
      <select
        data-qa="translation-select"
        id="translation-select"
        className="appearance-none bg-iron text-chalk border border-steel rounded-[3px] text-[11px] font-mono pt-[2px] pb-[2px] pl-[6px] pr-5 cursor-pointer min-w-[52px] transition-colors focus:outline focus:outline-1 focus:outline-gold focus:outline-offset-[1px]"
        value={active}
        onChange={handleChange}
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
}

function MiniDisplay({ label, item, isLive }: MiniDisplayProps) {
  const isSong = item?.kind === "song";
  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Panel label row */}
      <div className="flex items-center gap-2 mb-1.5 px-0.5">
        <span className="text-[9px] font-semibold tracking-[0.16em] text-smoke uppercase">{label}</span>
        {isLive && item && (
          <span className="w-1.5 h-1.5 rounded-full bg-gold [box-shadow:0_0_6px_var(--color-gold)] shrink-0" />
        )}
      </div>
      {/* Display panel — 16:9 aspect ratio, fills half the full width */}
      <div
        className={`relative bg-void rounded-[3px] overflow-hidden flex flex-col justify-end p-4 border aspect-video w-full ${
          isLive && item
            ? "border-gold/40 [box-shadow:inset_0_0_40px_rgba(201,168,76,0.04)]"
            : "border-iron/60"
        }`}
        aria-label={`${label} display`}
      >
        {item ? (
          <>
            {/* Reference — top-left */}
            <div className="absolute top-3 left-4">
              <span className="font-sans text-[10px] font-medium tracking-[0.16em] text-gold uppercase">
                {item.reference}
              </span>
              {!isSong && item.translation && (
                <span className="block font-sans text-[9px] tracking-wider text-ash/60 mt-0.5">
                  {item.translation}
                </span>
              )}
            </div>
            {/* Body text */}
            <p className={`m-0 leading-[1.5] text-chalk line-clamp-3 ${isSong ? "font-serif text-[15px] italic" : "font-serif text-[13px]"}`}>
              {isSong ? item.reference : item.text}
            </p>
          </>
        ) : (
          <p className="m-0 text-[11px] text-smoke/40 text-center w-full absolute inset-0 flex items-center justify-center tracking-wider uppercase">
            {label === "PREVIEW" ? "No pending content" : "Display cleared"}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Full-width Preview Panels ────────────────────────────────────────────────

function PreviewPanels() {
  const [items, setItems] = useState<QueueItem[]>([]);

  useEffect(() => {
    invoke<QueueItem[]>("get_queue").then(setItems).catch(console.error);
    let unlisten: UnlistenFn | null = null;
    listen<QueueItem[]>("detection://queue-updated", (e) => setItems(e.payload)).then(
      (fn) => { unlisten = fn; }
    );
    return () => { unlisten?.(); };
  }, []);

  const pending = items.find((i) => i.status === "pending") ?? null;
  const live = items.find((i) => i.status === "live") ?? null;

  return (
    <div className="flex gap-3 px-4 pt-3 pb-3 border-b border-iron shrink-0">
      <MiniDisplay label="PREVIEW" item={pending} />
      <MiniDisplay label="LIVE" item={live} isLive />
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
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
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
              <span className="font-mono text-[9px] text-smoke shrink-0">{fmt(e.ts)}</span>
              <span className="text-[10px] text-ash shrink-0">{e.label}</span>
              <span className="text-[10px] text-gold truncate">{e.reference}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Theme cycle ──────────────────────────────────────────────────────────────

const THEME_CYCLE: ThemeMode[] = ["system", "dark", "light"];

// ─── OperatorPage ─────────────────────────────────────────────────────────────

export function OperatorPage({ identity, onOpenArtifacts, theme = "system", onSetTheme }: OperatorPageProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [displayView, setDisplayView] = useState<"audience" | "stage">("audience");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  return (
    <div data-qa="operator-root" className="flex flex-col h-screen bg-void text-chalk font-sans overflow-hidden">

      {/* ── Title bar ────────────────────────────────────────────────────── */}
      <header data-qa="operator-titlebar" className="h-9 bg-void flex items-center justify-between px-4 border-b border-iron shrink-0">
        <div className="flex items-center gap-2">
          <span data-qa="operator-appname" className="text-xs text-ash tracking-[0.08em] font-normal">openworship</span>
          <span className="text-[11px] text-smoke" aria-hidden="true">/</span>
          <span data-qa="operator-branch" className="font-mono text-[11px] text-ash tracking-[0.04em]">{identity.branch_name}</span>
        </div>
        <div className="flex items-center gap-3">
          <TranslationSwitcher />

          {/* AUDIENCE / STAGE toggle */}
          <div className="flex items-stretch h-5 rounded-sm overflow-hidden border border-iron">
            {(["audience", "stage"] as const).map((v) => (
              <button
                key={v}
                className={`font-sans text-[10px] font-medium tracking-[0.1em] px-3 border-none cursor-pointer transition-colors uppercase ${
                  displayView === v
                    ? "bg-gold text-void"
                    : "bg-transparent text-ash hover:text-chalk"
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
              className="bg-transparent border-none text-ash cursor-pointer p-1 flex items-center justify-center transition-colors hover:text-chalk hover:bg-white/[0.06]"
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
          {onSetTheme && (
            <button
              data-qa="toggle-theme-btn"
              className="bg-transparent border-none text-ash cursor-pointer p-1 flex items-center justify-center transition-colors hover:text-chalk hover:bg-white/[0.06]"
              onClick={() => {
                const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length];
                onSetTheme(next);
              }}
              title={`Theme: ${theme} — click to cycle`}
              aria-label="Cycle theme"
            >
              {theme === "light" ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.2" />
                  <line x1="8" y1="1" x2="8" y2="3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <line x1="8" y1="13" x2="8" y2="15" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <line x1="1" y1="8" x2="3" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <line x1="13" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <line x1="2.9" y1="2.9" x2="4.3" y2="4.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <line x1="11.7" y1="11.7" x2="13.1" y2="13.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <line x1="11.7" y1="4.3" x2="13.1" y2="2.9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <line x1="2.9" y1="13.1" x2="4.3" y2="11.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              ) : theme === "dark" ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M13.5 10A6 6 0 0 1 6 2.5a6 6 0 1 0 7.5 7.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="1.5" y="2" width="13" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" />
                  <line x1="5" y1="14" x2="11" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <line x1="8" y1="11" x2="8" y2="14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              )}
            </button>
          )}
          <button
            data-qa="open-settings-btn"
            className="bg-transparent border-none text-ash cursor-pointer p-1 flex items-center justify-center transition-colors hover:text-chalk hover:bg-white/[0.06]"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            aria-label="Open settings"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M6.5 1h3l.5 1.5a5.5 5.5 0 0 1 1.2.7l1.5-.5 1.5 2.6-1.2 1a5.6 5.6 0 0 1 0 1.4l1.2 1-1.5 2.6-1.5-.5a5.5 5.5 0 0 1-1.2.7L9.5 15h-3l-.5-1.5a5.5 5.5 0 0 1-1.2-.7l-1.5.5L1.8 10.8l1.2-1a5.6 5.6 0 0 1 0-1.4l-1.2-1 1.5-2.6 1.5.5A5.5 5.5 0 0 1 6 2.5L6.5 1Z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
              <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        </div>
      </header>

      {settingsOpen && (
        <SettingsModal
          identity={identity}
          theme={theme}
          onSetTheme={onSetTheme}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* ── Mode toolbar ─────────────────────────────────────────────────── */}
      <ModeToolbar />

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

          {/* Expanded content */}
          {leftOpen && (
            <>
              {/* Schedule */}
              <div className="flex-1 overflow-y-auto p-4 min-h-0 [scrollbar-width:thin] [scrollbar-color:var(--color-iron)_transparent]">
                <SchedulePanel />
              </div>

              {/* Divider */}
              <div className="h-px bg-iron shrink-0" />

              {/* Content Bank — scripture search */}
              <div className="shrink-0 p-4" style={{ maxHeight: "40%" }}>
                <span className="block text-[10px] font-medium tracking-[0.14em] text-smoke uppercase mb-3">
                  CONTENT BANK
                </span>
                <div className="overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--color-iron)_transparent]" style={{ maxHeight: "200px" }}>
                  <ScriptureSearch />
                </div>
              </div>
            </>
          )}

          {/* Icon rail when collapsed */}
          {!leftOpen && (
            <div className="flex flex-col items-center pt-3 gap-3">
              {/* Calendar icon for Schedule */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-smoke shrink-0" aria-label="Schedule">
                <rect x="1.5" y="2.5" width="11" height="10" rx="1" stroke="currentColor" strokeWidth="1.1" />
                <path d="M1.5 5.5h11" stroke="currentColor" strokeWidth="1.1" />
                <path d="M4.5 1v3M9.5 1v3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
              {/* Search icon for Content Bank */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-smoke shrink-0" aria-label="Content Bank">
                <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.1" />
                <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
            </div>
          )}
        </aside>

        {/* Center — Transcript ─────────────────────────────────────────── */}
        <main data-qa="operator-col-center" className="flex flex-col flex-1 overflow-hidden min-h-0 bg-void">
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
              <div className="shrink-0 overflow-hidden flex flex-col px-4 pb-4" style={{ height: "35%" }}>
                <DetectionLog />
              </div>
            </>
          )}

          {/* Icon rail when collapsed */}
          {!rightOpen && (
            <div className="flex flex-col items-center pt-3 gap-3">
              {/* Queue icon */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-smoke shrink-0" aria-label="Queue">
                <path d="M2 4h10M2 7h10M2 10h6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
              {/* Log icon */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-smoke shrink-0" aria-label="Detection Log">
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
