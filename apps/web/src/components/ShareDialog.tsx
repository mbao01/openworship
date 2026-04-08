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
    <div className="sd-copy-row">
      {link && <span className="sd-link-preview" title={link}>{link.length > 60 ? link.slice(0, 57) + "…" : link}</span>}
      <button className="sd-copy-btn" onClick={handleCopy}>
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
      className="sd-perm-select"
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

  return (
    <div className="sd-overlay" onClick={onClose}>
      <div className="sd-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sd-header">
          <p className="sd-title">Share "{artifact.name}"</p>
          <button className="sd-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Cloud sync toggle */}
        <div className="sd-sync-row">
          <div className="sd-sync-info">
            <span className={`sd-status-dot sd-status-dot--${syncInfo?.status ?? "local_only"}`} />
            <span className="sd-sync-label">
              {syncInfo?.sync_enabled
                ? syncInfo.status === "synced" ? "Synced to cloud" : syncInfo.status === "syncing" ? "Syncing…" : syncInfo.status === "queued" ? "Queued for sync" : syncInfo.status === "error" ? "Sync error" : "Cloud sync on"
                : "Local only"}
            </span>
          </div>
          <button className={`sd-toggle-btn${syncInfo?.sync_enabled ? " sd-toggle-btn--on" : ""}`} onClick={handleSyncToggle}>
            {syncInfo?.sync_enabled ? "Disable sync" : "Enable sync"}
          </button>
        </div>

        {syncInfo?.sync_error && (
          <p className="sd-error-msg">{syncInfo.sync_error}</p>
        )}

        {/* Copy link — only shown when synced */}
        {isSynced && (
          <div className="sd-section">
            <p className="sd-section-label">SHARE LINK</p>
            <CopyLinkButton artifactId={artifact.id} />
          </div>
        )}

        {/* General access */}
        <div className="sd-section">
          <p className="sd-section-label">GENERAL ACCESS</p>
          <div className="sd-access-btns">
            {(["restricted", "branch_only", "all_branches"] as AccessLevel[]).map((level) => (
              <button
                key={level}
                className={`sd-access-btn${accessLevel === level ? " sd-access-btn--active" : ""}`}
                onClick={() => setAccessLevel(level)}
              >
                {level === "restricted" ? "Restricted" : level === "branch_only" ? "Branch only" : "All branches"}
              </button>
            ))}
          </div>
          <p className="sd-access-hint">
            {accessLevel === "restricted" && "Only explicitly listed branches can access."}
            {accessLevel === "branch_only" && "Any branch in your church can view."}
            {accessLevel === "all_branches" && "All branches can access; copy link works for anyone."}
          </p>
        </div>

        {/* Branch ACL list */}
        <div className="sd-section">
          <p className="sd-section-label">BRANCH PERMISSIONS</p>
          {acl.length === 0 ? (
            <p className="sd-empty">No branches added yet.</p>
          ) : (
            <ul className="sd-acl-list">
              {acl.map((e) => (
                <li key={e.branch_id} className="sd-acl-row">
                  <span className="sd-branch-name">{e.branch_name}</span>
                  <PermissionSelect value={e.permission} onChange={(p) => updatePerm(e.branch_id, p)} />
                  <button className="sd-remove-btn" onClick={() => removeBranch(e.branch_id)} aria-label="Remove">✕</button>
                </li>
              ))}
            </ul>
          )}

          {/* Add branch row */}
          <div className="sd-add-row">
            <input
              className="sd-input"
              placeholder="Branch ID"
              value={newBranchId}
              onChange={(e) => setNewBranchId(e.target.value)}
            />
            <input
              className="sd-input"
              placeholder="Branch name"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addBranch(); }}
            />
            <PermissionSelect value={newPerm} onChange={setNewPerm} />
            <button className="sd-add-btn" onClick={addBranch} disabled={!newBranchId.trim() || !newBranchName.trim()}>
              Add
            </button>
          </div>
        </div>

        {/* Storage usage */}
        {usage && (
          <div className="sd-usage-bar">
            <span className="sd-usage-label">
              {formatBytes(usage.used_bytes)} used
              {usage.quota_bytes ? ` / ${formatBytes(usage.quota_bytes)}` : ""}
            </span>
            {usage.quota_bytes && (
              <div className="sd-usage-track">
                <div
                  className="sd-usage-fill"
                  style={{ width: `${Math.min(100, (usage.used_bytes / usage.quota_bytes) * 100)}%` }}
                />
              </div>
            )}
            <span className="sd-usage-count">{usage.synced_count} file{usage.synced_count !== 1 ? "s" : ""} synced</span>
          </div>
        )}

        {error && <p className="sd-error">{error}</p>}

        {/* Footer actions */}
        <div className="sd-footer">
          <button className="sd-btn--secondary" onClick={onClose}>Cancel</button>
          <button className="sd-btn--primary" onClick={handleSave} disabled={saving}>
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
