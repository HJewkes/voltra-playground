// jest-expo's react-native resolver runs with CJS export conditions
// (['require', 'react-native']). @voltras/workout-analytics 3.x is ESM-only and
// publishes an "import" condition alone, so the default conditions resolve
// nothing and the suite fails with "Cannot find module". Add "import" for just
// those packages; everything else keeps resolving exactly as the preset intends.
const rnResolver = require('react-native/jest/resolver')

const ESM_ONLY_PACKAGES = ['@voltras/workout-analytics']

module.exports = (request, options) => {
  const isEsmOnly = ESM_ONLY_PACKAGES.some(
    (pkg) => request === pkg || request.startsWith(`${pkg}/`),
  )

  if (!isEsmOnly) {
    return rnResolver(request, options)
  }

  return rnResolver(request, {
    ...options,
    conditions: [...(options.conditions ?? []), 'import'],
  })
}
