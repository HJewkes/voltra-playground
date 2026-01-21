/**
 * Color Palette
 *
 * Dark mode design system with orange accents.
 */

export const colors = {
  // Primary orange palette
  primary: {
    50: '#fff7ed',
    100: '#ffedd5',
    200: '#fed7aa',
    300: '#fdba74',
    400: '#fb923c',
    500: '#f97316',
    600: '#ea580c',
    700: '#c2410c',
    800: '#9a3412',
    900: '#7c2d12',
  },

  // Neutral gray palette
  neutral: {
    50: '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    400: '#a1a1aa',
    500: '#71717a',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
  },

  // Surface colors for dark theme
  surface: {
    lightest: '#3d3d3d', // Highlight edge
    light: '#333333',
    card: '#2d2d2d',
    elevated: '#262626',
    background: '#1f1f1f',
    dark: '#1a1a1a',
    darkest: '#141414',
    shadow: '#0f0f0f',
  },

  // Text colors
  text: {
    primary: '#ffffff',
    secondary: '#a1a1aa',
    tertiary: '#71717a',
    muted: '#52525b',
  },

  // Content colors (alias for text)
  content: {
    primary: '#ffffff',
    secondary: '#a1a1aa',
    tertiary: '#71717a',
    muted: '#52525b',
  },

  // Semantic colors (object form with variants)
  // Use .DEFAULT for direct color value, .light/.dark for variants
  success: {
    DEFAULT: '#22c55e',
    light: '#4ade80',
    dark: '#166534',
  },

  warning: {
    DEFAULT: '#eab308',
    light: '#facc15',
    dark: '#854d0e',
  },

  danger: {
    DEFAULT: '#ef4444',
    light: '#f87171',
    dark: '#991b1b',
  },

  error: {
    DEFAULT: '#ef4444',
    light: '#f87171',
    dark: '#991b1b',
  },

  info: {
    DEFAULT: '#3b82f6',
    light: '#60a5fa',
    dark: '#1e40af',
  },
} as const;
