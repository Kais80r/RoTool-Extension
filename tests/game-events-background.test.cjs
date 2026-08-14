"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

const projectRoot = path.resolve(__dirname, "..");
const backgroundSource = fs.readFileSync(path.join(projectRoot, "background.js"), "utf8");
const storageData = {
  rslFeatureSettingsV1: { version: 1, flags: { gameEvents: true, serverHistory: false } }
};
const fetchCalls = [];
const storageWrites = [];
const alarmCreates = [];
let runtimeMessageListener = null;
let fetchHandler = async () => { throw new Error("Unexpected network request"); };

function plain(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function makeStorageArea(data) {
  return {
    get(keys, callback) {
      let result;
      if (typeof keys === "string") result = { [keys]: data[keys] };
      else if (Array.isArray(keys)) result = Object.fromEntries(keys.map((key) => [key, data[key]]));
      else {
        result = { ...(keys || {}) };
        for (const key of Object.keys(keys || {})) {
          if (Object.hasOwn(data, key)) result[key] = data[key];
        }
      }
      callback?.(result);
      return Promise.resolve(result);
    },
    set(values, callback) {
      Object.assign(data, plain(values));
      storageWrites.push(plain(values));
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
    id: "game-events-fixture",
    lastError: null,
    onInstalled: { addListener() {} },
    onStartup: { addListener() {} },
    onMessage: { addListener(listener) { runtimeMessageListener = listener; } }
  },
  storage: {
    local: makeStorageArea(storageData),
    session: makeStorageArea({}),
    onChanged: { addListener() {} }
  },
  alarms: {
    create(name, options) { alarmCreates.push({ name, options: plain(options) }); },
    get(_name, callback) { callback(null); },
    clear(_name, callback) { callback?.(true); return Promise.resolve(true); },
    onAlarm: { addListener() {} }
  },
  contextMenus: {
    create(_details, callback) { callback?.(); },
    removeAll(callback) { callback?.(); },
    onClicked: { addListener() {} }
  },
  scripting: { executeScript: async () => [] },
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
  Intl,
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
vm.runInContext(backgroundSource, vm.createContext(sandbox), { filename: "background.js" });

const hooks = sandbox.__rslBackgroundTestHooks;
const constants = hooks.gameEventsConstants;
const NOW = Date.now();

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function validRawEvent(overrides = {}) {
  return {
    id: "123456789",
    universeId: 2001,
    placeId: 1001,
    title: "Summer Event",
    subtitle: "Double XP",
    displayTitle: "Deutscher Anzeigetitel",
    displaySubtitle: "Deutsche Beschreibung",
    eventVisibility: "public",
    eventStatus: "active",
    eventTime: {
      startUtc: new Date(NOW + 60_000).toISOString(),
      endUtc: new Date(NOW + 3_600_000).toISOString()
    },
    thumbnails: [{ mediaId: 9002, rank: 2 }, { mediaId: 9001, rank: 1 }],
    ...overrides
  };
}

function storedGame(index = 1, overrides = {}) {
  return {
    universeId: String(2000 + index),
    placeId: String(1000 + index),
    name: `Game ${index}`,
    addedAt: NOW - index,
    ...overrides
  };
}

function emptyStorage() {
  return { version: constants.storageVersion, accounts: {} };
}

function memoryStorage(initial = emptyStorage()) {
  let value = plain(initial);
  let writes = 0;
  hooks.setGameEventsStorageOverrideForTests({
    async read() { return plain(value); },
    async write(next) { writes += 1; value = plain(next); }
  });
  return { read: () => plain(value), writes: () => writes };
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

async function invokeHandler(message, sender = trustedSender()) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out: ${message.type}`)), 2_000);
    hooks.handleGameEventsMessage(message, sender, (response) => {
      clearTimeout(timer);
      resolve(plain(response));
    });
  });
}

async function waitUntil(predicate, message) {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail(message);
}

function resetFixture() {
  hooks.resetGameEventsStateForTests();
  fetchCalls.length = 0;
  storageWrites.length = 0;
  alarmCreates.length = 0;
  fetchHandler = async () => { throw new Error("Unexpected network request"); };
}

const tests = [];
function test(name, run) { tests.push({ name, run }); }

test("defaults, constants, and locale validation are additive and strict", () => {
  assert.equal(constants.featureKey, "gameEvents");
  assert.equal(constants.storageKey, "rslGameEventFavoritesV1");
  assert.equal(constants.storageVersion, 1);
  assert.equal(constants.maxGamesPerAccount, 30);
  assert.equal(constants.maxAccounts, 8);
  assert.equal(constants.maxEventsPerGame, 10);
  assert.equal(constants.maxSearchResults, 8);
  assert.equal(constants.searchQueryMaxLength, 100);
  assert.equal(constants.searchCacheMaxEntries, 50);
  assert.equal(constants.fetchConcurrency, 4);
  assert.equal(constants.cacheTtlMs, 10 * 60_000);
  assert.equal(hooks.getGameEventsFeatureValue(null), true);
  assert.equal(hooks.getGameEventsFeatureValue({ version: 1, flags: {} }), true);
  assert.equal(hooks.getGameEventsFeatureValue({ version: 1, flags: { gameEvents: false } }), false);
  assert.equal(hooks.normalizeGameEventsLocale("de_DE"), "de-DE");
  assert.equal(hooks.normalizeGameEventsLocale("zh_hans_cn"), "zh-Hans-CN");
  for (const value of ["", "e", "de DE", "de-DE\r\nX-Test: injected", "*", "a".repeat(129)]) {
    assert.equal(hooks.normalizeGameEventsLocale(value), "en-US");
  }
  assert.equal(backgroundSource.includes("GAME_EVENTS_ALARM"), false);
  assert.equal(alarmCreates.some(({ name }) => /event/i.test(name)), false);
});

test("game browser search normalizes only experience results, deduplicates, and caps", () => {
  assert.equal(hooks.normalizeGameEventsSearchQuery("  mm2  "), "mm2");
  for (const query of ["", "x", "x".repeat(101), null, { query: "mm2" }]) {
    assert.equal(hooks.normalizeGameEventsSearchQuery(query), null);
  }
  const contents = Array.from({ length: 12 }, (_, index) => ({
    universeId: 5000 + index,
    rootPlaceId: 6000 + index,
    name: ` Game ${index} `,
    creatorName: `Creator ${index}`,
    playerCount: index
  }));
  contents.splice(2, 0, { ...contents[0], name: "Duplicate" });
  const results = plain(hooks.normalizeGameEventsSearchResults({
    searchResults: [
      { contentGroupType: "User", contents: [{ universeId: 1, name: "Not a game" }] },
      { contentGroupType: "Game", contents },
      { contentGroupType: "Experiences", contents: [{ universeId: 9000, name: "Overflow" }] }
    ]
  }));
  assert.equal(results.length, 8);
  assert.equal(new Set(results.map(({ universeId }) => universeId)).size, 8);
  assert.deepEqual(results[0], {
    universeId: "5000",
    placeId: "6000",
    name: "Game 0",
    creatorName: "Creator 0",
    playerCount: 0
  });
  assert.equal(Object.isFrozen(hooks.normalizeGameEventsSearchResults({ searchResults: [] })), true);
});

test("game browser suggestions use the exact anonymous localized search endpoint and never write", async () => {
  fetchHandler = async (input, options) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://apis.roblox.com");
    assert.equal(url.pathname, "/search-api/omni-search");
    assert.equal(url.searchParams.get("searchQuery"), "Murder Mystery");
    assert.equal(url.searchParams.get("pageType"), "all");
    assert.ok(url.searchParams.get("sessionId"));
    assert.equal(options.method, undefined);
    assert.equal(options.credentials, "omit");
    assert.equal(options.headers["Accept-Language"], "de-DE");
    assert.equal(options.body, undefined);
    return jsonResponse({ searchResults: [{
      contentGroupType: "Game",
      contents: [{
        universeId: 2001,
        rootPlaceId: 1001,
        name: "Murder Mystery 2",
        creatorName: "Nikilis",
        playerCount: 12345
      }]
    }] });
  };
  const results = await hooks.searchGameEventsGames("Murder Mystery", "de_DE");
  assert.equal(results[0].universeId, "2001");
  assert.equal(results[0].name, "Murder Mystery 2");
  assert.equal(results[0].playerCount, 12345);
  assert.equal(fetchCalls.length, 1);
  assert.equal(storageWrites.length, 0);
  assert.equal(hooks.getGameEventsStateForTests().searchCacheSize, 1);
});

test("favorites normalize, deduplicate, cap, and isolate recent accounts", () => {
  const duplicateAndOverflow = Array.from({ length: 35 }, (_, index) => storedGame(index + 1));
  duplicateAndOverflow.splice(3, 0, { ...duplicateAndOverflow[2], name: "Duplicate" });
  duplicateAndOverflow.push({ ...storedGame(99), universeId: "0" }, { broken: true });
  const accounts = {};
  for (let index = 1; index <= 11; index += 1) {
    accounts[String(index)] = {
      games: index === 1 ? duplicateAndOverflow : [storedGame(index)],
      updatedAt: NOW - index
    };
  }
  const normalized = plain(hooks.normalizeGameEventsStorage({ version: 1, accounts }, NOW));
  assert.equal(Object.keys(normalized.accounts).length, 8);
  assert.equal(Object.hasOwn(normalized.accounts, "1"), true);
  assert.equal(Object.hasOwn(normalized.accounts, "11"), false);
  assert.equal(normalized.accounts["1"].games.length, 30);
  assert.equal(new Set(normalized.accounts["1"].games.map(({ universeId }) => universeId)).size, 30);
  assert.deepEqual(plain(hooks.normalizeGameEventsStorage({ version: 2, accounts }, NOW)), emptyStorage());
});

test("event normalization uses raw copy, string IDs, time-derived state, and safe text", () => {
  const event = plain(hooks.normalizeGameEvent(validRawEvent({
    title: "  Summer\n\t\u0000 Event  ",
    subtitle: "  Double\r\n XP  "
  }), "2001", NOW));
  assert.equal(event.id, "123456789");
  assert.equal(event.universeId, "2001");
  assert.equal(event.placeId, "1001");
  assert.equal(event.title, "Summer Event");
  assert.equal(event.subtitle, "Double XP");
  assert.equal(event.status, "upcoming");
  assert.equal(event.mediaId, "9001");
  assert.equal(event.eventUrl, "https://www.roblox.com/events/123456789");
  assert.equal(Object.hasOwn(event, "displayTitle"), false);
  const uuid = "550E8400-E29B-41D4-A716-446655440000";
  assert.equal(hooks.normalizeGameEventId(uuid), uuid.toLowerCase());
  assert.equal(hooks.normalizeGameEventId(12345), "12345");
  for (const invalid of ["", "not-an-id", "1/2", "<script>", "550e8400-e29b-11d4-0716-446655440000"]) {
    assert.equal(hooks.normalizeGameEventId(invalid), null);
  }
  assert.equal(
    hooks.normalizeGameEvent(validRawEvent({
      eventTime: {
        startUtc: new Date(NOW - 60_000).toISOString(),
        endUtc: new Date(NOW + 60_000).toISOString()
      }
    }), "2001", NOW).status,
    "live"
  );
});

test("ended, private, malformed, mismatched, and rejected-status events are dropped", () => {
  const invalid = [
    validRawEvent({ universeId: 9999 }),
    validRawEvent({ eventVisibility: "private" }),
    validRawEvent({ title: "   " }),
    validRawEvent({ eventTime: { startUtc: "bad", endUtc: "also bad" } }),
    validRawEvent({ eventTime: {
      startUtc: new Date(NOW - 120_000).toISOString(),
      endUtc: new Date(NOW - 60_000).toISOString()
    } }),
    ...["cancelled", "canceled", "moderated", "deleted", "unpublished", "inactive"]
      .map((eventStatus) => validRawEvent({ eventStatus }))
  ];
  for (const event of invalid) assert.equal(hooks.normalizeGameEvent(event, "2001", NOW), null);
  const payload = { data: [
    validRawEvent({ id: "3", eventTime: { startUtc: new Date(NOW + 5_000).toISOString(), endUtc: new Date(NOW + 20_000).toISOString() } }),
    validRawEvent({ id: "3" }),
    ...Array.from({ length: 15 }, (_, index) => validRawEvent({ id: String(100 + index) }))
  ] };
  const normalized = hooks.normalizeGameEventsPayload(payload, "2001", NOW);
  assert.equal(normalized.length, 10);
  assert.equal(new Set(normalized.map(({ id }) => id)).size, 10);
});

test("official event fetch is exact, anonymous, localized, and read-only", async () => {
  fetchHandler = async (input, options) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://apis.roblox.com");
    assert.equal(url.pathname, "/virtual-events/v1/universes/2001/virtual-events");
    assert.equal(url.search, "");
    assert.equal(options.method, "GET");
    assert.equal(options.credentials, "omit");
    assert.equal(options.headers["Accept-Language"], "de-DE");
    assert.equal(options.body, undefined);
    return jsonResponse({ data: [validRawEvent()] });
  };
  const events = await hooks.fetchGameEventsForUniverse("2001", "de_DE", NOW);
  assert.equal(events[0].title, "Summer Event");
  assert.equal(events[0].subtitle, "Double XP");
  assert.equal(fetchCalls.length, 1);
  assert.equal(storageWrites.length, 0);
  assert.doesNotMatch(backgroundSource.slice(
    backgroundSource.indexOf("function getGameEventsFeatureValue"),
    backgroundSource.indexOf("function normalizePrivateServerPlaceId")
  ), /RSVP|notify-me|join-event|method:\s*["']POST["']/i);
});

test("success and empty results cache for ten minutes; force and inflight semantics are safe", async () => {
  let calls = 0;
  let release;
  fetchHandler = async () => {
    calls += 1;
    if (calls === 1) return new Promise((resolve) => { release = () => resolve(jsonResponse({ data: [] })); });
    return jsonResponse({ data: [] });
  };
  const first = hooks.getGameEventsForUniverse("2001", { now: NOW, locale: "en-US" });
  const overlappingForce = hooks.getGameEventsForUniverse("2001", { now: NOW + 1, locale: "en-US", forceRefresh: true });
  await waitUntil(() => typeof release === "function", "event request did not start");
  assert.equal(calls, 1, "force refresh must reuse an already in-flight request");
  release();
  await Promise.all([first, overlappingForce]);
  const cached = await hooks.getGameEventsForUniverse("2001", { now: Date.now(), locale: "en-US" });
  assert.equal(cached.usedCachedData, true);
  assert.equal(calls, 1, "an empty success must be cached too");
  await hooks.getGameEventsForUniverse("2001", { now: Date.now(), locale: "en-US", forceRefresh: true });
  assert.equal(calls, 2);
});

test("failed refresh uses last known data and marks partial instead of erasing it", async () => {
  hooks.setGameEventsCache("2001", [hooks.normalizeGameEvent(validRawEvent(), "2001", NOW)], NOW - constants.cacheTtlMs - 1);
  fetchHandler = async () => jsonResponse({ errors: [{ message: "down" }] }, 503);
  const result = await hooks.getGameEventsForUniverse("2001", {
    now: NOW,
    locale: "en-US",
    forceRefresh: true
  });
  assert.equal(result.events.length, 1);
  assert.equal(result.stale, true);
  assert.equal(result.usedCachedData, true);
  assert.equal(result.failureCode, "ROBLOX_UNAVAILABLE");
});

test("game resolution supports URLs, place IDs, explicit universes, names, and locale-isolated metadata", async () => {
  fetchHandler = async (input, options) => {
    const url = new URL(String(input));
    if (url.pathname === "/universes/v1/places/1001/universe") {
      assert.equal(options.credentials, "omit");
      return jsonResponse({ universeId: 2001 });
    }
    if (url.pathname === "/v1/games") {
      assert.equal(options.credentials, "omit");
      const locale = options.headers["Accept-Language"];
      return jsonResponse({ data: [{ id: 2001, rootPlaceId: 1001, name: locale === "de-DE" ? "Deutsch" : "English" }] });
    }
    if (url.pathname === "/search-api/omni-search") {
      assert.equal(options.credentials, "omit");
      assert.equal(options.headers["Accept-Language"], "en-US");
      return jsonResponse({ searchResults: [{
        contentGroupType: "Game",
        contents: [{ universeId: 2001, name: "Fixture Game" }]
      }] });
    }
    throw new Error(`Unexpected ${url}`);
  };
  assert.deepEqual(plain(await hooks.resolveGameEventsGame("https://www.roblox.com/games/1001/name", null, "en-US")), {
    universeId: "2001", placeId: "1001", name: "English"
  });
  assert.deepEqual(plain(await hooks.resolveGameEventsGame("1001", null, "en-US")), {
    universeId: "2001", placeId: "1001", name: "English"
  });
  assert.equal((await hooks.resolveGameEventsGame("ignored", "2001", "de-DE")).name, "Deutsch");
  assert.equal((await hooks.fetchGameEventsGameDetails("2001", "en-US")).name, "English");
  assert.equal((await hooks.fetchGameEventsGameDetails("2001", "de-DE")).name, "Deutsch");
  assert.ok(fetchCalls.filter(({ url }) => url.includes("/v1/games")).length >= 2,
    "metadata cache must not leak one page locale into another");
  await assert.rejects(() => hooks.resolveGameEventsGame("https://evil.example/games/1001/name"));
});

test("a bare numeric ID falls back from a missing place to an exact Universe ID", async () => {
  fetchHandler = async (input, options) => {
    const url = new URL(String(input));
    if (url.pathname === "/universes/v1/places/2001/universe") {
      assert.equal(options.credentials, "omit");
      return jsonResponse({}, 404);
    }
    if (url.pathname === "/v1/games") {
      assert.equal(url.searchParams.get("universeIds"), "2001");
      assert.equal(options.credentials, "omit");
      assert.equal(options.headers["Accept-Language"], "de-DE");
      return jsonResponse({ data: [{ id: 2001, rootPlaceId: 1001, name: "Fixture Game" }] });
    }
    throw new Error(`Unexpected ${url}`);
  };
  assert.deepEqual(
    plain(await hooks.resolveGameEventsGame("2001", null, "de-DE")),
    { universeId: "2001", placeId: "1001", name: "Fixture Game" }
  );
});

test("trusted handlers reject child frames, spoofed origins, malformed IDs, and disabled use", async () => {
  assert.equal(typeof runtimeMessageListener, "function");
  const invalid = await invokeHandler({ type: constants.getMessageType, requestId: "1", locale: "en-US" });
  assert.equal(invalid.code, "INVALID");
  const child = await invokeHandler(
    { type: constants.getMessageType, requestId: 2, locale: "en-US" },
    trustedSender({ frameId: 2 })
  );
  assert.equal(child.code, "INVALID");
  const spoofed = await invokeHandler(
    { type: constants.getMessageType, requestId: 3, locale: "en-US" },
    trustedSender({
      url: "https://www.roblox.com.evil.test/home",
      tab: { id: 17, url: "https://www.roblox.com.evil.test/home" }
    })
  );
  assert.equal(spoofed.code, "INVALID");
  hooks.setGameEventsFeatureStateForTests(false, true);
  const disabled = await invokeHandler({ type: constants.getMessageType, requestId: 4, locale: "en-US" });
  assert.deepEqual(disabled, {
    ok: false, requestId: 4, enabled: false, code: "DISABLED", viewerUserId: null, retryAfterMs: 0
  });
});

test("suggestion handler is trusted, account-isolated, exact, and read-only", async () => {
  const memory = memoryStorage({
    version: 1,
    accounts: {
      "101": { games: [storedGame(1)], updatedAt: NOW },
      "202": { games: [storedGame(2)], updatedAt: NOW }
    }
  });
  let authCalls = 0;
  fetchHandler = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "users.roblox.com") {
      authCalls += 1;
      return jsonResponse({ id: 101 });
    }
    if (url.pathname === "/search-api/omni-search") {
      assert.equal(url.searchParams.get("searchQuery"), "Murder Mystery");
      return jsonResponse({ searchResults: [{
        contentGroupType: "Game",
        contents: [{ universeId: 2001, rootPlaceId: 1001, name: "Murder Mystery 2" }]
      }] });
    }
    throw new Error(`Unexpected ${url}`);
  };
  const response = await invokeHandler({
    type: constants.searchMessageType,
    requestId: 41,
    viewerUserId: "101",
    locale: "en-US",
    query: "Murder Mystery"
  });
  assert.equal(response.ok, true);
  assert.equal(response.requestId, 41);
  assert.equal(response.viewerUserId, "101");
  assert.equal(response.query, "Murder Mystery");
  assert.deepEqual(response.results.map(({ universeId }) => universeId), ["2001"]);
  assert.equal(authCalls, 2, "search must revalidate the viewer after Roblox responds");
  assert.equal(memory.writes(), 0);

  const child = await invokeHandler({
    type: constants.searchMessageType,
    requestId: 42,
    query: "Murder Mystery"
  }, trustedSender({ frameId: 1 }));
  assert.equal(child.code, "INVALID");
  const short = await invokeHandler({
    type: constants.searchMessageType,
    requestId: 43,
    query: "x"
  });
  assert.equal(short.code, "INVALID");
});

test("account changes during a slow suggestion search cannot leak old results", async () => {
  memoryStorage({ version: 1, accounts: {
    "101": { games: [storedGame(1)], updatedAt: NOW },
    "202": { games: [storedGame(2)], updatedAt: NOW }
  } });
  let authCalls = 0;
  let releaseSearch;
  fetchHandler = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "users.roblox.com") {
      authCalls += 1;
      return jsonResponse({ id: authCalls === 1 ? 101 : 202 });
    }
    if (url.pathname === "/search-api/omni-search") {
      return new Promise((resolve) => {
        releaseSearch = () => resolve(jsonResponse({ searchResults: [{
          contentGroupType: "Game",
          contents: [{ universeId: 2001, rootPlaceId: 1001, name: "Old account result" }]
        }] }));
      });
    }
    throw new Error(`Unexpected ${url}`);
  };
  const request = hooks.getGameEventsSearchResponse({
    requestId: 44,
    viewerUserId: "101",
    locale: "en-US",
    query: "Murder Mystery"
  });
  await waitUntil(() => typeof releaseSearch === "function", "slow suggestion search did not start");
  releaseSearch();
  await assert.rejects(request, (error) => error?.code === "ACCOUNT_CHANGED");
});

test("direct URL and ID additions bypass suggestion search and keep fallback resolution", async () => {
  const seenPaths = [];
  fetchHandler = async (input) => {
    const url = new URL(String(input));
    seenPaths.push(url.pathname);
    if (url.pathname === "/universes/v1/places/1001/universe") {
      return jsonResponse({ universeId: 2001 });
    }
    if (url.pathname === "/v1/games") {
      return jsonResponse({ data: [{ id: 2001, rootPlaceId: 1001, name: "Fixture Game" }] });
    }
    throw new Error(`Unexpected ${url}`);
  };
  await hooks.resolveGameEventsGame("https://www.roblox.com/games/1001/fixture", null, "en-US");
  await hooks.resolveGameEventsGame("1001", null, "en-US");
  assert.equal(seenPaths.includes("/search-api/omni-search"), false);
  assert.ok(seenPaths.includes("/universes/v1/places/1001/universe"));
  assert.ok(seenPaths.includes("/v1/games"));
});

test("GET is account-isolated, reports per-game partial failures, and never writes", async () => {
  const memory = memoryStorage({
    version: 1,
    accounts: {
      "101": { games: [storedGame(1), storedGame(2)], updatedAt: NOW },
      "202": { games: [storedGame(9)], updatedAt: NOW - 1 }
    }
  });
  fetchHandler = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "users.roblox.com") return jsonResponse({ id: 101 });
    if (url.pathname.includes("/2001/")) return jsonResponse({ data: [validRawEvent()] });
    if (url.pathname.includes("/2002/")) return jsonResponse({}, 503);
    throw new Error(`Unexpected ${url}`);
  };
  const response = await hooks.getGameEventsResponse({ requestId: 7, locale: "en-US", forceRefresh: true });
  assert.equal(response.viewerUserId, "101");
  assert.deepEqual(plain(response.games.map(({ universeId }) => universeId)), ["2001", "2002"]);
  assert.equal(response.events.length, 1);
  assert.equal(response.events[0].gameName, "Game 1");
  assert.equal(response.partial, true);
  assert.deepEqual(plain(response.failures.map(({ universeId }) => universeId)), ["2002"]);
  assert.equal(memory.writes(), 0);
});

test("account changes during a slow GET cannot return the old account snapshot", async () => {
  memoryStorage({ version: 1, accounts: {
    "101": { games: [storedGame(1)], updatedAt: NOW },
    "202": { games: [storedGame(2)], updatedAt: NOW }
  } });
  let authCalls = 0;
  let releaseEvent;
  fetchHandler = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "users.roblox.com") {
      authCalls += 1;
      return jsonResponse({ id: authCalls === 1 ? 101 : 202 });
    }
    if (url.pathname.includes("/virtual-events")) {
      return new Promise((resolve) => { releaseEvent = () => resolve(jsonResponse({ data: [] })); });
    }
    throw new Error(`Unexpected ${url}`);
  };
  const request = hooks.getGameEventsResponse({ requestId: 9, locale: "en-US", forceRefresh: true });
  await waitUntil(() => typeof releaseEvent === "function", "slow event fetch did not start");
  releaseEvent();
  await assert.rejects(request, (error) => error?.code === "ACCOUNT_CHANGED");
});

test("disable during a slow mutation prevents the late write and success response", async () => {
  let releaseRead;
  let writes = 0;
  hooks.setGameEventsStorageOverrideForTests({
    read() { return new Promise((resolve) => { releaseRead = () => resolve({
      version: 1,
      accounts: { "101": { games: [storedGame(1)], updatedAt: NOW } }
    }); }); },
    async write() { writes += 1; }
  });
  fetchHandler = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "users.roblox.com") return jsonResponse({ id: 101 });
    throw new Error(`Unexpected ${url}`);
  };
  const pending = hooks.removeGameEventFavorite({ requestId: 10, universeId: "2001", viewerUserId: "101" });
  await waitUntil(() => typeof releaseRead === "function", "mutation read did not start");
  hooks.setGameEventsFeatureStateForTests(false, true);
  releaseRead();
  await assert.rejects(pending, (error) => error?.code === "DISABLED");
  assert.equal(writes, 0);
});

test("disable during a slow GET prevents a late account response", async () => {
  memoryStorage({ version: 1, accounts: {
    "101": { games: [storedGame(1)], updatedAt: NOW }
  } });
  let releaseEvent;
  fetchHandler = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "users.roblox.com") return jsonResponse({ id: 101 });
    if (url.pathname.includes("/virtual-events")) {
      return new Promise((resolve) => { releaseEvent = () => resolve(jsonResponse({ data: [] })); });
    }
    throw new Error(`Unexpected ${url}`);
  };
  const pending = hooks.getGameEventsResponse({ requestId: 11, locale: "en-US", forceRefresh: true });
  await waitUntil(() => typeof releaseEvent === "function", "slow GET did not start");
  hooks.setGameEventsFeatureStateForTests(false, true);
  releaseEvent();
  await assert.rejects(pending, (error) => error?.code === "DISABLED");
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
  console.log(`PASS Game Events background storage, official API, cache, locale, and trust (${tests.length} cases)`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
