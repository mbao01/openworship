import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "../lib/tauri";
import type { Song, SongSemanticStatus } from "../lib/types";

// Shared input/textarea classes
const inputCls = "w-full box-border bg-bg border border-line rounded-[3px] text-ink font-sans text-xs py-2 px-3 outline-none transition-colors placeholder:text-line focus:border-line-strong disabled:opacity-50";
const textareaCls = `${inputCls} resize-y`;

// Shared button classes
const btnBaseCls = "font-sans text-[11px] tracking-[0.06em] py-1 px-3 rounded-[3px] border border-line bg-transparent text-ink-3 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
const btnCancelCls = `${btnBaseCls} hover:border-line-strong hover:text-ink`;
const btnSaveCls = `${btnBaseCls} border-accent/60 text-accent hover:border-accent`;

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
        <label
          className="text-[10px] font-medium tracking-[0.08em] text-ink-3 uppercase"
          htmlFor="song-title"
        >
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
        <label
          className="text-[10px] font-medium tracking-[0.08em] text-ink-3 uppercase"
          htmlFor="song-artist"
        >
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
        <label
          className="text-[10px] font-medium tracking-[0.08em] text-ink-3 uppercase"
          htmlFor="song-lyrics"
        >
          Lyrics
        </label>
        <textarea
          id="song-lyrics"
          className={`${textareaCls} text-[11px] leading-[1.5]`}
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          placeholder={
            "[Verse 1]\nAmazing grace how sweet the sound\nThat saved a wretch like me\n\n[Chorus]\nMy chains are gone ..."
          }
          rows={10}
          required
          disabled={saving}
        />
      </div>
      {error && <p className="text-[11px] text-danger m-0">{error}</p>}
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
          {saving ? "Saving ..." : initial ? "Update" : "Add Song"}
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
      <div className="flex gap-4 text-[11px] text-ink-3">
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
          className="font-sans text-[10px] tracking-[0.06em] py-0.5 px-2 border border-line rounded-[3px] bg-transparent text-ink-3 cursor-pointer transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          title="Load from file"
        >
          Load from file
        </button>
        <span className="text-[10px] text-line">or paste below</span>
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
        className="w-full box-border bg-bg border border-line rounded-[3px] text-ink font-mono text-[10px] py-2 px-3 outline-none resize-y transition-colors placeholder:text-line focus:border-line-strong disabled:opacity-50"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          format === "ccli"
            ? "Paste CCLI SongSelect text export here ..."
            : "Paste OpenLP XML song export here ..."
        }
        rows={12}
        disabled={importing}
        autoFocus
      />
      {error && <p className="text-[11px] text-danger m-0">{error}</p>}
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
          {importing ? "Importing ..." : "Import"}
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
          ? " border-l-2 border-l-accent border-line bg-bg-2"
          : " border-transparent hover:bg-bg-2 hover:border-line focus-visible:bg-bg-2 focus-visible:border-line focus-visible:outline-none"
      }`}
      role="button"
      tabIndex={0}
      onClick={() => onPush(song)}
      onKeyDown={(e) => e.key === "Enter" && onPush(song)}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-xs text-ink whitespace-nowrap overflow-hidden text-ellipsis">{song.title}</span>
        {song.artist && (
          <span className="text-[10px] text-ink-3 whitespace-nowrap overflow-hidden text-ellipsis">{song.artist}</span>
        )}
        {pushed && (
          <span
            className="w-[5px] h-[5px] rounded-full bg-accent [box-shadow:0_0_3px_var(--color-accent)] shrink-0"
            aria-label="Live"
          />
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          className="font-sans text-xs leading-none w-[22px] h-[22px] border border-line rounded-[2px] bg-transparent text-ink-3 cursor-pointer flex items-center justify-center transition-colors hover:border-line-strong hover:text-ink"
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
          className="font-sans text-xs leading-none w-[22px] h-[22px] border border-line rounded-[2px] bg-transparent text-ink-3 cursor-pointer flex items-center justify-center transition-colors hover:border-danger hover:text-danger"
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
          <span className="text-[10px] font-medium tracking-[0.12em] text-ink-3 uppercase">
            SONGS
          </span>
          {semanticStatus && (
            <span
              className={`text-[9px] font-medium tracking-[0.08em] uppercase ${
                semanticStatus.ready ? "text-accent/70" : "text-muted"
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
            className="font-sans text-[10px] tracking-[0.06em] py-0.5 px-2 border border-line rounded-[3px] bg-transparent text-ink-3 cursor-pointer transition-colors hover:border-line-strong hover:text-ink"
            onClick={() => setMode("import")}
            title="Import CCLI / OpenLP"
          >
            Import
          </button>
          <button
            data-qa="song-library-add-btn"
            className="font-sans text-[10px] tracking-[0.06em] py-0.5 px-2 border border-accent/60 rounded-[3px] bg-transparent text-accent cursor-pointer transition-colors hover:border-accent"
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
        <SongForm onSave={handleSaved} onCancel={() => setMode("list")} />
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
              className="w-full box-border bg-bg border border-line rounded-[3px] text-ink font-sans text-xs py-2 px-3 outline-none transition-colors placeholder:text-line focus:border-line-strong"
              type="text"
              placeholder="Search songs ..."
              value={query}
              onChange={handleQueryChange}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          {songs.length === 0 ? (
            <p className="text-[11px] text-muted m-0">
              {query
                ? `No songs matching "${query}"`
                : "No songs yet. Add or import some!"}
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
