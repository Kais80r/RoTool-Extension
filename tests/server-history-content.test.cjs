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
    observationCount: 2,
    isCurrent: false,
    ...overrides
  };
}

assert.deepEqual(constants.messageTypes, {
  get: "rsl:get-server-history",
  status: "rsl:check-server-history-status",
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

const normalizedSession = hooks.normalizeServerHistorySession(validSession({
  experienceName: "  Unsafe\n\tName <b>text</b>  ",
  firstSeenAt: NOW + 60_000,
  lastSeenAt: NOW,
  observationCount: 999_999
}));
assert.equal(normalizedSession.name, "Unsafe Name <b>text</b>");
assert.equal(normalizedSession.firstSeenAt, NOW);
assert.equal(normalizedSession.lastSeenAt, NOW + 60_000);
assert.equal(normalizedSession.observationCount, 100_000);
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
assert.equal(normalizedResponse.tracking.state, "in-game");
assert.equal(hooks.normalizeServerHistoryResponse({ ok: false }), null);

const activeStatus = hooks.normalizeServerHistoryStatus({
  ok: true,
  sessionId: "opaque_session_1",
  status: "active",
  playing: 5,
  maxPlayers: 20,
  checkedAt: NOW,
  source: "public-server-list",
  reason: null
}, "opaque_session_1");
assert.equal(activeStatus.status, "active");
assert.equal(activeStatus.playing, 5);
assert.equal(activeStatus.maxPlayers, 20);
assert.equal(
  hooks.normalizeServerHistoryStatus(
    { ...activeStatus, ok: true, sessionId: "wrong_session" },
    "opaque_session_1"
  ),
  null,
  "status responses must be bound to the requested opaque session"
);
assert.equal(
  hooks.normalizeServerHistoryStatus({
    ok: true,
    sessionId: "opaque_session_1",
    status: "ended",
    checkedAt: NOW
  }),
  null,
  "the page must never accept a definitive ended state"
);

assert.equal(hooks.canRejoinServerHistoryStatus(null), true);
assert.equal(hooks.canRejoinServerHistoryStatus({ status: "unknown" }), true);
assert.equal(
  hooks.canRejoinServerHistoryStatus({
    status: "active",
    playing: 20,
    maxPlayers: 20
  }),
  true,
  "a point-in-time full count must not block an explicit later rejoin attempt"
);
assert.match(
  hooks.getServerHistoryUnknownExplanation("not-visible"),
  /may have ended[\s\S]*private[\s\S]*hidden/i
);
assert.match(
  hooks.getServerHistoryUnknownExplanation("list-limited"),
  /outside the public servers Roblox made available/i
);
assert.doesNotMatch(
  hooks.getServerHistoryUnknownExplanation("not-visible"),
  /definitely|shut down|has ended/i
);
assert.equal(hooks.formatServerHistoryDuration(NOW, NOW + 30_000), "under 1 minute");
assert.equal(hooks.formatServerHistoryDuration(NOW, NOW + 5 * 60_000), "5 minutes");

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
assert.match(dialogSource, /aria-describedby/);
assert.match(dialogSource, /role="status" aria-live="polite" aria-atomic="true"/);
assert.match(dialogSource, /aria-label="Latest server sessions"/);
assert.match(dialogSource, /role="alertdialog" aria-modal="false" aria-live="assertive"/);
assert.match(dialogSource, /aria-labelledby="rsl-server-history-clear-confirmation-label"/);
assert.match(dialogSource, /Nothing is uploaded/);
assert.match(dialogSource, /First seen and Last seen/);
assert.match(dialogSource, /not exact join or leave times/);
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
  "Observed recently",
  "Past observation",
  "Server status unknown",
  "Player count unavailable",
  "Active · Player count unavailable",
  "Loading your recent servers…",
  "No servers saved yet"
]) {
  assert.ok(renderSource.includes(copy), `missing truthful Server History UI copy: ${copy}`);
}
assert.doesNotMatch(
  renderSource,
  /Joined at|Left at|Definitely ended|Server shut down|Current session|Session closed/i
);
assert.doesNotMatch(renderSource, /viewerUserId|gameInstanceId|jobId/i);
assert.match(
  renderSource,
  /index === 0[^]*?session[.]isOpen[^]*?serverHistoryTracking[?][.]state === "in-game"/,
  "only the newest open observation backed by current in-game tracking may look recent"
);
assert.match(renderSource, /serverHistorySessions\.forEach/);
assert.match(renderSource, /Full · try anyway/);
assert.match(renderSource, /Try rejoining anyway/);
assert.match(renderSource, /rejoin\.setAttribute\("aria-disabled", String\(rejoinPending\)\)/);
assert.match(renderSource, /focusedSessionId/);
assert.match(renderSource, /restoredControl\?\.focus\?\.\(\{ preventScroll: true \}\)/);
assert.match(renderSource, /checked\.textContent = `Checked \$\{formatServerHistoryTimestamp\(status\.checkedAt\)\}`/);
assert.match(
  renderSource,
  /status\.textContent = serverHistoryNotice/,
  "manual status results must be exposed through the dialog's polite live region"
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
assert.match(asyncSource, /void checkServerHistoryStatus\(newest\.sessionId, false\)/);
assert.match(asyncSource, /forceRefresh: userInitiated === true/);
assert.match(asyncSource, /if \(userInitiated\) \{[\s\S]*?Status updated: Active/);
assert.match(asyncSource, /Status updated: Active[^]*?Player count unavailable/);
assert.match(asyncSource, /Status updated: Server status unknown[^]*?Player count unavailable/);
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
assert.doesNotMatch(
  asyncSource,
  /type: SERVER_HISTORY_REJOIN_MESSAGE_TYPE,[\s\S]{0,180}(?:placeId|gameInstanceId|jobId)/,
  "content must send only the owned opaque session key for rejoin"
);

assert.match(stylesSource, /\.rsl-server-history-dialog \.rsl-server-history__surface/);
assert.match(stylesSource, /width: min\(920px, 100%\)/);
assert.match(stylesSource, /height: min\(760px, calc\(100dvh - 32px\)\)/);
assert.match(stylesSource, /\.rsl-server-history__list[\s\S]*?overflow-y: auto/);
assert.match(stylesSource, /\.rsl-server-history__game-link[\s\S]*?text-overflow: ellipsis/);
assert.match(stylesSource, /\.rsl-server-history__game-link:focus-visible/);
assert.match(stylesSource, /@media \(max-width: 620px\)[\s\S]*?\.rsl-server-history__actions/);
assert.match(stylesSource, /@media \(max-width: 390px\)[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);

assert.match(readme, /\*\*Server History\*\* is an explicit opt-in feature and is off by default/);
assert.match(readme, /latest 30 server sessions/);
assert.match(readme, /roughly once per minute/);
assert.match(readme, /First seen[\s\S]*Last seen/);
assert.match(readme, /approximate observations, not exact join or leave times/);
assert.match(readme, /bounded high- and low-occupancy portions/);
assert.match(readme, /to reduce pressure on its small shared request quota/);
assert.match(readme, /An exact Job ID match can confirm \*\*Active\*\*/);
assert.match(readme, /Server status unknown/);
assert.match(readme, /Player count unavailable/);
assert.match(readme, /may be private, reserved, hidden, outside Roblox's available results, rate-limited, or ended/);
assert.match(readme, /Observed recently[^]*Past observation/);
assert.match(readme, /dialog checks only the newest session automatically/);
assert.match(
  readme,
  /Exact server Job IDs stay out of the dialog and DOM and remain background-owned until an explicit Rejoin/
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
console.log("PASS Server History content, sidebar, dialog, privacy, and documentation contracts");
