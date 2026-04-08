import { useCallback, useEffect, useRef, useState } from "react";
import { ShareDialog } from "../components/ShareDialog";
import { invoke } from "../lib/tauri";
import type { ArtifactCategory, ArtifactEntry, ArtifactsSettings, CloudSyncInfo, ServiceProject, StorageUsage, SyncStatus } from "../lib/types";

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
  | { kind: "service"; id: string; name: string }
  | { kind: "cloud_branch" }
  | { kind: "cloud_shared" };

function syncStatusLabel(status: SyncStatus): string {
  switch (status) {
    case "local_only": return "Local only";
    case "queued": return "Queued";
    case "syncing": return "Syncing…";
    case "synced": return "Synced";
    case "conflict": return "Conflict";
    case "error": return "Error";
  }
}

function SyncBadge({ status }: { status: SyncStatus }) {
  const colorCls =
    status === "synced" ? "text-gold" :
    status === "syncing" ? "text-chalk animate-spin" :
    status === "queued" ? "text-ash" :
    status === "conflict" ? "text-[#e89a00]" :
    status === "error" ? "text-ember" :
    "hidden";

  return (
    <span
      className={`inline-flex items-center justify-center text-[10px] w-4 h-4 rounded-full shrink-0 ${colorCls}`}
      title={syncStatusLabel(status)}
    >
      {status === "synced" ? "☁" : status === "syncing" ? "↑" : status === "queued" ? "⏳" : status === "conflict" ? "⚠" : status === "error" ? "✕" : ""}
    </span>
  );
}

function Sidebar({
  projects, nav, onNav, usage,
}: { projects: ServiceProject[]; nav: Nav; onNav: (n: Nav) => void; usage: StorageUsage | null }) {
  const navItemCls = (n: Nav) => [
    "block w-full text-left bg-transparent border-none font-sans text-xs px-3 py-[6px]",
    "cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis transition-colors",
    "hover:text-chalk hover:bg-white/[0.03]",
    JSON.stringify(n) === JSON.stringify(nav)
      ? "text-chalk bg-gold/[0.08]"
      : "text-ash",
  ].join(" ");

  return (
    <nav data-qa="artifacts-sidebar" className="w-[200px] shrink-0 bg-obsidian border-r border-iron overflow-y-auto py-3">
      <div className="mb-4">
        <p className="text-[9px] font-semibold tracking-[0.12em] uppercase text-smoke px-3 pb-1 m-0">LOCAL</p>
        <button data-qa="artifacts-nav-all" className={navItemCls({ kind: "all" })} onClick={() => onNav({ kind: "all" })}>All Artifacts</button>
        <button data-qa="artifacts-nav-recent" className={navItemCls({ kind: "recent" })} onClick={() => onNav({ kind: "recent" })}>Recent</button>
        <button data-qa="artifacts-nav-starred" className={navItemCls({ kind: "starred" })} onClick={() => onNav({ kind: "starred" })}>Starred</button>
      </div>
      {projects.length > 0 && (
        <div className="mb-4">
          <p className="text-[9px] font-semibold tracking-[0.12em] uppercase text-smoke px-3 pb-1 m-0">SERVICES</p>
          {projects.map((p) => (
            <button
              key={p.id}
              data-qa={`artifacts-nav-service-${p.id}`}
              className={navItemCls({ kind: "service", id: p.id, name: p.name })}
              onClick={() => onNav({ kind: "service", id: p.id, name: p.name })}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
      <div className="mb-4">
        <p className="text-[9px] font-semibold tracking-[0.12em] uppercase text-smoke px-3 pb-1 m-0">CLOUD</p>
        <button data-qa="artifacts-nav-cloud-branch" className={navItemCls({ kind: "cloud_branch" })} onClick={() => onNav({ kind: "cloud_branch" })}>
          ☁ My Branch
        </button>
        <button data-qa="artifacts-nav-cloud-shared" className={navItemCls({ kind: "cloud_shared" })} onClick={() => onNav({ kind: "cloud_shared" })}>
          ⊕ Church Shared
        </button>
      </div>
      {usage && (
        <div className="px-[14px] py-[10px] mt-auto border-t border-iron">
          <div className="h-[2px] bg-iron rounded-[1px] overflow-hidden mb-[6px]">
            <div
              className="h-full bg-gold transition-[width] duration-300 min-w-[2px]"
              style={{
                width: usage.quota_bytes
                  ? `${Math.min(100, (usage.used_bytes / usage.quota_bytes) * 100)}%`
                  : "0%",
              }}
            />
          </div>
          <span className="block text-[10px] text-ash font-mono">
            {formatStorageBytes(usage.used_bytes)}
            {usage.quota_bytes ? ` / ${formatStorageBytes(usage.quota_bytes)}` : " used"}
          </span>
        </div>
      )}
    </nav>
  );
}

function formatStorageBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

// ─── Context menu ─────────────────────────────────────────────────────────────

interface CtxMenu { x: number; y: number; entry: ArtifactEntry }

function ContextMenu({
  menu, syncInfo, onOpen, onStar, onRename, onDelete, onShare, onSyncNow, onClose,
}: {
  menu: CtxMenu;
  syncInfo: CloudSyncInfo | null;
  onOpen: (e: ArtifactEntry) => void;
  onStar: (e: ArtifactEntry) => void;
  onRename: (e: ArtifactEntry) => void;
  onDelete: (e: ArtifactEntry) => void;
  onShare: (e: ArtifactEntry) => void;
  onSyncNow: (e: ArtifactEntry) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const btnCls = "block w-full text-left bg-transparent border-none font-sans text-xs text-chalk px-[14px] py-[6px] cursor-pointer transition-colors hover:bg-white/[0.06]";

  return (
    <div
      ref={ref}
      data-qa="artifacts-ctx-menu"
      className="fixed z-[1000] bg-slate border border-iron rounded py-1 min-w-[140px] shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
      style={{ top: menu.y, left: menu.x }}
    >
      {!menu.entry.is_dir && (
        <button className={btnCls} onClick={() => { onOpen(menu.entry); onClose(); }}>Open</button>
      )}
      <button className={btnCls} onClick={() => { onStar(menu.entry); onClose(); }}>
        {menu.entry.starred ? "Unstar" : "Star"}
      </button>
      <button className={btnCls} onClick={() => { onRename(menu.entry); onClose(); }}>Rename</button>
      <div className="h-px bg-iron my-[3px]" />
      <button className={btnCls} onClick={() => { onShare(menu.entry); onClose(); }}>
        {syncInfo?.sync_enabled ? "Share / Permissions…" : "Sync & Share…"}
      </button>
      {syncInfo?.sync_enabled && syncInfo.status !== "syncing" && (
        <button className={btnCls} onClick={() => { onSyncNow(menu.entry); onClose(); }}>Sync now</button>
      )}
      <div className="h-px bg-iron my-[3px]" />
      <button className={`${btnCls} text-ember`} onClick={() => { onDelete(menu.entry); onClose(); }}>Delete</button>
    </div>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function RenameModal({ entry, onConfirm, onCancel }: {
  entry: ArtifactEntry; onConfirm: (n: string) => void; onCancel: () => void;
}) {
  const [name, setName] = useState(entry.name);
  return (
    <div className="fixed inset-0 bg-black/65 flex items-center justify-center z-[900]" onClick={onCancel}>
      <div className="bg-slate border border-iron rounded-[6px] p-4 w-[320px] flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <p className="text-[13px] font-semibold text-chalk m-0">Rename</p>
        <input
          className="bg-obsidian border border-iron rounded-[3px] text-chalk font-sans text-[13px] px-[10px] py-[6px] outline-none transition-colors focus:border-gold"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onConfirm(name.trim()); if (e.key === "Escape") onCancel(); }}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button
            className="bg-transparent text-ash border border-iron rounded font-sans text-xs px-[14px] py-[6px] cursor-pointer transition-colors hover:text-chalk hover:border-ash"
            onClick={onCancel}
          >Cancel</button>
          <button
            className="bg-gold text-void border-none rounded font-sans text-xs font-semibold px-[14px] py-[6px] cursor-pointer transition-[filter] hover:brightness-[1.12] disabled:opacity-40 disabled:cursor-default"
            onClick={() => onConfirm(name.trim())}
            disabled={!name.trim() || name.trim() === entry.name}
          >Rename</button>
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
    <div className="fixed inset-0 bg-black/65 flex items-center justify-center z-[900]" onClick={onCancel}>
      <div className="bg-slate border border-iron rounded-[6px] p-4 w-[320px] flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <p className="text-[13px] font-semibold text-chalk m-0">New Folder</p>
        <input
          className="bg-obsidian border border-iron rounded-[3px] text-chalk font-sans text-[13px] px-[10px] py-[6px] outline-none transition-colors focus:border-gold"
          placeholder="Folder name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onConfirm(name.trim()); if (e.key === "Escape") onCancel(); }}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button
            className="bg-transparent text-ash border border-iron rounded font-sans text-xs px-[14px] py-[6px] cursor-pointer transition-colors hover:text-chalk hover:border-ash"
            onClick={onCancel}
          >Cancel</button>
          <button
            className="bg-gold text-void border-none rounded font-sans text-xs font-semibold px-[14px] py-[6px] cursor-pointer transition-[filter] hover:brightness-[1.12] disabled:opacity-40 disabled:cursor-default"
            onClick={() => onConfirm(name.trim())}
            disabled={!name.trim()}
          >Create</button>
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
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [settings, setSettings] = useState<ArtifactsSettings | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [renaming, setRenaming] = useState<ArtifactEntry | null>(null);
  const [newFolder, setNewFolder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Cloud sync state ─────────────────────────────────────────────────────────
  const [syncInfoMap, setSyncInfoMap] = useState<Map<string, CloudSyncInfo>>(new Map());
  const [sharing, setSharing] = useState<ArtifactEntry | null>(null);
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);
  const [cloudEntries, setCloudEntries] = useState<CloudSyncInfo[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    invoke<ServiceProject[]>("list_service_projects")
      .then((list) => setProjects(list.filter((p) => p.closed_at_ms === null)))
      .catch(() => {});
    invoke<ArtifactsSettings>("get_artifacts_settings").then(setSettings).catch(() => {});
    invoke<StorageUsage>("get_storage_usage").then(setStorageUsage).catch(() => {});
  }, []);

  const loadEntries = useCallback(async () => {
    setError(null);
    try {
      if (nav.kind === "cloud_branch" || nav.kind === "cloud_shared") {
        const section = nav.kind === "cloud_branch" ? "branch" : "shared";
        const infos = await invoke<CloudSyncInfo[]>("list_cloud_artifacts", { section });
        setCloudEntries(infos);
        setEntries([]);
        return;
      }

      if (debouncedQuery.trim()) {
        const svcId = nav.kind === "service" ? nav.id : null;
        const list = await invoke<ArtifactEntry[]>("search_artifacts", { query: debouncedQuery.trim(), serviceId: svcId });
        setEntries(list);
        await loadSyncInfo(list);
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
      await loadSyncInfo(list);
    } catch (e) { setError(String(e)); }
  }, [nav, parentPath, debouncedQuery]);

  const loadSyncInfo = async (list: ArtifactEntry[]) => {
    const map = new Map<string, CloudSyncInfo>();
    await Promise.all(
      list.map(async (e) => {
        try {
          const info = await invoke<CloudSyncInfo | null>("get_cloud_sync_info", { artifactId: e.id });
          if (info) map.set(e.id, info);
        } catch { /* ignore */ }
      })
    );
    setSyncInfoMap(map);
  };

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const handleNav = (n: Nav) => {
    setNav(n); setParentPath(null); setCrumbs([]); setQuery(""); setDebouncedQuery(""); setFilter("all");
    if (n.kind !== "cloud_branch" && n.kind !== "cloud_shared") setCloudEntries([]);
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
    const msg = e.is_dir
      ? `Delete folder "${e.name}" and all its contents? This cannot be undone.`
      : `Delete "${e.name}"? This cannot be undone.`;
    if (!window.confirm(msg)) return;
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

  const handleShare = (e: ArtifactEntry) => setSharing(e);

  const handleSyncNow = async (e: ArtifactEntry) => {
    setError(null);
    try {
      const updated = await invoke<CloudSyncInfo>("sync_artifact_now", { artifactId: e.id });
      setSyncInfoMap((prev) => new Map(prev).set(e.id, updated));
      invoke<StorageUsage>("get_storage_usage").then(setStorageUsage).catch(() => {});
    } catch (err) { setError(String(err)); }
  };

  const sectionTitle = nav.kind === "all" ? "All Artifacts" :
    nav.kind === "recent" ? "Recent" :
    nav.kind === "starred" ? "Starred" :
    nav.kind === "cloud_branch" ? "My Branch — Cloud" :
    nav.kind === "cloud_shared" ? "Church Shared" :
    nav.name;

  const visible = entries.filter((e) =>
    filter === "all" || (!e.is_dir && mimeCategory(e.mime_type) === filter)
  );

  const metaCellCls = "text-smoke font-mono text-[11px] whitespace-nowrap";
  const viewBtnCls = (active: boolean) => [
    "bg-transparent border border-iron text-ash w-7 h-6 rounded-[3px] cursor-pointer text-sm",
    "flex items-center justify-center transition-colors hover:text-chalk",
    active ? "border-gold text-gold" : "",
  ].join(" ");

  return (
    <div data-qa="artifacts-root" className="flex flex-col h-screen bg-void text-chalk font-sans overflow-hidden">
      {/* Topbar */}
      <header data-qa="artifacts-topbar" className="flex items-center gap-3 px-4 h-11 border-b border-iron shrink-0">
        <button
          data-qa="artifacts-back-btn"
          className="bg-transparent border-none text-xs text-ash cursor-pointer font-sans p-0 transition-colors hover:text-chalk"
          onClick={onBack}
        >← Operator</button>
        <span className="text-[13px] font-semibold tracking-[0.06em] uppercase text-chalk flex-1">Artifacts</span>
        <div className="flex gap-1">
          <button
            data-qa="artifacts-view-list"
            className={viewBtnCls(viewMode === "list")}
            onClick={() => setViewMode("list")}
            title="List view"
          >≡</button>
          <button
            data-qa="artifacts-view-grid"
            className={viewBtnCls(viewMode === "grid")}
            onClick={() => setViewMode("grid")}
            title="Grid view"
          >⊞</button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar projects={projects} nav={nav} onNav={handleNav} usage={storageUsage} />

        <main className="flex-1 flex flex-col overflow-hidden bg-void">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-iron shrink-0 gap-3">
            <div className="flex items-center gap-[2px] text-xs min-w-0 flex-1">
              <button
                className="bg-transparent border-none font-sans text-xs text-ash cursor-pointer px-1 py-[2px] rounded-[3px] whitespace-nowrap hover:text-chalk"
                onClick={() => handleCrumb(-1)}
              >{sectionTitle}</button>
              {crumbs.map((c, i) => (
                <span key={i}>
                  <span className="text-smoke mx-[2px]">/</span>
                  <button
                    className="bg-transparent border-none font-sans text-xs text-ash cursor-pointer px-1 py-[2px] rounded-[3px] whitespace-nowrap hover:text-chalk"
                    onClick={() => handleCrumb(i)}
                  >{c.label}</button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input
                data-qa="artifacts-search"
                className="bg-obsidian border border-iron rounded-[3px] text-chalk font-sans text-xs px-2 py-1 w-[180px] outline-none transition-colors focus:border-gold placeholder:text-smoke"
                type="search"
                placeholder="Search files…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                data-qa="artifacts-new-folder-btn"
                className="font-sans text-[11px] font-medium text-ash bg-transparent border border-iron rounded-[3px] py-1 px-[10px] cursor-pointer whitespace-nowrap transition-colors hover:text-chalk hover:border-ash"
                onClick={() => setNewFolder(true)}
              >+ Folder</button>
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex gap-[6px] px-4 py-2 border-b border-iron shrink-0">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                data-qa={`artifacts-filter-${f.value}`}
                className={[
                  "font-sans text-[10px] font-medium tracking-[0.04em] uppercase rounded-[20px] py-[3px] px-[10px] cursor-pointer transition-colors",
                  filter === f.value
                    ? "text-void bg-gold border border-gold"
                    : "bg-transparent border border-iron text-ash hover:text-chalk hover:border-ash",
                ].join(" ")}
                onClick={() => setFilter(f.value)}
              >{f.label}</button>
            ))}
          </div>

          {error && <p className="text-[11px] text-ember px-4 py-2 m-0">{error}</p>}

          {/* Cloud section panels */}
          {(nav.kind === "cloud_branch" || nav.kind === "cloud_shared") && (
            <div className="flex-1 overflow-y-auto py-2">
              {cloudEntries.length === 0 ? (
                <p className="text-center text-smoke text-xs py-12">No synced files in this section.</p>
              ) : cloudEntries.map((info) => (
                <div key={info.artifact_id} className="flex items-center gap-[10px] px-4 py-2 border-b border-iron/50 text-[13px]">
                  <SyncBadge status={info.status} />
                  <span className="flex-1 text-chalk overflow-hidden text-ellipsis whitespace-nowrap" title={info.cloud_key ?? ""}>
                    {info.cloud_key?.split("/").pop() ?? info.artifact_id}
                  </span>
                  <span className="text-[11px] text-ash font-mono shrink-0">
                    {info.last_synced_ms
                      ? `Synced ${formatDate(info.last_synced_ms)}`
                      : "Not yet synced"}
                  </span>
                  {info.sync_error && (
                    <span className="text-[11px] text-ember shrink-0" title={info.sync_error}>⚠ {info.sync_error.slice(0, 40)}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* File list */}
          {nav.kind !== "cloud_branch" && nav.kind !== "cloud_shared" && (
            viewMode === "list" ? (
              <div className="flex-1 overflow-y-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      {["Name", "Type", "Size", "Modified", ""].map((h) => (
                        <th key={h} className="text-left text-[9px] font-semibold tracking-[0.08em] uppercase text-smoke px-4 py-[6px] border-b border-iron sticky top-0 bg-void">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.length === 0 ? (
                      <tr><td colSpan={5} className="text-center text-smoke text-xs py-12">{query ? "No results." : "No files here yet."}</td></tr>
                    ) : visible.map((e) => {
                      const sync = syncInfoMap.get(e.id);
                      return (
                        <tr
                          key={e.id}
                          data-qa="artifacts-row"
                          className="cursor-default border-b border-iron/50 transition-colors hover:bg-white/[0.025]"
                          onContextMenu={(ev) => handleCtx(ev, e)}
                          onDoubleClick={() => handleNavigate(e)}
                        >
                          <td className="px-4 py-[6px] align-middle">
                            <div className="flex items-center gap-2 text-chalk font-normal">
                              <span className="text-sm shrink-0">{entryIcon(e)}</span>
                              {e.name}
                              {e.starred && <span className="text-gold ml-[6px] text-[11px]">★</span>}
                            </div>
                          </td>
                          <td className={`px-4 py-[6px] align-middle ${metaCellCls}`}>{e.is_dir ? "Folder" : (e.mime_type?.split("/")[1]?.toUpperCase() ?? "File")}</td>
                          <td className={`px-4 py-[6px] align-middle ${metaCellCls}`}>{e.is_dir ? "—" : formatBytes(e.size_bytes)}</td>
                          <td className={`px-4 py-[6px] align-middle ${metaCellCls}`}>{formatDate(e.modified_at_ms)}</td>
                          <td className="px-4 py-[6px] align-middle w-6 text-center">
                            {sync?.sync_enabled && <SyncBadge status={sync.status} />}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex-1 flex flex-wrap content-start gap-3 p-4 overflow-y-auto">
                {visible.length === 0
                  ? <p className="text-center text-smoke text-xs py-12">{query ? "No results." : "No files here yet."}</p>
                  : visible.map((e) => {
                    const sync = syncInfoMap.get(e.id);
                    return (
                      <div
                        key={e.id}
                        data-qa="artifacts-tile"
                        className="relative w-24 flex flex-col items-center gap-[6px] px-2 py-3 rounded border border-transparent cursor-default transition-colors hover:bg-white/[0.04] hover:border-iron"
                        onContextMenu={(ev) => handleCtx(ev, e)}
                        onDoubleClick={() => handleNavigate(e)}
                      >
                        <div className="text-[32px] leading-none">{entryIcon(e)}</div>
                        <span className="text-[11px] text-chalk text-center max-w-[80px] overflow-hidden text-ellipsis whitespace-nowrap w-full" title={e.name}>{e.name}</span>
                        {e.starred && <span className="absolute top-[6px] right-[6px] text-gold text-[10px]">★</span>}
                        {sync?.sync_enabled && (
                          <span className="absolute top-1 right-1"><SyncBadge status={sync.status} /></span>
                        )}
                      </div>
                    );
                  })
                }
              </div>
            )
          )}

          {/* Status bar */}
          <div className="flex items-center justify-between px-4 py-1 border-t border-iron shrink-0 gap-4">
            <span className="font-mono text-[10px] text-smoke shrink-0">
              {nav.kind === "cloud_branch" || nav.kind === "cloud_shared"
                ? `${cloudEntries.length} synced item${cloudEntries.length !== 1 ? "s" : ""}`
                : `${visible.length} item${visible.length !== 1 ? "s" : ""}`}
            </span>
            {storageUsage?.last_updated_ms ? (
              <span className="text-[11px] text-ash font-mono">Last sync: {formatDate(storageUsage.last_updated_ms)}</span>
            ) : null}
            {settings && (
              <span
                className="font-mono text-[10px] text-smoke whitespace-nowrap overflow-hidden text-ellipsis min-w-0 [direction:rtl] text-right"
                title={settings.base_path}
              >{settings.base_path}</span>
            )}
          </div>
        </main>
      </div>

      {ctxMenu && (
        <ContextMenu
          menu={ctxMenu}
          syncInfo={syncInfoMap.get(ctxMenu.entry.id) ?? null}
          onOpen={handleOpen}
          onStar={handleStar}
          onRename={(e) => setRenaming(e)}
          onDelete={handleDelete}
          onShare={handleShare}
          onSyncNow={handleSyncNow}
          onClose={() => setCtxMenu(null)}
        />
      )}
      {renaming && <RenameModal entry={renaming} onConfirm={handleRename} onCancel={() => setRenaming(null)} />}
      {newFolder && <NewFolderModal onConfirm={handleNewFolder} onCancel={() => setNewFolder(false)} />}
      {sharing && (
        <ShareDialog
          artifact={sharing}
          syncInfo={syncInfoMap.get(sharing.id) ?? null}
          onClose={() => setSharing(null)}
          onSyncToggled={() => {
            loadEntries();
            invoke<StorageUsage>("get_storage_usage").then(setStorageUsage).catch(() => {});
          }}
        />
      )}
    </div>
  );
}
