"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "content.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `${name} must exist`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Could not extract ${name}`);
}

function sourceSection(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `${startMarker} section must exist`);
  return source.slice(start, end);
}

assert.match(
  source,
  /const HOME_FRIENDS_COLLAPSED_STORAGE_KEY = "rslHomeFriendsCollapsedV1";/,
  "the native Home Friends preference must persist independently"
);
assert.match(
  source,
  /const HOME_FRIENDS_COLLAPSED_ATTRIBUTE = "data-rsl-home-friends-collapsed";/
);
assert.match(
  source,
  /const HOME_FRIENDS_TOGGLE_ATTRIBUTE = "data-rsl-toggle-home-friends";/
);
assert.match(
  source,
  /const HOME_FRIENDS_HEADER_ATTRIBUTE = "data-rsl-home-friends-header";/
);
assert.match(
  source,
  /const HOME_FRIENDS_BODY_ATTRIBUTE = "data-rsl-home-friends-body";/
);
for (const functionName of [
  "homeFriendsCollapsedStorageGet",
  "homeFriendsCollapsedStorageSet",
  "applyHomeFriendsCollapsedStorageValue",
  "applyDeferredHomeFriendsCollapsedStorageValue",
  "setHomeFriendsCollapsed",
  "ensureHomeFriendsCollapseControl",
  "syncHomeFriendsCollapsedState",
  "cleanupHomeFriendsCollapseControl",
  "mountHomeFriendsCollapseControl"
]) {
  assert.ok(source.includes(`function ${functionName}(`), `${functionName} must exist`);
}

const collapseElementsSource = extractFunction("getHomeFriendsCollapseElements");
assert.match(
  collapseElementsSource,
  /contentHost/,
  "collapse geometry must expose the outer height-owning Friends content host"
);
assert.match(
  collapseElementsSource,
  /contentHost\.parentElement !== nativeCarousel/,
  "the content host must walk outward through BTR/native wrappers to the direct body shell"
);

const btrNativeRoot = {
  querySelector(selector) {
    return selector === ":scope > .container-header" ? btrHeader : null;
  }
};
const btrHeader = {
  querySelector(selector) {
    return selector === "h2" ? btrHeading : null;
  }
};
const btrHeading = {};
const btrContentHost = { className: "btr-friends-list", parentElement: btrNativeRoot };
const btrInnerBody = { parentElement: btrContentHost };
const btrList = {
  parentElement: btrInnerBody,
  closest(selector) {
    return selector === ".friends-carousel-container" ? btrInnerBody : null;
  }
};
const getCollapseElements = new Function(
  "getNativeHomeFriendList",
  `${collapseElementsSource}; return getHomeFriendsCollapseElements;`
)(() => btrList);
const btrElements = getCollapseElements(btrNativeRoot);
assert.strictEqual(btrElements.body, btrInnerBody);
assert.strictEqual(
  btrElements.contentHost,
  btrContentHost,
  "a .btr-friends-list wrapper must be treated as the height-owning body shell"
);

const controlSource = extractFunction("ensureHomeFriendsCollapseControl");
assert.match(controlSource, /:scope > \.container-header/);
assert.match(controlSource, /querySelector\("h2"\)/);
assert.match(controlSource, /header\.setAttribute\(HOME_FRIENDS_HEADER_ATTRIBUTE, ""\)/);
assert.match(controlSource, /id = "rsl-home-friends-toggle"/);
assert.match(controlSource, /type = "button"/);
assert.match(controlSource, /HOME_FRIENDS_TOGGLE_ATTRIBUTE/);
assert.match(
  controlSource,
  /(?:let|const) toggle = header\.querySelector\([\s\S]{0,180}HOME_FRIENDS_TOGGLE_ATTRIBUTE[\s\S]{0,80}\);/
);
assert.match(controlSource, /if \(!toggle\)/);
assert.ok(
  controlSource.indexOf("querySelector(") < controlSource.indexOf('createElement("button")'),
  "a remount must reuse the connected control before considering creation"
);
assert.equal(
  (controlSource.match(/createElement\("button"\)/g) || []).length,
  1,
  "the ensure path must have one button creation site"
);
assert.doesNotMatch(
  controlSource,
  /replaceChildren|cloneNode|heading\.replaceWith|append\(heading\)|prepend\(heading\)/,
  "adding the control must neither rebuild nor reparent Roblox's native h2"
);
assert.match(
  controlSource,
  /heading\.insertAdjacentElement\("afterend", toggle\)|header\.insertBefore\(toggle, heading\.nextSibling\)/,
  "Hide/Show must be a direct header child immediately after the native h2/count"
);
assert.match(
  controlSource,
  /if \((?:toggle\.previousElementSibling !== heading|heading\.nextElementSibling !== toggle)\)[\s\S]*(?:insertAdjacentElement|insertBefore)/,
  "a React heading rerender must reposition the existing control instead of creating another"
);

class ControlNode {
  constructor(localName) {
    this.localName = localName;
    this.children = [];
    this.parentElement = null;
    this.attributes = new Map();
    this.id = "";
    this.className = "";
    this.type = "";
  }

  append(...children) {
    for (const child of children) {
      if (child && typeof child === "object") child.parentElement = this;
      this.children.push(child);
    }
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  addEventListener() {}

  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter(
      (child) => child !== this
    );
    this.parentElement = null;
  }

  get nextElementSibling() {
    if (!this.parentElement) return null;
    const elements = this.parentElement.children.filter(
      (child) => child instanceof ControlNode
    );
    return elements[elements.indexOf(this) + 1] || null;
  }

  insertAdjacentElement(position, element) {
    assert.equal(position, "afterend");
    assert.ok(this.parentElement);
    element.remove();
    const index = this.parentElement.children.indexOf(this);
    this.parentElement.children.splice(index + 1, 0, element);
    element.parentElement = this.parentElement;
  }

  descendants() {
    const result = [];
    for (const child of this.children) {
      if (!(child instanceof ControlNode)) continue;
      result.push(child, ...child.descendants());
    }
    return result;
  }

  querySelector(selector) {
    if (selector === "h2") {
      return this.descendants().find((node) => node.localName === "h2") || null;
    }
    const attributeMatch = selector.match(/\[([^\]]+)\]/);
    if (attributeMatch && selector.startsWith(":scope >")) {
      return this.children.find(
        (child) =>
          child instanceof ControlNode && child.hasAttribute(attributeMatch[1])
      ) || null;
    }
    return null;
  }

  querySelectorAll(selector) {
    const attributeMatch = selector.match(/^\[([^\]]+)\]$/);
    if (!attributeMatch) return [];
    return this.descendants().filter((node) => node.hasAttribute(attributeMatch[1]));
  }
}

const nativeControlRoot = new ControlNode("section");
const nativeControlHeader = new ControlNode("header");
let nativeControlHeading = new ControlNode("h2");
const nativeSeeAll = new ControlNode("a");
const nativeControlBody = new ControlNode("div");
const nativeControlList = new ControlNode("div");
nativeControlList.closest = () => nativeControlBody;
nativeControlHeader.append(nativeControlHeading, nativeSeeAll);
nativeControlBody.append(nativeControlList);
nativeControlRoot.append(nativeControlHeader, nativeControlBody);
nativeControlRoot.querySelector = (selector) =>
  selector === ":scope > .container-header" ? nativeControlHeader : null;

let controlCreationCount = 0;
const controlDocument = {
  createElement(localName) {
    if (localName === "button") controlCreationCount += 1;
    return new ControlNode(localName);
  },
  createTextNode(value) {
    return { nodeType: 3, nodeValue: String(value), parentElement: null };
  }
};
const ensureControl = new Function(
  "document",
  "getNativeHomeFriendList",
  "getHomeFriendsCollapseElements",
  "setHomeFriendsCollapsed",
  `const HOME_FRIENDS_HEADER_ATTRIBUTE = "data-rsl-home-friends-header";\n` +
    `const HOME_FRIENDS_BODY_ATTRIBUTE = "data-rsl-home-friends-body";\n` +
    `const HOME_FRIENDS_OWNED_ID_ATTRIBUTE = "data-rsl-home-friends-owned-id";\n` +
    `const HOME_FRIENDS_TOGGLE_ATTRIBUTE = "data-rsl-toggle-home-friends";\n` +
    `let homeFriendsCollapsed = false;\n` +
    `${controlSource};\n` +
    `return ensureHomeFriendsCollapseControl;`
)(
  controlDocument,
  () => nativeControlList,
  () => ({
    header: nativeControlHeader,
    heading: nativeControlHeading,
    list: nativeControlList,
    body: nativeControlBody,
    contentHost: nativeControlBody
  }),
  () => Promise.resolve()
);

const firstNativeToggle = ensureControl(nativeControlRoot);
assert.equal(controlCreationCount, 1);
assert.deepEqual(nativeControlHeader.children, [
  nativeControlHeading,
  firstNativeToggle,
  nativeSeeAll
]);
assert.strictEqual(ensureControl(nativeControlRoot), firstNativeToggle);
assert.equal(controlCreationCount, 1, "an ordinary remount must not create a second control");

const duplicateNativeToggle = new ControlNode("button");
duplicateNativeToggle.setAttribute("data-rsl-toggle-home-friends", "");
nativeControlHeader.append(duplicateNativeToggle);
assert.strictEqual(ensureControl(nativeControlRoot), firstNativeToggle);
assert.equal(duplicateNativeToggle.parentElement, null, "a stale duplicate must be removed");
assert.equal(controlCreationCount, 1);

const replacementHeading = new ControlNode("h2");
nativeControlHeading.parentElement = null;
nativeControlHeading = replacementHeading;
nativeControlHeader.children = [replacementHeading, nativeSeeAll, firstNativeToggle];
for (const child of nativeControlHeader.children) child.parentElement = nativeControlHeader;
assert.strictEqual(ensureControl(nativeControlRoot), firstNativeToggle);
assert.deepEqual(nativeControlHeader.children, [
  replacementHeading,
  firstNativeToggle,
  nativeSeeAll
]);
assert.equal(
  controlCreationCount,
  1,
  "a React-owned h2 replacement must reuse and reposition the existing control"
);

// Hide keeps Roblox's native header and See All action. Only the people/body
// row leaves layout and the accessibility tree; Show restores those same nodes.
const syncSource = extractFunction("syncHomeFriendsCollapsedState");
const headingOnlyAttributes = new Map();
const headingOnlyRoot = {
  toggleAttribute(name, force) {
    if (force) headingOnlyAttributes.set(name, "");
    else headingOnlyAttributes.delete(name);
  }
};
const headingOnlyHooks = new Function(
  "ensureHomeFriendsCollapseControl",
  "getNativeHomeFriendList",
  "getHomeFriendsCollapseElements",
  `const HOME_FRIENDS_COLLAPSED_ATTRIBUTE = "data-rsl-home-friends-collapsed";\n` +
    `let homeFriendsCollapsed = true;\n` +
    `${syncSource};\n` +
    `return { syncHomeFriendsCollapsedState };`
)(() => null, () => null, () => ({
  header: null,
  heading: null,
  list: null,
  body: null,
  contentHost: null
}));
assert.equal(headingOnlyHooks.syncHomeFriendsCollapsedState(headingOnlyRoot), false);
assert.equal(
  headingOnlyAttributes.has("data-rsl-home-friends-collapsed"),
  true,
  "persisted Hide must mark a heading-only native mount before its late people row appears"
);
const headerAttributes = new Map();
const bodyShellAttributes = new Map();
const bodyAttributes = new Map();
const listAttributes = new Map();
const carouselAttributes = new Map();
const heading = { id: "native-friends-heading" };
const seeAll = { id: "native-see-all" };
const makeVisibilityNode = (attributes, children = []) => ({
  hidden: false,
  children,
  setAttribute(name, value) {
    attributes.set(name, String(value));
  },
  removeAttribute(name) {
    attributes.delete(name);
  },
  toggleAttribute(name, force) {
    if (force) attributes.set(name, "");
    else attributes.delete(name);
  }
});
let toggleTextContent = "";
let toggleTextWrites = 0;
const toggleAttributes = new Map();
const toggle = {
  hidden: false,
  get textContent() {
    return toggleTextContent;
  },
  set textContent(value) {
    toggleTextWrites += 1;
    toggleTextContent = value;
  },
  setAttribute(name, value) {
    toggleAttributes.set(name, String(value));
  }
};
const header = makeVisibilityNode(headerAttributes, [heading, toggle, seeAll]);
const bodyShell = makeVisibilityNode(bodyShellAttributes);
bodyShell.id = "rsl-home-friends-body";
const body = makeVisibilityNode(bodyAttributes);
const list = makeVisibilityNode(listAttributes);
body.closest = (selector) => selector === ".btr-friends-list" ? bodyShell : null;
list.closest = (selector) => {
  if (selector === ".friends-carousel-container") return body;
  if (selector === ".btr-friends-list") return bodyShell;
  return null;
};
const nativeCarousel = {
  querySelector(selector) {
    return selector.includes("container-header") ? header : null;
  },
  hasAttribute(name) {
    return carouselAttributes.has(name);
  },
  toggleAttribute(name, force) {
    if (force) carouselAttributes.set(name, "");
    else carouselAttributes.delete(name);
  }
};
const visibilityHooks = new Function(
  "ensureHomeFriendsCollapseControl",
  "getNativeHomeFriendList",
  "getHomeFriendsCollapseElements",
  `const HOME_FRIENDS_COLLAPSED_ATTRIBUTE = "data-rsl-home-friends-collapsed";\n` +
    `const HOME_FRIENDS_BODY_ATTRIBUTE = "data-rsl-home-friends-body";\n` +
    `let homeFriendsCollapsed = false;\n` +
    `${syncSource};\n` +
    `return {\n` +
    `  syncHomeFriendsCollapsedState,\n` +
    `  setCollapsed(value) { homeFriendsCollapsed = value === true; }\n` +
    `};`
)(
  () => toggle,
  () => list,
  () => ({ header, heading, list, body, contentHost: bodyShell })
);

visibilityHooks.setCollapsed(false);
visibilityHooks.syncHomeFriendsCollapsedState(nativeCarousel);
assert.equal(header.hidden, false);
assert.equal(headerAttributes.has("aria-hidden"), false);
assert.equal(bodyShell.hidden, false);
assert.equal(body.hidden, false);
assert.equal(list.hidden, false);
assert.equal(toggle.textContent, "Hide");
assert.equal(toggleAttributes.get("aria-expanded"), "true");
assert.equal(toggleAttributes.get("aria-label"), "Hide Friends");
assert.equal(toggleAttributes.get("aria-controls"), "rsl-home-friends-body");
assert.strictEqual(header.children[0], heading);
assert.strictEqual(header.children[1], toggle);
assert.strictEqual(header.children[2], seeAll);

visibilityHooks.setCollapsed(true);
visibilityHooks.syncHomeFriendsCollapsedState(nativeCarousel);
assert.equal(header.hidden, false, "Hide must keep the native Friends header visible");
assert.equal(headerAttributes.has("aria-hidden"), false);
assert.equal(toggle.hidden, false);
assert.equal(toggle.textContent, "Show");
assert.equal(toggleAttributes.get("aria-expanded"), "false");
assert.equal(toggleAttributes.get("aria-label"), "Show Friends");
for (const [name, node, attributes] of [
  ["body shell", bodyShell, bodyShellAttributes],
  ["body", body, bodyAttributes],
  ["list", list, listAttributes]
]) {
  assert.equal(node.hidden, true, `collapsed native Friends ${name} must be hidden`);
  assert.equal(attributes.has("aria-hidden"), true, `${name} must leave the accessibility tree`);
}
assert.equal(carouselAttributes.has("data-rsl-home-friends-collapsed"), true);
assert.strictEqual(header.children[2], seeAll, "native See All must remain the same visible node");
const writesAfterCollapse = toggleTextWrites;
visibilityHooks.syncHomeFriendsCollapsedState(nativeCarousel);
assert.equal(
  toggleTextWrites,
  writesAfterCollapse,
  "an unchanged state must preserve the toggle Text node and avoid observer churn"
);

visibilityHooks.setCollapsed(false);
visibilityHooks.syncHomeFriendsCollapsedState(nativeCarousel);
assert.equal(bodyShell.hidden, false);
assert.equal(body.hidden, false);
assert.equal(list.hidden, false);
assert.equal(bodyShellAttributes.has("aria-hidden"), false);
assert.equal(bodyAttributes.has("aria-hidden"), false);
assert.equal(listAttributes.has("aria-hidden"), false);
assert.equal(carouselAttributes.has("data-rsl-home-friends-collapsed"), false);
assert.strictEqual(header.children[0], heading, "native heading identity must survive Hide/Show");
assert.strictEqual(header.children[1], toggle, "the direct-sibling control must survive Hide/Show");
assert.strictEqual(header.children[2], seeAll, "native See All identity must survive Hide/Show");

const setContentSource = extractFunction("setHomeFriendsContentCollapsed");
const restoreMeasurementSource = extractFunction(
  "restoreHomeFriendsContentForMeasurement"
);
const layoutRootAttributes = new Map();
const layoutShellAttributes = new Map();
const layoutBodyAttributes = new Map();
const layoutListAttributes = new Map();
const layoutRoot = {
  toggleAttribute(name, force) {
    if (force) layoutRootAttributes.set(name, "");
    else layoutRootAttributes.delete(name);
  },
  removeAttribute(name) {
    layoutRootAttributes.delete(name);
  }
};
const layoutShell = makeVisibilityNode(layoutShellAttributes);
const layoutBody = makeVisibilityNode(layoutBodyAttributes);
const layoutList = makeVisibilityNode(layoutListAttributes);
const contentLayoutHooks = new Function(
  "getHomeFriendsCollapseElements",
  `const HOME_FRIENDS_COLLAPSED_ATTRIBUTE = "data-rsl-home-friends-collapsed";\n` +
    `const HOME_FRIENDS_BODY_ATTRIBUTE = "data-rsl-home-friends-body";\n` +
    `${setContentSource};\n` +
    `${restoreMeasurementSource};\n` +
    `return { setHomeFriendsContentCollapsed, restoreHomeFriendsContentForMeasurement };`
)(() => ({
  header: null,
  heading: null,
  list: layoutList,
  body: layoutBody,
  contentHost: layoutShell
}));
contentLayoutHooks.setHomeFriendsContentCollapsed(layoutRoot, true);
assert.equal(layoutRootAttributes.has("data-rsl-home-friends-collapsed"), true);
for (const [name, element, attributes] of [
  ["height-owning body shell", layoutShell, layoutShellAttributes],
  ["inner body", layoutBody, layoutBodyAttributes],
  ["list", layoutList, layoutListAttributes]
]) {
  assert.equal(element.hidden, true, `${name} must leave document flow on Hide`);
  assert.equal(attributes.has("aria-hidden"), true, `${name} must be inaccessible on Hide`);
  assert.equal(
    attributes.has("data-rsl-home-friends-body"),
    true,
    `${name} must receive the collapsed body marker`
  );
}
contentLayoutHooks.restoreHomeFriendsContentForMeasurement(layoutRoot);
assert.equal(layoutRootAttributes.has("data-rsl-home-friends-collapsed"), false);
for (const [name, element, attributes] of [
  ["height-owning body shell", layoutShell, layoutShellAttributes],
  ["inner body", layoutBody, layoutBodyAttributes],
  ["list", layoutList, layoutListAttributes]
]) {
  assert.equal(element.hidden, false, `${name} must return to flow for measurement/Show`);
  assert.equal(attributes.has("aria-hidden"), false, `${name} must return to the accessibility tree`);
}

assert.match(
  styles,
  /\.react-friends-carousel-container[^\{]*\[data-rsl-home-friends-collapsed\][\s\S]*\.friends-carousel-container[\s\S]*display:\s*none\s*!important;/,
  "collapsed native Friends must have no painted people/body row"
);
assert.match(
  styles,
  /\.react-friends-carousel-container[^\{]*\[data-rsl-home-friends-collapsed\][^\{]*\{[^}]*height:\s*auto\s*!important;[^}]*min-height:\s*0\s*!important;[^}]*max-height:\s*none\s*!important;/s,
  "the collapsed native root must release fixed height constraints"
);
assert.match(
  styles,
  /\.react-friends-carousel-container[^\n]*\[data-rsl-home-friends-collapsed\][\s\S]{0,160}>\s*:not\(\.container-header\)[\s\S]{0,420}display:\s*none\s*!important;/,
  "every direct non-header content host, including .btr-friends-list, must leave layout"
);
assert.match(
  styles,
  /\[data-rsl-home-friends-header\][\s\S]*display:\s*grid[\s\S]*grid-template-columns:/,
  "the marked native header must reserve separate heading, toggle, and See All columns"
);

const mountSource = extractFunction("mountHomeFriendsCollapseControl");
assert.match(mountSource, /if \(!isHomePage\(\)\)/);
assert.match(mountSource, /cleanupHomeFriendsCollapseControl\(\)/);
assert.match(mountSource, /findNativeHomeFriendsCarousel\(\)/);
assert.match(mountSource, /ensureHomeFriendsCollapseControl\(nativeCarousel\)/);
assert.match(mountSource, /syncHomeFriendsCollapsedState\(nativeCarousel\)/);
assert.doesNotMatch(
  mountSource,
  /BEST_FRIENDS_CAROUSEL_ATTRIBUTE|mountBestFriendsCarousel|renderBestFriendsCarousel|renderQuickSettings/,
  "the native control mount must not mutate the Best Friends/Quick Settings stack"
);

const cleanupSource = extractFunction("cleanupHomeFriendsCollapseControl");
assert.match(cleanupSource, /HOME_FRIENDS_TOGGLE_ATTRIBUTE/);
assert.match(cleanupSource, /HOME_FRIENDS_COLLAPSED_ATTRIBUTE/);
assert.match(cleanupSource, /aria-hidden/);
assert.doesNotMatch(
  cleanupSource,
  /cleanupBestFriendsHome|cleanupQuickSettingsHome|BEST_FRIENDS_CAROUSEL_ATTRIBUTE|QUICK_SETTINGS_ATTRIBUTE/,
  "leaving Home must clean only native Friends collapse state"
);

const extensionMountSource = extractFunction("mountExtensionFeatures");
assert.match(
  extensionMountSource,
  /mountHomeFriendsCollapseControl\(\);/,
  "every normal mount/React rerender must idempotently reconcile the native control"
);
assert.ok(
  extensionMountSource.indexOf("if (!featureSettingsLoaded)") <
    extensionMountSource.indexOf("mountHomeFriendsCollapseControl();"),
  "the initial control/visibility paint must wait until persisted layout has loaded"
);
assert.ok(
  extensionMountSource.indexOf("mountBestFriendsCarousel();") <
    extensionMountSource.indexOf("mountHomeFriendsCollapseControl();"),
  "Best Friends must clone/measure first, before the native row is hidden"
);

const sanitizerSource = extractFunction("sanitizeBestFriendsClone");
assert.match(
  sanitizerSource,
  /HOME_FRIENDS_TOGGLE_ATTRIBUTE[\s\S]*\.remove\(\)/,
  "a clone made from an already enhanced native row must drop the native Hide/Show control"
);
for (const marker of [
  "HOME_FRIENDS_HEADER_ATTRIBUTE",
  "HOME_FRIENDS_BODY_ATTRIBUTE",
  "HOME_FRIENDS_COLLAPSED_ATTRIBUTE"
]) {
  assert.match(
    sanitizerSource,
    new RegExp(marker),
    `Best Friends clones must not inherit ${marker}`
  );
}
assert.match(
  sanitizerSource,
  /removeAttribute\((?:attribute|HOME_FRIENDS_[A-Z_]+_ATTRIBUTE)\)/,
  "the native marker list must be removed from cloned elements"
);

// Exercise a clone that was taken after the native row had already been
// enhanced and collapsed. Sanitizing it must produce a visible, marker-free
// Best Friends template without touching the original nodes.
class CloneNode {
  constructor(attributes = {}) {
    this.attributes = new Map(Object.entries(attributes));
    this.children = [];
    this.parentElement = null;
    this.hidden = false;
    this.removed = false;
    this.classList = { remove() {} };
  }

  append(...children) {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
  }

  getAttributeNames() {
    return Array.from(this.attributes.keys());
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === "id") this.id = "";
  }

  remove() {
    this.removed = true;
    if (this.parentElement) {
      this.parentElement.children = this.parentElement.children.filter(
        (child) => child !== this
      );
      this.parentElement = null;
    }
  }

  descendants() {
    const result = [];
    for (const child of this.children) {
      if (child.removed) continue;
      result.push(child, ...child.descendants());
    }
    return result;
  }

  querySelectorAll(selector) {
    const descendants = this.descendants();
    if (selector === "*") return descendants;
    const attributeMatch = selector.match(/^\[([^\]]+)\]$/);
    if (attributeMatch) {
      return descendants.filter((node) => node.hasAttribute(attributeMatch[1]));
    }
    return [];
  }
}

const contaminatedRoot = new CloneNode({
  "data-rsl-home-friends-collapsed": "",
  id: "native-carousel-id"
});
const contaminatedHeader = new CloneNode({
  "data-rsl-home-friends-header": ""
});
const contaminatedToggle = new CloneNode({
  "data-rsl-toggle-home-friends": "",
  id: "rsl-home-friends-toggle"
});
const contaminatedBodyShell = new CloneNode({
  "data-rsl-home-friends-body": "",
  "aria-hidden": "true"
});
const contaminatedBody = new CloneNode({
  "data-rsl-home-friends-body": "",
  "data-rsl-home-friends-owned-id": "",
  "aria-hidden": "true",
  id: "rsl-home-friends-body"
});
const contaminatedList = new CloneNode({
  "data-rsl-home-friends-body": "",
  "aria-hidden": "true"
});
contaminatedBodyShell.hidden = true;
contaminatedBody.hidden = true;
contaminatedList.hidden = true;
contaminatedHeader.append(contaminatedToggle);
contaminatedBody.append(contaminatedList);
contaminatedBodyShell.append(contaminatedBody);
contaminatedRoot.append(contaminatedHeader, contaminatedBodyShell);

const sanitizeClone = new Function(
  `const HOME_FRIENDS_COLLAPSED_ATTRIBUTE = "data-rsl-home-friends-collapsed";\n` +
    `const HOME_FRIENDS_TOGGLE_ATTRIBUTE = "data-rsl-toggle-home-friends";\n` +
    `const HOME_FRIENDS_HEADER_ATTRIBUTE = "data-rsl-home-friends-header";\n` +
    `const HOME_FRIENDS_BODY_ATTRIBUTE = "data-rsl-home-friends-body";\n` +
    `const HOME_FRIENDS_OWNED_ID_ATTRIBUTE = "data-rsl-home-friends-owned-id";\n` +
    `${sanitizerSource};\n` +
    `return sanitizeBestFriendsClone;`
)();
sanitizeClone(contaminatedRoot);
assert.equal(contaminatedRoot.hasAttribute("data-rsl-home-friends-collapsed"), false);
assert.equal(contaminatedRoot.hasAttribute("id"), false);
assert.equal(contaminatedToggle.removed, true);
assert.equal(contaminatedHeader.hasAttribute("data-rsl-home-friends-header"), false);
for (const element of [
  contaminatedBodyShell,
  contaminatedBody,
  contaminatedList
]) {
  assert.equal(element.hidden, false);
  assert.equal(element.hasAttribute("aria-hidden"), false);
  assert.equal(element.hasAttribute("data-rsl-home-friends-body"), false);
  assert.equal(element.hasAttribute("data-rsl-home-friends-owned-id"), false);
  assert.equal(element.hasAttribute("id"), false);
}

const bestFriendsMountSource = extractFunction("mountBestFriendsCarousel");
const tileSpacingIndex = bestFriendsMountSource.indexOf(
  "syncBestFriendsTileSpacing(carousel, nativeCarousel)"
);
const finalNativeCollapseIndex = bestFriendsMountSource.lastIndexOf(
  "setHomeFriendsContentCollapsed(nativeCarousel, homeFriendsCollapsed)"
);
assert.ok(
  bestFriendsMountSource.indexOf("restoreHomeFriendsContentForMeasurement(nativeCarousel)") <
    tileSpacingIndex,
  "persisted collapse must temporarily expose the native template before tile measurement"
);
assert.ok(
  tileSpacingIndex < finalNativeCollapseIndex,
  "tile spacing must be captured before the native people row is hidden"
);
assert.ok(
  finalNativeCollapseIndex <
    bestFriendsMountSource.indexOf("placeBestFriendsCarousel(carousel, nativeCarousel)"),
  "placement must be rerun against the final persisted native visibility"
);
assert.match(
  bestFriendsMountSource,
  /const nativeList = getNativeHomeFriendList\(nativeCarousel\);\s*if \(!nativeList\) \{[\s\S]*?setHomeFriendsContentCollapsed\(nativeCarousel, homeFriendsCollapsed\);[\s\S]*?return;/,
  "a heading-only native mount must retain the persisted collapsed marker"
);
assert.match(
  bestFriendsMountSource,
  /restoreHomeFriendsContentForMeasurement\(nativeCarousel\);\s*try \{\s*syncBestFriendsTileSpacing\(carousel, nativeCarousel\);\s*\} finally \{\s*setHomeFriendsContentCollapsed\(nativeCarousel, homeFriendsCollapsed\);/,
  "temporary native-row measurement must restore collapse state in a finally block"
);

// A native Hide or Show reconciliation gets one final placement/observer pass.
// Hide measures before collapsing; Show measures after restoring. Neither path
// should schedule duplicate final placement passes from this controller.
const measureSource = extractFunction("measureHomeFriendsBeforeCollapse");
const refreshSource = extractFunction("refreshHomeFriendsDependentLayout");
const mountNativeSource = extractFunction("mountHomeFriendsCollapseControl");
const placementTraceHooks = new Function(
  "document",
  `const BEST_FRIENDS_CAROUSEL_ATTRIBUTE = "data-rsl-best-friends-carousel";\n` +
    `let homeFriendsCollapsed = false;\n` +
    `const trace = [];\n` +
    `const nativeCarousel = {};\n` +
    `const bestFriendsCarousel = {};\n` +
    `function isHomePage() { return true; }\n` +
    `function isFeatureEnabled(name) { return name === "bestFriends"; }\n` +
    `function findNativeHomeFriendsCarousel() { return nativeCarousel; }\n` +
    `function cleanupHomeFriendsCollapseControl() { trace.push("cleanup"); }\n` +
    `function syncBestFriendsTileSpacing() { trace.push("spacing"); }\n` +
    `function ensureHomeFriendsCollapseControl() { trace.push("ensure"); }\n` +
    `function syncHomeFriendsCollapsedState() { trace.push("sync"); }\n` +
    `function placeBestFriendsCarousel() { trace.push("place"); }\n` +
    `function observeBestFriendsGeometry() { trace.push("observe"); }\n` +
    `${measureSource};\n` +
    `${refreshSource};\n` +
    `${mountNativeSource};\n` +
    `return {\n` +
    `  run(collapsed) {\n` +
    `    homeFriendsCollapsed = collapsed === true;\n` +
    `    trace.length = 0;\n` +
    `    mountHomeFriendsCollapseControl();\n` +
    `    return trace.slice();\n` +
    `  }\n` +
    `};`
)({
  querySelector() {
    return {};
  }
});
assert.deepEqual(
  placementTraceHooks.run(true),
  ["spacing", "ensure", "sync", "place", "observe"],
  "Hide must measure once before collapse and place once afterward"
);
assert.deepEqual(
  placementTraceHooks.run(false),
  ["ensure", "sync", "spacing", "place", "observe"],
  "Show must restore first, measure once, and place once afterward"
);

const setterSource = [
  extractFunction("applyHomeFriendsCollapsedStorageValue"),
  extractFunction("applyDeferredHomeFriendsCollapsedStorageValue"),
  extractFunction("setHomeFriendsCollapsed")
].join("\n");
assert.doesNotMatch(
  setterSource,
  /loadBestFriendsContext|renderBestFriendsCarousel|renderQuickSettings|replaceChildren|cloneNode/,
  "Hide/Show must not refetch or rebuild any friends row"
);
assert.match(setterSource, /mountHomeFriendsCollapseControl\(\)/);

// Model a local write with Chrome's storage echo and a genuine cross-tab
// update. Local echo confirms state without a second mount/flicker.
const storageDocument = {
  activeElement: null,
  querySelector() {
    return null;
  },
  getElementById() {
    return null;
  }
};
const storageWindow = { clearTimeout() {} };
const storageHooks = new Function(
  "document",
  "window",
  `const HOME_FRIENDS_TOGGLE_ATTRIBUTE = "data-rsl-toggle-home-friends";\n` +
    `let homeFriendsCollapsed = false;\n` +
    `let homeFriendsCollapsedConfirmed = false;\n` +
    `let homeFriendsCollapsedPendingWrites = 0;\n` +
    `let homeFriendsCollapsedDeferredStorageValue = null;\n` +
    `let homeFriendsCollapsedWriteGeneration = 0;\n` +
    `let homeFriendsCollapsedWriteTail = Promise.resolve();\n` +
    `let featureSettingsLoaded = true;\n` +
    `let mountCalls = 0;\n` +
    `let echoLocalStorageWrite = false;\n` +
    `function findNativeHomeFriendsCarousel() { return null; }\n` +
    `function mountHomeFriendsCollapseControl() { mountCalls += 1; }\n` +
    `function homeFriendsCollapsedStorageSet(value) {\n` +
    `  if (echoLocalStorageWrite) {\n` +
    `    homeFriendsCollapsedDeferredStorageValue = value === true;\n` +
    `  }\n` +
    `  return Promise.resolve();\n` +
    `}\n` +
    `${setterSource}\n` +
    `return {\n` +
    `  applyHomeFriendsCollapsedStorageValue,\n` +
    `  applyDeferredHomeFriendsCollapsedStorageValue,\n` +
    `  setHomeFriendsCollapsed,\n` +
    `  reset({ collapsed, confirmed, pending = 0, deferred = null }) {\n` +
    `    homeFriendsCollapsed = collapsed === true;\n` +
    `    homeFriendsCollapsedConfirmed = confirmed === true;\n` +
    `    homeFriendsCollapsedPendingWrites = pending;\n` +
    `    homeFriendsCollapsedDeferredStorageValue = deferred;\n` +
    `    homeFriendsCollapsedWriteGeneration = 0;\n` +
    `    homeFriendsCollapsedWriteTail = Promise.resolve();\n` +
    `    echoLocalStorageWrite = false;\n` +
    `    mountCalls = 0;\n` +
    `  },\n` +
    `  setPending(value) { homeFriendsCollapsedPendingWrites = value; },\n` +
    `  runLocalWriteWithStorageEcho(value) {\n` +
    `    echoLocalStorageWrite = true;\n` +
    `    return setHomeFriendsCollapsed(value).finally(() => {\n` +
    `      echoLocalStorageWrite = false;\n` +
    `    });\n` +
    `  },\n` +
    `  snapshot() {\n` +
    `    return {\n` +
    `      collapsed: homeFriendsCollapsed,\n` +
    `      confirmed: homeFriendsCollapsedConfirmed,\n` +
    `      pending: homeFriendsCollapsedPendingWrites,\n` +
    `      deferred: homeFriendsCollapsedDeferredStorageValue,\n` +
    `      mountCalls\n` +
    `    };\n` +
    `  }\n` +
    `};`
)(storageDocument, storageWindow);

storageHooks.reset({ collapsed: false, confirmed: false });
storageHooks.applyHomeFriendsCollapsedStorageValue(true);
assert.deepEqual(storageHooks.snapshot(), {
  collapsed: true,
  confirmed: true,
  pending: 0,
  deferred: null,
  mountCalls: 1
});

storageHooks.reset({ collapsed: false, confirmed: false, pending: 1, deferred: true });
storageHooks.setPending(0);
storageHooks.applyDeferredHomeFriendsCollapsedStorageValue();
assert.deepEqual(storageHooks.snapshot(), {
  collapsed: true,
  confirmed: true,
  pending: 0,
  deferred: null,
  mountCalls: 1
});

storageHooks.reset({ collapsed: true, confirmed: true });
const localWriteEchoTest = storageHooks.runLocalWriteWithStorageEcho(false).then(() => {
  assert.deepEqual(
    storageHooks.snapshot(),
    {
      collapsed: false,
      confirmed: false,
      pending: 0,
      deferred: null,
      mountCalls: 1
    },
    "Show and its own storage echo must reconcile once without flicker"
  );
});

const bootstrapSource = sourceSection(
  "    chrome.storage.onChanged.addListener(",
  "  const contentTestHooks = globalThis.__rslContentTestHooks;"
);
assert.match(bootstrapSource, /changes\[HOME_FRIENDS_COLLAPSED_STORAGE_KEY\]/);
assert.match(bootstrapSource, /homeFriendsCollapsedLoadGeneration \+= 1/);
assert.match(bootstrapSource, /applyHomeFriendsCollapsedStorageValue\(nextCollapsed\)/);
assert.match(bootstrapSource, /homeFriendsCollapsedStorageGet\(\)/);
assert.match(
  bootstrapSource,
  /homeFriendsCollapsed = storedHomeFriendsCollapsed;[\s\S]*homeFriendsCollapsedConfirmed = storedHomeFriendsCollapsed;[\s\S]*mountExtensionFeatures\(\)/,
  "initial storage must be assigned before the first feature-loaded Home mount"
);

localWriteEchoTest
  .then(() => {
    console.log(
      "PASS native Home Friends persistent Hide/Show, node preservation, rerender, and isolation contract"
    );
  })
  .catch((error) => {
    process.nextTick(() => {
      throw error;
    });
  });
