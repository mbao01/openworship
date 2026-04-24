/**
 * TourOverlay — 5-step guided tour for the first-run experience.
 *
 * Renders a portal overlay with:
 *  - Spotlight mask: semi-transparent backdrop with a cut-out over the target element
 *  - Step popover: anchored relative to the target, shows copy, Next/Skip, progress dots
 *  - Keyboard nav: Tab+Enter to advance, ESC to skip
 *  - Focus management: focus moves to popover on step open
 *  - Click-outside: shows "Exit tour?" confirmation tooltip
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { TourStep } from "../../hooks/use-tutorial";

interface TourStepConfig {
  step: TourStep;
  targetSelector: string;
  title: string;
  body: string;
  primaryLabel: string;
  interactive?: boolean;
}

const STEPS: TourStepConfig[] = [
  {
    step: 1,
    targetSelector: '[data-qa="operator-col-center"]',
    title: "This is your stage.",
    body: "Whatever appears here goes live on the display screen. Right now: nothing is live. Let's change that.",
    primaryLabel: "Next →",
  },
  {
    step: 2,
    targetSelector: '[data-qa="operator-col-left"]',
    title: "Search for any Bible verse.",
    body: 'Try typing "John 3:16" in the search box below.',
    primaryLabel: "Skip step",
    interactive: true,
  },
  {
    step: 3,
    targetSelector: '[data-qa="operator-col-left"]',
    title: "Click a result to push it live.",
    body: "The stage updates instantly.",
    primaryLabel: "Skip step",
    interactive: true,
  },
  {
    step: 4,
    targetSelector: '[data-qa="operator-col-right"]',
    title: "The AI listens during service",
    body: "and detects what the pastor is preaching about. In demo mode, we simulate this. Watch the queue →",
    primaryLabel: "Next →",
  },
  {
    step: 5,
    targetSelector: '[data-qa="rail-plan"]',
    title: "Plan your service in advance.",
    body: "Your demo service is already loaded — try adding a song.",
    primaryLabel: "Open Plan →",
  },
];

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getTargetRect(selector: string): TargetRect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

interface TourOverlayProps {
  step: TourStep;
  onNext: () => void;
  onSkip: () => void;
  onComplete: () => void;
}

export function TourOverlay({ step, onNext, onSkip, onComplete }: TourOverlayProps) {
  const config = STEPS[step - 1];
  const [rect, setRect] = useState<TargetRect | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const measure = () => setRect(getTargetRect(config.targetSelector));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [config.targetSelector, step]);

  useEffect(() => {
    if (popoverRef.current) {
      popoverRef.current.focus();
    }
  }, [step]);

  const handlePrimary = useCallback(() => {
    if (step === 5) {
      onComplete();
    } else {
      onNext();
    }
  }, [step, onNext, onComplete]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setConfirmExit(true);
      }
      if (e.key === "Enter" && !confirmExit) {
        e.preventDefault();
        handlePrimary();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, confirmExit]);

  const handleSkip = useCallback(() => onSkip(), [onSkip]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === overlayRef.current) {
        setConfirmExit(true);
      }
    },
    [],
  );

  if (!rect) {
    return createPortal(
      <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/60">
        <StepPopover
          ref={popoverRef}
          config={config}
          step={step}
          confirmExit={confirmExit}
          onPrimary={handlePrimary}
          onSkip={handleSkip}
          onConfirmExit={onSkip}
          onCancelExit={() => setConfirmExit(false)}
        />
      </div>,
      document.body,
    );
  }

  const PADDING = 8;
  const spotlightTop = rect.top - PADDING;
  const spotlightLeft = rect.left - PADDING;
  const spotlightW = rect.width + PADDING * 2;
  const spotlightH = rect.height + PADDING * 2;
  const POPOVER_GAP = 12;
  const popoverTop = spotlightTop + spotlightH + POPOVER_GAP;

  return createPortal(
    <>
      <div
        ref={overlayRef}
        className="fixed inset-0 z-[900]"
        onClick={handleOverlayClick}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed z-[901] rounded-sm ring-2 ring-accent/60 transition-all duration-300"
        style={{
          top: spotlightTop,
          left: spotlightLeft,
          width: spotlightW,
          height: spotlightH,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.65)",
        }}
      />
      <div
        className="fixed z-[902] transition-all duration-300"
        style={{ top: popoverTop, left: spotlightLeft }}
      >
        <StepPopover
          ref={popoverRef}
          config={config}
          step={step}
          confirmExit={confirmExit}
          onPrimary={handlePrimary}
          onSkip={handleSkip}
          onConfirmExit={onSkip}
          onCancelExit={() => setConfirmExit(false)}
        />
      </div>
    </>,
    document.body,
  );
}

interface StepPopoverProps {
  config: TourStepConfig;
  step: TourStep;
  confirmExit: boolean;
  onPrimary: () => void;
  onSkip: () => void;
  onConfirmExit: () => void;
  onCancelExit: () => void;
  ref: React.Ref<HTMLDivElement>;
}

function StepPopover({
  config,
  step,
  confirmExit,
  onPrimary,
  onSkip,
  onConfirmExit,
  onCancelExit,
  ref,
}: StepPopoverProps) {
  if (confirmExit) {
    return (
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Exit tour?"
        className="w-72 rounded-lg bg-gray-950/95 p-4 shadow-xl outline-none ring-1 ring-white/10"
      >
        <p className="mb-3 text-sm text-white">Exit the tour?</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onConfirmExit}
            className="flex-1 rounded bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20"
          >
            Exit tour
          </button>
          <button
            type="button"
            onClick={onCancelExit}
            className="flex-1 rounded bg-accent px-3 py-1.5 text-xs text-accent-foreground hover:opacity-90"
          >
            Stay in tour
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`Tour step ${step} of 5`}
      className="w-80 rounded-lg bg-gray-950/95 p-4 shadow-xl outline-none ring-1 ring-white/10"
    >
      <div
        className="mb-3 flex items-center gap-1"
        aria-label={`Step ${step} of 5`}
      >
        {([1, 2, 3, 4, 5] as TourStep[]).map((s) => (
          <span
            key={s}
            className={`h-1.5 w-1.5 rounded-full transition-colors ${
              s === step
                ? "bg-accent"
                : s < step
                  ? "bg-white/60"
                  : "bg-white/20"
            }`}
          />
        ))}
        <span className="ml-auto font-mono text-[9px] text-white/40">
          {step} / 5
        </span>
      </div>

      <p className="mb-1 text-sm font-semibold text-white">{config.title}</p>
      <p className="mb-4 text-xs leading-relaxed text-white/70">{config.body}</p>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-white/40 hover:text-white/70"
        >
          Skip tour
        </button>
        <button
          type="button"
          onClick={onPrimary}
          className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90"
        >
          {config.primaryLabel}
        </button>
      </div>
    </div>
  );
}
