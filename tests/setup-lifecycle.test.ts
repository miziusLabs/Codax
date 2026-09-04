import { expect, test } from "bun:test";
import {
  launcherCapabilityProbeRequired,
  setupProxyIsReady,
  tunnelBootstrapCleanupRequired,
} from "../src/setup";

const config = {
  mode: "browser-only" as const,
  releaseVersion: "0.2.0",
};

test("setup accepts only a matching daemon that is ready for new Codex turns", () => {
  const ready = {
    service: "codax",
    status: "ok",
    mode: "browser-only",
    version: "0.2.0",
    accepting_turns: true,
  };

  expect(setupProxyIsReady(ready, config)).toBe(true);
  expect(setupProxyIsReady({ ...ready, accepting_turns: false }, config)).toBe(false);
  expect(setupProxyIsReady({ ...ready, status: "degraded" }, config)).toBe(false);
  expect(setupProxyIsReady({ ...ready, version: "0.1.16" }, config)).toBe(false);
});

test("launcher setup refreshes account capabilities only when missing or explicitly requested", () => {
  const verifiedLauncher = {
    browserHost: "launcher",
    solAvailable: true,
    proAvailable: false,
  } as never;

  expect(launcherCapabilityProbeRequired(undefined)).toBe(true);
  expect(launcherCapabilityProbeRequired(verifiedLauncher)).toBe(false);
  expect(launcherCapabilityProbeRequired({
    browserHost: "launcher",
    proAvailable: false,
  } as never)).toBe(true);
  expect(launcherCapabilityProbeRequired(verifiedLauncher, true)).toBe(true);
});

test("Windows hands a successfully validated tunnel directly to the launcher supervisor", () => {
  expect(tunnelBootstrapCleanupRequired(true, "win32")).toBe(false);
  expect(tunnelBootstrapCleanupRequired(true, "darwin")).toBe(true);
  expect(tunnelBootstrapCleanupRequired(true, "linux")).toBe(true);
});

test("failed tunnel validation is cleaned up on every platform", () => {
  expect(tunnelBootstrapCleanupRequired(false, "win32")).toBe(true);
  expect(tunnelBootstrapCleanupRequired(false, "darwin")).toBe(true);
  expect(tunnelBootstrapCleanupRequired(false, "linux")).toBe(true);
});
