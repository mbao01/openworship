import { useEffect, useRef, useState } from "react";
import { invoke } from "../lib/tauri";
import type { AudioSettings, ChurchIdentity, SttBackend } from "../lib/types";
import "../styles/settings.css";

interface SettingsModalProps {
  identity: ChurchIdentity;
  onClose: () => void;
}

type Category = "church" | "general" | "audio" | "display" | "detection" | "about";

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "church", label: "Church" },
  { id: "general", label: "General" },
  { id: "audio", label: "Audio" },
  { id: "display", label: "Display" },
  { id: "detection", label: "Detection" },
  { id: "about", label: "About" },
];

export function SettingsModal({ identity, onClose }: SettingsModalProps) {
  const [activeCategory, setActiveCategory] = useState<Category>("church");
  const [audioSettings, setAudioSettings] = useState<AudioSettings>({
    backend: "offline",
    deepgram_api_key: "",
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
      className="settings-overlay"
      ref={overlayRef}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div className="settings-modal">
        {/* Left nav */}
        <nav className="settings-nav">
          <p className="settings-nav__heading">SETTINGS</p>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              className={`settings-nav__item${activeCategory === cat.id ? " settings-nav__item--active" : ""}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </nav>

        {/* Right content area */}
        <div className="settings-content">
          {activeCategory === "church" && <ChurchSection identity={identity} />}
          {activeCategory === "audio" && (
            <AudioSection
              settings={audioSettings}
              keyVisible={keyVisible}
              onBackendChange={handleBackendChange}
              onApiKeyChange={handleApiKeyChange}
              onToggleKeyVisible={() => setKeyVisible((v) => !v)}
            />
          )}
          {activeCategory === "general" && <PlaceholderSection title="General" />}
          {activeCategory === "display" && <PlaceholderSection title="Display" />}
          {activeCategory === "detection" && <PlaceholderSection title="Detection" />}
          {activeCategory === "about" && <AboutSection />}

          {/* Footer */}
          <div className="settings-footer">
            {saveError && <span className="settings-footer__error">{saveError}</span>}
            <button className="settings-btn--secondary" onClick={onClose}>
              {activeCategory === "church" ? "Close" : "Cancel"}
            </button>
            {activeCategory !== "church" && (
              <button
                className="settings-btn--primary"
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

interface AudioSectionProps {
  settings: AudioSettings;
  keyVisible: boolean;
  onBackendChange: (b: SttBackend) => void;
  onApiKeyChange: (k: string) => void;
  onToggleKeyVisible: () => void;
}

function AudioSection({
  settings,
  keyVisible,
  onBackendChange,
  onApiKeyChange,
  onToggleKeyVisible,
}: AudioSectionProps) {
  const isOnline = settings.backend === "online";

  return (
    <div className="settings-section">
      <h2 className="settings-section__title">Audio</h2>

      {/* STT Backend toggle */}
      <div className="settings-group">
        <p className="settings-group__label">SPEECH-TO-TEXT BACKEND</p>
        <div className="settings-toggle-row">
          <button
            className={`settings-backend-btn${!isOnline ? " settings-backend-btn--active" : ""}`}
            onClick={() => onBackendChange("offline")}
          >
            <span className="settings-backend-btn__title">Offline</span>
            <span className="settings-backend-btn__desc">Whisper.cpp — no internet required</span>
          </button>
          <button
            className={`settings-backend-btn${isOnline ? " settings-backend-btn--active" : ""}`}
            onClick={() => onBackendChange("online")}
          >
            <span className="settings-backend-btn__title">Online</span>
            <span className="settings-backend-btn__desc">Deepgram — lower latency streaming</span>
          </button>
        </div>
      </div>

      {/* Deepgram API key — only shown when Online is selected */}
      {isOnline && (
        <div className="settings-group">
          <p className="settings-group__label">DEEPGRAM API KEY</p>
          <div className="settings-input-row">
            <input
              className="settings-input"
              type={keyVisible ? "text" : "password"}
              placeholder="dg_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={settings.deepgram_api_key}
              onChange={(e) => onApiKeyChange(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button className="settings-show-btn" onClick={onToggleKeyVisible}>
              {keyVisible ? "Hide" : "Show"}
            </button>
          </div>
          {!settings.deepgram_api_key && (
            <p className="settings-group__hint">
              Key required. Without it, falls back to offline mode.
            </p>
          )}
        </div>
      )}

      {/* Fallback note */}
      <div className="settings-group">
        <p className="settings-group__hint">
          {isOnline
            ? "If the Deepgram connection fails or the API key is missing, the engine falls back to Whisper.cpp automatically."
            : "Requires the Whisper ggml-tiny.en model at ~/.openworship/models/ggml-tiny.en.bin."}
        </p>
      </div>
    </div>
  );
}

function PlaceholderSection({ title }: { title: string }) {
  return (
    <div className="settings-section">
      <h2 className="settings-section__title">{title}</h2>
      <p className="settings-group__hint">Coming soon.</p>
    </div>
  );
}

function AboutSection() {
  return (
    <div className="settings-section">
      <h2 className="settings-section__title">About</h2>
      <p className="settings-group__hint">
        openworship — AI-powered worship presentation.
      </p>
    </div>
  );
}

// ─── Church section ────────────────────────────────────────────────────────────

function ChurchSection({ identity }: { identity: ChurchIdentity }) {
  const [copied, setCopied] = useState(false);
  const isHq = identity.role === "hq";

  const handleCopy = () => {
    if (!identity.invite_code) return;
    navigator.clipboard.writeText(identity.invite_code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="settings-section">
      <h2 className="settings-section__title">Church</h2>

      <div className="settings-group">
        <p className="settings-group__label">CHURCH NAME</p>
        <p className="settings-church-value">
          {identity.church_name || <span className="settings-group__hint">Not set</span>}
        </p>
      </div>

      <div className="settings-group">
        <p className="settings-group__label">BRANCH NAME</p>
        <p className="settings-church-value">{identity.branch_name}</p>
      </div>

      <div className="settings-group">
        <p className="settings-group__label">ROLE</p>
        <span className={`settings-role-badge settings-role-badge--${identity.role}`}>
          {isHq ? "HQ" : "MEMBER"}
        </span>
      </div>

      {isHq && identity.invite_code && (
        <div className="settings-group">
          <p className="settings-group__label">INVITE CODE</p>
          <div className="settings-invite-row">
            <span className="settings-invite-code">{identity.invite_code}</span>
            <button className="settings-btn--ghost" onClick={handleCopy}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="settings-group__hint">
            Share this code with other branches to join your church.
          </p>
        </div>
      )}

      {isHq && (
        <div className="settings-group">
          <p className="settings-group__label">MEMBER BRANCHES</p>
          <p className="settings-group__hint">Branch sync coming soon.</p>
        </div>
      )}
    </div>
  );
}
