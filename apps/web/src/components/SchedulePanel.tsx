import { useCallback, useEffect, useRef, useState } from "react";
import { useDebounce } from "../hooks/use-debounce";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "../lib/tauri";
import { toastError } from "../lib/toast";
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
      className={`relative flex items-center gap-[6px] rounded-sm border border-l-2 border-line/40 bg-bg-1 px-3 py-2 pr-7 transition-all outline-none group${
        isLive
          ? "!border-l-accent bg-bg-2"
          : "border-l-transparent focus-within:border-line-strong focus-within:border-l-muted focus-within:bg-bg-2 hover:border-line-strong hover:border-l-muted hover:bg-bg-2"
      }`}
      draggable={!isReadOnly}
      onDragStart={() => onDragStart?.(item.id)}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver?.(e);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop?.(item.id);
      }}
    >
      {!isReadOnly && (
        <span
          className="shrink-0 cursor-grab text-[13px] text-muted opacity-0 transition-opacity select-none group-hover:opacity-100"
          aria-hidden="true"
          title="Drag to reorder"
        >
          ⠿
        </span>
      )}
      <div
        className="min-w-0 flex-1 cursor-pointer"
        role="button"
        tabIndex={0}
        onClick={() => onPush(item)}
        onKeyDown={(e) => e.key === "Enter" && onPush(item)}
      >
        <div className="mb-0.5 flex items-center gap-2">
          <span className="text-[11px] font-medium tracking-[0.04em] text-ink">
            {item.reference}
          </span>
          <span className="font-mono text-[10px] tracking-[0.08em] text-ink-3">
            {item.translation}
          </span>
          {isLive && (
            <span
              className="ml-auto h-[6px] w-[6px] rounded-full bg-accent [box-shadow:0_0_4px_var(--color-accent)]"
              aria-label="Live"
            />
          )}
        </div>
        <p className="m-0 line-clamp-2 text-[11px] leading-[1.45] text-ink-3">
          {item.text}
        </p>
      </div>
      {!isReadOnly && (
        <button
          className="absolute top-1/2 right-[6px] -translate-y-1/2 cursor-pointer rounded-[2px] border-none bg-transparent px-1 py-0.5 text-sm leading-none text-muted opacity-0 transition-all group-focus-within:opacity-100 group-hover:opacity-100 hover:text-danger"
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

function NewProjectForm({
  onCreated,
}: {
  onCreated: (p: ServiceProject) => void;
}) {
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
      const project = await invoke<ServiceProject>("create_service_project", {
        name: trimmed,
      });
      onCreated(project);
    } catch (e) {
      toastError("Failed to create service")(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="mb-3 flex shrink-0 gap-2" onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        className="flex-1 border-b border-none border-b-line/60 bg-transparent py-2 font-sans text-[13px] text-ink transition-colors outline-none placeholder:text-muted focus:border-b-accent disabled:opacity-50"
        placeholder="Service name ..."
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={saving}
        autoComplete="off"
      />
      <button
        className="cursor-pointer rounded-sm border-none bg-accent px-[10px] py-1 font-sans text-[10px] font-medium tracking-[0.08em] text-accent-foreground uppercase transition-all disabled:cursor-not-allowed disabled:opacity-40"
        type="submit"
        disabled={saving || !name.trim()}
      >
        Create
      </button>
    </form>
  );
}

// ─── Content bank (bottom collapsible section) ────────────────────────────────

function ContentBankSection({
  liveReference,
}: {
  liveReference: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [bankResults, setBankResults] = useState<ContentBankEntry[]>([]);
  const [searchResults, setSearchResults] = useState<VerseResult[]>([]);
  const [songResults, setSongResults] = useState<Song[]>([]);
  const [translation, setTranslation] = useState("KJV");
  const [translations, setTranslations] = useState<TranslationInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pushed, setPushed] = useState<string | null>(null);

  useEffect(() => {
    invoke<TranslationInfo[]>("list_translations")
      .then(setTranslations)
      .catch(toastError("Failed to load translations"));
  }, []);

  // Load bank on open
  useEffect(() => {
    if (open) {
      invoke<ContentBankEntry[]>("search_content_bank", { query: "" })
        .then(setBankResults)
        .catch(toastError("Failed to load content bank"));
    }
  }, [open]);

  const runSearch = useCallback(async (q: string, t: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      setSongResults([]);
      invoke<ContentBankEntry[]>("search_content_bank", { query: "" })
        .then(setBankResults)
        .catch(toastError("Failed to load content bank"));
      return;
    }
    setIsSearching(true);
    try {
      const [scripture, bank, songs] = await Promise.all([
        invoke<VerseResult[]>("search_scriptures", {
          query: q,
          translation: t || null,
        }),
        invoke<ContentBankEntry[]>("search_content_bank", { query: q }),
        invoke<Song[]>("search_songs", { query: q, limit: 10 }),
      ]);
      setSearchResults(scripture);
      setBankResults(bank);
      setSongResults(songs);
    } catch (e) {
      toastError("Search failed")(e);
      setSearchResults([]);
      setBankResults([]);
      setSongResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const debouncedSearch = useDebounce(runSearch, 220);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    debouncedSearch(val, translation);
  };

  const handlePush = async (reference: string, text: string, tr: string) => {
    try {
      await invoke("push_to_display", { reference, text, translation: tr });
      setPushed(reference);
      setTimeout(() => setPushed(null), 2000);
    } catch (e) {
      toastError("Failed to push to display")(e);
    }
  };

  const handlePushSong = async (song: Song) => {
    try {
      await invoke("push_song_to_display", { id: song.id });
      setPushed(`song:${song.id}`);
      setTimeout(() => setPushed(null), 2000);
    } catch (e) {
      toastError("Failed to push song to display")(e);
    }
  };

  const resultCls = (isLive: boolean) =>
    `bg-bg-1 border border-l-2 rounded-sm py-2 px-3 cursor-pointer outline-none transition-all hover:bg-bg-2 hover:border-line-strong focus:bg-bg-2 focus:border-line-strong${
      isLive
        ? " border-l-accent/60 bg-bg-2 border-line/40"
        : " border-l-transparent border-line/40"
    }`;

  return (
    <div className="mt-3 shrink-0 border-t border-line">
      <button
        className="flex w-full cursor-pointer items-center justify-between border-none bg-transparent px-0 pt-3 pb-0 font-sans text-[10px] font-medium tracking-[0.1em] text-muted uppercase transition-colors hover:text-ink-3"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span data-qa="content-bank-toggle-label">CONTENT BANK</span>
        <span className="text-[8px]" aria-hidden="true">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="max-h-[280px] overflow-y-auto pt-3 [scrollbar-color:var(--color-line-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-line">
          {/* Search controls */}
          <div className="mb-2 flex items-center gap-2">
            <div className="relative flex-1">
              <input
                className="box-border w-full border-b border-none border-b-line/60 bg-transparent py-2 font-sans text-xs text-ink transition-colors outline-none placeholder:text-muted focus:border-b-accent"
                type="text"
                placeholder={"Search — e.g. John 3:16 or “shepherd”"}
                value={query}
                onChange={handleQueryChange}
                autoComplete="off"
                spellCheck={false}
              />
              {isSearching && (
                <span className="absolute top-1/2 right-0 h-2 w-2 -translate-y-1/2 animate-spin rounded-full border border-muted border-t-accent" />
              )}
            </div>
            <select
              className="min-w-[46px] cursor-pointer border-b border-none border-b-line/60 bg-bg-1 px-1 py-2 font-mono text-[10px] tracking-[0.06em] text-ink-3 outline-none focus:border-b-accent"
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

          {/* Bank results */}
          {bankResults.length > 0 && (
            <>
              <p className="mx-0 my-2 text-[10px] font-medium tracking-[0.1em] text-muted uppercase">
                {query.trim() ? "Past services" : "Recently used"}
              </p>
              <ul
                className="m-0 flex list-none flex-col gap-px p-0"
                role="list"
              >
                {bankResults.map((entry) => {
                  const isLive =
                    pushed === entry.reference ||
                    liveReference === entry.reference;
                  return (
                    <li
                      key={entry.id}
                      className={resultCls(isLive)}
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        handlePush(
                          entry.reference,
                          entry.text,
                          entry.translation,
                        )
                      }
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        handlePush(
                          entry.reference,
                          entry.text,
                          entry.translation,
                        )
                      }
                    >
                      <div className="mb-0.5 flex items-center gap-2">
                        <span className="text-[11px] font-medium tracking-[0.04em] text-ink">
                          {entry.reference}
                        </span>
                        <span className="font-mono text-[10px] tracking-[0.08em] text-ink-3">
                          {entry.translation}
                        </span>
                        {entry.use_count > 1 && (
                          <span className="font-mono text-[9px] text-muted">
                            ×{entry.use_count}
                          </span>
                        )}
                        {isLive && (
                          <span
                            className="ml-auto h-[6px] w-[6px] rounded-full bg-accent [box-shadow:0_0_4px_var(--color-accent)]"
                            aria-label="Live"
                          />
                        )}
                      </div>
                      <p className="m-0 line-clamp-2 text-[11px] leading-[1.45] text-ink-3">
                        {entry.text}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {/* Scripture search results */}
          {searchResults.length > 0 && (
            <>
              <p className="mx-0 my-2 text-[10px] font-medium tracking-[0.1em] text-muted uppercase">
                Scripture
              </p>
              <ul
                className="m-0 flex list-none flex-col gap-px p-0"
                role="list"
              >
                {searchResults
                  .filter(
                    (v) =>
                      !bankResults.some((b) => b.reference === v.reference),
                  )
                  .map((v, i) => {
                    const isLive =
                      pushed === v.reference || liveReference === v.reference;
                    return (
                      <li
                        key={`${v.translation}-${v.reference}-${i}`}
                        className={resultCls(isLive)}
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          handlePush(v.reference, v.text, v.translation)
                        }
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          handlePush(v.reference, v.text, v.translation)
                        }
                      >
                        <div className="mb-0.5 flex items-center gap-2">
                          <span className="text-[11px] font-medium tracking-[0.04em] text-ink">
                            {v.reference}
                          </span>
                          <span className="font-mono text-[10px] tracking-[0.08em] text-ink-3">
                            {v.translation}
                          </span>
                          {v.score != null && v.score < 1.0 && (
                            <span
                              className="ml-auto font-mono text-[9px] text-muted opacity-70"
                              title={`${Math.round(v.score * 100)}% relevance`}
                            >
                              {Math.round(v.score * 100)}%
                            </span>
                          )}
                          {isLive && (
                            <span
                              className="ml-auto h-[6px] w-[6px] rounded-full bg-accent [box-shadow:0_0_4px_var(--color-accent)]"
                              aria-label="Live"
                            />
                          )}
                        </div>
                        <p className="m-0 line-clamp-2 text-[11px] leading-[1.45] text-ink-3">
                          {v.text}
                        </p>
                      </li>
                    );
                  })}
              </ul>
            </>
          )}

          {/* Song results */}
          {songResults.length > 0 && (
            <>
              <p className="mx-0 my-2 text-[10px] font-medium tracking-[0.1em] text-muted uppercase">
                Songs
              </p>
              <ul
                className="m-0 flex list-none flex-col gap-px p-0"
                role="list"
              >
                {songResults.map((song) => {
                  const key = `song:${song.id}`;
                  const isLive = pushed === key;
                  return (
                    <li
                      key={song.id}
                      className={resultCls(isLive)}
                      role="button"
                      tabIndex={0}
                      onClick={() => handlePushSong(song)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handlePushSong(song)
                      }
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] leading-none text-accent"
                          aria-hidden="true"
                        >
                          ♪
                        </span>
                        <span className="text-[11px] font-medium tracking-[0.04em] text-ink">
                          {song.title}
                        </span>
                        {song.artist && (
                          <span className="font-mono text-[10px] tracking-[0.08em] text-ink-3">
                            {song.artist}
                          </span>
                        )}
                        {isLive && (
                          <span
                            className="ml-auto h-[6px] w-[6px] rounded-full bg-accent [box-shadow:0_0_4px_var(--color-accent)]"
                            aria-label="Live"
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {query.trim() &&
            !isSearching &&
            searchResults.length === 0 &&
            bankResults.length === 0 &&
            songResults.length === 0 && (
              <p className="m-0 py-2 text-[11px] text-muted">
                No results for "{query}"
              </p>
            )}
        </div>
      )}
    </div>
  );
}

// ─── Main SchedulePanel ───────────────────────────────────────────────────────

export function SchedulePanel() {
  const [activeProject, setActiveProject] = useState<ServiceProject | null>(
    null,
  );
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
    } catch (e) {
      toastError("Failed to push to display")(e);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      const updated = await invoke<ServiceProject>(
        "remove_item_from_active_project",
        { itemId },
      );
      setActiveProject(updated);
    } catch (e) {
      toastError("Failed to remove item from schedule")(e);
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
      const updated = await invoke<ServiceProject>(
        "reorder_active_project_items",
        { itemIds: ids },
      );
      setActiveProject(updated);
    } catch (e) {
      toastError("Failed to reorder schedule items")(e);
    }
  };

  const handleCloseProject = async (withSummary = false) => {
    try {
      const projectId = activeProject?.id ?? null;
      await invoke("close_active_project");
      setActiveProject(null);
      setLiveReference(null);
      loadProjects();
      if (withSummary && projectId) {
        invoke("generate_service_summary", { projectId }).catch((err) => console.error(err));
      }
    } catch (e) {
      toastError("Failed to close service")(e);
    }
  };

  const handleOpenProject = async (id: string) => {
    try {
      const project = await invoke<ServiceProject>("open_service_project", {
        id,
      });
      setActiveProject(project.closed_at_ms === null ? project : null);
      loadProjects();
    } catch (e) {
      toastError("Failed to open service")(e);
    }
  };

  const pastProjects = projects.filter(
    (p) => p.closed_at_ms !== null && p.id !== activeProject?.id,
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-0">
      {/* Header */}
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <span className="text-[11px] font-medium tracking-[0.12em] text-ink-3 uppercase">
          SCHEDULE
        </span>
        {activeProject ? (
          <>
            <button
              data-qa="schedule-summarize-btn"
              className="mr-0.5 cursor-pointer rounded-sm border-none bg-danger px-2 py-[3px] font-sans text-[10px] font-medium tracking-[0.08em] text-accent-foreground uppercase transition-all hover:brightness-110"
              onClick={() => handleCloseProject(true)}
              title="End service and generate AI summary"
            >
              End + Summary
            </button>
            <button
              data-qa="schedule-end-btn"
              className="cursor-pointer rounded-sm border-none bg-accent px-2 py-[3px] font-sans text-[10px] font-medium tracking-[0.08em] text-accent-foreground uppercase transition-all hover:brightness-110"
              onClick={() => handleCloseProject(false)}
              title="End this service without summary"
            >
              End
            </button>
          </>
        ) : (
          <button
            data-qa="schedule-new-btn"
            className="cursor-pointer rounded-sm border border-line bg-transparent px-2 py-[3px] font-sans text-[10px] font-medium tracking-[0.08em] text-ink uppercase transition-colors hover:border-line-strong"
            onClick={() => setShowNewForm((v) => !v)}
            title="Start a new service"
          >
            New Service
          </button>
        )}
      </div>

      {/* New service form */}
      {showNewForm && !activeProject && (
        <NewProjectForm
          onCreated={(p) => {
            setActiveProject(p);
            setShowNewForm(false);
            loadProjects();
          }}
        />
      )}

      {/* Active project */}
      {activeProject ? (
        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-color:var(--color-line-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-line">
          <p className="m-0 mb-3 overflow-hidden text-xs font-medium tracking-[0.02em] text-ellipsis whitespace-nowrap text-ink">
            {activeProject.name}
          </p>
          {activeProject.items.length === 0 ? (
            <p className="m-0 text-xs leading-[1.5] text-muted">
              Push scripture to display — items appear here automatically.
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-px p-0" role="list">
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
                    onDragStart={(id) => {
                      dragItemId.current = id;
                    }}
                    onDrop={handleDrop}
                  />
                ))}
            </ul>
          )}
        </div>
      ) : !showNewForm ? (
        <p className="m-0 text-xs leading-[1.5] text-muted">
          No active service. Start one to track your content.
        </p>
      ) : null}

      {/* Past projects */}
      <div className="mt-3 shrink-0 border-t border-line pt-3">
        <button
          className="mb-2 flex w-full cursor-pointer items-center justify-between border-none bg-transparent p-0 font-sans text-[10px] font-medium tracking-[0.1em] text-muted uppercase transition-colors hover:text-ink-3"
          onClick={() => setShowPastProjects((v) => !v)}
          aria-expanded={showPastProjects}
        >
          <span>
            PAST SERVICES{" "}
            {pastProjects.length > 0 ? `(${pastProjects.length})` : ""}
          </span>
          <span aria-hidden="true">{showPastProjects ? "▲" : "▼"}</span>
        </button>
        {showPastProjects &&
          (pastProjects.length === 0 ? (
            <p className="m-0 text-[11px] leading-[1.5] text-muted">
              No past services. Close an active service to archive it here.
            </p>
          ) : (
            <ul
              className="m-0 flex max-h-[120px] list-none flex-col gap-px overflow-y-auto p-0 [scrollbar-color:var(--color-line-strong)_transparent] [scrollbar-width:thin]"
              role="list"
            >
              {pastProjects.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 rounded-sm px-2 py-2 transition-colors hover:bg-white/[0.04]"
                >
                  <span className="flex-1 overflow-hidden text-xs text-ellipsis whitespace-nowrap text-ink">
                    {p.name}
                  </span>
                  <span className="font-mono text-[10px] whitespace-nowrap text-muted">
                    {p.items.length} item{p.items.length !== 1 ? "s" : ""}
                  </span>
                  <button
                    className="shrink-0 cursor-pointer rounded-sm border border-line bg-transparent px-[6px] py-0.5 font-sans text-[10px] font-medium tracking-[0.06em] text-ink-3 uppercase transition-colors hover:border-line-strong hover:text-ink"
                    onClick={() => handleOpenProject(p.id)}
                    title="Load this service"
                  >
                    Open
                  </button>
                </li>
              ))}
            </ul>
          ))}
      </div>

      {/* Content Bank */}
      <ContentBankSection liveReference={liveReference} />
    </div>
  );
}
