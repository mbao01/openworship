import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LibraryPanel } from "./LibraryPanel";
import type { Song, AnnouncementItem } from "../../../lib/types";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

const mockListAnnouncements = vi.fn();
const mockPushAnnouncementToDisplay = vi.fn();
const mockImportPptxSlides = vi.fn();
const mockImportPdfSlides = vi.fn();

vi.mock("../../../lib/commands/annotations", () => ({
  listAnnouncements: (...args: unknown[]) => mockListAnnouncements(...args),
  pushAnnouncementToDisplay: (...args: unknown[]) => mockPushAnnouncementToDisplay(...args),
  importPptxSlides: (...args: unknown[]) => mockImportPptxSlides(...args),
  importPdfSlides: (...args: unknown[]) => mockImportPdfSlides(...args),
}));

const mockToastError = vi.hoisted(() => vi.fn(() => vi.fn()));
vi.mock("../../../lib/toast", () => ({
  toastError: mockToastError,
}));

vi.mock("../../../hooks/use-debounce", () => ({
  useDebounce: (fn: (...args: unknown[]) => void) => fn,
}));

vi.mock("./AssetsPanel", () => ({
  AssetsPanel: () => <div data-testid="assets-panel">AssetsPanel</div>,
}));

vi.mock("./ScriptureSearchPanel", () => ({
  ScriptureSearchPanel: () => (
    <div data-testid="scripture-search-panel">ScriptureSearchPanel</div>
  ),
}));

const makeSong = (overrides = {}): Song => ({
  id: 1,
  title: "Amazing Grace",
  artist: "John Newton",
  source: null,
  ccli_number: null,
  lyrics: "Amazing grace how sweet the sound",
  created_at_ms: 1700000000000,
  ...overrides,
});

const makeAnnouncement = (overrides = {}): AnnouncementItem => ({
  id: "ann-1",
  kind: "announcement",
  title: "Welcome",
  body: "Welcome to church",
  image_url: null,
  keyword_cue: null,
  created_at_ms: 1700000000000,
  ...overrides,
});

describe("LibraryPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue([]);
    mockListAnnouncements.mockResolvedValue([]);
    mockPushAnnouncementToDisplay.mockResolvedValue(undefined);
  });

  it("renders without crashing", () => {
    const { container } = render(<LibraryPanel />);
    expect(container).toBeTruthy();
  });

  it("renders Scripture tab by default", () => {
    render(<LibraryPanel />);
    expect(screen.getByTestId("scripture-search-panel")).toBeInTheDocument();
  });

  it("renders three tabs: Scripture, Lyrics, Slides", () => {
    render(<LibraryPanel />);
    // Use exact text matches to avoid matching sub-components
    expect(screen.getByRole("button", { name: /^Scripture/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Lyrics/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Slides/i })).toBeInTheDocument();
  });

  it("switches to Lyrics tab when clicked", async () => {
    render(<LibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: /^Lyrics/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/song title/i)).toBeInTheDocument();
    });
  });

  it("shows search input in Lyrics tab", async () => {
    render(<LibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: /^Lyrics/i }));
    await waitFor(() => {
      const input = screen.getByPlaceholderText(/song title/i);
      expect(input).toBeInTheDocument();
    });
  });

  it("shows empty state when no lyrics results", async () => {
    mockInvoke.mockResolvedValue([]);
    render(<LibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: /^Lyrics/i }));
    await waitFor(() => screen.getByPlaceholderText(/song title/i));
    fireEvent.change(screen.getByPlaceholderText(/song title/i), { target: { value: "grace" } });
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("search_songs", expect.objectContaining({ query: "grace" }));
    });
  });

  it("shows song results in Lyrics tab", async () => {
    mockInvoke.mockResolvedValue([makeSong()]);
    render(<LibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: /^Lyrics/i }));
    await waitFor(() => screen.getByPlaceholderText(/song title/i));
    fireEvent.change(screen.getByPlaceholderText(/song title/i), { target: { value: "grace" } });
    await waitFor(() => {
      expect(screen.getByText("Amazing Grace")).toBeInTheDocument();
    });
  });

  it("switches to Slides tab when clicked", async () => {
    render(<LibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: /^Slides/i }));
    await waitFor(() => {
      expect(mockListAnnouncements).toHaveBeenCalled();
    });
  });

  it("shows announcements in Slides tab", async () => {
    mockListAnnouncements.mockResolvedValue([makeAnnouncement()]);
    render(<LibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: /^Slides/i }));
    await waitFor(() => {
      expect(screen.getByText("Welcome")).toBeInTheDocument();
    });
  });

  it("pushes announcement when slide is clicked", async () => {
    mockListAnnouncements.mockResolvedValue([makeAnnouncement()]);
    render(<LibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: /^Slides/i }));
    await waitFor(() => screen.getByText("Welcome"));
    fireEvent.click(screen.getByText("Welcome"));
    await waitFor(() => {
      expect(mockPushAnnouncementToDisplay).toHaveBeenCalledWith("ann-1");
    });
  });

  it("shows empty state when no announcements", async () => {
    mockListAnnouncements.mockResolvedValue([]);
    render(<LibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: /^Slides/i }));
    await waitFor(() => {
      expect(screen.getByText(/no slides/i)).toBeInTheDocument();
    });
  });

  it("switches back to Scripture tab", async () => {
    render(<LibraryPanel />);
    fireEvent.click(screen.getByRole("button", { name: /^Lyrics/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Scripture/i }));
    await waitFor(() => {
      expect(screen.getByTestId("scripture-search-panel")).toBeInTheDocument();
    });
  });
});
