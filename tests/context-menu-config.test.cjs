"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "manifest.json"), "utf8"));

assert.equal(manifest.name, "RoTool");
assert.equal(manifest.short_name, "RoTool");
assert.equal(manifest.version, "0.17.3");
assert.match(manifest.description, /Best Friends/);
assert.ok(manifest.permissions.includes("storage"));
assert.ok(manifest.permissions.includes("contextMenus"));
for (const size of [16, 32, 48, 128]) {
  const relativeIconPath = manifest.icons[String(size)];
  assert.equal(relativeIconPath, `icons/rotool-${size}.png`);
  const png = fs.readFileSync(path.join(projectRoot, relativeIconPath));
  assert.equal(png.toString("ascii", 1, 4), "PNG");
  assert.equal(png.readUInt32BE(16), size);
  assert.equal(png.readUInt32BE(20), size);
}
const iconSource = fs.readFileSync(path.join(projectRoot, "icons", "rotool-source.svg"), "utf8");
assert.ok(!iconSource.includes("<rect"), "RoTool icon should have a transparent background");
assert.ok(iconSource.includes('viewBox="-16 -4 128 128"'));
assert.ok(iconSource.includes('transform="translate(-7 5) scale(4.6)"'));
assert.ok(iconSource.includes('transform="translate(5 20) scale(.18)"'));
assert.ok(
  iconSource.indexOf("M2 17.88") < iconSource.indexOf("m280.16 242.79"),
  "the foreground hammer must be drawn after the Roblox mark"
);

const createdItems = [];
const hooks = {};
const chrome = {
  runtime: {
    id: "fixture-extension",
    lastError: null,
    onInstalled: { addListener() {} },
    onMessage: { addListener() {} }
  },
  contextMenus: {
    create(properties, callback) {
      createdItems.push({ ...properties });
      callback?.();
    },
    removeAll(callback) {
      createdItems.length = 0;
      callback?.();
    },
    onClicked: { addListener() {} }
  },
  tabs: { sendMessage() {} }
};

const sandbox = {
  URL,
  AbortController,
  TextDecoder,
  console,
  chrome,
  fetch: async () => { throw new Error("Unexpected fixture fetch"); },
  setTimeout,
  clearTimeout,
  globalThis: null,
  __rslBackgroundTestHooks: hooks
};
sandbox.globalThis = sandbox;
vm.runInNewContext(
  fs.readFileSync(path.join(projectRoot, "background.js"), "utf8"),
  sandbox,
  { filename: "background.js" }
);

const actions = hooks.contextMenuActions;
const expectedDirectActions = [
  ["user", "Copy User ID", "userId"],
  ["place", "Copy Place ID", "placeId"],
  ["universe", "Copy Universe ID", "universeId"],
  ["community", "Copy Community ID", "groupId"],
  ["community-role", "Copy Community Role ID", "groupRoleId"],
  ["bundle", "Copy Bundle ID", "bundleId"],
  ["badge", "Copy Badge ID", "badgeId"],
  ["game-pass", "Copy Game Pass ID", "gamePassId"],
  ["outfit", "Copy Outfit ID", "outfitId"],
  ["developer-product", "Copy Developer Product ID", "developerProductId"],
  [
    "experience-subscription",
    "Copy Experience Subscription ID",
    "experienceSubscriptionId"
  ]
];
const assetGroup = actions.find((item) => item.key === "asset-ids");
assert.equal(assetGroup.title, "Copy Texture ID / Asset ID");
assert.deepEqual(
  Array.from(assetGroup.children, (child) => [child.key, child.title, child.action]),
  [
    ["texture", "Copy Texture ID", "textureId"],
    ["asset", "Copy Asset ID", "assetId"]
  ]
);
const directActions = Array.from(actions).filter((item) => !item.children);
assert.deepEqual(
  directActions.map((item) => [item.key, item.title, item.action]),
  expectedDirectActions
);
assert.ok(directActions.every((item) => item.action));

const leafActions = Array.from(actions).flatMap((item) =>
  item.children ? Array.from(item.children) : [item]
);

const parse = hooks.parseRobloxContextUrl;
const availableActions = (url) => {
  const context = parse(url);
  return Array.from(
    leafActions
      .filter((item) => hooks.isContextActionAvailable(item.action, context))
      .map((item) => item.action)
  );
};

assert.deepEqual(
  availableActions("https://www.roblox.com/games/123/example"),
  ["placeId", "universeId"]
);
assert.deepEqual(
  availableActions(
    "https://create.roblox.com/dashboard/creations/experiences/456/overview"
  ),
  ["universeId"]
);
assert.deepEqual(
  availableActions(
    "https://create.roblox.com/dashboard/creations/experiences/456/places/123/configure"
  ),
  ["placeId", "universeId"]
);
assert.deepEqual(
  availableActions(
    "https://create.roblox.com/dashboard/creations/experiences/456/badges/789/overview"
  ),
  ["universeId", "badgeId"]
);
assert.deepEqual(
  availableActions(
    "https://create.roblox.com/dashboard/creations/experiences/456/passes/789/sales"
  ),
  ["universeId", "gamePassId"]
);
assert.deepEqual(
  availableActions(
    "https://create.roblox.com/dashboard/creations/experiences/456/monetization/developer-products/789/overview"
  ),
  ["universeId", "developerProductId"]
);
assert.deepEqual(
  availableActions(
    "https://create.roblox.com/dashboard/creations/experiences/456/experience-subscriptions/EXP-789/overview"
  ),
  ["universeId", "experienceSubscriptionId"]
);
assert.deepEqual(
  availableActions("https://www.roblox.com/users/10/profile"),
  ["userId"]
);
assert.deepEqual(
  availableActions("https://www.roblox.com/users/10/outfits/20"),
  ["userId", "outfitId"]
);
assert.deepEqual(
  availableActions("https://www.roblox.com/communities/30/example"),
  ["groupId"]
);
assert.deepEqual(
  availableActions("https://create.roblox.com/dashboard/group/roles/40?groupId=30"),
  ["groupId", "groupRoleId"]
);
assert.deepEqual(
  availableActions(
    "https://create.roblox.com/dashboard/creations/store/108827128247535/configure"
  ),
  ["textureId", "assetId"]
);

for (const hostileUrl of [
  "http://www.roblox.com/users/1/profile",
  "https://www.roblox.com.example.com/users/1/profile",
  "https://name:password@www.roblox.com/users/1/profile",
  "https://www.roblox.com/users/0/profile",
  "https://www.roblox.com/users/0001/profile",
  "https://www.roblox.com/users/123456789012345678901/profile",
  "https://create.roblox.com/dashboard/creations/experiences/create/places/123"
]) {
  assert.equal(parse(hostileUrl), null, `accepted hostile or invalid URL: ${hostileUrl}`);
}
assert.deepEqual(
  availableActions(
    "https://create.roblox.com/dashboard/creations/experiences/456/badges/create"
  ),
  ["universeId"],
  "treated a Creator Dashboard action name as a Badge ID"
);

const privateServer = parse(
  "https://www.roblox.com/games/123/example?privateServerLinkCode=DO_NOT_COPY"
);
assert.equal(privateServer.placeId, "123");
assert.ok(
  Object.keys(privateServer).every((key) => !key.toLowerCase().includes("private")),
  "private-server information became copyable"
);

hooks.setupContextMenus();
assert.equal(createdItems.length, (directActions.length + 3) * 2);
for (const action of directActions) {
  const pageItem = createdItems.find((item) => item.id === `rsl-context:page:${action.key}`);
  const targetItem = createdItems.find((item) => item.id === `rsl-context:target:${action.key}`);
  assert.ok(pageItem, `missing page item for ${action.key}`);
  assert.ok(targetItem, `missing target item for ${action.key}`);
  assert.deepEqual(Array.from(pageItem.contexts), ["page"]);
  assert.equal(pageItem.targetUrlPatterns, undefined);
  assert.deepEqual(Array.from(targetItem.contexts), ["link", "image"]);
  assert.deepEqual(
    Array.from(targetItem.documentUrlPatterns),
    ["https://www.roblox.com/*", "https://create.roblox.com/*"]
  );
  assert.ok(Array.isArray(targetItem.targetUrlPatterns));
  assert.ok(targetItem.targetUrlPatterns.length > 0);
  assert.ok(!Object.hasOwn(pageItem, "parentId"));
  assert.ok(!Object.hasOwn(targetItem, "parentId"));
}

for (const scope of ["page", "target"]) {
  const parentId = `rsl-context:${scope}:asset-ids`;
  const parent = createdItems.find((item) => item.id === parentId);
  assert.equal(parent.title, "Copy Texture ID / Asset ID");
  assert.ok(!Object.hasOwn(parent, "parentId"));
  assert.equal(
    createdItems.find((item) => item.id === `${parentId}-texture`)?.parentId,
    parentId
  );
  assert.equal(
    createdItems.find((item) => item.id === `${parentId}-asset`)?.parentId,
    parentId
  );
}

assert.equal(hooks.getCopyRobloxIdsFeatureValue(null), true);
assert.equal(
  hooks.getCopyRobloxIdsFeatureValue({
    version: 1,
    flags: { copyRobloxIds: false }
  }),
  false
);
assert.equal(
  hooks.getCopyRobloxIdsFeatureValue({
    version: 1,
    flags: { copyRobloxIds: true }
  }),
  true
);
hooks.setCopyRobloxIdsEnabledForTests(false);
hooks.setupContextMenus();
assert.equal(createdItems.length, 0, "disabled Copy Roblox IDs must remove every menu");
hooks.setCopyRobloxIdsEnabledForTests(true);
hooks.setupContextMenus();
assert.equal(createdItems.length, (directActions.length + 3) * 2);

console.log("PASS RoTool native context-menu configuration, routes, and icon assets");
