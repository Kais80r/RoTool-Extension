"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const contentSource = fs.readFileSync(path.join(projectRoot, "content.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(projectRoot, "styles.css"), "utf8");
globalThis.__rslContentTestHooks = { skipInitialize: true };
require(path.join(projectRoot, "content.js"));
const hooks = globalThis.__rslContentTestHooks;

const expectedTypes = [
  "home", "game", "profile", "community", "marketplace", "inventory",
  "avatar", "friends", "trade", "message", "chart", "settings", "gift",
  "premium", "create", "calendar", "schedule", "history", "external",
  "link"
];
assert.deepEqual(Object.keys(hooks.shortcutIconMarkup), expectedTypes);
for (const [type, markup] of Object.entries(hooks.shortcutIconMarkup)) {
  assert.equal(typeof markup, "string", `${type} markup must be a string`);
  assert.ok(markup.startsWith("<"), `${type} markup must contain SVG elements`);
  assert.doesNotMatch(markup, /<(?:script|style|image|foreignObject)\b/i);
}

const typeCases = [
  ["https://www.roblox.com/home", "home"],
  ["https://www.roblox.com/games/123/example", "game"],
  ["https://www.roblox.com/users/123/profile", "profile"],
  ["https://www.roblox.com/communities/123/example", "community"],
  ["https://www.roblox.com/catalog/123/example", "marketplace"],
  ["https://www.roblox.com/users/123/inventory", "inventory"],
  ["https://www.roblox.com/my/avatar", "avatar"],
  ["https://www.roblox.com/users/friends#!/friend-requests", "friends"],
  ["https://www.roblox.com/trades", "trade"],
  ["https://www.roblox.com/my/messages/#!/inbox", "message"],
  ["https://www.roblox.com/charts", "chart"],
  ["https://www.roblox.com/my/account", "settings"],
  ["https://www.roblox.com/giftcards-us", "gift"],
  ["https://www.roblox.com/premium/membership", "premium"],
  ["https://create.roblox.com/dashboard/creations", "create"],
  ["https://example.com/", "external"],
  ["not a url", "link"]
];
for (const [url, expected] of typeCases) {
  assert.equal(hooks.getShortcutIconType(url), expected, url);
}

assert.deepEqual(
  hooks.getThumbnailTarget("https://www.roblox.com/users/123/profile"),
  { kind: "profile", id: "123" }
);
assert.deepEqual(
  hooks.getThumbnailTarget("https://www.roblox.com/games/456/example"),
  { kind: "game", id: "456" }
);
assert.deepEqual(
  hooks.getThumbnailTarget("https://www.roblox.com/communities/789/example"),
  { kind: "community", id: "789" }
);
assert.equal(hooks.getThumbnailTarget("https://example.com/users/123"), null);

assert.match(
  contentSource,
  /function makeShortcutRow\([\s\S]*?icon\.classList\.add\("rsl-sidebar-icon--custom"\)/
);
assert.match(
  contentSource,
  /function updateShortcutRow\([\s\S]*?icon\.classList\.add\("rsl-sidebar-icon--custom"\)/
);
assert.match(
  stylesSource,
  /\.rsl-sidebar-icon--custom \.rsl-sidebar-thumbnail\s*\{[\s\S]*?width: 32px;[\s\S]*?height: 32px;[\s\S]*?border-radius: 6px;/
);
assert.match(
  stylesSource,
  /\.rsl-sidebar-icon--custom\.rsl-owned-thumbnail-frame[\s\S]*?background-color: transparent;/
);
assert.match(
  stylesSource,
  /\.rsl-sidebar-icon--plus::before,[\s\S]*?width: 16px;[\s\S]*?height: 2px;/
);
assert.match(
  stylesSource,
  /\.rsl-sidebar-icon--shortcut > svg\s*\{[\s\S]*?stroke-width: 1\.8;/
);

delete globalThis.__rslContentTestHooks;
console.log("PASS RoTool custom shortcut icon routing and thumbnail presentation");
