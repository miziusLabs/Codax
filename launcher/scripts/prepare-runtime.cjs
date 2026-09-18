const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const launcherRoot = path.resolve(__dirname, "..");
const repositoryRoot = path.resolve(launcherRoot, "..");
const output = path.join(launcherRoot, "build", "runtime");
const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";

function run(args) {
  const result = spawnSync(npmExecutable, ["--prefix", repositoryRoot, ...args], {
    cwd: launcherRoot,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(["ci"]);
run(["run", "build", "--", output]);
run(["run", "licenses", "--", path.join(output, "THIRD_PARTY_NOTICES.txt")]);
fs.copyFileSync(path.join(repositoryRoot, "LICENSE"), path.join(output, "LICENSE"));
fs.cpSync(path.join(repositoryRoot, "LICENSES"), path.join(output, "LICENSES"), { recursive: true });
