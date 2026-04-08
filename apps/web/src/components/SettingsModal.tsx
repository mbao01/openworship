import { useEffect, useRef, useState } from "react";
import { invoke } from "../lib/tauri";
import type { AudioSettings, ChurchIdentity, EmailSettings, EmailSubscriber, SemanticStatus, SttBackend } from "../lib/types";
import "../styles/settings.css";

interface SettingsModalProps {
  identity: ChurchIdentity;
  onClose: () => void;
}

type Category = "church" | "general" | "audio" | "display" | "detection" | "email" | "about";

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "church", label: "Church" },
  { id: "general", label: "General" },
  { id: "audio", label: "Audio" },
  { id: "display", label: "Display" },
  { id: "detection", label: "Detection" },
  { id: "email", label: "Email" },
  { id: "about", label: "About" },
];

export function SettingsModal({ identity, onClose }: SettingsModalProps) {
  const [activeCategory, setActiveCategory] = useState<Category>("church");
  const [audioSettings, setAudioSettings] = useState<AudioSettings>({
    backend: "offline",
    deepgram_api_key: "",
    semantic_enabled: true,
    semantic_threshold_auto: 0.75,
    semantic_threshold_copilot: 0.82,
    lyrics_threshold_auto: 0.70,
    lyrics_threshold_copilot: 0.78,
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
          {activeCategory === "detection" && (
            <DetectionSection
              settings={audioSettings}
              onSettingsChange={(patch) =>
                setAudioSettings((prev) => ({ ...prev, ...patch }))
              }
            />
          )}
          {activeCategory === "email" && <EmailSection identity={identity} />}
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
    <div className="settings-section">
      <h2 className="settings-section__title">Detection</h2>

      {/* Semantic matching toggle */}
      <div className="settings-group">
        <p className="settings-group__label">SEMANTIC SCRIPTURE MATCHING</p>
        <div className="settings-toggle-row">
          <label className="settings-checkbox-row">
            <input
              type="checkbox"
              checked={settings.semantic_enabled}
              onChange={(e) => onSettingsChange({ semantic_enabled: e.target.checked })}
            />
            <span>Enable paraphrase &amp; story-based detection</span>
          </label>
        </div>
        <p className="settings-group__hint">
          Uses Ollama + nomic-embed-text (running locally) to detect scripture references
          even when the exact book/chapter/verse is not spoken. Requires Ollama to be
          installed and running.
        </p>
      </div>

      {/* Semantic index status */}
      {settings.semantic_enabled && semanticStatus && (
        <div className="settings-group">
          <p className="settings-group__label">INDEX STATUS</p>
          <div className="settings-semantic-status">
            <span
              className={`settings-semantic-dot${semanticStatus.ready ? " settings-semantic-dot--ready" : ""}`}
              aria-hidden="true"
            />
            <span>
              {semanticStatus.ready
                ? `Ready — ${semanticStatus.verse_count.toLocaleString()} verses indexed`
                : "Building index… (Ollama must be running with nomic-embed-text)"}
            </span>
          </div>
        </div>
      )}

      {/* Confidence threshold sliders — only shown when semantic is enabled */}
      {settings.semantic_enabled && (
        <>
          <div className="settings-group">
            <p className="settings-group__label">
              AUTO MODE THRESHOLD — {formatThreshold(settings.semantic_threshold_auto)}
            </p>
            <input
              className="settings-slider"
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
            <p className="settings-group__hint">
              Lower = more matches (may include false positives). Higher = stricter.
            </p>
          </div>

          <div className="settings-group">
            <p className="settings-group__label">
              COPILOT MODE THRESHOLD — {formatThreshold(settings.semantic_threshold_copilot)}
            </p>
            <input
              className="settings-slider"
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
            <p className="settings-group__hint">
              Copilot mode requires your approval before display — a stricter threshold
              reduces noise in the suggestion queue.
            </p>
          </div>

          {/* Lyrics-specific thresholds */}
          <div className="settings-group">
            <p className="settings-group__label">LYRICS CONTENT TYPE</p>
            <p className="settings-group__hint">
              Separate thresholds for song lyric detection — typically set lower than
              scripture since lyric phrases are more colloquial.
            </p>
          </div>

          <div className="settings-group">
            <p className="settings-group__label">
              LYRICS AUTO MODE THRESHOLD — {formatThreshold(settings.lyrics_threshold_auto)}
            </p>
            <input
              className="settings-slider"
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

          <div className="settings-group">
            <p className="settings-group__label">
              LYRICS COPILOT MODE THRESHOLD — {formatThreshold(settings.lyrics_threshold_copilot)}
            </p>
            <input
              className="settings-slider"
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

  const field = (
    label: string,
    value: string | number,
    onChange: (v: string) => void,
    opts?: { type?: string; placeholder?: string; hint?: string }
  ) => (
    <div className="settings-group">
      <label className="settings-group__label">{label}</label>
      <input
        className="settings-input"
        type={opts?.type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={opts?.placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      {opts?.hint && <p className="settings-group__hint">{opts.hint}</p>}
    </div>
  );

  return (
    <div className="settings-section">
      <h2 className="settings-section__title">Email</h2>

      {/* Anthropic API Key */}
      <div className="settings-group">
        <label className="settings-group__label">ANTHROPIC API KEY</label>
        <div className="settings-key-row">
          <input
            className="settings-input settings-input--key"
            type="password"
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            placeholder={anthropicKeySet ? "••••••••••••  (key stored)" : "sk-ant-..."}
            autoComplete="off"
          />
        </div>
        <p className="settings-group__hint">
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

      <div className="settings-group">
        <label className="settings-group__label">SMTP PASSWORD</label>
        <div className="settings-key-row">
          <input
            className="settings-input settings-input--key"
            type={showSmtpPassword ? "text" : "password"}
            value={settings.smtp_password}
            onChange={(e) => setSettings((s) => ({ ...s, smtp_password: e.target.value }))}
            autoComplete="off"
          />
          <button
            className="settings-btn--ghost"
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

      <div className="settings-group">
        <label className="settings-group__label">AUTO SEND</label>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={settings.auto_send}
            onChange={(e) => setSettings((s) => ({ ...s, auto_send: e.target.checked }))}
          />
          <span className="settings-toggle__track" />
          <span className="settings-toggle__label">
            Automatically email subscribers when a summary is generated
          </span>
        </label>
      </div>

      <div className="settings-actions-row">
        <button className="settings-btn--primary" onClick={handleSaveSmtp} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>

        {/* Test email */}
        <div className="settings-test-row">
          <input
            className="settings-input settings-input--test-email"
            type="email"
            placeholder="test@example.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
          />
          <button
            className="settings-btn--ghost"
            onClick={handleTestEmail}
            disabled={sendingTest || !testEmail.trim()}
          >
            {sendingTest ? "Sending…" : "Send test"}
          </button>
        </div>
      </div>

      {smtpMsg && <p className="settings-save-msg">{smtpMsg}</p>}
      {smtpErr && <p className="settings-footer__error">{smtpErr}</p>}

      {/* Subscribers */}
      <div className="settings-group settings-group--subscribers">
        <p className="settings-group__label">SUBSCRIBERS</p>

        {subscribers.length === 0 ? (
          <p className="settings-group__hint">No subscribers yet.</p>
        ) : (
          <ul className="settings-subscriber-list">
            {subscribers.map((sub) => (
              <li key={sub.id} className="settings-subscriber-row">
                <span className="settings-subscriber-row__email">
                  {sub.name ? `${sub.name} <${sub.email}>` : sub.email}
                </span>
                <button
                  className="settings-subscriber-row__remove"
                  onClick={() => handleRemoveSubscriber(sub.id)}
                  title="Remove subscriber"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="settings-add-subscriber-row">
          <input
            className="settings-input settings-input--sub-name"
            type="text"
            placeholder="Name (optional)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className="settings-input settings-input--sub-email"
            type="email"
            placeholder="email@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddSubscriber(); }}
          />
          <button
            className="settings-btn--ghost"
            onClick={handleAddSubscriber}
            disabled={!newEmail.trim()}
          >
            Add
          </button>
        </div>
        {subErr && <p className="settings-footer__error">{subErr}</p>}
      </div>
    </div>
  );
}
