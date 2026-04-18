import { useAudioSettings } from "@/hooks/use-audio-settings";
import { Section, SettingRow } from "@/components/ui/section";
import { Toggle } from "@/components/ui/toggle";
import { Slider } from "@/components/ui/slider";

/**
 * Detection settings section: semantic matching thresholds and confidence controls.
 */
export function DetectionSection() {
  const { settings, update, loading } = useAudioSettings();

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
        Detection
      </h2>

      <Section title="Semantic matching">
        <SettingRow label="Enable semantic matching" description="Uses AI embeddings to match scripture by meaning, not just keywords.">
          <Toggle
            checked={settings.semantic_enabled}
            onCheckedChange={(v) => update({ semantic_enabled: v })}
          />
        </SettingRow>

        {settings.semantic_enabled && (
          <>
            <SettingRow label={`Auto mode threshold — ${Math.round(settings.semantic_threshold_auto * 100)}%`}>
              <div className="w-40">
                <Slider
                  min={50} max={100} step={1}
                  value={[Math.round(settings.semantic_threshold_auto * 100)]}
                  onValueChange={([v]: number[]) => update({ semantic_threshold_auto: v / 100 })}
                />
              </div>
            </SettingRow>
            <SettingRow label={`Copilot mode threshold — ${Math.round(settings.semantic_threshold_copilot * 100)}%`}>
              <div className="w-40">
                <Slider
                  min={50} max={100} step={1}
                  value={[Math.round(settings.semantic_threshold_copilot * 100)]}
                  onValueChange={([v]: number[]) => update({ semantic_threshold_copilot: v / 100 })}
                />
              </div>
            </SettingRow>
          </>
        )}
      </Section>

      <Section title="Lyrics detection" separator>
        <SettingRow label={`Auto threshold — ${Math.round(settings.lyrics_threshold_auto * 100)}%`}>
          <div className="w-40">
            <Slider
              min={50} max={100} step={1}
              value={[Math.round(settings.lyrics_threshold_auto * 100)]}
              onValueChange={([v]: number[]) => update({ lyrics_threshold_auto: v / 100 })}
            />
          </div>
        </SettingRow>
        <SettingRow label={`Copilot threshold — ${Math.round(settings.lyrics_threshold_copilot * 100)}%`}>
          <div className="w-40">
            <Slider
              min={50} max={100} step={1}
              value={[Math.round(settings.lyrics_threshold_copilot * 100)]}
              onValueChange={([v]: number[]) => update({ lyrics_threshold_copilot: v / 100 })}
            />
          </div>
        </SettingRow>
      </Section>
    </div>
  );
}
