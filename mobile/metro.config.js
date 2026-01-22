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

module.exports = withNativeWind(config, { input: "./global.css" });
