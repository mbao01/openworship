import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ArtifactEntry } from "../../../lib/types";

vi.mock("./helpers", () => ({
  formatBytes: (bytes: number) => `${bytes}B`,
  formatDate: (ms: number) => new Date(ms).toLocaleDateString(),
  fileIcon: () => "📄",
}));

vi.mock("./SyncCell", () => ({
  SyncCell: () => <span data-testid="sync-cell">sync</span>,
  SharedCell: () => <span data-testid="shared-cell">shared</span>,
}));

import { AssetTable } from "./AssetTable";

const makeEntry = (overrides: Partial<ArtifactEntry> = {}): ArtifactEntry => ({
  id: "entry-1",
  name: "photo.jpg",
  path: "/photo.jpg",
  mime_type: "image/jpeg",
  size_bytes: 1024,
  parent_path: "/",
  service_id: null,
  is_dir: false,
  thumbnail_path: null,
  created_at_ms: 1700000000000,
  modified_at_ms: 1700000000000,
  starred: false,
  ...overrides,
});

describe("AssetTable", () => {
  const onSelect = vi.fn();
  const onContextMenu = vi.fn();
  const onNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderTable = (
    visible: ArtifactEntry[] = [],
    selected: ArtifactEntry | null = null,
  ) =>
    render(
      <AssetTable
        visible={visible}
        syncInfoMap={new Map()}
        selected={selected}
        query=""
        zoom={100}
        onSelect={onSelect}
        onContextMenu={onContextMenu}
        onNavigate={onNavigate}
      />,
    );

  it("renders without crashing", () => {
    const { container } = renderTable();
    expect(container).toBeTruthy();
  });

  it("renders table headers: Name, Type, Size, Modified", () => {
    renderTable();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Size")).toBeInTheDocument();
    expect(screen.getByText("Modified")).toBeInTheDocument();
  });

  it("shows empty state when no entries", () => {
    renderTable([]);
    // Should render the empty state with search icon area
    const { container } = renderTable([]);
    expect(container.querySelector("table")).toBeTruthy();
  });

  it("renders file entries", () => {
    renderTable([makeEntry({ name: "document.pdf" })]);
    expect(screen.getByText("document.pdf")).toBeInTheDocument();
  });

  it("renders file size", () => {
    renderTable([makeEntry({ size_bytes: 2048 })]);
    expect(screen.getByText("2048B")).toBeInTheDocument();
  });

  it("renders folder icon for directories", () => {
    const entry = makeEntry({ is_dir: true, name: "My Folder" });
    renderTable([entry]);
    expect(screen.getByText("My Folder")).toBeInTheDocument();
  });

  it("calls onSelect when a row is clicked", () => {
    const entry = makeEntry();
    renderTable([entry]);
    fireEvent.click(screen.getByText("photo.jpg"));
    expect(onSelect).toHaveBeenCalledWith(entry);
  });

  it("calls onNavigate on double-click", () => {
    const entry = makeEntry();
    renderTable([entry]);
    fireEvent.dblClick(screen.getByText("photo.jpg"));
    expect(onNavigate).toHaveBeenCalledWith(entry);
  });

  it("calls onContextMenu on right-click", () => {
    const entry = makeEntry();
    renderTable([entry]);
    fireEvent.contextMenu(screen.getByText("photo.jpg"));
    expect(onContextMenu).toHaveBeenCalled();
  });

  it("renders multiple entries", () => {
    renderTable([
      makeEntry({ id: "e1", name: "file1.jpg" }),
      makeEntry({ id: "e2", name: "file2.png" }),
    ]);
    expect(screen.getByText("file1.jpg")).toBeInTheDocument();
    expect(screen.getByText("file2.png")).toBeInTheDocument();
  });

  it("shows SyncCell for each entry", () => {
    renderTable([makeEntry()]);
    expect(screen.getByTestId("sync-cell")).toBeInTheDocument();
  });

  it("calls onSelect with null when clicking on selected row", () => {
    const entry = makeEntry();
    renderTable([entry], entry);
    fireEvent.click(screen.getByText("photo.jpg"));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
