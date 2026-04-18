import { useDisplayWindow } from "@/hooks/use-display-window";
import { Section, SettingRow } from "@/components/ui/section";
import { Button } from "@/components/ui/button";

/**
 * Display settings section: monitor selection, fullscreen output, OBS URL.
 */
export function DisplaySection() {
  const { isOpen, monitors, obsUrl, openOn, close } = useDisplayWindow();

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-0">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3 mb-6 pb-3 border-b border-line">
        Display
      </h2>

      <Section title="Output monitor">
        {monitors.length === 0 ? (
          <p className="text-xs text-ink-3">No external monitors detected.</p>
        ) : (
          <div className="space-y-2">
            {monitors.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between py-2 border-b border-line last:border-b-0"
              >
                <div className="space-y-0.5">
                  <div className="text-sm text-ink-2">{m.name}</div>
                  <div className="font-mono text-[10px] text-ink-3">
                    {m.width}×{m.height}{m.is_primary ? " · Primary" : ""}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openOn(m.id)}
                  disabled={isOpen}
                >
                  Open
                </Button>
              </div>
            ))}
          </div>
        )}

        {isOpen && (
          <SettingRow label="Active display">
            <Button variant="danger" size="sm" onClick={close}>
              Close
            </Button>
          </SettingRow>
        )}
      </Section>

      <Section title="OBS browser source" separator description="Copy this URL to OBS as a Browser Source.">
        <div className="flex items-center gap-2">
          <span className="flex-1 font-mono text-[10.5px] text-accent bg-bg-2 border border-line rounded px-3 py-1.5 overflow-hidden text-ellipsis whitespace-nowrap">
            {obsUrl ?? "ws://127.0.0.1:9000"}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigator.clipboard.writeText(obsUrl ?? "")}
            disabled={!obsUrl}
          >
            Copy
          </Button>
        </div>
      </Section>
    </div>
  );
}
