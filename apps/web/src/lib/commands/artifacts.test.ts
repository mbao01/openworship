import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));
vi.mock("@/lib/tauri", () => ({ invoke: mockInvoke }));

import {
  listArtifacts,
  listRecentArtifacts,
  listStarredArtifacts,
  searchArtifacts,
  createArtifactDir,
  importArtifactFile,
  writeArtifactBytes,
  readTextFile,
  renameArtifact,
  deleteArtifact,
  moveArtifact,
  starArtifact,
  openArtifact,
  thumbnailUrl,
  regenerateThumbnails,
  getStorageUsage,
} from "./artifacts";

const mockArtifact = {
  id: "art-1",
  name: "photo.jpg",
  path: "/service-1/photo.jpg",
  parent_path: "/service-1",
  service_id: "service-1",
  mime_type: "image/jpeg",
  size_bytes: 12345,
  starred: false,
  thumbnail_path: null,
  created_at_ms: 0,
  modified_at_ms: 0,
  is_dir: false,
};

describe("commands/artifacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
  });

  describe("listing", () => {
    it("listArtifacts passes serviceId and parentPath", async () => {
      mockInvoke.mockResolvedValue([mockArtifact]);
      const result = await listArtifacts("service-1", "/service-1");
      expect(mockInvoke).toHaveBeenCalledWith("list_artifacts", {
        serviceId: "service-1",
        parentPath: "/service-1",
      });
      expect(result).toEqual([mockArtifact]);
    });

    it("listArtifacts works with no arguments", async () => {
      mockInvoke.mockResolvedValue([]);
      await listArtifacts();
      expect(mockInvoke).toHaveBeenCalledWith("list_artifacts", {
        serviceId: undefined,
        parentPath: undefined,
      });
    });

    it("listRecentArtifacts passes limit", async () => {
      mockInvoke.mockResolvedValue([mockArtifact]);
      const result = await listRecentArtifacts(10);
      expect(mockInvoke).toHaveBeenCalledWith("list_recent_artifacts", { limit: 10 });
      expect(result).toEqual([mockArtifact]);
    });

    it("listRecentArtifacts works without limit", async () => {
      mockInvoke.mockResolvedValue([]);
      await listRecentArtifacts();
      expect(mockInvoke).toHaveBeenCalledWith("list_recent_artifacts", { limit: undefined });
    });

    it("listStarredArtifacts invokes list_starred_artifacts", async () => {
      mockInvoke.mockResolvedValue([]);
      const result = await listStarredArtifacts();
      expect(mockInvoke).toHaveBeenCalledWith("list_starred_artifacts");
      expect(result).toEqual([]);
    });

    it("searchArtifacts passes query, serviceId, category", async () => {
      mockInvoke.mockResolvedValue([mockArtifact]);
      const result = await searchArtifacts("photo", "service-1", "image");
      expect(mockInvoke).toHaveBeenCalledWith("search_artifacts", {
        query: "photo",
        serviceId: "service-1",
        category: "image",
      });
      expect(result).toEqual([mockArtifact]);
    });
  });

  describe("creation and import", () => {
    it("createArtifactDir passes serviceId, parentPath, name", async () => {
      mockInvoke.mockResolvedValue({ ...mockArtifact, is_dir: true });
      const result = await createArtifactDir("service-1", "/service-1", "photos");
      expect(mockInvoke).toHaveBeenCalledWith("create_artifact_dir", {
        serviceId: "service-1",
        parentPath: "/service-1",
        name: "photos",
      });
      expect(result.is_dir).toBe(true);
    });

    it("importArtifactFile passes sourcePath, serviceId, parentPath", async () => {
      mockInvoke.mockResolvedValue(mockArtifact);
      const result = await importArtifactFile("/tmp/photo.jpg", "service-1", "/service-1");
      expect(mockInvoke).toHaveBeenCalledWith("import_artifact_file", {
        sourcePath: "/tmp/photo.jpg",
        serviceId: "service-1",
        parentPath: "/service-1",
      });
      expect(result).toEqual(mockArtifact);
    });

    it("importArtifactFile works with null serviceId and parentPath", async () => {
      mockInvoke.mockResolvedValue(mockArtifact);
      await importArtifactFile("/tmp/photo.jpg", null, null);
      expect(mockInvoke).toHaveBeenCalledWith("import_artifact_file", {
        sourcePath: "/tmp/photo.jpg",
        serviceId: null,
        parentPath: null,
      });
    });

    it("writeArtifactBytes passes id and bytes", async () => {
      await writeArtifactBytes("art-1", [1, 2, 3, 4]);
      expect(mockInvoke).toHaveBeenCalledWith("write_artifact_bytes", {
        id: "art-1",
        bytes: [1, 2, 3, 4],
      });
    });

    it("readTextFile passes filePath", async () => {
      mockInvoke.mockResolvedValue("file contents");
      const result = await readTextFile("/path/to/file.txt");
      expect(mockInvoke).toHaveBeenCalledWith("read_text_file", {
        filePath: "/path/to/file.txt",
      });
      expect(result).toBe("file contents");
    });
  });

  describe("modification", () => {
    it("renameArtifact passes id and newName", async () => {
      await renameArtifact("art-1", "new-name.jpg");
      expect(mockInvoke).toHaveBeenCalledWith("rename_artifact", {
        id: "art-1",
        newName: "new-name.jpg",
      });
    });

    it("deleteArtifact passes id", async () => {
      await deleteArtifact("art-1");
      expect(mockInvoke).toHaveBeenCalledWith("delete_artifact", { id: "art-1" });
    });

    it("moveArtifact passes id and newParentPath", async () => {
      await moveArtifact("art-1", "/service-2");
      expect(mockInvoke).toHaveBeenCalledWith("move_artifact", {
        id: "art-1",
        newParentPath: "/service-2",
      });
    });

    it("starArtifact passes id and starred=true", async () => {
      await starArtifact("art-1", true);
      expect(mockInvoke).toHaveBeenCalledWith("star_artifact", {
        id: "art-1",
        starred: true,
      });
    });

    it("starArtifact can unstar an artifact", async () => {
      await starArtifact("art-1", false);
      expect(mockInvoke).toHaveBeenCalledWith("star_artifact", {
        id: "art-1",
        starred: false,
      });
    });

    it("openArtifact passes id", async () => {
      await openArtifact("art-1");
      expect(mockInvoke).toHaveBeenCalledWith("open_artifact", { id: "art-1" });
    });
  });

  describe("thumbnails and storage", () => {
    it("thumbnailUrl returns owmedia:// URL", () => {
      const url = thumbnailUrl("art-1");
      expect(url).toBe("owmedia://localhost/thumbnail/art-1");
    });

    it("regenerateThumbnails returns queued count", async () => {
      mockInvoke.mockResolvedValue(42);
      const result = await regenerateThumbnails();
      expect(mockInvoke).toHaveBeenCalledWith("regenerate_thumbnails");
      expect(result).toBe(42);
    });

    it("getStorageUsage invokes get_storage_usage", async () => {
      const usage = {
        used_bytes: 1000,
        quota_bytes: null,
        synced_count: 5,
        last_updated_ms: 0,
      };
      mockInvoke.mockResolvedValue(usage);
      const result = await getStorageUsage();
      expect(mockInvoke).toHaveBeenCalledWith("get_storage_usage");
      expect(result).toEqual(usage);
    });
  });
});
