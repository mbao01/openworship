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
function Section({
  title,
  description,
  children,
  className,
  separator,
}: SectionProps) {
  return (
    <section
      data-slot="section"
      className={cn(
        "space-y-4",
        separator && "border-t border-line pt-6",
        className,
      )}
    >
      <div className="space-y-0.5">
        <h3 className="text-sm leading-none font-semibold text-ink">{title}</h3>
        {description && (
          <p className="text-xs leading-relaxed text-ink-3">{description}</p>
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
function SettingRow({
  label,
  description,
  children,
  className,
}: SettingRowProps) {
  return (
    <div
      data-slot="setting-row"
      className={cn(
        "flex items-center justify-between gap-6",
        "border-b border-line py-3 last:border-b-0",
        className,
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <div className="text-sm leading-none text-ink-2">{label}</div>
        {description && (
          <div className="text-xs leading-relaxed text-ink-3">
            {description}
          </div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export { Section, SettingRow };
