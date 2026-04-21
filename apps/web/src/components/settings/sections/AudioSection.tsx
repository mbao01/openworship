import { useEffect, useState } from "react";
import { useAudioSettings } from "@/hooks/use-audio-settings";
import { useWhisperModel } from "@/hooks/use-whisper-model";
import { useAudioLevel } from "@/hooks/use-audio-level";
import { Section, SettingRow } from "@/components/ui/section";
import { Toggle } from "@/components/ui/toggle";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VuMeter } from "@/components/ui/vu-meter";
import { Button } from "@/components/ui/button";
import { listAudioInputDevices, startAudioMonitor, stopAudioMonitor } from "@/lib/commands/audio";
import { setAnthropicApiKey } from "@/lib/commands/settings";
import type { AudioInputDevice, WhisperModel } from "@/lib/types";

const WHISPER_MODELS: { value: WhisperModel; filename: string; label: string; size: string; recommended?: boolean }[] = [
  { value: "tiny", filename: "ggml-tiny.en.bin", label: "Tiny", size: "~75 MB" },
  { value: "base", filename: "ggml-base.en.bin", label: "Base", size: "~140 MB" },
  { value: "small", filename: "ggml-small.en.bin", label: "Small", size: "~460 MB", recommended: true },
  { value: "medium", filename: "ggml-medium.en.bin", label: "Medium", size: "~1.5 GB" },
];

/**
 * Audio settings section: STT backend, Anthropic API key, Whisper model,
 * audio input device, and live VU meter.
 */
export function AudioSection() {
  const { settings, update, loading } = useAudioSettings();
  const selectedModel = WHISPER_MODELS.find((m) => m.value === (settings?.whisper_model ?? "base")) ?? WHISPER_MODELS[1];
  const { installed, downloading, progress, download } = useWhisperModel(selectedModel.filename);
  const audioLevel = useAudioLevel();
  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [keyVisible, setKeyVisible] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [micTesting, setMicTesting] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  useEffect(() => {
    listAudioInputDevices()
      .then(setDevices)
      .catch(() => {});
  }, []);

  // Auto-start audio monitor on mount, stop on unmount
  useEffect(() => {
    startAudioMonitor()
      .then(() => setMicTesting(true))
      .catch(() => {});
    return () => {
      stopAudioMonitor().catch(() => {});
    };
  }, []);

  const handleMicTest = async () => {
    setMicError(null);
    if (micTesting) {
      try {
        await stopAudioMonitor();
      } catch { /* ignore */ }
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
      <div className="flex-1 p-6 flex items-center justify-center text-ink-3 text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-0">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3 mb-6 pb-3 border-b border-line">
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
            <SelectTrigger className="w-42">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="whisper">Whisper (local)</SelectItem>
              <SelectItem value="deepgram">Deepgram (cloud)</SelectItem>
              <SelectItem value="off">Off</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>

        {settings.backend === "whisper" && (
          <>
            <SettingRow
              label="Whisper model"
              description="Larger models are more accurate but slower and use more RAM."
            >
              <Select
                value={settings.whisper_model ?? "base"}
                onValueChange={(v) =>
                  update({ whisper_model: v as WhisperModel })
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WHISPER_MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label} ({m.size})
                      {m.recommended ? " *" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>
            <SettingRow
              label="Model status"
              description={
                installed
                  ? `${selectedModel.label} model ready`
                  : `${selectedModel.size} download required`
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
                  onClick={download}
                  disabled={downloading}
                >
                  {downloading ? `${Math.round(progress)}%…` : "Download"}
                </Button>
              )}
            </SettingRow>
          </>
        )}

        {settings.backend === "deepgram" && (
          <SettingRow label="Deepgram API key">
            <div className="flex gap-2">
              <input
                type={keyVisible ? "text" : "password"}
                value={settings.deepgram_api_key}
                onChange={(e) => update({ deepgram_api_key: e.target.value })}
                placeholder="dg_…"
                className="h-7 w-44 rounded bg-bg-2 border border-line px-2 text-xs text-ink placeholder:text-muted focus:border-accent focus:outline-none"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setKeyVisible((prev) => !prev)}
              >
                {keyVisible ? "🙈" : "👁"}
              </Button>
            </div>
          </SettingRow>
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
              type={keyVisible ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-…"
              className="h-7 w-44 rounded bg-bg-2 border border-line px-2 text-xs text-ink placeholder:text-muted focus:border-accent focus:outline-none"
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
