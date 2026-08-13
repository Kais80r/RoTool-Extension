"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "manifest.json"), "utf8"));
const backgroundSource = fs.readFileSync(path.join(projectRoot, "background.js"), "utf8");
const contentSource = fs.readFileSync(path.join(projectRoot, "content.js"), "utf8");
const bridgeSource = fs.readFileSync(path.join(projectRoot, "page-bridge.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(projectRoot, "styles.css"), "utf8");
const visualFixtureSource = fs.readFileSync(
  path.join(projectRoot, "tests", "quick-play-visual-fixture.html"),
  "utf8"
);
const privateServerDialogVisualFixtureSource = fs.readFileSync(
  path.join(projectRoot, "tests", "private-servers-dialog-visual-fixture.html"),
  "utf8"
);
const readme = fs.readFileSync(path.join(projectRoot, "README.md"), "utf8");

assert.equal(manifest.version, "0.16.38");
assert.match(manifest.description, /Quick Play/);
assert.match(manifest.description, /Private Servers/);
assert.match(manifest.description, /Random Server/);
assert.ok(manifest.permissions.includes("scripting"));
assert.ok(manifest.host_permissions.includes("https://www.roblox.com/*"));
assert.ok(manifest.host_permissions.includes("https://games.roblox.com/*"));
assert.ok(manifest.host_permissions.includes("https://apis.roblox.com/*"));

for (const selector of [
  ".game-card-thumb-container",
  ".featured-game-icon-container",
  ".large-game-tile-thumb-container"
]) {
  assert.ok(contentSource.includes(selector), `missing Quick Play host: ${selector}`);
}

assert.match(contentSource, /function normalizeQuickPlayPlaceId\(rawValue\)/);
assert.match(contentSource, /\/\^\[1-9\]\\d\{0,15\}\$\//);
assert.match(contentSource, /url\.origin !== window\.location\.origin/);
assert.match(contentSource, /segment\.toLowerCase\(\) === "games"/);
assert.match(contentSource, /function mountQuickPlayControls\(\)/);
assert.match(contentSource, /function getQuickPlayRootCurrentPlaceId\(root\)/);
assert.match(contentSource, /function isQuickPlayButtonCurrent\(button, expectedPlaceId\)/);
assert.match(contentSource, /function invalidateStaleQuickPlayControls\(mutations\)/);
assert.ok(
  contentSource.match(/isQuickPlayButtonCurrent\(button, placeId\)/g)?.length >= 2,
  "Random Server must validate the live card link before request and response"
);
assert.match(
  contentSource,
  /new MutationObserver\(\(mutations\) => \{[\s\S]*?invalidateStaleQuickPlayControls\(mutations\);\s*if \(mutationsAffectExtensionMount\(mutations\)\) \{\s*queueMount\(\);\s*\}/
);
const initializeSource = contentSource.slice(contentSource.indexOf("function initialize()"));
assert.match(
  initializeSource,
  /const observer = new MutationObserver\(\(mutations\) => \{\s*if \(\s*privateServersDialogOpener &&\s*\(!privateServersDialogOpener\.isConnected \|\|\s*!isQuickPlayButtonCurrent\(\s*privateServersDialogOpener,\s*privateServersPlaceId\s*\)\)\s*\) \{\s*closePrivateServersDialog\(false\);\s*\}\s*(?:invalidateStaleGameTileCcuControls\(mutations\);\s*)?invalidateStaleQuickPlayControls\(mutations\);\s*if \(mutationsAffectExtensionMount\(mutations\)\) \{\s*queueMount\(\);\s*\}/s,
  "the mount observer must close a private-server dialog whose opener detached or changed place"
);
assert.match(
  contentSource,
  /btn-common-play-game-lg btn-primary-md btn-full-width rsl-quick-play-button/
);
assert.match(contentSource, /<span class="icon-common-play" aria-hidden="true"><\/span>/);
assert.doesNotMatch(contentSource, /rsl-quick-play-play-icon/);
assert.match(contentSource, /rsl-random-server-button/);
assert.match(contentSource, /rsl-random-server-icon/);
assert.match(contentSource, /<rect x="2\.5" y="22" width="27" height="6\.5" rx="2\.2"\/>/);
assert.match(
  contentSource,
  /'<\/g><g>' \+\s*'<rect x="8\.5"[^>]+\/>' \+\s*'<rect x="8\.5"[^>]+\/>' \+\s*'<g fill="currentColor"><circle[^>]+\/><circle[^>]+\/><circle[^>]+\/><\/g><\/g>/
);
assert.doesNotMatch(contentSource, /transform="rotate\(-8 16(?:\.5)? 16\)"/);
assert.doesNotMatch(contentSource, /M10\.75 8\.7c\.3-3\.45/);
assert.match(contentSource, /QUICK_PLAY_RANDOM_REQUEST_EVENT/);
assert.match(contentSource, /QUICK_PLAY_RANDOM_RESPONSE_EVENT/);
assert.match(contentSource, /type: "rsl:get-random-public-server"/);
assert.match(contentSource, /type: "rsl:get-private-server-support"/);
assert.match(contentSource, /type: "rsl:get-private-servers"/);
assert.match(contentSource, /const PRIVATE_SERVER_JOIN_MESSAGE_TYPE = "rsl:join-private-server"/);
assert.doesNotMatch(contentSource, /rsl-quick-play-button__icon/);
assert.match(contentSource, /root\.append\(surface\);/);
assert.match(contentSource, /root\.children/);
assert.match(contentSource, /syncQuickPlaySurfaceGeometry\(surface, root, thumbnail\)/);
assert.match(contentSource, /hasCompetingQuickPlay\(root, thumbnail\)/);
assert.match(contentSource, /ropro-card-quick-play-options/);
assert.match(contentSource, /mountQuickPlayControls\(\);/);
assert.match(contentSource, /attributeFilter: \["href"\]/);

const quickPlaySurfaceSource = contentSource.slice(
  contentSource.indexOf("function makeQuickPlaySurface("),
  contentSource.indexOf("function removeQuickPlaySurface(")
);
assert.match(quickPlaySurfaceSource, /privateButton\.hidden = true/);
assert.match(quickPlaySurfaceSource, /rsl-private-server-button/);
assert.match(quickPlaySurfaceSource, /rsl-private-server-icon/);
assert.match(quickPlaySurfaceSource, /privateButton\.setAttribute\("aria-haspopup", "dialog"\)/);
assert.match(quickPlaySurfaceSource, /privateButton\.title = "Private Servers"/);
assert.match(
  quickPlaySurfaceSource,
  /privateButton\.addEventListener\("click", \(event\) => \{[\s\S]*?if \(event\.isTrusted !== true\) \{\s*return;\s*\}[\s\S]*?openPrivateServersDialog\(/,
  "opening the private-server dialog must require a real user click"
);
assert.match(
  quickPlaySurfaceSource,
  /actions\.append\(privateButton, button, randomButton\)/,
  "the supported three-button order must be Private Servers, Quick Play, Random Server"
);
assert.match(quickPlaySurfaceSource, /openPrivateServersDialog\(/);

const privateServerRowSource = contentSource.slice(
  contentSource.indexOf("function makePrivateServerRow("),
  contentSource.indexOf("function renderPrivateServersDialog(")
);
assert.match(privateServerRowSource, /name\.textContent = server\.name/);
assert.match(privateServerRowSource, /rsl-private-servers-dialog__owner-avatar/);
assert.match(privateServerRowSource, /data-rsl-private-server-owner-id/);
assert.match(privateServerRowSource, /avatarImage\.src = DEFAULT_AVATAR_URL/);
assert.match(
  privateServerRowSource,
  /setPrivateServerThumbnailLoading\(avatarImage, "network"\)/,
  "owner avatars must shimmer while their Roblox thumbnails are pending"
);
assert.match(privateServerRowSource, /ownerLink\.className = "rsl-private-servers-dialog__owner-link"/);
assert.match(privateServerRowSource, /ownerLink\.href = `\/users\/\$\{server\.owner\.id\}\/profile`/);
assert.match(privateServerRowSource, /ownerLink\.textContent = server\.owner\.displayName/);
assert.match(
  privateServerRowSource,
  /join\.textContent = isJoining \? "Joining\.\.\." : isFull \? "Full" : "Join"/
);
assert.match(
  privateServerRowSource,
  /join\.disabled =\s*privateServersGameJoinRestricted \|\| isFull \|\| Boolean\(privateServerJoinPromise\)/s
);
assert.match(privateServerRowSource, /isFull \? `\$\{server\.name\} is full` : `Join \$\{server\.name\}`/);
assert.match(
  privateServerRowSource,
  /join\.addEventListener\("click", \(event\) => \{\s*if \(event\.isTrusted !== true\) \{\s*return;\s*\}/,
  "joining a private server must require a real user click"
);
assert.match(privateServerRowSource, /PRIVATE_SERVER_TOKEN_ATTRIBUTE/);
assert.doesNotMatch(
  privateServerRowSource,
  /accessCode/,
  "a private-server access code must never be written into the server-row DOM"
);
assert.doesNotMatch(contentSource, /data-rsl-private-server-access(?:-code)?/i);
assert.doesNotMatch(contentSource, /rotool:private-server-(?:request|response|result):v1/);
assert.doesNotMatch(contentSource, /joinPrivateGame|chrome\.scripting/);
assert.doesNotMatch(
  contentSource,
  /chrome\.storage\.local\.(?:get|set)\(\{[^}]*accessCode/is
);
assert.doesNotMatch(
  contentSource,
  /console\.(?:log|info|debug|warn|error)\([^)]*accessCode/is
);
assert.match(contentSource, /<h2[^>]*>Private Servers<\/h2>/);
assert.match(contentSource, /data-rsl-private-servers-game-icon/);
assert.match(contentSource, /data-rsl-private-servers-price/);
assert.match(contentSource, /data-rsl-private-servers-search/);
assert.match(contentSource, /type="search"/);
assert.match(contentSource, /placeholder="Search private servers"/);
assert.match(contentSource, /loadPrivateServerGameThumbnail\(dialog, placeId\)/);
assert.match(contentSource, /function setPrivateServerThumbnailLoading\(/);
assert.match(contentSource, /function finishPrivateServerThumbnailLoading\(/);
assert.match(contentSource, /frame\.dataset\.rslThumbnailState = "loading"/);
assert.match(
  contentSource,
  /loadPrivateServerGameThumbnail\(dialog, placeId\);\s*dialog\.showModal\(\);/,
  "the game-icon shimmer must start before the reusable dialog becomes visible"
);
assert.match(
  contentSource,
  /markPrivateServerOwnerThumbnailUnavailable/,
  "missing or failed owner images must back off instead of shimmering and refetching forever"
);
assert.match(contentSource, /PRIVATE_SERVER_OWNER_THUMBNAILS_MESSAGE_TYPE/);
assert.match(contentSource, /hydratePrivateServerOwnerThumbnails\(dialog, privateServersPlaceId\)/);
assert.match(contentSource, /aria-label="Private servers"/);
assert.match(contentSource, /data-rsl-private-servers-page-link>View Private Servers<\/a>/);
assert.match(contentSource, /pageLink\.href = getPrivateServersPageUrl\(placeId\)/);
assert.match(contentSource, /gameLink\.className = "rsl-private-servers-dialog__game-link"/);
assert.match(contentSource, /gameLink\.href = `\/games\/\$\{placeId\}`/);
assert.match(contentSource, /description\.replaceChildren/);
assert.match(contentSource, /No private servers found\./);
assert.match(
  contentSource,
  /No private servers match your search\./,
  "an empty local search result must be distinguishable from having no accessible servers"
);
assert.doesNotMatch(
  contentSource,
  /data-rsl-private-servers-load-more|Retry loading more|>Load more</,
  "private-server pagination must not expose a manual Load more control"
);

const privateServerFeatureSource = contentSource.slice(
  contentSource.indexOf("function updatePrivateServerButtonVisibility("),
  contentSource.indexOf("function makeQuickPlaySurface(")
);

const privateServerPriceFormatterSource = contentSource.slice(
  contentSource.indexOf("function formatPrivateServerPrice("),
  contentSource.indexOf("function normalizePrivateServer(")
);
assert.match(
  privateServerPriceFormatterSource,
  /price === 0[\s\S]*?"Free"/,
  "a zero Robux price must be displayed as Free"
);
assert.match(
  privateServerPriceFormatterSource,
  /toLocaleString\([\s\S]*?Robux \/ month/,
  "paid private-server prices must be formatted as N Robux / month"
);
assert.match(
  privateServerPriceFormatterSource,
  /return null|return ""/,
  "an unknown legacy price must remain hidden instead of appearing free"
);

const privateServerSearchMatcherSource = contentSource.slice(
  contentSource.indexOf("function matchesPrivateServerSearch("),
  contentSource.indexOf("function makePrivateServersState(")
);
for (const searchableField of [
  /server\.name/,
  /server\.owner\.displayName/,
  /server\.owner\.name/,
  /server\.owner\.id/,
  /server\.id/
]) {
  assert.match(
    privateServerSearchMatcherSource,
    searchableField,
    `private-server search is missing ${searchableField}`
  );
}
assert.doesNotMatch(
  privateServerSearchMatcherSource,
  /accessCode/,
  "private-server access codes must never participate in search"
);
assert.match(
  privateServerFeatureSource,
  /const supported = surface\.dataset\.rslPrivateServerSupported === "true";/,
  "Private Servers must be visible only after explicit supported=true confirmation"
);
assert.doesNotMatch(
  privateServerFeatureSource,
  /rslPrivateServerSupported !== "false"/,
  "unknown support must fail closed"
);
assert.match(
  contentSource,
  /const QUICK_PLAY_PRIVATE_LAYOUT_HYSTERESIS_PX = 8;/,
  "the private-button layout must use an 8px resize hysteresis"
);
assert.match(
  privateServerFeatureSource,
  /const wasThreeButtonLayout = surface\.dataset\.rslPrivateServerLayout === "three";[\s\S]*?const privateLayoutMinimumWidth = wasThreeButtonLayout[\s\S]*?QUICK_PLAY_PRIVATE_MIN_THUMBNAIL_WIDTH -[\s\S]*?QUICK_PLAY_PRIVATE_LAYOUT_HYSTERESIS_PX[\s\S]*?: QUICK_PLAY_PRIVATE_MIN_THUMBNAIL_WIDTH;[\s\S]*?supported && measuredWidth >= privateLayoutMinimumWidth;/,
  "a confirmed three-button card must stay stable until it shrinks through the hysteresis boundary"
);
const privateServerSupportLoadSource = contentSource.slice(
  contentSource.indexOf("function loadPrivateServerSupportForSurface("),
  contentSource.indexOf("function observePrivateServerSupport(")
);
assert.match(
  privateServerSupportLoadSource,
  /\.catch\(\(\) => \{[\s\S]*?applyPrivateServerSupport\(surface, null\);[\s\S]*?clearPrivateServerSupportRetry\(placeId\);/,
  "support lookup failures must remain unknown until another direct interaction retries them"
);
assert.doesNotMatch(
  privateServerSupportLoadSource,
  /\.catch\(\(\) => \{[\s\S]*?schedulePrivateServerSupportRetry\(placeId\);/,
  "a failed hover lookup must not create an unattended retry scan"
);
assert.match(
  privateServerSupportLoadSource,
  /applyPrivateServerSupport\(surface, support\.enabled, support\.price\);[\s\S]*?if \(support\.stale\) \{[\s\S]*?schedulePrivateServerSupportRetry\(placeId\);[\s\S]*?else \{[\s\S]*?clearPrivateServerSupportRetry\(placeId\);/,
  "stale support must stay visible while content retries until the refresh is confirmed"
);
assert.doesNotMatch(
  privateServerSupportLoadSource,
  /privateServerSupportByPlaceId\.set|applyPrivateServerSupport\(surface, false\)/,
  "support lookup failures must not be cached or treated as a confirmed unsupported response"
);
assert.doesNotMatch(
  privateServerSupportLoadSource,
  /\.catch\(\(\) => \{[\s\S]*?enabled: true/,
  "support lookup failures must never reveal the Private Servers button"
);
const privateServerSupportRequestSource = contentSource.slice(
  contentSource.indexOf("function requestPrivateServerSupport("),
  contentSource.indexOf("function loadPrivateServerSupportForSurface(")
);
assert.match(
  privateServerSupportRequestSource,
  /typeof response\.enabled !== "boolean"[\s\S]*?typeof response\.stale !== "boolean"[\s\S]*?if \(!response\.stale\) \{[\s\S]*?privateServerSupportByPlaceId\.set\(placeId, \{\s*enabled: response\.enabled,\s*price,\s*expiresAt: Date\.now\(\) \+ PRIVATE_SERVER_SUPPORT_CACHE_TTL_MS\s*\}\);/,
  "only explicit, fresh Boolean support responses must be cached"
);
assert.match(
  privateServerSupportRequestSource,
  /responsePrice !== undefined[\s\S]*?responsePrice !== null/,
  "content must explicitly support an unknown legacy price"
);
assert.match(
  privateServerSupportRequestSource,
  /normalizePrivateServerPrice\(responsePrice\) === null/,
  "content must reject malformed runtime prices while preserving zero"
);
assert.match(
  privateServerSupportRequestSource,
  /const price = normalizePrivateServerPrice\(responsePrice\)[\s\S]*?price,/,
  "a validated runtime price must reach the content support cache"
);
assert.doesNotMatch(
  privateServerSupportRequestSource,
  /\.catch\([\s\S]*?privateServerSupportByPlaceId\.set/,
  "a rejected support request must not populate the support cache"
);
assert.match(
  contentSource,
  /const PRIVATE_SERVER_SUPPORT_RETRY_DELAYS_MS = Object\.freeze\(\[\s*1_000,\s*3_000,\s*10_000,\s*30_000\s*\]\);/,
  "support retries must begin with the 1s, 3s, 10s, and 30s backoff"
);
assert.match(
  contentSource,
  /const PRIVATE_SERVER_SUPPORT_STEADY_RETRY_MS\s*=\s*[1-9][\d_]*;/,
  "support retries must continue at a steady interval after initial backoff"
);
assert.match(
  contentSource,
  /const PRIVATE_SERVER_SUPPORT_RETRY_JITTER_(?:RATIO|MS)\s*=\s*[^;]+;/,
  "steady support retries must define jitter"
);
const privateServerSupportRetrySource = contentSource.slice(
  contentSource.indexOf("function schedulePrivateServerSupportRetry("),
  contentSource.indexOf("function requestPrivateServerSupport(")
);
assert.doesNotMatch(
  privateServerSupportRetrySource,
  /if \(attempt >= PRIVATE_SERVER_SUPPORT_RETRY_DELAYS_MS\.length\) \{\s*return;\s*\}/,
  "a connected unknown card must not stop retrying after the initial schedule"
);
assert.match(
  privateServerSupportRetrySource,
  /PRIVATE_SERVER_SUPPORT_STEADY_RETRY_MS/,
  "retry scheduling must fall through to the steady retry interval"
);
assert.match(
  privateServerSupportRetrySource,
  /Math\.random\(\)/,
  "retry scheduling must jitter requests so visible cards do not retry in lockstep"
);
assert.match(
  contentSource,
  /const PRIVATE_SERVER_SUPPORT_MAX_CONCURRENT_REQUESTS = 6;/,
  "support checks must allow six pending runtime messages"
);
assert.match(
  contentSource,
  /const PRIVATE_SERVER_REQUEST_TIMEOUT_MS = 120_000;/,
  "support messages must remain open through a Roblox rate-limit cooldown"
);
const privateServerSupportQueueSource = contentSource.slice(
  contentSource.indexOf("function drainPrivateServerSupportRequestQueue("),
  contentSource.indexOf("function getPrivateServerSupportSurfacePlaceId(")
);
assert.match(
  privateServerSupportQueueSource,
  /activePrivateServerSupportRequests <\s*PRIVATE_SERVER_SUPPORT_MAX_CONCURRENT_REQUESTS[\s\S]*?privateServerSupportRequestQueue\.shift\(\)[\s\S]*?activePrivateServerSupportRequests \+= 1[\s\S]*?sendPrivateServerRuntimeMessage\(task\.message\)[\s\S]*?activePrivateServerSupportRequests -= 1;[\s\S]*?drainPrivateServerSupportRequestQueue\(\);/,
  "private-support runtime messages must drain through the concurrency-six queue"
);
assert.doesNotMatch(
  privateServerFeatureSource,
  /CustomEvent|dispatchEvent|chrome\.storage|console\.|joinPrivateGame|chrome\.scripting/,
  "private-server codes must not leave isolated extension code through DOM events, storage, logs, or direct page calls"
);
const joinPrivateServerSource = contentSource.slice(
  contentSource.indexOf("function joinPrivateServer("),
  contentSource.indexOf("function makePrivateServerRow(")
);
assert.match(
  joinPrivateServerSource,
  /sendPrivateServerRuntimeMessage\(\{\s*type: PRIVATE_SERVER_JOIN_MESSAGE_TYPE,\s*requestId,\s*placeId,\s*accessCode: server\.accessCode\s*\}\)/s,
  "private-server access codes may leave isolated content only in the privileged runtime message"
);
assert.match(
  contentSource,
  /const QUICK_PLAY_PRIVATE_MIN_THUMBNAIL_WIDTH = 144;/
);
assert.match(
  contentSource,
  /const QUICK_PLAY_PRIVATE_WIDE_MIN_THUMBNAIL_WIDTH = 172;/
);
assert.match(
  contentSource,
  /const useThreeButtonLayout =\s*supported && measuredWidth >= privateLayoutMinimumWidth;/s
);
assert.match(contentSource, /surface\.dataset\.rslQuickPlayActionSize = useWideActionSize \? "wide" : "compact"/);
assert.match(
  contentSource,
  /privateServersGameJoinRestricted =\s*privateServersGameJoinRestricted \|\| response\.gameJoinRestricted === true;/s,
  "a Roblox join restriction must stay active across every loaded page"
);
assert.match(
  contentSource,
  /if \(\s*!privateServersDialogOpener\?\.isConnected \|\|\s*!isQuickPlayButtonCurrent\(privateServersDialogOpener, placeId\)\s*\) \{\s*closePrivateServersDialog\(false\);\s*return;\s*\}/s,
  "an async response must close rather than update a dialog whose card opener detached"
);
const privateServerOpenSource = contentSource.slice(
  contentSource.indexOf("function openPrivateServersDialog("),
  contentSource.indexOf("function makeQuickPlaySurface(")
);
assert.match(
  privateServerOpenSource,
  /if \(!opener\?\.isConnected \|\| !isQuickPlayButtonCurrent\(opener, placeId\)\) \{\s*return;\s*\}/
);
assert.match(
  privateServerOpenSource,
  /dialog\.addEventListener\(\s*"close",\s*\(\) => \{\s*if \(opener\.isConnected\) \{\s*openPrivateServersDialog\(opener, placeId, cardName, price\);\s*\}\s*\},\s*\{ once: true \}\s*\);\s*closePrivateServersDialog\(false\);/s,
  "switching cards must reopen only from the previous dialog's close event"
);

const privateServerRenderSource = contentSource.slice(
  contentSource.indexOf("function renderPrivateServersDialog("),
  contentSource.indexOf("function loadPrivateServersPage(")
);
assert.doesNotMatch(
  privateServerRenderSource,
  /loadMore|data-rsl-private-servers-load-more|Load more|Retry loading more/,
  "rendering must not depend on a manual pagination button"
);
const privateServerLoadSource = contentSource.slice(
  contentSource.indexOf("function loadPrivateServersPage("),
  contentSource.indexOf("function resetPrivateServersDialogState(")
);
assert.match(
  contentSource,
  /(?:PRIVATE_SERVER|PRIVATE_SERVERS)[A-Z0-9_]*(?:MAX|PAGE)[A-Z0-9_]*\s*=\s*100;/,
  "automatic private-server pagination must have a 100-page safety cap"
);
assert.match(
  privateServerLoadSource,
  /(?:seen|loaded)[A-Za-z]*Cursor[A-Za-z]*\.has\(nextCursor\)/i,
  "automatic pagination must stop when Roblox repeats a cursor"
);
assert.match(
  privateServerLoadSource,
  /(?:seen|loaded)[A-Za-z]*Cursor[A-Za-z]*\.add\(cursor\)/i,
  "automatic pagination must remember cursors across pages"
);
assert.match(
  privateServerLoadSource,
  /loadPrivateServersPage\(false\)/,
  "a successful page with a next cursor must continue automatically"
);
const privateServerDialogCreationSource = contentSource.slice(
  contentSource.indexOf("function createPrivateServersDialog("),
  contentSource.indexOf("function openPrivateServersDialog(")
);
assert.match(
  privateServerDialogCreationSource,
  /rsl-private-servers-dialog__header-copy[\s\S]*?data-rsl-private-servers-price[\s\S]*?data-rsl-private-servers-search[\s\S]*?data-rsl-private-servers-status/,
  "the dialog must place price in the header and search before its live status"
);
assert.match(
  privateServerDialogCreationSource,
  /data-rsl-private-servers-search[\s\S]*?addEventListener\(\s*"input"[\s\S]*?renderPrivateServersDialog\(\)/,
  "typing in private-server search must filter the already-loaded dialog immediately"
);
const privateServerSearchInputHandlerSource = privateServerDialogCreationSource.slice(
  privateServerDialogCreationSource.indexOf('"input",'),
  privateServerDialogCreationSource.indexOf('"input",') + 600
);
assert.doesNotMatch(
  privateServerSearchInputHandlerSource,
  /loadPrivateServersPage|sendPrivateServerRuntimeMessage/,
  "private-server search must not issue a network/runtime request per keystroke"
);
assert.match(
  privateServerDialogCreationSource,
  /rsl-private-servers-dialog__footer[\s\S]*?data-rsl-private-servers-page-link>View Private Servers<\/a>[\s\S]*?data-rsl-close-private-servers>Close<\/button>/,
  "the footer must place View Private Servers at the far left before Close"
);
assert.doesNotMatch(
  privateServerDialogCreationSource,
  /data-rsl-private-servers-load-more|loadPrivateServersPage\(false\)|Load more/,
  "the modal must not create or listen for a Load more control"
);

const quickPlayMountSource = contentSource.slice(
  contentSource.indexOf("function normalizeQuickPlayPlaceId("),
  contentSource.indexOf("function mountSidebar()")
);
assert.doesNotMatch(quickPlayMountSource, /setInterval\s*\(/);
assert.doesNotMatch(quickPlayMountSource, /fetch\s*\(/);
const quickPlayGeometryObserverSource = contentSource.slice(
  contentSource.indexOf("function getQuickPlayGeometryObserver("),
  contentSource.indexOf("function clearQuickPlayFeedback(")
);
assert.match(
  quickPlayGeometryObserverSource,
  /quickPlayGeometryObserver = new ResizeObserver\(\(entries\) => \{[\s\S]*?syncQuickPlaySurfaceGeometry\(surface, root, thumbnail\);/,
  "thumbnail geometry changes must resync Quick Play through ResizeObserver"
);
const quickPlayCardMountSource = contentSource.slice(
  contentSource.indexOf("function mountQuickPlayCard("),
  contentSource.indexOf("function mountQuickPlayControls(")
);
assert.match(
  quickPlayCardMountSource,
  /getQuickPlayGeometryObserver\(\)\?\.observe\(thumbnail\);/,
  "mounted Quick Play thumbnails must be observed for size changes"
);
assert.doesNotMatch(
  privateServerFeatureSource,
  /new IntersectionObserver\(/,
  "mounting or intersecting cards must not spend private-server capability lookups"
);
const quickPlayPrivateSupportObserveSource = contentSource.slice(
  contentSource.indexOf("function observePrivateServerSupport("),
  contentSource.indexOf("function normalizePrivateServerCursor(")
);
assert.match(
  privateServerFeatureSource,
  /function activatePrivateServerSupport\(surface\) \{[\s\S]*?surface\.dataset\.rslPrivateSupportActivated = "true";[\s\S]*?loadPrivateServerSupportForSurface\(surface\);/,
  "only a directly interacted card may enter the active support set"
);
assert.match(
  privateServerFeatureSource,
  /function getPrivateServerSupportSurfaces\(placeId, activatedOnly = false\)[\s\S]*?!activatedOnly \|\| surface\.dataset\.rslPrivateSupportActivated === "true"/,
  "automatic stale refreshes must remain limited to previously activated cards"
);
assert.match(
  quickPlayPrivateSupportObserveSource,
  /const onFocusIn = \(event\) => \{[\s\S]*?event\.isTrusted === true[\s\S]*?activatePrivateServerSupport\(surface\);[\s\S]*?host\.addEventListener\("focusin", onFocusIn\);/,
  "keyboard focus must demand-load support for the focused card"
);
assert.match(
  quickPlayPrivateSupportObserveSource,
  /const onPointerEnter = \(event\) => \{[\s\S]*?event\.isTrusted === true[\s\S]*?activatePrivateServerSupport\(surface\);[\s\S]*?host\.addEventListener\("pointerenter", onPointerEnter,/,
  "pointer entry must demand-load support for only the hovered card"
);
assert.match(
  quickPlayPrivateSupportObserveSource,
  /privateServerSupportInteractionBindings\.set\(surface, \{\s*host,\s*onPointerEnter,\s*onFocusIn\s*\}\);/,
  "each surface must retain its exact host listeners for cleanup"
);
const quickPlaySurfaceRemovalSource = contentSource.slice(
  contentSource.indexOf("function removeQuickPlaySurface("),
  contentSource.indexOf("function hasCompetingQuickPlay(")
);
assert.match(
  contentSource,
  /const privateServerSupportInteractionBindings = new WeakMap\(\);/,
  "support interaction bindings must not keep detached cards alive"
);
const quickPlayPrivateSupportCleanupSource = contentSource.slice(
  contentSource.indexOf("function removePrivateServerSupportInteraction("),
  contentSource.indexOf("function observePrivateServerSupport(")
);
assert.match(
  quickPlayPrivateSupportCleanupSource,
  /binding\.host\.removeEventListener\("pointerenter", binding\.onPointerEnter\);[\s\S]*?binding\.host\.removeEventListener\("focusin", binding\.onFocusIn\);[\s\S]*?privateServerSupportInteractionBindings\.delete\(surface\);/,
  "detached Quick Play cards must release both host interaction listeners"
);
assert.match(
  quickPlaySurfaceRemovalSource,
  /removePrivateServerSupportInteraction\(surface\);[\s\S]*?surface\?\.remove\(\);[\s\S]*?quickPlayGeometryObserver\?\.unobserve\(thumbnail\);[\s\S]*?thumbnail\.removeAttribute\(QUICK_PLAY_THUMBNAIL_ATTRIBUTE\);/,
  "removed Quick Play surfaces must unobserve their thumbnails"
);

assert.match(backgroundSource, /games\.roblox\.com/);
assert.match(backgroundSource, /servers\/Public/);
assert.match(backgroundSource, /excludeFullGames/);
assert.match(backgroundSource, /rsl:get-random-public-server/);
assert.match(backgroundSource, /credentials: "include"/);
assert.match(backgroundSource, /rsl:get-private-server-support/);
assert.match(backgroundSource, /rsl:get-private-servers/);
assert.match(
  backgroundSource,
  /const PRIVATE_SERVER_SUPPORT_GLOBAL_CONCURRENCY = 2;/,
  "private-support Roblox requests must share a background-wide max-two queue"
);
assert.match(
  backgroundSource,
  /const PRIVATE_SERVER_SUPPORT_CACHE_MAX_ENTRIES = 1_000;/,
  "the persistent support cache must retain more than a 150-card page without LRU thrashing"
);
assert.match(
  backgroundSource,
  /const PRIVATE_SERVER_SUPPORT_STORAGE_KEY = "rslPrivateServerSupportCacheV2";/,
  "confirmed support must use a versioned persistent cache key"
);
assert.match(
  backgroundSource,
  /const PRIVATE_SERVER_SUPPORT_STORAGE_VERSION = 2;/,
  "the current support-cache schema must use version 2"
);
assert.match(
  backgroundSource,
  /chrome\.storage\?\.local/,
  "confirmed support should survive worker restarts and extension updates"
);
assert.match(
  backgroundSource,
  /chrome\.storage\?\.session/,
  "support persistence must retain a session-storage fallback"
);
const privateServerSupportStorageAreaSource = backgroundSource.slice(
  backgroundSource.indexOf("function getPrivateServerSupportStorageArea("),
  backgroundSource.indexOf("function readPrivateServerSupportStorage(")
);
assert.match(
  privateServerSupportStorageAreaSource,
  /chrome\.storage\?\.local \|\| chrome\.storage\?\.session \|\| null/,
  "the private-support cache must prefer local storage and fall back to session storage"
);
const backgroundPrivateServerSupportQueueSource = backgroundSource.slice(
  backgroundSource.indexOf("function drainPrivateServerSupportTaskQueue("),
  backgroundSource.indexOf("function setBoundedPrivateServerSupportCache(")
);
assert.match(
  backgroundPrivateServerSupportQueueSource,
  /const cooldownDelay = privateServerSupportRateLimitedUntil - Date\.now\(\);[\s\S]*?schedulePrivateServerSupportQueueDrain\(cooldownDelay\);[\s\S]*?return;/,
  "rate-limited support work must remain queued until the cooldown expires"
);
assert.match(
  backgroundPrivateServerSupportQueueSource,
  /activePrivateServerSupportTasks < PRIVATE_SERVER_SUPPORT_GLOBAL_CONCURRENCY[\s\S]*?privateServerSupportTaskQueue\.shift\(\)[\s\S]*?activePrivateServerSupportTasks \+= 1[\s\S]*?activePrivateServerSupportTasks -= 1/,
  "all tabs must drain support checks through the background-wide max-two queue"
);
assert.match(
  backgroundPrivateServerSupportQueueSource,
  /task\.rateLimitAttempts <[\s\S]*?PRIVATE_SERVER_SUPPORT_RATE_LIMIT_REQUEUE_ATTEMPTS[\s\S]*?privateServerSupportTaskQueue\.unshift\(task\)/,
  "the request that receives a 429 must be requeued ahead of later cards"
);
assert.match(
  backgroundPrivateServerSupportQueueSource,
  /privateServerSupportTaskQueue\.findIndex\([\s\S]*?queuedTask\.priority === "foreground"/,
  "never-seen foreground checks must be selected ahead of stale refresh work"
);
assert.match(
  backgroundPrivateServerSupportQueueSource,
  /normalizedPriority === "refresh"[\s\S]*?Date\.now\(\) \+ PRIVATE_SERVER_SUPPORT_REFRESH_GRACE_MS/,
  "stale refreshes must be briefly deferred so incoming foreground checks can pass them"
);
assert.match(
  backgroundSource,
  /const PRIVATE_SERVER_SUPPORT_RATE_LIMIT_REQUEUE_ATTEMPTS = 1;/,
  "a throttled support lookup must have one bounded worker-level retry"
);
assert.match(backgroundSource, /x-ratelimit-remaining/);
assert.match(backgroundSource, /x-ratelimit-reset/);
assert.match(
  backgroundSource,
  /private-servers-api\/Universe-Private-Server-Settings/
);
assert.match(backgroundSource, /\/v1\/games\/\$\{placeId\}\/private-servers/);
assert.match(backgroundSource, /const rawProductId = privateServerData\?\.privateServerProductId/);
assert.match(backgroundSource, /const rawPrice = privateServerData\?\.price/);
assert.match(
  backgroundSource,
  /const PRIVATE_SERVER_SUPPORT_PRICE_UNAVAILABLE_CACHE_TTL_MS = 5 \* 60_000;/,
  "a supported response with no usable price must be retried before the 24-hour support TTL"
);
assert.match(
  backgroundSource,
  /Number\.isSafeInteger\(rawPrice\)[\s\S]*?rawPrice >= 0/,
  "Roblox private-server prices must be sanitized as non-negative safe integers"
);
assert.match(backgroundSource, /enabled: productId !== "0"/);
assert.doesNotMatch(backgroundSource, /enabled:\s*[^\n]*isAvailable/);
const privateServerSupportUniverseSource = backgroundSource.slice(
  backgroundSource.indexOf("function getPrivateServerSupportForUniverse("),
  backgroundSource.indexOf("function refreshPrivateServerSupport(")
);
assert.match(
  privateServerSupportUniverseSource,
  /credentials: "omit"/,
  "public private-server capability metadata must not consume the signed-in account's lower cookie quota"
);
assert.doesNotMatch(
  privateServerSupportUniverseSource,
  /credentials: "include"/,
  "private-server capability checks must not send Roblox account cookies"
);
assert.match(
  backgroundSource,
  /setBoundedPrivateServerSupportCache\(universeId, \{\s*expiresAt: now \+ PRIVATE_SERVER_SUPPORT_UNIVERSE_CACHE_TTL_MS,/,
  "the short in-memory request cache must not inherit the durable true-support TTL"
);
const backgroundPrivateServerSupportRefreshSource = backgroundSource.slice(
  backgroundSource.indexOf("function refreshPrivateServerSupport("),
  backgroundSource.indexOf("async function getPrivateServerSupport(")
);
const backgroundPrivateServerSupportStorageSource = backgroundSource.slice(
  backgroundSource.indexOf("function normalizeStoredPrivateServerSupportEntry("),
  backgroundSource.indexOf("function schedulePrivateServerSupportQueueDrain(")
);
assert.match(
  backgroundPrivateServerSupportStorageSource,
  /Number\.isSafeInteger\(rawPrice\)[\s\S]*?rawPrice >= 0/,
  "stored prices must be validated without confusing zero with a missing price"
);
assert.match(
  backgroundPrivateServerSupportStorageSource,
  /price:\s*entry\.price/,
  "a validated private-server price must be serialized with persistent support"
);
assert.match(
  backgroundPrivateServerSupportStorageSource,
  /price:\s*[^,\n]*price/,
  "support results must carry the normalized private-server price"
);
assert.match(
  backgroundPrivateServerSupportStorageSource,
  /normalizePrivateServerPrice\(result\.price\) === null[\s\S]*?PRIVATE_SERVER_SUPPORT_PRICE_UNAVAILABLE_CACHE_TTL_MS[\s\S]*?PRIVATE_SERVER_SUPPORT_CACHE_TTL_MS/,
  "missing price metadata must use the short refresh TTL without discarding supported capability"
);
assert.match(
  backgroundPrivateServerSupportRefreshSource,
  /\.then\(\(support\) => cacheConfirmedPrivateServerSupport\(support\)\)/,
  "only a confirmed Boolean support response may enter persistent storage"
);
assert.doesNotMatch(
  backgroundPrivateServerSupportRefreshSource,
  /\.catch\([\s\S]*?cacheConfirmedPrivateServerSupport|persistPrivateServerSupportStorage|writePrivateServerSupportStorage/,
  "failed support refreshes must never be persisted"
);
const backgroundPrivateServerSupportMessageSource = backgroundSource.slice(
  backgroundSource.indexOf("function handlePrivateServerSupportMessage("),
  backgroundSource.indexOf("function handlePrivateServerListMessage(")
);
assert.match(
  backgroundPrivateServerSupportMessageSource,
  /price:\s*support\.price/,
  "the validated price must cross the background-to-content runtime response"
);
const backgroundGetPrivateServerSupportSource = backgroundSource.slice(
  backgroundSource.indexOf("async function getPrivateServerSupport("),
  backgroundSource.indexOf("async function fetchPrivateServersPage(")
);
assert.match(
  backgroundGetPrivateServerSupportSource,
  /if \(staleEntry\) \{[\s\S]*?refreshPrivateServerSupport\(normalizedPlaceId, "refresh"\)[\s\S]*?return makePrivateServerSupportResult\(staleEntry, true\);/,
  "stale support must return immediately while a low-priority refresh runs"
);
assert.doesNotMatch(
  backgroundGetPrivateServerSupportSource,
  /cacheConfirmedPrivateServerSupport|persistPrivateServerSupportStorage|writePrivateServerSupportStorage/,
  "serving stale support must not rewrite persistent storage"
);
assert.match(backgroundSource, /rsl:get-private-server-owner-thumbnails/);
assert.match(backgroundSource, /fetchAvatarHeadshots\(userIds\)/);
assert.match(backgroundSource, /thumbnails: userIds\.map/);
assert.match(backgroundSource, /gameJoinRestricted/);
const sanitizePrivateServerListSource = backgroundSource.slice(
  backgroundSource.indexOf("function sanitizePrivateServerList("),
  backgroundSource.indexOf("function setBoundedPrivateServerSupportCache(")
);
assert.match(sanitizePrivateServerListSource, /playing > maxPlayers/);
assert.doesNotMatch(
  sanitizePrivateServerListSource,
  /playing >= maxPlayers/,
  "full private servers must remain in the sanitized result"
);
assert.match(sanitizePrivateServerListSource, /servers\.push\(/);
assert.match(backgroundSource, /function isTrustedRobloxPageUrl\(rawUrl\)/);
assert.match(backgroundSource, /url\.hostname === "www\.roblox\.com"/);
assert.match(backgroundSource, /sender\?\.frameId !== 0/);
assert.match(backgroundSource, /!isTrustedRobloxPageUrl\(sender\.tab\.url\)/);
assert.match(backgroundSource, /!isTrustedRobloxPageUrl\(sender\.url\)/);
assert.match(backgroundSource, /message\?\.type !== PRIVATE_SERVER_JOIN_MESSAGE_TYPE/);
assert.match(backgroundSource, /chrome\.scripting\.executeScript\(\{/);
assert.match(backgroundSource, /target: \{ tabId, frameIds: \[0\] \}/);
assert.match(backgroundSource, /world: "MAIN"/);
assert.match(backgroundSource, /args: \[Number\(placeId\), accessCode\]/);
assert.match(
  backgroundSource,
  /globalThis\.Roblox\.GameLauncher\.joinPrivateGame\(\s*placeId,\s*accessCode,\s*""\s*\)/s,
  "the privileged top-frame injection must call joinPrivateGame(placeId, accessCode, '')"
);
assert.doesNotMatch(
  backgroundSource,
  /chrome\.storage\.local\.(?:get|set)\(\{[^}]*accessCode/is
);
assert.doesNotMatch(
  backgroundSource,
  /console\.(?:log|info|debug|warn|error)\([^)]*accessCode/is
);

assert.match(bridgeSource, /event\.isTrusted !== true/);
assert.match(bridgeSource, /function handleTrustedQuickPlayClick\(event\)/);
assert.match(bridgeSource, /event\.button !== 0/);
assert.match(bridgeSource, /button\.localName !== "button"/);
assert.match(bridgeSource, /button\.closest\(`\[\$\{QUICK_PLAY_SURFACE_ATTRIBUTE\}\]`\)/);
assert.match(bridgeSource, /Roblox\?\.GameLauncher/);
assert.match(bridgeSource, /joinMultiplayerGame/);
assert.match(bridgeSource, /joinGameInstance/);
assert.match(bridgeSource, /random-server-request:v1/);
assert.match(bridgeSource, /random-server-response:v1/);
assert.match(bridgeSource, /Reflect\.apply\(joinMultiplayerGame, gameLauncher, \[placeId\]\)/);
assert.match(bridgeSource, /roblox:\/\/experiences\/start\?placeId=\$\{placeId\}/);
assert.match(bridgeSource, /event\.stopImmediatePropagation\(\)/);
assert.doesNotMatch(
  bridgeSource,
  /private[- ]server|privateServer|joinPrivateGame|accessCode/i,
  "MAIN-world page bridge must not contain private-server events, codes, or launch logic"
);

const quickPlayStyles = stylesSource.slice(
  stylesSource.indexOf("/* Quick Play is mounted"),
  stylesSource.indexOf("@media (forced-colors: active)")
);

assert.match(quickPlayStyles, /\[data-rsl-quick-play-host\]:is\(:hover, :focus-within\)/);
assert.match(quickPlayStyles, /transform: translateY\(calc\(100% \+ 8px\)\)/);
assert.match(quickPlayStyles, /contain: paint/);
assert.doesNotMatch(quickPlayStyles, /will-change: transform/);
assert.doesNotMatch(quickPlayStyles, /translate3d/);
assert.match(stylesSource, /data-rsl-quick-play-layout="wide"/);
assert.match(stylesSource, /\.rsl-quick-play-button\.btn-common-play-game-lg\.btn-full-width\s*\{[^}]*box-sizing: border-box !important;[^}]*width: 50px !important;[^}]*transform: scale\(0\.68\)/s);
assert.match(stylesSource, /\.rsl-private-server-button\s*\{[^}]*display: none !important;/s);
assert.match(stylesSource, /data-rsl-private-server-layout="three"/);
assert.match(
  stylesSource,
  /data-rsl-private-server-layout="three"[^}]*\.rsl-quick-play-button\[data-rsl-quick-play-action="play"\]\s*\{[^}]*flex: 0 0 72px !important;[^}]*width: 72px !important;[^}]*margin: -8px -11px !important;/s
);
assert.match(stylesSource, /data-rsl-private-server-layout="three"[^}]*\.rsl-quick-play-actions\s*\{[^}]*gap: 5px;/s);
assert.match(stylesSource, /data-rsl-quick-play-action-size="wide"/);
assert.match(stylesSource, /data-rsl-quick-play-action-size="wide"\]\[data-rsl-private-server-layout="three"\][^}]*data-rsl-quick-play-action="play"[^}]*\{[^}]*margin: -4px -7px !important;/s);
assert.match(stylesSource, /data-rsl-quick-play-action="play"\] > \.icon-common-play\s*\{[^}]*left: 50% !important;[^}]*margin: 0 !important;[^}]*transform: translate\(-50%, -50%\) scale\(0\.75\) !important;/s);
assert.doesNotMatch(stylesSource, /rsl-quick-play-play-icon/);
assert.match(stylesSource, /\.rsl-random-server-icon svg/);
assert.match(
  stylesSource,
  /\.rsl-random-server-icon\s*\{[^}]*position: absolute;[^}]*inset: 0;[^}]*margin: auto;/s
);
assert.match(
  stylesSource,
  /--rsl-random-server-cutout:\s*var\(--color-action-emphasis-background, #335fff\)/
);
assert.doesNotMatch(stylesSource, /--rsl-random-server-cutout:\s*rgb\(0 0 0 \/ 58%\)/);
assert.match(stylesSource, /\.rsl-private-server-icon svg/);
assert.match(
  stylesSource,
  /\.rsl-private-server-icon\s*\{[^}]*position: absolute;[^}]*inset: 0;[^}]*margin: auto;/s
);
assert.match(stylesSource, /\.rsl-private-servers-dialog__list/);
assert.match(stylesSource, /\.rsl-private-servers-dialog__row/);
assert.match(stylesSource, /\.rsl-private-servers-dialog__game-icon/);
assert.match(stylesSource, /\.rsl-private-servers-dialog__owner-avatar/);
assert.match(stylesSource, /@keyframes rsl-thumbnail-shimmer/);
assert.match(
  stylesSource,
  /data-rsl-thumbnail-state="loading"[\s\S]*?::after[\s\S]*?animation: rsl-thumbnail-shimmer/,
  "private-server image placeholders must use the Roblox-style moving shine"
);
assert.match(stylesSource, /\.rsl-private-servers-dialog__game-link/);
assert.match(stylesSource, /\.rsl-private-servers-dialog__owner-link/);
assert.match(stylesSource, /\.rsl-private-servers-dialog__price/);
assert.match(stylesSource, /\.rsl-private-servers-dialog__search/);
assert.match(stylesSource, /\.rsl-private-servers-dialog__search-input/);
assert.match(stylesSource, /data-rsl-private-servers-page-link/);
assert.match(
  stylesSource,
  /\.rsl-private-servers-dialog__footer \[data-rsl-private-servers-page-link\]\s*\{[^}]*margin-inline-end:\s*auto;/s,
  "View Private Servers must occupy the far-left footer position"
);
assert.match(stylesSource, /\.rsl-private-servers-dialog__join/);
assert.match(stylesSource, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(
  stylesSource,
  /@media \(prefers-reduced-motion: reduce\)[\s\S]*?data-rsl-thumbnail-state="loading"[\s\S]*?animation: none/,
  "thumbnail shimmer must stop when reduced motion is requested"
);
assert.match(stylesSource, /:has\(\.ropro-card-quick-play\)/);

assert.match(visualFixtureSource, /data-rsl-private-server-layout="three"/);
assert.match(visualFixtureSource, /data-rsl-quick-play-action="private"/);
assert.match(visualFixtureSource, />Private Servers<|aria-label="Private Servers/);
assert.match(visualFixtureSource, /Private Servers unsupported card/);
const unsupportedFixtureSource = visualFixtureSource.slice(
  visualFixtureSource.indexOf('data-rsl-quick-play-host="321"')
);
assert.match(
  unsupportedFixtureSource,
  /data-rsl-quick-play-action="private"[^>]*hidden/
);
assert.doesNotMatch(unsupportedFixtureSource, /data-rsl-private-server-layout="three"/);
assert.doesNotMatch(visualFixtureSource, /accessCode/i);
assert.match(privateServerDialogVisualFixtureSource, /rsl-private-servers-dialog__game-icon/);
assert.match(privateServerDialogVisualFixtureSource, /rsl-private-servers-dialog__owner-avatar/);
assert.match(privateServerDialogVisualFixtureSource, /rsl-private-servers-dialog__game-link/);
assert.match(privateServerDialogVisualFixtureSource, /rsl-private-servers-dialog__owner-link/);
assert.match(
  privateServerDialogVisualFixtureSource,
  /data-rsl-private-servers-price>Server cost: 400 Robux \/ month<\/p>/
);
assert.match(
  privateServerDialogVisualFixtureSource,
  /type="search"[^>]*placeholder="Search private servers"[^>]*data-rsl-private-servers-search/
);
assert.match(privateServerDialogVisualFixtureSource, /data-rsl-private-servers-page-link>View Private Servers<\/a>/);
assert.match(privateServerDialogVisualFixtureSource, /5 private servers available/);
const privateServerFixtureFooter = privateServerDialogVisualFixtureSource.slice(
  privateServerDialogVisualFixtureSource.indexOf("rsl-private-servers-dialog__footer")
);
assert.ok(
  privateServerFixtureFooter.indexOf("View Private Servers") <
    privateServerFixtureFooter.indexOf(">Close<"),
  "the visual fixture must show View Private Servers before Close"
);
assert.doesNotMatch(privateServerDialogVisualFixtureSource, /Load more/);
assert.doesNotMatch(privateServerDialogVisualFixtureSource, /accessCode/i);

assert.match(readme, /\*\*Private Servers\*\* on the left/);
assert.match(readme, /wider primary \*\*Quick Play\*\* in the center/);
assert.match(readme, /\*\*Random Server\*\*/);
assert.match(readme, /View Private Servers/);
assert.match(readme, /retain the available enabled actions that fit safely/);
assert.match(readme, /all three Show switches default on/);
assert.match(readme, /private servers returned by Roblox for the signed-in account/);
assert.match(readme, /does not claim that list inclusion proves access/);
assert.match(readme, /at least 144 CSS pixels wide/);
assert.match(readme, /larger scale from 172 CSS pixels upward/);
assert.match(readme, /experience icon and current game-wide creation price in its header/);
assert.match(readme, /full-width local search filters the loaded list/);
assert.match(readme, /each owner's avatar/);
assert.match(readme, /linked experience name opens its game page/);
assert.match(readme, /owner with a public user ID links to their profile/);
assert.match(
  readme,
  /always-visible \*\*View Private Servers\*\* button stays at the far left of the footer/
);
assert.match(readme, /disabled \*\*Full\*\* button/);
assert.match(readme, /restriction remains active across every loaded page/);
assert.match(readme, /isolated content script sends the selected access code directly to RoTool's background worker/);
assert.match(readme, /top frame of an exact `https:\/\/www\.roblox\.com\/\*` page/);
assert.match(readme, /minimal one-shot MAIN-world injection/);
assert.match(readme, /never passes through a page DOM event/);
assert.match(readme, /Uses the `scripting` permission/);
assert.match(readme, /three-tier server-and-die icon/);
assert.match(readme, /small square cards, wide featured cards, and large landscape cards/);
assert.match(readme, /real primary click/);

console.log("PASS RoTool Quick Play, Private Servers, Random Server, launch, coexistence, and documentation contract");
