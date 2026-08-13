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
  setTimeout,
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

test("public status scan checks Desc then Asc edges and finds an exact UUID", async () => {
  let request = 0;
  fetchHandler = async () => {
    request += 1;
    return request === 1
      ? jsonResponse({ data: [{ id: JOB_B, playing: 3, maxPlayers: 20 }], nextPageCursor: "capped" })
      : jsonResponse({ data: [{ id: JOB_A.toUpperCase(), playing: 7, maxPlayers: 12 }], nextPageCursor: null });
  };
  const result = plain(await hooks.scanServerHistoryPublicServers(storedSession({ isOpen: true })));
  assert.deepEqual(result, {
    status: "active",
    playing: 7,
    maxPlayers: 12,
    source: "public-server-list",
    reason: null
  });
  assert.equal(fetchCalls.length, 2);
  const firstUrl = new URL(fetchCalls[0].url);
  assert.equal(firstUrl.pathname, "/v1/games/1001/servers/Public");
  assert.equal(firstUrl.searchParams.get("limit"), "100");
  assert.equal(firstUrl.searchParams.get("excludeFullGames"), "false");
  assert.equal(firstUrl.searchParams.get("sortOrder"), "Desc");
  assert.equal(firstUrl.searchParams.has("cursor"), false);
  assert.equal(fetchCalls[0].options.credentials, "include");
  const secondUrl = new URL(fetchCalls[1].url);
  assert.equal(secondUrl.searchParams.get("sortOrder"), "Asc");
  assert.equal(secondUrl.searchParams.has("cursor"), false);
  assert.equal(constants.maxServerRequests, 2);
  assert.equal(fetchCalls.length <= constants.maxServerRequests, true);
});

test("an exact live Job match stays active when Roblox omits usable counts", async () => {
  fetchHandler = async () => jsonResponse({
    data: [{ id: JOB_A, playing: "unknown", maxPlayers: null }],
    nextPageCursor: null
  });
  const result = plain(await hooks.scanServerHistoryPublicServers(storedSession()));
  assert.deepEqual(result, {
    status: "active",
    playing: null,
    maxPlayers: null,
    source: "public-server-list",
    reason: null
  });
});

test("status misses, capped lists, rate limits, and failures stay unknown", async () => {
  fetchHandler = async () => jsonResponse({ data: [], nextPageCursor: null });
  let result = plain(await hooks.scanServerHistoryPublicServers(storedSession()));
  assert.equal(result.status, "unknown");
  assert.equal(result.reason, "not-visible");
  assert.equal("ended" in result, false);
  assert.equal(fetchCalls.length, 1, "a complete first edge must stop without a second request");
  assert.equal(new URL(fetchCalls[0].url).searchParams.get("sortOrder"), "Desc");

  let request = 0;
  fetchCalls.length = 0;
  fetchHandler = async () => {
    request += 1;
    return jsonResponse({ data: [], nextPageCursor: `capped-${request}` });
  };
  result = plain(await hooks.scanServerHistoryPublicServers(storedSession()));
  assert.equal(result.status, "unknown");
  assert.equal(result.reason, "list-limited");
  assert.equal(fetchCalls.length, constants.maxServerRequests);
  assert.deepEqual(
    fetchCalls.map(({ url }) => new URL(url).searchParams.get("sortOrder")),
    ["Desc", "Asc"]
  );

  fetchCalls.length = 0;
  fetchHandler = async () => jsonResponse({ errors: [] }, 429, { "Retry-After": "1" });
  result = plain(await hooks.scanServerHistoryPublicServers(storedSession()));
  assert.equal(result.status, "unknown");
  assert.equal(result.reason, "rate-limited");

  fetchHandler = async () => { throw new Error("timeout"); };
  result = plain(await hooks.scanServerHistoryPublicServers(storedSession()));
  assert.equal(result.status, "unknown");
  assert.equal(result.reason, "unavailable");
});

test("current presence can confirm active without inventing a player count", async () => {
  hooks.setServerHistoryFeatureStateForTests(true, true);
  const session = storedSession({ isOpen: true, endedAt: null, endReason: null });
  let scans = 0;
  const status = plain(await hooks.checkServerHistoryStatus("601", session, {
    now: NOW,
    scanPublicServers: async () => {
      scans += 1;
      return { status: "unknown", playing: null, maxPlayers: null, reason: "not-visible" };
    },
    fetchPresence: async () => sample(JOB_A, "1001")
  }));
  assert.deepEqual(status, {
    status: "active",
    playing: null,
    maxPlayers: null,
    checkedAt: NOW,
    source: "current-presence",
    reason: null
  });
  const cached = plain(await hooks.checkServerHistoryStatus("601", session, {
    now: NOW + constants.statusCacheTtlMs,
    scanPublicServers: async () => { scans += 1; throw new Error("must be cached"); },
    fetchPresence: async () => ({ kind: "not-in-game" })
  }));
  assert.deepEqual(cached, status);
  assert.equal(scans, 1);

  const refreshed = plain(await hooks.checkServerHistoryStatus("601", session, {
    now: NOW + constants.statusCacheTtlMs + 1,
    scanPublicServers: async () => {
      scans += 1;
      return { status: "unknown", playing: null, maxPlayers: null, reason: "unavailable" };
    },
    fetchPresence: async () => ({ kind: "not-in-game" })
  }));
  assert.equal(refreshed.status, "unknown");
  assert.equal(refreshed.reason, "unavailable");
  assert.equal(scans, 2);
});

test("forced status checks reuse an identical in-flight scan but bypass its completed cache", async () => {
  hooks.setServerHistoryFeatureStateForTests(true, true);
  const session = storedSession();
  let releaseFirstScan;
  const firstScanGate = new Promise((resolve) => {
    releaseFirstScan = resolve;
  });
  let scans = 0;
  const first = hooks.checkServerHistoryStatus("603", session, {
    now: NOW,
    scanPublicServers: async () => {
      scans += 1;
      await firstScanGate;
      return {
        status: "active",
        playing: 4,
        maxPlayers: 20,
        source: "public-server-list",
        reason: null
      };
    },
    fetchPresence: async () => ({ kind: "not-in-game" })
  });
  await Promise.resolve();
  const overlappingForced = hooks.checkServerHistoryStatus("603", session, {
    now: NOW + 1,
    forceRefresh: true,
    scanPublicServers: async () => {
      scans += 1;
      throw new Error("an in-flight refresh must be reused");
    },
    fetchPresence: async () => ({ kind: "not-in-game" })
  });
  assert.equal(scans, 1);
  releaseFirstScan();
  const [firstResult, overlappingResult] = await Promise.all([
    first,
    overlappingForced
  ]);
  assert.deepEqual(plain(overlappingResult), plain(firstResult));
  assert.equal(scans, 1);

  const completedForced = plain(await hooks.checkServerHistoryStatus(
    "603",
    session,
    {
      now: NOW + 2,
      forceRefresh: true,
      scanPublicServers: async () => {
        scans += 1;
        return {
          status: "active",
          playing: 5,
          maxPlayers: 20,
          source: "public-server-list",
          reason: null
        };
      },
      fetchPresence: async () => ({ kind: "not-in-game" })
    }
  ));
  assert.equal(completedForced.playing, 5);
  assert.equal(scans, 2);
});

test("a stale lifecycle scan cannot evict its in-flight replacement", async () => {
  hooks.setServerHistoryFeatureStateForTests(true, true);
  const session = storedSession();
  let releaseOldScan;
  let releaseReplacementScan;
  const oldGate = new Promise((resolve) => {
    releaseOldScan = resolve;
  });
  const replacementGate = new Promise((resolve) => {
    releaseReplacementScan = resolve;
  });
  let scans = 0;
  const oldScan = hooks.checkServerHistoryStatus("604", session, {
    now: NOW,
    scanPublicServers: async () => {
      scans += 1;
      await oldGate;
      return { status: "unknown", playing: null, maxPlayers: null, reason: "not-visible" };
    },
    fetchPresence: async () => ({ kind: "not-in-game" })
  });
  await Promise.resolve();
  hooks.applyServerHistoryFeatureValue(
    { version: 1, flags: { serverHistory: false } },
    false
  );
  hooks.applyServerHistoryFeatureValue(
    { version: 1, flags: { serverHistory: true } },
    false
  );
  const replacementScan = hooks.checkServerHistoryStatus("604", session, {
    now: NOW + 1,
    forceRefresh: true,
    scanPublicServers: async () => {
      scans += 1;
      await replacementGate;
      return {
        status: "active",
        playing: 6,
        maxPlayers: 20,
        source: "public-server-list",
        reason: null
      };
    },
    fetchPresence: async () => ({ kind: "not-in-game" })
  });
  assert.equal(scans, 2);
  assert.equal(hooks.getServerHistoryStateForTests().statusRequestsInFlight, 1);

  releaseOldScan();
  await oldScan;
  assert.equal(
    hooks.getServerHistoryStateForTests().statusRequestsInFlight,
    1,
    "the stale completion must leave the replacement registered"
  );
  const overlappingReplacement = hooks.checkServerHistoryStatus("604", session, {
    now: NOW + 2,
    forceRefresh: true,
    scanPublicServers: async () => {
      scans += 1;
      throw new Error("the replacement must still be reused");
    },
    fetchPresence: async () => ({ kind: "not-in-game" })
  });
  assert.equal(scans, 2);
  releaseReplacementScan();
  const [replacementResult, overlappingResult] = await Promise.all([
    replacementScan,
    overlappingReplacement
  ]);
  assert.deepEqual(plain(overlappingResult), plain(replacementResult));
  assert.equal(scans, 2);
  assert.equal(hooks.getServerHistoryStateForTests().statusRequestsInFlight, 0);
});

test("user status refresh bypasses the cache while automatic checks reuse it", async () => {
  const memory = memoryStorage({
    version: constants.storageVersion,
    accounts: {
      "602": {
        sessions: [storedSession({ sessionId: "refresh_session" })],
        pendingNonGameCount: 0,
        trackingState: "not-in-game",
        lastCheckedAt: NOW,
        updatedAt: NOW
      }
    }
  });
  hooks.setServerHistoryFeatureStateForTests(true, true);
  let listRequests = 0;
  fetchHandler = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "users.roblox.com") return jsonResponse({ id: 602 });
    if (url.hostname === "games.roblox.com" && url.pathname.includes("/servers/Public")) {
      listRequests += 1;
      return jsonResponse({
        data: [{ id: JOB_A, playing: listRequests, maxPlayers: 20 }],
        nextPageCursor: null
      });
    }
    if (url.hostname === "presence.roblox.com") {
      return jsonResponse({ userPresences: [] });
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  const automatic = await invokeHandler(
    hooks.handleCheckServerHistoryStatusMessage,
    {
      type: constants.statusMessageType,
      requestId: 30,
      sessionId: "refresh_session",
      forceRefresh: false
    }
  );
  assert.equal(automatic.ok, true);
  assert.equal(automatic.playing, 1);
  const cachedAutomatic = await invokeHandler(
    hooks.handleCheckServerHistoryStatusMessage,
    {
      type: constants.statusMessageType,
      requestId: 31,
      sessionId: "refresh_session",
      forceRefresh: false
    }
  );
  assert.equal(cachedAutomatic.playing, 1);
  assert.equal(listRequests, 1, "automatic newest-session checks should use the 60s cache");

  const refreshed = await invokeHandler(
    hooks.handleCheckServerHistoryStatusMessage,
    {
      type: constants.statusMessageType,
      requestId: 32,
      sessionId: "refresh_session",
      forceRefresh: true
    }
  );
  assert.equal(refreshed.playing, 2);
  assert.equal(listRequests, 2, "an explicit Check status action must bypass the cache");
  assert.equal(memory.read().accounts["602"].sessions.length, 1);

  const malformed = await invokeHandler(
    hooks.handleCheckServerHistoryStatusMessage,
    {
      type: constants.statusMessageType,
      requestId: 33,
      sessionId: "refresh_session",
      forceRefresh: "true"
    }
  );
  assert.deepEqual(malformed, { ok: false, requestId: 33, errorCode: "invalid" });
  assert.equal(listRequests, 2);
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
  const badSession = await invokeHandler(
    hooks.handleCheckServerHistoryStatusMessage,
    { type: constants.statusMessageType, requestId: 3, sessionId: "../../job" }
  );
  assert.equal(badSession.errorCode, "invalid");
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
        sessions: [storedSession({ sessionId: "owned_opaque" })],
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
  const missing = await invokeHandler(
    hooks.handleRejoinServerHistoryMessage,
    { type: constants.rejoinMessageType, requestId: 10, sessionId: "other_account" }
  );
  assert.equal(missing.errorCode, "not-found");
  assert.equal(launchCalls.length, 0);

  const rejoined = await invokeHandler(
    hooks.handleRejoinServerHistoryMessage,
    {
      type: constants.rejoinMessageType,
      requestId: 11,
      sessionId: "owned_opaque",
      placeId: "666666",
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
    args: [1001, JOB_A]
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
  console.log(`PASS Server History background state, storage, status, and trust (${tests.length} cases)`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
