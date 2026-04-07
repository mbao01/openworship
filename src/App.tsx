import { useState } from "react";

function App() {
  const [ready, setReady] = useState(false);

  return (
    <main>
      <h1>OpenWorship</h1>
      <p>AI-powered worship display — coming soon.</p>
      <button onClick={() => setReady((r) => !r)}>
        {ready ? "Ready" : "Not ready"}
      </button>
    </main>
  );
}

export default App;
