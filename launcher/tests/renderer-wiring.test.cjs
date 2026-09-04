const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const launcherRoot = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(launcherRoot, "src", "App.tsx"), "utf8");
const stylesSource = fs.readFileSync(path.join(launcherRoot, "src", "styles.css"), "utf8");
const electronMain = fs.readFileSync(path.join(launcherRoot, "electron", "main.cjs"), "utf8");
const browserHostSource = fs.readFileSync(path.join(launcherRoot, "electron", "browser-host.cjs"), "utf8");
const preloadSource = fs.readFileSync(path.join(launcherRoot, "electron", "preload.cjs"), "utf8");

test("embedded ChatGPT is measured only after its animated surface mounts", () => {
  assert.match(appSource, /const \[browserSlot, setBrowserSlot\] = useState<HTMLDivElement \| null>\(null\)/);
  assert.match(appSource, /setBrowserSurfaceActive\(browserSurfaceActive\)\.then\(\(\) => \{/);
  assert.match(appSource, /observer\.observe\(browserSlot\)/);
  assert.match(appSource, /ref=\{browserSlotRef\}/);
});

test("Motion animation features are split out of the renderer startup path", () => {
  assert.match(appSource, /import \{ AnimatePresence, LazyMotion, m \} from "motion\/react"/);
  assert.match(appSource, /const loadMotionFeatures = \(\) => import\("\.\/motion-features"\)/);
  assert.match(appSource, /<LazyMotion features=\{loadMotionFeatures\} strict>/);
  assert.doesNotMatch(appSource, /\bmotion\./);
});

test("launcher is English-only and exposes no language controls", () => {
  assert.match(appSource, /import \{ copy, type Copy \} from "\.\/copy"/);
  assert.doesNotMatch(appSource, /LanguageMenu|chooseLanguage|selectedLanguage|zh-CN|data-language/);
  assert.doesNotMatch(stylesSource, /language-menu|welcome-option/);
  assert.doesNotMatch(electronMain, /launcher:set-language|validateLanguage|zh-CN/);
  assert.doesNotMatch(preloadSource, /setLanguage|launcher:set-language/);
});

test("native clicks reach browser tabs instead of the window drag region", () => {
  assert.match(appSource, /draggable=\{surface !== "browser"\}/);
  assert.match(appSource, /className=\{`app-titlebar\$\{draggable \? " draggable" : ""\}`\}/);
  assert.match(stylesSource, /\.browser-tab\s*\{[^}]*-webkit-app-region:\s*no-drag;/s);
  assert.match(appSource, /className="browser-tab-drag draggable"/);
});

test("renderer zoom scales the shell without moving or zooming the native ChatGPT surface", () => {
  assert.match(
    electronMain,
    /browserHost\?\.setBounds\(validateBounds\(bounds\), event\.sender\.getZoomFactor\(\)\)/,
  );
  assert.match(browserHostSource, /this\.bindShellZoomShortcuts\(this\.window\.webContents\)/);
  assert.match(browserHostSource, /contents\.setZoomLevel\(next\)/);
  assert.match(appSource, /api!\.zoomBrowser\(action\)/);
});

test("closing the launcher follows the persisted background-runtime preference", () => {
  assert.match(
    electronMain,
    /if \(stateStore\.read\(\)\.keepRunningOnClose && tray\) window\.hide\(\);\s*else void requestQuit\(\);/,
  );
  assert.match(appSource, /setPreference\("keepRunningOnClose", checked\)/);
});

test("ChatGPT browser workarounds have a persisted renderer setting", () => {
  assert.match(appSource, /disableChatGptBrowserWorkarounds/);
  assert.match(appSource, /setPreference\("disableChatGptBrowserWorkarounds", checked\)/);
  assert.match(electronMain, /key === "disableChatGptBrowserWorkarounds"/);
  assert.match(browserHostSource, /disableChatGptBrowserWorkarounds/);
  assert.match(browserHostSource, /applyViewportCss\(contents, tab\)/);
});

test("normal shutdown persists the ChatGPT session before closing browser views", () => {
  assert.match(
    electronMain,
    /runtimeSupervisor\?\.shutdown\(\{ cancelActiveTurns: true, force: true \}\)/,
  );
  const persist = electronMain.indexOf("await browserHost?.persistSession()");
  const destroy = electronMain.indexOf("browserHost?.destroy()", persist);
  assert.ok(persist >= 0, "shutdown must persist the ChatGPT session");
  assert.ok(destroy > persist, "browser views must close only after session persistence completes");
});

test("DEV launcher exposes its profile and supervises only its Full-mode MCP runtime", () => {
  assert.match(electronMain, /profile:\s*LAUNCHER_PROFILE\.kind/);
  assert.match(electronMain, /if \(IS_DEV_PROFILE\) \{[\s\S]*?config\?\.mode === "full"[\s\S]*?runtimeSupervisor\.startIfConfigured\(\)[\s\S]*?\} else void \(async \(\) => \{/);
  assert.match(electronMain, /await runtimeSupervisor\?\.shutdown\(\{ cancelActiveTurns: true, force: true \}\)/);
  assert.match(electronMain, /IS_DEV_PROFILE && !stateStore\.read\(\)\.onboardingComplete/);
  assert.match(electronMain, /onboardingComplete:\s*true,[\s\S]*?autoStart:\s*false/);
  assert.match(appSource, /snapshot\.profile === "development"/);
  assert.match(appSource, /data-profile=\{snapshot\.profile\}/);
  assert.doesNotMatch(appSource, /biggerContext|setBiggerContext|experimentalBiggerContext/);
  assert.doesNotMatch(electronMain, /bigger-context|setBiggerContext|experimentalBiggerContext/);
});

test("removed Bigger Context feature has no launcher setting or recommendation surface", () => {
  assert.doesNotMatch(appSource, /BiggerContextRecommendation|bigger-context-recommendation/);
  assert.doesNotMatch(stylesSource, /bigger-context-recommendation/);
});

test("MCP surfaces use the official local protocol mark", () => {
  assert.match(appSource, /function McpMark\(\) \{\s*return <i aria-hidden="true" className="mcp-mark" \/>;\s*\}/);
  assert.match(appSource, /icon === "mcp" \? <McpMark \/> : <Icon name=\{icon\} \/>/);
  assert.match(appSource, /<McpMark \/>[\s\S]*?copy\.mcpTitle/);
  assert.doesNotMatch(appSource, /<Icon name="mcp" \/>/);
  assert.match(stylesSource, /mask:\s*url\("\.\.\/assets\/mcp-mark\.svg"\)/);
});

test("MCP guide media uses compressed video instead of animated GIFs", () => {
  assert.match(appSource, /mcp-create-tunnel\.webm/);
  assert.match(appSource, /mcp-connect-connector\.webm/);
  assert.match(appSource, /<video[\s\S]*?autoPlay[\s\S]*?loop[\s\S]*?muted[\s\S]*?preload="metadata"/);
  assert.doesNotMatch(appSource, /mcp-(?:create-tunnel|connect-connector)\.gif/);
  assert.match(stylesSource, /\.guide-media video\s*\{/);
});

test("launcher logs update React only while the Activity surface is mounted", () => {
  const appStart = appSource.indexOf("export function App()");
  const onboardingStart = appSource.indexOf("function Onboarding", appStart);
  const appBody = appSource.slice(appStart, onboardingStart);
  const activityStart = appSource.indexOf("function ActivitySurface");
  const settingsStart = appSource.indexOf("function SettingsSurface", activityStart);
  const activityBody = appSource.slice(activityStart, settingsStart);

  assert.doesNotMatch(appBody, /onLog\(/);
  assert.doesNotMatch(electronMain, /launcher:snapshot[\s\S]*?logs:\s*logger\.recent\(\)/);
  assert.match(activityBody, /api!\.logs\(300\)/);
  assert.match(activityBody, /api!\.onLog\(/);
  assert.match(activityBody, /unsubscribe\(\)/);
});

test("the configured launcher exposes no persistent bridge opt-out", () => {
  assert.doesNotMatch(appSource, /setBridgeEnabled|bridgeRouteBody/);
  assert.doesNotMatch(preloadSource, /launcher:bridge-enabled|setBridgeEnabled/);
  assert.doesNotMatch(electronMain, /launcher:bridge-enabled|bridge-disabled|bridgeEnabled/);
  assert.match(electronMain, /runtimeSupervisor\.startIfConfigured\(\)[\s\S]*?runtimeHost\.connectBridgeRoute\(\)/);
});

test("MCP connection remains unavailable until the model catalog is verified", () => {
  assert.match(
    appSource,
    /snapshot\.state\.codexCatalogVerified \? copy\.mcpStepTwoHint : copy\.mcpCatalogRequired/,
  );
  assert.match(appSource, /\|\| !snapshot\.state\.codexCatalogVerified/);
});

test("MCP navigation remains locked while an operation is active", () => {
  assert.match(appSource, /<McpSurface[\s\S]*?operation=\{operation\}/);
  assert.match(appSource, /const busy = localBusy \|\| operation\?\.status === "running"/);
  assert.match(appSource, /const safeMove = async \(next: number\) => \{\s*if \(busy\) return;/);
  assert.match(appSource, /disabled=\{busy \|\| index > step\}/);
});

test("failed doctor reports retain every failed check", () => {
  assert.match(
    appSource,
    /report\.ok\s*\?\s*report\.checks\.slice\(-6\)\s*:\s*report\.checks\.filter\(\(check\) => check\.status !== "ok"\)/,
  );
  assert.match(appSource, /visibleChecks\.map\(\(check\) =>/);
});

test("launcher shares only privacy-safe exported diagnostics", () => {
  assert.match(appSource, /api!\.exportLogs\(\)/);
  assert.match(preloadSource, /exportLogs:[\s\S]*?launcher:export-logs/);
  assert.match(electronMain, /launcher:export-logs[\s\S]*?showSaveDialog[\s\S]*?exportSanitizedLogs/);
  assert.doesNotMatch(preloadSource, /launcher:open-logs/);
  assert.doesNotMatch(electronMain, /launcher:open-logs/);
});

test("MCP verification failures stay inside the structured setup report", () => {
  assert.match(appSource, /next\.operation\.name !== "mcp-verification"/);
  assert.match(appSource, /next\.name !== "mcp-verification"/);
  assert.match(electronMain, /Finish the active Codex task before verifying the ChatGPT connector/);
  assert.match(electronMain, /report\.checks\.filter\(\(check\) => check\.id !== "connector"\)/);
  assert.match(electronMain, /mcp\.verification_requested/);
  assert.match(electronMain, /launcherFocused:\s*mainWindow\?\.isFocused\(\) === true/);
  assert.match(electronMain, /rendererFocused:\s*event\.sender\.isFocused\(\)/);
});

test("MCP verification proves runtime health before checking the connector", () => {
  const start = electronMain.indexOf('handle("launcher:mcp-verify"');
  const end = electronMain.indexOf('handle("launcher:doctor"', start);
  const handler = electronMain.slice(start, end);

  assert.ok(start >= 0 && end > start, "MCP verification handler must remain registered");
  assert.match(
    handler,
    /Checking local runtime[\s\S]*?await runtimeHost\.doctor\(\)[\s\S]*?if \(!report\.ok\)[\s\S]*?return report;[\s\S]*?Checking ChatGPT connector[\s\S]*?await browserHost\.verifyConnector/,
  );
  assert.match(handler, /publishOperation\(\{ name: operationName, status: "completed"/);
  assert.match(appSource, /onClick=\{\(\) => void \(doctor\?\.ok \? onDone\(\) : verify\(\)\)\}/);
  assert.match(appSource, /operation\?\.name === "mcp-verification"/);
});

test("saved ChatGPT authentication is refreshed before setup is presented", () => {
  assert.match(electronMain, /browserHost\.refreshAuthentication\(\)/);
  const productionStartup = electronMain.indexOf("} else void (async () => {");
  const refreshBarrier = electronMain.indexOf("await startupAuthenticationRefresh", productionStartup);
  const upgrade = electronMain.indexOf("runtimeHost.upgradeManagedRuntime()", productionStartup);
  const runtimeStart = electronMain.indexOf("runtimeSupervisor.startIfConfigured()", upgrade);
  const routeConnect = electronMain.indexOf("runtimeHost.connectBridgeRoute()", runtimeStart);
  assert.ok(refreshBarrier > productionStartup, "production startup must wait for saved-session refresh");
  assert.ok(upgrade > refreshBarrier, "runtime upgrade must not inspect the browser before refresh settles");
  assert.ok(runtimeStart > upgrade, "configured runtime must start after any upgrade");
  assert.ok(routeConnect > runtimeStart, "Codex route must connect only after the runtime is healthy");
  assert.match(appSource, /browser\?\.status === "loading" \? copy\.checkingSignIn/);
});

test("completed model setup remains a repeatable capability probe", () => {
  assert.match(appSource, /<SetupRow[\s\S]*?onAction=\{install\}[\s\S]*?repeatable/);
  assert.match(appSource, /complete && !repeatable/);
  assert.match(
    electronMain,
    /!setupState\.coreSetupComplete[\s\S]*?smokePassedThisSession[\s\S]*?smokePassedForCurrentVersion\(setupState\)/,
  );
});

test("session reminders expose dismissal and a real storage-clearing logout", () => {
  assert.match(electronMain, /sessionRefreshReminderAt:\s*nextSessionRefreshReminderAt\(\)/);
  assert.match(electronMain, /launcher:session-reminder-dismiss/);
  assert.match(electronMain, /launcher:browser-logout[\s\S]*?browserHost\.logout\(\)/);
  assert.match(preloadSource, /dismissSessionReminder:[\s\S]*?launcher:session-reminder-dismiss/);
  assert.match(preloadSource, /logoutChatGpt:[\s\S]*?launcher:browser-logout/);
  assert.match(browserHostSource, /session\.clearStorageData\(\)/);
});
