/**
 * TourOverlay — 5-step guided tour for the first-run experience.
 *
 * Renders a portal overlay with:
 *  - Spotlight mask: semi-transparent backdrop with a cut-out over the target
 *    element (CSS box-shadow trick — zero extra DOM layers)
 *  - Step popover: anchored below the target, shows step N/5, copy, Next/Skip
 *  - Keyboard nav: ESC → "Exit tour?" confirmation, Enter/Tab+Enter → next step
 *  - Focus management: focus moves to popover on step open, returns on close
 *  - Ghost-type hint on Step 2 after 8 s of inactivity
 *  - Click-outside: shows "Exit tour?" confirmation tooltip
 *  - Auto-advance: Step 2 advances when first scripture result appears;
 *    Step 3 advances when a verse is pushed
 *
 * To trigger auto-advance from other components:
 *   window.dispatchEvent(new CustomEvent("tour:scripture-result-appeared"))
 *   window.dispatchEvent(new CustomEvent("tour:scripture-pushed"))
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  useTour,
  advanceStep,
  dismissTour,
  showExitConfirm,
  hideExitConfirm,
} from "../../../stores/tour-store";

// ─── Step definitions ─────────────────────────────────────────────────────────

interface StepConfig {
  targetSelector: string;
  title: string;
  body: string;
  primaryLabel: string;
  /** Whether to show pulse ring animation on the spotlight */
  pulse?: boolean;
}

const STEPS: StepConfig[] = [
  {
    targetSelector: '[data-qa="operator-col-center"]',
    title: "This is your stage.",
    body: "Whatever appears here goes live on the display screen. Right now: nothing is live. Let\u2019s change that.",
    primaryLabel: "Next \u2192",
  },
  {
    targetSelector: '[data-qa="scripture-search-input"]',
    title: "Search for any Bible verse.",
    body: 'Try typing \u201cJohn 3:16\u201d in the search box \u2192',
    primaryLabel: "Skip step",
  },
  {
    targetSelector: '[data-qa="scripture-result-0"]',
    title: "Click a result to push it live.",
    body: "The stage updates instantly.",
    primaryLabel: "Skip step",
    pulse: true,
  },
  {
    targetSelector: '[data-qa="operator-col-right"]',
    title: "The AI listens during service",
    body: "and detects what the pastor is preaching about. In demo mode, we simulate this. Watch the queue \u2192",
    primaryLabel: "Next \u2192",
  },
  {
    targetSelector: '[data-qa="rail-plan"]',
    title: "Plan your service in advance.",
    body: "Your demo service is already loaded \u2014 try adding a song.",
    primaryLabel: "Open Plan \u2192",
  },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const SPOTLIGHT_PADDING = 8;
const POPOVER_GAP = 12;
const GHOST_TEXT = "John 3:16";
const GHOST_IDLE_MS = 8_000;
const GHOST_EXECUTE_DELAY_MS = 3_000;

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

interface TourOverlayProps {
  /** Called when Step 5 "Open Plan →" is clicked */
  onOpenPlan?: () => void;
  /**
   * Called by TourOverlay when an interactive step auto-advances (Steps 2 and 3).
   * OperatorPage wires this to `advanceStep()` so it stays in control of tour state.
   */
  onAdvance?: () => void;
}

export function TourOverlay({ onOpenPlan, onAdvance }: TourOverlayProps) {
  const { isTourActive, currentStep, exitConfirmVisible } = useTour();
  const [rect, setRect] = useState<TargetRect | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const ghostIdleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ghostExecuteRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const config = currentStep !== null ? STEPS[currentStep - 1] : null;

  // ── Target element measurement ──────────────────────────────────────────────

  useLayoutEffect(() => {
    if (!config) {
      setRect(null);
      return;
    }
    const measure = () => setRect(getTargetRect(config.targetSelector));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [config, currentStep]);

  // ── Focus management ────────────────────────────────────────────────────────

  useEffect(() => {
    if (isTourActive && popoverRef.current) {
      popoverRef.current.focus();
    }
  }, [isTourActive, currentStep]);

  // ── Ghost-type (Step 2) ─────────────────────────────────────────────────────

  const clearGhostTimers = useCallback(() => {
    if (ghostIdleRef.current !== null) {
      clearTimeout(ghostIdleRef.current);
      ghostIdleRef.current = null;
    }
    if (ghostExecuteRef.current !== null) {
      clearTimeout(ghostExecuteRef.current);
      ghostExecuteRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (currentStep !== 2 || !isTourActive) {
      clearGhostTimers();
      return;
    }

    ghostIdleRef.current = setTimeout(() => {
      // Ghost-type the placeholder text
      const input = document.querySelector<HTMLInputElement>(
        '[data-qa="scripture-search-input"]',
      );
      if (input) {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set;
        nativeSetter?.call(input, GHOST_TEXT);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }

      // After additional delay, fire the search
      ghostExecuteRef.current = setTimeout(() => {
        const searchInput = document.querySelector<HTMLInputElement>(
          '[data-qa="scripture-search-input"]',
        );
        if (searchInput) {
          searchInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }, GHOST_EXECUTE_DELAY_MS);
    }, GHOST_IDLE_MS);

    return () => clearGhostTimers();
  }, [currentStep, isTourActive, clearGhostTimers]);

  // ── Auto-advance events ─────────────────────────────────────────────────────
  // Window events dispatched by ScriptureSearchPanel; OperatorPage owns the
  // advance action via the onAdvance prop so it stays in control of tour state.

  useEffect(() => {
    const onResult = () => {
      if (currentStep === 2) onAdvance?.();
    };
    const onPushed = () => {
      if (currentStep === 3) onAdvance?.();
    };
    window.addEventListener("tour:scripture-result-appeared", onResult);
    window.addEventListener("tour:scripture-pushed", onPushed);
    return () => {
      window.removeEventListener("tour:scripture-result-appeared", onResult);
      window.removeEventListener("tour:scripture-pushed", onPushed);
    };
  }, [currentStep, onAdvance]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleNext = useCallback(() => {
    if (currentStep === 5) {
      void dismissTour();
      onOpenPlan?.();
    } else {
      void advanceStep();
    }
  }, [currentStep, onOpenPlan]);

  // ── Keyboard navigation ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!isTourActive) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (exitConfirmVisible) {
          hideExitConfirm();
        } else {
          showExitConfirm();
        }
        return;
      }
      if (e.key === "Enter" && !exitConfirmVisible) {
        // Only advance if focus is inside the popover
        const popoverEl = popoverRef.current;
        if (popoverEl && popoverEl.contains(document.activeElement)) {
          e.preventDefault();
          handleNext();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isTourActive, exitConfirmVisible, currentStep, handleNext]);

  const handleSkip = useCallback(() => {
    showExitConfirm();
  }, []);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === overlayRef.current && !exitConfirmVisible) {
        showExitConfirm();
      }
    },
    [exitConfirmVisible],
  );

  const handleConfirmExit = useCallback(() => {
    void dismissTour();
  }, []);

  const handleCancelExit = useCallback(() => {
    hideExitConfirm();
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!isTourActive || currentStep === null || !config) return null;

  // Spotlight geometry
  const spotTop = rect ? rect.top - SPOTLIGHT_PADDING : 0;
  const spotLeft = rect ? rect.left - SPOTLIGHT_PADDING : 0;
  const spotW = rect ? rect.width + SPOTLIGHT_PADDING * 2 : 0;
  const spotH = rect ? rect.height + SPOTLIGHT_PADDING * 2 : 0;

  // Popover position: anchor right for narrow targets (e.g. Rail icon buttons),
  // below for wider targets (column-level or panel-level spotlights).
  const isNarrowTarget = rect ? rect.width < 200 : false;
  const popoverTop = rect
    ? isNarrowTarget
      ? spotTop
      : spotTop + spotH + POPOVER_GAP
    : window.innerHeight / 2;
  const popoverLeft = rect
    ? isNarrowTarget
      ? Math.min(spotLeft + spotW + POPOVER_GAP, window.innerWidth - 320 - 8)
      : Math.min(Math.max(spotLeft, 8), window.innerWidth - 320 - 8)
    : window.innerWidth / 2 - 160;

  return createPortal(
    <>
      {/* Pulse ring animation */}
      {config.pulse && (
        <style>{`
          @keyframes tour-pulse-ring {
            0%, 100% { opacity: 0.7; transform: scale(1); }
            50%       { opacity: 0.2; transform: scale(1.03); }
          }
        `}</style>
      )}

      {/* Clickable backdrop — shows exit confirmation on click */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-[900]"
        onClick={handleOverlayClick}
        aria-hidden="true"
      />

      {/* Spotlight cut-out using CSS box-shadow */}
      {rect && (
        <div
          className="pointer-events-none fixed z-[901] rounded-md transition-all duration-300"
          style={{
            top: spotTop,
            left: spotLeft,
            width: spotW,
            height: spotH,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.70)",
            outline: config.pulse
              ? "2px solid rgba(124,106,255,0.6)"
              : "2px solid rgba(255,255,255,0.15)",
            animation: config.pulse
              ? "tour-pulse-ring 1.8s ease-in-out infinite"
              : undefined,
          }}
        />
      )}

      {/* Step Popover */}
      <div
        className="fixed z-[902] transition-all duration-300"
        style={{ top: popoverTop, left: popoverLeft }}
      >
        <StepPopover
          ref={popoverRef}
          step={currentStep}
          title={config.title}
          body={config.body}
          primaryLabel={config.primaryLabel}
          confirmExit={exitConfirmVisible}
          onPrimary={handleNext}
          onSkip={handleSkip}
          onConfirmExit={handleConfirmExit}
          onCancelExit={handleCancelExit}
        />
      </div>
    </>,
    document.body,
  );
}

// ─── StepPopover ──────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5;

interface StepPopoverProps {
  step: number;
  title: string;
  body: string;
  primaryLabel: string;
  confirmExit: boolean;
  onPrimary: () => void;
  onSkip: () => void;
  onConfirmExit: () => void;
  onCancelExit: () => void;
  ref: React.Ref<HTMLDivElement>;
}

function StepPopover({
  step,
  title,
  body,
  primaryLabel,
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
        role="alertdialog"
        aria-modal="true"
        aria-label="Exit tour confirmation"
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
            className="flex-1 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90"
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
      aria-label={`Tour step ${step} of ${TOTAL_STEPS}`}
      className="w-80 rounded-lg bg-gray-950/95 p-4 shadow-xl outline-none ring-1 ring-white/10"
    >
      {/* Progress dots */}
      <div
        role="group"
        aria-label={`Step ${step} of ${TOTAL_STEPS}`}
        className="mb-3 flex items-center gap-1"
      >
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <span
            key={i}
            aria-label={`Step ${i + 1}${i + 1 === step ? " (current)" : ""}`}
            className={`h-1.5 w-1.5 rounded-full transition-colors ${
              i + 1 === step
                ? "bg-accent"
                : i + 1 < step
                  ? "bg-white/60"
                  : "bg-white/20"
            }`}
          />
        ))}
        <span className="ml-auto font-mono text-[9px] text-white/40">
          {step} / {TOTAL_STEPS}
        </span>
      </div>

      {/* Copy */}
      <p className="mb-1 text-sm font-semibold text-white">{title}</p>
      <p className="mb-4 text-xs leading-relaxed text-white/70">{body}</p>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-white/40 transition-colors hover:text-white/70"
        >
          Skip tour
        </button>
        <button
          type="button"
          onClick={onPrimary}
          className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-gray-950"
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}
