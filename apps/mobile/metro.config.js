// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

/**
 * Metro has to be told about the monorepo explicitly. By default it only
 * watches this package, so imports from @paizeis/shared resolve to nothing, and
 * it only looks in the local node_modules, which npm workspaces leaves mostly
 * empty because dependencies are hoisted to the root.
 */
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// Hierarchical lookup stays ON. npm nests some transitive dependencies inside
// their parent (expo-asset lives in expo/node_modules/expo-asset), and turning
// it off makes Metro blind to every one of them.

module.exports = config;
