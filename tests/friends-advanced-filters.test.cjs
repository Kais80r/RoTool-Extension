"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "content.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");

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

function ids(result) {
  return (
    Array.isArray(result)
      ? result
      : result?.matches || result?.friends || []
  ).map((friend) => friend.userId);
}

for (const declaration of [
  'const FRIENDS_ADVANCED_FILTER_BUTTON_ATTRIBUTE = "data-rsl-friends-filters-button";',
  'const FRIENDS_ADVANCED_FILTER_MENU_ATTRIBUTE = "data-rsl-friends-filters-menu";'
]) {
  assert.ok(source.includes(declaration), `${declaration} must exist`);
}

const definitionsStart = source.indexOf("const FRIENDS_ADVANCED_FILTER_DEFINITIONS");
assert.ok(definitionsStart >= 0, "FRIENDS_ADVANCED_FILTER_DEFINITIONS must exist");
const definitionsSource = source.slice(definitionsStart, definitionsStart + 12_000);

assert.match(
  definitionsSource,
  /placeholder:\s*["']Experience name, link, Place ID, or Universe ID["']/,
  "the experience field must lead with plain-name search while retaining link and ID support"
);

for (const label of [
  "Verified",
  "Roblox Plus",
  "Any",
  "In experience",
  "Online",
  "Offline",
  "In Studio",
  "Only",
  "Exclude",
  "Default",
  "Display name A-Z",
  "Display name Z-A",
  "Username A-Z",
  "Username Z-A",
  "In experience first",
  "Online first",
  "Offline first",
  "Best Friends first",
  "Verified first"
]) {
  assert.ok(definitionsSource.includes(label), `${label} must be offered by the safe Filters menu`);
}

for (const forbidden of [
  /Most Followers/i,
  /Most Friends/i,
  /Most Following/i,
  /Follows this user/i,
  /recent(?:ly)?[ -]online/i
]) {
  assert.doesNotMatch(
    definitionsSource,
    forbidden,
    `${forbidden} must not be exposed by the safe Filters menu`
  );
}

const safeStatuses = ["in-experience", "online", "offline", "studio"];
const safeBestFriendsModes = ["any", "only", "exclude"];
const safeSorts = [
  "default",
  "display-name-asc",
  "display-name-desc",
  "username-asc",
  "username-desc",
  "in-experience-first",
  "online-first",
  "offline-first",
  "best-friends-first",
  "verified-first"
];
const normalizeAdvancedState = new Function(
  "FRIENDS_ADVANCED_STATUS_VALUES",
  "FRIENDS_ADVANCED_BEST_FRIENDS_VALUES",
  "FRIENDS_ADVANCED_SORT_VALUES",
  `${extractFunction("normalizeFriendsAdvancedFilterState")}; return normalizeFriendsAdvancedFilterState;`
)(safeStatuses, safeBestFriendsModes, safeSorts);

const defaultState = {
  verifiedOnly: false,
  robloxPlusOnly: false,
  statuses: [],
  gameUniverseId: null,
  gameRootPlaceId: null,
  bestFriends: "any",
  sortBy: "default"
};
assert.deepEqual(
  normalizeAdvancedState(null),
  defaultState,
  "opening Filters must start with a safe no-op state"
);

assert.deepEqual(
  normalizeAdvancedState({
    verifiedOnly: 1,
    robloxPlusOnly: 1,
    statuses: ["studio", "online", "studio", "invalid", "in-experience"],
    gameUniverseId: 123,
    gameRootPlaceId: "456",
    bestFriends: "exclude",
    sortBy: "username-desc"
  }),
  {
    verifiedOnly: true,
    robloxPlusOnly: true,
    statuses: ["in-experience", "online", "studio"],
    gameUniverseId: "123",
    gameRootPlaceId: "456",
    bestFriends: "exclude",
    sortBy: "username-desc"
  },
  "safe state values, status choices, and decimal IDs must normalize deterministically"
);

for (const status of safeStatuses) {
  assert.deepEqual(
    normalizeAdvancedState({ statuses: [status] }).statuses,
    [status],
    `${status} must be a valid independent status choice`
  );
}
for (const bestFriends of safeBestFriendsModes) {
  assert.equal(
    normalizeAdvancedState({ bestFriends }).bestFriends,
    bestFriends,
    `${bestFriends} must be a valid Best Friends mode`
  );
}
for (const sortBy of safeSorts) {
  assert.equal(normalizeAdvancedState({ sortBy }).sortBy, sortBy, `${sortBy} must be valid`);
}

assert.deepEqual(
  normalizeAdvancedState({
    statuses: ["recently-online", "online", "online"],
    bestFriends: "maybe",
    sortBy: "followers",
    friendsWithUserId: "789",
    followsUserId: "999"
  }),
  { ...defaultState, statuses: ["online"] },
  "unsafe status values must be discarded and safe duplicates must collapse"
);
assert.equal(
  Object.prototype.hasOwnProperty.call(normalizeAdvancedState(null), "status"),
  false,
  "normalized state must expose statuses[] instead of the obsolete single status field"
);
assert.equal(
  Object.prototype.hasOwnProperty.call(normalizeAdvancedState(null), "followsUserId"),
  false,
  "Follows-specific-user must be removed from normalized state"
);
assert.equal(
  Object.prototype.hasOwnProperty.call(normalizeAdvancedState(null), "friendsWithUserId"),
  false,
  "the unsupported Mutual friends criterion must be removed from normalized state"
);

const applyAdvancedFilters = new Function(
  "FRIENDS_ADVANCED_STATUS_VALUES",
  "FRIENDS_ADVANCED_BEST_FRIENDS_VALUES",
  "FRIENDS_ADVANCED_SORT_VALUES",
  `${extractFunction("compareFriendsByAdvancedSort")};\n` +
    `${extractFunction("applyFriendsAdvancedFilters")};\n` +
    "return applyFriendsAdvancedFilters;"
)(safeStatuses, safeBestFriendsModes, safeSorts);

const friends = [
  {
    userId: "1",
    displayName: "Beta",
    username: "zed",
    presenceType: "InGame",
    universeId: "100",
    rootPlaceId: "101",
    isVerified: false,
    isVerifiedKnown: true,
    isRobloxPlus: false,
    isRobloxPlusKnown: true,
    isBestFriend: false,
    isBestFriendKnown: true,
    isFriendsWithTarget: true
  },
  {
    userId: "2",
    displayName: "Alpha",
    username: "mike",
    presenceType: "Online",
    universeId: null,
    rootPlaceId: null,
    isVerified: true,
    isVerifiedKnown: true,
    isRobloxPlus: true,
    isRobloxPlusKnown: true,
    isBestFriend: true,
    isBestFriendKnown: true,
    isFriendsWithTarget: true
  },
  {
    userId: "3",
    displayName: "alpha",
    username: "able",
    presenceType: "Offline",
    universeId: null,
    rootPlaceId: null,
    isVerified: false,
    isVerifiedKnown: true,
    isRobloxPlus: true,
    isRobloxPlusKnown: false,
    isBestFriend: false,
    isBestFriendKnown: true,
    isFriendsWithTarget: false
  },
  {
    userId: "4",
    displayName: "Gamma",
    username: "mike",
    presenceType: "InStudio",
    universeId: "200",
    rootPlaceId: "201",
    isVerified: true,
    isVerifiedKnown: true,
    isRobloxPlus: true,
    isRobloxPlusKnown: true,
    isBestFriend: true,
    isBestFriendKnown: true,
    isFriendsWithTarget: null
  },
  {
    userId: "5",
    displayName: "Delta",
    username: "nova",
    presenceType: "InGame",
    universeId: "300",
    rootPlaceId: "301",
    isVerified: true,
    isVerifiedKnown: true,
    isRobloxPlus: false,
    isRobloxPlusKnown: true,
    isBestFriend: false,
    isBestFriendKnown: true,
    isFriendsWithTarget: true
  }
];

for (const [statuses, expected] of [
  [[], ["1", "2", "3", "4", "5"]],
  ["in-experience", ["1", "5"]],
  ["online", ["2"]],
  ["offline", ["3"]],
  ["studio", ["4"]]
]) {
  const normalizedStatuses = Array.isArray(statuses) ? statuses : [statuses];
  assert.deepEqual(
    ids(applyAdvancedFilters(friends, { ...defaultState, statuses: normalizedStatuses })),
    expected,
    `statuses=${normalizedStatuses.join(",") || "any"} must use Roblox presence semantics`
  );
}

assert.deepEqual(
  ids(applyAdvancedFilters(friends, {
    ...defaultState,
    statuses: ["online", "in-experience"]
  })),
  ["1", "2", "5"],
  "multiple selected statuses must combine with OR"
);

assert.deepEqual(
  ids(applyAdvancedFilters(friends, { ...defaultState, gameUniverseId: "100" })),
  ["1"],
  "specific experience must match a stable Universe ID"
);
assert.deepEqual(
  ids(applyAdvancedFilters(friends, { ...defaultState, gameRootPlaceId: "301" })),
  ["5"],
  "specific experience may match the resolved root Place ID"
);
assert.deepEqual(
  ids(applyAdvancedFilters(friends, { ...defaultState, bestFriends: "only" })),
  ["2", "4"],
  "Best Friends Only must retain selected Best Friends"
);
assert.deepEqual(
  ids(applyAdvancedFilters(friends, { ...defaultState, bestFriends: "exclude" })),
  ["1", "3", "5"],
  "Best Friends Exclude must remove selected Best Friends"
);
assert.deepEqual(
  ids(applyAdvancedFilters(friends, { ...defaultState, verifiedOnly: true })),
  ["2", "4", "5"],
  "Verified must mean Roblox's public blue badge"
);

assert.deepEqual(
  ids(applyAdvancedFilters(friends, { ...defaultState, robloxPlusOnly: true })),
  ["2", "4"],
  "Roblox Plus must retain only friends whose public subscription value is known true"
);
assert.equal(
  applyAdvancedFilters(friends, { ...defaultState, robloxPlusOnly: true })
    .friends.some((friend) => friend.userId === "3"),
  false,
  "a stale true subscription value must not pass while Roblox Plus metadata is unknown"
);
assert.deepEqual(
  ids(
    applyAdvancedFilters(friends, { ...defaultState, robloxPlusOnly: true })
      .unknown
  ),
  ["3"],
  "unknown Roblox Plus metadata must remain distinguishable from a confirmed non-subscriber"
);

assert.deepEqual(
  ids(applyAdvancedFilters(friends, {
    ...defaultState,
    verifiedOnly: true,
    robloxPlusOnly: true,
    statuses: ["studio", "online"],
    bestFriends: "only",
    gameUniverseId: "200"
  })),
  ["4"],
  "Verified + Roblox Plus + status choices + Best Friends + experience must combine with AND"
);

for (const [sortBy, expected] of [
  ["default", ["1", "2", "3", "4", "5"]],
  ["display-name-asc", ["2", "3", "1", "5", "4"]],
  ["display-name-desc", ["4", "5", "1", "2", "3"]],
  ["username-asc", ["3", "2", "4", "5", "1"]],
  ["username-desc", ["1", "5", "2", "4", "3"]],
  ["in-experience-first", ["1", "5", "2", "3", "4"]],
  ["online-first", ["2", "1", "3", "4", "5"]],
  ["offline-first", ["3", "1", "2", "4", "5"]],
  ["best-friends-first", ["2", "4", "1", "3", "5"]],
  ["verified-first", ["2", "4", "5", "1", "3"]]
]) {
  assert.deepEqual(
    ids(applyAdvancedFilters(friends, { ...defaultState, sortBy })),
    expected,
    `${sortBy} must produce the documented stable order`
  );
}

const filterMenuSource = extractFunction("renderFriendsAdvancedFiltersMenu");
for (const visibleLabel of [
  />Verified</,
  />Status</,
  />In a specific experience</,
  />Best Friends</,
  />Sort</
]) {
  assert.match(filterMenuSource, visibleLabel, `menu must visibly include ${visibleLabel}`);
}
assert.match(
  filterMenuSource,
  /FRIENDS_ADVANCED_FILTER_DEFINITIONS\.robloxPlus\.label/,
  "the Roblox Plus checkbox must render its canonical visible label"
);
for (const marker of [
  "data-rsl-friends-filter-verified",
  "data-rsl-friends-filter-roblox-plus",
  "data-rsl-friends-filter-status",
  "data-rsl-friends-filter-game-input",
  "data-rsl-friends-filter-best-friends",
  "data-rsl-friends-filter-sort"
]) {
  assert.ok(filterMenuSource.includes(marker), `${marker} must be wired into the menu`);
}
assert.match(
  filterMenuSource,
  /data-rsl-friends-filter-game-input[^>]*placeholder=["']Experience name, link, Place ID, or Universe ID["']/,
  "the visible input must tell people that an experience name works"
);
assert.doesNotMatch(
  filterMenuSource,
  /<select[^>]*data-rsl-friends-filter-status/i,
  "Status must not be a single-select control"
);
assert.match(
  filterMenuSource,
  /type=["']checkbox["'][^>]*data-rsl-friends-filter-status|data-rsl-friends-filter-status[^>]*type=["']checkbox["']/i,
  "each status must be an independent compact checkbox/toggle"
);
assert.match(
  filterMenuSource,
  /FRIENDS_ADVANCED_FILTER_DEFINITIONS\.statuses\.map/,
  "all four status controls must be rendered from the canonical definition"
);
for (const forbidden of [
  /data-rsl-friends-filter-following-input/,
  /data-rsl-friends-filter-mutual-input/,
  /Mutual friends|Friends with|Has this user as a friend/i,
  />Follows</,
  /Most Followers/i,
  /Most Friends/i,
  /Most Following/i,
  /recent(?:ly)?[ -]online/i
]) {
  assert.doesNotMatch(filterMenuSource, forbidden, `${forbidden} must not appear in the active menu`);
}

assert.doesNotMatch(
  filterMenuSource,
  /foundation-web-dialog-overlay|bg-common-backdrop|>Cancel<|data-rsl-resolve-filter/,
  "Filters must remain a compact nonmodal window without an overlay, Cancel, or Find buttons"
);
assert.match(filterMenuSource, /className\s*=\s*["']rsl-friends-filters-popover["']/);
assert.match(filterMenuSource, /setAttribute\(["']aria-modal["']\s*,\s*["']false["']\)/);

const helpResetSource = extractFunction("resetFriendsAdvancedFiltersHelp");
assert.match(
  helpResetSource,
  /delete\s+wrap\.dataset\.rslHelpPinned/,
  "closing or reopening Filters must clear a pinned help tooltip"
);
assert.match(helpResetSource, /aria-expanded["']\s*,\s*["']false/);
assert.match(helpResetSource, /setAttribute\(["']hidden["']/);
assert.match(
  extractFunction("closeFriendsAdvancedFiltersMenu"),
  /resetFriendsAdvancedFiltersHelp\(dialog\)[\s\S]*dialog\.close\(\)/,
  "menu close must dismiss and unpin help before the dialog closes"
);
assert.match(
  extractFunction("openFriendsAdvancedFiltersMenu"),
  /resetFriendsAdvancedFiltersHelp\(dialog\)/,
  "a reused Filters dialog must always reopen with clean help state"
);
assert.match(filterMenuSource, /addEventListener\(["']pointerenter["']/);
assert.match(filterMenuSource, /addEventListener\(["']pointerleave["']/);
assert.match(
  filterMenuSource,
  /setTimeout\(closeIfTransient,\s*120\)/,
  "pointer exit must be briefly deferred so crossing the icon-to-tooltip gap cannot flicker"
);
assert.match(filterMenuSource, /wrap\?\.matches\(["']:hover["']\)/);
assert.match(filterMenuSource, /wrap\?\.contains\(document\.activeElement\)/);

const resolveAllSource = extractFunction("resolveAllFriendsAdvancedFilterTargets");
assert.match(resolveAllSource, /["']game["']/);
assert.doesNotMatch(
  resolveAllSource,
  /["'](?:friendsWith|follows)["']/,
  "Apply must resolve only the allowed experience target"
);

const draftFromMenuSource = extractFunction("getFriendsAdvancedDraftFromMenu");
for (const stateField of [
  "verifiedOnly",
  "robloxPlusOnly",
  "statuses",
  "bestFriends",
  "sortBy"
]) {
  assert.ok(draftFromMenuSource.includes(stateField), `${stateField} must be read on Apply`);
}
assert.match(
  draftFromMenuSource,
  /querySelectorAll\(["']\[data-rsl-friends-filter-status\]:checked["']\)/,
  "Apply must retain every checked status, not only the first one"
);
assert.doesNotMatch(draftFromMenuSource, /friendsWithUserId|followsUserId|following/i);

assert.match(
  filterMenuSource,
  /querySelectorAll\(["']\[data-rsl-friends-filter-status\]["']\)\.forEach/,
  "each status control must receive its own change behavior"
);
assert.match(
  filterMenuSource,
  /querySelector\(["']\[data-rsl-friends-filter-roblox-plus\]["']\)\?\.addEventListener\(["']change["']/,
  "the Roblox Plus checkbox must update the combinable draft state"
);
assert.match(
  filterMenuSource,
  /friendsAdvancedDraftState\.statuses\.includes\(input\.value\)/,
  "rerendering must restore every draft status selection"
);
assert.match(
  filterMenuSource,
  /friendsAdvancedDraftState\s*=\s*normalizeFriendsAdvancedFilterState\(null\)/,
  "Reset must clear all selected statuses through normalized default state"
);

const getAdvancedActiveCount = new Function(
  "FRIENDS_ADVANCED_STATUS_VALUES",
  "FRIENDS_ADVANCED_BEST_FRIENDS_VALUES",
  "FRIENDS_ADVANCED_SORT_VALUES",
  `${extractFunction("normalizeFriendsAdvancedFilterState")};\n` +
    `${extractFunction("getFriendsAdvancedActiveCount")};\n` +
    "return getFriendsAdvancedActiveCount;"
)(safeStatuses, safeBestFriendsModes, safeSorts);
assert.equal(
  getAdvancedActiveCount({
    ...defaultState,
    verifiedOnly: true,
    robloxPlusOnly: true,
    statuses: ["online", "in-experience", "online"],
    bestFriends: "only",
    gameUniverseId: "200"
  }),
  5,
  "active count must count Verified, Roblox Plus, the Status group, Best Friends, and experience once each"
);

const applyHandlerStart = filterMenuSource.indexOf(
  'querySelector("[data-rsl-friends-filters-apply]")'
);
assert.ok(applyHandlerStart >= 0, "Apply handler must exist");
const applyHandlerSource = filterMenuSource.slice(applyHandlerStart);
assert.match(applyHandlerSource, /resolveAllFriendsAdvancedFilterTargets/);
assert.match(
  applyHandlerSource,
  /activateFriendsPresenceFilter\(context,\s*ALL_FRIENDS_FILTER_VALUE\)/,
  "Apply must switch the custom Friends page base to the complete All list"
);
assert.doesNotMatch(
  applyHandlerSource,
  /if\s*\(context\s*&&\s*!activeFriendsPresenceFilter\)/,
  "Online, Offline, or Best Friends must not remain as a hidden pre-filter after Apply"
);
assert.doesNotMatch(
  applyHandlerSource,
  /loadFriendsAdvanced(?:Count|Following)Metadata|["'](?:counts|followers)["']/,
  "Apply must never start count or target-follower scans"
);

const metadataLoaderSource = extractFunction("loadFriendsAdvancedFilterMetadata");
assert.match(
  metadataLoaderSource,
  /state\.robloxPlusOnly/,
  "Roblox Plus must reuse the profile-detail enrichment decision made by Apply"
);
assert.match(metadataLoaderSource, /loadOnlineFriendDetails/);
assert.match(metadataLoaderSource, /loadOfflineFriendDetails/);
assert.doesNotMatch(
  metadataLoaderSource,
  /loadFriendsAdvanced(?:Count|Following|Friendship)Metadata|friendship|["'](?:counts|followers|resolve-user|friendship-batch)["']/i,
  "the Apply metadata pipeline must contain no friendship, count, or follower-list request path"
);
assert.doesNotMatch(
  metadataLoaderSource,
  /requestFriendsAdvancedFilterData\([\s\S]*?(?:roblox-plus|subscription)/i,
  "Roblox Plus must not introduce a separate advanced-filter metadata operation"
);

assert.doesNotMatch(
  definitionsSource,
  /friendsWith|Mutual friends|Friends with|Has this user as a friend/i,
  "unsupported friendship filtering must be removed from definitions"
);
for (const removedFriendshipSurface of [
  /friendsWithUserId/,
  /data-rsl-friends-filter-mutual-input/,
  /loadFriendsAdvancedFriendshipMetadata/,
  /["']friendship-batch["']/
]) {
  assert.doesNotMatch(
    source,
    removedFriendshipSurface,
    `${removedFriendshipSurface} must be absent after removing Mutual friends filtering`
  );
}

const mountSource = extractFunction("mountFriendsAdvancedFilters");
const existingButtonLookup = mountSource.indexOf(
  "context.group.querySelector(`[${FRIENDS_ADVANCED_FILTER_BUTTON_ATTRIBUTE}]`)"
);
const buttonClone = mountSource.indexOf("context.trustedButton.cloneNode(true)");
assert.ok(
  existingButtonLookup >= 0 && buttonClone > existingButtonLookup,
  "Friends remounts must reuse one Filters chip"
);
assert.match(mountSource, /aria-haspopup["']?\s*,\s*["']dialog/);
assert.match(mountSource, /openFriendsAdvancedFiltersMenu/);

const openMenuSource = extractFunction("openFriendsAdvancedFiltersMenu");
assert.doesNotMatch(openMenuSource, /showModal\(/);
assert.match(openMenuSource, /\.show\(\)/, "Filters must open nonmodally");
assert.match(
  openMenuSource,
  /friendsAdvancedDraftState\s*=\s*\{\s*\.\.\.friendsAdvancedAppliedState\s*\}/,
  "reopening must discard abandoned edits and restore applied state"
);

const positionedMenuFixture = {
  open: true,
  style: {},
  getBoundingClientRect: () => ({ width: 330, height: 300 })
};
const positionedTriggerFixture = {
  isConnected: true,
  getBoundingClientRect: () => ({ left: 900, top: 700, bottom: 740 })
};
const positionHarness = new Function(
  "document",
  "window",
  "FRIENDS_ADVANCED_FILTER_BUTTON_ATTRIBUTE",
  "FRIENDS_ADVANCED_FILTER_MENU_ATTRIBUTE",
  "closeFriendsAdvancedFiltersMenu",
  `${extractFunction("positionFriendsAdvancedFiltersMenu")}; return positionFriendsAdvancedFiltersMenu;`
)(
  {
    documentElement: { clientWidth: 1000, clientHeight: 800 },
    querySelector: () => positionedTriggerFixture
  },
  { innerWidth: 1000, innerHeight: 800 },
  "data-rsl-friends-filters-button",
  "data-rsl-friends-filters-menu",
  () => assert.fail("connected trigger must not close Filters")
);
positionHarness(positionedMenuFixture);
assert.equal(positionedMenuFixture.style.left, "662px");
assert.equal(positionedMenuFixture.style.top, "393px");

const menuBlockStart = styles.indexOf("[data-rsl-friends-filters-menu] {");
const menuBlockEnd = styles.indexOf("}", menuBlockStart);
assert.ok(menuBlockStart >= 0 && menuBlockEnd > menuBlockStart, "compact menu styles must exist");
const menuBlock = styles.slice(menuBlockStart, menuBlockEnd + 1);
assert.match(menuBlock, /position:\s*fixed\s*!important/);
assert.match(menuBlock, /width:\s*min\(330px/);
assert.doesNotMatch(
  menuBlock,
  /(?:^|[;\s])(?:inset(?:-(?:block|inline)(?:-(?:start|end))?)?|top|left)\s*:[^;}]*!important/i,
  "important offsets must not override the positioner's inline top/left"
);
assert.match(
  styles,
  /\[data-rsl-friends-filters-menu\]::backdrop\s*\{[\s\S]*?display:\s*none/,
  "Filters must not dim or block Roblox"
);
assert.match(
  styles,
  /\.rsl-friends-filters__help-copy\s*\{[\s\S]*?position:\s*fixed/,
  "help tooltips must escape the dialog body's scrolling overflow instead of being clipped"
);
assert.match(
  extractFunction("positionFriendsAdvancedFiltersHelpTooltips"),
  /viewportHeight[\s\S]*spaceAbove[\s\S]*spaceBelow[\s\S]*tooltip\.style\.left[\s\S]*tooltip\.style\.top/,
  "fixed help tooltips must be measured and clamped to the viewport"
);

const checkedStatusLabelRules = [...styles.matchAll(
  /[^{}]*\.rsl-friends-filters__status-options[^{}]*>\s*label:has\(\s*input:checked\s*\)[^{]*\{([^}]*)\}/gi
)];
for (const [, declarationBlock] of checkedStatusLabelRules) {
  assert.doesNotMatch(
    declarationBlock,
    /(?:^|;)\s*(?:background(?:-color)?|border(?:-color)?|color|box-shadow|filter)\s*:/i,
    "checking a status must not recolor or restyle the option tile"
  );
}
assert.match(
  styles,
  /\[data-rsl-friends-filter-status\]\s*\{[\s\S]*?accent-color\s*:/,
  "status selection must remain visible through the checkbox accent/checkmark"
);

const readmeFiltersStart = readme.indexOf("compact **Filters** button");
assert.ok(readmeFiltersStart >= 0, "README must document the Filters window");
const readmeFilters = readme.slice(readmeFiltersStart, readmeFiltersStart + 2_500);
for (const phrase of [
  "Verified",
  "Roblox Plus",
  "In Studio",
  "Best Friends",
  "experience name"
]) {
  assert.ok(readmeFilters.includes(phrase), `README Filters section must mention ${phrase}`);
}
assert.match(
  readmeFilters,
  /display name(?: or username)? A-Z\/Z-A/i,
  "README must document the safe local alphabetical sorts"
);
assert.match(
  readmeFilters,
  /In experience, Online, Offline, Best Friends, or Verified first/i,
  "README must document the safe local priority sorts"
);
assert.match(
  readmeFilters,
  /does not offer (?:social-count sorting|Most Followers)[\s\S]{0,160}(?:relationship-graph scans|Mutual friends|Friends with a specific user)[\s\S]{0,160}true Recently Online/i,
  "README must distinguish removed count, relationship-graph, and Recently Online filters"
);
assert.doesNotMatch(
  readmeFilters,
  /Filters can[\s\S]{0,500}(?:Most Followers|Most Friends|Most Following|Follows a specific user)/i,
  "README must not positively promise a removed unsafe filter"
);

console.log("PASS safe advanced Friends Filters state, UI, sorting, and request contract");
