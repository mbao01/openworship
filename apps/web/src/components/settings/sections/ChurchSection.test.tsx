import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ChurchIdentity } from "@/lib/types";

const { mockGetBranchSyncStatus } = vi.hoisted(() => ({
  mockGetBranchSyncStatus: vi.fn(),
}));

vi.mock("@/lib/commands/share", () => ({
  getBranchSyncStatus: mockGetBranchSyncStatus,
}));

import { ChurchSection } from "./ChurchSection";

const hqIdentity: ChurchIdentity = {
  church_id: "church-1",
  church_name: "Grace Church",
  branch_id: "branch-hq",
  branch_name: "HQ",
  role: "hq",
  invite_code: "GRACE-1234",
};

const memberIdentity: ChurchIdentity = {
  church_id: "church-1",
  church_name: "Grace Church",
  branch_id: "branch-dt",
  branch_name: "Downtown Campus",
  role: "member",
  invite_code: null,
};

describe("ChurchSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBranchSyncStatus.mockResolvedValue({
      last_pushed_ms: 1000,
      last_pulled_ms: 2000,
      hq_branch_name: "HQ",
      error: null,
    });
  });

  it("renders church name", () => {
    render(<ChurchSection identity={hqIdentity} />);
    expect(screen.getAllByText("Grace Church")[0]).toBeInTheDocument();
  });

  it("renders branch name", () => {
    render(<ChurchSection identity={hqIdentity} />);
    expect(screen.getByText("HQ")).toBeInTheDocument();
  });

  it("shows invite code for HQ role", () => {
    render(<ChurchSection identity={hqIdentity} />);
    expect(screen.getByText("GRACE-1234")).toBeInTheDocument();
  });

  it("shows copy button for HQ with invite code", () => {
    render(<ChurchSection identity={hqIdentity} />);
    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
  });

  it("loads sync status on mount", async () => {
    render(<ChurchSection identity={hqIdentity} />);
    await waitFor(() => {
      expect(mockGetBranchSyncStatus).toHaveBeenCalled();
    });
  });

  it("handles sync status load failure gracefully", async () => {
    mockGetBranchSyncStatus.mockRejectedValue(new Error("Network error"));
    // Should not throw
    render(<ChurchSection identity={hqIdentity} />);
    await waitFor(() => {
      expect(mockGetBranchSyncStatus).toHaveBeenCalled();
    });
    expect(screen.getByText("Grace Church")).toBeInTheDocument();
  });

  it("renders member role correctly", () => {
    render(<ChurchSection identity={memberIdentity} />);
    expect(screen.getByText("Downtown Campus")).toBeInTheDocument();
  });

  it("copies invite code to clipboard when copy button is clicked", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(navigator.clipboard, "writeText").mockImplementation(writeText);

    render(<ChurchSection identity={hqIdentity} />);
    await user.click(screen.getByRole("button", { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith("GRACE-1234");
  });
});
