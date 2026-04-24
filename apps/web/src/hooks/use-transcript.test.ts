import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// Capture event callbacks so tests can simulate Tauri events
let transcriptCallback: ((event: { payload: unknown }) => void) | null = null;
const mockUnlisten = vi.fn();

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((_event: string, cb: (event: { payload: unknown }) => void) => {
    transcriptCallback = cb;
    return Promise.resolve(mockUnlisten);
  }),
}));

import { useTranscript } from "./use-transcript";

const makePayload = (text: string, offset_ms = 0, mic_active = true) => ({
  payload: { text, offset_ms, mic_active },
});

describe("useTranscript", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transcriptCallback = null;
  });

  it("starts with empty lines and inactive state", async () => {
    vi.useRealTimers();
    const { result } = renderHook(() => useTranscript());
    await waitFor(() => expect(transcriptCallback).not.toBeNull());
    expect(result.current.lines).toHaveLength(0);
    expect(result.current.isActive).toBe(false);
  });

  it("adds a transcript line when event fires", async () => {
    vi.useRealTimers();
    const { result } = renderHook(() => useTranscript());
    await waitFor(() => expect(transcriptCallback).not.toBeNull());

    act(() => {
      transcriptCallback!(makePayload("Hello world", 1000, true));
    });

    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].text).toBe("Hello world");
    expect(result.current.lines[0].offset_ms).toBe(1000);
    expect(result.current.lines[0].is_current).toBe(true);
    expect(result.current.isActive).toBe(true);
  });

  it("marks previous lines as not current when a new line arrives", async () => {
    vi.useRealTimers();
    const { result } = renderHook(() => useTranscript());
    await waitFor(() => expect(transcriptCallback).not.toBeNull());

    act(() => { transcriptCallback!(makePayload("First line", 100)); });
    act(() => { transcriptCallback!(makePayload("Second line", 200)); });

    expect(result.current.lines).toHaveLength(2);
    expect(result.current.lines[0].is_current).toBe(false);
    expect(result.current.lines[1].is_current).toBe(true);
  });

  it("ignores events with empty/whitespace text (no new line added)", async () => {
    vi.useRealTimers();
    const { result } = renderHook(() => useTranscript());
    await waitFor(() => expect(transcriptCallback).not.toBeNull());

    act(() => { transcriptCallback!(makePayload("  ", 0)); });

    expect(result.current.lines).toHaveLength(0);
    // isActive IS set even for empty text (mic_active drives it)
    expect(result.current.isActive).toBe(true);
  });

  it("resets isActive to false after 3 seconds of inactivity", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTranscript());
    // Flush the listen() Promise so the callback is registered
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    act(() => { transcriptCallback!(makePayload("Hello", 0, true)); });
    expect(result.current.isActive).toBe(true);

    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(result.current.isActive).toBe(false);
    vi.useRealTimers();
  });

  it("resets the inactivity timer when a new event arrives", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTranscript());
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    act(() => { transcriptCallback!(makePayload("Hello", 0, true)); });

    // Advance almost to the 3s timeout
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    expect(result.current.isActive).toBe(true);

    // New event resets the timer
    act(() => { transcriptCallback!(makePayload("World", 500, true)); });

    // Another 2.5s — still within the NEW timer
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    expect(result.current.isActive).toBe(true);

    // Now past the new 3s timer
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(result.current.isActive).toBe(false);
    vi.useRealTimers();
  });

  it("respects MAX_LINES=60 rolling window", async () => {
    vi.useRealTimers();
    const { result } = renderHook(() => useTranscript());
    await waitFor(() => expect(transcriptCallback).not.toBeNull());

    act(() => {
      for (let i = 0; i < 65; i++) {
        transcriptCallback!(makePayload(`Line ${i}`, i));
      }
    });

    expect(result.current.lines).toHaveLength(60);
    expect(result.current.lines[0].text).toBe("Line 5");
    expect(result.current.lines[59].text).toBe("Line 64");
  });

  it("sets isActive=false immediately when mic_active is false", async () => {
    vi.useRealTimers();
    const { result } = renderHook(() => useTranscript());
    await waitFor(() => expect(transcriptCallback).not.toBeNull());

    act(() => { transcriptCallback!(makePayload("Hello", 0, true)); });
    expect(result.current.isActive).toBe(true);

    act(() => { transcriptCallback!(makePayload("Bye", 100, false)); });
    expect(result.current.isActive).toBe(false);
  });

  it("calls unlisten on unmount", async () => {
    vi.useRealTimers();
    const { unmount } = renderHook(() => useTranscript());
    await waitFor(() => expect(transcriptCallback).not.toBeNull());
    unmount();
    expect(mockUnlisten).toHaveBeenCalledTimes(1);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
