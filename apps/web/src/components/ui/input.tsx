import * as React from "react";
import { cn } from "@/lib/cn";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded text-sm",
        "bg-bg-2 border border-line text-ink placeholder:text-muted",
        "px-3 py-1.5",
        "transition-colors",
        "focus:border-accent focus:ring-0",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Input };
