/**
 * ContentPanel — operator UI for Phase 12 content types:
 *   • Announcements (stored, keyword-cue triggered or manual push)
 *   • Custom slides (one-off immediate push)
 *   • Countdown timers
 *   • Sermon notes (speaker display, operator-advanced slides)
 */
import { useCallback, useEffect, useState } from "react";
import { invoke } from "../lib/tauri";
import type { AnnouncementItem, SermonNote } from "../lib/types";

// ─── Announcement library ─────────────────────────────────────────────────────

function AnnouncementLibrary() {
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: "",
    body: "",
    image_url: "",
    keyword_cue: "",
  });

  const load = useCallback(async () => {
    try {
      const list = await invoke<AnnouncementItem[]>("list_announcements");
      setItems(list);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    try {
      await invoke("create_announcement", {
        title: form.title.trim(),
        body: form.body.trim(),
        imageUrl: form.image_url.trim() || null,
        keywordCue: form.keyword_cue.trim() || null,
      });
      setForm({ title: "", body: "", image_url: "", keyword_cue: "" });
      setCreating(false);
      await load();
    } catch (e) {
      console.error("[ContentPanel] create_announcement failed:", e);
    }
  };

  const handlePush = async (id: string) => {
    try {
      await invoke("push_announcement_to_display", { id });
    } catch (e) {
      console.error("[ContentPanel] push_announcement_to_display failed:", e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await invoke("delete_announcement", { id });
      await load();
    } catch (e) {
      console.error("[ContentPanel] delete_announcement failed:", e);
    }
  };

  return (
    <div className="content-panel__section">
      <div className="content-panel__section-header">
        <span className="content-panel__section-title">Announcements</span>
        <button
          className="content-panel__add-btn"
          onClick={() => setCreating((v) => !v)}
          title={creating ? "Cancel" : "New announcement"}
        >
          {creating ? "✕" : "+"}
        </button>
      </div>

      {creating && (
        <div className="content-panel__form">
          <input
            className="content-panel__input"
            placeholder="Title *"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <textarea
            className="content-panel__textarea"
            placeholder="Body text"
            rows={3}
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          />
          <input
            className="content-panel__input"
            placeholder="Image URL (optional)"
            value={form.image_url}
            onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
          />
          <input
            className="content-panel__input"
            placeholder="Keyword cue (optional)"
            value={form.keyword_cue}
            onChange={(e) =>
              setForm((f) => ({ ...f, keyword_cue: e.target.value }))
            }
          />
          <div className="content-panel__form-actions">
            <button
              className="content-panel__btn content-panel__btn--primary"
              onClick={handleCreate}
              disabled={!form.title.trim()}
            >
              Save
            </button>
            <button
              className="content-panel__btn"
              onClick={() => setCreating(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && !creating && (
        <p className="content-panel__empty">No announcements yet</p>
      )}

      <ul className="content-panel__list">
        {items.map((item) => (
          <li key={item.id} className="content-panel__item">
            <div className="content-panel__item-info">
              <span className="content-panel__item-title">{item.title}</span>
              {item.keyword_cue && (
                <span className="content-panel__item-cue" title="Keyword cue">
                  ⌨ {item.keyword_cue}
                </span>
              )}
            </div>
            <div className="content-panel__item-actions">
              <button
                className="content-panel__btn content-panel__btn--push"
                onClick={() => void handlePush(item.id)}
                title="Push to display"
              >
                ▶
              </button>
              <button
                className="content-panel__btn content-panel__btn--delete"
                onClick={() => void handleDelete(item.id)}
                title="Delete"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Custom slide quick-push ──────────────────────────────────────────────────

function CustomSlidePanel() {
  const [form, setForm] = useState({ title: "", body: "", image_url: "" });
  const [busy, setBusy] = useState(false);

  const handlePush = async () => {
    if (!form.title.trim() && !form.body.trim()) return;
    setBusy(true);
    try {
      await invoke("push_custom_slide", {
        title: form.title.trim(),
        body: form.body.trim(),
        imageUrl: form.image_url.trim() || null,
      });
      setForm({ title: "", body: "", image_url: "" });
    } catch (e) {
      console.error("[ContentPanel] push_custom_slide failed:", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="content-panel__section">
      <div className="content-panel__section-header">
        <span className="content-panel__section-title">Custom Slide</span>
      </div>
      <div className="content-panel__form">
        <input
          className="content-panel__input"
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
        <textarea
          className="content-panel__textarea"
          placeholder="Body text"
          rows={2}
          value={form.body}
          onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
        />
        <input
          className="content-panel__input"
          placeholder="Image URL (optional)"
          value={form.image_url}
          onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
        />
        <button
          className="content-panel__btn content-panel__btn--primary"
          onClick={handlePush}
          disabled={busy || (!form.title.trim() && !form.body.trim())}
        >
          Push to Display
        </button>
      </div>
    </div>
  );
}

// ─── Countdown timer ──────────────────────────────────────────────────────────

function CountdownPanel() {
  const [title, setTitle] = useState("Starting Soon");
  const [minutes, setMinutes] = useState(5);
  const [busy, setBusy] = useState(false);

  const handleStart = async () => {
    setBusy(true);
    try {
      await invoke("start_countdown", {
        title: title.trim(),
        durationSecs: minutes * 60,
      });
    } catch (e) {
      console.error("[ContentPanel] start_countdown failed:", e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="content-panel__section">
      <div className="content-panel__section-header">
        <span className="content-panel__section-title">Countdown Timer</span>
      </div>
      <div className="content-panel__form content-panel__form--row">
        <input
          className="content-panel__input content-panel__input--flex"
          placeholder="Label"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="content-panel__input content-panel__input--mins"
          type="number"
          min={1}
          max={60}
          value={minutes}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v > 0) setMinutes(v);
          }}
          title="Minutes"
        />
        <span className="content-panel__mins-label">min</span>
        <button
          className="content-panel__btn content-panel__btn--primary"
          onClick={handleStart}
          disabled={busy}
        >
          ▶
        </button>
      </div>
    </div>
  );
}

// ─── Sermon notes ─────────────────────────────────────────────────────────────

function SermonNotesPanel() {
  const [notes, setNotes] = useState<SermonNote[]>([]);
  const [creating, setCreating] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [slidesText, setSlidesText] = useState("");
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [totalSlides, setTotalSlides] = useState(0);

  const load = useCallback(async () => {
    try {
      const list = await invoke<SermonNote[]>("list_sermon_notes");
      setNotes(list);
    } catch {
      // ignore
    }
  }, []);

  const loadActiveNote = useCallback(async () => {
    try {
      const result = await invoke<[SermonNote, number] | null>(
        "get_active_sermon_note"
      );
      if (result) {
        setActiveNoteId(result[0].id);
        setActiveSlide(result[1]);
        setTotalSlides(result[0].slides.length);
      } else {
        setActiveNoteId(null);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void load();
    void loadActiveNote();
  }, [load, loadActiveNote]);

  const handleCreate = async () => {
    if (!noteTitle.trim() || !slidesText.trim()) return;
    const slides = slidesText
      .split("\n---\n")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await invoke("create_sermon_note", {
        title: noteTitle.trim(),
        slides,
      });
      setNoteTitle("");
      setSlidesText("");
      setCreating(false);
      await load();
    } catch (e) {
      console.error("[ContentPanel] create_sermon_note failed:", e);
    }
  };

  const handlePush = async (id: string) => {
    try {
      await invoke("push_sermon_note", { id });
      await loadActiveNote();
    } catch (e) {
      console.error("[ContentPanel] push_sermon_note failed:", e);
    }
  };

  const handleAdvance = async () => {
    try {
      await invoke("advance_sermon_note");
      await loadActiveNote();
    } catch (e) {
      console.error("[ContentPanel] advance_sermon_note failed:", e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await invoke("delete_sermon_note", { id });
      await load();
      if (activeNoteId === id) setActiveNoteId(null);
    } catch (e) {
      console.error("[ContentPanel] delete_sermon_note failed:", e);
    }
  };

  return (
    <div className="content-panel__section">
      <div className="content-panel__section-header">
        <span className="content-panel__section-title">Sermon Notes</span>
        <button
          className="content-panel__add-btn"
          onClick={() => setCreating((v) => !v)}
          title={creating ? "Cancel" : "New sermon note deck"}
        >
          {creating ? "✕" : "+"}
        </button>
      </div>

      {activeNoteId && (
        <div className="content-panel__active-note">
          <span className="content-panel__active-note-label">
            Slide {activeSlide + 1} / {totalSlides}
          </span>
          <button
            className="content-panel__btn content-panel__btn--advance"
            onClick={handleAdvance}
            disabled={activeSlide + 1 >= totalSlides}
            title="Advance to next slide"
          >
            Next ▶
          </button>
        </div>
      )}

      {creating && (
        <div className="content-panel__form">
          <input
            className="content-panel__input"
            placeholder="Sermon title *"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
          />
          <textarea
            className="content-panel__textarea content-panel__textarea--tall"
            placeholder={"Slide 1 text\n---\nSlide 2 text\n---\nSlide 3 text"}
            rows={6}
            value={slidesText}
            onChange={(e) => setSlidesText(e.target.value)}
          />
          <p className="content-panel__hint">Separate slides with a line containing only ---</p>
          <div className="content-panel__form-actions">
            <button
              className="content-panel__btn content-panel__btn--primary"
              onClick={handleCreate}
              disabled={!noteTitle.trim() || !slidesText.trim()}
            >
              Save
            </button>
            <button
              className="content-panel__btn"
              onClick={() => setCreating(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {notes.length === 0 && !creating && (
        <p className="content-panel__empty">No sermon notes yet</p>
      )}

      <ul className="content-panel__list">
        {notes.map((note) => (
          <li
            key={note.id}
            className={`content-panel__item ${activeNoteId === note.id ? "content-panel__item--active" : ""}`}
          >
            <div className="content-panel__item-info">
              <span className="content-panel__item-title">{note.title}</span>
              <span className="content-panel__item-meta">
                {note.slides.length} slide{note.slides.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="content-panel__item-actions">
              <button
                className="content-panel__btn content-panel__btn--push"
                onClick={() => void handlePush(note.id)}
                title="Push to speaker display"
              >
                ▶
              </button>
              <button
                className="content-panel__btn content-panel__btn--delete"
                onClick={() => void handleDelete(note.id)}
                title="Delete"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export function ContentPanel() {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="content-panel">
      <div
        className="content-panel__header"
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setExpanded((v) => !v)}
      >
        <span className="content-panel__header-title">Content</span>
        <span className="content-panel__chevron">{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && (
        <div className="content-panel__body">
          <AnnouncementLibrary />
          <div className="content-panel__divider" />
          <CustomSlidePanel />
          <div className="content-panel__divider" />
          <CountdownPanel />
          <div className="content-panel__divider" />
          <SermonNotesPanel />
        </div>
      )}
    </div>
  );
}
