import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "../lib/tauri";
import type { OperatingMode, QueuedVerse, ScriptureRef } from "../lib/types";

function refDisplay(ref: ScriptureRef): string {
  return ref.verse != null
    ? `${ref.book} ${ref.chapter}:${ref.verse}`
    : `${ref.book} ${ref.chapter}`;
}

interface Props {
  mode: OperatingMode;
}

export function DetectionQueue({ mode }: Props) {
  const [items, setItems] = useState<QueuedVerse[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const q = await invoke<QueuedVerse[]>("get_queue");
      setItems(q);
    } catch {
      // backend not available in browser preview
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    // Poll every second while in copilot/auto mode.
    if (mode === "auto" || mode === "copilot") {
      pollRef.current = setInterval(fetchQueue, 1000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [mode, fetchQueue]);

  async function handleApprove(id: number) {
    try {
      await invoke("approve_verse", { id });
      await fetchQueue();
    } catch {
      // ignore
    }
  }

  async function handleDismiss(id: number) {
    try {
      await invoke("dismiss_verse", { id });
      await fetchQueue();
    } catch {
      // ignore
    }
  }

  async function handleClear() {
    try {
      await invoke("clear_queue");
      setItems([]);
    } catch {
      // ignore
    }
  }

  const pending = items.filter((v) => v.status === "pending");
  const actioned = items.filter((v) => v.status !== "pending");

  return (
    <div className="detection-queue">
      <div className="detection-queue__header">
        <h2 className="operator-col__heading">QUEUE</h2>
        {items.length > 0 && (
          <button className="detection-queue__clear" onClick={handleClear}>
            CLEAR
          </button>
        )}
      </div>

      {mode === "airplane" || mode === "offline" ? (
        <p className="operator-col__empty">
          {mode === "offline" ? "STT inactive." : "Manual mode — detection paused."}
        </p>
      ) : pending.length === 0 && actioned.length === 0 ? (
        <p className="operator-col__empty">No detections yet.</p>
      ) : (
        <ul className="detection-queue__list">
          {pending.map((verse) => (
            <li key={verse.id} className="detection-queue__item detection-queue__item--pending">
              <div className="detection-queue__ref">
                {refDisplay(verse.reference)}
                <span className="detection-queue__translation">{verse.translation}</span>
              </div>
              <p className="detection-queue__text">{verse.text}</p>
              {mode === "copilot" && (
                <div className="detection-queue__actions">
                  <button
                    className="detection-queue__btn detection-queue__btn--approve"
                    onClick={() => handleApprove(verse.id)}
                  >
                    SHOW
                  </button>
                  <button
                    className="detection-queue__btn detection-queue__btn--dismiss"
                    onClick={() => handleDismiss(verse.id)}
                  >
                    DISMISS
                  </button>
                </div>
              )}
            </li>
          ))}
          {actioned.map((verse) => (
            <li
              key={verse.id}
              className={`detection-queue__item detection-queue__item--${verse.status}`}
            >
              <div className="detection-queue__ref">
                {refDisplay(verse.reference)}
                <span className="detection-queue__translation">{verse.translation}</span>
                <span className={`detection-queue__badge detection-queue__badge--${verse.status}`}>
                  {verse.status === "approved" ? "SHOWN" : "DISMISSED"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
