import { useState, useEffect } from "react";
import { getCloudConfig, setCloudConfig } from "@/lib/commands/settings";
import { Section, SettingRow } from "@/components/ui/section";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { S3Config } from "@/lib/types";

const FIELDS: {
  key: keyof S3Config;
  label: string;
  placeholder: string;
  secret?: boolean;
}[] = [
  {
    key: "endpoint_url",
    label: "Endpoint",
    placeholder: "https://s3.amazonaws.com",
  },
  { key: "bucket", label: "Bucket", placeholder: "my-openworship-bucket" },
  { key: "region", label: "Region", placeholder: "us-east-1" },
  { key: "access_key_id", label: "Access Key ID", placeholder: "AKIA…" },
  {
    key: "secret_access_key",
    label: "Secret Key",
    placeholder: "wJalr…",
    secret: true,
  },
];

/**
 * Cloud sync settings section: S3-compatible storage configuration.
 */
export function CloudSection() {
  const [config, setConfigState] = useState<S3Config | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCloudConfig()
      .then(setConfigState)
      .catch((err) => console.error(err));
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
    try {
      await setCloudConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!config) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-ink-3">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-0 overflow-y-auto p-6">
      <h2 className="mb-6 border-b border-line pb-3 font-mono text-[10px] tracking-[0.12em] text-ink-3 uppercase">
        Cloud
      </h2>

      <Section
        title="S3 storage"
        description="Connect an S3-compatible bucket to enable artifact cloud sync."
      >
        {FIELDS.map(({ key, label, placeholder, secret }) => (
          <SettingRow key={key} label={label}>
            <Input
              className="w-56"
              type={secret ? "password" : "text"}
              placeholder={placeholder}
              value={(config as unknown as Record<string, string>)[key] ?? ""}
              onChange={(e) =>
                setConfigState((p) => (p ? { ...p, [key]: e.target.value } : p))
              }
            />
          </SettingRow>
        ))}

        <div className="flex items-center justify-between pt-3">
          {error && <span className="text-xs text-danger">{error}</span>}
          <Button
            size="sm"
            className="ml-auto"
            onClick={handleSave}
            disabled={saving}
          >
            {saved ? "Saved!" : saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </Section>
    </div>
  );
}
