import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TranscriptPanel } from "./TranscriptPanel";

// Mock Tauri APIs — not available in jsdom.
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

describe("TranscriptPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the transcript heading", () => {
    render(<TranscriptPanel />);
    expect(screen.getByText("LIVE SPEECH TRANSCRIPT")).toBeInTheDocument();
  });

  it("shows START MIC button when idle", () => {
    render(<TranscriptPanel />);
    expect(screen.getByRole("button", { name: /start mic/i })).toBeInTheDocument();
  });

  it("shows idle prompt when not active", () => {
    render(<TranscriptPanel />);
    expect(screen.getByText(/press start mic/i)).toBeInTheDocument();
  });

  it("calls start_stt when START MIC is clicked", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    render(<TranscriptPanel />);
    fireEvent.click(screen.getByRole("button", { name: /start mic/i }));
    expect(invoke).toHaveBeenCalledWith("start_stt");
  });
});
