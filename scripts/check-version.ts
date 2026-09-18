import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
  version?: string;
  packageManager?: string;
  devDependencies?: Record<string, string>;
  engines?: Record<string, string>;
};
const packageVersion = packageJson.version;
if (!packageVersion) throw new Error("package.json has no version");
const packageManagerMatch = /^npm@(\d+\.\d+\.\d+)$/.exec(packageJson.packageManager ?? "");
if (!packageManagerMatch) throw new Error("package.json must pin an exact npm packageManager version");
const npmVersion = packageManagerMatch[1];
const bunVersion = packageJson.engines?.bun;
if (!bunVersion) throw new Error("package.json must pin an exact Bun engine version");
if (Bun.version !== bunVersion) throw new Error(`Expected Bun ${bunVersion}, received ${Bun.version}`);
if (packageJson.devDependencies?.["@types/bun"] !== bunVersion) {
  throw new Error(`@types/bun is not synchronized to ${bunVersion}`);
}
if (packageJson.devDependencies?.bun !== bunVersion) {
  throw new Error(`bun is not synchronized to ${bunVersion}`);
}
const expected = [
  ["src/version.ts", `export const VERSION = ${JSON.stringify(packageVersion)};`],
  ["src/adapters/chatgpt-web/mcp-server.ts", "version: VERSION"],
  ["scripts/install.sh", `VERSION=\"\${CODAX_VERSION:-${packageVersion}}\"`],
  ["README.md", `requires Bun ${bunVersion}.`],
  ["scripts/install.sh", `Bun-${bunVersion}.md`],
  ["scripts/generate-third-party-notices.ts", `Bun ${bunVersion}`],
  ["scripts/prepare-windows-baseline-bun.ps1", `bun-v$Version`],
  ["package-lock.json", '"lockfileVersion": 3'],
  ["launcher/package-lock.json", '"lockfileVersion": 3'],
] as const;
for (const [path, needle] of expected) {
  if (!readFileSync(resolve(root, path), "utf8").includes(needle)) throw new Error(`${path} is not synchronized to ${packageVersion}`);
}
const launcherVersion = (JSON.parse(readFileSync(resolve(root, "launcher/package.json"), "utf8")) as { version?: string }).version;
if (launcherVersion !== packageVersion) throw new Error(`launcher/package.json is not synchronized to ${packageVersion}`);
process.stdout.write(`VERSION_SYNC_OK ${packageVersion} npm@${npmVersion} (Bun ${bunVersion})\n`);
