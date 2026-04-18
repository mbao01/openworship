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

/**
 * Manages the external display output window.
 *
 * Provides monitor listing and window open/close controls.
 * Used by DisplaySection in Settings and the stage toolbar.
 */
export function useDisplayWindow(): UseDisplayWindowReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [obsUrl, setObsUrl] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getDisplayWindowOpen(),
      listMonitors(),
      getObsDisplayUrl(),
    ])
      .then(([open, mons, url]) => {
        setIsOpen(open);
        setMonitors(mons.map((m, i) => ({ ...m, id: i })));
        setObsUrl(url);
      })
      .catch((e) => console.error("[use-display-window] load failed:", e));
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
