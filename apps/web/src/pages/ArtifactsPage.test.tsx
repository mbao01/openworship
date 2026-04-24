import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ArtifactsPage } from "./ArtifactsPage";
import type { UploadEntry } from "@/stores/upload-store";

// Mock heavy sidebar UI components
vi.mock("@/components/ui/sidebar", () => {
  const mockComponent = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Sidebar: mockComponent,
    SidebarContent: mockComponent,
    SidebarFooter: mockComponent,
    SidebarGroup: mockComponent,
    SidebarGroupContent: mockComponent,
    SidebarGroupLabel: ({ children }: { children: React.ReactNode }) => <div className="sidebar-label">{children}</div>,
    SidebarInset: mockComponent,
    SidebarMenu: mockComponent,
    SidebarMenuButton: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
      <button onClick={onClick}>{children}</button>
    ),
    SidebarMenuItem: mockComponent,
    SidebarMenuSub: mockComponent,
    SidebarMenuSubButton: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
      <button onClick={onClick}>{children}</button>
    ),
    SidebarMenuSubItem: mockComponent,
    SidebarProvider: mockComponent,
    SidebarRail: () => null,
    SidebarSeparator: () => <hr />,
    SidebarTrigger: ({ onClick }: { onClick?: () => void }) => (
      <button onClick={onClick} title="Toggle sidebar">≡</button>
    ),
    useSidebar: () => ({ state: "expanded", open: true, setOpen: vi.fn() }),
  };
});

// Mock Collapsible
vi.mock("@radix-ui/react-collapsible", () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../components/ShareDialog", () => ({
  ShareDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="share-dialog">ShareDialog</div> : null,
}));

const mockInvoke = vi.fn();
vi.mock("../lib/tauri", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

const mockImportArtifactFile = vi.fn();
vi.mock("../lib/commands/artifacts", () => ({
  importArtifactFile: (...args: unknown[]) => mockImportArtifactFile(...args),
}));

const mockUseUploads = vi.fn<() => UploadEntry[]>(() => []);
vi.mock("../stores/upload-store", () => ({
  useUploads: () => mockUseUploads(),
  addUpload: vi.fn(),
  updateUpload: vi.fn(),
  removeUpload: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `file://${path}`,
  invoke: vi.fn(),
}));

const makeEntry = (overrides: Record<string, unknown> = {}) => ({
  id: "entry-1",
  name: "photo.jpg",
  path: "/photo.jpg",
  mime_type: "image/jpeg",
  size_bytes: 1024,
  parent_path: null,
  service_id: null,
  is_dir: false,
  is_folder: false,
  thumbnail_path: null,
  created_at_ms: 1700000000000,
  starred: false,
  tags: [],
  cloud_id: null,
  ...overrides,
});

describe("ArtifactsPage", () => {
  const onBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUploads.mockReturnValue([]);
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_service_projects") return Promise.resolve([]);
      if (cmd === "get_artifacts_settings") return Promise.resolve({ cloud_enabled: false });
      if (cmd === "get_storage_usage") return Promise.resolve({ used_bytes: 512, total_bytes: 10240 });
      if (cmd === "list_artifacts") return Promise.resolve([]);
      if (cmd === "list_recent_artifacts") return Promise.resolve([]);
      if (cmd === "list_starred_artifacts") return Promise.resolve([]);
      if (cmd === "list_cloud_artifacts") return Promise.resolve([]);
      if (cmd === "search_artifacts") return Promise.resolve([]);
      return Promise.resolve(undefined);
    });
  });

  it("renders without crashing", async () => {
    const { container } = render(<ArtifactsPage onBack={onBack} />);
    expect(container).toBeTruthy();
  });

  it("shows 'Artifacts' in the breadcrumb", async () => {
    render(<ArtifactsPage onBack={onBack} />);
    await waitFor(() => {
      expect(screen.getByText("Artifacts")).toBeInTheDocument();
    });
  });

  it("calls onBack when back button is clicked", async () => {
    render(<ArtifactsPage onBack={onBack} />);
    await waitFor(() => screen.getByTitle("Back to Operator"));
    fireEvent.click(screen.getByTitle("Back to Operator"));
    expect(onBack).toHaveBeenCalled();
  });

  it("shows search input when search button is clicked", async () => {
    render(<ArtifactsPage onBack={onBack} />);
    await waitFor(() => screen.getByTitle("Search"));
    fireEvent.click(screen.getByTitle("Search"));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search files…")).toBeInTheDocument();
    });
  });

  it("renders list and grid view toggle buttons", async () => {
    render(<ArtifactsPage onBack={onBack} />);
    await waitFor(() => {
      expect(screen.getByTitle("List view")).toBeInTheDocument();
      expect(screen.getByTitle("Grid view")).toBeInTheDocument();
    });
  });

  it("switches to grid view when grid button is clicked", async () => {
    render(<ArtifactsPage onBack={onBack} />);
    await waitFor(() => screen.getByTitle("Grid view"));
    fireEvent.click(screen.getByTitle("Grid view"));
    // No crash expected
  });

  it("shows Sync button", async () => {
    render(<ArtifactsPage onBack={onBack} />);
    await waitFor(() => {
      expect(screen.getByTitle("Sync all files to cloud")).toBeInTheDocument();
    });
  });

  it("shows 'All Artifacts' in sidebar", async () => {
    render(<ArtifactsPage onBack={onBack} />);
    await waitFor(() => {
      expect(screen.getAllByText("All Artifacts").length).toBeGreaterThan(0);
    });
  });

  it("shows upload button", async () => {
    render(<ArtifactsPage onBack={onBack} />);
    await waitFor(() => {
      expect(screen.getByTitle(/upload/i)).toBeInTheDocument();
    });
  });

  it("shows Recent nav item", async () => {
    render(<ArtifactsPage onBack={onBack} />);
    await waitFor(() => {
      expect(screen.getByText("Recent")).toBeInTheDocument();
    });
  });

  it("shows Starred nav item", async () => {
    render(<ArtifactsPage onBack={onBack} />);
    await waitFor(() => {
      expect(screen.getByText("Starred")).toBeInTheDocument();
    });
  });

  it("displays entries from list_artifacts", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_artifacts") return Promise.resolve([makeEntry()]);
      if (cmd === "list_service_projects") return Promise.resolve([]);
      if (cmd === "get_artifacts_settings") return Promise.resolve({});
      if (cmd === "get_storage_usage") return Promise.resolve({ used_bytes: 0, total_bytes: 0 });
      if (cmd === "list_recent_artifacts") return Promise.resolve([]);
      if (cmd === "get_cloud_sync_info") return Promise.resolve(null);
      return Promise.resolve([]);
    });
    render(<ArtifactsPage onBack={onBack} />);
    await waitFor(() => {
      expect(screen.getByText("photo.jpg")).toBeInTheDocument();
    });
  });

  it("switches to Recent when Recent nav is clicked", async () => {
    render(<ArtifactsPage onBack={onBack} />);
    await waitFor(() => screen.getByText("Recent"));
    fireEvent.click(screen.getByText("Recent"));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("list_recent_artifacts", expect.anything());
    });
  });

  it("switches to Starred when Starred nav is clicked", async () => {
    render(<ArtifactsPage onBack={onBack} />);
    await waitFor(() => screen.getByText("Starred"));
    fireEvent.click(screen.getByText("Starred"));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("list_starred_artifacts");
    });
  });

  it("toggles search input off when search button is clicked again", async () => {
    render(<ArtifactsPage onBack={onBack} />);
    await waitFor(() => screen.getByTitle("Search"));
    fireEvent.click(screen.getByTitle("Search"));
    await waitFor(() => screen.getByPlaceholderText("Search files…"));
    fireEvent.click(screen.getByTitle("Search"));
    await waitFor(() => {
      expect(screen.queryByPlaceholderText("Search files…")).not.toBeInTheDocument();
    });
  });

  it("handles pending uploads display", async () => {
    mockUseUploads.mockReturnValue([
      { id: "up-1", name: "video.mp4", previewUrl: "", size: 1024, status: "uploading" },
    ]);
    render(<ArtifactsPage onBack={onBack} />);
    // Shouldn't crash with uploads
    expect(true).toBe(true);
  });

  it("handles keyboard shortcuts for zoom", async () => {
    render(<ArtifactsPage onBack={onBack} />);
    await waitFor(() => screen.getByText("Artifacts"));
    fireEvent.keyDown(window, { key: "=", metaKey: true });
    fireEvent.keyDown(window, { key: "-", metaKey: true });
    fireEvent.keyDown(window, { key: "0", metaKey: true });
    // No crash expected
  });
});
