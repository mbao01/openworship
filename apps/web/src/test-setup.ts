import "@testing-library/jest-dom";

// jsdom does not implement scrollIntoView — stub it for tests.
Element.prototype.scrollIntoView = () => {};

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
