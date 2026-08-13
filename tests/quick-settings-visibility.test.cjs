"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const contentSource = fs.readFileSync(path.join(root, "content.js"), "utf8");

class MiniClassList {
  constructor(owner) {
    this.owner = owner;
  }

  values() {
    return new Set(String(this.owner.className || "").split(/\s+/).filter(Boolean));
  }

  contains(name) {
    return this.values().has(name);
  }

  toggle(name, force) {
    const values = this.values();
    const enabled = force === undefined ? !values.has(name) : Boolean(force);
    if (enabled) values.add(name);
    else values.delete(name);
    this.owner.className = Array.from(values).join(" ");
    return enabled;
  }
}

function selectorMatches(element, rawSelector) {
  const selector = rawSelector.trim().replace(/^:scope\s*>\s*/, "");
  if (selector.startsWith("#")) return element.id === selector.slice(1);
  if (selector.startsWith(".")) return element.classList.contains(selector.slice(1));
  const attribute = selector.match(/^\[([^=\]]+)(?:=['"]?([^'"\]]+)['"]?)?\]$/);
  if (attribute) {
    return element.hasAttribute(attribute[1]) &&
      (attribute[2] === undefined || element.getAttribute(attribute[1]) === attribute[2]);
  }
  return false;
}

class MiniElement {
  constructor(tagName = "div") {
    this.tagName = String(tagName).toUpperCase();
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this.className = "";
    this.classList = new MiniClassList(this);
    this.dataset = Object.create(null);
    this.hidden = false;
    this.id = "";
    this.textContent = "";
    this.disabled = false;
    this.value = "";
    this.listeners = new Map();
  }

  get firstElementChild() {
    return this.children[0] || null;
  }

  get nextElementSibling() {
    if (!this.parentElement) return null;
    const index = this.parentElement.children.indexOf(this);
    return index >= 0 ? this.parentElement.children[index + 1] || null : null;
  }

  get options() {
    return this.tagName === "SELECT" ? this.children : [];
  }

  setAttribute(name, value) {
    const normalized = String(value);
    this.attributes.set(name, normalized);
    if (name === "id") this.id = normalized;
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

  toggleAttribute(name, force) {
    if (force) this.setAttribute(name, "");
    else this.removeAttribute(name);
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  append(...nodes) {
    for (const node of nodes.filter(Boolean)) {
      if (node.parentElement) node.remove();
      node.parentElement = this;
      this.children.push(node);
    }
  }

  insertBefore(node, reference) {
    if (node.parentElement) node.remove();
    const index = reference ? this.children.indexOf(reference) : -1;
    node.parentElement = this;
    if (index < 0) this.children.push(node);
    else this.children.splice(index, 0, node);
    return node;
  }

  replaceChildren(...nodes) {
    for (const child of this.children) child.parentElement = null;
    this.children = [];
    this.append(...nodes);
  }

  remove() {
    if (!this.parentElement) return;
    const index = this.parentElement.children.indexOf(this);
    if (index >= 0) this.parentElement.children.splice(index, 1);
    this.parentElement = null;
  }

  contains(candidate) {
    if (candidate === this) return true;
    return this.children.some((child) => child.contains(candidate));
  }

  querySelectorAll(selector) {
    const selectors = selector.split(",").map((value) => value.trim());
    const direct = selectors.every((value) => value.startsWith(":scope >"));
    const matches = [];
    const visit = (element) => {
      for (const child of element.children) {
        if (selectors.some((value) => selectorMatches(child, value))) matches.push(child);
        if (!direct) visit(child);
      }
    };
    visit(this);
    return matches;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  focus() {
    globalThis.document.activeElement = this;
  }
}

const body = new MiniElement("body");
const documentElement = new MiniElement("html");
const fixtureDocument = {
  body,
  documentElement,
  activeElement: body,
  createElement: (tagName) => new MiniElement(tagName),
  getElementById(id) {
    if (body.id === id) return body;
    if (documentElement.id === id) return documentElement;
    return body.querySelector(`#${id}`) || documentElement.querySelector(`#${id}`);
  },
  querySelector: (selector) => body.querySelector(selector),
  querySelectorAll: (selector) => body.querySelectorAll(selector)
};

let runtimeMessageCount = 0;
globalThis.document = fixtureDocument;
globalThis.location = { pathname: "/home", search: "", hash: "", href: "https://www.roblox.com/home" };
globalThis.window = globalThis;
globalThis.chrome = {
  runtime: {
    lastError: null,
    sendMessage(_message, callback) {
      runtimeMessageCount += 1;
      callback?.({ ok: false, code: "NETWORK" });
    }
  },
  storage: { local: { set(_value, callback) { callback?.(); } } }
};
globalThis.__rslContentTestHooks = { skipInitialize: true };
require(path.join(root, "content.js"));
const hooks = globalThis.__rslContentTestHooks;

const childFlags = [
  "quickSettingsOnlineStatus",
  "quickSettingsCurrentExperience",
  "quickSettingsInventory"
];
const aliasByFlag = {
  quickSettingsOnlineStatus: "onlineStatus",
  quickSettingsCurrentExperience: "currentExperience",
  quickSettingsInventory: "inventory"
};

const quickSettingsDefinition = hooks.featureDefinitions.find(
  ({ key }) => key === "quickSettings"
);
assert.deepEqual(
  quickSettingsDefinition.children.map(({ key, label }) => [key, label]),
  [
    ["quickSettingsOnlineStatus", "Online Status"],
    ["quickSettingsCurrentExperience", "Current Experience"],
    ["quickSettingsInventory", "Inventory Visibility"]
  ],
  "Quick Settings Advanced must contain exactly the three Home controls"
);
for (const child of quickSettingsDefinition.children) {
  assert.equal(
    hooks.featureSettingDefinitions.find(({ key }) => key === child.key)?.parentKey,
    "quickSettings"
  );
  assert.equal(hooks.defaultFeatureSettings[child.key], true);
}

for (const legacyValue of [null, { version: 1 }, { version: 1, flags: {} }]) {
  const normalized = hooks.normalizeFeatureSettings(legacyValue);
  for (const key of childFlags) assert.equal(normalized[key], true);
}
const preserved = hooks.normalizeFeatureSettings({
  version: 1,
  flags: {
    quickSettings: false,
    quickSettingsOnlineStatus: true,
    quickSettingsCurrentExperience: false,
    quickSettingsInventory: true
  }
});
assert.equal(preserved.quickSettings, false);
assert.deepEqual(childFlags.map((key) => preserved[key]), [true, false, true]);
const serialized = hooks.serializeFeatureSettings(preserved);
assert.deepEqual(childFlags.map((key) => serialized.flags[key]), [true, false, true]);

function setQuickSettingsFlags(enabledFlags, parent = true) {
  hooks.setFeatureSettingsForTests({
    version: 1,
    flags: {
      ...hooks.defaultFeatureSettings,
      quickSettings: parent,
      ...Object.fromEntries(childFlags.map((key) => [key, enabledFlags.includes(key)]))
    }
  });
}

function makeCarousel() {
  const carousel = new MiniElement("section");
  const header = new MiniElement("div");
  header.className = "container-header";
  carousel.append(header);
  body.append(carousel);
  return carousel;
}

function renderedAliases(section) {
  return section
    ? section.querySelectorAll("[data-rsl-quick-setting]")
        .map((card) => card.getAttribute("data-rsl-quick-setting"))
    : [];
}

for (let mask = 1; mask < 8; mask += 1) {
  const enabledFlags = childFlags.filter((_key, index) => (mask & (1 << index)) !== 0);
  setQuickSettingsFlags(enabledFlags);
  assert.deepEqual(
    Array.from(hooks.getEnabledQuickSettingAliases()),
    enabledFlags.map((key) => aliasByFlag[key]),
    "effective aliases must retain canonical row order"
  );
  const carousel = makeCarousel();
  const section = hooks.renderQuickSettings(carousel);
  assert.ok(section, "any enabled child must render the Quick Settings card");
  assert.deepEqual(renderedAliases(section), enabledFlags.map((key) => aliasByFlag[key]));
  for (const id of [
    "rsl-quick-settings-refresh",
    "rsl-quick-settings-more",
    "rsl-quick-settings-toggle",
    "rsl-quick-settings-controls"
  ]) {
    assert.ok(section.querySelector(`#${id}`), `${id} must remain for every nonempty combination`);
  }
  assert.equal(section.querySelector("#rsl-quick-settings-controls").getAttribute("role"), "group");
  carousel.remove();
}

for (const { parent, enabledFlags } of [
  { parent: true, enabledFlags: [] },
  { parent: false, enabledFlags: childFlags }
]) {
  setQuickSettingsFlags(enabledFlags, parent);
  const carousel = makeCarousel();
  const staleSection = new MiniElement("section");
  staleSection.setAttribute("data-rsl-quick-settings", "");
  carousel.insertBefore(staleSection, carousel.firstElementChild);
  const messagesBefore = runtimeMessageCount;
  assert.equal(hooks.renderQuickSettings(carousel), null);
  assert.equal(carousel.querySelector("[data-rsl-quick-settings]"), null);
  const skippedRead = hooks.loadQuickSettings(false);
  assert.equal(typeof skippedRead?.then, "function");
  assert.equal(
    runtimeMessageCount,
    messagesBefore,
    "an ineffective Quick Settings feature must not send a Roblox read request"
  );
  carousel.remove();
}

assert.equal(hooks.isQuickSettingEnabled("unknown"), false);

const cardSource = contentSource.slice(
  contentSource.indexOf("function makeQuickSettingCard("),
  contentSource.indexOf("function syncQuickSettingsCollapsedState(")
);
assert.match(
  cardSource,
  /event\.isTrusted !== true[\s\S]*?!isQuickSettingEnabled\(definition\.alias\)/,
  "a stale select event must re-check its child flag before an API write"
);
const onlineUpdateSource = contentSource.slice(
  contentSource.indexOf("async function updateOnlineStatus("),
  contentSource.indexOf("async function updateQuickSetting(")
);
assert.match(onlineUpdateSource, /!isQuickSettingEnabled\("onlineStatus"\)/);
assert.match(onlineUpdateSource, /expectedCurrentExperience: currentExperience\.value/);
const directUpdateSource = contentSource.slice(
  contentSource.indexOf("async function updateQuickSetting("),
  contentSource.indexOf("function getBestFriendsCarouselSignature(")
);
assert.match(directUpdateSource, /!isQuickSettingEnabled\(alias\)/);

const renderSource = contentSource.slice(
  contentSource.indexOf("function renderQuickSettings("),
  contentSource.indexOf("function loadQuickSettings(")
);
assert.match(renderSource, /QUICK_SETTING_DEFINITIONS\.filter\(\(\{ alias \}\) =>[\s\S]*isQuickSettingEnabled\(alias\)/);
assert.match(renderSource, /if \(enabledDefinitions\.length === 0\)[\s\S]*?\.remove\(\);[\s\S]*?return null/);
assert.match(renderSource, /for \(const definition of enabledDefinitions\)/);
const signatureSource = contentSource.slice(
  contentSource.indexOf("function getQuickSettingsSignature("),
  contentSource.indexOf("function ensureBestFriendsHeader(")
);
assert.match(
  signatureSource,
  /getEnabledQuickSettingAliases\(\)/,
  "visibility changes must invalidate the render signature"
);
assert.match(
  renderSource,
  /else if \(!focusTarget\)[\s\S]*?quickSettingsFocusRestoreId = ""/,
  "removing the focused child row must clear its stale focus target"
);

const loadSource = contentSource.slice(
  contentSource.indexOf("function loadQuickSettings("),
  contentSource.indexOf("async function updateOnlineStatus(")
);
assert.match(loadSource, /getEnabledQuickSettingAliases\(\)\.length === 0/);
assert.doesNotMatch(
  loadSource,
  /aliases\s*:/,
  "one nonempty card must keep the existing full-snapshot background protocol"
);

const cleanupSource = contentSource.slice(
  contentSource.indexOf("function cleanupQuickSettingsHome("),
  contentSource.indexOf("function cleanupBestFriendsHome(")
);
assert.match(cleanupSource, /quickSettingsLifecycleEpoch \+= 1/);
assert.match(cleanupSource, /quickSettingsReadOperationId \+= 1/);
assert.match(cleanupSource, /quickSettingsPendingOperations\.clear\(\)/);

const reconcileSource = contentSource.slice(
  contentSource.indexOf("function reconcileFeatureSettings("),
  contentSource.indexOf("function queueMount(")
);
for (const key of ["quickSettings", ...childFlags]) {
  assert.match(reconcileSource, new RegExp(`"${key}"`));
}
assert.match(
  reconcileSource,
  /if \(hadEnabledControls && !hasEnabledControls\) \{\s*cleanupQuickSettingsHome\(\)/,
  "cleanup must run on an effective nonempty-to-empty transition, not a parent-off child preference change"
);
assert.match(reconcileSource, /if \(carousel\) \{\s*renderQuickSettings\(carousel\)/);
assert.match(
  reconcileSource,
  /if \([\s\S]*?!hadEnabledControls[\s\S]*?!hasQuickSettingsSnapshotForEnabledControls\(\)[\s\S]*?void loadQuickSettings\(false\)/,
  "child visibility changes with a complete live snapshot must not refetch"
);
const quickSettingsEarlyReturn = reconcileSource.indexOf(
  "quickSettingsChanged &&",
  reconcileSource.indexOf("const quickPlayActionsChanged")
);
assert.ok(quickSettingsEarlyReturn >= 0, "missing Quick Settings-only early return");
assert.ok(
  reconcileSource.indexOf("quickSettingsKeys.includes(key)", quickSettingsEarlyReturn) >= 0 &&
    reconcileSource.indexOf("return;", quickSettingsEarlyReturn) <
      reconcileSource.lastIndexOf("mountExtensionFeatures()"),
  "a Quick Settings-only change must stop before the global remount"
);
const targetedBranch = reconcileSource.slice(
  reconcileSource.indexOf("const quickSettingsKeys = ["),
  reconcileSource.indexOf("const quickPlayActionsChanged")
);
assert.doesNotMatch(
  targetedBranch,
  /cleanupSidebarFeature|cleanupQuickPlayFeature|cleanupGameTileCcuFeature|mountExtensionFeatures/,
  "Quick Settings child reconciliation must not remount unrelated features"
);

console.log(
  "PASS Quick Settings child defaults, combinations, no-data gate, API guards, and targeted reconciliation"
);
