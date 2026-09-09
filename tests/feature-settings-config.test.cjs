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

assert.equal(manifest.version, "0.19.10");
assert.match(manifest.description, /Enhanced Profiles/i);
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
  "enhancedProfiles",
  "quickPlay",
  "gameCcu",
  "recoverySnapshots",
  "recoverySnapshotMenu",
  "recoverySnapshotArchive",
  "recoverySnapshotReminder",
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
  /key: "recoverySnapshots"[\s\S]*?label: "Recovery Snapshots"[\s\S]*?advancedControls:[\s\S]*?type: "feature"[\s\S]*?key: "recoverySnapshotMenu"[\s\S]*?type: "feature"[\s\S]*?key: "recoverySnapshotArchive"[\s\S]*?type: "feature"[\s\S]*?key: "recoverySnapshotReminder"[\s\S]*?type: "archiveSelect"[\s\S]*?key: "frequency"[\s\S]*?type: "archiveSelect"[\s\S]*?key: "retention"[\s\S]*?label: "Information to capture automatically"[\s\S]*?dynamicSummary: "recoverySnapshotSections"[\s\S]*?ACCOUNT_RECOVERY_ARCHIVE_SECTION_DEFINITIONS\.map[\s\S]*?key: "openRecoverySnapshot"[\s\S]*?key: "openRecoverySnapshotArchive"[\s\S]*?label: "View saved snapshots"[\s\S]*?actionLabel: "Open"[\s\S]*?children:[\s\S]*?key: "recoverySnapshotMenu"[\s\S]*?key: "recoverySnapshotArchive"[\s\S]*?defaultEnabled: false[\s\S]*?key: "recoverySnapshotReminder"/,
  "Recovery Snapshots Advanced must own the Settings-menu shortcut, automatic capture, reminder, schedule, retention, privacy choices, and account tools"
);
const recoveryDefinitionStart = content.indexOf('key: "recoverySnapshots"');
const recoveryDefinitionEnd = content.indexOf(
  'key: "gameEvents"',
  recoveryDefinitionStart
);
const recoveryDefinitionSource = content.slice(
  recoveryDefinitionStart,
  recoveryDefinitionEnd
);
assert.doesNotMatch(
  recoveryDefinitionSource,
  /independentOfParent:\s*true/,
  "the Recovery master switch must gate its shortcut, automatic capture, and reminder"
);
assert.equal(
  (recoveryDefinitionSource.match(/availableWhenDisabled:\s*true/g) || []).length,
  2,
  "the current-snapshot and saved-snapshot actions must remain available when Recovery automation is off"
);
const recoveryReminderLabelIndex = content.indexOf(
  'label: "Automatic snapshot reminders"'
);
assert.ok(
  recoveryReminderLabelIndex >= 0,
  "Recovery Snapshots Advanced must expose Automatic snapshot reminders"
);
const recoveryReminderDefinitionSource = content.slice(
  content.lastIndexOf("Object.freeze({", recoveryReminderLabelIndex),
  content.indexOf("})", recoveryReminderLabelIndex) + 2
);
assert.match(
  recoveryReminderDefinitionSource,
  /key: "recoverySnapshotReminder"[\s\S]*?label: "Automatic snapshot reminders"[\s\S]*?description:\s*"Show a Home reminder every 3 hours while Automatic snapshots are off\."/,
  "the reminder switch must state its exact three-hour Home scope"
);
assert.doesNotMatch(
  recoveryReminderDefinitionSource,
  /defaultEnabled: false/,
  "Automatic snapshot reminders must default on"
);
assert.match(
  content,
  /function reviewAutomaticSnapshotSettings\(dialog\)[\s\S]*?setFeatureSettingsDisclosureExpanded\(disclosure, children, true\)[\s\S]*?automaticSwitch\.focus\(\{ preventScroll: true \}\)/,
  "the review helper must reveal and focus the real Automatic snapshots switch"
);
assert.match(
  content,
  /contentTestHooks\.reviewAutomaticSnapshotSettings\s*=\s*reviewAutomaticSnapshotSettings/,
  "the browser fixture must be able to exercise the Automatic snapshots scroll/focus review path"
);
assert.match(content, /const ACCOUNT_RECOVERY_ARCHIVE_PREFERENCES_VERSION = 2/);
assert.match(
  content,
  /const DEFAULT_ACCOUNT_RECOVERY_ARCHIVE_PREFERENCES[\s\S]*?frequency: "daily"[\s\S]*?retention: 5[\s\S]*?sections: Object\.freeze\(\[\.\.\.ACCOUNT_RECOVERY_ARCHIVE_SECTION_KEYS\]\)/,
  "fresh automatic-capture preferences must include every supported section"
);
const recoverySectionsSource = content.slice(
  content.indexOf("  const ACCOUNT_RECOVERY_ARCHIVE_SECTION_DEFINITIONS"),
  content.indexOf("  const ACCOUNT_RECOVERY_ARCHIVE_SECTION_KEYS")
);
assert.doesNotMatch(
  recoverySectionsSource,
  /defaultEnabled: false/,
  "Recently played must no longer be silently excluded from fresh automatic captures"
);
assert.match(content, /rsl:get-account-recovery-archive-preferences/);
assert.match(content, /rsl:set-account-recovery-archive-preferences/);
assert.doesNotMatch(
  content,
  /key: "recoverySnapshotArchive",\s*group: "Tools"/,
  "Automatic snapshots must not appear as a duplicate top-level Tools row"
);
assert.match(
  content,
  /key: "sidebarServerHistory"[\s\S]*?label: "Server History"/,
  "the independently remembered Server History sidebar choice must default on"
);
assert.match(
  content,
  /key: "updatePopups"[\s\S]*?group: "Interface"[\s\S]*?label: "RoTool Update Popups"[\s\S]*?description:[\s\S]*?"Show RoTool update reminders at the top of Home\. Updates still appear in RoTool Settings\."[\s\S]*?type: "select"[\s\S]*?key: "updateReminderFrequency"[\s\S]*?label: "Reminder frequency"/,
  "the top-of-page reminder needs an exact, non-system-notification Settings label and scope"
);
const friendFiltersDefinitionIndex = content.indexOf('key: "friendFilters"');
const enhancedProfilesDefinitionIndex = content.indexOf('key: "enhancedProfiles"');
const updatePopupsDefinitionIndex = content.indexOf('key: "updatePopups"');
const quickPlayDefinitionIndex = content.indexOf('key: "quickPlay"');
assert.ok(
  friendFiltersDefinitionIndex >= 0 &&
    enhancedProfilesDefinitionIndex > friendFiltersDefinitionIndex &&
    updatePopupsDefinitionIndex > enhancedProfilesDefinitionIndex &&
    quickPlayDefinitionIndex > updatePopupsDefinitionIndex,
  "Interface settings must order Friend Lists & Filters, Enhanced Profiles, and RoTool Update Popups directly before Experiences"
);
assert.match(
  content,
  /FEATURE_SETTING_DEFINITIONS\.map\(\(\{ key, defaultEnabled \}\) =>\s*\[\s*key,\s*defaultEnabled !== false\s*\]\s*\)/,
  "missing updatePopups flags must inherit the enabled default without a storage-schema migration"
);

assert.match(content, /header\.querySelector\("#navbar-settings"\)/);
assert.match(content, /button\.setAttribute\("aria-label", "RoTool Settings"\)/);
assert.match(
  content,
  /const FEATURE_SETTINGS_SHOW_MESSAGE_TYPE = "rsl:show-feature-settings"/,
  "the toolbar entry point needs one explicit feature-settings message type"
);
const showFeatureSettingsHandlerSource = content.slice(
  content.indexOf("  function handleShowFeatureSettingsMessage("),
  content.indexOf("  function normalizeGameEventId(")
);
assert.match(showFeatureSettingsHandlerSource, /messageKeys\.length !== 1/);
assert.match(showFeatureSettingsHandlerSource, /messageKeys\[0\] !== "type"/);
assert.match(showFeatureSettingsHandlerSource, /sender\?\.id === chrome\.runtime\.id/);
assert.match(showFeatureSettingsHandlerSource, /!sender\?\.tab/);
assert.match(showFeatureSettingsHandlerSource, /window\.top === window/);
assert.match(showFeatureSettingsHandlerSource, /document\.visibilityState === "visible"/);
assert.match(showFeatureSettingsHandlerSource, /openFeatureSettingsDialog\(opener\)/);
assert.match(
  showFeatureSettingsHandlerSource,
  /sendResponse\?\.\(\{\s*ok: true,\s*type: FEATURE_SETTINGS_SHOW_MESSAGE_TYPE\s*\}\)/,
  "the content response must exactly match the background launcher's typed acknowledgement"
);
assert.match(
  content,
  /chrome\.runtime\.onMessage\?\.addListener\(handleShowFeatureSettingsMessage\)/,
  "the strict feature-settings runtime handler must be registered"
);
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
  /extensionUpdatePopupPreferenceApplied = nextEnabled[\s\S]*?invalidateExtensionUpdateFeedbackRequest\(\)[\s\S]*?clearExtensionUpdateStatusTimer\(\)[\s\S]*?removeExtensionUpdateFeedback\(\)[\s\S]*?requestExtensionUpdateStatusWhenVisible\(true\)/,
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
  /\*\*RoTool Update Popups\*\* starts on[\s\S]*?Turning the parent switch off hides only the Home banner\. RoTool Settings continues to show a known update on any Roblox page without consuming a reminder/,
  "documentation must preserve the distinction between the banner and update status"
);

console.log("PASS RoTool feature settings navigation, persistence, gates, and documentation");
