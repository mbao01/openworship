import {
  SearchIcon,
  FolderIcon,
  StarIcon,
} from "lucide-react";
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
              <th className="text-left font-mono text-[10px] font-semibold tracking-[0.1em] uppercase text-muted px-5 py-[7px] border-b border-line sticky top-0 bg-bg-1 w-full">
                Name
              </th>
              <th className="text-left font-mono text-[10px] font-semibold tracking-[0.1em] uppercase text-muted px-4 py-[7px] border-b border-line sticky top-0 bg-bg-1 whitespace-nowrap">
                Type
              </th>
              <th className="text-right font-mono text-[10px] font-semibold tracking-[0.1em] uppercase text-muted px-4 py-[7px] border-b border-line sticky top-0 bg-bg-1 whitespace-nowrap">
                Size
              </th>
              <th className="text-left font-mono text-[10px] font-semibold tracking-[0.1em] uppercase text-muted px-4 py-[7px] border-b border-line sticky top-0 bg-bg-1 whitespace-nowrap">
                Modified
              </th>
              <th className="text-left font-mono text-[10px] font-semibold tracking-[0.1em] uppercase text-muted px-4 py-[7px] border-b border-line sticky top-0 bg-bg-1 whitespace-nowrap">
                Sync
              </th>
              <th className="text-left font-mono text-[10px] font-semibold tracking-[0.1em] uppercase text-muted px-4 py-[7px] border-b border-line sticky top-0 bg-bg-1 whitespace-nowrap">
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
                  <div className="flex flex-col items-center gap-2">
                    {query ? <SearchIcon className="w-8 h-8 text-muted/50" /> : <FolderIcon className="w-8 h-8 text-muted/50" />}
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
                      isSelected
                        ? "bg-accent-soft"
                        : "hover:bg-bg-2",
                    ].join(" ")}
                    onClick={() =>
                      onSelect(isSelected ? null : e)
                    }
                    onContextMenu={(ev) => onContextMenu(ev, e)}
                    onDoubleClick={() => onNavigate(e)}
                  >
                    <td className="px-5 py-[7px] align-middle">
                      <div className="flex items-center gap-[8px] min-w-0">
                        <span className="shrink-0">
                          {fileIcon(e)}
                        </span>
                        <span className="text-ink text-[13px] overflow-hidden text-ellipsis whitespace-nowrap">
                          {e.name}
                        </span>
                        {e.starred && (
                          <span className="text-accent shrink-0">
                            <StarIcon className="w-3 h-3" />
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
                      {e.is_dir
                        ? "\u2014"
                        : formatBytes(e.size_bytes)}
                    </td>
                    <td
                      className={`px-4 py-[7px] align-middle ${metaCls}`}
                    >
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
    </div>
  );
}
