import { ScriptureSearch } from "../components/ScriptureSearch";
import "../styles/operator.css";

export function OperatorPage() {
  return (
    <div className="operator-root">
      <header className="operator-titlebar">
        <span className="operator-appname">openworship</span>
      </header>
      <div className="operator-body">
        <div className="operator-panel">
          <h2 className="operator-panel__heading">Scripture Search</h2>
          <ScriptureSearch />
        </div>
      </div>
    </div>
  );
}
