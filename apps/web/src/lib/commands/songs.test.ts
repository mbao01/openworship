import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));
vi.mock("@/lib/tauri", () => ({ invoke: mockInvoke }));

import {
  listSongs,
  searchSongs,
  getSong,
  addSong,
  updateSong,
  deleteSong,
  importSongsCcli,
  importSongsOpenlp,
  pushSongToDisplay,
  getSongSemanticStatus,
} from "./songs";

const mockSong = {
  id: 1,
  title: "Sample Song",
  artist: "Sample Artist",
  source: null,
  ccli_number: null,
  lyrics: "Sample lyrics line",
  created_at_ms: 0,
};

describe("commands/songs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
  });

  it("listSongs invokes list_songs", async () => {
    mockInvoke.mockResolvedValue([mockSong]);
    const result = await listSongs();
    expect(mockInvoke).toHaveBeenCalledWith("list_songs");
    expect(result).toEqual([mockSong]);
  });

  it("searchSongs passes query", async () => {
    mockInvoke.mockResolvedValue([mockSong]);
    const result = await searchSongs("Amazing");
    expect(mockInvoke).toHaveBeenCalledWith("search_songs", { query: "Amazing" });
    expect(result).toEqual([mockSong]);
  });

  it("getSong passes id", async () => {
    mockInvoke.mockResolvedValue(mockSong);
    const result = await getSong(1);
    expect(mockInvoke).toHaveBeenCalledWith("get_song", { id: 1 });
    expect(result).toEqual(mockSong);
  });

  it("getSong returns null when not found", async () => {
    mockInvoke.mockResolvedValue(null);
    const result = await getSong(999);
    expect(result).toBeNull();
  });

  it("addSong passes title, artist, lyrics", async () => {
    mockInvoke.mockResolvedValue(mockSong);
    const result = await addSong("Sample Song", "Sample Artist", "Sample lyrics...");
    expect(mockInvoke).toHaveBeenCalledWith("add_song", {
      title: "Sample Song",
      artist: "Sample Artist",
      lyrics: "Sample lyrics...",
    });
    expect(result).toEqual(mockSong);
  });

  it("addSong works with null artist", async () => {
    mockInvoke.mockResolvedValue(mockSong);
    await addSong("Untitled", null, "lyrics");
    expect(mockInvoke).toHaveBeenCalledWith("add_song", {
      title: "Untitled",
      artist: null,
      lyrics: "lyrics",
    });
  });

  it("updateSong passes id, title, artist, lyrics", async () => {
    await updateSong(1, "Sample Song (Updated)", "Sample Artist", "Updated lyrics...");
    expect(mockInvoke).toHaveBeenCalledWith("update_song", {
      id: 1,
      title: "Sample Song (Updated)",
      artist: "Sample Artist",
      lyrics: "Updated lyrics...",
    });
  });

  it("deleteSong passes id", async () => {
    await deleteSong(1);
    expect(mockInvoke).toHaveBeenCalledWith("delete_song", { id: 1 });
  });

  it("importSongsCcli passes text", async () => {
    mockInvoke.mockResolvedValue([mockSong]);
    const result = await importSongsCcli("CCLI export text...");
    expect(mockInvoke).toHaveBeenCalledWith("import_songs_ccli", { text: "CCLI export text..." });
    expect(result).toEqual([mockSong]);
  });

  it("importSongsOpenlp passes xml", async () => {
    mockInvoke.mockResolvedValue([mockSong]);
    const result = await importSongsOpenlp("<songs>...</songs>");
    expect(mockInvoke).toHaveBeenCalledWith("import_songs_openlp", { xml: "<songs>...</songs>" });
    expect(result).toEqual([mockSong]);
  });

  it("pushSongToDisplay passes id", async () => {
    await pushSongToDisplay(1);
    expect(mockInvoke).toHaveBeenCalledWith("push_song_to_display", { id: 1 });
  });

  it("getSongSemanticStatus invokes get_song_semantic_status", async () => {
    const status = { ready: true, song_count: 42 };
    mockInvoke.mockResolvedValue(status);
    const result = await getSongSemanticStatus();
    expect(mockInvoke).toHaveBeenCalledWith("get_song_semantic_status");
    expect(result).toEqual(status);
  });
});
