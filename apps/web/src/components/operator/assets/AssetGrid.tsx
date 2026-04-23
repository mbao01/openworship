import { SearchIcon, FolderIcon, StarIcon } from "lucide-react";
import type { ArtifactEntry, CloudSyncInfo } from "../../../lib/types";
import { fileIcon } from "./helpers";
import { ThumbnailImage } from "./ThumbnailImage";
import { SyncCell } from "./SyncCell";

export function AssetGrid({
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
  return (
    <div className="flex-1 overflow-y-auto">
      <div
        style={{
          transform: `scale(${zoom / 100})`,
          transformOrigin: "top left",
          width: `${10000 / zoom}%`,
        }}
        className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-4 p-4"
      >
        {visible.length === 0 ? (
          <div className="flex w-full flex-col items-center gap-2 py-16 text-xs text-muted">
            {query ? (
              <SearchIcon className="h-8 w-8 text-muted/50" />
            ) : (
              <FolderIcon className="h-8 w-8 text-muted/50" />
            )}
            <span>{query ? "No results." : "No files here yet."}</span>
          </div>
        ) : (
          visible.map((e) => {
            const sync = syncInfoMap.get(e.id);
            const isSelected = selected?.id === e.id;
            return (
              <div
                key={e.id}
                data-qa="artifacts-tile"
                className={[
                  "group relative aspect-square cursor-default overflow-hidden rounded border bg-bg-2 transition-colors",
                  isSelected
                    ? "border-accent/40 ring-1 ring-accent/20"
                    : "border-line hover:border-line-strong",
                ].join(" ")}
                onClick={() => onSelect(isSelected ? null : e)}
                onContextMenu={(ev) => onContextMenu(ev, e)}
                onDoubleClick={() => onNavigate(e)}
              >
                {/* Thumbnail or icon */}
                {e.thumbnail_path ? (
                  <ThumbnailImage
                    artifactId={e.id}
                    thumbnailPath={e.thumbnail_path}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-ink-3">
                    {fileIcon(e, "lg")}
                  </div>
                )}
                {/* Name overlay */}
                <div className="absolute right-0 bottom-0 left-0 bg-bg/80 px-1.5 py-0.5">
                  <span
                    className="block truncate text-[9px] text-ink"
                    title={e.name}
                  >
                    {e.name}
                  </span>
                </div>
                {/* Badges */}
                {e.starred && (
                  <span className="absolute top-1 right-1 text-accent">
                    <StarIcon className="h-2.5 w-2.5" />
                  </span>
                )}
                {sync?.sync_enabled && (
                  <span className="absolute top-1 left-1">
                    <SyncCell info={sync} />
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
