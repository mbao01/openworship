import { cn } from "@/lib/cn";

export type SettingsCategory =
  | "church"
  | "appearance"
  | "audio"
  | "display"
  | "detection"
  | "email"
  | "cloud"
  | "shortcuts"
  | "about";

const CATEGORIES: { id: SettingsCategory; label: string }[] = [
  { id: "church", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "audio", label: "Audio" },
  { id: "display", label: "Display" },
  { id: "detection", label: "Detection" },
  { id: "email", label: "Service" },
  { id: "cloud", label: "Cloud" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "about", label: "About" },
];

interface SettingsNavProps {
  active: SettingsCategory;
  onSelect: (cat: SettingsCategory) => void;
}

/**
 * Left sidebar navigation for the Settings panel.
 * Active item has a 2px left accent stripe matching the OW rail pattern.
 */
export function SettingsNav({ active, onSelect }: SettingsNavProps) {
  return (
    <nav className="flex w-[160px] shrink-0 flex-col border-r border-line bg-bg-1">
      <div className="shrink-0 border-b border-line px-4 py-3">
        <span className="font-mono text-[10px] tracking-[0.12em] text-ink-3 uppercase">
          Settings
        </span>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            data-qa={`settings-nav-${cat.id}`}
            onClick={() => onSelect(cat.id)}
            className={cn(
              "relative block w-full px-4 py-2 text-left text-[13px]",
              "transition-colors",
              "hover:bg-bg-2 hover:text-ink",
              active === cat.id ? "bg-bg-2 text-ink" : "text-ink-3",
            )}
          >
            {active === cat.id && (
              <span className="absolute top-2 bottom-2 left-0 w-[2px] rounded-full bg-accent" />
            )}
            {cat.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
