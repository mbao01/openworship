import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "../lib/tauri";
import type { Song, SongSemanticStatus } from "../lib/types";

// Shared input/textarea classes
const inputCls = "w-full box-border bg-void border border-iron rounded-[3px] text-chalk font-sans text-xs py-2 px-3 outline-none transition-colors placeholder:text-iron focus:border-smoke disabled:opacity-50";
const textareaCls = `${inputCls} resize-y`;

// Shared button classes
const btnBaseCls = "font-sans text-[11px] tracking-[0.06em] py-1 px-3 rounded-[3px] border border-iron bg-transparent text-ash cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
const btnCancelCls = `${btnBaseCls} hover:border-smoke hover:text-chalk`;
const btnSaveCls = `${btnBaseCls} border-gold-muted text-gold hover:border-gold`;

// ─── Add / Edit Song form ─────────────────────────────────────────────────────

function SongForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Song;
  onSave: (song: Song) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [artist, setArtist] = useState(initial?.artist ?? "");
  const [lyrics, setLyrics] = useState(initial?.lyrics ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    const l = lyrics.trim();
    if (!t || !l) return;
    setSaving(true);
    setError(null);
    try {
      let song: Song;
      if (initial) {
        await invoke("update_song", {
          id: initial.id,
          title: t,
          artist: artist.trim() || null,
          lyrics: l,
        });
        song = { ...initial, title: t, artist: artist.trim() || null, lyrics: l };
      } else {
        song = await invoke<Song>("add_song", {
          title: t,
          artist: artist.trim() || null,
          lyrics: l,
        });
      }
      onSave(song);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-medium tracking-[0.08em] text-ash uppercase" htmlFor="song-title">
          Title
        </label>
        <input
          ref={titleRef}
          id="song-title"
          className={inputCls}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Amazing Grace"
          required
          disabled={saving}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-medium tracking-[0.08em] text-ash uppercase" htmlFor="song-artist">
          Artist / Author
        </label>
        <input
          id="song-artist"
          className={inputCls}
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          placeholder="John Newton"
          disabled={saving}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-medium tracking-[0.08em] text-ash uppercase" htmlFor="song-lyrics">
          Lyrics
        </label>
        <textarea
          id="song-lyrics"
          className={`${textareaCls} text-[11px] leading-[1.5]`}
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          placeholder={"[Verse 1]\nAmazing grace how sweet the sound\nThat saved a wretch like me\n\n[Chorus]\nMy chains are gone\u2026"}
          rows={10}
          required
          disabled={saving}
        />
      </div>
      {error && <p className="text-[11px] text-[#e66] m-0">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className={btnCancelCls}
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="submit"
          className={btnSaveCls}
          disabled={saving || !title.trim() || !lyrics.trim()}
        >
          {saving ? "Saving\u2026" : initial ? "Update" : "Add Song"}
        </button>
      </div>
    </form>
  );
}

// ─── Import modal ─────────────────────────────────────────────────────────────

type ImportFormat = "ccli" | "openlp";

function ImportForm({
  onImported,
  onCancel,
}: {
  onImported: (songs: Song[]) => void;
  onCancel: () => void;
}) {
  const [format, setFormat] = useState<ImportFormat>("ccli");
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (typeof content === "string") setText(content);
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-selected if needed.
    e.target.value = "";
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setImporting(true);
    setError(null);
    try {
      let songs: Song[];
      if (format === "ccli") {
        songs = await invoke<Song[]>("import_songs_ccli", { text });
      } else {
        songs = await invoke<Song[]>("import_songs_openlp", { xml: text });
      }
      onImported(songs);
    } catch (err) {
      setError(String(err));
    } finally {
      setImporting(false);
    }
  };

  const accept = format === "ccli" ? ".txt,.csv" : ".xml";

  return (
    <form className="flex flex-col gap-3" onSubmit={handleImport}>
      <div className="flex gap-4 text-[11px] text-ash">
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            name="import-format"
            value="ccli"
            checked={format === "ccli"}
            onChange={() => setFormat("ccli")}
          />{" "}
          CCLI SongSelect (text)
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            name="import-format"
            value="openlp"
            checked={format === "openlp"}
            onChange={() => setFormat("openlp")}
          />{" "}
          OpenLP XML
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="font-sans text-[10px] tracking-[0.06em] py-0.5 px-2 border border-iron rounded-[3px] bg-transparent text-ash cursor-pointer transition-colors hover:border-smoke hover:text-chalk disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          title="Load from file"
        >
          Load from file
        </button>
        <span className="text-[10px] text-iron">or paste below</span>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleFileLoad}
          disabled={importing}
        />
      </div>
      <textarea
        className="w-full box-border bg-void border border-iron rounded-[3px] text-chalk font-mono text-[10px] py-2 px-3 outline-none resize-y transition-colors placeholder:text-iron focus:border-smoke disabled:opacity-50"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          format === "ccli"
            ? "Paste CCLI SongSelect text export here\u2026"
            : "Paste OpenLP XML song export here\u2026"
        }
        rows={12}
        disabled={importing}
        autoFocus
      />
      {error && <p className="text-[11px] text-[#e66] m-0">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className={btnCancelCls}
          onClick={onCancel}
          disabled={importing}
        >
          Cancel
        </button>
        <button
          type="submit"
          className={btnSaveCls}
          disabled={importing || !text.trim()}
        >
          {importing ? "Importing\u2026" : "Import"}
        </button>
      </div>
    </form>
  );
}

// ─── Song row ─────────────────────────────────────────────────────────────────

function SongRow({
  song,
  onPush,
  onEdit,
  onDelete,
  pushed,
}: {
  song: Song;
  onPush: (s: Song) => void;
  onEdit: (s: Song) => void;
  onDelete: (s: Song) => void;
  pushed: boolean;
}) {
  return (
    <li
      className={`flex items-center justify-between py-2 px-3 rounded-[3px] border cursor-pointer transition-all gap-2${
        pushed
          ? " border-l-2 border-l-gold border-iron bg-slate"
          : " border-transparent hover:bg-slate hover:border-iron focus-visible:bg-slate focus-visible:border-iron focus-visible:outline-none"
      }`}
      role="button"
      tabIndex={0}
      onClick={() => onPush(song)}
      onKeyDown={(e) => e.key === "Enter" && onPush(song)}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-xs text-chalk whitespace-nowrap overflow-hidden text-ellipsis">{song.title}</span>
        {song.artist && (
          <span className="text-[10px] text-ash whitespace-nowrap overflow-hidden text-ellipsis">{song.artist}</span>
        )}
        {pushed && (
          <span
            className="w-[5px] h-[5px] rounded-full bg-gold [box-shadow:0_0_3px_var(--color-gold)] shrink-0"
            aria-label="Live"
          />
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          className="font-sans text-xs leading-none w-[22px] h-[22px] border border-iron rounded-[2px] bg-transparent text-ash cursor-pointer flex items-center justify-center transition-colors hover:border-smoke hover:text-chalk"
          title="Edit"
          aria-label={`Edit ${song.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onEdit(song);
          }}
        >
          ✎
        </button>
        <button
          className="font-sans text-xs leading-none w-[22px] h-[22px] border border-iron rounded-[2px] bg-transparent text-ash cursor-pointer flex items-center justify-center transition-colors hover:border-[#a44] hover:text-[#e66]"
          title="Delete"
          aria-label={`Delete ${song.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(song);
          }}
        >
          ×
        </button>
      </div>
    </li>
  );
}

// ─── Main SongLibrary component ───────────────────────────────────────────────

export function SongLibrary() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"list" | "add" | "edit" | "import">("list");
  const [editTarget, setEditTarget] = useState<Song | null>(null);
  const [pushed, setPushed] = useState<number | null>(null);
  const [semanticStatus, setSemanticStatus] = useState<SongSemanticStatus | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll semantic index status until it is ready, then stop.
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const status = await invoke<SongSemanticStatus>("get_song_semantic_status");
        if (cancelled) return;
        setSemanticStatus(status);
        if (status.ready && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch {
        // ignore — semantic index is optional
      }
    };
    void check();
    pollRef.current = setInterval(check, 3000);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const loadSongs = useCallback(async (q = "") => {
    try {
      const results = await invoke<Song[]>("search_songs", { query: q, limit: 100 });
      setSongs(results);
    } catch {
      setSongs([]);
    }
  }, []);

  useEffect(() => {
    loadSongs();
  }, [loadSongs]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadSongs(val), 220);
  };

  const handlePush = async (song: Song) => {
    try {
      await invoke("push_song_to_display", { id: song.id });
      setPushed(song.id);
      setTimeout(() => setPushed(null), 3000);
    } catch {
      // ignore
    }
  };

  const handleDelete = async (song: Song) => {
    if (!window.confirm(`Delete "${song.title}"?`)) return;
    try {
      await invoke("delete_song", { id: song.id });
      setSongs((prev) => prev.filter((s) => s.id !== song.id));
    } catch {
      // ignore
    }
  };

  const handleSaved = (song: Song) => {
    setSongs((prev) => {
      const idx = prev.findIndex((s) => s.id === song.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = song;
        return next;
      }
      return [song, ...prev];
    });
    setMode("list");
    setEditTarget(null);
  };

  const handleImported = (imported: Song[]) => {
    if (imported.length > 0) {
      setSongs((prev) => [...imported, ...prev]);
    }
    setMode("list");
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium tracking-[0.12em] text-ash uppercase">SONGS</span>
          {semanticStatus && (
            <span
              className={`text-[9px] font-medium tracking-[0.08em] uppercase ${
                semanticStatus.ready ? "text-gold/70" : "text-smoke"
              }`}
              title={
                semanticStatus.ready
                  ? `Semantic matching active — ${semanticStatus.song_count} song${semanticStatus.song_count !== 1 ? "s" : ""} indexed`
                  : "Building semantic index…"
              }
            >
              {semanticStatus.ready ? `~${semanticStatus.song_count}` : "…"}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            data-qa="song-library-import-btn"
            className="font-sans text-[10px] tracking-[0.06em] py-0.5 px-2 border border-iron rounded-[3px] bg-transparent text-ash cursor-pointer transition-colors hover:border-smoke hover:text-chalk"
            onClick={() => setMode("import")}
            title="Import CCLI / OpenLP"
          >
            Import
          </button>
          <button
            data-qa="song-library-add-btn"
            className="font-sans text-[10px] tracking-[0.06em] py-0.5 px-2 border border-gold-muted rounded-[3px] bg-transparent text-gold cursor-pointer transition-colors hover:border-gold"
            onClick={() => {
              setEditTarget(null);
              setMode("add");
            }}
            title="Add song manually"
          >
            + Add
          </button>
        </div>
      </div>


      {mode === "add" && (
        <SongForm
          onSave={handleSaved}
          onCancel={() => setMode("list")}
        />
      )}
      {mode === "edit" && editTarget && (
        <SongForm
          initial={editTarget}
          onSave={handleSaved}
          onCancel={() => {
            setMode("list");
            setEditTarget(null);
          }}
        />
      )}
      {mode === "import" && (
        <ImportForm
          onImported={handleImported}
          onCancel={() => setMode("list")}
        />
      )}

      {mode === "list" && (
        <>
          <div className="relative">
            <input
              data-qa="song-library-search"
              className="w-full box-border bg-void border border-iron rounded-[3px] text-chalk font-sans text-xs py-2 px-3 outline-none transition-colors placeholder:text-iron focus:border-smoke"
              type="text"
              placeholder="Search songs\u2026"
              value={query}
              onChange={handleQueryChange}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          {songs.length === 0 ? (
            <p className="text-[11px] text-smoke m-0">
              {query ? `No songs matching "${query}"` : "No songs yet. Add or import some!"}
            </p>
          ) : (
            <ul className="list-none m-0 p-0 flex flex-col gap-0.5" role="list">
              {songs.map((s) => (
                <SongRow
                  key={s.id}
                  song={s}
                  pushed={pushed === s.id}
                  onPush={handlePush}
                  onEdit={(song) => {
                    setEditTarget(song);
                    setMode("edit");
                  }}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
