import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TopBar } from "./TopBar";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue("copilot"),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("../../lib/commands/audio", () => ({
  getAudioLevel: vi.fn().mockResolvedValue(0),
  startStt: vi.fn().mockResolvedValue(undefined),
  stopStt: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/commands/settings", () => ({
  getAudioSettings: vi
    .fn()
    .mockResolvedValue({ audio_input_device: "Test Mic" }),
  getEmailSettings: vi.fn().mockResolvedValue({}),
}));

const mockToastError = vi.fn(() => vi.fn());

vi.mock("../../lib/toast", () => ({
  toastError: mockToastError,
}));

describe("TopBar", () => {
  const defaultProps = {
    mode: "copilot" as const,
    onModeChange: vi.fn(),
    onOpenCmdK: vi.fn(),
    onPush: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all mode buttons", () => {
    render(<TopBar {...defaultProps} />);
    expect(screen.getByText("Auto")).toBeInTheDocument();
    expect(screen.getByText("Copilot")).toBeInTheDocument();
    expect(screen.getByText("Airplane")).toBeInTheDocument();
    expect(screen.getByText("Offline")).toBeInTheDocument();
  });

  it("renders the search button with cmd-K shortcut", () => {
    render(<TopBar {...defaultProps} />);
    expect(screen.getByText("Search")).toBeInTheDocument();
  });

  it("calls onOpenCmdK when search button is clicked", async () => {
    const user = userEvent.setup();
    render(<TopBar {...defaultProps} />);

    await user.click(screen.getByText("Search"));
    expect(defaultProps.onOpenCmdK).toHaveBeenCalledOnce();
  });

  it("renders the Push button and calls onPush when clicked", async () => {
    const user = userEvent.setup();
    render(<TopBar {...defaultProps} />);

    const pushButton = screen.getByText("Push");
    expect(pushButton).toBeInTheDocument();

    await user.click(pushButton);
    expect(defaultProps.onPush).toHaveBeenCalledOnce();
  });

  it("renders the clock with 'Service' label", () => {
    render(<TopBar {...defaultProps} />);
    expect(screen.getByText("Service")).toBeInTheDocument();
  });

  it("renders brand name", () => {
    render(<TopBar {...defaultProps} />);
    expect(screen.getByText("openworship")).toBeInTheDocument();
  });

  it("does not show a toast when startup invoke calls fail", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const { getAudioSettings } = await import("../../lib/commands/settings");
    vi.mocked(invoke).mockRejectedValueOnce(new Error("backend not ready"));
    vi.mocked(getAudioSettings).mockRejectedValueOnce(
      new Error("backend not ready"),
    );

    render(<TopBar {...defaultProps} />);

    // Give async effects time to settle
    await waitFor(() => {
      expect(mockToastError).not.toHaveBeenCalled();
    });
  });
});
