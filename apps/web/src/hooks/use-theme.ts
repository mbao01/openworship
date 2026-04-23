import { useCallback, useEffect, useState } from "react";
import { getAudioSettings, setAudioSettings } from "@/lib/commands/settings";
import { getPreset, applyThemeTokens } from "@/lib/themes";
import type { ThemeMode } from "@/lib/types";

export type LayoutMode = "cinematic" | "dense";
export type UIDensity = "normal" | "compact";
export type ContentType = "scripture" | "lyrics" | "slide" | "black";

export interface DisplayPrefs {
  /** Light/dark/system theme. Maps to data-app-theme attribute. */
  appTheme: ThemeMode;
  /** Preset theme ID (e.g. "parchment", "midnight"). */
  preset: string;
  /** Stage layout density. */
  layoutMode: LayoutMode;
  /** UI information density. */
  density: UIDensity;
  /** What the display output shows. */
  contentType: ContentType;
  /** AI queue confidence threshold (40–95). */
  confThreshold: number;
}

const PREFS_KEY = "ow-ui-prefs";
const THEME_KEY = "ow-theme-fallback";

const DEFAULTS: DisplayPrefs = {
  appTheme: "dark",
  preset: "parchment",
  layoutMode: "cinematic",
  density: "normal",
  contentType: "scripture",
  confThreshold: 60,
};

function loadPrefs(): DisplayPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migration: old prefs had "accent" field, no "preset"
      if (!parsed.preset && parsed.accent) {
        parsed.preset = "parchment";
      }
      return { ...DEFAULTS, ...parsed };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULTS };
}

function savePrefs(prefs: DisplayPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    localStorage.setItem(THEME_KEY, prefs.appTheme);
  } catch {
    // ignore
  }
}

/** Resolves "system" theme to actual light/dark based on OS preference. */
function resolveTheme(mode: ThemeMode): "dark" | "light" {
  if (mode === "system") {
    return typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return mode;
}

/**
 * Applies all display preferences to the DOM immediately.
 * Looks up the preset, selects light/dark tokens, and sets all CSS vars.
 */
function applyPrefs(prefs: DisplayPrefs): void {
  const root = document.documentElement;
  const resolved = resolveTheme(prefs.appTheme);

  root.setAttribute("data-app-theme", resolved);
  root.setAttribute("data-layout-mode", prefs.layoutMode);
  root.setAttribute("data-density", prefs.density);

  // Keep .dark class for shadcn compatibility
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // Apply full theme preset tokens
  const preset = getPreset(prefs.preset);
  const tokens = resolved === "dark" ? preset.dark : preset.light;
  applyThemeTokens(tokens);
}

export interface UseThemeReturn extends DisplayPrefs {
  setAppTheme: (v: ThemeMode) => void;
  setPreset: (v: string) => void;
  setLayoutMode: (v: LayoutMode) => void;
  setDensity: (v: UIDensity) => void;
  setContentType: (v: ContentType) => void;
  setConfThreshold: (v: number) => void;
}

/**
 * Manages all display preferences: theme, preset, layout, density, content type.
 *
 * Applies settings immediately via DOM attributes and CSS vars.
 * Persists to localStorage for FOUC prevention and to AudioSettings backend
 * for cross-session persistence.
 */
export function useTheme(): UseThemeReturn {
  const [prefs, setPrefs] = useState<DisplayPrefs>(loadPrefs);

  // On mount: load from backend and apply
  useEffect(() => {
    applyPrefs(prefs);

    getAudioSettings()
      .then((s) => {
        if (s.theme && s.theme !== prefs.appTheme) {
          const next = { ...prefs, appTheme: s.theme };
          setPrefs(next);
          applyPrefs(next);
          savePrefs(next);
        }
      })
      .catch(() => {
        /* use localStorage default */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // OS appearance changes in System mode
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (prefs.appTheme === "system") applyPrefs(prefs);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [prefs]);

  const update = useCallback(
    async (patch: Partial<DisplayPrefs>) => {
      const next = { ...prefs, ...patch };
      setPrefs(next);
      applyPrefs(next);
      savePrefs(next);

      // Persist theme mode to backend
      if (patch.appTheme !== undefined) {
        try {
          const s = await getAudioSettings();
          await setAudioSettings({ ...s, theme: patch.appTheme });
        } catch (e) {
          console.error("[use-theme] failed to persist theme:", e);
        }
      }
    },
    [prefs],
  );

  return {
    ...prefs,
    setAppTheme: (v) => update({ appTheme: v }),
    setPreset: (v) => update({ preset: v }),
    setLayoutMode: (v) => update({ layoutMode: v }),
    setDensity: (v) => update({ density: v }),
    setContentType: (v) => update({ contentType: v }),
    setConfThreshold: (v) => update({ confThreshold: v }),
  };
}
