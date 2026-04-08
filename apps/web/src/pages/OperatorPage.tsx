import { useCallback, useEffect, useState } from "react";
import { DetectionQueue } from "../components/DetectionQueue";
import { SchedulePanel } from "../components/SchedulePanel";
import { SettingsModal } from "../components/SettingsModal";
import { SongLibrary } from "../components/SongLibrary";
import { TranscriptPanel } from "../components/TranscriptPanel";
import { invoke } from "../lib/tauri";
import type { ChurchIdentity, TranslationInfo } from "../lib/types";
import "../styles/operator.css";

interface OperatorPageProps {
  identity: ChurchIdentity;
  onOpenArtifacts?: () => void;
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
    <div className="translation-switcher">
      <label className="translation-switcher__label" htmlFor="translation-select">
        Translation
      </label>
      <select
        id="translation-select"
        className="translation-switcher__select"
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

export function OperatorPage({ identity, onOpenArtifacts }: OperatorPageProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="operator-root">
      {/* Custom title bar */}
      <header className="operator-titlebar">
        <div className="operator-titlebar__left">
          <span className="operator-appname">openworship</span>
          <span className="operator-titlebar__sep" aria-hidden="true">/</span>
          <span className="operator-branch">{identity.branch_name}</span>
        </div>
        <div className="operator-titlebar__right">
          <TranslationSwitcher />
          {onOpenArtifacts && (
            <button
              className="settings-gear-btn"
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
            className="settings-gear-btn"
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

      {/* Main layout — three columns */}
      <div className="operator-body">
        {/* Left: Schedule + Content Bank + Song Library */}
        <aside className="operator-col operator-col--left">
          <SchedulePanel />
          <div className="operator-divider" aria-hidden="true" />
          <SongLibrary />
        </aside>

        {/* Center: Live transcript */}
        <main className="operator-col operator-col--center">
          <TranscriptPanel />
        </main>

        {/* Right: Detection queue */}
        <aside className="operator-col operator-col--right">
          <DetectionQueue />
        </aside>
      </div>
    </div>
  );
}
