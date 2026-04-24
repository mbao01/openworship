import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ContentPanel } from "./ContentPanel";

const mockInvoke = vi.fn();
vi.mock("../lib/tauri", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

const mockToastError = vi.hoisted(() => vi.fn(() => vi.fn()));
vi.mock("../lib/toast", () => ({
  toastError: mockToastError,
}));

const makeAnnouncement = (overrides = {}) => ({
  id: "ann-1",
  title: "Welcome",
  body: "Welcome to our service",
  image_url: null,
  keyword_cue: null,
  ...overrides,
});

describe("ContentPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: list_announcements and list_sermon_notes return empty arrays
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_announcements") return Promise.resolve([]);
      if (cmd === "list_sermon_notes") return Promise.resolve([]);
      if (cmd === "get_active_sermon_note") return Promise.resolve(null);
      return Promise.resolve(undefined);
    });
  });

  it("renders without crashing", async () => {
    const { container } = render(<ContentPanel />);
    expect(container).toBeTruthy();
  });

  it("renders the Content header", async () => {
    render(<ContentPanel />);
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("renders all section titles when expanded", async () => {
    render(<ContentPanel />);
    await waitFor(() => {
      expect(screen.getByText("Announcements")).toBeInTheDocument();
      expect(screen.getByText("Custom Slide")).toBeInTheDocument();
      expect(screen.getByText("Countdown Timer")).toBeInTheDocument();
      // Sermon Notes may appear multiple times
      expect(screen.getAllByText("Sermon Notes").length).toBeGreaterThan(0);
    });
  });

  it("collapses when the header is clicked", async () => {
    render(<ContentPanel />);
    await waitFor(() => screen.getByText("Announcements"));
    const header = screen.getByRole("button", { name: /content/i });
    fireEvent.click(header);
    expect(screen.queryByText("Announcements")).not.toBeInTheDocument();
  });

  it("expands again after second click", async () => {
    render(<ContentPanel />);
    const header = screen.getByRole("button", { name: /content/i });
    fireEvent.click(header);
    fireEvent.click(header);
    await waitFor(() => {
      expect(screen.getByText("Announcements")).toBeInTheDocument();
    });
  });

  it("shows '+ New announcement' button", async () => {
    render(<ContentPanel />);
    await waitFor(() => {
      // The + button for announcements
      expect(screen.getByTitle("New announcement")).toBeInTheDocument();
    });
  });

  it("shows 'No announcements yet' when list is empty", async () => {
    render(<ContentPanel />);
    await waitFor(() => {
      expect(screen.getByText("No announcements yet")).toBeInTheDocument();
    });
  });

  it("shows create form when + button clicked", async () => {
    render(<ContentPanel />);
    await waitFor(() => screen.getByTitle("New announcement"));
    fireEvent.click(screen.getByTitle("New announcement"));
    expect(screen.getByPlaceholderText("Title *")).toBeInTheDocument();
  });

  it("hides create form when ✕ button clicked", async () => {
    render(<ContentPanel />);
    await waitFor(() => screen.getByTitle("New announcement"));
    fireEvent.click(screen.getByTitle("New announcement"));
    fireEvent.click(screen.getByTitle("Cancel"));
    expect(screen.queryByPlaceholderText("Title *")).not.toBeInTheDocument();
  });

  it("creates announcement with valid title", async () => {
    render(<ContentPanel />);
    await waitFor(() => screen.getByTitle("New announcement"));
    fireEvent.click(screen.getByTitle("New announcement"));

    const titleInput = screen.getByPlaceholderText("Title *");
    fireEvent.change(titleInput, { target: { value: "Big Event" } });

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_announcements") return Promise.resolve([makeAnnouncement({ title: "Big Event" })]);
      if (cmd === "list_sermon_notes") return Promise.resolve([]);
      if (cmd === "get_active_sermon_note") return Promise.resolve(null);
      return Promise.resolve(undefined);
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("create_announcement", expect.objectContaining({ title: "Big Event" }));
    });
  });

  it("disables Save button when title is empty", async () => {
    render(<ContentPanel />);
    await waitFor(() => screen.getByTitle("New announcement"));
    fireEvent.click(screen.getByTitle("New announcement"));
    const saveBtn = screen.getByRole("button", { name: /^save$/i });
    expect(saveBtn).toBeDisabled();
  });

  it("renders existing announcements", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_announcements") return Promise.resolve([makeAnnouncement()]);
      if (cmd === "list_sermon_notes") return Promise.resolve([]);
      if (cmd === "get_active_sermon_note") return Promise.resolve(null);
      return Promise.resolve(undefined);
    });
    render(<ContentPanel />);
    await waitFor(() => {
      expect(screen.getByText("Welcome")).toBeInTheDocument();
    });
  });

  it("shows keyword cue badge when announcement has keyword_cue", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_announcements") return Promise.resolve([makeAnnouncement({ keyword_cue: "welcome" })]);
      if (cmd === "list_sermon_notes") return Promise.resolve([]);
      if (cmd === "get_active_sermon_note") return Promise.resolve(null);
      return Promise.resolve(undefined);
    });
    render(<ContentPanel />);
    await waitFor(() => {
      // keyword cue is rendered as "⌨ welcome"
      expect(screen.getByTitle("Auto-triggers when this phrase is spoken")).toBeInTheDocument();
    });
  });

  it("pushes announcement to display when push button is clicked", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_announcements") return Promise.resolve([makeAnnouncement()]);
      if (cmd === "list_sermon_notes") return Promise.resolve([]);
      if (cmd === "get_active_sermon_note") return Promise.resolve(null);
      return Promise.resolve(undefined);
    });
    render(<ContentPanel />);
    await waitFor(() => screen.getByText("Welcome"));

    const pushBtn = screen.getByTitle("Push to display");
    fireEvent.click(pushBtn);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("push_announcement_to_display", { id: "ann-1" });
    });
  });

  it("deletes announcement when delete button is clicked", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_announcements") return Promise.resolve([makeAnnouncement()]);
      if (cmd === "list_sermon_notes") return Promise.resolve([]);
      if (cmd === "get_active_sermon_note") return Promise.resolve(null);
      return Promise.resolve(undefined);
    });
    render(<ContentPanel />);
    await waitFor(() => screen.getByText("Welcome"));

    const deleteBtn = screen.getByTitle("Delete");
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_announcements") return Promise.resolve([]);
      if (cmd === "list_sermon_notes") return Promise.resolve([]);
      if (cmd === "get_active_sermon_note") return Promise.resolve(null);
      return Promise.resolve(undefined);
    });
    fireEvent.click(deleteBtn);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("delete_announcement", { id: "ann-1" });
    });
  });

  it("shows Custom Slide 'Push to Display' button", async () => {
    render(<ContentPanel />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Body text")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /push to display/i })).toBeInTheDocument();
    });
  });

  it("disables Custom Slide push button when title and body are empty", async () => {
    render(<ContentPanel />);
    await waitFor(() => {
      const pushBtn = screen.getByRole("button", { name: /push to display/i });
      expect(pushBtn).toBeDisabled();
    });
  });

  it("enables Custom Slide push button when body has text", async () => {
    render(<ContentPanel />);
    await waitFor(() => screen.getByPlaceholderText("Body text"));
    const bodyInput = screen.getByPlaceholderText("Body text");
    fireEvent.change(bodyInput, { target: { value: "Test body" } });
    const pushBtn = screen.getByRole("button", { name: /push to display/i });
    expect(pushBtn).not.toBeDisabled();
  });

  it("pushes custom slide when push button clicked", async () => {
    render(<ContentPanel />);
    await waitFor(() => screen.getByPlaceholderText("Body text"));
    fireEvent.change(screen.getByPlaceholderText("Body text"), { target: { value: "Content" } });
    fireEvent.click(screen.getByRole("button", { name: /push to display/i }));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("push_custom_slide", expect.objectContaining({ body: "Content" }));
    });
  });

  it("shows countdown timer section with default values", async () => {
    render(<ContentPanel />);
    await waitFor(() => {
      expect(screen.getByText("Countdown Timer")).toBeInTheDocument();
      expect(screen.getByDisplayValue("5")).toBeInTheDocument(); // default 5 minutes
    });
  });

  it("starts countdown when ▶ button is clicked", async () => {
    render(<ContentPanel />);
    await waitFor(() => screen.getByText("Countdown Timer"));
    // The start button renders with ▶ icon and is adjacent to the timer input
    const countdownSection = screen.getByText("Countdown Timer").closest("div")!.parentElement!;
    const startBtn = countdownSection.querySelector("button");
    expect(startBtn).toBeTruthy();
    fireEvent.click(startBtn!);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("start_countdown", expect.objectContaining({ durationSecs: 300 }));
    });
  });
});
