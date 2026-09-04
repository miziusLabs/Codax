const os = require("node:os");
const path = require("node:path");

const PRODUCTION_PROFILE = "production";
const DEVELOPMENT_PROFILE = "development";

function resolveUserPath(value, homeDir = os.homedir()) {
  if (value === "~") return homeDir;
  if (value.startsWith("~/") || value.startsWith("~\\")) {
    return path.resolve(homeDir, value.slice(2));
  }
  return path.resolve(value);
}

function resolveLauncherProfile({
  argv = process.argv,
  env = process.env,
  homeDir = os.homedir(),
  appData,
} = {}) {
  if (typeof appData !== "string" || !path.isAbsolute(appData)) {
    throw new Error("Launcher profile resolution requires an absolute appData path");
  }
  const development = argv.includes("--dev-profile");
  if (!development) {
    const coreHome = env.CODAX_HOME?.trim()
      ? resolveUserPath(env.CODAX_HOME.trim(), homeDir)
      : path.join(homeDir, ".codax");
    const userData = env.CODAX_LAUNCHER_DATA_DIR?.trim()
      ? resolveUserPath(env.CODAX_LAUNCHER_DATA_DIR.trim(), homeDir)
      : path.join(appData, "Codax");
    return {
      kind: PRODUCTION_PROFILE,
      displayName: "Codax",
      coreHome,
      codexHome: env.CODEX_HOME?.trim()
        ? resolveUserPath(env.CODEX_HOME.trim(), homeDir)
        : path.join(homeDir, ".codex"),
      userData,
      browserPartition: "persist:codax-chatgpt",
    };
  }

  const coreHome = env.CODAX_DEV_HOME?.trim()
    ? resolveUserPath(env.CODAX_DEV_HOME.trim(), homeDir)
    : path.join(homeDir, ".codax-dev");
  const productionHome = env.CODAX_HOME?.trim()
    ? resolveUserPath(env.CODAX_HOME.trim(), homeDir)
    : path.join(homeDir, ".codax");
  if (path.resolve(coreHome) === path.resolve(productionHome)) {
    throw new Error("DEV profile home must differ from the production codax home");
  }
  return {
    kind: DEVELOPMENT_PROFILE,
    displayName: "Codax DEV",
    coreHome,
    codexHome: path.join(coreHome, "codex-home"),
    userData: path.join(coreHome, "launcher"),
    browserPartition: "persist:codax-dev-chatgpt",
  };
}

module.exports = {
  DEVELOPMENT_PROFILE,
  PRODUCTION_PROFILE,
  resolveLauncherProfile,
};
