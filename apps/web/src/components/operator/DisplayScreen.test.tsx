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
  useQueue: () => ({ queue: [], live: null }),
}));

vi.mock("../../lib/commands/display-window", () => ({
  getObsDisplayUrl: vi.fn().mockResolvedValue("http://localhost:7411/display"),
  openDisplayWindow: vi.fn().mockResolvedValue(undefined),
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

  it("renders settings controls (Display URL, Resolution, Background, Safe area)", () => {
    render(<DisplayScreen />);
    expect(screen.getByText("Display URL")).toBeInTheDocument();
    expect(screen.getByText("Resolution")).toBeInTheDocument();
    expect(screen.getByText("Background")).toBeInTheDocument();
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
