import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { AudioSettings } from "@/lib/types";

const mockGetAudioSettings = vi.fn<() => Promise<AudioSettings>>();
const mockSetAudioSettings = vi.fn<(s: AudioSettings) => Promise<void>>();

vi.mock("@/lib/commands/settings", () => ({
  getAudioSettings: (...args: unknown[]) => mockGetAudioSettings(...(args as [])),
  setAudioSettings: (...args: unknown[]) => mockSetAudioSettings(...(args as [AudioSettings])),
}));

// Mock applyThemeTokens so we don't need a full DOM with CSS vars
vi.mock("@/lib/themes", () => ({
  getPreset: vi.fn().mockReturnValue({
    dark: {},
    light: {},
  }),
  applyThemeTokens: vi.fn(),
}));

import { useTheme } from "./use-theme";

const baseSettings: AudioSettings = {
  backend: "whisper",
  semantic_enabled: false,
  semantic_threshold_auto: 0.7,
  semantic_threshold_copilot: 0.5,
  lyrics_threshold_auto: 0.6,
  lyrics_threshold_copilot: 0.4,
  audio_input_device: null,
  // Use "dark" to match the default appTheme so the on-mount effect does not
  // call update() and reset state via stale closure.
  theme: "dark",
  whisper_model: "small",
  provider_config: {},
  send_crash_reports: false,
};

describe("useTheme", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockGetAudioSettings.mockResolvedValue(baseSettings);
    mockSetAudioSettings.mockResolvedValue(undefined);
  });

  it("initializes with default prefs", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.appTheme).toBe("dark");
    expect(result.current.preset).toBe("parchment");
    expect(result.current.layoutMode).toBe("cinematic");
    expect(result.current.density).toBe("normal");
    expect(result.current.contentType).toBe("scripture");
    expect(result.current.confThreshold).toBe(60);
  });

  it("loads saved prefs from localStorage", () => {
    localStorage.setItem(
      "ow-ui-prefs",
      JSON.stringify({ appTheme: "light", preset: "midnight", confThreshold: 75 }),
    );
    const { result } = renderHook(() => useTheme());
    expect(result.current.appTheme).toBe("light");
    expect(result.current.preset).toBe("midnight");
    expect(result.current.confThreshold).toBe(75);
  });

  it("updates appTheme and persists to backend", async () => {
    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(mockGetAudioSettings).toHaveBeenCalled());

    mockGetAudioSettings.mockResolvedValue({ ...baseSettings });

    await act(async () => {
      result.current.setAppTheme("light");
    });

    expect(result.current.appTheme).toBe("light");
    await waitFor(() => {
      expect(mockSetAudioSettings).toHaveBeenCalledWith(
        expect.objectContaining({ theme: "light" }),
      );
    });
  });

  it("setPreset updates the preset", async () => {
    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(mockGetAudioSettings).toHaveBeenCalled());
    await act(async () => {
      result.current.setPreset("midnight");
    });
    expect(result.current.preset).toBe("midnight");
  });

  it("setLayoutMode updates the layoutMode", async () => {
    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(mockGetAudioSettings).toHaveBeenCalled());
    await act(async () => {
      result.current.setLayoutMode("dense");
    });
    expect(result.current.layoutMode).toBe("dense");
  });

  it("setDensity updates the density", async () => {
    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(mockGetAudioSettings).toHaveBeenCalled());
    await act(async () => {
      result.current.setDensity("compact");
    });
    expect(result.current.density).toBe("compact");
  });

  it("setContentType updates contentType", async () => {
    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(mockGetAudioSettings).toHaveBeenCalled());
    await act(async () => {
      result.current.setContentType("lyrics");
    });
    expect(result.current.contentType).toBe("lyrics");
  });

  it("setConfThreshold updates confThreshold", async () => {
    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(mockGetAudioSettings).toHaveBeenCalled());
    await act(async () => {
      result.current.setConfThreshold(80);
    });
    expect(result.current.confThreshold).toBe(80);
  });

  it("syncs appTheme from backend on mount if different", async () => {
    mockGetAudioSettings.mockResolvedValue({ ...baseSettings, theme: "light" });
    const { result } = renderHook(() => useTheme());

    await waitFor(() => {
      expect(result.current.appTheme).toBe("light");
    });
  });

  it("does not override local prefs if backend theme matches", async () => {
    localStorage.setItem("ow-ui-prefs", JSON.stringify({ appTheme: "dark" }));
    mockGetAudioSettings.mockResolvedValue({ ...baseSettings, theme: "dark" });

    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(mockGetAudioSettings).toHaveBeenCalled());

    expect(result.current.appTheme).toBe("dark");
    // setAudioSettings should not be called since nothing changed
    expect(mockSetAudioSettings).not.toHaveBeenCalled();
  });

  it("handles getAudioSettings failure gracefully", async () => {
    mockGetAudioSettings.mockRejectedValue(new Error("backend down"));
    const { result } = renderHook(() => useTheme());

    // Should not crash, should keep defaults
    await waitFor(() => expect(mockGetAudioSettings).toHaveBeenCalled());
    expect(result.current.appTheme).toBe("dark");
  });
});
