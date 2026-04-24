/**
 * WelcomeModal — fires once after create_church or join_church succeeds.
 *
 * - max-w-md, centered, dashboard fades behind at opacity 60%
 * - Primary CTA: "Start the tour" → calls onStartTour (seeds demo content, opens Live screen, starts step 1)
 * - Secondary CTA: "Set up later" → dismisses modal, records that we need a reminder for 2 more sessions
 *
 * Session-count for the "Set up later" reminder is persisted to localStorage
 * as `ow_tutorial_reminder_sessions` (number of sessions remaining).
 */

import { useCallback } from "react";
import { createPortal } from "react-dom";

interface WelcomeModalProps {
  churchName: string;
  onStartTour: () => void;
  onSetUpLater: () => void;
}

export function WelcomeModal({
  churchName,
  onStartTour,
  onSetUpLater,
}: WelcomeModalProps) {
  const handleStartTour = useCallback(() => {
    onStartTour();
  }, [onStartTour]);

  const handleSetUpLater = useCallback(() => {
    // Record 2 more reminder sessions in localStorage.
    localStorage.setItem("ow_tutorial_reminder_sessions", "2");
    onSetUpLater();
  }, [onSetUpLater]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      className="fixed inset-0 z-[800] flex items-center justify-center"
    >
      {/* Backdrop: dashboard at 60% opacity */}
      <div
        className="absolute inset-0 bg-bg/60 backdrop-blur-[2px]"
        aria-hidden="true"
      />

      {/* Modal card */}
      <div className="relative z-[801] w-full max-w-md rounded-lg border border-line bg-bg-2 px-8 py-10 shadow-2xl">
        {/* Logo + wordmark */}
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <img src="/logo.svg" alt="" aria-hidden="true" className="h-10 w-10" />
          <span className="font-sans text-[10px] font-medium tracking-[0.2em] text-ink-3 uppercase">
            openworship
          </span>
        </div>

        {/* Headline */}
        <h1
          id="welcome-title"
          className="mb-2 text-center text-[22px] font-semibold leading-tight text-ink"
        >
          Welcome to {churchName}!
        </h1>

        {/* 2-minute promise */}
        <p className="mb-6 text-center text-[13px] leading-[1.6] text-ink-3">
          Get the most out of OpenWorship in&nbsp;under 2&nbsp;minutes. We'll
          walk you through pushing scripture live, the AI queue, and your service
          plan — with demo content already loaded.
        </p>

        {/* Demo content callout */}
        <div className="mb-8 rounded border border-accent/20 bg-accent/5 px-4 py-3">
          <p className="text-[12px] leading-[1.5] text-ink-3">
            <span className="font-medium text-ink">Demo content included.</span>{" "}
            A sample service plan and Bible verses are pre-loaded so you can try
            everything immediately — no setup required.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleStartTour}
            className="w-full cursor-pointer rounded border-0 bg-accent py-3 font-sans text-[13px] font-semibold tracking-wide text-accent-foreground transition-[filter] duration-150 ease-out hover:brightness-110"
            autoFocus
          >
            Start the tour →
          </button>
          <button
            type="button"
            onClick={handleSetUpLater}
            className="w-full cursor-pointer rounded border border-line bg-transparent py-2.5 font-sans text-[12px] font-medium text-ink-3 transition-[border-color,color] duration-150 ease-out hover:border-line-strong hover:text-ink"
          >
            Set up later
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
