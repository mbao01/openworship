/**
 * ResumeBanner — sticky top banner shown when tutorial is in_progress_step_N.
 *
 * Appears on launch if tutorial_state is in_progress_step_{1-5}.
 * Provides two actions:
 *   - "Resume tour" → continues from the current step
 *   - "Dismiss" → marks the tour as dismissed
 */

import { XIcon } from "lucide-react";
import type { TourStep } from "../../hooks/use-tutorial";

interface ResumeBannerProps {
  step: TourStep;
  onResume: () => void;
  onDismiss: () => void;
}

export function ResumeBanner({ step, onResume, onDismiss }: ResumeBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-between gap-4 border-b border-accent/20 bg-accent/10 px-4 py-2"
    >
      <p className="text-[12px] text-ink-3">
        <span className="font-medium text-ink">Tour paused at step {step} of 5.</span>{" "}
        Ready to continue?
      </p>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onResume}
          className="rounded border border-accent bg-transparent px-3 py-1 font-sans text-[11px] font-medium text-accent transition-[background] duration-150 hover:bg-accent hover:text-accent-foreground"
        >
          Resume tour
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss tour reminder"
          className="flex items-center justify-center rounded p-1 text-ink-3 transition-colors duration-150 hover:text-ink"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
