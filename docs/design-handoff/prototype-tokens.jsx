// Shared color tokens. Both themes expose the SAME keys — only values differ.
// The single Studio layout reads these; nothing structural lives here.

const darkTokens = {
  name: "Studio Dark",
  dark: true,
  hue: 290,
  themeIcon: "moon",

  bg: "#0c0c10",
  surface: "#15151c",
  surface2: "#1c1c25",
  surface3: "#23232e",
  raised: "#23232e",
  chipBg: "#1c1c25",

  border: "rgba(255,255,255,0.07)",
  borderStrong: "rgba(255,255,255,0.13)",

  text: "#ececf1",
  textDim: "#9595a3",
  textMute: "#5e5e6b",
  heading: "#ffffff",

  accent: "oklch(0.66 0.155 292)",
  accentSoft: "oklch(0.66 0.155 292 / 0.16)",
  accentBorder: "oklch(0.66 0.155 292 / 0.42)",
  onAccent: "#ffffff",

  solid: "#ffffff",
  onSolid: "#0c0c10",

  success: "oklch(0.74 0.14 150)",
  onSuccess: "#06140c",
  warn: "oklch(0.80 0.16 75)",

  cardShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 60px -20px rgba(0,0,0,0.6)",
  btnShadow: "0 6px 18px -4px oklch(0.66 0.155 292 / 0.5)",
};

const warmTokens = {
  name: "Studio Warm",
  dark: false,
  hue: 35,
  themeIcon: "sun",

  bg: "#f1ede4",
  surface: "#fbf8f1",
  surface2: "#f5f1e7",
  surface3: "#ede8db",
  raised: "#ffffff",
  chipBg: "#fbf8f1",

  border: "rgba(40,28,12,0.10)",
  borderStrong: "rgba(40,28,12,0.18)",

  text: "#1d1a13",
  textDim: "#5e574a",
  textMute: "#8a8170",
  heading: "#1d1a13",

  accent: "oklch(0.65 0.16 35)",
  accentSoft: "oklch(0.65 0.16 35 / 0.14)",
  accentBorder: "oklch(0.65 0.16 35 / 0.45)",
  onAccent: "#ffffff",

  solid: "#1d1a13",
  onSolid: "#fbf8f1",

  success: "oklch(0.60 0.14 150)",
  onSuccess: "#ffffff",
  warn: "oklch(0.70 0.16 70)",

  cardShadow: "0 1px 0 rgba(255,255,255,0.6) inset, 0 18px 40px -24px rgba(40,28,12,0.18)",
  btnShadow: "0 6px 16px -6px oklch(0.65 0.16 35 / 0.6)",
};

window.darkTokens = darkTokens;
window.warmTokens = warmTokens;
