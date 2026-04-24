import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));
vi.mock("@/lib/tauri", () => ({ invoke: mockInvoke }));

import {
  setDisplayBackground,
  getDisplayBackground,
  listPresetBackgrounds,
  listUploadedBackgrounds,
  uploadBackground,
} from "./display";

describe("commands/display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
  });

  it("setDisplayBackground passes backgroundId", async () => {
    await setDisplayBackground("bg-123");
    expect(mockInvoke).toHaveBeenCalledWith("set_display_background", {
      backgroundId: "bg-123",
    });
  });

  it("setDisplayBackground passes null when id is null", async () => {
    await setDisplayBackground(null);
    expect(mockInvoke).toHaveBeenCalledWith("set_display_background", {
      backgroundId: null,
    });
  });

  it("getDisplayBackground invokes get_display_background", async () => {
    mockInvoke.mockResolvedValue("bg-456");
    const result = await getDisplayBackground();
    expect(mockInvoke).toHaveBeenCalledWith("get_display_background");
    expect(result).toBe("bg-456");
  });

  it("listPresetBackgrounds invokes list_preset_backgrounds", async () => {
    mockInvoke.mockResolvedValue([]);
    const result = await listPresetBackgrounds();
    expect(mockInvoke).toHaveBeenCalledWith("list_preset_backgrounds");
    expect(result).toEqual([]);
  });

  it("listUploadedBackgrounds invokes list_uploaded_backgrounds", async () => {
    mockInvoke.mockResolvedValue([]);
    const result = await listUploadedBackgrounds();
    expect(mockInvoke).toHaveBeenCalledWith("list_uploaded_backgrounds");
    expect(result).toEqual([]);
  });

  it("uploadBackground passes name and bytes", async () => {
    const bg = { id: "1", name: "sky", source: "uploaded", value: "", bg_type: "image" };
    mockInvoke.mockResolvedValue(bg);
    const result = await uploadBackground("sky", [1, 2, 3]);
    expect(mockInvoke).toHaveBeenCalledWith("upload_background", {
      name: "sky",
      bytes: [1, 2, 3],
    });
    expect(result).toEqual(bg);
  });
});
