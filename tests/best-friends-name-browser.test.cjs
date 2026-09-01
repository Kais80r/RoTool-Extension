"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

function findEdgeExecutable() {
  const configured = process.env.ROTOOL_EDGE_BIN;
  if (configured && fs.existsSync(configured)) return configured;
  if (process.platform !== "win32") return null;
  for (const root of [
    process.env["ProgramFiles(x86)"],
    process.env.ProgramFiles,
    process.env.LOCALAPPDATA
  ].filter(Boolean).map((value) => path.join(value, "Microsoft", "Edge", "Application"))) {
    const direct = path.join(root, "msedge.exe");
    if (fs.existsSync(direct)) return direct;
    if (!fs.existsSync(root)) continue;
    const versioned = fs.readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^\d+(?:\.\d+){3}$/.test(entry.name))
      .sort((left, right) => right.name.localeCompare(left.name, undefined, { numeric: true }))
      .map((entry) => path.join(root, entry.name, "msedge.exe"))
      .find((candidate) => fs.existsSync(candidate));
    if (versioned) return versioned;
  }
  return null;
}

const edge = findEdgeExecutable();
if (!edge) {
  console.log("SKIP Best Friends name real-browser fixture (Edge unavailable)");
  process.exit(0);
}

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rsl-best-friend-name-"));
assert.equal(path.dirname(path.resolve(temporaryRoot)), path.resolve(os.tmpdir()));
try {
  const result = spawnSync(edge, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--allow-file-access-from-files",
    "--run-all-compositor-stages-before-draw",
    "--window-size=500,300",
    `--user-data-dir=${path.join(temporaryRoot, "profile")}`,
    "--virtual-time-budget=3000",
    "--dump-dom",
    pathToFileURL(path.resolve(__dirname, "best-friends-name-browser-fixture.html")).href
  ], { encoding: "utf8", timeout: 20_000, windowsHide: true });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const bodyTag = result.stdout.match(/<body[^>]*>/)?.[0] || "";
  assert.match(bodyTag, /data-test-result="pass"/, `Best Friends name fixture failed: ${bodyTag}`);
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log("PASS Best Friends keeps Korn visible with Verified and Roblox Plus badges");
