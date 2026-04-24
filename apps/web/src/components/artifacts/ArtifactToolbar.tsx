import { useEffect, useRef } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { Nav } from "./ArtifactsSidebar";
import { formatStorageBytes, ARTIFACT_FILTERS } from "../../lib/artifact-utils";
import type { ArtifactCategory } from "../../lib/types";
import {
  IconSearch,
  IconSync,
  IconList,
  IconGrid,
  IconChevronDown,
  IconUpload,
} from "./ArtifactIcons";

// ─── New dropdown menu ────────────────────────────────────────────────────────

export function ArtifactNewMenu({
  onNewFolder,
  onClose,
}: {
  onNewFolder: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const btnCls =
    "block w-full text-left bg-transparent border-none font-sans text-[12px] text-ink px-[12px] py-[7px] cursor-pointer transition-colors hover:bg-white/[0.06] whitespace-nowrap";

  return (
    <div
      ref={ref}
      className="absolute top-full right-0 z-[200] mt-[3px] min-w-[140px] rounded-[5px] border border-line bg-bg-2 py-1 shadow-[0_8px_32px_rgba(0,0,0,0.7)]"
    >
      <button
        className={btnCls}
        onClick={() => {
          onNewFolder();
          onClose();
        }}
      >
        New Folder
      </button>
    </div>
  );
}

// ─── Top bar ─────────────────────────────────────────────────────────────────

export function ArtifactTopbar({
  nav,
  crumbs,
  showSearch,
  query,
  syncing,
  viewMode,
  onBack,
  onCrumb,
  onToggleSearch,
  onQueryChange,
  onSyncAll,
  onSetViewMode,
}: {
  nav: Nav;
  crumbs: Array<{ label: string; parent: string | null }>;
  showSearch: boolean;
  query: string;
  syncing: boolean;
  viewMode: "list" | "grid";
  onBack: () => void;
  onCrumb: (idx: number) => void;
  onToggleSearch: () => void;
  onQueryChange: (q: string) => void;
  onSyncAll: () => void;
  onSetViewMode: (m: "list" | "grid") => void;
}) {
  const viewBtnCls = (active: boolean) =>
    [
      "bg-transparent border border-line text-ink-3 w-7 h-[26px] rounded-[3px] cursor-pointer",
      "flex items-center justify-center transition-colors hover:text-ink",
      active ? "border-accent/60 text-accent" : "",
    ].join(" ");

  return (
    <header
      data-qa="artifacts-topbar"
      className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-4"
    >
      <SidebarTrigger className="h-7 w-7 shrink-0 text-ink-3 hover:text-ink" />
      <button
        data-qa="artifacts-back-btn"
        className="mr-2 flex shrink-0 cursor-pointer items-center gap-[5px] border-r border-none border-line bg-transparent p-0 pr-2 font-sans text-[12px] text-ink-3 transition-colors hover:text-ink"
        onClick={onBack}
        title="Back to Operator"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M9 3L5 7l4 4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Operator
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-[3px] overflow-hidden text-[12px]">
        <span className="shrink-0 text-ink-3">Artifacts</span>
        {nav.kind === "service" && (
          <>
            <span className="mx-[2px] text-muted">/</span>
            <button
              className="max-w-[160px] cursor-pointer overflow-hidden rounded border-none bg-transparent px-[3px] py-[2px] font-sans text-[12px] text-ellipsis whitespace-nowrap text-ink-3 transition-colors hover:text-ink"
              onClick={() => onCrumb(-1)}
            >
              {nav.name}
            </button>
          </>
        )}
        {crumbs.map((c, i) => (
          <span key={i} className="flex shrink-0 items-center gap-[3px]">
            <span className="text-muted">/</span>
            <button
              className="cursor-pointer rounded border-none bg-transparent px-[3px] py-[2px] font-sans text-[12px] whitespace-nowrap text-ink transition-colors hover:text-ink"
              onClick={() => onCrumb(i)}
            >
              {c.label}
            </button>
          </span>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-[6px]">
        {showSearch && (
          <input
            data-qa="artifacts-search"
            className="w-[160px] rounded-[3px] border border-line bg-bg-1 px-[8px] py-[4px] font-sans text-[11px] text-ink transition-colors outline-none placeholder:text-muted focus:border-accent"
            type="search"
            placeholder="Search files…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            autoFocus
            onBlur={() => {
              if (!query) onToggleSearch();
            }}
          />
        )}
        <button
          className="cursor-pointer rounded border-none bg-transparent p-1 text-ink-3 transition-colors hover:text-ink"
          onClick={onToggleSearch}
          title="Search"
        >
          <IconSearch />
        </button>
        <button
          className={[
            "flex cursor-pointer items-center gap-[5px] rounded-[3px] border px-[10px] py-[5px] font-sans text-[11px] transition-colors",
            syncing
              ? "border-accent/40 bg-accent-soft text-accent"
              : "border-line text-ink-3 hover:border-line-strong hover:text-ink",
          ].join(" ")}
          onClick={onSyncAll}
          disabled={syncing}
          title="Sync all files to cloud"
        >
          <span className={syncing ? "animate-spin" : ""}>
            <IconSync />
          </span>
          Sync
        </button>
        <div className="flex gap-[3px]">
          <button
            data-qa="artifacts-view-list"
            className={viewBtnCls(viewMode === "list")}
            onClick={() => onSetViewMode("list")}
            title="List view"
          >
            <IconList />
          </button>
          <button
            data-qa="artifacts-view-grid"
            className={viewBtnCls(viewMode === "grid")}
            onClick={() => onSetViewMode("grid")}
            title="Grid view"
          >
            <IconGrid />
          </button>
        </div>
      </div>
    </header>
  );
}

// ─── Section header (title + New/Upload buttons) ──────────────────────────────

export function ArtifactSectionHeader({
  sectionTitle,
  entryCount,
  totalSize,
  showNewMenu,
  onNewFolder,
  onToggleNewMenu,
  onUpload,
}: {
  sectionTitle: string;
  entryCount: number;
  totalSize: number;
  showNewMenu: boolean;
  onNewFolder: () => void;
  onToggleNewMenu: () => void;
  onUpload: () => void;
}) {

  return (
    <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-[10px]">
      <div className="flex min-w-0 flex-col">
        <h1 className="m-0 max-w-[280px] overflow-hidden text-[14px] leading-[1.3] font-semibold text-ellipsis whitespace-nowrap text-ink">
          {sectionTitle}
        </h1>
        {entryCount > 0 && (
          <span className="mt-[1px] font-mono text-[11px] text-muted">
            {entryCount} artifact{entryCount !== 1 ? "s" : ""}
            {totalSize > 0 ? ` · ${formatStorageBytes(totalSize)}` : ""}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-[6px]">
        <div className="relative">
          <div className="flex overflow-hidden rounded-[3px] border border-line">
            <button
              className="flex cursor-pointer items-center gap-[5px] border-r border-accent/50 bg-accent px-[10px] py-[5px] font-sans text-[11px] font-semibold text-accent-foreground transition-[filter] hover:brightness-[1.1]"
              onClick={onNewFolder}
            >
              + New
            </button>
            <button
              className="cursor-pointer bg-accent/90 px-[6px] py-[5px] text-accent-foreground transition-[filter] hover:brightness-[1.1]"
              onClick={onToggleNewMenu}
              title="More options"
            >
              <IconChevronDown />
            </button>
          </div>
          {showNewMenu && (
            <ArtifactNewMenu
              onNewFolder={onNewFolder}
              onClose={onToggleNewMenu}
            />
          )}
        </div>
        <button
          className="flex cursor-pointer items-center gap-[5px] rounded-[3px] border border-line bg-transparent px-[10px] py-[5px] font-sans text-[11px] text-ink-3 transition-colors hover:border-line-strong hover:text-ink"
          onClick={onUpload}
          title="Upload files"
        >
          <IconUpload />
          Upload
        </button>
      </div>
    </div>
  );
}

// ─── Filter pills ─────────────────────────────────────────────────────────────

export function ArtifactFilterPills({
  filter,
  onFilter,
}: {
  filter: ArtifactCategory | "all";
  onFilter: (f: ArtifactCategory | "all") => void;
}) {
  return (
    <div className="scrollbar-none flex shrink-0 gap-[5px] overflow-x-auto border-b border-line px-5 py-[8px]">
      {ARTIFACT_FILTERS.map((f) => (
        <button
          key={f.value}
          data-qa={`artifacts-filter-${f.value}`}
          className={[
            "shrink-0 cursor-pointer rounded-full px-[10px] py-[3px] font-sans text-[10px] font-medium tracking-[0.04em] whitespace-nowrap uppercase transition-colors",
            filter === f.value
              ? "border border-accent bg-accent text-accent-foreground"
              : "border border-line bg-transparent text-ink-3 hover:border-line-strong hover:text-ink",
          ].join(" ")}
          onClick={() => onFilter(f.value)}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────

export function ArtifactFooter({
  settings,
  nav,
  crumbs,
  visibleCount,
  cloudEntriesCount,
  lastSyncLabel,
}: {
  settings: { base_path: string } | null;
  nav: Nav;
  crumbs: Array<{ label: string; parent: string | null }>;
  visibleCount: number;
  cloudEntriesCount: number;
  lastSyncLabel: string | null;
}) {
  return (
    <footer className="flex h-[26px] shrink-0 items-center justify-between gap-4 border-t border-line bg-bg-1 px-4">
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
              ? `${cloudEntriesCount} synced item${cloudEntriesCount !== 1 ? "s" : ""}`
              : `${visibleCount} item${visibleCount !== 1 ? "s" : ""}`}
          </span>
        )}
      </span>

      <div className="flex shrink-0 items-center gap-3">
        {lastSyncLabel && (
          <span className="flex items-center gap-[4px] font-mono text-[10px] text-muted">
            <IconSync />
            {lastSyncLabel}
          </span>
        )}
        <span className="flex items-center gap-[5px] font-mono text-[10px] text-muted">
          <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-accent/60" />
          Downtown Branch
        </span>
      </div>
    </footer>
  );
}
