"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "manifest.json"), "utf8"));
const packageFiles = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "updater", "package-files.json"), "utf8")
);
const updaterSource = fs.readFileSync(
  path.join(projectRoot, "updater", "Update-RoTool.ps1"),
  "utf8"
);
const schedulerTemplate = fs.readFileSync(
  path.join(projectRoot, "join-scheduler.html"),
  "utf8"
);
const releaseBuilderSource = fs.readFileSync(
  path.join(projectRoot, "tools", "build-release.ps1"),
  "utf8"
);

assert.equal(manifest.version, "0.19.6", "the current release ships as RoTool 0.19.6");
assert.equal(
  manifest.minimum_chrome_version,
  "102",
  "the in-page permission relay requires Chrome/Edge 102 user-gesture propagation"
);
assert.ok(Array.isArray(manifest.permissions));
assert.equal(
  manifest.permissions.includes("notifications"),
  false,
  "notifications must not be a mandatory install-time permission"
);
assert.ok(Array.isArray(manifest.optional_permissions));
assert.deepEqual(
  manifest.optional_permissions.filter((permission) => permission === "notifications"),
  ["notifications"],
  "notifications are requested only when a user explicitly schedules a notification"
);
assert.deepEqual(manifest.permissions, [
  "storage", "alarms", "contextMenus", "clipboardWrite", "scripting"
], "game icons add no browser capability or install warning");
assert.deepEqual(manifest.optional_permissions, ["notifications"],
  "the game-icon path adds no optional capability");
assert.deepEqual(manifest.host_permissions, [
  "https://www.roblox.com/*",
  "https://create.roblox.com/*",
  "https://thumbnails.roblox.com/*",
  "https://friends.roblox.com/*",
  "https://users.roblox.com/*",
  "https://presence.roblox.com/*",
  "https://games.roblox.com/*",
  "https://apis.roblox.com/*",
  "https://economy.roblox.com/*",
  "https://assetdelivery.roblox.com/*",
  "https://*.rbxcdn.com/*"
], "game icons reuse the already-declared Roblox thumbnail/CDN hosts");
assert.equal(
  [...manifest.permissions, ...manifest.optional_permissions].includes("background"),
  false,
  "V1 must not claim it can keep a sleeping or closed browser alive"
);

const schedulerFiles = [
  "join-scheduler.html",
  "join-scheduler.css",
  "join-scheduler.js"
];
assert.equal(packageFiles.length, 21, "the strict runtime allowlist includes the three Scheduler assets");
assert.match(
  releaseBuilderSource,
  /\$packageFiles\.Count\s+-ne\s+21[\s\S]*?exactly 21 managed files/,
  "the deterministic release builder accepts the 21-file runtime package"
);
assert.equal(new Set(packageFiles).size, packageFiles.length, "the runtime allowlist has no duplicates");
for (const relativePath of schedulerFiles) {
  assert.equal(
    packageFiles.filter((entry) => entry === relativePath).length,
    1,
    `${relativePath} is packaged exactly once`
  );
  assert.ok(fs.statSync(path.join(projectRoot, relativePath)).isFile(), `${relativePath} exists`);
}

const robloxContentEntry = manifest.content_scripts.find((entry) =>
  Array.isArray(entry?.matches) && entry.matches.includes("https://www.roblox.com/*") &&
  Array.isArray(entry?.js) && entry.js.includes("content.js")
);
assert.ok(robloxContentEntry, "missing the isolated Roblox content-script entry");
assert.equal(
  robloxContentEntry.js?.filter((entry) => entry === "join-scheduler.js").length,
  1,
  "the Scheduler controller is injected exactly once in the isolated Roblox world"
);
assert.ok(
  robloxContentEntry.js.indexOf("join-scheduler.js") <
    robloxContentEntry.js.indexOf("content.js"),
  "the modal global is installed before content.js can bind sidebar or Event launchers"
);
assert.equal(
  robloxContentEntry.css?.includes("join-scheduler.css"),
  false,
  "Scheduler CSS is shadow-only and must not leak into Roblox's document"
);
assert.equal(
  robloxContentEntry.js?.includes("join-scheduler.html"),
  false,
  "the inert template is fetched by the controller, never executed"
);

assert.match(schedulerTemplate, /^\s*<template\b[^>]*id="rsl-join-scheduler-template"/i);
assert.match(schedulerTemplate, /<\/template>\s*$/i);
assert.doesNotMatch(
  schedulerTemplate,
  /<!doctype|<html\b|<head\b|<body\b|<script\b|<link\b|<meta\b[^>]*http-equiv\s*=|\son[a-z]+\s*=|<form\b[^>]*\baction\s*=|<iframe\b/i,
  "the packaged HTML is inert component markup, not a navigable extension page"
);
assert.doesNotMatch(schedulerTemplate, /\b(?:src|href)\s*=\s*["'](?!#|data:|https:|chrome-extension:)[^"']+["']/i,
  "the inert template has no unresolved relative asset URLs"
);
assert.doesNotMatch(schedulerTemplate, /data-private-url[^>]*\bvalue\s*=/i);

const schedulerWarEntries = (manifest.web_accessible_resources || []).filter((entry) =>
  Array.isArray(entry?.resources) &&
  entry.resources.some((resource) => resource.startsWith("join-scheduler."))
);
assert.equal(schedulerWarEntries.length, 1, "Scheduler exposes one exact static-resource rule");
assert.deepEqual(
  [...schedulerWarEntries[0].resources].sort(),
  ["join-scheduler.css", "join-scheduler.html"],
  "only the inert template and shadow stylesheet are web-accessible"
);
assert.deepEqual(
  schedulerWarEntries[0].matches,
  ["https://www.roblox.com/*"],
  "Scheduler resources are readable only from exact Roblox pages"
);
const exposedResources = (manifest.web_accessible_resources || [])
  .flatMap((entry) => Array.isArray(entry?.resources) ? entry.resources : []);
assert.equal(
  exposedResources.includes("join-scheduler.js"),
  false,
  "the Scheduler controller is never web-accessible"
);

assert.match(
  updaterSource,
  /^\$script:UpdaterVersion\s*=\s*"1\.2\.3"\s*$/m,
  "the corrected 21-file updater-core contract advances to 1.2.3"
);

console.log("PASS Join Scheduler manifest, permission, packaging, and updater contract");
