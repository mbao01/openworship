import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Capture the event listener registered by the hook so tests can fire events.
type ListenCallback = (event: { payload: number }) => void;
let registeredCallback: ListenCallback | null = null;
const mockUnlisten = vi.fn();

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((
    _eventName: string,
    callback: ListenCallback,
  ) => {
    registeredCallback = callback;
    return Promise.resolve(mockUnlisten);
  }),
}));

import { useAudioLevel } from "./use-audio-level";

describe("useAudioLevel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registeredCallback = null;
  });

  it("returns 0 initially before any event is received", () => {
    const { result } = renderHook(() => useAudioLevel());
    expect(result.current).toBe(0);
  });

  it("updates to the level emitted by the audio://level-updated event", async () => {
    const { result } = renderHook(() => useAudioLevel());

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      registeredCallback?.({ payload: 0.75 });
    });

    expect(result.current).toBe(0.75);
  });

  it("updates to 0 when the backend emits 0 (monitor stopped)", async () => {
    const { result } = renderHook(() => useAudioLevel());

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      registeredCallback?.({ payload: 0.6 });
    });
    expect(result.current).toBe(0.6);

    act(() => {
      registeredCallback?.({ payload: 0 });
    });
    expect(result.current).toBe(0);
  });

  it("calls unlisten on unmount to avoid listener leaks", async () => {
    const { unmount } = renderHook(() => useAudioLevel());

    await act(async () => {
      await Promise.resolve();
    });

    unmount();
    expect(mockUnlisten).toHaveBeenCalledTimes(1);
  });

  it("handles null/undefined payload gracefully", async () => {
    const { result } = renderHook(() => useAudioLevel());

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      registeredCallback?.({ payload: undefined as unknown as number });
    });

    expect(result.current).toBe(0);
  });
});
