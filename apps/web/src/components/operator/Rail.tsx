import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { startTour } from "../../stores/tour-store";

interface RailProps {
  screen: string;
  onScreenChange: (screen: string) => void;
  /** Called when the user selects "Keyboard shortcuts" in the help popover. */
  onOpenShortcuts?: () => void;
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

export function Rail({ screen, onScreenChange, onOpenShortcuts }: RailProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const helpBtnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Global "?" key shortcut (skip when focus is in an input/textarea)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setHelpOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Close popover on Escape or click-outside
  useEffect(() => {
    if (!helpOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setHelpOpen(false);
        helpBtnRef.current?.focus();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (
        !popoverRef.current?.contains(e.target as Node) &&
        !helpBtnRef.current?.contains(e.target as Node)
      ) {
        setHelpOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [helpOpen]);

  // Focus the popover when it opens
  useEffect(() => {
    if (helpOpen && popoverRef.current) {
      popoverRef.current.focus();
    }
  }, [helpOpen]);

  const handleRestartTour = useCallback(() => {
    setHelpOpen(false);
    onScreenChange("live");
    void startTour();
  }, [onScreenChange]);

  const handleShortcuts = useCallback(() => {
    setHelpOpen(false);
    onOpenShortcuts?.();
  }, [onOpenShortcuts]);

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

      {/* Help button */}
      <button
        ref={helpBtnRef}
        data-qa="rail-help"
        aria-label="Open help menu"
        aria-expanded={helpOpen}
        aria-haspopup="dialog"
        className={`relative mx-2 mt-1 flex cursor-pointer flex-col items-center gap-1 rounded py-2.5 transition-all duration-150 ${
          helpOpen
            ? "bg-bg-3 text-ink"
            : "text-ink-3 hover:bg-bg-2 hover:text-ink"
        }`}
        onClick={() => setHelpOpen((o) => !o)}
      >
        <HelpIcon />
        <span className="font-mono text-[10px] tracking-[0.1em] uppercase">
          Help
        </span>
      </button>

      {/* Help popover — rendered in a portal to escape Rail clipping */}
      {helpOpen &&
        createPortal(
          <HelpPopover
            ref={popoverRef}
            btnRef={helpBtnRef}
            onRestartTour={handleRestartTour}
            onShortcuts={handleShortcuts}
            onClose={() => setHelpOpen(false)}
          />,
          document.body,
        )}
    </nav>
  );
}

// ─── HelpPopover ──────────────────────────────────────────────────────────────

interface HelpPopoverProps {
  ref: React.Ref<HTMLDivElement>;
  btnRef: React.RefObject<HTMLButtonElement | null>;
  onRestartTour: () => void;
  onShortcuts: () => void;
  onClose: () => void;
}

function HelpPopover({ ref, btnRef, onRestartTour, onShortcuts, onClose }: HelpPopoverProps) {
  // Position: to the right of the rail, aligned with the help button
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.top, left: r.right + 8 });
    }
  }, [btnRef]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-label="Help menu"
      tabIndex={-1}
      className="fixed z-[800] w-52 rounded-lg bg-bg-1 py-1 shadow-xl outline-none ring-1 ring-line"
      style={{ top: pos.top, left: pos.left }}
    >
      <p className="px-3 pt-2 pb-1 font-mono text-[9px] tracking-[0.12em] text-ink-3 uppercase">
        Help
      </p>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink transition-colors hover:bg-bg-2"
        onClick={onRestartTour}
      >
        <RestartIcon />
        Restart tour
      </button>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink transition-colors hover:bg-bg-2"
        onClick={onShortcuts}
      >
        <KeyboardIcon />
        Keyboard shortcuts
        <kbd className="ml-auto font-mono text-[9px] text-ink-3">?</kbd>
      </button>
      <div className="mx-3 my-1 h-px bg-line" />
      <a
        href="https://openworship.app/docs"
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink transition-colors hover:bg-bg-2"
        onClick={onClose}
      >
        <DocsIcon />
        OpenWorship docs
        <ExternalIcon />
      </a>
    </div>
  );
}

// ─── Icons (18×18, stroke, no fill) ──────────────────────────────────────────

function PlanIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <path d="M4 9h16M9 4v16" />
    </svg>
  );
}

function PreviewIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function LiveIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function AssetsIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M4 4h4v16H4zM10 4h4v16h-4zM16 6l3-1 3 15-3 1z" />
    </svg>
  );
}

function LogsIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M8 13h8M8 17h5" />
    </svg>
  );
}

function DisplayIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="3" y="5" width="18" height="12" rx="1" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function RestartIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="shrink-0 text-ink-3"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function KeyboardIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="shrink-0 text-ink-3"
    >
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
    </svg>
  );
}

function DocsIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="shrink-0 text-ink-3"
    >
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M8 13h8M8 17h5" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="ml-auto shrink-0 text-ink-3"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}
