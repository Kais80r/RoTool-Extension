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
assert.match(updaterSource, /RoTool-updater\.zip/);
assert.match(updaterSource, /RoTool-updater\.zip\.sha256/);
assert.match(updaterSource, /UpdaterCoreFiles/);
assert.match(updaterSource, /MaximumArchiveBytes/);
assert.match(updaterSource, /MaximumEntryBytes/);
assert.match(updaterSource, /MaximumExtractedBytes/);
assert.match(updaterSource, /Security\.Cryptography\.SHA256/);
assert.doesNotMatch(updaterSource, /Get-FileHash/);
assert.match(updaterSource, /Restore-RoToolBackup/);
assert.match(updaterSource, /Repair-RoToolInterruptedUpdate/);
assert.match(updaterSource, /\.rotool-new-/);
assert.match(updaterSource, /function Resolve-RoToolBrowser/);
assert.match(updaterSource, /ChromeUserDataRoot/);
assert.match(updaterSource, /EdgeUserDataRoot/);
assert.match(updaterSource, /Local State/);
assert.match(updaterSource, /Secure Preferences/);
assert.match(updaterSource, /PSObject\.Properties\["extensions"\]/);
assert.match(updaterSource, /PSObject\.Properties\["settings"\]/);
assert.match(updaterSource, /PSObject\.Properties\["path"\]/);
assert.match(updaterSource, /--new-tab/);
assert.match(updaterSource, /chrome:\/\/extensions\//);
assert.match(updaterSource, /edge:\/\/extensions\//);
assert.match(updaterSource, /ShowWindowAsync/);
assert.match(updaterSource, /SetForegroundWindow/);
assert.match(updaterSource, /GetForegroundWindow/);
assert.match(updaterSource, /GetWindowThreadProcessId/);
assert.match(updaterSource, /function Test-RoToolForegroundBrowser/);
assert.match(updaterSource, /function Set-RoToolBrowserInternalPage/);
assert.match(updaterSource, /StartProcessAction[\s\S]*@\("--new-tab"\)/);
assert.doesNotMatch(updaterSource, /StartProcessAction[^\r\n]*--new-tab[^\r\n]*(?:chrome|edge):\/\/extensions/);
assert.match(updaterSource, /if \(-not \$focused\)[\s\S]*NavigateAction/);
assert.match(updaterSource, /Refusing to enter an unexpected browser address/);
assert.match(updaterSource, /SendKeys\]::SendWait/);
assert.doesNotMatch(updaterSource, /["'](?:Cookies|Login Data|Web Data)["']/i);
assert.doesNotMatch(updaterSource, /\.ROBLOSECURITY|access[_ -]?token|refresh[_ -]?token/i);
assert.doesNotMatch(updaterSource, /github(?:usercontent)?\.com[^"'\r\n]*\.(?:js|wasm)/i);
assert.doesNotMatch(updaterSource, /Remove-Item\s+-LiteralPath\s+\$installRoot\b/i);

assert.match(commandSource, /-NoProfile/);
assert.match(commandSource, /-File "%~dp0Update-RoTool\.ps1"/);
assert.match(commandSource, /%ERRORLEVEL%/);
assert.match(commandSource, /if\s+"?%ROTOOL_UPDATE_EXIT%"?\s*==\s*"?0"?\s+exit\s+\/b\s+0[\s\S]*pause/i);
assert.doesNotMatch(commandSource, /pause[\s\S]*exit\s+\/b\s+0/i);
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
assert.match(mainReadme, /Preferences.*Secure Preferences|Secure Preferences.*Preferences/i);
assert.match(mainReadme, /extension registration metadata/i);
assert.match(mainReadme, /never reads? cookies.*history.*passwords|never reads? cookies, history, or passwords/i);
assert.match(mainReadme, /press \*\*Reload\*\* on the same RoTool card/i);
assert.match(mainReadme, /GitHub workflow runs every test/i);
assert.match(mainReadme, /Never put a GitHub token/i);
assert.deepEqual(exampleConfiguration, {
  repository: "Kais80r/RoTool-Extension",
  browser: "auto",
  configVersion: 2
});
assert.match(releaseBuilder, /\[string\]\$Repository = "Kais80r\/RoTool-Extension"/);
assert.match(releaseBuilder, /browser\s*=\s*"auto"/);
assert.match(releaseBuilder, /configVersion\s*=\s*2/);
assert.match(updaterSource, /configVersion/);
assert.match(updaterSource, /Browser\s*=\s*"auto"|browser\s*=\s*"auto"/);
assert.match(updaterSource, /if\s*\(\$comparison\s+-eq\s+0[\s\S]*Open-RoToolExtensionsPage/);
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
  "dist/RoTool-updater.zip",
  "dist/RoTool-updater.zip.sha256",
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
