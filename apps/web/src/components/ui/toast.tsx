import * as React from "react";
import { Toast as ToastPrimitive } from "radix-ui";
import { cn } from "@/lib/cn";
import { subscribeToToasts, type ToastItem } from "@/lib/toast";

export function Toaster() {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  React.useEffect(() => {
    return subscribeToToasts((item) => {
      setItems((prev) => [...prev, item]);
    });
  }, []);

  function remove(id: string) {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {items.map((item) => (
        <ToastPrimitive.Root
          key={item.id}
          open
          onOpenChange={(open) => {
            if (!open) remove(item.id);
          }}
          duration={item.variant === "error" ? 6000 : 4000}
          className={cn(
            "flex items-start gap-3 rounded-md border px-4 py-3 shadow-lg",
            "bg-bg-1 font-sans",
            item.variant === "error" && "border-danger/50",
            item.variant === "success" && "border-accent/50",
            item.variant === "info" && "border-line",
          )}
        >
          <div className="min-w-0 flex-1">
            <ToastPrimitive.Title
              className={cn(
                "text-[10px] font-medium tracking-[0.12em] uppercase",
                item.variant === "error" && "text-danger",
                item.variant === "success" && "text-accent",
                item.variant === "info" && "text-ink-3",
              )}
            >
              {item.variant === "error"
                ? "Error"
                : item.variant === "success"
                  ? "Done"
                  : "Info"}
            </ToastPrimitive.Title>
            <ToastPrimitive.Description className="mt-0.5 text-xs leading-relaxed text-ink">
              {item.message}
            </ToastPrimitive.Description>
          </div>
          <ToastPrimitive.Close
            className="mt-0.5 shrink-0 cursor-pointer text-xs text-ink-3 transition-colors hover:text-ink"
            aria-label="Dismiss"
          >
            ✕
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className="fixed right-4 bottom-4 z-50 m-0 flex w-[360px] max-w-[calc(100vw-2rem)] list-none flex-col gap-2 p-0 outline-none" />
    </ToastPrimitive.Provider>
  );
}
