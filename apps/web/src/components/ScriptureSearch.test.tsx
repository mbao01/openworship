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

  it("pushes verse to display on result click", async () => {
    render(<ScriptureSearch />);
    const input = screen.getByPlaceholderText(/John 3:16/i);
    fireEvent.change(input, { target: { value: "John 3:16" } });
    await waitFor(() => screen.getByText("John 3:16"), { timeout: 500 });

    const result = screen.getByRole("button");
    fireEvent.click(result);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("push_to_display", {
        reference: "John 3:16",
        text: expect.stringContaining("God so loved"),
        translation: "KJV",
      });
    });
  });

  it("shows live indicator after pushing a verse", async () => {
    render(<ScriptureSearch />);
    const input = screen.getByPlaceholderText(/John 3:16/i);
    fireEvent.change(input, { target: { value: "John 3:16" } });
    await waitFor(() => screen.getByText("John 3:16"), { timeout: 500 });

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByLabelText("Live")).toBeDefined();
    });
  });

  it("silently ignores push_to_display error", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_translations") return Promise.resolve(mockTranslations);
      if (cmd === "search_scriptures") return Promise.resolve(mockResults);
      if (cmd === "push_to_display") return Promise.reject(new Error("no display"));
      return Promise.resolve([]);
    });
    render(<ScriptureSearch />);
    const input = screen.getByPlaceholderText(/John 3:16/i);
    fireEvent.change(input, { target: { value: "John 3:16" } });
    await waitFor(() => screen.getByText("John 3:16"), { timeout: 500 });

    // Should not throw
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("push_to_display", expect.anything());
    });
  });

  it("re-runs search when translation changes", async () => {
    render(<ScriptureSearch />);
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("list_translations"));

    const input = screen.getByPlaceholderText(/John 3:16/i);
    fireEvent.change(input, { target: { value: "John 3:16" } });
    await waitFor(() => screen.getByText("John 3:16"), { timeout: 500 });

    const before = mockInvoke.mock.calls.length;
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "WEB" } });

    await waitFor(() => {
      expect(mockInvoke.mock.calls.length).toBeGreaterThan(before);
      const calls = mockInvoke.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall?.[0]).toBe("search_scriptures");
      expect(lastCall?.[1]).toMatchObject({ translation: "WEB" });
    });
  });

  it("does not search when query is blank", async () => {
    render(<ScriptureSearch />);
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("list_translations"));

    const searchCalls = () =>
      mockInvoke.mock.calls.filter((c) => c[0] === "search_scriptures").length;
    const before = searchCalls();

    const input = screen.getByPlaceholderText(/John 3:16/i);
    fireEvent.change(input, { target: { value: "   " } });

    // Wait briefly to ensure no debounced call fires
    await new Promise((r) => setTimeout(r, 300));
    expect(searchCalls()).toBe(before);
  });

  it("shows live indicator keyed on translation — different translations do not share the indicator", async () => {
    const multiResults = [
      { ...mockResults[0], translation: "KJV" },
      { ...mockResults[0], translation: "WEB" },
    ];
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_translations") return Promise.resolve(mockTranslations);
      if (cmd === "search_scriptures") return Promise.resolve(multiResults);
      if (cmd === "push_to_display") return Promise.resolve(undefined);
      return Promise.resolve([]);
    });

    render(<ScriptureSearch />);
    const input = screen.getByPlaceholderText(/John 3:16/i);
    fireEvent.change(input, { target: { value: "John 3:16" } });
    await waitFor(() => screen.getAllByText("John 3:16").length > 0, { timeout: 500 });

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]); // push KJV

    await waitFor(() => {
      // Only 1 live indicator should appear
      expect(screen.getAllByLabelText("Live").length).toBe(1);
    });
  });
});
