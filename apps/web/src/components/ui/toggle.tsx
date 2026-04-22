import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "@/lib/cn";

/**
 * 38×22px pill toggle matching the OW design spec.
 * `bg-accent` when checked, `bg-bg-4` when unchecked.
 * White dot thumb.
 */
function Toggle({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="toggle"
      className={cn(
        "peer relative inline-flex h-[22px] w-[38px] shrink-0 cursor-pointer items-center rounded-full",
        "transition-colors duration-150",
        "bg-bg-4 data-[state=checked]:bg-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline focus-visible:outline-[1px] focus-visible:outline-offset-1 focus-visible:outline-accent",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block h-[16px] w-[16px] rounded-full bg-white",
          "shadow-[0_1px_3px_rgba(0,0,0,0.4)]",
          "transition-transform duration-150",
          "translate-x-[3px] data-[state=checked]:translate-x-[19px]",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Toggle };
