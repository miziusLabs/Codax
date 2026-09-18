import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const scratch = mkdtempSync(join(tmpdir(), "codax-verify-"));
const runtimeBundle = join(scratch, "runtime");

const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";

async function run(args: string[]): Promise<void> {
  const child = Bun.spawn([npmExecutable, ...args], {
    cwd: root,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await child.exited;
  if (exitCode !== 0) throw new Error(`Verification command failed (${exitCode}): npm ${args.join(" ")}`);
}

try {
  await run(["run", "check-version"]);
  await run(["run", "audit"]);
  await run(["run", "launcher:audit"]);
  await run(["run", "typecheck"]);
  await run(["run", "test"]);
  await run(["run", "launcher:typecheck"]);
  await run(["run", "launcher:test"]);
  await run(["run", "launcher:build"]);
  await run(["run", "build", "--", runtimeBundle]);
  await run(["run", "licenses", "--", join(scratch, "THIRD_PARTY_NOTICES.txt")]);
  await run(["run", "smoke", "--", runtimeBundle]);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
