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
    let active = true;

    const refresh = async () => {
      try {
        // Check open state first (fast) — only fetch monitors if open
        const open = await getDisplayWindowOpen();
        if (!active) return;
        if (!open) {
          setInfo({ open: false, monitor: null });
          return;
        }
        const monitors = await listMonitors();
        if (!active) return;
        const monitor =
          monitors.find((m) => !m.is_primary) ?? monitors[0] ?? null;
        setInfo({ open: true, monitor });
      } catch {
        // ignore — display commands may not be available in test/web mode
      }
    };

    // Delay initial load so it doesn't block screen mount
    const initial = setTimeout(refresh, 100);
    const id = setInterval(refresh, POLL_MS);
    return () => {
      active = false;
      clearTimeout(initial);
      clearInterval(id);
    };
  }, []);

  return info;
}
