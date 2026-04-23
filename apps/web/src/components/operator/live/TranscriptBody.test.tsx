import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TranscriptBody } from "./TranscriptBody";

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

describe("TranscriptBody", () => {
  it('renders "mic off" when there is no transcript and mic is inactive', () => {
    render(<TranscriptBody micActive={false} />);
    expect(screen.getByText(/mic off/)).toBeInTheDocument();
  });

  it('renders "listening" when mic is active but no transcript', () => {
    render(<TranscriptBody micActive={true} />);
    expect(screen.getByText(/listening/)).toBeInTheDocument();
  });

  it("renders the status message container when no transcript", () => {
    const { container } = render(<TranscriptBody micActive={false} />);
    const statusDiv = container.querySelector(".text-muted.italic");
    expect(statusDiv).toBeTruthy();
    expect(statusDiv?.textContent).toContain("mic off");
  });
});
