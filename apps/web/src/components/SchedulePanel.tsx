import { useCallback, useEffect, useRef, useState } from "react";
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
      className={`relative flex items-center gap-[6px] bg-obsidian border border-iron/40 border-l-2 rounded-sm py-2 px-3 pr-7 outline-none transition-all group${
        isLive
          ? " !border-l-gold bg-slate"
          : " border-l-transparent hover:bg-slate hover:border-smoke hover:border-l-smoke focus-within:bg-slate focus-within:border-smoke focus-within:border-l-smoke"
      }`}
      draggable={!isReadOnly}
      onDragStart={() => onDragStart?.(item.id)}
      onDragOver={(e) => { e.preventDefault(); onDragOver?.(e); }}
      onDrop={(e) => { e.preventDefault(); onDrop?.(item.id); }}
    >
      {!isReadOnly && (
        <span
          className="shrink-0 text-smoke text-[13px] cursor-grab opacity-0 transition-opacity select-none group-hover:opacity-100"
          aria-hidden="true"
          title="Drag to reorder"
        >
          ⠿
        </span>
      )}
      <div
        className="flex-1 min-w-0 cursor-pointer"
        role="button"
        tabIndex={0}
        onClick={() => onPush(item)}
        onKeyDown={(e) => e.key === "Enter" && onPush(item)}
      >
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[11px] font-medium text-chalk tracking-[0.04em]">{item.reference}</span>
          <span className="font-mono text-[10px] text-ash tracking-[0.08em]">{item.translation}</span>
          {isLive && (
            <span
              className="w-[6px] h-[6px] rounded-full bg-gold [box-shadow:0_0_4px_var(--color-gold)] ml-auto"
              aria-label="Live"
            />
          )}
        </div>
        <p className="m-0 text-[11px] leading-[1.45] text-ash line-clamp-2">{item.text}</p>
      </div>
      {!isReadOnly && (
        <button
          className="absolute top-1/2 right-[6px] -translate-y-1/2 bg-transparent border-none text-smoke text-sm leading-none cursor-pointer px-1 py-0.5 rounded-[2px] opacity-0 transition-all group-hover:opacity-100 group-focus-within:opacity-100 hover:text-ember"
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
    } catch (e) {
      toastError("Failed to create service")(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="flex gap-2 mb-3 shrink-0" onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        className="flex-1 bg-transparent border-none border-b border-b-iron/60 outline-none py-2 text-chalk font-sans text-[13px] transition-colors placeholder:text-smoke focus:border-b-gold disabled:opacity-50"
        placeholder="Service name\u2026"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={saving}
        autoComplete="off"
      />
      <button
        className="font-sans text-[10px] font-medium tracking-[0.08em] text-void bg-gold border-none rounded-sm px-[10px] py-1 cursor-pointer uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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

  const runSearch = useCallback(
    async (q: string, t: string) => {
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
          invoke<VerseResult[]>("search_scriptures", { query: q, translation: t || null }),
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
    `bg-obsidian border border-l-2 rounded-sm py-2 px-3 cursor-pointer outline-none transition-all hover:bg-slate hover:border-smoke focus:bg-slate focus:border-smoke${
      isLive ? " border-l-gold-muted bg-slate border-iron/40" : " border-l-transparent border-iron/40"
    }`;

  return (
    <div className="shrink-0 mt-3 border-t border-iron">
      <button
        className="w-full flex items-center justify-between bg-transparent border-none text-smoke font-sans text-[10px] font-medium tracking-[0.1em] uppercase cursor-pointer pt-3 pb-0 px-0 transition-colors hover:text-ash"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span data-qa="content-bank-toggle-label">CONTENT BANK</span>
        <span className="text-[8px]" aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="pt-3 max-h-[280px] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--color-iron)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-iron [&::-webkit-scrollbar-thumb]:rounded-sm">
          {/* Search controls */}
          <div className="flex gap-2 items-center mb-2">
            <div className="flex-1 relative">
              <input
                className="w-full bg-transparent border-none border-b border-b-iron/60 outline-none py-2 text-chalk font-sans text-xs transition-colors box-border placeholder:text-smoke focus:border-b-gold"
                type="text"
                placeholder={'Search \u2014 e.g. John 3:16 or \u201cshepherd\u201d'}
                value={query}
                onChange={handleQueryChange}
                autoComplete="off"
                spellCheck={false}
              />
              {isSearching && (
                <span className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-smoke border-t-gold animate-spin" />
              )}
            </div>
            <select
              className="bg-obsidian border-none border-b border-b-iron/60 text-ash font-mono text-[10px] tracking-[0.06em] py-2 px-1 outline-none cursor-pointer min-w-[46px] focus:border-b-gold"
              value={translation}
              onChange={(e) => {
                setTranslation(e.target.value);
                if (query.trim()) runSearch(query, e.target.value);
              }}
            >
              {translations.map((t) => (
                <option key={t.id} value={t.abbreviation}>{t.abbreviation}</option>
              ))}
            </select>
          </div>

          {/* Bank results */}
          {bankResults.length > 0 && (
            <>
              <p className="text-[10px] font-medium tracking-[0.1em] text-smoke uppercase my-2 mx-0">
                {query.trim() ? "Past services" : "Recently used"}
              </p>
              <ul className="list-none m-0 p-0 flex flex-col gap-px" role="list">
                {bankResults.map((entry) => {
                  const isLive = pushed === entry.reference || liveReference === entry.reference;
                  return (
                    <li
                      key={entry.id}
                      className={resultCls(isLive)}
                      role="button"
                      tabIndex={0}
                      onClick={() => handlePush(entry.reference, entry.text, entry.translation)}
                      onKeyDown={(e) => e.key === "Enter" && handlePush(entry.reference, entry.text, entry.translation)}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] font-medium text-chalk tracking-[0.04em]">{entry.reference}</span>
                        <span className="font-mono text-[10px] text-ash tracking-[0.08em]">{entry.translation}</span>
                        {entry.use_count > 1 && (
                          <span className="font-mono text-[9px] text-smoke">×{entry.use_count}</span>
                        )}
                        {isLive && (
                          <span className="w-[6px] h-[6px] rounded-full bg-gold [box-shadow:0_0_4px_var(--color-gold)] ml-auto" aria-label="Live" />
                        )}
                      </div>
                      <p className="m-0 text-[11px] leading-[1.45] text-ash line-clamp-2">{entry.text}</p>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {/* Scripture search results */}
          {searchResults.length > 0 && (
            <>
              <p className="text-[10px] font-medium tracking-[0.1em] text-smoke uppercase my-2 mx-0">Scripture</p>
              <ul className="list-none m-0 p-0 flex flex-col gap-px" role="list">
                {searchResults
                  .filter((v) => !bankResults.some((b) => b.reference === v.reference))
                  .map((v, i) => {
                    const isLive = pushed === v.reference || liveReference === v.reference;
                    return (
                      <li
                        key={`${v.translation}-${v.reference}-${i}`}
                        className={resultCls(isLive)}
                        role="button"
                        tabIndex={0}
                        onClick={() => handlePush(v.reference, v.text, v.translation)}
                        onKeyDown={(e) => e.key === "Enter" && handlePush(v.reference, v.text, v.translation)}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[11px] font-medium text-chalk tracking-[0.04em]">{v.reference}</span>
                          <span className="font-mono text-[10px] text-ash tracking-[0.08em]">{v.translation}</span>
                          {v.score != null && v.score < 1.0 && (
                            <span
                              className="text-[9px] text-smoke font-mono ml-auto opacity-70"
                              title={`${Math.round(v.score * 100)}% relevance`}
                            >
                              {Math.round(v.score * 100)}%
                            </span>
                          )}
                          {isLive && (
                            <span className="w-[6px] h-[6px] rounded-full bg-gold [box-shadow:0_0_4px_var(--color-gold)] ml-auto" aria-label="Live" />
                          )}
                        </div>
                        <p className="m-0 text-[11px] leading-[1.45] text-ash line-clamp-2">{v.text}</p>
                      </li>
                    );
                  })}
              </ul>
            </>
          )}

          {/* Song results */}
          {songResults.length > 0 && (
            <>
              <p className="text-[10px] font-medium tracking-[0.1em] text-smoke uppercase my-2 mx-0">Songs</p>
              <ul className="list-none m-0 p-0 flex flex-col gap-px" role="list">
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
                      onKeyDown={(e) => e.key === "Enter" && handlePushSong(song)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gold leading-none" aria-hidden="true">♪</span>
                        <span className="text-[11px] font-medium text-chalk tracking-[0.04em]">{song.title}</span>
                        {song.artist && (
                          <span className="font-mono text-[10px] text-ash tracking-[0.08em]">{song.artist}</span>
                        )}
                        {isLive && (
                          <span className="w-[6px] h-[6px] rounded-full bg-gold [box-shadow:0_0_4px_var(--color-gold)] ml-auto" aria-label="Live" />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {query.trim() && !isSearching && searchResults.length === 0 && bankResults.length === 0 && songResults.length === 0 && (
            <p className="text-[11px] text-smoke py-2 m-0">No results for "{query}"</p>
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
      const updated = await invoke<ServiceProject>("remove_item_from_active_project", { itemId });
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
      const updated = await invoke<ServiceProject>("reorder_active_project_items", { itemIds: ids });
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
        invoke("generate_service_summary", { projectId }).catch((e) => {
          console.error("[summary] generation failed:", e);
        });
      }
    } catch (e) {
      toastError("Failed to close service")(e);
    }
  };

  const handleOpenProject = async (id: string) => {
    try {
      const project = await invoke<ServiceProject>("open_service_project", { id });
      setActiveProject(project.closed_at_ms === null ? project : null);
      loadProjects();
    } catch (e) {
      toastError("Failed to open service")(e);
    }
  };

  const pastProjects = projects.filter(
    (p) => p.closed_at_ms !== null && p.id !== activeProject?.id
  );

  return (
    <div className="flex flex-col h-full min-h-0 gap-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <span className="text-[11px] font-medium tracking-[0.12em] text-ash uppercase">SCHEDULE</span>
        {activeProject ? (
          <>
            <button
              data-qa="schedule-summarize-btn"
              className="font-sans text-[10px] font-medium tracking-[0.08em] rounded-sm px-2 py-[3px] cursor-pointer uppercase text-void bg-ember border-none mr-0.5 transition-all hover:brightness-110"
              onClick={() => handleCloseProject(true)}
              title="End service and generate AI summary"
            >
              End + Summary
            </button>
            <button
              data-qa="schedule-end-btn"
              className="font-sans text-[10px] font-medium tracking-[0.08em] rounded-sm px-2 py-[3px] cursor-pointer uppercase text-void bg-gold border-none transition-all hover:brightness-110"
              onClick={() => handleCloseProject(false)}
              title="End this service without summary"
            >
              End
            </button>
          </>
        ) : (
          <button
            data-qa="schedule-new-btn"
            className="font-sans text-[10px] font-medium tracking-[0.08em] rounded-sm px-2 py-[3px] cursor-pointer uppercase text-chalk bg-transparent border border-iron transition-colors hover:border-ash"
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
        <div className="flex-1 overflow-y-auto min-h-0 [scrollbar-width:thin] [scrollbar-color:var(--color-iron)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-iron [&::-webkit-scrollbar-thumb]:rounded-sm">
          <p className="text-xs font-medium text-chalk m-0 mb-3 tracking-[0.02em] whitespace-nowrap overflow-hidden text-ellipsis">
            {activeProject.name}
          </p>
          {activeProject.items.length === 0 ? (
            <p className="text-xs text-smoke m-0 leading-[1.5]">
              Push scripture to display \u2014 items appear here automatically.
            </p>
          ) : (
            <ul className="list-none m-0 p-0 flex flex-col gap-px" role="list">
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
        <p className="text-xs text-smoke m-0 leading-[1.5]">
          No active service. Start one to track your content.
        </p>
      ) : null}

      {/* Past projects */}
      {pastProjects.length > 0 && (
        <div className="shrink-0 mt-3 border-t border-iron pt-3">
          <button
            className="w-full flex items-center justify-between bg-transparent border-none text-smoke font-sans text-[10px] font-medium tracking-[0.1em] uppercase cursor-pointer p-0 mb-2 transition-colors hover:text-ash"
            onClick={() => setShowPastProjects((v) => !v)}
            aria-expanded={showPastProjects}
          >
            <span>PAST SERVICES ({pastProjects.length})</span>
            <span aria-hidden="true">{showPastProjects ? "▲" : "▼"}</span>
          </button>
          {showPastProjects && (
            <ul
              className="list-none m-0 p-0 flex flex-col gap-px max-h-[120px] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--color-iron)_transparent]"
              role="list"
            >
              {pastProjects.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 py-2 px-2 rounded-sm transition-colors hover:bg-white/[0.04]"
                >
                  <span className="flex-1 text-xs text-chalk whitespace-nowrap overflow-hidden text-ellipsis">{p.name}</span>
                  <span className="font-mono text-[10px] text-smoke whitespace-nowrap">
                    {p.items.length} item{p.items.length !== 1 ? "s" : ""}
                  </span>
                  <button
                    className="font-sans text-[10px] font-medium tracking-[0.06em] text-ash bg-transparent border border-iron rounded-sm px-[6px] py-0.5 cursor-pointer uppercase shrink-0 transition-colors hover:text-chalk hover:border-ash"
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

      {/* Content Bank */}
      <ContentBankSection liveReference={liveReference} />
    </div>
  );
}
