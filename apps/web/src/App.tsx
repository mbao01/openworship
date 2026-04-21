import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { useIdentity } from "./hooks/use-identity";
import { useTheme } from "./hooks/use-theme";
import { OnboardingPage } from "./pages/OnboardingPage";
import { OperatorPage } from "./pages/OperatorPage";
import { DisplayPage } from "./pages/DisplayPage";
import { ArtifactsPage } from "./pages/ArtifactsPage";
import { SpeakerPage } from "./pages/SpeakerPage";
import { SplashScreen } from "./components/SplashScreen";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toast";
import "./styles/global.css";

// FOUC prevention: read localStorage before React mounts, apply theme + preset tokens.
// useTheme() will override this once the backend settings load.
(function bootstrapTheme() {
  try {
    const raw = localStorage.getItem("ow-ui-prefs");
    const prefs = raw ? JSON.parse(raw) : null;
    const theme = prefs?.appTheme ?? "dark";
    const presetId = prefs?.preset ?? "parchment";
    const resolved = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-app-theme", resolved);
    if (resolved === "dark") {
      document.documentElement.classList.add("dark");
    }
    // Apply preset tokens synchronously to avoid flash of wrong colors.
    // Uses dynamic import — if it fails, CSS fallback values in global.css apply.
    import("./lib/themes").then(({ getPreset, applyThemeTokens }) => {
      const preset = getPreset(presetId);
      applyThemeTokens(resolved === "dark" ? preset.dark : preset.light);
    }).catch(() => {});
  } catch {
    document.documentElement.setAttribute("data-app-theme", "dark");
    document.documentElement.classList.add("dark");
  }
})();

function AppInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMainWindow = location.pathname === "/";

  const { identity, loading: identityLoading, setIdentity } = useIdentity();

  // Initialize theme — applies DOM attrs and CSS vars immediately.
  // Called here so theme is active for all child components.
  useTheme();

  const splashDone = !isMainWindow || !identityLoading;

  if (isMainWindow && !splashDone) {
    return (
      <SplashScreen
        isReady={identity !== null && !identityLoading}
        onDone={() => {/* splashDone is computed, not state */}}
      />
    );
  }

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
          identity === null ? (
            // Still loading identity
            <SplashScreen isReady={false} onDone={() => {}} />
          ) : identity === undefined ? (
            <OnboardingPage onComplete={(id) => setIdentity(id)} />
          ) : (
            <OperatorPage
              identity={identity}
              onOpenArtifacts={() => navigate("/artifacts")}
            />
          )
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <TooltipProvider>
      <AppInner />
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
