import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ModeToolbar } from "./ModeToolbar";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

const mockToastError = vi.hoisted(() => vi.fn(() => vi.fn()));
vi.mock("../lib/toast", () => ({
  toastError: mockToastError,
}));

function renderWithProviders(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

describe("ModeToolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue("copilot");
  });

  it("renders a toolbar with four mode buttons", async () => {
    renderWithProviders(<ModeToolbar />);
    await waitFor(() => {
      expect(screen.getByText("AUTO")).toBeInTheDocument();
      expect(screen.getByText("COPILOT")).toBeInTheDocument();
      expect(screen.getByText("AIRPLANE")).toBeInTheDocument();
      expect(screen.getByText("OFFLINE")).toBeInTheDocument();
    });
  });

  it("has the correct aria-label on the toolbar", () => {
    renderWithProviders(<ModeToolbar />);
    expect(screen.getByRole("toolbar", { name: /detection mode/i })).toBeInTheDocument();
  });

  it("loads the current detection mode on mount", async () => {
    mockInvoke.mockResolvedValue("auto");
    renderWithProviders(<ModeToolbar />);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_detection_mode");
    });
  });

  it("calls onModeChange with the loaded mode", async () => {
    mockInvoke.mockResolvedValue("airplane");
    const onModeChange = vi.fn();
    renderWithProviders(<ModeToolbar onModeChange={onModeChange} />);
    await waitFor(() => {
      expect(onModeChange).toHaveBeenCalledWith("airplane");
    });
  });

  it("switches mode when a button is clicked", async () => {
    mockInvoke.mockResolvedValue("copilot");
    renderWithProviders(<ModeToolbar />);
    await waitFor(() => screen.getByText("AUTO"));

    // Click AUTO button
    mockInvoke.mockResolvedValue(undefined);
    fireEvent.click(screen.getByText("AUTO"));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("set_detection_mode", { mode: "auto" });
    });
  });

  it("calls onModeChange when a button is clicked", async () => {
    mockInvoke.mockResolvedValueOnce("copilot").mockResolvedValue(undefined);
    const onModeChange = vi.fn();
    renderWithProviders(<ModeToolbar onModeChange={onModeChange} />);
    await waitFor(() => screen.getByText("OFFLINE"));

    fireEvent.click(screen.getByText("OFFLINE"));
    await waitFor(() => {
      expect(onModeChange).toHaveBeenCalledWith("offline");
    });
  });

  it("marks the active button with aria-pressed=true", async () => {
    mockInvoke.mockResolvedValue("airplane");
    renderWithProviders(<ModeToolbar />);
    await waitFor(() => {
      const airplaneBtn = screen.getByText("AIRPLANE").closest("button");
      expect(airplaneBtn).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("marks inactive buttons with aria-pressed=false", async () => {
    mockInvoke.mockResolvedValue("copilot");
    renderWithProviders(<ModeToolbar />);
    await waitFor(() => {
      const autoBtn = screen.getByText("AUTO").closest("button");
      expect(autoBtn).toHaveAttribute("aria-pressed", "false");
    });
  });

  it("handles load failure gracefully", async () => {
    const mockErrorHandler = vi.fn();
    mockToastError.mockReturnValue(mockErrorHandler);
    mockInvoke.mockRejectedValue(new Error("load failed"));
    renderWithProviders(<ModeToolbar />);
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to load detection mode");
    });
  });

  it("handles set_detection_mode failure gracefully", async () => {
    const mockErrorHandler = vi.fn();
    mockToastError.mockReturnValue(mockErrorHandler);
    mockInvoke
      .mockResolvedValueOnce("copilot")
      .mockRejectedValue(new Error("set failed"));

    renderWithProviders(<ModeToolbar />);
    await waitFor(() => screen.getByText("AUTO"));

    fireEvent.click(screen.getByText("AUTO"));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to change detection mode");
    });
  });
});
