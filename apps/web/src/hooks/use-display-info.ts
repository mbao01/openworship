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
 * Skips polling when `visible` is false to save resources.
 */
export function useDisplayInfo(visible = true): DisplayInfo {
  const [info, setInfo] = useState<DisplayInfo>({ open: false, monitor: null });

  useEffect(() => {
    if (!visible) return;

    let active = true;

    const refresh = async () => {
      try {
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
        // ignore
      }
    };

    const initial = setTimeout(refresh, 100);
    const id = setInterval(refresh, POLL_MS);
    return () => {
      active = false;
      clearTimeout(initial);
      clearInterval(id);
    };
  }, [visible]);

  return info;
}
