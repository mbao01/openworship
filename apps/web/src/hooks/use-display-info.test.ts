import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const mockGetDisplayWindowOpen = vi.fn<() => Promise<boolean>>();
const mockListMonitors = vi.fn<() => Promise<unknown[]>>();

vi.mock("@/lib/commands/display-window", () => ({
  getDisplayWindowOpen: (...args: unknown[]) =>
    mockGetDisplayWindowOpen(...(args as [])),
  listMonitors: (...args: unknown[]) => mockListMonitors(...(args as [])),
}));

import { useDisplayInfo } from "./use-display-info";

const MONITOR_PRIMARY = {
  name: "Built-in Retina",
  width: 2560,
  height: 1600,
  position_x: 0,
  position_y: 0,
  scale_factor: 2,
  is_primary: true,
};

const MONITOR_EXTERNAL = {
  name: "LG HDR WQHD",
  width: 1920,
  height: 1080,
  position_x: 2560,
  position_y: 0,
  scale_factor: 1,
  is_primary: false,
};

describe("useDisplayInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDisplayWindowOpen.mockResolvedValue(false);
    mockListMonitors.mockResolvedValue([MONITOR_PRIMARY]);
  });

  it("returns closed state initially", () => {
    const { result } = renderHook(() => useDisplayInfo());
    expect(result.current.open).toBe(false);
    expect(result.current.monitor).toBeNull();
  });

  it("returns open with external monitor when display is open", async () => {
    mockGetDisplayWindowOpen.mockResolvedValue(true);
    mockListMonitors.mockResolvedValue([MONITOR_PRIMARY, MONITOR_EXTERNAL]);

    const { result } = renderHook(() => useDisplayInfo());

    await waitFor(() => {
      expect(result.current.open).toBe(true);
    });

    expect(result.current.monitor).toEqual(MONITOR_EXTERNAL);
  });

  it("falls back to primary when no external monitor", async () => {
    mockGetDisplayWindowOpen.mockResolvedValue(true);
    mockListMonitors.mockResolvedValue([MONITOR_PRIMARY]);

    const { result } = renderHook(() => useDisplayInfo());

    await waitFor(() => {
      expect(result.current.open).toBe(true);
    });

    expect(result.current.monitor).toEqual(MONITOR_PRIMARY);
  });

  it("returns null monitor when display is closed", async () => {
    mockGetDisplayWindowOpen.mockResolvedValue(false);
    mockListMonitors.mockResolvedValue([MONITOR_PRIMARY, MONITOR_EXTERNAL]);

    const { result } = renderHook(() => useDisplayInfo());

    await waitFor(() => {
      expect(mockGetDisplayWindowOpen).toHaveBeenCalled();
    });

    expect(result.current.open).toBe(false);
    expect(result.current.monitor).toBeNull();
  });

  it("handles errors gracefully", async () => {
    mockGetDisplayWindowOpen.mockRejectedValue(new Error("not available"));
    mockListMonitors.mockRejectedValue(new Error("not available"));

    const { result } = renderHook(() => useDisplayInfo());

    await waitFor(() => {
      expect(mockGetDisplayWindowOpen).toHaveBeenCalled();
    });

    expect(result.current.open).toBe(false);
    expect(result.current.monitor).toBeNull();
  });

  it("stops polling on unmount", async () => {
    vi.useFakeTimers();

    const { unmount } = renderHook(() => useDisplayInfo());

    await vi.advanceTimersByTimeAsync(0);

    mockGetDisplayWindowOpen.mockClear();
    mockListMonitors.mockClear();
    unmount();

    await vi.advanceTimersByTimeAsync(10000);
    expect(mockGetDisplayWindowOpen).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
