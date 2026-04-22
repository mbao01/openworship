import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded text-sm whitespace-nowrap transition-all outline-none focus-visible:outline-[1px] focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        /** Primary CTA — copper gold fill, dark text. */
        default:
          "bg-accent text-accent-foreground font-semibold hover:bg-accent-hover [data-app-theme=light_&]:text-bg",
        /** Subtle bordered button — used for secondary actions. */
        outline:
          "border border-line-strong bg-bg-2 text-ink-2 hover:text-ink hover:border-line-strong hover:bg-bg-3",
        /** No background — for icon rows, menus. */
        ghost: "text-ink-3 hover:text-ink hover:bg-bg-3",
        /** Ghost with accent text — for links and accent actions. */
        "ghost-accent":
          "text-accent hover:text-accent-hover hover:bg-accent-soft",
        /** Destructive action — danger fill. */
        danger:
          "bg-danger/20 text-danger hover:bg-danger/30 border border-danger/30",
        /** Secondary surface button — for toolbar actions. */
        secondary:
          "bg-bg-2 text-ink-2 border border-line hover:text-ink hover:border-line-strong hover:bg-bg-3",
      },
      size: {
        default: "h-8 px-3 py-1.5",
        sm: "h-7 px-2.5 py-1 text-xs",
        lg: "h-9 px-4 py-2",
        xs: "h-6 px-2 py-0.5 text-xs gap-1",
        icon: "size-8",
        "icon-sm": "size-7",
        "icon-xs": "size-6",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
