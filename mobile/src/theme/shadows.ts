/**
 * Shadow Styles
 * 
 * Shadow styles for depth and elevation.
 * NativeWind handles conversion of CSS boxShadow to native shadow props.
 * Inset shadows use RN 0.76+ native boxShadow format with inset: true.
 */

import { colors } from './colors';

export const shadows = {
  // No shadow
  none: {},
  
  // Subtle card shadow (elevation 1)
  card: {
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
  },
  
  // Elevated/floating elements (elevation 2)
  elevated: {
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
  },
  
  // Subtle pressed feel
  pressed: {
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
  },
  
  // Native inset shadow (RN 0.76+ boxShadow format)
  // Creates a pressed/recessed appearance
  inset: {
    boxShadow: [{
      offsetX: 0,
      offsetY: 2,
      blurRadius: 6,
      spreadDistance: 0,
      color: 'rgba(0, 0, 0, 0.5)',
      inset: true,
    }],
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
} as const;

// Backwards compatibility alias
export const neumorphic = shadows;

/**
 * Elevation type for Surface/Card components
 */
export type Elevation = 0 | 1 | 2 | 'inset';

/**
 * Get combined styles (background + shadow) for an elevation level.
 * Used by Surface and Card components.
 */
export function getElevationStyles(elevation: Elevation) {
  switch (elevation) {
    case 0:
      return { 
        backgroundColor: colors.surface.background, 
        ...shadows.none,
      };
    case 1:
      return { 
        backgroundColor: colors.surface.card, 
        ...shadows.card,
      };
    case 2:
      return { 
        backgroundColor: colors.surface.elevated, 
        ...shadows.elevated,
      };
    case 'inset':
      return { 
        backgroundColor: colors.surface.dark, 
        ...shadows.inset,
      };
  }
}
