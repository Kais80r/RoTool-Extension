"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

function findEdgeExecutable() {
  if (process.env.ROTOOL_SKIP_REAL_EDGE === "1") return null;
  const configured = process.env.ROTOOL_EDGE_BIN;
  if (configured && fs.existsSync(configured)) return configured;
  if (process.platform !== "win32") return null;
  const roots = [
    process.env["ProgramFiles(x86)"],
    process.env.ProgramFiles,
    process.env.LOCALAPPDATA
  ].filter(Boolean).map((root) =>
    path.join(root, "Microsoft", "Edge", "Application")
  );
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const versioned = fs.readdirSync(root, { withFileTypes: true })
      .filter((entry) =>
        entry.isDirectory() && /^\d+(?:\.\d+){3}$/.test(entry.name)
      )
      .sort((left, right) => right.name.localeCompare(
        left.name,
        undefined,
        { numeric: true }
      ))
      .map((entry) => path.join(root, entry.name, "msedge.exe"))
      .find((candidate) => fs.existsSync(candidate));
    if (versioned) return versioned;
    const direct = path.join(root, "msedge.exe");
    if (fs.existsSync(direct)) return direct;
  }
  return null;
}

const edge = findEdgeExecutable();
if (!edge) {
  console.log("SKIP Enhanced Profile real-browser fixture (Edge unavailable)");
  process.exit(0);
}

const fixturePath = path.resolve(__dirname, "enhanced-profile-browser-fixture.html");
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rsl-profile-ui-"));
assert.equal(path.dirname(path.resolve(temporaryRoot)), path.resolve(os.tmpdir()));
const configuredViewports = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 500, height: 900 }
];
const requestedViewport = process.env.ROTOOL_PROFILE_VIEWPORT;
const viewports = requestedViewport
  ? configuredViewports.filter(({ name }) => name === requestedViewport)
  : configuredViewports;
assert.ok(viewports.length > 0, `Unknown profile viewport: ${requestedViewport}`);
const results = [];
try {
  for (const viewport of viewports) {
    const profilePath = path.join(temporaryRoot, `profile-${viewport.name}`);
    const result = spawnSync(edge, [
      "--headless=new",
      "--disable-gpu",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--no-first-run",
      "--allow-file-access-from-files",
      "--run-all-compositor-stages-before-draw",
      `--window-size=${viewport.width},${viewport.height}`,
      `--user-data-dir=${profilePath}`,
      "--virtual-time-budget=10000",
      "--dump-dom",
      pathToFileURL(fixturePath).href
    ], { encoding: "utf8", timeout: 30_000, windowsHide: true });
    results.push({ viewport, result });
  }
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

for (const { viewport, result } of results) {
  assert.equal(
    result.status,
    0,
    `${viewport.name}: ${result.stderr || result.error?.message}`
  );
  const bodyTag = result.stdout.match(/<body[^>]*>/)?.[0] || "";
  assert.match(
    bodyTag,
    /<body[^>]*data-test-result="pass"/,
    `Enhanced Profile ${viewport.name} fixture failed: ${bodyTag}\n${result.stderr}`
  );
}
console.log(
  "PASS Enhanced Profile closed-shadow, RoPro, restore, SPA, and responsive visual fixtures"
);
