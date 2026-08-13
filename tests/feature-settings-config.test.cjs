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

assert.equal(manifest.version, "0.16.34");
assert.match(manifest.description, /configurable/);
assert.ok(manifest.permissions.includes("storage"));

assert.match(content, /const FEATURE_SETTINGS_STORAGE_KEY = "rslFeatureSettingsV1"/);
assert.match(content, /const FEATURE_SETTINGS_VERSION = 1/);
for (const key of [
  "sidebarShortcuts",
  "quickSettings",
  "bestFriends",
  "friendFilters",
  "quickPlay",
  "gameCcu",
  "copyRobloxIds"
]) {
  assert.match(content, new RegExp(`key: "${key}"`), `missing ${key} feature`);
}
assert.match(
  content,
  /Object\.fromEntries\(\s*FEATURE_SETTING_DEFINITIONS\.map\(\(\{ key \}\) => \[key, true\]\)\s*\)/,
  "every newly introduced feature must default to enabled"
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
assert.match(content, /await featureSettingsStorageSet\(featureSettings\)/);
assert.match(content, /chrome\.storage\.onChanged\.addListener/);
assert.match(content, /contentTestHooks\.setFeatureSettingsForTests/);
assert.match(content, /contentTestHooks\.saveFeatureSettingsForTests/);
assert.match(content, /contentTestHooks\.setBestFriendsHomeVisibility/);
assert.match(content, /contentTestHooks\.syncFeatureSettingsButtonGeometry/);

assert.match(content, /if \(isFeatureEnabled\("sidebarShortcuts"\)\)/);
assert.match(content, /const presenceFiltersEnabled = isFeatureEnabled\("friendFilters"\)/);
assert.match(content, /const bestFriendsEnabled = isFeatureEnabled\("bestFriends"\)/);
assert.match(content, /const quickSettingsEnabled = isFeatureEnabled\("quickSettings"\)/);
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
  /if \(previousSettings\.bestFriends !== nextSettings\.bestFriends\) \{\s*cleanupBestFriendsHome[\s\S]*?\}\s*if \(previousSettings\.quickSettings !== nextSettings\.quickSettings\) \{\s*cleanupQuickSettingsHome\(\)/,
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

console.log("PASS RoTool feature settings navigation, persistence, gates, and documentation");
