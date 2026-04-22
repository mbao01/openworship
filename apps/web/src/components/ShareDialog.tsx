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
      className="cursor-pointer appearance-none rounded-[3px] border border-line bg-bg-1 px-[8px] py-[4px] pr-[22px] font-sans text-[11px] text-ink transition-colors outline-none focus:border-accent disabled:cursor-default disabled:opacity-50"
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
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
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
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-ink"
      style={{
        background: `hsl(${hue}, 30%, 28%)`,
        border: `1px solid hsl(${hue}, 30%, 35%)`,
      }}
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
  const [syncConfirmPending, setSyncConfirmPending] = useState(false);
  const [identity, setIdentity] = useState<ChurchIdentity | null>(null);

  useEffect(() => {
    invoke<ChurchIdentity | null>("get_identity")
      .then((id) => setIdentity(id))
      .catch(() => {});
  }, []);

  useEffect(() => {
    invoke<[AclEntry[], AccessLevel]>("get_artifact_acl", {
      artifactId: artifact.id,
    })
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
      await invoke("set_artifact_acl", {
        artifactId: artifact.id,
        acl,
        accessLevel,
      });
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleShare = () => {
    // Support comma-separated branch names; trim and filter empty entries
    const names = searchQuery
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (names.length === 0) return;
    setAcl((prev) => {
      const existing = new Set(prev.map((e) => e.branch_name.toLowerCase()));
      const toAdd = names
        .filter((name) => !existing.has(name.toLowerCase()))
        .map((name) => ({
          branch_id: name,
          branch_name: name,
          permission: newPerm,
        }));
      return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
    });
    setSearchQuery("");
  };

  const removeBranch = (branchId: string) =>
    setAcl((prev) => prev.filter((e) => e.branch_id !== branchId));

  const updatePerm = (branchId: string, perm: BranchPermission) =>
    setAcl((prev) =>
      prev.map((e) =>
        e.branch_id === branchId ? { ...e, permission: perm } : e,
      ),
    );

  const handleSyncToggle = async () => {
    const enable = !syncInfo?.sync_enabled;
    try {
      await invoke("toggle_artifact_cloud_sync", {
        artifactId: artifact.id,
        enabled: enable,
      });
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
        // Sync is not enabled — prompt the user instead of auto-enabling
        if (!syncInfo?.sync_enabled) {
          setSyncConfirmPending(true);
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

  const handleConfirmSyncAndCopy = async () => {
    setSyncConfirmPending(false);
    await handleSyncToggle();
    // After enabling sync, retry the copy
    await handleCopyLink();
  };

  const currentBranchName = identity?.branch_name ?? "This Branch";
  const isPublic = accessLevel === "all_branches";

  return (
    <div
      data-qa="share-dialog-overlay"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        data-qa="share-dialog"
        className="flex max-h-[85vh] w-[480px] flex-col overflow-y-auto rounded-[8px] border border-line bg-bg-2 shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4">
          <div className="flex flex-col gap-[6px]">
            <h2 className="m-0 text-[15px] font-semibold text-ink">Share</h2>
            <div className="flex items-center gap-[7px]">
              <span className="text-muted">
                <FileIcon />
              </span>
              <span className="max-w-[280px] overflow-hidden font-mono text-[12px] text-ellipsis whitespace-nowrap text-ink-3">
                {artifact.name}
              </span>
            </div>
          </div>
          <button
            className="mt-[2px] cursor-pointer rounded border-none bg-transparent p-1 text-[13px] text-muted transition-colors hover:text-ink"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* ── Cloud sync prompt (if not synced) ───────────────────────────── */}
        {!syncInfo?.sync_enabled && (
          <div className="mx-5 mb-4 flex items-center justify-between gap-3 rounded-[5px] border border-line bg-bg-1 px-3 py-3">
            <span className="text-[11px] text-ink-3">
              Enable cloud sync to share with other branches
            </span>
            <button
              className="shrink-0 cursor-pointer rounded-[3px] border-none bg-accent px-3 py-[5px] font-sans text-[11px] font-semibold text-accent-foreground transition-[filter] hover:brightness-[1.1]"
              onClick={handleSyncToggle}
            >
              Enable Sync
            </button>
          </div>
        )}

        {/* ── Add people / branches ────────────────────────────────────────── */}
        <div className="px-5 pb-4">
          <p className="m-0 mb-[8px] text-[9px] font-semibold tracking-[0.14em] text-muted uppercase">
            Add People or Branches
          </p>
          <div className="flex items-center gap-[6px]">
            <input
              data-qa="share-search-input"
              className="flex-1 rounded-[4px] border border-line bg-bg-1 px-[10px] py-[6px] font-sans text-[12px] text-ink transition-colors outline-none placeholder:text-muted focus:border-accent/60"
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
              className="shrink-0 cursor-pointer rounded-[3px] border-none bg-accent px-4 py-[6px] font-sans text-[11px] font-semibold whitespace-nowrap text-accent-foreground transition-[filter] hover:brightness-[1.1] disabled:cursor-default disabled:opacity-40"
              onClick={handleShare}
              disabled={!searchQuery.trim()}
            >
              Share
            </button>
          </div>
        </div>

        <div className="mx-0 h-px bg-line" />

        {/* ── Who has access ───────────────────────────────────────────────── */}
        <div className="px-5 py-4">
          <p className="m-0 mb-[12px] text-[9px] font-semibold tracking-[0.14em] text-muted uppercase">
            Who Has Access
          </p>

          <ul className="m-0 flex list-none flex-col gap-[4px] p-0">
            {/* Current branch (always owner) */}
            <li className="flex items-center gap-3 py-[6px]">
              <BranchAvatar name={currentBranchName} />
              <div className="min-w-0 flex-1">
                <span className="block overflow-hidden text-[12px] font-medium text-ellipsis whitespace-nowrap text-ink">
                  {currentBranchName}
                  <span className="font-normal text-muted"> (You)</span>
                </span>
              </div>
              <span className="shrink-0 rounded-[3px] border border-accent/20 bg-accent-soft px-[8px] py-[3px] text-[10px] font-semibold tracking-[0.06em] text-accent uppercase">
                Owner
              </span>
            </li>

            {/* Public access row */}
            {isPublic && (
              <li className="flex items-center gap-3 py-[6px]">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-muted/20">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle
                      cx="7"
                      cy="7"
                      r="5.5"
                      stroke="currentColor"
                      strokeWidth="1.1"
                      className="text-muted"
                    />
                    <path
                      d="M7 4.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm0 4.5c-2 0-3.5.9-3.5 2h7c0-1.1-1.5-2-3.5-2z"
                      fill="currentColor"
                      className="text-muted"
                    />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block overflow-hidden text-[12px] text-ellipsis whitespace-nowrap text-ink">
                    Church Shared (Public)
                  </span>
                </div>
                <span className="text-[11px] text-ink-3">Can view</span>
              </li>
            )}

            {/* ACL entries */}
            {acl.map((entry) => (
              <li
                key={entry.branch_id}
                className="flex items-center gap-3 py-[6px]"
              >
                <BranchAvatar name={entry.branch_name} />
                <div className="min-w-0 flex-1">
                  <span className="block overflow-hidden text-[12px] text-ellipsis whitespace-nowrap text-ink">
                    {entry.branch_name}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-[6px]">
                  <PermSelect
                    value={entry.permission}
                    onChange={(p) => updatePerm(entry.branch_id, p)}
                  />
                  <button
                    className="cursor-pointer rounded border-none bg-transparent p-[3px] text-[12px] text-muted transition-colors hover:text-danger"
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
          <label className="group flex cursor-pointer items-center gap-3">
            <div
              className={[
                "relative h-5 w-9 rounded-full transition-colors",
                isPublic ? "bg-accent/80" : "bg-line",
              ].join(" ")}
              onClick={() =>
                setAccessLevel((prev) =>
                  prev === "all_branches" ? "restricted" : "all_branches",
                )
              }
            >
              <div
                className={[
                  "absolute top-[3px] h-[14px] w-[14px] rounded-full bg-ink transition-[left] duration-200",
                  isPublic ? "left-[19px]" : "left-[3px]",
                ].join(" ")}
              />
            </div>
            <span className="text-[12px] text-ink-3 transition-colors group-hover:text-ink">
              Anyone in the church can view
            </span>
          </label>
        </div>

        {syncConfirmPending && (
          <div className="mx-5 mb-4 flex items-center justify-between gap-3 rounded-[5px] border border-accent/40 bg-bg-1 px-3 py-3">
            <span className="text-[11px] text-ink-3">
              Sharing requires cloud sync. Enable sync now?
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <button
                className="cursor-pointer rounded-[3px] border border-line bg-transparent px-3 py-[5px] font-sans text-[11px] text-ink-3 transition-colors hover:border-line-strong hover:text-ink"
                onClick={() => setSyncConfirmPending(false)}
              >
                Cancel
              </button>
              <button
                className="cursor-pointer rounded-[3px] border-none bg-accent px-3 py-[5px] font-sans text-[11px] font-semibold text-accent-foreground transition-[filter] hover:brightness-[1.1]"
                onClick={handleConfirmSyncAndCopy}
              >
                Enable &amp; Copy
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="m-0 px-5 pb-2 text-[11px] text-danger">{error}</p>
        )}

        <div className="h-px bg-line" />

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4">
          <button
            data-qa="share-copy-link-btn"
            className="flex cursor-pointer items-center gap-[7px] rounded-[4px] border border-line bg-transparent px-[12px] py-[6px] font-sans text-[11px] text-ink-3 transition-colors hover:border-line-strong hover:text-ink"
            onClick={handleCopyLink}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 13 13"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M5 7a2.5 2.5 0 0 0 3.536.036l1.5-1.5a2.5 2.5 0 0 0-3.536-3.536L5.5 3.5"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <path
                d="M8 6a2.5 2.5 0 0 0-3.536-.036L3 7.464a2.5 2.5 0 0 0 3.536 3.536L7.5 9.5"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
            {copied ? "✓ Copied!" : "Copy link"}
          </button>

          <button
            data-qa="share-done-btn"
            className="cursor-pointer rounded-[4px] border-none bg-accent px-5 py-[7px] font-sans text-[12px] font-semibold text-accent-foreground transition-[filter] hover:brightness-[1.1] disabled:cursor-default disabled:opacity-40"
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
