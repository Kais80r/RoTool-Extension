"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "content.js"), "utf8");

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `${startMarker} contract must exist`);
  return source.slice(start, end);
}

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
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = "";
      }
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

assert.match(
  source,
  /const ALL_FRIENDS_FILTER_VALUE = "all";/,
  "the custom renderer needs an explicit All mode distinct from native Trusted"
);

const activeFriendsSource = section(
  "  function getActivePresenceFriends(",
  "  function getActiveFriendsLoadState("
);
assert.match(
  activeFriendsSource,
  /ALL_FRIENDS_FILTER_VALUE/,
  "the active-list selector must recognize custom All"
);
assert.match(
  activeFriendsSource,
  /allOnlineFriends/,
  "custom All must include every online friend"
);
assert.match(
  activeFriendsSource,
  /allOfflineFriends/,
  "custom All must include every offline friend"
);
assert.match(
  activeFriendsSource,
  /onlineFriendsTotal/,
  "the custom All total must include Roblox's complete online count"
);
assert.match(
  activeFriendsSource,
  /offlineFriendsTotal/,
  "the custom All total must include Roblox's complete offline count"
);

const orderedSnapshotHelpers = new Function(
  `const ALL_FRIENDS_FILTER_VALUE = "all";\n` +
    `const BEST_FRIENDS_FILTER_VALUE = "best-friends";\n` +
    `let activeFriendsPresenceFilter = ALL_FRIENDS_FILTER_VALUE;\n` +
    `let bestFriendDetails = [];\n` +
    `let allOnlineFriends = [];\n` +
    `let allOfflineFriends = [];\n` +
    `let allFriendUserIds = [];\n` +
    `${extractFunction("normalizeAllFriendUserIds")}\n` +
    `${extractFunction("getActivePresenceFriends")}\n` +
    `return {\n` +
    `  normalizeAllFriendUserIds,\n` +
    `  render(values, onlineFriends, offlineFriends) {\n` +
    `    allOnlineFriends = onlineFriends;\n` +
    `    allOfflineFriends = offlineFriends;\n` +
    `    allFriendUserIds = normalizeAllFriendUserIds(\n` +
    `      values,\n` +
    `      onlineFriends,\n` +
    `      offlineFriends\n` +
    `    );\n` +
    `    return {\n` +
    `      normalizedIds: [...allFriendUserIds],\n` +
    `      friends: getActivePresenceFriends()\n` +
    `    };\n` +
    `  }\n` +
    `};`
)();

const friend = (userId, partition) => ({ userId, partition });
const interleavedSnapshot = orderedSnapshotHelpers.render(
  ["1", "2", "3", "4", "5", "6"],
  [friend("6", "online"), friend("2", "online"), friend("4", "online")],
  [friend("5", "offline"), friend("1", "offline"), friend("3", "offline")]
);
assert.deepEqual(
  interleavedSnapshot.friends.map(({ userId }) => userId),
  ["1", "2", "3", "4", "5", "6"],
  "All must preserve Roblox's canonical friend order rather than grouping by presence"
);
assert.deepEqual(
  interleavedSnapshot.friends.map(({ partition }) => partition),
  ["offline", "online", "offline", "online", "offline", "online"],
  "canonical All ordering must support online/offline interleaving"
);

const defensiveSnapshot = orderedSnapshotHelpers.render(
  ["3", 2, "2", "999", null, "5"],
  [friend("2", "online"), friend("4", "online")],
  [friend("1", "offline"), friend("3", "offline"), friend("2", "offline-duplicate")]
);
assert.deepEqual(
  defensiveSnapshot.normalizedIds,
  ["3", "2", "4", "1"],
  "unknown canonical IDs and duplicates must be dropped while omitted available friends are appended"
);
assert.deepEqual(
  defensiveSnapshot.friends.map(({ userId }) => userId),
  ["3", "2", "4", "1"],
  "duplicate partition entries must still render one card in deterministic order"
);
assert.equal(
  new Set(defensiveSnapshot.friends.map(({ userId }) => userId)).size,
  defensiveSnapshot.friends.length,
  "defensive All merging must never render a user twice"
);

const refreshSource = section(
  "  function scheduleOnlineFriendsRefresh(",
  "  function loadAllOnlineFriends("
);
assert.match(
  refreshSource,
  /ALL_FRIENDS_FILTER_VALUE/,
  "custom All must keep the same complete presence snapshot refresh as Online and Offline"
);

const loadSource = section(
  "  function loadAllOnlineFriends(",
  "  function getNativeFriendsLists("
);
assert.match(
  loadSource,
  /activeFriendsPresenceFilter\s*===\s*ALL_FRIENDS_FILTER_VALUE/,
  "All must enrich offline cards instead of leaving the complete list on placeholders"
);

const activationSource = section(
  "  function activateFriendsPresenceFilter(",
  "  function getFriendsFilterName("
);
assert.match(
  activationSource,
  /presenceFilter\s*===\s*ALL_FRIENDS_FILTER_VALUE/,
  "activating All must request offline-card enrichment when needed"
);

const mountSource = section(
  "  function mountOnlineFriendsFilter(",
  "  function bestFriendListsEqual("
);
assert.match(
  mountSource,
  /context\.allButton\.getAttribute\("aria-pressed"\)\s*===\s*"true"[\s\S]*?activateFriendsPresenceFilter\(context,\s*ALL_FRIENDS_FILTER_VALUE\)/,
  "a Friends page that opens on Roblox's All chip must immediately use RoTool's complete renderer"
);
assert.match(
  mountSource,
  /activeFriendsPresenceFilter\s*===\s*ALL_FRIENDS_FILTER_VALUE/,
  "custom All must keep Roblox's existing All chip visually selected"
);
assert.doesNotMatch(
  source,
  /makeFriendsPresenceButton\(context,\s*ALL_FRIENDS_FILTER_VALUE\)/,
  "RoTool must reuse Roblox's All chip rather than add a duplicate All button"
);

const deepLinkBranch = mountSource.indexOf("isBestFriendsDeepLink()");
const defaultAllBranch = mountSource.indexOf(
  'context.allButton.getAttribute("aria-pressed") === "true"'
);
assert.ok(
  deepLinkBranch >= 0 && defaultAllBranch > deepLinkBranch,
  "the Best Friends deep link must be consumed before the default All takeover"
);
assert.match(
  mountSource,
  /!isFriendsListSubview\(\)/,
  "custom friend filters must unmount outside Roblox's Friends subview"
);

const friendsRouteLocation = {
  pathname: "/users/friends",
  search: "",
  hash: "#!/friends"
};
const routeHelpers = new Function(
  "document",
  "location",
  "URLSearchParams",
  `const BEST_FRIENDS_FILTER_VALUE = "best-friends";\n` +
    `${extractFunction("isFriendsPage")}\n` +
    `${extractFunction("isFriendsListSubview")}\n` +
    `${extractFunction("isBestFriendsDeepLink")}\n` +
    `return { isFriendsListSubview, isBestFriendsDeepLink };`
)(
  { documentElement: { dataset: {} } },
  friendsRouteLocation,
  URLSearchParams
);
assert.equal(routeHelpers.isFriendsListSubview(), true);
for (const hash of ["#!/following", "#!/followers", "#!/requests"]) {
  friendsRouteLocation.hash = hash;
  assert.equal(
    routeHelpers.isFriendsListSubview(),
    false,
    `${hash} must retain Roblox's own subview instead of mounting custom All`
  );
}
friendsRouteLocation.hash = "#!/friends";
friendsRouteLocation.search = "?rotool=best-friends";
assert.equal(
  routeHelpers.isBestFriendsDeepLink(),
  true,
  "the Best Friends deep link must remain recognized on the Friends subview"
);

// Exercise the native-chip click policy separately from DOM rendering. All owns
// the complete RoTool renderer; Trusted is deliberately left to Roblox.
const bindSource = extractFunction("bindNativeFriendsFilters");
const allButton = {
  hasAttribute() {
    return false;
  }
};
const trustedButton = {
  hasAttribute() {
    return false;
  }
};
const group = {
  listener: null,
  addEventListener(type, listener) {
    assert.equal(type, "click");
    this.listener = listener;
  },
  contains(button) {
    return button === allButton || button === trustedButton;
  },
  querySelectorAll() {
    return [allButton, trustedButton];
  }
};
const context = { group, allButton, trustedButton, mount: {} };
const activated = [];
const disabled = [];
let queuedMounts = 0;
const bindNativeFriendsFilters = new Function(
  "ONLINE_FILTER_CONTROL_ATTRIBUTE",
  "ALL_FRIENDS_FILTER_VALUE",
  "boundFriendsFilterGroups",
  "suppressNativeFriendsFilterClick",
  "findFriendsContext",
  "activateFriendsPresenceFilter",
  "disableOnlineFriendsFilter",
  "queueMount",
  "normalizeVisibleText",
  "isFeatureEnabled",
  `${bindSource}; return bindNativeFriendsFilters;`
)(
  "data-rsl-online-friends-control",
  "all",
  new WeakSet(),
  false,
  () => context,
  (selectedContext, filter) => activated.push({ selectedContext, filter }),
  (button) => disabled.push(button),
  () => {
    queuedMounts += 1;
  },
  (button) => (button === allButton ? "All" : "Trusted"),
  () => true
);

bindNativeFriendsFilters(group, context);
assert.equal(typeof group.listener, "function");

function click(button) {
  group.listener({
    preventDefault() {},
    stopPropagation() {},
    target: {
      closest(selector) {
        assert.equal(selector, "button");
        return button;
      }
    }
  });
}

click(allButton);
assert.deepEqual(
  activated,
  [{ selectedContext: context, filter: "all" }],
  "clicking the native All chip must activate the complete custom list"
);
assert.deepEqual(disabled, [], "All must not restore Roblox's broken native renderer");

click(trustedButton);
assert.deepEqual(
  disabled,
  [trustedButton],
  "clicking Trusted must disable the custom list and restore Roblox's Trusted renderer"
);
assert.equal(queuedMounts, 2, "both native chip transitions should reconcile once");

const disableSource = extractFunction("disableOnlineFriendsFilter");
assert.match(disableSource, /activeFriendsPresenceFilter = null;/);
assert.match(disableSource, /restoreNativeFriendsChip\(selectedNativeButton\);/);
assert.match(disableSource, /reconcileOnlineFriendCards\(null\);/);

console.log("PASS complete custom All friends list and native Trusted restoration contract");
