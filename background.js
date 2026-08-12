"use strict";

const THUMBNAIL_SPECS = Object.freeze({
  profile: { path: "/v1/users/avatar-headshot", idParameter: "userIds", circular: true },
  game: { path: "/v1/places/gameicons", idParameter: "placeIds", circular: false },
  gameUniverse: { path: "/v1/games/icons", idParameter: "universeIds", circular: false },
  community: { path: "/v1/groups/icons", idParameter: "groupIds", circular: false }
});

const CONTEXT_MENU_PREFIX = "rsl-context";
const FEATURE_SETTINGS_STORAGE_KEY = "rslFeatureSettingsV1";
const FEATURE_SETTINGS_VERSION = 1;
const COPY_ROBLOX_IDS_FEATURE_KEY = "copyRobloxIds";
let copyRobloxIdsEnabled = true;
const CONTEXT_MENU_DOCUMENT_PATTERNS = Object.freeze([
  "https://www.roblox.com/*",
  "https://create.roblox.com/*"
]);
const CONTEXT_MENU_ROUTE_PATTERNS = Object.freeze({
  user: Object.freeze(["https://www.roblox.com/users/*"]),
  place: Object.freeze([
    "https://www.roblox.com/games/*",
    "https://create.roblox.com/dashboard/creations/experiences/*/places/*"
  ]),
  universe: Object.freeze([
    "https://www.roblox.com/games/*",
    "https://create.roblox.com/dashboard/creations/experiences/*"
  ]),
  asset: Object.freeze([
    "https://www.roblox.com/catalog/*",
    "https://www.roblox.com/library/*",
    "https://www.roblox.com/asset/*",
    "https://create.roblox.com/store/asset/*",
    "https://create.roblox.com/marketplace/asset/*",
    "https://create.roblox.com/dashboard/creations/store/*"
  ]),
  community: Object.freeze([
    "https://www.roblox.com/communities/*",
    "https://www.roblox.com/groups/*",
    "https://create.roblox.com/dashboard/group/profile*",
    "https://create.roblox.com/dashboard/group/roles*",
    "https://create.roblox.com/dashboard/group/payouts*",
    "https://create.roblox.com/dashboard/creations/upload*"
  ]),
  communityRole: Object.freeze([
    "https://create.roblox.com/dashboard/group/roles/*"
  ]),
  bundle: Object.freeze(["https://www.roblox.com/bundles/*"]),
  badge: Object.freeze([
    "https://www.roblox.com/badges/*",
    "https://create.roblox.com/dashboard/creations/experiences/*/badges/*"
  ]),
  gamePass: Object.freeze([
    "https://www.roblox.com/game-pass/*",
    "https://www.roblox.com/game-passes/*",
    "https://www.roblox.com/passes/*",
    "https://create.roblox.com/dashboard/creations/experiences/*/passes/*",
    "https://create.roblox.com/dashboard/creations/experiences/*/monetization/passes/*"
  ]),
  outfit: Object.freeze([
    "https://www.roblox.com/outfits/*",
    "https://www.roblox.com/users/*/outfits/*"
  ]),
  developerProduct: Object.freeze([
    "https://create.roblox.com/dashboard/creations/experiences/*/developer-products/*",
    "https://create.roblox.com/dashboard/creations/experiences/*/monetization/developer-products/*"
  ]),
  experienceSubscription: Object.freeze([
    "https://create.roblox.com/dashboard/creations/experiences/*/experience-subscriptions/*",
    "https://create.roblox.com/dashboard/creations/experiences/*/monetization/experience-subscriptions/*"
  ])
});

const CONTEXT_MENU_ACTIONS = Object.freeze([
  Object.freeze({
    key: "user",
    title: "Copy User ID",
    route: "user",
    action: "userId"
  }),
  Object.freeze({
    key: "place",
    title: "Copy Place ID",
    route: "place",
    action: "placeId"
  }),
  Object.freeze({
    key: "universe",
    title: "Copy Universe ID",
    route: "universe",
    action: "universeId"
  }),
  Object.freeze({
    key: "asset-ids",
    title: "Copy Texture ID / Asset ID",
    route: "asset",
    children: Object.freeze([
      Object.freeze({ key: "texture", title: "Copy Texture ID", action: "textureId" }),
      Object.freeze({ key: "asset", title: "Copy Asset ID", action: "assetId" })
    ])
  }),
  Object.freeze({
    key: "community",
    title: "Copy Community ID",
    route: "community",
    action: "groupId"
  }),
  Object.freeze({
    key: "community-role",
    title: "Copy Community Role ID",
    route: "communityRole",
    action: "groupRoleId"
  }),
  Object.freeze({
    key: "bundle",
    title: "Copy Bundle ID",
    route: "bundle",
    action: "bundleId"
  }),
  Object.freeze({
    key: "badge",
    title: "Copy Badge ID",
    route: "badge",
    action: "badgeId"
  }),
  Object.freeze({
    key: "game-pass",
    title: "Copy Game Pass ID",
    route: "gamePass",
    action: "gamePassId"
  }),
  Object.freeze({
    key: "outfit",
    title: "Copy Outfit ID",
    route: "outfit",
    action: "outfitId"
  }),
  Object.freeze({
    key: "developer-product",
    title: "Copy Developer Product ID",
    route: "developerProduct",
    action: "developerProductId"
  }),
  Object.freeze({
    key: "experience-subscription",
    title: "Copy Experience Subscription ID",
    route: "experienceSubscription",
    action: "experienceSubscriptionId"
  })
]);

const CONTEXT_LOOKUP_CACHE_TTL_MS = 10 * 60_000;
const ASSET_TEXT_LIMIT_BYTES = 1_000_000;
const ASSET_CONTENT_TYPE_IDS = new Set(["1", "2", "11", "12", "13"]);
const BEST_FRIENDS_STORAGE_KEY = "bestFriendsByViewer";
const MAX_BEST_FRIENDS = 100;
const CHAT_METADATA_URL =
  "https://apis.roblox.com/platform-chat-api/v1/metadata";
const QUICK_SETTINGS_READ_MESSAGE_TYPE = "rsl:get-quick-settings";
const QUICK_SETTING_UPDATE_MESSAGE_TYPE = "rsl:update-quick-setting";
const ONLINE_STATUS_UPDATE_MESSAGE_TYPE = "rsl:update-online-status";
const QUICK_SETTINGS_EXPERIENCE_PREFERENCES_STORAGE_KEY =
  "rslQuickSettingsExperiencePreferencesV1";
const QUICK_SETTINGS_EXPERIENCE_RESTORE_MAX_AGE_MS = 24 * 60 * 60_000;
const QUICK_SETTINGS_OPTIONS_URL =
  "https://apis.roblox.com/user-settings-api/v1/user-settings/settings-and-options";
const QUICK_SETTINGS_UPDATE_URL =
  "https://apis.roblox.com/user-settings-api/v1/user-settings";
const QUICK_SETTINGS_FETCH_TIMEOUT_MS = 7_500;
const QUICK_SETTINGS_QUEUE_MAX_AGE_MS = 15_000;
const QUICK_SETTING_SPECS = Object.freeze({
  onlineStatus: Object.freeze({
    apiKey: "whoCanSeeMyOnlineStatus",
    allowedValues: Object.freeze([
      "AllUsers",
      "FriendsFollowingAndFollowers",
      "FriendsAndFollowing",
      "Friends",
      "TrustedFriends",
      "NoOne"
    ])
  }),
  currentExperience: Object.freeze({
    apiKey: "whoCanJoinMeInExperiences",
    allowedValues: Object.freeze([
      "All",
      "Followers",
      "Following",
      "Friends",
      "TrustedFriends",
      "NoOne"
    ])
  }),
  inventory: Object.freeze({
    apiKey: "whoCanSeeMyInventory",
    allowedValues: Object.freeze([
      "AllUsers",
      "FriendsFollowingAndFollowers",
      "FriendsAndFollowing",
      "Friends",
      "NoOne"
    ])
  })
});
const DIRECT_QUICK_SETTING_ALIASES = Object.freeze([
  "currentExperience",
  "inventory"
]);
const RANDOM_SERVER_MESSAGE_TYPE = "rsl:get-random-public-server";
const RANDOM_SERVER_CACHE_TTL_MS = 20_000;
const RANDOM_SERVER_RATE_LIMIT_FALLBACK_MS = 60_000;
const RANDOM_SERVER_FETCH_TIMEOUT_MS = 10_000;
const RANDOM_SERVER_MAX_ID_DIGITS = 16;
const GAME_CCU_MESSAGE_TYPE = "rsl:get-game-tile-ccu";
const GAME_CCU_MAX_GAMES = 50;
const GAME_CCU_CACHE_TTL_MS = 30_000;
const GAME_CCU_CACHE_MAX_ENTRIES = 2_000;
const GAME_CCU_RESOLVE_CONCURRENCY = 4;
const GAME_RATING_CACHE_TTL_MS = 5 * 60_000;
const GAME_RATING_CACHE_MAX_ENTRIES = 2_000;
const GAME_CCU_HISTORY_MESSAGE_TYPE = "rsl:get-game-ccu-history";
const GAME_CCU_HISTORY_ALARM_NAME = "rsl-game-ccu-history-v1";
const GAME_CCU_HISTORY_ALARM_PERIOD_MINUTES = 5;
const GAME_CCU_HISTORY_BUCKET_MS = 5 * 60_000;
const GAME_CCU_HISTORY_BUCKET_SECONDS = GAME_CCU_HISTORY_BUCKET_MS / 1_000;
const GAME_CCU_HISTORY_RETENTION_MS = 7 * 24 * 60 * 60_000;
const GAME_CCU_HISTORY_MAX_POINTS = 7 * 24 * 12;
const GAME_CCU_HISTORY_DB_NAME = "rslGameCcuHistoryV1";
const GAME_CCU_HISTORY_DB_VERSION = 2;
const GAME_CCU_HISTORY_SNAPSHOTS_STORE = "snapshots";
const GAME_CCU_HISTORY_FEED_VERSION = 4;
const GAME_CCU_HISTORY_MAX_CHART_PAGES = 10;
const GAME_CCU_HISTORY_MAX_CHART_GAMES = 2_000;
const GAME_CCU_HISTORY_CHARTS_URL =
  "https://apis.roblox.com/explore-api/v1/get-sorts";
const GAME_CCU_HISTORY_FETCH_ATTEMPTS = 2;
const GAME_CCU_HISTORY_RETRY_DELAY_MS = 750;
const GAME_CCU_HISTORY_RATE_LIMIT_FALLBACK_MS = 5 * 60_000;
const GAME_CCU_HISTORY_MAX_BACKOFF_MS = 30 * 60_000;
const GAME_CCU_HISTORY_UINT32_MAX = 0xffff_ffff;
const PRIVATE_SERVER_SUPPORT_MESSAGE_TYPE = "rsl:get-private-server-support";
const PRIVATE_SERVER_LIST_MESSAGE_TYPE = "rsl:get-private-servers";
const PRIVATE_SERVER_JOIN_MESSAGE_TYPE = "rsl:join-private-server";
const PRIVATE_SERVER_OWNER_THUMBNAILS_MESSAGE_TYPE =
  "rsl:get-private-server-owner-thumbnails";
const PRIVATE_SERVER_SUPPORT_CACHE_TTL_MS = 24 * 60 * 60_000;
const PRIVATE_SERVER_SUPPORT_PRICE_UNAVAILABLE_CACHE_TTL_MS = 5 * 60_000;
const PRIVATE_SERVER_SUPPORT_UNAVAILABLE_CACHE_TTL_MS = 30 * 60_000;
const PRIVATE_SERVER_SUPPORT_STALE_TTL_MS = 7 * 24 * 60 * 60_000;
const PRIVATE_SERVER_SUPPORT_UNAVAILABLE_STALE_TTL_MS = 6 * 60 * 60_000;
const PRIVATE_SERVER_SUPPORT_UNIVERSE_CACHE_TTL_MS = 5 * 60_000;
const PRIVATE_SERVER_SUPPORT_LEGACY_CACHE_TTL_MS = 5 * 60_000;
const PRIVATE_SERVER_SUPPORT_LEGACY_STALE_TTL_MS = 30 * 60_000;
const PRIVATE_SERVER_SUPPORT_CACHE_MAX_ENTRIES = 1_000;
const PRIVATE_SERVER_SUPPORT_STORAGE_KEY = "rslPrivateServerSupportCacheV2";
const PRIVATE_SERVER_SUPPORT_STORAGE_VERSION = 2;
const PRIVATE_SERVER_SUPPORT_GLOBAL_CONCURRENCY = 2;
const PRIVATE_SERVER_SUPPORT_START_INTERVAL_MS = 150;
const PRIVATE_SERVER_SUPPORT_REFRESH_GRACE_MS = 500;
const PRIVATE_SERVER_SUPPORT_RATE_LIMIT_RESERVE = 2;
const PRIVATE_SERVER_SUPPORT_RATE_LIMIT_BUFFER_MS = 750;
const PRIVATE_SERVER_SUPPORT_RATE_LIMIT_REQUEUE_ATTEMPTS = 1;
const PRIVATE_SERVER_SUPPORT_RATE_LIMIT_COOLDOWN_MS = 30_000;
const PRIVATE_SERVER_SUPPORT_MAX_COOLDOWN_MS = 2 * 60_000;
const PRIVATE_SERVER_LIST_MAX_IN_FLIGHT = 64;
const PRIVATE_SERVER_CURSOR_MAX_LENGTH = 2_048;
const PRIVATE_SERVER_PAGE_MAX_ENTRIES = 100;
const PRIVATE_SERVER_NAME_MAX_LENGTH = 100;
const PRIVATE_SERVER_OWNER_NAME_MAX_LENGTH = 100;

const thumbnailRequests = new Map();
const ONLINE_FRIENDS_CACHE_TTL_MS = 45_000;
const FRIEND_IDS_CACHE_TTL_MS = 120_000;
const FRIEND_PAGE_SIZE = 50;
const FRIEND_LIST_NAME_MAX_LENGTH = 100;
const PRESENCE_BATCH_SIZE = 50;
const PRESENCE_REQUEST_CONCURRENCY = 3;
const PROFILE_BATCH_SIZE = 100;
const HEADSHOT_BATCH_SIZE = 100;
const ENRICHMENT_REQUEST_CONCURRENCY = 2;
const FETCH_TIMEOUT_MS = 10_000;
const FETCH_RETRY_DELAY_MS = 350;
const THUMBNAIL_PENDING_RETRY_DELAYS_MS = Object.freeze([250, 700]);
const FRIEND_FILTER_MESSAGE_TYPE = "rsl:get-friend-filter-data";
const FRIEND_FILTER_SESSION_STORAGE_KEY = "rslFriendFilterSessionCacheV1";
const FRIEND_FILTER_SESSION_STORAGE_VERSION = 1;
const FRIEND_FILTER_SESSION_CACHE_TTL_MS = 30 * 60_000;
const FRIEND_FILTER_RELATIONSHIP_CACHE_TTL_MS = 5 * 60_000;
const FRIEND_FILTER_SESSION_CACHE_MAX_ENTRIES = 4_000;
const FRIEND_FILTER_REQUEST_INTERVAL_MS = 750;
const FRIEND_FILTER_RATE_LIMIT_RESERVE = 2;
const FRIEND_FILTER_RATE_LIMIT_FALLBACK_MS = 60_000;
const FRIEND_FILTER_RATE_LIMIT_MAX_MS = 2 * 60_000;
const FRIEND_FILTER_COUNT_CHUNK_SIZE = 10;
const FRIEND_FILTER_FRIENDSHIP_BATCH_SIZE = 50;
const FRIEND_FILTER_FOLLOWERS_PAGE_SIZE = 100;
const FRIEND_FILTER_FOLLOWERS_PAGES_PER_CHUNK = 5;
const FRIEND_FILTER_FOLLOWERS_MAX_RESULTS = 5_000;
const FRIEND_FILTER_CURSOR_MAX_LENGTH = 2_048;
const FRIEND_FILTER_INPUT_MAX_LENGTH = 300;
const FRIEND_FILTER_SCAN_TTL_MS = 10 * 60_000;
const FRIEND_FILTER_SCAN_MAX_ENTRIES = 32;
const FRIEND_FILTER_COUNT_PATHS = Object.freeze({
  followers: "followers",
  friends: "friends",
  following: "followings"
});

let onlineFriendsCache = null;
let friendIdsCache = null;
const friendIdsRequestsByViewer = new Map();
let onlineFriendsInFlight = null;
let onlineFriendsEnrichmentInFlight = null;
let offlineFriendsEnrichmentInFlight = null;
let onlineFriendsGeneration = 0;
const universeIdCache = new Map();
const assetDetailsCache = new Map();
const assetTextureCache = new Map();
const friendFilterUserResolutionCache = new Map();
const friendFilterGameResolutionCache = new Map();
const friendFilterSessionCache = new Map();
const friendFilterScanSnapshots = new Map();
let friendFilterSessionCacheLoaded = false;
let friendFilterSessionCacheLoadPromise = null;
let friendFilterSessionCacheWriteTail = Promise.resolve();
let friendFilterRequestGateTail = Promise.resolve();
let friendFilterNextRequestAt = 0;
let friendFilterRateLimitedUntil = 0;
let friendFilterScanSequence = 0;
let authenticatedUserRequest = null;
let quickSettingsReadRequest = null;
let quickSettingsCsrfViewerUserId = null;
let quickSettingsCsrfToken = "";
let quickSettingsWriteTail = Promise.resolve();
let quickSettingsWriteGeneration = 0;
let quickSettingsPendingWriteCount = 0;
let quickSettingsExperiencePreferenceWriteTail = Promise.resolve();
const invalidQuickSettingsExperienceRestoreViewerIds = new Set();
const randomServerCandidateCache = new Map();
const randomServerCandidateRequests = new Map();
let randomServerRateLimitedUntil = 0;
const gameCcuCache = new Map();
const gameCcuRequestsByUniverseId = new Map();
const gameRatingCache = new Map();
const gameRatingRequestsByUniverseId = new Map();
let gameCcuHistoryDbPromise = null;
let gameCcuHistoryCollectionPromise = null;
let gameCcuHistoryFeatureEnabled = true;
let gameCcuHistoryFailureCount = 0;
let gameCcuHistoryRetryNotBefore = 0;
let gameCcuHistoryStorageOverride = null;
let gameCcuHistorySnapshotCache = null;
let gameCcuHistorySnapshotCachePromise = null;
const privateServerSupportCache = new Map();
const privateServerSupportByPlaceId = new Map();
const privateServerSupportRequestsByPlaceId = new Map();
const privateServerSupportTaskQueue = [];
const privateServerListRequests = new Map();
let privateServerDisplayTokenSequence = 0;
let privateServerSupportStorageLoadPromise = null;
let privateServerSupportStorageWritePromise = Promise.resolve();
let activePrivateServerSupportTasks = 0;
let privateServerSupportRateLimitedUntil = 0;
let privateServerSupportNextStartAt = 0;
let privateServerSupportQueueTimer = null;

class RobloxApiError extends Error {
  constructor(status, retryAfterMs = 0) {
    super(`Roblox API request failed with ${status}`);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

class QuickSettingsError extends Error {
  constructor(code, status = 0) {
    super(code);
    this.name = "QuickSettingsError";
    this.code = code;
    this.status = status;
  }
}

class ContextCopyError extends Error {
  constructor(message) {
    super(message);
    this.name = "ContextCopyError";
  }
}

class RandomServerError extends Error {
  constructor(code) {
    super(code);
    this.name = "RandomServerError";
    this.code = code;
  }
}

class GameCcuError extends Error {
  constructor(code) {
    super(code);
    this.name = "GameCcuError";
    this.code = code;
  }
}

class GameCcuHistoryError extends Error {
  constructor(code, status = 0, retryAfterMs = 0) {
    super(code);
    this.name = "GameCcuHistoryError";
    this.code = code;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

class PrivateServerError extends Error {
  constructor(code) {
    super(code);
    this.name = "PrivateServerError";
    this.code = code;
  }
}

class FriendFilterError extends Error {
  constructor(code, status = 0, retryAfterMs = 0, apiCodes = []) {
    super(code);
    this.name = "FriendFilterError";
    this.code = code;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.apiCodes = Array.isArray(apiCodes) ? apiCodes : [];
  }
}

function isValidId(value) {
  return typeof value === "string" && /^[1-9]\d{0,19}$/.test(value);
}

function normalizeExperienceSubscriptionId(value) {
  const match = /^EXP-([1-9]\d{0,19})$/i.exec(String(value ?? ""));
  return match ? `EXP-${match[1]}` : null;
}

function isSafeThumbnailUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return (
      url.protocol === "https:" &&
      (url.hostname === "rbxcdn.com" || url.hostname.endsWith(".rbxcdn.com"))
    );
  } catch {
    return false;
  }
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function parseRetryAfterMilliseconds(rawValue) {
  const value = typeof rawValue === "string" ? rawValue.trim() : "";
  if (!value) {
    return 0;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(
      PRIVATE_SERVER_SUPPORT_MAX_COOLDOWN_MS,
      Math.ceil(seconds * 1_000)
    );
  }
  const retryAt = Date.parse(value);
  if (!Number.isFinite(retryAt)) {
    return 0;
  }
  return Math.min(
    PRIVATE_SERVER_SUPPORT_MAX_COOLDOWN_MS,
    Math.max(0, retryAt - Date.now())
  );
}

function parseFirstRateLimitHeaderNumber(rawValue) {
  const firstValue = String(rawValue ?? "").split(",", 1)[0].trim();
  if (!firstValue) {
    return null;
  }
  const value = Number(firstValue);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function parseRateLimitResetMilliseconds(rawValue) {
  const resetSeconds = parseFirstRateLimitHeaderNumber(rawValue);
  if (resetSeconds === null) {
    return 0;
  }
  return Math.min(
    PRIVATE_SERVER_SUPPORT_MAX_COOLDOWN_MS,
    Math.ceil(resetSeconds * 1_000) + PRIVATE_SERVER_SUPPORT_RATE_LIMIT_BUFFER_MS
  );
}

function updatePrivateServerSupportRateLimitFromResponse(response) {
  const remaining = parseFirstRateLimitHeaderNumber(
    response?.headers?.get?.("x-ratelimit-remaining")
  );
  if (remaining === null || remaining > PRIVATE_SERVER_SUPPORT_RATE_LIMIT_RESERVE) {
    return;
  }
  const resetMs = parseRateLimitResetMilliseconds(
    response.headers.get("x-ratelimit-reset")
  );
  if (resetMs <= 0) {
    return;
  }
  privateServerSupportRateLimitedUntil = Math.max(
    privateServerSupportRateLimitedUntil,
    Date.now() + resetMs
  );
}

function isRetryableFetchError(error) {
  return (
    error?.name === "AbortError" ||
    error instanceof TypeError ||
    error?.status === 429 ||
    Number(error?.status) >= 500
  );
}

async function fetchThumbnailFromSpec(spec, id) {
  const endpoint = new URL(spec.path, "https://thumbnails.roblox.com");
  endpoint.searchParams.set(spec.idParameter, id);
  endpoint.searchParams.set("size", "150x150");
  endpoint.searchParams.set("format", "Webp");
  endpoint.searchParams.set("isCircular", String(spec.circular));

  for (let attempt = 0; attempt <= THUMBNAIL_PENDING_RETRY_DELAYS_MS.length; attempt += 1) {
    const payload = await fetchJson(endpoint, {
      cache: "no-store",
      credentials: "omit"
    });
    const result = Array.isArray(payload?.data)
      ? payload.data.find((entry) => String(entry?.targetId) === id) || payload.data[0]
      : null;

    if (result?.state === "Completed" && isSafeThumbnailUrl(result.imageUrl)) {
      return result.imageUrl;
    }
    if (result?.state !== "Pending" || attempt >= THUMBNAIL_PENDING_RETRY_DELAYS_MS.length) {
      return null;
    }
    await wait(THUMBNAIL_PENDING_RETRY_DELAYS_MS[attempt]);
  }

  return null;
}

async function fetchThumbnail(kind, id) {
  const spec = THUMBNAIL_SPECS[kind];
  if (!spec || !isValidId(id)) {
    return null;
  }

  if (kind === "game") {
    try {
      const universeId = await resolveUniverseId(id);
      const universeIcon = await fetchThumbnailFromSpec(
        THUMBNAIL_SPECS.gameUniverse,
        universeId
      );
      if (universeIcon) {
        return universeIcon;
      }
    } catch {
      // The stable place-icon endpoint remains a fallback if mapping is unavailable.
    }
  }

  return fetchThumbnailFromSpec(spec, id);
}

function getThumbnail(kind, id, forceRefresh = false) {
  const key = `${kind}:${id}`;
  if (forceRefresh) {
    thumbnailRequests.delete(key);
  }
  if (!thumbnailRequests.has(key)) {
    const request = fetchThumbnail(kind, id)
      .catch(() => null)
      .then((url) => {
        if (!url) {
          thumbnailRequests.delete(key);
        }
        return url;
      });
    thumbnailRequests.set(key, request);
  }
  return thumbnailRequests.get(key);
}

async function fetchJson(url, options = {}, retryPolicy = {}) {
  let lastError = null;
  const requestedAttempts = Number(retryPolicy.maxAttempts);
  const maxAttempts = Number.isSafeInteger(requestedAttempts)
    ? Math.min(2, Math.max(1, requestedAttempts))
    : 2;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      try {
        retryPolicy.onResponse?.(response);
      } catch {
        // Response telemetry is an optimization and must never break the request.
      }
      if (!response.ok) {
        throw new RobloxApiError(
          response.status,
          Math.max(
            parseRetryAfterMilliseconds(response.headers.get("Retry-After")),
            parseRateLimitResetMilliseconds(response.headers.get("x-ratelimit-reset"))
          )
        );
      }
      return await response.json();
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }

    if (!isRetryableFetchError(lastError) || attempt >= maxAttempts - 1) {
      throw lastError;
    }
    await wait(FETCH_RETRY_DELAY_MS * (attempt + 1));
  }

  throw lastError;
}

async function runWithConcurrency(items, concurrency, callback) {
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await callback(items[index], index);
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}

function normalizeId(value) {
  const id = String(value ?? "");
  return isValidId(id) ? id : null;
}

function normalizeOptionalId(value) {
  return normalizeId(value) || null;
}

function normalizeGameInstanceId(value) {
  const id = typeof value === "string" ? value.trim() : "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ? id
    : null;
}

function getCaseInsensitiveSearchParameter(searchParams, wantedName) {
  const normalizedWantedName = wantedName.toLowerCase();
  for (const [name, value] of searchParams) {
    if (name.toLowerCase() === normalizedWantedName) {
      return value;
    }
  }
  return null;
}

function getContextRoutePatterns(route) {
  return CONTEXT_MENU_ROUTE_PATTERNS[route] || [];
}

function parseRobloxContextUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.hostname !== "www.roblox.com" && url.hostname !== "create.roblox.com")
  ) {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (
    url.hostname === "www.roblox.com" &&
    segments.length > 1 &&
    /^[a-z]{2}(?:-[a-z]{2})?$/i.test(segments[0])
  ) {
    segments.shift();
  }

  const lowerSegments = segments.map((segment) => segment.toLowerCase());
  const context = { sourceUrl: url.href };
  const setId = (field, value) => {
    const normalized = normalizeId(value);
    if (normalized) {
      context[field] = normalized;
    }
  };
  const setExperienceSubscriptionId = (value) => {
    const normalized = normalizeExperienceSubscriptionId(value);
    if (normalized) {
      context.experienceSubscriptionId = normalized;
    }
  };

  if (url.hostname === "www.roblox.com") {
    if (lowerSegments[0] === "users") {
      setId("userId", segments[1]);
      context.kind = "user";
      if (lowerSegments[2] === "outfits") {
        setId("outfitId", segments[3]);
      }
    } else if (lowerSegments[0] === "games") {
      setId("placeId", segments[1]);
      if (!context.placeId && ["start", "refer"].includes(lowerSegments[1])) {
        setId(
          "placeId",
          getCaseInsensitiveSearchParameter(url.searchParams, "placeId")
        );
      }
      context.kind = "game";
    } else if (["catalog", "library"].includes(lowerSegments[0])) {
      setId("assetId", segments[1]);
      context.kind = "asset";
    } else if (lowerSegments[0] === "asset") {
      setId("assetId", getCaseInsensitiveSearchParameter(url.searchParams, "id"));
      context.kind = "asset";
    } else if (["communities", "groups"].includes(lowerSegments[0])) {
      setId("groupId", segments[1]);
      context.kind = "community";
    } else if (lowerSegments[0] === "bundles") {
      setId("bundleId", segments[1]);
      context.kind = "bundle";
    } else if (lowerSegments[0] === "badges") {
      setId("badgeId", segments[1]);
      context.kind = "badge";
    } else if (["game-pass", "game-passes", "passes"].includes(lowerSegments[0])) {
      setId("gamePassId", segments[1]);
      context.kind = "gamePass";
    } else if (lowerSegments[0] === "outfits") {
      setId("outfitId", segments[1]);
      context.kind = "outfit";
    }
  } else if (
    ["store", "marketplace"].includes(lowerSegments[0]) &&
    lowerSegments[1] === "asset"
  ) {
    setId("assetId", segments[2]);
    context.kind = "asset";
  } else if (
    lowerSegments[0] === "dashboard" &&
    lowerSegments[1] === "creations" &&
    lowerSegments[2] === "store"
  ) {
    setId("assetId", segments[3]);
    context.kind = "asset";
  } else if (
    lowerSegments[0] === "dashboard" &&
    lowerSegments[1] === "creations" &&
    lowerSegments[2] === "experiences"
  ) {
    setId("universeId", segments[3]);
    context.kind = "game";
    if (context.universeId) {
      const entityIndex = lowerSegments[4] === "monetization" ? 5 : 4;
      const nestedEntityFields = new Map([
        ["places", "placeId"],
        ["badges", "badgeId"],
        ["passes", "gamePassId"],
        ["developer-products", "developerProductId"]
      ]);
      const nestedField = nestedEntityFields.get(lowerSegments[entityIndex]);
      if (nestedField) {
        setId(nestedField, segments[entityIndex + 1]);
      }
      if (lowerSegments[entityIndex] === "experience-subscriptions") {
        setExperienceSubscriptionId(segments[entityIndex + 1]);
      }
    }
  } else if (
    lowerSegments[0] === "dashboard" &&
    lowerSegments[1] === "group" &&
    ["profile", "roles", "payouts"].includes(lowerSegments[2])
  ) {
    setId("groupId", getCaseInsensitiveSearchParameter(url.searchParams, "groupId"));
    if (lowerSegments[2] === "roles") {
      setId("groupRoleId", segments[3]);
    }
    context.kind = "community";
  } else if (
    lowerSegments[0] === "dashboard" &&
    lowerSegments[1] === "creations" &&
    lowerSegments[2] === "upload"
  ) {
    setId("groupId", getCaseInsensitiveSearchParameter(url.searchParams, "groupId"));
    context.kind = "community";
  }

  return Object.keys(context).some((key) => key.endsWith("Id")) ? context : null;
}

function getCachedLookup(cache, key, loader) {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = Promise.resolve()
    .then(loader)
    .catch((error) => {
      if (cache.get(key)?.promise === promise) {
        cache.delete(key);
      }
      throw error;
    });
  cache.set(key, { expiresAt: now + CONTEXT_LOOKUP_CACHE_TTL_MS, promise });
  return promise;
}

function resolveUniverseId(placeId) {
  const normalizedPlaceId = normalizeId(placeId);
  if (!normalizedPlaceId) {
    return Promise.reject(new ContextCopyError("That Place ID is not valid."));
  }

  return getCachedLookup(universeIdCache, normalizedPlaceId, async () => {
    const endpoint = new URL(
      `/universes/v1/places/${normalizedPlaceId}/universe`,
      "https://apis.roblox.com"
    );
    const payload = await fetchJson(endpoint, {
      cache: "no-store",
      credentials: "include",
      headers: { Accept: "application/json" }
    });
    const universeId = normalizeId(payload?.universeId);
    if (!universeId) {
      throw new ContextCopyError("Roblox did not return a Universe ID for that place.");
    }
    return universeId;
  });
}

function getAssetDetails(assetId) {
  const normalizedAssetId = normalizeId(assetId);
  if (!normalizedAssetId) {
    return Promise.reject(new ContextCopyError("That Asset ID is not valid."));
  }

  return getCachedLookup(assetDetailsCache, normalizedAssetId, async () => {
    const endpoint = new URL(
      `/v2/assets/${normalizedAssetId}/details`,
      "https://economy.roblox.com"
    );
    const payload = await fetchJson(endpoint, {
      cache: "no-store",
      credentials: "omit",
      headers: { Accept: "application/json" }
    });
    const returnedAssetId = normalizeId(payload?.AssetId ?? payload?.assetId);
    if (returnedAssetId !== normalizedAssetId) {
      throw new ContextCopyError("Roblox did not return details for that asset.");
    }

    const creator = payload?.Creator || payload?.creator || {};
    return Object.freeze({
      assetId: normalizedAssetId,
      productId: normalizeOptionalId(payload?.ProductId ?? payload?.productId),
      assetTypeId: normalizeOptionalId(payload?.AssetTypeId ?? payload?.assetTypeId),
      creatorId: normalizeOptionalId(
        creator?.CreatorTargetId ?? creator?.creatorTargetId ?? creator?.Id ?? creator?.id
      ),
      creatorType: String(
        creator?.CreatorType ?? creator?.creatorType ?? creator?.Type ?? creator?.type ?? ""
      ),
      iconImageAssetId: normalizeOptionalId(
        payload?.IconImageAssetId ?? payload?.iconImageAssetId
      )
    });
  });
}

function isSafeAssetContentUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return (
      url.protocol === "https:" &&
      (url.hostname === "rbxcdn.com" || url.hostname.endsWith(".rbxcdn.com"))
    );
  } catch {
    return false;
  }
}

async function readResponseTextLimited(response) {
  const declaredLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > ASSET_TEXT_LIMIT_BYTES) {
    throw new ContextCopyError("That asset is too large to inspect safely.");
  }

  if (!response.body?.getReader || typeof TextDecoder !== "function") {
    const text = await response.text();
    if (text.length > ASSET_TEXT_LIMIT_BYTES) {
      throw new ContextCopyError("That asset is too large to inspect safely.");
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    totalBytes += value.byteLength;
    if (totalBytes > ASSET_TEXT_LIMIT_BYTES) {
      await reader.cancel();
      throw new ContextCopyError("That asset is too large to inspect safely.");
    }
    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

async function fetchTextLimited(rawUrl, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(rawUrl, { ...options, signal: controller.signal });
    if (!response.ok) {
      throw new RobloxApiError(response.status);
    }
    return await readResponseTextLimited(response);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAssetContentText(assetId) {
  const endpoint = new URL(
    `/v2/assetId/${assetId}`,
    "https://assetdelivery.roblox.com"
  );
  const responseText = await fetchTextLimited(endpoint, {
    cache: "no-store",
    credentials: "include"
  });

  let payload = null;
  try {
    payload = JSON.parse(responseText);
  } catch {
    return responseText;
  }

  const location = payload?.location || payload?.locations?.[0]?.location;
  if (!isSafeAssetContentUrl(location)) {
    throw new ContextCopyError("Roblox did not provide accessible texture data for this asset.");
  }

  return fetchTextLimited(location, {
    cache: "force-cache",
    credentials: "omit"
  });
}

function findReferencedAssetId(assetText) {
  const decodedText = String(assetText || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&#x3D;", "=")
    .replaceAll("&#61;", "=");
  const contentPattern =
    /<Content\b[^>]*\bname\s*=\s*["'](?:Texture|Graphic|ShirtTemplate|PantsTemplate)["'][^>]*>([\s\S]*?)<\/Content>/gi;

  for (const match of decodedText.matchAll(contentPattern)) {
    const reference = match[1].match(
      /(?:rbxassetid:\/\/|[?&](?:id|assetId)=)(\d{1,20})(?!\d)/i
    );
    const id = normalizeId(reference?.[1]);
    if (id) {
      return id;
    }
  }

  return null;
}

function resolveAssetTextureId(assetId, knownDetails = null) {
  const normalizedAssetId = normalizeId(assetId);
  if (!normalizedAssetId) {
    return Promise.reject(new ContextCopyError("That Asset ID is not valid."));
  }

  return getCachedLookup(assetTextureCache, normalizedAssetId, async () => {
    const details = knownDetails || (await getAssetDetails(normalizedAssetId));
    const assetTypeId = details.assetTypeId;
    if (!ASSET_CONTENT_TYPE_IDS.has(assetTypeId)) {
      throw new ContextCopyError(
        "This asset type does not expose a separate Texture, Image, or Template ID."
      );
    }

    if (assetTypeId === "1") {
      return Object.freeze({ id: normalizedAssetId, label: "Image ID" });
    }

    const content = await fetchAssetContentText(normalizedAssetId);
    const referencedId = findReferencedAssetId(content);
    if (!referencedId) {
      throw new ContextCopyError(
        "Roblox did not provide a verified Texture, Image, or Template ID for this asset."
      );
    }

    const label = assetTypeId === "13" ? "Texture ID" : "Template / Image ID";
    return Object.freeze({ id: referencedId, label });
  });
}

function addContextEntry(entries, label, value) {
  if (!value || entries.some((entry) => entry.label === label)) {
    return;
  }
  entries.push({ label, value: String(value) });
}

function getCreatorIdLabel(details) {
  const creatorType = details.creatorType.toLowerCase();
  if (creatorType.includes("group")) {
    return "Creator Community ID";
  }
  if (creatorType.includes("user")) {
    return "Creator User ID";
  }
  return "Creator ID";
}

async function getAllContextEntries(context) {
  const entries = [];
  addContextEntry(entries, "User ID", context.userId);
  addContextEntry(entries, "Place ID", context.placeId);

  let universeId = context.universeId;
  if (!universeId && context.placeId) {
    try {
      universeId = await resolveUniverseId(context.placeId);
    } catch {
      // Place ID is still useful when Roblox temporarily blocks the lookup.
    }
  }
  addContextEntry(entries, "Universe ID (Game ID)", universeId);

  addContextEntry(entries, "Asset ID", context.assetId);
  if (context.assetId) {
    let details = null;
    try {
      details = await getAssetDetails(context.assetId);
      addContextEntry(entries, "Product ID", details.productId);
      addContextEntry(entries, "Asset Type ID", details.assetTypeId);
      addContextEntry(entries, getCreatorIdLabel(details), details.creatorId);
      addContextEntry(entries, "Icon Image Asset ID", details.iconImageAssetId);
    } catch {
      // The direct Asset ID remains copyable for private or moderated assets.
    }

    if (details) {
      try {
        const texture = await resolveAssetTextureId(context.assetId, details);
        addContextEntry(entries, texture.label, texture.id);
      } catch {
        // Not every asset type has a separate image or template reference.
      }
    }
  }

  addContextEntry(entries, "Community ID (Group ID)", context.groupId);
  addContextEntry(entries, "Community Role ID", context.groupRoleId);
  addContextEntry(entries, "Bundle ID", context.bundleId);
  addContextEntry(entries, "Badge ID", context.badgeId);
  addContextEntry(entries, "Game Pass ID", context.gamePassId);
  addContextEntry(entries, "Outfit ID", context.outfitId);
  addContextEntry(entries, "Developer Product ID", context.developerProductId);
  addContextEntry(
    entries,
    "Experience Subscription ID",
    context.experienceSubscriptionId
  );
  return entries;
}

async function getContextEntryForAction(context, action) {
  const directEntries = {
    userId: ["User ID", context.userId],
    placeId: ["Place ID", context.placeId],
    assetId: ["Asset ID", context.assetId],
    groupId: ["Community ID (Group ID)", context.groupId],
    groupRoleId: ["Community Role ID", context.groupRoleId],
    bundleId: ["Bundle ID", context.bundleId],
    badgeId: ["Badge ID", context.badgeId],
    gamePassId: ["Game Pass ID", context.gamePassId],
    outfitId: ["Outfit ID", context.outfitId],
    developerProductId: ["Developer Product ID", context.developerProductId],
    experienceSubscriptionId: [
      "Experience Subscription ID",
      context.experienceSubscriptionId
    ]
  };

  if (Object.hasOwn(directEntries, action)) {
    const [label, value] = directEntries[action];
    if (!value) {
      throw new ContextCopyError(`No ${label} was found in that Roblox URL.`);
    }
    return { label, value };
  }

  if (action === "universeId") {
    const value = context.universeId || (context.placeId && (await resolveUniverseId(context.placeId)));
    if (!value) {
      throw new ContextCopyError("No Place or Universe ID was found in that Roblox URL.");
    }
    return { label: "Universe ID (Game ID)", value };
  }

  if (action === "textureId") {
    if (!context.assetId) {
      throw new ContextCopyError("No Asset ID was found in that Roblox URL.");
    }
    const texture = await resolveAssetTextureId(context.assetId);
    return { label: texture.label, value: texture.id };
  }

  if (["assetProductId", "assetTypeId", "assetCreatorId", "assetIconImageId"].includes(action)) {
    if (!context.assetId) {
      throw new ContextCopyError("No Asset ID was found in that Roblox URL.");
    }
    const details = await getAssetDetails(context.assetId);
    const detailEntries = {
      assetProductId: ["Product ID", details.productId],
      assetTypeId: ["Asset Type ID", details.assetTypeId],
      assetCreatorId: [getCreatorIdLabel(details), details.creatorId],
      assetIconImageId: ["Icon Image Asset ID", details.iconImageAssetId]
    };
    const [label, value] = detailEntries[action];
    if (!value) {
      throw new ContextCopyError(`Roblox did not provide a ${label} for this asset.`);
    }
    return { label, value };
  }

  throw new ContextCopyError("That copy action is not supported.");
}

async function getContextCopyResult(context, action) {
  if (!context) {
    throw new ContextCopyError("No supported Roblox ID was found in that URL.");
  }

  if (action === "all") {
    const entries = await getAllContextEntries(context);
    if (entries.length === 0) {
      throw new ContextCopyError("No supported Roblox ID was found in that URL.");
    }
    return {
      text: entries.map((entry) => `${entry.label}: ${entry.value}`).join("\n"),
      confirmation: `Copied ${entries.length} Roblox ID${entries.length === 1 ? "" : "s"}.`
    };
  }

  const entry = await getContextEntryForAction(context, action);
  return {
    text: String(entry.value),
    confirmation: `${entry.label} copied: ${entry.value}`
  };
}

function getContextMenuId(scope, action) {
  return `${CONTEXT_MENU_PREFIX}:${scope}:${action}`;
}

function createContextMenuItem(properties) {
  chrome.contextMenus.create(properties, () => {
    void chrome.runtime.lastError;
  });
}

function createContextMenuScope(scope) {
  for (const item of CONTEXT_MENU_ACTIONS) {
    const routePatterns = getContextRoutePatterns(item.route);
    const properties = {
      id: getContextMenuId(scope, item.key),
      title: item.title,
      contexts: scope === "target" ? ["link", "image"] : ["page"],
      documentUrlPatterns: scope === "page" ? routePatterns : CONTEXT_MENU_DOCUMENT_PATTERNS
    };
    if (scope === "target") {
      properties.targetUrlPatterns = routePatterns;
    }
    if (item.children) {
      createContextMenuItem(properties);
      for (const child of item.children) {
        createContextMenuItem({
          ...properties,
          id: getContextMenuId(scope, `${item.key}-${child.key}`),
          parentId: properties.id,
          title: child.title
        });
      }
      continue;
    }
    createContextMenuItem(properties);
  }
}

function setupContextMenus() {
  if (!chrome.contextMenus?.removeAll) {
    return;
  }

  chrome.contextMenus.removeAll(() => {
    void chrome.runtime.lastError;
    if (!copyRobloxIdsEnabled) {
      return;
    }
    createContextMenuScope("page");
    createContextMenuScope("target");
  });
}

function getCopyRobloxIdsFeatureValue(rawValue) {
  return !(
    rawValue &&
    typeof rawValue === "object" &&
    rawValue.version === FEATURE_SETTINGS_VERSION &&
    rawValue.flags &&
    typeof rawValue.flags === "object" &&
    rawValue.flags[COPY_ROBLOX_IDS_FEATURE_KEY] === false
  );
}

function syncContextMenusFromStorage() {
  if (!chrome.storage?.local?.get) {
    copyRobloxIdsEnabled = true;
    setupContextMenus();
    return;
  }
  chrome.storage.local.get(
    { [FEATURE_SETTINGS_STORAGE_KEY]: null },
    (result) => {
      void chrome.runtime.lastError;
      copyRobloxIdsEnabled = getCopyRobloxIdsFeatureValue(
        result?.[FEATURE_SETTINGS_STORAGE_KEY]
      );
      setupContextMenus();
    }
  );
}

function isContextActionAvailable(action, context) {
  if (!context) {
    return false;
  }

  const directFields = {
    userId: "userId",
    placeId: "placeId",
    assetId: "assetId",
    groupId: "groupId",
    groupRoleId: "groupRoleId",
    bundleId: "bundleId",
    badgeId: "badgeId",
    gamePassId: "gamePassId",
    outfitId: "outfitId",
    developerProductId: "developerProductId",
    experienceSubscriptionId: "experienceSubscriptionId"
  };
  if (Object.hasOwn(directFields, action)) {
    return Boolean(context[directFields[action]]);
  }
  if (action === "universeId") {
    return Boolean(context.universeId || context.placeId);
  }
  if (
    action === "textureId" ||
    ["assetProductId", "assetTypeId", "assetCreatorId", "assetIconImageId"].includes(action)
  ) {
    return Boolean(context.assetId);
  }
  return false;
}

function sendMessageToTab(tabId, frameId, message) {
  return new Promise((resolve) => {
    const options = Number.isInteger(frameId) ? { frameId } : undefined;
    const callback = (response) => {
      const error = chrome.runtime.lastError;
      resolve(error ? null : response || null);
    };
    if (options) {
      chrome.tabs.sendMessage(tabId, message, options, callback);
    } else {
      chrome.tabs.sendMessage(tabId, message, callback);
    }
  });
}

async function handleContextMenuClick(info, tab) {
  if (
    !copyRobloxIdsEnabled ||
    !Number.isInteger(tab?.id) ||
    typeof info?.menuItemId !== "string"
  ) {
    return;
  }

  const [prefix, scope, itemKey] = info.menuItemId.split(":");
  let menuItem = CONTEXT_MENU_ACTIONS.find((item) => item.key === itemKey);
  let action = menuItem?.action || null;
  if (!menuItem) {
    menuItem = CONTEXT_MENU_ACTIONS.find((item) =>
      item.children?.some((child) => `${item.key}-${child.key}` === itemKey)
    );
    action = menuItem?.children?.find(
      (child) => `${menuItem.key}-${child.key}` === itemKey
    )?.action || null;
  }
  if (
    prefix !== CONTEXT_MENU_PREFIX ||
    !["page", "target"].includes(scope) ||
    !menuItem ||
    !action
  ) {
    return;
  }

  const candidateUrls = scope === "target" ? [info.linkUrl, info.srcUrl] : [info.pageUrl];
  const context = candidateUrls
    .map((candidateUrl) => parseRobloxContextUrl(candidateUrl))
    .find((candidate) => isContextActionAvailable(action, candidate)) || null;
  const supportedContext = isContextActionAvailable(action, context) ? context : null;
  const needsLookup =
    (action === "universeId" && !supportedContext?.universeId) ||
    action === "textureId" ||
    ["assetProductId", "assetTypeId", "assetCreatorId", "assetIconImageId"].includes(action) ||
    (action === "all" && Boolean(
      (supportedContext?.placeId && !supportedContext?.universeId) || supportedContext?.assetId
    ));

  if (needsLookup) {
    await sendMessageToTab(tab.id, info.frameId, {
      type: "rsl:show-context-toast",
      kind: "progress",
      message: "Looking up Roblox information\u2026"
    });
  }

  try {
    const result = await getContextCopyResult(supportedContext, action);
    await sendMessageToTab(tab.id, info.frameId, {
      type: "rsl:copy-context-text",
      text: result.text,
      confirmation: result.confirmation
    });
  } catch (error) {
    const message =
      error instanceof ContextCopyError
        ? error.message
        : error?.status === 401 || error?.status === 403
          ? "Roblox did not allow access to that information."
          : error?.status === 429
            ? "Roblox is rate-limiting lookups. Try again in a moment."
            : "That Roblox information could not be retrieved right now.";
    await sendMessageToTab(tab.id, info.frameId, {
      type: "rsl:show-context-toast",
      kind: "error",
      message
    });
  }
}

async function fetchAvatarHeadshots(userIds) {
  const headshots = new Map();
  const batches = [];

  for (let index = 0; index < userIds.length; index += HEADSHOT_BATCH_SIZE) {
    batches.push(userIds.slice(index, index + HEADSHOT_BATCH_SIZE));
  }

  await runWithConcurrency(batches, ENRICHMENT_REQUEST_CONCURRENCY, async (batch) => {
    let pendingUserIds = batch;

    for (let attempt = 0; attempt <= THUMBNAIL_PENDING_RETRY_DELAYS_MS.length; attempt += 1) {
      const endpoint = new URL("/v1/users/avatar-headshot", "https://thumbnails.roblox.com");
      endpoint.searchParams.set("userIds", pendingUserIds.join(","));
      endpoint.searchParams.set("size", "150x150");
      endpoint.searchParams.set("format", "Webp");
      endpoint.searchParams.set("isCircular", "false");

      let payload;
      try {
        payload = await fetchJson(endpoint, {
          cache: "no-store",
          credentials: "omit"
        });
      } catch {
        return;
      }

      const pending = [];
      for (const result of Array.isArray(payload?.data) ? payload.data : []) {
        const userId = normalizeId(result?.targetId);
        if (!userId) {
          continue;
        }
        if (result?.state === "Completed" && isSafeThumbnailUrl(result.imageUrl)) {
          headshots.set(userId, result.imageUrl);
        } else if (result?.state === "Pending") {
          pending.push(userId);
        }
      }

      pendingUserIds = pending;
      if (
        pendingUserIds.length === 0 ||
        attempt >= THUMBNAIL_PENDING_RETRY_DELAYS_MS.length
      ) {
        return;
      }
      await wait(THUMBNAIL_PENDING_RETRY_DELAYS_MS[attempt]);
    }
  });

  return headshots;
}

function normalizeFriendListName(value) {
  if (typeof value !== "string") {
    return "";
  }
  const normalized = value.trim();
  return normalized.length <= FRIEND_LIST_NAME_MAX_LENGTH &&
    !/[\u0000-\u001f\u007f]/.test(normalized)
    ? normalized
    : "";
}

function normalizeFriendListItems(items) {
  const userIds = [];
  const seenUserIds = new Set();
  const profilesByUserId = new Map();

  for (const item of items) {
    const userId = normalizeId(item?.id);
    if (!userId) {
      continue;
    }
    if (!seenUserIds.has(userId)) {
      seenUserIds.add(userId);
      userIds.push(userId);
    }

    const username = normalizeFriendListName(item?.name);
    const displayName = normalizeFriendListName(item?.displayName);
    const previousProfile = profilesByUserId.get(userId);
    const verificationKnown = typeof item?.hasVerifiedBadge === "boolean";
    const robloxPlusKnown = typeof item?.hasRobloxSubscription === "boolean";
    if (
      username ||
      displayName ||
      verificationKnown ||
      robloxPlusKnown ||
      previousProfile
    ) {
      profilesByUserId.set(
        userId,
        Object.freeze({
          userId,
          names: Object.freeze({
            username: previousProfile?.names?.username || username,
            combinedName: previousProfile?.names?.combinedName || displayName
          }),
          isVerified:
            previousProfile?.isVerified === true || item?.hasVerifiedBadge === true,
          isVerifiedKnown:
            previousProfile?.isVerifiedKnown === true || verificationKnown,
          hasRobloxSubscription:
            previousProfile?.hasRobloxSubscription === true ||
            item?.hasRobloxSubscription === true,
          isRobloxPlusKnown:
            previousProfile?.isRobloxPlusKnown === true || robloxPlusKnown,
          isDeleted: false
        })
      );
    }
  }

  return { userIds, profilesByUserId };
}

async function fetchFriendIdsFromListEndpoint(viewerUserId) {
  const endpoint = new URL(
    `/v1/users/${viewerUserId}/friends`,
    "https://friends.roblox.com"
  );
  const payload = await fetchJson(endpoint, {
    cache: "no-store",
    credentials: "include",
    headers: { Accept: "application/json" }
  });
  if (!Array.isArray(payload?.data)) {
    throw new RobloxApiError(502);
  }
  return normalizeFriendListItems(payload.data);
}

async function fetchFriendIdsFromPaginatedEndpoint(viewerUserId) {
  const friendItems = [];
  const seenCursors = new Set();
  let cursor = null;
  let pageCount = 0;

  do {
    const endpoint = new URL(
      `/v1/users/${viewerUserId}/friends/find`,
      "https://friends.roblox.com"
    );
    endpoint.searchParams.set("limit", String(FRIEND_PAGE_SIZE));
    if (cursor) {
      endpoint.searchParams.set("cursor", cursor);
    }

    const payload = await fetchJson(endpoint, {
      cache: "no-store",
      credentials: "include",
      headers: { Accept: "application/json" }
    });
    const pageItems = payload?.PageItems ?? payload?.pageItems;
    if (!Array.isArray(pageItems)) {
      throw new RobloxApiError(502);
    }

    friendItems.push(...pageItems);

    const nextCursor = payload?.NextCursor ?? payload?.nextCursor ?? null;
    cursor = typeof nextCursor === "string" && nextCursor ? nextCursor : null;
    pageCount += 1;

    if (cursor) {
      if (seenCursors.has(cursor) || pageCount > 25) {
        throw new RobloxApiError(502);
      }
      seenCursors.add(cursor);
    }
  } while (cursor);

  return normalizeFriendListItems(friendItems);
}

function mergeFriendListResults(results) {
  const userIds = [];
  const seenUserIds = new Set();
  const profilesByUserId = new Map();

  for (const result of results) {
    for (const userId of result.userIds) {
      if (!seenUserIds.has(userId)) {
        seenUserIds.add(userId);
        userIds.push(userId);
      }

      const profile = result.profilesByUserId.get(userId);
      if (!profile) {
        continue;
      }
      const previousProfile = profilesByUserId.get(userId);
      profilesByUserId.set(
        userId,
        Object.freeze({
          userId,
          names: Object.freeze({
            username:
              previousProfile?.names?.username || profile.names?.username || "",
            combinedName:
              previousProfile?.names?.combinedName ||
              profile.names?.combinedName ||
              ""
          }),
          isVerified:
            previousProfile?.isVerified === true || profile.isVerified === true,
          isVerifiedKnown:
            previousProfile?.isVerifiedKnown === true ||
            profile.isVerifiedKnown === true,
          hasRobloxSubscription:
            previousProfile?.hasRobloxSubscription === true ||
            profile.hasRobloxSubscription === true,
          isRobloxPlusKnown:
            previousProfile?.isRobloxPlusKnown === true ||
            profile.isRobloxPlusKnown === true,
          isDeleted:
            previousProfile?.isDeleted === true || profile.isDeleted === true
        })
      );
    }
  }

  return { userIds, profilesByUserId };
}

async function loadAllFriendIds(viewerUserId) {
  const [paginatedResult, listResult] = await Promise.allSettled([
    fetchFriendIdsFromPaginatedEndpoint(viewerUserId),
    fetchFriendIdsFromListEndpoint(viewerUserId)
  ]);
  // Cursor pagination defines the complete ordering. The legacy list response is
  // still useful as a fast source of names, but it can stop at 200 friends and
  // must never stand in for a failed complete request.
  if (paginatedResult.status !== "fulfilled") {
    if (
      paginatedResult.reason?.status === 401 ||
      listResult.reason?.status === 401
    ) {
      throw new RobloxApiError(401);
    }
    throw paginatedResult.reason || new RobloxApiError(502);
  }

  const successfulResults = [paginatedResult.value];
  if (listResult.status === "fulfilled") {
    successfulResults.push(listResult.value);
  }

  const { userIds, profilesByUserId } = mergeFriendListResults(successfulResults);

  friendIdsCache = {
    viewerUserId,
    expiresAt: Date.now() + FRIEND_IDS_CACHE_TTL_MS,
    userIds,
    profilesByUserId
  };
  return userIds;
}

function fetchAllFriendIds(viewerUserId, forceRefresh = false) {
  const normalizedViewerUserId = normalizeId(viewerUserId);
  if (!normalizedViewerUserId) {
    return Promise.reject(new RobloxApiError(400));
  }

  if (forceRefresh && friendIdsCache?.viewerUserId === normalizedViewerUserId) {
    friendIdsCache = null;
  }

  const now = Date.now();
  if (
    !forceRefresh &&
    friendIdsCache?.viewerUserId === normalizedViewerUserId &&
    friendIdsCache.expiresAt > now
  ) {
    return Promise.resolve(friendIdsCache.userIds);
  }

  const pendingRequest = friendIdsRequestsByViewer.get(normalizedViewerUserId);
  if (pendingRequest) {
    return pendingRequest;
  }

  const request = loadAllFriendIds(normalizedViewerUserId).finally(() => {
    if (friendIdsRequestsByViewer.get(normalizedViewerUserId) === request) {
      friendIdsRequestsByViewer.delete(normalizedViewerUserId);
    }
  });
  friendIdsRequestsByViewer.set(normalizedViewerUserId, request);
  return request;
}

async function fetchFriendPresences(userIds) {
  const presences = new Map();
  const batches = [];

  for (let index = 0; index < userIds.length; index += PRESENCE_BATCH_SIZE) {
    batches.push(userIds.slice(index, index + PRESENCE_BATCH_SIZE));
  }

  await runWithConcurrency(batches, PRESENCE_REQUEST_CONCURRENCY, async (batch) => {
    const payload = await fetchJson("https://presence.roblox.com/v1/presence/users", {
      method: "POST",
      cache: "no-store",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ userIds: batch.map(Number) })
    });

    if (!Array.isArray(payload?.userPresences)) {
      throw new RobloxApiError(502);
    }

    for (const presence of payload.userPresences) {
      const userId = normalizeId(presence?.userId);
      const presenceType = Number(presence?.userPresenceType);
      if (userId && presenceType >= 1 && presenceType <= 3) {
        presences.set(userId, presence);
      }
    }
  });

  return presences;
}

async function fetchUserProfiles(userIds) {
  const profiles = new Map();
  let verificationComplete = true;
  let robloxPlusComplete = true;

  for (let index = 0; index < userIds.length; index += PROFILE_BATCH_SIZE) {
    const batch = userIds.slice(index, index + PROFILE_BATCH_SIZE);

    try {
      const payload = await fetchJson(
        "https://apis.roblox.com/user-profile-api/v1/user/profiles/get-profiles",
        {
          method: "POST",
          cache: "no-store",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            userIds: batch.map(Number),
            fields: [
              "names.combinedName",
              "names.username",
              "isVerified",
              "hasRobloxSubscription",
              "isDeleted"
            ]
          })
        }
      );

      const returnedUserIds = new Set();
      for (const profile of Array.isArray(payload?.profileDetails) ? payload.profileDetails : []) {
        const userId = normalizeId(profile?.userId);
        if (userId) {
          returnedUserIds.add(userId);
          profiles.set(userId, {
            ...profile,
            isVerifiedKnown: typeof profile?.isVerified === "boolean",
            isRobloxPlusKnown:
              typeof profile?.hasRobloxSubscription === "boolean"
          });
        }
      }
      if (
        batch.some(
          (userId) =>
            !returnedUserIds.has(userId) ||
            profiles.get(userId)?.isVerifiedKnown !== true
        )
      ) {
        verificationComplete = false;
      }
      if (
        batch.some(
          (userId) =>
            !returnedUserIds.has(userId) ||
            profiles.get(userId)?.isRobloxPlusKnown !== true
        )
      ) {
        robloxPlusComplete = false;
      }
    } catch {
      // Names are decorative; placeholders keep the exact presence count usable.
      verificationComplete = false;
      robloxPlusComplete = false;
    }
  }

  profiles.verificationComplete = verificationComplete;
  profiles.robloxPlusComplete = robloxPlusComplete;
  return profiles;
}

function makeOnlineFriend(userId, presence, profile, headshotUrl) {
  const username =
    typeof profile?.names?.username === "string" ? profile.names.username.trim() : "";
  const displayName =
    typeof profile?.names?.combinedName === "string"
      ? profile.names.combinedName.trim()
      : "";
  const presenceType = Number(presence?.userPresenceType);

  return {
    userId,
    username: username || displayName || `User ${userId}`,
    displayName: displayName || username || `User ${userId}`,
    isVerified: profile?.isVerified === true,
    isVerifiedKnown: profile?.isVerifiedKnown === true,
    isRobloxPlus: profile?.hasRobloxSubscription === true,
    isRobloxPlusKnown: profile?.isRobloxPlusKnown === true,
    presenceType: presenceType === 2 ? "InGame" : presenceType === 3 ? "InStudio" : "Online",
    lastLocation:
      typeof presence?.lastLocation === "string"
        ? presence.lastLocation.trim().slice(0, 300)
        : "",
    placeId: normalizeOptionalId(presence?.placeId),
    rootPlaceId: normalizeOptionalId(presence?.rootPlaceId),
    universeId: normalizeOptionalId(presence?.universeId),
    gameInstanceId: normalizeGameInstanceId(presence?.gameId),
    headshotUrl: headshotUrl || null
  };
}

function makeOfflineFriend(userId, profile, headshotUrl) {
  const username =
    typeof profile?.names?.username === "string" ? profile.names.username.trim() : "";
  const displayName =
    typeof profile?.names?.combinedName === "string"
      ? profile.names.combinedName.trim()
      : "";

  return {
    userId,
    username: username || displayName || `User ${userId}`,
    displayName: displayName || username || `User ${userId}`,
    isVerified: profile?.isVerified === true,
    isVerifiedKnown: profile?.isVerifiedKnown === true,
    isRobloxPlus: profile?.hasRobloxSubscription === true,
    isRobloxPlusKnown: profile?.isRobloxPlusKnown === true,
    presenceType: "Offline",
    lastLocation: "",
    placeId: null,
    rootPlaceId: null,
    universeId: null,
    gameInstanceId: null,
    headshotUrl: headshotUrl || null
  };
}

function reuseOnlineFriendDetails(friend, previousFriend) {
  if (!previousFriend || previousFriend.userId !== friend.userId) {
    return friend;
  }

  const placeholder = `User ${friend.userId}`;
  return {
    ...friend,
    username:
      friend.username !== placeholder
        ? friend.username
        : previousFriend.username || friend.username,
    displayName:
      friend.displayName !== placeholder
        ? friend.displayName
        : previousFriend.displayName || friend.displayName,
    isVerified:
      friend.isVerifiedKnown === true
        ? friend.isVerified === true
        : previousFriend.isVerifiedKnown === true
          ? previousFriend.isVerified === true
          : false,
    isVerifiedKnown:
      friend.isVerifiedKnown === true || previousFriend.isVerifiedKnown === true,
    isRobloxPlus:
      friend.isRobloxPlusKnown === true
        ? friend.isRobloxPlus === true
        : previousFriend.isRobloxPlusKnown === true
          ? previousFriend.isRobloxPlus === true
          : false,
    isRobloxPlusKnown:
      friend.isRobloxPlusKnown === true || previousFriend.isRobloxPlusKnown === true,
    universeId: friend.universeId,
    headshotUrl: isSafeThumbnailUrl(previousFriend.headshotUrl)
      ? previousFriend.headshotUrl
      : friend.headshotUrl
  };
}

function startOnlineFriendsEnrichment(
  viewerUserId,
  generation,
  onlineUserIds,
  presences,
  seedProfiles
) {
  const request = Promise.all([
    fetchUserProfiles(onlineUserIds),
    fetchAvatarHeadshots(onlineUserIds)
  ])
    .then(([profiles, headshots]) => {
      if (
        onlineFriendsCache?.viewerUserId !== viewerUserId ||
        onlineFriendsCache.generation !== generation
      ) {
        return null;
      }

      const friends = onlineUserIds.map((userId) =>
        makeOnlineFriend(
          userId,
          presences.get(userId),
          profiles.get(userId) || seedProfiles.get(userId),
          headshots.get(userId)
        )
      );
      const response = {
        ...onlineFriendsCache.response,
        detailsComplete: true,
        verificationComplete: friends.every(
          (friend) => friend.isVerifiedKnown === true
        ),
        robloxPlusComplete: friends.every(
          (friend) => friend.isRobloxPlusKnown === true
        ),
        friends
      };
      onlineFriendsCache.response = response;
      return response;
    })
    .catch(() => onlineFriendsCache?.response || null)
    .finally(() => {
      if (onlineFriendsEnrichmentInFlight?.promise === request) {
        onlineFriendsEnrichmentInFlight = null;
      }
    });

  onlineFriendsEnrichmentInFlight = { viewerUserId, generation, promise: request };
  return request;
}

function makeOfflineFriendsResponse(cache = onlineFriendsCache) {
  return {
    ok: true,
    viewerUserId: cache.viewerUserId,
    scannedFriendTotal: cache.response.scannedFriendTotal,
    onlineTotal: cache.response.onlineTotal,
    offlineTotal: cache.response.offlineTotal,
    fetchedAt: cache.response.fetchedAt,
    detailsComplete: cache.offlineDetailsComplete,
    verificationComplete: cache.offlineFriends.every(
      (friend) => friend.isVerifiedKnown === true
    ),
    robloxPlusComplete: cache.offlineFriends.every(
      (friend) => friend.isRobloxPlusKnown === true
    ),
    friends: cache.offlineFriends
  };
}

function startOfflineFriendsEnrichment(
  viewerUserId,
  generation,
  offlineUserIds,
  seedProfiles = new Map()
) {
  const request = Promise.all([
    fetchUserProfiles(offlineUserIds),
    fetchAvatarHeadshots(offlineUserIds)
  ])
    .then(([profiles, headshots]) => {
      if (
        onlineFriendsCache?.viewerUserId !== viewerUserId ||
        onlineFriendsCache.generation !== generation
      ) {
        return null;
      }

      onlineFriendsCache.offlineFriends = offlineUserIds.map((userId) =>
        makeOfflineFriend(
          userId,
          profiles.get(userId) || seedProfiles.get(userId),
          headshots.get(userId)
        )
      );
      onlineFriendsCache.offlineDetailsComplete = true;
      onlineFriendsCache.offlineDetailsReusable = offlineUserIds.every(
        (userId) =>
          profiles.get(userId)?.isVerifiedKnown === true &&
          profiles.get(userId)?.isRobloxPlusKnown === true &&
          headshots.has(userId)
      );
      onlineFriendsCache.response = {
        ...onlineFriendsCache.response,
        offlineFriends: onlineFriendsCache.offlineFriends,
        offlineDetailsComplete: true,
        offlineVerificationComplete: onlineFriendsCache.offlineFriends.every(
          (friend) => friend.isVerifiedKnown === true
        ),
        offlineRobloxPlusComplete: onlineFriendsCache.offlineFriends.every(
          (friend) => friend.isRobloxPlusKnown === true
        )
      };
      return makeOfflineFriendsResponse(onlineFriendsCache);
    })
    .catch(() =>
      onlineFriendsCache?.viewerUserId === viewerUserId
        ? makeOfflineFriendsResponse(onlineFriendsCache)
        : null
    )
    .finally(() => {
      if (offlineFriendsEnrichmentInFlight?.promise === request) {
        offlineFriendsEnrichmentInFlight = null;
      }
    });

  offlineFriendsEnrichmentInFlight = { viewerUserId, generation, promise: request };
  return request;
}

async function getAuthenticatedViewerUserId() {
  if (authenticatedUserRequest) {
    return authenticatedUserRequest;
  }

  const request = fetchJson("https://users.roblox.com/v1/users/authenticated", {
    cache: "no-store",
    credentials: "include",
    headers: { Accept: "application/json" }
  })
    .then((authenticatedUser) => {
      const userId = normalizeId(authenticatedUser?.id);
      if (!userId) {
        throw new RobloxApiError(401);
      }
      return userId;
    })
    .finally(() => {
      if (authenticatedUserRequest === request) {
        authenticatedUserRequest = null;
      }
    });

  authenticatedUserRequest = request;
  return request;
}

function normalizeQuickSettingOptionValue(rawOption) {
  if (typeof rawOption === "string") {
    return rawOption;
  }
  if (!rawOption || typeof rawOption !== "object") {
    return "";
  }
  if (
    (Array.isArray(rawOption.requiredActions) && rawOption.requiredActions.length > 0) ||
    (typeof rawOption.requirement === "string" &&
      rawOption.requirement !== "SelfUpdateSetting")
  ) {
    return "";
  }
  const candidate =
    rawOption.option && typeof rawOption.option === "object"
      ? rawOption.option
      : rawOption;
  if (
    (Array.isArray(candidate.requiredActions) && candidate.requiredActions.length > 0) ||
    (typeof candidate.requirement === "string" &&
      candidate.requirement !== "SelfUpdateSetting")
  ) {
    return "";
  }
  for (const key of ["optionValue", "value", "name", "id"]) {
    if (typeof candidate[key] === "string") {
      return candidate[key];
    }
  }
  return "";
}

function normalizeQuickSettingsPayload(payload) {
  const source =
    payload?.settings && typeof payload.settings === "object"
      ? payload.settings
      : payload?.settingsAndOptions && typeof payload.settingsAndOptions === "object"
        ? payload.settingsAndOptions
        : payload;
  const settings = {};
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return settings;
  }

  for (const [alias, spec] of Object.entries(QUICK_SETTING_SPECS)) {
    const rawSetting = source[spec.apiKey];
    const currentValue =
      typeof rawSetting === "string"
        ? rawSetting
        : typeof rawSetting?.currentValue === "string"
          ? rawSetting.currentValue
          : typeof rawSetting?.value === "string"
            ? rawSetting.value
            : "";
    if (!spec.allowedValues.includes(currentValue)) {
      continue;
    }

    const rawOptions = Array.isArray(rawSetting?.options)
      ? rawSetting.options
      : Array.isArray(rawSetting?.allowedValues)
        ? rawSetting.allowedValues
        : [];
    const options = [];
    const seen = new Set();
    for (const rawOption of rawOptions) {
      const option = normalizeQuickSettingOptionValue(rawOption);
      if (
        spec.allowedValues.includes(option) &&
        !seen.has(option)
      ) {
        seen.add(option);
        options.push(option);
      }
    }
    if (!seen.has(currentValue)) {
      options.unshift(currentValue);
    }

    settings[alias] = {
      value: currentValue,
      options,
      editable: options.some((option) => option !== currentValue)
    };
  }
  return settings;
}

function canApplyQuickSettingValue(setting, targetValue) {
  return Boolean(
    setting &&
      (setting.value === targetValue ||
        (setting.editable === true && setting.options.includes(targetValue)))
  );
}

async function fetchQuickSettingsJson(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), QUICK_SETTINGS_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      throw new RobloxApiError(
        response.status,
        parseRetryAfterMilliseconds(response.headers.get("Retry-After"))
      );
    }
    try {
      return await response.json();
    } catch {
      throw new QuickSettingsError("INVALID_RESPONSE");
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchQuickSettingsViewerUserId() {
  const authenticatedUser = await fetchQuickSettingsJson(
    "https://users.roblox.com/v1/users/authenticated",
    {
      method: "GET",
      cache: "no-store",
      credentials: "include",
      headers: { Accept: "application/json" }
    }
  );
  const viewerUserId = normalizeId(authenticatedUser?.id);
  if (!viewerUserId) {
    throw new RobloxApiError(401);
  }
  return viewerUserId;
}

async function fetchQuickSettingsValues() {
  const payload = await fetchQuickSettingsJson(QUICK_SETTINGS_OPTIONS_URL, {
    method: "GET",
    cache: "no-store",
    credentials: "include",
    headers: { Accept: "application/json" }
  });
  const settings = normalizeQuickSettingsPayload(payload);
  if (Object.keys(settings).length === 0) {
    throw new QuickSettingsError("INVALID_RESPONSE");
  }
  return settings;
}

function clearQuickSettingsCsrfToken(viewerUserId = null) {
  if (
    viewerUserId !== null &&
    quickSettingsCsrfViewerUserId !== viewerUserId
  ) {
    return;
  }
  quickSettingsCsrfViewerUserId = null;
  quickSettingsCsrfToken = "";
}

async function fetchVerifiedQuickSettingsSnapshot() {
  const viewerUserId = await fetchQuickSettingsViewerUserId();
  const settings = await fetchQuickSettingsValues();
  const confirmedViewerUserId = await fetchQuickSettingsViewerUserId();
  if (confirmedViewerUserId !== viewerUserId) {
    clearQuickSettingsCsrfToken();
    throw new QuickSettingsError("ACCOUNT_CHANGED");
  }
  return { viewerUserId, settings };
}

async function fetchStableQuickSettingsSnapshot() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (quickSettingsPendingWriteCount > 0) {
      await quickSettingsWriteTail.catch(() => undefined);
    }
    const observedGeneration = quickSettingsWriteGeneration;
    const snapshot = await fetchVerifiedQuickSettingsSnapshot();
    if (
      quickSettingsPendingWriteCount === 0 &&
      observedGeneration === quickSettingsWriteGeneration
    ) {
      return snapshot;
    }
  }
  throw new QuickSettingsError("BUSY");
}

function getQuickSettingsSnapshot() {
  if (quickSettingsReadRequest) {
    return quickSettingsReadRequest;
  }
  const request = fetchStableQuickSettingsSnapshot()
    .then(discardArmedCurrentExperienceWhenOnline)
    .finally(() => {
      if (quickSettingsReadRequest === request) {
        quickSettingsReadRequest = null;
      }
    });
  quickSettingsReadRequest = request;
  return request;
}

function isValidQuickSettingsCsrfToken(rawToken) {
  return (
    typeof rawToken === "string" &&
    /^[\x21-\x7e]{1,2048}$/.test(rawToken)
  );
}

async function fetchQuickSettingsUpdate(body, csrfToken = "") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), QUICK_SETTINGS_FETCH_TIMEOUT_MS);
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json"
  };
  if (csrfToken) {
    headers["x-csrf-token"] = csrfToken;
  }

  try {
    return await fetch(QUICK_SETTINGS_UPDATE_URL, {
      method: "POST",
      cache: "no-store",
      credentials: "include",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function postQuickSettings(viewerUserId, updates) {
  let token =
    quickSettingsCsrfViewerUserId === viewerUserId
      ? quickSettingsCsrfToken
      : "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetchQuickSettingsUpdate(updates, token);
    if (response.ok) {
      return;
    }

    const responseToken = response.headers.get("x-csrf-token") || "";
    if (
      response.status === 403 &&
      attempt === 0 &&
      isValidQuickSettingsCsrfToken(responseToken)
    ) {
      const confirmedViewerUserId = await fetchQuickSettingsViewerUserId();
      if (confirmedViewerUserId !== viewerUserId) {
        clearQuickSettingsCsrfToken();
        throw new QuickSettingsError("ACCOUNT_CHANGED");
      }
      quickSettingsCsrfViewerUserId = viewerUserId;
      quickSettingsCsrfToken = responseToken;
      token = responseToken;
      continue;
    }
    if (response.status === 401) {
      clearQuickSettingsCsrfToken(viewerUserId);
    }
    throw new RobloxApiError(response.status);
  }
  throw new QuickSettingsError("UNCONFIRMED");
}

function postQuickSetting(viewerUserId, apiKey, value) {
  return postQuickSettings(viewerUserId, { [apiKey]: value });
}

function isAmbiguousQuickSettingsWriteError(error) {
  return (
    error?.name === "AbortError" ||
    error instanceof TypeError ||
    (typeof error?.status === "number" && error.status >= 500)
  );
}

async function applyQuickSettingUpdate(
  viewerUserId,
  alias,
  expectedValue,
  requestedValue,
  companionGuard = null,
  beforeWrite = null
) {
  const spec = QUICK_SETTING_SPECS[alias];
  if (!spec) {
    throw new QuickSettingsError("INVALID");
  }

  const authenticatedViewerUserId = await fetchQuickSettingsViewerUserId();
  if (authenticatedViewerUserId !== viewerUserId) {
    clearQuickSettingsCsrfToken();
    throw new QuickSettingsError("ACCOUNT_CHANGED");
  }

  const beforeSettings = await fetchQuickSettingsValues();
  const preWriteViewerUserId = await fetchQuickSettingsViewerUserId();
  if (preWriteViewerUserId !== viewerUserId) {
    clearQuickSettingsCsrfToken();
    throw new QuickSettingsError("ACCOUNT_CHANGED");
  }
  const before = beforeSettings[alias];
  if (!before || !before.editable || !before.options.includes(requestedValue)) {
    throw new QuickSettingsError("UNAVAILABLE");
  }
  if (before.value !== expectedValue) {
    throw new QuickSettingsError("CONFLICT");
  }
  if (
    companionGuard &&
    beforeSettings[companionGuard.alias]?.value !== companionGuard.expectedValue
  ) {
    throw new QuickSettingsError("CONFLICT");
  }
  if (requestedValue === expectedValue) {
    return { viewerUserId, settings: beforeSettings, previousSettings: beforeSettings };
  }

  if (typeof beforeWrite === "function") {
    await beforeWrite({ viewerUserId, settings: beforeSettings });
    // The callback can await extension storage. Recheck the authenticated
    // account immediately before sending a mutation with its current cookies.
    await assertQuickSettingsViewer(viewerUserId);
  }

  try {
    await postQuickSetting(viewerUserId, spec.apiKey, requestedValue);
  } catch (error) {
    if (!isAmbiguousQuickSettingsWriteError(error)) {
      throw error;
    }
    try {
      const reconciledSettings = await fetchQuickSettingsValues();
      const reconciledViewerUserId = await fetchQuickSettingsViewerUserId();
      if (reconciledViewerUserId !== viewerUserId) {
        clearQuickSettingsCsrfToken();
        throw new QuickSettingsError("ACCOUNT_CHANGED");
      }
      const reconciled = reconciledSettings[alias];
      if (reconciled?.value === requestedValue) {
        if (
          companionGuard?.requireAfter === true &&
          reconciledSettings[companionGuard.alias]?.value !==
            companionGuard.expectedValue
        ) {
          throw new QuickSettingsError("PARTIAL");
        }
        return {
          viewerUserId,
          settings: reconciledSettings,
          previousSettings: beforeSettings
        };
      }
      if (!reconciled) {
        throw new QuickSettingsError("UNCONFIRMED");
      }
      if (reconciled.value !== expectedValue) {
        throw new QuickSettingsError("CONFLICT");
      }
    } catch (reconcileError) {
      if (reconcileError instanceof QuickSettingsError) {
        throw reconcileError;
      }
      throw new QuickSettingsError("UNCONFIRMED");
    }
    throw error;
  }

  let afterSettings;
  try {
    afterSettings = await fetchQuickSettingsValues();
  } catch {
    throw new QuickSettingsError("UNCONFIRMED");
  }
  const confirmedViewerUserId = await fetchQuickSettingsViewerUserId();
  if (confirmedViewerUserId !== viewerUserId) {
    clearQuickSettingsCsrfToken();
    throw new QuickSettingsError("ACCOUNT_CHANGED");
  }
  if (afterSettings[alias]?.value !== requestedValue) {
    throw new QuickSettingsError("UNCONFIRMED");
  }
  if (
    companionGuard?.requireAfter === true &&
    afterSettings[companionGuard.alias]?.value !== companionGuard.expectedValue
  ) {
    throw new QuickSettingsError("PARTIAL");
  }
  return { viewerUserId, settings: afterSettings, previousSettings: beforeSettings };
}

function readQuickSettingsExperiencePreferences() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(
      { [QUICK_SETTINGS_EXPERIENCE_PREFERENCES_STORAGE_KEY]: {} },
      (result) => {
        const readError = chrome.runtime.lastError;
        if (readError) {
          reject(new Error(readError.message));
          return;
        }
        const raw = result?.[QUICK_SETTINGS_EXPERIENCE_PREFERENCES_STORAGE_KEY];
        const preferences = Object.create(null);
        const now = Date.now();
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          for (const [rawViewerUserId, rawRecord] of Object.entries(raw)) {
            const storedViewerUserId = normalizeId(rawViewerUserId);
            const value = typeof rawRecord?.value === "string"
              ? rawRecord.value
              : "";
            const armedAt = Number(rawRecord?.armedAt);
            if (
              storedViewerUserId &&
              QUICK_SETTING_SPECS.currentExperience.allowedValues.includes(value) &&
              Number.isFinite(armedAt) &&
              armedAt > 0 &&
              armedAt <= now + 60_000 &&
              now - armedAt <= QUICK_SETTINGS_EXPERIENCE_RESTORE_MAX_AGE_MS
            ) {
              preferences[storedViewerUserId] = { value, armedAt };
            }
          }
        }
        resolve(preferences);
      }
    );
  });
}

async function readPreferredCurrentExperience(viewerUserId) {
  await quickSettingsExperiencePreferenceWriteTail.catch(() => undefined);
  if (invalidQuickSettingsExperienceRestoreViewerIds.has(viewerUserId)) {
    return null;
  }
  const preferences = await readQuickSettingsExperiencePreferences();
  return preferences[viewerUserId]?.value || null;
}

function writePreferredCurrentExperience(viewerUserId, value) {
  if (
    !normalizeId(viewerUserId) ||
    !QUICK_SETTING_SPECS.currentExperience.allowedValues.includes(value)
  ) {
    return Promise.resolve();
  }
  const write = quickSettingsExperiencePreferenceWriteTail
    .catch(() => undefined)
    .then(async () => {
      const preferences = await readQuickSettingsExperiencePreferences();
      preferences[viewerUserId] = { value, armedAt: Date.now() };
      try {
        await new Promise((resolve, reject) => {
          chrome.storage.local.set(
            {
              [QUICK_SETTINGS_EXPERIENCE_PREFERENCES_STORAGE_KEY]: {
                ...preferences
              }
            },
            () => {
              const writeError = chrome.runtime.lastError;
              if (writeError) {
                reject(new Error(writeError.message));
                return;
              }
              resolve();
            }
          );
        });
        invalidQuickSettingsExperienceRestoreViewerIds.delete(viewerUserId);
      } catch (error) {
        invalidQuickSettingsExperienceRestoreViewerIds.add(viewerUserId);
        throw error;
      }
    });
  quickSettingsExperiencePreferenceWriteTail = write.catch(() => undefined);
  return write;
}

function clearPreferredCurrentExperience(viewerUserId) {
  if (!normalizeId(viewerUserId)) {
    return Promise.resolve();
  }
  const write = quickSettingsExperiencePreferenceWriteTail
    .catch(() => undefined)
    .then(async () => {
      const preferences = await readQuickSettingsExperiencePreferences();
      delete preferences[viewerUserId];
      try {
        await new Promise((resolve, reject) => {
          chrome.storage.local.set(
            {
              [QUICK_SETTINGS_EXPERIENCE_PREFERENCES_STORAGE_KEY]: {
                ...preferences
              }
            },
            () => {
              const writeError = chrome.runtime.lastError;
              if (writeError) {
                reject(new Error(writeError.message));
                return;
              }
              resolve();
            }
          );
        });
        invalidQuickSettingsExperienceRestoreViewerIds.delete(viewerUserId);
      } catch (error) {
        invalidQuickSettingsExperienceRestoreViewerIds.add(viewerUserId);
        throw error;
      }
    });
  quickSettingsExperiencePreferenceWriteTail = write.catch(() => undefined);
  return write;
}

async function discardArmedCurrentExperienceWhenOnline(snapshot) {
  const onlineStatus = snapshot?.settings?.onlineStatus?.value;
  if (
    onlineStatus !== "NoOne" &&
    QUICK_SETTING_SPECS.onlineStatus.allowedValues.includes(onlineStatus)
  ) {
    try {
      const preferredCurrentExperience =
        await readPreferredCurrentExperience(snapshot.viewerUserId);
      if (!preferredCurrentExperience) return snapshot;

      // Run cleanup in the same queue as every production settings mutation.
      // If an Online -> No one write won the race, the live recheck preserves
      // the fresh record; if cleanup runs first, that later write re-arms it.
      await enqueueQuickSettingsWrite(async () => {
        const confirmedSettings = await fetchQuickSettingsValuesForViewer(
          snapshot.viewerUserId
        );
        const confirmedOnlineStatus = confirmedSettings.onlineStatus?.value;
        if (
          confirmedOnlineStatus !== "NoOne" &&
          QUICK_SETTING_SPECS.onlineStatus.allowedValues.includes(
            confirmedOnlineStatus
          )
        ) {
          await clearPreferredCurrentExperience(snapshot.viewerUserId);
        }
      });
    } catch {
      // A read-only Roblox snapshot must not fail because local cleanup did.
    }
  }
  return snapshot;
}

async function applyDirectQuickSettingUpdate(
  viewerUserId,
  alias,
  expectedValue,
  requestedValue
) {
  return applyQuickSettingUpdate(
    viewerUserId,
    alias,
    expectedValue,
    requestedValue,
    null,
    alias === "currentExperience"
      ? async () => {
          try {
            await clearPreferredCurrentExperience(viewerUserId);
          } catch {
            throw new QuickSettingsError("LOCAL_STORAGE");
          }
        }
      : null
  );
}

async function applyOnlineStatusUpdate(
  viewerUserId,
  expectedOnlineStatus,
  expectedCurrentExperience,
  requestedOnlineStatus
) {
  if (expectedOnlineStatus === requestedOnlineStatus) {
    throw new QuickSettingsError("INVALID");
  }
  let preferredCurrentExperience = null;

  const onlineResult = await applyQuickSettingUpdate(
    viewerUserId,
    "onlineStatus",
    expectedOnlineStatus,
    requestedOnlineStatus,
    {
      alias: "currentExperience",
      expectedValue: expectedCurrentExperience
    },
    async () => {
      try {
        if (requestedOnlineStatus === "NoOne") {
          await clearPreferredCurrentExperience(viewerUserId);
        } else if (expectedOnlineStatus === "NoOne") {
          preferredCurrentExperience =
            await readPreferredCurrentExperience(viewerUserId);
          if (preferredCurrentExperience) {
            await clearPreferredCurrentExperience(viewerUserId);
          }
        }
      } catch {
        throw new QuickSettingsError("LOCAL_STORAGE");
      }
    }
  );
  const previousCurrentExperience =
    onlineResult.previousSettings?.currentExperience?.value || null;
  if (
    !QUICK_SETTING_SPECS.currentExperience.allowedValues.includes(
      previousCurrentExperience
    )
  ) {
    throw new QuickSettingsError("INVALID_RESPONSE");
  }

  if (requestedOnlineStatus === "NoOne") {
    let remembered = false;
    if (
      QUICK_SETTING_SPECS.currentExperience.allowedValues.includes(
        previousCurrentExperience
      )
    ) {
      try {
        await writePreferredCurrentExperience(
          viewerUserId,
          previousCurrentExperience
        );
        remembered = true;
      } catch {
        // The stale record was cleared before the Roblox mutation, so a failed
        // save cannot cause an older, broader preference to be restored later.
      }
    }
    return {
      viewerUserId,
      settings: onlineResult.settings,
      experienceRestore: remembered ? "remembered" : "notRemembered"
    };
  }

  const liveExperience = onlineResult.settings.currentExperience;
  const desiredCurrentExperience =
    expectedOnlineStatus === "NoOne"
      ? preferredCurrentExperience ?? previousCurrentExperience
      : previousCurrentExperience;
  if (liveExperience?.value === desiredCurrentExperience) {
    return {
      viewerUserId,
      settings: onlineResult.settings,
      experienceRestore: "unchanged"
    };
  }

  if (!canApplyQuickSettingValue(liveExperience, desiredCurrentExperience)) {
    return {
      viewerUserId,
      settings: onlineResult.settings,
      experienceRestore: "unavailable"
    };
  }

  try {
    const restoredResult = await applyQuickSettingUpdate(
      viewerUserId,
      "currentExperience",
      liveExperience.value,
      desiredCurrentExperience,
      {
        alias: "onlineStatus",
        expectedValue: requestedOnlineStatus,
        requireAfter: true
      }
    );
    return {
      viewerUserId,
      settings: restoredResult.settings,
      experienceRestore: "restored"
    };
  } catch (error) {
    if (error?.code === "ACCOUNT_CHANGED") {
      throw error;
    }
    if (error?.code === "PARTIAL") {
      try {
        const unsafeSettings = await fetchQuickSettingsValuesForViewer(
          viewerUserId
        );
        if (
          unsafeSettings.currentExperience?.value === desiredCurrentExperience &&
          desiredCurrentExperience !== "NoOne"
        ) {
          await applyQuickSettingUpdate(
            viewerUserId,
            "currentExperience",
            desiredCurrentExperience,
            liveExperience.value
          );
        }
      } catch (rollbackError) {
        if (rollbackError?.code === "ACCOUNT_CHANGED") {
          throw rollbackError;
        }
        // Reconciliation below returns Roblox's actual state if the
        // privacy-tightening rollback could not be confirmed.
      }
    }
    try {
      const reconciledSettings = await fetchQuickSettingsValuesForViewer(
        viewerUserId
      );
      return {
        viewerUserId,
        settings: reconciledSettings,
        experienceRestore:
          reconciledSettings.onlineStatus?.value === requestedOnlineStatus &&
          reconciledSettings.currentExperience?.value === desiredCurrentExperience
            ? "restored"
            : "failed"
      };
    } catch (reconcileError) {
      if (reconcileError?.code === "ACCOUNT_CHANGED") {
        throw reconcileError;
      }
      // The restore POST may have committed even though its confirmation read
      // failed. Do not report the pre-restore snapshot as current state.
      throw new QuickSettingsError("UNCONFIRMED");
    }
  }
}

async function assertQuickSettingsViewer(viewerUserId) {
  const confirmedViewerUserId = await fetchQuickSettingsViewerUserId();
  if (confirmedViewerUserId !== viewerUserId) {
    clearQuickSettingsCsrfToken();
    throw new QuickSettingsError("ACCOUNT_CHANGED");
  }
}

async function fetchQuickSettingsValuesForViewer(viewerUserId) {
  const settings = await fetchQuickSettingsValues();
  await assertQuickSettingsViewer(viewerUserId);
  return settings;
}

function getQuickSettingsErrorCode(error) {
  if (error instanceof QuickSettingsError) return error.code;
  if (error?.status === 401) return "UNAUTHENTICATED";
  if (error?.status === 403) return "FORBIDDEN";
  if (error?.status === 429) return "RATE_LIMITED";
  if ([400, 404, 422].includes(error?.status)) return "UNAVAILABLE";
  if (error?.status === 409) return "CONFLICT";
  if (typeof error?.status === "number" && error.status >= 500) {
    return "ROBLOX_UNAVAILABLE";
  }
  return "NETWORK";
}

function readBestFriendIds(viewerUserId) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get({ [BEST_FRIENDS_STORAGE_KEY]: {} }, (result) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message));
        return;
      }

      const storedByViewer = result?.[BEST_FRIENDS_STORAGE_KEY];
      const rawIds =
        storedByViewer && typeof storedByViewer === "object"
          ? storedByViewer[viewerUserId]
          : null;
      const ids = [];
      const seen = new Set();
      for (const rawId of Array.isArray(rawIds) ? rawIds : []) {
        const userId = normalizeId(rawId);
        if (userId && !seen.has(userId)) {
          seen.add(userId);
          ids.push(userId);
        }
        if (ids.length >= MAX_BEST_FRIENDS) {
          break;
        }
      }
      resolve(ids);
    });
  });
}

async function getViewerCanChat() {
  try {
    const metadata = await fetchJson(CHAT_METADATA_URL, {
      cache: "no-store",
      credentials: "include",
      headers: { Accept: "application/json" }
    });
    return metadata?.isChatUserMessagesEnabled === true;
  } catch {
    // Roblox omits Chat when its capability request fails, so RoTool does too.
    return false;
  }
}

async function getBestFriendsContext() {
  const viewerUserId = await getAuthenticatedViewerUserId();
  const [storedUserIds, canChat] = await Promise.all([
    readBestFriendIds(viewerUserId),
    getViewerCanChat()
  ]);
  if (storedUserIds.length === 0) {
    return {
      ok: true,
      viewerUserId,
      canChat,
      selectedUserIds: [],
      staleUserIds: [],
      verificationComplete: true,
      robloxPlusComplete: true,
      friends: []
    };
  }

  const currentFriendIds = new Set(await fetchAllFriendIds(viewerUserId));
  const selectedUserIds = storedUserIds.filter((userId) => currentFriendIds.has(userId));
  const staleUserIds = storedUserIds.filter((userId) => !currentFriendIds.has(userId));
  if (selectedUserIds.length === 0) {
    return {
      ok: true,
      viewerUserId,
      canChat,
      selectedUserIds,
      staleUserIds,
      verificationComplete: true,
      robloxPlusComplete: true,
      friends: []
    };
  }

  const [presences, profiles, headshots] = await Promise.all([
    fetchFriendPresences(selectedUserIds),
    fetchUserProfiles(selectedUserIds),
    fetchAvatarHeadshots(selectedUserIds)
  ]);
  const friends = selectedUserIds.map((userId) => {
    const presence = presences.get(userId);
    return presence
      ? makeOnlineFriend(userId, presence, profiles.get(userId), headshots.get(userId))
      : makeOfflineFriend(userId, profiles.get(userId), headshots.get(userId));
  });

  return {
    ok: true,
    viewerUserId,
    canChat,
    selectedUserIds,
    staleUserIds,
    verificationComplete: friends.every(
      (friend) => friend.isVerifiedKnown === true
    ),
    robloxPlusComplete: friends.every(
      (friend) => friend.isRobloxPlusKnown === true
    ),
    friends
  };
}

async function fetchAllOnlineFriends(forceRefresh = false) {
  const viewerUserId = await getAuthenticatedViewerUserId();

  const now = Date.now();
  if (
    !forceRefresh &&
    onlineFriendsCache?.viewerUserId === viewerUserId &&
    onlineFriendsCache.expiresAt > now
  ) {
    return onlineFriendsCache.response;
  }

  const friendIds = await fetchAllFriendIds(viewerUserId, forceRefresh);
  const seedProfiles =
    friendIdsCache?.viewerUserId === viewerUserId
      ? friendIdsCache.profilesByUserId || new Map()
      : new Map();
  const presences = await fetchFriendPresences(friendIds);
  const onlineUserIds = friendIds.filter((userId) => presences.has(userId));
  const offlineUserIds = friendIds.filter((userId) => !presences.has(userId));
  const previousFriends = new Map(
    onlineFriendsCache?.viewerUserId === viewerUserId
      ? onlineFriendsCache.response.friends.map((friend) => [friend.userId, friend])
      : []
  );
  const previousOfflineFriends = new Map(
    onlineFriendsCache?.viewerUserId === viewerUserId
      ? (onlineFriendsCache.offlineFriends || []).map((friend) => [friend.userId, friend])
      : []
  );
  const friends = onlineUserIds.map((userId) => {
    const friend = makeOnlineFriend(
      userId,
      presences.get(userId),
      seedProfiles.get(userId),
      null
    );
    return reuseOnlineFriendDetails(friend, previousFriends.get(userId));
  });
  const offlineFriends = offlineUserIds.map((userId) => {
    const friend = makeOfflineFriend(userId, seedProfiles.get(userId), null);
    return reuseOnlineFriendDetails(friend, previousOfflineFriends.get(userId));
  });
  const offlineDetailsReusable =
    onlineFriendsCache?.viewerUserId === viewerUserId &&
    onlineFriendsCache.offlineDetailsReusable === true &&
    previousOfflineFriends.size === offlineUserIds.length &&
    offlineUserIds.every((userId) => previousOfflineFriends.has(userId));
  const offlineDetailsComplete = offlineDetailsReusable;
  const generation = ++onlineFriendsGeneration;

  const response = {
    ok: true,
    viewerUserId,
    friendUserIds: friendIds.slice(),
    scannedFriendTotal: friendIds.length,
    onlineTotal: friends.length,
    offlineTotal: offlineFriends.length,
    fetchedAt: Date.now(),
    detailsComplete: false,
    verificationComplete: friends.every(
      (friend) => friend.isVerifiedKnown === true
    ),
    robloxPlusComplete: friends.every(
      (friend) => friend.isRobloxPlusKnown === true
    ),
    friends,
    offlineDetailsComplete,
    offlineVerificationComplete: offlineFriends.every(
      (friend) => friend.isVerifiedKnown === true
    ),
    offlineRobloxPlusComplete: offlineFriends.every(
      (friend) => friend.isRobloxPlusKnown === true
    ),
    offlineFriends
  };
  onlineFriendsCache = {
    viewerUserId,
    generation,
    expiresAt: Date.now() + ONLINE_FRIENDS_CACHE_TTL_MS,
    response,
    offlineUserIds,
    offlineFriends,
    seedProfiles,
    offlineDetailsComplete,
    offlineDetailsReusable
  };
  void startOnlineFriendsEnrichment(
    viewerUserId,
    generation,
    onlineUserIds,
    presences,
    seedProfiles
  );
  return response;
}

function getAllOnlineFriends(forceRefresh = false) {
  if (onlineFriendsInFlight) {
    return onlineFriendsInFlight;
  }

  const request = fetchAllOnlineFriends(forceRefresh).finally(() => {
    if (onlineFriendsInFlight === request) {
      onlineFriendsInFlight = null;
    }
  });
  onlineFriendsInFlight = request;
  return request;
}

async function getOnlineFriendsDetails(viewerUserId) {
  const normalizedViewerUserId = normalizeId(viewerUserId);
  if (!normalizedViewerUserId || onlineFriendsCache?.viewerUserId !== normalizedViewerUserId) {
    throw new RobloxApiError(409);
  }

  if (
    onlineFriendsEnrichmentInFlight?.viewerUserId === normalizedViewerUserId &&
    onlineFriendsEnrichmentInFlight.generation === onlineFriendsCache.generation
  ) {
    await onlineFriendsEnrichmentInFlight.promise;
  }

  return onlineFriendsCache.response;
}

async function getOfflineFriendsDetails(viewerUserId) {
  const normalizedViewerUserId = normalizeId(viewerUserId);
  if (!normalizedViewerUserId || onlineFriendsCache?.viewerUserId !== normalizedViewerUserId) {
    throw new RobloxApiError(409);
  }

  if (!onlineFriendsCache.offlineDetailsComplete) {
    if (
      offlineFriendsEnrichmentInFlight?.viewerUserId === normalizedViewerUserId &&
      offlineFriendsEnrichmentInFlight.generation === onlineFriendsCache.generation
    ) {
      await offlineFriendsEnrichmentInFlight.promise;
    } else {
      await startOfflineFriendsEnrichment(
        normalizedViewerUserId,
        onlineFriendsCache.generation,
        onlineFriendsCache.offlineUserIds,
        onlineFriendsCache.seedProfiles
      );
    }
  }

  return makeOfflineFriendsResponse(onlineFriendsCache);
}

function getFriendFilterSessionStorageArea() {
  const area = chrome.storage?.session;
  return area && typeof area.get === "function" && typeof area.set === "function"
    ? area
    : null;
}

function pruneFriendFilterSessionCache(now = Date.now()) {
  for (const [key, entry] of friendFilterSessionCache) {
    if (
      typeof key !== "string" ||
      !entry ||
      !Number.isFinite(entry.expiresAt) ||
      entry.expiresAt <= now
    ) {
      friendFilterSessionCache.delete(key);
    }
  }

  if (friendFilterSessionCache.size <= FRIEND_FILTER_SESSION_CACHE_MAX_ENTRIES) {
    return;
  }

  const oldestEntries = [...friendFilterSessionCache.entries()].sort(
    (left, right) => left[1].expiresAt - right[1].expiresAt
  );
  const removeCount =
    friendFilterSessionCache.size - FRIEND_FILTER_SESSION_CACHE_MAX_ENTRIES;
  for (let index = 0; index < removeCount; index += 1) {
    friendFilterSessionCache.delete(oldestEntries[index][0]);
  }
}

function ensureFriendFilterSessionCacheLoaded() {
  if (friendFilterSessionCacheLoaded) {
    return Promise.resolve();
  }
  if (friendFilterSessionCacheLoadPromise) {
    return friendFilterSessionCacheLoadPromise;
  }

  const area = getFriendFilterSessionStorageArea();
  if (!area) {
    friendFilterSessionCacheLoaded = true;
    return Promise.resolve();
  }

  const request = new Promise((resolve) => {
    try {
      area.get({ [FRIEND_FILTER_SESSION_STORAGE_KEY]: null }, (result) => {
        const runtimeError = chrome.runtime?.lastError;
        if (!runtimeError) {
          const stored = result?.[FRIEND_FILTER_SESSION_STORAGE_KEY];
          const entries =
            stored?.version === FRIEND_FILTER_SESSION_STORAGE_VERSION &&
            stored.entries &&
            typeof stored.entries === "object"
              ? stored.entries
              : null;
          if (entries) {
            const now = Date.now();
            for (const [key, entry] of Object.entries(entries)) {
              if (
                typeof key === "string" &&
                key.length <= 120 &&
                entry &&
                Number.isFinite(entry.expiresAt) &&
                entry.expiresAt > now &&
                Number.isSafeInteger(entry.value) &&
                entry.value >= 0
              ) {
                friendFilterSessionCache.set(key, {
                  value: entry.value,
                  expiresAt: entry.expiresAt
                });
              }
            }
          }
        }
        friendFilterSessionCacheLoaded = true;
        resolve();
      });
    } catch {
      friendFilterSessionCacheLoaded = true;
      resolve();
    }
  }).finally(() => {
    if (friendFilterSessionCacheLoadPromise === request) {
      friendFilterSessionCacheLoadPromise = null;
    }
  });

  friendFilterSessionCacheLoadPromise = request;
  return request;
}

async function readFriendFilterSessionCache(key) {
  await ensureFriendFilterSessionCacheLoaded();
  const entry = friendFilterSessionCache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    friendFilterSessionCache.delete(key);
    return null;
  }
  return entry.value;
}

function setFriendFilterSessionCache(
  key,
  value,
  ttlMs = FRIEND_FILTER_SESSION_CACHE_TTL_MS
) {
  if (
    typeof key !== "string" ||
    key.length > 120 ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    return;
  }
  friendFilterSessionCache.set(key, {
    value,
    expiresAt: Date.now() + Math.max(1_000, Number(ttlMs) || 1_000)
  });
}

function writeFriendFilterSessionCache() {
  const area = getFriendFilterSessionStorageArea();
  if (!area) {
    return Promise.resolve();
  }

  const write = friendFilterSessionCacheWriteTail
    .catch(() => undefined)
    .then(async () => {
      await ensureFriendFilterSessionCacheLoaded();
      pruneFriendFilterSessionCache();
      const entries = Object.fromEntries(friendFilterSessionCache);
      await new Promise((resolve) => {
        try {
          area.set(
            {
              [FRIEND_FILTER_SESSION_STORAGE_KEY]: {
                version: FRIEND_FILTER_SESSION_STORAGE_VERSION,
                entries
              }
            },
            resolve
          );
        } catch {
          resolve();
        }
      });
    });
  friendFilterSessionCacheWriteTail = write.catch(() => undefined);
  return write;
}

function parseFriendFilterRetryAfter(response) {
  const now = Date.now();
  const retryAfter = response?.headers?.get?.("retry-after") || "";
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(
      FRIEND_FILTER_RATE_LIMIT_MAX_MS,
      Math.ceil(seconds * 1_000)
    );
  }
  const retryAt = Date.parse(retryAfter);
  if (Number.isFinite(retryAt) && retryAt > now) {
    return Math.min(FRIEND_FILTER_RATE_LIMIT_MAX_MS, retryAt - now);
  }
  const resetSeconds = parseFirstRateLimitHeaderNumber(
    response?.headers?.get?.("x-ratelimit-reset")
  );
  return resetSeconds === null
    ? FRIEND_FILTER_RATE_LIMIT_FALLBACK_MS
    : Math.min(
        FRIEND_FILTER_RATE_LIMIT_MAX_MS,
        Math.ceil(resetSeconds * 1_000) + 750
      );
}

function updateFriendFilterRateLimitFromResponse(response) {
  const remaining = parseFirstRateLimitHeaderNumber(
    response?.headers?.get?.("x-ratelimit-remaining")
  );
  if (
    response?.status !== 429 &&
    (remaining === null || remaining > FRIEND_FILTER_RATE_LIMIT_RESERVE)
  ) {
    return;
  }
  friendFilterRateLimitedUntil = Math.max(
    friendFilterRateLimitedUntil,
    Date.now() + parseFriendFilterRetryAfter(response)
  );
}

function reserveFriendFilterRequestSlot() {
  const reservation = friendFilterRequestGateTail
    .catch(() => undefined)
    .then(async () => {
      const now = Date.now();
      if (friendFilterRateLimitedUntil > now) {
        throw new FriendFilterError(
          "RATE_LIMITED",
          429,
          friendFilterRateLimitedUntil - now
        );
      }
      const delay = Math.max(0, friendFilterNextRequestAt - now);
      if (delay > 0) {
        await wait(delay);
      }
      friendFilterNextRequestAt = Date.now() + FRIEND_FILTER_REQUEST_INTERVAL_MS;
    });
  friendFilterRequestGateTail = reservation.catch(() => undefined);
  return reservation;
}

async function fetchFriendFilterJson(url, options = {}) {
  await reserveFriendFilterRequestSlot();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(url, { ...options, signal: controller.signal });
  } catch {
    throw new FriendFilterError("NETWORK");
  } finally {
    clearTimeout(timeout);
  }

  updateFriendFilterRateLimitFromResponse(response);
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Some Roblox errors intentionally have no JSON body.
  }

  if (!response.ok) {
    const apiCodes = Array.isArray(payload?.errors)
      ? payload.errors
          .map((entry) => Number(entry?.code))
          .filter((code) => Number.isSafeInteger(code))
      : [];
    throw new FriendFilterError(
      getFriendFilterErrorCode({ status: response.status }),
      response.status,
      response.status === 429 ? parseFriendFilterRetryAfter(response) : 0,
      apiCodes
    );
  }
  if (!payload || typeof payload !== "object") {
    throw new FriendFilterError("ROBLOX_UNAVAILABLE", 502);
  }
  return payload;
}

function getFriendFilterErrorCode(error) {
  if (typeof error?.code === "string" && error.code) {
    return error.code;
  }
  if (error?.status === 400) return "INVALID";
  if (error?.status === 401) return "UNAUTHENTICATED";
  if (error?.status === 403) return "PRIVACY_OR_REGION";
  if (error?.status === 404) return "NOT_FOUND";
  if (error?.status === 409) return "STALE";
  if (error?.status === 429) return "RATE_LIMITED";
  if (typeof error?.status === "number" && error.status >= 500) {
    return "ROBLOX_UNAVAILABLE";
  }
  return "NETWORK";
}

function sanitizeFriendFilterText(value) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, FRIEND_LIST_NAME_MAX_LENGTH)
    : "";
}

function normalizeFriendFilterInput(value) {
  const input = typeof value === "string" ? value.trim() : "";
  return input && input.length <= FRIEND_FILTER_INPUT_MAX_LENGTH ? input : null;
}

function getFriendFilterUserProfile(userId) {
  return getCachedLookup(friendFilterUserResolutionCache, `id:${userId}`, async () => {
    const endpoint = new URL(`/v1/users/${userId}`, "https://users.roblox.com");
    const profile = await fetchJson(endpoint, {
      cache: "no-store",
      credentials: "omit",
      headers: { Accept: "application/json" }
    });
    const resolvedUserId = normalizeId(profile?.id);
    if (!resolvedUserId) {
      throw new FriendFilterError("NOT_FOUND", 404);
    }
    const username = sanitizeFriendFilterText(profile?.name);
    const displayName = sanitizeFriendFilterText(profile?.displayName);
    return {
      userId: resolvedUserId,
      username: username || displayName || `User ${resolvedUserId}`,
      displayName: displayName || username || `User ${resolvedUserId}`,
      isVerified: profile?.hasVerifiedBadge === true,
      isVerifiedKnown: typeof profile?.hasVerifiedBadge === "boolean"
    };
  });
}

async function resolveFriendFilterUser(rawInput) {
  const input = normalizeFriendFilterInput(rawInput);
  if (!input) {
    throw new FriendFilterError("INVALID", 400);
  }

  const numericUserId = normalizeId(input);
  if (numericUserId) {
    return getFriendFilterUserProfile(numericUserId);
  }

  if (/^https:\/\//i.test(input)) {
    const parsed = parseRobloxContextUrl(input);
    const userId = normalizeId(parsed?.userId);
    if (!userId) {
      throw new FriendFilterError("INVALID", 400);
    }
    return getFriendFilterUserProfile(userId);
  }

  const username = input.replace(/^@+/, "");
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
    throw new FriendFilterError("INVALID", 400);
  }

  return getCachedLookup(
    friendFilterUserResolutionCache,
    `name:${username.toLowerCase()}`,
    async () => {
      const payload = await fetchJson(
        "https://users.roblox.com/v1/usernames/users",
        {
          method: "POST",
          cache: "no-store",
          credentials: "omit",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            usernames: [username],
            excludeBannedUsers: false
          })
        }
      );
      const result = Array.isArray(payload?.data) ? payload.data[0] : null;
      const userId = normalizeId(result?.id);
      if (!userId) {
        throw new FriendFilterError("NOT_FOUND", 404);
      }
      const resolvedUsername = sanitizeFriendFilterText(result?.name);
      const displayName = sanitizeFriendFilterText(result?.displayName);
      return {
        userId,
        username: resolvedUsername || username,
        displayName: displayName || resolvedUsername || username,
        isVerified: result?.hasVerifiedBadge === true,
        isVerifiedKnown: typeof result?.hasVerifiedBadge === "boolean"
      };
    }
  );
}

async function fetchFriendFilterGameDetails(universeId, fallbackPlaceId = null) {
  const details = await getCachedLookup(
    friendFilterGameResolutionCache,
    `universe:${universeId}`,
    async () => {
      const endpoint = new URL("/v1/games", "https://games.roblox.com");
      endpoint.searchParams.set("universeIds", universeId);
      const payload = await fetchJson(endpoint, {
        cache: "no-store",
        credentials: "omit",
        headers: { Accept: "application/json" }
      });
      const game = Array.isArray(payload?.data)
        ? payload.data.find((entry) => normalizeId(entry?.id) === universeId) || null
        : null;
      if (!game) {
        throw new FriendFilterError("NOT_FOUND", 404);
      }
      const rootPlaceId = normalizeId(game?.rootPlaceId);
      return {
        universeId,
        placeId: rootPlaceId || null,
        rootPlaceId: rootPlaceId || null,
        name: sanitizeFriendFilterText(game?.name) || `Experience ${universeId}`
      };
    }
  );
  const requestedPlaceId = normalizeId(fallbackPlaceId);
  return requestedPlaceId ? { ...details, placeId: requestedPlaceId } : details;
}

function normalizeFriendFilterGameName(value) {
  const name = sanitizeFriendFilterText(value);
  if (!name) {
    return "";
  }
  try {
    return name.normalize("NFKC").toLocaleLowerCase("en-US");
  } catch {
    return name.toLowerCase();
  }
}

function getFriendFilterGameSearchCandidates(payload) {
  const groups = Array.isArray(payload?.searchResults)
    ? payload.searchResults
    : [];
  const candidates = [];
  const seenUniverseIds = new Set();

  for (const group of groups) {
    const groupType = String(group?.contentGroupType || "")
      .trim()
      .toLowerCase();
    if (!["game", "games", "experience", "experiences"].includes(groupType)) {
      continue;
    }
    const contents = Array.isArray(group?.contents) ? group.contents : [];
    for (const content of contents.slice(0, 50)) {
      const universeId = normalizeId(content?.universeId);
      if (!universeId || seenUniverseIds.has(universeId)) {
        continue;
      }
      const name = sanitizeFriendFilterText(content?.name);
      if (!name) {
        continue;
      }
      seenUniverseIds.add(universeId);
      candidates.push({
        universeId,
        rootPlaceId: normalizeId(content?.rootPlaceId),
        name
      });
    }
  }
  return candidates;
}

function makeFriendFilterGameSearchSessionId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `rsl-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

function searchFriendFilterGameByName(rawName) {
  const query = sanitizeFriendFilterText(rawName);
  const normalizedQuery = normalizeFriendFilterGameName(query);
  if (!query || !normalizedQuery) {
    return Promise.reject(new FriendFilterError("INVALID", 400));
  }

  return getCachedLookup(
    friendFilterGameResolutionCache,
    `search:${normalizedQuery}`,
    async () => {
      const endpoint = new URL(
        "/search-api/omni-search",
        "https://apis.roblox.com"
      );
      endpoint.searchParams.set("searchQuery", query);
      endpoint.searchParams.set("sessionId", makeFriendFilterGameSearchSessionId());
      endpoint.searchParams.set("pageType", "all");
      const payload = await fetchFriendFilterJson(endpoint, {
        cache: "no-store",
        credentials: "omit",
        headers: { Accept: "application/json" }
      });
      const candidates = getFriendFilterGameSearchCandidates(payload);
      const exactMatches = candidates.filter(
        (candidate) =>
          normalizeFriendFilterGameName(candidate.name) === normalizedQuery
      );
      const selected = exactMatches[0] || candidates[0];
      if (!selected) {
        throw new FriendFilterError("NOT_FOUND", 404);
      }
      return fetchFriendFilterGameDetails(selected.universeId);
    }
  );
}

async function resolveFriendFilterGame(rawInput, rawUniverseId = null) {
  const explicitUniverseId = normalizeId(rawUniverseId);
  if (explicitUniverseId) {
    return fetchFriendFilterGameDetails(explicitUniverseId);
  }

  const input = normalizeFriendFilterInput(rawInput);
  if (!input) {
    throw new FriendFilterError("INVALID", 400);
  }

  let placeId = normalizeId(input);
  const looksLikeUrl = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(input);
  if (!placeId && /^https:\/\//i.test(input)) {
    const parsed = parseRobloxContextUrl(input);
    placeId = normalizeId(parsed?.placeId);
  }
  if (!placeId) {
    if (looksLikeUrl) {
      throw new FriendFilterError("INVALID", 400);
    }
    return searchFriendFilterGameByName(input);
  }

  let universeId;
  try {
    universeId = await resolveUniverseId(placeId);
  } catch (error) {
    const code = getFriendFilterErrorCode(error);
    // A bare numeric value is ambiguous: it may be a Place ID or a Universe
    // ID. Only fall back after Roblox definitively says it is not a place;
    // transient/auth/rate failures must remain unknown instead of being masked.
    if (code === "NOT_FOUND") {
      return fetchFriendFilterGameDetails(placeId);
    }
    throw new FriendFilterError(
      code,
      error?.status || 0,
      Math.max(0, Number(error?.retryAfterMs) || 0)
    );
  }
  return fetchFriendFilterGameDetails(universeId, placeId);
}

function pruneFriendFilterScanSnapshots(now = Date.now()) {
  for (const [key, snapshot] of friendFilterScanSnapshots) {
    if (!snapshot || snapshot.expiresAt <= now) {
      friendFilterScanSnapshots.delete(key);
    }
  }
  if (friendFilterScanSnapshots.size <= FRIEND_FILTER_SCAN_MAX_ENTRIES) {
    return;
  }
  const oldest = [...friendFilterScanSnapshots.entries()].sort(
    (left, right) => left[1].expiresAt - right[1].expiresAt
  );
  const removeCount =
    friendFilterScanSnapshots.size - FRIEND_FILTER_SCAN_MAX_ENTRIES;
  for (let index = 0; index < removeCount; index += 1) {
    friendFilterScanSnapshots.delete(oldest[index][0]);
  }
}

function makeFriendFilterScanId() {
  friendFilterScanSequence = (friendFilterScanSequence + 1) % 0x7fffffff;
  return `rsl-${Date.now().toString(36)}-${friendFilterScanSequence.toString(36)}`;
}

function normalizeFriendFilterScanId(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const scanId = typeof value === "string" ? value.trim() : "";
  return scanId && scanId.length <= 80 && /^[A-Za-z0-9_-]+$/.test(scanId)
    ? scanId
    : undefined;
}

function makeFriendFilterViewerError(code, viewerUserId) {
  const error = new FriendFilterError(code, 409);
  error.viewerUserId = viewerUserId;
  return error;
}

function attachFriendFilterViewerError(error, viewerUserId) {
  if (error && typeof error === "object" && !normalizeId(error.viewerUserId)) {
    error.viewerUserId = viewerUserId;
  }
  return error;
}

async function getFriendFilterViewerContext(scanContext = null) {
  const viewerUserId = await getAuthenticatedViewerUserId();
  const expectedViewerUserId = scanContext?.expectedViewerUserId ?? null;
  if (expectedViewerUserId && expectedViewerUserId !== viewerUserId) {
    throw makeFriendFilterViewerError("ACCOUNT_CHANGED", viewerUserId);
  }

  if (!scanContext?.key) {
    const friendUserIds = await fetchAllFriendIds(viewerUserId);
    return { viewerUserId, friendUserIds, scanId: null };
  }

  pruneFriendFilterScanSnapshots();
  const requestedScanId = normalizeFriendFilterScanId(scanContext.requestedScanId);
  if (requestedScanId === undefined) {
    throw new FriendFilterError("INVALID", 400);
  }

  let snapshot = friendFilterScanSnapshots.get(scanContext.key) || null;
  if (scanContext.isStart === true) {
    const friendUserIds = Object.freeze([
      ...(await fetchAllFriendIds(viewerUserId))
    ]);
    snapshot = {
      scanId: makeFriendFilterScanId(),
      viewerUserId,
      friendUserIds,
      expiresAt: Date.now() + FRIEND_FILTER_SCAN_TTL_MS
    };
    friendFilterScanSnapshots.set(scanContext.key, snapshot);
    pruneFriendFilterScanSnapshots();
  } else if (!snapshot) {
    // Never reconstruct a continuation from a freshly ordered friend list.
    // The caller must restart at index/cursor zero after a service-worker reset.
    throw makeFriendFilterViewerError("STALE_SCAN", viewerUserId);
  }

  if (snapshot.viewerUserId !== viewerUserId) {
    friendFilterScanSnapshots.delete(scanContext.key);
    throw makeFriendFilterViewerError("ACCOUNT_CHANGED", viewerUserId);
  }
  if (requestedScanId && requestedScanId !== snapshot.scanId) {
    throw makeFriendFilterViewerError("STALE_SCAN", viewerUserId);
  }

  snapshot.expiresAt = Date.now() + FRIEND_FILTER_SCAN_TTL_MS;
  return {
    viewerUserId,
    friendUserIds: snapshot.friendUserIds,
    scanId: snapshot.scanId
  };
}

function releaseFriendFilterScanSnapshot(scanContext, scanId = null) {
  if (!scanContext?.key) {
    return;
  }
  const snapshot = friendFilterScanSnapshots.get(scanContext.key);
  if (!snapshot || (scanId && snapshot.scanId !== scanId)) {
    return;
  }
  friendFilterScanSnapshots.delete(scanContext.key);
}

function normalizeFriendFilterMetric(value) {
  const metric = String(value ?? "").trim().toLowerCase();
  if (
    ["followers", "most-followers", "most followers", "followercount"].includes(
      metric
    )
  ) {
    return "followers";
  }
  if (["friends", "most-friends", "most friends", "friendcount"].includes(metric)) {
    return "friends";
  }
  if (
    [
      "following",
      "followings",
      "most-following",
      "most following",
      "followingcount"
    ].includes(metric)
  ) {
    return "following";
  }
  return null;
}

async function fetchFriendFilterCount(metric, userId) {
  const path = FRIEND_FILTER_COUNT_PATHS[metric];
  if (!path || !isValidId(userId)) {
    throw new FriendFilterError("INVALID", 400);
  }
  const endpoint = new URL(
    `/v1/users/${userId}/${path}/count`,
    "https://friends.roblox.com"
  );
  const payload = await fetchFriendFilterJson(endpoint, {
    cache: "no-store",
    credentials: "omit",
    headers: { Accept: "application/json" }
  });
  const count = Number(payload?.count);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new FriendFilterError("ROBLOX_UNAVAILABLE", 502);
  }
  return count;
}

async function getFriendCountFilterChunk(
  metricValue,
  rawNextIndex = 0,
  scanContext = null
) {
  const metric = normalizeFriendFilterMetric(metricValue);
  const nextIndex = Number(rawNextIndex);
  if (!metric || !Number.isSafeInteger(nextIndex) || nextIndex < 0) {
    throw new FriendFilterError("INVALID", 400);
  }

  const { viewerUserId, friendUserIds, scanId } =
    await getFriendFilterViewerContext(scanContext);
  if (nextIndex > friendUserIds.length) {
    throw new FriendFilterError("INVALID", 400);
  }
  await ensureFriendFilterSessionCacheLoaded();

  const endIndex = Math.min(
    friendUserIds.length,
    nextIndex + FRIEND_FILTER_COUNT_CHUNK_SIZE
  );
  const items = [];
  const unknownUserIds = [];
  let cursor = nextIndex;
  let cacheChanged = false;
  let stoppedCode = "";
  let retryAfterMs = 0;

  while (cursor < endIndex) {
    const userId = friendUserIds[cursor];
    const cacheKey = `count:${metric}:${userId}`;
    const cachedCount = await readFriendFilterSessionCache(cacheKey);
    if (cachedCount !== null) {
      items.push({ userId, count: cachedCount, state: "ready" });
      cursor += 1;
      continue;
    }

    try {
      const count = await fetchFriendFilterCount(metric, userId);
      setFriendFilterSessionCache(cacheKey, count);
      cacheChanged = true;
      items.push({ userId, count, state: "ready" });
      cursor += 1;
    } catch (error) {
      const code = getFriendFilterErrorCode(error);
      if (["INVALID", "NOT_FOUND", "PRIVACY_OR_REGION"].includes(code)) {
        items.push({ userId, count: null, state: "unknown", code });
        unknownUserIds.push(userId);
        cursor += 1;
        continue;
      }
      stoppedCode = code;
      retryAfterMs = Math.max(0, Number(error?.retryAfterMs) || 0);
      break;
    }
  }

  if (cacheChanged) {
    await writeFriendFilterSessionCache();
  }
  const exhausted = cursor >= friendUserIds.length;
  const interrupted = Boolean(stoppedCode);
  if (exhausted) {
    releaseFriendFilterScanSnapshot(scanContext, scanId);
  }
  return {
    // A stopped chunk must not look retryable to the content-side paging loop
    // with an unchanged cursor. Successfully completed earlier chunks remain
    // cached, while the caller gets an explicit partial failure to surface.
    ok: !interrupted,
    status: interrupted || unknownUserIds.length > 0 ? "partial" : "ready",
    code: stoppedCode || (unknownUserIds.length > 0 ? "INCOMPLETE" : ""),
    viewerUserId,
    scanId,
    metric,
    items,
    unknownUserIds,
    completed: cursor,
    total: friendUserIds.length,
    nextIndex: cursor,
    exhausted,
    complete: exhausted && !interrupted && unknownUserIds.length === 0,
    retryAfterMs
  };
}

function normalizeFriendshipStatus(value) {
  if (Number.isSafeInteger(value) && value >= 0 && value <= 3) {
    return value;
  }
  const status = String(value ?? "").trim().toLowerCase();
  if (status === "friends") return 1;
  if (status === "requestsent") return 2;
  if (status === "requestreceived") return 3;
  if (status === "notfriends") return 0;
  return null;
}

async function fetchFriendshipStatuses(targetUserId, candidateUserIds) {
  if (candidateUserIds.length === 0) {
    return new Map();
  }

  const endpoint = new URL(
    `/v1/users/${targetUserId}/friends/statuses`,
    "https://friends.roblox.com"
  );
  endpoint.searchParams.set("userIds", candidateUserIds.join(","));

  try {
    const payload = await fetchFriendFilterJson(endpoint, {
      cache: "no-store",
      credentials: "include",
      headers: { Accept: "application/json" }
    });
    if (!Array.isArray(payload?.data)) {
      throw new FriendFilterError("ROBLOX_UNAVAILABLE", 502);
    }
    const statuses = new Map();
    const requestedIds = new Set(candidateUserIds);
    for (const entry of payload.data) {
      const userId = normalizeId(entry?.id);
      const status = normalizeFriendshipStatus(entry?.status);
      if (userId && requestedIds.has(userId) && status !== null) {
        statuses.set(userId, status);
      }
    }
    return statuses;
  } catch (error) {
    // Keep the relationship check bounded to one Roblox request per batch.
    // If Roblox declines a batch, its rows remain unknown instead of fanning
    // out into dozens of individual retries.
    throw error;
  }
}

async function getFriendshipFilterBatch(
  targetValue,
  rawNextIndex = 0,
  scanContext = null
) {
  const targetUserId = normalizeId(targetValue);
  const nextIndex = Number(rawNextIndex);
  if (
    !targetUserId ||
    !Number.isSafeInteger(nextIndex) ||
    nextIndex < 0
  ) {
    throw new FriendFilterError("INVALID", 400);
  }

  const { viewerUserId, friendUserIds, scanId } =
    await getFriendFilterViewerContext(scanContext);
  if (nextIndex > friendUserIds.length) {
    throw new FriendFilterError("INVALID", 400);
  }
  await ensureFriendFilterSessionCacheLoaded();

  const endIndex = Math.min(
    friendUserIds.length,
    nextIndex + FRIEND_FILTER_FRIENDSHIP_BATCH_SIZE
  );
  const candidateUserIds = friendUserIds.slice(nextIndex, endIndex);
  const statuses = new Map();
  const missingUserIds = [];
  for (const userId of candidateUserIds) {
    const cachedStatus = await readFriendFilterSessionCache(
      `friendship:${targetUserId}:${userId}`
    );
    if (cachedStatus === null) {
      missingUserIds.push(userId);
    } else {
      statuses.set(userId, cachedStatus);
    }
  }

  let code = "";
  let retryAfterMs = 0;
  if (missingUserIds.length > 0) {
    try {
      const fetchedStatuses = await fetchFriendshipStatuses(
        targetUserId,
        missingUserIds
      );
      for (const [userId, status] of fetchedStatuses) {
        statuses.set(userId, status);
        setFriendFilterSessionCache(
          `friendship:${targetUserId}:${userId}`,
          status,
          FRIEND_FILTER_RELATIONSHIP_CACHE_TTL_MS
        );
      }
      if (fetchedStatuses.size > 0) {
        await writeFriendFilterSessionCache();
      }
    } catch (error) {
      code = getFriendFilterErrorCode(error);
      retryAfterMs = Math.max(0, Number(error?.retryAfterMs) || 0);
    }
  }

  const items = [];
  const matchedUserIds = [];
  const checkedUserIds = [];
  const unknownUserIds = [];
  for (const userId of candidateUserIds) {
    const status = statuses.get(userId);
    if (status === undefined) {
      unknownUserIds.push(userId);
      items.push({
        userId,
        value: null,
        isFriend: null,
        status: null,
        state: "unknown",
        code: code || "INCOMPLETE"
      });
      continue;
    }
    const isFriend = status === 1;
    checkedUserIds.push(userId);
    if (isFriend) {
      matchedUserIds.push(userId);
    }
    items.push({ userId, value: isFriend, isFriend, status, state: "ready" });
  }

  const exhausted = endIndex >= friendUserIds.length;
  const incomplete = unknownUserIds.length > 0;
  const status = incomplete
    ? code === "PRIVACY_OR_REGION" || code === "UNAUTHENTICATED"
      ? "unavailable"
      : "partial"
    : "ready";
  if (exhausted && !(incomplete && code)) {
    releaseFriendFilterScanSnapshot(scanContext, scanId);
  }
  return {
    // A transport/API failure leaves this chunk unknown. Report it as a
    // partial failure instead of returning an unchanged nextIndex with ok=true,
    // which could otherwise make a caller request the same chunk forever.
    ok: !code,
    status,
    code: code || (incomplete ? "INCOMPLETE" : ""),
    viewerUserId,
    scanId,
    targetUserId,
    items,
    matchedUserIds,
    checkedUserIds,
    unknownUserIds,
    completed: endIndex,
    total: friendUserIds.length,
    nextIndex: incomplete && code ? nextIndex : endIndex,
    exhausted: exhausted && !(incomplete && code),
    complete: exhausted && !incomplete,
    retryAfterMs
  };
}

function normalizeFriendFilterCursor(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const cursor = typeof value === "string" ? value.trim() : "";
  return cursor &&
    cursor.length <= FRIEND_FILTER_CURSOR_MAX_LENGTH &&
    /^[A-Za-z0-9+/_=-]+$/.test(cursor)
    ? cursor
    : undefined;
}

async function getTargetFollowerCount(targetUserId) {
  const cacheKey = `count:followers:${targetUserId}`;
  const cachedCount = await readFriendFilterSessionCache(cacheKey);
  if (cachedCount !== null) {
    return cachedCount;
  }
  const count = await fetchFriendFilterCount("followers", targetUserId);
  setFriendFilterSessionCache(cacheKey, count, FRIEND_FILTER_RELATIONSHIP_CACHE_TTL_MS);
  await writeFriendFilterSessionCache();
  return count;
}

async function fetchTargetFollowersPage(targetUserId, cursor) {
  const endpoint = new URL(
    `/v1/users/${targetUserId}/followers`,
    "https://friends.roblox.com"
  );
  endpoint.searchParams.set("limit", String(FRIEND_FILTER_FOLLOWERS_PAGE_SIZE));
  endpoint.searchParams.set("sortOrder", "Asc");
  if (cursor) {
    endpoint.searchParams.set("cursor", cursor);
  }
  const payload = await fetchFriendFilterJson(endpoint, {
    cache: "no-store",
    credentials: "include",
    headers: { Accept: "application/json" }
  });
  if (!Array.isArray(payload?.data)) {
    throw new FriendFilterError("ROBLOX_UNAVAILABLE", 502);
  }
  const userIds = [];
  const seen = new Set();
  for (const entry of payload.data) {
    const userId = normalizeId(entry?.id);
    if (userId && !seen.has(userId)) {
      seen.add(userId);
      userIds.push(userId);
    }
  }
  const nextCursor = normalizeFriendFilterCursor(payload?.nextPageCursor);
  if (nextCursor === undefined) {
    throw new FriendFilterError("ROBLOX_UNAVAILABLE", 502);
  }
  return { userIds, rawCount: payload.data.length, nextCursor };
}

async function getTargetFollowersFilterChunk(
  targetValue,
  rawCursor = null,
  rawScanned = 0,
  scanContext = null
) {
  const targetUserId = normalizeId(targetValue);
  const cursor = normalizeFriendFilterCursor(rawCursor);
  const scanned = Number(rawScanned);
  if (
    !targetUserId ||
    cursor === undefined ||
    !Number.isSafeInteger(scanned) ||
    scanned < 0 ||
    scanned > FRIEND_FILTER_FOLLOWERS_MAX_RESULTS
  ) {
    throw new FriendFilterError("INVALID", 400);
  }

  const { viewerUserId, friendUserIds, scanId } =
    await getFriendFilterViewerContext(scanContext);
  await ensureFriendFilterSessionCacheLoaded();
  let followerCount;
  try {
    followerCount = await getTargetFollowerCount(targetUserId);
  } catch (error) {
    throw attachFriendFilterViewerError(error, viewerUserId);
  }
  if (followerCount > FRIEND_FILTER_FOLLOWERS_MAX_RESULTS) {
    releaseFriendFilterScanSnapshot(scanContext, scanId);
    return {
      ok: false,
      status: "unavailable",
      code: "TARGET_TOO_LARGE",
      viewerUserId,
      scanId,
      targetUserId,
      matchedUserIds: [],
      scanned,
      total: followerCount,
      nextCursor: null,
      exhausted: true,
      complete: false,
      limit: FRIEND_FILTER_FOLLOWERS_MAX_RESULTS
    };
  }
  if (followerCount === 0) {
    releaseFriendFilterScanSnapshot(scanContext, scanId);
    return {
      ok: true,
      status: "ready",
      code: "",
      viewerUserId,
      scanId,
      targetUserId,
      matchedUserIds: [],
      scanned: 0,
      total: 0,
      nextCursor: null,
      exhausted: true,
      complete: true,
      candidateUserIds: friendUserIds.slice()
    };
  }

  const friendSet = new Set(friendUserIds);
  const matched = new Set();
  const seenCursors = new Set();
  let nextCursor = cursor;
  let scannedCount = scanned;
  let pageCount = 0;

  do {
    if (nextCursor && seenCursors.has(nextCursor)) {
      throw new FriendFilterError("ROBLOX_UNAVAILABLE", 502);
    }
    if (nextCursor) {
      seenCursors.add(nextCursor);
    }
    let page;
    try {
      page = await fetchTargetFollowersPage(targetUserId, nextCursor);
    } catch (error) {
      throw attachFriendFilterViewerError(error, viewerUserId);
    }
    for (const userId of page.userIds) {
      if (friendSet.has(userId)) {
        matched.add(userId);
      }
    }
    scannedCount += page.rawCount;
    nextCursor = page.nextCursor;
    pageCount += 1;
    if (scannedCount > FRIEND_FILTER_FOLLOWERS_MAX_RESULTS) {
      releaseFriendFilterScanSnapshot(scanContext, scanId);
      return {
        ok: false,
        status: "unavailable",
        code: "TARGET_TOO_LARGE",
        viewerUserId,
        scanId,
        targetUserId,
        matchedUserIds: [...matched],
        scanned: scannedCount,
        total: followerCount,
        nextCursor: null,
        exhausted: true,
        complete: false,
        limit: FRIEND_FILTER_FOLLOWERS_MAX_RESULTS
      };
    }
  } while (
    nextCursor &&
    pageCount < FRIEND_FILTER_FOLLOWERS_PAGES_PER_CHUNK
  );

  const exhausted = !nextCursor;
  const privacyLimited = exhausted && scannedCount < followerCount;
  if (exhausted) {
    releaseFriendFilterScanSnapshot(scanContext, scanId);
  }
  return {
    ok: true,
    status: privacyLimited ? "partial" : "ready",
    code: privacyLimited ? "PRIVACY_OR_REGION" : "",
    viewerUserId,
    scanId,
    targetUserId,
    matchedUserIds: [...matched],
    scanned: scannedCount,
    total: followerCount,
    nextCursor,
    exhausted,
    complete: exhausted && !privacyLimited,
    privacyLimited,
    candidateUserIds:
      exhausted && !privacyLimited ? friendUserIds.slice() : []
  };
}

function resetFriendAggregationStateForTests() {
  friendIdsCache = null;
  friendIdsRequestsByViewer.clear();
  onlineFriendsCache = null;
  onlineFriendsInFlight = null;
  onlineFriendsEnrichmentInFlight = null;
  offlineFriendsEnrichmentInFlight = null;
  authenticatedUserRequest = null;
}

async function resetFriendFilterStateForTests() {
  friendFilterUserResolutionCache.clear();
  friendFilterGameResolutionCache.clear();
  friendFilterSessionCache.clear();
  friendFilterScanSnapshots.clear();
  friendFilterSessionCacheLoaded = false;
  friendFilterSessionCacheLoadPromise = null;
  friendFilterSessionCacheWriteTail = Promise.resolve();
  friendFilterRequestGateTail = Promise.resolve();
  friendFilterNextRequestAt = 0;
  friendFilterRateLimitedUntil = 0;
  friendFilterScanSequence = 0;

  const area = getFriendFilterSessionStorageArea();
  if (!area || typeof area.remove !== "function") {
    return;
  }
  await new Promise((resolve) => {
    try {
      area.remove(FRIEND_FILTER_SESSION_STORAGE_KEY, resolve);
    } catch {
      resolve();
    }
  });
}

function normalizeRandomServerPlaceId(value) {
  const placeId = String(value ?? "");
  if (!new RegExp(`^[1-9]\\d{0,${RANDOM_SERVER_MAX_ID_DIGITS - 1}}$`).test(placeId)) {
    return null;
  }

  const numericPlaceId = Number(placeId);
  return Number.isSafeInteger(numericPlaceId) && numericPlaceId > 0
    ? placeId
    : null;
}

function normalizeRandomServerRequestId(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function isValidRandomServerCandidate(entry) {
  return (
    normalizeGameInstanceId(entry?.id) !== null &&
    Number.isSafeInteger(entry?.playing) &&
    entry.playing >= 0 &&
    Number.isSafeInteger(entry?.maxPlayers) &&
    entry.maxPlayers > 0 &&
    entry.playing < entry.maxPlayers
  );
}

function parseRandomServerRetryAfter(response, now = Date.now()) {
  const rawValue = response?.headers?.get?.("retry-after")?.trim() || "";
  if (/^\d+(?:\.\d+)?$/.test(rawValue)) {
    const seconds = Number(rawValue);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(
        Math.ceil(seconds * 1_000),
        Number.MAX_SAFE_INTEGER - now
      );
    }
  }

  const retryAt = Date.parse(rawValue);
  if (Number.isFinite(retryAt) && retryAt > now) {
    return Math.min(retryAt - now, Number.MAX_SAFE_INTEGER - now);
  }

  return RANDOM_SERVER_RATE_LIMIT_FALLBACK_MS;
}

async function fetchRandomServerCandidates(placeId) {
  const endpoint = new URL(
    `/v1/games/${placeId}/servers/Public`,
    "https://games.roblox.com"
  );
  endpoint.searchParams.set("sortOrder", "Asc");
  endpoint.searchParams.set("excludeFullGames", "true");
  endpoint.searchParams.set("limit", "100");

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    RANDOM_SERVER_FETCH_TIMEOUT_MS
  );

  let response;
  try {
    response = await fetch(endpoint, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
  } catch {
    throw new RandomServerError("NETWORK");
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429) {
    const now = Date.now();
    randomServerRateLimitedUntil = Math.max(
      randomServerRateLimitedUntil,
      now + parseRandomServerRetryAfter(response, now)
    );
    throw new RandomServerError("RATE_LIMITED");
  }

  if (!response.ok) {
    throw new RandomServerError("ROBLOX_UNAVAILABLE");
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new RandomServerError("ROBLOX_UNAVAILABLE");
  }

  if (!Array.isArray(payload?.data)) {
    throw new RandomServerError("ROBLOX_UNAVAILABLE");
  }

  const candidates = Array.from(
    new Set(
      payload.data
        .filter(isValidRandomServerCandidate)
        .map((entry) => normalizeGameInstanceId(entry.id))
    )
  );

  if (candidates.length === 0) {
    throw new RandomServerError("NO_SERVERS");
  }

  return Object.freeze(candidates);
}

function getRandomServerCandidates(placeId) {
  const now = Date.now();
  const cached = randomServerCandidateCache.get(placeId);
  if (cached?.expiresAt > now && cached.candidates.length > 0) {
    return Promise.resolve(cached.candidates);
  }
  if (cached) {
    randomServerCandidateCache.delete(placeId);
  }

  const pending = randomServerCandidateRequests.get(placeId);
  if (pending) {
    return pending;
  }

  if (randomServerRateLimitedUntil > now) {
    return Promise.reject(new RandomServerError("RATE_LIMITED"));
  }

  const request = fetchRandomServerCandidates(placeId)
    .then((candidates) => {
      randomServerCandidateCache.set(placeId, {
        candidates,
        expiresAt: Date.now() + RANDOM_SERVER_CACHE_TTL_MS
      });
      return candidates;
    })
    .finally(() => {
      if (randomServerCandidateRequests.get(placeId) === request) {
        randomServerCandidateRequests.delete(placeId);
      }
    });
  randomServerCandidateRequests.set(placeId, request);
  return request;
}

function pickUniformRandomIndex(length) {
  if (!Number.isSafeInteger(length) || length <= 0) {
    return -1;
  }

  const range = 0x1_0000_0000;
  const limit = range - (range % length);
  if (globalThis.crypto?.getRandomValues) {
    const randomValue = new Uint32Array(1);
    do {
      globalThis.crypto.getRandomValues(randomValue);
    } while (randomValue[0] >= limit);
    return randomValue[0] % length;
  }

  return Math.floor(Math.random() * length);
}

async function getRandomPublicServer(placeId) {
  const normalizedPlaceId = normalizeRandomServerPlaceId(placeId);
  if (!normalizedPlaceId) {
    throw new RandomServerError("INVALID");
  }

  const candidates = await getRandomServerCandidates(normalizedPlaceId);
  const selectedIndex = pickUniformRandomIndex(candidates.length);
  const gameInstanceId = candidates[selectedIndex];
  if (!gameInstanceId) {
    throw new RandomServerError("NO_SERVERS");
  }

  return {
    placeId: normalizedPlaceId,
    gameInstanceId
  };
}

function getRandomServerErrorCode(error) {
  return error instanceof RandomServerError ? error.code : "NETWORK";
}

function handleRandomServerMessage(message, sendResponse) {
  if (message?.type !== RANDOM_SERVER_MESSAGE_TYPE) {
    return false;
  }

  const requestId = normalizeRandomServerRequestId(message.requestId);
  const placeId = normalizeRandomServerPlaceId(message.placeId);
  if (requestId === null || placeId === null) {
    sendResponse({
      ok: false,
      requestId: requestId ?? 0,
      placeId,
      code: "INVALID"
    });
    return false;
  }

  getRandomPublicServer(placeId)
    .then((result) => {
      sendResponse({
        ok: true,
        requestId,
        placeId: result.placeId,
        gameInstanceId: result.gameInstanceId
      });
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        requestId,
        placeId,
        code: getRandomServerErrorCode(error)
      });
    });
  return true;
}

function resetRandomServerStateForTests() {
  randomServerCandidateCache.clear();
  randomServerCandidateRequests.clear();
  randomServerRateLimitedUntil = 0;
}

function normalizeGameCcuRequestGames(rawGames) {
  if (!Array.isArray(rawGames)) {
    return null;
  }

  const games = [];
  const seenPlaceIds = new Set();
  for (const rawGame of rawGames) {
    if (games.length >= GAME_CCU_MAX_GAMES) {
      break;
    }
    if (!rawGame || typeof rawGame !== "object" || Array.isArray(rawGame)) {
      continue;
    }
    if (typeof rawGame.placeId !== "string") {
      continue;
    }
    const placeId = normalizeRandomServerPlaceId(rawGame.placeId);
    const hasUniverseId =
      rawGame.universeId !== undefined && rawGame.universeId !== null;
    if (hasUniverseId && typeof rawGame.universeId !== "string") {
      continue;
    }
    const universeId = hasUniverseId ? normalizeId(rawGame.universeId) : null;
    if (!placeId || (hasUniverseId && !universeId)) {
      continue;
    }
    if (seenPlaceIds.has(placeId)) {
      continue;
    }

    seenPlaceIds.add(placeId);
    games.push(
      rawGame.needsRating === true
        ? { placeId, universeId, needsRating: true }
        : { placeId, universeId }
    );
  }
  return games.length > 0 ? games : null;
}

async function fetchGameCcuBatch(rawUniverseIds) {
  if (
    !Array.isArray(rawUniverseIds) ||
    rawUniverseIds.length === 0 ||
    rawUniverseIds.length > GAME_CCU_MAX_GAMES
  ) {
    throw new GameCcuError("INVALID");
  }

  const universeIds = [];
  const requestedIds = new Set();
  for (const rawUniverseId of rawUniverseIds) {
    if (typeof rawUniverseId !== "string") {
      throw new GameCcuError("INVALID");
    }
    const universeId = normalizeId(rawUniverseId);
    if (!universeId) {
      throw new GameCcuError("INVALID");
    }
    if (!requestedIds.has(universeId)) {
      requestedIds.add(universeId);
      universeIds.push(universeId);
    }
  }

  const endpoint = new URL("/v1/games", "https://games.roblox.com");
  endpoint.searchParams.set("universeIds", universeIds.join(","));
  const payload = await fetchJson(endpoint, {
    cache: "no-store",
    credentials: "omit",
    headers: { Accept: "application/json" }
  });
  if (!Array.isArray(payload?.data)) {
    throw new GameCcuError("ROBLOX_UNAVAILABLE");
  }

  const counts = new Map();
  for (const entry of payload.data) {
    const universeId = normalizeId(entry?.id);
    const playing = entry?.playing;
    if (
      universeId &&
      requestedIds.has(universeId) &&
      Number.isSafeInteger(playing) &&
      playing >= 0
    ) {
      counts.set(universeId, playing);
    }
  }
  return counts;
}

async function fetchGameRatingBatch(rawUniverseIds) {
  if (
    !Array.isArray(rawUniverseIds) ||
    rawUniverseIds.length === 0 ||
    rawUniverseIds.length > GAME_CCU_MAX_GAMES
  ) {
    throw new GameCcuError("INVALID");
  }

  const universeIds = [];
  const requestedIds = new Set();
  for (const rawUniverseId of rawUniverseIds) {
    if (typeof rawUniverseId !== "string") {
      throw new GameCcuError("INVALID");
    }
    const universeId = normalizeId(rawUniverseId);
    if (!universeId) {
      throw new GameCcuError("INVALID");
    }
    if (!requestedIds.has(universeId)) {
      requestedIds.add(universeId);
      universeIds.push(universeId);
    }
  }

  const endpoint = new URL("/v1/games/votes", "https://games.roblox.com");
  endpoint.searchParams.set("universeIds", universeIds.join(","));
  const payload = await fetchJson(endpoint, {
    cache: "no-store",
    credentials: "omit",
    headers: { Accept: "application/json" }
  });
  if (!Array.isArray(payload?.data)) {
    throw new GameCcuError("ROBLOX_UNAVAILABLE");
  }

  const ratings = new Map();
  for (const entry of payload.data) {
    const universeId = normalizeId(entry?.id);
    const upVotes = entry?.upVotes;
    const downVotes = entry?.downVotes;
    if (
      !universeId ||
      !requestedIds.has(universeId) ||
      !Number.isSafeInteger(upVotes) ||
      upVotes < 0 ||
      !Number.isSafeInteger(downVotes) ||
      downVotes < 0
    ) {
      continue;
    }
    const totalVotes = BigInt(upVotes) + BigInt(downVotes);
    if (totalVotes === 0n) {
      ratings.set(universeId, null);
      continue;
    }
    const ratingPercentage = Number(
      (BigInt(upVotes) * 100n + totalVotes / 2n) / totalVotes
    );
    ratings.set(universeId, ratingPercentage);
  }
  return ratings;
}

function setBoundedGameCcuCache(universeId, playing) {
  gameCcuCache.delete(universeId);
  gameCcuCache.set(universeId, {
    playing,
    expiresAt: Date.now() + GAME_CCU_CACHE_TTL_MS
  });
  while (gameCcuCache.size > GAME_CCU_CACHE_MAX_ENTRIES) {
    gameCcuCache.delete(gameCcuCache.keys().next().value);
  }
}

function getCachedGameCcu(universeId, now = Date.now()) {
  const cached = gameCcuCache.get(universeId);
  if (!cached) {
    return { hit: false, playing: null };
  }
  if (cached.expiresAt <= now) {
    gameCcuCache.delete(universeId);
    return { hit: false, playing: null };
  }
  gameCcuCache.delete(universeId);
  gameCcuCache.set(universeId, cached);
  return { hit: true, playing: cached.playing };
}

async function getGameCcuByUniverseIds(universeIds) {
  const results = new Map();
  const pending = [];
  const uncachedIds = [];
  const now = Date.now();

  for (const universeId of universeIds) {
    const cached = getCachedGameCcu(universeId, now);
    if (cached.hit) {
      results.set(universeId, cached.playing);
      continue;
    }
    const inFlight = gameCcuRequestsByUniverseId.get(universeId);
    if (inFlight) {
      pending.push([universeId, inFlight]);
      continue;
    }
    uncachedIds.push(universeId);
  }

  if (uncachedIds.length > 0) {
    const batchRequest = fetchGameCcuBatch(uncachedIds).then((counts) => {
      for (const universeId of uncachedIds) {
        setBoundedGameCcuCache(
          universeId,
          counts.has(universeId) ? counts.get(universeId) : null
        );
      }
      return counts;
    });
    for (const universeId of uncachedIds) {
      let request;
      request = batchRequest
        .then((counts) => counts.get(universeId) ?? null)
        .finally(() => {
          if (gameCcuRequestsByUniverseId.get(universeId) === request) {
            gameCcuRequestsByUniverseId.delete(universeId);
          }
        });
      gameCcuRequestsByUniverseId.set(universeId, request);
      pending.push([universeId, request]);
    }
  }

  const settled = await Promise.all(
    pending.map(async ([universeId, request]) => [universeId, await request])
  );
  for (const [universeId, playing] of settled) {
    results.set(universeId, playing);
  }
  return results;
}

function setBoundedGameRatingCache(universeId, known, ratingPercentage) {
  gameRatingCache.delete(universeId);
  gameRatingCache.set(universeId, {
    known,
    ratingPercentage,
    expiresAt: Date.now() + GAME_RATING_CACHE_TTL_MS
  });
  while (gameRatingCache.size > GAME_RATING_CACHE_MAX_ENTRIES) {
    gameRatingCache.delete(gameRatingCache.keys().next().value);
  }
}

function getCachedGameRating(universeId, now = Date.now()) {
  const cached = gameRatingCache.get(universeId);
  if (!cached) {
    return { hit: false, known: false, ratingPercentage: null };
  }
  if (cached.expiresAt <= now) {
    gameRatingCache.delete(universeId);
    return { hit: false, known: false, ratingPercentage: null };
  }
  gameRatingCache.delete(universeId);
  gameRatingCache.set(universeId, cached);
  return {
    hit: true,
    known: cached.known === true,
    ratingPercentage: cached.ratingPercentage
  };
}

async function getGameRatingsByUniverseIds(universeIds) {
  const results = new Map();
  const pending = [];
  const uncachedIds = [];
  const now = Date.now();

  for (const universeId of universeIds) {
    const cached = getCachedGameRating(universeId, now);
    if (cached.hit) {
      if (cached.known) {
        results.set(universeId, cached.ratingPercentage);
      }
      continue;
    }
    const inFlight = gameRatingRequestsByUniverseId.get(universeId);
    if (inFlight) {
      pending.push([universeId, inFlight]);
      continue;
    }
    uncachedIds.push(universeId);
  }

  if (uncachedIds.length > 0) {
    const batchRequest = fetchGameRatingBatch(uncachedIds).then((ratings) => {
      for (const universeId of uncachedIds) {
        setBoundedGameRatingCache(
          universeId,
          ratings.has(universeId),
          ratings.has(universeId) ? ratings.get(universeId) : null
        );
      }
      return ratings;
    });
    for (const universeId of uncachedIds) {
      let request;
      request = batchRequest
        .then((ratings) => ({
          known: ratings.has(universeId),
          ratingPercentage: ratings.has(universeId)
            ? ratings.get(universeId)
            : null
        }))
        .finally(() => {
          if (gameRatingRequestsByUniverseId.get(universeId) === request) {
            gameRatingRequestsByUniverseId.delete(universeId);
          }
        });
      gameRatingRequestsByUniverseId.set(universeId, request);
      pending.push([universeId, request]);
    }
  }

  const settled = await Promise.all(
    pending.map(async ([universeId, request]) => [universeId, await request])
  );
  for (const [universeId, rating] of settled) {
    if (rating.known) {
      results.set(universeId, rating.ratingPercentage);
    }
  }
  return results;
}

async function getGameCcuForRequest(rawGames) {
  const games = normalizeGameCcuRequestGames(rawGames);
  if (!games) {
    throw new GameCcuError("INVALID");
  }

  const resolvedGames = new Array(games.length);
  await runWithConcurrency(
    games,
    GAME_CCU_RESOLVE_CONCURRENCY,
    async (game, index) => {
      let universeId = game.universeId;
      if (!universeId) {
        try {
          universeId = await resolveUniverseId(game.placeId);
        } catch {
          return;
        }
      }
      resolvedGames[index] = game.needsRating
        ? { placeId: game.placeId, universeId, needsRating: true }
        : { placeId: game.placeId, universeId };
    }
  );

  const availableGames = resolvedGames.filter(Boolean);
  if (availableGames.length === 0) {
    return [];
  }
  const universeIds = Array.from(
    new Set(availableGames.map((game) => game.universeId))
  );
  const ratingUniverseIds = Array.from(
    new Set(
      availableGames
        .filter((game) => game.needsRating)
        .map((game) => game.universeId)
    )
  );
  const [counts, ratings] = await Promise.all([
    getGameCcuByUniverseIds(universeIds),
    ratingUniverseIds.length > 0
      ? getGameRatingsByUniverseIds(ratingUniverseIds).catch(() => new Map())
      : Promise.resolve(new Map())
  ]);
  return availableGames.flatMap((game) => {
    const playing = counts.get(game.universeId);
    if (!Number.isSafeInteger(playing) || playing < 0) {
      return [];
    }
    const result = {
      placeId: game.placeId,
      universeId: game.universeId,
      playing
    };
    if (game.needsRating && ratings.has(game.universeId)) {
      const ratingPercentage = ratings.get(game.universeId);
      result.ratingKnown = true;
      result.ratingPercentage =
        Number.isSafeInteger(ratingPercentage) &&
        ratingPercentage >= 0 &&
        ratingPercentage <= 100
          ? ratingPercentage
          : null;
    }
    return [result];
  });
}

function getGameCcuErrorCode(error) {
  if (error instanceof GameCcuError) {
    return error.code;
  }
  if (error?.status === 429) {
    return "RATE_LIMITED";
  }
  if (error?.name === "AbortError" || error instanceof TypeError) {
    return "NETWORK";
  }
  return "ROBLOX_UNAVAILABLE";
}

function handleGameCcuMessage(message, sender, sendResponse) {
  if (message?.type !== GAME_CCU_MESSAGE_TYPE) {
    return false;
  }
  const requestId = normalizeRandomServerRequestId(message.requestId);
  const rawGames = message.games;
  const games =
    Array.isArray(rawGames) && rawGames.length <= GAME_CCU_MAX_GAMES
      ? normalizeGameCcuRequestGames(rawGames)
      : null;
  if (
    requestId === null ||
    !games ||
    getTrustedRobloxTopFrameTabId(sender) === null
  ) {
    sendResponse({
      ok: false,
      requestId: requestId ?? 0,
      code: "INVALID"
    });
    return false;
  }

  getGameCcuForRequest(games)
    .then((result) => {
      sendResponse({ ok: true, requestId, games: result });
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        requestId,
        code: getGameCcuErrorCode(error)
      });
    });
  return true;
}

function resetGameCcuStateForTests() {
  gameCcuCache.clear();
  gameCcuRequestsByUniverseId.clear();
  gameRatingCache.clear();
  gameRatingRequestsByUniverseId.clear();
}

function normalizeGameCcuHistoryCount(value) {
  return Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= GAME_CCU_HISTORY_UINT32_MAX
    ? value
    : null;
}

function normalizeGameCcuHistoryTimestamp(value) {
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  const bucket = Math.floor(value / GAME_CCU_HISTORY_BUCKET_MS) *
    GAME_CCU_HISTORY_BUCKET_MS;
  const seconds = bucket / 1_000;
  return Number.isSafeInteger(seconds) && seconds <= GAME_CCU_HISTORY_UINT32_MAX
    ? seconds
    : null;
}

function normalizeGameCcuHistoryObservation(rawObservation, fallbackTimestamp = Date.now()) {
  if (!rawObservation || typeof rawObservation !== "object") {
    return null;
  }
  const universeId = normalizeId(rawObservation.universeId);
  const playing = normalizeGameCcuHistoryCount(rawObservation.playing);
  const observedAt = Number.isFinite(rawObservation.observedAt)
    ? rawObservation.observedAt
    : fallbackTimestamp;
  const timestampSeconds = normalizeGameCcuHistoryTimestamp(observedAt);
  if (
    !universeId ||
    playing === null ||
    timestampSeconds === null
  ) {
    return null;
  }
  return {
    universeId,
    playing,
    timestampSeconds,
    observedAt: Math.floor(observedAt)
  };
}

function createGameCcuHistorySnapshot(rawObservations, observedAt = Date.now()) {
  if (!Array.isArray(rawObservations)) {
    return null;
  }
  const observationsByUniverse = new Map();
  for (const rawObservation of rawObservations) {
    const observation = normalizeGameCcuHistoryObservation(
      rawObservation,
      observedAt
    );
    if (!observation) {
      continue;
    }
    const numericUniverseId = Number(observation.universeId);
    if (!Number.isSafeInteger(numericUniverseId) || numericUniverseId <= 0) {
      continue;
    }
    observationsByUniverse.set(observation.universeId, {
      ...observation,
      numericUniverseId
    });
  }
  const observations = Array.from(observationsByUniverse.values()).sort(
    (left, right) => left.numericUniverseId - right.numericUniverseId
  );
  if (
    observations.length === 0 ||
    observations.length > GAME_CCU_HISTORY_MAX_CHART_GAMES
  ) {
    return null;
  }
  const timestamp = observations[0].timestampSeconds * 1_000;
  const universeIds = new Float64Array(observations.length);
  const playing = new Uint32Array(observations.length);
  for (let index = 0; index < observations.length; index += 1) {
    if (observations[index].timestampSeconds * 1_000 !== timestamp) {
      return null;
    }
    universeIds[index] = observations[index].numericUniverseId;
    playing[index] = observations[index].playing;
  }
  return {
    timestamp,
    observedAt: Math.max(...observations.map((entry) => entry.observedAt)),
    feedVersion: GAME_CCU_HISTORY_FEED_VERSION,
    universeIds,
    playing
  };
}

function decodeGameCcuHistorySnapshot(rawSnapshot) {
  if (
    !rawSnapshot ||
    !Number.isSafeInteger(rawSnapshot.timestamp) ||
    rawSnapshot.timestamp < 0 ||
    rawSnapshot.timestamp % GAME_CCU_HISTORY_BUCKET_MS !== 0 ||
    !rawSnapshot.universeIds ||
    !rawSnapshot.playing ||
    typeof rawSnapshot.universeIds.length !== "number" ||
    rawSnapshot.universeIds.length !== rawSnapshot.playing.length ||
    rawSnapshot.universeIds.length > GAME_CCU_HISTORY_MAX_CHART_GAMES
  ) {
    return null;
  }
  const length = rawSnapshot.universeIds.length;
  const universeIds = new Float64Array(length);
  const playing = new Uint32Array(length);
  let previousUniverseId = 0;
  for (let index = 0; index < length; index += 1) {
    const universeId = Number(rawSnapshot.universeIds[index]);
    const count = Number(rawSnapshot.playing[index]);
    if (
      !Number.isSafeInteger(universeId) ||
      universeId <= previousUniverseId ||
      normalizeGameCcuHistoryCount(count) === null
    ) {
      return null;
    }
    universeIds[index] = universeId;
    playing[index] = count;
    previousUniverseId = universeId;
  }
  return {
    timestamp: rawSnapshot.timestamp,
    observedAt:
      Number.isSafeInteger(rawSnapshot.observedAt) &&
      rawSnapshot.observedAt >= rawSnapshot.timestamp
        ? rawSnapshot.observedAt
        : rawSnapshot.timestamp,
    feedVersion: Number.isSafeInteger(rawSnapshot.feedVersion)
      ? rawSnapshot.feedVersion
      : 0,
    universeIds,
    playing
  };
}

function mergeGameCcuHistorySnapshots(rawExisting, rawIncoming) {
  const existing = decodeGameCcuHistorySnapshot(rawExisting);
  const incoming = decodeGameCcuHistorySnapshot(rawIncoming);
  if (!existing || !incoming || existing.timestamp !== incoming.timestamp) {
    return null;
  }
  const playingByUniverseId = new Map();
  for (let index = 0; index < existing.universeIds.length; index += 1) {
    playingByUniverseId.set(
      existing.universeIds[index],
      existing.playing[index]
    );
  }
  for (let index = 0; index < incoming.universeIds.length; index += 1) {
    const universeId = incoming.universeIds[index];
    if (
      incoming.observedAt >= existing.observedAt ||
      !playingByUniverseId.has(universeId)
    ) {
      playingByUniverseId.set(universeId, incoming.playing[index]);
    }
  }
  if (playingByUniverseId.size > GAME_CCU_HISTORY_MAX_CHART_GAMES) {
    return null;
  }
  const universeIds = Float64Array.from(
    Array.from(playingByUniverseId.keys()).sort((left, right) => left - right)
  );
  const playing = new Uint32Array(universeIds.length);
  for (let index = 0; index < universeIds.length; index += 1) {
    playing[index] = playingByUniverseId.get(universeIds[index]);
  }
  return {
    timestamp: incoming.timestamp,
    observedAt: Math.max(existing.observedAt, incoming.observedAt),
    feedVersion: Math.max(existing.feedVersion, incoming.feedVersion),
    universeIds,
    playing
  };
}

function findGameCcuInHistorySnapshot(snapshot, numericUniverseId) {
  let low = 0;
  let high = snapshot.universeIds.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const candidate = snapshot.universeIds[middle];
    if (candidate === numericUniverseId) {
      return snapshot.playing[middle];
    }
    if (candidate < numericUniverseId) {
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return null;
}

function buildGameCcuHistoryFromSnapshots(
  rawSnapshots,
  universeId,
  now = Date.now(),
  snapshotsAreDecoded = false
) {
  const normalizedUniverseId = normalizeId(universeId);
  const numericUniverseId = Number(normalizedUniverseId);
  if (
    !normalizedUniverseId ||
    !Number.isSafeInteger(numericUniverseId) ||
    numericUniverseId <= 0
  ) {
    return {
      universeId: normalizedUniverseId,
      tracked: false,
      points: []
    };
  }
  const minimumTimestamp = now - GAME_CCU_HISTORY_RETENTION_MS;
  const pointsByTimestamp = new Map();
  for (const rawSnapshot of Array.isArray(rawSnapshots) ? rawSnapshots : []) {
    const snapshot = snapshotsAreDecoded
      ? rawSnapshot
      : decodeGameCcuHistorySnapshot(rawSnapshot);
    if (!snapshot || snapshot.timestamp < minimumTimestamp) {
      continue;
    }
    const playing = findGameCcuInHistorySnapshot(snapshot, numericUniverseId);
    if (playing !== null) {
      pointsByTimestamp.set(snapshot.timestamp, playing);
    }
  }
  const points = Array.from(pointsByTimestamp, ([timestamp, playing]) => ({
    timestamp,
    playing
  })).sort((left, right) => left.timestamp - right.timestamp);
  if (points.length > GAME_CCU_HISTORY_MAX_POINTS) {
    points.splice(0, points.length - GAME_CCU_HISTORY_MAX_POINTS);
  }
  return {
    universeId: normalizedUniverseId,
    tracked: points.length > 0,
    points
  };
}

function openGameCcuHistoryDatabase() {
  if (gameCcuHistoryDbPromise) {
    return gameCcuHistoryDbPromise;
  }
  if (!globalThis.indexedDB?.open) {
    return Promise.reject(new GameCcuHistoryError("STORAGE_UNAVAILABLE"));
  }
  gameCcuHistoryDbPromise = new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(
      GAME_CCU_HISTORY_DB_NAME,
      GAME_CCU_HISTORY_DB_VERSION
    );
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(GAME_CCU_HISTORY_SNAPSHOTS_STORE)) {
        database.createObjectStore(GAME_CCU_HISTORY_SNAPSHOTS_STORE, {
          keyPath: "timestamp"
        });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        gameCcuHistoryDbPromise = null;
        gameCcuHistorySnapshotCache = null;
        gameCcuHistorySnapshotCachePromise = null;
      };
      resolve(database);
    };
    request.onerror = () => {
      gameCcuHistoryDbPromise = null;
      reject(new GameCcuHistoryError("STORAGE_UNAVAILABLE"));
    };
    request.onblocked = () => {
      gameCcuHistoryDbPromise = null;
      reject(new GameCcuHistoryError("STORAGE_UNAVAILABLE"));
    };
  });
  return gameCcuHistoryDbPromise;
}

async function appendGameCcuHistoryObservations(
  rawObservations,
  observedAt = Date.now(),
  options = {}
) {
  const snapshot = createGameCcuHistorySnapshot(rawObservations, observedAt);
  if (!snapshot) {
    return 0;
  }
  const preserveExistingBucket = options?.preserveExistingBucket === true;

  if (gameCcuHistoryStorageOverride?.append) {
    return gameCcuHistoryStorageOverride.append(snapshot, {
      preserveExistingBucket
    });
  }

  const database = await openGameCcuHistoryDatabase();
  let stored = false;
  let storedSnapshot = snapshot;
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(
      GAME_CCU_HISTORY_SNAPSHOTS_STORE,
      "readwrite"
    );
    const store = transaction.objectStore(GAME_CCU_HISTORY_SNAPSHOTS_STORE);
    const latestRequest = store.openKeyCursor(null, "prev");
    latestRequest.onsuccess = () => {
      const latestTimestamp = Number(latestRequest.result?.primaryKey ?? -1);
      if (latestTimestamp > snapshot.timestamp) {
        return;
      }
      const storeSnapshot = () => {
        stored = true;
        store.put(storedSnapshot);
        const oldestAllowedTimestamp = snapshot.timestamp -
          (GAME_CCU_HISTORY_MAX_POINTS - 1) * GAME_CCU_HISTORY_BUCKET_MS;
        const cursorRequest = store.openKeyCursor();
        let keptCount = 0;
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) {
            return;
          }
          if (
            Number(cursor.primaryKey) < oldestAllowedTimestamp ||
            keptCount >= GAME_CCU_HISTORY_MAX_POINTS
          ) {
            store.delete(cursor.primaryKey);
          } else {
            keptCount += 1;
          }
          cursor.continue();
        };
      };
      if (!preserveExistingBucket) {
        storeSnapshot();
        return;
      }
      const existingRequest = store.get(snapshot.timestamp);
      existingRequest.onsuccess = () => {
        if (existingRequest.result) {
          const mergedSnapshot = mergeGameCcuHistorySnapshots(
            existingRequest.result,
            snapshot
          );
          if (!mergedSnapshot) {
            transaction.abort();
            return;
          }
          storedSnapshot = mergedSnapshot;
        }
        storeSnapshot();
      };
      existingRequest.onerror = () => {
        transaction.abort();
      };
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(new GameCcuHistoryError("STORAGE_UNAVAILABLE"));
    transaction.onabort = () =>
      reject(new GameCcuHistoryError("STORAGE_UNAVAILABLE"));
  });
  if (stored && gameCcuHistorySnapshotCache) {
    const existingIndex = gameCcuHistorySnapshotCache.findIndex(
      (entry) => entry.timestamp === storedSnapshot.timestamp
    );
    if (existingIndex >= 0) {
      gameCcuHistorySnapshotCache[existingIndex] = storedSnapshot;
    } else {
      gameCcuHistorySnapshotCache.push(storedSnapshot);
      gameCcuHistorySnapshotCache.sort(
        (left, right) => left.timestamp - right.timestamp
      );
    }
    const oldestAllowedTimestamp = snapshot.timestamp -
      (GAME_CCU_HISTORY_MAX_POINTS - 1) * GAME_CCU_HISTORY_BUCKET_MS;
    gameCcuHistorySnapshotCache = gameCcuHistorySnapshotCache
      .filter((entry) => entry.timestamp >= oldestAllowedTimestamp)
      .slice(-GAME_CCU_HISTORY_MAX_POINTS);
  }
  return stored ? storedSnapshot.universeIds.length : 0;
}

function loadGameCcuHistorySnapshotCache(database) {
  if (gameCcuHistorySnapshotCache) {
    return Promise.resolve(gameCcuHistorySnapshotCache);
  }
  if (gameCcuHistorySnapshotCachePromise) {
    return gameCcuHistorySnapshotCachePromise;
  }
  gameCcuHistorySnapshotCachePromise = new Promise((resolve, reject) => {
    const transaction = database.transaction(
      GAME_CCU_HISTORY_SNAPSHOTS_STORE,
      "readonly"
    );
    const request = transaction
      .objectStore(GAME_CCU_HISTORY_SNAPSHOTS_STORE)
      .getAll();
    request.onsuccess = () => {
      const snapshots = (
        Array.isArray(request.result) ? request.result : []
      )
        .map(decodeGameCcuHistorySnapshot)
        .filter(Boolean)
        .sort((left, right) => left.timestamp - right.timestamp)
        .slice(-GAME_CCU_HISTORY_MAX_POINTS);
      gameCcuHistorySnapshotCache = snapshots;
      resolve(snapshots);
    };
    request.onerror = () =>
      reject(new GameCcuHistoryError("STORAGE_UNAVAILABLE"));
  }).finally(() => {
    gameCcuHistorySnapshotCachePromise = null;
  });
  return gameCcuHistorySnapshotCachePromise;
}

async function getLatestGameCcuHistorySnapshotTimestamp() {
  return (await getLatestGameCcuHistorySnapshotState()).timestamp;
}

async function getLatestGameCcuHistorySnapshotState() {
  if (gameCcuHistoryStorageOverride) {
    return {
      timestamp: Math.floor(Date.now() / GAME_CCU_HISTORY_BUCKET_MS) *
        GAME_CCU_HISTORY_BUCKET_MS,
      feedVersion: GAME_CCU_HISTORY_FEED_VERSION
    };
  }
  if (gameCcuHistorySnapshotCache) {
    const latest = gameCcuHistorySnapshotCache.at(-1);
    return {
      timestamp: latest?.timestamp ?? 0,
      feedVersion: latest?.feedVersion ?? 0
    };
  }
  if (gameCcuHistorySnapshotCachePromise) {
    const snapshots = await gameCcuHistorySnapshotCachePromise;
    const latest = snapshots.at(-1);
    return {
      timestamp: latest?.timestamp ?? 0,
      feedVersion: latest?.feedVersion ?? 0
    };
  }
  const database = await openGameCcuHistoryDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      GAME_CCU_HISTORY_SNAPSHOTS_STORE,
      "readonly"
    );
    const request = transaction
      .objectStore(GAME_CCU_HISTORY_SNAPSHOTS_STORE)
      .openCursor(null, "prev");
    request.onsuccess = () => {
      const timestamp = Number(request.result?.primaryKey ?? 0);
      resolve({
        timestamp:
          Number.isSafeInteger(timestamp) && timestamp >= 0 ? timestamp : 0,
        feedVersion: Number.isSafeInteger(request.result?.value?.feedVersion)
          ? request.result.value.feedVersion
          : 0
      });
    };
    request.onerror = () =>
      reject(new GameCcuHistoryError("STORAGE_UNAVAILABLE"));
  });
}

async function readGameCcuHistory(universeId, now = Date.now()) {
  const normalizedUniverseId = normalizeId(universeId);
  if (!normalizedUniverseId) {
    throw new GameCcuHistoryError("INVALID");
  }
  if (gameCcuHistoryStorageOverride?.read) {
    return gameCcuHistoryStorageOverride.read(normalizedUniverseId, now);
  }
  const numericUniverseId = Number(normalizedUniverseId);
  if (!Number.isSafeInteger(numericUniverseId) || numericUniverseId <= 0) {
    return { universeId: normalizedUniverseId, tracked: false, points: [] };
  }
  const database = await openGameCcuHistoryDatabase();
  const snapshots = await loadGameCcuHistorySnapshotCache(database);
  return buildGameCcuHistoryFromSnapshots(
    snapshots,
    normalizedUniverseId,
    now,
    true
  );
}

function getChartsSortsFromPayload(payload) {
  const candidates = [
    payload?.sorts,
    payload?.data?.sorts,
    payload?.content?.sorts
  ];
  return candidates.find(Array.isArray) ?? null;
}

function getChartsGameArraysFromSort(sort) {
  if (!sort || typeof sort !== "object") {
    return [];
  }
  const candidates = [
    sort.games,
    sort.items,
    sort.contents,
    sort.content,
    sort.content?.games,
    sort.content?.items
  ];
  return candidates.filter(Array.isArray);
}

function parseGameCcuChartsPage(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new GameCcuHistoryError("INVALID_SCHEMA");
  }
  const sorts = getChartsSortsFromPayload(payload);
  if (!sorts) {
    throw new GameCcuHistoryError("INVALID_SCHEMA");
  }
  const games = new Map();
  let sawGameContainer = false;
  for (const sort of sorts) {
    for (const entries of getChartsGameArraysFromSort(sort)) {
      sawGameContainer = true;
      for (const entry of entries) {
        const universeId = normalizeId(entry?.universeId ?? entry?.id);
        const playing = normalizeGameCcuHistoryCount(
          entry?.playerCount ?? entry?.playing
        );
        if (!universeId || playing === null) {
          continue;
        }
        games.set(universeId, { universeId, playing });
      }
    }
  }
  if (!sawGameContainer || games.size === 0) {
    throw new GameCcuHistoryError("INVALID_SCHEMA");
  }
  const rawNextToken = payload.nextSortsPageToken;
  if (
    rawNextToken !== undefined &&
    rawNextToken !== null &&
    rawNextToken !== "" &&
    (typeof rawNextToken !== "string" || rawNextToken.length > 8_192)
  ) {
    throw new GameCcuHistoryError("INVALID_SCHEMA");
  }
  return {
    games,
    nextSortsPageToken:
      typeof rawNextToken === "string" && rawNextToken.length > 0
        ? rawNextToken
        : null
  };
}

function createGameCcuHistorySessionId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  const randomPart = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
    .toString(16)
    .padStart(14, "0");
  return `00000000-0000-4000-8000-${randomPart.slice(-12)}`;
}

function buildGameCcuChartsPageUrl(
  sessionId,
  sortsPageToken = null,
  country = "all",
  device = "computer"
) {
  if (!/^(?:computer|all)$/.test(device)) {
    throw new GameCcuHistoryError("INVALID");
  }
  const endpoint = new URL(GAME_CCU_HISTORY_CHARTS_URL);
  endpoint.searchParams.set("sessionId", sessionId);
  if (country) {
    endpoint.searchParams.set("country", country);
  }
  endpoint.searchParams.set("device", device);
  if (sortsPageToken) {
    endpoint.searchParams.set("sortsPageToken", sortsPageToken);
  }
  return endpoint.href;
}

async function fetchGameCcuChartsPage(url, options = {}) {
  const credentials = Object.hasOwn(options, "credentials")
    ? options.credentials
    : "omit";
  if (!/^(?:include|omit)$/.test(credentials)) {
    throw new GameCcuHistoryError("INVALID");
  }
  let endpoint;
  try {
    endpoint = new URL(url);
  } catch {
    throw new GameCcuHistoryError("INVALID");
  }
  if (
    endpoint.origin !== "https://apis.roblox.com" ||
    endpoint.pathname !== "/explore-api/v1/get-sorts"
  ) {
    throw new GameCcuHistoryError("INVALID");
  }
  let lastError = null;
  for (let attempt = 0; attempt < GAME_CCU_HISTORY_FETCH_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        cache: "no-store",
        credentials,
        headers: { Accept: "application/json" },
        signal: controller.signal
      });
      if (!response.ok) {
        const retryAfterMs = Math.max(
          parseRetryAfterMilliseconds(response.headers.get("Retry-After")),
          parseRateLimitResetMilliseconds(
            response.headers.get("x-ratelimit-reset")
          )
        );
        throw new GameCcuHistoryError(
          response.status === 429 ? "RATE_LIMITED" : "ROBLOX_UNAVAILABLE",
          response.status,
          retryAfterMs
        );
      }
      return parseGameCcuChartsPage(await response.json());
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }

    const retryable =
      lastError?.name === "AbortError" ||
      lastError instanceof TypeError ||
      (lastError instanceof GameCcuHistoryError && lastError.status >= 500);
    if (!retryable || attempt >= GAME_CCU_HISTORY_FETCH_ATTEMPTS - 1) {
      throw lastError;
    }
    await wait(GAME_CCU_HISTORY_RETRY_DELAY_MS * (attempt + 1));
  }
  throw lastError;
}

async function fetchAllGameCcuChartsPages(options = {}) {
  const country = Object.hasOwn(options, "country") ? options.country : "all";
  const device = Object.hasOwn(options, "device")
    ? options.device
    : "computer";
  const credentials = Object.hasOwn(options, "credentials")
    ? options.credentials
    : "omit";
  if (
    country !== null &&
    (typeof country !== "string" || !/^(?:all|[a-z]{2})$/i.test(country))
  ) {
    throw new GameCcuHistoryError("INVALID");
  }
  if (typeof device !== "string" || !/^(?:computer|all)$/.test(device)) {
    throw new GameCcuHistoryError("INVALID");
  }
  if (!/^(?:include|omit)$/.test(credentials)) {
    throw new GameCcuHistoryError("INVALID");
  }
  const sessionId = createGameCcuHistorySessionId();
  const seenTokens = new Set();
  const games = new Map();
  let token = null;
  let pageCount = 0;
  do {
    if (pageCount >= GAME_CCU_HISTORY_MAX_CHART_PAGES) {
      break;
    }
    const page = await fetchGameCcuChartsPage(
      buildGameCcuChartsPageUrl(sessionId, token, country, device),
      { credentials }
    );
    pageCount += 1;
    for (const [universeId, game] of page.games) {
      games.set(universeId, game);
      if (games.size > GAME_CCU_HISTORY_MAX_CHART_GAMES) {
        throw new GameCcuHistoryError("INVALID_SCHEMA");
      }
    }
    token = page.nextSortsPageToken;
    if (token) {
      if (seenTokens.has(token)) {
        throw new GameCcuHistoryError("INVALID_SCHEMA");
      }
      seenTokens.add(token);
    }
  } while (token);
  return {
    games: Array.from(games.values()),
    pageCount,
    sessionId,
    country: country || "default",
    device,
    access: credentials === "include" ? "authenticated" : "anonymous"
  };
}

async function fetchGameCcuChartsFeedWithFallback(options) {
  let authenticatedError;
  try {
    return await fetchAllGameCcuChartsPages({
      ...options,
      credentials: "include"
    });
  } catch (error) {
    authenticatedError = error;
  }

  // Authenticated and anonymous requests share the same Roblox endpoint and
  // rate-limit budget. A 429 must enter the normal collector backoff instead
  // of immediately doubling traffic with an anonymous retry.
  if (
    authenticatedError?.status === 429 ||
    authenticatedError?.code === "RATE_LIMITED"
  ) {
    const failure = new Error("GAME_CCU_CHARTS_FEED_RATE_LIMITED");
    failure.name = "GameCcuChartsFeedError";
    failure.authenticatedError = authenticatedError;
    failure.anonymousError = null;
    throw failure;
  }

  try {
    const feed = await fetchAllGameCcuChartsPages({
      ...options,
      credentials: "omit"
    });
    return {
      ...feed,
      access: "anonymous-fallback",
      authenticatedErrorCode:
        authenticatedError?.code || "ROBLOX_UNAVAILABLE"
    };
  } catch (anonymousError) {
    const failure = new Error("GAME_CCU_CHARTS_FEED_UNAVAILABLE");
    failure.name = "GameCcuChartsFeedError";
    failure.authenticatedError = authenticatedError;
    failure.anonymousError = anonymousError;
    throw failure;
  }
}

async function fetchMergedGameCcuChartsPages() {
  // Roblox's visible default Charts feed is regional (the country parameter is
  // omitted), while both "All Locations" and "All Devices" are separate
  // selections. Track the four visible combinations so their cards share one
  // bounded history without assuming Computer-only membership.
  const feedOptions = [
    { country: null, device: "computer" },
    { country: "all", device: "computer" },
    { country: null, device: "all" },
    { country: "all", device: "all" }
  ];
  const feedResults = await Promise.allSettled(
    feedOptions.map((options) => fetchGameCcuChartsFeedWithFallback(options))
  );
  const successfulFeeds = [];
  const failedFeeds = [];
  feedResults.forEach((result, index) => {
    if (result.status === "fulfilled") {
      successfulFeeds.push(result.value);
    } else {
      failedFeeds.push({
        ...feedOptions[index],
        authenticatedError: result.reason?.authenticatedError,
        anonymousError: result.reason?.anonymousError
      });
    }
  });

  // A temporary failure in one feed must not discard a valid snapshot from the
  // other feed. Only a total failure enters the collector's global backoff.
  if (!successfulFeeds.length) {
    const errors = failedFeeds.flatMap((feed) => [
      feed.anonymousError,
      feed.authenticatedError
    ]).filter(Boolean);
    throw errors.find((error) => error?.status === 429) ||
      errors[0] ||
      new GameCcuHistoryError("ROBLOX_UNAVAILABLE");
  }

  const games = new Map();
  for (const feed of successfulFeeds) {
    for (const game of feed.games) {
      games.set(game.universeId, game);
      if (games.size > GAME_CCU_HISTORY_MAX_CHART_GAMES) {
        throw new GameCcuHistoryError("INVALID_SCHEMA");
      }
    }
  }
  return {
    games: Array.from(games.values()),
    pageCount: successfulFeeds.reduce((sum, feed) => sum + feed.pageCount, 0),
    feeds: successfulFeeds.map((feed) => ({
      country: feed.country,
      device: feed.device,
      access: feed.access
    })),
    partial:
      failedFeeds.length > 0 ||
      successfulFeeds.some((feed) => feed.access === "anonymous-fallback"),
    fallbackFeeds: successfulFeeds
      .filter((feed) => feed.access === "anonymous-fallback")
      .map((feed) => ({
        country: feed.country,
        device: feed.device,
        code: feed.authenticatedErrorCode
      })),
    failedFeeds: failedFeeds.map((feed) => ({
      country: feed.country || "default",
      device: feed.device,
      authenticatedCode:
        feed.authenticatedError?.code || "ROBLOX_UNAVAILABLE",
      anonymousCode: feed.anonymousError?.code || null
    }))
  };
}

function noteGameCcuHistoryCollectionFailure(error, now = Date.now()) {
  gameCcuHistoryFailureCount += 1;
  const exponentialDelay = Math.min(
    GAME_CCU_HISTORY_MAX_BACKOFF_MS,
    30_000 * 2 ** Math.min(6, gameCcuHistoryFailureCount - 1)
  );
  const rateLimitDelay = error?.status === 429
    ? Math.max(
        GAME_CCU_HISTORY_RATE_LIMIT_FALLBACK_MS,
        Number(error?.retryAfterMs) || 0
      )
    : 0;
  gameCcuHistoryRetryNotBefore = now + Math.min(
    GAME_CCU_HISTORY_MAX_BACKOFF_MS,
    Math.max(exponentialDelay, rateLimitDelay)
  );
}

async function runGameCcuHistoryCollection(options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  if (!gameCcuHistoryFeatureEnabled) {
    return { ok: false, skipped: "DISABLED" };
  }
  if (now < gameCcuHistoryRetryNotBefore) {
    return { ok: false, skipped: "BACKOFF", retryAt: gameCcuHistoryRetryNotBefore };
  }
  if (gameCcuHistoryCollectionPromise) {
    return gameCcuHistoryCollectionPromise;
  }
  gameCcuHistoryCollectionPromise = (async () => {
    try {
      const snapshot = await fetchMergedGameCcuChartsPages();
      const stored = await appendGameCcuHistoryObservations(
        snapshot.games,
        now,
        { preserveExistingBucket: snapshot.partial === true }
      );
      for (const game of snapshot.games) {
        setBoundedGameCcuCache(game.universeId, game.playing);
      }
      gameCcuHistoryFailureCount = 0;
      gameCcuHistoryRetryNotBefore = 0;
      return {
        ok: true,
        pages: snapshot.pageCount,
        games: stored,
        partial: snapshot.partial,
        feeds: snapshot.feeds,
        timestamp: Math.floor(now / GAME_CCU_HISTORY_BUCKET_MS) *
          GAME_CCU_HISTORY_BUCKET_MS
      };
    } catch (error) {
      noteGameCcuHistoryCollectionFailure(error, now);
      return {
        ok: false,
        code: error instanceof GameCcuHistoryError
          ? error.code
          : "ROBLOX_UNAVAILABLE",
        retryAt: gameCcuHistoryRetryNotBefore
      };
    } finally {
      gameCcuHistoryCollectionPromise = null;
    }
  })();
  return gameCcuHistoryCollectionPromise;
}

async function runGameCcuHistoryCollectionIfStale(options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  if (!gameCcuHistoryFeatureEnabled) {
    return { ok: false, skipped: "DISABLED" };
  }
  if (gameCcuHistoryCollectionPromise) {
    return gameCcuHistoryCollectionPromise;
  }
  let latestSnapshot;
  try {
    latestSnapshot = await getLatestGameCcuHistorySnapshotState();
  } catch (error) {
    return {
      ok: false,
      code: error instanceof GameCcuHistoryError
        ? error.code
        : "STORAGE_UNAVAILABLE"
    };
  }
  const currentBucket = Math.floor(now / GAME_CCU_HISTORY_BUCKET_MS) *
    GAME_CCU_HISTORY_BUCKET_MS;
  if (
    latestSnapshot.timestamp >= currentBucket &&
    latestSnapshot.feedVersion === GAME_CCU_HISTORY_FEED_VERSION
  ) {
    return {
      ok: true,
      skipped: "FRESH",
      timestamp: latestSnapshot.timestamp
    };
  }
  return runGameCcuHistoryCollection({ ...options, now });
}

function getGameCcuFeatureValue(rawValue) {
  return !(
    rawValue &&
    typeof rawValue === "object" &&
    rawValue.version === FEATURE_SETTINGS_VERSION &&
    rawValue.flags &&
    typeof rawValue.flags === "object" &&
    rawValue.flags.gameCcu === false
  );
}

function ensureGameCcuHistoryAlarm() {
  if (!gameCcuHistoryFeatureEnabled || !chrome.alarms?.create) {
    return;
  }
  if (!chrome.alarms.get) {
    chrome.alarms.create(GAME_CCU_HISTORY_ALARM_NAME, {
      periodInMinutes: GAME_CCU_HISTORY_ALARM_PERIOD_MINUTES
    });
    return;
  }
  chrome.alarms.get(GAME_CCU_HISTORY_ALARM_NAME, (alarm) => {
    void chrome.runtime.lastError;
    if (
      !alarm ||
      alarm.periodInMinutes !== GAME_CCU_HISTORY_ALARM_PERIOD_MINUTES
    ) {
      chrome.alarms.create(GAME_CCU_HISTORY_ALARM_NAME, {
        periodInMinutes: GAME_CCU_HISTORY_ALARM_PERIOD_MINUTES
      });
    }
  });
}

function clearGameCcuHistoryAlarm() {
  chrome.alarms?.clear?.(GAME_CCU_HISTORY_ALARM_NAME, () => {
    void chrome.runtime.lastError;
  });
}

function applyGameCcuHistoryFeatureValue(rawValue, runWhenEnabled = false) {
  const wasEnabled = gameCcuHistoryFeatureEnabled;
  gameCcuHistoryFeatureEnabled = getGameCcuFeatureValue(rawValue);
  if (!gameCcuHistoryFeatureEnabled) {
    clearGameCcuHistoryAlarm();
    return;
  }
  ensureGameCcuHistoryAlarm();
  if (runWhenEnabled && !wasEnabled) {
    void runGameCcuHistoryCollection();
  }
}

function syncGameCcuHistoryFeatureFromStorage(runWhenEnabled = false) {
  const runMode = runWhenEnabled === "stale"
    ? "stale"
    : runWhenEnabled
      ? "force"
      : "none";
  const startCollection = () => {
    if (!gameCcuHistoryFeatureEnabled || runMode === "none") {
      return;
    }
    if (runMode === "stale") {
      void runGameCcuHistoryCollectionIfStale();
    } else {
      void runGameCcuHistoryCollection();
    }
  };
  if (!chrome.storage?.local?.get) {
    gameCcuHistoryFeatureEnabled = true;
    ensureGameCcuHistoryAlarm();
    startCollection();
    return;
  }
  chrome.storage.local.get(
    { [FEATURE_SETTINGS_STORAGE_KEY]: null },
    (result) => {
      void chrome.runtime.lastError;
      applyGameCcuHistoryFeatureValue(
        result?.[FEATURE_SETTINGS_STORAGE_KEY],
        false
      );
      startCollection();
    }
  );
}

function hasCurrentGameCcuHistoryPoint(history, now = Date.now()) {
  const currentBucket = Math.floor(now / GAME_CCU_HISTORY_BUCKET_MS) *
    GAME_CCU_HISTORY_BUCKET_MS;
  return Boolean(
    Array.isArray(history?.points) &&
    history.points.some((point) => point?.timestamp === currentBucket)
  );
}

async function seedVisibleChartsGameCcuHistory(universeId, now = Date.now()) {
  const counts = await getGameCcuByUniverseIds([universeId]);
  const playing = counts.get(universeId);
  if (!Number.isSafeInteger(playing) || playing < 0) {
    return false;
  }
  const stored = await appendGameCcuHistoryObservations(
    [{ universeId, playing }],
    now,
    { preserveExistingBucket: true }
  );
  return stored > 0;
}

async function getGameCcuHistoryForRequest(universeId, options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const allowChartsSeed = options.allowChartsSeed === true;
  let history = await readGameCcuHistory(universeId, now);
  if (
    !gameCcuHistoryFeatureEnabled ||
    (allowChartsSeed
      ? hasCurrentGameCcuHistoryPoint(history, now)
      : history.points.length > 0)
  ) {
    return history;
  }
  const collection = await runGameCcuHistoryCollectionIfStale({ now });
  if (collection.ok && collection.skipped !== "FRESH") {
    history = await readGameCcuHistory(universeId, now);
  }
  if (
    allowChartsSeed &&
    gameCcuHistoryFeatureEnabled &&
    !hasCurrentGameCcuHistoryPoint(history, now)
  ) {
    try {
      if (await seedVisibleChartsGameCcuHistory(universeId, now)) {
        history = await readGameCcuHistory(universeId, now);
      }
    } catch {
      // Preserve any older honest history below; a failed on-demand count must
      // not turn a previously tracked Chart game into an error state.
    }
  }
  if (
    !collection.ok &&
    collection.skipped !== "DISABLED" &&
    history.points.length === 0
  ) {
    throw new GameCcuHistoryError(collection.code || "ROBLOX_UNAVAILABLE");
  }
  return history;
}

function handleGameCcuHistoryMessage(message, sender, sendResponse) {
  if (message?.type !== GAME_CCU_HISTORY_MESSAGE_TYPE) {
    return false;
  }
  const requestId = normalizeRandomServerRequestId(message.requestId);
  const universeId = typeof message.universeId === "string"
    ? normalizeId(message.universeId)
    : null;
  if (
    requestId === null ||
    !universeId ||
    getTrustedRobloxTopFrameTabId(sender) === null
  ) {
    sendResponse({
      ok: false,
      requestId: requestId ?? 0,
      universeId,
      code: "INVALID"
    });
    return false;
  }
  getGameCcuHistoryForRequest(universeId, {
    allowChartsSeed: getTrustedRobloxChartsTabId(sender) !== null
  })
    .then((history) => {
      sendResponse({
        ok: true,
        requestId,
        universeId,
        tracked: history.tracked,
        points: history.points
      });
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        requestId,
        universeId,
        code: error instanceof GameCcuHistoryError
          ? error.code
          : "STORAGE_UNAVAILABLE"
      });
    });
  return true;
}

function resetGameCcuHistoryStateForTests() {
  gameCcuHistoryCollectionPromise = null;
  gameCcuHistoryFeatureEnabled = true;
  gameCcuHistoryFailureCount = 0;
  gameCcuHistoryRetryNotBefore = 0;
  gameCcuHistoryStorageOverride = null;
  gameCcuHistorySnapshotCache = null;
  gameCcuHistorySnapshotCachePromise = null;
}

function normalizePrivateServerPlaceId(value) {
  return normalizeRandomServerPlaceId(value);
}

function normalizePrivateServerRequestId(value) {
  return normalizeRandomServerRequestId(value);
}

function parsePrivateServerCursor(value) {
  if (value === undefined || value === null || value === "") {
    return { valid: true, value: null };
  }
  if (
    typeof value !== "string" ||
    value.length > PRIVATE_SERVER_CURSOR_MAX_LENGTH ||
    value.trim() !== value ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return { valid: false, value: null };
  }
  return { valid: true, value };
}

function normalizePrivateServerApiId(value) {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
  }
  return normalizeId(value);
}

function normalizePrivateServerPrice(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function normalizePrivateServerAccessCode(value) {
  if (typeof value !== "string" || value !== value.trim()) {
    return null;
  }
  return normalizeGameInstanceId(value);
}

function normalizePrivateServerText(value, maxLength) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length <= maxLength && !/[\u0000-\u001f\u007f]/.test(normalized)
    ? normalized
    : null;
}

function makePrivateServerOwner(owner) {
  if (!owner || typeof owner !== "object" || Array.isArray(owner)) {
    return null;
  }

  const id = normalizePrivateServerApiId(owner.id);
  const name = normalizePrivateServerText(
    owner.name,
    PRIVATE_SERVER_OWNER_NAME_MAX_LENGTH
  );
  const displayName = normalizePrivateServerText(
    owner.displayName,
    PRIVATE_SERVER_OWNER_NAME_MAX_LENGTH
  );
  if (!id && name === null && displayName === null) {
    return null;
  }

  return Object.freeze({
    id,
    name: name ?? "",
    displayName: displayName ?? name ?? ""
  });
}

function makePrivateServerDisplayId(entry, usedIds) {
  const vipServerId = normalizePrivateServerApiId(entry?.vipServerId);
  const stableId = vipServerId ? `private-server-${vipServerId}` : "";
  if (stableId && !usedIds.has(stableId)) {
    usedIds.add(stableId);
    return stableId;
  }

  let fallbackId = "";
  do {
    privateServerDisplayTokenSequence =
      privateServerDisplayTokenSequence >= Number.MAX_SAFE_INTEGER
        ? 1
        : privateServerDisplayTokenSequence + 1;
    fallbackId = `private-server-session-${privateServerDisplayTokenSequence.toString(36)}`;
  } while (usedIds.has(fallbackId));
  usedIds.add(fallbackId);
  return fallbackId;
}

function sanitizePrivateServerList(data) {
  const servers = [];
  const usedIds = new Set();
  const seenAccessCodes = new Set();

  for (const entry of data.slice(0, PRIVATE_SERVER_PAGE_MAX_ENTRIES)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }

    const accessCode = normalizePrivateServerAccessCode(entry.accessCode);
    const playing = entry.playing;
    const maxPlayers = entry.maxPlayers;
    const normalizedName =
      entry.name === null || entry.name === undefined
        ? ""
        : normalizePrivateServerText(entry.name, PRIVATE_SERVER_NAME_MAX_LENGTH);
    if (
      !accessCode ||
      seenAccessCodes.has(accessCode.toLowerCase()) ||
      !Number.isSafeInteger(playing) ||
      playing < 0 ||
      !Number.isSafeInteger(maxPlayers) ||
      maxPlayers <= 0 ||
      playing > maxPlayers ||
      normalizedName === null
    ) {
      continue;
    }

    seenAccessCodes.add(accessCode.toLowerCase());
    servers.push(
      Object.freeze({
        id: makePrivateServerDisplayId(entry, usedIds),
        name: normalizedName || "Private Server",
        owner: makePrivateServerOwner(entry.owner),
        playing,
        maxPlayers,
        accessCode
      })
    );
  }

  return Object.freeze(servers);
}

function getPrivateServerSupportStorageArea() {
  return chrome.storage?.local || chrome.storage?.session || null;
}

function readPrivateServerSupportStorage() {
  return new Promise((resolve) => {
    const storageArea = getPrivateServerSupportStorageArea();
    if (!storageArea?.get) {
      resolve(null);
      return;
    }
    let settled = false;
    const finish = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };
    try {
      const result = storageArea.get(
        { [PRIVATE_SERVER_SUPPORT_STORAGE_KEY]: null },
        (values) => {
          if (chrome.runtime?.lastError) {
            finish(null);
            return;
          }
          finish(values?.[PRIVATE_SERVER_SUPPORT_STORAGE_KEY] ?? null);
        }
      );
      if (result?.then) {
        result.then(
          (values) => finish(values?.[PRIVATE_SERVER_SUPPORT_STORAGE_KEY] ?? null),
          () => finish(null)
        );
      }
    } catch {
      finish(null);
    }
  });
}

function writePrivateServerSupportStorage(value) {
  return new Promise((resolve) => {
    const storageArea = getPrivateServerSupportStorageArea();
    if (!storageArea?.set) {
      resolve();
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };
    try {
      const result = storageArea.set(
        { [PRIVATE_SERVER_SUPPORT_STORAGE_KEY]: value },
        finish
      );
      if (result?.then) {
        result.then(finish, finish);
      }
    } catch {
      finish();
    }
  });
}

function normalizeStoredPrivateServerSupportEntry(placeId, rawEntry, now = Date.now()) {
  const normalizedPlaceId = normalizePrivateServerPlaceId(placeId);
  const universeId = normalizeId(rawEntry?.universeId);
  const enabled = rawEntry?.enabled;
  const rawPrice = rawEntry?.price;
  const price =
    Number.isSafeInteger(rawPrice) && rawPrice >= 0 ? rawPrice : null;
  let expiresAt = Number(rawEntry?.expiresAt);
  let staleUntil = Number(rawEntry?.staleUntil);
  if (
    !normalizedPlaceId ||
    !universeId ||
    typeof enabled !== "boolean" ||
    !Number.isFinite(expiresAt) ||
    !Number.isFinite(staleUntil) ||
    expiresAt <= 0 ||
    staleUntil < expiresAt
  ) {
    return null;
  }

  const legacyStaleWindowMs =
    PRIVATE_SERVER_SUPPORT_LEGACY_STALE_TTL_MS -
    PRIVATE_SERVER_SUPPORT_LEGACY_CACHE_TTL_MS;
  if (Math.abs(staleUntil - expiresAt - legacyStaleWindowMs) <= 1_000) {
    const confirmedAt = expiresAt - PRIVATE_SERVER_SUPPORT_LEGACY_CACHE_TTL_MS;
    const freshTtlMs = enabled
      ? PRIVATE_SERVER_SUPPORT_CACHE_TTL_MS
      : PRIVATE_SERVER_SUPPORT_UNAVAILABLE_CACHE_TTL_MS;
    const staleTtlMs = enabled
      ? PRIVATE_SERVER_SUPPORT_STALE_TTL_MS
      : PRIVATE_SERVER_SUPPORT_UNAVAILABLE_STALE_TTL_MS;
    if (enabled) {
      expiresAt = Math.max(expiresAt, confirmedAt + freshTtlMs);
    }
    staleUntil = Math.max(staleUntil, confirmedAt + staleTtlMs);
  }
  // V2 entries created before price support remain useful for capability
  // detection, but should refresh on their next use so the dialog can show
  // the current game-wide subscription price.
  if (enabled && price === null) {
    expiresAt = Math.min(expiresAt, now - 1);
  }
  if (staleUntil <= now) {
    return null;
  }
  return Object.freeze({
    placeId: normalizedPlaceId,
    universeId,
    enabled,
    price,
    expiresAt,
    staleUntil
  });
}

function setBoundedPrivateServerSupportPlaceCache(placeId, entry) {
  privateServerSupportByPlaceId.delete(placeId);
  privateServerSupportByPlaceId.set(placeId, entry);
  while (privateServerSupportByPlaceId.size > PRIVATE_SERVER_SUPPORT_CACHE_MAX_ENTRIES) {
    const oldestKey = privateServerSupportByPlaceId.keys().next().value;
    privateServerSupportByPlaceId.delete(oldestKey);
  }
}

function serializePrivateServerSupportStorage() {
  const now = Date.now();
  const entries = {};
  for (const [placeId, entry] of privateServerSupportByPlaceId) {
    if (entry.staleUntil <= now) {
      privateServerSupportByPlaceId.delete(placeId);
      continue;
    }
    entries[placeId] = {
      universeId: entry.universeId,
      enabled: entry.enabled,
      price: entry.price,
      expiresAt: entry.expiresAt,
      staleUntil: entry.staleUntil
    };
  }
  return {
    version: PRIVATE_SERVER_SUPPORT_STORAGE_VERSION,
    rateLimitedUntil:
      privateServerSupportRateLimitedUntil > now
        ? Math.min(
            privateServerSupportRateLimitedUntil,
            now + PRIVATE_SERVER_SUPPORT_MAX_COOLDOWN_MS
          )
        : 0,
    entries
  };
}

function persistPrivateServerSupportStorage() {
  const snapshot = serializePrivateServerSupportStorage();
  privateServerSupportStorageWritePromise = privateServerSupportStorageWritePromise
    .catch(() => undefined)
    .then(() => writePrivateServerSupportStorage(snapshot));
  return privateServerSupportStorageWritePromise;
}

function hydratePrivateServerSupportStorage() {
  if (privateServerSupportStorageLoadPromise) {
    return privateServerSupportStorageLoadPromise;
  }
  privateServerSupportStorageLoadPromise = readPrivateServerSupportStorage()
    .then((stored) => {
      if (
        !stored ||
        typeof stored !== "object" ||
        Array.isArray(stored) ||
        stored.version !== PRIVATE_SERVER_SUPPORT_STORAGE_VERSION
      ) {
        return;
      }
      const now = Date.now();
      const rawEntries = stored.entries;
      if (rawEntries && typeof rawEntries === "object" && !Array.isArray(rawEntries)) {
        for (const [placeId, rawEntry] of Object.entries(rawEntries)) {
          const entry = normalizeStoredPrivateServerSupportEntry(placeId, rawEntry, now);
          if (entry) {
            setBoundedPrivateServerSupportPlaceCache(entry.placeId, entry);
          }
        }
      }
      const storedRateLimitedUntil = Number(stored.rateLimitedUntil);
      if (Number.isFinite(storedRateLimitedUntil) && storedRateLimitedUntil > now) {
        privateServerSupportRateLimitedUntil = Math.min(
          storedRateLimitedUntil,
          now + PRIVATE_SERVER_SUPPORT_MAX_COOLDOWN_MS
        );
      }
    })
    .catch(() => undefined);
  return privateServerSupportStorageLoadPromise;
}

function getPrivateServerSupportPlaceCacheEntry(placeId, allowStale = false) {
  const entry = privateServerSupportByPlaceId.get(placeId);
  if (!entry) {
    return null;
  }
  const now = Date.now();
  if (entry.staleUntil <= now) {
    privateServerSupportByPlaceId.delete(placeId);
    return null;
  }
  if (!allowStale && entry.expiresAt <= now) {
    return null;
  }
  privateServerSupportByPlaceId.delete(placeId);
  privateServerSupportByPlaceId.set(placeId, entry);
  return entry;
}

function makePrivateServerSupportResult(entry, stale = false) {
  return Object.freeze({
    placeId: entry.placeId,
    universeId: entry.universeId,
    enabled: entry.enabled,
    price: normalizePrivateServerPrice(entry.price),
    stale: stale === true
  });
}

async function cacheConfirmedPrivateServerSupport(result) {
  const now = Date.now();
  const freshTtlMs = result.enabled
    ? normalizePrivateServerPrice(result.price) === null
      ? PRIVATE_SERVER_SUPPORT_PRICE_UNAVAILABLE_CACHE_TTL_MS
      : PRIVATE_SERVER_SUPPORT_CACHE_TTL_MS
    : PRIVATE_SERVER_SUPPORT_UNAVAILABLE_CACHE_TTL_MS;
  const staleTtlMs = result.enabled
    ? PRIVATE_SERVER_SUPPORT_STALE_TTL_MS
    : PRIVATE_SERVER_SUPPORT_UNAVAILABLE_STALE_TTL_MS;
  const entry = Object.freeze({
    placeId: result.placeId,
    universeId: result.universeId,
    enabled: result.enabled,
    price: normalizePrivateServerPrice(result.price),
    expiresAt: now + freshTtlMs,
    staleUntil: now + staleTtlMs
  });
  setBoundedPrivateServerSupportPlaceCache(result.placeId, entry);
  await persistPrivateServerSupportStorage();
  return makePrivateServerSupportResult(entry);
}

function schedulePrivateServerSupportQueueDrain(delayMs) {
  if (privateServerSupportQueueTimer !== null) {
    return;
  }
  privateServerSupportQueueTimer = setTimeout(() => {
    privateServerSupportQueueTimer = null;
    drainPrivateServerSupportTaskQueue();
  }, Math.max(1, delayMs));
}

function drainPrivateServerSupportTaskQueue() {
  const cooldownDelay = privateServerSupportRateLimitedUntil - Date.now();
  if (cooldownDelay > 0) {
    schedulePrivateServerSupportQueueDrain(cooldownDelay);
    return;
  }
  while (
    activePrivateServerSupportTasks < PRIVATE_SERVER_SUPPORT_GLOBAL_CONCURRENCY &&
    privateServerSupportTaskQueue.length > 0
  ) {
    const startDelay = privateServerSupportNextStartAt - Date.now();
    if (startDelay > 0) {
      schedulePrivateServerSupportQueueDrain(startDelay);
      return;
    }
    const foregroundTaskIndex = privateServerSupportTaskQueue.findIndex(
      (queuedTask) => queuedTask.priority === "foreground"
    );
    const taskIndex = foregroundTaskIndex >= 0 ? foregroundTaskIndex : 0;
    const queuedTask = privateServerSupportTaskQueue[taskIndex];
    const taskDelay = queuedTask.notBefore - Date.now();
    if (taskDelay > 0) {
      schedulePrivateServerSupportQueueDrain(taskDelay);
      return;
    }
    const task =
      taskIndex === 0
        ? privateServerSupportTaskQueue.shift()
        : privateServerSupportTaskQueue.splice(taskIndex, 1)[0];
    activePrivateServerSupportTasks += 1;
    privateServerSupportNextStartAt = Date.now() + PRIVATE_SERVER_SUPPORT_START_INTERVAL_MS;
    void (async () => {
      let requeued = false;
      try {
        task.resolve(await task.loader());
      } catch (error) {
        if (error?.status === 429) {
          const cooldownMs = Math.min(
            PRIVATE_SERVER_SUPPORT_MAX_COOLDOWN_MS,
            Math.max(
              PRIVATE_SERVER_SUPPORT_RATE_LIMIT_COOLDOWN_MS,
              Number(error.retryAfterMs) || 0
            )
          );
          privateServerSupportRateLimitedUntil = Math.max(
            privateServerSupportRateLimitedUntil,
            Date.now() + cooldownMs
          );
          await persistPrivateServerSupportStorage();
          if (
            task.rateLimitAttempts <
            PRIVATE_SERVER_SUPPORT_RATE_LIMIT_REQUEUE_ATTEMPTS
          ) {
            task.rateLimitAttempts += 1;
            privateServerSupportTaskQueue.unshift(task);
            requeued = true;
          }
        }
        if (!requeued) {
          task.reject(error);
        }
      } finally {
        activePrivateServerSupportTasks -= 1;
        drainPrivateServerSupportTaskQueue();
      }
    })();
  }
}

function queuePrivateServerSupportTask(loader, priority = "foreground") {
  return new Promise((resolve, reject) => {
    const normalizedPriority = priority === "refresh" ? "refresh" : "foreground";
    privateServerSupportTaskQueue.push({
      loader,
      resolve,
      reject,
      priority: normalizedPriority,
      notBefore:
        normalizedPriority === "refresh"
          ? Date.now() + PRIVATE_SERVER_SUPPORT_REFRESH_GRACE_MS
          : Date.now(),
      rateLimitAttempts: 0
    });
    drainPrivateServerSupportTaskQueue();
  });
}

function setBoundedPrivateServerSupportCache(key, entry) {
  privateServerSupportCache.delete(key);
  privateServerSupportCache.set(key, entry);
  while (privateServerSupportCache.size > PRIVATE_SERVER_SUPPORT_CACHE_MAX_ENTRIES) {
    const oldestKey = privateServerSupportCache.keys().next().value;
    privateServerSupportCache.delete(oldestKey);
  }
}

function getPrivateServerSupportForUniverse(universeId) {
  const now = Date.now();
  const cached = privateServerSupportCache.get(universeId);
  if (cached?.expiresAt > now) {
    privateServerSupportCache.delete(universeId);
    privateServerSupportCache.set(universeId, cached);
    return cached.promise;
  }
  if (cached) {
    privateServerSupportCache.delete(universeId);
  }

  const endpoint = new URL(
    "/private-servers-api/Universe-Private-Server-Settings",
    "https://apis.roblox.com"
  );
  endpoint.searchParams.set("universeId", universeId);
  const request = fetchJson(
    endpoint,
    {
      method: "GET",
      credentials: "omit",
      cache: "no-store",
      headers: { Accept: "application/json" }
    },
    {
      maxAttempts: 1,
      onResponse: updatePrivateServerSupportRateLimitFromResponse
    }
  )
    .then((payload) => {
      const privateServerData = payload?.privateServerData;
      const rawProductId = privateServerData?.privateServerProductId;
      const rawPrice = privateServerData?.price;
      const price =
        Number.isSafeInteger(rawPrice) && rawPrice >= 0 ? rawPrice : null;
      const productId =
        typeof rawProductId === "number" &&
        Number.isSafeInteger(rawProductId) &&
        rawProductId >= 0
          ? String(rawProductId)
          : typeof rawProductId === "string" && /^(?:0|[1-9]\d{0,19})$/.test(rawProductId)
            ? rawProductId
            : null;
      if (
        !privateServerData ||
        typeof privateServerData !== "object" ||
        Array.isArray(privateServerData) ||
        productId === null
      ) {
        throw new PrivateServerError("ROBLOX_UNAVAILABLE");
      }
      return Object.freeze({
        universeId,
        enabled: productId !== "0",
        price
      });
    })
    .catch((error) => {
      if (privateServerSupportCache.get(universeId)?.promise === request) {
        privateServerSupportCache.delete(universeId);
      }
      throw error;
    });
  setBoundedPrivateServerSupportCache(universeId, {
    expiresAt: now + PRIVATE_SERVER_SUPPORT_UNIVERSE_CACHE_TTL_MS,
    promise: request
  });
  return request;
}

function refreshPrivateServerSupport(normalizedPlaceId, priority = "foreground") {
  const pending = privateServerSupportRequestsByPlaceId.get(normalizedPlaceId);
  if (pending) {
    return pending;
  }
  const request = queuePrivateServerSupportTask(async () => {
    const universeId = await resolveUniverseId(normalizedPlaceId);
    const support = await getPrivateServerSupportForUniverse(universeId);
    return Object.freeze({
      placeId: normalizedPlaceId,
      universeId: support.universeId,
      enabled: support.enabled,
      price: support.price
    });
  }, priority)
    .then((support) => cacheConfirmedPrivateServerSupport(support))
    .finally(() => {
      if (privateServerSupportRequestsByPlaceId.get(normalizedPlaceId) === request) {
        privateServerSupportRequestsByPlaceId.delete(normalizedPlaceId);
      }
    });
  privateServerSupportRequestsByPlaceId.set(normalizedPlaceId, request);
  return request;
}

async function getPrivateServerSupport(placeId) {
  const normalizedPlaceId = normalizePrivateServerPlaceId(placeId);
  if (!normalizedPlaceId) {
    throw new PrivateServerError("INVALID");
  }
  await hydratePrivateServerSupportStorage();
  const freshEntry = getPrivateServerSupportPlaceCacheEntry(normalizedPlaceId);
  if (freshEntry) {
    return makePrivateServerSupportResult(freshEntry);
  }
  const staleEntry = getPrivateServerSupportPlaceCacheEntry(normalizedPlaceId, true);
  if (staleEntry) {
    void refreshPrivateServerSupport(normalizedPlaceId, "refresh").catch(
      () => undefined
    );
    return makePrivateServerSupportResult(staleEntry, true);
  }
  return refreshPrivateServerSupport(normalizedPlaceId);
}

async function fetchPrivateServersPage(placeId, cursor) {
  const endpoint = new URL(
    `/v1/games/${placeId}/private-servers`,
    "https://games.roblox.com"
  );
  if (cursor) {
    endpoint.searchParams.set("cursor", cursor);
  }

  const payload = await fetchJson(endpoint, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" }
  });

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    (payload.data !== null && !Array.isArray(payload.data)) ||
    (Object.hasOwn(payload, "gameJoinRestricted") &&
      typeof payload.gameJoinRestricted !== "boolean")
  ) {
    throw new PrivateServerError("ROBLOX_UNAVAILABLE");
  }

  const parsedNextCursor = parsePrivateServerCursor(payload.nextPageCursor);
  if (!parsedNextCursor.valid) {
    throw new PrivateServerError("ROBLOX_UNAVAILABLE");
  }
  const gameJoinRestricted = payload.gameJoinRestricted === true;
  return Object.freeze({
    servers: sanitizePrivateServerList(payload.data || []),
    nextPageCursor: parsedNextCursor.value,
    gameJoinRestricted
  });
}

async function getPrivateServersPage(placeId, cursor = null) {
  const normalizedPlaceId = normalizePrivateServerPlaceId(placeId);
  const parsedCursor = parsePrivateServerCursor(cursor);
  if (!normalizedPlaceId || !parsedCursor.valid) {
    throw new PrivateServerError("INVALID");
  }

  const viewerUserId = await getAuthenticatedViewerUserId();
  const requestKey = JSON.stringify([
    viewerUserId,
    normalizedPlaceId,
    parsedCursor.value
  ]);
  const pending = privateServerListRequests.get(requestKey);
  if (pending) {
    return pending;
  }
  if (privateServerListRequests.size >= PRIVATE_SERVER_LIST_MAX_IN_FLIGHT) {
    throw new PrivateServerError("RATE_LIMITED");
  }

  const request = fetchPrivateServersPage(normalizedPlaceId, parsedCursor.value)
    .finally(() => {
      if (privateServerListRequests.get(requestKey) === request) {
        privateServerListRequests.delete(requestKey);
      }
    });
  privateServerListRequests.set(requestKey, request);
  return request;
}

function getPrivateServerErrorCode(error) {
  if (error instanceof PrivateServerError) return error.code;
  if (error?.status === 401) return "UNAUTHENTICATED";
  if (error?.status === 403) return "FORBIDDEN";
  if (error?.status === 429) return "RATE_LIMITED";
  if (typeof error?.status === "number" && error.status >= 500) {
    return "ROBLOX_UNAVAILABLE";
  }
  if (error instanceof SyntaxError) return "ROBLOX_UNAVAILABLE";
  if (error?.name === "AbortError" || error instanceof TypeError) return "NETWORK";
  return "ROBLOX_UNAVAILABLE";
}

function handlePrivateServerSupportMessage(message, sendResponse) {
  if (message?.type !== PRIVATE_SERVER_SUPPORT_MESSAGE_TYPE) {
    return false;
  }
  const requestId = normalizePrivateServerRequestId(message.requestId);
  const placeId = normalizePrivateServerPlaceId(message.placeId);
  if (requestId === null || placeId === null) {
    sendResponse({
      ok: false,
      requestId: requestId ?? 0,
      placeId,
      code: "INVALID"
    });
    return false;
  }

  getPrivateServerSupport(placeId)
    .then((support) => {
      sendResponse({
        ok: true,
        requestId,
        placeId,
        universeId: support.universeId,
        enabled: support.enabled,
        price: support.price,
        stale: support.stale === true
      });
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        requestId,
        placeId,
        code: getPrivateServerErrorCode(error)
      });
    });
  return true;
}

function handlePrivateServerListMessage(message, sendResponse) {
  if (message?.type !== PRIVATE_SERVER_LIST_MESSAGE_TYPE) {
    return false;
  }
  const requestId = normalizePrivateServerRequestId(message.requestId);
  const placeId = normalizePrivateServerPlaceId(message.placeId);
  const parsedCursor = parsePrivateServerCursor(message.cursor);
  if (requestId === null || placeId === null || !parsedCursor.valid) {
    sendResponse({
      ok: false,
      requestId: requestId ?? 0,
      placeId,
      code: "INVALID"
    });
    return false;
  }

  getPrivateServersPage(placeId, parsedCursor.value)
    .then((page) => {
      sendResponse({
        ok: true,
        requestId,
        placeId,
        servers: page.servers,
        nextPageCursor: page.nextPageCursor,
        gameJoinRestricted: page.gameJoinRestricted
      });
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        requestId,
        placeId,
        code: getPrivateServerErrorCode(error)
      });
    });
  return true;
}

function handlePrivateServerOwnerThumbnailsMessage(message, sendResponse) {
  if (message?.type !== PRIVATE_SERVER_OWNER_THUMBNAILS_MESSAGE_TYPE) {
    return false;
  }
  const requestId = normalizePrivateServerRequestId(message.requestId);
  const rawUserIds = Array.isArray(message.userIds) ? message.userIds : null;
  const userIds = rawUserIds
    ? [...new Set(rawUserIds.map((value) => String(value)))]
    : [];
  if (
    requestId === null ||
    !rawUserIds ||
    userIds.length === 0 ||
    userIds.length > 100 ||
    userIds.some((userId) => !isValidId(userId))
  ) {
    sendResponse({
      ok: false,
      requestId: requestId ?? 0,
      code: "INVALID"
    });
    return false;
  }

  fetchAvatarHeadshots(userIds)
    .then((headshots) => {
      sendResponse({
        ok: true,
        requestId,
        thumbnails: userIds.map((userId) => ({
          userId,
          url: isSafeThumbnailUrl(headshots.get(userId))
            ? headshots.get(userId)
            : null
        }))
      });
    })
    .catch(() => {
      sendResponse({
        ok: false,
        requestId,
        code: "ROBLOX_UNAVAILABLE"
      });
    });
  return true;
}

function isTrustedRobloxPageUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return (
      url.protocol === "https:" &&
      url.hostname === "www.roblox.com" &&
      url.port === "" &&
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
}

function getTrustedRobloxTopFrameTabId(sender) {
  const tabId = sender?.tab?.id;
  if (
    !Number.isSafeInteger(tabId) ||
    tabId < 0 ||
    sender?.frameId !== 0 ||
    !isTrustedRobloxPageUrl(sender.tab.url) ||
    (typeof sender.url === "string" && !isTrustedRobloxPageUrl(sender.url))
  ) {
    return null;
  }
  return tabId;
}

function getTrustedRobloxHomeTabId(sender) {
  const tabId = getTrustedRobloxTopFrameTabId(sender);
  if (tabId === null) {
    return null;
  }
  const rawUrls = [sender.tab.url];
  if (typeof sender.url === "string") {
    rawUrls.push(sender.url);
  }
  for (const rawUrl of rawUrls) {
    try {
      const url = new URL(rawUrl);
      if (!/^\/home(?:\/|$)/i.test(url.pathname)) {
        return null;
      }
    } catch {
      return null;
    }
  }
  return tabId;
}

function getTrustedRobloxChartsTabId(sender) {
  const tabId = getTrustedRobloxTopFrameTabId(sender);
  if (tabId === null) {
    return null;
  }
  const rawUrls = [sender.tab.url];
  if (typeof sender.url === "string") {
    rawUrls.push(sender.url);
  }
  for (const rawUrl of rawUrls) {
    try {
      const url = new URL(rawUrl);
      if (!/^\/charts(?:\/|$)/i.test(url.pathname)) {
        return null;
      }
    } catch {
      return null;
    }
  }
  return tabId;
}

function getTrustedRobloxFriendsTabId(sender) {
  const tabId = getTrustedRobloxTopFrameTabId(sender);
  if (tabId === null) {
    return null;
  }
  const rawUrls = [sender.tab.url];
  if (typeof sender.url === "string") {
    rawUrls.push(sender.url);
  }
  for (const rawUrl of rawUrls) {
    try {
      const url = new URL(rawUrl);
      if (!/^\/users\/friends(?:\/|$)/i.test(url.pathname)) {
        return null;
      }
    } catch {
      return null;
    }
  }
  return tabId;
}

function normalizeFriendFilterOperation(message) {
  const value =
    typeof message?.op === "string"
      ? message.op
      : typeof message?.operation === "string"
        ? message.operation
        : "";
  const operation = value.trim().toLowerCase();
  return ["resolve-game"].includes(operation)
    ? operation
    : null;
}

async function resolveFriendFilterTargetUserId(message) {
  const directUserId = normalizeId(message?.targetUserId);
  if (directUserId) {
    return directUserId;
  }
  const input =
    message?.target ??
    message?.input ??
    message?.query ??
    message?.value ??
    message?.user ??
    "";
  return (await resolveFriendFilterUser(input)).userId;
}

function getFriendFilterExpectedViewerUserId(message) {
  if (
    message?.viewerUserId === undefined ||
    message?.viewerUserId === null ||
    message?.viewerUserId === ""
  ) {
    return null;
  }
  const viewerUserId = normalizeId(message.viewerUserId);
  if (!viewerUserId) {
    throw new FriendFilterError("INVALID", 400);
  }
  return viewerUserId;
}

function makeFriendFilterScanContext(
  operation,
  signature,
  message,
  requestContext,
  isStart
) {
  const expectedViewerUserId = getFriendFilterExpectedViewerUserId(message);
  const requestedScanId = normalizeFriendFilterScanId(message?.scanId);
  if (requestedScanId === undefined) {
    throw new FriendFilterError("INVALID", 400);
  }
  const safeSignature = String(signature ?? "").replace(/[^A-Za-z0-9_-]/g, "");
  if (!safeSignature || safeSignature.length > 80) {
    throw new FriendFilterError("INVALID", 400);
  }
  return {
    key:
      `${requestContext.senderKey}:${requestContext.requestId}:` +
      `${operation}:${safeSignature}`,
    isStart,
    expectedViewerUserId,
    requestedScanId
  };
}

async function dispatchFriendFilterDataOperation(
  operation,
  message,
  requestContext = null
) {
  if (operation === "resolve-user") {
    const input =
      message?.input ?? message?.query ?? message?.value ?? message?.user ?? "";
    const [viewerUserId, user] = await Promise.all([
      getAuthenticatedViewerUserId(),
      resolveFriendFilterUser(input)
    ]);
    const expectedViewerUserId = getFriendFilterExpectedViewerUserId(message);
    if (expectedViewerUserId && expectedViewerUserId !== viewerUserId) {
      throw makeFriendFilterViewerError("ACCOUNT_CHANGED", viewerUserId);
    }
    return {
      ok: true,
      status: "ready",
      code: "",
      viewerUserId,
      target: user,
      user
    };
  }

  if (operation === "resolve-game") {
    const input =
      message?.input ??
      message?.query ??
      message?.value ??
      message?.game ??
      message?.placeId ??
      "";
    const [viewerUserId, game] = await Promise.all([
      getAuthenticatedViewerUserId(),
      resolveFriendFilterGame(input, message?.universeId)
    ]);
    const expectedViewerUserId = getFriendFilterExpectedViewerUserId(message);
    if (expectedViewerUserId && expectedViewerUserId !== viewerUserId) {
      throw makeFriendFilterViewerError("ACCOUNT_CHANGED", viewerUserId);
    }
    return {
      ok: true,
      status: "ready",
      code: "",
      viewerUserId,
      target: game,
      game
    };
  }

  if (operation === "friendship-batch") {
    const targetUserId = await resolveFriendFilterTargetUserId(message);
    const nextIndex = Number(message?.nextIndex ?? 0);
    const scanContext = requestContext
      ? makeFriendFilterScanContext(
          operation,
          targetUserId,
          message,
          requestContext,
          nextIndex === 0
        )
      : null;
    return getFriendshipFilterBatch(targetUserId, nextIndex, scanContext);
  }

  throw new FriendFilterError("INVALID", 400);
}

function handleFriendFilterDataMessage(message, sender, sendResponse) {
  if (message?.type !== FRIEND_FILTER_MESSAGE_TYPE) {
    return false;
  }
  const requestId =
    Number.isSafeInteger(message.requestId) && message.requestId >= 0
      ? message.requestId
      : null;
  const operation = normalizeFriendFilterOperation(message);
  const trustedTabId = getTrustedRobloxFriendsTabId(sender);
  if (
    requestId === null ||
    !operation ||
    trustedTabId === null
  ) {
    sendResponse({
      ok: false,
      status: "error",
      requestId: requestId ?? 0,
      operation: operation || "",
      code: "INVALID"
    });
    return false;
  }

  const senderDocumentId =
    typeof sender?.documentId === "string" &&
    /^[A-Za-z0-9_-]{1,160}$/.test(sender.documentId)
      ? sender.documentId
      : "top";
  dispatchFriendFilterDataOperation(operation, message, {
    requestId,
    senderKey: `${trustedTabId}:${senderDocumentId}`
  })
    .then((response) => {
      sendResponse({ ...response, requestId, operation });
    })
    .catch((error) => {
      const code = getFriendFilterErrorCode(error);
      if (code === "UNAUTHENTICATED" || code === "ACCOUNT_CHANGED") {
        authenticatedUserRequest = null;
        friendIdsCache = null;
        friendFilterScanSnapshots.clear();
      }
      sendResponse({
        ok: false,
        status:
          code === "RATE_LIMITED"
            ? "partial"
            : ["PRIVACY_OR_REGION", "NOT_FOUND", "TARGET_TOO_LARGE"].includes(code)
              ? "unavailable"
              : "error",
        requestId,
        operation,
        code,
        viewerUserId: normalizeId(error?.viewerUserId),
        retryAfterMs: Math.max(0, Number(error?.retryAfterMs) || 0)
      });
    });
  return true;
}

function handleQuickSettingsReadMessage(message, sender, sendResponse) {
  if (message?.type !== QUICK_SETTINGS_READ_MESSAGE_TYPE) {
    return false;
  }
  const requestId = Number.isSafeInteger(message.requestId) && message.requestId > 0
    ? message.requestId
    : null;
  if (requestId === null || getTrustedRobloxHomeTabId(sender) === null) {
    sendResponse({
      ok: false,
      requestId: requestId ?? 0,
      code: "INVALID"
    });
    return false;
  }

  getQuickSettingsSnapshot()
    .then(({ viewerUserId, settings }) => {
      sendResponse({ ok: true, requestId, viewerUserId, settings });
    })
    .catch((error) => {
      if (error?.status === 401) {
        authenticatedUserRequest = null;
        quickSettingsReadRequest = null;
      }
      sendResponse({
        ok: false,
        requestId,
        code: getQuickSettingsErrorCode(error)
      });
    });
  return true;
}

function enqueueQuickSettingsWrite(task) {
  const enqueuedAt = Date.now();
  quickSettingsPendingWriteCount += 1;
  quickSettingsWriteGeneration += 1;
  const update = quickSettingsWriteTail
    .catch(() => undefined)
    .then(() => {
      if (Date.now() - enqueuedAt > QUICK_SETTINGS_QUEUE_MAX_AGE_MS) {
        throw new QuickSettingsError("EXPIRED");
      }
      return task();
    });
  const settledUpdate = update.finally(() => {
    quickSettingsPendingWriteCount = Math.max(0, quickSettingsPendingWriteCount - 1);
    quickSettingsWriteGeneration += 1;
  });
  quickSettingsWriteTail = settledUpdate.catch(() => undefined);
  return settledUpdate;
}

function handleQuickSettingUpdateMessage(message, sender, sendResponse) {
  if (message?.type !== QUICK_SETTING_UPDATE_MESSAGE_TYPE) {
    return false;
  }
  const requestId = Number.isSafeInteger(message.requestId) && message.requestId > 0
    ? message.requestId
    : null;
  const viewerUserId = normalizeId(message.viewerUserId);
  const alias = typeof message.alias === "string" ? message.alias : "";
  const spec = QUICK_SETTING_SPECS[alias];
  const expectedValue =
    typeof message.expectedValue === "string" ? message.expectedValue : "";
  const requestedValue =
    typeof message.requestedValue === "string" ? message.requestedValue : "";
  if (
    requestId === null ||
    getTrustedRobloxHomeTabId(sender) === null ||
    !viewerUserId ||
    !spec ||
    !DIRECT_QUICK_SETTING_ALIASES.includes(alias) ||
    !spec.allowedValues.includes(expectedValue) ||
    !spec.allowedValues.includes(requestedValue)
  ) {
    sendResponse({
      ok: false,
      requestId: requestId ?? 0,
      code: "INVALID"
    });
    return false;
  }

  const update = enqueueQuickSettingsWrite(() =>
    applyDirectQuickSettingUpdate(
        viewerUserId,
        alias,
        expectedValue,
        requestedValue
      )
  );
  update
    .then((result) => {
      sendResponse({
        ok: true,
        requestId,
        viewerUserId: result.viewerUserId,
        settings: result.settings
      });
    })
    .catch((error) => {
      if (error?.status === 401) {
        authenticatedUserRequest = null;
        clearQuickSettingsCsrfToken(viewerUserId);
      }
      sendResponse({
        ok: false,
        requestId,
        code: getQuickSettingsErrorCode(error)
      });
    });
  return true;
}

function handleOnlineStatusUpdateMessage(message, sender, sendResponse) {
  if (message?.type !== ONLINE_STATUS_UPDATE_MESSAGE_TYPE) {
    return false;
  }
  const requestId = Number.isSafeInteger(message.requestId) && message.requestId > 0
    ? message.requestId
    : null;
  const viewerUserId = normalizeId(message.viewerUserId);
  const expectedOnlineStatus =
    typeof message.expectedOnlineStatus === "string"
      ? message.expectedOnlineStatus
      : "";
  const expectedCurrentExperience =
    typeof message.expectedCurrentExperience === "string"
      ? message.expectedCurrentExperience
      : "";
  const requestedOnlineStatus =
    typeof message.requestedOnlineStatus === "string"
      ? message.requestedOnlineStatus
      : "";
  if (
    requestId === null ||
    getTrustedRobloxHomeTabId(sender) === null ||
    !viewerUserId ||
    !QUICK_SETTING_SPECS.onlineStatus.allowedValues.includes(
      expectedOnlineStatus
    ) ||
    !QUICK_SETTING_SPECS.currentExperience.allowedValues.includes(
      expectedCurrentExperience
    ) ||
    !QUICK_SETTING_SPECS.onlineStatus.allowedValues.includes(
      requestedOnlineStatus
    )
  ) {
    sendResponse({
      ok: false,
      requestId: requestId ?? 0,
      code: "INVALID"
    });
    return false;
  }

  const update = enqueueQuickSettingsWrite(() =>
    applyOnlineStatusUpdate(
      viewerUserId,
      expectedOnlineStatus,
      expectedCurrentExperience,
      requestedOnlineStatus
    )
  );
  update
    .then((result) => {
      sendResponse({
        ok: true,
        requestId,
        viewerUserId: result.viewerUserId,
        settings: result.settings,
        experienceRestore: result.experienceRestore
      });
    })
    .catch((error) => {
      if (error?.status === 401) {
        authenticatedUserRequest = null;
        clearQuickSettingsCsrfToken(viewerUserId);
      }
      sendResponse({
        ok: false,
        requestId,
        code: getQuickSettingsErrorCode(error)
      });
    });
  return true;
}

async function executePrivateServerJoin(tabId, placeId, accessCode) {
  if (typeof chrome.scripting?.executeScript !== "function") {
    return "unavailable";
  }

  let injectionResults;
  try {
    injectionResults = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      world: "MAIN",
      args: [Number(placeId), accessCode],
      func: async (placeId, accessCode) => {
        if (
          typeof globalThis.Roblox?.GameLauncher?.joinPrivateGame !== "function"
        ) {
          return "unavailable";
        }
        try {
          const launchResult = globalThis.Roblox.GameLauncher.joinPrivateGame(
            placeId,
            accessCode,
            ""
          );
          if (launchResult && typeof launchResult.then === "function") {
            await launchResult;
          }
          return "started";
        } catch {
          return "failed";
        }
      }
    });
  } catch {
    return "failed";
  }

  const mainFrameResult = Array.isArray(injectionResults)
    ? injectionResults.find((entry) => entry?.frameId === 0)?.result
    : null;
  return mainFrameResult === "started" ||
    mainFrameResult === "unavailable" ||
    mainFrameResult === "failed"
    ? mainFrameResult
    : "failed";
}

function handleJoinPrivateServerMessage(message, sender, sendResponse) {
  if (message?.type !== PRIVATE_SERVER_JOIN_MESSAGE_TYPE) {
    return false;
  }

  const requestId = normalizePrivateServerRequestId(message.requestId);
  const placeId = normalizePrivateServerPlaceId(message.placeId);
  const accessCode = normalizePrivateServerAccessCode(message.accessCode);
  const tabId = getTrustedRobloxTopFrameTabId(sender);
  if (requestId === null || placeId === null || accessCode === null || tabId === null) {
    sendResponse({
      ok: false,
      requestId: requestId ?? 0,
      placeId,
      code: "failed"
    });
    return false;
  }

  executePrivateServerJoin(tabId, placeId, accessCode)
    .then((code) => {
      sendResponse({
        ok: code === "started",
        requestId,
        placeId,
        code
      });
    })
    .catch(() => {
      sendResponse({
        ok: false,
        requestId,
        placeId,
        code: "failed"
      });
    });
  return true;
}

function resetPrivateServerSupportMemoryForTests() {
  universeIdCache.clear();
  privateServerSupportCache.clear();
  privateServerSupportByPlaceId.clear();
  privateServerSupportRequestsByPlaceId.clear();
  const resetError = new PrivateServerError("ROBLOX_UNAVAILABLE");
  while (privateServerSupportTaskQueue.length > 0) {
    privateServerSupportTaskQueue.shift().reject(resetError);
  }
  if (privateServerSupportQueueTimer !== null) {
    clearTimeout(privateServerSupportQueueTimer);
    privateServerSupportQueueTimer = null;
  }
  privateServerSupportStorageLoadPromise = null;
  privateServerSupportStorageWritePromise = Promise.resolve();
  activePrivateServerSupportTasks = 0;
  privateServerSupportRateLimitedUntil = 0;
  privateServerSupportNextStartAt = 0;
}

async function resetPrivateServerStateForTests() {
  resetPrivateServerSupportMemoryForTests();
  privateServerListRequests.clear();
  privateServerDisplayTokenSequence = 0;
  await writePrivateServerSupportStorage(null);
}

function getOnlineFriendsErrorCode(error) {
  if (error?.status === 401) return "UNAUTHENTICATED";
  if (error?.status === 403) return "FORBIDDEN";
  if (error?.status === 429) return "RATE_LIMITED";
  if (typeof error?.status === "number" && error.status >= 500) return "ROBLOX_UNAVAILABLE";
  return "NETWORK";
}

function resetQuickSettingsStateForTests() {
  quickSettingsReadRequest = null;
  clearQuickSettingsCsrfToken();
  quickSettingsWriteTail = Promise.resolve();
  quickSettingsWriteGeneration = 0;
  quickSettingsPendingWriteCount = 0;
  quickSettingsExperiencePreferenceWriteTail = Promise.resolve();
  invalidQuickSettingsExperienceRestoreViewerIds.clear();
}

if (globalThis.__rslBackgroundTestHooks) {
  Object.assign(globalThis.__rslBackgroundTestHooks, {
    fetchAllOnlineFriends,
    fetchAllFriendIds,
    normalizeFriendListItems,
    mergeFriendListResults,
    reuseOnlineFriendDetails,
    getAllOnlineFriends,
    getOnlineFriendsDetails,
    getOfflineFriendsDetails,
    getBestFriendsContext,
    fetchUserProfiles,
    resolveFriendFilterUser,
    resolveFriendFilterGame,
    getFriendshipFilterBatch,
    getFriendCountFilterChunk,
    getTargetFollowersFilterChunk,
    normalizeFriendFilterMetric,
    normalizeFriendshipStatus,
    getFriendFilterErrorCode,
    getTrustedRobloxFriendsTabId,
    handleFriendFilterDataMessage,
    resetFriendFilterStateForTests,
    getFriendFilterScanSnapshotCountForTests() {
      pruneFriendFilterScanSnapshots();
      return friendFilterScanSnapshots.size;
    },
    getViewerCanChat,
    getThumbnail,
    parseRobloxContextUrl,
    resolveUniverseId,
    getAssetDetails,
    findReferencedAssetId,
    resolveAssetTextureId,
    getContextCopyResult,
    isContextActionAvailable,
    setupContextMenus,
    normalizeRandomServerPlaceId,
    fetchRandomServerCandidates,
    getRandomServerCandidates,
    getRandomPublicServer,
    pickUniformRandomIndex,
    handleRandomServerMessage,
    normalizeGameCcuRequestGames,
    fetchGameCcuBatch,
    fetchGameRatingBatch,
    getGameCcuForRequest,
    handleGameCcuMessage,
    resetGameCcuStateForTests,
    normalizeGameCcuHistoryObservation,
    createGameCcuHistorySnapshot,
    decodeGameCcuHistorySnapshot,
    mergeGameCcuHistorySnapshots,
    findGameCcuInHistorySnapshot,
    buildGameCcuHistoryFromSnapshots,
    parseGameCcuChartsPage,
    buildGameCcuChartsPageUrl,
    fetchAllGameCcuChartsPages,
    fetchMergedGameCcuChartsPages,
    appendGameCcuHistoryObservations,
    readGameCcuHistory,
    loadGameCcuHistorySnapshotCache,
    getLatestGameCcuHistorySnapshotTimestamp,
    getLatestGameCcuHistorySnapshotState,
    runGameCcuHistoryCollection,
    runGameCcuHistoryCollectionIfStale,
    hasCurrentGameCcuHistoryPoint,
    seedVisibleChartsGameCcuHistory,
    getGameCcuHistoryForRequest,
    handleGameCcuHistoryMessage,
    ensureGameCcuHistoryAlarm,
    clearGameCcuHistoryAlarm,
    applyGameCcuHistoryFeatureValue,
    resetGameCcuHistoryStateForTests,
    setGameCcuHistoryStorageOverrideForTests(override) {
      gameCcuHistoryStorageOverride = override;
    },
    getGameCcuHistoryStateForTests() {
      return {
        featureEnabled: gameCcuHistoryFeatureEnabled,
        failureCount: gameCcuHistoryFailureCount,
        retryNotBefore: gameCcuHistoryRetryNotBefore,
        collectionInFlight: Boolean(gameCcuHistoryCollectionPromise),
        cachedSnapshots: gameCcuHistorySnapshotCache?.length ?? null
      };
    },
    gameCcuHistoryConstants: Object.freeze({
      messageType: GAME_CCU_HISTORY_MESSAGE_TYPE,
      alarmName: GAME_CCU_HISTORY_ALARM_NAME,
      alarmPeriodMinutes: GAME_CCU_HISTORY_ALARM_PERIOD_MINUTES,
      bucketMs: GAME_CCU_HISTORY_BUCKET_MS,
      retentionMs: GAME_CCU_HISTORY_RETENTION_MS,
      maxPoints: GAME_CCU_HISTORY_MAX_POINTS,
      maxChartPages: GAME_CCU_HISTORY_MAX_CHART_PAGES,
      feedVersion: GAME_CCU_HISTORY_FEED_VERSION
    }),
    parsePrivateServerCursor,
    getPrivateServerSupport,
    getPrivateServerSupportForUniverse,
    fetchPrivateServersPage,
    getPrivateServersPage,
    sanitizePrivateServerList,
    normalizePrivateServerAccessCode,
    getPrivateServerErrorCode,
    handlePrivateServerSupportMessage,
    handlePrivateServerListMessage,
    handlePrivateServerOwnerThumbnailsMessage,
    normalizeQuickSettingsPayload,
    fetchQuickSettingsViewerUserId,
    fetchQuickSettingsValues,
    fetchVerifiedQuickSettingsSnapshot,
    fetchStableQuickSettingsSnapshot,
    getQuickSettingsSnapshot,
    clearQuickSettingsCsrfToken,
    isValidQuickSettingsCsrfToken,
    postQuickSetting,
    postQuickSettings,
    applyQuickSettingUpdate,
    applyDirectQuickSettingUpdate,
    applyOnlineStatusUpdate,
    readPreferredCurrentExperience,
    writePreferredCurrentExperience,
    clearPreferredCurrentExperience,
    getQuickSettingsErrorCode,
    resetQuickSettingsStateForTests,
    isTrustedRobloxPageUrl,
    getTrustedRobloxTopFrameTabId,
    getTrustedRobloxChartsTabId,
    getTrustedRobloxHomeTabId,
    handleQuickSettingsReadMessage,
    handleQuickSettingUpdateMessage,
    handleOnlineStatusUpdateMessage,
    executePrivateServerJoin,
    handleJoinPrivateServerMessage,
    handleRuntimeMessage,
    resetRandomServerStateForTests,
    resetPrivateServerSupportMemoryForTests,
    resetPrivateServerStateForTests,
    resetFriendAggregationStateForTests,
    getCopyRobloxIdsFeatureValue,
    setCopyRobloxIdsEnabledForTests(value) {
      copyRobloxIdsEnabled = value !== false;
    },
    contextMenuActions: CONTEXT_MENU_ACTIONS,
    contextMenuRoutePatterns: CONTEXT_MENU_ROUTE_PATTERNS
  });
}

chrome.runtime.onInstalled?.addListener(() => {
  syncContextMenusFromStorage();
  syncGameCcuHistoryFeatureFromStorage(true);
});

chrome.runtime.onStartup?.addListener(() => {
  syncGameCcuHistoryFeatureFromStorage("stale");
});

chrome.alarms?.onAlarm?.addListener((alarm) => {
  if (
    alarm?.name === GAME_CCU_HISTORY_ALARM_NAME &&
    gameCcuHistoryFeatureEnabled
  ) {
    void runGameCcuHistoryCollection();
  }
});

chrome.storage?.onChanged?.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes?.[FEATURE_SETTINGS_STORAGE_KEY]) {
    return;
  }
  copyRobloxIdsEnabled = getCopyRobloxIdsFeatureValue(
    changes[FEATURE_SETTINGS_STORAGE_KEY].newValue
  );
  applyGameCcuHistoryFeatureValue(
    changes[FEATURE_SETTINGS_STORAGE_KEY].newValue,
    true
  );
  setupContextMenus();
});

chrome.contextMenus?.onClicked?.addListener((info, tab) => {
  void handleContextMenuClick(info, tab);
});

function handleRuntimeMessage(message, sender, sendResponse) {
  if (sender.id !== chrome.runtime.id) {
    return false;
  }

  if (message?.type === FRIEND_FILTER_MESSAGE_TYPE) {
    return handleFriendFilterDataMessage(message, sender, sendResponse);
  }

  if (message?.type === QUICK_SETTINGS_READ_MESSAGE_TYPE) {
    return handleQuickSettingsReadMessage(message, sender, sendResponse);
  }

  if (message?.type === QUICK_SETTING_UPDATE_MESSAGE_TYPE) {
    return handleQuickSettingUpdateMessage(message, sender, sendResponse);
  }

  if (message?.type === ONLINE_STATUS_UPDATE_MESSAGE_TYPE) {
    return handleOnlineStatusUpdateMessage(message, sender, sendResponse);
  }

  if (message?.type === RANDOM_SERVER_MESSAGE_TYPE) {
    return handleRandomServerMessage(message, sendResponse);
  }

  if (message?.type === GAME_CCU_MESSAGE_TYPE) {
    return handleGameCcuMessage(message, sender, sendResponse);
  }

  if (message?.type === GAME_CCU_HISTORY_MESSAGE_TYPE) {
    return handleGameCcuHistoryMessage(message, sender, sendResponse);
  }

  if (message?.type === PRIVATE_SERVER_SUPPORT_MESSAGE_TYPE) {
    return handlePrivateServerSupportMessage(message, sendResponse);
  }

  if (message?.type === PRIVATE_SERVER_LIST_MESSAGE_TYPE) {
    return handlePrivateServerListMessage(message, sendResponse);
  }

  if (message?.type === PRIVATE_SERVER_OWNER_THUMBNAILS_MESSAGE_TYPE) {
    return handlePrivateServerOwnerThumbnailsMessage(message, sendResponse);
  }

  if (message?.type === PRIVATE_SERVER_JOIN_MESSAGE_TYPE) {
    return handleJoinPrivateServerMessage(message, sender, sendResponse);
  }

  if (message?.type === "rsl:get-thumbnail") {
    if (!Object.hasOwn(THUMBNAIL_SPECS, message.kind) || !isValidId(message.id)) {
      return false;
    }

    getThumbnail(message.kind, message.id, message.forceRefresh === true)
      .then((url) => sendResponse({ url }))
      .catch(() => sendResponse({ url: null }));
    return true;
  }

  if (message?.type === "rsl:get-all-online-friends") {
    const requestId = Number.isSafeInteger(message.requestId) ? message.requestId : 0;
    getAllOnlineFriends(message.forceRefresh === true)
      .then((response) => sendResponse({ ...response, requestId }))
      .catch((error) => {
        if (error?.status === 401) {
          onlineFriendsCache = null;
          friendIdsCache = null;
          authenticatedUserRequest = null;
        }
        sendResponse({
          ok: false,
          requestId,
          code: getOnlineFriendsErrorCode(error)
        });
      });

    return true;
  }

  if (message?.type === "rsl:get-best-friends-context") {
    const requestId = Number.isSafeInteger(message.requestId) ? message.requestId : 0;
    getBestFriendsContext()
      .then((response) => sendResponse({ ...response, requestId }))
      .catch((error) => {
        if (error?.status === 401) {
          authenticatedUserRequest = null;
          friendIdsCache = null;
        }
        sendResponse({
          ok: false,
          requestId,
          code: getOnlineFriendsErrorCode(error)
        });
      });
    return true;
  }

  if (message?.type === "rsl:get-online-friend-details") {
    const requestId = Number.isSafeInteger(message.requestId) ? message.requestId : 0;
    getOnlineFriendsDetails(message.viewerUserId)
      .then((response) => sendResponse({ ...response, requestId }))
      .catch((error) => {
        sendResponse({
          ok: false,
          requestId,
          code: getOnlineFriendsErrorCode(error)
        });
      });
    return true;
  }

  if (message?.type === "rsl:get-offline-friend-details") {
    const requestId = Number.isSafeInteger(message.requestId) ? message.requestId : 0;
    getOfflineFriendsDetails(message.viewerUserId)
      .then((response) => sendResponse({ ...response, requestId }))
      .catch((error) => {
        sendResponse({
          ok: false,
          requestId,
          code: getOnlineFriendsErrorCode(error)
        });
      });
    return true;
  }

  return false;
}

chrome.runtime.onMessage.addListener(handleRuntimeMessage);

syncGameCcuHistoryFeatureFromStorage("stale");
