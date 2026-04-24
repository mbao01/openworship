import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockListMonitors = vi.fn();
const mockOpenDisplayWindow = vi.fn();
const mockCloseDisplayWindow = vi.fn();
const mockGetDisplayWindowOpen = vi.fn();
const mockGetObsDisplayUrl = vi.fn();

vi.mock("@/lib/commands/display-window", () => ({
  listMonitors: (...args: unknown[]) => mockListMonitors(...args),
  openDisplayWindow: (...args: unknown[]) => mockOpenDisplayWindow(...args),
  closeDisplayWindow: (...args: unknown[]) => mockCloseDisplayWindow(...args),
  getDisplayWindowOpen: (...args: unknown[]) => mockGetDisplayWindowOpen(...args),
  getObsDisplayUrl: (...args: unknown[]) => mockGetObsDisplayUrl(...args),
}));

import { useDisplayWindow } from "./use-display-window";

const makePrimaryMonitor = () => ({
  width: 1920,
  height: 1080,
  x: 0,
  y: 0,
  scale_factor: 1,
  is_primary: true,
  name: "Built-in Display",
});

const makeExternalMonitor = () => ({
  width: 2560,
  height: 1440,
  x: 1920,
  y: 0,
  scale_factor: 1,
  is_primary: false,
  name: "External Display",
});

describe("useDisplayWindow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockGetDisplayWindowOpen.mockResolvedValue(false);
    mockListMonitors.mockResolvedValue([makePrimaryMonitor()]);
    mockGetObsDisplayUrl.mockResolvedValue(null);
    mockOpenDisplayWindow.mockResolvedValue(undefined);
    mockCloseDisplayWindow.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes with isOpen=false, empty monitors, obsUrl=null", async () => {
    const { result } = renderHook(() => useDisplayWindow());

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.monitors).toHaveLength(1);
    expect(result.current.obsUrl).toBeNull();
  });

  it("loads monitors and isOpen on mount", async () => {
    mockGetDisplayWindowOpen.mockResolvedValue(true);
    mockGetObsDisplayUrl.mockResolvedValue("http://localhost:4455");

    const { result } = renderHook(() => useDisplayWindow());
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.obsUrl).toBe("http://localhost:4455");
  });

  it("openOn calls openDisplayWindow and sets isOpen=true", async () => {
    const { result } = renderHook(() => useDisplayWindow());
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    await act(async () => {
      await result.current.openOn(0);
    });

    expect(mockOpenDisplayWindow).toHaveBeenCalledWith(0);
    expect(result.current.isOpen).toBe(true);
  });

  it("openOn defaults to null when no monitorId is given", async () => {
    const { result } = renderHook(() => useDisplayWindow());
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    await act(async () => {
      await result.current.openOn();
    });

    expect(mockOpenDisplayWindow).toHaveBeenCalledWith(null);
  });

  it("close calls closeDisplayWindow and sets isOpen=false", async () => {
    mockGetDisplayWindowOpen.mockResolvedValue(true);
    const { result } = renderHook(() => useDisplayWindow());
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    await act(async () => {
      await result.current.close();
    });

    expect(mockCloseDisplayWindow).toHaveBeenCalled();
    expect(result.current.isOpen).toBe(false);
  });

  it("auto-opens on external monitor when a new monitor is added", async () => {
    // First poll: 1 monitor
    mockListMonitors.mockResolvedValueOnce([makePrimaryMonitor()]);
    // Second poll: 2 monitors (external added)
    mockListMonitors.mockResolvedValueOnce([makePrimaryMonitor(), makeExternalMonitor()]);

    renderHook(() => useDisplayWindow());
    await act(async () => { await vi.advanceTimersByTimeAsync(0); }); // initial load
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); }); // poll fires

    // Should auto-open on the external (non-primary) monitor at index 1
    expect(mockOpenDisplayWindow).toHaveBeenCalledWith(1);
  });

  it("falls back to primary when a monitor is removed while display is open", async () => {
    // First poll: 2 monitors, display is open
    mockGetDisplayWindowOpen.mockResolvedValue(true);
    mockListMonitors
      .mockResolvedValueOnce([makePrimaryMonitor(), makeExternalMonitor()])
      .mockResolvedValueOnce([makePrimaryMonitor()]);

    renderHook(() => useDisplayWindow());
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });

    // Should fall back to primary at index 0
    expect(mockOpenDisplayWindow).toHaveBeenCalledWith(0);
  });

  it("polls monitors every 3 seconds", async () => {
    renderHook(() => useDisplayWindow());
    await act(async () => { await vi.advanceTimersByTimeAsync(0); }); // initial
    const callCount = mockListMonitors.mock.calls.length;

    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(mockListMonitors.mock.calls.length).toBe(callCount + 1);

    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(mockListMonitors.mock.calls.length).toBe(callCount + 2);
  });

  it("handles refresh failure gracefully", async () => {
    mockGetDisplayWindowOpen.mockRejectedValue(new Error("backend error"));
    const { result } = renderHook(() => useDisplayWindow());
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    // Should not crash — state stays at defaults
    expect(result.current.isOpen).toBe(false);
  });
});
