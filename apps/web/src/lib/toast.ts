export type ToastVariant = "error" | "success" | "info"

export interface ToastItem {
  id: string
  variant: ToastVariant
  message: string
}

type ToastHandler = (item: ToastItem) => void
const handlers: ToastHandler[] = []
let counter = 0

export function subscribeToToasts(fn: ToastHandler): () => void {
  handlers.push(fn)
  return () => {
    const i = handlers.indexOf(fn)
    if (i >= 0) handlers.splice(i, 1)
  }
}

function emit(variant: ToastVariant, message: string) {
  const id = `t${++counter}`
  handlers.forEach((fn) => fn({ id, variant, message }))
}

export const toast = {
  error: (message: string) => emit("error", message),
  success: (message: string) => emit("success", message),
  info: (message: string) => emit("info", message),
}

/** Convert an unknown error to a user-visible string. */
function friendlyMessage(err: unknown, fallback: string): string {
  if (typeof err === "string" && err.length > 0) {
    const msg = err.replace(/^[A-Za-z]+Error:\s*/i, "")
    return msg.length > 120 ? msg.slice(0, 120) + "…" : msg
  }
  if (err instanceof Error) {
    const msg = err.message.replace(/^[A-Za-z]+Error:\s*/i, "")
    return msg.length > 120 ? msg.slice(0, 120) + "…" : msg
  }
  return fallback
}

/** Show an error toast with a contextual label. Strips raw error type prefixes. */
export function toastError(fallback: string): (err: unknown) => void {
  return (err: unknown) => {
    console.error(err)
    toast.error(friendlyMessage(err, fallback))
  }
}
