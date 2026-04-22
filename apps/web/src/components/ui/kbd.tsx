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
        "px-[4px] py-[1px] font-mono text-[10px]",
        "rounded-[2px] bg-bg-4 leading-none text-ink-3",
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
