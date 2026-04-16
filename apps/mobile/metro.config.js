// Monorepo-aware Metro config — volgt Expo's officiële aanbeveling voor pnpm workspaces.
// Zie: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch alle bestanden in de monorepo, niet alleen de app.
config.watchFolders = [workspaceRoot];

// 2. Laat Metro ook in root node_modules kijken (pnpm hoist niet alles).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// 3. pnpm symlinks zijn soms pijnlijk — laat Metro ze volgen.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
