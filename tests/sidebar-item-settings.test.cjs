"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const contentSource = fs.readFileSync(path.join(projectRoot, "content.js"), "utf8");

const sidebarDefinitions = [
  ["sidebarGameEvents", "Game Events", null],
  ["sidebarServerHistory", "Server History", null],
  ["sidebarCustomShortcuts", "Custom Shortcuts", null],
  ["sidebarHome", "Home", "home"],
  ["sidebarProfile", "Profile", "profile"],
  ["sidebarRobloxPlus", "Roblox Plus", "robloxPlus"],
  ["sidebarMessages", "Messages", "messages"],
  ["sidebarFriends", "Friends", "friends"],
  ["sidebarAvatar", "Avatar", "avatar"],
  ["sidebarInventory", "Inventory", "inventory"],
  ["sidebarTrade", "Trade", "trade"],
  ["sidebarCommunities", "Communities", "communities"],
  ["sidebarBlog", "Blog", "blog"],
  ["sidebarOfficialStore", "Official Store", "officialStore"],
  ["sidebarGiftCards", "Buy Gift Cards", "giftCards"]
];

// Exercise the real normalization/serialization path. Missing settings from an
// older rslFeatureSettingsV1 payload must be additive and default on.
globalThis.__rslContentTestHooks = { skipInitialize: true };
require(path.join(projectRoot, "content.js"));
const hooks = globalThis.__rslContentTestHooks;
const sidebarParent = hooks.featureDefinitions.find(
  (definition) => definition.key === "sidebarShortcuts"
);
assert.equal(
  hooks.featureSettingDefinitions.some((definition) => definition.key === "sidebarThemes"),
  false,
  "RoPro Themes is not a RoTool/Roblox sidebar setting"
);
assert.deepEqual(
  sidebarParent.children.map(({ key, label }) => [key, label]),
  sidebarDefinitions.map(([key, label]) => [key, label]),
  "Sidebar Advanced must expose every screenshot row in a stable order"
);
for (const [key] of sidebarDefinitions) {
  assert.equal(hooks.defaultFeatureSettings[key], true, `${key} must default on`);
}
assert.equal(hooks.defaultFeatureSettings.sidebarShortcuts, true);
assert.equal(hooks.defaultFeatureSettings.sidebarGameEvents, true);
assert.equal(hooks.defaultFeatureSettings.sidebarServerHistory, true);
assert.equal(hooks.defaultFeatureSettings.gameEvents, true);
assert.equal(hooks.defaultFeatureSettings.serverHistory, false);
assert.equal(hooks.defaultFeatureSettings.gameCcuHoverGraph, true);
const playerCountsDefinition = hooks.featureDefinitions.find(
  (definition) => definition.key === "gameCcu"
);
const graphDefinition = hooks.featureDefinitions.find(
  (definition) => definition.key === "gameCcuHoverGraph"
);
assert.ok(graphDefinition, "CCU Hover Graph must be a top-level feature definition");
assert.equal(graphDefinition.group, "Experiences");
assert.equal(graphDefinition.children, undefined);
assert.equal(playerCountsDefinition.children, undefined);
assert.equal(
  hooks.featureSettingDefinitions.find(
    (definition) => definition.key === "gameCcuHoverGraph"
  ).parentKey,
  undefined,
  "CCU Hover Graph must not inherit Player Counts disabled state"
);

const oldPayload = hooks.normalizeFeatureSettings({
  version: 1,
  flags: {
    sidebarShortcuts: false,
    sidebarCustomShortcuts: false,
    sidebarGiftCards: false,
    quickPlay: false,
    gameCcu: true
  }
});
assert.equal(oldPayload.sidebarShortcuts, false);
assert.equal(oldPayload.sidebarCustomShortcuts, false);
assert.equal(oldPayload.sidebarGiftCards, false);
assert.equal(oldPayload.quickPlay, false);
assert.equal(oldPayload.gameCcu, true);
assert.equal(oldPayload.sidebarHome, true);
assert.equal(oldPayload.sidebarGameEvents, true);
assert.equal(oldPayload.sidebarServerHistory, true);
assert.equal(oldPayload.gameEvents, true);
assert.equal(oldPayload.serverHistory, false);
assert.equal(oldPayload.gameCcuHoverGraph, true);
const oldCountsOffPayload = hooks.normalizeFeatureSettings({
  version: 1,
  flags: { gameCcu: false }
});
assert.equal(oldCountsOffPayload.gameCcu, false);
assert.equal(
  oldCountsOffPayload.gameCcuHoverGraph,
  true,
  "older saved settings must default the newly independent graph on"
);

const individual = { ...hooks.defaultFeatureSettings };
for (const [key] of sidebarDefinitions) {
  individual[key] = false;
}
individual.sidebarShortcuts = false;
individual.gameCcu = true;
individual.gameCcuHoverGraph = false;
const serialized = hooks.serializeFeatureSettings(individual);
assert.equal(serialized.version, 1);
for (const [key] of sidebarDefinitions) {
  assert.equal(serialized.flags[key], false, `${key} must serialize independently`);
}
assert.equal(serialized.flags.sidebarShortcuts, false);
assert.equal(serialized.flags.gameCcu, true);
assert.equal(serialized.flags.gameCcuHoverGraph, false);
assert.equal("unknownSidebarFlag" in serialized.flags, false);
delete globalThis.__rslContentTestHooks;

function sourceBetween(start, end) {
  const startIndex = contentSource.indexOf(start);
  const endIndex = contentSource.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing source boundary: ${start}`);
  assert.notEqual(endIndex, -1, `missing source boundary: ${end}`);
  return contentSource.slice(startIndex, endIndex);
}

class FakeControl {
  constructor({ tag = "a", href = "", id = "", classes = [] } = {}) {
    this.tagName = tag.toUpperCase();
    this.rawHref = href;
    this.href = href ? new URL(href, "https://www.roblox.com").href : "";
    this.id = id;
    this.classes = new Set(classes);
    this.classList = { contains: (name) => this.classes.has(name) };
  }

  get hostname() {
    return this.href ? new URL(this.href).hostname : "";
  }

  matches(selector) {
    return selector.split(",").some((part) => {
      const candidate = part.trim();
      if (candidate === "a[href]") {
        return this.tagName === "A" && Boolean(this.href);
      }
      if (candidate === "button") {
        return this.tagName === "BUTTON";
      }
      if (candidate === "a[href]" || candidate === "a[href], button") {
        return (this.tagName === "A" && Boolean(this.href)) || this.tagName === "BUTTON";
      }
      if (candidate.startsWith("#")) {
        return this.id === candidate.slice(1);
      }
      if (candidate === 'a.themes-icon[href="/themes"]') {
        return this.tagName === "A" &&
          this.classes.has("themes-icon") && this.rawHref === "/themes";
      }
      return false;
    });
  }

  querySelector(selector) {
    return selector.split(",").some((part) => {
      const candidate = part.trim();
      if (candidate.startsWith("#")) {
        return this.id === candidate.slice(1);
      }
      if (!candidate.startsWith(".")) {
        return false;
      }
      return candidate.slice(1).split(".").every((name) => this.classes.has(name));
    }) ? {} : null;
  }
}

class FakeRow {
  constructor(layout, control, { text = "Nicht auf Englisch", ropro = "" } = {}) {
    this.layout = layout;
    this.children = control ? [control] : [];
    this.attributes = new Map();
    this.dataset = {};
    this.id = "";
    this.textContent = text;
    this.clickHandler = () => "original";
    if (ropro) {
      this.attributes.set("data-ropro-sidebar-item", ropro);
    }
  }

  matches(selector) {
    if (selector === "li") {
      return true;
    }
    if (selector === 'li[data-ropro-sidebar-item="themes"]') {
      return this.attributes.get("data-ropro-sidebar-item") === "themes";
    }
    if (selector === "li[data-ropro-sidebar-item]") {
      return this.attributes.has("data-ropro-sidebar-item");
    }
    return false;
  }

  closest(selector) {
    if (selector.includes("#left-navigation-container") && this.layout === "redesigned") {
      return this.root;
    }
    if (selector.includes(".left-col-list") && this.layout === "legacy") {
      return this.root;
    }
    return null;
  }

  querySelectorAll(selector) {
    return selector === "a[href]"
      ? this.children.filter((control) => control.matches("a[href]"))
      : [];
  }

  querySelector() {
    return null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }
}

class FakeRoot {
  constructor(layout, rows) {
    this.layout = layout;
    this.rows = rows;
    this.parentElement = layout === "redesigned"
      ? { matches: (selector) => selector === "nav" }
      : null;
    rows.forEach((row) => {
      row.root = this;
      row.parentElement = this;
    });
  }

  matches(selector) {
    return selector === ".left-col-list" && this.layout === "legacy";
  }

  closest(selector) {
    return selector === "#left-navigation-container" && this.layout === "redesigned"
      ? this
      : null;
  }

  querySelectorAll(selector) {
    return selector === "li" ? this.rows : [];
  }
}

const redesignedSpecs = [
  ["sidebarHome", "home", "/home", "icon-regular-house"],
  ["sidebarProfile", "profile", "/users/profile", "icon-regular-person"],
  ["sidebarRobloxPlus", "robloxPlus", "/plus", "icon-regular-roblox-plus"],
  ["sidebarMessages", "messages", "/my/messages/#!/inbox", "icon-regular-speech-bubble-align-center"],
  ["sidebarFriends", "friends", "/users/friends#!/friend-requests", "icon-regular-two-people"],
  ["sidebarAvatar", "avatar", "/my/avatar", "icon-regular-person-standing"],
  ["sidebarInventory", "inventory", "/users/inventory", "icon-regular-backpack"],
  ["sidebarTrade", "trade", "/trades", "icon-regular-hand-two-arrows-horizontal"],
  ["sidebarCommunities", "communities", "/communities", "icon-regular-three-people"],
  ["sidebarBlog", "blog", "https://blog.roblox.com/", "icon-regular-fountain-pen-nib"],
  ["sidebarOfficialStore", "officialStore", "", "icon-regular-building-store", "button"],
  ["sidebarGiftCards", "giftCards", "/giftcards-us", "icon-regular-gift-card"]
];

function makeRedesignedRow(spec) {
  const [, , href, icon, tag = "a"] = spec;
  return new FakeRow(
    "redesigned",
    new FakeControl({
      tag,
      href,
      classes: ["text-title-large", "flex", "items-center", icon]
    })
  );
}

function makeDocument(root, hiddenAttribute) {
  return {
    querySelectorAll(selector) {
      if (selector.includes(`[${hiddenAttribute}]`)) {
        return root.rows.filter((row) => row.hasAttribute(hiddenAttribute));
      }
      if (selector.includes("#left-navigation-container") && root.layout === "redesigned") {
        return [root];
      }
      if (selector.includes(".left-col-list") && root.layout === "legacy") {
        return [root];
      }
      return [];
    }
  };
}

const nativeSidebarSource = sourceBetween(
  "  function isFeatureEnabled(",
  "  function normalizeBestFriendIds("
);
function makeApi(settings, root) {
  const hiddenAttribute = "data-rsl-native-sidebar-hidden";
  const document = makeDocument(root, hiddenAttribute);
  const api = new Function(
    "featureSettings",
    "document",
    "location",
    "NATIVE_SIDEBAR_HIDDEN_ATTRIBUTE",
    "isExtensionRow",
    `${nativeSidebarSource}\nreturn { getNativeSidebarSemanticKey, cleanupNativeSidebarVisibility, syncNativeSidebarVisibility };`
  )(
    settings,
    document,
    { origin: "https://www.roblox.com" },
    hiddenAttribute,
    (row) => Boolean(
      row?.id === "rsl-add-shortcut-row" ||
      row?.hasAttribute?.("data-rsl-shortcut-id") ||
      row?.dataset?.rslControl
    )
  );
  return { ...api, hiddenAttribute };
}

const redesignedRows = redesignedSpecs.map(makeRedesignedRow);
const redesignedRoot = new FakeRoot("redesigned", redesignedRows);
const redesignedSettings = { sidebarShortcuts: true };
for (const [key] of sidebarDefinitions) {
  redesignedSettings[key] = true;
}
const redesignedApi = makeApi(redesignedSettings, redesignedRoot);
const semanticRows = new Map();
for (const row of redesignedRows) {
  const semanticKey = redesignedApi.getNativeSidebarSemanticKey(row);
  assert.ok(semanticKey, `redesigned row was not identified: ${row.children[0]?.rawHref}`);
  semanticRows.set(semanticKey, row);
}
const untouchedThemesRow = makeAttached(new FakeRow(
  "redesigned",
  new FakeControl({
    href: "/themes",
    classes: ["themes-icon", "new-menu-icon", "ropro-sidebar-icon"]
  }),
  { ropro: "themes" }
), redesignedRoot);
redesignedRoot.rows.push(untouchedThemesRow);

for (const [settingKey, , semanticKey] of sidebarDefinitions.filter((entry) => entry[2])) {
  for (const [key] of sidebarDefinitions) {
    redesignedSettings[key] = true;
  }
  redesignedSettings[settingKey] = false;
  redesignedApi.syncNativeSidebarVisibility();
  for (const [candidateKey, row] of semanticRows) {
    assert.equal(
      row.getAttribute(redesignedApi.hiddenAttribute),
      candidateKey === semanticKey ? semanticKey : null,
      `${settingKey} must only hide ${semanticKey}`
    );
  }
  assert.equal(
    untouchedThemesRow.hasAttribute(redesignedApi.hiddenAttribute),
    false,
    "individual settings and Hide all must never hide RoPro Themes"
  );
}

// This is the exact persisted state produced by Hide all. It controls all
// RoTool/Roblox children but must not reach any RoPro-owned list item.
for (const [key] of sidebarDefinitions) {
  redesignedSettings[key] = false;
}
redesignedApi.syncNativeSidebarVisibility();
for (const [semanticKey, row] of semanticRows) {
  assert.equal(row.getAttribute(redesignedApi.hiddenAttribute), semanticKey);
}
assert.equal(untouchedThemesRow.hasAttribute(redesignedApi.hiddenAttribute), false);

// Parent off restores the original nodes without mutating saved child choices
// or Roblox's own event handlers.
const originalRows = [...redesignedRoot.rows];
const originalHandlers = originalRows.map((row) => row.clickHandler);
const btrInlineStyle = { display: "list-item", order: "12" };
semanticRows.get("giftCards").style = btrInlineStyle;
redesignedSettings.sidebarHome = false;
redesignedSettings.sidebarBlog = false;
redesignedSettings.sidebarShortcuts = false;
redesignedApi.syncNativeSidebarVisibility();
assert.equal(redesignedRoot.rows.some((row) => row.hasAttribute(redesignedApi.hiddenAttribute)), false);
assert.equal(redesignedSettings.sidebarHome, false);
assert.equal(redesignedSettings.sidebarBlog, false);
assert.deepEqual(redesignedRoot.rows, originalRows);
assert.deepEqual(redesignedRoot.rows.map((row) => row.clickHandler), originalHandlers);
assert.strictEqual(
  semanticRows.get("giftCards").style,
  btrInlineStyle,
  "restoring a native row must not clear another extension's inline layout style"
);
assert.equal(semanticRows.get("giftCards").style.display, "list-item");

// React can reuse a list item. Its old marker must be removed as soon as the
// direct semantic signature changes.
redesignedSettings.sidebarShortcuts = true;
redesignedSettings.sidebarHome = false;
redesignedApi.syncNativeSidebarVisibility();
const reusedHome = semanticRows.get("home");
assert.equal(reusedHome.getAttribute(redesignedApi.hiddenAttribute), "home");
reusedHome.children[0].rawHref = "/discover";
reusedHome.children[0].href = "https://www.roblox.com/discover";
reusedHome.children[0].classes.delete("icon-regular-house");
redesignedApi.syncNativeSidebarVisibility();
assert.equal(reusedHome.hasAttribute(redesignedApi.hiddenAttribute), false);

const legacySpecs = [
  ["home", "nav-home"],
  ["profile", "nav-profile"],
  ["messages", "nav-message"],
  ["friends", "nav-friends"],
  ["avatar", "nav-character"],
  ["inventory", "nav-inventory"],
  ["trade", "nav-trade"],
  ["communities", "nav-group"],
  ["blog", "nav-blog"],
  ["officialStore", "nav-shop", "button"],
  ["giftCards", "nav-giftcards"]
];
const legacyRows = legacySpecs.map(([semanticKey, id, tag = "a"]) => [
  semanticKey,
  new FakeRow("legacy", new FakeControl({ tag, href: tag === "a" ? "/localized" : "", id }))
]);
const legacyRoot = new FakeRoot("legacy", legacyRows.map(([, row]) => row));
const legacySettings = { ...hooks?.defaultFeatureSettings, sidebarShortcuts: true };
for (const [key] of sidebarDefinitions) {
  legacySettings[key] = false;
}
const legacyApi = makeApi(legacySettings, legacyRoot);
legacyApi.syncNativeSidebarVisibility();
for (const [semanticKey, row] of legacyRows) {
  assert.equal(row.getAttribute(legacyApi.hiddenAttribute), semanticKey);
}

// Localized routes retain exact official route/icon semantics.
for (const spec of redesignedSpecs.filter(([, key]) => !["blog", "officialStore", "giftCards"].includes(key))) {
  const localized = [...spec];
  localized[2] = `/de${new URL(spec[2], "https://www.roblox.com").pathname}`;
  assert.equal(
    redesignedApi.getNativeSidebarSemanticKey(makeAttached(makeRedesignedRow(localized), redesignedRoot)),
    spec[1],
    `two-letter locale prefix must be accepted for ${spec[1]}`
  );
}
const localizedGift = makeAttached(makeRedesignedRow([
  "sidebarGiftCards", "giftCards", "/giftcards-de", "icon-regular-gift-card"
]), redesignedRoot);
assert.equal(redesignedApi.getNativeSidebarSemanticKey(localizedGift), "giftCards");

function makeAttached(row, root = redesignedRoot) {
  row.root = root;
  row.parentElement = root;
  return row;
}

// Strict, direct semantic pairs prevent footer, promo, nested, external, and
// unrelated extension lookalikes from disappearing.
const exclusions = [];
exclusions.push(makeAttached(new FakeRow("redesigned", new FakeControl({
  href: "/plus",
  classes: ["flex-col", "text-body-medium", "icon-regular-roblox-plus"]
}))));
exclusions.push(makeAttached(new FakeRow("redesigned", new FakeControl({
  href: "https://example.com/home",
  classes: ["text-title-large", "flex", "items-center", "icon-regular-house"]
}))));
exclusions.push(makeAttached(new FakeRow("redesigned", new FakeControl({
  href: "/home",
  classes: ["text-title-large", "flex", "items-center", "icon-regular-gift-card"]
}))));
exclusions.push(makeAttached(new FakeRow("redesigned", new FakeControl({
  href: "/store",
  classes: ["text-title-large", "flex", "items-center", "icon-regular-building-store"]
}))));
exclusions.push(makeAttached(new FakeRow("redesigned", new FakeControl({
  href: "/themes",
  classes: ["themes-icon", "new-menu-icon", "ropro-sidebar-icon"]
}), { ropro: "themes" })));
exclusions.push(makeAttached(new FakeRow("redesigned", new FakeControl({
  href: "/themes",
  classes: ["themes-icon", "new-menu-icon", "ropro-sidebar-icon"]
}), { ropro: "trade-offers" })));
const owned = makeAttached(makeRedesignedRow([
  "sidebarHome", "home", "/home", "icon-regular-house"
]));
owned.dataset.rslControl = "shortcut";
exclusions.push(owned);
const englishTextOnly = makeAttached(new FakeRow(
  "redesigned",
  new FakeControl({ href: "/discover", classes: ["text-title-large"] }),
  { text: "Home Profile Messages Friends Avatar Inventory Trade Communities Themes Blog Official Store Buy Gift Cards" }
));
exclusions.push(englishTextOnly);
for (const row of exclusions) {
  assert.equal(redesignedApi.getNativeSidebarSemanticKey(row), "");
}
const footerHome = new FakeRow("footer", new FakeControl({
  href: "/home",
  classes: ["text-title-large", "flex", "items-center", "icon-regular-house"]
}));
assert.equal(redesignedApi.getNativeSidebarSemanticKey(footerHome), "");

console.log(
  "PASS RoTool all-sidebar settings defaults, exact semantics, exclusions, and reversible visibility"
);
