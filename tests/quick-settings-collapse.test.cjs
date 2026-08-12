"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "content.js"), "utf8");
const start = source.indexOf("  function syncQuickSettingsCollapsedState(");
const end = source.indexOf("  function setQuickSettingsCollapsed(", start);
assert.ok(start >= 0 && end > start, "collapsed-state synchronizer must exist");

const hooks = new Function(
  `let quickSettingsCollapsed = false;\n` +
    `${source.slice(start, end)}\n` +
    `return {\n` +
    `  syncQuickSettingsCollapsedState,\n` +
    `  setCollapsed(value) { quickSettingsCollapsed = value === true; }\n` +
    `};`
)();

const attributes = new Map();
const controls = { hidden: false };
const expandedOnly = [{ hidden: false }, { hidden: false }, { hidden: false }];
const originalNodes = [controls, ...expandedOnly];
let replaceChildrenCalls = 0;
let toggleTextContent = "";
let toggleTextWrites = 0;
const toggleAttributes = new Map();
const toggle = {
  get textContent() {
    return toggleTextContent;
  },
  set textContent(value) {
    toggleTextWrites += 1;
    toggleTextContent = value;
  },
  setAttribute(name, value) {
    toggleAttributes.set(name, value);
  }
};
const section = {
  replaceChildren() {
    replaceChildrenCalls += 1;
  },
  toggleAttribute(name, force) {
    if (force) attributes.set(name, "");
    else attributes.delete(name);
  },
  querySelector(selector) {
    if (selector === ".rsl-quick-settings__controls") return controls;
    if (selector === "#rsl-quick-settings-toggle") return toggle;
    return null;
  },
  querySelectorAll(selector) {
    assert.equal(selector, "[data-rsl-quick-settings-expanded-only]");
    return expandedOnly;
  }
};

hooks.syncQuickSettingsCollapsedState(section);
assert.equal(attributes.has("data-rsl-quick-settings-collapsed"), false);
assert.equal(controls.hidden, false);
assert.equal(expandedOnly.every((element) => element.hidden === false), true);
assert.equal(toggle.textContent, "Hide");
assert.equal(toggleAttributes.get("aria-expanded"), "true");
assert.equal(toggleAttributes.get("aria-controls"), "rsl-quick-settings-controls");
assert.equal(toggleAttributes.get("aria-label"), "Hide Quick Settings");
assert.equal(toggleTextWrites, 1);
hooks.syncQuickSettingsCollapsedState(section);
assert.equal(
  toggleTextWrites,
  1,
  "an unchanged Hide label must not replace its Text node and queue a remount"
);

hooks.setCollapsed(true);
hooks.syncQuickSettingsCollapsedState(section);
assert.equal(attributes.has("data-rsl-quick-settings-collapsed"), true);
assert.equal(controls.hidden, true);
assert.equal(expandedOnly.every((element) => element.hidden === true), true);
assert.equal(toggle.textContent, "Show");
assert.equal(toggleAttributes.get("aria-expanded"), "false");
assert.equal(toggleAttributes.get("aria-label"), "Show Quick Settings");
assert.equal(toggleTextWrites, 2);
hooks.syncQuickSettingsCollapsedState(section);
assert.equal(
  toggleTextWrites,
  2,
  "an unchanged Show label must not replace its Text node and queue a remount"
);

hooks.setCollapsed(false);
hooks.syncQuickSettingsCollapsedState(section);
assert.equal(attributes.has("data-rsl-quick-settings-collapsed"), false);
assert.equal(controls.hidden, false);
assert.equal(expandedOnly.every((element) => element.hidden === false), true);
assert.equal(toggle.textContent, "Hide");
assert.equal(toggleAttributes.get("aria-expanded"), "true");
assert.equal(toggleAttributes.get("aria-label"), "Hide Quick Settings");
assert.equal(toggleTextWrites, 3);
assert.equal(replaceChildrenCalls, 0, "collapse synchronization must not rebuild controls");
assert.strictEqual(section.querySelector(".rsl-quick-settings__controls"), originalNodes[0]);
assert.deepEqual(
  Array.from(section.querySelectorAll("[data-rsl-quick-settings-expanded-only]")),
  originalNodes.slice(1),
  "Hide then Show must preserve all existing expanded controls"
);

const applyStorageStart = source.indexOf(
  "  function applyQuickSettingsCollapsedStorageValue("
);
const applyStorageEnd = source.indexOf(
  "  function renderQuickSettings(",
  applyStorageStart
);
assert.ok(
  applyStorageStart >= 0 && applyStorageEnd > applyStorageStart,
  "collapsed-storage reconciliation helpers must exist"
);
const storageSection = {
  contains() {
    return false;
  },
  querySelector() {
    return null;
  }
};
const storageDocument = {
  activeElement: null,
  querySelector() {
    return storageSection;
  },
  getElementById() {
    return null;
  }
};
const storageWindow = {
  clearTimeout() {}
};
const storageHooks = new Function(
  "document",
  "window",
  `const QUICK_SETTINGS_ATTRIBUTE = "data-rsl-quick-settings";\n` +
    `let quickSettingsCollapsed = false;\n` +
    `let quickSettingsCollapsedConfirmed = false;\n` +
    `let quickSettingsCollapsedPendingWrites = 0;\n` +
    `let quickSettingsCollapsedDeferredStorageValue = null;\n` +
    `let quickSettingsCollapsedWriteGeneration = 0;\n` +
    `let quickSettingsCollapsedWriteTail = Promise.resolve();\n` +
    `let featureSettingsLoaded = true;\n` +
    `let bestFriendsScrollLockUntil = 0;\n` +
    `let bestFriendsScrollSettleTimer = null;\n` +
    `let mountCalls = 0;\n` +
    `let echoLocalStorageWrite = false;\n` +
    `function mountBestFriendsCarousel() { mountCalls += 1; }\n` +
    `function quickSettingsCollapsedStorageSet(value) {\n` +
    `  if (echoLocalStorageWrite) {\n` +
    `    quickSettingsCollapsedDeferredStorageValue = value === true;\n` +
    `  }\n` +
    `  return Promise.resolve();\n` +
    `}\n` +
    `${source.slice(applyStorageStart, applyStorageEnd)}\n` +
    `return {\n` +
    `  applyQuickSettingsCollapsedStorageValue,\n` +
    `  applyDeferredQuickSettingsCollapsedStorageValue,\n` +
    `  setQuickSettingsCollapsed,\n` +
    `  reset({ collapsed, confirmed, pending = 0, deferred = null }) {\n` +
    `    quickSettingsCollapsed = collapsed === true;\n` +
    `    quickSettingsCollapsedConfirmed = confirmed === true;\n` +
    `    quickSettingsCollapsedPendingWrites = pending;\n` +
    `    quickSettingsCollapsedDeferredStorageValue = deferred;\n` +
    `    quickSettingsCollapsedWriteGeneration = 0;\n` +
    `    quickSettingsCollapsedWriteTail = Promise.resolve();\n` +
    `    echoLocalStorageWrite = false;\n` +
    `    mountCalls = 0;\n` +
    `  },\n` +
    `  setPending(value) { quickSettingsCollapsedPendingWrites = value; },\n` +
    `  runLocalWriteWithStorageEcho(value) {\n` +
    `    echoLocalStorageWrite = true;\n` +
    `    return setQuickSettingsCollapsed(value).finally(() => {\n` +
    `      echoLocalStorageWrite = false;\n` +
    `    });\n` +
    `  },\n` +
    `  snapshot() {\n` +
    `    return {\n` +
    `      collapsed: quickSettingsCollapsed,\n` +
    `      confirmed: quickSettingsCollapsedConfirmed,\n` +
    `      pending: quickSettingsCollapsedPendingWrites,\n` +
    `      deferred: quickSettingsCollapsedDeferredStorageValue,\n` +
    `      mountCalls\n` +
    `    };\n` +
    `  }\n` +
    `};`
)(storageDocument, storageWindow);

storageHooks.reset({ collapsed: false, confirmed: true });
storageHooks.applyQuickSettingsCollapsedStorageValue(false);
assert.deepEqual(
  storageHooks.snapshot(),
  {
    collapsed: false,
    confirmed: false,
    pending: 0,
    deferred: null,
    mountCalls: 0
  },
  "an unchanged storage value must confirm state without remounting Home"
);

storageHooks.reset({ collapsed: false, confirmed: false });
storageHooks.applyQuickSettingsCollapsedStorageValue(true);
assert.deepEqual(
  storageHooks.snapshot(),
  {
    collapsed: true,
    confirmed: true,
    pending: 0,
    deferred: null,
    mountCalls: 1
  },
  "an external storage value that changes the effective state must mount once"
);

storageHooks.reset({
  collapsed: true,
  confirmed: false,
  pending: 1,
  deferred: true
});
storageHooks.applyDeferredQuickSettingsCollapsedStorageValue();
assert.deepEqual(
  storageHooks.snapshot(),
  {
    collapsed: true,
    confirmed: false,
    pending: 1,
    deferred: true,
    mountCalls: 0
  },
  "a storage event received during a local write must remain deferred"
);
storageHooks.setPending(0);
storageHooks.applyDeferredQuickSettingsCollapsedStorageValue();
assert.deepEqual(
  storageHooks.snapshot(),
  {
    collapsed: true,
    confirmed: true,
    pending: 0,
    deferred: null,
    mountCalls: 0
  },
  "the local write's matching deferred echo must confirm without a second mount"
);

storageHooks.reset({
  collapsed: false,
  confirmed: false,
  pending: 1,
  deferred: true
});
storageHooks.setPending(0);
storageHooks.applyDeferredQuickSettingsCollapsedStorageValue();
assert.deepEqual(
  storageHooks.snapshot(),
  {
    collapsed: true,
    confirmed: true,
    pending: 0,
    deferred: null,
    mountCalls: 1
  },
  "a genuinely different deferred external value must apply with one mount"
);

storageHooks.reset({ collapsed: true, confirmed: true });
const localWriteEchoTest = storageHooks
  .runLocalWriteWithStorageEcho(false)
  .then(() => {
    assert.deepEqual(
      storageHooks.snapshot(),
      {
        collapsed: false,
        confirmed: false,
        pending: 0,
        deferred: null,
        mountCalls: 1
      },
      "Show must mount synchronously once; its deferred storage echo must not mount again"
    );
  });

const geometryStart = source.indexOf(
  "  function getBestFriendsObservedGeometrySignature("
);
const geometryEnd = source.indexOf(
  "  function clearBestFriendsInitialLayoutRechecks(",
  geometryStart
);
assert.ok(
  geometryStart >= 0 && geometryEnd > geometryStart,
  "Best Friends geometry observer helpers must exist"
);
let geometryObserverInstance = null;
class FakeResizeObserver {
  constructor(callback) {
    this.callback = callback;
    this.observed = [];
    geometryObserverInstance = this;
  }

  observe(target) {
    this.observed.push(target);
  }

  disconnect() {
    this.observed = [];
  }

  trigger(entries) {
    this.callback(entries);
  }
}
const geometryHooks = new Function(
  "ResizeObserver",
  `const QUICK_SETTINGS_ATTRIBUTE = "data-rsl-quick-settings";\n` +
    `let bestFriendsGeometryObserver = null;\n` +
    `let observedBestFriendsGeometryCarousel = null;\n` +
    `let observedBestFriendsGeometryQuickSettings = null;\n` +
    `let observedBestFriendsGeometrySignature = "";\n` +
    `let queuedMounts = 0;\n` +
    `function queueMount() { queuedMounts += 1; }\n` +
    `${source.slice(geometryStart, geometryEnd)}\n` +
    `return {\n` +
    `  observeBestFriendsGeometry,\n` +
    `  getQueuedMounts() { return queuedMounts; }\n` +
    `};`
)(FakeResizeObserver);

let carouselHeight = 158;
let quickSettingsHeight = 34;
const quickSettings = {
  isConnected: true,
  getBoundingClientRect() {
    return { width: 336, height: quickSettingsHeight };
  }
};
const carousel = {
  isConnected: true,
  querySelector(selector) {
    assert.equal(selector, ":scope > [data-rsl-quick-settings]");
    return quickSettings;
  },
  getBoundingClientRect() {
    return { width: 1043, height: carouselHeight };
  }
};
geometryHooks.observeBestFriendsGeometry(carousel);
assert.deepEqual(geometryObserverInstance.observed, [carousel, quickSettings]);
geometryObserverInstance.trigger([{ target: quickSettings }]);
assert.equal(
  geometryHooks.getQueuedMounts(),
  0,
  "the observer's matching post-placement echo must not queue another mount"
);
quickSettingsHeight = 160;
geometryObserverInstance.trigger([{ target: quickSettings }]);
assert.equal(
  geometryHooks.getQueuedMounts(),
  1,
  "a genuine Quick Settings size change must still request placement"
);
geometryHooks.observeBestFriendsGeometry(carousel);
geometryObserverInstance.trigger([{ target: quickSettings }]);
assert.equal(
  geometryHooks.getQueuedMounts(),
  1,
  "the committed expanded size must not produce a redundant delayed correction"
);
carouselHeight = 330;
geometryObserverInstance.trigger([{ target: carousel }]);
assert.equal(
  geometryHooks.getQueuedMounts(),
  2,
  "a genuine carousel size change must remain observable"
);

localWriteEchoTest
  .then(() => {
    console.log("PASS Quick Settings Hide/Show state, accessibility, and node preservation");
  })
  .catch((error) => {
    process.nextTick(() => {
      throw error;
    });
  });
