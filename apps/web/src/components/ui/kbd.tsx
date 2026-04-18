import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * Keyboard shortcut display pill.
 * Matches the `.tb-btn kbd` pattern in the OW design: mono, bg-bg-4, radius-sm.
 */
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "font-mono text-[10px] px-[4px] py-[1px]",
        "bg-bg-4 rounded-[2px] text-ink-3 leading-none",
        className
      )}
      {...props}
    />
  );
}

export { Kbd };
