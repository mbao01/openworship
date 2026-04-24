import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));
vi.mock("@/lib/tauri", () => ({ invoke: mockInvoke }));

import { createBackup, restoreBackup } from "./backup";

describe("commands/backup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
  });

  describe("createBackup", () => {
    it("invokes create_backup with destPath", async () => {
      const backupInfo = {
        path: "/home/user/backup.openworship-backup",
        size_bytes: 1024 * 1024,
        created_at_ms: 1700000000000,
      };
      mockInvoke.mockResolvedValue(backupInfo);

      const result = await createBackup("/home/user/backup.openworship-backup");

      expect(mockInvoke).toHaveBeenCalledWith("create_backup", {
        destPath: "/home/user/backup.openworship-backup",
      });
      expect(result).toEqual(backupInfo);
    });

    it("propagates errors from the backend", async () => {
      mockInvoke.mockRejectedValue(new Error("disk full"));
      await expect(createBackup("/tmp/fail.openworship-backup")).rejects.toThrow("disk full");
    });
  });

  describe("restoreBackup", () => {
    it("invokes restore_backup with srcPath", async () => {
      await restoreBackup("/home/user/backup.openworship-backup");
      expect(mockInvoke).toHaveBeenCalledWith("restore_backup", {
        srcPath: "/home/user/backup.openworship-backup",
      });
    });

    it("propagates errors from the backend", async () => {
      mockInvoke.mockRejectedValue(new Error("invalid archive"));
      await expect(restoreBackup("/tmp/bad.openworship-backup")).rejects.toThrow("invalid archive");
    });
  });
});
