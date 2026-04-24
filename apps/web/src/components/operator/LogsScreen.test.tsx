import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { LogsScreen } from "./LogsScreen";

// Mock invoke from lib/tauri (which re-exports from @tauri-apps/api/core)
const mockInvoke = vi.fn();
vi.mock("../../lib/tauri", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

const mockListServiceSummaries = vi.fn();
const mockGenerateServiceSummary = vi.fn();
const mockSendSummaryEmail = vi.fn();
vi.mock("../../lib/commands/summaries", () => ({
  listServiceSummaries: (...args: unknown[]) => mockListServiceSummaries(...args),
  generateServiceSummary: (...args: unknown[]) => mockGenerateServiceSummary(...args),
  sendSummaryEmail: (...args: unknown[]) => mockSendSummaryEmail(...args),
}));

const mockToastError = vi.hoisted(() => vi.fn(() => vi.fn()));
const mockToastSuccess = vi.fn();
vi.mock("../../lib/toast", () => ({
  toastError: mockToastError,
  toast: { success: (...args: unknown[]) => mockToastSuccess(...args) },
}));

const makeProject = (overrides: Record<string, unknown> = {}) => ({
  id: "proj-1",
  name: "Sunday Service",
  created_at_ms: 1700000000000,
  closed_at_ms: 1700003600000,
  items: [
    { id: "item-1", reference: "John 3:16", translation: "NIV", position: 0, added_at_ms: 1700001000000 },
  ],
  ...overrides,
});

const makeSummary = (overrides: Record<string, unknown> = {}) => ({
  id: "sum-1",
  project_id: "proj-1",
  summary_text: "A wonderful service.",
  generated_at_ms: 1700005000000,
  email_sent: false,
  email_sent_at_ms: null,
  ...overrides,
});

describe("LogsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue([]);
    mockListServiceSummaries.mockResolvedValue([]);
    mockGenerateServiceSummary.mockResolvedValue(undefined);
    mockSendSummaryEmail.mockResolvedValue(undefined);
  });

  it("renders without crashing", async () => {
    const { container } = render(<LogsScreen />);
    expect(container).toBeTruthy();
  });

  it("shows empty state when no past services", async () => {
    render(<LogsScreen />);
    await waitFor(() => {
      expect(screen.getByText(/No past services yet/i)).toBeInTheDocument();
    });
  });

  it("shows placeholder when no service is selected", async () => {
    render(<LogsScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Select a service to view artifacts/i)).toBeInTheDocument();
    });
  });

  it("displays closed projects in the left panel", async () => {
    mockInvoke.mockResolvedValue([makeProject()]);
    const { container } = render(<LogsScreen />);
    // The project name appears in both sidebar and auto-selected detail view
    await waitFor(() => {
      const leftPanel = container.querySelector(".overflow-hidden.border-r");
      expect(within(leftPanel as HTMLElement).getByText("Sunday Service")).toBeInTheDocument();
    });
  });

  it("shows project count in header", async () => {
    mockInvoke.mockResolvedValue([
      makeProject(),
      makeProject({ id: "proj-2", name: "Wednesday Night" }),
    ]);
    render(<LogsScreen />);
    await waitFor(() => {
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });

  it("filters out open projects (closed_at_ms === null)", async () => {
    mockInvoke.mockResolvedValue([
      makeProject({ closed_at_ms: null }),
      makeProject({ id: "proj-2", name: "Closed Service" }),
    ]);
    const { container } = render(<LogsScreen />);
    await waitFor(() => {
      const leftPanel = container.querySelector(".overflow-hidden.border-r");
      expect(within(leftPanel as HTMLElement).queryByText("Sunday Service")).not.toBeInTheDocument();
      expect(within(leftPanel as HTMLElement).getByText("Closed Service")).toBeInTheDocument();
    });
  });

  it("auto-selects first project and shows its detail", async () => {
    mockInvoke.mockResolvedValue([makeProject()]);
    render(<LogsScreen />);
    await waitFor(() => {
      // The h1 detail heading shows when a project is auto-selected
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Sunday Service");
    });
  });

  it("shows recap in the detail view when a summary exists", async () => {
    mockInvoke.mockResolvedValue([makeProject()]);
    mockListServiceSummaries.mockResolvedValue([makeSummary()]);
    render(<LogsScreen />);
    await waitFor(() => {
      expect(screen.getByText("A wonderful service.")).toBeInTheDocument();
    });
  });

  it("shows 'Generate recap' button when no summary exists", async () => {
    mockInvoke.mockResolvedValue([makeProject()]);
    render(<LogsScreen />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /generate recap/i })).toBeInTheDocument();
    });
  });

  it("shows 'Publish' button when summary exists and not sent", async () => {
    mockInvoke.mockResolvedValue([makeProject()]);
    mockListServiceSummaries.mockResolvedValue([makeSummary({ email_sent: false })]);
    render(<LogsScreen />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^publish$/i })).toBeInTheDocument();
    });
  });

  it("does not show 'Publish' button when email already sent", async () => {
    mockInvoke.mockResolvedValue([makeProject()]);
    mockListServiceSummaries.mockResolvedValue([makeSummary({ email_sent: true, email_sent_at_ms: 1700010000000 })]);
    render(<LogsScreen />);
    await waitFor(() => {
      // After summary loads, Publish button should not be present
      expect(screen.queryByRole("button", { name: /^publish$/i })).not.toBeInTheDocument();
    });
  });

  it("generates a recap when button is clicked", async () => {
    mockInvoke.mockResolvedValue([makeProject()]);
    mockListServiceSummaries.mockResolvedValueOnce([]).mockResolvedValue([makeSummary()]);
    render(<LogsScreen />);
    await waitFor(() => screen.getByRole("button", { name: /generate recap/i }));

    fireEvent.click(screen.getByRole("button", { name: /generate recap/i }));
    await waitFor(() => {
      expect(mockGenerateServiceSummary).toHaveBeenCalledWith("proj-1");
      expect(mockToastSuccess).toHaveBeenCalledWith("Recap generated");
    });
  });

  it("publishes summary when Publish button is clicked", async () => {
    mockInvoke.mockResolvedValue([makeProject()]);
    mockListServiceSummaries
      .mockResolvedValueOnce([makeSummary()])
      .mockResolvedValue([makeSummary({ email_sent: true, email_sent_at_ms: 1700010000000 })]);
    render(<LogsScreen />);
    await waitFor(() => screen.getByRole("button", { name: /^publish$/i }));

    fireEvent.click(screen.getByRole("button", { name: /^publish$/i }));
    await waitFor(() => {
      expect(mockSendSummaryEmail).toHaveBeenCalledWith("sum-1");
      expect(mockToastSuccess).toHaveBeenCalledWith("Summary email sent");
    });
  });

  it("shows timeline items for the selected service", async () => {
    mockInvoke.mockResolvedValue([makeProject()]);
    render(<LogsScreen />);
    await waitFor(() => {
      expect(screen.getByText("John 3:16")).toBeInTheDocument();
      expect(screen.getByText("NIV")).toBeInTheDocument();
    });
  });

  it("shows 'sent' badge in project list for projects with sent email", async () => {
    mockInvoke.mockResolvedValue([makeProject()]);
    mockListServiceSummaries.mockResolvedValue([makeSummary({ email_sent: true, email_sent_at_ms: 1700010000000 })]);
    render(<LogsScreen />);
    await waitFor(() => {
      expect(screen.getByText("sent")).toBeInTheDocument();
    });
  });

  it("shows 'draft' badge in project list for draft summaries", async () => {
    mockInvoke.mockResolvedValue([makeProject()]);
    mockListServiceSummaries.mockResolvedValue([makeSummary({ email_sent: false })]);
    const { container } = render(<LogsScreen />);
    await waitFor(() => {
      // "draft" appears in sidebar badge and potentially in detail view too
      const draftEls = container.querySelectorAll("span, div");
      const hasDraft = Array.from(draftEls).some((el) => el.textContent === "draft");
      expect(hasDraft).toBe(true);
    });
  });

  it("selects different project when clicked", async () => {
    mockInvoke.mockResolvedValue([
      makeProject({ id: "proj-1", name: "Sunday Service" }),
      makeProject({ id: "proj-2", name: "Wednesday Night" }),
    ]);
    const { container } = render(<LogsScreen />);
    const leftPanel = container.querySelector(".overflow-hidden.border-r");
    await waitFor(() => {
      expect(within(leftPanel as HTMLElement).getByText("Wednesday Night")).toBeInTheDocument();
    });
    fireEvent.click(within(leftPanel as HTMLElement).getByText("Wednesday Night"));
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Wednesday Night");
    });
  });

  it("shows Regenerate button when summary exists", async () => {
    mockInvoke.mockResolvedValue([makeProject()]);
    mockListServiceSummaries.mockResolvedValue([makeSummary()]);
    render(<LogsScreen />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /regenerate/i })).toBeInTheDocument();
    });
  });

  it("shows artifact cards for the selected project", async () => {
    mockInvoke.mockResolvedValue([makeProject()]);
    render(<LogsScreen />);
    await waitFor(() => {
      expect(screen.getByText("Full transcript")).toBeInTheDocument();
      expect(screen.getByText("Scripture list")).toBeInTheDocument();
      expect(screen.getByText("Service recap")).toBeInTheDocument();
      expect(screen.getByText("Email to members")).toBeInTheDocument();
    });
  });
});
