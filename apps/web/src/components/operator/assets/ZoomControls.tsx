import { MinusIcon, PlusIcon, RotateCcwIcon } from "lucide-react";

export function ZoomControls({
  zoom,
  minZoom,
  maxZoom,
  zoomStep,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onZoomChange,
}: {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  zoomStep: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onZoomChange: (value: number) => void;
}) {
  return (
    <div className="absolute right-2 bottom-2 z-10 flex items-center gap-2 rounded-lg border border-line-strong bg-bg-1 px-2.5 py-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.3)]">
      <button
        onClick={onZoomOut}
        disabled={zoom <= minZoom}
        className="cursor-pointer p-0.5 text-ink-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
      >
        <MinusIcon className="h-3.5 w-3.5" />
      </button>
      <input
        type="range"
        min={minZoom}
        max={maxZoom}
        step={zoomStep}
        value={zoom}
        onChange={(e) => onZoomChange(Number(e.target.value))}
        className="w-20 accent-accent"
      />
      <button
        onClick={onZoomIn}
        disabled={zoom >= maxZoom}
        className="cursor-pointer p-0.5 text-ink-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
      >
        <PlusIcon className="h-3.5 w-3.5" />
      </button>
      <span className="w-8 text-center font-mono text-[10px] text-ink-3">
        {zoom}%
      </span>
      <button
        onClick={onZoomReset}
        className="cursor-pointer p-0.5 text-ink-3 hover:text-ink"
        title="Reset zoom"
      >
        <RotateCcwIcon className="h-3 w-3" />
      </button>
    </div>
  );
}
