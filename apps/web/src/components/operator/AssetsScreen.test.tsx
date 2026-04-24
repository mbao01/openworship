import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AssetsScreen } from "./AssetsScreen";

// Mock all sub-components to isolate the shell
vi.mock("../ShareDialog", () => ({
  ShareDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="share-dialog">ShareDialog</div> : null,
}));

vi.mock("../ui/confirm-dialog", () => ({
  ConfirmDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="confirm-dialog">ConfirmDialog</div> : null,
}));

vi.mock("./assets/AssetsNav", () => ({
  AssetsNav: ({ onNav }: { onNav: (nav: unknown) => void }) => (
    <div data-testid="assets-nav">
      <button onClick={() => onNav({ kind: "all" })}>All Assets</button>
      <button onClick={() => onNav({ kind: "recent" })}>Recent</button>
      <button onClick={() => onNav({ kind: "starred" })}>Starred</button>
    </div>
  ),
}));

vi.mock("./assets/AssetTable", () => ({
  AssetTable: ({ visible }: { visible: unknown[] }) => (
    <div data-testid="asset-table">AssetTable ({(visible ?? []).length} entries)</div>
  ),
}));

vi.mock("./assets/AssetGrid", () => ({
  AssetGrid: ({ visible }: { visible: unknown[] }) => (
    <div data-testid="asset-grid">AssetGrid ({(visible ?? []).length} entries)</div>
  ),
}));

vi.mock("./assets/FilterDropdown", () => ({
  FilterDropdown: () => <div data-testid="filter-dropdown">FilterDropdown</div>,
}));

vi.mock("./assets/AssetContextMenu", () => ({
  AssetContextMenu: () => null,
}));

vi.mock("./assets/PreviewPanel", () => ({
  PreviewPanel: ({ entry }: { entry: { name: string } | null }) =>
    entry ? <div data-testid="preview-panel">{entry.name}</div> : null,
}));

vi.mock("./assets/RenameModal", () => ({
  RenameModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="rename-modal">RenameModal</div> : null,
}));

vi.mock("./assets/NewFolderModal", () => ({
  NewFolderModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="new-folder-modal">NewFolderModal</div> : null,
}));

vi.mock("./assets/MoveFolderModal", () => ({
  MoveFolderModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="move-folder-modal">MoveFolderModal</div> : null,
}));

vi.mock("./assets/ZoomControls", () => ({
  ZoomControls: ({ onZoomIn, onZoomOut, onReset }: { onZoomIn: () => void; onZoomOut: () => void; onReset: () => void }) => (
    <div data-testid="zoom-controls">
      <button onClick={onZoomIn} title="Zoom in">+</button>
      <button onClick={onZoomOut} title="Zoom out">-</button>
      <button onClick={onReset} title="Reset zoom">Reset</button>
    </div>
  ),
}));

vi.mock("./assets/NewMenu", () => ({
  NewMenu: ({ open }: { open: boolean }) =>
    open ? <div data-testid="new-menu">NewMenu</div> : null,
}));

vi.mock("./assets/SyncCell", () => ({
  SyncCell: () => <div data-testid="sync-cell">SyncCell</div>,
}));

vi.mock("./assets/helpers", () => ({
  formatDate: (ms: number) => new Date(ms).toLocaleDateString(),
  formatStorageBytes: (bytes: number) => `${bytes} B`,
  mimeCategory: () => "document",
  iconCls: "icon-class",
}));

const mockInvoke = vi.fn();
vi.mock("../../lib/tauri", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

const mockImportArtifactFile = vi.fn();
const mockRegenerateThumbnails = vi.fn();
vi.mock("../../lib/commands/artifacts", () => ({
  importArtifactFile: (...args: unknown[]) => mockImportArtifactFile(...args),
  regenerateThumbnails: (...args: unknown[]) => mockRegenerateThumbnails(...args),
}));

const mockAddUpload = vi.fn();
const mockUpdateUpload = vi.fn();
const mockRemoveUpload = vi.fn();
vi.mock("../../stores/upload-store", () => ({
  addUpload: (...args: unknown[]) => mockAddUpload(...args),
  updateUpload: (...args: unknown[]) => mockUpdateUpload(...args),
  removeUpload: (...args: unknown[]) => mockRemoveUpload(...args),
}));

const makeEntry = (overrides: Record<string, unknown> = {}) => ({
  id: "entry-1",
  name: "photo.jpg",
  path: "/photo.jpg",
  mime_type: "image/jpeg",
  size_bytes: 1024,
  parent_path: null,
  service_id: null,
  is_folder: false,
  thumbnail_path: null,
  created_at_ms: 1700000000000,
  starred: false,
  tags: [],
  cloud_id: null,
  ...overrides,
});

describe("AssetsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_service_projects") return Promise.resolve([]);
      if (cmd === "get_artifacts_settings") return Promise.resolve({ cloud_enabled: false, cloud_url: null });
      if (cmd === "get_storage_usage") return Promise.resolve({ used_bytes: 1024, total_bytes: 10240 });
      if (cmd === "list_artifacts") return Promise.resolve([]);
      if (cmd === "list_recent_artifacts") return Promise.resolve([]);
      if (cmd === "list_starred_artifacts") return Promise.resolve([]);
      if (cmd === "sync_artifact_to_cloud") return Promise.resolve(undefined);
      if (cmd === "sync_all_to_cloud") return Promise.resolve({ synced: 0, failed: 0, skipped: 0 });
      if (cmd === "get_cloud_sync_info") return Promise.resolve(null);
      if (cmd === "search_artifacts") return Promise.resolve([]);
      if (cmd === "rename_artifact") return Promise.resolve(undefined);
      if (cmd === "delete_artifact") return Promise.resolve(undefined);
      if (cmd === "toggle_star") return Promise.resolve(undefined);
      if (cmd === "create_folder") return Promise.resolve(undefined);
      if (cmd === "list_cloud_artifacts") return Promise.resolve([]);
      return Promise.resolve(undefined);
    });
    mockRegenerateThumbnails.mockResolvedValue(undefined);
  });

  it("renders without crashing", async () => {
    const { container } = render(<AssetsScreen />);
    expect(container).toBeTruthy();
  });

  it("renders the assets nav", async () => {
    render(<AssetsScreen />);
    expect(screen.getByTestId("assets-nav")).toBeInTheDocument();
  });

  it("renders the asset table in list view by default", async () => {
    render(<AssetsScreen />);
    await waitFor(() => {
      expect(screen.getByTestId("asset-table")).toBeInTheDocument();
    });
  });

  it("shows 'All Assets' section title by default", async () => {
    render(<AssetsScreen />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/all assets/i);
    });
  });

  it("switches to grid view when grid button is clicked", async () => {
    render(<AssetsScreen />);
    await waitFor(() => screen.getByTitle("Grid view"));
    fireEvent.click(screen.getByTitle("Grid view"));
    await waitFor(() => {
      expect(screen.getByTestId("asset-grid")).toBeInTheDocument();
    });
  });

  it("switches back to list view when list button is clicked", async () => {
    render(<AssetsScreen />);
    await waitFor(() => screen.getByTitle("Grid view"));
    fireEvent.click(screen.getByTitle("Grid view"));
    fireEvent.click(screen.getByTitle("List view"));
    await waitFor(() => {
      expect(screen.getByTestId("asset-table")).toBeInTheDocument();
    });
  });

  it("shows search input when search button is clicked", async () => {
    render(<AssetsScreen />);
    await waitFor(() => screen.getByTitle("Search"));
    fireEvent.click(screen.getByTitle("Search"));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search files...")).toBeInTheDocument();
    });
  });

  it("hides search input when search is toggled off", async () => {
    render(<AssetsScreen />);
    await waitFor(() => screen.getByTitle("Search"));
    fireEvent.click(screen.getByTitle("Search"));
    await waitFor(() => screen.getByPlaceholderText("Search files..."));
    fireEvent.click(screen.getByTitle("Search"));
    await waitFor(() => {
      expect(screen.queryByPlaceholderText("Search files...")).not.toBeInTheDocument();
    });
  });

  it("shows 'Recent' section when Recent is selected", async () => {
    render(<AssetsScreen />);
    await waitFor(() => screen.getByText("Recent"));
    fireEvent.click(screen.getByText("Recent"));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("list_recent_artifacts", expect.anything());
    });
  });

  it("shows 'Starred' section when Starred is selected", async () => {
    render(<AssetsScreen />);
    await waitFor(() => screen.getByText("Starred"));
    fireEvent.click(screen.getByText("Starred"));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("list_starred_artifacts");
    });
  });

  it("renders Sync button", async () => {
    render(<AssetsScreen />);
    await waitFor(() => {
      expect(screen.getByTitle("Sync all files to cloud")).toBeInTheDocument();
    });
  });

  it("renders Thumbnails button", async () => {
    render(<AssetsScreen />);
    await waitFor(() => {
      expect(screen.getByTitle("Generate missing thumbnails")).toBeInTheDocument();
    });
  });

  it("triggers thumbnail regeneration when Thumbnails button is clicked", async () => {
    render(<AssetsScreen />);
    await waitFor(() => screen.getByTitle("Generate missing thumbnails"));
    fireEvent.click(screen.getByTitle("Generate missing thumbnails"));
    await waitFor(() => {
      expect(mockRegenerateThumbnails).toHaveBeenCalled();
    });
  });

  it("renders with entries when list_artifacts returns data", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_artifacts") return Promise.resolve([makeEntry()]);
      if (cmd === "list_service_projects") return Promise.resolve([]);
      if (cmd === "get_artifacts_settings") return Promise.resolve({});
      if (cmd === "get_storage_usage") return Promise.resolve({ used_bytes: 0, total_bytes: 0 });
      if (cmd === "list_recent_artifacts") return Promise.resolve([]);
      if (cmd === "list_starred_artifacts") return Promise.resolve([]);
      return Promise.resolve([]);
    });
    render(<AssetsScreen />);
    await waitFor(() => {
      expect(screen.getByTestId("asset-table")).toBeInTheDocument();
    });
  });

  it("shows filter dropdown", async () => {
    render(<AssetsScreen />);
    await waitFor(() => {
      expect(screen.getByTestId("filter-dropdown")).toBeInTheDocument();
    });
  });

  it("shows zoom controls", async () => {
    render(<AssetsScreen />);
    await waitFor(() => {
      expect(screen.getByTestId("zoom-controls")).toBeInTheDocument();
    });
  });

  it("responds to keyboard zoom shortcuts", async () => {
    render(<AssetsScreen />);
    await waitFor(() => screen.getByTestId("asset-table"));
    // Cmd+= should zoom in
    fireEvent.keyDown(window, { key: "=", metaKey: true });
    // No crash expected
    fireEvent.keyDown(window, { key: "-", metaKey: true });
    fireEvent.keyDown(window, { key: "0", metaKey: true });
  });
});
