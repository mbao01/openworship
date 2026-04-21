import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VuMeter } from "./vu-meter";

describe("VuMeter", () => {
  it("renders the default number of bars (10)", () => {
    const { container } = render(<VuMeter level={0.5} />);
    const bars = container.querySelectorAll("[data-slot='vu-meter'] > span");
    expect(bars).toHaveLength(10);
  });

  it("renders a custom number of bars", () => {
    const { container } = render(<VuMeter level={0.5} bars={5} />);
    const bars = container.querySelectorAll("[data-slot='vu-meter'] > span");
    expect(bars).toHaveLength(5);
  });

  it("shows percentage when showPercentage is true", () => {
    render(<VuMeter level={0.2} showPercentage />);
    // level=0.2 boosted by 3x = 0.6 => 60%
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("shows dash when level is 0 and showPercentage is true", () => {
    render(<VuMeter level={0} showPercentage />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("does not show percentage when showPercentage is not set", () => {
    render(<VuMeter level={0.5} />);
    expect(screen.queryByText("%")).not.toBeInTheDocument();
  });

  it("boost amplifies low values (3x multiplier)", () => {
    // level=0.1, boosted = 0.3 => 30%
    render(<VuMeter level={0.1} showPercentage />);
    expect(screen.getByText("30%")).toBeInTheDocument();
  });

  it("clamps boosted value at 100%", () => {
    // level=0.5, boosted = min(1, 1.5) = 1.0 => 100%
    render(<VuMeter level={0.5} showPercentage />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });
});
