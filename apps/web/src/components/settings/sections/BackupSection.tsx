import { useState } from "react";
import { createBackup, restoreBackup } from "@/lib/commands/backup";
import { Section, SettingRow } from "@/components/ui/section";
import { Button } from "@/components/ui/button";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString();
}

/**
 * Backup and restore section in Settings.
 *
 * Export: opens a native save dialog, writes a .openworship-backup archive.
 * Import: opens a native open dialog, restores from archive, prompts restart.
 */
export function BackupSection() {
  const [backupState, setBackupState] = useState<
    "idle" | "working" | "done" | "error"
  >("idle");
  const [backupInfo, setBackupInfo] = useState<{
    path: string;
    size_bytes: number;
    created_at_ms: number;
  } | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  const [restoreState, setRestoreState] = useState<
    "idle" | "working" | "done" | "error"
  >("idle");
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const handleBackup = async () => {
    setBackupState("working");
    setBackupError(null);
    setBackupInfo(null);

    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const dest = await save({
        title: "Save Backup",
        defaultPath: `openworship-backup-${new Date().toISOString().slice(0, 10)}.openworship-backup`,
        filters: [
          {
            name: "OpenWorship Backup",
            extensions: ["openworship-backup"],
          },
        ],
      });

      if (!dest) {
        setBackupState("idle");
        return;
      }

      const info = await createBackup(dest);
      setBackupInfo(info);
      setBackupState("done");
    } catch (e) {
      setBackupError(String(e));
      setBackupState("error");
    }
  };

  const handleRestore = async () => {
    setRestoreState("working");
    setRestoreError(null);

    try {
      const { open, message } = await import("@tauri-apps/plugin-dialog");
      const src = await open({
        title: "Open Backup File",
        multiple: false,
        filters: [
          {
            name: "OpenWorship Backup",
            extensions: ["openworship-backup"],
          },
        ],
      });

      if (!src) {
        setRestoreState("idle");
        return;
      }

      const srcPath = Array.isArray(src) ? src[0] : src;
      await restoreBackup(srcPath);
      setRestoreState("done");

      await message(
        "Restore complete. Please restart OpenWorship for the changes to take effect.",
        { title: "Restore Successful", kind: "info" },
      );
    } catch (e) {
      setRestoreError(String(e));
      setRestoreState("error");
    }
  };

  return (
    <div className="flex-1 space-y-0 overflow-y-auto p-6">
      <h2 className="mb-6 border-b border-line pb-3 font-mono text-[10px] tracking-[0.12em] text-ink-3 uppercase">
        Backup &amp; Restore
      </h2>

      <Section
        title="Export backup"
        description="Save all church data — songs, service projects, settings, and media — to a single backup file."
      >
        <SettingRow
          label="Backup file"
          description="Includes songs, projects, announcements, sermon notes, and uploaded media. API keys and passwords are not included."
        >
          <Button
            size="sm"
            onClick={handleBackup}
            disabled={backupState === "working"}
          >
            {backupState === "working" ? "Saving…" : "Export backup…"}
          </Button>
        </SettingRow>

        {backupState === "done" && backupInfo && (
          <div className="rounded-md border border-line bg-bg-1 px-3 py-2 font-mono text-[11px] text-ink-3">
            <div className="flex justify-between">
              <span>Saved</span>
              <span className="max-w-[260px] truncate text-ink-2">
                {backupInfo.path.split("/").pop()}
              </span>
            </div>
            <div className="mt-1 flex justify-between">
              <span>Size</span>
              <span className="text-ink-2">
                {formatBytes(backupInfo.size_bytes)}
              </span>
            </div>
            <div className="mt-1 flex justify-between">
              <span>Created</span>
              <span className="text-ink-2">
                {formatDate(backupInfo.created_at_ms)}
              </span>
            </div>
          </div>
        )}

        {backupState === "error" && backupError && (
          <p className="text-xs text-danger">{backupError}</p>
        )}
      </Section>

      <Section
        title="Import backup"
        description="Restore church data from a previously exported backup file. The app will need to restart after restore."
        separator
      >
        <SettingRow
          label="Restore from file"
          description="This will overwrite your current data. Export a backup first if you want to preserve your current state."
        >
          <Button
            size="sm"
            variant="secondary"
            onClick={handleRestore}
            disabled={restoreState === "working"}
          >
            {restoreState === "working" ? "Restoring…" : "Import backup…"}
          </Button>
        </SettingRow>

        {restoreState === "done" && (
          <p className="text-xs text-ink-3">
            Restore complete — please restart the app.
          </p>
        )}

        {restoreState === "error" && restoreError && (
          <p className="text-xs text-danger">{restoreError}</p>
        )}
      </Section>
    </div>
  );
}
