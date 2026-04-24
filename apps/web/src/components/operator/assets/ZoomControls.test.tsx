import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { ZoomControls } from "./ZoomControls";

const defaultProps = {
  zoom: 100,
  minZoom: 25,
  maxZoom: 200,
  zoomStep: 25,
  onZoomIn: vi.fn(),
  onZoomOut: vi.fn(),
  onZoomReset: vi.fn(),
  onZoomChange: vi.fn(),
};

describe("ZoomControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the current zoom percentage", () => {
    render(<ZoomControls {...defaultProps} zoom={75} />);
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("calls onZoomIn when + button is clicked", () => {
    render(<ZoomControls {...defaultProps} />);
    // Find zoom in button (PlusIcon) - it's not at max
    const buttons = screen.getAllByRole("button");
    // onZoomIn is the second button (index 1)
    fireEvent.click(buttons[1]);
    expect(defaultProps.onZoomIn).toHaveBeenCalledTimes(1);
  });

  it("calls onZoomOut when - button is clicked", () => {
    render(<ZoomControls {...defaultProps} />);
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);
    expect(defaultProps.onZoomOut).toHaveBeenCalledTimes(1);
  });

  it("calls onZoomReset when reset button is clicked", () => {
    render(<ZoomControls {...defaultProps} />);
    fireEvent.click(screen.getByTitle("Reset zoom"));
    expect(defaultProps.onZoomReset).toHaveBeenCalledTimes(1);
  });

  it("disables zoom-out when at minZoom", () => {
    render(<ZoomControls {...defaultProps} zoom={25} minZoom={25} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toBeDisabled();
  });

  it("disables zoom-in when at maxZoom", () => {
    render(<ZoomControls {...defaultProps} zoom={200} maxZoom={200} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[1]).toBeDisabled();
  });

  it("calls onZoomChange when range slider changes", () => {
    render(<ZoomControls {...defaultProps} />);
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "150" } });
    expect(defaultProps.onZoomChange).toHaveBeenCalledWith(150);
  });

  it("renders the range slider with correct min/max", () => {
    render(<ZoomControls {...defaultProps} minZoom={50} maxZoom={300} />);
    const slider = screen.getByRole("slider");
    expect(slider).toHaveAttribute("min", "50");
    expect(slider).toHaveAttribute("max", "300");
  });
});
