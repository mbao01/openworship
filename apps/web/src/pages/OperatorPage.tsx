import { useCallback, useEffect, useState } from "react";
import type { ChurchIdentity, DetectionMode } from "../lib/types";
import { Rail } from "../components/operator/Rail";
import { TopBar } from "../components/operator/TopBar";
import { LiveScreen } from "../components/operator/LiveScreen";
import { PlanScreen } from "../components/operator/PlanScreen";
import { PreviewScreen } from "../components/operator/PreviewScreen";
import { LibraryScreen } from "../components/operator/LibraryScreen";
import { ArtifactsScreen } from "../components/operator/ArtifactsScreen";
import { DisplayScreen } from "../components/operator/DisplayScreen";
import { SettingsScreen } from "../components/operator/SettingsScreen";
import { CommandPalette } from "../components/operator/CommandPalette";

interface OperatorPageProps {
  identity: ChurchIdentity;
  onOpenArtifacts?: () => void;
}

export function OperatorPage({ identity }: OperatorPageProps) {
  const [screen, setScreen] = useState("live");
  const [mode, setMode] = useState<DetectionMode>("copilot");
  const [cmdkOpen, setCmdkOpen] = useState(false);

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

  return (
    <div data-qa="operator-root" className="flex flex-col h-screen bg-bg text-ink font-sans overflow-hidden">
      <TopBar
        mode={mode}
        onModeChange={setMode}
        onOpenCmdK={() => setCmdkOpen(true)}
      />
      <div className="flex flex-1 overflow-hidden">
        <Rail screen={screen} onScreenChange={setScreen} />
        <main className="flex-1 flex overflow-hidden bg-bg">
          {screen === "live" && <LiveScreen mode={mode} />}
          {screen === "plan" && <PlanScreen />}
          {screen === "preview" && <PreviewScreen />}
          {screen === "library" && <LibraryScreen />}
          {screen === "artifacts" && <ArtifactsScreen />}
          {screen === "display" && <DisplayScreen />}
          {screen === "settings" && <SettingsScreen identity={identity} />}
        </main>
      </div>
      {cmdkOpen && <CommandPalette onClose={handleCloseCmdK} />}
    </div>
  );
}
