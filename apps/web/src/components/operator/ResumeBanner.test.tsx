import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { ResumeBanner } from "./ResumeBanner";

describe("ResumeBanner", () => {
  const onResume = vi.fn();
  const onDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the banner with step number", () => {
    render(<ResumeBanner step={2} onResume={onResume} onDismiss={onDismiss} />);
    expect(screen.getByText(/Tour paused at step 2 of 5/i)).toBeInTheDocument();
  });

  it("renders 'Resume tour' button", () => {
    render(<ResumeBanner step={1} onResume={onResume} onDismiss={onDismiss} />);
    expect(screen.getByRole("button", { name: /resume tour/i })).toBeInTheDocument();
  });

  it("renders dismiss button with aria-label", () => {
    render(<ResumeBanner step={1} onResume={onResume} onDismiss={onDismiss} />);
    expect(
      screen.getByRole("button", { name: /dismiss tour reminder/i }),
    ).toBeInTheDocument();
  });

  it("calls onResume when 'Resume tour' is clicked", () => {
    render(<ResumeBanner step={3} onResume={onResume} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: /resume tour/i }));
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("calls onDismiss when dismiss button is clicked", () => {
    render(<ResumeBanner step={3} onResume={onResume} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss tour reminder/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onResume).not.toHaveBeenCalled();
  });

  it("renders status role for accessibility", () => {
    render(<ResumeBanner step={1} onResume={onResume} onDismiss={onDismiss} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows correct step number for step 5", () => {
    render(<ResumeBanner step={5} onResume={onResume} onDismiss={onDismiss} />);
    expect(screen.getByText(/Tour paused at step 5 of 5/i)).toBeInTheDocument();
  });
});
