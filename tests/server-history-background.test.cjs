"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

const projectRoot = path.resolve(__dirname, "..");
const backgroundSource = fs.readFileSync(
  path.join(projectRoot, "background.js"),
  "utf8"
);

const featureSettings = {
  version: 1,
  flags: { gameCcuHoverGraph: false, serverHistory: false }
};
const storageData = { rslFeatureSettingsV1: featureSettings };
const alarmCreates = [];
const alarmClears = [];
const alarmGets = [];
const deferredAlarmGetCallbacks = [];
const fetchCalls = [];
const launchCalls = [];
let alarmListener = null;
let runtimeMessageListener = null;
let deferAlarmGet = false;
let backgroundSetTimeout = (callback, delay, ...args) =>
  setTimeout(callback, delay, ...args);
let fetchHandler = async () => {
  throw new Error("Unexpected network request in Server History fixture");
};

function plain(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function makeStorageArea(data) {
  return {
    get(keys, callback) {
      let result;
      if (keys === null || keys === undefined) {
        result = { ...data };
      } else if (typeof keys === "string") {
        result = { [keys]: data[keys] };
      } else if (Array.isArray(keys)) {
        result = Object.fromEntries(keys.map((key) => [key, data[key]]));
      } else {
        result = { ...keys };
        for (const key of Object.keys(keys)) {
          if (Object.hasOwn(data, key)) result[key] = data[key];
        }
      }
      callback?.(result);
      return Promise.resolve(result);
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

const chrome = {
  runtime: {
    id: "server-history-fixture",
    lastError: null,
    onInstalled: { addListener() {} },
    onStartup: { addListener() {} },
    onMessage: {
      addListener(listener) {
        runtimeMessageListener = listener;
      }
    }
  },
  storage: {
    local: makeStorageArea(storageData),
    session: makeStorageArea({}),
    onChanged: { addListener() {} }
  },
  alarms: {
    create(name, options) {
      alarmCreates.push({ name, options: plain(options) });
    },
    get(name, callback) {
      alarmGets.push(name);
      if (deferAlarmGet) {
        deferredAlarmGetCallbacks.push(callback);
        return;
      }
      callback(null);
    },
    clear(name, callback) {
      alarmClears.push(name);
      callback?.(true);
      return Promise.resolve(true);
    },
    onAlarm: {
      addListener(listener) {
        alarmListener = listener;
      }
    }
  },
  contextMenus: {
    create(_details, callback) { callback?.(); },
    removeAll(callback) { callback?.(); },
    onClicked: { addListener() {} }
  },
  scripting: {
    async executeScript(details) {
      launchCalls.push({
        target: plain(details.target),
        world: details.world,
        args: plain(details.args)
      });
      return [{ frameId: 0, result: "started" }];
    }
  },
  tabs: { sendMessage() {} }
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
  console,
  chrome,
  crypto: webcrypto,
  fetch: async (input, options = {}) => {
    fetchCalls.push({ url: String(input), options: plain(options) });
    return fetchHandler(input, options);
  },
  setTimeout: (callback, delay, ...args) =>
    backgroundSetTimeout(callback, delay, ...args),
  clearTimeout,
  queueMicrotask,
  __rslBackgroundTestHooks: {},
  globalThis: null
};
sandbox.globalThis = sandbox;
vm.runInContext(backgroundSource, vm.createContext(sandbox), {
  filename: "background.js"
});

const hooks = sandbox.__rslBackgroundTestHooks;
const constants = hooks.serverHistoryConstants;
const NOW = 1_700_000_000_000;
const JOB_A = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const JOB_B = "11111111-2222-4333-8444-555555555555";
const JOB_C = "99999999-aaaa-4bbb-8ccc-dddddddddddd";

const exactRejoinSource = backgroundSource.slice(
  backgroundSource.indexOf("async function executeServerHistoryRejoin("),
  backgroundSource.indexOf("function handleRejoinServerHistoryMessage(")
);
assert.match(exactRejoinSource, /joinGameInstance/);
assert.doesNotMatch(
  exactRejoinSource,
  /location\.(?:assign|href)|roblox-player:|URLSearchParams/,
  "Server History must fail closed instead of falling back to an inexact deep link"
);

function sample(jobId = JOB_A, placeId = "1001", name = "Fixture Game") {
  return {
    kind: "in-game",
    placeId,
    universeId: "2001",
    rootPlaceId: "1001",
    gameInstanceId: jobId,
    lastLocation: name
  };
}

function storedSession(overrides = {}) {
  return {
    sessionId: "opaque_session_1",
    placeId: "1001",
    universeId: "2001",
    rootPlaceId: "1001",
    gameInstanceId: JOB_A,
    lastLocation: "Fixture Game",
    firstSeenAt: NOW,
    lastSeenAt: NOW + 60_000,
    observationCount: 2,
    isOpen: false,
    endedAt: NOW + 60_000,
    endReason: "left",
    ...overrides
  };
}

function emptyStorage() {
  return { version: constants.storageVersion, accounts: {} };
}

function memoryStorage(initial = emptyStorage()) {
  let value = plain(initial);
  let writes = 0;
  hooks.setServerHistoryStorageOverrideForTests({
    async read() { return plain(value); },
    async write(nextValue) {
      writes += 1;
      value = plain(nextValue);
    }
  });
  return {
    read: () => plain(value),
    writes: () => writes
  };
}

function trustedSender(overrides = {}) {
  return {
    id: chrome.runtime.id,
    frameId: 0,
    url: "https://www.roblox.com/home",
    tab: { id: 17, url: "https://www.roblox.com/home" },
    ...overrides
  };
}

function jsonResponse(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}

async function waitUntil(predicate, message, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail(message);
}

async function invokeHandler(handler, message, sender = trustedSender()) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) reject(new Error(`Handler timed out: ${message.type}`));
    }, 2_000);
    const sendResponse = (response) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(plain(response));
    };
    try {
      handler(message, sender, sendResponse);
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

function resetFixture() {
  hooks.resetServerHistoryStateForTests();
  backgroundSetTimeout = (callback, delay, ...args) =>
    setTimeout(callback, delay, ...args);
  alarmCreates.length = 0;
  alarmClears.length = 0;
  alarmGets.length = 0;
  deferredAlarmGetCallbacks.length = 0;
  deferAlarmGet = false;
  fetchCalls.length = 0;
  launchCalls.length = 0;
  delete storageData[constants.storageKey];
  fetchHandler = async () => {
    throw new Error("Unexpected network request in Server History fixture");
  };
}

const tests = [];
function test(name, run) {
  tests.push({ name, run });
}

test("Server History is strict opt-in and registers a one-minute alarm", async () => {
  assert.equal(constants.featureKey, "serverHistory");
  assert.equal(constants.alarmPeriodMinutes, 1);
  assert.equal(constants.maxSessions, 30);
  assert.equal(constants.continuityGapMs, 3 * 60_000);
  assert.equal(constants.placeNameLookupConcurrency, 6);
  assert.equal(constants.placeNameLookupDeadlineMs, 4_000);
  assert.equal(hooks.getServerHistoryFeatureValue(null), false);
  assert.equal(hooks.getServerHistoryFeatureValue({ version: 1, flags: {} }), false);
  assert.equal(
    hooks.getServerHistoryFeatureValue({ version: 2, flags: { serverHistory: true } }),
    false
  );
  assert.equal(
    hooks.getServerHistoryFeatureValue({ version: 1, flags: { serverHistory: true } }),
    true
  );
  assert.equal(fetchCalls.length, 0, "default-off startup must not poll presence");
  hooks.setServerHistoryFeatureStateForTests(false, true);
  assert.deepEqual(plain(await hooks.getServerHistoryResponse(90)), {
    ok: true,
    requestId: 90,
    enabled: false,
    sessions: []
  });

  fetchHandler = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "users.roblox.com") return jsonResponse({ id: 777 });
    if (url.hostname === "presence.roblox.com") {
      return jsonResponse({
        userPresences: [{
          userId: 777,
          userPresenceType: 2,
          placeId: 1001,
          universeId: 2001,
          rootPlaceId: 1001,
          gameId: JOB_A,
          lastLocation: "Enabled immediately"
        }]
      });
    }
    throw new Error(`Unexpected URL ${url}`);
  };
  hooks.applyServerHistoryFeatureValue(
    { version: 1, flags: { serverHistory: true } },
    true
  );
  await waitUntil(
    () => storageData[constants.storageKey]?.accounts?.["777"]?.sessions?.length === 1,
    "enabling Server History did not immediately record a presence sample"
  );
  assert.ok(
    alarmCreates.some(({ name, options }) =>
      name === constants.alarmName && options.periodInMinutes === 1
    ),
    "enabled tracking must schedule its one-minute alarm"
  );
  assert.ok(fetchCalls.some(({ url }) => url.includes("presence.roblox.com")));

  hooks.applyServerHistoryFeatureValue(
    { version: 1, flags: { serverHistory: false } },
    true
  );
  assert.ok(alarmClears.includes(constants.alarmName));
  assert.equal(hooks.getServerHistoryStateForTests().featureEnabled, false);
});

test("a pending alarm lookup cannot recreate tracking after opt-out", () => {
  hooks.setServerHistoryFeatureStateForTests(true, true);
  deferAlarmGet = true;
  hooks.ensureServerHistoryAlarm();
  assert.deepEqual(alarmGets, [constants.alarmName]);
  assert.equal(alarmCreates.length, 0);
  assert.equal(deferredAlarmGetCallbacks.length, 1);

  hooks.applyServerHistoryFeatureValue(
    { version: 1, flags: { serverHistory: false } },
    false
  );
  assert.equal(hooks.getServerHistoryStateForTests().featureEnabled, false);
  assert.ok(alarmClears.includes(constants.alarmName));

  deferredAlarmGetCallbacks.shift()(null);
  assert.equal(
    alarmCreates.length,
    0,
    "the stale chrome.alarms.get callback must recheck generation and enabled state"
  );
});

test("the alarm performs the same isolated poll while enabled", async () => {
  const memory = memoryStorage();
  hooks.setServerHistoryFeatureStateForTests(true, true);
  fetchHandler = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "users.roblox.com") return jsonResponse({ id: 888 });
    if (url.hostname === "presence.roblox.com") {
      return jsonResponse({
        userPresences: [{
          userId: 888,
          userPresenceType: 2,
          placeId: 3001,
          universeId: 3002,
          gameId: JOB_B,
          lastLocation: "Alarm Game"
        }]
      });
    }
    throw new Error(`Unexpected URL ${url}`);
  };
  assert.equal(typeof alarmListener, "function");
  alarmListener({ name: constants.alarmName });
  await waitUntil(
    () => memory.read().accounts?.["888"]?.sessions?.length === 1,
    "one-minute alarm did not collect Server History"
  );
  assert.equal(memory.read().accounts["888"].sessions[0].placeId, "3001");
});

test("same-server samples update one session and server changes split it", async () => {
  const memory = memoryStorage();
  hooks.setServerHistoryFeatureStateForTests(true, true);
  await hooks.runServerHistoryPoll({
    viewerUserId: "101",
    fetchPresence: async () => sample(JOB_A),
    now: NOW
  });
  await hooks.runServerHistoryPoll({
    viewerUserId: "101",
    fetchPresence: async () => sample(JOB_A, "1001", "Renamed Game"),
    now: NOW + 60_000
  });
  let account = memory.read().accounts["101"];
  assert.equal(account.sessions.length, 1);
  assert.equal(account.sessions[0].firstSeenAt, NOW);
  assert.equal(account.sessions[0].lastSeenAt, NOW + 60_000);
  assert.equal(account.sessions[0].observationCount, 2);
  assert.equal(account.sessions[0].lastLocation, "Renamed Game");
  assert.equal(account.sessions[0].isOpen, true);

  await hooks.runServerHistoryPoll({
    viewerUserId: "101",
    fetchPresence: async () => sample(JOB_B, "1002", "Other Server"),
    now: NOW + 120_000
  });
  account = memory.read().accounts["101"];
  assert.equal(account.sessions.length, 2);
  assert.equal(account.sessions[0].gameInstanceId, JOB_B);
  assert.equal(account.sessions[0].isOpen, true);
  assert.equal(account.sessions[1].gameInstanceId, JOB_A);
  assert.equal(account.sessions[1].isOpen, false);
  assert.equal(account.sessions[1].endReason, "server-changed");
  assert.equal(account.sessions[1].endedAt, NOW + 120_000);
});

test("two explicit non-game samples close a session but one does not", async () => {
  const memory = memoryStorage();
  hooks.setServerHistoryFeatureStateForTests(true, true);
  await hooks.runServerHistoryPoll({
    viewerUserId: "102",
    fetchPresence: async () => sample(),
    now: NOW
  });
  await hooks.runServerHistoryPoll({
    viewerUserId: "102",
    fetchPresence: async () => ({ kind: "not-in-game" }),
    now: NOW + 60_000
  });
  assert.equal(memory.read().accounts["102"].sessions[0].isOpen, true);
  assert.equal(memory.read().accounts["102"].pendingNonGameCount, 1);
  await hooks.runServerHistoryPoll({
    viewerUserId: "102",
    fetchPresence: async () => ({ kind: "not-in-game" }),
    now: NOW + 120_000
  });
  const account = memory.read().accounts["102"];
  assert.equal(account.sessions[0].isOpen, false);
  assert.equal(account.sessions[0].endReason, "left");
  assert.equal(account.sessions[0].endedAt, NOW + 120_000);
  assert.equal(account.pendingNonGameCount, 0);
});

test("network failures preserve the open session and do not fake a leave", async () => {
  const memory = memoryStorage();
  hooks.setServerHistoryFeatureStateForTests(true, true);
  await hooks.runServerHistoryPoll({
    viewerUserId: "103",
    fetchPresence: async () => sample(),
    now: NOW
  });
  const before = memory.read();
  const result = await hooks.runServerHistoryPoll({
    viewerUserId: "103",
    fetchPresence: async () => { throw new Error("offline"); },
    now: NOW + 60_000
  });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "unavailable");
  assert.deepEqual(memory.read(), before);
  assert.equal(memory.read().accounts["103"].sessions[0].isOpen, true);
});

test("concurrent poll triggers share one presence observation and one write", async () => {
  const memory = memoryStorage();
  hooks.setServerHistoryFeatureStateForTests(true, true);
  let presenceCalls = 0;
  let releasePresence;
  const first = hooks.runServerHistoryPoll({
    viewerUserId: "104",
    fetchPresence: async () => {
      presenceCalls += 1;
      return new Promise((resolve) => { releasePresence = resolve; });
    },
    now: NOW
  });
  const second = hooks.runServerHistoryPoll({
    viewerUserId: "104",
    fetchPresence: async () => {
      presenceCalls += 1;
      return sample(JOB_B);
    },
    now: NOW + 1
  });
  await waitUntil(() => typeof releasePresence === "function", "first poll did not start");
  assert.equal(presenceCalls, 1, "overlapping GET/alarm polls must be deduplicated");
  releasePresence(sample(JOB_A));
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(firstResult.ok, true);
  assert.equal(secondResult.ok, true);
  assert.equal(firstResult.viewerUserId, "104");
  assert.equal(secondResult.viewerUserId, "104");
  assert.equal(memory.writes(), 1);
  assert.equal(memory.read().accounts["104"].sessions.length, 1);
  assert.equal(memory.read().accounts["104"].sessions[0].gameInstanceId, JOB_A);
});

test("an observation gap over three minutes creates a new approximate session", () => {
  let account = hooks.reduceServerHistoryAccount(
    null,
    sample(JOB_A),
    NOW,
    () => "first_session"
  );
  account = hooks.reduceServerHistoryAccount(
    account,
    sample(JOB_A),
    NOW + constants.continuityGapMs + 1,
    () => "second_session"
  );
  const normalized = plain(account);
  assert.equal(normalized.sessions.length, 2);
  assert.equal(normalized.sessions[0].sessionId, "second_session");
  assert.equal(normalized.sessions[1].sessionId, "first_session");
  assert.equal(normalized.sessions[1].endReason, "observation-gap");
  assert.equal(normalized.sessions[1].endedAt, NOW);
});

test("history is pruned to the newest 30 sessions", () => {
  let account = null;
  for (let index = 0; index < 35; index += 1) {
    const suffix = index.toString(16).padStart(12, "0");
    account = hooks.reduceServerHistoryAccount(
      account,
      sample(`00000000-0000-4000-8000-${suffix}`, String(5000 + index)),
      NOW + index * 60_000,
      () => `session_${index}`
    );
  }
  const sessions = plain(account.sessions);
  assert.equal(sessions.length, 30);
  assert.equal(sessions[0].sessionId, "session_34");
  assert.equal(sessions.at(-1).sessionId, "session_5");
  assert.equal(sessions.filter(({ isOpen }) => isOpen).length, 1);
});

test("accounts are isolated and clearing one never clears another", async () => {
  const memory = memoryStorage();
  hooks.setServerHistoryFeatureStateForTests(true, true);
  await hooks.runServerHistoryPoll({
    viewerUserId: "201",
    fetchPresence: async () => sample(JOB_A, "2011", "Account One"),
    now: NOW
  });
  await hooks.runServerHistoryPoll({
    viewerUserId: "202",
    fetchPresence: async () => sample(JOB_B, "2021", "Account Two"),
    now: NOW + 60_000
  });
  assert.equal(memory.read().accounts["201"].sessions[0].placeId, "2011");
  assert.equal(memory.read().accounts["202"].sessions[0].placeId, "2021");
  const cleared = await hooks.clearServerHistoryForViewer("201");
  assert.equal(cleared, 1);
  assert.equal(memory.read().accounts["201"], undefined);
  assert.equal(memory.read().accounts["202"].sessions.length, 1);
});

test("disabling tracking invalidates an already-started write", async () => {
  let releaseRead;
  let readStarted = false;
  let writes = 0;
  hooks.setServerHistoryStorageOverrideForTests({
    read() {
      readStarted = true;
      return new Promise((resolve) => { releaseRead = resolve; });
    },
    async write() { writes += 1; }
  });
  hooks.setServerHistoryFeatureStateForTests(true, true);
  const poll = hooks.runServerHistoryPoll({
    viewerUserId: "301",
    fetchPresence: async () => sample(),
    now: NOW
  });
  await waitUntil(() => readStarted, "deferred Server History read never started");
  hooks.invalidateServerHistoryLifecycleForTests();
  releaseRead(emptyStorage());
  const result = await poll;
  await hooks.waitForServerHistoryWritesForTests();
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, "disabled");
  assert.equal(writes, 0, "a late result must not write after opt-out");
});

test("storage validation rejects corrupt IDs and recovers duplicate open sessions", () => {
  assert.equal(hooks.normalizeServerHistoryRequestId(1), 1);
  assert.equal(hooks.normalizeServerHistoryRequestId(0), null);
  assert.equal(hooks.normalizeServerHistoryRequestId("1"), null);
  assert.equal(hooks.normalizeServerHistorySessionId("opaque_OK-1"), "opaque_OK-1");
  for (const bad of [" has-space", "x/y", "<script>", "", "a".repeat(129)]) {
    assert.equal(hooks.normalizeServerHistorySessionId(bad), null);
  }
  assert.equal(hooks.normalizeServerHistoryTimestamp(NOW, NOW), NOW);
  assert.equal(hooks.normalizeServerHistoryTimestamp(NOW + 60_001, NOW), null);
  assert.equal(
    hooks.normalizeStoredServerHistorySession(
      storedSession({ gameInstanceId: "not-a-job-id" }),
      NOW + 120_000
    ),
    null
  );
  assert.equal(
    hooks.normalizeStoredServerHistorySession(
      storedSession({ placeId: "0" }),
      NOW + 120_000
    ),
    null
  );
  const safe = plain(hooks.normalizeStoredServerHistorySession(
    storedSession({
      isOpen: true,
      endedAt: null,
      endReason: null,
      lastLocation: "  Game\n<script>alert(1)</script>  "
    }),
    NOW + 120_000
  ));
  assert.equal(safe.lastLocation, "Game <script>alert(1)</script>");
  assert.doesNotMatch(safe.lastLocation, /[\u0000-\u001f\u007f]/);
  const legacyWithoutRoot = plain(hooks.normalizeStoredServerHistorySession(
    storedSession({ rootPlaceId: undefined, placeName: "must not persist" }),
    NOW + 120_000
  ));
  assert.equal(legacyWithoutRoot.rootPlaceId, null);
  assert.equal(
    Object.hasOwn(legacyWithoutRoot, "placeName"),
    false,
    "current Place names are response enrichment, not a storage migration"
  );

  const recovered = plain(hooks.normalizeStoredServerHistoryAccount({
    sessions: [
      storedSession({
        sessionId: "new_open",
        firstSeenAt: NOW + 30_000,
        lastSeenAt: NOW + 60_000,
        isOpen: true,
        endedAt: null,
        endReason: null
      }),
      storedSession({
        sessionId: "old_open",
        firstSeenAt: NOW,
        lastSeenAt: NOW + 10_000,
        isOpen: true,
        endedAt: null,
        endReason: null
      }),
      { broken: true }
    ],
    pendingNonGameCount: 99,
    updatedAt: NOW
  }, NOW + 120_000));
  assert.equal(recovered.sessions.length, 2);
  assert.equal(recovered.sessions.filter(({ isOpen }) => isOpen).length, 1);
  assert.equal(recovered.sessions[1].endReason, "recovered");
  assert.equal(recovered.pendingNonGameCount, 0);
  assert.deepEqual(
    plain(hooks.normalizeServerHistoryStorage({ version: 999, accounts: {} }, NOW)),
    emptyStorage()
  );

  const manyAccounts = { version: constants.storageVersion, accounts: {} };
  for (let index = 1; index <= constants.maxAccounts + 3; index += 1) {
    manyAccounts.accounts[String(index)] = {
      sessions: [],
      updatedAt: NOW - index
    };
  }
  const normalizedAccounts = plain(hooks.normalizeServerHistoryStorage(manyAccounts, NOW));
  assert.equal(Object.keys(normalizedAccounts.accounts).length, constants.maxAccounts);
  assert.equal(Object.hasOwn(normalizedAccounts.accounts, "1"), true);
  assert.equal(Object.hasOwn(normalizedAccounts.accounts, String(constants.maxAccounts + 3)), false);
});

test("presence accepts only an exact in-game user/place/job sample", () => {
  const valid = plain(hooks.normalizeServerHistoryPresence({
    userId: 501,
    userPresenceType: 2,
    placeId: 1001,
    universeId: 2001,
    gameId: JOB_A,
    lastLocation: "  Normalized   name "
  }, "501"));
  assert.equal(valid.kind, "in-game");
  assert.equal(valid.gameInstanceId, JOB_A);
  assert.equal(valid.lastLocation, "Normalized name");
  for (const invalid of [
    { userId: 999, userPresenceType: 2, placeId: 1, gameId: JOB_A },
    { userId: 501, userPresenceType: 1, placeId: 1, gameId: JOB_A },
    { userId: 501, userPresenceType: 2, placeId: 0, gameId: JOB_A },
    { userId: 501, userPresenceType: 2, placeId: 1, gameId: "bad" }
  ]) {
    assert.equal(
      plain(hooks.normalizeServerHistoryPresence(invalid, "501")).kind,
      "not-in-game"
    );
  }
});

test("localized experience metadata follows a validated page locale", async () => {
  assert.equal(constants.fallbackLocale, "en-US");
  assert.equal(hooks.normalizeServerHistoryLocale("de-DE"), "de-DE");
  assert.equal(hooks.normalizeServerHistoryLocale("EN_us"), "en-US");
  assert.equal(hooks.normalizeServerHistoryLocale("zh_hans_cn"), "zh-Hans-CN");
  for (const invalid of [
    "",
    " ",
    "e",
    "de DE",
    "de/DE",
    "de-DE\r\nX-Test: injected",
    "*",
    "a".repeat(129)
  ]) {
    assert.equal(
      hooks.normalizeServerHistoryLocale(invalid),
      "en-US",
      `unsafe locale must fall back: ${JSON.stringify(invalid)}`
    );
  }

  fetchHandler = async (input, options) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "games.roblox.com");
    assert.equal(url.pathname, "/v1/games");
    assert.equal(url.searchParams.get("universeIds"), "66654135");
    assert.equal(options.credentials, "omit");
    assert.equal(options.headers["Accept-Language"], "en-US");
    return jsonResponse({
      data: [{
        id: 66654135,
        rootPlaceId: 142823291,
        name: "Murder Mystery 2"
      }]
    });
  };
  const details = await hooks.fetchServerHistoryExperienceDetails(
    ["66654135", "66654135"],
    "en_US"
  );
  assert.equal(fetchCalls.length, 1);
  assert.deepEqual(plain(details.get("66654135")), {
    experienceName: "Murder Mystery 2",
    rootPlaceId: "142823291"
  });

  const responseSession = plain(hooks.sanitizeServerHistorySessionForResponse(
    storedSession({
      placeId: "142823292",
      universeId: "66654135",
      rootPlaceId: "142823290",
      lastLocation: "Mordgeheimnis 2"
    }),
    details.get("66654135"),
    { placeName: "Trade Plaza" }
  ));
  assert.equal(
    responseSession.experienceName,
    "Murder Mystery 2",
    "Games metadata must override a previously stored localized Presence title"
  );
  assert.equal(
    responseSession.rootPlaceId,
    "142823290",
    "the root observed with the saved session must win over current Games metadata"
  );
  assert.equal(responseSession.placeName, "Trade Plaza");
  const recoveredRoot = plain(hooks.sanitizeServerHistorySessionForResponse(
    storedSession({
      placeId: "142823292",
      universeId: "66654135",
      rootPlaceId: null
    }),
    details.get("66654135"),
    null
  ));
  assert.equal(
    recoveredRoot.rootPlaceId,
    "142823291",
    "current Games metadata may recover a root missing from a legacy session"
  );
  assert.equal(recoveredRoot.placeName, null);
  assert.deepEqual(Object.keys(responseSession).sort(), [
    "experienceName",
    "firstSeenAt",
    "lastSeenAt",
    "placeId",
    "placeName",
    "rootPlaceId",
    "sessionId",
    "universeId"
  ]);
  for (const privateField of [
    "endedAt",
    "observationCount",
    "isCurrent",
    "endReason",
    "gameInstanceId",
    "jobId",
    "lastLocation",
    "viewerUserId",
    "placeKind"
  ]) {
    assert.equal(Object.hasOwn(responseSession, privateField), false);
  }
});

test("Place-name enrichment is anonymous, deduplicated, and cache-backed", async () => {
  fetchHandler = async (input, options) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "economy.roblox.com");
    assert.match(url.pathname, /^\/v2\/assets\/[1-9]\d*\/details$/);
    assert.equal(options.credentials, "omit");
    assert.equal(options.cache, "no-store");
    assert.equal(options.headers.Accept, "application/json");
    const placeId = url.pathname.split("/").at(-2);
    return jsonResponse({
      AssetId: Number(placeId),
      AssetTypeId: 9,
      Name: placeId === "83001" ? "  Trade\n Plaza  " : "Teleport Hub"
    });
  };
  const sessions = [
    storedSession({ placeId: "83001", rootPlaceId: "83000" }),
    storedSession({ sessionId: "duplicate_place", placeId: "83001", rootPlaceId: "83000" }),
    storedSession({ sessionId: "main_place", placeId: "83000", rootPlaceId: "83000" }),
    storedSession({ sessionId: "legacy_place", placeId: "83002", rootPlaceId: null })
  ];
  const details = await hooks.fetchServerHistoryPlaceDetails(sessions);
  assert.deepEqual(
    [...details.entries()].map(([placeId, value]) => [placeId, plain(value)]),
    [
      ["83001", { placeName: "Trade Plaza" }],
      ["83002", { placeName: "Teleport Hub" }]
    ]
  );
  assert.equal(fetchCalls.length, 2, "duplicates and known Main places must not be fetched");

  const cached = await hooks.fetchServerHistoryPlaceDetails(sessions);
  assert.deepEqual(
    [...cached.entries()].map(([placeId, value]) => [placeId, plain(value)]),
    [...details.entries()].map(([placeId, value]) => [placeId, plain(value)])
  );
  assert.equal(fetchCalls.length, 2, "the shared asset-details cache must prevent repeat reads");
});

test("Place-name enrichment rejects malformed assets and recovers after failure", async () => {
  let unavailableCalls = 0;
  fetchHandler = async (input) => {
    const url = new URL(String(input));
    const placeId = url.pathname.split("/").at(-2);
    if (placeId === "83101") {
      return jsonResponse({ AssetId: 99999, AssetTypeId: 9, Name: "Wrong ID" });
    }
    if (placeId === "83102") {
      return jsonResponse({ AssetId: 83102, AssetTypeId: 10, Name: "Not a Place" });
    }
    if (placeId === "83103") {
      return jsonResponse({ AssetId: 83103, AssetTypeId: 9, Name: " \n\t " });
    }
    if (placeId === "83104") {
      return jsonResponse({ AssetId: 83104, AssetTypeId: 9, Name: "x".repeat(101) });
    }
    if (placeId === "83105") {
      unavailableCalls += 1;
      return unavailableCalls === 1
        ? jsonResponse({ errors: [{ message: "missing" }] }, 404)
        : jsonResponse({ AssetId: 83105, AssetTypeId: 9, Name: "Recovered Place" });
    }
    if (placeId === "83106") {
      return jsonResponse({ assetId: 83106, assetTypeId: 9, name: "Valid Place" });
    }
    throw new Error(`Unexpected Place lookup ${url}`);
  };
  const malformed = ["83101", "83102", "83103", "83104", "83105", "83106"]
    .map((placeId, index) => storedSession({
      sessionId: `malformed_${index}`,
      placeId,
      rootPlaceId: "83000"
    }));
  const first = await hooks.fetchServerHistoryPlaceDetails(malformed);
  assert.deepEqual(
    [...first.entries()].map(([placeId, value]) => [placeId, plain(value)]),
    [["83106", { placeName: "Valid Place" }]],
    "mismatched IDs, non-Place assets, unsafe names, and failures must keep the ID fallback"
  );
  assert.equal(unavailableCalls, 1);

  const recovered = await hooks.fetchServerHistoryPlaceDetails([
    storedSession({ placeId: "83105", rootPlaceId: "83000" })
  ]);
  assert.deepEqual(plain(recovered.get("83105")), { placeName: "Recovered Place" });
  assert.equal(unavailableCalls, 2, "failed cache entries must be retried later");
});

test("Place-name enrichment enforces its six-request concurrency bound", async () => {
  let active = 0;
  let peak = 0;
  const releases = [];
  fetchHandler = (input) => {
    const url = new URL(String(input));
    const placeId = url.pathname.split("/").at(-2);
    active += 1;
    peak = Math.max(peak, active);
    return new Promise((resolve) => {
      releases.push(() => {
        active -= 1;
        resolve(jsonResponse({
          AssetId: Number(placeId),
          AssetTypeId: 9,
          Name: `Place ${placeId}`
        }));
      });
    });
  };
  const sessions = Array.from({ length: 8 }, (_, index) => storedSession({
    sessionId: `concurrency_${index}`,
    placeId: String(83201 + index),
    rootPlaceId: "83200"
  }));
  const lookup = hooks.fetchServerHistoryPlaceDetails(sessions);
  await waitUntil(
    () => releases.length === constants.placeNameLookupConcurrency,
    "the initial Place lookup workers did not start"
  );
  assert.equal(active, 6);
  assert.equal(peak, 6);
  releases.slice(0, 6).forEach((release) => release());
  await waitUntil(() => releases.length === 8, "queued Place lookups did not start");
  releases.slice(6).forEach((release) => release());
  const details = await lookup;
  assert.equal(details.size, 8);
  assert.equal(peak, constants.placeNameLookupConcurrency);
});

test("Place-name deadline returns an immutable snapshot while late work warms cache", async () => {
  let releaseLookup = null;
  backgroundSetTimeout = (callback, delay, ...args) =>
    setTimeout(
      callback,
      delay === constants.placeNameLookupDeadlineMs ? 0 : delay,
      ...args
    );
  fetchHandler = (input) => {
    const url = new URL(String(input));
    const placeId = url.pathname.split("/").at(-2);
    return new Promise((resolve) => {
      releaseLookup = () => resolve(jsonResponse({
        AssetId: Number(placeId),
        AssetTypeId: 9,
        Name: "Late Place"
      }));
    });
  };
  const session = storedSession({ placeId: "83301", rootPlaceId: "83300" });
  const timedOut = await hooks.fetchServerHistoryPlaceDetails([session]);
  assert.equal(timedOut.size, 0, "the response must not wait past its enrichment deadline");
  assert.equal(typeof releaseLookup, "function");
  assert.equal(fetchCalls.length, 1);

  releaseLookup();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const warmed = await hooks.fetchServerHistoryPlaceDetails([session]);
  assert.deepEqual(plain(warmed.get("83301")), { placeName: "Late Place" });
  assert.equal(fetchCalls.length, 1, "late completion should warm the shared cache");
  assert.equal(
    timedOut.size,
    0,
    "late completion must not mutate the Map snapshot already returned to the dialog"
  );
});

test("Presence title fallback is requested in deterministic English", async () => {
  fetchHandler = async (input, options) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "presence.roblox.com");
    assert.equal(options.credentials, "include");
    assert.equal(options.headers["Accept-Language"], "en-US");
    assert.deepEqual(JSON.parse(options.body), { userIds: [501] });
    return jsonResponse({
      userPresences: [{
        userId: 501,
        userPresenceType: 2,
        placeId: 1001,
        universeId: 2001,
        rootPlaceId: 1001,
        gameId: JOB_A,
        lastLocation: "Murder Mystery 2"
      }]
    });
  };
  const presence = plain(await hooks.fetchServerHistoryPresence("501"));
  assert.equal(presence.kind, "in-game");
  assert.equal(presence.lastLocation, "Murder Mystery 2");
  assert.equal(fetchCalls.length, 1);
});

test("Server History has no player/status lookup or public-server-list path", () => {
  const implementationStart = backgroundSource.indexOf(
    "function getServerHistoryFeatureValue("
  );
  const implementationEnd = backgroundSource.indexOf(
    "function normalizePrivateServerPlaceId(",
    implementationStart
  );
  assert.notEqual(implementationStart, -1);
  assert.notEqual(implementationEnd, -1);
  const implementation = backgroundSource.slice(
    implementationStart,
    implementationEnd
  );
  assert.doesNotMatch(implementation, /\/servers\/Public/);
  assert.doesNotMatch(
    implementation,
    /check-server-history-status|scanServerHistoryPublicServers|checkServerHistoryStatus|handleCheckServerHistoryStatusMessage|playing|maxPlayers/
  );
  assert.equal(Object.hasOwn(constants, "statusMessageType"), false);
  assert.equal(Object.hasOwn(hooks, "scanServerHistoryPublicServers"), false);
  assert.equal(Object.hasOwn(hooks, "checkServerHistoryStatus"), false);
  assert.equal(Object.hasOwn(hooks, "handleCheckServerHistoryStatusMessage"), false);
  assert.equal(
    (backgroundSource.match(/\/servers\/Public/g) || []).length,
    1,
    "the unrelated Random Server feature should be the sole public-list consumer"
  );
});

test("message handlers require trusted top-frame Roblox senders and strict requests", async () => {
  const invalidRequest = await invokeHandler(
    hooks.handleGetServerHistoryMessage,
    { type: constants.getMessageType, requestId: "1" }
  );
  assert.deepEqual(invalidRequest, { ok: false, requestId: 0, errorCode: "invalid" });
  const childFrame = await invokeHandler(
    hooks.handleGetServerHistoryMessage,
    { type: constants.getMessageType, requestId: 1 },
    trustedSender({ frameId: 2 })
  );
  assert.equal(childFrame.errorCode, "invalid");
  const evilPage = await invokeHandler(
    hooks.handleGetServerHistoryMessage,
    { type: constants.getMessageType, requestId: 2 },
    trustedSender({
      url: "https://www.roblox.com.evil.example/home",
      tab: { id: 17, url: "https://www.roblox.com.evil.example/home" }
    })
  );
  assert.equal(evilPage.errorCode, "invalid");
  const missingClearGuard = await invokeHandler(
    hooks.handleClearServerHistoryMessage,
    { type: constants.clearMessageType, requestId: 4 }
  );
  assert.deepEqual(missingClearGuard, {
    ok: false,
    requestId: 4,
    errorCode: "invalid"
  });
  assert.equal(
    hooks.handleRuntimeMessage(
      { type: constants.getMessageType, requestId: 4 },
      { ...trustedSender(), id: "other-extension" },
      () => assert.fail("untrusted extension should not receive a response")
    ),
    false
  );
  assert.equal(typeof runtimeMessageListener, "function");
});

test("clear and rejoin resolve only the signed-in account's owned opaque session", async () => {
  const memory = memoryStorage({
    version: constants.storageVersion,
    accounts: {
      "701": {
        sessions: [storedSession({
          sessionId: "owned_opaque",
          placeId: "1002",
          rootPlaceId: "1001"
        })],
        pendingNonGameCount: 0,
        trackingState: "not-in-game",
        lastCheckedAt: NOW,
        updatedAt: NOW
      },
      "702": {
        sessions: [storedSession({
          sessionId: "other_account",
          placeId: "9999",
          gameInstanceId: JOB_C
        })],
        pendingNonGameCount: 0,
        trackingState: "not-in-game",
        lastCheckedAt: NOW,
        updatedAt: NOW
      }
    }
  });
  hooks.setServerHistoryFeatureStateForTests(true, true);
  fetchHandler = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "users.roblox.com") return jsonResponse({ id: 701 });
    throw new Error(`Unexpected URL ${url}`);
  };

  assert.equal(launchCalls.length, 0, "history must never launch a server automatically");
  hooks.setServerHistoryFeatureStateForTests(false, true);
  const disabled = await invokeHandler(
    hooks.handleRejoinServerHistoryMessage,
    { type: constants.rejoinMessageType, requestId: 9, sessionId: "owned_opaque" }
  );
  assert.deepEqual(disabled, {
    ok: false,
    requestId: 9,
    sessionId: "owned_opaque",
    errorCode: "disabled"
  });
  hooks.setServerHistoryFeatureStateForTests(true, true);
  const missing = await invokeHandler(
    hooks.handleRejoinServerHistoryMessage,
    { type: constants.rejoinMessageType, requestId: 10, sessionId: "other_account" }
  );
  assert.deepEqual(missing, {
    ok: false,
    requestId: 10,
    sessionId: "other_account",
    errorCode: "not-found"
  });
  assert.equal(launchCalls.length, 0);

  const rejoined = await invokeHandler(
    hooks.handleRejoinServerHistoryMessage,
    {
      type: constants.rejoinMessageType,
      requestId: 11,
      sessionId: "owned_opaque",
      placeId: "1001",
      rootPlaceId: "1001",
      gameInstanceId: JOB_C
    }
  );
  assert.deepEqual(rejoined, {
    ok: true,
    requestId: 11,
    sessionId: "owned_opaque"
  });
  assert.equal(launchCalls.length, 1);
  assert.deepEqual(launchCalls[0], {
    target: { tabId: 17, frameIds: [0] },
    world: "MAIN",
    args: [1002, JOB_A]
  });

  const accountChanged = await invokeHandler(
    hooks.handleClearServerHistoryMessage,
    {
      type: constants.clearMessageType,
      requestId: 12,
      expectedSessionId: "other_account"
    }
  );
  assert.deepEqual(accountChanged, {
    ok: false,
    requestId: 12,
    errorCode: "account-changed"
  });
  assert.equal(memory.read().accounts["701"].sessions.length, 1);
  assert.equal(memory.read().accounts["702"].sessions.length, 1);

  const cleared = await invokeHandler(
    hooks.handleClearServerHistoryMessage,
    {
      type: constants.clearMessageType,
      requestId: 13,
      expectedSessionId: "owned_opaque"
    }
  );
  assert.deepEqual(cleared, { ok: true, requestId: 13, cleared: 1 });
  assert.equal(memory.read().accounts["701"], undefined);
  assert.equal(memory.read().accounts["702"].sessions[0].sessionId, "other_account");
});

(async () => {
  for (const { name, run } of tests) {
    resetFixture();
    try {
      await run();
    } catch (error) {
      error.message = `${name}: ${error.message}`;
      throw error;
    }
  }
  console.log(`PASS Server History background state, storage, locale, and trust (${tests.length} cases)`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
