/**
 * ContentPanel — operator UI for Phase 12 content types:
 *   • Announcements (stored, keyword-cue triggered or manual push)
 *   • Custom slides (one-off immediate push)
 *   • Countdown timers
 *   • Sermon notes (speaker display, operator-advanced slides)
 */
import { useCallback, useEffect, useState } from "react";
import { invoke } from "../lib/tauri";
import { toastError } from "../lib/toast";
import type { AnnouncementItem, SermonNote } from "../lib/types";

// Shared classes
const inputCls = "w-full bg-void border-none border-b border-b-[rgba(42,42,42,0.8)] text-chalk font-sans text-xs py-2 px-0 outline-none transition-colors focus:border-b-gold";
const textareaCls = "w-full box-sizing-border bg-void border border-[rgba(42,42,42,0.8)] rounded-[3px] text-chalk font-sans text-xs p-2 resize-y outline-none transition-colors focus:border-gold";
const btnBaseCls = "bg-none border border-[rgba(42,42,42,0.8)] text-ash rounded-[3px] text-[11px] font-sans py-1 px-3 cursor-pointer transition-colors disabled:opacity-35 disabled:cursor-not-allowed hover:not-disabled:text-chalk hover:not-disabled:border-ash";
const btnPrimaryCls = "bg-none border border-gold text-gold rounded-[3px] text-[11px] font-sans py-1 px-3 cursor-pointer transition-all disabled:opacity-35 disabled:cursor-not-allowed hover:not-disabled:bg-gold hover:not-disabled:text-void";
const sectionTitleCls = "text-[10px] font-semibold tracking-[0.14em] uppercase text-ash";

type AnnForm = { title: string; body: string; image_url: string; keyword_cue: string };
const emptyForm = (): AnnForm => ({ title: "", body: "", image_url: "", keyword_cue: "" });
const itemToForm = (item: AnnouncementItem): AnnForm => ({
  title: item.title,
  body: item.body ?? "",
  image_url: item.image_url ?? "",
  keyword_cue: item.keyword_cue ?? "",
});

// ─── Announcement library ─────────────────────────────────────────────────────

function AnnouncementLibrary() {
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AnnForm>(emptyForm());
  const [editForm, setEditForm] = useState<AnnForm>(emptyForm());

  const load = useCallback(async () => {
    try {
      const list = await invoke<AnnouncementItem[]>("list_announcements");
      setItems(list);
    } catch {
      // silently ignore load failures — non-critical on startup
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    try {
      await invoke("create_announcement", {
        title: form.title.trim(),
        body: form.body.trim(),
        imageUrl: form.image_url.trim() || null,
        keywordCue: form.keyword_cue.trim() || null,
      });
      setForm(emptyForm());
      setCreating(false);
      await load();
    } catch (e) {
      toastError("Failed to create announcement")(e);
    }
  };

  const startEdit = (item: AnnouncementItem) => {
    setEditingId(item.id);
    setEditForm(itemToForm(item));
    setCreating(false);
  };

  const handleUpdate = async () => {
    if (!editingId || !editForm.title.trim()) return;
    try {
      await invoke("update_announcement", {
        id: editingId,
        title: editForm.title.trim(),
        body: editForm.body.trim(),
        imageUrl: editForm.image_url.trim() || null,
        keywordCue: editForm.keyword_cue.trim() || null,
      });
      setEditingId(null);
      await load();
    } catch (e) {
      toastError("Failed to update announcement")(e);
    }
  };

  const handlePush = async (id: string) => {
    try {
      await invoke("push_announcement_to_display", { id });
    } catch (e) {
      toastError("Failed to push announcement")(e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await invoke("delete_announcement", { id });
      if (editingId === id) setEditingId(null);
      await load();
    } catch (e) {
      toastError("Failed to delete announcement")(e);
    }
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className={sectionTitleCls}>Announcements</span>
        <button
          className="bg-none border border-[rgba(42,42,42,0.8)] text-ash rounded-[3px] w-5 h-5 text-sm leading-none cursor-pointer flex items-center justify-center p-0 hover:text-chalk hover:border-ash"
          onClick={() => { setCreating((v) => !v); setEditingId(null); }}
          title={creating ? "Cancel" : "New announcement"}
        >
          {creating ? "✕" : "+"}
        </button>
      </div>

      {creating && (
        <div className="flex flex-col gap-2 mb-3">
          <input className={inputCls} placeholder="Title *" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <textarea className={textareaCls} placeholder="Body text" rows={3} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
          <input className={inputCls} placeholder="Image URL (optional)" value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} />
          <input
            className={inputCls}
            placeholder="Keyword cue — auto-triggers when spoken (optional)"
            value={form.keyword_cue}
            onChange={(e) => setForm((f) => ({ ...f, keyword_cue: e.target.value }))}
          />
          <div className="flex gap-2">
            <button className={btnPrimaryCls} onClick={handleCreate} disabled={!form.title.trim()}>Save</button>
            <button className={btnBaseCls} onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </div>
      )}

      {items.length === 0 && !creating && (
        <p className="text-[11px] text-smoke my-2 mx-0">No announcements yet</p>
      )}

      <ul className="list-none m-0 p-0 flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col rounded-[3px] bg-void">
            {editingId === item.id ? (
              <div className="flex flex-col gap-2 p-2">
                <input className={inputCls} placeholder="Title *" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
                <textarea className={textareaCls} placeholder="Body text" rows={2} value={editForm.body} onChange={(e) => setEditForm((f) => ({ ...f, body: e.target.value }))} />
                <input className={inputCls} placeholder="Image URL (optional)" value={editForm.image_url} onChange={(e) => setEditForm((f) => ({ ...f, image_url: e.target.value }))} />
                <input
                  className={inputCls}
                  placeholder="Keyword cue (optional)"
                  value={editForm.keyword_cue}
                  onChange={(e) => setEditForm((f) => ({ ...f, keyword_cue: e.target.value }))}
                />
                <div className="flex gap-2">
                  <button className={btnPrimaryCls} onClick={handleUpdate} disabled={!editForm.title.trim()}>Save</button>
                  <button className={btnBaseCls} onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 py-2 px-2">
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="text-xs text-chalk whitespace-nowrap overflow-hidden text-ellipsis">{item.title}</span>
                  {item.keyword_cue ? (
                    <span className="text-[10px] text-gold/70" title="Auto-triggers when this phrase is spoken">⌨ {item.keyword_cue}</span>
                  ) : null}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    className="bg-none border-none border-transparent text-ash px-2 py-0 rounded-[3px] text-[11px] font-sans cursor-pointer transition-colors hover:text-gold"
                    onClick={() => void handlePush(item.id)}
                    title="Push to display"
                  >
                    ▶
                  </button>
                  <button
                    className="bg-none border-none border-transparent text-ash px-2 py-0 rounded-[3px] text-[10px] font-sans cursor-pointer transition-colors hover:text-chalk"
                    onClick={() => startEdit(item)}
                    title="Edit"
                  >
                    ✎
                  </button>
                  <button
                    className="bg-none border-none border-transparent text-smoke px-2 py-0 rounded-[3px] text-[10px] font-sans cursor-pointer transition-colors hover:text-ember"
                    onClick={() => void handleDelete(item.id)}
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
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
      toastError("Failed to push custom slide")(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className={sectionTitleCls}>Custom Slide</span>
      </div>
      <div className="flex flex-col gap-2 mb-3">
        <input className={inputCls} placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        <textarea className={textareaCls} placeholder="Body text" rows={2} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
        <input className={inputCls} placeholder="Image URL (optional)" value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} />
        <button
          className={btnPrimaryCls}
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
      toastError("Failed to start countdown")(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className={sectionTitleCls}>Countdown Timer</span>
      </div>
      <div className="flex flex-row items-center gap-2 mb-3">
        <input
          className={`${inputCls} flex-1`}
          placeholder="Label"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="w-[44px] bg-void border-none border-b border-b-[rgba(42,42,42,0.8)] text-chalk font-sans text-xs py-2 px-0 outline-none text-center transition-colors focus:border-b-gold"
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
        <span className="text-[11px] text-ash">min</span>
        <button className={btnPrimaryCls} onClick={handleStart} disabled={busy}>▶</button>
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
      const result = await invoke<[SermonNote, number] | null>("get_active_sermon_note");
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
    const slides = slidesText.split("\n---\n").map((s) => s.trim()).filter(Boolean);
    try {
      await invoke("create_sermon_note", { title: noteTitle.trim(), slides });
      setNoteTitle("");
      setSlidesText("");
      setCreating(false);
      await load();
    } catch (e) {
      toastError("Failed to create sermon note")(e);
    }
  };

  const handlePush = async (id: string) => {
    try {
      await invoke("push_sermon_note", { id });
      await loadActiveNote();
    } catch (e) {
      toastError("Failed to push sermon note")(e);
    }
  };

  const handleAdvance = async () => {
    try {
      await invoke("advance_sermon_note");
      await loadActiveNote();
    } catch (e) {
      toastError("Failed to advance slide")(e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await invoke("delete_sermon_note", { id });
      await load();
      if (activeNoteId === id) setActiveNoteId(null);
    } catch (e) {
      toastError("Failed to delete sermon note")(e);
    }
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className={sectionTitleCls}>Sermon Notes</span>
        <button
          className="bg-none border border-[rgba(42,42,42,0.8)] text-ash rounded-[3px] w-5 h-5 text-sm leading-none cursor-pointer flex items-center justify-center p-0 hover:text-chalk hover:border-ash"
          onClick={() => setCreating((v) => !v)}
          title={creating ? "Cancel" : "New sermon note deck"}
        >
          {creating ? "✕" : "+"}
        </button>
      </div>

      {activeNoteId && (
        <div className="flex items-center justify-between py-2 px-3 bg-[rgba(201,168,76,0.08)] border border-[rgba(201,168,76,0.25)] rounded-[3px] mb-3">
          <span className="font-mono text-[11px] text-gold">
            Slide {activeSlide + 1} / {totalSlides}
          </span>
          <button
            className="bg-none border border-gold text-gold rounded-[3px] text-[11px] font-sans py-1 px-3 cursor-pointer transition-all disabled:opacity-35 disabled:cursor-not-allowed hover:not-disabled:bg-gold hover:not-disabled:text-void"
            onClick={handleAdvance}
            disabled={activeSlide + 1 >= totalSlides}
            title="Advance to next slide"
          >
            Next ▶
          </button>
        </div>
      )}

      {creating && (
        <div className="flex flex-col gap-2 mb-3">
          <input className={inputCls} placeholder="Sermon title *" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} />
          <textarea
            className={`${textareaCls} min-h-[100px]`}
            placeholder={"Slide 1 text\n---\nSlide 2 text\n---\nSlide 3 text"}
            rows={6}
            value={slidesText}
            onChange={(e) => setSlidesText(e.target.value)}
          />
          <p className="text-[10px] text-smoke m-0">Separate slides with a line containing only ---</p>
          <div className="flex gap-2">
            <button className={btnPrimaryCls} onClick={handleCreate} disabled={!noteTitle.trim() || !slidesText.trim()}>Save</button>
            <button className={btnBaseCls} onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </div>
      )}

      {notes.length === 0 && !creating && (
        <p className="text-[11px] text-smoke my-2 mx-0">No sermon notes yet</p>
      )}

      <ul className="list-none m-0 p-0 flex flex-col gap-1">
        {notes.map((note) => (
          <li
            key={note.id}
            className={`flex items-center gap-2 py-2 px-2 rounded-[3px] bg-void${activeNoteId === note.id ? " border-l-2 border-l-gold pl-[calc(0.5rem-2px)]" : ""}`}
          >
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="text-xs text-chalk whitespace-nowrap overflow-hidden text-ellipsis">{note.title}</span>
              <span className="text-[10px] text-smoke">
                {note.slides.length} slide{note.slides.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                className="bg-none border-none border-transparent text-ash px-2 py-0 rounded-[3px] text-[11px] font-sans cursor-pointer transition-colors hover:text-gold"
                onClick={() => void handlePush(note.id)}
                title="Push to speaker display"
              >
                ▶
              </button>
              <button
                className="bg-none border-none border-transparent text-smoke px-2 py-0 rounded-[3px] text-[10px] font-sans cursor-pointer transition-colors hover:text-ember"
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
    <div className="bg-obsidian border border-iron/40 rounded overflow-hidden shrink-0">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none border-b border-iron/40 hover:bg-slate"
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setExpanded((v) => !v)}
      >
        <span className="text-[11px] font-semibold tracking-[0.16em] uppercase text-ash">Content</span>
        <span className="text-[9px] text-smoke">{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div className="flex flex-col max-h-[480px] overflow-y-auto">
          <AnnouncementLibrary />
          <div className="h-px bg-[rgba(42,42,42,0.6)] mx-4" />
          <CustomSlidePanel />
          <div className="h-px bg-[rgba(42,42,42,0.6)] mx-4" />
          <CountdownPanel />
          <div className="h-px bg-[rgba(42,42,42,0.6)] mx-4" />
          <SermonNotesPanel />
        </div>
      )}
    </div>
  );
}
