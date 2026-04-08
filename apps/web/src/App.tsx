import { useEffect, useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { invoke } from "./lib/tauri";
import type { ChurchIdentity } from "./lib/types";
import { OnboardingPage } from "./pages/OnboardingPage";
import { OperatorPage } from "./pages/OperatorPage";
import { DisplayPage } from "./pages/DisplayPage";
import { ArtifactsPage } from "./pages/ArtifactsPage";
import { SpeakerPage } from "./pages/SpeakerPage";
import "./styles/global.css";

// Dark-first: apply "dark" class to <html> on load and persist preference.
const THEME_KEY = "ow-theme";
function initTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  // Default to dark if no preference stored.
  if (stored !== "light") {
    document.documentElement.classList.add("dark");
  }
}
initTheme();

function AppInner() {
  const navigate = useNavigate();
  // `null` = not yet loaded, `undefined` = loaded but no identity (→ onboarding)
  const [identity, setIdentity] = useState<ChurchIdentity | null | undefined>(
    null
  );
  const [isDark, setIsDark] = useState(
    () => document.documentElement.classList.contains("dark")
  );

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem(THEME_KEY, "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem(THEME_KEY, "light");
    }
  };

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
        path="/artifacts"
        element={<ArtifactsPage onBack={() => navigate("/")} />}
      />
      <Route
        path="/"
        element={
          identity === undefined ? (
            <OnboardingPage onComplete={(id) => setIdentity(id)} />
          ) : (
            <OperatorPage
              identity={identity}
              onOpenArtifacts={() => navigate("/artifacts")}
              isDark={isDark}
              onToggleTheme={toggleTheme}
            />
          )
        }
      />
    </Routes>
  );
}

function App() {
  return <AppInner />;
}

export default App;
