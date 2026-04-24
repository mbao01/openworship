/**
 * Tour store — manages the 5-step guided tour state machine.
 *
 * State is persisted to the Rust backend (tutorial.json) via Tauri commands,
 * with a localStorage fallback for web dev mode.
 *
 * Uses useSyncExternalStore so all subscribed components re-render together.
 */

import { useSyncExternalStore } from "react";
import { getTutorialState, setTutorialState } from "../lib/commands/tutorial";
import type { TutorialState } from "../lib/types";

export type { TutorialState };

// ─── Module-level state ───────────────────────────────────────────────────────

interface TourStoreState {
  tutorialState: TutorialState;
  loading: boolean;
  exitConfirmVisible: boolean;
}

let state: TourStoreState = {
  tutorialState: "not_started",
  loading: true,
  exitConfirmVisible: false,
};

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function setState(patch: Partial<TourStoreState>) {
  state = { ...state, ...patch };
  notify();
}

// ─── Async init ───────────────────────────────────────────────────────────────

let initPromise: Promise<void> | null = null;

function init(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = getTutorialState()
    .then((s) => setState({ tutorialState: s, loading: false }))
    .catch(() => setState({ loading: false }));
  return initPromise;
}

// Kick off the load immediately (don't wait for a component to subscribe)
init();

// ─── Selectors ────────────────────────────────────────────────────────────────

export function isTourActive(): boolean {
  const s = state.tutorialState;
  return (
    s === "in_progress_step_1" ||
    s === "in_progress_step_2" ||
    s === "in_progress_step_3" ||
    s === "in_progress_step_4" ||
    s === "in_progress_step_5"
  );
}

export function getCurrentStep(): 1 | 2 | 3 | 4 | 5 | null {
  switch (state.tutorialState) {
    case "in_progress_step_1":
      return 1;
    case "in_progress_step_2":
      return 2;
    case "in_progress_step_3":
      return 3;
    case "in_progress_step_4":
      return 4;
    case "in_progress_step_5":
      return 5;
    default:
      return null;
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

async function persist(next: TutorialState) {
  setState({ tutorialState: next, exitConfirmVisible: false });
  await setTutorialState(next);
}

export function startTour(): Promise<void> {
  return persist("in_progress_step_1");
}

export function advanceStep(): Promise<void> {
  const step = getCurrentStep();
  if (step === null) return Promise.resolve();
  if (step < 5) {
    return persist(`in_progress_step_${step + 1}` as TutorialState);
  }
  return persist("completed");
}

export function goToStep(step: 1 | 2 | 3 | 4 | 5): Promise<void> {
  return persist(`in_progress_step_${step}` as TutorialState);
}

export function dismissTour(): Promise<void> {
  return persist("dismissed");
}

export function completeTour(): Promise<void> {
  return persist("completed");
}

export function resetTour(): Promise<void> {
  return persist("not_started");
}

export function showExitConfirm(): void {
  setState({ exitConfirmVisible: true });
}

export function hideExitConfirm(): void {
  setState({ exitConfirmVisible: false });
}

// ─── React hook ───────────────────────────────────────────────────────────────

export interface UseTourReturn {
  tutorialState: TutorialState;
  loading: boolean;
  isTourActive: boolean;
  currentStep: 1 | 2 | 3 | 4 | 5 | null;
  exitConfirmVisible: boolean;
}

export function useTour(): UseTourReturn {
  const s = useSyncExternalStore(
    (cb: () => void) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
  return {
    tutorialState: s.tutorialState,
    loading: s.loading,
    isTourActive: isTourActive(),
    currentStep: getCurrentStep(),
    exitConfirmVisible: s.exitConfirmVisible,
  };
}
