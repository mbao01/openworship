import { useEffect } from "react";
import {
  listen,
  type UnlistenFn,
  type EventCallback,
} from "@tauri-apps/api/event";

/**
 * Subscribes to a Tauri backend event and automatically unsubscribes on unmount.
 * Used as the base hook for all event-driven hooks (queue, transcript, etc.).
 *
 * @param event  Tauri event name, e.g. "detection://queue-updated"
 * @param handler  Callback invoked on each event payload
 */
export function useTauriEvent<T>(
  event: string,
  handler: EventCallback<T>,
): void {
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    listen<T>(event, handler).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [event, handler]);
}
