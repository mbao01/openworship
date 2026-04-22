import { useEffect, useRef, useState } from "react";
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
      className={`relative aspect-video rounded overflow-hidden border-2 transition-all cursor-pointer ${
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
        <div
          className="w-full h-full"
          style={{ background: bg.value }}
        />
      ) : bg.value.startsWith("blob:") || bg.value.startsWith("data:image/") ? (
        <img src={bg.value} alt={bg.name} className="w-full h-full object-cover" />
      ) : bg.value.startsWith("data:video/") ? (
        <video src={bg.value} muted className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-bg-3 flex items-center justify-center text-ink-3 text-[8px] font-mono uppercase">
          {bg.bg_type === "video" ? "Video" : "Image"}
        </div>
      )}
      <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1.5 py-0.5">
        <span className="text-[8px] font-mono text-white/80 truncate block">
          {bg.name}
        </span>
      </div>
      {isActive && (
        <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent" />
      )}
    </button>
  );
}

export function BackgroundPicker({ bg }: { bg: UseDisplayBackgroundReturn }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"presets" | "uploaded">("presets");
  const ref = useRef<HTMLDivElement>(null);
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

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await upload(file);
      setTab("uploaded");
    } catch (err) {
      console.error("Background upload failed:", err);
    }
    e.target.value = "";
  };

  const items = tab === "presets" ? presets : uploaded;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={`inline-flex items-center gap-1.5 px-[11px] py-[7px] font-mono text-[9.5px] tracking-[0.1em] uppercase border rounded transition-colors cursor-pointer ${
          open
            ? "text-accent border-accent bg-accent-soft"
            : "text-ink-2 border-line bg-bg-2 hover:bg-bg-3 hover:text-ink hover:border-line-strong"
        }`}
        onClick={() => setOpen(!open)}
        title="Display background"
      >
        <PaletteIcon className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-[320px] bg-bg-1 border border-line rounded-lg shadow-xl z-[200] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-line">
            <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-2">
              Backgrounds
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="p-1 rounded text-ink-3 hover:text-accent hover:bg-accent-soft transition-colors cursor-pointer"
                onClick={() => fileRef.current?.click()}
                title="Upload background"
              >
                <UploadIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                className="p-1 rounded text-ink-3 hover:text-ink hover:bg-bg-2 transition-colors cursor-pointer"
                onClick={() => setOpen(false)}
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-line">
            {(["presets", "uploaded"] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`flex-1 py-1.5 font-mono text-[9px] tracking-[0.1em] uppercase transition-colors cursor-pointer ${
                  tab === t
                    ? "text-accent border-b-2 border-accent"
                    : "text-ink-3 hover:text-ink-2"
                }`}
                onClick={() => setTab(t)}
              >
                {t} ({t === "presets" ? presets.length : uploaded.length})
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="p-2 max-h-[240px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="py-6 text-center text-ink-3 text-xs">
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
          <div className="flex items-center justify-between px-3 py-2 border-t border-line bg-bg">
            <button
              type="button"
              className="font-mono text-[9px] tracking-[0.1em] uppercase text-ink-3 hover:text-ink transition-colors cursor-pointer"
              onClick={() => {
                clearBackground();
                setOpen(false);
              }}
            >
              Clear background
            </button>
            <button
              type="button"
              className="px-2.5 py-1 font-mono text-[9px] tracking-[0.1em] uppercase border border-accent text-accent-foreground bg-accent rounded transition-colors hover:bg-accent-hover cursor-pointer disabled:opacity-40"
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
        </div>
      )}
    </div>
  );
}
