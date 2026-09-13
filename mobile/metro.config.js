const path = require("path");
const fs = require("fs");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Fix for Zustand v5 and other ESM packages using import.meta on web
// Prioritize CJS builds over ESM to avoid import.meta errors
config.resolver.unstable_conditionNames = [
  'browser',
  'require',
  'react-native',
];

// Support local symlinked @voltras/node-sdk when developing against a sibling
// checkout. Worktree checkouts live under .worktrees/<name>/mobile, so this
// resolves outside the repo entirely there; skip watching it rather than
// crash Metro with ENOENT when the sibling isn't present.
const sdkPath = path.resolve(__dirname, "../../voltra-node-sdk");
if (fs.existsSync(sdkPath)) {
  config.watchFolders = [sdkPath];
}
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
];

// Force @voltras/node-sdk's CommonJS build on web.
// Its ESM build injects `createRequire(import.meta.url)` from `node:module`
// at the top of voltra-manager.js, which is Node-only and throws
// "(0 , _nodeModule.createRequire) is not a function" in the web bundle.
// The `unstable_conditionNames` above does not reliably steer this package's
// exports map away from the `import`/ESM entry, so redirect any resolution
// that lands in the SDK's dist/esm to the equivalent (createRequire-free)
// dist/cjs file when bundling for web. The CJS tree mirrors the ESM tree.
const esmSegment = `${path.sep}dist${path.sep}esm${path.sep}`;
const cjsSegment = `${path.sep}dist${path.sep}cjs${path.sep}`;
// Matches the SDK whether it is a real install (.../@voltras/node-sdk/...)
// or the local dev symlink resolved to its sibling (.../voltra-node-sdk/...).
const isVoltraSdkPath = (filePath) =>
  filePath.includes(`@voltras${path.sep}node-sdk${path.sep}`) ||
  filePath.includes(`${path.sep}voltra-node-sdk${path.sep}`);

// @voltras/workout-analytics is ESM-only since 1.0.0 and publishes an `import`
// condition alone, so the CJS-leaning `unstable_conditionNames` above resolves
// nothing for it. Add `import` for that package only, leaving every other
// package on the CJS-first order the zustand/node-sdk notes above depend on.
const ESM_ONLY_PACKAGES = ["@voltras/workout-analytics"];
const isEsmOnlyPackage = (moduleName) =>
  ESM_ONLY_PACKAGES.some(
    (pkg) => moduleName === pkg || moduleName.startsWith(`${pkg}/`),
  );

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolveContext = isEsmOnlyPackage(moduleName)
    ? {
        ...context,
        unstable_conditionNames: [
          ...context.unstable_conditionNames,
          "import",
        ],
      }
    : context;

  const resolution = (originalResolveRequest ?? context.resolveRequest)(
    resolveContext,
    moduleName,
    platform,
  );

  if (
    platform === "web" &&
    resolution?.type === "sourceFile" &&
    typeof resolution.filePath === "string" &&
    resolution.filePath.includes(esmSegment) &&
    isVoltraSdkPath(resolution.filePath)
  ) {
    return {
      ...resolution,
      filePath: resolution.filePath.replace(esmSegment, cjsSegment),
    };
  }

  return resolution;
};

module.exports = withNativeWind(config, { input: "./global.css" });
