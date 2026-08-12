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
  /const BEST_FRIENDS_COLLAPSED_STORAGE_KEY = "rslBestFriendsCollapsedV1";/,
  "Best Friends visibility must persist independently from feature enablement"
);
for (const functionName of [
  "bestFriendsCollapsedStorageGet",
  "bestFriendsCollapsedStorageSet",
  "applyBestFriendsCollapsedStorageValue",
  "applyDeferredBestFriendsCollapsedStorageValue",
  "setBestFriendsCollapsed"
]) {
  assert.ok(source.includes(`function ${functionName}(`), `${functionName} must exist`);
}

assert.match(source, /id = "rsl-best-friends-toggle"/);
assert.match(source, /type = "button"/);
assert.match(source, /aria-expanded/);
assert.match(source, /aria-controls/);
assert.match(source, /Hide Best Friends/);
assert.match(source, /Show Best Friends/);
assert.match(
  source,
  /if \(toggle\.textContent !== nextToggleText\) \{\s*toggle\.textContent = nextToggleText;/,
  "unchanged Hide/Show text must preserve its Text node and avoid mutation remounts"
);

const controlSource = extractFunction("ensureBestFriendsCollapseControl");
assert.match(controlSource, /headingGroup\.className = "rsl-best-friends-heading-group"/);
assert.match(controlSource, /heading\.replaceWith\(headingGroup\)/);
assert.ok(
  controlSource.indexOf("headingGroup.append(heading)") <
    controlSource.indexOf("headingGroup.append(toggle)"),
  "the toggle must sit immediately after the Best Friends h2/count group"
);

// Hide keeps the header, toggle, Manage, and See All available. Only the
// people/body row leaves layout and the accessibility tree, and Show restores
// those exact nodes rather than rebuilding avatars.
const syncVisibilitySource = extractFunction("syncBestFriendsCollapsedState");
const visibilitySource = extractFunction("setBestFriendsHomeVisibility");
const headerAttributes = new Map();
const bodyAttributes = new Map();
const listAttributes = new Map();
const carouselAttributes = new Map();
const manage = { id: "manage" };
const seeAll = { id: "see-all" };
const makeVisibilityNode = (attributes, children = []) => ({
  hidden: false,
  children,
  setAttribute(name, value) {
    attributes.set(name, String(value));
  },
  toggleAttribute(name, force) {
    if (force) attributes.set(name, "");
    else attributes.delete(name);
  }
});
const header = makeVisibilityNode(headerAttributes, [manage, seeAll]);
const body = makeVisibilityNode(bodyAttributes);
const list = makeVisibilityNode(listAttributes);
list.closest = () => body;
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
const visibilityCarousel = {
  dataset: {},
  hasAttribute(name) {
    return carouselAttributes.has(name);
  },
  toggleAttribute(name, force) {
    if (force) {
      carouselAttributes.set(name, "");
      if (name === "data-rsl-best-friends-disabled") {
        this.dataset.rslBestFriendsDisabled = "";
      }
    } else {
      carouselAttributes.delete(name);
      if (name === "data-rsl-best-friends-disabled") {
        delete this.dataset.rslBestFriendsDisabled;
      }
    }
  }
};
let hoverCloseCalls = 0;
const visibilityHooks = new Function(
  "ensureBestFriendsHeader",
  "ensureBestFriendsCollapseControl",
  "getNativeHomeFriendList",
  "closeBestFriendHoverCard",
  `const BEST_FRIENDS_LIST_ATTRIBUTE = "data-rsl-best-friends-list";\n` +
    `const BEST_FRIENDS_BODY_ATTRIBUTE = "data-rsl-best-friends-body";\n` +
    `const BEST_FRIENDS_COLLAPSED_ATTRIBUTE = "data-rsl-best-friends-collapsed";\n` +
    `let bestFriendsCollapsed = false;\n` +
    `${syncVisibilitySource};\n` +
    `${visibilitySource};\n` +
    `return {\n` +
    `  setBestFriendsHomeVisibility,\n` +
    `  syncBestFriendsCollapsedState,\n` +
    `  setCollapsed(value) { bestFriendsCollapsed = value === true; }\n` +
    `};`
)(
  () => header,
  () => toggle,
  () => list,
  () => {
    hoverCloseCalls += 1;
  }
);

visibilityHooks.setCollapsed(false);
visibilityHooks.setBestFriendsHomeVisibility(visibilityCarousel, true);
assert.equal(header.hidden, false);
assert.equal(headerAttributes.has("aria-hidden"), false);
assert.equal(body.hidden, false);
assert.equal(list.hidden, false);
assert.equal(toggle.hidden, false);
assert.equal(toggle.textContent, "Hide");
assert.equal(toggleAttributes.get("aria-expanded"), "true");
assert.equal(toggleAttributes.get("aria-label"), "Hide Best Friends");
assert.equal(toggleAttributes.get("aria-controls"), "rsl-best-friends-home-body");
assert.strictEqual(header.children[0], manage);
assert.strictEqual(header.children[1], seeAll);

visibilityHooks.setCollapsed(true);
visibilityHooks.syncBestFriendsCollapsedState(visibilityCarousel);
assert.equal(header.hidden, false, "Hide must keep the Best Friends header visible");
assert.equal(headerAttributes.has("aria-hidden"), false);
assert.equal(toggle.hidden, false);
assert.equal(toggle.textContent, "Show");
assert.equal(toggleAttributes.get("aria-expanded"), "false");
assert.equal(toggleAttributes.get("aria-label"), "Show Best Friends");
for (const [name, node, attributes] of [
  ["body", body, bodyAttributes],
  ["list", list, listAttributes]
]) {
  assert.equal(node.hidden, true, `collapsed Best Friends ${name} must be hidden`);
  assert.equal(attributes.has("aria-hidden"), true, `${name} must leave the accessibility tree`);
}
assert.equal(carouselAttributes.has("data-rsl-best-friends-collapsed"), true);
assert.equal(hoverCloseCalls, 1, "collapse must close a visible friend hover card");
assert.strictEqual(header.children[0], manage, "Manage must remain visible while collapsed");
assert.strictEqual(header.children[1], seeAll, "See All must remain visible while collapsed");
const writesAfterCollapse = toggleTextWrites;
visibilityHooks.syncBestFriendsCollapsedState(visibilityCarousel);
assert.equal(
  toggleTextWrites,
  writesAfterCollapse,
  "an unchanged collapsed state must preserve the toggle's Text node"
);

visibilityHooks.setCollapsed(false);
visibilityHooks.syncBestFriendsCollapsedState(visibilityCarousel);
assert.equal(header.hidden, false);
assert.equal(body.hidden, false);
assert.equal(list.hidden, false);
assert.equal(carouselAttributes.has("data-rsl-best-friends-collapsed"), false);
assert.strictEqual(header.children[0], manage, "Manage node identity must survive Hide/Show");
assert.strictEqual(header.children[1], seeAll, "See All node identity must survive Hide/Show");

assert.match(
  styles,
  /\.rsl-best-friends-carousel\[data-rsl-best-friends-collapsed\][\s\S]*\[data-rsl-best-friends-body\][\s\S]*display:\s*none\s*!important;/,
  "collapsed Best Friends must have no painted people/body row"
);

const mountSource = sourceSection(
  "  function mountBestFriendsCarousel(",
  "  function normalizeQuickPlayPlaceId("
);
assert.match(
  mountSource,
  /setBestFriendsHomeVisibility\(carousel, bestFriendsEnabled\)/,
  "feature visibility and persisted row collapse must remain distinct states"
);
assert.match(
  mountSource,
  /bestFriendsHomeActive = bestFriendsEnabled;/,
  "Hide is presentation state and must not deactivate or discard Best Friends data"
);

const placementSource = sourceSection(
  "  function placeBestFriendsCarousel(",
  "  function getBestFriendsPickerSearch("
);
assert.match(
  placementSource,
  /const bestFriendsExpanded =\s*hasBestFriendsRow\s*&&\s*!carousel\.hasAttribute\(BEST_FRIENDS_COLLAPSED_ATTRIBUTE\)/,
  "RoPro placement must distinguish a visible header-only collapsed row"
);
assert.match(
  placementSource,
  /const bestFriendsHeaderRect = hasBestFriendsRow/,
  "the visible collapsed header must remain collision-checked"
);
assert.match(
  placementSource,
  /const bestFriendsBodyRect = bestFriendsExpanded/,
  "the hidden people body must not reserve or collision-probe its expanded footprint"
);

const setterSource = sourceSection(
  "  function applyBestFriendsCollapsedStorageValue(",
  "  function renderQuickSettings("
);
assert.doesNotMatch(setterSource, /loadBestFriendsContext|cleanupBestFriendsHome/);
assert.doesNotMatch(setterSource, /replaceChildren|\.remove\(/);
assert.doesNotMatch(setterSource, /bestFriendUserIds\s*=|bestFriendDetails\s*=|bestFriendsLoadState\s*=/);

// Mirror Chrome's local-write echo and a genuine cross-tab storage change.
// Both transitions mount synchronously once; the echo only confirms state.
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
  `const BEST_FRIENDS_CAROUSEL_ATTRIBUTE = "data-rsl-best-friends-carousel";\n` +
    `const BEST_FRIENDS_TOGGLE_ATTRIBUTE = "data-rsl-toggle-best-friends";\n` +
    `const BEST_FRIENDS_BODY_ATTRIBUTE = "data-rsl-best-friends-body";\n` +
    `let bestFriendsCollapsed = false;\n` +
    `let bestFriendsCollapsedConfirmed = false;\n` +
    `let bestFriendsCollapsedPendingWrites = 0;\n` +
    `let bestFriendsCollapsedDeferredStorageValue = null;\n` +
    `let bestFriendsCollapsedWriteGeneration = 0;\n` +
    `let bestFriendsCollapsedWriteTail = Promise.resolve();\n` +
    `let featureSettingsLoaded = true;\n` +
    `let bestFriendsScrollLockUntil = 0;\n` +
    `let bestFriendsScrollSettleTimer = null;\n` +
    `let bestFriendHoverCard = null;\n` +
    `let mountCalls = 0;\n` +
    `let echoLocalStorageWrite = false;\n` +
    `function mountBestFriendsCarousel() { mountCalls += 1; }\n` +
    `function bestFriendsCollapsedStorageSet(value) {\n` +
    `  if (echoLocalStorageWrite) {\n` +
    `    bestFriendsCollapsedDeferredStorageValue = value === true;\n` +
    `  }\n` +
    `  return Promise.resolve();\n` +
    `}\n` +
    `${setterSource}\n` +
    `return {\n` +
    `  applyBestFriendsCollapsedStorageValue,\n` +
    `  applyDeferredBestFriendsCollapsedStorageValue,\n` +
    `  setBestFriendsCollapsed,\n` +
    `  reset({ collapsed, confirmed, pending = 0, deferred = null }) {\n` +
    `    bestFriendsCollapsed = collapsed === true;\n` +
    `    bestFriendsCollapsedConfirmed = confirmed === true;\n` +
    `    bestFriendsCollapsedPendingWrites = pending;\n` +
    `    bestFriendsCollapsedDeferredStorageValue = deferred;\n` +
    `    bestFriendsCollapsedWriteGeneration = 0;\n` +
    `    bestFriendsCollapsedWriteTail = Promise.resolve();\n` +
    `    echoLocalStorageWrite = false;\n` +
    `    mountCalls = 0;\n` +
    `  },\n` +
    `  setPending(value) { bestFriendsCollapsedPendingWrites = value; },\n` +
    `  runLocalWriteWithStorageEcho(value) {\n` +
    `    echoLocalStorageWrite = true;\n` +
    `    return setBestFriendsCollapsed(value).finally(() => {\n` +
    `      echoLocalStorageWrite = false;\n` +
    `    });\n` +
    `  },\n` +
    `  snapshot() {\n` +
    `    return {\n` +
    `      collapsed: bestFriendsCollapsed,\n` +
    `      confirmed: bestFriendsCollapsedConfirmed,\n` +
    `      pending: bestFriendsCollapsedPendingWrites,\n` +
    `      deferred: bestFriendsCollapsedDeferredStorageValue,\n` +
    `      mountCalls\n` +
    `    };\n` +
    `  }\n` +
    `};`
)(storageDocument, storageWindow);

storageHooks.reset({ collapsed: false, confirmed: true });
storageHooks.applyBestFriendsCollapsedStorageValue(false);
assert.deepEqual(storageHooks.snapshot(), {
  collapsed: false,
  confirmed: false,
  pending: 0,
  deferred: null,
  mountCalls: 0
});

storageHooks.reset({ collapsed: false, confirmed: false });
storageHooks.applyBestFriendsCollapsedStorageValue(true);
assert.deepEqual(
  storageHooks.snapshot(),
  {
    collapsed: true,
    confirmed: true,
    pending: 0,
    deferred: null,
    mountCalls: 1
  },
  "a cross-tab Hide must reconcile exactly once"
);

storageHooks.reset({ collapsed: false, confirmed: false, pending: 1, deferred: true });
storageHooks.setPending(0);
storageHooks.applyDeferredBestFriendsCollapsedStorageValue();
assert.deepEqual(
  storageHooks.snapshot(),
  {
    collapsed: true,
    confirmed: true,
    pending: 0,
    deferred: null,
    mountCalls: 1
  },
  "a genuinely different deferred cross-tab value must apply once"
);

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
    "Show and its own storage echo must produce one synchronous mount without flicker"
  );
});

const bootstrapSource = sourceSection(
  "    chrome.storage.onChanged.addListener(",
  "  const contentTestHooks = globalThis.__rslContentTestHooks;"
);
assert.match(bootstrapSource, /changes\[BEST_FRIENDS_COLLAPSED_STORAGE_KEY\]/);
assert.match(bootstrapSource, /bestFriendsCollapsedLoadGeneration \+= 1/);
assert.match(bootstrapSource, /applyBestFriendsCollapsedStorageValue\(nextCollapsed\)/);
assert.match(bootstrapSource, /bestFriendsCollapsedStorageGet\(\)/);
assert.match(
  bootstrapSource,
  /bestFriendsCollapsed = storedBestFriendsCollapsed;[\s\S]*bestFriendsCollapsedConfirmed = storedBestFriendsCollapsed;/,
  "initial collapsed state must be loaded before the first Home mount"
);

localWriteEchoTest
  .then(() => {
    console.log(
      "PASS Best Friends persistent Hide/Show, accessibility, node preservation, and storage contract"
    );
  })
  .catch((error) => {
    process.nextTick(() => {
      throw error;
    });
  });
