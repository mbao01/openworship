/**
 * @module commands/identity
 *
 * Tauri command wrappers for church identity management.
 * Identity encompasses the church name, branch, role, and invite code
 * and is persisted to ~/.openworship/identity.json.
 */

import { invoke } from "../tauri";
import type { ChurchIdentity } from "../types";

/**
 * Loads the stored church identity from disk.
 * Returns null if the app has not been configured yet (first launch).
 * A null result triggers the onboarding flow.
 */
export async function getIdentity(): Promise<ChurchIdentity | null> {
  return invoke<ChurchIdentity | null>("get_identity");
}

/**
 * Persists the church identity after onboarding or profile updates.
 */
export async function setIdentity(identity: ChurchIdentity): Promise<void> {
  return invoke("set_identity", { identity });
}
