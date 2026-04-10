import { useEffect, useState } from "react";
import { invoke } from "../lib/tauri";
import type {
  AccessLevel,
  AclEntry,
  ArtifactEntry,
  BranchPermission,
  ChurchIdentity,
  CloudSyncInfo,
} from "../lib/types";

// ─── Permission dropdown ──────────────────────────────────────────────────────

function PermSelect({
  value,
  onChange,
  disabled,
}: {
  value: BranchPermission;
  onChange?: (p: BranchPermission) => void;
  disabled?: boolean;
}) {
  return (
    <select
      className="appearance-none bg-obsidian border border-iron text-chalk font-sans text-[11px] px-[8px] py-[4px] pr-[22px] rounded-[3px] cursor-pointer outline-none focus:border-gold transition-colors disabled:opacity-50 disabled:cursor-default"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%234a4a4a' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 7px center",
      }}
      value={value}
      onChange={(e) => onChange?.(e.target.value as BranchPermission)}
      disabled={disabled}
    >
      <option value="view">Can view</option>
      <option value="comment">Can comment</option>
      <option value="edit">Can edit</option>
    </select>
  );
}

// ─── File icon ────────────────────────────────────────────────────────────────

function FileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M5 2.5h7l4 4v11H5v-15Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M12 2.5V6.5H16"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Branch avatar ────────────────────────────────────────────────────────────

function BranchAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Simple deterministic color from name
  const hues = [220, 140, 30, 280, 0, 180];
  const hue = hues[name.charCodeAt(0) % hues.length];

  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-chalk shrink-0"
      style={{ background: `hsl(${hue}, 30%, 28%)`, border: `1px solid hsl(${hue}, 30%, 35%)` }}
    >
      {initials}
    </div>
  );
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

interface ShareDialogProps {
  artifact: ArtifactEntry;
  syncInfo: CloudSyncInfo | null;
  onClose: () => void;
  onSyncToggled: () => void;
}

export function ShareDialog({
  artifact,
  syncInfo,
  onClose,
  onSyncToggled,
}: ShareDialogProps) {
  const [acl, setAcl] = useState<AclEntry[]>([]);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("restricted");
  const [searchQuery, setSearchQuery] = useState("");
  const [newPerm, setNewPerm] = useState<BranchPermission>("view");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [identity, setIdentity] = useState<ChurchIdentity | null>(null);

  useEffect(() => {
    invoke<ChurchIdentity | null>("get_identity")
      .then((id) => setIdentity(id))
      .catch(() => {});
  }, []);

  useEffect(() => {
    invoke<[AclEntry[], AccessLevel]>("get_artifact_acl", { artifactId: artifact.id })
      .then(([entries, level]) => {
        setAcl(entries);
        setAccessLevel(level);
      })
      .catch(() => {});
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

  const handleShare = () => {
    const q = searchQuery.trim();
    if (!q) return;
    // Treat input as branch name (use as both id and name)
    if (acl.some((e) => e.branch_name.toLowerCase() === q.toLowerCase())) return;
    setAcl((prev) => [...prev, { branch_id: q, branch_name: q, permission: newPerm }]);
    setSearchQuery("");
  };

  const removeBranch = (branchId: string) =>
    setAcl((prev) => prev.filter((e) => e.branch_id !== branchId));

  const updatePerm = (branchId: string, perm: BranchPermission) =>
    setAcl((prev) =>
      prev.map((e) => (e.branch_id === branchId ? { ...e, permission: perm } : e))
    );

  const handleSyncToggle = async () => {
    const enable = !syncInfo?.sync_enabled;
    try {
      await invoke("toggle_artifact_cloud_sync", { artifactId: artifact.id, enabled: enable });
      onSyncToggled();
    } catch (e) {
      setError(String(e));
    }
  };

  const handleCopyLink = async () => {
    try {
      const url = await invoke<string | null>("copy_artifact_link", {
        artifactId: artifact.id,
      });
      if (!url) {
        if (!syncInfo?.sync_enabled) {
          await handleSyncToggle();
        }
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      setError(String(e));
    }
  };

  const currentBranchName = identity?.branch_name ?? "This Branch";
  const isPublic = accessLevel === "all_branches";

  return (
    <div
      data-qa="share-dialog-overlay"
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000]"
      onClick={onClose}
    >
      <div
        data-qa="share-dialog"
        className="bg-slate border border-iron rounded-[8px] w-[480px] max-h-[85vh] overflow-y-auto flex flex-col shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4">
          <div className="flex flex-col gap-[6px]">
            <h2 className="text-[15px] font-semibold text-chalk m-0">Share</h2>
            <div className="flex items-center gap-[7px]">
              <span className="text-smoke">
                <FileIcon />
              </span>
              <span className="text-[12px] text-ash font-mono overflow-hidden text-ellipsis whitespace-nowrap max-w-[280px]">
                {artifact.name}
              </span>
            </div>
          </div>
          <button
            className="bg-transparent border-none text-smoke cursor-pointer text-[13px] p-1 rounded transition-colors hover:text-chalk mt-[2px]"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* ── Cloud sync prompt (if not synced) ───────────────────────────── */}
        {!syncInfo?.sync_enabled && (
          <div className="mx-5 mb-4 px-3 py-3 rounded-[5px] bg-obsidian border border-iron flex items-center justify-between gap-3">
            <span className="text-[11px] text-ash">
              Enable cloud sync to share with other branches
            </span>
            <button
              className="shrink-0 bg-gold text-void font-sans text-[11px] font-semibold px-3 py-[5px] rounded-[3px] border-none cursor-pointer transition-[filter] hover:brightness-[1.1]"
              onClick={handleSyncToggle}
            >
              Enable Sync
            </button>
          </div>
        )}

        {/* ── Add people / branches ────────────────────────────────────────── */}
        <div className="px-5 pb-4">
          <p className="text-[9px] font-semibold tracking-[0.14em] uppercase text-smoke m-0 mb-[8px]">
            Add People or Branches
          </p>
          <div className="flex items-center gap-[6px]">
            <input
              data-qa="share-search-input"
              className="flex-1 bg-obsidian border border-iron rounded-[4px] text-chalk font-sans text-[12px] px-[10px] py-[6px] outline-none transition-colors focus:border-gold/60 placeholder:text-smoke"
              placeholder="Search branches or enter email…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleShare();
              }}
            />
            <PermSelect value={newPerm} onChange={setNewPerm} />
            <button
              data-qa="share-add-btn"
              className="bg-gold text-void font-sans text-[11px] font-semibold px-4 py-[6px] rounded-[3px] border-none cursor-pointer transition-[filter] hover:brightness-[1.1] disabled:opacity-40 disabled:cursor-default whitespace-nowrap shrink-0"
              onClick={handleShare}
              disabled={!searchQuery.trim()}
            >
              Share
            </button>
          </div>
        </div>

        <div className="h-px bg-iron mx-0" />

        {/* ── Who has access ───────────────────────────────────────────────── */}
        <div className="px-5 py-4">
          <p className="text-[9px] font-semibold tracking-[0.14em] uppercase text-smoke m-0 mb-[12px]">
            Who Has Access
          </p>

          <ul className="list-none m-0 p-0 flex flex-col gap-[4px]">
            {/* Current branch (always owner) */}
            <li className="flex items-center gap-3 py-[6px]">
              <BranchAvatar name={currentBranchName} />
              <div className="flex-1 min-w-0">
                <span className="block text-[12px] text-chalk font-medium overflow-hidden text-ellipsis whitespace-nowrap">
                  {currentBranchName}
                  <span className="text-smoke font-normal"> (You)</span>
                </span>
              </div>
              <span className="shrink-0 px-[8px] py-[3px] rounded-[3px] text-[10px] font-semibold tracking-[0.06em] uppercase bg-gold/10 text-gold border border-gold/20">
                Owner
              </span>
            </li>

            {/* Public access row */}
            {isPublic && (
              <li className="flex items-center gap-3 py-[6px]">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-smoke/20 border border-iron shrink-0">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.1" className="text-smoke" />
                    <path d="M7 4.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm0 4.5c-2 0-3.5.9-3.5 2h7c0-1.1-1.5-2-3.5-2z" fill="currentColor" className="text-smoke" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block text-[12px] text-chalk overflow-hidden text-ellipsis whitespace-nowrap">
                    Church Shared (Public)
                  </span>
                </div>
                <span className="text-[11px] text-ash">Can view</span>
              </li>
            )}

            {/* ACL entries */}
            {acl.map((entry) => (
              <li key={entry.branch_id} className="flex items-center gap-3 py-[6px]">
                <BranchAvatar name={entry.branch_name} />
                <div className="flex-1 min-w-0">
                  <span className="block text-[12px] text-chalk overflow-hidden text-ellipsis whitespace-nowrap">
                    {entry.branch_name}
                  </span>
                </div>
                <div className="flex items-center gap-[6px] shrink-0">
                  <PermSelect
                    value={entry.permission}
                    onChange={(p) => updatePerm(entry.branch_id, p)}
                  />
                  <button
                    className="bg-transparent border-none text-smoke cursor-pointer p-[3px] rounded transition-colors hover:text-ember text-[12px]"
                    onClick={() => removeBranch(entry.branch_id)}
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* ── General access toggle ────────────────────────────────────────── */}
        <div className="px-5 pb-4">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div
              className={[
                "relative w-9 h-5 rounded-full transition-colors",
                isPublic ? "bg-gold/80" : "bg-iron",
              ].join(" ")}
              onClick={() =>
                setAccessLevel((prev) =>
                  prev === "all_branches" ? "restricted" : "all_branches"
                )
              }
            >
              <div
                className={[
                  "absolute top-[3px] w-[14px] h-[14px] rounded-full bg-chalk transition-[left] duration-200",
                  isPublic ? "left-[19px]" : "left-[3px]",
                ].join(" ")}
              />
            </div>
            <span className="text-[12px] text-ash group-hover:text-chalk transition-colors">
              Anyone in the church can view
            </span>
          </label>
        </div>

        {error && (
          <p className="text-[11px] text-ember px-5 pb-2 m-0">{error}</p>
        )}

        <div className="h-px bg-iron" />

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4">
          <button
            data-qa="share-copy-link-btn"
            className="flex items-center gap-[7px] bg-transparent border border-iron text-ash font-sans text-[11px] px-[12px] py-[6px] rounded-[4px] cursor-pointer transition-colors hover:text-chalk hover:border-ash"
            onClick={handleCopyLink}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path d="M5 7a2.5 2.5 0 0 0 3.536.036l1.5-1.5a2.5 2.5 0 0 0-3.536-3.536L5.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M8 6a2.5 2.5 0 0 0-3.536-.036L3 7.464a2.5 2.5 0 0 0 3.536 3.536L7.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            {copied ? "✓ Copied!" : "Copy link"}
          </button>

          <button
            data-qa="share-done-btn"
            className="bg-gold text-void border-none rounded-[4px] font-sans text-[12px] font-semibold px-5 py-[7px] cursor-pointer transition-[filter] hover:brightness-[1.1] disabled:opacity-40 disabled:cursor-default"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
}
