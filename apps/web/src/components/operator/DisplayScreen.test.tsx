import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DisplayScreen } from "./DisplayScreen";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("../../hooks/use-queue", () => ({
  useQueue: vi.fn(() => ({ queue: [], live: null })),
}));

vi.mock("../../hooks/use-display-window", () => ({
  useDisplayWindow: () => ({
    isOpen: false,
    monitors: [],
    obsUrl: "http://localhost:7411/display",
    openOn: vi.fn(),
    close: vi.fn(),
  }),
}));

vi.mock("@/lib/commands/detection", () => ({
  getQueue: vi.fn().mockResolvedValue([]),
}));

describe("DisplayScreen", () => {
  it("renders the 'Output . display' heading", () => {
    render(<DisplayScreen />);
    expect(screen.getByText("Output")).toBeInTheDocument();
    expect(screen.getByText(/· display/)).toBeInTheDocument();
  });

  it("renders the 'Output settings' section heading", () => {
    render(<DisplayScreen />);
    expect(screen.getByText("Output settings")).toBeInTheDocument();
  });

  it("renders settings controls (Display output, Display URL, Safe area)", () => {
    render(<DisplayScreen />);
    expect(screen.getByText("Display output")).toBeInTheDocument();
    expect(screen.getByText("Display URL")).toBeInTheDocument();
    expect(screen.getByText("Safe area")).toBeInTheDocument();
  });

  it("renders the 'Open on projector' button", () => {
    render(<DisplayScreen />);
    expect(screen.getByText("Open on projector")).toBeInTheDocument();
  });

  it("shows 'no content on screen' when nothing is live", () => {
    render(<DisplayScreen />);
    expect(screen.getByText(/no content on screen/)).toBeInTheDocument();
  });
});

describe("AssetPreview (owmedia:// protocol)", () => {
  it("uses owmedia:// protocol for video artifacts", async () => {
    const { invoke: mockInvoke } = await import("@tauri-apps/api/core");

    vi.mocked(mockInvoke).mockResolvedValue(undefined);

    // Mock useQueue to return a live item with a video artifact
    const { useQueue } = await import("../../hooks/use-queue");
    vi.mocked(useQueue).mockReturnValue({
      queue: [],
      live: {
        id: "q1",
        text: "",
        reference: "worship.mp4",
        translation: "",
        image_url: "artifact:abc123",
      },
    } as unknown as ReturnType<typeof useQueue>);

    render(<DisplayScreen />);

    // Video should use owmedia:// protocol, NOT invoke read_artifact_bytes
    await vi.waitFor(() => {
      const video = document.querySelector("video");
      expect(video).toBeTruthy();
      expect(video!.src).toContain("owmedia://localhost/abc123");
    });

    // read_artifact_bytes should NOT have been called for the video
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "read_artifact_bytes",
      expect.anything(),
    );
  });

  it("uses owmedia:// protocol for image artifacts (no blob)", async () => {
    const { invoke: mockInvoke } = await import("@tauri-apps/api/core");

    vi.mocked(mockInvoke).mockResolvedValue(undefined);

    const { useQueue } = await import("../../hooks/use-queue");
    vi.mocked(useQueue).mockReturnValue({
      queue: [],
      live: {
        id: "q2",
        text: "",
        reference: "slide.png",
        translation: "",
        image_url: "artifact:img456",
      },
    } as unknown as ReturnType<typeof useQueue>);

    render(<DisplayScreen />);

    // Image should use owmedia:// protocol, NOT invoke read_artifact_bytes
    await vi.waitFor(() => {
      const img = document.querySelector("img");
      expect(img).toBeTruthy();
      expect(img!.src).toContain("owmedia://localhost/img456");
    });

    expect(mockInvoke).not.toHaveBeenCalledWith(
      "read_artifact_bytes",
      expect.anything(),
    );
  });
});
