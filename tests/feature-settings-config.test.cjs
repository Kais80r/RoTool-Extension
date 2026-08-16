"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const content = fs.readFileSync(path.join(root, "content.js"), "utf8");
const background = fs.readFileSync(path.join(root, "background.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");

assert.equal(manifest.version, "0.19.4");
assert.match(manifest.description, /Join Scheduler/i);
assert.ok(manifest.permissions.includes("storage"));

assert.match(content, /const FEATURE_SETTINGS_STORAGE_KEY = "rslFeatureSettingsV1"/);
assert.match(content, /const FEATURE_SETTINGS_VERSION = 1/);
for (const key of [
  "sidebarShortcuts",
  "sidebarGameEvents",
  "sidebarJoinScheduler",
  "sidebarServerHistory",
  "quickSettings",
  "quickSettingsOnlineStatus",
  "quickSettingsCurrentExperience",
  "quickSettingsInventory",
  "updatePopups",
  "bestFriends",
  "friendFilters",
  "quickPlay",
  "gameCcu",
  "gameEvents",
  "joinScheduler",
  "serverHistory",
  "copyRobloxIds"
]) {
  assert.match(content, new RegExp(`key: "${key}"`), `missing ${key} feature`);
}
assert.match(
  content,
  /FEATURE_SETTING_DEFINITIONS\.map\(\(\{ key, defaultEnabled \}\) =>\s*\[\s*key,\s*defaultEnabled !== false\s*\]\s*\)/,
  "feature defaults must be explicit so opt-in features do not silently become enabled"
);
assert.match(
  content,
  /key: "gameEvents"[\s\S]*?label: "Game Events"/,
  "Game Events must have its own independently configurable feature"
);
assert.match(
  content,
  /key: "sidebarGameEvents"[\s\S]*?label: "Game Events"/,
  "the independently remembered Game Events sidebar choice must default on"
);
assert.match(
  content,
  /key: "joinScheduler"[\s\S]*?label: "Join Scheduler"/,
  "Join Scheduler must have its own independently configurable feature"
);
assert.match(
  content,
  /key: "sidebarJoinScheduler"[\s\S]*?label: "Join Scheduler"/,
  "the independently remembered Join Scheduler sidebar choice must default on"
);
assert.match(
  content,
  /key: "serverHistory"[\s\S]*?defaultEnabled: false/,
  "Server History records activity and therefore must default off"
);
assert.match(
  content,
  /key: "sidebarServerHistory"[\s\S]*?label: "Server History"/,
  "the independently remembered Server History sidebar choice must default on"
);
assert.match(
  content,
  /key: "updatePopups"[\s\S]*?group: "Interface"[\s\S]*?label: "Update Popups"[\s\S]*?description: "Show update reminders at the top of Roblox\. Available updates still appear in RoTool Settings\."/,
  "the top-of-page reminder needs an exact, non-system-notification Settings label and scope"
);
const friendFiltersDefinitionIndex = content.indexOf('key: "friendFilters"');
const updatePopupsDefinitionIndex = content.indexOf('key: "updatePopups"');
const quickPlayDefinitionIndex = content.indexOf('key: "quickPlay"');
assert.ok(
  friendFiltersDefinitionIndex >= 0 &&
    updatePopupsDefinitionIndex > friendFiltersDefinitionIndex &&
    quickPlayDefinitionIndex > updatePopupsDefinitionIndex,
  "Update Popups must be the final Interface setting, directly before Experiences"
);
assert.match(
  content,
  /FEATURE_SETTING_DEFINITIONS\.map\(\(\{ key, defaultEnabled \}\) =>\s*\[\s*key,\s*defaultEnabled !== false\s*\]\s*\)/,
  "missing updatePopups flags must inherit the enabled default without a storage-schema migration"
);

assert.match(content, /header\.querySelector\("#navbar-settings"\)/);
assert.match(content, /button\.setAttribute\("aria-label", "RoTool Settings"\)/);
assert.match(content, /viewBox="-16 -4 128 128"/);
const logoFunctionSource = content.slice(
  content.indexOf("  function getRoToolLogoMarkup("),
  content.indexOf("  function findNativeHeaderSettingsItem(")
);
const getRoToolLogoMarkup = new Function(
  `${logoFunctionSource}\nreturn getRoToolLogoMarkup;`
)();
const navbarLogoMarkup = getRoToolLogoMarkup("rsl-navbar-settings-logo");
assert.match(
  navbarLogoMarkup,
  /<g class="rsl-rotool-logo-hover-outline"[^>]*stroke="#fff"[^>]*stroke-width="8"/
);
assert.equal(
  (navbarLogoMarkup.match(/<path /g) || []).length,
  4,
  "the hover outline and the normal logo must each contain both shapes"
);
assert.match(content, /nativeItem\.insertAdjacentElement\("afterend", item\)/);
assert.doesNotMatch(
  content,
  /button\.className\s*=\s*"btn-navigation-nav-settings-md/,
  "the RoTool button must not inherit Roblox's settings-popover behavior"
);
assert.match(content, /dialog\.id = FEATURE_SETTINGS_DIALOG_ID/);
assert.match(content, /input\.setAttribute\("role", "switch"\)/);
assert.match(content, /featureSettingsStorageSet\(savedSnapshot\)/);
assert.match(content, /featureSettingsSaveChain[\s\S]*?\.then\(\(\) => featureSettingsStorageSet\(savedSnapshot\)\)/);
assert.match(content, /chrome\.storage\.onChanged\.addListener/);
assert.match(
  content,
  /if \(featureSettingsPendingWrites > 0\) \{\s*featureSettingsDeferredStorageValue = nextSettings;[\s\S]*?scheduleFeatureSettingsReconcile\(\)/,
  "cross-tab settings must be deferred safely during a local write and reconciled afterward"
);
assert.match(content, /contentTestHooks\.setFeatureSettingsForTests/);
assert.match(content, /contentTestHooks\.saveFeatureSettingsForTests/);
assert.match(content, /contentTestHooks\.setBestFriendsHomeVisibility/);
assert.match(content, /contentTestHooks\.syncFeatureSettingsButtonGeometry/);

const requestUpdateWhenVisibleSource = content.slice(
  content.indexOf("  function requestExtensionUpdateStatusWhenVisible("),
  content.indexOf("  function isInsideRoToolDialog(")
);
assert.match(
  requestUpdateWhenVisibleSource,
  /document\.visibilityState !== "visible"[\s\S]*?!featureSettingsLoaded[\s\S]*?return;/,
  "automatic update requests must wait for the authoritative stored updatePopups value"
);
assert.match(
  content,
  /\.finally\(\(\) => \{\s*extensionUpdatePopupPreferenceApplied =\s*featureSettings\.updatePopups !== false;[\s\S]*?featureSettingsLoaded = true;[\s\S]*?featureSettingsApplied = \{ \.\.\.featureSettings \};[\s\S]*?requestExtensionUpdateStatusWhenVisible\(\);/,
  "startup must request update status only after feature settings become authoritative"
);

const updatePopupPreferenceSource = content.slice(
  content.indexOf("  function applyExtensionUpdatePopupPreferenceTransition("),
  content.indexOf("  function replaceExtensionUpdateStatusTimer(")
);
assert.match(updatePopupPreferenceSource, /const nextEnabled = nextSettings\?\.updatePopups !== false/);
assert.match(
  updatePopupPreferenceSource,
  /nextEnabled && !authoritativeEnable[\s\S]*?return false/,
  "a speculative local enable must wait for its storage write before claiming a cooldown"
);
assert.match(
  updatePopupPreferenceSource,
  /extensionUpdatePopupPreferenceApplied = nextEnabled[\s\S]*?invalidateExtensionUpdateFeedbackRequest\(\)[\s\S]*?clearExtensionUpdateStatusTimer\(\)[\s\S]*?removeExtensionUpdateFeedback\(\)[\s\S]*?refreshExtensionUpdateFeedback\(\)/,
  "an authoritative preference transition must invalidate stale work and reconcile only update surfaces"
);

const featureReconcileSource = content.slice(
  content.indexOf("  function reconcileFeatureSettings("),
  content.indexOf("  function queueMount(")
);
const updatePopupsReconcileSource = featureReconcileSource.slice(
  featureReconcileSource.indexOf("const updatePopupsChanged"),
  featureReconcileSource.indexOf("previousSettings.sidebarShortcuts")
);
assert.match(
  updatePopupsReconcileSource,
  /applyExtensionUpdatePopupPreferenceTransition\(nextSettings, \{[\s\S]*?authoritativeEnable: featureSettingsPendingWrites === 0/
);
assert.match(
  updatePopupsReconcileSource,
  /FEATURE_SETTING_DEFINITIONS\.every\([\s\S]*?key === "updatePopups"[\s\S]*?return;/,
  "an updatePopups-only change must stop before unrelated feature reconciliation"
);
assert.doesNotMatch(
  updatePopupsReconcileSource,
  /cleanupSidebarFeature|cleanupQuickSettingsHome|cleanupQuickPlayFeature|cleanupGameTileCcuFeature|mountExtensionFeatures/,
  "the popup switch must not remount or clean unrelated features"
);

const featureStorageChangeSource = content.slice(
  content.indexOf("    chrome.storage.onChanged.addListener("),
  content.indexOf("    const featureLoadGeneration")
);
assert.match(
  featureStorageChangeSource,
  /featureSettings = nextSettings;[\s\S]*?applyExtensionUpdatePopupPreferenceTransition\(nextSettings, \{\s*authoritativeEnable: true[\s\S]*?scheduleFeatureSettingsReconcile\(\)/,
  "a cross-tab switch-off must remove the banner immediately and then use targeted reconciliation"
);

assert.match(content, /if \(isFeatureEnabled\("sidebarShortcuts"\)\)/);
assert.match(content, /const presenceFiltersEnabled = isFeatureEnabled\("friendFilters"\)/);
assert.match(content, /const bestFriendsEnabled = isFeatureEnabled\("bestFriends"\)/);
assert.match(
  content,
  /const quickSettingsEnabled = getEnabledQuickSettingAliases\(\)\.length > 0/,
  "the Home card must depend on at least one enabled Quick Settings child"
);
assert.match(
  content,
  /key: "quickSettings"[\s\S]*?children: (?:Object\.freeze\()?\[[\s\S]*?key: "quickSettingsOnlineStatus"[\s\S]*?key: "quickSettingsCurrentExperience"[\s\S]*?key: "quickSettingsInventory"[\s\S]*?\]/,
  "Quick Settings Advanced must expose exactly the three privacy rows"
);
assert.match(content, /if \(isFeatureEnabled\("quickPlay"\)\)/);
assert.match(content, /if \(isFeatureEnabled\("gameCcu"\)\)/);
assert.match(content, /function cleanupSidebarFeature\(/);
assert.match(content, /function cleanupFriendsFiltersFeature\(/);
assert.match(content, /function cleanupQuickSettingsHome\(/);
assert.match(content, /function cleanupBestFriendsHome\(/);
assert.match(content, /function cleanupQuickPlayFeature\(/);
assert.match(content, /function cleanupGameTileCcuFeature\(/);
assert.match(
  content,
  /if \(previousSettings\.bestFriends !== nextSettings\.bestFriends\) \{\s*cleanupBestFriendsHome[\s\S]*?\}\s*const quickSettingsKeys = \[[\s\S]*?"quickSettingsOnlineStatus"[\s\S]*?"quickSettingsCurrentExperience"[\s\S]*?"quickSettingsInventory"[\s\S]*?const quickSettingsChanged = quickSettingsKeys\.some/,
  "Best Friends and Quick Settings must have independent cleanup lifecycles"
);
assert.match(
  content,
  /if \(previousSettings\.quickPlay !== nextSettings\.quickPlay\) \{\s*cleanupQuickPlayFeature\(\);\s*\}\s*if \(previousSettings\.gameCcu !== nextSettings\.gameCcu\) \{\s*cleanupGameTileCcuFeature\(\);\s*\}/,
  "Player Counts and Quick Play must have independent cleanup lifecycles"
);

assert.match(background, /const COPY_ROBLOX_IDS_FEATURE_KEY = "copyRobloxIds"/);
assert.match(background, /if \(!copyRobloxIdsEnabled\)/);
assert.match(background, /chrome\.storage\?\.onChanged\?\.addListener/);

assert.match(styles, /#rsl-navbar-settings/);
assert.match(styles, /background: transparent !important/);
assert.match(content, /class="rsl-rotool-logo-hover-outline"[^>]*stroke="#fff"[^>]*stroke-width="8"/);
assert.match(styles, /\.rsl-rotool-logo-hover-outline\s*\{[^}]*opacity:\s*0/s);
assert.match(
  styles,
  /\.rsl-navbar-settings-button:hover[\s\S]*?\.rsl-rotool-logo-hover-outline[\s\S]*?\{\s*opacity:\s*1;/
);
assert.doesNotMatch(styles, /drop-shadow\(/, "the navbar highlight must be a crisp SVG outline, not a glow");
assert.match(styles, /\.rsl-feature-settings-dialog__surface/);
assert.match(styles, /\.rsl-feature-settings__input:checked/);
assert.match(styles, /\.rsl-feature-settings__input:focus-visible/);

assert.match(readme, /button directly beside Roblox's Settings gear/);
assert.match(readme, /can each be enabled or disabled independently/);
assert.match(readme, /disabling a feature does not erase/);
assert.match(
  readme,
  /\*\*Update [Pp]opups\*\* starts on; turning it off hides only the top-of-page reminder while update checks and the Settings status continue\./,
  "documentation must preserve the distinction between the banner and update status"
);

console.log("PASS RoTool feature settings navigation, persistence, gates, and documentation");
