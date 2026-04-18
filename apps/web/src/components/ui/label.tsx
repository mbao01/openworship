import * as React from "react";
import { cn } from "@/lib/cn";

interface LabelProps extends React.ComponentProps<"label"> {
  required?: boolean;
}

/**
 * Mono uppercase tracking label — used above form controls and settings rows.
 * Matches the `.mono` utility pattern from the OW design system.
 */
function Label({ className, required, children, ...props }: LabelProps) {
  return (
    <label
      data-slot="label"
      className={cn(
        "font-mono text-[10.5px] uppercase tracking-[0.05em] text-ink-3 leading-none select-none",
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="ml-1 text-danger">*</span>}
    </label>
  );
}

export { Label };
