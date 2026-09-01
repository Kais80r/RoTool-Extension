"use strict";

const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { TextDecoder, TextEncoder } = require("node:util");

const root = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const manifest = JSON.parse(read("manifest.json"));
const background = read("background.js");
const html = read("recovery-archive.html");
const css = read("recovery-archive.css");
const source = read("recovery-archive.js");

const ARCHIVE_PAGE = "recovery-archive.html";
const SECTION_KEYS = Object.freeze([
  "usernameHistory",
  "twoStepVerification",
  "purchases",
  "currencyPurchases",
  "tradeHistory",
  "recentlyPlayed",
  "createdExperiences",
  "violations"
]);
const DEFAULT_SECTION_KEYS = [...SECTION_KEYS];

function plain(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function getWebAccessibleResources(manifestValue) {
  return (manifestValue.web_accessible_resources || []).flatMap(
    (entry) => entry.resources || []
  );
}

assert.ok(manifest.action, "Recovery Archive must be reachable from the toolbar");
assert.match(
  String(manifest.action.default_title || ""),
  /recovery|rotool/i,
  "the toolbar action needs a useful accessible title"
);
assert.equal(manifest.permissions.includes("downloads"), false);
assert.equal(manifest.permissions.includes("cookies"), false);
assert.equal(
  getWebAccessibleResources(manifest).some((resource) =>
    /^recovery-archive(?:\.|$)/i.test(resource)
  ),
  false,
  "private archive files must never be web-accessible to Roblox pages"
);

assert.match(
  background,
  /const ACCOUNT_RECOVERY_ARCHIVE_PAGE_PATH = "recovery-archive\.html";/
);
assert.match(
  background,
  /const ACCOUNT_RECOVERY_ARCHIVE_DEFAULT_FREQUENCY = "daily";/
);
assert.match(
  background,
  /const ACCOUNT_RECOVERY_ARCHIVE_DEFAULT_RETENTION = 5;/
);
assert.match(
  background,
  /const ACCOUNT_RECOVERY_ARCHIVE_ALARM_PERIOD_MINUTES = 24 \* 60;/
);
assert.match(
  background,
  /const ACCOUNT_RECOVERY_ARCHIVE_DEFAULT_SECTIONS = Object\.freeze\(\[\s*\.\.\.ACCOUNT_RECOVERY_SECTION_KEYS\s*\]\);/s
);
assert.match(
  background,
  /const ACCOUNT_RECOVERY_ARCHIVE_PREFERENCES_VERSION = 2;/,
  "capture-category preferences need an explicit migrated schema"
);
assert.match(
  background,
  /let accountRecoveryArchiveFeatureEnabled = false;/,
  "automatic archive capture must fail closed until the user enables it"
);
assert.match(source, /let automaticSnapshotsEnabled = false;/);
assert.doesNotMatch(
  source,
  /let recoverySnapshotsEnabled\b/,
  "the archive Create button must not maintain a Recovery-master lock state"
);
assert.match(
  source,
  /automaticSnapshotsEnabled:\s*response\?\.recoverySnapshotsEnabled === true\s*&&\s*response\?\.preferences\?\.enabled === true/,
  "the archive must still show automatic snapshots as effectively off when the master is off"
);
assert.doesNotMatch(
  source,
  /recoverySnapshotsEnabled:\s*response\?\.recoverySnapshotsEnabled/,
  "the archive UI must not gate deliberate manual captures on the Recovery master"
);
const archiveDisabledStateSource = source.slice(
  source.indexOf("  function syncDisabledState()"),
  source.indexOf("  function clearPreview()")
);
assert.match(
  archiveDisabledStateSource,
  /elements\.create\.disabled\s*=\s*busy \|\| !initialized/,
  "Create must only wait for archive initialization or another active operation"
);
assert.doesNotMatch(
  archiveDisabledStateSource,
  /recoverySnapshotsEnabled/,
  "the Recovery master must not lock users out of creating, reading, exporting, or deleting evidence"
);
assert.match(background, /rslAccountRecoveryArchivePreferencesV1/);
assert.match(background, /rslRecoveryArchiveV1/);
assert.doesNotMatch(
  background,
  /chrome\.storage\.sync/,
  "account evidence must never enter Chrome sync storage"
);
assert.doesNotMatch(
  `${html}\n${css}\n${source}`,
  /\.ROBLOSECURITY|maskedEmailAddress|passwordHash|recoveryCode|csrfToken|authToken|sessionToken/i,
  "archive UI assets must not request, label, or export authentication secrets"
);

const csp = html.match(
  /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i
)?.[1];
assert.ok(csp, "the private archive page must declare a CSP");
for (const directive of [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "connect-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
]) {
  assert.ok(csp.includes(directive), `missing archive CSP directive: ${directive}`);
}
assert.doesNotMatch(csp, /'unsafe-inline'|'unsafe-eval'|\*/i);
assert.match(html, /<script src="recovery-archive\.js" defer><\/script>/);
assert.match(html, /<link rel="stylesheet" href="recovery-archive\.css">/);
assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);

assert.doesNotMatch(
  html,
  /automatic-snapshots-enabled|snapshot-frequency|snapshot-retention|included-sections-summary|data-section=|save-preferences/i,
  "the archive is history-only; automatic capture options belong in RoTool Settings"
);
assert.doesNotMatch(
  css,
  /rsl-archive-(?:advanced|toggle-row|switch|settings-grid|field|sections|section-option)/,
  "preference-form styles must not remain in the history-only archive"
);

for (const id of [
  "archive-window",
  "archive-back",
  "archive-accounts-view",
  "archive-snapshots-view",
  "account-list",
  "create-snapshot-now",
  "refresh-archive",
  "clear-all-snapshots",
  "snapshot-list",
  "snapshot-preview",
  "download-snapshot",
  "print-snapshot",
  "delete-snapshot",
  "archive-confirm-dialog"
]) {
  assert.match(html, new RegExp(`\\bid="${id}"`), `missing archive UI: ${id}`);
}
assert.doesNotMatch(html, /Automatic snapshot settings|Save settings/i);
assert.match(html, /Saved accounts/i);
assert.doesNotMatch(html, /rsl-archive-(?:topbar|hero|privacy|layout)/i);
assert.doesNotMatch(html, /not uploaded|never uploaded/i);
assert.doesNotMatch(
  html,
  /Account support evidence|preview-summary/,
  "the printable archive document must contain only support evidence and capture time"
);
const documentFieldPolicySource = source.slice(
  source.indexOf("  const DOCUMENT_ACCOUNT_FIELD_KEYS"),
  source.indexOf("  const CAPABILITY_ERROR_CODES")
);
assert.match(
  documentFieldPolicySource,
  /"userId"[\s\S]*?"username"[\s\S]*?"displayName"[\s\S]*?"createdAt"[\s\S]*?"accountStatus"/
);
for (const supportSection of SECTION_KEYS) {
  assert.match(
    documentFieldPolicySource,
    new RegExp(`${supportSection}: Object\\.freeze`),
    `${supportSection} must have an explicit support-document field policy`
  );
}
assert.doesNotMatch(
  documentFieldPolicySource,
  /holdId|profileUrl|gameUrl/,
  "database hold IDs and generated URLs must stay out of support exports"
);
const archiveDocumentProjectionSource = source.slice(
  source.indexOf("  function projectDocumentFields("),
  source.indexOf("  function getTimestampPresentation(")
);
assert.match(
  archiveDocumentProjectionSource,
  /for \(const sectionKey of SECTION_KEYS\)/,
  "saved exports must project only known support sections"
);
assert.match(
  archiveDocumentProjectionSource,
  /if \(items\.length === 0\) return OMIT_VALUE;/,
  "empty sections must remain UI-only instead of implying negative evidence"
);
assert.match(
  archiveDocumentProjectionSource,
  /rawSection\.hasMore === true \|\| sectionKey === "recentlyPlayed"/,
  "scope text belongs in the export only when truncation or missing play dates matters"
);
assert.doesNotMatch(
  archiveDocumentProjectionSource,
  /schemaVersion|Object\.entries\(sourceSections\)|normalized\.items = \[\]/,
  "technical schema data, arbitrary sections, and empty records must stay out of saved exports"
);
const archiveDocumentRenderSource = source.slice(
  source.indexOf("  function renderSnapshotDocument("),
  source.indexOf("  async function loadSnapshot(")
);
assert.doesNotMatch(
  archiveDocumentRenderSource,
  /summary\.trigger|summary\.byteLength|- RoTool/,
  "capture trigger, byte size, and generator branding must stay out of the printable document"
);
const localDateFormatterSource = source.slice(
  source.indexOf("  function formatLocalDate(value, options = {})"),
  source.indexOf("  function formatByteLength(value)")
);
assert.match(
  localDateFormatterSource,
  /timeZoneName:\s*"short"/,
  "archive timestamps must show the viewer's local time-zone label"
);
assert.doesNotMatch(
  localDateFormatterSource,
  /\b(?:CEST|CET|EST|EDT|PST|PDT)\b/,
  "the archive must derive daylight-saving-aware zone labels instead of hardcoding one"
);
assert.match(html, /<dialog\b[^>]*id="archive-confirm-dialog"/i);
assert.match(
  css,
  /\.rsl-archive-window\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;[\s\S]*?height:\s*auto;[\s\S]*?max-height:\s*min\(680px, calc\(100dvh - 32px\)\);/,
  "account and snapshot views must shrink to their content instead of stretching the footer"
);
assert.match(
  css,
  /body\[data-archive-view="document"\] \.rsl-archive-window\s*\{[\s\S]*?height:\s*min\(820px, calc\(100dvh - 32px\)\);[\s\S]*?max-height:\s*min\(820px, calc\(100dvh - 32px\)\);/,
  "the opened document keeps its large scrollable viewport"
);
for (const selector of [
  ".rsl-archive-window__header",
  ".rsl-archive-status",
  ".rsl-archive-window__footer"
]) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(
    css,
    new RegExp(`${escapedSelector}\\s*\\{[\\s\\S]*?flex:\\s*0 0 auto;`),
    `${selector} must keep its intrinsic height when the status message is hidden`
  );
}
assert.match(
  css,
  /\.rsl-archive-window__viewport\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-height:\s*0;[\s\S]*?overflow-y:\s*auto;/,
  "long archive content must scroll inside the capped window"
);
assert.doesNotMatch(css, /\.rsl-archive-window__footer\s*\{[\s\S]*?grid-row:/);
assert.doesNotMatch(html, /rsl-archive-account-heading/);
assert.match(html, /<svg class="rsl-archive-icon"/);
assert.match(source, /const SVG_NAMESPACE = "http:\/\/www\.w3\.org\/2000\/svg";/);
assert.match(source, /function makeSvgIcon\(/);
assert.match(source, /function getAccountInitial\(/);
assert.match(source, /function setArchiveView\(/);
assert.match(source, /function renderAccountList\(/);
assert.match(source, /function openAccountSnapshots\(/);
assert.match(source, /function navigateArchiveBack\(/);
assert.doesNotMatch(
  source,
  /snapshots\[0\]\s*\|\|\s*null/,
  "the archive must not auto-open the first snapshot"
);

const ARCHIVE_UI_MESSAGE_TYPES = Object.freeze([
  "get-state",
  "capture-now",
  "get-snapshot",
  "delete-snapshot",
  "clear-all"
]);
for (const suffix of ARCHIVE_UI_MESSAGE_TYPES) {
  assert.match(
    source,
    new RegExp(`\\$\\{MESSAGE_PREFIX\\}${suffix}`),
    `missing archive message contract: ${suffix}`
  );
}
assert.doesNotMatch(
  source,
  /set-preferences|savePreferences|preferencesAreDirty|getFormPreferences|automatic-snapshots-enabled|snapshot-frequency|snapshot-retention/,
  "the archive page must not edit automatic snapshot preferences"
);
assert.match(source, /chrome\.runtime\.sendMessage\(/);
assert.doesNotMatch(source, /\bfetch\s*\(/, "archive UI must not call Roblox directly");
assert.doesNotMatch(
  source,
  /(?:chrome\.)?storage\.|localStorage|sessionStorage|indexedDB/i,
  "archive UI must access records only through its guarded background messages"
);
assert.match(source, /new Blob\(/);
assert.match(source, /URL\.createObjectURL\(/);
assert.match(source, /URL\.revokeObjectURL\(/);
assert.match(source, /window\.print\(\)/);
assert.match(source, /textContent\s*=/);
assert.doesNotMatch(source, /\.innerHTML\s*=/);
assert.match(source, /function getInitialCaptureId\(\)/);
assert.match(source, /requirePreferredCaptureId: Boolean\(initialCaptureId\)/);

assert.match(
  background,
  /sender\?\.id === chrome\.runtime\.id|sender\.id === chrome\.runtime\.id/,
  "archive messages must bind the sender to this extension"
);
assert.match(
  background,
  /sender\?\.frameId (?:===|!==) 0|sender\.frameId (?:===|!==) 0/,
  "archive access must be restricted to the top-level extension page"
);
assert.match(
  background,
  /ACCOUNT_RECOVERY_ARCHIVE_PAGE_PATH/,
  "archive sender validation must bind the exact internal page"
);
assert.match(
  background,
  /incognito[^\n]*(?:false|true)|(?:false|true)[^\n]*incognito/i,
  "archive access must explicitly consider incognito tabs"
);

assert.match(
  background,
  /const duplicate = meta\.lastFingerprint === fingerprint;[\s\S]*?if \(!duplicate\)[\s\S]*?applyAccountRecoveryArchiveRetention/s,
  "unchanged captures must be deduplicated before retention is applied"
);

function eventTarget(list = []) {
  return {
    addListener(listener) {
      list.push(listener);
    },
    removeListener(listener) {
      const index = list.indexOf(listener);
      if (index >= 0) list.splice(index, 1);
    }
  };
}

function makeStorageArea(initial = {}) {
  const data = plain(initial);
  return {
    get(keys, callback) {
      let result;
      if (typeof keys === "string") {
        result = { [keys]: data[keys] };
      } else if (Array.isArray(keys)) {
        result = Object.fromEntries(keys.map((key) => [key, data[key]]));
      } else {
        result = { ...(keys || {}) };
        for (const key of Object.keys(keys || {})) {
          if (Object.hasOwn(data, key)) result[key] = data[key];
        }
      }
      const copy = plain(result);
      callback?.(copy);
      return Promise.resolve(copy);
    },
    set(values, callback) {
      Object.assign(data, plain(values));
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

const runtimeMessageListeners = [];
const actionClickListeners = [];
const storageChangeListeners = [];
const createdTabs = [];
const featureSettings = {
  rslFeatureSettingsV1: {
    version: 1,
    flags: {
      gameCcuHoverGraph: false,
      serverHistory: false,
      gameEvents: false,
      joinScheduler: false,
      recoverySnapshots: true,
      recoverySnapshotArchive: false
    }
  },
  rslAccountRecoveryArchivePreferencesV1: {
    version: 1,
    frequency: "daily",
    retention: 5,
    sections: [],
    revision: 1
  }
};
let archiveFetchHandler = async () => {
  throw new Error("Unexpected network request");
};
const chrome = {
  runtime: {
    id: "archive-fixture",
    lastError: null,
    getURL(relativePath = "") {
      return `chrome-extension://archive-fixture/${relativePath}`;
    },
    getManifest() {
      return plain(manifest);
    },
    onInstalled: eventTarget(),
    onStartup: eventTarget(),
    onMessage: eventTarget(runtimeMessageListeners)
  },
  extension: { inIncognitoContext: false },
  storage: {
    local: makeStorageArea(featureSettings),
    session: makeStorageArea(),
    onChanged: eventTarget(storageChangeListeners)
  },
  alarms: {
    create() {},
    get(_name, callback) {
      callback?.(null);
    },
    clear(_name, callback) {
      callback?.(true);
      return Promise.resolve(true);
    },
    onAlarm: eventTarget()
  },
  contextMenus: {
    create(_details, callback) {
      callback?.();
    },
    removeAll(callback) {
      callback?.();
    },
    onClicked: eventTarget()
  },
  action: { onClicked: eventTarget(actionClickListeners) },
  tabs: {
    query: async () => [],
    create: async (details) => {
      createdTabs.push(plain(details));
      return { id: 91, ...plain(details) };
    },
    get: async () => { throw new Error("Unknown tab"); },
    sendMessage() {},
    onUpdated: eventTarget(),
    onRemoved: eventTarget()
  },
  scripting: { executeScript: async () => [] },
  permissions: {
    contains(_permissions, callback) {
      callback?.(false);
      return Promise.resolve(false);
    },
    request(_permissions, callback) {
      callback?.(false);
      return Promise.resolve(false);
    },
    onRemoved: eventTarget()
  },
  notifications: {
    create: async () => "fixture-notification",
    clear: async () => true,
    onClicked: eventTarget(),
    onButtonClicked: eventTarget()
  },
  windows: {
    get: async () => { throw new Error("Unknown window"); },
    create: async (details) => ({ id: 21, ...plain(details) }),
    update: async (id, details) => ({ id, ...plain(details) }),
    onRemoved: eventTarget()
  }
};

const sandbox = {
  URL,
  URLSearchParams,
  Response,
  Headers,
  Request,
  AbortController,
  ArrayBuffer,
  Uint8Array,
  TextDecoder,
  TextEncoder,
  Intl,
  console,
  chrome,
  crypto: webcrypto,
  structuredClone,
  fetch: (...args) => archiveFetchHandler(...args),
  btoa(value) {
    return Buffer.from(String(value), "binary").toString("base64");
  },
  setTimeout,
  clearTimeout,
  queueMicrotask,
  __rslBackgroundTestHooks: {},
  globalThis: null
};
sandbox.globalThis = sandbox;
vm.runInContext(background, vm.createContext(sandbox), {
  filename: "background.js"
});

const hooks = sandbox.__rslBackgroundTestHooks;
for (const hookName of [
  "getAccountRecoveryReminderFeatureState",
  "shouldResetAccountRecoveryReminderCooldown",
  "normalizeAccountRecoveryReminderState",
  "evaluateAccountRecoveryReminderClaim",
  "claimAccountRecoveryReminder",
  "resetAccountRecoveryReminderStateForTests",
  "normalizeAccountRecoveryArchivePreferences",
  "getAccountRecoveryArchiveFeatureValue",
  "isTrustedAccountRecoveryArchivePreferencesSender",
  "writeAccountRecoveryArchivePreferencesOnly",
  "handleAccountRecoveryArchivePreferencesMessage",
  "sanitizeAccountRecoveryArchiveSnapshot",
  "normalizeAccountRecoveryArchiveRecord",
  "applyAccountRecoveryArchiveRetention",
  "createAccountRecoveryArchiveMemoryStorageForTests",
  "isTrustedAccountRecoveryArchivePageSender",
  "getAccountRecoveryArchiveState",
  "setAccountRecoveryArchiveStorageOverrideForTests",
  "resetAccountRecoveryArchiveStateForTests",
  "runAccountRecoveryArchiveCoordinator"
]) {
  assert.equal(typeof hooks[hookName], "function", `missing archive hook: ${hookName}`);
}

const reminderConstants = plain(hooks.accountRecoveryReminderConstants);
assert.deepEqual(reminderConstants, {
  messageType: "rsl:account-recovery-reminder:claim",
  masterFeatureKey: "recoverySnapshots",
  featureKey: "recoverySnapshotReminder",
  automaticFeatureKey: "recoverySnapshotArchive",
  storageKey: "rslRecoverySnapshotReminderStateV1",
  storageVersion: 1,
  cooldownMs: 3 * 60 * 60_000
});

const reminderNow = 1_800_000_000_000;
const reminderDefaultDecision = plain(
  hooks.evaluateAccountRecoveryReminderClaim(null, null, reminderNow)
);
assert.deepEqual(
  reminderDefaultDecision,
  {
    showNotice: true,
    nextNoticeAt: reminderNow + reminderConstants.cooldownMs,
    nextState: {
      version: reminderConstants.storageVersion,
      lastPresentedAt: reminderNow
    }
  },
  "missing feature settings must default reminders on and claim immediately"
);
assert.deepEqual(
  plain(hooks.getAccountRecoveryReminderFeatureState({
    version: 1,
    flags: { recoverySnapshotArchive: false }
  })),
  {
    valid: true,
    recoverySnapshotsEnabled: true,
    automaticSnapshotsEnabled: false,
    remindersEnabled: true
  },
  "legacy feature settings without the reminder flag must inherit the enabled default"
);
assert.deepEqual(
  plain(hooks.evaluateAccountRecoveryReminderClaim(
    null,
    {
      version: 1,
      flags: {
        recoverySnapshots: false,
        recoverySnapshotArchive: false,
        recoverySnapshotReminder: true
      }
    },
    reminderNow
  )),
  {
    showNotice: false,
    nextNoticeAt: null,
    nextState: { version: 1, lastPresentedAt: 0 }
  },
  "the Recovery master switch must suppress its automatic-snapshot reminder"
);
const reminderFlags = (overrides = {}) => ({
  version: 1,
  flags: {
    recoverySnapshots: true,
    recoverySnapshotArchive: false,
    recoverySnapshotReminder: true,
    ...overrides
  }
});
assert.equal(
  hooks.shouldResetAccountRecoveryReminderCooldown(
    reminderFlags({ recoverySnapshotArchive: true }),
    reminderFlags({ recoverySnapshotArchive: false })
  ),
  true,
  "turning Automatic snapshots off must make the next eligible Home reminder immediate"
);
assert.equal(
  hooks.shouldResetAccountRecoveryReminderCooldown(
    reminderFlags({ recoverySnapshotReminder: false }),
    reminderFlags({ recoverySnapshotReminder: true })
  ),
  true,
  "turning reminders back on must not inherit a stale cooldown"
);
assert.equal(
  hooks.shouldResetAccountRecoveryReminderCooldown(
    reminderFlags({ recoverySnapshots: false }),
    reminderFlags({ recoverySnapshots: true })
  ),
  true,
  "re-enabling the Recovery master must make its reminder eligible immediately"
);
assert.equal(
  hooks.shouldResetAccountRecoveryReminderCooldown(
    reminderFlags(),
    reminderFlags()
  ),
  false,
  "an unrelated settings write must preserve the three-hour cooldown"
);
assert.deepEqual(
  plain(hooks.evaluateAccountRecoveryReminderClaim(
    null,
    {
      version: 1,
      flags: {
        recoverySnapshotArchive: false,
        recoverySnapshotReminder: false
      }
    },
    reminderNow
  )),
  {
    showNotice: false,
    nextNoticeAt: null,
    nextState: { version: 1, lastPresentedAt: 0 }
  },
  "an explicit reminder opt-out must suppress the notice"
);
assert.deepEqual(
  plain(hooks.evaluateAccountRecoveryReminderClaim(
    null,
    {
      version: 1,
      flags: {
        recoverySnapshotArchive: true,
        recoverySnapshotReminder: true
      }
    },
    reminderNow
  )),
  {
    showNotice: false,
    nextNoticeAt: null,
    nextState: { version: 1, lastPresentedAt: 0 }
  },
  "enabled automatic snapshots must suppress the off reminder"
);

const priorReminderState = {
  version: reminderConstants.storageVersion,
  lastPresentedAt: reminderNow
};
assert.deepEqual(
  plain(hooks.evaluateAccountRecoveryReminderClaim(
    priorReminderState,
    null,
    reminderNow + reminderConstants.cooldownMs - 1
  )),
  {
    showNotice: false,
    nextNoticeAt: reminderNow + reminderConstants.cooldownMs,
    nextState: priorReminderState
  },
  "a reminder must remain suppressed until the full three-hour cooldown elapses"
);
assert.deepEqual(
  plain(hooks.evaluateAccountRecoveryReminderClaim(
    priorReminderState,
    null,
    reminderNow + reminderConstants.cooldownMs
  )),
  {
    showNotice: true,
    nextNoticeAt: reminderNow + 2 * reminderConstants.cooldownMs,
    nextState: {
      version: reminderConstants.storageVersion,
      lastPresentedAt: reminderNow + reminderConstants.cooldownMs
    }
  },
  "the exact three-hour boundary must become eligible"
);

for (const [label, rawState] of [
  ["corrupt schema", { version: 99, lastPresentedAt: reminderNow }],
  ["non-integer timestamp", { version: 1, lastPresentedAt: "soon" }],
  [
    "implausible future timestamp",
    { version: 1, lastPresentedAt: reminderNow + 6 * 60_000 }
  ]
]) {
  assert.deepEqual(
    plain(hooks.evaluateAccountRecoveryReminderClaim(
      rawState,
      null,
      reminderNow
    )),
    reminderDefaultDecision,
    `${label} must recover to an immediate bounded claim`
  );
}

assert.deepEqual(
  plain(hooks.accountRecoveryArchiveConstants),
  {
    pagePath: "recovery-archive.html",
    masterFeatureKey: "recoverySnapshots",
    featureKey: "recoverySnapshotArchive",
    alarmName: "rsl-account-recovery-archive-v1",
    alarmPeriodMinutes: 1_440,
    defaultFrequency: "daily",
    defaultRetention: 5,
    defaultSections: DEFAULT_SECTION_KEYS,
    preferencesGetMessageType:
      "rsl:get-account-recovery-archive-preferences",
    preferencesSetMessageType:
      "rsl:set-account-recovery-archive-preferences",
    messageTypes: {
      open: "rsl:account-recovery-archive:open",
      getState: "rsl:account-recovery-archive:get-state",
      setPreferences: "rsl:account-recovery-archive:set-preferences",
      captureNow: "rsl:account-recovery-archive:capture-now",
      getSnapshot: "rsl:account-recovery-archive:get-snapshot",
      deleteSnapshot: "rsl:account-recovery-archive:delete-snapshot",
      clearAll: "rsl:account-recovery-archive:clear-all"
    }
  }
);

assert.deepEqual(
  plain(hooks.normalizeAccountRecoveryArchivePreferences(null)),
  {
    version: 2,
    frequency: "daily",
    retention: 5,
    sections: DEFAULT_SECTION_KEYS,
    revision: 1
  },
  "missing preferences must use the user-selected archive defaults"
);
assert.deepEqual(
  plain(hooks.normalizeAccountRecoveryArchivePreferences({
    version: 1,
    frequency: "weekly",
    retention: 10,
    sections: [],
    revision: 7
  })),
  {
    version: 2,
    frequency: "weekly",
    retention: 10,
    sections: [],
    revision: 7
  },
  "valid v1 privacy exclusions and schedule settings must survive migration"
);
assert.deepEqual(
  plain(hooks.normalizeAccountRecoveryArchivePreferences({
    version: 2,
    frequency: "monthly",
    retention: 3,
    sections: ["violations", "purchases"],
    revision: 11
  })),
  {
    version: 2,
    frequency: "monthly",
    retention: 3,
    sections: ["violations", "purchases"],
    revision: 11
  },
  "v2 automatic-capture exclusions must remain stable"
);
assert.deepEqual(
  plain(hooks.normalizeAccountRecoveryArchivePreferences({
    version: 1,
    frequency: "hourly",
    retention: 500,
    sections: ["purchases", "purchases"],
    revision: -1
  })),
  {
    version: 2,
    frequency: "daily",
    retention: 5,
    sections: DEFAULT_SECTION_KEYS,
    revision: 1
  },
  "malformed preferences must fail closed to bounded defaults"
);
assert.equal(
  hooks.getAccountRecoveryArchiveFeatureValue(null),
  false,
  "missing feature settings must leave automatic snapshots off"
);
assert.equal(
  hooks.getAccountRecoveryArchiveFeatureValue({
    version: 1,
    flags: { recoverySnapshotArchive: true }
  }),
  true,
  "an existing stored opt-in without the additive master key must remain enabled"
);
assert.equal(
  hooks.getAccountRecoveryArchiveFeatureValue({
    version: 1,
    flags: {
      recoverySnapshots: true,
      recoverySnapshotArchive: true
    }
  }),
  true,
  "the automatic archive must run while both its master and opt-in are enabled"
);
assert.equal(
  hooks.getAccountRecoveryArchiveFeatureValue({
    version: 1,
    flags: {
      recoverySnapshots: false,
      recoverySnapshotArchive: true
    }
  }),
  false,
  "the Recovery master switch must gate an otherwise enabled automatic archive"
);
assert.equal(
  hooks.getAccountRecoveryArchiveFeatureValue({
    version: 1,
    flags: { recoverySnapshotArchive: false }
  }),
  false,
  "an explicit stored disable must remain disabled"
);
assert.equal(
  hooks.getAccountRecoveryArchiveFeatureValue({
    version: 1,
    flags: {}
  }),
  false,
  "a stored settings record without the opt-in must remain disabled"
);
assert.equal(
  hooks.getAccountRecoveryArchiveFeatureValue({
    version: 999,
    flags: { recoverySnapshotArchive: true }
  }),
  false,
  "malformed or future feature settings must fail closed"
);

const secretSnapshot = hooks.sanitizeAccountRecoveryArchiveSnapshot({
  schemaVersion: 1,
  capturedAt: "2026-08-28T12:34:56.000Z",
  account: {
    userId: "101",
    username: "ArchiveOwner",
    displayName: "Archive Owner",
    createdAt: "2018-02-03T04:05:06.000Z",
    password: "TopSecretPassword",
    emailAddress: "owner@example.invalid",
    sessionToken: "TopSecretSession"
  },
  sections: {
    profileDetails: {
      status: "complete",
      safeEvidence: "kept",
      csrfToken: "TopSecretCsrf",
      nested: {
        authenticationToken: "TopSecretAuthentication",
        safeNestedEvidence: "kept too"
      }
    },
    unknownPrivateSection: { password: "TopSecretUnknown" }
  },
  limitations: []
});
const sanitizedText = JSON.stringify(secretSnapshot);
assert.doesNotMatch(
  sanitizedText,
  /TopSecret|password|emailAddress|sessionToken|csrfToken|authenticationToken/i
);
assert.equal(secretSnapshot.sections.profileDetails.safeEvidence, "kept");
assert.equal(
  secretSnapshot.sections.profileDetails.nested.safeNestedEvidence,
  "kept too"
);
assert.equal(
  Object.hasOwn(secretSnapshot.sections, "unknownPrivateSection"),
  false
);

function retentionRecord(accountUserId, sequence, byteLength = 1) {
  return {
    accountUserId,
    captureId: `capture-${accountUserId}-${String(sequence).padStart(4, "0")}`,
    capturedAtMs: sequence,
    byteLength
  };
}

const retained = { records: [], meta: [] };
for (let sequence = 1; sequence <= 7; sequence += 1) {
  hooks.applyAccountRecoveryArchiveRetention(
    retained,
    retentionRecord("101", sequence),
    5
  );
}
for (let sequence = 1; sequence <= 3; sequence += 1) {
  hooks.applyAccountRecoveryArchiveRetention(
    retained,
    retentionRecord("202", sequence),
    5
  );
}
assert.deepEqual(
  retained.records
    .filter((record) => record.accountUserId === "101")
    .map((record) => record.captureId),
  [
    "capture-101-0001",
    "capture-101-0004",
    "capture-101-0005",
    "capture-101-0006",
    "capture-101-0007"
  ],
  "retention keeps one baseline plus the newest records for that account"
);
assert.equal(
  retained.records.filter((record) => record.accountUserId === "202").length,
  3,
  "pruning one account must not remove another account's archive"
);

const accountLimitStorage = { records: [], meta: [] };
for (let account = 1; account <= 8; account += 1) {
  hooks.applyAccountRecoveryArchiveRetention(
    accountLimitStorage,
    retentionRecord(String(account), 1),
    5
  );
}
assert.throws(
  () => hooks.applyAccountRecoveryArchiveRetention(
    accountLimitStorage,
    retentionRecord("9", 1),
    5
  ),
  (error) => error?.code === "ACCOUNT_LIMIT",
  "the bounded archive must reject a ninth account without evicting another"
);

const expectedArchiveUrl = chrome.runtime.getURL(ARCHIVE_PAGE);
const expectedArchiveOrigin = new URL(expectedArchiveUrl).origin;
function trustedArchiveSender(overrides = {}) {
  const base = {
    id: chrome.runtime.id,
    frameId: 0,
    url: expectedArchiveUrl,
    origin: expectedArchiveOrigin,
    documentId: "archive-document-1",
    documentLifecycle: "active",
    frameType: "outermost_frame",
    tab: {
      id: 73,
      active: true,
      incognito: false,
      url: expectedArchiveUrl,
      pendingUrl: expectedArchiveUrl
    }
  };
  const next = { ...base, ...overrides };
  if (overrides.tab) next.tab = { ...base.tab, ...overrides.tab };
  return next;
}

assert.equal(hooks.isTrustedAccountRecoveryArchivePageSender(trustedArchiveSender()), true);
const validCaptureId = "capture-101-0001";
const validDeepLink = `${expectedArchiveUrl}?captureId=${validCaptureId}`;
assert.equal(
  hooks.isTrustedAccountRecoveryArchivePageSender(trustedArchiveSender({
    url: validDeepLink,
    tab: { url: validDeepLink, pendingUrl: validDeepLink }
  })),
  true,
  "a canonical exact-snapshot deep link must retain the archive page guard"
);
for (const [label, sender] of [
  ["other extension", trustedArchiveSender({ id: "other-extension" })],
  ["subframe", trustedArchiveSender({ frameId: 1 })],
  ["inactive tab", trustedArchiveSender({ tab: { active: false } })],
  ["incognito tab", trustedArchiveSender({ tab: { incognito: true } })],
  ["stale document", trustedArchiveSender({ documentLifecycle: "cached" })],
  ["nested frame", trustedArchiveSender({ frameType: "sub_frame" })],
  ["wrong origin", trustedArchiveSender({ origin: "https://www.roblox.com" })],
  ["query string", trustedArchiveSender({
    url: `${expectedArchiveUrl}?account=101`,
    tab: { url: `${expectedArchiveUrl}?account=101` }
  })],
  ["duplicate capture query", trustedArchiveSender({
    url: `${expectedArchiveUrl}?captureId=${validCaptureId}&captureId=${validCaptureId}`,
    tab: {
      url: `${expectedArchiveUrl}?captureId=${validCaptureId}&captureId=${validCaptureId}`,
      pendingUrl: `${expectedArchiveUrl}?captureId=${validCaptureId}&captureId=${validCaptureId}`
    }
  })],
  ["extra query", trustedArchiveSender({
    url: `${validDeepLink}&account=101`,
    tab: { url: `${validDeepLink}&account=101`, pendingUrl: `${validDeepLink}&account=101` }
  })],
  ["short capture ID", trustedArchiveSender({
    url: `${expectedArchiveUrl}?captureId=short`,
    tab: {
      url: `${expectedArchiveUrl}?captureId=short`,
      pendingUrl: `${expectedArchiveUrl}?captureId=short`
    }
  })],
  ["noncanonical capture encoding", trustedArchiveSender({
    url: `${expectedArchiveUrl}?captureId=capture%2D101-0001`,
    tab: {
      url: `${expectedArchiveUrl}?captureId=capture%2D101-0001`,
      pendingUrl: `${expectedArchiveUrl}?captureId=capture%2D101-0001`
    }
  })],
  ["sender and tab deep-link mismatch", trustedArchiveSender({
    url: validDeepLink,
    tab: { url: expectedArchiveUrl, pendingUrl: expectedArchiveUrl }
  })],
  ["hash", trustedArchiveSender({
    url: `${expectedArchiveUrl}#snapshot`,
    tab: { url: `${expectedArchiveUrl}#snapshot` }
  })],
  ["different pending URL", trustedArchiveSender({
    tab: { pendingUrl: "https://www.roblox.com/home" }
  })]
]) {
  assert.equal(
    hooks.isTrustedAccountRecoveryArchivePageSender(sender),
    false,
    `archive sender guard accepted ${label}`
  );
}

function trustedRobloxContentSender(overrides = {}) {
  const pageUrl = "https://www.roblox.com/home";
  const base = {
    id: chrome.runtime.id,
    frameId: 0,
    url: pageUrl,
    tab: {
      id: 74,
      active: true,
      incognito: false,
      url: pageUrl
    }
  };
  const next = { ...base, ...overrides };
  if (overrides.tab) next.tab = { ...base.tab, ...overrides.tab };
  return next;
}

async function runAccountRecoveryReminderClaimChecks() {
  hooks.resetAccountRecoveryReminderStateForTests();
  await chrome.storage.local.remove(reminderConstants.storageKey);

  const stored = await chrome.storage.local.get({
    rslFeatureSettingsV1: null
  });
  const reminderFlags = {
    ...(stored.rslFeatureSettingsV1?.flags || {}),
    recoverySnapshotArchive: false
  };
  delete reminderFlags.recoverySnapshotReminder;
  await chrome.storage.local.set({
    rslFeatureSettingsV1: {
      version: 1,
      flags: reminderFlags
    }
  });

  const originalTabsGet = chrome.tabs.get;
  chrome.tabs.get = (tabId, callback) => {
    const tab = {
      id: tabId,
      active: true,
      incognito: false,
      url: "https://www.roblox.com/home"
    };
    callback?.(plain(tab));
    return Promise.resolve(plain(tab));
  };

  try {
    const claims = await Promise.all([
      hooks.claimAccountRecoveryReminder({
        tabId: 74,
        senderUrl: "https://www.roblox.com/home"
      }),
      hooks.claimAccountRecoveryReminder({
        tabId: 75,
        senderUrl: "https://www.roblox.com/home"
      })
    ]);
    const decisions = claims.map(plain);
    assert.equal(
      decisions.filter((decision) => decision.showNotice === true).length,
      1,
      "serialized concurrent claims must reserve exactly one reminder slot"
    );
    assert.equal(
      decisions.filter((decision) => decision.showNotice === false).length,
      1
    );
    assert.equal(
      decisions[0].nextNoticeAt,
      decisions[1].nextNoticeAt,
      "both claimants must observe the same persisted cooldown boundary"
    );

    const persisted = await chrome.storage.local.get({
      [reminderConstants.storageKey]: null
    });
    assert.deepEqual(
      plain(persisted[reminderConstants.storageKey]),
      {
        version: reminderConstants.storageVersion,
        lastPresentedAt:
          decisions.find((decision) => decision.showNotice)?.nextState
            ?.lastPresentedAt
      },
      "the winning claim must persist its presentation timestamp"
    );

    const automaticOn = {
      version: 1,
      flags: {
        ...reminderFlags,
        recoverySnapshots: true,
        recoverySnapshotArchive: true,
        recoverySnapshotReminder: true
      }
    };
    const automaticOff = {
      version: 1,
      flags: {
        ...automaticOn.flags,
        recoverySnapshotArchive: false
      }
    };
    const recentMarker = {
      version: reminderConstants.storageVersion,
      lastPresentedAt: Date.now()
    };
    await chrome.storage.local.set({
      rslFeatureSettingsV1: automaticOff,
      [reminderConstants.storageKey]: recentMarker
    });
    assert.ok(
      storageChangeListeners.length > 0,
      "the background fixture must register its local-storage listener"
    );
    for (const listener of storageChangeListeners) {
      listener({
        rslFeatureSettingsV1: {
          oldValue: automaticOn,
          newValue: automaticOff
        }
      }, "local");
    }

    const transitionClaims = (
      await Promise.all([
        hooks.claimAccountRecoveryReminder({
          tabId: 74,
          senderUrl: "https://www.roblox.com/home"
        }),
        hooks.claimAccountRecoveryReminder({
          tabId: 75,
          senderUrl: "https://www.roblox.com/home"
        })
      ])
    ).map(plain);
    assert.equal(
      transitionClaims.filter((decision) => decision.showNotice === true).length,
      1,
      "turning Automatic snapshots off must clear a recent cooldown and give concurrent claims exactly one immediate winner"
    );
    assert.equal(
      transitionClaims.filter((decision) => decision.showNotice === false).length,
      1
    );
    const transitionWinner = transitionClaims.find(
      (decision) => decision.showNotice === true
    );
    const afterTransition = await chrome.storage.local.get({
      [reminderConstants.storageKey]: null
    });
    assert.deepEqual(
      plain(afterTransition[reminderConstants.storageKey]),
      transitionWinner.nextState,
      "the ON-to-OFF transition must replace the recent marker with the immediate winning claim"
    );

    for (const listener of storageChangeListeners) {
      listener({
        rslFeatureSettingsV1: {
          oldValue: automaticOff,
          newValue: plain(automaticOff)
        }
      }, "local");
    }
    const identicalOffClaim = plain(await hooks.claimAccountRecoveryReminder({
      tabId: 74,
      senderUrl: "https://www.roblox.com/home"
    }));
    assert.equal(
      identicalOffClaim.showNotice,
      false,
      "an identical OFF-to-OFF settings write must not reset the cooldown again"
    );
    const afterIdenticalOff = await chrome.storage.local.get({
      [reminderConstants.storageKey]: null
    });
    assert.deepEqual(
      plain(afterIdenticalOff[reminderConstants.storageKey]),
      transitionWinner.nextState,
      "an identical OFF-to-OFF write must preserve the winning cooldown marker"
    );
  } finally {
    chrome.tabs.get = originalTabsGet;
    await chrome.storage.local.remove(reminderConstants.storageKey);
    hooks.resetAccountRecoveryReminderStateForTests();
  }
}

function requestArchivePreferences(message, sender = trustedRobloxContentSender()) {
  return new Promise((resolve, reject) => {
    let responded = false;
    const keepAlive = hooks.handleAccountRecoveryArchivePreferencesMessage(
      message,
      sender,
      (response) => {
        responded = true;
        resolve(plain(response));
      }
    );
    if (!keepAlive && !responded) {
      reject(new Error("Preference handler rejected without a response"));
    }
  });
}

async function runPreferenceEndpointChecks() {
  const getType = "rsl:get-account-recovery-archive-preferences";
  const setType = "rsl:set-account-recovery-archive-preferences";
  const getResponse = await requestArchivePreferences({ type: getType });
  assert.deepEqual(getResponse, {
    ok: true,
    frequency: "daily",
    retention: 5,
    sections: [],
    revision: 1
  });

  const before = await chrome.storage.local.get({
    rslFeatureSettingsV1: null,
    rslAccountRecoveryArchivePreferencesV1: null
  });
  const setResponse = await requestArchivePreferences({
    type: setType,
    frequency: "weekly",
    retention: 10,
    sections: []
  });
  assert.deepEqual(setResponse, {
    ok: true,
    frequency: "weekly",
    retention: 10,
    sections: [],
    revision: 2
  });
  const after = await chrome.storage.local.get({
    rslFeatureSettingsV1: null,
    rslAccountRecoveryArchivePreferencesV1: null
  });
  assert.deepEqual(
    after.rslFeatureSettingsV1,
    before.rslFeatureSettingsV1,
    "content preference writes must not rewrite the feature master switch"
  );
  assert.deepEqual(after.rslAccountRecoveryArchivePreferencesV1, {
    version: 2,
    frequency: "weekly",
    retention: 10,
    sections: [],
    revision: 2
  });

  for (const [label, message, sender] of [
    ["extra GET key", { type: getType, extra: true }, trustedRobloxContentSender()],
    ["invalid frequency", {
      type: setType,
      frequency: "hourly",
      retention: 5,
      sections: []
    }, trustedRobloxContentSender()],
    ["incognito sender", { type: getType }, trustedRobloxContentSender({
      tab: { incognito: true }
    })],
    ["non-Roblox sender", { type: getType }, trustedRobloxContentSender({
      url: "https://example.com/",
      tab: { url: "https://example.com/" }
    })]
  ]) {
    assert.deepEqual(
      await requestArchivePreferences(message, sender),
      { ok: false, code: "INVALID" },
      `preference endpoint accepted ${label}`
    );
  }
}

assert.deepEqual(plain(DEFAULT_SECTION_KEYS), plain(SECTION_KEYS));

async function runCoordinatorAccountSeparationChecks() {
  let activeViewer = {
    id: 101,
    name: "MainOwner",
    displayName: "Main Owner"
  };
  archiveFetchHandler = async (input) => {
    const url = new URL(String(input));
    if (
      url.hostname === "users.roblox.com" &&
      url.pathname === "/v1/users/authenticated"
    ) {
      if (!activeViewer) return new Response(null, { status: 401 });
      return new Response(JSON.stringify(activeViewer), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (
      url.hostname === "users.roblox.com" &&
      url.pathname === `/v1/users/${activeViewer.id}`
    ) {
      return new Response(JSON.stringify({
        ...activeViewer,
        created: "2018-02-03T04:05:06.000Z",
        isBanned: false
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    throw new Error(`Unexpected archive coordinator request: ${url.href}`);
  };

  const automaticMemory =
    hooks.createAccountRecoveryArchiveMemoryStorageForTests();
  hooks.resetAccountRecoveryArchiveStateForTests();
  hooks.setAccountRecoveryArchiveStorageOverrideForTests(automaticMemory);

  const scheduledDisabled = await hooks.runAccountRecoveryArchiveCoordinator(
    "scheduled",
    true
  );
  assert.deepEqual(
    plain(scheduledDisabled),
    { status: "disabled" },
    "scheduled captures must honor the disabled automatic-snapshot switch"
  );
  assert.equal(automaticMemory.getStorage().records.length, 0);

  const disabledSettings = await chrome.storage.local.get({
    rslFeatureSettingsV1: null
  });
  await chrome.storage.local.set({
    rslFeatureSettingsV1: {
      ...disabledSettings.rslFeatureSettingsV1,
      flags: {
        ...disabledSettings.rslFeatureSettingsV1.flags,
        recoverySnapshots: false,
        recoverySnapshotArchive: true
      }
    }
  });
  hooks.resetAccountRecoveryArchiveStateForTests();
  assert.deepEqual(
    plain(await hooks.runAccountRecoveryArchiveCoordinator("scheduled", true)),
    { status: "disabled" },
    "the Recovery master must stop scheduled captures even when the automatic opt-in is preserved"
  );
  const manualWhileMasterOff = await hooks.runAccountRecoveryArchiveCoordinator(
    "manual",
    true
  );
  assert.equal(
    manualWhileMasterOff.status,
    "saved",
    "a deliberate archive capture must remain available while the Recovery master is off"
  );
  assert.equal(automaticMemory.getStorage().records.length, 1);
  const disabledArchiveState = await hooks.getAccountRecoveryArchiveState(
    trustedArchiveSender()
  );
  assert.equal(
    disabledArchiveState.recoverySnapshotsEnabled,
    false,
    "an already-open archive must receive the effective master state"
  );
  assert.deepEqual(
    plain(disabledArchiveState.snapshots.map((snapshot) => snapshot.captureId)),
    [manualWhileMasterOff.captureId],
    "turning Recovery off must not hide or erase a manually created archive summary"
  );

  await chrome.storage.local.set({
    rslFeatureSettingsV1: {
      ...disabledSettings.rslFeatureSettingsV1,
      flags: {
        ...disabledSettings.rslFeatureSettingsV1.flags,
        recoverySnapshots: true,
        recoverySnapshotArchive: true
      }
    }
  });
  hooks.resetAccountRecoveryArchiveStateForTests();
  const enabledAutomaticMemory =
    hooks.createAccountRecoveryArchiveMemoryStorageForTests();
  hooks.setAccountRecoveryArchiveStorageOverrideForTests(enabledAutomaticMemory);
  const automatic = await hooks.runAccountRecoveryArchiveCoordinator(
    "scheduled",
    true
  );
  assert.equal(automatic.status, "saved");
  assert.deepEqual(
    plain(enabledAutomaticMemory.getStorage().records[0].requestedSections),
    [],
    "automatic capture must honor a user's explicit empty category selection"
  );

  const memory = hooks.createAccountRecoveryArchiveMemoryStorageForTests();
  hooks.resetAccountRecoveryArchiveStateForTests();
  hooks.setAccountRecoveryArchiveStorageOverrideForTests(memory);

  const first = await hooks.runAccountRecoveryArchiveCoordinator("manual", true);
  assert.equal(first.status, "saved");
  assert.equal(first.accountUserId, "101");
  assert.equal(memory.getStorage().records.length, 1);
  assert.deepEqual(
    plain(memory.getStorage().records[0].requestedSections),
    [],
    "an excluded category must never be requested or stored by an archive capture"
  );
  assert.deepEqual(
    plain(memory.getStorage().records[0].includedSections),
    [],
    "core account identity remains usable without silently adding excluded evidence"
  );

  const unchanged = await hooks.runAccountRecoveryArchiveCoordinator(
    "manual",
    true
  );
  assert.equal(unchanged.status, "unchanged");
  assert.equal(
    memory.getStorage().records.length,
    1,
    "an unchanged daily capture must not consume another archive slot"
  );

  const mainMetaBeforeFrequencyChange = memory.getStorage().meta.find(
    (item) => item.accountUserId === "101"
  );
  const storedScheduleSettings = await chrome.storage.local.get({
    rslFeatureSettingsV1: null,
    rslAccountRecoveryArchivePreferencesV1: null
  });
  await chrome.storage.local.set({
    rslFeatureSettingsV1: {
      ...storedScheduleSettings.rslFeatureSettingsV1,
      flags: {
        ...storedScheduleSettings.rslFeatureSettingsV1.flags,
        recoverySnapshotArchive: true
      }
    },
    rslAccountRecoveryArchivePreferencesV1: {
    ...storedScheduleSettings.rslAccountRecoveryArchivePreferencesV1,
    frequency: "monthly",
    revision:
      storedScheduleSettings.rslAccountRecoveryArchivePreferencesV1.revision + 1
    }
  });
  hooks.resetAccountRecoveryArchiveStateForTests();
  const rescheduled = await hooks.runAccountRecoveryArchiveCoordinator(
    "scheduled",
    false
  );
  assert.equal(rescheduled.status, "not-due");
  assert.equal(
    rescheduled.nextDueAt,
    hooks.getNextAccountRecoveryArchiveDueAt(
      mainMetaBeforeFrequencyChange.lastSuccessAt,
      "monthly"
    ),
    "a changed frequency must take effect without waiting for the old stored due date"
  );

  activeViewer = {
    id: 202,
    name: "AltOwner",
    displayName: "Alt Owner"
  };
  const alt = await hooks.runAccountRecoveryArchiveCoordinator("manual", true);
  assert.equal(alt.status, "saved");
  assert.equal(alt.accountUserId, "202");
  assert.deepEqual(
    memory.getStorage().records
      .map((record) => record.accountUserId)
      .sort(),
    ["101", "202"],
    "signing into an alt must retain the lost main account's local snapshot"
  );

  activeViewer = {
    id: 101,
    name: "MainOwner",
    displayName: "Main Owner Updated"
  };
  const updatedMain = await hooks.runAccountRecoveryArchiveCoordinator(
    "manual",
    true
  );
  assert.equal(updatedMain.status, "saved");

  const archiveState = await hooks.getAccountRecoveryArchiveState(
    trustedArchiveSender()
  );
  assert.equal(archiveState.snapshots.length, 3);
  const mainSnapshots = archiveState.snapshots.filter(
    (snapshot) => snapshot.accountUserId === "101"
  );
  const altSnapshots = archiveState.snapshots.filter(
    (snapshot) => snapshot.accountUserId === "202"
  );
  assert.equal(mainSnapshots.length, 2);
  assert.equal(altSnapshots.length, 1);
  assert.equal(mainSnapshots[0].displayName, "Main Owner Updated");
  assert.equal(Object.hasOwn(archiveState, "snapshot"), false);
  assert.equal(archiveState.recoverySnapshotsEnabled, true);
  assert.ok(archiveState.capability, "the private page receives a bound capability");

  const storageBeforeSignOut = plain(memory.getStorage());
  activeViewer = null;
  const signedOut = await hooks.runAccountRecoveryArchiveCoordinator(
    "manual",
    true
  );
  assert.deepEqual(plain(signedOut), { status: "signed-out" });
  assert.deepEqual(
    plain(memory.getStorage()),
    storageBeforeSignOut,
    "a signed-out manual attempt must not touch saved archive records or metadata"
  );
}

runAccountRecoveryReminderClaimChecks()
  .then(runPreferenceEndpointChecks)
  .then(runCoordinatorAccountSeparationChecks)
  .then(() => {
    console.log("Account Recovery Archive contract tests passed.");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
