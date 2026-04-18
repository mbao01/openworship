import { useState } from "react";
import { Section, SettingRow } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { getBranchSyncStatus } from "@/lib/commands/share";
import type { BranchSyncStatus, ChurchIdentity } from "@/lib/types";
import { useEffect } from "react";

interface ChurchSectionProps {
  identity: ChurchIdentity;
}

/**
 * General / Church Identity settings section.
 * Shows church and branch info, invite code, and sync status.
 */
export function ChurchSection({ identity }: ChurchSectionProps) {
  const [syncStatus, setSyncStatus] = useState<BranchSyncStatus | null>(null);
  const [copied, setCopied] = useState(false);
  const isHq = identity.role === "hq";

  useEffect(() => {
    getBranchSyncStatus()
      .then(setSyncStatus)
      .catch(() => {});
  }, []);

  const handleCopy = () => {
    if (!identity.invite_code) return;
    navigator.clipboard.writeText(identity.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-0">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3 mb-6 pb-3 border-b border-line">
        General
      </h2>

      <Section title="Church identity">
        <SettingRow label="Church">
          <span className="text-sm text-ink">{identity.church_name}</span>
        </SettingRow>
        <SettingRow label="Branch">
          <span className="text-sm text-ink">{identity.branch_name}</span>
        </SettingRow>
        <SettingRow label="Role">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.05em] text-accent">
            {identity.role}
          </span>
        </SettingRow>
      </Section>

      {isHq && identity.invite_code && (
        <Section
          title="Invite code"
          separator
          description="Share this code with member branches to connect to your HQ."
        >
          <div className="flex items-center gap-2 pb-3">
            <span className="flex-1 font-mono text-sm font-bold text-accent bg-bg-2 border border-line rounded px-3 py-1.5">
              {identity.invite_code}
            </span>
            <Button variant="outline" size="default" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        </Section>
      )}

      {syncStatus && (
        <Section title="Sync status" separator>
          <SettingRow label="Last pushed">
            <span className="font-mono text-[10.5px] text-ink-3">
              {syncStatus.last_pushed_ms
                ? new Date(syncStatus.last_pushed_ms).toLocaleString()
                : "Never"}
            </span>
          </SettingRow>
          <SettingRow label="Last pulled">
            <span className="font-mono text-[10.5px] text-ink-3">
              {syncStatus.last_pulled_ms
                ? new Date(syncStatus.last_pulled_ms).toLocaleString()
                : "Never"}
            </span>
          </SettingRow>
          {syncStatus.error && (
            <p className="text-xs text-danger">{syncStatus.error}</p>
          )}
        </Section>
      )}
    </div>
  );
}
