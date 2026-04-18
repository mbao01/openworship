import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";
import { cn } from "@/lib/cn";

/**
 * Range slider with accent-coloured fill track.
 * Used for confThreshold (40–95%) and semantic/lyrics thresholds.
 */
function Slider({
  className,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        "data-[disabled]:opacity-50 data-[disabled]:pointer-events-none",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-[3px] w-full grow overflow-hidden rounded-full bg-bg-4">
        <SliderPrimitive.Range className="absolute h-full bg-accent" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className={cn(
          "block h-[14px] w-[14px] rounded-full bg-accent",
          "shadow-[0_1px_3px_rgba(0,0,0,0.4)]",
          "transition-shadow",
          "focus-visible:outline focus-visible:outline-[1px] focus-visible:outline-accent",
          "hover:bg-accent-hover",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
      />
    </SliderPrimitive.Root>
  );
}

export { Slider };
