import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebounce } from "./use-debounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not call fn before the delay elapses", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebounce(fn, 300));

    act(() => { result.current("a"); });
    expect(fn).not.toHaveBeenCalled();
  });

  it("calls fn after the delay with the latest args", async () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebounce(fn, 300));

    act(() => { result.current("a"); });

    await act(async () => { await vi.advanceTimersByTimeAsync(300); });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("a");
  });

  it("coalesces multiple rapid calls into one", async () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebounce(fn, 200));

    act(() => {
      result.current("x");
      result.current("y");
      result.current("z");
    });

    await act(async () => { await vi.advanceTimersByTimeAsync(200); });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("z");
  });

  it("resets the timer on each call", async () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebounce(fn, 300));

    act(() => { result.current("first"); });
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    act(() => { result.current("second"); });
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });

    // Still not called — the 300ms timer reset when "second" was called
    expect(fn).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("second");
  });

  it("returns a stable function reference across re-renders", () => {
    const fn = vi.fn();
    const { result, rerender } = renderHook(() => useDebounce(fn, 300));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it("cancels the pending timer on unmount", async () => {
    const fn = vi.fn();
    const { result, unmount } = renderHook(() => useDebounce(fn, 300));

    act(() => { result.current("hello"); });
    unmount();

    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(fn).not.toHaveBeenCalled();
  });

  it("always calls the latest fn even after fn reference changes", async () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    let currentFn = fn1;

    const { result, rerender } = renderHook(() => useDebounce(currentFn, 300));

    act(() => { result.current("arg"); });

    // Update fn reference before the debounce fires
    currentFn = fn2;
    rerender();

    await act(async () => { await vi.advanceTimersByTimeAsync(300); });

    // Should call the latest fn (fn2), not the stale fn1
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalledWith("arg");
  });
});
