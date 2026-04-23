import { cn } from "@/lib/cn";

interface VuMeterProps {
  /** Normalized audio level [0–1]. */
  level: number;
  /** Number of bars to display. */
  bars?: number;
  /** Whether to show the percentage. */
  showPercentage?: boolean;
  className?: string;
}

/**
 * Audio level visualizer — 10 bars, each 3px wide, accent when active, live when hot.
 * Matches the `.levels` pattern from the OW design (level-bar, on, hot classes).
 *
 * Applies a 3× boost to raw RMS values so typical speech (0.01–0.1) is visible.
 */
function VuMeter({
  level,
  bars = 10,
  showPercentage,
  className,
}: VuMeterProps) {
  // Boost low RMS values so typical speech registers visually
  const boosted = Math.min(1, level * 3);

  return (
    <div
      data-slot="vu-meter"
      className={cn("flex h-4 items-end gap-[2px]", className)}
    >
      {showPercentage && (
        <span className="w-6 text-center font-mono text-[10px] text-ink-3 tabular-nums">
          {boosted > 0.01 ? `${Math.round(boosted * 100)}%` : "—"}
        </span>
      )}
      {Array.from({ length: bars }, (_, i) => {
        const dropoff = Math.max(0, 1 - i * 0.12);
        const barLevel = boosted * dropoff;
        const height = Math.max(2, barLevel * 16);
        const isOn = barLevel > 0.2;
        const isHot = barLevel > 0.85;

        return (
          <span
            key={i}
            className={cn(
              "w-[3px] rounded-[1px] transition-[background-color] duration-100",
              isHot ? "bg-live" : isOn ? "bg-accent" : "bg-bg-4",
            )}
            style={{ height }}
          />
        );
      })}
    </div>
  );
}

export { VuMeter };
