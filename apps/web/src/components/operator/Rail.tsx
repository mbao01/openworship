interface RailProps {
  screen: string;
  onScreenChange: (screen: string) => void;
}

const ITEMS = [
  { id: "plan", label: "Plan", icon: PlanIcon },
  { id: "preview", label: "Prep", icon: PreviewIcon },
  { id: "live", label: "Live", icon: LiveIcon },
  { id: "library", label: "Bank", icon: LibraryIcon },
  { id: "assets", label: "Assets", icon: AssetsIcon },
  { id: "logs", label: "History", icon: LogsIcon },
  { id: "display", label: "Screen", icon: DisplayIcon },
];

export function Rail({ screen, onScreenChange }: RailProps) {
  return (
    <nav className="flex w-16 shrink-0 flex-col gap-1 border-r border-line bg-bg-1 py-3">
      {ITEMS.map((item) => (
        <button
          key={item.id}
          data-qa={`rail-${item.id}`}
          aria-label={`Open ${item.label}`}
          aria-current={screen === item.id ? "page" : undefined}
          className={`relative mx-2 flex cursor-pointer flex-col items-center gap-1 rounded py-2.5 transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
            screen === item.id
              ? "bg-bg-3 text-ink"
              : "text-ink-3 hover:bg-bg-2 hover:text-ink"
          }`}
          onClick={() => onScreenChange(item.id)}
        >
          {screen === item.id && (
            <span className="absolute top-2.5 bottom-2.5 left-[-8px] w-[3px] bg-accent" />
          )}
          <item.icon />
          <span className="font-mono text-[10px] tracking-[0.1em] uppercase">
            {item.label}
          </span>
        </button>
      ))}
      <div className="flex-1" />
      <div className="mx-3 my-2 h-px bg-line" />
      <button
        className={`relative mx-2 flex cursor-pointer flex-col items-center gap-1 rounded py-2.5 transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
          screen === "settings"
            ? "bg-bg-3 text-ink"
            : "text-ink-3 hover:bg-bg-2 hover:text-ink"
        }`}
        onClick={() => onScreenChange("settings")}
        aria-label="Open settings"
        aria-current={screen === "settings" ? "page" : undefined}
      >
        {screen === "settings" && (
          <span className="absolute top-2.5 bottom-2.5 left-[-8px] w-[3px] bg-accent" />
        )}
        <SettingsIcon />
        <span className="font-mono text-[10px] tracking-[0.1em] uppercase">
          Set
        </span>
      </button>
    </nav>
  );
}

// ─── Icons (18×18, stroke, no fill) ──────────────────────────────────────────

function PlanIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <path d="M4 9h16M9 4v16" />
    </svg>
  );
}

function PreviewIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function LiveIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function AssetsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 4h4v16H4zM10 4h4v16h-4zM16 6l3-1 3 15-3 1z" />
    </svg>
  );
}

function LogsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M8 13h8M8 17h5" />
    </svg>
  );
}

function DisplayIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="5" width="18" height="12" rx="1" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  );
}
