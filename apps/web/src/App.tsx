import { useEffect, useRef, useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { invoke } from "./lib/tauri";
import type { AudioSettings, ChurchIdentity, ThemeMode } from "./lib/types";
import { OnboardingPage } from "./pages/OnboardingPage";
import { OperatorPage } from "./pages/OperatorPage";
import { DisplayPage } from "./pages/DisplayPage";
import { ArtifactsPage } from "./pages/ArtifactsPage";
import { SpeakerPage } from "./pages/SpeakerPage";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./styles/global.css";

// Apply "dark" class to <html> based on the effective theme.
// In System mode, we read prefers-color-scheme; the caller updates this live.
function applyThemeClass(isDark: boolean) {
  if (isDark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

function resolveIsDark(mode: ThemeMode, systemPrefersDark: boolean): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return systemPrefersDark;
}

// Eagerly apply a sane default before React mounts to avoid FOUC.
// We can't read settings.json synchronously, so we bootstrap from
// localStorage as a fast fallback (overwritten once settings load).
// Guard for jsdom / SSR environments that don't implement matchMedia.
const THEME_FALLBACK_KEY = "ow-theme-fallback";
(function bootstrapTheme() {
  const fallback = localStorage.getItem(THEME_FALLBACK_KEY) as ThemeMode | null;
  const systemDark = typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;
  applyThemeClass(resolveIsDark(fallback ?? "system", systemDark));
})();

function AppInner() {
  const navigate = useNavigate();
  const [identity, setIdentity] = useState<ChurchIdentity | null | undefined>(null);
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const systemDarkRef = useRef(
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false
  );

  // Subscribe to OS appearance changes for System mode.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      systemDarkRef.current = e.matches;
      setThemeState((prev) => {
        if (prev === "system") applyThemeClass(e.matches);
        return prev;
      });
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Load identity and initial theme from persisted settings.
  useEffect(() => {
    invoke<ChurchIdentity | null>("get_identity")
      .then((id) => setIdentity(id ?? undefined))
      .catch((e) => {
        console.error("[app] failed to load identity:", e);
        setIdentity(undefined);
      });

    invoke<AudioSettings>("get_audio_settings")
      .then((s) => {
        const mode = s.theme ?? "system";
        setThemeState(mode);
        applyThemeClass(resolveIsDark(mode, systemDarkRef.current));
        localStorage.setItem(THEME_FALLBACK_KEY, mode);
      })
      .catch(() => {/* use bootstrap default */});
  }, []);

  const handleSetTheme = async (mode: ThemeMode) => {
    setThemeState(mode);
    applyThemeClass(resolveIsDark(mode, systemDarkRef.current));
    localStorage.setItem(THEME_FALLBACK_KEY, mode);
    try {
      const current = await invoke<AudioSettings>("get_audio_settings");
      await invoke("set_audio_settings", { settings: { ...current, theme: mode } });
    } catch (e) {
      console.error("[app] failed to persist theme:", e);
    }
  };

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
              theme={theme}
              onSetTheme={handleSetTheme}
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
    </TooltipProvider>
  );
}

export default App;
