/**
 * Shadow Styles
 * 
 * Web-compatible boxShadow styles for depth and elevation.
 * These work on web; native platforms would need Platform-specific shadows.
 */

export const shadows = {
  // Subtle card shadow
  card: {
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
  },
  // Elevated/floating elements
  elevated: {
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
  },
  // Subtle inset feel (using lighter shadow)
  pressed: {
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
  },
  // Orange glow effect
  glow: {
    boxShadow: '0 0 20px rgba(249, 115, 22, 0.4)',
  },
  // Success glow
  glowSuccess: {
    boxShadow: '0 0 20px rgba(34, 197, 94, 0.4)',
  },
  // Danger glow
  glowDanger: {
    boxShadow: '0 0 20px rgba(239, 68, 68, 0.4)',
  },
  // No shadow
  none: {},
} as const;

// Backwards compatibility alias
export const neumorphic = shadows;
