"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

const projectRoot = path.resolve(__dirname, "..");
const backgroundSource = fs.readFileSync(path.join(projectRoot, "background.js"), "utf8");
const contentSource = fs.readFileSync(path.join(projectRoot, "content.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(projectRoot, "styles.css"), "utf8");
const readme = fs.readFileSync(path.join(projectRoot, "README.md"), "utf8");
const updatingGuide = fs.readFileSync(path.join(projectRoot, "UPDATING.md"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "manifest.json"), "utf8"));

const RELEASE_API =
  "https://api.github.com/repos/Kais80r/RoTool-Extension/releases/latest";
const UPDATE_GUIDE =
  "https://github.com/Kais80r/RoTool-Extension/blob/main/UPDATING.md";
const manifestVersionParts = manifest.version.split(".").map(Number);
const AVAILABLE_VERSION = `${manifestVersionParts[0]}.${manifestVersionParts[1]}.${manifestVersionParts[2] + 1}`;
const REPLACEMENT_VERSION = `${manifestVersionParts[0]}.${manifestVersionParts[1]}.${manifestVersionParts[2] + 2}`;

function sourceBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.notEqual(start, -1, `missing ${startNeedle}`);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.notEqual(end, -1, `missing ${endNeedle}`);
  return source.slice(start, end);
}

function plain(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

const backgroundUpdateSource = sourceBetween(
  backgroundSource,
  "function normalizeExtensionUpdateVersion",
  "function getTrustedRobloxHomeTabId"
);
const contentUpdateSource = sourceBetween(
  contentSource,
  "  let extensionUpdateFeedbackRequestId",
  "  function isInsideRoToolDialog"
);
const updateReadme = sourceBetween(
  readme,
  "## Updating an unpacked copy from GitHub",
  "## Maintaining releases"
);

// The public update surface is fixed, unauthenticated, bounded, and data-only.
assert.match(
  backgroundSource,
  /const EXTENSION_UPDATE_LATEST_RELEASE_URL\s*=\s*\r?\n\s*"https:\/\/api\.github\.com\/repos\/Kais80r\/RoTool-Extension\/releases\/latest";/
);
assert.match(
  backgroundSource,
  /const EXTENSION_UPDATE_HOW_TO_URL\s*=\s*\r?\n\s*"https:\/\/github\.com\/Kais80r\/RoTool-Extension\/blob\/main\/UPDATING\.md";/
);
assert.match(
  contentSource,
  /const EXTENSION_UPDATE_HOW_TO_URL\s*=\s*\r?\n\s*"https:\/\/github\.com\/Kais80r\/RoTool-Extension\/blob\/main\/UPDATING\.md";/
);
assert.match(
  backgroundUpdateSource,
  /fetch\(EXTENSION_UPDATE_LATEST_RELEASE_URL,\s*\{[\s\S]*?method:\s*"GET"[\s\S]*?credentials:\s*"omit"[\s\S]*?redirect:\s*"error"[\s\S]*?referrerPolicy:\s*"no-referrer"/
);
assert.match(backgroundUpdateSource, /EXTENSION_UPDATE_MAX_RESPONSE_BYTES/);
assert.match(backgroundUpdateSource, /payload\.draft !== false/);
assert.match(backgroundUpdateSource, /payload\.prerelease !== false/);
assert.match(backgroundUpdateSource, /payload\.tag_name, true/);
assert.match(backgroundUpdateSource, /JSON\.parse\(body\)/);
assert.doesNotMatch(backgroundUpdateSource, /\.html_url\b|\.zipball_url\b|\.tarball_url\b/);
assert.doesNotMatch(backgroundUpdateSource, /\bAuthorization\b|\.ROBLOSECURITY|access[_-]?token|refresh[_-]?token|password|cookie/i);
assert.doesNotMatch(backgroundUpdateSource, /innerHTML|insertAdjacentHTML|DOMParser|eval\s*\(|new Function/);
assert.doesNotMatch(
  backgroundUpdateSource,
  /chrome\.(?:downloads|notifications|permissions)\.|connectNative|sendNativeMessage|nativeMessaging/i
);
assert.match(contentUpdateSource, /howToUpdate\.href = EXTENSION_UPDATE_HOW_TO_URL/);
assert.doesNotMatch(
  contentUpdateSource,
  /(?:href|src)\s*=\s*status\?*\.howToUpdateUrl|innerHTML|insertAdjacentHTML|DOMParser/,
  "a response URL may be validated against the fixed constant but never assigned to DOM"
);
assert.doesNotMatch(contentUpdateSource, /chrome\.(?:downloads|notifications|permissions)\.|connectNative|sendNativeMessage/i);

// The checker adds no GitHub host grant and promotes no native/download/
// notification capability. Join Scheduler's existing optional notification
// permission remains optional and unrelated.
for (const forbidden of ["nativeMessaging", "downloads", "notifications"]) {
  assert.equal(
    manifest.permissions.includes(forbidden),
    false,
    `update checks must not require ${forbidden}`
  );
}
assert.deepEqual(manifest.optional_permissions, ["notifications"]);
assert.equal(
  manifest.host_permissions.some((entry) => /github(?:usercontent)?\.com/i.test(entry)),
  false,
  "GitHub CORS must not become a broad extension host grant"
);

// The user-facing destination is a dedicated four-step guide, while the
// packaged README stays a small legacy landing point and updater internals
// remain in the separate technical document.
const expectedUpdatingGuide = [
  "# How to update RoTool",
  "",
  "1. Open the same RoTool folder you selected with **Load unpacked**.",
  "2. Open its `updater` folder and double-click `Update RoTool.cmd`.",
  "3. When it finishes, open `edge://extensions` or `chrome://extensions` and press **Reload** on the existing RoTool card.",
  "4. Refresh Roblox.",
  "",
  "Keep the same folder and extension card. Do not remove RoTool, load it again, or move or rename its folder; that can make its saved data appear lost.",
  "",
  "For more details, see the [RoTool Updater guide](updater/README.md)."
].join("\n");
assert.equal(updatingGuide.replace(/\r\n/g, "\n").trim(), expectedUpdatingGuide);
assert.ok(updatingGuide.length < 700, "the normal update guide must stay concise");
assert.deepEqual(
  [...updatingGuide.matchAll(/^(\d+)\.\s+/gm)].map((match) => Number(match[1])),
  [1, 2, 3, 4]
);
assert.doesNotMatch(
  updatingGuide,
  /SHA-?256|checksum|rollback|Secure Preferences|access token|package-files|managed runtime/i,
  "technical updater internals belong in updater/README.md"
);
assert.ok(updateReadme.length < 600, "the packaged README update section must stay a short landing point");
assert.deepEqual([...updateReadme.matchAll(/^(\d+)\.\s+/gm)], []);
assert.match(
  updateReadme,
  /\[How to update RoTool\]\(https:\/\/github\.com\/Kais80r\/RoTool-Extension\/blob\/main\/UPDATING\.md\)/
);
assert.match(updateReadme, /\[technical RoTool Updater guide\]\(updater\/README\.md\)/i);
assert.doesNotMatch(updateReadme, /\]\(UPDATING\.md\)/, "the packaged README must not contain a broken relative guide link");

// Roblox's native system-feedback hierarchy/classes stay authoritative. RoTool
// adds only ownership hooks, a real update link, accessibility, collision
// deferral, and a narrowly gated fallback for pages missing StyleGuide CSS.
assert.match(contentUpdateSource, /"sg-system-feedback rsl-extension-update-feedback"/);
assert.match(contentUpdateSource, /"alert-system-feedback rsl-extension-update-feedback__inner"/);
assert.match(contentUpdateSource, /"alert alert-success on rsl-extension-update-feedback__alert"/);
assert.match(contentUpdateSource, /"alert-content rsl-extension-update-feedback__content"/);
assert.match(contentUpdateSource, /alert\.setAttribute\("role", "status"\)/);
assert.match(contentUpdateSource, /alert\.setAttribute\("aria-live", "polite"\)/);
assert.match(contentUpdateSource, /alert\.setAttribute\("aria-atomic", "true"\)/);
assert.match(contentUpdateSource, /document\.createElement\("a"\)/);
assert.match(contentUpdateSource, /howToUpdate\.textContent = "How to update"/);
assert.match(contentUpdateSource, /howToUpdate\.target = "_blank"/);
assert.match(contentUpdateSource, /howToUpdate\.rel = "noopener noreferrer"/);
assert.match(contentUpdateSource, /const closeControl = document\.createElement\("span"\)/);
assert.match(contentUpdateSource, /closeControl\.setAttribute\("role", "button"\)/);
assert.match(contentUpdateSource, /closeControl\.setAttribute\("tabindex", "0"\)/);
assert.match(contentUpdateSource, /if \(!event\.isTrusted\)\s*\{\s*return;/);
assert.match(
  contentUpdateSource,
  /closeControl\.addEventListener\("keydown",[\s\S]*?event\.key !== "Enter"[\s\S]*?event\.key !== " "[\s\S]*?event\.preventDefault\(\)/
);
assert.match(contentUpdateSource, /`Dismiss RoTool \$\{latest\} update notice`/);
assert.match(
  contentUpdateSource,
  /existing\?\.dataset\.rslExtensionUpdateVersion === latest[\s\S]*?return existing;/
);
assert.match(
  contentUpdateSource,
  /hasNativeExtensionUpdateFeedbackStyles\(inner, alert, closeControl\)[\s\S]*?EXTENSION_UPDATE_FEEDBACK_FALLBACK_CLASS/
);
assert.match(
  contentUpdateSource,
  /document\.querySelectorAll\("\.alert-system-feedback"\)[\s\S]*?extensionUpdateFeedbackNativeObserver\.observe\(surface, \{[\s\S]*?attributeFilter: \["class", "hidden", "style"\][\s\S]*?subtree: true/
);
assert.match(
  contentUpdateSource,
  /"\.alert-system-feedback \.alert\.on"[\s\S]*?\.some\(isActiveNativeSystemFeedbackAlert\)[\s\S]*?feedback\.hidden = shouldDefer/
);
assert.match(
  contentSource,
  /new MutationObserver\(\(mutations\) => \{[\s\S]*?document\.getElementById\(EXTENSION_UPDATE_FEEDBACK_ID\)[\s\S]*?queueExtensionUpdateFeedbackPositionSync\(\)[\s\S]*?observer\.observe\(document\.documentElement, \{[\s\S]*?childList: true[\s\S]*?subtree: true/
);
assert.match(contentUpdateSource, /window\.cancelAnimationFrame\(extensionUpdateFeedbackPositionFrame\)/);
assert.match(contentUpdateSource, /extensionUpdateFeedbackNativeObserver\?\.disconnect\(\)/);
assert.match(contentUpdateSource, /extensionUpdateFeedbackObservedNativeSurfaces = new WeakSet\(\)/);
assert.doesNotMatch(contentUpdateSource, /setInterval|snooze|lease/i);
assert.equal(
  (contentUpdateSource.match(/window\.setTimeout\(/g) || []).length,
  1,
  "the long-lived update lifecycle owns one replaceable timeout"
);
assert.match(
  contentUpdateSource,
  /document\.visibilityState !== "visible"[\s\S]*?return;[\s\S]*?requestExtensionUpdateStatusWhenVisible/
);
assert.match(
  contentUpdateSource,
  /const onVisibleHome = Boolean\([\s\S]*?const popupEnabled = isExtensionUpdatePopupEnabled\(\)[\s\S]*?let claimNotice = popupEnabled && onVisibleHome && allowNoticeClaim/,
  "automatic presentation claims require the master switch, visible Home, and a claiming trigger"
);
assert.match(
  contentUpdateSource,
  /status\?\.updateAvailable[\s\S]*?isExtensionUpdatePopupEnabled\(\)[\s\S]*?extensionUpdateReminderFrequency !== "home"[\s\S]*?status\.nextNoticeAt/,
  "disabled and per-Home popups must not turn a due reminder into a one-minute polling loop"
);
assert.match(
  contentUpdateSource,
  /installed === current &&[\s\S]*?isExtensionUpdatePopupEnabled\(\)[\s\S]*?Boolean\(extensionUpdateHomeVisitId\)[\s\S]*?isHomePage\(\)[\s\S]*?document\.visibilityState === "visible"[\s\S]*?window\.top === window/,
  "DOM creation must re-check the master switch and live visible Home route"
);
assert.match(
  contentUpdateSource,
  /function invalidateExtensionUpdateFeedbackRequest\([\s\S]*?extensionUpdateFeedbackRequestId \+= 1[\s\S]*?extensionUpdateActiveClaimContextId = null[\s\S]*?function applyExtensionUpdatePopupPreferenceTransition\([\s\S]*?invalidateExtensionUpdateFeedbackRequest\(\)/,
  "a popup preference change must make every older in-flight response stale"
);
assert.match(
  contentUpdateSource,
  /const forceRequest = force \|\| extensionUpdateFeedbackClaimWhenVisible[\s\S]*?if \(forceRequest\) \{\s*invalidateExtensionUpdateFeedbackRequest\(\);[\s\S]*?refreshExtensionUpdateFeedback\(\)/,
  "an authoritative re-enable must start a fresh claiming request immediately"
);
const contentHomePathSource = sourceBetween(
  contentSource,
  "  function isRobloxHomePathname(rawPathname)",
  "  function isHomePage()"
);
assert.ok(
  contentHomePathSource.includes('if (/^\\/home\\/?$/.test(pathname))') &&
    contentHomePathSource.includes("NATIVE_EVENT_SCHEDULE_LOCALE_SEGMENTS.has"),
  "content route matching uses the same exact/localized Home contract"
);
assert.match(
  contentUpdateSource,
  /function handleExtensionUpdateNavigationStart[\s\S]*?extensionUpdateNavigationAwayFromHome =[\s\S]*?if \(extensionUpdateHomeVisitClaimRequestPending\) \{[\s\S]*?extensionUpdateHomeVisitClaimAttempted = false;[\s\S]*?extensionUpdateHomeVisitAttemptedLatest = null;[\s\S]*?invalidateExtensionUpdateFeedbackRequest\(\)/,
  "starting a real away navigation invalidates an in-flight claim and makes a canceled navigation retryable"
);
assert.match(
  contentUpdateSource,
  /function handleExtensionUpdateNavigationError\(\)[\s\S]*?extensionUpdateNavigationAwayFromHome = false;[\s\S]*?syncExtensionUpdateHomeVisitState\(\);[\s\S]*?requestExtensionUpdateStatusWhenVisible\(true\)/,
  "a canceled Navigation API transition preserves the Home visit and retries"
);
assert.match(
  contentSource,
  /window\.addEventListener\("pagehide", \(\) => \{[\s\S]*?extensionUpdatePageSuspended = true;[\s\S]*?invalidateExtensionUpdateFeedbackRequest\(\);[\s\S]*?extensionUpdateHomeVisitClaimAttempted = false;[\s\S]*?removeExtensionUpdateFeedback\(\);[\s\S]*?window\.addEventListener\("pageshow", \(event\) => \{[\s\S]*?if \(event\.persisted === true\) \{[\s\S]*?extensionUpdateNavigationAwayFromHome = false;[\s\S]*?freshVisit: restoredHomeVisit[\s\S]*?document\.visibilityState === "visible" && !restoredHomeVisit/,
  "pagehide invalidates the old document; a persisted Home restore clears stale away state and starts exactly one fresh visit"
);
assert.match(
  contentSource,
  /globalThis\.navigation\.addEventListener\(\s*"navigate",\s*handleExtensionUpdateNavigationStart[\s\S]*?"navigatesuccess",\s*handleExtensionUpdateNavigationSettled[\s\S]*?"navigateerror",\s*handleExtensionUpdateNavigationError/,
  "Navigation API success and cancellation have distinct lifecycle handlers"
);
assert.match(
  contentSource,
  /function handleExtensionUpdatePreferencesStorageChange\(rawValue\)[\s\S]*?extensionUpdatePreferencesDeferredStorageValue = nextPreferences[\s\S]*?chrome\.storage\.onChanged\.addListener[\s\S]*?handleExtensionUpdatePreferencesStorageChange\([\s\S]*?\.newValue/,
  "the real cross-tab listener is routed through the behaviorally tested preference handler"
);
assert.doesNotMatch(
  sourceBetween(contentSource, "function serializeFeatureSettings", "function featureSettingsStorageGet"),
  /updateReminderFrequency|rslExtensionUpdatePreferenceV1/,
  "the dedicated reminder preference must not alter the flags serializer schema"
);
const normalUpdateFeedbackStyles = stylesSource.split("/* Fail safe only:")[0];
assert.doesNotMatch(
  normalUpdateFeedbackStyles,
  /position:\s*fixed|background(?:-color)?:|box-shadow|max-width:\s*970px|z-index:/,
  "native StyleGuide geometry, color, and stacking must win in the normal path"
);
assert.doesNotMatch(stylesSource, /#007f52|2147483200|width:\s*min\(560px/);
assert.match(
  stylesSource,
  /#rsl-extension-update-feedback\.rsl-extension-update-feedback--fallback[\s\S]*?\.rsl-extension-update-feedback__alert\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?max-width:\s*970px;[\s\S]*?height:\s*48px;[\s\S]*?background-color:\s*#01854b;/
);
assert.match(
  stylesSource,
  /#rsl-extension-update-feedback\.rsl-extension-update-feedback--fallback[\s\S]*?\.rsl-extension-update-feedback__close\s*\{[\s\S]*?width:\s*18px;[\s\S]*?height:\s*18px;/
);
assert.match(
  stylesSource,
  /\.rsl-extension-update-feedback--fallback[\s\S]*?\.rsl-extension-update-feedback__close::before,[\s\S]*?\.rsl-extension-update-feedback__close::after\s*\{[\s\S]*?background:\s*currentColor;[\s\S]*?content:\s*"";/
);
assert.doesNotMatch(contentUpdateSource, /closeControl\.textContent/);

// Settings gets one non-toggle, accessible update row directly below its title
// and before all feature groups. The link is a fixed local-code destination,
// never a URL supplied by a status response.
const settingsDialogSource = sourceBetween(
  contentSource,
  "  function createFeatureSettingsDialog()",
  "  function openFeatureSettingsDialog"
);
const titleRowIndex = settingsDialogSource.indexOf(
  '<div class="rsl-feature-settings__title-row">'
);
const updateRowIndex = settingsDialogSource.indexOf(
  'data-rsl-feature-settings-update hidden'
);
const groupsIndex = settingsDialogSource.indexOf(
  '<div class="rsl-feature-settings__groups"></div>'
);
assert.ok(titleRowIndex >= 0 && updateRowIndex > titleRowIndex && groupsIndex > updateRowIndex);
const updateRowMarkup = settingsDialogSource.slice(updateRowIndex, groupsIndex);
assert.match(updateRowMarkup, /role="status" aria-live="polite" aria-atomic="true"/);
assert.match(updateRowMarkup, />Update available<\/strong>/);
assert.match(updateRowMarkup, /data-rsl-feature-settings-update-message/);
assert.match(updateRowMarkup, /data-rsl-feature-settings-update-link>How to update<\/a>/);
assert.doesNotMatch(
  updateRowMarkup,
  /data-rsl-feature-key|type="checkbox"|role="switch"|badge/i,
  "the update row is information, not another feature setting"
);
assert.match(settingsDialogSource, /updateLink\.href = EXTENSION_UPDATE_HOW_TO_URL/);
assert.match(settingsDialogSource, /updateLink\.target = "_blank"/);
assert.match(settingsDialogSource, /updateLink\.rel = "noopener noreferrer"/);
assert.match(settingsDialogSource, /updateLink\.referrerPolicy = "no-referrer"/);
assert.match(
  stylesSource,
  /\.rsl-feature-settings__update\[hidden\]\s*\{[\s\S]*?display:\s*none\s*!important/
);
assert.match(
  stylesSource,
  /\.rsl-feature-settings__update-link:focus-visible\s*\{[\s\S]*?outline:\s*2px\s+solid\s+var\(--color-system-emphasis,\s*#6aa7ff\)/
);
assert.match(
  stylesSource,
  /\.rsl-feature-settings__update-link\s*\{[\s\S]*?display:\s*inline-flex[\s\S]*?min-height:\s*36px/
);
assert.match(
  stylesSource,
  /@media\s*\(max-width:\s*520px\)[\s\S]*?\.rsl-feature-settings__update-link\s*\{[\s\S]*?min-height:\s*44px/
);

assert.match(readme, /caches successful checks for 24 hours/i);
assert.match(readme, /failed check, it waits at least one hour/i);
assert.match(readme, /Reminder frequency[^\n]*defaults to \*\*Every 6 hours\*\*/i);
assert.match(readme, /Timed choices share one cooldown across tabs/i);
assert.match(readme, /Every Home visit[^\n]*at most once during the current Home document\/SPA visit/i);
assert.match(readme, /Game-page navigation never claims or shows a banner/i);
assert.match(readme, /RoTool Settings continues to show a known update[^\n]*without consuming a reminder/i);
assert.match(readme, /closing a banner removes only its current page copy/i);

// Run the background logic in an isolated MV3 fixture so parser, comparison,
// cache/single-flight, presentation claim, trust, and failure behavior are
// behavioral contracts rather than source-shape checks.
const storageData = {};
const storageWrites = [];
const fetchCalls = [];
let fetchHandler = async () => { throw new Error("Unexpected network request"); };
let runtimeMessageListener = null;
const backgroundTabMessages = [];
let backgroundTabGetHandler = (tabId, callback) => {
  callback({ id: tabId, active: true, url: "https://www.roblox.com/home" });
};
let backgroundTabMessageHandler = (_tabId, message, _options, callback) => {
  callback?.({
    ok: message?.type === "rsl:verify-extension-update-claim-context"
  });
};

function makeStorageArea(data) {
  return {
    get(keys, callback) {
      let result;
      if (typeof keys === "string") result = { [keys]: data[keys] };
      else if (Array.isArray(keys)) result = Object.fromEntries(keys.map((key) => [key, data[key]]));
      else {
        result = { ...(keys || {}) };
        for (const key of Object.keys(keys || {})) {
          if (Object.hasOwn(data, key)) result[key] = data[key];
        }
      }
      callback?.(result);
      return Promise.resolve(result);
    },
    set(values, callback) {
      Object.assign(data, plain(values));
      storageWrites.push(plain(values));
      callback?.();
      return Promise.resolve();
    },
    remove(keys, callback) {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key];
      callback?.();
      return Promise.resolve();
    }
  };
}

const backgroundChrome = {
  runtime: {
    id: "update-alert-fixture",
    lastError: null,
    getManifest() { return { version: manifest.version }; },
    onInstalled: { addListener() {} },
    onStartup: { addListener() {} },
    onMessage: { addListener(listener) { runtimeMessageListener = listener; } }
  },
  storage: {
    local: makeStorageArea(storageData),
    session: makeStorageArea({}),
    onChanged: { addListener() {} }
  },
  alarms: {
    create() {},
    get(_name, callback) { callback(null); },
    clear(_name, callback) { callback?.(true); return Promise.resolve(true); },
    onAlarm: { addListener() {} }
  },
  contextMenus: {
    create(_details, callback) { callback?.(); },
    removeAll(callback) { callback?.(); },
    onClicked: { addListener() {} }
  },
  scripting: { executeScript: async () => [] },
  tabs: {
    get(tabId, callback) {
      return backgroundTabGetHandler(tabId, callback);
    },
    sendMessage(tabId, message, options, callback) {
      if (typeof options === "function") callback = options;
      const normalizedOptions = typeof options === "function" ? undefined : options;
      backgroundTabMessages.push({
        tabId,
        message: plain(message),
        options: plain(normalizedOptions)
      });
      return backgroundTabMessageHandler(
        tabId,
        message,
        normalizedOptions,
        callback
      );
    }
  }
};

const sandbox = {
  URL,
  URLSearchParams,
  Response,
  Headers,
  Request,
  AbortController,
  TextDecoder,
  TextEncoder,
  Uint8Array,
  Intl,
  console,
  chrome: backgroundChrome,
  crypto: webcrypto,
  fetch: async (input, options = {}) => {
    fetchCalls.push({ url: String(input), options: plain(options) });
    return fetchHandler(input, options);
  },
  setTimeout,
  clearTimeout,
  queueMicrotask,
  __rslBackgroundTestHooks: {},
  globalThis: null
};
sandbox.globalThis = sandbox;
vm.runInContext(backgroundSource, vm.createContext(sandbox), { filename: "background.js" });

const hooks = sandbox.__rslBackgroundTestHooks;
const constants = plain(hooks.extensionUpdateConstants);
assert.deepEqual(constants, {
  messageType: "rsl:get-extension-update-status",
  preferencesGetMessageType: "rsl:get-extension-update-preferences",
  preferencesSetMessageType: "rsl:set-extension-update-preferences",
  contextChallengeMessageType: "rsl:verify-extension-update-claim-context",
  storageKey: "rslExtensionUpdateStatusV1",
  storageVersion: 1,
  preferencesStorageKey: "rslExtensionUpdatePreferenceV1",
  preferencesStorageVersion: 1,
  defaultReminderFrequency: "6h",
  reminderFrequencies: {
    home: null,
    "30m": 30 * 60_000,
    "1h": 60 * 60_000,
    "6h": 6 * 60 * 60_000,
    "24h": 24 * 60 * 60_000
  },
  maxPresentationMarkerAgeMs: 24 * 60 * 60_000,
  latestReleaseUrl: RELEASE_API,
  howToUpdateUrl: UPDATE_GUIDE,
  cacheTtlMs: 24 * 60 * 60_000,
  presentationTtlMs: 6 * 60 * 60_000,
  fetchTimeoutMs: 8_000,
  maxResponseBytes: 256 * 1_024,
  failureRetryMs: 60 * 60_000,
  contextChallengeTimeoutMs: 2_000
});

for (const valid of ["0.0.0", "0.19.1", "10.2.300", "999999999.999999999.999999999"]) {
  assert.equal(hooks.normalizeExtensionUpdateVersion(valid), valid);
}
for (const invalid of [
  null, 1, "", " 1.2.3", "1.2.3 ", "v1.2.3", "01.2.3", "1.02.3",
  "1.2", "1.2.3.4", "1.2.3-beta", "1.2.3+build", "1e2.2.3",
  "1000000000.2.3"
]) {
  assert.equal(hooks.normalizeExtensionUpdateVersion(invalid), null, String(invalid));
}
assert.equal(hooks.normalizeExtensionUpdateVersion("v1.2.3", true), "1.2.3");
assert.equal(hooks.normalizeExtensionUpdateVersion("1.2.3", true), null);
assert.equal(hooks.compareExtensionUpdateVersions("0.19.10", "0.19.9"), 1);
assert.equal(hooks.compareExtensionUpdateVersions("1.0.0", "0.999999999.999999999"), 1);
assert.equal(hooks.compareExtensionUpdateVersions("5.4.3", "5.4.3"), 0);
assert.equal(hooks.compareExtensionUpdateVersions("2.0.0", "10.0.0"), -1);
assert.equal(hooks.compareExtensionUpdateVersions("v1.0.0", "1.0.0"), null);

const clockNow = Date.now();
assert.equal(
  hooks.getExtensionUpdateNextCheckAt({}, clockNow),
  clockNow + constants.failureRetryMs,
  "an empty/error state retries in one hour instead of polling every minute"
);
assert.equal(
  hooks.getExtensionUpdateNextCheckAt({ retryNotBefore: clockNow + 30 * 60_000 }, clockNow),
  clockNow + 30 * 60_000
);
assert.equal(
  hooks.getExtensionUpdateNextCheckAt({ retryNotBefore: clockNow + 10 * 60 * 60_000 }, clockNow),
  clockNow + constants.failureRetryMs + 5 * 60_000,
  "corrupt retry metadata is bounded"
);
assert.equal(
  hooks.getExtensionUpdateNextCheckAt({ latest: "0.19.2", checkedAt: clockNow }, clockNow),
  clockNow + constants.cacheTtlMs
);
assert.equal(hooks.getExtensionUpdateNextNoticeAt({}, false, clockNow), null);
assert.equal(
  hooks.getExtensionUpdateNextNoticeAt({ latest: "0.19.2" }, true, clockNow),
  clockNow
);
assert.equal(
  hooks.getExtensionUpdateNextNoticeAt({
    latest: "0.19.2",
    lastPresentedVersion: "0.19.2",
    lastPresentedAt: clockNow
  }, true, clockNow),
  clockNow + constants.presentationTtlMs
);
assert.equal(
  hooks.getExtensionUpdateNextNoticeAt({
    latest: "0.19.2",
    lastPresentedVersion: "0.19.2",
    lastPresentedAt: clockNow + 10 * 60 * 60_000
  }, true, clockNow),
  clockNow + constants.presentationTtlMs,
  "corrupt future presentation metadata is bounded"
);

function releaseResponse(tag, overrides = {}, responseOverrides = {}) {
  return new Response(JSON.stringify({
    tag_name: tag,
    draft: false,
    prerelease: false,
    ...overrides
  }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...(responseOverrides.headers || {}) },
    ...responseOverrides
  });
}

function memoryStorage(initial = null) {
  let value = initial ? plain(initial) : null;
  const writes = [];
  return {
    writes,
    read() { return plain(value); },
    write(next) { value = plain(next); writes.push(plain(next)); },
    replace(next) { value = plain(next); },
    get value() { return plain(value); }
  };
}

function trustedSender(tabId, overrides = {}) {
  return {
    id: backgroundChrome.runtime.id,
    frameId: 0,
    url: "https://www.roblox.com/home",
    tab: {
      id: tabId,
      active: true,
      url: "https://www.roblox.com/home"
    },
    ...overrides
  };
}

function runtimeMessage(message, sender) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId = null;
    const returned = runtimeMessageListener(message, sender, (response) => {
      settled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
      resolve(plain(response));
    });
    if (returned !== true) {
      reject(new Error("runtime message was not accepted"));
      return;
    }
    timeoutId = setTimeout(() => {
      if (!settled) reject(new Error("runtime message timed out"));
    }, 5_000);
  });
}

function directPresentationClaim(tabId, overrides = {}) {
  return {
    tabId,
    pageVisible: true,
    tabActive: true,
    claimNotice: true,
    homePage: true,
    homeVisitId: `visit-${tabId}-abcdef`,
    claimContextId: `context-${tabId}-abcdef`,
    expectedFrequency: "6h",
    presentationContextVerified: true,
    ...overrides
  };
}

function statusMessage(claimNotice, overrides = {}) {
  return {
    type: constants.messageType,
    pageVisible: true,
    claimNotice,
    claimContextId: claimNotice ? "context-runtime-abcdef" : null,
    homeVisitId: "visit-runtime-abcdef",
    expectedFrequency: "6h",
    ...overrides
  };
}

(async () => {
  // The frequency preference is a dedicated, versioned record. Invalid or
  // legacy values reset to 6h, valid values round-trip exactly, and writes
  // serialize through a monotonically increasing revision.
  for (const frequency of ["home", "30m", "1h", "6h", "24h"]) {
    assert.equal(
      hooks.normalizeExtensionUpdateReminderFrequency(frequency),
      frequency
    );
  }
  for (const invalidFrequency of [null, undefined, "", "HOME", "6H", "reload", 6]) {
    assert.equal(
      hooks.normalizeExtensionUpdateReminderFrequency(invalidFrequency),
      null
    );
  }
  assert.deepEqual(plain(hooks.createDefaultExtensionUpdatePreferences()), {
    version: 1,
    frequency: "6h",
    revision: 0
  });
  for (const invalidPreferences of [
    null,
    {},
    { version: 0, frequency: "30m", revision: 4 },
    { version: 1, frequency: "reload", revision: 4 },
    { version: 1, frequency: "30m", revision: -1 },
    { version: 1, frequency: "30m", revision: 1.5 },
    { version: 1, updatePopups: false, updateReminderFrequency: "30m" }
  ]) {
    assert.deepEqual(plain(hooks.normalizeExtensionUpdatePreferences(invalidPreferences)), {
      version: 1,
      frequency: "6h",
      revision: 0
    });
  }
  assert.deepEqual(
    plain(hooks.normalizeExtensionUpdatePreferences({
      version: 1,
      frequency: "30m",
      revision: 7,
      ignored: "not serialized"
    })),
    { version: 1, frequency: "30m", revision: 7 }
  );

  hooks.resetExtensionUpdateStateForTests();
  const preferenceStorage = memoryStorage({
    version: 1,
    frequency: "30m",
    revision: 7
  });
  hooks.setExtensionUpdatePreferencesStorageOverrideForTests(preferenceStorage);
  assert.deepEqual(plain(await hooks.getExtensionUpdatePreferences()), {
    version: 1,
    frequency: "30m",
    revision: 7
  });
  assert.deepEqual(plain(await hooks.setExtensionUpdateReminderFrequency("30m")), {
    version: 1,
    frequency: "30m",
    revision: 7
  });
  assert.equal(preferenceStorage.writes.length, 0, "an unchanged selection is not rewritten");
  assert.deepEqual(plain(await hooks.setExtensionUpdateReminderFrequency("1h")), {
    version: 1,
    frequency: "1h",
    revision: 8
  });
  assert.deepEqual(preferenceStorage.writes, [{
    version: 1,
    frequency: "1h",
    revision: 8
  }]);

  hooks.resetExtensionUpdateStateForTests();
  let failedPreferenceValue = {
    version: 1,
    frequency: "24h",
    revision: 9
  };
  hooks.setExtensionUpdatePreferencesStorageOverrideForTests({
    read() { return plain(failedPreferenceValue); },
    write() { throw new Error("preference storage unavailable"); }
  });
  await assert.rejects(
    hooks.setExtensionUpdateReminderFrequency("home"),
    /storage unavailable/
  );
  assert.deepEqual(plain(await hooks.getExtensionUpdatePreferences()), failedPreferenceValue,
    "a failed preference write leaves the confirmed value intact");
  assert.equal(await hooks.setExtensionUpdateReminderFrequency("bogus"), null);

  // Only the exact root/localized Home route is presentation-eligible.
  for (const pathname of ["/home", "/home/", "/de/home", "/pt-br/home/"]) {
    assert.equal(
      hooks.isTrustedRobloxHomePageUrl(`https://www.roblox.com${pathname}`),
      true,
      pathname
    );
  }
  for (const pathname of [
    "/games/home", "/home/foo", "/xx/home", "//home", "/en/home/extra"
  ]) {
    assert.equal(
      hooks.isTrustedRobloxHomePageUrl(`https://www.roblox.com${pathname}`),
      false,
      pathname
    );
  }
  for (const rawUrl of [
    "http://www.roblox.com/home",
    "https://roblox.com/home",
    "https://www.roblox.com:444/home",
    "https://user@www.roblox.com/home",
    "not a URL"
  ]) {
    assert.equal(hooks.isTrustedRobloxHomePageUrl(rawUrl), false, rawUrl);
  }
  backgroundTabGetHandler = (tabId, callback) => callback({
    id: tabId,
    active: true,
    url: "https://www.roblox.com/pt-br/home/"
  });
  assert.equal(
    await hooks.verifyTrustedActiveRobloxHomeTab(
      42,
      "https://www.roblox.com/de/home"
    ),
    true
  );
  backgroundTabGetHandler = (tabId, callback) => callback({
    id: tabId,
    active: false,
    url: "https://www.roblox.com/home"
  });
  assert.equal(
    await hooks.verifyTrustedActiveRobloxHomeTab(
      42,
      "https://www.roblox.com/home"
    ),
    false
  );
  backgroundTabGetHandler = (tabId, callback) => callback({
    id: tabId,
    active: true,
    url: "https://www.roblox.com/home"
  });

  // Preference runtime routes accept only their exact request schemas and
  // return only {ok, frequency, revision}.
  hooks.resetExtensionUpdateStateForTests();
  const routedPreferenceStorage = memoryStorage(null);
  hooks.setExtensionUpdatePreferencesStorageOverrideForTests(
    routedPreferenceStorage
  );
  for (const malformed of [
    { type: constants.preferencesGetMessageType, extra: true },
    { type: constants.preferencesSetMessageType },
    { type: constants.preferencesSetMessageType, frequency: "bogus" },
    { type: constants.preferencesSetMessageType, frequency: "30m", extra: true }
  ]) {
    assert.equal(
      runtimeMessageListener(
        malformed,
        trustedSender(41),
        () => assert.fail("malformed preference request must not respond")
      ),
      false
    );
  }
  const routedDefaultPreference = await runtimeMessage(
    { type: constants.preferencesGetMessageType },
    trustedSender(41)
  );
  assert.deepEqual(routedDefaultPreference, {
    ok: true,
    frequency: "6h",
    revision: 0
  });
  const routedSavedPreference = await runtimeMessage({
    type: constants.preferencesSetMessageType,
    frequency: "30m"
  }, trustedSender(41));
  assert.deepEqual(routedSavedPreference, {
    ok: true,
    frequency: "30m",
    revision: 1
  });
  assert.deepEqual(Object.keys(routedSavedPreference).sort(), [
    "frequency", "ok", "revision"
  ]);

  // Strict GitHub release payload and fixed request contract.
  fetchCalls.length = 0;
  fetchHandler = async () => releaseResponse("v0.19.2", {
    name: "<img src=x onerror=alert(1)>",
    body: "<script>remote markup must never render</script>",
    html_url: "https://evil.invalid/update",
    assets: [{ browser_download_url: "https://evil.invalid/payload.exe" }]
  });
  assert.equal(await hooks.fetchLatestExtensionUpdateVersion(), "0.19.2");
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, RELEASE_API);
  assert.deepEqual(fetchCalls[0].options, {
    method: "GET",
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
    signal: {}
  });
  for (const malformed of [
    ["0.19.2", {}],
    ["v0.19.2-beta", {}],
    ["v01.19.2", {}],
    ["v0.19.2", { draft: true }],
    ["v0.19.2", { prerelease: true }]
  ]) {
    fetchHandler = async () => releaseResponse(malformed[0], malformed[1]);
    await assert.rejects(hooks.fetchLatestExtensionUpdateVersion());
  }
  fetchHandler = async () => new Response("<html>not JSON</html>", {
    status: 200,
    headers: { "Content-Type": "text/html" }
  });
  await assert.rejects(hooks.fetchLatestExtensionUpdateVersion());
  fetchHandler = async () => releaseResponse("v0.19.2", {}, {
    headers: {
      "Content-Type": "application/json",
      "Content-Length": String(constants.maxResponseBytes + 1)
    }
  });
  await assert.rejects(hooks.fetchLatestExtensionUpdateVersion(), /too large/i);

  // Concurrent stale checks share one request; the next call is served from
  // the 24-hour cache. No remote fields survive into state or status.
  hooks.resetExtensionUpdateStateForTests();
  const cacheStorage = memoryStorage();
  hooks.setExtensionUpdateStorageOverrideForTests(cacheStorage);
  fetchCalls.length = 0;
  let releaseFetch;
  fetchHandler = () => new Promise((resolve) => { releaseFetch = resolve; });
  const checkOne = hooks.ensureFreshExtensionUpdateState();
  const checkTwo = hooks.ensureFreshExtensionUpdateState();
  while (!releaseFetch) await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(fetchCalls.length, 1, "stale concurrent calls must be single-flight");
  releaseFetch(releaseResponse(`v${AVAILABLE_VERSION}`, { html_url: "https://evil.invalid/" }));
  const [freshOne, freshTwo] = await Promise.all([checkOne, checkTwo]);
  assert.equal(freshOne.latest, AVAILABLE_VERSION);
  assert.equal(freshTwo.latest, AVAILABLE_VERSION);
  assert.deepEqual(Object.keys(plain(freshOne)).sort(), [
    "checkedAt", "lastPresentedAt", "lastPresentedHomeVisitId",
    "lastPresentedVersion", "latest", "presentedHomeVisits",
    "retryNotBefore", "version"
  ]);
  await hooks.ensureFreshExtensionUpdateState();
  assert.equal(fetchCalls.length, 1, "fresh cache must not refetch");

  // A trusted, active, visible top frame atomically gets the only presentation
  // claim for that release. Reloads/tabs remain suppressed for six hours, while
  // a newer cached release bypasses the previous-version marker immediately.
  const concurrentStatuses = await Promise.all([
    hooks.getExtensionUpdateStatus(directPresentationClaim(1)),
    hooks.getExtensionUpdateStatus(directPresentationClaim(2))
  ]);
  assert.equal(
    concurrentStatuses.filter((status) => status.showNotice).length,
    1,
    "concurrent tabs must atomically receive exactly one presentation claim"
  );
  const first = concurrentStatuses.find((status) => status.showNotice);
  assert.deepEqual(Object.keys(plain(first)).sort(), [
    "checkedAt", "current", "frequency", "howToUpdateUrl", "latest",
    "nextCheckAt", "nextNoticeAt", "ok", "preferenceRevision",
    "showNotice", "updateAvailable"
  ]);
  assert.equal(first.howToUpdateUrl, UPDATE_GUIDE);
  assert.ok(
    first.nextNoticeAt > Date.now() + constants.presentationTtlMs - 60_000 &&
      first.nextNoticeAt <= Date.now() + constants.presentationTtlMs,
    "a successful claim advertises the six-hour presentation boundary"
  );
  assert.ok(
    first.nextCheckAt > Date.now() &&
      first.nextCheckAt <= Date.now() + constants.cacheTtlMs,
    "the cache boundary stays within 24 hours"
  );
  assert.doesNotMatch(JSON.stringify(first), /evil|script|html_url|download/i);

  hooks.resetExtensionUpdateStateForTests();
  const presentationNow = Date.now();
  const recentPresentationStorage = memoryStorage({
    version: 1,
    latest: AVAILABLE_VERSION,
    checkedAt: presentationNow,
    retryNotBefore: 0,
    lastPresentedVersion: AVAILABLE_VERSION,
    lastPresentedAt:
      presentationNow - constants.presentationTtlMs + 60_000
  });
  hooks.setExtensionUpdateStorageOverrideForTests(recentPresentationStorage);
  const stillSuppressed = await hooks.getExtensionUpdateStatus(
    directPresentationClaim(11, { now: presentationNow })
  );
  assert.equal(stillSuppressed.showNotice, false);
  assert.equal(stillSuppressed.nextNoticeAt, presentationNow + 60_000);
  assert.equal(recentPresentationStorage.writes.length, 0);

  hooks.resetExtensionUpdateStateForTests();
  const expiredPresentationStorage = memoryStorage({
    version: 1,
    latest: AVAILABLE_VERSION,
    checkedAt: presentationNow,
    retryNotBefore: 0,
    lastPresentedVersion: AVAILABLE_VERSION,
    lastPresentedAt: presentationNow - constants.presentationTtlMs
  });
  hooks.setExtensionUpdateStorageOverrideForTests(expiredPresentationStorage);
  const reminded = await hooks.getExtensionUpdateStatus(
    directPresentationClaim(12, { now: presentationNow })
  );
  assert.equal(reminded.showNotice, true);
  assert.equal(reminded.nextNoticeAt, presentationNow + constants.presentationTtlMs);
  assert.equal(expiredPresentationStorage.value.lastPresentedVersion, AVAILABLE_VERSION);
  assert.equal(expiredPresentationStorage.value.lastPresentedAt, presentationNow);

  hooks.resetExtensionUpdateStateForTests();
  const newerNow = Date.now();
  const newerStorage = memoryStorage({
    version: 1,
    latest: REPLACEMENT_VERSION,
    checkedAt: newerNow,
    retryNotBefore: 0,
    lastPresentedVersion: AVAILABLE_VERSION,
    lastPresentedAt: newerNow
  });
  hooks.setExtensionUpdateStorageOverrideForTests(newerStorage);
  const newer = await hooks.getExtensionUpdateStatus(
    directPresentationClaim(3, { now: newerNow })
  );
  assert.equal(newer.latest, REPLACEMENT_VERSION);
  assert.equal(newer.showNotice, true, "a newer release bypasses the old marker");

  // Every timed choice shares one atomic global cooldown. The millisecond
  // immediately before the boundary is suppressed; the exact boundary is due.
  for (const [frequency, interval] of Object.entries({
    "30m": 30 * 60_000,
    "1h": 60 * 60_000,
    "6h": 6 * 60 * 60_000,
    "24h": 24 * 60 * 60_000
  })) {
    hooks.resetExtensionUpdateStateForTests();
    // Keep the test clock slightly ahead of wall time so the 24h marker is not
    // pruned by real-time milliseconds while the fixture is loading it.
    const boundaryNow = Date.now() + 60_000;
    const timedPreferenceStorage = memoryStorage({
      version: 1,
      frequency,
      revision: 10
    });
    const timedStateStorage = memoryStorage({
      version: 1,
      latest: AVAILABLE_VERSION,
      checkedAt: boundaryNow,
      retryNotBefore: 0,
      lastPresentedVersion: AVAILABLE_VERSION,
      lastPresentedAt: boundaryNow - interval + 1,
      lastPresentedHomeVisitId: "visit-boundary-before",
      presentedHomeVisits: []
    });
    hooks.setExtensionUpdatePreferencesStorageOverrideForTests(
      timedPreferenceStorage
    );
    hooks.setExtensionUpdateStorageOverrideForTests(timedStateStorage);
    const beforeBoundary = await hooks.getExtensionUpdateStatus(
      directPresentationClaim(51, {
        expectedFrequency: frequency,
        homeVisitId: `visit-${frequency}-before`,
        claimContextId: `context-${frequency}-before`,
        now: boundaryNow
      })
    );
    assert.equal(beforeBoundary.frequency, frequency);
    assert.equal(beforeBoundary.preferenceRevision, 10);
    assert.equal(beforeBoundary.showNotice, false, `${frequency} before boundary`);
    assert.equal(beforeBoundary.nextNoticeAt, boundaryNow + 1);
    assert.equal(timedStateStorage.writes.length, 0);

    timedStateStorage.replace({
      ...timedStateStorage.value,
      lastPresentedAt: boundaryNow - interval
    });
    hooks.setExtensionUpdateStorageOverrideForTests(timedStateStorage);
    const atBoundary = await Promise.all([
      hooks.getExtensionUpdateStatus(directPresentationClaim(52, {
        expectedFrequency: frequency,
        homeVisitId: `visit-${frequency}-at-a`,
        claimContextId: `context-${frequency}-at-a`,
        now: boundaryNow
      })),
      hooks.getExtensionUpdateStatus(directPresentationClaim(53, {
        expectedFrequency: frequency,
        homeVisitId: `visit-${frequency}-at-b`,
        claimContextId: `context-${frequency}-at-b`,
        now: boundaryNow
      }))
    ]);
    assert.equal(
      atBoundary.filter(({ showNotice }) => showNotice).length,
      1,
      `${frequency} boundary must grant one global claim`
    );
    assert.ok(
      atBoundary.every(({ nextNoticeAt }) => nextNoticeAt === boundaryNow + interval),
      `${frequency} returns its exact next boundary`
    );
    assert.equal(timedStateStorage.value.lastPresentedAt, boundaryNow);
  }

  // Every Home visit is timer-free and deduplicated by (version, visit), not
  // by a global cooldown. It also retains per-version history across A-B-A.
  hooks.resetExtensionUpdateStateForTests();
  const homeNow = Date.now();
  const homePreferenceStorage = memoryStorage({
    version: 1,
    frequency: "home",
    revision: 20
  });
  const homeStateStorage = memoryStorage({
    version: 1,
    latest: AVAILABLE_VERSION,
    checkedAt: homeNow,
    retryNotBefore: 0,
    lastPresentedVersion: null,
    lastPresentedAt: 0,
    lastPresentedHomeVisitId: null,
    presentedHomeVisits: []
  });
  hooks.setExtensionUpdatePreferencesStorageOverrideForTests(
    homePreferenceStorage
  );
  hooks.setExtensionUpdateStorageOverrideForTests(homeStateStorage);
  const homeVisitA = "visit-home-stable-abcdef";
  const firstHomeClaim = await hooks.getExtensionUpdateStatus(
    directPresentationClaim(61, {
      expectedFrequency: "home",
      homeVisitId: homeVisitA,
      claimContextId: "context-home-a-first",
      now: homeNow
    })
  );
  assert.equal(firstHomeClaim.showNotice, true);
  assert.equal(firstHomeClaim.nextNoticeAt, null);
  const repeatedHomeClaim = await hooks.getExtensionUpdateStatus(
    directPresentationClaim(61, {
      expectedFrequency: "home",
      homeVisitId: homeVisitA,
      claimContextId: "context-home-a-repeat",
      now: homeNow + 1
    })
  );
  assert.equal(repeatedHomeClaim.showNotice, false,
    "refreshes within one Home visit cannot replay a version");
  const secondHomeVisit = await hooks.getExtensionUpdateStatus(
    directPresentationClaim(61, {
      expectedFrequency: "home",
      homeVisitId: "visit-home-new-abcdef",
      claimContextId: "context-home-new-abcdef",
      now: homeNow + 2
    })
  );
  assert.equal(secondHomeVisit.showNotice, true,
    "returning to Home with a new visit may present immediately");

  homeStateStorage.replace({
    ...homeStateStorage.value,
    latest: REPLACEMENT_VERSION,
    checkedAt: homeNow + 3
  });
  hooks.setExtensionUpdateStorageOverrideForTests(homeStateStorage);
  const replacementHomeClaim = await hooks.getExtensionUpdateStatus(
    directPresentationClaim(61, {
      expectedFrequency: "home",
      homeVisitId: homeVisitA,
      claimContextId: "context-home-b-abcdef",
      now: homeNow + 3
    })
  );
  assert.equal(replacementHomeClaim.showNotice, true);
  homeStateStorage.replace({
    ...homeStateStorage.value,
    latest: AVAILABLE_VERSION,
    checkedAt: homeNow + 4
  });
  hooks.setExtensionUpdateStorageOverrideForTests(homeStateStorage);
  const abaHomeClaim = await hooks.getExtensionUpdateStatus(
    directPresentationClaim(61, {
      expectedFrequency: "home",
      homeVisitId: homeVisitA,
      claimContextId: "context-home-a-return",
      now: homeNow + 4
    })
  );
  assert.equal(abaHomeClaim.showNotice, false,
    "A -> B -> A cannot replay A within one Home visit");

  const manyHomeMarkers = Array.from({ length: 300 }, (_, index) => ({
    version: `${Math.floor(index / 100) + 1}.0.${index % 100}`,
    visitId: `visit-retention-${index.toString(36)}-abcdef`,
    presentedAt: homeNow - (300 - index)
  }));
  manyHomeMarkers.unshift({
    version: AVAILABLE_VERSION,
    visitId: "visit-expired-abcdef",
    presentedAt: homeNow - constants.maxPresentationMarkerAgeMs
  });
  const boundedHomeState = plain(hooks.normalizeExtensionUpdateState({
    version: 1,
    latest: AVAILABLE_VERSION,
    checkedAt: homeNow,
    retryNotBefore: 0,
    lastPresentedVersion: null,
    lastPresentedAt: 0,
    presentedHomeVisits: manyHomeMarkers
  }, homeNow));
  assert.equal(boundedHomeState.presentedHomeVisits.length, 256);
  assert.equal(
    boundedHomeState.presentedHomeVisits.some(
      ({ visitId }) => visitId === "visit-expired-abcdef"
    ),
    false,
    "24-hour-old visit markers expire"
  );
  assert.equal(
    boundedHomeState.presentedHomeVisits.at(-1).visitId,
    manyHomeMarkers.at(-1).visitId,
    "the newest 256 markers are retained"
  );

  // A failed marker write never grants a notice or mutates the in-memory
  // marker; the same visit can claim successfully once persistence recovers.
  hooks.resetExtensionUpdateStateForTests();
  let failClaimWrite = true;
  let claimWriteValue = {
    version: 1,
    latest: AVAILABLE_VERSION,
    checkedAt: homeNow,
    retryNotBefore: 0,
    lastPresentedVersion: null,
    lastPresentedAt: 0,
    lastPresentedHomeVisitId: null,
    presentedHomeVisits: []
  };
  const claimWriteStorage = {
    read() { return plain(claimWriteValue); },
    write(next) {
      if (failClaimWrite) throw new Error("marker write failed");
      claimWriteValue = plain(next);
    }
  };
  hooks.setExtensionUpdatePreferencesStorageOverrideForTests(memoryStorage({
    version: 1,
    frequency: "home",
    revision: 21
  }));
  hooks.setExtensionUpdateStorageOverrideForTests(claimWriteStorage);
  const failedMarkerClaim = await hooks.getExtensionUpdateStatus(
    directPresentationClaim(62, {
      expectedFrequency: "home",
      homeVisitId: "visit-write-retry-abcdef",
      claimContextId: "context-write-failed",
      now: homeNow + 10
    })
  );
  assert.equal(failedMarkerClaim.showNotice, false);
  assert.equal(claimWriteValue.presentedHomeVisits.length, 0);
  failClaimWrite = false;
  const retriedMarkerClaim = await hooks.getExtensionUpdateStatus(
    directPresentationClaim(62, {
      expectedFrequency: "home",
      homeVisitId: "visit-write-retry-abcdef",
      claimContextId: "context-write-retry",
      now: homeNow + 11
    })
  );
  assert.equal(retriedMarkerClaim.showNotice, true);
  assert.equal(claimWriteValue.presentedHomeVisits.length, 1);

  // A Settings read may refresh stale release data, but claimNotice:false
  // cannot consume or rewrite the current popup presentation lease.
  hooks.resetExtensionUpdateStateForTests();
  const settingsNow = Date.now();
  const settingsLastPresentedAt = settingsNow - 30 * 60_000;
  const settingsStorage = memoryStorage({
    version: 1,
    latest: AVAILABLE_VERSION,
    checkedAt: settingsNow - constants.cacheTtlMs - 1,
    retryNotBefore: 0,
    lastPresentedVersion: AVAILABLE_VERSION,
    lastPresentedAt: settingsLastPresentedAt
  });
  hooks.setExtensionUpdateStorageOverrideForTests(settingsStorage);
  fetchCalls.length = 0;
  fetchHandler = async () => releaseResponse(`v${AVAILABLE_VERSION}`);
  const settingsStatus = await hooks.getExtensionUpdateStatus({
    tabId: 13,
    pageVisible: true,
    tabActive: true,
    claimNotice: false,
    now: settingsNow
  });
  assert.equal(settingsStatus.updateAvailable, true);
  assert.equal(settingsStatus.showNotice, false);
  assert.equal(fetchCalls.length, 1, "Settings may refresh a stale 24-hour cache");
  assert.equal(settingsStorage.value.lastPresentedVersion, AVAILABLE_VERSION);
  assert.equal(settingsStorage.value.lastPresentedAt, settingsLastPresentedAt);
  assert.equal(
    settingsStatus.nextNoticeAt,
    settingsLastPresentedAt + constants.presentationTtlMs
  );

  // Hidden/inactive callers do not fetch, claim, or write. The runtime route
  // rejects forged extension ids, frames, schemes, hosts, ports, and URLs.
  hooks.resetExtensionUpdateStateForTests();
  const hiddenStorage = memoryStorage();
  hooks.setExtensionUpdateStorageOverrideForTests(hiddenStorage);
  fetchCalls.length = 0;
  fetchHandler = async () => releaseResponse(`v${AVAILABLE_VERSION}`);
  const hidden = await hooks.getExtensionUpdateStatus(
    directPresentationClaim(4, { pageVisible: false })
  );
  const inactive = await hooks.getExtensionUpdateStatus(
    directPresentationClaim(4, { tabActive: false })
  );
  assert.equal(hidden.showNotice, false);
  assert.equal(inactive.showNotice, false);
  assert.equal(fetchCalls.length, 0);
  assert.equal(hiddenStorage.writes.length, 0);

  for (const sender of [
    trustedSender(5, { id: "another-extension" }),
    trustedSender(5, { frameId: 1 }),
    trustedSender(5, { url: "https://evil.invalid/home" }),
    trustedSender(5, { tab: { id: 5, active: true, url: "http://www.roblox.com/home" } }),
    trustedSender(5, { tab: { id: 5, active: true, url: "https://roblox.com/home" } }),
    trustedSender(5, { tab: { id: 5, active: true, url: "https://www.roblox.com:444/home" } })
  ]) {
    assert.equal(
      runtimeMessageListener(
        statusMessage(true),
        sender,
        () => assert.fail("untrusted sender must not receive a response")
      ),
      false
    );
  }
  for (const message of [
    { ...statusMessage(true), pageVisible: "true" },
    { ...statusMessage(true), claimNotice: 1 },
    { ...statusMessage(true), claimContextId: null },
    { ...statusMessage(false), claimContextId: "context-runtime-abcdef" },
    { ...statusMessage(true), expectedFrequency: "bogus" },
    { ...statusMessage(true), extra: true }
  ]) {
    assert.equal(
      runtimeMessageListener(
        message,
        trustedSender(5),
        () => assert.fail("a malformed update-status message must not receive a response")
      ),
      false,
      "the runtime route accepts exactly the six typed status fields"
    );
  }

  hooks.resetExtensionUpdateStateForTests();
  const routeNow = Date.now();
  const routeStorage = memoryStorage({
    version: 1,
    latest: AVAILABLE_VERSION,
    checkedAt: routeNow,
    retryNotBefore: 0,
    lastPresentedVersion: null,
    lastPresentedAt: 0
  });
  hooks.setExtensionUpdateStorageOverrideForTests(routeStorage);
  backgroundTabMessages.length = 0;
  const settingsRouted = await runtimeMessage(
    statusMessage(false),
    trustedSender(6)
  );
  assert.equal(settingsRouted.showNotice, false);
  assert.equal(settingsRouted.updateAvailable, true);
  assert.equal(routeStorage.writes.length, 0,
    "claimNotice:false reads status without consuming presentation");
  assert.equal(backgroundTabMessages.length, 0,
    "status-only requests never send a context challenge");
  const routed = await runtimeMessage(
    statusMessage(true),
    trustedSender(6)
  );
  assert.equal(routed.showNotice, true);
  assert.equal(routed.latest, AVAILABLE_VERSION);
  assert.equal(routed.howToUpdateUrl, UPDATE_GUIDE);
  assert.equal(Object.hasOwn(routed, "url"), false);
  assert.equal(routeStorage.writes.length, 1,
    "claimNotice:true atomically records the presentation");
  assert.deepEqual(backgroundTabMessages, [{
    tabId: 6,
    message: {
      type: constants.contextChallengeMessageType,
      claimContextId: "context-runtime-abcdef",
      homeVisitId: "visit-runtime-abcdef",
      expectedFrequency: "6h"
    },
    options: { frameId: 0 }
  }]);

  // The final context challenge is strict and fail-closed. A live active Home
  // tab plus the exact one-key acknowledgement is required.
  backgroundTabMessages.length = 0;
  backgroundTabMessageHandler = (_tabId, _message, _options, callback) => {
    callback({ ok: true, extra: true });
  };
  assert.equal(await hooks.challengeExtensionUpdateClaimContext(70, {
    claimContextId: "context-strict-extra",
    homeVisitId: "visit-strict-extra",
    expectedFrequency: "6h"
  }), false);
  backgroundTabMessageHandler = (_tabId, _message, _options, callback) => {
    callback({ ok: 1 });
  };
  assert.equal(await hooks.challengeExtensionUpdateClaimContext(70, {
    claimContextId: "context-strict-type",
    homeVisitId: "visit-strict-type",
    expectedFrequency: "6h"
  }), false);
  backgroundTabMessageHandler = () => {
    throw new Error("disconnected content script");
  };
  assert.equal(await hooks.challengeExtensionUpdateClaimContext(70, {
    claimContextId: "context-strict-throw",
    homeVisitId: "visit-strict-throw",
    expectedFrequency: "6h"
  }), false);
  backgroundTabMessageHandler = (_tabId, _message, _options, callback) => {
    callback({ ok: true });
  };
  assert.equal(await hooks.challengeExtensionUpdateClaimContext(70, {
    claimContextId: "bad space",
    homeVisitId: "visit-strict-invalid",
    expectedFrequency: "6h"
  }), false);
  assert.equal(await hooks.challengeExtensionUpdateClaimContext(70, {
    claimContextId: "context-strict-valid",
    homeVisitId: "visit-strict-valid",
    expectedFrequency: "6h"
  }), true);

  // A sender/tab route disagreement, inactive live tab, game route, expected
  // frequency mismatch, or disabled master switch cannot challenge or mark.
  hooks.resetExtensionUpdateStateForTests();
  const deniedNow = Date.now();
  const deniedStorage = memoryStorage({
    version: 1,
    latest: AVAILABLE_VERSION,
    checkedAt: deniedNow,
    retryNotBefore: 0,
    lastPresentedVersion: null,
    lastPresentedAt: 0,
    lastPresentedHomeVisitId: null,
    presentedHomeVisits: []
  });
  hooks.setExtensionUpdateStorageOverrideForTests(deniedStorage);
  hooks.setExtensionUpdatePreferencesStorageOverrideForTests(memoryStorage({
    version: 1,
    frequency: "6h",
    revision: 30
  }));
  backgroundTabMessages.length = 0;
  backgroundTabMessageHandler = () => undefined;
  const challengeTimeoutStartedAt = Date.now();
  const timedOutChallengeStatus = await runtimeMessage(
    statusMessage(true),
    trustedSender(71)
  );
  assert.equal(timedOutChallengeStatus.showNotice, false);
  assert.ok(
    Date.now() - challengeTimeoutStartedAt >= constants.contextChallengeTimeoutMs - 100,
    "a missing content response waits only for the bounded challenge timeout"
  );
  assert.equal(deniedStorage.writes.length, 0,
    "a timed-out challenge cannot record a presentation marker");
  backgroundTabMessages.length = 0;
  backgroundTabMessageHandler = (_tabId, _message, _options, callback) => {
    callback({ ok: true });
  };
  const gameSender = trustedSender(71, {
    url: "https://www.roblox.com/games/123/example",
    tab: {
      id: 71,
      active: true,
      url: "https://www.roblox.com/games/123/example"
    }
  });
  const gameRouteStatus = await runtimeMessage(statusMessage(true), gameSender);
  assert.equal(gameRouteStatus.showNotice, false);
  assert.equal(backgroundTabMessages.length, 0);
  assert.equal(deniedStorage.writes.length, 0);

  const disagreeingSender = trustedSender(71, {
    url: "https://www.roblox.com/games/123/example"
  });
  const disagreementStatus = await runtimeMessage(
    statusMessage(true),
    disagreeingSender
  );
  assert.equal(disagreementStatus.showNotice, false);
  assert.equal(backgroundTabMessages.length, 0);
  assert.equal(deniedStorage.writes.length, 0);

  backgroundTabGetHandler = (tabId, callback) => callback({
    id: tabId,
    active: false,
    url: "https://www.roblox.com/home"
  });
  const inactiveLiveStatus = await runtimeMessage(
    statusMessage(true),
    trustedSender(71)
  );
  assert.equal(inactiveLiveStatus.showNotice, false);
  assert.equal(backgroundTabMessages.length, 0);
  assert.equal(deniedStorage.writes.length, 0);
  backgroundTabGetHandler = (tabId, callback) => callback({
    id: tabId,
    active: true,
    url: "https://www.roblox.com/home"
  });

  hooks.resetExtensionUpdateStateForTests();
  const mismatchStorage = memoryStorage(deniedStorage.value);
  hooks.setExtensionUpdateStorageOverrideForTests(mismatchStorage);
  hooks.setExtensionUpdatePreferencesStorageOverrideForTests(memoryStorage({
    version: 1,
    frequency: "30m",
    revision: 31
  }));
  backgroundTabMessages.length = 0;
  const mismatchStatus = await runtimeMessage(
    statusMessage(true, { expectedFrequency: "6h" }),
    trustedSender(72)
  );
  assert.equal(mismatchStatus.frequency, "30m");
  assert.equal(mismatchStatus.showNotice, false);
  assert.equal(backgroundTabMessages.length, 0,
    "a stale expected frequency is rejected before challenge");
  assert.equal(mismatchStorage.writes.length, 0);

  storageData.rslFeatureSettingsV1 = {
    version: 1,
    flags: { updatePopups: false, friendFilters: true }
  };
  hooks.resetExtensionUpdateStateForTests();
  const masterOffStorage = memoryStorage(deniedStorage.value);
  const retainedPreference = memoryStorage({
    version: 1,
    frequency: "30m",
    revision: 31
  });
  hooks.setExtensionUpdateStorageOverrideForTests(masterOffStorage);
  hooks.setExtensionUpdatePreferencesStorageOverrideForTests(retainedPreference);
  const masterOffStatus = await hooks.getExtensionUpdateStatus(
    directPresentationClaim(73, {
      expectedFrequency: "30m",
      homeVisitId: "visit-master-off-abcdef",
      claimContextId: "context-master-off-abcdef",
      now: deniedNow
    })
  );
  assert.equal(masterOffStatus.frequency, "30m");
  assert.equal(masterOffStatus.showNotice, false);
  assert.equal(masterOffStorage.writes.length, 0);
  assert.deepEqual(retainedPreference.value, {
    version: 1,
    frequency: "30m",
    revision: 31
  }, "the parent switch disables presentation without erasing its submenu");
  assert.deepEqual(storageData.rslFeatureSettingsV1, {
    version: 1,
    flags: { updatePopups: false, friendFilters: true }
  }, "frequency state never leaks into the flags schema");
  delete storageData.rslFeatureSettingsV1;
  backgroundTabMessageHandler = (_tabId, message, _options, callback) => {
    callback?.({
      ok: message?.type === constants.contextChallengeMessageType
    });
  };

  // Network and persistence failures are silent/fail-safe. A stale known
  // release remains usable, and a failed empty check creates only bounded
  // retry metadata rather than an alert or exception.
  hooks.resetExtensionUpdateStateForTests();
  const staleNow = Date.now();
  const staleStorage = memoryStorage({
    version: 1,
    latest: AVAILABLE_VERSION,
    checkedAt: staleNow - constants.cacheTtlMs - 1,
    retryNotBefore: 0,
    lastPresentedVersion: null,
    lastPresentedAt: 0
  });
  hooks.setExtensionUpdateStorageOverrideForTests(staleStorage);
  fetchHandler = async () => { throw new Error("offline"); };
  const staleFailureStartedAt = Date.now();
  const stale = await hooks.getExtensionUpdateStatus(
    directPresentationClaim(7)
  );
  assert.equal(stale.latest, AVAILABLE_VERSION);
  assert.equal(stale.updateAvailable, true);
  assert.equal(stale.showNotice, true);
  assert.ok(staleStorage.value.retryNotBefore > Date.now());
  assert.ok(
    stale.nextCheckAt >= staleFailureStartedAt + constants.failureRetryMs &&
      stale.nextCheckAt <= Date.now() + constants.failureRetryMs + 1_000
  );

  hooks.resetExtensionUpdateStateForTests();
  const failedStorage = memoryStorage();
  hooks.setExtensionUpdateStorageOverrideForTests(failedStorage);
  const failed = await hooks.getExtensionUpdateStatus(
    directPresentationClaim(8)
  );
  assert.equal(failed.latest, null);
  assert.equal(failed.updateAvailable, false);
  assert.equal(failed.showNotice, false);
  assert.equal(failed.nextNoticeAt, null);
  assert.ok(failedStorage.value.retryNotBefore > Date.now());
  assert.equal(failed.nextCheckAt, failedStorage.value.retryNotBefore);

  // Render the owned DOM in a minimal fixture. This checks exact hierarchy,
  // fixed link, accessible close, no duplicate, trusted local dismissal, RAF
  // cancellation, observer teardown, and clean newer-version replacement.
  const originalGlobals = {
    window: globalThis.window,
    document: globalThis.document,
    location: globalThis.location,
    chrome: globalThis.chrome,
    MutationObserver: globalThis.MutationObserver,
    hooks: globalThis.__rslContentTestHooks
  };
  let nextAnimationFrameId = 1;
  const animationFrames = new Map();
  const canceledFrames = [];
  let nextTimeoutId = 1;
  const timeouts = new Map();
  const clearedTimeouts = [];
  const mutationObservers = [];
  let nativeFeedbackStylesAvailable = true;
  let contentMessages = 0;
  const contentFeatureStorageWrites = [];
  let contentFeatureStorageSetHandler = (values, callback) => {
    contentFeatureStorageWrites.push(plain(values));
    callback?.();
  };
  let contentMessageHandler = () => {
    contentMessages += 1;
    throw new Error("close must stay local");
  };

  class FakeNode {
    constructor(tagName = "") {
      this.tagName = tagName.toUpperCase();
      this.nodeType = tagName === "#text" ? 3 : 1;
      this.parentElement = null;
      this.children = [];
      this.attributes = new Map();
      this.dataset = {};
      this.style = { values: {}, setProperty: (name, value) => { this.style.values[name] = value; } };
      this.listeners = new Map();
      this.id = "";
      this.className = "";
      this.classList = {
        values: new Set(),
        toggle: (name, force) => {
          const enabled = force === undefined
            ? !this.classList.values.has(name)
            : Boolean(force);
          if (enabled) this.classList.values.add(name);
          else this.classList.values.delete(name);
          return enabled;
        },
        contains: (name) => this.classList.values.has(name)
      };
      this.textContent = "";
      this.hidden = false;
      this.rect = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
    }
    append(...nodes) {
      for (const node of nodes) {
        node.parentElement = this;
        this.children.push(node);
      }
    }
    remove() {
      if (!this.parentElement) return;
      this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
      this.parentElement = null;
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    hasAttribute(name) { return this.attributes.has(name); }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    closest(selector) {
      let current = this;
      while (current) {
        if (matchesSelector(current, selector)) return current;
        current = current.parentElement;
      }
      return null;
    }
    contains(candidate) {
      return walk(this, (node) => node === candidate).length > 0;
    }
    get isConnected() {
      let current = this;
      while (current) {
        if (current === fakeDocument.documentElement) return true;
        current = current.parentElement;
      }
      return false;
    }
    querySelector(selector) {
      return walk(this, (node) => node !== this && matchesSelector(node, selector))[0] || null;
    }
    querySelectorAll(selector) {
      return walk(this, (node) => node !== this && matchesSelector(node, selector));
    }
    getBoundingClientRect() {
      return this.rect;
    }
  }

  function walk(root, predicate, results = []) {
    if (predicate(root)) results.push(root);
    for (const child of root.children || []) walk(child, predicate, results);
    return results;
  }

  function matchesSelector(node, selector) {
    if (selector.startsWith("#")) return node.id === selector.slice(1);
    if (selector.startsWith(".")) {
      return node.className.split(/\s+/).includes(selector.slice(1));
    }
    const attribute = /^\[([^\]]+)\]$/.exec(selector)?.[1];
    return attribute ? node.hasAttribute(attribute) : false;
  }

  const fakeDocument = {
    documentElement: new FakeNode("html"),
    body: new FakeNode("body"),
    visibilityState: "visible",
    createElement(tagName) { return new FakeNode(tagName); },
    createTextNode(text) { const node = new FakeNode("#text"); node.textContent = text; return node; },
    getElementById(id) {
      return walk(this.documentElement, (node) => node.id === id)[0] || null;
    },
    querySelector(selector) {
      if (selector.includes("#header") || selector.includes("header[role='banner']")) return null;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === ".sg-system-feedback") {
        return walk(this.documentElement, (node) => node.className.split(/\s+/).includes("sg-system-feedback"));
      }
      if (selector === ".alert-system-feedback") {
        return walk(this.documentElement, (node) => matchesSelector(node, selector));
      }
      if (selector === ".alert-system-feedback .alert.on") {
        return walk(this.documentElement, (node) =>
          node.className.split(/\s+/).includes("alert") &&
          node.className.split(/\s+/).includes("on") &&
          Boolean(node.parentElement?.closest?.(".alert-system-feedback"))
        );
      }
      return [];
    }
  };
  fakeDocument.documentElement.append(fakeDocument.body);
  const fakeWindow = {
    innerHeight: 900,
    requestAnimationFrame(callback) {
      const id = nextAnimationFrameId++;
      animationFrames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) {
      canceledFrames.push(id);
      animationFrames.delete(id);
    },
    setTimeout(callback, delay) {
      const id = nextTimeoutId++;
      timeouts.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) {
      clearedTimeouts.push(id);
      timeouts.delete(id);
    },
    getComputedStyle(node) {
      const classes = node.className.split(/\s+/);
      const style = {
        display: node.hidden ? "none" : "block",
        visibility: "visible",
        position: "static",
        height: "0px",
        fontSize: "0px",
        backgroundColor: "transparent",
        backgroundImage: "none",
        width: "0px"
      };
      if (!nativeFeedbackStylesAvailable) return style;
      if (classes.includes("alert-system-feedback")) style.position = "relative";
      if (classes.includes("alert")) {
        style.position = "fixed";
        style.height = "48px";
        style.fontSize = "20px";
        style.backgroundColor = "rgb(1, 133, 75)";
      }
      if (classes.includes("icon-close-white")) {
        style.backgroundImage = "url(roblox-styleguide-sprite.svg)";
        style.width = "18px";
        style.height = "18px";
      }
      return style;
    }
  };
  fakeWindow.top = fakeWindow;
  const fakeLocation = {
    href: "https://www.roblox.com/home",
    origin: "https://www.roblox.com",
    protocol: "https:",
    hostname: "www.roblox.com",
    pathname: "/home",
    search: "",
    hash: ""
  };
  function setFakeLocation(rawUrl) {
    const url = new URL(rawUrl, fakeLocation.href);
    fakeLocation.href = url.href;
    fakeLocation.origin = url.origin;
    fakeLocation.protocol = url.protocol;
    fakeLocation.hostname = url.hostname;
    fakeLocation.pathname = url.pathname;
    fakeLocation.search = url.search;
    fakeLocation.hash = url.hash;
  }

  globalThis.window = fakeWindow;
  globalThis.document = fakeDocument;
  globalThis.location = fakeLocation;
  globalThis.chrome = {
    runtime: {
      id: "content-test-extension",
      lastError: null,
      getManifest() { return { version: manifest.version }; },
      sendMessage(message, callback) { return contentMessageHandler(message, callback); }
    },
    storage: {
      local: {
        set(values, callback) {
          contentFeatureStorageSetHandler(values, callback);
        }
      }
    }
  };
  globalThis.MutationObserver = class {
    constructor(callback) {
      this.callback = callback;
      this.disconnectCount = 0;
      this.observations = [];
      mutationObservers.push(this);
    }
    observe(target, options) { this.observations.push({ target, options }); }
    disconnect() { this.disconnectCount += 1; }
  };
  globalThis.__rslContentTestHooks = { skipInitialize: true };
  delete require.cache[require.resolve(path.join(projectRoot, "content.js"))];
  require(path.join(projectRoot, "content.js"));
  const contentHooks = globalThis.__rslContentTestHooks;
  assert.equal(contentHooks.defaultFeatureSettings.updatePopups, true);
  for (const legacy of [null, { version: 1 }, { version: 1, flags: {} }]) {
    assert.equal(
      contentHooks.normalizeFeatureSettings(legacy).updatePopups,
      true,
      "existing installations must inherit the enabled popup default"
    );
  }
  const explicitlyDisabledPopups = contentHooks.normalizeFeatureSettings({
    version: 1,
    flags: { updatePopups: false }
  });
  assert.equal(explicitlyDisabledPopups.updatePopups, false);
  assert.equal(
    contentHooks.serializeFeatureSettings(explicitlyDisabledPopups).flags.updatePopups,
    false,
    "the disabled choice must round-trip through rslFeatureSettingsV1"
  );
  assert.equal(
    contentHooks.serializeFeatureSettings(contentHooks.defaultFeatureSettings)
      .flags.updatePopups,
    true,
    "Reset defaults must restore update popups"
  );
  contentMessageHandler = (message, callback) => {
    assert.deepEqual(message, { type: constants.preferencesGetMessageType });
    callback({ ok: true, frequency: "6h", revision: 0 });
  };
  assert.deepEqual(await contentHooks.loadExtensionUpdatePreferences(), {
    frequency: "6h",
    revision: 0
  });
  contentMessageHandler = () => {
    contentMessages += 1;
    throw new Error("close must stay local");
  };
  const updatePopupsDefinition = contentHooks.featureDefinitions.find(
    ({ key }) => key === "updatePopups"
  );
  assert.deepEqual(plain(updatePopupsDefinition), {
    key: "updatePopups",
    group: "Interface",
    label: "RoTool Update Popups",
    description:
      "Show RoTool update reminders at the top of Home. Updates still appear in RoTool Settings.",
    advancedControl: {
      type: "select",
      key: "updateReminderFrequency",
      label: "Reminder frequency",
      description:
        "Reminders appear only while Home is active and visible. Opening a game never shows one."
    }
  });
  const topLevelFeatureKeys = contentHooks.featureDefinitions.map(({ key }) => key);
  assert.equal(
    topLevelFeatureKeys.indexOf("updatePopups"),
    topLevelFeatureKeys.indexOf("friendFilters") + 1,
    "RoTool Update Popups must follow Friend Lists & Filters at the end of Interface"
  );
  assert.equal(
    topLevelFeatureKeys.indexOf("quickPlay"),
    topLevelFeatureKeys.indexOf("updatePopups") + 1,
    "Experiences must begin directly after RoTool Update Popups"
  );
  contentHooks.setFeatureSettingsForTests({
    version: 1,
    flags: {
      ...contentHooks.defaultFeatureSettings,
      updatePopups: true
    }
  });
  fakeDocument.visibilityState = "hidden";
  assert.equal(contentHooks.syncExtensionUpdateHomeVisitState(), true);
  fakeDocument.visibilityState = "visible";
  const activeHomeVisitId =
    contentHooks.getExtensionUpdatePreferenceStateForTests().homeVisitId;
  assert.equal(typeof activeHomeVisitId, "string");
  assert.deepEqual(contentHooks.extensionUpdateFeedbackConstants, {
    feedbackId: "rsl-extension-update-feedback",
    fallbackClass: "rsl-extension-update-feedback--fallback",
    howToUpdateUrl: UPDATE_GUIDE,
    statusRetryMs: 60 * 60_000,
    statusMinTimerMs: 60_000,
    statusMaxTimerMs: 24 * 60 * 60_000,
    preferencesStorageKey: "rslExtensionUpdatePreferenceV1",
    preferencesStorageVersion: 1,
    defaultReminderFrequency: "6h",
    reminderFrequencyOptions: [
      { value: "home", label: "Every Home visit" },
      { value: "30m", label: "Every 30 minutes" },
      { value: "1h", label: "Every hour" },
      { value: "6h", label: "Every 6 hours (default)" },
      { value: "24h", label: "Every 24 hours" }
    ],
    messageTypes: {
      status: constants.messageType,
      preferencesGet: constants.preferencesGetMessageType,
      preferencesSet: constants.preferencesSetMessageType,
      contextChallenge: constants.contextChallengeMessageType
    }
  });
  for (const frequency of ["home", "30m", "1h", "6h", "24h"]) {
    assert.equal(
      contentHooks.normalizeExtensionUpdateReminderFrequency(frequency),
      frequency
    );
    assert.deepEqual(
      plain(contentHooks.normalizeExtensionUpdatePreferences({
        version: 1,
        frequency,
        revision: 12
      })),
      { frequency, revision: 12 }
    );
    assert.deepEqual(
      plain(contentHooks.normalizeExtensionUpdatePreferencesResponse({
        ok: true,
        frequency,
        revision: 12
      })),
      { frequency, revision: 12 }
    );
  }
  for (const invalidPreferenceResponse of [
    null,
    { ok: false, frequency: "6h", revision: 0 },
    { ok: true, frequency: "reload", revision: 0 },
    { ok: true, frequency: "6h", revision: -1 },
    { ok: true, frequency: "6h", revision: 0, extra: true }
  ]) {
    assert.equal(
      contentHooks.normalizeExtensionUpdatePreferencesResponse(
        invalidPreferenceResponse
      ),
      null
    );
  }
  assert.deepEqual(
    plain(contentHooks.normalizeExtensionUpdatePreferences({
      version: 0,
      frequency: "30m",
      revision: 9
    })),
    { frequency: "6h", revision: 0 },
    "invalid/legacy local records migrate to the default"
  );
  const serializedFlags = contentHooks.serializeFeatureSettings({
    ...contentHooks.defaultFeatureSettings,
    updateReminderFrequency: "30m"
  });
  assert.equal(Object.hasOwn(serializedFlags.flags, "updateReminderFrequency"), false);
  assert.equal(Object.hasOwn(serializedFlags, "frequency"), false);

  for (const pathname of ["/home", "/home/", "/de/home", "/pt-br/home/"]) {
    assert.equal(contentHooks.isRobloxHomePathname(pathname), true, pathname);
  }
  for (const pathname of [
    "/games/home", "/home/foo", "/xx/home", "//home", "/en/home/extra"
  ]) {
    assert.equal(contentHooks.isRobloxHomePathname(pathname), false, pathname);
  }
  assert.equal(
    contentHooks.isExtensionUpdateNavigationDestinationHome(
      "https://www.roblox.com/de/home?from=test#top"
    ),
    true
  );
  assert.equal(
    contentHooks.isExtensionUpdateNavigationDestinationHome(
      "https://www.roblox.com/games/home"
    ),
    false
  );
  assert.match(
    contentHooks.makeExtensionUpdateClaimContextId(activeHomeVisitId, 35),
    new RegExp(`^${activeHomeVisitId}-claim-z$`)
  );
  assert.equal(contentHooks.makeExtensionUpdateClaimContextId(null, 1), null);

  const renderStatus = {
    ok: true,
    current: manifest.version,
    latest: AVAILABLE_VERSION,
    updateAvailable: true,
    showNotice: true,
    howToUpdateUrl: "https://evil.invalid/ignored"
  };
  const feedback = contentHooks.renderExtensionUpdateFeedback(renderStatus);
  assert.equal(feedback.className, "sg-system-feedback rsl-extension-update-feedback");
  assert.equal(feedback.hidden, false);
  assert.equal(feedback.children.length, 1);
  assert.equal(feedback.children[0].className, "alert-system-feedback rsl-extension-update-feedback__inner");
  assert.equal(feedback.children[0].children.length, 1);
  const alert = feedback.children[0].children[0];
  assert.equal(alert.className, "alert alert-success on rsl-extension-update-feedback__alert");
  assert.equal(alert.children.length, 2);
  assert.equal(alert.getAttribute("role"), "status");
  assert.equal(alert.getAttribute("aria-live"), "polite");
  assert.equal(alert.getAttribute("aria-atomic"), "true");
  const content = alert.children[0];
  assert.equal(content.className, "alert-content rsl-extension-update-feedback__content");
  assert.equal(content.children[0].textContent, `RoTool ${AVAILABLE_VERSION} is available. `);
  const link = walk(feedback, (node) => node.tagName === "A")[0];
  assert.equal(link.href, UPDATE_GUIDE);
  assert.equal(link.textContent, "How to update");
  assert.equal(link.target, "_blank");
  assert.equal(link.rel, "noopener noreferrer");
  assert.equal(link.referrerPolicy, "no-referrer");
  const close = walk(feedback, (node) => node.getAttribute("role") === "button")[0];
  assert.equal(close.tagName, "SPAN");
  assert.equal(close.className, "icon-close-white rsl-extension-update-feedback__close");
  assert.equal(close.getAttribute("tabindex"), "0");
  assert.equal(close.textContent, "");
  assert.equal(
    close.getAttribute("aria-label"),
    `Dismiss RoTool ${AVAILABLE_VERSION} update notice`
  );
  assert.equal(
    contentHooks.hasNativeExtensionUpdateFeedbackStyles(
      feedback.children[0],
      alert,
      close
    ),
    true
  );
  assert.strictEqual(contentHooks.renderExtensionUpdateFeedback(renderStatus), feedback);
  assert.equal(animationFrames.size, 1, "same-version rerenders coalesce position work");
  contentHooks.renderExtensionUpdateFeedback(renderStatus);
  assert.equal(animationFrames.size, 1, "position work stays RAF-deduplicated");
  assert.equal(
    walk(fakeDocument.documentElement, (node) => node.id === "rsl-extension-update-feedback").length,
    1
  );

  close.listeners.get("click")({ isTrusted: false });
  close.listeners.get("keydown")({ isTrusted: false, key: "Enter" });
  close.listeners.get("keydown")({ isTrusted: true, key: "Escape" });
  assert.strictEqual(fakeDocument.getElementById("rsl-extension-update-feedback"), feedback);
  assert.equal(contentMessages, 0);
  const pendingFrameId = [...animationFrames.keys()][0];
  close.listeners.get("click")({ isTrusted: true });
  assert.equal(fakeDocument.getElementById("rsl-extension-update-feedback"), null);
  assert.ok(canceledFrames.includes(pendingFrameId));
  assert.equal(mutationObservers.at(-1).disconnectCount, 1);
  assert.equal(contentMessages, 0);

  nativeFeedbackStylesAvailable = false;
  const fallbackFeedback = contentHooks.renderExtensionUpdateFeedback(renderStatus);
  assert.equal(
    fallbackFeedback.className,
    "sg-system-feedback rsl-extension-update-feedback rsl-extension-update-feedback--fallback"
  );
  assert.equal(fallbackFeedback.hidden, false);
  contentHooks.removeExtensionUpdateFeedback();
  assert.equal(mutationObservers.at(-1).disconnectCount, 1);
  nativeFeedbackStylesAvailable = true;

  const nativeSurface = new FakeNode("div");
  nativeSurface.className = "sg-system-feedback";
  const nativeInner = new FakeNode("div");
  nativeInner.className = "alert-system-feedback";
  const nativeAlert = new FakeNode("div");
  nativeAlert.className = "alert alert-warning on";
  nativeAlert.rect = { top: 40, bottom: 88, left: 0, right: 970, width: 970, height: 48 };
  nativeInner.append(nativeAlert);
  nativeSurface.append(nativeInner);
  fakeDocument.body.append(nativeSurface);

  const collisionFeedback = contentHooks.renderExtensionUpdateFeedback(renderStatus);
  assert.equal(collisionFeedback.hidden, true, "an active Roblox alert takes precedence");
  assert.equal(contentHooks.isActiveNativeSystemFeedbackAlert(nativeAlert), true);
  const collisionObserver = mutationObservers.at(-1);
  assert.ok(
    collisionObserver.observations.some(({ target }) => target === nativeSurface),
    "the native surface is observed for class/visibility lifecycle changes"
  );
  assert.equal(
    collisionObserver.observations.some(({ target }) => target === collisionFeedback),
    false,
    "the owned surface is never observed as a native collision"
  );

  nativeAlert.className = "alert alert-warning";
  collisionObserver.callback([]);
  const clearCollisionFrameId = [...animationFrames.keys()][0];
  const clearCollisionFrame = animationFrames.get(clearCollisionFrameId);
  animationFrames.delete(clearCollisionFrameId);
  clearCollisionFrame();
  assert.equal(collisionFeedback.hidden, false, "the notice returns after native feedback closes");

  nativeAlert.className = "alert alert-warning on";
  collisionObserver.callback([]);
  collisionObserver.callback([]);
  assert.equal(animationFrames.size, 1, "collision mutations coalesce into one frame");
  const restoreCollisionFrameId = [...animationFrames.keys()][0];
  const restoreCollisionFrame = animationFrames.get(restoreCollisionFrameId);
  animationFrames.delete(restoreCollisionFrameId);
  restoreCollisionFrame();
  assert.equal(collisionFeedback.hidden, true);

  nativeSurface.hidden = true;
  collisionObserver.callback([]);
  const hiddenNativeFrameId = [...animationFrames.keys()][0];
  const hiddenNativeFrame = animationFrames.get(hiddenNativeFrameId);
  animationFrames.delete(hiddenNativeFrameId);
  hiddenNativeFrame();
  assert.equal(collisionFeedback.hidden, false, "hidden native surfaces do not block RoTool");
  nativeSurface.hidden = false;
  nativeSurface.remove();
  contentHooks.syncExtensionUpdateFeedbackPosition();
  assert.equal(collisionFeedback.hidden, false, "native surface removal cannot strand the notice hidden");

  const oldFeedback = collisionFeedback;
  const replacement = contentHooks.renderExtensionUpdateFeedback({
    ...renderStatus,
    latest: REPLACEMENT_VERSION
  });
  assert.notStrictEqual(replacement, oldFeedback);
  assert.equal(oldFeedback.parentElement, null);
  assert.strictEqual(fakeDocument.getElementById("rsl-extension-update-feedback"), replacement);
  assert.equal(
    walk(fakeDocument.documentElement, (node) => node.id === "rsl-extension-update-feedback").length,
    1
  );

  const replacementClose = walk(
    replacement,
    (node) => node.getAttribute("role") === "button"
  )[0];
  let spacePrevented = 0;
  replacementClose.listeners.get("keydown")({
    isTrusted: true,
    key: " ",
    preventDefault() { spacePrevented += 1; }
  });
  assert.equal(spacePrevented, 1);
  assert.equal(fakeDocument.getElementById("rsl-extension-update-feedback"), null);
  assert.equal(contentMessages, 0, "mouse and keyboard dismissal remain local");

  const settingsDialog = new FakeNode("dialog");
  settingsDialog.id = "rsl-feature-settings-dialog";
  const settingsTitleRow = new FakeNode("div");
  settingsTitleRow.className = "rsl-feature-settings__title-row";
  const settingsUpdateRow = new FakeNode("div");
  settingsUpdateRow.className = "rsl-feature-settings__update";
  settingsUpdateRow.setAttribute("data-rsl-feature-settings-update", "");
  settingsUpdateRow.hidden = true;
  const settingsUpdateCopy = new FakeNode("span");
  settingsUpdateCopy.setAttribute("role", "status");
  settingsUpdateCopy.setAttribute("aria-live", "polite");
  settingsUpdateCopy.setAttribute("aria-atomic", "true");
  const settingsUpdateTitle = new FakeNode("strong");
  settingsUpdateTitle.textContent = "Update available";
  const settingsUpdateMessage = new FakeNode("span");
  settingsUpdateMessage.setAttribute("data-rsl-feature-settings-update-message", "");
  const settingsUpdateLink = new FakeNode("a");
  settingsUpdateLink.setAttribute("data-rsl-feature-settings-update-link", "");
  settingsUpdateLink.textContent = "How to update";
  settingsUpdateLink.href = UPDATE_GUIDE;
  settingsUpdateLink.target = "_blank";
  settingsUpdateLink.rel = "noopener noreferrer";
  settingsUpdateLink.referrerPolicy = "no-referrer";
  settingsUpdateCopy.append(settingsUpdateTitle, settingsUpdateMessage);
  settingsUpdateRow.append(settingsUpdateCopy, settingsUpdateLink);
  const settingsGroups = new FakeNode("div");
  settingsGroups.className = "rsl-feature-settings__groups";
  settingsDialog.append(settingsTitleRow, settingsUpdateRow, settingsGroups);
  fakeDocument.body.append(settingsDialog);
  assert.deepEqual(settingsDialog.children, [
    settingsTitleRow,
    settingsUpdateRow,
    settingsGroups
  ]);
  assert.equal(settingsUpdateRow.querySelectorAll("[data-rsl-feature-key]").length, 0);
  assert.equal(settingsUpdateCopy.getAttribute("role"), "status");
  assert.equal(settingsUpdateCopy.getAttribute("aria-live"), "polite");
  assert.equal(settingsUpdateCopy.getAttribute("aria-atomic"), "true");
  assert.equal(settingsUpdateTitle.textContent, "Update available");
  assert.equal(settingsUpdateLink.textContent, "How to update");
  assert.equal(settingsUpdateLink.href, UPDATE_GUIDE);
  const settingsSaveStatus = new FakeNode("p");
  settingsSaveStatus.setAttribute("data-rsl-feature-settings-status", "");
  settingsDialog.append(settingsSaveStatus);

  const statusNow = Date.now();
  const makeContentStatus = ({
    latest = AVAILABLE_VERSION,
    checkedAt = statusNow,
    showNotice = false,
    frequency = "6h",
    preferenceRevision = 0
  } = {}) => {
    const updateAvailable = Boolean(
      latest && contentHooks.compareExtensionUpdateVersions(latest, manifest.version) > 0
    );
    return {
      ok: true,
      current: manifest.version,
      latest,
      updateAvailable,
      showNotice: updateAvailable && showNotice,
      frequency,
      preferenceRevision,
      checkedAt,
      nextNoticeAt:
        updateAvailable && frequency !== "home"
          ? statusNow + constants.presentationTtlMs
          : null,
      nextCheckAt: statusNow + constants.cacheTtlMs,
      howToUpdateUrl: UPDATE_GUIDE
    };
  };

  contentHooks.resetExtensionUpdateStatusForTests();
  assert.equal(settingsUpdateRow.hidden, true, "unknown status keeps the row hidden");
  assert.equal(settingsUpdateMessage.textContent, "");
  const knownStatus = makeContentStatus();
  for (const invalidStatus of [
    { ...knownStatus, current: "0.0.0" },
    { ...knownStatus, updateAvailable: false },
    { ...knownStatus, nextCheckAt: 0 },
    { ...knownStatus, nextNoticeAt: null },
    { ...knownStatus, howToUpdateUrl: "https://evil.invalid/ignored" },
    {
      ...makeContentStatus({ latest: manifest.version }),
      nextNoticeAt: statusNow + constants.presentationTtlMs
    }
  ]) {
    assert.equal(contentHooks.normalizeExtensionUpdateStatus(invalidStatus), null);
  }
  assert.deepEqual(contentHooks.applyExtensionUpdateStatus(knownStatus), {
    ok: true,
    current: manifest.version,
    latest: AVAILABLE_VERSION,
    updateAvailable: true,
    showNotice: false,
    frequency: "6h",
    preferenceRevision: 0,
    checkedAt: statusNow,
    nextNoticeAt: statusNow + constants.presentationTtlMs,
    nextCheckAt: statusNow + constants.cacheTtlMs
  });
  assert.equal(settingsUpdateRow.hidden, false);
  assert.equal(
    settingsUpdateMessage.textContent,
    `RoTool ${AVAILABLE_VERSION} is available.`
  );
  assert.equal(
    settingsUpdateRow.getAttribute("data-rsl-extension-update-version"),
    AVAILABLE_VERSION
  );

  const emptyFailure = makeContentStatus({ latest: null, checkedAt: null });
  assert.equal(
    contentHooks.applyExtensionUpdateStatus(emptyFailure).latest,
    AVAILABLE_VERSION,
    "an empty failed check preserves a stale known update"
  );
  assert.equal(settingsUpdateRow.hidden, false);
  assert.equal(
    settingsUpdateMessage.textContent,
    `RoTool ${AVAILABLE_VERSION} is available.`
  );
  assert.equal(
    contentHooks.applyExtensionUpdateStatus(
      makeContentStatus({ latest: manifest.version, checkedAt: statusNow - 1 })
    ).latest,
    AVAILABLE_VERSION,
    "an older cross-surface response cannot clear newer update data"
  );
  assert.equal(
    contentHooks.applyExtensionUpdateStatus(
      makeContentStatus({ latest: null, checkedAt: statusNow })
    ).latest,
    AVAILABLE_VERSION,
    "an equal-time missing release cannot overwrite a known release"
  );
  assert.equal(
    contentHooks.applyExtensionUpdateStatus(
      makeContentStatus({ latest: manifest.version, checkedAt: statusNow })
    ).latest,
    AVAILABLE_VERSION,
    "an equal-time lower release cannot overwrite a newer release"
  );
  const laterCurrent = contentHooks.applyExtensionUpdateStatus(
    makeContentStatus({ latest: manifest.version, checkedAt: statusNow + 1 })
  );
  assert.equal(laterCurrent.updateAvailable, false);
  assert.equal(settingsUpdateRow.hidden, true,
    "a later successful no-update response may clear the row");
  assert.equal(settingsUpdateMessage.textContent, "");

  contentHooks.applyExtensionUpdateStatus({
    ...knownStatus,
    checkedAt: statusNow + 2,
    nextNoticeAt: statusNow + constants.presentationTtlMs + 2,
    nextCheckAt: statusNow + constants.cacheTtlMs + 2
  });
  const settingsPopup = contentHooks.renderExtensionUpdateFeedback(renderStatus);
  const settingsMessages = [];
  contentMessageHandler = (message, callback) => {
    contentMessages += 1;
    settingsMessages.push(plain(message));
    callback({
      ...knownStatus,
      checkedAt: statusNow + 3,
      nextNoticeAt: statusNow + constants.presentationTtlMs + 3,
      nextCheckAt: statusNow + constants.cacheTtlMs + 3,
      showNotice: false
    });
  };
  await contentHooks.refreshFeatureSettingsUpdateStatus();
  assert.deepEqual(settingsMessages, [{
    type: constants.messageType,
    pageVisible: true,
    claimNotice: false,
    claimContextId: null,
    homeVisitId: activeHomeVisitId,
    expectedFrequency: "6h"
  }]);
  assert.strictEqual(
    fakeDocument.getElementById("rsl-extension-update-feedback"),
    settingsPopup,
    "a Settings-only status response never removes the current popup"
  );
  assert.equal(settingsUpdateRow.hidden, false);
  assert.equal(
    settingsUpdateMessage.textContent,
    `RoTool ${AVAILABLE_VERSION} is available.`
  );

  const settingsPopupClose = walk(
    settingsPopup,
    (node) => node.getAttribute("role") === "button"
  )[0];
  settingsPopupClose.listeners.get("click")({ isTrusted: true });
  assert.equal(fakeDocument.getElementById("rsl-extension-update-feedback"), null);
  assert.equal(settingsUpdateRow.hidden, false,
    "dismissing the popup leaves the Settings update row available");

  // Turning off Update popups changes only the top surface. Automatic checks
  // continue as non-claiming status reads, so they cannot consume the shared
  // six-hour presentation cooldown, while Settings keeps the known release.
  contentHooks.resetExtensionUpdateStatusForTests();
  contentHooks.setFeatureSettingsForTests({
    version: 1,
    flags: {
      ...contentHooks.defaultFeatureSettings,
      updatePopups: false
    }
  });
  const disabledPopupMessages = [];
  contentMessageHandler = (message, callback) => {
    contentMessages += 1;
    disabledPopupMessages.push(plain(message));
    callback({
      ...knownStatus,
      checkedAt: statusNow + 10,
      nextNoticeAt: statusNow + 60_000,
      nextCheckAt: statusNow + constants.cacheTtlMs + 10,
      // Even a malformed/compromised response cannot bypass the local flag.
      showNotice: true
    });
  };
  const disabledStatus = await contentHooks.refreshExtensionUpdateFeedback();
  assert.equal(disabledStatus.updateAvailable, true);
  assert.deepEqual(disabledPopupMessages, [{
    type: constants.messageType,
    pageVisible: true,
    claimNotice: false,
    claimContextId: null,
    homeVisitId: activeHomeVisitId,
    expectedFrequency: "6h"
  }]);
  assert.equal(
    fakeDocument.getElementById("rsl-extension-update-feedback"),
    null,
    "a disabled popup setting must never create the top banner"
  );
  assert.equal(
    contentHooks.renderExtensionUpdateFeedback(renderStatus),
    null,
    "direct rendering must also honor the current popup setting"
  );
  assert.equal(settingsUpdateRow.hidden, false,
    "the Settings update row is independent from the popup preference");
  assert.equal(
    settingsUpdateMessage.textContent,
    `RoTool ${AVAILABLE_VERSION} is available.`
  );

  // Switching off is synchronous: remove an existing banner before the local
  // storage write finishes, and reject a late response that started enabled.
  contentHooks.resetExtensionUpdateStatusForTests();
  contentHooks.setFeatureSettingsForTests({
    version: 1,
    flags: {
      ...contentHooks.defaultFeatureSettings,
      updatePopups: true
    }
  });
  const bannerBeforeDisable = contentHooks.renderExtensionUpdateFeedback(renderStatus);
  assert.ok(bannerBeforeDisable);
  let finishStalePopupRequest = null;
  const stalePopupMessages = [];
  contentMessageHandler = (message, callback) => {
    contentMessages += 1;
    stalePopupMessages.push(plain(message));
    if (message.claimNotice) {
      finishStalePopupRequest = callback;
      return;
    }
    callback({
      ...knownStatus,
      checkedAt: statusNow + 19,
      nextNoticeAt: statusNow + 60_000,
      nextCheckAt: statusNow + constants.cacheTtlMs + 19,
      showNotice: false
    });
  };
  const stalePopupRequest = contentHooks.refreshExtensionUpdateFeedback();
  assert.equal(stalePopupMessages.length, 1);
  assert.deepEqual(Object.keys(stalePopupMessages[0]).sort(), [
    "claimContextId", "claimNotice", "expectedFrequency", "homeVisitId",
    "pageVisible", "type"
  ]);
  assert.equal(stalePopupMessages[0].type, constants.messageType);
  assert.equal(stalePopupMessages[0].pageVisible, true);
  assert.equal(stalePopupMessages[0].claimNotice, true);
  assert.equal(stalePopupMessages[0].homeVisitId, activeHomeVisitId);
  assert.equal(stalePopupMessages[0].expectedFrequency, "6h");
  assert.match(stalePopupMessages[0].claimContextId, /-claim-[a-z0-9]+$/);

  let finishPopupDisableSave = null;
  contentFeatureStorageSetHandler = (values, callback) => {
    contentFeatureStorageWrites.push(plain(values));
    finishPopupDisableSave = callback;
  };
  const popupDisableSave = contentHooks.saveFeatureSettingsForTests({
    updatePopups: false
  });
  assert.equal(
    fakeDocument.getElementById("rsl-extension-update-feedback"),
    null,
    "switch-off must remove the banner before persistence completes"
  );
  for (let index = 0; index < 4 && !finishPopupDisableSave; index += 1) {
    await Promise.resolve();
  }
  assert.equal(typeof finishPopupDisableSave, "function");
  finishPopupDisableSave();
  const disabledSavedValue = await popupDisableSave;
  assert.equal(disabledSavedValue.flags.updatePopups, false);
  assert.deepEqual(
    stalePopupMessages.map(({ claimNotice }) => claimNotice),
    [true],
    "switch-off invalidates the in-flight claim before it can finish"
  );
  contentFeatureStorageSetHandler = (values, callback) => {
    contentFeatureStorageWrites.push(plain(values));
    callback?.();
  };

  finishStalePopupRequest({
    ...knownStatus,
    checkedAt: statusNow + 20,
    nextNoticeAt: statusNow + constants.presentationTtlMs + 20,
    nextCheckAt: statusNow + constants.cacheTtlMs + 20,
    showNotice: true
  });
  await stalePopupRequest;
  for (let index = 0; index < 10 && stalePopupMessages.length < 2; index += 1) {
    await Promise.resolve();
  }
  assert.deepEqual(
    stalePopupMessages.map(({ claimNotice }) => claimNotice),
    [true, false],
    "after stale work settles, switch-off re-arms cadence with one non-claiming status read"
  );
  assert.equal(
    fakeDocument.getElementById("rsl-extension-update-feedback"),
    null,
    "an enabled request resolving after switch-off must not recreate the banner"
  );
  assert.equal(settingsUpdateRow.hidden, false,
    "the late status still updates Settings while its stale popup is suppressed");

  // Re-enabling during an in-flight disabled read must invalidate it and queue
  // exactly one fresh claim after the stale read settles.
  contentHooks.resetExtensionUpdateStatusForTests();
  const reenableMessages = [];
  let finishDisabledInFlight = null;
  contentMessageHandler = (message, callback) => {
    contentMessages += 1;
    reenableMessages.push(plain(message));
    if (message.claimNotice === false) {
      finishDisabledInFlight = callback;
      return;
    }
    callback({
      ...knownStatus,
      checkedAt: statusNow + 31,
      nextNoticeAt: statusNow + constants.presentationTtlMs + 31,
      nextCheckAt: statusNow + constants.cacheTtlMs + 31,
      showNotice: true
    });
  };
  const disabledInFlight = contentHooks.refreshExtensionUpdateFeedback();
  assert.equal(typeof finishDisabledInFlight, "function");
  assert.deepEqual(reenableMessages.map(({ claimNotice }) => claimNotice), [false]);

  const enabledSavedValue = await contentHooks.saveFeatureSettingsForTests({
    updatePopups: true
  });
  assert.equal(enabledSavedValue.flags.updatePopups, true);
  assert.deepEqual(
    reenableMessages.map(({ claimNotice }) => claimNotice),
    [false],
    "re-enable must not overlap a pending no-claim read"
  );
  assert.equal(
    fakeDocument.getElementById("rsl-extension-update-feedback"),
    null,
    "the invalidated no-claim read cannot render while it is pending"
  );
  finishDisabledInFlight({
    ...knownStatus,
    checkedAt: statusNow + 30,
    nextNoticeAt: statusNow + 60_000,
    nextCheckAt: statusNow + constants.cacheTtlMs + 30,
    showNotice: false
  });
  await disabledInFlight;
  for (let index = 0; index < 10 && reenableMessages.length < 2; index += 1) {
    await Promise.resolve();
  }
  assert.deepEqual(
    reenableMessages.map(({ claimNotice }) => claimNotice),
    [false, true],
    "re-enable queues one fresh cooldown claim after the stale read settles"
  );
  for (
    let index = 0;
    index < 10 && !fakeDocument.getElementById("rsl-extension-update-feedback");
    index += 1
  ) {
    await Promise.resolve();
  }
  assert.ok(
    fakeDocument.getElementById("rsl-extension-update-feedback"),
    "the fresh claiming response must restore the enabled banner immediately"
  );
  const freshReenabledBanner = fakeDocument.getElementById(
    "rsl-extension-update-feedback"
  );
  assert.strictEqual(
    fakeDocument.getElementById("rsl-extension-update-feedback"),
    freshReenabledBanner,
    "the fresh enabled banner remains after the invalidated read settled"
  );
  assert.equal(settingsUpdateRow.hidden, false);

  // Preference revisions protect startup and save races. A delayed GET cannot
  // roll back a newer cross-tab value, and rapid saves stay serialized.
  contentHooks.resetExtensionUpdateStatusForTests();
  fakeDocument.visibilityState = "hidden";
  let finishStalePreferenceGet = null;
  contentMessageHandler = (message, callback) => {
    assert.deepEqual(plain(message), {
      type: constants.preferencesGetMessageType
    });
    finishStalePreferenceGet = callback;
  };
  const stalePreferenceLoad = contentHooks.loadExtensionUpdatePreferences();
  for (let index = 0; index < 6 && !finishStalePreferenceGet; index += 1) {
    await Promise.resolve();
  }
  assert.equal(typeof finishStalePreferenceGet, "function");
  contentHooks.handleExtensionUpdatePreferencesStorageChange({
    version: 1,
    frequency: "1h",
    revision: 100
  });
  finishStalePreferenceGet({ ok: true, frequency: "6h", revision: 0 });
  assert.deepEqual(await stalePreferenceLoad, {
    frequency: "1h",
    revision: 100
  });
  assert.equal(
    contentHooks.getExtensionUpdatePreferenceStateForTests().frequency,
    "1h"
  );

  const rapidPreferenceMessages = [];
  const rapidPreferenceCallbacks = [];
  contentMessageHandler = (message, callback) => {
    rapidPreferenceMessages.push(plain(message));
    rapidPreferenceCallbacks.push(callback);
  };
  const rapidSave30m = contentHooks.saveExtensionUpdateReminderFrequency("30m");
  const rapidSave1h = contentHooks.saveExtensionUpdateReminderFrequency("1h");
  for (let index = 0; index < 8 && rapidPreferenceCallbacks.length < 1; index += 1) {
    await Promise.resolve();
  }
  assert.equal(rapidPreferenceCallbacks.length, 1,
    "only the first serialized preference write starts immediately");
  rapidPreferenceCallbacks[0]({ ok: true, frequency: "30m", revision: 101 });
  for (let index = 0; index < 8 && rapidPreferenceCallbacks.length < 2; index += 1) {
    await Promise.resolve();
  }
  assert.equal(rapidPreferenceCallbacks.length, 2);
  rapidPreferenceCallbacks[1]({ ok: true, frequency: "1h", revision: 102 });
  assert.deepEqual(await Promise.all([rapidSave30m, rapidSave1h]), [
    { frequency: "30m", revision: 101 },
    { frequency: "1h", revision: 102 }
  ]);
  assert.deepEqual(rapidPreferenceMessages, [
    { type: constants.preferencesSetMessageType, frequency: "30m" },
    { type: constants.preferencesSetMessageType, frequency: "1h" }
  ]);
  assert.equal(
    contentHooks.getExtensionUpdatePreferenceStateForTests().frequency,
    "1h"
  );

  // If SET is lost but a higher-revision storage event arrives, that event is
  // adopted, promoted as the rollback base, and recomputes cadence even when
  // its frequency matches the optimistic selection.
  contentHooks.handleExtensionUpdatePreferencesStorageChange({
    version: 1,
    frequency: "6h",
    revision: 200
  });
  fakeDocument.visibilityState = "visible";
  const deferredRaceMessages = [];
  let finishLostPreferenceSet = null;
  contentMessageHandler = (message, callback) => {
    deferredRaceMessages.push(plain(message));
    if (message.type === constants.preferencesSetMessageType) {
      finishLostPreferenceSet = callback;
      return;
    }
    assert.equal(message.type, constants.messageType);
    callback(makeContentStatus({
      frequency: "home",
      preferenceRevision: 201,
      showNotice: false,
      checkedAt: statusNow + 40
    }));
  };
  const lostPreferenceSave =
    contentHooks.saveExtensionUpdateReminderFrequency("home");
  for (let index = 0; index < 8 && !finishLostPreferenceSet; index += 1) {
    await Promise.resolve();
  }
  contentHooks.handleExtensionUpdatePreferencesStorageChange({
    version: 1,
    frequency: "home",
    revision: 201
  });
  finishLostPreferenceSet(null);
  assert.equal(await lostPreferenceSave, null);
  for (
    let index = 0;
    index < 12 && !deferredRaceMessages.some(({ type }) => type === constants.messageType);
    index += 1
  ) {
    await Promise.resolve();
  }
  const deferredCadenceRequest = deferredRaceMessages.find(
    ({ type }) => type === constants.messageType
  );
  assert.ok(deferredCadenceRequest,
    "the higher-revision deferred winner forces one cadence recompute");
  assert.equal(deferredCadenceRequest.expectedFrequency, "home");
  assert.equal(deferredCadenceRequest.claimNotice, true);
  assert.deepEqual(
    contentHooks.getExtensionUpdatePreferenceStateForTests(),
    {
      ...contentHooks.getExtensionUpdatePreferenceStateForTests(),
      frequency: "home",
      revision: 201
    }
  );

  fakeDocument.visibilityState = "hidden";
  contentMessageHandler = (message, callback) => {
    assert.deepEqual(plain(message), {
      type: constants.preferencesSetMessageType,
      frequency: "24h"
    });
    callback(null);
  };
  assert.equal(
    await contentHooks.saveExtensionUpdateReminderFrequency("24h"),
    null
  );
  assert.equal(
    contentHooks.getExtensionUpdatePreferenceStateForTests().frequency,
    "home",
    "a later failed save rolls back to the promoted deferred winner"
  );
  assert.equal(
    contentHooks.getExtensionUpdatePreferenceStateForTests().revision,
    201
  );

  // The Boolean and frequency persistence channels report one truthful final
  // result: a later Boolean success cannot hide an earlier frequency failure.
  let finishBooleanSave = null;
  let finishFrequencyFailure = null;
  contentFeatureStorageSetHandler = (values, callback) => {
    contentFeatureStorageWrites.push(plain(values));
    finishBooleanSave = callback;
  };
  contentMessageHandler = (message, callback) => {
    assert.equal(message.type, constants.preferencesSetMessageType);
    finishFrequencyFailure = callback;
  };
  const booleanSave = contentHooks.saveFeatureSettingsForTests({
    friendFilters: !contentHooks.defaultFeatureSettings.friendFilters
  });
  const frequencyFailure =
    contentHooks.saveExtensionUpdateReminderFrequency("30m");
  for (
    let index = 0;
    index < 10 && (!finishBooleanSave || !finishFrequencyFailure);
    index += 1
  ) {
    await Promise.resolve();
  }
  finishFrequencyFailure(null);
  assert.equal(await frequencyFailure, null);
  finishBooleanSave();
  await booleanSave;
  assert.equal(settingsSaveStatus.textContent, "That setting could not be saved.");
  assert.equal(
    settingsSaveStatus.classList.contains(
      "rsl-feature-settings__status--error"
    ),
    true
  );
  assert.equal(
    contentHooks.getExtensionUpdatePreferenceStateForTests().frequency,
    "home",
    "the independent Boolean success does not alter the retained frequency"
  );
  contentFeatureStorageSetHandler = (values, callback) => {
    contentFeatureStorageWrites.push(plain(values));
    callback?.();
  };
  contentHooks.handleExtensionUpdatePreferencesStorageChange({
    version: 1,
    frequency: "6h",
    revision: 202
  });
  fakeDocument.visibilityState = "visible";

  const originalDateNow = Date.now;
  let timerNow = originalDateNow();
  Date.now = () => timerNow;
  try {
    contentHooks.resetExtensionUpdateStatusForTests();
    timeouts.clear();
    clearedTimeouts.length = 0;
    contentHooks.setFeatureSettingsForTests({
      version: 1,
      flags: {
        ...contentHooks.defaultFeatureSettings,
        updatePopups: false
      }
    });
    contentHooks.scheduleExtensionUpdateStatusTimer({
      updateAvailable: true,
      nextNoticeAt: timerNow + 60_000,
      nextCheckAt: timerNow + 5 * 60 * 60_000
    });
    assert.equal(
      [...timeouts.values()][0].delay,
      5 * 60 * 60_000,
      "disabled popups schedule only the next release check, never nextNoticeAt"
    );
    contentHooks.setFeatureSettingsForTests({
      version: 1,
      flags: {
        ...contentHooks.defaultFeatureSettings,
        updatePopups: true
      }
    });
    contentHooks.scheduleExtensionUpdateStatusTimer({
      updateAvailable: true,
      nextNoticeAt: timerNow + constants.presentationTtlMs,
      nextCheckAt: timerNow + constants.cacheTtlMs
    });
    assert.equal(timeouts.size, 1);
    assert.equal([...timeouts.values()][0].delay, constants.presentationTtlMs);
    const sixHourTimerId = [...timeouts.keys()][0];

    contentHooks.scheduleExtensionUpdateStatusTimer({
      updateAvailable: true,
      nextNoticeAt: timerNow + 2 * 60 * 60_000,
      nextCheckAt: timerNow + constants.cacheTtlMs
    });
    assert.equal(timeouts.size, 1, "rescheduling replaces rather than stacks timers");
    assert.ok(clearedTimeouts.includes(sixHourTimerId));
    assert.equal([...timeouts.values()][0].delay, 2 * 60 * 60_000);

    contentHooks.scheduleExtensionUpdateStatusTimer({
      updateAvailable: true,
      nextNoticeAt: timerNow,
      nextCheckAt: timerNow
    });
    assert.equal([...timeouts.values()][0].delay, 60_000,
      "an immediately due status still uses the one-minute floor");
    contentHooks.scheduleExtensionUpdateStatusTimer({
      updateAvailable: false,
      nextNoticeAt: null,
      nextCheckAt: timerNow + 48 * 60 * 60_000
    });
    assert.equal([...timeouts.values()][0].delay, 24 * 60 * 60_000,
      "a corrupt far-future due time is capped at 24 hours");

    const timedCadenceMessages = [];
    contentMessageHandler = (message, callback) => {
      timedCadenceMessages.push(plain(message));
      callback(makeContentStatus({
        latest: manifest.version,
        checkedAt: timerNow
      }));
    };
    contentHooks.scheduleExtensionUpdateStatusTimer({
      updateAvailable: true,
      nextNoticeAt: timerNow + 60_000,
      nextCheckAt: timerNow + constants.cacheTtlMs
    });
    let [dueNoticeTimerId, dueNoticeTimer] = [...timeouts.entries()][0];
    timerNow += 60_001;
    timeouts.delete(dueNoticeTimerId);
    dueNoticeTimer.callback();
    for (let index = 0; index < 8 && timedCadenceMessages.length < 1; index += 1) {
      await Promise.resolve();
    }
    assert.equal(timedCadenceMessages[0].claimNotice, true,
      "a nextNoticeAt timer claims the due timed reminder instead of spinning");
    for (let index = 0; index < 6; index += 1) {
      await Promise.resolve();
    }

    contentHooks.scheduleExtensionUpdateStatusTimer({
      updateAvailable: true,
      nextNoticeAt: timerNow + 6 * 60 * 60_000,
      nextCheckAt: timerNow + 60_000
    });
    let [dueCheckTimerId, dueCheckTimer] = [...timeouts.entries()][0];
    timerNow += 60_001;
    timeouts.delete(dueCheckTimerId);
    dueCheckTimer.callback();
    for (let index = 0; index < 8 && timedCadenceMessages.length < 2; index += 1) {
      await Promise.resolve();
    }
    assert.equal(timedCadenceMessages[1].claimNotice, false,
      "a nextCheckAt timer refreshes status without consuming a reminder");
    for (let index = 0; index < 6; index += 1) {
      await Promise.resolve();
    }

    contentHooks.scheduleExtensionUpdateStatusTimer({
      updateAvailable: false,
      nextNoticeAt: null,
      nextCheckAt: timerNow + 60_000
    });
    const [hiddenTimerId, hiddenTimer] = [...timeouts.entries()][0];
    timerNow += 60_001;
    fakeDocument.visibilityState = "hidden";
    timeouts.delete(hiddenTimerId);
    hiddenTimer.callback();
    const messagesBeforeVisible = settingsMessages.length;
    assert.equal(timeouts.size, 0);
    contentHooks.requestExtensionUpdateStatusWhenVisible();
    assert.equal(settingsMessages.length, messagesBeforeVisible,
      "a hidden page neither requests nor starts another timer");

    fakeDocument.visibilityState = "visible";
    contentMessageHandler = (message, callback) => {
      contentMessages += 1;
      settingsMessages.push(plain(message));
      callback({
        ...makeContentStatus({ latest: manifest.version, checkedAt: timerNow }),
        nextCheckAt: timerNow + constants.failureRetryMs
      });
    };
    contentHooks.requestExtensionUpdateStatusWhenVisible();
    for (let index = 0; index < 6; index += 1) await Promise.resolve();
    const visibleRequest = settingsMessages.at(-1);
    assert.equal(visibleRequest.type, constants.messageType);
    assert.equal(visibleRequest.pageVisible, true);
    assert.equal(visibleRequest.claimNotice, true);
    assert.equal(visibleRequest.homeVisitId, activeHomeVisitId);
    assert.equal(visibleRequest.expectedFrequency, "6h");
    assert.match(visibleRequest.claimContextId, /-claim-[a-z0-9]+$/);
    assert.equal(timeouts.size, 1,
      "becoming visible services the deferred due check and arms one timer");
    assert.equal([...timeouts.values()][0].delay, constants.failureRetryMs);
  } finally {
    Date.now = originalDateNow;
  }

  // Home route lifecycle: same-Home URL churn is one visit; committed exits
  // remove/invalidate and re-arm status-only cadence; returning creates one
  // new claim-capable visit. Game pages never claim or render.
  contentHooks.resetExtensionUpdateStatusForTests();
  setFakeLocation("https://www.roblox.com/home");
  contentHooks.syncExtensionUpdateHomeVisitState();
  const stableHomeVisit =
    contentHooks.getExtensionUpdatePreferenceStateForTests().homeVisitId;
  setFakeLocation("https://www.roblox.com/home?tab=friends#top");
  assert.equal(contentHooks.syncExtensionUpdateHomeVisitState(), false);
  assert.equal(
    contentHooks.getExtensionUpdatePreferenceStateForTests().homeVisitId,
    stableHomeVisit,
    "query/hash changes on exact Home do not start another visit"
  );

  const routeLifecycleMessages = [];
  contentMessageHandler = (message, callback) => {
    routeLifecycleMessages.push(plain(message));
    callback(makeContentStatus({
      latest: manifest.version,
      checkedAt: Date.now(),
      frequency:
        contentHooks.getExtensionUpdatePreferenceStateForTests().frequency,
      preferenceRevision:
        contentHooks.getExtensionUpdatePreferenceStateForTests().revision
    }));
  };
  contentHooks.handleExtensionUpdateNavigationStart({
    destination: { url: "https://www.roblox.com/games/123/example" }
  });
  assert.equal(
    contentHooks.getExtensionUpdatePreferenceStateForTests()
      .navigationAwayFromHome,
    true
  );
  setFakeLocation("https://www.roblox.com/games/123/example");
  contentHooks.handleExtensionUpdateNavigationSettled();
  for (let index = 0; index < 10 && routeLifecycleMessages.length < 1; index += 1) {
    await Promise.resolve();
  }
  assert.equal(
    contentHooks.getExtensionUpdatePreferenceStateForTests().homeVisitId,
    null
  );
  assert.equal(routeLifecycleMessages[0].claimNotice, false,
    "a committed Home exit performs one status-only cadence refresh");
  assert.equal(routeLifecycleMessages[0].homeVisitId, null);
  assert.equal(contentHooks.renderExtensionUpdateFeedback(renderStatus), null,
    "a game route cannot render even a direct showNotice response");

  routeLifecycleMessages.length = 0;
  setFakeLocation("https://www.roblox.com/de/home");
  contentHooks.handleExtensionUpdateNavigationSettled();
  for (let index = 0; index < 10 && routeLifecycleMessages.length < 1; index += 1) {
    await Promise.resolve();
  }
  const returnedHomeVisit =
    contentHooks.getExtensionUpdatePreferenceStateForTests().homeVisitId;
  assert.notEqual(returnedHomeVisit, stableHomeVisit);
  assert.equal(routeLifecycleMessages[0].claimNotice, true);
  assert.equal(routeLifecycleMessages[0].homeVisitId, returnedHomeVisit);
  routeLifecycleMessages.length = 0;
  setFakeLocation("https://www.roblox.com/de/home?same=visit#mutation");
  assert.equal(contentHooks.syncExtensionUpdateHomeVisitState(), false);
  await Promise.resolve();
  assert.equal(routeLifecycleMessages.length, 0,
    "same-Home mutations never enqueue another visit refresh");

  // Known latest + in-flight Every-Home claim + canceled navigate-away: the
  // old context is rejected, the visit token survives, and the same version is
  // retryable in that preserved visit.
  fakeDocument.visibilityState = "hidden";
  contentHooks.handleExtensionUpdatePreferencesStorageChange({
    version: 1,
    frequency: "home",
    revision: 203
  });
  fakeDocument.visibilityState = "visible";
  contentHooks.resetExtensionUpdateStatusForTests();
  contentHooks.applyExtensionUpdateStatus(makeContentStatus({
    latest: AVAILABLE_VERSION,
    checkedAt: Date.now() + 1,
    frequency: "home",
    preferenceRevision: 203
  }));
  let finishCanceledClaim = null;
  const canceledClaimMessages = [];
  contentMessageHandler = (message, callback) => {
    canceledClaimMessages.push(plain(message));
    finishCanceledClaim = callback;
  };
  const canceledClaimRequest = contentHooks.refreshExtensionUpdateFeedback();
  assert.equal(canceledClaimMessages.length, 1);
  const pendingCanceledClaim = canceledClaimMessages[0];
  assert.equal(pendingCanceledClaim.claimNotice, true);
  assert.equal(pendingCanceledClaim.expectedFrequency, "home");
  const preservedCanceledVisit = pendingCanceledClaim.homeVisitId;

  let exactChallengeResponse = null;
  assert.equal(contentHooks.handleExtensionUpdateClaimContextChallenge({
    type: constants.contextChallengeMessageType,
    claimContextId: pendingCanceledClaim.claimContextId,
    homeVisitId: preservedCanceledVisit,
    expectedFrequency: "home"
  }, { id: globalThis.chrome.runtime.id }, (response) => {
    exactChallengeResponse = plain(response);
  }), false);
  assert.deepEqual(exactChallengeResponse, { ok: true });
  for (const challengeMutation of [
    { claimContextId: "context-stale-abcdef" },
    { homeVisitId: "visit-wrong-abcdef" },
    { expectedFrequency: "6h" }
  ]) {
    let rejectedResponse = null;
    contentHooks.handleExtensionUpdateClaimContextChallenge({
      type: constants.contextChallengeMessageType,
      claimContextId: pendingCanceledClaim.claimContextId,
      homeVisitId: preservedCanceledVisit,
      expectedFrequency: "home",
      ...challengeMutation
    }, { id: globalThis.chrome.runtime.id }, (response) => {
      rejectedResponse = plain(response);
    });
    assert.deepEqual(rejectedResponse, { ok: false });
  }
  let malformedChallengeResponse = null;
  assert.equal(contentHooks.handleExtensionUpdateClaimContextChallenge({
    type: constants.contextChallengeMessageType,
    claimContextId: pendingCanceledClaim.claimContextId,
    homeVisitId: preservedCanceledVisit,
    expectedFrequency: "home",
    extra: true
  }, { id: globalThis.chrome.runtime.id }, (response) => {
    malformedChallengeResponse = plain(response);
  }), false);
  assert.equal(malformedChallengeResponse, null,
    "a malformed challenge is ignored without any response");

  contentHooks.handleExtensionUpdateNavigationStart({
    destination: { url: "https://www.roblox.com/games/123/example" }
  });
  const afterCanceledStart =
    contentHooks.getExtensionUpdatePreferenceStateForTests();
  assert.equal(afterCanceledStart.navigationAwayFromHome, true);
  assert.equal(afterCanceledStart.homeVisitClaimAttempted, false);
  assert.equal(afterCanceledStart.homeVisitAttemptedLatest, null);
  let staleChallengeResponse = null;
  contentHooks.handleExtensionUpdateClaimContextChallenge({
    type: constants.contextChallengeMessageType,
    claimContextId: pendingCanceledClaim.claimContextId,
    homeVisitId: preservedCanceledVisit,
    expectedFrequency: "home"
  }, { id: globalThis.chrome.runtime.id }, (response) => {
    staleChallengeResponse = plain(response);
  });
  assert.deepEqual(staleChallengeResponse, { ok: false });

  // Directly settle against the unchanged URL; the source contract above
  // locks navigateerror to the same settle+forced-retry semantics.
  contentHooks.handleExtensionUpdateNavigationSettled();
  assert.equal(
    contentHooks.getExtensionUpdatePreferenceStateForTests().homeVisitId,
    preservedCanceledVisit
  );
  finishCanceledClaim(makeContentStatus({
    latest: AVAILABLE_VERSION,
    checkedAt: Date.now() + 2,
    frequency: "home",
    preferenceRevision: 203
  }));
  await canceledClaimRequest;
  canceledClaimMessages.length = 0;
  let finishRetriedClaim = null;
  contentMessageHandler = (message, callback) => {
    canceledClaimMessages.push(plain(message));
    finishRetriedClaim = callback;
  };
  const retriedCanceledClaim = contentHooks.refreshExtensionUpdateFeedback();
  assert.equal(canceledClaimMessages[0].claimNotice, true);
  assert.equal(canceledClaimMessages[0].homeVisitId, preservedCanceledVisit);
  finishRetriedClaim(makeContentStatus({
    latest: AVAILABLE_VERSION,
    checkedAt: Date.now() + 3,
    frequency: "home",
    preferenceRevision: 203
  }));
  await retriedCanceledClaim;

  contentHooks.resetExtensionUpdateStatusForTests();
  assert.equal(
    contentHooks.getExtensionUpdatePreferenceStateForTests()
      .timerAllowsNoticeClaim,
    false,
    "update-status cleanup resets its claim-capable timer state"
  );

  Object.assign(globalThis, originalGlobals);
  console.log(
    "PASS RoTool cached recurring update notice, Settings status, timer, and concise guide contracts"
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
