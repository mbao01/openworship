import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "../lib/tauri";
import type { AudioInputDevice, AudioSettings, BranchSyncStatus, ChurchIdentity, DisplaySettings, EmailSettings, EmailSubscriber, MonitorInfo, S3Config, SemanticStatus, StorageUsage, SttBackend, ThemeMode } from "../lib/types";

interface SettingsModalProps {
  identity: ChurchIdentity;
  theme?: ThemeMode;
  onSetTheme?: (mode: ThemeMode) => void;
  onClose: () => void;
}

type Category = "church" | "appearance" | "audio" | "display" | "detection" | "email" | "cloud" | "shortcuts" | "about";

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "church", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "audio", label: "Audio" },
  { id: "display", label: "Display" },
  { id: "detection", label: "Detection" },
  { id: "email", label: "Service" },
  { id: "cloud", label: "Cloud" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "about", label: "About" },
];

export function SettingsModal({ identity, theme = "system", onSetTheme, onClose }: SettingsModalProps) {
  const [activeCategory, setActiveCategory] = useState<Category>("church");
  const [audioSettings, setAudioSettings] = useState<AudioSettings>({
    backend: "whisper",
    deepgram_api_key: "",
    semantic_enabled: true,
    semantic_threshold_auto: 0.75,
    semantic_threshold_copilot: 0.82,
    lyrics_threshold_auto: 0.70,
    lyrics_threshold_copilot: 0.78,
    audio_input_device: null,
    theme: "system",
  });
  const [keyVisible, setKeyVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Load current settings on mount.
  useEffect(() => {
    invoke<AudioSettings>("get_audio_settings")
      .then(setAudioSettings)
      .catch((e) => console.error("[settings] load failed:", e));
  }, []);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const handleBackendChange = (backend: SttBackend) => {
    setAudioSettings((prev) => ({ ...prev, backend }));
  };

  const handleApiKeyChange = (deepgram_api_key: string) => {
    setAudioSettings((prev) => ({ ...prev, deepgram_api_key }));
  };

  const handleDeviceChange = (audio_input_device: string | null) => {
    setAudioSettings((prev) => ({ ...prev, audio_input_device }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await invoke("set_audio_settings", { settings: audioSettings });
    } catch (e) {
      setSaveError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      data-qa="settings-modal"
      className="fixed inset-0 z-[100] bg-void/80 flex items-center justify-center"
      ref={overlayRef}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div className="flex w-[780px] h-[600px] bg-obsidian border border-iron overflow-hidden rounded-sm shadow-2xl">
        {/* Left nav */}
        <nav className="w-[160px] shrink-0 bg-void border-r border-iron flex flex-col">
          <div className="flex items-center justify-between px-4 py-4 border-b border-iron shrink-0">
            <p className="text-[11px] font-medium tracking-[0.14em] text-chalk m-0">Settings</p>
            <button
              data-qa="settings-close-x-btn"
              className="w-5 h-5 flex items-center justify-center text-ash hover:text-chalk bg-transparent border-none cursor-pointer transition-colors rounded-sm hover:bg-white/[0.06]"
              onClick={onClose}
              aria-label="Close settings"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="flex-1 py-2 overflow-y-auto">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                data-qa={`settings-nav-${cat.id}`}
                className={[
                  "block w-full bg-transparent border-none border-l-2 py-2 px-4",
                  "text-left font-sans text-[13px] font-normal cursor-pointer transition-colors",
                  "hover:text-chalk hover:bg-white/[0.03]",
                  activeCategory === cat.id
                    ? "text-chalk border-l-gold"
                    : "text-ash border-l-transparent",
                ].join(" ")}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Right content area */}
        <div className="flex-1 flex flex-col overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--color-iron)_transparent] relative">
          {activeCategory === "church" && <ChurchSection identity={identity} />}
          {activeCategory === "audio" && (
            <AudioSection
              settings={audioSettings}
              keyVisible={keyVisible}
              onBackendChange={handleBackendChange}
              onApiKeyChange={handleApiKeyChange}
              onToggleKeyVisible={() => setKeyVisible((v) => !v)}
              onDeviceChange={handleDeviceChange}
            />
          )}
          {activeCategory === "appearance" && (
            <AppearanceSection theme={theme} onSetTheme={onSetTheme} />
          )}
          {activeCategory === "display" && <DisplaySection />}
          {activeCategory === "detection" && (
            <DetectionSection
              settings={audioSettings}
              onSettingsChange={(patch) =>
                setAudioSettings((prev) => ({ ...prev, ...patch }))
              }
            />
          )}
          {activeCategory === "email" && <EmailSection identity={identity} />}
          {activeCategory === "cloud" && <CloudSection />}
          {activeCategory === "shortcuts" && <ShortcutsSection />}
          {activeCategory === "about" && <AboutSection />}

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-iron shrink-0">
            {saveError && <span className="flex-1 text-xs text-ember">{saveError}</span>}
            <button
              data-qa="settings-close-btn"
              className="font-sans text-[11px] font-medium tracking-[0.08em] text-chalk bg-transparent border border-iron rounded-sm py-[6px] px-4 cursor-pointer transition-colors hover:border-ash uppercase"
              onClick={onClose}
            >
              {activeCategory === "church" || activeCategory === "appearance" || activeCategory === "shortcuts" || activeCategory === "about" ? "Close" : "Cancel"}
            </button>
            {activeCategory !== "church" && activeCategory !== "appearance" && activeCategory !== "shortcuts" && activeCategory !== "about" && (
              <button
                data-qa="settings-save-btn"
                className="font-sans text-[11px] font-medium tracking-[0.08em] text-void bg-gold border-none rounded-sm py-[6px] px-4 cursor-pointer transition-[filter] hover:brightness-[1.15] disabled:opacity-50 disabled:cursor-not-allowed uppercase"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Audio section ─────────────────────────────────────────────────────────────

interface ModelDownloadProgress {
  downloaded_bytes: number;
  total_bytes: number | null;
  percent: number | null;
}

interface AudioSectionProps {
  settings: AudioSettings;
  keyVisible: boolean;
  onBackendChange: (b: SttBackend) => void;
  onApiKeyChange: (k: string) => void;
  onToggleKeyVisible: () => void;
  onDeviceChange: (name: string | null) => void;
}

function AudioSection({
  settings,
  keyVisible,
  onBackendChange,
  onApiKeyChange,
  onToggleKeyVisible,
  onDeviceChange,
}: AudioSectionProps) {
  const [downloadState, setDownloadState] = useState<
    "idle" | "downloading" | "done" | "error"
  >("idle");
  const [downloadProgress, setDownloadProgress] = useState<ModelDownloadProgress | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);

  // Load device list on mount.
  useEffect(() => {
    invoke<AudioInputDevice[]>("list_audio_input_devices")
      .then(setDevices)
      .catch(() => {});
  }, []);

  // Poll audio level while tab is visible.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const level = await invoke<number>("get_audio_level");
        setAudioLevel(level);
      } catch {
        setAudioLevel(0);
      }
    }, 100);
    return () => clearInterval(id);
  }, []);

  // Subscribe to model download progress events from the Rust backend.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let unlistenComplete: (() => void) | undefined;

    listen<ModelDownloadProgress>("stt://model-download-progress", (evt) => {
      setDownloadProgress(evt.payload);
      setDownloadState("downloading");
    }).then((fn) => { unlisten = fn; });

    listen<string>("stt://model-download-complete", () => {
      setDownloadState("done");
      setDownloadProgress(null);
    }).then((fn) => { unlistenComplete = fn; });

    return () => {
      unlisten?.();
      unlistenComplete?.();
    };
  }, []);

  const handleDownload = async () => {
    setDownloadState("downloading");
    setDownloadError(null);
    setDownloadProgress(null);
    try {
      await invoke("download_whisper_model");
    } catch (e) {
      setDownloadState("error");
      setDownloadError(String(e));
    }
  };

  const formatBytes = (b: number) => {
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isDeepgram = settings.backend === "deepgram";
  const isWhisper = settings.backend === "whisper";
  const isOff = settings.backend === "off";

  // Normalise 0–1 RMS to a visual percentage with slight boost for visibility.
  const levelPct = Math.min(100, Math.round(audioLevel * 300));
  const levelColor = levelPct > 80 ? "bg-ember" : levelPct > 50 ? "bg-gold" : "bg-green-400";

  return (
    <div className="flex-1 p-6">
      <h2 className="text-[13px] font-medium tracking-[0.1em] text-chalk uppercase mb-6 pb-4 border-b border-iron">Audio</h2>

      {/* Input device selector */}
      <div className="mb-6">
        <p className="block text-[10px] font-medium tracking-[0.12em] text-ash uppercase mb-2">AUDIO INPUT DEVICE</p>
        <select
          data-qa="audio-input-device-select"
          className="w-full bg-slate border border-iron text-chalk font-sans text-[13px] py-2 px-3 rounded-sm outline-none focus:border-gold cursor-pointer transition-colors hover:border-ash appearance-none"
          value={settings.audio_input_device ?? ""}
          onChange={(e) => onDeviceChange(e.target.value || null)}
        >
          <option value="">System Default</option>
          {devices.map((d) => (
            <option key={d.name} value={d.name}>
              {d.name}{d.is_default ? " (default)" : ""}
            </option>
          ))}
        </select>
        {/* VU meter */}
        <div className="mt-3">
          <p className="text-[10px] font-medium tracking-[0.12em] text-ash uppercase mb-1">INPUT LEVEL</p>
          <div className="h-[4px] bg-iron rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-75 ${levelColor}`}
              style={{ width: `${levelPct}%` }}
            />
          </div>
          <p className="text-[10px] text-smoke mt-1">Live when STT is running</p>
        </div>
      </div>

      {/* STT Engine selector */}
      <div className="mb-6">
        <p className="block text-[10px] font-medium tracking-[0.12em] text-ash uppercase mb-2">SPEECH-TO-TEXT ENGINE</p>
        <div className="flex gap-2">
          <button
            data-qa="stt-backend-whisper"
            className={[
              "flex-1 flex flex-col gap-1 rounded-sm px-4 py-3 text-left cursor-pointer transition-colors",
              isWhisper ? "bg-gold/[0.07] border border-gold" : "bg-slate border border-iron hover:border-ash",
            ].join(" ")}
            onClick={() => onBackendChange("whisper")}
          >
            <span className={`font-sans text-xs font-medium tracking-[0.04em] ${isWhisper ? "text-gold" : "text-chalk"}`}>Whisper</span>
            <span className="text-[11px] text-ash leading-[1.4]">Offline — no internet required</span>
          </button>
          <button
            data-qa="stt-backend-deepgram"
            className={[
              "flex-1 flex flex-col gap-1 rounded-sm px-4 py-3 text-left cursor-pointer transition-colors",
              isDeepgram ? "bg-gold/[0.07] border border-gold" : "bg-slate border border-iron hover:border-ash",
            ].join(" ")}
            onClick={() => onBackendChange("deepgram")}
          >
            <span className={`font-sans text-xs font-medium tracking-[0.04em] ${isDeepgram ? "text-gold" : "text-chalk"}`}>Deepgram</span>
            <span className="text-[11px] text-ash leading-[1.4]">Online — lower latency streaming</span>
          </button>
          <button
            data-qa="stt-backend-off"
            className={[
              "flex-1 flex flex-col gap-1 rounded-sm px-4 py-3 text-left cursor-pointer transition-colors",
              isOff ? "bg-gold/[0.07] border border-gold" : "bg-slate border border-iron hover:border-ash",
            ].join(" ")}
            onClick={() => onBackendChange("off")}
          >
            <span className={`font-sans text-xs font-medium tracking-[0.04em] ${isOff ? "text-gold" : "text-chalk"}`}>Off</span>
            <span className="text-[11px] text-ash leading-[1.4]">Disable transcription</span>
          </button>
        </div>
      </div>

      {/* Deepgram API key — only shown when Deepgram is selected */}
      {isDeepgram && (
        <div className="mb-6">
          <p className="block text-[10px] font-medium tracking-[0.12em] text-ash uppercase mb-2">DEEPGRAM API KEY</p>
          <div className="flex items-center gap-2">
            <input
              data-qa="deepgram-api-key-input"
              className="flex-1 bg-transparent border-0 border-b border-iron/60 outline-none py-2 font-mono text-[13px] text-chalk tracking-[0.04em] transition-colors focus:border-gold placeholder:text-smoke placeholder:tracking-[0.02em]"
              type={keyVisible ? "text" : "password"}
              placeholder="dg_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={settings.deepgram_api_key}
              onChange={(e) => onApiKeyChange(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              className="bg-transparent border-none font-sans text-[11px] font-medium text-ash cursor-pointer px-1 transition-colors hover:text-chalk"
              onClick={onToggleKeyVisible}
            >
              {keyVisible ? "Hide" : "Show"}
            </button>
          </div>
          {!settings.deepgram_api_key && (
            <p className="text-xs text-smoke mt-2 leading-[1.5]">
              Key required. Without it, falls back to Whisper automatically.
            </p>
          )}
          <p className="text-xs text-smoke mt-2 leading-[1.5]">
            If the Deepgram connection fails, the engine falls back to Whisper automatically.
          </p>
        </div>
      )}

      {/* Whisper model download — shown when Whisper is selected */}
      {isWhisper && (
        <div className="mb-6">
          <p className="block text-[10px] font-medium tracking-[0.12em] text-ash uppercase mb-2">WHISPER MODEL</p>
          {downloadState === "done" ? (
            <p className="text-xs text-chalk mt-1 leading-[1.5]">
              Model ready — ggml-base.en.bin downloaded successfully.
            </p>
          ) : downloadState === "downloading" ? (
            <div className="mt-2">
              <div className="h-[3px] bg-iron rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-gold rounded-full transition-all duration-300"
                  style={{ width: downloadProgress?.percent != null ? `${downloadProgress.percent.toFixed(0)}%` : "100%", animationName: downloadProgress?.percent == null ? "pulse" : "none" }}
                />
              </div>
              <p className="text-[11px] text-ash">
                {downloadProgress
                  ? `${formatBytes(downloadProgress.downloaded_bytes)}${downloadProgress.total_bytes ? ` / ${formatBytes(downloadProgress.total_bytes)}` : ""}${downloadProgress.percent != null ? ` (${downloadProgress.percent.toFixed(0)}%)` : ""}`
                  : "Starting download…"}
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-smoke leading-[1.5] mb-3">
                Requires <span className="font-mono text-ash">ggml-base.en.bin</span> (~148 MB) at{" "}
                <span className="font-mono text-ash">~/.openworship/models/</span>. Download once; works offline.
              </p>
              {downloadState === "error" && downloadError && (
                <p className="text-xs text-ember mb-2">{downloadError}</p>
              )}
              <button
                data-qa="whisper-download-btn"
                className="font-sans text-[11px] font-medium tracking-[0.08em] text-void bg-gold border-none rounded-sm py-[6px] px-4 cursor-pointer transition-[filter] hover:brightness-[1.15]"
                onClick={handleDownload}
              >
                Download Model
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Detection section (Phase 9 Semantic) ────────────────────────────────────

interface DetectionSectionProps {
  settings: AudioSettings;
  onSettingsChange: (patch: Partial<AudioSettings>) => void;
}

function DetectionSection({ settings, onSettingsChange }: DetectionSectionProps) {
  const [semanticStatus, setSemanticStatus] = useState<SemanticStatus | null>(null);

  useEffect(() => {
    invoke<SemanticStatus>("get_semantic_status")
      .then(setSemanticStatus)
      .catch(() => {});
  }, []);

  const formatThreshold = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <div className="flex-1 p-6">
      <h2 className="text-[13px] font-medium tracking-[0.1em] text-chalk uppercase mb-6 pb-4 border-b border-iron">Detection</h2>

      {/* Semantic matching toggle */}
      <div className="mb-6">
        <p className="block text-[10px] font-medium tracking-[0.12em] text-ash uppercase mb-2">SEMANTIC SCRIPTURE MATCHING</p>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 cursor-pointer text-ash text-[13px]">
            <input
              type="checkbox"
              className="w-[14px] h-[14px] accent-gold cursor-pointer"
              checked={settings.semantic_enabled}
              onChange={(e) => onSettingsChange({ semantic_enabled: e.target.checked })}
            />
            <span>Enable paraphrase &amp; story-based detection</span>
          </label>
        </div>
        <p className="text-xs text-smoke mt-2 leading-[1.5]">
          Uses a bundled AI model (nomic-embed-text) to detect scripture references
          even when the exact book/chapter/verse is not spoken. No external setup
          required.
        </p>
      </div>

      {/* Semantic index status */}
      {settings.semantic_enabled && semanticStatus && (
        <div className="mb-6">
          <p className="block text-[10px] font-medium tracking-[0.12em] text-ash uppercase mb-2">INDEX STATUS</p>
          <div className="flex items-center gap-2 text-xs text-ash">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${semanticStatus.ready ? "bg-gold" : "bg-iron"}`}
              aria-hidden="true"
            />
            <span>
              {semanticStatus.ready
                ? `Ready — ${semanticStatus.verse_count.toLocaleString()} verses indexed`
                : "Building index…"}
            </span>
          </div>
        </div>
      )}

      {/* Confidence threshold sliders — only shown when semantic is enabled */}
      {settings.semantic_enabled && (
        <>
          <div className="mb-6">
            <p className="block text-[10px] font-medium tracking-[0.12em] text-ash uppercase mb-2">
              AUTO MODE THRESHOLD — {formatThreshold(settings.semantic_threshold_auto)}
            </p>
            <input
              className="w-full accent-gold cursor-pointer mt-1"
              type="range"
              min="0.5"
              max="0.99"
              step="0.01"
              value={settings.semantic_threshold_auto}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) onSettingsChange({ semantic_threshold_auto: v });
              }}
            />
            <p className="text-xs text-smoke mt-2 leading-[1.5]">
              Lower = more matches (may include false positives). Higher = stricter.
            </p>
          </div>

          <div className="mb-6">
            <p className="block text-[10px] font-medium tracking-[0.12em] text-ash uppercase mb-2">
              COPILOT MODE THRESHOLD — {formatThreshold(settings.semantic_threshold_copilot)}
            </p>
            <input
              className="w-full accent-gold cursor-pointer mt-1"
              type="range"
              min="0.5"
              max="0.99"
              step="0.01"
              value={settings.semantic_threshold_copilot}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) onSettingsChange({ semantic_threshold_copilot: v });
              }}
            />
            <p className="text-xs text-smoke mt-2 leading-[1.5]">
              Copilot mode requires your approval before display — a stricter threshold
              reduces noise in the suggestion queue.
            </p>
          </div>

          {/* Lyrics-specific thresholds */}
          <div className="mb-6">
            <p className="block text-[10px] font-medium tracking-[0.12em] text-ash uppercase mb-2">LYRICS CONTENT TYPE</p>
            <p className="text-xs text-smoke mt-2 leading-[1.5]">
              Separate thresholds for song lyric detection — typically set lower than
              scripture since lyric phrases are more colloquial.
            </p>
          </div>

          <div className="mb-6">
            <p className="block text-[10px] font-medium tracking-[0.12em] text-ash uppercase mb-2">
              LYRICS AUTO MODE THRESHOLD — {formatThreshold(settings.lyrics_threshold_auto)}
            </p>
            <input
              className="w-full accent-gold cursor-pointer mt-1"
              type="range"
              min="0.5"
              max="0.99"
              step="0.01"
              value={settings.lyrics_threshold_auto}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) onSettingsChange({ lyrics_threshold_auto: v });
              }}
            />
          </div>

          <div className="mb-6">
            <p className="block text-[10px] font-medium tracking-[0.12em] text-ash uppercase mb-2">
              LYRICS COPILOT MODE THRESHOLD — {formatThreshold(settings.lyrics_threshold_copilot)}
            </p>
            <input
              className="w-full accent-gold cursor-pointer mt-1"
              type="range"
              min="0.5"
              max="0.99"
              step="0.01"
              value={settings.lyrics_threshold_copilot}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) onSettingsChange({ lyrics_threshold_copilot: v });
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Display section (OPE-63) ─────────────────────────────────────────────────

function DisplaySection() {
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [settings, setSettings] = useState<DisplaySettings>({ selected_monitor_index: null, multi_output: false });
  const [windowOpen, setWindowOpen] = useState(false);
  const [obsUrl, setObsUrl] = useState("");
  const [obsCopied, setObsCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load state on mount.
  useEffect(() => {
    invoke<MonitorInfo[]>("list_monitors").then(setMonitors).catch(() => {});
    invoke<DisplaySettings>("get_display_settings").then(setSettings).catch(() => {});
    invoke<boolean>("get_display_window_open").then(setWindowOpen).catch(() => {});
    invoke<string>("get_obs_display_url").then(setObsUrl).catch(() => {});
  }, []);

  // Listen for monitor-disconnected events.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen("display://monitor-disconnected", () => {
      setError("Selected monitor disconnected — falling back to primary display.");
      invoke<MonitorInfo[]>("list_monitors").then(setMonitors).catch(() => {});
    }).then((fn) => { unlisten = fn; });
    return () => unlisten?.();
  }, []);

  const handleOpen = async (monitorIndex: number) => {
    setError(null);
    try {
      await invoke("open_display_window", { monitorIndex });
      setWindowOpen(true);
      setSettings((prev) => ({ ...prev, selected_monitor_index: monitorIndex }));
    } catch (e) {
      setError(String(e));
    }
  };

  const handleClose = async () => {
    setError(null);
    try {
      await invoke("close_display_window");
      setWindowOpen(false);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleMultiOutputToggle = async (enabled: boolean) => {
    const next = { ...settings, multi_output: enabled };
    setSettings(next);
    try {
      await invoke("set_display_settings", { settings: next });
    } catch (e) {
      setError(String(e));
    }
  };

  const handleCopyObsUrl = () => {
    if (!obsUrl) return;
    navigator.clipboard.writeText(obsUrl).then(() => {
      setObsCopied(true);
      setTimeout(() => setObsCopied(false), 1500);
    });
  };

  const resolutionLabel = (m: MonitorInfo) =>
    `${m.width} × ${m.height}${m.scale_factor !== 1 ? ` @${m.scale_factor}x` : ""}`;

  return (
    <div className="flex-1 p-6">
      <h2 className="text-[13px] font-medium tracking-[0.1em] text-chalk uppercase mb-6 pb-4 border-b border-iron">Display</h2>

      {error && (
        <p className="text-xs text-ember mb-4 leading-[1.5]">{error}</p>
      )}

      {/* Monitor list */}
      <div className="mb-6">
        <p className="block text-[10px] font-medium tracking-[0.12em] text-ash uppercase mb-2">OUTPUT MONITOR</p>
        {monitors.length === 0 ? (
          <p className="text-xs text-smoke leading-[1.5]">No monitors detected.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {monitors.map((m, idx) => {
              const isSelected = settings.selected_monitor_index === idx;
              const isActive = windowOpen && isSelected;
              return (
                <div
                  key={idx}
                  data-qa={`monitor-row-${idx}`}
                  className={[
                    "flex items-center justify-between rounded-sm px-4 py-3 border",
                    isActive
                      ? "bg-gold/[0.07] border-gold"
                      : "bg-slate border-iron",
                  ].join(" ")}
                >
                  <div className="flex flex-col gap-[2px]">
                    <div className="flex items-center gap-2">
                      <span className="font-sans text-[13px] font-medium text-chalk">{m.name}</span>
                      {m.is_primary && (
                        <span className="font-mono text-[9px] font-medium tracking-[0.1em] text-ash bg-iron/60 border border-iron rounded-sm px-[5px] py-[1px]">PRIMARY</span>
                      )}
                      {isActive && (
                        <span className="font-mono text-[9px] font-medium tracking-[0.1em] text-gold bg-gold/10 border border-gold/30 rounded-sm px-[5px] py-[1px]">ACTIVE</span>
                      )}
                    </div>
                    <span className="text-[11px] text-ash">{resolutionLabel(m)}</span>
                  </div>
                  <button
                    data-qa={`monitor-open-btn-${idx}`}
                    className={[
                      "font-sans text-[11px] font-medium tracking-[0.08em] border-none rounded-sm py-[6px] px-4 cursor-pointer transition-[filter]",
                      isActive
                        ? "text-void bg-gold hover:brightness-[1.15]"
                        : "text-chalk bg-iron/60 hover:bg-iron",
                    ].join(" ")}
                    onClick={() => isActive ? handleClose() : handleOpen(idx)}
                  >
                    {isActive ? "Close" : "Open Fullscreen"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs text-smoke mt-3 leading-[1.5]">
          Opens a dedicated fullscreen window on the selected monitor. Projector operators can close it with Escape.
        </p>
      </div>

      {/* Multi-output toggle */}
      {monitors.length > 1 && (
        <div className="mb-6">
          <p className="block text-[10px] font-medium tracking-[0.12em] text-ash uppercase mb-2">MULTI-OUTPUT</p>
          <label className="flex items-center gap-2 cursor-pointer text-ash text-[13px]">
            <input
              type="checkbox"
              className="w-[14px] h-[14px] accent-gold cursor-pointer"
              checked={settings.multi_output}
              onChange={(e) => handleMultiOutputToggle(e.target.checked)}
            />
            <span>Mirror content on all connected displays</span>
          </label>
          <p className="text-xs text-smoke mt-2 leading-[1.5]">
            When enabled, "Open Fullscreen" opens windows on every monitor simultaneously.
          </p>
        </div>
      )}

      {/* OBS browser source URL */}
      <div className="mb-6">
        <p className="block text-[10px] font-medium tracking-[0.12em] text-ash uppercase mb-2">OBS BROWSER SOURCE</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="flex-1 font-mono text-[11px] text-chalk bg-void border border-iron rounded-sm px-3 py-2 overflow-hidden text-ellipsis whitespace-nowrap">
            {obsUrl || "ws://127.0.0.1:9000"}
          </span>
          <button
            data-qa="obs-url-copy-btn"
            className="font-sans text-[11px] font-medium tracking-[0.08em] text-ash bg-transparent border border-iron rounded-sm py-[6px] px-3 cursor-pointer transition-colors hover:text-chalk hover:border-ash whitespace-nowrap"
            onClick={handleCopyObsUrl}
          >
            {obsCopied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="text-xs text-smoke mt-2 leading-[1.5]">
          Add this URL as a Browser Source in OBS. Works regardless of the display window state.
        </p>
      </div>
    </div>
  );
}

// ─── Appearance section ────────────────────────────────────────────────────────

const THEME_OPTIONS: { value: ThemeMode; label: string; description: string }[] = [
  { value: "light", label: "Light", description: "Always use the light palette" },
  { value: "dark",  label: "Dark",  description: "Always use the dark palette" },
  { value: "system", label: "System", description: "Follow the OS appearance setting" },
];

function AppearanceSection({
  theme,
  onSetTheme,
}: {
  theme: ThemeMode;
  onSetTheme?: (mode: ThemeMode) => void;
}) {
  return (
    <div className="flex-1 p-6">
      <h2 className="text-[13px] font-medium tracking-[0.1em] text-chalk uppercase mb-6 pb-4 border-b border-iron">
        Appearance
      </h2>

      <p className="text-[10px] font-medium tracking-[0.14em] text-smoke uppercase mb-3">
        Colour Scheme
      </p>
      <div className="flex flex-col gap-2">
        {THEME_OPTIONS.map(({ value, label, description }) => (
          <button
            key={value}
            data-qa={`theme-option-${value}`}
            onClick={() => onSetTheme?.(value)}
            className={[
              "flex items-center gap-3 w-full text-left bg-transparent border rounded-sm px-4 py-3 cursor-pointer transition-colors",
              theme === value
                ? "border-gold text-chalk"
                : "border-iron text-ash hover:border-ash hover:text-chalk",
            ].join(" ")}
          >
            <span
              className={[
                "w-3 h-3 rounded-full border shrink-0",
                theme === value ? "bg-gold border-gold" : "bg-transparent border-ash",
              ].join(" ")}
              aria-hidden="true"
            />
            <span className="flex flex-col gap-[2px]">
              <span className="text-[13px] font-medium">{label}</span>
              <span className="text-[11px] text-smoke">{description}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AboutSection() {
  return (
    <div className="flex-1 p-6">
      <h2 className="text-[13px] font-medium tracking-[0.1em] text-chalk uppercase mb-6 pb-4 border-b border-iron">About</h2>
      <p className="text-xs text-smoke mt-2 leading-[1.5]">
        openworship — AI-powered worship presentation.
      </p>
    </div>
  );
}

// ─── Shortcuts section ─────────────────────────────────────────────────────────

const KEYBOARD_SHORTCUTS: { key: string; description: string }[] = [
  { key: "Space", description: "Approve top suggestion" },
  { key: "Escape", description: "Dismiss / clear display" },
  { key: "↑ / ↓", description: "Navigate queue items" },
  { key: "⌘ ,", description: "Open settings" },
  { key: "⌘ M", description: "Toggle microphone" },
];

function ShortcutsSection() {
  return (
    <div className="flex-1 p-6">
      <h2 className="text-[13px] font-medium tracking-[0.1em] text-chalk uppercase mb-6 pb-4 border-b border-iron">Shortcuts</h2>
      <div className="flex flex-col gap-1">
        {KEYBOARD_SHORTCUTS.map(({ key, description }) => (
          <div key={key} className="flex items-center justify-between py-2 border-b border-iron/30">
            <span className="text-[13px] text-ash">{description}</span>
            <kbd className="font-mono text-[11px] text-chalk bg-slate border border-iron rounded-sm px-2 py-0.5 tracking-wide">
              {key}
            </kbd>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-smoke mt-6">
        Keyboard shortcuts are active when the main window is focused.
      </p>
    </div>
  );
}

// ─── Church section ────────────────────────────────────────────────────────────

function ChurchSection({ identity }: { identity: ChurchIdentity }) {
  const [copied, setCopied] = useState(false);
  const [syncStatus, setSyncStatus] = useState<BranchSyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const isHq = identity.role === "hq";

  useEffect(() => {
    invoke<BranchSyncStatus>("get_branch_sync_status")
      .then(setSyncStatus)
      .catch(() => {});
  }, []);

  const handleCopy = () => {
    if (!identity.invite_code) return;
    navigator.clipboard.writeText(identity.invite_code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handlePush = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const status = await invoke<BranchSyncStatus>("push_to_branches");
      setSyncStatus(status);
    } catch (e) {
      setSyncError(String(e));
    } finally {
      setSyncing(false);
    }
  };

  const handlePull = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const status = await invoke<BranchSyncStatus>("pull_from_hq");
      setSyncStatus(status);
    } catch (e) {
      setSyncError(String(e));
    } finally {
      setSyncing(false);
    }
  };

  const formatSyncTime = (ms: number | null | undefined) => {
    if (!ms) return null;
    const d = new Date(ms);
    return d.toLocaleString(undefined, {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div className="flex-1 p-6">
      <h2 className="text-[13px] font-medium tracking-[0.1em] text-chalk uppercase mb-6 pb-4 border-b border-iron">Church</h2>

      <div className="mb-6">
        <p className="block text-[10px] font-medium tracking-[0.12em] text-ash uppercase mb-2">CHURCH NAME</p>
        <p className="text-[13px] text-chalk m-0 leading-[1.5]">
          {identity.church_name || <span className="text-xs text-smoke mt-2 leading-[1.5]">Not set</span>}
        </p>
      </div>

      <div className="mb-6">
        <p className="block text-[10px] font-medium tracking-[0.12em] text-ash uppercase mb-2">BRANCH NAME</p>
        <p className="text-[13px] text-chalk m-0 leading-[1.5]">{identity.branch_name}</p>
      </div>

      <div className="mb-6">
        <p className="block text-[10px] font-medium tracking-[0.12em] text-ash uppercase mb-2">ROLE</p>
        <span className={[
          "inline-block font-mono text-[10px] font-medium tracking-[0.12em] py-[3px] px-2 rounded-sm",
          isHq
            ? "bg-gold/15 text-gold border border-gold/30"
            : "bg-iron/60 text-ash border border-iron",
        ].join(" ")}>
          {isHq ? "HQ" : "MEMBER"}
        </span>
      </div>

      {isHq && identity.invite_code && (
        <div className="mb-6">
          <p className="block text-[10px] font-medium tracking-[0.12em] text-ash uppercase mb-2">INVITE CODE</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="font-mono text-lg font-medium tracking-[0.25em] text-gold">{identity.invite_code}</span>
            <button
              data-qa="copy-invite-code-btn"
              className="font-sans text-[11px] font-medium tracking-[0.08em] text-ash bg-transparent border-none py-1 px-2 cursor-pointer transition-colors hover:text-chalk uppercase"
              onClick={handleCopy}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-smoke mt-2 leading-[1.5]">
            Share this code with other branches to join your church.
          </p>
        </div>
      )}

      {/* ── Branch sync ─────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <p className="block text-[10px] font-medium tracking-[0.12em] text-ash uppercase mb-2">
          {isHq ? "PUSH TO BRANCHES" : "SYNC FROM HQ"}
        </p>

        {isHq ? (
          <>
            <p className="text-xs text-smoke mb-3 leading-[1.5]">
              Push songs, announcements, and sermon notes to all member branches.
              Members pull on demand — content is not pushed automatically.
            </p>
            <button
              data-qa="push-to-branches-btn"
              disabled={syncing}
              className={[
                "font-sans text-[11px] font-medium tracking-[0.08em] uppercase py-[6px] px-4 rounded-sm border transition-colors",
                syncing
                  ? "text-ash border-iron cursor-not-allowed"
                  : "text-chalk border-iron hover:border-chalk cursor-pointer bg-transparent",
              ].join(" ")}
              onClick={handlePush}
            >
              {syncing ? "Pushing…" : "Push to Branches"}
            </button>
            {syncStatus?.last_pushed_ms && (
              <p className="text-[11px] text-smoke mt-2 leading-[1.5]">
                Last pushed {formatSyncTime(syncStatus.last_pushed_ms)}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-xs text-smoke mb-3 leading-[1.5]">
              Pull the latest songs, announcements, and sermon notes from HQ.
              New songs are merged; announcements and sermon notes replace local copies.
            </p>
            <button
              data-qa="pull-from-hq-btn"
              disabled={syncing}
              className={[
                "font-sans text-[11px] font-medium tracking-[0.08em] uppercase py-[6px] px-4 rounded-sm border transition-colors",
                syncing
                  ? "text-ash border-iron cursor-not-allowed"
                  : "text-chalk border-iron hover:border-chalk cursor-pointer bg-transparent",
              ].join(" ")}
              onClick={handlePull}
            >
              {syncing ? "Syncing…" : "Sync from HQ"}
            </button>
            {syncStatus?.last_pulled_ms && (
              <p className="text-[11px] text-smoke mt-2 leading-[1.5]">
                Last synced {formatSyncTime(syncStatus.last_pulled_ms)}
                {syncStatus.hq_branch_name ? ` from ${syncStatus.hq_branch_name}` : ""}
              </p>
            )}
          </>
        )}

        {syncError && (
          <p className="text-[11px] text-red-400 mt-2 leading-[1.5]">{syncError}</p>
        )}
      </div>
    </div>
  );
}

// ─── Email section (Phase 14) ─────────────────────────────────────────────────

const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  smtp_host: "",
  smtp_port: 587,
  smtp_username: "",
  smtp_password: "",
  from_name: "OpenWorship",
  send_delay_hours: 0,
  auto_send: false,
};

function EmailSection({ identity }: { identity: ChurchIdentity }) {
  const [settings, setSettings] = useState<EmailSettings>(DEFAULT_EMAIL_SETTINGS);
  const [anthropicKeySet, setAnthropicKeySet] = useState(false);
  const [anthropicKey, setAnthropicKey] = useState("");
  const [subscribers, setSubscribers] = useState<EmailSubscriber[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [smtpMsg, setSmtpMsg] = useState<string | null>(null);
  const [smtpErr, setSmtpErr] = useState<string | null>(null);
  const [subErr, setSubErr] = useState<string | null>(null);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);

  useEffect(() => {
    invoke<EmailSettings>("get_email_settings").then(setSettings).catch(() => {});
    invoke<boolean>("get_anthropic_api_key_status").then(setAnthropicKeySet).catch(() => {});
    invoke<EmailSubscriber[]>("list_email_subscribers", { churchId: identity.church_id })
      .then(setSubscribers)
      .catch(() => {});
  }, [identity.church_id]);

  const handleSaveSmtp = async () => {
    setSaving(true);
    setSmtpMsg(null);
    setSmtpErr(null);
    try {
      await invoke("set_email_settings", { settings });
      if (anthropicKey.trim()) {
        await invoke("set_anthropic_api_key", { key: anthropicKey.trim() });
        setAnthropicKeySet(true);
        setAnthropicKey("");
      }
      setSmtpMsg("Settings saved.");
    } catch (e) {
      setSmtpErr(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail.trim()) return;
    setSendingTest(true);
    setSmtpMsg(null);
    setSmtpErr(null);
    try {
      await invoke("send_test_email", { toEmail: testEmail.trim() });
      setSmtpMsg(`Test email sent to ${testEmail.trim()}.`);
    } catch (e) {
      setSmtpErr(String(e));
    } finally {
      setSendingTest(false);
    }
  };

  const handleAddSubscriber = async () => {
    if (!newEmail.trim()) return;
    setSubErr(null);
    try {
      const sub = await invoke<EmailSubscriber>("add_email_subscriber", {
        churchId: identity.church_id,
        email: newEmail.trim(),
        name: newName.trim() || null,
      });
      setSubscribers((prev) => [...prev, sub]);
      setNewEmail("");
      setNewName("");
    } catch (e) {
      setSubErr(String(e));
    }
  };

  const handleRemoveSubscriber = async (id: string) => {
    try {
      await invoke("remove_email_subscriber", { subscriberId: id });
      setSubscribers((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // ignore
    }
  };

  const inputCls = "flex-1 bg-transparent border-0 border-b border-iron/60 outline-none py-2 font-mono text-[13px] text-chalk tracking-[0.04em] transition-colors focus:border-gold placeholder:text-smoke placeholder:tracking-[0.02em]";
  const labelCls = "block text-[10px] font-medium tracking-[0.12em] text-ash uppercase mb-2";

  const field = (
    label: string,
    value: string | number,
    onChange: (v: string) => void,
    opts?: { type?: string; placeholder?: string; hint?: string }
  ) => (
    <div className="mb-6">
      <label className={labelCls}>{label}</label>
      <input
        className={inputCls}
        type={opts?.type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={opts?.placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      {opts?.hint && <p className="text-xs text-smoke mt-2 leading-[1.5]">{opts.hint}</p>}
    </div>
  );

  return (
    <div className="flex-1 p-6">
      <h2 className="text-[13px] font-medium tracking-[0.1em] text-chalk uppercase mb-6 pb-4 border-b border-iron">Email</h2>

      {/* Anthropic API Key */}
      <div className="mb-6">
        <label className={labelCls}>ANTHROPIC API KEY</label>
        <div className="flex items-center gap-2">
          <input
            className={`${inputCls} min-w-0`}
            type="password"
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            placeholder={anthropicKeySet ? "••••••••••••  (key stored)" : "sk-ant-..."}
            autoComplete="off"
          />
        </div>
        <p className="text-xs text-smoke mt-2 leading-[1.5]">
          Used to generate AI service summaries with claude-sonnet-4-6.
        </p>
      </div>

      {/* SMTP config */}
      {field("SMTP HOST", settings.smtp_host, (v) => setSettings((s) => ({ ...s, smtp_host: v })), {
        placeholder: "smtp.gmail.com",
      })}
      {field("SMTP PORT", settings.smtp_port, (v) => setSettings((s) => ({ ...s, smtp_port: Number(v) || 587 })), {
        type: "number",
        placeholder: "587",
      })}
      {field("SMTP USERNAME", settings.smtp_username, (v) => setSettings((s) => ({ ...s, smtp_username: v })), {
        placeholder: "you@example.com",
      })}

      <div className="mb-6">
        <label className={labelCls}>SMTP PASSWORD</label>
        <div className="flex items-center gap-2">
          <input
            className={`${inputCls} min-w-0`}
            type={showSmtpPassword ? "text" : "password"}
            value={settings.smtp_password}
            onChange={(e) => setSettings((s) => ({ ...s, smtp_password: e.target.value }))}
            autoComplete="off"
          />
          <button
            className="font-sans text-[11px] font-medium tracking-[0.08em] text-ash bg-transparent border-none py-1 px-2 cursor-pointer transition-colors hover:text-chalk uppercase"
            onClick={() => setShowSmtpPassword((v) => !v)}
            type="button"
          >
            {showSmtpPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {field("FROM NAME", settings.from_name, (v) => setSettings((s) => ({ ...s, from_name: v })), {
        placeholder: "OpenWorship",
      })}

      {field(
        "SEND DELAY (HOURS)",
        settings.send_delay_hours,
        (v) => setSettings((s) => ({ ...s, send_delay_hours: Math.max(0, Number(v) || 0) })),
        { type: "number", hint: "Hours after service ends before sending. 0 = immediate." }
      )}

      <div className="mb-6">
        <label className={labelCls}>AUTO SEND</label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="accent-gold cursor-pointer"
            checked={settings.auto_send}
            onChange={(e) => setSettings((s) => ({ ...s, auto_send: e.target.checked }))}
          />
          <span className="text-[13px] text-ash">
            Automatically email subscribers when a summary is generated
          </span>
        </label>
      </div>

      <div className="flex items-center gap-3 flex-wrap mt-3">
        <button
          data-qa="email-save-btn"
          className="font-sans text-[11px] font-medium tracking-[0.08em] text-void bg-gold border-none rounded-sm py-[6px] px-4 cursor-pointer transition-[filter] hover:brightness-[1.15] disabled:opacity-50 disabled:cursor-not-allowed uppercase"
          onClick={handleSaveSmtp}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save"}
        </button>

        {/* Test email */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <input
            className={`${inputCls} flex-1 min-w-0`}
            type="email"
            placeholder="test@example.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
          />
          <button
            className="font-sans text-[11px] font-medium tracking-[0.08em] text-ash bg-transparent border-none py-1 px-2 cursor-pointer transition-colors hover:text-chalk uppercase"
            onClick={handleTestEmail}
            disabled={sendingTest || !testEmail.trim()}
          >
            {sendingTest ? "Sending…" : "Send test"}
          </button>
        </div>
      </div>

      {smtpMsg && <p className="text-[11px] text-[#64c878] mt-2">{smtpMsg}</p>}
      {smtpErr && <p className="flex-1 text-xs text-ember">{smtpErr}</p>}

      {/* Subscribers */}
      <div className="mt-4 mb-6">
        <p className={labelCls}>SUBSCRIBERS</p>

        {subscribers.length === 0 ? (
          <p className="text-xs text-smoke mt-2 leading-[1.5]">No subscribers yet.</p>
        ) : (
          <ul className="list-none my-2 mx-0 p-0 flex flex-col gap-[4px]">
            {subscribers.map((sub) => (
              <li key={sub.id} className="flex items-center justify-between py-1 px-2 bg-obsidian rounded-sm">
                <span className="text-[11px] text-chalk flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                  {sub.name ? `${sub.name} <${sub.email}>` : sub.email}
                </span>
                <button
                  className="bg-transparent border-none text-smoke cursor-pointer text-sm px-1 leading-none shrink-0"
                  onClick={() => handleRemoveSubscriber(sub.id)}
                  title="Remove subscriber"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2 items-center mt-2 flex-wrap">
          <input
            className={`${inputCls} w-[100px] shrink-0`}
            type="text"
            placeholder="Name (optional)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className={`${inputCls} flex-1 min-w-0`}
            type="email"
            placeholder="email@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddSubscriber(); }}
          />
          <button
            className="font-sans text-[11px] font-medium tracking-[0.08em] text-ash bg-transparent border-none py-1 px-2 cursor-pointer transition-colors hover:text-chalk uppercase"
            onClick={handleAddSubscriber}
            disabled={!newEmail.trim()}
          >
            Add
          </button>
        </div>
        {subErr && <p className="flex-1 text-xs text-ember">{subErr}</p>}
      </div>
    </div>
  );
}

// ─── Cloud section (Phase 16) ──────────────────────────────────────────────────

const DEFAULT_S3_CONFIG: S3Config = {
  endpoint_url: "",
  bucket: "",
  region: "us-east-1",
  access_key_id: "",
  secret_access_key: "",
};

function CloudSection() {
  const [config, setConfig] = useState<S3Config>(DEFAULT_S3_CONFIG);
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    invoke<S3Config | null>("get_cloud_config")
      .then((c) => { if (c) setConfig((prev) => ({ ...prev, ...c })); })
      .catch(() => {});
    invoke<StorageUsage>("get_storage_usage").then(setUsage).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setErr(null);
    setSaved(false);
    try {
      await invoke("set_cloud_config", { config });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { setErr(String(e)); }
    finally { setSaving(false); }
  };

  const inputCls = "flex-1 bg-transparent border-0 border-b border-iron/60 outline-none py-2 font-mono text-[13px] text-chalk tracking-[0.04em] transition-colors focus:border-gold placeholder:text-smoke";
  const labelCls = "block text-[10px] font-medium tracking-[0.12em] text-ash uppercase mb-2";

  return (
    <div className="flex-1 p-6">
      <h2 className="text-[13px] font-medium tracking-[0.1em] text-chalk uppercase mb-6 pb-4 border-b border-iron">Cloud Storage</h2>
      <p className="text-xs text-smoke mb-6">
        Connect an S3-compatible storage provider (AWS S3, MinIO, Backblaze B2, etc.) to enable
        cloud sync and multi-branch sharing for your Artifacts.
      </p>

      <div className="mb-6">
        <p className={labelCls}>ENDPOINT URL</p>
        <input
          className={inputCls}
          type="text"
          placeholder="https://s3.amazonaws.com"
          value={config.endpoint_url}
          onChange={(e) => setConfig((p) => ({ ...p, endpoint_url: e.target.value }))}
        />
      </div>

      <div className="mb-6">
        <p className={labelCls}>BUCKET</p>
        <input
          className={inputCls}
          type="text"
          placeholder="openworship-artifacts"
          value={config.bucket}
          onChange={(e) => setConfig((p) => ({ ...p, bucket: e.target.value }))}
        />
      </div>

      <div className="mb-6">
        <p className={labelCls}>REGION</p>
        <input
          className={inputCls}
          type="text"
          placeholder="us-east-1"
          value={config.region}
          onChange={(e) => setConfig((p) => ({ ...p, region: e.target.value }))}
        />
      </div>

      <div className="mb-6">
        <p className={labelCls}>ACCESS KEY ID</p>
        <input
          className={inputCls}
          type="text"
          placeholder="AKIA…"
          value={config.access_key_id}
          onChange={(e) => setConfig((p) => ({ ...p, access_key_id: e.target.value }))}
        />
      </div>

      <div className="mb-6">
        <p className={labelCls}>SECRET ACCESS KEY</p>
        <input
          className={inputCls}
          type="password"
          placeholder="Leave blank to keep existing"
          value={config.secret_access_key}
          onChange={(e) => setConfig((p) => ({ ...p, secret_access_key: e.target.value }))}
        />
        <p className="text-xs text-smoke mt-2 leading-[1.5]">Stored securely in the OS keychain.</p>
      </div>

      {usage && (
        <div className="mb-6">
          <p className={labelCls}>STORAGE USAGE</p>
          <p className="text-xs text-smoke mt-2 leading-[1.5]">
            {formatStorageMB(usage.used_bytes)} used
            {usage.quota_bytes ? ` / ${formatStorageMB(usage.quota_bytes)}` : ""} —{" "}
            {usage.synced_count} file{usage.synced_count !== 1 ? "s" : ""} synced
          </p>
          {usage.quota_bytes && (
            <div className="h-[2px] bg-iron rounded-[1px] overflow-hidden mt-[6px]">
              <div
                className="h-full bg-gold transition-[width] duration-300 min-w-[2px]"
                style={{ width: `${Math.min(100, (usage.used_bytes / usage.quota_bytes) * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {err && <p className="flex-1 text-xs text-ember">{err}</p>}
      {saved && <p className="text-xs text-smoke mt-2 leading-[1.5]" style={{ color: "#c9a84c" }}>✓ Cloud config saved.</p>}

      <button
        data-qa="cloud-save-btn"
        className="font-sans text-[11px] font-medium tracking-[0.08em] text-void bg-gold border-none rounded-sm py-[6px] px-4 cursor-pointer transition-[filter] hover:brightness-[1.15] disabled:opacity-50 disabled:cursor-not-allowed uppercase"
        onClick={handleSave}
        disabled={saving || !config.endpoint_url.trim()}
      >
        {saving ? "Saving…" : "Save Cloud Config"}
      </button>
    </div>
  );
}

function formatStorageMB(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}
