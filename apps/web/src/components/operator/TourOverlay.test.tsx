import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { TourOverlay } from "./TourOverlay";

// In jsdom, document.querySelector for data-qa selectors returns null,
// so TourOverlay always renders the no-rect fallback (centered popover).

describe("TourOverlay", () => {
  const onNext = vi.fn();
  const onSkip = vi.fn();
  const onComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders step 1 title", () => {
    render(<TourOverlay step={1} onNext={onNext} onSkip={onSkip} onComplete={onComplete} />);
    expect(screen.getByText("This is your stage.")).toBeInTheDocument();
  });

  it("renders step 2 title", () => {
    render(<TourOverlay step={2} onNext={onNext} onSkip={onSkip} onComplete={onComplete} />);
    expect(screen.getByText("Search for any Bible verse.")).toBeInTheDocument();
  });

  it("renders step 3 title", () => {
    render(<TourOverlay step={3} onNext={onNext} onSkip={onSkip} onComplete={onComplete} />);
    expect(screen.getByText("Click a result to push it live.")).toBeInTheDocument();
  });

  it("renders step 4 title", () => {
    render(<TourOverlay step={4} onNext={onNext} onSkip={onSkip} onComplete={onComplete} />);
    expect(screen.getByText("The AI listens during service")).toBeInTheDocument();
  });

  it("renders step 5 title", () => {
    render(<TourOverlay step={5} onNext={onNext} onSkip={onSkip} onComplete={onComplete} />);
    expect(screen.getByText("Plan your service in advance.")).toBeInTheDocument();
  });

  it("renders step indicator '1 / 5'", () => {
    render(<TourOverlay step={1} onNext={onNext} onSkip={onSkip} onComplete={onComplete} />);
    expect(screen.getByText("1 / 5")).toBeInTheDocument();
  });

  it("renders step indicator '3 / 5'", () => {
    render(<TourOverlay step={3} onNext={onNext} onSkip={onSkip} onComplete={onComplete} />);
    expect(screen.getByText("3 / 5")).toBeInTheDocument();
  });

  it("renders 'Skip tour' button", () => {
    render(<TourOverlay step={1} onNext={onNext} onSkip={onSkip} onComplete={onComplete} />);
    expect(screen.getByRole("button", { name: /skip tour/i })).toBeInTheDocument();
  });

  it("calls onSkip when 'Skip tour' is clicked", () => {
    render(<TourOverlay step={1} onNext={onNext} onSkip={onSkip} onComplete={onComplete} />);
    fireEvent.click(screen.getByRole("button", { name: /skip tour/i }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("calls onNext when primary 'Next →' button is clicked on step 1", () => {
    render(<TourOverlay step={1} onNext={onNext} onSkip={onSkip} onComplete={onComplete} />);
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("calls onComplete when primary button is clicked on step 5", () => {
    render(<TourOverlay step={5} onNext={onNext} onSkip={onSkip} onComplete={onComplete} />);
    fireEvent.click(screen.getByRole("button", { name: /open plan/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });

  it("shows confirm-exit dialog on Escape key", () => {
    render(<TourOverlay step={1} onNext={onNext} onSkip={onSkip} onComplete={onComplete} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByText("Exit the tour?")).toBeInTheDocument();
  });

  it("calls onSkip when 'Exit tour' is clicked in confirm dialog", () => {
    render(<TourOverlay step={1} onNext={onNext} onSkip={onSkip} onComplete={onComplete} />);
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: /exit tour/i }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("dismisses confirm dialog on 'Stay in tour'", () => {
    render(<TourOverlay step={1} onNext={onNext} onSkip={onSkip} onComplete={onComplete} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByText("Exit the tour?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /stay in tour/i }));
    expect(screen.queryByText("Exit the tour?")).not.toBeInTheDocument();
    expect(screen.getByText("This is your stage.")).toBeInTheDocument();
  });

  it("advances step via Enter key", () => {
    render(<TourOverlay step={1} onNext={onNext} onSkip={onSkip} onComplete={onComplete} />);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("Enter on step 5 calls onComplete", () => {
    render(<TourOverlay step={5} onNext={onNext} onSkip={onSkip} onComplete={onComplete} />);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("renders dialog role", () => {
    render(<TourOverlay step={1} onNext={onNext} onSkip={onSkip} onComplete={onComplete} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders aria-label with step number", () => {
    render(<TourOverlay step={2} onNext={onNext} onSkip={onSkip} onComplete={onComplete} />);
    expect(screen.getByLabelText("Tour step 2 of 5")).toBeInTheDocument();
  });
});
