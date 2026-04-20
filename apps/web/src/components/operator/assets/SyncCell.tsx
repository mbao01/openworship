import {
  CheckIcon,
  XIcon,
  AlertTriangleIcon,
} from "lucide-react";
import type { CloudSyncInfo } from "../../../lib/types";
import { iconCls } from "./helpers";

export function SyncCell({ info }: { info: CloudSyncInfo | undefined }) {
  if (!info || !info.sync_enabled) return <span className="text-muted text-[11px]">&mdash;</span>;

  if (info.status === "syncing" && info.progress !== null) {
    const pct = Math.round(info.progress * 100);
    return (
      <div className="flex items-center gap-[6px]">
        <div className="w-[48px] h-[3px] rounded-full bg-line overflow-hidden">
          <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[10px] font-mono text-ink-3">{pct}%</span>
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

  if (info.status === "queued") return <span className="text-muted text-[10px]" title="Queued">&middot;&middot;&middot;</span>;
  if (info.status === "conflict") return <span className="text-[#e89a00]" title="Conflict"><AlertTriangleIcon className={iconCls} /></span>;
  if (info.status === "error") return <span className="text-danger" title={info.sync_error ?? "Error"}><XIcon className={iconCls} /></span>;

  return <span className="text-muted text-[11px]">&mdash;</span>;
}

export function SharedCell({ info }: { info: CloudSyncInfo | undefined }) {
  if (!info || !info.sync_enabled) return <span className="text-muted text-[11px]">&mdash;</span>;

  if (info.cloud_key?.includes("public")) {
    return (
      <span className="inline-flex items-center px-[6px] py-[2px] rounded text-[10px] font-medium bg-accent-soft text-accent border border-accent/25">
        Public
      </span>
    );
  }

  return <span className="text-muted text-[11px]">&mdash;</span>;
}
