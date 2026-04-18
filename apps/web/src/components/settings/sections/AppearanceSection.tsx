import {
  useTheme,
  type AccentName,
  type ContentType,
  type LayoutMode,
  type UIDensity,
} from "@/hooks/use-theme";
import { Section, SettingRow } from "@/components/ui/section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/cn";
import type { ThemeMode } from "@/lib/types";

const ACCENT_COLORS: { name: AccentName; hex: string; label: string }[] = [
  { name: "copper", hex: "#C9A76A", label: "Copper" },
  { name: "crimson", hex: "#B66A66", label: "Crimson" },
  { name: "sage", hex: "#8AB67B", label: "Sage" },
  { name: "indigo", hex: "#7C8BB5", label: "Indigo" },
];

type SegOption<T extends string> = { value: T; label: string };

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex border border-line-strong rounded overflow-hidden bg-bg-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex-1 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest",
            "border-r border-line last:border-r-0",
            "transition-all duration-100",
            value === opt.value
              ? "bg-accent text-[#1A0D00] font-semibold"
              : "text-ink-3 hover:text-ink hover:bg-bg-3",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Appearance & Preferences settings section.
 *
 * **Appearance tab**: theme, layout, window chrome, density, accent.
 * **Preferences tab**: display content type, queue confidence threshold.
 *
 * All settings are applied immediately via `useTheme()` and persisted
 * to localStorage + AudioSettings backend.
 */
export function AppearanceSection() {
  const {
    appTheme,
    setAppTheme,
    accent,
    setAccent,
    layoutMode,
    setLayoutMode,
    density,
    setDensity,
    contentType,
    setContentType,
    confThreshold,
    setConfThreshold,
  } = useTheme();

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-0">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3 mb-6 pb-3 border-b border-line">
        Appearance &amp; Preferences
      </h2>

      <Tabs defaultValue="appearance">
        <TabsList>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        {/* ── Appearance tab ──────────────────────────────── */}
        <TabsContent value="appearance" className="space-y-6">
          <Section title="Colour scheme">
            <SegmentedControl<ThemeMode>
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "System" },
              ]}
              value={appTheme}
              onChange={setAppTheme}
            />
          </Section>

          <Section title="Accent colour" separator>
            <div className="flex gap-2">
              {ACCENT_COLORS.map(({ name, hex, label }) => (
                <button
                  key={name}
                  title={label}
                  onClick={() => setAccent(name)}
                  className={cn(
                    "w-8 h-8 rounded-full transition-transform",
                    accent === name
                      ? "ring-2 ring-offset-2 ring-offset-bg-3 scale-110"
                      : "hover:scale-105",
                  )}
                  style={{
                    backgroundColor: hex,
                    // ring color uses inline style since it depends on the accent hex
                    ...(accent === name ? { outlineColor: hex } : {}),
                  }}
                />
              ))}
            </div>
          </Section>

          <Section title="Layout" separator>
            <SettingRow label="Stage layout">
              <SegmentedControl<LayoutMode>
                options={[
                  { value: "cinematic", label: "Cinematic" },
                  { value: "dense", label: "Dense" },
                ]}
                value={layoutMode}
                onChange={setLayoutMode}
              />
            </SettingRow>
            <SettingRow label="UI density">
              <SegmentedControl<UIDensity>
                options={[
                  { value: "normal", label: "Normal" },
                  { value: "compact", label: "Compact" },
                ]}
                value={density}
                onChange={setDensity}
              />
            </SettingRow>
          </Section>
        </TabsContent>

        {/* ── Preferences tab ─────────────────────────────── */}
        <TabsContent value="preferences" className="space-y-6">
          <Section title="Display output">
            <SettingRow
              label="Content type"
              description="What the display screen shows during live."
            >
              <SegmentedControl<ContentType>
                options={[
                  { value: "scripture", label: "Verse" },
                  { value: "lyrics", label: "Lyric" },
                  { value: "slide", label: "Slide" },
                  { value: "black", label: "Black" },
                ]}
                value={contentType}
                onChange={setContentType}
              />
            </SettingRow>
          </Section>

          <Section
            title="AI queue"
            separator
            description="Items below the confidence threshold are hidden from the queue."
          >
            <SettingRow label={`Confidence threshold — ${confThreshold}%`}>
              <div className="w-40">
                <Slider
                  min={40}
                  max={95}
                  step={1}
                  value={[confThreshold]}
                  onValueChange={([v]: number[]) => setConfThreshold(v)}
                />
              </div>
            </SettingRow>
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
