import { DetectionQueue } from "../components/DetectionQueue";
import { ModeToolbar } from "../components/ModeToolbar";
import { ScriptureSearch } from "../components/ScriptureSearch";
import { TranscriptPanel } from "../components/TranscriptPanel";
import "../styles/operator.css";

export function OperatorPage() {
  return (
    <div className="operator-root">
      {/* Custom title bar */}
      <header className="operator-titlebar">
        <span className="operator-appname">openworship</span>
      </header>

      {/* Toolbar strip — mode switcher */}
      <ModeToolbar />

      {/* Main layout — three columns */}
      <div className="operator-body">
        {/* Left: Scripture search / content bank */}
        <aside className="operator-col operator-col--left">
          <h2 className="operator-col__heading">CONTENT BANK</h2>
          <ScriptureSearch />
        </aside>

        {/* Center: Live transcript */}
        <main className="operator-col operator-col--center">
          <TranscriptPanel />
        </main>

        {/* Right: Detection queue */}
        <aside className="operator-col operator-col--right">
          <DetectionQueue />
        </aside>
      </div>
    </div>
  );
}
