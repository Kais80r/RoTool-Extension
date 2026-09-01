"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

const projectRoot = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(projectRoot, "background.js"), "utf8");
const manifest = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "manifest.json"), "utf8")
);
const fetchCalls = [];
const sentTabMessages = [];
let usernameMode = "ready";
let authenticatedViewerMode = "other";
let badgeMode = "single";
let inventoryCanView = true;
let targetFriendsVisible = true;
let targetFriendsFailureStatus = null;
let targetFriendsNetworkFailure = false;
let ownedGroupGameMode = "ready";
let extraOwnedGroupCount = 0;
let extraMutualGroupCount = 0;
let extraMutualFriendCount = 0;
let targetFriendCountOverride = null;
let targetFriendCountMismatchResponses = 0;
let targetUnavailableFriendCount = 0;

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

async function fixtureFetch(input, options = {}) {
  const url = new URL(String(input));
  const requestHeaders = new Headers(options.headers || {});
  fetchCalls.push({
    url: url.href,
    credentials: options.credentials || "",
    csrfToken: requestHeaders.get("x-csrf-token") || "",
    body: typeof options.body === "string" ? options.body : null
  });

  if (url.hostname === "users.roblox.com" && url.pathname === "/v1/users/123") {
    return json({
      id: 123,
      name: "FixtureUser",
      displayName: "Fixture Display",
      description: "Public <img src=x> bio\u0000\nSecond line",
      created: "2018-04-03T12:34:56.000Z",
      hasVerifiedBadge: true,
      isBanned: false,
      secretField: "must-not-leak"
    });
  }
  if (
    url.hostname === "users.roblox.com" &&
    url.pathname === "/v1/users/authenticated"
  ) {
    if (authenticatedViewerMode === "missing") {
      return json({ errors: [{ code: 0 }] }, 401);
    }
    return json({ id: authenticatedViewerMode === "own" ? 123 : 999 });
  }
  if (url.hostname === "users.roblox.com" && url.pathname === "/v1/users") {
    const requestedIds = JSON.parse(options.body || "{}").userIds || [];
    return json({
      data: requestedIds.map((id) => ({
        id,
        name: id === 456 ? "FriendUser" : `User${id}`,
        displayName: id === 456 ? "Friend Display" : `Display ${id}`,
        hasVerifiedBadge: id === 456
      }))
    });
  }
  if (
    url.hostname === "apis.roblox.com" &&
    url.pathname === "/user-profile-api/v1/user/profiles/get-profiles"
  ) {
    return json({
      profileDetails: [{
        userId: 123,
        isVerified: true,
        hasRobloxSubscription: true,
        names: { username: "FixtureUser", combinedName: "Fixture Display" }
      }]
    });
  }
  if (
    url.hostname === "presence.roblox.com" &&
    url.pathname === "/v1/presence/users"
  ) {
    return json({
      userPresences: [{
        userId: 123,
        userPresenceType: 2,
        lastLocation: "Fixture Experience",
        placeId: 1001,
        rootPlaceId: 1001,
        universeId: 100,
        gameId: "11111111-2222-4333-8444-555555555555",
        lastOnline: "2026-08-29T15:30:00.000Z",
        privateToken: "must-not-leak"
      }]
    });
  }
  if (url.hostname === "friends.roblox.com" && /\/count$/.test(url.pathname)) {
    const transientTargetFriendMismatch =
      url.pathname === "/v1/users/123/friends/count" &&
      targetFriendCountMismatchResponses > 0;
    if (transientTargetFriendMismatch) targetFriendCountMismatchResponses -= 1;
    const count =
      transientTargetFriendMismatch
        ? 5 + extraMutualFriendCount
        : url.pathname === "/v1/users/123/friends/count" &&
      Number.isSafeInteger(targetFriendCountOverride)
        ? targetFriendCountOverride
        : url.pathname === "/v1/users/123/friends/count"
          ? 4 + extraMutualFriendCount + targetUnavailableFriendCount
        : url.pathname.includes("followers")
      ? 345
      : url.pathname.includes("followings")
        ? 67
        : 89;
    return json({ count });
  }
  if (
    url.hostname === "users.roblox.com" &&
    url.pathname === "/v1/users/123/username-history"
  ) {
    return usernameMode === "ready"
      ? json({ data: [{ name: "OldFixture" }, { name: "OlderFixture" }] })
      : json({ malformed: true });
  }
  if (
    url.hostname === "friends.roblox.com" &&
    url.pathname === "/v1/users/999/friends/find"
  ) {
    return url.searchParams.get("cursor") === "viewer-page-2"
      ? json({ PageItems: [{ id: 901, name: "Viewer Friend 901" }], NextCursor: null })
      : json({
          PageItems: [
            { id: 123, name: "FixtureUser", displayName: "Fixture Display" },
            { id: 456, name: "FriendUser", displayName: "Friend Display" },
            { id: 888, name: "User888", displayName: "Display 888" },
            { id: 777, name: "Viewer Friend 777" },
            ...Array.from({ length: extraMutualFriendCount }, (_, index) => ({
              id: 10000 + index,
              name: `SharedUser${index + 1}`,
              displayName: `Shared User ${index + 1}`
            }))
          ],
          NextCursor: "viewer-page-2"
        });
  }
  if (
    url.hostname === "friends.roblox.com" &&
    url.pathname === "/v1/users/123/friends/find"
  ) {
    if (targetFriendsNetworkFailure) {
      throw new TypeError("Target friend-list network failure");
    }
    if (targetFriendsFailureStatus !== null) {
      return json({ errors: [{ message: "Friends unavailable" }] }, targetFriendsFailureStatus);
    }
    if (!targetFriendsVisible) {
      return json({ PageItems: [], NextCursor: null });
    }
    return url.searchParams.get("cursor") === "target-page-2"
      ? json({ PageItems: [{ id: 655, name: "Target Friend 655" }], NextCursor: null })
      : json({
          PageItems: [
            { id: 456, name: "FriendUser", displayName: "Friend Display" },
            { id: 888, name: "User888", displayName: "Display 888" },
            { id: 654, name: "Target Friend 654" },
            ...Array.from({ length: extraMutualFriendCount }, (_, index) => ({
              id: 10000 + index,
              name: `SharedUser${index + 1}`,
              displayName: `Shared User ${index + 1}`
            })),
            ...Array.from({ length: targetUnavailableFriendCount }, () => ({
              id: -1,
              isDeleted: true
            }))
          ],
          NextCursor: "target-page-2"
        });
  }
  if (
    url.hostname === "friends.roblox.com" &&
    url.pathname === "/v1/users/999/friends"
  ) {
    return json({
      data: [
        { id: 123, name: "FixtureUser", displayName: "Fixture Display" },
        { id: 456, name: "FriendUser", displayName: "Friend Display" },
        { id: 888, name: "User888", displayName: "Display 888" }
      ]
    });
  }
  if (
    url.hostname === "friends.roblox.com" &&
    url.pathname === "/v1/users/123/friends"
  ) {
    return json({
      data: [{
        id: 456,
        rawPrivateValue: "must-not-leak"
      }]
    });
  }
  if (
    url.hostname === "avatar.roblox.com" &&
    url.pathname === "/v1/users/123/avatar"
  ) {
    return json({
      assets: [
        {
          id: 7001,
          name: "Avatar Fixture Hat",
          assetType: { id: 8, name: "Hat" }
        },
        {
          id: 7002,
          name: "Avatar Fixture Mask",
          assetType: { id: 8, name: "Hat" }
        },
        {
          id: 7004,
          name: "Fixture Unpriced Animation",
          assetType: { id: 50, name: "FallAnimation" }
        },
        {
          id: 7101,
          name: "Fixture Pack Idle",
          assetType: { id: 51, name: "IdleAnimation" }
        },
        {
          id: 7102,
          name: "Fixture Pack Run",
          assetType: { id: 53, name: "RunAnimation" }
        }
      ],
      emotes: [
        { assetId: 7003, assetName: "Fixture Emote", position: 1 },
        { assetId: 7005, assetName: "Fixture Free Emote", position: 2 }
      ]
    });
  }
  if (
    url.hostname === "avatar.roblox.com" &&
    url.pathname === "/v1/users/123/currently-wearing"
  ) {
    return json({ assetIds: [7001, 7002] });
  }
  if (
    url.hostname === "catalog.roblox.com" &&
    url.pathname === "/v1/assets/7101/bundles"
  ) {
    return json({
      data: [{
        id: 9001,
        name: "Fixture Animation Pack",
        bundleType: "AvatarAnimations",
        items: [
          { id: 7101, name: "Fixture Pack Idle", type: "Asset", assetType: 51 },
          { id: 7102, name: "Fixture Pack Run", type: "Asset", assetType: 53 },
          { id: 9901, name: "Fixture Outfit", type: "UserOutfit" }
        ]
      }, {
        id: 9002,
        name: "Incomplete Fixture Pack",
        bundleType: "AvatarAnimations",
        items: [
          { id: 7101, name: "Fixture Pack Idle", type: "Asset", assetType: 51 },
          { id: 7199, name: "Not Equipped", type: "Asset", assetType: 53 }
        ]
      }]
    });
  }
  if (
    url.hostname === "catalog.roblox.com" &&
    url.pathname === "/v1/catalog/items/details"
  ) {
    if (requestHeaders.get("x-csrf-token") !== "fixture-csrf-token") {
      return new Response(JSON.stringify({ errors: [{ code: 0 }] }), {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": "fixture-csrf-token"
        }
      });
    }
    const requestedItems = JSON.parse(options.body).items;
    return json({
      data: requestedItems.map(({ id, itemType }) => {
        if (itemType === "Bundle" && id === 9001) {
          return {
            id,
            name: "Fixture Animation Pack",
            price: 100,
            itemType: "Bundle"
          };
        }
        if (id === 7001) {
          return { id, name: "Fixture Hat", price: 72, itemType: "Asset" };
        }
        if (id === 7002) {
          return {
            id,
            name: "Fixture Mask",
            price: 999,
            priceStatus: "Off Sale",
            isOffSale: true,
            itemType: "Asset"
          };
        }
        if (id === 7004) {
          return {
            id,
            name: "Fixture Unpriced Animation",
            price: null,
            priceStatus: null,
            isOffSale: true,
            itemType: "Asset"
          };
        }
        if (id === 7005) {
          return {
            id,
            name: "Fixture Free Emote",
            price: 0,
            priceStatus: "Free",
            itemType: "Asset"
          };
        }
        return { id, name: "Fixture Emote", price: 136, itemType: "Asset" };
      })
    });
  }
  if (
    url.hostname === "catalog.roblox.com" &&
    /^\/v1\/catalog\/items\/(7001|7002|7003)\/details$/.test(url.pathname)
  ) {
    const id = Number(url.pathname.split("/")[4]);
    return json(
      id === 7001
        ? { id, name: "Fixture Hat", price: 72, itemType: "Asset" }
        : id === 7002
          ? { id, name: "Fixture Mask", price: 999, isOffSale: true, itemType: "Asset" }
          : { id, name: "Fixture Emote", price: 136, itemType: "Asset" }
    );
  }
  if (
    url.hostname === "groups.roblox.com" &&
    url.pathname === "/v2/users/123/groups/roles"
  ) {
    return json({
      data: [
        {
          group: {
            id: 8001,
            name: "Fixture Community",
            memberCount: 1200,
            hasVerifiedBadge: true
          },
          role: { name: "Owner", rank: 255 }
        },
        {
          group: {
            id: 8001,
            name: "Fixture Community",
            memberCount: 1200,
            hasVerifiedBadge: true
          },
          role: { name: "Member", rank: 1 }
        },
        {
          group: {
            id: 8003,
            name: "Target Community",
            memberCount: 80,
            hasVerifiedBadge: false
          },
          role: { name: "Member", rank: 1 }
        },
        ...Array.from({ length: extraMutualGroupCount }, (_, index) => ({
          group: {
            id: 8200 + index,
            name: `Shared Community ${index + 1}`,
            memberCount: 200 + index,
            hasVerifiedBadge: false
          },
          role: { name: "Moderator", rank: 100 }
        })),
        ...Array.from({ length: extraOwnedGroupCount }, (_, index) => ({
          group: {
            id: 8100 + index,
            name: `Extra Owned Community ${index + 1}`,
            memberCount: 10 + index,
            hasVerifiedBadge: false
          },
          role: { name: "Owner", rank: 255 }
        }))
      ]
    });
  }
  if (
    url.hostname === "groups.roblox.com" &&
    url.pathname === "/v2/users/999/groups/roles"
  ) {
    return json({
      data: [
        {
          group: {
            id: 8001,
            name: "Fixture Community",
            memberCount: 1200,
            hasVerifiedBadge: true
          },
          role: { name: "Member", rank: 1 }
        },
        {
          group: {
            id: 8002,
            name: "Viewer Community",
            memberCount: 30,
            hasVerifiedBadge: false
          },
          role: { name: "Owner", rank: 255 }
        },
        ...Array.from({ length: extraMutualGroupCount }, (_, index) => ({
          group: {
            id: 8200 + index,
            name: `Shared Community ${index + 1}`,
            memberCount: 200 + index,
            hasVerifiedBadge: false
          },
          role: { name: "Member", rank: 1 }
        }))
      ]
    });
  }
  if (
    url.hostname === "badges.roblox.com" &&
    url.pathname === "/v1/users/123/badges"
  ) {
    if (badgeMode === "private") {
      return json({ errors: [{ message: "Badges are private" }] }, 403);
    }
    if (badgeMode === "empty") {
      return json({ data: [], nextPageCursor: null });
    }
    if (badgeMode === "multipage" || badgeMode === "rate-limited") {
      const cursor = url.searchParams.get("cursor") || "";
      const page = cursor ? Number(cursor.split("-").pop()) : 0;
      if (badgeMode === "rate-limited" && page === 1) {
        return new Response(JSON.stringify({ errors: [{ code: 0 }] }), {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "30"
          }
        });
      }
      const pageLength = page === 3 ? 50 : 100;
      return json({
        data: Array.from({ length: pageLength }, (_, index) => ({
          id: 10_000 + page * 100 + index,
          displayName: `Badge ${page}-${index}`,
          description: "Badge"
        })),
        nextPageCursor: page === 3 ? null : `badge-page-${page + 1}`
      });
    }
    return json({
      data: [{ id: 9001, displayName: "Fixture Badge", description: "Badge" }],
      nextPageCursor: null
    });
  }
  if (
    url.hostname === "inventory.roblox.com" &&
    url.pathname === "/v1/users/123/can-view-inventory"
  ) {
    return json({ canView: inventoryCanView });
  }
  if (
    url.hostname === "apis.roblox.com" &&
    url.pathname === "/platform-chat-api/v1/metadata"
  ) {
    return json({ isChatUserMessagesEnabled: true });
  }
  if (
    url.hostname === "games.roblox.com" &&
    /^\/v2\/groups\/(8001|81\d{2})\/gamesV2$/.test(url.pathname)
  ) {
    assert.equal(url.searchParams.get("accessFilter"), "2");
    assert.equal(url.searchParams.get("limit"), "50");
    assert.equal(url.searchParams.get("sortOrder"), "Desc");
    const groupId = Number(url.pathname.split("/")[3]);
    if (groupId === 8001 && ownedGroupGameMode === "failure") {
      return json({ errors: [{ message: "Group games unavailable" }] }, 503);
    }
    if (groupId !== 8001) {
      return json({ data: [], nextPageCursor: null });
    }
    const game = {
      id: 300,
      name: "Owned Group Fixture",
      description: "Owned through Fixture Community",
      creator: { id: 8001, type: "Group" },
      rootPlace: { id: 3001, type: "Place" },
      created: "2024-01-02T00:00:00.000Z",
      updated: "2026-08-29T00:00:00.000Z",
      placeVisits: 3000
    };
    return json({
      data: [game, { ...game }],
      nextPageCursor:
        ownedGroupGameMode === "paginated" ? "group-page-2" : null
    });
  }
  if (
    url.hostname === "games.roblox.com" &&
    url.pathname === "/v2/users/123/games"
  ) {
    const staleTransferredGame = {
      id: 300,
      name: "Stale personal ownership",
      description: "Must not hide the valid group-owned candidate",
      creator: { id: 123, type: "User" },
      rootPlace: { id: 3001 },
      created: "2025-01-01T00:00:00.000Z"
    };
    return json({
      data: [{
        id: 100,
        name: "Created Fixture",
        description: "Original created description",
        creator: { id: 123, type: "User" },
        rootPlace: { id: 1001 },
        created: "2020-01-01T00:00:00.000Z"
      }, ...(ownedGroupGameMode === "transfer"
        ? [staleTransferredGame]
        : [])]
    });
  }
  if (
    url.hostname === "games.roblox.com" &&
    url.pathname === "/v2/users/123/favorite/games"
  ) {
    return json({
      data: [{
        id: 200,
        name: "Favorite Fixture",
        description: "Original favorite description",
        creator: { id: 456, type: "User" },
        rootPlace: { id: 2001 },
        created: "2021-01-01T00:00:00.000Z"
      }]
    });
  }
  if (url.hostname === "games.roblox.com" && url.pathname === "/v1/games") {
    const ids = (url.searchParams.get("universeIds") || "").split(",");
    return json({
      data: ids.filter(Boolean).map((id) => ({
        id: Number(id),
        rootPlaceId: id === "100" ? 1001 : id === "300" ? 3001 : 2001,
        name: id === "100"
          ? "Lokalisierte Erstellung"
          : id === "300"
            ? "Lokalisierte Gruppenerstellung"
            : "Lokalisierter Favorit",
        description: `Localized description ${id}`,
        creator: id === "300"
          ? { id: 8001, name: "Fixture Community", type: "Group", hasVerifiedBadge: true }
          : id === "100"
            ? { id: 123, name: "FixtureUser", type: "User", hasVerifiedBadge: true }
            : { id: 456, name: "FriendUser", type: "User", hasVerifiedBadge: true },
        playing: id === "100" ? 12 : id === "300" ? 8 : 4,
        visits: id === "100" ? 1000 : id === "300" ? 3000 : 2000,
        favoritedCount: id === "100" ? 50 : id === "300" ? 30 : 70,
        maxPlayers: 20,
        created: "2020-01-01T00:00:00.000Z",
        updated: "2026-08-28T10:00:00.000Z",
        genre: "Adventure",
        internalOnly: "must-not-leak"
      }))
    });
  }
  if (
    url.hostname === "games.roblox.com" &&
    url.pathname === "/v1/games/votes"
  ) {
    const ids = (url.searchParams.get("universeIds") || "").split(",");
    return json({
      data: ids.filter(Boolean).map((id) => ({
        id: Number(id),
        upVotes: 9,
        downVotes: 1
      }))
    });
  }
  if (url.hostname === "thumbnails.roblox.com") {
    const parameter =
      url.searchParams.get("userIds") ||
      url.searchParams.get("universeIds") ||
      url.searchParams.get("assetIds") ||
      url.searchParams.get("bundleIds") ||
      url.searchParams.get("groupIds") ||
      url.searchParams.get("badgeIds") ||
      "";
    return json({
      data: parameter.split(",").filter(Boolean).map((id) => ({
        targetId: Number(id),
        state: "Completed",
        imageUrl: `https://tr.rbxcdn.com/fixture-${url.pathname.split("/").pop()}-${id}.webp`
      }))
    });
  }
  throw new Error(`Unexpected fixture request: ${url.href}`);
}

function makeStorage() {
  const values = {};
  return {
    get(keys, callback) {
      const result = typeof keys === "object" && keys !== null
        ? { ...keys, ...values }
        : { [keys]: values[keys] };
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
    onMessage: { addListener() {} },
    getURL(file) { return `chrome-extension://fixture-extension/${file}`; }
  },
  contextMenus: {
    create(_value, callback) { callback?.(); },
    removeAll(callback) { callback?.(); },
    onClicked: { addListener() {} }
  },
  storage: {
    local: makeStorage(),
    session: makeStorage(),
    onChanged: { addListener() {} }
  },
  tabs: {
    sendMessage(tabId, message, options, callback) {
      const done = typeof options === "function" ? options : callback;
      sentTabMessages.push({ tabId, message, options });
      done?.({ ok: true });
      return Promise.resolve({ ok: true });
    },
    create() { return Promise.resolve(); }
  },
  alarms: {
    create() {},
    clear() { return Promise.resolve(true); },
    onAlarm: { addListener() {} }
  },
  scripting: { executeScript() { return Promise.resolve([]); } }
};

const sandbox = {
  URL,
  Response,
  Headers,
  AbortController,
  TextDecoder,
  TextEncoder,
  crypto: webcrypto,
  console,
  chrome,
  fetch: fixtureFetch,
  setTimeout,
  clearTimeout,
  queueMicrotask,
  globalThis: null,
  __rslBackgroundTestHooks: {}
};
sandbox.globalThis = sandbox;
vm.runInContext(source, vm.createContext(sandbox), { filename: "background.js" });

const hooks = sandbox.__rslBackgroundTestHooks;
assert.ok(
  manifest.host_permissions.includes("https://inventory.roblox.com/*"),
  "the public inventory visibility endpoint must be explicitly allowlisted"
);
assert.equal(
  manifest.host_permissions.includes("https://*.roblox.com/*"),
  false,
  "new profile APIs must not broaden access to every Roblox subdomain"
);
assert.equal(
  hooks.parseEnhancedProfileRouteUrl(
    "https://www.roblox.com/de/users/123/profile?x=1#about"
  ),
  "123"
);
assert.equal(
  hooks.parseEnhancedProfileRouteUrl("https://www.roblox.com/users/123"),
  "123"
);
assert.equal(
  hooks.parseEnhancedProfileRouteUrl("https://evil.example/users/123/profile"),
  null
);
assert.equal(
  hooks.parseEnhancedProfileRouteUrl("https://www.roblox.com/users/123/inventory"),
  null
);
assert.equal(
  hooks.parseMutualFriendsPageRouteUrl(
    "https://www.roblox.com/de/users/123/friends#!/friends?rotool=mutuals"
  ),
  "123"
);
assert.equal(
  hooks.parseMutualFriendsPageRouteUrl(
    "https://www.roblox.com/users/123/friends#!/friends"
  ),
  null
);
assert.equal(
  hooks.parseMutualFriendsPageRouteUrl(
    "https://www.roblox.com/users/123/friends#!/friends#mutuals"
  ),
  "123",
  "RoPro's legacy Mutual Friends route should hand over to RoTool"
);
assert.equal(
  hooks.parseMutualFriendsPageRouteUrl(
    "https://www.roblox.com/users/123/friends#!/unknown"
  ),
  null
);
assert.equal(
  hooks.parseMutualFriendsPageRouteUrl(
    "https://evil.example/users/123/friends#!/friends?rotool=mutuals"
  ),
  null
);
assert.equal(
  hooks.normalizeEnhancedProfileGame(
    {
      id: 300,
      name: "Mismatched creator",
      rootPlace: { id: 3001 },
      creator: { id: 8002, type: "Group" }
    },
    null,
    null,
    null,
    {
      creatorType: "Group",
      creatorId: "8001",
      creatorName: "Fixture Community"
    }
  ),
  null,
  "an owned-group game must be discarded when Roblox returns a different creator"
);
assert.equal(
  hooks.normalizeEnhancedProfileGame(
    {
      id: 301,
      name: "Masked mismatched creator",
      rootPlace: { id: 3011 },
      creator: { id: 8002, type: "Group" }
    },
    { id: 301, creator: {} },
    null,
    null,
    {
      creatorType: "Group",
      creatorId: "8001",
      creatorName: "Fixture Community"
    }
  ),
  null,
  "an empty detail creator must not mask a mismatched source creator"
);

const trustedSender = {
  id: "fixture-extension",
  frameId: 0,
  frameType: "outermost_frame",
  documentLifecycle: "active",
  url: "https://www.roblox.com/de/users/123/profile",
  tab: {
    id: 7,
    active: true,
    url: "https://www.roblox.com/de/users/123/profile"
  }
};

const trustedMutualFriendsSender = {
  ...trustedSender,
  url: "https://www.roblox.com/de/users/123/friends#!/friends?rotool=mutuals",
  tab: {
    ...trustedSender.tab,
    url: "https://www.roblox.com/de/users/123/friends#!/friends?rotool=mutuals"
  }
};

function dispatch(message, sender = trustedSender) {
  return new Promise((resolve, reject) => {
    const keptOpen = hooks.handleEnhancedProfileMessage(
      message,
      sender,
      resolve
    );
    if (!keptOpen) reject(new Error("Valid profile request was rejected"));
  });
}

function dispatchFast(message, sender = trustedSender) {
  return new Promise((resolve, reject) => {
    const keptOpen = hooks.handleEnhancedProfileFastMessage(
      message,
      sender,
      resolve
    );
    if (!keptOpen) reject(new Error("Valid fast profile request was rejected"));
  });
}

function dispatchRelationships(message, sender = trustedSender) {
  return new Promise((resolve, reject) => {
    const keptOpen = hooks.handleEnhancedProfileRelationshipsMessage(
      message,
      sender,
      resolve
    );
    if (!keptOpen) reject(new Error("Valid relationships request was rejected"));
  });
}

function dispatchMutualFriends(
  message,
  sender = trustedMutualFriendsSender
) {
  return new Promise((resolve, reject) => {
    const keptOpen = hooks.handleMutualFriendsPageMessage(
      message,
      sender,
      resolve
    );
    if (!keptOpen) reject(new Error("Valid mutual-friends request was rejected"));
  });
}

function dispatchJoin(message, sender = trustedSender) {
  return new Promise((resolve, reject) => {
    const keptOpen = hooks.handleEnhancedProfileJoinMessage(
      message,
      sender,
      resolve
    );
    if (!keptOpen) reject(new Error("Valid profile Join request was rejected"));
  });
}

function dispatchBadgeCount(message, sender = trustedSender) {
  return new Promise((resolve, reject) => {
    const keptOpen = hooks.handleEnhancedProfileBadgeCountMessage(
      message,
      sender,
      resolve
    );
    if (!keptOpen) reject(new Error("Valid badge-count request was rejected"));
  });
}

(async () => {
  hooks.clearEnhancedProfileCacheForTests();
  const first = hooks.getEnhancedProfile("123");
  const second = hooks.getEnhancedProfile("123");
  const [profile, concurrentProfile] = await Promise.all([first, second]);
  assert.equal(concurrentProfile.sections.identity.data.username, "FixtureUser");
  assert.equal(profile.sections.identity.status, "ready");
  assert.equal(profile.sections.identity.data.username, "FixtureUser");
  assert.equal(profile.sections.identity.data.isVerified, true);
  assert.equal(profile.sections.identity.data.isRobloxPlus, true);
  assert.equal(
    profile.sections.identity.data.createdAt,
    "2018-04-03T12:34:56.000Z"
  );
  assert.equal(profile.sections.presence.data.type, "game");
  assert.equal(profile.sections.counts.data.followers, 345);
  assert.deepEqual(
    Array.from(profile.sections.usernames.data.items),
    ["OldFixture", "OlderFixture"]
  );
  const personalGame = profile.sections.experiences.data.items.find(
    (game) => game.universeId === "100"
  );
  const ownedGroupGame = profile.sections.experiences.data.items.find(
    (game) => game.universeId === "300"
  );
  assert.equal(personalGame.ratingPercent, 90);
  assert.equal(profile.sections.experiences.data.totalCount, 2);
  assert.equal(profile.sections.experiences.data.countIsExact, true);
  assert.equal(profile.sections.experiences.data.coverageIsComplete, true);
  assert.equal(profile.sections.experiences.data.coverageStatus, "complete");
  assert.equal(personalGame.name, "Created Fixture");
  assert.equal(
    personalGame.description,
    "Original created description"
  );
  assert.equal(personalGame.creatorType, "User");
  assert.equal(personalGame.creatorId, "123");
  assert.equal(personalGame.creatorName, "FixtureUser");
  assert.equal(ownedGroupGame.name, "Owned Group Fixture");
  assert.equal(ownedGroupGame.description, "Owned through Fixture Community");
  assert.equal(ownedGroupGame.creatorType, "Group");
  assert.equal(ownedGroupGame.creatorId, "8001");
  assert.equal(ownedGroupGame.creatorName, "Fixture Community");
  assert.equal(ownedGroupGame.creatorIsVerified, true);
  assert.equal(profile.sections.favorites.data.items[0].rootPlaceId, "2001");
  assert.equal(profile.sections.favorites.data.totalCount, 1);
  assert.equal(profile.sections.favorites.data.countIsExact, true);
  assert.equal(profile.sections.favorites.data.items[0].name, "Favorite Fixture");
  assert.equal(
    profile.sections.favorites.data.items[0].description,
    "Original favorite description"
  );
  assert.equal(profile.sections.friends.data.items[0].userId, "456");
  const wearingItems = profile.sections.wearing.data.items;
  assert.deepEqual(
    Array.from(wearingItems, (item) => item.name),
    [
      "Fixture Emote",
      "Fixture Animation Pack",
      "Fixture Hat",
      "Fixture Unpriced Animation",
      "Fixture Free Emote",
      "Fixture Mask"
    ],
    "wearing items should use Roblox's priced, unlabeled, Free, and Off Sale buckets"
  );
  const bundleItem = wearingItems.find(
    (item) => item.name === "Fixture Animation Pack"
  );
  assert.equal(bundleItem.itemType, "Bundle");
  assert.equal(bundleItem.itemId, "9001");
  assert.equal(bundleItem.assetId, null);
  assert.equal(bundleItem.price, 100);
  assert.equal(
    wearingItems.some((item) => item.itemId === "7101" || item.itemId === "7102"),
    false,
    "a complete equipped bundle should replace its individual component assets"
  );
  assert.equal(
    wearingItems.some((item) => item.itemId === "9002"),
    false,
    "a partially equipped bundle must not replace its individual assets"
  );
  const hatItem = wearingItems.find((item) => item.name === "Fixture Hat");
  assert.equal(hatItem.itemType, "Asset");
  assert.equal(hatItem.itemId, "7001");
  assert.equal(hatItem.assetId, "7001");
  const unpricedItem = wearingItems.find(
    (item) => item.name === "Fixture Unpriced Animation"
  );
  assert.equal(unpricedItem.price, null);
  assert.equal(unpricedItem.priceStatus, null);
  const freeItem = wearingItems.find(
    (item) => item.name === "Fixture Free Emote"
  );
  assert.equal(freeItem.price, null);
  assert.equal(freeItem.priceStatus, "Free");
  const offSaleItem = wearingItems.find(
    (item) => item.name === "Fixture Mask"
  );
  assert.equal(
    offSaleItem.price,
    null,
    "off-sale collectible listings must not be shown as an original purchase price"
  );
  assert.equal(offSaleItem.priceStatus, "Off Sale");
  assert.equal(profile.sections.communities.data.items[0].role, "Owner");
  assert.equal(profile.sections.communities.data.totalCount, 2);
  assert.equal(profile.sections.communities.data.ownedCount, 1);
  assert.deepEqual(
    JSON.parse(JSON.stringify(profile.sections.communities.data.ownedGroups)),
    {
      items: [{
        communityId: "8001",
        name: "Fixture Community",
        memberCount: 1200,
        role: "Owner",
        isVerified: true,
        iconUrl: null
      }],
      hasMore: false
    }
  );
  assert.equal(profile.sections.badges.data.items[0].name, "Fixture Badge");
  assert.equal(profile.sections.badges.data.totalCount, 1);
  assert.equal(profile.sections.badges.data.countIsExact, false);
  assert.equal(profile.sections.badges.data.countStatus, "pending");
  assert.equal(profile.sections.inventory.data.visibility, "public");
  assert.equal(profile.sections.relationships.status, "ready");
  assert.equal(profile.sections.relationships.data.mutualFriendsCount, 2);
  assert.equal(profile.sections.relationships.data.mutualFriendsAvailable, true);
  assert.equal(profile.sections.relationships.data.mutualGroupsCount, 1);
  assert.deepEqual(
    JSON.parse(JSON.stringify(profile.sections.relationships.data.mutualGroups)),
    {
      items: [{
        communityId: "8001",
        name: "Fixture Community",
        memberCount: 1200,
        role: "Owner",
        isVerified: true,
        iconUrl: null
      }],
      hasMore: false
    }
  );
  assert.equal(profile.sections.relationships.data.isFriend, true);
  assert.equal(profile.sections.relationships.data.canChat, true);
  assert.deepEqual(Array.from(profile.sections.relationships.data.items), []);
  assert.equal(profile.sections.relationships.data.hasMore, false);
  assert.doesNotMatch(JSON.stringify(profile), /must-not-leak|privateToken|secretField/);
  assert.doesNotMatch(profile.sections.identity.data.description, /\u0000/);

  const userRequestCount = fetchCalls.filter(
    (call) => call.url === "https://users.roblox.com/v1/users/123"
  ).length;
  assert.equal(userRequestCount, 1, "deduped requests fetched the base profile once");
  assert.equal(
    fetchCalls.filter((call) =>
      call.url === "https://groups.roblox.com/v2/users/123/groups/roles"
    ).length,
    1,
    "base communities, group games, and relationships should share one target group-role request"
  );
  assert.equal(
    fetchCalls.filter((call) =>
      call.url ===
        "https://inventory.roblox.com/v1/users/123/can-view-inventory"
    ).length,
    1,
    "public inventory visibility should share the public profile cache"
  );
  assert.equal(
    fetchCalls.filter((call) =>
      call.url.startsWith(
        "https://friends.roblox.com/v1/users/123/friends/find"
      )
    ).length,
    2,
    "concurrent requests should only share an in-flight relationship scan"
  );
  assert.ok(fetchCalls.some(
    (call) => call.url === "https://users.roblox.com/v1/users/123" &&
      call.credentials === "omit"
  ));
  assert.ok(fetchCalls.some(
    (call) => call.url === "https://presence.roblox.com/v1/presence/users" &&
      call.credentials === "include"
  ));
  assert.ok(fetchCalls.some(
    (call) => call.url === "https://users.roblox.com/v1/users/authenticated" &&
      call.credentials === "include"
  ));
  assert.ok(fetchCalls.some(
    (call) => call.url.startsWith(
      "https://friends.roblox.com/v1/users/999/friends/find"
    ) && call.credentials === "include"
  ));
  assert.ok(fetchCalls.some(
    (call) => call.url.startsWith(
      "https://friends.roblox.com/v1/users/123/friends/find"
    ) && call.credentials === "include"
  ));
  assert.ok(fetchCalls.some(
    (call) => call.url ===
        "https://friends.roblox.com/v1/users/123/friends/count" &&
      call.credentials === "include"
  ));
  assert.ok(fetchCalls.some(
    (call) => call.url ===
        "https://groups.roblox.com/v2/users/999/groups/roles" &&
      call.credentials === "omit"
  ));
  const ownedGroupGameCalls = fetchCalls.filter((call) =>
    call.url.startsWith("https://games.roblox.com/v2/groups/8001/gamesV2?")
  );
  assert.equal(ownedGroupGameCalls.length, 1);
  assert.equal(ownedGroupGameCalls[0].credentials, "omit");
  assert.equal(
    fetchCalls.some((call) =>
      call.url.includes("/v2/groups/8003/gamesV2")
    ),
    false,
    "games from communities where the profile is only a member must stay excluded"
  );
  assert.ok(fetchCalls.some(
    (call) => call.url ===
        "https://inventory.roblox.com/v1/users/123/can-view-inventory" &&
      call.credentials === "omit"
  ));
  assert.ok(fetchCalls.some(
    (call) => call.url ===
        "https://apis.roblox.com/platform-chat-api/v1/metadata" &&
      call.credentials === "include"
  ));
  const catalogBatchCalls = fetchCalls.filter(
    (call) => call.url === "https://catalog.roblox.com/v1/catalog/items/details"
  );
  assert.equal(catalogBatchCalls.length, 2);
  assert.equal(catalogBatchCalls[0].csrfToken, "");
  assert.equal(catalogBatchCalls[1].csrfToken, "fixture-csrf-token");
  assert.ok(catalogBatchCalls.every((call) => call.credentials === "include"));
  const catalogRequestItems = JSON.parse(catalogBatchCalls[1].body).items;
  assert.ok(catalogRequestItems.some(
    (item) => item.itemType === "Bundle" && item.id === 9001
  ));
  assert.equal(catalogRequestItems.some(
    (item) => item.id === 7101 || item.id === 7102
  ), false, "collapsed bundle components must not be fetched as separate cards");
  assert.equal(
    fetchCalls.filter((call) => call.url.startsWith(
      "https://catalog.roblox.com/v1/assets/7101/bundles"
    )).length,
    1,
    "one representative asset should resolve the equipped animation bundle"
  );
  assert.equal(
    fetchCalls.some((call) => /\/v1\/catalog\/items\/700\d\/details/.test(call.url)),
    false,
    "successful catalog batching should avoid rate-limit-prone per-item requests"
  );
  assert.equal(
    fetchCalls.filter(
      (call) => call.url === "https://presence.roblox.com/v1/presence/users"
    ).length,
    2,
    "viewer-dependent presence must be refreshed instead of cached"
  );
  assert.equal(
    fetchCalls.filter(
      (call) => call.url.startsWith(
        "https://badges.roblox.com/v1/users/123/badges"
      )
    ).length,
    2,
    "authenticated badge visibility must be refreshed instead of cached"
  );
  assert.ok(fetchCalls.some(
    (call) => call.url.startsWith(
      "https://badges.roblox.com/v1/users/123/badges"
    ) && call.credentials === "include"
  ));
  const allowedProfileApiOrigins = new Set([
    "https://apis.roblox.com",
    "https://avatar.roblox.com",
    "https://badges.roblox.com",
    "https://catalog.roblox.com",
    "https://friends.roblox.com",
    "https://games.roblox.com",
    "https://groups.roblox.com",
    "https://inventory.roblox.com",
    "https://presence.roblox.com",
    "https://thumbnails.roblox.com",
    "https://users.roblox.com"
  ]);
  assert.ok(
    fetchCalls.every((call) =>
      allowedProfileApiOrigins.has(new URL(call.url).origin)
    ),
    "the profile collector must stay inside its explicit Roblox API allowlist"
  );

  const response = await dispatch({
    type: "rsl:get-enhanced-profile",
    requestId: 9,
    userId: "123"
  });
  assert.equal(response.ok, true);
  assert.equal(response.requestId, 9);
  assert.equal(response.userId, "123");
  const fastResponse = await dispatchFast({
    type: hooks.enhancedProfileConstants.fastMessageType,
    requestId: 91,
    userId: "123"
  });
  assert.equal(fastResponse.ok, true);
  assert.equal(fastResponse.sections.identity.status, "ready");
  assert.equal(fastResponse.sections.relationships.status, "pending");
  assert.match(
    await hooks.getThumbnail("avatar", "123", true),
    /^https:\/\/tr\.rbxcdn\.com\/fixture-avatar-123\.webp$/
  );
  assert.match(
    await hooks.getThumbnail("bundle", "9001", true),
    /^https:\/\/tr\.rbxcdn\.com\/fixture-thumbnails-9001\.webp$/
  );
  assert.equal(
    fetchCalls.filter((call) =>
      call.url.startsWith(
        "https://friends.roblox.com/v1/users/123/friends/find"
      )
    ).length,
    4,
    "viewer-dependent relationships must refresh outside the public cache"
  );
  assert.equal(
    fetchCalls.filter((call) =>
      call.url ===
        "https://inventory.roblox.com/v1/users/123/can-view-inventory"
    ).length,
    1,
    "a relationship refresh must not invalidate public inventory visibility"
  );
  const relationshipsResponse = await dispatchRelationships({
    type: hooks.enhancedProfileConstants.relationshipsMessageType,
    requestId: 92,
    userId: "123"
  });
  assert.equal(relationshipsResponse.ok, true);
  assert.equal(relationshipsResponse.section.status, "ready");
  assert.equal(relationshipsResponse.section.data.mutualFriendsCount, 2);
  assert.equal(
    relationshipsResponse.section.data.mutualFriendsAvailable,
    true
  );

  extraMutualFriendCount = 14;
  targetFriendCountOverride = 18;
  assert.equal(hooks.hasExactMutualFriendsPageMessageKeys({
    type: hooks.enhancedProfileConstants.mutualFriendsPageMessageType,
    requestId: 93,
    targetUserId: "123",
    forceRefresh: true
  }), true);
  const mutualFriendsPageResponse = await dispatchMutualFriends({
    type: hooks.enhancedProfileConstants.mutualFriendsPageMessageType,
    requestId: 93,
    targetUserId: "123",
    forceRefresh: true
  });
  assert.equal(mutualFriendsPageResponse.ok, true);
  assert.equal(mutualFriendsPageResponse.totalCount, 16);
  assert.equal(mutualFriendsPageResponse.friends.length, 16);
  assert.deepEqual(
    Array.from(mutualFriendsPageResponse.friends.slice(0, 3), (friend) =>
      friend.userId
    ),
    ["456", "888", "10000"],
    "the full mutual list must preserve the viewed profile's friend order"
  );
  assert.equal(
    new Set(mutualFriendsPageResponse.friends.map((friend) => friend.userId)).size,
    16,
    "the Mutuals page must not duplicate friends"
  );
  extraMutualFriendCount = 0;
  targetFriendCountOverride = null;
  hooks.clearEnhancedProfileCacheForTests();

  let invalidMutualFriendsResponse = null;
  assert.equal(hooks.handleMutualFriendsPageMessage({
    type: hooks.enhancedProfileConstants.mutualFriendsPageMessageType,
    requestId: 94,
    targetUserId: "456",
    forceRefresh: false
  }, trustedMutualFriendsSender, (value) => {
    invalidMutualFriendsResponse = value;
  }), false);
  assert.equal(invalidMutualFriendsResponse.code, "INVALID");
  assert.equal(hooks.isTrustedMutualFriendsPageSender({
    ...trustedMutualFriendsSender,
    frameId: 1
  }, "123"), false);
  targetFriendsVisible = false;
  hooks.clearEnhancedProfileCacheForTests();
  const privateMutualFriendsResponse = await dispatchMutualFriends({
    type: hooks.enhancedProfileConstants.mutualFriendsPageMessageType,
    requestId: 95,
    targetUserId: "123",
    forceRefresh: true
  });
  assert.equal(privateMutualFriendsResponse.ok, false);
  assert.equal(privateMutualFriendsResponse.code, "PRIVACY_OR_REGION");
  targetFriendsVisible = true;
  hooks.clearEnhancedProfileCacheForTests();

  authenticatedViewerMode = "own";
  const ownMutualFriendsResponse = await dispatchMutualFriends({
    type: hooks.enhancedProfileConstants.mutualFriendsPageMessageType,
    requestId: 96,
    targetUserId: "123",
    forceRefresh: true
  });
  assert.equal(ownMutualFriendsResponse.ok, false);
  assert.equal(ownMutualFriendsResponse.code, "OWN_PROFILE");
  authenticatedViewerMode = "other";
  hooks.clearEnhancedProfileCacheForTests();

  assert.equal(hooks.hasExactEnhancedProfileJoinMessageKeys({
    type: "rsl:join-enhanced-profile",
    requestId: 10,
    userId: "123",
    placeId: "1001",
    gameInstanceId: "11111111-2222-4333-8444-555555555555"
  }), true);
  const joinResponse = await dispatchJoin({
    type: "rsl:join-enhanced-profile",
    requestId: 10,
    userId: "123",
    placeId: "1001",
    gameInstanceId: "11111111-2222-4333-8444-555555555555"
  });
  assert.equal(joinResponse.ok, false);
  assert.equal(joinResponse.code, "FAILED");

  let invalidJoinResponse = null;
  assert.equal(hooks.handleEnhancedProfileJoinMessage({
    type: "rsl:join-enhanced-profile",
    requestId: 11,
    userId: "123",
    placeId: "1001",
    gameInstanceId: "11111111-2222-4333-8444-555555555555",
    extra: true
  }, trustedSender, (value) => { invalidJoinResponse = value; }), false);
  assert.equal(invalidJoinResponse.code, "INVALID");

  const inactiveResponse = await dispatch({
    type: "rsl:get-enhanced-profile",
    requestId: 12,
    userId: "123"
  }, {
    ...trustedSender,
    tab: { ...trustedSender.tab, active: false }
  });
  assert.equal(inactiveResponse.ok, true);

  let invalidResponse = null;
  assert.equal(hooks.handleEnhancedProfileMessage(
    {
      type: "rsl:get-enhanced-profile",
      requestId: 10,
      userId: "123",
      extra: true
    },
    trustedSender,
    (value) => { invalidResponse = value; }
  ), false);
  assert.equal(invalidResponse.code, "INVALID");

  invalidResponse = null;
  assert.equal(hooks.handleEnhancedProfileMessage(
    { type: "rsl:get-enhanced-profile", requestId: 11, userId: "123" },
    {
      ...trustedSender,
      url: "https://www.roblox.com/users/999/profile",
      tab: { ...trustedSender.tab, url: "https://www.roblox.com/users/999/profile" }
    },
    (value) => { invalidResponse = value; }
  ), false);
  assert.equal(invalidResponse.code, "INVALID");

  badgeMode = "multipage";
  const badgeCallsBeforePaginationTest = fetchCalls.filter((call) =>
    call.url.startsWith("https://badges.roblox.com/v1/users/123/badges")
  ).length;
  const paginatedBadges = await hooks.fetchEnhancedProfileBadges("123");
  const paginatedBadgeCallCount = fetchCalls.filter((call) =>
    call.url.startsWith("https://badges.roblox.com/v1/users/123/badges")
  ).length - badgeCallsBeforePaginationTest;
  assert.equal(paginatedBadgeCallCount, 1);
  assert.equal(paginatedBadges.totalCount, 100);
  assert.equal(paginatedBadges.countIsExact, false);
  assert.equal(paginatedBadges.countStatus, "pending");
  assert.equal(paginatedBadges.hasMore, true);
  assert.equal(
    paginatedBadges.items.length,
    hooks.enhancedProfileConstants.maxBadges
  );
  assert.ok(fetchCalls.slice(-5).some((call) =>
    call.url.startsWith("https://badges.roblox.com/v1/users/123/badges") &&
      call.credentials === "include"
  ));

  const directProgress = [];
  const exactBadgeCallsBefore = fetchCalls.filter((call) =>
    call.url.startsWith("https://badges.roblox.com/v1/users/123/badges")
  ).length;
  const exactBadges = await hooks.fetchEnhancedProfileBadgeCount(
    "123",
    null,
    (progress) => directProgress.push(progress.totalCount)
  );
  assert.equal(fetchCalls.filter((call) =>
    call.url.startsWith("https://badges.roblox.com/v1/users/123/badges")
  ).length - exactBadgeCallsBefore, 4);
  assert.deepEqual(directProgress, [100, 200, 300, 350]);
  assert.deepEqual(
    {
      totalCount: exactBadges.totalCount,
      countIsExact: exactBadges.countIsExact,
      countStatus: exactBadges.countStatus
    },
    { totalCount: 350, countIsExact: true, countStatus: "ready" }
  );

  hooks.clearEnhancedProfileCacheForTests();
  const firstSubscriberProgress = [];
  const secondSubscriberProgress = [];
  const dedupedBadgeCallsBefore = fetchCalls.filter((call) =>
    call.url.startsWith("https://badges.roblox.com/v1/users/123/badges")
  ).length;
  const firstExactRequest = hooks.getEnhancedProfileBadgeCount(
    "123",
    "999",
    (progress) => firstSubscriberProgress.push(progress.totalCount)
  );
  const secondExactRequest = hooks.getEnhancedProfileBadgeCount(
    "123",
    "999",
    (progress) => secondSubscriberProgress.push(progress.totalCount)
  );
  assert.equal(firstExactRequest, secondExactRequest);
  const [firstExact, secondExact] = await Promise.all([
    firstExactRequest,
    secondExactRequest
  ]);
  assert.equal(firstExact.totalCount, 350);
  assert.equal(secondExact.totalCount, 350);
  assert.deepEqual(firstSubscriberProgress, [100, 200, 300, 350]);
  assert.deepEqual(secondSubscriberProgress, [100, 200, 300, 350]);
  assert.equal(fetchCalls.filter((call) =>
    call.url.startsWith("https://badges.roblox.com/v1/users/123/badges")
  ).length - dedupedBadgeCallsBefore, 4);
  await hooks.getEnhancedProfileBadgeCount("123", "999");
  assert.equal(fetchCalls.filter((call) =>
    call.url.startsWith("https://badges.roblox.com/v1/users/123/badges")
  ).length - dedupedBadgeCallsBefore, 4, "an exact cache hit must not refetch");

  hooks.clearEnhancedProfileCacheForTests();
  sentTabMessages.length = 0;
  assert.equal(hooks.hasExactEnhancedProfileBadgeCountMessageKeys({
    type: "rsl:get-enhanced-profile-badge-count",
    requestId: 30,
    userId: "123"
  }), true);
  const exactResponse = await dispatchBadgeCount({
    type: "rsl:get-enhanced-profile-badge-count",
    requestId: 30,
    userId: "123"
  });
  assert.equal(exactResponse.ok, true);
  assert.equal(exactResponse.requestId, 30);
  assert.equal(exactResponse.userId, "123");
  assert.equal(exactResponse.totalCount, 350);
  assert.equal(exactResponse.countIsExact, true);
  assert.equal(exactResponse.countStatus, "ready");
  assert.equal(Number.isSafeInteger(exactResponse.fetchedAt), true);
  const progressMessages = sentTabMessages.filter(({ message }) =>
    message.type === "rsl:enhanced-profile-badge-count-progress" &&
    message.requestId === 30
  );
  assert.deepEqual(
    progressMessages.map(({ message }) => message.totalCount),
    [100, 200, 300, 350]
  );
  assert.ok(progressMessages.every(({ tabId, message }) =>
    tabId === trustedSender.tab.id &&
    message.userId === "123" &&
    message.countIsExact === false &&
    message.countStatus === "pending" &&
    Object.keys(message).sort().join(",") ===
      "countIsExact,countStatus,requestId,totalCount,type,userId"
  ));
  const badgeCallsBeforeCachedMessage = fetchCalls.filter((call) =>
    call.url.startsWith("https://badges.roblox.com/v1/users/123/badges")
  ).length;
  const cachedExactResponse = await dispatchBadgeCount({
    type: "rsl:get-enhanced-profile-badge-count",
    requestId: 34,
    userId: "123"
  });
  assert.equal(cachedExactResponse.ok, true);
  assert.equal(cachedExactResponse.totalCount, 350);
  assert.equal(fetchCalls.filter((call) =>
    call.url.startsWith("https://badges.roblox.com/v1/users/123/badges")
  ).length, badgeCallsBeforeCachedMessage);
  assert.equal(sentTabMessages.some(({ message }) =>
    message.type === "rsl:enhanced-profile-badge-count-progress" &&
    message.requestId === 34
  ), false, "a completed exact cache hit should answer immediately");

  let invalidBadgeCountResponse = null;
  assert.equal(hooks.handleEnhancedProfileBadgeCountMessage({
    type: "rsl:get-enhanced-profile-badge-count",
    requestId: 31,
    userId: "123",
    extra: true
  }, trustedSender, (value) => {
    invalidBadgeCountResponse = value;
  }), false);
  assert.equal(invalidBadgeCountResponse.code, "INVALID");
  assert.equal(hooks.handleEnhancedProfileBadgeCountMessage({
    type: "rsl:get-enhanced-profile-badge-count",
    requestId: 32,
    userId: "123"
  }, {
    ...trustedSender,
    url: "https://www.roblox.com/users/999/profile",
    tab: { ...trustedSender.tab, url: "https://www.roblox.com/users/999/profile" }
  }, (value) => {
    invalidBadgeCountResponse = value;
  }), false);
  assert.equal(invalidBadgeCountResponse.code, "INVALID");

  badgeMode = "rate-limited";
  hooks.clearEnhancedProfileCacheForTests();
  await assert.rejects(
    hooks.fetchEnhancedProfileBadgeCount("123"),
    (error) => error?.status === 429,
    "an interrupted badge scan must not return a partial count as exact"
  );
  sentTabMessages.length = 0;
  const rateLimitedResponse = await dispatchBadgeCount({
    type: "rsl:get-enhanced-profile-badge-count",
    requestId: 33,
    userId: "123"
  });
  assert.equal(rateLimitedResponse.ok, false);
  assert.equal(rateLimitedResponse.code, "RATE_LIMITED");
  assert.equal("totalCount" in rateLimitedResponse, false);
  assert.equal("countIsExact" in rateLimitedResponse, false);
  assert.deepEqual(
    sentTabMessages
      .filter(({ message }) => message.requestId === 33)
      .map(({ message }) => message.totalCount),
    [100]
  );

  badgeMode = "multipage";
  authenticatedViewerMode = "other";
  await assert.rejects(
    hooks.fetchEnhancedProfileBadgeCount("123", "999", (progress) => {
      if (progress.totalCount === 100) authenticatedViewerMode = "own";
    }),
    (error) => error?.status === 401,
    "an account switch during a scan must discard the completed count"
  );
  authenticatedViewerMode = "other";
  badgeMode = "single";

  inventoryCanView = false;
  const limitedInventory =
    await hooks.fetchEnhancedProfileInventoryVisibility("123");
  assert.equal(limitedInventory.visibility, "limited");
  assert.equal(fetchCalls.at(-1).credentials, "omit");
  badgeMode = "empty";
  hooks.clearEnhancedProfileCacheForTests();
  const emptyBadgeProfile = await hooks.getEnhancedProfile(
    "123",
    true,
    { includeRelationships: false }
  );
  assert.equal(emptyBadgeProfile.sections.badges.status, "ready");
  assert.equal(emptyBadgeProfile.sections.badges.data.countStatus, "pending");
  assert.equal(emptyBadgeProfile.sections.badges.data.totalCount, 0);
  assert.deepEqual(Array.from(emptyBadgeProfile.sections.badges.data.items), []);
  assert.equal(
    emptyBadgeProfile.sections.inventory.data.visibility,
    "limited",
    "inventory privacy must remain independent from public empty badges"
  );

  badgeMode = "private";
  hooks.clearEnhancedProfileCacheForTests();
  const explicitlyPrivateBadgeProfile = await hooks.getEnhancedProfile(
    "123",
    true,
    { includeRelationships: false }
  );
  assert.equal(explicitlyPrivateBadgeProfile.sections.badges.status, "unavailable");
  assert.equal(explicitlyPrivateBadgeProfile.sections.badges.code, "PRIVATE");
  badgeMode = "single";
  inventoryCanView = true;
  hooks.clearEnhancedProfileCacheForTests();

  const publicProfileCallsBeforeRelationship = fetchCalls.filter((call) =>
    call.url === "https://users.roblox.com/v1/users"
  ).length;
  const headshotCallsBeforeRelationship = fetchCalls.filter((call) =>
    call.url.startsWith(
      "https://thumbnails.roblox.com/v1/users/avatar-headshot"
    )
  ).length;
  const countOnlyRelationships =
    await hooks.fetchEnhancedProfileRelationshipsForViewer("123", "999");
  assert.equal(countOnlyRelationships.mutualFriendsCount, 2);
  assert.equal(countOnlyRelationships.mutualFriendsAvailable, true);
  assert.equal(countOnlyRelationships.profileLimited, false);
  assert.equal(countOnlyRelationships.mutualGroupsCount, 1);
  assert.equal(countOnlyRelationships.mutualGroups.items[0].communityId, "8001");
  assert.equal(
    countOnlyRelationships.mutualGroups.items[0].role,
    "Owner",
    "mutual-group roles must belong to the viewed profile, not the viewer"
  );
  assert.equal(countOnlyRelationships.mutualGroups.hasMore, false);
  assert.equal(countOnlyRelationships.isFriend, true);
  assert.equal(countOnlyRelationships.canChat, true);
  assert.deepEqual(Array.from(countOnlyRelationships.items), []);
  assert.equal(countOnlyRelationships.hasMore, false);
  extraMutualGroupCount = 14;
  hooks.clearEnhancedProfileCacheForTests();
  const allMutualGroups =
    await hooks.fetchEnhancedProfileRelationshipsForViewer("123", "999");
  assert.equal(allMutualGroups.mutualGroupsCount, 15);
  assert.equal(allMutualGroups.mutualGroups.items.length, 15);
  assert.equal(allMutualGroups.mutualGroups.items[1].role, "Moderator");
  assert.equal(allMutualGroups.mutualGroups.hasMore, false);
  extraMutualGroupCount = 0;
  hooks.clearEnhancedProfileCacheForTests();
  targetFriendsVisible = false;
  const privateFriendRelationships =
    await hooks.fetchEnhancedProfileRelationshipsForViewer("123", "999");
  assert.equal(privateFriendRelationships.mutualFriendsCount, 0);
  assert.equal(privateFriendRelationships.mutualFriendsAvailable, false);
  assert.equal(privateFriendRelationships.profileLimited, true);
  assert.equal(privateFriendRelationships.mutualGroupsCount, 1);
  targetFriendsVisible = true;
  targetFriendsFailureStatus = 403;
  const forbiddenFriendRelationships =
    await hooks.fetchEnhancedProfileRelationshipsForViewer("123", "999");
  assert.equal(forbiddenFriendRelationships.mutualFriendsCount, 0);
  assert.equal(forbiddenFriendRelationships.mutualFriendsAvailable, false);
  assert.equal(forbiddenFriendRelationships.profileLimited, true);
  assert.equal(forbiddenFriendRelationships.mutualGroupsCount, 1);
  assert.equal(forbiddenFriendRelationships.isFriend, true);
  assert.equal(forbiddenFriendRelationships.canChat, true);
  targetFriendsFailureStatus = null;
  targetFriendsNetworkFailure = true;
  const networkFriendRelationships =
    await hooks.fetchEnhancedProfileRelationshipsForViewer("123", "999");
  assert.equal(networkFriendRelationships.mutualFriendsCount, 0);
  assert.equal(networkFriendRelationships.mutualFriendsAvailable, false);
  assert.equal(networkFriendRelationships.profileLimited, false);
  assert.equal(networkFriendRelationships.mutualGroupsCount, 1);
  assert.equal(networkFriendRelationships.isFriend, true);
  assert.equal(networkFriendRelationships.canChat, true);
  targetFriendsNetworkFailure = false;

  assert.equal(fetchCalls.filter((call) =>
    call.url === "https://users.roblox.com/v1/users"
  ).length, publicProfileCallsBeforeRelationship,
  "count-only mutuals must not fetch display profiles");
  assert.equal(fetchCalls.filter((call) =>
    call.url.startsWith(
      "https://thumbnails.roblox.com/v1/users/avatar-headshot"
    )
  ).length, headshotCallsBeforeRelationship,
  "count-only mutuals must not fetch headshots");

  targetUnavailableFriendCount = 3;
  hooks.clearEnhancedProfileCacheForTests();
  const placeholderSnapshot =
    await hooks.fetchEnhancedProfileTargetFriendSnapshot("123");
  assert.equal(placeholderSnapshot.incomplete, false);
  assert.equal(placeholderSnapshot.data.enumeratedItemCount, 7);
  assert.equal(placeholderSnapshot.data.userIds.length, 4);
  const placeholderRelationships =
    await hooks.fetchEnhancedProfileRelationshipsForViewer("123", "999");
  assert.equal(placeholderRelationships.mutualFriendsAvailable, true);
  assert.equal(placeholderRelationships.mutualFriendsCount, 2);
  const placeholderMutualPage = await dispatchMutualFriends({
    type: hooks.enhancedProfileConstants.mutualFriendsPageMessageType,
    requestId: 98,
    targetUserId: "123",
    forceRefresh: false
  });
  assert.equal(placeholderMutualPage.ok, true);
  assert.equal(placeholderMutualPage.totalCount, 2);
  targetUnavailableFriendCount = 0;
  hooks.clearEnhancedProfileCacheForTests();

  targetFriendCountMismatchResponses = 1;
  const transientCountCallsBefore = fetchCalls.filter((call) =>
    call.url === "https://friends.roblox.com/v1/users/123/friends/count"
  ).length;
  const recoveredTargetSnapshot =
    await hooks.fetchEnhancedProfileTargetFriendSnapshot("123");
  assert.equal(recoveredTargetSnapshot.incomplete, false);
  assert.equal(recoveredTargetSnapshot.data.userIds.length, 4);
  assert.equal(
    fetchCalls.filter((call) =>
      call.url === "https://friends.roblox.com/v1/users/123/friends/count"
    ).length - transientCountCallsBefore,
    1,
    "a complete cursor traversal must not be repeated for a count race"
  );

  targetFriendCountOverride = 5;
  hooks.clearEnhancedProfileCacheForTests();
  const partialFriendRelationships =
    await hooks.fetchEnhancedProfileRelationshipsForViewer("123", "999");
  assert.equal(partialFriendRelationships.mutualFriendsAvailable, true);
  assert.equal(partialFriendRelationships.profileLimited, false);
  assert.equal(partialFriendRelationships.mutualFriendsCount, 2);
  const targetFindCallsAfterPartial = fetchCalls.filter((call) =>
    call.url.startsWith(
      "https://friends.roblox.com/v1/users/123/friends/find"
    )
  ).length;
  targetFriendCountOverride = 4;
  const recoveredMutualFriends = await dispatchMutualFriends({
    type: hooks.enhancedProfileConstants.mutualFriendsPageMessageType,
    requestId: 97,
    targetUserId: "123",
    forceRefresh: false
  });
  assert.equal(recoveredMutualFriends.ok, true);
  assert.equal(recoveredMutualFriends.totalCount, 2);
  assert.equal(
    fetchCalls.filter((call) => call.url.startsWith(
      "https://friends.roblox.com/v1/users/123/friends/find"
    )).length,
    targetFindCallsAfterPartial,
    "a complete traversal with a stale count should populate the Mutuals cache"
  );
  targetFriendCountOverride = null;
  hooks.clearEnhancedProfileCacheForTests();

  authenticatedViewerMode = "own";
  const ownRelationships = await hooks.collectEnhancedProfileRelationshipsSection("123");
  assert.equal(ownRelationships.status, "not_applicable");
  assert.equal(ownRelationships.code, "OWN_PROFILE");
  authenticatedViewerMode = "missing";
  const unavailableRelationships =
    await hooks.collectEnhancedProfileRelationshipsSection("123");
  assert.equal(unavailableRelationships.status, "unavailable");
  assert.equal(unavailableRelationships.code, "UNAUTHENTICATED");
  authenticatedViewerMode = "other";

  ownedGroupGameMode = "failure";
  hooks.clearEnhancedProfileCacheForTests();
  const partiallyAvailableGames = await hooks.collectEnhancedProfile("123", {
    includePresence: false,
    includeBadges: false
  });
  assert.equal(partiallyAvailableGames.sections.experiences.status, "ready");
  assert.equal(partiallyAvailableGames.sections.experiences.data.totalCount, 1);
  assert.equal(
    partiallyAvailableGames.sections.experiences.data.items[0].universeId,
    "100",
    "a failed owned-group source must not discard public user-owned games"
  );
  assert.equal(
    partiallyAvailableGames.sections.experiences.data.countIsExact,
    false
  );
  assert.equal(
    partiallyAvailableGames.sections.experiences.data.coverageIsComplete,
    false
  );
  assert.equal(
    partiallyAvailableGames.sections.experiences.data.coverageStatus,
    "partial"
  );
  assert.equal(
    partiallyAvailableGames.sections.experiences.data.hasMore,
    false,
    "an unavailable source is partial coverage, not known pagination"
  );

  ownedGroupGameMode = "paginated";
  hooks.clearEnhancedProfileCacheForTests();
  const paginatedGroupGames = await hooks.collectEnhancedProfile("123", {
    includePresence: false,
    includeBadges: false
  });
  assert.equal(paginatedGroupGames.sections.experiences.data.totalCount, 2);
  assert.equal(paginatedGroupGames.sections.experiences.data.items.length, 2);
  assert.equal(paginatedGroupGames.sections.experiences.data.countIsExact, false);
  assert.equal(paginatedGroupGames.sections.experiences.data.hasMore, true);
  assert.equal(
    paginatedGroupGames.sections.experiences.data.coverageStatus,
    "truncated"
  );

  ownedGroupGameMode = "transfer";
  hooks.clearEnhancedProfileCacheForTests();
  const transferredGameOwnership = await hooks.collectEnhancedProfile("123", {
    includePresence: false,
    includeBadges: false
  });
  assert.equal(transferredGameOwnership.sections.experiences.data.totalCount, 2);
  assert.equal(
    transferredGameOwnership.sections.experiences.data.items.find(
      (game) => game.universeId === "300"
    )?.creatorId,
    "8001",
    "a stale duplicate must not mask the valid current owner candidate"
  );
  assert.equal(
    transferredGameOwnership.sections.experiences.data.coverageStatus,
    "complete"
  );

  ownedGroupGameMode = "ready";
  extraOwnedGroupCount =
    hooks.enhancedProfileConstants.maxOwnedGroupGameSources + 3;
  hooks.clearEnhancedProfileCacheForTests();
  const boundedCallsStart = fetchCalls.length;
  const boundedGroupGames = await hooks.collectEnhancedProfile("123", {
    includePresence: false,
    includeBadges: false
  });
  const boundedGroupGameCalls = fetchCalls.slice(boundedCallsStart).filter(
    (call) => /^https:\/\/games\.roblox\.com\/v2\/groups\/\d+\/gamesV2\?/.test(
      call.url
    )
  );
  assert.equal(
    boundedGroupGameCalls.length,
    hooks.enhancedProfileConstants.maxOwnedGroupGameSources,
    "owned-group experience fan-out must stay explicitly bounded"
  );
  assert.ok(
    hooks.enhancedProfileConstants.ownedGroupGameConcurrency <= 4,
    "owned-group game requests must use a small worker pool"
  );
  assert.equal(boundedGroupGames.sections.experiences.data.countIsExact, false);
  assert.equal(boundedGroupGames.sections.experiences.data.hasMore, false);
  assert.equal(
    boundedGroupGames.sections.experiences.data.coverageIsComplete,
    false
  );
  assert.equal(
    boundedGroupGames.sections.experiences.data.coverageStatus,
    "truncated"
  );
  extraOwnedGroupCount = 0;
  hooks.clearEnhancedProfileCacheForTests();

  usernameMode = "malformed";
  hooks.clearEnhancedProfileCacheForTests();
  const partial = await hooks.getEnhancedProfile("123");
  assert.equal(partial.sections.identity.status, "ready");
  assert.equal(partial.sections.usernames.status, "unavailable");
  assert.equal(partial.sections.experiences.status, "ready");

  console.log("PASS Enhanced Profile background data, isolation, cache, and sender validation");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
