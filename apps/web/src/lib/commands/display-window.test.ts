import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));
vi.mock("@/lib/tauri", () => ({ invoke: mockInvoke }));

import {
  listMonitors,
  openDisplayWindow,
  closeDisplayWindow,
  getDisplayWindowOpen,
  getObsDisplayUrl,
} from "./display-window";

describe("commands/display-window", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
  });

  it("listMonitors invokes list_monitors", async () => {
    const monitors = [{ index: 0, name: "Built-in Display", width: 1920, height: 1080 }];
    mockInvoke.mockResolvedValue(monitors);
    const result = await listMonitors();
    expect(mockInvoke).toHaveBeenCalledWith("list_monitors");
    expect(result).toEqual(monitors);
  });

  it("openDisplayWindow passes monitorIndex", async () => {
    await openDisplayWindow(1);
    expect(mockInvoke).toHaveBeenCalledWith("open_display_window", {
      monitor_index: 1,
    });
  });

  it("openDisplayWindow passes null monitorIndex", async () => {
    await openDisplayWindow(null);
    expect(mockInvoke).toHaveBeenCalledWith("open_display_window", {
      monitor_index: null,
    });
  });

  it("closeDisplayWindow invokes close_display_window", async () => {
    await closeDisplayWindow();
    expect(mockInvoke).toHaveBeenCalledWith("close_display_window");
  });

  it("getDisplayWindowOpen returns true when open", async () => {
    mockInvoke.mockResolvedValue(true);
    const result = await getDisplayWindowOpen();
    expect(mockInvoke).toHaveBeenCalledWith("get_display_window_open");
    expect(result).toBe(true);
  });

  it("getDisplayWindowOpen returns false when closed", async () => {
    mockInvoke.mockResolvedValue(false);
    const result = await getDisplayWindowOpen();
    expect(result).toBe(false);
  });

  it("getObsDisplayUrl returns URL string", async () => {
    mockInvoke.mockResolvedValue("http://localhost:4000/display");
    const result = await getObsDisplayUrl();
    expect(mockInvoke).toHaveBeenCalledWith("get_obs_display_url");
    expect(result).toBe("http://localhost:4000/display");
  });
});
