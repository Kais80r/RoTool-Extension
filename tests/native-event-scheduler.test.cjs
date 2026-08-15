"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const OWNED_ATTRIBUTE = "data-rsl-native-event-schedule";
const CARD_SELECTOR =
  'li.experience-events-tile.contained-tile[data-testid="wide-game-tile"][id]';
const REGION_SELECTOR =
  "#game-details-about-tab-container .virtual-event-game-details-container";
const FULL_CARD_SELECTOR = `${REGION_SELECTOR} ${CARD_SELECTOR}`;
const FEATURED_SELECTOR = ".featured-game-container.game-card-container";

const cards = [];
const timers = new Map();
let nextTimerId = 1;
let currentPage = {
  placeId: "1001",
  rootPlaceId: "1001",
  universeId: "2001",
  gameName: "Fixture Game"
};

class FakeButton {
  constructor() {
    this.attributes = new Map();
    this.listeners = new Map();
    this.parentElement = null;
    this.type = "";
    this.className = "";
    this.textContent = "";
    this.title = "";
    this.disabled = false;
  }

  get isConnected() {
    return Boolean(
      this.parentElement &&
      cards.includes(this.parentElement.card) &&
      this.parentElement.children.includes(this)
    );
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  closest(selector) {
    return selector === CARD_SELECTOR ? this.parentElement?.card || null : null;
  }

  remove() {
    if (!this.parentElement) return;
    const index = this.parentElement.children.indexOf(this);
    if (index >= 0) this.parentElement.children.splice(index, 1);
    this.parentElement = null;
  }
}

function makeCard(id, { href = `/de/events/${id}`, nativeLabel = "Notify Me" } = {}) {
  const card = {
    id,
    matches(selector) { return selector === CARD_SELECTOR; },
    closest(selector) { return selector === REGION_SELECTOR ? region : null; },
    querySelector(selector) { return selector === FEATURED_SELECTOR ? featured : null; }
  };
  const region = {};
  const featured = {
    card,
    children: [],
    closest(selector) { return selector === "li" ? card : null; },
    contains(node) { return this.children.includes(node); },
    querySelector(selector) {
      return selector === ".event-follow-button, .event-unfollow-button"
        ? nativeAction
        : null;
    },
    querySelectorAll(selector) {
      if (selector === "a.game-card-link[href]") return [link];
      if (selector === `[${OWNED_ATTRIBUTE}]`) {
        return this.children.filter((child) =>
          child instanceof FakeButton && child.getAttribute(OWNED_ATTRIBUTE) !== null
        );
      }
      return [];
    }
  };
  const link = {
    parentElement: featured,
    get nextElementSibling() {
      const index = featured.children.indexOf(this);
      return featured.children[index + 1] || null;
    },
    getAttribute(name) { return name === "href" ? href : null; },
    closest(selector) { return selector === "li" ? card : null; },
    insertAdjacentElement(position, element) {
      assert.equal(position, "afterend");
      const existingIndex = featured.children.indexOf(element);
      if (existingIndex >= 0) featured.children.splice(existingIndex, 1);
      const linkIndex = featured.children.indexOf(link);
      featured.children.splice(linkIndex + 1, 0, element);
      element.parentElement = featured;
      return element;
    }
  };
  const nativeAction = {
    textContent: nativeLabel,
    marker: Symbol("native-action"),
    closest(selector) { return selector === "li" ? card : null; }
  };
  featured.children.push(link, nativeAction);
  return { card, featured, link, nativeAction };
}

function ownedButtons() {
  return cards.flatMap((card) => {
    const featured = card.querySelector(FEATURED_SELECTOR);
    return featured.querySelectorAll(`[${OWNED_ATTRIBUTE}]`);
  });
}

const fakeDocument = {
  documentElement: { lang: "de" },
  getElementById() { return null; },
  querySelector(selector) {
    if (selector === "#game-detail-page") {
      return { dataset: { placeId: currentPage.placeId } };
    }
    if (selector === "#game-detail-meta-data") {
      return {
        dataset: {
          placeId: currentPage.placeId,
          rootPlaceId: currentPage.rootPlaceId,
          universeId: currentPage.universeId,
          placeName: currentPage.gameName
        }
      };
    }
    return null;
  },
  querySelectorAll(selector) {
    if (selector === FULL_CARD_SELECTOR) return cards.slice();
    if (selector === `[${OWNED_ATTRIBUTE}]`) return ownedButtons();
    return [];
  },
  createElement(tagName) {
    assert.equal(tagName, "button");
    return new FakeButton();
  }
};

const fakeWindow = {
  top: null,
  setTimeout(callback, delay) {
    const id = nextTimerId++;
    timers.set(id, { callback, delay });
    return id;
  },
  clearTimeout(id) { timers.delete(id); }
};
fakeWindow.top = fakeWindow;

function schedulerResponse(message, rawEvents) {
  return {
    ok: true,
    requestId: message.requestId,
    enabled: true,
    placeId: message.placeId,
    universeId: currentPage.universeId,
    checkedAt: Date.now(),
    events: rawEvents
  };
}

function futureEvent(id, overrides = {}) {
  const now = Date.now();
  return {
    id,
    universeId: currentPage.universeId,
    placeId: currentPage.placeId,
    gameName: currentPage.gameName,
    title: `Fixture Event ${id}`,
    startAt: now + 60 * 60_000,
    endAt: now + 61 * 60_000,
    status: "upcoming",
    ...overrides
  };
}

async function settle(hooks) {
  for (let index = 0; index < 20; index += 1) {
    await Promise.resolve();
    if (!hooks.getNativeEventScheduleStateForTests().requestPending) return;
  }
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(hooks.getNativeEventScheduleStateForTests().requestPending, false);
}

const previousGlobals = Object.fromEntries(
  ["window", "document", "location", "__rslContentTestHooks", "__rslJoinSchedulerModal"]
    .map((name) => [name, globalThis[name]])
);

(async () => {
  try {
    globalThis.window = fakeWindow;
    globalThis.document = fakeDocument;
    globalThis.location = { href: "https://www.roblox.com/de/games/1001/fixture-game" };
    globalThis.__rslContentTestHooks = { skipInitialize: true };
    const contentPath = path.join(projectRoot, "content.js");
    delete require.cache[require.resolve(contentPath)];
    require(contentPath);
    const hooks = globalThis.__rslContentTestHooks;
    hooks.setFeatureSettingsForTests({
      version: 1,
      flags: { joinScheduler: true, gameEvents: false }
    });

    const eventId = "123e4567-e89b-42d3-a456-426614174000";
    const firstCard = makeCard(eventId);
    cards.push(firstCard.card);
    const requests = [];
    hooks.setNativeEventScheduleMessageSenderForTests(async (message) => {
      requests.push(JSON.parse(JSON.stringify(message)));
      return schedulerResponse(message, [futureEvent(eventId)]);
    });
    hooks.mountNativeEventScheduleButtons();
    await settle(hooks);

    assert.deepEqual(requests, [{
      type: "rsl:get-native-event-schedule-data",
      requestId: 1,
      placeId: "1001",
      eventIds: [eventId],
      locale: "de"
    }]);
    assert.equal(firstCard.featured.children.length, 3);
    const button = ownedButtons()[0];
    assert.ok(button instanceof FakeButton);
    assert.equal(button.type, "button");
    assert.equal(button.textContent, "Schedule with RoTool");
    assert.equal(button.getAttribute("aria-haspopup"), "dialog");
    assert.equal(
      button.getAttribute("aria-label"),
      `Schedule Fixture Event ${eventId} with RoTool`
    );
    assert.equal(button.parentElement, firstCard.featured);
    assert.equal(firstCard.link.nextElementSibling, button);
    assert.equal(firstCard.featured.children[2], firstCard.nativeAction);
    assert.equal(firstCard.nativeAction.textContent, "Notify Me");

    const duplicate = new FakeButton();
    duplicate.setAttribute(OWNED_ATTRIBUTE, eventId);
    duplicate.parentElement = firstCard.featured;
    firstCard.featured.children.push(duplicate);
    hooks.reconcileNativeEventScheduleButtons();
    assert.deepEqual(ownedButtons(), [button]);
    assert.equal(duplicate.isConnected, false);

    const replacementCard = makeCard(eventId);
    cards.splice(0, 1, replacementCard.card);
    hooks.mountNativeEventScheduleButtons();
    const replacementButton = ownedButtons()[0];
    assert.ok(replacementButton instanceof FakeButton);
    assert.notEqual(replacementButton, button);
    assert.equal(replacementCard.link.nextElementSibling, replacementButton);
    assert.equal(replacementCard.featured.children[2], replacementCard.nativeAction);
    assert.equal(requests.length, 1, "a React remount reuses verified Event data");

    const modalCalls = [];
    globalThis.__rslJoinSchedulerModal = {
      async open(draft, trigger) {
        modalCalls.push({ draft, trigger });
        return true;
      },
      destroy() {}
    };
    let prevented = 0;
    let stopped = 0;
    replacementButton.listeners.get("click")({
      isTrusted: false,
      preventDefault() { prevented += 1; },
      stopPropagation() { stopped += 1; }
    });
    await Promise.resolve();
    assert.equal(modalCalls.length, 0);
    assert.equal(prevented, 0);
    assert.equal(stopped, 0);

    replacementButton.listeners.get("click")({
      isTrusted: true,
      preventDefault() { prevented += 1; },
      stopPropagation() { stopped += 1; }
    });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(prevented, 1);
    assert.equal(stopped, 1);
    assert.equal(modalCalls.length, 1);
    assert.deepEqual(modalCalls[0].draft, {
      universeId: "2001",
      placeId: "1001",
      gameName: "Fixture Game",
      title: `Fixture Event ${eventId}`,
      startAt: modalCalls[0].draft.startAt,
      endAt: modalCalls[0].draft.endAt,
      eventId
    });
    assert.deepEqual(Object.keys(modalCalls[0].draft).sort(), [
      "endAt", "eventId", "gameName", "placeId", "startAt", "title", "universeId"
    ]);

    hooks.setFeatureSettingsForTests({
      version: 1,
      flags: { joinScheduler: false, gameEvents: true }
    });
    hooks.mountNativeEventScheduleButtons();
    assert.equal(ownedButtons().length, 0);
    assert.deepEqual(hooks.getNativeEventScheduleStateForTests(), {
      lifecycleEpoch: hooks.getNativeEventScheduleStateForTests().lifecycleEpoch,
      requestSequence: 1,
      routePlaceId: null,
      cardFingerprint: "",
      requestPending: false,
      nextRefreshAt: 0,
      events: []
    });
    assert.equal(timers.size, 0);

    hooks.setFeatureSettingsForTests({
      version: 1,
      flags: { joinScheduler: true, gameEvents: false }
    });
    const liveId = "777";
    const liveCard = makeCard(liveId, { nativeLabel: "Join Event" });
    cards.splice(0, 1, liveCard.card);
    hooks.setNativeEventScheduleMessageSenderForTests(async (message) => {
      requests.push(JSON.parse(JSON.stringify(message)));
      const checkedAt = Date.now();
      return schedulerResponse(message, [{
        ...futureEvent(liveId),
        startAt: checkedAt - 1_000,
        endAt: checkedAt + 60_000,
        status: "live"
      }]);
    });
    hooks.mountNativeEventScheduleButtons();
    await settle(hooks);
    assert.equal(liveCard.nativeAction.textContent, "Join Event");
    assert.equal(ownedButtons().length, 0,
      "a live native Join Event never receives a Scheduler action");

    hooks.resetNativeEventScheduleStateForTests();
    currentPage = {
      placeId: "1001",
      rootPlaceId: "1001",
      universeId: "2001",
      gameName: "Old Game"
    };
    globalThis.location.href = "https://www.roblox.com/games/1001/old-game";
    const oldId = "888";
    const oldCard = makeCard(oldId, { href: `/events/${oldId}` });
    cards.splice(0, 1, oldCard.card);
    let resolveOldRequest;
    let oldRequestMessage;
    hooks.setNativeEventScheduleMessageSenderForTests((message) => {
      if (message.placeId === "1001") {
        oldRequestMessage = JSON.parse(JSON.stringify(message));
        return new Promise((resolve) => { resolveOldRequest = resolve; });
      }
      return schedulerResponse(message, [futureEvent("999")]);
    });
    hooks.mountNativeEventScheduleButtons();

    currentPage = {
      placeId: "9999",
      rootPlaceId: "9999",
      universeId: "3001",
      gameName: "New Game"
    };
    globalThis.location.href = "https://www.roblox.com/en-us/games/9999/new-game";
    const newCard = makeCard("999", { href: "/en-us/events/999" });
    cards.splice(0, 1, newCard.card);
    hooks.mountNativeEventScheduleButtons();
    await Promise.resolve();
    await settle(hooks);
    assert.equal(ownedButtons()[0]?.getAttribute(OWNED_ATTRIBUTE), "999");

    assert.equal(typeof resolveOldRequest, "function");
    resolveOldRequest({
      ok: true,
      requestId: oldRequestMessage.requestId,
      enabled: true,
      placeId: "1001",
      universeId: "2001",
      checkedAt: Date.now(),
      events: [{
        id: oldId,
        universeId: "2001",
        placeId: "1001",
        gameName: "Old Game",
        title: "Stale Event",
        startAt: Date.now() + 60 * 60_000,
        endAt: Date.now() + 61 * 60_000,
        status: "upcoming"
      }]
    });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(ownedButtons()[0]?.getAttribute(OWNED_ATTRIBUTE), "999");
    assert.deepEqual(
      hooks.getNativeEventScheduleStateForTests().events.map(({ id }) => id),
      ["999"],
      "a late response cannot cross a game-detail SPA navigation"
    );

    globalThis.location.href = "https://www.roblox.com/home";
    hooks.mountNativeEventScheduleButtons();
    assert.equal(ownedButtons().length, 0);
    assert.equal(hooks.getNativeEventScheduleStateForTests().routePlaceId, null);
    assert.equal(timers.size, 0);

    console.log(
      "PASS native Event Scheduler mount, remount, trusted click, lifecycle, and cleanup contract"
    );
  } finally {
    for (const [name, value] of Object.entries(previousGlobals)) {
      if (value === undefined) delete globalThis[name];
      else globalThis[name] = value;
    }
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
