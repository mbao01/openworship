import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CircleIcon, MonitorIcon, PaperclipIcon } from "lucide-react";
import { useQueue } from "../../hooks/use-queue";
import { useDisplayWindow } from "../../hooks/use-display-window";
import { getObsDisplayUrl } from "../../lib/commands/display-window";
import { Toggle } from "../ui/toggle";

const IMG_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"]);
const VID_EXTS = new Set(["mp4", "webm", "mov"]);

function AssetPreview({
  artifactRef,
  filename,
}: {
  artifactRef: string;
  filename?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const artifactId = artifactRef.replace("artifact:", "");
  const ext = (filename || "").split(".").pop()?.toLowerCase() || "";
  const isVideo = VID_EXTS.has(ext);

  useEffect(() => {
    // Videos: use owmedia:// streaming protocol (no blob, no blocking)
    if (isVideo) {
      setSrc(`owmedia://localhost/${artifactId}`);
      return;
    }
    // Images: read bytes and create blob URL
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
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [artifactId, isVideo]);

  if (!src) return <PaperclipIcon className="h-10 w-10 text-ink-3" />;
  if (IMG_EXTS.has(ext))
    return (
      <img src={src} alt="" className="max-h-full max-w-full object-contain" />
    );
  if (isVideo)
    return <video src={src} controls className="max-h-full max-w-full" />;
  return <PaperclipIcon className="h-10 w-10 text-ink-3" />;
}

export function DisplayScreen() {
  const { live } = useQueue();
  const {
    isOpen,
    monitors,
    obsUrl: hookObsUrl,
    openOn,
    close,
  } = useDisplayWindow();
  const [displayUrl, setDisplayUrl] = useState("http://localhost:1420/display");
  const [selectedMonitor, setSelectedMonitor] = useState<number | null>(null);
  const [safeArea, setSafeArea] = useState(true);

  useEffect(() => {
    getObsDisplayUrl()
      .then(setDisplayUrl)
      .catch(() => {});
  }, []);

  // Use hook's OBS URL if available
  const obsDisplayUrl = hookObsUrl ?? displayUrl;

  const handleOpenOnProjector = async () => {
    await openOn(selectedMonitor ?? undefined);
  };

  const selectedMonitorInfo =
    selectedMonitor !== null
      ? monitors.find((m) => m.id === selectedMonitor)
      : (monitors.find((m) => m.is_primary) ?? monitors[0]);
  const selectedMonitorLabel = selectedMonitorInfo?.name ?? null;

  return (
    <div className="flex-1 overflow-y-auto bg-bg px-14 py-10">
      <h1 className="mb-2 font-serif text-[44px] font-normal tracking-[-0.025em]">
        Output <em className="text-accent italic">· display</em>
      </h1>
      <p className="mb-8 max-w-[56ch] text-sm text-ink-3">
        One source of truth. The display runs on{" "}
        <code className="rounded-sm bg-bg-2 px-1.5 py-px font-mono text-xs">
          {obsDisplayUrl}
        </code>{" "}
        — open it on any screen, or drop it into OBS as a Browser Source.
      </p>

      {/* Live display preview */}
      <div className="mb-4 max-w-[900px]">
        <div
          className="relative flex aspect-video w-full flex-col justify-center border border-line-strong bg-[#050403] px-[72px] py-14 text-[#F5EFDF]"
          style={{
            boxShadow:
              "0 20px 60px -20px rgba(0,0,0,0.6), inset 0 0 120px rgba(0,0,0,0.6)",
          }}
        >
          <div className="absolute top-0 right-0 left-0 flex justify-between px-5 py-2.5 font-mono text-[9.5px] tracking-[0.18em] text-[rgba(245,239,223,0.5)] uppercase">
            <span className="inline-flex items-center gap-1">
              <CircleIcon className="h-2 w-2 shrink-0 fill-live" /> LIVE · ON
              SCREEN
            </span>
            <span>openworship</span>
          </div>
          {live ? (
            <>
              {live.image_url?.startsWith("artifact:") ? (
                <div className="flex h-full w-full items-center justify-center p-4">
                  <AssetPreview
                    artifactRef={live.image_url}
                    filename={live.reference}
                  />
                </div>
              ) : (
                <>
                  <div className="mb-5 font-mono text-[10.5px] tracking-[0.22em] text-accent uppercase">
                    {live.reference} · {live.translation}
                  </div>
                  <div className="max-w-[36ch] font-serif text-[clamp(22px,2.8vw,38px)] leading-[1.35] tracking-[-0.01em] italic">
                    &ldquo;{live.text}&rdquo;
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full text-center font-mono text-[10px] tracking-[0.2em] text-primary uppercase">
              — no content on screen —
            </div>
          )}
        </div>
      </div>

      {/* Status + action buttons */}
      <div className="mb-6 flex max-w-[900px] items-center gap-3">
        {isOpen ? (
          <>
            <div className="inline-flex items-center gap-2 rounded border border-success/30 bg-success/10 px-3 py-2 text-xs font-medium text-success">
              <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
              Projecting
              {selectedMonitorLabel ? ` to ${selectedMonitorLabel}` : ""}
            </div>
            <button
              className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-line bg-bg-2 px-4 py-[9px] text-xs font-semibold text-ink-2 transition-colors hover:bg-bg-3 hover:text-ink"
              onClick={close}
            >
              Close display
            </button>
          </>
        ) : (
          <button
            className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-accent bg-accent px-4 py-[9px] text-xs font-semibold text-accent-foreground transition-[filter] hover:brightness-[1.1]"
            onClick={handleOpenOnProjector}
          >
            <MonitorIcon className="h-4 w-4" />
            Open on projector
          </button>
        )}
      </div>

      {/* Output settings */}
      <div className="max-w-[900px]">
        <h2 className="mb-4 border-b border-line pb-3 font-serif text-2xl font-normal tracking-[-0.015em]">
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
              className="min-w-[220px] cursor-pointer rounded border border-line bg-bg-2 px-2.5 py-[7px] text-xs text-ink transition-colors focus:border-accent focus:outline-none"
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

function SettingRow({
  label,
  description,
  control,
}: {
  label: string;
  description: string;
  control: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1fr_240px] items-center gap-6 border-b border-line py-4 last:border-b-0">
      <div>
        <div className="text-[13.5px] text-ink">{label}</div>
        <div className="mt-1 text-xs text-ink-3">{description}</div>
      </div>
      <div className="flex justify-end">{control}</div>
    </div>
  );
}
