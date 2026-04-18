import { useState, useEffect } from "react";
import {
  getEmailSettings, setEmailSettings,
} from "@/lib/commands/settings";
import {
  listEmailSubscribers,
  addEmailSubscriber,
  removeEmailSubscriber,
  sendTestEmail,
} from "@/lib/commands/summaries";
import { Section, SettingRow } from "@/components/ui/section";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EmailSettings, EmailSubscriber, ChurchIdentity } from "@/lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EmailSectionProps {
  identity: ChurchIdentity;
}

/**
 * Service email settings: SMTP configuration, subscriber list, auto-send toggle.
 */
export function EmailSection({ identity }: EmailSectionProps) {
  const [settings, setSettingsState] = useState<EmailSettings | null>(null);
  const [subscribers, setSubscribers] = useState<EmailSubscriber[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    getEmailSettings()
      .then(setSettingsState)
      .catch(() => {});
    listEmailSubscribers()
      .then(setSubscribers)
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await setEmailSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  const handleAddSubscriber = async () => {
    if (!EMAIL_RE.test(newEmail)) return;
    await addEmailSubscriber(newEmail);
    setSubscribers(await listEmailSubscribers());
    setNewEmail("");
  };

  const handleRemoveSubscriber = async (email: string) => {
    await removeEmailSubscriber(email);
    setSubscribers((prev) => prev.filter((s) => s.email !== email));
  };

  const handleTestEmail = async () => {
    if (!settings) return;
    await sendTestEmail(settings.smtp_username);
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  if (!settings) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center text-ink-3 text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-0">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3 mb-6 pb-3 border-b border-line">
        Service Email
      </h2>

      <Section title="SMTP configuration">
        <SettingRow label="Host">
          <Input
            className="w-48"
            value={settings.smtp_host}
            onChange={(e) => setSettingsState((p) => p ? { ...p, smtp_host: e.target.value } : p)}
            placeholder="smtp.gmail.com"
          />
        </SettingRow>
        <SettingRow label="Port">
          <Input
            className="w-24"
            type="number"
            value={settings.smtp_port}
            onChange={(e) => setSettingsState((p) => p ? { ...p, smtp_port: Number(e.target.value) } : p)}
          />
        </SettingRow>
        <SettingRow label="Username">
          <Input
            className="w-48"
            value={settings.smtp_username}
            onChange={(e) => setSettingsState((p) => p ? { ...p, smtp_username: e.target.value } : p)}
          />
        </SettingRow>
        <SettingRow label="From name">
          <Input
            className="w-48"
            value={settings.from_name}
            onChange={(e) => setSettingsState((p) => p ? { ...p, from_name: e.target.value } : p)}
            placeholder={identity.church_name}
          />
        </SettingRow>

        <div className="flex justify-between items-center pt-3">
          <Button variant="outline" size="sm" onClick={handleTestEmail} disabled={testSent}>
            {testSent ? "Sent!" : "Send test email"}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </Section>

      <Section title="Auto-send" separator description="AI-generated recap sent to subscribers after the service ends.">
        <SettingRow label="Auto-send summary">
          <Toggle
            checked={settings.auto_send}
            onCheckedChange={(v) => setSettingsState((p) => p ? { ...p, auto_send: v } : p)}
          />
        </SettingRow>
      </Section>

      <Section title="Subscribers" separator>
        <div className="flex gap-2 mb-3">
          <Input
            className="flex-1"
            type="email"
            placeholder="email@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddSubscriber()}
          />
          <Button variant="outline" size="sm" onClick={handleAddSubscriber} disabled={!EMAIL_RE.test(newEmail)}>
            Add
          </Button>
        </div>
        <div className="space-y-1">
          {subscribers.length === 0 ? (
            <p className="text-xs text-ink-3">No subscribers yet.</p>
          ) : (
            subscribers.map((s) => (
              <div key={s.email} className="flex items-center justify-between py-1.5 border-b border-line last:border-b-0">
                <span className="text-sm text-ink-2">{s.email}</span>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => handleRemoveSubscriber(s.email)}
                  className="text-danger hover:text-danger"
                >
                  Remove
                </Button>
              </div>
            ))
          )}
        </div>
      </Section>
    </div>
  );
}
