import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

/**
 * Subscribes to the `audio://level-updated` Tauri event emitted by the Rust
 * audio monitor at ~20 Hz and returns the current RMS level as a normalized
 * float [0\u20131].
 *
 * Replaces the previous 200 ms `setInterval` IPC poll \u2014 the Rust backend now
 * pushes level updates only when the value changes, eliminating 5 IPC
 * round-trips per second while the VU meter is visible.
 *
 * Used by the VU meter in the TopBar and AudioSection.
 */
export function useAudioLevel(): number {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listen<number>("audio://level-updated", (event) => {
      setLevel(event.payload ?? 0);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  return level;
}
