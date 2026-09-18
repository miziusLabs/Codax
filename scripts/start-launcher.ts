import { resolve } from "node:path";
import { installedBunExecutable } from "../src/config";

const root = resolve(import.meta.dir, "..");
const launcher = resolve(root, "launcher");
const bunExecutable = installedBunExecutable();
const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";

function run(args: string[], cwd: string): void {
  const result = Bun.spawnSync([npmExecutable, ...args], {
    cwd,
    env: {
      ...process.env,
      CODAX_BUN: bunExecutable,
    },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0) process.exit(result.exitCode);
}

run(["ci"], root);
run(["ci"], launcher);
run(["run", "dev"], launcher);
