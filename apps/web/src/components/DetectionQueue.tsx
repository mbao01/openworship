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
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="mb-4 flex shrink-0 items-center gap-2">
        <span className="text-[11px] font-medium tracking-[0.12em] text-ink-3 uppercase">
          QUEUE
        </span>
        {visible.length > 0 && (
          <span
            data-qa="detection-queue-count"
            className="rounded-sm border border-accent/30 bg-accent-soft px-[5px] py-px font-mono text-[10px] tracking-[0.04em] text-accent"
          >
            {visible.length}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto [scrollbar-color:var(--color-line-strong)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-line">
        {visible.length === 0 && (
          <p className="m-0 text-xs text-muted">No detections yet.</p>
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

function DetectionCard({
  item,
  onApprove,
  onDismiss,
  onRejectLive,
}: CardProps) {
  const isSong = item.kind === "song";
  const confidencePct =
    item.confidence != null ? Math.round(item.confidence * 100) : null;

  const borderLeftClass =
    item.status === "live"
      ? "border-l-accent"
      : item.status === "pending"
        ? "border-l-accent/60"
        : "border-l-transparent";

  const opacityClass = item.status === "dismissed" ? "opacity-40" : "";

  return (
    <div
      className={`border border-l-2 border-line/40 bg-bg-2 ${borderLeftClass} rounded-sm p-3 transition-colors ${opacityClass}`}
      role="article"
    >
      {/* Meta row */}
      <div className="mb-1 flex items-center gap-2">
        {isSong && (
          <span
            className="shrink-0 text-[11px] leading-none text-accent"
            title="Song"
          >
            ♪
          </span>
        )}
        <span className="flex-1 text-xs font-medium tracking-[0.04em] text-ink">
          {item.reference}
        </span>
        {!isSong && (
          <span className="font-mono text-[10px] tracking-[0.08em] text-ink-3">
            {item.translation}
          </span>
        )}
        {item.is_semantic && (
          <span
            className="cursor-default text-[11px] text-accent/75"
            title="Semantic match"
          >
            ~
          </span>
        )}
        {item.status === "live" && (
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-accent [box-shadow:0_0_4px_var(--color-accent)]"
            aria-label="Live"
          />
        )}
      </div>

      {/* Verse text */}
      {!isSong && (
        <p className="m-0 mb-2 text-xs leading-[1.5] text-ink-3">{item.text}</p>
      )}

      {/* Confidence bar */}
      {confidencePct != null && (
        <div
          className="relative my-1 h-[3px] overflow-visible rounded-sm bg-line"
          title={`${confidencePct}% confidence`}
        >
          <div
            className="h-full rounded-sm bg-accent transition-[width_0.3s_ease]"
            style={{ width: `${confidencePct}%` }}
          />
          <span className="absolute -top-[14px] right-0 font-mono text-[9px] text-muted">
            {confidencePct}%
          </span>
        </div>
      )}

      {/* Actions */}
      {item.status === "pending" && (
        <div className="mt-2 flex gap-2">
          <button
            data-qa={`approve-btn-${item.id}`}
            className="cursor-pointer rounded-sm border-none bg-accent px-[10px] py-1 font-sans text-[10px] font-medium tracking-[0.08em] text-accent-foreground uppercase transition-all hover:brightness-115"
            onClick={() => onApprove(item.id)}
            aria-label={`Approve ${item.reference}`}
          >
            APPROVE
          </button>
          <button
            data-qa={`dismiss-btn-${item.id}`}
            className="cursor-pointer rounded-sm border border-line bg-transparent px-[10px] py-1 font-sans text-[10px] font-medium tracking-[0.08em] text-ink uppercase transition-colors hover:border-line-strong"
            onClick={() => onDismiss(item.id)}
            aria-label={`Dismiss ${item.reference}`}
          >
            DISMISS
          </button>
        </div>
      )}

      {item.status === "live" && (
        <div className="mt-2 flex gap-2">
          <button
            data-qa="reject-live-btn"
            className="cursor-pointer rounded-sm border border-danger bg-transparent px-[10px] py-1 font-sans text-[10px] font-medium tracking-[0.08em] text-danger uppercase transition-all hover:bg-danger hover:text-accent-foreground"
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
