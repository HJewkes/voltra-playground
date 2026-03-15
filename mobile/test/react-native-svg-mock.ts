/**
 * Minimal react-native-svg stub for vitest.
 *
 * react-native-svg uses Flow syntax that Node/Vite cannot parse.
 * Pure-logic tests don't render SVG components, so this stub
 * provides just enough to satisfy the import chain.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const createMockComponent = (name: string) => {
  const component = (props: any) => props;
  component.displayName = name;
  return component;
};

export const Svg = createMockComponent('Svg');
export const Circle = createMockComponent('Circle');
export const Rect = createMockComponent('Rect');
export const Path = createMockComponent('Path');
export const G = createMockComponent('G');
export const Line = createMockComponent('Line');
export const Text = createMockComponent('Text');

export default Svg;
