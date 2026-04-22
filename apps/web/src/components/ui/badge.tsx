import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[3px] px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] leading-none",
  {
    variants: {
      variant: {
        /** Live — red indicator for the active display item. */
        live: "bg-live/20 text-live",
        /** Next — accent-coloured for the queued-next item. */
        next: "bg-accent-soft text-accent",
        /** Default — muted for detected/pending items. */
        default: "bg-bg-3 text-ink-3",
        /** Success — green for confirmed/synced state. */
        success: "bg-success/15 text-success",
        /** Danger — red for error states. */
        danger: "bg-danger/15 text-danger",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
