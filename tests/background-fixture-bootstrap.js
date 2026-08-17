"use strict";

globalThis.__rslBackgroundTestHooks = {};

const originalFetch = globalThis.fetch;
const requestStats = {
  authenticated: 0,
  friendListRequests: 0,
  friendListCredentials: "",
  friendListCache: "",
  friendListAccept: "",
  friendPages: 0,
  friendFindHadUserSort: false,
  presenceBatches: 0,
  activePresenceBatches: 0,
  maxConcurrentPresenceBatches: 0,
  largestPresenceBatch: 0,
  profiles: 0,
  chatMetadata: 0,
  chatMetadataCredentials: "",
  chatMetadataCache: "",
  chatMetadataAccept: "",
  thumbnails: 0,
  gameUniverseThumbnails: 0,
  lastThumbnailFormat: "",
  universeLookups: 0,
  assetDetails: 0,
  assetContents: 0,
  assetCdnContents: 0,
  randomServerRequests: 0,
  randomServerLastUrl: "",
  randomServerMethod: "",
  randomServerCredentials: "",
  randomServerCache: "",
  randomServerAccept: "",
  randomServerHadSignal: false,
  privateServerSupportRequests: 0,
  privateServerSupportLastUrl: "",
  privateServerSupportMethod: "",
  privateServerSupportCredentials: "",
  privateServerSupportCache: "",
  privateServerSupportAccept: "",
  privateServerListRequests: 0,
  privateServerListUrls: [],
  privateServerListMethod: "",
  privateServerListCredentials: "",
  privateServerListCache: "",
  privateServerListAccept: "",
  privateServerListHadSignal: false,
  privateServerJoinInjections: 0,
  privateServerJoinTargetTabId: null,
  privateServerJoinFrameIds: "",
  privateServerJoinWorld: "",
  privateServerJoinArgsLength: 0,
  privateServerJoinPlaceIdArg: null,
  privateServerJoinAccessCodeMatched: false,
  privateServerJoinNativeCalls: 0,
  privateServerJoinNativePlaceId: null,
  privateServerJoinNativeAccessCodeMatched: false,
  privateServerJoinNativeLinkCode: null
};

let chatMetadataMode = "enabled";
let randomServerMode = "mixed";
let friendListMode = "success";
let friendPageMode = "ids";
let privateServerSupportMode = "available";
let privateServerListMode = "mixed";
let authenticatedViewerId = 9001;
let privateServerJoinMode = "started";
const PRIVATE_SERVER_JOIN_FIXTURE_ACCESS_CODE =
  "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

chrome.scripting = {
  async executeScript(details) {
    requestStats.privateServerJoinInjections += 1;
    requestStats.privateServerJoinTargetTabId = details?.target?.tabId ?? null;
    requestStats.privateServerJoinFrameIds = JSON.stringify(
      details?.target?.frameIds ?? null
    );
    requestStats.privateServerJoinWorld = details?.world || "";
    requestStats.privateServerJoinArgsLength = Array.isArray(details?.args)
      ? details.args.length
      : 0;
    requestStats.privateServerJoinPlaceIdArg = details?.args?.[0] ?? null;
    requestStats.privateServerJoinAccessCodeMatched =
      details?.args?.[1] === PRIVATE_SERVER_JOIN_FIXTURE_ACCESS_CODE;

    if (privateServerJoinMode === "injection-failed") {
      throw new Error("Fixture injection failed");
    }
    if (privateServerJoinMode === "unknown-result") {
      return [{ frameId: 0, result: "unexpected" }];
    }

    const previousRoblox = globalThis.Roblox;
    try {
      globalThis.Roblox =
        privateServerJoinMode === "unavailable"
          ? {}
          : {
              GameLauncher: {
                joinPrivateGame(placeId, accessCode, linkCode) {
                  requestStats.privateServerJoinNativeCalls += 1;
                  requestStats.privateServerJoinNativePlaceId = placeId;
                  requestStats.privateServerJoinNativeAccessCodeMatched =
                    accessCode === PRIVATE_SERVER_JOIN_FIXTURE_ACCESS_CODE;
                  requestStats.privateServerJoinNativeLinkCode = linkCode;
                  if (privateServerJoinMode === "native-failed") {
                    throw new Error("Fixture native launch failed");
                  }
                  if (privateServerJoinMode === "async-failed") {
                    return Promise.reject(new Error("Fixture async launch failed"));
                  }
                  return undefined;
                }
              }
            };
      const result = await details.func(...details.args);
      return [{ frameId: 0, result }];
    } finally {
      if (previousRoblox === undefined) {
        delete globalThis.Roblox;
      } else {
        globalThis.Roblox = previousRoblox;
      }
    }
  }
};

function jsonResponse(value, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders }
  });
}

function friendPage(start, end, nextCursor) {
  return {
    PreviousCursor: null,
    PageItems: Array.from({ length: end - start + 1 }, (_, index) => {
      const userId = start + index;
      return friendPageMode === "names"
        ? {
            id: userId,
            name: userId === 103 ? "LeoHund1306" : `PageUser${userId}`,
            displayName: userId === 103 ? "K11" : `Page Friend ${userId}`,
            hasVerifiedBadge: userId === 51
          }
        : { id: userId };
    }),
    NextCursor: nextCursor,
    HasMore: null
  };
}

globalThis.fetch = async (input, options = {}) => {
  const url = new URL(String(input));

  if (
    url.hostname === "apis.roblox.com" &&
    url.pathname === "/private-servers-api/Universe-Private-Server-Settings"
  ) {
    requestStats.privateServerSupportRequests += 1;
    requestStats.privateServerSupportLastUrl = url.href;
    requestStats.privateServerSupportMethod = options.method || "";
    requestStats.privateServerSupportCredentials = options.credentials || "";
    requestStats.privateServerSupportCache = options.cache || "";
    requestStats.privateServerSupportAccept = options.headers?.Accept || "";
    await new Promise((resolve) => setTimeout(resolve, 15));
    if (privateServerSupportMode === "unauthenticated") {
      return jsonResponse({ errors: [{ code: 401 }] }, 401);
    }
    if (privateServerSupportMode === "unavailable") {
      return jsonResponse({
        privateServerData: {
          isAvailable: false,
          privateServerProductId: 0,
          privateServerLimit: 0,
          price: 0
        }
      });
    }
    if (privateServerSupportMode === "creation-limited") {
      return jsonResponse({
        privateServerData: {
          isAvailable: false,
          privateServerProductId: 7654321,
          privateServerLimit: 1,
          price: 200
        }
      });
    }
    if (privateServerSupportMode === "malformed") {
      return jsonResponse({ privateServerData: { isAvailable: true } });
    }
    return jsonResponse({
      privateServerData: {
        isAvailable: true,
        privateServerProductId: 7654321,
        privateServerLimit: 10,
        price: 200
      }
    });
  }

  if (
    url.hostname === "games.roblox.com" &&
    /^\/v1\/games\/[1-9]\d{0,15}\/private-servers$/.test(url.pathname)
  ) {
    requestStats.privateServerListRequests += 1;
    requestStats.privateServerListUrls.push(url.href);
    requestStats.privateServerListMethod = options.method || "";
    requestStats.privateServerListCredentials = options.credentials || "";
    requestStats.privateServerListCache = options.cache || "";
    requestStats.privateServerListAccept = options.headers?.Accept || "";
    requestStats.privateServerListHadSignal =
      Boolean(options.signal) && typeof options.signal.aborted === "boolean";

    if (privateServerListMode === "network") {
      throw new TypeError("Fixture network failure");
    }
    if (privateServerListMode === "unauthenticated") {
      return jsonResponse({ errors: [{ code: 401 }] }, 401);
    }
    if (privateServerListMode === "forbidden") {
      return jsonResponse({ errors: [{ code: 403 }] }, 403);
    }
    if (privateServerListMode === "rate-limited") {
      return jsonResponse({ errors: [{ code: 429 }] }, 429);
    }
    if (privateServerListMode === "unavailable") {
      return jsonResponse({ errors: [{ code: 503 }] }, 503);
    }
    if (privateServerListMode === "malformed") {
      return jsonResponse({ data: "not-an-array", nextPageCursor: null });
    }
    if (privateServerListMode === "empty") {
      return jsonResponse({
        data: [],
        nextPageCursor: null,
        gameJoinRestricted: false
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
    if (url.searchParams.get("cursor") === "page+two/==") {
      return jsonResponse({
        data: [
          {
            vipServerId: 557,
            accessCode: "eeeeeeee-ffff-4444-8888-999999999999",
            name: "Second Fixture Server",
            playing: 3,
            maxPlayers: 12,
            owner: {
              id: 44,
              name: "SecondOwner",
              displayName: "Second Owner"
            }
          }
        ],
        nextPageCursor: null,
        gameJoinRestricted: false
      });
    }

    return jsonResponse({
      data: [
        {
          id: "11111111-2222-3333-4444-555555555555",
          vipServerId: 555,
          accessCode: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
          name: "Fixture Private Server",
          playing: 2,
          maxPlayers: 10,
          owner: { id: 42, name: "FixtureOwner", displayName: "Fixture Owner" },
          playerTokens: ["DO_NOT_EXPOSE"],
          players: [{ id: 99, name: "DO_NOT_EXPOSE" }],
          ping: 25,
          fps: 60
        },
        {
          vipServerId: null,
          accessCode: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff",
          name: null,
          playing: 1,
          maxPlayers: 6,
          owner: null
        },
        {
          vipServerId: 556,
          accessCode: "cccccccc-dddd-4eee-8fff-000000000000",
          name: "Restricted empty server",
          playing: 0,
          maxPlayers: 10
        },
        {
          vipServerId: 558,
          accessCode: "dddddddd-eeee-4fff-8aaa-111111111111",
          name: "Full server",
          playing: 10,
          maxPlayers: 10
        },
        {
          vipServerId: 559,
          accessCode: "not-a-uuid",
          name: "Bad access code",
          playing: 1,
          maxPlayers: 10
        },
        {
          vipServerId: 560,
          accessCode: "ffffffff-aaaa-4bbb-8ccc-222222222222",
          name: "x".repeat(101),
          playing: 1,
          maxPlayers: 10
        },
        {
          vipServerId: 561,
          accessCode: "99999999-aaaa-4bbb-8ccc-333333333333",
          name: "Bad count",
          playing: "1",
          maxPlayers: 10
        },
        {
          vipServerId: 555,
          accessCode: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
          name: "Duplicate",
          playing: 2,
          maxPlayers: 10
        }
      ],
      nextPageCursor: "page+two/==",
      gameJoinRestricted: true,
      privateServerLinkCode: "DO_NOT_EXPOSE"
    });
  }

  if (
    url.hostname === "games.roblox.com" &&
    /^\/v1\/games\/[1-9]\d{0,15}\/servers\/Public$/.test(url.pathname)
  ) {
    requestStats.randomServerRequests += 1;
    requestStats.randomServerLastUrl = url.href;
    requestStats.randomServerMethod = options.method || "";
    requestStats.randomServerCredentials = options.credentials || "";
    requestStats.randomServerCache = options.cache || "";
    requestStats.randomServerAccept = options.headers?.Accept || "";
    requestStats.randomServerHadSignal =
      Boolean(options.signal) && typeof options.signal.aborted === "boolean";

    if (randomServerMode === "rate-limited") {
      return jsonResponse(
        { errors: [{ code: 429, message: "Slow down" }] },
        429,
        { "Retry-After": "2" }
      );
    }
    if (randomServerMode === "malformed-payload") {
      return jsonResponse({ data: "not-an-array" });
    }
    if (randomServerMode === "empty") {
      return jsonResponse({ data: [] });
    }

    await new Promise((resolve) => setTimeout(resolve, 15));
    return jsonResponse({
      data: [
        {
          id: "11111111-2222-3333-4444-555555555555",
          playing: 4,
          maxPlayers: 12
        },
        {
          id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          playing: 10,
          maxPlayers: 10
        },
        {
          id: "not-a-uuid",
          playing: 1,
          maxPlayers: 10
        },
        {
          id: "99999999-8888-7777-6666-555555555555",
          playing: "1",
          maxPlayers: 10
        },
        {
          id: "12345678-90ab-cdef-1234-567890abcdef",
          playing: 0,
          maxPlayers: 30
        },
        {
          id: "12345678-90ab-cdef-1234-567890abcdef",
          playing: 1,
          maxPlayers: 30
        }
      ]
    });
  }

  if (url.hostname === "users.roblox.com" && url.pathname === "/v1/users/authenticated") {
    requestStats.authenticated += 1;
    return jsonResponse({
      id: authenticatedViewerId,
      name: "FixtureViewer",
      displayName: "Fixture Viewer"
    });
  }

  if (
    url.hostname === "friends.roblox.com" &&
    /^\/v1\/users\/[1-9]\d*\/friends$/.test(url.pathname)
  ) {
    requestStats.friendListRequests += 1;
    requestStats.friendListCredentials = options.credentials || "";
    requestStats.friendListCache = options.cache || "";
    requestStats.friendListAccept = options.headers?.Accept || "";
    await new Promise((resolve) => setTimeout(resolve, 25));
    if (friendListMode === "malformed") {
      return jsonResponse({ data: "not-an-array" });
    }
    if (friendListMode === "error") {
      return jsonResponse({ errors: [{ code: 404, message: "Unavailable" }] }, 404);
    }
    const friendCount = friendListMode === "truncated" ? 102 : 103;
    return jsonResponse({
      data: [
        ...Array.from({ length: friendCount }, (_, index) => ({
          id: index + 1,
          name: `ListUser${index + 1}`,
          displayName: `List Friend ${index + 1}`,
          hasVerifiedBadge: index + 1 === 73
        })),
        { id: 2 },
        { id: "0002" },
        { id: 0 },
        { id: "invalid" }
      ]
    });
  }

  if (
    url.hostname === "apis.roblox.com" &&
    url.pathname === "/platform-chat-api/v1/metadata"
  ) {
    requestStats.chatMetadata += 1;
    requestStats.chatMetadataCredentials = options.credentials || "";
    requestStats.chatMetadataCache = options.cache || "";
    requestStats.chatMetadataAccept = options.headers?.Accept || "";
    if (chatMetadataMode === "error") {
      return jsonResponse({ errors: [{ code: 500, message: "Fixture failure" }] }, 500);
    }
    if (chatMetadataMode === "malformed") {
      return new Response("{", {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (chatMetadataMode === "missing") {
      return jsonResponse({});
    }
    if (chatMetadataMode === "string") {
      return jsonResponse({ isChatUserMessagesEnabled: "true" });
    }
    return jsonResponse({
      isChatUserMessagesEnabled: chatMetadataMode === "enabled"
    });
  }

  if (url.hostname === "friends.roblox.com" && url.pathname.endsWith("/friends/find")) {
    requestStats.friendPages += 1;
    requestStats.friendFindHadUserSort ||= url.searchParams.has("userSort");
    const cursor = url.searchParams.get("cursor");
    if (!cursor) return jsonResponse(friendPage(1, 50, "page-two"));
    if (cursor === "page-two") return jsonResponse(friendPage(51, 100, "page-three"));
    if (cursor === "page-three") return jsonResponse(friendPage(101, 103, null));
    return jsonResponse({ errors: [{ code: 6, message: "Bad cursor" }] }, 400);
  }

  if (url.hostname === "presence.roblox.com" && url.pathname === "/v1/presence/users") {
    requestStats.presenceBatches += 1;
    requestStats.activePresenceBatches += 1;
    requestStats.maxConcurrentPresenceBatches = Math.max(
      requestStats.maxConcurrentPresenceBatches,
      requestStats.activePresenceBatches
    );
    const userIds = JSON.parse(options.body).userIds;
    requestStats.largestPresenceBatch = Math.max(
      requestStats.largestPresenceBatch,
      userIds.length
    );
    const onlineTypes = new Map([
      [2, 1],
      [3, 2],
      [20, 4],
      [51, 3],
      [73, 1],
      [94, 2]
    ]);
    await new Promise((resolve) => setTimeout(resolve, 60));
    requestStats.activePresenceBatches -= 1;
    return jsonResponse({
      userPresences: userIds.map((userId) => ({
        userId,
        userPresenceType: onlineTypes.get(userId) || 0,
        lastLocation: onlineTypes.get(userId) === 2 ? "Fixture Experience" : "",
        placeId: onlineTypes.get(userId) === 2 ? 777 : null,
        rootPlaceId: onlineTypes.get(userId) === 2 ? 555 : null,
        universeId: onlineTypes.get(userId) === 2 ? 333 : null,
        gameId:
          onlineTypes.get(userId) === 2
            ? "11111111-2222-3333-4444-555555555555"
            : null
      }))
    });
  }

  if (
    url.hostname === "apis.roblox.com" &&
    url.pathname === "/user-profile-api/v1/user/profiles/get-profiles"
  ) {
    requestStats.profiles += 1;
    const userIds = JSON.parse(options.body).userIds;
    await new Promise((resolve) => setTimeout(resolve, 120));
    return jsonResponse({
      profileDetails: userIds.map((userId) => ({
        userId,
        names: {
          username: `Fixture${userId}`,
          combinedName: `Fixture Friend ${userId}`
        },
        isVerified: userId === 51,
        hasRobloxSubscription: userId === 2 || userId === 51,
        isDeleted: false
      })),
      errors: []
    });
  }

  if (
    url.hostname === "apis.roblox.com" &&
    url.pathname === "/universes/v1/places/123/universe"
  ) {
    requestStats.universeLookups += 1;
    return jsonResponse({ universeId: 987654 });
  }

  if (
    url.hostname === "economy.roblox.com" &&
    url.pathname === "/v2/assets/444/details"
  ) {
    requestStats.assetDetails += 1;
    return jsonResponse({
      AssetId: 444,
      ProductId: 555,
      AssetTypeId: 13,
      Creator: { CreatorTargetId: 666, CreatorType: "User" },
      IconImageAssetId: 777
    });
  }

  if (
    url.hostname === "assetdelivery.roblox.com" &&
    url.pathname === "/v2/assetId/444"
  ) {
    requestStats.assetContents += 1;
    return jsonResponse({
      locations: [{ location: "https://c0.rbxcdn.com/fixture-decal-content" }]
    });
  }

  if (
    url.hostname === "c0.rbxcdn.com" &&
    url.pathname === "/fixture-decal-content"
  ) {
    requestStats.assetCdnContents += 1;
    return new Response(
      '<roblox><Item><Properties><Content name="Texture"><url>' +
        'http://www.roblox.com/asset/?id=888</url></Content></Properties></Item></roblox>',
      { status: 200, headers: { "Content-Type": "application/xml" } }
    );
  }

  if (url.hostname === "thumbnails.roblox.com") {
    requestStats.thumbnails += 1;
    requestStats.lastThumbnailFormat = url.searchParams.get("format") || "";
    const universeIds = (url.searchParams.get("universeIds") || "")
      .split(",")
      .filter(Boolean);
    if (universeIds.length > 0) {
      requestStats.gameUniverseThumbnails += 1;
      return jsonResponse({
        data: universeIds.map((universeId) => ({
          targetId: Number(universeId),
          state: "Completed",
          imageUrl: `https://tr.rbxcdn.com/fixture-game-${universeId}`
        }))
      });
    }
    const userIds = (url.searchParams.get("userIds") || "").split(",").filter(Boolean);
    return jsonResponse({
      data: userIds.map((userId) => {
        const pendingOnlineHeadshot = requestStats.thumbnails === 1 && userId === "2";
        const missingFirstOfflineHeadshot = requestStats.thumbnails === 3 && userId === "1";
        return {
          targetId: Number(userId),
          state: pendingOnlineHeadshot
            ? "Pending"
            : missingFirstOfflineHeadshot
              ? "Blocked"
              : "Completed",
          imageUrl:
            pendingOnlineHeadshot || missingFirstOfflineHeadshot
              ? null
              : `https://tr.rbxcdn.com/fixture-${userId}`
        };
      })
    });
  }

  return jsonResponse({ errors: [{ code: 404, message: "Unexpected fixture URL" }] }, 404);
};

function fail(message) {
  document.body.dataset.testResult = "fail";
  document.body.dataset.testMessage = message;
  document.title = `FAIL: ${message}`;
  globalThis.fetch = originalFetch;
}

const backgroundScript = document.createElement("script");
backgroundScript.src = "../background.js";
backgroundScript.addEventListener("error", () => fail("background.js did not parse"));
backgroundScript.addEventListener("load", async () => {
  try {
    const fetchAllFriendIds = globalThis.__rslBackgroundTestHooks.fetchAllFriendIds;
    const firstFriendIdRequest = fetchAllFriendIds("9001");
    const deduplicatedFriendIdRequest = fetchAllFriendIds("9001");
    if (firstFriendIdRequest !== deduplicatedFriendIdRequest) {
      fail("Concurrent friend ID scans did not share one per-viewer in-flight request");
      return;
    }
    const [firstFriendIds, deduplicatedFriendIds] = await Promise.all([
      firstFriendIdRequest,
      deduplicatedFriendIdRequest
    ]);
    if (
      firstFriendIds.length !== 103 ||
      deduplicatedFriendIds.length !== 103 ||
      firstFriendIds[0] !== "1" ||
      firstFriendIds[102] !== "103" ||
      firstFriendIds.join("|") !== deduplicatedFriendIds.join("|") ||
      requestStats.friendListRequests !== 1 ||
      requestStats.friendPages !== 3 ||
      requestStats.friendFindHadUserSort !== false
    ) {
      fail("Merged friend scan did not preserve complete, ordered, deduplicated IDs");
      return;
    }
    if (
      requestStats.friendListCredentials !== "include" ||
      requestStats.friendListCache !== "no-store" ||
      requestStats.friendListAccept !== "application/json"
    ) {
      fail("Friend list did not use authenticated no-store JSON semantics");
      return;
    }

    const friendListsBeforeForcedIdRefresh = requestStats.friendListRequests;
    const friendPagesBeforeForcedIdRefresh = requestStats.friendPages;
    const forcedFriendIds = await fetchAllFriendIds("9001", true);
    if (
      forcedFriendIds.length !== 103 ||
      requestStats.friendListRequests !== friendListsBeforeForcedIdRefresh + 1 ||
      requestStats.friendPages !== friendPagesBeforeForcedIdRefresh + 3
    ) {
      fail("Forced friend ID refresh reused stale list or pagination data");
      return;
    }
    const friendListsBeforeIdCacheCheck = requestStats.friendListRequests;
    const friendPagesBeforeIdCacheCheck = requestStats.friendPages;
    const cachedFriendIds = await fetchAllFriendIds("9001", false);
    if (
      cachedFriendIds.join("|") !== forcedFriendIds.join("|") ||
      requestStats.friendListRequests !== friendListsBeforeIdCacheCheck ||
      requestStats.friendPages !== friendPagesBeforeIdCacheCheck
    ) {
      fail("Non-forced friend ID request did not reuse the complete merged cache");
      return;
    }

    const friendListsBeforeOnlineRefresh = requestStats.friendListRequests;
    const friendPagesBeforeOnlineRefresh = requestStats.friendPages;
    const response = await globalThis.__rslBackgroundTestHooks.fetchAllOnlineFriends(true);
    const friendListsAfterOnlineRefresh = requestStats.friendListRequests;
    const friendPagesAfterOnlineRefresh = requestStats.friendPages;
    if (
      friendListsAfterOnlineRefresh !== friendListsBeforeOnlineRefresh + 1 ||
      friendPagesAfterOnlineRefresh !== friendPagesBeforeOnlineRefresh + 3
    ) {
      fail("Online-friends force refresh was not forwarded to the friend ID scan");
      return;
    }
    const ids = response.friends.map((friend) => friend.userId).sort().join("|");
    const expectedCanonicalFriendIds = Array.from(
      { length: 103 },
      (_value, index) => String(index + 1)
    );

    if (
      response.scannedFriendTotal !== 103 ||
      !Array.isArray(response.friendUserIds) ||
      response.friendUserIds.join("|") !== expectedCanonicalFriendIds.join("|")
    ) {
      fail(`Did not scan every friend: ${response.scannedFriendTotal}`);
      return;
    }
    if (response.onlineTotal !== 5 || ids !== "2|3|51|73|94") {
      fail(`Wrong complete online result: ${response.onlineTotal} / ${ids}`);
      return;
    }
    const offlineIds = new Set(response.offlineFriends.map((friend) => friend.userId));
    if (
      response.offlineTotal !== 98 ||
      response.offlineFriends.length !== 98 ||
      !offlineIds.has("20") ||
      response.friends.some((friend) => offlineIds.has(friend.userId))
    ) {
      fail(`Wrong complete offline complement: ${response.offlineTotal}`);
      return;
    }
    if (response.offlineDetailsComplete !== false) {
      fail("Offline decorative details should remain lazy");
      return;
    }
    const baseFriendsById = new Map(
      [...response.friends, ...response.offlineFriends].map((friend) => [friend.userId, friend])
    );
    if (
      baseFriendsById.size !== 103 ||
      Array.from(baseFriendsById.values()).some(
        (friend) =>
          friend.username !== `ListUser${friend.userId}` ||
          friend.displayName !== `List Friend ${friend.userId}`
      ) ||
      baseFriendsById.get("73")?.isVerified !== true ||
      baseFriendsById.get("20")?.username !== "ListUser20" ||
      baseFriendsById.get("103")?.displayName !== "List Friend 103"
    ) {
      fail("Fast friend-list names were discarded before picker search could use them");
      return;
    }
    if (response.detailsComplete !== false || requestStats.profiles !== 1) {
      fail("Core presence result waited for decorative details");
      return;
    }
    if (
      requestStats.friendListRequests !== friendListsAfterOnlineRefresh ||
      requestStats.friendPages !== friendPagesAfterOnlineRefresh
    ) {
      fail(
        `Merged friend snapshot was unexpectedly reloaded: ${requestStats.friendListRequests}/${requestStats.friendPages}`
      );
      return;
    }
    if (requestStats.presenceBatches !== 3 || requestStats.largestPresenceBatch > 50) {
      fail(
        `Unsafe presence batching: ${requestStats.presenceBatches} / ${requestStats.largestPresenceBatch}`
      );
      return;
    }
    if (requestStats.maxConcurrentPresenceBatches < 2) {
      fail("Presence batches did not run concurrently");
      return;
    }

    const detailedResponse = await globalThis.__rslBackgroundTestHooks.getOnlineFriendsDetails(
      "9001"
    );
    if (
      detailedResponse.detailsComplete !== true ||
      detailedResponse.friends.some((friend) => !friend.headshotUrl)
    ) {
      fail("Progressive profile/headshot details were not completed");
      return;
    }
    if (requestStats.profiles !== 1 || requestStats.thumbnails !== 2) {
      fail(`Missing enrichment calls: ${requestStats.profiles} / ${requestStats.thumbnails}`);
      return;
    }

    const offlineDetailedResponse =
      await globalThis.__rslBackgroundTestHooks.getOfflineFriendsDetails("9001");
    if (
      offlineDetailedResponse.detailsComplete !== true ||
      offlineDetailedResponse.friends.length !== 98 ||
      offlineDetailedResponse.friends.some(
        (friend) => friend.presenceType !== "Offline" || !friend.username
      )
    ) {
      fail("Lazy Offline profile/headshot details were not completed");
      return;
    }
    if (
      offlineDetailedResponse.friends.find((friend) => friend.userId === "1")?.headshotUrl !== null
    ) {
      fail("Fixture did not retain the temporary missing Offline thumbnail");
      return;
    }
    if (requestStats.profiles !== 2 || requestStats.thumbnails !== 3) {
      fail(`Unexpected lazy Offline enrichment calls: ${requestStats.profiles} / ${requestStats.thumbnails}`);
      return;
    }

    const retrySnapshot = await globalThis.__rslBackgroundTestHooks.fetchAllOnlineFriends(true);
    if (retrySnapshot.offlineDetailsComplete !== false) {
      fail("Partial Offline details were incorrectly reused after refresh");
      return;
    }
    const retriedOfflineDetails =
      await globalThis.__rslBackgroundTestHooks.getOfflineFriendsDetails("9001");
    if (
      retriedOfflineDetails.detailsComplete !== true ||
      retriedOfflineDetails.friends.some((friend) => !friend.headshotUrl)
    ) {
      fail("Missing Offline details were not retried on refresh");
      return;
    }

    const friendPagesBeforeCacheCheck = requestStats.friendPages;
    const friendListsBeforeCacheCheck = requestStats.friendListRequests;
    const presenceBatchesBeforeCacheCheck = requestStats.presenceBatches;
    const cachedResponse = await globalThis.__rslBackgroundTestHooks.fetchAllOnlineFriends(false);
    if (
      cachedResponse.onlineTotal !== 5 ||
      cachedResponse.offlineTotal !== 98 ||
      !Array.isArray(cachedResponse.friendUserIds) ||
      cachedResponse.friendUserIds.join("|") !== expectedCanonicalFriendIds.join("|") ||
      cachedResponse.offlineDetailsComplete !== true ||
      requestStats.friendListRequests !== friendListsBeforeCacheCheck ||
      requestStats.friendPages !== friendPagesBeforeCacheCheck ||
      requestStats.presenceBatches !== presenceBatchesBeforeCacheCheck
    ) {
      fail("Complete response cache was not reused");
      return;
    }

    const setFixtureStorage = (values) =>
      new Promise((resolve) => chrome.storage.local.set(values, resolve));
    const getBestFriendsContext =
      globalThis.__rslBackgroundTestHooks.getBestFriendsContext;
    const getViewerCanChat = globalThis.__rslBackgroundTestHooks.getViewerCanChat;
    const authenticatedBeforeBestFriends = requestStats.authenticated;

    await setFixtureStorage({
      bestFriendsByViewer: {
        7777: ["2", "51"]
      }
    });
    const emptyBestFriends = await getBestFriendsContext();
    if (
      emptyBestFriends.viewerUserId !== "9001" ||
      emptyBestFriends.canChat !== true ||
      emptyBestFriends.selectedUserIds.length !== 0 ||
      emptyBestFriends.staleUserIds.length !== 0 ||
      emptyBestFriends.friends.length !== 0
    ) {
      fail("Best Friends storage leaked selections between signed-in viewers");
      return;
    }
    if (
      requestStats.chatMetadataCredentials !== "include" ||
      requestStats.chatMetadataCache !== "no-store" ||
      requestStats.chatMetadataAccept !== "application/json"
    ) {
      fail(
        "Chat metadata request did not use Roblox-authenticated no-store JSON semantics: " +
          `${requestStats.chatMetadataCredentials}/` +
          `${requestStats.chatMetadataCache}/${requestStats.chatMetadataAccept}`
      );
      return;
    }

    await setFixtureStorage({
      bestFriendsByViewer: {
        9001: [2, "3", "3", "20", "103", "999", "0", "0002", 51],
        7777: ["73"]
      }
    });
    chatMetadataMode = "disabled";
    const bestFriends = await getBestFriendsContext();
    if (
      bestFriends.canChat !== false ||
      bestFriends.selectedUserIds.join("|") !== "2|3|20|103|51" ||
      bestFriends.staleUserIds.join("|") !== "999" ||
      bestFriends.friends.map((friend) => friend.userId).join("|") !==
        "2|3|20|103|51"
    ) {
      fail("Best Friends IDs were not scoped, normalized, deduplicated, or ordered correctly");
      return;
    }
    chatMetadataMode = "enabled";
    const bestFriendsById = new Map(
      bestFriends.friends.map((friend) => [friend.userId, friend])
    );
    if (
      bestFriendsById.get("2")?.presenceType !== "Online" ||
      bestFriendsById.get("3")?.presenceType !== "InGame" ||
      bestFriendsById.get("20")?.presenceType !== "Offline" ||
      bestFriendsById.get("51")?.presenceType !== "InStudio" ||
      bestFriendsById.get("3")?.gameInstanceId !==
        "11111111-2222-3333-4444-555555555555" ||
      bestFriendsById.get("3")?.universeId !== "333" ||
      bestFriendsById.get("51")?.isVerified !== true ||
      bestFriendsById.get("51")?.isRobloxPlus !== true ||
      bestFriendsById.get("2")?.isRobloxPlus !== true ||
      Array.from(bestFriendsById.values()).some(
        (friend) => !friend.username.startsWith("Fixture") || !friend.headshotUrl
      )
    ) {
      fail("Best Friends did not include current profiles, headshots, and presence");
      return;
    }

    const fixtureGameIcon = await globalThis.__rslBackgroundTestHooks.getThumbnail(
      "gameUniverse",
      "333",
      true
    );
    if (
      fixtureGameIcon !== "https://tr.rbxcdn.com/fixture-game-333" ||
      requestStats.gameUniverseThumbnails !== 1 ||
      requestStats.lastThumbnailFormat !== "Webp"
    ) {
      fail("Universe game icon did not use Roblox's WebP thumbnail endpoint");
      return;
    }

    await setFixtureStorage({
      bestFriendsByViewer: {
        9001: Array.from({ length: 103 }, (_, index) => String(index + 1))
      }
    });
    const cappedBestFriends = await getBestFriendsContext();
    if (
      cappedBestFriends.canChat !== true ||
      cappedBestFriends.selectedUserIds.length !== 100 ||
      cappedBestFriends.selectedUserIds[0] !== "1" ||
      cappedBestFriends.selectedUserIds[99] !== "100" ||
      cappedBestFriends.selectedUserIds.includes("101") ||
      cappedBestFriends.staleUserIds.length !== 0 ||
      requestStats.authenticated !== authenticatedBeforeBestFriends + 3
    ) {
      fail(
        "Best Friends storage cap or fresh authenticated-viewer checks were not enforced: " +
          `${cappedBestFriends.selectedUserIds.length}/` +
          `${cappedBestFriends.selectedUserIds[0]}/` +
          `${cappedBestFriends.selectedUserIds[99]}/` +
          `${cappedBestFriends.staleUserIds.length}/` +
          `${requestStats.authenticated}/${authenticatedBeforeBestFriends}`
      );
      return;
    }

    for (const mode of ["missing", "string", "malformed", "error"]) {
      chatMetadataMode = mode;
      if (await getViewerCanChat()) {
        fail(`Invalid Chat metadata was not rejected: ${mode}`);
        return;
      }
    }
    chatMetadataMode = "enabled";

    const parseContext = globalThis.__rslBackgroundTestHooks.parseRobloxContextUrl;
    const parserCases = [
      ["https://www.roblox.com/users/1075169091/profile", "userId", "1075169091"],
      ["https://www.roblox.com/games/123/fixture", "placeId", "123"],
      ["https://www.roblox.com/catalog/444/fixture", "assetId", "444"],
      ["https://create.roblox.com/store/asset/444/fixture", "assetId", "444"],
      [
        "https://create.roblox.com/dashboard/creations/store/444/configure",
        "assetId",
        "444"
      ],
      ["https://www.roblox.com/communities/555/fixture", "groupId", "555"],
      ["https://www.roblox.com/bundles/666/fixture", "bundleId", "666"],
      ["https://www.roblox.com/badges/777/fixture", "badgeId", "777"],
      ["https://www.roblox.com/game-pass/888/fixture", "gamePassId", "888"],
      ["https://www.roblox.com/users/999/outfits/111", "outfitId", "111"],
      [
        "https://create.roblox.com/dashboard/creations/experiences/222/badges/333/overview",
        "badgeId",
        "333"
      ],
      [
        "https://create.roblox.com/dashboard/creations/experiences/222/monetization/developer-products/444/overview",
        "developerProductId",
        "444"
      ],
      [
        "https://create.roblox.com/dashboard/creations/experiences/222/experience-subscriptions/EXP-555/overview",
        "experienceSubscriptionId",
        "EXP-555"
      ],
      [
        "https://create.roblox.com/dashboard/group/roles/777?groupId=666",
        "groupRoleId",
        "777"
      ]
    ];
    for (const [url, field, value] of parserCases) {
      if (parseContext(url)?.[field] !== value) {
        fail(`Context URL parser missed ${field}: ${url}`);
        return;
      }
    }
    if (
      parseContext("http://www.roblox.com/users/1/profile") ||
      parseContext("https://www.roblox.com.example.com/users/1/profile") ||
      parseContext("https://www.roblox.com/users/123456789012345678901/profile")
    ) {
      fail("Context URL parser accepted a hostile or invalid URL");
      return;
    }

    const privateServerContext = parseContext(
      "https://www.roblox.com/games/123/fixture?privateServerLinkCode=DO_NOT_COPY"
    );
    if (
      privateServerContext?.placeId !== "123" ||
      Object.keys(privateServerContext || {}).some((key) => key.toLowerCase().includes("private"))
    ) {
      fail("Private-server access data was parsed into copyable context");
      return;
    }

    const placeCopy = await globalThis.__rslBackgroundTestHooks.getContextCopyResult(
      { kind: "game", placeId: "123" },
      "placeId"
    );
    if (placeCopy.text !== "123" || requestStats.universeLookups !== 0) {
      fail("Copy Place ID unexpectedly performed a Universe lookup");
      return;
    }

    const universeCopy = await globalThis.__rslBackgroundTestHooks.getContextCopyResult(
      { kind: "game", placeId: "123" },
      "universeId"
    );
    if (universeCopy.text !== "987654" || requestStats.universeLookups !== 1) {
      fail("Copy Universe ID did not resolve the selected Place ID");
      return;
    }

    const gameCopy = await globalThis.__rslBackgroundTestHooks.getContextCopyResult(
      { kind: "game", placeId: "123" },
      "all"
    );
    if (
      !gameCopy.text.includes("Place ID: 123") ||
      !gameCopy.text.includes("Universe ID (Game ID): 987654") ||
      requestStats.universeLookups !== 1
    ) {
      fail(`Place-to-Universe copy failed: ${gameCopy.text}`);
      return;
    }
    if (gameCopy.text.includes("DO_NOT_COPY") || gameCopy.text.toLowerCase().includes("private")) {
      fail("Private-server access data leaked into copied output");
      return;
    }

    const directAssetCopy = await globalThis.__rslBackgroundTestHooks.getContextCopyResult(
      { kind: "asset", assetId: "444" },
      "assetId"
    );
    if (
      directAssetCopy.text !== "444" ||
      requestStats.assetDetails !== 0 ||
      requestStats.assetContents !== 0
    ) {
      fail("Copy Asset ID unexpectedly performed a texture lookup");
      return;
    }

    const textureCopy = await globalThis.__rslBackgroundTestHooks.getContextCopyResult(
      { kind: "asset", assetId: "444" },
      "textureId"
    );
    if (textureCopy.text !== "888") {
      fail(`Copy Texture ID returned the wrong value: ${textureCopy.text}`);
      return;
    }

    const assetCopy = await globalThis.__rslBackgroundTestHooks.getContextCopyResult(
      { kind: "asset", assetId: "444" },
      "all"
    );
    for (const expected of [
      "Asset ID: 444",
      "Product ID: 555",
      "Asset Type ID: 13",
      "Creator User ID: 666",
      "Icon Image Asset ID: 777",
      "Texture ID: 888"
    ]) {
      if (!assetCopy.text.includes(expected)) {
        fail(`Rich asset copy missed ${expected}: ${assetCopy.text}`);
        return;
      }
    }
    if (
      requestStats.assetDetails !== 1 ||
      requestStats.assetContents !== 1 ||
      requestStats.assetCdnContents !== 1
    ) {
      fail("Asset metadata or Texture ID lookup was not cached correctly");
      return;
    }

    const contextActions = globalThis.__rslBackgroundTestHooks.contextMenuActions;
    const expectedDirectActions = new Map([
      ["user", "userId"],
      ["community", "groupId"],
      ["community-role", "groupRoleId"],
      ["bundle", "bundleId"],
      ["badge", "badgeId"],
      ["game-pass", "gamePassId"],
      ["outfit", "outfitId"],
      ["developer-product", "developerProductId"],
      ["experience-subscription", "experienceSubscriptionId"]
    ]);
    const gameGroup = contextActions.find((item) => item.key === "game-ids");
    const assetGroup = contextActions.find((item) => item.key === "asset-ids");
    if (
      contextActions.length !== expectedDirectActions.size + 2 ||
      contextActions.some((item) => item.title === "Roblox IDs") ||
      contextActions.some(
        (item) =>
          item !== gameGroup &&
          item !== assetGroup &&
          expectedDirectActions.get(item.key) !== item.action
      ) ||
      gameGroup?.title !== "Copy Game IDs" ||
      gameGroup?.children?.length !== 2 ||
      gameGroup.children[0]?.title !== "Copy Place ID" ||
      gameGroup.children[0]?.action !== "placeId" ||
      gameGroup.children[1]?.title !== "Copy Universe ID / Game ID" ||
      gameGroup.children[1]?.action !== "universeId" ||
      assetGroup?.title !== "Copy Texture ID / Asset ID" ||
      assetGroup?.children?.length !== 2 ||
      assetGroup.children[0]?.title !== "Copy Texture ID" ||
      assetGroup.children[0]?.action !== "textureId" ||
      assetGroup.children[1]?.title !== "Copy Asset ID" ||
      assetGroup.children[1]?.action !== "assetId"
    ) {
      fail("Direct context-menu actions were not configured correctly");
      return;
    }

    const handleRuntimeMessage =
      globalThis.__rslBackgroundTestHooks.handleRuntimeMessage;
    const dispatchBackgroundMessage = (
      message,
      sender = { id: chrome.runtime.id }
    ) =>
      new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error(`Background message timed out: ${message.type}`)),
          2_000
        );
        const keptOpen = handleRuntimeMessage(
          message,
          sender,
          (response) => {
            clearTimeout(timeout);
            resolve({ keptOpen, response });
          }
        );
        if (keptOpen !== true) {
          clearTimeout(timeout);
          reject(new Error(`Background message channel was not retained: ${message.type}`));
        }
      });
    const friendMessageCases = [
      { type: "rsl:get-all-online-friends", requestId: 201, forceRefresh: false },
      { type: "rsl:get-best-friends-context", requestId: 202 },
      {
        type: "rsl:get-online-friend-details",
        requestId: 203,
        viewerUserId: "9001"
      },
      {
        type: "rsl:get-offline-friend-details",
        requestId: 204,
        viewerUserId: "9001"
      }
    ];
    for (const message of friendMessageCases) {
      const { keptOpen, response: messageResponse } =
        await dispatchBackgroundMessage(message);
      if (
        keptOpen !== true ||
        messageResponse?.ok !== true ||
        messageResponse?.requestId !== message.requestId
      ) {
        fail(`Random Server swallowed or corrupted ${message.type}`);
        return;
      }
    }

    const friendListsBeforeFallback = requestStats.friendListRequests;
    const friendPagesBeforeFallback = requestStats.friendPages;
    friendListMode = "malformed";
    const malformedFallbackIds = await fetchAllFriendIds("9002");
    if (
      malformedFallbackIds.length !== 103 ||
      malformedFallbackIds[0] !== "1" ||
      malformedFallbackIds[102] !== "103" ||
      requestStats.friendListRequests !== friendListsBeforeFallback + 1 ||
      requestStats.friendPages !== friendPagesBeforeFallback + 3
    ) {
      fail("Malformed one-request friend list did not fall back to complete pagination");
      return;
    }

    const friendListsBeforeErrorFallback = requestStats.friendListRequests;
    const friendPagesBeforeErrorFallback = requestStats.friendPages;
    friendListMode = "error";
    const errorFallbackIds = await fetchAllFriendIds("9003");
    if (
      errorFallbackIds.length !== 103 ||
      requestStats.friendListRequests !== friendListsBeforeErrorFallback + 1 ||
      requestStats.friendPages !== friendPagesBeforeErrorFallback + 3
    ) {
      fail("Failed one-request friend list did not fall back to complete pagination");
      return;
    }
    friendListMode = "success";

    const aggregationHooks = globalThis.__rslBackgroundTestHooks;
    aggregationHooks.resetFriendAggregationStateForTests();
    authenticatedViewerId = 9002;
    friendListMode = "malformed";
    const paginatedBaseResponse = await aggregationHooks.fetchAllOnlineFriends(true);
    const paginatedBaseFriends = [
      ...paginatedBaseResponse.friends,
      ...paginatedBaseResponse.offlineFriends
    ];
    if (
      paginatedBaseFriends.length !== 103 ||
      paginatedBaseFriends.some(
        (friend) =>
          friend.username !== `User ${friend.userId}` ||
          friend.displayName !== `User ${friend.userId}`
      )
    ) {
      fail("Paginated ID-only fallback invented or leaked friend-list seed profiles");
      return;
    }
    const paginatedDetailedResponse =
      await aggregationHooks.getOnlineFriendsDetails("9002");
    if (
      paginatedDetailedResponse.detailsComplete !== true ||
      paginatedDetailedResponse.friends.some(
        (friend) => !friend.username.startsWith("Fixture")
      )
    ) {
      fail("Paginated ID-only fallback did not enrich placeholder names later");
      return;
    }

    aggregationHooks.resetFriendAggregationStateForTests();
    authenticatedViewerId = 9003;
    friendListMode = "truncated";
    friendPageMode = "names";
    const friendListsBeforeTruncatedMerge = requestStats.friendListRequests;
    const friendPagesBeforeTruncatedMerge = requestStats.friendPages;
    const namedPaginatedResponse = await aggregationHooks.fetchAllOnlineFriends(true);
    const namedPaginatedFriends = [
      ...namedPaginatedResponse.friends,
      ...namedPaginatedResponse.offlineFriends
    ];
    const k11Friend = namedPaginatedFriends.find((friend) => friend.userId === "103");
    const usernameSearchMatches = namedPaginatedFriends.filter((friend) =>
      friend.username.toLowerCase().includes("leohund1306")
    );
    const displayNameSearchMatches = namedPaginatedFriends.filter((friend) =>
      friend.displayName.toLowerCase().includes("k11")
    );
    if (
      namedPaginatedResponse.scannedFriendTotal !== 103 ||
      namedPaginatedFriends.length !== 103 ||
      namedPaginatedFriends.some(
        (friend) =>
          friend.userId !== "103" &&
          (friend.username !== `PageUser${friend.userId}` ||
            friend.displayName !== `Page Friend ${friend.userId}`)
      ) ||
      k11Friend?.username !== "LeoHund1306" ||
      k11Friend?.displayName !== "K11" ||
      usernameSearchMatches.length !== 1 ||
      usernameSearchMatches[0]?.userId !== "103" ||
      displayNameSearchMatches.length !== 1 ||
      displayNameSearchMatches[0]?.userId !== "103" ||
      namedPaginatedFriends.find((friend) => friend.userId === "51")?.isVerified !== true ||
      requestStats.friendListRequests !== friendListsBeforeTruncatedMerge + 1 ||
      requestStats.friendPages !== friendPagesBeforeTruncatedMerge + 3
    ) {
      fail(
        "A friend omitted from the simple list was not recovered with searchable paginated metadata"
      );
      return;
    }
    await aggregationHooks.getOnlineFriendsDetails("9003");
    friendListMode = "success";
    friendPageMode = "ids";
    authenticatedViewerId = 9001;
    aggregationHooks.resetFriendAggregationStateForTests();

    const privateServerHooks = globalThis.__rslBackgroundTestHooks;
    const resetPrivateServerMemoryForTests =
      privateServerHooks.resetPrivateServerSupportMemoryForTests ||
      privateServerHooks.resetPrivateServerMemoryForTests;
    if (typeof resetPrivateServerMemoryForTests !== "function") {
      fail("Private-server tests cannot simulate an MV3 background memory reset");
      return;
    }
    await privateServerHooks.resetPrivateServerStateForTests();
    privateServerSupportMode = "available";
    const privateSupportRequestsBefore = requestStats.privateServerSupportRequests;
    const [firstSupport, deduplicatedSupport] = await Promise.all([
      privateServerHooks.getPrivateServerSupport("123"),
      privateServerHooks.getPrivateServerSupport("123")
    ]);
    const cachedSupport = await privateServerHooks.getPrivateServerSupport("123");
    if (
      firstSupport.placeId !== "123" ||
      firstSupport.universeId !== "987654" ||
      firstSupport.enabled !== true ||
      deduplicatedSupport.enabled !== true ||
      cachedSupport.enabled !== true ||
      requestStats.privateServerSupportRequests !== privateSupportRequestsBefore + 1
    ) {
      fail("Private-server support was not resolved, deduplicated, or cached correctly");
      return;
    }

    // A Manifest V3 worker may be discarded while the Roblox tab remains open.
    // Its confirmed support result must survive that loss of in-memory Maps.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await resetPrivateServerMemoryForTests();
    privateServerSupportMode = "malformed";
    const persistedSupport = await privateServerHooks.getPrivateServerSupport("123");
    if (
      persistedSupport.placeId !== "123" ||
      persistedSupport.universeId !== "987654" ||
      persistedSupport.enabled !== true ||
      requestStats.privateServerSupportRequests !== privateSupportRequestsBefore + 1
    ) {
      fail("A confirmed private-server result did not survive background memory reset");
      return;
    }
    if (
      requestStats.privateServerSupportLastUrl !==
        "https://apis.roblox.com/private-servers-api/Universe-Private-Server-Settings?universeId=987654" ||
      requestStats.privateServerSupportMethod !== "GET" ||
      requestStats.privateServerSupportCredentials !== "omit" ||
      requestStats.privateServerSupportCache !== "no-store" ||
      requestStats.privateServerSupportAccept !== "application/json"
    ) {
      fail("Private-server support did not use the exact Roblox settings endpoint contract");
      return;
    }

    await privateServerHooks.resetPrivateServerStateForTests();
    privateServerSupportMode = "unavailable";
    const unavailableSupport = await privateServerHooks.getPrivateServerSupport("123");
    if (unavailableSupport.enabled !== false) {
      fail("Private-server support enabled a universe with product ID 0");
      return;
    }
    await privateServerHooks.resetPrivateServerStateForTests();
    privateServerSupportMode = "creation-limited";
    const creationLimitedSupport = await privateServerHooks.getPrivateServerSupport("123");
    if (creationLimitedSupport.enabled !== true) {
      fail("Private-server support was hidden when creation was unavailable but its product existed");
      return;
    }
    await privateServerHooks.resetPrivateServerStateForTests();
    privateServerSupportMode = "malformed";
    const malformedSupportRequestsBefore = requestStats.privateServerSupportRequests;
    let malformedSupportCode = "";
    try {
      await privateServerHooks.getPrivateServerSupport("123");
    } catch (error) {
      malformedSupportCode = privateServerHooks.getPrivateServerErrorCode(error);
    }
    if (malformedSupportCode !== "ROBLOX_UNAVAILABLE") {
      fail("Ambiguous private-server metadata was cached as unsupported");
      return;
    }

    // Failures must never enter durable storage. Once memory is lost and Roblox
    // recovers, the next lookup has to reach Roblox and obtain a confirmed value.
    await resetPrivateServerMemoryForTests();
    privateServerSupportMode = "available";
    const recoveredSupport = await privateServerHooks.getPrivateServerSupport("123");
    if (
      recoveredSupport.enabled !== true ||
      requestStats.privateServerSupportRequests !== malformedSupportRequestsBefore + 2
    ) {
      fail("A transient private-server failure was persisted across memory reset");
      return;
    }
    await privateServerHooks.resetPrivateServerStateForTests();

    const privateListRequestsBefore = requestStats.privateServerListRequests;
    const [firstPrivatePage, deduplicatedPrivatePage] = await Promise.all([
      privateServerHooks.getPrivateServersPage("123"),
      privateServerHooks.getPrivateServersPage("123")
    ]);
    if (
      requestStats.privateServerListRequests !== privateListRequestsBefore + 1 ||
      firstPrivatePage.servers.length !== 4 ||
      deduplicatedPrivatePage.servers.length !== 4 ||
      firstPrivatePage.nextPageCursor !== "page+two/==" ||
      firstPrivatePage.gameJoinRestricted !== true
    ) {
      fail("Private-server page was not filtered or deduplicated correctly");
      return;
    }
    const expectedPrivateServerKeys =
      "accessCode|id|maxPlayers|name|owner|playing";
    const privateIds = new Set();
    for (const server of firstPrivatePage.servers) {
      if (
        Object.keys(server).sort().join("|") !== expectedPrivateServerKeys ||
        typeof server.id !== "string" ||
        !server.id ||
        server.id === server.accessCode ||
        server.id.includes(server.accessCode) ||
        privateIds.has(server.id) ||
        Object.values(server).includes("DO_NOT_EXPOSE")
      ) {
        fail("Private-server response leaked fields/secrets or returned an unstable row ID");
        return;
      }
      privateIds.add(server.id);
    }
    const ownedPrivateServer = firstPrivatePage.servers.find(
      (server) => server.id === "private-server-555"
    );
    const restrictedEmptyServer = firstPrivatePage.servers.find(
      (server) => server.id === "private-server-556"
    );
    const fullPrivateServer = firstPrivatePage.servers.find(
      (server) => server.id === "private-server-558"
    );
    if (
      ownedPrivateServer?.name !== "Fixture Private Server" ||
      ownedPrivateServer.playing !== 2 ||
      ownedPrivateServer.maxPlayers !== 10 ||
      ownedPrivateServer.owner?.id !== "42" ||
      ownedPrivateServer.owner?.name !== "FixtureOwner" ||
      ownedPrivateServer.owner?.displayName !== "Fixture Owner" ||
      restrictedEmptyServer?.playing !== 0 ||
      fullPrivateServer?.playing !== 10 ||
      fullPrivateServer?.maxPlayers !== 10 ||
      Object.keys(ownedPrivateServer.owner).sort().join("|") !==
        "displayName|id|name"
    ) {
      fail("Private-server display metadata was not sanitized into the allowlist");
      return;
    }
    if (
      requestStats.privateServerListUrls.at(-1) !==
        "https://games.roblox.com/v1/games/123/private-servers" ||
      requestStats.privateServerListMethod !== "GET" ||
      requestStats.privateServerListCredentials !== "include" ||
      requestStats.privateServerListCache !== "no-store" ||
      requestStats.privateServerListAccept !== "application/json" ||
      !requestStats.privateServerListHadSignal
    ) {
      fail("Private-server list did not use authenticated no-store Roblox GET semantics");
      return;
    }

    await privateServerHooks.getPrivateServersPage("123");
    if (requestStats.privateServerListRequests !== privateListRequestsBefore + 2) {
      fail("Private-server pages were persistently cached between completed requests");
      return;
    }
    const secondPrivatePage = await privateServerHooks.getPrivateServersPage(
      "123",
      "page+two/=="
    );
    if (
      secondPrivatePage.servers.length !== 1 ||
      secondPrivatePage.nextPageCursor !== null ||
      requestStats.privateServerListUrls.at(-1) !==
        "https://games.roblox.com/v1/games/123/private-servers?cursor=page%2Btwo%2F%3D%3D"
    ) {
      fail("Private-server pagination did not preserve and encode the opaque cursor");
      return;
    }

    await privateServerHooks.resetPrivateServerStateForTests();
    privateServerListMode = "empty";
    const emptyPrivatePage = await privateServerHooks.getPrivateServersPage("123");
    if (
      emptyPrivatePage.servers.length !== 0 ||
      emptyPrivatePage.nextPageCursor !== null ||
      emptyPrivatePage.gameJoinRestricted !== false
    ) {
      fail("A supported experience with no accessible private servers was not preserved");
      return;
    }
    privateServerListMode = "mixed";

    await privateServerHooks.resetPrivateServerStateForTests();
    const viewerScopedRequestsBefore = requestStats.privateServerListRequests;
    authenticatedViewerId = 9001;
    const firstViewerPage = privateServerHooks.getPrivateServersPage("123");
    await new Promise((resolve) => setTimeout(resolve, 1));
    authenticatedViewerId = 9002;
    const secondViewerPage = privateServerHooks.getPrivateServersPage("123");
    await Promise.all([firstViewerPage, secondViewerPage]);
    authenticatedViewerId = 9001;
    if (requestStats.privateServerListRequests !== viewerScopedRequestsBefore + 2) {
      fail("Private-server in-flight requests were shared across authenticated viewers");
      return;
    }

    const supportMessage = await dispatchBackgroundMessage({
      type: "rsl:get-private-server-support",
      placeId: "123",
      requestId: 301
    });
    const listMessage = await dispatchBackgroundMessage({
      type: "rsl:get-private-servers",
      placeId: "123",
      cursor: null,
      requestId: 302
    });
    const ownerThumbnailsMessage = await dispatchBackgroundMessage({
      type: "rsl:get-private-server-owner-thumbnails",
      userIds: ["42", "44", "42"],
      requestId: 303
    });
    if (
      supportMessage.response?.ok !== true ||
      supportMessage.response?.requestId !== 301 ||
      supportMessage.response?.placeId !== "123" ||
      supportMessage.response?.enabled !== true ||
      listMessage.response?.ok !== true ||
      listMessage.response?.requestId !== 302 ||
      listMessage.response?.placeId !== "123" ||
      listMessage.response?.servers?.length !== 4 ||
      ownerThumbnailsMessage.response?.ok !== true ||
      ownerThumbnailsMessage.response?.requestId !== 303 ||
      ownerThumbnailsMessage.response?.thumbnails?.length !== 2 ||
      ownerThumbnailsMessage.response.thumbnails.some(
        (entry) =>
          !["42", "44"].includes(entry.userId) ||
          !/^https:\/\/tr\.rbxcdn\.com\/fixture-(?:42|44)$/.test(entry.url)
      )
    ) {
      fail("Private-server runtime messages lost correlation or safe owner thumbnails");
      return;
    }

    const trustedRobloxSender = {
      id: chrome.runtime.id,
      frameId: 0,
      url: "https://www.roblox.com/games/123/fixture",
      tab: {
        id: 73,
        url: "https://www.roblox.com/games/123/fixture"
      }
    };
    privateServerJoinMode = "started";
    const joinMessage = await dispatchBackgroundMessage(
      {
        type: "rsl:join-private-server",
        requestId: 501,
        placeId: "123",
        accessCode: PRIVATE_SERVER_JOIN_FIXTURE_ACCESS_CODE
      },
      trustedRobloxSender
    );
    if (
      joinMessage.keptOpen !== true ||
      joinMessage.response?.ok !== true ||
      joinMessage.response?.requestId !== 501 ||
      joinMessage.response?.placeId !== "123" ||
      joinMessage.response?.code !== "started" ||
      Object.keys(joinMessage.response).sort().join("|") !==
        "code|ok|placeId|requestId" ||
      JSON.stringify(joinMessage.response).includes(
        PRIVATE_SERVER_JOIN_FIXTURE_ACCESS_CODE
      )
    ) {
      fail("Private-server join response was not correlated or leaked its access code");
      return;
    }
    if (
      requestStats.privateServerJoinInjections !== 1 ||
      requestStats.privateServerJoinTargetTabId !== 73 ||
      requestStats.privateServerJoinFrameIds !== "[0]" ||
      requestStats.privateServerJoinWorld !== "MAIN" ||
      requestStats.privateServerJoinArgsLength !== 2 ||
      requestStats.privateServerJoinPlaceIdArg !== 123 ||
      requestStats.privateServerJoinAccessCodeMatched !== true ||
      requestStats.privateServerJoinNativeCalls !== 1 ||
      requestStats.privateServerJoinNativePlaceId !== 123 ||
      requestStats.privateServerJoinNativeAccessCodeMatched !== true ||
      requestStats.privateServerJoinNativeLinkCode !== ""
    ) {
      fail("Private-server join did not use the exact top-frame MAIN-world launcher contract");
      return;
    }

    const joinFailureModes = new Map([
      ["unavailable", "unavailable"],
      ["native-failed", "failed"],
      ["async-failed", "failed"],
      ["injection-failed", "failed"],
      ["unknown-result", "failed"]
    ]);
    let joinFailureRequestId = 510;
    for (const [mode, expectedCode] of joinFailureModes) {
      privateServerJoinMode = mode;
      const { response: failedJoinResponse } = await dispatchBackgroundMessage(
        {
          type: "rsl:join-private-server",
          requestId: joinFailureRequestId,
          placeId: "123",
          accessCode: PRIVATE_SERVER_JOIN_FIXTURE_ACCESS_CODE
        },
        trustedRobloxSender
      );
      if (
        failedJoinResponse?.ok !== false ||
        failedJoinResponse?.requestId !== joinFailureRequestId ||
        failedJoinResponse?.placeId !== "123" ||
        failedJoinResponse?.code !== expectedCode ||
        Object.hasOwn(failedJoinResponse || {}, "accessCode")
      ) {
        fail(`Private-server ${mode} launch mapped to ${failedJoinResponse?.code}`);
        return;
      }
      joinFailureRequestId += 1;
    }
    privateServerJoinMode = "started";

    const untrustedJoinSenders = [
      { id: chrome.runtime.id, frameId: 0 },
      {
        id: chrome.runtime.id,
        frameId: 1,
        tab: { id: 73, url: "https://www.roblox.com/games/123/fixture" }
      },
      {
        id: chrome.runtime.id,
        frameId: 0,
        tab: { id: -1, url: "https://www.roblox.com/games/123/fixture" }
      },
      {
        id: chrome.runtime.id,
        frameId: 0,
        tab: { id: 73, url: "http://www.roblox.com/games/123/fixture" }
      },
      {
        id: chrome.runtime.id,
        frameId: 0,
        tab: { id: 73, url: "https://roblox.com/games/123/fixture" }
      },
      {
        id: chrome.runtime.id,
        frameId: 0,
        tab: { id: 73, url: "https://www.roblox.com.evil.example/" }
      },
      {
        id: chrome.runtime.id,
        frameId: 0,
        url: "https://evil.example/",
        tab: { id: 73, url: "https://www.roblox.com/games/123/fixture" }
      }
    ];
    const joinInjectionsBeforeUntrusted = requestStats.privateServerJoinInjections;
    for (const untrustedSender of untrustedJoinSenders) {
      let untrustedResponse = null;
      const keptOpen = handleRuntimeMessage(
        {
          type: "rsl:join-private-server",
          requestId: 520,
          placeId: "123",
          accessCode: PRIVATE_SERVER_JOIN_FIXTURE_ACCESS_CODE
        },
        untrustedSender,
        (response) => {
          untrustedResponse = response;
        }
      );
      if (
        keptOpen !== false ||
        untrustedResponse?.ok !== false ||
        untrustedResponse?.code !== "failed" ||
        Object.hasOwn(untrustedResponse || {}, "accessCode")
      ) {
        fail("An untrusted frame or non-Roblox tab reached private-server launch");
        return;
      }
    }
    if (requestStats.privateServerJoinInjections !== joinInjectionsBeforeUntrusted) {
      fail("An untrusted private-server sender caused a MAIN-world injection");
      return;
    }

    const invalidJoinMessages = [
      {
        type: "rsl:join-private-server",
        requestId: -1,
        placeId: "123",
        accessCode: PRIVATE_SERVER_JOIN_FIXTURE_ACCESS_CODE
      },
      {
        type: "rsl:join-private-server",
        requestId: 521,
        placeId: "9007199254740992",
        accessCode: PRIVATE_SERVER_JOIN_FIXTURE_ACCESS_CODE
      },
      {
        type: "rsl:join-private-server",
        requestId: 522,
        placeId: "123",
        accessCode: "not-a-uuid"
      },
      {
        type: "rsl:join-private-server",
        requestId: 523,
        placeId: "123",
        accessCode: `${PRIVATE_SERVER_JOIN_FIXTURE_ACCESS_CODE} `
      }
    ];
    const joinInjectionsBeforeInvalid = requestStats.privateServerJoinInjections;
    for (const invalidJoinMessage of invalidJoinMessages) {
      let invalidJoinResponse = null;
      const keptOpen = handleRuntimeMessage(
        invalidJoinMessage,
        trustedRobloxSender,
        (response) => {
          invalidJoinResponse = response;
        }
      );
      if (
        keptOpen !== false ||
        invalidJoinResponse?.ok !== false ||
        invalidJoinResponse?.code !== "failed" ||
        Object.hasOwn(invalidJoinResponse || {}, "accessCode")
      ) {
        fail("Invalid private-server join input reached the launcher");
        return;
      }
    }
    if (requestStats.privateServerJoinInjections !== joinInjectionsBeforeInvalid) {
      fail("Invalid private-server join input caused a MAIN-world injection");
      return;
    }

    let foreignExtensionResponded = false;
    const foreignExtensionKeptOpen = handleRuntimeMessage(
      {
        type: "rsl:join-private-server",
        requestId: 524,
        placeId: "123",
        accessCode: PRIVATE_SERVER_JOIN_FIXTURE_ACCESS_CODE
      },
      { ...trustedRobloxSender, id: "foreign-extension" },
      () => {
        foreignExtensionResponded = true;
      }
    );
    if (foreignExtensionKeptOpen || foreignExtensionResponded) {
      fail("A foreign extension sender reached private-server message handling");
      return;
    }

    let invalidPrivateResponse = null;
    const invalidPrivateKeptOpen = privateServerHooks.handlePrivateServerListMessage(
      {
        type: "rsl:get-private-servers",
        placeId: "9007199254740992",
        cursor: "x".repeat(2_049),
        requestId: -1
      },
      (response) => {
        invalidPrivateResponse = response;
      }
    );
    if (
      invalidPrivateKeptOpen ||
      invalidPrivateResponse?.ok !== false ||
      invalidPrivateResponse?.code !== "INVALID"
    ) {
      fail("Private-server messages accepted unsafe IDs, request IDs, or cursors");
      return;
    }

    const privateErrorModes = new Map([
      ["unauthenticated", "UNAUTHENTICATED"],
      ["forbidden", "FORBIDDEN"],
      ["rate-limited", "RATE_LIMITED"],
      ["unavailable", "ROBLOX_UNAVAILABLE"],
      ["network", "NETWORK"],
      ["malformed", "ROBLOX_UNAVAILABLE"]
    ]);
    for (const [mode, expectedCode] of privateErrorModes) {
      privateServerListMode = mode;
      const { response: privateErrorResponse } = await dispatchBackgroundMessage({
        type: "rsl:get-private-servers",
        placeId: "123",
        requestId: 400 + requestStats.privateServerListRequests
      });
      if (
        privateErrorResponse?.ok !== false ||
        privateErrorResponse?.code !== expectedCode
      ) {
        fail(`Private-server ${mode} error mapped to ${privateErrorResponse?.code}`);
        return;
      }
    }
    privateServerListMode = "mixed";
    await privateServerHooks.resetPrivateServerStateForTests();

    const randomServerHooks = globalThis.__rslBackgroundTestHooks;
    randomServerHooks.resetRandomServerStateForTests();
    randomServerMode = "mixed";
    const randomRequestsBefore = requestStats.randomServerRequests;
    const [firstCandidates, deduplicatedCandidates] = await Promise.all([
      randomServerHooks.getRandomServerCandidates("1234"),
      randomServerHooks.getRandomServerCandidates("1234")
    ]);
    const expectedCandidates =
      "11111111-2222-3333-4444-555555555555|" +
      "12345678-90ab-cdef-1234-567890abcdef";
    if (
      firstCandidates.join("|") !== expectedCandidates ||
      deduplicatedCandidates.join("|") !== expectedCandidates ||
      requestStats.randomServerRequests !== randomRequestsBefore + 1
    ) {
      fail("Random Server did not filter malformed/full servers or deduplicate its request");
      return;
    }

    if (
      requestStats.randomServerLastUrl !==
        "https://games.roblox.com/v1/games/1234/servers/Public?sortOrder=Asc&excludeFullGames=true&limit=100" ||
      requestStats.randomServerMethod !== "GET" ||
      requestStats.randomServerCredentials !== "include" ||
      requestStats.randomServerCache !== "no-store" ||
      requestStats.randomServerAccept !== "application/json" ||
      !requestStats.randomServerHadSignal
    ) {
      fail(
        "Random Server request did not use the exact authenticated, no-store Roblox endpoint contract"
      );
      return;
    }

    const cachedRandomServer = await randomServerHooks.getRandomPublicServer("1234");
    if (
      !firstCandidates.includes(cachedRandomServer.gameInstanceId) ||
      cachedRandomServer.placeId !== "1234" ||
      requestStats.randomServerRequests !== randomRequestsBefore + 1
    ) {
      fail("Random Server did not select a validated cached candidate");
      return;
    }

    const randomServerMessageResponse = await new Promise((resolve, reject) => {
      const keptOpen = randomServerHooks.handleRandomServerMessage(
        {
          type: "rsl:get-random-public-server",
          placeId: "1234",
          requestId: 77
        },
        resolve
      );
      if (!keptOpen) {
        reject(new Error("Valid Random Server message did not keep its response channel open"));
      }
    });
    if (
      randomServerMessageResponse.ok !== true ||
      randomServerMessageResponse.requestId !== 77 ||
      randomServerMessageResponse.placeId !== "1234" ||
      !firstCandidates.includes(randomServerMessageResponse.gameInstanceId) ||
      requestStats.randomServerRequests !== randomRequestsBefore + 1
    ) {
      fail("Random Server message returned an invalid or uncached result");
      return;
    }

    let invalidRandomServerResponse = null;
    const invalidKeptOpen = randomServerHooks.handleRandomServerMessage(
      {
        type: "rsl:get-random-public-server",
        placeId: "9007199254740992",
        requestId: -1
      },
      (response) => {
        invalidRandomServerResponse = response;
      }
    );
    if (
      invalidKeptOpen ||
      invalidRandomServerResponse?.ok !== false ||
      invalidRandomServerResponse?.code !== "INVALID"
    ) {
      fail("Random Server accepted an unsafe Place ID or request ID");
      return;
    }

    randomServerHooks.resetRandomServerStateForTests();
    randomServerMode = "rate-limited";
    const requestsBeforeRateLimit = requestStats.randomServerRequests;
    let firstRateLimitCode = "";
    let cooldownRateLimitCode = "";
    try {
      await randomServerHooks.getRandomPublicServer("1234");
    } catch (error) {
      firstRateLimitCode = error?.code || "";
    }
    try {
      await randomServerHooks.getRandomPublicServer("5678");
    } catch (error) {
      cooldownRateLimitCode = error?.code || "";
    }
    if (
      firstRateLimitCode !== "RATE_LIMITED" ||
      cooldownRateLimitCode !== "RATE_LIMITED" ||
      requestStats.randomServerRequests !== requestsBeforeRateLimit + 1
    ) {
      fail("Random Server retried a 429 or ignored its Retry-After cooldown");
      return;
    }

    randomServerHooks.resetRandomServerStateForTests();
    randomServerMode = "empty";
    let noServersCode = "";
    try {
      await randomServerHooks.getRandomPublicServer("1234");
    } catch (error) {
      noServersCode = error?.code || "";
    }
    randomServerHooks.resetRandomServerStateForTests();
    randomServerMode = "malformed-payload";
    let unavailableCode = "";
    try {
      await randomServerHooks.getRandomPublicServer("1234");
    } catch (error) {
      unavailableCode = error?.code || "";
    }
    if (noServersCode !== "NO_SERVERS" || unavailableCode !== "ROBLOX_UNAVAILABLE") {
      fail(`Random Server error mapping was incorrect: ${noServersCode}/${unavailableCode}`);
      return;
    }
    randomServerHooks.resetRandomServerStateForTests();
    randomServerMode = "mixed";

    document.body.dataset.testResult = "pass";
    document.body.dataset.testMessage = "Complete background aggregation passed";
    document.body.dataset.requestStats = JSON.stringify(requestStats);
    document.title = "PASS: Complete background aggregation fixture";
    globalThis.fetch = originalFetch;
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
});
document.body.append(backgroundScript);
