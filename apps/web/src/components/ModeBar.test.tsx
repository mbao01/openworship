import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModeBar } from "./ModeBar";

// Mock Tauri invoke — the backend is not running in tests.
vi.mock("../lib/tauri", () => ({
  invoke: vi.fn().mockResolvedValue("auto"),
}));

describe("ModeBar", () => {
  it("renders all four mode buttons", () => {
    render(<ModeBar />);
    expect(screen.getByText("AUTO")).toBeInTheDocument();
    expect(screen.getByText("COPILOT")).toBeInTheDocument();
    expect(screen.getByText("AIRPLANE")).toBeInTheDocument();
    expect(screen.getByText("OFFLINE")).toBeInTheDocument();
  });

  it("marks AUTO as active by default", () => {
    render(<ModeBar />);
    expect(screen.getByText("AUTO")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("COPILOT")).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onModeChange when a button is clicked", async () => {
    const onModeChange = vi.fn();
    const { invoke } = await import("../lib/tauri");
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    render(<ModeBar onModeChange={onModeChange} />);
    fireEvent.click(screen.getByText("COPILOT"));

    // Wait for the async invoke to settle
    await vi.waitFor(() => {
      expect(onModeChange).toHaveBeenCalledWith("copilot");
    });
  });
});
