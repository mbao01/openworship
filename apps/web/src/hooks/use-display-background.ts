import { useCallback, useEffect, useRef, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import {
  getDisplayBackground,
  listPresetBackgrounds,
  listUploadedBackgrounds,
  setDisplayBackground,
  type BackgroundInfo,
} from "@/lib/commands/display";

export interface UseDisplayBackgroundReturn {
  /** Current live background ID (null = solid black) */
  activeId: string | null;
  /** All preset backgrounds */
  presets: BackgroundInfo[];
  /** All uploaded backgrounds (resolved values) */
  uploaded: BackgroundInfo[];
  /** Currently previewed background (before applying to live) */
  previewId: string | null;
  /** Set the preview (local state only, not sent to display) */
  setPreview: (id: string | null) => void;
  /** Apply a background to the live display and persist */
  applyToLive: (id: string | null) => Promise<void>;
  /** Clear the background (solid black) */
  clearBackground: () => Promise<void>;
  /** Upload a background from a native file path */
  upload: (sourcePath: string) => Promise<void>;
  /** Lazy-load uploaded backgrounds (call when picker opens) */
  loadUploaded: () => void;
  /** Whether data is loading */
  loading: boolean;
}

/**
 * Resolve an artifact reference to a usable URL.
 * Videos → convertFileSrc (no blob, streams from disk).
 * Images → blob URL via read_artifact_bytes.
 */
async function resolveArtifactUrl(
  artifactId: string,
  bgType: string,
): Promise<string | null> {
  try {
    if (bgType === "video") {
      // Videos: get the absolute path and use Tauri's asset protocol
      const absPath = await invoke<string>("get_artifact_path", {
        id: artifactId,
      });
      return convertFileSrc(absPath);
    }
    // Images: read bytes and create blob URL
    const bytes = await invoke<number[]>("read_artifact_bytes", {
      id: artifactId,
    });
    const blob = new Blob([new Uint8Array(bytes)]);
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/**
 * Resolve uploaded background values to renderable URLs.
 */
async function resolveUploadedValues(
  items: BackgroundInfo[],
): Promise<BackgroundInfo[]> {
  return Promise.all(
    items.map(async (bg) => {
      if (bg.value.startsWith("artifact:")) {
        const artId = bg.value.replace("artifact:", "");
        const url = await resolveArtifactUrl(artId, bg.bg_type);
        if (url) return { ...bg, value: url };
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
  const uploadedLoaded = useRef(false);

  // Fast mount: load only presets + active background ID (no file I/O)
  useEffect(() => {
    Promise.all([getDisplayBackground(), listPresetBackgrounds()])
      .then(([bg, p]) => {
        setActiveId(bg);
        setPresets(p);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    const urls = blobUrls.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  // Lazy: load uploaded backgrounds on demand (called when picker opens)
  const loadUploaded = useCallback(() => {
    if (uploadedLoaded.current) return;
    uploadedLoaded.current = true;
    listUploadedBackgrounds()
      .then(async (u) => {
        const resolved = await resolveUploadedValues(u);
        for (const r of resolved) {
          if (r.value.startsWith("blob:")) blobUrls.current.push(r.value);
        }
        setUploaded(resolved);
      })
      .catch(() => {});
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

  const upload = useCallback(async (sourcePath: string) => {
    const info = await invoke<BackgroundInfo>("import_background_file", {
      sourcePath,
    });
    if (info.value.startsWith("artifact:")) {
      const artId = info.value.replace("artifact:", "");
      const url = await resolveArtifactUrl(artId, info.bg_type);
      if (url) {
        if (url.startsWith("blob:")) blobUrls.current.push(url);
        setUploaded((prev) => [...prev, { ...info, value: url }]);
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
    loadUploaded,
    loading,
  };
}
