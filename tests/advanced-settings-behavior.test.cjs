"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const contentSource = fs.readFileSync(path.join(projectRoot, "content.js"), "utf8");

function sourceBetween(start, end) {
  const startIndex = contentSource.indexOf(start);
  const endIndex = contentSource.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing source boundary: ${start}`);
  assert.notEqual(endIndex, -1, `missing source boundary: ${end}`);
  return contentSource.slice(startIndex, endIndex);
}

class FakeAnchor {
  constructor(href, id = "", classes = []) {
    this.href = href;
    this.id = id;
    this.classes = new Set(classes);
  }

  matches(selector) {
    return (
      selector === "a[href]" ||
      selector === "a[href], button" ||
      selector === `#${this.id}`
    );
  }

  querySelector(selector) {
    return selector.startsWith(".") && this.classes.has(selector.slice(1))
      ? {}
      : null;
  }
}

class FakeButton {
  constructor(id = "", classes = []) {
    this.id = id;
    this.classes = new Set(classes);
  }

  matches(selector) {
    return selector === "button" || selector === "a[href], button" || selector === `#${this.id}`;
  }

  querySelector(selector) {
    if (selector === `#${this.id}`) {
      return {};
    }
    return selector.startsWith(".") && this.classes.has(selector.slice(1))
      ? {}
      : null;
  }
}

class FakeSidebarRow {
  constructor(layout, { links = [], ids = [], classes = [], text = "" } = {}) {
    this.layout = layout;
    this.links = links;
    this.ids = new Set(ids);
    this.classes = new Set(classes);
    this.textContent = text;
    this.attributes = new Map();
    this.dataset = {};
    this.id = "";
    if (links.length > 0) {
      links[0].classes = new Set([...links[0].classes, ...classes]);
      if (!links[0].id && ids.length > 0) {
        links[0].id = ids[0];
      }
      this.children = links;
    } else if (ids.length > 0 || classes.length > 0) {
      this.children = [new FakeButton(ids[0] || "", classes)];
    } else {
      this.children = [];
    }
    this.parentElement = null;
    this.clickHandler = () => "original handler";
  }

  matches(selector) {
    return selector === "li";
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
    return selector === "a[href]" ? this.links : [];
  }

  querySelector(selector) {
    if (selector.startsWith("#")) {
      const id = selector.slice(1);
      return this.ids.has(id) || this.links.some((link) => link.id === id) ? {} : null;
    }
    if (selector.startsWith(".")) {
      return this.classes.has(selector.slice(1)) ? {} : null;
    }
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

class FakeSidebarRoot {
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

function makeNativeSidebarHarness(layout) {
  const gift = new FakeSidebarRow(layout, {
    links: [
      new FakeAnchor(
        layout === "redesigned"
          ? "https://www.roblox.com/giftcards-us"
          : "https://www.roblox.com/giftcards",
        layout === "legacy" ? "nav-giftcards" : ""
      )
    ],
    classes: layout === "redesigned" ? ["icon-regular-gift-card"] : [],
    text: "Geschenkkarten kaufen"
  });
  const store = new FakeSidebarRow(layout, {
    ids: layout === "legacy" ? ["nav-shop"] : [],
    classes: layout === "redesigned" ? ["icon-regular-building-store"] : [],
    text: "Offizieller Shop"
  });
  const englishLookalike = new FakeSidebarRow(layout, {
    links: [new FakeAnchor("https://www.roblox.com/home")],
    text: "Buy Gift Cards Official Store"
  });
  const externalPathLookalike = new FakeSidebarRow(layout, {
    links: [new FakeAnchor("https://example.com/giftcards")],
    text: "External gift cards"
  });
  const otherExtension = new FakeSidebarRow(layout, {
    links: [new FakeAnchor("https://www.roblox.com/btr-store")],
    classes: ["btr-nav-row"],
    text: "BTRoblox Store"
  });
  const root = new FakeSidebarRoot(layout, [
    gift,
    store,
    englishLookalike,
    externalPathLookalike,
    otherExtension
  ]);
  const footerGiftCards = new FakeAnchor("https://www.roblox.com/giftcards-us");
  const settings = {
    sidebarShortcuts: true,
    sidebarCustomShortcuts: true,
    sidebarGiftCards: false,
    sidebarOfficialStore: true
  };
  const hiddenAttribute = "data-rsl-native-sidebar-hidden";
  const document = {
    querySelector(selector) {
      if (
        (layout === "redesigned" && selector === "#left-navigation-container") ||
        (layout === "legacy" && /left-col-list/.test(selector))
      ) {
        return root;
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector.includes(`[${hiddenAttribute}]`)) {
        return root.rows.filter((row) => row.hasAttribute(hiddenAttribute));
      }
      if (selector.includes("#left-navigation-container") && layout === "redesigned") {
        return [root];
      }
      if (selector.includes("left-col-list") && layout === "legacy") {
        return [root];
      }
      return [];
    }
  };
  return {
    document,
    settings,
    hiddenAttribute,
    root,
    gift,
    store,
    englishLookalike,
    externalPathLookalike,
    otherExtension,
    footerGiftCards
  };
}

const nativeSidebarSource = sourceBetween(
  "  function isFeatureEnabled(",
  "  function normalizeBestFriendIds("
);
function makeNativeSidebarApi(harness) {
  return new Function(
    "featureSettings",
    "document",
    "location",
    "NATIVE_SIDEBAR_HIDDEN_ATTRIBUTE",
    "isExtensionRow",
    `${nativeSidebarSource}\nreturn { getNativeSidebarSemanticKey, cleanupNativeSidebarVisibility, syncNativeSidebarVisibility };`
  )(
    harness.settings,
    harness.document,
    { origin: "https://www.roblox.com" },
    harness.hiddenAttribute,
    (row) => Boolean(
      row &&
      (row.id === "rsl-add-shortcut-row" ||
        row.hasAttribute("data-rsl-shortcut-id") ||
        row.dataset.rslControl)
    )
  );
}

for (const layout of ["redesigned", "legacy"]) {
  const harness = makeNativeSidebarHarness(layout);
  const ownedControlRow = new FakeSidebarRow(layout, {
    links: [new FakeAnchor("https://www.roblox.com/giftcards-us", "", ["icon-regular-gift-card"])]
  });
  ownedControlRow.dataset.rslControl = "shortcut";
  ownedControlRow.setAttribute(harness.hiddenAttribute, "giftCards");
  const ownedShortcutRow = new FakeSidebarRow(layout, {
    links: [new FakeAnchor("https://www.roblox.com/giftcards-us", "", ["icon-regular-gift-card"])]
  });
  ownedShortcutRow.setAttribute("data-rsl-shortcut-id", "owned-fixture");
  ownedShortcutRow.setAttribute(harness.hiddenAttribute, "giftCards");
  const nestedUnrelatedRow = new FakeSidebarRow(layout, {
    links: [new FakeAnchor("https://www.roblox.com/home")]
  });
  nestedUnrelatedRow.querySelector = (selector) =>
    selector === ".icon-regular-gift-card" ? {} : null;
  for (const row of [ownedControlRow, ownedShortcutRow, nestedUnrelatedRow]) {
    row.root = harness.root;
    row.parentElement = harness.root;
    harness.root.rows.push(row);
  }
  const api = makeNativeSidebarApi(harness);
  const originalGiftHandler = harness.gift.clickHandler;
  const originalStoreHandler = harness.store.clickHandler;

  api.syncNativeSidebarVisibility();
  assert.equal(harness.gift.getAttribute(harness.hiddenAttribute), "giftCards");
  assert.equal(harness.store.hasAttribute(harness.hiddenAttribute), false);
  assert.equal(harness.englishLookalike.hasAttribute(harness.hiddenAttribute), false);
  assert.equal(harness.externalPathLookalike.hasAttribute(harness.hiddenAttribute), false);
  assert.equal(harness.otherExtension.hasAttribute(harness.hiddenAttribute), false);
  assert.equal(harness.footerGiftCards.hasAttribute?.(harness.hiddenAttribute) || false, false);
  assert.equal(ownedControlRow.hasAttribute(harness.hiddenAttribute), false);
  assert.equal(ownedShortcutRow.hasAttribute(harness.hiddenAttribute), false);
  assert.equal(nestedUnrelatedRow.hasAttribute(harness.hiddenAttribute), false);
  api.syncNativeSidebarVisibility();
  assert.equal(
    ownedControlRow.hasAttribute(harness.hiddenAttribute) ||
      ownedShortcutRow.hasAttribute(harness.hiddenAttribute),
    false,
    "repeated sync must never classify RoTool-owned rows as native Gift Cards"
  );

  harness.settings.sidebarGiftCards = true;
  harness.settings.sidebarOfficialStore = false;
  api.syncNativeSidebarVisibility();
  assert.equal(harness.gift.hasAttribute(harness.hiddenAttribute), false);
  assert.equal(harness.store.getAttribute(harness.hiddenAttribute), "officialStore");
  assert.strictEqual(harness.root.rows[0], harness.gift, "Gift Cards must remain the same node");
  assert.strictEqual(harness.root.rows[1], harness.store, "Official Store must remain the same node");
  assert.strictEqual(harness.gift.clickHandler, originalGiftHandler);
  assert.strictEqual(harness.store.clickHandler, originalStoreHandler);

  harness.settings.sidebarShortcuts = false;
  api.syncNativeSidebarVisibility();
  assert.equal(
    harness.root.rows.some((row) => row.hasAttribute(harness.hiddenAttribute)),
    false,
    "the Sidebar master must restore every native item"
  );

  harness.settings.sidebarShortcuts = true;
  harness.settings.sidebarGiftCards = false;
  api.syncNativeSidebarVisibility();
  assert.equal(harness.gift.getAttribute(harness.hiddenAttribute), "giftCards");
  harness.gift.links[0].href = "https://www.roblox.com/home";
  harness.gift.classes.clear();
  harness.gift.links[0].classes.clear();
  harness.gift.links[0].id = "";
  api.syncNativeSidebarVisibility();
  assert.equal(
    harness.gift.hasAttribute(harness.hiddenAttribute),
    false,
    "a React-reused row must not retain a stale hidden marker"
  );
}

const cleanCloneSource = sourceBetween(
  "  function cleanClone(",
  "  function findLabel("
);
const cleanClone = new Function(
  "NATIVE_SIDEBAR_HIDDEN_ATTRIBUTE",
  `${cleanCloneSource}\nreturn cleanClone;`
)("data-rsl-native-sidebar-hidden");
const clonedDescendant = {
  attributes: new Map([["data-rsl-native-sidebar-hidden", "giftCards"]]),
  removeAttribute(name) {
    this.attributes.delete(name);
  },
  classList: { remove() {} }
};
const clonedTemplate = {
  attributes: new Map([
    ["data-rsl-native-sidebar-hidden", "giftCards"],
    ["style", "display:none"]
  ]),
  removeAttribute(name) {
    this.attributes.delete(name);
  },
  classList: { remove() {} },
  querySelectorAll(selector) {
    if (selector === "*") {
      return [clonedDescendant];
    }
    if (selector === ".notification, .rbx-text-navbar-right") {
      return [];
    }
    return [];
  }
};
cleanClone(clonedTemplate);
assert.equal(clonedTemplate.attributes.has("data-rsl-native-sidebar-hidden"), false);
assert.equal(clonedDescendant.attributes.has("data-rsl-native-sidebar-hidden"), false);
assert.equal(
  clonedTemplate.attributes.has("style"),
  false,
  "a hidden native template must produce a visible RoTool shortcut clone"
);

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map();
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.hidden = false;
    this.parentElement = null;
    this.listeners = new Map();
    this.className = "";
    this.innerHTML = "";
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

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  append(...children) {
    children.filter(Boolean).forEach((child) => {
      child.parentElement = this;
      this.children.push(child);
    });
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (
          selector === "[data-rsl-quick-play-action]" &&
          child.hasAttribute("data-rsl-quick-play-action")
        ) {
          matches.push(child);
        }
        visit(child);
      }
    };
    visit(this);
    return matches;
  }

  querySelector(selector) {
    if (selector === "[data-rsl-quick-play-action]") {
      return this.querySelectorAll(selector)[0] || null;
    }
    const actionMatch = selector.match(/^\[data-rsl-quick-play-action="([^"]+)"\]$/);
    if (actionMatch) {
      return this.querySelectorAll("[data-rsl-quick-play-action]").find(
        (node) => node.getAttribute("data-rsl-quick-play-action") === actionMatch[1]
      ) || null;
    }
    return null;
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (
        selector === "[data-rsl-quick-play-surface]" &&
        current.hasAttribute("data-rsl-quick-play-surface")
      ) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }
}

const makeQuickPlaySurfaceSource = sourceBetween(
  "  function makeQuickPlaySurface(",
  "  function removeQuickPlaySurface("
);
const makeQuickPlaySurfaceFactory = new Function(
  "document",
  "enabledActions",
  "isQuickPlayActionEnabled",
  "QUICK_PLAY_SURFACE_ATTRIBUTE",
  "QUICK_PLAY_TRAY_ATTRIBUTE",
  "QUICK_PLAY_ACTION_ATTRIBUTE",
  "QUICK_PLAY_PLACE_ID_ATTRIBUTE",
  "getQuickPlayCardName",
  "openPrivateServersDialog",
  "readPrivateServerPriceFromSurface",
  `${makeQuickPlaySurfaceSource}\nreturn makeQuickPlaySurface;`
);

function makeSurfaceFor(enabledActionNames) {
  const enabledActions = new Set(enabledActionNames);
  const document = { createElement: (tagName) => new FakeElement(tagName) };
  const makeSurface = makeQuickPlaySurfaceFactory(
    document,
    enabledActions,
    (action) => enabledActions.has(action),
    "data-rsl-quick-play-surface",
    "data-rsl-quick-play-tray",
    "data-rsl-quick-play-action",
    "data-rsl-quick-play-place-id",
    () => "Example Game",
    () => undefined,
    () => null
  );
  return makeSurface(new FakeElement("li"), new FakeElement("div"), "12345");
}

const quickPlayActionCases = [
  { enabled: ["private"], expected: ["private"] },
  { enabled: ["play"], expected: ["play"] },
  { enabled: ["random"], expected: ["random"] },
  { enabled: ["private", "random"], expected: ["private", "random"] },
  { enabled: ["play", "random"], expected: ["play", "random"] },
  { enabled: ["private", "play", "random"], expected: ["private", "play", "random"] }
];
for (const { enabled, expected } of quickPlayActionCases) {
  const surface = makeSurfaceFor(enabled);
  assert.ok(surface, `${enabled.join("+")} must create a surface`);
  assert.equal(surface.dataset.rslQuickPlayPlaceId, "12345");
  assert.deepEqual(
    surface
      .querySelectorAll("[data-rsl-quick-play-action]")
      .map((button) => button.getAttribute("data-rsl-quick-play-action")),
    expected,
    "enabled launch actions must retain the canonical Private, Play, Random order"
  );
}
assert.equal(makeSurfaceFor([]), null, "all actions off must not create an empty surface");

const updatePrivateVisibilitySource = sourceBetween(
  "  function updatePrivateServerButtonVisibility(",
  "  function normalizePrivateServerPrice("
);
const updatePrivateServerButtonVisibility = new Function(
  "QUICK_PLAY_ACTION_ATTRIBUTE",
  "QUICK_PLAY_PRIVATE_WIDE_MIN_THUMBNAIL_WIDTH",
  "QUICK_PLAY_PRIVATE_MIN_THUMBNAIL_WIDTH",
  "QUICK_PLAY_PRIVATE_LAYOUT_HYSTERESIS_PX",
  "PRIVATE_SUPPORT_TABINDEX_ATTRIBUTE",
  "getQuickPlayBox",
  `${updatePrivateVisibilitySource}\nreturn updatePrivateServerButtonVisibility;`
)(
  "data-rsl-quick-play-action",
  172,
  144,
  8,
  "data-rsl-private-support-owned-tabindex",
  (surface) => ({ width: Number.parseFloat(surface.style.width) || 0 })
);

const privateOnlyUnknown = makeSurfaceFor(["private"]);
privateOnlyUnknown.style.width = "100px";
updatePrivateServerButtonVisibility(privateOnlyUnknown);
assert.equal(
  privateOnlyUnknown.getAttribute("tabindex"),
  "0",
  "Private-only unknown support must expose a keyboard-focusable activation surface"
);
assert.equal(
  privateOnlyUnknown.hasAttribute("data-rsl-private-support-owned-tabindex"),
  true,
  "RoTool must track only the tabindex it owns so cleanup cannot remove another extension's value"
);
assert.equal(
  privateOnlyUnknown.querySelector('[data-rsl-quick-play-action="private"]').hidden,
  true,
  "the Private action remains hidden until Roblox confirms support"
);

function applySupportedPrivateLayout(enabledActions, width) {
  const surface = makeSurfaceFor(enabledActions);
  assert.ok(surface, "a configuration with an enabled action must create a surface");
  surface.style.width = `${width}px`;
  surface.dataset.rslQuickPlayLayout = width >= 172 ? "wide" : "compact";
  surface.dataset.rslPrivateServerSupported = "true";
  updatePrivateServerButtonVisibility(surface);
  return {
    surface,
    privateButton: surface.querySelector(
      '[data-rsl-quick-play-action="private"]'
    )
  };
}

const privateOnlyNarrow = applySupportedPrivateLayout(["private"], 100);
assert.equal(privateOnlyNarrow.privateButton.hidden, false);
assert.equal(privateOnlyNarrow.surface.dataset.rslPrivateServerLayout, "two");
assert.equal(
  privateOnlyNarrow.surface.querySelectorAll("[data-rsl-quick-play-action]").length,
  1,
  "a supported private-only narrow card must keep a real action rather than an empty tray"
);

const privateAndPlayNarrow = applySupportedPrivateLayout(["private", "play"], 100);
assert.equal(privateAndPlayNarrow.privateButton.hidden, false);
assert.equal(privateAndPlayNarrow.surface.dataset.rslPrivateServerLayout, "two");

const allActionsNarrow = applySupportedPrivateLayout(
  ["private", "play", "random"],
  100
);
assert.equal(allActionsNarrow.privateButton.hidden, true);
assert.equal(allActionsNarrow.surface.dataset.rslPrivateServerLayout, "two");
allActionsNarrow.surface.style.width = "144px";
updatePrivateServerButtonVisibility(allActionsNarrow.surface);
assert.equal(allActionsNarrow.privateButton.hidden, false);
assert.equal(allActionsNarrow.surface.dataset.rslPrivateServerLayout, "three");

const activatePrivateSupportSource = sourceBetween(
  "  function activatePrivateServerSupport(",
  "  function removePrivateServerSupportInteraction("
);
const removePrivateSupportSource = sourceBetween(
  "  function removePrivateServerSupportInteraction(",
  "  function observePrivateServerSupport("
);
const observePrivateSupportSource = sourceBetween(
  "  function observePrivateServerSupport(",
  "  function normalizePrivateServerCursor("
);
let privateActionEnabled = false;
let privateSupportLoads = 0;
const privateSupportBindings = new Map();
const privateSupportApi = new Function(
  "isQuickPlayActionEnabled",
  "loadPrivateServerSupportForSurface",
  "privateServerSupportInteractionBindings",
  "QUICK_PLAY_HOST_ATTRIBUTE",
  "getPrivateServerSupportSurfacePlaceId",
  "getCachedPrivateServerSupport",
  "applyPrivateServerSupport",
  `${activatePrivateSupportSource}\n${removePrivateSupportSource}\n${observePrivateSupportSource}\n` +
    "return { activatePrivateServerSupport, observePrivateServerSupport };"
)(
  (action) => action === "private" && privateActionEnabled,
  () => {
    privateSupportLoads += 1;
  },
  privateSupportBindings,
  "data-rsl-quick-play-host",
  () => "12345",
  () => null,
  () => undefined
);
const supportHostListeners = new Map();
const supportHost = {
  addEventListener(type, listener) {
    supportHostListeners.set(type, listener);
  },
  removeEventListener(type) {
    supportHostListeners.delete(type);
  },
  matches() {
    return false;
  }
};
const guardedSupportSurface = {
  isConnected: true,
  dataset: {},
  parentElement: supportHost,
  closest() {
    return supportHost;
  }
};
privateSupportApi.observePrivateServerSupport(guardedSupportSurface);
privateSupportApi.activatePrivateServerSupport(guardedSupportSurface);
assert.equal(guardedSupportSurface.dataset.rslPrivateSupportObserved, undefined);
assert.equal(guardedSupportSurface.dataset.rslPrivateSupportActivated, undefined);
assert.equal(supportHostListeners.size, 0);
assert.equal(privateSupportLoads, 0, "a disabled Private action must not reach support loading");

privateActionEnabled = true;
privateSupportApi.observePrivateServerSupport(guardedSupportSurface);
assert.equal(guardedSupportSurface.dataset.rslPrivateSupportObserved, "true");
assert.equal(supportHostListeners.has("pointerenter"), true);
assert.equal(supportHostListeners.has("focusin"), true);
supportHostListeners.get("focusin")({ isTrusted: true });
assert.equal(guardedSupportSurface.dataset.rslPrivateSupportActivated, "true");
assert.equal(privateSupportLoads, 1);
assert.equal(
  privateOnlyNarrow.privateButton.tagName,
  "BUTTON",
  "a supported Private-only action must remain natively keyboard-focusable"
);
assert.equal(privateOnlyNarrow.privateButton.hidden, false);
assert.equal(
  privateOnlyNarrow.privateButton.listeners.has("click"),
  true,
  "the visible Private-only button must retain its keyboard-generated click action"
);

const getSupportPlaceIdSource = sourceBetween(
  "  function getPrivateServerSupportSurfacePlaceId(",
  "  function getPrivateServerSupportSurfaces("
);
const getSupportPlaceId = new Function(
  "normalizeQuickPlayPlaceId",
  "QUICK_PLAY_ACTION_ATTRIBUTE",
  "QUICK_PLAY_PLACE_ID_ATTRIBUTE",
  `${getSupportPlaceIdSource}\nreturn getPrivateServerSupportSurfacePlaceId;`
)(
  (value) => (/^[1-9]\d{0,15}$/.test(String(value || "")) ? String(value) : null),
  "data-rsl-quick-play-action",
  "data-rsl-quick-play-place-id"
);
const privateOnlySurface = makeSurfaceFor(["private"]);
assert.equal(
  getSupportPlaceId(privateOnlySurface),
  "12345",
  "Private Servers-only mode must resolve the surface Place ID without a Play button"
);

const cancelQueuedSupportSource = sourceBetween(
  "  function cancelQueuedPrivateServerSupportRequests(",
  "  function getPrivateServerSupportSurfacePlaceId("
);
const cancelledErrors = [];
const queuedSupportTasks = [
  { reject(error) { cancelledErrors.push(error); } },
  { reject(error) { cancelledErrors.push(error); } }
];
const cancelQueuedPrivateServerSupportRequests = new Function(
  "privateServerSupportRequestQueue",
  `${cancelQueuedSupportSource}\nreturn cancelQueuedPrivateServerSupportRequests;`
)(queuedSupportTasks);
cancelQueuedPrivateServerSupportRequests();
assert.equal(queuedSupportTasks.length, 0);
assert.equal(cancelledErrors.length, 2);
assert.equal(
  cancelledErrors.every(
    (error) => error instanceof Error && error.code === "CANCELLED"
  ),
  true,
  "Quick Play cleanup must settle every queued support promise as cancelled"
);

const quickPlayResultHandlerSource = sourceBetween(
  "  function handleQuickPlayResult(",
  "  function dispatchRandomServerResponse("
);
const enabledLaunchActions = new Set();
let clearedLaunchFeedback = 0;
let scheduledLaunchFeedback = 0;
const launchFeedbackTimers = new Map();
const handleQuickPlayResult = new Function(
  "isFeatureEnabled",
  "isQuickPlayActionEnabled",
  "QUICK_PLAY_ACTION_ATTRIBUTE",
  "QUICK_PLAY_SURFACE_ATTRIBUTE",
  "clearQuickPlayFeedback",
  "window",
  "quickPlayFeedbackTimers",
  "QUICK_PLAY_FEEDBACK_MS",
  `${quickPlayResultHandlerSource}\nreturn handleQuickPlayResult;`
)(
  (key) => key === "quickPlay",
  (action) => enabledLaunchActions.has(action),
  "data-rsl-quick-play-action",
  "data-rsl-quick-play-surface",
  () => {
    clearedLaunchFeedback += 1;
  },
  {
    setTimeout() {
      scheduledLaunchFeedback += 1;
      return scheduledLaunchFeedback;
    }
  },
  launchFeedbackTimers,
  1_600
);

function makeLaunchResultButton(action) {
  const attributes = new Map([
    ["data-rsl-quick-play-action", action],
    ["aria-label", `${action} original label`]
  ]);
  const surface = {};
  const button = {
    isConnected: true,
    disabled: false,
    dataset: { rslQuickPlayDefaultLabel: `${action} original label` },
    closest(selector) {
      if (selector === "[data-rsl-quick-play-action]") {
        return button;
      }
      if (selector === "[data-rsl-quick-play-surface]") {
        return surface;
      }
      return null;
    },
    getAttribute(name) {
      return attributes.get(name) ?? null;
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    hasAttribute(name) {
      return attributes.has(name);
    }
  };
  return { attributes, button };
}

for (const action of ["play", "random"]) {
  const fixture = makeLaunchResultButton(action);
  handleQuickPlayResult({
    target: fixture.button,
    detail: JSON.stringify({ v: 1, action, code: "started" })
  });
  assert.equal(fixture.button.dataset.rslQuickPlayState, undefined);
  assert.equal(fixture.button.disabled, false);
  assert.equal(fixture.attributes.has("aria-busy"), false);
  assert.equal(
    fixture.attributes.get("aria-label"),
    `${action} original label`,
    `a stale ${action} result must not update UI after its child action is disabled`
  );
}
assert.equal(clearedLaunchFeedback, 0);
assert.equal(scheduledLaunchFeedback, 0);
assert.equal(launchFeedbackTimers.size, 0);

enabledLaunchActions.add("play");
const enabledPlayResult = makeLaunchResultButton("play");
handleQuickPlayResult({
  target: enabledPlayResult.button,
  detail: JSON.stringify({ v: 1, action: "play", code: "started" })
});
assert.equal(enabledPlayResult.button.dataset.rslQuickPlayState, "launching");
assert.equal(enabledPlayResult.button.disabled, true);
assert.equal(enabledPlayResult.attributes.get("aria-busy"), "true");
assert.equal(clearedLaunchFeedback, 1, "the enabled control proves the result harness is active");

const randomRequestHandlerSource = sourceBetween(
  "  function handleRandomServerRequest(",
  "  function sendPrivateServerRuntimeMessage("
);
let randomChildEnabled = false;
let randomRuntimeMessages = 0;
let clearedRandomFeedback = 0;
let randomResponses = 0;
const handleRandomServerRequest = new Function(
  "isQuickPlayActionEnabled",
  "QUICK_PLAY_ACTION_ATTRIBUTE",
  "QUICK_PLAY_SURFACE_ATTRIBUTE",
  "QUICK_PLAY_PLACE_ID_ATTRIBUTE",
  "normalizeQuickPlayPlaceId",
  "isQuickPlayButtonCurrent",
  "dispatchRandomServerResponse",
  "clearQuickPlayFeedback",
  "chrome",
  `let quickPlayRandomRequestId = 0;\n${randomRequestHandlerSource}\nreturn handleRandomServerRequest;`
)(
  (action) => action === "random" && randomChildEnabled,
  "data-rsl-quick-play-action",
  "data-rsl-quick-play-surface",
  "data-rsl-quick-play-place-id",
  (value) => (/^[1-9]\d{0,15}$/.test(String(value || "")) ? String(value) : null),
  () => true,
  () => {
    randomResponses += 1;
  },
  () => {
    clearedRandomFeedback += 1;
  },
  {
    runtime: {
      lastError: null,
      sendMessage() {
        randomRuntimeMessages += 1;
      }
    }
  }
);
const randomRequestAttributes = new Map([
  ["data-rsl-quick-play-place-id", "12345"]
]);
const randomRequestSurface = {};
const randomRequestButton = {
  disabled: false,
  dataset: {},
  closest(selector) {
    if (selector === '[data-rsl-quick-play-action="random"]') {
      return randomRequestButton;
    }
    if (selector === "[data-rsl-quick-play-surface]") {
      return randomRequestSurface;
    }
    return null;
  },
  getAttribute(name) {
    return randomRequestAttributes.get(name) ?? null;
  },
  setAttribute(name, value) {
    randomRequestAttributes.set(name, String(value));
  }
};
const validRandomRequestEvent = {
  target: randomRequestButton,
  detail: JSON.stringify({ v: 1, placeId: "12345" })
};
handleRandomServerRequest(validRandomRequestEvent);
assert.equal(randomRuntimeMessages, 0);
assert.equal(clearedRandomFeedback, 0);
assert.equal(randomRequestButton.disabled, false);
assert.equal(randomRequestButton.dataset.rslQuickPlayState, undefined);
assert.equal(randomRequestAttributes.has("aria-busy"), false);
assert.equal(randomResponses, 0);

randomChildEnabled = true;
handleRandomServerRequest(validRandomRequestEvent);
assert.equal(randomRuntimeMessages, 1, "the enabled control proves the request harness reaches runtime messaging");
assert.equal(clearedRandomFeedback, 1);
assert.equal(randomRequestButton.disabled, true);
assert.equal(randomRequestButton.dataset.rslQuickPlayState, "selecting");
assert.equal(randomRequestAttributes.get("aria-busy"), "true");

console.log(
  "PASS RoTool advanced settings native-sidebar restoration and per-action Quick Play behavior"
);
