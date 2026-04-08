import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { QueueItem, QueueStatus } from "../lib/types";

export function DetectionQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);

  // Load initial queue and subscribe to updates.
  useEffect(() => {
    invoke<QueueItem[]>("get_queue")
      .then(setItems)
      .catch(console.error);

    let unlisten: UnlistenFn | null = null;
    listen<QueueItem[]>("detection://queue-updated", (event) => {
      setItems(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  function handleApprove(id: string) {
    invoke("approve_item", { id }).catch(console.error);
  }

  function handleDismiss(id: string) {
    invoke("dismiss_item", { id }).catch(console.error);
  }

  // Show pending + live items; hide dismissed.
  const visible = items.filter((i) => i.status !== "dismissed");

  return (
    <div className="detection-queue">
      <div className="detection-queue__header">
        <span className="detection-queue__label">QUEUE</span>
        {visible.length > 0 && (
          <span className="detection-queue__count">{visible.length}</span>
        )}
      </div>

      <div className="detection-queue__body">
        {visible.length === 0 && (
          <p className="detection-queue__empty">No detections yet.</p>
        )}
        {visible.map((item) => (
          <DetectionCard
            key={item.id}
            item={item}
            onApprove={handleApprove}
            onDismiss={handleDismiss}
          />
        ))}
      </div>
    </div>
  );
}

interface CardProps {
  item: QueueItem;
  onApprove: (id: string) => void;
  onDismiss: (id: string) => void;
}

function DetectionCard({ item, onApprove, onDismiss }: CardProps) {
  const statusClass = statusModifier(item.status);

  return (
    <div className={`detection-card detection-card--${statusClass}`} role="article">
      <div className="detection-card__meta">
        <span className="detection-card__reference">{item.reference}</span>
        <span className="detection-card__translation">{item.translation}</span>
        {item.status === "live" && (
          <span className="detection-card__live-dot" aria-label="Live" />
        )}
      </div>
      <p className="detection-card__text">{item.text}</p>

      {item.status === "pending" && (
        <div className="detection-card__actions">
          <button
            className="detection-card__btn detection-card__btn--approve"
            onClick={() => onApprove(item.id)}
            aria-label={`Approve ${item.reference}`}
          >
            APPROVE
          </button>
          <button
            className="detection-card__btn detection-card__btn--dismiss"
            onClick={() => onDismiss(item.id)}
            aria-label={`Dismiss ${item.reference}`}
          >
            DISMISS
          </button>
        </div>
      )}
    </div>
  );
}

function statusModifier(status: QueueStatus): string {
  switch (status) {
    case "pending":  return "pending";
    case "live":     return "live";
    case "dismissed": return "dismissed";
  }
}
