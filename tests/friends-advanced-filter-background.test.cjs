"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const backgroundSource = fs.readFileSync(path.join(root, "background.js"), "utf8");

const operationAllowlistSource = backgroundSource.slice(
  backgroundSource.indexOf("function normalizeFriendFilterOperation("),
  backgroundSource.indexOf("async function resolveFriendFilterTargetUserId(")
);
assert.ok(
  operationAllowlistSource.includes('"resolve-game"'),
  "resolve-game must remain available to the safe Filters menu"
);
assert.doesNotMatch(
  operationAllowlistSource,
  /resolve-user|friendship-batch|count-chunk|followers-chunk|roblox-plus|subscription/i,
  "only game resolution may be exposed by the advanced Filters dispatcher; Roblox Plus reuses profile enrichment"
);
assert.match(
  backgroundSource,
  /message\?\.type === FRIEND_FILTER_MESSAGE_TYPE[\s\S]*?handleFriendFilterDataMessage/,
  "the background dispatcher must route the advanced-filter message"
);
assert.match(
  backgroundSource,
  /getTrustedRobloxFriendsTabId\(sender\)/,
  "advanced social APIs must accept messages only from the top-level Roblox Friends page"
);

const hooks = {};
let runtimeListener = null;
const requestLog = [];
let fixtureNow = 1_800_000_000_000;
let authenticatedViewerId = 42;
let fixtureFriendIds = Array.from({ length: 12 }, (_, index) => 101 + index);
let fixtureUnknownBadgeUserId = 112;
let fixturePartialProfileBatch = false;
let fixturePartialFriendshipBatch = false;

class FixtureDate extends Date {
  static now() {
    return fixtureNow;
  }
}

function fixtureFriend(userId, index) {
  const friend = {
    id: userId,
    name: `Friend_${userId}`,
    displayName: `Friend ${userId}`
  };
  if (userId !== fixtureUnknownBadgeUserId) {
    friend.hasVerifiedBadge = index % 2 === 0;
  }
  return friend;
}

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}

async function fixtureFetch(input, options = {}) {
  const url = new URL(String(input));
  requestLog.push({ url: url.href, options });

  if (url.href === "https://users.roblox.com/v1/users/authenticated") {
    return json({
      id: authenticatedViewerId,
      name: `Viewer_${authenticatedViewerId}`,
      displayName: `Viewer ${authenticatedViewerId}`
    });
  }
  if (url.href === "https://users.roblox.com/v1/usernames/users") {
    const body = JSON.parse(options.body || "{}");
    assert.deepEqual(body.usernames, ["Target_User"]);
    return json({
      data: [
        {
          id: 99,
          name: "Target_User",
          displayName: "Target",
          hasVerifiedBadge: true
        }
      ]
    });
  }
  if (url.href === "https://users.roblox.com/v1/users/99") {
    return json({
      id: 99,
      name: "Target_User",
      displayName: "Target",
      hasVerifiedBadge: true
    });
  }
  if (url.href === "https://users.roblox.com/v1/users/97") {
    return json({ id: 97, name: "Unknown_Verification", displayName: "Unknown Verification" });
  }
  if (url.href === "https://apis.roblox.com/universes/v1/places/606/universe") {
    return json({ universeId: 777 });
  }
  if (url.href === "https://apis.roblox.com/universes/v1/places/777/universe") {
    return json({ errors: [{ code: 1 }] }, 404);
  }
  if (
    url.origin === "https://apis.roblox.com" &&
    url.pathname === "/search-api/omni-search"
  ) {
    const searchQuery = url.searchParams.get("searchQuery");
    if (searchQuery === "Duplicate Experience") {
      return json({
        searchResults: [{
          contentGroupType: "Game",
          contents: [
            { universeId: 901, rootPlaceId: 611, name: "Duplicate Experience" },
            { universeId: 902, rootPlaceId: 612, name: " duplicate   experience " }
          ]
        }],
        nextPageToken: ""
      });
    }
    if (searchQuery === "No Exact Experience") {
      return json({
        searchResults: [
          {
            contentGroupType: "User",
            contents: [
              { universeId: 903, rootPlaceId: 613, name: "No Exact Experience" }
            ]
          },
          {
            contentGroupType: "Game",
            contents: [
              { universeId: 904, rootPlaceId: 614, name: "No Exact Experience Tycoon" }
            ]
          }
        ],
        nextPageToken: ""
      });
    }
    if (searchQuery === "No Game Results") {
      return json({
        searchResults: [{
          contentGroupType: "User",
          contents: [
            { universeId: 905, rootPlaceId: 615, name: "No Game Results" }
          ]
        }],
        nextPageToken: ""
      });
    }
    assert.equal(searchQuery, "Fixture Experience");
    return json({
      searchResults: [
        {
          contentGroupType: "User",
          contents: [
            { universeId: 666, rootPlaceId: 605, name: "Fixture Experience" }
          ]
        },
        {
          contentGroupType: "Game",
          contents: [
            {
              universeId: 888,
              rootPlaceId: 608,
              name: "Fixture Experience Tycoon"
            },
            {
              universeId: 777,
              rootPlaceId: 606,
              name: "  Fixture   Experience  "
            }
          ]
        }
      ],
      nextPageToken: ""
    });
  }
  if (url.origin === "https://games.roblox.com" && url.pathname === "/v1/games") {
    const universeId = url.searchParams.get("universeIds");
    if (universeId === "777") {
      return json({ data: [{ id: 777, rootPlaceId: 606, name: "Fixture Experience" }] });
    }
    if (universeId === "888") {
      return json({
        data: [{ id: 888, rootPlaceId: 608, name: "Fixture Experience Tycoon" }]
      });
    }
    if (universeId === "901") {
      return json({ data: [{ id: 901, rootPlaceId: 611, name: "Duplicate Experience" }] });
    }
    if (universeId === "904") {
      return json({
        data: [{ id: 904, rootPlaceId: 614, name: "No Exact Experience Tycoon" }]
      });
    }
    return json({ data: [] });
  }
  if (
    url.origin === "https://friends.roblox.com" &&
    url.pathname === `/v1/users/${authenticatedViewerId}/friends/find`
  ) {
    return json({
      PageItems: fixtureFriendIds.map(fixtureFriend),
      NextCursor: null
    });
  }
  if (
    url.origin === "https://friends.roblox.com" &&
    url.pathname === `/v1/users/${authenticatedViewerId}/friends`
  ) {
    return json({ data: fixtureFriendIds.map(fixtureFriend) });
  }
  if (
    url.origin === "https://friends.roblox.com" &&
    /^\/v1\/users\/[1-9]\d*\/friends\/statuses$/.test(url.pathname)
  ) {
    const requestedIds = (url.searchParams.get("userIds") || "")
      .split(",")
      .filter(Boolean);
    const returnedIds = fixturePartialFriendshipBatch
      ? requestedIds.slice(0, -1)
      : requestedIds;
    return json({
      data: returnedIds.map((userId, index) => ({
        id: Number(userId),
        status: index === 0 ? "Friends" : "NotFriends"
      }))
    });
  }
  const countMatch = url.pathname.match(
    /^\/v1\/users\/([1-9]\d*)\/(followers|friends|followings)\/count$/
  );
  if (url.origin === "https://friends.roblox.com" && countMatch) {
    const [, userId, metric] = countMatch;
    if (metric === "followers" && userId === "999") {
      return json({ count: 5_001 });
    }
    if (metric === "followers" && userId === "98") {
      return json({ count: 2 });
    }
    return json({ count: Number(userId) });
  }
  if (
    url.origin === "https://friends.roblox.com" &&
    url.pathname === "/v1/users/98/followers"
  ) {
    return json({ data: [{ id: fixtureFriendIds[0] }, { id: 8_888 }], nextPageCursor: null });
  }
  if (url.href === "https://presence.roblox.com/v1/presence/users") {
    const body = JSON.parse(options.body || "{}");
    return json({
      userPresences: (body.userIds || []).map((userId) => ({
        userId,
        userPresenceType: 1,
        lastLocation: "Website"
      }))
    });
  }
  if (
    url.href ===
    "https://apis.roblox.com/user-profile-api/v1/user/profiles/get-profiles"
  ) {
    const body = JSON.parse(options.body || "{}");
    const returnedUserIds = fixturePartialProfileBatch
      ? (body.userIds || []).slice(0, 1)
      : body.userIds || [];
    return json({
      profileDetails: returnedUserIds.map((userId, index) => ({
        userId,
        names: { username: `Friend_${userId}`, combinedName: `Friend ${userId}` },
        isVerified: index % 2 === 0,
        hasRobloxSubscription: index % 2 === 0,
        isDeleted: false
      }))
    });
  }
  if (
    url.origin === "https://thumbnails.roblox.com" &&
    url.pathname === "/v1/users/avatar-headshot"
  ) {
    const userIds = (url.searchParams.get("userIds") || "")
      .split(",")
      .filter(Boolean);
    return json({
      data: userIds.map((userId) => ({
        targetId: Number(userId),
        state: "Completed",
        imageUrl: `https://tr.rbxcdn.com/fixture-${userId}/150/150/AvatarHeadshot/Webp/noFilter`
      }))
    });
  }
  throw new Error(`Unexpected fixture fetch: ${url.href}`);
}

function makeStorageArea() {
  const values = Object.create(null);
  return {
    get(defaults, callback) {
      const result =
        defaults && typeof defaults === "object" && !Array.isArray(defaults)
          ? { ...defaults, ...values }
          : { ...values };
      callback?.(result);
      return Promise.resolve(result);
    },
    set(next, callback) {
      Object.assign(values, next);
      callback?.();
      return Promise.resolve();
    },
    remove(keys, callback) {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key];
      callback?.();
      return Promise.resolve();
    }
  };
}

const chrome = {
  runtime: {
    id: "fixture-extension",
    lastError: null,
    onInstalled: { addListener() {} },
    onMessage: {
      addListener(listener) {
        runtimeListener = listener;
      }
    }
  },
  storage: {
    local: makeStorageArea(),
    session: makeStorageArea(),
    onChanged: { addListener() {} }
  },
  contextMenus: {
    create() {},
    removeAll(callback) {
      callback?.();
    },
    onClicked: { addListener() {} }
  },
  tabs: { sendMessage() {} }
};

const sandbox = {
  Date: FixtureDate,
  URL,
  URLSearchParams,
  AbortController,
  TextDecoder,
  Response,
  Headers,
  Request,
  structuredClone,
  crypto,
  console,
  chrome,
  fetch: fixtureFetch,
  setTimeout(callback, delay, ...args) {
    return setTimeout(callback, Math.min(Math.max(Number(delay) || 0, 0), 1), ...args);
  },
  clearTimeout,
  globalThis: null,
  __rslBackgroundTestHooks: hooks
};
sandbox.globalThis = sandbox;
vm.runInNewContext(backgroundSource, sandbox, { filename: "background.js" });

assert.equal(typeof runtimeListener, "function");
assert.equal(hooks.getFriendFilterErrorCode({ status: 403 }), "PRIVACY_OR_REGION");
assert.equal(hooks.getFriendFilterErrorCode({ status: 429 }), "RATE_LIMITED");

const normalizedVerificationFixture = hooks.normalizeFriendListItems([
  {
    id: 501,
    name: "KnownVerified",
    displayName: "Known Verified",
    hasVerifiedBadge: true,
    hasRobloxSubscription: true
  },
  {
    id: 502,
    name: "KnownUnverified",
    displayName: "Known Unverified",
    hasVerifiedBadge: false,
    hasRobloxSubscription: false
  },
  { id: 503, name: "UnknownBadge", displayName: "Unknown Badge" }
]);
assert.equal(normalizedVerificationFixture.profilesByUserId.get("501")?.isVerified, true);
assert.equal(
  normalizedVerificationFixture.profilesByUserId.get("501")?.isVerifiedKnown,
  true
);
assert.equal(normalizedVerificationFixture.profilesByUserId.get("502")?.isVerified, false);
assert.equal(
  normalizedVerificationFixture.profilesByUserId.get("502")?.isVerifiedKnown,
  true,
  "an explicit false badge value is complete data"
);
assert.equal(
  normalizedVerificationFixture.profilesByUserId.get("503")?.isVerifiedKnown,
  false,
  "an omitted Roblox badge field must stay unknown rather than becoming false"
);
assert.equal(
  normalizedVerificationFixture.profilesByUserId.get("501")?.hasRobloxSubscription,
  true
);
assert.equal(
  normalizedVerificationFixture.profilesByUserId.get("501")?.isRobloxPlusKnown,
  true
);
assert.equal(
  normalizedVerificationFixture.profilesByUserId.get("502")?.hasRobloxSubscription,
  false
);
assert.equal(
  normalizedVerificationFixture.profilesByUserId.get("502")?.isRobloxPlusKnown,
  true,
  "an explicit false Roblox Plus value is complete data"
);
assert.equal(
  normalizedVerificationFixture.profilesByUserId.get("503")?.isRobloxPlusKnown,
  false,
  "an omitted Roblox Plus field must stay unknown rather than becoming false"
);

const mergedRobloxPlusFixture = hooks.mergeFriendListResults([
  hooks.normalizeFriendListItems([
    {
      id: 504,
      name: "KnownPlus",
      displayName: "Known Plus",
      hasRobloxSubscription: true
    }
  ]),
  hooks.normalizeFriendListItems([
    { id: 504, name: "KnownPlus", displayName: "Known Plus" }
  ]),
  hooks.normalizeFriendListItems([
    {
      id: 504,
      name: "KnownPlus",
      displayName: "Known Plus",
      hasRobloxSubscription: false
    }
  ])
]);
assert.equal(
  mergedRobloxPlusFixture.profilesByUserId.get("504")?.hasRobloxSubscription,
  true,
  "unknown or conflicting list results must not overwrite a positive Roblox Plus value"
);
assert.equal(
  mergedRobloxPlusFixture.profilesByUserId.get("504")?.isRobloxPlusKnown,
  true
);

const reusedRobloxPlusFixture = hooks.reuseOnlineFriendDetails(
  {
    userId: "505",
    username: "User 505",
    displayName: "User 505",
    isVerified: false,
    isVerifiedKnown: false,
    isRobloxPlus: false,
    isRobloxPlusKnown: false,
    universeId: null,
    headshotUrl: null
  },
  {
    userId: "505",
    username: "PlusUser",
    displayName: "Plus User",
    isVerified: false,
    isVerifiedKnown: true,
    isRobloxPlus: true,
    isRobloxPlusKnown: true,
    universeId: null,
    headshotUrl: null
  }
);
assert.equal(reusedRobloxPlusFixture.isRobloxPlus, true);
assert.equal(reusedRobloxPlusFixture.isRobloxPlusKnown, true);

const refreshedRobloxPlusFixture = hooks.reuseOnlineFriendDetails(
  {
    ...reusedRobloxPlusFixture,
    isRobloxPlus: false,
    isRobloxPlusKnown: true
  },
  reusedRobloxPlusFixture
);
assert.equal(
  refreshedRobloxPlusFixture.isRobloxPlus,
  false,
  "fresh known profile data must be able to clear a previously cached Plus value"
);
assert.equal(refreshedRobloxPlusFixture.isRobloxPlusKnown, true);

for (const functionName of [
  "startOnlineFriendsEnrichment",
  "makeOfflineFriendsResponse",
  "getBestFriendsContext",
  "fetchAllOnlineFriends"
]) {
  const start = backgroundSource.indexOf(`function ${functionName}(`);
  const asyncStart = backgroundSource.indexOf(`async function ${functionName}(`);
  const functionStart = Math.max(start, asyncStart);
  assert.ok(functionStart >= 0, `${functionName} must exist`);
  const nextFunction = backgroundSource.indexOf("\nfunction ", functionStart + 10);
  const nextAsyncFunction = backgroundSource.indexOf(
    "\nasync function ",
    functionStart + 10
  );
  const candidates = [nextFunction, nextAsyncFunction].filter(
    (index) => index > functionStart
  );
  const functionEnd = candidates.length ? Math.min(...candidates) : backgroundSource.length;
  assert.match(
    backgroundSource.slice(functionStart, functionEnd),
    /verificationComplete/,
    `${functionName} responses must describe verified-badge completeness explicitly`
  );
  assert.match(
    backgroundSource.slice(functionStart, functionEnd),
    /robloxPlusComplete/,
    `${functionName} responses must describe Roblox Plus completeness explicitly`
  );
}

const trustedSender = {
  id: chrome.runtime.id,
  frameId: 0,
  tab: { id: 7, url: "https://www.roblox.com/users/friends#!/friends" },
  url: "https://www.roblox.com/users/friends#!/friends"
};
assert.equal(hooks.getTrustedRobloxFriendsTabId(trustedSender), 7);
for (const sender of [
  { ...trustedSender, frameId: 1 },
  { ...trustedSender, tab: { id: 7, url: "https://www.roblox.com/home" } },
  { ...trustedSender, url: "https://evil.example/users/friends" }
]) {
  assert.equal(hooks.getTrustedRobloxFriendsTabId(sender), null);
}

function send(message, sender = trustedSender) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("fixture response timed out")), 2_000);
    let handlerReturned = false;
    let keepChannel = false;
    let responseReceived = false;
    let responseValue = null;
    const finish = () => {
      clearTimeout(timeout);
      resolve({ keepChannel, response: responseValue });
    };
    keepChannel = hooks.handleFriendFilterDataMessage(
      message,
      sender,
      (response) => {
        responseReceived = true;
        responseValue = response;
        if (handlerReturned) finish();
      }
    );
    handlerReturned = true;
    if (responseReceived || !keepChannel) finish();
  });
}

(async () => {
  const rejectedResponses = [];
  const rejected = hooks.handleFriendFilterDataMessage(
    {
      type: "rsl:get-friend-filter-data",
      op: "resolve-game",
      requestId: 1,
      input: "606"
    },
    { ...trustedSender, frameId: 2 },
    (response) => rejectedResponses.push(response)
  );
  assert.equal(rejected, false);
  assert.equal(rejectedResponses[0]?.code, "INVALID");

  const gameByPlace = await send({
    type: "rsl:get-friend-filter-data",
    operation: "resolve-game",
    requestId: 12,
    input: "https://www.roblox.com/games/606/Fixture-Experience"
  });
  assert.equal(gameByPlace.response.ok, true);
  assert.equal(gameByPlace.response.target.universeId, "777");
  assert.equal(gameByPlace.response.target.rootPlaceId, "606");
  assert.deepEqual(gameByPlace.response.game, gameByPlace.response.target);

  const gameByUniverse = await send({
    type: "rsl:get-friend-filter-data",
    op: "resolve-game",
    requestId: 13,
    input: "777"
  });
  assert.equal(
    gameByUniverse.response.target?.universeId,
    "777",
    "a numeric Universe ID promised by the input placeholder must resolve after a place lookup misses"
  );

  const nameSearchLogStart = requestLog.length;
  const gameByName = await send({
    type: "rsl:get-friend-filter-data",
    op: "resolve-game",
    requestId: 14,
    input: "Fixture Experience"
  });
  assert.equal(gameByName.keepChannel, true);
  assert.equal(gameByName.response.ok, true);
  assert.deepEqual(
    {
      universeId: gameByName.response.target?.universeId,
      rootPlaceId: gameByName.response.target?.rootPlaceId,
      name: gameByName.response.target?.name
    },
    {
      universeId: "777",
      rootPlaceId: "606",
      name: "Fixture Experience"
    },
    "a plain game name must safely select the exact experience match and return stable IDs"
  );
  const nameSearchRequests = requestLog.slice(nameSearchLogStart).filter(({ url }) => {
    const endpoint = new URL(url);
    return (
      endpoint.origin === "https://apis.roblox.com" &&
      endpoint.pathname === "/search-api/omni-search"
    );
  });
  assert.equal(nameSearchRequests.length, 1, "name resolution must use one bounded Roblox search");
  assert.equal(nameSearchRequests[0].options.credentials, "omit");
  assert.equal(nameSearchRequests[0].options.cache, "no-store");

  const duplicateName = await send({
    type: "rsl:get-friend-filter-data",
    op: "resolve-game",
    requestId: 15,
    input: "Duplicate Experience"
  });
  assert.equal(duplicateName.response.ok, true);
  assert.equal(
    duplicateName.response.target?.universeId,
    "901",
    "duplicate exact names must preserve Roblox's ranked result order"
  );

  const fuzzyOnlyName = await send({
    type: "rsl:get-friend-filter-data",
    op: "resolve-game",
    requestId: 16,
    input: "No Exact Experience"
  });
  assert.equal(fuzzyOnlyName.response.ok, true);
  assert.equal(
    fuzzyOnlyName.response.target?.universeId,
    "904",
    "without an exact match, the first Roblox-ranked Game result must remain usable"
  );

  const noGameCandidates = await send({
    type: "rsl:get-friend-filter-data",
    op: "resolve-game",
    requestId: 17,
    input: "No Game Results"
  });
  assert.equal(noGameCandidates.response.ok, false);
  assert.equal(
    noGameCandidates.response.code,
    "NOT_FOUND",
    "non-Game search groups alone must never be selected as an experience"
  );

  fixturePartialProfileBatch = true;
  const partialProfiles = await hooks.fetchUserProfiles(["701", "702"]);
  fixturePartialProfileBatch = false;
  assert.equal(partialProfiles.get("701")?.isVerifiedKnown, true);
  assert.equal(partialProfiles.get("701")?.isRobloxPlusKnown, true);
  assert.equal(partialProfiles.get("701")?.hasRobloxSubscription, true);
  assert.equal(partialProfiles.has("702"), false);
  assert.equal(
    partialProfiles.verificationComplete,
    false,
    "a successful profile batch that omits a requested user is still incomplete"
  );
  assert.equal(
    partialProfiles.robloxPlusComplete,
    false,
    "a successful profile batch that omits a requested user is incomplete for Roblox Plus too"
  );

  const profileEnrichmentLogStart = requestLog.length;
  const initialAggregate = await hooks.getAllOnlineFriends(true);
  assert.equal(initialAggregate.viewerUserId, "42");
  assert.equal(initialAggregate.verificationComplete, false);
  assert.equal(initialAggregate.robloxPlusComplete, false);
  assert.equal(initialAggregate.offlineVerificationComplete, true);
  assert.equal(initialAggregate.offlineRobloxPlusComplete, true);
  assert.equal(
    initialAggregate.friends.find(({ userId }) => userId === "112")?.isVerifiedKnown,
    false
  );
  const enrichedAggregate = await hooks.getOnlineFriendsDetails("42");
  assert.equal(enrichedAggregate.verificationComplete, true);
  assert.equal(enrichedAggregate.robloxPlusComplete, true);
  assert.ok(
    enrichedAggregate.friends.every(({ isVerifiedKnown }) => isVerifiedKnown === true)
  );
  assert.ok(
    enrichedAggregate.friends.every(
      ({ isRobloxPlusKnown }) => isRobloxPlusKnown === true
    )
  );
  assert.ok(
    enrichedAggregate.friends.some(({ isRobloxPlus }) => isRobloxPlus === true),
    "the shared profile response must preserve positive Roblox Plus subscriptions"
  );
  const profileEnrichmentRequests = requestLog
    .slice(profileEnrichmentLogStart)
    .filter(
      ({ url }) =>
        url ===
        "https://apis.roblox.com/user-profile-api/v1/user/profiles/get-profiles"
    );
  assert.equal(
    profileEnrichmentRequests.length,
    1,
    "Verified and Roblox Plus must share one existing profile-enrichment request batch"
  );
  const profileFields = JSON.parse(
    profileEnrichmentRequests[0].options.body || "{}"
  ).fields;
  assert.ok(profileFields.includes("isVerified"));
  assert.ok(profileFields.includes("hasRobloxSubscription"));
  const offlineAggregate = await hooks.getOfflineFriendsDetails("42");
  assert.equal(offlineAggregate.verificationComplete, true);
  assert.equal(offlineAggregate.robloxPlusComplete, true);
  assert.deepEqual(Array.from(offlineAggregate.friends), []);

  const unsafeRequestCount = requestLog.length;
  for (const [requestId, operation] of [
    [20, "resolve-user"],
    [21, "friendship-batch"],
    [22, "count-chunk"],
    [23, "followers-chunk"],
    [24, "roblox-plus"]
  ]) {
    const rejectedUnsafeOperation = await send({
      type: "rsl:get-friend-filter-data",
      op: operation,
      requestId,
      viewerUserId: "42",
      targetUserId: "99",
      metric: "followers",
      nextIndex: 0
    });
    assert.equal(rejectedUnsafeOperation.keepChannel, false);
    assert.equal(rejectedUnsafeOperation.response?.ok, false);
    assert.equal(rejectedUnsafeOperation.response?.code, "INVALID");
    assert.equal(rejectedUnsafeOperation.response?.operation, "");
  }
  assert.equal(
    requestLog.length,
    unsafeRequestCount,
    "rejected social scans and separate Roblox Plus operations must not start any Roblox request"
  );

  assert.equal(
    requestLog.some(({ url }) => url === "https://users.roblox.com/v1/usernames/users"),
    false,
    "removed user/friendship filters must never start username resolution"
  );
  console.log("PASS safe advanced Friends filter background game-only allowlist contract");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
