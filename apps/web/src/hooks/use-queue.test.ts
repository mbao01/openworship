import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { QueueItem } from "@/lib/types";

// Mock the detection commands
const mockGetQueue = vi.fn<() => Promise<QueueItem[]>>().mockResolvedValue([]);
const mockApproveItem = vi.fn().mockResolvedValue(undefined);
const mockDismissItem = vi.fn().mockResolvedValue(undefined);
const mockSkipItem = vi.fn().mockResolvedValue(undefined);
const mockClearLive = vi.fn().mockResolvedValue(undefined);
const mockClearQueue = vi.fn().mockResolvedValue(undefined);
const mockNextItem = vi.fn().mockResolvedValue(undefined);
const mockPrevItem = vi.fn().mockResolvedValue(undefined);
const mockRejectLiveItem = vi.fn().mockResolvedValue(undefined);
const mockGetBlackout = vi.fn<() => Promise<boolean>>().mockResolvedValue(false);
const mockToggleBlackout = vi.fn<() => Promise<boolean>>().mockResolvedValue(false);

vi.mock("@/lib/commands/detection", () => ({
  getQueue: (...args: unknown[]) => mockGetQueue(...(args as [])),
  approveItem: (...args: unknown[]) => mockApproveItem(...args),
  dismissItem: (...args: unknown[]) => mockDismissItem(...args),
  skipItem: (...args: unknown[]) => mockSkipItem(...args),
  clearLive: (...args: unknown[]) => mockClearLive(...args),
  clearQueue: (...args: unknown[]) => mockClearQueue(...args),
  nextItem: (...args: unknown[]) => mockNextItem(...args),
  prevItem: (...args: unknown[]) => mockPrevItem(...args),
  rejectLiveItem: (...args: unknown[]) => mockRejectLiveItem(...args),
  getBlackout: (...args: unknown[]) => mockGetBlackout(...(args as [])),
  toggleBlackout: (...args: unknown[]) => mockToggleBlackout(...(args as [])),
}));

const mockInvoke = vi.fn().mockResolvedValue(undefined);
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// Mock the Tauri event listener
let eventCallback: (() => void) | null = null;
const mockUnlisten = vi.fn();

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((_event: string, cb: () => void) => {
    eventCallback = cb;
    return Promise.resolve(mockUnlisten);
  }),
}));

import { useQueue } from "./use-queue";
import type { ArtifactEntry } from "@/lib/types";

const makeArtifact = (overrides: Partial<ArtifactEntry> & { id: string; name: string }): ArtifactEntry => ({
  service_id: null,
  path: `media/${overrides.name}`,
  is_dir: false,
  parent_path: "media",
  size_bytes: 1000,
  mime_type: "video/mp4",
  starred: false,
  thumbnail_path: null,
  created_at_ms: Date.now(),
  modified_at_ms: Date.now(),
  ...overrides,
});

const makePendingItem = (id: string): QueueItem => ({
  id,
  reference: `Ref ${id}`,
  text: `Text ${id}`,
  translation: "ESV",
  status: "pending",
  detected_at_ms: Date.now(),
});

const makeLiveItem = (id: string): QueueItem => ({
  ...makePendingItem(id),
  status: "live",
});

describe("useQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    eventCallback = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls getQueue on initial mount", async () => {
    vi.useRealTimers();
    mockGetQueue.mockResolvedValueOnce([makePendingItem("1")]);

    const { result } = renderHook(() => useQueue());

    await waitFor(() => {
      expect(result.current.queue).toHaveLength(1);
    });
    expect(mockGetQueue).toHaveBeenCalledTimes(1);
  });

  it("separates pending and live items", async () => {
    vi.useRealTimers();
    mockGetQueue.mockResolvedValueOnce([
      makePendingItem("1"),
      makeLiveItem("2"),
      makePendingItem("3"),
    ]);

    const { result } = renderHook(() => useQueue());

    await waitFor(() => {
      expect(result.current.queue).toHaveLength(2);
      expect(result.current.live).not.toBeNull();
      expect(result.current.live!.id).toBe("2");
    });
  });

  it("debounces event-driven reloads by 300ms", async () => {
    mockGetQueue.mockResolvedValue([]);

    renderHook(() => useQueue());

    // Wait for the initial load to finish
    await vi.advanceTimersByTimeAsync(0);

    mockGetQueue.mockClear();

    // Simulate rapid-fire events
    act(() => {
      eventCallback?.();
      eventCallback?.();
      eventCallback?.();
    });

    // Not yet called — debounce hasn't fired
    expect(mockGetQueue).not.toHaveBeenCalled();

    // Advance past the 300ms debounce
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(mockGetQueue).toHaveBeenCalledTimes(1);
  });

  it("approve calls approveItem and reloads the queue", async () => {
    vi.useRealTimers();
    mockGetQueue.mockResolvedValue([makePendingItem("abc")]);

    const { result } = renderHook(() => useQueue());

    await waitFor(() => expect(result.current.queue).toHaveLength(1));

    await act(async () => {
      await result.current.approve("abc");
    });

    expect(mockApproveItem).toHaveBeenCalledWith("abc");
    // getQueue called on mount + after approve
    expect(mockGetQueue).toHaveBeenCalledTimes(2);
  });

  it("dismiss calls dismissItem and reloads the queue", async () => {
    vi.useRealTimers();
    mockGetQueue.mockResolvedValue([]);

    const { result } = renderHook(() => useQueue());
    await waitFor(() => expect(mockGetQueue).toHaveBeenCalled());

    await act(async () => {
      await result.current.dismiss("xyz");
    });

    expect(mockDismissItem).toHaveBeenCalledWith("xyz");
  });

  it("skip calls skipItem and reloads the queue", async () => {
    vi.useRealTimers();
    mockGetQueue.mockResolvedValue([]);

    const { result } = renderHook(() => useQueue());
    await waitFor(() => expect(mockGetQueue).toHaveBeenCalled());

    await act(async () => {
      await result.current.skip("s1");
    });

    expect(mockSkipItem).toHaveBeenCalledWith("s1");
  });

  it("pushAsset sets live state optimistically without waiting for queue reload", async () => {
    vi.useRealTimers();
    mockGetQueue.mockResolvedValue([]);
    mockInvoke.mockResolvedValue(undefined);

    const { result } = renderHook(() => useQueue());
    await waitFor(() => expect(mockGetQueue).toHaveBeenCalled());

    const asset = makeArtifact({ id: "video-123", name: "worship.mp4" });

    await act(async () => {
      await result.current.pushAsset(asset);
    });

    // Live should be set immediately with artifact data
    expect(result.current.live).not.toBeNull();
    expect(result.current.live!.kind).toBe("custom_slide");
    expect(result.current.live!.image_url).toBe("artifact:video-123");
    expect(result.current.live!.reference).toBe("worship.mp4");
    expect(result.current.live!.status).toBe("live");
  });

  it("pushAsset calls push_artifact_to_display via invoke", async () => {
    vi.useRealTimers();
    mockGetQueue.mockResolvedValue([]);
    mockInvoke.mockResolvedValue(undefined);

    const { result } = renderHook(() => useQueue());
    await waitFor(() => expect(mockGetQueue).toHaveBeenCalled());

    await act(async () => {
      await result.current.pushAsset(makeArtifact({ id: "abc", name: "test.mp4" }));
    });

    expect(mockInvoke).toHaveBeenCalledWith("push_artifact_to_display", {
      artifactId: "abc",
    });
  });

  it("debounced event handler fires once after the debounce delay", async () => {
    mockGetQueue.mockResolvedValue([]);

    const { result } = renderHook(() => useQueue());

    // Wait for initial load
    await vi.advanceTimersByTimeAsync(0);
    mockGetQueue.mockClear();

    // Fire event to start debounce timer
    act(() => {
      eventCallback?.();
    });

    // Advance past the debounce — should fire exactly once
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(mockGetQueue).toHaveBeenCalledTimes(1);

    // Direct action calls (approve) trigger an immediate reload independently
    mockGetQueue.mockResolvedValue([makeLiveItem("x")]);
    await act(async () => {
      await result.current.approve("x");
    });

    expect(mockGetQueue).toHaveBeenCalledTimes(2);
  });
});
