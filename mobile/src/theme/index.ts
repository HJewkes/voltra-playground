/**
 * Theme Module
 *
 * Dark mode design system with orange accents.
 *
 * Usage:
 *   import { colors, shadows, styles } from '@/theme';
 */

// Re-export everything from individual modules
export { colors } from './colors';
export { shadows, neumorphic, getElevationStyles, type Elevation } from './shadows';
export { styles, icons, spacing, borderRadius, fontSize } from './styles';
export {
  getRPEColor,
  getVelocityColor,
  getConfidenceColor,
  getConnectionColor,
  getPhaseColor,
} from './utils';
