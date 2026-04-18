import { cn } from "@/lib/cn";

interface ConfBarProps {
  /** Confidence value 0–100. */
  value: number;
  variant?: "live" | "next" | "default";
  className?: string;
}

/**
 * 2px tall confidence bar — used in queue items to show detection confidence.
 * Matches the `.qi-conf-bar` / `.fill` pattern from the OW design.
 */
function ConfBar({ value, variant = "default", className }: ConfBarProps) {
  return (
    <div
      data-slot="conf-bar"
      className={cn("h-[2px] w-full overflow-hidden rounded-full bg-bg-4", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all",
          variant === "live"    ? "bg-live"    :
          variant === "next"    ? "bg-accent"  :
          "bg-accent/60"
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export { ConfBar };
