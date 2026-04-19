import { useCallback, useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { ShareDialog } from "../ShareDialog";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@radix-ui/react-collapsible";
import {
  FolderIcon,
  FileIcon,
  ImageIcon,
  VideoIcon,
  Music2Icon,
  FileTextIcon,
  PresentationIcon,
  CloudIcon,
  SearchIcon,
  UploadIcon,
  RefreshCwIcon,
  ChevronDownIcon,
  ListIcon,
  LayoutGridIcon,
  StarIcon,
  CheckIcon,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "\u2014";
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

// ─── Icons (lucide-react) ────────────────────────────────────────────────────

const iconCls = "w-3.5 h-3.5 shrink-0";

function fileIcon(e: ArtifactEntry) {
  if (e.is_dir)
    return <span className="text-accent/80"><FolderIcon className={iconCls} /></span>;
  const cat = mimeCategory(e.mime_type);
  const colorCls =
    cat === "image" ? "text-[#7ba6d4]" :
    cat === "video" ? "text-[#9a7dd4]" :
    cat === "audio" ? "text-[#7dd4a0]" :
    cat === "document" ? "text-[#d4a07d]" :
    cat === "slide" ? "text-[#d47d7d]" :
    "text-ink-3";
  return (
    <span className={colorCls}>
      {cat === "image" ? <ImageIcon className={iconCls} /> :
       cat === "video" ? <VideoIcon className={iconCls} /> :
       cat === "audio" ? <Music2Icon className={iconCls} /> :
       cat === "document" ? <FileTextIcon className={iconCls} /> :
       cat === "slide" ? <PresentationIcon className={iconCls} /> :
       <FileIcon className={iconCls} />}
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
  if (!info || !info.sync_enabled) return <span className="text-muted text-[11px]">&mdash;</span>;

  if (info.status === "syncing" && info.progress !== null) {
    const pct = Math.round(info.progress * 100);
    return (
      <div className="flex items-center gap-[6px]">
        <div className="w-[48px] h-[3px] rounded-full bg-line overflow-hidden">
          <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[10px] font-mono text-ink-3">{pct}%</span>
      </div>
    );
  }

  if (info.status === "synced") {
    return (
      <span className="text-accent" title="Synced to cloud">
        <CheckIcon className={iconCls} />
      </span>
    );
  }

  if (info.status === "queued") return <span className="text-muted text-[10px]" title="Queued">&middot;&middot;&middot;</span>;
  if (info.status === "conflict") return <span className="text-[#e89a00] text-[10px]" title="Conflict">&#9888;</span>;
  if (info.status === "error") return <span className="text-danger text-[10px]" title={info.sync_error ?? "Error"}>&#10005;</span>;

  return <span className="text-muted text-[11px]">&mdash;</span>;
}

// ─── Shared cell ──────────────────────────────────────────────────────────────

function SharedCell({ info }: { info: CloudSyncInfo | undefined }) {
  if (!info || !info.sync_enabled) return <span className="text-muted text-[11px]">&mdash;</span>;

  if (info.cloud_key?.includes("public")) {
    return (
      <span className="inline-flex items-center px-[6px] py-[2px] rounded-[3px] text-[10px] font-medium bg-accent-soft text-accent border border-accent/25">
        Public
      </span>
    );
  }

  return <span className="text-muted text-[11px]">&mdash;</span>;
}

// ─── Artifacts Sidebar (shadcn Sidebar, collapsible="icon") ───────────────────

function AssetsNav({
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
    : "";
  const storagePct = usage?.quota_bytes
    ? Math.min(100, (usage.used_bytes / usage.quota_bytes) * 100)
    : 0;

  const navBtnCls = (active: boolean) =>
    `w-full flex items-center gap-2 px-3 py-1.5 text-[12px] rounded transition-colors cursor-pointer ${
      active
        ? "bg-accent-soft text-ink font-medium"
        : "text-ink-3 hover:text-ink hover:bg-bg-2"
    }`;

  return (
    <div className="w-[200px] shrink-0 bg-bg-1 border-r border-line flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {/* Local */}
        <div className="mb-3">
          <span className="block px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-3">Local</span>
          <button className={navBtnCls(isActive({ kind: "all" }))} onClick={() => onNav({ kind: "all" })}>
            <LayoutGridIcon className={iconCls} /> All Assets
          </button>
          <button className={navBtnCls(isActive({ kind: "recent" }))} onClick={() => onNav({ kind: "recent" })}>
            <RefreshCwIcon className={iconCls} /> Recent
          </button>
          <button className={navBtnCls(isActive({ kind: "starred" }))} onClick={() => onNav({ kind: "starred" })}>
            <StarIcon className={iconCls} /> Starred
          </button>
        </div>

        {/* Services */}
        {projects.length > 0 && (
          <div className="mb-3">
            <div className="h-px bg-line mx-2 mb-2" />
            <span className="block px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-3">Services</span>
            {projects.map((p) => (
              <button
                key={p.id}
                className={navBtnCls(isActive({ kind: "service", id: p.id, name: p.name }))}
                onClick={() => onNav({ kind: "service", id: p.id, name: p.name })}
              >
                <FolderIcon className={iconCls} />
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Cloud */}
        <div>
          <div className="h-px bg-line mx-2 mb-2" />
          <span className="block px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-3">Cloud</span>
          <Collapsible open={cloudExpanded} onOpenChange={onToggleCloud}>
            <CollapsibleTrigger asChild>
              <button
                className={navBtnCls(isActive({ kind: "cloud_branch" }))}
                onClick={() => onNav({ kind: "cloud_branch" })}
              >
                <CloudIcon className={iconCls} />
                <span className="flex-1 text-left">My Branch</span>
                <ChevronDownIcon className={`w-3 h-3 shrink-0 transition-transform ${cloudExpanded ? "" : "-rotate-90"}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pl-7 flex flex-col gap-0.5">
                {["Downtown", "Westside", "Youth Campus"].map((branch) => (
                  <span key={branch} className="flex items-center gap-2 px-2 py-1 text-[11px] text-ink-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                    {branch}
                  </span>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
          <button
            className={navBtnCls(isActive({ kind: "cloud_shared" }))}
            onClick={() => onNav({ kind: "cloud_shared" })}
          >
            <CloudIcon className={iconCls} />
            Church Shared
          </button>
        </div>
      </div>

      {/* Storage footer */}
      {storageLabel && (
        <div className="px-3 py-2 border-t border-line">
          <div className="h-[3px] bg-line rounded-full overflow-hidden mb-1.5">
            <div className="h-full bg-accent transition-[width] duration-300 rounded-full" style={{ width: `${storagePct}%` }} />
          </div>
          <span className="text-[10px] text-muted font-mono">{storageLabel}</span>
        </div>
      )}
    </div>
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
  const sep = <div className="h-px bg-line my-[3px] mx-2" />;

  return (
    <div
      ref={ref}
      data-qa="artifacts-ctx-menu"
      className="fixed z-[1000] bg-bg-2 border border-line-strong rounded-[5px] py-1 min-w-[160px] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
      style={{ top: menu.y, left: menu.x }}
    >
      {!menu.entry.is_dir && (
        <button className={btnCls} onClick={() => { onOpen(menu.entry); onClose(); }}>
          Open
        </button>
      )}
      <button className={btnCls} onClick={() => { onShare(menu.entry); onClose(); }}>
        Share...
      </button>
      <button className={btnCls} onClick={() => { onMoveTo(menu.entry); onClose(); }}>
        Move to...
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
        className={`${btnCls} text-danger`}
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
        className="bg-bg-1 border border-line-strong rounded-lg p-5 w-[320px] flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[13px] font-semibold text-ink m-0">Rename</p>
        <input
          className="bg-bg-2 border border-line rounded-[3px] text-ink font-sans text-[13px] px-[10px] py-[6px] outline-none transition-colors focus:border-accent"
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
            className="bg-transparent text-ink-3 border border-line rounded font-sans text-xs px-[14px] py-[6px] cursor-pointer transition-colors hover:text-ink hover:border-line-strong"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="bg-accent text-[#1A0D00] border-none rounded font-sans text-xs font-semibold px-[14px] py-[6px] cursor-pointer transition-[filter] hover:brightness-[1.12] disabled:opacity-40 disabled:cursor-default"
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
        className="bg-bg-1 border border-line-strong rounded-lg p-5 w-[320px] flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[13px] font-semibold text-ink m-0">New Folder</p>
        <input
          className="bg-bg-2 border border-line rounded-[3px] text-ink font-sans text-[13px] px-[10px] py-[6px] outline-none transition-colors focus:border-accent"
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
            className="bg-transparent text-ink-3 border border-line rounded font-sans text-xs px-[14px] py-[6px] cursor-pointer transition-colors hover:text-ink hover:border-line-strong"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="bg-accent text-[#1A0D00] border-none rounded font-sans text-xs font-semibold px-[14px] py-[6px] cursor-pointer transition-[filter] hover:brightness-[1.12] disabled:opacity-40 disabled:cursor-default"
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
        className="bg-bg-1 border border-line-strong rounded-lg p-5 w-[360px] flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[13px] font-semibold text-ink m-0">Move to Folder</p>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-[11px] text-ink-3 flex-wrap">
          <button className="text-ink-3 hover:text-ink transition-colors" onClick={handleRoot}>
            Root
          </button>
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="text-line">/</span>
              <button
                className="text-ink-3 hover:text-ink transition-colors"
                onClick={() => handleCrumb(i)}
              >
                {c.label}
              </button>
            </span>
          ))}
          {browsePath && (
            <span className="flex items-center gap-1">
              <span className="text-line">/</span>
              <span className="text-ink">{crumbs.length > 0 ? browsePath.split("/").pop() : browsePath}</span>
            </span>
          )}
        </div>

        {/* Folder list */}
        <div className="bg-bg-2 border border-line rounded-[3px] min-h-[120px] max-h-[200px] overflow-y-auto">
          {folders.length === 0 ? (
            <p className="text-[11px] text-line px-3 py-2 m-0">No sub-folders here.</p>
          ) : (
            folders.map((f) => (
              <div
                key={f.id}
                className={`flex items-center justify-between px-3 py-[6px] cursor-pointer text-[12px] transition-colors hover:bg-white/5 ${selected === f.path ? "text-accent bg-white/5" : "text-ink"}`}
                onClick={() => setSelected(f.path)}
                onDoubleClick={() => handleOpen(f)}
              >
                <span className="flex items-center gap-2">
                  <FolderIcon className={`${iconCls} text-ink-3`} />
                  {f.name}
                </span>
                <button
                  className="text-[10px] text-line hover:text-ink transition-colors ml-2 bg-transparent border-none cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); handleOpen(f); }}
                  title="Open folder"
                >
                  <ChevronDownIcon className="w-3 h-3 -rotate-90" />
                </button>
              </div>
            ))
          )}
        </div>

        <p className="text-[10px] text-ink-3 m-0">
          Moving <span className="text-ink">{entry.name}</span> to:{" "}
          <span className="text-accent font-mono">{destinationPath}</span>
        </p>

        <div className="flex justify-end gap-2">
          <button
            className="bg-transparent text-ink-3 border border-line rounded font-sans text-xs px-[14px] py-[6px] cursor-pointer transition-colors hover:text-ink hover:border-line-strong"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="bg-accent text-[#1A0D00] border-none rounded font-sans text-xs font-semibold px-[14px] py-[6px] cursor-pointer transition-[filter] hover:brightness-[1.12]"
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

  const ext = entry.name.split(".").pop()?.toUpperCase() ?? "\u2014";

  return (
    <div className="w-[260px] shrink-0 bg-bg-1 border-l border-line flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0">
        <span className="text-[9px] font-semibold tracking-[0.12em] uppercase text-muted">Preview</span>
        <button
          className="bg-transparent border-none text-muted cursor-pointer text-[12px] px-1 py-[2px] rounded hover:text-ink-3 transition-colors"
          onClick={onClose}
          aria-label="Close preview"
        >
          &#10005;
        </button>
      </div>

      {/* Render area */}
      <div className="mx-3 mb-2 rounded-[4px] overflow-hidden bg-bg border border-line flex-1 flex items-center justify-center min-h-0">
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
            <Music2Icon className="w-8 h-8 text-muted" />
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
              <span className="text-[10px] text-muted">Loading...</span>
            ) : textContent !== null ? (
              <>
                <pre className="text-[10px] font-mono text-ink-3 m-0 whitespace-pre-wrap break-words leading-[1.5]">
                  {textContent}
                </pre>
                {textTruncated && (
                  <p className="text-[9px] text-muted mt-2 m-0 italic">&mdash; truncated at 64 KB &mdash;</p>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted h-full justify-center">
                <FileIcon className="w-7 h-7" />
                <span className="text-[10px] font-mono">{ext}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted">
            <FileIcon className="w-7 h-7" />
            <span className="text-[10px] font-mono">{ext}</span>
          </div>
        )}
      </div>

      {/* Compact metadata footer */}
      <div className="px-3 pb-3 shrink-0 flex flex-col gap-[6px]">
        <p className="text-[11px] font-medium text-ink m-0 break-words leading-[1.3] truncate" title={entry.name}>
          {entry.name}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {entry.mime_type && (
            <span className="text-[10px] font-mono text-muted">{ext}</span>
          )}
          {!entry.is_dir && entry.size_bytes > 0 && (
            <span className="text-[10px] font-mono text-muted">{formatBytes(entry.size_bytes)}</span>
          )}
          <span className="text-[10px] font-mono text-muted">{formatDate(entry.modified_at_ms)}</span>
          {syncInfo?.sync_enabled && (
            <span className="text-[10px] font-mono text-muted capitalize">{syncInfo.status.replace("_", " ")}</span>
          )}
        </div>
        <button
          className="w-full bg-transparent border border-line rounded-[3px] text-ink-3 font-sans text-[11px] py-[6px] cursor-pointer transition-colors hover:text-ink hover:border-line-strong"
          onClick={() => onShare(entry)}
        >
          Share...
        </button>
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
      className="absolute right-0 top-full mt-[3px] z-[200] bg-bg-2 border border-line-strong rounded-[5px] py-1 min-w-[140px] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
    >
      <button className={btnCls} onClick={() => { onNewFolder(); onClose(); }}>
        New Folder
      </button>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export function AssetsScreen() {
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

  const visible = entries.filter(
    (e) => filter === "all" || (!e.is_dir && mimeCategory(e.mime_type) === filter)
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
          <span className="text-ink font-medium shrink-0">Assets</span>
          {nav.kind === "service" && (
            <>
              <span className="text-muted mx-[2px]">/</span>
              <button
                className="bg-transparent border-none text-ink-3 cursor-pointer font-sans text-[12px] px-[3px] py-[2px] rounded transition-colors hover:text-ink whitespace-nowrap overflow-hidden text-ellipsis max-w-[160px]"
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
                className="bg-transparent border-none text-ink cursor-pointer font-sans text-[12px] px-[3px] py-[2px] rounded transition-colors hover:text-ink whitespace-nowrap"
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
              className="bg-bg-2 border border-line rounded-[3px] text-ink font-sans text-[11px] px-[8px] py-[4px] w-[160px] outline-none transition-colors focus:border-accent placeholder:text-muted"
              type="search"
              placeholder="Search files..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              onBlur={() => { if (!query) setShowSearch(false); }}
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
              "flex items-center gap-[5px] font-sans text-[11px] px-[10px] py-[5px] rounded-[3px] border cursor-pointer transition-colors",
              syncing
                ? "text-accent border-accent/40 bg-accent-soft"
                : "text-ink-3 border-line hover:text-ink hover:border-line-strong",
            ].join(" ")}
            onClick={handleSyncAll}
            disabled={syncing}
            title="Sync all files to cloud"
          >
            <span className={syncing ? "animate-spin" : ""}><RefreshCwIcon className={iconCls} /></span>
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
              <h1 className="font-serif text-lg text-ink m-0 leading-[1.3] overflow-hidden text-ellipsis whitespace-nowrap max-w-[280px]">
                {sectionTitle}
              </h1>
              {entries.length > 0 && (
                <span className="text-[11px] text-muted font-mono mt-[1px]">
                  {entries.length} asset{entries.length !== 1 ? "s" : ""}
                  {totalSize > 0 ? ` \u00b7 ${formatStorageBytes(totalSize)}` : ""}
                </span>
              )}
            </div>

            <div className="flex items-center gap-[6px] shrink-0">
              <div className="relative">
                <div className="flex rounded-[3px] overflow-hidden border border-accent/30">
                  <button
                    className="flex items-center gap-[5px] bg-accent text-[#1A0D00] font-sans text-[11px] font-semibold px-[10px] py-[5px] cursor-pointer transition-[filter] hover:brightness-[1.1] border-r border-accent/50"
                    onClick={() => setNewFolder(true)}
                  >
                    + New
                  </button>
                  <button
                    className="bg-accent/90 text-[#1A0D00] px-[6px] py-[5px] cursor-pointer transition-[filter] hover:brightness-[1.1]"
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
                className="flex items-center gap-[5px] bg-transparent border border-line text-ink-3 font-sans text-[11px] px-[10px] py-[5px] rounded-[3px] cursor-pointer transition-colors hover:text-ink hover:border-line-strong"
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

          {/* Filter pills */}
          <div className="flex gap-[5px] px-5 py-[8px] border-b border-line shrink-0 overflow-x-auto scrollbar-none">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                data-qa={`artifacts-filter-${f.value}`}
                className={[
                  "font-sans text-[10px] font-medium tracking-[0.04em] uppercase rounded-full py-[3px] px-[10px] cursor-pointer transition-colors whitespace-nowrap shrink-0",
                  filter === f.value
                    ? "bg-accent text-[#1A0D00] border border-accent"
                    : "bg-bg-2 text-ink-3 border border-line hover:text-ink hover:border-line-strong",
                ].join(" ")}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {error && (
            <p className="text-[11px] text-danger px-5 py-[6px] m-0 border-b border-danger/20 shrink-0">
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
                    <p className="text-center text-muted text-xs py-12">
                      No synced files in this section.
                    </p>
                  ) : (
                    cloudEntries.map((info) => (
                      <div
                        key={info.artifact_id}
                        className="flex items-center gap-[10px] px-5 py-[8px] border-b border-line/50 text-[12px] hover:bg-white/[0.02] transition-colors"
                      >
                        <SyncCell info={info} />
                        <span
                          className="flex-1 text-ink overflow-hidden text-ellipsis whitespace-nowrap"
                          title={info.cloud_key ?? ""}
                        >
                          {info.cloud_key?.split("/").pop() ?? info.artifact_id}
                        </span>
                        <span className="text-[11px] text-ink-3 font-mono shrink-0">
                          {info.last_synced_ms
                            ? `Synced ${formatDate(info.last_synced_ms)}`
                            : "Not yet synced"}
                        </span>
                        {info.sync_error && (
                          <span
                            className="text-[11px] text-danger shrink-0"
                            title={info.sync_error}
                          >
                            &#9888; {info.sync_error.slice(0, 40)}
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
                        <th className="text-left text-[9px] font-semibold tracking-[0.1em] uppercase text-muted px-5 py-[7px] border-b border-line sticky top-0 bg-bg-1 w-full">
                          Name
                        </th>
                        <th className="text-left text-[9px] font-semibold tracking-[0.1em] uppercase text-muted px-4 py-[7px] border-b border-line sticky top-0 bg-bg-1 whitespace-nowrap">
                          Type
                        </th>
                        <th className="text-right text-[9px] font-semibold tracking-[0.1em] uppercase text-muted px-4 py-[7px] border-b border-line sticky top-0 bg-bg-1 whitespace-nowrap">
                          Size
                        </th>
                        <th className="text-left text-[9px] font-semibold tracking-[0.1em] uppercase text-muted px-4 py-[7px] border-b border-line sticky top-0 bg-bg-1 whitespace-nowrap">
                          Modified
                        </th>
                        <th className="text-left text-[9px] font-semibold tracking-[0.1em] uppercase text-muted px-4 py-[7px] border-b border-line sticky top-0 bg-bg-1 whitespace-nowrap">
                          Sync
                        </th>
                        <th className="text-left text-[9px] font-semibold tracking-[0.1em] uppercase text-muted px-4 py-[7px] border-b border-line sticky top-0 bg-bg-1 whitespace-nowrap">
                          Shared
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="text-center text-muted text-xs py-16"
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
                              onClick={() => setSelected(isSelected ? null : e)}
                              onContextMenu={(ev) => handleCtx(ev, e)}
                              onDoubleClick={() => handleNavigate(e)}
                            >
                              <td className="px-5 py-[7px] align-middle">
                                <div className="flex items-center gap-[8px] min-w-0">
                                  <span className="shrink-0">{fileIcon(e)}</span>
                                  <span className="text-ink text-[12px] overflow-hidden text-ellipsis whitespace-nowrap">
                                    {e.name}
                                  </span>
                                  {e.starred && (
                                    <span className="text-accent shrink-0"><StarIcon className="w-3 h-3" /></span>
                                  )}
                                </div>
                              </td>
                              <td className={`px-4 py-[7px] align-middle ${metaCls}`}>
                                {e.is_dir
                                  ? "Folder"
                                  : (e.mime_type?.split("/")[1]?.toUpperCase() ?? "File")}
                              </td>
                              <td className={`px-4 py-[7px] align-middle ${metaCls} text-right`}>
                                {e.is_dir ? "\u2014" : formatBytes(e.size_bytes)}
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
                    <p className="w-full text-center text-muted text-xs py-16">
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
                              ? "border-accent/40 bg-accent-soft"
                              : "border-transparent hover:bg-white/[0.04] hover:border-line",
                          ].join(" ")}
                          onClick={() => setSelected(isSelected ? null : e)}
                          onContextMenu={(ev) => handleCtx(ev, e)}
                          onDoubleClick={() => handleNavigate(e)}
                        >
                          <div className="text-[28px] leading-none flex items-center justify-center h-8">
                            {fileIcon(e)}
                          </div>
                          <span
                            className="text-[11px] text-ink text-center max-w-[72px] overflow-hidden text-ellipsis whitespace-nowrap w-full"
                            title={e.name}
                          >
                            {e.name}
                          </span>
                          {e.starred && (
                            <span className="absolute top-[5px] right-[6px] text-accent"><StarIcon className="w-2.5 h-2.5" /></span>
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
      <footer className="flex items-center justify-between px-4 h-[26px] border-t border-line bg-bg-1 shrink-0 gap-4">
        {/* Left: path */}
        <span className="flex items-center gap-[6px] font-mono text-[10px] text-muted min-w-0 overflow-hidden">
          <span className="w-[5px] h-[5px] rounded-full bg-muted/60 shrink-0" />
          {settings ? (
            <span className="overflow-hidden text-ellipsis whitespace-nowrap" title={settings.base_path}>
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
    </div>
    </div>
  );
}
