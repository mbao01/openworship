import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ServiceProject } from "../lib/types";

const mockInvoke = vi.fn();
vi.mock("../lib/tauri", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("../lib/toast", () => ({
  toastError: vi.fn(() => vi.fn()),
}));

vi.mock("../hooks/use-debounce", () => ({
  useDebounce: (fn: (...args: unknown[]) => void) => fn,
}));

import { SchedulePanel } from "./SchedulePanel";

const makeProject = (overrides: Partial<ServiceProject> = {}): ServiceProject => ({
  id: "proj-1",
  name: "Sunday Morning",
  closed_at_ms: null,
  scheduled_at_ms: null,
  description: null,
  items: [],
  tasks: [],
  created_at_ms: 1700000000000,
  ...overrides,
});

const makeItem = (overrides = {}) => ({
  id: "item-1",
  reference: "John 3:16",
  text: "For God so loved the world",
  translation: "KJV",
  position: 0,
  item_type: "scripture",
  added_at_ms: 1700000000000,
  duration_secs: null,
  notes: null,
  asset_ids: [],
  ...overrides,
});

describe("SchedulePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_active_project") return Promise.resolve(null);
      if (cmd === "list_service_projects") return Promise.resolve([]);
      if (cmd === "list_translations") return Promise.resolve([]);
      if (cmd === "search_content_bank") return Promise.resolve([]);
      return Promise.resolve(undefined);
    });
  });

  it("renders without crashing", async () => {
    const { container } = render(<SchedulePanel />);
    expect(container).toBeTruthy();
  });

  it("shows SCHEDULE header", async () => {
    render(<SchedulePanel />);
    expect(screen.getByText("SCHEDULE")).toBeInTheDocument();
  });

  it("shows New Service button when no active project", async () => {
    render(<SchedulePanel />);
    await waitFor(() => {
      expect(screen.getByTitle("Start a new service")).toBeInTheDocument();
    });
  });

  it("shows new service form when New Service button is clicked", async () => {
    render(<SchedulePanel />);
    await waitFor(() => screen.getByTitle("Start a new service"));
    fireEvent.click(screen.getByTitle("Start a new service"));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Service name ...")).toBeInTheDocument();
    });
  });

  it("hides new service form when New Service button clicked again", async () => {
    render(<SchedulePanel />);
    await waitFor(() => screen.getByTitle("Start a new service"));
    fireEvent.click(screen.getByTitle("Start a new service"));
    await waitFor(() => screen.getByPlaceholderText("Service name ..."));
    fireEvent.click(screen.getByTitle("Start a new service"));
    await waitFor(() => {
      expect(screen.queryByPlaceholderText("Service name ...")).not.toBeInTheDocument();
    });
  });

  it("creates a new service when form is submitted", async () => {
    const newProject = makeProject({ name: "Easter Service" });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_active_project") return Promise.resolve(null);
      if (cmd === "list_service_projects") return Promise.resolve([]);
      if (cmd === "list_translations") return Promise.resolve([]);
      if (cmd === "create_service_project") return Promise.resolve(newProject);
      return Promise.resolve(undefined);
    });

    render(<SchedulePanel />);
    await waitFor(() => screen.getByTitle("Start a new service"));
    fireEvent.click(screen.getByTitle("Start a new service"));
    await waitFor(() => screen.getByPlaceholderText("Service name ..."));

    fireEvent.change(screen.getByPlaceholderText("Service name ..."), {
      target: { value: "Easter Service" },
    });
    fireEvent.click(screen.getByText("Create"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("create_service_project", { name: "Easter Service" });
    });
  });

  it("shows End and End + Summary buttons when project is active", async () => {
    const activeProject = makeProject();
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_active_project") return Promise.resolve(activeProject);
      if (cmd === "list_service_projects") return Promise.resolve([activeProject]);
      if (cmd === "list_translations") return Promise.resolve([]);
      return Promise.resolve(undefined);
    });

    render(<SchedulePanel />);
    await waitFor(() => {
      expect(screen.getByTitle("End this service without summary")).toBeInTheDocument();
      expect(screen.getByTitle("End service and generate AI summary")).toBeInTheDocument();
    });
  });

  it("shows active project name", async () => {
    const activeProject = makeProject({ name: "Sunday Morning" });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_active_project") return Promise.resolve(activeProject);
      if (cmd === "list_service_projects") return Promise.resolve([activeProject]);
      if (cmd === "list_translations") return Promise.resolve([]);
      return Promise.resolve(undefined);
    });

    render(<SchedulePanel />);
    await waitFor(() => {
      expect(screen.getByText("Sunday Morning")).toBeInTheDocument();
    });
  });

  it("shows empty schedule message when active project has no items", async () => {
    const activeProject = makeProject({ items: [] });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_active_project") return Promise.resolve(activeProject);
      if (cmd === "list_service_projects") return Promise.resolve([activeProject]);
      if (cmd === "list_translations") return Promise.resolve([]);
      return Promise.resolve(undefined);
    });

    render(<SchedulePanel />);
    await waitFor(() => {
      expect(screen.getByText(/Push scripture to display/i)).toBeInTheDocument();
    });
  });

  it("shows project items in the schedule", async () => {
    const activeProject = makeProject({ items: [makeItem()] });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_active_project") return Promise.resolve(activeProject);
      if (cmd === "list_service_projects") return Promise.resolve([activeProject]);
      if (cmd === "list_translations") return Promise.resolve([]);
      return Promise.resolve(undefined);
    });

    render(<SchedulePanel />);
    await waitFor(() => {
      expect(screen.getByText("John 3:16")).toBeInTheDocument();
      expect(screen.getByText("For God so loved the world")).toBeInTheDocument();
    });
  });

  it("calls push_to_display when a schedule item is clicked", async () => {
    const activeProject = makeProject({ items: [makeItem()] });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_active_project") return Promise.resolve(activeProject);
      if (cmd === "list_service_projects") return Promise.resolve([activeProject]);
      if (cmd === "list_translations") return Promise.resolve([]);
      if (cmd === "push_to_display") return Promise.resolve(undefined);
      return Promise.resolve(undefined);
    });

    render(<SchedulePanel />);
    await waitFor(() => screen.getByText("John 3:16"));
    fireEvent.click(screen.getByText("John 3:16").closest("[role=button]")!);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("push_to_display", {
        reference: "John 3:16",
        text: "For God so loved the world",
        translation: "KJV",
      });
    });
  });

  it("calls remove_item_from_active_project when remove button is clicked", async () => {
    const updatedProject = makeProject({ items: [] });
    const activeProject = makeProject({ items: [makeItem()] });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_active_project") return Promise.resolve(activeProject);
      if (cmd === "list_service_projects") return Promise.resolve([activeProject]);
      if (cmd === "list_translations") return Promise.resolve([]);
      if (cmd === "remove_item_from_active_project") return Promise.resolve(updatedProject);
      return Promise.resolve(undefined);
    });

    render(<SchedulePanel />);
    await waitFor(() => screen.getByTitle("Remove from schedule"));
    fireEvent.click(screen.getByTitle("Remove from schedule"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("remove_item_from_active_project", { itemId: "item-1" });
    });
  });

  it("ends service when End button is clicked", async () => {
    const activeProject = makeProject();
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_active_project") return Promise.resolve(activeProject);
      if (cmd === "list_service_projects") return Promise.resolve([activeProject]);
      if (cmd === "list_translations") return Promise.resolve([]);
      if (cmd === "close_active_project") return Promise.resolve(undefined);
      return Promise.resolve(undefined);
    });

    render(<SchedulePanel />);
    await waitFor(() => screen.getByTitle("End this service without summary"));
    fireEvent.click(screen.getByTitle("End this service without summary"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("close_active_project");
    });
  });

  it("ends service with summary when End + Summary is clicked", async () => {
    const activeProject = makeProject({ id: "proj-1" });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_active_project") return Promise.resolve(activeProject);
      if (cmd === "list_service_projects") return Promise.resolve([activeProject]);
      if (cmd === "list_translations") return Promise.resolve([]);
      if (cmd === "close_active_project") return Promise.resolve(undefined);
      if (cmd === "generate_service_summary") return Promise.resolve(undefined);
      return Promise.resolve(undefined);
    });

    render(<SchedulePanel />);
    await waitFor(() => screen.getByTitle("End service and generate AI summary"));
    fireEvent.click(screen.getByTitle("End service and generate AI summary"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("close_active_project");
    });
  });

  it("shows CONTENT BANK toggle", async () => {
    render(<SchedulePanel />);
    await waitFor(() => {
      expect(screen.getByText("CONTENT BANK")).toBeInTheDocument();
    });
  });

  it("expands content bank when toggle is clicked", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_active_project") return Promise.resolve(null);
      if (cmd === "list_service_projects") return Promise.resolve([]);
      if (cmd === "list_translations") return Promise.resolve([{ id: "kjv", abbreviation: "KJV" }]);
      if (cmd === "search_content_bank") return Promise.resolve([]);
      return Promise.resolve(undefined);
    });

    render(<SchedulePanel />);
    await waitFor(() => screen.getByText("CONTENT BANK"));
    fireEvent.click(screen.getByText("CONTENT BANK"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("search_content_bank", { query: "" });
    });
  });

  it("shows past projects section", async () => {
    const closedProject = makeProject({
      id: "proj-past",
      name: "Last Sunday",
      closed_at_ms: 1699000000000,
    });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_active_project") return Promise.resolve(null);
      if (cmd === "list_service_projects") return Promise.resolve([closedProject]);
      if (cmd === "list_translations") return Promise.resolve([]);
      return Promise.resolve(undefined);
    });

    render(<SchedulePanel />);
    await waitFor(() => {
      expect(screen.getByText(/past services/i)).toBeInTheDocument();
    });
  });
});
