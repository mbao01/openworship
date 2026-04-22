import { useEffect } from "react";
import { SettingsPanel } from "./settings";
import type { ChurchIdentity } from "@/lib/types";

interface SettingsModalProps {
  identity: ChurchIdentity;
  onClose: () => void;
}

/**
 * Settings modal — thin wrapper rendering SettingsPanel as a modal overlay.
 * All settings logic lives in `./settings/` components and hooks.
 *
 * @see src/components/settings/SettingsPanel.tsx
 */
export function SettingsModal({ identity, onClose }: SettingsModalProps) {
  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      data-qa="settings-modal"
      className="fixed inset-0 z-[100] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-bg/70 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative z-10 h-[600px] w-[800px] overflow-hidden rounded-lg border border-line-strong shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]">
        <button
          data-qa="settings-close-x-btn"
          className="absolute top-3 right-3 z-10 flex h-6 w-6 items-center justify-center rounded-[3px] text-ink-3 transition-colors hover:bg-bg-3 hover:text-ink"
          onClick={onClose}
          aria-label="Close settings"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M1 1l8 8M9 1L1 9"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <SettingsPanel identity={identity} />
      </div>
    </div>
  );
}
