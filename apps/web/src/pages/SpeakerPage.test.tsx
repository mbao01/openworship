import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SpeakerPage } from "./SpeakerPage";

vi.mock("../lib/tauri", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/toast", () => ({
  toastError: () => () => {},
}));

// Stub WebSocket so jsdom doesn't crash
const mockWs = {
  onopen: null as (() => void) | null,
  onmessage: null as ((msg: { data: string }) => void) | null,
  onclose: null as (() => void) | null,
  onerror: null as (() => void) | null,
  close: vi.fn(),
};

vi.stubGlobal(
  "WebSocket",
  vi.fn(() => mockWs),
);

describe("SpeakerPage", () => {
  it('renders "Waiting for sermon notes" when no slide is active', () => {
    render(<SpeakerPage />);
    expect(
      screen.getByText(/Waiting for sermon notes/),
    ).toBeInTheDocument();
  });

  it("renders the SPEAKER NOTES header", () => {
    render(<SpeakerPage />);
    expect(screen.getByText("SPEAKER NOTES")).toBeInTheDocument();
  });

  it("shows connection status", () => {
    render(<SpeakerPage />);
    // Initially not connected (ws hasn't fired onopen)
    expect(screen.getByText(/CONNECTING/)).toBeInTheDocument();
  });

  it("renders prev and next buttons once a slide arrives", async () => {
    render(<SpeakerPage />);

    // Simulate a WebSocket message
    const { onmessage } = mockWs;
    if (onmessage) {
      onmessage({
        data: JSON.stringify({
          kind: "sermon_note",
          reference: "Test Sermon",
          text: "Hello from the sermon.",
          slide_index: 0,
          total_slides: 3,
        }),
      });
    }

    // Now prev/next should appear
    expect(
      await screen.findByRole("button", { name: /Previous slide/ }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /Next slide/ }),
    ).toBeInTheDocument();
  });
});
