import "@testing-library/jest-dom";
import * as matchers from "vitest-axe/matchers";
import { expect } from "vitest";

expect.extend(matchers);

// jsdom does not implement scrollIntoView — stub it for tests.
Element.prototype.scrollIntoView = () => {};

// jsdom does not implement ResizeObserver — stub it for tests.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

// Stub Tauri internals so components that import @tauri-apps/api/* don't
// crash in jsdom (there is no native bridge in the test environment).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).__TAURI_INTERNALS__ = {
  transformCallback: () => 0,
  invoke: () => Promise.resolve(),
  listen: () => Promise.resolve(() => {}),
  unregisterListener: () => {},
};

// Stub the event plugin internals used by @tauri-apps/api/event.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).__TAURI_EVENT_PLUGIN_INTERNALS__ = {
  unregisterListener: () => {},
  listeners: {},
};
