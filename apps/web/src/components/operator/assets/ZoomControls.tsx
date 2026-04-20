import {
  MinusIcon,
  PlusIcon,
  RotateCcwIcon,
} from "lucide-react";

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
    <div className="absolute bottom-2 right-2 flex items-center gap-2 px-2.5 py-1.5 bg-bg-1 border border-line-strong rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.3)] z-10">
      <button
        onClick={onZoomOut}
        disabled={zoom <= minZoom}
        className="p-0.5 text-ink-3 hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
      >
        <MinusIcon className="w-3.5 h-3.5" />
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
        className="p-0.5 text-ink-3 hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
      >
        <PlusIcon className="w-3.5 h-3.5" />
      </button>
      <span className="font-mono text-[10px] text-ink-3 w-8 text-center">
        {zoom}%
      </span>
      <button
        onClick={onZoomReset}
        className="p-0.5 text-ink-3 hover:text-ink cursor-pointer"
        title="Reset zoom"
      >
        <RotateCcwIcon className="w-3 h-3" />
      </button>
    </div>
  );
}
