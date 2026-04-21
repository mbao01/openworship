/**
 * Preset theme definitions for the OpenWorship app.
 *
 * Each theme provides a complete set of CSS custom property values
 * for both dark and light modes. The theme hook applies these at runtime.
 */

export interface ThemeTokens {
  bg: string;
  bg1: string;
  bg2: string;
  bg3: string;
  bg4: string;
  line: string;
  lineStrong: string;
  ink: string;
  ink2: string;
  ink3: string;
  muted: string;
  accent: string;
  accentSoft: string;
  accentHover: string;
  accentForeground: string;
  danger: string;
  success: string;
  live: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  dark: ThemeTokens;
  light: ThemeTokens;
}

// ─── Parchment (default) ────────────────────────────────────────────────────

const parchment: ThemePreset = {
  id: "parchment",
  name: "Parchment",
  description: "Warm aged-paper feel with copper gold accents",
  dark: {
    bg: "#0E0D0B",
    bg1: "#131210",
    bg2: "#1A1814",
    bg3: "#211E19",
    bg4: "#2A2620",
    line: "rgba(232,223,207,0.08)",
    lineStrong: "rgba(232,223,207,0.16)",
    ink: "#F2EDE2",
    ink2: "#CFC7B6",
    ink3: "#8A8175",
    muted: "#5E574D",
    accent: "#C9A76A",
    accentSoft: "rgba(201,167,106,0.12)",
    accentHover: "#D9B879",
    accentForeground: "#1A0D00",
    danger: "#D26060",
    success: "#8AB67B",
    live: "#E05454",
  },
  light: {
    bg: "#F5F1E8",
    bg1: "#EFE9DB",
    bg2: "#E8E2D2",
    bg3: "#DDD4BF",
    bg4: "#CFC3A8",
    line: "rgba(26,23,20,0.10)",
    lineStrong: "rgba(26,23,20,0.22)",
    ink: "#1A1714",
    ink2: "#3A332C",
    ink3: "#6B6259",
    muted: "#7A7064",
    accent: "#6B4423",
    accentSoft: "rgba(107,68,35,0.10)",
    accentHover: "#8A5A32",
    accentForeground: "#FFF8EE",
    danger: "#C04040",
    success: "#5A8F4E",
    live: "#D03838",
  },
};

// ─── Midnight ───────────────────────────────────────────────────────────────

const midnight: ThemePreset = {
  id: "midnight",
  name: "Midnight",
  description: "Deep navy with cool blue accents — modern and serene",
  dark: {
    bg: "#0B0E14",
    bg1: "#0F1319",
    bg2: "#151A22",
    bg3: "#1C222D",
    bg4: "#242B38",
    line: "rgba(180,200,230,0.08)",
    lineStrong: "rgba(180,200,230,0.16)",
    ink: "#E2E8F0",
    ink2: "#B0BDD0",
    ink3: "#7082A0",
    muted: "#4E5D78",
    accent: "#6B8ACD",
    accentSoft: "rgba(107,138,205,0.12)",
    accentHover: "#83A0DD",
    accentForeground: "#0A0E18",
    danger: "#D26060",
    success: "#6BAF7C",
    live: "#E05454",
  },
  light: {
    bg: "#F0F4FA",
    bg1: "#E8EDF5",
    bg2: "#DFE5EF",
    bg3: "#D0D8E6",
    bg4: "#BFC9DB",
    line: "rgba(20,30,50,0.10)",
    lineStrong: "rgba(20,30,50,0.20)",
    ink: "#1A2035",
    ink2: "#334060",
    ink3: "#5A6888",
    muted: "#7A86A0",
    accent: "#3B5998",
    accentSoft: "rgba(59,89,152,0.10)",
    accentHover: "#4B6DB0",
    accentForeground: "#FFFFFF",
    danger: "#C04040",
    success: "#4A8A5A",
    live: "#D03838",
  },
};

// ─── Rose Garden ────────────────────────────────────────────────────────────

const roseGarden: ThemePreset = {
  id: "rose-garden",
  name: "Rose Garden",
  description: "Warm blush and dusty rose — soft, inviting elegance",
  dark: {
    bg: "#120D0E",
    bg1: "#171112",
    bg2: "#1E1618",
    bg3: "#271D20",
    bg4: "#302529",
    line: "rgba(230,200,210,0.08)",
    lineStrong: "rgba(230,200,210,0.16)",
    ink: "#F2E8EA",
    ink2: "#D4C0C6",
    ink3: "#9A8088",
    muted: "#6E5960",
    accent: "#C27A8A",
    accentSoft: "rgba(194,122,138,0.12)",
    accentHover: "#D48E9C",
    accentForeground: "#1A0A0E",
    danger: "#D26060",
    success: "#8AB67B",
    live: "#E05454",
  },
  light: {
    bg: "#FAF0F2",
    bg1: "#F4E8EC",
    bg2: "#EDDFE4",
    bg3: "#E2D2D8",
    bg4: "#D4C0C8",
    line: "rgba(45,26,31,0.10)",
    lineStrong: "rgba(45,26,31,0.20)",
    ink: "#2D1A1F",
    ink2: "#4A2E38",
    ink3: "#7A5A65",
    muted: "#9A7A85",
    accent: "#A85568",
    accentSoft: "rgba(168,85,104,0.10)",
    accentHover: "#C06878",
    accentForeground: "#FFFFFF",
    danger: "#C04040",
    success: "#5A8F4E",
    live: "#D03838",
  },
};

// ─── Evergreen ──────────────────────────────────────────────────────────────

const evergreen: ThemePreset = {
  id: "evergreen",
  name: "Evergreen",
  description: "Deep forest tones with sage accents — natural, grounded",
  dark: {
    bg: "#0A0E0B",
    bg1: "#0E1310",
    bg2: "#141A16",
    bg3: "#1B221D",
    bg4: "#232C26",
    line: "rgba(180,220,190,0.08)",
    lineStrong: "rgba(180,220,190,0.16)",
    ink: "#E2EDE4",
    ink2: "#B4CCBA",
    ink3: "#729880",
    muted: "#50705A",
    accent: "#6BAF7C",
    accentSoft: "rgba(107,175,124,0.12)",
    accentHover: "#82C292",
    accentForeground: "#081008",
    danger: "#D26060",
    success: "#6BAF7C",
    live: "#E05454",
  },
  light: {
    bg: "#F0F5F1",
    bg1: "#E6EDE8",
    bg2: "#DCE5DE",
    bg3: "#CDD8D0",
    bg4: "#BAC9BE",
    line: "rgba(20,32,24,0.10)",
    lineStrong: "rgba(20,32,24,0.20)",
    ink: "#142018",
    ink2: "#2A3E30",
    ink3: "#506858",
    muted: "#6E8A76",
    accent: "#3D7A4F",
    accentSoft: "rgba(61,122,79,0.10)",
    accentHover: "#4E9062",
    accentForeground: "#FFFFFF",
    danger: "#C04040",
    success: "#3D7A4F",
    live: "#D03838",
  },
};

// ─── Slate ──────────────────────────────────────────────────────────────────

const slate: ThemePreset = {
  id: "slate",
  name: "Slate",
  description: "Neutral cool grays — clean, professional, minimal",
  dark: {
    bg: "#111214",
    bg1: "#161719",
    bg2: "#1C1D20",
    bg3: "#242528",
    bg4: "#2D2E32",
    line: "rgba(200,200,210,0.08)",
    lineStrong: "rgba(200,200,210,0.16)",
    ink: "#E4E5E9",
    ink2: "#B8BAC2",
    ink3: "#7C7F8A",
    muted: "#5A5D68",
    accent: "#8B8FA3",
    accentSoft: "rgba(139,143,163,0.12)",
    accentHover: "#A0A4B5",
    accentForeground: "#111214",
    danger: "#D26060",
    success: "#7BAA7B",
    live: "#E05454",
  },
  light: {
    bg: "#F4F5F7",
    bg1: "#ECEDF0",
    bg2: "#E3E4E8",
    bg3: "#D5D6DC",
    bg4: "#C4C6CE",
    line: "rgba(28,29,33,0.10)",
    lineStrong: "rgba(28,29,33,0.20)",
    ink: "#1C1D21",
    ink2: "#3A3C44",
    ink3: "#62656F",
    muted: "#8A8D98",
    accent: "#5C6070",
    accentSoft: "rgba(92,96,112,0.10)",
    accentHover: "#6E7285",
    accentForeground: "#FFFFFF",
    danger: "#C04040",
    success: "#508050",
    live: "#D03838",
  },
};

// ─── Amber ──────────────────────────────────────────────────────────────────

const amber: ThemePreset = {
  id: "amber",
  name: "Amber",
  description: "Warm amber and honey — rich, cozy sunset warmth",
  dark: {
    bg: "#0E0C08",
    bg1: "#13110C",
    bg2: "#1A1710",
    bg3: "#221E16",
    bg4: "#2B261D",
    line: "rgba(230,210,170,0.08)",
    lineStrong: "rgba(230,210,170,0.16)",
    ink: "#F0E8D8",
    ink2: "#D0C4A8",
    ink3: "#8E8268",
    muted: "#645A44",
    accent: "#D4A24C",
    accentSoft: "rgba(212,162,76,0.12)",
    accentHover: "#E4B560",
    accentForeground: "#140E02",
    danger: "#D26060",
    success: "#8AB67B",
    live: "#E05454",
  },
  light: {
    bg: "#FAF5EB",
    bg1: "#F2ECDE",
    bg2: "#EAE2D0",
    bg3: "#DDD4BC",
    bg4: "#CCC0A4",
    line: "rgba(31,26,14,0.10)",
    lineStrong: "rgba(31,26,14,0.20)",
    ink: "#1F1A0E",
    ink2: "#3E3520",
    ink3: "#6B5E44",
    muted: "#8A7C62",
    accent: "#9E7424",
    accentSoft: "rgba(158,116,36,0.10)",
    accentHover: "#B88A30",
    accentForeground: "#FFFFFF",
    danger: "#C04040",
    success: "#5A8F4E",
    live: "#D03838",
  },
};

// ─── Export ─────────────────────────────────────────────────────────────────

export const THEME_PRESETS: ThemePreset[] = [
  parchment,
  midnight,
  roseGarden,
  evergreen,
  slate,
  amber,
];

export function getPreset(id: string): ThemePreset {
  return THEME_PRESETS.find((t) => t.id === id) ?? parchment;
}

/**
 * Apply a theme's tokens to the document root as CSS custom properties.
 */
export function applyThemeTokens(tokens: ThemeTokens): void {
  const root = document.documentElement;
  root.style.setProperty("--color-bg", tokens.bg);
  root.style.setProperty("--color-bg-1", tokens.bg1);
  root.style.setProperty("--color-bg-2", tokens.bg2);
  root.style.setProperty("--color-bg-3", tokens.bg3);
  root.style.setProperty("--color-bg-4", tokens.bg4);
  root.style.setProperty("--color-line", tokens.line);
  root.style.setProperty("--color-line-strong", tokens.lineStrong);
  root.style.setProperty("--color-ink", tokens.ink);
  root.style.setProperty("--color-ink-2", tokens.ink2);
  root.style.setProperty("--color-ink-3", tokens.ink3);
  root.style.setProperty("--color-muted", tokens.muted);
  root.style.setProperty("--color-accent", tokens.accent);
  root.style.setProperty("--color-accent-soft", tokens.accentSoft);
  root.style.setProperty("--color-accent-hover", tokens.accentHover);
  root.style.setProperty("--color-accent-foreground", tokens.accentForeground);
  root.style.setProperty("--color-danger", tokens.danger);
  root.style.setProperty("--color-success", tokens.success);
  root.style.setProperty("--color-live", tokens.live);
}
