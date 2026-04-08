import { useCallback, useEffect, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { ContentPanel } from "../components/ContentPanel";
import { DetectionQueue } from "../components/DetectionQueue";
import { ModeToolbar } from "../components/ModeToolbar";
import { SchedulePanel } from "../components/SchedulePanel";
import { SettingsModal } from "../components/SettingsModal";
import { SongLibrary } from "../components/SongLibrary";
import { SummaryPanel } from "../components/SummaryPanel";
import { TranscriptPanel } from "../components/TranscriptPanel";
import { invoke } from "../lib/tauri";
import type { ChurchIdentity, DetectionMode, QueueItem, TranslationInfo } from "../lib/types";

interface OperatorPageProps {
  identity: ChurchIdentity;
  onOpenArtifacts?: () => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
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
      // Backend not ready yet — switcher stays hidden until next render
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const translation = e.target.value;
    setActive(translation);
    try {
      await invoke("switch_live_translation", { translation });
    } catch {
      // revert on error
      load();
    }
  };

  if (translations.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <label
        className="text-[10px] text-smoke tracking-[0.06em] uppercase"
        htmlFor="translation-select"
      >
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

// ─── Copilot Mode: Featured Detection Card ───────────────────────────────────

function CopilotFeaturedDetection() {
  const [items, setItems] = useState<QueueItem[]>([]);

  useEffect(() => {
    invoke<QueueItem[]>("get_queue").then(setItems).catch(console.error);
    let unlisten: UnlistenFn | null = null;
    listen<QueueItem[]>("detection://queue-updated", (e) => setItems(e.payload)).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  const top = items.find((i) => i.status === "pending");
  if (!top) return null;

  function handleApprove() { invoke("approve_item", { id: top!.id }).catch(console.error); }
  function handleDismiss() { invoke("dismiss_item", { id: top!.id }).catch(console.error); }

  return (
    <div
      data-qa="copilot-featured-detection"
      className="mx-6 mt-4 mb-0 border border-gold-muted/40 border-l-2 border-l-gold rounded-sm p-4 bg-slate shrink-0"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-medium tracking-[0.16em] text-gold uppercase">AI Suggestion</span>
        {top.kind === "song" && <span className="text-[11px] text-gold">♪</span>}
        <span className="text-xs font-medium text-chalk ml-auto">{top.reference}</span>
        {top.translation && top.kind !== "song" && (
          <span className="font-mono text-[10px] text-ash">{top.translation}</span>
        )}
      </div>
      {top.kind !== "song" && (
        <p className="text-sm leading-[1.5] text-ash m-0 mb-3 line-clamp-2">{top.text}</p>
      )}
      {top.confidence != null && (
        <div className="h-[2px] bg-iron rounded-sm mb-3">
          <div className="h-full bg-gold rounded-sm" style={{ width: `${Math.round(top.confidence * 100)}%` }} />
        </div>
      )}
      <div className="flex gap-2">
        <button
          data-qa="copilot-approve-btn"
          className="font-sans text-[11px] font-medium tracking-[0.08em] text-void bg-gold border-none rounded-sm px-3 py-1.5 cursor-pointer uppercase hover:brightness-110 transition-all"
          onClick={handleApprove}
        >
          APPROVE
        </button>
        <button
          data-qa="copilot-dismiss-btn"
          className="font-sans text-[11px] font-medium tracking-[0.08em] text-chalk bg-transparent border border-iron rounded-sm px-3 py-1.5 cursor-pointer uppercase hover:border-ash transition-colors"
          onClick={handleDismiss}
        >
          DISMISS
        </button>
      </div>
    </div>
  );
}

export function OperatorPage({ identity, onOpenArtifacts, isDark = true, onToggleTheme }: OperatorPageProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mode, setMode] = useState<DetectionMode>("copilot");

  return (
    <div data-qa="operator-root" className="flex flex-col h-screen bg-void text-chalk font-sans overflow-hidden">
      {/* Custom title bar */}
      <header data-qa="operator-titlebar" className="h-9 bg-void flex items-center justify-between px-4 border-b border-iron shrink-0">
        <div className="flex items-center gap-2">
          <span data-qa="operator-appname" className="text-xs text-ash tracking-[0.08em] font-normal">openworship</span>
          <span className="text-[11px] text-smoke" aria-hidden="true">/</span>
          <span data-qa="operator-branch" className="font-mono text-[11px] text-ash tracking-[0.04em]">{identity.branch_name}</span>
        </div>
        <div className="flex items-center gap-3">
          <TranslationSwitcher />
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
          {onToggleTheme && (
            <button
              data-qa="toggle-theme-btn"
              className="bg-transparent border-none text-ash cursor-pointer p-1 flex items-center justify-center transition-colors hover:text-chalk hover:bg-white/[0.06]"
              onClick={onToggleTheme}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              aria-label="Toggle theme"
            >
              {isDark ? (
                /* Sun icon */
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
              ) : (
                /* Moon icon */
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M13.5 10A6 6 0 0 1 6 2.5a6 6 0 1 0 7.5 7.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
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
            {/* Gear icon — 16×16 SVG */}
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
        <SettingsModal identity={identity} onClose={() => setSettingsOpen(false)} />
      )}

      {/* Mode selector toolbar */}
      <ModeToolbar onModeChange={setMode} />

      {/* Main layout — three columns */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left: Schedule + Song Library + Summaries */}
        <aside data-qa="operator-col-left" className="flex flex-col overflow-hidden min-h-0 w-1/4 bg-obsidian border-r border-iron p-4 overflow-y-auto">
          <SchedulePanel />
          <div className="h-px bg-iron my-4 shrink-0" aria-hidden="true" />
          <SongLibrary />
          <div className="h-px bg-iron my-4 shrink-0" aria-hidden="true" />
          <ContentPanel />
          <div className="h-px bg-iron my-4 shrink-0" aria-hidden="true" />
          <SummaryPanel />
        </aside>

        {/* Center: Live transcript (+ Copilot featured detection when in copilot mode) */}
        <main data-qa="operator-col-center" className="flex flex-col overflow-hidden min-h-0 w-1/2 bg-void">
          {mode === "copilot" && <CopilotFeaturedDetection />}
          <TranscriptPanel />
        </main>

        {/* Right: Detection queue */}
        <aside data-qa="operator-col-right" className="flex flex-col overflow-hidden min-h-0 w-1/4 bg-obsidian border-l border-iron p-4">
          <DetectionQueue />
        </aside>
      </div>
    </div>
  );
}
