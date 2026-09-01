"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "background.js"), "utf8");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "manifest.json"), "utf8")
);

const actionListeners = [];
const contextListeners = [];
const sent = [];
const createdTabs = [];
const updatedTabs = [];
const updatedWindows = [];
let queryTabs = [];
let normalWindows = [{ id: 7, type: "normal", incognito: false, focused: true }];
let messageResponse = { ok: true, type: "rsl:show-feature-settings" };
let nextTabId = 70;
let storedFeatureSettings = {
  version: 1,
  flags: { recoverySnapshots: true }
};

function eventTarget(list = []) {
  return {
    addListener(listener) { list.push(listener); }
  };
}

const chrome = {
  runtime: {
    id: "settings-launcher-fixture",
    lastError: null,
    getURL(relativePath = "") {
      return `chrome-extension://settings-launcher-fixture/${relativePath}`;
    },
    onInstalled: eventTarget(),
    onStartup: eventTarget(),
    onMessage: eventTarget()
  },
  extension: { inIncognitoContext: false },
  storage: {
    local: {
      get(defaults, callback) {
        callback?.({
          ...structuredClone(defaults),
          rslFeatureSettingsV1: structuredClone(storedFeatureSettings)
        });
      }
    }
  },
  action: {
    onClicked: eventTarget(actionListeners)
  },
  contextMenus: {
    create(_item, callback) { callback?.(); },
    removeAll(callback) { callback?.(); },
    onClicked: eventTarget(contextListeners)
  },
  tabs: {
    async query(details) {
      assert.deepEqual(structuredClone(details), {
        url: "https://www.roblox.com/*"
      });
      return structuredClone(queryTabs);
    },
    async create(details) {
      createdTabs.push(structuredClone(details));
      return {
        id: nextTabId++,
        windowId: details.windowId,
        active: details.active === true,
        incognito: false,
        status: "complete",
        url: details.url
      };
    },
    async update(tabId, details) {
      updatedTabs.push({ tabId, details: structuredClone(details) });
      const existing = queryTabs.find((tab) => tab.id === tabId) || {};
      return { ...structuredClone(existing), id: tabId, ...structuredClone(details) };
    },
    sendMessage(tabId, message, options, callback) {
      sent.push({
        tabId,
        message: structuredClone(message),
        options: structuredClone(options)
      });
      callback?.(structuredClone(messageResponse));
      return Promise.resolve(structuredClone(messageResponse));
    }
  },
  windows: {
    async getAll(details) {
      assert.deepEqual(structuredClone(details), {
        windowTypes: ["normal"]
      });
      return structuredClone(normalWindows);
    },
    async update(windowId, details) {
      updatedWindows.push({ windowId, details: structuredClone(details) });
      return { id: windowId, ...structuredClone(details) };
    }
  }
};

const sandbox = {
  URL,
  Response,
  Headers,
  AbortController,
  TextDecoder,
  console,
  chrome,
  fetch: async () => { throw new Error("Unexpected network request"); },
  structuredClone,
  setTimeout,
  clearTimeout,
  globalThis: null,
  __rslBackgroundTestHooks: {}
};
sandbox.globalThis = sandbox;
vm.runInNewContext(source, sandbox, { filename: "background.js" });

const hooks = sandbox.__rslBackgroundTestHooks;
const constants = hooks.featureSettingsLauncherConstants;

function reset() {
  sent.length = 0;
  createdTabs.length = 0;
  updatedTabs.length = 0;
  updatedWindows.length = 0;
  queryTabs = [];
  normalWindows = [{ id: 7, type: "normal", incognito: false, focused: true }];
  messageResponse = { ok: true, type: constants.showMessageType };
  nextTabId = 70;
  storedFeatureSettings = {
    version: 1,
    flags: { recoverySnapshots: true }
  };
}

async function main() {
  assert.equal(manifest.action.default_title, "RoTool");
  assert.equal(manifest.action.default_popup, "popup.html");
  assert.equal(Object.hasOwn(manifest, "options_ui"), false);
  assert.equal(constants.showMessageType, "rsl:show-feature-settings");
  assert.equal(constants.popupPagePath, "popup.html");
  assert.equal(
    constants.popupSettingsMessageType,
    "rsl:toolbar-popup:open-settings"
  );
  assert.equal(
    constants.popupRecoverySnapshotsMessageType,
    "rsl:toolbar-popup:open-recovery-snapshots"
  );
  assert.equal(constants.recoverySnapshotsMasterFeatureKey, "recoverySnapshots");
  assert.equal(constants.actionMenuId, "rsl-context:feature-settings:open");
  assert.equal(
    constants.recoverySnapshotsActionMenuId,
    "rsl-context:account-recovery-archive:open"
  );
  assert.equal(actionListeners.length, 1, "toolbar click listener was not registered");
  assert.equal(contextListeners.length, 1, "context-menu click listener was not registered");

  reset();
  const clickedRobloxTab = {
    id: 11,
    windowId: 2,
    active: true,
    incognito: false,
    url: "https://www.roblox.com/games/123/example"
  };
  assert.equal(
    await hooks.handleFeatureSettingsActionClick(clickedRobloxTab),
    true
  );
  assert.deepEqual(sent, [{
    tabId: 11,
    message: { type: constants.showMessageType },
    options: { frameId: 0 }
  }]);
  assert.equal(createdTabs.length, 0, "a second tab replaced the clicked Roblox tab");

  reset();
  queryTabs = [{
    id: 12,
    windowId: 2,
    active: false,
    incognito: false,
    lastAccessed: 300,
    url: "https://www.roblox.com/home"
  }];
  const popupResponses = [];
  assert.equal(hooks.handleToolbarPopupSettingsMessage(
    { type: constants.popupSettingsMessageType },
    {
      id: chrome.runtime.id,
      url: chrome.runtime.getURL(constants.popupPagePath),
      origin: `chrome-extension://${chrome.runtime.id}`
    },
    (response) => popupResponses.push(structuredClone(response))
  ), true, "the exact toolbar popup request was not handled");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(popupResponses, [{
    ok: true,
    type: constants.popupSettingsMessageType
  }]);
  assert.equal(sent[0]?.tabId, 12, "the toolbar popup did not reuse a Roblox tab");

  for (const [label, message, sender] of [
    ["extra message field", { type: constants.popupSettingsMessageType, extra: true }, {
      id: chrome.runtime.id,
      url: chrome.runtime.getURL(constants.popupPagePath)
    }],
    ["wrong extension page", { type: constants.popupSettingsMessageType }, {
      id: chrome.runtime.id,
      url: chrome.runtime.getURL("recovery-archive.html")
    }],
    ["tab sender", { type: constants.popupSettingsMessageType }, {
      id: chrome.runtime.id,
      url: chrome.runtime.getURL(constants.popupPagePath),
      tab: { id: 99 }
    }]
  ]) {
    reset();
    const rejectedResponses = [];
    assert.equal(
      hooks.handleToolbarPopupSettingsMessage(
        message,
        sender,
        (response) => rejectedResponses.push(response)
      ),
      false,
      `${label} reached the Settings launcher`
    );
    assert.equal(sent.length, 0, `${label} sent a Roblox-tab message`);
    assert.equal(createdTabs.length, 0, `${label} created a Roblox tab`);
    assert.equal(rejectedResponses.length, 0, `${label} received an acknowledgement`);
  }

  reset();
  const archivePopupResponses = [];
  assert.equal(hooks.handleToolbarPopupRecoveryMessage(
    { type: constants.popupRecoverySnapshotsMessageType },
    {
      id: chrome.runtime.id,
      url: chrome.runtime.getURL(constants.popupPagePath),
      origin: `chrome-extension://${chrome.runtime.id}`
    },
    (response) => archivePopupResponses.push(structuredClone(response))
  ), true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(archivePopupResponses, [{
    ok: true,
    type: constants.popupRecoverySnapshotsMessageType
  }]);
  assert.deepEqual(createdTabs, [{
    url: "chrome-extension://settings-launcher-fixture/recovery-archive.html",
    active: true
  }]);

  reset();
  storedFeatureSettings = {
    version: 1,
    flags: { recoverySnapshots: false }
  };
  const disabledArchiveResponses = [];
  assert.equal(hooks.handleToolbarPopupRecoveryMessage(
    { type: constants.popupRecoverySnapshotsMessageType },
    {
      id: chrome.runtime.id,
      url: chrome.runtime.getURL(constants.popupPagePath)
    },
    (response) => disabledArchiveResponses.push(structuredClone(response))
  ), true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(disabledArchiveResponses, [{
    ok: true,
    type: constants.popupRecoverySnapshotsMessageType
  }]);
  assert.deepEqual(createdTabs, [{
    url: "chrome-extension://settings-launcher-fixture/recovery-archive.html",
    active: true
  }], "the Recovery master blocked deliberate toolbar archive access");

  for (const [label, message, sender] of [
    ["extra Recovery field", {
      type: constants.popupRecoverySnapshotsMessageType,
      extra: true
    }, {
      id: chrome.runtime.id,
      url: chrome.runtime.getURL(constants.popupPagePath)
    }],
    ["wrong Recovery sender", {
      type: constants.popupRecoverySnapshotsMessageType
    }, {
      id: chrome.runtime.id,
      url: chrome.runtime.getURL("recovery-archive.html")
    }]
  ]) {
    reset();
    const responses = [];
    assert.equal(
      hooks.handleToolbarPopupRecoveryMessage(
        message,
        sender,
        (response) => responses.push(response)
      ),
      false,
      `${label} reached the Recovery archive launcher`
    );
    assert.equal(responses.length, 0);
    assert.equal(createdTabs.length, 0);
  }

  reset();
  queryTabs = [{
    id: 21,
    windowId: 3,
    active: false,
    incognito: false,
    lastAccessed: 200,
    url: "https://www.roblox.com/home"
  }];
  assert.equal(await hooks.handleFeatureSettingsActionClick({
    id: 20,
    windowId: 3,
    active: true,
    incognito: false,
    url: "https://example.com/"
  }), true);
  assert.equal(sent[0]?.tabId, 21, "an existing safe Roblox tab was not reused");
  assert.deepEqual(updatedTabs[0], { tabId: 21, details: { active: true } });
  assert.equal(createdTabs.length, 0);

  reset();
  assert.equal(await hooks.handleFeatureSettingsActionClick({
    id: 30,
    windowId: 4,
    active: true,
    incognito: false,
    url: "https://example.com/"
  }), true);
  assert.deepEqual(createdTabs, [{
    windowId: 7,
    url: "https://www.roblox.com/home",
    active: true
  }]);
  assert.equal(sent[0]?.tabId, 70);
  assert.equal(sent[0]?.message?.type, constants.showMessageType);

  reset();
  queryTabs = [{
    id: 41,
    windowId: 8,
    active: false,
    incognito: false,
    url: "https://www.roblox.com/home"
  }];
  assert.equal(await hooks.handleFeatureSettingsActionClick({
    id: 40,
    windowId: 8,
    active: true,
    incognito: true,
    url: "https://www.roblox.com/home"
  }), false);
  assert.equal(sent.length, 0, "an incognito click crossed into normal browsing");
  assert.equal(createdTabs.length, 0);
  assert.equal(updatedTabs.length, 0);

  reset();
  hooks.setRecoverySnapshotsEnabledForTests(true);
  await hooks.handleContextMenuClick(
    { menuItemId: constants.recoverySnapshotsActionMenuId },
    {
      id: 50,
      windowId: 9,
      active: true,
      incognito: false,
      url: "https://example.com/"
    }
  );
  assert.deepEqual(createdTabs, [{
    url: "chrome-extension://settings-launcher-fixture/recovery-archive.html",
    active: true
  }]);
  assert.equal(sent.length, 0, "the archive launcher depended on a Roblox tab");

  reset();
  hooks.setRecoverySnapshotsEnabledForTests(false);
  await hooks.handleContextMenuClick(
    { menuItemId: constants.recoverySnapshotsActionMenuId },
    {
      id: 50,
      windowId: 9,
      active: true,
      incognito: false,
      url: "https://example.com/"
    }
  );
  assert.deepEqual(createdTabs, [{
    url: "chrome-extension://settings-launcher-fixture/recovery-archive.html",
    active: true
  }], "the Recovery master blocked deliberate action-menu archive access");
  hooks.setRecoverySnapshotsEnabledForTests(true);

  reset();
  await hooks.handleContextMenuClick(
    { menuItemId: constants.recoverySnapshotsActionMenuId },
    {
      id: 51,
      windowId: 10,
      active: true,
      incognito: true,
      url: "https://example.com/"
    }
  );
  assert.equal(createdTabs.length, 0, "incognito opened the normal-profile archive");

  reset();
  messageResponse = { ok: true };
  assert.equal(
    await hooks.sendFeatureSettingsShowMessageToTab(11, 100),
    false,
    "an acknowledgement without the typed response was accepted"
  );
  messageResponse = {
    ok: true,
    type: constants.showMessageType,
    unexpected: true
  };
  assert.equal(
    await hooks.sendFeatureSettingsShowMessageToTab(11, 100),
    false,
    "an acknowledgement with extra keys was accepted"
  );

  console.log("PASS toolbar and action-menu RoTool Settings launcher");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
