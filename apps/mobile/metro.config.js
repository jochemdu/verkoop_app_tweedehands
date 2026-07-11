// Sinds SDK 52+ detecteert expo/metro-config pnpm-monorepos automatisch
// (watchFolders + nodeModulesPaths). Handmatige overrides zijn niet meer
// nodig en expo-doctor keurt ze af.
const { getDefaultConfig } = require("expo/metro-config");

module.exports = getDefaultConfig(__dirname);
