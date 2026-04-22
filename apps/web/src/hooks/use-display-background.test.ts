import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const mockGetDisplayBackground = vi.fn<() => Promise<string | null>>();
const mockListPresetBackgrounds = vi.fn<() => Promise<unknown[]>>();
const mockListUploadedBackgrounds = vi.fn<() => Promise<unknown[]>>();
const mockSetDisplayBackground = vi.fn<() => Promise<void>>();
const mockInvoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
  convertFileSrc: (path: string) => `https://asset.localhost/${path}`,
}));

vi.mock("@/lib/commands/display", () => ({
  getDisplayBackground: (...args: unknown[]) =>
    mockGetDisplayBackground(...(args as [])),
  listPresetBackgrounds: (...args: unknown[]) =>
    mockListPresetBackgrounds(...(args as [])),
  listUploadedBackgrounds: (...args: unknown[]) =>
    mockListUploadedBackgrounds(...(args as [])),
  setDisplayBackground: (...args: unknown[]) =>
    mockSetDisplayBackground(...(args as [])),
}));

import { useDisplayBackground } from "./use-display-background";

const PRESET = {
  id: "preset:dark",
  name: "Dark",
  source: "preset",
  value: "linear-gradient(#000, #111)",
  bg_type: "gradient",
};

const UPLOADED_IMAGE = {
  id: "artifact:img1",
  name: "photo.jpg",
  source: "uploaded",
  value: "artifact:img1",
  bg_type: "image",
};

const UPLOADED_VIDEO = {
  id: "artifact:vid1",
  name: "background.mp4",
  source: "uploaded",
  value: "artifact:vid1",
  bg_type: "video",
};

describe("useDisplayBackground", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDisplayBackground.mockResolvedValue(null);
    mockListPresetBackgrounds.mockResolvedValue([PRESET]);
    mockListUploadedBackgrounds.mockResolvedValue([]);
    mockSetDisplayBackground.mockResolvedValue(undefined);
    mockInvoke.mockResolvedValue(null);

    // jsdom doesn't support createObjectURL — mock it
    if (!globalThis.URL.createObjectURL) {
      globalThis.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    }
    if (!globalThis.URL.revokeObjectURL) {
      globalThis.URL.revokeObjectURL = vi.fn();
    }
  });

  it("loads presets on mount without loading uploaded backgrounds", async () => {
    const { result } = renderHook(() => useDisplayBackground());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.presets).toHaveLength(1);
    expect(result.current.presets[0].id).toBe("preset:dark");
    expect(result.current.uploaded).toHaveLength(0);
    // listUploadedBackgrounds should NOT be called on mount when no active artifact
    expect(mockListUploadedBackgrounds).not.toHaveBeenCalled();
  });

  it("eagerly resolves active artifact background on mount", async () => {
    mockGetDisplayBackground.mockResolvedValue("artifact:img1");
    mockListUploadedBackgrounds.mockResolvedValue([UPLOADED_IMAGE]);
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "read_artifact_bytes")
        return Promise.resolve([0x89, 0x50, 0x4e, 0x47]);
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useDisplayBackground());

    await waitFor(() => {
      expect(result.current.activeId).toBe("artifact:img1");
    });

    // listUploadedBackgrounds IS called to find the active bg's type
    await waitFor(() => {
      expect(mockListUploadedBackgrounds).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(result.current.uploaded).toHaveLength(1);
    });

    // The uploaded entry should have a blob URL, not the raw artifact reference
    expect(result.current.uploaded[0].value).toMatch(/^blob:/);
  });

  it("uses convertFileSrc for video backgrounds instead of blob URL", async () => {
    mockGetDisplayBackground.mockResolvedValue("artifact:vid1");
    mockListUploadedBackgrounds.mockResolvedValue([UPLOADED_VIDEO]);
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_artifact_path")
        return Promise.resolve("/path/to/background.mp4");
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useDisplayBackground());

    await waitFor(() => {
      expect(result.current.uploaded).toHaveLength(1);
    });

    // Video should use convertFileSrc URL, not blob
    expect(result.current.uploaded[0].value).toContain("asset.localhost");
    expect(result.current.uploaded[0].value).toContain("background.mp4");
  });

  it("loadUploaded loads all uploaded backgrounds on demand", async () => {
    mockListUploadedBackgrounds.mockResolvedValue([UPLOADED_IMAGE]);
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "read_artifact_bytes")
        return Promise.resolve([0xff, 0xd8]);
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useDisplayBackground());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.uploaded).toHaveLength(0);

    // Call loadUploaded (simulates picker opening)
    act(() => {
      result.current.loadUploaded();
    });

    await waitFor(() => {
      expect(result.current.uploaded).toHaveLength(1);
    });
    expect(mockListUploadedBackgrounds).toHaveBeenCalled();
  });

  it("loadUploaded is idempotent — only loads once", async () => {
    mockListUploadedBackgrounds.mockResolvedValue([]);

    const { result } = renderHook(() => useDisplayBackground());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.loadUploaded();
      result.current.loadUploaded();
      result.current.loadUploaded();
    });

    await waitFor(() => {
      expect(mockListUploadedBackgrounds).toHaveBeenCalledTimes(1);
    });
  });

  it("applyToLive sets background and updates activeId", async () => {
    const { result } = renderHook(() => useDisplayBackground());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.applyToLive("preset:dark");
    });

    expect(mockSetDisplayBackground).toHaveBeenCalledWith("preset:dark");
    expect(result.current.activeId).toBe("preset:dark");
  });

  it("clearBackground resets activeId to null", async () => {
    mockGetDisplayBackground.mockResolvedValue("preset:dark");

    const { result } = renderHook(() => useDisplayBackground());
    await waitFor(() => expect(result.current.activeId).toBe("preset:dark"));

    await act(async () => {
      await result.current.clearBackground();
    });

    expect(mockSetDisplayBackground).toHaveBeenCalledWith(null);
    expect(result.current.activeId).toBeNull();
  });
});
