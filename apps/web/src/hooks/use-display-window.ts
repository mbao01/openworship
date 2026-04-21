import { useCallback, useEffect, useState } from "react";
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
 * Provides monitor listing and window open/close controls.
 * Polls for monitor changes every 3 seconds to detect hot-plug.
 */
export function useDisplayWindow(): UseDisplayWindowReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [obsUrl, setObsUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const refresh = () => {
      Promise.all([
        getDisplayWindowOpen(),
        listMonitors(),
        getObsDisplayUrl(),
      ])
        .then(([open, mons, url]) => {
          if (!active) return;
          setIsOpen(open);
          setMonitors(mons.map((m, i) => ({ ...m, id: i })));
          setObsUrl(url);
        })
        .catch((e) => console.error("[use-display-window] refresh failed:", e));
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
