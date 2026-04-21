import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  getQueue,
  approveItem,
  dismissItem,
  skipItem,
  clearLive,
  clearQueue,
  nextItem,
  prevItem,
  rejectLiveItem,
} from "@/lib/commands/detection";
import type { QueueItem } from "@/lib/types";

export interface UseQueueReturn {
  /** All pending queue items. */
  queue: QueueItem[];
  /** The currently live item, if any. */
  live: QueueItem | null;
  approve: (id: string) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  skip: (id: string) => Promise<void>;
  rejectLive: () => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  clearLive: () => Promise<void>;
  clearQueue: () => Promise<void>;
}

/**
 * Manages the AI-detected content queue.
 *
 * Subscribes to the `detection://queue-updated` Tauri event for real-time
 * updates and provides action handlers for all queue operations.
 *
 * Event handler is debounced (300ms) to prevent re-render storms when
 * detection fires rapidly during fast speech.
 */
export function useQueue(): UseQueueReturn {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [live, setLive] = useState<QueueItem | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadQueue = useCallback(async () => {
    try {
      const items = await getQueue();
      setQueue(items.filter((i) => i.status === "pending"));
      setLive(items.find((i) => i.status === "live") ?? null);
    } catch {
      // silently ignore load failures
    }
  }, []);

  useEffect(() => {
    loadQueue();

    let unlisten: (() => void) | undefined;
    listen("detection://queue-updated", () => {
      // Debounce: coalesce rapid-fire events into one reload
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(loadQueue, 300);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [loadQueue]);

  return {
    queue,
    live,
    approve:    useCallback(async (id) => { await approveItem(id);    await loadQueue(); }, [loadQueue]),
    dismiss:    useCallback(async (id) => { await dismissItem(id);    await loadQueue(); }, [loadQueue]),
    skip:       useCallback(async (id) => { await skipItem(id);       await loadQueue(); }, [loadQueue]),
    rejectLive: useCallback(async ()   => { await rejectLiveItem();   await loadQueue(); }, [loadQueue]),
    next:       useCallback(async ()   => { await nextItem();         await loadQueue(); }, [loadQueue]),
    prev:       useCallback(async ()   => { await prevItem();         await loadQueue(); }, [loadQueue]),
    clearLive:  useCallback(async ()   => { await clearLive();        await loadQueue(); }, [loadQueue]),
    clearQueue: useCallback(async ()   => { await clearQueue();       await loadQueue(); }, [loadQueue]),
  };
}
