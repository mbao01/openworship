import { ScriptureSearch } from "../components/ScriptureSearch";
import { TranscriptPanel } from "../components/TranscriptPanel";
import "../styles/operator.css";

export function OperatorPage() {
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

        {/* Right column — Queue (25%) */}
        <aside className="operator-col operator-col--right">
          <h2 className="operator-col__heading">QUEUE</h2>
          <p className="operator-col__empty">No detections.</p>
        </aside>
      </div>
    </div>
  );
}
