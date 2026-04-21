import { useEffect, useState } from "react";
import { SettingRow } from "@/components/ui/section";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import {
  getProviderStatus,
  getProviderModels,
  setProviderSecret,
} from "@/lib/commands/audio";
import { useProviderModel } from "@/hooks/use-provider-model";
import type {
  ProviderInfo,
  ProviderStatus,
  ModelInfo,
  ConfigField,
} from "@/lib/types";

interface ProviderConfigPanelProps {
  provider: ProviderInfo;
  config: Record<string, unknown>;
  onConfigChange: (key: string, value: unknown) => void;
}

/**
 * Data-driven configuration panel for any STT provider.
 * Renders config fields dynamically based on `ProviderInfo.config_fields`
 * and shows model download UI when the provider needs local models.
 */
export function ProviderConfigPanel({
  provider,
  config,
  onConfigChange,
}: ProviderConfigPanelProps) {
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);

  // Find the selected model ID from config (for providers with a "model" select field)
  const modelField = provider.config_fields.find(
    (f) => f.field_type === "select" && f.key === "model",
  );
  const selectedModelId = modelField
    ? String(config[modelField.key] ?? modelField.default ?? "")
    : undefined;

  const { installed, downloading, progress, download } = useProviderModel(
    provider.id,
    selectedModelId,
  );

  useEffect(() => {
    getProviderStatus(provider.id)
      .then(setStatus)
      .catch(() => {});
    if (provider.is_local) {
      getProviderModels(provider.id)
        .then(setModels)
        .catch(() => {});
    }
  }, [provider.id, provider.is_local, installed]);

  return (
    <>
      {provider.config_fields.map((field) => (
        <ConfigFieldRenderer
          key={field.key}
          field={field}
          value={config[field.key]}
          providerId={provider.id}
          onChange={(v) => onConfigChange(field.key, v)}
        />
      ))}

      {/* Model status + download for local providers */}
      {provider.is_local && models.length > 0 && (
        <SettingRow
          label="Model status"
          description={
            installed
              ? `${models.find((m) => m.id === selectedModelId)?.label ?? "Model"} ready`
              : `Download required (${formatBytes(models.find((m) => m.id === selectedModelId)?.size_bytes ?? 0)})`
          }
        >
          {installed ? (
            <span className="font-mono text-[10.5px] text-success uppercase tracking-[0.05em]">
              Installed
            </span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => selectedModelId && download(selectedModelId)}
              disabled={downloading || !selectedModelId}
            >
              {downloading ? `${Math.round(progress)}%…` : "Download"}
            </Button>
          )}
        </SettingRow>
      )}

      {/* Provider status info */}
      {status && status.status === "unavailable" && (
        <SettingRow label="Status">
          <span className="text-xs text-destructive">{status.reason}</span>
        </SettingRow>
      )}
    </>
  );
}

// ─── Field renderer ──────────────────────────────────────────────────────────

function ConfigFieldRenderer({
  field,
  value,
  providerId,
  onChange,
}: {
  field: ConfigField;
  value: unknown;
  providerId: string;
  onChange: (value: unknown) => void;
}) {
  const [localValue, setLocalValue] = useState(String(value ?? field.default ?? ""));
  const [saving, setSaving] = useState(false);

  // For secret fields, we show a save button instead of live-updating
  const isSecret = field.is_secret;

  const handleSaveSecret = async () => {
    setSaving(true);
    try {
      await setProviderSecret(providerId, field.key, localValue);
      onChange(localValue);
    } finally {
      setSaving(false);
    }
  };

  switch (field.field_type) {
    case "select":
      return (
        <SettingRow label={field.label} description={field.description}>
          <Select
            value={String(value ?? field.default ?? "")}
            onValueChange={(v) => onChange(v)}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                  {opt.description ? ` — ${opt.description}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
      );

    case "password":
      return (
        <SettingRow label={field.label} description={field.description}>
          <div className="flex gap-2">
            <input
              type="password"
              value={isSecret ? localValue : String(value ?? "")}
              onChange={(e) => {
                if (isSecret) {
                  setLocalValue(e.target.value);
                } else {
                  onChange(e.target.value);
                }
              }}
              placeholder={field.label}
              className="h-7 w-44 rounded bg-bg-2 border border-line px-2 text-xs text-ink placeholder:text-muted focus:border-accent focus:outline-none"
            />
            {isSecret && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveSecret}
                disabled={saving || !localValue}
              >
                Save
              </Button>
            )}
          </div>
        </SettingRow>
      );

    case "text":
      return (
        <SettingRow label={field.label} description={field.description}>
          <input
            type="text"
            value={String(value ?? field.default ?? "")}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.label}
            className="h-7 w-44 rounded bg-bg-2 border border-line px-2 text-xs text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </SettingRow>
      );

    case "toggle":
      return (
        <SettingRow label={field.label} description={field.description}>
          <Toggle
            checked={Boolean(value ?? field.default)}
            onCheckedChange={(v) => onChange(v)}
          />
        </SettingRow>
      );

    default:
      return null;
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `~${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `~${Math.round(bytes / 1_000_000)} MB`;
  return `${bytes} B`;
}
