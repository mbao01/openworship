import { useCallback, useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { ShareDialog } from "../components/ShareDialog";
import { invoke } from "../lib/tauri";
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
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M1.5 4.5C1.5 3.948 1.948 3.5 2.5 3.5H6L7.5 5H12.5C13.052 5 13.5 5.448 13.5 6V11.5C13.5 12.052 13.052 12.5 12.5 12.5H2.5C1.948 12.5 1.5 12.052 1.5 11.5V4.5Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

function IconFile() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 1.5h5.5L11 4v8.5H3V1.5Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M8.5 1.5V4H11" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

function IconImage() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="11" height="11" rx="1" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="4.5" cy="4.5" r="1" fill="currentColor" />
      <path d="M1.5 9l3-3 2.5 2.5 2-2 3 3" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

function IconVideo() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="1" y="2.5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.1" />
      <path d="M10 5l3-1.5v7L10 9" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

function IconAudio() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M4 5v4M6.5 3.5v7M9 5v4M11.5 4v6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconDoc() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 1.5h5.5L11 4v8.5H3V1.5Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M5 6h4M5 8h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function IconSlide() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="1" y="2" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.1" />
      <path d="M7 10v2M5 12h4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function IconCloud() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path d="M10 8.5c1.105 0 2-.784 2-1.75S11.105 5 10 5c-.09 0-.18.007-.27.02C9.42 3.866 8.298 3 7 3c-1.51 0-2.75 1.104-2.75 2.5 0 .046.002.09.004.136A1.75 1.75 0 0 0 3 7.25c0 .69.398 1.29.98 1.613" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M7 8v4M5.5 10.5l1.5 1.5 1.5-1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9 9l3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path d="M6.5 1v7M4 3.5L6.5 1 9 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.5 9.5v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconSync() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path d="M11 6.5A4.5 4.5 0 0 1 2.636 9.364" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M2 6.5A4.5 4.5 0 0 1 10.364 3.636" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M10 1.5l.364 2.136L8.228 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 11.5l-.364-2.136L4.772 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" className={className}>
      <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}


function IconList() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path d="M4 3.5h7M4 6.5h7M4 9.5h7M2 3.5h.01M2 6.5h.01M2 9.5h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
      <rect x="7.5" y="1.5" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
      <rect x="1.5" y="7.5" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
      <rect x="7.5" y="7.5" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function fileIcon(e: ArtifactEntry) {
  if (e.is_dir)
    return <span className="text-gold/80"><IconFolder /></span>;
  const cat = mimeCategory(e.mime_type);
  const colorCls =
    cat === "image" ? "text-[#7ba6d4]" :
    cat === "video" ? "text-[#9a7dd4]" :
    cat === "audio" ? "text-[#7dd4a0]" :
    cat === "document" ? "text-[#d4a07d]" :
    cat === "slide" ? "text-[#d47d7d]" :
    "text-ash";
  return (
    <span className={colorCls}>
      {cat === "image" ? <IconImage /> :
       cat === "video" ? <IconVideo /> :
       cat === "audio" ? <IconAudio /> :
       cat === "document" ? <IconDoc /> :
       cat === "slide" ? <IconSlide /> :
       <IconFile />}
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
  if (!info || !info.sync_enabled) return <span className="text-smoke text-[11px]">—</span>;

  if (info.status === "syncing" && info.progress !== null) {
    const pct = Math.round(info.progress * 100);
    return (
      <div className="flex items-center gap-[6px]">
        <div className="w-[48px] h-[3px] rounded-full bg-iron overflow-hidden">
          <div className="h-full bg-gold transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[10px] font-mono text-ash">{pct}%</span>
      </div>
    );
  }

  if (info.status === "synced") {
    return (
      <span className="text-gold" title="Synced to cloud">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
          <path d="M2 7l3 3 6-6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  if (info.status === "queued") return <span className="text-smoke text-[10px]" title="Queued">···</span>;
  if (info.status === "conflict") return <span className="text-[#e89a00] text-[10px]" title="Conflict">⚠</span>;
  if (info.status === "error") return <span className="text-ember text-[10px]" title={info.sync_error ?? "Error"}>✕</span>;

  return <span className="text-smoke text-[11px]">—</span>;
}

// ─── Shared cell ──────────────────────────────────────────────────────────────

function SharedCell({ info }: { info: CloudSyncInfo | undefined }) {
  if (!info || !info.sync_enabled) return <span className="text-smoke text-[11px]">—</span>;

  // We infer sharing state from cloud_key for now;
  // full ACL count would require a per-file query
  if (info.cloud_key?.includes("public")) {
    return (
      <span className="inline-flex items-center px-[6px] py-[2px] rounded-[3px] text-[10px] font-medium bg-gold/10 text-gold border border-gold/25">
        Public
      </span>
    );
  }

  return <span className="text-smoke text-[11px]">—</span>;
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
                    <rect x="1" y="1" width="4.5" height="4.5" rx="0.6" stroke="currentColor" strokeWidth="1.1" />
                    <rect x="7.5" y="1" width="4.5" height="4.5" rx="0.6" stroke="currentColor" strokeWidth="1.1" />
                    <rect x="1" y="7.5" width="4.5" height="4.5" rx="0.6" stroke="currentColor" strokeWidth="1.1" />
                    <rect x="7.5" y="7.5" width="4.5" height="4.5" rx="0.6" stroke="currentColor" strokeWidth="1.1" />
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
                    <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.1" />
                    <path d="M6.5 4v2.5l1.5 1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
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
                    <path d="M6.5 1l1.5 3.5H12L9 6.5l1 4-3.5-2.5L3 10.5l1-4L1 6.5h4z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
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
                        isActive={isActive({ kind: "service", id: p.id, name: p.name })}
                        onClick={() => onNav({ kind: "service", id: p.id, name: p.name })}
                      >
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                          <path d="M6.5 1L2 4v7h3.5V7.5h2V11H11V4z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
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
              <Collapsible open={cloudExpanded} onOpenChange={onToggleCloud} asChild>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      data-qa="artifacts-nav-cloud-branch"
                      tooltip="My Branch"
                      isActive={isActive({ kind: "cloud_branch" }) || cloudExpanded}
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
                      {["Downtown", "Westside", "Youth Campus"].map((branch) => (
                        <SidebarMenuSubItem key={branch}>
                          <SidebarMenuSubButton>
                            <span className="size-1.5 rounded-full bg-current shrink-0" />
                            <span>{branch}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
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
                    <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.1" />
                    <path d="M6.5 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm0 3.5c-2 0-3 1-3 2h6c0-1-1-2-3-2z" fill="currentColor" />
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
          <div className="h-[3px] bg-sidebar-border rounded-full overflow-hidden mb-[7px]">
            <div
              className="h-full bg-primary transition-[width] duration-300 rounded-full"
              style={{ width: `${storagePct}%` }}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-sidebar-foreground/50 font-mono truncate">
              {storageLabel}
            </span>
            <button className="text-[10px] text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors bg-transparent border-none cursor-pointer font-sans flex items-center gap-[3px] shrink-0">
              Manage
            </button>
          </div>
        </div>
        <div className="hidden group-data-[collapsible=icon]:flex justify-center">
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
    "block w-full text-left bg-transparent border-none font-sans text-[12px] text-chalk px-[14px] py-[6px] cursor-pointer transition-colors hover:bg-white/[0.06] whitespace-nowrap";
  const sep = <div className="h-px bg-iron my-[3px] mx-2" />;

  return (
    <div
      ref={ref}
      data-qa="artifacts-ctx-menu"
      className="fixed z-[1000] bg-slate border border-iron rounded-[5px] py-1 min-w-[160px] shadow-[0_8px_32px_rgba(0,0,0,0.7)]"
      style={{ top: menu.y, left: menu.x }}
    >
      {!menu.entry.is_dir && (
        <button className={btnCls} onClick={() => { onOpen(menu.entry); onClose(); }}>
          Open
        </button>
      )}
      <button className={btnCls} onClick={() => { onShare(menu.entry); onClose(); }}>
        Share…
      </button>
      <button className={btnCls} onClick={() => { onMoveTo(menu.entry); onClose(); }}>
        Move to…
      </button>
      {sep}
      {syncInfo?.sync_enabled
        ? syncInfo.status !== "syncing" && (
          <button className={btnCls} onClick={() => { onSyncNow(menu.entry); onClose(); }}>
            Sync now
          </button>
        )
        : (
          <button className={btnCls} onClick={() => { onShare(menu.entry); onClose(); }}>
            Sync to Cloud
          </button>
        )
      }
      <button className={btnCls} onClick={() => { onStar(menu.entry); onClose(); }}>
        {menu.entry.starred ? "Unstar" : "Star"}
      </button>
      <button className={btnCls} onClick={() => { onRename(menu.entry); onClose(); }}>
        Rename
      </button>
      {sep}
      <button
        className={`${btnCls} text-ember`}
        onClick={() => { onDelete(menu.entry); onClose(); }}
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
      className="fixed inset-0 bg-black/65 flex items-center justify-center z-[900]"
      onClick={onCancel}
    >
      <div
        className="bg-slate border border-iron rounded-[6px] p-5 w-[320px] flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[13px] font-semibold text-chalk m-0">Rename</p>
        <input
          className="bg-obsidian border border-iron rounded-[3px] text-chalk font-sans text-[13px] px-[10px] py-[6px] outline-none transition-colors focus:border-gold"
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
            className="bg-transparent text-ash border border-iron rounded font-sans text-xs px-[14px] py-[6px] cursor-pointer transition-colors hover:text-chalk hover:border-ash"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="bg-gold text-void border-none rounded font-sans text-xs font-semibold px-[14px] py-[6px] cursor-pointer transition-[filter] hover:brightness-[1.12] disabled:opacity-40 disabled:cursor-default"
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
      className="fixed inset-0 bg-black/65 flex items-center justify-center z-[900]"
      onClick={onCancel}
    >
      <div
        className="bg-slate border border-iron rounded-[6px] p-5 w-[320px] flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[13px] font-semibold text-chalk m-0">New Folder</p>
        <input
          className="bg-obsidian border border-iron rounded-[3px] text-chalk font-sans text-[13px] px-[10px] py-[6px] outline-none transition-colors focus:border-gold"
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
            className="bg-transparent text-ash border border-iron rounded font-sans text-xs px-[14px] py-[6px] cursor-pointer transition-colors hover:text-chalk hover:border-ash"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="bg-gold text-void border-none rounded font-sans text-xs font-semibold px-[14px] py-[6px] cursor-pointer transition-[filter] hover:brightness-[1.12] disabled:opacity-40 disabled:cursor-default"
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
  const [crumbs, setCrumbs] = useState<Array<{ label: string; path: string | null }>>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    invoke<ArtifactEntry[]>("list_artifacts", {
      serviceId: entry.service_id ?? null,
      parentPath: browsePath,
    })
      .then((list) => setFolders(list.filter((e) => e.is_dir && e.id !== entry.id)))
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

  const destinationPath = selected ?? browsePath ?? `${entry.service_id ?? "_local"}`;

  return (
    <div
      className="fixed inset-0 bg-black/65 flex items-center justify-center z-[900]"
      onClick={onCancel}
    >
      <div
        className="bg-slate border border-iron rounded-[6px] p-5 w-[360px] flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[13px] font-semibold text-chalk m-0">Move to Folder</p>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-[11px] text-ash flex-wrap">
          <button className="text-ash hover:text-chalk transition-colors" onClick={handleRoot}>
            Root
          </button>
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="text-iron">/</span>
              <button
                className="text-ash hover:text-chalk transition-colors"
                onClick={() => handleCrumb(i)}
              >
                {c.label}
              </button>
            </span>
          ))}
          {browsePath && (
            <span className="flex items-center gap-1">
              <span className="text-iron">/</span>
              <span className="text-chalk">{crumbs.length > 0 ? browsePath.split("/").pop() : browsePath}</span>
            </span>
          )}
        </div>

        {/* Folder list */}
        <div className="bg-obsidian border border-iron rounded-[3px] min-h-[120px] max-h-[200px] overflow-y-auto">
          {folders.length === 0 ? (
            <p className="text-[11px] text-iron px-3 py-2 m-0">No sub-folders here.</p>
          ) : (
            folders.map((f) => (
              <div
                key={f.id}
                className={`flex items-center justify-between px-3 py-[6px] cursor-pointer text-[12px] transition-colors hover:bg-white/5 ${selected === f.path ? "text-gold bg-white/5" : "text-chalk"}`}
                onClick={() => setSelected(f.path)}
                onDoubleClick={() => handleOpen(f)}
              >
                <span className="flex items-center gap-2">
                  <span className="text-ash">📁</span>
                  {f.name}
                </span>
                <button
                  className="text-[10px] text-iron hover:text-chalk transition-colors ml-2"
                  onClick={(e) => { e.stopPropagation(); handleOpen(f); }}
                  title="Open folder"
                >
                  ▸
                </button>
              </div>
            ))
          )}
        </div>

        <p className="text-[10px] text-ash m-0">
          Moving <span className="text-chalk">{entry.name}</span> to:{" "}
          <span className="text-gold font-mono">{destinationPath}</span>
        </p>

        <div className="flex justify-end gap-2">
          <button
            className="bg-transparent text-ash border border-iron rounded font-sans text-xs px-[14px] py-[6px] cursor-pointer transition-colors hover:text-chalk hover:border-ash"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="bg-gold text-void border-none rounded font-sans text-xs font-semibold px-[14px] py-[6px] cursor-pointer transition-[filter] hover:brightness-[1.12]"
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
    invoke<[string, boolean]>("read_text_file", { id: entry.id, maxBytes: 65536 })
      .then(([text, truncated]) => {
        setTextContent(text);
        setTextTruncated(truncated);
      })
      .catch(() => setTextContent(null))
      .finally(() => setTextLoading(false));
  }, [entry.id, isText]);

  const ext = entry.name.split(".").pop()?.toUpperCase() ?? "—";

  return (
    <div className="w-[260px] shrink-0 bg-obsidian border-l border-iron flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0">
        <span className="text-[9px] font-semibold tracking-[0.12em] uppercase text-smoke">Preview</span>
        <button
          className="bg-transparent border-none text-smoke cursor-pointer text-[12px] px-1 py-[2px] rounded hover:text-ash transition-colors"
          onClick={onClose}
          aria-label="Close preview"
        >
          ✕
        </button>
      </div>

      {/* Render area — fills remaining vertical space */}
      <div className="mx-3 mb-2 rounded-[4px] overflow-hidden bg-void border border-iron flex-1 flex items-center justify-center min-h-0">
        {isImage && fileSrc ? (
          <img
            src={fileSrc}
            alt={entry.name}
            className="w-full h-full object-contain"
            onError={() => setFileSrc(null)}
          />
        ) : isVideo && fileSrc ? (
          <video
            src={fileSrc}
            controls
            className="w-full h-full object-contain"
          />
        ) : isAudio && fileSrc ? (
          <div className="flex flex-col items-center gap-3 p-3 w-full">
            <span className="text-[32px]">🎵</span>
            <audio src={fileSrc} controls className="w-full" />
          </div>
        ) : isPdf && fileSrc ? (
          <iframe
            src={fileSrc}
            title={entry.name}
            className="w-full h-full border-none"
          />
        ) : isText ? (
          <div className="w-full h-full overflow-auto p-2">
            {textLoading ? (
              <span className="text-[10px] text-smoke">Loading…</span>
            ) : textContent !== null ? (
              <>
                <pre className="text-[10px] font-mono text-ash m-0 whitespace-pre-wrap break-words leading-[1.5]">
                  {textContent}
                </pre>
                {textTruncated && (
                  <p className="text-[9px] text-smoke mt-2 m-0 italic">— truncated at 64 KB —</p>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-smoke h-full justify-center">
                <span className="text-[28px]">{fileIconChar(entry)}</span>
                <span className="text-[10px] font-mono">{ext}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-smoke">
            <span className="text-[28px]">{fileIconChar(entry)}</span>
            <span className="text-[10px] font-mono">{ext}</span>
          </div>
        )}
      </div>

      {/* Compact metadata footer */}
      <div className="px-3 pb-3 shrink-0 flex flex-col gap-[6px]">
        <p className="text-[11px] font-medium text-chalk m-0 break-words leading-[1.3] truncate" title={entry.name}>
          {entry.name}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {entry.mime_type && (
            <span className="text-[10px] font-mono text-smoke">{ext}</span>
          )}
          {!entry.is_dir && entry.size_bytes > 0 && (
            <span className="text-[10px] font-mono text-smoke">{formatBytes(entry.size_bytes)}</span>
          )}
          <span className="text-[10px] font-mono text-smoke">{formatDate(entry.modified_at_ms)}</span>
          {syncInfo?.sync_enabled && (
            <span className="text-[10px] font-mono text-smoke capitalize">{syncInfo.status.replace("_", " ")}</span>
          )}
        </div>
        <button
          className="w-full bg-transparent border border-iron rounded-[3px] text-ash font-sans text-[11px] py-[6px] cursor-pointer transition-colors hover:text-chalk hover:border-ash"
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
  return cat === "image" ? "🖼" : cat === "video" ? "🎬" : cat === "audio" ? "🎵" : cat === "document" ? "📄" : cat === "slide" ? "📊" : "📎";
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
    "block w-full text-left bg-transparent border-none font-sans text-[12px] text-chalk px-[12px] py-[7px] cursor-pointer transition-colors hover:bg-white/[0.06] whitespace-nowrap";

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-[3px] z-[200] bg-slate border border-iron rounded-[5px] py-1 min-w-[140px] shadow-[0_8px_32px_rgba(0,0,0,0.7)]"
    >
      <button className={btnCls} onClick={() => { onNewFolder(); onClose(); }}>
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
        list = await invoke<ArtifactEntry[]>("list_artifacts", { serviceId: svcId, parentPath });
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
    setFilter("all");
    setSelected(null);
    if (n.kind !== "cloud_branch" && n.kind !== "cloud_shared") setCloudEntries([]);
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
        await invoke("import_artifact_file", {
          serviceId: svcId,
          parentPath,
          fileName: file.name,
          filePath: (file as File & { path?: string }).path ?? file.name,
        });
      }
      await loadEntries();
    } catch (err) {
      setError(String(err));
    }
    ev.target.value = "";
  };

  const sectionTitle =
    nav.kind === "all" ? "All Artifacts" :
    nav.kind === "recent" ? "Recent" :
    nav.kind === "starred" ? "Starred" :
    nav.kind === "cloud_branch" ? "My Branch — Cloud" :
    nav.kind === "cloud_shared" ? "Church Shared" :
    nav.name;

  const totalSize = entries.reduce((sum, e) => sum + (e.size_bytes ?? 0), 0);

  const visible = entries.filter(
    (e) => filter === "all" || (!e.is_dir && mimeCategory(e.mime_type) === filter)
  );

  const metaCls = "text-smoke font-mono text-[11px] whitespace-nowrap";

  const viewBtnCls = (active: boolean) =>
    [
      "bg-transparent border border-iron text-ash w-7 h-[26px] rounded-[3px] cursor-pointer",
      "flex items-center justify-center transition-colors hover:text-chalk",
      active ? "border-gold/60 text-gold" : "",
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
      className="flex flex-col h-screen overflow-hidden bg-void text-chalk font-sans"
    >
      {/* ── Topbar ─────────────────────────────────────────────────────────── */}
      <header
        data-qa="artifacts-topbar"
        className="flex items-center gap-2 px-4 h-11 border-b border-iron shrink-0"
      >
        {/* Sidebar toggle */}
        <SidebarTrigger className="h-7 w-7 text-ash hover:text-chalk shrink-0" />
        {/* Back button + Breadcrumb */}
        <button
          data-qa="artifacts-back-btn"
          className="flex items-center gap-[5px] bg-transparent border-none text-ash cursor-pointer font-sans text-[12px] p-0 pr-2 transition-colors hover:text-chalk shrink-0 border-r border-iron mr-2"
          onClick={onBack}
          title="Back to Operator"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Operator
        </button>
        <div className="flex items-center gap-[3px] text-[12px] flex-1 min-w-0 overflow-hidden">
          <span className="text-ash shrink-0">Artifacts</span>
          {nav.kind === "service" && (
            <>
              <span className="text-smoke mx-[2px]">/</span>
              <button
                className="bg-transparent border-none text-ash cursor-pointer font-sans text-[12px] px-[3px] py-[2px] rounded transition-colors hover:text-chalk whitespace-nowrap overflow-hidden text-ellipsis max-w-[160px]"
                onClick={() => handleCrumb(-1)}
              >
                {nav.name}
              </button>
            </>
          )}
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-[3px] shrink-0">
              <span className="text-smoke">/</span>
              <button
                className="bg-transparent border-none text-chalk cursor-pointer font-sans text-[12px] px-[3px] py-[2px] rounded transition-colors hover:text-chalk whitespace-nowrap"
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
              className="bg-obsidian border border-iron rounded-[3px] text-chalk font-sans text-[11px] px-[8px] py-[4px] w-[160px] outline-none transition-colors focus:border-gold placeholder:text-smoke"
              type="search"
              placeholder="Search files…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              onBlur={() => { if (!query) setShowSearch(false); }}
            />
          )}
          <button
            className="bg-transparent border-none text-ash cursor-pointer transition-colors hover:text-chalk p-1 rounded"
            onClick={() => setShowSearch((v) => !v)}
            title="Search"
          >
            <IconSearch />
          </button>
          <button
            className={[
              "flex items-center gap-[5px] font-sans text-[11px] px-[10px] py-[5px] rounded-[3px] border cursor-pointer transition-colors",
              syncing
                ? "text-gold border-gold/40 bg-gold/[0.05]"
                : "text-ash border-iron hover:text-chalk hover:border-ash",
            ].join(" ")}
            onClick={handleSyncAll}
            disabled={syncing}
            title="Sync all files to cloud"
          >
            <span className={syncing ? "animate-spin" : ""}><IconSync /></span>
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
        <main className="flex-1 flex flex-col overflow-hidden bg-void min-w-0">
          {/* Section header */}
          <div className="flex items-center justify-between px-5 py-[10px] border-b border-iron shrink-0">
            <div className="flex flex-col min-w-0">
              <h1 className="text-[14px] font-semibold text-chalk m-0 leading-[1.3] overflow-hidden text-ellipsis whitespace-nowrap max-w-[280px]">
                {sectionTitle}
              </h1>
              {entries.length > 0 && (
                <span className="text-[11px] text-smoke font-mono mt-[1px]">
                  {entries.length} artifact{entries.length !== 1 ? "s" : ""}
                  {totalSize > 0 ? ` · ${formatStorageBytes(totalSize)}` : ""}
                </span>
              )}
            </div>

            <div className="flex items-center gap-[6px] shrink-0">
              <div className="relative">
                <div className="flex rounded-[3px] overflow-hidden border border-iron">
                  <button
                    className="flex items-center gap-[5px] bg-gold text-void font-sans text-[11px] font-semibold px-[10px] py-[5px] cursor-pointer transition-[filter] hover:brightness-[1.1] border-r border-gold/50"
                    onClick={() => setNewFolder(true)}
                  >
                    + New
                  </button>
                  <button
                    className="bg-gold/90 text-void px-[6px] py-[5px] cursor-pointer transition-[filter] hover:brightness-[1.1]"
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
                className="flex items-center gap-[5px] bg-transparent border border-iron text-ash font-sans text-[11px] px-[10px] py-[5px] rounded-[3px] cursor-pointer transition-colors hover:text-chalk hover:border-ash"
                onClick={handleUpload}
                title="Upload files"
              >
                <IconUpload />
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

          {/* Filter pills */}
          <div className="flex gap-[5px] px-5 py-[8px] border-b border-iron shrink-0 overflow-x-auto scrollbar-none">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                data-qa={`artifacts-filter-${f.value}`}
                className={[
                  "font-sans text-[10px] font-medium tracking-[0.04em] uppercase rounded-full py-[3px] px-[10px] cursor-pointer transition-colors whitespace-nowrap shrink-0",
                  filter === f.value
                    ? "text-void bg-gold border border-gold"
                    : "bg-transparent border border-iron text-ash hover:text-chalk hover:border-ash",
                ].join(" ")}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {error && (
            <p className="text-[11px] text-ember px-5 py-[6px] m-0 border-b border-ember/20 shrink-0">
              {error}
            </p>
          )}

          {/* Content + Preview */}
          <div className="flex flex-1 overflow-hidden">
            {/* File list / grid */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              {/* Cloud panels */}
              {(nav.kind === "cloud_branch" || nav.kind === "cloud_shared") && (
                <div className="flex-1 overflow-y-auto py-2">
                  {cloudEntries.length === 0 ? (
                    <p className="text-center text-smoke text-xs py-12">
                      No synced files in this section.
                    </p>
                  ) : (
                    cloudEntries.map((info) => (
                      <div
                        key={info.artifact_id}
                        className="flex items-center gap-[10px] px-5 py-[8px] border-b border-iron/50 text-[12px] hover:bg-white/[0.02] transition-colors"
                      >
                        <SyncCell info={info} />
                        <span
                          className="flex-1 text-chalk overflow-hidden text-ellipsis whitespace-nowrap"
                          title={info.cloud_key ?? ""}
                        >
                          {info.cloud_key?.split("/").pop() ?? info.artifact_id}
                        </span>
                        <span className="text-[11px] text-ash font-mono shrink-0">
                          {info.last_synced_ms
                            ? `Synced ${formatDate(info.last_synced_ms)}`
                            : "Not yet synced"}
                        </span>
                        {info.sync_error && (
                          <span
                            className="text-[11px] text-ember shrink-0"
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
              {nav.kind !== "cloud_branch" && nav.kind !== "cloud_shared" && viewMode === "list" && (
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr>
                        <th className="text-left text-[9px] font-semibold tracking-[0.1em] uppercase text-smoke px-5 py-[7px] border-b border-iron sticky top-0 bg-void w-full">
                          Name
                        </th>
                        <th className="text-left text-[9px] font-semibold tracking-[0.1em] uppercase text-smoke px-4 py-[7px] border-b border-iron sticky top-0 bg-void whitespace-nowrap">
                          Type
                        </th>
                        <th className="text-right text-[9px] font-semibold tracking-[0.1em] uppercase text-smoke px-4 py-[7px] border-b border-iron sticky top-0 bg-void whitespace-nowrap">
                          Size
                        </th>
                        <th className="text-left text-[9px] font-semibold tracking-[0.1em] uppercase text-smoke px-4 py-[7px] border-b border-iron sticky top-0 bg-void whitespace-nowrap">
                          Modified
                        </th>
                        <th className="text-left text-[9px] font-semibold tracking-[0.1em] uppercase text-smoke px-4 py-[7px] border-b border-iron sticky top-0 bg-void whitespace-nowrap">
                          Sync
                        </th>
                        <th className="text-left text-[9px] font-semibold tracking-[0.1em] uppercase text-smoke px-4 py-[7px] border-b border-iron sticky top-0 bg-void whitespace-nowrap">
                          Shared
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="text-center text-smoke text-xs py-16"
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
                                "cursor-default border-b border-iron/40 transition-colors",
                                isSelected
                                  ? "bg-gold/[0.05]"
                                  : "hover:bg-white/[0.025]",
                              ].join(" ")}
                              onClick={() => setSelected(isSelected ? null : e)}
                              onContextMenu={(ev) => handleCtx(ev, e)}
                              onDoubleClick={() => handleNavigate(e)}
                            >
                              <td className="px-5 py-[7px] align-middle">
                                <div className="flex items-center gap-[8px] min-w-0">
                                  <span className="shrink-0">{fileIcon(e)}</span>
                                  <span className="text-chalk text-[12px] overflow-hidden text-ellipsis whitespace-nowrap">
                                    {e.name}
                                  </span>
                                  {e.starred && (
                                    <span className="text-gold text-[10px] shrink-0">★</span>
                                  )}
                                </div>
                              </td>
                              <td className={`px-4 py-[7px] align-middle ${metaCls}`}>
                                {e.is_dir
                                  ? "Folder"
                                  : (e.mime_type?.split("/")[1]?.toUpperCase() ?? "File")}
                              </td>
                              <td className={`px-4 py-[7px] align-middle ${metaCls} text-right`}>
                                {e.is_dir ? "—" : formatBytes(e.size_bytes)}
                              </td>
                              <td className={`px-4 py-[7px] align-middle ${metaCls}`}>
                                {formatDate(e.modified_at_ms)}
                              </td>
                              <td className="px-4 py-[7px] align-middle w-[80px]">
                                <SyncCell info={sync} />
                              </td>
                              <td className="px-4 py-[7px] align-middle w-[80px]">
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
              {nav.kind !== "cloud_branch" && nav.kind !== "cloud_shared" && viewMode === "grid" && (
                <div className="flex-1 flex flex-wrap content-start gap-3 p-5 overflow-y-auto">
                  {visible.length === 0 ? (
                    <p className="w-full text-center text-smoke text-xs py-16">
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
                            "relative w-[88px] flex flex-col items-center gap-[6px] px-2 py-3 rounded-[4px] border cursor-default transition-colors",
                            isSelected
                              ? "border-gold/40 bg-gold/[0.05]"
                              : "border-transparent hover:bg-white/[0.04] hover:border-iron",
                          ].join(" ")}
                          onClick={() => setSelected(isSelected ? null : e)}
                          onContextMenu={(ev) => handleCtx(ev, e)}
                          onDoubleClick={() => handleNavigate(e)}
                        >
                          <div className="text-[28px] leading-none flex items-center justify-center h-8">
                            {fileIcon(e)}
                          </div>
                          <span
                            className="text-[11px] text-chalk text-center max-w-[72px] overflow-hidden text-ellipsis whitespace-nowrap w-full"
                            title={e.name}
                          >
                            {e.name}
                          </span>
                          {e.starred && (
                            <span className="absolute top-[5px] right-[6px] text-gold text-[10px]">★</span>
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
      <footer className="flex items-center justify-between px-4 h-[26px] border-t border-iron bg-obsidian shrink-0 gap-4">
        {/* Left: path */}
        <span className="flex items-center gap-[6px] font-mono text-[10px] text-smoke min-w-0 overflow-hidden">
          <span className="w-[5px] h-[5px] rounded-full bg-smoke/60 shrink-0" />
          {settings ? (
            <span className="overflow-hidden text-ellipsis whitespace-nowrap" title={settings.base_path}>
              {settings.base_path}
              {nav.kind === "service" ? `/${nav.name}` : ""}
              {crumbs.map((c) => `/${c.label}`).join("")}
            </span>
          ) : (
            <span className="text-smoke/50">
              {nav.kind === "cloud_branch" || nav.kind === "cloud_shared"
                ? `${cloudEntries.length} synced item${cloudEntries.length !== 1 ? "s" : ""}`
                : `${visible.length} item${visible.length !== 1 ? "s" : ""}`}
            </span>
          )}
        </span>

        {/* Right: sync status + branch */}
        <div className="flex items-center gap-3 shrink-0">
          {lastSyncLabel && (
            <span className="flex items-center gap-[4px] text-[10px] text-smoke font-mono">
              <IconSync />
              {lastSyncLabel}
            </span>
          )}
          <span className="flex items-center gap-[5px] text-[10px] text-smoke font-mono">
            <span className="w-[5px] h-[5px] rounded-full bg-gold/60 shrink-0" />
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
            invoke<StorageUsage>("get_storage_usage").then(setStorageUsage).catch(() => {});
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
