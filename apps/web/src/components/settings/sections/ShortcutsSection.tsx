import { Kbd } from "@/components/ui/kbd";

const SHORTCUTS: { key: string; description: string }[] = [
  { key: "Space",  description: "Push next item to display" },
  { key: "B",      description: "Black screen" },
  { key: "X",      description: "Skip queue item" },
  { key: "N",      description: "Reject — not this one" },
  { key: "↑ / ↓", description: "Navigate queue items" },
  { key: "⌘ ,",   description: "Open settings" },
  { key: "⌘ M",   description: "Toggle microphone" },
  { key: "⌘ K",   description: "Command palette" },
];

/**
 * Keyboard shortcuts reference section.
 */
export function ShortcutsSection() {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-0">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3 mb-6 pb-3 border-b border-line">
        Shortcuts
      </h2>

      <div className="space-y-0">
        {SHORTCUTS.map(({ key, description }) => (
          <div
            key={key}
            className="flex items-center justify-between py-2.5 border-b border-line last:border-b-0"
          >
            <span className="text-sm text-ink-2">{description}</span>
            <Kbd>{key}</Kbd>
          </div>
        ))}
      </div>
    </div>
  );
}
