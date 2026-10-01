const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  try {
    return context.resolveRequest(context, moduleName, platform);
  } catch (error) {
    if (!moduleName.startsWith(".") || !moduleName.endsWith(".js")) throw error;

    const sourcePath = moduleName.slice(0, -3);
    for (const extension of [".ts", ".tsx"]) {
      try {
        return context.resolveRequest(context, `${sourcePath}${extension}`, platform);
      } catch {}
    }

    throw error;
  }
};

module.exports = config;
