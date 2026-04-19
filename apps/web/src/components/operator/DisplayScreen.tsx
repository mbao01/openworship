import { useEffect, useState } from "react";
import { CircleIcon } from "lucide-react";
import { useQueue } from "../../hooks/use-queue";
import { getObsDisplayUrl, openDisplayWindow } from "../../lib/commands/display-window";
import { getDisplaySettings, setDisplaySettings } from "../../lib/commands/settings";
import type { DisplaySettings } from "../../lib/types";
import { Toggle } from "../ui/toggle";

export function DisplayScreen() {
  const { live } = useQueue();
  const [displayUrl, setDisplayUrl] = useState("http://localhost:7411/display");
  const [displaySettings, setDisplaySettingsState] = useState<DisplaySettings | null>(null);
  const [resolution, setResolution] = useState("1920 × 1080");
  const [background, setBackground] = useState("Solid black");
  const [safeArea, setSafeArea] = useState(true);

  useEffect(() => {
    getObsDisplayUrl().then(setDisplayUrl).catch(() => {});
    getDisplaySettings()
      .then((s) => setDisplaySettingsState(s))
      .catch(() => {});
  }, []);

  const handleOpenOnProjector = () => {
    openDisplayWindow(null).catch(() => {});
  };

  return (
    <div className="flex-1 overflow-y-auto px-14 py-10 bg-bg">
      <h1 className="font-serif text-[44px] font-normal tracking-[-0.025em] mb-2">
        Output <em className="text-accent italic">· display</em>
      </h1>
      <p className="text-ink-3 text-sm mb-8 max-w-[56ch]">
        One source of truth. The display runs on{" "}
        <code className="font-mono bg-bg-2 px-1.5 py-px rounded-sm text-xs">
          {displayUrl}
        </code>{" "}
        — open it on any screen, or drop it into OBS as a Browser
        Source.
      </p>

      {/* Live display preview */}
      <div className="max-w-[900px] mb-4">
        <div
          className="w-full aspect-video bg-[#050403] text-[#F5EFDF] px-[72px] py-14 flex flex-col justify-center relative border border-line-strong"
          style={{
            boxShadow:
              "0 20px 60px -20px rgba(0,0,0,0.6), inset 0 0 120px rgba(0,0,0,0.6)",
          }}
        >
          <div className="absolute top-0 left-0 right-0 px-5 py-2.5 flex justify-between font-mono text-[9.5px] tracking-[0.18em] uppercase text-[rgba(245,239,223,0.5)]">
            <span className="inline-flex items-center gap-1">
              <CircleIcon className="w-3 h-3 shrink-0" fill="currentColor" /> LIVE · ON SCREEN
            </span>
            <span>openworship</span>
          </div>
          {live ? (
            <>
              <div className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-accent mb-5">
                {live.reference} · {live.translation}
              </div>
              <div className="font-serif italic text-[clamp(22px,2.8vw,38px)] leading-[1.35] tracking-[-0.01em] max-w-[36ch]">
                &ldquo;{live.text}&rdquo;
              </div>
            </>
          ) : (
            <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-center w-full text-[#3A332C]">
              — no content on screen —
            </div>
          )}
        </div>
      </div>

      {/* Open on projector button */}
      <div className="max-w-[900px] mb-6">
        <button
          className="inline-flex items-center gap-1.5 px-4 py-[9px] text-xs font-semibold rounded border border-accent bg-accent text-[#1A0D00]"
          onClick={handleOpenOnProjector}
        >
          Open on projector
        </button>
      </div>

      {/* Output settings */}
      <div className="max-w-[900px]">
        <h2 className="font-serif text-2xl font-normal tracking-[-0.015em] mb-4 pb-3 border-b border-line">
          Output settings
        </h2>
        <SettingRow
          label="Display URL"
          description="Copy this to OBS or open on the projector machine."
          control={
            <span className="font-mono text-[11px] text-accent">
              {displayUrl}
            </span>
          }
        />
        <SettingRow
          label="Resolution"
          description="Match your projector's native resolution for sharpest text."
          control={
            <select
              className="px-2.5 py-[7px] bg-bg-2 border border-line rounded-[3px] text-ink text-xs min-w-[180px]"
              value={resolution}
              onChange={(e) => {
                setResolution(e.target.value);
                if (displaySettings) {
                  setDisplaySettings({ ...displaySettings }).catch(() => {});
                }
              }}
            >
              <option>1920 × 1080</option>
              <option>2560 × 1440</option>
              <option>3840 × 2160</option>
            </select>
          }
        />
        <SettingRow
          label="Background"
          description="Black keeps focus on text. Transparent lets you overlay video."
          control={
            <select
              className="px-2.5 py-[7px] bg-bg-2 border border-line rounded-[3px] text-ink text-xs min-w-[180px]"
              value={background}
              onChange={(e) => {
                setBackground(e.target.value);
                if (displaySettings) {
                  setDisplaySettings({ ...displaySettings }).catch(() => {});
                }
              }}
            >
              <option>Solid black</option>
              <option>Transparent</option>
              <option>Custom image</option>
            </select>
          }
        />
        <SettingRow
          label="Safe area"
          description="Keep text inside a 90% margin for lower-third graphics."
          control={
            <Toggle
              checked={safeArea}
              onCheckedChange={(v) => {
                setSafeArea(v);
                if (displaySettings) {
                  setDisplaySettings({ ...displaySettings }).catch(() => {});
                }
              }}
            />
          }
        />
      </div>
    </div>
  );
}

function SettingRow({ label, description, control }: { label: string; description: string; control: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_240px] gap-6 py-4 border-b border-line items-center last:border-b-0">
      <div>
        <div className="text-[13.5px] text-ink">{label}</div>
        <div className="text-xs text-ink-3 mt-1">{description}</div>
      </div>
      <div className="flex justify-end">{control}</div>
    </div>
  );
}
