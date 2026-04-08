import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { invoke } from "./lib/tauri";
import type { ChurchIdentity } from "./lib/types";
import { OnboardingPage } from "./pages/OnboardingPage";
import { OperatorPage } from "./pages/OperatorPage";
import { DisplayPage } from "./pages/DisplayPage";
import { SpeakerPage } from "./pages/SpeakerPage";
import "./styles/tokens.css";
import "./styles/global.css";

function App() {
  // `null` = not yet loaded, `undefined` = loaded but no identity (→ onboarding)
  const [identity, setIdentity] = useState<ChurchIdentity | null | undefined>(
    null
  );

  useEffect(() => {
    invoke<ChurchIdentity | null>("get_identity")
      .then((id) => setIdentity(id ?? undefined))
      .catch((e) => {
        console.error("[app] failed to load identity:", e);
        setIdentity(undefined);
      });
  }, []);

  // Still loading — render nothing to avoid flash of wrong page.
  if (identity === null) return null;

  return (
    <Routes>
      <Route path="/display" element={<DisplayPage />} />
      <Route path="/speaker" element={<SpeakerPage />} />
      <Route
        path="/"
        element={
          identity === undefined ? (
            <OnboardingPage onComplete={(id) => setIdentity(id)} />
          ) : (
            <OperatorPage identity={identity} />
          )
        }
      />
    </Routes>
  );
}

export default App;
