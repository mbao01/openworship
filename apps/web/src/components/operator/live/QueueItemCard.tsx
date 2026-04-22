import type { QueueItem } from "../../../lib/types";

export function QueueItemCard({
  item,
  onApprove,
  onReject,
}: {
  item: QueueItem;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isLive = item.status === "live";
  const isNext = item.status === "pending" && !isLive;
  const confidencePct =
    item.confidence != null ? Math.round(item.confidence * 100) : null;
  const tagLabel = isLive
    ? `On screen${confidencePct != null ? ` · ${confidencePct}%` : ""}`
    : isNext
      ? `Next${confidencePct != null ? ` · ${confidencePct}%` : ""}`
      : `Detected${confidencePct != null ? ` · ${confidencePct}%` : ""}`;

  return (
    <div
      className={`relative cursor-pointer border-b border-line px-3.5 py-3 transition-colors hover:bg-bg-2 ${isLive ? "bg-bg-2" : ""}`}
    >
      {isLive && (
        <span className="absolute top-0 bottom-0 left-0 w-0.5 bg-live" />
      )}
      {isNext && (
        <span className="absolute top-0 bottom-0 left-0 w-0.5 bg-accent" />
      )}

      <div className="mb-1.5 flex items-baseline justify-between">
        <span
          className={`font-mono text-[9.5px] tracking-[0.14em] uppercase ${
            isLive ? "text-live" : isNext ? "text-accent" : "text-ink-3"
          }`}
        >
          {tagLabel}
        </span>
        {confidencePct != null && (
          <span className="font-mono text-[10px] text-ink-2">
            <strong className="font-semibold text-accent">
              {confidencePct}
            </strong>
            %
          </span>
        )}
      </div>

      <div className="mb-1 font-serif text-base tracking-[-0.005em] text-ink italic">
        {item.reference}
      </div>
      <div className="mb-2 line-clamp-2 font-serif text-[11.5px] leading-[1.4] text-ink-3">
        {item.text}
      </div>

      {/* Confidence bar */}
      {confidencePct != null && (
        <div className={`relative mt-1.5 h-0.5 bg-line ${isLive ? "" : ""}`}>
          <div
            className={`absolute inset-0 ${isLive ? "bg-live" : "bg-accent"}`}
            style={{ width: `${confidencePct}%` }}
          />
        </div>
      )}

      {/* Actions */}
      {!isLive && (
        <div className="mt-2 flex gap-1.5">
          <button
            className="cursor-pointer rounded border border-accent bg-bg-1 px-2.5 py-1 font-mono text-[9px] tracking-[0.1em] text-accent uppercase transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onApprove();
            }}
          >
            Push
          </button>
          <button
            className="cursor-pointer rounded border border-line bg-bg-1 px-2.5 py-1 font-mono text-[9px] tracking-[0.1em] text-ink-2 uppercase transition-colors hover:bg-bg-3 hover:text-ink"
            onClick={(e) => {
              e.stopPropagation();
              onReject();
            }}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
