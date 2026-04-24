import type { ArtifactEntry, CloudSyncInfo } from "../../lib/types";
import type { UploadEntry } from "../../stores/upload-store";
import { formatBytes, formatDate } from "../../lib/artifact-utils";
import { FileIcon } from "./ArtifactIcons";
import { SyncCell, SharedCell } from "./ArtifactSyncCells";

export function ArtifactList({
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
  const metaCls = "text-muted font-mono text-[11px] whitespace-nowrap";
  const uploading = pendingUploads.filter((u) => u.status === "uploading");

  return (
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
          {uploading.map((u) => (
            <tr key={u.id} className="animate-pulse border-b border-line/40">
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
              <td className="px-3 py-2.5 text-xs text-ink-3">{u.name}</td>
              <td colSpan={4} className="px-3 py-2.5 font-mono text-[10px] text-muted">
                Uploading…
              </td>
            </tr>
          ))}
          {visible.length === 0 && uploading.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-16 text-center text-xs text-muted">
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
                    isSelected ? "bg-accent-soft" : "hover:bg-white/[0.025]",
                  ].join(" ")}
                  onClick={() => onSelect(e)}
                  onContextMenu={(ev) => onContextMenu(ev, e)}
                  onDoubleClick={() => onNavigate(e)}
                >
                  <td className="px-5 py-[7px] align-middle">
                    <div className="flex min-w-0 items-center gap-[8px]">
                      <span className="shrink-0"><FileIcon entry={e} /></span>
                      <span className="overflow-hidden text-[12px] text-ellipsis whitespace-nowrap text-ink">
                        {e.name}
                      </span>
                      {e.starred && (
                        <span className="shrink-0 text-[10px] text-accent">★</span>
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
  );
}
