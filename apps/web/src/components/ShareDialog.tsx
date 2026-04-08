import { useEffect, useState } from "react";
import { invoke } from "../lib/tauri";
import type { AccessLevel, AclEntry, ArtifactEntry, BranchPermission, CloudSyncInfo, StorageUsage } from "../lib/types";

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyLinkButton({ artifactId }: { artifactId: string }) {
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  const handleCopy = async () => {
    try {
      const url = await invoke<string | null>("copy_artifact_link", { artifactId });
      if (!url) { alert("Artifact is not synced to cloud yet."); return; }
      setLink(url);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      alert(String(e));
    }
  };

  return (
    <div className="flex items-center gap-[10px]">
      {link && (
        <span className="flex-1 text-[11px] font-mono text-ash overflow-hidden text-ellipsis whitespace-nowrap" title={link}>
          {link.length > 60 ? link.slice(0, 57) + "…" : link}
        </span>
      )}
      <button
        className="bg-transparent border border-gold text-gold font-sans text-[11px] px-3 py-[5px] rounded cursor-pointer whitespace-nowrap transition-colors hover:bg-gold/[0.1]"
        onClick={handleCopy}
      >
        {copied ? "✓ Copied" : "Copy link"}
      </button>
    </div>
  );
}

// ─── Permission selector ──────────────────────────────────────────────────────

function PermissionSelect({
  value, onChange,
}: { value: BranchPermission; onChange: (p: BranchPermission) => void }) {
  return (
    <select
      className="bg-obsidian border border-iron text-chalk font-sans text-[11px] px-[6px] py-[3px] rounded-[3px] cursor-pointer"
      value={value}
      onChange={(e) => onChange(e.target.value as BranchPermission)}
    >
      <option value="view">Can view</option>
      <option value="comment">Can comment</option>
      <option value="edit">Can edit</option>
    </select>
  );
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

interface ShareDialogProps {
  artifact: ArtifactEntry;
  syncInfo: CloudSyncInfo | null;
  onClose: () => void;
  onSyncToggled: () => void;
}

export function ShareDialog({ artifact, syncInfo, onClose, onSyncToggled }: ShareDialogProps) {
  const [acl, setAcl] = useState<AclEntry[]>([]);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("restricted");
  const [newBranchId, setNewBranchId] = useState("");
  const [newBranchName, setNewBranchName] = useState("");
  const [newPerm, setNewPerm] = useState<BranchPermission>("view");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<StorageUsage | null>(null);

  useEffect(() => {
    invoke<[AclEntry[], AccessLevel]>("get_artifact_acl", { artifactId: artifact.id })
      .then(([entries, level]) => { setAcl(entries); setAccessLevel(level); })
      .catch(() => {});
    invoke<StorageUsage>("get_storage_usage").then(setUsage).catch(() => {});
  }, [artifact.id]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await invoke("set_artifact_acl", { artifactId: artifact.id, acl, accessLevel });
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const addBranch = () => {
    const id = newBranchId.trim();
    const name = newBranchName.trim();
    if (!id || !name) return;
    if (acl.some((e) => e.branch_id === id)) return;
    setAcl((prev) => [...prev, { branch_id: id, branch_name: name, permission: newPerm }]);
    setNewBranchId(""); setNewBranchName("");
  };

  const removeBranch = (branchId: string) =>
    setAcl((prev) => prev.filter((e) => e.branch_id !== branchId));

  const updatePerm = (branchId: string, perm: BranchPermission) =>
    setAcl((prev) => prev.map((e) => e.branch_id === branchId ? { ...e, permission: perm } : e));

  const handleSyncToggle = async () => {
    const enable = !syncInfo?.sync_enabled;
    try {
      await invoke("toggle_artifact_cloud_sync", { artifactId: artifact.id, enabled: enable });
      onSyncToggled();
    } catch (e) { setError(String(e)); }
  };

  const isSynced = syncInfo?.status === "synced" || syncInfo?.status === "syncing";

  const statusDotCls = (status: string) => {
    const color =
      status === "synced" ? "bg-gold shadow-[0_0_4px_var(--color-gold)]" :
      status === "syncing" ? "bg-chalk animate-spin" :
      status === "queued" ? "bg-ash" :
      status === "conflict" ? "bg-[#e89a00]" :
      status === "error" ? "bg-ember" :
      "bg-smoke";
    return `w-2 h-2 rounded-full shrink-0 ${color}`;
  };

  const inputCls = "bg-obsidian border border-iron rounded-[3px] text-chalk font-sans text-xs px-2 py-[5px] flex-1 min-w-[80px] outline-none transition-colors focus:border-gold";

  return (
    <div
      data-qa="share-dialog-overlay"
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000]"
      onClick={onClose}
    >
      <div
        data-qa="share-dialog"
        className="bg-slate border border-iron rounded-[6px] w-[520px] max-h-[80vh] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-iron">
          <p className="text-[13px] font-semibold text-chalk m-0 overflow-hidden text-ellipsis whitespace-nowrap">Share "{artifact.name}"</p>
          <button
            className="bg-transparent border-none text-ash cursor-pointer text-sm px-[6px] py-[2px] rounded-[3px] transition-colors hover:text-chalk"
            onClick={onClose}
            aria-label="Close"
          >✕</button>
        </div>

        {/* Cloud sync toggle */}
        <div className="flex items-center justify-between px-5 py-3 bg-obsidian">
          <div className="flex items-center gap-2">
            <span className={statusDotCls(syncInfo?.status ?? "local_only")} />
            <span className="text-xs text-chalk">
              {syncInfo?.sync_enabled
                ? syncInfo.status === "synced" ? "Synced to cloud" : syncInfo.status === "syncing" ? "Syncing…" : syncInfo.status === "queued" ? "Queued for sync" : syncInfo.status === "error" ? "Sync error" : "Cloud sync on"
                : "Local only"}
            </span>
          </div>
          <button
            data-qa="share-sync-toggle-btn"
            className={[
              "bg-transparent border font-sans text-[11px] px-3 py-[5px] rounded cursor-pointer transition-colors",
              syncInfo?.sync_enabled
                ? "text-gold border-gold"
                : "text-ash border-iron hover:text-chalk hover:border-ash",
            ].join(" ")}
            onClick={handleSyncToggle}
          >
            {syncInfo?.sync_enabled ? "Disable sync" : "Enable sync"}
          </button>
        </div>

        {syncInfo?.sync_error && (
          <p className="text-[11px] text-ember px-5 pt-1 m-0">{syncInfo.sync_error}</p>
        )}

        {/* Copy link — only shown when synced */}
        {isSynced && (
          <div className="px-5 py-[14px] border-b border-iron/60 flex flex-col gap-[10px]">
            <p className="text-[10px] font-semibold tracking-[0.08em] text-ash uppercase m-0">SHARE LINK</p>
            <CopyLinkButton artifactId={artifact.id} />
          </div>
        )}

        {/* General access */}
        <div className="px-5 py-[14px] border-b border-iron/60 flex flex-col gap-[10px]">
          <p className="text-[10px] font-semibold tracking-[0.08em] text-ash uppercase m-0">GENERAL ACCESS</p>
          <div className="flex gap-[6px]">
            {(["restricted", "branch_only", "all_branches"] as AccessLevel[]).map((level) => (
              <button
                key={level}
                data-qa={`share-access-${level}`}
                className={[
                  "flex-1 font-sans text-[11px] px-2 py-[6px] rounded cursor-pointer transition-colors",
                  accessLevel === level
                    ? "bg-gold/[0.06] border border-gold text-gold"
                    : "bg-obsidian border border-iron text-ash hover:text-chalk",
                ].join(" ")}
                onClick={() => setAccessLevel(level)}
              >
                {level === "restricted" ? "Restricted" : level === "branch_only" ? "Branch only" : "All branches"}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-smoke m-0">
            {accessLevel === "restricted" && "Only explicitly listed branches can access."}
            {accessLevel === "branch_only" && "Any branch in your church can view."}
            {accessLevel === "all_branches" && "All branches can access; copy link works for anyone."}
          </p>
        </div>

        {/* Branch ACL list */}
        <div className="px-5 py-[14px] border-b border-iron/60 flex flex-col gap-[10px]">
          <p className="text-[10px] font-semibold tracking-[0.08em] text-ash uppercase m-0">BRANCH PERMISSIONS</p>
          {acl.length === 0 ? (
            <p className="text-xs text-smoke m-0">No branches added yet.</p>
          ) : (
            <ul className="list-none m-0 p-0 flex flex-col gap-1">
              {acl.map((e) => (
                <li key={e.branch_id} className="flex items-center gap-2 py-[6px] border-b border-iron/40">
                  <span className="flex-1 text-xs text-chalk overflow-hidden text-ellipsis whitespace-nowrap">{e.branch_name}</span>
                  <PermissionSelect value={e.permission} onChange={(p) => updatePerm(e.branch_id, p)} />
                  <button
                    className="bg-transparent border-none text-smoke cursor-pointer text-[11px] px-[6px] py-[2px] rounded-[3px] transition-colors hover:text-ember"
                    onClick={() => removeBranch(e.branch_id)}
                    aria-label="Remove"
                  >✕</button>
                </li>
              ))}
            </ul>
          )}

          {/* Add branch row */}
          <div className="flex gap-[6px] flex-wrap">
            <input
              className={inputCls}
              placeholder="Branch ID"
              value={newBranchId}
              onChange={(e) => setNewBranchId(e.target.value)}
            />
            <input
              className={inputCls}
              placeholder="Branch name"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addBranch(); }}
            />
            <PermissionSelect value={newPerm} onChange={setNewPerm} />
            <button
              className="bg-transparent border border-iron text-chalk font-sans text-[11px] px-[10px] py-[5px] rounded cursor-pointer transition-colors hover:border-ash disabled:opacity-35 disabled:cursor-default"
              onClick={addBranch}
              disabled={!newBranchId.trim() || !newBranchName.trim()}
            >
              Add
            </button>
          </div>
        </div>

        {/* Storage usage */}
        {usage && (
          <div className="flex items-center gap-[10px] px-5 py-[10px] border-b border-iron/60">
            <span className="text-[11px] text-ash font-mono shrink-0">
              {formatBytes(usage.used_bytes)} used
              {usage.quota_bytes ? ` / ${formatBytes(usage.quota_bytes)}` : ""}
            </span>
            {usage.quota_bytes && (
              <div className="flex-1 h-[2px] bg-iron rounded-[1px] overflow-hidden">
                <div
                  className="h-full bg-gold transition-[width] duration-300 min-w-[2px]"
                  style={{ width: `${Math.min(100, (usage.used_bytes / usage.quota_bytes) * 100)}%` }}
                />
              </div>
            )}
            <span className="text-[11px] text-smoke shrink-0">{usage.synced_count} file{usage.synced_count !== 1 ? "s" : ""} synced</span>
          </div>
        )}

        {error && <p className="text-[11px] text-ember px-5 pt-1 m-0">{error}</p>}

        {/* Footer actions */}
        <div className="flex justify-end gap-2 px-5 py-[14px]">
          <button
            className="bg-transparent border border-iron text-ash rounded font-sans text-xs px-[14px] py-[6px] cursor-pointer transition-colors hover:text-chalk hover:border-ash"
            onClick={onClose}
          >Cancel</button>
          <button
            data-qa="share-save-btn"
            className="bg-gold text-[#0a0a0a] border-none rounded font-sans text-xs font-semibold px-4 py-[6px] cursor-pointer transition-[filter] hover:brightness-[1.12] disabled:opacity-40 disabled:cursor-default"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}
