// Render-capable test runner (VLT-03.07). Separate from vitest (fast node/logic
// tests): jest-expo provides the RN/Flow transform + native-module mocks that
// let real react-native + titan organisms render on the native path — which
// vitest cannot do. Scoped to *.render.test.tsx so the two runners never overlap
// (vitest owns *.test.ts / *.integration.test.tsx).
const expoPreset = require('jest-expo/jest-preset')

// Extend (do NOT replace) the preset's transformIgnorePatterns allowlist so
// titan + nativewind + a few RN packages that ship untranspiled source get
// transformed too. Replacing it drops expo-modules-core and breaks the preset.
const EXTRA_TRANSFORM = [
  '@titan-design',
  'nativewind',
  'react-native-css-interop',
  'react-native-svg',
  '@expo/vector-icons',
  'react-native-worklets',
]
const transformIgnorePatterns = expoPreset.transformIgnorePatterns.map((pattern) =>
  pattern.includes('native-base')
    ? pattern.replace('native-base))', `native-base|${EXTRA_TRANSFORM.join('|')}))`)
    : pattern,
)

module.exports = {
  ...expoPreset,
  testMatch: ['**/*.render.test.tsx'],
  setupFilesAfterEnv: ['<rootDir>/test/render-setup.ts'],
  transformIgnorePatterns,
}
