"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const contentSource = fs.readFileSync(path.join(projectRoot, "content.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(projectRoot, "styles.css"), "utf8");
const readme = fs.readFileSync(path.join(projectRoot, "README.md"), "utf8");

const sidebarSettings = [
  ["sidebarCustomShortcuts", "Custom Shortcuts"],
  ["sidebarHome", "Home"],
  ["sidebarProfile", "Profile"],
  ["sidebarRobloxPlus", "Roblox Plus"],
  ["sidebarMessages", "Messages"],
  ["sidebarFriends", "Friends"],
  ["sidebarAvatar", "Avatar"],
  ["sidebarInventory", "Inventory"],
  ["sidebarTrade", "Trade"],
  ["sidebarCommunities", "Communities"],
  ["sidebarBlog", "Blog"],
  ["sidebarOfficialStore", "Official Store"],
  ["sidebarGiftCards", "Buy Gift Cards"]
];
for (const setting of [
  ...sidebarSettings,
  ["quickPlayActionPlay", "Quick Play"],
  ["quickPlayActionPrivate", "Private Servers"],
  ["quickPlayActionRandom", "Random Server"],
  ["gameCcuHoverGraph", "CCU Hover Graph"]
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
  /key: "sidebarShortcuts"[\s\S]*?label: "Sidebar Customization"[\s\S]*?children: (?:Object\.freeze\()?\[[\s\S]*?key: "sidebarCustomShortcuts"[\s\S]*?key: "sidebarHome"[\s\S]*?key: "sidebarProfile"[\s\S]*?key: "sidebarRobloxPlus"[\s\S]*?key: "sidebarMessages"[\s\S]*?key: "sidebarFriends"[\s\S]*?key: "sidebarAvatar"[\s\S]*?key: "sidebarInventory"[\s\S]*?key: "sidebarTrade"[\s\S]*?key: "sidebarCommunities"[\s\S]*?key: "sidebarBlog"[\s\S]*?key: "sidebarOfficialStore"[\s\S]*?key: "sidebarGiftCards"[\s\S]*?\]/,
  "every visible sidebar item must have a nested individual setting"
);
assert.match(
  contentSource,
  /key: "quickPlay"[\s\S]*?children: (?:Object\.freeze\()?\[[\s\S]*?key: "quickPlayActionPlay"[\s\S]*?key: "quickPlayActionPrivate"[\s\S]*?key: "quickPlayActionRandom"[\s\S]*?\]/,
  "per-button controls must be nested beneath Quick Play & Servers"
);
assert.match(
  contentSource,
  /key: "gameCcu"[\s\S]*?label: "Player Counts \(CCU\)"[\s\S]*?\}\),\s*Object\.freeze\(\{\s*key: "gameCcuHoverGraph"[\s\S]*?label: "CCU Hover Graph"/,
  "the hover graph must be its own top-level Experiences setting"
);
const playerCountsDefinition = contentSource.slice(
  contentSource.indexOf('      key: "gameCcu"'),
  contentSource.indexOf('      key: "gameCcuHoverGraph"')
);
assert.doesNotMatch(
  playerCountsDefinition,
  /children\s*:/,
  "CCU Hover Graph must not be disabled or visually nested beneath Player Counts"
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
assert.match(contentSource, /data-rsl-feature-bulk/);
assert.match(contentSource, /data-rsl-feature-bulk-parent/);
assert.match(contentSource, /\["enable", "Show all", true\]/);
assert.match(contentSource, /\["disable", "Hide all", false\]/);
assert.match(contentSource, /toolbarLabel\.textContent = "Sidebar items"/);
assert.match(contentSource, /sectionHeading\.textContent = currentSection/);
assert.match(contentSource, /section: "RoTool"/);
assert.match(contentSource, /section: "Roblox"/);
assert.doesNotMatch(contentSource, /sidebarThemes|section: "Other extensions"/);
const bulkHandlerSource = contentSource.slice(
  contentSource.indexOf('if (definition.key === "sidebarShortcuts")'),
  contentSource.indexOf("let currentSection", contentSource.indexOf('if (definition.key === "sidebarShortcuts")'))
);
assert.match(bulkHandlerSource, /definition\.children\.forEach\(\(child\) => \{\s*next\[child\.key\] = enabled/);
assert.equal(
  (bulkHandlerSource.match(/saveFeatureSettings\(/g) || []).length,
  1,
  "Show all / Hide all must compose one persisted settings write"
);
assert.doesNotMatch(
  bulkHandlerSource,
  /mountExtensionFeatures\(/,
  "a sidebar bulk action must not trigger a full feature remount"
);
assert.match(bulkHandlerSource, /void saveFeatureSettings\(next, previous\)/);
assert.doesNotMatch(
  bulkHandlerSource,
  /reconcileFeatureSettings\(/,
  "bulk choices should use the one optimistic reconcile inside saveFeatureSettings"
);
const saveFeatureSettingsSource = contentSource.slice(
  contentSource.indexOf("async function saveFeatureSettings("),
  contentSource.indexOf("function createFeatureSettingsDialog(")
);
assert.ok(
  saveFeatureSettingsSource.indexOf("reconcileFeatureSettings(fallbackSettings, featureSettings)") <
    saveFeatureSettingsSource.indexOf("featureSettingsStorageSet(savedSnapshot)"),
  "settings must reconcile visibly before the deferred storage write"
);
assert.ok(
  saveFeatureSettingsSource.indexOf("renderFeatureSettingsDialog()") <
    saveFeatureSettingsSource.indexOf("featureSettingsStorageSet(savedSnapshot)"),
  "switches must render their optimistic state before storage finishes"
);
assert.match(
  contentSource,
  /querySelectorAll\("\[data-rsl-feature-bulk\]"\)[\s\S]*?data-rsl-feature-bulk-parent[\s\S]*?button\.disabled[\s\S]*?!isFeatureEnabled\(parentKey\)/,
  "bulk actions must clearly disable with their parent"
);

const childPanelCssStart = stylesSource.indexOf(".rsl-feature-settings__children {");
const childPanelCssEnd = stylesSource.indexOf("\n}", childPanelCssStart) + 2;
const childPanelCss = stylesSource.slice(childPanelCssStart, childPanelCssEnd);
assert.doesNotMatch(childPanelCss, /box-shadow|inset|#335fff|action-emphasis/);
const childPanelBackground = childPanelCss.match(/background\s*:\s*([^;]+);/)?.[1]?.trim();
assert.ok(
  !childPanelBackground || childPanelBackground === "transparent",
  "the long child list should stay flush instead of becoming a heavy inset card"
);
assert.match(stylesSource, /\.rsl-feature-settings__children \.rsl-feature-settings__row--child\s*\{[\s\S]*?min-height:\s*(?:4[4-9]|[5-9]\d)px/);
assert.match(stylesSource, /\.rsl-feature-settings__children \.rsl-feature-settings__copy > span\s*\{[\s\S]*?position:\s*absolute[\s\S]*?clip:/);
assert.match(stylesSource, /@media \(min-width: 620px\)[\s\S]*?data-rsl-feature-children="sidebarShortcuts"[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(contentSource, /data-rsl-feature-section-index/);
assert.match(contentSource, /data-rsl-feature-section-column/);
assert.match(stylesSource, /data-rsl-feature-section-column="right"[\s\S]*?border-left/);
assert.match(stylesSource, /@media \(max-width: 520px\)[\s\S]*?\.rsl-feature-settings__children/);

assert.match(contentSource, /const NATIVE_SIDEBAR_HIDDEN_ATTRIBUTE = "data-rsl-native-sidebar-hidden"/);
assert.match(contentSource, /function syncNativeSidebarVisibility\(/);
assert.match(contentSource, /function cleanupNativeSidebarVisibility\(/);
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
assert.match(nativeVisibilitySource, /link === directLink/);
assert.match(nativeVisibilitySource, /isRedesignedStandardLink/);
assert.match(nativeVisibilitySource, /hostname === "roblox\.com" \|\| hostname\.endsWith\("\.roblox\.com"\)/);
assert.match(nativeVisibilitySource, /giftcards[\s\S]*?\[a-z\]\{2\}[\s\S]*?icon-regular-gift-card/);
assert.match(nativeVisibilitySource, /row\.matches\?\.\("li\[data-ropro-sidebar-item\]"\)/);
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
assert.match(readme, /marked rather than removed|hide[^.]*rather than remov/i);

console.log(
  "PASS RoTool advanced settings disclosure, native sidebar visibility, and per-action Quick Play configuration"
);
