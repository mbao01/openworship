/**
 * @module commands/tutorial
 *
 * Tauri command wrappers for tutorial / onboarding state persistence.
 * State is stored in ~/.openworship/tutorial.json on the Rust side.
 * Falls back to localStorage when running in a browser dev environment
 * where Tauri is unavailable.
 */

import { invoke } from "../tauri";
import type { TutorialState } from "../types";

const LS_KEY = "ow_tutorial_state";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Load the persisted tutorial state.
 * Returns `"not_started"` on any error.
 */
export async function getTutorialState(): Promise<TutorialState> {
  if (!isTauri()) {
    const v = localStorage.getItem(LS_KEY);
    return (v as TutorialState | null) ?? "not_started";
  }
  try {
    return await invoke<TutorialState>("get_tutorial_state");
  } catch {
    return "not_started";
  }
}

/**
 * Persist a new tutorial state.
 */
export async function setTutorialState(state: TutorialState): Promise<void> {
  if (!isTauri()) {
    localStorage.setItem(LS_KEY, state);
    return;
  }
  try {
    await invoke("set_tutorial_state", { state });
  } catch {
    // best-effort
  }
}
