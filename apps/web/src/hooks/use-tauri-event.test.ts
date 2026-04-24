import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

let capturedEvent: string | null = null;
let capturedCallback: ((event: { payload: unknown }) => void) | null = null;
const mockUnlisten = vi.fn();

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((event: string, cb: (event: { payload: unknown }) => void) => {
    capturedEvent = event;
    capturedCallback = cb;
    return Promise.resolve(mockUnlisten);
  }),
}));

import { useTauriEvent } from "./use-tauri-event";

describe("useTauriEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedEvent = null;
    capturedCallback = null;
  });

  it("subscribes to the specified event on mount", async () => {
    const handler = vi.fn();
    renderHook(() => useTauriEvent("my://test-event", handler));

    await waitFor(() => expect(capturedEvent).toBe("my://test-event"));
  });

  it("calls the handler when the event fires", async () => {
    const handler = vi.fn();
    renderHook(() => useTauriEvent("my://test-event", handler));
    await waitFor(() => expect(capturedCallback).not.toBeNull());

    capturedCallback!({ payload: { text: "hello" } });

    expect(handler).toHaveBeenCalledWith({ payload: { text: "hello" } });
  });

  it("calls unlisten on unmount", async () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useTauriEvent("my://test-event", handler));
    await waitFor(() => expect(capturedCallback).not.toBeNull());

    unmount();
    expect(mockUnlisten).toHaveBeenCalledTimes(1);
  });
});
