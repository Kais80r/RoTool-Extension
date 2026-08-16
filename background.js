"use strict";

const THUMBNAIL_SPECS = Object.freeze({
  profile: { path: "/v1/users/avatar-headshot", idParameter: "userIds", circular: true },
  game: { path: "/v1/places/gameicons", idParameter: "placeIds", circular: false },
  gameUniverse: { path: "/v1/games/icons", idParameter: "universeIds", circular: false },
  eventAsset: {
    path: "/v1/assets",
    idParameter: "assetIds",
    circular: false,
    size: "768x432",
    format: "Webp"
  },
  community: { path: "/v1/groups/icons", idParameter: "groupIds", circular: false }
});
const EXPERIENCE_PLACE_THUMBNAILS_MESSAGE_TYPE =
  "rsl:get-experience-place-thumbnails";
const EXPERIENCE_PLACES_ELIGIBILITY_MESSAGE_TYPE =
  "rsl:get-experience-places-eligibility";
const EXPERIENCE_PLACE_THUMBNAIL_BATCH_MAX = 24;
const EXPERIENCE_PLACE_THUMBNAIL_SIZE = "150x150";

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
const EXTENSION_UPDATE_STATUS_MESSAGE_TYPE =
  "rsl:get-extension-update-status";
const EXTENSION_UPDATE_PREFERENCES_GET_MESSAGE_TYPE =
  "rsl:get-extension-update-preferences";
const EXTENSION_UPDATE_PREFERENCES_SET_MESSAGE_TYPE =
  "rsl:set-extension-update-preferences";
const EXTENSION_UPDATE_CONTEXT_CHALLENGE_MESSAGE_TYPE =
  "rsl:verify-extension-update-claim-context";
const EXTENSION_UPDATE_STORAGE_KEY = "rslExtensionUpdateStatusV1";
const EXTENSION_UPDATE_STORAGE_VERSION = 1;
const EXTENSION_UPDATE_PREFERENCES_STORAGE_KEY =
  "rslExtensionUpdatePreferenceV1";
const EXTENSION_UPDATE_PREFERENCES_STORAGE_VERSION = 1;
const EXTENSION_UPDATE_DEFAULT_REMINDER_FREQUENCY = "6h";
const EXTENSION_UPDATE_REMINDER_FREQUENCIES = Object.freeze({
  home: null,
  "30m": 30 * 60_000,
  "1h": 60 * 60_000,
  "6h": 6 * 60 * 60_000,
  "24h": 24 * 60 * 60_000
});
const EXTENSION_UPDATE_FEATURE_SETTINGS_STORAGE_KEY = "rslFeatureSettingsV1";
const EXTENSION_UPDATE_FEATURE_SETTINGS_STORAGE_VERSION = 1;
const EXTENSION_UPDATE_MAX_PRESENTATION_MARKER_AGE_MS = 24 * 60 * 60_000;
const EXTENSION_UPDATE_MAX_HOME_VISIT_MARKERS = 256;
const EXTENSION_UPDATE_HOME_VISIT_ID_PATTERN =
  /^[a-z0-9](?:[a-z0-9_-]{6,94}[a-z0-9])?$/i;
const EXTENSION_UPDATE_CLAIM_CONTEXT_ID_PATTERN =
  /^[a-z0-9](?:[a-z0-9_-]{6,126}[a-z0-9])?$/i;
const EXTENSION_UPDATE_LATEST_RELEASE_URL =
  "https://api.github.com/repos/Kais80r/RoTool-Extension/releases/latest";
const EXTENSION_UPDATE_HOW_TO_URL =
  "https://github.com/Kais80r/RoTool-Extension/blob/main/UPDATING.md";
const EXTENSION_UPDATE_CACHE_TTL_MS = 24 * 60 * 60_000;
const EXTENSION_UPDATE_PRESENTATION_TTL_MS =
  EXTENSION_UPDATE_REMINDER_FREQUENCIES[
    EXTENSION_UPDATE_DEFAULT_REMINDER_FREQUENCY
  ];
const EXTENSION_UPDATE_FETCH_TIMEOUT_MS = 8_000;
const EXTENSION_UPDATE_MAX_RESPONSE_BYTES = 256 * 1_024;
const EXTENSION_UPDATE_FAILURE_RETRY_MS = 60 * 60_000;
const EXTENSION_UPDATE_CONTEXT_CHALLENGE_TIMEOUT_MS = 2_000;
let extensionUpdateCheckPromise = null;
let extensionUpdateStateLoadPromise = null;
let extensionUpdateStateMemory = null;
let extensionUpdateStateMutationTail = Promise.resolve();
let extensionUpdateStorageOverride = null;
let extensionUpdatePreferencesLoadPromise = null;
let extensionUpdatePreferencesMemory = null;
let extensionUpdatePreferencesStorageOverride = null;
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
const SERVER_HISTORY_FEATURE_KEY = "serverHistory";
const SERVER_HISTORY_STORAGE_KEY = "rslServerHistoryV1";
const SERVER_HISTORY_STORAGE_VERSION = 1;
const SERVER_HISTORY_ALARM_NAME = "rsl-server-history-v1";
const SERVER_HISTORY_ALARM_PERIOD_MINUTES = 1;
const SERVER_HISTORY_GET_MESSAGE_TYPE = "rsl:get-server-history";
const SERVER_HISTORY_CLEAR_MESSAGE_TYPE = "rsl:clear-server-history";
const SERVER_HISTORY_REJOIN_MESSAGE_TYPE = "rsl:rejoin-server-history";
const SERVER_HISTORY_MAX_SESSIONS = 30;
const SERVER_HISTORY_MAX_ACCOUNTS = 8;
const SERVER_HISTORY_CONTINUITY_GAP_MS = 3 * 60_000;
const SERVER_HISTORY_EXPERIENCE_NAME_MAX_LENGTH = 100;
const SERVER_HISTORY_FALLBACK_LOCALE = "en-US";
const GAME_EVENTS_FEATURE_KEY = "gameEvents";
const GAME_EVENTS_STORAGE_KEY = "rslGameEventFavoritesV1";
const GAME_EVENTS_STORAGE_VERSION = 1;
const GAME_EVENTS_GET_MESSAGE_TYPE = "rsl:get-game-events";
const GAME_EVENTS_ADD_MESSAGE_TYPE = "rsl:add-game-event-favorite";
const GAME_EVENTS_REMOVE_MESSAGE_TYPE = "rsl:remove-game-event-favorite";
const GAME_EVENTS_SEARCH_MESSAGE_TYPE = "rsl:search-game-events-games";
const GAME_EVENTS_MAX_GAMES_PER_ACCOUNT = 30;
const GAME_EVENTS_MAX_ACCOUNTS = 8;
const GAME_EVENTS_MAX_EVENTS_PER_GAME = 10;
const GAME_EVENTS_MAX_SEARCH_RESULTS = 8;
const GAME_EVENTS_SEARCH_QUERY_MAX_LENGTH = 100;
const GAME_EVENTS_SEARCH_CACHE_MAX_ENTRIES = 50;
const GAME_EVENTS_FETCH_CONCURRENCY = 4;
const GAME_EVENTS_CACHE_TTL_MS = 10 * 60_000;
const GAME_EVENTS_CACHE_MAX_ENTRIES =
  GAME_EVENTS_MAX_GAMES_PER_ACCOUNT * GAME_EVENTS_MAX_ACCOUNTS;
const GAME_EVENTS_NAME_MAX_LENGTH = 100;
const GAME_EVENTS_TITLE_MAX_LENGTH = 200;
const GAME_EVENTS_SUBTITLE_MAX_LENGTH = 300;
const GAME_EVENTS_FALLBACK_LOCALE = "en-US";
const JOIN_SCHEDULER_FEATURE_KEY = "joinScheduler";
const JOIN_SCHEDULER_SHOW_MESSAGE_TYPE = "rsl:show-join-scheduler";
const NATIVE_EVENT_SCHEDULE_DATA_MESSAGE_TYPE =
  "rsl:get-native-event-schedule-data";
const NATIVE_EVENT_SCHEDULE_MAX_EVENT_IDS = 50;
const NATIVE_EVENT_SCHEDULE_LOCALE_SEGMENTS = new Set([
  "de", "en", "en-us", "es", "fr", "id", "it", "ja", "ko", "pl",
  "pt", "pt-br", "ru", "th", "tr", "vi", "zh-cn", "zh-tw"
]);
const JOIN_SCHEDULER_MESSAGE_PREFIX = "rsl:join-scheduler:";
const JOIN_SCHEDULER_MESSAGE_TYPES = Object.freeze({
  getState: `${JOIN_SCHEDULER_MESSAGE_PREFIX}get-state`,
  getGameIcons: `${JOIN_SCHEDULER_MESSAGE_PREFIX}get-game-icons`,
  searchGames: `${JOIN_SCHEDULER_MESSAGE_PREFIX}search-games`,
  validateDestination: `${JOIN_SCHEDULER_MESSAGE_PREFIX}validate-destination`,
  saveDestination: `${JOIN_SCHEDULER_MESSAGE_PREFIX}save-destination`,
  deleteDestination: `${JOIN_SCHEDULER_MESSAGE_PREFIX}delete-destination`,
  createSchedule: `${JOIN_SCHEDULER_MESSAGE_PREFIX}create-schedule`,
  cancelSchedule: `${JOIN_SCHEDULER_MESSAGE_PREFIX}cancel-schedule`,
  deleteSchedule: `${JOIN_SCHEDULER_MESSAGE_PREFIX}delete-schedule`,
  joinNow: `${JOIN_SCHEDULER_MESSAGE_PREFIX}join-now`,
  setEnabled: `${JOIN_SCHEDULER_MESSAGE_PREFIX}set-enabled`,
  requestNotificationPermission:
    `${JOIN_SCHEDULER_MESSAGE_PREFIX}request-notification-permission`
});
const JOIN_SCHEDULER_DB_NAME = "rslJoinSchedulerV1";
const JOIN_SCHEDULER_DB_VERSION = 1;
const JOIN_SCHEDULER_DESTINATIONS_STORE = "destinations";
const JOIN_SCHEDULER_SCHEDULES_STORE = "schedules";
const JOIN_SCHEDULER_META_STORE = "meta";
const JOIN_SCHEDULER_RECORD_VERSION = 1;
const JOIN_SCHEDULER_ALARM_NAME = "rsl-join-scheduler-coordinator-v1";
const JOIN_SCHEDULER_NOTIFICATION_PREFIX = "rsl-join-scheduler-v1:";
const JOIN_SCHEDULER_MAX_ACCOUNTS = 8;
const JOIN_SCHEDULER_MAX_DESTINATIONS = 30;
const JOIN_SCHEDULER_MAX_SCHEDULES = 50;
const JOIN_SCHEDULER_GAME_ICON_MAX_IDS = JOIN_SCHEDULER_MAX_SCHEDULES;
const JOIN_SCHEDULER_GAME_ICON_CACHE_MAX_ENTRIES = 128;
const JOIN_SCHEDULER_GAME_ICON_CACHE_TTL_MS = 30 * 60_000;
const JOIN_SCHEDULER_GAME_ICON_FAILURE_CACHE_TTL_MS = 60_000;
const JOIN_SCHEDULER_GAME_ICON_URL_MAX_LENGTH = 2_048;
const JOIN_SCHEDULER_GAME_ICON_RESPONSE_MAX_BYTES = 256 * 1_024;
const JOIN_SCHEDULER_GAME_ICON_NOTIFICATION_DEADLINE_MS = 2_500;
const JOIN_SCHEDULER_GAME_ICON_NOTIFICATION_CACHE_MAX_ENTRIES = 32;
const JOIN_SCHEDULER_GAME_ICON_NOTIFICATION_CACHE_TTL_MS = 30 * 60_000;
const JOIN_SCHEDULER_GAME_ICON_NOTIFICATION_FAILURE_CACHE_TTL_MS = 60_000;
const JOIN_SCHEDULER_GAME_ICON_SPEC = Object.freeze({
  path: "/v1/games/icons",
  idParameter: "universeIds",
  circular: false,
  size: "150x150",
  format: "Png"
});
const JOIN_SCHEDULER_NOTIFICATION_LEAD_MS = 30_000;
const JOIN_SCHEDULER_LATE_GRACE_MS = 2 * 60_000;
const JOIN_SCHEDULER_AUTO_COLLISION_MS = 5 * 60_000;
const JOIN_SCHEDULER_MAX_FUTURE_MS = 366 * 24 * 60 * 60_000;
const JOIN_SCHEDULER_CONSENT_VERSION = 1;
const JOIN_SCHEDULER_TEXT_MAX_LENGTH = 120;
const JOIN_SCHEDULER_TITLE_MAX_LENGTH = 200;
const JOIN_SCHEDULER_SHARE_CODE_MAX_LENGTH = 512;
const JOIN_SCHEDULER_PRIVATE_URL_MAX_LENGTH = 2_048;
const JOIN_SCHEDULER_DESTINATION_RESOLVE_TIMEOUT_MS = 8_000;
const JOIN_SCHEDULER_DESTINATION_RESPONSE_MAX_BYTES = 512_000;
const JOIN_SCHEDULER_DESTINATION_REDIRECT_MAX_HOPS = 3;
const JOIN_SCHEDULER_BROWSER_API_TIMEOUT_MS = 15_000;
const JOIN_SCHEDULER_SHOW_MESSAGE_TIMEOUT_MS = 4_000;
const JOIN_SCHEDULER_NEW_TAB_READY_TIMEOUT_MS = 12_000;
const JOIN_SCHEDULER_SHOW_TAB_CANDIDATE_LIMIT = 5;
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
let serverHistoryFeatureEnabled = false;
let serverHistoryFeatureReady = false;
let serverHistoryFeatureSyncPromise = null;
let serverHistoryLifecycleGeneration = 0;
let serverHistoryPollPromise = null;
let serverHistoryStorageWriteTail = Promise.resolve();
let serverHistoryStorageOverride = null;
let serverHistorySessionIdSequence = 0;
let gameEventsFeatureEnabled = true;
let gameEventsFeatureReady = false;
let gameEventsFeatureSyncPromise = null;
let gameEventsStorageWriteTail = Promise.resolve();
let gameEventsStorageOverride = null;
const gameEventsCache = new Map();
const gameEventsRequests = new Map();
const gameEventsGameResolutionCache = new Map();
const gameEventsSearchCache = new Map();
let joinSchedulerFeatureEnabled = true;
let joinSchedulerFeatureReady = false;
let joinSchedulerFeatureSyncPromise = null;
let joinSchedulerDbPromise = null;
let joinSchedulerStorageWriteTail = Promise.resolve();
let joinSchedulerStorageOverride = null;
let joinSchedulerRuntimeOverrides = null;
let joinSchedulerCoordinatorPromise = null;
let joinSchedulerPermissionGeneration = 0;
const joinSchedulerGameIconCache = new Map();
const joinSchedulerNotificationIconCache = new Map();
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

class GameEventsError extends Error {
  constructor(code, status = 0, retryAfterMs = 0, viewerUserId = null) {
    super(code);
    this.name = "GameEventsError";
    this.code = code;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.viewerUserId = viewerUserId;
  }
}

class JoinSchedulerError extends Error {
  constructor(code, status = 0, details = null) {
    super(code);
    this.name = "JoinSchedulerError";
    this.code = code;
    this.status = status;
    this.details = details;
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
  endpoint.searchParams.set("size", spec.size || "150x150");
  endpoint.searchParams.set("format", spec.format || "Webp");
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

function normalizeExperiencePlaceThumbnailIds(rawValue) {
  if (
    !Array.isArray(rawValue) ||
    rawValue.length === 0 ||
    rawValue.length > EXPERIENCE_PLACE_THUMBNAIL_BATCH_MAX
  ) {
    return null;
  }
  const ids = [];
  const seen = new Set();
  for (const rawId of rawValue) {
    const id = typeof rawId === "string" ? rawId : "";
    if (!isValidId(id)) return null;
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids.length > 0 ? Object.freeze(ids) : null;
}

async function fetchExperiencePlaceThumbnails(placeIds) {
  const normalizedIds = normalizeExperiencePlaceThumbnailIds(placeIds);
  if (!normalizedIds) throw new TypeError("Invalid Experience Place IDs");
  const endpoint = new URL(
    "/v1/places/gameicons",
    "https://thumbnails.roblox.com"
  );
  endpoint.searchParams.set("placeIds", normalizedIds.join(","));
  endpoint.searchParams.set("size", EXPERIENCE_PLACE_THUMBNAIL_SIZE);
  endpoint.searchParams.set("format", "Webp");
  endpoint.searchParams.set("isCircular", "false");

  for (
    let attempt = 0;
    attempt <= THUMBNAIL_PENDING_RETRY_DELAYS_MS.length;
    attempt += 1
  ) {
    const payload = await fetchJson(endpoint, {
      cache: "no-store",
      credentials: "omit"
    });
    const requested = new Set(normalizedIds);
    const thumbnailsById = new Map();
    let hasPending = false;
    for (const rawThumbnail of Array.isArray(payload?.data)
      ? payload.data
      : []) {
      const placeId = normalizeId(rawThumbnail?.targetId);
      if (!placeId || !requested.has(placeId)) continue;
      if (
        rawThumbnail?.state === "Completed" &&
        isSafeThumbnailUrl(rawThumbnail.imageUrl)
      ) {
        thumbnailsById.set(placeId, rawThumbnail.imageUrl);
      } else if (rawThumbnail?.state === "Pending") {
        hasPending = true;
      }
    }
    if (
      !hasPending ||
      attempt >= THUMBNAIL_PENDING_RETRY_DELAYS_MS.length
    ) {
      return normalizedIds
        .filter((placeId) => thumbnailsById.has(placeId))
        .map((placeId) => Object.freeze({
          placeId,
          url: thumbnailsById.get(placeId)
        }));
    }
    await wait(THUMBNAIL_PENDING_RETRY_DELAYS_MS[attempt]);
  }
  return [];
}

function handleExperiencePlaceThumbnailsMessage(message, sendResponse) {
  const requestId = message?.requestId;
  const placeIds = normalizeExperiencePlaceThumbnailIds(message?.placeIds);
  if (
    !Number.isSafeInteger(requestId) ||
    requestId <= 0 ||
    !placeIds
  ) {
    return false;
  }
  fetchExperiencePlaceThumbnails(placeIds)
    .then((thumbnails) => {
      sendResponse({ ok: true, requestId, thumbnails });
    })
    .catch(() => {
      sendResponse({ ok: false, requestId, thumbnails: [] });
    });
  return true;
}

async function fetchExperiencePlacesEligibility(
  placeId,
  universeId,
  rootPlaceId
) {
  if (
    !isValidId(placeId) ||
    !isValidId(universeId) ||
    !isValidId(rootPlaceId)
  ) {
    throw new TypeError("Invalid Experience Places identity");
  }
  const universeEndpoint = new URL(
    `/universes/v1/places/${placeId}/universe`,
    "https://apis.roblox.com"
  );
  const gameEndpoint = new URL("/v1/games", "https://games.roblox.com");
  gameEndpoint.searchParams.set("universeIds", universeId);
  const [universePayload, payload] = await Promise.all([
    fetchJson(universeEndpoint, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      headers: { Accept: "application/json" }
    }),
    fetchJson(gameEndpoint, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      headers: { Accept: "application/json" }
    })
  ]);
  if (normalizeId(universePayload?.universeId) !== universeId) {
    throw new Error("Mismatched Experience Places route Universe");
  }
  if (!Array.isArray(payload?.data) || payload.data.length !== 1) {
    throw new Error("Invalid Experience Places eligibility response");
  }
  const game = payload.data[0];
  if (
    normalizeId(game?.id) !== universeId ||
    normalizeId(game?.rootPlaceId) !== rootPlaceId ||
    typeof game?.isContentRestricted !== "boolean"
  ) {
    throw new Error("Mismatched Experience Places eligibility response");
  }
  return Object.freeze({
    placeId,
    universeId,
    rootPlaceId,
    eligible: game.isContentRestricted === false,
    restricted: game.isContentRestricted === true
  });
}

function handleExperiencePlacesEligibilityMessage(message, sender, sendResponse) {
  if (message?.type !== EXPERIENCE_PLACES_ELIGIBILITY_MESSAGE_TYPE) {
    return false;
  }
  const messageKeys = message && typeof message === "object" && !Array.isArray(message)
    ? Object.keys(message).sort()
    : [];
  const hasExactMessageShape =
    messageKeys.length === 5 &&
    messageKeys[0] === "placeId" &&
    messageKeys[1] === "requestId" &&
    messageKeys[2] === "rootPlaceId" &&
    messageKeys[3] === "type" &&
    messageKeys[4] === "universeId";
  const requestId = normalizeRandomServerRequestId(message?.requestId);
  const placeId = normalizeId(message?.placeId);
  const rootPlaceId = normalizeId(message?.rootPlaceId);
  const universeId = normalizeId(message?.universeId);
  const senderPlaceId = getTrustedNativeEventSchedulePagePlaceId(sender);
  if (
    !hasExactMessageShape ||
    requestId === null ||
    !placeId ||
    !rootPlaceId ||
    !universeId ||
    senderPlaceId !== placeId
  ) {
    sendResponse({
      ok: false,
      requestId: requestId ?? 0,
      code: "INVALID"
    });
    return false;
  }
  fetchExperiencePlacesEligibility(placeId, universeId, rootPlaceId)
    .then((eligibility) => {
      sendResponse({
        ok: true,
        requestId,
        placeId,
        ...eligibility
      });
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        requestId,
        placeId,
        rootPlaceId,
        universeId,
        code: getGameCcuErrorCode(error)
      });
    });
  return true;
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

function getGameCcuHistoryFeatureValue(rawValue) {
  if (
    !rawValue ||
    typeof rawValue !== "object" ||
    rawValue.version !== FEATURE_SETTINGS_VERSION ||
    !rawValue.flags ||
    typeof rawValue.flags !== "object"
  ) {
    return true;
  }
  return rawValue.flags.gameCcuHoverGraph !== false;
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
  gameCcuHistoryFeatureEnabled = getGameCcuHistoryFeatureValue(rawValue);
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
  const requestedUniverseId = typeof message.universeId === "string"
    ? normalizeId(message.universeId)
    : null;
  const placeId = typeof message.placeId === "string"
    ? normalizeId(message.placeId)
    : null;
  if (
    requestId === null ||
    (!requestedUniverseId && !placeId) ||
    (requestedUniverseId && placeId) ||
    getTrustedRobloxTopFrameTabId(sender) === null
  ) {
    sendResponse({
      ok: false,
      requestId: requestId ?? 0,
      universeId: requestedUniverseId,
      code: "INVALID"
    });
    return false;
  }
  Promise.resolve(
    requestedUniverseId || resolveUniverseId(placeId)
  )
    .then((universeId) =>
      getGameCcuHistoryForRequest(universeId, {
        allowChartsSeed: getTrustedRobloxChartsTabId(sender) !== null
      }).then((history) => ({ history, universeId }))
    )
    .then(({ history, universeId }) => {
      sendResponse({
        ok: true,
        requestId,
        universeId,
        ...(placeId ? { placeId } : {}),
        tracked: history.tracked,
        points: history.points
      });
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        requestId,
        universeId: requestedUniverseId,
        ...(placeId ? { placeId } : {}),
        code: error instanceof GameCcuHistoryError
          ? error.code
          : error instanceof ContextCopyError
            ? "ROBLOX_UNAVAILABLE"
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

function getServerHistoryFeatureValue(rawValue) {
  return Boolean(
    rawValue &&
    typeof rawValue === "object" &&
    !Array.isArray(rawValue) &&
    rawValue.version === FEATURE_SETTINGS_VERSION &&
    rawValue.flags &&
    typeof rawValue.flags === "object" &&
    !Array.isArray(rawValue.flags) &&
    rawValue.flags[SERVER_HISTORY_FEATURE_KEY] === true
  );
}

function normalizeServerHistoryRequestId(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function normalizeServerHistoryLocale(value) {
  const locale = typeof value === "string"
    ? value.trim().replace(/_/g, "-")
    : "";
  if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}$/.test(locale)) {
    return SERVER_HISTORY_FALLBACK_LOCALE;
  }
  try {
    return Intl.getCanonicalLocales(locale)[0] || SERVER_HISTORY_FALLBACK_LOCALE;
  } catch {
    return SERVER_HISTORY_FALLBACK_LOCALE;
  }
}

function normalizeServerHistorySessionId(value) {
  if (
    typeof value !== "string" ||
    value !== value.trim() ||
    value.length < 1 ||
    value.length > 128 ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    return null;
  }
  return value;
}

function normalizeServerHistoryTimestamp(value, now = Date.now()) {
  const timestamp = Number(value);
  return Number.isSafeInteger(timestamp) &&
    timestamp > 0 &&
    timestamp <= now + 60_000
    ? timestamp
    : null;
}

function normalizeServerHistoryText(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length <= maxLength &&
    !/[\u0000-\u001f\u007f]/.test(normalized)
    ? normalized
    : "";
}

function normalizeStoredServerHistorySession(rawSession, now = Date.now()) {
  if (!rawSession || typeof rawSession !== "object" || Array.isArray(rawSession)) {
    return null;
  }
  const sessionId = normalizeServerHistorySessionId(rawSession.sessionId);
  const placeId = normalizeId(rawSession.placeId);
  const gameInstanceId = normalizeGameInstanceId(rawSession.gameInstanceId);
  const firstSeenAt = normalizeServerHistoryTimestamp(rawSession.firstSeenAt, now);
  const lastSeenAt = normalizeServerHistoryTimestamp(rawSession.lastSeenAt, now);
  if (
    !sessionId ||
    !placeId ||
    !gameInstanceId ||
    !firstSeenAt ||
    !lastSeenAt ||
    lastSeenAt < firstSeenAt
  ) {
    return null;
  }
  const endedAt = normalizeServerHistoryTimestamp(rawSession.endedAt, now);
  const allowedEndReasons = new Set([
    "left",
    "server-changed",
    "observation-gap",
    "recovered"
  ]);
  const isOpen = rawSession.isOpen === true && !endedAt;
  const observationCount = Number.isSafeInteger(rawSession.observationCount) &&
    rawSession.observationCount > 0
    ? Math.min(rawSession.observationCount, Number.MAX_SAFE_INTEGER)
    : 1;
  return {
    sessionId,
    placeId,
    universeId: normalizeOptionalId(rawSession.universeId),
    rootPlaceId: normalizeOptionalId(rawSession.rootPlaceId),
    gameInstanceId: gameInstanceId.toLowerCase(),
    lastLocation: normalizeServerHistoryText(
      rawSession.lastLocation,
      SERVER_HISTORY_EXPERIENCE_NAME_MAX_LENGTH
    ),
    firstSeenAt,
    lastSeenAt,
    observationCount,
    isOpen,
    endedAt: isOpen ? null : endedAt || lastSeenAt,
    endReason: isOpen
      ? null
      : allowedEndReasons.has(rawSession.endReason)
        ? rawSession.endReason
        : "recovered"
  };
}

function createEmptyServerHistoryAccount() {
  return {
    sessions: [],
    pendingNonGameCount: 0,
    lastCheckedAt: 0,
    trackingState: "waiting",
    updatedAt: 0
  };
}

function normalizeStoredServerHistoryAccount(rawAccount, now = Date.now()) {
  const account = createEmptyServerHistoryAccount();
  if (!rawAccount || typeof rawAccount !== "object" || Array.isArray(rawAccount)) {
    return account;
  }
  const seenSessionIds = new Set();
  const sessions = [];
  for (const rawSession of Array.isArray(rawAccount.sessions)
    ? rawAccount.sessions
    : []) {
    const session = normalizeStoredServerHistorySession(rawSession, now);
    if (!session || seenSessionIds.has(session.sessionId)) {
      continue;
    }
    seenSessionIds.add(session.sessionId);
    sessions.push(session);
  }
  sessions.sort((left, right) =>
    right.firstSeenAt - left.firstSeenAt ||
    right.lastSeenAt - left.lastSeenAt
  );
  let foundOpen = false;
  for (const session of sessions) {
    if (!session.isOpen) {
      continue;
    }
    if (!foundOpen) {
      foundOpen = true;
      continue;
    }
    session.isOpen = false;
    session.endedAt = session.lastSeenAt;
    session.endReason = "recovered";
  }
  account.sessions = sessions.slice(0, SERVER_HISTORY_MAX_SESSIONS);
  account.pendingNonGameCount = rawAccount.pendingNonGameCount === 1 ? 1 : 0;
  account.lastCheckedAt = normalizeServerHistoryTimestamp(
    rawAccount.lastCheckedAt,
    now
  ) || 0;
  account.trackingState = ["in-game", "not-in-game", "waiting", "error"].includes(
    rawAccount.trackingState
  )
    ? rawAccount.trackingState
    : "waiting";
  account.updatedAt = normalizeServerHistoryTimestamp(rawAccount.updatedAt, now) ||
    account.lastCheckedAt ||
    account.sessions[0]?.lastSeenAt ||
    0;
  return account;
}

function createEmptyServerHistoryStorage() {
  return { version: SERVER_HISTORY_STORAGE_VERSION, accounts: {} };
}

function normalizeServerHistoryStorage(rawValue, now = Date.now()) {
  const storage = createEmptyServerHistoryStorage();
  if (
    !rawValue ||
    typeof rawValue !== "object" ||
    Array.isArray(rawValue) ||
    rawValue.version !== SERVER_HISTORY_STORAGE_VERSION ||
    !rawValue.accounts ||
    typeof rawValue.accounts !== "object" ||
    Array.isArray(rawValue.accounts)
  ) {
    return storage;
  }
  const accounts = [];
  for (const [rawViewerUserId, rawAccount] of Object.entries(rawValue.accounts)) {
    const viewerUserId = normalizeId(rawViewerUserId);
    if (!viewerUserId) {
      continue;
    }
    accounts.push([
      viewerUserId,
      normalizeStoredServerHistoryAccount(rawAccount, now)
    ]);
  }
  accounts.sort((left, right) => right[1].updatedAt - left[1].updatedAt);
  for (const [viewerUserId, account] of accounts.slice(
    0,
    SERVER_HISTORY_MAX_ACCOUNTS
  )) {
    storage.accounts[viewerUserId] = account;
  }
  return storage;
}

function getServerHistoryStorageArea() {
  return chrome.storage?.local || null;
}

async function readServerHistoryStorage(now = Date.now()) {
  if (typeof serverHistoryStorageOverride?.read === "function") {
    return normalizeServerHistoryStorage(
      await serverHistoryStorageOverride.read(),
      now
    );
  }
  const storageArea = getServerHistoryStorageArea();
  if (!storageArea?.get) {
    return createEmptyServerHistoryStorage();
  }
  const rawValue = await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (value, error = null) => {
      if (settled) return;
      settled = true;
      error ? reject(error) : resolve(value);
    };
    try {
      const result = storageArea.get(
        { [SERVER_HISTORY_STORAGE_KEY]: null },
        (values) => {
          const readError = chrome.runtime?.lastError;
          if (readError) {
            finish(null, new Error(readError.message));
            return;
          }
          finish(values?.[SERVER_HISTORY_STORAGE_KEY] ?? null);
        }
      );
      if (result?.then) {
        result.then(
          (values) => finish(values?.[SERVER_HISTORY_STORAGE_KEY] ?? null),
          (error) => finish(null, error)
        );
      }
    } catch (error) {
      finish(null, error);
    }
  });
  return normalizeServerHistoryStorage(rawValue, now);
}

async function writeServerHistoryStorage(value) {
  const normalized = normalizeServerHistoryStorage(value);
  if (typeof serverHistoryStorageOverride?.write === "function") {
    await serverHistoryStorageOverride.write(normalized);
    return;
  }
  const storageArea = getServerHistoryStorageArea();
  if (!storageArea?.set) {
    throw new Error("Server History storage is unavailable");
  }
  await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error = null) => {
      if (settled) return;
      settled = true;
      error ? reject(error) : resolve();
    };
    try {
      const result = storageArea.set(
        { [SERVER_HISTORY_STORAGE_KEY]: normalized },
        () => {
          const writeError = chrome.runtime?.lastError;
          finish(writeError ? new Error(writeError.message) : null);
        }
      );
      if (result?.then) {
        result.then(() => finish(), (error) => finish(error));
      }
    } catch (error) {
      finish(error);
    }
  });
}

function createServerHistorySessionId() {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") {
      return globalThis.crypto.randomUUID().toLowerCase();
    }
  } catch {
    // Continue to the opaque random fallback.
  }
  const randomBytes = new Uint8Array(18);
  try {
    globalThis.crypto.getRandomValues(randomBytes);
    return Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    serverHistorySessionIdSequence += 1;
    return `local_${Date.now().toString(36)}_${serverHistorySessionIdSequence.toString(36)}_${Math.random().toString(36).slice(2)}`;
  }
}

function normalizeServerHistoryPresence(rawPresence, viewerUserId = null) {
  if (!rawPresence || typeof rawPresence !== "object" || Array.isArray(rawPresence)) {
    return { kind: "not-in-game" };
  }
  const presenceUserId = normalizeId(rawPresence.userId);
  if (viewerUserId && presenceUserId !== viewerUserId) {
    return { kind: "not-in-game" };
  }
  if (Number(rawPresence.userPresenceType) !== 2) {
    return { kind: "not-in-game" };
  }
  const placeId = normalizeId(rawPresence.placeId);
  const gameInstanceId = normalizeGameInstanceId(rawPresence.gameId);
  if (!placeId || !gameInstanceId) {
    return { kind: "not-in-game" };
  }
  return {
    kind: "in-game",
    placeId,
    universeId: normalizeOptionalId(rawPresence.universeId),
    rootPlaceId: normalizeOptionalId(rawPresence.rootPlaceId),
    gameInstanceId: gameInstanceId.toLowerCase(),
    lastLocation: normalizeServerHistoryText(
      rawPresence.lastLocation,
      SERVER_HISTORY_EXPERIENCE_NAME_MAX_LENGTH
    )
  };
}

function reduceServerHistoryAccount(
  rawAccount,
  rawSample,
  now = Date.now(),
  createSessionId = createServerHistorySessionId
) {
  const account = normalizeStoredServerHistoryAccount(rawAccount, now);
  const sample = rawSample?.kind === "in-game"
    ? normalizeServerHistoryPresence(
        {
          ...rawSample,
          userPresenceType: 2,
          gameId: rawSample.gameInstanceId
        }
      )
    : { kind: "not-in-game" };
  account.lastCheckedAt = now;
  account.updatedAt = now;
  const openSession = account.sessions.find((session) => session.isOpen) || null;

  if (sample.kind !== "in-game") {
    account.trackingState = "not-in-game";
    if (!openSession) {
      account.pendingNonGameCount = 0;
      return account;
    }
    account.pendingNonGameCount = Math.min(2, account.pendingNonGameCount + 1);
    if (openSession && account.pendingNonGameCount >= 2) {
      openSession.isOpen = false;
      openSession.endedAt = now;
      openSession.endReason = "left";
      account.pendingNonGameCount = 0;
    }
    return account;
  }

  account.trackingState = "in-game";
  account.pendingNonGameCount = 0;
  if (openSession) {
    const sameServer = openSession.placeId === sample.placeId &&
      openSession.gameInstanceId === sample.gameInstanceId;
    const continuityGap = now - openSession.lastSeenAt;
    if (
      sameServer &&
      continuityGap >= 0 &&
      continuityGap <= SERVER_HISTORY_CONTINUITY_GAP_MS
    ) {
      openSession.lastSeenAt = now;
      openSession.observationCount = Math.min(
        Number.MAX_SAFE_INTEGER,
        openSession.observationCount + 1
      );
      openSession.universeId = sample.universeId || openSession.universeId;
      openSession.rootPlaceId = sample.rootPlaceId || openSession.rootPlaceId;
      openSession.lastLocation = sample.lastLocation || openSession.lastLocation;
      account.sessions.sort((left, right) => right.firstSeenAt - left.firstSeenAt);
      return account;
    }
    openSession.isOpen = false;
    openSession.endedAt = sameServer ? openSession.lastSeenAt : now;
    openSession.endReason = sameServer ? "observation-gap" : "server-changed";
  }

  account.sessions.unshift({
    sessionId: normalizeServerHistorySessionId(createSessionId()) ||
      createServerHistorySessionId(),
    placeId: sample.placeId,
    universeId: sample.universeId,
    rootPlaceId: sample.rootPlaceId,
    gameInstanceId: sample.gameInstanceId,
    lastLocation: sample.lastLocation,
    firstSeenAt: now,
    lastSeenAt: now,
    observationCount: 1,
    isOpen: true,
    endedAt: null,
    endReason: null
  });
  account.sessions = account.sessions
    .sort((left, right) => right.firstSeenAt - left.firstSeenAt)
    .slice(0, SERVER_HISTORY_MAX_SESSIONS);
  return account;
}

async function fetchServerHistoryPresence(viewerUserId) {
  const payload = await fetchJson("https://presence.roblox.com/v1/presence/users", {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Accept-Language": SERVER_HISTORY_FALLBACK_LOCALE,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ userIds: [Number(viewerUserId)] })
  });
  if (!Array.isArray(payload?.userPresences)) {
    throw new RobloxApiError(502);
  }
  const rawPresence = payload.userPresences.find(
    (entry) => normalizeId(entry?.userId) === viewerUserId
  );
  const presenceType = Number(rawPresence?.userPresenceType);
  if (
    !rawPresence ||
    !Number.isInteger(presenceType) ||
    presenceType < 0 ||
    presenceType > 3
  ) {
    throw new RobloxApiError(502);
  }
  const sample = normalizeServerHistoryPresence(rawPresence, viewerUserId);
  if (presenceType === 2 && sample.kind !== "in-game") {
    throw new RobloxApiError(502);
  }
  return sample;
}

function isServerHistoryLifecycleCurrent(generation) {
  return serverHistoryFeatureReady &&
    serverHistoryFeatureEnabled &&
    generation === serverHistoryLifecycleGeneration;
}

function enqueueServerHistoryPollWrite(viewerUserId, sample, now, generation) {
  const operation = serverHistoryStorageWriteTail
    .catch(() => undefined)
    .then(async () => {
      if (!isServerHistoryLifecycleCurrent(generation)) {
        return false;
      }
      const storage = await readServerHistoryStorage(now);
      if (!isServerHistoryLifecycleCurrent(generation)) {
        return false;
      }
      storage.accounts[viewerUserId] = reduceServerHistoryAccount(
        storage.accounts[viewerUserId],
        sample,
        now
      );
      if (!isServerHistoryLifecycleCurrent(generation)) {
        return false;
      }
      await writeServerHistoryStorage(storage);
      return true;
    });
  serverHistoryStorageWriteTail = operation.catch(() => undefined);
  return operation;
}

async function runServerHistoryPoll(options = {}) {
  if (!serverHistoryFeatureReady || !serverHistoryFeatureEnabled) {
    return { ok: false, errorCode: "disabled" };
  }
  if (serverHistoryPollPromise) {
    return serverHistoryPollPromise;
  }
  const generation = serverHistoryLifecycleGeneration;
  const poll = (async () => {
    try {
      const viewerUserId = normalizeId(options.viewerUserId) ||
        await getAuthenticatedViewerUserId();
      if (!isServerHistoryLifecycleCurrent(generation)) {
        return { ok: false, errorCode: "disabled" };
      }
      const sample = typeof options.fetchPresence === "function"
        ? await options.fetchPresence(viewerUserId)
        : await fetchServerHistoryPresence(viewerUserId);
      if (!isServerHistoryLifecycleCurrent(generation)) {
        return { ok: false, errorCode: "disabled" };
      }
      const now = Number.isSafeInteger(options.now) && options.now > 0
        ? options.now
        : Date.now();
      const stored = await enqueueServerHistoryPollWrite(
        viewerUserId,
        sample,
        now,
        generation
      );
      return stored
        ? { ok: true, viewerUserId, sample }
        : { ok: false, errorCode: "disabled" };
    } catch (error) {
      if (error?.status === 401) {
        authenticatedUserRequest = null;
        return { ok: false, errorCode: "signed-out" };
      }
      return { ok: false, errorCode: "unavailable" };
    }
  })();
  const wrappedPoll = poll.finally(() => {
    if (serverHistoryPollPromise === wrappedPoll) {
      serverHistoryPollPromise = null;
    }
  });
  serverHistoryPollPromise = wrappedPoll;
  return wrappedPoll;
}

function ensureServerHistoryAlarm() {
  if (
    !serverHistoryFeatureReady ||
    !serverHistoryFeatureEnabled ||
    !chrome.alarms?.create
  ) {
    return;
  }
  const generation = serverHistoryLifecycleGeneration;
  const lifecycleStillEnabled = () =>
    serverHistoryFeatureReady &&
    serverHistoryFeatureEnabled &&
    generation === serverHistoryLifecycleGeneration;
  const createAlarm = () => {
    if (!lifecycleStillEnabled()) return;
    chrome.alarms.create(SERVER_HISTORY_ALARM_NAME, {
      periodInMinutes: SERVER_HISTORY_ALARM_PERIOD_MINUTES
    });
  };
  if (!chrome.alarms.get) {
    createAlarm();
    return;
  }
  chrome.alarms.get(SERVER_HISTORY_ALARM_NAME, (alarm) => {
    void chrome.runtime.lastError;
    if (!lifecycleStillEnabled()) return;
    if (!alarm || alarm.periodInMinutes !== SERVER_HISTORY_ALARM_PERIOD_MINUTES) {
      createAlarm();
    }
  });
}

function clearServerHistoryAlarm() {
  chrome.alarms?.clear?.(SERVER_HISTORY_ALARM_NAME, () => {
    void chrome.runtime.lastError;
  });
}

function applyServerHistoryFeatureValue(rawValue, runWhenEnabled = false) {
  const wasEnabled = serverHistoryFeatureEnabled;
  const nextEnabled = getServerHistoryFeatureValue(rawValue);
  serverHistoryFeatureReady = true;
  if (wasEnabled !== nextEnabled) {
    serverHistoryLifecycleGeneration += 1;
  }
  serverHistoryFeatureEnabled = nextEnabled;
  if (!nextEnabled) {
    clearServerHistoryAlarm();
    return;
  }
  ensureServerHistoryAlarm();
  if (runWhenEnabled && (!wasEnabled || runWhenEnabled === "startup")) {
    void runServerHistoryPoll();
  }
}

function syncServerHistoryFeatureFromStorage(runWhenEnabled = false) {
  if (!chrome.storage?.local?.get) {
    applyServerHistoryFeatureValue(null, false);
    return Promise.resolve();
  }
  const sync = new Promise((resolve) => {
    chrome.storage.local.get(
      { [FEATURE_SETTINGS_STORAGE_KEY]: null },
      (result) => {
        void chrome.runtime.lastError;
        applyServerHistoryFeatureValue(
          result?.[FEATURE_SETTINGS_STORAGE_KEY],
          runWhenEnabled
        );
        resolve();
      }
    );
  });
  const trackedSync = sync.finally(() => {
    if (serverHistoryFeatureSyncPromise === trackedSync) {
      serverHistoryFeatureSyncPromise = null;
    }
  });
  serverHistoryFeatureSyncPromise = trackedSync;
  return trackedSync;
}

async function fetchServerHistoryExperienceDetails(
  universeIds,
  locale = SERVER_HISTORY_FALLBACK_LOCALE
) {
  const ids = [...new Set(universeIds.map(normalizeId).filter(Boolean))].slice(
    0,
    SERVER_HISTORY_MAX_SESSIONS
  );
  const details = new Map();
  if (ids.length === 0) {
    return details;
  }
  const endpoint = new URL("/v1/games", "https://games.roblox.com");
  endpoint.searchParams.set("universeIds", ids.join(","));
  const payload = await fetchJson(endpoint, {
    cache: "no-store",
    credentials: "omit",
    headers: {
      Accept: "application/json",
      "Accept-Language": normalizeServerHistoryLocale(locale)
    }
  });
  if (!Array.isArray(payload?.data)) {
    throw new RobloxApiError(502);
  }
  for (const entry of payload.data) {
    const universeId = normalizeId(entry?.id);
    if (!universeId || !ids.includes(universeId)) {
      continue;
    }
    details.set(universeId, {
      experienceName: normalizeServerHistoryText(
        entry?.name,
        SERVER_HISTORY_EXPERIENCE_NAME_MAX_LENGTH
      )
    });
  }
  return details;
}

function sanitizeServerHistorySessionForResponse(session, details = null) {
  const experienceName = details?.experienceName || "Unknown Experience";
  return Object.freeze({
    sessionId: session.sessionId,
    placeId: session.placeId,
    universeId: session.universeId,
    experienceName,
    firstSeenAt: session.firstSeenAt,
    lastSeenAt: session.lastSeenAt
  });
}

async function getServerHistoryResponse(
  requestId,
  locale = SERVER_HISTORY_FALLBACK_LOCALE
) {
  if (!serverHistoryFeatureReady) {
    await (serverHistoryFeatureSyncPromise ||
      syncServerHistoryFeatureFromStorage(false));
  }
  if (!serverHistoryFeatureReady || !serverHistoryFeatureEnabled) {
    return {
      ok: true,
      requestId,
      enabled: false,
      sessions: []
    };
  }
  let viewerUserId;
  try {
    viewerUserId = await getAuthenticatedViewerUserId();
  } catch (error) {
    if (error?.status === 401) authenticatedUserRequest = null;
    return {
      ok: false,
      requestId,
      errorCode: error?.status === 401 ? "signed-out" : "unavailable"
    };
  }
  await runServerHistoryPoll({ viewerUserId });
  let storage;
  try {
    await serverHistoryStorageWriteTail.catch(() => undefined);
    storage = await readServerHistoryStorage();
  } catch {
    return { ok: false, requestId, errorCode: "unavailable" };
  }
  const account = storage.accounts[viewerUserId] || createEmptyServerHistoryAccount();
  let details = new Map();
  try {
    details = await fetchServerHistoryExperienceDetails(
      account.sessions.map((session) => session.universeId).filter(Boolean),
      locale
    );
  } catch {
    // Stored place/timestamp data still makes the local history useful offline.
  }
  return {
    ok: true,
    requestId,
    enabled: true,
    sessions: account.sessions.map((session) =>
      sanitizeServerHistorySessionForResponse(
        session,
        session.universeId ? details.get(session.universeId) : null
      )
    )
  };
}

function handleGetServerHistoryMessage(message, sender, sendResponse) {
  if (message?.type !== SERVER_HISTORY_GET_MESSAGE_TYPE) return false;
  const requestId = normalizeServerHistoryRequestId(message.requestId);
  if (requestId === null || getTrustedRobloxTopFrameTabId(sender) === null) {
    sendResponse({ ok: false, requestId: requestId ?? 0, errorCode: "invalid" });
    return false;
  }
  getServerHistoryResponse(requestId, normalizeServerHistoryLocale(message.locale))
    .then(sendResponse)
    .catch(() => sendResponse({ ok: false, requestId, errorCode: "unavailable" }));
  return true;
}

async function getOwnedServerHistorySession(viewerUserId, sessionId) {
  await serverHistoryStorageWriteTail.catch(() => undefined);
  const storage = await readServerHistoryStorage();
  const account = storage.accounts[viewerUserId];
  const session = account?.sessions.find((entry) => entry.sessionId === sessionId);
  return session || null;
}

async function clearServerHistoryForViewer(viewerUserId) {
  const operation = serverHistoryStorageWriteTail
    .catch(() => undefined)
    .then(async () => {
      const storage = await readServerHistoryStorage();
      const cleared = storage.accounts[viewerUserId]?.sessions.length || 0;
      delete storage.accounts[viewerUserId];
      await writeServerHistoryStorage(storage);
      return cleared;
    });
  serverHistoryStorageWriteTail = operation.catch(() => undefined);
  return operation;
}

function handleClearServerHistoryMessage(message, sender, sendResponse) {
  if (message?.type !== SERVER_HISTORY_CLEAR_MESSAGE_TYPE) return false;
  const requestId = normalizeServerHistoryRequestId(message.requestId);
  const expectedSessionId = normalizeServerHistorySessionId(
    message.expectedSessionId
  );
  if (
    requestId === null ||
    !expectedSessionId ||
    getTrustedRobloxTopFrameTabId(sender) === null
  ) {
    sendResponse({ ok: false, requestId: requestId ?? 0, errorCode: "invalid" });
    return false;
  }
  (async () => {
    const viewerUserId = await getAuthenticatedViewerUserId();
    const expectedSession = await getOwnedServerHistorySession(
      viewerUserId,
      expectedSessionId
    );
    if (!expectedSession) {
      return { ok: false, requestId, errorCode: "account-changed" };
    }
    const cleared = await clearServerHistoryForViewer(viewerUserId);
    return { ok: true, requestId, cleared };
  })().then(sendResponse).catch((error) => {
    if (error?.status === 401) authenticatedUserRequest = null;
    sendResponse({
      ok: false,
      requestId,
      errorCode: error?.status === 401 ? "signed-out" : "unavailable"
    });
  });
  return true;
}

async function executeServerHistoryRejoin(tabId, placeId, gameInstanceId) {
  if (typeof chrome.scripting?.executeScript !== "function") return "unavailable";
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      world: "MAIN",
      args: [Number(placeId), gameInstanceId],
      func: async (numericPlaceId, serverId) => {
        const launcher = globalThis.Roblox?.GameLauncher;
        if (typeof launcher?.joinGameInstance === "function") {
          try {
            const result = Reflect.apply(launcher.joinGameInstance, launcher, [
              numericPlaceId,
              serverId
            ]);
            if (result && typeof result.then === "function") await result;
            return "started";
          } catch {
            return "failed";
          }
        }
        // Deep-link fallbacks are not exact: Roblox can ignore gameInstanceId
        // and route to another server. Fail closed unless its own exact
        // GameLauncher instance API is available.
        return "unavailable";
      }
    });
    const result = Array.isArray(results)
      ? results.find((entry) => entry?.frameId === 0)?.result
      : null;
    return ["started", "unavailable", "failed"].includes(result)
      ? result
      : "failed";
  } catch {
    return "failed";
  }
}

function handleRejoinServerHistoryMessage(message, sender, sendResponse) {
  if (message?.type !== SERVER_HISTORY_REJOIN_MESSAGE_TYPE) return false;
  const requestId = normalizeServerHistoryRequestId(message.requestId);
  const sessionId = normalizeServerHistorySessionId(message.sessionId);
  const tabId = getTrustedRobloxTopFrameTabId(sender);
  if (requestId === null || !sessionId || tabId === null) {
    sendResponse({ ok: false, requestId: requestId ?? 0, errorCode: "invalid" });
    return false;
  }
  (async () => {
    if (!serverHistoryFeatureEnabled) {
      return { ok: false, requestId, sessionId, errorCode: "disabled" };
    }
    const viewerUserId = await getAuthenticatedViewerUserId();
    const session = await getOwnedServerHistorySession(viewerUserId, sessionId);
    if (!session) {
      return { ok: false, requestId, sessionId, errorCode: "not-found" };
    }
    const code = await executeServerHistoryRejoin(
      tabId,
      session.placeId,
      session.gameInstanceId
    );
    return code === "started"
      ? { ok: true, requestId, sessionId }
      : { ok: false, requestId, sessionId, errorCode: code };
  })().then(sendResponse).catch((error) => {
    if (error?.status === 401) authenticatedUserRequest = null;
    sendResponse({
      ok: false,
      requestId,
      sessionId,
      errorCode: error?.status === 401 ? "signed-out" : "unavailable"
    });
  });
  return true;
}

function resetServerHistoryStateForTests() {
  serverHistoryFeatureEnabled = false;
  serverHistoryFeatureReady = false;
  serverHistoryFeatureSyncPromise = null;
  serverHistoryLifecycleGeneration += 1;
  serverHistoryPollPromise = null;
  serverHistoryStorageWriteTail = Promise.resolve();
  serverHistoryStorageOverride = null;
  serverHistorySessionIdSequence = 0;
}

function getGameEventsFeatureValue(rawValue) {
  return !(
    rawValue &&
    typeof rawValue === "object" &&
    !Array.isArray(rawValue) &&
    rawValue.version === FEATURE_SETTINGS_VERSION &&
    rawValue.flags &&
    typeof rawValue.flags === "object" &&
    !Array.isArray(rawValue.flags) &&
    rawValue.flags[GAME_EVENTS_FEATURE_KEY] === false
  );
}

function applyGameEventsFeatureValue(rawValue) {
  gameEventsFeatureEnabled = getGameEventsFeatureValue(rawValue);
  gameEventsFeatureReady = true;
}

function syncGameEventsFeatureFromStorage() {
  if (!chrome.storage?.local?.get) {
    applyGameEventsFeatureValue(null);
    return Promise.resolve();
  }
  const sync = new Promise((resolve) => {
    chrome.storage.local.get(
      { [FEATURE_SETTINGS_STORAGE_KEY]: null },
      (result) => {
        void chrome.runtime.lastError;
        applyGameEventsFeatureValue(result?.[FEATURE_SETTINGS_STORAGE_KEY]);
        resolve();
      }
    );
  });
  const trackedSync = sync.finally(() => {
    if (gameEventsFeatureSyncPromise === trackedSync) {
      gameEventsFeatureSyncPromise = null;
    }
  });
  gameEventsFeatureSyncPromise = trackedSync;
  return trackedSync;
}

async function assertGameEventsFeatureEnabled() {
  if (!gameEventsFeatureReady) {
    await (gameEventsFeatureSyncPromise || syncGameEventsFeatureFromStorage());
  }
  if (!gameEventsFeatureEnabled) {
    throw new GameEventsError("DISABLED");
  }
}

function normalizeGameEventsRequestId(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function normalizeGameEventsLocale(value) {
  const locale = typeof value === "string"
    ? value.trim().replace(/_/g, "-")
    : "";
  if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}$/.test(locale)) {
    return GAME_EVENTS_FALLBACK_LOCALE;
  }
  try {
    return Intl.getCanonicalLocales(locale)[0] || GAME_EVENTS_FALLBACK_LOCALE;
  } catch {
    return GAME_EVENTS_FALLBACK_LOCALE;
  }
}

function normalizeGameEventsText(value, maxLength, required = false) {
  const text = typeof value === "string"
    ? value.replace(/[\s\u0000-\u001f\u007f]+/g, " ").trim().slice(0, maxLength)
    : "";
  return text || (required ? null : "");
}

function normalizeGameEventsAddedAt(value, now = Date.now()) {
  const timestamp = Number(value);
  return Number.isSafeInteger(timestamp) && timestamp > 0 && timestamp <= now
    ? timestamp
    : 0;
}

function normalizeStoredGameEventsGame(rawGame, now = Date.now()) {
  if (!rawGame || typeof rawGame !== "object" || Array.isArray(rawGame)) {
    return null;
  }
  const universeId = normalizeId(rawGame.universeId);
  const placeId = normalizeId(rawGame.placeId);
  const name = normalizeGameEventsText(
    rawGame.name,
    GAME_EVENTS_NAME_MAX_LENGTH,
    true
  );
  const addedAt = normalizeGameEventsAddedAt(rawGame.addedAt, now);
  return universeId && placeId && name && addedAt
    ? { universeId, placeId, name, addedAt }
    : null;
}

function createEmptyGameEventsAccount() {
  return { games: [], updatedAt: 0 };
}

function normalizeStoredGameEventsAccount(rawAccount, now = Date.now()) {
  const account = createEmptyGameEventsAccount();
  if (!rawAccount || typeof rawAccount !== "object" || Array.isArray(rawAccount)) {
    return account;
  }
  const seen = new Set();
  for (const rawGame of Array.isArray(rawAccount.games) ? rawAccount.games : []) {
    const game = normalizeStoredGameEventsGame(rawGame, now);
    if (!game || seen.has(game.universeId)) {
      continue;
    }
    seen.add(game.universeId);
    account.games.push(game);
    if (account.games.length >= GAME_EVENTS_MAX_GAMES_PER_ACCOUNT) {
      break;
    }
  }
  account.updatedAt = normalizeGameEventsAddedAt(rawAccount.updatedAt, now) ||
    Math.max(0, ...account.games.map((game) => game.addedAt));
  return account;
}

function createEmptyGameEventsStorage() {
  return { version: GAME_EVENTS_STORAGE_VERSION, accounts: {} };
}

function normalizeGameEventsStorage(rawValue, now = Date.now()) {
  const storage = createEmptyGameEventsStorage();
  if (
    !rawValue ||
    typeof rawValue !== "object" ||
    Array.isArray(rawValue) ||
    rawValue.version !== GAME_EVENTS_STORAGE_VERSION ||
    !rawValue.accounts ||
    typeof rawValue.accounts !== "object" ||
    Array.isArray(rawValue.accounts)
  ) {
    return storage;
  }
  const accounts = [];
  for (const [rawViewerUserId, rawAccount] of Object.entries(rawValue.accounts)) {
    const viewerUserId = normalizeId(rawViewerUserId);
    if (!viewerUserId) continue;
    accounts.push([
      viewerUserId,
      normalizeStoredGameEventsAccount(rawAccount, now)
    ]);
  }
  accounts.sort((left, right) => right[1].updatedAt - left[1].updatedAt);
  for (const [viewerUserId, account] of accounts.slice(
    0,
    GAME_EVENTS_MAX_ACCOUNTS
  )) {
    storage.accounts[viewerUserId] = account;
  }
  return storage;
}

function getGameEventsStorageArea() {
  return chrome.storage?.local || null;
}

async function readGameEventsStorage(now = Date.now()) {
  if (typeof gameEventsStorageOverride?.read === "function") {
    return normalizeGameEventsStorage(
      await gameEventsStorageOverride.read(),
      now
    );
  }
  const storageArea = getGameEventsStorageArea();
  if (!storageArea?.get) return createEmptyGameEventsStorage();
  const rawValue = await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (value, error = null) => {
      if (settled) return;
      settled = true;
      error ? reject(error) : resolve(value);
    };
    try {
      const result = storageArea.get(
        { [GAME_EVENTS_STORAGE_KEY]: null },
        (values) => {
          const readError = chrome.runtime?.lastError;
          finish(
            values?.[GAME_EVENTS_STORAGE_KEY] ?? null,
            readError ? new Error(readError.message) : null
          );
        }
      );
      if (result?.then) {
        result.then(
          (values) => finish(values?.[GAME_EVENTS_STORAGE_KEY] ?? null),
          (error) => finish(null, error)
        );
      }
    } catch (error) {
      finish(null, error);
    }
  });
  return normalizeGameEventsStorage(rawValue, now);
}

async function writeGameEventsStorage(value) {
  const normalized = normalizeGameEventsStorage(value);
  if (typeof gameEventsStorageOverride?.write === "function") {
    await gameEventsStorageOverride.write(normalized);
    return;
  }
  const storageArea = getGameEventsStorageArea();
  if (!storageArea?.set) throw new Error("Game Events storage is unavailable");
  await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error = null) => {
      if (settled) return;
      settled = true;
      error ? reject(error) : resolve();
    };
    try {
      const result = storageArea.set(
        { [GAME_EVENTS_STORAGE_KEY]: normalized },
        () => {
          const writeError = chrome.runtime?.lastError;
          finish(writeError ? new Error(writeError.message) : null);
        }
      );
      if (result?.then) result.then(() => finish(), (error) => finish(error));
    } catch (error) {
      finish(error);
    }
  });
}

function normalizeGameEventId(value) {
  const id = typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
  return /^(?:\d{1,40}|[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(id)
    ? id.toLowerCase()
    : null;
}

function parseGameEventsUtcTimestamp(value) {
  const timestamp = typeof value === "string" ? value.trim() : "";
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|([+-])(\d{2}):(\d{2}))$/i.exec(
    timestamp
  );
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[8] ? Number(match[8]) : 0;
  const offsetMinute = match[9] ? Number(match[9]) : 0;
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > new Date(Date.UTC(year, month, 0)).getUTCDate() ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return null;
  }
  const milliseconds = Date.parse(timestamp);
  return Number.isSafeInteger(milliseconds) ? milliseconds : null;
}

function getGameEventMediaId(rawEvent) {
  const thumbnails = Array.isArray(rawEvent?.thumbnails)
    ? rawEvent.thumbnails
    : [];
  const candidates = thumbnails
    .map((thumbnail, index) => ({
      mediaId: normalizeId(thumbnail?.mediaId),
      rank: Number.isSafeInteger(thumbnail?.rank) ? thumbnail.rank : index
    }))
    .filter((thumbnail) => thumbnail.mediaId)
    .sort((left, right) => left.rank - right.rank);
  return candidates[0]?.mediaId || null;
}

function normalizeGameEvent(rawEvent, universeId, now = Date.now()) {
  if (!rawEvent || typeof rawEvent !== "object" || Array.isArray(rawEvent)) {
    return null;
  }
  const id = normalizeGameEventId(rawEvent.id);
  const returnedUniverseId = normalizeId(rawEvent.universeId);
  const placeId = normalizeId(rawEvent.placeId);
  const title = normalizeGameEventsText(
    rawEvent.title,
    GAME_EVENTS_TITLE_MAX_LENGTH,
    true
  );
  const subtitle = normalizeGameEventsText(
    rawEvent.subtitle,
    GAME_EVENTS_SUBTITLE_MAX_LENGTH
  );
  const startAt = parseGameEventsUtcTimestamp(rawEvent.eventTime?.startUtc);
  const endAt = parseGameEventsUtcTimestamp(rawEvent.eventTime?.endUtc);
  const eventStatus = String(rawEvent.eventStatus || "").trim().toLowerCase();
  const rejectedStatuses = new Set([
    "cancelled",
    "canceled",
    "moderated",
    "deleted",
    "unpublished",
    "inactive"
  ]);
  if (
    !id ||
    returnedUniverseId !== universeId ||
    !placeId ||
    !title ||
    String(rawEvent.eventVisibility || "").trim().toLowerCase() !== "public" ||
    rejectedStatuses.has(eventStatus) ||
    startAt === null ||
    endAt === null ||
    endAt <= startAt ||
    endAt <= now
  ) {
    return null;
  }
  return Object.freeze({
    id,
    universeId,
    placeId,
    title,
    subtitle,
    startUtc: new Date(startAt).toISOString(),
    endUtc: new Date(endAt).toISOString(),
    startAt,
    endAt,
    status: startAt <= now ? "live" : "upcoming",
    eventUrl: `https://www.roblox.com/events/${encodeURIComponent(id)}`,
    mediaId: getGameEventMediaId(rawEvent)
  });
}

function normalizeGameEventsPayload(payload, universeId, now = Date.now()) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.data)) {
    throw new GameEventsError("ROBLOX_UNAVAILABLE", 502);
  }
  const seen = new Set();
  const events = [];
  for (const rawEvent of payload.data) {
    const event = normalizeGameEvent(rawEvent, universeId, now);
    if (!event || seen.has(event.id)) continue;
    seen.add(event.id);
    events.push(event);
  }
  events.sort((left, right) =>
    (left.status === right.status ? 0 : left.status === "live" ? -1 : 1) ||
    left.startAt - right.startAt ||
    left.id.localeCompare(right.id)
  );
  return events.slice(0, GAME_EVENTS_MAX_EVENTS_PER_GAME);
}

function getCurrentGameEvents(events, now = Date.now()) {
  return events
    .filter((event) => event.endAt > now)
    .map((event) => Object.freeze({
      ...event,
      status: event.startAt <= now ? "live" : "upcoming"
    }))
    .sort((left, right) =>
      (left.status === right.status ? 0 : left.status === "live" ? -1 : 1) ||
      left.startAt - right.startAt ||
      left.id.localeCompare(right.id)
    )
    .slice(0, GAME_EVENTS_MAX_EVENTS_PER_GAME);
}

function setGameEventsCache(universeId, events, fetchedAt = Date.now()) {
  gameEventsCache.delete(universeId);
  gameEventsCache.set(universeId, {
    events,
    fetchedAt,
    expiresAt: fetchedAt + GAME_EVENTS_CACHE_TTL_MS
  });
  while (gameEventsCache.size > GAME_EVENTS_CACHE_MAX_ENTRIES) {
    gameEventsCache.delete(gameEventsCache.keys().next().value);
  }
}

async function fetchGameEventsForUniverse(
  universeId,
  locale = GAME_EVENTS_FALLBACK_LOCALE,
  now = Date.now()
) {
  const endpoint = new URL(
    `/virtual-events/v1/universes/${universeId}/virtual-events`,
    "https://apis.roblox.com"
  );
  const payload = await fetchJson(endpoint, {
    method: "GET",
    cache: "no-store",
    credentials: "omit",
    headers: {
      Accept: "application/json",
      "Accept-Language": normalizeGameEventsLocale(locale)
    }
  });
  return normalizeGameEventsPayload(payload, universeId, now);
}

function getGameEventsErrorCode(error) {
  if (typeof error?.code === "string" && error.code) return error.code;
  if (error?.status === 400) return "INVALID";
  if (error?.status === 401) return "UNAUTHENTICATED";
  if (error?.status === 404) return "NOT_FOUND";
  if (error?.status === 429) return "RATE_LIMITED";
  if (typeof error?.status === "number" && error.status >= 500) {
    return "ROBLOX_UNAVAILABLE";
  }
  if (error?.name === "AbortError" || error instanceof TypeError) return "NETWORK";
  return "ROBLOX_UNAVAILABLE";
}

async function getGameEventsForUniverse(
  rawUniverseId,
  options = {}
) {
  const universeId = normalizeId(rawUniverseId);
  if (!universeId) throw new GameEventsError("INVALID", 400);
  const now = Number.isSafeInteger(options.now) ? options.now : Date.now();
  const cached = gameEventsCache.get(universeId) || null;
  let request = gameEventsRequests.get(universeId);
  if (!request && !options.forceRefresh && cached && cached.expiresAt > now) {
    gameEventsCache.delete(universeId);
    gameEventsCache.set(universeId, cached);
    return {
      events: getCurrentGameEvents(cached.events, now),
      fetchedAt: cached.fetchedAt,
      stale: false,
      failureCode: null,
      usedCachedData: true
    };
  }
  if (!request) {
    request = fetchGameEventsForUniverse(universeId, options.locale, now)
      .then((events) => {
        setGameEventsCache(universeId, events, Date.now());
        return events;
      })
      .finally(() => {
        if (gameEventsRequests.get(universeId) === request) {
          gameEventsRequests.delete(universeId);
        }
      });
    gameEventsRequests.set(universeId, request);
  }
  try {
    const events = await request;
    const fresh = gameEventsCache.get(universeId);
    return {
      events: getCurrentGameEvents(events, now),
      fetchedAt: fresh?.fetchedAt || now,
      stale: false,
      failureCode: null,
      usedCachedData: false
    };
  } catch (error) {
    if (!cached) throw error;
    return {
      events: getCurrentGameEvents(cached.events, now),
      fetchedAt: cached.fetchedAt,
      stale: true,
      failureCode: getGameEventsErrorCode(error),
      usedCachedData: true
    };
  }
}

function normalizeGameEventsInput(value) {
  const input = typeof value === "string" ? value.trim() : "";
  return input && input.length <= FRIEND_FILTER_INPUT_MAX_LENGTH ? input : null;
}

function fetchGameEventsGameDetails(
  rawUniverseId,
  locale = GAME_EVENTS_FALLBACK_LOCALE,
  fallbackPlaceId = null
) {
  const universeId = normalizeId(rawUniverseId);
  if (!universeId) return Promise.reject(new GameEventsError("INVALID", 400));
  const canonicalLocale = normalizeGameEventsLocale(locale);
  return getCachedLookup(
    gameEventsGameResolutionCache,
    `universe:${canonicalLocale}:${universeId}`,
    async () => {
      const endpoint = new URL("/v1/games", "https://games.roblox.com");
      endpoint.searchParams.set("universeIds", universeId);
      const payload = await fetchJson(endpoint, {
        cache: "no-store",
        credentials: "omit",
        headers: {
          Accept: "application/json",
          "Accept-Language": canonicalLocale
        }
      });
      const game = Array.isArray(payload?.data)
        ? payload.data.find((entry) => normalizeId(entry?.id) === universeId)
        : null;
      const rootPlaceId = normalizeId(game?.rootPlaceId);
      const name = normalizeGameEventsText(
        game?.name,
        GAME_EVENTS_NAME_MAX_LENGTH,
        true
      );
      if (!game || !rootPlaceId || !name) {
        throw new GameEventsError("NOT_FOUND", 404);
      }
      return Object.freeze({ universeId, placeId: rootPlaceId, name });
    }
  ).then((game) => {
    const requestedPlaceId = normalizeId(fallbackPlaceId);
    return requestedPlaceId ? { ...game, placeId: requestedPlaceId } : game;
  });
}

function searchGameEventsGameByName(
  rawName,
  locale = GAME_EVENTS_FALLBACK_LOCALE
) {
  const query = normalizeGameEventsInput(rawName);
  if (!query) return Promise.reject(new GameEventsError("INVALID", 400));
  const canonicalLocale = normalizeGameEventsLocale(locale);
  const normalizedQuery = normalizeFriendFilterGameName(query);
  return getCachedLookup(
    gameEventsGameResolutionCache,
    `search:${canonicalLocale}:${normalizedQuery}`,
    async () => {
      const endpoint = new URL("/search-api/omni-search", "https://apis.roblox.com");
      endpoint.searchParams.set("searchQuery", query);
      endpoint.searchParams.set("sessionId", makeFriendFilterGameSearchSessionId());
      endpoint.searchParams.set("pageType", "all");
      const payload = await fetchJson(endpoint, {
        cache: "no-store",
        credentials: "omit",
        headers: {
          Accept: "application/json",
          "Accept-Language": canonicalLocale
        }
      });
      const candidates = getFriendFilterGameSearchCandidates(payload);
      const selected = candidates.find((candidate) =>
        normalizeFriendFilterGameName(candidate.name) === normalizedQuery
      ) || candidates[0];
      if (!selected) throw new GameEventsError("NOT_FOUND", 404);
      return fetchGameEventsGameDetails(selected.universeId, canonicalLocale);
    }
  );
}

function normalizeGameEventsSearchQuery(value) {
  if (typeof value !== "string") return null;
  const rawQuery = value.replace(/[\s\u0000-\u001f\u007f]+/g, " ").trim();
  if (rawQuery.length > GAME_EVENTS_SEARCH_QUERY_MAX_LENGTH) return null;
  const query = rawQuery;
  return query && query.length >= 2 ? query : null;
}

function normalizeGameEventsSearchResults(payload) {
  const groups = Array.isArray(payload?.searchResults)
    ? payload.searchResults
    : [];
  const results = [];
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
      const name = normalizeGameEventsText(
        content?.name,
        GAME_EVENTS_NAME_MAX_LENGTH,
        true
      );
      if (!universeId || !name || seenUniverseIds.has(universeId)) continue;
      seenUniverseIds.add(universeId);
      const playerCount = content?.playerCount;
      results.push(Object.freeze({
        universeId,
        placeId: normalizeId(content?.rootPlaceId),
        name,
        creatorName: normalizeGameEventsText(content?.creatorName, 100),
        playerCount: Number.isSafeInteger(playerCount) && playerCount >= 0
          ? playerCount
          : null
      }));
      if (results.length >= GAME_EVENTS_MAX_SEARCH_RESULTS) {
        return Object.freeze(results);
      }
    }
  }
  return Object.freeze(results);
}

function searchGameEventsGames(
  rawQuery,
  locale = GAME_EVENTS_FALLBACK_LOCALE
) {
  const query = normalizeGameEventsSearchQuery(rawQuery);
  if (!query) return Promise.reject(new GameEventsError("INVALID", 400));
  const canonicalLocale = normalizeGameEventsLocale(locale);
  const normalizedQuery = normalizeFriendFilterGameName(query);
  const request = getCachedLookup(
    gameEventsSearchCache,
    `suggest:${canonicalLocale}:${normalizedQuery}`,
    async () => {
      const endpoint = new URL("/search-api/omni-search", "https://apis.roblox.com");
      endpoint.searchParams.set("searchQuery", query);
      endpoint.searchParams.set("sessionId", makeFriendFilterGameSearchSessionId());
      endpoint.searchParams.set("pageType", "all");
      const payload = await fetchJson(endpoint, {
        cache: "no-store",
        credentials: "omit",
        headers: {
          Accept: "application/json",
          "Accept-Language": canonicalLocale
        }
      });
      return normalizeGameEventsSearchResults(payload);
    }
  );
  while (gameEventsSearchCache.size > GAME_EVENTS_SEARCH_CACHE_MAX_ENTRIES) {
    gameEventsSearchCache.delete(gameEventsSearchCache.keys().next().value);
  }
  return request;
}

async function getGameEventsSearchResponse(message) {
  await assertGameEventsFeatureEnabled();
  const viewerUserId = await getVerifiedGameEventsViewerUserId(message);
  const query = normalizeGameEventsSearchQuery(message?.query);
  if (!query) throw new GameEventsError("INVALID", 400);
  const results = await searchGameEventsGames(query, message?.locale);
  await assertGameEventsFeatureEnabled();
  await assertCurrentGameEventsViewer(viewerUserId);
  return {
    ok: true,
    requestId: message.requestId,
    enabled: true,
    viewerUserId,
    query,
    results
  };
}

function resolveGameEventsUniverseIdFromPlace(rawPlaceId) {
  const placeId = normalizeId(rawPlaceId);
  if (!placeId) return Promise.reject(new GameEventsError("INVALID", 400));
  return getCachedLookup(
    gameEventsGameResolutionCache,
    `place:${placeId}`,
    async () => {
      const endpoint = new URL(
        `/universes/v1/places/${placeId}/universe`,
        "https://apis.roblox.com"
      );
      const payload = await fetchJson(endpoint, {
        cache: "no-store",
        credentials: "omit",
        headers: { Accept: "application/json" }
      });
      const universeId = normalizeId(payload?.universeId);
      if (!universeId) throw new GameEventsError("NOT_FOUND", 404);
      return universeId;
    }
  );
}

async function resolveGameEventsGame(
  rawInput,
  rawUniverseId = null,
  locale = GAME_EVENTS_FALLBACK_LOCALE
) {
  const explicitUniverseId = normalizeId(rawUniverseId);
  if (explicitUniverseId) {
    return fetchGameEventsGameDetails(explicitUniverseId, locale);
  }
  const input = normalizeGameEventsInput(rawInput);
  if (!input) throw new GameEventsError("INVALID", 400);
  let placeId = normalizeId(input);
  let universeId = null;
  const looksLikeUrl = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(input);
  if (!placeId && /^https:\/\//i.test(input)) {
    const context = parseRobloxContextUrl(input);
    placeId = normalizeId(context?.placeId);
    universeId = normalizeId(context?.universeId);
  }
  if (universeId) return fetchGameEventsGameDetails(universeId, locale, placeId);
  if (!placeId) {
    if (looksLikeUrl) throw new GameEventsError("INVALID", 400);
    return searchGameEventsGameByName(input, locale);
  }
  try {
    universeId = await resolveGameEventsUniverseIdFromPlace(placeId);
    return fetchGameEventsGameDetails(universeId, locale, placeId);
  } catch (error) {
    if (getGameEventsErrorCode(error) === "NOT_FOUND") {
      return fetchGameEventsGameDetails(placeId, locale);
    }
    throw new GameEventsError(
      getGameEventsErrorCode(error),
      error?.status || 0,
      error?.retryAfterMs || 0
    );
  }
}

function getExpectedGameEventsViewerUserId(message) {
  if (
    message?.viewerUserId === undefined ||
    message?.viewerUserId === null ||
    message?.viewerUserId === ""
  ) {
    return null;
  }
  const viewerUserId = normalizeId(message.viewerUserId);
  if (!viewerUserId) throw new GameEventsError("INVALID", 400);
  return viewerUserId;
}

async function getVerifiedGameEventsViewerUserId(message) {
  const expectedViewerUserId = getExpectedGameEventsViewerUserId(message);
  const viewerUserId = await getAuthenticatedViewerUserId();
  if (expectedViewerUserId && expectedViewerUserId !== viewerUserId) {
    throw new GameEventsError("ACCOUNT_CHANGED", 409, 0, viewerUserId);
  }
  return viewerUserId;
}

async function fetchFreshGameEventsViewerUserId() {
  const authenticatedUser = await fetchJson(
    "https://users.roblox.com/v1/users/authenticated",
    {
      cache: "no-store",
      credentials: "include",
      headers: { Accept: "application/json" }
    }
  );
  const viewerUserId = normalizeId(authenticatedUser?.id);
  if (!viewerUserId) throw new GameEventsError("UNAUTHENTICATED", 401);
  return viewerUserId;
}

async function assertCurrentGameEventsViewer(viewerUserId) {
  await assertGameEventsFeatureEnabled();
  const currentViewerUserId = await fetchFreshGameEventsViewerUserId();
  if (currentViewerUserId !== viewerUserId) {
    throw new GameEventsError(
      "ACCOUNT_CHANGED",
      409,
      0,
      currentViewerUserId
    );
  }
  return currentViewerUserId;
}

async function getGameEventsResponse(message) {
  await assertGameEventsFeatureEnabled();
  const viewerUserId = await getVerifiedGameEventsViewerUserId(message);
  await gameEventsStorageWriteTail.catch(() => undefined);
  const storage = await readGameEventsStorage();
  const games = storage.accounts[viewerUserId]?.games || [];
  const results = new Array(games.length);
  await runWithConcurrency(games, GAME_EVENTS_FETCH_CONCURRENCY, async (game, index) => {
    try {
      results[index] = await getGameEventsForUniverse(game.universeId, {
        locale: normalizeGameEventsLocale(message.locale),
        forceRefresh: message.forceRefresh === true
      });
    } catch (error) {
      results[index] = {
        events: [],
        fetchedAt: 0,
        stale: true,
        failureCode: getGameEventsErrorCode(error),
        usedCachedData: false
      };
    }
  });
  const failures = [];
  const events = [];
  results.forEach((result, index) => {
    const game = games[index];
    if (result.failureCode) {
      failures.push({
        universeId: game.universeId,
        code: result.failureCode,
        usedCachedData: result.usedCachedData === true
      });
    }
    for (const event of result.events) {
      events.push({ ...event, gameName: game.name });
    }
  });
  events.sort((left, right) =>
    (left.status === right.status ? 0 : left.status === "live" ? -1 : 1) ||
    left.startAt - right.startAt ||
    left.gameName.localeCompare(right.gameName) ||
    left.id.localeCompare(right.id)
  );
  await assertCurrentGameEventsViewer(viewerUserId);
  return {
    ok: true,
    requestId: message.requestId,
    enabled: true,
    viewerUserId,
    games,
    events,
    partial: failures.length > 0,
    failures
  };
}

async function addGameEventFavorite(message) {
  await assertGameEventsFeatureEnabled();
  const viewerUserId = await getVerifiedGameEventsViewerUserId(message);
  const locale = normalizeGameEventsLocale(message.locale);
  const game = await resolveGameEventsGame(
    message.input ?? message.game ?? message.value ?? message.placeId ?? "",
    message.universeId,
    locale
  );
  const operation = gameEventsStorageWriteTail
    .catch(() => undefined)
    .then(async () => {
      await assertGameEventsFeatureEnabled();
      const now = Date.now();
      const storage = await readGameEventsStorage(now);
      const account = storage.accounts[viewerUserId] || createEmptyGameEventsAccount();
      const existing = account.games.find((entry) =>
        entry.universeId === game.universeId
      );
      if (existing) {
        const changed = existing.name !== game.name || existing.placeId !== game.placeId;
        existing.name = game.name;
        existing.placeId = game.placeId;
        if (changed) {
          account.updatedAt = now;
          storage.accounts[viewerUserId] = account;
          await assertCurrentGameEventsViewer(viewerUserId);
          await writeGameEventsStorage(storage);
        }
        return { game: { ...existing }, alreadyTracked: true };
      }
      if (account.games.length >= GAME_EVENTS_MAX_GAMES_PER_ACCOUNT) {
        await assertCurrentGameEventsViewer(viewerUserId);
        throw new GameEventsError("LIMIT_REACHED", 400);
      }
      const storedGame = { ...game, addedAt: now };
      account.games.push(storedGame);
      account.updatedAt = now;
      storage.accounts[viewerUserId] = account;
      await assertCurrentGameEventsViewer(viewerUserId);
      await writeGameEventsStorage(storage);
      return { game: storedGame, alreadyTracked: false };
    });
  gameEventsStorageWriteTail = operation.catch(() => undefined);
  const result = await operation;
  await assertCurrentGameEventsViewer(viewerUserId);
  return {
    ok: true,
    requestId: message.requestId,
    enabled: true,
    viewerUserId,
    game: result.game,
    alreadyTracked: result.alreadyTracked
  };
}

async function removeGameEventFavorite(message) {
  await assertGameEventsFeatureEnabled();
  const universeId = normalizeId(message.universeId);
  if (!universeId) throw new GameEventsError("INVALID", 400);
  const viewerUserId = await getVerifiedGameEventsViewerUserId(message);
  const operation = gameEventsStorageWriteTail
    .catch(() => undefined)
    .then(async () => {
      await assertGameEventsFeatureEnabled();
      const storage = await readGameEventsStorage();
      const account = storage.accounts[viewerUserId];
      if (!account) return false;
      const nextGames = account.games.filter((game) => game.universeId !== universeId);
      if (nextGames.length === account.games.length) return false;
      if (nextGames.length === 0) {
        delete storage.accounts[viewerUserId];
      } else {
        account.games = nextGames;
        account.updatedAt = Date.now();
      }
      await assertCurrentGameEventsViewer(viewerUserId);
      await writeGameEventsStorage(storage);
      return true;
    });
  gameEventsStorageWriteTail = operation.catch(() => undefined);
  const removed = await operation;
  await assertCurrentGameEventsViewer(viewerUserId);
  return {
    ok: true,
    requestId: message.requestId,
    enabled: true,
    viewerUserId,
    universeId,
    removed
  };
}

function sendGameEventsErrorResponse(message, error, sendResponse) {
  const code = getGameEventsErrorCode(error);
  if (["UNAUTHENTICATED", "ACCOUNT_CHANGED"].includes(code)) {
    authenticatedUserRequest = null;
  }
  sendResponse({
    ok: false,
    requestId: normalizeGameEventsRequestId(message?.requestId) || 0,
    enabled: code === "DISABLED" ? false : gameEventsFeatureEnabled,
    code,
    viewerUserId: normalizeId(error?.viewerUserId),
    retryAfterMs: Math.max(0, Number(error?.retryAfterMs) || 0)
  });
}

function handleGameEventsMessage(message, sender, sendResponse) {
  const operationByType = new Map([
    [GAME_EVENTS_GET_MESSAGE_TYPE, getGameEventsResponse],
    [GAME_EVENTS_ADD_MESSAGE_TYPE, addGameEventFavorite],
    [GAME_EVENTS_REMOVE_MESSAGE_TYPE, removeGameEventFavorite],
    [GAME_EVENTS_SEARCH_MESSAGE_TYPE, getGameEventsSearchResponse]
  ]);
  const operation = operationByType.get(message?.type);
  if (!operation) return false;
  const requestId = normalizeGameEventsRequestId(message.requestId);
  if (requestId === null || getTrustedRobloxTopFrameTabId(sender) === null) {
    sendResponse({
      ok: false,
      requestId: requestId || 0,
      enabled: gameEventsFeatureEnabled,
      code: "INVALID"
    });
    return false;
  }
  operation({ ...message, requestId })
    .then(sendResponse)
    .catch((error) => sendGameEventsErrorResponse(message, error, sendResponse));
  return true;
}

function parseNativeEventScheduleGamePagePlaceId(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "www.roblox.com" ||
      url.port !== "" ||
      url.username !== "" ||
      url.password !== ""
    ) {
      return null;
    }
    const segments = url.pathname.split("/").slice(1);
    if (segments.at(-1) === "") segments.pop();
    if (NATIVE_EVENT_SCHEDULE_LOCALE_SEGMENTS.has(segments[0]?.toLowerCase())) {
      segments.shift();
    }
    if (
      segments.length < 2 ||
      segments.length > 3 ||
      segments[0] !== "games" ||
      (segments.length === 3 && !segments[2])
    ) {
      return null;
    }
    return normalizeId(segments[1]);
  } catch {
    return null;
  }
}

function getTrustedNativeEventSchedulePagePlaceId(sender) {
  if (
    sender?.id !== chrome.runtime.id ||
    sender?.tab?.incognito === true ||
    getTrustedRobloxTopFrameTabId(sender) === null ||
    typeof sender?.tab?.url !== "string" ||
    typeof sender?.url !== "string"
  ) {
    return null;
  }
  const tabPlaceId = parseNativeEventScheduleGamePagePlaceId(sender.tab.url);
  const framePlaceId = parseNativeEventScheduleGamePagePlaceId(sender.url);
  return tabPlaceId && framePlaceId === tabPlaceId ? tabPlaceId : null;
}

function normalizeNativeEventScheduleEventIds(rawValue) {
  if (
    !Array.isArray(rawValue) ||
    rawValue.length === 0 ||
    rawValue.length > NATIVE_EVENT_SCHEDULE_MAX_EVENT_IDS
  ) {
    return null;
  }
  const ids = [];
  const seen = new Set();
  for (const rawId of rawValue) {
    const id = normalizeGameEventId(rawId);
    if (!id || seen.has(id)) return null;
    seen.add(id);
    ids.push(id);
  }
  return Object.freeze(ids);
}

function normalizeNativeEventScheduleMatches(
  payload,
  rawUniverseId,
  rawEventIds,
  rawGameName,
  now = Date.now()
) {
  const universeId = normalizeId(rawUniverseId);
  const eventIds = normalizeNativeEventScheduleEventIds(rawEventIds);
  const gameName = normalizeGameEventsText(
    rawGameName,
    GAME_EVENTS_NAME_MAX_LENGTH,
    true
  );
  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray(payload.data) ||
    !universeId ||
    !eventIds ||
    !gameName
  ) {
    throw new GameEventsError("ROBLOX_UNAVAILABLE", 502);
  }
  const wanted = new Set(eventIds);
  const matches = [];
  const seen = new Set();
  for (const rawEvent of payload.data) {
    const event = normalizeGameEvent(rawEvent, universeId, now);
    if (
      !event ||
      event.status !== "upcoming" ||
      event.startAt <= now ||
      !wanted.has(event.id) ||
      seen.has(event.id)
    ) {
      continue;
    }
    seen.add(event.id);
    matches.push(Object.freeze({
      id: event.id,
      universeId: event.universeId,
      placeId: event.placeId,
      gameName,
      title: event.title,
      startAt: event.startAt,
      endAt: event.endAt,
      status: "upcoming"
    }));
  }
  matches.sort((left, right) =>
    left.startAt - right.startAt || left.id.localeCompare(right.id)
  );
  return Object.freeze(matches);
}

async function getNativeEventScheduleData(message) {
  await assertJoinSchedulerFeatureEnabled(true);
  const placeId = normalizeId(message?.placeId);
  const eventIds = normalizeNativeEventScheduleEventIds(message?.eventIds);
  if (!placeId || !eventIds) {
    throw new JoinSchedulerError("INVALID", 400);
  }
  const locale = normalizeGameEventsLocale(message?.locale);
  const universeId = await resolveGameEventsUniverseIdFromPlace(placeId);
  const endpoint = new URL(
    `/virtual-events/v1/universes/${universeId}/virtual-events`,
    "https://apis.roblox.com"
  );
  const [game, payload] = await Promise.all([
    fetchGameEventsGameDetails(universeId, locale, placeId),
    fetchJson(endpoint, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      headers: {
        Accept: "application/json",
        "Accept-Language": locale
      }
    })
  ]);
  const checkedAt = Date.now();
  const events = normalizeNativeEventScheduleMatches(
    payload,
    universeId,
    eventIds,
    game.name,
    checkedAt
  );
  await assertJoinSchedulerFeatureEnabled(true);
  return {
    ok: true,
    requestId: message.requestId,
    enabled: true,
    placeId,
    universeId,
    checkedAt,
    events
  };
}

function getNativeEventScheduleErrorCode(error) {
  if (error?.code === "DISABLED") return "DISABLED";
  if (error?.code === "INVALID" || error?.status === 400) return "INVALID";
  return getGameEventsErrorCode(error);
}

function handleNativeEventScheduleDataMessage(message, sender, sendResponse) {
  if (message?.type !== NATIVE_EVENT_SCHEDULE_DATA_MESSAGE_TYPE) return false;
  const messageKeys = message && typeof message === "object" && !Array.isArray(message)
    ? Object.keys(message).sort()
    : [];
  const hasExactMessageShape =
    messageKeys.length === 5 &&
    messageKeys[0] === "eventIds" &&
    messageKeys[1] === "locale" &&
    messageKeys[2] === "placeId" &&
    messageKeys[3] === "requestId" &&
    messageKeys[4] === "type";
  const requestId = normalizeJoinSchedulerRequestId(message?.requestId);
  const messagePlaceId = normalizeId(message?.placeId);
  const senderPlaceId = getTrustedNativeEventSchedulePagePlaceId(sender);
  const eventIds = normalizeNativeEventScheduleEventIds(message?.eventIds);
  if (
    !hasExactMessageShape ||
    requestId === null ||
    !messagePlaceId ||
    senderPlaceId !== messagePlaceId ||
    !eventIds
  ) {
    sendResponse({
      ok: false,
      requestId: requestId || 0,
      enabled: joinSchedulerFeatureEnabled,
      code: "INVALID"
    });
    return false;
  }
  getNativeEventScheduleData({
    ...message,
    requestId,
    placeId: messagePlaceId,
    eventIds
  })
    .then(sendResponse)
    .catch((error) => {
      const code = getNativeEventScheduleErrorCode(error);
      sendResponse({
        ok: false,
        requestId,
        enabled: code === "DISABLED" ? false : joinSchedulerFeatureEnabled,
        code,
        placeId: messagePlaceId
      });
    });
  return true;
}

function resetGameEventsStateForTests() {
  gameEventsFeatureEnabled = true;
  gameEventsFeatureReady = true;
  gameEventsFeatureSyncPromise = null;
  gameEventsStorageWriteTail = Promise.resolve();
  gameEventsStorageOverride = null;
  gameEventsCache.clear();
  gameEventsRequests.clear();
  gameEventsGameResolutionCache.clear();
  gameEventsSearchCache.clear();
}

function joinSchedulerNow() {
  const overridden = joinSchedulerRuntimeOverrides?.now;
  return typeof overridden === "function" ? overridden() : Date.now();
}

function runJoinSchedulerBrowserApi(operation) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      callback(value);
    };
    const timeoutId = setTimeout(() => {
      finish(reject, new JoinSchedulerError("UNAVAILABLE"));
    }, JOIN_SCHEDULER_BROWSER_API_TIMEOUT_MS);
    try {
      Promise.resolve(operation()).then(
        (value) => finish(resolve, value),
        (error) => finish(reject, error)
      );
    } catch (error) {
      finish(reject, error);
    }
  });
}

function normalizeJoinSchedulerRequestId(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function normalizeJoinSchedulerText(value, maxLength, required = false) {
  const text = typeof value === "string"
    ? value.replace(/[\s\u0000-\u001f\u007f]+/g, " ").trim()
    : "";
  if (!text || text.length > maxLength) return required ? null : "";
  return text;
}

function normalizeJoinSchedulerRecordId(value, prefix) {
  const id = typeof value === "string" ? value.trim().toLowerCase() : "";
  return new RegExp(`^${prefix}_[0-9a-f]{32}$`).test(id) ? id : null;
}

function createJoinSchedulerRecordId(prefix) {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues !== "function") {
    throw new JoinSchedulerError("STORAGE_UNAVAILABLE");
  }
  globalThis.crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("")}`;
}

function normalizeJoinSchedulerTimestamp(value, allowZero = false) {
  const timestamp = Number(value);
  if (allowZero && timestamp === 0) return 0;
  return Number.isSafeInteger(timestamp) && timestamp > 0 ? timestamp : null;
}

function normalizeJoinSchedulerRevision(value) {
  const revision = Number(value);
  return Number.isSafeInteger(revision) && revision > 0 ? revision : null;
}

function normalizeJoinSchedulerResultCode(value) {
  const code = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[a-z][a-z0-9-]{0,63}$/.test(code) ? code : null;
}

function normalizeJoinSchedulerGameIconUniverseIds(rawValue) {
  if (
    !Array.isArray(rawValue) ||
    rawValue.length === 0 ||
    rawValue.length > JOIN_SCHEDULER_GAME_ICON_MAX_IDS
  ) {
    return null;
  }
  const universeIds = [];
  const seen = new Set();
  for (const rawUniverseId of rawValue) {
    if (typeof rawUniverseId !== "string") return null;
    const universeId = normalizeId(rawUniverseId);
    if (!universeId || seen.has(universeId)) return null;
    seen.add(universeId);
    universeIds.push(universeId);
  }
  return Object.freeze(universeIds);
}

function normalizeJoinSchedulerGameIconUrl(rawUrl) {
  if (
    typeof rawUrl !== "string" ||
    rawUrl.length === 0 ||
    rawUrl.length > JOIN_SCHEDULER_GAME_ICON_URL_MAX_LENGTH
  ) {
    return null;
  }
  try {
    const url = new URL(rawUrl);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash &&
      (url.hostname === "rbxcdn.com" || url.hostname.endsWith(".rbxcdn.com"))
    ) ? url.href : null;
  } catch {
    return null;
  }
}

function pruneJoinSchedulerGameIconCache(cache, maxEntries, now = Date.now()) {
  for (const [key, entry] of cache) {
    if (!entry || entry.expiresAt <= now) cache.delete(key);
  }
  while (cache.size > maxEntries) {
    cache.delete(cache.keys().next().value);
  }
}

function getFreshJoinSchedulerGameIconCacheEntry(cache, key, now = Date.now()) {
  const entry = cache.get(key);
  if (!entry || entry.expiresAt <= now) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, entry);
  return entry;
}

function normalizeJoinSchedulerGameIconBatch(payload, universeIds) {
  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray(payload.data) ||
    payload.data.length > universeIds.length
  ) {
    throw new JoinSchedulerError("UNAVAILABLE");
  }
  const requested = new Set(universeIds);
  const byUniverseId = new Map();
  const seen = new Set();
  const duplicates = new Set();
  let hasPending = false;
  for (const rawIcon of payload.data) {
    const universeId = normalizeId(rawIcon?.targetId);
    if (!universeId || !requested.has(universeId)) continue;
    if (seen.has(universeId)) {
      byUniverseId.delete(universeId);
      duplicates.add(universeId);
      continue;
    }
    seen.add(universeId);
    if (rawIcon?.state === "Completed") {
      const thumbnailUrl = normalizeJoinSchedulerGameIconUrl(rawIcon.imageUrl);
      if (thumbnailUrl) byUniverseId.set(universeId, thumbnailUrl);
    } else if (rawIcon?.state === "Pending") {
      hasPending = true;
    }
  }
  for (const duplicate of duplicates) byUniverseId.delete(duplicate);
  return Object.freeze({ byUniverseId, hasPending });
}

async function fetchJoinSchedulerGameIconBatch(universeIds) {
  const completed = new Map();
  let remaining = [...universeIds];
  for (
    let attempt = 0;
    remaining.length > 0 && attempt <= THUMBNAIL_PENDING_RETRY_DELAYS_MS.length;
    attempt += 1
  ) {
    const endpoint = new URL(
      JOIN_SCHEDULER_GAME_ICON_SPEC.path,
      "https://thumbnails.roblox.com"
    );
    endpoint.searchParams.set(
      JOIN_SCHEDULER_GAME_ICON_SPEC.idParameter,
      remaining.join(",")
    );
    endpoint.searchParams.set("size", JOIN_SCHEDULER_GAME_ICON_SPEC.size);
    endpoint.searchParams.set("format", JOIN_SCHEDULER_GAME_ICON_SPEC.format);
    endpoint.searchParams.set(
      "isCircular",
      String(JOIN_SCHEDULER_GAME_ICON_SPEC.circular)
    );
    const payload = await fetchJson(endpoint, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      headers: { Accept: "application/json" }
    }, { maxAttempts: 1 });
    const normalized = normalizeJoinSchedulerGameIconBatch(payload, remaining);
    for (const [universeId, thumbnailUrl] of normalized.byUniverseId) {
      completed.set(universeId, thumbnailUrl);
    }
    remaining = remaining.filter((universeId) =>
      !completed.has(universeId) && normalized.hasPending
    );
    if (
      remaining.length > 0 &&
      attempt < THUMBNAIL_PENDING_RETRY_DELAYS_MS.length
    ) {
      await wait(THUMBNAIL_PENDING_RETRY_DELAYS_MS[attempt]);
    }
  }
  return completed;
}

async function getJoinSchedulerGameIcons(rawUniverseIds) {
  const universeIds = normalizeJoinSchedulerGameIconUniverseIds(rawUniverseIds);
  if (!universeIds) throw new JoinSchedulerError("INVALID", 400);
  const now = Date.now();
  const promisesByUniverseId = new Map();
  const missing = [];
  for (const universeId of universeIds) {
    const cached = getFreshJoinSchedulerGameIconCacheEntry(
      joinSchedulerGameIconCache,
      universeId,
      now
    );
    if (cached) promisesByUniverseId.set(universeId, cached.promise);
    else missing.push(universeId);
  }
  if (missing.length > 0) {
    const batchPromise = fetchJoinSchedulerGameIconBatch(missing)
      .catch(() => new Map());
    for (const universeId of missing) {
      const entry = {
        expiresAt: now + JOIN_SCHEDULER_GAME_ICON_CACHE_TTL_MS,
        promise: null
      };
      entry.promise = batchPromise.then((icons) => {
        const thumbnailUrl = normalizeJoinSchedulerGameIconUrl(
          icons.get(universeId)
        );
        entry.expiresAt = Date.now() + (thumbnailUrl
          ? JOIN_SCHEDULER_GAME_ICON_CACHE_TTL_MS
          : JOIN_SCHEDULER_GAME_ICON_FAILURE_CACHE_TTL_MS);
        return thumbnailUrl;
      });
      joinSchedulerGameIconCache.set(universeId, entry);
      promisesByUniverseId.set(universeId, entry.promise);
    }
    pruneJoinSchedulerGameIconCache(
      joinSchedulerGameIconCache,
      JOIN_SCHEDULER_GAME_ICON_CACHE_MAX_ENTRIES,
      now
    );
  }
  const resolved = await Promise.all(universeIds.map(async (universeId) => ({
    universeId,
    thumbnailUrl: await promisesByUniverseId.get(universeId)
  })));
  return Object.freeze(resolved
    .filter((icon) => icon.thumbnailUrl)
    .map((icon) => Object.freeze(icon)));
}

async function getJoinSchedulerGameIconUrl(rawUniverseId) {
  const universeId = normalizeId(rawUniverseId);
  if (!universeId) return null;
  const icons = await getJoinSchedulerGameIcons([universeId]).catch(() => []);
  return icons[0]?.universeId === universeId ? icons[0].thumbnailUrl : null;
}

function parseJoinSchedulerDestinationUrl(rawUrl) {
  if (
    typeof rawUrl !== "string" ||
    rawUrl !== rawUrl.trim() ||
    !rawUrl ||
    rawUrl.length > JOIN_SCHEDULER_PRIVATE_URL_MAX_LENGTH
  ) {
    throw new JoinSchedulerError("INVALID_PRIVATE_SERVER_URL", 400);
  }
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new JoinSchedulerError("INVALID_PRIVATE_SERVER_URL", 400);
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "www.roblox.com" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.hash !== ""
  ) {
    throw new JoinSchedulerError("INVALID_PRIVATE_SERVER_URL", 400);
  }
  const parameters = Array.from(url.searchParams.entries());
  const names = parameters.map(([name]) => name);
  if (new Set(names).size !== names.length) {
    throw new JoinSchedulerError("DUPLICATE_URL_PARAMETER", 400);
  }
  const legacyMatch = /^\/games\/([1-9]\d{0,19})(?:\/[^/?#]*)?\/?$/i.exec(
    url.pathname
  );
  if (legacyMatch) {
    if (
      parameters.length !== 1 ||
      parameters[0][0] !== "privateServerLinkCode"
    ) {
      throw new JoinSchedulerError("UNKNOWN_URL_PARAMETER", 400);
    }
    const accessCode = normalizePrivateServerAccessCode(parameters[0][1]);
    if (!accessCode) {
      throw new JoinSchedulerError("INVALID_PRIVATE_SERVER_URL", 400);
    }
    return Object.freeze({
      type: "private-legacy",
      placeId: legacyMatch[1],
      secret: accessCode,
      canonicalUrl: `https://www.roblox.com/games/${legacyMatch[1]}?privateServerLinkCode=${encodeURIComponent(accessCode)}`
    });
  }
  if (url.pathname === "/share" || url.pathname === "/share/") {
    if (
      parameters.length !== 2 ||
      !url.searchParams.has("code") ||
      !url.searchParams.has("type") ||
      url.searchParams.get("type") !== "Server" ||
      names.some((name) => name !== "code" && name !== "type")
    ) {
      throw new JoinSchedulerError("UNKNOWN_URL_PARAMETER", 400);
    }
    const code = url.searchParams.get("code") || "";
    if (
      code !== code.trim() ||
      code.length < 8 ||
      code.length > JOIN_SCHEDULER_SHARE_CODE_MAX_LENGTH ||
      !/^[A-Za-z0-9_-]+$/.test(code)
    ) {
      throw new JoinSchedulerError("INVALID_PRIVATE_SERVER_URL", 400);
    }
    return Object.freeze({
      type: "private-share",
      placeId: null,
      secret: code,
      canonicalUrl: `https://www.roblox.com/share?code=${encodeURIComponent(code)}&type=Server`
    });
  }
  throw new JoinSchedulerError("INVALID_PRIVATE_SERVER_URL", 400);
}

function normalizeJoinSchedulerDestinationRecord(rawRecord) {
  if (
    !rawRecord ||
    typeof rawRecord !== "object" ||
    Array.isArray(rawRecord) ||
    rawRecord.recordVersion !== JOIN_SCHEDULER_RECORD_VERSION
  ) {
    return null;
  }
  const accountId = normalizeId(rawRecord.accountId);
  const id = normalizeJoinSchedulerRecordId(rawRecord.id, "d");
  const universeId = normalizeId(rawRecord.universeId);
  const placeId = normalizeId(rawRecord.placeId);
  const gameName = normalizeJoinSchedulerText(
    rawRecord.gameName,
    JOIN_SCHEDULER_TEXT_MAX_LENGTH,
    true
  );
  const label = normalizeJoinSchedulerText(
    rawRecord.label,
    JOIN_SCHEDULER_TEXT_MAX_LENGTH,
    true
  );
  const type = ["public", "private-legacy", "private-share"].includes(
    rawRecord.type
  ) ? rawRecord.type : null;
  const createdAt = normalizeJoinSchedulerTimestamp(rawRecord.createdAt);
  const updatedAt = normalizeJoinSchedulerTimestamp(rawRecord.updatedAt);
  let secret = null;
  let verified = rawRecord.verified === true;
  let confirmedUnverified = rawRecord.confirmedUnverified === true;
  if (type === "private-legacy") {
    secret = normalizePrivateServerAccessCode(rawRecord.secret);
    verified = true;
    confirmedUnverified = false;
  } else if (type === "private-share") {
    const candidate = typeof rawRecord.secret === "string" ? rawRecord.secret : "";
    secret = candidate.length >= 8 &&
      candidate.length <= JOIN_SCHEDULER_SHARE_CODE_MAX_LENGTH &&
      /^[A-Za-z0-9_-]+$/.test(candidate)
      ? candidate
      : null;
    if (!verified && !confirmedUnverified) return null;
  } else if (type === "public") {
    verified = true;
    confirmedUnverified = false;
  }
  if (
    !accountId ||
    !id ||
    rawRecord.key !== `${accountId}:${id}` ||
    !universeId ||
    !placeId ||
    !gameName ||
    !label ||
    !type ||
    !createdAt ||
    !updatedAt ||
    updatedAt < createdAt ||
    (type !== "public" && !secret) ||
    (type === "public" && rawRecord.secret !== null)
  ) {
    return null;
  }
  return {
    recordVersion: JOIN_SCHEDULER_RECORD_VERSION,
    key: `${accountId}:${id}`,
    accountId,
    id,
    universeId,
    placeId,
    gameName,
    label,
    type,
    secret,
    verified,
    confirmedUnverified,
    createdAt,
    updatedAt
  };
}

function normalizeJoinSchedulerScheduleRecord(rawRecord) {
  if (
    !rawRecord ||
    typeof rawRecord !== "object" ||
    Array.isArray(rawRecord) ||
    rawRecord.recordVersion !== JOIN_SCHEDULER_RECORD_VERSION
  ) {
    return null;
  }
  const accountId = normalizeId(rawRecord.accountId);
  const id = normalizeJoinSchedulerRecordId(rawRecord.id, "s");
  const universeId = normalizeId(rawRecord.universeId);
  const placeId = normalizeId(rawRecord.placeId);
  const destinationId = normalizeJoinSchedulerRecordId(
    rawRecord.destinationId,
    "d"
  );
  const gameName = normalizeJoinSchedulerText(
    rawRecord.gameName,
    JOIN_SCHEDULER_TEXT_MAX_LENGTH,
    true
  );
  const title = normalizeJoinSchedulerText(
    rawRecord.title,
    JOIN_SCHEDULER_TITLE_MAX_LENGTH,
    true
  );
  const startAt = normalizeJoinSchedulerTimestamp(rawRecord.startAt);
  const rawEndAt = normalizeJoinSchedulerTimestamp(rawRecord.endAt, true);
  const endAt = rawEndAt === 0 ? null : rawEndAt;
  const eventId = rawRecord.eventId === null
    ? null
    : normalizeGameEventId(rawRecord.eventId);
  const mode = ["notify", "auto"].includes(rawRecord.mode)
    ? rawRecord.mode
    : null;
  const status = [
    "pending",
    "claimed",
    "completed",
    "canceled",
    "missed",
    "failed"
  ].includes(rawRecord.status) ? rawRecord.status : null;
  const revision = normalizeJoinSchedulerRevision(rawRecord.revision);
  const createdAt = normalizeJoinSchedulerTimestamp(rawRecord.createdAt);
  const updatedAt = normalizeJoinSchedulerTimestamp(rawRecord.updatedAt);
  const notifiedAt = normalizeJoinSchedulerTimestamp(rawRecord.notifiedAt, true);
  const claimedAt = normalizeJoinSchedulerTimestamp(rawRecord.claimedAt, true);
  const completedAt = normalizeJoinSchedulerTimestamp(rawRecord.completedAt, true);
  const consentVersion = Number(rawRecord.consentVersion);
  const consentedAt = normalizeJoinSchedulerTimestamp(rawRecord.consentedAt, true);
  const resultCode = rawRecord.resultCode === null
    ? null
    : normalizeJoinSchedulerResultCode(rawRecord.resultCode);
  if (
    !accountId ||
    !id ||
    rawRecord.key !== `${accountId}:${id}` ||
    !universeId ||
    !placeId ||
    !destinationId ||
    !gameName ||
    !title ||
    !startAt ||
    (endAt !== null && endAt <= startAt) ||
    !mode ||
    !revision ||
    typeof rawRecord.allowSwitch !== "boolean" ||
    !status ||
    !createdAt ||
    !updatedAt ||
    updatedAt < createdAt ||
    notifiedAt === null ||
    claimedAt === null ||
    completedAt === null ||
    consentedAt === null ||
    (rawRecord.resultCode !== null && !resultCode) ||
    (mode === "auto" &&
      (consentVersion !== JOIN_SCHEDULER_CONSENT_VERSION || !consentedAt)) ||
    (mode === "notify" && (consentVersion !== 0 || consentedAt !== 0))
  ) {
    return null;
  }
  return {
    recordVersion: JOIN_SCHEDULER_RECORD_VERSION,
    key: `${accountId}:${id}`,
    accountId,
    id,
    universeId,
    placeId,
    destinationId,
    gameName,
    title,
    startAt,
    endAt,
    eventId,
    mode,
    revision,
    allowSwitch: rawRecord.allowSwitch,
    status,
    consentVersion,
    consentedAt,
    notifiedAt,
    claimedAt,
    completedAt,
    resultCode,
    createdAt,
    updatedAt
  };
}

function normalizeJoinSchedulerMetaRecord(rawRecord) {
  if (
    !rawRecord ||
    typeof rawRecord !== "object" ||
    Array.isArray(rawRecord) ||
    rawRecord.recordVersion !== JOIN_SCHEDULER_RECORD_VERSION
  ) {
    return null;
  }
  if (rawRecord.key === "global") {
    const lastAutoAttemptAt = normalizeJoinSchedulerTimestamp(
      rawRecord.lastAutoAttemptAt,
      true
    );
    return lastAutoAttemptAt === null ? null : {
      recordVersion: JOIN_SCHEDULER_RECORD_VERSION,
      key: "global",
      lastAutoAttemptAt
    };
  }
  const accountId = normalizeId(rawRecord.accountId);
  const updatedAt = normalizeJoinSchedulerTimestamp(rawRecord.updatedAt);
  if (
    !accountId ||
    rawRecord.key !== `account:${accountId}` ||
    typeof rawRecord.enabled !== "boolean" ||
    !updatedAt
  ) {
    return null;
  }
  return {
    recordVersion: JOIN_SCHEDULER_RECORD_VERSION,
    key: `account:${accountId}`,
    accountId,
    enabled: rawRecord.enabled,
    updatedAt
  };
}

function normalizeJoinSchedulerSnapshot(rawSnapshot) {
  const rawDestinations = Array.isArray(rawSnapshot?.destinations)
    ? rawSnapshot.destinations
    : [];
  const rawSchedules = Array.isArray(rawSnapshot?.schedules)
    ? rawSnapshot.schedules
    : [];
  const rawMeta = Array.isArray(rawSnapshot?.meta) ? rawSnapshot.meta : [];
  const destinationsByKey = new Map();
  for (const raw of rawDestinations) {
    const record = normalizeJoinSchedulerDestinationRecord(raw);
    if (!record || destinationsByKey.has(record.key)) continue;
    destinationsByKey.set(record.key, record);
  }
  const schedulesByKey = new Map();
  for (const raw of rawSchedules) {
    const record = normalizeJoinSchedulerScheduleRecord(raw);
    if (!record || schedulesByKey.has(record.key)) continue;
    schedulesByKey.set(record.key, record);
  }
  const metaByKey = new Map();
  for (const raw of rawMeta) {
    const record = normalizeJoinSchedulerMetaRecord(raw);
    if (!record || metaByKey.has(record.key)) continue;
    metaByKey.set(record.key, record);
  }
  const accountUpdatedAt = new Map();
  const touchAccount = (accountId, updatedAt) => accountUpdatedAt.set(
    accountId,
    Math.max(accountUpdatedAt.get(accountId) || 0, updatedAt || 0)
  );
  for (const record of destinationsByKey.values()) {
    touchAccount(record.accountId, record.updatedAt);
  }
  for (const record of schedulesByKey.values()) {
    touchAccount(record.accountId, record.updatedAt);
  }
  for (const record of metaByKey.values()) {
    if (record.accountId) touchAccount(record.accountId, record.updatedAt);
  }
  const keptAccounts = new Set(
    Array.from(accountUpdatedAt)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, JOIN_SCHEDULER_MAX_ACCOUNTS)
      .map(([accountId]) => accountId)
  );
  const limitPerAccount = (records, limit) => {
    const byAccount = new Map();
    for (const record of records) {
      if (!keptAccounts.has(record.accountId)) continue;
      if (!byAccount.has(record.accountId)) byAccount.set(record.accountId, []);
      byAccount.get(record.accountId).push(record);
    }
    return Array.from(byAccount.values()).flatMap((accountRecords) =>
      accountRecords
        .sort((left, right) => right.updatedAt - left.updatedAt || left.id.localeCompare(right.id))
        .slice(0, limit)
    );
  };
  const meta = [];
  const globalMeta = metaByKey.get("global");
  if (globalMeta) meta.push(globalMeta);
  for (const accountId of keptAccounts) {
    meta.push(metaByKey.get(`account:${accountId}`) || {
      recordVersion: JOIN_SCHEDULER_RECORD_VERSION,
      key: `account:${accountId}`,
      accountId,
      enabled: true,
      updatedAt: accountUpdatedAt.get(accountId)
    });
  }
  return {
    destinations: limitPerAccount(
      Array.from(destinationsByKey.values()),
      JOIN_SCHEDULER_MAX_DESTINATIONS
    ),
    schedules: limitPerAccount(
      Array.from(schedulesByKey.values()),
      JOIN_SCHEDULER_MAX_SCHEDULES
    ),
    meta
  };
}

function requestJoinSchedulerIdb(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
  });
}

function openJoinSchedulerDatabase() {
  if (joinSchedulerDbPromise) return joinSchedulerDbPromise;
  if (!globalThis.indexedDB?.open) {
    return Promise.reject(new JoinSchedulerError("STORAGE_UNAVAILABLE"));
  }
  joinSchedulerDbPromise = new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(
      JOIN_SCHEDULER_DB_NAME,
      JOIN_SCHEDULER_DB_VERSION
    );
    request.onupgradeneeded = (event) => {
      const database = request.result;
      if (event.oldVersion !== 0) {
        request.transaction?.abort();
        return;
      }
      const destinations = database.createObjectStore(
        JOIN_SCHEDULER_DESTINATIONS_STORE,
        { keyPath: "key" }
      );
      destinations.createIndex("accountId", "accountId", { unique: false });
      const schedules = database.createObjectStore(
        JOIN_SCHEDULER_SCHEDULES_STORE,
        { keyPath: "key" }
      );
      schedules.createIndex("accountId", "accountId", { unique: false });
      schedules.createIndex("startAt", "startAt", { unique: false });
      database.createObjectStore(JOIN_SCHEDULER_META_STORE, { keyPath: "key" });
    };
    request.onsuccess = () => {
      const database = request.result;
      const requiredStores = [
        JOIN_SCHEDULER_DESTINATIONS_STORE,
        JOIN_SCHEDULER_SCHEDULES_STORE,
        JOIN_SCHEDULER_META_STORE
      ];
      if (requiredStores.some((name) => !database.objectStoreNames.contains(name))) {
        database.close();
        reject(new JoinSchedulerError("STORAGE_SCHEMA_UNSUPPORTED"));
        return;
      }
      database.onversionchange = () => {
        database.close();
        joinSchedulerDbPromise = null;
      };
      resolve(database);
    };
    request.onerror = () => {
      joinSchedulerDbPromise = null;
      reject(new JoinSchedulerError("STORAGE_UNAVAILABLE", 0, request.error));
    };
    request.onblocked = () => {
      joinSchedulerDbPromise = null;
      reject(new JoinSchedulerError("STORAGE_UNAVAILABLE"));
    };
  });
  return joinSchedulerDbPromise;
}

async function readJoinSchedulerSnapshot() {
  if (typeof joinSchedulerStorageOverride?.read === "function") {
    return normalizeJoinSchedulerSnapshot(await joinSchedulerStorageOverride.read());
  }
  const database = await openJoinSchedulerDatabase();
  const transaction = database.transaction([
    JOIN_SCHEDULER_DESTINATIONS_STORE,
    JOIN_SCHEDULER_SCHEDULES_STORE,
    JOIN_SCHEDULER_META_STORE
  ], "readonly");
  const [destinations, schedules, meta] = await Promise.all([
    requestJoinSchedulerIdb(
      transaction.objectStore(JOIN_SCHEDULER_DESTINATIONS_STORE).getAll()
    ),
    requestJoinSchedulerIdb(
      transaction.objectStore(JOIN_SCHEDULER_SCHEDULES_STORE).getAll()
    ),
    requestJoinSchedulerIdb(
      transaction.objectStore(JOIN_SCHEDULER_META_STORE).getAll()
    )
  ]);
  return normalizeJoinSchedulerSnapshot({ destinations, schedules, meta });
}

async function writeJoinSchedulerSnapshotInTransaction(snapshot) {
  const normalized = normalizeJoinSchedulerSnapshot(snapshot);
  const database = await openJoinSchedulerDatabase();
  const transaction = database.transaction([
    JOIN_SCHEDULER_DESTINATIONS_STORE,
    JOIN_SCHEDULER_SCHEDULES_STORE,
    JOIN_SCHEDULER_META_STORE
  ], "readwrite");
  const stores = [
    [JOIN_SCHEDULER_DESTINATIONS_STORE, normalized.destinations],
    [JOIN_SCHEDULER_SCHEDULES_STORE, normalized.schedules],
    [JOIN_SCHEDULER_META_STORE, normalized.meta]
  ];
  for (const [storeName, records] of stores) {
    const store = transaction.objectStore(storeName);
    store.clear();
    for (const record of records) store.put(record);
  }
  await new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(
      transaction.error || new Error("IndexedDB transaction failed")
    );
    transaction.onabort = () => reject(
      transaction.error || new Error("IndexedDB transaction aborted")
    );
  });
  return normalized;
}

async function mutateJoinSchedulerSnapshotInTransaction(mutator) {
  const database = await openJoinSchedulerDatabase();
  const transaction = database.transaction([
    JOIN_SCHEDULER_DESTINATIONS_STORE,
    JOIN_SCHEDULER_SCHEDULES_STORE,
    JOIN_SCHEDULER_META_STORE
  ], "readwrite");
  const destinationStore = transaction.objectStore(
    JOIN_SCHEDULER_DESTINATIONS_STORE
  );
  const scheduleStore = transaction.objectStore(JOIN_SCHEDULER_SCHEDULES_STORE);
  const metaStore = transaction.objectStore(JOIN_SCHEDULER_META_STORE);
  const [destinations, schedules, meta] = await Promise.all([
    requestJoinSchedulerIdb(destinationStore.getAll()),
    requestJoinSchedulerIdb(scheduleStore.getAll()),
    requestJoinSchedulerIdb(metaStore.getAll())
  ]);
  const snapshot = normalizeJoinSchedulerSnapshot({ destinations, schedules, meta });
  const result = mutator(snapshot);
  const normalized = normalizeJoinSchedulerSnapshot(snapshot);
  for (const [store, records] of [
    [destinationStore, normalized.destinations],
    [scheduleStore, normalized.schedules],
    [metaStore, normalized.meta]
  ]) {
    store.clear();
    for (const record of records) store.put(record);
  }
  await new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(
      transaction.error || new Error("IndexedDB transaction failed")
    );
    transaction.onabort = () => reject(
      transaction.error || new Error("IndexedDB transaction aborted")
    );
  });
  return result;
}

function mutateJoinSchedulerStorage(mutator) {
  const operation = joinSchedulerStorageWriteTail
    .catch(() => undefined)
    .then(async () => {
      if (typeof joinSchedulerStorageOverride?.mutate === "function") {
        return joinSchedulerStorageOverride.mutate((rawSnapshot) => {
          const snapshot = normalizeJoinSchedulerSnapshot(rawSnapshot);
          const result = mutator(snapshot);
          return { snapshot: normalizeJoinSchedulerSnapshot(snapshot), result };
        });
      }
      return mutateJoinSchedulerSnapshotInTransaction(mutator);
    });
  joinSchedulerStorageWriteTail = operation.catch(() => undefined);
  return operation;
}

function createJoinSchedulerMemoryStorageForTests(initialSnapshot = null) {
  let snapshot = normalizeJoinSchedulerSnapshot(initialSnapshot);
  return {
    async read() {
      return structuredClone(snapshot);
    },
    async mutate(callback) {
      const outcome = callback(structuredClone(snapshot));
      snapshot = normalizeJoinSchedulerSnapshot(outcome.snapshot);
      return outcome.result;
    },
    getSnapshot() {
      return structuredClone(snapshot);
    }
  };
}

function getJoinSchedulerAccountMeta(snapshot, accountId, now, create = false) {
  let meta = snapshot.meta.find((record) => record.accountId === accountId) || null;
  if (!meta && create) {
    meta = {
      recordVersion: JOIN_SCHEDULER_RECORD_VERSION,
      key: `account:${accountId}`,
      accountId,
      enabled: true,
      updatedAt: now
    };
    snapshot.meta.push(meta);
  }
  return meta;
}

function getJoinSchedulerGlobalMeta(snapshot, create = false) {
  let meta = snapshot.meta.find((record) => record.key === "global") || null;
  if (!meta && create) {
    meta = {
      recordVersion: JOIN_SCHEDULER_RECORD_VERSION,
      key: "global",
      lastAutoAttemptAt: 0
    };
    snapshot.meta.push(meta);
  }
  return meta;
}

function sanitizeJoinSchedulerDestination(destination) {
  return {
    id: destination.id,
    universeId: destination.universeId,
    placeId: destination.placeId,
    gameName: destination.gameName,
    label: destination.label,
    type: destination.type,
    verified: destination.verified,
    requiresConfirmation:
      destination.type === "private-share" && !destination.verified,
    createdAt: destination.createdAt,
    updatedAt: destination.updatedAt
  };
}

function sanitizeJoinSchedulerSchedule(schedule) {
  return {
    id: schedule.id,
    universeId: schedule.universeId,
    placeId: schedule.placeId,
    destinationId: schedule.destinationId,
    gameName: schedule.gameName,
    title: schedule.title,
    startAt: schedule.startAt,
    endAt: schedule.endAt,
    eventId: schedule.eventId,
    mode: schedule.mode,
    revision: schedule.revision,
    allowSwitch: schedule.allowSwitch,
    status: schedule.status,
    notifiedAt: schedule.notifiedAt,
    completedAt: schedule.completedAt,
    resultCode: schedule.resultCode,
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt
  };
}

async function readJoinSchedulerAccountState(accountId) {
  await joinSchedulerStorageWriteTail.catch(() => undefined);
  const snapshot = await readJoinSchedulerSnapshot();
  const meta = getJoinSchedulerAccountMeta(snapshot, accountId, joinSchedulerNow());
  return {
    enabled: joinSchedulerFeatureEnabled && (meta?.enabled !== false),
    accountEnabled: meta?.enabled !== false,
    destinations: snapshot.destinations
      .filter((record) => record.accountId === accountId)
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .map(sanitizeJoinSchedulerDestination),
    schedules: snapshot.schedules
      .filter((record) => record.accountId === accountId)
      .sort((left, right) => left.startAt - right.startAt || right.updatedAt - left.updatedAt)
      .map(sanitizeJoinSchedulerSchedule)
  };
}

function getJoinSchedulerFeatureValue(rawValue) {
  return !(
    rawValue &&
    typeof rawValue === "object" &&
    !Array.isArray(rawValue) &&
    rawValue.version === FEATURE_SETTINGS_VERSION &&
    rawValue.flags &&
    typeof rawValue.flags === "object" &&
    !Array.isArray(rawValue.flags) &&
    rawValue.flags[JOIN_SCHEDULER_FEATURE_KEY] === false
  );
}

function applyJoinSchedulerFeatureValue(rawValue, reconcile = false) {
  const nextEnabled = getJoinSchedulerFeatureValue(rawValue);
  const changed = joinSchedulerFeatureReady &&
    joinSchedulerFeatureEnabled !== nextEnabled;
  joinSchedulerFeatureEnabled = nextEnabled;
  joinSchedulerFeatureReady = true;
  if (reconcile || changed) {
    if (nextEnabled) {
      void (reconcile === "startup"
        ? reconcileJoinSchedulerLifecycle()
        : ensureJoinSchedulerCoordinatorAlarm()).catch(() => undefined);
    } else {
      void cancelAllJoinSchedulerSchedules("feature-disabled").catch(
        () => undefined
      );
    }
  }
}

function syncJoinSchedulerFeatureFromStorage(reconcile = false) {
  if (!chrome.storage?.local?.get) {
    applyJoinSchedulerFeatureValue(null, reconcile);
    return Promise.resolve();
  }
  const sync = new Promise((resolve) => {
    chrome.storage.local.get(
      { [FEATURE_SETTINGS_STORAGE_KEY]: null },
      (result) => {
        void chrome.runtime.lastError;
        applyJoinSchedulerFeatureValue(
          result?.[FEATURE_SETTINGS_STORAGE_KEY],
          reconcile
        );
        resolve();
      }
    );
  });
  const tracked = sync.finally(() => {
    if (joinSchedulerFeatureSyncPromise === tracked) {
      joinSchedulerFeatureSyncPromise = null;
    }
  });
  joinSchedulerFeatureSyncPromise = tracked;
  return tracked;
}

async function assertJoinSchedulerFeatureEnabled(fresh = false) {
  if (fresh || !joinSchedulerFeatureReady) {
    await (joinSchedulerFeatureSyncPromise ||
      syncJoinSchedulerFeatureFromStorage());
  }
  if (!joinSchedulerFeatureEnabled) {
    throw new JoinSchedulerError("DISABLED");
  }
}

function getJoinSchedulerExpectedViewerUserId(message) {
  if (
    message?.viewerUserId === undefined ||
    message?.viewerUserId === null ||
    message?.viewerUserId === ""
  ) {
    return null;
  }
  const viewerUserId = normalizeId(message.viewerUserId);
  if (!viewerUserId) throw new JoinSchedulerError("INVALID", 400);
  return viewerUserId;
}

async function getJoinSchedulerViewerUserId(message, fresh = false) {
  const expected = getJoinSchedulerExpectedViewerUserId(message);
  const override = fresh
    ? joinSchedulerRuntimeOverrides?.fetchFreshViewerUserId
    : joinSchedulerRuntimeOverrides?.getViewerUserId;
  let viewerUserId;
  if (typeof override === "function") {
    viewerUserId = normalizeId(await override());
  } else if (fresh) {
    viewerUserId = await fetchFreshGameEventsViewerUserId();
  } else {
    viewerUserId = await getAuthenticatedViewerUserId();
  }
  if (!viewerUserId) throw new JoinSchedulerError("UNAUTHENTICATED", 401);
  if (expected && expected !== viewerUserId) {
    throw new JoinSchedulerError("ACCOUNT_CHANGED", 409, { viewerUserId });
  }
  return viewerUserId;
}

async function hasJoinSchedulerNotificationPermission() {
  if (typeof joinSchedulerRuntimeOverrides?.hasNotificationPermission === "function") {
    return joinSchedulerRuntimeOverrides.hasNotificationPermission();
  }
  if (!chrome.permissions?.contains || !chrome.notifications?.create) return false;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value === true);
    };
    try {
      const result = chrome.permissions.contains(
        { permissions: ["notifications"] },
        finish
      );
      if (result?.then) result.then(finish, () => finish(false));
    } catch {
      finish(false);
    }
  });
}

async function hasJoinSchedulerNotificationAuthority(accountId) {
  try {
    await assertJoinSchedulerFeatureEnabled(true);
    if (!await hasJoinSchedulerNotificationPermission()) return false;
    await getJoinSchedulerViewerUserId({ viewerUserId: accountId }, true);
    return true;
  } catch {
    return false;
  }
}

async function readJoinSchedulerResponseTextLimited(
  response,
  maxBytes = JOIN_SCHEDULER_DESTINATION_RESPONSE_MAX_BYTES
) {
  const contentLength = Number(response?.headers?.get?.("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new JoinSchedulerError("PRIVATE_LINK_UNVERIFIED");
  }
  if (typeof response?.body?.getReader !== "function") {
    const text = String(await response.text());
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new JoinSchedulerError("PRIVATE_LINK_UNVERIFIED");
    }
    return text;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      size += chunk.byteLength;
      if (size > maxBytes) {
        try { await reader.cancel(); } catch { /* best effort */ }
        throw new JoinSchedulerError("PRIVATE_LINK_UNVERIFIED");
      }
      text += decoder.decode(chunk, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally {
    try { reader.releaseLock(); } catch { /* best effort */ }
  }
}

function parseTrustedJoinSchedulerShareResolveUrl(rawUrl, baseUrl) {
  let url;
  try {
    url = new URL(rawUrl, baseUrl);
  } catch {
    return null;
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "www.roblox.com" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    !["/share", "/share/", "/share-links", "/share-links/"].includes(
      url.pathname
    )
  ) {
    return null;
  }
  return url;
}

async function resolveJoinSchedulerModernDestination(parsed) {
  if (typeof joinSchedulerRuntimeOverrides?.resolveModernDestination === "function") {
    return joinSchedulerRuntimeOverrides.resolveModernDestination(parsed);
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    JOIN_SCHEDULER_DESTINATION_RESOLVE_TIMEOUT_MS
  );
  let response = null;
  let html;
  let finalUrl = parseTrustedJoinSchedulerShareResolveUrl(parsed.canonicalUrl);
  if (!finalUrl) throw new JoinSchedulerError("PRIVATE_LINK_UNVERIFIED");
  try {
    for (
      let hop = 0;
      hop <= JOIN_SCHEDULER_DESTINATION_REDIRECT_MAX_HOPS;
      hop += 1
    ) {
      response = await fetch(finalUrl.href, {
        method: "GET",
        cache: "no-store",
        credentials: "omit",
        redirect: "manual",
        headers: { Accept: "text/html" },
        signal: controller.signal
      });
      if ([301, 302, 303, 307, 308].includes(response?.status)) {
        const location = response?.headers?.get?.("location");
        if (
          hop >= JOIN_SCHEDULER_DESTINATION_REDIRECT_MAX_HOPS ||
          typeof location !== "string" ||
          location.length === 0 ||
          location.length > JOIN_SCHEDULER_PRIVATE_URL_MAX_LENGTH
        ) {
          throw new JoinSchedulerError("PRIVATE_LINK_UNVERIFIED");
        }
        const nextUrl = parseTrustedJoinSchedulerShareResolveUrl(
          location,
          finalUrl.href
        );
        if (!nextUrl) throw new JoinSchedulerError("PRIVATE_LINK_UNVERIFIED");
        try { await response.body?.cancel?.(); } catch { /* best effort */ }
        finalUrl = nextUrl;
        continue;
      }
      if (!response?.ok) throw new JoinSchedulerError("PRIVATE_LINK_UNVERIFIED");
      const reportedUrl = parseTrustedJoinSchedulerShareResolveUrl(
        response.url || finalUrl.href,
        finalUrl.href
      );
      if (!reportedUrl) throw new JoinSchedulerError("PRIVATE_LINK_UNVERIFIED");
      finalUrl = reportedUrl;
      html = await readJoinSchedulerResponseTextLimited(response);
      break;
    }
  } finally {
    clearTimeout(timeoutId);
  }
  if (typeof html !== "string") {
    throw new JoinSchedulerError("PRIVATE_LINK_UNVERIFIED");
  }
  let placeId = null;
  for (const match of html.matchAll(/<meta\b[^>]{0,2000}>/gi)) {
    const tag = match[0];
    const name = /\bname\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] || "";
    if (name.toLowerCase() !== "roblox:start_place_id") continue;
    placeId = normalizeId(
      /\bcontent\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]
    );
    if (placeId) break;
  }
  if (!placeId) throw new JoinSchedulerError("PRIVATE_LINK_UNVERIFIED");
  const universeId = await resolveGameEventsUniverseIdFromPlace(placeId);
  return { placeId, universeId };
}

async function validateJoinSchedulerDestination(message) {
  const universeId = normalizeId(message?.universeId);
  const fallbackPlaceId = normalizeId(message?.placeId);
  if (!universeId || !fallbackPlaceId) {
    throw new JoinSchedulerError("INVALID", 400);
  }
  if (message?.url === undefined || message?.url === null || message.url === "") {
    return {
      type: "public",
      universeId,
      placeId: fallbackPlaceId,
      verified: true,
      requiresConfirmation: false,
      label: "Public server"
    };
  }
  const parsed = parseJoinSchedulerDestinationUrl(message.url);
  if (parsed.type === "private-legacy") {
    const resolvedUniverseId = await resolveGameEventsUniverseIdFromPlace(
      parsed.placeId
    );
    if (resolvedUniverseId !== universeId) {
      throw new JoinSchedulerError("PRIVATE_LINK_GAME_MISMATCH", 409);
    }
    return {
      type: parsed.type,
      universeId,
      placeId: parsed.placeId,
      verified: true,
      requiresConfirmation: false,
      label: "Private server",
      parsed
    };
  }
  try {
    const resolved = await resolveJoinSchedulerModernDestination(parsed);
    if (resolved.universeId !== universeId) {
      throw new JoinSchedulerError("PRIVATE_LINK_GAME_MISMATCH", 409);
    }
    return {
      type: parsed.type,
      universeId,
      placeId: resolved.placeId,
      verified: true,
      requiresConfirmation: false,
      label: "Private server",
      parsed
    };
  } catch (error) {
    if (error instanceof JoinSchedulerError &&
      error.code === "PRIVATE_LINK_GAME_MISMATCH") {
      throw error;
    }
    return {
      type: parsed.type,
      universeId,
      placeId: fallbackPlaceId,
      verified: false,
      requiresConfirmation: true,
      label: "Private server (unverified)",
      parsed
    };
  }
}

async function getJoinSchedulerSearchResponse(message) {
  await assertJoinSchedulerFeatureEnabled();
  const viewerUserId = await getJoinSchedulerViewerUserId(message);
  const query = normalizeGameEventsSearchQuery(message?.query);
  if (!query) throw new JoinSchedulerError("INVALID", 400);
  const rawResults = await searchGameEventsGames(query, message?.locale);
  const results = await Promise.all(rawResults.map(async (game) => ({
    ...game,
    thumbnailUrl: await getJoinSchedulerGameIconUrl(game.universeId)
      .catch(() => null)
  })));
  await getJoinSchedulerViewerUserId({ viewerUserId }, true);
  return {
    ok: true,
    requestId: normalizeJoinSchedulerRequestId(message?.requestId) || 0,
    viewerUserId,
    query,
    results
  };
}

async function getJoinSchedulerGameIconsResponse(message) {
  const messageKeys = message && typeof message === "object" && !Array.isArray(message)
    ? Object.keys(message).sort()
    : [];
  const hasExactMessageShape =
    messageKeys.length === 4 &&
    messageKeys[0] === "requestId" &&
    messageKeys[1] === "type" &&
    messageKeys[2] === "universeIds" &&
    messageKeys[3] === "viewerUserId";
  const universeIds = normalizeJoinSchedulerGameIconUniverseIds(
    message?.universeIds
  );
  if (!hasExactMessageShape || !universeIds) {
    throw new JoinSchedulerError("INVALID", 400);
  }
  await assertJoinSchedulerFeatureEnabled();
  const viewerUserId = await getJoinSchedulerViewerUserId(message, true);
  const gameIcons = await getJoinSchedulerGameIcons(universeIds);
  await assertJoinSchedulerFeatureEnabled(true);
  await getJoinSchedulerViewerUserId({ viewerUserId }, true);
  return {
    ok: true,
    requestId: normalizeJoinSchedulerRequestId(message?.requestId) || 0,
    viewerUserId,
    gameIcons
  };
}

function pruneJoinSchedulerOrphanPublicDestinations(
  snapshot,
  accountId,
  candidateIds = null
) {
  const candidates = candidateIds === null
    ? null
    : new Set(Array.from(candidateIds, (id) => String(id)));
  const referenced = new Set(
    snapshot.schedules
      .filter((schedule) => schedule.accountId === accountId)
      .map((schedule) => schedule.destinationId)
  );
  const removed = [];
  snapshot.destinations = snapshot.destinations.filter((destination) => {
    const orphan = destination.accountId === accountId &&
      destination.type === "public" &&
      !referenced.has(destination.id) &&
      (candidates === null || candidates.has(destination.id));
    if (orphan) removed.push(destination.id);
    return !orphan;
  });
  return removed;
}

async function saveJoinSchedulerDestination(message) {
  await assertJoinSchedulerFeatureEnabled();
  const viewerUserId = await getJoinSchedulerViewerUserId(message, true);
  const gameName = normalizeJoinSchedulerText(
    message?.gameName,
    JOIN_SCHEDULER_TEXT_MAX_LENGTH,
    true
  );
  if (!gameName) throw new JoinSchedulerError("INVALID", 400);
  const checked = await validateJoinSchedulerDestination(message);
  if (checked.requiresConfirmation && message?.confirmUnverified !== true) {
    return {
      ok: true,
      requestId: normalizeJoinSchedulerRequestId(message?.requestId) || 0,
      viewerUserId,
      requiresConfirmation: true,
      destination: {
        type: checked.type,
        universeId: checked.universeId,
        placeId: checked.placeId,
        verified: false,
        requiresConfirmation: true,
        label: checked.label
      }
    };
  }
  await getJoinSchedulerViewerUserId({ viewerUserId }, true);
  const now = joinSchedulerNow();
  const destination = await mutateJoinSchedulerStorage((snapshot) => {
    pruneJoinSchedulerOrphanPublicDestinations(snapshot, viewerUserId);
    const accountDestinations = snapshot.destinations.filter(
      (record) => record.accountId === viewerUserId
    );
    if (accountDestinations.length >= JOIN_SCHEDULER_MAX_DESTINATIONS) {
      throw new JoinSchedulerError("DESTINATION_LIMIT_REACHED", 400);
    }
    const id = createJoinSchedulerRecordId("d");
    const record = {
      recordVersion: JOIN_SCHEDULER_RECORD_VERSION,
      key: `${viewerUserId}:${id}`,
      accountId: viewerUserId,
      id,
      universeId: checked.universeId,
      placeId: checked.placeId,
      gameName,
      label: checked.label,
      type: checked.type,
      secret: checked.type === "public" ? null : checked.parsed.secret,
      verified: checked.verified,
      confirmedUnverified: checked.requiresConfirmation,
      createdAt: now,
      updatedAt: now
    };
    snapshot.destinations.push(record);
    getJoinSchedulerAccountMeta(snapshot, viewerUserId, now, true).updatedAt = now;
    return record;
  });
  return {
    ok: true,
    requestId: normalizeJoinSchedulerRequestId(message?.requestId) || 0,
    viewerUserId,
    requiresConfirmation: false,
    destination: sanitizeJoinSchedulerDestination(destination)
  };
}

function getOrCreateJoinSchedulerPublicDestination(
  snapshot,
  viewerUserId,
  game,
  now
) {
  let destination = snapshot.destinations.find((record) =>
    record.accountId === viewerUserId &&
    record.type === "public" &&
    record.universeId === game.universeId &&
    record.placeId === game.placeId
  );
  if (destination) {
    destination.gameName = game.gameName;
    destination.updatedAt = now;
    return destination;
  }
  if (snapshot.destinations.filter((record) =>
    record.accountId === viewerUserId
  ).length >= JOIN_SCHEDULER_MAX_DESTINATIONS) {
    pruneJoinSchedulerOrphanPublicDestinations(snapshot, viewerUserId);
    if (snapshot.destinations.filter((record) =>
      record.accountId === viewerUserId
    ).length >= JOIN_SCHEDULER_MAX_DESTINATIONS) {
      throw new JoinSchedulerError("DESTINATION_LIMIT_REACHED", 400);
    }
  }
  const id = createJoinSchedulerRecordId("d");
  destination = {
    recordVersion: JOIN_SCHEDULER_RECORD_VERSION,
    key: `${viewerUserId}:${id}`,
    accountId: viewerUserId,
    id,
    universeId: game.universeId,
    placeId: game.placeId,
    gameName: game.gameName,
    label: "Public server",
    type: "public",
    secret: null,
    verified: true,
    confirmedUnverified: false,
    createdAt: now,
    updatedAt: now
  };
  snapshot.destinations.push(destination);
  return destination;
}

async function revalidateJoinSchedulerEvent(scheduleOrDraft, now = joinSchedulerNow()) {
  if (!scheduleOrDraft.eventId) return null;
  if (typeof joinSchedulerRuntimeOverrides?.revalidateEvent === "function") {
    const result = await joinSchedulerRuntimeOverrides.revalidateEvent(
      structuredClone(scheduleOrDraft),
      now
    );
    if (!result || result.ok !== true) {
      throw new JoinSchedulerError(result?.code || "EVENT_UNAVAILABLE");
    }
    return result.event || null;
  }
  let response;
  try {
    response = await getGameEventsForUniverse(scheduleOrDraft.universeId, {
      forceRefresh: true,
      now
    });
  } catch {
    throw new JoinSchedulerError("EVENT_UNAVAILABLE");
  }
  if (
    !response ||
    response.stale !== false ||
    response.usedCachedData !== false ||
    response.failureCode !== null
  ) {
    throw new JoinSchedulerError("EVENT_UNAVAILABLE");
  }
  const event = response.events.find((entry) =>
    entry.id === scheduleOrDraft.eventId
  );
  if (!event) throw new JoinSchedulerError("EVENT_UNAVAILABLE");
  if (
    event.startAt !== scheduleOrDraft.startAt ||
    event.placeId !== scheduleOrDraft.placeId ||
    (scheduleOrDraft.endAt !== null && event.endAt !== scheduleOrDraft.endAt)
  ) {
    throw new JoinSchedulerError("EVENT_CHANGED", 409);
  }
  return event;
}

function normalizeJoinSchedulerScheduleInput(message, now = joinSchedulerNow()) {
  const universeId = normalizeId(message?.universeId);
  const placeId = normalizeId(message?.placeId);
  const gameName = normalizeJoinSchedulerText(
    message?.gameName,
    JOIN_SCHEDULER_TEXT_MAX_LENGTH,
    true
  );
  const title = normalizeJoinSchedulerText(
    message?.title,
    JOIN_SCHEDULER_TITLE_MAX_LENGTH,
    true
  );
  const startAt = normalizeJoinSchedulerTimestamp(message?.startAt);
  const rawEndAt = message?.endAt === null || message?.endAt === undefined ||
    message?.endAt === "" ? 0 : normalizeJoinSchedulerTimestamp(message.endAt);
  const endAt = rawEndAt || null;
  const eventId = message?.eventId === null || message?.eventId === undefined ||
    message?.eventId === "" ? null : normalizeGameEventId(message.eventId);
  const mode = ["notify", "auto"].includes(message?.mode)
    ? message.mode
    : null;
  const destinationType = ["public", "saved"].includes(message?.destinationType)
    ? message.destinationType
    : null;
  if (
    !universeId ||
    !placeId ||
    !gameName ||
    !title ||
    !startAt ||
    startAt <= now ||
    startAt - now > JOIN_SCHEDULER_MAX_FUTURE_MS ||
    (endAt !== null && endAt <= startAt) ||
    (message?.eventId !== null && message?.eventId !== undefined &&
      message?.eventId !== "" && !eventId) ||
    !mode ||
    !destinationType ||
    typeof message?.allowSwitch !== "boolean"
  ) {
    throw new JoinSchedulerError("INVALID", 400);
  }
  if (mode === "auto" && message?.autoJoinConsent !== true) {
    throw new JoinSchedulerError("CONSENT_REQUIRED", 400);
  }
  return {
    universeId,
    placeId,
    gameName,
    title,
    startAt,
    endAt,
    eventId,
    mode,
    allowSwitch: mode === "auto" ? message.allowSwitch : false,
    destinationType,
    destinationId: destinationType === "saved"
      ? normalizeJoinSchedulerRecordId(message?.destinationId, "d")
      : null
  };
}

async function createJoinSchedulerSchedule(message) {
  await assertJoinSchedulerFeatureEnabled();
  if (!await hasJoinSchedulerNotificationPermission()) {
    throw new JoinSchedulerError("NOTIFICATIONS_REQUIRED", 400);
  }
  const viewerUserId = await getJoinSchedulerViewerUserId(message, true);
  const initialNow = joinSchedulerNow();
  const input = normalizeJoinSchedulerScheduleInput(message, initialNow);
  const hasRequestedSchedule = message?.scheduleId !== undefined &&
    message?.scheduleId !== null && message?.scheduleId !== "";
  const requestedScheduleId = hasRequestedSchedule
    ? normalizeJoinSchedulerRecordId(message.scheduleId, "s")
    : null;
  const expectedRevision = hasRequestedSchedule
    ? normalizeJoinSchedulerRevision(message?.expectedRevision)
    : null;
  if (hasRequestedSchedule && (!requestedScheduleId || !expectedRevision)) {
    throw new JoinSchedulerError("INVALID", 400);
  }
  if (input.eventId) await revalidateJoinSchedulerEvent(input, initialNow);
  await assertJoinSchedulerFeatureEnabled(true);
  if (!await hasJoinSchedulerNotificationPermission()) {
    throw new JoinSchedulerError("NOTIFICATIONS_REQUIRED", 400);
  }
  await getJoinSchedulerViewerUserId({ viewerUserId }, true);
  const armNow = joinSchedulerNow();
  if (
    input.startAt <= armNow ||
    input.startAt - armNow > JOIN_SCHEDULER_MAX_FUTURE_MS
  ) {
    throw new JoinSchedulerError("NOT_ACTIONABLE", 409);
  }
  const permissionGeneration = joinSchedulerPermissionGeneration;
  const outcome = await mutateJoinSchedulerStorage((snapshot) => {
    if (permissionGeneration !== joinSchedulerPermissionGeneration) {
      throw new JoinSchedulerError("NOTIFICATIONS_REQUIRED", 400);
    }
    const commitNow = joinSchedulerNow();
    if (
      input.startAt <= commitNow ||
      input.startAt - commitNow > JOIN_SCHEDULER_MAX_FUTURE_MS
    ) {
      throw new JoinSchedulerError("NOT_ACTIONABLE", 409);
    }
    const meta = getJoinSchedulerAccountMeta(
      snapshot,
      viewerUserId,
      commitNow,
      true
    );
    if (!joinSchedulerFeatureEnabled || meta.enabled === false) {
      throw new JoinSchedulerError("DISABLED");
    }
    let destination;
    if (input.destinationType === "saved") {
      if (!input.destinationId) throw new JoinSchedulerError("INVALID", 400);
      destination = snapshot.destinations.find((record) =>
        record.accountId === viewerUserId && record.id === input.destinationId
      );
      if (!destination) throw new JoinSchedulerError("DESTINATION_NOT_FOUND", 404);
      if (destination.universeId !== input.universeId) {
        throw new JoinSchedulerError("DESTINATION_GAME_MISMATCH", 409);
      }
    } else {
      destination = getOrCreateJoinSchedulerPublicDestination(
        snapshot,
        viewerUserId,
        input,
        commitNow
      );
    }
    let existing = null;
    if (requestedScheduleId) {
      existing = snapshot.schedules.find((record) =>
        record.accountId === viewerUserId && record.id === requestedScheduleId
      );
      if (!existing) throw new JoinSchedulerError("SCHEDULE_NOT_FOUND", 404);
      if (existing.status !== "pending") {
        throw new JoinSchedulerError("SCHEDULE_NOT_EDITABLE", 409);
      }
      if (existing.revision !== expectedRevision) {
        throw new JoinSchedulerError("SCHEDULE_CHANGED", 409);
      }
    } else if (snapshot.schedules.filter((record) =>
      record.accountId === viewerUserId
    ).length >= JOIN_SCHEDULER_MAX_SCHEDULES) {
      throw new JoinSchedulerError("SCHEDULE_LIMIT_REACHED", 400);
    }
    const id = existing?.id || createJoinSchedulerRecordId("s");
    const previousRevision = existing?.revision || null;
    const previousDestinationId = existing?.destinationId || null;
    const revision = existing ? existing.revision + 1 : 1;
    if (!normalizeJoinSchedulerRevision(revision)) {
      throw new JoinSchedulerError("SCHEDULE_NOT_EDITABLE", 409);
    }
    const record = {
      recordVersion: JOIN_SCHEDULER_RECORD_VERSION,
      key: `${viewerUserId}:${id}`,
      accountId: viewerUserId,
      id,
      universeId: input.universeId,
      placeId: input.placeId,
      destinationId: destination.id,
      gameName: input.gameName,
      title: input.title,
      startAt: input.startAt,
      endAt: input.endAt,
      eventId: input.eventId,
      mode: input.mode,
      revision,
      allowSwitch: input.allowSwitch,
      status: "pending",
      consentVersion: input.mode === "auto" ? JOIN_SCHEDULER_CONSENT_VERSION : 0,
      consentedAt: input.mode === "auto" ? commitNow : 0,
      notifiedAt: 0,
      claimedAt: 0,
      completedAt: 0,
      resultCode: null,
      createdAt: existing?.createdAt || commitNow,
      updatedAt: commitNow
    };
    if (existing) Object.assign(existing, record);
    else snapshot.schedules.push(record);
    if (previousDestinationId) {
      pruneJoinSchedulerOrphanPublicDestinations(
        snapshot,
        viewerUserId,
        [previousDestinationId]
      );
    }
    meta.updatedAt = commitNow;
    return {
      schedule: structuredClone(record),
      previousRevision
    };
  });
  const schedule = outcome.schedule;
  if (outcome.previousRevision) {
    await clearJoinSchedulerNotification(schedule.id, outcome.previousRevision);
  }
  try {
    await assertJoinSchedulerFeatureEnabled(true);
    if (!await hasJoinSchedulerNotificationPermission()) {
      throw new JoinSchedulerError("NOTIFICATIONS_REQUIRED", 400);
    }
    await getJoinSchedulerViewerUserId({ viewerUserId }, true);
  } catch (error) {
    await cancelOwnedJoinSchedulerSchedule(
      viewerUserId,
      schedule.id,
      "arm-check-failed",
      schedule.revision
    );
    throw error;
  }
  await ensureJoinSchedulerCoordinatorAlarm();
  return {
    ok: true,
    requestId: normalizeJoinSchedulerRequestId(message?.requestId) || 0,
    viewerUserId,
    schedule: sanitizeJoinSchedulerSchedule(schedule)
  };
}

async function cancelJoinSchedulerSchedule(message) {
  await assertJoinSchedulerFeatureEnabled();
  const viewerUserId = await getJoinSchedulerViewerUserId(message, true);
  const scheduleId = normalizeJoinSchedulerRecordId(message?.scheduleId, "s");
  const expectedRevision = normalizeJoinSchedulerRevision(
    message?.expectedRevision
  );
  if (!scheduleId || !expectedRevision) {
    throw new JoinSchedulerError("INVALID", 400);
  }
  const canceled = await cancelOwnedJoinSchedulerSchedule(
    viewerUserId,
    scheduleId,
    "canceled",
    expectedRevision
  );
  return {
    ok: true,
    requestId: normalizeJoinSchedulerRequestId(message?.requestId) || 0,
    viewerUserId,
    scheduleId,
    canceled
  };
}

async function cancelOwnedJoinSchedulerSchedule(
  viewerUserId,
  scheduleId,
  reason = "canceled",
  expectedRevision = null
) {
  const now = joinSchedulerNow();
  const canceled = await mutateJoinSchedulerStorage((snapshot) => {
    const schedule = snapshot.schedules.find((record) =>
      record.accountId === viewerUserId && record.id === scheduleId
    );
    if (!schedule) throw new JoinSchedulerError("SCHEDULE_NOT_FOUND", 404);
    if (expectedRevision !== null && schedule.revision !== expectedRevision) {
      throw new JoinSchedulerError("SCHEDULE_CHANGED", 409);
    }
    if (["pending", "claimed"].includes(schedule.status)) {
      schedule.status = "canceled";
      schedule.resultCode = normalizeJoinSchedulerResultCode(reason) || "canceled";
      schedule.completedAt = now;
      schedule.updatedAt = now;
      return true;
    }
    return false;
  });
  await clearJoinSchedulerNotification(scheduleId, expectedRevision);
  await ensureJoinSchedulerCoordinatorAlarm();
  return canceled;
}

async function deleteOwnedJoinSchedulerSchedule(
  viewerUserId,
  scheduleId,
  expectedRevision
) {
  const removed = await mutateJoinSchedulerStorage((snapshot) => {
    const index = snapshot.schedules.findIndex((record) =>
      record.accountId === viewerUserId && record.id === scheduleId
    );
    if (index < 0) return false;
    if (snapshot.schedules[index].revision !== expectedRevision) {
      throw new JoinSchedulerError("SCHEDULE_CHANGED", 409);
    }
    const destinationId = snapshot.schedules[index].destinationId;
    snapshot.schedules.splice(index, 1);
    pruneJoinSchedulerOrphanPublicDestinations(
      snapshot,
      viewerUserId,
      [destinationId]
    );
    return true;
  });
  await clearJoinSchedulerNotification(scheduleId, expectedRevision);
  await ensureJoinSchedulerCoordinatorAlarm();
  return removed;
}

async function deleteJoinSchedulerSchedule(message) {
  const viewerUserId = await getJoinSchedulerViewerUserId(message, true);
  const scheduleId = normalizeJoinSchedulerRecordId(message?.scheduleId, "s");
  const expectedRevision = normalizeJoinSchedulerRevision(
    message?.expectedRevision
  );
  if (!scheduleId || !expectedRevision) {
    throw new JoinSchedulerError("INVALID", 400);
  }
  const removed = await deleteOwnedJoinSchedulerSchedule(
    viewerUserId,
    scheduleId,
    expectedRevision
  );
  return {
    ok: true,
    requestId: normalizeJoinSchedulerRequestId(message?.requestId) || 0,
    viewerUserId,
    scheduleId,
    removed
  };
}

async function deleteJoinSchedulerDestination(message) {
  const viewerUserId = await getJoinSchedulerViewerUserId(message, true);
  const destinationId = normalizeJoinSchedulerRecordId(message?.destinationId, "d");
  if (!destinationId) throw new JoinSchedulerError("INVALID", 400);
  const now = joinSchedulerNow();
  const result = await mutateJoinSchedulerStorage((snapshot) => {
    const index = snapshot.destinations.findIndex((record) =>
      record.accountId === viewerUserId && record.id === destinationId
    );
    if (index < 0) return { removed: false, canceledScheduleIds: [] };
    snapshot.destinations.splice(index, 1);
    const canceledScheduleIds = [];
    for (const schedule of snapshot.schedules) {
      if (
        schedule.accountId === viewerUserId &&
        schedule.destinationId === destinationId &&
        ["pending", "claimed"].includes(schedule.status)
      ) {
        schedule.status = "canceled";
        schedule.resultCode = "destination-removed";
        schedule.completedAt = now;
        schedule.updatedAt = now;
        canceledScheduleIds.push(schedule.id);
      }
    }
    return { removed: true, canceledScheduleIds };
  });
  await Promise.all(result.canceledScheduleIds.map(clearJoinSchedulerNotification));
  await ensureJoinSchedulerCoordinatorAlarm();
  return {
    ok: true,
    requestId: normalizeJoinSchedulerRequestId(message?.requestId) || 0,
    viewerUserId,
    destinationId,
    removed: result.removed,
    canceledSchedules: result.canceledScheduleIds.length
  };
}

async function setJoinSchedulerAccountEnabled(message) {
  await assertJoinSchedulerFeatureEnabled();
  if (typeof message?.enabled !== "boolean") {
    throw new JoinSchedulerError("INVALID", 400);
  }
  const viewerUserId = await getJoinSchedulerViewerUserId(message, true);
  const now = joinSchedulerNow();
  const canceledIds = await mutateJoinSchedulerStorage((snapshot) => {
    const meta = getJoinSchedulerAccountMeta(snapshot, viewerUserId, now, true);
    meta.enabled = message.enabled;
    meta.updatedAt = now;
    const ids = [];
    if (!message.enabled) {
      for (const schedule of snapshot.schedules) {
        if (schedule.accountId === viewerUserId &&
          ["pending", "claimed"].includes(schedule.status)) {
          schedule.status = "canceled";
          schedule.resultCode = "account-disabled";
          schedule.completedAt = now;
          schedule.updatedAt = now;
          ids.push(schedule.id);
        }
      }
    }
    return ids;
  });
  await Promise.all(canceledIds.map(clearJoinSchedulerNotification));
  await ensureJoinSchedulerCoordinatorAlarm();
  return {
    ok: true,
    requestId: normalizeJoinSchedulerRequestId(message?.requestId) || 0,
    viewerUserId,
    enabled: message.enabled,
    canceledSchedules: canceledIds.length
  };
}

function getJoinSchedulerNotificationId(scheduleId, revision = 1) {
  const normalizedScheduleId = normalizeJoinSchedulerRecordId(scheduleId, "s");
  const normalizedRevision = normalizeJoinSchedulerRevision(revision);
  if (!normalizedScheduleId || !normalizedRevision) return null;
  return `${JOIN_SCHEDULER_NOTIFICATION_PREFIX}${normalizedScheduleId}:r${normalizedRevision}`;
}

async function clearJoinSchedulerNotification(scheduleId, revision = null) {
  const normalizedScheduleId = normalizeJoinSchedulerRecordId(scheduleId, "s");
  const normalizedRevision = revision === null
    ? null
    : normalizeJoinSchedulerRevision(revision);
  if (!normalizedScheduleId || (revision !== null && !normalizedRevision)) {
    return false;
  }
  if (typeof joinSchedulerRuntimeOverrides?.clearNotification === "function") {
    return joinSchedulerRuntimeOverrides.clearNotification(
      normalizedScheduleId,
      normalizedRevision
    );
  }
  if (!chrome.notifications?.clear) return false;
  const clearOne = async (notificationId) => {
    try {
      return await chrome.notifications.clear(notificationId);
    } catch {
      return false;
    }
  };
  if (normalizedRevision) {
    return clearOne(getJoinSchedulerNotificationId(
      normalizedScheduleId,
      normalizedRevision
    ));
  }
  try {
    if (typeof chrome.notifications.getAll === "function") {
      const all = await chrome.notifications.getAll();
      const prefix = `${JOIN_SCHEDULER_NOTIFICATION_PREFIX}${normalizedScheduleId}:r`;
      const matching = Object.keys(all || {}).filter((id) => id.startsWith(prefix));
      const cleared = await Promise.all(matching.map(clearOne));
      await clearOne(`${JOIN_SCHEDULER_NOTIFICATION_PREFIX}${normalizedScheduleId}`);
      return cleared.some(Boolean);
    }
    return clearOne(`${JOIN_SCHEDULER_NOTIFICATION_PREFIX}${normalizedScheduleId}`);
  } catch {
    return false;
  }
}

function settleJoinSchedulerGameIconBeforeDeadline(promise, deadlineAt) {
  const remainingMs = Math.max(0, deadlineAt - Date.now());
  if (remainingMs <= 0) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve(value ?? null);
    };
    const timeoutId = setTimeout(() => finish(null), remainingMs);
    Promise.resolve(promise).then(finish, () => finish(null));
  });
}

async function readJoinSchedulerGameIconBytes(response) {
  const rawContentLength = response?.headers?.get?.("content-length") || "";
  if (rawContentLength && !/^\d+$/.test(rawContentLength)) return null;
  const contentLength = rawContentLength ? Number(rawContentLength) : 0;
  if (
    !Number.isSafeInteger(contentLength) ||
    contentLength > JOIN_SCHEDULER_GAME_ICON_RESPONSE_MAX_BYTES
  ) {
    return null;
  }
  if (typeof response?.body?.getReader === "function") {
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!(value instanceof Uint8Array)) return null;
        total += value.byteLength;
        if (total > JOIN_SCHEDULER_GAME_ICON_RESPONSE_MAX_BYTES) {
          await reader.cancel().catch(() => undefined);
          return null;
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock?.();
    }
    if (total === 0) return null;
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  }
  if (typeof response?.arrayBuffer !== "function") return null;
  const buffer = await response.arrayBuffer();
  if (
    !(buffer instanceof ArrayBuffer) ||
    buffer.byteLength === 0 ||
    buffer.byteLength > JOIN_SCHEDULER_GAME_ICON_RESPONSE_MAX_BYTES
  ) {
    return null;
  }
  return new Uint8Array(buffer);
}

function isJoinSchedulerGameIconSignature(bytes, mimeType) {
  if (!(bytes instanceof Uint8Array)) return false;
  if (mimeType === "image/png") {
    return bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
      bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a &&
      bytes[6] === 0x1a && bytes[7] === 0x0a;
  }
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 &&
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/webp") {
    return bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 &&
      bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 &&
      bytes[10] === 0x42 && bytes[11] === 0x50;
  }
  return false;
}

function encodeJoinSchedulerGameIconDataUrl(bytes, mimeType) {
  let encoded = "";
  if (typeof globalThis.btoa === "function") {
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    encoded = globalThis.btoa(binary);
  } else {
    const alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for (let index = 0; index < bytes.length; index += 3) {
      const first = bytes[index];
      const hasSecond = index + 1 < bytes.length;
      const hasThird = index + 2 < bytes.length;
      const second = hasSecond ? bytes[index + 1] : 0;
      const third = hasThird ? bytes[index + 2] : 0;
      encoded += alphabet[first >> 2];
      encoded += alphabet[((first & 0x03) << 4) | (second >> 4)];
      encoded += hasSecond
        ? alphabet[((second & 0x0f) << 2) | (third >> 6)]
        : "=";
      encoded += hasThird ? alphabet[third & 0x3f] : "=";
    }
  }
  return `data:${mimeType};base64,${encoded}`;
}

async function fetchJoinSchedulerNotificationGameIconDataUrl(
  rawThumbnailUrl,
  deadlineAt
) {
  const thumbnailUrl = normalizeJoinSchedulerGameIconUrl(rawThumbnailUrl);
  const remainingMs = Math.max(0, deadlineAt - Date.now());
  if (!thumbnailUrl || remainingMs <= 0) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), remainingMs);
  try {
    const response = await fetch(thumbnailUrl, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      headers: { Accept: "image/png,image/jpeg,image/webp" },
      signal: controller.signal
    });
    const responseUrl = normalizeJoinSchedulerGameIconUrl(response?.url);
    if (!response?.ok || responseUrl !== thumbnailUrl) return null;
    const mimeType = String(
      response.headers?.get?.("content-type") || ""
    ).split(";", 1)[0].trim().toLowerCase();
    if (!new Set(["image/png", "image/jpeg", "image/webp"]).has(mimeType)) {
      return null;
    }
    const bytes = await readJoinSchedulerGameIconBytes(response);
    if (!isJoinSchedulerGameIconSignature(bytes, mimeType)) return null;
    return encodeJoinSchedulerGameIconDataUrl(bytes, mimeType);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getJoinSchedulerNotificationGameIconDataUrl(rawUniverseId) {
  const universeId = normalizeId(rawUniverseId);
  if (!universeId) return null;
  const now = Date.now();
  const cached = getFreshJoinSchedulerGameIconCacheEntry(
    joinSchedulerNotificationIconCache,
    universeId,
    now
  );
  if (cached) return cached.promise;
  const entry = {
    expiresAt: now + JOIN_SCHEDULER_GAME_ICON_NOTIFICATION_CACHE_TTL_MS,
    promise: null
  };
  entry.promise = (async () => {
    const deadlineAt = Date.now() +
      JOIN_SCHEDULER_GAME_ICON_NOTIFICATION_DEADLINE_MS;
    const thumbnailUrl = await settleJoinSchedulerGameIconBeforeDeadline(
      getJoinSchedulerGameIconUrl(universeId),
      deadlineAt
    );
    if (!thumbnailUrl) return null;
    return settleJoinSchedulerGameIconBeforeDeadline(
      fetchJoinSchedulerNotificationGameIconDataUrl(thumbnailUrl, deadlineAt),
      deadlineAt
    );
  })().catch(() => null).then((dataUrl) => {
    entry.expiresAt = Date.now() + (dataUrl
      ? JOIN_SCHEDULER_GAME_ICON_NOTIFICATION_CACHE_TTL_MS
      : JOIN_SCHEDULER_GAME_ICON_NOTIFICATION_FAILURE_CACHE_TTL_MS);
    return dataUrl;
  });
  joinSchedulerNotificationIconCache.set(universeId, entry);
  pruneJoinSchedulerGameIconCache(
    joinSchedulerNotificationIconCache,
    JOIN_SCHEDULER_GAME_ICON_NOTIFICATION_CACHE_MAX_ENTRIES,
    now
  );
  return entry.promise;
}

async function createJoinSchedulerNotification(schedule, message = null) {
  if (!await hasJoinSchedulerNotificationPermission()) {
    throw new JoinSchedulerError("NOTIFICATIONS_REQUIRED");
  }
  if (typeof joinSchedulerRuntimeOverrides?.createNotification === "function") {
    return joinSchedulerRuntimeOverrides.createNotification(
      sanitizeJoinSchedulerSchedule(schedule),
      message
    );
  }
  const when = new Date(schedule.startAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
  const notificationId = getJoinSchedulerNotificationId(
    schedule.id,
    schedule.revision
  );
  const iconUrl = await getJoinSchedulerNotificationGameIconDataUrl(
    schedule.universeId
  ).catch(() => null) || chrome.runtime.getURL("icons/rotool-128.png");
  if (!await hasJoinSchedulerNotificationAuthority(schedule.accountId)) {
    throw new JoinSchedulerError("ACCOUNT_CHANGED", 409);
  }
  await chrome.notifications.create(notificationId, {
    type: "basic",
    iconUrl,
    title: `Join ${schedule.gameName}`,
    message: message || `${schedule.title} starts at ${when}.`,
    priority: 2,
    requireInteraction: true,
    buttons: [{ title: "Join now" }, { title: "Remove" }]
  });
  return notificationId;
}

async function clearJoinSchedulerAlarm() {
  if (typeof joinSchedulerRuntimeOverrides?.clearAlarm === "function") {
    return joinSchedulerRuntimeOverrides.clearAlarm();
  }
  if (!chrome.alarms?.clear) return false;
  try {
    return await chrome.alarms.clear(JOIN_SCHEDULER_ALARM_NAME);
  } catch {
    return false;
  }
}

async function ensureJoinSchedulerCoordinatorAlarm(now = joinSchedulerNow()) {
  await joinSchedulerStorageWriteTail.catch(() => undefined);
  if (!joinSchedulerFeatureEnabled ||
    (!chrome.alarms?.create &&
      typeof joinSchedulerRuntimeOverrides?.createAlarm !== "function")) {
    await clearJoinSchedulerAlarm();
    return null;
  }
  const snapshot = await readJoinSchedulerSnapshot();
  let nextAt = Infinity;
  for (const schedule of snapshot.schedules) {
    if (schedule.status !== "pending") continue;
    const meta = getJoinSchedulerAccountMeta(snapshot, schedule.accountId, now);
    if (meta?.enabled === false) continue;
    let candidate;
    if (!schedule.notifiedAt) {
      candidate = schedule.startAt - JOIN_SCHEDULER_NOTIFICATION_LEAD_MS;
    } else if (schedule.mode === "auto") {
      candidate = schedule.startAt;
    } else {
      candidate = schedule.startAt + JOIN_SCHEDULER_LATE_GRACE_MS;
    }
    nextAt = Math.min(nextAt, Math.max(now + 100, candidate));
  }
  if (!Number.isFinite(nextAt)) {
    await clearJoinSchedulerAlarm();
    return null;
  }
  if (typeof joinSchedulerRuntimeOverrides?.createAlarm === "function") {
    await joinSchedulerRuntimeOverrides.createAlarm(nextAt);
  } else {
    chrome.alarms.create(JOIN_SCHEDULER_ALARM_NAME, { when: nextAt });
  }
  return nextAt;
}

async function getJoinSchedulerRobloxTab(placeId) {
  if (typeof joinSchedulerRuntimeOverrides?.getRobloxTab === "function") {
    return joinSchedulerRuntimeOverrides.getRobloxTab(placeId);
  }
  if (!chrome.tabs?.query) return null;
  let tabs = [];
  try {
    tabs = await runJoinSchedulerBrowserApi(() =>
      chrome.tabs.query({ url: "https://www.roblox.com/*" })
    );
  } catch {
    tabs = [];
  }
  const candidates = (Array.isArray(tabs) ? tabs : []).filter((tab) =>
    isSafeJoinSchedulerRobloxTab(tab)
  );
  const existing = candidates.find((tab) => tab.active) || candidates[0];
  if (existing) return existing;
  try {
    const created = await createJoinSchedulerRobloxTabInNormalWindow(
      `https://www.roblox.com/games/${encodeURIComponent(placeId)}`
    );
    if (!isSafeJoinSchedulerRobloxTab(created)) return null;
    if (created.status === "complete" || !chrome.tabs?.onUpdated?.addListener) {
      return created;
    }
    await new Promise((resolve) => {
      let settled = false;
      let timeoutId = null;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (timeoutId !== null) clearTimeout(timeoutId);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        chrome.tabs.onRemoved?.removeListener?.(onRemoved);
        resolve();
      };
      const onUpdated = (tabId, changeInfo) => {
        if (tabId === created.id && changeInfo?.status === "complete") finish();
      };
      const onRemoved = (tabId) => {
        if (tabId === created.id) finish();
      };
      chrome.tabs.onUpdated.addListener(onUpdated);
      chrome.tabs.onRemoved?.addListener?.(onRemoved);
      timeoutId = setTimeout(finish, 12_000);
    });
    return created;
  } catch {
    return null;
  }
}

async function getTrustedJoinSchedulerLaunchTab(tabId) {
  if (
    !Number.isSafeInteger(tabId) ||
    tabId < 0 ||
    typeof chrome.tabs?.get !== "function"
  ) {
    return null;
  }
  try {
    const tab = await runJoinSchedulerBrowserApi(() => chrome.tabs.get(tabId));
    return isSafeJoinSchedulerRobloxTab(tab) ? tab : null;
  } catch {
    return null;
  }
}

async function executeJoinSchedulerPublicJoin(tabId, placeId) {
  if (typeof chrome.scripting?.executeScript !== "function") return "unavailable";
  if (!await getTrustedJoinSchedulerLaunchTab(tabId)) return "unavailable";
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      world: "MAIN",
      args: [Number(placeId)],
      func: async (numericPlaceId) => {
        const launcher = globalThis.Roblox?.GameLauncher;
        if (typeof launcher?.joinMultiplayerGame === "function") {
          try {
            const result = Reflect.apply(launcher.joinMultiplayerGame, launcher, [
              numericPlaceId
            ]);
            if (result && typeof result.then === "function") await result;
            return "started";
          } catch {
            return "failed";
          }
        }
        try {
          const assign = globalThis.location?.assign;
          if (typeof assign !== "function") return "unavailable";
          Reflect.apply(assign, globalThis.location, [
            `roblox://experiences/start?placeId=${numericPlaceId}`
          ]);
          return "started";
        } catch {
          return "failed";
        }
      }
    });
    const result = Array.isArray(results)
      ? results.find((entry) => entry?.frameId === 0)?.result
      : null;
    return ["started", "unavailable", "failed"].includes(result)
      ? result
      : "failed";
  } catch {
    return "failed";
  }
}

async function executeJoinSchedulerPrivateLegacyJoin(tabId, placeId, secret) {
  if (!await getTrustedJoinSchedulerLaunchTab(tabId)) return "unavailable";
  return executePrivateServerJoin(tabId, placeId, secret);
}

async function prepareJoinSchedulerDestinationLaunch(destination) {
  const normalized = normalizeJoinSchedulerDestinationRecord(destination);
  if (!normalized) throw new JoinSchedulerError("DESTINATION_UNAVAILABLE");
  if (typeof joinSchedulerRuntimeOverrides?.launchDestination === "function") {
    return { kind: "override", destination: normalized };
  }
  if (normalized.type === "private-share") {
    return { kind: "private-share", destination: normalized };
  }
  const tab = await getJoinSchedulerRobloxTab(normalized.placeId);
  if (!Number.isSafeInteger(tab?.id)) {
    return { kind: "unavailable", destination: normalized };
  }
  return { kind: normalized.type, destination: normalized, tabId: tab.id };
}

function executePreparedJoinSchedulerDestination(prepared) {
  try {
    if (prepared?.kind === "override") {
      return Promise.resolve(joinSchedulerRuntimeOverrides.launchDestination(
        structuredClone(prepared.destination)
      ));
    }
    if (prepared?.kind === "private-share") {
      return createJoinSchedulerRobloxTabInNormalWindow(
        `https://www.roblox.com/share?code=${encodeURIComponent(prepared.destination.secret)}&type=Server`,
        { requireKnownNormalWindow: true }
      ).then((tab) => isSafeJoinSchedulerRobloxTab(tab) ? "started" : "failed", () => "failed");
    }
    if (prepared?.kind === "private-legacy") {
      return executeJoinSchedulerPrivateLegacyJoin(
        prepared.tabId,
        prepared.destination.placeId,
        prepared.destination.secret
      );
    }
    if (prepared?.kind === "public") {
      return executeJoinSchedulerPublicJoin(
        prepared.tabId,
        prepared.destination.placeId
      );
    }
    return Promise.resolve("unavailable");
  } catch {
    return Promise.resolve("failed");
  }
}

async function launchJoinSchedulerDestination(destination) {
  const prepared = await prepareJoinSchedulerDestinationLaunch(destination);
  return executePreparedJoinSchedulerDestination(prepared);
}

async function getJoinSchedulerPresence(viewerUserId) {
  if (typeof joinSchedulerRuntimeOverrides?.getPresence === "function") {
    return joinSchedulerRuntimeOverrides.getPresence(viewerUserId);
  }
  return fetchServerHistoryPresence(viewerUserId);
}

async function assertJoinSchedulerDestinationFresh(destination) {
  const normalized = normalizeJoinSchedulerDestinationRecord(destination);
  if (!normalized) throw new JoinSchedulerError("DESTINATION_UNAVAILABLE");
  if (normalized.type === "private-legacy") {
    try {
      const universeId = await resolveGameEventsUniverseIdFromPlace(
        normalized.placeId
      );
      if (universeId !== normalized.universeId) {
        throw new JoinSchedulerError("DESTINATION_GAME_MISMATCH");
      }
    } catch (error) {
      if (error instanceof JoinSchedulerError) throw error;
      throw new JoinSchedulerError("DESTINATION_UNAVAILABLE");
    }
  } else if (normalized.type === "private-share" && normalized.verified) {
    const parsed = {
      type: normalized.type,
      secret: normalized.secret,
      canonicalUrl: `https://www.roblox.com/share?code=${encodeURIComponent(normalized.secret)}&type=Server`
    };
    try {
      const resolved = await resolveJoinSchedulerModernDestination(parsed);
      if (resolved.universeId !== normalized.universeId) {
        throw new JoinSchedulerError("DESTINATION_GAME_MISMATCH");
      }
    } catch (error) {
      if (error instanceof JoinSchedulerError &&
        error.code === "DESTINATION_GAME_MISMATCH") throw error;
      throw new JoinSchedulerError("DESTINATION_UNAVAILABLE");
    }
  }
  return normalized;
}

async function finalizeJoinSchedulerSchedule(
  accountId,
  scheduleId,
  expectedRevision,
  expectedClaimedAt,
  status,
  resultCode,
  now = joinSchedulerNow()
) {
  return mutateJoinSchedulerStorage((snapshot) => {
    const schedule = snapshot.schedules.find((record) =>
      record.accountId === accountId && record.id === scheduleId
    );
    if (
      !schedule ||
      schedule.status !== "claimed" ||
      schedule.revision !== expectedRevision ||
      schedule.claimedAt !== expectedClaimedAt
    ) return null;
    schedule.status = status;
    schedule.resultCode = normalizeJoinSchedulerResultCode(resultCode) || "failed";
    schedule.completedAt = now;
    schedule.updatedAt = now;
    return schedule;
  });
}

async function claimJoinSchedulerSchedule(
  accountId,
  scheduleId,
  automatic,
  expectedRevision,
  expectedPermissionGeneration = joinSchedulerPermissionGeneration
) {
  return mutateJoinSchedulerStorage((snapshot) => {
    const now = joinSchedulerNow();
    const schedule = snapshot.schedules.find((record) =>
      record.accountId === accountId && record.id === scheduleId
    );
    const allowedStatuses = automatic
      ? ["pending"]
      : ["pending", "failed", "missed"];
    if (!schedule || !allowedStatuses.includes(schedule.status)) {
      return { code: "not-actionable", schedule: null, destination: null };
    }
    if (schedule.revision !== expectedRevision) {
      return { code: "schedule-changed", schedule: null, destination: null };
    }
    const accountMeta = getJoinSchedulerAccountMeta(snapshot, accountId, now);
    if (!joinSchedulerFeatureEnabled || accountMeta?.enabled === false) {
      return { code: "disabled", schedule: null, destination: null };
    }
    if (automatic &&
      expectedPermissionGeneration !== joinSchedulerPermissionGeneration) {
      schedule.status = "canceled";
      schedule.resultCode = "notifications-permission-removed";
      schedule.completedAt = now;
      schedule.updatedAt = now;
      return { code: "notifications-permission-removed", schedule, destination: null };
    }
    if (automatic && (
      schedule.mode !== "auto" ||
      schedule.consentVersion !== JOIN_SCHEDULER_CONSENT_VERSION ||
      !schedule.consentedAt
    )) {
      schedule.status = "failed";
      schedule.resultCode = "consent-required";
      schedule.completedAt = now;
      schedule.updatedAt = now;
      return { code: "consent-required", schedule, destination: null };
    }
    if (automatic && now < schedule.startAt) {
      return { code: "not-due", schedule: null, destination: null };
    }
    if (automatic && now - schedule.startAt > JOIN_SCHEDULER_LATE_GRACE_MS) {
      schedule.status = "missed";
      schedule.resultCode = "missed";
      schedule.completedAt = now;
      schedule.updatedAt = now;
      return { code: "missed", schedule, destination: null };
    }
    const destination = snapshot.destinations.find((record) =>
      record.accountId === accountId && record.id === schedule.destinationId
    );
    if (!destination) {
      schedule.status = "failed";
      schedule.resultCode = "destination-missing";
      schedule.completedAt = now;
      schedule.updatedAt = now;
      return { code: "destination-missing", schedule, destination: null };
    }
    if (automatic) {
      const globalMeta = getJoinSchedulerGlobalMeta(snapshot, true);
      if (
        globalMeta.lastAutoAttemptAt &&
        globalMeta.lastAutoAttemptAt <= now &&
        now - globalMeta.lastAutoAttemptAt < JOIN_SCHEDULER_AUTO_COLLISION_MS &&
        schedule.consentedAt < globalMeta.lastAutoAttemptAt
      ) {
        schedule.status = "failed";
        schedule.resultCode = "collision";
        schedule.completedAt = now;
        schedule.updatedAt = now;
        return { code: "collision", schedule, destination };
      }
      globalMeta.lastAutoAttemptAt = now;
    }
    schedule.status = "claimed";
    schedule.claimedAt = now;
    schedule.completedAt = 0;
    schedule.resultCode = null;
    schedule.updatedAt = now;
    return {
      code: "claimed",
      schedule: structuredClone(schedule),
      destination: structuredClone(destination)
    };
  });
}

function joinSchedulerDestinationsMatch(left, right) {
  if (!left || !right) return false;
  return [
    "key",
    "accountId",
    "id",
    "universeId",
    "placeId",
    "gameName",
    "label",
    "type",
    "secret",
    "verified",
    "confirmedUnverified",
    "createdAt",
    "updatedAt"
  ].every((field) => left[field] === right[field]);
}

async function authorizeJoinSchedulerLaunch(
  accountId,
  scheduleId,
  claim,
  automatic,
  expectedPermissionGeneration
) {
  return mutateJoinSchedulerStorage((snapshot) => {
    const now = joinSchedulerNow();
    const schedule = snapshot.schedules.find((record) =>
      record.accountId === accountId && record.id === scheduleId
    );
    if (!schedule || schedule.status !== "claimed") {
      return { code: "canceled-before-launch", schedule: null, destination: null };
    }
    if (
      schedule.revision !== claim.schedule.revision ||
      schedule.claimedAt !== claim.schedule.claimedAt ||
      schedule.destinationId !== claim.schedule.destinationId
    ) {
      return { code: "schedule-changed", schedule: null, destination: null };
    }
    const fail = (status, code) => {
      schedule.status = status;
      schedule.resultCode = code;
      schedule.completedAt = now;
      schedule.updatedAt = now;
      return { code, schedule: structuredClone(schedule), destination: null };
    };
    const accountMeta = getJoinSchedulerAccountMeta(snapshot, accountId, now);
    if (!joinSchedulerFeatureEnabled || accountMeta?.enabled === false) {
      return fail("canceled", "disabled");
    }
    if (automatic &&
      expectedPermissionGeneration !== joinSchedulerPermissionGeneration) {
      return fail("canceled", "notifications-permission-removed");
    }
    if (automatic && (
      schedule.mode !== "auto" ||
      schedule.consentVersion !== JOIN_SCHEDULER_CONSENT_VERSION ||
      !schedule.consentedAt
    )) {
      return fail("failed", "consent-required");
    }
    if (automatic && now < schedule.startAt) {
      return fail("failed", "not-due");
    }
    if (automatic && now - schedule.startAt > JOIN_SCHEDULER_LATE_GRACE_MS) {
      return fail("missed", "missed");
    }
    const destination = snapshot.destinations.find((record) =>
      record.accountId === accountId && record.id === schedule.destinationId
    );
    if (!destination ||
      !joinSchedulerDestinationsMatch(destination, claim.destination)) {
      return fail("failed", "destination-changed");
    }
    return {
      code: "authorized",
      schedule: structuredClone(schedule),
      destination: structuredClone(destination)
    };
  });
}

async function attemptJoinSchedulerSchedule(
  accountId,
  scheduleId,
  options = {}
) {
  const automatic = options.automatic === true;
  await assertJoinSchedulerFeatureEnabled(true);
  const before = await readJoinSchedulerSnapshot();
  const schedule = before.schedules.find((record) =>
    record.accountId === accountId && record.id === scheduleId
  );
  const destination = schedule && before.destinations.find((record) =>
    record.accountId === accountId && record.id === schedule.destinationId
  );
  if (!schedule || !destination) {
    throw new JoinSchedulerError("SCHEDULE_NOT_FOUND", 404);
  }
  const expectedRevision = normalizeJoinSchedulerRevision(
    options.expectedRevision
  ) || schedule.revision;
  if (schedule.revision !== expectedRevision) {
    throw new JoinSchedulerError("SCHEDULE_CHANGED", 409);
  }
  if (automatic && !await hasJoinSchedulerNotificationPermission()) {
    throw new JoinSchedulerError("NOTIFICATIONS_REQUIRED", 400);
  }
  const permissionGeneration = joinSchedulerPermissionGeneration;
  const claim = await claimJoinSchedulerSchedule(
    accountId,
    scheduleId,
    automatic,
    expectedRevision,
    permissionGeneration
  );
  if (claim.code === "collision") {
    await createJoinSchedulerNotification(
      claim.schedule,
      "Another scheduled join just ran. Use Join now if you still want to switch."
    ).catch(() => undefined);
    return { code: "collision", schedule: claim.schedule };
  }
  if (claim.code !== "claimed") {
    if (["missed", "notifications-permission-removed"].includes(claim.code)) {
      return { code: claim.code, schedule: claim.schedule };
    }
    throw new JoinSchedulerError(claim.code.toUpperCase().replaceAll("-", "_"), 409);
  }
  let resultCode = "failed";
  try {
    await assertJoinSchedulerFeatureEnabled(true);
    await getJoinSchedulerViewerUserId({ viewerUserId: accountId }, true);
    if (claim.schedule.eventId) {
      await revalidateJoinSchedulerEvent(claim.schedule, joinSchedulerNow());
    }
    await assertJoinSchedulerDestinationFresh(claim.destination);
    const presence = await getJoinSchedulerPresence(accountId);
    let shouldLaunch = false;
    if (presence?.kind === "in-game") {
      const sameUniverse = presence.universeId
        ? presence.universeId === claim.schedule.universeId
        : presence.placeId === claim.schedule.placeId;
      if (sameUniverse) {
        resultCode = "already-in-game";
      } else if (automatic && !claim.schedule.allowSwitch) {
        resultCode = "switch-not-allowed";
      } else {
        shouldLaunch = true;
      }
    } else if (presence?.kind === "not-in-game") {
      shouldLaunch = true;
    } else {
      resultCode = "presence-unavailable";
    }
    if (shouldLaunch) {
      const prepared = await prepareJoinSchedulerDestinationLaunch(
        claim.destination
      );
      await assertJoinSchedulerFeatureEnabled(true);
      await getJoinSchedulerViewerUserId({ viewerUserId: accountId }, true);
      if (automatic && !await hasJoinSchedulerNotificationPermission()) {
        resultCode = "notifications-permission-removed";
        shouldLaunch = false;
      }
      if (shouldLaunch) {
        const authorization = await authorizeJoinSchedulerLaunch(
          accountId,
          scheduleId,
          claim,
          automatic,
          permissionGeneration
        );
        if (authorization.code !== "authorized") {
          resultCode = authorization.code;
        } else {
          resultCode = await executePreparedJoinSchedulerDestination(prepared);
        }
      }
    }
  } catch (error) {
    resultCode = normalizeJoinSchedulerResultCode(
      String(error?.code || "failed").toLowerCase().replaceAll("_", "-")
    ) || "failed";
  }
  const succeeded = ["started", "already-in-game"].includes(resultCode);
  const finalized = await finalizeJoinSchedulerSchedule(
    accountId,
    scheduleId,
    claim.schedule.revision,
    claim.schedule.claimedAt,
    succeeded ? "completed" : "failed",
    resultCode
  );
  if (succeeded) {
    await clearJoinSchedulerNotification(scheduleId, claim.schedule.revision);
  }
  return { code: resultCode, schedule: finalized || claim.schedule };
}

async function attemptJoinSchedulerDestination(accountId, destinationId) {
  await assertJoinSchedulerFeatureEnabled(true);
  await getJoinSchedulerViewerUserId({ viewerUserId: accountId }, true);
  const snapshot = await readJoinSchedulerSnapshot();
  const destination = snapshot.destinations.find((record) =>
    record.accountId === accountId && record.id === destinationId
  );
  if (!destination) throw new JoinSchedulerError("DESTINATION_NOT_FOUND", 404);
  const fresh = await assertJoinSchedulerDestinationFresh(destination);
  await getJoinSchedulerViewerUserId({ viewerUserId: accountId }, true);
  return launchJoinSchedulerDestination(fresh);
}

async function markJoinSchedulerSchedules(
  predicate,
  status,
  resultCode,
  now = joinSchedulerNow()
) {
  const ids = await mutateJoinSchedulerStorage((snapshot) => {
    const changed = [];
    for (const schedule of snapshot.schedules) {
      if (["pending", "claimed"].includes(schedule.status) && predicate(schedule)) {
        schedule.status = status;
        schedule.resultCode = resultCode;
        schedule.completedAt = now;
        schedule.updatedAt = now;
        changed.push(schedule.id);
      }
    }
    return changed;
  });
  await Promise.all(ids.map(clearJoinSchedulerNotification));
  return ids;
}

async function cancelAllJoinSchedulerSchedules(reason = "feature-disabled") {
  const ids = await markJoinSchedulerSchedules(
    () => true,
    "canceled",
    normalizeJoinSchedulerResultCode(reason) || "canceled"
  );
  await clearJoinSchedulerAlarm();
  return ids.length;
}

async function recoverInterruptedJoinSchedulerClaims() {
  return markJoinSchedulerSchedules(
    (schedule) => schedule.status === "claimed",
    "failed",
    "interrupted"
  );
}

async function reconcileJoinSchedulerLifecycle() {
  await recoverInterruptedJoinSchedulerClaims();
  return ensureJoinSchedulerCoordinatorAlarm();
}

async function runJoinSchedulerCoordinator(rawNow = null) {
  if (joinSchedulerCoordinatorPromise) return joinSchedulerCoordinatorPromise;
  joinSchedulerCoordinatorPromise = (async () => {
    const now = normalizeJoinSchedulerTimestamp(rawNow) || joinSchedulerNow();
    try {
      await assertJoinSchedulerFeatureEnabled(true);
    } catch (error) {
      if (error?.code === "DISABLED") await cancelAllJoinSchedulerSchedules();
      return { processed: 0, code: error?.code || "UNAVAILABLE" };
    }
    if (!await hasJoinSchedulerNotificationPermission()) {
      const canceled = await cancelAllJoinSchedulerSchedules(
        "notifications-permission-removed"
      );
      return { processed: canceled, code: "NOTIFICATIONS_REQUIRED" };
    }
    let activeViewerUserId = null;
    try {
      activeViewerUserId = await getJoinSchedulerViewerUserId({}, true);
    } catch {
      // Due schedules are disarmed below; they must not launch late after sign-in.
    }
    const snapshot = await readJoinSchedulerSnapshot();
    const due = snapshot.schedules
      .filter((schedule) => schedule.status === "pending" &&
        schedule.startAt - JOIN_SCHEDULER_NOTIFICATION_LEAD_MS <= now)
      .sort((left, right) => left.startAt - right.startAt ||
        left.id.localeCompare(right.id));
    let processed = 0;
    for (const stale of due) {
      const current = (await readJoinSchedulerSnapshot()).schedules.find(
        (record) => record.key === stale.key
      );
      if (!current || current.status !== "pending") continue;
      const expectedRevision = current.revision;
      const matchesPendingRevision = (schedule) =>
        schedule.key === current.key &&
        schedule.revision === expectedRevision &&
        schedule.status === "pending";
      const accountState = await readJoinSchedulerAccountState(current.accountId);
      if (!accountState.enabled) {
        await markJoinSchedulerSchedules(
          matchesPendingRevision,
          "canceled",
          "disabled",
          joinSchedulerNow()
        );
        processed += 1;
        continue;
      }
      if (!activeViewerUserId || activeViewerUserId !== current.accountId) {
        await markJoinSchedulerSchedules(
          matchesPendingRevision,
          "failed",
          "account-not-active",
          joinSchedulerNow()
        );
        processed += 1;
        continue;
      }
      if (joinSchedulerNow() - current.startAt > JOIN_SCHEDULER_LATE_GRACE_MS) {
        await markJoinSchedulerSchedules(
          matchesPendingRevision,
          "missed",
          "missed",
          joinSchedulerNow()
        );
        processed += 1;
        continue;
      }
      try {
        await revalidateJoinSchedulerEvent(current, joinSchedulerNow());
      } catch (error) {
        await markJoinSchedulerSchedules(
          matchesPendingRevision,
          "failed",
          error?.code === "EVENT_CHANGED" ? "event-changed" : "event-unavailable",
          joinSchedulerNow()
        );
        processed += 1;
        continue;
      }
      if (!current.notifiedAt) {
        let notificationCreated = false;
        try {
          if (!await hasJoinSchedulerNotificationAuthority(current.accountId)) {
            await clearJoinSchedulerNotification(current.id, expectedRevision);
            continue;
          }
          await createJoinSchedulerNotification(current);
          notificationCreated = true;
          if (!await hasJoinSchedulerNotificationAuthority(current.accountId)) {
            await clearJoinSchedulerNotification(current.id, expectedRevision);
            continue;
          }
          const recorded = await mutateJoinSchedulerStorage((nextSnapshot) => {
            const notificationNow = joinSchedulerNow();
            const record = nextSnapshot.schedules.find((entry) =>
              entry.key === current.key &&
              entry.revision === expectedRevision &&
              entry.status === "pending"
            );
            if (
              record &&
              !record.notifiedAt &&
              record.startAt - JOIN_SCHEDULER_NOTIFICATION_LEAD_MS <=
                notificationNow &&
              notificationNow - record.startAt <= JOIN_SCHEDULER_LATE_GRACE_MS
            ) {
              record.notifiedAt = notificationNow;
              record.updatedAt = notificationNow;
              return true;
            }
            return false;
          });
          if (!recorded) {
            await clearJoinSchedulerNotification(current.id, expectedRevision);
          }
        } catch {
          if (notificationCreated) {
            await clearJoinSchedulerNotification(current.id, expectedRevision);
          }
          if (!await hasJoinSchedulerNotificationAuthority(current.accountId)) {
            continue;
          }
          await markJoinSchedulerSchedules(
            matchesPendingRevision,
            "failed",
            "notification-failed",
            joinSchedulerNow()
          );
          processed += 1;
          continue;
        }
      }
      if (current.mode === "auto" && joinSchedulerNow() >= current.startAt) {
        try {
          await attemptJoinSchedulerSchedule(current.accountId, current.id, {
            automatic: true,
            expectedRevision
          });
        } catch (error) {
          if (!["SCHEDULE_CHANGED", "NOT_DUE", "NOT_ACTIONABLE"].includes(
            error?.code
          )) {
            await markJoinSchedulerSchedules(
              matchesPendingRevision,
              "failed",
              normalizeJoinSchedulerResultCode(
                String(error?.code || "failed").toLowerCase().replaceAll("_", "-")
              ) || "failed",
              joinSchedulerNow()
            );
          }
        }
        processed += 1;
      } else if (current.mode === "notify" &&
        joinSchedulerNow() >= current.startAt + JOIN_SCHEDULER_LATE_GRACE_MS) {
        await markJoinSchedulerSchedules(
          matchesPendingRevision,
          "missed",
          "missed",
          joinSchedulerNow()
        );
        processed += 1;
      }
    }
    await ensureJoinSchedulerCoordinatorAlarm(joinSchedulerNow());
    return { processed, code: "OK" };
  })().finally(() => {
    joinSchedulerCoordinatorPromise = null;
  });
  return joinSchedulerCoordinatorPromise;
}

async function getJoinSchedulerStateResponse(message) {
  if (!joinSchedulerFeatureReady) await syncJoinSchedulerFeatureFromStorage();
  const viewerUserId = await getJoinSchedulerViewerUserId(message, true);
  const state = await readJoinSchedulerAccountState(viewerUserId);
  await getJoinSchedulerViewerUserId({ viewerUserId }, true);
  return {
    ok: true,
    requestId: normalizeJoinSchedulerRequestId(message?.requestId) || 0,
    viewerUserId,
    ...state
  };
}

async function validateJoinSchedulerDestinationResponse(message) {
  await assertJoinSchedulerFeatureEnabled();
  const viewerUserId = await getJoinSchedulerViewerUserId(message, true);
  const checked = await validateJoinSchedulerDestination(message);
  await getJoinSchedulerViewerUserId({ viewerUserId }, true);
  return {
    ok: true,
    requestId: normalizeJoinSchedulerRequestId(message?.requestId) || 0,
    viewerUserId,
    destination: {
      type: checked.type,
      universeId: checked.universeId,
      placeId: checked.placeId,
      verified: checked.verified,
      requiresConfirmation: checked.requiresConfirmation,
      label: checked.label
    }
  };
}

async function joinNowJoinSchedulerResponse(message) {
  await assertJoinSchedulerFeatureEnabled();
  const viewerUserId = await getJoinSchedulerViewerUserId(message, true);
  if (message?.testOnly === true) {
    const destinationId = normalizeJoinSchedulerRecordId(
      message?.destinationId,
      "d"
    );
    if (!destinationId) throw new JoinSchedulerError("INVALID", 400);
    const code = await attemptJoinSchedulerDestination(viewerUserId, destinationId);
    return {
      ok: code === "started",
      requestId: normalizeJoinSchedulerRequestId(message?.requestId) || 0,
      viewerUserId,
      destinationId,
      code
    };
  }
  const scheduleId = normalizeJoinSchedulerRecordId(message?.scheduleId, "s");
  const expectedRevision = normalizeJoinSchedulerRevision(
    message?.expectedRevision
  );
  if (!scheduleId || !expectedRevision) {
    throw new JoinSchedulerError("INVALID", 400);
  }
  const result = await attemptJoinSchedulerSchedule(viewerUserId, scheduleId, {
    automatic: false,
    expectedRevision
  });
  await ensureJoinSchedulerCoordinatorAlarm();
  return {
    ok: ["started", "already-in-game"].includes(result.code),
    requestId: normalizeJoinSchedulerRequestId(message?.requestId) || 0,
    viewerUserId,
    scheduleId,
    code: result.code,
    schedule: result.schedule
      ? sanitizeJoinSchedulerSchedule(result.schedule)
      : null
  };
}

async function dispatchJoinSchedulerContentMessage(message) {
  const operations = new Map([
    [JOIN_SCHEDULER_MESSAGE_TYPES.getState,
      () => getJoinSchedulerStateResponse(message)],
    [JOIN_SCHEDULER_MESSAGE_TYPES.getGameIcons,
      () => getJoinSchedulerGameIconsResponse(message)],
    [JOIN_SCHEDULER_MESSAGE_TYPES.searchGames,
      () => getJoinSchedulerSearchResponse(message)],
    [JOIN_SCHEDULER_MESSAGE_TYPES.validateDestination,
      () => validateJoinSchedulerDestinationResponse(message)],
    [JOIN_SCHEDULER_MESSAGE_TYPES.saveDestination,
      () => saveJoinSchedulerDestination(message)],
    [JOIN_SCHEDULER_MESSAGE_TYPES.deleteDestination,
      () => deleteJoinSchedulerDestination(message)],
    [JOIN_SCHEDULER_MESSAGE_TYPES.createSchedule,
      () => createJoinSchedulerSchedule(message)],
    [JOIN_SCHEDULER_MESSAGE_TYPES.cancelSchedule,
      () => cancelJoinSchedulerSchedule(message)],
    [JOIN_SCHEDULER_MESSAGE_TYPES.deleteSchedule,
      () => deleteJoinSchedulerSchedule(message)],
    [JOIN_SCHEDULER_MESSAGE_TYPES.joinNow,
      () => joinNowJoinSchedulerResponse(message)],
    [JOIN_SCHEDULER_MESSAGE_TYPES.setEnabled,
      () => setJoinSchedulerAccountEnabled(message)]
  ]);
  const operation = operations.get(message?.type);
  if (!operation) throw new JoinSchedulerError("INVALID", 400);
  return operation();
}

function getJoinSchedulerErrorCode(error) {
  if (error instanceof JoinSchedulerError && typeof error.code === "string") {
    return error.code;
  }
  if (error?.status === 401) return "UNAUTHENTICATED";
  if (error?.status === 429) return "RATE_LIMITED";
  if (error?.name === "AbortError" || error instanceof TypeError) return "NETWORK";
  return "UNAVAILABLE";
}

function sendJoinSchedulerError(message, error, sendResponse) {
  const code = getJoinSchedulerErrorCode(error);
  if (["UNAUTHENTICATED", "ACCOUNT_CHANGED"].includes(code)) {
    authenticatedUserRequest = null;
  }
  sendResponse({
    ok: false,
    requestId: normalizeJoinSchedulerRequestId(message?.requestId) || 0,
    enabled: code === "DISABLED" ? false : joinSchedulerFeatureEnabled,
    code,
    viewerUserId: normalizeId(error?.details?.viewerUserId)
  });
}

function getTrustedJoinSchedulerContentTabId(sender) {
  if (sender?.id !== chrome.runtime.id || sender?.tab?.incognito === true) {
    return null;
  }
  return getTrustedRobloxTopFrameTabId(sender);
}

function handleJoinSchedulerNotificationPermissionRequest(
  message,
  sender,
  sendResponse
) {
  if (message?.type !== JOIN_SCHEDULER_MESSAGE_TYPES.requestNotificationPermission) {
    return false;
  }
  const messageKeys = message && typeof message === "object" && !Array.isArray(message)
    ? Object.keys(message).sort()
    : [];
  const hasExactMessageShape =
    messageKeys.length === 2 &&
    messageKeys[0] === "requestId" &&
    messageKeys[1] === "type";
  const requestId = normalizeJoinSchedulerRequestId(message?.requestId);
  const tabId = getTrustedJoinSchedulerContentTabId(sender);
  if (!hasExactMessageShape || requestId === null || tabId === null) {
    sendResponse({
      ok: false,
      requestId: requestId || 0,
      enabled: joinSchedulerFeatureEnabled,
      code: "INVALID"
    });
    return false;
  }
  // permissions.request must be invoked in this synchronous onMessage turn so
  // Chromium can propagate the submit button's user activation from the
  // content script. Do not insert storage reads or another awaited task here.
  if (!joinSchedulerFeatureReady) {
    sendResponse({
      ok: false,
      requestId,
      enabled: joinSchedulerFeatureEnabled,
      code: "UNAVAILABLE"
    });
    return false;
  }
  if (!joinSchedulerFeatureEnabled) {
    sendResponse({
      ok: false,
      requestId,
      enabled: false,
      code: "DISABLED"
    });
    return false;
  }
  if (typeof chrome.permissions?.request !== "function") {
    sendResponse({
      ok: false,
      requestId,
      enabled: true,
      code: "UNAVAILABLE"
    });
    return false;
  }

  let settled = false;
  const finish = (granted, code = null) => {
    if (settled) return;
    settled = true;
    const allowed = granted === true;
    sendResponse({
      ok: allowed,
      requestId,
      enabled: true,
      granted: allowed,
      ...(allowed ? {} : { code: code || "PERMISSION_DENIED" })
    });
  };
  try {
    const returned = chrome.permissions.request(
      { permissions: ["notifications"] },
      (granted) => {
        const runtimeError = chrome.runtime?.lastError;
        finish(granted, runtimeError ? "UNAVAILABLE" : null);
      }
    );
    if (returned && typeof returned.then === "function") {
      returned.then(
        (granted) => finish(granted),
        () => finish(false, "UNAVAILABLE")
      );
    }
  } catch {
    finish(false, "UNAVAILABLE");
  }
  return true;
}

function handleJoinSchedulerContentMessage(message, sender, sendResponse) {
  if (!Object.values(JOIN_SCHEDULER_MESSAGE_TYPES).includes(message?.type)) {
    return false;
  }
  const requestId = normalizeJoinSchedulerRequestId(message?.requestId);
  const tabId = getTrustedJoinSchedulerContentTabId(sender);
  if (
    requestId === null ||
    tabId === null ||
    message.type === JOIN_SCHEDULER_MESSAGE_TYPES.requestNotificationPermission
  ) {
    sendResponse({
      ok: false,
      requestId: requestId || 0,
      enabled: joinSchedulerFeatureEnabled,
      code: "INVALID"
    });
    return false;
  }
  dispatchJoinSchedulerContentMessage({ ...message, requestId })
    .then(sendResponse)
    .catch((error) => sendJoinSchedulerError(message, error, sendResponse));
  return true;
}

function parseJoinSchedulerNotificationId(notificationId) {
  if (typeof notificationId !== "string" ||
    !notificationId.startsWith(JOIN_SCHEDULER_NOTIFICATION_PREFIX)) {
    return null;
  }
  const value = notificationId.slice(JOIN_SCHEDULER_NOTIFICATION_PREFIX.length);
  const match = /^(s_[0-9a-f]{32}):r([1-9]\d*)$/.exec(value);
  if (!match) return null;
  const scheduleId = normalizeJoinSchedulerRecordId(match[1], "s");
  const revision = normalizeJoinSchedulerRevision(match[2]);
  return scheduleId && revision ? { scheduleId, revision } : null;
}

function getJoinSchedulerScheduleIdFromNotification(notificationId) {
  return parseJoinSchedulerNotificationId(notificationId)?.scheduleId || null;
}

async function getJoinSchedulerScheduleOwner(scheduleId, expectedRevision) {
  const snapshot = await readJoinSchedulerSnapshot();
  return snapshot.schedules.find((record) =>
    record.id === scheduleId && record.revision === expectedRevision
  ) || null;
}

function sendJoinSchedulerShowMessageToTab(
  tabId,
  timeoutMs = JOIN_SCHEDULER_SHOW_MESSAGE_TIMEOUT_MS
) {
  if (!Number.isSafeInteger(tabId) || tabId < 0 || !chrome.tabs?.sendMessage) {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (response, runtimeFailed = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve(
        !runtimeFailed &&
        response?.ok === true &&
        response?.type === JOIN_SCHEDULER_SHOW_MESSAGE_TYPE
      );
    };
    const timeoutId = setTimeout(
      () => finish(null, true),
      Math.max(100, timeoutMs)
    );
    try {
      const returned = chrome.tabs.sendMessage(
        tabId,
        { type: JOIN_SCHEDULER_SHOW_MESSAGE_TYPE },
        { frameId: 0 },
        (response) => finish(response, Boolean(chrome.runtime?.lastError))
      );
      if (returned && typeof returned.then === "function") {
        returned.then(
          (response) => finish(response),
          () => finish(null, true)
        );
      }
    } catch {
      finish(null, true);
    }
  });
}

async function focusJoinSchedulerRobloxTab(tab) {
  if (!Number.isSafeInteger(tab?.id) || tab.id < 0) return false;
  let focused = false;
  if (typeof chrome.tabs?.update === "function") {
    try {
      await chrome.tabs.update(tab.id, { active: true });
      focused = true;
    } catch {
      // The tab may have closed between query and focus.
    }
  }
  if (Number.isSafeInteger(tab.windowId) &&
    typeof chrome.windows?.update === "function") {
    try {
      await chrome.windows.update(tab.windowId, { focused: true });
      focused = true;
    } catch {
      // Showing the modal is still useful when window focus is unavailable.
    }
  }
  return focused;
}

function isSafeJoinSchedulerRobloxTab(tab, expectedUrl = "") {
  const reportedUrls = [tab?.url, tab?.pendingUrl].filter((url) =>
    typeof url === "string" && url.length > 0
  );
  if (reportedUrls.length === 0 && expectedUrl) reportedUrls.push(expectedUrl);
  return (
    Number.isSafeInteger(tab?.id) &&
    tab.id >= 0 &&
    tab.incognito !== true &&
    reportedUrls.length > 0 &&
    reportedUrls.every(isTrustedRobloxPageUrl)
  );
}

async function createJoinSchedulerRobloxTabInNormalWindow(
  targetUrl,
  { requireKnownNormalWindow = false } = {}
) {
  if (!isTrustedRobloxPageUrl(targetUrl)) return null;

  const createInKnownWindow = async (windowId) => {
    if (!Number.isSafeInteger(windowId) || !chrome.tabs?.create) return null;
    try {
      const created = await chrome.tabs.create({
        windowId,
        url: targetUrl,
        active: true
      });
      return isSafeJoinSchedulerRobloxTab(created, targetUrl) &&
        (!Number.isSafeInteger(created.windowId) || created.windowId === windowId)
        ? created
        : null;
    } catch {
      return null;
    }
  };

  let normalWindowId;
  if (typeof chrome.windows?.getAll === "function") {
    normalWindowId = null;
    try {
      const windows = await runJoinSchedulerBrowserApi(() =>
        chrome.windows.getAll({ windowTypes: ["normal"] })
      );
      const normalWindows = (Array.isArray(windows) ? windows : [])
        .filter((window) =>
          Number.isSafeInteger(window?.id) &&
          window.id >= 0 &&
          window.incognito !== true &&
          (window.type === undefined || window.type === "normal")
        )
        .sort((left, right) => Number(right.focused) - Number(left.focused));
      normalWindowId = normalWindows[0]?.id ?? null;
    } catch {
      normalWindowId = null;
    }
  }

  if (Number.isSafeInteger(normalWindowId)) {
    return createInKnownWindow(normalWindowId);
  }

  if (normalWindowId === null && typeof chrome.windows?.create === "function") {
    try {
      const bootstrapUrl = requireKnownNormalWindow
        ? "https://www.roblox.com/home"
        : targetUrl;
      const createdWindow = await runJoinSchedulerBrowserApi(() =>
        chrome.windows.create({
          url: bootstrapUrl,
          type: "normal",
          focused: true,
          incognito: false
        })
      );
      if (
        !Number.isSafeInteger(createdWindow?.id) ||
        createdWindow.id < 0 ||
        createdWindow.incognito === true ||
        (createdWindow.type !== undefined && createdWindow.type !== "normal")
      ) {
        return null;
      }
      let initialTab = Array.isArray(createdWindow?.tabs)
        ? createdWindow.tabs.find((tab) =>
          tab?.windowId === createdWindow.id &&
          isSafeJoinSchedulerRobloxTab(tab, bootstrapUrl)
        )
        : null;
      if (!initialTab && chrome.tabs?.query) {
        const tabs = await runJoinSchedulerBrowserApi(() =>
          chrome.tabs.query({ windowId: createdWindow.id })
        );
        initialTab = (Array.isArray(tabs) ? tabs : []).find((tab) =>
          tab?.windowId === createdWindow.id &&
          isSafeJoinSchedulerRobloxTab(tab, bootstrapUrl)
        ) || null;
      }
      if (bootstrapUrl === targetUrl && initialTab) return initialTab;
      if (initialTab && typeof chrome.tabs?.update === "function") {
        try {
          const updated = await chrome.tabs.update(initialTab.id, {
            url: targetUrl,
            active: true
          });
          if (
            isSafeJoinSchedulerRobloxTab(updated, targetUrl) &&
            (!Number.isSafeInteger(updated.windowId) ||
              updated.windowId === createdWindow.id)
          ) {
            return updated;
          }
        } catch {
          return null;
        }
      }
      return createInKnownWindow(createdWindow.id);
    } catch {
      return null;
    }
  }

  // Old Chromium-shaped mocks may omit windows.getAll. Production Chromium
  // exposes it. Never pass a bearer URL through this fallback because its
  // destination window cannot be proven non-incognito before navigation.
  if (
    normalWindowId === undefined &&
    !requireKnownNormalWindow &&
    chrome.tabs?.create
  ) {
    try {
      const created = await chrome.tabs.create({
        url: targetUrl,
        active: true
      });
      return isSafeJoinSchedulerRobloxTab(created, targetUrl) ? created : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function createJoinSchedulerRobloxHomeTab() {
  return createJoinSchedulerRobloxTabInNormalWindow(
    "https://www.roblox.com/home"
  );
}

async function sendJoinSchedulerShowMessageUntilReady(tabId) {
  const deadline = Date.now() + JOIN_SCHEDULER_NEW_TAB_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    if (await sendJoinSchedulerShowMessageToTab(tabId, Math.min(750, remaining))) {
      return true;
    }
    const delay = Math.min(250, deadline - Date.now());
    if (delay <= 0) break;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return false;
}

async function showJoinSchedulerInRobloxTab(accountId = null) {
  if (typeof joinSchedulerRuntimeOverrides?.showDialog === "function") {
    const shown = await joinSchedulerRuntimeOverrides.showDialog({
      type: JOIN_SCHEDULER_SHOW_MESSAGE_TYPE
    });
    if (accountId && !await hasJoinSchedulerNotificationAuthority(accountId)) {
      return false;
    }
    return shown === true;
  }
  if (!chrome.tabs?.query || !chrome.tabs?.sendMessage) return false;

  let candidates = [];
  try {
    const tabs = await runJoinSchedulerBrowserApi(() =>
      chrome.tabs.query({ url: "https://www.roblox.com/*" })
    );
    candidates = (Array.isArray(tabs) ? tabs : [])
      .filter((tab) =>
        Number.isSafeInteger(tab?.id) &&
        tab.id >= 0 &&
        tab.incognito !== true &&
        isTrustedRobloxPageUrl(tab.url)
      )
      .sort((left, right) => {
        if (left.active !== right.active) return left.active ? -1 : 1;
        return (Number(right.lastAccessed) || 0) -
          (Number(left.lastAccessed) || 0);
      })
      .slice(0, JOIN_SCHEDULER_SHOW_TAB_CANDIDATE_LIMIT);
  } catch {
    candidates = [];
  }

  for (const tab of candidates) {
    if (accountId && !await hasJoinSchedulerNotificationAuthority(accountId)) {
      return false;
    }
    await focusJoinSchedulerRobloxTab(tab);
    if (accountId && !await hasJoinSchedulerNotificationAuthority(accountId)) {
      return false;
    }
    if (await sendJoinSchedulerShowMessageToTab(tab.id)) {
      if (accountId && !await hasJoinSchedulerNotificationAuthority(accountId)) {
        return false;
      }
      return true;
    }
  }

  if (accountId && !await hasJoinSchedulerNotificationAuthority(accountId)) {
    return false;
  }
  const created = await createJoinSchedulerRobloxHomeTab();
  if (
    !Number.isSafeInteger(created?.id) ||
    created.id < 0 ||
    created.incognito === true
  ) {
    return false;
  }
  await focusJoinSchedulerRobloxTab(created);
  if (accountId && !await hasJoinSchedulerNotificationAuthority(accountId)) {
    return false;
  }
  const shown = await sendJoinSchedulerShowMessageUntilReady(created.id);
  if (shown && accountId && !await hasJoinSchedulerNotificationAuthority(accountId)) {
    return false;
  }
  return shown;
}

async function handleJoinSchedulerNotificationButtonClicked(
  notificationId,
  buttonIndex
) {
  const parsed = parseJoinSchedulerNotificationId(notificationId);
  if (!parsed || ![0, 1].includes(buttonIndex)) return false;
  const { scheduleId, revision } = parsed;
  const schedule = await getJoinSchedulerScheduleOwner(scheduleId, revision);
  if (!schedule) {
    await clearJoinSchedulerNotification(scheduleId, revision);
    return false;
  }
  if (!await hasJoinSchedulerNotificationAuthority(schedule.accountId)) {
    await clearJoinSchedulerNotification(scheduleId, revision);
    return false;
  }
  if (buttonIndex === 1) {
    return deleteOwnedJoinSchedulerSchedule(
      schedule.accountId,
      scheduleId,
      revision
    );
  }
  try {
    await attemptJoinSchedulerSchedule(schedule.accountId, scheduleId, {
      automatic: false,
      expectedRevision: revision
    });
  } finally {
    await ensureJoinSchedulerCoordinatorAlarm();
  }
  return true;
}

async function handleJoinSchedulerNotificationClicked(notificationId) {
  const parsed = parseJoinSchedulerNotificationId(notificationId);
  if (!parsed) return false;
  const schedule = await getJoinSchedulerScheduleOwner(
    parsed.scheduleId,
    parsed.revision
  );
  if (!schedule) {
    await clearJoinSchedulerNotification(parsed.scheduleId, parsed.revision);
    return false;
  }
  if (!await hasJoinSchedulerNotificationAuthority(schedule.accountId)) {
    await clearJoinSchedulerNotification(parsed.scheduleId, parsed.revision);
    return false;
  }
  const shown = (await showJoinSchedulerInRobloxTab(schedule.accountId)) === true;
  if (!shown && !await hasJoinSchedulerNotificationAuthority(schedule.accountId)) {
    await clearJoinSchedulerNotification(parsed.scheduleId, parsed.revision);
  }
  return shown;
}

async function handleJoinSchedulerNotificationsPermissionRemoved(permissions) {
  if (!Array.isArray(permissions?.permissions) ||
    !permissions.permissions.includes("notifications")) {
    return false;
  }
  joinSchedulerPermissionGeneration += 1;
  await cancelAllJoinSchedulerSchedules("notifications-permission-removed");
  await ensureJoinSchedulerCoordinatorAlarm();
  return true;
}

function resetJoinSchedulerStateForTests() {
  joinSchedulerFeatureEnabled = true;
  joinSchedulerFeatureReady = true;
  joinSchedulerFeatureSyncPromise = null;
  joinSchedulerDbPromise = null;
  joinSchedulerStorageWriteTail = Promise.resolve();
  joinSchedulerStorageOverride = null;
  joinSchedulerRuntimeOverrides = null;
  joinSchedulerCoordinatorPromise = null;
  joinSchedulerPermissionGeneration = 0;
  joinSchedulerGameIconCache.clear();
  joinSchedulerNotificationIconCache.clear();
}

const JOIN_SCHEDULER_TEST_HOOKS = {
  constants: Object.freeze({
    featureKey: JOIN_SCHEDULER_FEATURE_KEY,
    showMessageType: JOIN_SCHEDULER_SHOW_MESSAGE_TYPE,
    nativeEventScheduleDataMessageType:
      NATIVE_EVENT_SCHEDULE_DATA_MESSAGE_TYPE,
    nativeEventScheduleMaxEventIds: NATIVE_EVENT_SCHEDULE_MAX_EVENT_IDS,
    messageTypes: JOIN_SCHEDULER_MESSAGE_TYPES,
    alarmName: JOIN_SCHEDULER_ALARM_NAME,
    notificationPrefix: JOIN_SCHEDULER_NOTIFICATION_PREFIX,
    notificationLeadMs: JOIN_SCHEDULER_NOTIFICATION_LEAD_MS,
    lateGraceMs: JOIN_SCHEDULER_LATE_GRACE_MS,
    collisionMs: JOIN_SCHEDULER_AUTO_COLLISION_MS,
    maxDestinations: JOIN_SCHEDULER_MAX_DESTINATIONS,
    maxSchedules: JOIN_SCHEDULER_MAX_SCHEDULES,
    maxAccounts: JOIN_SCHEDULER_MAX_ACCOUNTS,
    maxPrivateUrlLength: JOIN_SCHEDULER_PRIVATE_URL_MAX_LENGTH,
    gameIconMaxIds: JOIN_SCHEDULER_GAME_ICON_MAX_IDS,
    gameIconCacheMaxEntries: JOIN_SCHEDULER_GAME_ICON_CACHE_MAX_ENTRIES,
    gameIconResponseMaxBytes: JOIN_SCHEDULER_GAME_ICON_RESPONSE_MAX_BYTES,
    gameIconNotificationDeadlineMs:
      JOIN_SCHEDULER_GAME_ICON_NOTIFICATION_DEADLINE_MS
  }),
  messageTypes: JOIN_SCHEDULER_MESSAGE_TYPES,
  parseDestinationUrl: parseJoinSchedulerDestinationUrl,
  parseJoinSchedulerDestinationUrl,
  parseTrustedShareResolveUrl: parseTrustedJoinSchedulerShareResolveUrl,
  resolveModernDestination: resolveJoinSchedulerModernDestination,
  normalizeSnapshot: normalizeJoinSchedulerSnapshot,
  normalizeJoinSchedulerSnapshot,
  normalizeJoinSchedulerDestinationRecord,
  normalizeJoinSchedulerScheduleRecord,
  createMemoryStorage: createJoinSchedulerMemoryStorageForTests,
  createJoinSchedulerMemoryStorageForTests,
  readState: readJoinSchedulerAccountState,
  normalizeGameIconUniverseIds: normalizeJoinSchedulerGameIconUniverseIds,
  normalizeGameIconBatch: normalizeJoinSchedulerGameIconBatch,
  getGameIcons: getJoinSchedulerGameIcons,
  getGameIconsResponse: getJoinSchedulerGameIconsResponse,
  readGameIconBytes: readJoinSchedulerGameIconBytes,
  isGameIconSignature: isJoinSchedulerGameIconSignature,
  encodeGameIconDataUrl: encodeJoinSchedulerGameIconDataUrl,
  fetchNotificationGameIconDataUrl:
    fetchJoinSchedulerNotificationGameIconDataUrl,
  getNotificationGameIconDataUrl:
    getJoinSchedulerNotificationGameIconDataUrl,
  createNotification: createJoinSchedulerNotification,
  validateDestination: validateJoinSchedulerDestination,
  saveDestination: saveJoinSchedulerDestination,
  createSchedule: createJoinSchedulerSchedule,
  cancelSchedule: cancelJoinSchedulerSchedule,
  deleteSchedule: deleteJoinSchedulerSchedule,
  deleteDestination: deleteJoinSchedulerDestination,
  joinNow: joinNowJoinSchedulerResponse,
  claimSchedule: claimJoinSchedulerSchedule,
  attemptSchedule: attemptJoinSchedulerSchedule,
  runCoordinator: runJoinSchedulerCoordinator,
  runJoinSchedulerCoordinator,
  ensureAlarm: ensureJoinSchedulerCoordinatorAlarm,
  clearAlarm: clearJoinSchedulerAlarm,
  showDialog: showJoinSchedulerInRobloxTab,
  showJoinSchedulerInRobloxTab,
  sendShowMessage: sendJoinSchedulerShowMessageToTab,
  getRobloxTab: getJoinSchedulerRobloxTab,
  getTrustedLaunchTab: getTrustedJoinSchedulerLaunchTab,
  createRobloxTabInNormalWindow: createJoinSchedulerRobloxTabInNormalWindow,
  executePreparedDestination: executePreparedJoinSchedulerDestination,
  handleContentMessage: handleJoinSchedulerContentMessage,
  parseNativeEventScheduleGamePagePlaceId,
  getTrustedNativeEventSchedulePagePlaceId,
  normalizeNativeEventScheduleEventIds,
  normalizeNativeEventScheduleMatches,
  getNativeEventScheduleData,
  handleNativeEventScheduleDataMessage,
  dispatchContentMessage: dispatchJoinSchedulerContentMessage,
  handlePermissionRequest: handleJoinSchedulerNotificationPermissionRequest,
  handleNotificationClick: handleJoinSchedulerNotificationClicked,
  handleNotificationButton: handleJoinSchedulerNotificationButtonClicked,
  handlePermissionRemoved: handleJoinSchedulerNotificationsPermissionRemoved,
  getTrustedContentTabId: getTrustedJoinSchedulerContentTabId,
  getNotificationId: getJoinSchedulerNotificationId,
  getErrorCode: getJoinSchedulerErrorCode,
  applyFeatureValue: applyJoinSchedulerFeatureValue,
  syncFeature: syncJoinSchedulerFeatureFromStorage,
  cancelAll: cancelAllJoinSchedulerSchedules,
  reset: resetJoinSchedulerStateForTests,
  resetJoinSchedulerStateForTests,
  setStorageOverride(override) {
    joinSchedulerStorageOverride = override;
    joinSchedulerStorageWriteTail = Promise.resolve();
  },
  setRuntimeOverrides(overrides) {
    joinSchedulerRuntimeOverrides = overrides;
  },
  setFeatureState(enabled, ready = true) {
    joinSchedulerFeatureEnabled = enabled !== false;
    joinSchedulerFeatureReady = ready === true;
  },
  async getSnapshot() {
    await joinSchedulerStorageWriteTail.catch(() => undefined);
    return readJoinSchedulerSnapshot();
  },
  waitForWrites() {
    return joinSchedulerStorageWriteTail.catch(() => undefined);
  }
};

if (globalThis.__rslJoinSchedulerTestHooks) {
  Object.assign(globalThis.__rslJoinSchedulerTestHooks, JOIN_SCHEDULER_TEST_HOOKS);
}

if (globalThis.__rslBackgroundTestHooks) {
  Object.assign(globalThis.__rslBackgroundTestHooks, JOIN_SCHEDULER_TEST_HOOKS);
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

const EXTENSION_UPDATE_ROBLOX_LOCALE_SEGMENTS = new Set([
  "de", "en", "en-us", "es", "fr", "id", "it", "ja", "ko", "pl",
  "pt", "pt-br", "ru", "th", "tr", "vi", "zh-cn", "zh-tw"
]);

function isTrustedRobloxHomePageUrl(rawUrl) {
  if (!isTrustedRobloxPageUrl(rawUrl)) {
    return false;
  }
  try {
    const url = new URL(rawUrl);
    const pathname = url.pathname.toLowerCase();
    if (/^\/home\/?$/.test(pathname)) {
      return true;
    }
    const localized = /^\/([a-z]{2}(?:-[a-z]{2})?)\/home\/?$/.exec(
      pathname
    );
    return Boolean(
      localized &&
      EXTENSION_UPDATE_ROBLOX_LOCALE_SEGMENTS.has(localized[1])
    );
  } catch {
    return false;
  }
}

function getLiveBrowserTab(tabId) {
  if (!chrome.tabs?.get) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(tab && typeof tab === "object" ? tab : null);
    });
  });
}

async function verifyTrustedActiveRobloxHomeTab(tabId, senderUrl) {
  if (
    !Number.isSafeInteger(tabId) ||
    tabId < 0 ||
    !isTrustedRobloxHomePageUrl(senderUrl)
  ) {
    return false;
  }
  const liveTab = await getLiveBrowserTab(tabId);
  return Boolean(
    liveTab &&
    liveTab.id === tabId &&
    liveTab.active === true &&
    isTrustedRobloxHomePageUrl(liveTab.url)
  );
}

function challengeExtensionUpdateClaimContext(
  tabId,
  { claimContextId, homeVisitId, expectedFrequency }
) {
  if (
    !chrome.tabs?.sendMessage ||
    normalizeExtensionUpdateClaimContextId(claimContextId) === null ||
    normalizeExtensionUpdateHomeVisitId(homeVisitId) === null ||
    normalizeExtensionUpdateReminderFrequency(expectedFrequency) === null
  ) {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    let settled = false;
    let timeoutId = null;
    const finish = (verified) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      resolve(verified === true);
    };
    timeoutId = setTimeout(
      () => finish(false),
      EXTENSION_UPDATE_CONTEXT_CHALLENGE_TIMEOUT_MS
    );
    if (settled) {
      return;
    }
    try {
      chrome.tabs.sendMessage(
        tabId,
        {
          type: EXTENSION_UPDATE_CONTEXT_CHALLENGE_MESSAGE_TYPE,
          claimContextId,
          homeVisitId,
          expectedFrequency
        },
        { frameId: 0 },
        (response) => {
          if (chrome.runtime.lastError) {
            finish(false);
            return;
          }
          const responseKeys = response && typeof response === "object" &&
            !Array.isArray(response)
            ? Object.keys(response)
            : [];
          finish(
            responseKeys.length === 1 &&
            responseKeys[0] === "ok" &&
            response.ok === true
          );
        }
      );
    } catch {
      finish(false);
    }
  });
}

async function verifyExtensionUpdatePresentationContext(options) {
  if (
    !(await verifyTrustedActiveRobloxHomeTab(options.tabId, options.senderUrl))
  ) {
    return false;
  }
  return challengeExtensionUpdateClaimContext(options.tabId, options);
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

function normalizeExtensionUpdateVersion(value, requireTagPrefix = false) {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) {
    return null;
  }
  const pattern = requireTagPrefix
    ? /^v(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/
    : /^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/;
  const match = pattern.exec(value);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : null;
}

function compareExtensionUpdateVersions(leftValue, rightValue) {
  const left = normalizeExtensionUpdateVersion(leftValue);
  const right = normalizeExtensionUpdateVersion(rightValue);
  if (!left || !right) {
    return null;
  }
  const leftParts = left.split(".");
  const rightParts = right.split(".");
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index].length !== rightParts[index].length) {
      return leftParts[index].length > rightParts[index].length ? 1 : -1;
    }
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] > rightParts[index] ? 1 : -1;
    }
  }
  return 0;
}

function normalizeExtensionUpdateReminderFrequency(value) {
  return typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(
      EXTENSION_UPDATE_REMINDER_FREQUENCIES,
      value
    )
    ? value
    : null;
}

function createDefaultExtensionUpdatePreferences() {
  return {
    version: EXTENSION_UPDATE_PREFERENCES_STORAGE_VERSION,
    frequency: EXTENSION_UPDATE_DEFAULT_REMINDER_FREQUENCY,
    revision: 0
  };
}

function normalizeExtensionUpdatePreferences(rawValue) {
  const preferences = createDefaultExtensionUpdatePreferences();
  if (
    !rawValue ||
    typeof rawValue !== "object" ||
    Array.isArray(rawValue) ||
    rawValue.version !== EXTENSION_UPDATE_PREFERENCES_STORAGE_VERSION
  ) {
    return preferences;
  }
  const frequency = normalizeExtensionUpdateReminderFrequency(
    rawValue.frequency
  );
  const revision = Number(rawValue.revision);
  if (
    frequency &&
    Number.isSafeInteger(revision) &&
    revision >= 0
  ) {
    preferences.frequency = frequency;
    preferences.revision = revision;
  }
  return preferences;
}

function normalizeExtensionUpdateHomeVisitId(value) {
  return typeof value === "string" &&
    EXTENSION_UPDATE_HOME_VISIT_ID_PATTERN.test(value)
    ? value
    : null;
}

function normalizeExtensionUpdateClaimContextId(value) {
  return typeof value === "string" &&
    EXTENSION_UPDATE_CLAIM_CONTEXT_ID_PATTERN.test(value)
    ? value
    : null;
}

function createEmptyExtensionUpdateState() {
  return {
    version: EXTENSION_UPDATE_STORAGE_VERSION,
    latest: null,
    checkedAt: 0,
    retryNotBefore: 0,
    lastPresentedVersion: null,
    lastPresentedAt: 0,
    lastPresentedHomeVisitId: null,
    presentedHomeVisits: []
  };
}

function normalizeExtensionUpdateState(rawValue, now = Date.now()) {
  const state = createEmptyExtensionUpdateState();
  if (
    !rawValue ||
    typeof rawValue !== "object" ||
    Array.isArray(rawValue) ||
    rawValue.version !== EXTENSION_UPDATE_STORAGE_VERSION
  ) {
    return state;
  }

  const latest = normalizeExtensionUpdateVersion(rawValue.latest);
  if (latest === rawValue.latest) {
    state.latest = latest;
  }
  const checkedAt = Number(rawValue.checkedAt);
  if (
    Number.isSafeInteger(checkedAt) &&
    checkedAt > 0 &&
    checkedAt <= now + 5 * 60_000
  ) {
    state.checkedAt = checkedAt;
  }

  const retryNotBefore = Number(rawValue.retryNotBefore);
  if (
    Number.isSafeInteger(retryNotBefore) &&
    retryNotBefore > now &&
    retryNotBefore <= now + EXTENSION_UPDATE_FAILURE_RETRY_MS + 5 * 60_000
  ) {
    state.retryNotBefore = retryNotBefore;
  }

  const lastPresentedVersion = normalizeExtensionUpdateVersion(
    rawValue.lastPresentedVersion
  );
  const lastPresentedAt = Number(rawValue.lastPresentedAt);
  if (
    state.latest &&
    lastPresentedVersion === state.latest &&
    lastPresentedVersion === rawValue.lastPresentedVersion &&
    Number.isSafeInteger(lastPresentedAt) &&
    lastPresentedAt > 0 &&
    lastPresentedAt <= now + 5 * 60_000 &&
    now - lastPresentedAt >= 0 &&
    now - lastPresentedAt < EXTENSION_UPDATE_MAX_PRESENTATION_MARKER_AGE_MS
  ) {
    state.lastPresentedVersion = lastPresentedVersion;
    state.lastPresentedAt = lastPresentedAt;
    state.lastPresentedHomeVisitId = normalizeExtensionUpdateHomeVisitId(
      rawValue.lastPresentedHomeVisitId
    );
  }

  // Keep bounded per-version visit markers independently of the current
  // release. If GitHub's latest tag changes A -> B -> A during one Home visit,
  // the returning A must not be presented twice in that same visit.
  const rawHomeVisits = Array.isArray(rawValue.presentedHomeVisits)
    ? rawValue.presentedHomeVisits
    : [];
  const homeVisitKeys = new Set();
  for (const rawEntry of rawHomeVisits) {
    const version = normalizeExtensionUpdateVersion(rawEntry?.version);
    const visitId = normalizeExtensionUpdateHomeVisitId(rawEntry?.visitId);
    const presentedAt = Number(rawEntry?.presentedAt);
    const age = now - presentedAt;
    const key = `${version || ""}\n${visitId || ""}`;
    if (
      !version ||
      !visitId ||
      !Number.isSafeInteger(presentedAt) ||
      presentedAt <= 0 ||
      age < 0 ||
      age >= EXTENSION_UPDATE_MAX_PRESENTATION_MARKER_AGE_MS ||
      homeVisitKeys.has(key)
    ) {
      continue;
    }
    homeVisitKeys.add(key);
    state.presentedHomeVisits.push({ version, visitId, presentedAt });
  }
  if (
    state.lastPresentedVersion &&
    state.lastPresentedHomeVisitId &&
    !homeVisitKeys.has(
      `${state.lastPresentedVersion}\n${state.lastPresentedHomeVisitId}`
    )
  ) {
    state.presentedHomeVisits.push({
      version: state.lastPresentedVersion,
      visitId: state.lastPresentedHomeVisitId,
      presentedAt: state.lastPresentedAt
    });
  }
  state.presentedHomeVisits = state.presentedHomeVisits
    .sort((left, right) => left.presentedAt - right.presentedAt)
    .slice(-EXTENSION_UPDATE_MAX_HOME_VISIT_MARKERS);
  return state;
}

function extensionUpdateStatesEqual(left, right) {
  const leftVisits = Array.isArray(left.presentedHomeVisits)
    ? left.presentedHomeVisits
    : [];
  const rightVisits = Array.isArray(right.presentedHomeVisits)
    ? right.presentedHomeVisits
    : [];
  return (
    left.version === right.version &&
    left.latest === right.latest &&
    left.checkedAt === right.checkedAt &&
    left.retryNotBefore === right.retryNotBefore &&
    left.lastPresentedVersion === right.lastPresentedVersion &&
    left.lastPresentedAt === right.lastPresentedAt &&
    left.lastPresentedHomeVisitId === right.lastPresentedHomeVisitId &&
    leftVisits.length === rightVisits.length &&
    leftVisits.every((entry, index) => (
      entry.version === rightVisits[index]?.version &&
      entry.visitId === rightVisits[index]?.visitId &&
      entry.presentedAt === rightVisits[index]?.presentedAt
    ))
  );
}

function readExtensionUpdateStateStorage() {
  if (typeof extensionUpdateStorageOverride?.read === "function") {
    return Promise.resolve(extensionUpdateStorageOverride.read());
  }
  if (!chrome.storage?.local?.get) {
    return Promise.resolve(null);
  }
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(
      { [EXTENSION_UPDATE_STORAGE_KEY]: null },
      (result) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(result?.[EXTENSION_UPDATE_STORAGE_KEY] ?? null);
      }
    );
  });
}

function writeExtensionUpdateStateStorage(state) {
  if (typeof extensionUpdateStorageOverride?.write === "function") {
    return Promise.resolve(extensionUpdateStorageOverride.write({ ...state }));
  }
  if (!chrome.storage?.local?.set) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(
      { [EXTENSION_UPDATE_STORAGE_KEY]: { ...state } },
      () => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve();
      }
    );
  });
}

function readExtensionUpdatePreferencesStorage() {
  if (typeof extensionUpdatePreferencesStorageOverride?.read === "function") {
    return Promise.resolve(extensionUpdatePreferencesStorageOverride.read());
  }
  if (!chrome.storage?.local?.get) {
    return Promise.resolve(null);
  }
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(
      { [EXTENSION_UPDATE_PREFERENCES_STORAGE_KEY]: null },
      (result) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(result?.[EXTENSION_UPDATE_PREFERENCES_STORAGE_KEY] ?? null);
      }
    );
  });
}

function writeExtensionUpdatePreferencesStorage(preferences) {
  if (typeof extensionUpdatePreferencesStorageOverride?.write === "function") {
    return Promise.resolve(
      extensionUpdatePreferencesStorageOverride.write({ ...preferences })
    );
  }
  if (!chrome.storage?.local?.set) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(
      { [EXTENSION_UPDATE_PREFERENCES_STORAGE_KEY]: { ...preferences } },
      () => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve();
      }
    );
  });
}

async function loadExtensionUpdatePreferences() {
  if (extensionUpdatePreferencesMemory) {
    return extensionUpdatePreferencesMemory;
  }
  if (extensionUpdatePreferencesLoadPromise) {
    return extensionUpdatePreferencesLoadPromise;
  }
  const load = (async () => {
    let rawValue = null;
    try {
      rawValue = await readExtensionUpdatePreferencesStorage();
    } catch {
      rawValue = null;
    }
    extensionUpdatePreferencesMemory = normalizeExtensionUpdatePreferences(
      rawValue
    );
    return extensionUpdatePreferencesMemory;
  })();
  const tracked = load.finally(() => {
    if (extensionUpdatePreferencesLoadPromise === tracked) {
      extensionUpdatePreferencesLoadPromise = null;
    }
  });
  extensionUpdatePreferencesLoadPromise = tracked;
  return tracked;
}

async function reloadExtensionUpdatePreferences() {
  let rawValue = null;
  try {
    rawValue = await readExtensionUpdatePreferencesStorage();
  } catch {
    return loadExtensionUpdatePreferences();
  }
  extensionUpdatePreferencesMemory = normalizeExtensionUpdatePreferences(
    rawValue
  );
  return extensionUpdatePreferencesMemory;
}

function readExtensionUpdatePopupMasterEnabled() {
  if (!chrome.storage?.local?.get) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    chrome.storage.local.get(
      { [EXTENSION_UPDATE_FEATURE_SETTINGS_STORAGE_KEY]: null },
      (result) => {
        if (chrome.runtime.lastError) {
          resolve(false);
          return;
        }
        const rawValue = result?.[EXTENSION_UPDATE_FEATURE_SETTINGS_STORAGE_KEY];
        const enabled = !(
          rawValue &&
          typeof rawValue === "object" &&
          !Array.isArray(rawValue) &&
          rawValue.version === EXTENSION_UPDATE_FEATURE_SETTINGS_STORAGE_VERSION &&
          rawValue.flags &&
          typeof rawValue.flags === "object" &&
          rawValue.flags.updatePopups === false
        );
        resolve(enabled);
      }
    );
  });
}

async function loadExtensionUpdateState() {
  if (extensionUpdateStateMemory) {
    return extensionUpdateStateMemory;
  }
  if (extensionUpdateStateLoadPromise) {
    return extensionUpdateStateLoadPromise;
  }
  const load = (async () => {
    let rawValue = null;
    try {
      rawValue = await readExtensionUpdateStateStorage();
    } catch {
      rawValue = null;
    }
    extensionUpdateStateMemory = normalizeExtensionUpdateState(rawValue);
    return extensionUpdateStateMemory;
  })();
  const tracked = load.finally(() => {
    if (extensionUpdateStateLoadPromise === tracked) {
      extensionUpdateStateLoadPromise = null;
    }
  });
  extensionUpdateStateLoadPromise = tracked;
  return tracked;
}

function enqueueExtensionUpdateStateOperation(operation) {
  const run = extensionUpdateStateMutationTail
    .catch(() => undefined)
    .then(async () => operation(await loadExtensionUpdateState()));
  extensionUpdateStateMutationTail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function getExtensionUpdatePreferences() {
  return enqueueExtensionUpdateStateOperation(async () => {
    const preferences = await reloadExtensionUpdatePreferences();
    return { ...preferences };
  });
}

function setExtensionUpdateReminderFrequency(reminderFrequency) {
  const normalizedFrequency = normalizeExtensionUpdateReminderFrequency(
    reminderFrequency
  );
  if (!normalizedFrequency) {
    return Promise.resolve(null);
  }
  return enqueueExtensionUpdateStateOperation(async () => {
    const current = await reloadExtensionUpdatePreferences();
    if (current.frequency === normalizedFrequency) {
      return { ...current };
    }
    const next = {
      version: EXTENSION_UPDATE_PREFERENCES_STORAGE_VERSION,
      frequency: normalizedFrequency,
      revision: current.revision < Number.MAX_SAFE_INTEGER
        ? current.revision + 1
        : 1
    };
    await writeExtensionUpdatePreferencesStorage(next);
    extensionUpdatePreferencesMemory = next;
    return { ...next };
  });
}

async function persistExtensionUpdateState(state, now = Date.now()) {
  const normalized = normalizeExtensionUpdateState(state, now);
  await writeExtensionUpdateStateStorage(normalized);
  extensionUpdateStateMemory = normalized;
  return normalized;
}

async function persistExtensionUpdateStateSafely(state, now = Date.now()) {
  try {
    return await persistExtensionUpdateState(state, now);
  } catch {
    return extensionUpdateStateMemory || normalizeExtensionUpdateState(state, now);
  }
}

function getCurrentExtensionUpdateVersion() {
  try {
    return normalizeExtensionUpdateVersion(chrome.runtime.getManifest().version);
  } catch {
    return null;
  }
}

async function readBoundedExtensionUpdateResponse(
  response,
  maxBytes = EXTENSION_UPDATE_MAX_RESPONSE_BYTES
) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error("Invalid response size limit");
  }
  const rawLength = response?.headers?.get?.("content-length");
  if (typeof rawLength === "string" && /^\d+$/.test(rawLength)) {
    const contentLength = Number(rawLength);
    if (!Number.isSafeInteger(contentLength) || contentLength > maxBytes) {
      throw new Error("Response is too large");
    }
  }

  const reader = response?.body?.getReader?.();
  if (!reader) {
    throw new Error("Response body is unavailable");
  }
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let body = "";
  let totalBytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk?.done) {
        break;
      }
      if (
        !chunk?.value ||
        !ArrayBuffer.isView(chunk.value) ||
        chunk.value.BYTES_PER_ELEMENT !== 1
      ) {
        throw new Error("Invalid response body");
      }
      totalBytes += chunk.value.byteLength;
      if (totalBytes > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // The request is already being discarded.
        }
        throw new Error("Response is too large");
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
  } finally {
    try {
      reader.releaseLock?.();
    } catch {
      // Releasing a failed stream is best effort.
    }
  }
  return body;
}

async function fetchLatestExtensionUpdateVersion() {
  if (typeof globalThis.fetch !== "function") {
    throw new Error("Fetch is unavailable");
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    EXTENSION_UPDATE_FETCH_TIMEOUT_MS
  );
  try {
    const response = await globalThis.fetch(EXTENSION_UPDATE_LATEST_RELEASE_URL, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: controller.signal
    });
    if (!response?.ok || response.status !== 200) {
      throw new Error("Release request failed");
    }
    const contentType = response.headers?.get?.("content-type") || "";
    if (
      !/^application\/(?:json|vnd\.github\+json)(?:\s*;|$)/i.test(
        contentType
      )
    ) {
      throw new Error("Unexpected release response");
    }
    const body = await readBoundedExtensionUpdateResponse(response);
    const payload = JSON.parse(body);
    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      payload.draft !== false ||
      payload.prerelease !== false
    ) {
      throw new Error("Invalid release response");
    }
    const latest = normalizeExtensionUpdateVersion(payload.tag_name, true);
    if (!latest) {
      throw new Error("Invalid release tag");
    }
    return latest;
  } finally {
    clearTimeout(timeoutId);
  }
}

function isExtensionUpdateCacheFresh(state, now = Date.now()) {
  const age = now - state.checkedAt;
  return Boolean(
    state.latest &&
    Number.isSafeInteger(state.checkedAt) &&
    state.checkedAt > 0 &&
    age >= 0 &&
    age < EXTENSION_UPDATE_CACHE_TTL_MS
  );
}

async function ensureFreshExtensionUpdateState(now = Date.now()) {
  const cached = await enqueueExtensionUpdateStateOperation((state) => ({
    ...state
  }));
  if (
    isExtensionUpdateCacheFresh(cached, now) ||
    cached.retryNotBefore > now
  ) {
    return cached;
  }
  if (extensionUpdateCheckPromise) {
    await extensionUpdateCheckPromise;
    return enqueueExtensionUpdateStateOperation((state) => ({ ...state }));
  }

  const check = (async () => {
    try {
      const latest = await fetchLatestExtensionUpdateVersion();
      const checkedAt = Date.now();
      await enqueueExtensionUpdateStateOperation(async (state) => {
        const next = normalizeExtensionUpdateState(state, checkedAt);
        next.latest = latest;
        next.checkedAt = checkedAt;
        next.retryNotBefore = 0;
        if (next.lastPresentedVersion !== latest) {
          next.lastPresentedVersion = null;
          next.lastPresentedAt = 0;
          next.lastPresentedHomeVisitId = null;
        }
        await persistExtensionUpdateStateSafely(next, checkedAt);
      });
    } catch {
      const failedAt = Date.now();
      await enqueueExtensionUpdateStateOperation(async (state) => {
        const next = normalizeExtensionUpdateState(state, failedAt);
        next.retryNotBefore = failedAt + EXTENSION_UPDATE_FAILURE_RETRY_MS;
        await persistExtensionUpdateStateSafely(next, failedAt);
      });
    }
  })();
  const tracked = check.finally(() => {
    if (extensionUpdateCheckPromise === tracked) {
      extensionUpdateCheckPromise = null;
    }
  });
  extensionUpdateCheckPromise = tracked;
  await tracked;
  return enqueueExtensionUpdateStateOperation((state) => ({ ...state }));
}

function getExtensionUpdateNextCheckAt(state, now = Date.now()) {
  if (Number.isSafeInteger(state?.retryNotBefore) && state.retryNotBefore > now) {
    return Math.min(
      state.retryNotBefore,
      now + EXTENSION_UPDATE_FAILURE_RETRY_MS + 5 * 60_000
    );
  }
  if (
    state?.latest &&
    Number.isSafeInteger(state.checkedAt) &&
    state.checkedAt > 0
  ) {
    const nextCheckAt = state.checkedAt + EXTENSION_UPDATE_CACHE_TTL_MS;
    if (nextCheckAt > now) {
      return Math.min(nextCheckAt, now + EXTENSION_UPDATE_CACHE_TTL_MS);
    }
  }
  return now + EXTENSION_UPDATE_FAILURE_RETRY_MS;
}

function getExtensionUpdateNextNoticeAt(
  state,
  updateAvailable,
  reminderFrequency = EXTENSION_UPDATE_DEFAULT_REMINDER_FREQUENCY,
  homeVisitId = null,
  now = Date.now()
) {
  // Keep the former test/helper call shape `(state, available, now)` valid.
  if (Number.isSafeInteger(reminderFrequency)) {
    now = reminderFrequency;
    reminderFrequency = EXTENSION_UPDATE_DEFAULT_REMINDER_FREQUENCY;
    homeVisitId = null;
  }
  if (!updateAvailable) {
    return null;
  }
  const normalizedFrequency = normalizeExtensionUpdateReminderFrequency(
    reminderFrequency
  ) || EXTENSION_UPDATE_DEFAULT_REMINDER_FREQUENCY;
  if (normalizedFrequency === "home") {
    // A Home visit has no time-based reminder boundary. The current request may
    // claim once with its opaque visit id, but no timer may claim again later in
    // the same document/SPA visit.
    return null;
  }
  const reminderInterval =
    EXTENSION_UPDATE_REMINDER_FREQUENCIES[normalizedFrequency];
  if (
    state?.lastPresentedVersion === state.latest &&
    Number.isSafeInteger(state.lastPresentedAt) &&
    state.lastPresentedAt > 0
  ) {
    const nextNoticeAt = state.lastPresentedAt + reminderInterval;
    if (nextNoticeAt > now) {
      return Math.min(nextNoticeAt, now + reminderInterval);
    }
  }
  return now;
}

function buildExtensionUpdateStatus(
  state,
  showNotice = false,
  now = Date.now(),
  reminderFrequency = EXTENSION_UPDATE_DEFAULT_REMINDER_FREQUENCY,
  homeVisitId = null,
  preferenceRevision = 0
) {
  const current = getCurrentExtensionUpdateVersion();
  const latest = normalizeExtensionUpdateVersion(state?.latest);
  const updateAvailable = Boolean(
    current &&
    latest &&
    compareExtensionUpdateVersions(latest, current) === 1
  );
  const checkedAt = Number.isSafeInteger(state?.checkedAt) &&
    state.checkedAt > 0
    ? state.checkedAt
    : null;
  return {
    ok: true,
    current,
    latest,
    updateAvailable,
    showNotice: updateAvailable && showNotice === true,
    frequency:
      normalizeExtensionUpdateReminderFrequency(reminderFrequency) ||
      EXTENSION_UPDATE_DEFAULT_REMINDER_FREQUENCY,
    preferenceRevision:
      Number.isSafeInteger(preferenceRevision) && preferenceRevision >= 0
        ? preferenceRevision
        : 0,
    checkedAt,
    nextNoticeAt: getExtensionUpdateNextNoticeAt(
      state,
      updateAvailable,
      reminderFrequency,
      homeVisitId,
      now
    ),
    nextCheckAt: getExtensionUpdateNextCheckAt(state, now),
    howToUpdateUrl: EXTENSION_UPDATE_HOW_TO_URL
  };
}

async function getExtensionUpdateStatus(options = {}) {
  const tabId = Number(options.tabId);
  const pageVisible = options.pageVisible === true;
  const tabActive = options.tabActive === true;
  const now = Number.isSafeInteger(options.now) && options.now > 0
    ? options.now
    : Date.now();
  const canCheck =
    Number.isSafeInteger(tabId) && tabId >= 0 && pageVisible && tabActive;
  const homeVisitId = normalizeExtensionUpdateHomeVisitId(
    options.homeVisitId
  );
  const claimContextId = normalizeExtensionUpdateClaimContextId(
    options.claimContextId
  );
  const expectedFrequency = normalizeExtensionUpdateReminderFrequency(
    options.expectedFrequency
  );
  const canAttemptPresentation =
    canCheck &&
    options.homePage === true &&
    options.claimNotice === true &&
    homeVisitId !== null &&
    claimContextId !== null &&
    expectedFrequency !== null;

  if (canCheck) {
    await ensureFreshExtensionUpdateState(now);
  }

  return enqueueExtensionUpdateStateOperation(async (state) => {
    const preferences = await reloadExtensionUpdatePreferences();
    const reminderFrequency = preferences.frequency;
    const popupMasterEnabled = await readExtensionUpdatePopupMasterEnabled();
    const presentationConfigurationMatches =
      canAttemptPresentation &&
      popupMasterEnabled &&
      expectedFrequency === reminderFrequency;
    const next = normalizeExtensionUpdateState(state, now);
    const current = getCurrentExtensionUpdateVersion();
    const updateAvailable = Boolean(
      current &&
      next.latest &&
      compareExtensionUpdateVersions(next.latest, current) === 1
    );
    let showNotice = false;

    const reminderInterval =
      EXTENSION_UPDATE_REMINDER_FREQUENCIES[reminderFrequency];
    const presentationIsDue = reminderFrequency === "home"
      ? !next.presentedHomeVisits.some((entry) => (
          entry.version === next.latest && entry.visitId === homeVisitId
        ))
      : (
          next.lastPresentedVersion !== next.latest ||
          !Number.isSafeInteger(next.lastPresentedAt) ||
          next.lastPresentedAt <= 0 ||
          next.lastPresentedAt + reminderInterval <= now
        );

    let presentationContextVerified =
      options.presentationContextVerified === true;
    if (
      presentationConfigurationMatches &&
      updateAvailable &&
      presentationIsDue &&
      typeof options.verifyPresentationContext === "function"
    ) {
      try {
        presentationContextVerified =
          (await options.verifyPresentationContext()) === true;
      } catch {
        presentationContextVerified = false;
      }
    }
    const canPresent =
      presentationConfigurationMatches && presentationContextVerified;

    if (canPresent && updateAvailable && presentationIsDue) {
      next.lastPresentedVersion = next.latest;
      next.lastPresentedAt = now;
      next.lastPresentedHomeVisitId = homeVisitId;
      next.presentedHomeVisits = [
        ...next.presentedHomeVisits.filter((entry) => !(
          entry.version === next.latest && entry.visitId === homeVisitId
        )),
        { version: next.latest, visitId: homeVisitId, presentedAt: now }
      ].slice(-EXTENSION_UPDATE_MAX_HOME_VISIT_MARKERS);
      showNotice = true;
    }

    let responseState = next;
    if (canPresent && !extensionUpdateStatesEqual(state, next)) {
      try {
        responseState = await persistExtensionUpdateState(next, now);
      } catch {
        showNotice = false;
        responseState = normalizeExtensionUpdateState(state, now);
      }
    }
    return buildExtensionUpdateStatus(
      responseState,
      showNotice,
      now,
      reminderFrequency,
      homeVisitId,
      preferences.revision
    );
  });
}

function handleExtensionUpdateStatusMessage(message, sender, sendResponse) {
  const messageKeys = message && typeof message === "object" &&
    !Array.isArray(message)
    ? Object.keys(message).sort()
    : [];
  if (
    message?.type !== EXTENSION_UPDATE_STATUS_MESSAGE_TYPE ||
    typeof message.pageVisible !== "boolean" ||
    typeof message.claimNotice !== "boolean" ||
    normalizeExtensionUpdateReminderFrequency(message.expectedFrequency) === null ||
    !(
      message.claimContextId === null ||
      normalizeExtensionUpdateClaimContextId(message.claimContextId) !== null
    ) ||
    !(
      message.homeVisitId === null ||
      normalizeExtensionUpdateHomeVisitId(message.homeVisitId) !== null
    ) ||
    (
      message.claimNotice &&
      (message.homeVisitId === null || message.claimContextId === null)
    ) ||
    (!message.claimNotice && message.claimContextId !== null) ||
    messageKeys.length !== 6 ||
    messageKeys[0] !== "claimContextId" ||
    messageKeys[1] !== "claimNotice" ||
    messageKeys[2] !== "expectedFrequency" ||
    messageKeys[3] !== "homeVisitId" ||
    messageKeys[4] !== "pageVisible" ||
    messageKeys[5] !== "type"
  ) {
    return false;
  }
  const tabId = getTrustedRobloxTopFrameTabId(sender);
  if (tabId === null) {
    return false;
  }
  getExtensionUpdateStatus({
    tabId,
    pageVisible: message.pageVisible,
    tabActive: sender.tab.active === true,
    claimNotice: message.claimNotice,
    homePage: getTrustedRobloxHomeTabId(sender) === tabId,
    homeVisitId: message.homeVisitId,
    claimContextId: message.claimContextId,
    expectedFrequency: message.expectedFrequency,
    verifyPresentationContext: () =>
      verifyExtensionUpdatePresentationContext({
        tabId,
        senderUrl: sender.url,
        homeVisitId: message.homeVisitId,
        claimContextId: message.claimContextId,
        expectedFrequency: message.expectedFrequency
      })
  })
    .then(sendResponse)
    .catch(() => {
      sendResponse(
        buildExtensionUpdateStatus(createEmptyExtensionUpdateState())
      );
    });
  return true;
}

function handleExtensionUpdatePreferencesGetMessage(message, sender, sendResponse) {
  const messageKeys = message && typeof message === "object" &&
    !Array.isArray(message)
    ? Object.keys(message)
    : [];
  if (
    message?.type !== EXTENSION_UPDATE_PREFERENCES_GET_MESSAGE_TYPE ||
    messageKeys.length !== 1 ||
    messageKeys[0] !== "type" ||
    getTrustedRobloxTopFrameTabId(sender) === null
  ) {
    return false;
  }
  getExtensionUpdatePreferences()
    .then((preferences) => {
      sendResponse({
        ok: true,
        frequency: preferences.frequency,
        revision: preferences.revision
      });
    })
    .catch(() => {
      sendResponse({
        ok: false,
        frequency: EXTENSION_UPDATE_DEFAULT_REMINDER_FREQUENCY,
        revision: 0
      });
    });
  return true;
}

function handleExtensionUpdatePreferencesSetMessage(message, sender, sendResponse) {
  const messageKeys = message && typeof message === "object" &&
    !Array.isArray(message)
    ? Object.keys(message).sort()
    : [];
  const reminderFrequency = normalizeExtensionUpdateReminderFrequency(
    message?.frequency
  );
  if (
    message?.type !== EXTENSION_UPDATE_PREFERENCES_SET_MESSAGE_TYPE ||
    reminderFrequency === null ||
    messageKeys.length !== 2 ||
    messageKeys[0] !== "frequency" ||
    messageKeys[1] !== "type" ||
    getTrustedRobloxTopFrameTabId(sender) === null
  ) {
    return false;
  }
  setExtensionUpdateReminderFrequency(reminderFrequency)
    .then((preferences) => {
      sendResponse({
        ok: Boolean(preferences),
        frequency:
          preferences?.frequency || EXTENSION_UPDATE_DEFAULT_REMINDER_FREQUENCY,
        revision: preferences?.revision || 0
      });
    })
    .catch(() => {
      sendResponse({
        ok: false,
        frequency: EXTENSION_UPDATE_DEFAULT_REMINDER_FREQUENCY,
        revision: 0
      });
    });
  return true;
}

function resetExtensionUpdateStateForTests() {
  extensionUpdateCheckPromise = null;
  extensionUpdateStateLoadPromise = null;
  extensionUpdateStateMemory = null;
  extensionUpdateStateMutationTail = Promise.resolve();
  extensionUpdateStorageOverride = null;
  extensionUpdatePreferencesLoadPromise = null;
  extensionUpdatePreferencesMemory = null;
  extensionUpdatePreferencesStorageOverride = null;
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
    if (!isTrustedRobloxHomePageUrl(rawUrl)) {
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
    normalizeExperiencePlaceThumbnailIds,
    fetchExperiencePlaceThumbnails,
    handleExperiencePlaceThumbnailsMessage,
    fetchExperiencePlacesEligibility,
    handleExperiencePlacesEligibilityMessage,
    experiencePlaceThumbnailConstants: Object.freeze({
      messageType: EXPERIENCE_PLACE_THUMBNAILS_MESSAGE_TYPE,
      eligibilityMessageType: EXPERIENCE_PLACES_ELIGIBILITY_MESSAGE_TYPE,
      batchMax: EXPERIENCE_PLACE_THUMBNAIL_BATCH_MAX,
      size: EXPERIENCE_PLACE_THUMBNAIL_SIZE
    }),
    experiencePlacesConstants: Object.freeze({
      eligibilityMessageType: EXPERIENCE_PLACES_ELIGIBILITY_MESSAGE_TYPE,
      thumbnailMessageType: EXPERIENCE_PLACE_THUMBNAILS_MESSAGE_TYPE,
      thumbnailBatchMax: EXPERIENCE_PLACE_THUMBNAIL_BATCH_MAX,
      thumbnailSize: EXPERIENCE_PLACE_THUMBNAIL_SIZE
    }),
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
    getGameCcuHistoryFeatureValue,
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
    getServerHistoryFeatureValue,
    normalizeServerHistoryRequestId,
    normalizeServerHistoryLocale,
    normalizeServerHistorySessionId,
    normalizeServerHistoryTimestamp,
    normalizeStoredServerHistorySession,
    normalizeStoredServerHistoryAccount,
    normalizeServerHistoryStorage,
    normalizeServerHistoryPresence,
    reduceServerHistoryAccount,
    createEmptyServerHistoryAccount,
    createEmptyServerHistoryStorage,
    createServerHistorySessionId,
    readServerHistoryStorage,
    writeServerHistoryStorage,
    fetchServerHistoryPresence,
    enqueueServerHistoryPollWrite,
    runServerHistoryPoll,
    ensureServerHistoryAlarm,
    clearServerHistoryAlarm,
    applyServerHistoryFeatureValue,
    syncServerHistoryFeatureFromStorage,
    fetchServerHistoryExperienceDetails,
    sanitizeServerHistorySessionForResponse,
    getServerHistoryResponse,
    clearServerHistoryForViewer,
    executeServerHistoryRejoin,
    handleGetServerHistoryMessage,
    handleClearServerHistoryMessage,
    handleRejoinServerHistoryMessage,
    resetServerHistoryStateForTests,
    setServerHistoryStorageOverrideForTests(override) {
      serverHistoryStorageOverride = override;
    },
    setServerHistoryFeatureStateForTests(enabled, ready = true) {
      serverHistoryFeatureReady = ready === true;
      serverHistoryFeatureEnabled = enabled === true;
      serverHistoryLifecycleGeneration += 1;
    },
    invalidateServerHistoryLifecycleForTests() {
      serverHistoryLifecycleGeneration += 1;
      serverHistoryFeatureEnabled = false;
    },
    waitForServerHistoryWritesForTests() {
      return serverHistoryStorageWriteTail.catch(() => undefined);
    },
    getServerHistoryStateForTests() {
      return {
        featureEnabled: serverHistoryFeatureEnabled,
        featureReady: serverHistoryFeatureReady,
        generation: serverHistoryLifecycleGeneration,
        pollInFlight: Boolean(serverHistoryPollPromise)
      };
    },
    serverHistoryConstants: Object.freeze({
      featureKey: SERVER_HISTORY_FEATURE_KEY,
      storageKey: SERVER_HISTORY_STORAGE_KEY,
      storageVersion: SERVER_HISTORY_STORAGE_VERSION,
      alarmName: SERVER_HISTORY_ALARM_NAME,
      alarmPeriodMinutes: SERVER_HISTORY_ALARM_PERIOD_MINUTES,
      getMessageType: SERVER_HISTORY_GET_MESSAGE_TYPE,
      clearMessageType: SERVER_HISTORY_CLEAR_MESSAGE_TYPE,
      rejoinMessageType: SERVER_HISTORY_REJOIN_MESSAGE_TYPE,
      maxSessions: SERVER_HISTORY_MAX_SESSIONS,
      maxAccounts: SERVER_HISTORY_MAX_ACCOUNTS,
      continuityGapMs: SERVER_HISTORY_CONTINUITY_GAP_MS,
      fallbackLocale: SERVER_HISTORY_FALLBACK_LOCALE
    }),
    getGameEventsFeatureValue,
    applyGameEventsFeatureValue,
    syncGameEventsFeatureFromStorage,
    normalizeGameEventsRequestId,
    normalizeGameEventsLocale,
    normalizeStoredGameEventsGame,
    normalizeStoredGameEventsAccount,
    normalizeGameEventsStorage,
    createEmptyGameEventsAccount,
    createEmptyGameEventsStorage,
    readGameEventsStorage,
    writeGameEventsStorage,
    normalizeGameEventId,
    parseGameEventsUtcTimestamp,
    normalizeGameEvent,
    normalizeGameEventsPayload,
    getCurrentGameEvents,
    setGameEventsCache,
    fetchGameEventsForUniverse,
    getGameEventsForUniverse,
    getGameEventsErrorCode,
    fetchGameEventsGameDetails,
    searchGameEventsGameByName,
    normalizeGameEventsSearchQuery,
    normalizeGameEventsSearchResults,
    searchGameEventsGames,
    getGameEventsSearchResponse,
    resolveGameEventsUniverseIdFromPlace,
    resolveGameEventsGame,
    getExpectedGameEventsViewerUserId,
    getVerifiedGameEventsViewerUserId,
    fetchFreshGameEventsViewerUserId,
    assertCurrentGameEventsViewer,
    getGameEventsResponse,
    addGameEventFavorite,
    removeGameEventFavorite,
    handleGameEventsMessage,
    resetGameEventsStateForTests,
    setGameEventsStorageOverrideForTests(override) {
      gameEventsStorageOverride = override;
    },
    setGameEventsFeatureStateForTests(enabled, ready = true) {
      gameEventsFeatureEnabled = enabled !== false;
      gameEventsFeatureReady = ready === true;
    },
    waitForGameEventsWritesForTests() {
      return gameEventsStorageWriteTail.catch(() => undefined);
    },
    getGameEventsStateForTests() {
      return {
        featureEnabled: gameEventsFeatureEnabled,
        featureReady: gameEventsFeatureReady,
        cacheSize: gameEventsCache.size,
        inFlight: gameEventsRequests.size,
        searchCacheSize: gameEventsSearchCache.size
      };
    },
    gameEventsConstants: Object.freeze({
      featureKey: GAME_EVENTS_FEATURE_KEY,
      storageKey: GAME_EVENTS_STORAGE_KEY,
      storageVersion: GAME_EVENTS_STORAGE_VERSION,
      getMessageType: GAME_EVENTS_GET_MESSAGE_TYPE,
      addMessageType: GAME_EVENTS_ADD_MESSAGE_TYPE,
      removeMessageType: GAME_EVENTS_REMOVE_MESSAGE_TYPE,
      searchMessageType: GAME_EVENTS_SEARCH_MESSAGE_TYPE,
      maxGamesPerAccount: GAME_EVENTS_MAX_GAMES_PER_ACCOUNT,
      maxAccounts: GAME_EVENTS_MAX_ACCOUNTS,
      maxEventsPerGame: GAME_EVENTS_MAX_EVENTS_PER_GAME,
      maxSearchResults: GAME_EVENTS_MAX_SEARCH_RESULTS,
      searchQueryMaxLength: GAME_EVENTS_SEARCH_QUERY_MAX_LENGTH,
      searchCacheMaxEntries: GAME_EVENTS_SEARCH_CACHE_MAX_ENTRIES,
      fetchConcurrency: GAME_EVENTS_FETCH_CONCURRENCY,
      cacheTtlMs: GAME_EVENTS_CACHE_TTL_MS,
      fallbackLocale: GAME_EVENTS_FALLBACK_LOCALE,
      eventAssetThumbnailSize: THUMBNAIL_SPECS.eventAsset.size
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
    normalizeExtensionUpdateVersion,
    compareExtensionUpdateVersions,
    normalizeExtensionUpdateReminderFrequency,
    createDefaultExtensionUpdatePreferences,
    normalizeExtensionUpdatePreferences,
    normalizeExtensionUpdateHomeVisitId,
    normalizeExtensionUpdateClaimContextId,
    isTrustedRobloxHomePageUrl,
    verifyTrustedActiveRobloxHomeTab,
    challengeExtensionUpdateClaimContext,
    verifyExtensionUpdatePresentationContext,
    createEmptyExtensionUpdateState,
    normalizeExtensionUpdateState,
    getExtensionUpdatePreferences,
    setExtensionUpdateReminderFrequency,
    readBoundedExtensionUpdateResponse,
    fetchLatestExtensionUpdateVersion,
    isExtensionUpdateCacheFresh,
    ensureFreshExtensionUpdateState,
    getExtensionUpdateNextCheckAt,
    getExtensionUpdateNextNoticeAt,
    buildExtensionUpdateStatus,
    getExtensionUpdateStatus,
    handleExtensionUpdateStatusMessage,
    handleExtensionUpdatePreferencesGetMessage,
    handleExtensionUpdatePreferencesSetMessage,
    resetExtensionUpdateStateForTests,
    setExtensionUpdateStorageOverrideForTests(override) {
      extensionUpdateStorageOverride = override;
      extensionUpdateStateLoadPromise = null;
      extensionUpdateStateMemory = null;
    },
    setExtensionUpdatePreferencesStorageOverrideForTests(override) {
      extensionUpdatePreferencesStorageOverride = override;
      extensionUpdatePreferencesLoadPromise = null;
      extensionUpdatePreferencesMemory = null;
    },
    extensionUpdateConstants: Object.freeze({
      messageType: EXTENSION_UPDATE_STATUS_MESSAGE_TYPE,
      preferencesGetMessageType:
        EXTENSION_UPDATE_PREFERENCES_GET_MESSAGE_TYPE,
      preferencesSetMessageType:
        EXTENSION_UPDATE_PREFERENCES_SET_MESSAGE_TYPE,
      contextChallengeMessageType:
        EXTENSION_UPDATE_CONTEXT_CHALLENGE_MESSAGE_TYPE,
      storageKey: EXTENSION_UPDATE_STORAGE_KEY,
      storageVersion: EXTENSION_UPDATE_STORAGE_VERSION,
      preferencesStorageKey: EXTENSION_UPDATE_PREFERENCES_STORAGE_KEY,
      preferencesStorageVersion: EXTENSION_UPDATE_PREFERENCES_STORAGE_VERSION,
      defaultReminderFrequency:
        EXTENSION_UPDATE_DEFAULT_REMINDER_FREQUENCY,
      reminderFrequencies: EXTENSION_UPDATE_REMINDER_FREQUENCIES,
      maxPresentationMarkerAgeMs:
        EXTENSION_UPDATE_MAX_PRESENTATION_MARKER_AGE_MS,
      latestReleaseUrl: EXTENSION_UPDATE_LATEST_RELEASE_URL,
      howToUpdateUrl: EXTENSION_UPDATE_HOW_TO_URL,
      cacheTtlMs: EXTENSION_UPDATE_CACHE_TTL_MS,
      presentationTtlMs: EXTENSION_UPDATE_PRESENTATION_TTL_MS,
      fetchTimeoutMs: EXTENSION_UPDATE_FETCH_TIMEOUT_MS,
      maxResponseBytes: EXTENSION_UPDATE_MAX_RESPONSE_BYTES,
      failureRetryMs: EXTENSION_UPDATE_FAILURE_RETRY_MS,
      contextChallengeTimeoutMs:
        EXTENSION_UPDATE_CONTEXT_CHALLENGE_TIMEOUT_MS
    }),
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
  syncServerHistoryFeatureFromStorage(true);
  syncGameEventsFeatureFromStorage();
  syncJoinSchedulerFeatureFromStorage("startup");
});

chrome.runtime.onStartup?.addListener(() => {
  syncGameCcuHistoryFeatureFromStorage("stale");
  syncServerHistoryFeatureFromStorage("startup");
  syncGameEventsFeatureFromStorage();
  syncJoinSchedulerFeatureFromStorage("startup");
});

chrome.alarms?.onAlarm?.addListener((alarm) => {
  if (
    alarm?.name === GAME_CCU_HISTORY_ALARM_NAME &&
    gameCcuHistoryFeatureEnabled
  ) {
    void runGameCcuHistoryCollection();
  }
  if (
    alarm?.name === SERVER_HISTORY_ALARM_NAME &&
    serverHistoryFeatureReady &&
    serverHistoryFeatureEnabled
  ) {
    void runServerHistoryPoll();
  }
  if (alarm?.name === JOIN_SCHEDULER_ALARM_NAME) {
    void runJoinSchedulerCoordinator();
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
  applyServerHistoryFeatureValue(
    changes[FEATURE_SETTINGS_STORAGE_KEY].newValue,
    true
  );
  applyGameEventsFeatureValue(
    changes[FEATURE_SETTINGS_STORAGE_KEY].newValue
  );
  applyJoinSchedulerFeatureValue(
    changes[FEATURE_SETTINGS_STORAGE_KEY].newValue,
    true
  );
  setupContextMenus();
});

chrome.permissions?.onRemoved?.addListener((permissions) => {
  void handleJoinSchedulerNotificationsPermissionRemoved(permissions).catch(
    () => undefined
  );
});

chrome.notifications?.onButtonClicked?.addListener((notificationId, buttonIndex) => {
  void handleJoinSchedulerNotificationButtonClicked(
    notificationId,
    buttonIndex
  ).catch(() => undefined);
});

chrome.notifications?.onClicked?.addListener((notificationId) => {
  void handleJoinSchedulerNotificationClicked(notificationId).catch(
    () => undefined
  );
});

chrome.contextMenus?.onClicked?.addListener((info, tab) => {
  void handleContextMenuClick(info, tab);
});

function handleRuntimeMessage(message, sender, sendResponse) {
  if (sender.id !== chrome.runtime.id) {
    return false;
  }

  if (message?.type === EXTENSION_UPDATE_PREFERENCES_GET_MESSAGE_TYPE) {
    return handleExtensionUpdatePreferencesGetMessage(
      message,
      sender,
      sendResponse
    );
  }

  if (message?.type === EXTENSION_UPDATE_PREFERENCES_SET_MESSAGE_TYPE) {
    return handleExtensionUpdatePreferencesSetMessage(
      message,
      sender,
      sendResponse
    );
  }

  if (message?.type === EXTENSION_UPDATE_STATUS_MESSAGE_TYPE) {
    return handleExtensionUpdateStatusMessage(message, sender, sendResponse);
  }

  if (message?.type === NATIVE_EVENT_SCHEDULE_DATA_MESSAGE_TYPE) {
    return handleNativeEventScheduleDataMessage(message, sender, sendResponse);
  }

  if (
    message?.type ===
    JOIN_SCHEDULER_MESSAGE_TYPES.requestNotificationPermission
  ) {
    return handleJoinSchedulerNotificationPermissionRequest(message, sender, sendResponse);
  }

  if (Object.values(JOIN_SCHEDULER_MESSAGE_TYPES).includes(message?.type)) {
    return handleJoinSchedulerContentMessage(message, sender, sendResponse);
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

  if (message?.type === SERVER_HISTORY_GET_MESSAGE_TYPE) {
    return handleGetServerHistoryMessage(message, sender, sendResponse);
  }

  if (message?.type === SERVER_HISTORY_CLEAR_MESSAGE_TYPE) {
    return handleClearServerHistoryMessage(message, sender, sendResponse);
  }

  if (message?.type === SERVER_HISTORY_REJOIN_MESSAGE_TYPE) {
    return handleRejoinServerHistoryMessage(message, sender, sendResponse);
  }

  if (
    message?.type === GAME_EVENTS_GET_MESSAGE_TYPE ||
    message?.type === GAME_EVENTS_ADD_MESSAGE_TYPE ||
    message?.type === GAME_EVENTS_REMOVE_MESSAGE_TYPE ||
    message?.type === GAME_EVENTS_SEARCH_MESSAGE_TYPE
  ) {
    return handleGameEventsMessage(message, sender, sendResponse);
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

  if (message?.type === EXPERIENCE_PLACE_THUMBNAILS_MESSAGE_TYPE) {
    return handleExperiencePlaceThumbnailsMessage(message, sendResponse);
  }

  if (message?.type === EXPERIENCE_PLACES_ELIGIBILITY_MESSAGE_TYPE) {
    return handleExperiencePlacesEligibilityMessage(
      message,
      sender,
      sendResponse
    );
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
syncServerHistoryFeatureFromStorage("startup");
syncGameEventsFeatureFromStorage();
syncJoinSchedulerFeatureFromStorage("startup");
