import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TranscriptBody } from "./TranscriptBody";

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

describe("TranscriptBody", () => {
  it('renders "mic off" when there is no transcript and mic is inactive', () => {
    render(<TranscriptBody />);
    expect(screen.getByText(/mic off/)).toBeInTheDocument();
  });

  it("renders the status message container when no transcript", () => {
    const { container } = render(<TranscriptBody />);
    // The component renders a centered div with mic status text
    const statusDiv = container.querySelector(".text-muted.italic");
    expect(statusDiv).toBeTruthy();
    expect(statusDiv?.textContent).toContain("mic off");
  });
});
