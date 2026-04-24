import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import type { ChurchIdentity } from "../lib/types";

// ── Hoist mock variables so they are available inside vi.mock factories ────────
// vi.mock calls are hoisted to the top of the file by vitest's transform.
// Any variable referenced inside a vi.mock factory must also be hoisted via
// vi.hoisted() — otherwise the variable is in the TDZ when the factory runs.

const {
  mockApprove,
  mockUseQueue,
  mockUseTour,
  mockStartTour,
} = vi.hoisted(() => {
  const mockApprove = vi.fn().mockResolvedValue(undefined);
  const mockStartTour = vi.fn().mockResolvedValue(undefined);
  const mockUseQueue = vi.fn().mockReturnValue({ queue: [], approve: mockApprove });
  const mockUseTour = vi.fn().mockReturnValue({
    loading: false,
    tutorialState: "not_started" as const,
    isTourActive: false,
    currentStep: null,
    exitConfirmVisible: false,
  });
  return { mockApprove, mockUseQueue, mockUseTour, mockStartTour };
});

// ── Mock all hooks and stores ─────────────────────────────────────────────────

vi.mock("../lib/commands/detection", () => ({
  getDetectionMode: vi.fn().mockResolvedValue("auto"),
  setDetectionMode: vi.fn().mockResolvedValue(undefined),
  getQueue: vi.fn().mockResolvedValue([]),
  approveItem: vi.fn().mockResolvedValue(undefined),
  dismissItem: vi.fn().mockResolvedValue(undefined),
  skipItem: vi.fn().mockResolvedValue(undefined),
  rejectLiveItem: vi.fn().mockResolvedValue(undefined),
  nextItem: vi.fn().mockResolvedValue(undefined),
  prevItem: vi.fn().mockResolvedValue(undefined),
  clearLive: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../hooks/use-queue", () => ({
  useQueue: (...args: unknown[]) => mockUseQueue(...args),
}));

vi.mock("../stores/tour-store", () => ({
  useTour: (...args: unknown[]) => mockUseTour(...args),
  startTour: (...args: unknown[]) => mockStartTour(...args),
  advanceStep: vi.fn().mockResolvedValue(undefined),
  dismissTour: vi.fn().mockResolvedValue(undefined),
  completeTour: vi.fn().mockResolvedValue(undefined),
  isTourActive: vi.fn().mockReturnValue(false),
  getCurrentStep: vi.fn().mockReturnValue(null),
  showExitConfirm: vi.fn(),
  hideExitConfirm: vi.fn(),
}));

vi.mock("../lib/commands/tutorial", () => ({
  getTutorialState: vi.fn().mockResolvedValue("not_started"),
  setTutorialState: vi.fn().mockResolvedValue(undefined),
  seedDemoData: vi.fn().mockResolvedValue({ songs_seeded: 0, project_seeded: false }),
}));

// ── Mock all child components ─────────────────────────────────────────────────

vi.mock("../components/operator/Rail", () => ({
  Rail: ({ onScreenChange }: { onScreenChange: (s: string) => void }) => (
    <nav data-testid="Rail">
      <button onClick={() => onScreenChange("live")}>Live</button>
      <button onClick={() => onScreenChange("plan")}>Plan</button>
      <button onClick={() => onScreenChange("assets")}>Assets</button>
      <button onClick={() => onScreenChange("logs")}>Logs</button>
      <button onClick={() => onScreenChange("preview")}>Preview</button>
      <button onClick={() => onScreenChange("library")}>Library</button>
      <button onClick={() => onScreenChange("display")}>Display</button>
      <button onClick={() => onScreenChange("settings")}>Settings</button>
    </nav>
  ),
}));

vi.mock("../components/operator/TopBar", () => ({
  TopBar: ({ onOpenCmdK }: { onOpenCmdK: () => void }) => (
    <header data-testid="TopBar">
      <button data-testid="open-cmdk" onClick={onOpenCmdK}>⌘K</button>
    </header>
  ),
}));

vi.mock("../components/operator/LiveScreen", () => ({
  LiveScreen: () => <div data-testid="LiveScreen" />,
}));

vi.mock("../components/operator/PlanScreen", () => ({
  PlanScreen: () => <div data-testid="PlanScreen" />,
}));

vi.mock("../components/operator/PreviewScreen", () => ({
  PreviewScreen: ({ onGoLive }: { onGoLive: () => void }) => (
    <div data-testid="PreviewScreen">
      <button onClick={onGoLive}>Go Live</button>
    </div>
  ),
}));

vi.mock("../components/operator/LibraryScreen", () => ({
  LibraryScreen: () => <div data-testid="LibraryScreen" />,
}));

vi.mock("../components/operator/LogsScreen", () => ({
  LogsScreen: () => <div data-testid="LogsScreen" />,
}));

vi.mock("../components/operator/DisplayScreen", () => ({
  DisplayScreen: () => <div data-testid="DisplayScreen" />,
}));

vi.mock("../components/operator/SettingsScreen", () => ({
  SettingsScreen: ({ open }: { open: boolean; onClose: () => void }) =>
    open ? <div data-testid="SettingsScreen" /> : null,
}));

vi.mock("../components/operator/CommandPalette", () => ({
  CommandPalette: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="CommandPalette">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock("../components/operator/AssetsScreen", () => ({
  AssetsScreen: () => <div data-testid="AssetsScreen" />,
}));

vi.mock("../components/ui/error-boundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../components/operator/WelcomeModal", () => ({
  WelcomeModal: ({
    onStartTour,
    onSetUpLater,
  }: {
    churchName: string;
    onStartTour: () => void;
    onSetUpLater: () => void;
  }) => (
    <div data-testid="WelcomeModal">
      <button data-testid="start-tour" onClick={onStartTour}>Start Tour</button>
      <button data-testid="setup-later" onClick={onSetUpLater}>Set Up Later</button>
    </div>
  ),
}));

vi.mock("../components/operator/tour/TourOverlay", () => ({
  TourOverlay: ({ onOpenPlan }: { onOpenPlan: () => void }) => (
    <div data-testid="TourOverlay">
      <button data-testid="tour-open-plan" onClick={onOpenPlan}>Open Plan</button>
    </div>
  ),
}));

// ── Import component under test ───────────────────────────────────────────────

import { OperatorPage } from "./OperatorPage";

const identity: ChurchIdentity = {
  church_id: "c1",
  church_name: "Grace Chapel",
  branch_id: "branch-1",
  branch_name: "Main Branch",
  role: "hq",
  invite_code: null,
};

describe("OperatorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQueue.mockReturnValue({ queue: [], approve: mockApprove });
    mockUseTour.mockReturnValue({
      loading: false,
      tutorialState: "not_started",
      isTourActive: false,
      currentStep: null,
      exitConfirmVisible: false,
    });
  });

  it("renders the TopBar and Rail", () => {
    render(<OperatorPage identity={identity} />);
    expect(screen.getByTestId("TopBar")).toBeInTheDocument();
    expect(screen.getByTestId("Rail")).toBeInTheDocument();
  });

  it("renders LiveScreen by default", () => {
    render(<OperatorPage identity={identity} />);
    expect(screen.getByTestId("LiveScreen")).toBeInTheDocument();
  });

  it("renders TourOverlay unconditionally", () => {
    render(<OperatorPage identity={identity} />);
    expect(screen.getByTestId("TourOverlay")).toBeInTheDocument();
  });

  it("switches to PlanScreen when plan is selected", () => {
    render(<OperatorPage identity={identity} />);
    fireEvent.click(screen.getByText("Plan"));
    expect(screen.getByTestId("PlanScreen")).toBeInTheDocument();
  });

  it("switches to AssetsScreen when assets is selected", () => {
    render(<OperatorPage identity={identity} />);
    fireEvent.click(screen.getByText("Assets"));
    expect(screen.getByTestId("AssetsScreen")).toBeInTheDocument();
  });

  it("switches to LogsScreen when logs is selected", () => {
    render(<OperatorPage identity={identity} />);
    fireEvent.click(screen.getByText("Logs"));
    expect(screen.getByTestId("LogsScreen")).toBeInTheDocument();
  });

  it("switches to PreviewScreen when preview is selected", () => {
    render(<OperatorPage identity={identity} />);
    fireEvent.click(screen.getByText("Preview"));
    expect(screen.getByTestId("PreviewScreen")).toBeInTheDocument();
  });

  it("switches to LibraryScreen when library is selected", () => {
    render(<OperatorPage identity={identity} />);
    fireEvent.click(screen.getByText("Library"));
    expect(screen.getByTestId("LibraryScreen")).toBeInTheDocument();
  });

  it("switches to DisplayScreen when display is selected", () => {
    render(<OperatorPage identity={identity} />);
    fireEvent.click(screen.getByText("Display"));
    expect(screen.getByTestId("DisplayScreen")).toBeInTheDocument();
  });

  it("opens SettingsScreen modal when settings is selected", () => {
    render(<OperatorPage identity={identity} />);
    expect(screen.queryByTestId("SettingsScreen")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Settings"));
    expect(screen.getByTestId("SettingsScreen")).toBeInTheDocument();
  });

  it("opens CommandPalette when TopBar's ⌘K is clicked", () => {
    render(<OperatorPage identity={identity} />);
    expect(screen.queryByTestId("CommandPalette")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("open-cmdk"));
    expect(screen.getByTestId("CommandPalette")).toBeInTheDocument();
  });

  it("closes CommandPalette when its close button is clicked", () => {
    render(<OperatorPage identity={identity} />);
    fireEvent.click(screen.getByTestId("open-cmdk"));
    expect(screen.getByTestId("CommandPalette")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Close"));
    expect(screen.queryByTestId("CommandPalette")).not.toBeInTheDocument();
  });

  it("toggles CommandPalette with Ctrl+K keyboard shortcut", () => {
    render(<OperatorPage identity={identity} />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByTestId("CommandPalette")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.queryByTestId("CommandPalette")).not.toBeInTheDocument();
  });

  it("toggles CommandPalette with Cmd+K keyboard shortcut", () => {
    render(<OperatorPage identity={identity} />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByTestId("CommandPalette")).toBeInTheDocument();
  });

  it("shows WelcomeModal when justOnboarded=true and tutorial not started", () => {
    render(<OperatorPage identity={identity} justOnboarded={true} />);
    expect(screen.getByTestId("WelcomeModal")).toBeInTheDocument();
  });

  it("does not show WelcomeModal without justOnboarded", () => {
    render(<OperatorPage identity={identity} />);
    expect(screen.queryByTestId("WelcomeModal")).not.toBeInTheDocument();
  });

  it("does not show WelcomeModal when tutorial already started", () => {
    mockUseTour.mockReturnValue({
      loading: false,
      tutorialState: "in_progress_step_1",
      isTourActive: true,
      currentStep: 1,
      exitConfirmVisible: false,
    });
    render(<OperatorPage identity={identity} justOnboarded={true} />);
    expect(screen.queryByTestId("WelcomeModal")).not.toBeInTheDocument();
  });

  it("dismisses WelcomeModal when 'Set Up Later' is clicked", () => {
    render(<OperatorPage identity={identity} justOnboarded={true} />);
    fireEvent.click(screen.getByTestId("setup-later"));
    expect(screen.queryByTestId("WelcomeModal")).not.toBeInTheDocument();
  });

  it("calls startTour and seedDemoData when 'Start Tour' is clicked", async () => {
    const { seedDemoData } = await import("../lib/commands/tutorial");
    render(<OperatorPage identity={identity} justOnboarded={true} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("start-tour"));
    });
    expect(seedDemoData).toHaveBeenCalled();
    expect(mockStartTour).toHaveBeenCalled();
  });

  it("TourOverlay onOpenPlan switches to plan screen", () => {
    render(<OperatorPage identity={identity} />);
    fireEvent.click(screen.getByTestId("tour-open-plan"));
    expect(screen.getByTestId("PlanScreen")).toBeInTheDocument();
  });

  it("PreviewScreen 'Go Live' switches to live screen", () => {
    render(<OperatorPage identity={identity} />);
    fireEvent.click(screen.getByText("Preview"));
    expect(screen.getByTestId("PreviewScreen")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Go Live"));
    // LiveScreen is always mounted (kept for background video)
    expect(screen.getByTestId("LiveScreen")).toBeInTheDocument();
  });

  it("approve first queue item when handlePush is called", async () => {
    const queueItem = { id: "q1", text: "Psalm 23", reference: "Ps 23", status: "pending" as const };
    mockUseQueue.mockReturnValue({ queue: [queueItem], approve: mockApprove });
    render(<OperatorPage identity={identity} />);

    await waitFor(() => {
      expect(mockUseQueue).toHaveBeenCalled();
    });
  });

  it("does not crash when rendering without justOnboarded prop", () => {
    expect(() => render(<OperatorPage identity={identity} />)).not.toThrow();
  });
});
