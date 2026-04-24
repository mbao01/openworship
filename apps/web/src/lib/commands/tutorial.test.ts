import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));
vi.mock("@/lib/tauri", () => ({ invoke: mockInvoke }));

// We control TAURI_INTERNALS so we can test both Tauri and browser paths.
function setTauriMode(enabled: boolean) {
  if (enabled) {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      value: {},
      configurable: true,
    });
  } else {
    // Remove the property
    try {
      delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    } catch {
      Object.defineProperty(window, "__TAURI_INTERNALS__", {
        value: undefined,
        configurable: true,
      });
    }
  }
}

import { getTutorialState, setTutorialState, seedDemoData } from "./tutorial";

describe("commands/tutorial — Tauri mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setTauriMode(true);
    mockInvoke.mockResolvedValue(undefined);
  });

  afterEach(() => {
    setTauriMode(false);
  });

  describe("getTutorialState", () => {
    it("invokes get_tutorial_state and returns the state", async () => {
      mockInvoke.mockResolvedValue("in_progress_step_2");
      const result = await getTutorialState();
      expect(mockInvoke).toHaveBeenCalledWith("get_tutorial_state");
      expect(result).toBe("in_progress_step_2");
    });

    it("returns not_started when invoke throws", async () => {
      mockInvoke.mockRejectedValue(new Error("backend error"));
      const result = await getTutorialState();
      expect(result).toBe("not_started");
    });
  });

  describe("setTutorialState", () => {
    it("invokes set_tutorial_state with the state", async () => {
      await setTutorialState("completed");
      expect(mockInvoke).toHaveBeenCalledWith("set_tutorial_state", { state: "completed" });
    });

    it("does not throw when invoke fails (best-effort)", async () => {
      mockInvoke.mockRejectedValue(new Error("write error"));
      await expect(setTutorialState("dismissed")).resolves.toBeUndefined();
    });
  });

  describe("seedDemoData", () => {
    it("invokes seed_demo_data and returns the result", async () => {
      const seedResult = { songs_seeded: 5, project_seeded: true };
      mockInvoke.mockResolvedValue(seedResult);
      const result = await seedDemoData();
      expect(mockInvoke).toHaveBeenCalledWith("seed_demo_data");
      expect(result).toEqual(seedResult);
    });

    it("returns empty seed result when invoke throws", async () => {
      mockInvoke.mockRejectedValue(new Error("seed failed"));
      const result = await seedDemoData();
      expect(result).toEqual({ songs_seeded: 0, project_seeded: false });
    });
  });
});

describe("commands/tutorial — browser (non-Tauri) mode", () => {
  const LS_KEY = "ow_tutorial_state";

  beforeEach(() => {
    vi.clearAllMocks();
    setTauriMode(false);
    localStorage.clear();
  });

  describe("getTutorialState", () => {
    it("reads from localStorage and returns the stored value", async () => {
      localStorage.setItem(LS_KEY, "in_progress_step_3");
      const result = await getTutorialState();
      expect(result).toBe("in_progress_step_3");
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("returns not_started when localStorage is empty", async () => {
      const result = await getTutorialState();
      expect(result).toBe("not_started");
    });
  });

  describe("setTutorialState", () => {
    it("writes to localStorage without invoking Tauri", async () => {
      await setTutorialState("dismissed");
      expect(localStorage.getItem(LS_KEY)).toBe("dismissed");
      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  describe("seedDemoData", () => {
    it("returns empty result without invoking Tauri", async () => {
      const result = await seedDemoData();
      expect(result).toEqual({ songs_seeded: 0, project_seeded: false });
      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });
});
