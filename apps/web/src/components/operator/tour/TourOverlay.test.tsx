import { describe, it, expect, vi, beforeEach } from "vitest";
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
