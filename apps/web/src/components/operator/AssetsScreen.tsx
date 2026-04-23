import { useCallback, useEffect, useState } from "react";
import { ShareDialog } from "../ShareDialog";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { invoke } from "../../lib/tauri";
import {
  addUpload,
  updateUpload,
  removeUpload,
} from "../../stores/upload-store";
import { importArtifactFile, regenerateThumbnails } from "../../lib/commands/artifacts";
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

import {
  formatDate,
  formatStorageBytes,
  mimeCategory,
  iconCls,
} from "./assets/helpers";
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
  const [crumbs, setCrumbs] = useState<
    Array<{ label: string; path: string | null }>
  >([]);
  const ALL_CATEGORIES: ArtifactCategory[] = [
    "image",
    "video",
    "audio",
    "document",
    "slide",
  ];
  const [activeFilters, setActiveFilters] = useState<Set<ArtifactCategory>>(
    new Set(ALL_CATEGORIES),
  );
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
  const [regenerating, setRegenerating] = useState(false);

  // ── Cloud sync state ────────────────────────────────────────────────────────
  const [syncInfoMap, setSyncInfoMap] = useState<Map<string, CloudSyncInfo>>(
    new Map(),
  );
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


  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    invoke<ServiceProject[]>("list_service_projects")
      .then((list) => setProjects(list.filter((p) => p.closed_at_ms === null)))
      .catch((err) => console.error(err));
    invoke<ArtifactsSettings>("get_artifacts_settings")
      .then(setSettings)
      .catch((err) => console.error(err));
    invoke<StorageUsage>("get_storage_usage")
      .then(setStorageUsage)
      .catch((err) => console.error(err));
  }, []);

  const loadEntries = useCallback(async () => {
    setError(null);
    try {
      if (nav.kind === "cloud_branch" || nav.kind === "cloud_shared") {
        const section = nav.kind === "cloud_branch" ? "branch" : "shared";
        const infos = await invoke<CloudSyncInfo[]>("list_cloud_artifacts", {
          section,
        });
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
        loadSyncInfo(list);
        return;
      }

      let list: ArtifactEntry[] = [];
      if (nav.kind === "recent") {
        list = await invoke<ArtifactEntry[]>("list_recent_artifacts", {
          limit: 50,
        });
      } else if (nav.kind === "starred") {
        list = await invoke<ArtifactEntry[]>("list_starred_artifacts");
      } else {
        const svcId = nav.kind === "service" ? nav.id : null;
        if (nav.kind === "all" && parentPath === null) {
          // "All Assets" root: show both root-level folders (parent_path=NULL) and _local bucket files
          const [rootItems, localItems] = await Promise.all([
            invoke<ArtifactEntry[]>("list_artifacts", {
              serviceId: null,
              parentPath: null,
            }),
            invoke<ArtifactEntry[]>("list_artifacts", {
              serviceId: null,
              parentPath: "_local",
            }),
          ]);
          // Merge and deduplicate by id
          const seen = new Set<string>();
          list = [...rootItems, ...localItems].filter((e) => {
            if (seen.has(e.id)) return false;
            seen.add(e.id);
            return true;
          });
        } else {
          list = await invoke<ArtifactEntry[]>("list_artifacts", {
            serviceId: svcId,
            parentPath,
          });
        }
      }
      setEntries(list);
      loadSyncInfo(list);
    } catch (e) {
      setError(String(e));
    }
  }, [nav, parentPath, debouncedQuery]);

  const loadSyncInfo = (list: ArtifactEntry[]) => {
    if (list.length === 0) return;
    const ids = list.map((e) => e.id);
    invoke<CloudSyncInfo[]>("get_cloud_sync_infos", { artifactIds: ids })
      .then((infos) => {
        const next = new Map<string, CloudSyncInfo>();
        for (const info of infos) {
          next.set(info.artifact_id, info);
        }
        setSyncInfoMap(next);
      })
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Patch thumbnail_path in-place when a background thumbnail becomes ready
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen<{ id: string; thumbnail_path: string }>(
        "artifacts://thumbnail-ready",
        (ev) => {
          const { id, thumbnail_path } = ev.payload;
          setEntries((prev) =>
            prev.map((e) =>
              e.id === id ? { ...e, thumbnail_path } : e,
            ),
          );
        },
      ).then((fn) => {
        unlisten = fn;
      });
    });
    return () => unlisten?.();
  }, []);

  const handleNav = (n: Nav) => {
    setNav(n);
    setParentPath(null);
    setCrumbs([]);
    setQuery("");
    setDebouncedQuery("");
    setActiveFilters(new Set(ALL_CATEGORIES));
    setSelected(null);
    if (n.kind !== "cloud_branch" && n.kind !== "cloud_shared")
      setCloudEntries([]);
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
      await invoke("create_artifact_dir", {
        serviceId: svcId,
        parentPath,
        name,
      });
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

  const handleSyncNow = (e: ArtifactEntry) => {
    setError(null);
    setSyncInfoMap((prev) => {
      const next = new Map(prev);
      const info = next.get(e.id);
      if (info) next.set(e.id, { ...info, status: "syncing" as const });
      return next;
    });
    invoke<CloudSyncInfo>("sync_artifact_now", { artifactId: e.id })
      .then((updated) => {
        setSyncInfoMap((prev) => new Map(prev).set(e.id, updated));
        invoke<StorageUsage>("get_storage_usage")
          .then(setStorageUsage)
          .catch((err) => console.error(err));
      })
      .catch((err) => {
        setSyncInfoMap((prev) => {
          const next = new Map(prev);
          const info = next.get(e.id);
          if (info)
            next.set(e.id, {
              ...info,
              status: "error" as const,
              sync_error: String(err),
            });
          return next;
        });
      });
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const result = await invoke<{
        total: number;
        succeeded: number;
        failed: number;
      }>("sync_all_artifacts");
      await loadEntries();
      invoke<StorageUsage>("get_storage_usage")
        .then(setStorageUsage)
        .catch((err) => console.error(err));
      if (result.failed > 0) {
        setError(
          `Sync completed: ${result.succeeded}/${result.total} succeeded, ${result.failed} failed.`,
        );
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSyncing(false);
    }
  };

  const handleRegenerateThumbnails = async () => {
    setRegenerating(true);
    try {
      await regenerateThumbnails();
      // Results stream in via artifacts://thumbnail-ready → loadEntries()
    } catch (err) {
      setError(String(err));
    } finally {
      setRegenerating(false);
    }
  };

  const handleUpload = async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple: true,
      title: "Import files",
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    const svcId = nav.kind === "service" ? nav.id : null;

    for (const filePath of paths) {
      const fileName = filePath.split("/").pop() ?? filePath;
      const placeholderId = `uploading-${fileName}-${Date.now()}`;
      addUpload({
        id: placeholderId,
        name: fileName,
        previewUrl: "",
        size: 0,
        status: "uploading",
        serviceId: svcId,
        parentPath,
      });

      importArtifactFile(filePath, svcId, parentPath)
        .then((entry) => {
          updateUpload(placeholderId, { status: "done", realEntry: entry });
          setEntries((prev) => [entry, ...prev.filter((e) => e.id !== entry.id)]);
          removeUpload(placeholderId);
        })
        .catch((err) => {
          updateUpload(placeholderId, { status: "error", error: String(err) });
        });
    }
  };

  const sectionTitle =
    nav.kind === "all"
      ? "All Assets"
      : nav.kind === "recent"
        ? "Recent"
        : nav.kind === "starred"
          ? "Starred"
          : nav.kind === "cloud_branch"
            ? "My Branch — Cloud"
            : nav.kind === "cloud_shared"
              ? "Church Shared"
              : nav.name;

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
        className="flex flex-1 flex-col overflow-hidden bg-bg font-sans text-ink"
      >
        {/* ── Compact toolbar ────────────────────────────────────────────────── */}
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line bg-bg-1 px-4">
          {/* Breadcrumb */}
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-[12px]">
            <button
              className="shrink-0 cursor-pointer border-none bg-transparent font-sans text-[12px] font-medium text-ink transition-colors hover:text-accent"
              onClick={() => {
                handleNav({ kind: "all" });
              }}
            >
              Assets
            </button>
            {nav.kind === "service" && (
              <>
                <span className="mx-[2px] text-muted">/</span>
                <button
                  className="max-w-[160px] cursor-pointer overflow-hidden rounded border-none bg-transparent px-[3px] py-[2px] font-sans text-[12px] text-ellipsis whitespace-nowrap text-ink-3 transition-colors hover:text-accent"
                  onClick={() => handleCrumb(-1)}
                >
                  {nav.name}
                </button>
              </>
            )}
            {crumbs.map((c, i) => (
              <span key={i} className="flex shrink-0 items-center gap-[3px]">
                <span className="text-muted">/</span>
                <button
                  className="cursor-pointer rounded border-none bg-transparent px-[3px] py-[2px] font-sans text-[12px] whitespace-nowrap text-ink transition-colors hover:text-accent"
                  onClick={() => handleCrumb(i)}
                >
                  {c.label}
                </button>
              </span>
            ))}
          </div>

          {/* Right tools */}
          <div className="flex shrink-0 items-center gap-[6px]">
            {showSearch && (
              <input
                data-qa="artifacts-search"
                className="w-[160px] rounded border border-line bg-bg-2 px-[8px] py-[4px] font-sans text-[11px] text-ink transition-colors outline-none placeholder:text-muted focus:border-accent focus:outline-none"
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
              className="cursor-pointer rounded border-none bg-transparent p-1 text-ink-3 transition-colors hover:text-ink"
              onClick={() => setShowSearch((v) => !v)}
              title="Search"
            >
              <SearchIcon className={iconCls} />
            </button>
            <button
              className={[
                "flex cursor-pointer items-center gap-[5px] rounded border px-[10px] py-[5px] font-sans text-[11px] transition-colors disabled:cursor-not-allowed",
                syncing
                  ? "border-accent/40 bg-accent-soft text-accent"
                  : "border-line text-ink-3 hover:border-line-strong hover:text-ink",
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
            <button
              className={[
                "flex cursor-pointer items-center gap-[5px] rounded border px-[10px] py-[5px] font-sans text-[11px] transition-colors disabled:cursor-not-allowed",
                regenerating
                  ? "border-accent/40 bg-accent-soft text-accent"
                  : "border-line text-ink-3 hover:border-line-strong hover:text-ink",
              ].join(" ")}
              onClick={handleRegenerateThumbnails}
              disabled={regenerating}
              title="Generate missing thumbnails"
            >
              <span className={regenerating ? "animate-spin" : ""}>
                <RefreshCwIcon className={iconCls} />
              </span>
              Thumbnails
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
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-bg">
            {/* Section header */}
            <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-[10px]">
              <div className="flex min-w-0 flex-col">
                <h1 className="m-0 max-w-[280px] overflow-hidden font-serif text-xl leading-[1.3] text-ellipsis whitespace-nowrap text-ink">
                  {sectionTitle}
                </h1>
                {entries.length > 0 && (
                  <span className="mt-[1px] font-mono text-[11px] text-muted">
                    {entries.length} asset{entries.length !== 1 ? "s" : ""}
                    {totalSize > 0
                      ? ` \u00B7 ${formatStorageBytes(totalSize)}`
                      : ""}
                  </span>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {/* Filter dropdown */}
                <FilterDropdown
                  activeFilters={activeFilters}
                  allSelected={allSelected}
                  onToggle={toggleFilter}
                  onToggleAll={toggleAll}
                />

                {/* New + Upload */}
                <div className="relative">
                  <div className="flex overflow-hidden rounded border border-accent/30">
                    <button
                      className="flex cursor-pointer items-center gap-[5px] border-r border-accent/50 bg-accent px-[10px] py-[5px] font-sans text-[11px] font-semibold text-accent-foreground transition-[filter] hover:brightness-[1.1]"
                      onClick={() => setNewFolder(true)}
                    >
                      + New
                    </button>
                    <button
                      className="cursor-pointer bg-accent/90 px-[6px] py-[5px] text-accent-foreground transition-[filter] hover:brightness-[1.1]"
                      onClick={() => setShowNewMenu((v) => !v)}
                      title="More options"
                    >
                      <ChevronDownIcon className="h-3 w-3 shrink-0" />
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
                  className="flex cursor-pointer items-center gap-[5px] rounded border border-line bg-transparent px-[10px] py-[5px] font-sans text-[11px] text-ink-3 transition-colors hover:border-line-strong hover:text-ink"
                  onClick={handleUpload}
                  title="Upload files"
                >
                  <UploadIcon className={iconCls} />
                  Upload
                </button>
              </div>
            </div>

            {error && (
              <p className="m-0 shrink-0 border-b border-danger/20 px-5 py-[6px] text-[11px] text-danger">
                {error}
              </p>
            )}

            {/* Content + Preview */}
            <div className="flex flex-1 overflow-hidden">
              {/* File list / grid */}
              <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
                {/* Cloud panels */}
                {(nav.kind === "cloud_branch" ||
                  nav.kind === "cloud_shared") && (
                  <div className="flex-1 overflow-y-auto py-2">
                    {cloudEntries.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-2 py-12 text-xs text-muted">
                        <CloudIcon className="h-8 w-8 text-muted/50" />
                        <p className="m-0">No synced files in this section.</p>
                      </div>
                    ) : (
                      cloudEntries.map((info) => (
                        <div
                          key={info.artifact_id}
                          className="flex items-center gap-[10px] border-b border-line px-5 py-[8px] text-[12px] transition-colors hover:bg-bg-2"
                        >
                          <SyncCell info={info} />
                          <span
                            className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-ink"
                            title={info.cloud_key ?? ""}
                          >
                            {info.cloud_key?.split("/").pop() ??
                              info.artifact_id}
                          </span>
                          <span className="shrink-0 font-mono text-[11px] text-ink-3">
                            {info.last_synced_ms
                              ? `Synced ${formatDate(info.last_synced_ms)}`
                              : "Not yet synced"}
                          </span>
                          {info.sync_error && (
                            <span
                              className="flex shrink-0 items-center gap-1 text-[11px] text-danger"
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
        <footer className="flex h-[26px] shrink-0 items-center justify-between gap-4 border-t border-line bg-bg-1 px-4">
          {/* Left: path */}
          <span className="flex min-w-0 items-center gap-[6px] overflow-hidden font-mono text-[10px] text-muted">
            <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-muted/60" />
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
          <div className="flex shrink-0 items-center gap-3">
            {lastSyncLabel && (
              <span className="flex items-center gap-[4px] font-mono text-[10px] text-muted">
                <RefreshCwIcon className="h-2.5 w-2.5 shrink-0" />
                {lastSyncLabel}
              </span>
            )}
            <span className="flex items-center gap-[5px] font-mono text-[10px] text-muted">
              <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-accent/60" />
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
                .catch((err) => console.error(err));
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
