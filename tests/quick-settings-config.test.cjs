"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const background = fs.readFileSync(path.join(root, "background.js"), "utf8");
const content = fs.readFileSync(path.join(root, "content.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");

function functionSource(source, name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const end = nextName ? source.indexOf(`function ${nextName}(`, start + 1) : -1;
  return source.slice(start, end === -1 ? source.length : end);
}

assert.equal(manifest.version, "0.16.36");
assert.match(manifest.description, /Quick Settings/);
assert.ok(manifest.host_permissions.includes("https://apis.roblox.com/*"));

assert.match(
  background,
  /https:\/\/apis\.roblox\.com\/user-settings-api\/v1\/user-settings\/settings-and-options/
);
assert.match(
  background,
  /https:\/\/apis\.roblox\.com\/user-settings-api\/v1\/user-settings"/
);
for (const apiKey of [
  "whoCanSeeMyOnlineStatus",
  "whoCanJoinMeInExperiences",
  "whoCanSeeMyInventory"
]) {
  assert.match(background, new RegExp(`apiKey: "${apiKey}"`));
}
assert.doesNotMatch(background, /privateServerInvitePrivacy/);

const readSource = functionSource(
  background,
  "fetchQuickSettingsValues",
  "getQuickSettingsSnapshot"
);
assert.match(readSource, /method: "GET"/);
assert.match(readSource, /cache: "no-store"/);
assert.match(readSource, /credentials: "include"/);
assert.match(background, /rawOption\.option/);
assert.match(background, /"optionValue"/);
assert.match(background, /rawOption\.requirement !== "SelfUpdateSetting"/);

const postSource = functionSource(background, "postQuickSettings", "postQuickSetting");
assert.match(postSource, /for \(let attempt = 0; attempt < 2; attempt \+= 1\)/);
assert.match(postSource, /response\.status === 403/);
assert.match(postSource, /isValidQuickSettingsCsrfToken\(responseToken\)/);
assert.match(postSource, /quickSettingsCsrfToken = responseToken/);
assert.doesNotMatch(postSource, /console\.|chrome\.storage/);

const fetchUpdateSource = functionSource(background, "fetchQuickSettingsUpdate", "postQuickSettings");
assert.match(fetchUpdateSource, /method: "POST"/);
assert.match(fetchUpdateSource, /credentials: "include"/);
assert.match(fetchUpdateSource, /body: JSON\.stringify\(body\)/);
assert.match(fetchUpdateSource, /headers\["x-csrf-token"\] = csrfToken/);

const applySource = functionSource(
  background,
  "applyQuickSettingUpdate",
  "readQuickSettingsExperiencePreferences"
);
assert.match(applySource, /authenticatedViewerUserId !== viewerUserId/);
assert.match(applySource, /before\.value !== expectedValue/);
assert.match(applySource, /before\.options\.includes\(requestedValue\)/);
assert.match(
  applySource,
  /await postQuickSetting\(viewerUserId, spec\.apiKey, requestedValue\)/
);
assert.match(applySource, /afterSettings\[alias\]\?\.value !== requestedValue/);
assert.ok(
  (applySource.match(/fetchQuickSettingsViewerUserId\(\)/g) || []).length >= 3,
  "writes must verify the same viewer before and after mutation"
);
assert.doesNotMatch(applySource, /localStorage|chrome\.storage/);

const trustedHomeSource = functionSource(
  background,
  "getTrustedRobloxHomeTabId",
  "handleQuickSettingsReadMessage"
);
assert.match(trustedHomeSource, /getTrustedRobloxTopFrameTabId\(sender\)/);
assert.match(trustedHomeSource, /\^\\\/home\(\?:\\\/\|\$\)\/i/);
assert.match(background, /message\?\.type === QUICK_SETTINGS_READ_MESSAGE_TYPE/);
assert.match(background, /message\?\.type === QUICK_SETTING_UPDATE_MESSAGE_TYPE/);
assert.match(background, /message\?\.type === ONLINE_STATUS_UPDATE_MESSAGE_TYPE/);
assert.match(background, /let quickSettingsWriteTail = Promise\.resolve\(\)/);
assert.match(background, /function enqueueQuickSettingsWrite\(task\)/);
assert.match(background, /quickSettingsCsrfViewerUserId === viewerUserId/);
assert.match(background, /QUICK_SETTINGS_QUEUE_MAX_AGE_MS/);
assert.match(background, /quickSettingsWriteGeneration \+= 1/);

for (const [alias, label] of [
  ["onlineStatus", "Online Status"],
  ["currentExperience", "Current Experience"],
  ["inventory", "Inventory Visibility"]
]) {
  assert.match(content, new RegExp(`alias: "${alias}"`));
  assert.match(content, new RegExp(`label: "${label}"`));
}
for (const removedSetting of [
  "privateServerInvites",
  "privateServerPrivacy",
  "shareActivity",
  "updateFriendsAboutMyActivity"
]) {
  assert.doesNotMatch(background, new RegExp(removedSetting));
  assert.doesNotMatch(content, new RegExp(removedSetting));
}
assert.doesNotMatch(content, /type: "switch"|rsl-quick-setting-switch/);
assert.doesNotMatch(styles, /rsl-quick-setting-switch/);
assert.doesNotMatch(background, /rsl:update-online-visibility/);
assert.doesNotMatch(background, /deriveOnlineVisibility|applyOnlineVisibilityUpdate/);
assert.match(
  background,
  /DIRECT_QUICK_SETTING_ALIASES = Object\.freeze\(\[\s*"currentExperience",\s*"inventory"\s*\]\)/
);
assert.match(
  background,
  /QUICK_SETTINGS_EXPERIENCE_PREFERENCES_STORAGE_KEY/
);
const backgroundOnlineStatusUpdateSource = functionSource(
  background,
  "applyOnlineStatusUpdate",
  "assertQuickSettingsViewer"
);
assert.match(
  backgroundOnlineStatusUpdateSource,
  /expectedOnlineStatus === "NoOne"/
);
assert.match(
  backgroundOnlineStatusUpdateSource,
  /writePreferredCurrentExperience/
);
assert.match(
  backgroundOnlineStatusUpdateSource,
  /onlineResult\.previousSettings\?\.currentExperience\?\.value/
);
assert.match(
  backgroundOnlineStatusUpdateSource,
  /const desiredCurrentExperience =\s*expectedOnlineStatus === "NoOne"\s*\? preferredCurrentExperience \?\? previousCurrentExperience\s*:\s*previousCurrentExperience;/
);
assert.match(
  backgroundOnlineStatusUpdateSource,
  /experienceRestore: "restored"/
);
assert.match(backgroundOnlineStatusUpdateSource, /requireAfter: true/);
assert.match(backgroundOnlineStatusUpdateSource, /error\?\.code === "PARTIAL"/);
assert.match(
  backgroundOnlineStatusUpdateSource,
  /"currentExperience",\s*desiredCurrentExperience,\s*liveExperience\.value/
);
assert.doesNotMatch(
  backgroundOnlineStatusUpdateSource,
  /postQuickSettings\(/
);
assert.match(content, /more\.textContent = "More Settings"/);
assert.match(styles, /margin-left: 3px;\s*content: "\\2192"/);
assert.match(content, /more\.href = "\/my\/account#!\/privacy"/);

const sectionSource = functionSource(content, "ensureQuickSettingsSection", "makeQuickSettingCard");
assert.match(sectionSource, /ensureBestFriendsHeader\(carousel\)/);
assert.match(sectionSource, /carousel\.insertBefore\(section, wantedNextSibling \|\| null\)/);
const renderSource = functionSource(content, "renderQuickSettings", "loadQuickSettings");
assert.match(renderSource, /syncQuickSettingsCollapsedState\(section\)/);
assert.match(renderSource, /section\.dataset\.rslQuickSettingsSignature === signature/);
assert.match(renderSource, /section\.replaceChildren\(header, controls\)/);
assert.match(renderSource, /quickSettingsPendingOperations\.size > 0/);
assert.match(renderSource, /controls\.setAttribute\("role", "group"\)/);
assert.match(renderSource, /quickSettingsFocusRestoreId/);
assert.match(renderSource, /toggle\.id = "rsl-quick-settings-toggle"/);
assert.match(renderSource, /setQuickSettingsCollapsed\(!quickSettingsCollapsed\)/);

const collapsedStateSource = functionSource(
  content,
  "syncQuickSettingsCollapsedState",
  "setQuickSettingsCollapsed"
);
assert.match(collapsedStateSource, /controls\.hidden = quickSettingsCollapsed/);
assert.match(collapsedStateSource, /"data-rsl-quick-settings-collapsed"/);
assert.match(collapsedStateSource, /"aria-expanded"/);
assert.match(collapsedStateSource, /quickSettingsCollapsed \? "Show" : "Hide"/);
assert.match(collapsedStateSource, /section\?\.contains\(document\.activeElement\)/);
assert.match(collapsedStateSource, /document\.activeElement !== toggle/);
assert.match(
  collapsedStateSource,
  /const stateChanged = quickSettingsCollapsed !== nextCollapsed;/
);
assert.match(
  collapsedStateSource,
  /if \(!stateChanged\)/
);
assert.match(collapsedStateSource, /if \(!featureSettingsLoaded\)/);
assert.match(collapsedStateSource, /bestFriendsScrollLockUntil = 0/);
const setCollapsedSource = functionSource(
  content,
  "setQuickSettingsCollapsed",
  "renderQuickSettings"
);
assert.match(setCollapsedSource, /quickSettingsCollapsedConfirmed = nextCollapsed/);
assert.match(setCollapsedSource, /quickSettingsCollapsed = quickSettingsCollapsedConfirmed/);
assert.match(setCollapsedSource, /applyDeferredQuickSettingsCollapsedStorageValue\(\)/);
assert.match(content, /QUICK_SETTINGS_COLLAPSED_STORAGE_KEY/);
assert.match(content, /function quickSettingsCollapsedStorageGet\(/);
assert.match(content, /function quickSettingsCollapsedStorageSet\(/);
assert.match(content, /Promise\.all\(\[\s*featureSettingsStorageGet/);
assert.match(content, /changes\[QUICK_SETTINGS_COLLAPSED_STORAGE_KEY\]/);

const cardSource = functionSource(content, "makeQuickSettingCard", "renderQuickSettings");
assert.match(cardSource, /event\.isTrusted !== true/);
assert.match(cardSource, /document\.createElement\("select"\)/);
assert.match(cardSource, /select\.disabled = disabled/);
assert.match(cardSource, /setting\.options\.includes\(requestedValue\)/);
assert.match(cardSource, /definition\.alias === "onlineStatus"/);
assert.match(cardSource, /void updateOnlineStatus\(requestedValue\)/);
assert.match(cardSource, /const information = document\.createElement\("span"\)/);
assert.match(cardSource, /information\.setAttribute\("role", "button"\)/);
assert.match(cardSource, /informationIcon\.className = "icon-moreinfo-16x16"/);
assert.match(cardSource, /tooltip\.setAttribute\("role", "tooltip"\)/);
assert.match(cardSource, /information\.setAttribute\("aria-describedby", description\.id\)/);
assert.doesNotMatch(cardSource, /\.title\s*=/);

const loadSource = functionSource(content, "loadQuickSettings", "updateOnlineStatus");
assert.match(loadSource, /if \(quickSettingsRequestPromise\)/);
assert.match(loadSource, /operationId !== quickSettingsReadOperationId/);
assert.match(loadSource, /lifecycleEpoch !== quickSettingsLifecycleEpoch/);
assert.match(loadSource, /quickSettingsRequestPromise === request/);
assert.match(loadSource, /normalizeQuickSettingsSnapshot\(response\)/);
const onlineStatusUpdateSource = functionSource(
  content,
  "updateOnlineStatus",
  "updateQuickSetting"
);
assert.match(onlineStatusUpdateSource, /type: ONLINE_STATUS_UPDATE_MESSAGE_TYPE/);
assert.match(onlineStatusUpdateSource, /expectedOnlineStatus: onlineStatus\.value/);
assert.match(onlineStatusUpdateSource, /expectedCurrentExperience: currentExperience\.value/);
assert.match(onlineStatusUpdateSource, /requestedOnlineStatus: requestedValue/);
assert.match(onlineStatusUpdateSource, /experienceRestore === "restored"/);
assert.match(
  onlineStatusUpdateSource,
  /QUICK_SETTING_VALUE_LABELS\[\s*snapshot\.settings\.currentExperience\?\.value\s*\]/
);
assert.doesNotMatch(onlineStatusUpdateSource, /quickSettingsValues\.[a-zA-Z]+\s*=/);
assert.match(
  onlineStatusUpdateSource,
  /finally \{[\s\S]*quickSettingsPendingOperations\.delete\("onlineStatus"\);[\s\S]*queueMount\(\);/
);
const updateSource = functionSource(content, "updateQuickSetting", "getBestFriendsCarouselSignature");
assert.match(updateSource, /quickSettingsPendingOperations\.size > 0/);
assert.match(updateSource, /quickSettingsLoadState !== "ready"/);
assert.match(updateSource, /quickSettingsPendingOperations\.get\(alias\) !== operationToken/);
assert.match(updateSource, /lifecycleEpoch !== quickSettingsLifecycleEpoch/);
assert.match(updateSource, /type: QUICK_SETTING_UPDATE_MESSAGE_TYPE/);
assert.match(updateSource, /expectedValue,/);
assert.match(updateSource, /requestedValue/);
assert.doesNotMatch(updateSource, /quickSettingsValues\[alias\] = requestedValue/);

const placementSource = functionSource(
  content,
  "placeBestFriendsCarousel",
  "getBestFriendsPickerSearch"
);
assert.ok(
  placementSource.indexOf('nativeCarousel.insertAdjacentElement("beforebegin", carousel)') <
    placementSource.indexOf("const carouselRect = carousel.getBoundingClientRect();"),
  "the combined Home stack must be connected before its height is measured"
);
assert.match(placementSource, /const headingGap = 8;/);
assert.match(
  placementSource,
  /const targetTop = headingRect \? headingRect\.bottom \+ headingGap : 0;/
);
assert.match(
  placementSource,
  /const currentTranslateY = overlayPlacementParts\.length > 0[\s\S]*\? previousTranslateY[\s\S]*: 0;/
);
assert.match(
  placementSource,
  /const candidateOffsetY = hasQuickSettingsAnchor[\s\S]*\? targetTop - quickSettingsRect\.top[\s\S]*: fallbackTranslateY - currentTranslateY;/
);
assert.match(
  placementSource,
  /const candidateTranslateY = currentTranslateY \+ candidateOffsetY;/
);
assert.match(
  placementSource,
  /const hasBestFriendsRow = !Object\.hasOwn\([\s\S]*const bestFriendsExpanded =\s*hasBestFriendsRow &&\s*!carousel\.hasAttribute\(BEST_FRIENDS_COLLAPSED_ATTRIBUTE\);[\s\S]*const minimumCarouselHeight = bestFriendsExpanded \? 120 : 0;/
);
assert.match(
  placementSource,
  /const reusableHeight = Math\.max\([\s\S]*Math\.min\(rowHeight, -candidateTranslateY\)[\s\S]*\);/
);
assert.match(placementSource, /reusableHeight >= 8/);
assert.match(
  placementSource,
  /const flowFootprint = Math\.min\(renderedHeight, reusableHeight\);/
);
assert.match(
  placementSource,
  /"--rsl-quick-settings-split-top",[\s\S]*"0px"[\s\S]*const splitBaseQuickSettingsTop =\s*quickSettings\.getBoundingClientRect\(\)\.top;[\s\S]*targetTop - splitBaseQuickSettingsTop/
);
assert.match(content, /const sampleYs = \[0\.12, 0\.35, 0\.62, 0\.88\]/);
assert.match(content, /function observeBestFriendsGeometry\(carousel\)/);
assert.match(content, /observedBestFriendsGeometryQuickSettings/);
assert.match(content, /bestFriendsGeometryObserver\.observe\(quickSettings\)/);
assert.match(content, /Date\.now\(\) < bestFriendsScrollLockUntil/);
assert.match(content, /BEST_FRIENDS_HEADER_ATTRIBUTE = "data-rsl-best-friends-header"/);
assert.match(content, /BEST_FRIENDS_BODY_ATTRIBUTE = "data-rsl-best-friends-body"/);
assert.match(content, /const heading = header\?\.querySelector\("h2"\)/);
assert.match(
  placementSource,
  /const bestFriendsHeaderRect = hasBestFriendsRow[\s\S]*BEST_FRIENDS_HEADER_ATTRIBUTE/
);
assert.match(
  placementSource,
  /const bestFriendsBodyRect = bestFriendsExpanded[\s\S]*BEST_FRIENDS_BODY_ATTRIBUTE/
);
assert.match(
  placementSource,
  /const getProjectedBandSafeWidth = \(rect, probeWidth\) => \{[\s\S]*rect\.top \+ candidateOffsetY,[\s\S]*probeWidth,[\s\S]*rect\.height/
);
assert.match(
  placementSource,
  /const quickSettingsSafeWidth = requiredQuickSettingsWidth > 0[\s\S]*quickSettingsRect,[\s\S]*requiredQuickSettingsWidth/
);
assert.match(
  placementSource,
  /const bestFriendsHeaderSafeWidth = hasBestFriendsRow\s*\? getProjectedBandSafeWidth\(bestFriendsHeaderRect, nativeRect\.width\)/
);
assert.match(
  placementSource,
  /const bestFriendsBodySafeWidth = bestFriendsExpanded\s*\? getProjectedBandSafeWidth\(bestFriendsBodyRect, nativeRect\.width\)/
);
assert.match(
  placementSource,
  /const bestFriendsHeaderBandFits =[\s\S]*nativeRect\.width - 1/
);
assert.match(
  placementSource,
  /const bestFriendsBodyBandFits =[\s\S]*nativeRect\.width - 1/
);
assert.match(
  placementSource,
  /const canTrySplit = Boolean\([\s\S]*hasBestFriendsRow[\s\S]*quickSettings[\s\S]*requiredQuickSettingsWidth > 0/
);
assert.match(
  placementSource,
  /carousel\.classList\.add\("rsl-best-friends-carousel--split"\)[\s\S]*"--rsl-quick-settings-split-top"/
);
assert.match(
  placementSource,
  /splitHeaderSafeWidth >= Math\.max\(0, splitNativeRect\.width - 1\)/
);
assert.match(
  placementSource,
  /splitBodySafeWidth >= Math\.max\(0, splitNativeRect\.width - 1\)/
);
assert.match(
  placementSource,
  /if \(currentPlacement && hasOpenRoToolDialog\(\)\) \{\s*return;\s*\}/
);
assert.match(placementSource, /carousel\.style\.width = "100%"/);
assert.match(placementSource, /carousel\.style\.removeProperty\("padding-inline-end"\)/);
assert.doesNotMatch(
  placementSource,
  /setProperty\(\s*"--rsl-best-friends-(?:header|body)-width"/
);
assert.doesNotMatch(placementSource, /carousel\.style\.width = `\$\{roundedWidth\}px`/);
assert.match(
  styles,
  /\.rsl-best-friends-carousel--split\s*\{[^}]*position:\s*relative/s
);
assert.match(
  styles,
  /\.rsl-best-friends-carousel--split\s*>\s*\[data-rsl-quick-settings\]\s*\{[^}]*position:\s*absolute[^}]*--rsl-quick-settings-split-top/s
);
assert.doesNotMatch(styles, /var\(--rsl-best-friends-(?:header|body)-width/);

assert.match(
  styles,
  /\.rsl-quick-settings\s*\{[^}]*width: min\(336px, 100%\);[^}]*padding: 8px;[^}]*border-radius:/s
);
assert.match(
  styles,
  /\.rsl-quick-settings__header\s*\{[^}]*display: grid;[^}]*min-height: 26px;[^}]*grid-template-columns: minmax\(0, 1fr\) max-content;[^}]*column-gap: 12px;/s
);
assert.match(
  styles,
  /\.rsl-quick-settings__actions\s*\{[^}]*grid-column: 2;[^}]*grid-row: 1;[^}]*justify-self: end;[^}]*gap: 12px;/s
);
assert.match(
  styles,
  /\.rsl-quick-settings__status\s*\{[^}]*width: 100%;[^}]*grid-column: 1 \/ -1;[^}]*grid-row: 2;/s
);
assert.match(
  styles,
  /\.rsl-quick-settings__toggle\s*\{[^}]*width: 34px;[^}]*min-width: 34px;/s
);
assert.match(
  styles,
  /\.rsl-quick-settings__action\s*\{[^}]*min-height: 26px;[^}]*padding: 0 2px;[^}]*justify-content: center;/s
);
assert.match(renderSource, /actions\.append\(refresh, more, toggle\)/);
assert.match(renderSource, /headingGroup\.append\(heading\)/);
assert.doesNotMatch(renderSource, /headingGroup\.append\(heading,\s*status\)/);
assert.match(renderSource, /header\.append\(headingGroup, status, actions\)/);
assert.match(
  styles,
  /\.rsl-quick-settings__controls\s*\{[^}]*display: flex;[^}]*flex-direction: column;[^}]*overflow: visible;/s
);
assert.match(
  styles,
  /\.rsl-quick-settings\[data-rsl-quick-settings-collapsed\]\s*\{[^}]*gap: 0;/s
);
assert.match(styles, /\.rsl-quick-settings \[hidden\]\s*\{[^}]*display: none !important;/s);
assert.match(
  styles,
  /\.rsl-quick-setting-card\s*\{[^}]*display: grid;[^}]*height: 36px;[^}]*grid-template-columns: minmax\(0, 1fr\) minmax\(116px, 43%\);/s
);
assert.match(
  styles,
  /\.rsl-quick-setting-card__description\s*\{[^}]*position: absolute;[^}]*clip-path: inset\(50%\);/s
);
assert.match(styles, /@media \(max-width: 300px\)/);
assert.match(styles, /@media \(max-width: 260px\)/);
assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(styles, /@media \(forced-colors: active\)/);
assert.match(styles, /\.rsl-quick-setting-info:hover > \.rsl-quick-setting-tooltip/);
assert.match(styles, /\.rsl-quick-setting-info:focus-visible > \.rsl-quick-setting-tooltip/);
assert.match(
  styles,
  /\.rsl-quick-setting-info\s*\{[^}]*width: 16px;[^}]*height: 16px;[^}]*flex: 0 0 16px;/s
);
assert.match(
  styles,
  /\.rsl-quick-setting-info > \.icon-moreinfo-16x16\s*\{[^}]*width: 16px;[^}]*height: 16px;[^}]*flex: 0 0 16px;/s
);
assert.match(
  styles,
  /\.rsl-quick-setting-info:hover > \.icon-moreinfo-16x16,[\s\S]*background-position: 0 -160px !important;/
);
assert.match(
  styles,
  /\.rsl-best-friends-carousel--overlay\s*\{[^}]*pointer-events: none !important;/s
);
assert.match(
  styles,
  /\.rsl-best-friends-carousel \.friends-carousel-container\s*\{[^}]*width: 100% !important;/s
);

assert.match(readme, /On Roblox \*\*Home\*\*, RoTool places \*\*Quick Settings\*\*/);
assert.match(readme, /CSRF token stays only in the extension worker's memory/);
assert.match(readme, /\*\*Online Status\*\*, \*\*Current Experience\*\*, and \*\*Inventory Visibility\*\* are separate controls/);
assert.match(readme, /automatically change Current Experience to the matching audience whenever Online Status changes/);
assert.match(readme, /restores the previous Experience choice whenever Roblox still permits it/);
assert.match(readme, /compact three-row settings stack anchored to the left/);
assert.match(readme, /\*\*Hide\*\* minimizes the card/);

console.log("PASS RoTool Quick Settings API, trusted mutation, UI, and layout contract");
