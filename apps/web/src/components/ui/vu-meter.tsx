import { cn } from "@/lib/cn";

interface VuMeterProps {
  /** Normalized audio level [0–1]. */
  level: number;
  /** Number of bars to display. */
  bars?: number;
  className?: string;
}

/**
 * Audio level visualizer — 10 bars, each 3px wide, accent when active, live when hot.
 * Matches the `.levels` pattern from the OW design (level-bar, on, hot classes).
 */
function VuMeter({ level, bars = 10, className }: VuMeterProps) {
  return (
    <div
      data-slot="vu-meter"
      className={cn("flex gap-[2px] items-end h-4", className)}
    >
      {Array.from({ length: bars }, (_, i) => {
        const dropoff = Math.max(0, 1 - i * 0.12);
        const barLevel = level * dropoff;
        const height = Math.max(2, barLevel * 16);
        const isOn = barLevel > 0.2;
        const isHot = barLevel > 0.85;

        return (
          <span
            key={i}
            className={cn(
              "w-[3px] rounded-[1px] transition-[background-color] duration-100",
              isHot ? "bg-live" : isOn ? "bg-accent" : "bg-bg-4"
            )}
            style={{ height }}
          />
        );
      })}
    </div>
  );
}

export { VuMeter };
