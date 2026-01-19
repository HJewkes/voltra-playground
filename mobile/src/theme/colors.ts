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
  
  // Surface colors for dark theme
  surface: {
    lightest: '#3d3d3d',  // Highlight edge
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
  
  // Semantic colors
  success: '#22c55e',
  successLight: '#4ade80',
  successDark: '#166534',
  
  warning: '#eab308',
  warningLight: '#facc15',
  warningDark: '#854d0e',
  
  danger: '#ef4444',
  dangerLight: '#f87171',
  dangerDark: '#991b1b',
  
  info: '#3b82f6',
  infoLight: '#60a5fa',
  infoDark: '#1e40af',
} as const;
