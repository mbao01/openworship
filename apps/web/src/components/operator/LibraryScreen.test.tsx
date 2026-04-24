import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { Song, VerseResult } from "@/lib/types";

const mockInvoke = vi.fn();
vi.mock("@/lib/tauri", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

const mockSearchSongs = vi.fn<() => Promise<Song[]>>();
const mockPushSongToDisplay = vi.fn<() => Promise<void>>();

vi.mock("@/lib/commands/songs", () => ({
  searchSongs: (...args: unknown[]) => mockSearchSongs(...(args as [])),
  pushSongToDisplay: (...args: unknown[]) => mockPushSongToDisplay(...(args as [])),
}));

vi.mock("@/lib/commands/projects", () => ({
  addItemToActiveProject: vi.fn().mockResolvedValue(undefined),
}));

import { LibraryScreen } from "./LibraryScreen";

const makeVerse = (overrides: Partial<VerseResult> = {}): VerseResult => ({
  reference: "Romans 8:28",
  text: "And we know that in all things God works for the good.",
  translation: "NIV",
  book: "Romans",
  chapter: 8,
  verse: 28,
  score: 1.0,
  ...overrides,
});

const makeSong = (overrides: Partial<Song> = {}): Song => ({
  id: 1,
  title: "Amazing Grace",
  artist: "John Newton",
  source: null,
  ccli_number: null,
  lyrics: "Amazing grace, how sweet the sound",
  created_at_ms: 1700000000000,
  ...overrides,
});

describe("LibraryScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue([makeVerse()]);
    mockSearchSongs.mockResolvedValue([]);
    mockPushSongToDisplay.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders Scripture and Songs tabs", async () => {
    render(<LibraryScreen />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByText("Scripture")).toBeInTheDocument();
    expect(screen.getByText("Songs")).toBeInTheDocument();
  });

  it("loads default Romans 8 results on mount", async () => {
    render(<LibraryScreen />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(mockInvoke).toHaveBeenCalledWith("search_scriptures", {
      query: "Romans 8",
      translation: null,
    });
  });

  it("switches to Songs tab and shows song search input", async () => {
    render(<LibraryScreen />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    fireEvent.click(screen.getByText("Songs"));
    expect(screen.getByPlaceholderText(/search songs by title/i)).toBeInTheDocument();
  });

  it("searches songs after debounce when typing in Songs tab", async () => {
    mockSearchSongs.mockResolvedValue([
      makeSong({ id: 1, title: "Amazing Grace" }),
    ]);

    render(<LibraryScreen />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    fireEvent.click(screen.getByText("Songs"));
    const input = screen.getByPlaceholderText(/search songs by title/i);
    fireEvent.change(input, { target: { value: "grace" } });

    // Not called yet (debounce)
    expect(mockSearchSongs).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(220); });
    expect(mockSearchSongs).toHaveBeenCalledWith("grace");
  });

  it("searches scriptures after debounce when typing in Scripture tab", async () => {
    mockInvoke.mockResolvedValue([]);
    render(<LibraryScreen />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    const input = screen.getByPlaceholderText(/search 31,000/i);
    const callCountBeforeSearch = mockInvoke.mock.calls.length;
    fireEvent.change(input, { target: { value: "John 3" } });

    await act(async () => { await vi.advanceTimersByTimeAsync(220); });

    expect(mockInvoke.mock.calls.length).toBeGreaterThan(callCountBeforeSearch);
    const lastCall = mockInvoke.mock.calls[mockInvoke.mock.calls.length - 1];
    expect(lastCall[0]).toBe("search_scriptures");
    expect(lastCall[1]).toMatchObject({ query: "John 3" });
  });

  it("does not run search for whitespace-only query", async () => {
    render(<LibraryScreen />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    const callCountAfterMount = mockInvoke.mock.calls.length;
    const input = screen.getByPlaceholderText(/search 31,000/i);
    fireEvent.change(input, { target: { value: "   " } });

    await act(async () => { await vi.advanceTimersByTimeAsync(220); });

    expect(mockInvoke.mock.calls.length).toBe(callCountAfterMount);
  });

  it("renders verse results from scripture search", async () => {
    vi.useRealTimers();
    mockInvoke.mockResolvedValue([
      makeVerse({ reference: "John 3:16", text: "For God so loved the world" }),
    ]);

    render(<LibraryScreen />);
    await waitFor(() => expect(screen.getAllByText("John 3:16").length).toBeGreaterThan(0));
  });

  it("resets query and results when switching tabs", async () => {
    mockSearchSongs.mockResolvedValue([makeSong({ id: 1, title: "Grace" })]);

    render(<LibraryScreen />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    // Switch to songs and search
    fireEvent.click(screen.getByText("Songs"));
    fireEvent.change(screen.getByPlaceholderText(/search songs by title/i), {
      target: { value: "grace" },
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(220); });

    // Switch back to scripture
    fireEvent.click(screen.getByText("Scripture"));
    const input = screen.getByPlaceholderText(/search 31,000/i);
    expect((input as HTMLInputElement).value).toBe("");
  });
});
