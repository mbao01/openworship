import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
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
 * All types use owmedia:// — no IPC round-trip, no blob allocation.
 */
function resolveArtifactUrl(artifactId: string): string {
  return `owmedia://localhost/${artifactId}`;
}

/**
 * Resolve uploaded background values to renderable URLs.
 */
function resolveUploadedValues(items: BackgroundInfo[]): BackgroundInfo[] {
  return items.map((bg) => {
    if (bg.value.startsWith("artifact:")) {
      const artId = bg.value.replace("artifact:", "");
      return { ...bg, value: resolveArtifactUrl(artId) };
    }
    return bg;
  });
}

export function useDisplayBackground(): UseDisplayBackgroundReturn {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [presets, setPresets] = useState<BackgroundInfo[]>([]);
  const [uploaded, setUploaded] = useState<BackgroundInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const uploadedLoaded = useRef(false);

  // Fast mount: load presets + active background ID.
  // If active bg is an artifact, eagerly resolve just that one (not all uploaded).
  useEffect(() => {
    Promise.all([getDisplayBackground(), listPresetBackgrounds()])
      .then(async ([bg, p]) => {
        setActiveId(bg);
        setPresets(p);

        // Eagerly resolve the active background if it's an artifact
        if (bg?.startsWith("artifact:")) {
          const artId = bg.replace("artifact:", "");
          try {
            const all = await listUploadedBackgrounds();
            const active = all.find((u) => u.id === bg);
            if (active) {
              setUploaded([{ ...active, value: resolveArtifactUrl(artId) }]);
            }
          } catch {
            // non-critical — bg picker will load all later
          }
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  // Lazy: load ALL uploaded backgrounds on demand (called when picker opens)
  const loadUploaded = useCallback(() => {
    if (uploadedLoaded.current) return;
    uploadedLoaded.current = true;
    listUploadedBackgrounds()
      .then((u) => {
        const resolved = resolveUploadedValues(u);
        // Merge with any eagerly-loaded active background
        setUploaded((prev) => {
          const prevIds = new Set(prev.map((p) => p.id));
          const newItems = resolved.filter((r) => !prevIds.has(r.id));
          return [...prev, ...newItems];
        });
      })
      .catch((err) => console.error(err));
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
      setUploaded((prev) => [
        ...prev,
        { ...info, value: resolveArtifactUrl(artId) },
      ]);
      return;
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
