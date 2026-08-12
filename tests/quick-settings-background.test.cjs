"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const backgroundSource = fs.readFileSync(path.join(root, "background.js"), "utf8");

const csrfToken = "fixture-csrf-token";
let settingsReads = 0;
let authenticatedReads = 0;
let postAttempts = 0;
const postBodies = [];
const postTokens = [];
let authenticatedViewerId = 9001;
let authenticatedViewerSequence = [];
let csrfHeaderValue = csrfToken;
let postMode = "success";
let settingsPayloadOverride = null;
let settingsReadMutationAt = 0;
let settingsReadMutation = null;
let restoreConfirmationFailuresRemaining = 0;
let storageSetCallCount = 0;
const storageSetFailureCalls = new Set();
const localStorageState = Object.create(null);
let nextStorageGetGate = null;
const fullOnlineStatusOptions = [
  "AllUsers",
  "FriendsFollowingAndFollowers",
  "FriendsAndFollowing",
  "Friends",
  "TrustedFriends",
  "NoOne"
];
const fullCurrentExperienceOptions = [
  "All",
  "Followers",
  "Following",
  "Friends",
  "TrustedFriends",
  "NoOne"
];
const coupledExperienceByOnlineStatus = {
  AllUsers: "All",
  FriendsFollowingAndFollowers: "Followers",
  FriendsAndFollowing: "Following",
  Friends: "Friends",
  TrustedFriends: "TrustedFriends",
  NoOne: "NoOne"
};
const settings = {
  whoCanSeeMyOnlineStatus: {
    currentValue: "Friends",
    options: ["AllUsers", "Friends", "TrustedFriends", "NoOne"]
  },
  whoCanJoinMeInExperiences: {
    currentValue: "Friends",
    options: ["All", "Friends", "NoOne"]
  },
  whoCanSeeMyInventory: {
    currentValue: "Friends",
    options: ["AllUsers", "Friends", "NoOne"]
  }
};

function getFixtureSettingsPayload() {
  const payload = structuredClone(settings);
  if (postMode !== "dynamic-coupled") {
    return payload;
  }
  payload.whoCanSeeMyOnlineStatus.options =
    payload.whoCanJoinMeInExperiences.currentValue === "All"
      ? ["AllUsers"]
      : fullOnlineStatusOptions.slice();
  payload.whoCanJoinMeInExperiences.options =
    payload.whoCanSeeMyOnlineStatus.currentValue === "NoOne"
      ? ["NoOne"]
      : fullCurrentExperienceOptions.slice();
  return payload;
}

function jsonResponse(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}

function armNextStorageGetGate() {
  assert.equal(nextStorageGetGate, null, "only one storage read may be gated at a time");
  let signalStarted;
  const gate = {
    request: null,
    started: new Promise((resolve) => {
      signalStarted = resolve;
    }),
    release() {
      assert.ok(gate.request, "the gated storage read must start before release");
      const { defaults, callback } = gate.request;
      gate.request = null;
      callback({ ...(defaults || {}), ...structuredClone(localStorageState) });
    }
  };
  gate.signalStarted = signalStarted;
  nextStorageGetGate = gate;
  return gate;
}

async function fixtureFetch(input, options = {}) {
  const url = new URL(String(input));
  if (url.href === "https://users.roblox.com/v1/users/authenticated") {
    authenticatedReads += 1;
    const id = authenticatedViewerSequence.length > 0
      ? authenticatedViewerSequence.shift()
      : authenticatedViewerId;
    return jsonResponse({ id, name: "Fixture", displayName: "Fixture" });
  }
  if (
    url.href ===
      "https://apis.roblox.com/user-settings-api/v1/user-settings/settings-and-options"
  ) {
    settingsReads += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (restoreConfirmationFailuresRemaining > 0) {
      restoreConfirmationFailuresRemaining -= 1;
      return jsonResponse({ errors: [{ code: 503 }] }, 503);
    }
    if (
      settingsReadMutationAt === settingsReads &&
      typeof settingsReadMutation === "function"
    ) {
      settingsReadMutation();
      settingsReadMutationAt = 0;
      settingsReadMutation = null;
    }
    return jsonResponse(
      settingsPayloadOverride === null
        ? getFixtureSettingsPayload()
        : structuredClone(settingsPayloadOverride)
    );
  }
  if (
    url.href === "https://apis.roblox.com/user-settings-api/v1/user-settings" &&
    options.method === "POST"
  ) {
    postAttempts += 1;
    const token = options.headers?.["x-csrf-token"] || "";
    postTokens.push(token);
    if (token !== csrfToken) {
      return jsonResponse({ errors: [{ code: 0 }] }, 403, {
        "x-csrf-token": csrfHeaderValue
      });
    }
    const body = JSON.parse(options.body);
    postBodies.push(body);
    const keys = Object.keys(body);
    assert.ok(keys.length >= 1 && keys.length <= 2, "settings POST has a bounded field count");
    for (const key of keys) {
      assert.ok(Object.hasOwn(settings, key), "POST used an unknown settings field");
    }
    if (postMode === "reject-multifield-500" && keys.length > 1) {
      return jsonResponse({ errors: [{ code: 500 }] }, 500);
    }
    if (postMode === "dynamic-coupled") {
      const livePayload = getFixtureSettingsPayload();
      for (const key of keys) {
        assert.ok(
          livePayload[key].options.includes(body[key]),
          `dynamic policy rejected ${key}=${body[key]}`
        );
      }
    }
    if (
      postMode === "reject-current-experience-400" &&
      body.whoCanJoinMeInExperiences === "NoOne"
    ) {
      return jsonResponse({ errors: [{ code: 400 }] }, 400);
    }
    for (const key of keys) {
      settings[key].currentValue = body[key];
    }
    if (
      postMode === "auto-coupled" &&
      body.whoCanSeeMyOnlineStatus === "NoOne"
    ) {
      settings.whoCanJoinMeInExperiences.currentValue = "NoOne";
    }
    if (
      postMode === "auto-map-experience" &&
      body.whoCanSeeMyOnlineStatus
    ) {
      settings.whoCanJoinMeInExperiences.currentValue =
        coupledExperienceByOnlineStatus[body.whoCanSeeMyOnlineStatus];
    }
    if (
      postMode === "restore-commit-then-500" &&
      body.whoCanSeeMyOnlineStatus
    ) {
      settings.whoCanJoinMeInExperiences.currentValue =
        coupledExperienceByOnlineStatus[body.whoCanSeeMyOnlineStatus];
    }
    if (
      postMode === "restore-companion-race" &&
      body.whoCanJoinMeInExperiences &&
      body.whoCanJoinMeInExperiences !== "NoOne"
    ) {
      settings.whoCanSeeMyOnlineStatus.currentValue = "NoOne";
    }
    if (postMode === "commit-then-500") {
      return jsonResponse({ errors: [{ code: 500 }] }, 500);
    }
    if (
      postMode === "restore-commit-then-500" &&
      body.whoCanJoinMeInExperiences
    ) {
      restoreConfirmationFailuresRemaining = 2;
      return jsonResponse({ errors: [{ code: 500 }] }, 500);
    }
    return new Response(null, { status: 204 });
  }
  throw new Error(`Unexpected fixture request: ${url.href}`);
}

const extensionListeners = [];
const context = vm.createContext({
  AbortController,
  Error,
  Promise,
  Response,
  Set,
  Map,
  TypeError,
  URL,
  URLSearchParams,
  clearTimeout,
  console,
  crypto,
  fetch: fixtureFetch,
  setTimeout,
  structuredClone,
  __rslBackgroundTestHooks: {},
  chrome: {
    runtime: {
      id: "fixture-extension",
      lastError: null,
      onInstalled: { addListener() {} },
      onMessage: {
        addListener(listener) {
          extensionListeners.push(listener);
        }
      }
    },
    contextMenus: {
      create() {},
      removeAll(callback) {
        callback?.();
      },
      onClicked: { addListener() {} }
    },
    scripting: { executeScript: async () => [] },
    storage: {
      local: {
        get(defaults, callback) {
          if (nextStorageGetGate) {
            const gate = nextStorageGetGate;
            nextStorageGetGate = null;
            gate.request = { defaults, callback };
            gate.signalStarted();
            return;
          }
          callback({ ...(defaults || {}), ...structuredClone(localStorageState) });
        },
        set(value, callback) {
          storageSetCallCount += 1;
          if (storageSetFailureCalls.delete(storageSetCallCount)) {
            context.chrome.runtime.lastError = {
              message: "fixture storage write failed"
            };
            callback?.();
            context.chrome.runtime.lastError = null;
            return;
          }
          Object.assign(localStorageState, structuredClone(value || {}));
          callback?.();
        },
        remove(key, callback) {
          for (const item of Array.isArray(key) ? key : [key]) {
            delete localStorageState[item];
          }
          callback?.();
        }
      }
    }
  }
});

vm.runInContext(backgroundSource, context, { filename: "background.js" });
const hooks = context.__rslBackgroundTestHooks;
assert.equal(extensionListeners.length, 1);

const trustedSender = {
  id: "fixture-extension",
  frameId: 0,
  url: "https://www.roblox.com/home",
  tab: { id: 73, url: "https://www.roblox.com/home" }
};

function runtimeMessage(message, sender = trustedSender) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("message timed out")), 2_000);
    hooks.handleRuntimeMessage(message, sender, (response) => {
      clearTimeout(timeout);
      resolve(response);
    });
  });
}

(async () => {
  const normalized = hooks.normalizeQuickSettingsPayload({
    whoCanSeeMyOnlineStatus: {
      currentValue: "Friends",
      options: [
        "Friends",
        {
          option: { optionValue: "NoOne" },
          requirement: "SelfUpdateSetting"
        },
        {
          option: { optionValue: "AllUsers" },
          requirement: "ParentUpdateSetting"
        },
        "InjectedValue",
        "Friends"
      ]
    },
    whoCanSeeMyInventory: {
      currentValue: "NoOne",
      options: []
    },
    privateServerPrivacy: {
      currentValue: "Friends",
      options: ["Friends", "NoOne"]
    },
    updateFriendsAboutMyActivity: {
      currentValue: "Yes",
      options: ["Yes", "No"]
    }
  });
  assert.deepEqual(Array.from(normalized.onlineStatus.options), ["Friends", "NoOne"]);
  assert.equal(normalized.onlineStatus.editable, true);
  assert.equal(normalized.inventory.value, "NoOne");
  assert.equal(normalized.inventory.editable, false);
  assert.equal(Object.hasOwn(normalized, "privateServerInvites"), false);
  assert.equal(Object.hasOwn(normalized, "shareActivity"), false);
  assert.equal(Object.hasOwn(normalized, "InjectedValue"), false);

  const alternativesOnly = hooks.normalizeQuickSettingsPayload({
    whoCanSeeMyOnlineStatus: {
      currentValue: "NoOne",
      options: ["AllUsers", "Friends"]
    },
    whoCanJoinMeInExperiences: {
      currentValue: "NoOne",
      options: ["All", "Friends"]
    }
  });
  assert.deepEqual(
    Array.from(alternativesOnly.onlineStatus.options),
    ["NoOne", "AllUsers", "Friends"]
  );
  assert.equal(alternativesOnly.onlineStatus.editable, true);
  assert.deepEqual(
    Array.from(alternativesOnly.currentExperience.options),
    ["NoOne", "All", "Friends"]
  );
  assert.equal(alternativesOnly.currentExperience.editable, true);

  const readsBeforeDedupe = settingsReads;
  const firstSnapshot = hooks.getQuickSettingsSnapshot();
  const secondSnapshot = hooks.getQuickSettingsSnapshot();
  assert.strictEqual(firstSnapshot, secondSnapshot, "concurrent reads should be deduplicated");
  const snapshot = await firstSnapshot;
  assert.equal(snapshot.viewerUserId, "9001");
  assert.equal(settingsReads, readsBeforeDedupe + 1);

  const readResponse = await runtimeMessage({
    type: "rsl:get-quick-settings",
    requestId: 1
  });
  assert.equal(readResponse.ok, true);
  assert.equal(readResponse.viewerUserId, "9001");
  assert.equal(readResponse.settings.onlineStatus.value, "Friends");
  assert.equal(readResponse.settings.currentExperience.value, "Friends");
  assert.equal(readResponse.settings.inventory.value, "Friends");

  const untrustedReadsBefore = settingsReads;
  const untrustedResponse = await runtimeMessage(
    { type: "rsl:get-quick-settings", requestId: 2 },
    {
      ...trustedSender,
      url: "https://www.roblox.com/games/123/Test",
      tab: { id: 73, url: "https://www.roblox.com/games/123/Test" }
    }
  );
  assert.equal(untrustedResponse.ok, false);
  assert.equal(untrustedResponse.code, "INVALID");
  assert.equal(settingsReads, untrustedReadsBefore);

  let legacyRouteResponded = false;
  const legacyRouteHandled = hooks.handleRuntimeMessage(
    {
      type: "rsl:update-online-visibility",
      requestId: 20,
      viewerUserId: "9001",
      expectedOnlineStatus: "Friends",
      expectedCurrentExperience: "Friends",
      requestedPreset: "noOne"
    },
    trustedSender,
    () => {
      legacyRouteResponded = true;
    }
  );
  assert.equal(legacyRouteHandled, false);
  assert.equal(legacyRouteResponded, false);

  postMode = "auto-coupled";
  const updateResponse = await runtimeMessage({
    type: "rsl:update-online-status",
    requestId: 3,
    viewerUserId: "9001",
    expectedOnlineStatus: "Friends",
    expectedCurrentExperience: "Friends",
    requestedOnlineStatus: "NoOne"
  });
  assert.equal(updateResponse.ok, true);
  assert.equal(updateResponse.settings.onlineStatus.value, "NoOne");
  assert.equal(updateResponse.settings.currentExperience.value, "NoOne");
  assert.equal(
    postAttempts,
    2,
    "the Online Status write should reuse the CSRF token after one challenge"
  );
  assert.deepEqual(postTokens, ["", csrfToken]);
  assert.deepEqual(postBodies, [{ whoCanSeeMyOnlineStatus: "NoOne" }]);
  assert.doesNotMatch(JSON.stringify(updateResponse), /fixture-csrf-token/);
  postMode = "success";

  const attemptsBeforeCachedToken = postAttempts;
  const secondUpdate = await runtimeMessage({
    type: "rsl:update-quick-setting",
    requestId: 4,
    viewerUserId: "9001",
    alias: "inventory",
    expectedValue: "Friends",
    requestedValue: "NoOne"
  });
  assert.equal(secondUpdate.ok, true);
  assert.equal(postAttempts, attemptsBeforeCachedToken + 1);
  assert.equal(postTokens.at(-1), csrfToken);

  const attemptsBeforeConflict = postAttempts;
  const conflict = await runtimeMessage({
    type: "rsl:update-online-status",
    requestId: 5,
    viewerUserId: "9001",
    expectedOnlineStatus: "Friends",
    expectedCurrentExperience: "NoOne",
    requestedOnlineStatus: "AllUsers"
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.code, "CONFLICT");
  assert.equal(postAttempts, attemptsBeforeConflict);

  const directOnlineStatusUpdate = await runtimeMessage({
    type: "rsl:update-quick-setting",
    requestId: 50,
    viewerUserId: "9001",
    alias: "onlineStatus",
    expectedValue: "NoOne",
    requestedValue: "Friends"
  });
  assert.equal(directOnlineStatusUpdate.ok, false);
  assert.equal(directOnlineStatusUpdate.code, "INVALID");
  assert.equal(postAttempts, attemptsBeforeConflict);

  const directCurrentExperienceUpdate = await runtimeMessage({
    type: "rsl:update-quick-setting",
    requestId: 52,
    viewerUserId: "9001",
    alias: "currentExperience",
    expectedValue: "NoOne",
    requestedValue: "Friends"
  });
  assert.equal(directCurrentExperienceUpdate.ok, true);
  assert.equal(
    await hooks.readPreferredCurrentExperience("9001"),
    null,
    "a normal Current Experience change must not arm an automatic restore"
  );
  const attemptsAfterDirectCurrentExperience = postAttempts;

  await hooks.writePreferredCurrentExperience("9001", "Friends");
  const equalOnlineStatus = await runtimeMessage({
    type: "rsl:update-online-status",
    requestId: 51,
    viewerUserId: "9001",
    expectedOnlineStatus: "NoOne",
    expectedCurrentExperience: "Friends",
    requestedOnlineStatus: "NoOne"
  });
  assert.equal(equalOnlineStatus.ok, false);
  assert.equal(equalOnlineStatus.code, "INVALID");
  assert.equal(
    await hooks.readPreferredCurrentExperience("9001"),
    "Friends",
    "an equal-value request must not consume the one-use restore record"
  );
  await hooks.clearPreferredCurrentExperience("9001");
  assert.equal(postAttempts, attemptsAfterDirectCurrentExperience);

  const invalid = await runtimeMessage({
    type: "rsl:update-quick-setting",
    requestId: 6,
    viewerUserId: "9001",
    alias: "inventory",
    expectedValue: "NoOne",
    requestedValue: "InjectedValue"
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.code, "INVALID");
  assert.equal(postAttempts, attemptsAfterDirectCurrentExperience);

  for (const alias of ["privateServerInvites", "shareActivity"]) {
    const attemptsBeforeRemovedSetting = postAttempts;
    const removedSetting = await runtimeMessage({
      type: "rsl:update-quick-setting",
      requestId: 60,
      viewerUserId: "9001",
      alias,
      expectedValue: "Friends",
      requestedValue: "NoOne"
    });
    assert.equal(removedSetting.ok, false);
    assert.equal(removedSetting.code, "INVALID");
    assert.equal(postAttempts, attemptsBeforeRemovedSetting);
  }

  const staleTabReadsBefore = settingsReads;
  const staleTabSender = await runtimeMessage(
    { type: "rsl:get-quick-settings", requestId: 7 },
    {
      ...trustedSender,
      url: "https://www.roblox.com/home",
      tab: { id: 73, url: "https://www.roblox.com/games/123/Test" }
    }
  );
  assert.equal(staleTabSender.ok, false);
  assert.equal(staleTabSender.code, "INVALID");
  assert.equal(settingsReads, staleTabReadsBefore);

  hooks.resetQuickSettingsStateForTests();
  authenticatedViewerSequence = [9001, 9002];
  await assert.rejects(
    hooks.fetchVerifiedQuickSettingsSnapshot(),
    (error) => error?.code === "ACCOUNT_CHANGED"
  );

  hooks.resetQuickSettingsStateForTests();
  settings.whoCanSeeMyOnlineStatus.currentValue = "Friends";
  authenticatedViewerSequence = [9001, 9002];
  const postsBeforePreflightSwitch = postAttempts;
  await assert.rejects(
    hooks.applyQuickSettingUpdate("9001", "onlineStatus", "Friends", "NoOne"),
    (error) => error?.code === "ACCOUNT_CHANGED"
  );
  assert.equal(
    postAttempts,
    postsBeforePreflightSwitch,
    "an account switch during preflight must prevent the POST"
  );

  hooks.resetQuickSettingsStateForTests();
  settings.whoCanSeeMyOnlineStatus.currentValue = "Friends";
  authenticatedViewerSequence = [9001, 9001, 9002];
  const postsBeforeChallengeSwitch = postAttempts;
  await assert.rejects(
    hooks.applyQuickSettingUpdate("9001", "onlineStatus", "Friends", "NoOne"),
    (error) => error?.code === "ACCOUNT_CHANGED"
  );
  assert.equal(
    postAttempts,
    postsBeforeChallengeSwitch + 1,
    "a switched account must never receive the CSRF retry"
  );
  assert.equal(settings.whoCanSeeMyOnlineStatus.currentValue, "Friends");

  hooks.resetQuickSettingsStateForTests();
  authenticatedViewerSequence = [];
  csrfHeaderValue = "";
  const postsBeforeBadToken = postAttempts;
  await assert.rejects(
    hooks.applyQuickSettingUpdate("9001", "onlineStatus", "Friends", "NoOne"),
    (error) => error?.status === 403
  );
  assert.equal(postAttempts, postsBeforeBadToken + 1);
  assert.equal(settings.whoCanSeeMyOnlineStatus.currentValue, "Friends");
  csrfHeaderValue = csrfToken;

  hooks.resetQuickSettingsStateForTests();
  settings.whoCanSeeMyOnlineStatus.currentValue = "AllUsers";
  settings.whoCanJoinMeInExperiences.currentValue = "Friends";
  await hooks.writePreferredCurrentExperience("9001", "All");
  postMode = "auto-coupled";
  const postsBeforeSeparatedDisable = postBodies.length;
  const separatedDisable = await runtimeMessage({
    type: "rsl:update-online-status",
    requestId: 70,
    viewerUserId: "9001",
    expectedOnlineStatus: "AllUsers",
    expectedCurrentExperience: "Friends",
    requestedOnlineStatus: "NoOne"
  });
  assert.equal(separatedDisable.ok, true);
  assert.equal(separatedDisable.settings.onlineStatus.value, "NoOne");
  assert.equal(separatedDisable.settings.currentExperience.value, "NoOne");
  assert.equal(await hooks.readPreferredCurrentExperience("9001"), "Friends");
  assert.deepEqual(postBodies.slice(postsBeforeSeparatedDisable), [
    { whoCanSeeMyOnlineStatus: "NoOne" }
  ]);

  hooks.resetQuickSettingsStateForTests();
  postMode = "dynamic-coupled";
  const postsBeforeSeparatedRestore = postBodies.length;
  const separatedRestore = await runtimeMessage({
    type: "rsl:update-online-status",
    requestId: 71,
    viewerUserId: "9001",
    expectedOnlineStatus: "NoOne",
    expectedCurrentExperience: "NoOne",
    requestedOnlineStatus: "AllUsers"
  });
  assert.equal(separatedRestore.ok, true);
  assert.equal(separatedRestore.experienceRestore, "restored");
  assert.equal(separatedRestore.settings.onlineStatus.value, "AllUsers");
  assert.equal(separatedRestore.settings.currentExperience.value, "Friends");
  assert.deepEqual(postBodies.slice(postsBeforeSeparatedRestore), [
    { whoCanSeeMyOnlineStatus: "AllUsers" },
    { whoCanJoinMeInExperiences: "Friends" }
  ]);

  hooks.resetQuickSettingsStateForTests();
  settings.whoCanSeeMyOnlineStatus.currentValue = "AllUsers";
  settings.whoCanJoinMeInExperiences.currentValue = "Friends";
  postMode = "auto-map-experience";
  const postsBeforeGenericRestore = postBodies.length;
  const genericRestore = await runtimeMessage({
    type: "rsl:update-online-status",
    requestId: 80,
    viewerUserId: "9001",
    expectedOnlineStatus: "AllUsers",
    expectedCurrentExperience: "Friends",
    requestedOnlineStatus: "TrustedFriends"
  });
  assert.equal(genericRestore.ok, true);
  assert.equal(genericRestore.experienceRestore, "restored");
  assert.equal(genericRestore.settings.onlineStatus.value, "TrustedFriends");
  assert.equal(genericRestore.settings.currentExperience.value, "Friends");
  assert.deepEqual(postBodies.slice(postsBeforeGenericRestore), [
    { whoCanSeeMyOnlineStatus: "TrustedFriends" },
    { whoCanJoinMeInExperiences: "Friends" }
  ]);

  hooks.resetQuickSettingsStateForTests();
  settings.whoCanSeeMyOnlineStatus.currentValue = "AllUsers";
  settings.whoCanJoinMeInExperiences.currentValue = "NoOne";
  const postsBeforeExplicitNoOneRestore = postBodies.length;
  const explicitNoOneRestore = await runtimeMessage({
    type: "rsl:update-online-status",
    requestId: 81,
    viewerUserId: "9001",
    expectedOnlineStatus: "AllUsers",
    expectedCurrentExperience: "NoOne",
    requestedOnlineStatus: "Friends"
  });
  assert.equal(explicitNoOneRestore.ok, true);
  assert.equal(explicitNoOneRestore.experienceRestore, "restored");
  assert.equal(explicitNoOneRestore.settings.currentExperience.value, "NoOne");
  assert.deepEqual(postBodies.slice(postsBeforeExplicitNoOneRestore), [
    { whoCanSeeMyOnlineStatus: "Friends" },
    { whoCanJoinMeInExperiences: "NoOne" }
  ]);

  hooks.resetQuickSettingsStateForTests();
  settings.whoCanSeeMyOnlineStatus.currentValue = "AllUsers";
  settings.whoCanJoinMeInExperiences.currentValue = "Friends";
  const postsBeforeAlreadyPreserved = postBodies.length;
  const alreadyPreserved = await runtimeMessage({
    type: "rsl:update-online-status",
    requestId: 82,
    viewerUserId: "9001",
    expectedOnlineStatus: "AllUsers",
    expectedCurrentExperience: "Friends",
    requestedOnlineStatus: "Friends"
  });
  assert.equal(alreadyPreserved.ok, true);
  assert.equal(alreadyPreserved.experienceRestore, "unchanged");
  assert.deepEqual(postBodies.slice(postsBeforeAlreadyPreserved), [
    { whoCanSeeMyOnlineStatus: "Friends" }
  ]);

  hooks.resetQuickSettingsStateForTests();
  settings.whoCanSeeMyOnlineStatus.currentValue = "NoOne";
  settings.whoCanJoinMeInExperiences.currentValue = "NoOne";
  await hooks.clearPreferredCurrentExperience("9001");
  const postsBeforeNoRecordRestore = postBodies.length;
  const noRecordRestore = await runtimeMessage({
    type: "rsl:update-online-status",
    requestId: 83,
    viewerUserId: "9001",
    expectedOnlineStatus: "NoOne",
    expectedCurrentExperience: "NoOne",
    requestedOnlineStatus: "Friends"
  });
  assert.equal(noRecordRestore.ok, true);
  assert.equal(noRecordRestore.experienceRestore, "restored");
  assert.equal(noRecordRestore.settings.currentExperience.value, "NoOne");
  assert.deepEqual(postBodies.slice(postsBeforeNoRecordRestore), [
    { whoCanSeeMyOnlineStatus: "Friends" },
    { whoCanJoinMeInExperiences: "NoOne" }
  ]);

  hooks.resetQuickSettingsStateForTests();
  settings.whoCanSeeMyOnlineStatus.currentValue = "NoOne";
  settings.whoCanJoinMeInExperiences.currentValue = "NoOne";
  settings.whoCanJoinMeInExperiences.options = fullCurrentExperienceOptions.slice();
  await hooks.writePreferredCurrentExperience("9001", "TrustedFriends");
  const postsBeforeStoredGenericRestore = postBodies.length;
  const storedGenericRestore = await runtimeMessage({
    type: "rsl:update-online-status",
    requestId: 84,
    viewerUserId: "9001",
    expectedOnlineStatus: "NoOne",
    expectedCurrentExperience: "NoOne",
    requestedOnlineStatus: "Friends"
  });
  assert.equal(storedGenericRestore.ok, true);
  assert.equal(storedGenericRestore.experienceRestore, "restored");
  assert.equal(storedGenericRestore.settings.currentExperience.value, "TrustedFriends");
  assert.deepEqual(postBodies.slice(postsBeforeStoredGenericRestore), [
    { whoCanSeeMyOnlineStatus: "Friends" },
    { whoCanJoinMeInExperiences: "TrustedFriends" }
  ]);
  settings.whoCanJoinMeInExperiences.options = ["All", "Friends", "NoOne"];
  postMode = "success";

  hooks.resetQuickSettingsStateForTests();
  settings.whoCanSeeMyOnlineStatus.currentValue = "AllUsers";
  settings.whoCanJoinMeInExperiences.currentValue = "Friends";
  const explicitNoOne = await runtimeMessage({
    type: "rsl:update-quick-setting",
    requestId: 72,
    viewerUserId: "9001",
    alias: "currentExperience",
    expectedValue: "Friends",
    requestedValue: "NoOne"
  });
  assert.equal(explicitNoOne.ok, true);
  assert.equal(await hooks.readPreferredCurrentExperience("9001"), null);
  postMode = "auto-coupled";
  const disableWithExplicitNoOne = await runtimeMessage({
    type: "rsl:update-online-status",
    requestId: 73,
    viewerUserId: "9001",
    expectedOnlineStatus: "AllUsers",
    expectedCurrentExperience: "NoOne",
    requestedOnlineStatus: "NoOne"
  });
  assert.equal(disableWithExplicitNoOne.ok, true);
  assert.equal(await hooks.readPreferredCurrentExperience("9001"), "NoOne");
  hooks.resetQuickSettingsStateForTests();
  postMode = "dynamic-coupled";
  const postsBeforeNoRestore = postBodies.length;
  const noRestore = await runtimeMessage({
    type: "rsl:update-online-status",
    requestId: 74,
    viewerUserId: "9001",
    expectedOnlineStatus: "NoOne",
    expectedCurrentExperience: "NoOne",
    requestedOnlineStatus: "AllUsers"
  });
  assert.equal(noRestore.ok, true);
  assert.equal(noRestore.experienceRestore, "unchanged");
  assert.equal(noRestore.settings.currentExperience.value, "NoOne");
  assert.deepEqual(postBodies.slice(postsBeforeNoRestore), [
    { whoCanSeeMyOnlineStatus: "AllUsers" }
  ]);

  hooks.resetQuickSettingsStateForTests();
  settings.whoCanSeeMyOnlineStatus.currentValue = "NoOne";
  settings.whoCanJoinMeInExperiences.currentValue = "NoOne";
  settings.whoCanJoinMeInExperiences.options = ["NoOne"];
  await hooks.writePreferredCurrentExperience("9001", "TrustedFriends");
  postMode = "success";
  const postsBeforeUnavailableRestore = postBodies.length;
  const unavailableRestore = await runtimeMessage({
    type: "rsl:update-online-status",
    requestId: 75,
    viewerUserId: "9001",
    expectedOnlineStatus: "NoOne",
    expectedCurrentExperience: "NoOne",
    requestedOnlineStatus: "AllUsers"
  });
  assert.equal(unavailableRestore.ok, true);
  assert.equal(unavailableRestore.experienceRestore, "unavailable");
  assert.equal(unavailableRestore.settings.onlineStatus.value, "AllUsers");
  assert.equal(unavailableRestore.settings.currentExperience.value, "NoOne");
  assert.deepEqual(postBodies.slice(postsBeforeUnavailableRestore), [
    { whoCanSeeMyOnlineStatus: "AllUsers" }
  ]);
  settings.whoCanJoinMeInExperiences.options = ["All", "Friends", "NoOne"];

  hooks.resetQuickSettingsStateForTests();
  settings.whoCanSeeMyOnlineStatus.currentValue = "NoOne";
  settings.whoCanJoinMeInExperiences.currentValue = "NoOne";
  await hooks.writePreferredCurrentExperience("9001", "Friends");
  const postsBeforeCompanionConflict = postAttempts;
  const companionConflict = await runtimeMessage({
    type: "rsl:update-online-status",
    requestId: 76,
    viewerUserId: "9001",
    expectedOnlineStatus: "NoOne",
    expectedCurrentExperience: "Friends",
    requestedOnlineStatus: "AllUsers"
  });
  assert.equal(companionConflict.ok, false);
  assert.equal(companionConflict.code, "CONFLICT");
  assert.equal(postAttempts, postsBeforeCompanionConflict);
  assert.equal(
    await hooks.readPreferredCurrentExperience("9001"),
    "Friends",
    "a preflight conflict must not consume the valid one-use restore record"
  );
  await hooks.clearPreferredCurrentExperience("9001");
  postMode = "success";

  hooks.resetQuickSettingsStateForTests();
  await hooks.clearPreferredCurrentExperience("9001");
  await hooks.clearPreferredCurrentExperience("9002");
  await hooks.writePreferredCurrentExperience("9001", "Friends");
  await hooks.writePreferredCurrentExperience("9002", "All");
  assert.equal(await hooks.readPreferredCurrentExperience("9001"), "Friends");
  assert.equal(await hooks.readPreferredCurrentExperience("9002"), "All");
  await hooks.clearPreferredCurrentExperience("9001");
  assert.equal(await hooks.readPreferredCurrentExperience("9001"), null);
  assert.equal(
    await hooks.readPreferredCurrentExperience("9002"),
    "All",
    "clearing one account must not consume another account's restore record"
  );
  const postsBeforeWrongViewerPreferenceRead = postAttempts;
  await assert.rejects(
    hooks.applyOnlineStatusUpdate(
      "9002",
      "NoOne",
      "NoOne",
      "Friends"
    ),
    (error) => error?.code === "ACCOUNT_CHANGED"
  );
  assert.equal(postAttempts, postsBeforeWrongViewerPreferenceRead);
  assert.equal(
    await hooks.readPreferredCurrentExperience("9002"),
    "All",
    "a stale tab must not consume another account's restore record"
  );

  hooks.resetQuickSettingsStateForTests();
  settings.whoCanSeeMyOnlineStatus.currentValue = "Friends";
  settings.whoCanJoinMeInExperiences.currentValue = "NoOne";
  await hooks.writePreferredCurrentExperience("9001", "Friends");
  await hooks.getQuickSettingsSnapshot();
  assert.equal(
    await hooks.readPreferredCurrentExperience("9001"),
    null,
    "a fresh visible Online Status snapshot must discard an obsolete record"
  );

  hooks.resetQuickSettingsStateForTests();
  localStorageState.rslQuickSettingsExperiencePreferencesV1 = {
    "9001": {
      value: "All",
      armedAt: Date.now() - 25 * 60 * 60_000
    }
  };
  assert.equal(
    await hooks.readPreferredCurrentExperience("9001"),
    null,
    "expired restore records must never be used"
  );
  await hooks.clearPreferredCurrentExperience("9001");

  hooks.resetQuickSettingsStateForTests();
  settings.whoCanSeeMyOnlineStatus.currentValue = "AllUsers";
  settings.whoCanJoinMeInExperiences.currentValue = "Friends";
  postMode = "auto-coupled";
  storageSetFailureCalls.add(storageSetCallCount + 2);
  const postsBeforeFailedRemember = postBodies.length;
  const failedRemember = await runtimeMessage({
    type: "rsl:update-online-status",
    requestId: 77,
    viewerUserId: "9001",
    expectedOnlineStatus: "AllUsers",
    expectedCurrentExperience: "Friends",
    requestedOnlineStatus: "NoOne"
  });
  assert.equal(failedRemember.ok, true);
  assert.equal(failedRemember.experienceRestore, "notRemembered");
  assert.equal(await hooks.readPreferredCurrentExperience("9001"), null);
  assert.deepEqual(postBodies.slice(postsBeforeFailedRemember), [
    { whoCanSeeMyOnlineStatus: "NoOne" }
  ]);

  hooks.resetQuickSettingsStateForTests();
  settings.whoCanSeeMyOnlineStatus.currentValue = "NoOne";
  settings.whoCanJoinMeInExperiences.currentValue = "NoOne";
  await hooks.writePreferredCurrentExperience("9001", "Friends");
  postMode = "dynamic-coupled";
  const postsBeforeRestorePreflightRace = postBodies.length;
  settingsReadMutationAt = settingsReads + 3;
  settingsReadMutation = () => {
    settings.whoCanSeeMyOnlineStatus.currentValue = "Friends";
  };
  const restorePreflightRace = await runtimeMessage({
    type: "rsl:update-online-status",
    requestId: 78,
    viewerUserId: "9001",
    expectedOnlineStatus: "NoOne",
    expectedCurrentExperience: "NoOne",
    requestedOnlineStatus: "AllUsers"
  });
  assert.equal(restorePreflightRace.ok, true);
  assert.equal(restorePreflightRace.experienceRestore, "failed");
  assert.equal(restorePreflightRace.settings.onlineStatus.value, "Friends");
  assert.equal(restorePreflightRace.settings.currentExperience.value, "NoOne");
  assert.deepEqual(
    postBodies.slice(postsBeforeRestorePreflightRace),
    [{ whoCanSeeMyOnlineStatus: "AllUsers" }],
    "a changed preflight companion must prevent the Experience restore POST"
  );

  hooks.resetQuickSettingsStateForTests();
  settings.whoCanSeeMyOnlineStatus.currentValue = "NoOne";
  settings.whoCanJoinMeInExperiences.currentValue = "NoOne";
  await hooks.writePreferredCurrentExperience("9001", "Friends");
  postMode = "restore-companion-race";
  const postsBeforeRestorePostconditionRace = postBodies.length;
  const restorePostconditionRace = await runtimeMessage({
    type: "rsl:update-online-status",
    requestId: 79,
    viewerUserId: "9001",
    expectedOnlineStatus: "NoOne",
    expectedCurrentExperience: "NoOne",
    requestedOnlineStatus: "AllUsers"
  });
  assert.equal(restorePostconditionRace.ok, true);
  assert.equal(restorePostconditionRace.experienceRestore, "failed");
  assert.equal(restorePostconditionRace.settings.onlineStatus.value, "NoOne");
  assert.equal(restorePostconditionRace.settings.currentExperience.value, "NoOne");
  assert.deepEqual(postBodies.slice(postsBeforeRestorePostconditionRace), [
    { whoCanSeeMyOnlineStatus: "AllUsers" },
    { whoCanJoinMeInExperiences: "Friends" },
    { whoCanJoinMeInExperiences: "NoOne" }
  ]);
  postMode = "success";

  hooks.resetQuickSettingsStateForTests();
  settings.whoCanSeeMyOnlineStatus.currentValue = "NoOne";
  settings.whoCanSeeMyOnlineStatus.options = fullOnlineStatusOptions.slice();
  settings.whoCanJoinMeInExperiences.currentValue = "NoOne";
  settings.whoCanJoinMeInExperiences.options = fullCurrentExperienceOptions.slice();
  await hooks.writePreferredCurrentExperience("9001", "Friends");
  postMode = "restore-commit-then-500";
  const postsBeforeUnconfirmedRestore = postBodies.length;
  const unconfirmedRestore = await runtimeMessage({
    type: "rsl:update-online-status",
    requestId: 90,
    viewerUserId: "9001",
    expectedOnlineStatus: "NoOne",
    expectedCurrentExperience: "NoOne",
    requestedOnlineStatus: "AllUsers"
  });
  assert.equal(unconfirmedRestore.ok, false);
  assert.equal(
    unconfirmedRestore.code,
    "UNCONFIRMED",
    "a committed restore with two failed confirmation reads must not return stale success"
  );
  assert.deepEqual(postBodies.slice(postsBeforeUnconfirmedRestore), [
    { whoCanSeeMyOnlineStatus: "AllUsers" },
    { whoCanJoinMeInExperiences: "Friends" }
  ]);
  assert.equal(
    settings.whoCanJoinMeInExperiences.currentValue,
    "Friends",
    "the fixture must commit the restore before simulating its failed confirmation"
  );
  assert.equal(restoreConfirmationFailuresRemaining, 0);
  postMode = "success";

  hooks.resetQuickSettingsStateForTests();
  settings.whoCanSeeMyOnlineStatus.currentValue = "AllUsers";
  settings.whoCanSeeMyOnlineStatus.options = fullOnlineStatusOptions.slice();
  settings.whoCanJoinMeInExperiences.currentValue = "Friends";
  settings.whoCanJoinMeInExperiences.options = fullCurrentExperienceOptions.slice();
  await hooks.writePreferredCurrentExperience("9001", "All");
  const staleCleanupStorageGate = armNextStorageGetGate();
  const staleVisibleSnapshot = hooks.getQuickSettingsSnapshot();
  await staleCleanupStorageGate.started;
  postMode = "auto-coupled";
  const disableWhileCleanupWaits = await runtimeMessage({
    type: "rsl:update-online-status",
    requestId: 91,
    viewerUserId: "9001",
    expectedOnlineStatus: "AllUsers",
    expectedCurrentExperience: "Friends",
    requestedOnlineStatus: "NoOne"
  });
  staleCleanupStorageGate.release();
  await staleVisibleSnapshot;
  assert.equal(disableWhileCleanupWaits.ok, true);
  assert.equal(
    await hooks.readPreferredCurrentExperience("9001"),
    "Friends",
    "cleanup from an old visible snapshot must not delete a newly armed record"
  );
  await hooks.clearPreferredCurrentExperience("9001");
  postMode = "success";

  hooks.resetQuickSettingsStateForTests();
  settings.whoCanSeeMyOnlineStatus.currentValue = "AllUsers";
  settings.whoCanSeeMyOnlineStatus.options = fullOnlineStatusOptions.slice();
  settings.whoCanJoinMeInExperiences.currentValue = "Friends";
  settings.whoCanJoinMeInExperiences.options = fullCurrentExperienceOptions.slice();
  await hooks.clearPreferredCurrentExperience("9001");
  postMode = "auto-coupled";
  const [firstDuplicateDisable, staleDuplicateDisable] = await Promise.all([
    runtimeMessage({
      type: "rsl:update-online-status",
      requestId: 92,
      viewerUserId: "9001",
      expectedOnlineStatus: "AllUsers",
      expectedCurrentExperience: "Friends",
      requestedOnlineStatus: "NoOne"
    }),
    runtimeMessage({
      type: "rsl:update-online-status",
      requestId: 93,
      viewerUserId: "9001",
      expectedOnlineStatus: "AllUsers",
      expectedCurrentExperience: "Friends",
      requestedOnlineStatus: "NoOne"
    })
  ]);
  assert.equal(firstDuplicateDisable.ok, true);
  assert.equal(staleDuplicateDisable.ok, false);
  assert.equal(staleDuplicateDisable.code, "CONFLICT");
  assert.equal(
    await hooks.readPreferredCurrentExperience("9001"),
    "Friends",
    "a stale duplicate disable must not consume the first request's fresh record"
  );
  const postsBeforeStaleExperienceUpdate = postAttempts;
  const staleExperienceUpdate = await runtimeMessage({
    type: "rsl:update-quick-setting",
    requestId: 94,
    viewerUserId: "9001",
    alias: "currentExperience",
    expectedValue: "Friends",
    requestedValue: "All"
  });
  assert.equal(staleExperienceUpdate.ok, false);
  assert.equal(staleExperienceUpdate.code, "CONFLICT");
  assert.equal(postAttempts, postsBeforeStaleExperienceUpdate);
  assert.equal(
    await hooks.readPreferredCurrentExperience("9001"),
    "Friends",
    "a stale direct Experience request must not consume a fresh restore record"
  );
  await hooks.clearPreferredCurrentExperience("9001");
  postMode = "success";

  hooks.resetQuickSettingsStateForTests();
  settingsPayloadOverride = {};
  await assert.rejects(
    hooks.fetchQuickSettingsValues(),
    (error) => error?.code === "INVALID_RESPONSE"
  );
  settingsPayloadOverride = null;

  hooks.resetQuickSettingsStateForTests();
  settings.whoCanSeeMyOnlineStatus.currentValue = "Friends";
  postMode = "commit-then-500";
  const recovered = await hooks.applyQuickSettingUpdate(
    "9001",
    "onlineStatus",
    "Friends",
    "NoOne"
  );
  assert.equal(recovered.settings.onlineStatus.value, "NoOne");
  postMode = "success";

  assert.equal(
    postBodies.every((body) => Object.keys(body).length === 1),
    true,
    "Quick Settings must never send a coupled multi-field privacy write"
  );

  assert.ok(authenticatedReads >= 4);
  console.log(
    "PASS Quick Settings sender, parser, CSRF, account race, reconciliation, and verification"
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
