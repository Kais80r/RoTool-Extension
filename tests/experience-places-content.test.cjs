"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const contentSource = fs.readFileSync(path.join(projectRoot, "content.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(projectRoot, "styles.css"), "utf8");
const bridgeSource = fs.readFileSync(path.join(projectRoot, "page-bridge.js"), "utf8");
const readme = fs.readFileSync(path.join(projectRoot, "README.md"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "manifest.json"), "utf8"));

function dataKey(name) {
  return name.slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function simpleMatch(node, rawSelector) {
  let selector = rawSelector.trim();
  if (!selector || selector === ":scope") return true;
  if (!(node instanceof FakeElement)) return false;
  const attributes = [];
  selector = selector.replace(
    /\[([^\]=\s]+)(?:\s*=\s*(["']?)(.*?)\2)?\]/g,
    (_all, name, _quote, value) => {
      attributes.push({ name, value: value === undefined ? null : value });
      return "";
    }
  );
  const ids = [];
  selector = selector.replace(/#([A-Za-z0-9_-]+)/g, (_all, id) => { ids.push(id); return ""; });
  const classes = [];
  selector = selector.replace(/\.([A-Za-z0-9_-]+)/g, (_all, name) => { classes.push(name); return ""; });
  const tag = selector.trim();
  if (tag && tag !== "*" && node.tagName.toLowerCase() !== tag.toLowerCase()) return false;
  if (ids.some((id) => node.id !== id)) return false;
  if (classes.some((name) => !node.classList.contains(name))) return false;
  return attributes.every(({ name, value }) =>
    node.hasAttribute(name) && (value === null || node.getAttribute(name) === value)
  );
}

function selectorMatch(node, selector) {
  return selector.split(",").some((part) => {
    const chain = part.trim().split(/\s*>\s*/);
    let current = node;
    for (let index = chain.length - 1; index >= 0; index -= 1) {
      if (!simpleMatch(current, chain[index])) return false;
      if (index > 0) current = current.parentElement;
    }
    return true;
  });
}

let experiencePlacesGridTracks = "";
let experiencePlacesGridWidth = 0;
let experiencePlacesDisclosureRect = {
  top: 100,
  right: 220,
  bottom: 136,
  left: 100,
  width: 120,
  height: 36,
  x: 100,
  y: 100
};
const experiencePlacesResizeObservers = [];

class FakeClassList {
  constructor(element) { this.element = element; }
  values() { return this.element.className.split(/\s+/).filter(Boolean); }
  contains(name) { return this.values().includes(name); }
  add(...names) {
    const values = new Set(this.values());
    names.forEach((name) => values.add(name));
    this.element.className = Array.from(values).join(" ");
  }
  remove(...names) {
    const removed = new Set(names);
    this.element.className = this.values().filter((name) => !removed.has(name)).join(" ");
  }
  toggle(name, force) {
    const wanted = force === undefined ? !this.contains(name) : Boolean(force);
    if (wanted) this.add(name); else this.remove(name);
    return wanted;
  }
}

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.nodeType = 1;
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = ownerDocument;
    this.parentElement = null;
    this.children = [];
    this.attributes = new Map();
    this.dataset = {};
    this.style = {};
    this.className = "";
    this.id = "";
    this.listeners = new Map();
    this._textContent = "";
    this.tabIndex = -1;
    this.complete = false;
    this.naturalWidth = 0;
    this.clientWidth = 0;
    this._rectWidth = null;
    this._rect = null;
    this._computedGridTracks = null;
    this._computedColumnGap = null;
    this._computedCardMinWidth = null;
    this.scrollIntoViewCalls = [];
    this.textContentSetCalls = [];
  }
  get classList() { return new FakeClassList(this); }
  get parentNode() { return this.parentElement; }
  get firstElementChild() { return this.children[0] || null; }
  get nextElementSibling() {
    if (!this.parentElement) return null;
    const index = this.parentElement.children.indexOf(this);
    return this.parentElement.children[index + 1] || null;
  }
  get previousElementSibling() {
    if (!this.parentElement) return null;
    const index = this.parentElement.children.indexOf(this);
    return index > 0 ? this.parentElement.children[index - 1] : null;
  }
  get isConnected() {
    for (let current = this; current; current = current.parentElement) {
      if (current === this.ownerDocument.documentElement) return true;
    }
    return false;
  }
  get textContent() {
    return this._textContent + this.children.map((child) => child.textContent).join("");
  }
  set textContent(value) {
    this.children.forEach((child) => { child.parentElement = null; });
    this.children = [];
    this._textContent = String(value ?? "");
    this.textContentSetCalls.push(this._textContent);
  }
  setAttribute(name, value) {
    const normalized = String(name);
    const text = String(value);
    this.attributes.set(normalized, text);
    if (normalized === "id") this.id = text;
    if (normalized === "class") this.className = text;
    if (normalized.startsWith("data-")) this.dataset[dataKey(normalized)] = text;
  }
  getAttribute(name) {
    if (name === "id" && this.id) return this.id;
    if (name === "class" && this.className) return this.className;
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }
  hasAttribute(name) {
    return (name === "id" && Boolean(this.id)) ||
      (name === "class" && Boolean(this.className)) || this.attributes.has(name);
  }
  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === "id") this.id = "";
    if (name === "class") this.className = "";
    if (name.startsWith("data-")) delete this.dataset[dataKey(name)];
  }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  dispatch(type, overrides = {}) {
    const event = { type, target: this, currentTarget: this, isTrusted: true,
      preventDefault() {}, stopPropagation() {}, ...overrides };
    for (const listener of this.listeners.get(type) || []) listener.call(this, event);
  }
  append(...nodes) {
    for (const node of nodes.filter(Boolean)) {
      node.remove?.();
      node.parentElement = this;
      this.children.push(node);
    }
  }
  appendChild(node) { this.append(node); return node; }
  insertBefore(node, reference) {
    node.remove?.();
    const index = reference ? this.children.indexOf(reference) : -1;
    node.parentElement = this;
    if (index < 0) this.children.push(node); else this.children.splice(index, 0, node);
    return node;
  }
  replaceChildren(...nodes) {
    this.children.forEach((child) => { child.parentElement = null; });
    this.children = [];
    this._textContent = "";
    this.append(...nodes);
  }
  before(node) { this.parentElement?.insertBefore(node, this); }
  after(node) {
    if (!this.parentElement) return;
    const parent = this.parentElement;
    const index = parent.children.indexOf(this);
    node.remove?.();
    node.parentElement = parent;
    parent.children.splice(index + 1, 0, node);
  }
  remove() {
    if (!this.parentElement) return;
    const index = this.parentElement.children.indexOf(this);
    if (index >= 0) this.parentElement.children.splice(index, 1);
    this.parentElement = null;
  }
  contains(candidate) {
    for (let current = candidate; current; current = current.parentElement) {
      if (current === this) return true;
    }
    return false;
  }
  matches(selector) { return selectorMatch(this, selector); }
  closest(selector) {
    for (let current = this; current instanceof FakeElement; current = current.parentElement) {
      if (current.matches(selector)) return current;
    }
    return null;
  }
  querySelectorAll(selector) {
    const found = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (child.matches(selector)) found.push(child);
        visit(child);
      }
    };
    visit(this);
    return found;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  getBoundingClientRect() {
    if (this._rect) return { ...this._rect };
    if (this.classList.contains("rsl-experience-places__disclosure")) {
      return { ...experiencePlacesDisclosureRect };
    }
    const width = this._rectWidth === null
      ? (this.classList.contains("rsl-experience-places__grid")
          ? experiencePlacesGridWidth
          : this.clientWidth)
      : this._rectWidth;
    return { top: 0, right: Number(width) || 0, bottom: 0, left: 0,
      width: Number(width) || 0, height: 0, x: 0, y: 0 };
  }
  scrollIntoView(options) { this.scrollIntoViewCalls.push(options); }
  focus() { this.ownerDocument.activeElement = this; }
}

class FakeResizeObserver {
  constructor(callback) {
    this.callback = callback;
    this.target = null;
    this.disconnected = false;
    experiencePlacesResizeObservers.push(this);
  }
  observe(target) {
    this.target = target;
    this.disconnected = false;
  }
  disconnect() {
    this.disconnected = true;
    this.target = null;
  }
  trigger() {
    if (!this.disconnected && this.target) {
      this.callback([{ target: this.target }], this);
    }
  }
}

class FakeDocument {
  constructor() {
    this.nodeType = 9;
    this.documentElement = new FakeElement("html", this);
    this.body = new FakeElement("body", this);
    this.documentElement.append(this.body);
    this.activeElement = this.body;
    this.visibilityState = "visible";
  }
  createElement(tagName) { return new FakeElement(tagName, this); }
  querySelectorAll(selector) {
    const found = [];
    if (this.documentElement.matches(selector)) found.push(this.documentElement);
    return found.concat(this.documentElement.querySelectorAll(selector));
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  getElementById(id) { return this.querySelector(`#${id}`); }
}

const document = new FakeDocument();
const windowObject = {
  document,
  top: null,
  setTimeout,
  clearTimeout,
  fetch: async () => { throw new Error("Unexpected fetch"); },
  addEventListener() {},
  removeEventListener() {},
  ResizeObserver: FakeResizeObserver,
  getComputedStyle(node) {
    const gridTemplateColumns = node?._computedGridTracks ?? experiencePlacesGridTracks;
    const columnGap = node?._computedColumnGap ?? "16px";
    const minimumCardWidth = node?._computedCardMinWidth ?? "150px";
    return {
      gridTemplateColumns,
      columnGap,
      getPropertyValue(name) {
        return name === "--rsl-experience-places-card-min-width"
          ? minimumCardWidth
          : "";
      }
    };
  },
  innerWidth: 1280,
  innerHeight: 720
};
windowObject.top = windowObject;
globalThis.window = windowObject;
globalThis.document = document;
globalThis.location = { href: "https://www.roblox.com/games/1001/Fixture" };
globalThis.Node = { ELEMENT_NODE: 1 };
globalThis.CSS = { escape: (value) => String(value).replace(/["\\]/g, "\\$&") };
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: { language: "en-US" }
});
globalThis.chrome = {
  runtime: {
    id: "experience-places-content-fixture",
    lastError: null,
    getURL: (value) => `chrome-extension://fixture/${value}`,
    onMessage: { addListener() {} },
    sendMessage(_message, callback) { callback?.({ ok: false }); }
  },
  storage: { local: { get: async () => ({}), set: async () => {} }, onChanged: { addListener() {} } }
};
globalThis.__rslContentTestHooks = { skipInitialize: true };
require(path.join(projectRoot, "content.js"));
const hooks = globalThis.__rslContentTestHooks;
const constants = hooks.experiencePlacesConstants;

function element(tag, { id = "", className = "", dataset = {} } = {}) {
  const node = document.createElement(tag);
  node.id = id;
  node.className = className;
  Object.assign(node.dataset, dataset);
  return node;
}

let pageFixture = null;
function installPage({
  placeId = "1001", rootPlaceId = "1000", universeId = "2001",
  events = true, description = true
} = {}) {
  document.body.replaceChildren();
  document.activeElement = document.body;
  globalThis.location.href = `https://www.roblox.com/games/${placeId}/Fixture`;
  const detailPage = element("div", { id: "game-detail-page", dataset: { placeId } });
  const metadata = element("div", {
    id: "game-detail-meta-data",
    dataset: { placeId, rootPlaceId, universeId, placeName: "Fixture Experience" }
  });
  const aboutRoot = element("div", { id: "game-details-about-tab-container" });
  const about = element("div", { className: "game-about-tab-container" });
  const information = element("div", { className: "game-info-container" });
  const report = element("div", { className: "report-abuse-container" });
  const descriptionNode = element("div", { className: "game-description-container" });
  if (description) {
    descriptionNode.append(
      element("div", { className: "game-stat-container" }),
      element("div", { className: "game-description-footer" })
    );
  }
  const eventsNode = element("div", { className: "virtual-event-game-details-container" });
  const nativeListener = () => {};
  eventsNode.addEventListener("click", nativeListener);
  about.append(information, report);
  if (description) about.append(descriptionNode);
  if (events) about.append(eventsNode);
  aboutRoot.append(about);
  document.body.append(detailPage, metadata, aboutRoot);
  pageFixture = {
    detailPage, metadata, aboutRoot, about, information, report,
    description: descriptionNode, events: eventsNode, nativeListener
  };
  return pageFixture;
}

function updatePageIdentity(placeId, rootPlaceId, universeId) {
  globalThis.location.href = `https://www.roblox.com/games/${placeId}/Next`;
  pageFixture.detailPage.dataset.placeId = placeId;
  Object.assign(pageFixture.metadata.dataset, { placeId, rootPlaceId, universeId });
}

function place(id, universeId = "2001", name = `Place ${id}`) {
  return { id, universeId, name };
}

function pageData(items, nextPageCursor = null) {
  return { previousPageCursor: null, nextPageCursor, data: items };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
  return { promise, resolve, reject };
}

async function settleUntil(predicate, label) {
  for (let index = 0; index < 100; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
    if (predicate()) return;
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function settleLayoutUntil(predicate, label) {
  for (let index = 0; index < 100; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2));
    if (predicate()) return;
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function section() { return document.querySelector(`[${constants.attribute}]`); }
function placesAnnouncement(root = section()) {
  return root?.querySelector(".rsl-experience-places__announcement") || null;
}
function placeLinks(root = section()) {
  return root?.querySelectorAll(`[${constants.placeIdAttribute}]`) || [];
}

function latestResizeObserver() {
  return experiencePlacesResizeObservers.at(-1) || null;
}

function setGridColumns(count) {
  experiencePlacesGridTracks = Array.from(
    { length: count },
    () => "minmax(0px, 1fr)"
  ).join(" ");
  experiencePlacesGridWidth = count * 150 + Math.max(0, count - 1) * 16;
}

function assertNormalSameTabPlaceLinks(links = placeLinks()) {
  assert.ok(links.length > 0, "the fixture must expose at least one Place card");
  for (const link of links) {
    const placeId = link.getAttribute(constants.placeIdAttribute);
    assert.match(placeId, /^[1-9]\d{0,19}$/);
    const url = new URL(link.href);
    assert.equal(url.href, `https://www.roblox.com/games/${placeId}`);
    assert.equal(url.protocol, "https:");
    assert.equal(url.hostname, "www.roblox.com");
    assert.equal(url.pathname, `/games/${placeId}`);
    assert.equal(url.search, "");
    assert.equal(url.hash, "");
    assert.equal(link.hasAttribute("target"), false);
    assert.equal(link.hasAttribute("download"), false);
    assert.equal(link.listeners.has("click"), false,
      "a Place card must remain a normal same-tab page link, not a launch handler");
  }
}

assert.equal(hooks.defaultFeatureSettings.experiencePlaces, true);
assert.deepEqual(
  hooks.featureDefinitions.find(({ key }) => key === "experiencePlaces"),
  { key: "experiencePlaces", group: "Experiences", label: "Experience Places",
    description: "Show Roblox-listed Places on eligible experience pages." }
);
for (const legacy of [null, { version: 1 }, { version: 1, flags: {} }]) {
  assert.equal(hooks.normalizeFeatureSettings(legacy).experiencePlaces, true);
}
assert.deepEqual(constants, {
  attribute: "data-rsl-experience-places",
  placeIdAttribute: "data-rsl-experience-place-id",
  gridId: "rsl-experience-places-grid",
  thumbnailMessageType: "rsl:get-experience-place-thumbnails",
  eligibilityMessageType: "rsl:get-experience-places-eligibility",
  apiOrigin: "https://develop.roblox.com",
  apiPageSize: 25,
  visibleStep: 8,
  thumbnailBatchSize: 24,
  maxItems: 500,
  maxPages: 20,
  maxCursorLength: 1024,
  maxNameLength: 120,
  maxResponseBytes: 256 * 1024,
  requestTimeoutMs: 10000,
  eligibilityTimeoutMs: 30000
});

assert.equal(hooks.normalizeExperiencePlacesCursor(null), null);
assert.equal(hooks.normalizeExperiencePlacesCursor("opaque+/="), "opaque+/=");
assert.equal(hooks.normalizeExperiencePlacesCursor("x\n"), null);
assert.equal(hooks.normalizeExperiencePlacesCursor("x".repeat(1025)), null);
assert.equal(hooks.normalizeExperiencePlacesPage({ data: Array(26).fill(place("1")) }, "2001"), null);
assert.equal(hooks.normalizeExperiencePlacesPage(pageData([place("1", "9999")]), "2001"), null);
const normalizedPage = hooks.normalizeExperiencePlacesPage(
  pageData([place("1002"), place("1002", "2001", "Duplicate"), place("1003")], "next"),
  "2001"
);
assert.deepEqual(normalizedPage.places.map(({ id }) => id), ["1002", "1003"]);
assert.equal(normalizedPage.nextPageCursor, "next");
assert.deepEqual(
  hooks.orderExperiencePlaces(
    [place("1002"), place("1001"), place("1000"), place("1003")],
    { placeId: "1001", rootPlaceId: "1000" }
  ).map(({ id }) => id),
  ["1000", "1001", "1002", "1003"]
);

assert.equal(hooks.countExperiencePlacesGridTracks("150px 150px 150px"), 3);
assert.equal(
  hooks.countExperiencePlacesGridTracks("repeat(2, minmax(0px, 1fr))"),
  2
);
assert.equal(
  hooks.countExperiencePlacesGridTracks(
    "[start] minmax(0px, 1fr) [middle] minmax(0px, 1fr) [end]"
  ),
  2
);
assert.equal(
  hooks.countExperiencePlacesGridTracks("repeat(auto-fill, minmax(150px, 1fr))"),
  0,
  "unresolved auto-fill must use the measured-width fallback"
);
const measuredGrid = element("ul", { className: "rsl-experience-places__grid" });
measuredGrid._computedGridTracks = "repeat(auto-fill, minmax(150px, 1fr))";
for (const [width, expected] of [
  [149, 1], [150, 1], [315, 1], [316, 2], [481, 2], [482, 3],
  [814, 5], [979, 5], [980, 6]
]) {
  measuredGrid._rectWidth = width;
  assert.equal(
    hooks.measureExperiencePlacesColumnCapacity(measuredGrid),
    expected,
    `${width}px must fit exactly ${expected} collapsed Place card(s)`
  );
}
measuredGrid._computedGridTracks =
  "minmax(0px, 1fr) minmax(0px, 1fr)";
measuredGrid._rectWidth = 320;
assert.equal(hooks.measureExperiencePlacesColumnCapacity(measuredGrid), 2,
  "the fixed mobile grid must expose exactly two cards in its collapsed row");

const visibleDisclosure = element("button", {
  className: "rsl-experience-places__disclosure"
});
visibleDisclosure._rect = {
  top: 8, right: 220, bottom: 44, left: 8,
  width: 212, height: 36, x: 8, y: 8
};
assert.equal(hooks.ensureExperiencePlacesFocusVisible(visibleDisclosure), false);
assert.deepEqual(visibleDisclosure.scrollIntoViewCalls, [],
  "an already visible disclosure must not move the viewport");
const offscreenDisclosure = element("button", {
  className: "rsl-experience-places__disclosure"
});
offscreenDisclosure._rect = {
  top: 730, right: 220, bottom: 766, left: 100,
  width: 120, height: 36, x: 100, y: 730
};
assert.equal(hooks.ensureExperiencePlacesFocusVisible(offscreenDisclosure), true);
assert.deepEqual(offscreenDisclosure.scrollIntoViewCalls, [{
  behavior: "auto",
  block: "nearest",
  inline: "nearest"
}], "an offscreen disclosure gets exactly one bounded nearest scroll");
assert.equal(hooks.ensureExperiencePlacesFocusVisible(element("button")), false,
  "only the Places disclosure may trigger collapse visibility scrolling");

const featureSource = contentSource.slice(
  contentSource.indexOf("function normalizeExperiencePlacesCursor"),
  contentSource.indexOf("function buildJoinSchedulerSidebarRow")
);
assert.doesNotMatch(featureSource, /joinMultiplayerGame|GAME_EVENTS_LAUNCH_SURFACE_ATTRIBUTE|QUICK_PLAY_ACTION_ATTRIBUTE|data-rsl-quick-play|Join (?:Game|Place)/i);
assert.doesNotMatch(featureSource, /game-card-container|game-card-thumb-container|btn-common-play-game/);
assert.doesNotMatch(bridgeSource, /experience[-_ ]places|data-rsl-experience-place/i,
  "informational Place cards must not enter the main-world launch bridge");
assert.equal(manifest.host_permissions.some((value) => /develop\.roblox\.com/i.test(value)), false);
assert.match(readme, /Cards only open normal Roblox Place pages; RoTool does not add a subplace launch action/);

const cssStart = stylesSource.indexOf("/* Experience Places");
const cssEnd = stylesSource.indexOf("/* An official Roblox event", cssStart);
assert.notEqual(cssStart, -1);
assert.notEqual(cssEnd, -1);
const placesCss = stylesSource.slice(cssStart, cssEnd);
assert.match(placesCss, /--rsl-experience-places-card-min-width:\s*150px/);
assert.match(
  placesCss,
  /grid-template-columns:\s*repeat\(\s*auto-fill,\s*minmax\(var\(--rsl-experience-places-card-min-width\), 1fr\)\s*\)/s
);
assert.match(placesCss, /gap:\s*24px 16px/);
assert.match(placesCss, /align-items:\s*start/);
assert.match(placesCss, /\.rsl-experience-places__thumbnail\s*\{[^}]*aspect-ratio:\s*1[^}]*border-radius:\s*8px/s);
assert.match(placesCss, /@media \(max-width: 991px\)[\s\S]*margin-inline:\s*15px[\s\S]*padding-inline:\s*0 !important/);
assert.match(placesCss, /@media \(max-width: 543px\)[\s\S]*repeat\(2, minmax\(0, 1fr\)\)[\s\S]*gap:\s*20px 12px/);
const controlsRule = /\.rsl-experience-places__controls\s*\{([^}]*)\}/s.exec(placesCss)?.[1] || "";
assert.match(controlsRule, /display:\s*flex/);
assert.match(controlsRule, /flex-wrap:\s*wrap/);
assert.match(controlsRule, /gap:\s*8px/);
assert.match(
  placesCss,
  /\.rsl-experience-places__controls\s*>\s*\.rsl-experience-places__more\.btn-secondary-md\s*\{[^}]*margin-top:\s*0/s
);
assert.match(
  placesCss,
  /@media \(max-width: 543px\)[\s\S]*\.rsl-experience-places__controls\s*\{[^}]*align-items:\s*stretch[^}]*flex-direction:\s*column[^}]*\}[\s\S]*\.rsl-experience-places__more\.btn-secondary-md\s*\{[^}]*width:\s*100%[^}]*min-height:\s*44px/s
);
assert.match(placesCss, /\.rsl-experience-places__card:focus-visible/);
assert.match(placesCss, /@media \(forced-colors: active\)/);
assert.doesNotMatch(placesCss, /\.game-card-container|\.game-card-thumb-container|\.wide-event-play-button|\.event-follow-button/);
const cardRule = /\.rsl-experience-places__card\s*\{([^}]*)\}/s.exec(placesCss)?.[1] || "";
const nameRule = /\.rsl-experience-places__name\s*\{([^}]*)\}/s.exec(placesCss)?.[1] || "";
const metadataRule = /\.rsl-experience-places__metadata\s*\{([^}]*)\}/s.exec(placesCss)?.[1] || "";
assert.match(cardRule, /display:\s*block/);
assert.doesNotMatch(cardRule, /\b(?:gap|row-gap|column-gap|min-height)\s*:/,
  "the title/metadata stack must not inherit an artificial flex gap or height");
assert.match(nameRule, /display:\s*-webkit-box/);
assert.match(nameRule, /margin-top:\s*8px/);
assert.match(nameRule, /line-height:\s*20px/);
assert.match(nameRule, /-webkit-line-clamp:\s*2/);
assert.doesNotMatch(nameRule, /\bmin-height\s*:/,
  "one-line names must not reserve a blank second line before metadata");
assert.match(metadataRule, /margin-top:\s*2px/);
assert.match(metadataRule, /line-height:\s*18px/);

(async () => {
  hooks.setFeatureSettingsForTests({ version: 1, flags: { experiencePlaces: true } });
  setGridColumns(6);
  installPage();
  const eventsIdentity = pageFixture.events;
  const eventListenerIdentity = pageFixture.events.listeners.get("click")[0];
  let eligibilityCalls = 0;
  let thumbnailCalls = 0;
  const thumbnailBatches = [];
  let apiCalls = 0;
  hooks.setExperiencePlacesMessageSenderForTests(async (message) => {
    if (message.type === constants.eligibilityMessageType) {
      eligibilityCalls += 1;
      return { ok: true, requestId: message.requestId, placeId: message.placeId,
        rootPlaceId: message.rootPlaceId, universeId: message.universeId,
        eligible: true, restricted: false };
    }
    thumbnailCalls += 1;
    thumbnailBatches.push(message.placeIds.slice());
    return {
      ok: true,
      requestId: message.requestId,
      thumbnails: message.placeIds.map((placeId) => ({
        placeId,
        url: `https://tr.rbxcdn.com/${placeId}`
      }))
    };
  });
  const initialItems = Array.from({ length: 10 }, (_unused, index) =>
    place(String(1000 + index))
  );
  hooks.setExperiencePlacesFetcherForTests(async ({ universeId, cursor, url }) => {
    apiCalls += 1;
    assert.equal(universeId, "2001");
    assert.equal(cursor, null);
    const endpoint = new URL(url);
    assert.equal(endpoint.href,
      "https://develop.roblox.com/v1/universes/2001/places?isUniverseCreation=false&limit=25&sortOrder=Asc");
    return pageData(initialItems, null);
  });

  const loadingSection = hooks.mountExperiencePlaces();
  const loadingContent = loadingSection.querySelector(
    ".rsl-experience-places__content"
  );
  const loadingAnnouncement = placesAnnouncement(loadingSection);
  assert.deepEqual(loadingSection.children, [loadingContent, loadingAnnouncement],
    "the scoped live region must remain a direct sibling after renderable content");
  assert.equal(loadingAnnouncement.tagName, "P");
  assert.equal(loadingAnnouncement.id, "rsl-experience-places-announcement");
  assert.equal(loadingAnnouncement.getAttribute("role"), "status");
  assert.equal(loadingAnnouncement.getAttribute("aria-live"), "polite");
  assert.equal(loadingAnnouncement.getAttribute("aria-atomic"), "true");
  assert.equal(
    loadingAnnouncement.classList.contains(
      "rsl-experience-places__status--visually-hidden"
    ),
    true
  );
  assert.equal(loadingAnnouncement.textContent, "",
    "the append announcement must be empty before list results arrive");
  assert.deepEqual(loadingAnnouncement.textContentSetCalls, []);
  assert.equal(
    document.querySelectorAll(".rsl-experience-places__announcement").length,
    1,
    "exactly one Places-scoped polite live region may exist"
  );
  assert.equal(loadingSection.nextElementSibling, eventsIdentity);
  assert.equal(pageFixture.about.children.indexOf(loadingSection) > pageFixture.about.children.indexOf(pageFixture.report), true);
  await settleUntil(() => hooks.getExperiencePlacesStateForTests().loadState === "ready", "initial Places list");
  await settleUntil(() => hooks.getExperiencePlacesStateForTests().thumbnailPendingIds.length === 0, "thumbnail request");
  const stableSection = section();
  const stableGrid = stableSection.querySelector(".rsl-experience-places__grid");
  const stableCard = stableGrid.children[0];
  const stableLink = stableCard.children[0];
  const stableControls = stableSection.querySelector(".rsl-experience-places__controls");
  const stableButton = stableSection.querySelector(".rsl-experience-places__disclosure");
  const stableAnnouncement = placesAnnouncement(stableSection);
  const stableObserver = latestResizeObserver();
  assert.equal(stableAnnouncement, loadingAnnouncement,
    "results rendering must preserve the live-region node identity");
  assert.equal(stableSection.children[0], loadingContent);
  assert.equal(stableSection.children[1], stableAnnouncement);
  assert.equal(stableAnnouncement.textContent, "");
  assert.equal(placeLinks().length, 6,
    "the six-column desktop screenshot case must render exactly one collapsed row");
  assert.equal(hooks.getExperiencePlacesStateForTests().collapsedCapacity, 6);
  assert.equal(hooks.getExperiencePlacesStateForTests().expanded, false);
  assert.equal(hooks.getExperiencePlacesStateForTests().layoutObserved, true);
  assert.equal(stableGrid.id, constants.gridId);
  assert.equal(stableControls.getAttribute("role"), "group");
  assert.equal(stableControls.getAttribute("aria-label"), "Places controls");
  assert.deepEqual(stableControls.children, [stableButton]);
  assert.equal(stableSection.querySelector(".rsl-experience-places__pagination"), null);
  assert.equal(stableButton.textContent, "Show more");
  assert.equal(stableButton.getAttribute("aria-controls"), constants.gridId);
  assert.equal(stableButton.getAttribute("aria-expanded"), "false");
  assert.equal(stableSection.getAttribute("aria-labelledby"), "rsl-experience-places-title");
  assert.match(stableLink.getAttribute("aria-label"), /Main place/);
  assert.equal(placeLinks()[1].textContent.includes("Subplace · Current"), true);
  assert.equal(stableLink.href, "https://www.roblox.com/games/1000");
  assertNormalSameTabPlaceLinks();
  assert.deepEqual(thumbnailBatches, [["1000", "1001", "1002", "1003", "1004", "1005"]]);
  const counts = { apiCalls, eligibilityCalls, thumbnailCalls };
  for (let index = 0; index < 4; index += 1) {
    assert.equal(hooks.mountExperiencePlaces(), stableSection);
    assert.equal(section(), stableSection);
    assert.equal(section().querySelector(".rsl-experience-places__grid"), stableGrid);
    assert.equal(section().querySelector(`[${constants.placeIdAttribute}="1000"]`), stableLink);
    assert.equal(section().querySelector(".rsl-experience-places__controls"), stableControls);
    assert.equal(section().querySelector(".rsl-experience-places__disclosure"), stableButton);
    assert.equal(placesAnnouncement(), stableAnnouncement);
  }
  assert.deepEqual({ apiCalls, eligibilityCalls, thumbnailCalls }, counts,
    "same-route global reconciles must not rerender or repeat requests");
  assert.equal(pageFixture.events, eventsIdentity);
  assert.equal(pageFixture.events.listeners.get("click")[0], eventListenerIdentity);
  assert.equal(latestResizeObserver(), stableObserver);
  assert.equal(stableObserver.target, stableSection);
  assert.equal(stableObserver.disconnected, false);

  // A resize inside the same capacity bucket must be a true no-op: no render,
  // focus change, observer rebind, or network request.
  stableLink.focus();
  stableObserver.trigger();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(section(), stableSection);
  assert.equal(section().querySelector(".rsl-experience-places__grid"), stableGrid);
  assert.equal(section().querySelector(`[${constants.placeIdAttribute}="1000"]`), stableLink);
  assert.equal(section().querySelector(".rsl-experience-places__controls"), stableControls);
  assert.equal(section().querySelector(".rsl-experience-places__disclosure"), stableButton);
  assert.equal(placesAnnouncement(), stableAnnouncement);
  assert.equal(document.activeElement, stableLink);
  assert.equal(latestResizeObserver(), stableObserver);
  assert.deepEqual({ apiCalls, eligibilityCalls, thumbnailCalls }, counts);

  // Crossing a capacity boundary rerenders the one row, keeps a surviving
  // focused Place focused, and never refetches list/eligibility/thumbnail data.
  setGridColumns(5);
  assert.equal(
    hooks.measureExperiencePlacesColumnCapacity(stableGrid),
    5,
    "the live grid measurement must cross into the five-column bucket"
  );
  assert.equal(latestResizeObserver(), stableObserver);
  assert.equal(stableObserver.disconnected, false);
  stableObserver.trigger();
  await settleLayoutUntil(
    () => hooks.getExperiencePlacesStateForTests().collapsedCapacity === 5,
    "five-column collapsed resize"
  );
  assert.equal(section(), stableSection);
  assert.equal(placeLinks().length, 5);
  assert.equal(placesAnnouncement(), stableAnnouncement);
  assert.equal(document.activeElement.getAttribute(constants.placeIdAttribute), "1000");
  assert.deepEqual({ apiCalls, eligibilityCalls, thumbnailCalls }, counts);

  // The mobile contract is two columns. If resize hides the focused overflow
  // card, focus moves to the disclosure instead of disappearing into <body>.
  setGridColumns(6);
  stableObserver.trigger();
  await settleLayoutUntil(
    () => hooks.getExperiencePlacesStateForTests().collapsedCapacity === 6,
    "six-column collapsed resize restore"
  );
  section().querySelector(`[${constants.placeIdAttribute}="1005"]`).focus();
  setGridColumns(2);
  stableObserver.trigger();
  await settleLayoutUntil(
    () => hooks.getExperiencePlacesStateForTests().collapsedCapacity === 2,
    "two-column mobile collapsed resize"
  );
  assert.equal(placeLinks().length, 2);
  assert.equal(placesAnnouncement(), stableAnnouncement);
  assert.equal(document.activeElement, section().querySelector(".rsl-experience-places__disclosure"));
  assert.equal(document.activeElement.getAttribute("aria-expanded"), "false");
  assert.deepEqual({ apiCalls, eligibilityCalls, thumbnailCalls }, counts);
  setGridColumns(6);
  stableObserver.trigger();
  await settleLayoutUntil(
    () => hooks.getExperiencePlacesStateForTests().collapsedCapacity === 6,
    "six-column desktop collapsed resize"
  );

  pageFixture.about.append(stableSection);
  assert.notEqual(stableSection.nextElementSibling, eventsIdentity);
  hooks.mountExperiencePlaces();
  assert.equal(section(), stableSection);
  assert.equal(stableSection.nextElementSibling, eventsIdentity);
  assert.equal(placesAnnouncement(), stableAnnouncement);
  assert.equal(apiCalls, counts.apiCalls);
  const repairedLink = section().querySelector(`[${constants.placeIdAttribute}="1000"]`);
  assert.notEqual(repairedLink, stableLink, "misplacement must trigger an owned repair render");

  const replacementEvents = element("div", { className: "virtual-event-game-details-container" });
  pageFixture.events.remove();
  pageFixture.about.insertBefore(replacementEvents, pageFixture.information);
  pageFixture.events = replacementEvents;
  hooks.mountExperiencePlaces();
  assert.equal(section().nextElementSibling, replacementEvents);
  assert.equal(apiCalls, counts.apiCalls);
  const beforeRemovalCalls = { apiCalls, eligibilityCalls };
  const removedSection = section();
  removedSection.remove();
  const rebuilt = hooks.mountExperiencePlaces();
  assert.notEqual(rebuilt, removedSection);
  assert.equal(stableAnnouncement.isConnected, false);
  assert.notEqual(placesAnnouncement(rebuilt), stableAnnouncement,
    "rebuilding an externally removed section must create one fresh scoped live region");
  assert.equal(placesAnnouncement(rebuilt).textContent, "");
  assert.equal(rebuilt.nextElementSibling, replacementEvents);
  assert.deepEqual({ apiCalls, eligibilityCalls }, beforeRemovalCalls,
    "repairing a removed owned section must reuse loaded state");
  assert.equal(stableObserver.disconnected, true,
    "replacing the owned section must disconnect its old ResizeObserver");
  assert.notEqual(latestResizeObserver(), stableObserver);
  assert.equal(latestResizeObserver().target, rebuilt);

  const rebuiltAnnouncement = placesAnnouncement(rebuilt);
  const showMore = rebuilt.querySelector(".rsl-experience-places__disclosure");
  assert.equal(showMore.getAttribute("aria-controls"), constants.gridId);
  assert.equal(showMore.getAttribute("aria-expanded"), "false");
  showMore.focus();
  showMore.dispatch("click");
  assert.equal(placeLinks().length, 10);
  assert.equal(hooks.getExperiencePlacesStateForTests().expanded, true);
  let showLess = rebuilt.querySelector(".rsl-experience-places__disclosure");
  assert.equal(showLess.textContent, "Show less");
  assert.equal(showLess.getAttribute("aria-controls"), constants.gridId);
  assert.equal(showLess.getAttribute("aria-expanded"), "true");
  assert.equal(document.activeElement, showLess,
    "Show more must retain focus on the disclosure when it becomes Show less");
  assert.equal(rebuilt.querySelector(".rsl-experience-places__pagination"), null,
    "an expanded fully loaded list needs Show less but no pagination control");
  assert.equal(placesAnnouncement(rebuilt), rebuiltAnnouncement);
  assert.equal(rebuiltAnnouncement.textContent, "",
    "revealing already-loaded cards must not announce a network append");
  assert.deepEqual(rebuiltAnnouncement.textContentSetCalls, []);
  await settleUntil(() => hooks.getExperiencePlacesStateForTests().thumbnailPendingIds.length === 0,
    "expanded-row thumbnails");
  assert.deepEqual(thumbnailBatches.at(-1), ["1006", "1007", "1008", "1009"]);
  assertNormalSameTabPlaceLinks();

  const toggleCounts = { apiCalls, eligibilityCalls, thumbnailCalls };
  experiencePlacesDisclosureRect = {
    top: 100, right: 220, bottom: 136, left: 100,
    width: 120, height: 36, x: 100, y: 100
  };
  showLess.dispatch("click");
  let collapsedDisclosure = rebuilt.querySelector(".rsl-experience-places__disclosure");
  assert.equal(placeLinks().length, 6);
  assert.equal(hooks.getExperiencePlacesStateForTests().expanded, false);
  assert.equal(hooks.getExperiencePlacesStateForTests().items.length, 10);
  assert.equal(collapsedDisclosure.textContent, "Show more");
  assert.equal(collapsedDisclosure.getAttribute("aria-expanded"), "false");
  assert.equal(document.activeElement, collapsedDisclosure);
  assert.equal(placesAnnouncement(rebuilt), rebuiltAnnouncement);
  assert.equal(rebuiltAnnouncement.textContent, "");
  assert.deepEqual(collapsedDisclosure.scrollIntoViewCalls, [],
    "a visible collapsed disclosure must not cause page movement");
  assert.deepEqual({ apiCalls, eligibilityCalls, thumbnailCalls }, toggleCounts,
    "Show less must retain loaded data and make no request");

  collapsedDisclosure.dispatch("click");
  showLess = rebuilt.querySelector(".rsl-experience-places__disclosure");
  assert.equal(placeLinks().length, 10);
  assert.equal(showLess.textContent, "Show less");
  assert.equal(showLess.getAttribute("aria-expanded"), "true");
  assert.equal(document.activeElement, showLess);
  assert.equal(placesAnnouncement(rebuilt), rebuiltAnnouncement);
  assert.deepEqual({ apiCalls, eligibilityCalls, thumbnailCalls }, toggleCounts,
    "re-expanding retained cards must not refetch names or cached thumbnails");

  experiencePlacesDisclosureRect = {
    top: 730, right: 220, bottom: 766, left: 100,
    width: 120, height: 36, x: 100, y: 730
  };
  showLess.dispatch("click");
  collapsedDisclosure = rebuilt.querySelector(".rsl-experience-places__disclosure");
  assert.equal(placeLinks().length, 6);
  assert.equal(document.activeElement, collapsedDisclosure);
  assert.equal(placesAnnouncement(rebuilt), rebuiltAnnouncement);
  assert.deepEqual(collapsedDisclosure.scrollIntoViewCalls, [{
    behavior: "auto",
    block: "nearest",
    inline: "nearest"
  }], "an offscreen Show more receives one nearest scroll after collapse");
  experiencePlacesDisclosureRect = {
    top: 100, right: 220, bottom: 136, left: 100,
    width: 120, height: 36, x: 100, y: 100
  };
  collapsedDisclosure.dispatch("click");
  assert.equal(placeLinks().length, 10);
  assert.equal(document.activeElement,
    rebuilt.querySelector(".rsl-experience-places__disclosure"));
  assert.equal(placesAnnouncement(rebuilt), rebuiltAnnouncement);
  assert.deepEqual(rebuiltAnnouncement.textContentSetCalls, [],
    "local Show more/Show less toggles must remain silent");
  assert.deepEqual({ apiCalls, eligibilityCalls, thumbnailCalls }, toggleCounts);

  hooks.resetExperiencePlacesStateForTests();
  installPage({ events: false, description: true });
  const fallback = hooks.getExperiencePlacesMountTarget();
  assert.equal(fallback.placement, "after");
  assert.equal(fallback.anchor, pageFixture.description);
  const unhydrated = installPage({ events: false, description: false });
  assert.equal(hooks.getExperiencePlacesMountTarget(), null);
  assert.equal(unhydrated.about.querySelector(`[${constants.attribute}]`), null);

  installPage();
  const duplicateEvent = element("div", { className: "virtual-event-game-details-container" });
  pageFixture.about.append(duplicateEvent);
  assert.equal(hooks.getExperiencePlacesMountTarget(), null,
    "ambiguous native anchors must fail closed");

  // A collapsed six-column row expands every already-loaded card before it
  // exposes Load more. Appended thumbnails cover every new card in ordered,
  // bounded batches, and focus follows the user's pending More action.
  hooks.resetExperiencePlacesStateForTests();
  setGridColumns(6);
  installPage();
  const firstPagedItems = Array.from({ length: 25 }, (_unused, index) =>
    place(String(1000 + index))
  );
  const secondPagedItems = Array.from({ length: 25 }, (_unused, index) =>
    place(String(1025 + index))
  );
  let pagedApiCalls = 0;
  let pagedEligibilityCalls = 0;
  const pagedThumbnailBatches = [];
  hooks.setExperiencePlacesMessageSenderForTests(async (message) => {
    if (message.type === constants.eligibilityMessageType) {
      pagedEligibilityCalls += 1;
      return { ok: true, requestId: message.requestId, placeId: message.placeId,
        rootPlaceId: message.rootPlaceId, universeId: message.universeId,
        eligible: true, restricted: false };
    }
    pagedThumbnailBatches.push(message.placeIds.slice());
    assert.ok(message.placeIds.length > 0);
    assert.ok(message.placeIds.length <= constants.thumbnailBatchSize,
      "every Place-thumbnail message must stay within the background batch bound");
    return {
      ok: true,
      requestId: message.requestId,
      thumbnails: message.placeIds.map((placeId) => ({
        placeId,
        url: `https://tr.rbxcdn.com/${placeId}`
      }))
    };
  });
  const thirdPagedItems = [place("1050"), place("1051")];
  const pagedSecondResponse = deferred();
  hooks.setExperiencePlacesFetcherForTests(async ({ cursor }) => {
    pagedApiCalls += 1;
    if (cursor === null) return pageData(firstPagedItems, "page-two");
    if (cursor === "page-two") return pagedSecondResponse.promise;
    assert.equal(cursor, "page-three");
    return pageData(thirdPagedItems, null);
  });
  hooks.mountExperiencePlaces();
  await settleUntil(
    () => hooks.getExperiencePlacesStateForTests().loadState === "ready" &&
      hooks.getExperiencePlacesStateForTests().thumbnailPendingIds.length === 0,
    "collapsed paged Places row"
  );
  assert.equal(placeLinks().length, 6);
  const pagedAnnouncement = placesAnnouncement();
  assert.equal(pagedAnnouncement.textContent, "");
  assert.deepEqual(pagedAnnouncement.textContentSetCalls, []);
  assert.equal(pagedApiCalls, 1);
  assert.equal(pagedEligibilityCalls, 1);
  let pagedDisclosure = section().querySelector(".rsl-experience-places__disclosure");
  assert.equal(pagedDisclosure.textContent, "Show more");
  assert.equal(pagedDisclosure.getAttribute("aria-controls"), constants.gridId);
  assert.equal(pagedDisclosure.getAttribute("aria-expanded"), "false");
  assert.equal(section().querySelector(".rsl-experience-places__pagination"), null);
  pagedDisclosure.focus();
  pagedDisclosure.dispatch("click");
  assert.equal(placeLinks().length, 25,
    "Show more must reveal every loaded Place, not another fixed-size slice");
  assert.equal(hooks.getExperiencePlacesStateForTests().expanded, true);
  assert.equal(pagedApiCalls, 1,
    "expanding loaded cards must not fetch the next cursor implicitly");
  const expandedControls = section().querySelector(".rsl-experience-places__controls");
  pagedDisclosure = expandedControls.querySelector(".rsl-experience-places__disclosure");
  let pagedPagination = expandedControls.querySelector(".rsl-experience-places__pagination");
  assert.equal(expandedControls.getAttribute("role"), "group");
  assert.equal(expandedControls.children[0], pagedDisclosure,
    "Show less must remain the first control");
  assert.equal(expandedControls.children[1], pagedPagination,
    "expanded pagination must remain a separate second control");
  assert.equal(pagedDisclosure.textContent, "Show less");
  assert.equal(pagedDisclosure.getAttribute("aria-expanded"), "true");
  assert.equal(document.activeElement, pagedDisclosure);
  assert.equal(pagedPagination.textContent, "Load more");
  assert.equal(pagedPagination.getAttribute("aria-controls"), constants.gridId);
  assert.equal(pagedPagination.hasAttribute("aria-expanded"), false);
  assert.equal(placesAnnouncement(), pagedAnnouncement,
    "expansion renders must preserve the live-region node");
  assert.equal(pagedAnnouncement.textContent, "");
  await settleUntil(
    () => hooks.getExperiencePlacesStateForTests().thumbnailPendingIds.length === 0,
    "all first-page thumbnails"
  );
  assert.deepEqual(pagedThumbnailBatches.map((batch) => batch.length), [6, 19]);
  assert.deepEqual(
    pagedThumbnailBatches.flat(),
    firstPagedItems.map(({ id }) => id),
    "expansion must request every newly visible first-page thumbnail exactly once"
  );
  assertNormalSameTabPlaceLinks();

  // Expanded lists remain expanded across responsive changes. Capacity may be
  // remembered for the next collapsed lifecycle, but no current node, focus,
  // or request may churn merely because the column count changed.
  const expandedSection = section();
  const expandedGrid = expandedSection.querySelector(".rsl-experience-places__grid");
  const expandedFirstLink = placeLinks()[0];
  const expandedObserver = latestResizeObserver();
  const expandedRequestSnapshot = {
    api: pagedApiCalls,
    eligibility: pagedEligibilityCalls,
    thumbnailBatches: pagedThumbnailBatches.length
  };
  pagedPagination.focus();
  setGridColumns(2);
  expandedObserver.trigger();
  await settleLayoutUntil(
    () => hooks.getExperiencePlacesStateForTests().collapsedCapacity === 2,
    "expanded mobile resize"
  );
  assert.equal(section(), expandedSection);
  assert.equal(section().querySelector(".rsl-experience-places__grid"), expandedGrid);
  assert.equal(placeLinks()[0], expandedFirstLink);
  assert.equal(section().querySelector(".rsl-experience-places__controls"), expandedControls);
  assert.equal(section().querySelector(".rsl-experience-places__disclosure"), pagedDisclosure);
  assert.equal(section().querySelector(".rsl-experience-places__pagination"), pagedPagination);
  assert.equal(document.activeElement, pagedPagination);
  assert.equal(placesAnnouncement(), pagedAnnouncement);
  assert.equal(placeLinks().length, 25);
  assert.deepEqual({
    api: pagedApiCalls,
    eligibility: pagedEligibilityCalls,
    thumbnailBatches: pagedThumbnailBatches.length
  }, expandedRequestSnapshot);

  pagedPagination.dispatch("click");
  assert.equal(pagedApiCalls, 2,
    "Load more must be the first control that follows the next cursor");
  assert.equal(placesAnnouncement(), pagedAnnouncement);
  assert.equal(pagedAnnouncement.textContent, "",
    "pagination-initiated appends must not produce duplicate spoken feedback");
  const pendingControls = section().querySelector(".rsl-experience-places__controls");
  const pendingDisclosure = pendingControls.querySelector(
    ".rsl-experience-places__disclosure"
  );
  const pendingPagination = pendingControls.querySelector(
    ".rsl-experience-places__pagination"
  );
  assert.equal(pendingControls.children[0], pendingDisclosure);
  assert.equal(pendingControls.children[1], pendingPagination);
  assert.equal(pendingDisclosure.textContent, "Show less");
  assert.equal(pendingDisclosure.getAttribute("aria-expanded"), "true");
  assert.equal(pendingDisclosure.getAttribute("aria-disabled"), "false",
    "Show less must remain usable while pagination is pending");
  assert.equal(pendingPagination.textContent, "Loading\u2026");
  assert.equal(pendingPagination.getAttribute("aria-disabled"), "true");
  assert.equal(pendingPagination.hasAttribute("aria-expanded"), false);
  assert.equal(document.activeElement, pendingPagination);

  pendingDisclosure.focus();
  pendingDisclosure.dispatch("click");
  assert.equal(pagedApiCalls, 2,
    "collapsing during an in-flight append must not start another request");
  assert.equal(hooks.getExperiencePlacesStateForTests().expanded, false);
  assert.equal(placeLinks().length, 2,
    "Show less must collapse to the latest responsive one-row capacity");
  let retainedDisclosure = section().querySelector(
    ".rsl-experience-places__disclosure"
  );
  assert.equal(retainedDisclosure.textContent, "Show more");
  assert.equal(retainedDisclosure.getAttribute("aria-expanded"), "false");
  assert.equal(document.activeElement, retainedDisclosure);
  assert.equal(section().querySelector(".rsl-experience-places__pagination"), null);
  assert.equal(hooks.getExperiencePlacesStateForTests().items.length, 25);
  assert.equal(hooks.getExperiencePlacesStateForTests().requestPending, true);
  assert.equal(placesAnnouncement(), pagedAnnouncement);
  assert.equal(pagedAnnouncement.textContent, "");

  pagedSecondResponse.resolve(pageData(secondPagedItems, "page-three"));
  await settleUntil(
    () => hooks.getExperiencePlacesStateForTests().loadState === "ready" &&
      hooks.getExperiencePlacesStateForTests().pageCount === 2,
    "second Places page after pending collapse"
  );
  assert.equal(hooks.getExperiencePlacesStateForTests().expanded, false,
    "a late append must not reopen a list collapsed while it was pending");
  assert.equal(placeLinks().length, 2);
  assert.equal(hooks.getExperiencePlacesStateForTests().items.length, 50);
  assert.equal(hooks.getExperiencePlacesStateForTests().nextPageCursor, "page-three");
  retainedDisclosure = section().querySelector(".rsl-experience-places__disclosure");
  assert.equal(document.activeElement, retainedDisclosure);
  assert.equal(retainedDisclosure.textContent, "Show more");
  assert.equal(section().querySelector(".rsl-experience-places__pagination"), null);
  assert.equal(placesAnnouncement(), pagedAnnouncement);
  assert.deepEqual(pagedAnnouncement.textContentSetCalls, [],
    "a pagination append completed after pending collapse must stay silent");

  retainedDisclosure.dispatch("click");
  assert.equal(pagedApiCalls, 2,
    "re-expanding retained pages must not skip directly to the next cursor");
  assert.equal(hooks.getExperiencePlacesStateForTests().expanded, true);
  assert.equal(placeLinks().length, 50);
  pagedDisclosure = section().querySelector(".rsl-experience-places__disclosure");
  pagedPagination = section().querySelector(".rsl-experience-places__pagination");
  assert.equal(pagedDisclosure.textContent, "Show less");
  assert.equal(pagedDisclosure.getAttribute("aria-expanded"), "true");
  assert.equal(document.activeElement, pagedDisclosure);
  assert.equal(pagedPagination.textContent, "Load more");
  assert.equal(pagedPagination.hasAttribute("aria-expanded"), false);
  assert.equal(placesAnnouncement(), pagedAnnouncement);
  await settleUntil(
    () => hooks.getExperiencePlacesStateForTests().thumbnailPendingIds.length === 0,
    "retained second-page thumbnails after re-expansion"
  );
  assert.deepEqual(
    pagedThumbnailBatches.slice(-2).map((batch) => batch.length),
    [24, 1],
    "twenty-five retained appended thumbnails must drain as 24 + 1 on re-expansion"
  );
  assert.deepEqual(
    new Set(pagedThumbnailBatches.flat()),
    new Set([...firstPagedItems, ...secondPagedItems].map(({ id }) => id)),
    "all visible Place cards must receive one bounded thumbnail request"
  );
  assertNormalSameTabPlaceLinks();

  pagedPagination.focus();
  pagedPagination.dispatch("click");
  assert.equal(pagedApiCalls, 3,
    "the retained next cursor must remain usable after collapse and re-expansion");
  await settleUntil(
    () => hooks.getExperiencePlacesStateForTests().loadState === "ready" &&
      hooks.getExperiencePlacesStateForTests().pageCount === 3 &&
      hooks.getExperiencePlacesStateForTests().thumbnailPendingIds.length === 0,
    "third retained Places page"
  );
  assert.equal(placeLinks().length, 52);
  assert.equal(hooks.getExperiencePlacesStateForTests().items.length, 52);
  assert.equal(document.activeElement.getAttribute(constants.placeIdAttribute), "1050");
  assert.equal(section().querySelector(".rsl-experience-places__pagination"), null);
  assert.equal(section().querySelector(".rsl-experience-places__disclosure").textContent,
    "Show less");
  assert.equal(placesAnnouncement(), pagedAnnouncement);
  assert.deepEqual(pagedAnnouncement.textContentSetCalls, [],
    "successful pagination must use focus feedback without a second live announcement");
  assert.deepEqual(pagedThumbnailBatches.at(-1), ["1050", "1051"]);
  assertNormalSameTabPlaceLinks();

  // When a collapsed row exactly fills its capacity but has a next cursor,
  // Show more must immediately perform useful pagination instead of no-oping.
  const pagedObserver = latestResizeObserver();
  hooks.resetExperiencePlacesStateForTests();
  assert.equal(pagedObserver.disconnected, true);
  setGridColumns(6);
  installPage();
  let cursorOnlyApiCalls = 0;
  hooks.setExperiencePlacesMessageSenderForTests(async (message) =>
    message.type === constants.eligibilityMessageType
      ? { ok: true, requestId: message.requestId, placeId: message.placeId,
        rootPlaceId: message.rootPlaceId, universeId: message.universeId,
        eligible: true, restricted: false }
      : { ok: true, requestId: message.requestId,
        thumbnails: message.placeIds.map((placeId) => ({
          placeId, url: `https://tr.rbxcdn.com/${placeId}`
        })) }
  );
  const cursorOnlyThirdPage = deferred();
  hooks.setExperiencePlacesFetcherForTests(async ({ cursor }) => {
    cursorOnlyApiCalls += 1;
    if (cursor === null) {
      return pageData(firstPagedItems.slice(0, 6), "only-next");
    }
    if (cursor === "only-next") {
      return pageData(firstPagedItems.slice(6, 8), "third-page");
    }
    assert.equal(cursor, "third-page");
    return cursorOnlyThirdPage.promise;
  });
  hooks.mountExperiencePlaces();
  await settleUntil(
    () => hooks.getExperiencePlacesStateForTests().loadState === "ready" &&
      hooks.getExperiencePlacesStateForTests().requestPending === false,
    "full collapsed row with next cursor"
  );
  assert.equal(placeLinks().length, 6);
  const cursorOnlyAnnouncement = placesAnnouncement();
  assert.equal(cursorOnlyAnnouncement.textContent, "");
  assert.deepEqual(cursorOnlyAnnouncement.textContentSetCalls, []);
  const cursorOnlyDisclosure = section().querySelector(
    ".rsl-experience-places__disclosure"
  );
  assert.equal(cursorOnlyDisclosure.textContent, "Show more");
  assert.equal(cursorOnlyDisclosure.getAttribute("aria-expanded"), "false");
  assert.equal(section().querySelector(".rsl-experience-places__pagination"), null);
  cursorOnlyDisclosure.focus();
  cursorOnlyDisclosure.dispatch("click");
  assert.equal(cursorOnlyApiCalls, 2,
    "cursor-only Show more must start the append request synchronously");
  const cursorPendingControls = section().querySelector(
    ".rsl-experience-places__controls"
  );
  const cursorPendingDisclosure = cursorPendingControls.querySelector(
    ".rsl-experience-places__disclosure"
  );
  const cursorPendingPagination = cursorPendingControls.querySelector(
    ".rsl-experience-places__pagination"
  );
  assert.equal(cursorPendingControls.children[0], cursorPendingDisclosure);
  assert.equal(cursorPendingControls.children[1], cursorPendingPagination);
  assert.equal(cursorPendingDisclosure.textContent, "Show less");
  assert.equal(cursorPendingDisclosure.getAttribute("aria-expanded"), "true");
  assert.equal(cursorPendingPagination.textContent, "Loading\u2026");
  assert.equal(cursorPendingPagination.hasAttribute("aria-expanded"), false);
  assert.equal(document.activeElement, cursorPendingDisclosure,
    "cursor-only Show more must not arm pagination-only first-new-card focus");
  assert.equal(placesAnnouncement(), cursorOnlyAnnouncement);
  assert.equal(cursorOnlyAnnouncement.textContent, "",
    "the live region must stay empty while a cursor-only append is pending");
  await settleUntil(
    () => hooks.getExperiencePlacesStateForTests().loadState === "ready" &&
      hooks.getExperiencePlacesStateForTests().pageCount === 2,
    "cursor-only Show more append"
  );
  await settleUntil(
    () => cursorOnlyAnnouncement.textContent === "2 more places loaded.",
    "cursor-only appended-count announcement"
  );
  assert.equal(hooks.getExperiencePlacesStateForTests().expanded, true);
  assert.equal(placeLinks().length, 8);
  assert.equal(document.activeElement,
    section().querySelector(".rsl-experience-places__disclosure"));
  assert.equal(placesAnnouncement(), cursorOnlyAnnouncement,
    "async completion renders must preserve the scoped live-region node");
  assert.equal(cursorOnlyAnnouncement.getAttribute("aria-live"), "polite");
  assert.equal(cursorOnlyAnnouncement.getAttribute("aria-atomic"), "true");
  assert.deepEqual(cursorOnlyAnnouncement.textContentSetCalls,
    ["2 more places loaded."],
    "one genuine two-item cursor append must produce one plural announcement");
  assert.equal(
    document.querySelectorAll(".rsl-experience-places__announcement").length,
    1
  );
  assertNormalSameTabPlaceLinks();

  // If the user moves focus away while a later page is pending, completion
  // must not steal it back to the first appended card.
  const finalLoadMore = section().querySelector(".rsl-experience-places__pagination");
  assert.equal(finalLoadMore.textContent, "Load more");
  assert.equal(finalLoadMore.hasAttribute("aria-expanded"), false);
  finalLoadMore.focus();
  finalLoadMore.dispatch("click");
  assert.equal(cursorOnlyApiCalls, 3);
  assert.equal(placesAnnouncement(), cursorOnlyAnnouncement);
  assert.equal(cursorOnlyAnnouncement.textContent, "",
    "starting the next append must clear prior live feedback before new results");
  assert.deepEqual(cursorOnlyAnnouncement.textContentSetCalls,
    ["2 more places loaded.", ""]);
  pageFixture.information.focus();
  cursorOnlyThirdPage.resolve(pageData(firstPagedItems.slice(8, 10), null));
  await settleUntil(
    () => hooks.getExperiencePlacesStateForTests().loadState === "ready" &&
      hooks.getExperiencePlacesStateForTests().pageCount === 3,
    "append after focus moved outside Places"
  );
  assert.equal(placeLinks().length, 10);
  assert.equal(document.activeElement, pageFixture.information,
    "append completion must honor focus that left the pending More control");
  assert.equal(placesAnnouncement(), cursorOnlyAnnouncement);
  assert.equal(cursorOnlyAnnouncement.textContent, "",
    "pagination completion after focus moved must not announce redundant feedback");
  assert.deepEqual(cursorOnlyAnnouncement.textContentSetCalls,
    ["2 more places loaded.", ""]);

  // A one-item cursor append uses singular copy. After collapse clears the
  // live region, an equal-size later append must set the same copy again so
  // assistive technology receives fresh feedback instead of stale text.
  hooks.resetExperiencePlacesStateForTests();
  setGridColumns(6);
  installPage();
  hooks.setExperiencePlacesMessageSenderForTests(async (message) =>
    message.type === constants.eligibilityMessageType
      ? { ok: true, requestId: message.requestId, placeId: message.placeId,
        rootPlaceId: message.rootPlaceId, universeId: message.universeId,
        eligible: true, restricted: false }
      : { ok: true, requestId: message.requestId,
        thumbnails: message.placeIds.map((placeId) => ({
          placeId, url: `https://tr.rbxcdn.com/${placeId}`
        })) }
  );
  let singularApiCalls = 0;
  hooks.setExperiencePlacesFetcherForTests(async ({ cursor }) => {
    singularApiCalls += 1;
    if (cursor === null) {
      return pageData(firstPagedItems.slice(0, 6), "singular-two");
    }
    if (cursor === "singular-two") {
      return pageData([firstPagedItems[6]], "singular-three");
    }
    assert.equal(cursor, "singular-three");
    return pageData([firstPagedItems[7]], null);
  });
  hooks.mountExperiencePlaces();
  await settleUntil(
    () => hooks.getExperiencePlacesStateForTests().loadState === "ready" &&
      hooks.getExperiencePlacesStateForTests().pageCount === 1,
    "singular announcement initial row"
  );
  const singularAnnouncement = placesAnnouncement();
  let singularDisclosure = section().querySelector(
    ".rsl-experience-places__disclosure"
  );
  singularDisclosure.focus();
  singularDisclosure.dispatch("click");
  await settleUntil(
    () => hooks.getExperiencePlacesStateForTests().pageCount === 2 &&
      singularAnnouncement.textContent === "1 more place loaded.",
    "singular cursor-only append announcement"
  );
  assert.equal(singularApiCalls, 2);
  assert.equal(placeLinks().length, 7);
  assert.equal(placesAnnouncement(), singularAnnouncement);
  assert.equal(document.activeElement,
    section().querySelector(".rsl-experience-places__disclosure"));
  assert.deepEqual(singularAnnouncement.textContentSetCalls,
    ["1 more place loaded."],
    "one genuine one-item append must produce one singular announcement");

  setGridColumns(7);
  latestResizeObserver().trigger();
  await settleLayoutUntil(
    () => hooks.getExperiencePlacesStateForTests().collapsedCapacity === 7,
    "seven-column capacity for equal-count reannouncement"
  );
  singularDisclosure = section().querySelector(
    ".rsl-experience-places__disclosure"
  );
  singularDisclosure.dispatch("click");
  let singularShowMore = section().querySelector(
    ".rsl-experience-places__disclosure"
  );
  assert.equal(singularShowMore.textContent, "Show more");
  assert.equal(placeLinks().length, 7);
  assert.equal(singularAnnouncement.textContent, "");
  assert.deepEqual(singularAnnouncement.textContentSetCalls,
    ["1 more place loaded.", ""],
    "Show less must clear prior appended-count feedback");
  assert.equal(document.activeElement, singularShowMore);
  singularShowMore.dispatch("click");
  await settleUntil(
    () => hooks.getExperiencePlacesStateForTests().pageCount === 3 &&
      singularAnnouncement.textContent === "1 more place loaded.",
    "equal-count singular reannouncement"
  );
  assert.equal(singularApiCalls, 3);
  assert.equal(placeLinks().length, 8);
  assert.equal(placesAnnouncement(), singularAnnouncement);
  assert.equal(document.activeElement,
    section().querySelector(".rsl-experience-places__disclosure"));
  assert.deepEqual(singularAnnouncement.textContentSetCalls,
    ["1 more place loaded.", "", "1 more place loaded."],
    "the same positive count on a later append must be announced again once");

  // A queued announcement must be invalidated by lifecycle cleanup, and
  // cleanup itself clears the old live text before removing the section.
  const singularContext = hooks.getExperiencePlacesPageContext();
  const singularState = hooks.getExperiencePlacesStateForTests();
  assert.equal(hooks.scheduleExperiencePlacesAppendAnnouncement({
    context: singularContext,
    lifecycleEpoch: singularState.lifecycleEpoch,
    requestId: singularState.requestSequence,
    appendedPlaceCount: 2
  }), true);
  hooks.cleanupExperiencePlacesFeature();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(section(), null);
  assert.equal(singularAnnouncement.isConnected, false);
  assert.equal(singularAnnouncement.textContent, "");
  assert.deepEqual(singularAnnouncement.textContentSetCalls,
    ["1 more place loaded.", "", "1 more place loaded.", ""],
    "cleanup must clear old copy and suppress its now-stale queued callback");

  // Duplicate-only and empty cursor pages contain no genuinely new Place IDs,
  // so disclosure-initiated appends must not announce a misleading count.
  hooks.resetExperiencePlacesStateForTests();
  setGridColumns(6);
  installPage();
  hooks.setExperiencePlacesMessageSenderForTests(async (message) =>
    message.type === constants.eligibilityMessageType
      ? { ok: true, requestId: message.requestId, placeId: message.placeId,
        rootPlaceId: message.rootPlaceId, universeId: message.universeId,
        eligible: true, restricted: false }
      : { ok: true, requestId: message.requestId, thumbnails: [] }
  );
  let noNewApiCalls = 0;
  hooks.setExperiencePlacesFetcherForTests(async ({ cursor }) => {
    noNewApiCalls += 1;
    if (cursor === null) {
      return pageData(firstPagedItems.slice(0, 6), "duplicates-only");
    }
    if (cursor === "duplicates-only") {
      return pageData(firstPagedItems.slice(0, 2), "empty-page");
    }
    assert.equal(cursor, "empty-page");
    return pageData([], null);
  });
  hooks.mountExperiencePlaces();
  await settleUntil(
    () => hooks.getExperiencePlacesStateForTests().loadState === "ready" &&
      hooks.getExperiencePlacesStateForTests().pageCount === 1,
    "no-new-items initial row"
  );
  const noNewAnnouncement = placesAnnouncement();
  let noNewDisclosure = section().querySelector(
    ".rsl-experience-places__disclosure"
  );
  noNewDisclosure.focus();
  noNewDisclosure.dispatch("click");
  await settleUntil(
    () => hooks.getExperiencePlacesStateForTests().loadState === "ready" &&
      hooks.getExperiencePlacesStateForTests().pageCount === 2,
    "duplicate-only cursor append"
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(noNewApiCalls, 2);
  assert.equal(hooks.getExperiencePlacesStateForTests().items.length, 6);
  assert.equal(noNewAnnouncement.textContent, "");
  assert.deepEqual(noNewAnnouncement.textContentSetCalls, [],
    "a duplicate-only page must not write to the live region");
  section().querySelector(".rsl-experience-places__disclosure").dispatch("click");
  noNewDisclosure = section().querySelector(
    ".rsl-experience-places__disclosure"
  );
  assert.equal(noNewDisclosure.textContent, "Show more");
  assert.equal(document.activeElement, noNewDisclosure);
  noNewDisclosure.dispatch("click");
  await settleUntil(
    () => hooks.getExperiencePlacesStateForTests().loadState === "ready" &&
      hooks.getExperiencePlacesStateForTests().pageCount === 3,
    "empty cursor append"
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(noNewApiCalls, 3);
  assert.equal(hooks.getExperiencePlacesStateForTests().items.length, 6);
  assert.equal(placesAnnouncement(), noNewAnnouncement);
  assert.equal(noNewAnnouncement.textContent, "");
  assert.deepEqual(noNewAnnouncement.textContentSetCalls, [],
    "an empty page must not write to the live region");

  // If Show less is activated while a disclosure-started append is pending,
  // its late result stays collapsed, keeps toggle focus, and remains silent.
  hooks.resetExperiencePlacesStateForTests();
  setGridColumns(6);
  installPage();
  hooks.setExperiencePlacesMessageSenderForTests(async (message) =>
    message.type === constants.eligibilityMessageType
      ? { ok: true, requestId: message.requestId, placeId: message.placeId,
        rootPlaceId: message.rootPlaceId, universeId: message.universeId,
        eligible: true, restricted: false }
      : { ok: true, requestId: message.requestId, thumbnails: [] }
  );
  const collapsePendingPage = deferred();
  hooks.setExperiencePlacesFetcherForTests(async ({ cursor }) =>
    cursor === null
      ? pageData(firstPagedItems.slice(0, 6), "collapse-pending")
      : collapsePendingPage.promise
  );
  hooks.mountExperiencePlaces();
  await settleUntil(
    () => hooks.getExperiencePlacesStateForTests().loadState === "ready",
    "pending-collapse initial row"
  );
  const collapsePendingAnnouncement = placesAnnouncement();
  let collapsePendingDisclosure = section().querySelector(
    ".rsl-experience-places__disclosure"
  );
  collapsePendingDisclosure.focus();
  collapsePendingDisclosure.dispatch("click");
  collapsePendingDisclosure = section().querySelector(
    ".rsl-experience-places__disclosure"
  );
  assert.equal(collapsePendingDisclosure.textContent, "Show less");
  assert.equal(hooks.getExperiencePlacesStateForTests().requestPending, true);
  assert.equal(document.activeElement, collapsePendingDisclosure);
  collapsePendingDisclosure.dispatch("click");
  const collapsedPendingToggle = section().querySelector(
    ".rsl-experience-places__disclosure"
  );
  assert.equal(collapsedPendingToggle.textContent, "Show more");
  assert.equal(document.activeElement, collapsedPendingToggle);
  collapsePendingPage.resolve(pageData([firstPagedItems[6]], null));
  await settleUntil(
    () => hooks.getExperiencePlacesStateForTests().loadState === "ready" &&
      hooks.getExperiencePlacesStateForTests().pageCount === 2,
    "late append after Show less"
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(hooks.getExperiencePlacesStateForTests().expanded, false);
  assert.equal(hooks.getExperiencePlacesStateForTests().items.length, 7);
  assert.equal(placeLinks().length, 6);
  assert.equal(document.activeElement,
    section().querySelector(".rsl-experience-places__disclosure"));
  assert.equal(placesAnnouncement(), collapsePendingAnnouncement);
  assert.equal(collapsePendingAnnouncement.textContent, "");
  assert.deepEqual(collapsePendingAnnouncement.textContentSetCalls, [],
    "collapsing while a disclosure append is pending must suppress feedback");

  // Moving focus away from a disclosure-started append suppresses its scoped
  // announcement and does not pull focus back when the new card arrives.
  hooks.resetExperiencePlacesStateForTests();
  setGridColumns(6);
  installPage();
  hooks.setExperiencePlacesMessageSenderForTests(async (message) =>
    message.type === constants.eligibilityMessageType
      ? { ok: true, requestId: message.requestId, placeId: message.placeId,
        rootPlaceId: message.rootPlaceId, universeId: message.universeId,
        eligible: true, restricted: false }
      : { ok: true, requestId: message.requestId, thumbnails: [] }
  );
  const movedFocusPage = deferred();
  hooks.setExperiencePlacesFetcherForTests(async ({ cursor }) =>
    cursor === null
      ? pageData(firstPagedItems.slice(0, 6), "moved-focus")
      : movedFocusPage.promise
  );
  hooks.mountExperiencePlaces();
  await settleUntil(
    () => hooks.getExperiencePlacesStateForTests().loadState === "ready",
    "moved-focus initial row"
  );
  const movedFocusAnnouncement = placesAnnouncement();
  const movedFocusDisclosure = section().querySelector(
    ".rsl-experience-places__disclosure"
  );
  movedFocusDisclosure.focus();
  movedFocusDisclosure.dispatch("click");
  pageFixture.information.focus();
  movedFocusPage.resolve(pageData([firstPagedItems[6]], null));
  await settleUntil(
    () => hooks.getExperiencePlacesStateForTests().loadState === "ready" &&
      hooks.getExperiencePlacesStateForTests().pageCount === 2,
    "disclosure append after focus moved"
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(hooks.getExperiencePlacesStateForTests().expanded, true);
  assert.equal(placeLinks().length, 7);
  assert.equal(document.activeElement, pageFixture.information,
    "disclosure append completion must not steal focus after it moved away");
  assert.equal(movedFocusAnnouncement.textContent, "");
  assert.deepEqual(movedFocusAnnouncement.textContentSetCalls, [],
    "focus leaving the disclosure must suppress its appended-count feedback");

  const movedFocusState = hooks.getExperiencePlacesStateForTests();
  const movedFocusContext = hooks.getExperiencePlacesPageContext();
  section().querySelector(".rsl-experience-places__disclosure").focus();
  assert.equal(hooks.scheduleExperiencePlacesAppendAnnouncement({
    context: movedFocusContext,
    lifecycleEpoch: movedFocusState.lifecycleEpoch,
    requestId: movedFocusState.requestSequence - 1,
    appendedPlaceCount: 1
  }), true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(movedFocusAnnouncement.textContent, "");
  assert.deepEqual(movedFocusAnnouncement.textContentSetCalls, [],
    "a stale request token must never announce into the current section");

  // Direct public CORS request: fixed URL, omitted credentials, redirect and body guards.
  hooks.setExperiencePlacesFetcherForTests(null);
  let observedFetch = null;
  windowObject.fetch = async (url, options) => {
    observedFetch = { url, options };
    return {
      ok: true, status: 200, url,
      headers: new Headers({ "Content-Type": "application/json", "Content-Length": "79" }),
      text: async () => JSON.stringify(pageData([place("1000")]))
    };
  };
  const directPage = await hooks.fetchExperiencePlacesPage("2001", "opaque+/=", new AbortController().signal);
  assert.equal(directPage.data[0].id, "1000");
  const directUrl = new URL(observedFetch.url);
  assert.equal(directUrl.origin, "https://develop.roblox.com");
  assert.equal(directUrl.pathname, "/v1/universes/2001/places");
  assert.equal(directUrl.searchParams.get("cursor"), "opaque+/=");
  assert.deepEqual(observedFetch.options, {
    method: "GET", mode: "cors", credentials: "omit", cache: "no-store",
    headers: { Accept: "application/json" }, redirect: "error",
    referrerPolicy: "no-referrer", signal: observedFetch.options.signal
  });

  windowObject.fetch = async (url) => ({ ok: true, status: 200, url,
    headers: new Headers({ "Content-Type": "text/html" }), text: async () => "{}" });
  await assert.rejects(() => hooks.fetchExperiencePlacesPage("2001", null), /not JSON/);
  windowObject.fetch = async (url) => ({ ok: true, status: 200, url,
    headers: new Headers({ "Content-Type": "application/json", "Content-Length": String(constants.maxResponseBytes + 1) }),
    text: async () => { throw new Error("must not read oversized declared body"); } });
  await assert.rejects(() => hooks.fetchExperiencePlacesPage("2001", null), /too large/);
  windowObject.fetch = async (url) => ({ ok: true, status: 200, url,
    headers: new Headers({ "Content-Type": "application/json" }),
    text: async () => `"${"x".repeat(constants.maxResponseBytes)}"` });
  await assert.rejects(() => hooks.fetchExperiencePlacesPage("2001", null), /too large/);
  windowObject.fetch = async () => { throw new TypeError("CORS blocked"); };
  await assert.rejects(() => hooks.fetchExperiencePlacesPage("2001", null), /CORS blocked/);
  windowObject.fetch = async (url) => ({ ok: true, status: 200,
    url: "https://evil.invalid/v1/universes/2001/places",
    headers: new Headers({ "Content-Type": "application/json" }), text: async () => "{}" });
  await assert.rejects(() => hooks.fetchExperiencePlacesPage("2001", null), /request failed/);

  // Unique cursors with empty/duplicate pages cannot bypass the explicit page cap.
  hooks.resetExperiencePlacesStateForTests();
  installPage();
  let cappedCalls = 0;
  hooks.setExperiencePlacesMessageSenderForTests(async (message) => message.type === constants.eligibilityMessageType
    ? { ok: true, requestId: message.requestId, placeId: message.placeId,
      rootPlaceId: message.rootPlaceId, universeId: message.universeId,
      eligible: true, restricted: false }
    : { ok: true, requestId: message.requestId, thumbnails: [] });
  hooks.setExperiencePlacesFetcherForTests(async () => {
    cappedCalls += 1;
    return pageData([], `cursor-${cappedCalls}`);
  });
  hooks.mountExperiencePlaces();
  await settleUntil(() => hooks.getExperiencePlacesStateForTests().loadState === "ready", "cap initial page");
  const cappedContext = hooks.getExperiencePlacesPageContext();
  while (hooks.getExperiencePlacesStateForTests().nextPageCursor) {
    await hooks.loadExperiencePlacesPage(cappedContext, true);
  }
  assert.equal(cappedCalls, constants.maxPages);
  assert.equal(hooks.getExperiencePlacesStateForTests().pageCount, constants.maxPages);
  assert.equal(hooks.getExperiencePlacesStateForTests().limitReached, true);
  assert.equal(await hooks.loadExperiencePlacesPage(cappedContext, true), false);
  assert.equal(cappedCalls, constants.maxPages);

  // A stale route-A list response cannot replace route B after an SPA transition.
  hooks.resetExperiencePlacesStateForTests();
  installPage();
  const routeA = deferred();
  let routeASignal = null;
  hooks.setExperiencePlacesFetcherForTests(({ universeId, signal }) => {
    if (universeId === "2001") { routeASignal = signal; return routeA.promise; }
    return Promise.resolve(pageData([place("3000", "3001", "Route B")], null));
  });
  hooks.setExperiencePlacesMessageSenderForTests(async (message) => message.type === constants.eligibilityMessageType
    ? { ok: true, requestId: message.requestId, placeId: message.placeId,
      rootPlaceId: message.rootPlaceId, universeId: message.universeId,
      eligible: true, restricted: false }
    : { ok: true, requestId: message.requestId, thumbnails: [] });
  hooks.mountExperiencePlaces();
  await settleUntil(() => routeASignal !== null, "route A list request");
  const routeAObserver = latestResizeObserver();
  assert.equal(routeAObserver.target, section());
  updatePageIdentity("3000", "3000", "3001");
  hooks.mountExperiencePlaces();
  assert.equal(routeAObserver.disconnected, true,
    "an SPA route change must disconnect layout tracking from route A");
  await settleUntil(() => hooks.getExperiencePlacesStateForTests().loadState === "ready" &&
    hooks.getExperiencePlacesStateForTests().routeKey === "3000:3000:3001", "route B list");
  const routeBObserver = latestResizeObserver();
  assert.notEqual(routeBObserver, routeAObserver);
  assert.equal(routeBObserver.target, section());
  assert.equal(routeASignal.aborted, true);
  routeA.resolve(pageData([place("1000", "2001", "Stale A")], null));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(hooks.getExperiencePlacesStateForTests().items.map(({ name }) => name), ["Route B"]);
  globalThis.location.href = "https://www.roblox.com/home";
  hooks.mountExperiencePlaces();
  assert.equal(section(), null);
  assert.equal(hooks.getExperiencePlacesStateForTests().loadState, "idle");
  assert.equal(routeBObserver.disconnected, true,
    "leaving an experience page must disconnect its ResizeObserver");

  // Restricted universes suppress the whole section and never contact Develop.
  hooks.resetExperiencePlacesStateForTests();
  installPage();
  let restrictedDevelopCalls = 0;
  hooks.setExperiencePlacesFetcherForTests(async () => { restrictedDevelopCalls += 1; return pageData([]); });
  hooks.setExperiencePlacesMessageSenderForTests(async (message) => ({
    ok: true, requestId: message.requestId, placeId: message.placeId,
    rootPlaceId: message.rootPlaceId, universeId: message.universeId,
    eligible: false, restricted: true
  }));
  hooks.mountExperiencePlaces();
  await settleUntil(() => hooks.getExperiencePlacesStateForTests().loadState === "restricted", "restricted gate");
  assert.equal(section(), null);
  assert.equal(restrictedDevelopCalls, 0);

  // Unknown eligibility fails closed to Retry; a second failure restores focus.
  hooks.resetExperiencePlacesStateForTests();
  installPage();
  let failedDevelopCalls = 0;
  hooks.setExperiencePlacesFetcherForTests(async () => { failedDevelopCalls += 1; return pageData([]); });
  hooks.setExperiencePlacesMessageSenderForTests(async () => { throw new Error("eligibility unavailable"); });
  hooks.mountExperiencePlaces();
  await settleUntil(() => hooks.getExperiencePlacesStateForTests().loadState === "error", "eligibility error");
  const retry = section().querySelector(".rsl-experience-places__retry");
  assert.equal(retry.textContent, "Try again");
  retry.focus();
  retry.dispatch("click");
  await settleUntil(() => hooks.getExperiencePlacesStateForTests().loadState === "error" &&
    hooks.getExperiencePlacesStateForTests().requestPending === false, "retry failure");
  assert.equal(document.activeElement, section().querySelector(".rsl-experience-places__retry"));
  assert.equal(failedDevelopCalls, 0);

  console.log("PASS Experience Places CORS, pagination, UI, identity, SPA, focus, and no-Join contract");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
