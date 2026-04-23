import { useEffect, useRef } from "react";
import {
  ExternalLinkIcon,
  EyeIcon,
  Share2Icon,
  FolderInputIcon,
  CloudIcon,
  UploadCloudIcon,
  StarIcon,
  PenLineIcon,
  Trash2Icon,
} from "lucide-react";
import type { ArtifactEntry, CloudSyncInfo } from "../../../lib/types";
import type { CtxMenu } from "./types";

export function AssetContextMenu({
  menu,
  syncInfo,
  onOpen,
  onPreview,
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
  onPreview: (e: ArtifactEntry) => void;
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
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const item = (
    icon: React.ReactNode,
    label: string,
    onClick: () => void,
    shortcut?: string,
    danger?: boolean,
  ) => (
    <button
      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-sm border-none bg-transparent px-3 py-1.5 text-left font-sans text-[12px] whitespace-nowrap transition-colors ${
        danger
          ? "text-ink hover:bg-danger/10 hover:text-danger"
          : "text-ink hover:bg-bg-2"
      }`}
      onClick={() => {
        onClick();
        onClose();
      }}
    >
      <span className={danger ? "" : "text-ink-3"}>{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="font-mono text-[10px] text-muted">{shortcut}</span>
      )}
    </button>
  );

  const sep = <div className="mx-2 my-1 h-px bg-line" />;
  const icn = "w-3.5 h-3.5 shrink-0";

  return (
    <div
      ref={ref}
      data-qa="artifacts-ctx-menu"
      className="fixed z-[1000] min-w-[200px] rounded-lg border border-line-strong bg-bg-1 py-1.5 shadow-lg"
      style={{ top: menu.y, left: menu.x }}
    >
      {!menu.entry.is_dir &&
        item(
          <ExternalLinkIcon className={icn} />,
          "Open",
          () => onOpen(menu.entry),
          "⌘ + O",
        )}
      {!menu.entry.is_dir &&
        item(
          <EyeIcon className={icn} />,
          "Preview",
          () => onPreview(menu.entry),
          "Space",
        )}
      {item(<Share2Icon className={icn} />, "Share ...", () =>
        onShare(menu.entry),
      )}
      {item(<FolderInputIcon className={icn} />, "Move to ...", () =>
        onMoveTo(menu.entry),
      )}
      {sep}
      {syncInfo?.sync_enabled
        ? syncInfo.status !== "syncing" &&
          item(<CloudIcon className={icn} />, "Sync now", () =>
            onSyncNow(menu.entry),
          )
        : item(<UploadCloudIcon className={icn} />, "Sync to Cloud", () =>
            onShare(menu.entry),
          )}
      {item(
        <StarIcon className={icn} />,
        menu.entry.starred ? "Unstar" : "Star",
        () => onStar(menu.entry),
      )}
      {item(
        <PenLineIcon className={icn} />,
        "Rename",
        () => onRename(menu.entry),
        "F2",
      )}
      {sep}
      {item(
        <Trash2Icon className={icn} />,
        "Delete",
        () => onDelete(menu.entry),
        "⌫",
        true,
      )}
    </div>
  );
}
