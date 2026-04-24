import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ─── Mock: @/lib/commands/audio ───────────────────────────────────────────────
const mockGetSttStatus = vi.fn();
vi.mock("@/lib/commands/audio", () => ({
  getSttStatus: (...args: unknown[]) => mockGetSttStatus(...args),
  isSttActive: (status: unknown) =>
    status === "running" ||
    (typeof status === "object" && status !== null && "fallback" in status),
  sttFallbackReason: (status: unknown) => {
    if (typeof status === "object" && status !== null && "fallback" in status) {
      return (status as { fallback: string }).fallback;
    }
    return null;
  },
}));

// ─── Mock: @/lib/toast ────────────────────────────────────────────────────────
const mockToastInfo = vi.fn();
const mockToastSuccess = vi.fn();
vi.mock("@/lib/toast", () => ({
  toast: {
    info: (...args: unknown[]) => mockToastInfo(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: vi.fn(),
  },
}));

import { useSTTStatus } from "./use-stt-status";

describe("useSTTStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns initial state before the first poll completes", () => {
    mockGetSttStatus.mockResolvedValue("stopped");
    const { result } = renderHook(() => useSTTStatus());
    expect(result.current).toEqual({
      isActive: false,
      fallbackReason: null,
      error: false,
    });
  });

  it("reflects running status after first poll", async () => {
    mockGetSttStatus.mockResolvedValue("running");
    const { result } = renderHook(() => useSTTStatus());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isActive).toBe(true);
    expect(result.current.fallbackReason).toBeNull();
    expect(result.current.error).toBe(false);
  });

  it("reflects stopped status after first poll", async () => {
    mockGetSttStatus.mockResolvedValue("stopped");
    const { result } = renderHook(() => useSTTStatus());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isActive).toBe(false);
    expect(result.current.fallbackReason).toBeNull();
  });

  it("detects fallback mode and emits toast.info on transition from non-fallback", async () => {
    // First poll: running
    mockGetSttStatus.mockResolvedValueOnce("running");
    const { result } = renderHook(() => useSTTStatus());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockToastInfo).not.toHaveBeenCalled();

    // Second poll: fallback
    mockGetSttStatus.mockResolvedValueOnce({ fallback: "network unreachable" });
    await act(async () => {
      vi.advanceTimersByTime(5_000);
      await Promise.resolve();
    });

    expect(result.current.isActive).toBe(true);
    expect(result.current.fallbackReason).toBe("network unreachable");
    expect(mockToastInfo).toHaveBeenCalledTimes(1);
    expect(mockToastInfo).toHaveBeenCalledWith(
      expect.stringContaining("local Whisper"),
    );
  });

  it("does NOT re-emit toast.info on consecutive fallback polls", async () => {
    // First poll: already in fallback
    mockGetSttStatus.mockResolvedValue({ fallback: "connection lost" });
    const { result } = renderHook(() => useSTTStatus());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockToastInfo).toHaveBeenCalledTimes(1);

    // Second poll: still in fallback
    await act(async () => {
      vi.advanceTimersByTime(5_000);
      await Promise.resolve();
    });

    expect(mockToastInfo).toHaveBeenCalledTimes(1); // no new toast
    expect(result.current.fallbackReason).toBe("connection lost");
  });

  it("emits toast.success when recovering from fallback to running", async () => {
    // First poll: fallback
    mockGetSttStatus.mockResolvedValueOnce({ fallback: "network unreachable" });
    const { result } = renderHook(() => useSTTStatus());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.fallbackReason).toBe("network unreachable");

    // Second poll: running again
    mockGetSttStatus.mockResolvedValueOnce("running");
    await act(async () => {
      vi.advanceTimersByTime(5_000);
      await Promise.resolve();
    });

    expect(result.current.fallbackReason).toBeNull();
    expect(mockToastSuccess).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).toHaveBeenCalledWith(
      expect.stringContaining("Deepgram restored"),
    );
  });

  it("sets error: true when getSttStatus throws", async () => {
    mockGetSttStatus.mockRejectedValue(new Error("backend unavailable"));
    const { result } = renderHook(() => useSTTStatus());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.error).toBe(true);
  });

  it("cleans up the interval on unmount", async () => {
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    mockGetSttStatus.mockResolvedValue("stopped");

    const { unmount } = renderHook(() => useSTTStatus());

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it("does not update state after unmount (no cancelled-update warning)", async () => {
    let resolveFirst!: (v: unknown) => void;
    mockGetSttStatus.mockReturnValueOnce(
      new Promise((res) => {
        resolveFirst = res;
      }),
    );

    const { result, unmount } = renderHook(() => useSTTStatus());

    // Unmount before the first poll resolves
    unmount();

    // Now resolve — should NOT update state
    await act(async () => {
      resolveFirst("running");
      await Promise.resolve();
    });

    // State stays at initial defaults (no update after unmount)
    expect(result.current).toEqual({
      isActive: false,
      fallbackReason: null,
      error: false,
    });
  });
});
