import { cn } from "@/lib/cn";

type PulseVariant = "live" | "accent" | "success";

interface PulseIndicatorProps {
  variant?: PulseVariant;
  className?: string;
}

const variantClasses: Record<PulseVariant, string> = {
  live: "bg-live",
  accent: "bg-accent",
  success: "bg-success",
};

/**
 * Animated pulse dot — used for live session indicator in TopBar.
 * Matches the `.mic-dot` animation from the OW design (blink keyframe).
 */
function PulseIndicator({ variant = "live", className }: PulseIndicatorProps) {
  return (
    <span
      data-slot="pulse-indicator"
      className={cn(
        "block h-2 w-2 rounded-full",
        "animate-[blink_2s_infinite]",
        variantClasses[variant],
        className,
      )}
    />
  );
}

export { PulseIndicator };
