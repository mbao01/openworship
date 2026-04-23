import { CheckIcon, XIcon, AlertTriangleIcon } from "lucide-react";
import type { CloudSyncInfo } from "../../../lib/types";
import { iconCls } from "./helpers";

export function SyncCell({ info }: { info: CloudSyncInfo | undefined }) {
  if (!info || !info.sync_enabled)
    return <span className="text-[11px] text-muted">&mdash;</span>;

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
        <CheckIcon className={iconCls} />
      </span>
    );
  }

  if (info.status === "queued")
    return (
      <span className="text-[10px] text-muted" title="Queued">
        &middot;&middot;&middot;
      </span>
    );
  if (info.status === "conflict")
    return (
      <span className="text-[#e89a00]" title="Conflict">
        <AlertTriangleIcon className={iconCls} />
      </span>
    );
  if (info.status === "error")
    return (
      <span className="text-danger" title={info.sync_error ?? "Error"}>
        <XIcon className={iconCls} />
      </span>
    );

  return <span className="text-[11px] text-muted">&mdash;</span>;
}

export function SharedCell({ info }: { info: CloudSyncInfo | undefined }) {
  if (!info || !info.sync_enabled)
    return <span className="text-[11px] text-muted">&mdash;</span>;

  if (info.cloud_key?.includes("public")) {
    return (
      <span className="inline-flex items-center rounded border border-accent/25 bg-accent-soft px-[6px] py-[2px] text-[10px] font-medium text-accent">
        Public
      </span>
    );
  }

  return <span className="text-[11px] text-muted">&mdash;</span>;
}
