import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SongLibrary } from "./SongLibrary";
import type { Song } from "../lib/types";

const mockInvoke = vi.fn();
vi.mock("../lib/tauri", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock("../hooks/use-debounce", () => ({
  useDebounce: (fn: (...args: unknown[]) => void) => fn,
}));

const makeSong = (overrides = {}): Song => ({
  id: 1,
  title: "Amazing Grace",
  artist: "John Newton",
  source: null,
  ccli_number: null,
  lyrics: "Amazing grace how sweet the sound\nThat saved a wretch like me",
  created_at_ms: 1700000000000,
  ...overrides,
});

describe("SongLibrary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "search_songs") return Promise.resolve([]);
      if (cmd === "get_song_semantic_status") return Promise.resolve({ ready: false, song_count: 0 });
      return Promise.resolve(undefined);
    });
    // Suppress window.confirm calls
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("renders without crashing", async () => {
    const { container } = render(<SongLibrary />);
    expect(container).toBeTruthy();
  });

  it("renders the SONGS header", async () => {
    render(<SongLibrary />);
    expect(screen.getByText("SONGS")).toBeInTheDocument();
  });

  it("renders the Add and Import buttons", async () => {
    render(<SongLibrary />);
    expect(screen.getByRole("button", { name: /\+ Add/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /import/i })).toBeInTheDocument();
  });

  it("renders a search input in list mode", async () => {
    render(<SongLibrary />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search songs/i)).toBeInTheDocument();
    });
  });

  it("shows empty state when no songs are found", async () => {
    render(<SongLibrary />);
    await waitFor(() => {
      expect(screen.getByText(/no songs yet/i)).toBeInTheDocument();
    });
  });

  it("displays songs when search_songs returns results", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "search_songs") return Promise.resolve([makeSong()]);
      if (cmd === "get_song_semantic_status") return Promise.resolve({ ready: false, song_count: 0 });
      return Promise.resolve(undefined);
    });
    render(<SongLibrary />);
    await waitFor(() => {
      expect(screen.getByText("Amazing Grace")).toBeInTheDocument();
      expect(screen.getByText("John Newton")).toBeInTheDocument();
    });
  });

  it("shows Add Song form when + Add is clicked", async () => {
    render(<SongLibrary />);
    fireEvent.click(screen.getByRole("button", { name: /\+ Add/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/lyrics/i)).toBeInTheDocument();
    });
  });

  it("returns to list mode when SongForm Cancel is clicked", async () => {
    render(<SongLibrary />);
    fireEvent.click(screen.getByRole("button", { name: /\+ Add/i }));
    await waitFor(() => screen.getByRole("button", { name: /cancel/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /\+ Add/i })).toBeInTheDocument();
    });
  });

  it("shows Import form when Import is clicked", async () => {
    render(<SongLibrary />);
    fireEvent.click(screen.getByRole("button", { name: /import/i }));
    await waitFor(() => {
      expect(screen.getByText(/CCLI/i)).toBeInTheDocument();
    });
  });

  it("returns to list mode when Import Cancel is clicked", async () => {
    render(<SongLibrary />);
    fireEvent.click(screen.getByRole("button", { name: /import/i }));
    await waitFor(() => screen.getByRole("button", { name: /cancel/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /import/i })).toBeInTheDocument();
    });
  });

  it("searches songs when query is typed", async () => {
    render(<SongLibrary />);
    await waitFor(() => screen.getByPlaceholderText(/search songs/i));
    fireEvent.change(screen.getByPlaceholderText(/search songs/i), {
      target: { value: "grace" },
    });
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("search_songs", { query: "grace", limit: 100 });
    });
  });

  it("pushes song to display when song row is clicked", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "search_songs") return Promise.resolve([makeSong()]);
      if (cmd === "get_song_semantic_status") return Promise.resolve({ ready: false, song_count: 0 });
      return Promise.resolve(undefined);
    });
    render(<SongLibrary />);
    await waitFor(() => screen.getByText("Amazing Grace"));

    // Clicking the song row (li[role=button]) pushes it to display
    const songRow = screen.getAllByRole("button").find(
      (el) => el.tagName === "LI" || el.getAttribute("data-testid") === "song-row"
    ) ?? screen.getAllByRole("button")[0];
    fireEvent.click(songRow);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("push_song_to_display", { id: 1 });
    });
  });

  it("shows edit form when edit button is clicked", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "search_songs") return Promise.resolve([makeSong()]);
      if (cmd === "get_song_semantic_status") return Promise.resolve({ ready: false, song_count: 0 });
      return Promise.resolve(undefined);
    });
    render(<SongLibrary />);
    await waitFor(() => screen.getByText("Amazing Grace"));

    const editBtn = screen.getByTitle("Edit");
    fireEvent.click(editBtn);
    await waitFor(() => {
      // Form should be pre-filled with the song's data
      expect(screen.getByDisplayValue("Amazing Grace")).toBeInTheDocument();
    });
  });

  it("deletes song when delete button is clicked and confirmed", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "search_songs") return Promise.resolve([makeSong()]);
      if (cmd === "get_song_semantic_status") return Promise.resolve({ ready: false, song_count: 0 });
      if (cmd === "delete_song") return Promise.resolve(undefined);
      return Promise.resolve(undefined);
    });
    render(<SongLibrary />);
    await waitFor(() => screen.getByText("Amazing Grace"));

    const deleteBtn = screen.getByTitle("Delete");
    fireEvent.click(deleteBtn);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("delete_song", { id: 1 });
    });
  });

  it("does not delete when confirm is cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "search_songs") return Promise.resolve([makeSong()]);
      if (cmd === "get_song_semantic_status") return Promise.resolve({ ready: false, song_count: 0 });
      return Promise.resolve(undefined);
    });
    render(<SongLibrary />);
    await waitFor(() => screen.getByText("Amazing Grace"));

    const deleteBtn = screen.getByTitle("Delete");
    fireEvent.click(deleteBtn);
    await waitFor(() => {
      expect(mockInvoke).not.toHaveBeenCalledWith("delete_song", expect.anything());
    });
  });

  it("shows semantic status indicator when ready", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "search_songs") return Promise.resolve([]);
      if (cmd === "get_song_semantic_status") return Promise.resolve({ ready: true, song_count: 42 });
      return Promise.resolve(undefined);
    });
    render(<SongLibrary />);
    await waitFor(() => {
      expect(screen.getByText("~42")).toBeInTheDocument();
    });
  });

  it("shows loading indicator when semantic index is not ready", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "search_songs") return Promise.resolve([]);
      if (cmd === "get_song_semantic_status") return Promise.resolve({ ready: false, song_count: 0 });
      return Promise.resolve(undefined);
    });
    render(<SongLibrary />);
    await waitFor(() => {
      expect(screen.getByText("…")).toBeInTheDocument();
    });
  });

  it("adds a new song via SongForm submission", async () => {
    const newSong = makeSong({ id: 2, title: "How Great Thou Art" });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "search_songs") return Promise.resolve([]);
      if (cmd === "get_song_semantic_status") return Promise.resolve({ ready: false, song_count: 0 });
      if (cmd === "add_song") return Promise.resolve(newSong);
      return Promise.resolve(undefined);
    });
    render(<SongLibrary />);
    fireEvent.click(screen.getByRole("button", { name: /\+ Add/i }));
    await waitFor(() => screen.getByLabelText(/title/i));

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "How Great Thou Art" } });
    fireEvent.change(screen.getByLabelText(/lyrics/i), { target: { value: "O Lord my God" } });
    fireEvent.click(screen.getByRole("button", { name: /add song/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("add_song", expect.objectContaining({ title: "How Great Thou Art" }));
    });
  });
});
