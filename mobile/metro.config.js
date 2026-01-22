const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Fix for Zustand v5 and other ESM packages using import.meta on web
// Prioritize CJS builds over ESM to avoid import.meta errors
config.resolver.unstable_conditionNames = [
  'browser',
  'require', 
  'react-native',
];

// Support local SDK development via file: dependency
// Metro needs to watch and resolve the symlinked package
const sdkPath = path.resolve(__dirname, '../../voltra-node-sdk');
config.watchFolders = [sdkPath];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(sdkPath, 'node_modules'),
];

module.exports = withNativeWind(config, { input: "./global.css" });
