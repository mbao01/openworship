import * as React from "react";
import { cn } from "@/lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Width class — defaults to "max-w-3xl" */
  className?: string;
  /** Accessible label for the dialog */
  "aria-label"?: string;
}

/**
 * Full-screen modal overlay with backdrop blur, close-on-escape,
 * close-on-backdrop-click, and animated entry/exit.
 *
 * Designed to match the warm parchment design system.
 *
 * @example
 * <Modal open={open} onClose={() => setOpen(false)}>
 *   <ModalHeader>
 *     <ModalTitle>Settings</ModalTitle>
 *   </ModalHeader>
 *   <ModalBody>…</ModalBody>
 * </Modal>
 */
export function Modal({
  open,
  onClose,
  children,
  className,
  "aria-label": ariaLabel,
}: ModalProps) {
  // Close on Escape
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      data-slot="modal-root"
      className="fixed inset-0 z-[100] flex animate-[fade-in_150ms_ease-out] items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "relative z-10 w-full rounded-lg",
          "border border-line-strong bg-bg-1",
          "shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]",
          "flex flex-col",
          "max-h-[85vh] max-w-3xl",
          className,
        )}
      >
        {/* Close button */}
        <button
          className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded text-ink-3 transition-colors hover:bg-bg-3 hover:text-ink"
          onClick={onClose}
          aria-label="Close"
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

        {children}
      </div>
    </div>
  );
}

/**
 * Modal header — renders above the scrollable body.
 */
export function ModalHeader({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="modal-header"
      className={cn("shrink-0 border-b border-line px-6 pt-5 pb-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Modal title — serif heading.
 */
export function ModalTitle({
  className,
  children,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="modal-title"
      className={cn("m-0 font-serif text-xl leading-snug text-ink", className)}
      {...props}
    >
      {children}
    </h2>
  );
}

/**
 * Modal description — muted subtext.
 */
export function ModalDescription({
  className,
  children,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="modal-description"
      className={cn("m-0 mt-1 text-sm text-ink-3", className)}
      {...props}
    >
      {children}
    </p>
  );
}

/**
 * Modal body — scrollable content area.
 */
export function ModalBody({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="modal-body"
      className={cn(
        "flex-1 overflow-x-hidden overflow-y-auto",
        "[scrollbar-color:var(--color-bg-3)_transparent] [scrollbar-width:thin]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Modal footer — fixed at bottom with right-aligned actions.
 */
export function ModalFooter({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="modal-footer"
      className={cn(
        "flex shrink-0 items-center justify-end gap-2 border-t border-line px-6 py-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
