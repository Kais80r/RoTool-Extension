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
  const applicationRoots = [
    process.env["ProgramFiles(x86)"],
    process.env.ProgramFiles,
    process.env.LOCALAPPDATA
  ].filter(Boolean).map((root) =>
    path.join(root, "Microsoft", "Edge", "Application")
  );
  for (const applicationRoot of applicationRoots) {
    if (!fs.existsSync(applicationRoot)) continue;
    const versioned = fs.readdirSync(applicationRoot, { withFileTypes: true })
      .filter((entry) =>
        entry.isDirectory() && /^\d+(?:\.\d+){3}$/.test(entry.name)
      )
      .sort((left, right) => right.name.localeCompare(
        left.name,
        undefined,
        { numeric: true }
      ))
      .map((entry) => path.join(applicationRoot, entry.name, "msedge.exe"))
      .find((candidate) => fs.existsSync(candidate));
    if (versioned) return versioned;
    const direct = path.join(applicationRoot, "msedge.exe");
    if (fs.existsSync(direct)) return direct;
  }
  return null;
}

const edge = findEdgeExecutable();
if (!edge) {
  console.log("SKIP RoTool Settings real-browser fixture (Edge unavailable)");
  process.exit(0);
}

const fixturePath = path.resolve(
  __dirname,
  "feature-settings-browser-fixture.html"
);
const temporaryRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "rsl-feature-settings-")
);
assert.equal(path.dirname(path.resolve(temporaryRoot)), path.resolve(os.tmpdir()));
const profilePath = path.join(temporaryRoot, "profile");
let result;
try {
  result = spawnSync(edge, [
    "--headless=new",
    "--disable-gpu",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--no-first-run",
    "--allow-file-access-from-files",
    "--run-all-compositor-stages-before-draw",
    `--user-data-dir=${profilePath}`,
    "--virtual-time-budget=10000",
    "--dump-dom",
    pathToFileURL(fixturePath).href
  ], { encoding: "utf8", timeout: 30_000, windowsHide: true });
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

assert.equal(result.status, 0, result.stderr || result.error?.message);
const bodyTag = result.stdout.match(/<body[^>]*>/)?.[0] || "";
assert.match(
  bodyTag,
  /<body[^>]*data-test-result="pass"/,
  `RoTool Settings real-browser fixture failed: ${bodyTag}\n${result.stderr}`
);
console.log("PASS RoTool Settings real-browser master-switch fixture");
