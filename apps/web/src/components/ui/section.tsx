import * as React from "react";
import { cn } from "@/lib/cn";

interface SectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  /** Show a separator above (used between settings sections). */
  separator?: boolean;
}

/**
 * Titled settings section container.
 * Uses tonal background shift instead of decorative borders.
 * `<Section title="Audio" description="...">`
 */
function Section({ title, description, children, className, separator }: SectionProps) {
  return (
    <section
      data-slot="section"
      className={cn(
        "space-y-4",
        separator && "pt-6 border-t border-line",
        className
      )}
    >
      <div className="space-y-0.5">
        <h3 className="text-sm font-semibold text-ink leading-none">{title}</h3>
        {description && (
          <p className="text-xs text-ink-3 leading-relaxed">{description}</p>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * A single settings row with label/description on the left and control on the right.
 * Matches the `.setting-row` pattern from the OW design.
 */
function SettingRow({ label, description, children, className }: SettingRowProps) {
  return (
    <div
      data-slot="setting-row"
      className={cn(
        "flex items-center justify-between gap-6",
        "py-3 border-b border-line last:border-b-0",
        className
      )}
    >
      <div className="space-y-0.5 min-w-0">
        <div className="text-sm text-ink-2 leading-none">{label}</div>
        {description && (
          <div className="text-xs text-ink-3 leading-relaxed">{description}</div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export { Section, SettingRow };
