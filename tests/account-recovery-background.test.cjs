"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const { TextDecoder, TextEncoder } = require("node:util");

const root = path.resolve(__dirname, "..");
const background = fs.readFileSync(path.join(root, "background.js"), "utf8");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "manifest.json"), "utf8")
);
const start = background.indexOf("class AccountRecoveryError extends Error");
const end = background.indexOf("function handleRuntimeMessage", start);
assert.notEqual(start, -1, "account recovery collector exists");
assert.notEqual(end, -1, "account recovery collector has a bounded test slice");
const collectorSource = background.slice(start, end);

assert.equal(
  Object.hasOwn(manifest, "optional_host_permissions"),
  false,
  "Recovery Snapshot must not request the masked-email host permission"
);
assert.equal(
  manifest.host_permissions.includes("https://accountsettings.roblox.com/*"),
  false,
  "masked-email access must not become an install-time host grant"
);
assert.equal(
  manifest.host_permissions.includes("https://twostepverification.roblox.com/*"),
  true,
  "the selected 2-step verification evidence has an explicit host grant"
);
assert.equal(
  manifest.host_permissions.includes("https://trades.roblox.com/*"),
  true,
  "the selected trade-history evidence has an explicit host grant"
);
assert.equal(
  manifest.host_permissions.includes("https://auth.roblox.com/*"),
  false,
  "dropping password status also drops its otherwise-unused host permission"
);
assert.equal(manifest.permissions.includes("cookies"), false);
assert.equal(manifest.permissions.includes("downloads"), false);
const recoveryResources = (manifest.web_accessible_resources || []).filter((entry) =>
  (entry.resources || []).some((resource) => resource.startsWith("recovery-snapshot."))
);
assert.equal(recoveryResources.length, 1);
assert.deepEqual(recoveryResources[0].resources, ["recovery-snapshot.html"]);
assert.deepEqual(recoveryResources[0].matches, ["https://www.roblox.com/*"]);
assert.equal(recoveryResources[0].use_dynamic_url, true);
assert.equal(
  recoveryResources[0].resources.includes("recovery-snapshot.js") ||
    recoveryResources[0].resources.includes("recovery-snapshot.css"),
  false,
  "only the iframe document is exposed; its script and stylesheet stay internal"
);
assert.doesNotMatch(
  collectorSource,
  /chrome\.storage|localStorage|sessionStorage|indexedDB/i,
  "the collector must not persist account records"
);
assert.doesNotMatch(
  collectorSource,
  /accountsettings\.roblox\.com|collectAccountRecoveryEmail|maskedEmailAddress/,
  "masked account emails must be excluded from the collector"
);

function plain(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function jsonResponse(payload, status = 200, headers = {}) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)])
  );
  return {
    ok: status >= 200 && status < 300,
    status,
    body: null,
    headers: {
      get(name) {
        return normalizedHeaders[String(name).toLowerCase()] ?? null;
      }
    },
    async text() {
      return JSON.stringify(payload);
    }
  };
}

const calls = [];
let fetchHandler = async () => {
  throw new Error("Unexpected recovery request");
};

const chrome = {
  runtime: {
    id: "recovery-fixture",
    lastError: null,
    getURL(relativePath = "") {
      return `chrome-extension://recovery-fixture/${relativePath}`;
    }
  }
};

const context = vm.createContext({
  AbortController,
  Date,
  Error,
  JSON,
  Math,
  Number,
  Object,
  Promise,
  RegExp,
  Set,
  String,
  TextDecoder,
  TextEncoder,
  URL,
  Uint8Array,
  chrome,
  clearTimeout,
  console,
  crypto: webcrypto,
  queueMicrotask,
  setTimeout,
  fetch(url, options) {
    const request = { url: String(url), options: plain(options) };
    calls.push(request);
    return fetchHandler(request.url, options || {});
  }
});

vm.runInContext(`
  const ACCOUNT_RECOVERY_COLLECT_MESSAGE_TYPE = "rsl:account-recovery:collect";
  const ACCOUNT_RECOVERY_PAGE_PATH = "recovery-snapshot.html";
  const ACCOUNT_RECOVERY_PAGE_THEMES = new Set(["dark", "light"]);
  const ACCOUNT_RECOVERY_PAGE_VIEW = "home-modal";
  const ACCOUNT_RECOVERY_FETCH_TIMEOUT_MS = 10_000;
  const ACCOUNT_RECOVERY_MAX_RESPONSE_BYTES = 1_048_576;
  const ACCOUNT_RECOVERY_MAX_TEXT_LENGTH = 500;
  const ACCOUNT_RECOVERY_MAX_USERNAME_HISTORY = 100;
  const ACCOUNT_RECOVERY_MAX_CREATED_EXPERIENCES = 200;
  const ACCOUNT_RECOVERY_MAX_FRIENDS = 200;
  const ACCOUNT_RECOVERY_MAX_RECENT_GAMES = 50;
  const ACCOUNT_RECOVERY_MAX_PURCHASES = 100;
  const ACCOUNT_RECOVERY_MAX_CURRENCY_PURCHASES = 100;
  const ACCOUNT_RECOVERY_MAX_TRADES = 100;
  const ACCOUNT_RECOVERY_MAX_VIOLATIONS = 18;
  const ACCOUNT_RECOVERY_MAX_TWO_STEP_METHODS = 8;
  const ACCOUNT_RECOVERY_SECTION_KEYS = Object.freeze([
    "usernameHistory",
    "twoStepVerification",
    "purchases",
    "currencyPurchases",
    "tradeHistory",
    "recentlyPlayed",
    "createdExperiences",
    "violations"
  ]);
  const ACCOUNT_RECOVERY_SECTION_KEY_SET = new Set(ACCOUNT_RECOVERY_SECTION_KEYS);
  let authenticatedUserRequest = {};
  let quickSettingsReadCount = 0;
  let recoverySnapshotsEnabled = true;
  let recoveryMasterReadSequence = [];

  function readRecoverySnapshotsFeatureEnabled() {
    const next = recoveryMasterReadSequence.length > 0
      ? recoveryMasterReadSequence.shift()
      : recoverySnapshotsEnabled;
    recoverySnapshotsEnabled = next !== false;
    return Promise.resolve(recoverySnapshotsEnabled);
  }

  async function fetchQuickSettingsValues() {
    quickSettingsReadCount += 1;
    return {
      onlineStatus: { value: "Friends" },
      currentExperience: { value: "Friends" },
      inventory: { value: "NoOne" }
    };
  }

  function getTrustedRobloxTopFrameTabId(sender) {
    return sender?.id === chrome.runtime.id &&
      sender?.frameId === 0 &&
      Number.isSafeInteger(sender?.tab?.id) &&
      String(sender.tab.url || "").startsWith("https://www.roblox.com/")
        ? sender.tab.id
        : null;
  }

  function isTrustedRobloxHomePageUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      const segments = url.pathname.toLowerCase().split("/").filter(Boolean);
      return url.protocol === "https:" &&
        url.hostname === "www.roblox.com" &&
        (segments.length === 1 && segments[0] === "home" ||
          segments.length === 2 && segments[1] === "home" &&
            /^[a-z]{2}(?:-[a-z]{2})?$/.test(segments[0]));
    } catch {
      return false;
    }
  }

  ${collectorSource}

  globalThis.recoveryHooks = {
    normalizeAccountRecoveryId,
    normalizeAccountRecoveryDate,
    normalizeAccountRecoveryPurchase,
    normalizeAccountRecoveryCurrencyPurchase,
    normalizeAccountRecoveryTrade,
    normalizeAccountRecoverySectionSelection,
    collectAccountRecoverySnapshot,
    isTrustedAccountRecoveryPageSender,
    handleCollectAccountRecoveryMessage,
    getQuickSettingsReadCount: () => quickSettingsReadCount,
    setRecoverySnapshotsEnabled(value) {
      recoverySnapshotsEnabled = value !== false;
      recoveryMasterReadSequence = [];
    },
    setRecoveryMasterReadSequence(values) {
      recoveryMasterReadSequence = Array.from(values || [], (value) => value !== false);
    }
  };
`, context, { filename: "account-recovery-background-slice.js" });

const hooks = context.recoveryHooks;

function installStableAccountResponses({
  profileUnavailable = false,
  isBanned = false,
  twoStepDisabled = false,
  twoStepUsesNumericEnums = false
} = {}) {
  fetchHandler = async (rawUrl, options) => {
    const url = new URL(rawUrl);
    if (url.hostname === "users.roblox.com" && url.pathname === "/v1/users/authenticated") {
      return jsonResponse({ id: 123, name: "OwnerName", displayName: "Owner Display" });
    }
    if (url.hostname === "users.roblox.com" && url.pathname === "/v1/users/123") {
      if (profileUnavailable) {
        return jsonResponse({ errors: [{ message: "Unavailable" }] }, 503);
      }
      return jsonResponse({
        id: 123,
        name: "OwnerName",
        displayName: "Owner Display",
        description: "Original profile description",
        created: "2018-02-03T04:05:06Z",
        isBanned,
        hasVerifiedBadge: true,
        password: "SECRET_PROFILE_PASSWORD",
        email: "SECRET_PROFILE_EMAIL"
      });
    }
    if (url.pathname === "/v1/users/123/username-history") {
      return jsonResponse({ data: [{ name: "OldOwnerName" }], nextPageCursor: null });
    }
    if (url.hostname === "games.roblox.com" && url.pathname === "/v2/users/123/games") {
      return jsonResponse({
        data: [{
          id: 321,
          rootPlace: { id: 654 },
          name: "Owner's Experience",
          description: "A public creation",
          created: "2020-01-01T00:00:00Z",
          updated: "2026-01-01T00:00:00Z",
          placeVisits: 75
        }],
        nextPageCursor: null
      });
    }
    if (
      url.hostname === "twostepverification.roblox.com" &&
      url.pathname === "/v1/users/123/configuration"
    ) {
      return jsonResponse({
        primaryMediaType: twoStepUsesNumericEnums
          ? twoStepDisabled ? 0 : 2
          : twoStepDisabled ? "Email" : "Authenticator",
        methods: twoStepDisabled
          ? [{
              mediaType: twoStepUsesNumericEnums ? 0 : "Email",
              enabled: false,
              updated: "2026-01-01T00:00:00Z",
              verificationCode: "SECRET_DISABLED_TWO_STEP_CODE"
            }]
          : [
              {
                mediaType: twoStepUsesNumericEnums ? 0 : "Email",
                enabled: true,
                updated: "2024-01-01T00:00:00Z",
                verificationCode: "SECRET_TWO_STEP_CODE"
              },
              {
                mediaType: twoStepUsesNumericEnums ? 2 : "Authenticator",
                enabled: true,
                updated: "2025-01-01T00:00:00Z",
                credentialId: "SECRET_AUTHENTICATOR_CREDENTIAL"
              }
            ],
        recoveryCodes: ["SECRET_BACKUP_CODE"]
      });
    }
    if (
      url.hostname === "economy.roblox.com" &&
      url.pathname === "/v2/users/123/transactions" &&
      url.searchParams.get("transactionType") === "Purchase"
    ) {
      assert.equal(url.searchParams.get("limit"), "100");
      assert.equal(url.searchParams.get("sortOrder"), "Desc");
      return jsonResponse({
        data: [
          {
            id: 777,
            idHash: "SECRET_ID_HASH",
            purchaseToken: "SECRET_PURCHASE_TOKEN",
            created: "2026-02-01T12:30:00Z",
            isPending: true,
            details: { id: 888, name: "Useful item", type: "Asset" },
            agent: { id: 999, name: "Useful seller", type: "User" },
            currency: { amount: -25, type: "Robux" },
            csrfToken: "SECRET_CSRF"
          },
          {
            id: 0,
            created: "2026-01-02T03:04:05.678Z",
            isPending: false,
            details: { id: 889, name: "Completed item", type: "Asset" },
            agent: { id: 0, name: "Roblox", type: "User" },
            currency: { amount: -10, type: "Robux" }
          }
        ],
        nextPageCursor: null
      });
    }
    if (
      url.hostname === "economy.roblox.com" &&
      url.pathname === "/v2/users/123/transactions" &&
      url.searchParams.get("transactionType") === "CurrencyPurchase"
    ) {
      assert.equal(url.searchParams.get("limit"), "100");
      assert.equal(url.searchParams.get("sortOrder"), "Desc");
      return jsonResponse({
        data: [{
          id: 0,
          created: "2025-12-24T11:22:33Z",
          isPending: false,
          details: { id: 0, name: "800 Robux", type: "CurrencyPurchase" },
          agent: { id: 1, name: "Roblox", type: "User" },
          currency: { amount: 800, type: "Robux" },
          paymentToken: "SECRET_PAYMENT_TOKEN"
        }],
        nextPageCursor: null
      });
    }
    if (
      url.hostname === "trades.roblox.com" &&
      url.pathname === "/v1/trades/Completed"
    ) {
      assert.equal(url.searchParams.get("limit"), "100");
      assert.equal(url.searchParams.get("sortOrder"), "Desc");
      return jsonResponse({
        data: [{
          id: 24680,
          created: "2026-02-15T10:20:30Z",
          expiration: "2026-02-19T10:20:30Z",
          isActive: false,
          status: "Completed",
          user: {
            id: 987,
            name: "TradePartner",
            displayName: "Partner Display",
            authenticationToken: "SECRET_TRADE_TOKEN"
          }
        }],
        nextPageCursor: null
      });
    }
    if (url.hostname === "apis.roblox.com" && url.pathname === "/discovery-api/omni-recommendation") {
      assert.equal(options.method, "POST");
      const body = JSON.parse(options.body);
      assert.deepEqual(Object.keys(body).sort(), ["pageType", "sessionId"]);
      return jsonResponse({
        sorts: [{
          topicId: 100000003,
          recommendationList: [{ contentType: "Game", contentId: 321 }]
        }],
        contentMetadata: {
          Game: {
            321: {
              universeId: 321,
              placeId: 654,
              name: "Recently played",
              creatorId: 123,
              creatorName: "OwnerName",
              creatorType: "User",
              sessionToken: "SECRET_RECENT_TOKEN"
            }
          }
        }
      });
    }
    if (
      url.hostname === "apis.roblox.com" &&
      url.pathname === "/moderation-appeal-service/v1/users/123/violations"
    ) {
      return jsonResponse({
        violations: [{
          id: "violation-1",
          category: "Policy category",
          consequence: "Warning",
          createdAt: "2025-01-02T03:04:05Z",
          appealStatus: "Reviewed",
          description: "Visible moderation summary",
          badUtterances: "SECRET_BAD_UTTERANCE",
          context: { raw: "SECRET_MODERATION_CONTEXT" },
          authenticationToken: "SECRET_MODERATION_TOKEN"
        }]
      });
    }
    throw new Error(`Unexpected recovery URL: ${rawUrl}`);
  };
}

function assertNoForbiddenKeys(value) {
  const forbidden = /^(?:password|passwordHash|cookie|csrf|csrfToken|token|resetToken|purchaseToken|idHash|badUtterances|context|recoveryCode|recoveryCodes|verificationCode|credentialId)$/i;
  const visit = (entry) => {
    if (!entry || typeof entry !== "object") return;
    for (const [key, child] of Object.entries(entry)) {
      assert.doesNotMatch(key, forbidden, `snapshot must exclude secret field ${key}`);
      visit(child);
    }
  };
  visit(value);
}

async function main() {
  calls.length = 0;
  assert.equal(hooks.normalizeAccountRecoveryId(0), null);
  assert.equal(hooks.normalizeAccountRecoveryId("0"), null);
  assert.equal(hooks.normalizeAccountRecoveryId(123), "123");
  assert.equal(
    hooks.normalizeAccountRecoveryDate("2026-03-08T13:20:59.859Z"),
    "2026-03-08T13:20:59.859Z"
  );
  assert.equal(hooks.normalizeAccountRecoveryDate(1_772_976_059_859), null);
  assert.equal(hooks.normalizeAccountRecoveryDate("2026-02-31T13:20:59Z"), null);
  installStableAccountResponses();
  const snapshot = plain(await hooks.collectAccountRecoverySnapshot());
  assert.equal(snapshot.schemaVersion, 2);
  assert.deepEqual(snapshot.account, {
    userId: "123",
    username: "OwnerName",
    displayName: "Owner Display",
    createdAt: "2018-02-03T04:05:06.000Z",
    profileUrl: "https://www.roblox.com/users/123/profile"
  });
  assert.equal(
    Object.hasOwn(snapshot.account, "accountStatus"),
    false,
    "normal accounts do not get a meaningless Not banned row"
  );
  assert.equal(Object.hasOwn(snapshot.sections, "email"), false);
  assert.deepEqual(
    Object.keys(snapshot.sections).sort(),
    [
      "createdExperiences",
      "currencyPurchases",
      "purchases",
      "recentlyPlayed",
      "tradeHistory",
      "twoStepVerification",
      "usernameHistory",
      "violations"
    ].sort(),
    "the support document contains only account-recovery evidence sections"
  );
  for (const omittedSection of [
    "passwordStatus",
    "privacySettings",
    "currency",
    "friends",
    "submittedReports"
  ]) {
    assert.equal(
      Object.hasOwn(snapshot.sections, omittedSection),
      false,
      `${omittedSection} is not useful enough for the support document`
    );
  }
  assert.deepEqual(snapshot.sections.usernameHistory.items, [{
    username: "OldOwnerName"
  }]);
  assert.deepEqual(snapshot.sections.twoStepVerification.items, [
    {
      method: "Email",
      role: "Additional method",
      updatedAt: "2024-01-01T00:00:00.000Z"
    },
    {
      method: "Authenticator",
      role: "Primary method",
      updatedAt: "2025-01-01T00:00:00.000Z"
    }
  ]);
  assert.deepEqual(snapshot.sections.purchases.items, [
    {
      holdId: "777",
      purchasedAt: "2026-02-01T12:30:00.000Z",
      itemId: "888",
      itemName: "Useful item",
      itemType: "Asset",
      robuxChange: -25
    },
    {
      purchasedAt: "2026-01-02T03:04:05.678Z",
      itemId: "889",
      itemName: "Completed item",
      itemType: "Asset",
      robuxChange: -10
    }
  ]);
  assert.deepEqual(snapshot.sections.currencyPurchases.items, [{
    purchasedAt: "2025-12-24T11:22:33.000Z",
    packageId: null,
    packageName: "800 Robux",
    robuxReceived: 800
  }]);
  assert.deepEqual(snapshot.sections.tradeHistory.items, [{
    tradeId: "24680",
    tradeCreatedAt: "2026-02-15T10:20:30.000Z",
    partnerUserId: "987",
    partnerUsername: "TradePartner"
  }]);
  assert.equal(snapshot.sections.tradeHistory.capturedAt, snapshot.capturedAt);
  assert.match(snapshot.sections.tradeHistory.coverage, /All 1 completed trades/);
  assert.deepEqual(snapshot.sections.recentlyPlayed.items, [{
    universeId: "321",
    rootPlaceId: "654",
    name: "Recently played",
    gameUrl: "https://www.roblox.com/games/654"
  }]);
  assert.deepEqual(snapshot.sections.createdExperiences.items, [{
    universeId: "321",
    rootPlaceId: "654",
    name: "Owner's Experience",
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    gameUrl: "https://www.roblox.com/games/654"
  }]);
  assert.equal(snapshot.sections.violations.items[0].category, "Policy category");
  assert.equal(snapshot.sections.purchases.capturedAt, snapshot.capturedAt);
  assert.match(snapshot.sections.purchases.coverage, /All 2 item purchases/);
  assert.equal(snapshot.sections.recentlyPlayed.capturedAt, snapshot.capturedAt);
  assert.match(
    snapshot.sections.recentlyPlayed.coverage,
    /does not mean they were played on the capture date/
  );
  assert.equal(Object.hasOwn(snapshot, "contact"), false);
  assert.equal(Object.hasOwn(snapshot, "captureDurationMs"), false);
  assertNoForbiddenKeys(snapshot);
  const serialized = JSON.stringify(snapshot);
  assert.equal(
    serialized.includes('"pending"'),
    false,
    "pending transaction flags are not included anywhere in the support snapshot"
  );
  for (const sentinel of [
    "SECRET_PROFILE_PASSWORD",
    "SECRET_PROFILE_EMAIL",
    "SECRET_TWO_STEP_CODE",
    "SECRET_AUTHENTICATOR_CREDENTIAL",
    "SECRET_BACKUP_CODE",
    "SECRET_ID_HASH",
    "SECRET_PURCHASE_TOKEN",
    "SECRET_CSRF",
    "SECRET_PAYMENT_TOKEN",
    "SECRET_TRADE_TOKEN",
    "SECRET_RECENT_TOKEN",
    "SECRET_BAD_UTTERANCE",
    "SECRET_MODERATION_CONTEXT",
    "SECRET_MODERATION_TOKEN"
  ]) {
    assert.equal(serialized.includes(sentinel), false, `${sentinel} must be discarded`);
  }
  assert.equal(
    calls.some((call) => call.url.startsWith("https://accountsettings.roblox.com/")),
    false,
    "the masked-email endpoint is never contacted"
  );
  assert.equal(
    calls.some((call) => call.url.startsWith("https://auth.roblox.com/v2/passwords/")),
    false,
    "password-status data is outside the support-focused snapshot"
  );
  assert.equal(
    calls.some((call) => call.url.startsWith("https://friends.roblox.com/")),
    false,
    "friend lists are outside the support-focused snapshot"
  );
  assert.equal(
    hooks.getQuickSettingsReadCount(),
    0,
    "privacy quick settings are outside the support-focused snapshot"
  );

  assert.deepEqual(
    plain(hooks.normalizeAccountRecoverySectionSelection([
      "purchases",
      "violations"
    ])),
    ["purchases", "violations"]
  );
  assert.equal(
    hooks.normalizeAccountRecoverySectionSelection(["purchases", "purchases"]),
    null
  );
  assert.equal(
    hooks.normalizeAccountRecoverySectionSelection(["notASection"]),
    null
  );

  calls.length = 0;
  installStableAccountResponses();
  const purchaseOnly = plain(
    await hooks.collectAccountRecoverySnapshot(["purchases"])
  );
  assert.equal(purchaseOnly.sections.purchases.status, "complete");
  assert.equal(purchaseOnly.sections.currencyPurchases.status, "not-requested");
  assert.equal(purchaseOnly.sections.tradeHistory.status, "not-requested");
  assert.equal(purchaseOnly.sections.recentlyPlayed.status, "not-requested");
  assert.equal(purchaseOnly.sections.createdExperiences.status, "not-requested");
  assert.equal(purchaseOnly.sections.violations.status, "not-requested");
  assert.equal(
    calls.some(({ url }) =>
      new URL(url).searchParams.get("transactionType") === "CurrencyPurchase"
    ),
    false,
    "an excluded private section must not be requested"
  );
  assert.equal(
    calls.some(({ url }) =>
      new URL(url).pathname === "/discovery-api/omni-recommendation"
    ),
    false,
    "excluded activity must not be requested"
  );
  assert.equal(
    calls.some(({ url }) => new URL(url).hostname === "trades.roblox.com"),
    false,
    "excluded trade history must not be requested"
  );

  installStableAccountResponses({ isBanned: true });
  const bannedSnapshot = plain(await hooks.collectAccountRecoverySnapshot());
  assert.equal(
    bannedSnapshot.account.accountStatus,
    "Banned",
    "account status is retained only when Roblox reports an actual ban"
  );

  installStableAccountResponses({ twoStepDisabled: true });
  const noTwoStepSnapshot = plain(await hooks.collectAccountRecoverySnapshot());
  assert.equal(
    Object.hasOwn(noTwoStepSnapshot.sections, "twoStepVerification"),
    false,
    "accounts without positive 2-step evidence do not get a potentially misleading negative row"
  );
  assert.equal(
    JSON.stringify(noTwoStepSnapshot).includes("SECRET_DISABLED_TWO_STEP_CODE"),
    false
  );
  assert.equal(
    JSON.stringify(noTwoStepSnapshot).includes("Not enabled"),
    false
  );

  installStableAccountResponses({ twoStepUsesNumericEnums: true });
  const numericTwoStepSnapshot = plain(
    await hooks.collectAccountRecoverySnapshot()
  );
  assert.deepEqual(
    numericTwoStepSnapshot.sections.twoStepVerification.items,
    snapshot.sections.twoStepVerification.items,
    "the documented numeric and observed string media-type shapes produce the same enabled methods"
  );

  installStableAccountResponses({ profileUnavailable: true });
  const partialProfile = plain(await hooks.collectAccountRecoverySnapshot());
  assert.equal(partialProfile.account.userId, "123");
  assert.equal(partialProfile.account.username, "OwnerName");
  assert.equal(partialProfile.sections.profileDetails.status, "partial");
  assert.match(
    partialProfile.sections.profileDetails.note,
    /profile details could not be loaded/i
  );

  let authenticatedReads = 0;
  fetchHandler = async (rawUrl) => {
    const url = new URL(rawUrl);
    if (url.hostname === "users.roblox.com" && url.pathname === "/v1/users/authenticated") {
      authenticatedReads += 1;
      return jsonResponse(authenticatedReads === 1
        ? { id: 123, name: "OwnerName", displayName: "Owner Display" }
        : { id: 999, name: "OtherUser", displayName: "Other User" });
    }
    if (url.hostname === "users.roblox.com" && url.pathname === "/v1/users/123") {
      return jsonResponse({ id: 123, name: "OwnerName", displayName: "Owner Display" });
    }
    if (url.pathname === "/v1/users/123/username-history") {
      return jsonResponse({ data: [], nextPageCursor: null });
    }
    if (url.hostname === "games.roblox.com") return jsonResponse({ data: [] });
    if (url.pathname === "/v2/users/123/transactions") return jsonResponse({ data: [] });
    if (url.pathname === "/discovery-api/omni-recommendation") return jsonResponse({ sorts: [] });
    if (url.pathname.endsWith("/violations")) return jsonResponse({ violations: [] });
    throw new Error(`Unexpected switch-test URL: ${rawUrl}`);
  };
  await assert.rejects(
    hooks.collectAccountRecoverySnapshot(),
    (error) => error?.code === "ACCOUNT_CHANGED",
    "a sign-in change rejects the whole snapshot instead of mixing accounts"
  );

  const expectedPage =
    `${chrome.runtime.getURL("recovery-snapshot.html")}?theme=dark&view=home-modal`;
  const trustedPageSender = {
    id: chrome.runtime.id,
    frameId: 7,
    url: expectedPage,
    origin: new URL(expectedPage).origin,
    documentLifecycle: "active",
    frameType: "sub_frame",
    tab: { id: 9, url: "https://www.roblox.com/home" }
  };
  assert.equal(hooks.isTrustedAccountRecoveryPageSender(trustedPageSender), true);
  const dynamicPage =
    "chrome-extension://per-session-recovery-id/recovery-snapshot.html?theme=light&view=home-modal";
  assert.equal(
    hooks.isTrustedAccountRecoveryPageSender({
      ...trustedPageSender,
      url: dynamicPage,
      origin: new URL(dynamicPage).origin
    }),
    true,
    "the per-session web-accessible-resource host is accepted for this extension"
  );
  assert.equal(
    hooks.isTrustedAccountRecoveryPageSender({ ...trustedPageSender, url: `${expectedPage}&fake=1` }),
    false
  );
  assert.equal(
    hooks.isTrustedAccountRecoveryPageSender({
      ...trustedPageSender,
      url: `${expectedPage}&theme=dark`
    }),
    false,
    "duplicate query keys are rejected"
  );
  assert.equal(
    hooks.isTrustedAccountRecoveryPageSender({ ...trustedPageSender, url: `${expectedPage}#x` }),
    false
  );
  assert.equal(
    hooks.isTrustedAccountRecoveryPageSender({ ...trustedPageSender, frameId: 0 }),
    false,
    "a top-frame extension page cannot collect"
  );
  assert.equal(
    hooks.isTrustedAccountRecoveryPageSender({
      ...trustedPageSender,
      id: "different-extension"
    }),
    false,
    "a similarly named frame from another extension is rejected"
  );
  assert.equal(
    hooks.isTrustedAccountRecoveryPageSender({
      ...trustedPageSender,
      tab: { id: 9, url: "https://www.roblox.com/games/123/Test" }
    }),
    false,
    "the private iframe is valid only inside Roblox Home"
  );
  assert.equal(
    hooks.isTrustedAccountRecoveryPageSender({
      ...trustedPageSender,
      tab: {
        id: 9,
        url: "https://www.roblox.com/home",
        pendingUrl: "https://www.roblox.com/games/123/Test"
      }
    }),
    false,
    "collection stops while the Home tab is navigating elsewhere"
  );
  assert.equal(
    hooks.isTrustedAccountRecoveryPageSender({
      ...trustedPageSender,
      frameType: "outermost_frame"
    }),
    false,
    "only a child extension frame can collect"
  );
  assert.equal(
    hooks.isTrustedAccountRecoveryPageSender({
      ...trustedPageSender,
      origin: "chrome-extension://impostor"
    }),
    false
  );
  assert.equal(
    hooks.isTrustedAccountRecoveryPageSender({
      ...trustedPageSender,
      documentLifecycle: "cached"
    }),
    false
  );

  const emptyCollectRequest = (requestId) => ({
    type: "rsl:account-recovery:collect",
    requestId,
    sections: []
  });
  installStableAccountResponses();
  calls.length = 0;
  hooks.setRecoverySnapshotsEnabled(false);
  const manualWhileMasterOff = await new Promise((resolve) => {
    assert.equal(
      hooks.handleCollectAccountRecoveryMessage(
        emptyCollectRequest(20),
        trustedPageSender,
        (reply) => resolve(plain(reply))
      ),
      true
    );
  });
  assert.equal(manualWhileMasterOff.ok, true);
  assert.equal(manualWhileMasterOff.requestId, 20);
  assert.equal(manualWhileMasterOff.snapshot?.account?.userId, "123");
  assert.ok(
    calls.length > 0,
    "a deliberate manual snapshot must still request Roblox while the Recovery master is off"
  );
  hooks.setRecoverySnapshotsEnabled(true);

  const invalidReplies = [];
  assert.equal(
    hooks.handleCollectAccountRecoveryMessage(
      {
        type: "rsl:account-recovery:collect",
        requestId: 1,
        sections: ["purchases"],
        extra: true
      },
      trustedPageSender,
      (reply) => invalidReplies.push(plain(reply))
    ),
    false
  );
  assert.deepEqual(invalidReplies, [{ ok: false, requestId: 1, code: "INVALID" }]);

  console.log("PASS account recovery collector privacy, account binding, email exclusion, and sender trust");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
