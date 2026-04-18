import { useCallback, useEffect, useState } from "react";
import type { ChurchIdentity, DetectionMode } from "../lib/types";
import { useQueue } from "../hooks/use-queue";
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
import { ArtifactsPage } from "./ArtifactsPage";

interface OperatorPageProps {
  identity: ChurchIdentity;
  onOpenArtifacts?: () => void;
}

export function OperatorPage({ identity }: OperatorPageProps) {
  const [screen, setScreen] = useState("live");
  const [mode, setMode] = useState<DetectionMode>("copilot");
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { queue, approve } = useQueue();

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
    if (first) approve(first.id).catch(() => {});
  }, [queue, approve]);

  // When Rail selects "settings", open the modal instead of switching screens
  const handleScreenChange = useCallback((s: string) => {
    if (s === "settings") {
      setSettingsOpen(true);
    } else {
      setScreen(s);
    }
  }, []);

  return (
    <div
      data-qa="operator-root"
      className="flex flex-col h-screen bg-bg text-ink font-sans overflow-hidden"
    >
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
        />
        <main className="flex-1 flex overflow-hidden bg-bg">
          {screen === "live" && <LiveScreen mode={mode} />}
          {screen === "plan" && <PlanScreen />}
          {screen === "preview" && (
            <PreviewScreen onGoLive={() => setScreen("live")} />
          )}
          {screen === "library" && <LibraryScreen />}
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
    </div>
  );
}
