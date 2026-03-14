import type { TextStyle, ViewStyle } from 'react-native';

/**
 * Casts a web-only CSS style object to ViewStyle so it can be used in
 * Platform.select without `as any`. These properties (boxShadow, textShadow,
 * cursor, touchAction, etc.) are valid on React Native Web but not typed in RN.
 */
export function webStyle(style: Record<string, string | number | undefined>): ViewStyle & TextStyle {
  return style as unknown as ViewStyle & TextStyle;
}

/**
 * Type alias for use with direct type assertions on web-only style objects.
 * Use webStyle() for object literals; use WebStyle for type assertions on
 * objects that cause TypeScript JSX parse issues with template literals.
 */
export type WebStyle = ViewStyle & TextStyle & Record<string, unknown>;
