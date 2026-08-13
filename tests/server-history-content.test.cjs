"use strict";

process.env.TZ = "Europe/Berlin";

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
assert.equal(hooks.formatServerHistoryRelativeLastSeen(Number.NaN, NOW, "en-US"), "Unknown");
assert.equal(hooks.formatServerHistoryRelativeLastSeen(NOW, NOW, "en-US"), "now");
assert.equal(
  hooks.formatServerHistoryRelativeLastSeen(NOW - 59_000, NOW, "en-US"),
  "now"
);
assert.equal(
  hooks.formatServerHistoryRelativeLastSeen(NOW - 60_000, NOW, "en-US"),
  "1m ago"
);
assert.equal(
  hooks.formatServerHistoryRelativeLastSeen(NOW - 30 * 60_000, NOW, "en-US"),
  "30m ago"
);
assert.equal(
  hooks.formatServerHistoryRelativeLastSeen(NOW - 59 * 60_000, NOW, "en-US"),
  "59m ago"
);
assert.equal(
  hooks.formatServerHistoryRelativeLastSeen(NOW - 60 * 60_000, NOW, "en-US"),
  "1h ago"
);
assert.equal(
  hooks.formatServerHistoryRelativeLastSeen(NOW - 23 * 60 * 60_000, NOW, "en-US"),
  "23h ago"
);
assert.equal(
  hooks.formatServerHistoryRelativeLastSeen(NOW - 24 * 60 * 60_000, NOW, "en-US"),
  "1d ago"
);
assert.equal(
  hooks.formatServerHistoryRelativeLastSeen(NOW - 3 * 24 * 60 * 60_000, NOW, "en-US"),
  "3d ago"
);
assert.equal(
  hooks.formatServerHistoryRelativeLastSeen(NOW + 30 * 60_000, NOW, "en-US"),
  "now",
  "future observations caused by clock skew must not claim they happen in the future"
);
assert.equal(
  hooks.formatServerHistoryRelativeLastSeen(NOW - 30 * 60_000, NOW, "de-DE"),
  new Intl.RelativeTimeFormat("de-DE", {
    numeric: "always",
    style: "narrow"
  }).format(-30, "minute"),
  "relative recency must follow the Roblox page locale"
);
assert.equal(hooks.formatServerHistoryCompactTimestamp(Number.NaN), "Unknown");
const compactTimestamp = hooks.formatServerHistoryCompactTimestamp(NOW);
const compactTimeOnly = hooks.formatServerHistoryCompactTimestamp(NOW, true);
assert.notEqual(compactTimestamp, "Unknown");
assert.notEqual(compactTimeOnly, "Unknown");
assert.ok(
  compactTimestamp.length > compactTimeOnly.length,
  "the full compact format remains available for cross-day start timestamps"
);

function localTimestamp(year, monthIndex, day, hour = 12, minute = 0) {
  return new Date(year, monthIndex, day, hour, minute, 0, 0).getTime();
}

const groupingNow = localTimestamp(2026, 7, 13, 15, 30);
const todayTimestamp = localTimestamp(2026, 7, 13, 9, 15);
const yesterdayTimestamp = localTimestamp(2026, 7, 12, 18, 45);
const recentWeekdayTimestamp = localTimestamp(2026, 7, 10, 12);
const olderTimestamp = localTimestamp(2026, 7, 6, 12);
const futureTimestamp = localTimestamp(2026, 7, 14, 12);

assert.equal(
  hooks.formatServerHistoryDateGroupLabel(todayTimestamp, groupingNow, "en-US"),
  "Today"
);
assert.equal(
  hooks.formatServerHistoryDateGroupLabel(yesterdayTimestamp, groupingNow, "en-US"),
  "Yesterday"
);
assert.equal(
  hooks.formatServerHistoryDateGroupLabel(
    recentWeekdayTimestamp,
    groupingNow,
    "en-US"
  ),
  "Monday",
  "dates two through six local calendar days ago use a localized weekday"
);
assert.equal(
  hooks.formatServerHistoryDateGroupLabel(olderTimestamp, groupingNow, "en-US"),
  "August 6, 2026",
  "dates at least seven local calendar days ago use an unambiguous localized date"
);
assert.equal(
  hooks.formatServerHistoryDateGroupLabel(futureTimestamp, groupingNow, "en-US"),
  "August 14, 2026",
  "future dates must not be mislabeled as a recent past day"
);
assert.equal(
  hooks.formatServerHistoryDateGroupLabel(todayTimestamp, groupingNow, "de-DE"),
  "Heute"
);
assert.equal(
  hooks.formatServerHistoryDateGroupLabel(yesterdayTimestamp, groupingNow, "de-DE"),
  "Gestern"
);
assert.equal(
  hooks.formatServerHistoryDateGroupLabel(
    recentWeekdayTimestamp,
    groupingNow,
    "de-DE"
  ),
  "Montag"
);
assert.equal(
  hooks.formatServerHistoryDateGroupLabel(olderTimestamp, groupingNow, "de-DE"),
  "6. August 2026",
  "group labels follow the Roblox page locale instead of the operating-system locale"
);
assert.equal(
  hooks.formatServerHistoryDateGroupLabel(Number.NaN, groupingNow, "en-US"),
  "Unknown date"
);

const springDstStart = localTimestamp(2026, 2, 29, 0);
const springDstEnd = localTimestamp(2026, 2, 30, 0);
assert.equal(
  (springDstEnd - springDstStart) / 3_600_000,
  23,
  "the spring fixture must cover Berlin's short DST day"
);
assert.equal(
  hooks.getServerHistoryLocalDayOrdinal(springDstEnd) -
    hooks.getServerHistoryLocalDayOrdinal(springDstStart),
  1,
  "local calendar ordinals must advance once across a 23-hour day"
);
const autumnDstStart = localTimestamp(2026, 9, 25, 0);
const autumnDstEnd = localTimestamp(2026, 9, 26, 0);
assert.equal(
  (autumnDstEnd - autumnDstStart) / 3_600_000,
  25,
  "the autumn fixture must cover Berlin's long DST day"
);
assert.equal(
  hooks.getServerHistoryLocalDayOrdinal(autumnDstEnd) -
    hooks.getServerHistoryLocalDayOrdinal(autumnDstStart),
  1,
  "local calendar ordinals must advance once across a 25-hour day"
);

const groupedInput = [
  validSession({
    sessionId: "recent_weekday",
    firstSeenAt: localTimestamp(2026, 7, 10, 10),
    lastSeenAt: localTimestamp(2026, 7, 10, 10, 30)
  }),
  validSession({
    sessionId: "today_older",
    firstSeenAt: localTimestamp(2026, 7, 13, 8),
    lastSeenAt: localTimestamp(2026, 7, 13, 9)
  }),
  validSession({
    sessionId: "cross_midnight",
    firstSeenAt: localTimestamp(2026, 7, 11, 23, 55),
    lastSeenAt: localTimestamp(2026, 7, 12, 0, 5)
  }),
  validSession({
    sessionId: "today_newest",
    firstSeenAt: localTimestamp(2026, 7, 13, 10),
    lastSeenAt: localTimestamp(2026, 7, 13, 11)
  }),
  validSession({
    sessionId: "yesterday_newer",
    firstSeenAt: localTimestamp(2026, 7, 12, 17),
    lastSeenAt: yesterdayTimestamp
  })
];
const originalGroupedInputOrder = groupedInput.map(({ sessionId }) => sessionId);
const dateGroups = hooks.groupServerHistorySessionsByDate(
  groupedInput,
  groupingNow,
  "en-US"
);
assert.deepEqual(
  dateGroups.map(({ label }) => label),
  ["Today", "Yesterday", "Monday"]
);
assert.deepEqual(
  dateGroups.map(({ sessions }) => sessions.map(({ sessionId }) => sessionId)),
  [
    ["today_newest", "today_older"],
    ["yesterday_newer", "cross_midnight"],
    ["recent_weekday"]
  ],
  "groups and cards preserve newest-first last-seen ordering"
);
assert.deepEqual(
  dateGroups.flatMap(({ sessions }) => sessions.map(({ sessionId }) => sessionId)),
  [
    "today_newest",
    "today_older",
    "yesterday_newer",
    "cross_midnight",
    "recent_weekday"
  ]
);
assert.equal(
  dateGroups[1].dayOrdinal,
  hooks.getServerHistoryLocalDayOrdinal(yesterdayTimestamp),
  "a cross-midnight stay belongs to its last-observed local day"
);
assert.deepEqual(
  groupedInput.map(({ sessionId }) => sessionId),
  originalGroupedInputOrder,
  "grouping must not mutate the normalized response snapshot"
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
assert.match(dialogSource, /aria-label="Server sessions grouped by date"/);
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
  "Played ",
  "View Game",
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
assert.match(
  renderSource,
  /const renderedAt = Date\.now\(\)[\s\S]*?groupServerHistorySessionsByDate\([\s\S]*?serverHistorySessions,[\s\S]*?renderedAt,[\s\S]*?getRobloxPageLocale\(\)/,
  "one render snapshot must drive every localized date heading"
);
assert.match(renderSource, /groups\.forEach\(\(group\) =>/);
assert.match(
  renderSource,
  /groupItem\.className = "rsl-server-history__date-group"[\s\S]*?heading = document\.createElement\("h3"\)[\s\S]*?heading\.className = "rsl-server-history__date-heading"[\s\S]*?heading\.id = `rsl-server-history-date-/,
  "each group needs a visible semantic heading with a stable local-day id"
);
assert.match(
  renderSource,
  /sessions\.className = "rsl-server-history__date-list"[\s\S]*?sessions\.setAttribute\("aria-labelledby", heading\.id\)[\s\S]*?group\.sessions\.forEach[\s\S]*?groupItem\.append\(heading, sessions\)/,
  "each nested session list must be named by its visible date heading"
);
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
  3,
  "compact timing must keep semantic relative, First seen, and Last seen time elements"
);
assert.match(
  timingSource,
  /const relativeLastSeen = formatServerHistoryRelativeLastSeen\(session\.lastSeenAt\)/,
  "each card must show how long ago its last observation was"
);
assert.match(
  timingSource,
  /const timingSummary = document\.createElement\("div"\)[\s\S]*?timingSummary\.className = "rsl-server-history__timing-summary"[\s\S]*?const relativeTime = document\.createElement\("time"\)[\s\S]*?relativeTime\.className = "rsl-server-history__relative-time"/,
  "relative recency and played duration need their own compact semantic summary line"
);
assert.match(
  timingSource,
  /relativeTime\.dateTime = lastDate\.toISOString\(\)[\s\S]*?relativeTime\.dataset\.rslServerHistoryLastSeenAt = String\(session\.lastSeenAt\)[\s\S]*?relativeTime\.textContent = relativeLastSeen/,
  "the relative label must preserve its exact machine-readable observation time for refreshes"
);
assert.match(
  timingSource,
  /timingSummary\.append\([\s\S]*?relativeTime,[\s\S]*?` · Played \$\{formatServerHistoryCompactDuration\([\s\S]*?session\.firstSeenAt,[\s\S]*?session\.lastSeenAt[\s\S]*?\)\}`[\s\S]*?\)/,
  "the visible summary must pair recency with the amount of time played"
);
assert.match(
  timingSource,
  /const timeRange = document\.createElement\("div"\)[\s\S]*?timeRange\.className = "rsl-server-history__time-range"/,
  "the explicit from–to times need a separate compact line"
);
assert.equal(
  (timingSource.match(/formatServerHistoryCompactTimestamp\([\s\S]*?sameLocalDay[\s\S]*?\)/g) || []).length,
  2,
  "both range endpoints must omit dates only when the session stays within one local day"
);
assert.match(
  timingSource,
  /const sameLocalDay = firstDate\.getFullYear\(\) === lastDate\.getFullYear\(\)[\s\S]*?firstDate\.getMonth\(\) === lastDate\.getMonth\(\)[\s\S]*?firstDate\.getDate\(\) === lastDate\.getDate\(\)/,
  "cross-midnight cards must retain the first timestamp's full date"
);
assert.match(
  timingSource,
  /timeRange\.append\([\s\S]*?firstTime,[\s\S]*?document\.createTextNode\(" – "\),[\s\S]*?lastTime[\s\S]*?\)/,
  "the visible range must read from the first observation to the last observation"
);
assert.match(timingSource, /timing\.append\(timingSummary, timeRange\)/);
assert.match(timingSource, /timing\.title = fullTimingText/);
assert.match(timingSource, /timing\.setAttribute\("aria-hidden", "true"\)/);
assert.match(timingSource, /accessibleTiming\.className = "rsl-sr-only"/);
assert.match(timingSource, /accessibleTiming\.textContent = fullTimingText/);
assert.match(
  timingSource,
  /const fullTimingText =\s*`First seen: \$\{formatServerHistoryTimestamp\(session\.firstSeenAt\)\} · `[\s\S]*?`Last seen: \$\{formatServerHistoryTimestamp\(session\.lastSeenAt\)\} · `[\s\S]*?`Observed for \$\{formatServerHistoryDuration\(/,
  "assistive text and hover text must state both absolute endpoints and the full duration"
);
assert.doesNotMatch(
  timingSource,
  /const fullTimingText =[\s\S]*?relativeLastSeen/,
  "minute refreshes must not leave a stale relative label in the static accessible text or tooltip"
);
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
assert.match(cardActionsSource, /open\.textContent = "View Game"/);
assert.match(cardActionsSource, /rejoinLabel =[\s\S]*?\? "Opening…"[\s\S]*?: "Rejoin Server"/);
assert.match(
  cardActionsSource,
  /const viewGameDescription = `View \$\{session\.name\} game page on Roblox`[\s\S]*?open\.setAttribute\("aria-label", viewGameDescription\)[\s\S]*?open\.title = viewGameDescription/,
  "View Game must explain its Roblox game-page destination to assistive technology and on hover"
);
assert.match(cardActionsSource, /rejoin\.setAttribute\([\s\S]*?"aria-label"/);
assert.doesNotMatch(
  cardActionsSource,
  /\bcheck\b|Check status|Checking…|open\.textContent = "Open(?: Experience)?"|"Full · try anyway"|"Try rejoining anyway"/i,
  "compact cards must expose only the clearly named View Game and Rejoin Server actions"
);
assert.equal(
  (renderSource.match(/document\.createElement\("a"\)/g) || []).length,
  1,
  "View Game must be the card's only anchor; Rejoin Server is its only button"
);
assert.match(renderSource, /rejoin\.setAttribute\("aria-disabled", String\(rejoinPending\)\)/);
assert.match(renderSource, /focusedSessionId/);
assert.match(renderSource, /restoredControl\?\.focus\?\.\(\{ preventScroll: true \}\)/);
assert.match(
  renderSource,
  /status\.textContent = serverHistoryNotice/,
  "Server History operation notices must be exposed through the dialog's polite live region"
);
const relativeRefreshSource = sourceBetween(
  "  function clearServerHistoryRelativeTimeTimer(",
  "  function scheduleServerHistoryMidnightRefresh("
);
assert.match(
  relativeRefreshSource,
  /function refreshServerHistoryRelativeTimes\(\)[\s\S]*?const now = Date\.now\(\)[\s\S]*?querySelectorAll\("\[data-rsl-server-history-last-seen-at\]"\)[\s\S]*?node\.textContent = formatServerHistoryRelativeLastSeen\(lastSeenAt, now\)/,
  "the minute refresh must update only relative labels from one shared time snapshot"
);
assert.doesNotMatch(
  relativeRefreshSource,
  /renderServerHistoryDialog|replaceChildren|innerHTML/,
  "relative-time refreshes must not rebuild cards or disturb focus"
);
assert.match(
  relativeRefreshSource,
  /function scheduleServerHistoryRelativeTimeRefresh\(\)[\s\S]*?clearServerHistoryRelativeTimeTimer\(\)[\s\S]*?60_000 - \(Date\.now\(\) % 60_000\)[\s\S]*?refreshServerHistoryRelativeTimes\(\)[\s\S]*?scheduleServerHistoryRelativeTimeRefresh\(\)/,
  "relative labels must keep updating near minute boundaries while the dialog is open"
);
const resetDialogStateSource = sourceBetween(
  "  function resetServerHistoryDialogState(",
  "  function closeServerHistoryDialog("
);
assert.match(
  resetDialogStateSource,
  /clearServerHistoryRelativeTimeTimer\(\)/,
  "closing or resetting Server History must remove its minute timer"
);
const openDialogSource = sourceBetween(
  "  function openServerHistoryDialog(",
  "  function cleanupServerHistoryFeature("
);
assert.match(
  openDialogSource,
  /dialog\.showModal\(\)[\s\S]*?scheduleServerHistoryRelativeTimeRefresh\(\)/,
  "opening Server History must start the targeted minute refresh"
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
assert.match(desktopTimingCss, /display:\s*grid/);
assert.match(desktopTimingCss, /min-width:\s*0/, "timing must not widen the compact card");
const desktopTimingLineCss = cssBlock(".rsl-server-history__timing-summary,");
assert.match(desktopTimingLineCss, /min-width:\s*0/);
assert.match(desktopTimingLineCss, /overflow:\s*hidden/, "both timing lines must stay inside the compact card");
assert.match(desktopTimingLineCss, /text-overflow:\s*ellipsis/, "both timing lines must ellipsize when narrow");
assert.match(desktopTimingLineCss, /white-space:\s*nowrap/, "each timing detail must stay on one compact line");
const relativeTimeCss = cssBlock(".rsl-server-history__relative-time");
assert.match(relativeTimeCss, /font-weight:\s*600/, "relative recency should remain easy to scan");
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
assert.match(serverHistoryReadmeParagraph, /\*\*View Game\*\*[^]*\*\*Rejoin Server\*\*/);
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
