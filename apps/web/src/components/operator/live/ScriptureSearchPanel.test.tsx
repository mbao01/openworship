import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockSearchScriptures = vi.fn().mockResolvedValue([]);
const mockGetBookChapters = vi.fn().mockResolvedValue([]);
const mockGetChapterVerses = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/commands/content", () => ({
  searchScriptures: (...args: unknown[]) => mockSearchScriptures(...args),
  getBookChapters: (...args: unknown[]) => mockGetBookChapters(...args),
  getChapterVerses: (...args: unknown[]) => mockGetChapterVerses(...args),
}));

import { ScriptureSearchPanel } from "./ScriptureSearchPanel";

describe("ScriptureSearchPanel", () => {
  const onPush = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper: switch to text mode (default is now "select")
  async function switchToTextMode(user: ReturnType<typeof userEvent.setup>) {
    const textBtn = screen.getAllByRole("button").find(
      (b) => b.getAttribute("title") === "Free-text search",
    );
    expect(textBtn).toBeTruthy();
    await user.click(textBtn!);
  }

  it("renders in select mode by default and shows Book combobox", () => {
    render(<ScriptureSearchPanel onPush={onPush} />);
    expect(screen.getByText("Book")).toBeInTheDocument();
  });

  it("toggles to text mode and shows search input", async () => {
    const user = userEvent.setup();
    render(<ScriptureSearchPanel onPush={onPush} />);

    await switchToTextMode(user);
    expect(screen.getByPlaceholderText("Romans 8:38 ...")).toBeInTheDocument();
  });

  it("searches on text input with debounce", async () => {
    const user = userEvent.setup();
    mockSearchScriptures.mockResolvedValue([
      {
        reference: "John 3:16",
        text: "For God so loved the world",
        translation: "KJV",
        book: "John",
        chapter: 3,
        verse: 16,
        score: 1.0,
      },
    ]);

    render(<ScriptureSearchPanel onPush={onPush} />);
    await switchToTextMode(user);
    await user.type(screen.getByPlaceholderText("Romans 8:38 ..."), "John 3:16");

    await waitFor(() => {
      expect(mockSearchScriptures).toHaveBeenCalledWith("John 3:16");
    });

    await waitFor(() => {
      expect(screen.getByText("John 3:16")).toBeInTheDocument();
    });
  });

  it("toggles to select mode and shows Book combobox", async () => {
    const user = userEvent.setup();
    render(<ScriptureSearchPanel onPush={onPush} />);

    // Already in select mode by default
    expect(screen.getByText("Book")).toBeInTheDocument();

    // Switch to text then back to select confirms toggle works
    await switchToTextMode(user);
    const selectBtn = screen.getAllByRole("button").find(
      (b) => b.getAttribute("title") === "Browse by book/chapter/verse",
    );
    expect(selectBtn).toBeTruthy();
    await user.click(selectBtn!);
    expect(screen.getByText("Book")).toBeInTheDocument();
  });

  it("fetches chapters when book is selected via combobox", async () => {
    const user = userEvent.setup();
    mockGetBookChapters.mockResolvedValue([1, 2, 3, 4, 5]);

    render(<ScriptureSearchPanel onPush={onPush} />);
    // Already in select mode

    // Click the Book combobox to open it
    const bookTrigger = screen.getByText("Book");
    await user.click(bookTrigger);

    // Type to filter and select Genesis
    const filterInput = screen.getByPlaceholderText("Type to filter...");
    await user.type(filterInput, "Gen");

    // Click the Genesis option
    await waitFor(() => {
      expect(screen.getByText("Genesis")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Genesis"));

    await waitFor(() => {
      expect(mockGetBookChapters).toHaveBeenCalledWith("Genesis");
    });
  });

  it("calls onPush when a result is clicked", async () => {
    const user = userEvent.setup();
    mockSearchScriptures.mockResolvedValue([
      {
        reference: "Romans 8:28",
        text: "And we know that all things work together",
        translation: "KJV",
        book: "Romans",
        chapter: 8,
        verse: 28,
        score: 1.0,
      },
    ]);

    render(<ScriptureSearchPanel onPush={onPush} />);
    await switchToTextMode(user);
    await user.type(screen.getByPlaceholderText("Romans 8:38 ..."), "Romans 8:28");

    await waitFor(() => {
      expect(screen.getByText("Romans 8:28")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Romans 8:28"));
    expect(onPush).toHaveBeenCalledWith(
      "Romans 8:28",
      "And we know that all things work together",
      "KJV",
    );
  });

  it("resets state when switching modes", async () => {
    const user = userEvent.setup();
    mockSearchScriptures.mockResolvedValue([
      {
        reference: "John 1:1",
        text: "In the beginning was the Word",
        translation: "KJV",
        book: "John",
        chapter: 1,
        verse: 1,
        score: 1.0,
      },
    ]);

    render(<ScriptureSearchPanel onPush={onPush} />);
    await switchToTextMode(user);

    await user.type(screen.getByPlaceholderText("Romans 8:38 ..."), "John 1:1");
    await waitFor(() => expect(screen.getByText("John 1:1")).toBeInTheDocument());

    // Switch to select mode — results should clear
    const selectBtn = screen.getAllByRole("button").find(
      (b) => b.getAttribute("title") === "Browse by book/chapter/verse",
    );
    await user.click(selectBtn!);

    expect(screen.queryByText("John 1:1")).not.toBeInTheDocument();
    expect(screen.getByText("Book")).toBeInTheDocument();
  });
});
