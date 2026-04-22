import { SearchIcon, FolderIcon, StarIcon } from "lucide-react";
import type { ArtifactEntry, CloudSyncInfo } from "../../../lib/types";
import { formatBytes, formatDate, fileIcon } from "./helpers";
import { SyncCell, SharedCell } from "./SyncCell";

export function AssetTable({
  visible,
  syncInfoMap,
  selected,
  query,
  zoom,
  onSelect,
  onContextMenu,
  onNavigate,
}: {
  visible: ArtifactEntry[];
  syncInfoMap: Map<string, CloudSyncInfo>;
  selected: ArtifactEntry | null;
  query: string;
  zoom: number;
  onSelect: (e: ArtifactEntry | null) => void;
  onContextMenu: (ev: React.MouseEvent, e: ArtifactEntry) => void;
  onNavigate: (e: ArtifactEntry) => void;
}) {
  const metaCls = "text-muted font-mono text-[11px] whitespace-nowrap";

  return (
    <div className="flex-1 overflow-y-auto">
      <div
        style={{
          transform: `scale(${zoom / 100})`,
          transformOrigin: "top left",
          width: `${10000 / zoom}%`,
        }}
      >
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky top-0 w-full border-b border-line bg-bg-1 px-5 py-[7px] text-left font-mono text-[10px] font-semibold tracking-[0.1em] text-muted uppercase">
                Name
              </th>
              <th className="sticky top-0 border-b border-line bg-bg-1 px-4 py-[7px] text-left font-mono text-[10px] font-semibold tracking-[0.1em] whitespace-nowrap text-muted uppercase">
                Type
              </th>
              <th className="sticky top-0 border-b border-line bg-bg-1 px-4 py-[7px] text-right font-mono text-[10px] font-semibold tracking-[0.1em] whitespace-nowrap text-muted uppercase">
                Size
              </th>
              <th className="sticky top-0 border-b border-line bg-bg-1 px-4 py-[7px] text-left font-mono text-[10px] font-semibold tracking-[0.1em] whitespace-nowrap text-muted uppercase">
                Modified
              </th>
              <th className="sticky top-0 border-b border-line bg-bg-1 px-4 py-[7px] text-left font-mono text-[10px] font-semibold tracking-[0.1em] whitespace-nowrap text-muted uppercase">
                Sync
              </th>
              <th className="sticky top-0 border-b border-line bg-bg-1 px-4 py-[7px] text-left font-mono text-[10px] font-semibold tracking-[0.1em] whitespace-nowrap text-muted uppercase">
                Shared
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-16 text-center text-xs text-muted"
                >
                  <div className="flex flex-col items-center gap-2">
                    {query ? (
                      <SearchIcon className="h-8 w-8 text-muted/50" />
                    ) : (
                      <FolderIcon className="h-8 w-8 text-muted/50" />
                    )}
                    <span>{query ? "No results." : "No files here yet."}</span>
                  </div>
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
                      isSelected ? "bg-accent-soft" : "hover:bg-bg-2",
                    ].join(" ")}
                    onClick={() => onSelect(isSelected ? null : e)}
                    onContextMenu={(ev) => onContextMenu(ev, e)}
                    onDoubleClick={() => onNavigate(e)}
                  >
                    <td className="px-5 py-[7px] align-middle">
                      <div className="flex min-w-0 items-center gap-[8px]">
                        <span className="shrink-0">{fileIcon(e)}</span>
                        <span className="overflow-hidden text-[13px] text-ellipsis whitespace-nowrap text-ink">
                          {e.name}
                        </span>
                        {e.starred && (
                          <span className="shrink-0 text-accent">
                            <StarIcon className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`px-4 py-[7px] align-middle ${metaCls}`}>
                      {e.is_dir
                        ? "Folder"
                        : (e.mime_type?.split("/")[1]?.toUpperCase() ?? "File")}
                    </td>
                    <td
                      className={`px-4 py-[7px] align-middle ${metaCls} text-right`}
                    >
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
    </div>
  );
}
