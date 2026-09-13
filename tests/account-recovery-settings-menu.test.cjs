"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const contentSource = fs.readFileSync(path.join(root, "content.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function cssDeclarations(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(
    `(?:^|[},])\\s*${escapedSelector}\\s*(?:,|\\{)`,
    "m"
  ).exec(source);
  assert.ok(match, `missing CSS rule ${selector}`);
  const openBrace = source.indexOf("{", match.index);
  let depth = 1;
  let cursor = openBrace + 1;
  while (cursor < source.length && depth > 0) {
    if (source[cursor] === "{") depth += 1;
    if (source[cursor] === "}") depth -= 1;
    cursor += 1;
  }
  assert.equal(depth, 0, `unclosed CSS rule ${selector}`);
  const declarations = {};
  for (const declaration of source.slice(openBrace + 1, cursor - 1).split(";")) {
    const colon = declaration.indexOf(":");
    if (colon < 0) continue;
    const property = declaration.slice(0, colon).trim();
    const value = declaration.slice(colon + 1).trim().replace(/\s+/g, " ");
    if (property) declarations[property] = value;
  }
  return declarations;
}

function cssMediaDeclarations(source, condition, selector) {
  const escapedCondition = condition.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`@media\\s*\\(${escapedCondition}\\)\\s*\\{`, "g");
  for (const match of source.matchAll(pattern)) {
    const openBrace = source.indexOf("{", match.index);
    let depth = 1;
    let cursor = openBrace + 1;
    while (cursor < source.length && depth > 0) {
      if (source[cursor] === "{") depth += 1;
      if (source[cursor] === "}") depth -= 1;
      cursor += 1;
    }
    assert.equal(depth, 0, `unclosed @media (${condition})`);
    const block = source.slice(openBrace + 1, cursor - 1);
    try {
      return cssDeclarations(block, selector);
    } catch (error) {
      if (!String(error?.message || "").includes("missing CSS rule")) throw error;
    }
  }
  assert.fail(`missing ${selector} inside @media (${condition})`);
}

function selectorMatches(element, selector) {
  if (selector.includes(",")) {
    return selector.split(",").some((part) =>
      selectorMatches(element, part.trim())
    );
  }
  if (selector === "a[href]") {
    return element.tagName === "A" && element.hasAttribute("href");
  }
  if (selector.startsWith("[") && selector.endsWith("]")) {
    const body = selector.slice(1, -1);
    const equality = /^([^=]+)=['"]?([^'"]+)['"]?$/.exec(body);
    return equality
      ? element.getAttribute(equality[1]) === equality[2]
      : element.hasAttribute(body);
  }
  if (selector.startsWith(".")) {
    return selector.split(",").some((part) =>
      element.className.split(/\s+/).includes(part.trim().slice(1))
    );
  }
  return false;
}

class FakeElement {
  constructor(tagName) {
    this.nodeType = 1;
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this.className = "";
    this.hidden = false;
    this.open = false;
    this.textContent = "";
    this.listeners = new Map();
    this.classList = {
      contains: (className) => this.className.split(/\s+/).includes(className)
    };
  }

  set id(value) {
    this.setAttribute("id", value);
  }

  get id() {
    return this.getAttribute("id") || "";
  }

  get firstElementChild() {
    return this.children[0] || null;
  }

  get isConnected() {
    for (let current = this; current; current = current.parentElement) {
      if (
        current === globalThis.document?.body ||
        current === globalThis.document?.documentElement
      ) {
        return true;
      }
    }
    return false;
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    this.children.slice().forEach((child) => child.remove());
    if (!this._innerHTML.includes("rsl-account-recovery-dialog__surface")) {
      return;
    }
    const surface = new FakeElement("div");
    surface.className = "rsl-dialog__surface rsl-account-recovery-dialog__surface";
    surface.setAttribute("data-size", "Large");
    const closeContainer = new FakeElement("div");
    closeContainer.className = "rsl-dialog__close-container";
    const close = new FakeElement("button");
    close.className = "rsl-icon-button foundation-web-close-affordance";
    close.setAttribute("data-rsl-account-recovery-close", "");
    closeContainer.append(close);
    const modalBody = new FakeElement("div");
    modalBody.className = "rsl-dialog__body rsl-account-recovery__body";
    const header = new FakeElement("div");
    header.className = "rsl-dialog__header rsl-account-recovery__header";
    const frameContainer = new FakeElement("div");
    frameContainer.className = "rsl-account-recovery__frame";
    const loading = new FakeElement("div");
    loading.className = "rsl-account-recovery__loading";
    frameContainer.append(loading);
    modalBody.append(header, frameContainer);
    surface.append(closeContainer, modalBody);
    this.append(surface);
  }

  get innerHTML() {
    return this._innerHTML || "";
  }

  set href(value) {
    this.setAttribute("href", value);
  }

  get href() {
    return this.getAttribute("href") || "";
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  append(...nodes) {
    for (const node of nodes) {
      node.remove();
      node.parentElement = this;
      this.children.push(node);
    }
  }

  insertBefore(node, reference) {
    const index = this.children.indexOf(reference);
    assert.notEqual(index, -1, "the insertion reference must belong to the menu");
    node.remove();
    node.parentElement = this;
    this.children.splice(index, 0, node);
    return node;
  }

  insertAdjacentElement(position, node) {
    assert.equal(position, "afterend");
    const parent = this.parentElement;
    assert.ok(parent, "afterend requires a parent");
    const index = parent.children.indexOf(this);
    node.remove();
    node.parentElement = parent;
    parent.children.splice(index + 1, 0, node);
    return node;
  }

  remove() {
    if (!this.parentElement) return;
    const index = this.parentElement.children.indexOf(this);
    if (index >= 0) this.parentElement.children.splice(index, 1);
    this.parentElement = null;
  }

  attachShadow(options) {
    assert.fail(`Recovery outer modal must stay in light DOM, got ${JSON.stringify(options)}`);
  }

  showModal() {
    this.open = true;
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.fire("close", { currentTarget: this, target: this });
  }

  focus() {
    globalThis.document.activeElement = this;
  }

  closest(selector) {
    if (selector === "li" || selector === "li, [role='listitem']") {
      for (let current = this; current; current = current.parentElement) {
        if (
          current.tagName === "LI" ||
          current.getAttribute("role") === "listitem"
        ) {
          return current;
        }
      }
    }
    if (selector.includes("#navbar-settings button")) {
      for (let current = this; current; current = current.parentElement) {
        if (
          current.tagName === "BUTTON" &&
          current.parentElement?.id === "navbar-settings"
        ) {
          return current;
        }
      }
    }
    for (let current = this; current; current = current.parentElement) {
      if (selectorMatches(current, selector)) return current;
    }
    return null;
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (selectorMatches(child, selector)) matches.push(child);
        visit(child);
      }
    };
    visit(this);
    return matches;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  fire(type, event) {
    for (const listener of this.listeners.get(type) || []) listener(event);
  }
}

function makeEntry(text, { href = null, className = "rbx-menu-item" } = {}) {
  const item = new FakeElement("li");
  const anchor = new FakeElement("a");
  anchor.className = className;
  anchor.textContent = text;
  if (href !== null) anchor.href = href;
  item.append(anchor);
  return { item, anchor };
}

function menuLabels(menu) {
  return menu.children.map((item) => item.children[0]?.textContent || "");
}

const menus = [];
const settingsTriggers = [];
const timerQueue = [];
const microtaskQueue = [];
const historyCalls = [];
globalThis.Node = { ELEMENT_NODE: 1 };
globalThis.queueMicrotask = (callback) => {
  microtaskQueue.push(callback);
};
globalThis.window = {
  setTimeout(callback, delay) {
    timerQueue.push({ callback, delay });
    return timerQueue.length;
  }
};
const documentElement = new FakeElement("html");
documentElement.dataset = {};
const body = new FakeElement("body");
body.className = "dark-theme";
globalThis.document = {
  activeElement: null,
  documentElement,
  body,
  createElement(tagName) {
    return new FakeElement(tagName);
  },
  querySelectorAll(selector) {
    if (
      selector ===
      "#settings-popover-menu, #settings-popover, #settings-popover ul.dropdown-menu"
    ) {
      return menus;
    }
    if (selector.includes("#navbar-settings button")) {
      return settingsTriggers;
    }
    const roots = [...menus, ...settingsTriggers];
    if (selector === "a[href]") {
      return roots.flatMap((root) => root.querySelectorAll(selector));
    }
    if (selector === ".account-switch-menu-item, .logout-menu-item") {
      return roots.flatMap((root) => root.querySelectorAll(selector));
    }
    return roots.flatMap((root) => [
      ...(selectorMatches(root, selector) ? [root] : []),
      ...root.querySelectorAll(selector)
    ]);
  },
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  },
  getElementById(id) {
    const roots = [...menus, ...settingsTriggers, body, documentElement];
    for (const root of roots) {
      if (root.id === id) return root;
      const match = root.querySelectorAll("[id]").find((node) => node.id === id);
      if (match) return match;
    }
    return null;
  }
};
const assignedUrls = [];
globalThis.location = {
  href: "https://www.roblox.com/games/123/Test",
  origin: "https://www.roblox.com",
  pathname: "/games/123/Test",
  search: "",
  hash: "",
  assign(url) {
    assignedUrls.push(String(url));
  }
};
function setLocation(rawUrl) {
  const url = new URL(rawUrl);
  globalThis.location.href = url.href;
  globalThis.location.origin = url.origin;
  globalThis.location.pathname = url.pathname;
  globalThis.location.search = url.search;
  globalThis.location.hash = url.hash;
}
globalThis.history = {
  state: null,
  replaceState(state, _title, rawUrl) {
    historyCalls.push({ state, url: String(rawUrl) });
    setLocation(new URL(String(rawUrl), globalThis.location.href).href);
  }
};
const sentMessages = [];
globalThis.chrome = {
  runtime: {
    getURL(relativePath = "") {
      return `chrome-extension://recovery-fixture/${relativePath}`;
    },
    sendMessage(message) {
      sentMessages.push(message);
      return Promise.resolve({ ignored: true, snapshot: "must-not-be-consumed" });
    }
  }
};
globalThis.__rslContentTestHooks = { skipInitialize: true };
require(path.join(root, "content.js"));

const hooks = globalThis.__rslContentTestHooks;
const constants = hooks.accountRecoverySettingsMenuConstants;
assert.deepEqual({ ...constants }, {
  itemAttribute: "data-rsl-account-recovery-menu-item",
  itemText: "Recovery Snapshot",
  masterFeatureKey: "recoverySnapshots",
  menuFeatureKey: "recoverySnapshotMenu",
  modalHostId: "rsl-account-recovery-modal-host",
  pagePath: "recovery-snapshot.html",
  pageView: "home-modal"
});

const archivePreferenceConstants =
  hooks.accountRecoveryArchivePreferencesConstants;
assert.equal(
  archivePreferenceConstants.getMessageType,
  "rsl:get-account-recovery-archive-preferences"
);
assert.equal(
  archivePreferenceConstants.setMessageType,
  "rsl:set-account-recovery-archive-preferences"
);
assert.deepEqual([...archivePreferenceConstants.frequencies], [
  "daily", "weekly", "monthly"
]);
assert.deepEqual([...archivePreferenceConstants.retentions], [3, 5, 10]);
assert.deepEqual(
  hooks.normalizeAccountRecoveryArchivePreferences(null),
  {
    version: 2,
    frequency: "daily",
    retention: 5,
    sections: [
      "usernameHistory",
      "twoStepVerification",
      "purchases",
      "currencyPurchases",
      "tradeHistory",
      "recentlyPlayed",
      "createdExperiences",
      "violations"
    ],
    revision: 0
  },
  "fresh v2 preferences must request every supported automatic-capture section"
);
assert.deepEqual(
  { ...archivePreferenceConstants.defaults,
    sections: [...archivePreferenceConstants.defaults.sections] },
  {
    version: 2,
    frequency: "daily",
    retention: 5,
    sections: [
      "usernameHistory",
      "twoStepVerification",
      "purchases",
      "currencyPurchases",
      "tradeHistory",
      "recentlyPlayed",
      "createdExperiences",
      "violations"
    ],
    revision: 0
  }
);
assert.deepEqual(
  hooks.normalizeAccountRecoveryArchivePreferences({
    version: 1,
    frequency: "weekly",
    retention: 10,
    sections: ["violations", "usernameHistory"],
    revision: 4
  }),
  {
    version: 2,
    frequency: "weekly",
    retention: 10,
    sections: ["usernameHistory", "violations"],
    revision: 4
  },
  "valid v1 privacy choices must migrate to v2 in canonical supported order"
);
assert.deepEqual(
  hooks.normalizeAccountRecoveryArchivePreferences({
    version: 2,
    frequency: "monthly",
    retention: 3,
    sections: [],
    revision: 8
  }),
  {
    version: 2,
    frequency: "monthly",
    retention: 3,
    sections: [],
    revision: 8
  },
  "an explicit empty automatic-capture selection must remain empty"
);
assert.deepEqual(
  hooks.normalizeAccountRecoveryArchivePreferencesResponse({
    ok: true,
    frequency: "daily",
    retention: 5,
    sections: ["recentlyPlayed", "purchases"],
    revision: 2
  }),
  {
    version: 2,
    frequency: "daily",
    retention: 5,
    sections: ["purchases", "recentlyPlayed"],
    revision: 2
  },
  "the strict v2 response must retain and canonicalize automatic-capture choices"
);
assert.equal(
  hooks.normalizeAccountRecoveryArchivePreferencesResponse({
    ok: true,
    frequency: "daily",
    retention: 5,
    sections: [],
    revision: 2,
    unexpected: true
  }),
  null,
  "the Settings channel must reject response fields outside its strict contract"
);
const archivePreferenceWriteSource = contentSource.slice(
  contentSource.indexOf(
    "  function writeAccountRecoveryArchivePreferences(preferences)"
  ),
  contentSource.indexOf("  function featureSettingsStorageGet()")
);
assert.match(
  archivePreferenceWriteSource,
  /sendAccountRecoveryArchivePreferencesMessage\(\{\s*type: ACCOUNT_RECOVERY_ARCHIVE_PREFERENCES_SET_MESSAGE_TYPE,\s*frequency: preferences\.frequency,\s*retention: preferences\.retention,\s*sections: \[\.\.\.preferences\.sections\]\s*\}\)/,
  "the v2 Settings write must send only schedule, retention, and automatic-capture section choices"
);

const primary = new FakeElement("ul");
const btr = makeEntry("BTR Settings");
const ropro = makeEntry("RoPro Settings");
const externalImpostor = makeEntry("External Settings", {
  href: "https://example.com/my/account"
});
const nativeSettings = makeEntry("Settings", { href: "/my/account" });
const quickSignIn = makeEntry("Quick Sign In", {
  href: "/crossdevicelogin/ConfirmCode"
});
const accountSwitch = makeEntry("Switch Accounts", {
  href: "#",
  className: "rbx-menu-item account-switch-menu-item"
});
const logout = makeEntry("Logout", {
  href: "#",
  className: "rbx-menu-item logout-menu-item"
});
primary.append(
  btr.item,
  ropro.item,
  externalImpostor.item,
  nativeSettings.item,
  quickSignIn.item,
  accountSwitch.item,
  logout.item
);
menus.push(primary);

hooks.mountAccountRecoverySettingsMenuItem();
assert.deepEqual(menuLabels(primary), [
  "BTR Settings",
  "RoPro Settings",
  "External Settings",
  "Settings",
  "Recovery Snapshot",
  "Quick Sign In",
  "Switch Accounts",
  "Logout"
]);
assert.equal(primary.children[0], btr.item, "BTRoblox must remain untouched");
assert.equal(primary.children[1], ropro.item, "RoPro must remain untouched");

const ownedSelector = `[${constants.itemAttribute}]`;
const firstOwnedItem = primary.querySelector(ownedSelector);
const recoveryAnchor = firstOwnedItem.children[0];
assert.equal(recoveryAnchor.className, "rbx-menu-item");
assert.equal(recoveryAnchor.textContent, "Recovery Snapshot");
assert.equal(recoveryAnchor.getAttribute("aria-haspopup"), "dialog");
assert.equal(recoveryAnchor.children.length, 0, "the native menu label needs no branding");

hooks.mountAccountRecoverySettingsMenuItem();
assert.equal(primary.querySelectorAll(ownedSelector).length, 1);
assert.equal(primary.querySelector(ownedSelector), firstOwnedItem);

let prevented = false;
recoveryAnchor.fire("click", {
  isTrusted: false,
  preventDefault() {
    prevented = true;
  }
});
assert.equal(prevented, true);
assert.deepEqual(sentMessages, [], "synthetic page clicks must not open recovery");

recoveryAnchor.fire("click", {
  isTrusted: true,
  preventDefault() {
    prevented = true;
  }
});
assert.equal(hooks.getAccountRecoveryPageTheme(), "dark");
assert.deepEqual(sentMessages, []);
assert.deepEqual(assignedUrls, [
  "https://www.roblox.com/home?rotool=recovery-snapshot"
]);
setLocation("https://www.roblox.com/de/games/123/Test");
assert.equal(
  hooks.getAccountRecoveryHomeUrl(),
  "https://www.roblox.com/de/home?rotool=recovery-snapshot",
  "routing to Home preserves a supported Roblox locale"
);
setLocation("https://www.roblox.com/games/123/Test");

const duplicate = new FakeElement("li");
duplicate.setAttribute(constants.itemAttribute, "");
duplicate.append(new FakeElement("a"));
primary.append(duplicate);
hooks.mountAccountRecoverySettingsMenuItem();
assert.equal(primary.querySelectorAll(ownedSelector).length, 1);
assert.equal(primary.querySelector(ownedSelector), firstOwnedItem);

const replacementMenu = new FakeElement("ul");
const replacementBtr = makeEntry("BTR Settings");
const replacementSwitch = makeEntry("Switch Accounts", {
  href: "#",
  className: "rbx-menu-item account-switch-menu-item"
});
const replacementLogout = makeEntry("Logout", {
  href: "#",
  className: "rbx-menu-item logout-menu-item"
});
replacementMenu.append(
  replacementBtr.item,
  replacementSwitch.item,
  replacementLogout.item
);
menus.push(replacementMenu);
hooks.mountAccountRecoverySettingsMenuItem();
assert.deepEqual(menuLabels(replacementMenu), [
  "BTR Settings",
  "Recovery Snapshot",
  "Switch Accounts",
  "Logout"
]);
assert.equal(primary.querySelectorAll(ownedSelector).length, 1);
assert.equal(replacementMenu.querySelectorAll(ownedSelector).length, 1);

const settingsTriggerItem = new FakeElement("li");
settingsTriggerItem.id = "navbar-settings";
const settingsTrigger = new FakeElement("button");
settingsTrigger.setAttribute("aria-haspopup", "true");
settingsTrigger.setAttribute("aria-describedby", "late-settings-popup");
settingsTriggerItem.append(settingsTrigger);
settingsTriggers.push(settingsTrigger);

hooks.handleAccountRecoverySettingsTriggerClick({
  isTrusted: false,
  target: settingsTrigger
});
assert.equal(timerQueue.length, 0, "synthetic settings clicks schedule nothing");
hooks.handleAccountRecoverySettingsTriggerClick({
  isTrusted: true,
  target: settingsTrigger
});
assert.deepEqual(
  timerQueue.map(({ delay }) => delay),
  [0, 50, 150, 350, 750],
  "the first native menu open receives bounded late-mount retries"
);

const dynamicSurface = new FakeElement("div");
dynamicSurface.id = "late-settings-popup";
dynamicSurface.className = "popover-content";
dynamicSurface.setAttribute("role", "menu");
const dynamicList = new FakeElement("ul");
const dynamicSettings = makeEntry("Settings", { href: "/my/account" });
const dynamicLogout = makeEntry("Logout", {
  href: "#",
  className: "rbx-menu-item logout-menu-item"
});
dynamicList.append(dynamicSettings.item, dynamicLogout.item);
dynamicSurface.append(dynamicList);
menus.push(dynamicSurface);
for (const { callback } of timerQueue.sort((left, right) => left.delay - right.delay)) {
  callback();
}
assert.deepEqual(menuLabels(dynamicList), [
  "Settings",
  "Recovery Snapshot",
  "Logout"
]);
assert.equal(dynamicList.querySelectorAll(ownedSelector).length, 1);
assert.equal(hooks.isAccountRecoverySettingsSurface(dynamicList), true);
assert.equal(
  hooks.mutationsAffectExtensionMount([{
    type: "childList",
    target: dynamicList,
    addedNodes: [],
    removedNodes: []
  }]),
  true,
  "the Settings popup bypasses the generic transient-overlay mount filter"
);

const unrelatedMenu = new FakeElement("div");
unrelatedMenu.setAttribute("role", "menu");
assert.equal(hooks.isAccountRecoverySettingsSurface(unrelatedMenu), false);
assert.equal(
  hooks.mutationsAffectExtensionMount([{
    type: "childList",
    target: unrelatedMenu,
    addedNodes: [],
    removedNodes: []
  }]),
  false,
  "unrelated transient menus remain ignored"
);

setLocation("https://www.roblox.com/home");
assert.equal(
  hooks.openAccountRecoveryFromLauncher(recoveryAnchor),
  true,
  "a launcher already on Home opens the in-page window"
);
assert.deepEqual(hooks.getAccountRecoveryModalStateForTests(), {
  hasComponent: true,
  hostConnected: true,
  frameUrl:
    "chrome-extension://recovery-fixture/recovery-snapshot.html?theme=dark&view=home-modal",
  open: true
});
assert.equal(
  body.children.some((node) => node.id === constants.modalHostId),
  true,
  "the Home modal host is attached to the Roblox document"
);
hooks.closeAccountRecoveryModal(false);
assert.equal(hooks.getAccountRecoveryModalStateForTests().hasComponent, false);

setLocation(
  "https://www.roblox.com/de/home?rotool=recovery-snapshot#activity"
);
const queuedBeforeDeepLink = microtaskQueue.length;
assert.equal(
  hooks.syncAccountRecoveryModalRouteState(),
  true,
  "the one-time Home deep link is consumed"
);
assert.deepEqual(historyCalls.at(-1), {
  state: null,
  url: "/de/home#activity"
});
assert.equal(location.search, "", "the private launch marker is removed from the URL");
assert.equal(microtaskQueue.length, queuedBeforeDeepLink + 1);
microtaskQueue.shift()();
assert.equal(
  hooks.getAccountRecoveryModalStateForTests().open,
  true,
  "the consumed deep link opens the Home modal"
);
hooks.closeAccountRecoveryModal(false);
assert.equal(
  hooks.syncAccountRecoveryModalRouteState(),
  false,
  "refreshing the cleaned Home URL does not reopen the modal"
);

hooks.setFeatureSettingsForTests({
  version: 1,
  flags: {
    recoverySnapshots: true,
    recoverySnapshotMenu: false
  }
});
assert.equal(hooks.mountAccountRecoverySettingsMenuItem(), 0);
assert.equal(primary.querySelectorAll(ownedSelector).length, 0);
assert.equal(replacementMenu.querySelectorAll(ownedSelector).length, 0);
assert.equal(dynamicList.querySelectorAll(ownedSelector).length, 0);
assert.deepEqual(menuLabels(primary), [
  "BTR Settings",
  "RoPro Settings",
  "External Settings",
  "Settings",
  "Quick Sign In",
  "Switch Accounts",
  "Logout"
]);
assert.deepEqual(menuLabels(replacementMenu), [
  "BTR Settings",
  "Switch Accounts",
  "Logout"
]);
assert.deepEqual(menuLabels(dynamicList), ["Settings", "Logout"]);
assert.equal(primary.children[0], btr.item);
assert.equal(primary.children[1], ropro.item);
assert.equal(primary.children[3], nativeSettings.item);
assert.equal(primary.children[4], quickSignIn.item);
assert.equal(primary.children[5], accountSwitch.item);
assert.equal(primary.children[6], logout.item);
setLocation("https://www.roblox.com/home");
assert.equal(
  hooks.openAccountRecoveryFromLauncher(null),
  true,
  "hiding only the Roblox Settings-menu shortcut must not disable Recovery Snapshots"
);
hooks.closeAccountRecoveryModal(false);

hooks.setFeatureSettingsForTests({
  version: 1,
  flags: {
    recoverySnapshots: false,
    recoverySnapshotMenu: true,
    recoverySnapshotArchive: true,
    recoverySnapshotReminder: true
  }
});
assert.equal(hooks.mountAccountRecoverySettingsMenuItem(), 0);
assert.equal(
  hooks.openAccountRecoveryFromLauncher(null),
  true,
  "the Recovery Snapshots master switch must leave deliberate manual launchers available"
);
assert.equal(
  hooks.getAccountRecoveryModalStateForTests().open,
  true,
  "a disabled Recovery master must still allow the current-snapshot window to open"
);
hooks.closeAccountRecoveryModal(false);
setLocation("https://www.roblox.com/home?rotool=recovery-snapshot");
const disabledDeepLinkMicrotasks = microtaskQueue.length;
assert.equal(
  hooks.syncAccountRecoveryModalRouteState(),
  true,
  "the disabled Recovery master must still consume its deliberate Home deep link"
);
assert.equal(location.search, "", "the private launch marker must still be cleaned");
assert.equal(
  microtaskQueue.length,
  disabledDeepLinkMicrotasks + 1,
  "the deliberate deep link must queue a Recovery window while the master is disabled"
);
microtaskQueue.shift()();
assert.equal(
  hooks.getAccountRecoveryModalStateForTests().open,
  true,
  "the queued deep link must open the manual snapshot window while the master is disabled"
);
hooks.closeAccountRecoveryModal(false);

const mountSource = contentSource.slice(
  contentSource.indexOf("  function mountExtensionFeatures("),
  contentSource.indexOf("  function mountSidebar(")
);
assert.match(
  mountSource,
  /mountFeatureSettingsButton\(\);[\s\S]*?mountAccountRecoverySettingsMenuItem\(\);\s*if \(!featureSettingsLoaded\)/,
  "the native dropdown launcher must remount before feature settings finish loading"
);
const recoveryModalSource = contentSource.slice(
  contentSource.indexOf("  function getAccountRecoveryFrameUrl("),
  contentSource.indexOf("  function makeAccountRecoverySettingsMenuItem(")
);
assert.match(
  recoveryModalSource,
  /const dialog = document\.createElement\("dialog"\);[\s\S]*?dialog\.id = ACCOUNT_RECOVERY_MODAL_HOST_ID;/,
  "Recovery Snapshot must use a native light-DOM dialog like RoTool's shared modals"
);
assert.match(
  recoveryModalSource,
  /"rsl-dialog rsl-account-recovery-dialog foundation-web-dialog-overlay " \+\s*"padding-medium foundation-web-portal-zindex bg-common-backdrop"/
);
assert.match(recoveryModalSource, /aria-labelledby", "rsl-account-recovery-title"/);
assert.match(recoveryModalSource, /aria-describedby",\s*"rsl-account-recovery-description"/);
assert.match(
  recoveryModalSource,
  /class="rsl-dialog__surface rsl-account-recovery-dialog__surface relative radius-large bg-surface-100 stroke-muted stroke-standard foundation-web-dialog-content shadow-transient-high" data-size="Large" data-state="open"/
);
assert.match(
  recoveryModalSource,
  /class="rsl-dialog__close-container absolute foundation-web-dialog-close-container"/
);
assert.match(
  recoveryModalSource,
  /class="rsl-icon-button foundation-web-close-affordance" data-rsl-account-recovery-close aria-label="Close Recovery Snapshot"/
);
assert.match(
  recoveryModalSource,
  /<span aria-hidden="true" class="rsl-dialog__close-icon"><\/span>/
);
assert.match(
  recoveryModalSource,
  /class="rsl-dialog__body rsl-account-recovery__body">[\s\S]*?class="rsl-dialog__header rsl-account-recovery__header">/
);
assert.match(
  recoveryModalSource,
  /<h2 id="rsl-account-recovery-title" class="content-emphasis text-title-large" tabindex="-1">Recovery Snapshot<\/h2>/
);
assert.match(
  recoveryModalSource,
  /accountRecoveryModalComponent\.title\?\.focus\?\.\(\{ preventScroll: true \}\)/,
  "Recovery focuses its heading instead of painting the Close button's keyboard ring on open"
);
assert.match(
  recoveryModalSource,
  /<p id="rsl-account-recovery-description" class="content-default text-body-medium">/
);
assert.match(recoveryModalSource, /document\.createElement\("iframe"\)/);
assert.match(recoveryModalSource, /frame\.className = "rsl-account-recovery__iframe"/);
assert.match(recoveryModalSource, /chrome\.runtime\.getURL\(ACCOUNT_RECOVERY_PAGE_PATH\)/);
assert.match(recoveryModalSource, /url\.searchParams\.set\("view", ACCOUNT_RECOVERY_PAGE_VIEW\)/);
assert.match(recoveryModalSource, /frame\.referrerPolicy = "no-referrer"/);
assert.match(
  recoveryModalSource,
  /event\.source !== frame\.contentWindow[\s\S]*?event\.data\?\.type !== ACCOUNT_RECOVERY_PREVIEW_STATE_MESSAGE_TYPE[\s\S]*?typeof event\.data\.hasSnapshot !== "boolean"/
);
assert.match(
  recoveryModalSource,
  /event\.data\.hasSnapshot \? "document" : "setup"/
);
assert.doesNotMatch(
  recoveryModalSource,
  /attachShadow|getAccountRecoveryModalStyle|style\.textContent/,
  "the outer modal must stay in shared light-DOM CSS instead of private custom chrome"
);
assert.doesNotMatch(
  recoveryModalSource,
  /ACCOUNT_RECOVERY_COLLECT_MESSAGE_TYPE|response\.snapshot|currentSnapshot|documentSnapshot/i,
  "snapshot records must never cross into the Roblox content launcher"
);

const serverHistoryModalSource = contentSource.slice(
  contentSource.indexOf("  function createServerHistoryDialog()"),
  contentSource.indexOf("  function openServerHistoryDialog(")
);
for (const sharedPrimitive of [
  "rsl-dialog",
  "foundation-web-dialog-overlay",
  "padding-medium",
  "foundation-web-portal-zindex",
  "bg-common-backdrop",
  "relative radius-large bg-surface-100 stroke-muted stroke-standard foundation-web-dialog-content shadow-transient-high",
  'data-size="Large"',
  "rsl-dialog__close-container absolute foundation-web-dialog-close-container",
  "rsl-icon-button foundation-web-close-affordance",
  "rsl-dialog__body",
  "rsl-dialog__header",
  "content-emphasis text-title-large"
]) {
  assert.ok(
    recoveryModalSource.includes(sharedPrimitive),
    `Recovery Snapshot is missing shared dialog primitive: ${sharedPrimitive}`
  );
  assert.ok(
    serverHistoryModalSource.includes(sharedPrimitive),
    `Server History parity fixture is missing shared dialog primitive: ${sharedPrimitive}`
  );
}

const recoverySurfaceCss = cssDeclarations(
  stylesSource,
  '.rsl-dialog.rsl-account-recovery-dialog .rsl-account-recovery-dialog__surface.foundation-web-dialog-content[data-size="Large"]'
);
const serverHistorySurfaceCss = cssDeclarations(
  stylesSource,
  ".rsl-server-history-dialog .rsl-server-history__surface"
);
assert.equal(recoverySurfaceCss.width, "min(920px, calc(100vw - 24px)) !important");
assert.equal(recoverySurfaceCss["max-width"], "none !important");
assert.equal(recoverySurfaceCss["inline-size"], "min(920px, calc(100vw - 24px)) !important");
assert.equal(recoverySurfaceCss["max-inline-size"], "none !important");
assert.equal(recoverySurfaceCss.height, "min(820px, calc(100dvh - 24px)) !important");
assert.equal(recoverySurfaceCss["max-height"], "min(820px, calc(100dvh - 24px)) !important");
assert.equal(recoverySurfaceCss["border-radius"], undefined);
assert.equal(
  cssDeclarations(stylesSource, ".rsl-dialog__surface")["border-radius"],
  "var(--radius-medium, 8px)",
  "Recovery inherits the same 8px shell radius as every shared RoTool dialog"
);
assert.equal(recoverySurfaceCss["grid-template-rows"], "minmax(0, 1fr)");
const recoveryDocumentSurfaceCss = cssDeclarations(
  stylesSource,
  '.rsl-dialog.rsl-account-recovery-dialog[data-rsl-recovery-view="document"] .rsl-account-recovery-dialog__surface.foundation-web-dialog-content[data-size="Large"]'
);
assert.equal(recoveryDocumentSurfaceCss.width, "min(1040px, calc(100vw - 24px)) !important");
assert.equal(recoveryDocumentSurfaceCss["inline-size"], "min(1040px, calc(100vw - 24px)) !important");
assert.equal(recoveryDocumentSurfaceCss.height, "min(820px, calc(100dvh - 24px)) !important");
assert.equal(recoveryDocumentSurfaceCss["max-height"], "min(820px, calc(100dvh - 24px)) !important");
assert.equal(
  cssDeclarations(stylesSource, ".rsl-account-recovery__body").padding,
  "0",
  "the embedded footer divider must span the Recovery surface"
);
assert.equal(
  cssDeclarations(stylesSource, ".rsl-account-recovery__header").padding,
  "24px 72px 16px 24px",
  "Recovery keeps the shared 24px desktop header inset"
);
assert.match(
  stylesSource,
  /\.rsl-account-recovery__iframe\[hidden\],\s*\.rsl-account-recovery__loading\[hidden\]\s*\{\s*display:\s*none !important;/s,
  "the iframe and loading layer must honor their hidden state despite component display rules"
);
assert.deepEqual(
  cssMediaDeclarations(stylesSource, "max-width: 520px", ".rsl-account-recovery-dialog"),
  cssMediaDeclarations(stylesSource, "max-width: 520px", ".rsl-server-history-dialog")
);
const mobileRecoverySurfaceCss = cssMediaDeclarations(
  stylesSource,
  "max-width: 520px",
  '.rsl-dialog.rsl-account-recovery-dialog .rsl-account-recovery-dialog__surface.foundation-web-dialog-content[data-size="Large"]'
);
assert.equal(mobileRecoverySurfaceCss.width, "100% !important");
assert.equal(mobileRecoverySurfaceCss["inline-size"], "100% !important");
assert.equal(mobileRecoverySurfaceCss.height, "calc(100dvh - 16px) !important");
assert.equal(mobileRecoverySurfaceCss["max-height"], "calc(100dvh - 16px) !important");
const mobileRecoveryDocumentSurfaceCss = cssMediaDeclarations(
  stylesSource,
  "max-width: 520px",
  '.rsl-dialog.rsl-account-recovery-dialog[data-rsl-recovery-view="document"] .rsl-account-recovery-dialog__surface.foundation-web-dialog-content[data-size="Large"]'
);
assert.equal(mobileRecoveryDocumentSurfaceCss.height, "calc(100dvh - 16px) !important");
assert.equal(mobileRecoveryDocumentSurfaceCss["max-height"], "calc(100dvh - 16px) !important");
assert.equal(
  cssMediaDeclarations(
    stylesSource,
    "max-width: 520px",
    ".rsl-account-recovery__header"
  ).padding,
  "18px 58px 14px 18px"
);

const dialogSource = contentSource.slice(
  contentSource.indexOf("  function createFeatureSettingsDialog()"),
  contentSource.indexOf("  function openFeatureSettingsDialog(")
);
const openSettingsDialogSource = contentSource.slice(
  contentSource.indexOf("  function openFeatureSettingsDialog("),
  contentSource.indexOf("  function handleShowFeatureSettingsMessage(")
);
assert.match(
  openSettingsDialogSource,
  /const wasOpen = dialog\.open;[\s\S]*?if \(!wasOpen\) \{[\s\S]*?dialog\.showModal\(\);[\s\S]*?focus\(\{ preventScroll: true \}\)/,
  "opening Settings must focus once without moving its scroll position"
);
assert.doesNotMatch(
  openSettingsDialogSource,
  /\?\.focus\(\);/,
  "reopening an existing Settings dialog must not steal focus or scroll"
);
const reconcileSource = contentSource.slice(
  contentSource.indexOf("  function reconcileFeatureSettings("),
  contentSource.indexOf("  function queueMount(")
);
const recoveryOnlyReconcileSource = reconcileSource.slice(
  reconcileSource.indexOf("const recoverySettingsKeys"),
  reconcileSource.indexOf("previousSettings.sidebarShortcuts")
);
assert.match(
  recoveryOnlyReconcileSource,
  /"recoverySnapshots"[\s\S]*?"recoverySnapshotMenu"[\s\S]*?"recoverySnapshotArchive"[\s\S]*?"recoverySnapshotReminder"[\s\S]*?mountAccountRecoverySettingsMenuItem\(\);[\s\S]*?return;/,
  "Recovery-only switches must reconcile the master-gated native Recovery entry without remounting the page"
);
assert.doesNotMatch(
  recoveryOnlyReconcileSource,
  /nextSettings\.recoverySnapshots === false[\s\S]*?closeAccountRecoveryModal\(false\)/,
  "turning the Recovery master off must not close an already-open manual snapshot window"
);
const saveFeatureSettingsSource = contentSource.slice(
  contentSource.indexOf("async function saveFeatureSettings"),
  contentSource.indexOf("function createFeatureSettingsDialog")
);
assert.match(
  saveFeatureSettingsSource,
  /previousRecoverySnapshots[\s\S]*?normalizedNext\.recoverySnapshots[\s\S]*?featureSettingsRecoveryReminderBatchChanged = true[\s\S]*?recomputeAccountRecoveryReminder\(\)/,
  "a Recovery master transition must retry the reminder after its setting is persisted"
);
assert.doesNotMatch(
  recoveryOnlyReconcileSource,
  /mountExtensionFeatures|cleanupSidebarFeature|cleanupQuickSettingsHome/,
  "Recovery-only switches must not remount the Roblox page behind Settings"
);
const settingsActionSource = dialogSource.slice(
  dialogSource.indexOf(
    "        for (const control of advancedControls)"
  ),
  dialogSource.indexOf("        let currentSection =")
);
assert.match(settingsActionSource, /data-rsl-feature-advanced-action/);
assert.match(settingsActionSource, /data-rsl-account-recovery-settings-action/);
assert.match(settingsActionSource, /data-rsl-account-recovery-archive-settings-action/);
assert.match(
  settingsActionSource,
  /event\.isTrusted !== true[\s\S]*?control\.availableWhenDisabled !== true[\s\S]*?!isFeatureEnabled\(definition\.key\)[\s\S]*?const recoveryOpener =[\s\S]*?dialog\.close\(\)[\s\S]*?sendAccountRecoveryOpenRequest\(recoveryOpener\)/
);
assert.doesNotMatch(
  dialogSource,
  /const toolsList =|data-rsl-account-recovery-settings-item/,
  "Recovery must be one toggle row, not a second top-level Open row"
);
assert.match(
  contentSource,
  /key: "recoverySnapshots"[\s\S]*?label: "Recovery Snapshots"[\s\S]*?type: "feature"[\s\S]*?key: "recoverySnapshotMenu"[\s\S]*?type: "feature"[\s\S]*?key: "recoverySnapshotArchive"[\s\S]*?type: "archiveSelect"[\s\S]*?key: "frequency"[\s\S]*?key: "retention"[\s\S]*?label: "Information to capture automatically"[\s\S]*?type: "archiveSection"[\s\S]*?key: "openRecoverySnapshot"[\s\S]*?key: "openRecoverySnapshotArchive"[\s\S]*?label: "View saved snapshots"[\s\S]*?actionLabel: "Open"/
);
const recoveryDefinitionSource = contentSource.slice(
  contentSource.indexOf('key: "recoverySnapshots"'),
  contentSource.indexOf('key: "gameEvents"')
);
assert.doesNotMatch(
  recoveryDefinitionSource,
  /independentOfParent:\s*true/,
  "the master switch must gate Recovery feature children"
);
assert.equal(
  (recoveryDefinitionSource.match(/availableWhenDisabled:\s*true/g) || []).length,
  2,
  "only the two deliberate manual Recovery launch actions stay available when the master is off"
);
assert.match(settingsActionSource, /control\.type === "archiveSelect"/);
assert.match(settingsActionSource, /control\.type === "archiveSection"/);
assert.match(settingsActionSource, /data-rsl-account-recovery-archive-preference/);
assert.match(contentSource, /data-rsl-requires-automatic-snapshots/);
assert.match(
  stylesSource,
  /data-rsl-feature-children="recoverySnapshots"[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/
);
assert.match(
  stylesSource,
  /\.rsl-feature-settings__row\s*\{[\s\S]*?position:\s*relative;/,
  "Settings switch inputs must be positioned relative to their own rows"
);
assert.match(
  stylesSource,
  /\.rsl-feature-settings__action\s*\{[\s\S]*?min-height:\s*36px/
);
assert.match(
  stylesSource,
  /\.rsl-feature-settings__action:disabled\s*\{[^}]*cursor:\s*default;/,
  "a disabled Settings action must use a normal cursor instead of a loading cursor"
);
assert.doesNotMatch(
  stylesSource,
  /\.rsl-feature-settings__action:disabled\s*\{[^}]*cursor:\s*wait;/,
  "disabled Settings actions must not imply that they are loading"
);
assert.match(
  stylesSource,
  /@media \(max-width: 520px\)[\s\S]*?\.rsl-feature-settings__action\s*\{\s*min-height:\s*44px/s
);

console.log("PASS Recovery Snapshot automation gate, manual launchers, and menu preference isolation");
