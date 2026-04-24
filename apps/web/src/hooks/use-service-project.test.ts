import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const {
  mockGetActiveProject,
  mockOpenServiceProject,
  mockCloseActiveProject,
  mockAddItemToActiveProject,
  mockRemoveItemFromActiveProject,
  mockReorderActiveProjectItems,
} = vi.hoisted(() => ({
  mockGetActiveProject: vi.fn(),
  mockOpenServiceProject: vi.fn(),
  mockCloseActiveProject: vi.fn(),
  mockAddItemToActiveProject: vi.fn(),
  mockRemoveItemFromActiveProject: vi.fn(),
  mockReorderActiveProjectItems: vi.fn(),
}));

vi.mock("@/lib/commands/projects", () => ({
  getActiveProject: mockGetActiveProject,
  openServiceProject: mockOpenServiceProject,
  closeActiveProject: mockCloseActiveProject,
  addItemToActiveProject: mockAddItemToActiveProject,
  removeItemFromActiveProject: mockRemoveItemFromActiveProject,
  reorderActiveProjectItems: mockReorderActiveProjectItems,
}));

import { useServiceProject } from "./use-service-project";

const mockProject = {
  id: "proj-1",
  name: "Sunday Service",
  created_at_ms: 0,
  closed_at_ms: null,
  scheduled_at_ms: null,
  description: null,
  items: [],
  tasks: [],
};

describe("useServiceProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveProject.mockResolvedValue(mockProject);
    mockOpenServiceProject.mockResolvedValue(undefined);
    mockCloseActiveProject.mockResolvedValue(undefined);
    mockAddItemToActiveProject.mockResolvedValue(undefined);
    mockRemoveItemFromActiveProject.mockResolvedValue(undefined);
    mockReorderActiveProjectItems.mockResolvedValue(undefined);
  });

  it("starts loading and then loads the active project", async () => {
    const { result } = renderHook(() => useServiceProject());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.project).toEqual(mockProject);
    expect(mockGetActiveProject).toHaveBeenCalled();
  });

  it("returns null when no project is active", async () => {
    mockGetActiveProject.mockResolvedValue(null);
    const { result } = renderHook(() => useServiceProject());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.project).toBeNull();
  });

  it("open loads the project after opening", async () => {
    const { result } = renderHook(() => useServiceProject());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.open("proj-2");
    });

    expect(mockOpenServiceProject).toHaveBeenCalledWith("proj-2");
    expect(mockGetActiveProject).toHaveBeenCalledTimes(2);
  });

  it("close clears project and calls closeActiveProject", async () => {
    const { result } = renderHook(() => useServiceProject());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.close();
    });

    expect(mockCloseActiveProject).toHaveBeenCalled();
    expect(result.current.project).toBeNull();
  });

  it("addItem calls addItemToActiveProject and refreshes", async () => {
    const { result } = renderHook(() => useServiceProject());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const item = {
      reference: "John 3:16",
      text: "For God so loved...",
      translation: "KJV",
      item_type: "scripture",
      duration_secs: null,
      notes: null,
      asset_ids: [],
    };

    await act(async () => {
      await result.current.addItem(item);
    });

    expect(mockAddItemToActiveProject).toHaveBeenCalledWith(
      "John 3:16",
      "For God so loved...",
      "KJV",
    );
  });

  it("removeItem calls removeItemFromActiveProject and refreshes", async () => {
    const { result } = renderHook(() => useServiceProject());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.removeItem("item-123");
    });

    expect(mockRemoveItemFromActiveProject).toHaveBeenCalledWith("item-123");
  });

  it("reorder calls reorderActiveProjectItems", async () => {
    const { result } = renderHook(() => useServiceProject());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.reorder(["item-2", "item-1"]);
    });

    expect(mockReorderActiveProjectItems).toHaveBeenCalledWith(["item-2", "item-1"]);
  });

  it("handles getActiveProject failure gracefully", async () => {
    mockGetActiveProject.mockRejectedValue(new Error("IPC error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useServiceProject());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.project).toBeNull();
    consoleSpy.mockRestore();
  });
});
