"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

const projectRoot = path.resolve(__dirname, "..");
const backgroundSource = fs.readFileSync(path.join(projectRoot, "background.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "manifest.json"), "utf8"));
const fetchCalls = [];
let fetchHandler = async () => { throw new Error("Unexpected network request"); };

function plain(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function storageArea(initial = {}) {
  const data = { ...initial };
  return {
    get(keys, callback) {
      let result = {};
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
    set(values, callback) { Object.assign(data, plain(values)); callback?.(); return Promise.resolve(); },
    remove(keys, callback) {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key];
      callback?.();
      return Promise.resolve();
    }
  };
}

const chrome = {
  runtime: {
    id: "experience-places-fixture",
    lastError: null,
    onInstalled: { addListener() {} },
    onStartup: { addListener() {} },
    onMessage: { addListener() {} }
  },
  storage: {
    local: storageArea({
      rslFeatureSettingsV1: { version: 1, flags: { experiencePlaces: true } }
    }),
    session: storageArea(),
    onChanged: { addListener() {} }
  },
  alarms: {
    create() {}, get(_name, callback) { callback(null); },
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
  URL, URLSearchParams, Response, Headers, Request, AbortController,
  TextDecoder, TextEncoder, Intl, console, chrome, crypto: webcrypto,
  fetch: async (input, options = {}) => {
    fetchCalls.push({ url: String(input), options: plain(options) });
    return fetchHandler(input, options);
  },
  setTimeout, clearTimeout, queueMicrotask,
  __rslBackgroundTestHooks: {},
  globalThis: null
};
sandbox.globalThis = sandbox;
vm.runInContext(backgroundSource, vm.createContext(sandbox), { filename: "background.js" });

const hooks = sandbox.__rslBackgroundTestHooks;
const constants = hooks.experiencePlacesConstants;

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function trustedSender(overrides = {}) {
  return {
    id: chrome.runtime.id,
    frameId: 0,
    url: "https://www.roblox.com/games/1001/Fixture-Game",
    tab: { id: 17, incognito: false, url: "https://www.roblox.com/games/1001/Fixture-Game" },
    ...overrides
  };
}

function eligibilityMessage(overrides = {}) {
  return {
    type: constants.eligibilityMessageType,
    requestId: 41,
    placeId: "1001",
    rootPlaceId: "1000",
    universeId: "2001",
    ...overrides
  };
}

function invoke(message, sender = trustedSender(), direct = false) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let returned;
    let returnedReady = false;
    let synchronousResponse;
    const finish = (response) => {
      if (settled) return;
      if (!returnedReady) {
        synchronousResponse = plain(response);
        return;
      }
      settled = true;
      resolve({ response: plain(response), returned });
    };
    try {
      returned = (direct
        ? hooks.handleExperiencePlacesEligibilityMessage
        : hooks.handleRuntimeMessage)(message, sender, finish);
      returnedReady = true;
    } catch (error) {
      reject(error);
      return;
    }
    if (synchronousResponse !== undefined) {
      settled = true;
      resolve({ response: synchronousResponse, returned });
      return;
    }
    if (returned !== true && !settled) resolve({ response: undefined, returned });
    setTimeout(() => {
      if (!settled) reject(new Error("Experience Places handler timed out"));
    }, 2_000).unref?.();
  });
}

assert.deepEqual(plain(constants), {
  eligibilityMessageType: "rsl:get-experience-places-eligibility",
  thumbnailMessageType: "rsl:get-experience-place-thumbnails",
  thumbnailBatchMax: 24,
  thumbnailSize: "150x150"
});
assert.equal(
  manifest.host_permissions.some((origin) => /develop\.roblox\.com/i.test(origin)),
  false,
  "the public CORS request must not add a required Develop host permission"
);

assert.deepEqual(plain(hooks.normalizeExperiencePlaceThumbnailIds(["1", "2", "1"])), ["1", "2"]);
for (const invalid of [[], [1], ["0"], ["01"], ["1", "bad"], Array(25).fill("1")]) {
  assert.equal(hooks.normalizeExperiencePlaceThumbnailIds(invalid), null);
}

(async () => {
  fetchCalls.length = 0;
  fetchHandler = async (input) => {
    const url = new URL(String(input));
    if (url.origin === "https://apis.roblox.com") {
      assert.equal(url.pathname, "/universes/v1/places/1001/universe");
      return json({ universeId: 2001 });
    }
    if (url.origin === "https://games.roblox.com") {
      assert.equal(url.pathname, "/v1/games");
      assert.equal(url.searchParams.get("universeIds"), "2001");
      return json({ data: [{ id: 2001, rootPlaceId: 1000, isContentRestricted: false }] });
    }
    throw new Error(`Unexpected URL: ${url.href}`);
  };

  const allowed = await invoke(eligibilityMessage());
  assert.equal(allowed.returned, true);
  assert.deepEqual(allowed.response, {
    ok: true,
    requestId: 41,
    placeId: "1001",
    universeId: "2001",
    rootPlaceId: "1000",
    eligible: true,
    restricted: false
  });
  assert.equal(fetchCalls.length, 2);
  for (const call of fetchCalls) {
    assert.equal(call.options.method, "GET");
    assert.equal(call.options.credentials, "omit");
    assert.equal(call.options.cache, "no-store");
    assert.deepEqual(call.options.headers, { Accept: "application/json" });
  }

  fetchHandler = async (input) => {
    const url = new URL(String(input));
    return url.origin === "https://apis.roblox.com"
      ? json({ universeId: 2001 })
      : json({ data: [{ id: 2001, rootPlaceId: 1000, isContentRestricted: true }] });
  };
  const restricted = await invoke(eligibilityMessage({ requestId: 42 }));
  assert.equal(restricted.response.ok, true);
  assert.equal(restricted.response.eligible, false);
  assert.equal(restricted.response.restricted, true);

  fetchHandler = async (input) => {
    const url = new URL(String(input));
    return url.origin === "https://apis.roblox.com"
      ? json({ universeId: 9999 })
      : json({ data: [{ id: 2001, rootPlaceId: 1000, isContentRestricted: false }] });
  };
  const mismatchedUniverse = await invoke(eligibilityMessage({ requestId: 43 }));
  assert.equal(mismatchedUniverse.response.ok, false);

  fetchHandler = async (input) => {
    const url = new URL(String(input));
    return url.origin === "https://apis.roblox.com"
      ? json({ universeId: 2001 })
      : json({ data: [{ id: 2001, rootPlaceId: 9999, isContentRestricted: false }] });
  };
  const mismatchedRoot = await invoke(eligibilityMessage({ requestId: 44 }));
  assert.equal(mismatchedRoot.response.ok, false);

  for (const [message, sender] of [
    [eligibilityMessage({ extra: true }), trustedSender()],
    [eligibilityMessage({ requestId: "45" }), trustedSender()],
    [eligibilityMessage(), trustedSender({ frameId: 1 })],
    [eligibilityMessage(), trustedSender({ url: "https://www.roblox.com/home", tab: { id: 17, url: "https://www.roblox.com/home" } })],
    [eligibilityMessage(), trustedSender({ url: "https://www.roblox.com/games/9999/X", tab: { id: 17, url: "https://www.roblox.com/games/9999/X" } })]
  ]) {
    const invalid = await invoke(message, sender, true);
    assert.equal(invalid.returned, false);
    assert.equal(invalid.response?.ok, false);
    assert.equal(invalid.response?.code, "INVALID");
  }
  const external = await invoke(eligibilityMessage(), trustedSender({ id: "foreign-extension" }));
  assert.equal(external.returned, false);
  assert.equal(external.response, undefined);

  fetchCalls.length = 0;
  fetchHandler = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://thumbnails.roblox.com");
    assert.equal(url.pathname, "/v1/places/gameicons");
    assert.equal(url.searchParams.get("placeIds"), "1000,1001");
    assert.equal(url.searchParams.get("size"), "150x150");
    assert.equal(url.searchParams.get("format"), "Webp");
    assert.equal(url.searchParams.get("isCircular"), "false");
    return json({
      data: [
        { targetId: 1000, state: "Completed", imageUrl: "https://tr.rbxcdn.com/owned/150/150/Image/Webp/noFilter" },
        { targetId: 9999, state: "Completed", imageUrl: "https://evil.invalid/x.png" }
      ]
    });
  };
  const thumbnails = plain(await hooks.fetchExperiencePlaceThumbnails(["1000", "1001"]));
  assert.deepEqual(thumbnails, [
    { placeId: "1000", url: "https://tr.rbxcdn.com/owned/150/150/Image/Webp/noFilter" }
  ]);
  assert.equal(fetchCalls[0].options.credentials, "omit");

  assert.match(backgroundSource, /sender\.id !== chrome\.runtime\.id/);
  assert.doesNotMatch(backgroundSource, /develop\.roblox\.com/,
    "the background must not silently proxy the public Develop list request");
  console.log("PASS Experience Places eligibility, trusted route, restriction, and thumbnails contract");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
