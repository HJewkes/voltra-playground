// Minimal nativewind stub for the node/vitest environment.
//
// titan 0.4.0's `ThemeProvider` calls `vars()` to register titan's semantic
// color tokens as native CSS custom properties (a style object). In tests we
// only need `vars` to resolve and return a style-shaped value; the real
// nativewind runtime pulls in react-native-css-interop internals that the node
// loader can't parse. Aliased in vitest.config.ts alongside the other RN mocks.
export const vars = (v: Record<string, string | number>): Record<string, string | number> => v;

export default {};
