import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { subscribeToToasts, toast, toastError, type ToastItem } from "./toast";

// The toast module maintains module-level state (handlers, counter).
// Tests must unsubscribe their handlers after each test to avoid pollution.

describe("toast", () => {
  let unsubscribe: (() => void) | null = null;
  const received: ToastItem[] = [];

  beforeEach(() => {
    received.length = 0;
    unsubscribe = subscribeToToasts((item) => received.push(item));
  });

  afterEach(() => {
    unsubscribe?.();
    unsubscribe = null;
  });

  it("toast.error emits an error toast", () => {
    toast.error("Something went wrong");
    expect(received).toHaveLength(1);
    expect(received[0].variant).toBe("error");
    expect(received[0].message).toBe("Something went wrong");
  });

  it("toast.success emits a success toast", () => {
    toast.success("Saved!");
    expect(received[0].variant).toBe("success");
    expect(received[0].message).toBe("Saved!");
  });

  it("toast.info emits an info toast", () => {
    toast.info("Did you know...");
    expect(received[0].variant).toBe("info");
    expect(received[0].message).toBe("Did you know...");
  });

  it("each toast gets a unique id", () => {
    toast.error("A");
    toast.error("B");
    expect(received[0].id).not.toBe(received[1].id);
  });

  it("multiple subscribers each receive the toast", () => {
    const second: ToastItem[] = [];
    const unsub2 = subscribeToToasts((item) => second.push(item));
    toast.info("hello");
    expect(received).toHaveLength(1);
    expect(second).toHaveLength(1);
    unsub2();
  });

  it("unsubscribed handler no longer receives toasts", () => {
    const extra: ToastItem[] = [];
    const unsub = subscribeToToasts((item) => extra.push(item));
    toast.success("before");
    expect(extra).toHaveLength(1);
    unsub();
    toast.success("after");
    expect(extra).toHaveLength(1); // no new items
  });
});

describe("toastError", () => {
  let received: ToastItem[] = [];
  let unsubscribe: () => void;

  beforeEach(() => {
    received = [];
    unsubscribe = subscribeToToasts((item) => received.push(item));
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    unsubscribe();
    vi.restoreAllMocks();
  });

  it("emits error toast with fallback message for non-string errors", () => {
    const handler = toastError("Failed to save");
    handler(null);
    expect(received[0].variant).toBe("error");
    expect(received[0].message).toBe("Failed to save");
  });

  it("uses string error message directly", () => {
    toastError("fallback")("Something bad");
    expect(received[0].message).toBe("Something bad");
  });

  it("strips Error type prefix from string", () => {
    toastError("fallback")("TypeError: invalid input");
    expect(received[0].message).toBe("invalid input");
  });

  it("uses Error.message when passed an Error instance", () => {
    toastError("fallback")(new Error("disk full"));
    expect(received[0].message).toBe("disk full");
  });

  it("strips Error type prefix from Error.message", () => {
    const err = new Error("TypeError: bad value");
    toastError("fallback")(err);
    expect(received[0].message).toBe("bad value");
  });

  it("truncates messages longer than 120 chars", () => {
    const longMsg = "a".repeat(130);
    toastError("fallback")(longMsg);
    expect(received[0].message).toHaveLength(121); // 120 + '…'
    expect(received[0].message.endsWith("…")).toBe(true);
  });

  it("logs the original error to console.error", () => {
    const err = new Error("oops");
    toastError("fallback")(err);
    expect(console.error).toHaveBeenCalledWith(err);
  });
});
