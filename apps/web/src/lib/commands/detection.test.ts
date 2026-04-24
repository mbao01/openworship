import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));
vi.mock("@/lib/tauri", () => ({ invoke: mockInvoke }));

import {
  getDetectionMode,
  setDetectionMode,
  getQueue,
  approveItem,
  dismissItem,
  skipItem,
  rejectLiveItem,
  nextItem,
  prevItem,
  clearLive,
  clearQueue,
  toggleBlackout,
  getBlackout,
  detectInTranscript,
  getSemanticStatus,
} from "./detection";

describe("commands/detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
  });

  it("getDetectionMode invokes get_detection_mode", async () => {
    mockInvoke.mockResolvedValue("copilot");
    const result = await getDetectionMode();
    expect(mockInvoke).toHaveBeenCalledWith("get_detection_mode");
    expect(result).toBe("copilot");
  });

  it("setDetectionMode passes mode", async () => {
    await setDetectionMode("auto");
    expect(mockInvoke).toHaveBeenCalledWith("set_detection_mode", { mode: "auto" });
  });

  it("setDetectionMode works for all modes", async () => {
    for (const mode of ["auto", "copilot", "airplane", "offline"] as const) {
      await setDetectionMode(mode);
      expect(mockInvoke).toHaveBeenCalledWith("set_detection_mode", { mode });
    }
  });

  it("getQueue invokes get_queue", async () => {
    mockInvoke.mockResolvedValue([]);
    const result = await getQueue();
    expect(mockInvoke).toHaveBeenCalledWith("get_queue");
    expect(result).toEqual([]);
  });

  it("approveItem passes itemId as id", async () => {
    await approveItem("item-123");
    expect(mockInvoke).toHaveBeenCalledWith("approve_item", { id: "item-123" });
  });

  it("dismissItem passes id", async () => {
    await dismissItem("item-456");
    expect(mockInvoke).toHaveBeenCalledWith("dismiss_item", { id: "item-456" });
  });

  it("skipItem passes itemId", async () => {
    await skipItem("item-789");
    expect(mockInvoke).toHaveBeenCalledWith("skip_item", { itemId: "item-789" });
  });

  it("rejectLiveItem invokes reject_live_item", async () => {
    await rejectLiveItem();
    expect(mockInvoke).toHaveBeenCalledWith("reject_live_item");
  });

  it("nextItem invokes next_item", async () => {
    await nextItem();
    expect(mockInvoke).toHaveBeenCalledWith("next_item");
  });

  it("prevItem invokes prev_item", async () => {
    await prevItem();
    expect(mockInvoke).toHaveBeenCalledWith("prev_item");
  });

  it("clearLive invokes clear_live", async () => {
    await clearLive();
    expect(mockInvoke).toHaveBeenCalledWith("clear_live");
  });

  it("clearQueue invokes clear_queue", async () => {
    await clearQueue();
    expect(mockInvoke).toHaveBeenCalledWith("clear_queue");
  });

  it("toggleBlackout returns new blackout state", async () => {
    mockInvoke.mockResolvedValue(true);
    const result = await toggleBlackout();
    expect(mockInvoke).toHaveBeenCalledWith("toggle_blackout");
    expect(result).toBe(true);
  });

  it("getBlackout returns current blackout state", async () => {
    mockInvoke.mockResolvedValue(false);
    const result = await getBlackout();
    expect(mockInvoke).toHaveBeenCalledWith("get_blackout");
    expect(result).toBe(false);
  });

  it("detectInTranscript passes text", async () => {
    mockInvoke.mockResolvedValue([]);
    const result = await detectInTranscript("For God so loved the world");
    expect(mockInvoke).toHaveBeenCalledWith("detect_in_transcript", {
      text: "For God so loved the world",
    });
    expect(result).toEqual([]);
  });

  it("getSemanticStatus invokes get_semantic_status", async () => {
    const status = { ready: true, verse_count: 31102, enabled: true };
    mockInvoke.mockResolvedValue(status);
    const result = await getSemanticStatus();
    expect(mockInvoke).toHaveBeenCalledWith("get_semantic_status");
    expect(result).toEqual(status);
  });
});
