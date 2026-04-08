import { useState } from "react";
import { DetectionQueue } from "../components/DetectionQueue";
import { ModeBar } from "../components/ModeBar";
import { ScriptureSearch } from "../components/ScriptureSearch";
import { TranscriptPanel } from "../components/TranscriptPanel";
import type { OperatingMode } from "../lib/types";
import "../styles/operator.css";

export function OperatorPage() {
  const [mode, setMode] = useState<OperatingMode>("auto");

  return (
    <div className="operator-root">
      <header className="operator-titlebar">
        <span className="operator-appname">openworship</span>
      </header>

      <div className="operator-body">
        {/* Left column — Scripture Search (25%) */}
        <aside className="operator-col operator-col--left">
          <ScriptureSearch />
        </aside>

        {/* Center column — Live transcript (50%) */}
        <main className="operator-col operator-col--center">
          <TranscriptPanel />
        </main>

        {/* Right column — Mode bar + Detection Queue (25%) */}
        <aside className="operator-col operator-col--right" style={{ padding: 0 }}>
          <ModeBar onModeChange={setMode} />
          <DetectionQueue mode={mode} />
        </aside>
      </div>
    </div>
  );
}
