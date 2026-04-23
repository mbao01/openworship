import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  type UpdateInfo,
  type DownloadProgress,
  onUpdateAvailable,
  onDownloadProgress,
  onInstallComplete,
  installUpdate,
  restartApp,
} from "@/lib/commands/updater";
import { cn } from "@/lib/cn";

type Phase = "idle" | "available" | "downloading" | "ready";

/**
 * Non-intrusive banner shown at the bottom of the window when an update is
 * available. Mounted once in App and invisible unless an update is found.
 *
 * States:
 *   idle        — hidden; waiting for the background check result
 *   available   — update found; shows version + "Update Now" button
 *   downloading — progress bar shown; "Update Now" disabled
 *   ready       — download complete; shows "Restart to Apply" button
 */
export function UpdateBanner() {
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [info, setInfo] = React.useState<UpdateInfo | null>(null);
  const [progress, setProgress] = React.useState<DownloadProgress | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dismissed, setDismissed] = React.useState(false);

  // Subscribe to Rust-emitted update events.
  React.useEffect(() => {
    const unsubPromises = [
      onUpdateAvailable((updateInfo) => {
        setInfo(updateInfo);
        setPhase("available");
        setDismissed(false);
      }),
      onDownloadProgress((p) => {
        setProgress(p);
        setPhase("downloading");
      }),
      onInstallComplete(() => {
        setPhase("ready");
        setProgress(null);
      }),
    ];

    return () => {
      unsubPromises.forEach((p) => p.then((unsub) => unsub()).catch(() => {}));
    };
  }, []);

  async function handleInstall() {
    setPhase("downloading");
    setError(null);
    try {
      await installUpdate();
    } catch (e) {
      setError(typeof e === "string" ? e : (e as Error)?.message ?? "Update failed");
      setPhase("available");
    }
  }

  if (dismissed || phase === "idle") return null;

  const pct =
    progress && progress.total
      ? Math.round((progress.downloaded / progress.total) * 100)
      : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-4 right-4 z-50 flex flex-col gap-2 rounded-lg border border-line-strong",
        "bg-bg-2 p-3 shadow-xl text-sm max-w-xs w-full"
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-ink">
          {phase === "ready"
            ? "Update ready"
            : `Update available — v${info?.version}`}
        </span>
        {phase !== "downloading" && (
          <button
            className="text-ink-3 hover:text-ink transition-colors"
            aria-label="Dismiss update notification"
            onClick={() => setDismissed(true)}
          >
            ✕
          </button>
        )}
      </div>

      {/* Release notes snippet */}
      {phase === "available" && info?.body && (
        <p className="text-ink-3 text-xs line-clamp-2">{info.body}</p>
      )}

      {/* Progress bar */}
      {phase === "downloading" && (
        <div className="flex flex-col gap-1">
          <div className="h-1.5 rounded-full bg-bg-3 overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-200"
              style={{ width: pct !== null ? `${pct}%` : "100%" }}
              aria-valuenow={pct ?? undefined}
              aria-valuemin={0}
              aria-valuemax={100}
              role="progressbar"
            />
          </div>
          <span className="text-ink-3 text-xs">
            {pct !== null ? `Downloading… ${pct}%` : "Downloading…"}
          </span>
        </div>
      )}

      {/* Error */}
      {error && <p className="text-danger text-xs">{error}</p>}

      {/* Action buttons */}
      <div className="flex gap-2 justify-end">
        {phase === "available" && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDismissed(true)}
            >
              Later
            </Button>
            <Button size="sm" onClick={handleInstall}>
              Update Now
            </Button>
          </>
        )}
        {phase === "ready" && (
          <Button size="sm" onClick={restartApp}>
            Restart to Apply
          </Button>
        )}
      </div>
    </div>
  );
}
