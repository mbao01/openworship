import { useCallback, useEffect, useRef, useState } from "react";
import { ShareDialog } from "../ShareDialog";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { invoke } from "../../lib/tauri";
import type {
  ArtifactCategory,
  ArtifactEntry,
  ArtifactsSettings,
  CloudSyncInfo,
  ServiceProject,
  StorageUsage,
} from "../../lib/types";
import {
  SearchIcon,
  UploadIcon,
  RefreshCwIcon,
  ChevronDownIcon,
  ListIcon,
  LayoutGridIcon,
  CloudIcon,
  AlertTriangleIcon,
} from "lucide-react";

import { formatDate, formatStorageBytes, mimeCategory, iconCls } from "./assets/helpers";
import type { Nav, CtxMenu } from "./assets/types";
import { AssetsNav } from "./assets/AssetsNav";
import { AssetTable } from "./assets/AssetTable";
import { AssetGrid } from "./assets/AssetGrid";
import { FilterDropdown } from "./assets/FilterDropdown";
import { AssetContextMenu } from "./assets/AssetContextMenu";
import { PreviewPanel } from "./assets/PreviewPanel";
import { RenameModal } from "./assets/RenameModal";
import { NewFolderModal } from "./assets/NewFolderModal";
import { MoveFolderModal } from "./assets/MoveFolderModal";
import { ZoomControls } from "./assets/ZoomControls";
import { NewMenu } from "./assets/NewMenu";
import { SyncCell } from "./assets/SyncCell";

// ─── Main component ─────────────────────────────────────────────────────────

export function AssetsScreen() {
  const [projects, setProjects] = useState<ServiceProject[]>([]);
  const [nav, setNav] = useState<Nav>({ kind: "all" });
  const [entries, setEntries] = useState<ArtifactEntry[]>([]);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [crumbs, setCrumbs] = useState<Array<{ label: string; path: string | null }>>([]);
  const ALL_CATEGORIES: ArtifactCategory[] = ["image", "video", "audio", "document", "slide"];
  const [activeFilters, setActiveFilters] = useState<Set<ArtifactCategory>>(new Set(ALL_CATEGORIES));
  const allSelected = ALL_CATEGORIES.every((c) => activeFilters.has(c));

  const toggleFilter = (cat: ArtifactCategory) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setActiveFilters(new Set());
    else setActiveFilters(new Set(ALL_CATEGORIES));
  };
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [settings, setSettings] = useState<ArtifactsSettings | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [renaming, setRenaming] = useState<ArtifactEntry | null>(null);
  const [newFolder, setNewFolder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ArtifactEntry | null>(null);
  const [cloudExpanded, setCloudExpanded] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // ── Cloud sync state ────────────────────────────────────────────────────────
  const [syncInfoMap, setSyncInfoMap] = useState<Map<string, CloudSyncInfo>>(new Map());
  const [sharing, setSharing] = useState<ArtifactEntry | null>(null);
  const [movingEntry, setMovingEntry] = useState<ArtifactEntry | null>(null);
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);
  const [cloudEntries, setCloudEntries] = useState<CloudSyncInfo[]>([]);

  const [deleteConfirmEntry, setDeleteConfirmEntry] =
    useState<ArtifactEntry | null>(null);

  const [zoom, setZoom] = useState(100);
  const MIN_ZOOM = 50;
  const MAX_ZOOM = 300;
  const ZOOM_STEP = 25;

  const zoomIn = () => setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM));
  const zoomOut = () => setZoom((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM));
  const zoomReset = () => setZoom(100);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        zoomIn();
      } else if (e.key === "-") {
        e.preventDefault();
        zoomOut();
      } else if (e.key === "0") {
        e.preventDefault();
        zoomReset();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const uploadInputRef = useRef<HTMLInputElement>(null);

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
        const list = await invoke<ArtifactEntry[]>("search_artifacts", {
          query: debouncedQuery.trim(),
          serviceId: svcId,
        });
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
        if (nav.kind === "all" && parentPath === null) {
          // "All Assets" root: show both root-level folders (parent_path=NULL) and _local bucket files
          const [rootItems, localItems] = await Promise.all([
            invoke<ArtifactEntry[]>("list_artifacts", { serviceId: null, parentPath: null }),
            invoke<ArtifactEntry[]>("list_artifacts", { serviceId: null, parentPath: "_local" }),
          ]);
          // Merge and deduplicate by id
          const seen = new Set<string>();
          list = [...rootItems, ...localItems].filter((e) => {
            if (seen.has(e.id)) return false;
            seen.add(e.id);
            return true;
          });
        } else {
          list = await invoke<ArtifactEntry[]>("list_artifacts", { serviceId: svcId, parentPath });
        }
      }
      setEntries(list);
      await loadSyncInfo(list);
    } catch (e) {
      setError(String(e));
    }
  }, [nav, parentPath, debouncedQuery]);

  const loadSyncInfo = async (list: ArtifactEntry[]) => {
    const map = new Map<string, CloudSyncInfo>();
    await Promise.all(
      list.map(async (e) => {
        try {
          const info = await invoke<CloudSyncInfo | null>("get_cloud_sync_info", { artifactId: e.id });
          if (info) map.set(e.id, info);
        } catch {
          /* ignore */
        }
      })
    );
    setSyncInfoMap(map);
  };

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleNav = (n: Nav) => {
    setNav(n);
    setParentPath(null);
    setCrumbs([]);
    setQuery("");
    setDebouncedQuery("");
    setActiveFilters(new Set(ALL_CATEGORIES));
    setSelected(null);
    if (n.kind !== "cloud_branch" && n.kind !== "cloud_shared") setCloudEntries([]);
  };

  const handleNavigate = (e: ArtifactEntry) => {
    if (!e.is_dir) return;
    setCrumbs((prev) => [...prev, { label: e.name, path: e.path }]);
    setParentPath(e.path);
    setSelected(null);
  };

  const handleCrumb = (idx: number) => {
    if (idx === -1) {
      setCrumbs([]);
      setParentPath(null);
      return;
    }
    const crumb = crumbs[idx];
    setCrumbs((prev) => prev.slice(0, idx + 1));
    setParentPath(crumb.path);
  };

  const handleCtx = (e: React.MouseEvent, entry: ArtifactEntry) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, entry });
  };

  const handleOpen = async (e: ArtifactEntry) => {
    try {
      await invoke("open_artifact", { id: e.id });
    } catch (err) {
      setError(String(err));
    }
  };

  const handleStar = async (e: ArtifactEntry) => {
    try {
      await invoke("star_artifact", { id: e.id, starred: !e.starred });
      await loadEntries();
    } catch (err) {
      setError(String(err));
    }
  };

  const handleDelete = (e: ArtifactEntry) => {
    setDeleteConfirmEntry(e);
  };

  const handleRename = async (newName: string) => {
    if (!renaming) return;
    try {
      await invoke("rename_artifact", { id: renaming.id, newName });
      setRenaming(null);
      await loadEntries();
    } catch (err) {
      setError(String(err));
    }
  };

  const handleNewFolder = async (name: string) => {
    const svcId = nav.kind === "service" ? nav.id : null;
    try {
      await invoke("create_artifact_dir", { serviceId: svcId, parentPath, name });
      setNewFolder(false);
      await loadEntries();
    } catch (err) {
      setError(String(err));
    }
  };

  const handleShare = (e: ArtifactEntry) => setSharing(e);

  const handleMoveTo = (entry: ArtifactEntry) => setMovingEntry(entry);

  const handleMoveConfirm = async (newParentPath: string) => {
    if (!movingEntry) return;
    setError(null);
    try {
      await invoke<ArtifactEntry>("move_artifact", {
        id: movingEntry.id,
        newParentPath,
      });
      setMovingEntry(null);
      await loadEntries();
    } catch (err) {
      setError(String(err));
      setMovingEntry(null);
    }
  };

  const handleSyncNow = async (e: ArtifactEntry) => {
    setError(null);
    try {
      const updated = await invoke<CloudSyncInfo>("sync_artifact_now", { artifactId: e.id });
      setSyncInfoMap((prev) => new Map(prev).set(e.id, updated));
      invoke<StorageUsage>("get_storage_usage").then(setStorageUsage).catch(() => {});
    } catch (err) {
      setError(String(err));
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const result = await invoke<{ total: number; succeeded: number; failed: number }>("sync_all_artifacts");
      await loadEntries();
      invoke<StorageUsage>("get_storage_usage").then(setStorageUsage).catch(() => {});
      if (result.failed > 0) {
        setError(`Sync completed: ${result.succeeded}/${result.total} succeeded, ${result.failed} failed.`);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSyncing(false);
    }
  };

  const handleUpload = () => uploadInputRef.current?.click();

  const handleFileInput = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const files = ev.target.files;
    if (!files || files.length === 0) return;
    const svcId = nav.kind === "service" ? nav.id : null;
    try {
      for (const file of Array.from(files)) {
        const buffer = await file.arrayBuffer();
        await invoke("write_artifact_bytes", {
          serviceId: svcId,
          parentPath,
          fileName: file.name,
          data: Array.from(new Uint8Array(buffer)),
        });
      }
      await loadEntries();
    } catch (err) {
      setError(String(err));
    }
    ev.target.value = "";
  };

  const sectionTitle =
    nav.kind === "all" ? "All Assets" :
    nav.kind === "recent" ? "Recent" :
    nav.kind === "starred" ? "Starred" :
    nav.kind === "cloud_branch" ? "My Branch \u2014 Cloud" :
    nav.kind === "cloud_shared" ? "Church Shared" :
    nav.name;

  const totalSize = entries.reduce((sum, e) => sum + (e.size_bytes ?? 0), 0);

  const visible = entries
    .filter(
      (e) =>
        e.is_dir || allSelected || activeFilters.has(mimeCategory(e.mime_type)),
    )
    .filter(
      (e) => e.name !== "_thumbnails" && !e.path.includes("/_thumbnails/"),
    );

  const viewBtnCls = (active: boolean) =>
    [
      "bg-transparent border border-line text-ink-3 w-7 h-[26px] rounded cursor-pointer",
      "flex items-center justify-center transition-colors hover:text-ink",
      active ? "border-accent/60 text-accent" : "",
    ].join(" ");

  const lastSyncMs = storageUsage?.last_updated_ms;
  const lastSyncLabel = lastSyncMs
    ? (() => {
        const diff = Date.now() - lastSyncMs;
        if (diff < 60_000) return `Synced ${Math.round(diff / 1000)}s ago`;
        if (diff < 3_600_000) return `Synced ${Math.round(diff / 60_000)}m ago`;
        return `Synced ${formatDate(lastSyncMs)}`;
      })()
    : null;

  return (
    <div className="flex h-full w-full overflow-hidden">
      <AssetsNav
        projects={projects}
        nav={nav}
        onNav={handleNav}
        usage={storageUsage}
        cloudExpanded={cloudExpanded}
        onToggleCloud={() => setCloudExpanded((v) => !v)}
      />
      <div
        data-qa="artifacts-root"
        className="flex flex-col flex-1 overflow-hidden bg-bg text-ink font-sans"
      >
        {/* ── Compact toolbar ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-4 h-10 border-b border-line shrink-0 bg-bg-1">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-[12px] flex-1 min-w-0 overflow-hidden">
            <button
              className="bg-transparent border-none text-ink font-medium font-sans text-[12px] shrink-0 cursor-pointer transition-colors hover:text-accent"
              onClick={() => {
                handleNav({ kind: "all" });
              }}
            >
              Assets
            </button>
            {nav.kind === "service" && (
              <>
                <span className="text-muted mx-[2px]">/</span>
                <button
                  className="bg-transparent border-none text-ink-3 cursor-pointer font-sans text-[12px] px-[3px] py-[2px] rounded transition-colors hover:text-accent whitespace-nowrap overflow-hidden text-ellipsis max-w-[160px]"
                  onClick={() => handleCrumb(-1)}
                >
                  {nav.name}
                </button>
              </>
            )}
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-[3px] shrink-0">
                <span className="text-muted">/</span>
                <button
                  className="bg-transparent border-none text-ink cursor-pointer font-sans text-[12px] px-[3px] py-[2px] rounded transition-colors hover:text-accent whitespace-nowrap"
                  onClick={() => handleCrumb(i)}
                >
                  {c.label}
                </button>
              </span>
            ))}
          </div>

          {/* Right tools */}
          <div className="flex items-center gap-[6px] shrink-0">
            {showSearch && (
              <input
                data-qa="artifacts-search"
                className="bg-bg-2 border border-line rounded text-ink font-sans text-[11px] px-[8px] py-[4px] w-[160px] outline-none transition-colors focus:border-accent focus:outline-none placeholder:text-muted"
                type="search"
                placeholder="Search files..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                onBlur={() => {
                  if (!query) setShowSearch(false);
                }}
              />
            )}
            <button
              className="bg-transparent border-none text-ink-3 cursor-pointer transition-colors hover:text-ink p-1 rounded"
              onClick={() => setShowSearch((v) => !v)}
              title="Search"
            >
              <SearchIcon className={iconCls} />
            </button>
            <button
              className={[
                "flex items-center gap-[5px] font-sans text-[11px] px-[10px] py-[5px] rounded border cursor-pointer transition-colors disabled:cursor-not-allowed",
                syncing
                  ? "text-accent border-accent/40 bg-accent-soft"
                  : "text-ink-3 border-line hover:text-ink hover:border-line-strong",
              ].join(" ")}
              onClick={handleSyncAll}
              disabled={syncing}
              title="Sync all files to cloud"
            >
              <span className={syncing ? "animate-spin" : ""}>
                <RefreshCwIcon className={iconCls} />
              </span>
              Sync
            </button>
            <div className="flex gap-[3px]">
              <button
                data-qa="artifacts-view-list"
                className={viewBtnCls(viewMode === "list")}
                onClick={() => setViewMode("list")}
                title="List view"
              >
                <ListIcon className={iconCls} />
              </button>
              <button
                data-qa="artifacts-view-grid"
                className={viewBtnCls(viewMode === "grid")}
                onClick={() => setViewMode("grid")}
                title="Grid view"
              >
                <LayoutGridIcon className={iconCls} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 flex flex-col overflow-hidden bg-bg min-w-0">
            {/* Section header */}
            <div className="flex items-center justify-between px-5 py-[10px] border-b border-line shrink-0">
              <div className="flex flex-col min-w-0">
                <h1 className="font-serif text-xl text-ink m-0 leading-[1.3] overflow-hidden text-ellipsis whitespace-nowrap max-w-[280px]">
                  {sectionTitle}
                </h1>
                {entries.length > 0 && (
                  <span className="text-[11px] text-muted font-mono mt-[1px]">
                    {entries.length} asset{entries.length !== 1 ? "s" : ""}
                    {totalSize > 0 ? ` \u00B7 ${formatStorageBytes(totalSize)}` : ""}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Filter dropdown */}
                <FilterDropdown
                  activeFilters={activeFilters}
                  allSelected={allSelected}
                  onToggle={toggleFilter}
                  onToggleAll={toggleAll}
                />

                {/* New + Upload */}
                <div className="relative">
                  <div className="flex rounded overflow-hidden border border-accent/30">
                    <button
                      className="flex items-center gap-[5px] bg-accent text-accent-foreground font-sans text-[11px] font-semibold px-[10px] py-[5px] cursor-pointer transition-[filter] hover:brightness-[1.1] border-r border-accent/50"
                      onClick={() => setNewFolder(true)}
                    >
                      + New
                    </button>
                    <button
                      className="bg-accent/90 text-accent-foreground px-[6px] py-[5px] cursor-pointer transition-[filter] hover:brightness-[1.1]"
                      onClick={() => setShowNewMenu((v) => !v)}
                      title="More options"
                    >
                      <ChevronDownIcon className="w-3 h-3 shrink-0" />
                    </button>
                  </div>
                  {showNewMenu && (
                    <NewMenu
                      onNewFolder={() => setNewFolder(true)}
                      onClose={() => setShowNewMenu(false)}
                    />
                  )}
                </div>
                <button
                  className="flex items-center gap-[5px] bg-transparent border border-line text-ink-3 font-sans text-[11px] px-[10px] py-[5px] rounded cursor-pointer transition-colors hover:text-ink hover:border-line-strong"
                  onClick={handleUpload}
                  title="Upload files"
                >
                  <UploadIcon className={iconCls} />
                  Upload
                </button>
                <input
                  ref={uploadInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>
            </div>

            {error && (
              <p className="text-[11px] text-danger px-5 py-[6px] m-0 border-b border-danger/20 shrink-0">
                {error}
              </p>
            )}

            {/* Content + Preview */}
            <div className="flex flex-1 overflow-hidden">
              {/* File list / grid */}
              <div className="relative flex-1 flex flex-col overflow-hidden min-w-0">
                {/* Cloud panels */}
                {(nav.kind === "cloud_branch" ||
                  nav.kind === "cloud_shared") && (
                  <div className="flex-1 overflow-y-auto py-2">
                    {cloudEntries.length === 0 ? (
                      <div className="flex flex-col items-center justify-center text-muted text-xs py-12 gap-2">
                        <CloudIcon className="w-8 h-8 text-muted/50" />
                        <p className="m-0">No synced files in this section.</p>
                      </div>
                    ) : (
                      cloudEntries.map((info) => (
                        <div
                          key={info.artifact_id}
                          className="flex items-center gap-[10px] px-5 py-[8px] border-b border-line text-[12px] hover:bg-bg-2 transition-colors"
                        >
                          <SyncCell info={info} />
                          <span
                            className="flex-1 text-ink overflow-hidden text-ellipsis whitespace-nowrap"
                            title={info.cloud_key ?? ""}
                          >
                            {info.cloud_key?.split("/").pop() ??
                              info.artifact_id}
                          </span>
                          <span className="text-[11px] text-ink-3 font-mono shrink-0">
                            {info.last_synced_ms
                              ? `Synced ${formatDate(info.last_synced_ms)}`
                              : "Not yet synced"}
                          </span>
                          {info.sync_error && (
                            <span
                              className="flex items-center gap-1 text-[11px] text-danger shrink-0"
                              title={info.sync_error}
                            >
                              <AlertTriangleIcon className={iconCls} />{" "}
                              {info.sync_error.slice(0, 40)}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* List view */}
                {nav.kind !== "cloud_branch" &&
                  nav.kind !== "cloud_shared" &&
                  viewMode === "list" && (
                    <AssetTable
                      visible={visible}
                      syncInfoMap={syncInfoMap}
                      selected={selected}
                      query={query}
                      zoom={zoom}
                      onSelect={setSelected}
                      onContextMenu={handleCtx}
                      onNavigate={handleNavigate}
                    />
                  )}

                {/* Grid view */}
                {nav.kind !== "cloud_branch" &&
                  nav.kind !== "cloud_shared" &&
                  viewMode === "grid" && (
                    <AssetGrid
                      visible={visible}
                      syncInfoMap={syncInfoMap}
                      selected={selected}
                      query={query}
                      zoom={zoom}
                      onSelect={setSelected}
                      onContextMenu={handleCtx}
                      onNavigate={handleNavigate}
                    />
                  )}

                {/* Zoom control bar */}
                <ZoomControls
                  zoom={zoom}
                  minZoom={MIN_ZOOM}
                  maxZoom={MAX_ZOOM}
                  zoomStep={ZOOM_STEP}
                  onZoomIn={zoomIn}
                  onZoomOut={zoomOut}
                  onZoomReset={zoomReset}
                  onZoomChange={setZoom}
                />
              </div>
            </div>
          </main>
        </div>

        {/* Floating preview panel — outside the flex layout */}
        {selected && (
          <PreviewPanel
            entry={selected}
            syncInfo={syncInfoMap.get(selected.id)}
            onClose={() => setSelected(null)}
            onShare={handleShare}
          />
        )}

        {/* ── Full-width footer ───────────────────────────────────────────────── */}
        <footer className="flex items-center justify-between px-4 h-[26px] border-t border-line bg-bg-1 shrink-0 gap-4">
          {/* Left: path */}
          <span className="flex items-center gap-[6px] font-mono text-[10px] text-muted min-w-0 overflow-hidden">
            <span className="w-[5px] h-[5px] rounded-full bg-muted/60 shrink-0" />
            {settings ? (
              <span
                className="overflow-hidden text-ellipsis whitespace-nowrap"
                title={settings.base_path}
              >
                {settings.base_path}
                {nav.kind === "service" ? `/${nav.name}` : ""}
                {crumbs.map((c) => `/${c.label}`).join("")}
              </span>
            ) : (
              <span className="text-muted/50">
                {nav.kind === "cloud_branch" || nav.kind === "cloud_shared"
                  ? `${cloudEntries.length} synced item${cloudEntries.length !== 1 ? "s" : ""}`
                  : `${visible.length} item${visible.length !== 1 ? "s" : ""}`}
              </span>
            )}
          </span>

          {/* Right: sync status + branch */}
          <div className="flex items-center gap-3 shrink-0">
            {lastSyncLabel && (
              <span className="flex items-center gap-[4px] text-[10px] text-muted font-mono">
                <RefreshCwIcon className="w-2.5 h-2.5 shrink-0" />
                {lastSyncLabel}
              </span>
            )}
            <span className="flex items-center gap-[5px] text-[10px] text-muted font-mono">
              <span className="w-[5px] h-[5px] rounded-full bg-accent/60 shrink-0" />
              Downtown Branch
            </span>
          </div>
        </footer>

        {/* Overlays */}
        {ctxMenu && (
          <AssetContextMenu
            menu={ctxMenu}
            syncInfo={syncInfoMap.get(ctxMenu.entry.id) ?? null}
            onOpen={handleOpen}
            onPreview={(e) => setSelected(e)}
            onShare={handleShare}
            onMoveTo={handleMoveTo}
            onStar={handleStar}
            onRename={(e) => setRenaming(e)}
            onDelete={handleDelete}
            onSyncNow={handleSyncNow}
            onClose={() => setCtxMenu(null)}
          />
        )}
        {renaming && (
          <RenameModal
            entry={renaming}
            onConfirm={handleRename}
            onCancel={() => setRenaming(null)}
          />
        )}
        {newFolder && (
          <NewFolderModal
            onConfirm={handleNewFolder}
            onCancel={() => setNewFolder(false)}
          />
        )}
        {sharing && (
          <ShareDialog
            artifact={sharing}
            syncInfo={syncInfoMap.get(sharing.id) ?? null}
            onClose={() => setSharing(null)}
            onSyncToggled={() => {
              loadEntries();
              invoke<StorageUsage>("get_storage_usage")
                .then(setStorageUsage)
                .catch(() => {});
            }}
          />
        )}
        {movingEntry && (
          <MoveFolderModal
            entry={movingEntry}
            onConfirm={handleMoveConfirm}
            onCancel={() => setMovingEntry(null)}
          />
        )}
        <ConfirmDialog
          open={deleteConfirmEntry !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteConfirmEntry(null);
          }}
          title="Delete file?"
          description={`This will permanently delete "${deleteConfirmEntry?.name}". This cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={async () => {
            if (!deleteConfirmEntry) return;
            try {
              await invoke("delete_artifact", { id: deleteConfirmEntry.id });
              if (selected?.id === deleteConfirmEntry.id) setSelected(null);
              setDeleteConfirmEntry(null);
              await loadEntries();
            } catch (err) {
              setError(String(err));
              setDeleteConfirmEntry(null);
            }
          }}
        />
      </div>
    </div>
  );
}
