import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { DisplayContent } from "./DisplayContent";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue([0, 0, 0, 0]),
}));

describe("DisplayContent – ArtifactImage video streaming", () => {
  it("uses owmedia:// protocol for video artifacts (no blob conversion)", async () => {
    const { invoke: mockInvoke } = await import("@tauri-apps/api/core");

    render(
      <DisplayContent
        content={{
          kind: "custom_slide",
          text: "",
          reference: "sermon.mp4",
          translation: "",
          image_url: "artifact:vid789",
        }}
      />,
    );

    // Video should use owmedia:// protocol directly
    await vi.waitFor(() => {
      const video = document.querySelector("video");
      expect(video).toBeTruthy();
      expect(video!.src).toContain("owmedia://localhost/vid789");
    });

    // read_artifact_bytes should NOT have been called
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "read_artifact_bytes",
      expect.anything(),
    );
  });

  it("uses blob URL for image artifacts", async () => {
    const { invoke: mockInvoke } = await import("@tauri-apps/api/core");
    vi.mocked(mockInvoke).mockResolvedValue([0, 0, 0, 0]);

    render(
      <DisplayContent
        content={{
          kind: "custom_slide",
          text: "",
          reference: "slide.png",
          translation: "",
          image_url: "artifact:img123",
        }}
      />,
    );

    // Image should invoke read_artifact_bytes
    await vi.waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("read_artifact_bytes", {
        id: "img123",
      });
    });
  });
});
