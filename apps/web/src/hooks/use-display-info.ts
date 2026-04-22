import { useEffect, useState } from "react";
import {
  listMonitors,
  getDisplayWindowOpen,
} from "@/lib/commands/display-window";
import type { MonitorInfo } from "@/lib/types";

export interface DisplayInfo {
  /** Whether the display output window is currently open. */
  open: boolean;
  /** The active monitor info when the display is open, null otherwise. */
  monitor: MonitorInfo | null;
}

const POLL_MS = 5000;

/**
 * Polls the display window state and active monitor info.
 * Returns the current display output status for use in panel headers.
 */
export function useDisplayInfo(): DisplayInfo {
  const [info, setInfo] = useState<DisplayInfo>({ open: false, monitor: null });

  useEffect(() => {
    const refresh = async () => {
      try {
        const [open, monitors] = await Promise.all([
          getDisplayWindowOpen(),
          listMonitors(),
        ]);
        const active =
          monitors.find((m) => !m.is_primary) ?? monitors[0] ?? null;
        setInfo({ open, monitor: open ? active : null });
      } catch {
        // ignore — display commands may not be available in test/web mode
      }
    };
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, []);

  return info;
}
