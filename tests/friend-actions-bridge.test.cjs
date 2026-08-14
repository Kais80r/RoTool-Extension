"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const RESULT_EVENT = "rotool:best-friend-action-result:v1";
const QUICK_PLAY_RESULT_EVENT = "rotool:quick-play-result:v1";
const GAME_EVENTS_LAUNCH_SURFACE_ATTRIBUTE = "data-rsl-game-events-launch-surface";
const RANDOM_SERVER_REQUEST_EVENT = "rotool:random-server-request:v1";
const RANDOM_SERVER_RESPONSE_EVENT = "rotool:random-server-response:v1";
const RESULT_CODES = new Set(["started", "unavailable", "invalid", "failed", "empty"]);
const VALID_GAME_INSTANCE_ID = "8f14e45f-ea36-4e8a-b5f9-2f912e0d7334";
const VALID_PLACE_ID = "133215910299950";

const projectRoot = path.resolve(__dirname, "..");
const bridgePath = path.join(projectRoot, "page-bridge.js");
assert.ok(fs.existsSync(bridgePath), "page-bridge.js must exist for the MAIN-world fixture");
const bridgeSource = fs.readFileSync(bridgePath, "utf8");

class FakeEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.bubbles = options.bubbles === true;
    this.cancelable = options.cancelable === true;
    this.isTrusted = options.isTrusted === true;
    this.button = options.button ?? 0;
    this.altKey = options.altKey === true;
    this.ctrlKey = options.ctrlKey === true;
    this.metaKey = options.metaKey === true;
    this.shiftKey = options.shiftKey === true;
    this.defaultPrevented = false;
    this.target = null;
    this.currentTarget = null;
    this.eventPhase = 0;
    this._path = [];
    this._propagationStopped = false;
    this._immediatePropagationStopped = false;
  }

  composedPath() {
    return [...this._path];
  }

  preventDefault() {
    if (this.cancelable) {
      this.defaultPrevented = true;
    }
  }

  stopPropagation() {
    this._propagationStopped = true;
  }

  stopImmediatePropagation() {
    this._immediatePropagationStopped = true;
    this._propagationStopped = true;
  }
}

class FakeCustomEvent extends FakeEvent {
  constructor(type, options = {}) {
    super(type, options);
    this.detail = options.detail;
  }
}

class FakeMouseEvent extends FakeEvent {}

class FakeEventTarget {
  constructor() {
    this._listeners = new Map();
    this.parentNode = null;
  }

  addEventListener(type, listener, options = false) {
    const capture = options === true || options?.capture === true;
    const once = typeof options === "object" && options?.once === true;
    const listeners = this._listeners.get(type) || [];
    listeners.push({ listener, capture, once });
    this._listeners.set(type, listeners);
  }

  removeEventListener(type, listener, options = false) {
    const capture = options === true || options?.capture === true;
    const listeners = this._listeners.get(type) || [];
    this._listeners.set(
      type,
      listeners.filter(
        (entry) => entry.listener !== listener || entry.capture !== capture
      )
    );
  }

  _invoke(event, capture, eventPhase) {
    const listeners = [...(this._listeners.get(event.type) || [])];
    event.currentTarget = this;
    event.eventPhase = eventPhase;
    event._immediatePropagationStopped = false;
    for (const entry of listeners) {
      if (entry.capture !== capture) {
        continue;
      }
      if (typeof entry.listener === "function") {
        entry.listener.call(this, event);
      } else {
        entry.listener?.handleEvent?.(event);
      }
      if (entry.once) {
        this.removeEventListener(event.type, entry.listener, { capture });
      }
      if (event._immediatePropagationStopped) {
        break;
      }
    }
  }

  dispatchEvent(event) {
    const path = [this];
    for (let node = this.parentNode; node; node = node.parentNode) {
      path.push(node);
    }
    event.target = this;
    event._path = path;

    for (let index = path.length - 1; index > 0; index -= 1) {
      path[index]._invoke(event, true, 1);
      if (event._propagationStopped) {
        break;
      }
    }

    if (!event._propagationStopped) {
      path[0]._invoke(event, true, 2);
      if (!event._immediatePropagationStopped) {
        path[0]._invoke(event, false, 2);
      }
    }

    if (event.bubbles && !event._propagationStopped) {
      for (let index = 1; index < path.length; index += 1) {
        path[index]._invoke(event, false, 3);
        if (event._propagationStopped) {
          break;
        }
      }
    }

    event.currentTarget = null;
    event.eventPhase = 0;
    return !event.defaultPrevented;
  }
}

function dataAttributeToKey(name) {
  return name
    .slice("data-".length)
    .replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

class FakeElement extends FakeEventTarget {
  static ELEMENT_NODE = 1;

  constructor(tagName, ownerDocument) {
    super();
    this.nodeType = 1;
    this.tagName = String(tagName).toUpperCase();
    this.localName = String(tagName).toLowerCase();
    this.ownerDocument = ownerDocument;
    this.attributes = new Map();
    this.dataset = {};
    this.children = [];
    this.disabled = false;
  }

  get parentElement() {
    return this.parentNode instanceof FakeElement ? this.parentNode : null;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  contains(candidate) {
    for (let node = candidate; node; node = node.parentNode) {
      if (node === this) {
        return true;
      }
    }
    return false;
  }

  setAttribute(name, value) {
    const normalized = String(name).toLowerCase();
    const stringValue = String(value);
    this.attributes.set(normalized, stringValue);
    if (normalized.startsWith("data-")) {
      this.dataset[dataAttributeToKey(normalized)] = stringValue;
    }
  }

  getAttribute(name) {
    const normalized = String(name).toLowerCase();
    return this.attributes.has(normalized) ? this.attributes.get(normalized) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(String(name).toLowerCase());
  }

  removeAttribute(name) {
    const normalized = String(name).toLowerCase();
    this.attributes.delete(normalized);
    if (normalized.startsWith("data-")) {
      delete this.dataset[dataAttributeToKey(normalized)];
    }
  }

  matches(selector) {
    return String(selector)
      .split(",")
      .some((part) => {
        const simple = part.trim();
        const match = simple.match(
          /^(?:([a-z][a-z0-9-]*))?\[([a-z0-9-]+)(?:=["']([^"']*)["'])?\]$/i
        );
        if (!match) {
          return false;
        }
        const [, tagName, attributeName, expectedValue] = match;
        if (tagName && this.localName !== tagName.toLowerCase()) {
          return false;
        }
        if (!this.hasAttribute(attributeName)) {
          return false;
        }
        return expectedValue === undefined || this.getAttribute(attributeName) === expectedValue;
      });
  }

  closest(selector) {
    for (let node = this; node instanceof FakeElement; node = node.parentElement) {
      if (node.matches(selector)) {
        return node;
      }
    }
    return null;
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (child.matches(selector)) {
          matches.push(child);
        }
        visit(child);
      }
    };
    visit(this);
    return matches;
  }
}

class FakeDocument extends FakeEventTarget {
  constructor() {
    super();
    this.nodeType = 9;
    this.documentElement = new FakeElement("html", this);
    this.body = new FakeElement("body", this);
    this.documentElement.parentNode = this;
    this.documentElement.appendChild(this.body);
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }
}

function loadBridge({
  href = "https://www.roblox.com/home",
  includeJoin = true,
  includeChat = true,
  joinImplementation,
  chatImplementation,
  quickPlayNative = "forbidden",
  quickPlayImplementation,
  randomServerNative = "forbidden",
  randomServerImplementation,
  includeLocationAssign = true,
  locationAssignImplementation
} = {}) {
  assert.ok(
    ["forbidden", "enabled", "absent"].includes(quickPlayNative),
    `unexpected Quick Play native mode: ${quickPlayNative}`
  );
  assert.ok(
    ["forbidden", "enabled", "absent"].includes(randomServerNative),
    `unexpected Random Server native mode: ${randomServerNative}`
  );
  const document = new FakeDocument();
  const joinCalls = [];
  const chatCalls = [];
  const quickPlayCalls = [];
  const randomServerCalls = [];
  const protocolLaunches = [];
  const forbiddenFallbackCalls = [];
  let joinReceiver = null;
  let chatReceiver = null;
  let quickPlayReceiver = null;
  let randomServerReceiver = null;
  let locationAssignReceiver = null;
  let nextTimerId = 1;
  const pendingTimers = new Map();

  const protocolHandler = {};
  if (includeJoin) {
    protocolHandler.followPlayerIntoGame = function (options) {
      joinReceiver = this;
      joinCalls.push({ ...options });
      return joinImplementation?.call(this, options);
    };
  }

  const chatService = {};
  if (includeChat) {
    chatService.startDesktopAndMobileWebChat = function (options) {
      chatReceiver = this;
      chatCalls.push({ ...options });
      return chatImplementation?.call(this, options);
    };
  }

  const gameLauncher = {
    followPlayerIntoGame(...args) {
      forbiddenFallbackCalls.push(["GameLauncher.followPlayerIntoGame", ...args]);
    }
  };
  if (randomServerNative === "enabled") {
    gameLauncher.joinGameInstance = function (placeId, gameInstanceId) {
      randomServerReceiver = this;
      randomServerCalls.push([placeId, gameInstanceId]);
      return randomServerImplementation?.call(this, placeId, gameInstanceId);
    };
  } else if (randomServerNative === "forbidden") {
    gameLauncher.joinGameInstance = function (...args) {
      forbiddenFallbackCalls.push(["GameLauncher.joinGameInstance", ...args]);
    };
  }
  if (quickPlayNative === "enabled") {
    gameLauncher.joinMultiplayerGame = function (placeId) {
      quickPlayReceiver = this;
      quickPlayCalls.push(placeId);
      return quickPlayImplementation?.call(this, placeId);
    };
  } else if (quickPlayNative === "forbidden") {
    gameLauncher.joinMultiplayerGame = function (...args) {
      forbiddenFallbackCalls.push(["GameLauncher.joinMultiplayerGame", ...args]);
    };
  }
  const location = new URL(href);
  if (includeLocationAssign) {
    location.assign = function (target) {
      locationAssignReceiver = this;
      protocolLaunches.push(String(target));
      return locationAssignImplementation?.call(this, target);
    };
  }

  const sandbox = {
    URL,
    CustomEvent: FakeCustomEvent,
    Element: FakeElement,
    Event: FakeEvent,
    HTMLElement: FakeElement,
    HTMLButtonElement: FakeElement,
    MouseEvent: FakeMouseEvent,
    Node: FakeElement,
    console,
    document,
    location,
    Roblox: {
      GameLauncher: gameLauncher,
      ProtocolHandlerClientInterface: protocolHandler
    },
    CoreRobloxUtilities: { chatService },
    Promise,
    queueMicrotask,
    setTimeout(callback, delay) {
      const id = nextTimerId;
      nextTimerId += 1;
      pendingTimers.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) {
      pendingTimers.delete(id);
    },
    globalThis: null,
    self: null,
    window: null
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.window = sandbox;
  document.defaultView = sandbox;

  vm.runInNewContext(bridgeSource, sandbox, { filename: "page-bridge.js" });

  function createAction({
    action,
    userId = "1075169091",
    gameInstanceId,
    insideCard = true,
    tagName = "button"
  }) {
    const card = document.createElement("div");
    if (insideCard) {
      card.setAttribute("data-rsl-best-friend-hover-card", "");
    }
    const button = document.createElement(tagName);
    button.setAttribute("data-rsl-best-friend-action", action);
    if (userId !== null) {
      button.setAttribute("data-rsl-best-friend-user-id", userId);
    }
    if (gameInstanceId !== undefined) {
      button.setAttribute("data-rsl-best-friend-game-instance-id", gameInstanceId);
    }
    card.appendChild(button);
    document.body.appendChild(card);

    const results = [];
    button.addEventListener(RESULT_EVENT, (event) => {
      assert.equal(event.target, button, "result must be dispatched from the action button");
      assert.equal(event.bubbles, true, "result must bubble to the isolated click listener");
      assert.equal(typeof event.detail, "string", "result detail must cross worlds as JSON");
      const result = JSON.parse(event.detail);
      assert.ok(RESULT_CODES.has(result.code), `unexpected result code: ${result.code}`);
      results.push(result);
    });
    return {
      button,
      card,
      results,
      click({ trusted = true, mouseButton = 0 } = {}) {
        button.dispatchEvent(
          new FakeMouseEvent("click", {
            bubbles: true,
            cancelable: true,
            isTrusted: trusted,
            button: mouseButton
          })
        );
      }
    };
  }

  function createQuickPlayAction({
    placeId = VALID_PLACE_ID,
    action = "play",
    insideSurface = true,
    tagName = "button",
    iconChild = false,
    nestedAnchor = false,
    disabled = false,
    existingSurface = null,
    surfaceAttribute = "data-rsl-quick-play-surface"
  } = {}) {
    const host = existingSurface
      ? existingSurface.parentNode
      : document.createElement(nestedAnchor ? "a" : "div");
    if (!existingSurface && nestedAnchor) {
      host.setAttribute("href", `/games/${placeId}/fixture-game`);
    }
    const surface = existingSurface || document.createElement("div");
    if (!existingSurface && insideSurface) {
      surface.setAttribute(surfaceAttribute, "");
    }
    const button = document.createElement(tagName);
    button.setAttribute("data-rsl-quick-play-action", action);
    if (placeId !== null) {
      button.setAttribute("data-rsl-quick-play-place-id", placeId);
    }
    button.disabled = disabled;

    const icon = document.createElement("span");
    if (iconChild) {
      button.appendChild(icon);
    }
    surface.appendChild(button);
    if (!existingSurface) {
      host.appendChild(surface);
      document.body.appendChild(host);
    }

    const results = [];
    const randomServerRequests = [];
    button.addEventListener(QUICK_PLAY_RESULT_EVENT, (event) => {
      assert.equal(event.target, button, "Quick Play result must originate at its button");
      assert.equal(event.bubbles, true, "Quick Play result must bubble to the isolated listener");
      assert.equal(typeof event.detail, "string", "Quick Play detail must cross worlds as JSON");
      const result = JSON.parse(event.detail);
      assert.ok(RESULT_CODES.has(result.code), `unexpected Quick Play result code: ${result.code}`);
      results.push(result);
    });
    button.addEventListener(RANDOM_SERVER_REQUEST_EVENT, (event) => {
      assert.equal(event.target, button, "Random Server request must originate at its button");
      assert.equal(event.bubbles, true, "Random Server request must bubble to the isolated listener");
      assert.equal(typeof event.detail, "string", "Random Server request must cross worlds as JSON");
      randomServerRequests.push(JSON.parse(event.detail));
    });

    const clickTarget = iconChild ? icon : button;
    return {
      button,
      clickTarget,
      host,
      randomServerRequests,
      results,
      surface,
      click({
        trusted = true,
        mouseButton = 0,
        altKey = false,
        ctrlKey = false,
        metaKey = false,
        shiftKey = false
      } = {}) {
        const event = new FakeMouseEvent("click", {
          bubbles: true,
          cancelable: true,
          isTrusted: trusted,
          button: mouseButton,
          altKey,
          ctrlKey,
          metaKey,
          shiftKey
        });
        clickTarget.dispatchEvent(event);
        return event;
      },
      respond({
        target = button,
        v = 1,
        responsePlaceId = placeId,
        code = "ready",
        gameInstanceId = VALID_GAME_INSTANCE_ID,
        detail
      } = {}) {
        const responseDetail = detail === undefined
          ? JSON.stringify({
              v,
              placeId: responsePlaceId,
              code,
              ...(gameInstanceId === undefined ? {} : { gameInstanceId })
            })
          : detail;
        target.dispatchEvent(
          new FakeCustomEvent(RANDOM_SERVER_RESPONSE_EVENT, {
            bubbles: true,
            detail: responseDetail
          })
        );
      }
    };
  }

  return {
    chatCalls,
    chatService,
    createAction,
    createQuickPlayAction,
    document,
    forbiddenFallbackCalls,
    joinCalls,
    gameLauncher,
    location,
    protocolLaunches,
    protocolHandler,
    quickPlayCalls,
    randomServerCalls,
    runAllTimers() {
      const timers = [...pendingTimers.values()];
      pendingTimers.clear();
      for (const timer of timers) {
        timer.callback();
      }
    },
    get pendingTimerDelays() {
      return [...pendingTimers.values()].map((timer) => timer.delay);
    },
    get chatReceiver() {
      return chatReceiver;
    },
    get joinReceiver() {
      return joinReceiver;
    },
    get locationAssignReceiver() {
      return locationAssignReceiver;
    },
    get quickPlayReceiver() {
      return quickPlayReceiver;
    },
    get randomServerReceiver() {
      return randomServerReceiver;
    }
  };
}

const flushMicrotasks = () => Promise.resolve().then(() => Promise.resolve());

function expectedResult(action, code) {
  return { v: 1, action, code };
}

async function main() {
  {
    const fixture = loadBridge();
    const action = fixture.createAction({
      action: "join",
      gameInstanceId: VALID_GAME_INSTANCE_ID
    });
    action.click();
    await flushMicrotasks();

    assert.deepEqual(fixture.joinCalls, [
      {
        userId: 1075169091,
        joinAttemptId: VALID_GAME_INSTANCE_ID,
        joinAttemptOrigin: "JoinUser"
      }
    ]);
    assert.equal(fixture.joinReceiver, fixture.protocolHandler);
    assert.deepEqual(action.results, [expectedResult("join", "started")]);
    assert.deepEqual(fixture.forbiddenFallbackCalls, []);
  }

  {
    const fixture = loadBridge();
    const action = fixture.createAction({ action: "join" });
    action.click();
    await flushMicrotasks();

    assert.deepEqual(fixture.joinCalls, [
      {
        userId: 1075169091,
        joinAttemptId: "",
        joinAttemptOrigin: "JoinUser"
      }
    ]);
    assert.deepEqual(action.results, [expectedResult("join", "started")]);
  }

  {
    const fixture = loadBridge();
    const action = fixture.createAction({ action: "chat", userId: "1472517946" });
    action.click();
    await flushMicrotasks();

    assert.deepEqual(fixture.chatCalls, [{ userId: 1472517946 }]);
    assert.equal(fixture.chatReceiver, fixture.chatService);
    assert.deepEqual(action.results, [expectedResult("chat", "started")]);
  }

  {
    const fixture = loadBridge();
    const action = fixture.createAction({ action: "join" });
    action.click({ trusted: false });
    await flushMicrotasks();

    assert.deepEqual(fixture.joinCalls, []);
    assert.deepEqual(action.results, []);
  }

  {
    const fixture = loadBridge();
    const action = fixture.createAction({ action: "chat", insideCard: false });
    action.click();
    await flushMicrotasks();

    assert.deepEqual(fixture.chatCalls, []);
    assert.deepEqual(action.results, []);
  }

  {
    const fixture = loadBridge();
    const action = fixture.createAction({ action: "join", tagName: "div" });
    action.click();
    await flushMicrotasks();

    assert.deepEqual(fixture.joinCalls, [], "a non-button action element reached Join");
    assert.deepEqual(action.results, []);
  }

  for (const userId of [null, "", "0", "0001", "1e3", "9007199254740992"]) {
    const fixture = loadBridge();
    const action = fixture.createAction({ action: "join", userId });
    action.click();
    await flushMicrotasks();

    assert.deepEqual(fixture.joinCalls, [], `invalid user ID reached Join: ${userId}`);
    assert.deepEqual(action.results, [expectedResult("join", "invalid")]);
  }

  for (const gameInstanceId of [
    "not-a-uuid",
    `${VALID_GAME_INSTANCE_ID}extra`,
    "8f14e45f-ea36-4e8a-b5f9-2f912e0d733z"
  ]) {
    const fixture = loadBridge();
    const action = fixture.createAction({ action: "join", gameInstanceId });
    action.click();
    await flushMicrotasks();

    assert.deepEqual(fixture.joinCalls, [], `invalid game UUID reached Join: ${gameInstanceId}`);
    assert.deepEqual(action.results, [expectedResult("join", "invalid")]);
  }

  for (const actionName of ["join", "chat"]) {
    const fixture = loadBridge({ includeJoin: false, includeChat: false });
    const action = fixture.createAction({ action: actionName });
    action.click();
    await flushMicrotasks();

    assert.deepEqual(action.results, [expectedResult(actionName, "unavailable")]);
    assert.deepEqual(fixture.forbiddenFallbackCalls, []);
  }

  {
    const fixture = loadBridge({
      joinImplementation() {
        throw new Error("private native error that must not cross the bridge");
      }
    });
    const action = fixture.createAction({ action: "join" });
    action.click();
    await flushMicrotasks();

    assert.equal(fixture.joinCalls.length, 1);
    assert.deepEqual(action.results, [expectedResult("join", "failed")]);
    assert.ok(!JSON.stringify(action.results).includes("private native error"));
  }

  {
    const fixture = loadBridge({ quickPlayNative: "enabled" });
    const action = fixture.createQuickPlayAction();
    const event = action.click();
    await flushMicrotasks();

    assert.deepEqual(fixture.quickPlayCalls, [Number(VALID_PLACE_ID)]);
    assert.equal(typeof fixture.quickPlayCalls[0], "number", "Place ID must reach native code as a number");
    assert.equal(fixture.quickPlayReceiver, fixture.gameLauncher);
    assert.deepEqual(fixture.protocolLaunches, []);
    assert.deepEqual(action.results, [expectedResult("play", "started")]);
    assert.equal(event.defaultPrevented, true, "Quick Play must suppress the card's normal navigation");
  }

  {
    const fixture = loadBridge({ quickPlayNative: "enabled" });
    const action = fixture.createQuickPlayAction({
      surfaceAttribute: GAME_EVENTS_LAUNCH_SURFACE_ATTRIBUTE
    });
    const event = action.click();
    await flushMicrotasks();

    assert.deepEqual(
      fixture.quickPlayCalls,
      [Number(VALID_PLACE_ID)],
      "a trusted Game Events Join Game click must reuse the native Quick Play launcher"
    );
    assert.equal(fixture.quickPlayReceiver, fixture.gameLauncher);
    assert.deepEqual(fixture.protocolLaunches, []);
    assert.deepEqual(action.results, [expectedResult("play", "started")]);
    assert.equal(event.defaultPrevented, true);
  }

  {
    const fixture = loadBridge({ quickPlayNative: "enabled" });
    const action = fixture.createQuickPlayAction({
      surfaceAttribute: GAME_EVENTS_LAUNCH_SURFACE_ATTRIBUTE
    });
    const event = action.click({ trusted: false });
    await flushMicrotasks();

    assert.deepEqual(fixture.quickPlayCalls, [], "a synthetic Game Events click reached native launch");
    assert.deepEqual(fixture.protocolLaunches, []);
    assert.deepEqual(action.results, []);
    assert.equal(event.defaultPrevented, false);
  }

  for (const clickOptions of [
    { mouseButton: 1 },
    { altKey: true },
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true }
  ]) {
    const fixture = loadBridge({ quickPlayNative: "enabled" });
    const action = fixture.createQuickPlayAction({
      surfaceAttribute: GAME_EVENTS_LAUNCH_SURFACE_ATTRIBUTE
    });
    const event = action.click(clickOptions);
    await flushMicrotasks();

    assert.deepEqual(
      fixture.quickPlayCalls,
      [],
      `a modified Game Events click reached native launch: ${JSON.stringify(clickOptions)}`
    );
    assert.deepEqual(action.results, []);
    assert.equal(event.defaultPrevented, false);
  }

  for (const placeId of [null, "", "0", "0001", "1e3", "9007199254740992"]) {
    const fixture = loadBridge({ quickPlayNative: "enabled" });
    const action = fixture.createQuickPlayAction({
      placeId,
      surfaceAttribute: GAME_EVENTS_LAUNCH_SURFACE_ATTRIBUTE
    });
    const event = action.click();
    await flushMicrotasks();

    assert.deepEqual(
      fixture.quickPlayCalls,
      [],
      `an invalid Game Events Place ID reached native launch: ${placeId}`
    );
    assert.deepEqual(fixture.protocolLaunches, []);
    assert.deepEqual(action.results, [expectedResult("play", "invalid")]);
    assert.equal(event.defaultPrevented, true);
  }

  {
    const fixture = loadBridge({
      quickPlayNative: "enabled",
      randomServerNative: "enabled"
    });
    const action = fixture.createQuickPlayAction({
      action: "random",
      surfaceAttribute: GAME_EVENTS_LAUNCH_SURFACE_ATTRIBUTE
    });
    const event = action.click();
    await flushMicrotasks();

    assert.deepEqual(fixture.quickPlayCalls, []);
    assert.deepEqual(
      fixture.randomServerCalls,
      [],
      "a Game Events launch surface must authorize only Join Game, never Random Server"
    );
    assert.deepEqual(action.randomServerRequests, []);
    assert.deepEqual(action.results, []);
    assert.equal(event.defaultPrevented, false);
  }

  {
    const fixture = loadBridge({ quickPlayNative: "enabled" });
    const action = fixture.createQuickPlayAction({ iconChild: true });
    const event = action.click();
    await flushMicrotasks();

    assert.notEqual(action.clickTarget, action.button, "fixture must exercise an icon child target");
    assert.deepEqual(fixture.quickPlayCalls, [Number(VALID_PLACE_ID)]);
    assert.deepEqual(action.results, [expectedResult("play", "started")]);
    assert.equal(event.defaultPrevented, true);
  }

  {
    const fixture = loadBridge({ quickPlayNative: "enabled" });
    const action = fixture.createQuickPlayAction();
    const event = action.click({ trusted: false });
    await flushMicrotasks();

    assert.deepEqual(fixture.quickPlayCalls, []);
    assert.deepEqual(fixture.protocolLaunches, []);
    assert.deepEqual(action.results, []);
    assert.equal(event.defaultPrevented, false);
  }

  for (const invalidStructure of [
    { insideSurface: false, label: "outside its owned surface" },
    { tagName: "div", label: "non-button action" },
    { action: "shuffle", label: "unknown action" },
    { disabled: true, label: "disabled button" }
  ]) {
    const fixture = loadBridge({ quickPlayNative: "enabled" });
    const { label, ...options } = invalidStructure;
    const action = fixture.createQuickPlayAction(options);
    const event = action.click();
    await flushMicrotasks();

    assert.deepEqual(fixture.quickPlayCalls, [], `${label} reached Quick Play`);
    assert.deepEqual(fixture.protocolLaunches, [], `${label} reached the protocol fallback`);
    assert.deepEqual(action.results, [], `${label} received a result`);
    assert.equal(event.defaultPrevented, false, `${label} unexpectedly consumed the click`);
  }

  for (const placeId of [
    null,
    "",
    "0",
    "0001",
    "1e3",
    "-1",
    "9007199254740992",
    "12345678901234567"
  ]) {
    const fixture = loadBridge({ quickPlayNative: "enabled" });
    const action = fixture.createQuickPlayAction({ placeId });
    const event = action.click();
    await flushMicrotasks();

    assert.deepEqual(fixture.quickPlayCalls, [], `invalid Place ID reached native code: ${placeId}`);
    assert.deepEqual(fixture.protocolLaunches, [], `invalid Place ID reached protocol: ${placeId}`);
    assert.deepEqual(action.results, [expectedResult("play", "invalid")]);
    assert.equal(event.defaultPrevented, true, "recognized invalid actions must not navigate the card");
  }

  for (const clickOptions of [
    { mouseButton: 1 },
    { altKey: true },
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true }
  ]) {
    const fixture = loadBridge({ quickPlayNative: "enabled" });
    const action = fixture.createQuickPlayAction();
    const event = action.click(clickOptions);
    await flushMicrotasks();

    assert.deepEqual(fixture.quickPlayCalls, [], `modified click reached native code: ${JSON.stringify(clickOptions)}`);
    assert.deepEqual(action.results, []);
    assert.equal(event.defaultPrevented, false, "a rejected modified click was consumed");
  }

  {
    let resolveLaunch;
    const launchResult = new Promise((resolve) => {
      resolveLaunch = resolve;
    });
    const fixture = loadBridge({
      quickPlayNative: "enabled",
      quickPlayImplementation() {
        return launchResult;
      }
    });
    const action = fixture.createQuickPlayAction();
    const firstEvent = action.click();
    const secondEvent = action.click();
    await flushMicrotasks();

    assert.equal(firstEvent.defaultPrevented, true);
    assert.equal(secondEvent.defaultPrevented, false, "pending duplicate should be ignored");
    assert.deepEqual(fixture.quickPlayCalls, [Number(VALID_PLACE_ID)]);
    assert.deepEqual(action.results, []);
    assert.equal(action.button.dataset.rslQuickPlayPending, "true");

    resolveLaunch();
    await flushMicrotasks();
    assert.deepEqual(action.results, [expectedResult("play", "started")]);
    assert.equal(action.button.dataset.rslQuickPlayPending, undefined);
  }

  {
    const fixture = loadBridge({
      quickPlayNative: "enabled",
      quickPlayImplementation() {
        return Promise.reject(new Error("private native rejection"));
      }
    });
    const action = fixture.createQuickPlayAction();
    action.click();
    await flushMicrotasks();

    assert.deepEqual(fixture.quickPlayCalls, [Number(VALID_PLACE_ID)]);
    assert.deepEqual(fixture.protocolLaunches, [], "native rejection must not trigger a second launch path");
    assert.deepEqual(action.results, [expectedResult("play", "failed")]);
    assert.ok(!JSON.stringify(action.results).includes("private native rejection"));
  }

  {
    const fixture = loadBridge({
      quickPlayNative: "enabled",
      quickPlayImplementation() {
        throw new Error("private native throw");
      }
    });
    const action = fixture.createQuickPlayAction();
    action.click();
    await flushMicrotasks();

    assert.deepEqual(fixture.quickPlayCalls, [Number(VALID_PLACE_ID)]);
    assert.deepEqual(fixture.protocolLaunches, [], "native throw must not trigger a second launch path");
    assert.deepEqual(action.results, [expectedResult("play", "failed")]);
    assert.ok(!JSON.stringify(action.results).includes("private native throw"));
  }

  {
    const fixture = loadBridge({ quickPlayNative: "absent" });
    const action = fixture.createQuickPlayAction();
    const event = action.click();
    await flushMicrotasks();

    assert.deepEqual(fixture.quickPlayCalls, []);
    assert.deepEqual(fixture.protocolLaunches, [
      `roblox://experiences/start?placeId=${VALID_PLACE_ID}`
    ]);
    assert.equal(fixture.locationAssignReceiver, fixture.location);
    assert.deepEqual(action.results, [expectedResult("play", "started")]);
    assert.equal(event.defaultPrevented, true);
  }

  {
    const fixture = loadBridge({
      quickPlayNative: "absent",
      includeLocationAssign: false
    });
    const action = fixture.createQuickPlayAction();
    action.click();
    await flushMicrotasks();

    assert.deepEqual(fixture.quickPlayCalls, []);
    assert.deepEqual(fixture.protocolLaunches, []);
    assert.deepEqual(action.results, [expectedResult("play", "unavailable")]);
  }

  {
    const fixture = loadBridge({ quickPlayNative: "enabled" });
    const action = fixture.createQuickPlayAction({ nestedAnchor: true, iconChild: true });
    let anchorNavigationHandlers = 0;
    action.host.addEventListener("click", () => {
      anchorNavigationHandlers += 1;
    });
    const event = action.click();
    await flushMicrotasks();

    assert.equal(event.defaultPrevented, true, "nested link default navigation was not suppressed");
    assert.equal(anchorNavigationHandlers, 0, "nested link click escaped the MAIN-world capture guard");
    assert.deepEqual(fixture.quickPlayCalls, [Number(VALID_PLACE_ID)]);
    assert.deepEqual(action.results, [expectedResult("play", "started")]);
  }

  {
    const fixture = loadBridge({ randomServerNative: "enabled" });
    const action = fixture.createQuickPlayAction({ action: "random", iconChild: true });
    const event = action.click();

    assert.equal(event.defaultPrevented, true, "Random Server must suppress card navigation");
    assert.deepEqual(action.randomServerRequests, [
      { v: 1, placeId: Number(VALID_PLACE_ID) }
    ]);
    assert.deepEqual(fixture.randomServerCalls, [], "selection must finish before launch");
    assert.deepEqual(fixture.pendingTimerDelays, [25_000]);
    assert.equal(action.button.dataset.rslQuickPlayPending, "true");

    action.respond();
    await flushMicrotasks();

    assert.deepEqual(fixture.randomServerCalls, [
      [Number(VALID_PLACE_ID), VALID_GAME_INSTANCE_ID]
    ]);
    assert.equal(fixture.randomServerReceiver, fixture.gameLauncher);
    assert.deepEqual(fixture.protocolLaunches, []);
    assert.deepEqual(action.results, [expectedResult("random", "started")]);
    assert.deepEqual(fixture.pendingTimerDelays, []);
    assert.equal(action.button.dataset.rslQuickPlayPending, undefined);
  }

  {
    const fixture = loadBridge({ randomServerNative: "enabled" });
    const authorized = fixture.createQuickPlayAction({ action: "random" });
    const unrelated = fixture.createQuickPlayAction({ action: "random" });

    unrelated.respond();
    await flushMicrotasks();
    assert.deepEqual(
      fixture.randomServerCalls,
      [],
      "an unsolicited response without a trusted click launched a server"
    );

    authorized.click();
    unrelated.respond({ target: unrelated.button });
    await flushMicrotasks();
    assert.deepEqual(
      fixture.randomServerCalls,
      [],
      "a response from a different button used another button's authorization"
    );
    assert.equal(authorized.button.dataset.rslQuickPlayPending, "true");

    authorized.respond();
    authorized.respond();
    await flushMicrotasks();
    assert.deepEqual(
      fixture.randomServerCalls,
      [[Number(VALID_PLACE_ID), VALID_GAME_INSTANCE_ID]],
      "a one-shot authorization was reused"
    );
    assert.deepEqual(authorized.results, [expectedResult("random", "started")]);
  }

  {
    const fixture = loadBridge({ randomServerNative: "enabled" });
    const action = fixture.createQuickPlayAction({ action: "random" });
    action.click();

    action.respond({ responsePlaceId: "1818" });
    action.button.setAttribute("data-rsl-quick-play-action", "play");
    action.respond();
    action.button.setAttribute("data-rsl-quick-play-action", "random");
    action.button.setAttribute("data-rsl-quick-play-place-id", "1818");
    action.respond({ responsePlaceId: "1818" });
    await flushMicrotasks();

    assert.deepEqual(
      fixture.randomServerCalls,
      [],
      "a mismatched place/action response reached native launch"
    );
    assert.deepEqual(action.results, []);

    action.button.setAttribute("data-rsl-quick-play-place-id", VALID_PLACE_ID);
    action.respond();
    await flushMicrotasks();
    assert.deepEqual(fixture.randomServerCalls, [
      [Number(VALID_PLACE_ID), VALID_GAME_INSTANCE_ID]
    ]);
  }

  for (const invalidGameInstanceId of [
    null,
    "",
    "not-a-uuid",
    `${VALID_GAME_INSTANCE_ID}extra`,
    "8f14e45f-ea36-4e8a-b5f9-2f912e0d733z"
  ]) {
    const fixture = loadBridge({ randomServerNative: "enabled" });
    const action = fixture.createQuickPlayAction({ action: "random" });
    action.click();
    action.respond({ gameInstanceId: invalidGameInstanceId });
    await flushMicrotasks();

    assert.deepEqual(
      fixture.randomServerCalls,
      [],
      `invalid random-server UUID reached native launch: ${invalidGameInstanceId}`
    );
    assert.deepEqual(action.results, [expectedResult("random", "invalid")]);

    action.respond();
    await flushMicrotasks();
    assert.deepEqual(
      fixture.randomServerCalls,
      [],
      "invalid response did not consume its one-shot authorization"
    );
  }

  for (const placeId of [null, "", "0", "0001", "1e3", "9007199254740992"]) {
    const fixture = loadBridge({ randomServerNative: "enabled" });
    const action = fixture.createQuickPlayAction({ action: "random", placeId });
    const event = action.click();
    await flushMicrotasks();

    assert.equal(event.defaultPrevented, true);
    assert.deepEqual(action.randomServerRequests, []);
    assert.deepEqual(fixture.randomServerCalls, []);
    assert.deepEqual(action.results, [expectedResult("random", "invalid")]);
  }

  {
    const fixture = loadBridge({ randomServerNative: "enabled" });
    const action = fixture.createQuickPlayAction({ action: "random" });
    const event = action.click({ trusted: false });
    action.respond();
    await flushMicrotasks();

    assert.equal(event.defaultPrevented, false);
    assert.deepEqual(action.randomServerRequests, []);
    assert.deepEqual(fixture.randomServerCalls, []);
    assert.deepEqual(action.results, []);
  }

  {
    let resolveLaunch;
    const launchResult = new Promise((resolve) => {
      resolveLaunch = resolve;
    });
    const fixture = loadBridge({
      randomServerNative: "enabled",
      randomServerImplementation() {
        return launchResult;
      }
    });
    const action = fixture.createQuickPlayAction({ action: "random" });
    action.click();
    action.respond();
    await flushMicrotasks();

    assert.deepEqual(fixture.randomServerCalls, [
      [Number(VALID_PLACE_ID), VALID_GAME_INSTANCE_ID]
    ]);
    assert.deepEqual(action.results, []);
    assert.equal(action.button.dataset.rslQuickPlayPending, "true");

    resolveLaunch();
    await flushMicrotasks();
    assert.deepEqual(action.results, [expectedResult("random", "started")]);
  }

  for (const failureMode of ["reject", "throw"]) {
    const fixture = loadBridge({
      randomServerNative: "enabled",
      randomServerImplementation() {
        if (failureMode === "throw") {
          throw new Error("private random-server native throw");
        }
        return Promise.reject(new Error("private random-server native rejection"));
      }
    });
    const action = fixture.createQuickPlayAction({ action: "random" });
    action.click();
    action.respond();
    await flushMicrotasks();

    assert.deepEqual(fixture.randomServerCalls, [
      [Number(VALID_PLACE_ID), VALID_GAME_INSTANCE_ID]
    ]);
    assert.deepEqual(
      fixture.protocolLaunches,
      [],
      `native ${failureMode} must not trigger a protocol fallback`
    );
    assert.deepEqual(action.results, [expectedResult("random", "failed")]);
    assert.ok(!JSON.stringify(action.results).includes("private random-server"));
  }

  {
    const fixture = loadBridge({ randomServerNative: "absent" });
    const action = fixture.createQuickPlayAction({ action: "random" });
    action.click();
    action.respond();
    await flushMicrotasks();

    assert.deepEqual(fixture.randomServerCalls, []);
    assert.deepEqual(fixture.protocolLaunches, [
      `roblox://experiences/start?placeId=${VALID_PLACE_ID}&gameInstanceId=${VALID_GAME_INSTANCE_ID}`
    ]);
    assert.equal(fixture.locationAssignReceiver, fixture.location);
    assert.deepEqual(action.results, [expectedResult("random", "started")]);
  }

  {
    const fixture = loadBridge({
      randomServerNative: "absent",
      includeLocationAssign: false
    });
    const action = fixture.createQuickPlayAction({ action: "random" });
    action.click();
    action.respond();
    await flushMicrotasks();

    assert.deepEqual(fixture.randomServerCalls, []);
    assert.deepEqual(fixture.protocolLaunches, []);
    assert.deepEqual(action.results, [expectedResult("random", "unavailable")]);
  }

  {
    const fixture = loadBridge({ randomServerNative: "enabled" });
    const action = fixture.createQuickPlayAction({ action: "random" });
    action.click();
    action.respond({ code: "unavailable", gameInstanceId: undefined });
    await flushMicrotasks();

    assert.deepEqual(fixture.randomServerCalls, []);
    assert.deepEqual(action.results, [expectedResult("random", "unavailable")]);
    action.respond();
    await flushMicrotasks();
    assert.deepEqual(fixture.randomServerCalls, [], "a failure response left authorization live");
  }

  {
    const fixture = loadBridge({ randomServerNative: "enabled" });
    const action = fixture.createQuickPlayAction({ action: "random" });
    action.click();
    fixture.runAllTimers();
    await flushMicrotasks();

    assert.deepEqual(action.results, [expectedResult("random", "failed")]);
    assert.equal(action.button.dataset.rslQuickPlayPending, undefined);
    action.respond();
    await flushMicrotasks();
    assert.deepEqual(fixture.randomServerCalls, [], "an expired authorization launched a server");
  }

  {
    let resolvePlay;
    const playResult = new Promise((resolve) => {
      resolvePlay = resolve;
    });
    const fixture = loadBridge({
      quickPlayNative: "enabled",
      quickPlayImplementation() {
        return playResult;
      },
      randomServerNative: "enabled"
    });
    const play = fixture.createQuickPlayAction({ action: "play" });
    const random = fixture.createQuickPlayAction({
      action: "random",
      existingSurface: play.surface
    });

    const playEvent = play.click();
    const blockedRandomEvent = random.click();
    assert.equal(playEvent.defaultPrevented, true);
    assert.equal(
      blockedRandomEvent.defaultPrevented,
      true,
      "a competing action on the same card was not consumed"
    );
    assert.deepEqual(fixture.quickPlayCalls, [Number(VALID_PLACE_ID)]);
    assert.deepEqual(random.randomServerRequests, []);
    assert.deepEqual(fixture.randomServerCalls, []);
    assert.equal(play.surface.getAttribute("aria-busy"), "true");
    assert.equal(play.button.getAttribute("aria-busy"), "true");
    assert.equal(play.button.disabled, true);
    assert.equal(random.button.disabled, true);

    resolvePlay();
    await flushMicrotasks();
    assert.deepEqual(play.results, [expectedResult("play", "started")]);
    assert.equal(play.surface.hasAttribute("aria-busy"), false);
    assert.equal(play.button.hasAttribute("aria-busy"), false);
    assert.equal(random.button.hasAttribute("aria-busy"), false);
    assert.equal(play.button.disabled, false);
    assert.equal(random.button.disabled, false);

    random.click();
    random.respond();
    await flushMicrotasks();
    assert.deepEqual(fixture.randomServerCalls, [
      [Number(VALID_PLACE_ID), VALID_GAME_INSTANCE_ID]
    ]);
    assert.deepEqual(random.results, [expectedResult("random", "started")]);
  }

  {
    const fixture = loadBridge({
      quickPlayNative: "enabled",
      randomServerNative: "enabled"
    });
    const random = fixture.createQuickPlayAction({ action: "random" });
    const play = fixture.createQuickPlayAction({
      action: "play",
      existingSurface: random.surface
    });

    random.click();
    const blockedPlayEvent = play.click();
    assert.equal(blockedPlayEvent.defaultPrevented, true);
    assert.deepEqual(random.randomServerRequests, [
      { v: 1, placeId: Number(VALID_PLACE_ID) }
    ]);
    assert.deepEqual(fixture.quickPlayCalls, []);
    assert.equal(random.button.disabled, true);
    assert.equal(play.button.disabled, true);

    fixture.runAllTimers();
    await flushMicrotasks();
    assert.deepEqual(random.results, [expectedResult("random", "failed")]);
    assert.equal(random.surface.hasAttribute("aria-busy"), false);
    assert.equal(random.button.hasAttribute("aria-busy"), false);
    assert.equal(random.button.disabled, false);
    assert.equal(play.button.disabled, false);

    play.click();
    await flushMicrotasks();
    assert.deepEqual(fixture.quickPlayCalls, [Number(VALID_PLACE_ID)]);
    assert.deepEqual(play.results, [expectedResult("play", "started")]);
  }

  {
    const fixture = loadBridge({
      quickPlayNative: "enabled",
      randomServerNative: "enabled"
    });
    const random = fixture.createQuickPlayAction({ action: "random" });
    const play = fixture.createQuickPlayAction({
      action: "play",
      existingSurface: random.surface
    });
    random.click();
    random.respond({ gameInstanceId: "invalid" });
    await flushMicrotasks();

    assert.deepEqual(random.results, [expectedResult("random", "invalid")]);
    assert.equal(random.surface.hasAttribute("aria-busy"), false);
    assert.equal(random.button.hasAttribute("aria-busy"), false);
    assert.equal(random.button.disabled, false);
    assert.equal(play.button.disabled, false);
    play.click();
    await flushMicrotasks();
    assert.deepEqual(fixture.quickPlayCalls, [Number(VALID_PLACE_ID)]);
  }

  assert.equal(
    bridgeSource.includes("rotool:private-server-"),
    false,
    "MAIN-world bridge must not expose a private-server DOM-event channel"
  );
  assert.equal(
    bridgeSource.includes("joinPrivateGame"),
    false,
    "MAIN-world bridge must not receive or launch private-server access codes"
  );
  assert.equal(
    bridgeSource.includes("accessCode"),
    false,
    "MAIN-world bridge must not contain private access-code handling"
  );

  console.log("PASS RoTool trusted-click Best Friend, Quick Play, and Random Server bridge contract");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
