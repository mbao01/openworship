import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAudioSettings } from "@/hooks/use-audio-settings";
import { useAudioLevel } from "@/hooks/use-audio-level";
import { Section, SettingRow } from "@/components/ui/section";
import { Toggle } from "@/components/ui/toggle";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VuMeter } from "@/components/ui/vu-meter";
import { Button } from "@/components/ui/button";
import {
  listAudioInputDevices,
  listSttProviders,
  startAudioMonitor,
  stopAudioMonitor,
} from "@/lib/commands/audio";
import { setAnthropicApiKey } from "@/lib/commands/settings";
import { ProviderConfigPanel } from "@/components/settings/ProviderConfigPanel";
import type { AudioInputDevice, ProviderInfo } from "@/lib/types";

/**
 * Audio settings section: STT provider (data-driven), Anthropic API key,
 * audio input device, and live VU meter.
 */
export function AudioSection() {
  const { settings, update, loading } = useAudioSettings();
  const audioLevel = useAudioLevel();
  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [micTesting, setMicTesting] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  // Load devices + providers on mount, then re-fetch devices whenever the
  // Rust device-watcher detects a hot-plug change (audio://devices-changed).
  // Replaces the 3 s setInterval poll — no IPC round-trips while idle.
  useEffect(() => {
    const loadDevices = () => {
      listAudioInputDevices()
        .then(setDevices)
        .catch(() => {});
    };
    loadDevices();
    listSttProviders()
      .then(setProviders)
      .catch(() => {});

    let unlisten: (() => void) | undefined;
    listen("audio://devices-changed", loadDevices).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  // Auto-start audio monitor on mount, stop on unmount
  useEffect(() => {
    startAudioMonitor()
      .then(() => setMicTesting(true))
      .catch((err) => console.error(err));
    return () => {
      stopAudioMonitor().catch((err) => console.error(err));
    };
  }, []);

  const handleMicTest = async () => {
    setMicError(null);
    if (micTesting) {
      try {
        await stopAudioMonitor();
      } catch {
        /* ignore */
      }
      setMicTesting(false);
    } else {
      try {
        await startAudioMonitor();
        setMicTesting(true);
      } catch (e) {
        setMicError(String(e));
        setMicTesting(false);
      }
    }
  };

  const handleSaveApiKey = async () => {
    setSavingKey(true);
    try {
      await setAnthropicApiKey(apiKey);
      setApiKey("");
    } finally {
      setSavingKey(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-ink-3">
        Loading…
      </div>
    );
  }

  const activeProvider = providers.find((p) => p.id === settings.backend);
  const providerConfig = (settings.provider_config?.[settings.backend] ??
    {}) as Record<string, unknown>;

  const handleProviderConfigChange = (key: string, value: unknown) => {
    const updated = { ...providerConfig, [key]: value };
    update({
      provider_config: {
        ...settings.provider_config,
        [settings.backend]: updated,
      },
    });
  };

  return (
    <div className="flex-1 space-y-0 overflow-y-auto p-6">
      <h2 className="mb-6 border-b border-line pb-3 font-mono text-[10px] tracking-[0.12em] text-ink-3 uppercase">
        Audio
      </h2>

      <Section title="Speech-to-text backend">
        <SettingRow label="Backend">
          <Select
            value={settings.backend}
            onValueChange={(v) =>
              update({ backend: v as typeof settings.backend })
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
              <SelectItem value="off">Off</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>

        {/* Data-driven provider config panel */}
        {activeProvider && (
          <ProviderConfigPanel
            provider={activeProvider}
            config={providerConfig}
            onConfigChange={handleProviderConfigChange}
          />
        )}
      </Section>

      <Section
        title="Anthropic API key"
        separator
        description="Required for semantic scripture matching and service summaries."
      >
        <SettingRow label="API key">
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-…"
              className="h-7 w-44 rounded border border-line bg-bg-2 px-2 text-xs text-ink placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveApiKey}
              disabled={savingKey || !apiKey}
            >
              Save
            </Button>
          </div>
        </SettingRow>
      </Section>

      <Section title="Input device" separator>
        <SettingRow label="Microphone">
          <Select
            value={settings.audio_input_device ?? "__default__"}
            onValueChange={(v) =>
              update({ audio_input_device: v === "__default__" ? null : v })
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="System default" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default__">System default</SelectItem>
              {devices.map((d) => (
                <SelectItem key={d.name} value={d.name}>
                  {d.name}
                  {d.is_default ? " (default)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow
          label="Input level"
          description={
            micError
              ? micError
              : micTesting
                ? "Listening — speak to test"
                : "Start mic to see levels"
          }
        >
          <div className="flex items-center gap-3">
            <VuMeter level={audioLevel} showPercentage />
            <Button
              variant={micTesting ? "outline" : "default"}
              size="sm"
              onClick={handleMicTest}
            >
              {micTesting ? "Stop" : "Test mic"}
            </Button>
          </div>
        </SettingRow>
      </Section>

      <Section
        title="Semantic matching"
        separator
        description="AI-powered scripture matching using semantic similarity."
      >
        <SettingRow label="Enable semantic matching">
          <Toggle
            checked={settings.semantic_enabled}
            onCheckedChange={(v) => update({ semantic_enabled: v })}
          />
        </SettingRow>

        {settings.semantic_enabled && (
          <>
            <SettingRow
              label={`Auto threshold — ${Math.round(settings.semantic_threshold_auto * 100)}%`}
            >
              <div className="w-36">
                <Slider
                  min={50}
                  max={100}
                  step={1}
                  value={[Math.round(settings.semantic_threshold_auto * 100)]}
                  onValueChange={([v]: number[]) =>
                    update({ semantic_threshold_auto: v / 100 })
                  }
                />
              </div>
            </SettingRow>
            <SettingRow
              label={`Copilot threshold — ${Math.round(settings.semantic_threshold_copilot * 100)}%`}
            >
              <div className="w-36">
                <Slider
                  min={50}
                  max={100}
                  step={1}
                  value={[
                    Math.round(settings.semantic_threshold_copilot * 100),
                  ]}
                  onValueChange={([v]: number[]) =>
                    update({ semantic_threshold_copilot: v / 100 })
                  }
                />
              </div>
            </SettingRow>
            <SettingRow
              label={`Lyrics auto — ${Math.round(settings.lyrics_threshold_auto * 100)}%`}
            >
              <div className="w-36">
                <Slider
                  min={50}
                  max={100}
                  step={1}
                  value={[Math.round(settings.lyrics_threshold_auto * 100)]}
                  onValueChange={([v]: number[]) =>
                    update({ lyrics_threshold_auto: v / 100 })
                  }
                />
              </div>
            </SettingRow>
          </>
        )}
      </Section>
    </div>
  );
}
