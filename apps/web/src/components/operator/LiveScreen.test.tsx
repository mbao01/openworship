import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { LiveScreen } from "./LiveScreen";

// Mock all sub-component imports to isolate this thin shell
vi.mock("./live/LibraryPanel", () => ({
  LibraryPanel: () => <div data-testid="library-panel">LibraryPanel</div>,
}));

vi.mock("./live/StagePanel", () => ({
  StagePanel: ({ mode }: { mode: string }) => (
    <div data-testid="stage-panel">StagePanel mode={mode}</div>
  ),
}));

vi.mock("./live/QueueTranscriptPanel", () => ({
  QueueTranscriptPanel: () => (
    <div data-testid="queue-transcript-panel">QueueTranscriptPanel</div>
  ),
}));

describe("LiveScreen", () => {
  it("renders without crashing", () => {
    const { container } = render(<LiveScreen mode="copilot" />);
    expect(container).toBeTruthy();
  });

  it("renders all three sub-panels", () => {
    const { getByText } = render(<LiveScreen mode="copilot" />);
    expect(getByText("LibraryPanel")).toBeInTheDocument();
    expect(getByText(/StagePanel/)).toBeInTheDocument();
    expect(getByText("QueueTranscriptPanel")).toBeInTheDocument();
  });
});
