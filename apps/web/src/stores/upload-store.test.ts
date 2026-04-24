import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// URL.revokeObjectURL is not implemented in jsdom — mock it
beforeEach(() => {
  if (!globalThis.URL.revokeObjectURL) {
    globalThis.URL.revokeObjectURL = vi.fn();
  } else {
    vi.spyOn(globalThis.URL, "revokeObjectURL").mockImplementation(() => {});
  }
});

// We need to reset module-level state between tests. Import the functions
// after each reset to get a fresh module.
import {
  addUpload,
  updateUpload,
  removeUpload,
  clearCompleted,
  getUploads,
  useUploads,
  type UploadEntry,
} from "./upload-store";

function makeEntry(overrides: Partial<UploadEntry> & { id: string }): UploadEntry {
  return {
    name: "test.mp4",
    previewUrl: `blob:mock-${overrides.id}`,
    size: 1024,
    status: "uploading",
    ...overrides,
  };
}

// Reset upload store state between tests by removing all entries
function clearAll() {
  const current = getUploads();
  for (const entry of current) {
    removeUpload(entry.id);
  }
}

describe("upload-store", () => {
  beforeEach(() => {
    clearAll();
    vi.clearAllMocks();
  });

  it("starts empty", () => {
    expect(getUploads()).toHaveLength(0);
  });

  it("addUpload adds an entry", () => {
    addUpload(makeEntry({ id: "u1" }));
    const uploads = getUploads();
    expect(uploads).toHaveLength(1);
    expect(uploads[0].id).toBe("u1");
    expect(uploads[0].status).toBe("uploading");
  });

  it("addUpload multiple entries in order", () => {
    addUpload(makeEntry({ id: "u1" }));
    addUpload(makeEntry({ id: "u2" }));
    addUpload(makeEntry({ id: "u3" }));
    const uploads = getUploads();
    expect(uploads).toHaveLength(3);
    expect(uploads.map((u) => u.id)).toEqual(["u1", "u2", "u3"]);
  });

  it("updateUpload patches an existing entry", () => {
    addUpload(makeEntry({ id: "u1" }));
    updateUpload("u1", { status: "done", realEntry: undefined });
    const uploads = getUploads();
    expect(uploads[0].status).toBe("done");
    expect(uploads[0].name).toBe("test.mp4"); // unchanged fields preserved
  });

  it("updateUpload is a no-op for unknown id", () => {
    addUpload(makeEntry({ id: "u1" }));
    updateUpload("nonexistent", { status: "error" });
    expect(getUploads()[0].status).toBe("uploading"); // unchanged
  });

  it("removeUpload removes the entry", () => {
    addUpload(makeEntry({ id: "u1" }));
    addUpload(makeEntry({ id: "u2" }));
    removeUpload("u1");
    const uploads = getUploads();
    expect(uploads).toHaveLength(1);
    expect(uploads[0].id).toBe("u2");
  });

  it("removeUpload calls URL.revokeObjectURL for the entry's previewUrl", () => {
    addUpload(makeEntry({ id: "u1", previewUrl: "blob:mock-u1" }));
    removeUpload("u1");
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-u1");
  });

  it("clearCompleted removes only done entries", () => {
    addUpload(makeEntry({ id: "u1", status: "uploading" }));
    addUpload(makeEntry({ id: "u2", status: "done" }));
    addUpload(makeEntry({ id: "u3", status: "error" }));
    clearCompleted();
    const uploads = getUploads();
    expect(uploads).toHaveLength(2);
    expect(uploads.map((u) => u.id)).toEqual(["u1", "u3"]);
  });

  it("clearCompleted calls revokeObjectURL for done entries", () => {
    addUpload(makeEntry({ id: "u1", status: "done", previewUrl: "blob:done-u1" }));
    addUpload(makeEntry({ id: "u2", status: "uploading" }));
    clearCompleted();
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith("blob:done-u1");
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });
});

describe("useUploads hook", () => {
  beforeEach(() => {
    clearAll();
    vi.clearAllMocks();
  });

  it("returns current snapshot", async () => {
    addUpload(makeEntry({ id: "h1" }));
    const { result } = renderHook(() => useUploads());
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe("h1");
  });

  it("updates when entries change", async () => {
    const { result } = renderHook(() => useUploads());
    expect(result.current).toHaveLength(0);

    act(() => {
      addUpload(makeEntry({ id: "h2" }));
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe("h2");
  });

  it("updates when entry is removed", async () => {
    addUpload(makeEntry({ id: "h3" }));
    const { result } = renderHook(() => useUploads());
    expect(result.current).toHaveLength(1);

    act(() => {
      removeUpload("h3");
    });

    expect(result.current).toHaveLength(0);
  });

  it("updates when entry status changes", async () => {
    addUpload(makeEntry({ id: "h4", status: "uploading" }));
    const { result } = renderHook(() => useUploads());
    expect(result.current[0].status).toBe("uploading");

    act(() => {
      updateUpload("h4", { status: "done" });
    });

    expect(result.current[0].status).toBe("done");
  });
});
