"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const backgroundSource = fs.readFileSync(
  path.join(projectRoot, "background.js"),
  "utf8"
);
const contentSource = fs.readFileSync(
  path.join(projectRoot, "content.js"),
  "utf8"
);

class FakeClock {
  constructor(now) {
    this.now = now;
    this.nextTimerId = 1;
    this.timers = new Map();
  }

  setTimeout(callback, delay = 0, ...args) {
    const timerId = this.nextTimerId++;
    const milliseconds = Number(delay);
    this.timers.set(timerId, {
      timerId,
      dueAt:
        this.now +
        (Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : 0),
      callback,
      args
    });
    return timerId;
  }

  clearTimeout(timerId) {
    this.timers.delete(timerId);
  }

  getNextTimerBeforeOrAt(limit) {
    let next = null;
    for (const timer of this.timers.values()) {
      if (
        timer.dueAt <= limit &&
        (!next ||
          timer.dueAt < next.dueAt ||
          (timer.dueAt === next.dueAt && timer.timerId < next.timerId))
      ) {
        next = timer;
      }
    }
    return next;
  }

  async flushMicrotasks() {
    // Background support crosses fetch, response parsing, storage, runtime, and
    // content promises. A bounded drain keeps the clock deterministic without
    // introducing a real timer into the test.
    for (let index = 0; index < 40; index += 1) {
      await Promise.resolve();
    }
  }

  async advanceTo(targetTime) {
    assert.ok(targetTime >= this.now, "fake time cannot move backwards");
    await this.flushMicrotasks();
    let timer = this.getNextTimerBeforeOrAt(targetTime);
    while (timer) {
      this.timers.delete(timer.timerId);
      this.now = timer.dueAt;
      timer.callback(...timer.args);
      await this.flushMicrotasks();
      timer = this.getNextTimerBeforeOrAt(targetTime);
    }
    this.now = targetTime;
    await this.flushMicrotasks();
  }
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
          if (Object.hasOwn(data, key)) {
            result[key] = data[key];
          }
        }
      }
      callback?.(result);
      return Promise.resolve(result);
    },
    set(values, callback) {
      Object.assign(data, values);
      callback?.();
      return Promise.resolve();
    },
    remove(keys, callback) {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        delete data[key];
      }
      callback?.();
      return Promise.resolve();
    },
    clear(callback) {
      for (const key of Object.keys(data)) {
        delete data[key];
      }
      callback?.();
      return Promise.resolve();
    }
  };
}

function makeSurface(placeId) {
  const makeEventTarget = () => {
    const listenersByType = new Map();
    return {
      addEventListener(type, listener) {
        const listeners = listenersByType.get(type) || [];
        listeners.push(listener);
        listenersByType.set(type, listeners);
      },
      removeEventListener(type, listener) {
        const listeners = listenersByType.get(type) || [];
        listenersByType.set(
          type,
          listeners.filter((candidate) => candidate !== listener)
        );
      },
      dispatch(type) {
        for (const listener of listenersByType.get(type) || []) {
          listener({ type, isTrusted: true });
        }
      },
      listenerCount(type) {
        return (listenersByType.get(type) || []).length;
      }
    };
  };
  const privateButton = { hidden: true };
  const playButton = {
    getAttribute(name) {
      return name === "data-rsl-quick-play-place-id" ? placeId : null;
    }
  };
  const host = makeEventTarget();
  const surface = {
    isConnected: true,
    dataset: {
      rslQuickPlayLayout: "wide",
      rslQuickPlayActionSize: "wide",
      rslPrivateServerSupported: "unknown",
      rslPrivateServerLayout: "two"
    },
    style: { width: "180px" },
    parentElement: host,
    ...makeEventTarget(),
    closest() {
      return host;
    },
    querySelector(selector) {
      if (selector.includes('="play"')) {
        return playButton;
      }
      if (selector.includes('="private"')) {
        return privateButton;
      }
      return null;
    }
  };
  return { placeId, surface, privateButton, host };
}

async function runRecoveryRegression() {
  const startedAt = 1_800_000_000_000;
  const clock = new FakeClock(startedAt);
  const localStorageData = {};
  const sessionStorageData = {};
  const runtimeMessageListeners = [];
  const surfaceFixtures = ["1001", "1002", "1003", "1004", "1005"].map(
    makeSurface
  );
  const surfaces = surfaceFixtures.map((fixture) => fixture.surface);

  let intersectionObserver = null;
  let intersectionDeliveries = 0;
  class FakeIntersectionObserver {
    constructor(callback) {
      this.callback = callback;
      this.observed = new Set();
      intersectionObserver = this;
    }

    observe(target) {
      this.observed.add(target);
    }

    unobserve(target) {
      this.observed.delete(target);
    }

    disconnect() {
      this.observed.clear();
    }

    deliverVisibleOnce() {
      intersectionDeliveries += 1;
      this.callback(
        Array.from(this.observed, (target) => ({
          target,
          isIntersecting: true
        }))
      );
    }
  }

  const supportStats = {
    active: 0,
    maxActive: 0,
    order: [],
    startedAt: [],
    attemptsByUniverse: new Map(),
    credentials: []
  };
  let simulateThirdRequestRateLimit = true;
  const delay = (milliseconds) =>
    new Promise((resolve) => clock.setTimeout(resolve, milliseconds));
  const jsonResponse = (value, status = 200, headers = {}) =>
    new Response(JSON.stringify(value), {
      status,
      headers: { "Content-Type": "application/json", ...headers }
    });

  const fixtureUniverseIds = new Map([
    ["1001", "91001"],
    ["1002", "91002"],
    ["1003", "91003"],
    ["1004", "91004"],
    ["1005", "91005"],
    ["2001", "92001"],
    ["2002", "92002"],
    ["2003", "92003"],
    ["2004", "92004"],
    ["606849621", "245662005"]
  ]);
  const fixturePrivateServerPrices = new Map([
    ["91001", 200],
    ["91002", 0],
    ["245662005", 200]
  ]);
  const fetch = async (input, options = {}) => {
    const url = new URL(String(input));
    const universeMatch =
      /^\/universes\/v1\/places\/(\d+)\/universe$/.exec(url.pathname);
    if (
      url.hostname === "apis.roblox.com" &&
      universeMatch &&
      fixtureUniverseIds.has(universeMatch[1])
    ) {
      const placeId = universeMatch[1];
      return jsonResponse({ universeId: Number(fixtureUniverseIds.get(placeId)) });
    }

    if (
      url.hostname === "apis.roblox.com" &&
      url.pathname === "/private-servers-api/Universe-Private-Server-Settings"
    ) {
      supportStats.credentials.push(options.credentials);
      const universeId = url.searchParams.get("universeId");
      const attempt = (supportStats.attemptsByUniverse.get(universeId) || 0) + 1;
      supportStats.attemptsByUniverse.set(universeId, attempt);
      supportStats.order.push(universeId);
      supportStats.startedAt.push(clock.now);
      supportStats.active += 1;
      supportStats.maxActive = Math.max(supportStats.maxActive, supportStats.active);
      try {
        // The third request is both slower than the first two and rate limited.
        // It is the exact point at which the old queue stranded later cards.
        await delay(supportStats.order.length === 3 ? 25 : 5);
        if (
          simulateThirdRequestRateLimit &&
          supportStats.order.length === 3 &&
          attempt === 1
        ) {
          return jsonResponse(
            { errors: [{ code: 429, message: "Fixture rate limit" }] },
            429,
            {
              "Retry-After": "0",
              "x-ratelimit-remaining": "0",
              "x-ratelimit-reset": "30"
            }
          );
        }
        return jsonResponse({
          privateServerData: {
            isAvailable: true,
            privateServerProductId: Number(`7${universeId}`),
            privateServerLimit: 10,
            price: fixturePrivateServerPrices.get(universeId) ?? 100
          }
        });
      } finally {
        supportStats.active -= 1;
      }
    }

    return jsonResponse(
      { errors: [{ code: 404, message: `Unexpected fixture URL: ${url.href}` }] },
      404
    );
  };

  class FakeDate extends Date {
    constructor(...args) {
      super(...(args.length > 0 ? args : [clock.now]));
    }

    static now() {
      return clock.now;
    }
  }

  const chrome = {
    runtime: {
      id: "private-support-recovery-fixture",
      lastError: null,
      onInstalled: { addListener() {} },
      onMessage: {
        addListener(listener) {
          runtimeMessageListeners.push(listener);
        }
      },
      sendMessage(message, callback) {
        const sender = {
          id: chrome.runtime.id,
          frameId: 0,
          url: "https://www.roblox.com/home",
          tab: { id: 1, url: "https://www.roblox.com/home" }
        };
        for (const listener of runtimeMessageListeners) {
          let responded = false;
          const keepChannelOpen = listener(message, sender, (response) => {
            responded = true;
            queueMicrotask(() => callback?.(response));
          });
          if (responded || keepChannelOpen === true) {
            return;
          }
        }
        queueMicrotask(() => callback?.(undefined));
      }
    },
    storage: {
      local: makeStorageArea(localStorageData),
      session: makeStorageArea(sessionStorageData),
      onChanged: { addListener() {} }
    },
    contextMenus: {
      create(_properties, callback) {
        callback?.();
      },
      removeAll(callback) {
        callback?.();
      },
      onClicked: { addListener() {} }
    },
    tabs: { sendMessage() {} },
    scripting: { executeScript: async () => [] }
  };

  const document = {
    querySelectorAll(selector) {
      return selector === "[data-rsl-quick-play-surface]" ? surfaces : [];
    }
  };
  const deterministicMath = Object.create(Math);
  deterministicMath.random = () => 0.5;
  const contentTestHooks = { skipInitialize: true };
  const sandbox = {
    URL,
    Response,
    Headers,
    AbortController,
    TextDecoder,
    console,
    crypto: globalThis.crypto,
    chrome,
    document,
    fetch,
    Date: FakeDate,
    Math: deterministicMath,
    IntersectionObserver: FakeIntersectionObserver,
    setTimeout: clock.setTimeout.bind(clock),
    clearTimeout: clock.clearTimeout.bind(clock),
    queueMicrotask,
    __rslBackgroundTestHooks: {},
    __rslContentTestHooks: contentTestHooks,
    globalThis: null,
    window: null
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);

  vm.runInContext(backgroundSource, context, { filename: "background.js" });
  vm.runInContext(contentSource, context, { filename: "content.js" });
  const getStoredSupportSnapshot = () =>
    localStorageData.rslPrivateServerSupportCacheV2 ||
    sessionStorageData.rslPrivateServerSupportCacheV2 ||
    null;
  const sendRuntimeMessage = (message) =>
    new Promise((resolve) => chrome.runtime.sendMessage(message, resolve));
  assert.equal(
    typeof contentTestHooks.observePrivateServerSupport,
    "function",
    "content support observer test hook was not installed"
  );

  for (const fixture of surfaceFixtures) {
    contentTestHooks.observePrivateServerSupport(fixture.surface);
    assert.equal(fixture.host.listenerCount("pointerenter"), 1);
    assert.equal(fixture.host.listenerCount("focusin"), 1);
    assert.equal(fixture.surface.listenerCount("pointerenter"), 0);
    assert.equal(fixture.surface.listenerCount("focusin"), 0);
  }

  // Mounting or merely intersecting cards must not spend Roblox's per-game
  // capability quota. Support is demand-loaded by direct pointer or keyboard
  // interaction instead. Keep this conditional so removing IntersectionObserver
  // altogether remains a valid implementation.
  if (intersectionObserver) {
    intersectionObserver.deliverVisibleOnce();
  }
  await clock.advanceTo(startedAt + 1);
  assert.equal(
    supportStats.order.length,
    0,
    "mount/intersection eagerly requested private-server support"
  );
  assert.equal(
    surfaceFixtures.every(
      (fixture) => fixture.surface.dataset.rslPrivateSupportActivated !== "true"
    ),
    true,
    "uninteracted cards were marked support-active"
  );

  // Pointer interaction checks exactly the card under the pointer. Repeating
  // the interaction must reuse the confirmed content/background cache.
  surfaceFixtures[0].host.dispatch("pointerenter");
  await clock.advanceTo(startedAt + 100);
  assert.equal(surfaceFixtures[0].surface.dataset.rslPrivateSupportActivated, "true");
  assert.equal(surfaceFixtures[0].surface.dataset.rslPrivateServerSupported, "true");
  assert.equal(
    surfaceFixtures[0].surface.dataset.rslPrivateServerPrice,
    "200",
    "the paid price did not reach the hovered card surface"
  );
  assert.equal(surfaceFixtures[0].privateButton.hidden, false);
  for (const fixture of surfaceFixtures.slice(1)) {
    assert.equal(fixture.surface.dataset.rslPrivateServerSupported, "unknown");
    assert.equal(fixture.privateButton.hidden, true);
  }
  assert.deepEqual(supportStats.order, ["91001"]);
  const paidRuntimeSupport = await sendRuntimeMessage({
    type: "rsl:get-private-server-support",
    requestId: 101,
    placeId: "1001"
  });
  assert.deepEqual(
    {
      ok: paidRuntimeSupport.ok,
      requestId: paidRuntimeSupport.requestId,
      placeId: paidRuntimeSupport.placeId,
      enabled: paidRuntimeSupport.enabled,
      stale: paidRuntimeSupport.stale,
      price: paidRuntimeSupport.price
    },
    {
      ok: true,
      requestId: 101,
      placeId: "1001",
      enabled: true,
      stale: false,
      price: 200
    },
    "paid private-server price did not survive the runtime boundary"
  );
  assert.equal(
    getStoredSupportSnapshot()?.entries?.["1001"]?.price,
    200,
    "paid private-server price was not persisted"
  );
  surfaceFixtures[0].host.dispatch("pointerenter");
  await clock.advanceTo(startedAt + 101);
  assert.deepEqual(
    supportStats.order,
    ["91001"],
    "re-entering a confirmed card performed another Roblox lookup"
  );

  // focusin is the keyboard-accessible equivalent of pointerenter.
  surfaceFixtures[1].host.dispatch("focusin");
  await clock.advanceTo(startedAt + 300);
  assert.equal(surfaceFixtures[1].surface.dataset.rslPrivateSupportActivated, "true");
  assert.equal(surfaceFixtures[1].surface.dataset.rslPrivateServerSupported, "true");
  assert.equal(
    surfaceFixtures[1].surface.dataset.rslPrivateServerPrice,
    "0",
    "a free price disappeared before the dialog could read it"
  );
  assert.equal(surfaceFixtures[1].privateButton.hidden, false);
  assert.deepEqual(supportStats.order, ["91001", "91002"]);
  const freeRuntimeSupport = await sendRuntimeMessage({
    type: "rsl:get-private-server-support",
    requestId: 102,
    placeId: "1002"
  });
  assert.equal(freeRuntimeSupport.price, 0, "a free private server lost its zero price");
  assert.equal(
    getStoredSupportSnapshot()?.entries?.["1002"]?.price,
    0,
    "a free private server was not persisted distinctly from an unknown price"
  );

  // Explicitly interact with the remaining cards to exercise the shared 429
  // recovery path without relying on an eager visibility scan.
  for (const fixture of surfaceFixtures.slice(2)) {
    fixture.host.dispatch("pointerenter");
  }

  // Reach the delayed third 429. The first two cards should be confirmed, while
  // later work remains queued and hidden instead of becoming false.
  await clock.advanceTo(startedAt + 500);
  for (const fixture of surfaceFixtures.slice(0, 2)) {
    assert.equal(fixture.surface.dataset.rslPrivateServerSupported, "true");
    assert.equal(fixture.privateButton.hidden, false);
  }
  for (const fixture of surfaceFixtures.slice(2)) {
    assert.equal(fixture.surface.dataset.rslPrivateServerSupported, "unknown");
    assert.equal(fixture.privateButton.hidden, true);
  }
  assert.equal(supportStats.order.length, 3);
  assert.deepEqual(
    Object.keys(
      getStoredSupportSnapshot()?.entries || {}
    ).sort(),
    ["1001", "1002"]
  );

  // No second pointer event, focus, or page reload occurs here.
  // Advancing through the worker's cooldown must recover the requeued request
  // and every card that was waiting behind it.
  await clock.advanceTo(startedAt + 32_000);
  for (const fixture of surfaceFixtures) {
    assert.equal(
      fixture.surface.dataset.rslPrivateServerSupported,
      "true",
      `Place ${fixture.placeId} did not recover automatically`
    );
    assert.equal(fixture.privateButton.hidden, false);
    assert.equal(fixture.surface.dataset.rslPrivateServerLayout, "three");
  }
  assert.equal(
    intersectionDeliveries <= 1,
    true,
    "test accidentally retriggered visibility"
  );
  if (intersectionObserver) {
    assert.equal(intersectionObserver.observed.size, 0);
  }
  assert.equal(supportStats.maxActive <= 2, true);
  assert.deepEqual(supportStats.order, [
    "91001",
    "91002",
    "91003",
    "91003",
    "91004",
    "91005"
  ]);
  assert.equal(supportStats.attemptsByUniverse.get("91003"), 2);
  assert.equal(
    supportStats.startedAt[3] - supportStats.startedAt[2] >= 30_000,
    true,
    "the 429 request was retried before the shared cooldown"
  );

  const storedEntries =
    getStoredSupportSnapshot()?.entries || {};
  assert.deepEqual(Object.keys(storedEntries).sort(), [
    "1001",
    "1002",
    "1003",
    "1004",
    "1005"
  ]);
  assert.equal(
    Object.values(storedEntries).every((entry) => entry.enabled === true),
    true,
    "a transient rate limit was persisted as unsupported"
  );

  // A service-worker restart must retain both a paid price and the meaningful
  // zero used for a free private server without another Roblox request.
  await sandbox.__rslBackgroundTestHooks.resetPrivateServerSupportMemoryForTests();
  supportStats.order.length = 0;
  supportStats.credentials.length = 0;
  const [rehydratedPaidSupport, rehydratedFreeSupport] = await Promise.all([
    sandbox.__rslBackgroundTestHooks.getPrivateServerSupport("1001"),
    sandbox.__rslBackgroundTestHooks.getPrivateServerSupport("1002")
  ]);
  assert.equal(rehydratedPaidSupport.price, 200);
  assert.equal(rehydratedFreeSupport.price, 0);
  assert.equal(
    supportStats.order.length,
    0,
    "rehydrating persisted prices unexpectedly repeated Roblox lookups"
  );

  // Reproduce the real Jailbreak failure: known cards are stale and arrive
  // before a never-seen card. Known support must render without waiting, while
  // Jailbreak gets the first network slot instead of sitting behind refreshes.
  const secondStartedAt = clock.now;
  const legacyConfirmedAt = secondStartedAt - 2 * 60 * 60_000;
  localStorageData.rslPrivateServerSupportCacheV2 = {
    version: 2,
    rateLimitedUntil: 0,
    entries: {
      "2001": {
        universeId: "92001",
        enabled: true,
        expiresAt: legacyConfirmedAt + 5 * 60_000,
        staleUntil: legacyConfirmedAt + 30 * 60_000
      },
      "2002": {
        universeId: "92002",
        enabled: true,
        price: -1,
        expiresAt: secondStartedAt - 1_000,
        staleUntil: secondStartedAt + 24 * 60 * 60_000
      },
      "2003": {
        universeId: "92003",
        enabled: true,
        price: "400",
        expiresAt: secondStartedAt - 1_000,
        staleUntil: secondStartedAt + 24 * 60 * 60_000
      },
      "2004": {
        universeId: "92004",
        enabled: false,
        expiresAt: legacyConfirmedAt + 5 * 60_000,
        staleUntil: legacyConfirmedAt + 30 * 60_000
      }
    }
  };
  await sandbox.__rslBackgroundTestHooks.resetPrivateServerSupportMemoryForTests();
  simulateThirdRequestRateLimit = false;
  supportStats.order.length = 0;
  supportStats.startedAt.length = 0;
  supportStats.attemptsByUniverse.clear();

  let legacySettled = false;
  let firstStaleSettled = false;
  let secondStaleSettled = false;
  let legacyFalseSettled = false;
  let jailbreakSettled = false;
  const legacyRequest = sandbox.__rslBackgroundTestHooks
    .getPrivateServerSupport("2001")
    .then((value) => {
      legacySettled = true;
      return value;
    });
  const firstStaleRequest = sandbox.__rslBackgroundTestHooks
    .getPrivateServerSupport("2002")
    .then((value) => {
      firstStaleSettled = true;
      return value;
    });
  const secondStaleRequest = sandbox.__rslBackgroundTestHooks
    .getPrivateServerSupport("2003")
    .then((value) => {
      secondStaleSettled = true;
      return value;
    });
  const legacyFalseRequest = sandbox.__rslBackgroundTestHooks
    .getPrivateServerSupport("2004")
    .then((value) => {
      legacyFalseSettled = true;
      return value;
    });
  const jailbreakRequest = sandbox.__rslBackgroundTestHooks
    .getPrivateServerSupport("606849621")
    .then((value) => {
      jailbreakSettled = true;
      return value;
    });

  await clock.flushMicrotasks();
  assert.equal(legacySettled, true, "legacy true support was not migrated");
  assert.equal(firstStaleSettled, true, "first stale card waited for refresh");
  assert.equal(secondStaleSettled, true, "second stale card waited for refresh");
  assert.equal(legacyFalseSettled, true, "legacy false support waited for refresh");
  assert.equal(jailbreakSettled, false, "fixture network delay did not apply");
  assert.deepEqual(
    supportStats.order,
    ["245662005"],
    "stale refreshes started before never-seen Jailbreak"
  );

  await clock.advanceTo(secondStartedAt + 10);
  const jailbreakSupport = await jailbreakRequest;
  assert.equal(jailbreakSupport.enabled, true);
  assert.equal(jailbreakSupport.stale, false);

  await clock.advanceTo(secondStartedAt + 2_000);
  const [legacySupport, firstStaleSupport, secondStaleSupport, legacyFalseSupport] =
    await Promise.all([
      legacyRequest,
      firstStaleRequest,
      secondStaleRequest,
      legacyFalseRequest
    ]);
  assert.equal(
    legacySupport.stale,
    true,
    "legacy support without a price must stay usable while its price refreshes"
  );
  assert.equal(
    legacySupport.price,
    null,
    "a legacy support-cache entry without price must hydrate as unknown, not free"
  );
  assert.equal(firstStaleSupport.stale, true);
  assert.equal(secondStaleSupport.stale, true);
  assert.equal(
    firstStaleSupport.price,
    null,
    "a negative stored price must normalize to unknown"
  );
  assert.equal(
    secondStaleSupport.price,
    null,
    "a string stored price must normalize to unknown rather than crossing runtime"
  );
  assert.equal(legacyFalseSupport.enabled, false);
  assert.equal(
    legacyFalseSupport.price,
    null,
    "legacy unsupported cache data without price must remain valid"
  );
  assert.equal(
    legacyFalseSupport.stale,
    true,
    "legacy unsupported support was incorrectly extended as fresh"
  );
  assert.deepEqual(
    supportStats.order,
    ["245662005", "92001", "92002", "92003", "92004"],
    "deferred refreshes did not resume after Jailbreak completed"
  );
  assert.equal(
    localStorageData.rslPrivateServerSupportCacheV2.entries["2001"].price,
    100,
    "legacy support did not persist its refreshed price"
  );
  const refreshedLegacyFalse = await sandbox.__rslBackgroundTestHooks
    .getPrivateServerSupport("2004");
  assert.equal(refreshedLegacyFalse.enabled, true);
  assert.equal(refreshedLegacyFalse.stale, false);
  assert.equal(
    localStorageData.rslPrivateServerSupportCacheV2.entries["606849621"].enabled,
    true,
    "Jailbreak support was not persisted"
  );
  assert.equal(
    localStorageData.rslPrivateServerSupportCacheV2.entries["606849621"].price,
    200,
    "Jailbreak's private-server price was not persisted"
  );

  assert.ok(
    supportStats.credentials.length > 0 &&
      supportStats.credentials.every((credentials) => credentials === "omit"),
    "private-server support settings requests must not send Roblox credentials"
  );

  // A home page can expose more than 100 experiences. Reproduce a full reload
  // with 150 confirmed entries already persisted: hydration must retain every
  // entry, or the strict DOM-order request queue will evict later cached cards
  // before the content script has a chance to ask for them.
  assert.match(
    backgroundSource,
    /const PRIVATE_SERVER_SUPPORT_CACHE_MAX_ENTRIES = 1_000;/,
    "the persisted support cache must be large enough for a 150-card page"
  );
  const reloadStartedAt = clock.now;
  const reloadedPlaceIds = Array.from(
    { length: 150 },
    (_, index) => String(300_001 + index)
  );
  localStorageData.rslPrivateServerSupportCacheV2 = {
    version: 2,
    rateLimitedUntil: 0,
    entries: Object.fromEntries(
      reloadedPlaceIds.map((placeId, index) => [
        placeId,
        {
          universeId: String(930_001 + index),
          enabled: true,
          price: 100,
          expiresAt: reloadStartedAt + 24 * 60 * 60_000,
          staleUntil: reloadStartedAt + 7 * 24 * 60 * 60_000
        }
      ])
    )
  };
  await sandbox.__rslBackgroundTestHooks.resetPrivateServerSupportMemoryForTests();
  supportStats.order.length = 0;
  supportStats.startedAt.length = 0;
  supportStats.attemptsByUniverse.clear();
  supportStats.credentials.length = 0;

  const reloadedSupport = await Promise.all(
    reloadedPlaceIds.map((placeId) =>
      sandbox.__rslBackgroundTestHooks.getPrivateServerSupport(placeId)
    )
  );
  assert.equal(
    supportStats.order.length,
    0,
    "hydrating 150 persisted support entries unexpectedly repeated network checks"
  );
  assert.equal(
    supportStats.credentials.length,
    0,
    "hydrated support entries unexpectedly reached the settings endpoint"
  );
  assert.equal(reloadedSupport.length, 150);
  assert.equal(
    reloadedSupport.every(
      (support) =>
        support.enabled === true && support.stale === false && support.price === 100
    ),
    true,
    "current hydrated support entries did not retain their prices"
  );
}

module.exports = { runRecoveryRegression };

if (require.main === module) {
  runRecoveryRegression()
    .then(() => {
      console.log(
        "PASS Private-server support recovers rate limits and prioritizes unseen games over stale refreshes"
      );
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
