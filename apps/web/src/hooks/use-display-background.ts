import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  getDisplayBackground,
  listPresetBackgrounds,
  listUploadedBackgrounds,
  setDisplayBackground,
  uploadBackground,
  type BackgroundInfo,
} from "@/lib/commands/display";

export interface UseDisplayBackgroundReturn {
  /** Current live background ID (null = solid black) */
  activeId: string | null;
  /** All preset backgrounds */
  presets: BackgroundInfo[];
  /** All uploaded backgrounds (with blob URL values) */
  uploaded: BackgroundInfo[];
  /** Currently previewed background (before applying to live) */
  previewId: string | null;
  /** Set the preview (local state only, not sent to display) */
  setPreview: (id: string | null) => void;
  /** Apply a background to the live display and persist */
  applyToLive: (id: string | null) => Promise<void>;
  /** Clear the background (solid black) */
  clearBackground: () => Promise<void>;
  /** Upload a new background file */
  upload: (file: File) => Promise<void>;
  /** Whether data is loading */
  loading: boolean;
}

/**
 * Load artifact bytes via Tauri invoke and return a blob URL.
 * Returns null on failure.
 */
async function loadArtifactBlobUrl(artifactId: string): Promise<string | null> {
  try {
    const bytes = await invoke<number[]>("read_artifact_bytes", { id: artifactId });
    const blob = new Blob([new Uint8Array(bytes)]);
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/**
 * For uploaded backgrounds, resolve "artifact:{id}" values to blob URLs
 * so they can be rendered in <img> tags in the operator preview.
 */
async function resolveUploadedValues(
  items: BackgroundInfo[],
): Promise<BackgroundInfo[]> {
  return Promise.all(
    items.map(async (bg) => {
      if (bg.value.startsWith("artifact:")) {
        const artId = bg.value.replace("artifact:", "");
        const blobUrl = await loadArtifactBlobUrl(artId);
        if (blobUrl) {
          return { ...bg, value: blobUrl };
        }
      }
      return bg;
    }),
  );
}

export function useDisplayBackground(): UseDisplayBackgroundReturn {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [presets, setPresets] = useState<BackgroundInfo[]>([]);
  const [uploaded, setUploaded] = useState<BackgroundInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const blobUrls = useRef<string[]>([]);

  useEffect(() => {
    Promise.all([
      getDisplayBackground(),
      listPresetBackgrounds(),
      listUploadedBackgrounds(),
    ])
      .then(async ([bg, p, u]) => {
        setActiveId(bg);
        setPresets(p);
        // Resolve artifact references to blob URLs for operator preview
        const resolved = await resolveUploadedValues(u);
        // Track blob URLs for cleanup
        for (const r of resolved) {
          if (r.value.startsWith("blob:")) blobUrls.current.push(r.value);
        }
        setUploaded(resolved);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    const urls = blobUrls.current;
    return () => {
      // Revoke all blob URLs on unmount
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const applyToLive = useCallback(async (id: string | null) => {
    await setDisplayBackground(id);
    setActiveId(id);
    setPreviewId(null);
  }, []);

  const clearBackground = useCallback(async () => {
    await setDisplayBackground(null);
    setActiveId(null);
    setPreviewId(null);
  }, []);

  const upload = useCallback(async (file: File) => {
    const buffer = await file.arrayBuffer();
    const bytes = Array.from(new Uint8Array(buffer));
    const info = await uploadBackground(file.name, bytes);
    // Resolve the new upload's artifact value to a blob URL
    if (info.value.startsWith("artifact:")) {
      const artId = info.value.replace("artifact:", "");
      const blobUrl = await loadArtifactBlobUrl(artId);
      if (blobUrl) {
        blobUrls.current.push(blobUrl);
        setUploaded((prev) => [...prev, { ...info, value: blobUrl }]);
        return;
      }
    }
    setUploaded((prev) => [...prev, info]);
  }, []);

  return {
    activeId,
    presets,
    uploaded,
    previewId,
    setPreview: setPreviewId,
    applyToLive,
    clearBackground,
    upload,
    loading,
  };
}
