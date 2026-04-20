import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { PlanScreen } from "./PlanScreen";

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

const mockProjects = [
  {
    id: "p1",
    name: "Sunday Morning",
    created_at_ms: 1700000000000,
    closed_at_ms: null,
    scheduled_at_ms: null,
    description: null,
    items: [],
    tasks: [],
  },
];

vi.mock("@/lib/commands/projects", () => ({
  listServiceProjects: vi.fn().mockResolvedValue([
    {
      id: "p1",
      name: "Sunday Morning",
      created_at_ms: 1700000000000,
      closed_at_ms: null,
      scheduled_at_ms: null,
      description: null,
      items: [],
      tasks: [],
    },
  ]),
  createServiceProject: vi.fn().mockResolvedValue({
    id: "p2",
    name: "New Service",
    created_at_ms: 1700000001000,
    closed_at_ms: null,
    scheduled_at_ms: null,
    description: null,
    items: [],
    tasks: [],
  }),
  deleteServiceProject: vi.fn().mockResolvedValue(undefined),
  updateServiceProject: vi.fn().mockResolvedValue({}),
  closeActiveProject: vi.fn().mockResolvedValue(undefined),
  createServiceTask: vi.fn().mockResolvedValue({}),
  updateServiceTask: vi.fn().mockResolvedValue({}),
  deleteServiceTask: vi.fn().mockResolvedValue({}),
  addItemToActiveProject: vi.fn().mockResolvedValue(undefined),
  removeItemFromActiveProject: vi.fn().mockResolvedValue(undefined),
  reorderActiveProjectItems: vi.fn().mockResolvedValue(undefined),
  updateProjectItem: vi.fn().mockResolvedValue({}),
  linkAssetToItem: vi.fn().mockResolvedValue({}),
  unlinkAssetFromItem: vi.fn().mockResolvedValue({}),
  uploadAndLinkAsset: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/commands/content", () => ({
  listTranslations: vi.fn().mockResolvedValue([]),
  getActiveTranslation: vi.fn().mockResolvedValue("ESV"),
  searchScriptures: vi.fn().mockResolvedValue([]),
  switchLiveTranslation: vi.fn().mockResolvedValue(undefined),
  pushToDisplay: vi.fn().mockResolvedValue(undefined),
  searchContentBank: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/commands/settings", () => ({
  getAudioSettings: vi.fn().mockResolvedValue({
    backend: "off",
    audio_input_device: null,
  }),
  getEmailSettings: vi.fn().mockResolvedValue({}),
  setAudioSettings: vi.fn().mockResolvedValue(undefined),
  setEmailSettings: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/toast", () => ({
  toastError: () => () => {},
}));

vi.mock("@/lib/tauri", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

describe("PlanScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the service list after loading projects", async () => {
    render(<PlanScreen />);
    await waitFor(() => {
      // "Sunday Morning" appears in both the list and detail panel
      const matches = screen.getAllByText("Sunday Morning");
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders the 'New service' button", async () => {
    render(<PlanScreen />);
    await waitFor(() => {
      expect(screen.getByText("+ New service")).toBeInTheDocument();
    });
  });

  it("shows empty state when no projects exist", async () => {
    const { listServiceProjects } = await import(
      "@/lib/commands/projects"
    );
    (listServiceProjects as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    render(<PlanScreen />);
    await waitFor(() => {
      expect(
        screen.getByText("No services yet. Create one to get started."),
      ).toBeInTheDocument();
    });
  });
});
