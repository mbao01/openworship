import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));
vi.mock("@/lib/tauri", () => ({ invoke: mockInvoke }));

import {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  pushAnnouncementToDisplay,
  importPptxSlides,
  importPdfSlides,
  pushCustomSlide,
  startCountdown,
  listSermonNotes,
  createSermonNote,
  updateSermonNote,
  deleteSermonNote,
  pushSermonNote,
  advanceSermonNote,
  rewindSermonNote,
  getActiveSermonNote,
} from "./annotations";

const mockAnnouncement = { id: "a1", title: "Welcome", body: "Welcome to church!" };
const mockSermonNote = { id: "s1", title: "Grace", slides: ["Slide 1", "Slide 2"] };

describe("commands/annotations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
  });

  describe("announcements", () => {
    it("listAnnouncements invokes list_announcements", async () => {
      mockInvoke.mockResolvedValue([mockAnnouncement]);
      const result = await listAnnouncements();
      expect(mockInvoke).toHaveBeenCalledWith("list_announcements");
      expect(result).toEqual([mockAnnouncement]);
    });

    it("createAnnouncement passes all fields", async () => {
      mockInvoke.mockResolvedValue(mockAnnouncement);
      const result = await createAnnouncement("Welcome", "Welcome to church!", "/img.png", "welcome");
      expect(mockInvoke).toHaveBeenCalledWith("create_announcement", {
        title: "Welcome",
        body: "Welcome to church!",
        imageUrl: "/img.png",
        keywordCue: "welcome",
      });
      expect(result).toEqual(mockAnnouncement);
    });

    it("createAnnouncement works with optional fields omitted", async () => {
      mockInvoke.mockResolvedValue(mockAnnouncement);
      await createAnnouncement("Welcome", "Welcome to church!");
      expect(mockInvoke).toHaveBeenCalledWith("create_announcement", {
        title: "Welcome",
        body: "Welcome to church!",
        imageUrl: undefined,
        keywordCue: undefined,
      });
    });

    it("updateAnnouncement passes all fields", async () => {
      await updateAnnouncement("a1", "Updated Title", "Updated body", "/new-img.png");
      expect(mockInvoke).toHaveBeenCalledWith("update_announcement", {
        id: "a1",
        title: "Updated Title",
        body: "Updated body",
        imageUrl: "/new-img.png",
      });
    });

    it("deleteAnnouncement passes id", async () => {
      await deleteAnnouncement("a1");
      expect(mockInvoke).toHaveBeenCalledWith("delete_announcement", { id: "a1" });
    });

    it("pushAnnouncementToDisplay passes id", async () => {
      await pushAnnouncementToDisplay("a1");
      expect(mockInvoke).toHaveBeenCalledWith("push_announcement_to_display", { id: "a1" });
    });

    it("pushCustomSlide passes title, body, imageUrl", async () => {
      await pushCustomSlide("My Slide", "Body text", "/image.png");
      expect(mockInvoke).toHaveBeenCalledWith("push_custom_slide", {
        title: "My Slide",
        body: "Body text",
        imageUrl: "/image.png",
      });
    });

    it("pushCustomSlide uses empty string for undefined body", async () => {
      await pushCustomSlide("My Slide");
      expect(mockInvoke).toHaveBeenCalledWith("push_custom_slide", {
        title: "My Slide",
        body: "",
        imageUrl: undefined,
      });
    });

    it("startCountdown passes durationSecs", async () => {
      await startCountdown(300);
      expect(mockInvoke).toHaveBeenCalledWith("start_countdown", { durationSecs: 300 });
    });

    it("importPptxSlides invokes import_pptx_slides with path", async () => {
      const slides = [{ id: "s1", title: "Slide 1", body: "" }];
      mockInvoke.mockResolvedValue(slides);
      const result = await importPptxSlides("/path/to/deck.pptx");
      expect(mockInvoke).toHaveBeenCalledWith("import_pptx_slides", { path: "/path/to/deck.pptx" });
      expect(result).toEqual(slides);
    });

    it("importPdfSlides invokes import_pdf_slides with path", async () => {
      const slides = [{ id: "p1", title: "Page 1", body: "content" }];
      mockInvoke.mockResolvedValue(slides);
      const result = await importPdfSlides("/path/to/document.pdf");
      expect(mockInvoke).toHaveBeenCalledWith("import_pdf_slides", { path: "/path/to/document.pdf" });
      expect(result).toEqual(slides);
    });
  });

  describe("sermon notes", () => {
    it("listSermonNotes invokes list_sermon_notes", async () => {
      mockInvoke.mockResolvedValue([mockSermonNote]);
      const result = await listSermonNotes();
      expect(mockInvoke).toHaveBeenCalledWith("list_sermon_notes");
      expect(result).toEqual([mockSermonNote]);
    });

    it("createSermonNote passes title and slides", async () => {
      mockInvoke.mockResolvedValue(mockSermonNote);
      const result = await createSermonNote("Grace", ["Slide 1", "Slide 2"]);
      expect(mockInvoke).toHaveBeenCalledWith("create_sermon_note", {
        title: "Grace",
        slides: ["Slide 1", "Slide 2"],
      });
      expect(result).toEqual(mockSermonNote);
    });

    it("updateSermonNote passes id, title, slides", async () => {
      await updateSermonNote("s1", "Grace (Updated)", ["New Slide 1"]);
      expect(mockInvoke).toHaveBeenCalledWith("update_sermon_note", {
        id: "s1",
        title: "Grace (Updated)",
        slides: ["New Slide 1"],
      });
    });

    it("deleteSermonNote passes id", async () => {
      await deleteSermonNote("s1");
      expect(mockInvoke).toHaveBeenCalledWith("delete_sermon_note", { id: "s1" });
    });

    it("pushSermonNote passes id", async () => {
      await pushSermonNote("s1");
      expect(mockInvoke).toHaveBeenCalledWith("push_sermon_note", { id: "s1" });
    });

    it("advanceSermonNote invokes advance_sermon_note", async () => {
      await advanceSermonNote();
      expect(mockInvoke).toHaveBeenCalledWith("advance_sermon_note");
    });

    it("rewindSermonNote invokes rewind_sermon_note", async () => {
      await rewindSermonNote();
      expect(mockInvoke).toHaveBeenCalledWith("rewind_sermon_note");
    });

    it("getActiveSermonNote returns current note", async () => {
      mockInvoke.mockResolvedValue(mockSermonNote);
      const result = await getActiveSermonNote();
      expect(mockInvoke).toHaveBeenCalledWith("get_active_sermon_note");
      expect(result).toEqual(mockSermonNote);
    });

    it("getActiveSermonNote returns null when none active", async () => {
      mockInvoke.mockResolvedValue(null);
      const result = await getActiveSermonNote();
      expect(result).toBeNull();
    });
  });
});
