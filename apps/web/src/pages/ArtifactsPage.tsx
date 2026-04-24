import { useCallback, useEffect, useState } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  addUpload,
  updateUpload,
  removeUpload,
  useUploads,
} from "../stores/upload-store";
import { ShareDialog } from "../components/ShareDialog";
import { invoke } from "../lib/tauri";
import { importArtifactFile } from "../lib/commands/artifacts";
import type {
  ArtifactEntry,
  ArtifactsSettings,
  CloudSyncInfo,
  ServiceProject,
  StorageUsage,
} from "../lib/types";
import { mimeCategory, formatDate } from "../lib/artifact-utils";

import { ArtifactsSidebar } from "../components/artifacts/ArtifactsSidebar";
import type { Nav } from "../components/artifacts/ArtifactsSidebar";
import { ArtifactContextMenu } from "../components/artifacts/ArtifactContextMenu";
import type { CtxMenu } from "../components/artifacts/ArtifactContextMenu";
import { RenameModal, NewFolderModal, MoveFolderModal } from "../components/artifacts/ArtifactModals";
import { ArtifactPreviewPanel } from "../components/artifacts/ArtifactPreviewPanel";
import { CloudEntriesList } from "../components/artifacts/ArtifactSyncCells";
import { ArtifactList } from "../components/artifacts/ArtifactList";
import { ArtifactGrid } from "../components/artifacts/ArtifactGrid";
import {
  ArtifactTopbar,
  ArtifactSectionHeader,
  ArtifactFilterPills,
  ArtifactFooter,
} from "../components/artifacts/ArtifactToolbar";
import type { ArtifactCategory } from "../lib/types";

export function ArtifactsPage({ onBack }: { onBack: () => void }) {
  const [projects, setProjects] = useState<ServiceProject[]>([]);
  const [nav, setNav] = useState<Nav>({ kind: "all" });
  const [entries, setEntries] = useState<ArtifactEntry[]>([]);
  const pendingUploads = useUploads();
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [crumbs, setCrumbs] = useState<
    Array<{ label: string; parent: string | null }>
  >([]);
  const [filter, setFilter] = useState<ArtifactCategory | "all">("all");
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

  const [syncInfoMap, setSyncInfoMap] = useState<Map<string, CloudSyncInfo>>(
    new Map(),
  );
  const [sharing, setSharing] = useState<ArtifactEntry | null>(null);
  const [movingEntry, setMovingEntry] = useState<ArtifactEntry | null>(null);
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);
  const [cloudEntries, setCloudEntries] = useState<CloudSyncInfo[]>([]);

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

  const loadSyncInfo = (list: ArtifactEntry[]) => {
    for (const e of list) {
      invoke<CloudSyncInfo | null>("get_cloud_sync_info", {
        artifactId: e.id,
      })
        .then((info) => {
          if (info) {
            setSyncInfoMap((prev) => new Map(prev).set(e.id, info));
          }
        })
        .catch((err) => console.error(err));
    }
  };

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
        list = await invoke<ArtifactEntry[]>("list_artifacts", {
          serviceId: svcId,
          parentPath,
        });
      }
      setEntries(list);
      loadSyncInfo(list);
    } catch (e) {
      setError(String(e));
    }
  }, [nav, parentPath, debouncedQuery]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // ── Navigation handlers ─────────────────────────────────────────────────────

  const handleNav = (n: Nav) => {
    setNav(n);
    setParentPath(null);
    setCrumbs([]);
    setQuery("");
    setDebouncedQuery("");
    setFilter("all");
    setSelected(null);
    if (n.kind !== "cloud_branch" && n.kind !== "cloud_shared")
      setCloudEntries([]);
  };

  const handleNavigate = (e: ArtifactEntry) => {
    if (!e.is_dir) return;
    setCrumbs((prev) => [...prev, { label: e.name, parent: parentPath }]);
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
    setCrumbs((prev) => prev.slice(0, idx));
    setParentPath(crumb.parent);
  };

  // ── Artifact action handlers ────────────────────────────────────────────────

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

  const handleDelete = async (e: ArtifactEntry) => {
    const msg = e.is_dir
      ? `Delete folder "${e.name}" and all its contents? This cannot be undone.`
      : `Delete "${e.name}"? This cannot be undone.`;
    if (!window.confirm(msg)) return;
    try {
      await invoke("delete_artifact", { id: e.id });
      if (selected?.id === e.id) setSelected(null);
      await loadEntries();
    } catch (err) {
      setError(String(err));
    }
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

  const handleUpload = async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const sel = await open({ multiple: true, title: "Import files" });
    if (!sel) return;
    const paths = Array.isArray(sel) ? sel : [sel];
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

  // ── Derived values ──────────────────────────────────────────────────────────

  const sectionTitle =
    nav.kind === "all"
      ? "All Artifacts"
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

  const visible = entries.filter(
    (e) =>
      filter === "all" || (!e.is_dir && mimeCategory(e.mime_type) === filter),
  );

  const isCloud =
    nav.kind === "cloud_branch" || nav.kind === "cloud_shared";

  const lastSyncMs = storageUsage?.last_updated_ms;
  const lastSyncLabel = lastSyncMs
    ? (() => {
        const diff = Date.now() - lastSyncMs;
        if (diff < 60_000) return `Synced ${Math.round(diff / 1000)}s ago`;
        if (diff < 3_600_000)
          return `Synced ${Math.round(diff / 60_000)}m ago`;
        return `Synced ${formatDate(lastSyncMs)}`;
      })()
    : null;

  const handleSelect = (e: ArtifactEntry) =>
    setSelected((prev) => (prev?.id === e.id ? null : e));

  return (
    <SidebarProvider>
      <ArtifactsSidebar
        projects={projects}
        nav={nav}
        onNav={handleNav}
        usage={storageUsage}
        cloudExpanded={cloudExpanded}
        onToggleCloud={() => setCloudExpanded((v) => !v)}
      />
      <SidebarInset
        data-qa="artifacts-root"
        className="flex h-screen flex-col overflow-hidden bg-bg font-sans text-ink"
      >
        <ArtifactTopbar
          nav={nav}
          crumbs={crumbs}
          showSearch={showSearch}
          query={query}
          syncing={syncing}
          viewMode={viewMode}
          onBack={onBack}
          onCrumb={handleCrumb}
          onToggleSearch={() => setShowSearch((v) => !v)}
          onQueryChange={setQuery}
          onSyncAll={handleSyncAll}
          onSetViewMode={setViewMode}
        />

        <div className="flex flex-1 overflow-hidden">
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-bg">
            <ArtifactSectionHeader
              sectionTitle={sectionTitle}
              entryCount={entries.length}
              totalSize={totalSize}
              showNewMenu={showNewMenu}
              onNewFolder={() => setNewFolder(true)}
              onToggleNewMenu={() => setShowNewMenu((v) => !v)}
              onUpload={handleUpload}
            />

            <ArtifactFilterPills filter={filter} onFilter={setFilter} />

            {error && (
              <p className="m-0 shrink-0 border-b border-danger/20 px-5 py-[6px] text-[11px] text-danger">
                {error}
              </p>
            )}

            <div className="flex flex-1 overflow-hidden">
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                {isCloud && <CloudEntriesList entries={cloudEntries} />}

                {!isCloud && viewMode === "list" && (
                  <ArtifactList
                    visible={visible}
                    pendingUploads={pendingUploads}
                    syncInfoMap={syncInfoMap}
                    selected={selected}
                    query={query}
                    onSelect={handleSelect}
                    onContextMenu={handleCtx}
                    onNavigate={handleNavigate}
                  />
                )}

                {!isCloud && viewMode === "grid" && (
                  <ArtifactGrid
                    visible={visible}
                    pendingUploads={pendingUploads}
                    syncInfoMap={syncInfoMap}
                    selected={selected}
                    query={query}
                    onSelect={handleSelect}
                    onContextMenu={handleCtx}
                    onNavigate={handleNavigate}
                  />
                )}
              </div>

              {selected && (
                <ArtifactPreviewPanel
                  entry={selected}
                  syncInfo={syncInfoMap.get(selected.id)}
                  onClose={() => setSelected(null)}
                  onShare={setSharing}
                />
              )}
            </div>
          </main>
        </div>

        <ArtifactFooter
          settings={settings}
          nav={nav}
          crumbs={crumbs}
          visibleCount={visible.length}
          cloudEntriesCount={cloudEntries.length}
          lastSyncLabel={lastSyncLabel}
        />

        {/* Overlays */}
        {ctxMenu && (
          <ArtifactContextMenu
            menu={ctxMenu}
            syncInfo={syncInfoMap.get(ctxMenu.entry.id) ?? null}
            onOpen={handleOpen}
            onShare={setSharing}
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
      </SidebarInset>
    </SidebarProvider>
  );
}
