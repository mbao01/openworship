import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const mockGetAudioLevel = vi.fn<() => Promise<number>>();

vi.mock("@/lib/commands/audio", () => ({
  getAudioLevel: (...args: unknown[]) => mockGetAudioLevel(...(args as [])),
}));

import { useAudioLevel } from "./use-audio-level";

describe("useAudioLevel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAudioLevel.mockResolvedValue(0.5);
  });

  it("returns 0 initially", () => {
    const { result } = renderHook(() => useAudioLevel(100));
    expect(result.current).toBe(0);
  });

  it("polls at the specified interval and returns the level", async () => {
    const { result } = renderHook(() => useAudioLevel(100));

    await waitFor(() => {
      expect(result.current).toBe(0.5);
    });

    expect(mockGetAudioLevel).toHaveBeenCalled();
  });

  it("polls multiple times over multiple intervals", async () => {
    const { result } = renderHook(() => useAudioLevel(50));

    await waitFor(() => {
      expect(mockGetAudioLevel.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    expect(result.current).toBe(0.5);
  });

  it("falls back to 0 when getAudioLevel rejects", async () => {
    mockGetAudioLevel.mockRejectedValue(new Error("mic error"));

    const { result } = renderHook(() => useAudioLevel(100));

    await waitFor(() => {
      expect(mockGetAudioLevel).toHaveBeenCalled();
    });

    // Should remain 0 since error sets level to 0
    expect(result.current).toBe(0);
  });

  it("stops polling on unmount", async () => {
    vi.useFakeTimers();

    const { unmount } = renderHook(() => useAudioLevel(100));

    // Let the first tick fire
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    mockGetAudioLevel.mockClear();
    unmount();

    await vi.advanceTimersByTimeAsync(300);
    expect(mockGetAudioLevel).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
