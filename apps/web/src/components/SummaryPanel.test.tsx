import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

const mockInvoke = vi.fn();
vi.mock("@/lib/tauri", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

import { SummaryPanel } from "./SummaryPanel";
import type { ServiceSummary } from "@/lib/types";

const makeSummary = (overrides: Partial<ServiceSummary> & { id: string }): ServiceSummary => ({
  project_id: "proj-1",
  church_id: "church-1",
  service_name: "Sunday Morning",
  summary_text: "# Grace\n## Message\nGod is good\n- First point\n- Second point",
  generated_at_ms: 1700000000000,
  email_sent: false,
  email_sent_at_ms: null,
  ...overrides,
});

describe("SummaryPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue([]);
  });

  it("renders empty state when no summaries", async () => {
    render(<SummaryPanel />);
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("list_service_summaries"));
    expect(screen.getByText(/no service summaries yet/i)).toBeInTheDocument();
  });

  it("renders the SUMMARIES header", async () => {
    render(<SummaryPanel />);
    expect(screen.getByText("SUMMARIES")).toBeInTheDocument();
  });

  it("renders summaries after load", async () => {
    mockInvoke.mockResolvedValue([
      makeSummary({ id: "s1", service_name: "Sunday Morning Service" }),
      makeSummary({ id: "s2", service_name: "Evening Worship" }),
    ]);

    render(<SummaryPanel />);

    await waitFor(() => {
      expect(screen.getByText("Sunday Morning Service")).toBeInTheDocument();
      expect(screen.getByText("Evening Worship")).toBeInTheDocument();
    });
  });

  it("shows '✓ Sent' badge for summaries with email_sent=true", async () => {
    mockInvoke.mockResolvedValue([
      makeSummary({ id: "s1", email_sent: true }),
    ]);

    render(<SummaryPanel />);
    await waitFor(() => expect(screen.getByText(/✓ Sent/)).toBeInTheDocument());
  });

  it("does not show Email button for already-sent summaries", async () => {
    mockInvoke.mockResolvedValue([
      makeSummary({ id: "s1", email_sent: true }),
    ]);

    render(<SummaryPanel />);
    await waitFor(() => expect(screen.queryByTitle("Send to email subscribers")).not.toBeInTheDocument());
  });

  it("shows Email button for unsent summaries", async () => {
    mockInvoke.mockResolvedValue([
      makeSummary({ id: "s1", email_sent: false }),
    ]);

    render(<SummaryPanel />);
    await waitFor(() => expect(screen.getByTitle("Send to email subscribers")).toBeInTheDocument());
  });

  it("opens SummaryDetailModal when View is clicked", async () => {
    mockInvoke.mockResolvedValue([
      makeSummary({ id: "s1", service_name: "Morning Service" }),
    ]);

    render(<SummaryPanel />);
    await waitFor(() => screen.getByTitle("View summary"));

    fireEvent.click(screen.getByTitle("View summary"));

    // Modal should open with service name
    expect(screen.getAllByText("Morning Service").length).toBeGreaterThan(0);
    // Close button should be visible
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("collapses and expands when header is clicked", async () => {
    mockInvoke.mockResolvedValue([
      makeSummary({ id: "s1", service_name: "Morning Service" }),
    ]);

    render(<SummaryPanel />);
    await waitFor(() => screen.getByText("Morning Service"));

    // Click header to collapse
    fireEvent.click(screen.getByText("SUMMARIES"));
    expect(screen.queryByText("Morning Service")).not.toBeInTheDocument();

    // Click again to expand
    fireEvent.click(screen.getByText("SUMMARIES"));
    await waitFor(() => expect(screen.getByText("Morning Service")).toBeInTheDocument());
  });

  it("deletes a summary when × button is clicked", async () => {
    mockInvoke
      .mockResolvedValueOnce([makeSummary({ id: "s1" })])
      .mockResolvedValue(undefined); // delete call

    render(<SummaryPanel />);
    await waitFor(() => screen.getByTitle("Delete summary"));

    await act(async () => {
      fireEvent.click(screen.getByTitle("Delete summary"));
    });

    expect(mockInvoke).toHaveBeenCalledWith("delete_service_summary", { summaryId: "s1" });
  });

  it("shows error when delete fails", async () => {
    mockInvoke
      .mockResolvedValueOnce([makeSummary({ id: "s1" })])
      .mockRejectedValue(new Error("delete failed"));

    render(<SummaryPanel />);
    await waitFor(() => screen.getByTitle("Delete summary"));

    await act(async () => {
      fireEvent.click(screen.getByTitle("Delete summary"));
    });

    await waitFor(() => expect(screen.getByText(/delete failed/i)).toBeInTheDocument());
  });

  it("sends email for a summary", async () => {
    mockInvoke
      .mockResolvedValueOnce([makeSummary({ id: "s1", email_sent: false })])
      .mockResolvedValueOnce(["subscriber@test.com"]) // send_summary_email
      .mockResolvedValueOnce([]); // list_service_summaries after reload

    render(<SummaryPanel />);
    await waitFor(() => screen.getByTitle("Send to email subscribers"));

    await act(async () => {
      fireEvent.click(screen.getByTitle("Send to email subscribers"));
    });

    expect(mockInvoke).toHaveBeenCalledWith("send_summary_email", { summaryId: "s1" });
  });

  it("shows warning when no subscribers found", async () => {
    mockInvoke
      .mockResolvedValueOnce([makeSummary({ id: "s1", email_sent: false })])
      .mockResolvedValueOnce([]) // send_summary_email returns empty array
      .mockResolvedValueOnce([]); // list_service_summaries

    render(<SummaryPanel />);
    await waitFor(() => screen.getByTitle("Send to email subscribers"));

    await act(async () => {
      fireEvent.click(screen.getByTitle("Send to email subscribers"));
    });

    await waitFor(() =>
      expect(screen.getByText(/no subscribers found/i)).toBeInTheDocument(),
    );
  });
});
