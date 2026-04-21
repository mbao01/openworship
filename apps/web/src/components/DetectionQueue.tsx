import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { QueueItem } from "../lib/types";
import { toastError } from "../lib/toast";

export function DetectionQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);

  // Load initial queue and subscribe to updates.
  useEffect(() => {
    invoke<QueueItem[]>("get_queue")
      .then(setItems)
      .catch(toastError("Failed to load queue"));

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
    invoke("approve_item", { id }).catch(toastError("Failed to approve item"));
  }

  function handleDismiss(id: string) {
    invoke("dismiss_item", { id }).catch(toastError("Failed to dismiss item"));
  }

  function handleRejectLive() {
    invoke("reject_live_item").catch(toastError("Failed to dismiss live item"));
  }

  // Show pending + live items; hide dismissed.
  const visible = items.filter((i) => i.status !== "dismissed");

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 shrink-0">
        <span className="text-[11px] font-medium tracking-[0.12em] text-ink-3 uppercase">QUEUE</span>
        {visible.length > 0 && (
          <span
            data-qa="detection-queue-count"
            className="font-mono text-[10px] text-accent bg-accent-soft border border-accent/30 rounded-sm px-[5px] py-px tracking-[0.04em]"
          >
            {visible.length}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 min-h-0 [scrollbar-width:thin] [scrollbar-color:var(--color-line-strong)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-line [&::-webkit-scrollbar-thumb]:rounded-sm">
        {visible.length === 0 && (
          <p className="text-xs text-muted m-0">No detections yet.</p>
        )}
        {visible.map((item) => (
          <DetectionCard
            key={item.id}
            item={item}
            onApprove={handleApprove}
            onDismiss={handleDismiss}
            onRejectLive={handleRejectLive}
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
  onRejectLive: () => void;
}

function DetectionCard({ item, onApprove, onDismiss, onRejectLive }: CardProps) {
  const isSong = item.kind === "song";
  const confidencePct = item.confidence != null ? Math.round(item.confidence * 100) : null;

  const borderLeftClass =
    item.status === "live"
      ? "border-l-accent"
      : item.status === "pending"
      ? "border-l-accent/60"
      : "border-l-transparent";

  const opacityClass = item.status === "dismissed" ? "opacity-40" : "";

  return (
    <div
      className={`bg-bg-2 border border-line/40 border-l-2 ${borderLeftClass} rounded-sm p-3 transition-colors ${opacityClass}`}
      role="article"
    >
      {/* Meta row */}
      <div className="flex items-center gap-2 mb-1">
        {isSong && (
          <span className="text-[11px] text-accent leading-none shrink-0" title="Song">♪</span>
        )}
        <span className="text-xs font-medium text-ink tracking-[0.04em] flex-1">{item.reference}</span>
        {!isSong && (
          <span className="font-mono text-[10px] text-ink-3 tracking-[0.08em]">{item.translation}</span>
        )}
        {item.is_semantic && (
          <span className="text-[11px] text-accent/75 cursor-default" title="Semantic match">~</span>
        )}
        {item.status === "live" && (
          <span
            className="w-2 h-2 rounded-full bg-accent [box-shadow:0_0_4px_var(--color-accent)] shrink-0"
            aria-label="Live"
          />
        )}
      </div>

      {/* Verse text */}
      {!isSong && (
        <p className="text-xs leading-[1.5] text-ink-3 m-0 mb-2">{item.text}</p>
      )}

      {/* Confidence bar */}
      {confidencePct != null && (
        <div
          className="relative h-[3px] bg-line rounded-sm my-1 overflow-visible"
          title={`${confidencePct}% confidence`}
        >
          <div
            className="h-full bg-accent rounded-sm transition-[width_0.3s_ease]"
            style={{ width: `${confidencePct}%` }}
          />
          <span className="absolute right-0 -top-[14px] text-[9px] text-muted font-mono">
            {confidencePct}%
          </span>
        </div>
      )}

      {/* Actions */}
      {item.status === "pending" && (
        <div className="flex gap-2 mt-2">
          <button
            data-qa={`approve-btn-${item.id}`}
            className="font-sans text-[10px] font-medium tracking-[0.08em] text-accent-foreground bg-accent border-none rounded-sm px-[10px] py-1 cursor-pointer transition-all uppercase hover:brightness-115"
            onClick={() => onApprove(item.id)}
            aria-label={`Approve ${item.reference}`}
          >
            APPROVE
          </button>
          <button
            data-qa={`dismiss-btn-${item.id}`}
            className="font-sans text-[10px] font-medium tracking-[0.08em] text-ink bg-transparent border border-line rounded-sm px-[10px] py-1 cursor-pointer transition-colors uppercase hover:border-line-strong"
            onClick={() => onDismiss(item.id)}
            aria-label={`Dismiss ${item.reference}`}
          >
            DISMISS
          </button>
        </div>
      )}

      {item.status === "live" && (
        <div className="flex gap-2 mt-2">
          <button
            data-qa="reject-live-btn"
            className="font-sans text-[10px] font-medium tracking-[0.08em] text-danger bg-transparent border border-danger rounded-sm px-[10px] py-1 cursor-pointer transition-all uppercase hover:bg-danger hover:text-accent-foreground"
            onClick={onRejectLive}
            aria-label="Not this one — skip to next"
            title="Wrong verse? Dismiss and show the next pending item."
          >
            NOT THIS ONE
          </button>
        </div>
      )}
    </div>
  );
}

