export const colors = {
  accent: "#1e8f88",
  bg: "#f8f8f7",
  surface: "#ffffff",
  border: "#e4e2de",
  text: "#1a1916",
  muted: "#7d7970",
  subtle: "#a8a49c",

  neutral: {
    0: "#ffffff",
    50: "#f8f8f7",
    100: "#f1f0ee",
    200: "#e4e2de",
    300: "#cac7c1",
    400: "#a8a49c",
    500: "#7d7970",
    600: "#5c5852",
    700: "#3e3b37",
    800: "#2a2825",
    900: "#1a1916",
  },

  accentScale: {
    50: "#eef7f6",
    100: "#cceae7",
    200: "#99d5d0",
    300: "#5cbab4",
    400: "#2ea69f",
    500: "#1e8f88",
    600: "#177870",
    700: "#115f59",
    800: "#0b4541",
    900: "#072e2b",
  },

  semantic: {
    success: {
      text: "#1a9e6e",
      bg: "#edf7f2",
      border: "#b8e8d4",
      strong: "#0d5237",
    },
    warning: {
      text: "#e08c2a",
      bg: "#fef6ec",
      border: "#fad9a8",
      strong: "#7a4a0e",
    },
    error: {
      text: "#d94f4f",
      bg: "#fef0f0",
      border: "#f9c4c4",
      strong: "#7a1515",
    },
    info: {
      text: "#3b7fd4",
      bg: "#eff5fd",
      border: "#b8d1f5",
      strong: "#1a3d72",
    },
  },

  dark: {
    0: "#111210",
    50: "#181917",
    100: "#1f2120",
    200: "#2b2d2b",
    300: "#3a3d3a",
    400: "#505450",
    500: "#6e736e",
    600: "#959a95",
    700: "#bbbfbb",
    800: "#dddedd",
    900: "#f4f5f4",
  },
} as const;

export const fonts = {
  display: "'DM Serif Display', Georgia, serif",
  body: "'DM Sans', 'Helvetica Neue', Helvetica, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
} as const;

export const fontSizes = {
  xs: "11px",
  sm: "13px",
  base: "15px",
  md: "17px",
  lg: "20px",
  xl: "24px",
  "2xl": "30px",
  "3xl": "38px",
  "4xl": "48px",
} as const;

export const fontWeights = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const lineHeights = {
  tight: 1.2,
  snug: 1.4,
  normal: 1.6,
  relaxed: 1.8,
} as const;

export const typeStyles = {
  display: {
    fontFamily: fonts.display,
    fontSize: "48px",
    fontWeight: fontWeights.regular,
    lineHeight: 1.15,
  },
  h1: {
    fontFamily: fonts.body,
    fontSize: "36px",
    fontWeight: fontWeights.semibold,
    lineHeight: 1.2,
  },
  h2: {
    fontFamily: fonts.body,
    fontSize: "24px",
    fontWeight: fontWeights.semibold,
    lineHeight: 1.3,
  },
  h3: {
    fontFamily: fonts.body,
    fontSize: "18px",
    fontWeight: fontWeights.semibold,
    lineHeight: 1.4,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: "15px",
    fontWeight: fontWeights.regular,
    lineHeight: 1.6,
  },
  small: {
    fontFamily: fonts.body,
    fontSize: "13px",
    fontWeight: fontWeights.regular,
    lineHeight: 1.5,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: "11px",
    fontWeight: fontWeights.semibold,
    lineHeight: 1.4,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: "13px",
    fontWeight: fontWeights.regular,
    lineHeight: 1.5,
  },
} as const;

export const spacing = {
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  7: "28px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
  20: "80px",
} as const;

export const radii = {
  sm: "6px",
  md: "10px",
  lg: "14px",
  xl: "20px",
  pill: "999px",
} as const;

export const shadows = {
  xs: "0 1px 2px rgba(0,0,0,0.05)",
  sm: "0 2px 6px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  md: "0 4px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)",
  lg: "0 8px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.05)",
  xl: "0 16px 48px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)",
} as const;

export const tokens = {
  colors,
  fonts,
  fontSizes,
  fontWeights,
  lineHeights,
  typeStyles,
  spacing,
  radii,
  shadows,
} as const;

export type AvailoTokens = typeof tokens;
export type AvailoColor = keyof typeof colors;
export type AvailoSpace = keyof typeof spacing;
export type AvailoRadius = keyof typeof radii;
export type AvailoShadow = keyof typeof shadows;
