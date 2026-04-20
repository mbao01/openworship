import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PaperclipIcon, PlayIcon, SearchIcon } from "lucide-react";
import {
  listRecentArtifacts,
  readThumbnail,
} from "../../../lib/commands/artifacts";
import type { ArtifactEntry } from "../../../lib/types";
import { toastError } from "../../../lib/toast";

function ThumbnailImage({
  artifactId,
  thumbnailPath,
  className,
}: {
  artifactId: string;
  thumbnailPath: string | null;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!thumbnailPath) return;
    let revoked = false;
    let url: string | null = null;
    readThumbnail(artifactId)
      .then((bytes) => {
        if (revoked) return;
        const blob = new Blob([new Uint8Array(bytes)], { type: "image/jpeg" });
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => setSrc(null));
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [artifactId, thumbnailPath]);

  if (!thumbnailPath || !src) {
    return null;
  }
  return (
    <img
      src={src}
      alt=""
      className={className || "w-full h-full object-cover rounded"}
    />
  );
}

export function AssetsPanel() {
  const [assets, setAssets] = useState<ArtifactEntry[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [assetQuery, setAssetQuery] = useState("");

  useEffect(() => {
    listRecentArtifacts(50)
      .then(setAssets)
      .catch(() => {});
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
      await invoke("push_artifact_to_display", { artifactId: asset.id });
    } catch (e) {
      toastError("Failed to push asset")(e);
    }
  };

  return (
    <div className="flex flex-col h-1/2 overflow-hidden border-t border-line">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 h-9 shrink-0 border-b border-line bg-bg-1">
        <span className="font-mono text-[10px] text-ink-3 tracking-[0.14em] uppercase">
          Assets
        </span>
        <button
          className="text-ink-3 hover:text-ink transition-colors cursor-pointer"
          onClick={() => setSearchOpen((v) => !v)}
        >
          <SearchIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search (toggled) */}
      {searchOpen && (
        <div className="px-3 py-2.5 border-b border-line">
          <input
            className="w-full px-2.5 py-[7px] bg-bg-2 border border-line rounded text-ink text-xs focus:border-line-strong"
            placeholder="Filter assets..."
            value={assetQuery}
            onChange={(e) => setAssetQuery(e.target.value)}
            autoFocus
          />
        </div>
      )}

      {/* Asset grid */}
      <div className="grid grid-cols-3 gap-1 p-2 overflow-y-auto">
        {filtered.map((asset) => (
          <div
            key={asset.id}
            className="group relative aspect-square bg-bg-2 rounded border border-line overflow-hidden"
          >
            {/* Thumbnail or icon */}
            {asset.thumbnail_path ? (
              <ThumbnailImage
                artifactId={asset.id}
                thumbnailPath={asset.thumbnail_path}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-ink-3">
                <PaperclipIcon className="w-5 h-5" />
              </div>
            )}
            {/* Name at bottom */}
            <div className="absolute bottom-0 left-0 right-0 bg-bg/80 px-1.5 py-0.5">
              <span className="text-[9px] text-ink truncate block">
                {asset.name}
              </span>
            </div>
            {/* Hover actions */}
            <div className="absolute top-0.5 right-0.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                className="p-1 rounded bg-bg/80 text-ink-3 hover:text-accent transition-colors cursor-pointer"
                title="Push to display"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePushAsset(asset);
                }}
              >
                <PlayIcon className="w-3 h-3" />
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
