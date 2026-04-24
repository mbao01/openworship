import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TourOverlay } from "./TourOverlay";
import {
  startTour,
  dismissTour,
  resetTour,
  goToStep,
  hideExitConfirm,
} from "../../../stores/tour-store";

// Mock createPortal to render inline in tests
vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
  return {
    ...actual,
    createPortal: (children: React.ReactNode) => children,
  };
});

beforeEach(async () => {
  await resetTour();
  hideExitConfirm();
});

describe("TourOverlay", () => {
  it("renders nothing when tour is not active", () => {
    const { container } = render(<TourOverlay />);
    expect(container.querySelector("[role='dialog']")).toBeNull();
  });

  it("renders the step dialog when tour is started", async () => {
    await startTour();
    const { container } = render(<TourOverlay />);
    expect(container.querySelector("[role='dialog']")).not.toBeNull();
  });

  it("shows step 1 copy", async () => {
    await startTour();
    const { getByRole } = render(<TourOverlay />);
    const dialog = getByRole("dialog", { name: /Tour step 1 of 5/i });
    expect(dialog.textContent).toContain("This is your stage");
  });

  it("shows step 2 copy", async () => {
    await goToStep(2);
    const { getByRole } = render(<TourOverlay />);
    const dialog = getByRole("dialog", { name: /Tour step 2 of 5/i });
    expect(dialog.textContent).toContain("Search for any Bible verse");
  });

  it("advances to step 2 on Next click", async () => {
    await startTour();
    const user = userEvent.setup();
    const { getByRole } = render(<TourOverlay />);

    const nextBtn = getByRole("button", { name: /Next/i });
    await user.click(nextBtn);

    expect(getByRole("dialog", { name: /Tour step 2 of 5/i })).not.toBeNull();
  });

  it("shows exit alertdialog on Skip tour click", async () => {
    await startTour();
    const user = userEvent.setup();
    const { getByRole } = render(<TourOverlay />);

    await user.click(getByRole("button", { name: /Skip tour/i }));

    expect(getByRole("alertdialog")).not.toBeNull();
  });

  it("dismisses tour on 'Exit tour' confirm", async () => {
    await startTour();
    const user = userEvent.setup();
    const { getByRole, queryByRole } = render(<TourOverlay />);

    await user.click(getByRole("button", { name: /Skip tour/i }));
    await user.click(getByRole("button", { name: /Exit tour/i }));

    expect(queryByRole("dialog")).toBeNull();
  });

  it("cancels exit on 'Stay in tour' click", async () => {
    await startTour();
    const user = userEvent.setup();
    const { getByRole, queryByRole } = render(<TourOverlay />);

    await user.click(getByRole("button", { name: /Skip tour/i }));
    await user.click(getByRole("button", { name: /Stay in tour/i }));

    expect(queryByRole("alertdialog")).toBeNull();
    expect(getByRole("dialog")).not.toBeNull();
  });

  it("shows exit confirm on ESC keydown", async () => {
    await startTour();
    const user = userEvent.setup();
    const { getByRole } = render(<TourOverlay />);

    await user.keyboard("{Escape}");
    expect(getByRole("alertdialog")).not.toBeNull();
  });

  it("progress dot group has aria-label Step N of 5", async () => {
    await goToStep(3);
    const { getByRole } = render(<TourOverlay />);
    expect(getByRole("group", { name: /Step 3 of 5/i })).not.toBeNull();
  });

  it("calls onOpenPlan when step 5 primary button clicked", async () => {
    const onOpenPlan = vi.fn();
    await goToStep(5);
    const user = userEvent.setup();
    const { getByRole } = render(<TourOverlay onOpenPlan={onOpenPlan} />);

    await user.click(getByRole("button", { name: /Open Plan/i }));
    expect(onOpenPlan).toHaveBeenCalledOnce();
  });

  it("auto-advances from step 2 on tour:scripture-result-appeared", async () => {
    await goToStep(2);
    const { getByRole } = render(<TourOverlay />);

    act(() => {
      window.dispatchEvent(new CustomEvent("tour:scripture-result-appeared"));
    });

    expect(getByRole("dialog", { name: /Tour step 3 of 5/i })).not.toBeNull();
  });

  it("auto-advances from step 3 on tour:scripture-pushed", async () => {
    await goToStep(3);
    const { getByRole } = render(<TourOverlay />);

    act(() => {
      window.dispatchEvent(new CustomEvent("tour:scripture-pushed"));
    });

    expect(getByRole("dialog", { name: /Tour step 4 of 5/i })).not.toBeNull();
  });

  it("renders nothing after tour dismissed", async () => {
    await startTour();
    const { queryByRole } = render(<TourOverlay />);

    act(() => {
      void dismissTour();
    });

    expect(queryByRole("dialog")).toBeNull();
  });
});

// ─── Ghost-type (Step 2) ──────────────────────────────────────────────────────

describe("Ghost-type hint (Step 2)", () => {
  // Helper: create a mock scripture-search-input in the DOM
  let input: HTMLInputElement;

  beforeEach(async () => {
    vi.useFakeTimers();
    await resetTour();
    hideExitConfirm();

    input = document.createElement("input");
    input.setAttribute("data-qa", "scripture-search-input");
    input.placeholder = "Romans 8:38 ...";
    document.body.appendChild(input);
  });

  afterEach(() => {
    document.body.removeChild(input);
    vi.useRealTimers();
  });

  it("animates placeholder char-by-char after 8s idle", async () => {
    await goToStep(2);
    render(<TourOverlay />);

    // Before 8s: placeholder unchanged
    expect(input.placeholder).toBe("Romans 8:38 ...");

    // Advance past the 8s idle timer
    act(() => { vi.advanceTimersByTime(8_000); });

    // Animation should have started — placeholder is being built up
    // After 1 char (80ms per char, 0 ms elapsed yet after idle fires)
    expect(input.placeholder).toBe("J");

    // Advance through all 9 characters of "John 3:16" (9 × 80ms = 720ms)
    act(() => { vi.advanceTimersByTime(9 * 80); });
    expect(input.placeholder).toBe("John 3:16");
  });

  it("executes search after ghost text fully typed + 3s delay", async () => {
    await goToStep(2);
    render(<TourOverlay />);

    const inputEvents: string[] = [];
    input.addEventListener("input", () => inputEvents.push(input.value));

    // 8s idle + 9 chars × 80ms + 3s execute delay
    act(() => { vi.advanceTimersByTime(8_000 + 9 * 80 + 3_000); });

    expect(input.value).toBe("John 3:16");
    expect(inputEvents).toContain("John 3:16");
    expect(input.placeholder).toBe("Romans 8:38 ...");
  });

  it("cancels ghost animation when user types before 8s", async () => {
    await goToStep(2);
    render(<TourOverlay />);

    // Simulate user typing (fires 'input' event)
    act(() => {
      input.value = "Rom";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    // Advance well past all timers
    act(() => { vi.advanceTimersByTime(20_000); });

    // Placeholder should be unchanged — no ghost animation ran
    expect(input.placeholder).toBe("Romans 8:38 ...");
    // Input value was set by the user, not the ghost
    expect(input.value).toBe("Rom");
  });

  it("cancels ghost animation when user presses a key before 8s", async () => {
    await goToStep(2);
    render(<TourOverlay />);

    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "J" }));
    });

    act(() => { vi.advanceTimersByTime(20_000); });

    expect(input.placeholder).toBe("Romans 8:38 ...");
  });

  it("resets 8s idle timer on blur then focus", async () => {
    await goToStep(2);
    render(<TourOverlay />);

    // Advance 6s (still within idle window), then blur
    act(() => { vi.advanceTimersByTime(6_000); });
    act(() => { input.dispatchEvent(new Event("blur", { bubbles: true })); });

    // Advance another 8s from blur — idle timer was cleared on blur, so no animation yet
    act(() => { vi.advanceTimersByTime(8_000); });
    expect(input.placeholder).toBe("Romans 8:38 ...");

    // Focus resets the idle timer — now wait 8s for animation to start
    act(() => { input.dispatchEvent(new Event("focus", { bubbles: true })); });
    act(() => { vi.advanceTimersByTime(8_000); });

    // Animation started: first char should appear
    expect(input.placeholder).toBe("J");
  });

  it("restores placeholder when tour leaves step 2", async () => {
    await goToStep(2);
    render(<TourOverlay />);

    // Start animation — first char fires at 8000, then 1 more at +80ms = "Jo"
    act(() => { vi.advanceTimersByTime(8_000 + 80); });
    expect(input.placeholder).toBe("Jo");

    // Move to step 3 — effect cleanup should restore placeholder
    await act(async () => { await goToStep(3); });

    expect(input.placeholder).toBe("Romans 8:38 ...");
  });
});
