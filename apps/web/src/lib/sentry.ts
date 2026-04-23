/// <reference types="vite/client" />
/**
 * Sentry crash and error reporting for the React frontend.
 *
 * Disabled by default — call `enableSentry()` only when the user has opted in.
 * Uses `VITE_SENTRY_DSN` embedded at build time; no-ops silently in dev/CI
 * when the variable is unset.
 */
import * as Sentry from "@sentry/react";

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const APP_VERSION = import.meta.env.VITE_APP_VERSION as string | undefined;

let initialized = false;

/** Initialise Sentry and begin capturing unhandled errors. */
export function enableSentry(): void {
  if (!DSN) {
    return; // No DSN — silently skip
  }
  if (initialized) {
    return;
  }

  Sentry.init({
    dsn: DSN,
    release: APP_VERSION ? `openworship@${APP_VERSION}` : undefined,
    // Never send usernames or church names (privacy requirement).
    sendDefaultPii: false,
    // No performance tracing; error capture only.
    tracesSampleRate: 0,
    integrations: [],
  });

  initialized = true;
}

/** Flush queued events and shut Sentry down. */
export function disableSentry(): void {
  if (!initialized) {
    return;
  }
  void Sentry.close(2000).then(() => {
    initialized = false;
  });
}
