/**
 * Common Component Styles
 *
 * Reusable style objects for common UI patterns.
 */

import { colors } from './colors';

export const styles = {
  // Main app background
  background: {
    backgroundColor: colors.surface.background,
  },

  // Card
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.surface.light,
  },

  // Elevated card (modals, floating)
  cardElevated: {
    backgroundColor: colors.surface.elevated,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.surface.light,
  },

  // Pressed/inset surface
  cardInset: {
    backgroundColor: colors.surface.dark,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surface.darkest,
  },

  // Primary button
  buttonPrimary: {
    backgroundColor: colors.primary[600],
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },

  // Secondary button
  buttonSecondary: {
    backgroundColor: colors.surface.card,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: colors.surface.light,
  },

  // Icon button (circular)
  iconButton: {
    backgroundColor: colors.surface.card,
    borderRadius: 50,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.surface.light,
  },

  // Text input
  input: {
    backgroundColor: colors.surface.dark,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.surface.darkest,
    color: colors.text.primary,
    fontSize: 16,
  },

  // Badge
  badge: {
    backgroundColor: colors.primary[600],
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.surface.light,
  },
} as const;

// Icon names (Ionicons)
export const icons = {
  // Tab bar
  home: 'home-outline',
  homeActive: 'home',
  workout: 'fitness-outline',
  workoutActive: 'fitness',
  discover: 'compass-outline',
  discoverActive: 'compass',
  history: 'time-outline',
  historyActive: 'time',
  settings: 'cog-outline',
  settingsActive: 'cog',

  // Actions
  play: 'play',
  playOutline: 'play-outline',
  stop: 'stop',
  pause: 'pause',
  add: 'add',
  remove: 'remove',
  close: 'close',
  check: 'checkmark',
  chevronRight: 'chevron-forward',
  chevronDown: 'chevron-down',
  refresh: 'refresh',

  // Fitness
  barbell: 'barbell-outline',
  barbellActive: 'barbell',
  timer: 'timer-outline',
  trophy: 'trophy-outline',
  flame: 'flame-outline',
  pulse: 'pulse',
  speedometer: 'speedometer-outline',

  // Connection
  bluetooth: 'bluetooth-outline',
  bluetoothActive: 'bluetooth',
  wifi: 'wifi-outline',
  sync: 'sync-outline',

  // Status
  alert: 'alert-circle-outline',
  info: 'information-circle-outline',
  success: 'checkmark-circle-outline',
  warning: 'warning-outline',

  // Misc
  calendar: 'calendar-outline',
  analytics: 'analytics-outline',
  flash: 'flash-outline',
  body: 'body-outline',
  search: 'search-outline',
} as const;

// Spacing scale
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Border radius scale
export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

// Font size scale
export const fontSize = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
  '6xl': 60,
  '7xl': 72,
} as const;
