import * as React from "react"
import { Toast as ToastPrimitive } from "radix-ui"
import { cn } from "@/lib/cn"
import { subscribeToToasts, type ToastItem } from "@/lib/toast"

export function Toaster() {
  const [items, setItems] = React.useState<ToastItem[]>([])

  React.useEffect(() => {
    return subscribeToToasts((item) => {
      setItems((prev) => [...prev, item])
    })
  }, [])

  function remove(id: string) {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {items.map((item) => (
        <ToastPrimitive.Root
          key={item.id}
          open
          onOpenChange={(open) => {
            if (!open) remove(item.id)
          }}
          duration={item.variant === "error" ? 6000 : 4000}
          className={cn(
            "flex items-start gap-3 rounded-md border px-4 py-3 shadow-lg",
            "bg-obsidian font-sans",
            item.variant === "error" && "border-ember/50",
            item.variant === "success" && "border-gold/50",
            item.variant === "info" && "border-iron",
          )}
        >
          <div className="flex-1 min-w-0">
            <ToastPrimitive.Title
              className={cn(
                "text-[10px] font-medium tracking-[0.12em] uppercase",
                item.variant === "error" && "text-ember",
                item.variant === "success" && "text-gold",
                item.variant === "info" && "text-ash",
              )}
            >
              {item.variant === "error" ? "Error" : item.variant === "success" ? "Done" : "Info"}
            </ToastPrimitive.Title>
            <ToastPrimitive.Description className="mt-0.5 text-xs text-chalk leading-relaxed">
              {item.message}
            </ToastPrimitive.Description>
          </div>
          <ToastPrimitive.Close
            className="shrink-0 text-ash hover:text-chalk transition-colors text-xs mt-0.5 cursor-pointer"
            aria-label="Dismiss"
          >
            ✕
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-[360px] max-w-[calc(100vw-2rem)] outline-none list-none m-0 p-0"
      />
    </ToastPrimitive.Provider>
  )
}
