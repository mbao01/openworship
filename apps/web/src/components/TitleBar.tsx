import { useCallback, useEffect, useState } from "react";
import type {
  ChurchIdentity,
  DetectionMode,
  ThemeMode,
  TranslationInfo,
} from "../lib/types";
import { invoke } from "../lib/tauri";
import {
  DatabaseIcon,
  MonitorIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
} from "lucide-react";

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

  useEffect(() => {
    load();
  }, [load]);

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
      <label
        className="text-[10px] text-ash tracking-[0.06em] uppercase"
        htmlFor="translation-select"
      >
        Default
      </label>
      <select
        data-qa="translation-select"
        id="translation-select"
        className="appearance-none bg-iron text-chalk border border-steel rounded-[3px] text-[11px] font-mono pt-[2px] pb-[2px] pl-[6px] pr-5 cursor-pointer min-w-[52px] transition-colors focus:outline focus:outline-gold focus:outline-offset-1"
        value={active}
        onChange={handleChange}
        title="Switch Bible translation"
      >
        {translations.map((t) => (
          <option key={t.id} value={t.id}>
            {t.abbreviation}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Theme cycle ──────────────────────────────────────────────────────────────

const THEME_CYCLE: ThemeMode[] = ["system", "dark", "light"];

// ─── OperatorPage ─────────────────────────────────────────────────────────────

const MODE_DESCRIPTION: Record<DetectionMode, string> = {
  auto: "Auto — detections go live immediately",
  copilot: "Copilot — detections queue for approval",
  airplane: "Airplane — detection disabled",
  offline: "Offline — local detection only",
};

export const TitleBar = ({
  identity,
  activeMode,
  onOpenArtifacts,
  theme,
  onSetTheme,
  setSettingsOpen,
}: {
  identity: ChurchIdentity;
  activeMode: DetectionMode;
  onOpenArtifacts?: () => void;
  theme?: ThemeMode;
  setSettingsOpen: (open: boolean) => void;
  onSetTheme?: (mode: ThemeMode) => void;
}) => {
  const [displayView, setDisplayView] = useState<"audience" | "stage">(
    "audience",
  );

  return (
    <header
      data-qa="operator-titlebar"
      className="h-9 bg-void flex items-center justify-between px-4 border-b border-iron shrink-0"
    >
      <div className="flex items-center gap-2">
        <span
          data-qa="operator-appname"
          className="text-xs font-bold tracking-[0.08em] text-gold"
        >
          openworship
        </span>
        <span className="text-[11px] text-smoke" aria-hidden="true">
          /
        </span>
        <span
          data-qa="operator-branch"
          className="font-mono text-[11px] text-ash tracking-[0.04em]"
        >
          {identity.branch_name}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span
          data-qa="active-mode-badge"
          className="font-sans text-[10px] font-medium tracking-widest uppercase px-2 py-0.5 rounded-sm border text-chalk border-iron"
          title={MODE_DESCRIPTION[activeMode]}
        >
          Mode: {activeMode.toUpperCase()}
        </span>
        <TranslationSwitcher />

        {/* AUDIENCE / STAGE toggle */}
        <div className="flex items-stretch h-5 rounded-sm overflow-hidden border border-iron">
          {(["audience", "stage"] as const).map((v) => (
            <button
              key={v}
              className={`font-sans text-[10px] font-medium tracking-widest px-3 border-none cursor-pointer transition-colors uppercase ${
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
            className="bg-transparent border-none text-ash cursor-pointer p-1 flex items-center justify-center transition-colors hover:text-chalk hover:bg-white/6"
            onClick={onOpenArtifacts}
            title="Artifacts"
            aria-label="Open artifacts"
          >
            <DatabaseIcon className="w-4 h-4 shrink-0" />
          </button>
        )}
        {onSetTheme && (
          <button
            data-qa="toggle-theme-btn"
            className="bg-transparent border-none text-ash cursor-pointer p-1 flex items-center justify-center transition-colors hover:text-chalk hover:bg-white/6"
            onClick={() => {
              const next =
                THEME_CYCLE[
                  (THEME_CYCLE.indexOf(theme!) + 1) % THEME_CYCLE.length
                ];
              onSetTheme(next);
            }}
            title={`Theme: ${theme} — click to cycle`}
            aria-label="Cycle theme"
          >
            {theme === "light" ? (
              <MoonIcon className="w-4 h-4 shrink-0" />
            ) : theme === "dark" ? (
              <SunIcon className="w-4 h-4 shrink-0" />
            ) : (
              <MonitorIcon className="w-4 h-4 shrink-0" />
            )}
          </button>
        )}
        <button
          data-qa="open-settings-btn"
          className="bg-transparent border-none text-ash cursor-pointer p-1 flex items-center justify-center transition-colors hover:text-chalk hover:bg-white/6"
          onClick={() => setSettingsOpen(true)}
          title="Settings"
          aria-label="Open settings"
        >
          <SettingsIcon className="w-4 h-4 shrink-0" />
        </button>
      </div>
    </header>
  );
};
