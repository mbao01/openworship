import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));
vi.mock("@/lib/tauri", () => ({ invoke: mockInvoke }));

import {
  searchScriptures,
  getBookChapters,
  getChapterVerses,
  listTranslations,
  getActiveTranslation,
  switchLiveTranslation,
  pushToDisplay,
  searchContentBank,
} from "./content";

describe("commands/content", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
  });

  it("searchScriptures passes query and translation", async () => {
    mockInvoke.mockResolvedValue([]);
    const result = await searchScriptures("John 3:16", "KJV");
    expect(mockInvoke).toHaveBeenCalledWith("search_scriptures", {
      query: "John 3:16",
      translation: "KJV",
    });
    expect(result).toEqual([]);
  });

  it("searchScriptures works without translation", async () => {
    mockInvoke.mockResolvedValue([]);
    await searchScriptures("love");
    expect(mockInvoke).toHaveBeenCalledWith("search_scriptures", {
      query: "love",
      translation: undefined,
    });
  });

  it("getBookChapters passes book name", async () => {
    mockInvoke.mockResolvedValue([1, 2, 3]);
    const result = await getBookChapters("John");
    expect(mockInvoke).toHaveBeenCalledWith("get_book_chapters", { book: "John" });
    expect(result).toEqual([1, 2, 3]);
  });

  it("getChapterVerses passes book and chapter", async () => {
    mockInvoke.mockResolvedValue([1, 2, 3, 4, 5]);
    const result = await getChapterVerses("John", 3);
    expect(mockInvoke).toHaveBeenCalledWith("get_chapter_verses", {
      book: "John",
      chapter: 3,
    });
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it("listTranslations invokes list_translations", async () => {
    mockInvoke.mockResolvedValue([{ id: "KJV", name: "King James", abbreviation: "KJV" }]);
    const result = await listTranslations();
    expect(mockInvoke).toHaveBeenCalledWith("list_translations");
    expect(result).toHaveLength(1);
  });

  it("getActiveTranslation invokes get_active_translation", async () => {
    mockInvoke.mockResolvedValue("KJV");
    const result = await getActiveTranslation();
    expect(mockInvoke).toHaveBeenCalledWith("get_active_translation");
    expect(result).toBe("KJV");
  });

  it("switchLiveTranslation passes translation", async () => {
    await switchLiveTranslation("NIV");
    expect(mockInvoke).toHaveBeenCalledWith("switch_live_translation", {
      translation: "NIV",
    });
  });

  it("pushToDisplay passes reference, text, translation", async () => {
    await pushToDisplay("John 3:16", "For God so loved...", "KJV");
    expect(mockInvoke).toHaveBeenCalledWith("push_to_display", {
      reference: "John 3:16",
      text: "For God so loved...",
      translation: "KJV",
    });
  });

  it("searchContentBank passes query", async () => {
    mockInvoke.mockResolvedValue([]);
    const result = await searchContentBank("grace");
    expect(mockInvoke).toHaveBeenCalledWith("search_content_bank", {
      query: "grace",
    });
    expect(result).toEqual([]);
  });
});
