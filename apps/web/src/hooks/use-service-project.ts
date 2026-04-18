import { useCallback, useEffect, useState } from "react";
import {
  getActiveProject,
  openServiceProject,
  closeActiveProject,
  addItemToActiveProject,
  removeItemFromActiveProject,
  reorderActiveProjectItems,
} from "@/lib/commands/projects";
import type { ServiceProject, ProjectItem } from "@/lib/types";

export interface UseServiceProjectReturn {
  project: ServiceProject | null;
  loading: boolean;
  open: (id: string) => Promise<void>;
  close: () => Promise<void>;
  addItem: (item: Omit<ProjectItem, "id" | "position" | "added_at_ms">) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  reorder: (ids: string[]) => Promise<void>;
}

/**
 * Manages the active service project — the ordered content plan for a service.
 *
 * Loads the active project on mount and provides CRUD operations
 * that stay in sync with the backend.
 */
export function useServiceProject(): UseServiceProjectReturn {
  const [project, setProject] = useState<ServiceProject | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const p = await getActiveProject();
      setProject(p);
    } catch (e) {
      console.error("[use-service-project] refresh failed:", e);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const open = useCallback(async (id: string) => {
    await openServiceProject(id);
    await refresh();
  }, [refresh]);

  const close = useCallback(async () => {
    await closeActiveProject();
    setProject(null);
  }, []);

  const addItem = useCallback(async (
    item: Omit<ProjectItem, "id" | "position" | "added_at_ms">
  ) => {
    await addItemToActiveProject(item.reference, item.text, item.translation);
    await refresh();
  }, [refresh]);

  const removeItem = useCallback(async (id: string) => {
    await removeItemFromActiveProject(id);
    await refresh();
  }, [refresh]);

  const reorder = useCallback(async (ids: string[]) => {
    await reorderActiveProjectItems(ids);
    await refresh();
  }, [refresh]);

  return { project, loading, open, close, addItem, removeItem, reorder };
}
