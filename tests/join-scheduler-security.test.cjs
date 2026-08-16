"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const background = fs.readFileSync(path.join(projectRoot, "background.js"), "utf8");
const content = fs.readFileSync(path.join(projectRoot, "content.js"), "utf8");
const controller = fs.readFileSync(path.join(projectRoot, "join-scheduler.js"), "utf8");
const template = fs.readFileSync(path.join(projectRoot, "join-scheduler.html"), "utf8");
const readme = fs.readFileSync(path.join(projectRoot, "README.md"), "utf8");

function sourceBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.notEqual(start, -1, `missing ${startNeedle}`);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.notEqual(end, -1, `missing ${endNeedle}`);
  return source.slice(start, end);
}

assert.match(background, /const JOIN_SCHEDULER_DB_NAME = "rslJoinSchedulerV1"/);
assert.match(background, /indexedDB\.open\(\s*JOIN_SCHEDULER_DB_NAME/);
assert.match(background, /createObjectStore\(\s*JOIN_SCHEDULER_DESTINATIONS_STORE/);
assert.match(background, /createObjectStore\(\s*JOIN_SCHEDULER_SCHEDULES_STORE/);
assert.match(background, /JOIN_SCHEDULER_MAX_ACCOUNTS = 8/);
assert.match(background, /JOIN_SCHEDULER_MAX_DESTINATIONS = 30/);
assert.match(background, /JOIN_SCHEDULER_MAX_SCHEDULES = 50/);

// Background responses expose only opaque destination identity and labels.
const destinationSanitizer = sourceBetween(
  background,
  "function sanitizeJoinSchedulerDestination",
  "function sanitizeJoinSchedulerSchedule"
);
for (const secretName of [
  "secret", "canonicalUrl", "accessCode", "shareCode",
  "privateServerLinkCode", "url"
]) {
  assert.doesNotMatch(
    destinationSanitizer,
    new RegExp(`(?:^|[^A-Za-z])${secretName}\\s*:`),
    `sanitized destinations must not return ${secretName}`
  );
}
assert.match(destinationSanitizer, /id: destination\.id/);
assert.match(destinationSanitizer, /label: destination\.label/);
assert.match(destinationSanitizer, /type: destination\.type/);

const scheduleSanitizer = sourceBetween(
  background,
  "function sanitizeJoinSchedulerSchedule",
  "async function readJoinSchedulerAccountState"
);
assert.doesNotMatch(scheduleSanitizer,
  /thumbnail|iconUrl|imageUrl|dataUrl|privateServerLinkCode|accessCode|shareCode|canonicalUrl|secret/i,
  "icons are neither persisted in nor exposed through the schedule schema");

const gameIconResponse = sourceBetween(
  background,
  "async function getJoinSchedulerGameIconsResponse",
  "function pruneJoinSchedulerOrphanPublicDestinations"
);
assert.match(gameIconResponse,
  /messageKeys\.length === 4[\s\S]*?"requestId"[\s\S]*?"type"[\s\S]*?"universeIds"[\s\S]*?"viewerUserId"/,
  "the read operation accepts one exact public-ID payload shape");
assert.match(gameIconResponse,
  /getJoinSchedulerViewerUserId\(message, true\)[\s\S]*?getJoinSchedulerGameIcons\(universeIds\)[\s\S]*?assertJoinSchedulerFeatureEnabled\(true\)[\s\S]*?getJoinSchedulerViewerUserId\(\{ viewerUserId \}, true\)/,
  "feature and viewer authority are rechecked around icon networking");
assert.doesNotMatch(gameIconResponse,
  /placeId|gameName|title|startAt|destination|private|secret|url/i);

const notificationIconBoundary = sourceBetween(
  background,
  "function settleJoinSchedulerGameIconBeforeDeadline",
  "async function clearJoinSchedulerAlarm"
);
assert.match(notificationIconBoundary,
  /getJoinSchedulerNotificationGameIconDataUrl\([\s\S]*?schedule\.universeId/,
  "the worker derives a notification icon from the stored universe identity");
assert.match(notificationIconBoundary,
  /data:\$\{mimeType\};base64,/,
  "only locally encoded bounded bytes are passed as the game image");
assert.match(notificationIconBoundary,
  /hasJoinSchedulerNotificationAuthority\(schedule\.accountId\)[\s\S]*?chrome\.notifications\.create/,
  "authority is freshly rechecked after optional image loading and before creation");
assert.doesNotMatch(notificationIconBoundary,
  /chrome\.(?:tabs|windows|scripting)\.|window\.open|page-bridge|privateServerLinkCode|accessCode|shareCode|canonicalUrl/i,
  "image hydration cannot launch a browser surface or disclose a private bearer");

// Reject an oversized raw value before URL parsing, then accept only the two
// strict official www.roblox.com private-server forms.
const privateUrlParser = sourceBetween(
  background,
  "function parseJoinSchedulerDestinationUrl",
  "function normalizeJoinSchedulerDestinationRecord"
);
const rawLimitIndex = privateUrlParser.indexOf(
  "rawUrl.length > JOIN_SCHEDULER_PRIVATE_URL_MAX_LENGTH"
);
const newUrlIndex = privateUrlParser.indexOf("new URL(rawUrl)");
assert.ok(rawLimitIndex >= 0 && newUrlIndex > rawLimitIndex,
  "the 2048-byte raw bound is enforced before URL allocation/parsing");
assert.match(privateUrlParser, /url\.protocol !== "https:"/);
assert.match(privateUrlParser, /url\.hostname !== "www\.roblox\.com"/);
assert.match(privateUrlParser, /url\.port !== ""/);
assert.match(privateUrlParser, /url\.username !== ""/);
assert.match(privateUrlParser, /url\.password !== ""/);
assert.match(privateUrlParser, /url\.hash !== ""/);
assert.match(privateUrlParser, /new Set\(names\)\.size !== names\.length/);
assert.match(privateUrlParser, /UNKNOWN_URL_PARAMETER/);
assert.match(privateUrlParser, /privateServerLinkCode/);
assert.match(privateUrlParser, /url\.pathname === "\/share"/);
assert.match(privateUrlParser, /url\.searchParams\.get\("type"\) !== "Server"/);

// Public Roblox integration may hand the controller an Event draft, but it
// never constructs, reads, or forwards a private bearer value.
const openIntegration = sourceBetween(
  content,
  "async function openJoinScheduler",
  "function makeJoinSchedulerSidebarRow"
);
assert.doesNotMatch(
  openIntegration,
  /privateServerLinkCode|accessCode|shareCode|canonicalUrl|private-url|data-private-url/i
);
assert.doesNotMatch(openIntegration, /chrome\.storage\.|chrome\.runtime\.sendMessage/);
const eventIntegration = sourceBetween(
  content,
  "function renderGameEventItem",
  "function renderGameEventsFilters"
);
assert.doesNotMatch(
  eventIntegration,
  /privateServerLinkCode|accessCode|shareCode|canonicalUrl|private-url|data-private-url/i
);

// The isolated content controller owns the only transient secret-entry path.
// It does not persist, bridge, log, or render the bearer value as markup.
for (const forbidden of [
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bindexedDB\b/,
  /chrome\.storage\./,
  /\bconsole\.(?:log|info|debug|warn|error)\s*\(/,
  /window\.postMessage\s*\(/,
  /dispatchEvent\s*\(/,
  /insertAdjacentHTML\s*\(/,
  /\.innerHTML\s*=/,
  /window\.open\s*\(/,
  /chrome\.windows\./,
  /chrome\.permissions\./
]) {
  assert.doesNotMatch(controller, forbidden);
}
assert.match(controller, /host\.attachShadow\(\{\s*mode:\s*"closed"\s*\}\)/);
assert.doesNotMatch(controller, /attachShadow\(\{\s*mode:\s*"open"/);
assert.match(controller, /chrome\.runtime\.sendMessage/,
  "secret operations cross only the isolated content-to-background runtime boundary");
assert.doesNotMatch(template, /data-private-url[^>]*\bvalue\s*=/i);

const ownedParser = sourceBetween(
  controller,
  "function parseOwnedTemplate",
  "function loadModalAssets"
);
assert.match(
  ownedParser,
  /const documentElements\s*=\s*\[[\s\S]*?parsed\.head\?\.children[\s\S]*?parsed\.body\?\.children[\s\S]*?\]/
);
assert.match(ownedParser, /documentElements\.length !== 1/);
assert.match(ownedParser, /documentElements\[0\] !== template/);
assert.match(ownedParser, /script, link, style, iframe, frame, object, embed, base, meta/);
assert.match(ownedParser, /name\.startsWith\("on"\)/);
assert.match(ownedParser, /name === "action"/);
assert.match(ownedParser, /name === "formaction"/);

const assetLoader = sourceBetween(
  controller,
  "async function fetchOwnedResource",
  "function normalizeSchedulerDraft"
);
assert.match(assetLoader, /chrome\.runtime\.getURL\(path\)/);
assert.match(assetLoader, /!response\.ok\s*\|\|\s*response\.url !== url/);
assert.match(assetLoader, /RESOURCE_MAX_BYTES/);
assert.match(assetLoader, /@import\\b\|url\\s\*\\\(/);

// The permission relay contains no account, schedule, destination, or bearer
// payload. Its API helper creates only {type, requestId} for this operation.
const permissionRelay = sourceBetween(
  controller,
  "function requestNotificationPermission",
  "function validateFormSynchronously"
);
assert.match(
  permissionRelay,
  /api\("request-notification-permission",\s*\{\},\s*\{\s*omitViewer:\s*true\s*\}\)/
);
assert.doesNotMatch(
  permissionRelay,
  /viewerUserId|universeId|placeId|scheduleId|destinationId|url|secret|private/i
);

// A private value may appear only in validate/save request construction. It is
// moved out of the closed-shadow password field before either request starts.
// A validated holder may live until Schedule, but errors, interaction changes,
// submit completion, and teardown zero every holder.
const submit = sourceBetween(
  controller,
  "async function submitSchedule",
  "async function validatePrivate"
);
assert.match(submit, /if \(!isTrustedEvent\(event\)\) return;/);
assert.match(submit, /const privateSecret\s*=\s*\{\s*value:/);
assert.match(submit, /pendingPrivateSecret\s*=\s*privateSecret/);
assert.ok(
  submit.indexOf('elements.privateUrlInput.value = ""') < submit.indexOf("await permissionRequest"),
  "submit clears the password DOM before awaiting permission"
);
assert.match(submit, /saveNewPrivateDestination\(privateUrl,\s*submitSnapshot\)/);
assert.match(submit, /finally\s*\{[\s\S]*?privateSecret\.value\s*=\s*""/);

const validate = sourceBetween(
  controller,
  "async function validatePrivate",
  "function confirmAction"
);
assert.match(validate, /validatePrivate\(secretHolder,\s*expectedInteractionEpoch\)/);
assert.match(validate, /const rawUrl = String\(secretHolder\?\.value \|\| ""\)\.trim\(\)/);
assert.match(validate, /url:\s*rawUrl/);
assert.match(validate, /interactionEpoch !== expectedInteractionEpoch/);
assert.match(validate, /pendingValidationSecret !== secretHolder/);
assert.match(validate, /finally\s*\{[\s\S]*?if \(!retainSecret\)[\s\S]*?secretHolder\.value\s*=\s*""/);

const invalidation = sourceBetween(
  controller,
  "function invalidateInteraction",
  "function isTrustedEvent"
);
assert.match(invalidation, /pendingPrivateSecret\.value\s*=\s*""/);
assert.match(invalidation, /pendingPrivateSecret\s*=\s*null/);
assert.match(invalidation, /pendingValidationSecret\.value\s*=\s*""/);
assert.match(invalidation, /pendingValidationSecret\s*=\s*null/);
const viewSwitch = sourceBetween(
  controller,
  "function setSchedulerView",
  "function clearAccountSurface"
);
assert.match(
  viewSwitch,
  /activeView === "editor" && nextView === "list"[\s\S]*?invalidateInteraction\(\)[\s\S]*?clearPrivateEntry\(\)[\s\S]*?clearSearch\(\)/,
  "leaving the editor zeroes private closure cells and password/search DOM before showing the list"
);
assert.match(viewSwitch, /if \(viewChanged\) viewEpoch \+= 1/,
  "view transitions invalidate every async editor snapshot");
const showSelectedGame = sourceBetween(
  controller,
  "function showSelectedGame",
  "function resetEditor"
);
assert.match(
  showSelectedGame,
  /selectedGame\.universeId !== game\.universeId[\s\S]*?selectedGame\.placeId !== game\.placeId[\s\S]*?clearPrivateEntry\(\)[\s\S]*?selectedGame = game/,
  "a game identity change cannot retain a private link validated or typed for another game"
);
const destroy = sourceBetween(
  controller,
  "function destroyScheduler",
  "return Object.freeze"
);
assert.match(destroy, /invalidateInteraction\(\)/);
assert.match(destroy, /elements\.privateUrlInput\.value\s*=\s*""/);

// No mutation can be reached from a synthetic content-world event, including
// a forged inline-confirmation click. Permission is the first privileged
// operation and is still called synchronously by the real submit gesture.
const listeners = sourceBetween(
  controller,
  "queryAll(\"[data-action='new-schedule']\")",
  "const zone = Intl.DateTimeFormat"
);
const validateClick = sourceBetween(
  listeners,
  "query(\"[data-action='validate-private']\")",
  "elements.testPrivate.addEventListener"
);
assert.match(validateClick, /const secretHolder = \{\s*value:\s*elements\.privateUrlInput\.value\.trim\(\)\s*\}/);
assert.match(validateClick, /pendingValidationSecret\s*=\s*secretHolder/);
assert.ok(
  validateClick.indexOf('elements.privateUrlInput.value = ""') <
    validateClick.indexOf("validatePrivate(secretHolder, interactionEpoch)"),
  "Check Link clears the password DOM before starting validation"
);
const changeGame = sourceBetween(
  controller,
  'query("[data-action=\'change-game\']")',
  'query("[data-action=\'validate-private\']")'
);
assert.match(
  changeGame,
  /invalidateInteraction\(\)[\s\S]*?clearPrivateEntry\(\)[\s\S]*?selectedGame = null/,
  "Change synchronously zeroes closure-held and DOM-held private data before releasing game identity"
);
for (const actionPattern of [
  /data-action=['"]validate-private['"][\s\S]*?isTrustedEvent\(event\)[\s\S]*?validatePrivate/,
  /elements\.testPrivate\.addEventListener\("click"[\s\S]*?isTrustedEvent\(event\)[\s\S]*?testPrivateDestination/,
  /elements\.deletePrivate\.addEventListener\("click"[\s\S]*?isTrustedEvent\(event\)[\s\S]*?deletePrivateDestination/,
  /elements\.list\.addEventListener\("click"[\s\S]*?isTrustedEvent\(event\)[\s\S]*?handleScheduleAction/
]) {
  assert.match(listeners, actionPattern);
}
const confirm = sourceBetween(
  controller,
  "function confirmAction",
  "async function handleScheduleAction"
);
assert.match(confirm, /confirmAction\(title, copy, actionLabel, origin, guard = null\)/);
assert.match(confirm, /destroyed[\s\S]*?pendingConfirmation[\s\S]*?!origin\?\.isConnected[\s\S]*?!elements\.schedulerDialog\.open/);
assert.match(confirm, /origin\.append\(elements\.inlineConfirm\)/);
assert.match(confirm, /interactionEpoch[\s\S]*?viewEpoch[\s\S]*?view: activeView[\s\S]*?viewerUserId: state\.viewerUserId/);
const settleConfirm = sourceBetween(
  controller,
  "function settleInlineConfirmation",
  "function setSchedulerView"
);
assert.match(
  settleConfirm,
  /confirmed[\s\S]*?!destroyed[\s\S]*?root\.host\?\.isConnected === true[\s\S]*?activeView === pending\.view[\s\S]*?viewEpoch === pending\.viewEpoch[\s\S]*?interactionEpoch === pending\.interactionEpoch[\s\S]*?state\.viewerUserId === pending\.viewerUserId[\s\S]*?!pending\.guard \|\| pending\.guard\(\)/
);
assert.match(settleConfirm, /pending\.resolve\(accepted\)/);
assert.match(
  controller,
  /elements\.confirmAction\.addEventListener\("click",\s*\(event\) => \{[\s\S]*?isTrustedEvent\(event\)[\s\S]*?settleInlineConfirmation\(true\)/
);
assert.match(
  controller,
  /elements\.confirmCancel\.addEventListener\("click",\s*\(event\) => \{[\s\S]*?isTrustedEvent\(event\)[\s\S]*?settleInlineConfirmation\(false\)/
);
assert.doesNotMatch(controller, /returnValue|data-confirm-dialog|confirmDialog/);
const permissionCall = submit.indexOf("requestNotificationPermission()");
assert.ok(permissionCall >= 0 && submit.indexOf("await ") > permissionCall);

// All mutable submit context is snapshotted before permission yields, and the
// account/editor epoch is checked before saving or applying later responses.
assert.match(submit, /const submitSnapshot = Object\.freeze\(\{/);
assert.match(submit, /game:\s*Object\.freeze\(\{\s*\.\.\.selectedGame\s*\}\)/);
assert.match(submit, /officialDraft:\s*officialDraft\s*\?\s*Object\.freeze\(\{\s*\.\.\.officialDraft\s*\}\)/);
for (const field of [
  "viewerUserId", "expectedRevision", "confirmUnverified",
  "allowSwitch", "autoJoinConsent"
]) {
  assert.match(submit, new RegExp(`\\b${field}:`));
}
assert.match(submit, /\n\s*viewEpoch,\s*\n/);
assert.match(submit, /interactionEpoch === submitSnapshot\.epoch/);
assert.match(submit, /activeView === "editor"/);
assert.match(submit, /viewEpoch === submitSnapshot\.viewEpoch/);
assert.match(submit, /state\.viewerUserId === submitSnapshot\.viewerUserId/);
assert.ok((submit.match(/if \(!contextIsCurrent\(\)\) return;/g) || []).length >= 3);

// Keep the non-cancelable runtime-message policy: only read operations use a
// local watchdog, while writes and launches wait for the background result.
const timeoutPolicy = sourceBetween(
  controller,
  "const READ_ONLY_MESSAGE_TIMEOUT_MS",
  "const ACTIVE_STATUSES"
);
assert.match(timeoutPolicy, /READ_ONLY_MESSAGE_TIMEOUT_MS = 120_000/);
for (const operation of [
  "request-notification-permission", "save-destination", "delete-destination",
  "create-schedule", "cancel-schedule", "delete-schedule", "join-now", "set-enabled"
]) {
  assert.doesNotMatch(timeoutPolicy, new RegExp(`["']${operation}["']`));
}
assert.match(
  controller,
  /timeoutMs:\s*READ_ONLY_OPERATIONS\.has\(operation\)[\s\S]*?\?\s*READ_ONLY_MESSAGE_TIMEOUT_MS\s*:\s*null/
);
assert.doesNotMatch(
  background,
  /runJoinSchedulerBrowserApi\(\(\)\s*=>\s*chrome\.tabs\.create|runJoinSchedulerBrowserApi\(\(\)\s*=>\s*chrome\.scripting\.executeScript/
);

// Documentation must describe the real user-visible boundary: an in-page
// dialog whose content controller relays to the worker, not a separate page.
assert.match(readme, /in-page[\s\S]{0,100}(?:dialog|window)/i);
assert.match(readme, /content script[\s\S]{0,100}(?:background worker|extension runtime message)/i);
assert.match(readme, /(?:background|extension)-owned IndexedDB/i);
assert.match(readme, /password-style (?:field|input) is cleared/i);
assert.match(readme, /private destinations never fall back to one another/i);
assert.match(readme, /cannot wake a sleeping computer/i);
assert.match(readme, /durable one-shot claim/i);
assert.match(readme, /Roblox receives the official link or code/i);
assert.match(readme, /address bar and history/i);
assert.match(readme, /(?:never|does not)[\s\S]*?send(?:s)? it to a RoTool or unrelated service/i);
assert.doesNotMatch(readme, /separate extension-owned (?:window|page)/i);
assert.doesNotMatch(readme, /never (?:returns the raw link[^.]*sends it through a content-script message|places it in DOM markup|sent to the Roblox content script)/i);

console.log("PASS Join Scheduler closed-shadow secret, gesture, strict URL, storage, and disclosure boundary");
