import { useCallback, useEffect, useRef, useState } from "react";
import {
  listMonitors,
  openDisplayWindow,
  closeDisplayWindow,
  getDisplayWindowOpen,
  getObsDisplayUrl,
} from "@/lib/commands/display-window";
import type { MonitorInfo } from "@/lib/types";

/** MonitorInfo extended with a local index used as stable UI key. */
export interface Monitor extends MonitorInfo {
  id: number;
}

export interface UseDisplayWindowReturn {
  isOpen: boolean;
  monitors: Monitor[];
  obsUrl: string | null;
  openOn: (monitorId?: number) => Promise<void>;
  close: () => Promise<void>;
}

/** Poll interval for detecting display hot-plug changes (ms). */
const MONITOR_POLL_MS = 3000;

/**
 * Manages the external display output window.
 *
 * Polls for monitor changes every 3 seconds. When monitors change:
 * - **Added**: auto-opens/moves display to the new external monitor
 * - **Removed**: if display was on the removed monitor, falls back to primary
 */
export function useDisplayWindow(): UseDisplayWindowReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [obsUrl, setObsUrl] = useState<string | null>(null);
  const prevCountRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      try {
        const [open, mons, url] = await Promise.all([
          getDisplayWindowOpen(),
          listMonitors(),
          getObsDisplayUrl(),
        ]);
        if (!active) return;

        const mapped = mons.map((m, i) => ({ ...m, id: i }));
        const prevCount = prevCountRef.current;
        const newCount = mons.length;

        setIsOpen(open);
        setMonitors(mapped);
        setObsUrl(url);

        // Skip auto-actions on first load (prevCount is null)
        if (prevCount === null) {
          prevCountRef.current = newCount;
          return;
        }

        if (newCount > prevCount) {
          // Monitor added — find the new external (non-primary) monitor and open on it
          const externalIdx = mapped.findIndex((m) => !m.is_primary);
          if (externalIdx >= 0) {
            await openDisplayWindow(externalIdx);
            setIsOpen(true);
          }
        } else if (newCount < prevCount && open) {
          // Monitor removed while display was open — fall back to primary
          const primaryIdx = mapped.findIndex((m) => m.is_primary);
          await openDisplayWindow(primaryIdx >= 0 ? primaryIdx : null);
        }

        prevCountRef.current = newCount;
      } catch (e) {
        console.error("[use-display-window] refresh failed:", e);
      }
    };

    refresh();
    const interval = setInterval(refresh, MONITOR_POLL_MS);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const openOn = useCallback(async (monitorId?: number) => {
    await openDisplayWindow(monitorId ?? null);
    setIsOpen(true);
  }, []);

  const close = useCallback(async () => {
    await closeDisplayWindow();
    setIsOpen(false);
  }, []);

  return { isOpen, monitors, obsUrl, openOn, close };
}
