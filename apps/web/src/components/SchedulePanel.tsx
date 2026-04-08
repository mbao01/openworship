import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "../lib/tauri";
import type {
  ContentBankEntry,
  ProjectItem,
  ServiceProject,
  Song,
  TranslationInfo,
  VerseResult,
} from "../lib/types";

// ─── Schedule (top section) ───────────────────────────────────────────────────

function ProjectItemRow({
  item,
  isLive,
  isReadOnly,
  onPush,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  item: ProjectItem;
  isLive: boolean;
  isReadOnly: boolean;
  onPush: (item: ProjectItem) => void;
  onRemove: (id: string) => void;
  onDragStart?: (id: string) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (targetId: string) => void;
}) {
  return (
    <li
      className={`schedule-item${isLive ? " schedule-item--live" : ""}`}
      draggable={!isReadOnly}
      onDragStart={() => onDragStart?.(item.id)}
      onDragOver={(e) => { e.preventDefault(); onDragOver?.(e); }}
      onDrop={(e) => { e.preventDefault(); onDrop?.(item.id); }}
    >
      {!isReadOnly && (
        <span
          className="schedule-item__drag-handle"
          aria-hidden="true"
          title="Drag to reorder"
        >
          ⠿
        </span>
      )}
      <div
        className="schedule-item__body"
        role="button"
        tabIndex={0}
        onClick={() => onPush(item)}
        onKeyDown={(e) => e.key === "Enter" && onPush(item)}
      >
        <div className="schedule-item__meta">
          <span className="schedule-item__reference">{item.reference}</span>
          <span className="schedule-item__translation">{item.translation}</span>
          {isLive && <span className="schedule-item__live-dot" aria-label="Live" />}
        </div>
        <p className="schedule-item__text">{item.text}</p>
      </div>
      {!isReadOnly && (
        <button
          className="schedule-item__remove"
          title="Remove from schedule"
          aria-label={`Remove ${item.reference} from schedule`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(item.id);
          }}
        >
          ×
        </button>
      )}
    </li>
  );
}

function NewProjectForm({ onCreated }: { onCreated: (p: ServiceProject) => void }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const project = await invoke<ServiceProject>("create_service_project", { name: trimmed });
      onCreated(project);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="schedule-new-form" onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        className="schedule-new-form__input"
        placeholder="Service name…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={saving}
        autoComplete="off"
      />
      <button
        className="schedule-new-form__btn"
        type="submit"
        disabled={saving || !name.trim()}
      >
        Create
      </button>
    </form>
  );
}

// ─── Content bank (bottom collapsible section) ────────────────────────────────

function ContentBankSection({ liveReference }: { liveReference: string | null }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [bankResults, setBankResults] = useState<ContentBankEntry[]>([]);
  const [searchResults, setSearchResults] = useState<VerseResult[]>([]);
  const [songResults, setSongResults] = useState<Song[]>([]);
  const [translation, setTranslation] = useState("KJV");
  const [translations, setTranslations] = useState<TranslationInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pushed, setPushed] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    invoke<TranslationInfo[]>("list_translations")
      .then(setTranslations)
      .catch(() => {});
  }, []);

  // Load bank on open
  useEffect(() => {
    if (open) {
      invoke<ContentBankEntry[]>("search_content_bank", { query: "" })
        .then(setBankResults)
        .catch(() => {});
    }
  }, [open]);

  const runSearch = useCallback(
    async (q: string, t: string) => {
      if (!q.trim()) {
        setSearchResults([]);
        setSongResults([]);
        // Reload bank with empty query to show recents
        invoke<ContentBankEntry[]>("search_content_bank", { query: "" })
          .then(setBankResults)
          .catch(() => {});
        return;
      }
      setIsSearching(true);
      try {
        const [scripture, bank, songs] = await Promise.all([
          invoke<VerseResult[]>("search_scriptures", { query: q, translation: t || null }),
          invoke<ContentBankEntry[]>("search_content_bank", { query: q }),
          invoke<Song[]>("search_songs", { query: q, limit: 10 }),
        ]);
        setSearchResults(scripture);
        setBankResults(bank);
        setSongResults(songs);
      } catch {
        setSearchResults([]);
        setBankResults([]);
        setSongResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    []
  );

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val, translation), 220);
  };

  const handlePush = async (reference: string, text: string, tr: string) => {
    try {
      await invoke("push_to_display", { reference, text, translation: tr });
      setPushed(reference);
      setTimeout(() => setPushed(null), 2000);
    } catch {
      // ignore
    }
  };

  const handlePushSong = async (song: Song) => {
    try {
      await invoke("push_song_to_display", { id: song.id });
      setPushed(`song:${song.id}`);
      setTimeout(() => setPushed(null), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="content-bank">
      <button
        className="content-bank__toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="content-bank__toggle-label">CONTENT BANK</span>
        <span className="content-bank__toggle-chevron" aria-hidden="true">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="content-bank__body">
          <div className="content-bank__controls">
            <div className="content-bank__input-wrap">
              <input
                className="content-bank__input"
                type="text"
                placeholder={'Search — e.g. John 3:16 or "shepherd"'}
                value={query}
                onChange={handleQueryChange}
                autoComplete="off"
                spellCheck={false}
              />
              {isSearching && <span className="content-bank__spinner" />}
            </div>
            <select
              className="content-bank__select"
              value={translation}
              onChange={(e) => {
                setTranslation(e.target.value);
                if (query.trim()) runSearch(query, e.target.value);
              }}
            >
              {translations.map((t) => (
                <option key={t.id} value={t.abbreviation}>
                  {t.abbreviation}
                </option>
              ))}
            </select>
          </div>

          {/* Bank results (past services) — shown first */}
          {bankResults.length > 0 && (
            <>
              {bankResults.length > 0 && (
                <p className="content-bank__section-label">
                  {query.trim() ? "Past services" : "Recently used"}
                </p>
              )}
              <ul className="content-bank__results" role="list">
                {bankResults.map((entry) => {
                  const isLive =
                    pushed === entry.reference ||
                    liveReference === entry.reference;
                  return (
                    <li
                      key={entry.id}
                      className={`content-bank__result${isLive ? " content-bank__result--live" : ""}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => handlePush(entry.reference, entry.text, entry.translation)}
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        handlePush(entry.reference, entry.text, entry.translation)
                      }
                    >
                      <div className="content-bank__result-meta">
                        <span className="content-bank__reference">{entry.reference}</span>
                        <span className="content-bank__translation">{entry.translation}</span>
                        {entry.use_count > 1 && (
                          <span className="content-bank__use-count">×{entry.use_count}</span>
                        )}
                        {isLive && (
                          <span className="content-bank__live-dot" aria-label="Live" />
                        )}
                      </div>
                      <p className="content-bank__verse-text">{entry.text}</p>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {/* Scripture search results — new content not yet in bank */}
          {searchResults.length > 0 && (
            <>
              <p className="content-bank__section-label">Scripture</p>
              <ul className="content-bank__results" role="list">
                {searchResults
                  .filter((v) => !bankResults.some((b) => b.reference === v.reference))
                  .map((v, i) => {
                    const isLive =
                      pushed === v.reference || liveReference === v.reference;
                    return (
                      <li
                        key={`${v.translation}-${v.reference}-${i}`}
                        className={`content-bank__result${isLive ? " content-bank__result--live" : ""}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => handlePush(v.reference, v.text, v.translation)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && handlePush(v.reference, v.text, v.translation)
                        }
                      >
                        <div className="content-bank__result-meta">
                          <span className="content-bank__reference">{v.reference}</span>
                          <span className="content-bank__translation">{v.translation}</span>
                          {v.score != null && v.score < 1.0 && (
                            <span
                              className="content-bank__score"
                              title={`${Math.round(v.score * 100)}% relevance`}
                            >
                              {Math.round(v.score * 100)}%
                            </span>
                          )}
                          {isLive && (
                            <span className="content-bank__live-dot" aria-label="Live" />
                          )}
                        </div>
                        <p className="content-bank__verse-text">{v.text}</p>
                      </li>
                    );
                  })}
              </ul>
            </>
          )}

          {/* Song search results */}
          {songResults.length > 0 && (
            <>
              <p className="content-bank__section-label">Songs</p>
              <ul className="content-bank__results" role="list">
                {songResults.map((song) => {
                  const key = `song:${song.id}`;
                  const isLive = pushed === key;
                  return (
                    <li
                      key={song.id}
                      className={`content-bank__result${isLive ? " content-bank__result--live" : ""}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => handlePushSong(song)}
                      onKeyDown={(e) => e.key === "Enter" && handlePushSong(song)}
                    >
                      <div className="content-bank__result-meta">
                        <span className="content-bank__kind-badge" aria-hidden="true">♪</span>
                        <span className="content-bank__reference">{song.title}</span>
                        {song.artist && (
                          <span className="content-bank__translation">{song.artist}</span>
                        )}
                        {isLive && (
                          <span className="content-bank__live-dot" aria-label="Live" />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {query.trim() && !isSearching && searchResults.length === 0 && bankResults.length === 0 && songResults.length === 0 && (
            <p className="content-bank__empty">No results for "{query}"</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main SchedulePanel ───────────────────────────────────────────────────────

export function SchedulePanel() {
  const [activeProject, setActiveProject] = useState<ServiceProject | null>(null);
  const [projects, setProjects] = useState<ServiceProject[]>([]);
  const [liveReference, setLiveReference] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showPastProjects, setShowPastProjects] = useState(false);
  const dragItemId = useRef<string | null>(null);

  const loadProjects = useCallback(async () => {
    const [active, all] = await Promise.all([
      invoke<ServiceProject | null>("get_active_project"),
      invoke<ServiceProject[]>("list_service_projects"),
    ]);
    setActiveProject(active);
    setProjects(all);
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Listen for project-updated events from backend (push_to_display, commands)
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<ServiceProject>("service://project-updated", (e) => {
      setActiveProject(e.payload.closed_at_ms === null ? e.payload : null);
      loadProjects();
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, [loadProjects]);

  const handlePushItem = async (item: ProjectItem) => {
    try {
      await invoke("push_to_display", {
        reference: item.reference,
        text: item.text,
        translation: item.translation,
      });
      setLiveReference(item.reference);
    } catch {
      // ignore
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      const updated = await invoke<ServiceProject>("remove_item_from_active_project", {
        itemId,
      });
      setActiveProject(updated);
    } catch {
      // ignore
    }
  };

  const handleDrop = async (targetId: string) => {
    const sourceId = dragItemId.current;
    dragItemId.current = null;
    if (!sourceId || sourceId === targetId || !activeProject) return;
    const ids = activeProject.items
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((i) => i.id);
    const fromIdx = ids.indexOf(sourceId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, sourceId);
    try {
      const updated = await invoke<ServiceProject>("reorder_active_project_items", {
        itemIds: ids,
      });
      setActiveProject(updated);
    } catch {
      // ignore — UI will snap back on next project-updated event
    }
  };

  const handleCloseProject = async () => {
    try {
      await invoke("close_active_project");
      setActiveProject(null);
      setLiveReference(null);
      loadProjects();
    } catch {
      // ignore
    }
  };

  const handleOpenProject = async (id: string) => {
    try {
      const project = await invoke<ServiceProject>("open_service_project", { id });
      setActiveProject(project.closed_at_ms === null ? project : null);
      loadProjects();
    } catch {
      // ignore
    }
  };

  const pastProjects = projects.filter(
    (p) => p.closed_at_ms !== null && p.id !== activeProject?.id
  );

  return (
    <div className="schedule-panel">
      {/* ── SCHEDULE header ─────────────────────────────────── */}
      <div className="schedule-header">
        <span className="schedule-header__label">SCHEDULE</span>
        {activeProject ? (
          <button
            className="schedule-header__action schedule-header__action--end"
            onClick={handleCloseProject}
            title="End this service"
          >
            End Service
          </button>
        ) : (
          <button
            className="schedule-header__action schedule-header__action--new"
            onClick={() => setShowNewForm((v) => !v)}
            title="Start a new service"
          >
            New Service
          </button>
        )}
      </div>

      {/* ── New service form ─────────────────────────────────── */}
      {showNewForm && !activeProject && (
        <NewProjectForm
          onCreated={(p) => {
            setActiveProject(p);
            setShowNewForm(false);
            loadProjects();
          }}
        />
      )}

      {/* ── Active project content ───────────────────────────── */}
      {activeProject ? (
        <div className="schedule-project">
          <p className="schedule-project__name">{activeProject.name}</p>
          {activeProject.items.length === 0 ? (
            <p className="schedule-project__empty">
              Push scripture to display — items appear here automatically.
            </p>
          ) : (
            <ul className="schedule-list" role="list">
              {activeProject.items
                .slice()
                .sort((a, b) => a.position - b.position)
                .map((item) => (
                  <ProjectItemRow
                    key={item.id}
                    item={item}
                    isLive={liveReference === item.reference}
                    isReadOnly={false}
                    onPush={handlePushItem}
                    onRemove={handleRemoveItem}
                    onDragStart={(id) => { dragItemId.current = id; }}
                    onDrop={handleDrop}
                  />
                ))}
            </ul>
          )}
        </div>
      ) : !showNewForm ? (
        <p className="schedule-empty">No active service. Start one to track your content.</p>
      ) : null}

      {/* ── Past projects ────────────────────────────────────── */}
      {pastProjects.length > 0 && (
        <div className="schedule-past">
          <button
            className="schedule-past__toggle"
            onClick={() => setShowPastProjects((v) => !v)}
            aria-expanded={showPastProjects}
          >
            <span>PAST SERVICES ({pastProjects.length})</span>
            <span aria-hidden="true">{showPastProjects ? "▲" : "▼"}</span>
          </button>
          {showPastProjects && (
            <ul className="schedule-past__list" role="list">
              {pastProjects.map((p) => (
                <li key={p.id} className="schedule-past__item">
                  <span className="schedule-past__item-name">{p.name}</span>
                  <span className="schedule-past__item-count">
                    {p.items.length} item{p.items.length !== 1 ? "s" : ""}
                  </span>
                  <button
                    className="schedule-past__item-open"
                    onClick={() => handleOpenProject(p.id)}
                    title="Load this service"
                  >
                    Open
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── CONTENT BANK (collapsible) ───────────────────────── */}
      <ContentBankSection liveReference={liveReference} />
    </div>
  );
}
