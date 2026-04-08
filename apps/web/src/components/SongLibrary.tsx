import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "../lib/tauri";
import type { Song } from "../lib/types";

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
    <form className="song-form" onSubmit={handleSubmit}>
      <div className="song-form__field">
        <label className="song-form__label" htmlFor="song-title">
          Title
        </label>
        <input
          ref={titleRef}
          id="song-title"
          className="song-form__input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Amazing Grace"
          required
          disabled={saving}
        />
      </div>
      <div className="song-form__field">
        <label className="song-form__label" htmlFor="song-artist">
          Artist / Author
        </label>
        <input
          id="song-artist"
          className="song-form__input"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          placeholder="John Newton"
          disabled={saving}
        />
      </div>
      <div className="song-form__field">
        <label className="song-form__label" htmlFor="song-lyrics">
          Lyrics
        </label>
        <textarea
          id="song-lyrics"
          className="song-form__textarea"
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          placeholder={"[Verse 1]\nAmazing grace how sweet the sound\nThat saved a wretch like me\n\n[Chorus]\nMy chains are gone…"}
          rows={10}
          required
          disabled={saving}
        />
      </div>
      {error && <p className="song-form__error">{error}</p>}
      <div className="song-form__actions">
        <button
          type="button"
          className="song-form__btn song-form__btn--cancel"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="song-form__btn song-form__btn--save"
          disabled={saving || !title.trim() || !lyrics.trim()}
        >
          {saving ? "Saving…" : initial ? "Update" : "Add Song"}
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

  return (
    <form className="song-import" onSubmit={handleImport}>
      <div className="song-import__format-row">
        <label>
          <input
            type="radio"
            name="import-format"
            value="ccli"
            checked={format === "ccli"}
            onChange={() => setFormat("ccli")}
          />{" "}
          CCLI SongSelect (text)
        </label>
        <label>
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
      <textarea
        className="song-import__textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          format === "ccli"
            ? "Paste CCLI SongSelect text export here…"
            : "Paste OpenLP XML song export here…"
        }
        rows={12}
        disabled={importing}
        autoFocus
      />
      {error && <p className="song-import__error">{error}</p>}
      <div className="song-import__actions">
        <button
          type="button"
          className="song-form__btn song-form__btn--cancel"
          onClick={onCancel}
          disabled={importing}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="song-form__btn song-form__btn--save"
          disabled={importing || !text.trim()}
        >
          {importing ? "Importing…" : "Import"}
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
      className={`song-row${pushed ? " song-row--live" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => onPush(song)}
      onKeyDown={(e) => e.key === "Enter" && onPush(song)}
    >
      <div className="song-row__meta">
        <span className="song-row__title">{song.title}</span>
        {song.artist && <span className="song-row__artist">{song.artist}</span>}
        {pushed && <span className="song-row__live-dot" aria-label="Live" />}
      </div>
      <div className="song-row__actions">
        <button
          className="song-row__btn"
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
          className="song-row__btn song-row__btn--danger"
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    <div className="song-library">
      <div className="song-library__header">
        <span className="song-library__label">SONGS</span>
        <div className="song-library__header-actions">
          <button
            className="song-library__action"
            onClick={() => setMode("import")}
            title="Import CCLI / OpenLP"
          >
            Import
          </button>
          <button
            className="song-library__action song-library__action--primary"
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
          <div className="song-library__search">
            <input
              className="song-library__input"
              type="text"
              placeholder="Search songs…"
              value={query}
              onChange={handleQueryChange}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          {songs.length === 0 ? (
            <p className="song-library__empty">
              {query ? `No songs matching "${query}"` : "No songs yet. Add or import some!"}
            </p>
          ) : (
            <ul className="song-library__list" role="list">
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
