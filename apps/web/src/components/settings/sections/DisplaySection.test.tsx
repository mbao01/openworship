import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockOpenOn = vi.fn();
const mockClose = vi.fn();
const mockUseDisplayWindow = vi.fn();

vi.mock("@/hooks/use-display-window", () => ({
  useDisplayWindow: () => mockUseDisplayWindow(),
}));

import { DisplaySection } from "./DisplaySection";

describe("DisplaySection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDisplayWindow.mockReturnValue({
      isOpen: false,
      monitors: [],
      obsUrl: "http://localhost:4000/display",
      openOn: mockOpenOn,
      close: mockClose,
    });
  });

  it("renders the Display heading", () => {
    render(<DisplaySection />);
    expect(screen.getByText("Display")).toBeInTheDocument();
  });

  it("shows no external monitors message when monitors list is empty", () => {
    render(<DisplaySection />);
    expect(screen.getByText(/No external monitors detected/)).toBeInTheDocument();
  });

  it("renders monitor list when monitors are available", () => {
    mockUseDisplayWindow.mockReturnValue({
      isOpen: false,
      monitors: [
        { id: 0, name: "LG Display", width: 1920, height: 1080, is_primary: false },
      ],
      obsUrl: "http://localhost:4000/display",
      openOn: mockOpenOn,
      close: mockClose,
    });

    render(<DisplaySection />);
    expect(screen.getByText(/LG Display/)).toBeInTheDocument();
    expect(screen.getByText("1920×1080")).toBeInTheDocument();
  });

  it("shows close button when display is open", () => {
    mockUseDisplayWindow.mockReturnValue({
      isOpen: true,
      monitors: [
        { id: 0, name: "LG Display", width: 1920, height: 1080, is_primary: false },
      ],
      obsUrl: "http://localhost:4000/display",
      openOn: mockOpenOn,
      close: mockClose,
    });

    render(<DisplaySection />);
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
  });

  it("calls openOn when Open button is clicked", async () => {
    const user = userEvent.setup();
    mockUseDisplayWindow.mockReturnValue({
      isOpen: false,
      monitors: [
        { id: 0, name: "LG Display", width: 1920, height: 1080, is_primary: false },
      ],
      obsUrl: "http://localhost:4000/display",
      openOn: mockOpenOn,
      close: mockClose,
    });

    render(<DisplaySection />);
    await user.click(screen.getByRole("button", { name: /open/i }));
    expect(mockOpenOn).toHaveBeenCalledWith(0);
  });

  it("calls close when Close button is clicked", async () => {
    const user = userEvent.setup();
    mockUseDisplayWindow.mockReturnValue({
      isOpen: true,
      monitors: [
        { id: 0, name: "LG Display", width: 1920, height: 1080, is_primary: false },
      ],
      obsUrl: "http://localhost:4000/display",
      openOn: mockOpenOn,
      close: mockClose,
    });

    render(<DisplaySection />);
    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(mockClose).toHaveBeenCalled();
  });

  it("shows OBS section heading", () => {
    render(<DisplaySection />);
    // OBS URL section heading appears in the display settings
    const obsElements = screen.getAllByText(/OBS/i);
    expect(obsElements.length).toBeGreaterThan(0);
  });
});
