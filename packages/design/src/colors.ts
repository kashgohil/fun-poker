// Raw palette — never reference these directly in app code; use `colors`.
export const palette = {
  feltDark: '#0b3d2b',
  felt: '#11593f',
  feltLight: '#1a7a55',
  railDark: '#1c1c1f',
  rail: '#2a2a2e',
  ink: '#0a0a0b',
  cardFace: '#fbfbf7',
  cardBack: '#143a6b',
  white: '#f7f7f5',
  gray100: '#e6e6e6',
  gray300: '#b8b8b8',
  gray500: '#7c7c7c',
  gray700: '#444446',
  gray900: '#1d1d1f',
  gold: '#d8af3a',
  red: '#c0382b',
  green: '#2f8f4e',
  blue: '#2b6cb0',
} as const;

// Semantic colors — the shared visual language for both web and mobile.
export const colors = {
  table: {
    felt: palette.felt,
    feltEdge: palette.feltDark,
    feltHighlight: palette.feltLight,
    rail: palette.rail,
    railEdge: palette.railDark,
  },
  card: {
    face: palette.cardFace,
    back: palette.cardBack,
    border: palette.gray300,
    redSuit: palette.red,
    blackSuit: palette.gray900,
  },
  text: {
    primary: palette.white,
    secondary: palette.gray300,
    muted: palette.gray500,
    inverse: palette.ink,
  },
  action: {
    fold: palette.gray500,
    check: palette.blue,
    call: palette.green,
    raise: palette.red,
  },
  accent: {
    gold: palette.gold,
    info: palette.blue,
  },
  surface: {
    raised: palette.gray900,
    overlay: 'rgba(0, 0, 0, 0.6)',
  },
  seat: {
    empty: 'rgba(255, 255, 255, 0.06)',
    active: palette.gold,
    folded: palette.gray700,
  },
} as const;
