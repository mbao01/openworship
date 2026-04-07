import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ScriptureSearch } from "./ScriptureSearch";

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock("../lib/tauri", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

const mockTranslations = [
  { id: "KJV", name: "King James Version", abbreviation: "KJV" },
  { id: "WEB", name: "World English Bible", abbreviation: "WEB" },
  { id: "BSB", name: "Berean Standard Bible", abbreviation: "BSB" },
];

const mockResults = [
  {
    translation: "KJV",
    book: "John",
    chapter: 3,
    verse: 16,
    text: "For God so loved the world, that he gave his only begotten Son...",
    reference: "John 3:16",
  },
];

beforeEach(() => {
  mockInvoke.mockReset();
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === "list_translations") return Promise.resolve(mockTranslations);
    if (cmd === "search_scriptures") return Promise.resolve(mockResults);
    if (cmd === "push_to_display") return Promise.resolve(undefined);
    return Promise.resolve([]);
  });
});

describe("ScriptureSearch", () => {
  it("renders the search input", () => {
    render(<ScriptureSearch />);
    expect(screen.getByPlaceholderText(/John 3:16/i)).toBeDefined();
  });

  it("loads translations on mount", async () => {
    render(<ScriptureSearch />);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("list_translations");
    });
  });

  it("renders translation options", async () => {
    render(<ScriptureSearch />);
    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeDefined();
    });
  });

  it("shows results after typing a query", async () => {
    render(<ScriptureSearch />);
    const input = screen.getByPlaceholderText(/John 3:16/i);
    fireEvent.change(input, { target: { value: "John 3:16" } });
    await waitFor(
      () => {
        expect(screen.getByText("John 3:16")).toBeDefined();
      },
      { timeout: 500 }
    );
  });

  it("shows empty state when no results", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_translations") return Promise.resolve(mockTranslations);
      if (cmd === "search_scriptures") return Promise.resolve([]);
      return Promise.resolve([]);
    });
    render(<ScriptureSearch />);
    const input = screen.getByPlaceholderText(/John 3:16/i);
    fireEvent.change(input, { target: { value: "xyznotfound" } });
    await waitFor(
      () => {
        expect(screen.getByText(/No results for/)).toBeDefined();
      },
      { timeout: 500 }
    );
  });
});
