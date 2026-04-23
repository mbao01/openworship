import { useEffect } from "react";
import { useAudioSettings } from "@/hooks/use-audio-settings";
import { enableSentry, disableSentry } from "@/lib/sentry";
import { Section, SettingRow } from "@/components/ui/section";

/**
 * Privacy & Diagnostics settings section.
 *
 * Provides the opt-in toggle for Sentry crash reporting.
 * Sentry is never active unless the operator explicitly enables it here.
 */
export function PrivacySection() {
  const { settings, loading, update } = useAudioSettings();
  const crashReportsEnabled = settings?.send_crash_reports ?? false;

  // Sync Sentry client state when the preference loads or changes.
  useEffect(() => {
    if (crashReportsEnabled) {
      enableSentry();
    } else {
      disableSentry();
    }
  }, [crashReportsEnabled]);

  if (loading || !settings) {
    return (
      <div className="flex-1 p-6">
        <p className="text-sm text-ink-3">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-0 overflow-y-auto p-6">
      <h2 className="mb-6 border-b border-line pb-3 font-mono text-[10px] tracking-[0.12em] text-ink-3 uppercase">
        Privacy &amp; Diagnostics
      </h2>

      <Section
        title="Crash reporting"
        description="When enabled, unhandled errors and panics are sent to Sentry to help the OpenWorship team diagnose and fix bugs. No personal information, church names, or sermon content is ever included."
      >
        <SettingRow label="Send crash reports to OpenWorship">
          <button
            role="switch"
            aria-checked={settings.send_crash_reports}
            onClick={() =>
              update({ send_crash_reports: !settings.send_crash_reports })
            }
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
              settings.send_crash_reports ? "bg-accent" : "bg-bg-3"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                settings.send_crash_reports ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </SettingRow>
        <p className="mt-2 text-[11px] text-ink-3">
          Crash reports are anonymous and opt-in only. You can change this at
          any time.
        </p>
      </Section>
    </div>
  );
}
