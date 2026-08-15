"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

const projectRoot = path.resolve(__dirname, "..");
const backgroundSource = fs.readFileSync(path.join(projectRoot, "background.js"), "utf8");
const featureSettings = {
  rslFeatureSettingsV1: {
    version: 1,
    flags: { joinScheduler: true, gameEvents: true, serverHistory: false }
  }
};

function plain(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function eventTarget(capture) {
  return {
    addListener(listener) { capture.push(listener); },
    removeListener(listener) {
      const index = capture.indexOf(listener);
      if (index >= 0) capture.splice(index, 1);
    }
  };
}

function makeStorageArea(data) {
  return {
    get(keys, callback) {
      let result;
      if (typeof keys === "string") result = { [keys]: data[keys] };
      else if (Array.isArray(keys)) {
        result = Object.fromEntries(keys.map((key) => [key, data[key]]));
      } else {
        result = { ...(keys || {}) };
        for (const key of Object.keys(keys || {})) {
          if (Object.hasOwn(data, key)) result[key] = data[key];
        }
      }
      callback?.(plain(result));
      return Promise.resolve(plain(result));
    },
    set(values, callback) {
      Object.assign(data, plain(values));
      callback?.();
      return Promise.resolve();
    },
    remove(keys, callback) {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key];
      callback?.();
      return Promise.resolve();
    }
  };
}

const runtimeMessageListeners = [];
const alarmListeners = [];
const notificationClickListeners = [];
const notificationButtonListeners = [];
const permissionRemovedListeners = [];
const storageChangedListeners = [];
const windowRemovedListeners = [];
const tabUpdatedListeners = [];
const tabRemovedListeners = [];
const alarmCreates = [];
const alarmClears = [];
const notificationCreates = [];
const notificationClears = [];
const scriptInjections = [];
const permissionRequests = [];
const tabCreates = [];
const tabUpdates = [];
const tabMessages = [];
const windowUpdates = [];
let notificationPermission = true;
let scriptingResult = "started";
let availableTabs = [
  { id: 41, windowId: 1, incognito: false, active: true, status: "complete", url: "https://www.roblox.com/home" }
];
let tabsQueryHandler = null;
let tabsGetHandler = null;
let tabMessageResponse = { ok: true, type: "rsl:show-join-scheduler" };
let fetchHandler = async () => { throw new Error("Unexpected network request"); };

const chrome = {
  runtime: {
    id: "scheduler-fixture",
    lastError: null,
    getURL(relativePath = "") {
      return `chrome-extension://scheduler-fixture/${relativePath}`;
    },
    onInstalled: eventTarget([]),
    onStartup: eventTarget([]),
    onMessage: eventTarget(runtimeMessageListeners)
  },
  storage: {
    local: makeStorageArea(featureSettings),
    session: makeStorageArea({}),
    onChanged: eventTarget(storageChangedListeners)
  },
  alarms: {
    create(name, options) { alarmCreates.push({ name, options: plain(options) }); },
    get(_name, callback) { callback(null); },
    clear(name, callback) {
      alarmClears.push(name);
      callback?.(true);
      return Promise.resolve(true);
    },
    onAlarm: eventTarget(alarmListeners)
  },
  permissions: {
    contains(_permissions, callback) {
      callback?.(notificationPermission);
      return Promise.resolve(notificationPermission);
    },
    request(permissions, callback) {
      permissionRequests.push(plain(permissions));
      callback?.(notificationPermission);
      return Promise.resolve(notificationPermission);
    },
    onRemoved: eventTarget(permissionRemovedListeners)
  },
  notifications: {
    create(id, options, callback) {
      notificationCreates.push({ id, options: plain(options) });
      callback?.(id);
      return Promise.resolve(id);
    },
    clear(id, callback) {
      notificationClears.push(id);
      callback?.(true);
      return Promise.resolve(true);
    },
    onClicked: eventTarget(notificationClickListeners),
    onButtonClicked: eventTarget(notificationButtonListeners)
  },
  windows: {
    async get() { throw new Error("No existing Scheduler window"); },
    async create() { return { id: 31 }; },
    async update(id, details) {
      windowUpdates.push({ id, details: plain(details) });
      return { id, ...details };
    },
    onRemoved: eventTarget(windowRemovedListeners)
  },
  tabs: {
    async query(details) {
      return tabsQueryHandler
        ? tabsQueryHandler(plain(details))
        : plain(availableTabs);
    },
    async create(details) {
      tabCreates.push(plain(details));
      return { id: 42, windowId: 1, incognito: false, status: "complete", ...details };
    },
    async get(tabId) {
      if (tabsGetHandler) return tabsGetHandler(tabId);
      const existing = availableTabs.find((tab) => tab.id === tabId);
      if (!existing) throw new Error("Unknown tab");
      return plain(existing);
    },
    async update(id, details) {
      tabUpdates.push({ id, details: plain(details) });
      return { id, ...details };
    },
    sendMessage(tabId, message, optionsOrCallback, maybeCallback) {
      const options = typeof optionsOrCallback === "function"
        ? undefined
        : optionsOrCallback;
      tabMessages.push({ tabId, message: plain(message), options: plain(options) });
      const response = plain(tabMessageResponse);
      const callback = typeof optionsOrCallback === "function"
        ? optionsOrCallback
        : maybeCallback;
      callback?.(response);
      return Promise.resolve(response);
    },
    onUpdated: eventTarget(tabUpdatedListeners),
    onRemoved: eventTarget(tabRemovedListeners)
  },
  scripting: {
    async executeScript(details) {
      scriptInjections.push(plain({
        target: details.target,
        world: details.world,
        args: details.args
      }));
      return [{ frameId: 0, result: scriptingResult }];
    }
  },
  contextMenus: {
    create(_details, callback) { callback?.(); },
    removeAll(callback) { callback?.(); },
    onClicked: eventTarget([])
  }
};

const sandbox = {
  URL,
  URLSearchParams,
  Response,
  Headers,
  Request,
  AbortController,
  TextDecoder,
  TextEncoder,
  Intl,
  console,
  chrome,
  crypto: webcrypto,
  structuredClone,
  fetch: (...args) => fetchHandler(...args),
  setTimeout,
  clearTimeout,
  queueMicrotask,
  __rslBackgroundTestHooks: {},
  __rslJoinSchedulerTestHooks: {},
  globalThis: null
};
sandbox.globalThis = sandbox;
vm.runInContext(backgroundSource, vm.createContext(sandbox), {
  filename: "background.js"
});

const hooks = sandbox.__rslJoinSchedulerTestHooks;
const backgroundHooks = sandbox.__rslBackgroundTestHooks;
const constants = hooks.constants;
const BASE_NOW = Date.parse("2026-08-14T20:00:00.000Z");
const ACCOUNT_A = "101";
const ACCOUNT_B = "202";
const GAME = Object.freeze({
  universeId: "2001",
  placeId: "1001",
  gameName: "Fixture Game",
  title: "Fixture Event"
});
const LEGACY_CODE = "11111111-2222-3333-4444-555555555555";
const MODERN_CODE = "ModernFixtureCode_123456";

let now = BASE_NOW;
let viewerUserId = ACCOUNT_A;
let launchCalls = [];
let createdAlarmTimes = [];
let clearedAlarms = 0;
let createdNotifications = [];
let clearedNotifications = [];
let presence = { kind: "not-in-game" };
let eventValidation = { ok: true, event: null };
let modernResolution = { universeId: GAME.universeId, placeId: GAME.placeId };

function resetFixture() {
  hooks.reset();
  now = BASE_NOW;
  viewerUserId = ACCOUNT_A;
  launchCalls = [];
  createdAlarmTimes = [];
  clearedAlarms = 0;
  createdNotifications = [];
  clearedNotifications = [];
  presence = { kind: "not-in-game" };
  eventValidation = { ok: true, event: null };
  modernResolution = { universeId: GAME.universeId, placeId: GAME.placeId };
  notificationPermission = true;
  scriptingResult = "started";
  fetchHandler = async () => { throw new Error("Unexpected network request"); };
  alarmCreates.length = 0;
  alarmClears.length = 0;
  notificationCreates.length = 0;
  notificationClears.length = 0;
  scriptInjections.length = 0;
  permissionRequests.length = 0;
  tabCreates.length = 0;
  tabUpdates.length = 0;
  tabMessages.length = 0;
  windowUpdates.length = 0;
  availableTabs = [
    { id: 41, windowId: 1, incognito: false, active: true, status: "complete", url: "https://www.roblox.com/home" }
  ];
  tabsQueryHandler = null;
  tabsGetHandler = null;
  tabMessageResponse = { ok: true, type: "rsl:show-join-scheduler" };
  const memory = hooks.createMemoryStorage();
  hooks.setStorageOverride(memory);
  hooks.setRuntimeOverrides({
    now: () => now,
    getViewerUserId: async () => viewerUserId,
    fetchFreshViewerUserId: async () => viewerUserId,
    hasNotificationPermission: async () => notificationPermission,
    createAlarm: async (when) => { createdAlarmTimes.push(when); },
    clearAlarm: async () => { clearedAlarms += 1; return true; },
    createNotification: async (schedule, message) => {
      createdNotifications.push({ schedule: plain(schedule), message });
      return hooks.getNotificationId(schedule.id, schedule.revision);
    },
    clearNotification: async (scheduleId) => {
      clearedNotifications.push(scheduleId);
      return true;
    },
    getPresence: async () => plain(presence),
    launchDestination: async (destination) => {
      launchCalls.push(plain(destination));
      return "started";
    },
    revalidateEvent: async () => plain(eventValidation),
    resolveModernDestination: async () => plain(modernResolution)
  });
  return memory;
}

function trustedExtensionSender(url = chrome.runtime.getURL("other.html")) {
  return { id: chrome.runtime.id, url };
}

function trustedRobloxSender(overrides = {}) {
  return {
    id: chrome.runtime.id,
    frameId: 0,
    url: "https://www.roblox.com/home",
    tab: { id: 17, incognito: false, url: "https://www.roblox.com/home" },
    ...overrides
  };
}

function invokeScheduler(message, sender = trustedRobloxSender()) {
  return new Promise((resolve, reject) => {
    let synchronous = true;
    const handler = message.type === constants.messageTypes.requestNotificationPermission
      ? hooks.handlePermissionRequest
      : hooks.handleContentMessage;
    const keptOpen = handler(message, sender, (response) => {
      resolve({ response: plain(response), synchronous });
    });
    synchronous = false;
    if (!keptOpen && !resolve.called) {
      setTimeout(() => reject(new Error(`No Scheduler response for ${message.type}`)), 250);
    }
  });
}

function createSchedulePayload(overrides = {}) {
  return {
    requestId: 1,
    viewerUserId,
    ...GAME,
    startAt: now + 60_000,
    endAt: null,
    eventId: null,
    mode: "auto",
    allowSwitch: true,
    autoJoinConsent: true,
    destinationType: "public",
    ...overrides
  };
}

async function createSchedule(overrides = {}) {
  const response = await hooks.createSchedule(createSchedulePayload(overrides));
  assert.equal(response.ok, true);
  return plain(response.schedule);
}

async function saveModernDestination(overrides = {}) {
  const response = await hooks.saveDestination({
    requestId: 2,
    viewerUserId,
    ...GAME,
    url: `https://www.roblox.com/share?code=${MODERN_CODE}&type=Server`,
    confirmUnverified: false,
    ...overrides
  });
  assert.equal(response.ok, true);
  assert.equal(response.requiresConfirmation, false);
  return plain(response.destination);
}

const tests = [];
function test(name, run) { tests.push({ name, run }); }

test("constants, strict official Roblox URLs, and bounded normalized storage", () => {
  assert.equal(constants.featureKey, "joinScheduler");
  assert.equal(constants.showMessageType, "rsl:show-join-scheduler");
  assert.equal(
    constants.messageTypes.requestNotificationPermission,
    "rsl:join-scheduler:request-notification-permission"
  );
  assert.equal(constants.alarmName, "rsl-join-scheduler-coordinator-v1");
  assert.equal(constants.notificationLeadMs, 30_000);
  assert.equal(constants.lateGraceMs, 120_000);
  assert.equal(constants.collisionMs, 300_000);
  assert.equal(constants.maxAccounts, 8);
  assert.equal(constants.maxDestinations, 30);
  assert.equal(constants.maxSchedules, 50);

  assert.deepEqual(plain(hooks.parseDestinationUrl(
    `https://www.roblox.com/games/1001?privateServerLinkCode=${LEGACY_CODE}`
  )), {
    type: "private-legacy",
    placeId: "1001",
    secret: LEGACY_CODE,
    canonicalUrl: `https://www.roblox.com/games/1001?privateServerLinkCode=${LEGACY_CODE}`
  });
  assert.deepEqual(plain(hooks.parseDestinationUrl(
    `https://www.roblox.com/share?code=${MODERN_CODE}&type=Server`
  )), {
    type: "private-share",
    placeId: null,
    secret: MODERN_CODE,
    canonicalUrl: `https://www.roblox.com/share?code=${MODERN_CODE}&type=Server`
  });
  for (const url of [
    `http://www.roblox.com/share?code=${MODERN_CODE}&type=Server`,
    `https://roblox.com/share?code=${MODERN_CODE}&type=Server`,
    `https://www.roblox.com.evil.test/share?code=${MODERN_CODE}&type=Server`,
    `https://user:pass@www.roblox.com/share?code=${MODERN_CODE}&type=Server`,
    `https://www.roblox.com:444/share?code=${MODERN_CODE}&type=Server`,
    `https://www.roblox.com/share?code=${MODERN_CODE}&type=Server#fragment`,
    `https://www.roblox.com/share?code=${MODERN_CODE}&code=again&type=Server`,
    `https://www.roblox.com/share?code=${MODERN_CODE}&type=Server&extra=1`,
    ` https://www.roblox.com/share?code=${MODERN_CODE}&type=Server`
  ]) {
    assert.throws(() => hooks.parseDestinationUrl(url), /INVALID|DUPLICATE|UNKNOWN/);
  }
  const privateParserSource = backgroundSource.slice(
    backgroundSource.indexOf("function parseJoinSchedulerDestinationUrl"),
    backgroundSource.indexOf("function normalizeJoinSchedulerDestinationRecord")
  );
  assert.ok(
    privateParserSource.indexOf("rawUrl.length > JOIN_SCHEDULER_PRIVATE_URL_MAX_LENGTH") <
      privateParserSource.indexOf("new URL(rawUrl)"),
    "oversized private URLs are rejected before URL parsing or allocation"
  );
  assert.match(backgroundSource, /JOIN_SCHEDULER_PRIVATE_URL_MAX_LENGTH\s*=\s*2_048/);
  assert.equal(Object.hasOwn(hooks.normalizeSnapshot({}), "accounts"), false);
});

test("modern share resolution follows only bounded exact Roblox redirects", async () => {
  resetFixture();
  hooks.setRuntimeOverrides(null);
  const canonicalUrl =
    `https://www.roblox.com/share?code=${MODERN_CODE}&type=Server`;
  const parsed = { canonicalUrl, secret: MODERN_CODE, type: "private-share" };

  assert.equal(
    hooks.parseTrustedShareResolveUrl(
      "/share-links?code=NextFixture&type=Server",
      canonicalUrl
    )?.href,
    "https://www.roblox.com/share-links?code=NextFixture&type=Server"
  );
  for (const rejected of [
    "https://roblox.com/share?code=x&type=Server",
    "https://www.roblox.com.evil.test/share?code=x&type=Server",
    "http://www.roblox.com/share?code=x&type=Server",
    "https://www.roblox.com/games/1001",
    "https://user@www.roblox.com/share?code=x&type=Server"
  ]) {
    assert.equal(hooks.parseTrustedShareResolveUrl(rejected, canonicalUrl), null);
  }

  const offOriginFetches = [];
  fetchHandler = async (url, options) => {
    offOriginFetches.push({ url: String(url), options: plain(options) });
    return new Response("", {
      status: 302,
      headers: { location: "https://capture.example/steal" }
    });
  };
  await assert.rejects(
    () => hooks.resolveModernDestination(parsed),
    (error) => error?.code === "PRIVATE_LINK_UNVERIFIED"
  );
  assert.equal(offOriginFetches.length, 1,
    "an off-origin Location is rejected without issuing a second request");
  assert.equal(offOriginFetches[0].options.redirect, "manual");
  assert.equal(offOriginFetches[0].options.credentials, "omit");

  const sameOriginFetches = [];
  fetchHandler = async (url) => {
    sameOriginFetches.push(String(url));
    if (sameOriginFetches.length === 1) {
      return new Response("", {
        status: 302,
        headers: { location: "/share-links?code=NextFixture&type=Server" }
      });
    }
    return new Response("not found", { status: 404 });
  };
  await assert.rejects(
    () => hooks.resolveModernDestination(parsed),
    (error) => error?.code === "PRIVATE_LINK_UNVERIFIED"
  );
  assert.deepEqual(sameOriginFetches, [
    canonicalUrl,
    "https://www.roblox.com/share-links?code=NextFixture&type=Server"
  ], "a same-origin /share-links redirect is validated before it is followed");

  let hopFetches = 0;
  fetchHandler = async () => {
    hopFetches += 1;
    return new Response("", {
      status: 302,
      headers: { location: `/share?code=Hop${hopFetches}Fixture&type=Server` }
    });
  };
  await assert.rejects(
    () => hooks.resolveModernDestination(parsed),
    (error) => error?.code === "PRIVATE_LINK_UNVERIFIED"
  );
  assert.equal(hopFetches, 4,
    "three redirect hops are the maximum; a fourth Location is never followed");
});

test("service-worker lifecycle listeners wire Scheduler messages, alarms, and notifications", () => {
  assert.equal(runtimeMessageListeners.length, 1);
  assert.equal(alarmListeners.length, 1);
  assert.equal(notificationClickListeners.length, 1);
  assert.equal(notificationButtonListeners.length, 1);
  assert.equal(permissionRemovedListeners.length, 1);
  assert.match(backgroundSource, /alarm\?\.name === JOIN_SCHEDULER_ALARM_NAME/);
  assert.match(backgroundSource, /handleJoinSchedulerNotificationPermissionRequest\(message, sender, sendResponse\)/);
  assert.match(backgroundSource, /handleJoinSchedulerContentMessage\(message, sender, sendResponse\)/);
  assert.match(backgroundSource, /syncJoinSchedulerFeatureFromStorage\((?:true|"startup")?\)/);
  assert.match(backgroundSource, /applyJoinSchedulerFeatureValue\(/);
  assert.doesNotMatch(backgroundSource, /JOIN_SCHEDULER_WINDOW_PATH|joinSchedulerWindowOpenPromise|joinSchedulerPendingDrafts/);
  assert.doesNotMatch(backgroundSource, /type:\s*"popup"/);
});

test("Scheduler CRUD accepts only an exact trusted Roblox top-frame sender", async () => {
  resetFixture();
  const invalidSenders = [
    trustedExtensionSender(),
    { ...trustedRobloxSender(), id: "foreign" },
    trustedRobloxSender({ frameId: 1 }),
    trustedRobloxSender({
      tab: { id: 17, incognito: true, url: "https://www.roblox.com/home" }
    }),
    trustedRobloxSender({ tab: null }),
    trustedRobloxSender({
      url: "http://www.roblox.com/home",
      tab: { id: 17, url: "http://www.roblox.com/home" }
    }),
    trustedRobloxSender({
      url: "https://roblox.com/home",
      tab: { id: 17, url: "https://roblox.com/home" }
    }),
    trustedRobloxSender({
      url: "https://create.roblox.com/dashboard",
      tab: { id: 17, url: "https://create.roblox.com/dashboard" }
    }),
    trustedRobloxSender({
      url: "https://www.roblox.com/home",
      tab: { id: 17, url: "https://example.test/" }
    })
  ];
  for (const sender of invalidSenders) {
    let response = null;
    const keptOpen = hooks.handleContentMessage(
      { type: constants.messageTypes.getState, requestId: 7 },
      sender,
      (value) => { response = plain(value); }
    );
    assert.equal(keptOpen, false);
    assert.equal(response?.code, "INVALID");
  }

  const stateResult = await invokeScheduler({
    type: constants.messageTypes.getState,
    requestId: 8
  });
  assert.equal(stateResult.response.ok, true);
  assert.equal(stateResult.response.viewerUserId, ACCOUNT_A);
});

test("private secrets stay in background storage and state is account isolated", async () => {
  const memory = resetFixture();
  const destination = await saveModernDestination();
  assert.deepEqual(Object.keys(destination).sort(), [
    "createdAt", "gameName", "id", "label", "placeId", "requiresConfirmation",
    "type", "universeId", "updatedAt", "verified"
  ]);
  assert.doesNotMatch(JSON.stringify(destination), new RegExp(MODERN_CODE));

  const stateA = plain(await hooks.readState(ACCOUNT_A));
  assert.equal(stateA.destinations.length, 1);
  assert.doesNotMatch(JSON.stringify(stateA), new RegExp(MODERN_CODE));
  const rawSnapshot = memory.getSnapshot();
  assert.match(JSON.stringify(rawSnapshot), new RegExp(MODERN_CODE));

  viewerUserId = ACCOUNT_B;
  const stateB = plain(await hooks.readState(ACCOUNT_B));
  assert.deepEqual(stateB.destinations, []);
  assert.deepEqual(stateB.schedules, []);
  await createSchedule({ viewerUserId: ACCOUNT_B });
  assert.equal((await hooks.readState(ACCOUNT_B)).schedules.length, 1);
  assert.equal((await hooks.readState(ACCOUNT_A)).schedules.length, 0);
});

test("get-state rechecks the viewer after an account change during storage read", async () => {
  const memory = resetFixture();
  await saveModernDestination();
  const snapshot = memory.getSnapshot();
  let releaseRead;
  let announceRead;
  const readStarted = new Promise((resolve) => { announceRead = resolve; });
  const delayedRead = new Promise((resolve) => { releaseRead = resolve; });
  hooks.setStorageOverride({
    async read() {
      announceRead();
      await delayedRead;
      return plain(snapshot);
    }
  });
  const request = hooks.dispatchContentMessage({
    type: constants.messageTypes.getState,
    requestId: 10
  });
  await readStarted;
  viewerUserId = ACCOUNT_B;
  releaseRead();
  await assert.rejects(
    () => request,
    (error) => error?.code === "ACCOUNT_CHANGED",
    "old-account Scheduler data must not be returned after the active viewer changes"
  );
});

test("private-link validation rechecks the viewer after delayed resolution", async () => {
  resetFixture();
  let announceResolution;
  let releaseResolution;
  const resolutionStarted = new Promise((resolve) => {
    announceResolution = resolve;
  });
  const delayedResolution = new Promise((resolve) => {
    releaseResolution = resolve;
  });
  hooks.setRuntimeOverrides({
    now: () => now,
    getViewerUserId: async () => viewerUserId,
    fetchFreshViewerUserId: async () => viewerUserId,
    resolveModernDestination: async () => {
      announceResolution();
      return delayedResolution;
    }
  });
  const validation = hooks.dispatchContentMessage({
    type: constants.messageTypes.validateDestination,
    requestId: 10_001,
    viewerUserId: ACCOUNT_A,
    ...GAME,
    url: `https://www.roblox.com/share?code=${MODERN_CODE}&type=Server`
  });
  await resolutionStarted;
  viewerUserId = ACCOUNT_B;
  releaseResolution(plain(modernResolution));
  await assert.rejects(
    () => validation,
    (error) => error?.code === "ACCOUNT_CHANGED",
    "a resolved old-account bearer link must not return validated metadata after the viewer changes"
  );
});

test("notification permission is requested synchronously only by the explicit trusted operation", async () => {
  resetFixture();
  notificationPermission = false;
  const deniedRequest = invokeScheduler({
    type: constants.messageTypes.requestNotificationPermission,
    requestId: 11
  });
  assert.deepEqual(
    permissionRequests,
    [{ permissions: ["notifications"] }],
    "permissions.request must run before the runtime-message handler yields the submit gesture"
  );
  const denied = await deniedRequest;
  assert.equal(denied.response.ok, false);
  assert.equal(denied.response.code, "PERMISSION_DENIED");

  permissionRequests.length = 0;
  let invalidResponse = null;
  assert.equal(hooks.handlePermissionRequest(
    {
      type: constants.messageTypes.requestNotificationPermission,
      requestId: 12
    },
    trustedExtensionSender(),
    (value) => { invalidResponse = plain(value); }
  ), false);
  assert.equal(invalidResponse?.code, "INVALID");
  assert.equal(permissionRequests.length, 0, "an untrusted page cannot trigger a permission prompt");

  await assert.rejects(
    () => createSchedule(),
    (error) => error?.code === "NOTIFICATIONS_REQUIRED"
  );
  assert.equal((await hooks.getSnapshot()).schedules.length, 0);
  assert.equal(
    permissionRequests.length,
    0,
    "create-schedule and coordinator checks may inspect permission but never prompt"
  );

  notificationPermission = true;
  const grantedRequest = invokeScheduler({
    type: constants.messageTypes.requestNotificationPermission,
    requestId: 13
  });
  assert.equal(permissionRequests.length, 1);
  assert.equal((await grantedRequest).response.ok, true);
});

test("one named coordinator alarm targets the earliest warning", async () => {
  resetFixture();
  const later = await createSchedule({ startAt: now + 120_000 });
  const earlier = await createSchedule({ startAt: now + 60_000 });
  createdAlarmTimes = [];
  const nextAt = await hooks.ensureAlarm(now);
  assert.equal(nextAt, earlier.startAt - constants.notificationLeadMs);
  assert.deepEqual(createdAlarmTimes, [nextAt]);
  assert.notEqual(later.id, earlier.id);

  hooks.setRuntimeOverrides(null);
  await hooks.ensureAlarm(now);
  assert.equal(alarmCreates.at(-1).name, constants.alarmName);
  assert.deepEqual(Object.keys(alarmCreates.at(-1).options), ["when"]);
});

test("late schedules become missed and cannot surprise-launch after wake", async () => {
  resetFixture();
  const schedule = await createSchedule({ mode: "notify", autoJoinConsent: false });
  now = schedule.startAt + constants.lateGraceMs + 1;
  const result = await hooks.runCoordinator(now);
  assert.equal(result.code, "OK");
  const stored = (await hooks.readState(ACCOUNT_A)).schedules[0];
  assert.equal(stored.status, "missed");
  assert.equal(stored.resultCode, "missed");
  assert.equal(createdNotifications.length, 0);
  assert.equal(launchCalls.length, 0);
});

test("official event changes disarm the schedule before notification or launch", async () => {
  resetFixture();
  const startAt = now + 60_000;
  const schedule = await createSchedule({
    startAt,
    endAt: startAt + 120_000,
    eventId: "12345"
  });
  eventValidation = { ok: false, code: "EVENT_CHANGED" };
  now = schedule.startAt - constants.notificationLeadMs;
  await hooks.runCoordinator(now);
  const stored = (await hooks.readState(ACCOUNT_A)).schedules[0];
  assert.equal(stored.status, "failed");
  assert.equal(stored.resultCode, "event-changed");
  assert.equal(createdNotifications.length, 0);
  assert.equal(launchCalls.length, 0);
});

test("official event revalidation fails closed when force refresh only returns stale cache", async () => {
  resetFixture();
  const startAt = now + 60_000;
  const endAt = startAt + 120_000;
  const schedule = await createSchedule({
    startAt,
    endAt,
    eventId: "12345"
  });
  backgroundHooks.resetGameEventsStateForTests();
  const cachedEvent = backgroundHooks.normalizeGameEvent({
    id: "12345",
    universeId: Number(GAME.universeId),
    placeId: Number(GAME.placeId),
    title: GAME.title,
    subtitle: "Cached fixture",
    eventVisibility: "public",
    eventStatus: "active",
    eventTime: {
      startUtc: new Date(startAt).toISOString(),
      endUtc: new Date(endAt).toISOString()
    },
    thumbnails: []
  }, GAME.universeId, BASE_NOW);
  assert.ok(cachedEvent);
  backgroundHooks.setGameEventsCache(
    GAME.universeId,
    [cachedEvent],
    BASE_NOW - backgroundHooks.gameEventsConstants.cacheTtlMs - 1
  );
  fetchHandler = async () => { throw new TypeError("offline"); };
  hooks.setRuntimeOverrides({
    now: () => now,
    getViewerUserId: async () => viewerUserId,
    fetchFreshViewerUserId: async () => viewerUserId,
    hasNotificationPermission: async () => true,
    createAlarm: async () => undefined,
    clearAlarm: async () => true,
    createNotification: async (rawSchedule, message) => {
      createdNotifications.push({ schedule: plain(rawSchedule), message });
    },
    clearNotification: async () => true,
    getPresence: async () => ({ kind: "not-in-game" }),
    launchDestination: async (rawDestination) => {
      launchCalls.push(plain(rawDestination));
      return "started";
    }
  });
  now = schedule.startAt;
  await hooks.runCoordinator(now);
  const stored = (await hooks.readState(ACCOUNT_A)).schedules[0];
  assert.equal(launchCalls.length, 0, "cached event data cannot reauthorize an auto-join");
  assert.equal(createdNotifications.length, 0, "a stale event is not presented as freshly verified");
  assert.equal(stored.status, "failed");
  assert.equal(stored.resultCode, "event-unavailable");
});

test("presence honors same-game and explicit switch consent", async () => {
  resetFixture();
  let schedule = await createSchedule();
  presence = { kind: "in-game", universeId: GAME.universeId, placeId: GAME.placeId };
  now = schedule.startAt;
  await hooks.runCoordinator(now);
  let stored = (await hooks.readState(ACCOUNT_A)).schedules[0];
  assert.equal(stored.status, "completed");
  assert.equal(stored.resultCode, "already-in-game");
  assert.equal(launchCalls.length, 0);

  resetFixture();
  schedule = await createSchedule({ allowSwitch: false });
  presence = { kind: "in-game", universeId: "9001", placeId: "9002" };
  now = schedule.startAt;
  await hooks.runCoordinator(now);
  stored = (await hooks.readState(ACCOUNT_A)).schedules[0];
  assert.equal(stored.status, "failed");
  assert.equal(stored.resultCode, "switch-not-allowed");
  assert.equal(launchCalls.length, 0);

  resetFixture();
  schedule = await createSchedule({ allowSwitch: true });
  presence = { kind: "in-game", universeId: "9001", placeId: "9002" };
  now = schedule.startAt;
  await hooks.runCoordinator(now);
  assert.equal(launchCalls.length, 1);
  assert.equal((await hooks.readState(ACCOUNT_A)).schedules[0].resultCode, "started");
});

test("durable claim is at-most-once and colliding auto-joins do not both launch", async () => {
  resetFixture();
  const first = await createSchedule({ startAt: now + 60_000, title: "First" });
  now = first.startAt;
  await Promise.all([hooks.runCoordinator(now), hooks.runCoordinator(now)]);
  await hooks.runCoordinator(now);
  assert.equal(launchCalls.length, 1);
  assert.equal((await hooks.readState(ACCOUNT_A)).schedules[0].status, "completed");

  const memory = resetFixture();
  const sameStart = now + 60_000;
  await createSchedule({ startAt: sameStart, title: "First" });
  await createSchedule({ startAt: sameStart, title: "Second" });
  const prearmed = memory.getSnapshot().schedules;
  assert.equal(prearmed.length, 2);
  assert.ok(prearmed.every(({ consentedAt }) => consentedAt < sameStart),
    "both colliding schedules must have been consented before either attempt");
  now = sameStart;
  await hooks.runCoordinator(now);
  const schedules = (await hooks.readState(ACCOUNT_A)).schedules;
  assert.equal(launchCalls.length, 1);
  assert.equal(schedules.filter(({ resultCode }) => resultCode === "started").length, 1);
  assert.equal(schedules.filter(({ resultCode }) => resultCode === "collision").length, 1);
  assert.equal(
    createdNotifications.filter(({ message }) => /another scheduled join/i.test(message)).length,
    1,
    "one prearmed same-time schedule gets exactly one collision notification"
  );
});

test("fresh consent is not blocked by a prior successful or failed auto attempt", async () => {
  for (const priorOutcome of ["started", "switch-not-allowed"]) {
    const memory = resetFixture();
    const shouldFail = priorOutcome === "switch-not-allowed";
    const previous = await createSchedule({
      requestId: shouldFail ? 901 : 900,
      title: `Previous ${priorOutcome}`,
      allowSwitch: !shouldFail
    });
    if (shouldFail) {
      presence = { kind: "in-game", universeId: "9001", placeId: "9002" };
    }
    now = previous.startAt;
    await hooks.runCoordinator(now);
    const previousStored = (await hooks.readState(ACCOUNT_A)).schedules[0];
    assert.equal(previousStored.resultCode, priorOutcome);
    const rawAfterAttempt = memory.getSnapshot();
    const previousAttemptAt = rawAfterAttempt.meta.find(
      ({ key }) => key === "global"
    )?.lastAutoAttemptAt;
    assert.equal(previousAttemptAt, now,
      "even a failed claimed attempt records the collision timestamp");

    const deleted = await hooks.deleteSchedule({
      requestId: shouldFail ? 911 : 910,
      viewerUserId: ACCOUNT_A,
      scheduleId: previousStored.id,
      expectedRevision: previousStored.revision
    });
    assert.equal(deleted.removed, true);
    assert.equal((await hooks.readState(ACCOUNT_A)).schedules.length, 0);

    // Re-consent immediately, including the equal-millisecond boundary. This
    // sole new schedule is not part of the already-armed collision set.
    presence = { kind: "not-in-game" };
    launchCalls = [];
    createdNotifications = [];
    const fresh = await createSchedule({
      requestId: shouldFail ? 921 : 920,
      title: `Fresh after ${priorOutcome}`,
      startAt: now + 60_000,
      allowSwitch: true,
      autoJoinConsent: true
    });
    const freshRaw = memory.getSnapshot().schedules.find(({ id }) => id === fresh.id);
    assert.equal(freshRaw?.consentedAt, previousAttemptAt,
      "equal-time fresh consent must not be classified as prearmed");
    now = fresh.startAt;
    await hooks.runCoordinator(now);
    const [freshStored] = (await hooks.readState(ACCOUNT_A)).schedules;
    assert.equal(freshStored.id, fresh.id);
    assert.equal(freshStored.status, "completed");
    assert.equal(freshStored.resultCode, "started");
    assert.equal(launchCalls.length, 1);
    assert.equal(
      createdNotifications.filter(({ message }) => /another scheduled join/i.test(message)).length,
      0,
      `fresh consent after ${priorOutcome} received a false collision warning`
    );
  }
});

test("future or corrupt global collision metadata never blocks a sole schedule", async () => {
  for (const lastAutoAttemptAt of ["future", "corrupt"]) {
    const memory = resetFixture();
    const schedule = await createSchedule({
      requestId: lastAutoAttemptAt === "future" ? 930 : 931,
      title: `${lastAutoAttemptAt} metadata`
    });
    const snapshot = memory.getSnapshot();
    const recordVersion = snapshot.meta[0]?.recordVersion;
    snapshot.meta = snapshot.meta.filter(({ key }) => key !== "global");
    snapshot.meta.push({
      recordVersion,
      key: "global",
      lastAutoAttemptAt: lastAutoAttemptAt === "future"
        ? schedule.startAt + constants.collisionMs
        : "not-a-timestamp"
    });
    hooks.setStorageOverride(hooks.createMemoryStorage(snapshot));

    now = schedule.startAt;
    await hooks.runCoordinator(now);
    const [stored] = (await hooks.readState(ACCOUNT_A)).schedules;
    assert.equal(stored.status, "completed");
    assert.equal(stored.resultCode, "started");
    assert.equal(launchCalls.length, 1);
    assert.equal(
      createdNotifications.filter(({ message }) => /another scheduled join/i.test(message)).length,
      0,
      `${lastAutoAttemptAt} global metadata caused a false collision`
    );
  }
});

const collisionClaimSource = backgroundSource.slice(
  backgroundSource.indexOf("async function claimJoinSchedulerSchedule"),
  backgroundSource.indexOf("function joinSchedulerDestinationsMatch")
);
assert.match(
  collisionClaimSource,
  /globalMeta\.lastAutoAttemptAt[\s\S]*?globalMeta\.lastAutoAttemptAt <= now[\s\S]*?now - globalMeta\.lastAutoAttemptAt < JOIN_SCHEDULER_AUTO_COLLISION_MS[\s\S]*?schedule\.consentedAt < globalMeta\.lastAutoAttemptAt/,
  "collision applies only to valid recent attempts and schedules consented before them"
);

test("canceling a claimed schedule wins the final pre-launch race", async () => {
  resetFixture();
  const schedule = await createSchedule();
  now = schedule.startAt;
  let releasePresence;
  let announcePresence;
  const presenceStarted = new Promise((resolve) => { announcePresence = resolve; });
  const delayedPresence = new Promise((resolve) => { releasePresence = resolve; });
  hooks.setRuntimeOverrides({
    now: () => now,
    getViewerUserId: async () => viewerUserId,
    fetchFreshViewerUserId: async () => viewerUserId,
    hasNotificationPermission: async () => true,
    createAlarm: async () => undefined,
    clearAlarm: async () => true,
    createNotification: async () => undefined,
    clearNotification: async () => true,
    revalidateEvent: async () => ({ ok: true, event: null }),
    getPresence: async () => {
      announcePresence();
      return delayedPresence;
    },
    launchDestination: async (destination) => {
      launchCalls.push(plain(destination));
      return "started";
    }
  });
  const attempt = hooks.attemptSchedule(ACCOUNT_A, schedule.id, {
    automatic: true
  }).catch((error) => error);
  await presenceStarted;
  const canceled = await hooks.cancelSchedule({
    requestId: 77,
    viewerUserId: ACCOUNT_A,
    scheduleId: schedule.id,
    expectedRevision: schedule.revision
  });
  assert.equal(canceled.canceled, true);
  releasePresence({ kind: "not-in-game" });
  await attempt;
  assert.equal(launchCalls.length, 0, "a cancellation after claim must still prevent launch");
  const stored = (await hooks.readState(ACCOUNT_A)).schedules[0];
  assert.equal(stored.status, "canceled");
  assert.equal(stored.resultCode, "canceled");
});

test("removing a claimed schedule wins the final pre-launch race and deletes it", async () => {
  resetFixture();
  const schedule = await createSchedule();
  now = schedule.startAt;
  let releasePresence;
  let announcePresence;
  const presenceStarted = new Promise((resolve) => { announcePresence = resolve; });
  const delayedPresence = new Promise((resolve) => { releasePresence = resolve; });
  hooks.setRuntimeOverrides({
    now: () => now,
    getViewerUserId: async () => viewerUserId,
    fetchFreshViewerUserId: async () => viewerUserId,
    hasNotificationPermission: async () => true,
    createAlarm: async (when) => { createdAlarmTimes.push(when); },
    clearAlarm: async () => { clearedAlarms += 1; return true; },
    createNotification: async () => undefined,
    clearNotification: async (scheduleId) => {
      clearedNotifications.push(scheduleId);
      return true;
    },
    revalidateEvent: async () => ({ ok: true, event: null }),
    getPresence: async () => {
      announcePresence();
      return delayedPresence;
    },
    launchDestination: async (destination) => {
      launchCalls.push(plain(destination));
      return "started";
    }
  });
  const attempt = hooks.attemptSchedule(ACCOUNT_A, schedule.id, {
    automatic: true
  }).catch((error) => error);
  await presenceStarted;
  const alarmClearsBeforeRemove = clearedAlarms;
  const notificationClearsBeforeRemove = clearedNotifications.length;
  const removed = await hooks.deleteSchedule({
    requestId: 771,
    viewerUserId: ACCOUNT_A,
    scheduleId: schedule.id,
    expectedRevision: schedule.revision
  });
  assert.equal(removed.removed, true);
  releasePresence({ kind: "not-in-game" });
  await attempt;
  assert.equal(launchCalls.length, 0,
    "deleting after claim must still prevent the final launch authorization");
  const state = await hooks.readState(ACCOUNT_A);
  assert.equal(state.schedules.length, 0, "Remove leaves no canceled history row");
  assert.equal(state.destinations.length, 0, "Remove prunes its orphan public destination");
  assert.deepEqual(
    clearedNotifications.slice(notificationClearsBeforeRemove),
    [schedule.id],
    "Remove clears the schedule notification"
  );
  assert.ok(clearedAlarms > alarmClearsBeforeRemove,
    "Remove updates the coordinator after deleting the final schedule");
});

test("a stale editor revision cannot overwrite a newer pending schedule", async () => {
  resetFixture();
  const original = await createSchedule();
  const movedStartAt = original.startAt + 10 * 60_000;
  const edited = await hooks.createSchedule(createSchedulePayload({
    requestId: 78,
    scheduleId: original.id,
    expectedRevision: original.revision,
    startAt: movedStartAt,
    title: "Moved Event"
  }));
  assert.ok(edited.schedule.revision > original.revision);
  await assert.rejects(
    () => hooks.createSchedule(createSchedulePayload({
      requestId: 79,
      scheduleId: original.id,
      expectedRevision: original.revision,
      startAt: movedStartAt + 60_000,
      title: "Stale Window Edit"
    })),
    (error) => error?.code === "SCHEDULE_CHANGED"
  );
  const stored = (await hooks.readState(ACCOUNT_A)).schedules[0];
  assert.equal(stored.status, "pending");
  assert.equal(stored.revision, edited.schedule.revision);
  assert.equal(stored.startAt, movedStartAt);
  assert.equal(stored.title, "Moved Event");
  assert.equal(launchCalls.length, 0);
});

test("automatic attempt claims before slow destination preflight blocks edits", async () => {
  resetFixture();
  const destination = await saveModernDestination();
  const original = await createSchedule({
    destinationType: "saved",
    destinationId: destination.id,
    placeId: destination.placeId
  });
  now = original.startAt;
  let releaseResolution;
  let announceResolution;
  let resolutionCalls = 0;
  const resolutionStarted = new Promise((resolve) => { announceResolution = resolve; });
  const delayedResolution = new Promise((resolve) => { releaseResolution = resolve; });
  hooks.setRuntimeOverrides({
    now: () => now,
    getViewerUserId: async () => viewerUserId,
    fetchFreshViewerUserId: async () => viewerUserId,
    hasNotificationPermission: async () => true,
    createAlarm: async () => undefined,
    clearAlarm: async () => true,
    createNotification: async () => undefined,
    clearNotification: async () => true,
    getPresence: async () => ({ kind: "not-in-game" }),
    resolveModernDestination: async () => {
      resolutionCalls += 1;
      if (resolutionCalls === 1) {
        announceResolution();
        return delayedResolution;
      }
      return plain(modernResolution);
    },
    launchDestination: async (rawDestination) => {
      launchCalls.push(plain(rawDestination));
      return "started";
    }
  });
  const staleAttempt = hooks.attemptSchedule(ACCOUNT_A, original.id, {
    automatic: true
  }).catch((error) => error);
  await resolutionStarted;
  await assert.rejects(
    () => hooks.createSchedule(createSchedulePayload({
      requestId: 80,
      scheduleId: original.id,
      expectedRevision: original.revision,
      startAt: now + 10 * 60_000,
      title: "Too Late To Edit",
      destinationType: "saved",
      destinationId: destination.id,
      placeId: destination.placeId
    })),
    (error) => error?.code === "SCHEDULE_NOT_EDITABLE"
  );
  releaseResolution(plain(modernResolution));
  await staleAttempt;
  const stored = (await hooks.readState(ACCOUNT_A)).schedules[0];
  assert.equal(launchCalls.length, 1);
  assert.equal(stored.status, "completed");
  assert.equal(stored.title, original.title);
});

test("slow preflight rechecks the clock and cannot cross the late grace window", async () => {
  resetFixture();
  const schedule = await createSchedule();
  now = schedule.startAt;
  let releaseViewer;
  let announceViewer;
  let viewerChecks = 0;
  const viewerStarted = new Promise((resolve) => { announceViewer = resolve; });
  const delayedViewer = new Promise((resolve) => { releaseViewer = resolve; });
  hooks.setRuntimeOverrides({
    now: () => now,
    getViewerUserId: async () => viewerUserId,
    fetchFreshViewerUserId: async () => {
      viewerChecks += 1;
      if (viewerChecks === 1) {
        announceViewer();
        return delayedViewer;
      }
      return viewerUserId;
    },
    hasNotificationPermission: async () => true,
    createAlarm: async () => undefined,
    clearAlarm: async () => true,
    clearNotification: async () => true,
    getPresence: async () => ({ kind: "not-in-game" }),
    launchDestination: async (rawDestination) => {
      launchCalls.push(plain(rawDestination));
      return "started";
    }
  });
  const slowAttempt = hooks.attemptSchedule(ACCOUNT_A, schedule.id, {
    automatic: true
  }).catch((error) => error);
  await viewerStarted;
  now = schedule.startAt + constants.lateGraceMs + 1;
  releaseViewer(viewerUserId);
  await slowAttempt;
  const stored = (await hooks.readState(ACCOUNT_A)).schedules[0];
  assert.equal(launchCalls.length, 0);
  assert.equal(stored.status, "missed");
  assert.equal(stored.resultCode, "missed");
});

test("an in-flight stale warning cannot mark an edited schedule as notified", async () => {
  resetFixture();
  const original = await createSchedule({
    mode: "notify",
    autoJoinConsent: false
  });
  now = original.startAt - constants.notificationLeadMs;
  let releaseNotification;
  let announceNotification;
  const notificationStarted = new Promise((resolve) => {
    announceNotification = resolve;
  });
  const delayedNotification = new Promise((resolve) => {
    releaseNotification = resolve;
  });
  hooks.setRuntimeOverrides({
    now: () => now,
    getViewerUserId: async () => viewerUserId,
    fetchFreshViewerUserId: async () => viewerUserId,
    hasNotificationPermission: async () => true,
    createAlarm: async () => undefined,
    clearAlarm: async () => true,
    createNotification: async (schedule, message) => {
      createdNotifications.push({ schedule: plain(schedule), message });
      announceNotification();
      await delayedNotification;
      return hooks.getNotificationId(schedule.id, schedule.revision);
    },
    clearNotification: async (scheduleId) => {
      clearedNotifications.push(scheduleId);
      return true;
    },
    getPresence: async () => ({ kind: "not-in-game" })
  });
  const coordinator = hooks.runCoordinator(now);
  await notificationStarted;
  const movedStartAt = original.startAt + 10 * 60_000;
  await hooks.createSchedule(createSchedulePayload({
    requestId: 79,
    scheduleId: original.id,
    expectedRevision: original.revision,
    startAt: movedStartAt,
    title: "Moved Reminder",
    mode: "notify",
    autoJoinConsent: false,
    allowSwitch: false
  }));
  releaseNotification();
  await coordinator;
  const stored = (await hooks.readState(ACCOUNT_A)).schedules[0];
  assert.equal(stored.status, "pending");
  assert.equal(stored.startAt, movedStartAt);
  assert.equal(stored.title, "Moved Reminder");
  assert.equal(stored.notifiedAt, 0, "the edited revision still needs its own warning");
  assert.ok(
    clearedNotifications.includes(original.id),
    "the already-created stale notification is cleared after the revision mismatch"
  );
});

test("service-worker startup fails an interrupted claim instead of retrying it", async () => {
  resetFixture();
  const schedule = await createSchedule();
  now = schedule.startAt;
  const claim = await hooks.claimSchedule(
    ACCOUNT_A,
    schedule.id,
    true,
    schedule.revision
  );
  assert.equal(claim.code, "claimed");
  hooks.applyFeatureValue(featureSettings.rslFeatureSettingsV1, "startup");
  await new Promise((resolve) => setTimeout(resolve, 0));
  await hooks.waitForWrites();
  const stored = (await hooks.readState(ACCOUNT_A)).schedules[0];
  assert.equal(stored.status, "failed");
  assert.equal(stored.resultCode, "interrupted");
  assert.equal(launchCalls.length, 0);
});

test("launch tabs reject queried and post-query incognito or foreign pages", async () => {
  resetFixture();
  availableTabs = [
    {
      id: 38,
      windowId: 8,
      incognito: true,
      active: true,
      status: "complete",
      url: "https://www.roblox.com/home"
    },
    {
      id: 39,
      windowId: 9,
      incognito: false,
      active: true,
      status: "complete",
      url: "https://www.roblox.com.evil.test/home"
    },
    {
      id: 41,
      windowId: 1,
      incognito: false,
      active: false,
      status: "complete",
      url: "https://www.roblox.com/home"
    }
  ];
  assert.equal((await hooks.getRobloxTab(GAME.placeId))?.id, 41,
    "query results skip both incognito and lookalike Roblox tabs");
  assert.equal(tabCreates.length, 0);

  const publicPrepared = {
    kind: "public",
    tabId: 41,
    destination: { placeId: GAME.placeId }
  };
  tabsGetHandler = async () => ({
    id: 41,
    windowId: 1,
    incognito: true,
    url: "https://www.roblox.com/home"
  });
  assert.equal(await hooks.executePreparedDestination(publicPrepared), "unavailable");
  assert.equal(scriptInjections.length, 0,
    "an incognito navigation race is rejected before public MAIN-world injection");

  tabsGetHandler = async () => ({
    id: 41,
    windowId: 1,
    incognito: false,
    url: "https://www.roblox.com/home",
    pendingUrl: "https://www.roblox.com.evil.test/capture"
  });
  assert.equal(await hooks.executePreparedDestination(publicPrepared), "unavailable");
  assert.equal(scriptInjections.length, 0,
    "an unsafe pending navigation is rejected even while the current URL is Roblox");

  const legacyPrepared = {
    kind: "private-legacy",
    tabId: 41,
    destination: { placeId: GAME.placeId, secret: LEGACY_CODE }
  };
  tabsGetHandler = async () => ({
    id: 41,
    windowId: 1,
    incognito: false,
    url: "https://www.roblox.com.evil.test/home"
  });
  assert.equal(await hooks.executePreparedDestination(legacyPrepared), "unavailable");
  assert.equal(scriptInjections.length, 0,
    "a lookalike navigation race is rejected before private legacy injection");
});

test("private share links use only a proven normal browser window", async () => {
  resetFixture();
  const prepared = {
    kind: "private-share",
    destination: { secret: MODERN_CODE }
  };
  const originalGetAll = chrome.windows.getAll;
  const originalCreateWindow = chrome.windows.create;
  const privateSharePattern = /\/share\?code=.*&type=Server/;
  try {
    delete chrome.windows.getAll;
    assert.equal(await hooks.executePreparedDestination(prepared), "failed");
    assert.equal(tabCreates.length, 0,
      "a bearer URL is refused when no normal-window identity can be proven");

    chrome.windows.getAll = async () => [
      { id: 6, type: "normal", incognito: true, focused: true },
      { id: 7, type: "normal", incognito: false, focused: false }
    ];
    assert.equal(await hooks.executePreparedDestination(prepared), "started");
    assert.equal(tabCreates.length, 1);
    assert.equal(tabCreates[0].windowId, 7,
      "the private share opens in the known non-incognito window, never the focused incognito one");
    assert.match(tabCreates[0].url, privateSharePattern);

    tabCreates.length = 0;
    tabUpdates.length = 0;
    const windowCreates = [];
    chrome.windows.getAll = async () => [];
    chrome.windows.create = async (details) => {
      windowCreates.push(plain(details));
      return {
        id: 9,
        type: "normal",
        incognito: false,
        tabs: [{
          id: 90,
          windowId: 9,
          incognito: false,
          status: "complete",
          url: "https://www.roblox.com/home"
        }]
      };
    };
    assert.equal(await hooks.executePreparedDestination(prepared), "started");
    assert.equal(windowCreates.length, 1);
    assert.equal(windowCreates[0].url, "https://www.roblox.com/home",
      "a new window is proven normal before the bearer URL is navigated");
    assert.equal(windowCreates[0].incognito, false);
    assert.equal(tabUpdates.length, 1);
    assert.equal(tabUpdates[0].id, 90);
    assert.match(tabUpdates[0].details.url, privateSharePattern);
  } finally {
    if (originalGetAll === undefined) delete chrome.windows.getAll;
    else chrome.windows.getAll = originalGetAll;
    chrome.windows.create = originalCreateWindow;
  }
});

test("private launch failure has no public-server fallback", async () => {
  resetFixture();
  hooks.setRuntimeOverrides({
    now: () => now,
    getViewerUserId: async () => viewerUserId,
    fetchFreshViewerUserId: async () => viewerUserId,
    hasNotificationPermission: async () => true,
    createAlarm: async () => undefined,
    clearAlarm: async () => true,
    createNotification: async () => undefined,
    clearNotification: async () => true,
    getPresence: async () => ({ kind: "not-in-game" }),
    resolveModernDestination: async () => plain(modernResolution),
    getRobloxTab: async () => ({ id: 41 })
  });
  // Legacy validation needs only the existing place-to-universe resolver, so
  // create a modern private destination and assert its path never injects the
  // one-argument public launcher even when opening the share URL fails.
  const privateDestination = await saveModernDestination();
  const originalCreate = chrome.tabs.create;
  chrome.tabs.create = async () => { throw new Error("browser rejected protocol page"); };
  const schedule = await createSchedule({
    destinationType: "saved",
    destinationId: privateDestination.id,
    placeId: privateDestination.placeId
  });
  now = schedule.startAt;
  await hooks.runCoordinator(now);
  chrome.tabs.create = originalCreate;
  const stored = (await hooks.readState(ACCOUNT_A)).schedules[0];
  assert.equal(stored.status, "failed");
  assert.equal(stored.resultCode, "failed");
  assert.equal(scriptInjections.length, 0, "a failed private share must not call public join");
});

test("disable, permission removal, and explicit destination deletion cancel armed schedules", async () => {
  resetFixture();
  await createSchedule();
  const disabled = await hooks.dispatchContentMessage({
    type: constants.messageTypes.setEnabled,
    requestId: 20,
    viewerUserId: ACCOUNT_A,
    enabled: false
  });
  assert.equal(disabled.canceledSchedules, 1);
  assert.equal((await hooks.readState(ACCOUNT_A)).schedules[0].status, "canceled");

  resetFixture();
  await createSchedule();
  assert.equal(await hooks.handlePermissionRemoved({ permissions: ["notifications"] }), true);
  assert.equal((await hooks.readState(ACCOUNT_A)).schedules[0].resultCode,
    "notifications-permission-removed");

  resetFixture();
  const destination = await saveModernDestination();
  await createSchedule({
    destinationType: "saved",
    destinationId: destination.id,
    placeId: destination.placeId
  });
  const deleted = await hooks.deleteDestination({
    requestId: 21,
    viewerUserId: ACCOUNT_A,
    destinationId: destination.id
  });
  assert.equal(deleted.removed, true);
  assert.equal(deleted.canceledSchedules, 1);
  const snapshot = await hooks.getSnapshot();
  assert.equal(snapshot.destinations.length, 0);
  assert.equal(snapshot.schedules[0].resultCode, "destination-removed");
});

test("orphan public destinations cannot exhaust the hidden destination limit", async () => {
  resetFixture();
  const savedPrivate = await saveModernDestination();
  assert.equal(savedPrivate.type, "private-share");
  for (let index = 0; index < constants.maxDestinations + 5; index += 1) {
    const schedule = await createSchedule({
      requestId: 100 + index,
      universeId: String(3_000 + index),
      placeId: String(4_000 + index),
      gameName: `Public Fixture ${index}`,
      title: `Public Fixture ${index}`,
      startAt: now + 60_000 + index
    });
    const deleted = await hooks.deleteSchedule({
      requestId: 200 + index,
      viewerUserId: ACCOUNT_A,
      scheduleId: schedule.id,
      expectedRevision: schedule.revision
    });
    assert.equal(deleted.removed, true);
  }
  const state = await hooks.readState(ACCOUNT_A);
  assert.equal(state.schedules.length, 0);
  assert.ok(
    state.destinations.some(({ id, type }) =>
      id === savedPrivate.id && type === "private-share"
    ),
    "automatic public cleanup must never delete a user-saved private destination"
  );
  assert.ok(state.destinations.length <= constants.maxDestinations);
  const next = await createSchedule({
    universeId: "9001",
    placeId: "9002",
    gameName: "Still Schedulable",
    title: "Still Schedulable"
  });
  assert.equal(next.status, "pending");
});

test("Game Events tracking is independent from separately consented schedules", () => {
  const removeFavorite = backgroundSource.slice(
    backgroundSource.indexOf("async function removeGameEventFavorite"),
    backgroundSource.indexOf("function sendGameEventsErrorResponse")
  );
  assert.doesNotMatch(removeFavorite, /JoinScheduler|joinScheduler|canceledSchedules/);
});

test("account switch during event refresh prevents an old-account notification", async () => {
  resetFixture();
  const schedule = await createSchedule({
    mode: "notify",
    autoJoinConsent: false,
    eventId: "12345"
  });
  now = schedule.startAt - constants.notificationLeadMs;
  let announceEvent;
  let releaseEvent;
  const eventStarted = new Promise((resolve) => { announceEvent = resolve; });
  const delayedEvent = new Promise((resolve) => { releaseEvent = resolve; });
  const exactClears = [];
  hooks.setRuntimeOverrides({
    now: () => now,
    getViewerUserId: async () => viewerUserId,
    fetchFreshViewerUserId: async () => viewerUserId,
    hasNotificationPermission: async () => true,
    createAlarm: async () => undefined,
    clearAlarm: async () => true,
    createNotification: async (rawSchedule) => {
      createdNotifications.push(plain(rawSchedule));
    },
    clearNotification: async (scheduleId, revision) => {
      exactClears.push({ scheduleId, revision });
      return true;
    },
    revalidateEvent: async () => {
      announceEvent();
      return delayedEvent;
    }
  });
  const coordinator = hooks.runCoordinator(now);
  await eventStarted;
  viewerUserId = ACCOUNT_B;
  releaseEvent({ ok: true, event: null });
  await coordinator;
  const stored = (await hooks.readState(ACCOUNT_A)).schedules[0];
  assert.equal(createdNotifications.length, 0);
  assert.equal(stored.status, "pending");
  assert.equal(stored.notifiedAt, 0);
  assert.deepEqual(exactClears, [{
    scheduleId: schedule.id,
    revision: schedule.revision
  }]);
});

test("account switch while notification creation waits clears that exact revision", async () => {
  resetFixture();
  const schedule = await createSchedule({ mode: "notify", autoJoinConsent: false });
  now = schedule.startAt - constants.notificationLeadMs;
  let announceNotification;
  let releaseNotification;
  const notificationStarted = new Promise((resolve) => {
    announceNotification = resolve;
  });
  const delayedNotification = new Promise((resolve) => {
    releaseNotification = resolve;
  });
  const exactClears = [];
  hooks.setRuntimeOverrides({
    now: () => now,
    getViewerUserId: async () => viewerUserId,
    fetchFreshViewerUserId: async () => viewerUserId,
    hasNotificationPermission: async () => true,
    createAlarm: async () => undefined,
    clearAlarm: async () => true,
    createNotification: async (rawSchedule) => {
      createdNotifications.push(plain(rawSchedule));
      announceNotification();
      await delayedNotification;
      return hooks.getNotificationId(rawSchedule.id, rawSchedule.revision);
    },
    clearNotification: async (scheduleId, revision) => {
      exactClears.push({ scheduleId, revision });
      return true;
    },
    revalidateEvent: async () => ({ ok: true, event: null })
  });
  const coordinator = hooks.runCoordinator(now);
  await notificationStarted;
  viewerUserId = ACCOUNT_B;
  releaseNotification();
  await coordinator;
  const stored = (await hooks.readState(ACCOUNT_A)).schedules[0];
  assert.equal(createdNotifications.length, 1);
  assert.equal(stored.status, "pending");
  assert.equal(stored.notifiedAt, 0);
  assert.deepEqual(exactClears, [{
    scheduleId: schedule.id,
    revision: schedule.revision
  }]);
});

test("notification actions fail closed when another account is active", async () => {
  resetFixture();
  const schedule = await createSchedule({ mode: "notify", autoJoinConsent: false });
  const notificationId = hooks.getNotificationId(schedule.id, schedule.revision);
  const exactClears = [];
  viewerUserId = ACCOUNT_B;
  hooks.setRuntimeOverrides({
    now: () => now,
    getViewerUserId: async () => viewerUserId,
    fetchFreshViewerUserId: async () => viewerUserId,
    hasNotificationPermission: async () => true,
    clearNotification: async (scheduleId, revision) => {
      exactClears.push({ scheduleId, revision });
      return true;
    }
  });
  assert.equal(await hooks.handleNotificationButton(notificationId, 0), false);
  assert.equal(await hooks.handleNotificationButton(notificationId, 1), false);
  assert.equal(await hooks.handleNotificationClick(notificationId), false);
  const stored = (await hooks.readState(ACCOUNT_A)).schedules[0];
  assert.equal(stored.status, "pending");
  assert.equal(stored.revision, schedule.revision);
  assert.equal(launchCalls.length, 0);
  assert.equal(tabMessages.length, 0);
  assert.equal(tabCreates.length, 0);
  assert.equal(exactClears.length, 3);
  assert.ok(exactClears.every((request) =>
    request.scheduleId === schedule.id &&
    request.revision === schedule.revision
  ));
});

test("notification body opens only the in-page Scheduler modal", async () => {
  resetFixture();
  availableTabs = [
    { id: 40, windowId: 2, incognito: true, active: true, status: "complete", url: "https://www.roblox.com/home" },
    { id: 41, windowId: 1, incognito: false, active: false, status: "complete", url: "https://www.roblox.com/home" }
  ];
  const schedule = await createSchedule({ mode: "notify", autoJoinConsent: false });
  const notificationId = hooks.getNotificationId(schedule.id, schedule.revision);
  assert.equal(await hooks.handleNotificationClick(notificationId), true);
  assert.equal(tabCreates.length, 0, "an existing Roblox tab is reused");
  assert.equal(tabMessages.length, 1);
  assert.equal(tabMessages[0].tabId, 41);
  assert.deepEqual(tabMessages[0].options, { frameId: 0 });
  assert.equal(tabMessages[0].message.type, "rsl:show-join-scheduler");
  assert.deepEqual(
    Object.keys(tabMessages[0].message).sort(),
    ["type"],
    "the notification-to-modal signal carries no schedule, account, or destination data"
  );

  resetFixture();
  availableTabs = [];
  const noTabSchedule = await createSchedule({ mode: "notify", autoJoinConsent: false });
  assert.equal(await hooks.handleNotificationClick(
    hooks.getNotificationId(noTabSchedule.id, noTabSchedule.revision)
  ), true);
  assert.equal(tabCreates.length, 1, "notification body creates a Roblox tab when none exists");
  assert.match(tabCreates[0].url, /^https:\/\/www\.roblox\.com\//);
  assert.equal(tabMessages.at(-1)?.tabId, 42);
  assert.equal(tabMessages.at(-1)?.message?.type, "rsl:show-join-scheduler");
});

test("notification modal delivery requires an explicit typed content acknowledgement", async () => {
  resetFixture();
  assert.equal(await hooks.sendShowMessage(41, 100), true);
  assert.deepEqual(tabMessages[0].options, { frameId: 0 });

  tabMessages.length = 0;
  tabMessageResponse = { ok: true };
  assert.equal(await hooks.sendShowMessage(41, 100), false);
  assert.equal(tabMessages.length, 1);

  tabMessages.length = 0;
  tabMessageResponse = { ok: false, type: "rsl:show-join-scheduler" };
  assert.equal(await hooks.sendShowMessage(41, 100), false);
  assert.equal(tabMessages.length, 1);
});

test("account switch while a notification is locating a Roblox tab suppresses the modal", async () => {
  resetFixture();
  const schedule = await createSchedule({ mode: "notify", autoJoinConsent: false });
  const notificationId = hooks.getNotificationId(schedule.id, schedule.revision);
  let announceQuery;
  let releaseQuery;
  const queryStarted = new Promise((resolve) => { announceQuery = resolve; });
  const delayedQuery = new Promise((resolve) => { releaseQuery = resolve; });
  const exactClears = [];
  tabsQueryHandler = async () => {
    announceQuery();
    return delayedQuery;
  };
  hooks.setRuntimeOverrides({
    now: () => now,
    getViewerUserId: async () => viewerUserId,
    fetchFreshViewerUserId: async () => viewerUserId,
    hasNotificationPermission: async () => true,
    clearNotification: async (scheduleId, revision) => {
      exactClears.push({ scheduleId, revision });
      return true;
    }
  });
  const opening = hooks.handleNotificationClick(notificationId);
  await queryStarted;
  viewerUserId = ACCOUNT_B;
  releaseQuery(plain(availableTabs));
  assert.equal(await opening, false);
  assert.equal(tabMessages.length, 0);
  assert.deepEqual(exactClears, [{
    scheduleId: schedule.id,
    revision: schedule.revision
  }]);
  assert.equal((await hooks.readState(ACCOUNT_A)).schedules[0].status, "pending");
});

test("viewer is checked after a delayed permission check before notification action", async () => {
  resetFixture();
  const schedule = await createSchedule({ mode: "notify", autoJoinConsent: false });
  const notificationId = hooks.getNotificationId(schedule.id, schedule.revision);
  let announcePermission;
  let releasePermission;
  const permissionStarted = new Promise((resolve) => {
    announcePermission = resolve;
  });
  const delayedPermission = new Promise((resolve) => {
    releasePermission = resolve;
  });
  const exactClears = [];
  hooks.setRuntimeOverrides({
    now: () => now,
    getViewerUserId: async () => viewerUserId,
    fetchFreshViewerUserId: async () => viewerUserId,
    hasNotificationPermission: async () => {
      announcePermission();
      return delayedPermission;
    },
    clearNotification: async (scheduleId, revision) => {
      exactClears.push({ scheduleId, revision });
      return true;
    }
  });
  const action = hooks.handleNotificationButton(notificationId, 1);
  await permissionStarted;
  viewerUserId = ACCOUNT_B;
  releasePermission(true);
  assert.equal(await action, false);
  const stored = (await hooks.readState(ACCOUNT_A)).schedules[0];
  assert.equal(stored.status, "pending");
  assert.deepEqual(exactClears, [{
    scheduleId: schedule.id,
    revision: schedule.revision
  }]);
});

const schedulerNotificationSource = backgroundSource.slice(
  backgroundSource.indexOf("async function createJoinSchedulerNotification"),
  backgroundSource.indexOf("async function clearJoinSchedulerAlarm")
);
assert.match(
  schedulerNotificationSource,
  /buttons:\s*\[\{\s*title:\s*"Join now"\s*\},\s*\{\s*title:\s*"Remove"\s*\}\]/,
  "the notification uses the same one-step Remove wording as the menu"
);
assert.doesNotMatch(schedulerNotificationSource, /title:\s*"Cancel"/);

const notificationButtonSource = backgroundSource.slice(
  backgroundSource.indexOf("async function handleJoinSchedulerNotificationButtonClicked"),
  backgroundSource.indexOf("async function handleJoinSchedulerNotificationClicked")
);
assert.match(
  notificationButtonSource,
  /getJoinSchedulerScheduleOwner\(scheduleId, revision\)[\s\S]*?hasJoinSchedulerNotificationAuthority\(schedule\.accountId\)[\s\S]*?buttonIndex === 1[\s\S]*?deleteOwnedJoinSchedulerSchedule\(\s*schedule\.accountId,\s*scheduleId,\s*revision\s*\)/,
  "notification Remove preserves exact owner, authority, and revision checks"
);
assert.doesNotMatch(notificationButtonSource, /cancelOwnedJoinSchedulerSchedule/);

test("notification buttons provide explicit Join and Remove actions", async () => {
  resetFixture();
  let schedule = await createSchedule({ mode: "notify", autoJoinConsent: false });
  now = schedule.startAt - constants.notificationLeadMs;
  await hooks.runCoordinator(now);
  const notificationId = hooks.getNotificationId(schedule.id, schedule.revision);
  assert.equal(await hooks.handleNotificationButton(notificationId, 0), true);
  assert.equal(launchCalls.length, 1);
  assert.equal((await hooks.readState(ACCOUNT_A)).schedules[0].status, "completed");

  resetFixture();
  schedule = await createSchedule({ mode: "notify", autoJoinConsent: false });
  now = schedule.startAt - constants.notificationLeadMs;
  await hooks.runCoordinator(now);
  const notificationClearsBeforeRemove = clearedNotifications.length;
  const alarmClearsBeforeRemove = clearedAlarms;
  assert.equal(await hooks.handleNotificationButton(
    hooks.getNotificationId(schedule.id, schedule.revision),
    1
  ), true);
  const removedState = await hooks.readState(ACCOUNT_A);
  assert.equal(removedState.schedules.length, 0,
    "notification Remove must not leave a canceled row to delete later");
  assert.equal(removedState.destinations.length, 0);
  assert.deepEqual(
    clearedNotifications.slice(notificationClearsBeforeRemove),
    [schedule.id]
  );
  assert.ok(clearedAlarms > alarmClearsBeforeRemove);
  assert.equal(launchCalls.length, 0);
  assert.equal(await hooks.handleNotificationButton("unrelated", 0), false);
});

test("notification actions are scoped to the exact schedule revision", async () => {
  resetFixture();
  const original = await createSchedule({ mode: "notify", autoJoinConsent: false });
  const oldNotificationId = hooks.getNotificationId(
    original.id,
    original.revision
  );
  const edited = await hooks.createSchedule(createSchedulePayload({
    requestId: 301,
    scheduleId: original.id,
    expectedRevision: original.revision,
    startAt: original.startAt + 10 * 60_000,
    title: "Updated Reminder",
    mode: "notify",
    autoJoinConsent: false,
    allowSwitch: false
  }));
  const newNotificationId = hooks.getNotificationId(
    edited.schedule.id,
    edited.schedule.revision
  );
  assert.notEqual(oldNotificationId, newNotificationId);
  assert.equal(await hooks.handleNotificationButton(oldNotificationId, 1), false);
  const stored = (await hooks.readState(ACCOUNT_A)).schedules[0];
  assert.equal(stored.status, "pending");
  assert.equal(stored.revision, edited.schedule.revision);
  assert.equal(stored.title, "Updated Reminder");
});

(async () => {
  const failures = [];
  for (const { name, run } of tests) {
    try {
      await run();
      console.log(`PASS ${name}`);
    } catch (error) {
      console.error(`FAIL ${name}`);
      console.error(error);
      failures.push({ name, error });
    }
  }
  if (failures.length > 0) {
    throw new Error(`${failures.length} of ${tests.length} Join Scheduler tests failed`);
  }
  console.log(`PASS ${tests.length} Join Scheduler background contract tests`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
