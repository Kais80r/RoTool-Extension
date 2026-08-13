"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const contentSource = fs.readFileSync(path.join(projectRoot, "content.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(projectRoot, "styles.css"), "utf8");
const readme = fs.readFileSync(path.join(projectRoot, "README.md"), "utf8");

for (const setting of [
  ["sidebarCustomShortcuts", "Custom Shortcuts"],
  ["sidebarGiftCards", "Buy Gift Cards"],
  ["sidebarOfficialStore", "Official Store"],
  ["quickPlayActionPlay", "Quick Play"],
  ["quickPlayActionPrivate", "Private Servers"],
  ["quickPlayActionRandom", "Random Server"]
]) {
  const [key, label] = setting;
  assert.match(
    contentSource,
    new RegExp(`key: "${key}"[\\s\\S]*?label: "${label}"`),
    `missing advanced setting ${key}`
  );
}

assert.match(
  contentSource,
  /key: "sidebarShortcuts"[\s\S]*?label: "Sidebar Customization"[\s\S]*?children: (?:Object\.freeze\()?\[[\s\S]*?key: "sidebarCustomShortcuts"[\s\S]*?key: "sidebarGiftCards"[\s\S]*?key: "sidebarOfficialStore"[\s\S]*?\]/,
  "native sidebar visibility controls must be nested beneath Sidebar Shortcuts"
);
assert.match(
  contentSource,
  /key: "quickPlay"[\s\S]*?children: (?:Object\.freeze\()?\[[\s\S]*?key: "quickPlayActionPlay"[\s\S]*?key: "quickPlayActionPrivate"[\s\S]*?key: "quickPlayActionRandom"[\s\S]*?\]/,
  "per-button controls must be nested beneath Quick Play & Servers"
);
assert.match(contentSource, /const FEATURE_SETTING_DEFINITIONS = Object\.freeze\(/);
assert.match(contentSource, /FEATURE_DEFINITIONS\.flatMap/);
assert.match(
  contentSource,
  /Object\.fromEntries\(\s*FEATURE_SETTING_DEFINITIONS\.map\(\(\{ key \}\) => \[key, true\]\)\s*\)/,
  "new advanced controls must preserve the existing default-on behavior"
);
assert.match(
  contentSource,
  /for \(const \{ key \} of FEATURE_SETTING_DEFINITIONS\)/,
  "normalization must retain advanced flags"
);
assert.match(
  contentSource,
  /FEATURE_SETTING_DEFINITIONS\.every\(\(\{ key \}\) => left\?\.\[key\] === right\?\.\[key\]\)/,
  "equality must include advanced flags so Reset defaults stays accurate"
);
assert.match(
  contentSource,
  /FEATURE_SETTING_DEFINITIONS\.map\(\(\{ key \}\) => \[key, flags\[key\] !== false\]\)/,
  "serialization must persist every advanced flag"
);
assert.match(contentSource, /const FEATURE_SETTINGS_STORAGE_KEY = "rslFeatureSettingsV1"/);
assert.match(contentSource, /const FEATURE_SETTINGS_VERSION = 1/);

assert.match(contentSource, /data-rsl-feature-disclosure/);
assert.match(contentSource, /data-rsl-feature-children/);
assert.match(contentSource, /disclosure\.setAttribute\("aria-expanded", "false"\)/);
assert.match(contentSource, /disclosure\.setAttribute\("aria-controls", childrenId\)/);
assert.match(
  contentSource,
  /disclosure\.setAttribute\(\s*"aria-label",\s*`Advanced settings for \$\{definition\.label\}`\s*\)/,
  "each Advanced disclosure needs its parent feature in the accessible name"
);
assert.match(contentSource, /children\.hidden = true/);
assert.match(
  contentSource,
  /disclosure\.addEventListener\("click",[\s\S]*?aria-expanded[\s\S]*?children\.hidden/,
  "the advanced section must be an accessible, operable disclosure"
);
assert.match(
  contentSource,
  /input\.disabled =[\s\S]*?Boolean\(parentKey && !isFeatureEnabled\(parentKey\)\)/,
  "turning off a master feature must disable, but not erase, its child choices"
);
assert.match(stylesSource, /\.rsl-feature-settings__disclosure/);
assert.match(stylesSource, /\.rsl-feature-settings__children/);
assert.match(stylesSource, /\.rsl-feature-settings__children\[hidden\]/);

assert.match(contentSource, /const NATIVE_SIDEBAR_HIDDEN_ATTRIBUTE = "data-rsl-native-sidebar-hidden"/);
assert.match(contentSource, /function syncNativeSidebarVisibility\(/);
assert.match(contentSource, /function cleanupNativeSidebarVisibility\(/);
assert.match(contentSource, /\^\\\/giftcards\(\?:\[-\\\/\]\|\$\)/);
assert.match(contentSource, /icon-regular-gift-card/);
assert.match(contentSource, /icon-regular-building-store/);
assert.match(contentSource, /#nav-giftcards/);
assert.match(contentSource, /#nav-shop/);
assert.match(
  contentSource,
  /row\.setAttribute\(NATIVE_SIDEBAR_HIDDEN_ATTRIBUTE, key\)/,
  "native rows must be hidden with a reversible RoTool-owned marker"
);
assert.match(
  contentSource,
  /removeAttribute\(NATIVE_SIDEBAR_HIDDEN_ATTRIBUTE\)/,
  "re-enabling an item must restore the original native row"
);
assert.match(
  stylesSource,
  /#left-navigation-container[\s\S]*?\[data-rsl-native-sidebar-hidden\][\s\S]*?\.left-col-list[\s\S]*?\[data-rsl-native-sidebar-hidden\][\s\S]*?display: none !important;/,
  "the hiding rule must be limited to Roblox's sidebar lists"
);
const nativeVisibilitySource = contentSource.slice(
  contentSource.indexOf("function getNativeSidebarSemanticKey("),
  contentSource.indexOf("function normalizeBestFriendIds(")
);
assert.doesNotMatch(
  nativeVisibilitySource,
  /textContent|innerText|Buy Gift Cards|Official Store/,
  "localized native items must not be identified by English display text"
);
const cleanCloneSource = contentSource.slice(
  contentSource.indexOf("function cleanClone("),
  contentSource.indexOf("function findLabel(")
);
assert.match(
  cleanCloneSource,
  /for \(const element of \[row, \.\.\.row\.querySelectorAll\("\*"\)\]\)[\s\S]*?element\.removeAttribute\(NATIVE_SIDEBAR_HIDDEN_ATTRIBUTE\)/,
  "a hidden native template and its descendants must not leak the marker into cloned RoTool rows"
);
assert.doesNotMatch(
  nativeVisibilitySource,
  /\.remove\(\)|removeChild|replaceWith/,
  "native rows must never be removed or replaced"
);

assert.match(contentSource, /function isQuickPlayActionEnabled\(/);
assert.match(contentSource, /isQuickPlayActionEnabled\("play"\)/);
assert.match(contentSource, /isQuickPlayActionEnabled\("private"\)/);
assert.match(contentSource, /isQuickPlayActionEnabled\("random"\)/);
assert.match(
  contentSource,
  /if \(!showPlay && !showPrivate && !showRandom\) \{\s*return null;\s*\}/,
  "all three disabled actions must not leave an empty hover surface"
);
assert.match(
  contentSource,
  /if \(showPrivate\)[\s\S]*?observePrivateServerSupport/,
  "private-server capability requests must only be attached when that action is enabled"
);
for (const functionName of [
  "activatePrivateServerSupport",
  "observePrivateServerSupport"
]) {
  const functionStart = contentSource.indexOf(`function ${functionName}(`);
  const nextFunction = contentSource.indexOf("\n  function ", functionStart + 12);
  const functionSource = contentSource.slice(functionStart, nextFunction);
  assert.match(
    functionSource,
    /isQuickPlayActionEnabled\("private"\)/,
    `${functionName} needs its own Private Servers child-setting guard`
  );
}
assert.match(
  stylesSource,
  /\.rsl-private-server-button:not\(\[hidden\]\)/,
  "supported Private Servers must render in one- and two-action layouts too"
);
assert.match(
  contentSource,
  /surface\.dataset\.rslQuickPlayPlaceId = placeId/,
  "the surface must retain its identity when the Play action is disabled"
);
const supportIdentitySource = contentSource.slice(
  contentSource.indexOf("function getPrivateServerSupportSurfacePlaceId("),
  contentSource.indexOf("function getPrivateServerSupportSurfaces(")
);
assert.match(
  supportIdentitySource,
  /rslQuickPlayPlaceId/,
  "Private Servers-only mode must not depend on the Play button for its Place ID"
);
assert.match(
  contentSource,
  /previousSettings\.quickPlayActionPlay !== nextSettings\.quickPlayActionPlay[\s\S]*?previousSettings\.quickPlayActionPrivate !== nextSettings\.quickPlayActionPrivate[\s\S]*?previousSettings\.quickPlayActionRandom !== nextSettings\.quickPlayActionRandom/,
  "changing any Quick Play child setting must remount existing cards"
);
const cancelQueuedSupportSource = contentSource.slice(
  contentSource.indexOf("function cancelQueuedPrivateServerSupportRequests("),
  contentSource.indexOf("function getPrivateServerSupportSurfacePlaceId(")
);
assert.match(cancelQueuedSupportSource, /privateServerSupportRequestQueue\.splice\(0\)/);
assert.match(cancelQueuedSupportSource, /task\.reject\(error\)/);
assert.match(cancelQueuedSupportSource, /error\.code = "CANCELLED"/);
const quickPlayCleanupSource = contentSource.slice(
  contentSource.indexOf("function cleanupQuickPlayFeature("),
  contentSource.indexOf("function getRoToolLogoMarkup(")
);
assert.match(quickPlayCleanupSource, /cancelQueuedPrivateServerSupportRequests\(\)/);
assert.doesNotMatch(
  quickPlayCleanupSource,
  /privateServerSupportRequestQueue\.length = 0/,
  "cleanup must reject queued promises instead of silently orphaning them"
);
const requestPrivateSupportSource = contentSource.slice(
  contentSource.indexOf("function requestPrivateServerSupport("),
  contentSource.indexOf("function loadPrivateServerSupportForSurface(")
);
assert.match(
  requestPrivateSupportSource,
  /\.finally\(\(\) => \{[\s\S]*?privateServerSupportRequestsByPlaceId\.get\(placeId\) === request[\s\S]*?privateServerSupportRequestsByPlaceId\.delete\(placeId\)/,
  "cancelled or completed support promises must leave the per-Place request map"
);
const quickPlayResultSource = contentSource.slice(
  contentSource.indexOf("function handleQuickPlayResult("),
  contentSource.indexOf("function dispatchRandomServerResponse(")
);
assert.match(quickPlayResultSource, /const action = button\.getAttribute\(QUICK_PLAY_ACTION_ATTRIBUTE\)/);
assert.match(
  quickPlayResultSource,
  /const action =[\s\S]*?if \(\s*!isQuickPlayActionEnabled\(action\)[\s\S]*?clearQuickPlayFeedback\(button\)/,
  "stale or forged page results must pass the specific child-action guard before changing UI state"
);
const randomServerRequestSource = contentSource.slice(
  contentSource.indexOf("function handleRandomServerRequest("),
  contentSource.indexOf("function sendPrivateServerRuntimeMessage(")
);
assert.match(
  randomServerRequestSource,
  /function handleRandomServerRequest\(event\) \{\s*if \(!isQuickPlayActionEnabled\("random"\)\) \{\s*return;\s*\}/,
  "Random Server page events need an early child-setting guard"
);
assert.ok(
  randomServerRequestSource.indexOf('isQuickPlayActionEnabled("random")') <
    randomServerRequestSource.indexOf("chrome.runtime.sendMessage("),
  "the Random Server child guard must precede privileged runtime messaging"
);

assert.match(readme, /Buy Gift Cards/);
assert.match(readme, /Official Store/);
assert.match(readme, /Quick Play[\s\S]*Private Servers[\s\S]*Random Server/);
assert.match(readme, /hidden rather than removed|hide[^.]*rather than remov/i);

console.log(
  "PASS RoTool advanced settings disclosure, native sidebar visibility, and per-action Quick Play configuration"
);
