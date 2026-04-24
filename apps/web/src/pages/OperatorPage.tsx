import { useCallback, useEffect, useState } from "react";
import type { ChurchIdentity, DetectionMode } from "../lib/types";
import { useQueue } from "../hooks/use-queue";
import { useTour, startTour } from "../stores/tour-store";
import { seedDemoData } from "../lib/commands/tutorial";
import { Rail } from "../components/operator/Rail";
import { TopBar } from "../components/operator/TopBar";
import { LiveScreen } from "../components/operator/LiveScreen";
import { PlanScreen } from "../components/operator/PlanScreen";
import { PreviewScreen } from "../components/operator/PreviewScreen";
import { LibraryScreen } from "../components/operator/LibraryScreen";
import { LogsScreen } from "../components/operator/LogsScreen";
import { DisplayScreen } from "../components/operator/DisplayScreen";
import { SettingsScreen } from "../components/operator/SettingsScreen";
import { CommandPalette } from "../components/operator/CommandPalette";
import { AssetsScreen } from "../components/operator/AssetsScreen";
import { ErrorBoundary } from "../components/ui/error-boundary";
import { WelcomeModal } from "../components/operator/WelcomeModal";
import { TourOverlay } from "../components/operator/tour/TourOverlay";

interface OperatorPageProps {
  identity: ChurchIdentity;
  /** True when the user just completed onboarding in this session. */
  justOnboarded?: boolean;
  onOpenArtifacts?: () => void;
}

export function OperatorPage({
  identity,
  justOnboarded,
}: OperatorPageProps) {
  const [screen, setScreen] = useState("live");
  const [mode, setMode] = useState<DetectionMode>("copilot");
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { queue, approve } = useQueue();

  const { loading: tutorialLoading, tutorialState } = useTour();

  // True once the welcome modal has been dismissed in this session.
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  // Show the welcome modal once right after onboarding if the tour hasn't started.
  const showWelcomeModal =
    justOnboarded === true &&
    !tutorialLoading &&
    tutorialState === "not_started" &&
    !welcomeDismissed;

  // Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdkOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleCloseCmdK = useCallback(() => setCmdkOpen(false), []);
  const handlePush = useCallback(() => {
    const first = queue[0];
    if (first) approve(first.id).catch((err) => console.error(err));
  }, [queue, approve]);

  // When Rail selects "settings", open the modal instead of switching screens
  const handleScreenChange = useCallback((s: string) => {
    if (s === "settings") {
      setSettingsOpen(true);
    } else {
      setScreen(s);
    }
  }, []);

  // Welcome modal CTA: "Start the tour"
  const handleStartTour = useCallback(async () => {
    setWelcomeDismissed(true);
    await seedDemoData();
    await startTour();
    setScreen("live");
  }, []);

  // Welcome modal CTA: "Set up later"
  const handleSetUpLater = useCallback(() => {
    setWelcomeDismissed(true);
  }, []);

  // TourOverlay step 5 CTA: open Plan screen and dismiss tour
  const handleOpenPlan = useCallback(() => {
    setScreen("plan");
  }, []);

  return (
    <div
      data-qa="operator-root"
      className="flex h-screen flex-col overflow-hidden bg-bg font-sans text-ink"
    >
      {/* Skip link — visible on focus, hidden otherwise (WCAG 2.4.1) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[500] focus:rounded focus:bg-accent focus:px-3 focus:py-1.5 focus:text-sm focus:font-medium focus:text-accent-foreground"
      >
        Skip to main content
      </a>
      <TopBar
        mode={mode}
        onModeChange={setMode}
        onOpenCmdK={() => setCmdkOpen(true)}
        onPush={handlePush}
      />
      <div className="flex flex-1 overflow-hidden">
        <Rail
          screen={settingsOpen ? "settings" : screen}
          onScreenChange={handleScreenChange}
          onOpenShortcuts={() => setSettingsOpen(true)}
        />
        <main id="main-content" className="relative flex flex-1 overflow-hidden bg-bg" tabIndex={-1}>
          {/* Live screen stays mounted (hidden via CSS) so background video keeps playing */}
          <div className={`flex flex-1 overflow-hidden ${screen !== "live" ? "invisible absolute inset-0" : ""}`}>
            <ErrorBoundary panelName="Live panel">
              <LiveScreen mode={mode} visible={screen === "live"} />
            </ErrorBoundary>
          </div>
          {screen === "plan" && (
            <ErrorBoundary panelName="Plan panel">
              <PlanScreen />
            </ErrorBoundary>
          )}
          {screen === "preview" && (
            <PreviewScreen onGoLive={() => setScreen("live")} />
          )}
          {screen === "library" && <LibraryScreen />}
          {screen === "assets" && (
            <ErrorBoundary panelName="Assets panel">
              <AssetsScreen />
            </ErrorBoundary>
          )}
          {screen === "logs" && <LogsScreen />}
          {screen === "display" && <DisplayScreen />}
        </main>
      </div>
      <SettingsScreen
        identity={identity}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      {cmdkOpen && <CommandPalette onClose={handleCloseCmdK} />}
      {showWelcomeModal && (
        <WelcomeModal
          churchName={identity.church_name}
          onStartTour={handleStartTour}
          onSetUpLater={handleSetUpLater}
        />
      )}
      {/* TourOverlay reads isTourActive from the tour-store; shows/hides itself. */}
      <TourOverlay onOpenPlan={handleOpenPlan} />
    </div>
  );
}
