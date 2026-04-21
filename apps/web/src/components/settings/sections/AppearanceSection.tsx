import {
  useTheme,
  type ContentType,
  type LayoutMode,
  type UIDensity,
} from "@/hooks/use-theme";
import { Section, SettingRow } from "@/components/ui/section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/cn";
import { THEME_PRESETS } from "@/lib/themes";
import type { ThemeMode } from "@/lib/types";
import { CheckIcon } from "lucide-react";

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
              ? "bg-accent text-accent-foreground font-semibold"
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
 * Mini preview swatch showing a theme's colors at a glance.
 * Shows bg, accent bar, text lines, and a button-like accent element.
 */
function ThemePreview({
  bg,
  accent,
  ink,
  ink2,
}: {
  bg: string;
  accent: string;
  ink: string;
  ink2: string;
}) {
  return (
    <div
      className="w-full aspect-[16/10] rounded-sm overflow-hidden p-2 flex flex-col justify-between"
      style={{ backgroundColor: bg }}
    >
      {/* Top accent bar */}
      <div className="flex items-center gap-1.5">
        <div
          className="w-1 h-1 rounded-full"
          style={{ backgroundColor: accent }}
        />
        <div
          className="h-[3px] w-8 rounded-full"
          style={{ backgroundColor: ink2, opacity: 0.5 }}
        />
      </div>
      {/* Text lines */}
      <div className="flex flex-col gap-1">
        <div
          className="h-[3px] w-12 rounded-full"
          style={{ backgroundColor: ink, opacity: 0.7 }}
        />
        <div
          className="h-[3px] w-8 rounded-full"
          style={{ backgroundColor: ink2, opacity: 0.4 }}
        />
      </div>
      {/* Accent button */}
      <div className="flex justify-end">
        <div
          className="h-2 w-6 rounded-sm"
          style={{ backgroundColor: accent }}
        />
      </div>
    </div>
  );
}

/**
 * Appearance & Preferences settings section.
 *
 * **Appearance tab**: preset theme, light/dark mode, layout, density.
 * **Preferences tab**: display content type, queue confidence threshold.
 */
export function AppearanceSection() {
  const {
    appTheme,
    setAppTheme,
    preset,
    setPreset,
    layoutMode,
    setLayoutMode,
    density,
    setDensity,
    contentType,
    setContentType,
    confThreshold,
    setConfThreshold,
  } = useTheme();

  // Determine resolved mode for preview rendering
  const resolvedMode =
    appTheme === "system"
      ? typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : appTheme;

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

          <Section title="Theme" separator>
            <div className="grid grid-cols-3 gap-2.5">
              {THEME_PRESETS.map((theme) => {
                const isSelected = preset === theme.id;
                const tokens =
                  resolvedMode === "dark" ? theme.dark : theme.light;
                return (
                  <button
                    key={theme.id}
                    onClick={() => setPreset(theme.id)}
                    className={cn(
                      "relative flex flex-col rounded-lg border-2 p-1.5 transition-all cursor-pointer",
                      isSelected
                        ? "border-accent ring-1 ring-accent/30 scale-[1.02]"
                        : "border-line hover:border-line-strong hover:scale-[1.01]",
                    )}
                  >
                    <ThemePreview
                      bg={tokens.bg}
                      accent={tokens.accent}
                      ink={tokens.ink}
                      ink2={tokens.ink2}
                    />
                    <span
                      className={cn(
                        "mt-1.5 text-[10px] font-mono tracking-[0.08em]",
                        isSelected ? "text-accent font-semibold" : "text-ink-3",
                      )}
                    >
                      {theme.name}
                    </span>
                    {isSelected && (
                      <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
                        <CheckIcon className="w-2.5 h-2.5 text-accent-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
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
