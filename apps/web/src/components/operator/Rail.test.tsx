import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Rail } from "./Rail";

describe("Rail", () => {
  const NAV_LABELS = [
    "Plan",
    "Prep",
    "Live",
    "Bank",
    "Assets",
    "Logs",
    "Screen",
    "Set",
  ];

  it("renders all nav items", () => {
    render(<Rail screen="plan" onScreenChange={() => {}} />);
    for (const label of NAV_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("calls onScreenChange when a nav item is clicked", async () => {
    const user = userEvent.setup();
    const onScreenChange = vi.fn();
    render(<Rail screen="plan" onScreenChange={onScreenChange} />);

    await user.click(screen.getByText("Live"));
    expect(onScreenChange).toHaveBeenCalledWith("live");

    await user.click(screen.getByText("Bank"));
    expect(onScreenChange).toHaveBeenCalledWith("library");
  });

  it("calls onScreenChange with 'settings' when Set is clicked", async () => {
    const user = userEvent.setup();
    const onScreenChange = vi.fn();
    render(<Rail screen="plan" onScreenChange={onScreenChange} />);

    await user.click(screen.getByText("Set"));
    expect(onScreenChange).toHaveBeenCalledWith("settings");
  });

  it("shows accent indicator on the active item", () => {
    const { container } = render(
      <Rail screen="live" onScreenChange={() => {}} />,
    );
    // The active item gets an accent bar span with class bg-accent
    const accentBars = container.querySelectorAll(".bg-accent");
    expect(accentBars.length).toBe(1);
  });

  it("moves accent indicator when screen prop changes", () => {
    const { container, rerender } = render(
      <Rail screen="plan" onScreenChange={() => {}} />,
    );
    let accentBars = container.querySelectorAll(".bg-accent");
    expect(accentBars.length).toBe(1);

    rerender(<Rail screen="settings" onScreenChange={() => {}} />);
    accentBars = container.querySelectorAll(".bg-accent");
    expect(accentBars.length).toBe(1);
  });
});
