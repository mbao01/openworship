/**
 * @module commands/tutorial
 *
 * Tauri command wrappers for tutorial / onboarding state persistence.
 * State is stored in ~/.openworship/tutorial.json on the Rust side.
 * Falls back to localStorage when running in a browser dev environment
 * where Tauri is unavailable.
 */

import { invoke } from "../tauri";
import { invokeValidated } from "../validated-invoke";
import { TutorialStateSchema, SeedResultSchema } from "../schemas";
import type { TutorialState } from "../types";

const LS_KEY = "ow_tutorial_state";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Load the persisted tutorial state.
 * Returns "not_started" on any error.
 * Falls back to localStorage when running outside Tauri (browser dev mode).
 */
export async function getTutorialState(): Promise<TutorialState> {
  if (!isTauri()) {
    const v = localStorage.getItem(LS_KEY);
    return (v as TutorialState | null) ?? "not_started";
  }
  try {
    return await invokeValidated("get_tutorial_state", TutorialStateSchema);
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

export interface SeedResult {
  songs_seeded: number;
  project_seeded: boolean;
}

/**
 * Seed demo songs and a sample service project for the first-run tour.
 * Safe to call multiple times — idempotent on the backend.
 * Falls back to a no-op in browser dev mode (no Tauri).
 */
export async function seedDemoData(): Promise<SeedResult> {
  if (!isTauri()) {
    return { songs_seeded: 0, project_seeded: false };
  }
  try {
    return await invokeValidated("seed_demo_data", SeedResultSchema);
  } catch {
    return { songs_seeded: 0, project_seeded: false };
  }
}
