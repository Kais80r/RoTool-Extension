"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const contentSource = fs.readFileSync(path.join(root, "content.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");

globalThis.__rslContentTestHooks = { skipInitialize: true };
require(path.join(root, "content.js"));
const hooks = globalThis.__rslContentTestHooks;
const constants = hooks.serverHistoryConstants;
const NOW = 1_700_000_000_000;

function validSession(overrides = {}) {
  return {
    sessionId: "opaque_session_1",
    placeId: "12345",
    universeId: "67890",
    experienceName: "Fixture Experience",
    firstSeenAt: NOW,
    lastSeenAt: NOW + 60_000,
    isCurrent: false,
    ...overrides
  };
}

assert.deepEqual(constants.messageTypes, {
  get: "rsl:get-server-history",
  clear: "rsl:clear-server-history",
  rejoin: "rsl:rejoin-server-history"
});
assert.equal(constants.limit, 30);
assert.equal(hooks.defaultFeatureSettings.serverHistory, false);
assert.equal(hooks.defaultFeatureSettings.sidebarServerHistory, true);
assert.equal(
  hooks.featureSettingDefinitions.find(({ key }) => key === "sidebarServerHistory")
    ?.parentKey,
  "sidebarShortcuts"
);

for (const legacy of [null, { version: 1 }, { version: 1, flags: {} }]) {
  const normalized = hooks.normalizeFeatureSettings(legacy);
  assert.equal(normalized.serverHistory, false, "legacy installs must not silently opt in");
  assert.equal(normalized.sidebarServerHistory, true);
  assert.equal(normalized.quickPlay, true, "existing feature defaults must stay intact");
  assert.equal(normalized.gameCcuHoverGraph, true);
}
const independentlyToggled = hooks.normalizeFeatureSettings({
  version: 1,
  flags: {
    serverHistory: true,
    sidebarServerHistory: false,
    sidebarCustomShortcuts: false,
    sidebarShortcuts: true
  }
});
assert.equal(independentlyToggled.serverHistory, true);
assert.equal(independentlyToggled.sidebarServerHistory, false);
assert.equal(independentlyToggled.sidebarCustomShortcuts, false);
assert.equal(independentlyToggled.sidebarShortcuts, true);
const serialized = hooks.serializeFeatureSettings(independentlyToggled);
assert.equal(serialized.flags.serverHistory, true);
assert.equal(serialized.flags.sidebarServerHistory, false);

assert.equal(hooks.normalizeServerHistoryOpaqueId("safe_A-1"), "safe_A-1");
for (const invalid of ["", " spaced ", "x/y", "<script>", "a".repeat(129)]) {
  assert.equal(hooks.normalizeServerHistoryOpaqueId(invalid), null);
}
assert.equal(hooks.normalizeServerHistoryTimestamp(NOW), NOW);
assert.equal(hooks.normalizeServerHistoryTimestamp(0), null);
assert.equal(hooks.normalizeServerHistoryTimestamp(Number.POSITIVE_INFINITY), null);

const originalDocument = globalThis.document;
globalThis.document = { documentElement: { lang: "de_DE" } };
assert.equal(hooks.getRobloxPageLocale(), "de-DE");
globalThis.document.documentElement.lang = "ZH_hans_cn";
assert.equal(hooks.getRobloxPageLocale(), "zh-Hans-CN");
for (const invalid of [
  "",
  "e",
  "de DE",
  "de-DE\r\nX-Test: injected",
  "*",
  "a".repeat(129)
]) {
  globalThis.document.documentElement.lang = invalid;
  assert.equal(
    hooks.getRobloxPageLocale(),
    "en-US",
    `unsafe page locale must fall back: ${JSON.stringify(invalid)}`
  );
}
globalThis.document.documentElement.lang = "en-US";

const normalizedSession = hooks.normalizeServerHistorySession(validSession({
  experienceName: "  Unsafe\n\tName <b>text</b>  ",
  firstSeenAt: NOW + 60_000,
  lastSeenAt: NOW,
  observationCount: 999_999
}));
assert.equal(normalizedSession.name, "Unsafe Name <b>text</b>");
assert.equal(normalizedSession.firstSeenAt, NOW);
assert.equal(normalizedSession.lastSeenAt, NOW + 60_000);
assert.equal(
  Object.hasOwn(normalizedSession, "observationCount"),
  false,
  "unused observation counts must not enter the content-layer card model"
);
assert.equal(Object.hasOwn(normalizedSession, "viewerUserId"), false);
assert.equal(Object.hasOwn(normalizedSession, "gameInstanceId"), false);
assert.equal(Object.hasOwn(normalizedSession, "jobId"), false);
assert.equal(hooks.normalizeServerHistorySession(validSession({ sessionId: "bad id" })), null);
assert.equal(hooks.normalizeServerHistorySession(validSession({ placeId: "0" })), null);

const unsorted = Array.from({ length: 35 }, (_, index) =>
  validSession({
    sessionId: `session_${index}`,
    lastSeenAt: NOW + index * 60_000,
    firstSeenAt: NOW + index * 60_000
  })
);
unsorted.splice(4, 0, { ...unsorted[3] });
unsorted.splice(8, 0, validSession({ sessionId: "bad id" }));
const normalizedResponse = hooks.normalizeServerHistoryResponse({
  ok: true,
  enabled: true,
  viewerUserId: "should-not-be-kept",
  sessions: unsorted,
  tracking: { state: "in-game", lastCheckedAt: NOW }
});
assert.equal(normalizedResponse.sessions.length, 30);
assert.equal(normalizedResponse.sessions[0].sessionId, "session_29");
assert.equal(normalizedResponse.sessions.at(-1).sessionId, "session_0");
assert.equal(new Set(normalizedResponse.sessions.map(({ sessionId }) => sessionId)).size, 30);
assert.equal(Object.hasOwn(normalizedResponse, "viewerUserId"), false);
assert.equal(
  Object.hasOwn(normalizedResponse, "tracking"),
  false,
  "unused presence state must not enter the content-layer card model"
);
assert.equal(hooks.normalizeServerHistoryResponse({ ok: false }), null);

assert.equal(hooks.formatServerHistoryDuration(NOW, NOW + 30_000), "under 1 minute");
assert.equal(hooks.formatServerHistoryDuration(NOW, NOW + 5 * 60_000), "5 minutes");
assert.equal(hooks.formatServerHistoryCompactDuration(NOW, NOW + 30_000), "<1m");
assert.equal(hooks.formatServerHistoryCompactDuration(NOW, NOW + 5 * 60_000), "5m");
assert.equal(hooks.formatServerHistoryCompactDuration(NOW, NOW + 65 * 60_000), "1h 5m");
assert.equal(hooks.formatServerHistoryCompactTimestamp(Number.NaN), "Unknown");
const compactTimestamp = hooks.formatServerHistoryCompactTimestamp(NOW);
const compactTimeOnly = hooks.formatServerHistoryCompactTimestamp(NOW, true);
assert.notEqual(compactTimestamp, "Unknown");
assert.notEqual(compactTimeOnly, "Unknown");
assert.ok(
  compactTimestamp.length > compactTimeOnly.length,
  "the first compact timestamp keeps a date while same-day Last seen can use time only"
);

function sourceBetween(start, end) {
  const startIndex = contentSource.indexOf(start);
  const endIndex = contentSource.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing source boundary: ${start}`);
  assert.notEqual(endIndex, -1, `missing source boundary: ${end}`);
  return contentSource.slice(startIndex, endIndex);
}

const sidebarSource = sourceBetween(
  "  function makeServerHistorySidebarRow(",
  "  function makeShortcutRow("
);
assert.match(sidebarSource, /row\.id = SERVER_HISTORY_ROW_ID/);
assert.match(sidebarSource, /row\.dataset\.rslControl = "server-history"/);
assert.match(sidebarSource, /anchor\.setAttribute\("aria-haspopup", "dialog"\)/);
assert.match(sidebarSource, /anchor\.setAttribute\("aria-controls", SERVER_HISTORY_DIALOG_ID\)/);
assert.match(sidebarSource, /anchor\.setAttribute\("aria-label", "Server History"\)/);
assert.match(sidebarSource, /if \(event\.isTrusted !== true\) return/);
assert.match(sidebarSource, /!isFeatureEnabled\("serverHistory"\)/);
assert.match(sidebarSource, /!isFeatureEnabled\("sidebarShortcuts"\)/);
assert.match(sidebarSource, /!isFeatureEnabled\("sidebarServerHistory"\)/);
assert.match(sidebarSource, /document\.querySelectorAll\(`#\$\{SERVER_HISTORY_ROW_ID\}`\)/);
assert.match(sidebarSource, /duplicates\.forEach\(\(duplicate\) => duplicate\.remove\(\)\)/);
assert.match(sidebarSource, /firstOwnedCustomRow/);

const mountSource = sourceBetween(
  "  function mountExtensionFeatures(",
  "  function flushFeatureSettingsReconcile("
);
assert.ok(
  mountSource.indexOf("mountServerHistorySidebarRow();") <
    mountSource.indexOf('if (isFeatureEnabled("sidebarCustomShortcuts"))'),
  "the fixed Server History row must mount independently before custom shortcut rows"
);

const dialogSource = sourceBetween(
  "  function createServerHistoryDialog(",
  "  function mountExtensionFeatures("
);
assert.match(dialogSource, /document\.createElement\("dialog"\)/);
assert.match(dialogSource, /aria-labelledby/);
assert.match(dialogSource, /role="status" aria-live="polite" aria-atomic="true"/);
assert.match(dialogSource, /aria-label="Latest server sessions"/);
assert.match(dialogSource, /role="alertdialog" aria-modal="false" aria-live="assertive"/);
assert.match(dialogSource, /aria-labelledby="rsl-server-history-clear-confirmation-label"/);
assert.doesNotMatch(
  dialogSource,
  /RoTool keeps only your latest 30 server sessions|Nothing is uploaded|First seen and Last seen are based on roughly one-minute presence observations|not exact join or leave times/,
  "the dialog header must not expose developer-oriented storage and sampling details"
);
assert.doesNotMatch(
  dialogSource,
  /rsl-server-history-description|rsl-server-history__accuracy|data-rsl-server-history-tracking/,
  "removed explanatory paragraphs must not leave visible placeholder elements"
);
const describedByTarget = dialogSource.match(
  /dialog\.setAttribute\("aria-describedby", "([^"\s]+)"\)/
)?.[1];
if (describedByTarget) {
  assert.ok(
    dialogSource.includes(`id="${describedByTarget}"`),
    "an optional dialog description must not leave a dangling aria-describedby reference"
  );
}
assert.match(dialogSource, /Clear all locally saved Server History for this Roblox account/);
assert.match(dialogSource, /dialog\.showModal\(\)/);
assert.match(
  dialogSource,
  /if \(event\.target !== dialog\) return;[\s\S]*?if \(serverHistoryConfirmClear\)[\s\S]*?else \{\s*closeServerHistoryDialog\(true\)/,
  "a backdrop click must cancel a pending clear before it can close the history dialog"
);
assert.match(
  dialogSource,
  /dialog\.addEventListener\("cancel"[\s\S]*?event\.preventDefault\(\)[\s\S]*?serverHistoryConfirmClear = false/,
  "Escape must cancel a pending destructive confirmation before closing the dialog"
);
assert.match(dialogSource, /dialog\.addEventListener\("close"/);
assert.match(dialogSource, /opener\.focus\(\{ preventScroll: true \}\)/);
assert.match(dialogSource, /cleanupServerHistoryFeature/);

const renderSource = sourceBetween(
  "  function renderServerHistorySession(",
  "  async function loadServerHistory("
);
for (const copy of [
  "First seen",
  "Last seen",
  "Rejoin Server",
  "Loading your recent servers…",
  "No recent servers yet"
]) {
  assert.ok(renderSource.includes(copy), `missing truthful Server History UI copy: ${copy}`);
}
const emptyStateSource = renderSource.match(
  /else if \(serverHistorySessions\.length === 0\) \{([\s\S]*?)list\.append\(empty\);/
)?.[1];
assert.ok(emptyStateSource, "missing the Server History empty-state branch");
assert.match(
  emptyStateSource,
  /empty\.textContent = "No recent servers yet"/,
  "the empty state should be one concise, safely rendered sentence"
);
assert.doesNotMatch(
  emptyStateSource,
  /No servers saved yet|After you opt in|waiting for the next server/i,
  "the empty state must not include developer-oriented tracking instructions"
);
assert.doesNotMatch(
  renderSource,
  /Joined at|Left at|Definitely ended|Server shut down|Current session|Session closed/i
);
assert.doesNotMatch(renderSource, /viewerUserId|gameInstanceId|jobId/i);
assert.match(renderSource, /serverHistorySessions\.forEach/);
assert.match(
  renderSource,
  /const gameName = document\.createElement\("span"\)[\s\S]*?gameName\.className = "rsl-server-history__game-name"[\s\S]*?gameName\.textContent = session\.name[\s\S]*?titleRow\.append\(gameName\)/,
  "the title row should contain only the experience name"
);
assert.doesNotMatch(
  renderSource,
  /sessionState|rsl-server-history__session-state|wasObservedRecently|Observed recently|Past observation|"Recent"|"Past"|rsl-server-history__game-link|gameLink\.href/,
  "the game name must not add a badge or a third interactive card target"
);

const timingSource = renderSource.match(
  /const timing = document\.createElement\("div"\);([\s\S]*?)const actions =/
)?.[1];
assert.ok(timingSource, "missing compact Server History timing row");
assert.equal(
  (timingSource.match(/document\.createElement\("time"\)/g) || []).length,
  2,
  "compact timing must keep semantic First seen and Last seen time elements"
);
assert.match(timingSource, /formatServerHistoryCompactTimestamp\(session\.firstSeenAt\)/);
assert.match(timingSource, /formatServerHistoryCompactTimestamp\([\s\S]*?session\.lastSeenAt,[\s\S]*?sameLocalDay/);
assert.match(timingSource, /formatServerHistoryCompactDuration/);
assert.match(timingSource, /timing\.title = fullTimingText/);
assert.match(timingSource, /timing\.setAttribute\("aria-hidden", "true"\)/);
assert.match(timingSource, /accessibleTiming\.className = "rsl-sr-only"/);
assert.match(timingSource, /accessibleTiming\.textContent = fullTimingText/);
assert.doesNotMatch(
  timingSource,
  /document\.createElement\("strong"\)|for \(const \[label, timestamp\]/,
  "First seen, Last seen, and duration must not render as three stacked fields"
);

assert.match(
  renderSource,
  /main\.append\(titleRow, timing, accessibleTiming\)/,
  "the card body should contain only its title and compact timing"
);
assert.doesNotMatch(
  renderSource,
  /statusLine|rsl-server-history__status|Server status unknown|Player count unavailable|Active ·|Checking server status/,
  "Server History cards must not expose status or player-count UI"
);

const cardActionsSource = renderSource.match(
  /const actions = document\.createElement\("div"\);([\s\S]*?)actions\.append\(open, rejoin\);/
)?.[1];
assert.ok(cardActionsSource, "missing compact Server History actions");
assert.match(cardActionsSource, /open\.textContent = "Open"/);
assert.match(cardActionsSource, /rejoinLabel =[\s\S]*?\? "Opening…"[\s\S]*?: "Rejoin Server"/);
assert.match(cardActionsSource, /open\.setAttribute\("aria-label", `Open \$\{session\.name\}`\)/);
assert.match(cardActionsSource, /rejoin\.setAttribute\([\s\S]*?"aria-label"/);
assert.doesNotMatch(
  cardActionsSource,
  /\bcheck\b|Check status|Checking…|open\.textContent = "Open Experience"|"Full · try anyway"|"Try rejoining anyway"/i,
  "compact cards must expose only Open and Rejoin Server actions"
);
assert.equal(
  (renderSource.match(/document\.createElement\("a"\)/g) || []).length,
  1,
  "Open must be the card's only anchor; Rejoin Server is its only button"
);
assert.match(renderSource, /rejoin\.setAttribute\("aria-disabled", String\(rejoinPending\)\)/);
assert.match(renderSource, /focusedSessionId/);
assert.match(renderSource, /restoredControl\?\.focus\?\.\(\{ preventScroll: true \}\)/);
assert.match(
  renderSource,
  /status\.textContent = serverHistoryNotice/,
  "Server History operation notices must be exposed through the dialog's polite live region"
);
assert.doesNotMatch(
  contentSource,
  /RoTool is waiting for the next server you join|Waiting for the next roughly one-minute presence observation/,
  "tracking internals must not be shown as empty-state helper copy"
);

const asyncSource = sourceBetween(
  "  async function loadServerHistory(",
  "  function resetServerHistoryDialogState("
);
assert.match(
  asyncSource,
  /error\.code = response\?\.errorCode \|\|\s*response\?\.code/,
  "signed-out/unavailable background errorCode must survive to the correct UI state"
);
assert.match(
  asyncSource,
  /type: SERVER_HISTORY_GET_MESSAGE_TYPE,[\s\S]{0,100}locale: getRobloxPageLocale\(\)/,
  "the GET request must send the validated Roblox page locale for Games metadata"
);
assert.doesNotMatch(
  asyncSource,
  /checkServerHistoryStatus|SERVER_HISTORY_STATUS_MESSAGE_TYPE|forceRefresh|Status updated:|Player count unavailable/,
  "loading and interacting with Server History must never request or announce server status"
);
assert.doesNotMatch(
  contentSource,
  /void\s+checkServerHistoryStatus\(|data\.rslServerHistoryAction\s*=\s*"check"/,
  "content must not retain an automatic or user-triggered status-check path"
);
assert.match(
  asyncSource,
  /const expectedSessionId = serverHistorySessions\[0\]\?\.sessionId \|\| null/,
  "Clear history must bind the confirmation to the currently rendered account snapshot"
);
assert.match(asyncSource, /type: SERVER_HISTORY_CLEAR_MESSAGE_TYPE,[\s\S]{0,100}expectedSessionId/);
assert.match(
  asyncSource,
  /normalizeServerHistoryOpaqueId\(response\?\.sessionId\) !== normalizedId/,
  "rejoin responses must be bound to the opaque session that was clicked"
);
assert.match(
  asyncSource,
  /serverHistoryNotice = "That saved history entry is no longer available\."/,
  "a stale rejoin must describe the saved history entry without claiming server status"
);
assert.doesNotMatch(
  asyncSource,
  /That server is no longer available/,
  "rejoin failure copy must not claim knowledge of the server's current status"
);
assert.doesNotMatch(
  asyncSource,
  /type: SERVER_HISTORY_REJOIN_MESSAGE_TYPE,[\s\S]{0,180}(?:placeId|gameInstanceId|jobId)/,
  "content must send only the owned opaque session key for rejoin"
);

assert.match(stylesSource, /\.rsl-server-history-dialog \.rsl-server-history__surface/);
assert.match(stylesSource, /width: min\(920px, 100%\)/);
assert.match(stylesSource, /height: min\(760px, calc\(100dvh - 32px\)\)/);
assert.match(stylesSource, /\.rsl-server-history__list[\s\S]*?overflow-y: auto/);
assert.match(stylesSource, /\.rsl-server-history__game-name[\s\S]*?text-overflow: ellipsis/);
assert.doesNotMatch(stylesSource, /\.rsl-server-history__game-link/);

function cssBlock(marker, source = stylesSource) {
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `missing CSS block: ${marker}`);
  const markerBraceIndex = marker.lastIndexOf("{");
  const openIndex = markerBraceIndex === -1
    ? source.indexOf("{", markerIndex + marker.length)
    : markerIndex + markerBraceIndex;
  assert.notEqual(openIndex, -1, `missing opening brace for CSS block: ${marker}`);
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] !== "}") continue;
    depth -= 1;
    if (depth === 0) return source.slice(openIndex + 1, index);
  }
  assert.fail(`missing closing brace for CSS block: ${marker}`);
}

function pxDeclaration(block, property) {
  const value = block.match(new RegExp(`${property}:\\s*(\\d+)px`))?.[1];
  assert.ok(value, `missing ${property} pixel declaration`);
  return Number(value);
}

const desktopReferenceWidth = 565;
const desktopCardCss = cssBlock(".rsl-server-history__item");
assert.match(desktopCardCss, /display:\s*grid/);
assert.match(desktopCardCss, /min-width:\s*0/);
assert.equal(pxDeclaration(desktopCardCss, "min-height"), 76);
assert.ok(
  pxDeclaration(desktopCardCss, "min-height") <= 100,
  "a Server History card at the 565px desktop reference must stay near one third of the old card"
);
assert.equal(pxDeclaration(desktopCardCss, "padding"), 8);
assert.match(
  desktopCardCss,
  /grid-template-columns:\s*52px\s+minmax\(0,\s*1fr\)\s+max-content/
);
assert.match(desktopCardCss, /align-items:\s*center/);
assert.equal(pxDeclaration(desktopCardCss, "gap"), 10);

const desktopThumbnailCss = cssBlock(".rsl-server-history__thumbnail,");
const desktopThumbnailSize = pxDeclaration(desktopThumbnailCss, "width");
assert.equal(desktopThumbnailSize, 52);
assert.ok(
  desktopThumbnailSize >= 48 && desktopThumbnailSize <= 56,
  "desktop Server History thumbnails must stay in the compact 48–56px range"
);
assert.equal(pxDeclaration(desktopThumbnailCss, "height"), desktopThumbnailSize);

const desktopMainCss = cssBlock(".rsl-server-history__main");
assert.match(desktopMainCss, /min-width:\s*0/);
assert.equal(pxDeclaration(desktopMainCss, "gap"), 1);
assert.doesNotMatch(
  stylesSource,
  /\.rsl-server-history__session-state/,
  "removed Recent/Past badges must not leave compact-card CSS behind"
);
const desktopTimingCss = cssBlock(".rsl-server-history__timing");
assert.match(desktopTimingCss, /overflow:\s*hidden/, "timing must not widen the compact card");
assert.match(desktopTimingCss, /text-overflow:\s*ellipsis/, "timing must ellipsize when narrow");
assert.match(desktopTimingCss, /white-space:\s*nowrap/, "timing must stay on one compact line");
assert.doesNotMatch(
  stylesSource,
  /\.rsl-server-history__status(?:\s|,|\{|--)/,
  "removed server-status UI must not leave card-height CSS behind"
);

const desktopActionsCss = cssBlock(".rsl-server-history__actions");
assert.match(desktopActionsCss, /display:\s*flex/);
assert.match(desktopActionsCss, /min-width:\s*0/);
assert.doesNotMatch(desktopActionsCss, /grid-template-columns|grid-column/);
const desktopActionCss = cssBlock(".rsl-server-history__action {");
assert.equal(pxDeclaration(desktopActionCss, "min-height"), 40);
assert.equal(pxDeclaration(desktopActionCss, "padding-inline"), 9);
assert.match(desktopActionCss, /min-width:\s*0/);
assert.match(desktopActionCss, /overflow:\s*hidden/);
assert.match(desktopActionCss, /white-space:\s*nowrap/);

const phoneBreakpoint = 480;
assert.ok(
  phoneBreakpoint < desktopReferenceWidth,
  "the stacked mobile row must not activate in the 565px desktop screenshot"
);
const phoneCss = cssBlock(`@media (max-width: ${phoneBreakpoint}px)`);
const phoneCardCss = cssBlock(".rsl-server-history__item", phoneCss);
assert.equal(pxDeclaration(phoneCardCss, "min-height"), 108);
assert.ok(
  pxDeclaration(phoneCardCss, "min-height") <= 112,
  "the mobile card floor must remain compact"
);
assert.match(phoneCardCss, /grid-template-columns:\s*44px\s+minmax\(0,\s*1fr\)/);
const phoneThumbnailCss = cssBlock(".rsl-server-history__thumbnail,", phoneCss);
assert.equal(pxDeclaration(phoneThumbnailCss, "width"), 44);
assert.equal(pxDeclaration(phoneThumbnailCss, "height"), 44);
const phoneActionsCss = cssBlock(".rsl-server-history__actions", phoneCss);
assert.match(phoneActionsCss, /display:\s*grid/);
assert.match(phoneActionsCss, /grid-column:\s*1\s*\/\s*-1/);
assert.match(
  phoneActionsCss,
  /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  "the two mobile actions must share one overflow-safe row instead of stacking vertically"
);
const phoneActionCss = cssBlock(".rsl-server-history__action {", phoneCss);
assert.equal(
  pxDeclaration(phoneActionCss, "min-height"),
  44,
  "mobile action targets must remain at least 44px tall"
);
assert.ok(pxDeclaration(phoneActionCss, "min-height") >= 44);
assert.match(phoneActionCss, /padding-inline:\s*6px/);
const narrowPhoneCss = cssBlock("@media (max-width: 390px)");
assert.doesNotMatch(
  narrowPhoneCss,
  /\.rsl-server-history__actions/,
  "very narrow phones must not switch the two actions to an overflowing vertical stack"
);

assert.match(readme, /\*\*Server History\*\* is an explicit opt-in feature and is off by default/);
assert.match(readme, /latest 30 server sessions/);
assert.match(readme, /roughly once per minute/);
assert.match(readme, /first- and last-seen times/);
assert.match(readme, /approximate/);
const serverHistoryReadmeParagraph = readme.match(
  /Server History observes the signed-in account[\s\S]*?(?=\r?\n\r?\n)/
)?.[0];
assert.ok(serverHistoryReadmeParagraph, "missing Server History behavior documentation");
assert.doesNotMatch(
  serverHistoryReadmeParagraph,
  /\*\*Check status\*\*|shows? (?:the )?player count|Server status unknown|\*\*Active\*\*|automatically checks|public-server list|\*\*Recent\*\*|\*\*Past\*\*|Observed recently|Past observation/i,
  "documentation must not promise removed badge, status, or player-count UI"
);
assert.match(serverHistoryReadmeParagraph, /\*\*Open\*\*[^]*\*\*Rejoin Server\*\*/);
assert.doesNotMatch(
  readme,
  /Server History checks a saved Job ID|choose \*\*Check status\*\*/,
  "documentation must not claim Server History still sends status requests"
);
assert.match(
  readme,
  /Exact server Job IDs stay out of the dialog and DOM and remain background-owned until Rejoin/
);
assert.match(readme, /viewer account IDs remain background-only/);
assert.match(readme, /opaque RoTool session key/);
assert.match(readme, /No Server History data is uploaded/);
assert.match(readme, /no inexact deep-link fallback/);
assert.doesNotMatch(
  readme,
  /Experience and server identifiers stay inside extension storage/,
  "documentation must not claim ordinary experience/place metadata stays out of the page"
);

delete globalThis.__rslContentTestHooks;
if (originalDocument === undefined) {
  delete globalThis.document;
} else {
  globalThis.document = originalDocument;
}
console.log("PASS Server History content, sidebar, dialog, privacy, and documentation contracts");
