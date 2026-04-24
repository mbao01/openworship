import { useEffect, useRef } from "react";
import type { ArtifactEntry, CloudSyncInfo } from "../../lib/types";

export interface CtxMenu {
  x: number;
  y: number;
  entry: ArtifactEntry;
}

export function ArtifactContextMenu({
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
