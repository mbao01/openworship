import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

let listenCallback: ((event: { payload: unknown }) => void) | null = null;
const mockUnlisten = vi.fn();

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((_event: string, cb: (event: { payload: unknown }) => void) => {
    listenCallback = cb;
    return Promise.resolve(mockUnlisten);
  }),
}));

import {
  checkForUpdates,
  installUpdate,
  restartApp,
  onUpdateAvailable,
  onDownloadProgress,
  onInstallComplete,
} from "./updater";

describe("commands/updater", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listenCallback = null;
    mockInvoke.mockResolvedValue(undefined);
  });

  describe("checkForUpdates", () => {
    it("invokes check_for_updates and returns null when up to date", async () => {
      mockInvoke.mockResolvedValue(null);
      const result = await checkForUpdates();
      expect(mockInvoke).toHaveBeenCalledWith("check_for_updates");
      expect(result).toBeNull();
    });

    it("returns UpdateInfo when an update is available", async () => {
      const updateInfo = { version: "1.2.3", date: "2025-01-01", body: "Bug fixes" };
      mockInvoke.mockResolvedValue(updateInfo);
      const result = await checkForUpdates();
      expect(result).toEqual(updateInfo);
    });
  });

  describe("installUpdate", () => {
    it("invokes install_update", async () => {
      await installUpdate();
      expect(mockInvoke).toHaveBeenCalledWith("install_update");
    });
  });

  describe("restartApp", () => {
    it("invokes restart_app (fire-and-forget)", () => {
      restartApp();
      expect(mockInvoke).toHaveBeenCalledWith("restart_app");
    });

    it("handles invoke failure silently", async () => {
      mockInvoke.mockRejectedValue(new Error("restart failed"));
      // Should not throw
      expect(() => restartApp()).not.toThrow();
    });
  });

  describe("onUpdateAvailable", () => {
    it("registers listener for updater://update-available and calls cb with payload", async () => {
      const cb = vi.fn();
      const unlisten = await onUpdateAvailable(cb);

      const updateInfo = { version: "1.2.3" };
      listenCallback!({ payload: updateInfo });

      expect(cb).toHaveBeenCalledWith(updateInfo);
      expect(typeof unlisten).toBe("function");
    });
  });

  describe("onDownloadProgress", () => {
    it("registers listener for updater://download-progress and calls cb with progress", async () => {
      const cb = vi.fn();
      await onDownloadProgress(cb);

      const progressPayload = { downloaded: 512, total: 1024 };
      listenCallback!({ payload: progressPayload });

      expect(cb).toHaveBeenCalledWith(progressPayload);
    });
  });

  describe("onInstallComplete", () => {
    it("registers listener for updater://install-complete and calls cb", async () => {
      const cb = vi.fn();
      await onInstallComplete(cb);

      listenCallback!({ payload: null });

      expect(cb).toHaveBeenCalledTimes(1);
    });
  });
});
