import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { PaperclipIcon, PlayIcon, SearchIcon } from "lucide-react";
import { listRecentArtifacts } from "../../../lib/commands/artifacts";
import type { ArtifactEntry } from "../../../lib/types";
import { toastError } from "../../../lib/toast";
import { useQueue } from "../../../hooks/use-queue";

function ThumbnailImage({
  artifactId,
  thumbnailPath,
  className,
}: {
  artifactId: string;
  thumbnailPath: string | null;
  className?: string;
}) {
  if (!thumbnailPath) {
    return null;
  }
  return (
    <img
      src={`owmedia://localhost/thumbnail/${artifactId}`}
      alt=""
      className={className || "h-full w-full rounded object-cover"}
    />
  );
}

export function AssetsPanel() {
  const [assets, setAssets] = useState<ArtifactEntry[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [assetQuery, setAssetQuery] = useState("");
  const { pushAsset } = useQueue();

  const loadAssets = useCallback(() => {
    listRecentArtifacts(50)
      .then(setAssets)
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // Patch thumbnail_path in-place when a background thumbnail becomes ready
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<{ id: string; thumbnail_path: string }>(
      "artifacts://thumbnail-ready",
      (ev) => {
        const { id, thumbnail_path } = ev.payload;
        setAssets((prev) =>
          prev.map((a) =>
            a.id === id ? { ...a, thumbnail_path } : a,
          ),
        );
      },
    ).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, []);

  const filtered = (
    assetQuery.trim()
      ? assets.filter((a) =>
          a.name.toLowerCase().includes(assetQuery.toLowerCase()),
        )
      : assets
  ).filter(
    (a) => a.name !== "_thumbnails" && !a.path.includes("/_thumbnails/"),
  );

  const handlePushAsset = async (asset: ArtifactEntry) => {
    try {
      await pushAsset(asset);
    } catch (e) {
      toastError("Failed to push asset")(e);
    }
  };

  return (
    <div className="flex h-1/2 flex-col overflow-hidden border-t border-line">
      {/* Header */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-line bg-bg-1 px-3.5">
        <span className="font-mono text-[10px] tracking-[0.14em] text-ink-3 uppercase">
          Assets
        </span>
        <button
          className="cursor-pointer text-ink-3 transition-colors hover:text-ink"
          onClick={() => setSearchOpen((v) => !v)}
          aria-label="Search assets"
        >
          <SearchIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Search (toggled) */}
      {searchOpen && (
        <div className="border-b border-line px-3 py-2.5">
          <input
            className="w-full rounded border border-line bg-bg-2 px-2.5 py-[7px] text-xs text-ink focus:border-line-strong"
            placeholder="Filter assets..."
            value={assetQuery}
            onChange={(e) => setAssetQuery(e.target.value)}
            autoFocus
          />
        </div>
      )}

      {/* Asset grid */}
      <div className="grid grid-cols-3 gap-1 overflow-y-auto p-2">
        {filtered.map((asset) => (
          <div
            key={asset.id}
            className="group relative aspect-square h-[86px] w-[86px] overflow-hidden rounded border border-line bg-bg-2"
          >
            {/* Thumbnail or icon */}
            {asset.thumbnail_path ? (
              <ThumbnailImage
                artifactId={asset.id}
                thumbnailPath={asset.thumbnail_path}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-ink-3">
                <PaperclipIcon className="h-5 w-5" />
              </div>
            )}
            {/* Name at bottom */}
            <div className="absolute right-0 bottom-0 left-0 bg-bg/80 px-1.5 py-0.5">
              <span className="block truncate text-[9px] text-ink">
                {asset.name}
              </span>
            </div>
            {/* Hover actions */}
            <div className="absolute top-0.5 right-0.5 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                className="cursor-pointer rounded bg-bg/80 p-1 text-ink-3 transition-colors hover:text-accent"
                title="Push to display"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePushAsset(asset);
                }}
              >
                <PlayIcon className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-2 px-3.5 py-6 text-center text-xs text-muted">
            {assetQuery.trim() ? "No matching assets" : "No recent assets"}
          </div>
        )}
      </div>
    </div>
  );
}
