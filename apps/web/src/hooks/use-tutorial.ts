/**
 * @module hooks/use-tutorial
 *
 * Manages guided-tour state for the first-run onboarding experience.
 * Loads from / persists to the Rust backend (or localStorage fallback).
 */

import { useCallback, useEffect, useState } from "react";
import { getTutorialState, setTutorialState, type TutorialState } from "@/lib/commands/tutorial";

export type TourStep = 1 | 2 | 3 | 4 | 5;

/** Map in_progress_step_N → step number, or null for non-progress states. */
function stepFromState(state: TutorialState): TourStep | null {
  switch (state) {
    case "in_progress_step_1": return 1;
    case "in_progress_step_2": return 2;
    case "in_progress_step_3": return 3;
    case "in_progress_step_4": return 4;
    case "in_progress_step_5": return 5;
    default: return null;
  }
}

function stateFromStep(step: TourStep): TutorialState {
  return `in_progress_step_${step}` as TutorialState;
}

export interface UseTutorialReturn {
  /** True while the initial load from the backend is pending. */
  loading: boolean;
  /** Raw persisted state value. */
  tutorialState: TutorialState;
  /** Current tour step (1–5) or null when tour is not active. */
  activeStep: TourStep | null;
  /** Advance to a specific step and persist. */
  goToStep: (step: TourStep) => Promise<void>;
  /** Advance to the next step; marks completed after step 5. */
  nextStep: () => Promise<void>;
  /** Mark the tour as dismissed (user skipped). */
  dismissTour: () => Promise<void>;
  /** Mark the tour as completed. */
  completeTour: () => Promise<void>;
  /** Start the tour from step 1 (called from Welcome modal). */
  startTour: () => Promise<void>;
}

export function useTutorial(): UseTutorialReturn {
  const [loading, setLoading] = useState(true);
  const [tutorialState, setLocal] = useState<TutorialState>("not_started");

  useEffect(() => {
    getTutorialState()
      .then((s) => setLocal(s))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const persist = useCallback(async (next: TutorialState) => {
    setLocal(next);
    await setTutorialState(next);
  }, []);

  const goToStep = useCallback(
    (step: TourStep) => persist(stateFromStep(step)),
    [persist],
  );

  const nextStep = useCallback(async () => {
    const current = stepFromState(tutorialState);
    if (current === null) return;
    if (current >= 5) {
      await persist("completed");
    } else {
      await persist(stateFromStep((current + 1) as TourStep));
    }
  }, [tutorialState, persist]);

  const dismissTour = useCallback(() => persist("dismissed"), [persist]);
  const completeTour = useCallback(() => persist("completed"), [persist]);
  const startTour = useCallback(() => persist("in_progress_step_1"), [persist]);

  return {
    loading,
    tutorialState,
    activeStep: stepFromState(tutorialState),
    goToStep,
    nextStep,
    dismissTour,
    completeTour,
    startTour,
  };
}
