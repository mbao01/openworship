import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "../lib/tauri";
import type { ArtifactCategory, ArtifactEntry, ArtifactsSettings, ServiceProject } from "../lib/types";
import "../styles/artifacts.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

function mimeCategory(mime: string | null): ArtifactCategory {
  if (!mime) return "other";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.includes("pdf") || mime.includes("document") || mime.startsWith("text/")) return "document";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "slide";
  return "other";
}

const CAT_ICONS: Record<string, string> = {
  dir: "📁", image: "🖼", video: "🎬", audio: "🎵",
  document: "📄", slide: "📊", other: "📎",
};

function entryIcon(e: ArtifactEntry): string {
  return e.is_dir ? CAT_ICONS.dir : (CAT_ICONS[mimeCategory(e.mime_type)] ?? CAT_ICONS.other);
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

type Nav =
  | { kind: "all" }
  | { kind: "recent" }
  | { kind: "starred" }
  | { kind: "service"; id: string; name: string };

function Sidebar({
  projects, nav, onNav,
}: { projects: ServiceProject[]; nav: Nav; onNav: (n: Nav) => void }) {
  const cls = (n: Nav) =>
    `af-nav__item${JSON.stringify(n) === JSON.stringify(nav) ? " af-nav__item--active" : ""}`;

  return (
    <nav className="af-sidebar">
      <div className="af-nav__section">
        <p className="af-nav__heading">LOCAL</p>
        <button className={cls({ kind: "all" })} onClick={() => onNav({ kind: "all" })}>All Artifacts</button>
        <button className={cls({ kind: "recent" })} onClick={() => onNav({ kind: "recent" })}>Recent</button>
        <button className={cls({ kind: "starred" })} onClick={() => onNav({ kind: "starred" })}>Starred</button>
      </div>
      {projects.length > 0 && (
        <div className="af-nav__section">
          <p className="af-nav__heading">SERVICES</p>
          {projects.map((p) => (
            <button
              key={p.id}
              className={cls({ kind: "service", id: p.id, name: p.name })}
              onClick={() => onNav({ kind: "service", id: p.id, name: p.name })}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}

// ─── Context menu ─────────────────────────────────────────────────────────────

interface CtxMenu { x: number; y: number; entry: ArtifactEntry }

function ContextMenu({
  menu, onOpen, onStar, onRename, onDelete, onClose,
}: {
  menu: CtxMenu;
  onOpen: (e: ArtifactEntry) => void;
  onStar: (e: ArtifactEntry) => void;
  onRename: (e: ArtifactEntry) => void;
  onDelete: (e: ArtifactEntry) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  return (
    <div ref={ref} className="af-ctx" style={{ top: menu.y, left: menu.x }}>
      {!menu.entry.is_dir && (
        <button onClick={() => { onOpen(menu.entry); onClose(); }}>Open</button>
      )}
      <button onClick={() => { onStar(menu.entry); onClose(); }}>
        {menu.entry.starred ? "Unstar" : "Star"}
      </button>
      <button onClick={() => { onRename(menu.entry); onClose(); }}>Rename</button>
      <button className="af-ctx__danger" onClick={() => { onDelete(menu.entry); onClose(); }}>Delete</button>
    </div>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function RenameModal({ entry, onConfirm, onCancel }: {
  entry: ArtifactEntry; onConfirm: (n: string) => void; onCancel: () => void;
}) {
  const [name, setName] = useState(entry.name);
  return (
    <div className="af-modal-overlay" onClick={onCancel}>
      <div className="af-modal" onClick={(e) => e.stopPropagation()}>
        <p className="af-modal__title">Rename</p>
        <input className="af-modal__input" value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onConfirm(name.trim()); if (e.key === "Escape") onCancel(); }}
          autoFocus />
        <div className="af-modal__actions">
          <button className="af-btn--secondary" onClick={onCancel}>Cancel</button>
          <button className="af-btn--primary" onClick={() => onConfirm(name.trim())}
            disabled={!name.trim() || name.trim() === entry.name}>Rename</button>
        </div>
      </div>
    </div>
  );
}

function NewFolderModal({ onConfirm, onCancel }: {
  onConfirm: (n: string) => void; onCancel: () => void;
}) {
  const [name, setName] = useState("");
  return (
    <div className="af-modal-overlay" onClick={onCancel}>
      <div className="af-modal" onClick={(e) => e.stopPropagation()}>
        <p className="af-modal__title">New Folder</p>
        <input className="af-modal__input" placeholder="Folder name" value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onConfirm(name.trim()); if (e.key === "Escape") onCancel(); }}
          autoFocus />
        <div className="af-modal__actions">
          <button className="af-btn--secondary" onClick={onCancel}>Cancel</button>
          <button className="af-btn--primary" onClick={() => onConfirm(name.trim())} disabled={!name.trim()}>Create</button>
        </div>
      </div>
    </div>
  );
}

// ─── Filter pills ─────────────────────────────────────────────────────────────

const FILTERS: Array<{ label: string; value: ArtifactCategory | "all" }> = [
  { label: "All", value: "all" },
  { label: "Images", value: "image" },
  { label: "Videos", value: "video" },
  { label: "Audio", value: "audio" },
  { label: "Documents", value: "document" },
  { label: "Slides", value: "slide" },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export function ArtifactsPage({ onBack }: { onBack: () => void }) {
  const [projects, setProjects] = useState<ServiceProject[]>([]);
  const [nav, setNav] = useState<Nav>({ kind: "all" });
  const [entries, setEntries] = useState<ArtifactEntry[]>([]);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [crumbs, setCrumbs] = useState<Array<{ label: string; parent: string | null }>>([]);
  const [filter, setFilter] = useState<ArtifactCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [settings, setSettings] = useState<ArtifactsSettings | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [renaming, setRenaming] = useState<ArtifactEntry | null>(null);
  const [newFolder, setNewFolder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<ServiceProject[]>("list_service_projects")
      .then((list) => setProjects(list.filter((p) => p.closed_at_ms !== null)))
      .catch(() => {});
    invoke<ArtifactsSettings>("get_artifacts_settings").then(setSettings).catch(() => {});
  }, []);

  const loadEntries = useCallback(async () => {
    setError(null);
    try {
      if (query.trim()) {
        const svcId = nav.kind === "service" ? nav.id : null;
        setEntries(await invoke<ArtifactEntry[]>("search_artifacts", { query: query.trim(), serviceId: svcId }));
        return;
      }
      let list: ArtifactEntry[] = [];
      if (nav.kind === "recent") {
        list = await invoke<ArtifactEntry[]>("list_recent_artifacts", { limit: 50 });
      } else if (nav.kind === "starred") {
        list = await invoke<ArtifactEntry[]>("list_starred_artifacts");
      } else {
        const svcId = nav.kind === "service" ? nav.id : null;
        list = await invoke<ArtifactEntry[]>("list_artifacts", { serviceId: svcId, parentPath });
      }
      setEntries(list);
    } catch (e) { setError(String(e)); }
  }, [nav, parentPath, query]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const handleNav = (n: Nav) => {
    setNav(n); setParentPath(null); setCrumbs([]); setQuery(""); setFilter("all");
  };

  const handleNavigate = (e: ArtifactEntry) => {
    if (!e.is_dir) return;
    setCrumbs((prev) => [...prev, { label: e.name, parent: parentPath }]);
    setParentPath(e.path);
  };

  const handleCrumb = (idx: number) => {
    if (idx === -1) { setCrumbs([]); setParentPath(null); return; }
    const crumb = crumbs[idx];
    setCrumbs((prev) => prev.slice(0, idx));
    setParentPath(crumb.parent);
  };

  const handleCtx = (e: React.MouseEvent, entry: ArtifactEntry) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, entry });
  };

  const handleOpen = async (e: ArtifactEntry) => {
    try { await invoke("open_artifact", { id: e.id }); }
    catch (err) { setError(String(err)); }
  };

  const handleStar = async (e: ArtifactEntry) => {
    try { await invoke("star_artifact", { id: e.id, starred: !e.starred }); await loadEntries(); }
    catch (err) { setError(String(err)); }
  };

  const handleDelete = async (e: ArtifactEntry) => {
    try { await invoke("delete_artifact", { id: e.id }); await loadEntries(); }
    catch (err) { setError(String(err)); }
  };

  const handleRename = async (newName: string) => {
    if (!renaming) return;
    try { await invoke("rename_artifact", { id: renaming.id, newName }); setRenaming(null); await loadEntries(); }
    catch (err) { setError(String(err)); }
  };

  const handleNewFolder = async (name: string) => {
    const svcId = nav.kind === "service" ? nav.id : null;
    try { await invoke("create_artifact_dir", { serviceId: svcId, parentPath, name }); setNewFolder(false); await loadEntries(); }
    catch (err) { setError(String(err)); }
  };

  const sectionTitle = nav.kind === "all" ? "All Artifacts" :
    nav.kind === "recent" ? "Recent" :
    nav.kind === "starred" ? "Starred" : nav.name;

  const visible = entries.filter((e) =>
    filter === "all" || (!e.is_dir && mimeCategory(e.mime_type) === filter)
  );

  return (
    <div className="af-root">
      {/* Topbar */}
      <header className="af-topbar">
        <button className="af-topbar__back" onClick={onBack}>← Operator</button>
        <span className="af-topbar__title">Artifacts</span>
        <div className="af-topbar__actions">
          <button className={`af-view-btn${viewMode === "list" ? " af-view-btn--active" : ""}`} onClick={() => setViewMode("list")} title="List view">≡</button>
          <button className={`af-view-btn${viewMode === "grid" ? " af-view-btn--active" : ""}`} onClick={() => setViewMode("grid")} title="Grid view">⊞</button>
        </div>
      </header>

      <div className="af-body">
        <Sidebar projects={projects} nav={nav} onNav={handleNav} />

        <main className="af-main">
          {/* Toolbar */}
          <div className="af-toolbar">
            <div className="af-breadcrumb">
              <button className="af-breadcrumb__item" onClick={() => handleCrumb(-1)}>{sectionTitle}</button>
              {crumbs.map((c, i) => (
                <span key={i}>
                  <span className="af-breadcrumb__sep">/</span>
                  <button className="af-breadcrumb__item" onClick={() => handleCrumb(i)}>{c.label}</button>
                </span>
              ))}
            </div>
            <div className="af-toolbar__right">
              <input className="af-search" type="search" placeholder="Search files…"
                value={query} onChange={(e) => setQuery(e.target.value)} />
              <button className="af-action-btn" onClick={() => setNewFolder(true)}>+ Folder</button>
            </div>
          </div>

          {/* Filter pills */}
          <div className="af-filters">
            {FILTERS.map((f) => (
              <button key={f.value}
                className={`af-pill${filter === f.value ? " af-pill--active" : ""}`}
                onClick={() => setFilter(f.value)}>{f.label}</button>
            ))}
          </div>

          {error && <p className="af-error">{error}</p>}

          {/* File list */}
          {viewMode === "list" ? (
            <div className="af-table-wrap">
              <table className="af-table">
                <thead>
                  <tr><th>Name</th><th>Type</th><th>Size</th><th>Modified</th></tr>
                </thead>
                <tbody>
                  {visible.length === 0 ? (
                    <tr><td colSpan={4} className="af-empty">{query ? "No results." : "No files here yet."}</td></tr>
                  ) : visible.map((e) => (
                    <tr key={e.id} className="af-row" onContextMenu={(ev) => handleCtx(ev, e)}
                      onDoubleClick={() => handleNavigate(e)}>
                      <td className="af-row__name">
                        <span className="af-row__icon">{entryIcon(e)}</span>
                        {e.name}
                        {e.starred && <span className="af-row__star">★</span>}
                      </td>
                      <td className="af-row__type">{e.is_dir ? "Folder" : (e.mime_type?.split("/")[1]?.toUpperCase() ?? "File")}</td>
                      <td className="af-row__size">{e.is_dir ? "—" : formatBytes(e.size_bytes)}</td>
                      <td className="af-row__date">{formatDate(e.modified_at_ms)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="af-grid">
              {visible.length === 0
                ? <p className="af-empty">{query ? "No results." : "No files here yet."}</p>
                : visible.map((e) => (
                  <div key={e.id} className="af-tile" onContextMenu={(ev) => handleCtx(ev, e)}
                    onDoubleClick={() => handleNavigate(e)}>
                    <div className="af-tile__icon">{entryIcon(e)}</div>
                    <span className="af-tile__name" title={e.name}>{e.name}</span>
                    {e.starred && <span className="af-tile__star">★</span>}
                  </div>
                ))
              }
            </div>
          )}

          {/* Status bar */}
          <div className="af-statusbar">
            <span className="af-statusbar__count">{visible.length} item{visible.length !== 1 ? "s" : ""}</span>
            {settings && <span className="af-statusbar__path" title={settings.base_path}>{settings.base_path}</span>}
          </div>
        </main>
      </div>

      {ctxMenu && (
        <ContextMenu menu={ctxMenu} onOpen={handleOpen} onStar={handleStar}
          onRename={(e) => setRenaming(e)} onDelete={handleDelete}
          onClose={() => setCtxMenu(null)} />
      )}
      {renaming && <RenameModal entry={renaming} onConfirm={handleRename} onCancel={() => setRenaming(null)} />}
      {newFolder && <NewFolderModal onConfirm={handleNewFolder} onCancel={() => setNewFolder(false)} />}
    </div>
  );
}
