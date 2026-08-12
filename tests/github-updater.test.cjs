"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const updaterRoot = path.join(projectRoot, "updater");
const updaterSource = fs.readFileSync(path.join(updaterRoot, "Update-RoTool.ps1"), "utf8");
const commandSource = fs.readFileSync(path.join(updaterRoot, "Update RoTool.cmd"), "utf8");
const updaterReadme = fs.readFileSync(path.join(updaterRoot, "README.md"), "utf8");
const mainReadme = fs.readFileSync(path.join(projectRoot, "README.md"), "utf8");
const gitignore = fs.readFileSync(path.join(projectRoot, ".gitignore"), "utf8");
const ciWorkflow = fs.readFileSync(path.join(projectRoot, ".github", "workflows", "ci.yml"), "utf8");
const releaseWorkflow = fs.readFileSync(path.join(projectRoot, ".github", "workflows", "release.yml"), "utf8");
const releaseBuilder = fs.readFileSync(path.join(projectRoot, "tools", "build-release.ps1"), "utf8");
const exampleConfiguration = JSON.parse(
  fs.readFileSync(path.join(updaterRoot, "updater.config.example.json"), "utf8")
);
const packageFiles = JSON.parse(fs.readFileSync(path.join(updaterRoot, "package-files.json"), "utf8"));

const expectedPackageFiles = [
  "manifest.json",
  "background.js",
  "content.js",
  "styles.css",
  "context-copy.css",
  "context-copy.js",
  "page-bridge.js",
  "README.md",
  "icons/id-16.png",
  "icons/id-32.png",
  "icons/id-48.png",
  "icons/id-128.png",
  "icons/rotool-16.png",
  "icons/rotool-32.png",
  "icons/rotool-48.png",
  "icons/rotool-128.png",
  "icons/rotool-source.svg",
  "icons/THIRD_PARTY.md"
];

assert.deepEqual(packageFiles, expectedPackageFiles, "managed release allowlist must stay explicit and exact");
assert.equal(new Set(packageFiles.map((item) => item.toLowerCase())).size, packageFiles.length);
for (const relative of packageFiles) {
  assert.ok(fs.statSync(path.join(projectRoot, ...relative.split("/"))).isFile(), `${relative} must exist`);
}

assert.match(updaterSource, /RoTool-extension\.zip/);
assert.match(updaterSource, /RoTool-extension\.zip\.sha256/);
assert.match(updaterSource, /MaximumArchiveBytes/);
assert.match(updaterSource, /MaximumEntryBytes/);
assert.match(updaterSource, /MaximumExtractedBytes/);
assert.match(updaterSource, /Get-FileHash -Algorithm SHA256/);
assert.match(updaterSource, /Restore-RoToolBackup/);
assert.match(updaterSource, /Repair-RoToolInterruptedUpdate/);
assert.match(updaterSource, /\.rotool-new-/);
assert.doesNotMatch(updaterSource, /github(?:usercontent)?\.com[^"'\r\n]*\.(?:js|wasm)/i);
assert.doesNotMatch(updaterSource, /Remove-Item\s+-LiteralPath\s+\$installRoot\b/i);

assert.match(commandSource, /-NoProfile/);
assert.match(commandSource, /-File "%~dp0Update-RoTool\.ps1"/);
assert.match(commandSource, /%ERRORLEVEL%/);
assert.match(updaterReadme, /permanent folder/i);
assert.match(updaterReadme, /Do not rename, move, remove, or load that extension again/i);
assert.match(updaterReadme, /verifies its checksum/i);
assert.match(updaterReadme, /replaces only RoTool's managed runtime files/i);
assert.match(updaterReadme, /Press \*\*Reload\*\* on that same RoTool card/i);
assert.match(updaterReadme, /never place a GitHub access token/i);
assert.match(updaterReadme, /Kais80r\/RoTool-Extension/);
assert.match(mainReadme, /^## Updating an unpacked copy from GitHub$/m);
assert.match(mainReadme, /RoTool-setup\.zip/);
assert.match(mainReadme, /keep that exact folder path/i);
assert.match(mainReadme, /do not remove the existing extension/i);
assert.match(mainReadme, /double-click `updater\/Update RoTool\.cmd`/i);
assert.match(mainReadme, /does not access the browser profile or delete unrecognized local files/i);
assert.match(mainReadme, /press \*\*Reload\*\* on the same RoTool card/i);
assert.match(mainReadme, /GitHub workflow runs every test/i);
assert.match(mainReadme, /Never put a GitHub token/i);
assert.deepEqual(exampleConfiguration, {
  repository: "Kais80r/RoTool-Extension",
  browser: "edge"
});
assert.match(releaseBuilder, /\[string\]\$Repository = "Kais80r\/RoTool-Extension"/);
assert.match(gitignore, /^updater\/updater\.config\.json$/m);
assert.match(gitignore, /^dist\/$/m);

assert.match(ciWorkflow, /^\s*pull_request:/m);
assert.match(ciWorkflow, /permissions:\s*\r?\n\s*contents: read/);
assert.match(ciWorkflow, /runs-on: windows-latest/);
assert.match(ciWorkflow, /node --check content\.js/);
assert.match(ciWorkflow, /node --check background\.js/);
assert.match(ciWorkflow, /ParseFile\(\(Resolve-Path 'updater\/Update-RoTool\.ps1'/);
assert.match(ciWorkflow, /Get-ChildItem tests -Filter '\*\.test\.cjs'/);
assert.match(ciWorkflow, /node tests\/run-background-fixture\.cjs/);
assert.match(ciWorkflow, /\.\/tools\/build-release\.ps1 -OutputDirectory dist/);
assert.match(ciWorkflow, /actions\/upload-artifact@v4/);
assert.match(ciWorkflow, /if-no-files-found: error/);

assert.match(releaseWorkflow, /tags:\s*\r?\n\s*- ['"]v/);
assert.match(releaseWorkflow, /permissions:\s*\r?\n\s*contents: write/);
assert.match(releaseWorkflow, /cancel-in-progress: false/);
assert.match(releaseWorkflow, /GITHUB_REF_NAME -ne "v\$version"/);
assert.match(releaseWorkflow, /Get-ChildItem tests -Filter '\*\.test\.cjs'/);
assert.match(releaseWorkflow, /node tests\/run-background-fixture\.cjs/);
assert.match(releaseWorkflow, /-Repository \$env:GITHUB_REPOSITORY -ExpectedTag \$env:GITHUB_REF_NAME/);
assert.match(releaseWorkflow, /GH_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);
assert.match(releaseWorkflow, /gh release create \$env:GITHUB_REF_NAME/);
for (const asset of [
  "dist/RoTool-extension.zip",
  "dist/RoTool-extension.zip.sha256",
  "dist/RoTool-setup.zip",
  "dist/RoTool-setup.zip.sha256"
]) {
  assert.match(releaseWorkflow, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}
assert.match(releaseWorkflow, /--verify-tag/);
assert.match(releaseWorkflow, /--latest/);

const fixture = spawnSync(
  "powershell.exe",
  [
    "-NoLogo",
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    path.join(__dirname, "github-updater-fixture.ps1"),
    "-ProjectRoot",
    projectRoot
  ],
  {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
    env: {
      ...process.env,
      PSModulePath: [
        process.env.PSModulePath,
        path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "Modules")
      ].filter(Boolean).join(path.delimiter)
    }
  }
);

const fixtureBlockedByLocalSandbox = fixture.status === null && fixture.error?.code === "EPERM";
if (fixture.status !== 0 && !fixtureBlockedByLocalSandbox) {
  process.stderr.write(fixture.stdout || "");
  process.stderr.write(fixture.stderr || "");
}
if (fixtureBlockedByLocalSandbox) {
  console.warn("SKIP nested PowerShell fixture: local sandbox denied child-process launch");
} else {
  assert.equal(fixture.status, 0, "PowerShell updater safety fixture must pass");
  assert.match(fixture.stdout, /PASS RoTool GitHub updater safety and release fixture \(\d+ assertions\)/);
}

console.log("PASS RoTool GitHub updater, release workflow, package, and documentation contracts");
