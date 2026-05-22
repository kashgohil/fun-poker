// Type scale. Font *families* are deliberately not shared — each platform
// supplies its own — but sizes, weights, and line heights are.
export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  display: 44,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const lineHeight = {
  tight: 1.1,
  normal: 1.4,
  relaxed: 1.6,
} as const;
