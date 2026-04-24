import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const mockCheckWhisperModel = vi.fn<(modelFilename?: string) => Promise<boolean>>();
const mockDownloadWhisperModel = vi.fn<(modelFilename?: string) => Promise<void>>();

vi.mock("@/lib/commands/audio", () => ({
  checkWhisperModel: (...args: unknown[]) =>
    mockCheckWhisperModel(...(args as [string | undefined])),
  downloadWhisperModel: (...args: unknown[]) =>
    mockDownloadWhisperModel(...(args as [string | undefined])),
}));

let progressCallback: ((event: { payload: { progress: number; done: boolean; model?: string } }) => void) | null = null;
const mockUnlisten = vi.fn();

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(
    (
      _event: string,
      cb: (event: { payload: { progress: number; done: boolean; model?: string } }) => void,
    ) => {
      progressCallback = cb;
      return Promise.resolve(mockUnlisten);
    },
  ),
}));

import { useWhisperModel } from "./use-whisper-model";

describe("useWhisperModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    progressCallback = null;
    mockCheckWhisperModel.mockResolvedValue(false);
    mockDownloadWhisperModel.mockResolvedValue(undefined);
  });

  it("starts with installed=false, downloading=false, progress=0", async () => {
    const { result } = renderHook(() => useWhisperModel());

    expect(result.current.installed).toBe(false);
    expect(result.current.downloading).toBe(false);
    expect(result.current.progress).toBe(0);
  });

  it("sets installed=true when checkWhisperModel resolves true", async () => {
    mockCheckWhisperModel.mockResolvedValue(true);
    const { result } = renderHook(() => useWhisperModel());

    await waitFor(() => {
      expect(result.current.installed).toBe(true);
    });
  });

  it("passes modelFilename to checkWhisperModel", async () => {
    mockCheckWhisperModel.mockResolvedValue(false);
    renderHook(() => useWhisperModel("ggml-small.en.bin"));

    await waitFor(() => {
      expect(mockCheckWhisperModel).toHaveBeenCalledWith("ggml-small.en.bin");
    });
  });

  it("handles checkWhisperModel failure gracefully (installed stays false)", async () => {
    mockCheckWhisperModel.mockRejectedValue(new Error("not found"));
    const { result } = renderHook(() => useWhisperModel());

    await waitFor(() => {
      // check was called
      expect(mockCheckWhisperModel).toHaveBeenCalled();
    });
    expect(result.current.installed).toBe(false);
  });

  it("download sets downloading=true while in progress", async () => {
    let resolve!: () => void;
    mockDownloadWhisperModel.mockReturnValue(new Promise<void>((r) => { resolve = r; }));

    const { result } = renderHook(() => useWhisperModel());
    await waitFor(() => expect(progressCallback).not.toBeNull());

    act(() => {
      void result.current.download();
    });

    expect(result.current.downloading).toBe(true);
    expect(result.current.progress).toBe(0);

    resolve();
  });

  it("download passes modelFilename to downloadWhisperModel", async () => {
    const { result } = renderHook(() => useWhisperModel("ggml-small.en.bin"));
    await waitFor(() => expect(progressCallback).not.toBeNull());

    await act(async () => {
      await result.current.download();
    });

    expect(mockDownloadWhisperModel).toHaveBeenCalledWith("ggml-small.en.bin");
  });

  it("download failure resets downloading to false", async () => {
    mockDownloadWhisperModel.mockRejectedValue(new Error("download failed"));
    const { result } = renderHook(() => useWhisperModel());
    await waitFor(() => expect(progressCallback).not.toBeNull());

    await act(async () => {
      await result.current.download();
    });

    expect(result.current.downloading).toBe(false);
    expect(result.current.installed).toBe(false);
  });

  it("progress events update progress state", async () => {
    const { result } = renderHook(() => useWhisperModel());
    await waitFor(() => expect(progressCallback).not.toBeNull());

    act(() => {
      progressCallback!({ payload: { progress: 45, done: false } });
    });

    expect(result.current.progress).toBe(45);
  });

  it("progress event with done=true sets installed=true and resets progress", async () => {
    const { result } = renderHook(() => useWhisperModel());
    await waitFor(() => expect(progressCallback).not.toBeNull());

    act(() => {
      progressCallback!({ payload: { progress: 100, done: true } });
    });

    expect(result.current.installed).toBe(true);
    expect(result.current.downloading).toBe(false);
    expect(result.current.progress).toBe(0);
  });

  it("calls unlisten on unmount", async () => {
    const { unmount } = renderHook(() => useWhisperModel());
    await waitFor(() => expect(progressCallback).not.toBeNull());
    unmount();
    expect(mockUnlisten).toHaveBeenCalledTimes(1);
  });
});
