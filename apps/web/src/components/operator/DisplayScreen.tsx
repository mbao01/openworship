import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CircleIcon, MonitorIcon, PaperclipIcon } from "lucide-react";
import { useQueue } from "../../hooks/use-queue";
import { useDisplayWindow } from "../../hooks/use-display-window";
import { getObsDisplayUrl } from "../../lib/commands/display-window";
import { Toggle } from "../ui/toggle";

const IMG_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"]);
const VID_EXTS = new Set(["mp4", "webm", "mov"]);

function AssetPreview({ artifactRef, filename }: { artifactRef: string; filename?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const artifactId = artifactRef.replace("artifact:", "");
  const ext = (filename || "").split(".").pop()?.toLowerCase() || "";

  useEffect(() => {
    let revoked = false;
    let url: string | null = null;
    invoke<number[]>("read_artifact_bytes", { id: artifactId })
      .then((bytes) => {
        if (revoked) return;
        const blob = new Blob([new Uint8Array(bytes)]);
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => setSrc(null));
    return () => { revoked = true; if (url) URL.revokeObjectURL(url); };
  }, [artifactId]);

  if (!src) return <PaperclipIcon className="w-10 h-10 text-ink-3" />;
  if (IMG_EXTS.has(ext)) return <img src={src} alt="" className="max-w-full max-h-full object-contain" />;
  if (VID_EXTS.has(ext)) return <video src={src} controls className="max-w-full max-h-full" />;
  return <PaperclipIcon className="w-10 h-10 text-ink-3" />;
}

export function DisplayScreen() {
  const { live } = useQueue();
  const { isOpen, monitors, obsUrl: hookObsUrl, openOn, close } = useDisplayWindow();
  const [displayUrl, setDisplayUrl] = useState("http://localhost:1420/display");
  const [selectedMonitor, setSelectedMonitor] = useState<number | null>(null);
  const [safeArea, setSafeArea] = useState(true);

  useEffect(() => {
    getObsDisplayUrl().then(setDisplayUrl).catch(() => {});
  }, []);

  // Use hook's OBS URL if available
  const obsDisplayUrl = hookObsUrl ?? displayUrl;

  const handleOpenOnProjector = async () => {
    await openOn(selectedMonitor ?? undefined);
  };

  const selectedMonitorInfo = selectedMonitor !== null
    ? monitors.find((m) => m.id === selectedMonitor)
    : monitors.find((m) => m.is_primary) ?? monitors[0];
  const selectedMonitorLabel = selectedMonitorInfo?.name ?? null;

  return (
    <div className="flex-1 overflow-y-auto px-14 py-10 bg-bg">
      <h1 className="font-serif text-[44px] font-normal tracking-[-0.025em] mb-2">
        Output <em className="text-accent italic">· display</em>
      </h1>
      <p className="text-ink-3 text-sm mb-8 max-w-[56ch]">
        One source of truth. The display runs on{" "}
        <code className="font-mono bg-bg-2 px-1.5 py-px rounded-sm text-xs">
          {obsDisplayUrl}
        </code>{" "}
        — open it on any screen, or drop it into OBS as a Browser Source.
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
              <CircleIcon className="w-2 h-2 shrink-0 fill-live" /> LIVE · ON
              SCREEN
            </span>
            <span>openworship</span>
          </div>
          {live ? (
            <>
              {live.image_url?.startsWith("artifact:") ? (
                <div className="w-full h-full flex items-center justify-center p-4">
                  <AssetPreview
                    artifactRef={live.image_url}
                    filename={live.reference}
                  />
                </div>
              ) : (
                <>
                  <div className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-accent mb-5">
                    {live.reference} · {live.translation}
                  </div>
                  <div className="font-serif italic text-[clamp(22px,2.8vw,38px)] leading-[1.35] tracking-[-0.01em] max-w-[36ch]">
                    &ldquo;{live.text}&rdquo;
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-center w-full text-primary">
              — no content on screen —
            </div>
          )}
        </div>
      </div>

      {/* Status + action buttons */}
      <div className="max-w-[900px] mb-6 flex items-center gap-3">
        {isOpen ? (
          <>
            <div className="inline-flex items-center gap-2 px-3 py-2 bg-success/10 border border-success/30 rounded text-xs text-success font-medium">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              Projecting
              {selectedMonitorLabel ? ` to ${selectedMonitorLabel}` : ""}
            </div>
            <button
              className="inline-flex items-center gap-1.5 px-4 py-[9px] text-xs font-semibold rounded border border-line bg-bg-2 text-ink-2 cursor-pointer transition-colors hover:bg-bg-3 hover:text-ink"
              onClick={close}
            >
              Close display
            </button>
          </>
        ) : (
          <button
            className="inline-flex items-center gap-1.5 px-4 py-[9px] text-xs font-semibold rounded border border-accent bg-accent text-accent-foreground cursor-pointer transition-[filter] hover:brightness-[1.1]"
            onClick={handleOpenOnProjector}
          >
            <MonitorIcon className="w-4 h-4" />
            Open on projector
          </button>
        )}
      </div>

      {/* Output settings */}
      <div className="max-w-[900px]">
        <h2 className="font-serif text-2xl font-normal tracking-[-0.015em] mb-4 pb-3 border-b border-line">
          Output settings
        </h2>

        {/* Monitor selector */}
        <SettingRow
          label="Display output"
          description={
            monitors.length === 0
              ? "No external displays detected."
              : `${monitors.length} display${monitors.length > 1 ? "s" : ""} detected.`
          }
          control={
            <select
              className="px-2.5 py-[7px] bg-bg-2 border border-line rounded text-ink text-xs min-w-[220px] cursor-pointer focus:border-accent focus:outline-none transition-colors"
              value={selectedMonitor ?? "__primary__"}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "__primary__") {
                  setSelectedMonitor(null);
                } else {
                  setSelectedMonitor(Number(val));
                }
              }}
            >
              <option value="__primary__">Primary monitor</option>
              {monitors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.is_primary ? "Built-in" : "External"}) —{" "}
                  {m.width}×{m.height}
                </option>
              ))}
            </select>
          }
        />

        <SettingRow
          label="Display URL"
          description="Copy this to OBS or open on the projector machine."
          control={
            <span className="font-mono text-[11px] text-accent">
              {obsDisplayUrl}
            </span>
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
