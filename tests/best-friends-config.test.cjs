"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "manifest.json"), "utf8"));
const backgroundSource = fs.readFileSync(path.join(projectRoot, "background.js"), "utf8");
const contentSource = fs.readFileSync(path.join(projectRoot, "content.js"), "utf8");
const pageBridgeSource = fs.readFileSync(path.join(projectRoot, "page-bridge.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(projectRoot, "styles.css"), "utf8");
const readme = fs.readFileSync(path.join(projectRoot, "README.md"), "utf8");

assert.equal(manifest.version, "0.19.4");
assert.match(manifest.description, /Best Friends/);
assert.ok(manifest.permissions.includes("storage"));
const mainWorldEntry = manifest.content_scripts.find((entry) => entry.world === "MAIN");
assert.deepEqual(mainWorldEntry?.matches, ["https://www.roblox.com/*"]);
assert.deepEqual(mainWorldEntry?.js, ["page-bridge.js"]);
assert.equal(mainWorldEntry?.run_at, "document_start");

for (const source of [backgroundSource, contentSource]) {
  assert.match(source, /const BEST_FRIENDS_STORAGE_KEY = "bestFriendsByViewer";/);
  assert.match(source, /const MAX_BEST_FRIENDS = 100;/);
}
assert.match(backgroundSource, /async function getBestFriendsContext\(\)/);
assert.match(backgroundSource, /platform-chat-api\/v1\/metadata/);
assert.match(backgroundSource, /metadata\?\.isChatUserMessagesEnabled === true/);
assert.match(backgroundSource, /credentials: "include"/);
assert.match(backgroundSource, /cache: "no-store"/);
assert.match(backgroundSource, /message\?\.type === "rsl:get-best-friends-context"/);
assert.match(contentSource, /type: "rsl:get-best-friends-context"/);
assert.match(contentSource, /mountBestFriendsCarousel\(\);/);
assert.match(contentSource, /BEST_FRIENDS_FILTER_VALUE = "best-friends"/);
assert.match(contentSource, /data-rsl-see-all-best-friends/);
assert.match(contentSource, /activateFriendsPresenceFilter\(context, BEST_FRIENDS_FILTER_VALUE\)/);
assert.match(contentSource, /function getHomeFriendTileVisualRect\(item\)/);
assert.match(contentSource, /--rsl-best-friends-tile-width/);
assert.match(contentSource, /--rsl-best-friends-start-offset/);
assert.doesNotMatch(contentSource, /--rsl-best-friends-label-width/);
assert.match(
  contentSource,
  /wrapper\.setAttribute\("data-rsl-best-friend-fallback", ""\);/
);
const carouselRenderSource = contentSource.slice(
  contentSource.indexOf("function renderBestFriendsCarousel("),
  contentSource.indexOf("function makeBestFriendsCarousel(")
);
assert.ok(
  carouselRenderSource.indexOf("const list = getNativeHomeFriendList(carousel);") <
    carouselRenderSource.indexOf("const signature = getBestFriendsCarouselSignature();"),
  "a skeleton clone without a real list must not cache a completed data signature"
);
assert.ok(
  carouselRenderSource.indexOf("list.replaceChildren(makeBestFriendsAddTile(nativeCarousel));") <
    carouselRenderSource.lastIndexOf("carousel.dataset.rslBestFriendsSignature = signature;"),
  "the completed signature must only be committed after the real list is rendered"
);
assert.match(
  carouselRenderSource,
  /if \(!list\) \{\s*delete carousel\.dataset\.rslBestFriendsSignature;\s*return false;\s*\}/
);
const presenceRankStart = contentSource.indexOf(
  "function getBestFriendPresenceRank("
);
const presenceSortStart = contentSource.indexOf(
  "function getPresenceSortedBestFriendDetails("
);
assert.ok(
  presenceRankStart >= 0 && presenceSortStart > presenceRankStart,
  "Best Friends should define its presence rank before applying the stable sort"
);
const presenceRankSource = contentSource.slice(presenceRankStart, presenceSortStart);
assert.match(
  presenceRankSource,
  /presenceType === "InGame"[\s\S]*presenceType === "InStudio"[\s\S]*return 0;/,
  "InGame and InStudio Best Friends should share the first presence rank"
);
assert.match(
  presenceRankSource,
  /presenceType === "Online"[\s\S]*return 1;/,
  "Online Best Friends should use the second presence rank"
);
assert.match(
  presenceRankSource,
  /return 2;/,
  "Offline and unknown-presence Best Friends should use the last presence rank"
);
const presenceSortSource = contentSource.slice(
  presenceSortStart,
  contentSource.indexOf("function renderBestFriendsCarousel(")
);
assert.match(
  presenceSortSource,
  /\.map\(\(friend, originalIndex\) => \(\{ friend, originalIndex \}\)\)/,
  "the presence sort should retain each Best Friend's original selected position"
);
assert.match(
  presenceSortSource,
  /getBestFriendPresenceRank\(left\.friend\.presenceType\)\s*-\s*getBestFriendPresenceRank\(right\.friend\.presenceType\)\s*\|\|\s*left\.originalIndex\s*-\s*right\.originalIndex/,
  "Best Friends should sort by presence rank and remain stable within equal ranks"
);
assert.match(
  carouselRenderSource,
  /for \(const friend of getPresenceSortedBestFriendDetails\(\)\)/,
  "the Home carousel should render the presence-sorted Best Friends list"
);
const carouselMountSource = contentSource.slice(
  contentSource.indexOf("function mountBestFriendsCarousel("),
  contentSource.indexOf("function normalizeQuickPlayPlaceId(")
);
assert.match(
  carouselMountSource,
  /const nativeList = getNativeHomeFriendList\(nativeCarousel\);\s*if \(!nativeList\) \{[\s\S]*?setHomeFriendsContentCollapsed\(nativeCarousel, homeFriendsCollapsed\);[\s\S]*?querySelectorAll\(`\[\$\{BEST_FRIENDS_CAROUSEL_ATTRIBUTE\}\]`\)[\s\S]*?return;\s*\}/
);
assert.match(
  carouselMountSource,
  /if \(carousel && !getNativeHomeFriendList\(carousel\)\) \{\s*carousel\.remove\(\);\s*carousel = null;\s*\}/
);
assert.match(contentSource, /const selectedOrder = new Map\(/);
assert.match(contentSource, /if \(leftSelected !== rightSelected\)/);
const pickerSearchSource = contentSource.slice(
  contentSource.indexOf("function getBestFriendsPickerSearch("),
  contentSource.indexOf("function rebuildBestFriendsPickerFromSnapshot(")
);
assert.match(
  pickerSearchSource,
  /\.trim\(\)\.toLowerCase\(\)\.replace\(\/\^@\+\/, ""\)/,
  "Best Friends search should normalize leading @ characters from username queries"
);
assert.match(
  pickerSearchSource,
  /`\$\{friend\.displayName\} \$\{friend\.username\}`\.toLowerCase\(\)\.includes\(query\)/,
  "Best Friends search should match both display names and usernames"
);
assert.match(contentSource, /function showBestFriendHoverCard\(anchor, friend/);
assert.match(contentSource, /const gap = 0;/);
assert.match(contentSource, /in-game-friend-card--iarc/);
assert.match(contentSource, /friend-tile-dropdown--iarc/);
assert.match(contentSource, /friend-tile-dropdown/);
assert.match(contentSource, /kind: "gameUniverse", id: String\(friend\.universeId\)/);
assert.match(contentSource, /kind: "game", id: String\(placeId\)/);
assert.match(contentSource, /function preloadBestFriendGameThumbnail\(/);
assert.match(contentSource, /function getBestFriendHoverVisualBox\(/);
assert.match(contentSource, /function hasBestFriendsInterveningContent\(/);
assert.match(contentSource, /const hasBestFriendsRow = !Object\.hasOwn/);
assert.match(
  contentSource,
  /const bestFriendsExpanded =\s*hasBestFriendsRow\s*&&\s*!carousel\.hasAttribute\(BEST_FRIENDS_COLLAPSED_ATTRIBUTE\)/
);
assert.match(
  contentSource,
  /const bestFriendsHeaderRect = hasBestFriendsRow[\s\S]*BEST_FRIENDS_HEADER_ATTRIBUTE/
);
assert.match(
  contentSource,
  /const bestFriendsBodyRect = bestFriendsExpanded[\s\S]*BEST_FRIENDS_BODY_ATTRIBUTE/
);
assert.match(contentSource, /const scope = heading\?\.parentElement/);
assert.doesNotMatch(contentSource, /mostPlayedContainer/);
assert.match(contentSource, /const maximumInspectedElements = 256/);
assert.match(contentSource, /Array\.from\(scope\.children \|\| \[\]\)/);
assert.doesNotMatch(
  contentSource.slice(
    contentSource.indexOf("function getBestFriendsScopedOverlayWidth("),
    contentSource.indexOf("function isBestFriendsTransientPlacementOverlay(")
  ),
  /querySelectorAll/,
  "the structural collision check must stay bounded to Home-header sibling branches"
);
assert.match(
  contentSource,
  /const getProjectedBandSafeWidth = \(rect, probeWidth\) => \{[\s\S]*rect\.top \+ candidateOffsetY,[\s\S]*probeWidth,[\s\S]*rect\.height/
);
assert.match(
  contentSource,
  /const quickSettingsSafeWidth = requiredQuickSettingsWidth > 0[\s\S]*quickSettingsRect,[\s\S]*requiredQuickSettingsWidth/
);
assert.match(
  contentSource,
  /const bestFriendsHeaderSafeWidth = hasBestFriendsRow\s*\? getProjectedBandSafeWidth\(bestFriendsHeaderRect, nativeRect\.width\)/
);
assert.match(
  contentSource,
  /const bestFriendsBodySafeWidth = bestFriendsExpanded\s*\? getProjectedBandSafeWidth\(bestFriendsBodyRect, nativeRect\.width\)/
);
assert.match(
  contentSource,
  /const bestFriendsHeaderBandFits =[\s\S]*nativeRect\.width - 1/
);
assert.match(
  contentSource,
  /const bestFriendsBodyBandFits =\s*!bestFriendsExpanded[\s\S]*nativeRect\.width - 1/
);
assert.match(
  contentSource,
  /const canTrySplit = Boolean\([\s\S]*hasBestFriendsRow[\s\S]*quickSettings[\s\S]*requiredQuickSettingsWidth > 0/
);
assert.match(
  contentSource,
  /carousel\.classList\.add\("rsl-best-friends-carousel--split"\)[\s\S]*"--rsl-quick-settings-split-top"/
);
assert.match(
  contentSource,
  /splitHeaderSafeWidth >= Math\.max\(0, splitNativeRect\.width - 1\)/
);
assert.match(
  contentSource,
  /splitBodySafeWidth >= Math\.max\(0, splitNativeRect\.width - 1\)/
);
assert.match(
  contentSource,
  /`split:\$\{roundedSplitWidth\}:\$\{roundedSplitHeight\}:`/
);
assert.match(contentSource, /carousel\.style\.pointerEvents = "none"/);
assert.match(contentSource, /carousel\.style\.width = "100%"/);
assert.match(contentSource, /carousel\.style\.removeProperty\("padding-inline-end"\)/);
const placementSource = contentSource.slice(
  contentSource.indexOf("function clearBestFriendsPlacementStyles("),
  contentSource.indexOf("function getBestFriendsPickerSearch(")
);
assert.doesNotMatch(
  placementSource,
  /setProperty\(\s*"--rsl-best-friends-(?:header|body)-width"/,
  "placement must never narrow either Best Friends band"
);
assert.doesNotMatch(
  stylesSource,
  /var\(--rsl-best-friends-(?:header|body)-width/,
  "Best Friends CSS must always use the complete native row width"
);
assert.match(
  stylesSource,
  /\.rsl-best-friends-carousel--split\s*\{[^}]*position:\s*relative/s
);
assert.match(
  stylesSource,
  /\.rsl-best-friends-carousel--split\s*>\s*\[data-rsl-quick-settings\]\s*\{[^}]*position:\s*absolute[^}]*--rsl-quick-settings-split-top/s
);
assert.doesNotMatch(contentSource, /carousel\.style\.width = `\$\{roundedWidth\}px`/);
assert.match(contentSource, /!hasInterveningContent/);
assert.match(contentSource, /anchor\.querySelector\("\.avatar-card-image"\)/);
assert.match(contentSource, /\.friends-carousel-tile-sublabel, \.friends-carousel-tile-experience/);
assert.match(contentSource, /Array\.from\(element\.getClientRects\?\.\(\) \|\| \[\]\)/);
const hoverLifecycleSource = contentSource.slice(
  contentSource.indexOf("function showBestFriendHoverCard("),
  contentSource.indexOf("function bindBestFriendHoverCard(")
);
assert.doesNotMatch(hoverLifecycleSource, /setTimeout|requestAnimationFrame/);
assert.match(
  contentSource,
  /function scheduleBestFriendHoverClose\(\) \{\s*closeBestFriendHoverCard\(\);\s*\}/
);
assert.match(
  hoverLifecycleSource,
  /document\.body\.append\(card\);\s*positionBestFriendHoverCard\(card, anchor\);/
);
assert.match(
  hoverLifecycleSource,
  /function scheduleBestFriendHoverOpen\([^)]*\) \{\s*showBestFriendHoverCard\(anchor, friend, focusFirstAction\);\s*\}/
);
assert.match(contentSource, /friend\.gameInstanceId/);
assert.match(contentSource, /friend\.universeId/);
assert.match(contentSource, /friend\.isRobloxPlus/);
assert.match(contentSource, /function appendFriendNameBadges\(/);
assert.match(contentSource, /data-rsl-friend-name-badge-count/);
assert.match(backgroundSource, /"hasRobloxSubscription"/);
assert.match(contentSource, /const BEST_FRIENDS_REFRESH_INTERVAL_MS = 60_000;/);
assert.match(contentSource, /const BEST_FRIENDS_SCROLL_SETTLE_MS = 200;/);
assert.match(
  contentSource,
  /const BEST_FRIENDS_INITIAL_LAYOUT_RECHECK_DELAYS_MS = Object\.freeze\(\[\s*250,\s*750,\s*1_500,\s*3_000\s*\]\);/
);
assert.match(contentSource, /function scheduleBestFriendsInitialLayoutRechecks\(carousel\)/);
assert.match(contentSource, /function clearBestFriendsInitialLayoutRechecks\(\)/);
assert.match(contentSource, /function hasOpenRoToolDialog\(\)/);
assert.match(
  contentSource,
  /if \(currentPlacement && hasOpenRoToolDialog\(\)\) \{\s*return;\s*\}/
);
assert.match(
  contentSource,
  /const createdCarousel = !carousel;[\s\S]*if \(createdCarousel\) \{\s*carousel = makeBestFriendsCarousel\(\s*nativeCarousel,\s*bestFriendsEnabled,\s*quickSettingsEnabled\s*\);[\s\S]*placeBestFriendsCarousel\(carousel, nativeCarousel\);\s*if \(createdCarousel\) \{\s*scheduleBestFriendsInitialLayoutRechecks\(carousel\);/
);
assert.match(
  contentSource,
  /function cleanupBestFriendsHome\([^)]*\) \{\s*closeBestFriendHoverCard\(\);\s*clearBestFriendsInitialLayoutRechecks\(\);/
);
assert.match(contentSource, /function scheduleBestFriendsHomeRefresh\(/);
assert.match(contentSource, /document\.addEventListener\("visibilitychange"/);
assert.match(contentSource, /bestFriendsScrollLockUntil = Date\.now\(\) \+ BEST_FRIENDS_SCROLL_SETTLE_MS/);
assert.match(
  contentSource,
  /Date\.now\(\) < bestFriendsScrollLockUntil[\s\S]*layoutBandBottom <= 0[\s\S]*layoutBandTop >= window\.innerHeight/
);
assert.match(
  contentSource,
  /function isBestFriendsViewportBandInspectable\(top, height\)/
);
assert.match(
  contentSource,
  /if \(!isBestFriendsViewportBandInspectable\(top, height\)\) \{\s*return scopedOverlayWidth < width \? scopedOverlayWidth : null;\s*\}/
);
assert.match(
  contentSource,
  /const geometryIsUnknown =[\s\S]*hasInterveningContent === null;[\s\S]*if \(geometryIsUnknown && currentPlacement\) \{[\s\S]*splitPlacementParts\.length > 0[\s\S]*previousSplitTop[\s\S]*return;\s*\}/
);
assert.match(contentSource, /function isBestFriendsPaintedPointBlocker\(/);
const interveningSource = contentSource.slice(
  contentSource.indexOf("function hasBestFriendsInterveningContent("),
  contentSource.indexOf("function observeBestFriendsGeometry(")
);
assert.match(interveningSource, /isBestFriendsPaintedPointBlocker\(/);
assert.doesNotMatch(interveningSource, /normalizeVisibleText|querySelector/);
assert.match(
  contentSource,
  /bestFriendsScrollSettleTimer = window\.setTimeout\(\(\) => \{\s*bestFriendsScrollLockUntil = 0;\s*bestFriendsScrollSettleTimer = null;\s*queueMount\(\);/
);
assert.match(contentSource, /function mutationsAffectExtensionMount\(mutations\)/);
assert.match(
  contentSource,
  /if \(mutationsAffectExtensionMount\(mutations\)\) \{\s*queueMount\(\);\s*\}/
);
assert.match(
  contentSource,
  /window\.addEventListener\("scroll", \(event\) => \{\s*if \(isInsideRoToolDialog\(event\.target\)\) \{\s*return;/
);
assert.match(backgroundSource, /gameInstanceId: normalizeGameInstanceId\(presence\?\.gameId\)/);
assert.match(backgroundSource, /universeId: normalizeOptionalId\(presence\?\.universeId\)/);
assert.match(backgroundSource, /gameUniverse: \{ path: "\/v1\/games\/icons", idParameter: "universeIds"/);
assert.match(backgroundSource, /endpoint\.searchParams\.set\("format", "Webp"\)/);
assert.match(contentSource, /icon\.className = "icon-chat-gray"/);
assert.match(contentSource, /icon\.className = "icon-viewdetails"/);
assert.match(contentSource, /document\.createTextNode\(`Chat with \$\{friend\.displayName\}`\)/);
assert.match(contentSource, /if \(bestFriendsCanChat\) \{\s*actions\.append\(makeBestFriendActionButton/s);
assert.match(contentSource, /const actions = bestFriendsCanChat \? \["chat", "profile"\] : \["profile"\];/);
assert.match(contentSource, /bestFriendsCanChat = response\.canChat === true/);
assert.match(contentSource, /bestFriendsCanChat,/);
assert.match(contentSource, /const FRIENDS_RUNTIME_MESSAGE_TIMEOUT_MS = 30_000;/);
const friendsRuntimeMessageSource = contentSource.slice(
  contentSource.indexOf("function sendFriendsRuntimeMessage("),
  contentSource.indexOf("function requestAllOnlineFriends(")
);
assert.match(
  friendsRuntimeMessageSource,
  /window\.setTimeout\([\s\S]*FRIENDS_RUNTIME_MESSAGE_TIMEOUT_MS/
);
assert.match(friendsRuntimeMessageSource, /error\.code = "TIMEOUT"/);
assert.match(
  friendsRuntimeMessageSource,
  /chrome\.runtime\.sendMessage\(message, \(response\) => \{\s*const runtimeError = chrome\.runtime\.lastError;/
);
assert.match(friendsRuntimeMessageSource, /if \(settled\) \{\s*return;\s*\}/);
assert.equal(
  (contentSource.match(/return sendFriendsRuntimeMessage\(\{/g) || []).length,
  4,
  "all four Friends message wrappers must use the timeout helper"
);
const pickerLoadSource = contentSource.slice(
  contentSource.indexOf("function loadBestFriendsPickerFriends("),
  contentSource.indexOf("function createBestFriendsDialog(")
);
assert.doesNotMatch(pickerLoadSource, /await Promise\.all\(detailRequests\)/);
assert.ok(
  pickerLoadSource.indexOf('bestFriendsPickerLoadState = "ready";') <
    pickerLoadSource.indexOf("const detailRequests = [];")
);
assert.match(
  pickerLoadSource,
  /void Promise\.resolve\(detailRequest\)[\s\S]*refreshBestFriendsPickerAfterEnrichment\(requestId, viewerUserId\)[\s\S]*\.catch\(\(\) => \{/
);
assert.match(
  contentSource,
  /function refreshBestFriendsPickerAfterEnrichment\(requestId, viewerUserId\)[\s\S]*requestId !== bestFriendsPickerRequestId[\s\S]*viewerUserId !== onlineFriendsViewerUserId[\s\S]*if \(dialog\?\.open\)/
);
assert.doesNotMatch(stylesSource, /rsl-best-friend-menu-icon/);
assert.doesNotMatch(stylesSource, /\.friend-tile-game-name\s*\{[^}]*font-size/s);
assert.match(pageBridgeSource, /ProtocolHandlerClientInterface/);
assert.match(pageBridgeSource, /startDesktopAndMobileWebChat/);
assert.match(pageBridgeSource, /event\.isTrusted !== true/);
assert.doesNotMatch(contentSource, /bestFirst\.width \+ bestSecond\.width/);

assert.match(
  stylesSource,
  /\.rsl-best-friends-carousel > \.container-header\s*\{[^}]*display: grid !important;[^}]*grid-template-columns: minmax\(0, 1fr\) max-content !important;/s
);
assert.match(
  stylesSource,
  /\.rsl-best-friends-carousel--overlay\s*\{[^}]*pointer-events: none !important;/s
);
assert.match(
  stylesSource,
  /\.rsl-best-friends-carousel \.friends-carousel-container\s*\{[^}]*width: 100% !important;/s
);
assert.match(
  stylesSource,
  /\.rsl-best-friends-header-actions\s*\{[^}]*justify-self: end;[^}]*gap: 16px;/s
);
assert.match(
  stylesSource,
  /\.rsl-best-friends-carousel \.friends-carousel-list-container > \*\s*\{[^}]*width: var\(--rsl-best-friends-tile-width, 100px\) !important;[^}]*flex: 0 0 var\(--rsl-best-friends-tile-width, 100px\) !important;/s
);
assert.match(
  stylesSource,
  /\.friends-carousel-list-container > :first-child\s*\{[^}]*margin-inline-start: var\(--rsl-best-friends-start-offset, 0px\) !important;/s
);
assert.doesNotMatch(stylesSource, /--rsl-best-friends-label-width/);
assert.match(
  stylesSource,
  /\[data-rsl-best-friend-fallback\][\s\S]*?:is\(\.friends-carousel-display-name, \.friends-carousel-tile-experience\)\s*\{[^}]*max-width: 100%;[^}]*text-align: center !important;[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;/s
);
assert.match(
  contentSource,
  /function formatBestFriendExperienceLabel\(label\)[\s\S]*?text\.length > 18[\s\S]*?text\.slice\(0, 15\)/
);
assert.match(
  contentSource,
  /function setBestFriendSublabel\(sublabel, label\)[\s\S]*?sublabel\.classList\.remove\("friends-carousel-tile-experience"\)[\s\S]*?sublabel\.replaceChildren\(experience\)[\s\S]*?sublabel\.title = fullLabel[\s\S]*?formatBestFriendExperienceLabel\(fullLabel\)/
);
assert.match(
  contentSource,
  /setBestFriendSublabel\(sublabel, presence\.label\);/
);
assert.doesNotMatch(
  contentSource.slice(
    contentSource.indexOf("function makeBestFriendTile("),
    contentSource.indexOf("function sendQuickSettingsRuntimeMessage(")
  ),
  /sublabel\.classList\.add\("friends-carousel-tile-experience"\)|sublabel\.textContent = presence\.label/,
  "Best Friends must preserve Roblox's nested sublabel DOM instead of flattening it"
);
assert.match(
  stylesSource,
  /\[data-rsl-friend-name-badge-count="2"\][^{]*\{[^}]*max-width: calc\(100% - 40px\) !important;/s
);
assert.match(
  stylesSource,
  /\[data-rsl-friend-name-badge\],[^{]*\.rsl-friend-name-badge\s*\{[^}]*flex: 0 0 auto !important;[^}]*overflow: visible !important;/s
);
assert.match(
  stylesSource,
  /\.rsl-best-friends-dialog__body\s*\{[^}]*box-sizing: border-box !important;[^}]*grid-template-columns: minmax\(0, 1fr\);[^}]*padding: 24px !important;/s
);
assert.match(
  stylesSource,
  /\.rsl-best-friends-picker__search input\s*\{[^}]*box-sizing: border-box !important;[^}]*inline-size: 100% !important;[^}]*max-inline-size: 100% !important;[^}]*margin: 0 !important;/s
);
assert.match(
  stylesSource,
  /\.rsl-best-friend-hover-card\s*\{[^}]*position: fixed !important;[^}]*z-index: 1002 !important;/s
);
assert.match(
  stylesSource,
  /\.rsl-best-friend-hover-card\.rsl-best-friend-hover-card--in-game\s*\{[^}]*width: min\(260px, calc\(100vw - 16px\)\) !important;/s
);
assert.match(
  stylesSource,
  /\.rsl-best-friend-hover-card--compact\s*\{[^}]*width: min\(240px, calc\(100vw - 16px\)\) !important;/s
);
assert.match(
  stylesSource,
  /\.rsl-best-friend-hover-card--compact \.friend-tile-dropdown-button\s*\{[^}]*height: 48px !important;[^}]*padding: 0 12px !important;[^}]*color: var\(--color-content-default, #b7bac3\) !important;[^}]*font-size: 16px !important;[^}]*line-height: 20px !important;/s
);
assert.match(
  stylesSource,
  /\.rsl-best-friend-hover-card--compact[^}]*\.friend-tile-dropdown-button[^}]*> :is\(\.icon-chat-gray, \.icon-viewdetails\)\s*\{[^}]*filter: grayscale\(1\) opacity\(0\.86\) !important;[^}]*transform: scale\(0\.82\) !important;/s
);

assert.match(readme, /On Roblox \*\*Home\*\*, RoTool adds a \*\*Best Friends\*\* carousel/);
assert.match(readme, /stored separately for each signed-in Roblox account/);
assert.match(
  readme,
  /Best Friends presence results, enriched names, and thumbnails stay in memory; only its selected user IDs are saved/
);
assert.match(readme, /\*\*Chat\*\* is included only when Roblox reports that app chat is enabled/);
assert.match(readme, /Verified and Roblox Plus badges/);

console.log("PASS RoTool Best Friends metadata, storage contract, and documentation");
