import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { AudioSettings } from "@/lib/types";

const mockGetAudioSettings = vi.fn<() => Promise<AudioSettings>>();
const mockSetAudioSettings = vi.fn<(s: AudioSettings) => Promise<void>>();

vi.mock("@/lib/commands/settings", () => ({
  getAudioSettings: (...args: unknown[]) => mockGetAudioSettings(...(args as [])),
  setAudioSettings: (...args: unknown[]) => mockSetAudioSettings(...(args as [AudioSettings])),
}));

import { useAudioSettings } from "./use-audio-settings";

const mockSettings: AudioSettings = {
  backend: "whisper",
  semantic_enabled: true,
  semantic_threshold_auto: 0.7,
  semantic_threshold_copilot: 0.5,
  lyrics_threshold_auto: 0.6,
  lyrics_threshold_copilot: 0.4,
  audio_input_device: null,
  theme: "system",
  whisper_model: "small",
  provider_config: {},
  send_crash_reports: false,
};

describe("useAudioSettings", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockGetAudioSettings.mockResolvedValue(mockSettings);
    mockSetAudioSettings.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with settings=null and loading=true", () => {
    const { result } = renderHook(() => useAudioSettings());
    expect(result.current.settings).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it("loads settings on mount", async () => {
    vi.useRealTimers();
    const { result } = renderHook(() => useAudioSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.settings).toEqual(mockSettings);
  });

  it("handles load failure gracefully", async () => {
    vi.useRealTimers();
    mockGetAudioSettings.mockRejectedValue(new Error("backend down"));
    const { result } = renderHook(() => useAudioSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.settings).toBeNull();
  });

  it("update merges patch into local state immediately", async () => {
    vi.useRealTimers();
    const { result } = renderHook(() => useAudioSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.update({ backend: "deepgram" });
    });

    expect(result.current.settings?.backend).toBe("deepgram");
    // Other fields unchanged
    expect(result.current.settings?.whisper_model).toBe("small");
  });

  it("update auto-saves after 600ms debounce", async () => {
    const { result } = renderHook(() => useAudioSettings());
    await act(async () => { await vi.advanceTimersByTimeAsync(0); }); // let load resolve

    act(() => {
      result.current.update({ backend: "deepgram" });
    });

    // Not saved yet
    expect(mockSetAudioSettings).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(600); });

    expect(mockSetAudioSettings).toHaveBeenCalledTimes(1);
    expect(mockSetAudioSettings).toHaveBeenCalledWith(
      expect.objectContaining({ backend: "deepgram" }),
    );
  });

  it("update debounces multiple rapid calls into one save", async () => {
    const { result } = renderHook(() => useAudioSettings());
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    act(() => {
      result.current.update({ semantic_threshold_auto: 0.3 });
      result.current.update({ semantic_threshold_auto: 0.6 });
      result.current.update({ semantic_threshold_auto: 0.9 });
    });

    await act(async () => { await vi.advanceTimersByTimeAsync(600); });

    expect(mockSetAudioSettings).toHaveBeenCalledTimes(1);
    expect(mockSetAudioSettings).toHaveBeenCalledWith(
      expect.objectContaining({ semantic_threshold_auto: 0.9 }),
    );
  });

  it("save persists current settings immediately", async () => {
    vi.useRealTimers();
    const { result } = renderHook(() => useAudioSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.save();
    });

    expect(mockSetAudioSettings).toHaveBeenCalledWith(mockSettings);
  });

  it("save is a no-op when settings is null", async () => {
    vi.useRealTimers();
    mockGetAudioSettings.mockRejectedValue(new Error("no settings"));
    const { result } = renderHook(() => useAudioSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.save();
    });

    expect(mockSetAudioSettings).not.toHaveBeenCalled();
  });
});
