// Availo Design Tokens
window.AvailoTokens = {
  colors: {
    // Base neutrals (warm-tinted slate)
    neutral0:   '#ffffff',
    neutral50:  '#f8f8f7',
    neutral100: '#f1f0ee',
    neutral200: '#e4e2de',
    neutral300: '#cac7c1',
    neutral400: '#a8a49c',
    neutral500: '#7d7970',
    neutral600: '#5c5852',
    neutral700: '#3e3b37',
    neutral800: '#2a2825',
    neutral900: '#1a1916',

    // Accent — confident teal
    accent50:  '#eef7f6',
    accent100: '#cceae7',
    accent200: '#99d5d0',
    accent300: '#5cbab4',
    accent400: '#2ea69f',
    accent500: '#1e8f88',   // primary CTA
    accent600: '#177870',
    accent700: '#115f59',
    accent800: '#0b4541',
    accent900: '#072e2b',

    // Semantic
    success:   '#1a9e6e',
    warning:   '#e08c2a',
    error:     '#d94f4f',
    info:      '#3b7fd4',

    // Dark theme base
    dark0:  '#111210',
    dark50: '#181917',
    dark100:'#1f2120',
    dark200:'#2b2d2b',
    dark300:'#3a3d3a',
    dark400:'#505450',
    dark500:'#6e736e',
    dark600:'#959a95',
    dark700:'#bbbfbb',
    dark800:'#dddedd',
    dark900:'#f4f5f4',
  },

  typography: {
    fontDisplay: "'DM Serif Display', Georgia, serif",
    fontBody:    "'DM Sans', 'Helvetica Neue', Helvetica, sans-serif",
    fontMono:    "'JetBrains Mono', 'Fira Code', monospace",

    // Scale (px)
    size: {
      xs:   11,
      sm:   13,
      base: 15,
      md:   17,
      lg:   20,
      xl:   24,
      '2xl': 30,
      '3xl': 38,
      '4xl': 48,
    },

    weight: {
      regular: 400,
      medium:  500,
      semibold: 600,
      bold: 700,
    },

    lineHeight: {
      tight:  1.2,
      snug:   1.4,
      normal: 1.6,
      relaxed: 1.8,
    },
  },

  spacing: {
    // 4px base grid
    1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24,
    7: 28, 8: 32, 10: 40, 12: 48, 16: 64, 20: 80,
  },

  radii: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    pill: 999,
  },

  shadows: {
    xs: '0 1px 2px rgba(0,0,0,0.05)',
    sm: '0 2px 6px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    md: '0 4px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
    lg: '0 8px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.05)',
    xl: '0 16px 48px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)',
  },
};
