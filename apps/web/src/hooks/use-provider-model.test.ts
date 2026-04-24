import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const mockCheckProviderModel = vi.fn<(providerId: string, modelId: string) => Promise<boolean>>();
const mockDownloadProviderModel = vi.fn<(providerId: string, modelId: string) => Promise<void>>();

vi.mock("@/lib/commands/audio", () => ({
  checkProviderModel: (...args: unknown[]) =>
    mockCheckProviderModel(...(args as [string, string])),
  downloadProviderModel: (...args: unknown[]) =>
    mockDownloadProviderModel(...(args as [string, string])),
}));

type ProgressCallback = (event: { payload: { percent: number | null; provider: string; model: string } }) => void;
type CompleteCallback = (event: { payload: { provider: string; model: string } }) => void;

let progressCb: ProgressCallback | null = null;
let completeCb: CompleteCallback | null = null;
const mockUnlisten = vi.fn();

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((event: string, cb: unknown) => {
    if (event === "stt://model-download-progress") {
      progressCb = cb as ProgressCallback;
    } else if (event === "stt://model-download-complete") {
      completeCb = cb as CompleteCallback;
    }
    return Promise.resolve(mockUnlisten);
  }),
}));

import { useProviderModel } from "./use-provider-model";

describe("useProviderModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    progressCb = null;
    completeCb = null;
    mockCheckProviderModel.mockResolvedValue(false);
    mockDownloadProviderModel.mockResolvedValue(undefined);
  });

  it("starts with installed=false, downloading=false, progress=0", () => {
    const { result } = renderHook(() => useProviderModel("whisper", "small"));
    expect(result.current.installed).toBe(false);
    expect(result.current.downloading).toBe(false);
    expect(result.current.progress).toBe(0);
  });

  it("skips check when modelId is undefined", async () => {
    renderHook(() => useProviderModel("whisper"));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockCheckProviderModel).not.toHaveBeenCalled();
  });

  it("checks model on mount when modelId is provided", async () => {
    mockCheckProviderModel.mockResolvedValue(true);
    const { result } = renderHook(() => useProviderModel("whisper", "small"));

    await waitFor(() => {
      expect(result.current.installed).toBe(true);
    });
    expect(mockCheckProviderModel).toHaveBeenCalledWith("whisper", "small");
  });

  it("handles check failure gracefully", async () => {
    mockCheckProviderModel.mockRejectedValue(new Error("not found"));
    const { result } = renderHook(() => useProviderModel("whisper", "small"));

    await waitFor(() => {
      expect(mockCheckProviderModel).toHaveBeenCalled();
    });
    expect(result.current.installed).toBe(false);
  });

  it("download starts downloading state", async () => {
    let resolve!: () => void;
    mockDownloadProviderModel.mockReturnValue(new Promise<void>((r) => { resolve = r; }));

    const { result } = renderHook(() => useProviderModel("whisper", "small"));
    await waitFor(() => expect(progressCb).not.toBeNull());

    act(() => {
      void result.current.download("small");
    });

    expect(result.current.downloading).toBe(true);
    resolve();
  });

  it("download failure resets downloading to false", async () => {
    mockDownloadProviderModel.mockRejectedValue(new Error("download failed"));
    const { result } = renderHook(() => useProviderModel("whisper", "small"));
    await waitFor(() => expect(progressCb).not.toBeNull());

    await act(async () => {
      await result.current.download("small");
    });

    expect(result.current.downloading).toBe(false);
  });

  it("progress event updates progress for matching provider+model", async () => {
    const { result } = renderHook(() => useProviderModel("whisper", "small"));
    await waitFor(() => expect(progressCb).not.toBeNull());

    act(() => {
      progressCb!({ payload: { percent: 60, provider: "whisper", model: "small" } });
    });

    expect(result.current.progress).toBe(60);
  });

  it("progress event ignores non-matching provider/model", async () => {
    const { result } = renderHook(() => useProviderModel("whisper", "small"));
    await waitFor(() => expect(progressCb).not.toBeNull());

    act(() => {
      progressCb!({ payload: { percent: 80, provider: "vosk", model: "other" } });
    });

    expect(result.current.progress).toBe(0); // unchanged
  });

  it("complete event sets installed=true for matching provider+model", async () => {
    const { result } = renderHook(() => useProviderModel("whisper", "small"));
    await waitFor(() => expect(completeCb).not.toBeNull());

    act(() => {
      completeCb!({ payload: { provider: "whisper", model: "small" } });
    });

    expect(result.current.installed).toBe(true);
    expect(result.current.downloading).toBe(false);
    expect(result.current.progress).toBe(0);
  });

  it("complete event ignores non-matching provider/model", async () => {
    const { result } = renderHook(() => useProviderModel("whisper", "small"));
    await waitFor(() => expect(completeCb).not.toBeNull());

    act(() => {
      completeCb!({ payload: { provider: "vosk", model: "other" } });
    });

    expect(result.current.installed).toBe(false);
  });

  it("calls unlisten for both events on unmount", async () => {
    const { unmount } = renderHook(() => useProviderModel("whisper", "small"));
    await waitFor(() => expect(completeCb).not.toBeNull());

    unmount();
    expect(mockUnlisten).toHaveBeenCalledTimes(2);
  });
});
