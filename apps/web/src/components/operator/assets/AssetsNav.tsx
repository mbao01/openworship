import {
  FolderIcon,
  RefreshCwIcon,
  StarIcon,
  LayoutGridIcon,
  CloudIcon,
  ChevronDownIcon,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@radix-ui/react-collapsible";
import type { ServiceProject, StorageUsage } from "../../../lib/types";
import { formatStorageBytes, iconCls } from "./helpers";
import type { Nav } from "./types";

export function AssetsNav({
  projects,
  nav,
  onNav,
  usage,
  cloudExpanded,
  onToggleCloud,
}: {
  projects: ServiceProject[];
  nav: Nav;
  onNav: (n: Nav) => void;
  usage: StorageUsage | null;
  cloudExpanded: boolean;
  onToggleCloud: () => void;
}) {
  const isActive = (n: Nav) => JSON.stringify(n) === JSON.stringify(nav);

  const storageLabel = usage
    ? `${formatStorageBytes(usage.used_bytes)}${usage.quota_bytes ? ` / ${formatStorageBytes(usage.quota_bytes)}` : " used"}`
    : "";
  const storagePct = usage?.quota_bytes
    ? Math.min(100, (usage.used_bytes / usage.quota_bytes) * 100)
    : 0;

  const navBtnCls = (active: boolean) =>
    `w-full flex items-center gap-2 px-3 py-1.5 text-[12px] rounded transition-colors cursor-pointer ${
      active
        ? "bg-accent-soft text-ink font-medium"
        : "text-ink-3 hover:text-ink hover:bg-bg-2"
    }`;

  return (
    <div className="w-[200px] shrink-0 bg-bg-1 border-r border-line flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {/* Local */}
        <div className="mb-3">
          <span className="block px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-3">Local</span>
          <button className={navBtnCls(isActive({ kind: "all" }))} onClick={() => onNav({ kind: "all" })}>
            <LayoutGridIcon className={iconCls} /> All Assets
          </button>
          <button className={navBtnCls(isActive({ kind: "recent" }))} onClick={() => onNav({ kind: "recent" })}>
            <RefreshCwIcon className={iconCls} /> Recent
          </button>
          <button className={navBtnCls(isActive({ kind: "starred" }))} onClick={() => onNav({ kind: "starred" })}>
            <StarIcon className={iconCls} /> Starred
          </button>
        </div>

        {/* Services */}
        {projects.length > 0 && (
          <div className="mb-3">
            <div className="h-px bg-line mx-2 mb-2" />
            <span className="block px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-3">Services</span>
            {projects.map((p) => (
              <button
                key={p.id}
                className={navBtnCls(isActive({ kind: "service", id: p.id, name: p.name }))}
                onClick={() => onNav({ kind: "service", id: p.id, name: p.name })}
              >
                <FolderIcon className={iconCls} />
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Cloud */}
        <div>
          <div className="h-px bg-line mx-2 mb-2" />
          <span className="block px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-3">Cloud</span>
          <Collapsible open={cloudExpanded} onOpenChange={onToggleCloud}>
            <CollapsibleTrigger asChild>
              <button
                className={navBtnCls(isActive({ kind: "cloud_branch" }))}
                onClick={() => onNav({ kind: "cloud_branch" })}
              >
                <CloudIcon className={iconCls} />
                <span className="flex-1 text-left">My Branch</span>
                <ChevronDownIcon className={`w-3 h-3 shrink-0 transition-transform ${cloudExpanded ? "" : "-rotate-90"}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pl-7 flex flex-col gap-0.5">
                {["Downtown", "Westside", "Youth Campus"].map((branch) => (
                  <span key={branch} className="flex items-center gap-2 px-2 py-1 text-[11px] text-ink-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                    {branch}
                  </span>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
          <button
            className={navBtnCls(isActive({ kind: "cloud_shared" }))}
            onClick={() => onNav({ kind: "cloud_shared" })}
          >
            <CloudIcon className={iconCls} />
            Church Shared
          </button>
        </div>
      </div>

      {/* Storage footer */}
      {storageLabel && (
        <div className="px-3 py-2 border-t border-line">
          <div className="h-[3px] bg-line rounded-full overflow-hidden mb-1.5">
            <div className="h-full bg-accent transition-[width] duration-300 rounded-full" style={{ width: `${storagePct}%` }} />
          </div>
          <span className="text-[10px] text-muted font-mono">{storageLabel}</span>
        </div>
      )}
    </div>
  );
}
