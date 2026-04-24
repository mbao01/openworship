/**
 * @module lib/validated-invoke
 *
 * A thin wrapper around Tauri's `invoke` that parses the IPC response through a
 * Zod schema before returning it. Any mismatch between the Rust serialisation and
 * the expected TypeScript shape throws an error immediately, surfacing backend
 * drift at the call site rather than silently propagating undefined values into
 * the UI.
 *
 * Usage:
 *   import { invokeValidated } from "../validated-invoke";
 *   import { SongSchema } from "../schemas";
 *   import { z } from "zod";
 *
 *   const songs = await invokeValidated("list_songs", z.array(SongSchema));
 */

import { z } from "zod";
import { invoke } from "./tauri";

/**
 * Invokes a Tauri command and validates the response against `schema`.
 *
 * @param command - The Tauri command name (snake_case, matches the Rust handler).
 * @param schema  - A Zod schema describing the expected response shape.
 * @param args    - Optional arguments forwarded to the Tauri command.
 * @returns The validated, typed response.
 * @throws {Error} If the response does not match `schema`.
 */
export async function invokeValidated<T>(
  command: string,
  schema: z.ZodType<T>,
  args?: Record<string, unknown>,
): Promise<T> {
  const raw = await (args !== undefined
    ? invoke<unknown>(command, args)
    : invoke<unknown>(command));
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `[OPE-150] Tauri command "${command}" returned an unexpected shape.\n` +
        result.error.message,
    );
  }
  return result.data;
}
