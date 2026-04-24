import type { ArtifactEntry, CloudSyncInfo } from "../../lib/types";
import type { UploadEntry } from "../../stores/upload-store";
import { FileIcon } from "./ArtifactIcons";
import { SyncCell } from "./ArtifactSyncCells";

export function ArtifactGrid({
  visible,
  pendingUploads,
  syncInfoMap,
  selected,
  query,
  onSelect,
  onContextMenu,
  onNavigate,
}: {
  visible: ArtifactEntry[];
  pendingUploads: UploadEntry[];
  syncInfoMap: Map<string, CloudSyncInfo>;
  selected: ArtifactEntry | null;
  query: string;
  onSelect: (e: ArtifactEntry) => void;
  onContextMenu: (ev: React.MouseEvent, e: ArtifactEntry) => void;
  onNavigate: (e: ArtifactEntry) => void;
}) {
  const uploading = pendingUploads.filter((u) => u.status === "uploading");

  return (
    <div className="flex flex-1 flex-wrap content-start gap-3 overflow-y-auto p-5">
      {uploading.map((u) => (
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
      {visible.length === 0 && uploading.length === 0 ? (
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
              onClick={() => onSelect(e)}
              onContextMenu={(ev) => onContextMenu(ev, e)}
              onDoubleClick={() => onNavigate(e)}
            >
              <div className="flex h-8 items-center justify-center text-[28px] leading-none">
                <FileIcon entry={e} />
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
  );
}
