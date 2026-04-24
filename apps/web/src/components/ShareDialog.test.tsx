import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ArtifactEntry, CloudSyncInfo } from "../lib/types";

const mockInvoke = vi.fn();
vi.mock("../lib/tauri", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

import { ShareDialog } from "./ShareDialog";

const makeArtifact = (overrides: Partial<ArtifactEntry> = {}): ArtifactEntry => ({
  id: "art-1",
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

const makeSyncInfo = (overrides: Partial<CloudSyncInfo> = {}): CloudSyncInfo => ({
  artifact_id: "art-1",
  sync_enabled: true,
  status: "synced",
  cloud_key: null,
  last_etag: null,
  last_synced_ms: 1700000000000,
  sync_error: null,
  progress: null,
  ...overrides,
});

describe("ShareDialog", () => {
  const onClose = vi.fn();
  const onSyncToggled = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_identity") return Promise.resolve({ branch_name: "Main Church", church_name: "First Church", timezone: "UTC" });
      if (cmd === "get_artifact_acl") return Promise.resolve([[], "restricted"]);
      if (cmd === "set_artifact_acl") return Promise.resolve(undefined);
      if (cmd === "toggle_artifact_cloud_sync") return Promise.resolve(undefined);
      if (cmd === "copy_artifact_link") return Promise.resolve("https://cloud.example.com/art-1");
      return Promise.resolve(undefined);
    });
    // Mock clipboard
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  const renderDialog = (syncInfo: CloudSyncInfo | null = makeSyncInfo()) =>
    render(
      <ShareDialog
        artifact={makeArtifact()}
        syncInfo={syncInfo}
        onClose={onClose}
        onSyncToggled={onSyncToggled}
      />,
    );

  it("renders without crashing", () => {
    const { container } = renderDialog();
    expect(container).toBeTruthy();
  });

  it("shows the Share heading", () => {
    renderDialog();
    expect(screen.getByRole("heading", { name: "Share" })).toBeInTheDocument();
  });

  it("shows the artifact name", () => {
    renderDialog();
    expect(screen.getByText("photo.jpg")).toBeInTheDocument();
  });

  it("shows close button and calls onClose when clicked", () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when backdrop is clicked", () => {
    renderDialog();
    const overlay = document.querySelector("[data-qa='share-dialog-overlay']");
    if (overlay) {
      fireEvent.click(overlay);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it("shows 'Add People or Branches' label", () => {
    renderDialog();
    expect(screen.getByText("Add People or Branches")).toBeInTheDocument();
  });

  it("shows search input for branches", () => {
    renderDialog();
    expect(
      screen.getByPlaceholderText("Search branches or enter email…"),
    ).toBeInTheDocument();
  });

  it("shows Share add-button (disabled when no query)", () => {
    renderDialog();
    const shareBtn = document.querySelector("[data-qa='share-add-btn']") as HTMLButtonElement;
    expect(shareBtn).toBeTruthy();
    expect(shareBtn.disabled).toBe(true);
  });

  it("enables Share button when search query is entered", () => {
    renderDialog();
    fireEvent.change(
      screen.getByPlaceholderText("Search branches or enter email…"),
      { target: { value: "East Branch" } },
    );
    const shareBtn = document.querySelector("[data-qa='share-add-btn']") as HTMLButtonElement;
    expect(shareBtn.disabled).toBe(false);
  });

  it("adds branch to ACL when Share is clicked", async () => {
    renderDialog();
    fireEvent.change(
      screen.getByPlaceholderText("Search branches or enter email…"),
      { target: { value: "East Branch" } },
    );
    const shareBtn = document.querySelector("[data-qa='share-add-btn']")!;
    fireEvent.click(shareBtn);

    await waitFor(() => {
      expect(screen.getByText("East Branch")).toBeInTheDocument();
    });
  });

  it("clears search input after sharing", async () => {
    renderDialog();
    const input = screen.getByPlaceholderText("Search branches or enter email…");
    fireEvent.change(input, { target: { value: "East Branch" } });
    const shareBtn = document.querySelector("[data-qa='share-add-btn']")!;
    fireEvent.click(shareBtn);
    await waitFor(() => {
      expect(input).toHaveValue("");
    });
  });

  it("adds branch via Enter key", async () => {
    renderDialog();
    const input = screen.getByPlaceholderText("Search branches or enter email…");
    fireEvent.change(input, { target: { value: "North Branch" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByText("North Branch")).toBeInTheDocument();
    });
  });

  it("shows 'Who Has Access' section", () => {
    renderDialog();
    expect(screen.getByText("Who Has Access")).toBeInTheDocument();
  });

  it("shows current branch as owner", async () => {
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText("Main Church")).toBeInTheDocument();
    });
  });

  it("shows Done button", () => {
    renderDialog();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("calls set_artifact_acl when Done is clicked", async () => {
    renderDialog();
    fireEvent.click(screen.getByText("Done"));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("set_artifact_acl", expect.objectContaining({
        artifactId: "art-1",
      }));
    });
  });

  it("calls onClose after saving successfully", async () => {
    renderDialog();
    fireEvent.click(screen.getByText("Done"));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("shows cloud sync prompt when sync is not enabled", () => {
    renderDialog(makeSyncInfo({ sync_enabled: false }));
    expect(
      screen.getByText("Enable cloud sync to share with other branches"),
    ).toBeInTheDocument();
  });

  it("shows Enable Sync button when sync disabled", () => {
    renderDialog(makeSyncInfo({ sync_enabled: false }));
    expect(screen.getByText("Enable Sync")).toBeInTheDocument();
  });

  it("calls toggle_artifact_cloud_sync when Enable Sync is clicked", async () => {
    renderDialog(makeSyncInfo({ sync_enabled: false }));
    fireEvent.click(screen.getByText("Enable Sync"));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "toggle_artifact_cloud_sync",
        expect.objectContaining({ artifactId: "art-1", enabled: true }),
      );
    });
  });

  it("does not show cloud sync prompt when sync is enabled", () => {
    renderDialog(makeSyncInfo({ sync_enabled: true }));
    expect(
      screen.queryByText("Enable cloud sync to share with other branches"),
    ).not.toBeInTheDocument();
  });

  it("shows copy link button", async () => {
    renderDialog();
    expect(
      document.querySelector("[data-qa='share-copy-link-btn']"),
    ).toBeTruthy();
  });

  it("copies link to clipboard when copy link is clicked", async () => {
    renderDialog();
    const copyBtn = document.querySelector("[data-qa='share-copy-link-btn']")!;
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "https://cloud.example.com/art-1",
      );
    });
  });

  it("handles multiple branch names entered comma-separated", async () => {
    renderDialog();
    fireEvent.change(
      screen.getByPlaceholderText("Search branches or enter email…"),
      { target: { value: "Branch A, Branch B" } },
    );
    const shareBtn = document.querySelector("[data-qa='share-add-btn']")!;
    fireEvent.click(shareBtn);

    await waitFor(() => {
      expect(screen.getByText("Branch A")).toBeInTheDocument();
      expect(screen.getByText("Branch B")).toBeInTheDocument();
    });
  });
});
