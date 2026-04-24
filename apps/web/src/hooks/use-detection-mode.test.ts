import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const { mockGetDetectionMode, mockSaveDetectionMode } = vi.hoisted(() => ({
  mockGetDetectionMode: vi.fn(),
  mockSaveDetectionMode: vi.fn(),
}));

vi.mock("@/lib/commands/detection", () => ({
  getDetectionMode: mockGetDetectionMode,
  setDetectionMode: mockSaveDetectionMode,
}));

import { useDetectionMode } from "./use-detection-mode";

describe("useDetectionMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDetectionMode.mockResolvedValue("copilot");
    mockSaveDetectionMode.mockResolvedValue(undefined);
  });

  it("initializes with copilot mode", () => {
    const { result } = renderHook(() => useDetectionMode());
    expect(result.current.mode).toBe("copilot");
  });

  it("loads detection mode from backend on mount", async () => {
    mockGetDetectionMode.mockResolvedValue("auto");
    const { result } = renderHook(() => useDetectionMode());

    await waitFor(() => {
      expect(result.current.mode).toBe("auto");
    });

    expect(mockGetDetectionMode).toHaveBeenCalled();
  });

  it("setMode updates local state immediately", async () => {
    const { result } = renderHook(() => useDetectionMode());
    // Wait for initial load to settle
    await waitFor(() => expect(mockGetDetectionMode).toHaveBeenCalled());

    await act(async () => {
      await result.current.setMode("airplane");
    });

    expect(result.current.mode).toBe("airplane");
  });

  it("setMode persists mode to backend", async () => {
    const { result } = renderHook(() => useDetectionMode());
    await waitFor(() => expect(mockGetDetectionMode).toHaveBeenCalled());

    await act(async () => {
      await result.current.setMode("offline");
    });

    expect(mockSaveDetectionMode).toHaveBeenCalledWith("offline");
  });

  it("handles getDetectionMode failure gracefully", async () => {
    mockGetDetectionMode.mockRejectedValue(new Error("IPC error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useDetectionMode());

    await waitFor(() => {
      expect(mockGetDetectionMode).toHaveBeenCalled();
    });

    // Mode stays at default copilot
    expect(result.current.mode).toBe("copilot");
    consoleSpy.mockRestore();
  });

  it("handles setDetectionMode failure gracefully", async () => {
    mockSaveDetectionMode.mockRejectedValue(new Error("Save failed"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useDetectionMode());
    await waitFor(() => expect(mockGetDetectionMode).toHaveBeenCalled());

    await act(async () => {
      await result.current.setMode("auto");
    });

    // Local state still updated even if save failed
    expect(result.current.mode).toBe("auto");
    consoleSpy.mockRestore();
  });
});
