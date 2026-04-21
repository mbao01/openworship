import type { QueueItem } from "../../../lib/types";

export function QueueItemCard({ item, onApprove, onReject }: {
  item: QueueItem;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isLive = item.status === "live";
  const isNext = item.status === "pending" && !isLive;
  const confidencePct = item.confidence != null ? Math.round(item.confidence * 100) : null;
  const tagLabel = isLive ? `On screen${confidencePct != null ? ` · ${confidencePct}%` : ""}` :
                   isNext ? `Next${confidencePct != null ? ` · ${confidencePct}%` : ""}` :
                   `Detected${confidencePct != null ? ` · ${confidencePct}%` : ""}`;

  return (
    <div className={`relative px-3.5 py-3 border-b border-line cursor-pointer transition-colors hover:bg-bg-2 ${isLive ? "bg-bg-2" : ""}`}>
      {isLive && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-live" />}
      {isNext && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent" />}

      <div className="flex justify-between items-baseline mb-1.5">
        <span className={`font-mono text-[9.5px] tracking-[0.14em] uppercase ${
          isLive ? "text-live" : isNext ? "text-accent" : "text-ink-3"
        }`}>
          {tagLabel}
        </span>
        {confidencePct != null && (
          <span className="font-mono text-[10px] text-ink-2">
            <strong className="text-accent font-semibold">{confidencePct}</strong>%
          </span>
        )}
      </div>

      <div className="font-serif italic text-base text-ink mb-1 tracking-[-0.005em]">
        {item.reference}
      </div>
      <div className="text-[11.5px] text-ink-3 font-serif leading-[1.4] mb-2 line-clamp-2">
        {item.text}
      </div>

      {/* Confidence bar */}
      {confidencePct != null && (
        <div className={`relative h-0.5 bg-line mt-1.5 ${isLive ? "" : ""}`}>
          <div
            className={`absolute inset-0 ${isLive ? "bg-live" : "bg-accent"}`}
            style={{ width: `${confidencePct}%` }}
          />
        </div>
      )}

      {/* Actions */}
      {!isLive && (
        <div className="flex gap-1.5 mt-2">
          <button
            className="px-2.5 py-1 font-mono text-[9px] tracking-[0.1em] uppercase border border-accent text-accent rounded bg-bg-1 transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onApprove(); }}
          >
            Push
          </button>
          <button
            className="px-2.5 py-1 font-mono text-[9px] tracking-[0.1em] uppercase border border-line text-ink-2 rounded bg-bg-1 transition-colors hover:bg-bg-3 hover:text-ink cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onReject(); }}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
