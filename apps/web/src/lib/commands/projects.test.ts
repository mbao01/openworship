import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));
vi.mock("@/lib/tauri", () => ({ invoke: mockInvoke }));

import {
  deleteServiceProject,
  updateServiceProject,
  createServiceProject,
  listServiceProjects,
  getActiveProject,
  openServiceProject,
  closeActiveProject,
  addItemToActiveProject,
  removeItemFromActiveProject,
  reorderActiveProjectItems,
  createServiceTask,
  updateServiceTask,
  deleteServiceTask,
} from "./projects";

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

describe("commands/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
  });

  it("createServiceProject passes name", async () => {
    mockInvoke.mockResolvedValue(mockProject);
    const result = await createServiceProject("Sunday Service");
    expect(mockInvoke).toHaveBeenCalledWith("create_service_project", {
      name: "Sunday Service",
    });
    expect(result).toEqual(mockProject);
  });

  it("listServiceProjects invokes list_service_projects", async () => {
    mockInvoke.mockResolvedValue([mockProject]);
    const result = await listServiceProjects();
    expect(mockInvoke).toHaveBeenCalledWith("list_service_projects");
    expect(result).toEqual([mockProject]);
  });

  it("getActiveProject returns active project", async () => {
    mockInvoke.mockResolvedValue(mockProject);
    const result = await getActiveProject();
    expect(mockInvoke).toHaveBeenCalledWith("get_active_project");
    expect(result).toEqual(mockProject);
  });

  it("getActiveProject returns null when none active", async () => {
    mockInvoke.mockResolvedValue(null);
    const result = await getActiveProject();
    expect(result).toBeNull();
  });

  it("openServiceProject passes projectId", async () => {
    await openServiceProject("proj-1");
    expect(mockInvoke).toHaveBeenCalledWith("open_service_project", {
      projectId: "proj-1",
    });
  });

  it("closeActiveProject invokes close_active_project", async () => {
    await closeActiveProject();
    expect(mockInvoke).toHaveBeenCalledWith("close_active_project");
  });

  it("deleteServiceProject passes projectId", async () => {
    await deleteServiceProject("proj-1");
    expect(mockInvoke).toHaveBeenCalledWith("delete_service_project", {
      projectId: "proj-1",
    });
  });

  it("updateServiceProject passes projectId and updates", async () => {
    mockInvoke.mockResolvedValue(mockProject);
    const result = await updateServiceProject("proj-1", { name: "Updated Service" });
    expect(mockInvoke).toHaveBeenCalledWith("update_service_project", {
      projectId: "proj-1",
      name: "Updated Service",
      description: undefined,
      scheduledAtMs: undefined,
    });
    expect(result).toEqual(mockProject);
  });

  it("addItemToActiveProject passes reference, text, translation", async () => {
    await addItemToActiveProject("John 3:16", "For God so loved...", "KJV");
    expect(mockInvoke).toHaveBeenCalledWith("add_item_to_active_project", {
      reference: "John 3:16",
      text: "For God so loved...",
      translation: "KJV",
    });
  });

  it("removeItemFromActiveProject passes itemId", async () => {
    await removeItemFromActiveProject("item-123");
    expect(mockInvoke).toHaveBeenCalledWith("remove_item_from_active_project", {
      itemId: "item-123",
    });
  });

  it("reorderActiveProjectItems passes itemIds", async () => {
    await reorderActiveProjectItems(["item-2", "item-1", "item-3"]);
    expect(mockInvoke).toHaveBeenCalledWith("reorder_active_project_items", {
      itemIds: ["item-2", "item-1", "item-3"],
    });
  });

  it("createServiceTask passes serviceId, title, description", async () => {
    mockInvoke.mockResolvedValue(mockProject);
    const result = await createServiceTask("proj-1", "Prepare slides", "Get slides ready");
    expect(mockInvoke).toHaveBeenCalledWith("create_service_task", {
      serviceId: "proj-1",
      title: "Prepare slides",
      description: "Get slides ready",
    });
    expect(result).toEqual(mockProject);
  });

  it("updateServiceTask passes taskId and updates", async () => {
    mockInvoke.mockResolvedValue(mockProject);
    await updateServiceTask("task-1", { title: "Updated title", status: "done" });
    expect(mockInvoke).toHaveBeenCalledWith("update_service_task", {
      taskId: "task-1",
      title: "Updated title",
      status: "done",
      description: undefined,
    });
  });

  it("deleteServiceTask passes taskId", async () => {
    mockInvoke.mockResolvedValue(mockProject);
    await deleteServiceTask("task-1");
    expect(mockInvoke).toHaveBeenCalledWith("delete_service_task", {
      taskId: "task-1",
    });
  });
});
