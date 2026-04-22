import { useRef, useState } from "react";
import { Popover } from "radix-ui";
import { PaletteIcon, UploadIcon, XIcon } from "lucide-react";
import type { UseDisplayBackgroundReturn } from "../../../hooks/use-display-background";
import type { BackgroundInfo } from "../../../lib/commands/display";

function BackgroundTile({
  bg,
  isActive,
  isPreview,
  onClick,
  onDoubleClick,
}: {
  bg: BackgroundInfo;
  isActive: boolean;
  isPreview: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}) {
  const isGradient = bg.bg_type === "gradient";

  return (
    <button
      type="button"
      className={`relative aspect-video cursor-pointer overflow-hidden rounded border-2 transition-all ${
        isActive
          ? "border-accent ring-1 ring-accent"
          : isPreview
            ? "border-accent/50"
            : "border-transparent hover:border-line-strong"
      }`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={bg.name}
    >
      {isGradient ? (
        <div className="h-full w-full" style={{ background: bg.value }} />
      ) : bg.value.startsWith("blob:") ||
        bg.value.startsWith("data:image/") ? (
        <img
          src={bg.value}
          alt={bg.name}
          className="h-full w-full object-cover"
        />
      ) : bg.value.startsWith("data:video/") ? (
        <video src={bg.value} muted className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-bg-3 font-mono text-[8px] text-ink-3 uppercase">
          {bg.bg_type === "video" ? "Video" : "Image"}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-black/60 px-1.5 py-0.5">
        <span className="block truncate font-mono text-[8px] text-white/80">
          {bg.name}
        </span>
      </div>
      {isActive && (
        <div className="absolute top-1 right-1 h-2 w-2 rounded-full bg-accent" />
      )}
    </button>
  );
}

export function BackgroundPicker({ bg }: { bg: UseDisplayBackgroundReturn }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"presets" | "uploaded">("presets");
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    activeId,
    presets,
    uploaded,
    previewId,
    setPreview,
    applyToLive,
    clearBackground,
    upload,
  } = bg;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTab("uploaded");
    upload(file).catch((err) =>
      console.error("Background upload failed:", err),
    );
    e.target.value = "";
  };

  const items = tab === "presets" ? presets : uploaded;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded border px-[11px] py-[7px] font-mono text-[9.5px] tracking-[0.1em] uppercase transition-colors ${
            open
              ? "border-accent bg-accent-soft text-accent"
              : "border-line bg-bg-2 text-ink-2 hover:border-line-strong hover:bg-bg-3 hover:text-ink"
          }`}
          title="Display background"
        >
          <PaletteIcon className="h-3.5 w-3.5" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="top"
          align="end"
          sideOffset={8}
          className="z-[9999] w-[320px] overflow-hidden rounded-lg border border-line bg-bg-1 shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="font-mono text-[10px] tracking-[0.12em] text-ink-2 uppercase">
              Backgrounds
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="cursor-pointer rounded p-1 text-ink-3 transition-colors hover:bg-accent-soft hover:text-accent"
                onClick={() => fileRef.current?.click()}
                title="Upload background"
              >
                <UploadIcon className="h-3.5 w-3.5" />
              </button>
              <Popover.Close asChild>
                <button
                  type="button"
                  className="cursor-pointer rounded p-1 text-ink-3 transition-colors hover:bg-bg-2 hover:text-ink"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              </Popover.Close>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-line">
            {(["presets", "uploaded"] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`flex-1 cursor-pointer py-1.5 font-mono text-[9px] tracking-[0.1em] uppercase transition-colors ${
                  tab === t
                    ? "border-b-2 border-accent text-accent"
                    : "text-ink-3 hover:text-ink-2"
                }`}
                onClick={() => setTab(t)}
              >
                {t} ({t === "presets" ? presets.length : uploaded.length})
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="max-h-[240px] overflow-y-auto p-2">
            {items.length === 0 ? (
              <div className="py-6 text-center text-xs text-ink-3">
                {tab === "uploaded"
                  ? "No uploaded backgrounds yet"
                  : "No presets available"}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {items.map((bg) => (
                  <BackgroundTile
                    key={bg.id}
                    bg={bg}
                    isActive={activeId === bg.id}
                    isPreview={previewId === bg.id}
                    onClick={() => setPreview(bg.id)}
                    onDoubleClick={() => applyToLive(bg.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-line bg-bg px-3 py-2">
            <button
              type="button"
              className="cursor-pointer font-mono text-[9px] tracking-[0.1em] text-ink-3 uppercase transition-colors hover:text-ink"
              onClick={() => {
                clearBackground();
                setOpen(false);
              }}
            >
              Clear background
            </button>
            <button
              type="button"
              className="cursor-pointer rounded border border-accent bg-accent px-2.5 py-1 font-mono text-[9px] tracking-[0.1em] text-accent-foreground uppercase transition-colors hover:bg-accent-hover disabled:opacity-40"
              disabled={!previewId || previewId === activeId}
              onClick={() => {
                if (previewId) {
                  applyToLive(previewId);
                  setOpen(false);
                }
              }}
            >
              Apply to Live
            </button>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/mp4,video/webm,image/gif"
            className="hidden"
            onChange={handleFileChange}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
