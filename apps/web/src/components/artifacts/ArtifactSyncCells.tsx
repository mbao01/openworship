import type { CloudSyncInfo } from "../../lib/types";
import { formatDate } from "../../lib/artifact-utils";

export function SyncCell({ info }: { info: CloudSyncInfo | undefined }) {
  if (!info || !info.sync_enabled)
    return <span className="text-[11px] text-muted">—</span>;

  if (info.status === "syncing" && info.progress !== null) {
    const pct = Math.round(info.progress * 100);
    return (
      <div className="flex items-center gap-[6px]">
        <div className="h-[3px] w-[48px] overflow-hidden rounded-full bg-line">
          <div
            className="h-full bg-accent transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-mono text-[10px] text-ink-3">{pct}%</span>
      </div>
    );
  }

  if (info.status === "synced") {
    return (
      <span className="text-accent" title="Synced to cloud">
        <svg
          width="13"
          height="13"
          viewBox="0 0 13 13"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M2 7l3 3 6-6"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  if (info.status === "queued")
    return (
      <span className="text-[10px] text-muted" title="Queued">
        ···
      </span>
    );
  if (info.status === "conflict")
    return (
      <span className="text-[10px] text-[#e89a00]" title="Conflict">
        ⚠
      </span>
    );
  if (info.status === "error")
    return (
      <span
        className="text-[10px] text-danger"
        title={info.sync_error ?? "Error"}
      >
        ✕
      </span>
    );

  return <span className="text-[11px] text-muted">—</span>;
}

export function SharedCell({ info }: { info: CloudSyncInfo | undefined }) {
  if (!info || !info.sync_enabled)
    return <span className="text-[11px] text-muted">—</span>;

  if (info.cloud_key?.includes("public")) {
    return (
      <span className="inline-flex items-center rounded-[3px] border border-accent/25 bg-accent-soft px-[6px] py-[2px] text-[10px] font-medium text-accent">
        Public
      </span>
    );
  }

  return <span className="text-[11px] text-muted">—</span>;
}

export function CloudEntriesList({
  entries,
}: {
  entries: CloudSyncInfo[];
}) {
  if (entries.length === 0) {
    return (
      <p className="py-12 text-center text-xs text-muted">
        No synced files in this section.
      </p>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto py-2">
      {entries.map((info) => (
        <div
          key={info.artifact_id}
          className="flex items-center gap-[10px] border-b border-line/50 px-5 py-[8px] text-[12px] transition-colors hover:bg-white/[0.02]"
        >
          <SyncCell info={info} />
          <span
            className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-ink"
            title={info.cloud_key ?? ""}
          >
            {info.cloud_key?.split("/").pop() ?? info.artifact_id}
          </span>
          <span className="shrink-0 font-mono text-[11px] text-ink-3">
            {info.last_synced_ms
              ? `Synced ${formatDate(info.last_synced_ms)}`
              : "Not yet synced"}
          </span>
          {info.sync_error && (
            <span
              className="shrink-0 text-[11px] text-danger"
              title={info.sync_error}
            >
              ⚠ {info.sync_error.slice(0, 40)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
