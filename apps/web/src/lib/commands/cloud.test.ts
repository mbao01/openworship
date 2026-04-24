import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));
vi.mock("@/lib/tauri", () => ({ invoke: mockInvoke }));

import {
  getCloudSyncInfo,
  toggleArtifactCloudSync,
  syncArtifactNow,
  downloadArtifactFromCloud,
  syncAllArtifacts,
  listCloudArtifacts,
  getArtifactAcl,
  setArtifactAcl,
  copyArtifactLink,
} from "./cloud";

describe("commands/cloud", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
  });

  it("getCloudSyncInfo passes artifactId", async () => {
    const syncInfo = { synced: true, last_sync_ms: 0, error: null };
    mockInvoke.mockResolvedValue(syncInfo);
    const result = await getCloudSyncInfo("art-1");
    expect(mockInvoke).toHaveBeenCalledWith("get_cloud_sync_info", { artifactId: "art-1" });
    expect(result).toEqual(syncInfo);
  });

  it("getCloudSyncInfo returns null when not synced", async () => {
    mockInvoke.mockResolvedValue(null);
    const result = await getCloudSyncInfo("art-2");
    expect(result).toBeNull();
  });

  it("toggleArtifactCloudSync passes artifactId and enabled", async () => {
    await toggleArtifactCloudSync("art-1", true);
    expect(mockInvoke).toHaveBeenCalledWith("toggle_artifact_cloud_sync", {
      artifactId: "art-1",
      enabled: true,
    });
  });

  it("toggleArtifactCloudSync can disable sync", async () => {
    await toggleArtifactCloudSync("art-1", false);
    expect(mockInvoke).toHaveBeenCalledWith("toggle_artifact_cloud_sync", {
      artifactId: "art-1",
      enabled: false,
    });
  });

  it("syncArtifactNow passes artifactId", async () => {
    await syncArtifactNow("art-1");
    expect(mockInvoke).toHaveBeenCalledWith("sync_artifact_now", { artifactId: "art-1" });
  });

  it("downloadArtifactFromCloud passes artifactId", async () => {
    const syncInfo = { synced: true, last_sync_ms: 0, error: null };
    mockInvoke.mockResolvedValue(syncInfo);
    const result = await downloadArtifactFromCloud("art-1");
    expect(mockInvoke).toHaveBeenCalledWith("download_artifact_from_cloud", {
      artifactId: "art-1",
    });
    expect(result).toEqual(syncInfo);
  });

  it("syncAllArtifacts invokes sync_all_artifacts", async () => {
    await syncAllArtifacts();
    expect(mockInvoke).toHaveBeenCalledWith("sync_all_artifacts");
  });

  it("listCloudArtifacts invokes list_cloud_artifacts", async () => {
    mockInvoke.mockResolvedValue([]);
    const result = await listCloudArtifacts();
    expect(mockInvoke).toHaveBeenCalledWith("list_cloud_artifacts");
    expect(result).toEqual([]);
  });

  it("getArtifactAcl passes artifactId", async () => {
    mockInvoke.mockResolvedValue([]);
    const result = await getArtifactAcl("art-1");
    expect(mockInvoke).toHaveBeenCalledWith("get_artifact_acl", { artifactId: "art-1" });
    expect(result).toEqual([]);
  });

  it("setArtifactAcl passes artifactId, acl, accessLevel", async () => {
    const acl = [{ branch_id: "b1", branch_name: "Branch A", permission: "view" as const }];
    await setArtifactAcl("art-1", acl, "branch_only");
    expect(mockInvoke).toHaveBeenCalledWith("set_artifact_acl", {
      artifactId: "art-1",
      acl,
      accessLevel: "branch_only",
    });
  });

  it("copyArtifactLink returns URL string", async () => {
    mockInvoke.mockResolvedValue("https://s3.example.com/art-1");
    const result = await copyArtifactLink("art-1");
    expect(mockInvoke).toHaveBeenCalledWith("copy_artifact_link", { artifactId: "art-1" });
    expect(result).toBe("https://s3.example.com/art-1");
  });
});
