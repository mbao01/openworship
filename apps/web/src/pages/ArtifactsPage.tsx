import { useCallback, useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
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
  ArtifactCategory,
  ArtifactEntry,
  ArtifactsSettings,
  CloudSyncInfo,
  ServiceProject,
  StorageUsage,
} from "../lib/types";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@radix-ui/react-collapsible";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function mimeCategory(mime: string | null): ArtifactCategory {
  if (!mime) return "other";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (
    mime.includes("pdf") ||
    mime.includes("document") ||
    mime.startsWith("text/")
  )
    return "document";
  if (mime.includes("presentation") || mime.includes("powerpoint"))
    return "slide";
  return "other";
}

function formatStorageBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

// ─── Icons (inline SVG) ───────────────────────────────────────────────────────

function IconFolder() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M1.5 4.5C1.5 3.948 1.948 3.5 2.5 3.5H6L7.5 5H12.5C13.052 5 13.5 5.448 13.5 6V11.5C13.5 12.052 13.052 12.5 12.5 12.5H2.5C1.948 12.5 1.5 12.052 1.5 11.5V4.5Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconFile() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 1.5h5.5L11 4v8.5H3V1.5Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 1.5V4H11"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconImage() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="1.5"
        y="1.5"
        width="11"
        height="11"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <circle cx="4.5" cy="4.5" r="1" fill="currentColor" />
      <path
        d="M1.5 9l3-3 2.5 2.5 2-2 3 3"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconVideo() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="1"
        y="2.5"
        width="9"
        height="9"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path
        d="M10 5l3-1.5v7L10 9"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconAudio() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 5v4M6.5 3.5v7M9 5v4M11.5 4v6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconDoc() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 1.5h5.5L11 4v8.5H3V1.5Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path
        d="M5 6h4M5 8h3"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconSlide() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="1"
        y="2"
        width="12"
        height="8"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path
        d="M7 10v2M5 12h4"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCloud() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10 8.5c1.105 0 2-.784 2-1.75S11.105 5 10 5c-.09 0-.18.007-.27.02C9.42 3.866 8.298 3 7 3c-1.51 0-2.75 1.104-2.75 2.5 0 .046.002.09.004.136A1.75 1.75 0 0 0 3 7.25c0 .69.398 1.29.98 1.613"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M7 8v4M5.5 10.5l1.5 1.5 1.5-1.5"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M9 9l3 3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6.5 1v7M4 3.5L6.5 1 9 3.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M1.5 9.5v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconSync() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M11 6.5A4.5 4.5 0 0 1 2.636 9.364"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M2 6.5A4.5 4.5 0 0 1 10.364 3.636"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M10 1.5l.364 2.136L8.228 4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 11.5l-.364-2.136L4.772 9"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M2 3.5l3 3 3-3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconList() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 3.5h7M4 6.5h7M4 9.5h7M2 3.5h.01M2 6.5h.01M2 9.5h.01"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="1.5"
        y="1.5"
        width="4"
        height="4"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <rect
        x="7.5"
        y="1.5"
        width="4"
        height="4"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <rect
        x="1.5"
        y="7.5"
        width="4"
        height="4"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <rect
        x="7.5"
        y="7.5"
        width="4"
        height="4"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1.1"
      />
    </svg>
  );
}

function fileIcon(e: ArtifactEntry) {
  if (e.is_dir)
    return (
      <span className="text-accent/80">
        <IconFolder />
      </span>
    );
  const cat = mimeCategory(e.mime_type);
  const colorCls =
    cat === "image"
      ? "text-[#7ba6d4]"
      : cat === "video"
        ? "text-[#9a7dd4]"
        : cat === "audio"
          ? "text-[#7dd4a0]"
          : cat === "document"
            ? "text-[#d4a07d]"
            : cat === "slide"
              ? "text-[#d47d7d]"
              : "text-ink-3";
  return (
    <span className={colorCls}>
      {cat === "image" ? (
        <IconImage />
      ) : cat === "video" ? (
        <IconVideo />
      ) : cat === "audio" ? (
        <IconAudio />
      ) : cat === "document" ? (
        <IconDoc />
      ) : cat === "slide" ? (
        <IconSlide />
      ) : (
        <IconFile />
      )}
    </span>
  );
}

// ─── Nav types ────────────────────────────────────────────────────────────────

type Nav =
  | { kind: "all" }
  | { kind: "recent" }
  | { kind: "starred" }
  | { kind: "service"; id: string; name: string }
  | { kind: "cloud_branch" }
  | { kind: "cloud_shared" };

// ─── Sync badge + progress ────────────────────────────────────────────────────

function SyncCell({ info }: { info: CloudSyncInfo | undefined }) {
  if (!info || !info.sync_enabled)
    return <span className="text-[11px] text-muted">—</span>;

  if (info.status === "syncing" && info.progress !== null) {
    const pct = Math.round(info.progress * 100);
    return (
      <div className="flex items-center gap-[6px]">
        <div className="h-[3px] w-[48px] overflow-hidden rounded-full bg-line">
          <div
            className="h-full bg-accent transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-mono text-[10px] text-ink-3">{pct}%</span>
      </div>
    );
  }

  if (info.status === "synced") {
    return (
      <span className="text-accent" title="Synced to cloud">
        <svg
          width="13"
          height="13"
          viewBox="0 0 13 13"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M2 7l3 3 6-6"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  if (info.status === "queued")
    return (
      <span className="text-[10px] text-muted" title="Queued">
        ···
      </span>
    );
  if (info.status === "conflict")
    return (
      <span className="text-[10px] text-[#e89a00]" title="Conflict">
        ⚠
      </span>
    );
  if (info.status === "error")
    return (
      <span
        className="text-[10px] text-danger"
        title={info.sync_error ?? "Error"}
      >
        ✕
      </span>
    );

  return <span className="text-[11px] text-muted">—</span>;
}

// ─── Shared cell ──────────────────────────────────────────────────────────────

function SharedCell({ info }: { info: CloudSyncInfo | undefined }) {
  if (!info || !info.sync_enabled)
    return <span className="text-[11px] text-muted">—</span>;

  // We infer sharing state from cloud_key for now;
  // full ACL count would require a per-file query
  if (info.cloud_key?.includes("public")) {
    return (
      <span className="inline-flex items-center rounded-[3px] border border-accent/25 bg-accent-soft px-[6px] py-[2px] text-[10px] font-medium text-accent">
        Public
      </span>
    );
  }

  return <span className="text-[11px] text-muted">—</span>;
}

// ─── Artifacts Sidebar (shadcn Sidebar, collapsible="icon") ───────────────────

function ArtifactsSidebar({
  projects,
  nav,
  onNav,
  usage,
  cloudExpanded,
  onToggleCloud,
}: {
  projects: ServiceProject[];
  nav: Nav;
  onNav: (n: Nav) => void;
  usage: StorageUsage | null;
  cloudExpanded: boolean;
  onToggleCloud: () => void;
}) {
  const isActive = (n: Nav) => JSON.stringify(n) === JSON.stringify(nav);

  const storageLabel = usage
    ? `${formatStorageBytes(usage.used_bytes)}${usage.quota_bytes ? ` / ${formatStorageBytes(usage.quota_bytes)}` : " used"}`
    : "2.4 GB / 5 GB";
  const storagePct = usage?.quota_bytes
    ? Math.min(100, (usage.used_bytes / usage.quota_bytes) * 100)
    : 48;

  return (
    <Sidebar
      data-qa="artifacts-sidebar"
      collapsible="icon"
      className="border-r border-sidebar-border bg-sidebar"
    >
      <SidebarContent>
        {/* ── LOCAL ─────────────────────────────────────────────────────── */}
        <SidebarGroup>
          <SidebarGroupLabel>Local</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  data-qa="artifacts-nav-all"
                  tooltip="All Artifacts"
                  isActive={isActive({ kind: "all" })}
                  onClick={() => onNav({ kind: "all" })}
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <rect
                      x="1"
                      y="1"
                      width="4.5"
                      height="4.5"
                      rx="0.6"
                      stroke="currentColor"
                      strokeWidth="1.1"
                    />
                    <rect
                      x="7.5"
                      y="1"
                      width="4.5"
                      height="4.5"
                      rx="0.6"
                      stroke="currentColor"
                      strokeWidth="1.1"
                    />
                    <rect
                      x="1"
                      y="7.5"
                      width="4.5"
                      height="4.5"
                      rx="0.6"
                      stroke="currentColor"
                      strokeWidth="1.1"
                    />
                    <rect
                      x="7.5"
                      y="7.5"
                      width="4.5"
                      height="4.5"
                      rx="0.6"
                      stroke="currentColor"
                      strokeWidth="1.1"
                    />
                  </svg>
                  <span>All Artifacts</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  data-qa="artifacts-nav-recent"
                  tooltip="Recent"
                  isActive={isActive({ kind: "recent" })}
                  onClick={() => onNav({ kind: "recent" })}
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <circle
                      cx="6.5"
                      cy="6.5"
                      r="5"
                      stroke="currentColor"
                      strokeWidth="1.1"
                    />
                    <path
                      d="M6.5 4v2.5l1.5 1.5"
                      stroke="currentColor"
                      strokeWidth="1.1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>Recent</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  data-qa="artifacts-nav-starred"
                  tooltip="Starred"
                  isActive={isActive({ kind: "starred" })}
                  onClick={() => onNav({ kind: "starred" })}
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path
                      d="M6.5 1l1.5 3.5H12L9 6.5l1 4-3.5-2.5L3 10.5l1-4L1 6.5h4z"
                      stroke="currentColor"
                      strokeWidth="1.1"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>Starred</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── SERVICES ──────────────────────────────────────────────────── */}
        {projects.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Services</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {projects.map((p) => (
                    <SidebarMenuItem key={p.id}>
                      <SidebarMenuButton
                        data-qa={`artifacts-nav-service-${p.id}`}
                        tooltip={p.name}
                        isActive={isActive({
                          kind: "service",
                          id: p.id,
                          name: p.name,
                        })}
                        onClick={() =>
                          onNav({ kind: "service", id: p.id, name: p.name })
                        }
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 13 13"
                          fill="none"
                        >
                          <path
                            d="M6.5 1L2 4v7h3.5V7.5h2V11H11V4z"
                            stroke="currentColor"
                            strokeWidth="1.1"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span className="truncate">{p.name}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {/* ── CLOUD ─────────────────────────────────────────────────────── */}
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupLabel>Cloud</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* My Branch — collapsible sub-list */}
              <Collapsible
                open={cloudExpanded}
                onOpenChange={onToggleCloud}
                asChild
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      data-qa="artifacts-nav-cloud-branch"
                      tooltip="My Branch"
                      isActive={
                        isActive({ kind: "cloud_branch" }) || cloudExpanded
                      }
                      onClick={() => onNav({ kind: "cloud_branch" })}
                    >
                      <IconCloud />
                      <span>My Branch</span>
                      <IconChevronDown
                        className={`ml-auto transition-transform duration-200 ${cloudExpanded ? "" : "-rotate-90"}`}
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {["Downtown", "Westside", "Youth Campus"].map(
                        (branch) => (
                          <SidebarMenuSubItem key={branch}>
                            <SidebarMenuSubButton>
                              <span className="size-1.5 shrink-0 rounded-full bg-current" />
                              <span>{branch}</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ),
                      )}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              <SidebarMenuItem>
                <SidebarMenuButton
                  data-qa="artifacts-nav-cloud-shared"
                  tooltip="Church Shared"
                  isActive={isActive({ kind: "cloud_shared" })}
                  onClick={() => onNav({ kind: "cloud_shared" })}
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <circle
                      cx="6.5"
                      cy="6.5"
                      r="5"
                      stroke="currentColor"
                      strokeWidth="1.1"
                    />
                    <path
                      d="M6.5 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm0 3.5c-2 0-3 1-3 2h6c0-1-1-2-3-2z"
                      fill="currentColor"
                    />
                  </svg>
                  <span>Church Shared</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Storage footer ──────────────────────────────────────────────── */}
      <SidebarFooter className="border-t border-sidebar-border p-3 group-data-[collapsible=icon]:p-2">
        <div className="group-data-[collapsible=icon]:hidden">
          <div className="mb-[7px] h-[3px] overflow-hidden rounded-full bg-sidebar-border">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${storagePct}%` }}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-mono text-[10px] text-sidebar-foreground/50">
              {storageLabel}
            </span>
            <button className="flex shrink-0 cursor-pointer items-center gap-[3px] border-none bg-transparent font-sans text-[10px] text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground">
              Manage
            </button>
          </div>
        </div>
        <div className="hidden justify-center group-data-[collapsible=icon]:flex">
          <IconCloud />
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

// ─── Context menu ─────────────────────────────────────────────────────────────

interface CtxMenu {
  x: number;
  y: number;
  entry: ArtifactEntry;
}

function ContextMenu({
  menu,
  syncInfo,
  onOpen,
  onShare,
  onMoveTo,
  onSyncNow,
  onStar,
  onRename,
  onDelete,
  onClose,
}: {
  menu: CtxMenu;
  syncInfo: CloudSyncInfo | null;
  onOpen: (e: ArtifactEntry) => void;
  onShare: (e: ArtifactEntry) => void;
  onMoveTo: (e: ArtifactEntry) => void;
  onSyncNow: (e: ArtifactEntry) => void;
  onStar: (e: ArtifactEntry) => void;
  onRename: (e: ArtifactEntry) => void;
  onDelete: (e: ArtifactEntry) => void;
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
    "block w-full text-left bg-transparent border-none font-sans text-[12px] text-ink px-[14px] py-[6px] cursor-pointer transition-colors hover:bg-white/[0.06] whitespace-nowrap";
  const sep = <div className="mx-2 my-[3px] h-px bg-line" />;

  return (
    <div
      ref={ref}
      data-qa="artifacts-ctx-menu"
      className="fixed z-[1000] min-w-[160px] rounded-[5px] border border-line bg-bg-2 py-1 shadow-[0_8px_32px_rgba(0,0,0,0.7)]"
      style={{ top: menu.y, left: menu.x }}
    >
      {!menu.entry.is_dir && (
        <button
          className={btnCls}
          onClick={() => {
            onOpen(menu.entry);
            onClose();
          }}
        >
          Open
        </button>
      )}
      <button
        className={btnCls}
        onClick={() => {
          onShare(menu.entry);
          onClose();
        }}
      >
        Share…
      </button>
      <button
        className={btnCls}
        onClick={() => {
          onMoveTo(menu.entry);
          onClose();
        }}
      >
        Move to…
      </button>
      {sep}
      {syncInfo?.sync_enabled ? (
        syncInfo.status !== "syncing" && (
          <button
            className={btnCls}
            onClick={() => {
              onSyncNow(menu.entry);
              onClose();
            }}
          >
            Sync now
          </button>
        )
      ) : (
        <button
          className={btnCls}
          onClick={() => {
            onShare(menu.entry);
            onClose();
          }}
        >
          Sync to Cloud
        </button>
      )}
      <button
        className={btnCls}
        onClick={() => {
          onStar(menu.entry);
          onClose();
        }}
      >
        {menu.entry.starred ? "Unstar" : "Star"}
      </button>
      <button
        className={btnCls}
        onClick={() => {
          onRename(menu.entry);
          onClose();
        }}
      >
        Rename
      </button>
      {sep}
      <button
        className={`${btnCls} text-danger`}
        onClick={() => {
          onDelete(menu.entry);
          onClose();
        }}
      >
        Delete
      </button>
    </div>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function RenameModal({
  entry,
  onConfirm,
  onCancel,
}: {
  entry: ArtifactEntry;
  onConfirm: (n: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(entry.name);
  return (
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center bg-black/65"
      onClick={onCancel}
    >
      <div
        className="flex w-[320px] flex-col gap-3 rounded-[6px] border border-line bg-bg-2 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="m-0 text-[13px] font-semibold text-ink">Rename</p>
        <input
          className="rounded-[3px] border border-line bg-bg-1 px-[10px] py-[6px] font-sans text-[13px] text-ink transition-colors outline-none focus:border-accent"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onConfirm(name.trim());
            if (e.key === "Escape") onCancel();
          }}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button
            className="cursor-pointer rounded border border-line bg-transparent px-[14px] py-[6px] font-sans text-xs text-ink-3 transition-colors hover:border-line-strong hover:text-ink"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="cursor-pointer rounded border-none bg-accent px-[14px] py-[6px] font-sans text-xs font-semibold text-accent-foreground transition-[filter] hover:brightness-[1.12] disabled:cursor-default disabled:opacity-40"
            onClick={() => onConfirm(name.trim())}
            disabled={!name.trim() || name.trim() === entry.name}
          >
            Rename
          </button>
        </div>
      </div>
    </div>
  );
}

function NewFolderModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (n: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  return (
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center bg-black/65"
      onClick={onCancel}
    >
      <div
        className="flex w-[320px] flex-col gap-3 rounded-[6px] border border-line bg-bg-2 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="m-0 text-[13px] font-semibold text-ink">New Folder</p>
        <input
          className="rounded-[3px] border border-line bg-bg-1 px-[10px] py-[6px] font-sans text-[13px] text-ink transition-colors outline-none focus:border-accent"
          placeholder="Folder name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onConfirm(name.trim());
            if (e.key === "Escape") onCancel();
          }}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button
            className="cursor-pointer rounded border border-line bg-transparent px-[14px] py-[6px] font-sans text-xs text-ink-3 transition-colors hover:border-line-strong hover:text-ink"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="cursor-pointer rounded border-none bg-accent px-[14px] py-[6px] font-sans text-xs font-semibold text-accent-foreground transition-[filter] hover:brightness-[1.12] disabled:cursor-default disabled:opacity-40"
            onClick={() => onConfirm(name.trim())}
            disabled={!name.trim()}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function MoveFolderModal({
  entry,
  onConfirm,
  onCancel,
}: {
  entry: ArtifactEntry;
  onConfirm: (newParentPath: string) => void;
  onCancel: () => void;
}) {
  const [folders, setFolders] = useState<ArtifactEntry[]>([]);
  const [browsePath, setBrowsePath] = useState<string | null>(null);
  const [crumbs, setCrumbs] = useState<
    Array<{ label: string; path: string | null }>
  >([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    invoke<ArtifactEntry[]>("list_artifacts", {
      serviceId: entry.service_id ?? null,
      parentPath: browsePath,
    })
      .then((list) =>
        setFolders(list.filter((e) => e.is_dir && e.id !== entry.id)),
      )
      .catch(() => {});
  }, [browsePath, entry.service_id, entry.id]);

  const handleOpen = (folder: ArtifactEntry) => {
    setCrumbs((prev) => [...prev, { label: folder.name, path: browsePath }]);
    setBrowsePath(folder.path);
    setSelected(folder.path);
  };

  const handleCrumb = (idx: number) => {
    const target = crumbs[idx];
    setCrumbs(crumbs.slice(0, idx));
    setBrowsePath(target.path);
    setSelected(target.path);
  };

  const handleRoot = () => {
    setCrumbs([]);
    setBrowsePath(null);
    setSelected(null);
  };

  const destinationPath =
    selected ?? browsePath ?? `${entry.service_id ?? "_local"}`;

  return (
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center bg-black/65"
      onClick={onCancel}
    >
      <div
        className="flex w-[360px] flex-col gap-3 rounded-[6px] border border-line bg-bg-2 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="m-0 text-[13px] font-semibold text-ink">Move to Folder</p>

        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center gap-1 text-[11px] text-ink-3">
          <button
            className="text-ink-3 transition-colors hover:text-ink"
            onClick={handleRoot}
          >
            Root
          </button>
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="text-line">/</span>
              <button
                className="text-ink-3 transition-colors hover:text-ink"
                onClick={() => handleCrumb(i)}
              >
                {c.label}
              </button>
            </span>
          ))}
          {browsePath && (
            <span className="flex items-center gap-1">
              <span className="text-line">/</span>
              <span className="text-ink">
                {crumbs.length > 0 ? browsePath.split("/").pop() : browsePath}
              </span>
            </span>
          )}
        </div>

        {/* Folder list */}
        <div className="max-h-[200px] min-h-[120px] overflow-y-auto rounded-[3px] border border-line bg-bg-1">
          {folders.length === 0 ? (
            <p className="m-0 px-3 py-2 text-[11px] text-line">
              No sub-folders here.
            </p>
          ) : (
            folders.map((f) => (
              <div
                key={f.id}
                className={`flex cursor-pointer items-center justify-between px-3 py-[6px] text-[12px] transition-colors hover:bg-white/5 ${selected === f.path ? "bg-white/5 text-accent" : "text-ink"}`}
                onClick={() => setSelected(f.path)}
                onDoubleClick={() => handleOpen(f)}
              >
                <span className="flex items-center gap-2">
                  <span className="text-ink-3">📁</span>
                  {f.name}
                </span>
                <button
                  className="ml-2 text-[10px] text-line transition-colors hover:text-ink"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpen(f);
                  }}
                  title="Open folder"
                >
                  ▸
                </button>
              </div>
            ))
          )}
        </div>

        <p className="m-0 text-[10px] text-ink-3">
          Moving <span className="text-ink">{entry.name}</span> to:{" "}
          <span className="font-mono text-accent">{destinationPath}</span>
        </p>

        <div className="flex justify-end gap-2">
          <button
            className="cursor-pointer rounded border border-line bg-transparent px-[14px] py-[6px] font-sans text-xs text-ink-3 transition-colors hover:border-line-strong hover:text-ink"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="cursor-pointer rounded border-none bg-accent px-[14px] py-[6px] font-sans text-xs font-semibold text-accent-foreground transition-[filter] hover:brightness-[1.12]"
            onClick={() => onConfirm(destinationPath)}
          >
            Move Here
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Preview panel ────────────────────────────────────────────────────────────

function PreviewPanel({
  entry,
  syncInfo,
  onClose,
  onShare,
}: {
  entry: ArtifactEntry;
  syncInfo: CloudSyncInfo | undefined;
  onClose: () => void;
  onShare: (e: ArtifactEntry) => void;
}) {
  const mime = entry.mime_type ?? "";
  const isImage = mime.startsWith("image/");
  const isVideo = mime.startsWith("video/");
  const isAudio = mime.startsWith("audio/");
  const isPdf = mime.includes("pdf");
  const isText = mime.startsWith("text/") && !isPdf;

  const [fileSrc, setFileSrc] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textTruncated, setTextTruncated] = useState(false);
  const [textLoading, setTextLoading] = useState(false);

  useEffect(() => {
    if ((isImage || isVideo || isAudio || isPdf) && entry.path) {
      try {
        setFileSrc(convertFileSrc(entry.path));
      } catch {
        setFileSrc(null);
      }
    } else {
      setFileSrc(null);
    }
    setTextContent(null);
    setTextTruncated(false);
  }, [entry.path, isImage, isVideo, isAudio, isPdf]);

  useEffect(() => {
    if (!isText || !entry.id) return;
    setTextLoading(true);
    invoke<[string, boolean]>("read_text_file", {
      id: entry.id,
      maxBytes: 65536,
    })
      .then(([text, truncated]) => {
        setTextContent(text);
        setTextTruncated(truncated);
      })
      .catch(() => setTextContent(null))
      .finally(() => setTextLoading(false));
  }, [entry.id, isText]);

  const ext = entry.name.split(".").pop()?.toUpperCase() ?? "—";

  return (
    <div className="flex w-[260px] shrink-0 flex-col overflow-hidden border-l border-line bg-bg-1">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-3 pt-3 pb-2">
        <span className="text-[9px] font-semibold tracking-[0.12em] text-muted uppercase">
          Preview
        </span>
        <button
          className="cursor-pointer rounded border-none bg-transparent px-1 py-[2px] text-[12px] text-muted transition-colors hover:text-ink-3"
          onClick={onClose}
          aria-label="Close preview"
        >
          ✕
        </button>
      </div>

      {/* Render area — fills remaining vertical space */}
      <div className="mx-3 mb-2 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[4px] border border-line bg-bg">
        {isImage && fileSrc ? (
          <img
            src={fileSrc}
            alt={entry.name}
            className="h-full w-full object-contain"
            onError={() => setFileSrc(null)}
          />
        ) : isVideo && fileSrc ? (
          <video
            src={fileSrc}
            controls
            className="h-full w-full object-contain"
          />
        ) : isAudio && fileSrc ? (
          <div className="flex w-full flex-col items-center gap-3 p-3">
            <span className="text-[32px]">🎵</span>
            <audio src={fileSrc} controls className="w-full" />
          </div>
        ) : isPdf && fileSrc ? (
          <iframe
            src={fileSrc}
            title={entry.name}
            className="h-full w-full border-none"
          />
        ) : isText ? (
          <div className="h-full w-full overflow-auto p-2">
            {textLoading ? (
              <span className="text-[10px] text-muted">Loading…</span>
            ) : textContent !== null ? (
              <>
                <pre className="m-0 font-mono text-[10px] leading-[1.5] break-words whitespace-pre-wrap text-ink-3">
                  {textContent}
                </pre>
                {textTruncated && (
                  <p className="m-0 mt-2 text-[9px] text-muted italic">
                    — truncated at 64 KB —
                  </p>
                )}
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-muted">
                <span className="text-[28px]">{fileIconChar(entry)}</span>
                <span className="font-mono text-[10px]">{ext}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted">
            <span className="text-[28px]">{fileIconChar(entry)}</span>
            <span className="font-mono text-[10px]">{ext}</span>
          </div>
        )}
      </div>

      {/* Compact metadata footer */}
      <div className="flex shrink-0 flex-col gap-[6px] px-3 pb-3">
        <p
          className="m-0 truncate text-[11px] leading-[1.3] font-medium break-words text-ink"
          title={entry.name}
        >
          {entry.name}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {entry.mime_type && (
            <span className="font-mono text-[10px] text-muted">{ext}</span>
          )}
          {!entry.is_dir && entry.size_bytes > 0 && (
            <span className="font-mono text-[10px] text-muted">
              {formatBytes(entry.size_bytes)}
            </span>
          )}
          <span className="font-mono text-[10px] text-muted">
            {formatDate(entry.modified_at_ms)}
          </span>
          {syncInfo?.sync_enabled && (
            <span className="font-mono text-[10px] text-muted capitalize">
              {syncInfo.status.replace("_", " ")}
            </span>
          )}
        </div>
        <button
          className="w-full cursor-pointer rounded-[3px] border border-line bg-transparent py-[6px] font-sans text-[11px] text-ink-3 transition-colors hover:border-line-strong hover:text-ink"
          onClick={() => onShare(entry)}
        >
          Share…
        </button>
      </div>
    </div>
  );
}

function fileIconChar(e: ArtifactEntry): string {
  if (e.is_dir) return "📁";
  const cat = mimeCategory(e.mime_type);
  return cat === "image"
    ? "🖼"
    : cat === "video"
      ? "🎬"
      : cat === "audio"
        ? "🎵"
        : cat === "document"
          ? "📄"
          : cat === "slide"
            ? "📊"
            : "📎";
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

// ─── New menu ─────────────────────────────────────────────────────────────────

function NewMenu({
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

// ─── Main page ────────────────────────────────────────────────────────────────

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

  // ── Cloud sync state ────────────────────────────────────────────────────────
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
      .catch(() => {});
    invoke<ArtifactsSettings>("get_artifacts_settings")
      .then(setSettings)
      .catch(() => {});
    invoke<StorageUsage>("get_storage_usage")
      .then(setStorageUsage)
      .catch(() => {});
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

  const loadSyncInfo = (list: ArtifactEntry[]) => {
    // Load incrementally — each result updates state as it arrives,
    // so the UI is never blocked waiting for all results.
    for (const e of list) {
      invoke<CloudSyncInfo | null>("get_cloud_sync_info", {
        artifactId: e.id,
      })
        .then((info) => {
          if (info) {
            setSyncInfoMap((prev) => new Map(prev).set(e.id, info));
          }
        })
        .catch(() => {});
    }
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
    // Optimistic: mark as syncing immediately
    setSyncInfoMap((prev) => {
      const next = new Map(prev);
      const info = next.get(e.id);
      if (info) next.set(e.id, { ...info, status: "syncing" as const });
      return next;
    });
    // Fire and forget
    invoke<CloudSyncInfo>("sync_artifact_now", { artifactId: e.id })
      .then((updated) => {
        setSyncInfoMap((prev) => new Map(prev).set(e.id, updated));
        invoke<StorageUsage>("get_storage_usage")
          .then(setStorageUsage)
          .catch(() => {});
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
        .catch(() => {});
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

  const metaCls = "text-muted font-mono text-[11px] whitespace-nowrap";

  const viewBtnCls = (active: boolean) =>
    [
      "bg-transparent border border-line text-ink-3 w-7 h-[26px] rounded-[3px] cursor-pointer",
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
        {/* ── Topbar ─────────────────────────────────────────────────────────── */}
        <header
          data-qa="artifacts-topbar"
          className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-4"
        >
          {/* Sidebar toggle */}
          <SidebarTrigger className="h-7 w-7 shrink-0 text-ink-3 hover:text-ink" />
          {/* Back button + Breadcrumb */}
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
                  className="cursor-pointer rounded border-none bg-transparent px-[3px] py-[2px] font-sans text-[12px] whitespace-nowrap text-ink transition-colors hover:text-ink"
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
                className="w-[160px] rounded-[3px] border border-line bg-bg-1 px-[8px] py-[4px] font-sans text-[11px] text-ink transition-colors outline-none placeholder:text-muted focus:border-accent"
                type="search"
                placeholder="Search files…"
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
              <IconSearch />
            </button>
            <button
              className={[
                "flex cursor-pointer items-center gap-[5px] rounded-[3px] border px-[10px] py-[5px] font-sans text-[11px] transition-colors",
                syncing
                  ? "border-accent/40 bg-accent-soft text-accent"
                  : "border-line text-ink-3 hover:border-line-strong hover:text-ink",
              ].join(" ")}
              onClick={handleSyncAll}
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
                onClick={() => setViewMode("list")}
                title="List view"
              >
                <IconList />
              </button>
              <button
                data-qa="artifacts-view-grid"
                className={viewBtnCls(viewMode === "grid")}
                onClick={() => setViewMode("grid")}
                title="Grid view"
              >
                <IconGrid />
              </button>
            </div>
          </div>
        </header>

        {/* ── Body ───────────────────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-bg">
            {/* Section header */}
            <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-[10px]">
              <div className="flex min-w-0 flex-col">
                <h1 className="m-0 max-w-[280px] overflow-hidden text-[14px] leading-[1.3] font-semibold text-ellipsis whitespace-nowrap text-ink">
                  {sectionTitle}
                </h1>
                {entries.length > 0 && (
                  <span className="mt-[1px] font-mono text-[11px] text-muted">
                    {entries.length} artifact{entries.length !== 1 ? "s" : ""}
                    {totalSize > 0 ? ` · ${formatStorageBytes(totalSize)}` : ""}
                  </span>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-[6px]">
                <div className="relative">
                  <div className="flex overflow-hidden rounded-[3px] border border-line">
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
                      <IconChevronDown />
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
                  className="flex cursor-pointer items-center gap-[5px] rounded-[3px] border border-line bg-transparent px-[10px] py-[5px] font-sans text-[11px] text-ink-3 transition-colors hover:border-line-strong hover:text-ink"
                  onClick={handleUpload}
                  title="Upload files"
                >
                  <IconUpload />
                  Upload
                </button>
              </div>
            </div>

            {/* Filter pills */}
            <div className="scrollbar-none flex shrink-0 gap-[5px] overflow-x-auto border-b border-line px-5 py-[8px]">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  data-qa={`artifacts-filter-${f.value}`}
                  className={[
                    "shrink-0 cursor-pointer rounded-full px-[10px] py-[3px] font-sans text-[10px] font-medium tracking-[0.04em] whitespace-nowrap uppercase transition-colors",
                    filter === f.value
                      ? "border border-accent bg-accent text-accent-foreground"
                      : "border border-line bg-transparent text-ink-3 hover:border-line-strong hover:text-ink",
                  ].join(" ")}
                  onClick={() => setFilter(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {error && (
              <p className="m-0 shrink-0 border-b border-danger/20 px-5 py-[6px] text-[11px] text-danger">
                {error}
              </p>
            )}

            {/* Content + Preview */}
            <div className="flex flex-1 overflow-hidden">
              {/* File list / grid */}
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                {/* Cloud panels */}
                {(nav.kind === "cloud_branch" ||
                  nav.kind === "cloud_shared") && (
                  <div className="flex-1 overflow-y-auto py-2">
                    {cloudEntries.length === 0 ? (
                      <p className="py-12 text-center text-xs text-muted">
                        No synced files in this section.
                      </p>
                    ) : (
                      cloudEntries.map((info) => (
                        <div
                          key={info.artifact_id}
                          className="flex items-center gap-[10px] border-b border-line/50 px-5 py-[8px] text-[12px] transition-colors hover:bg-white/[0.02]"
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
                              className="shrink-0 text-[11px] text-danger"
                              title={info.sync_error}
                            >
                              ⚠ {info.sync_error.slice(0, 40)}
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
                    <div className="flex-1 overflow-y-auto">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr>
                            <th className="sticky top-0 w-full border-b border-line bg-bg px-5 py-[7px] text-left text-[9px] font-semibold tracking-[0.1em] text-muted uppercase">
                              Name
                            </th>
                            <th className="sticky top-0 border-b border-line bg-bg px-4 py-[7px] text-left text-[9px] font-semibold tracking-[0.1em] whitespace-nowrap text-muted uppercase">
                              Type
                            </th>
                            <th className="sticky top-0 border-b border-line bg-bg px-4 py-[7px] text-right text-[9px] font-semibold tracking-[0.1em] whitespace-nowrap text-muted uppercase">
                              Size
                            </th>
                            <th className="sticky top-0 border-b border-line bg-bg px-4 py-[7px] text-left text-[9px] font-semibold tracking-[0.1em] whitespace-nowrap text-muted uppercase">
                              Modified
                            </th>
                            <th className="sticky top-0 border-b border-line bg-bg px-4 py-[7px] text-left text-[9px] font-semibold tracking-[0.1em] whitespace-nowrap text-muted uppercase">
                              Sync
                            </th>
                            <th className="sticky top-0 border-b border-line bg-bg px-4 py-[7px] text-left text-[9px] font-semibold tracking-[0.1em] whitespace-nowrap text-muted uppercase">
                              Shared
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Uploading placeholders */}
                          {pendingUploads
                            .filter((u) => u.status === "uploading")
                            .map((u) => (
                              <tr
                                key={u.id}
                                className="animate-pulse border-b border-line/40"
                              >
                                <td className="px-3 py-2.5">
                                  {u.previewUrl ? (
                                    <img
                                      src={u.previewUrl}
                                      alt=""
                                      className="h-8 w-8 rounded object-cover opacity-60"
                                    />
                                  ) : (
                                    <div className="h-8 w-8 rounded bg-bg-3" />
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-xs text-ink-3">
                                  {u.name}
                                </td>
                                <td
                                  colSpan={4}
                                  className="px-3 py-2.5 font-mono text-[10px] text-muted"
                                >
                                  Uploading…
                                </td>
                              </tr>
                            ))}
                          {visible.length === 0 &&
                          pendingUploads.filter((u) => u.status === "uploading")
                            .length === 0 ? (
                            <tr>
                              <td
                                colSpan={6}
                                className="py-16 text-center text-xs text-muted"
                              >
                                {query ? "No results." : "No files here yet."}
                              </td>
                            </tr>
                          ) : (
                            visible.map((e) => {
                              const sync = syncInfoMap.get(e.id);
                              const isSelected = selected?.id === e.id;
                              return (
                                <tr
                                  key={e.id}
                                  data-qa="artifacts-row"
                                  className={[
                                    "cursor-default border-b border-line/40 transition-colors",
                                    isSelected
                                      ? "bg-accent-soft"
                                      : "hover:bg-white/[0.025]",
                                  ].join(" ")}
                                  onClick={() =>
                                    setSelected(isSelected ? null : e)
                                  }
                                  onContextMenu={(ev) => handleCtx(ev, e)}
                                  onDoubleClick={() => handleNavigate(e)}
                                >
                                  <td className="px-5 py-[7px] align-middle">
                                    <div className="flex min-w-0 items-center gap-[8px]">
                                      <span className="shrink-0">
                                        {fileIcon(e)}
                                      </span>
                                      <span className="overflow-hidden text-[12px] text-ellipsis whitespace-nowrap text-ink">
                                        {e.name}
                                      </span>
                                      {e.starred && (
                                        <span className="shrink-0 text-[10px] text-accent">
                                          ★
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td
                                    className={`px-4 py-[7px] align-middle ${metaCls}`}
                                  >
                                    {e.is_dir
                                      ? "Folder"
                                      : (e.mime_type
                                          ?.split("/")[1]
                                          ?.toUpperCase() ?? "File")}
                                  </td>
                                  <td
                                    className={`px-4 py-[7px] align-middle ${metaCls} text-right`}
                                  >
                                    {e.is_dir ? "—" : formatBytes(e.size_bytes)}
                                  </td>
                                  <td
                                    className={`px-4 py-[7px] align-middle ${metaCls}`}
                                  >
                                    {formatDate(e.modified_at_ms)}
                                  </td>
                                  <td className="w-[80px] px-4 py-[7px] align-middle">
                                    <SyncCell info={sync} />
                                  </td>
                                  <td className="w-[80px] px-4 py-[7px] align-middle">
                                    <SharedCell info={sync} />
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                {/* Grid view */}
                {nav.kind !== "cloud_branch" &&
                  nav.kind !== "cloud_shared" &&
                  viewMode === "grid" && (
                    <div className="flex flex-1 flex-wrap content-start gap-3 overflow-y-auto p-5">
                      {/* Upload placeholders */}
                      {pendingUploads
                        .filter((u) => u.status === "uploading")
                        .map((u) => (
                          <div
                            key={u.id}
                            className="relative flex w-[88px] animate-pulse cursor-default flex-col items-center gap-[6px] rounded-[4px] border border-line/40 px-2 py-3"
                          >
                            {u.previewUrl ? (
                              <img
                                src={u.previewUrl}
                                alt=""
                                className="h-10 w-10 rounded object-cover opacity-60"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded bg-bg-3" />
                            )}
                            <span className="w-full truncate text-center text-[10px] text-ink-3">
                              {u.name}
                            </span>
                          </div>
                        ))}
                      {visible.length === 0 &&
                      pendingUploads.filter((u) => u.status === "uploading")
                        .length === 0 ? (
                        <p className="w-full py-16 text-center text-xs text-muted">
                          {query ? "No results." : "No files here yet."}
                        </p>
                      ) : (
                        visible.map((e) => {
                          const sync = syncInfoMap.get(e.id);
                          const isSelected = selected?.id === e.id;
                          return (
                            <div
                              key={e.id}
                              data-qa="artifacts-tile"
                              className={[
                                "relative flex w-[88px] cursor-default flex-col items-center gap-[6px] rounded-[4px] border px-2 py-3 transition-colors",
                                isSelected
                                  ? "border-accent/40 bg-accent-soft"
                                  : "border-transparent hover:border-line hover:bg-white/[0.04]",
                              ].join(" ")}
                              onClick={() => setSelected(isSelected ? null : e)}
                              onContextMenu={(ev) => handleCtx(ev, e)}
                              onDoubleClick={() => handleNavigate(e)}
                            >
                              <div className="flex h-8 items-center justify-center text-[28px] leading-none">
                                {fileIcon(e)}
                              </div>
                              <span
                                className="w-full max-w-[72px] overflow-hidden text-center text-[11px] text-ellipsis whitespace-nowrap text-ink"
                                title={e.name}
                              >
                                {e.name}
                              </span>
                              {e.starred && (
                                <span className="absolute top-[5px] right-[6px] text-[10px] text-accent">
                                  ★
                                </span>
                              )}
                              {sync?.sync_enabled && (
                                <span className="absolute top-[5px] left-[6px]">
                                  <SyncCell info={sync} />
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
              </div>

              {/* Preview panel */}
              {selected && (
                <PreviewPanel
                  entry={selected}
                  syncInfo={syncInfoMap.get(selected.id)}
                  onClose={() => setSelected(null)}
                  onShare={handleShare}
                />
              )}
            </div>
          </main>
        </div>

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

        {/* Overlays */}
        {ctxMenu && (
          <ContextMenu
            menu={ctxMenu}
            syncInfo={syncInfoMap.get(ctxMenu.entry.id) ?? null}
            onOpen={handleOpen}
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
      </SidebarInset>
    </SidebarProvider>
  );
}
