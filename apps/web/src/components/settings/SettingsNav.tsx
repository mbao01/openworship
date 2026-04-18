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
  { id: "church",     label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "audio",      label: "Audio" },
  { id: "display",    label: "Display" },
  { id: "detection",  label: "Detection" },
  { id: "email",      label: "Service" },
  { id: "cloud",      label: "Cloud" },
  { id: "shortcuts",  label: "Shortcuts" },
  { id: "about",      label: "About" },
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
    <nav className="w-[160px] shrink-0 bg-bg-1 border-r border-line flex flex-col">
      <div className="px-4 py-3 border-b border-line shrink-0">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
          Settings
        </span>
      </div>
      <div className="flex-1 py-2 overflow-y-auto">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            data-qa={`settings-nav-${cat.id}`}
            onClick={() => onSelect(cat.id)}
            className={cn(
              "relative block w-full text-left px-4 py-2 text-[13px]",
              "transition-colors",
              "hover:text-ink hover:bg-bg-2",
              active === cat.id
                ? "text-ink bg-bg-2"
                : "text-ink-3"
            )}
          >
            {active === cat.id && (
              <span className="absolute left-0 top-2 bottom-2 w-[2px] bg-accent rounded-full" />
            )}
            {cat.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
