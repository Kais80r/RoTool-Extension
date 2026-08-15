(() => {
  "use strict";

  const STORAGE_KEY = "sidebarShortcuts";
  const BEST_FRIENDS_STORAGE_KEY = "bestFriendsByViewer";
  const BEST_FRIENDS_COLLAPSED_STORAGE_KEY = "rslBestFriendsCollapsedV1";
  const HOME_FRIENDS_COLLAPSED_STORAGE_KEY = "rslHomeFriendsCollapsedV1";
  const FEATURE_SETTINGS_STORAGE_KEY = "rslFeatureSettingsV1";
  const QUICK_SETTINGS_COLLAPSED_STORAGE_KEY = "rslQuickSettingsCollapsedV1";
  const EXTENSION_UPDATE_FEEDBACK_ID = "rsl-extension-update-feedback";
  const EXTENSION_UPDATE_FEEDBACK_FALLBACK_CLASS =
    "rsl-extension-update-feedback--fallback";
  const EXTENSION_UPDATE_STATUS_MESSAGE_TYPE =
    "rsl:get-extension-update-status";
  const EXTENSION_UPDATE_HOW_TO_URL =
    "https://github.com/Kais80r/RoTool-Extension#updating-an-unpacked-copy-from-github";
  const EXTENSION_UPDATE_STATUS_RETRY_MS = 60 * 60_000;
  const EXTENSION_UPDATE_STATUS_MIN_TIMER_MS = 60_000;
  const EXTENSION_UPDATE_STATUS_MAX_TIMER_MS = 24 * 60 * 60_000;
  const FEATURE_SETTINGS_VERSION = 1;
  const ADD_ROW_ID = "rsl-add-shortcut-row";
  const DIALOG_ID = "rsl-shortcut-dialog";
  const BEST_FRIENDS_DIALOG_ID = "rsl-best-friends-dialog";
  const PRIVATE_SERVERS_DIALOG_ID = "rsl-private-servers-dialog";
  const FEATURE_SETTINGS_DIALOG_ID = "rsl-feature-settings-dialog";
  const GAME_EVENTS_DIALOG_ID = "rsl-game-events-dialog";
  const GAME_EVENTS_ROW_ID = "rsl-game-events-row";
  const GAME_EVENTS_GET_MESSAGE_TYPE = "rsl:get-game-events";
  const GAME_EVENTS_SEARCH_MESSAGE_TYPE = "rsl:search-game-events-games";
  const GAME_EVENTS_ADD_MESSAGE_TYPE = "rsl:add-game-event-favorite";
  const GAME_EVENTS_REMOVE_MESSAGE_TYPE = "rsl:remove-game-event-favorite";
  const GAME_EVENTS_LAUNCH_SURFACE_ATTRIBUTE = "data-rsl-game-events-launch-surface";
  const JOIN_SCHEDULER_ROW_ID = "rsl-join-scheduler-row";
  const JOIN_SCHEDULER_MODAL_GLOBAL = "__rslJoinSchedulerModal";
  const GAME_EVENTS_SCHEDULE_ATTRIBUTE = "data-rsl-game-events-schedule";
  const NATIVE_EVENT_SCHEDULE_DATA_MESSAGE_TYPE =
    "rsl:get-native-event-schedule-data";
  const NATIVE_EVENT_SCHEDULE_ATTRIBUTE = "data-rsl-native-event-schedule";
  const NATIVE_EVENT_SCHEDULE_MAX_EVENT_IDS = 50;
  const NATIVE_EVENT_SCHEDULE_LOCALE_SEGMENTS = new Set([
    "de", "en", "en-us", "es", "fr", "id", "it", "ja", "ko", "pl",
    "pt", "pt-br", "ru", "th", "tr", "vi", "zh-cn", "zh-tw"
  ]);
  const NATIVE_EVENT_SCHEDULE_CARD_SELECTOR =
    '#game-details-about-tab-container .virtual-event-game-details-container ' +
    'li.experience-events-tile.contained-tile[data-testid="wide-game-tile"][id]';
  const NATIVE_EVENT_SCHEDULE_FEATURED_SELECTOR =
    ".featured-game-container.game-card-container";
  const NATIVE_EVENT_SCHEDULE_REFRESH_MS = 10 * 60_000;
  const NATIVE_EVENT_SCHEDULE_FAILURE_RETRY_MS = 60_000;
  const SERVER_HISTORY_DIALOG_ID = "rsl-server-history-dialog";
  const SERVER_HISTORY_ROW_ID = "rsl-server-history-row";
  const SERVER_HISTORY_GET_MESSAGE_TYPE = "rsl:get-server-history";
  const SERVER_HISTORY_CLEAR_MESSAGE_TYPE = "rsl:clear-server-history";
  const SERVER_HISTORY_REJOIN_MESSAGE_TYPE = "rsl:rejoin-server-history";
  const FEATURE_SETTINGS_NAV_ID = "rsl-navbar-settings";
  const NATIVE_SIDEBAR_HIDDEN_ATTRIBUTE = "data-rsl-native-sidebar-hidden";
  const BEST_FRIENDS_CAROUSEL_ATTRIBUTE = "data-rsl-best-friends-carousel";
  const BEST_FRIENDS_HEADER_ATTRIBUTE = "data-rsl-best-friends-header";
  const BEST_FRIENDS_BODY_ATTRIBUTE = "data-rsl-best-friends-body";
  const BEST_FRIENDS_LIST_ATTRIBUTE = "data-rsl-best-friends-list";
  const BEST_FRIENDS_COLLAPSED_ATTRIBUTE = "data-rsl-best-friends-collapsed";
  const BEST_FRIENDS_TOGGLE_ATTRIBUTE = "data-rsl-toggle-best-friends";
  const HOME_FRIENDS_COLLAPSED_ATTRIBUTE = "data-rsl-home-friends-collapsed";
  const HOME_FRIENDS_TOGGLE_ATTRIBUTE = "data-rsl-toggle-home-friends";
  const HOME_FRIENDS_HEADER_ATTRIBUTE = "data-rsl-home-friends-header";
  const HOME_FRIENDS_BODY_ATTRIBUTE = "data-rsl-home-friends-body";
  const HOME_FRIENDS_OWNED_ID_ATTRIBUTE = "data-rsl-home-friends-owned-id";
  const QUICK_SETTINGS_ATTRIBUTE = "data-rsl-quick-settings";
  const QUICK_SETTING_ATTRIBUTE = "data-rsl-quick-setting";
  const QUICK_SETTINGS_READ_MESSAGE_TYPE = "rsl:get-quick-settings";
  const QUICK_SETTING_UPDATE_MESSAGE_TYPE = "rsl:update-quick-setting";
  const ONLINE_STATUS_UPDATE_MESSAGE_TYPE = "rsl:update-online-status";
  const BEST_FRIEND_ID_ATTRIBUTE = "data-rsl-best-friend-id";
  const BEST_FRIEND_HOVER_CARD_ATTRIBUTE = "data-rsl-best-friend-hover-card";
  const BEST_FRIEND_ACTION_ATTRIBUTE = "data-rsl-best-friend-action";
  const BEST_FRIEND_ACTION_RESULT_EVENT = "rotool:best-friend-action-result:v1";
  const QUICK_PLAY_HOST_ATTRIBUTE = "data-rsl-quick-play-host";
  const QUICK_PLAY_THUMBNAIL_ATTRIBUTE = "data-rsl-quick-play-thumbnail";
  const QUICK_PLAY_SURFACE_ATTRIBUTE = "data-rsl-quick-play-surface";
  const QUICK_PLAY_TRAY_ATTRIBUTE = "data-rsl-quick-play-tray";
  const QUICK_PLAY_ACTION_ATTRIBUTE = "data-rsl-quick-play-action";
  const QUICK_PLAY_PLACE_ID_ATTRIBUTE = "data-rsl-quick-play-place-id";
  const PRIVATE_SUPPORT_TABINDEX_ATTRIBUTE =
    "data-rsl-private-support-owned-tabindex";
  const GAME_TILE_CCU_ATTRIBUTE = "data-rsl-game-tile-ccu";
  const GAME_TILE_CCU_VALUE_ATTRIBUTE = "data-rsl-game-tile-ccu-value";
  const GAME_TILE_CCU_ICON_ATTRIBUTE = "data-rsl-game-tile-ccu-icon";
  const GAME_TILE_CCU_CONTAINER_ATTRIBUTE = "data-rsl-game-tile-ccu-container";
  const GAME_TILE_CCU_PLACE_ID_ATTRIBUTE = "data-rsl-game-tile-ccu-place-id";
  const GAME_TILE_CCU_EXTERNAL_ATTRIBUTE = "data-rsl-game-tile-ccu-external";
  const GAME_TILE_CCU_GRAPH_TRIGGER_ATTRIBUTE =
    "data-rsl-game-ccu-graph-trigger";
  const GAME_TILE_CCU_GRAPH_TABINDEX_ATTRIBUTE =
    "data-rsl-game-ccu-graph-owned-tabindex";
  const GAME_TILE_CCU_GRAPH_OVERLAY_ATTRIBUTE =
    "data-rsl-game-ccu-graph-overlay";
  const GAME_TILE_CCU_GRAPH_HOST_ATTRIBUTE = "data-rsl-game-ccu-graph-host";
  const GAME_TILE_CCU_GRAPH_OPEN_ATTRIBUTE = "data-rsl-game-ccu-graph-open";
  const GAME_TILE_RATING_VALUE_ATTRIBUTE = "data-rsl-game-tile-rating-value";
  const GAME_TILE_RATING_ICON_ATTRIBUTE = "data-rsl-game-tile-rating-icon";
  const GAME_TILE_RATING_EXTERNAL_ATTRIBUTE =
    "data-rsl-game-tile-rating-external";
  const SPONSORED_RATING_ORIGINAL_TEXT_ATTRIBUTE =
    "data-rsl-sponsored-rating-original-text";
  const SPONSORED_RATING_ORIGINAL_ARIA_ATTRIBUTE =
    "data-rsl-sponsored-rating-original-aria";
  const SPONSORED_RATING_ORIGINAL_TITLE_ATTRIBUTE =
    "data-rsl-sponsored-rating-original-title";
  const GAME_TILE_SPONSORED_FOOTER_SELECTOR =
    '[data-testid="wide-game-tile-sponsored-footer"], ' +
    '[data-testid="game-tile-sponsored-footer"], ' +
    ".game-card-info.sponsored-footer";
  const GAME_TILE_RATING_SUFFIX_PATTERN =
    /^\s*((?:100(?:[.,]0+)?|\d{1,2}(?:[.,]\d+)?)%)\s+Rating\s*$/i;
  const GAME_TILE_CCU_MESSAGE_TYPE = "rsl:get-game-tile-ccu";
  const GAME_TILE_CCU_HISTORY_MESSAGE_TYPE = "rsl:get-game-ccu-history";
  const QUICK_PLAY_RESULT_EVENT = "rotool:quick-play-result:v1";
  const QUICK_PLAY_RANDOM_REQUEST_EVENT = "rotool:random-server-request:v1";
  const QUICK_PLAY_RANDOM_RESPONSE_EVENT = "rotool:random-server-response:v1";
  const PRIVATE_SERVER_ACTION_ATTRIBUTE = "data-rsl-private-server-action";
  const PRIVATE_SERVER_TOKEN_ATTRIBUTE = "data-rsl-private-server-token";
  const PRIVATE_SERVER_PLACE_ID_ATTRIBUTE = "data-rsl-private-server-place-id";
  const PRIVATE_SERVER_JOIN_MESSAGE_TYPE = "rsl:join-private-server";
  const PRIVATE_SERVER_OWNER_THUMBNAILS_MESSAGE_TYPE =
    "rsl:get-private-server-owner-thumbnails";
  const ROW_ATTRIBUTE = "data-rsl-shortcut-id";
  const ONLINE_FILTER_ITEM_ATTRIBUTE = "data-rsl-online-friends-filter";
  const OFFLINE_FILTER_ITEM_ATTRIBUTE = "data-rsl-offline-friends-filter";
  const BEST_FRIENDS_FILTER_ITEM_ATTRIBUTE = "data-rsl-best-friends-filter";
  const ONLINE_FILTER_CONTROL_ATTRIBUTE = "data-rsl-online-friends-control";
  const ONLINE_FILTER_DEMOTED_ATTRIBUTE = "data-rsl-online-filter-demoted";
  const ONLINE_LIST_ATTRIBUTE = "data-rsl-online-friends-list";
  const ONLINE_NATIVE_LIST_HIDDEN_ATTRIBUTE = "data-rsl-native-friends-hidden";
  const ONLINE_NATIVE_PAGINATION_HIDDEN_ATTRIBUTE = "data-rsl-native-pagination-hidden";
  const ONLINE_SEARCH_HIDDEN_ATTRIBUTE = "data-rsl-online-search-hidden";
  const ONLINE_STATE_ATTRIBUTE = "data-rsl-online-friends-state";
  const FRIENDS_ADVANCED_FILTER_BUTTON_ATTRIBUTE = "data-rsl-friends-filters-button";
  const FRIENDS_ADVANCED_FILTER_MENU_ATTRIBUTE = "data-rsl-friends-filters-menu";
  const FRIENDS_ADVANCED_FILTER_HELP_ATTRIBUTE = "data-rsl-friends-filter-help";
  const FRIENDS_ADVANCED_FILTER_SUMMARY_ATTRIBUTE =
    "data-rsl-friends-filters-summary";
  const FRIENDS_ADVANCED_FILTER_MESSAGE_TYPE = "rsl:get-friend-filter-data";
  const ONLINE_REFRESH_INTERVAL_MS = 60_000;
  const BEST_FRIENDS_REFRESH_INTERVAL_MS = 60_000;
  const BEST_FRIENDS_SCROLL_SETTLE_MS = 200;
  const BEST_FRIENDS_INITIAL_LAYOUT_RECHECK_DELAYS_MS = Object.freeze([
    250,
    750,
    1_500,
    3_000
  ]);
  const BEST_FRIENDS_HOVER_REFRESH_RETRY_MS = 5_000;
  const THUMBNAIL_RETRY_DELAY_MS = 15_000;
  const MAX_SHORTCUTS = 30;
  const MAX_BEST_FRIENDS = 100;
  const ALL_FRIENDS_FILTER_VALUE = "all";
  const BEST_FRIENDS_FILTER_VALUE = "best-friends";
  const BEST_FRIENDS_DEEP_LINK = "/users/friends?rotool=best-friends#!/friends";
  const BEST_FRIEND_ACTION_TIMEOUT_MS = 8_000;
  const BEST_FRIEND_GAME_THUMBNAIL_RETRY_MS = 350;
  const BEST_FRIEND_GAME_IMAGE_TIMEOUT_MS = 5_000;
  const FRIENDS_RUNTIME_MESSAGE_TIMEOUT_MS = 30_000;
  const FRIENDS_ADVANCED_RUNTIME_MESSAGE_TIMEOUT_MS = 75_000;
  const QUICK_SETTINGS_RUNTIME_MESSAGE_TIMEOUT_MS = 75_000;
  const QUICK_PLAY_FEEDBACK_MS = 1_600;
  const QUICK_PLAY_MIN_THUMBNAIL_WIDTH = 72;
  const QUICK_PLAY_MIN_THUMBNAIL_HEIGHT = 56;
  const QUICK_PLAY_PRIVATE_MIN_THUMBNAIL_WIDTH = 144;
  const QUICK_PLAY_PRIVATE_LAYOUT_HYSTERESIS_PX = 8;
  const QUICK_PLAY_PRIVATE_WIDE_MIN_THUMBNAIL_WIDTH = 172;
  const GAME_TILE_CCU_MAX_BATCH_SIZE = 50;
  const GAME_TILE_CCU_CACHE_TTL_MS = 60_000;
  const GAME_TILE_CCU_CACHE_MAX_ENTRIES = 2_000;
  const GAME_TILE_CCU_RETRY_DELAY_MS = 30_000;
  const GAME_TILE_CCU_GRAPH_CACHE_TTL_MS = 60_000;
  const GAME_TILE_CCU_GRAPH_CACHE_MAX_ENTRIES = 200;
  const GAME_TILE_CCU_GRAPH_BUCKET_MS = 5 * 60_000;
  const GAME_TILE_CCU_GRAPH_RETRY_GRACE_MS = 5_000;
  const GAME_TILE_CCU_GRAPH_WINDOW_MS = 12 * 60 * 60_000;
  const GAME_TILE_CCU_GRAPH_RETENTION_MS = 7 * 24 * 60 * 60_000;
  const GAME_TILE_CCU_GRAPH_MAX_POINTS = Math.floor(
    GAME_TILE_CCU_GRAPH_RETENTION_MS / GAME_TILE_CCU_GRAPH_BUCKET_MS
  );
  const GAME_TILE_CCU_GRAPH_GAP_MS = GAME_TILE_CCU_GRAPH_BUCKET_MS;
  const GAME_TILE_CCU_GRAPH_MAX_VISUAL_POINTS = 144;
  const GAME_TILE_CCU_GRAPH_HOVER_DELAY_MS = 100;
  const GAME_TILE_CCU_GRAPH_CLOSE_DELAY_MS = 140;
  const GAME_TILE_CCU_GRAPH_VIEWPORT_MARGIN_PX = 8;
  const GAME_TILE_CCU_GRAPH_ANCHOR_GAP_PX = 3;
  const PRIVATE_SERVER_REQUEST_TIMEOUT_MS = 120_000;
  const PRIVATE_SERVER_SUPPORT_CACHE_TTL_MS = 5 * 60_000;
  const PRIVATE_SERVER_SUPPORT_MAX_CONCURRENT_REQUESTS = 6;
  const PRIVATE_SERVER_SUPPORT_RETRY_DELAYS_MS = Object.freeze([
    1_000,
    3_000,
    10_000,
    30_000
  ]);
  const PRIVATE_SERVER_SUPPORT_STEADY_RETRY_MS = 60_000;
  const PRIVATE_SERVER_SUPPORT_RETRY_JITTER_RATIO = 0.2;
  const PRIVATE_SERVER_MAX_AUTO_PAGES = 100;
  const PRIVATE_SERVER_OWNER_THUMBNAIL_CACHE_MAX_ENTRIES = 500;
  const PRIVATE_SERVER_OWNER_THUMBNAIL_UNAVAILABLE_TTL_MS = 5 * 60_000;
  const SERVER_HISTORY_REQUEST_TIMEOUT_MS = 120_000;
  const SERVER_HISTORY_LIMIT = 30;
  const GAME_EVENTS_REQUEST_TIMEOUT_MS = 180_000;
  const GAME_EVENTS_MAX_FAVORITES = 30;
  const GAME_EVENTS_SEARCH_DEBOUNCE_MS = 300;

  const QUICK_PLAY_NATIVE_HOST_SELECTOR = [
    ".game-card-thumb-container",
    ".featured-game-icon-container",
    ".large-game-tile-thumb-container",
    "[data-testid='game-card-thumbnail']",
    "[data-testid='experience-card-thumbnail']",
    "[data-testid='game-tile-thumbnail']",
    "[data-testid='experience-tile-thumbnail']"
  ].join(", ");

  const QUICK_PLAY_CARD_ROOT_SELECTOR = [
    ".game-card-container",
    "[data-testid='game-tile']",
    "[data-testid='wide-game-tile'] .featured-game-container",
    ".large-game-tile",
    ".featured-game-container"
  ].join(", ");

  const GAME_TILE_CCU_WIDE_CARD_SELECTOR = [
    ".featured-game-container",
    ".large-game-tile",
    "[data-testid='wide-game-tile']"
  ].join(", ");

  const GAME_TILE_CCU_GRAPH_CARD_SELECTOR = [
    ".game-card-container",
    "[data-testid='game-tile']",
    "[data-testid='wide-game-tile'] .featured-game-container",
    ".large-game-tile",
    ".featured-game-container",
    "[data-testid='wide-game-tile']"
  ].join(", ");

  const GAME_TILE_CCU_GRAPH_THUMBNAIL_SELECTOR = [
    ".game-card-thumb-container",
    ".featured-game-icon-container",
    ".large-game-tile-thumb-container",
    "[data-testid='game-card-thumbnail']",
    "[data-testid='experience-card-thumbnail']",
    "[data-testid='game-tile-thumbnail']",
    "[data-testid='experience-tile-thumbnail']"
  ].join(", ");

  const DEFAULT_AVATAR_URL =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' fill='%233b3d45'/%3E%3Ccircle cx='75' cy='54' r='28' fill='%23787c88'/%3E%3Cpath d='M25 145c4-35 24-52 50-52s46 17 50 52' fill='%23787c88'/%3E%3C/svg%3E";
  const DEFAULT_GAME_ICON_URL =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' fill='%233b3d45'/%3E%3Cpath d='M45 33l72 18-18 72-72-18 18-72Zm22 31-9 34 34 9 9-34-34-9Z' fill='%23787c88'/%3E%3C/svg%3E";
  const VERIFIED_BADGE_ICON_URL =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 28'%3E%3Crect x='5.888' width='22.89' height='22.89' transform='rotate(15 5.888 0)' fill='%230066ff'/%3E%3Cpath fill-rule='evenodd' d='m20.543 8.751.006.006a1.538 1.538 0 0 1 0 2.176l-8.732 8.732-4.367-4.368a1.538 1.538 0 0 1 0-2.176l.007-.006a1.538 1.538 0 0 1 2.176 0l2.184 2.184 6.55-6.548a1.538 1.538 0 0 1 2.176 0Z' fill='white'/%3E%3C/svg%3E";

  const FRIENDS_ADVANCED_FILTER_DEFINITIONS = Object.freeze({
    verified: Object.freeze({
      label: "Verified",
      help:
        "This means Roblox's public blue verified badge, not email, phone, ID, or age verification."
    }),
    robloxPlus: Object.freeze({
      label: "Roblox Plus"
    }),
    statuses: Object.freeze([
      Object.freeze({ value: "in-experience", label: "In experience" }),
      Object.freeze({ value: "online", label: "Online" }),
      Object.freeze({ value: "offline", label: "Offline" }),
      Object.freeze({ value: "studio", label: "In Studio" })
    ]),
    statusHelp:
      "Online means online without being in an experience or Studio. Roblox can hide presence because of privacy, safety, account, or region rules, so a hidden person may appear offline.",
    sorts: Object.freeze([
      Object.freeze({ value: "default", label: "Default" }),
      Object.freeze({ value: "display-name-asc", label: "Display name A-Z" }),
      Object.freeze({ value: "display-name-desc", label: "Display name Z-A" }),
      Object.freeze({ value: "username-asc", label: "Username A-Z" }),
      Object.freeze({ value: "username-desc", label: "Username Z-A" }),
      Object.freeze({ value: "in-experience-first", label: "In experience first" }),
      Object.freeze({ value: "online-first", label: "Online first" }),
      Object.freeze({ value: "offline-first", label: "Offline first" }),
      Object.freeze({ value: "best-friends-first", label: "Best Friends first" }),
      Object.freeze({ value: "verified-first", label: "Verified first" })
    ]),
    bestFriends: Object.freeze([
      Object.freeze({ value: "any", label: "Any" }),
      Object.freeze({ value: "only", label: "Best Friends only" }),
      Object.freeze({ value: "exclude", label: "Exclude Best Friends" })
    ]),
    game: Object.freeze({
      label: "In a specific experience",
      placeholder: "Experience name, link, Place ID, or Universe ID",
      help:
        "Roblox only shares a friend's current experience when their visibility and safety settings allow your account to see it. Age, account, and region rules can also affect availability."
    })
  });

  const FRIENDS_ADVANCED_STATUS_VALUES = Object.freeze([
    "in-experience",
    "online",
    "offline",
    "studio"
  ]);
  const FRIENDS_ADVANCED_BEST_FRIENDS_VALUES = Object.freeze([
    "any",
    "only",
    "exclude"
  ]);
  const FRIENDS_ADVANCED_SORT_VALUES = Object.freeze(
    FRIENDS_ADVANCED_FILTER_DEFINITIONS.sorts.map(({ value }) => value)
  );

  function normalizeFriendsAdvancedFilterState(value) {
    const source = value && typeof value === "object" ? value : {};
    const normalizeId = (candidate) => {
      const normalized = String(candidate ?? "").trim().replace(/^@+/, "");
      return /^[1-9]\d{0,19}$/.test(normalized) ? normalized : null;
    };
    const sortBy = FRIENDS_ADVANCED_SORT_VALUES.includes(source.sortBy)
      ? source.sortBy
      : "default";
    const rawStatuses = Array.isArray(source.statuses)
      ? source.statuses
      : source.status && source.status !== "any"
        ? [source.status]
        : [];
    const statuses = FRIENDS_ADVANCED_STATUS_VALUES.filter((status) =>
      rawStatuses.includes(status)
    );

    return {
      verifiedOnly: source.verifiedOnly === true || source.verifiedOnly === 1,
      robloxPlusOnly:
        source.robloxPlusOnly === true || source.robloxPlusOnly === 1,
      statuses,
      bestFriends: FRIENDS_ADVANCED_BEST_FRIENDS_VALUES.includes(
        source.bestFriends
      )
        ? source.bestFriends
        : "any",
      sortBy,
      gameUniverseId: normalizeId(source.gameUniverseId),
      gameRootPlaceId: normalizeId(source.gameRootPlaceId)
    };
  }

  function compareFriendsByAdvancedSort(left, right, sortBy) {
    const compareText = (leftValue, rightValue, descending = false) => {
      const result = String(leftValue || "").localeCompare(
        String(rightValue || ""),
        undefined,
        { sensitivity: "base", numeric: true }
      );
      return descending ? -result : result;
    };
    if (sortBy === "display-name-asc" || sortBy === "display-name-desc") {
      return compareText(
        left?.displayName,
        right?.displayName,
        sortBy === "display-name-desc"
      );
    }
    if (sortBy === "username-asc" || sortBy === "username-desc") {
      return compareText(
        left?.username,
        right?.username,
        sortBy === "username-desc"
      );
    }
    const rank = (friend) => {
      if (sortBy === "in-experience-first") {
        return friend?.presenceType === "InGame" ? 0 : 1;
      }
      if (sortBy === "online-first") {
        return friend?.presenceType === "Online" ? 0 : 1;
      }
      if (sortBy === "offline-first") {
        return friend?.presenceType === "Offline" ? 0 : 1;
      }
      if (sortBy === "best-friends-first") {
        return friend?.isBestFriend === true ? 0 : 1;
      }
      if (sortBy === "verified-first") {
        return friend?.isVerified === true ? 0 : 1;
      }
      return 0;
    };
    return rank(left) - rank(right);
  }

  function applyFriendsAdvancedFilters(friends, rawState) {
    const source = rawState && typeof rawState === "object" ? rawState : {};
    const normalizeId = (candidate) => {
      const normalized = String(candidate ?? "").trim().replace(/^@+/, "");
      return /^[1-9]\d{0,19}$/.test(normalized) ? normalized : null;
    };
    const state = {
      verifiedOnly: source.verifiedOnly === true || source.verifiedOnly === 1,
      robloxPlusOnly:
        source.robloxPlusOnly === true || source.robloxPlusOnly === 1,
      statuses: FRIENDS_ADVANCED_STATUS_VALUES.filter((status) =>
        (Array.isArray(source.statuses)
          ? source.statuses
          : source.status && source.status !== "any"
            ? [source.status]
            : []
        ).includes(status)
      ),
      bestFriends: FRIENDS_ADVANCED_BEST_FRIENDS_VALUES.includes(
        source.bestFriends
      )
        ? source.bestFriends
        : "any",
      sortBy: FRIENDS_ADVANCED_SORT_VALUES.includes(source.sortBy)
        ? source.sortBy
        : "default",
      gameUniverseId: normalizeId(source.gameUniverseId),
      gameRootPlaceId: normalizeId(source.gameRootPlaceId)
    };
    const matches = [];
    const unknown = [];

    for (const friend of Array.isArray(friends) ? friends : []) {
      let knownFalse = false;
      let hasUnknown = false;

      if (state.verifiedOnly) {
        if (friend?.isVerifiedKnown === false) {
          hasUnknown = true;
        } else if (friend?.isVerified !== true) {
          knownFalse = true;
        }
      }

      if (!knownFalse && state.robloxPlusOnly) {
        if (friend?.isRobloxPlusKnown !== true) {
          hasUnknown = true;
        } else if (friend?.isRobloxPlus !== true) {
          knownFalse = true;
        }
      }

      if (!knownFalse && state.statuses.length > 0) {
        const presenceByStatus = {
          "in-experience": "InGame",
          online: "Online",
          offline: "Offline",
          studio: "InStudio"
        };
        if (
          !state.statuses.some(
            (status) => friend?.presenceType === presenceByStatus[status]
          )
        ) {
          knownFalse = true;
        }
      }

      if (!knownFalse && state.bestFriends !== "any") {
        if (friend?.isBestFriendKnown === false) {
          hasUnknown = true;
        } else if (
          (state.bestFriends === "only" && friend?.isBestFriend !== true) ||
          (state.bestFriends === "exclude" && friend?.isBestFriend === true)
        ) {
          knownFalse = true;
        }
      }

      if (!knownFalse && (state.gameUniverseId || state.gameRootPlaceId)) {
        const universeId = /^[1-9]\d{0,19}$/.test(String(friend?.universeId ?? ""))
          ? String(friend.universeId)
          : null;
        const rootPlaceId = /^[1-9]\d{0,19}$/.test(String(friend?.rootPlaceId ?? ""))
          ? String(friend.rootPlaceId)
          : null;
        const gameMatches = Boolean(
          (state.gameUniverseId && universeId === state.gameUniverseId) ||
          (state.gameRootPlaceId && rootPlaceId === state.gameRootPlaceId)
        );
        if (!gameMatches) {
          if (
            friend?.presenceType === "InGame" &&
            !universeId &&
            !rootPlaceId
          ) {
            hasUnknown = true;
          } else {
            knownFalse = true;
          }
        }
      }

      if (!knownFalse) {
        (hasUnknown ? unknown : matches).push(friend);
      }
    }

    matches.sort((left, right) =>
      compareFriendsByAdvancedSort(left, right, state.sortBy)
    );
    unknown.sort((left, right) =>
      compareFriendsByAdvancedSort(left, right, state.sortBy)
    );
    return { friends: matches, unknown };
  }

  const QUICK_SETTING_SNAPSHOT_ALIASES = Object.freeze([
    "onlineStatus",
    "currentExperience",
    "inventory"
  ]);

  const QUICK_SETTING_DEFINITIONS = Object.freeze([
    Object.freeze({
      alias: "onlineStatus",
      label: "Online Status",
      description:
        "Who can see when you are online. Roblox may also adjust Current Experience; RoTool restores your previous choice when allowed."
    }),
    Object.freeze({
      alias: "currentExperience",
      label: "Current Experience",
      description:
        "Who can see and join the experience you are currently playing."
    }),
    Object.freeze({
      alias: "inventory",
      label: "Inventory Visibility",
      description: "Who can view your Roblox inventory."
    })
  ]);

  const QUICK_SETTING_VALUE_LABELS = Object.freeze({
    AllUsers: "Everyone",
    All: "Everyone",
    FriendsFollowingAndFollowers: "Friends + following + followers",
    Followers: "Friends + following + followers",
    FriendsAndFollowing: "Friends + following",
    Following: "Friends + following",
    Friends: "Friends",
    TrustedFriends: "Trusted Friends",
    NoOne: "No one",
    everyone: "Everyone",
    friendsFollowers: "Friends + following + followers",
    friendsFollowing: "Friends + following",
    friends: "Friends",
    trustedFriends: "Trusted Friends",
    noOne: "No one",
    custom: "Custom"
  });

  const FEATURE_DEFINITIONS = Object.freeze([
    Object.freeze({
      key: "sidebarShortcuts",
      group: "Interface",
      label: "Sidebar Customization",
      description: "Customize shortcuts and native links in Roblox's sidebar.",
      children: [
        Object.freeze({
          key: "sidebarGameEvents",
          label: "Game Events",
          description: "Show RoTool's Game Events sidebar button.",
          section: "RoTool"
        }),
        Object.freeze({
          key: "sidebarJoinScheduler",
          label: "Join Scheduler",
          description: "Show RoTool's Join Scheduler sidebar button.",
          section: "RoTool"
        }),
        Object.freeze({
          key: "sidebarServerHistory",
          label: "Server History",
          description: "Show RoTool's Server History sidebar button.",
          section: "RoTool"
        }),
        Object.freeze({
          key: "sidebarCustomShortcuts",
          label: "Custom Shortcuts",
          description: "Show saved sidebar links and the Add shortcut button.",
          section: "RoTool"
        }),
        Object.freeze({
          key: "sidebarHome",
          label: "Home",
          description: "Show Roblox's Home sidebar link.",
          section: "Roblox"
        }),
        Object.freeze({
          key: "sidebarProfile",
          label: "Profile",
          description: "Show Roblox's Profile sidebar link.",
          section: "Roblox"
        }),
        Object.freeze({
          key: "sidebarRobloxPlus",
          label: "Roblox Plus",
          description: "Show Roblox's subscription sidebar link.",
          section: "Roblox"
        }),
        Object.freeze({
          key: "sidebarMessages",
          label: "Messages",
          description: "Show Roblox's Messages sidebar link.",
          section: "Roblox"
        }),
        Object.freeze({
          key: "sidebarFriends",
          label: "Friends",
          description: "Show Roblox's Friends sidebar link.",
          section: "Roblox"
        }),
        Object.freeze({
          key: "sidebarAvatar",
          label: "Avatar",
          description: "Show Roblox's Avatar sidebar link.",
          section: "Roblox"
        }),
        Object.freeze({
          key: "sidebarInventory",
          label: "Inventory",
          description: "Show Roblox's Inventory sidebar link.",
          section: "Roblox"
        }),
        Object.freeze({
          key: "sidebarTrade",
          label: "Trade",
          description: "Show Roblox's Trade sidebar link.",
          section: "Roblox"
        }),
        Object.freeze({
          key: "sidebarCommunities",
          label: "Communities",
          description: "Show Roblox's Communities sidebar link.",
          section: "Roblox"
        }),
        Object.freeze({
          key: "sidebarBlog",
          label: "Blog",
          description: "Show Roblox's Blog sidebar link.",
          section: "Roblox"
        }),
        Object.freeze({
          key: "sidebarOfficialStore",
          label: "Official Store",
          description: "Show Roblox's Official Store sidebar button.",
          section: "Roblox"
        }),
        Object.freeze({
          key: "sidebarGiftCards",
          label: "Buy Gift Cards",
          description: "Show Roblox's Buy Gift Cards sidebar link.",
          section: "Roblox"
        })
      ]
    }),
    Object.freeze({
      key: "quickSettings",
      group: "Interface",
      label: "Quick Settings",
      description: "Show selected Roblox privacy controls on Home.",
      children: [
        Object.freeze({
          key: "quickSettingsOnlineStatus",
          label: "Online Status",
          description: "Show the Online Status control."
        }),
        Object.freeze({
          key: "quickSettingsCurrentExperience",
          label: "Current Experience",
          description: "Show the Current Experience control."
        }),
        Object.freeze({
          key: "quickSettingsInventory",
          label: "Inventory Visibility",
          description: "Show the Inventory Visibility control."
        })
      ]
    }),
    Object.freeze({
      key: "bestFriends",
      group: "Interface",
      label: "Best Friends",
      description: "Show the Home row and the Best Friends page filter."
    }),
    Object.freeze({
      key: "friendFilters",
      group: "Interface",
      label: "Friend Lists & Filters",
      description: "Fix All and add complete friend lists with advanced Filters."
    }),
    Object.freeze({
      key: "quickPlay",
      group: "Experiences",
      label: "Quick Play & Servers",
      description: "Show launch controls on experience cards.",
      children: [
        Object.freeze({
          key: "quickPlayActionPlay",
          label: "Quick Play",
          description: "Show the direct Quick Play button."
        }),
        Object.freeze({
          key: "quickPlayActionPrivate",
          label: "Private Servers",
          description: "Show the Private Servers browser."
        }),
        Object.freeze({
          key: "quickPlayActionRandom",
          label: "Random Server",
          description: "Show the Random Server button."
        })
      ]
    }),
    Object.freeze({
      key: "gameCcu",
      group: "Experiences",
      label: "Player Counts (CCU)",
      description: "Show player counts on experience cards."
    }),
    Object.freeze({
      key: "gameCcuHoverGraph",
      group: "Experiences",
      label: "CCU Hover Graph",
      description: "Show the 12-hour graph when hovering or focusing any player count."
    }),
    Object.freeze({
      key: "gameEvents",
      group: "Tools",
      label: "Game Events",
      description: "Follow official events from games you choose."
    }),
    Object.freeze({
      key: "joinScheduler",
      group: "Tools",
      label: "Join Scheduler",
      description: "Plan one-time reminders or consented join attempts."
    }),
    Object.freeze({
      key: "serverHistory",
      group: "Tools",
      label: "Server History",
      description: "Keep the latest 30 servers you join on this device.",
      defaultEnabled: false
    }),
    Object.freeze({
      key: "copyRobloxIds",
      group: "Tools",
      label: "Copy Roblox IDs",
      description: "Add Roblox ID commands to the browser right-click menu."
    })
  ]);
  const FEATURE_SETTING_DEFINITIONS = Object.freeze(
    FEATURE_DEFINITIONS.flatMap((definition) => [
      definition,
      ...(definition.children || []).map((child) =>
        Object.freeze({ ...child, parentKey: definition.key })
      )
    ])
  );
  const DEFAULT_FEATURE_SETTINGS = Object.freeze(
    Object.fromEntries(
      FEATURE_SETTING_DEFINITIONS.map(({ key, defaultEnabled }) => [
        key,
        defaultEnabled !== false
      ])
    )
  );

  const NATIVE_ANCHOR_SELECTORS = [
    "#nav-giftcards",
    "#nav-shop",
    "#nav-trade",
    "#nav-inventory",
    "#nav-avatar",
    "#nav-friends",
    "#nav-message",
    "#nav-profile",
    "#nav-home"
  ];

  const SHORTCUT_ICON_MARKUP = Object.freeze({
    home: '<path d="m3 11 9-7 9 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9.5 20v-6h5v6"/>',
    game: '<path d="M8 8h8a5 5 0 0 1 4.7 6.7l-1 3a2 2 0 0 1-3.3.8L14.3 17H9.7l-2.1 1.5a2 2 0 0 1-3.3-.8l-1-3A5 5 0 0 1 8 8Z"/><path d="M8 11v4M6 13h4"/><circle cx="16" cy="12" r=".8"/><circle cx="18" cy="14" r=".8"/>',
    profile: '<circle cx="12" cy="8" r="3.5"/><path d="M5.5 20v-1.5A5.5 5.5 0 0 1 11 13h2a5.5 5.5 0 0 1 5.5 5.5V20"/>',
    community: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h2a4.5 4.5 0 0 1 4.5 4.5V20"/><path d="M14.5 15a4 4 0 0 1 6 3.5V20"/>',
    marketplace: '<path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/>',
    inventory: '<path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/>',
    avatar: '<path d="m8 4 4 2 4-2 5 3-2.5 4-2-1v10h-9V10l-2 1L3 7l5-3Z"/>',
    friends: '<circle cx="9" cy="8" r="3"/><path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h2a4.5 4.5 0 0 1 4.5 4.5V20"/><path d="M18 8v6M15 11h6"/>',
    trade: '<path d="M4 8h14l-3-3M20 16H6l3 3"/><path d="m18 8-3 3M6 16l3-3"/>',
    message: '<path d="M4 5h16v12H9l-5 4V5Z"/><path d="M8 9h8M8 13h5"/>',
    chart: '<path d="M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7M3 20h18"/>',
    settings: '<path d="M4 7h10M18 7h2M4 12h2M10 12h10M4 17h8M16 17h4"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="14" cy="17" r="2"/>',
    gift: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 11h18M12 7v13"/><path d="M12 7H8.5a2 2 0 1 1 2-2c0 1.2 1.5 2 1.5 2ZM12 7h3.5a2 2 0 1 0-2-2c0 1.2-1.5 2-1.5 2Z"/>',
    premium: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>',
    create: '<path d="m14 5 5 5M4 20l3.5-.8L20 6.7 17.3 4 4.8 16.5 4 20Z"/><path d="m13 6 5 5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/><path d="M7 14h2M11 14h2M15 14h2M7 18h2M11 18h2"/>',
    schedule: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/><circle cx="13" cy="15" r="4"/><path d="M13 13v2.5l1.7 1"/>',
    history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.2-5.7"/><path d="M3.5 4.5v5h5"/><path d="M12 7.5V12l3 2"/>',
    external: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
    link: '<path d="m9.5 14.5 5-5"/><path d="m7.5 16.5-1.7 1.7A3 3 0 0 1 1.6 14l3.2-3.2A3 3 0 0 1 9 10.7"/><path d="m16.5 7.5 1.7-1.7a3 3 0 0 1 4.2 4.2l-3.2 3.2a3 3 0 0 1-4.2.1"/>'
  });

  let shortcuts = [];
  let featureSettings = { ...DEFAULT_FEATURE_SETTINGS };
  let featureSettingsConfirmed = { ...DEFAULT_FEATURE_SETTINGS };
  let featureSettingsApplied = { ...DEFAULT_FEATURE_SETTINGS };
  let featureSettingsLoaded = false;
  let featureSettingsLoadGeneration = 0;
  let featureSettingsSaving = false;
  let featureSettingsPendingWrites = 0;
  let featureSettingsSaveChain = Promise.resolve();
  let featureSettingsDeferredStorageValue = null;
  let featureSettingsReconcileScheduled = false;
  let featureSettingsReconcileFrame = null;
  let featureSettingsReconcileTimer = null;
  let featureSettingsDialogOpener = null;
  let featureSettingsNotice = "";
  let featureSettingsNoticeIsError = false;
  let gameEventsDialogOpener = null;
  let gameEventsLifecycleEpoch = 0;
  let gameEventsRequestSequence = 0;
  let gameEventsLoadState = "idle";
  let gameEventsErrorCode = "";
  let gameEventsFavorites = [];
  let gameEventsItems = [];
  let gameEventsViewerUserId = null;
  let gameEventsPartial = false;
  let gameEventsStatusFilter = "all";
  let gameEventsLiveSectionCollapsed = false;
  let gameEventsAddPanelOpen = false;
  let gameEventsManagePanelOpen = false;
  let gameEventsPendingAction = null;
  let gameEventsNotice = "";
  let gameEventsMessageSenderForTests = null;
  let gameEventsSearchTimer = null;
  let gameEventsSearchSequence = 0;
  let gameEventsSearchState = "idle";
  let gameEventsSearchErrorCode = "";
  let gameEventsSearchResults = [];
  let gameEventsSearchActiveIndex = -1;
  let gameEventsSelectedSearchResult = null;
  let gameEventsMinuteTimer = null;
  let gameEventsBoundaryTimer = null;
  let gameEventsResizeObserver = null;
  const gameEventsThumbnailByUniverseId = new Map();
  const gameEventsThumbnailRequestByUniverseId = new Map();
  let gameEventsThumbnailObserver = null;
  let nativeEventScheduleLifecycleEpoch = 0;
  let nativeEventScheduleRequestSequence = 0;
  let nativeEventScheduleRoutePlaceId = null;
  let nativeEventScheduleCardFingerprint = "";
  let nativeEventScheduleRequestPending = false;
  let nativeEventScheduleItemsById = new Map();
  let nativeEventScheduleBoundaryTimer = null;
  let nativeEventScheduleRefreshTimer = null;
  let nativeEventScheduleNextRefreshAt = 0;
  let nativeEventScheduleMessageSenderForTests = null;
  let serverHistoryDialogOpener = null;
  let serverHistoryLifecycleEpoch = 0;
  let serverHistoryRequestSequence = 0;
  let serverHistoryLoadState = "idle";
  let serverHistoryErrorCode = "";
  let serverHistorySessions = [];
  let serverHistoryPendingRejoinId = null;
  let serverHistoryConfirmClear = false;
  let serverHistoryClearPending = false;
  let serverHistoryNotice = "";
  let serverHistoryMessageSenderForTests = null;
  let serverHistoryMidnightTimer = null;
  let serverHistoryRelativeTimeTimer = null;
  const serverHistoryThumbnailByUniverseId = new Map();
  const serverHistoryThumbnailRequestByUniverseId = new Map();
  let mountQueued = false;
  let lastFocusedElement = null;
  let draggedShortcutId = null;
  let activeFriendsPresenceFilter = null;
  let suppressNativeFriendsFilterClick = false;
  let activeFriendsChipClass = "";
  let inactiveFriendsChipClass = "";
  let observedFriendsMount = null;
  let friendsMutationObserver = null;
  let onlineFriendsLoadState = "idle";
  let allOnlineFriends = [];
  let allOfflineFriends = [];
  let allFriendUserIds = [];
  let allFriendsTotal = null;
  let onlineFriendsTotal = null;
  let offlineFriendsTotal = null;
  let onlineFriendsViewerUserId = null;
  let onlineFriendsDetailsComplete = false;
  let offlineFriendsDetailsComplete = false;
  let onlineFriendsVerificationComplete = false;
  let offlineFriendsVerificationComplete = false;
  let onlineFriendsRobloxPlusComplete = false;
  let offlineFriendsRobloxPlusComplete = false;
  let onlineFriendsFetchedAt = 0;
  let onlineFriendsErrorCode = "";
  let onlineFriendsRequestId = 0;
  let onlineFriendsRequestPromise = null;
  let onlineFriendsDetailsPromise = null;
  let offlineFriendsDetailsPromise = null;
  let offlineFriendsDetailsRequestId = 0;
  let onlineFriendsRefreshTimer = null;
  let nativeFriendCardTemplate = null;
  let friendsAdvancedAppliedState = normalizeFriendsAdvancedFilterState(null);
  let friendsAdvancedDraftState = normalizeFriendsAdvancedFilterState(null);
  let friendsAdvancedAppliedTargets = Object.freeze({
    game: null
  });
  let friendsAdvancedDraftTargets = {
    game: null
  };
  let friendsAdvancedDraftInputs = {
    game: ""
  };
  let friendsAdvancedDialogOpener = null;
  let friendsAdvancedResolveRequestId = 0;
  let friendsAdvancedResolvingField = "";
  let friendsAdvancedResolveStatus = "";
  let friendsAdvancedResolveStatusIsError = false;
  let friendsAdvancedRequestGeneration = 0;
  let friendsAdvancedMetadataRevision = 0;
  let friendsAdvancedLoadState = "idle";
  let friendsAdvancedStatus = "";
  let friendsAdvancedStatusIsError = false;
  let friendsAdvancedUnknownCount = 0;
  let friendsAdvancedMatchCount = 0;
  let friendsAdvancedBestFriendsReady = true;
  let bestFriendsViewerUserId = null;
  let bestFriendsCanChat = false;
  let bestFriendUserIds = [];
  let bestFriendDetails = [];
  let bestFriendsLoadState = "idle";
  let bestFriendsErrorCode = "";
  let bestFriendsRequestId = 0;
  let bestFriendsRequestPromise = null;
  let bestFriendsPickerLoadState = "idle";
  let bestFriendsPickerErrorCode = "";
  let bestFriendsPickerFriends = [];
  let bestFriendsPickerPromise = null;
  let bestFriendsPickerRequestId = 0;
  let bestFriendsDraftIds = new Set();
  let bestFriendsDialogOpener = null;
  let bestFriendsHomeActive = false;
  let bestFriendsFetchedAt = 0;
  let bestFriendsLastRequestStartedAt = 0;
  let bestFriendsHomeRefreshTimer = null;
  let homeFriendsCollapsed = false;
  let homeFriendsCollapsedConfirmed = false;
  let homeFriendsCollapsedDeferredStorageValue = null;
  let homeFriendsCollapsedLoadGeneration = 0;
  let homeFriendsCollapsedWriteGeneration = 0;
  let homeFriendsCollapsedPendingWrites = 0;
  let homeFriendsCollapsedWriteTail = Promise.resolve();
  let bestFriendsCollapsed = false;
  let bestFriendsCollapsedConfirmed = false;
  let bestFriendsCollapsedDeferredStorageValue = null;
  let bestFriendsCollapsedLoadGeneration = 0;
  let bestFriendsCollapsedWriteGeneration = 0;
  let bestFriendsCollapsedPendingWrites = 0;
  let bestFriendsCollapsedWriteTail = Promise.resolve();
  let bestFriendHoverCard = null;
  let bestFriendHoverAnchor = null;
  let bestFriendHoverThumbnailToken = 0;
  let bestFriendsGeometryObserver = null;
  let observedBestFriendsGeometryCarousel = null;
  let observedBestFriendsGeometryQuickSettings = null;
  let observedBestFriendsGeometrySignature = "";
  let bestFriendsScrollLockUntil = 0;
  let bestFriendsScrollSettleTimer = null;
  const bestFriendsInitialLayoutRecheckTimers = new Set();
  let quickSettingsViewerUserId = null;
  let quickSettingsLoadState = "idle";
  let quickSettingsValues = Object.create(null);
  let quickSettingsErrorCode = "";
  let quickSettingsNotice = "";
  let quickSettingsMessageSequence = 0;
  let quickSettingsReadOperationId = 0;
  let quickSettingsLifecycleEpoch = 0;
  let quickSettingsRequestPromise = null;
  let quickSettingsFocusRestoreId = "";
  let quickSettingsCollapsed = false;
  let quickSettingsCollapsedConfirmed = false;
  let quickSettingsCollapsedDeferredStorageValue = null;
  let quickSettingsCollapsedLoadGeneration = 0;
  let quickSettingsCollapsedWriteGeneration = 0;
  let quickSettingsCollapsedPendingWrites = 0;
  let quickSettingsCollapsedWriteTail = Promise.resolve();
  const quickSettingsPendingOperations = new Map();
  let quickPlayRandomRequestId = 0;
  let quickPlayPrivateSupportRequestId = 0;
  let quickPlayGeometryObserver = null;
  let gameTileCcuRequestId = 0;
  let gameTileCcuLifecycleEpoch = 0;
  let gameTileCcuRefreshTimer = null;
  let gameTileCcuRefreshTimerDueAt = 0;
  let gameTileCcuIdentityByRoot = new WeakMap();
  let gameTileCcuGraphRequestId = 0;
  let gameTileCcuGraphPatternId = 0;
  let gameTileCcuGraphLifecycleEpoch = 0;
  let gameTileCcuGraphEventsBound = false;
  let activeGameTileCcuGraph = null;
  let gameTileCcuGraphHoverIntent = null;
  let activePrivateServerSupportRequests = 0;
  let privateServersDialogOpener = null;
  let privateServersPlaceId = null;
  let privateServersCardName = "";
  let privateServersPrice = null;
  let privateServersSearchQuery = "";
  let privateServers = [];
  let privateServersNextPageCursor = null;
  let privateServersLoadedPageCount = 0;
  let privateServersLoadState = "idle";
  let privateServersErrorCode = "";
  let privateServersGameJoinRestricted = false;
  let privateServersRequestId = 0;
  let privateServersRequestPromise = null;
  let privateServerJoinRequestId = 0;
  let privateServerJoinPromise = null;
  let privateServerJoiningToken = null;
  let privateServerOwnerThumbnailRequestId = 0;
  let privateServerThumbnailLoadToken = 0;
  let ownedThumbnailLoadToken = 0;
  const bestFriendGameThumbnailUrls = new Map();
  const bestFriendGameThumbnailRequests = new Map();
  const privateServerSupportByPlaceId = new Map();
  const privateServerSupportRequestsByPlaceId = new Map();
  const privateServerSupportRetryByPlaceId = new Map();
  const privateServerSupportRequestQueue = [];
  const privateServerSupportInteractionBindings = new WeakMap();
  const gameTileCcuCacheByPlaceId = new Map();
  const gameTileCcuPendingPlaceIds = new Set();
  const gameTileCcuRetryAfterByPlaceId = new Map();
  const gameTileCcuQueuedByPlaceId = new Map();
  const gameTileCcuGraphUniverseByPlaceId = new Map();
  const gameTileCcuGraphHistoryCache = new Map();
  const gameTileCcuGraphHistoryRequests = new Map();
  const gameTileCcuGraphInteractionModels = new WeakMap();
  const privateServersByToken = new Map();
  const privateServersLoadedCursors = new Set();
  const privateServerOwnerThumbnailUrls = new Map();
  const privateServerOwnerThumbnailUnavailableUntil = new Map();
  const privateServerOwnerThumbnailPendingIds = new Set();

  const bestFriendActionTimers = new WeakMap();
  const quickPlayFeedbackTimers = new WeakMap();

  const boundFriendsFilterGroups = new WeakSet();
  const boundFriendsSearchInputs = new WeakSet();

  function isExtensionRow(row) {
    return Boolean(
      row &&
      (row.id === ADD_ROW_ID || row.hasAttribute(ROW_ATTRIBUTE) || row.dataset.rslControl)
    );
  }

  function storageGet() {
    return new Promise((resolve) => {
      chrome.storage.local.get({ [STORAGE_KEY]: [] }, (result) => {
        const value = result[STORAGE_KEY];
        resolve(Array.isArray(value) ? value : []);
      });
    });
  }

  function storageSet(value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: value }, resolve);
    });
  }

  function normalizeFeatureSettings(rawValue) {
    const rawFlags =
      rawValue &&
      typeof rawValue === "object" &&
      rawValue.version === FEATURE_SETTINGS_VERSION &&
      rawValue.flags &&
      typeof rawValue.flags === "object"
        ? rawValue.flags
        : {};
    const normalized = { ...DEFAULT_FEATURE_SETTINGS };
    for (const { key } of FEATURE_SETTING_DEFINITIONS) {
      if (typeof rawFlags[key] === "boolean") {
        normalized[key] = rawFlags[key];
      }
    }
    return normalized;
  }

  function featureSettingsEqual(left, right) {
    return FEATURE_SETTING_DEFINITIONS.every(({ key }) => left?.[key] === right?.[key]);
  }

  function serializeFeatureSettings(flags = featureSettings) {
    return {
      version: FEATURE_SETTINGS_VERSION,
      flags: Object.fromEntries(
        FEATURE_SETTING_DEFINITIONS.map(({ key }) => [key, flags[key] !== false])
      )
    };
  }

  function featureSettingsStorageGet() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(
        { [FEATURE_SETTINGS_STORAGE_KEY]: null },
        (result) => {
          const readError = chrome.runtime.lastError;
          if (readError) {
            reject(new Error(readError.message));
            return;
          }
          resolve(normalizeFeatureSettings(result?.[FEATURE_SETTINGS_STORAGE_KEY]));
        }
      );
    });
  }

  function featureSettingsStorageSet(flags) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(
        { [FEATURE_SETTINGS_STORAGE_KEY]: serializeFeatureSettings(flags) },
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
  }

  function quickSettingsCollapsedStorageGet() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(
        { [QUICK_SETTINGS_COLLAPSED_STORAGE_KEY]: false },
        (result) => {
          const readError = chrome.runtime.lastError;
          if (readError) {
            reject(new Error(readError.message));
            return;
          }
          resolve(result?.[QUICK_SETTINGS_COLLAPSED_STORAGE_KEY] === true);
        }
      );
    });
  }

  function quickSettingsCollapsedStorageSet(collapsed) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(
        { [QUICK_SETTINGS_COLLAPSED_STORAGE_KEY]: collapsed === true },
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
  }

  function bestFriendsCollapsedStorageGet() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(
        { [BEST_FRIENDS_COLLAPSED_STORAGE_KEY]: false },
        (result) => {
          const readError = chrome.runtime.lastError;
          if (readError) {
            reject(new Error(readError.message));
            return;
          }
          resolve(result?.[BEST_FRIENDS_COLLAPSED_STORAGE_KEY] === true);
        }
      );
    });
  }

  function bestFriendsCollapsedStorageSet(collapsed) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(
        { [BEST_FRIENDS_COLLAPSED_STORAGE_KEY]: collapsed === true },
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
  }

  function homeFriendsCollapsedStorageGet() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(
        { [HOME_FRIENDS_COLLAPSED_STORAGE_KEY]: false },
        (result) => {
          const readError = chrome.runtime.lastError;
          if (readError) {
            reject(new Error(readError.message));
            return;
          }
          resolve(result?.[HOME_FRIENDS_COLLAPSED_STORAGE_KEY] === true);
        }
      );
    });
  }

  function homeFriendsCollapsedStorageSet(collapsed) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(
        { [HOME_FRIENDS_COLLAPSED_STORAGE_KEY]: collapsed === true },
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
  }

  function isFeatureEnabled(key) {
    return featureSettings[key] !== false;
  }

  const QUICK_SETTING_FEATURE_KEYS = Object.freeze({
    onlineStatus: "quickSettingsOnlineStatus",
    currentExperience: "quickSettingsCurrentExperience",
    inventory: "quickSettingsInventory"
  });

  function isQuickSettingEnabled(alias, settings = featureSettings) {
    const featureKey = QUICK_SETTING_FEATURE_KEYS[alias];
    return Boolean(
      featureKey &&
        settings?.quickSettings !== false &&
        settings?.[featureKey] !== false
    );
  }

  function getEnabledQuickSettingAliases(settings = featureSettings) {
    return QUICK_SETTING_DEFINITIONS
      .map(({ alias }) => alias)
      .filter((alias) => isQuickSettingEnabled(alias, settings));
  }

  function hasQuickSettingsSnapshotForEnabledControls() {
    const requiredAliases = getEnabledQuickSettingAliases();
    return (
      requiredAliases.length > 0 &&
      requiredAliases.every((alias) => Boolean(quickSettingsValues[alias]))
    );
  }

  function isQuickPlayActionEnabled(action) {
    const settingByAction = {
      play: "quickPlayActionPlay",
      private: "quickPlayActionPrivate",
      random: "quickPlayActionRandom"
    };
    const key = settingByAction[action];
    return Boolean(key && isFeatureEnabled("quickPlay") && isFeatureEnabled(key));
  }

  function getNativeSidebarSemanticKey(row) {
    if (
      !row?.matches?.("li") ||
      isExtensionRow(row) ||
      (row.matches?.("li[data-ropro-sidebar-item]") ||
        row.hasAttribute?.("data-ropro-sidebar-item")) ||
      !row.closest("#left-navigation-container, .left-col-list")
    ) {
      return "";
    }
    const list = row.parentElement;
    const isLegacyNavigationRow = Boolean(list?.matches?.(".left-col-list"));
    const isRedesignedNavigationRow = Boolean(
      list?.parentElement?.matches?.("nav") &&
      list.closest?.("#left-navigation-container")
    );
    if (
      list &&
      !isLegacyNavigationRow &&
      !isRedesignedNavigationRow
    ) {
      return "";
    }
    const hasDomChildren = row.children != null;
    const directControls = hasDomChildren
      ? Array.from(row.children).filter((child) =>
          child.matches?.("a[href], button")
        )
      : [];
    // The fallback keeps the semantic helper usable in small DOM test doubles;
    // real Roblox rows always take the direct-child path above.
    const controls = hasDomChildren
      ? directControls
      : Array.from(row.querySelectorAll("a[href]"));
    const links = controls.filter((control) => control.matches?.("a[href]"));
    const directLink = links.length === 1 ? links[0] : null;
    const directButton = controls.length === 1 && controls[0].matches?.("button")
      ? controls[0]
      : null;
    const getRobloxPathname = (link) => {
      if (!link) {
        return "";
      }
      try {
        const url = new URL(link.href, location.origin);
        const hostname = url.hostname.toLowerCase();
        return hostname === "roblox.com" || hostname.endsWith(".roblox.com")
          ? url.pathname.toLowerCase().replace(/\/+$/, "") || "/"
          : "";
      } catch {
        return "";
      }
    };
    const rawPathname = getRobloxPathname(directLink);
    const pathname = rawPathname.replace(
      /^\/(?!my(?:\/|$))[a-z]{2}(?=\/)/,
      ""
    ) || "/";
    const directMatches = (selector) => Boolean(
      directLink?.matches?.(selector) || directButton?.matches?.(selector)
    );
    const directHas = (selector) => Boolean(
      directLink?.querySelector?.(selector) || directButton?.querySelector?.(selector)
    );
    const isRedesignedStandardControl = (control) => Boolean(
      control?.classList?.contains?.("text-title-large") &&
      control?.classList?.contains?.("flex") &&
      control?.classList?.contains?.("items-center")
    );
    const isRedesignedStandardLink = isRedesignedStandardControl(directLink);
    const hasRedesignedIcon = (selector) => Boolean(
      isRedesignedStandardLink && directHas(selector)
    );
    if (
      directMatches("#nav-home") ||
      (pathname === "/home" && hasRedesignedIcon(".icon-regular-house"))
    ) {
      return "home";
    }
    if (
      directMatches("#nav-profile") ||
      (pathname === "/users/profile" && hasRedesignedIcon(".icon-regular-person"))
    ) {
      return "profile";
    }
    if (
      directMatches("#nav-message") ||
      (pathname === "/my/messages" &&
        hasRedesignedIcon(".icon-regular-speech-bubble-align-center"))
    ) {
      return "messages";
    }
    if (
      directMatches("#nav-friends") ||
      (pathname === "/users/friends" &&
        hasRedesignedIcon(".icon-regular-two-people"))
    ) {
      return "friends";
    }
    if (
      directMatches("#nav-avatar, #nav-character") ||
      (pathname === "/my/avatar" &&
        hasRedesignedIcon(".icon-regular-person-standing"))
    ) {
      return "avatar";
    }
    if (
      directMatches("#nav-inventory") ||
      (pathname === "/users/inventory" &&
        hasRedesignedIcon(".icon-regular-backpack"))
    ) {
      return "inventory";
    }
    if (
      directMatches("#nav-trade") ||
      (pathname === "/trades" &&
        hasRedesignedIcon(".icon-regular-hand-two-arrows-horizontal"))
    ) {
      return "trade";
    }
    if (
      directMatches("#nav-group") ||
      (pathname === "/communities" &&
        hasRedesignedIcon(".icon-regular-three-people"))
    ) {
      return "communities";
    }
    if (
      directMatches("#nav-blog") ||
      (() => {
        try {
          return new URL(directLink?.href || "", location.origin).hostname
            .toLowerCase() === "blog.roblox.com" &&
            hasRedesignedIcon(".icon-regular-fountain-pen-nib");
        } catch {
          return false;
        }
      })()
    ) {
      return "blog";
    }
    if (
      (pathname === "/plus" &&
        hasRedesignedIcon(".icon-regular-roblox-plus"))
    ) {
      return "robloxPlus";
    }
    const isGiftCards = links.some((link) => {
      if (link.matches?.("#nav-giftcards")) {
        return true;
      }
      try {
        const url = new URL(link.href, location.origin);
        const hostname = url.hostname.toLowerCase();
        return (
          link === directLink &&
          isRedesignedStandardLink &&
          (hostname === "roblox.com" || hostname.endsWith(".roblox.com")) &&
          /^\/giftcards(?:-[a-z]{2}(?:-[a-z]{2})?)?$/.test(
            url.pathname.toLowerCase().replace(/\/+$/, "")
          ) &&
          hasRedesignedIcon(".icon-regular-gift-card")
        );
      } catch {
        return false;
      }
    }) || (!hasDomChildren && Boolean(row.querySelector(".icon-regular-gift-card")));
    if (isGiftCards) {
      return "giftCards";
    }
    if (
      directMatches("#nav-shop") ||
      (isRedesignedStandardControl(directButton) &&
        directHas(".icon-regular-building-store")) ||
      (!hasDomChildren &&
        (Boolean(row.querySelector("#nav-shop")) ||
          Boolean(row.querySelector(".icon-regular-building-store"))))
    ) {
      return "officialStore";
    }
    return "";
  }

  function cleanupNativeSidebarVisibility() {
    document
      .querySelectorAll(
        `#left-navigation-container [${NATIVE_SIDEBAR_HIDDEN_ATTRIBUTE}], ` +
          `.left-col-list [${NATIVE_SIDEBAR_HIDDEN_ATTRIBUTE}]`
      )
      .forEach((row) => row.removeAttribute(NATIVE_SIDEBAR_HIDDEN_ATTRIBUTE));
  }

  function syncNativeSidebarVisibility() {
    if (!isFeatureEnabled("sidebarShortcuts")) {
      cleanupNativeSidebarVisibility();
      return;
    }
    const roots = Array.from(
      document.querySelectorAll("#left-navigation-container, .left-col-list")
    );
    if (roots.length === 0) {
      return;
    }
    const hiddenByKey = {
      home: !isFeatureEnabled("sidebarHome"),
      profile: !isFeatureEnabled("sidebarProfile"),
      robloxPlus: !isFeatureEnabled("sidebarRobloxPlus"),
      messages: !isFeatureEnabled("sidebarMessages"),
      friends: !isFeatureEnabled("sidebarFriends"),
      avatar: !isFeatureEnabled("sidebarAvatar"),
      inventory: !isFeatureEnabled("sidebarInventory"),
      trade: !isFeatureEnabled("sidebarTrade"),
      communities: !isFeatureEnabled("sidebarCommunities"),
      blog: !isFeatureEnabled("sidebarBlog"),
      giftCards: !isFeatureEnabled("sidebarGiftCards"),
      officialStore: !isFeatureEnabled("sidebarOfficialStore")
    };
    roots.forEach((root) => {
      root.querySelectorAll("li").forEach((row) => {
        if (isExtensionRow(row)) {
          row.removeAttribute(NATIVE_SIDEBAR_HIDDEN_ATTRIBUTE);
          return;
        }
        const key = getNativeSidebarSemanticKey(row);
        if (key && hiddenByKey[key]) {
          row.setAttribute(NATIVE_SIDEBAR_HIDDEN_ATTRIBUTE, key);
        } else {
          // Roblox can reuse list rows while navigating. Never leave an owned
          // marker behind once that row no longer has the matched semantics.
          row.removeAttribute(NATIVE_SIDEBAR_HIDDEN_ATTRIBUTE);
        }
      });
    });
  }

  function normalizeBestFriendIds(rawIds) {
    const ids = [];
    const seen = new Set();
    for (const rawId of Array.isArray(rawIds) ? rawIds : []) {
      const userId = String(rawId ?? "");
      if (/^[1-9]\d{0,19}$/.test(userId) && !seen.has(userId)) {
        seen.add(userId);
        ids.push(userId);
      }
      if (ids.length >= MAX_BEST_FRIENDS) {
        break;
      }
    }
    return ids;
  }

  function persistBestFriendIds(viewerUserId, rawIds) {
    const userId = String(viewerUserId ?? "");
    if (!/^[1-9]\d{0,19}$/.test(userId)) {
      return Promise.reject(new Error("The signed-in Roblox account could not be identified."));
    }
    const ids = normalizeBestFriendIds(rawIds);

    return new Promise((resolve, reject) => {
      chrome.storage.local.get({ [BEST_FRIENDS_STORAGE_KEY]: {} }, (result) => {
        const readError = chrome.runtime.lastError;
        if (readError) {
          reject(new Error(readError.message));
          return;
        }

        const current = result?.[BEST_FRIENDS_STORAGE_KEY];
        const next = current && typeof current === "object" ? { ...current } : {};
        next[userId] = ids;
        chrome.storage.local.set({ [BEST_FRIENDS_STORAGE_KEY]: next }, () => {
          const writeError = chrome.runtime.lastError;
          if (writeError) {
            reject(new Error(writeError.message));
            return;
          }
          resolve(ids);
        });
      });
    });
  }

  function shortcutListsEqual(left, right) {
    return (
      left.length === right.length &&
      left.every((entry, index) => {
        const other = right[index];
        return (
          entry?.id === other?.id &&
          entry?.label === other?.label &&
          entry?.url === other?.url
        );
      })
    );
  }

  function findRedesignedNativeRow() {
    const root = document.querySelector("#left-navigation-container");
    if (!root) {
      return null;
    }

    const pathHints = [
      "/giftcards",
      "/inventory",
      "/friends",
      "/my/avatar",
      "/communities",
      "/home"
    ];

    const candidates = new Map();

    for (const anchor of root.querySelectorAll("a[href]")) {
      const row = anchor.closest("li");
      const list = row?.closest("ul");
      if (!row || !list || isExtensionRow(row)) {
        continue;
      }

      let pathname;
      try {
        pathname = new URL(anchor.href, location.origin).pathname.toLowerCase();
      } catch {
        continue;
      }

      if (!pathHints.some((hint) => pathname.includes(hint))) {
        continue;
      }

      const entry = candidates.get(list) || { score: 0, anchors: [] };
      entry.score += 1;
      entry.anchors.push({ anchor, row, pathname });
      candidates.set(list, entry);
    }

    const best = Array.from(candidates.entries()).sort((a, b) => b[1].score - a[1].score)[0];
    if (!best) {
      return null;
    }

    const [list, entry] = best;
    const preferredHints = ["/giftcards", "/inventory", "/communities", "/friends", "/home"];

    for (const hint of preferredHints) {
      const match = entry.anchors.find((candidate) => candidate.pathname.includes(hint));
      if (match) {
        return { anchor: match.anchor, row: match.row, list };
      }
    }

    const first = entry.anchors[0];
    return first ? { anchor: first.anchor, row: first.row, list } : null;
  }

  function findNativeRow() {
    const redesigned = findRedesignedNativeRow();
    if (redesigned) {
      return redesigned;
    }

    for (const selector of NATIVE_ANCHOR_SELECTORS) {
      const anchor = document.querySelector(selector);
      const row = anchor?.closest("li");

      if (anchor && row?.parentElement) {
        return { anchor, row, list: row.parentElement };
      }
    }

    const list = document.querySelector("ul.left-col-list, .left-col-list");
    if (!list) {
      return null;
    }

    const row = Array.from(list.children).find((child) =>
      child.matches?.("li") && child.querySelector("a")
    );

    return row ? { anchor: row.querySelector("a"), row, list } : null;
  }

  function cleanClone(row) {
    for (const element of [row, ...row.querySelectorAll("*")]) {
      element.removeAttribute("id");
      element.removeAttribute("aria-current");
      element.removeAttribute("aria-selected");
      element.removeAttribute(NATIVE_SIDEBAR_HIDDEN_ATTRIBUTE);
      element.classList?.remove("active", "selected", "bg-surface-300");
    }

    row.removeAttribute("style");
    row.querySelectorAll(".notification, .rbx-text-navbar-right").forEach((node) => node.remove());
  }

  function findLabel(anchor) {
    return (
      anchor.querySelector(".dynamic-ellipsis-item") ||
      anchor.querySelector(".font-header-2:last-child") ||
      Array.from(anchor.children).reverse().find((child) => child.matches?.("span")) ||
      null
    );
  }

  function findOrCreateIcon(anchor, label) {
    const directSpans = Array.from(anchor.children).filter((child) => child.matches?.("span"));
    let icon =
      anchor.querySelector("[class*='icon-nav-']") ||
      directSpans.find((span) => span !== label && span.classList.contains("size-1000")) ||
      directSpans.find((span) => span !== label) ||
      anchor.querySelector("div > span") ||
      null;

    if (!icon) {
      const wrapper = document.createElement("div");
      icon = document.createElement("span");
      wrapper.append(icon);
      anchor.prepend(wrapper);
    }

    for (const className of Array.from(icon.classList)) {
      if (className.startsWith("icon-nav-")) {
        icon.classList.remove(className);
      }
    }

    icon.classList.add("rsl-sidebar-icon");
    icon.replaceChildren();
    icon.setAttribute("aria-hidden", "true");
    return icon;
  }

  function getShortcutIconType(rawUrl) {
    let url;
    try {
      url = new URL(rawUrl);
    } catch {
      return "link";
    }

    const hostname = url.hostname.toLowerCase();
    const isRobloxUrl = hostname === "roblox.com" || hostname.endsWith(".roblox.com");
    if (!isRobloxUrl) {
      return "external";
    }

    if (hostname === "create.roblox.com") {
      return "create";
    }

    const pathname = url.pathname.toLowerCase().replace(/\/+$/, "") || "/";
    const shareType = (url.searchParams.get("type") || "").toLowerCase();

    if (pathname === "/home") return "home";
    if (pathname.includes("/inventory")) return "inventory";
    if (pathname.includes("/friends")) return "friends";
    if (/^\/users(?:\/|$)/.test(pathname)) return "profile";
    if (/^\/(?:communities|groups)(?:\/|$)/.test(pathname)) return "community";
    if (
      /^\/(?:games|discover)(?:\/|$)/.test(pathname) ||
      (pathname === "/share" && /experience|server/.test(shareType))
    ) return "game";
    if (/^\/(?:catalog|marketplace|bundles|game-pass|passes|library)(?:\/|$)/.test(pathname)) {
      return "marketplace";
    }
    if (/^\/(?:my\/avatar|avatar)(?:\/|$)/.test(pathname)) return "avatar";
    if (pathname.includes("/trades")) return "trade";
    if (pathname.includes("/messages")) return "message";
    if (/^\/(?:charts|leaderboards)(?:\/|$)/.test(pathname)) return "chart";
    if (/^\/(?:settings|my\/account)(?:\/|$)/.test(pathname)) return "settings";
    if (pathname.includes("/giftcards")) return "gift";
    if (pathname.includes("/premium")) return "premium";
    if (/^\/(?:create|develop)(?:\/|$)/.test(pathname)) return "create";

    return "link";
  }

  function getThumbnailTarget(rawUrl) {
    let url;
    try {
      url = new URL(rawUrl);
    } catch {
      return null;
    }

    const hostname = url.hostname.toLowerCase();
    if (hostname !== "roblox.com" && !hostname.endsWith(".roblox.com")) {
      return null;
    }

    const pathname = url.pathname.toLowerCase().replace(/\/+$/, "") || "/";
    const profileMatch = pathname.match(/^\/users\/(\d+)(?:\/profile)?$/);
    if (profileMatch) {
      return { kind: "profile", id: profileMatch[1] };
    }

    const gameMatch = pathname.match(/^\/games\/(\d+)(?:\/|$)/);
    if (gameMatch) {
      return { kind: "game", id: gameMatch[1] };
    }

    const communityMatch = pathname.match(/^\/(?:communities|groups)\/(\d+)(?:\/|$)/);
    if (communityMatch) {
      return { kind: "community", id: communityMatch[1] };
    }

    return null;
  }

  function isSafeThumbnailImageUrl(rawUrl) {
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

  function setOwnedThumbnailState(frame, state) {
    if (!frame) {
      return;
    }
    frame.classList.add("rsl-owned-thumbnail-frame");
    frame.dataset.rslThumbnailState = state;
  }

  function beginOwnedThumbnailLoad(frame, image = null) {
    ownedThumbnailLoadToken =
      ownedThumbnailLoadToken >= Number.MAX_SAFE_INTEGER
        ? 1
        : ownedThumbnailLoadToken + 1;
    const token = String(ownedThumbnailLoadToken);
    if (image) {
      image.dataset.rslOwnedThumbnailLoadToken = token;
    }
    setOwnedThumbnailState(frame, "loading");
    return token;
  }

  function finishOwnedThumbnailLoad(frame, image, token, state = "loaded") {
    if (
      !frame ||
      !image ||
      image.dataset.rslOwnedThumbnailLoadToken !== token
    ) {
      return false;
    }
    delete image.dataset.rslOwnedThumbnailLoadToken;
    setOwnedThumbnailState(frame, state);
    return true;
  }

  function loadOwnedThumbnailImage(
    frame,
    image,
    source,
    fallbackSource,
    onPrimaryError = null
  ) {
    if (!frame || !image) {
      return;
    }

    const primarySource = source || fallbackSource;
    if (!primarySource) {
      setOwnedThumbnailState(frame, "fallback");
      return;
    }

    const token = beginOwnedThumbnailLoad(frame, image);
    let usingFallback = !source || source === fallbackSource;
    const finish = () => {
      if (
        image.dataset.rslOwnedThumbnailLoadToken !== token ||
        !image.complete ||
        image.naturalWidth <= 0
      ) {
        return;
      }
      finishOwnedThumbnailLoad(
        frame,
        image,
        token,
        usingFallback ? "fallback" : "loaded"
      );
    };
    const fail = () => {
      if (image.dataset.rslOwnedThumbnailLoadToken !== token) {
        return;
      }
      if (!usingFallback && fallbackSource) {
        usingFallback = true;
        try {
          onPrimaryError?.();
        } catch {
          // Thumbnail failures must never interrupt the surrounding UI.
        }
        image.removeAttribute("srcset");
        image.removeAttribute("sizes");
        image.src = fallbackSource;
        if (image.complete) {
          queueMicrotask(finish);
        }
        return;
      }
      finishOwnedThumbnailLoad(frame, image, token, "fallback");
    };

    image.addEventListener("load", finish, { once: true });
    image.addEventListener("error", fail, { once: true });
    image.src = primarySource;
    if (image.complete) {
      queueMicrotask(finish);
    }
  }

  function setPlusIcon(icon) {
    icon.classList.remove(
      "rsl-sidebar-icon--shortcut",
      "rsl-sidebar-icon--link",
      "rsl-owned-thumbnail-frame"
    );
    icon.classList.add("rsl-sidebar-icon--plus");
    delete icon.dataset.rslIconType;
    delete icon.dataset.rslThumbnailState;
  }

  function setShortcutIcon(icon, shortcutUrl, force = false) {
    const iconType = getShortcutIconType(shortcutUrl);
    if (!force && icon.dataset.rslIconType === iconType && icon.querySelector("svg")) {
      return;
    }

    icon.classList.remove(
      "rsl-sidebar-icon--plus",
      "rsl-sidebar-icon--link",
      "rsl-sidebar-icon--thumbnail",
      "rsl-sidebar-icon--thumbnail-profile",
      "rsl-owned-thumbnail-frame"
    );
    icon.classList.add("rsl-sidebar-icon--shortcut");
    icon.dataset.rslIconType = iconType;
    delete icon.dataset.rslThumbnailState;
    icon.innerHTML = `<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">${SHORTCUT_ICON_MARKUP[iconType]}</svg>`;
  }

  function requestThumbnail(icon, target, thumbnailKey) {
    try {
      chrome.runtime.sendMessage(
        { type: "rsl:get-thumbnail", kind: target.kind, id: target.id },
        (response) => {
          const failed = chrome.runtime.lastError || !isSafeThumbnailImageUrl(response?.url);
          if (icon.dataset.rslThumbnailKey !== thumbnailKey) {
            return;
          }

          if (failed) {
            icon.dataset.rslThumbnailState = "failed";
            icon.dataset.rslThumbnailRetryAt = String(Date.now() + THUMBNAIL_RETRY_DELAY_MS);
            window.setTimeout(queueMount, THUMBNAIL_RETRY_DELAY_MS + 50);
            return;
          }

          const image = document.createElement("img");
          image.className = "rsl-sidebar-thumbnail";
          if (target.kind === "profile") {
            image.classList.add("rsl-sidebar-thumbnail--profile");
          }
          image.alt = "";
          image.decoding = "async";
          image.referrerPolicy = "no-referrer";

          image.addEventListener("load", () => {
            if (icon.dataset.rslThumbnailKey !== thumbnailKey) {
              return;
            }
            icon.replaceChildren(image);
            icon.classList.add("rsl-sidebar-icon--thumbnail");
            if (target.kind === "profile") {
              icon.classList.add("rsl-sidebar-icon--thumbnail-profile");
            }
            icon.dataset.rslThumbnailState = "loaded";
            delete icon.dataset.rslThumbnailRetryAt;
          }, { once: true });

          image.addEventListener("error", () => {
            if (icon.dataset.rslThumbnailKey === thumbnailKey) {
              icon.dataset.rslThumbnailState = "failed";
              icon.dataset.rslThumbnailRetryAt = String(
                Date.now() + THUMBNAIL_RETRY_DELAY_MS
              );
              window.setTimeout(queueMount, THUMBNAIL_RETRY_DELAY_MS + 50);
            }
          }, { once: true });

          image.src = response.url;
        }
      );
    } catch {
      if (icon.dataset.rslThumbnailKey === thumbnailKey) {
        icon.dataset.rslThumbnailState = "failed";
        icon.dataset.rslThumbnailRetryAt = String(Date.now() + THUMBNAIL_RETRY_DELAY_MS);
        window.setTimeout(queueMount, THUMBNAIL_RETRY_DELAY_MS + 50);
      }
    }
  }

  function syncShortcutIcon(icon, shortcutUrl) {
    const target = getThumbnailTarget(shortcutUrl);
    if (!target) {
      delete icon.dataset.rslThumbnailKey;
      delete icon.dataset.rslThumbnailState;
      icon.classList.remove("rsl-owned-thumbnail-frame");
      setShortcutIcon(icon, shortcutUrl);
      return;
    }

    const thumbnailKey = `${target.kind}:${target.id}`;
    if (icon.dataset.rslThumbnailKey === thumbnailKey) {
      const state = icon.dataset.rslThumbnailState;
      const retryAt = Number(icon.dataset.rslThumbnailRetryAt) || 0;
      if (
        state === "loading" ||
        (state === "failed" && Date.now() < retryAt) ||
        (state === "loaded" && icon.querySelector("img"))
      ) {
        return;
      }
    }

    const replacingDifferentThumbnail =
      Boolean(icon.dataset.rslThumbnailKey) && icon.dataset.rslThumbnailKey !== thumbnailKey;
    setShortcutIcon(icon, shortcutUrl, replacingDifferentThumbnail || !icon.querySelector("svg"));
    icon.dataset.rslThumbnailKey = thumbnailKey;
    setOwnedThumbnailState(icon, "loading");
    delete icon.dataset.rslThumbnailRetryAt;
    requestThumbnail(icon, target, thumbnailKey);
  }

  function createNativeLookingRow(templateRow, type, shortcutUrl = "") {
    const row = templateRow.cloneNode(true);
    cleanClone(row);

    const anchor = row.querySelector("a") || document.createElement("a");
    if (!anchor.parentElement) {
      row.append(anchor);
    }

    anchor.removeAttribute("target");
    anchor.removeAttribute("aria-current");
    anchor.classList.remove("active", "selected");

    const label = findLabel(anchor);
    const icon = findOrCreateIcon(anchor, label);
    if (type === "plus") {
      setPlusIcon(icon);
    } else {
      setShortcutIcon(icon, shortcutUrl);
    }

    return { row, anchor, label, icon };
  }

  function findPremiumRow(list) {
    const premiumLink = Array.from(list.querySelectorAll("a[href]"))
      .find((anchor) => {
        if (isExtensionRow(anchor.closest("li"))) {
          return false;
        }

        try {
          const pathname = new URL(anchor.href, location.origin).pathname
            .toLowerCase()
            .replace(/\/+$/, "") || "/";
          return (
            pathname.includes("/premium/membership") ||
            (pathname === "/plus" &&
              (anchor.classList.contains("flex-col") ||
                anchor.closest("li")?.classList.contains("padding-top-xsmall")))
          );
        } catch {
          return false;
        }
      });

    return premiumLink?.closest("li") || null;
  }

  function findSidebarInsertBoundary(list, addRow) {
    const templateAnchor = addRow?.querySelector(":scope > a");
    const peerClassCandidates = [
      "content-emphasis",
      "text-title-large",
      "items-center",
      "gap-small",
      "padding-left-xsmall",
      "padding-right-xxsmall",
      "group/interactable"
    ];
    const peerClasses = peerClassCandidates.filter((className) =>
      templateAnchor?.classList.contains(className)
    );

    if (peerClasses.length >= 3) {
      let lastNativeNavigationRow = null;
      for (const row of Array.from(list.children)) {
        if (!row.matches?.("li") || isExtensionRow(row)) {
          continue;
        }
        const anchor = row.querySelector(":scope > a[href]");
        if (anchor && peerClasses.every((className) => anchor.classList.contains(className))) {
          lastNativeNavigationRow = row;
        }
      }

      let boundary = lastNativeNavigationRow?.nextElementSibling || null;
      while (boundary && isExtensionRow(boundary)) {
        boundary = boundary.nextElementSibling;
      }
      if (boundary) {
        return boundary;
      }
    }

    return findPremiumRow(list);
  }

  function placeAddRow(list, addRow) {
    const boundary = findSidebarInsertBoundary(list, addRow);
    if (boundary && boundary !== addRow) {
      if (addRow.nextElementSibling !== boundary) {
        list.insertBefore(addRow, boundary);
      }
      return;
    }

    if (addRow !== list.lastElementChild) {
      list.append(addRow);
    }
  }

  function makeAddRow(templateRow) {
    const { row, anchor, label } = createNativeLookingRow(templateRow, "plus");
    row.id = ADD_ROW_ID;
    row.dataset.rslControl = "add-shortcut";

    anchor.href = "#";
    anchor.setAttribute("role", "button");
    anchor.setAttribute("aria-haspopup", "dialog");
    anchor.setAttribute("aria-label", "Add shortcut");
    anchor.title = "Add shortcut";

    if (label) {
      label.textContent = "Add shortcut";
    }

    anchor.addEventListener("click", (event) => {
      event.preventDefault();
      openDialog();
    });

    return row;
  }

  function setGameEventsSidebarIcon(icon) {
    if (!icon) return;
    icon.classList.remove(
      "rsl-sidebar-icon--plus",
      "rsl-sidebar-icon--link",
      "rsl-sidebar-icon--thumbnail",
      "rsl-sidebar-icon--thumbnail-profile",
      "rsl-owned-thumbnail-frame"
    );
    icon.classList.add("rsl-sidebar-icon--shortcut");
    icon.dataset.rslIconType = "calendar";
    delete icon.dataset.rslThumbnailKey;
    delete icon.dataset.rslThumbnailState;
    icon.innerHTML =
      `<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">` +
      `${SHORTCUT_ICON_MARKUP.calendar}</svg>`;
  }

  function makeGameEventsSidebarRow(templateRow) {
    const { row, anchor, label, icon } = createNativeLookingRow(
      templateRow,
      "shortcut",
      "/home"
    );
    row.id = GAME_EVENTS_ROW_ID;
    row.dataset.rslControl = "game-events";
    anchor.href = "#";
    anchor.setAttribute("role", "button");
    anchor.setAttribute("aria-haspopup", "dialog");
    anchor.setAttribute("aria-controls", GAME_EVENTS_DIALOG_ID);
    anchor.setAttribute("aria-label", "Open Game Events");
    anchor.title = "Events";
    if (label) label.textContent = "Events";
    setGameEventsSidebarIcon(icon);
    anchor.addEventListener("click", (event) => {
      event.preventDefault();
      if (event.isTrusted !== true) return;
      openGameEventsDialog(anchor);
    });
    return row;
  }

  function placeGameEventsSidebarRow(list, row) {
    const schedulerRow = document.getElementById(JOIN_SCHEDULER_ROW_ID);
    if (schedulerRow?.parentElement === list && schedulerRow !== row) {
      if (row.parentElement !== list || row.nextElementSibling !== schedulerRow) {
        list.insertBefore(row, schedulerRow);
      }
      return;
    }
    const historyRow = document.getElementById(SERVER_HISTORY_ROW_ID);
    if (historyRow?.parentElement === list && historyRow !== row) {
      if (row.parentElement !== list || row.nextElementSibling !== historyRow) {
        list.insertBefore(row, historyRow);
      }
      return;
    }
    const customRows = Array.from(list.querySelectorAll(`[${ROW_ATTRIBUTE}]`));
    const addRow = document.getElementById(ADD_ROW_ID);
    const firstOwnedCustomRow = customRows[0] ||
      (addRow?.parentElement === list ? addRow : null);
    if (firstOwnedCustomRow && firstOwnedCustomRow !== row) {
      if (row.parentElement !== list || row.nextElementSibling !== firstOwnedCustomRow) {
        list.insertBefore(row, firstOwnedCustomRow);
      }
      return;
    }
    const boundary = findSidebarInsertBoundary(list, row);
    if (boundary && boundary !== row) {
      if (row.parentElement !== list || row.nextElementSibling !== boundary) {
        list.insertBefore(row, boundary);
      }
    } else if (row.parentElement !== list || row !== list.lastElementChild) {
      list.append(row);
    }
  }

  function mountGameEventsSidebarRow() {
    if (
      !isFeatureEnabled("gameEvents") ||
      !isFeatureEnabled("sidebarShortcuts") ||
      !isFeatureEnabled("sidebarGameEvents")
    ) {
      document.getElementById(GAME_EVENTS_ROW_ID)?.remove();
      return null;
    }
    const native = findNativeRow();
    if (!native) return null;
    const duplicates = Array.from(document.querySelectorAll(`#${GAME_EVENTS_ROW_ID}`));
    let row = duplicates.shift() || null;
    duplicates.forEach((duplicate) => duplicate.remove());
    if (!row || row._rslGameEventsRowBound !== true) {
      row?.remove();
      row = makeGameEventsSidebarRow(native.row);
      row._rslGameEventsRowBound = true;
    }
    placeGameEventsSidebarRow(native.list, row);
    return row;
  }

  function setJoinSchedulerSidebarIcon(icon) {
    if (!icon) return;
    icon.classList.remove(
      "rsl-sidebar-icon--plus",
      "rsl-sidebar-icon--link",
      "rsl-sidebar-icon--thumbnail",
      "rsl-sidebar-icon--thumbnail-profile",
      "rsl-owned-thumbnail-frame"
    );
    icon.classList.add("rsl-sidebar-icon--shortcut");
    icon.dataset.rslIconType = "schedule";
    delete icon.dataset.rslThumbnailKey;
    delete icon.dataset.rslThumbnailState;
    icon.innerHTML =
      `<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">` +
      `${SHORTCUT_ICON_MARKUP.schedule}</svg>`;
  }

  async function openJoinScheduler(draft = null, trigger = null) {
    if (!isFeatureEnabled("joinScheduler")) return false;
    const button = typeof HTMLElement !== "undefined" &&
      trigger instanceof HTMLElement
      ? trigger
      : null;
    const originalDisabled = button?.disabled === true;
    const originalText = button?.textContent || "";
    if (button) {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
    }
    let opened = false;
    try {
      const modalApi = globalThis[JOIN_SCHEDULER_MODAL_GLOBAL];
      opened = modalApi && typeof modalApi.open === "function"
        ? await modalApi.open(draft, button)
        : false;
    } catch {
      opened = false;
    }
    if (button?.isConnected) {
      button.disabled = originalDisabled;
      button.removeAttribute("aria-busy");
      if (!opened) {
        const originalTitle = button.title;
        button.title = "Join Scheduler could not be opened. Try again.";
        if (typeof HTMLButtonElement !== "undefined" && button instanceof HTMLButtonElement) {
          button.textContent = "Try Again";
        }
        window.setTimeout(() => {
          if (button.isConnected) {
            button.title = originalTitle;
            if (
              typeof HTMLButtonElement !== "undefined" &&
              button instanceof HTMLButtonElement
            ) {
              button.textContent = originalText;
            }
          }
        }, 2_500);
      }
    }
    return opened;
  }

  function makeJoinSchedulerSidebarRow(templateRow) {
    return buildJoinSchedulerSidebarRow(templateRow);
  }

  function parseNativeEventScheduleGamePagePlaceId(rawUrl = location.href) {
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
      return normalizeQuickPlayPlaceId(segments[1]);
    } catch {
      return null;
    }
  }

  function getNativeEventSchedulePageMetadata(expectedPlaceId) {
    const page = document.querySelector("#game-detail-page");
    const pagePlaceId = normalizeQuickPlayPlaceId(page?.dataset?.placeId);
    if (!page || pagePlaceId !== expectedPlaceId) return null;
    const metadata = document.querySelector("#game-detail-meta-data");
    if (!metadata) return null;
    const placeId = normalizeQuickPlayPlaceId(metadata.dataset?.placeId);
    const rootPlaceId = normalizeQuickPlayPlaceId(metadata.dataset?.rootPlaceId);
    const universeId = normalizeQuickPlayPlaceId(metadata.dataset?.universeId);
    const gameName = normalizeGameEventText(metadata.dataset?.placeName, "", 150);
    if (!placeId || placeId !== expectedPlaceId || !rootPlaceId || !universeId) {
      return null;
    }
    return Object.freeze({ placeId, rootPlaceId, universeId, gameName });
  }

  function parseNativeEventScheduleLinkId(link) {
    if (!link || typeof link.getAttribute !== "function") return null;
    const rawHref = link.getAttribute("href");
    if (typeof rawHref !== "string" || !rawHref.trim()) return null;
    try {
      const url = new URL(rawHref, "https://www.roblox.com");
      if (
        url.protocol !== "https:" ||
        url.hostname !== "www.roblox.com" ||
        url.port !== "" ||
        url.username !== "" ||
        url.password !== "" ||
        url.search !== "" ||
        url.hash !== ""
      ) {
        return null;
      }
      const segments = url.pathname.split("/").slice(1);
      if (segments.at(-1) === "") segments.pop();
      if (NATIVE_EVENT_SCHEDULE_LOCALE_SEGMENTS.has(segments[0]?.toLowerCase())) {
        segments.shift();
      }
      if (segments.length !== 2 || segments[0] !== "events") return null;
      return normalizeGameEventId(segments[1]);
    } catch {
      return null;
    }
  }

  function getNativeEventScheduleCardIdentity(card) {
    if (
      !card?.matches?.(
        'li.experience-events-tile.contained-tile[data-testid="wide-game-tile"][id]'
      ) ||
      !card.closest?.(
        "#game-details-about-tab-container .virtual-event-game-details-container"
      )
    ) {
      return null;
    }
    const cardId = normalizeGameEventId(card.id);
    const featured = card.querySelector(NATIVE_EVENT_SCHEDULE_FEATURED_SELECTOR);
    if (!cardId || !featured || featured.closest("li") !== card) return null;
    const links = Array.from(
      featured.querySelectorAll("a.game-card-link[href]")
    ).filter((link) => link.closest("li") === card);
    if (links.length !== 1) return null;
    const link = links[0];
    if (link.parentElement !== featured) return null;
    const linkId = parseNativeEventScheduleLinkId(link);
    if (!linkId || linkId !== cardId) return null;
    const nativeAction = featured.querySelector(
      ".event-follow-button, .event-unfollow-button"
    );
    if (!nativeAction || nativeAction.closest("li") !== card) return null;
    return Object.freeze({ id: cardId, card, featured, link, nativeAction });
  }

  function collectNativeEventScheduleCardIdentities() {
    const identities = [];
    const seen = new Set();
    for (const card of document.querySelectorAll(NATIVE_EVENT_SCHEDULE_CARD_SELECTOR)) {
      const identity = getNativeEventScheduleCardIdentity(card);
      if (!identity || seen.has(identity.id)) continue;
      seen.add(identity.id);
      identities.push(identity);
      if (identities.length >= NATIVE_EVENT_SCHEDULE_MAX_EVENT_IDS) break;
    }
    return identities;
  }

  function sendNativeEventScheduleRuntimeMessage(message) {
    if (typeof nativeEventScheduleMessageSenderForTests === "function") {
      return Promise.resolve().then(() =>
        nativeEventScheduleMessageSenderForTests(message)
      );
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("Native event schedule request timed out"));
      }, GAME_EVENTS_REQUEST_TIMEOUT_MS);
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        callback(value);
      };
      try {
        const returned = chrome.runtime.sendMessage(message, (response) => {
          const runtimeError = chrome.runtime.lastError;
          if (runtimeError) finish(reject, new Error(runtimeError.message));
          else finish(resolve, response);
        });
        if (returned?.then) {
          returned.then(
            (response) => finish(resolve, response),
            (error) => finish(reject, error)
          );
        }
      } catch (error) {
        finish(reject, error);
      }
    });
  }

  function normalizeNativeEventScheduleResponse(
    rawValue,
    requestedPlaceId,
    expectedUniverseId,
    requestedEventIds,
    now = Date.now()
  ) {
    if (
      !rawValue ||
      typeof rawValue !== "object" ||
      rawValue.ok !== true ||
      rawValue.enabled === false ||
      normalizeQuickPlayPlaceId(rawValue.placeId) !== requestedPlaceId
    ) {
      return null;
    }
    const universeId = normalizeQuickPlayPlaceId(rawValue.universeId);
    const checkedAt = normalizeGameEventTimestamp(rawValue.checkedAt);
    if (!universeId || universeId !== expectedUniverseId || !checkedAt) return null;
    const requested = new Set(requestedEventIds);
    const seen = new Set();
    const events = [];
    for (const rawEvent of Array.isArray(rawValue.events) ? rawValue.events : []) {
      const event = normalizeGameEvent(rawEvent, now);
      if (
        !event ||
        rawEvent?.status !== "upcoming" ||
        event.status !== "upcoming" ||
        event.startAt <= now ||
        event.universeId !== universeId ||
        !requested.has(event.id) ||
        seen.has(event.id)
      ) {
        continue;
      }
      seen.add(event.id);
      events.push(event);
    }
    return Object.freeze({
      placeId: requestedPlaceId,
      universeId,
      checkedAt,
      events: Object.freeze(events)
    });
  }

  function removeNativeEventScheduleButtons() {
    document.querySelectorAll(`[${NATIVE_EVENT_SCHEDULE_ATTRIBUTE}]`).forEach(
      (button) => button.remove()
    );
  }

  function clearNativeEventScheduleBoundaryTimer() {
    if (nativeEventScheduleBoundaryTimer !== null) {
      window.clearTimeout(nativeEventScheduleBoundaryTimer);
      nativeEventScheduleBoundaryTimer = null;
    }
  }

  function clearNativeEventScheduleRefreshTimer() {
    if (nativeEventScheduleRefreshTimer !== null) {
      window.clearTimeout(nativeEventScheduleRefreshTimer);
      nativeEventScheduleRefreshTimer = null;
    }
  }

  function scheduleNativeEventScheduleDataRefresh() {
    clearNativeEventScheduleRefreshTimer();
    if (
      !nativeEventScheduleRoutePlaceId ||
      !nativeEventScheduleCardFingerprint ||
      nativeEventScheduleNextRefreshAt <= 0
    ) {
      return;
    }
    const delay = Math.min(
      2_147_000_000,
      Math.max(100, nativeEventScheduleNextRefreshAt - Date.now())
    );
    nativeEventScheduleRefreshTimer = window.setTimeout(() => {
      nativeEventScheduleRefreshTimer = null;
      queueMount();
    }, delay);
  }

  function scheduleNativeEventScheduleBoundaryRefresh() {
    clearNativeEventScheduleBoundaryTimer();
    const now = Date.now();
    const nextStartAt = Math.min(
      ...Array.from(nativeEventScheduleItemsById.values())
        .map((event) => event.startAt)
        .filter((startAt) => startAt > now)
    );
    if (!Number.isFinite(nextStartAt)) return;
    nativeEventScheduleBoundaryTimer = window.setTimeout(() => {
      nativeEventScheduleBoundaryTimer = null;
      const boundaryNow = Date.now();
      nativeEventScheduleItemsById = new Map(
        Array.from(nativeEventScheduleItemsById.entries()).filter(
          ([, event]) => event.startAt > boundaryNow
        )
      );
      reconcileNativeEventScheduleButtons();
      scheduleNativeEventScheduleBoundaryRefresh();
    }, Math.min(2_147_000_000, Math.max(50, nextStartAt - now + 50)));
  }

  function makeNativeEventScheduleDraft(event) {
    return Object.freeze({
      universeId: event.universeId,
      placeId: event.placeId,
      gameName: event.gameName,
      title: event.title,
      startAt: event.startAt,
      endAt: event.endAt,
      eventId: event.id
    });
  }

  function isNativeEventScheduleButtonCurrent(button, event, now = Date.now()) {
    if (
      !button?.isConnected ||
      !event ||
      event.startAt <= now ||
      !isFeatureEnabled("joinScheduler") ||
      parseNativeEventScheduleGamePagePlaceId() !== nativeEventScheduleRoutePlaceId ||
      button.getAttribute(NATIVE_EVENT_SCHEDULE_ATTRIBUTE) !== event.id ||
      nativeEventScheduleItemsById.get(event.id) !== event
    ) {
      return false;
    }
    const card = button.closest(
      'li.experience-events-tile.contained-tile[data-testid="wide-game-tile"][id]'
    );
    const identity = getNativeEventScheduleCardIdentity(card);
    return Boolean(identity && identity.id === event.id && identity.featured.contains(button));
  }

  function placeNativeEventScheduleButton(identity, button) {
    // Keep RoTool outside the native link/action subtree. Appending one owned
    // sibling preserves Roblox's native button node, order, handlers, and role.
    identity.link.insertAdjacentElement("afterend", button);
  }

  function makeNativeEventScheduleButton(identity, event) {
    const button = document.createElement("button");
    const draft = makeNativeEventScheduleDraft(event);
    button.type = "button";
    button.className = "rsl-native-event-schedule";
    button.textContent = "Schedule with RoTool";
    button.setAttribute(NATIVE_EVENT_SCHEDULE_ATTRIBUTE, event.id);
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-label", `Schedule ${event.title} with RoTool`);
    button.title = "Set a RoTool reminder or automatic join for this event.";
    button.addEventListener("click", (clickEvent) => {
      if (clickEvent.isTrusted !== true) return;
      clickEvent.preventDefault();
      clickEvent.stopPropagation();
      if (!isNativeEventScheduleButtonCurrent(button, event)) {
        button.remove();
        queueMount();
        return;
      }
      void openJoinScheduler(draft, button);
    });
    placeNativeEventScheduleButton(identity, button);
    return button;
  }

  function reconcileNativeEventScheduleButtons() {
    const placeId = parseNativeEventScheduleGamePagePlaceId();
    const identities = collectNativeEventScheduleCardIdentities();
    const identityById = new Map(identities.map((identity) => [identity.id, identity]));
    const now = Date.now();
    document.querySelectorAll(`[${NATIVE_EVENT_SCHEDULE_ATTRIBUTE}]`).forEach(
      (button) => {
        const id = normalizeGameEventId(
          button.getAttribute(NATIVE_EVENT_SCHEDULE_ATTRIBUTE)
        );
        const event = id ? nativeEventScheduleItemsById.get(id) : null;
        const identity = id ? identityById.get(id) : null;
        if (
          placeId !== nativeEventScheduleRoutePlaceId ||
          !event ||
          event.startAt <= now ||
          !identity ||
          !identity.featured.contains(button)
        ) {
          button.remove();
        }
      }
    );
    if (
      !featureSettingsLoaded ||
      !isFeatureEnabled("joinScheduler") ||
      !placeId ||
      placeId !== nativeEventScheduleRoutePlaceId
    ) {
      return;
    }
    for (const identity of identities) {
      const event = nativeEventScheduleItemsById.get(identity.id);
      if (!event || event.startAt <= now) continue;
      const existing = Array.from(
        identity.featured.querySelectorAll(`[${NATIVE_EVENT_SCHEDULE_ATTRIBUTE}]`)
      );
      const button = existing.shift() || makeNativeEventScheduleButton(identity, event);
      existing.forEach((duplicate) => duplicate.remove());
      if (button.getAttribute(NATIVE_EVENT_SCHEDULE_ATTRIBUTE) !== event.id) {
        button.remove();
        makeNativeEventScheduleButton(identity, event);
      }
    }
  }

  async function loadNativeEventScheduleData(
    placeId,
    expectedUniverseId,
    eventIds,
    lifecycleEpoch,
    cardFingerprint
  ) {
    const requestId = ++nativeEventScheduleRequestSequence;
    nativeEventScheduleRequestPending = true;
    try {
      const response = await sendNativeEventScheduleRuntimeMessage({
        type: NATIVE_EVENT_SCHEDULE_DATA_MESSAGE_TYPE,
        requestId,
        placeId,
        eventIds,
        locale: getRobloxPageLocale()
      });
      if (
        lifecycleEpoch !== nativeEventScheduleLifecycleEpoch ||
        placeId !== nativeEventScheduleRoutePlaceId ||
        cardFingerprint !== nativeEventScheduleCardFingerprint ||
        response?.requestId !== requestId
      ) {
        return false;
      }
      const currentMetadata = getNativeEventSchedulePageMetadata(placeId);
      if (!currentMetadata || currentMetadata.universeId !== expectedUniverseId) {
        nativeEventScheduleItemsById = new Map();
        nativeEventScheduleNextRefreshAt =
          Date.now() + NATIVE_EVENT_SCHEDULE_FAILURE_RETRY_MS;
        removeNativeEventScheduleButtons();
        return false;
      }
      const normalized = normalizeNativeEventScheduleResponse(
        response,
        placeId,
        expectedUniverseId,
        eventIds
      );
      removeNativeEventScheduleButtons();
      nativeEventScheduleItemsById = new Map(
        (normalized?.events || []).map((event) => [event.id, event])
      );
      nativeEventScheduleNextRefreshAt = Date.now() + (
        normalized
          ? NATIVE_EVENT_SCHEDULE_REFRESH_MS
          : NATIVE_EVENT_SCHEDULE_FAILURE_RETRY_MS
      );
      reconcileNativeEventScheduleButtons();
      scheduleNativeEventScheduleBoundaryRefresh();
      return Boolean(normalized);
    } catch {
      if (
        lifecycleEpoch === nativeEventScheduleLifecycleEpoch &&
        placeId === nativeEventScheduleRoutePlaceId &&
        cardFingerprint === nativeEventScheduleCardFingerprint
      ) {
        nativeEventScheduleItemsById = new Map();
        nativeEventScheduleNextRefreshAt =
          Date.now() + NATIVE_EVENT_SCHEDULE_FAILURE_RETRY_MS;
        removeNativeEventScheduleButtons();
      }
      return false;
    } finally {
      if (
        lifecycleEpoch === nativeEventScheduleLifecycleEpoch &&
        placeId === nativeEventScheduleRoutePlaceId &&
        cardFingerprint === nativeEventScheduleCardFingerprint
      ) {
        nativeEventScheduleRequestPending = false;
        scheduleNativeEventScheduleDataRefresh();
      }
    }
  }

  function cleanupNativeEventScheduleFeature() {
    nativeEventScheduleLifecycleEpoch += 1;
    nativeEventScheduleRoutePlaceId = null;
    nativeEventScheduleCardFingerprint = "";
    nativeEventScheduleRequestPending = false;
    nativeEventScheduleItemsById = new Map();
    nativeEventScheduleNextRefreshAt = 0;
    clearNativeEventScheduleBoundaryTimer();
    clearNativeEventScheduleRefreshTimer();
    removeNativeEventScheduleButtons();
  }

  function mountNativeEventScheduleButtons() {
    const placeId = parseNativeEventScheduleGamePagePlaceId();
    if (
      window.top !== window ||
      !featureSettingsLoaded ||
      !isFeatureEnabled("joinScheduler") ||
      !placeId
    ) {
      cleanupNativeEventScheduleFeature();
      return;
    }
    if (nativeEventScheduleRoutePlaceId !== placeId) {
      cleanupNativeEventScheduleFeature();
      nativeEventScheduleRoutePlaceId = placeId;
    }
    const metadata = getNativeEventSchedulePageMetadata(placeId);
    if (!metadata) {
      nativeEventScheduleLifecycleEpoch += 1;
      nativeEventScheduleCardFingerprint = "";
      nativeEventScheduleRequestPending = false;
      nativeEventScheduleItemsById = new Map();
      nativeEventScheduleNextRefreshAt = 0;
      clearNativeEventScheduleBoundaryTimer();
      clearNativeEventScheduleRefreshTimer();
      removeNativeEventScheduleButtons();
      return;
    }
    const identities = collectNativeEventScheduleCardIdentities();
    const eventIds = identities.map((identity) => identity.id);
    const cardFingerprint =
      `${placeId}:${metadata.universeId}:${eventIds.join(",")}`;
    if (cardFingerprint !== nativeEventScheduleCardFingerprint) {
      nativeEventScheduleLifecycleEpoch += 1;
      nativeEventScheduleCardFingerprint = cardFingerprint;
      nativeEventScheduleRequestPending = false;
      nativeEventScheduleItemsById = new Map();
      nativeEventScheduleNextRefreshAt = 0;
      clearNativeEventScheduleBoundaryTimer();
      clearNativeEventScheduleRefreshTimer();
      removeNativeEventScheduleButtons();
      if (eventIds.length > 0) {
        void loadNativeEventScheduleData(
          placeId,
          metadata.universeId,
          Object.freeze(eventIds.slice()),
          nativeEventScheduleLifecycleEpoch,
          cardFingerprint
        );
      }
      return;
    }
    if (
      eventIds.length > 0 &&
      !nativeEventScheduleRequestPending &&
      Date.now() >= nativeEventScheduleNextRefreshAt
    ) {
      nativeEventScheduleItemsById = new Map();
      removeNativeEventScheduleButtons();
      void loadNativeEventScheduleData(
        placeId,
        metadata.universeId,
        Object.freeze(eventIds.slice()),
        nativeEventScheduleLifecycleEpoch,
        cardFingerprint
      );
      return;
    }
    if (!nativeEventScheduleRequestPending) {
      reconcileNativeEventScheduleButtons();
    }
  }

  function buildJoinSchedulerSidebarRow(templateRow) {
    const { row, anchor, label, icon } = createNativeLookingRow(
      templateRow,
      "shortcut",
      "/home"
    );
    row.id = JOIN_SCHEDULER_ROW_ID;
    row.dataset.rslControl = "join-scheduler";
    anchor.href = "#";
    anchor.setAttribute("role", "button");
    anchor.setAttribute("aria-haspopup", "dialog");
    anchor.setAttribute("aria-label", "Open Join Scheduler");
    anchor.title = "Join Scheduler";
    if (label) label.textContent = "Join Scheduler";
    setJoinSchedulerSidebarIcon(icon);
    anchor.addEventListener("click", (event) => {
      event.preventDefault();
      if (event.isTrusted !== true) return;
      void openJoinScheduler(null, anchor);
    });
    anchor.addEventListener("keydown", (event) => {
      if (event.isTrusted !== true || event.key !== " ") return;
      event.preventDefault();
      void openJoinScheduler(null, anchor);
    });
    return row;
  }

  function placeJoinSchedulerSidebarRow(list, row) {
    const historyRow = document.getElementById(SERVER_HISTORY_ROW_ID);
    if (historyRow?.parentElement === list && historyRow !== row) {
      if (row.parentElement !== list || row.nextElementSibling !== historyRow) {
        list.insertBefore(row, historyRow);
      }
      return;
    }
    const customRows = Array.from(list.querySelectorAll(`[${ROW_ATTRIBUTE}]`));
    const addRow = document.getElementById(ADD_ROW_ID);
    const firstOwnedCustomRow = customRows[0] ||
      (addRow?.parentElement === list ? addRow : null);
    if (firstOwnedCustomRow && firstOwnedCustomRow !== row) {
      if (row.parentElement !== list || row.nextElementSibling !== firstOwnedCustomRow) {
        list.insertBefore(row, firstOwnedCustomRow);
      }
      return;
    }
    const boundary = findSidebarInsertBoundary(list, row);
    if (boundary && boundary !== row) {
      if (row.parentElement !== list || row.nextElementSibling !== boundary) {
        list.insertBefore(row, boundary);
      }
    } else if (row.parentElement !== list || row !== list.lastElementChild) {
      list.append(row);
    }
  }

  function mountJoinSchedulerSidebarRow() {
    if (
      !isFeatureEnabled("joinScheduler") ||
      !isFeatureEnabled("sidebarShortcuts") ||
      !isFeatureEnabled("sidebarJoinScheduler")
    ) {
      document.getElementById(JOIN_SCHEDULER_ROW_ID)?.remove();
      return null;
    }
    const native = findNativeRow();
    if (!native) return null;
    const duplicates = Array.from(
      document.querySelectorAll(`#${JOIN_SCHEDULER_ROW_ID}`)
    );
    let row = duplicates.shift() || null;
    duplicates.forEach((duplicate) => duplicate.remove());
    if (!row || row._rslJoinSchedulerRowBound !== true) {
      row?.remove();
      row = makeJoinSchedulerSidebarRow(native.row);
      row._rslJoinSchedulerRowBound = true;
    }
    placeJoinSchedulerSidebarRow(native.list, row);
    return row;
  }

  function cleanupJoinSchedulerFeature() {
    document.getElementById(JOIN_SCHEDULER_ROW_ID)?.remove();
    cleanupNativeEventScheduleFeature();
    const modalApi = globalThis[JOIN_SCHEDULER_MODAL_GLOBAL];
    if (modalApi && typeof modalApi.destroy === "function") modalApi.destroy();
  }

  function setServerHistorySidebarIcon(icon) {
    if (!icon) return;
    icon.classList.remove(
      "rsl-sidebar-icon--plus",
      "rsl-sidebar-icon--link",
      "rsl-sidebar-icon--thumbnail",
      "rsl-sidebar-icon--thumbnail-profile",
      "rsl-owned-thumbnail-frame"
    );
    icon.classList.add("rsl-sidebar-icon--shortcut");
    icon.dataset.rslIconType = "history";
    delete icon.dataset.rslThumbnailKey;
    delete icon.dataset.rslThumbnailState;
    icon.innerHTML =
      `<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">` +
      `${SHORTCUT_ICON_MARKUP.history}</svg>`;
  }

  function makeServerHistorySidebarRow(templateRow) {
    const { row, anchor, label, icon } = createNativeLookingRow(
      templateRow,
      "shortcut",
      "/home"
    );
    row.id = SERVER_HISTORY_ROW_ID;
    row.dataset.rslControl = "server-history";
    anchor.href = "#";
    anchor.setAttribute("role", "button");
    anchor.setAttribute("aria-haspopup", "dialog");
    anchor.setAttribute("aria-controls", SERVER_HISTORY_DIALOG_ID);
    anchor.setAttribute("aria-label", "Server History");
    anchor.title = "Server History";
    if (label) label.textContent = "Server History";
    setServerHistorySidebarIcon(icon);
    anchor.addEventListener("click", (event) => {
      event.preventDefault();
      if (event.isTrusted !== true) return;
      openServerHistoryDialog(anchor);
    });
    return row;
  }

  function placeServerHistorySidebarRow(list, row) {
    const customRows = Array.from(list.querySelectorAll(`[${ROW_ATTRIBUTE}]`));
    const addRow = document.getElementById(ADD_ROW_ID);
    const firstOwnedCustomRow = customRows[0] ||
      (addRow?.parentElement === list ? addRow : null);
    if (firstOwnedCustomRow && firstOwnedCustomRow !== row) {
      if (
        row.parentElement !== list ||
        row.nextElementSibling !== firstOwnedCustomRow
      ) {
        list.insertBefore(row, firstOwnedCustomRow);
      }
      return;
    }
    const boundary = findSidebarInsertBoundary(list, row);
    if (boundary && boundary !== row) {
      if (row.parentElement !== list || row.nextElementSibling !== boundary) {
        list.insertBefore(row, boundary);
      }
    } else if (row.parentElement !== list || row !== list.lastElementChild) {
      list.append(row);
    }
  }

  function mountServerHistorySidebarRow() {
    if (
      !isFeatureEnabled("serverHistory") ||
      !isFeatureEnabled("sidebarShortcuts") ||
      !isFeatureEnabled("sidebarServerHistory")
    ) {
      document.getElementById(SERVER_HISTORY_ROW_ID)?.remove();
      return null;
    }
    const native = findNativeRow();
    if (!native) return null;
    const duplicates = Array.from(
      document.querySelectorAll(`#${SERVER_HISTORY_ROW_ID}`)
    );
    let row = duplicates.shift() || null;
    duplicates.forEach((duplicate) => duplicate.remove());
    if (!row || row._rslServerHistoryRowBound !== true) {
      row?.remove();
      row = makeServerHistorySidebarRow(native.row);
      row._rslServerHistoryRowBound = true;
    }
    placeServerHistorySidebarRow(native.list, row);
    return row;
  }

  function makeShortcutRow(templateRow, shortcut) {
    const { row, anchor, label, icon } = createNativeLookingRow(
      templateRow,
      "shortcut",
      shortcut.url
    );
    row.setAttribute(ROW_ATTRIBUTE, shortcut.id);

    anchor.href = shortcut.url;
    anchor.title = shortcut.label;
    anchor.setAttribute("aria-label", shortcut.label);

    if (label) {
      label.textContent = shortcut.label;
    }

    syncShortcutIcon(icon, shortcut.url);

    return row;
  }

  function updateShortcutRow(row, shortcut) {
    const anchor = row.querySelector("a");
    if (!anchor) {
      return;
    }

    const label = findLabel(anchor);
    let icon = anchor.querySelector(".rsl-sidebar-icon");
    if (!icon) {
      icon = icon || findOrCreateIcon(anchor, label);
    }
    syncShortcutIcon(icon, shortcut.url);

    if (anchor.href !== shortcut.url) {
      anchor.href = shortcut.url;
    }
    if (anchor.title !== shortcut.label) {
      anchor.title = shortcut.label;
    }
    if (anchor.getAttribute("aria-label") !== shortcut.label) {
      anchor.setAttribute("aria-label", shortcut.label);
    }

    if (label && label.textContent !== shortcut.label) {
      label.textContent = shortcut.label;
    }
  }

  function normalizeVisibleText(element) {
    return (element?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function isFriendsPage() {
    return (
      /^\/users\/friends(?:\/|$)/i.test(location.pathname) ||
      document.documentElement.dataset.rslFriendsFixture === "true"
    );
  }

  function isFriendsListSubview() {
    if (document.documentElement.dataset.rslFriendsFixture === "true") {
      return true;
    }
    if (!isFriendsPage()) {
      return false;
    }
    const hash = String(location.hash || "").toLowerCase();
    return !hash || hash === "#!/friends" || hash.startsWith("#!/friends?");
  }

  function isBestFriendsDeepLink() {
    return (
      isFriendsPage() &&
      new URLSearchParams(location.search).get("rotool") === BEST_FRIENDS_FILTER_VALUE
    );
  }

  function consumeBestFriendsDeepLink() {
    if (!isBestFriendsDeepLink()) {
      return false;
    }

    const url = new URL(location.href);
    url.searchParams.delete("rotool");
    history.replaceState(
      history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
    return true;
  }

  function isHomePage() {
    return (
      /^\/home(?:\/|$)/i.test(location.pathname) ||
      document.documentElement.dataset.rslHomeFixture === "true"
    );
  }

  function findNativeHomeFriendsCarousel() {
    if (!isHomePage()) {
      return null;
    }

    return (
      Array.from(
        document.querySelectorAll(
          `.react-friends-carousel-container:not([${BEST_FRIENDS_CAROUSEL_ATTRIBUTE}])`
        )
      ).find((carousel) => {
        const heading = carousel.querySelector(":scope > .container-header h2, h2");
        const label = (heading?.childNodes?.[0]?.textContent || "").trim();
        return label === "Friends";
      }) || null
    );
  }

  function getHomeFriendsCollapseElements(nativeCarousel) {
    const header = nativeCarousel?.querySelector(":scope > .container-header") || null;
    const heading = header?.querySelector("h2") || null;
    const list = nativeCarousel ? getNativeHomeFriendList(nativeCarousel) : null;
    const body = list?.closest(".friends-carousel-container") || list;
    let contentHost = body;
    while (
      contentHost?.parentElement &&
      contentHost.parentElement !== nativeCarousel
    ) {
      contentHost = contentHost.parentElement;
    }
    if (contentHost?.parentElement !== nativeCarousel) {
      contentHost = body;
    }
    return { header, heading, list, body, contentHost };
  }

  function setHomeFriendsContentCollapsed(nativeCarousel, collapsed) {
    if (!nativeCarousel) {
      return;
    }
    const { list, body, contentHost } =
      getHomeFriendsCollapseElements(nativeCarousel);
    const nextCollapsed = collapsed === true;
    nativeCarousel.toggleAttribute(
      HOME_FRIENDS_COLLAPSED_ATTRIBUTE,
      nextCollapsed
    );
    for (const element of new Set([contentHost, body, list])) {
      if (!element) {
        continue;
      }
      element.setAttribute(HOME_FRIENDS_BODY_ATTRIBUTE, "");
      element.hidden = nextCollapsed;
      element.toggleAttribute("aria-hidden", nextCollapsed);
    }
  }

  function restoreHomeFriendsContentForMeasurement(nativeCarousel) {
    if (!nativeCarousel) {
      return;
    }
    nativeCarousel.removeAttribute(HOME_FRIENDS_COLLAPSED_ATTRIBUTE);
    const { list, body, contentHost } =
      getHomeFriendsCollapseElements(nativeCarousel);
    for (const element of new Set([contentHost, body, list])) {
      if (!element) {
        continue;
      }
      element.hidden = false;
      element.removeAttribute("aria-hidden");
    }
  }

  function ensureHomeFriendsCollapseControl(nativeCarousel) {
    const header = nativeCarousel?.querySelector(":scope > .container-header") || null;
    const heading = header?.querySelector("h2") || null;
    const list = nativeCarousel ? getNativeHomeFriendList(nativeCarousel) : null;
    const body = list?.closest(".friends-carousel-container") || list;
    if (!header || !heading || !body) {
      return null;
    }
    header.setAttribute(HOME_FRIENDS_HEADER_ATTRIBUTE, "");
    if (!body.id) {
      body.id = "rsl-home-friends-body";
      body.setAttribute(HOME_FRIENDS_OWNED_ID_ATTRIBUTE, "");
    }

    let toggle = header.querySelector(
      `:scope > [${HOME_FRIENDS_TOGGLE_ATTRIBUTE}]`
    );
    const controls = Array.from(
      nativeCarousel.querySelectorAll(`[${HOME_FRIENDS_TOGGLE_ATTRIBUTE}]`)
    );
    for (const duplicate of controls) {
      if (duplicate !== toggle) {
        duplicate.remove();
      }
    }
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.id = "rsl-home-friends-toggle";
      toggle.className =
        "rsl-best-friends-collapse-toggle rsl-home-friends-collapse-toggle";
      toggle.setAttribute(HOME_FRIENDS_TOGGLE_ATTRIBUTE, "");
      toggle.append(document.createTextNode(""));
      toggle.addEventListener("click", (event) => {
        if (event.isTrusted === true) {
          void setHomeFriendsCollapsed(!homeFriendsCollapsed);
        }
      });
    }
    if (heading.nextElementSibling !== toggle) {
      heading.insertAdjacentElement("afterend", toggle);
    }
    return toggle;
  }

  function syncHomeFriendsCollapsedState(nativeCarousel) {
    if (!nativeCarousel) {
      return false;
    }
    // Roblox can render the Friends header before the people row. Apply the
    // root marker first so a persisted collapse remains effective as soon as
    // that late row is inserted, even when Best Friends and Quick Settings are
    // both disabled.
    nativeCarousel.toggleAttribute(
      HOME_FRIENDS_COLLAPSED_ATTRIBUTE,
      homeFriendsCollapsed
    );
    const toggle = ensureHomeFriendsCollapseControl(nativeCarousel);
    if (!toggle) {
      return false;
    }
    const header = nativeCarousel.querySelector(":scope > .container-header");
    const { list, body, contentHost } =
      getHomeFriendsCollapseElements(nativeCarousel);
    if (header) {
      header.hidden = false;
      header.removeAttribute("aria-hidden");
    }
    for (const element of new Set([contentHost, body, list])) {
      if (!element) {
        continue;
      }
      element.setAttribute(HOME_FRIENDS_BODY_ATTRIBUTE, "");
      element.hidden = homeFriendsCollapsed;
      element.toggleAttribute("aria-hidden", homeFriendsCollapsed);
    }
    toggle.hidden = false;
    const nextToggleText = homeFriendsCollapsed ? "Show" : "Hide";
    if (toggle.textContent !== nextToggleText) {
      const textNode =
        toggle.childNodes?.length === 1 &&
        toggle.firstChild?.nodeType === Node.TEXT_NODE
          ? toggle.firstChild
          : null;
      if (textNode) {
        textNode.nodeValue = nextToggleText;
      } else {
        toggle.textContent = nextToggleText;
      }
    }
    toggle.setAttribute("aria-expanded", String(!homeFriendsCollapsed));
    toggle.setAttribute("aria-controls", body?.id || "rsl-home-friends-body");
    toggle.setAttribute(
      "aria-label",
      homeFriendsCollapsed ? "Show Friends" : "Hide Friends"
    );
    return true;
  }

  function cleanupHomeFriendsCollapseControl() {
    const touchedElements = document.querySelectorAll(
      `[${HOME_FRIENDS_TOGGLE_ATTRIBUTE}], ` +
      `[${HOME_FRIENDS_HEADER_ATTRIBUTE}], ` +
      `[${HOME_FRIENDS_BODY_ATTRIBUTE}], ` +
      `.react-friends-carousel-container[${HOME_FRIENDS_COLLAPSED_ATTRIBUTE}]`
    );
    const nativeCarousels = new Set(
      Array.from(touchedElements)
        .map((element) =>
          element.matches?.(".react-friends-carousel-container")
            ? element
            : element.closest?.(".react-friends-carousel-container")
        )
        .filter(Boolean)
    );
    nativeCarousels.forEach((nativeCarousel) => {
        nativeCarousel.removeAttribute(HOME_FRIENDS_COLLAPSED_ATTRIBUTE);
        nativeCarousel
          .querySelectorAll(`[${HOME_FRIENDS_TOGGLE_ATTRIBUTE}]`)
          .forEach((toggle) => toggle.remove());
        nativeCarousel
          .querySelectorAll(`[${HOME_FRIENDS_HEADER_ATTRIBUTE}]`)
          .forEach((header) =>
            header.removeAttribute(HOME_FRIENDS_HEADER_ATTRIBUTE)
          );
        const { list, body, contentHost } =
          getHomeFriendsCollapseElements(nativeCarousel);
        for (const element of new Set([
          contentHost,
          body,
          list,
          ...nativeCarousel.querySelectorAll(`[${HOME_FRIENDS_BODY_ATTRIBUTE}]`)
        ])) {
          if (!element) {
            continue;
          }
          element.hidden = false;
          element.removeAttribute("aria-hidden");
          element.removeAttribute(HOME_FRIENDS_BODY_ATTRIBUTE);
          if (element.hasAttribute(HOME_FRIENDS_OWNED_ID_ATTRIBUTE)) {
            element.removeAttribute(HOME_FRIENDS_OWNED_ID_ATTRIBUTE);
            if (element.id === "rsl-home-friends-body") {
              element.removeAttribute("id");
            }
          }
        }
      });
  }

  function refreshHomeFriendsDependentLayout(nativeCarousel) {
    const carousel = document.querySelector(
      `[${BEST_FRIENDS_CAROUSEL_ATTRIBUTE}]`
    );
    if (!carousel || !nativeCarousel) {
      return;
    }
    if (!homeFriendsCollapsed && isFeatureEnabled("bestFriends")) {
      syncBestFriendsTileSpacing(carousel, nativeCarousel);
    }
    placeBestFriendsCarousel(carousel, nativeCarousel);
    observeBestFriendsGeometry(carousel);
  }

  function measureHomeFriendsBeforeCollapse(nativeCarousel) {
    const carousel = document.querySelector(
      `[${BEST_FRIENDS_CAROUSEL_ATTRIBUTE}]`
    );
    if (
      homeFriendsCollapsed &&
      carousel &&
      isFeatureEnabled("bestFriends")
    ) {
      syncBestFriendsTileSpacing(carousel, nativeCarousel);
    }
  }

  function mountHomeFriendsCollapseControl() {
    if (!isHomePage()) {
      cleanupHomeFriendsCollapseControl();
      return;
    }
    const nativeCarousel = findNativeHomeFriendsCarousel();
    if (!nativeCarousel) {
      return;
    }
    measureHomeFriendsBeforeCollapse(nativeCarousel);
    ensureHomeFriendsCollapseControl(nativeCarousel);
    syncHomeFriendsCollapsedState(nativeCarousel);
    refreshHomeFriendsDependentLayout(nativeCarousel);
  }

  function findFriendsContext() {
    if (!isFriendsPage()) {
      return null;
    }

    const mount =
      document.querySelector("#friends-web-app, #friends-container") ||
      (document.documentElement.dataset.rslFriendsFixture === "true" ? document.body : null);
    if (!mount) {
      return null;
    }

    const group =
      mount.querySelector(".friends-content .chip-filters-container") ||
      mount.querySelector(".chip-filters-container");
    if (!group) {
      return { mount, group: null, allButton: null, trustedButton: null };
    }

    const nativeButtons = Array.from(
      group.querySelectorAll(`:scope > button[aria-pressed]:not([${ONLINE_FILTER_CONTROL_ATTRIBUTE}])`)
    );
    if (nativeButtons.length < 2) {
      return { mount, group, allButton: null, trustedButton: null };
    }

    const allButton =
      nativeButtons.find((button) => normalizeVisibleText(button) === "All") || nativeButtons[0];
    const trustedButton =
      nativeButtons.find((button) => normalizeVisibleText(button) === "Trusted") ||
      nativeButtons.find((button) => button !== allButton) ||
      null;

    return { mount, group, allButton, trustedButton };
  }

  function setClassName(element, className) {
    if (className && element.className !== className) {
      element.className = className;
    }
  }

  function setAriaPressed(element, pressed) {
    const value = String(pressed);
    if (element.getAttribute("aria-pressed") !== value) {
      element.setAttribute("aria-pressed", value);
    }
  }

  function captureFriendsChipClasses(allButton, trustedButton) {
    const nativeButtons = [allButton, trustedButton].filter(Boolean);
    const activeButton = nativeButtons.find(
      (button) => button.getAttribute("aria-pressed") === "true"
    );
    const inactiveButton = nativeButtons.find(
      (button) => button.getAttribute("aria-pressed") === "false"
    );

    if (activeButton && !activeButton.hasAttribute(ONLINE_FILTER_DEMOTED_ATTRIBUTE)) {
      activeFriendsChipClass = activeButton.className;
    }
    if (inactiveButton) {
      inactiveFriendsChipClass = inactiveButton.className;
    }
  }

  function restoreNativeFriendsChip(selectedNativeButton = null) {
    document.querySelectorAll(`[${ONLINE_FILTER_DEMOTED_ATTRIBUTE}]`).forEach((button) => {
      const group = button.closest(".chip-filters-container");
      const nativeButtons = group
        ? Array.from(
            group.querySelectorAll(
              `:scope > button[aria-pressed]:not([${ONLINE_FILTER_CONTROL_ATTRIBUTE}])`
            )
          )
        : [button];

      for (const nativeButton of nativeButtons) {
        const isSelected = selectedNativeButton
          ? nativeButton === selectedNativeButton
          : nativeButton === button;
        setClassName(
          nativeButton,
          isSelected ? activeFriendsChipClass : inactiveFriendsChipClass
        );
        setAriaPressed(nativeButton, isSelected);
      }
      button.removeAttribute(ONLINE_FILTER_DEMOTED_ATTRIBUTE);
    });

    document.querySelectorAll(`[${ONLINE_FILTER_CONTROL_ATTRIBUTE}]`).forEach((button) => {
      setClassName(button, inactiveFriendsChipClass);
      setAriaPressed(button, false);
    });
  }

  function isSafeAvatarUrl(rawUrl) {
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

  function normalizeOnlineFriend(friend) {
    const userId = String(friend?.userId ?? "");
    if (!/^\d{1,20}$/.test(userId) || userId === "0") {
      return null;
    }

    const username =
      typeof friend?.username === "string" ? friend.username.trim().slice(0, 100) : "";
    const displayName =
      typeof friend?.displayName === "string"
        ? friend.displayName.trim().slice(0, 100)
        : "";
    const presenceType = ["Online", "InGame", "InStudio", "Offline"].includes(friend?.presenceType)
      ? friend.presenceType
      : "Online";

    return {
      userId,
      username: username || displayName || `User ${userId}`,
      displayName: displayName || username || `User ${userId}`,
      isVerified: friend?.isVerified === true,
      isVerifiedKnown:
        friend?.isVerifiedKnown === true ||
        (friend?.isVerifiedKnown !== false && typeof friend?.isVerified === "boolean"),
      isRobloxPlus: friend?.isRobloxPlus === true,
      isRobloxPlusKnown: friend?.isRobloxPlusKnown === true,
      presenceType,
      lastLocation:
        typeof friend?.lastLocation === "string"
          ? friend.lastLocation.trim().slice(0, 300)
          : "",
      placeId: /^\d{1,20}$/.test(String(friend?.placeId ?? ""))
        ? String(friend.placeId)
        : null,
      rootPlaceId: /^\d{1,20}$/.test(String(friend?.rootPlaceId ?? ""))
        ? String(friend.rootPlaceId)
        : null,
      universeId: /^\d{1,20}$/.test(String(friend?.universeId ?? ""))
        ? String(friend.universeId)
        : null,
      gameInstanceId:
        typeof friend?.gameInstanceId === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          friend.gameInstanceId
        )
          ? friend.gameInstanceId
          : null,
      headshotUrl: isSafeAvatarUrl(friend?.headshotUrl) ? friend.headshotUrl : null
    };
  }

  function getBestFriendPresenceRank(presenceType) {
    if (presenceType === "InGame" || presenceType === "InStudio") {
      return 0;
    }
    if (presenceType === "Online") {
      return 1;
    }
    return 2;
  }

  function getPresenceSortedBestFriendDetails(friends = bestFriendDetails) {
    return friends
      .map((friend, originalIndex) => ({ friend, originalIndex }))
      .sort((left, right) =>
        getBestFriendPresenceRank(left.friend.presenceType) -
          getBestFriendPresenceRank(right.friend.presenceType) ||
        left.originalIndex - right.originalIndex
      )
      .map(({ friend }) => friend);
  }

  function sendFriendsRuntimeMessage(
    message,
    timeoutMs = FRIENDS_RUNTIME_MESSAGE_TIMEOUT_MS
  ) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        const error = new Error("Roblox friends request timed out");
        error.code = "TIMEOUT";
        reject(error);
      }, timeoutMs || FRIENDS_RUNTIME_MESSAGE_TIMEOUT_MS);

      const settle = (callback, value) => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timeout);
        callback(value);
      };

      try {
        chrome.runtime.sendMessage(message, (response) => {
          const runtimeError = chrome.runtime.lastError;
          if (runtimeError) {
            settle(reject, new Error(runtimeError.message));
            return;
          }
          settle(resolve, response);
        });
      } catch (error) {
        settle(reject, error);
      }
    });
  }

  function requestFriendsAdvancedFilterData(operation, payload = {}) {
    return sendFriendsRuntimeMessage(
      {
        type: FRIENDS_ADVANCED_FILTER_MESSAGE_TYPE,
        op: operation,
        requestId: Number(payload.requestId) || ++friendsAdvancedRequestGeneration,
        ...payload,
        viewerUserId: onlineFriendsViewerUserId
      },
      FRIENDS_ADVANCED_RUNTIME_MESSAGE_TIMEOUT_MS
    );
  }

  function requestAllOnlineFriends(requestId, forceRefresh) {
    if (document.documentElement.dataset.rslFriendsFixture === "true") {
      const fixtureProvider = globalThis.__rslFriendsFixtureOnlineResponse;
      const fixtureResponse =
        typeof fixtureProvider === "function"
          ? fixtureProvider({ requestId, forceRefresh })
          : fixtureProvider;
      if (fixtureResponse) {
        return Promise.resolve(fixtureResponse).then((response) => ({
          ...response,
          requestId
        }));
      }
    }

    return sendFriendsRuntimeMessage({
      type: "rsl:get-all-online-friends",
      requestId,
      forceRefresh
    });
  }

  function requestBestFriendsContext(requestId) {
    if (
      document.documentElement.dataset.rslHomeFixture === "true" ||
      document.documentElement.dataset.rslFriendsFixture === "true"
    ) {
      const fixtureProvider = globalThis.__rslBestFriendsFixtureContextResponse;
      const fixtureResponse =
        typeof fixtureProvider === "function"
          ? fixtureProvider({ requestId })
          : fixtureProvider;
      if (fixtureResponse) {
        return Promise.resolve(fixtureResponse).then((response) => ({
          ...response,
          requestId
        }));
      }
    }

    return sendFriendsRuntimeMessage({
      type: "rsl:get-best-friends-context",
      requestId
    });
  }

  function requestOnlineFriendDetails(requestId, viewerUserId) {
    if (document.documentElement.dataset.rslFriendsFixture === "true") {
      const fixtureProvider = globalThis.__rslFriendsFixtureOnlineDetailsResponse;
      const fixtureResponse =
        typeof fixtureProvider === "function"
          ? fixtureProvider({ requestId, viewerUserId })
          : fixtureProvider;
      if (fixtureResponse) {
        return Promise.resolve(fixtureResponse).then((response) => ({
          ...response,
          requestId
        }));
      }
    }

    return sendFriendsRuntimeMessage({
      type: "rsl:get-online-friend-details",
      requestId,
      viewerUserId
    });
  }

  function requestOfflineFriendDetails(requestId, viewerUserId) {
    if (document.documentElement.dataset.rslFriendsFixture === "true") {
      const fixtureProvider = globalThis.__rslFriendsFixtureOfflineDetailsResponse;
      const fixtureResponse =
        typeof fixtureProvider === "function"
          ? fixtureProvider({ requestId, viewerUserId })
          : fixtureProvider;
      if (fixtureResponse) {
        return Promise.resolve(fixtureResponse).then((response) => ({
          ...response,
          requestId
        }));
      }
    }

    return sendFriendsRuntimeMessage({
      type: "rsl:get-offline-friend-details",
      requestId,
      viewerUserId
    });
  }

  function normalizeOnlineFriendsResponse(response) {
    const seenUserIds = new Set();
    const friends = [];

    for (const entry of response.friends) {
      const friend = normalizeOnlineFriend(entry);
      if (friend && !seenUserIds.has(friend.userId)) {
        seenUserIds.add(friend.userId);
        friends.push(friend);
      }
    }

    return friends;
  }

  function getFriendsVerificationComplete(responseValue, friends) {
    if (responseValue === true || responseValue === false) {
      return responseValue;
    }
    return friends.every((friend) => friend.isVerifiedKnown === true);
  }

  function getFriendsRobloxPlusComplete(responseValue, friends) {
    if (responseValue === true || responseValue === false) {
      return responseValue;
    }
    return friends.every((friend) => friend.isRobloxPlusKnown === true);
  }

  function getFriendsAdvancedResponseScanId(response, currentScanId = "") {
    const responseScanId =
      typeof response?.scanId === "string" ? response.scanId.trim() : "";
    if (
      !responseScanId ||
      !/^[A-Za-z0-9_-]{1,80}$/.test(responseScanId) ||
      (currentScanId && responseScanId !== currentScanId)
    ) {
      return null;
    }
    return responseScanId;
  }

  function normalizeAllFriendUserIds(values, onlineFriends, offlineFriends) {
    const availableUserIds = new Set(
      [...onlineFriends, ...offlineFriends].map((friend) => friend.userId)
    );
    const seenUserIds = new Set();
    const orderedUserIds = [];
    const append = (value) => {
      const userId = String(value ?? "");
      if (
        availableUserIds.has(userId) &&
        !seenUserIds.has(userId)
      ) {
        seenUserIds.add(userId);
        orderedUserIds.push(userId);
      }
    };
    if (Array.isArray(values)) {
      values.forEach(append);
    }
    onlineFriends.forEach((friend) => append(friend.userId));
    offlineFriends.forEach((friend) => append(friend.userId));
    return orderedUserIds;
  }

  function loadOnlineFriendDetails(requestId, viewerUserId) {
    const request = requestOnlineFriendDetails(requestId, viewerUserId)
      .then((response) => {
        if (
          requestId !== onlineFriendsRequestId ||
          !response?.ok ||
          !Array.isArray(response.friends)
        ) {
          return;
        }

        allOnlineFriends = normalizeOnlineFriendsResponse(response);
        onlineFriendsTotal = allOnlineFriends.length;
        onlineFriendsDetailsComplete = response.detailsComplete === true;
        onlineFriendsVerificationComplete = response.verificationComplete === true;
        if (response.verificationComplete === undefined) {
          onlineFriendsVerificationComplete = getFriendsVerificationComplete(
            response.verificationComplete,
            allOnlineFriends
          );
        }
        onlineFriendsRobloxPlusComplete = response.robloxPlusComplete === true;
        if (response.robloxPlusComplete === undefined) {
          onlineFriendsRobloxPlusComplete = getFriendsRobloxPlusComplete(
            response.robloxPlusComplete,
            allOnlineFriends
          );
        }
        onlineFriendsErrorCode = "";
        queueMount();
      })
      .catch(() => {
        // Presence is already complete; decorative details can retry on refresh.
      })
      .finally(() => {
        if (onlineFriendsDetailsPromise === request) {
          onlineFriendsDetailsPromise = null;
        }
      });

    onlineFriendsDetailsPromise = request;
    return request;
  }

  function loadOfflineFriendDetails(requestId, viewerUserId) {
    if (
      !viewerUserId ||
      (offlineFriendsDetailsComplete &&
        offlineFriendsVerificationComplete &&
        offlineFriendsRobloxPlusComplete)
    ) {
      return Promise.resolve();
    }
    if (
      offlineFriendsDetailsPromise &&
      offlineFriendsDetailsRequestId === requestId
    ) {
      return offlineFriendsDetailsPromise;
    }

    const request = requestOfflineFriendDetails(requestId, viewerUserId)
      .then((response) => {
        if (
          requestId !== onlineFriendsRequestId ||
          !response?.ok ||
          !Array.isArray(response.friends)
        ) {
          return;
        }

        allOfflineFriends = normalizeOnlineFriendsResponse(response);
        offlineFriendsTotal = allOfflineFriends.length;
        offlineFriendsDetailsComplete = response.detailsComplete === true;
        offlineFriendsVerificationComplete = response.verificationComplete === true;
        if (response.verificationComplete === undefined) {
          offlineFriendsVerificationComplete = getFriendsVerificationComplete(
            response.verificationComplete,
            allOfflineFriends
          );
        }
        offlineFriendsRobloxPlusComplete = response.robloxPlusComplete === true;
        if (response.robloxPlusComplete === undefined) {
          offlineFriendsRobloxPlusComplete = getFriendsRobloxPlusComplete(
            response.robloxPlusComplete,
            allOfflineFriends
          );
        }
        queueMount();
      })
      .catch(() => {
        // The complete Offline list is already usable with placeholder details.
      })
      .finally(() => {
        if (offlineFriendsDetailsPromise === request) {
          offlineFriendsDetailsPromise = null;
        }
      });

    offlineFriendsDetailsPromise = request;
    offlineFriendsDetailsRequestId = requestId;
    return request;
  }

  function scheduleOnlineFriendsRefresh() {
    window.clearTimeout(onlineFriendsRefreshTimer);
    onlineFriendsRefreshTimer = null;

    if (
      activeFriendsPresenceFilter !== ALL_FRIENDS_FILTER_VALUE &&
      activeFriendsPresenceFilter !== "online" &&
      activeFriendsPresenceFilter !== "offline"
    ) {
      return;
    }

    onlineFriendsRefreshTimer = window.setTimeout(() => {
      void loadAllOnlineFriends(true);
    }, ONLINE_REFRESH_INTERVAL_MS);
  }

  function loadAllOnlineFriends(forceRefresh = false) {
    if (!isFeatureEnabled("friendFilters")) {
      return Promise.resolve();
    }
    if (onlineFriendsRequestPromise && !forceRefresh) {
      return onlineFriendsRequestPromise;
    }

    const requestId = ++onlineFriendsRequestId;
    const hasCompleteSnapshot = onlineFriendsTotal !== null && offlineFriendsTotal !== null;
    onlineFriendsLoadState = hasCompleteSnapshot ? "refreshing" : "loading";
    onlineFriendsErrorCode = "";
    queueMount();

    const request = requestAllOnlineFriends(requestId, forceRefresh)
      .then((response) => {
        if (requestId !== onlineFriendsRequestId) {
          return;
        }
        if (!response?.ok || !Array.isArray(response.friends)) {
          const error = new Error("Could not load online friends");
          error.code = response?.code || "NETWORK";
          throw error;
        }

        const nextViewerUserId = String(response.viewerUserId || "") || null;
        const viewerChanged = Boolean(
          onlineFriendsViewerUserId &&
          nextViewerUserId &&
          onlineFriendsViewerUserId !== nextViewerUserId
        );
        if (viewerChanged) {
          friendsAdvancedRequestGeneration += 1;
          friendsAdvancedBestFriendsReady = !(
            friendsAdvancedAppliedState.bestFriends !== "any" ||
            friendsAdvancedAppliedState.sortBy === "best-friends-first"
          );
          friendsAdvancedLoadState = hasActiveFriendsAdvancedFilters()
            ? "loading"
            : "idle";
          friendsAdvancedStatus = hasActiveFriendsAdvancedFilters()
            ? "Roblox account changed. Rechecking filters..."
            : "";
        }

        allOnlineFriends = normalizeOnlineFriendsResponse(response);
        onlineFriendsTotal = allOnlineFriends.length;
        allOfflineFriends = Array.isArray(response.offlineFriends)
          ? normalizeOnlineFriendsResponse({ friends: response.offlineFriends })
          : [];
        allFriendUserIds = normalizeAllFriendUserIds(
          response.friendUserIds,
          allOnlineFriends,
          allOfflineFriends
        );
        allFriendsTotal = Number.isSafeInteger(response.scannedFriendTotal)
          ? response.scannedFriendTotal
          : allFriendUserIds.length;
        offlineFriendsTotal = Number.isSafeInteger(response.offlineTotal)
          ? response.offlineTotal
          : allOfflineFriends.length;
        onlineFriendsViewerUserId = nextViewerUserId;
        onlineFriendsDetailsComplete = response.detailsComplete === true;
        offlineFriendsDetailsComplete = response.offlineDetailsComplete === true;
        onlineFriendsVerificationComplete = response.verificationComplete === true;
        if (response.verificationComplete === undefined) {
          onlineFriendsVerificationComplete = getFriendsVerificationComplete(
            response.verificationComplete,
            allOnlineFriends
          );
        }
        onlineFriendsRobloxPlusComplete = response.robloxPlusComplete === true;
        if (response.robloxPlusComplete === undefined) {
          onlineFriendsRobloxPlusComplete = getFriendsRobloxPlusComplete(
            response.robloxPlusComplete,
            allOnlineFriends
          );
        }
        offlineFriendsVerificationComplete =
          response.offlineVerificationComplete === true;
        if (response.offlineVerificationComplete === undefined) {
          offlineFriendsVerificationComplete = getFriendsVerificationComplete(
            response.offlineVerificationComplete,
            allOfflineFriends
          );
        }
        offlineFriendsRobloxPlusComplete =
          response.offlineRobloxPlusComplete === true;
        if (response.offlineRobloxPlusComplete === undefined) {
          offlineFriendsRobloxPlusComplete = getFriendsRobloxPlusComplete(
            response.offlineRobloxPlusComplete,
            allOfflineFriends
          );
        }
        onlineFriendsFetchedAt = Number(response.fetchedAt) || Date.now();
        onlineFriendsLoadState = "ready";
        onlineFriendsErrorCode = "";

        if (response.detailsComplete === false && response.viewerUserId) {
          void loadOnlineFriendDetails(requestId, response.viewerUserId);
        }
        if (
          (activeFriendsPresenceFilter === "offline" ||
            activeFriendsPresenceFilter === ALL_FRIENDS_FILTER_VALUE) &&
          response.offlineDetailsComplete !== true &&
          response.viewerUserId
        ) {
          void loadOfflineFriendDetails(requestId, response.viewerUserId);
        }
        if (viewerChanged && hasActiveFriendsAdvancedFilters()) {
          restartFriendsAdvancedFiltersAfterViewerChange();
        }
      })
      .catch((error) => {
        if (requestId !== onlineFriendsRequestId) {
          return;
        }

        onlineFriendsErrorCode = error?.code || "NETWORK";
        onlineFriendsLoadState = hasCompleteSnapshot ? "ready" : "error";
      })
      .finally(() => {
        if (requestId === onlineFriendsRequestId) {
          onlineFriendsRequestPromise = null;
          scheduleOnlineFriendsRefresh();
          queueMount();
        }
      });

    onlineFriendsRequestPromise = request;
    return request;
  }

  function setFriendsAdvancedProgress(message, isError = false) {
    friendsAdvancedStatus = String(message || "");
    friendsAdvancedStatusIsError = isError;
    friendsAdvancedMetadataRevision += 1;
    queueMount();
    if (isFriendsListSubview() && isFeatureEnabled("friendFilters")) {
      renderFriendsAdvancedFiltersMenu();
    }
  }

  function restartFriendsAdvancedFiltersAfterViewerChange() {
    if (!hasActiveFriendsAdvancedFilters()) {
      return;
    }
    const generation = friendsAdvancedRequestGeneration;
    void loadFriendsAdvancedFilterMetadata(
      friendsAdvancedAppliedState,
      generation
    );
  }

  function rejectFriendsAdvancedViewerMismatch(response, generation) {
    if (generation !== friendsAdvancedRequestGeneration) {
      return true;
    }
    const responseViewerUserId = String(response?.viewerUserId || "");
    if (
      !responseViewerUserId ||
      !onlineFriendsViewerUserId ||
      responseViewerUserId === onlineFriendsViewerUserId
    ) {
      return false;
    }
    friendsAdvancedRequestGeneration += 1;
    friendsAdvancedLoadState = "partial";
    setFriendsAdvancedProgress(
      "Your Roblox account changed. Refreshing the Friends list...",
      true
    );
    void loadAllOnlineFriends(true);
    return true;
  }

  async function loadFriendsAdvancedFilterMetadata(
    rawState = friendsAdvancedAppliedState,
    generation = friendsAdvancedRequestGeneration
  ) {
    const state = normalizeFriendsAdvancedFilterState(rawState);
    const notices = [];
    friendsAdvancedLoadState = "loading";
    friendsAdvancedStatusIsError = false;
    const needsBestFriends =
      state.bestFriends !== "any" || state.sortBy === "best-friends-first";
    friendsAdvancedBestFriendsReady = !needsBestFriends;
    friendsAdvancedMetadataRevision += 1;
    queueMount();

    const needsVerification =
      state.verifiedOnly || state.sortBy === "verified-first";
    const needsRobloxPlus = state.robloxPlusOnly;
    if ((needsVerification || needsRobloxPlus) && onlineFriendsViewerUserId) {
      const detailLoads = [];
      const needsOnlineDetails =
        activeFriendsPresenceFilter === ALL_FRIENDS_FILTER_VALUE ||
        activeFriendsPresenceFilter === "online";
      const needsOfflineDetails =
        activeFriendsPresenceFilter === ALL_FRIENDS_FILTER_VALUE ||
        activeFriendsPresenceFilter === "offline";
      if (
        needsOnlineDetails &&
        (!onlineFriendsDetailsComplete ||
          (needsVerification && !onlineFriendsVerificationComplete) ||
          (needsRobloxPlus && !onlineFriendsRobloxPlusComplete))
      ) {
        detailLoads.push(
          onlineFriendsDetailsPromise ||
            loadOnlineFriendDetails(onlineFriendsRequestId, onlineFriendsViewerUserId)
        );
      }
      if (
        needsOfflineDetails &&
        (!offlineFriendsDetailsComplete ||
          (needsVerification && !offlineFriendsVerificationComplete) ||
          (needsRobloxPlus && !offlineFriendsRobloxPlusComplete))
      ) {
        detailLoads.push(
          offlineFriendsDetailsPromise ||
            loadOfflineFriendDetails(onlineFriendsRequestId, onlineFriendsViewerUserId)
        );
      }
      if (detailLoads.length > 0) {
        setFriendsAdvancedProgress(
          needsVerification && needsRobloxPlus
            ? "Checking Verified and Roblox Plus..."
            : needsRobloxPlus
              ? "Checking Roblox Plus..."
              : "Checking verified badges..."
        );
        await Promise.allSettled(detailLoads);
        if (generation !== friendsAdvancedRequestGeneration) {
          return;
        }
      }
      if (
        needsVerification &&
        ((needsOnlineDetails && !onlineFriendsVerificationComplete) ||
          (needsOfflineDetails && !offlineFriendsVerificationComplete))
      ) {
        notices.push("Some verified badges could not be checked.");
      }
      if (
        (needsRobloxPlus &&
          needsOnlineDetails &&
          !onlineFriendsRobloxPlusComplete) ||
        (needsRobloxPlus &&
          needsOfflineDetails &&
          !offlineFriendsRobloxPlusComplete)
      ) {
        notices.push("Some Roblox Plus subscriptions could not be checked.");
      }
    }

    if (needsBestFriends) {
      const viewerMissingOrMismatch = Boolean(
        onlineFriendsViewerUserId &&
        bestFriendsViewerUserId !== onlineFriendsViewerUserId
      );
      if (bestFriendsLoadState !== "ready" || viewerMissingOrMismatch) {
        setFriendsAdvancedProgress("Loading Best Friends...");
        await loadBestFriendsContext(viewerMissingOrMismatch, true);
        if (generation !== friendsAdvancedRequestGeneration) {
          return;
        }
      }
      const bestFriendsAreKnown =
        bestFriendsLoadState === "ready" &&
        Boolean(onlineFriendsViewerUserId) &&
        bestFriendsViewerUserId === onlineFriendsViewerUserId;
      if (!bestFriendsAreKnown) {
        notices.push("Best Friends could not be checked.");
      }
      friendsAdvancedBestFriendsReady = true;
      friendsAdvancedMetadataRevision += 1;
    }

    if (generation !== friendsAdvancedRequestGeneration) {
      return;
    }
    friendsAdvancedLoadState = notices.length ? "partial" : "ready";
    setFriendsAdvancedProgress(
      notices[0] || "Filters applied.",
      notices.length > 0
    );
  }

  function getNativeFriendsLists(mount) {
    return Array.from(
      mount.querySelectorAll(
        `.friends-content ul.hlist.avatar-cards:not([${ONLINE_LIST_ATTRIBUTE}])`
      )
    );
  }

  function getNativeFriendsPaginationElements(mount, nativeList) {
    const pagination = new Set();
    const section = nativeList?.closest(".friends-content.section");
    const sibling = section?.nextElementSibling;

    if (sibling?.matches(".pager-holder, .pager-container, .friends-pager")) {
      pagination.add(sibling);
    }
    mount
      .querySelectorAll(".pager-holder, .pager-container, .friends-pager")
      .forEach((element) => pagination.add(element));

    return Array.from(pagination);
  }

  function captureNativeFriendCardTemplate(nativeList) {
    if (nativeFriendCardTemplate) {
      return;
    }

    const card = nativeList?.querySelector(":scope > li.list-item.avatar-card");
    if (card) {
      nativeFriendCardTemplate = card.cloneNode(true);
    }
  }

  function makeFallbackFriendCardTemplate() {
    const card = document.createElement("li");
    card.className = "list-item avatar-card";
    card.innerHTML =
      '<div class="avatar-card-container"><div class="avatar-card-content">' +
      '<div class="avatar avatar-card-fullbody" data-testid="avatar-card-container">' +
      '<a class="avatar-card-link" data-testid="avatar-card-link">' +
      '<span class="thumbnail-2d-container avatar-card-image"><img alt=""></span></a>' +
      '<div class="avatar-status"></div></div>' +
      '<div class="avatar-card-caption"><span><div class="avatar-name-container">' +
      '<a class="text-overflow avatar-name"></a></div>' +
      '<div class="avatar-card-label"></div><div class="avatar-card-label"></div>' +
      "</span></div></div></div>";
    return card;
  }

  function getPresencePresentation(friend) {
    if (friend.presenceType === "Offline") {
      return { iconClass: "", label: "Offline", gameId: null };
    }
    if (friend.presenceType === "InGame") {
      return {
        iconClass: "game icon-game",
        label: friend.lastLocation || "In an experience",
        gameId: friend.rootPlaceId || friend.placeId
      };
    }
    if (friend.presenceType === "InStudio") {
      return {
        iconClass: "studio icon-studio",
        label: friend.lastLocation || "In Studio",
        gameId: null
      };
    }
    return { iconClass: "online icon-online", label: "Online", gameId: null };
  }

  function makeVerifiedFriendNameBadge(carouselLayout = false) {
    const badge = document.createElement("span");
    badge.className = "verified-badge rsl-friend-name-badge rsl-friend-name-badge--verified";
    badge.setAttribute("role", "img");
    badge.setAttribute("aria-label", "Verified");
    badge.setAttribute("data-rblx-verified-badge-icon", "");
    badge.setAttribute("data-rblx-badge-icon", "true");
    const image = document.createElement("img");
    image.className = "rsl-friend-name-badge__verified-image";
    image.src = VERIFIED_BADGE_ICON_URL;
    image.alt = "Verified Badge Icon";
    image.title = "Verified Badge Icon";
    badge.append(image);

    if (!carouselLayout) {
      badge.setAttribute("data-rsl-friend-name-badge", "verified");
      return badge;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "friend-tile-verified-badge rsl-friend-name-badge-wrapper";
    wrapper.setAttribute("data-rsl-friend-name-badge", "verified");
    const spacer = document.createElement("div");
    spacer.className = "friend-tile-spacer";
    wrapper.append(spacer, badge);
    return wrapper;
  }

  function makeRobloxPlusFriendNameBadge(carouselLayout = false) {
    const icon = document.createElement("span");
    icon.setAttribute("role", "presentation");
    icon.className =
      "grow-0 shrink-0 basis-auto icon icon-regular-roblox-plus " +
      "size-[var(--icon-size-small)] content-system-contrast";
    icon.setAttribute("aria-label", "Roblox Plus subscriber");

    if (!carouselLayout) {
      icon.classList.add("icon-display-name-badge-plus", "rsl-friend-name-badge");
      icon.setAttribute("data-rsl-friend-name-badge", "plus");
      return icon;
    }

    const wrapper = document.createElement("span");
    wrapper.className =
      "items-center gap-xxsmall inline-flex shrink-0 [--icon-size-small:1em] " +
      "rsl-friend-name-badge-wrapper";
    wrapper.setAttribute("data-rsl-friend-name-badge", "plus");
    wrapper.append(icon);
    return wrapper;
  }

  function appendFriendNameBadges(container, friend, carouselLayout = false) {
    if (!container) {
      return;
    }
    container
      .querySelectorAll(":scope > [data-rsl-friend-name-badge]")
      .forEach((badge) => badge.remove());
    container.setAttribute("data-rsl-friend-name-badges", "");
    container.classList.toggle("verified", friend.isVerified === true);
    let badgeCount = 0;
    if (friend.isVerified === true) {
      container.append(makeVerifiedFriendNameBadge(carouselLayout));
      badgeCount += 1;
    }
    if (friend.isRobloxPlus === true) {
      container.append(makeRobloxPlusFriendNameBadge(carouselLayout));
      badgeCount += 1;
    }
    container.setAttribute("data-rsl-friend-name-badge-count", String(badgeCount));
  }

  function makeOnlineFriendCard(friend) {
    const template = nativeFriendCardTemplate || makeFallbackFriendCardTemplate();
    const card = template.cloneNode(true);
    const profilePath = `/users/${friend.userId}/profile`;

    card.id = `rsl-online-friend-${friend.userId}`;
    card.dataset.rslOnlineFriendId = friend.userId;
    card.dataset.rslOnlineSearchText = `${friend.displayName} ${friend.username}`.toLowerCase();
    card.removeAttribute("data-fixture-status");
    card.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
    card
      .querySelectorAll(
        ".avatar-card-menu, .avatar-card-btns, button, [data-rblx-verified-badge-icon], " +
        ".verified-badge-friends-img, .icon-display-name-badge-plus"
      )
      .forEach((element) => element.remove());

    card.querySelectorAll('a[href*="/users/"], a.avatar-card-link, a.avatar-name').forEach((link) => {
      link.href = profilePath;
    });

    let imageContainer = card.querySelector(".avatar-card-image");
    if (!imageContainer) {
      const avatarLink = card.querySelector("a.avatar-card-link");
      if (avatarLink) {
        imageContainer = document.createElement("span");
        imageContainer.className = "thumbnail-2d-container avatar-card-image";
        avatarLink.prepend(imageContainer);
      }
    }
    if (imageContainer) {
      imageContainer.classList.remove("loading", "shimmer");
      imageContainer.removeAttribute("aria-busy");
      imageContainer.classList.add("rsl-owned-thumbnail-frame");

      const image = document.createElement("img");
      image.alt = `${friend.displayName} avatar`;
      image.decoding = "async";
      image.loading = "lazy";
      image.referrerPolicy = "no-referrer";
      imageContainer.replaceChildren(image);
      loadOwnedThumbnailImage(
        imageContainer,
        image,
        friend.headshotUrl,
        DEFAULT_AVATAR_URL
      );
    }

    const captionSpan =
      card.querySelector(".avatar-card-caption > span") ||
      card.querySelector(".avatar-card-caption") ||
      card;
    let nameContainer = card.querySelector(".avatar-name-container");
    if (!nameContainer) {
      nameContainer = document.createElement("div");
      nameContainer.className = "avatar-name-container";
      captionSpan.prepend(nameContainer);
    }
    nameContainer.classList.remove("verified");

    let nameLink = nameContainer.querySelector("a.avatar-name");
    if (!nameLink) {
      nameLink = document.createElement("a");
      nameLink.className = "text-overflow avatar-name";
    }
    nameLink.href = profilePath;
    nameLink.textContent = friend.displayName;
    nameContainer.replaceChildren(nameLink);
    appendFriendNameBadges(nameContainer, friend);

    const labels = Array.from(captionSpan.children).filter((element) =>
      element.classList?.contains("avatar-card-label")
    );
    while (labels.length < 2) {
      const label = document.createElement("div");
      label.className = "avatar-card-label";
      captionSpan.append(label);
      labels.push(label);
    }
    labels[0].textContent = `@${friend.username}`;

    const presence = getPresencePresentation(friend);
    labels[1].replaceChildren();
    if (presence.gameId) {
      const gameLink = document.createElement("a");
      gameLink.className = "avatar-status-link text-link";
      gameLink.href = `/games/${presence.gameId}`;
      gameLink.textContent = presence.label;
      labels[1].append(gameLink);
    } else {
      labels[1].textContent = presence.label;
    }

    let avatarStatus = card.querySelector(".avatar-status");
    if (!avatarStatus) {
      avatarStatus = document.createElement("div");
      avatarStatus.className = "avatar-status";
      card.querySelector('[data-testid="avatar-card-container"]')?.append(avatarStatus);
    }
    if (presence.iconClass) {
      const presenceIcon = document.createElement("span");
      presenceIcon.dataset.testid = "presence-icon";
      presenceIcon.className = presence.iconClass;
      presenceIcon.title = presence.label;
      avatarStatus.replaceChildren(presenceIcon);
    } else {
      avatarStatus.replaceChildren();
    }

    return card;
  }

  function getBaseActivePresenceFriends() {
    if (activeFriendsPresenceFilter === BEST_FRIENDS_FILTER_VALUE) {
      return bestFriendDetails;
    }
    if (activeFriendsPresenceFilter === ALL_FRIENDS_FILTER_VALUE) {
      const friendsByUserId = new Map(
        [...allOnlineFriends, ...allOfflineFriends].map((friend) => [
          friend.userId,
          friend
        ])
      );
      const orderedFriends = [];
      const includedUserIds = new Set();
      for (const userId of allFriendUserIds) {
        const friend = friendsByUserId.get(userId);
        if (friend && !includedUserIds.has(userId)) {
          includedUserIds.add(userId);
          orderedFriends.push(friend);
        }
      }
      for (const friend of [...allOnlineFriends, ...allOfflineFriends]) {
        if (!includedUserIds.has(friend.userId)) {
          includedUserIds.add(friend.userId);
          orderedFriends.push(friend);
        }
      }
      return orderedFriends;
    }
    return activeFriendsPresenceFilter === "offline" ? allOfflineFriends : allOnlineFriends;
  }

  function hasActiveFriendsAdvancedFilters(state = friendsAdvancedAppliedState) {
    const normalized = normalizeFriendsAdvancedFilterState(state);
    return Boolean(
      normalized.verifiedOnly ||
      normalized.robloxPlusOnly ||
      normalized.statuses.length > 0 ||
      normalized.bestFriends !== "any" ||
      normalized.sortBy !== "default" ||
      normalized.gameUniverseId ||
      normalized.gameRootPlaceId
    );
  }

  function getEffectiveFriendsAdvancedFilterState() {
    const state = { ...friendsAdvancedAppliedState };
    if (!friendsAdvancedBestFriendsReady) {
      state.bestFriends = "any";
      if (state.sortBy === "best-friends-first") {
        state.sortBy = "default";
      }
    }
    return state;
  }

  function getActivePresenceFriends() {
    let baseFriends;
    if (activeFriendsPresenceFilter === BEST_FRIENDS_FILTER_VALUE) {
      baseFriends = bestFriendDetails;
    } else if (activeFriendsPresenceFilter === ALL_FRIENDS_FILTER_VALUE) {
      const friendsByUserId = new Map(
        [...allOnlineFriends, ...allOfflineFriends].map((friend) => [
          friend.userId,
          friend
        ])
      );
      const orderedFriends = [];
      const includedUserIds = new Set();
      for (const userId of allFriendUserIds) {
        const friend = friendsByUserId.get(userId);
        if (friend && !includedUserIds.has(userId)) {
          includedUserIds.add(userId);
          orderedFriends.push(friend);
        }
      }
      for (const friend of [...allOnlineFriends, ...allOfflineFriends]) {
        if (!includedUserIds.has(friend.userId)) {
          includedUserIds.add(friend.userId);
          orderedFriends.push(friend);
        }
      }
      baseFriends = orderedFriends;
    } else {
      baseFriends = activeFriendsPresenceFilter === "offline"
        ? allOfflineFriends
        : allOnlineFriends;
    }
    if (
      typeof hasActiveFriendsAdvancedFilters !== "function" ||
      !hasActiveFriendsAdvancedFilters()
    ) {
      if (typeof friendsAdvancedMatchCount === "undefined") {
        return baseFriends;
      }
      friendsAdvancedMatchCount = baseFriends.length;
      friendsAdvancedUnknownCount = 0;
      return baseFriends;
    }

    const bestFriendIdSet = new Set(bestFriendUserIds);
    const bestFriendsAreKnown =
      bestFriendsLoadState === "ready" &&
      Boolean(onlineFriendsViewerUserId) &&
      onlineFriendsViewerUserId === bestFriendsViewerUserId;
    const augmentedFriends = baseFriends.map((friend) => ({
      ...friend,
      isBestFriend: bestFriendIdSet.has(friend.userId),
      isBestFriendKnown: bestFriendsAreKnown
    }));
    const result = applyFriendsAdvancedFilters(
      augmentedFriends,
      getEffectiveFriendsAdvancedFilterState()
    );
    friendsAdvancedMatchCount = result.friends.length;
    friendsAdvancedUnknownCount = result.unknown.length;
    return result.friends;
  }

  function getActivePresenceTotal() {
    if (activeFriendsPresenceFilter === BEST_FRIENDS_FILTER_VALUE) {
      return bestFriendsLoadState === "idle" || bestFriendsLoadState === "loading"
        ? null
        : bestFriendUserIds.length;
    }
    if (activeFriendsPresenceFilter === ALL_FRIENDS_FILTER_VALUE) {
      if (allFriendsTotal !== null) {
        return allFriendsTotal;
      }
      return onlineFriendsTotal === null || offlineFriendsTotal === null
        ? null
        : onlineFriendsTotal + offlineFriendsTotal;
    }
    return activeFriendsPresenceFilter === "offline" ? offlineFriendsTotal : onlineFriendsTotal;
  }

  function getActivePresenceLabel() {
    if (activeFriendsPresenceFilter === BEST_FRIENDS_FILTER_VALUE) {
      return "Best Friends";
    }
    if (activeFriendsPresenceFilter === ALL_FRIENDS_FILTER_VALUE) {
      return "friends";
    }
    return activeFriendsPresenceFilter === "offline" ? "offline" : "online";
  }

  function getActiveFriendsLoadState() {
    return activeFriendsPresenceFilter === BEST_FRIENDS_FILTER_VALUE
      ? bestFriendsLoadState
      : onlineFriendsLoadState;
  }

  function getActiveFriendsErrorCode() {
    return activeFriendsPresenceFilter === BEST_FRIENDS_FILTER_VALUE
      ? bestFriendsErrorCode
      : onlineFriendsErrorCode;
  }

  function getOnlineListSignature() {
    const loadState = getActiveFriendsLoadState();
    if (loadState === "loading" || loadState === "error") {
      return `${activeFriendsPresenceFilter}:${loadState}`;
    }

    return JSON.stringify([
      activeFriendsPresenceFilter,
      friendsAdvancedAppliedState,
      friendsAdvancedMetadataRevision,
      friendsAdvancedLoadState,
      getActivePresenceFriends().map((friend) => [
        friend.userId,
        friend.displayName,
        friend.username,
        friend.isVerified,
        friend.isVerifiedKnown,
        friend.isRobloxPlus,
        friend.isRobloxPlusKnown,
        friend.presenceType,
        friend.lastLocation,
        friend.rootPlaceId,
        friend.placeId,
        friend.universeId,
        friend.gameInstanceId,
        friend.headshotUrl
      ])
    ]);
  }

  function applyOnlineFriendsSearch(mount) {
    const input = mount.querySelector("input.friends-filter-searchbar-input");
    const query = (input?.value || "").trim().toLowerCase().replace(/^@+/, "");

    mount.querySelectorAll(`[${ONLINE_LIST_ATTRIBUTE}] > li[data-rsl-online-friend-id]`).forEach(
      (card) => {
        const hidden = Boolean(query) && !card.dataset.rslOnlineSearchText.includes(query);
        card.toggleAttribute(ONLINE_SEARCH_HIDDEN_ATTRIBUTE, hidden);
      }
    );
  }

  function bindOnlineFriendsSearch(mount) {
    const input = mount.querySelector("input.friends-filter-searchbar-input");
    if (!input || boundFriendsSearchInputs.has(input)) {
      return;
    }

    boundFriendsSearchInputs.add(input);
    input.addEventListener("input", () => applyOnlineFriendsSearch(mount));
  }

  function renderOnlineFriendsState(mount, onlineList) {
    let stateElement = mount.querySelector(`[${ONLINE_STATE_ATTRIBUTE}]`);
    const activeFriends = getActivePresenceFriends();
    const activeTotal = getActivePresenceTotal();
    const presenceLabel = getActivePresenceLabel();
    const loadState = getActiveFriendsLoadState();
    const errorCode = getActiveFriendsErrorCode();
    const showingBestFriends =
      activeFriendsPresenceFilter === BEST_FRIENDS_FILTER_VALUE;
    const showingAllFriends =
      activeFriendsPresenceFilter === ALL_FRIENDS_FILTER_VALUE;
    const showCards =
      activeTotal !== null &&
      activeFriends.length > 0 &&
      loadState !== "error";

    if (showCards) {
      stateElement?.remove();
      return;
    }

    if (!stateElement) {
      stateElement = document.createElement("div");
      stateElement.className = "rsl-online-friends-state";
      stateElement.setAttribute(ONLINE_STATE_ATTRIBUTE, "");
      onlineList.insertAdjacentElement("afterend", stateElement);
    } else if (stateElement.previousElementSibling !== onlineList) {
      onlineList.insertAdjacentElement("afterend", stateElement);
    }

    const stateSignature = JSON.stringify([
      activeFriendsPresenceFilter,
      loadState,
      activeTotal,
      errorCode,
      friendsAdvancedAppliedState,
      friendsAdvancedMetadataRevision,
      activeFriends.length
    ]);
    if (stateElement.dataset.rslStateSignature === stateSignature) {
      return;
    }
    stateElement.dataset.rslStateSignature = stateSignature;
    stateElement.replaceChildren();

    const message = document.createElement("p");
    if (loadState === "error") {
      message.textContent = showingBestFriends
        ? errorCode === "UNAUTHENTICATED"
          ? "Sign in to load Best Friends."
          : "Could not load Best Friends."
        : showingAllFriends
          ? errorCode === "UNAUTHENTICATED"
            ? "Sign in to load all friends."
            : "Could not load all friends."
        : errorCode === "UNAUTHENTICATED"
          ? `Sign in to load all ${presenceLabel} friends.`
          : `Could not load all ${presenceLabel} friends.`;
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "rsl-online-friends-retry";
      retry.textContent = "Retry";
      retry.addEventListener("click", () => {
        if (showingBestFriends) {
          void loadBestFriendsContext(true);
        } else {
          void loadAllOnlineFriends(true);
        }
      });
      stateElement.append(message, retry);
    } else if (loadState === "loading" || loadState === "idle") {
      message.textContent = showingBestFriends
        ? "Loading Best Friends..."
        : showingAllFriends
          ? "Loading all friends..."
        : `Loading all ${presenceLabel} friends...`;
      stateElement.append(message);
    } else {
      message.textContent = hasActiveFriendsAdvancedFilters()
        ? "No friends match these filters."
        : showingBestFriends
        ? "No Best Friends selected yet."
        : showingAllFriends
          ? "No friends found."
        : `No friends ${presenceLabel}.`;
      stateElement.append(message);
    }
  }

  function renderAllOnlineFriends(mount, onlineList) {
    const signature = getOnlineListSignature();
    const loadState = getActiveFriendsLoadState();
    if (onlineList.dataset.rslListSignature !== signature) {
      onlineList.dataset.rslListSignature = signature;
      onlineList.replaceChildren();

      if (
        loadState !== "loading" &&
        loadState !== "error"
      ) {
        const fragment = document.createDocumentFragment();
        for (const friend of getActivePresenceFriends()) {
          fragment.append(makeOnlineFriendCard(friend));
        }
        onlineList.append(fragment);
      }
    }

    renderOnlineFriendsState(mount, onlineList);
    bindOnlineFriendsSearch(mount);
    applyOnlineFriendsSearch(mount);
  }

  function reconcileOnlineFriendCards(mount) {
    if (!activeFriendsPresenceFilter || !mount) {
      document
        .querySelectorAll(`[${ONLINE_NATIVE_LIST_HIDDEN_ATTRIBUTE}]`)
        .forEach((list) => list.removeAttribute(ONLINE_NATIVE_LIST_HIDDEN_ATTRIBUTE));
      document
        .querySelectorAll(`[${ONLINE_NATIVE_PAGINATION_HIDDEN_ATTRIBUTE}]`)
        .forEach((element) =>
          element.removeAttribute(ONLINE_NATIVE_PAGINATION_HIDDEN_ATTRIBUTE)
        );
      document.querySelectorAll(`[${ONLINE_LIST_ATTRIBUTE}]`).forEach((list) => list.remove());
      document.querySelectorAll(`[${ONLINE_STATE_ATTRIBUTE}]`).forEach((state) => state.remove());
      document
        .querySelectorAll("[data-rsl-online-view-active]")
        .forEach((element) => element.removeAttribute("data-rsl-online-view-active"));
      return;
    }

    mount.setAttribute("data-rsl-online-view-active", "");
    const nativeLists = getNativeFriendsLists(mount);
    const nativeList = nativeLists[0] || null;
    captureNativeFriendCardTemplate(nativeList);
    nativeLists.forEach((list) => list.setAttribute(ONLINE_NATIVE_LIST_HIDDEN_ATTRIBUTE, ""));
    getNativeFriendsPaginationElements(mount, nativeList).forEach((element) =>
      element.setAttribute(ONLINE_NATIVE_PAGINATION_HIDDEN_ATTRIBUTE, "")
    );

    let onlineList = mount.querySelector(`[${ONLINE_LIST_ATTRIBUTE}]`);
    if (!onlineList) {
      onlineList = document.createElement("ul");
      onlineList.className = nativeList?.className || "hlist avatar-cards";
      onlineList.classList.add("rsl-online-friends-list");
      onlineList.setAttribute(ONLINE_LIST_ATTRIBUTE, "");
    }

    if (nativeList) {
      if (onlineList.previousElementSibling !== nativeList) {
        nativeList.insertAdjacentElement("afterend", onlineList);
      }
    } else if (!onlineList.isConnected) {
      const content = mount.querySelector(".friends-content") || mount;
      content.append(onlineList);
    }

    renderAllOnlineFriends(mount, onlineList);
  }

  function disableOnlineFriendsFilter(selectedNativeButton = null) {
    activeFriendsPresenceFilter = null;
    window.clearTimeout(onlineFriendsRefreshTimer);
    onlineFriendsRefreshTimer = null;
    restoreNativeFriendsChip(selectedNativeButton);
    reconcileOnlineFriendCards(null);
  }

  function activateFriendsPresenceFilter(context, presenceFilter) {
    captureFriendsChipClasses(context.allButton, context.trustedButton);

    if (
      presenceFilter !== ALL_FRIENDS_FILTER_VALUE &&
      !activeFriendsPresenceFilter &&
      context.allButton.getAttribute("aria-pressed") !== "true"
    ) {
      suppressNativeFriendsFilterClick = true;
      try {
        context.allButton.click();
      } finally {
        suppressNativeFriendsFilterClick = false;
      }
    }

    activeFriendsPresenceFilter = presenceFilter;
    if (presenceFilter === BEST_FRIENDS_FILTER_VALUE) {
      window.clearTimeout(onlineFriendsRefreshTimer);
      onlineFriendsRefreshTimer = null;
      if (bestFriendsLoadState === "idle" || bestFriendsLoadState === "error") {
        void loadBestFriendsContext(bestFriendsLoadState === "error");
      }
      reconcileOnlineFriendCards(context.mount);
      queueMount();
      return;
    }

    const needsRefresh =
      onlineFriendsLoadState === "idle" ||
      onlineFriendsLoadState === "error" ||
      (onlineFriendsLoadState === "ready" &&
        Date.now() - onlineFriendsFetchedAt > ONLINE_REFRESH_INTERVAL_MS);
    if (needsRefresh) {
      void loadAllOnlineFriends(onlineFriendsLoadState !== "idle");
    } else if (
      (presenceFilter === "offline" ||
        presenceFilter === ALL_FRIENDS_FILTER_VALUE) &&
      !offlineFriendsDetailsComplete &&
      onlineFriendsViewerUserId
    ) {
      void loadOfflineFriendDetails(onlineFriendsRequestId, onlineFriendsViewerUserId);
    }
    scheduleOnlineFriendsRefresh();
    reconcileOnlineFriendCards(context.mount);
    queueMount();
  }

  function getFriendsFilterName(presenceFilter) {
    if (presenceFilter === BEST_FRIENDS_FILTER_VALUE) {
      return "Best Friends";
    }
    return presenceFilter === "offline" ? "Offline" : "Online";
  }

  function updateFriendsPresenceButtonLabel(button, presenceFilter) {
    const name = getFriendsFilterName(presenceFilter);
    const total =
      presenceFilter === BEST_FRIENDS_FILTER_VALUE
        ? bestFriendsLoadState === "idle" || bestFriendsLoadState === "loading"
          ? null
          : bestFriendUserIds.length
        : presenceFilter === "offline"
          ? offlineFriendsTotal
          : onlineFriendsTotal;
    const loadState =
      presenceFilter === BEST_FRIENDS_FILTER_VALUE
        ? bestFriendsLoadState
        : onlineFriendsLoadState;
    const errorCode =
      presenceFilter === BEST_FRIENDS_FILTER_VALUE
        ? bestFriendsErrorCode
        : onlineFriendsErrorCode;
    const label = button.querySelector("span.text-no-wrap") || button.querySelector("span:last-child");
    let text = name;
    if (total !== null) {
      text = `${name} (${total})`;
    } else if (loadState === "loading") {
      text = `${name} (...)`;
    }

    if (label && label.textContent !== text) {
      label.textContent = text;
    }

    const accessibleLabel = presenceFilter === BEST_FRIENDS_FILTER_VALUE
      ? total === null
        ? "Show Best Friends"
        : `Show ${total} Best Friends`
      : total === null
        ? `Show all ${presenceFilter} friends`
        : `Show all ${total} ${presenceFilter} friends`;
    if (button.getAttribute("aria-label") !== accessibleLabel) {
      button.setAttribute("aria-label", accessibleLabel);
    }

    if (errorCode) {
      button.title = presenceFilter === BEST_FRIENDS_FILTER_VALUE
        ? "Could not refresh Best Friends"
        : `Could not refresh the complete ${presenceFilter}-friends list`;
    } else {
      button.removeAttribute("title");
    }
  }

  function makeFriendsPresenceButton(context, presenceFilter) {
    const name = getFriendsFilterName(presenceFilter);
    const button = context.trustedButton.cloneNode(true);

    for (const element of [button, ...button.querySelectorAll("*")]) {
      element.removeAttribute("id");
      element.removeAttribute("aria-current");
      element.removeAttribute("aria-selected");
    }

    const label = button.querySelector("span.text-no-wrap") || button.querySelector("span:last-child");
    if (label) {
      label.textContent = name;
    }

    button.type = "button";
    const markerAttribute =
      presenceFilter === BEST_FRIENDS_FILTER_VALUE
        ? BEST_FRIENDS_FILTER_ITEM_ATTRIBUTE
        : presenceFilter === "offline"
          ? OFFLINE_FILTER_ITEM_ATTRIBUTE
          : ONLINE_FILTER_ITEM_ATTRIBUTE;
    button.setAttribute(markerAttribute, "");
    button.setAttribute(ONLINE_FILTER_CONTROL_ATTRIBUTE, presenceFilter);
    button.setAttribute(
      "aria-label",
      presenceFilter === BEST_FRIENDS_FILTER_VALUE
        ? "Show Best Friends"
        : `Show all ${presenceFilter} friends`
    );
    setAriaPressed(button, false);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      activateFriendsPresenceFilter(findFriendsContext() || context, presenceFilter);
    });

    return button;
  }

  function getFriendsAdvancedActiveCount(state = friendsAdvancedAppliedState) {
    const normalized = normalizeFriendsAdvancedFilterState(state);
    return [
      normalized.verifiedOnly,
      normalized.robloxPlusOnly,
      normalized.statuses.length > 0,
      normalized.bestFriends !== "any",
      normalized.sortBy !== "default",
      Boolean(normalized.gameUniverseId || normalized.gameRootPlaceId)
    ].filter(Boolean).length;
  }

  function getFriendsAdvancedTargetInputValue(target) {
    return typeof target?.input === "string" ? target.input : "";
  }

  function positionFriendsAdvancedFiltersHelpTooltips(dialog) {
    if (!dialog?.open) return;
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
    const edge = 8;
    const gap = 5;
    dialog.querySelectorAll(`[${FRIENDS_ADVANCED_FILTER_HELP_ATTRIBUTE}][aria-expanded="true"]`).forEach(
      (button) => {
        const controlledId = button.getAttribute("aria-controls");
        const tooltip = controlledId ? dialog.querySelector(`#${controlledId}`) : null;
        if (!tooltip || tooltip.hidden) return;
        const buttonRect = button.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        const tooltipWidth = Math.min(tooltipRect.width, Math.max(0, viewportWidth - edge * 2));
        const tooltipHeight = tooltipRect.height;
        const spaceAbove = buttonRect.top - gap - edge;
        const spaceBelow = viewportHeight - buttonRect.bottom - gap - edge;
        const prefersAbove = button.closest(".rsl-friends-filters__help-wrap")
          ?.classList.contains("rsl-friends-filters__help-wrap--above");
        const placeAbove = prefersAbove
          ? spaceAbove >= tooltipHeight || spaceAbove > spaceBelow
          : spaceBelow < tooltipHeight && spaceAbove > spaceBelow;
        const preferredTop = placeAbove
          ? buttonRect.top - gap - tooltipHeight
          : buttonRect.bottom + gap;
        const left = Math.min(
          Math.max(edge, buttonRect.right - tooltipWidth),
          Math.max(edge, viewportWidth - tooltipWidth - edge)
        );
        const top = Math.min(
          Math.max(edge, preferredTop),
          Math.max(edge, viewportHeight - tooltipHeight - edge)
        );
        tooltip.style.left = `${Math.round(left)}px`;
        tooltip.style.top = `${Math.round(top)}px`;
      }
    );
  }

  function resetFriendsAdvancedFiltersHelp(dialog) {
    dialog?.querySelectorAll(`[${FRIENDS_ADVANCED_FILTER_HELP_ATTRIBUTE}]`).forEach(
      (button) => {
        const wrap = button.closest(".rsl-friends-filters__help-wrap");
        if (wrap) delete wrap.dataset.rslHelpPinned;
        button.setAttribute("aria-expanded", "false");
        const controlledId = button.getAttribute("aria-controls");
        if (controlledId) dialog.querySelector(`#${controlledId}`)?.setAttribute("hidden", "");
      }
    );
  }

  function positionFriendsAdvancedFiltersMenu(dialog = null) {
    const menu = dialog || document.querySelector(`[${FRIENDS_ADVANCED_FILTER_MENU_ATTRIBUTE}]`);
    const trigger = document.querySelector(`[${FRIENDS_ADVANCED_FILTER_BUTTON_ATTRIBUTE}]`);
    if (!menu?.open) {
      return;
    }
    if (!trigger?.isConnected) {
      closeFriendsAdvancedFiltersMenu(false);
      return;
    }
    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
    const edge = 8;
    const gap = 7;
    const left = Math.min(
      Math.max(edge, viewportWidth - menuRect.width - edge),
      Math.max(edge, triggerRect.left)
    );
    const below = triggerRect.bottom + gap;
    const above = triggerRect.top - menuRect.height - gap;
    const preferredTop =
      below + menuRect.height <= viewportHeight - edge || above < edge
        ? below
        : above;
    const top = Math.min(
      Math.max(edge, viewportHeight - menuRect.height - edge),
      Math.max(edge, preferredTop)
    );
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
    if (typeof positionFriendsAdvancedFiltersHelpTooltips === "function") {
      positionFriendsAdvancedFiltersHelpTooltips(menu);
    }
  }

  function closeFriendsAdvancedFiltersMenu(restoreFocus = false) {
    const dialog = document.querySelector(`[${FRIENDS_ADVANCED_FILTER_MENU_ATTRIBUTE}]`);
    if (!dialog?.open) {
      return;
    }
    friendsAdvancedResolveRequestId += 1;
    friendsAdvancedResolvingField = "";
    resetFriendsAdvancedFiltersHelp(dialog);
    dialog.dataset.rslRestoreFocus = String(restoreFocus);
    dialog.close();
  }

  function setCompactFriendsAdvancedTargetPresentation(dialog, kind, target) {
    const resolved = dialog.querySelector(`[data-rsl-friends-filter-resolved="${kind}"]`);
    if (!resolved) {
      return;
    }
    resolved.replaceChildren();
    resolved.hidden = !target;
    if (!target) {
      return;
    }
    const text = document.createElement("span");
    text.textContent = kind === "game"
      ? `\u2713 ${target.name || `Universe ${target.universeId}`}`
      : `\u2713 @${target.username || target.userId}`;
    const clear = document.createElement("button");
    clear.type = "button";
    clear.textContent = "\u00d7";
    clear.setAttribute("aria-label", `Clear ${kind === "game" ? "experience" : "user"}`);
    clear.addEventListener("click", () => {
      friendsAdvancedResolveRequestId += 1;
      friendsAdvancedDraftTargets[kind] = null;
      friendsAdvancedDraftInputs[kind] = "";
      friendsAdvancedResolveStatus = "";
      renderFriendsAdvancedFiltersMenu();
      const inputSelector = "[data-rsl-friends-filter-game-input]";
      dialog.querySelector(inputSelector)?.focus();
    });
    resolved.append(text, clear);
  }

  function getFriendsAdvancedDraftFromMenu(dialog) {
    return normalizeFriendsAdvancedFilterState({
      verifiedOnly: dialog.querySelector("[data-rsl-friends-filter-verified]")?.checked,
      robloxPlusOnly: dialog.querySelector("[data-rsl-friends-filter-roblox-plus]")?.checked,
      statuses: Array.from(
        dialog.querySelectorAll("[data-rsl-friends-filter-status]:checked"),
        (input) => input.value
      ),
      bestFriends: dialog.querySelector("[data-rsl-friends-filter-best-friends]")?.value,
      sortBy: dialog.querySelector("[data-rsl-friends-filter-sort]")?.value,
      gameUniverseId: friendsAdvancedDraftTargets.game?.universeId,
      gameRootPlaceId: friendsAdvancedDraftTargets.game?.rootPlaceId
    });
  }

  async function resolveFriendsAdvancedFilterTarget(dialog, kind) {
    if (kind !== "game") {
      return false;
    }
    const rawInput = String(friendsAdvancedDraftInputs.game || "").trim();
    if (!rawInput) {
      friendsAdvancedDraftTargets.game = null;
      return true;
    }
    if (friendsAdvancedDraftTargets.game?.input === rawInput) {
      return true;
    }

    const requestId = ++friendsAdvancedResolveRequestId;
    friendsAdvancedResolvingField = "game";
    friendsAdvancedResolveStatus = "Finding experience...";
    friendsAdvancedResolveStatusIsError = false;
    renderFriendsAdvancedFiltersMenu();
    try {
      const response = await requestFriendsAdvancedFilterData("resolve-game", {
        requestId,
        input: rawInput
      });
      if (
        requestId !== friendsAdvancedResolveRequestId ||
        friendsAdvancedDraftInputs.game.trim() !== rawInput
      ) {
        return false;
      }
      const responseViewerUserId = String(response?.viewerUserId || "");
      if (
        responseViewerUserId &&
        onlineFriendsViewerUserId &&
        responseViewerUserId !== onlineFriendsViewerUserId
      ) {
        throw new Error("Your Roblox account changed. Reopen Filters and try again.");
      }
      const target = response?.target || response?.game || response?.user;
      if (!response?.ok || !target) {
        throw new Error("That experience could not be found.");
      }
      friendsAdvancedDraftTargets.game = { ...target, input: rawInput };
      friendsAdvancedResolveStatus = "";
      friendsAdvancedResolveStatusIsError = false;
      return true;
    } catch (error) {
      if (requestId !== friendsAdvancedResolveRequestId) {
        return false;
      }
      friendsAdvancedDraftTargets.game = null;
      friendsAdvancedResolveStatus = error?.message || "That value could not be found.";
      friendsAdvancedResolveStatusIsError = true;
      return false;
    } finally {
      if (requestId === friendsAdvancedResolveRequestId) {
        friendsAdvancedResolvingField = "";
        renderFriendsAdvancedFiltersMenu();
      }
    }
  }

  async function resolveAllFriendsAdvancedFilterTargets(dialog) {
    for (const kind of ["game"]) {
      if (!(await resolveFriendsAdvancedFilterTarget(dialog, kind))) {
        return false;
      }
    }
    return true;
  }

  function renderFriendsAdvancedFiltersMenu() {
    const trigger = document.querySelector(`[${FRIENDS_ADVANCED_FILTER_BUTTON_ATTRIBUTE}]`);
    const activeCount = getFriendsAdvancedActiveCount();
    trigger?.setAttribute("aria-haspopup", "dialog");
    trigger?.setAttribute("aria-controls", "rsl-friends-filters-dialog");
    trigger?.setAttribute(
      "aria-label",
      activeCount > 0 ? `Filters, ${activeCount} active` : "Filters"
    );

    let dialog = document.querySelector(`[${FRIENDS_ADVANCED_FILTER_MENU_ATTRIBUTE}]`);
    // Like the chip, an owned dialog can survive a component/extension remount
    // after the realm that installed its controls has gone away. Recreate only
    // that listenerless retained surface; dialogs created by this realm carry
    // the expando and continue to be reused across ordinary renders.
    if (dialog && dialog._rslFriendsFiltersDialogBound !== true) {
      if (dialog.open) {
        dialog.close();
      }
      if (dialog._rslOutsidePointerHandler) {
        document.removeEventListener(
          "pointerdown",
          dialog._rslOutsidePointerHandler,
          true
        );
      }
      if (dialog._rslRepositionHandler) {
        document.removeEventListener("scroll", dialog._rslRepositionHandler, true);
        window.removeEventListener("resize", dialog._rslRepositionHandler);
      }
      dialog.remove();
      dialog = null;
    }
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog._rslFriendsFiltersDialogBound = true;
      dialog.id = "rsl-friends-filters-dialog";
      dialog.className = "rsl-friends-filters-popover";
      dialog.setAttribute(FRIENDS_ADVANCED_FILTER_MENU_ATTRIBUTE, "");
      dialog.setAttribute("aria-modal", "false");
      dialog.setAttribute("aria-labelledby", "rsl-friends-filters-title");
      dialog.innerHTML = `
        <header class="rsl-friends-filters__header">
          <h2 id="rsl-friends-filters-title">Filters</h2>
          <button type="button" class="rsl-friends-filters__close" aria-label="Close Filters" data-rsl-friends-filters-close>&times;</button>
        </header>
        <div class="rsl-friends-filters__body">
          <div class="rsl-friends-filters__compact-row">
            <span class="rsl-friends-filters__verified-control"><input id="rsl-friends-filter-verified" type="checkbox" data-rsl-friends-filter-verified><label for="rsl-friends-filter-verified">Verified</label></span>
            <span class="rsl-friends-filters__help-wrap"><button type="button" class="rsl-friends-filters__help" ${FRIENDS_ADVANCED_FILTER_HELP_ATTRIBUTE} aria-label="About Verified" aria-controls="rsl-friends-filter-help-verified" aria-expanded="false"><span class="icon-moreinfo-16x16" aria-hidden="true"></span></button><span id="rsl-friends-filter-help-verified" class="rsl-friends-filters__help-copy" role="tooltip" hidden>${FRIENDS_ADVANCED_FILTER_DEFINITIONS.verified.help}</span></span>
          </div>
          <div class="rsl-friends-filters__compact-row">
            <span class="rsl-friends-filters__verified-control"><input id="rsl-friends-filter-roblox-plus" type="checkbox" data-rsl-friends-filter-roblox-plus><label for="rsl-friends-filter-roblox-plus">${FRIENDS_ADVANCED_FILTER_DEFINITIONS.robloxPlus.label}</label></span>
          </div>
          <div class="rsl-friends-filters__compact-field">
            <div class="rsl-friends-filters__label-row"><span id="rsl-friends-filter-status-label">Status</span><span class="rsl-friends-filters__help-wrap"><button type="button" class="rsl-friends-filters__help" ${FRIENDS_ADVANCED_FILTER_HELP_ATTRIBUTE} aria-label="About status availability" aria-controls="rsl-friends-filter-help-status" aria-expanded="false"><span class="icon-moreinfo-16x16" aria-hidden="true"></span></button><span id="rsl-friends-filter-help-status" class="rsl-friends-filters__help-copy" role="tooltip" hidden>${FRIENDS_ADVANCED_FILTER_DEFINITIONS.statusHelp}</span></span></div>
            <div class="rsl-friends-filters__status-options" role="group" aria-labelledby="rsl-friends-filter-status-label">${FRIENDS_ADVANCED_FILTER_DEFINITIONS.statuses.map((item) => `<label><input id="rsl-friends-filter-status-${item.value}" type="checkbox" value="${item.value}" data-rsl-friends-filter-status><span>${item.label}</span></label>`).join("")}</div>
          </div>
          <div class="rsl-friends-filters__compact-row"><label for="rsl-friends-filter-best-friends">Best Friends</label><select id="rsl-friends-filter-best-friends" data-rsl-friends-filter-best-friends>${FRIENDS_ADVANCED_FILTER_DEFINITIONS.bestFriends.map((item) => `<option value="${item.value}">${item.label}</option>`).join("")}</select></div>
          <div class="rsl-friends-filters__compact-row"><label for="rsl-friends-filter-sort">Sort</label><select id="rsl-friends-filter-sort" data-rsl-friends-filter-sort>${FRIENDS_ADVANCED_FILTER_DEFINITIONS.sorts.map((item) => `<option value="${item.value}">${item.label}</option>`).join("")}</select></div>
          <div class="rsl-friends-filters__compact-field">
            <div class="rsl-friends-filters__label-row"><label for="rsl-friends-filter-game">In a specific experience</label><span class="rsl-friends-filters__help-wrap rsl-friends-filters__help-wrap--above"><button type="button" class="rsl-friends-filters__help" ${FRIENDS_ADVANCED_FILTER_HELP_ATTRIBUTE} aria-label="About current experience visibility" aria-controls="rsl-friends-filter-help-game" aria-expanded="false"><span class="icon-moreinfo-16x16" aria-hidden="true"></span></button><span id="rsl-friends-filter-help-game" class="rsl-friends-filters__help-copy" role="tooltip" hidden>${FRIENDS_ADVANCED_FILTER_DEFINITIONS.game.help}</span></span></div>
            <input id="rsl-friends-filter-game" data-rsl-friends-filter-game-input placeholder="Experience name, link, Place ID, or Universe ID" autocomplete="off">
            <div class="rsl-friends-filters__resolved" data-rsl-friends-filter-resolved="game" hidden></div>
          </div>
          <p class="rsl-friends-filters__status" role="status" aria-live="polite" data-rsl-friends-filters-status></p>
        </div>
        <footer class="rsl-friends-filters__footer">
          <button type="button" class="rsl-friends-filters__button" data-rsl-friends-filters-reset>Reset</button>
          <button type="button" class="rsl-friends-filters__button rsl-friends-filters__button--apply" data-rsl-friends-filters-apply>Apply</button>
        </footer>`;

      dialog.querySelector("[data-rsl-friends-filters-close]")?.addEventListener("click", () => {
        closeFriendsAdvancedFiltersMenu(true);
      });
      dialog.addEventListener("close", () => {
        const currentTrigger = document.querySelector(`[${FRIENDS_ADVANCED_FILTER_BUTTON_ATTRIBUTE}]`);
        currentTrigger?.setAttribute("aria-expanded", "false");
        if (dialog.dataset.rslRestoreFocus === "true") {
          const focusTarget = friendsAdvancedDialogOpener?.isConnected
            ? friendsAdvancedDialogOpener
            : currentTrigger;
          focusTarget?.focus?.({ preventScroll: true });
        }
        friendsAdvancedDialogOpener = null;
        delete dialog.dataset.rslRestoreFocus;
      });
      dialog.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeFriendsAdvancedFiltersMenu(true);
        }
      });
      dialog.querySelectorAll(`[${FRIENDS_ADVANCED_FILTER_HELP_ATTRIBUTE}]`).forEach((button) => {
        const wrap = button.closest(".rsl-friends-filters__help-wrap");
        const controlledId = button.getAttribute("aria-controls");
        const controlled = controlledId ? dialog.querySelector(`#${controlledId}`) : null;
        let closeTimer = 0;
        const clearCloseTimer = () => {
          if (!closeTimer) return;
          window.clearTimeout(closeTimer);
          closeTimer = 0;
        };
        const setOpen = (open) => {
          if (!controlled) return;
          controlled.hidden = !open;
          button.setAttribute("aria-expanded", String(open));
          if (open) positionFriendsAdvancedFiltersHelpTooltips(dialog);
        };
        const closeIfTransient = () => {
          closeTimer = 0;
          if (
            wrap?.dataset.rslHelpPinned === "true" ||
            wrap?.matches(":hover") ||
            wrap?.contains(document.activeElement)
          ) {
            return;
          }
          setOpen(false);
        };
        const scheduleTransientClose = () => {
          clearCloseTimer();
          closeTimer = window.setTimeout(closeIfTransient, 120);
        };
        wrap?.addEventListener("pointerenter", () => {
          clearCloseTimer();
          setOpen(true);
        });
        wrap?.addEventListener("pointerleave", scheduleTransientClose);
        button.addEventListener("focus", () => {
          clearCloseTimer();
          setOpen(true);
        });
        button.addEventListener("blur", scheduleTransientClose);
        button.addEventListener("click", () => {
          const wasPinned = wrap?.dataset.rslHelpPinned === "true";
          dialog.querySelectorAll(`[${FRIENDS_ADVANCED_FILTER_HELP_ATTRIBUTE}]`).forEach((other) => {
            const otherWrap = other.closest(".rsl-friends-filters__help-wrap");
            if (otherWrap) delete otherWrap.dataset.rslHelpPinned;
            other.setAttribute("aria-expanded", "false");
            const otherId = other.getAttribute("aria-controls");
            if (otherId) dialog.querySelector(`#${otherId}`)?.setAttribute("hidden", "");
          });
          if (wrap && controlled && !wasPinned) {
            wrap.dataset.rslHelpPinned = "true";
            setOpen(true);
          }
          window.requestAnimationFrame(() => positionFriendsAdvancedFiltersMenu(dialog));
        });
      });
      const inputKinds = [
        ["game", "[data-rsl-friends-filter-game-input]"]
      ];
      for (const [kind, selector] of inputKinds) {
        const input = dialog.querySelector(selector);
        input?.addEventListener("input", () => {
          friendsAdvancedResolveRequestId += 1;
          friendsAdvancedResolvingField = "";
          friendsAdvancedDraftInputs[kind] = input.value;
          friendsAdvancedDraftTargets[kind] = null;
          friendsAdvancedResolveStatus = "";
          friendsAdvancedResolveStatusIsError = false;
          renderFriendsAdvancedFiltersMenu();
        });
        input?.addEventListener("keydown", (event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          void resolveFriendsAdvancedFilterTarget(dialog, kind);
        });
      }
      dialog.querySelector("[data-rsl-friends-filter-verified]")?.addEventListener("change", (event) => {
        friendsAdvancedDraftState = normalizeFriendsAdvancedFilterState({
          ...friendsAdvancedDraftState,
          verifiedOnly: event.currentTarget.checked
        });
      });
      dialog.querySelector("[data-rsl-friends-filter-roblox-plus]")?.addEventListener("change", (event) => {
        friendsAdvancedDraftState = normalizeFriendsAdvancedFilterState({
          ...friendsAdvancedDraftState,
          robloxPlusOnly: event.currentTarget.checked
        });
      });
      dialog.querySelectorAll("[data-rsl-friends-filter-status]").forEach((input) => {
        input.addEventListener("change", () => {
          friendsAdvancedDraftState = normalizeFriendsAdvancedFilterState({
            ...friendsAdvancedDraftState,
            statuses: Array.from(
              dialog.querySelectorAll("[data-rsl-friends-filter-status]:checked"),
              (checkedInput) => checkedInput.value
            )
          });
        });
      });
      dialog.querySelector("[data-rsl-friends-filter-best-friends]")?.addEventListener("change", (event) => {
        friendsAdvancedDraftState = normalizeFriendsAdvancedFilterState({
          ...friendsAdvancedDraftState,
          bestFriends: event.currentTarget.value
        });
      });
      dialog.querySelector("[data-rsl-friends-filter-sort]")?.addEventListener("change", (event) => {
        friendsAdvancedDraftState = normalizeFriendsAdvancedFilterState({
          ...friendsAdvancedDraftState,
          sortBy: event.currentTarget.value
        });
      });
      dialog.querySelector("[data-rsl-friends-filters-reset]")?.addEventListener("click", () => {
        friendsAdvancedResolveRequestId += 1;
        friendsAdvancedDraftState = normalizeFriendsAdvancedFilterState(null);
        friendsAdvancedDraftTargets = { game: null };
        friendsAdvancedDraftInputs = { game: "" };
        friendsAdvancedResolveStatus = "";
        friendsAdvancedResolveStatusIsError = false;
        renderFriendsAdvancedFiltersMenu();
      });
      dialog.querySelector("[data-rsl-friends-filters-apply]")?.addEventListener("click", async () => {
        if (friendsAdvancedResolvingField) return;
        if (!(await resolveAllFriendsAdvancedFilterTargets(dialog))) return;
        friendsAdvancedDraftState = getFriendsAdvancedDraftFromMenu(dialog);
        friendsAdvancedAppliedState = friendsAdvancedDraftState;
        friendsAdvancedAppliedTargets = Object.freeze({ ...friendsAdvancedDraftTargets });
        const generation = ++friendsAdvancedRequestGeneration;
        const context = findFriendsContext();
        if (context && activeFriendsPresenceFilter !== ALL_FRIENDS_FILTER_VALUE) {
          activateFriendsPresenceFilter(context, ALL_FRIENDS_FILTER_VALUE);
        }
        closeFriendsAdvancedFiltersMenu(true);
        friendsAdvancedMetadataRevision += 1;
        reconcileOnlineFriendCards(context?.mount || null);
        void loadAllOnlineFriends(false).finally(() => {
          if (generation === friendsAdvancedRequestGeneration) {
            void loadFriendsAdvancedFilterMetadata(friendsAdvancedAppliedState, generation);
          }
        });
      });
      const resetButton = dialog.querySelector("[data-rsl-friends-filters-reset]");
      const applyButton = dialog.querySelector("[data-rsl-friends-filters-apply]");
      if (resetButton) resetButton.textContent = "Reset";
      if (applyButton) applyButton.textContent = "Apply";
      const outsidePointerHandler = (event) => {
        const currentTrigger = document.querySelector(`[${FRIENDS_ADVANCED_FILTER_BUTTON_ATTRIBUTE}]`);
        if (
          dialog.open &&
          !dialog.contains(event.target) &&
          !currentTrigger?.contains(event.target)
        ) {
          closeFriendsAdvancedFiltersMenu(false);
        }
      };
      const repositionHandler = () => positionFriendsAdvancedFiltersMenu(dialog);
      dialog._rslOutsidePointerHandler = outsidePointerHandler;
      dialog._rslRepositionHandler = repositionHandler;
      document.addEventListener("pointerdown", outsidePointerHandler, true);
      document.addEventListener("scroll", repositionHandler, true);
      window.addEventListener("resize", repositionHandler);
      document.body.append(dialog);
    }

    trigger?.setAttribute("aria-expanded", String(dialog.open));
    const verified = dialog.querySelector("[data-rsl-friends-filter-verified]");
    if (verified && document.activeElement !== verified) verified.checked = friendsAdvancedDraftState.verifiedOnly;
    const robloxPlus = dialog.querySelector("[data-rsl-friends-filter-roblox-plus]");
    if (robloxPlus && document.activeElement !== robloxPlus) {
      robloxPlus.checked = friendsAdvancedDraftState.robloxPlusOnly;
    }
    dialog.querySelectorAll("[data-rsl-friends-filter-status]").forEach((input) => {
      if (document.activeElement !== input) {
        input.checked = friendsAdvancedDraftState.statuses.includes(input.value);
      }
    });
    const bestFriendsFilter = dialog.querySelector("[data-rsl-friends-filter-best-friends]");
    if (bestFriendsFilter && document.activeElement !== bestFriendsFilter) {
      bestFriendsFilter.value = friendsAdvancedDraftState.bestFriends;
    }
    const sort = dialog.querySelector("[data-rsl-friends-filter-sort]");
    if (sort && document.activeElement !== sort) sort.value = friendsAdvancedDraftState.sortBy;
    const inputs = [
      ["game", "[data-rsl-friends-filter-game-input]"]
    ];
    for (const [kind, selector] of inputs) {
      const input = dialog.querySelector(selector);
      if (input && document.activeElement !== input && input.value !== friendsAdvancedDraftInputs[kind]) {
        input.value = friendsAdvancedDraftInputs[kind];
      }
      setCompactFriendsAdvancedTargetPresentation(dialog, kind, friendsAdvancedDraftTargets[kind]);
    }
    const status = dialog.querySelector("[data-rsl-friends-filters-status]");
    if (status) {
      status.textContent = friendsAdvancedResolveStatus;
      status.toggleAttribute("data-rsl-error", friendsAdvancedResolveStatusIsError);
    }
    const apply = dialog.querySelector("[data-rsl-friends-filters-apply]");
    if (apply) {
      apply.disabled = Boolean(friendsAdvancedResolvingField);
      apply.textContent = friendsAdvancedResolvingField ? "Checking..." : "Apply";
    }
    if (dialog.open) {
      window.requestAnimationFrame(() => positionFriendsAdvancedFiltersMenu(dialog));
    }
    return dialog;
  }

  function openFriendsAdvancedFiltersMenu(opener) {
    const existingDialog = document.querySelector(
      `[${FRIENDS_ADVANCED_FILTER_MENU_ATTRIBUTE}]`
    );
    if (existingDialog?.open) {
      closeFriendsAdvancedFiltersMenu(false);
      return;
    }
    friendsAdvancedDialogOpener = opener || document.activeElement;
    friendsAdvancedDraftState = { ...friendsAdvancedAppliedState };
    friendsAdvancedDraftTargets = { ...friendsAdvancedAppliedTargets };
    friendsAdvancedDraftInputs = {
      game: getFriendsAdvancedTargetInputValue(friendsAdvancedAppliedTargets.game)
    };
    friendsAdvancedResolveRequestId += 1;
    friendsAdvancedResolvingField = "";
    friendsAdvancedResolveStatus = "";
    friendsAdvancedResolveStatusIsError = false;
    const dialog = renderFriendsAdvancedFiltersMenu();
    resetFriendsAdvancedFiltersHelp(dialog);
    if (!dialog.open) {
      dialog.show();
    }
    const currentTrigger = document.querySelector(`[${FRIENDS_ADVANCED_FILTER_BUTTON_ATTRIBUTE}]`);
    currentTrigger?.setAttribute("aria-expanded", "true");
    positionFriendsAdvancedFiltersMenu(dialog);
    window.requestAnimationFrame(() => {
      positionFriendsAdvancedFiltersMenu(dialog);
      dialog.querySelector("[data-rsl-friends-filter-verified]")?.focus();
    });
  }

  function renderFriendsAdvancedFilterSummary(context) {
    const unknownHelpAttribute = FRIENDS_ADVANCED_FILTER_HELP_ATTRIBUTE;
    let summary = context.mount.querySelector(`[${FRIENDS_ADVANCED_FILTER_SUMMARY_ATTRIBUTE}]`);
    const shouldShow = Boolean(
      activeFriendsPresenceFilter && hasActiveFriendsAdvancedFilters()
    );
    if (!shouldShow) {
      summary?.remove();
      return;
    }
    getActivePresenceFriends();
    if (!summary) {
      summary = document.createElement("div");
      summary.className = "rsl-friends-filters__summary";
      summary.setAttribute(FRIENDS_ADVANCED_FILTER_SUMMARY_ATTRIBUTE, "");
    }
    if (summary.previousElementSibling !== context.group) {
      context.group.insertAdjacentElement("afterend", summary);
    }
    const progress = friendsAdvancedLoadState === "loading" && friendsAdvancedStatus
      ? friendsAdvancedStatus
      : `${friendsAdvancedMatchCount} matches`;
    const signature = `${progress}:${friendsAdvancedUnknownCount}:${friendsAdvancedStatus}`;
    if (summary.dataset.rslSummarySignature !== signature) {
      summary.dataset.rslSummarySignature = signature;
      summary.replaceChildren();
      const text = document.createElement("span");
      text.setAttribute("role", "status");
      text.setAttribute("aria-live", "polite");
      text.textContent = progress;
      summary.append(text);
      if (friendsAdvancedUnknownCount > 0) {
        const separator = document.createTextNode(" \u2022 ");
        const help = document.createElement("button");
        help.type = "button";
        help.className = "rsl-friends-filters__summary-help";
        help.setAttribute(unknownHelpAttribute, "");
        help.setAttribute("aria-expanded", "false");
        help.setAttribute("aria-controls", "rsl-friends-filters-unknown-note");
        help.textContent = `${friendsAdvancedUnknownCount} unchecked (?)`;
        const note = document.createElement("span");
        note.id = "rsl-friends-filters-unknown-note";
        note.className = "rsl-friends-filters__summary-note";
        note.hidden = true;
        note.textContent = friendsAdvancedStatus && friendsAdvancedLoadState === "partial"
          ? friendsAdvancedStatus
          : "Roblox did not provide enough information to confirm these results. Privacy, safety, account, or region rules can affect availability.";
        help.addEventListener("click", () => {
          const show = note.hidden;
          note.hidden = !show;
          help.setAttribute("aria-expanded", String(show));
        });
        summary.append(separator, help, note);
      }
    }
    summary.toggleAttribute("data-rsl-error", friendsAdvancedStatusIsError);
  }

  function cleanupFriendsAdvancedFilters(resetState = false) {
    friendsAdvancedResolveRequestId += 1;
    friendsAdvancedResolvingField = "";
    document.querySelectorAll(`[${FRIENDS_ADVANCED_FILTER_BUTTON_ATTRIBUTE}]`).forEach(
      (button) => button.remove()
    );
    document.querySelectorAll(`[${FRIENDS_ADVANCED_FILTER_SUMMARY_ATTRIBUTE}]`).forEach(
      (summary) => summary.remove()
    );
    const dialog = document.querySelector(`[${FRIENDS_ADVANCED_FILTER_MENU_ATTRIBUTE}]`);
    if (dialog?.open) {
      dialog.close();
    }
    if (dialog?._rslOutsidePointerHandler) {
      document.removeEventListener(
        "pointerdown",
        dialog._rslOutsidePointerHandler,
        true
      );
    }
    if (dialog?._rslRepositionHandler) {
      document.removeEventListener("scroll", dialog._rslRepositionHandler, true);
      window.removeEventListener("resize", dialog._rslRepositionHandler);
    }
    dialog?.remove();
    if (resetState) {
      friendsAdvancedRequestGeneration += 1;
      friendsAdvancedAppliedState = normalizeFriendsAdvancedFilterState(null);
      friendsAdvancedDraftState = normalizeFriendsAdvancedFilterState(null);
      friendsAdvancedAppliedTargets = Object.freeze({ game: null });
      friendsAdvancedDraftTargets = { game: null };
      friendsAdvancedDraftInputs = { game: "" };
      friendsAdvancedResolveStatus = "";
      friendsAdvancedResolveStatusIsError = false;
      friendsAdvancedBestFriendsReady = true;
      friendsAdvancedLoadState = "idle";
      friendsAdvancedStatus = "";
      friendsAdvancedMetadataRevision += 1;
    }
  }

  function mountFriendsAdvancedFilters(context, insertionAnchor = null) {
    if (!isFriendsListSubview() || !isFeatureEnabled("friendFilters")) {
      cleanupFriendsAdvancedFilters(true);
      return null;
    }
    const activeBaseFilter = activeFriendsPresenceFilter;
    void activeBaseFilter;
    if (!context?.group || !context.trustedButton) {
      return null;
    }

    let button = context.group.querySelector(`[${FRIENDS_ADVANCED_FILTER_BUTTON_ATTRIBUTE}]`);
    if (!button) {
      button = context.trustedButton.cloneNode(true);
      for (const element of [button, ...button.querySelectorAll("*")]) {
        element.removeAttribute("id");
        element.removeAttribute("aria-current");
        element.removeAttribute("aria-selected");
      }
      button.type = "button";
      button.removeAttribute("aria-pressed");
      button.setAttribute(FRIENDS_ADVANCED_FILTER_BUTTON_ATTRIBUTE, "");
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-controls", "rsl-friends-filters-dialog");
      button.setAttribute("aria-label", "Filters");
    }
    // A Roblox remount or extension reload can leave the owned chip in the DOM
    // after the execution context that installed its listener is gone. An
    // expando is realm-local and is not copied by cloneNode, so it prevents
    // duplicate handlers during normal remounts while allowing a fresh content
    // script to rebind a listenerless retained chip.
    button.type = "button";
    button.disabled = false;
    button.removeAttribute?.("disabled");
    button.removeAttribute?.("aria-disabled");
    if (button._rslFriendsFiltersClickBound !== true) {
      button._rslFriendsFiltersClickBound = true;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation?.();
        openFriendsAdvancedFiltersMenu(button);
      }, true);
    }
    const anchor = insertionAnchor || context.trustedButton;
    if (button.previousElementSibling !== anchor) {
      anchor.insertAdjacentElement("afterend", button);
    }
    setClassName(button, inactiveFriendsChipClass || context.trustedButton.className);
    const count = getFriendsAdvancedActiveCount();
    const label = button.querySelector("span.text-no-wrap") || button.querySelector("span:last-child");
    const text = count ? `Filters (${count})` : "Filters";
    if (label && label.textContent !== text) {
      label.textContent = text;
    }
    const currentDialog = document.querySelector(
      `[${FRIENDS_ADVANCED_FILTER_MENU_ATTRIBUTE}]`
    );
    button.setAttribute("aria-expanded", String(Boolean(currentDialog?.open)));
    button.setAttribute(
      "aria-label",
      count > 0 ? `Filters, ${count} active` : "Filters"
    );
    button.toggleAttribute("data-rsl-friends-filters-active", count > 0);
    renderFriendsAdvancedFilterSummary(context);
    return button;
  }

  function bindNativeFriendsFilters(group, initialContext = null) {
    if (boundFriendsFilterGroups.has(group)) {
      return;
    }

    boundFriendsFilterGroups.add(group);
    group.addEventListener("click", (event) => {
      const button = event.target.closest?.("button");
      if (
        !button ||
        !group.contains(button) ||
        button.hasAttribute(ONLINE_FILTER_CONTROL_ATTRIBUTE) ||
        suppressNativeFriendsFilterClick
      ) {
        return;
      }

      const nativeButtons = Array.from(
        group.querySelectorAll(`:scope > button[aria-pressed]:not([${ONLINE_FILTER_CONTROL_ATTRIBUTE}])`)
      );
      if (!nativeButtons.includes(button)) {
        return;
      }

      const context = findFriendsContext() || initialContext;
      const clickedAll = Boolean(
        isFeatureEnabled("friendFilters") &&
        context?.allButton &&
        (button === context.allButton || normalizeVisibleText(button) === "All")
      );
      if (clickedAll) {
        activateFriendsPresenceFilter(context, ALL_FRIENDS_FILTER_VALUE);
      } else {
        disableOnlineFriendsFilter(button);
      }
      queueMount();
    });
  }

  function ensureFriendsObserver(mount) {
    if (observedFriendsMount === mount) {
      return;
    }

    friendsMutationObserver?.disconnect();
    observedFriendsMount = mount;
    friendsMutationObserver = new MutationObserver(queueMount);
    friendsMutationObserver.observe(mount, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "aria-pressed"]
    });
  }

  function cleanupFriendsFiltersFeature() {
    cleanupFriendsAdvancedFilters(true);
    if (activeFriendsPresenceFilter) {
      disableOnlineFriendsFilter();
    } else {
      reconcileOnlineFriendCards(null);
      restoreNativeFriendsChip();
    }
    document
      .querySelectorAll(`[${ONLINE_FILTER_CONTROL_ATTRIBUTE}]`)
      .forEach((button) => button.remove());
    friendsMutationObserver?.disconnect();
    friendsMutationObserver = null;
    observedFriendsMount = null;
    window.clearTimeout(onlineFriendsRefreshTimer);
    onlineFriendsRefreshTimer = null;
  }

  function mountOnlineFriendsFilter() {
    const presenceFiltersEnabled = isFeatureEnabled("friendFilters");
    const bestFriendsFilterEnabled = isFeatureEnabled("bestFriends");
    if (
      !isFriendsListSubview() ||
      (!presenceFiltersEnabled && !bestFriendsFilterEnabled)
    ) {
      cleanupFriendsAdvancedFilters(isFriendsListSubview());
      if (activeFriendsPresenceFilter) {
        disableOnlineFriendsFilter();
      }
      friendsMutationObserver?.disconnect();
      friendsMutationObserver = null;
      observedFriendsMount = null;
      return;
    }

    const context = findFriendsContext();
    if (!context) {
      return;
    }

    ensureFriendsObserver(context.mount);
    const nativeList = getNativeFriendsLists(context.mount)[0] || null;
    captureNativeFriendCardTemplate(nativeList);

    if (presenceFiltersEnabled && onlineFriendsLoadState === "idle") {
      void loadAllOnlineFriends(false);
    }
    if (bestFriendsFilterEnabled && bestFriendsLoadState === "idle") {
      void loadBestFriendsContext(false);
    }

    if (!context.group || !context.allButton || !context.trustedButton) {
      return;
    }

    bindNativeFriendsFilters(context.group, context);
    const wantedFilters = [
      ...(presenceFiltersEnabled ? ["online", "offline"] : []),
      ...(bestFriendsFilterEnabled ? [BEST_FRIENDS_FILTER_VALUE] : [])
    ];
    const wantedSet = new Set(wantedFilters);
    const availableFilterSet = new Set(wantedFilters);
    if (presenceFiltersEnabled) {
      availableFilterSet.add(ALL_FRIENDS_FILTER_VALUE);
    }
    context.group
      .querySelectorAll(`[${ONLINE_FILTER_CONTROL_ATTRIBUTE}]`)
      .forEach((button) => {
        if (!wantedSet.has(button.getAttribute(ONLINE_FILTER_CONTROL_ATTRIBUTE))) {
          button.remove();
        }
      });

    const customButtons = [];
    let insertionAnchor = context.trustedButton;
    for (const presenceFilter of wantedFilters) {
      let button = context.group.querySelector(
        `[${ONLINE_FILTER_CONTROL_ATTRIBUTE}="${presenceFilter}"]`
      );
      if (!button) {
        button = makeFriendsPresenceButton(context, presenceFilter);
      }
      if (button.previousElementSibling !== insertionAnchor) {
        insertionAnchor.insertAdjacentElement("afterend", button);
      }
      updateFriendsPresenceButtonLabel(button, presenceFilter);
      customButtons.push(button);
      insertionAnchor = button;
    }
    if (presenceFiltersEnabled) {
      const filtersButton = mountFriendsAdvancedFilters(context, insertionAnchor);
      if (filtersButton) {
        insertionAnchor = filtersButton;
      }
    } else {
      cleanupFriendsAdvancedFilters(true);
    }

    if (
      activeFriendsPresenceFilter &&
      !availableFilterSet.has(activeFriendsPresenceFilter)
    ) {
      disableOnlineFriendsFilter(context.allButton);
    }

    captureFriendsChipClasses(context.allButton, context.trustedButton);

    if (
      !activeFriendsPresenceFilter &&
      bestFriendsFilterEnabled &&
      isBestFriendsDeepLink()
    ) {
      consumeBestFriendsDeepLink();
      activateFriendsPresenceFilter(context, BEST_FRIENDS_FILTER_VALUE);
    }

    if (
      !activeFriendsPresenceFilter &&
      presenceFiltersEnabled &&
      context.allButton.getAttribute("aria-pressed") === "true"
    ) {
      activateFriendsPresenceFilter(context, ALL_FRIENDS_FILTER_VALUE);
    }

    if (activeFriendsPresenceFilter) {
      if (!context.allButton.hasAttribute(ONLINE_FILTER_DEMOTED_ATTRIBUTE)) {
        captureFriendsChipClasses(context.allButton, context.trustedButton);
      }

      const selectedButton = customButtons.find(
        (button) =>
          button.getAttribute(ONLINE_FILTER_CONTROL_ATTRIBUTE) ===
          activeFriendsPresenceFilter
      );
      for (const button of customButtons) {
        setClassName(
          button,
          button === selectedButton ? activeFriendsChipClass : inactiveFriendsChipClass
        );
        setAriaPressed(button, button === selectedButton);
      }
      const showingAllFriends =
        activeFriendsPresenceFilter === ALL_FRIENDS_FILTER_VALUE;
      setClassName(
        context.allButton,
        showingAllFriends ? activeFriendsChipClass : inactiveFriendsChipClass
      );
      setAriaPressed(context.allButton, showingAllFriends);
      setClassName(context.trustedButton, inactiveFriendsChipClass);
      setAriaPressed(context.trustedButton, false);
      if (!context.allButton.hasAttribute(ONLINE_FILTER_DEMOTED_ATTRIBUTE)) {
        context.allButton.setAttribute(ONLINE_FILTER_DEMOTED_ATTRIBUTE, "");
      }
    } else {
      restoreNativeFriendsChip();
      for (const button of customButtons) {
        setClassName(button, inactiveFriendsChipClass || context.trustedButton.className);
        setAriaPressed(button, false);
      }
    }

    reconcileOnlineFriendCards(context.mount);
    renderFriendsAdvancedFilterSummary(context);
  }

  function bestFriendListsEqual(left, right) {
    return (
      left.length === right.length &&
      left.every((userId, index) => userId === right[index])
    );
  }

  function scheduleBestFriendsHomeRefresh(
    delay = BEST_FRIENDS_REFRESH_INTERVAL_MS
  ) {
    if (!isFeatureEnabled("bestFriends")) {
      return;
    }
    if (!bestFriendsHomeActive || !isHomePage()) {
      window.clearTimeout(bestFriendsHomeRefreshTimer);
      bestFriendsHomeRefreshTimer = null;
      return;
    }
    if (bestFriendsHomeRefreshTimer) {
      return;
    }

    bestFriendsHomeRefreshTimer = window.setTimeout(() => {
      bestFriendsHomeRefreshTimer = null;
      if (!bestFriendsHomeActive || !isHomePage()) {
        return;
      }
      if (document.visibilityState === "hidden") {
        scheduleBestFriendsHomeRefresh();
        return;
      }
      if (bestFriendHoverCard || bestFriendsRequestPromise) {
        scheduleBestFriendsHomeRefresh(BEST_FRIENDS_HOVER_REFRESH_RETRY_MS);
        return;
      }
      void loadBestFriendsContext(true);
    }, Math.max(1_000, Number(delay) || BEST_FRIENDS_REFRESH_INTERVAL_MS));
  }

  function refreshBestFriendsHomeIfStale() {
    if (!isFeatureEnabled("bestFriends")) {
      return;
    }
    if (!bestFriendsHomeActive || !isHomePage() || document.visibilityState === "hidden") {
      return;
    }
    const lastRefreshReference = Math.max(
      bestFriendsFetchedAt,
      bestFriendsLastRequestStartedAt
    );
    if (
      !bestFriendsRequestPromise &&
      (!lastRefreshReference ||
        Date.now() - lastRefreshReference >= BEST_FRIENDS_REFRESH_INTERVAL_MS)
    ) {
      window.clearTimeout(bestFriendsHomeRefreshTimer);
      bestFriendsHomeRefreshTimer = null;
      void loadBestFriendsContext(true);
      return;
    }
    if (!bestFriendsRequestPromise) {
      scheduleBestFriendsHomeRefresh();
    }
  }

  function loadBestFriendsContext(
    forceRefresh = false,
    allowFriendsFilterLookup = false
  ) {
    if (!isFeatureEnabled("bestFriends") && !allowFriendsFilterLookup) {
      return Promise.resolve();
    }
    if (bestFriendsRequestPromise) {
      return bestFriendsRequestPromise;
    }

    const requestId = ++bestFriendsRequestId;
    bestFriendsLastRequestStartedAt = Date.now();
    bestFriendsLoadState = bestFriendDetails.length > 0 ? "refreshing" : "loading";
    bestFriendsErrorCode = "";
    queueMount();

    const request = requestBestFriendsContext(requestId)
      .then((response) => {
        if (requestId !== bestFriendsRequestId) {
          return;
        }
        if (!response?.ok || !Array.isArray(response.selectedUserIds)) {
          const error = new Error("Could not load Best Friends");
          error.code = response?.code || "NETWORK";
          throw error;
        }

        bestFriendsViewerUserId = String(response.viewerUserId || "") || null;
        bestFriendsCanChat = response.canChat === true;
        bestFriendUserIds = normalizeBestFriendIds(response.selectedUserIds);
        const detailsById = new Map();
        for (const entry of Array.isArray(response.friends) ? response.friends : []) {
          const friend = normalizeOnlineFriend(entry);
          if (friend) {
            detailsById.set(friend.userId, friend);
          }
        }
        bestFriendDetails = bestFriendUserIds
          .map((userId) => detailsById.get(userId))
          .filter(Boolean);
        bestFriendsFetchedAt = Date.now();
        bestFriendsLoadState = "ready";
        bestFriendsErrorCode = "";

        if (
          bestFriendsViewerUserId &&
          Array.isArray(response.staleUserIds) &&
          response.staleUserIds.length > 0
        ) {
          void persistBestFriendIds(bestFriendsViewerUserId, bestFriendUserIds);
        }
      })
      .catch((error) => {
        if (requestId !== bestFriendsRequestId) {
          return;
        }
        bestFriendsCanChat = false;
        bestFriendsLoadState = bestFriendDetails.length > 0 ? "ready" : "error";
        bestFriendsErrorCode = error?.code || "NETWORK";
      })
      .finally(() => {
        if (requestId === bestFriendsRequestId) {
          bestFriendsRequestPromise = null;
          scheduleBestFriendsHomeRefresh();
          queueMount();
        }
      });

    bestFriendsRequestPromise = request;
    return request;
  }

  function sanitizeBestFriendsClone(root) {
    root.removeAttribute(HOME_FRIENDS_COLLAPSED_ATTRIBUTE);
    root
      .querySelectorAll(`[${HOME_FRIENDS_TOGGLE_ATTRIBUTE}]`)
      .forEach((toggle) => toggle.remove());
    root
      .querySelectorAll(`[${HOME_FRIENDS_HEADER_ATTRIBUTE}]`)
      .forEach((header) =>
        header.removeAttribute(HOME_FRIENDS_HEADER_ATTRIBUTE)
      );
    root
      .querySelectorAll(`[${HOME_FRIENDS_BODY_ATTRIBUTE}]`)
      .forEach((element) => {
        element.hidden = false;
        element.removeAttribute("aria-hidden");
        element.removeAttribute(HOME_FRIENDS_BODY_ATTRIBUTE);
        element.removeAttribute(HOME_FRIENDS_OWNED_ID_ATTRIBUTE);
      });
    for (const element of [root, ...root.querySelectorAll("*")]) {
      for (const attribute of element.getAttributeNames()) {
        if (/^on/i.test(attribute)) {
          element.removeAttribute(attribute);
        }
      }
      for (const attribute of [
        "id",
        "aria-activedescendant",
        "aria-controls",
        "aria-expanded",
        "aria-haspopup",
        "aria-owns",
        "data-state"
      ]) {
        element.removeAttribute(attribute);
      }
      element.classList?.remove("active", "open", "selected");
    }
    root
      .querySelectorAll(".avatar-card-menu, .avatar-card-btns, [role='menu']")
      .forEach((node) => node.remove());
  }

  function getNativeHomeFriendList(nativeCarousel) {
    return nativeCarousel.querySelector(".friends-carousel-list-container");
  }

  function makeBestFriendsAddTile(nativeCarousel) {
    const nativeList = getNativeHomeFriendList(nativeCarousel);
    const template = Array.from(nativeList?.children || []).find((child) =>
      child.querySelector?.(".add-friends-icon-container")
    );
    const tile = template?.cloneNode(true) || document.createElement("div");
    if (!template) {
      tile.className = "friends-carousel-tile";
      tile.innerHTML =
        '<button type="button"><div class="add-friends-icon-container">' +
        '<span aria-hidden="true" class="rsl-best-friends-plus content-secondary"></span></div>' +
        '<div class="friends-carousel-tile-labels"><div class="friends-carousel-tile-label">' +
        '<div class="friends-carousel-tile-name"><span class="friends-carousel-display-name">' +
        "Add Best Friend</span></div></div></div></button>";
    }
    sanitizeBestFriendsClone(tile);

    let button = tile.querySelector("button");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.append(...Array.from(tile.childNodes));
      tile.append(button);
    }
    const nestedLink = button.querySelector("a");
    if (nestedLink) {
      nestedLink.replaceWith(...Array.from(nestedLink.childNodes));
    }
    button.type = "button";
    button.classList.add("rsl-best-friends-add");
    button.setAttribute("aria-label", "Add Best Friend");
    const label = tile.querySelector(".friends-carousel-display-name");
    if (label) {
      label.textContent = "Add Best Friend";
    }
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openBestFriendsDialog(button);
    });
    return tile;
  }

  function makeFallbackBestFriendTile() {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-rsl-best-friend-fallback", "");
    wrapper.innerHTML =
      '<div class="friends-carousel-tile"><div class="friend-tile-content">' +
      '<div class="avatar avatar-card-fullbody" data-testid="avatar-card-container">' +
      '<a class="avatar-card-link"><span class="thumbnail-2d-container avatar-card-image">' +
      '<img alt=""></span></a><div class="avatar-status"></div></div>' +
      '<a class="friends-carousel-tile-labels"><div class="friends-carousel-tile-label">' +
      '<div class="friends-carousel-tile-name"><span class="friends-carousel-display-name">' +
      '</span></div></div><div class="friends-carousel-tile-sublabel"></div></a></div></div>';
    return wrapper;
  }

  function containsNode(container, target) {
    try {
      return Boolean(container && target && container.contains(target));
    } catch {
      return false;
    }
  }

  function clearBestFriendActionTimer(button) {
    const timer = bestFriendActionTimers.get(button);
    if (timer) {
      window.clearTimeout(timer);
      bestFriendActionTimers.delete(button);
    }
  }

  function closeBestFriendHoverCard(restoreFocus = false) {
    const card = bestFriendHoverCard;
    const anchor = bestFriendHoverAnchor;
    bestFriendHoverThumbnailToken += 1;
    bestFriendHoverCard = null;
    bestFriendHoverAnchor = null;

    card?.querySelectorAll(`[${BEST_FRIEND_ACTION_ATTRIBUTE}]`).forEach((button) => {
      clearBestFriendActionTimer(button);
    });
    card?.remove();
    if (anchor) {
      anchor.setAttribute("aria-expanded", "false");
    }
    if (restoreFocus && anchor?.isConnected) {
      const focusTarget = anchor.querySelector("a[href], button, [tabindex]:not([tabindex='-1'])");
      focusTarget?.focus({ preventScroll: true });
    }
  }

  function scheduleBestFriendHoverClose() {
    closeBestFriendHoverCard();
  }

  function getBestFriendHoverVisualBox(anchor) {
    const fallback = anchor.getBoundingClientRect();
    const avatarElement = anchor.querySelector(".avatar-card-image") ||
      anchor.querySelector(".avatar-card-fullbody, [data-testid='avatar-card-container']");
    const collectVisibleRects = (element) => {
      if (!element) {
        return [];
      }
      let rects = [];
      try {
        rects = Array.from(element.getClientRects?.() || []);
      } catch {
        rects = [];
      }
      if (!rects.length) {
        try {
          rects = [element.getBoundingClientRect()];
        } catch {
          rects = [];
        }
      }
      return rects.filter((rect) =>
        Number.isFinite(rect?.top) &&
        Number.isFinite(rect?.bottom) &&
        Number.isFinite(rect?.left) &&
        Number.isFinite(rect?.width) &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const avatarRects = collectVisibleRects(avatarElement);
    const labelRects = Array.from(
      anchor.querySelectorAll(
        ".friends-carousel-display-name, .friends-carousel-tile-label, " +
        ".friends-carousel-tile-sublabel, .friends-carousel-tile-experience"
      )
    ).flatMap(collectVisibleRects);
    let visibleRects = [...avatarRects, ...labelRects];
    if (!labelRects.length) {
      const tileContent = anchor.querySelector(".friend-tile-content, .friends-carousel-tile");
      visibleRects.push(...collectVisibleRects(tileContent));
    }
    if (!visibleRects.length) {
      visibleRects = collectVisibleRects(anchor);
    }
    const centerRect = avatarRects[0] || labelRects[0] || visibleRects[0] || fallback;

    return {
      centerX: centerRect.left + centerRect.width / 2,
      top: visibleRects.length
        ? Math.min(...visibleRects.map((rect) => rect.top))
        : fallback.top,
      bottom: visibleRects.length
        ? Math.max(...visibleRects.map((rect) => rect.bottom))
        : fallback.bottom
    };
  }

  function positionBestFriendHoverCard(card, anchor) {
    if (!card?.isConnected || !anchor?.isConnected) {
      closeBestFriendHoverCard();
      return;
    }

    const visualBox = getBestFriendHoverVisualBox(anchor);
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
    const cardWidth = card.offsetWidth;
    const cardHeight = card.offsetHeight;
    const edge = 8;
    const gap = 0;
    const maximumLeft = Math.max(edge, viewportWidth - cardWidth - edge);
    const centeredLeft = visualBox.centerX - cardWidth / 2;
    const left = Math.min(maximumLeft, Math.max(edge, centeredLeft));
    const below = visualBox.bottom + gap;
    const above = visualBox.top - cardHeight - gap;
    const placedBelow = below + cardHeight <= viewportHeight - edge || above < edge;
    const preferredTop = placedBelow ? below : above;
    const maximumTop = Math.max(edge, viewportHeight - cardHeight - edge);
    const top = Math.min(maximumTop, Math.max(edge, preferredTop));

    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(top)}px`;
    card.dataset.rslBestFriendHoverPlacement = placedBelow ? "below" : "above";
    card.style.visibility = "visible";
  }

  function getBestFriendGameThumbnailTarget(friend) {
    if (/^[1-9]\d{0,19}$/.test(String(friend?.universeId ?? ""))) {
      return { kind: "gameUniverse", id: String(friend.universeId) };
    }
    const placeId = friend?.rootPlaceId || friend?.placeId;
    return /^[1-9]\d{0,19}$/.test(String(placeId ?? ""))
      ? { kind: "game", id: String(placeId) }
      : null;
  }

  function requestBestFriendGameThumbnailUrl(target, forceRefresh = false) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          {
            type: "rsl:get-thumbnail",
            kind: target.kind,
            id: target.id,
            forceRefresh
          },
          (response) => {
            const failed = chrome.runtime.lastError ||
              !isSafeThumbnailImageUrl(response?.url);
            resolve(failed ? null : response.url);
          }
        );
      } catch {
        resolve(null);
      }
    });
  }

  function preloadBestFriendGameThumbnail(url) {
    if (!isSafeThumbnailImageUrl(url)) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      const preloader = document.createElement("img");
      let settled = false;
      const timeout = window.setTimeout(
        () => finish(false),
        BEST_FRIEND_GAME_IMAGE_TIMEOUT_MS
      );
      const finish = (loaded) => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timeout);
        resolve(loaded ? url : null);
      };
      preloader.decoding = "async";
      preloader.referrerPolicy = "no-referrer";
      preloader.addEventListener("load", async () => {
        try {
          await preloader.decode?.();
        } catch {
          // A completed load is sufficient when decode() is unavailable or rejects.
        }
        finish(true);
      }, { once: true });
      preloader.addEventListener("error", () => finish(false), { once: true });
      preloader.src = url;
    });
  }

  function loadBestFriendGameThumbnail(friend, forceRefresh = false) {
    const target = getBestFriendGameThumbnailTarget(friend);
    if (!target) {
      return Promise.resolve(null);
    }
    const key = `${target.kind}:${target.id}`;
    if (!forceRefresh && bestFriendGameThumbnailUrls.has(key)) {
      return Promise.resolve(bestFriendGameThumbnailUrls.get(key));
    }
    if (bestFriendGameThumbnailRequests.has(key)) {
      return bestFriendGameThumbnailRequests.get(key);
    }
    if (forceRefresh) {
      bestFriendGameThumbnailUrls.delete(key);
    }

    const request = requestBestFriendGameThumbnailUrl(target, forceRefresh)
      .then((url) => preloadBestFriendGameThumbnail(url))
      .then(async (url) => {
        if (url) {
          return url;
        }
        await new Promise((resolve) => {
          window.setTimeout(resolve, BEST_FRIEND_GAME_THUMBNAIL_RETRY_MS);
        });
        const retryUrl = await requestBestFriendGameThumbnailUrl(target, true);
        return preloadBestFriendGameThumbnail(retryUrl);
      })
      .then((url) => {
        if (url) {
          bestFriendGameThumbnailUrls.set(key, url);
        }
        return url;
      })
      .finally(() => bestFriendGameThumbnailRequests.delete(key));
    bestFriendGameThumbnailRequests.set(key, request);
    return request;
  }

  function getCachedBestFriendGameThumbnail(friend) {
    const target = getBestFriendGameThumbnailTarget(friend);
    return target
      ? bestFriendGameThumbnailUrls.get(`${target.kind}:${target.id}`) || null
      : null;
  }

  function evictBestFriendGameThumbnail(friend) {
    const target = getBestFriendGameThumbnailTarget(friend);
    if (target) {
      bestFriendGameThumbnailUrls.delete(`${target.kind}:${target.id}`);
    }
  }

  function requestBestFriendGameThumbnail(card, frame, image, friend) {
    const hoverToken = ++bestFriendHoverThumbnailToken;
    image.src = DEFAULT_GAME_ICON_URL;
    const loadToken = beginOwnedThumbnailLoad(frame, image);
    void loadBestFriendGameThumbnail(friend).then((url) => {
      if (
        hoverToken !== bestFriendHoverThumbnailToken ||
        card !== bestFriendHoverCard ||
        !card.isConnected
      ) {
        return;
      }
      if (!isSafeThumbnailImageUrl(url)) {
        finishOwnedThumbnailLoad(frame, image, loadToken, "fallback");
        return;
      }
      loadOwnedThumbnailImage(
        frame,
        image,
        url,
        DEFAULT_GAME_ICON_URL,
        () => evictBestFriendGameThumbnail(friend)
      );
    });
  }

  function getBestFriendActionLabel(button) {
    return button.querySelector("[data-rsl-best-friend-action-label]") ||
      Array.from(button.childNodes).find(
        (node) => node.nodeType === 3 && Boolean(node.textContent?.trim())
      ) ||
      button;
  }

  function bindBestFriendActionFeedback(button, action) {
    const defaultLabel =
      getBestFriendActionLabel(button).textContent?.trim() ||
      (action === "join" ? "Join" : "Chat");
    button.dataset.rslBestFriendActionDefaultLabel = defaultLabel;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      if (button.disabled) {
        return;
      }

      clearBestFriendActionTimer(button);
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      getBestFriendActionLabel(button).textContent = action === "join" ? "Joining..." : "Opening...";
      const timer = window.setTimeout(() => {
        bestFriendActionTimers.delete(button);
        delete button.dataset.rslBestFriendActionPending;
        button.disabled = false;
        button.removeAttribute("aria-busy");
        getBestFriendActionLabel(button).textContent =
          action === "join" ? "Join unavailable" : "Chat unavailable";
        const restoreTimer = window.setTimeout(() => {
          bestFriendActionTimers.delete(button);
          if (button.isConnected) {
            getBestFriendActionLabel(button).textContent = defaultLabel;
          }
        }, 1_600);
        bestFriendActionTimers.set(button, restoreTimer);
      }, BEST_FRIEND_ACTION_TIMEOUT_MS);
      bestFriendActionTimers.set(button, timer);
    });
  }

  function makeBestFriendActionButton(friend, action, emphasized) {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "foundation-web-button relative clip group/interactable focus-visible:outline-focus " +
      "disabled:outline-none cursor-pointer relative flex items-center justify-center stroke-none " +
      "padding-y-none select-none radius-medium text-label-medium height-1000 padding-x-medium " +
      `${emphasized ? "bg-action-emphasis content-action-emphasis" : "bg-action-standard content-action-standard"} grow`;
    button.setAttribute(BEST_FRIEND_ACTION_ATTRIBUTE, action);
    button.setAttribute("data-rsl-best-friend-user-id", friend.userId);
    if (action === "join") {
      button.setAttribute(
        "data-rsl-best-friend-game-instance-id",
        friend.gameInstanceId || ""
      );
    }
    button.innerHTML =
      '<div role="presentation" class="absolute inset-[0] transition-colors ' +
      'group-hover/interactable:bg-[var(--color-state-hover)] ' +
      'group-active/interactable:bg-[var(--color-state-press)] ' +
      'group-disabled/interactable:bg-none"></div>' +
      '<span class="flex items-center min-width-0 gap-small"><span ' +
      'data-rsl-best-friend-action-label class="padding-y-xsmall text-truncate-end ' +
      `text-no-wrap">${action === "join" ? "Join" : "Chat"}</span></span>`;
    bindBestFriendActionFeedback(button, action);
    return button;
  }

  function makeInGameBestFriendHoverCard(friend) {
    const card = document.createElement("div");
    card.className =
      "rsl-best-friend-hover-card rsl-best-friend-hover-card--in-game " +
      "friend-tile-dropdown friend-tile-dropdown--iarc";
    card.setAttribute(BEST_FRIEND_HOVER_CARD_ATTRIBUTE, "");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", `Actions for ${friend.displayName}`);
    card.style.backgroundColor = "transparent";
    card.style.borderRadius = "0";

    const surface = document.createElement("div");
    surface.className =
      "in-game-friend-card--iarc flex flex-col items-start justify-center padding-y-large " +
      "padding-x-large gap-medium radius-medium stroke-standard stroke-default " +
      "bg-over-media-300 width-full";
    surface.style.boxSizing = "border-box";

    const experiencePlaceId = friend.rootPlaceId || friend.placeId;
    const gameLink = document.createElement("a");
    gameLink.className = "flex items-center gap-small width-full min-width-0";
    gameLink.href = `/games/${experiencePlaceId}`;
    gameLink.style.color = "inherit";
    gameLink.style.textDecoration = "none";

    const iconClip = document.createElement("span");
    iconClip.className = "shrink-0 radius-small clip";
    iconClip.style.display = "inline-block";
    iconClip.style.width = "40px";
    iconClip.style.height = "40px";
    const iconContainer = document.createElement("span");
    iconContainer.className =
      "thumbnail-2d-container width-full height-full rsl-owned-thumbnail-frame";
    const image = document.createElement("img");
    image.className = "width-full height-full";
    image.alt = "";
    image.decoding = "async";
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    iconContainer.append(image);
    iconClip.append(iconContainer);

    const information = document.createElement("span");
    information.className = "friend-presence-info flex flex-col justify-center min-width-0 fill";
    const playing = document.createElement("span");
    playing.className =
      "friend-tile-is-playing text-body-medium content-default text-truncate-end text-no-wrap";
    playing.textContent = `${friend.displayName} is playing`;
    const gameName = document.createElement("span");
    gameName.className =
      "friend-tile-game-name text-title-medium content-emphasis text-truncate-end text-no-wrap";
    gameName.textContent = friend.lastLocation || "In an experience";
    information.append(playing, gameName);
    gameLink.append(iconClip, information);

    const actions = document.createElement("div");
    actions.className = "in-game-friend-card-actions flex flex-col self-stretch gap-small";
    const join = makeBestFriendActionButton(friend, "join", true);
    const profile = document.createElement("a");
    profile.href = `/users/${friend.userId}/profile`;
    profile.className =
      "foundation-web-link content-default no-underline motion-safe:transition-opacity " +
      "hover:cursor-pointer hover:[opacity:0.8] radius-xsmall " +
      "focus-visible:[outline-style:solid] focus-visible:[outline-width:var(--stroke-standard)] " +
      "focus-visible:[outline-color:var(--color-system-emphasis)] flex items-center " +
      "justify-center self-stretch height-600 text-label-medium content-action-standard";
    profile.textContent = "View Profile";
    actions.append(join);
    if (bestFriendsCanChat) {
      actions.append(makeBestFriendActionButton(friend, "chat", false));
    }
    actions.append(profile);
    surface.append(gameLink, actions);
    card.append(surface);
    requestBestFriendGameThumbnail(card, iconContainer, image, friend);
    return card;
  }

  function makeCompactBestFriendAction(friend, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "friend-tile-dropdown-button";
    if (action === "chat") {
      button.setAttribute(BEST_FRIEND_ACTION_ATTRIBUTE, "chat");
      button.setAttribute("data-rsl-best-friend-user-id", friend.userId);
      const icon = document.createElement("span");
      icon.className = "icon-chat-gray";
      icon.setAttribute("aria-hidden", "true");
      button.append(icon, document.createTextNode(`Chat with ${friend.displayName}`));
      bindBestFriendActionFeedback(button, "chat");
      return button;
    }

    const icon = document.createElement("span");
    icon.className = "icon-viewdetails";
    icon.setAttribute("aria-hidden", "true");
    button.append(icon, document.createTextNode("View Profile"));
    button.addEventListener("click", () => {
      closeBestFriendHoverCard();
      window.location.assign(`/users/${friend.userId}/profile`);
    });
    return button;
  }

  function makeCompactBestFriendHoverCard(friend) {
    const card = document.createElement("div");
    card.className = "rsl-best-friend-hover-card rsl-best-friend-hover-card--compact";
    card.setAttribute(BEST_FRIEND_HOVER_CARD_ATTRIBUTE, "");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", `Actions for ${friend.displayName}`);
    const dropdown = document.createElement("div");
    dropdown.className = "friend-tile-dropdown";
    const list = document.createElement("ul");
    const actions = bestFriendsCanChat ? ["chat", "profile"] : ["profile"];
    for (const action of actions) {
      const item = document.createElement("li");
      item.append(makeCompactBestFriendAction(friend, action));
      list.append(item);
    }
    dropdown.append(list);
    card.append(dropdown);
    return card;
  }

  function focusFirstBestFriendHoverAction(card) {
    const focusTarget =
      card?.querySelector(`[${BEST_FRIEND_ACTION_ATTRIBUTE}]`) ||
      card?.querySelector("button, a[href]");
    focusTarget?.focus({ preventScroll: true });
  }

  function showBestFriendHoverCard(anchor, friend, focusFirstAction = false) {
    if (!anchor?.isConnected || !isHomePage()) {
      return;
    }
    if (bestFriendHoverCard && bestFriendHoverAnchor === anchor) {
      if (focusFirstAction) {
        focusFirstBestFriendHoverAction(bestFriendHoverCard);
      }
      return;
    }

    closeBestFriendHoverCard();
    const inGame = friend.presenceType === "InGame" && Boolean(friend.rootPlaceId || friend.placeId);
    const card = inGame
      ? makeInGameBestFriendHoverCard(friend)
      : makeCompactBestFriendHoverCard(friend);
    card.style.visibility = "hidden";
    bestFriendHoverCard = card;
    bestFriendHoverAnchor = anchor;
    anchor.setAttribute("aria-haspopup", "dialog");
    anchor.setAttribute("aria-expanded", "true");

    card.addEventListener("pointerleave", (event) => {
      if (!containsNode(anchor, event.relatedTarget)) {
        scheduleBestFriendHoverClose();
      }
    });
    card.addEventListener("focusout", (event) => {
      if (!containsNode(card, event.relatedTarget) && !containsNode(anchor, event.relatedTarget)) {
        scheduleBestFriendHoverClose();
      }
    });
    document.body.append(card);
    positionBestFriendHoverCard(card, anchor);
    if (focusFirstAction) {
      focusFirstBestFriendHoverAction(card);
    }
  }

  function scheduleBestFriendHoverOpen(anchor, friend, focusFirstAction = false) {
    showBestFriendHoverCard(anchor, friend, focusFirstAction);
  }

  function bindBestFriendHoverCard(anchor, friend) {
    anchor.addEventListener("pointerenter", () => {
      scheduleBestFriendHoverOpen(anchor, friend);
    });
    anchor.addEventListener("pointerleave", (event) => {
      if (!containsNode(bestFriendHoverCard, event.relatedTarget)) {
        scheduleBestFriendHoverClose();
      }
    });
    anchor.addEventListener("focusin", () => {
      scheduleBestFriendHoverOpen(anchor, friend);
    });
    anchor.addEventListener("focusout", (event) => {
      if (
        !containsNode(anchor, event.relatedTarget) &&
        !containsNode(bestFriendHoverCard, event.relatedTarget)
      ) {
        scheduleBestFriendHoverClose();
      }
    });
    anchor.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        scheduleBestFriendHoverOpen(anchor, friend, true);
      } else if (event.key === "Escape" && bestFriendHoverAnchor === anchor) {
        event.preventDefault();
        closeBestFriendHoverCard(true);
      }
    });
  }

  function handleBestFriendActionResult(event) {
    const button = event.target?.closest?.(`[${BEST_FRIEND_ACTION_ATTRIBUTE}]`);
    if (!button || !button.closest(`[${BEST_FRIEND_HOVER_CARD_ATTRIBUTE}]`)) {
      return;
    }

    let result;
    try {
      result = JSON.parse(typeof event.detail === "string" ? event.detail : "");
    } catch {
      return;
    }
    const action = button.getAttribute(BEST_FRIEND_ACTION_ATTRIBUTE);
    if (
      result?.v !== 1 ||
      result?.action !== action ||
      !["started", "unavailable", "invalid", "failed"].includes(result?.code)
    ) {
      return;
    }

    clearBestFriendActionTimer(button);
    delete button.dataset.rslBestFriendActionPending;
    button.disabled = false;
    button.removeAttribute("aria-busy");
    if (result.code === "started") {
      closeBestFriendHoverCard();
      return;
    }

    const defaultLabel = button.dataset.rslBestFriendActionDefaultLabel ||
      (action === "join" ? "Join" : "Chat");
    getBestFriendActionLabel(button).textContent =
      result.code === "unavailable"
        ? `${action === "join" ? "Join" : "Chat"} unavailable`
        : result.code === "invalid"
          ? "Action unavailable"
          : "Try again";
    const restoreTimer = window.setTimeout(() => {
      bestFriendActionTimers.delete(button);
      if (button.isConnected) {
        getBestFriendActionLabel(button).textContent = defaultLabel;
      }
    }, 1_600);
    bestFriendActionTimers.set(button, restoreTimer);
  }

  function handleBestFriendHoverOutsidePointerDown(event) {
    if (
      bestFriendHoverCard &&
      !containsNode(bestFriendHoverCard, event.target) &&
      !containsNode(bestFriendHoverAnchor, event.target)
    ) {
      closeBestFriendHoverCard();
    }
  }

  function handleBestFriendHoverEscape(event) {
    if (event.key === "Escape" && bestFriendHoverCard) {
      event.preventDefault();
      closeBestFriendHoverCard(true);
    }
  }

  function formatBestFriendExperienceLabel(label) {
    const text = typeof label === "string" ? label : "";
    return text.length > 18 ? `${text.slice(0, 15)}...` : text;
  }

  function setBestFriendSublabel(sublabel, label) {
    if (!sublabel) {
      return null;
    }
    const fullLabel = typeof label === "string" ? label : "";
    sublabel.classList.remove("friends-carousel-tile-experience");
    let experience = Array.from(sublabel.children || []).find((child) =>
      child.classList?.contains("friends-carousel-tile-experience")
    );
    if (!experience) {
      experience = document.createElement("div");
      experience.className = "friends-carousel-tile-experience";
    }
    sublabel.replaceChildren(experience);
    sublabel.title = fullLabel;
    experience.textContent = formatBestFriendExperienceLabel(fullLabel);
    return experience;
  }

  function makeBestFriendTile(nativeCarousel, friend) {
    const nativeList = getNativeHomeFriendList(nativeCarousel);
    const template = Array.from(nativeList?.children || []).find((child) =>
      child.querySelector?.('a[href*="/users/"][href*="/profile"]')
    );
    const wrapper = template?.cloneNode(true) || makeFallbackBestFriendTile();
    sanitizeBestFriendsClone(wrapper);
    wrapper.setAttribute(BEST_FRIEND_ID_ATTRIBUTE, friend.userId);

    const outerButton = wrapper.querySelector("button");
    if (outerButton) {
      const replacement = document.createElement("div");
      replacement.className = outerButton.className;
      replacement.append(...Array.from(outerButton.childNodes));
      outerButton.replaceWith(replacement);
    }
    wrapper.querySelectorAll("button").forEach((button) => button.remove());

    const profilePath = `/users/${friend.userId}/profile`;
    wrapper
      .querySelectorAll(
        'a[href*="/users/"], a.avatar-card-link, a.friends-carousel-tile-labels'
      )
      .forEach((link) => {
        link.href = profilePath;
        link.removeAttribute("target");
      });

    const imageContainer = wrapper.querySelector(".avatar-card-image");
    if (imageContainer) {
      imageContainer.classList.remove("loading", "shimmer");
      imageContainer.removeAttribute("aria-busy");
      imageContainer.classList.add("rsl-owned-thumbnail-frame");
      const image = document.createElement("img");
      image.alt = `${friend.displayName} avatar`;
      image.decoding = "async";
      image.loading = "lazy";
      image.referrerPolicy = "no-referrer";
      imageContainer.replaceChildren(image);
      loadOwnedThumbnailImage(
        imageContainer,
        image,
        friend.headshotUrl,
        DEFAULT_AVATAR_URL
      );
    }

    const name = wrapper.querySelector(".friends-carousel-display-name");
    if (name) {
      name.textContent = friend.displayName;
      name.title = friend.displayName;
      Array.from(name.parentElement?.children || [])
        .filter((child) => child !== name)
        .forEach((badge) => badge.remove());
      appendFriendNameBadges(name.parentElement, friend, true);
    }

    const presence = getPresencePresentation(friend);
    let sublabel = wrapper.querySelector(".friends-carousel-tile-sublabel");
    if (!sublabel) {
      sublabel = document.createElement("div");
      sublabel.className = "friends-carousel-tile-sublabel";
      wrapper.querySelector(".friends-carousel-tile-labels")?.append(sublabel);
    }
    // Preserve Roblox's live wrapper > experience structure and its compact
    // visible title. The complete title remains available through hover text.
    setBestFriendSublabel(sublabel, presence.label);

    let avatarStatus = wrapper.querySelector(".avatar-status");
    if (!avatarStatus) {
      avatarStatus = document.createElement("div");
      avatarStatus.className = "avatar-status";
      wrapper.querySelector('[data-testid="avatar-card-container"]')?.append(avatarStatus);
    }
    if (presence.iconClass) {
      const icon = document.createElement("span");
      icon.dataset.testid = "presence-icon";
      icon.className = presence.iconClass;
      icon.title = presence.label;
      avatarStatus.replaceChildren(icon);
    } else {
      avatarStatus.replaceChildren();
    }

    if (friend.presenceType === "InGame") {
      void loadBestFriendGameThumbnail(friend);
    }
    bindBestFriendHoverCard(wrapper, friend);
    return wrapper;
  }

  function sendQuickSettingsRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        const error = new Error("Roblox settings request timed out");
        error.code = "TIMEOUT";
        reject(error);
      }, QUICK_SETTINGS_RUNTIME_MESSAGE_TIMEOUT_MS);

      const settle = (callback, value) => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timeout);
        callback(value);
      };

      try {
        chrome.runtime.sendMessage(message, (response) => {
          const runtimeError = chrome.runtime.lastError;
          if (runtimeError) {
            settle(reject, new Error(runtimeError.message));
            return;
          }
          settle(resolve, response);
        });
      } catch (error) {
        settle(reject, error);
      }
    });
  }

  function normalizeQuickSettingsSnapshot(response) {
    const viewerUserId = String(response?.viewerUserId ?? "");
    if (!/^[1-9]\d{0,19}$/.test(viewerUserId)) {
      return null;
    }
    const source = response?.settings;
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      return null;
    }

    const settings = Object.create(null);
    for (const alias of QUICK_SETTING_SNAPSHOT_ALIASES) {
      const rawSetting = source[alias];
      const value = typeof rawSetting?.value === "string" ? rawSetting.value : "";
      if (!Object.hasOwn(QUICK_SETTING_VALUE_LABELS, value)) {
        continue;
      }
      const options = [];
      const seen = new Set();
      for (const rawOption of Array.isArray(rawSetting?.options) ? rawSetting.options : []) {
        if (
          typeof rawOption === "string" &&
          Object.hasOwn(QUICK_SETTING_VALUE_LABELS, rawOption) &&
          !seen.has(rawOption)
        ) {
          seen.add(rawOption);
          options.push(rawOption);
        }
      }
      settings[alias] = {
        value,
        options,
        editable:
          rawSetting.editable === true &&
          options.some((option) => option !== value)
      };
    }
    return { viewerUserId, settings };
  }

  function getQuickSettingsErrorMessage(code) {
    switch (code) {
      case "UNAUTHENTICATED":
        return "Sign in to Roblox to use Quick Settings.";
      case "FORBIDDEN":
        return "Roblox or parental controls blocked this change.";
      case "RATE_LIMITED":
        return "Roblox is receiving too many requests. Try again shortly.";
      case "ACCOUNT_CHANGED":
        return "The signed-in Roblox account changed. Refresh the settings.";
      case "CONFLICT":
        return "This setting changed elsewhere. Refresh before changing it again.";
      case "UNAVAILABLE":
        return "That choice is unavailable for this account.";
      case "UNCONFIRMED":
        return "Roblox may have saved the change. Refresh to confirm it.";
      case "PARTIAL":
        return "Only part of that change was confirmed. Refresh the settings.";
      case "EXPIRED":
        return "The change waited too long and was not sent. Try again.";
      case "BUSY":
        return "Another settings change is still finishing. Try again shortly.";
      case "LOCAL_STORAGE":
        return "RoTool could not safely remember that setting. Try again.";
      case "INVALID_RESPONSE":
        return "Roblox returned settings in an unexpected format.";
      case "TIMEOUT":
        return "Roblox took too long to respond.";
      case "ROBLOX_UNAVAILABLE":
        return "Roblox settings unavailable.";
      default:
        return "Quick Settings could not connect to Roblox.";
    }
  }

  function getQuickSettingsSignature() {
    return JSON.stringify([
      quickSettingsViewerUserId,
      quickSettingsLoadState,
      quickSettingsErrorCode,
      quickSettingsNotice,
      getEnabledQuickSettingAliases(),
      Array.from(quickSettingsPendingOperations.keys()).sort(),
      QUICK_SETTING_SNAPSHOT_ALIASES.map((alias) => {
        const setting = quickSettingsValues[alias];
        return setting
          ? [alias, setting.value, setting.options, setting.editable]
          : [alias, null];
      })
    ]);
  }

  function ensureBestFriendsHeader(carousel) {
    const header = carousel.querySelector(
      `:scope > [${BEST_FRIENDS_HEADER_ATTRIBUTE}], :scope > .container-header`
    );
    header?.setAttribute(BEST_FRIENDS_HEADER_ATTRIBUTE, "");
    return header;
  }

  function ensureQuickSettingsSection(carousel) {
    const bestFriendsHeader = ensureBestFriendsHeader(carousel);
    let section = carousel.querySelector(`:scope > [${QUICK_SETTINGS_ATTRIBUTE}]`);
    if (!section) {
      section = document.createElement("section");
      section.className = "rsl-quick-settings";
      section.setAttribute(QUICK_SETTINGS_ATTRIBUTE, "");
      section.setAttribute("aria-labelledby", "rsl-quick-settings-title");
    }
    const wantedNextSibling = bestFriendsHeader || carousel.firstElementChild;
    if (section.nextElementSibling !== wantedNextSibling) {
      carousel.insertBefore(section, wantedNextSibling || null);
    }
    return section;
  }

  function makeQuickSettingCard(definition) {
    const setting = quickSettingsValues[definition.alias] || null;
    const pending = quickSettingsPendingOperations.has(definition.alias);
    const globallyBusy =
      ["loading", "refreshing"].includes(quickSettingsLoadState) ||
      quickSettingsPendingOperations.size > 0;
    const disabled = globallyBusy || pending || !setting?.editable;
    const card = document.createElement("article");
    card.className = "rsl-quick-setting-card";
    card.setAttribute(QUICK_SETTING_ATTRIBUTE, definition.alias);
    card.classList.toggle("rsl-quick-setting-card--pending", pending);

    const text = document.createElement("div");
    text.className = "rsl-quick-setting-card__text";
    const labelRow = document.createElement("div");
    labelRow.className = "rsl-quick-setting-card__label-row";
    const label = document.createElement("label");
    label.className = "rsl-quick-setting-card__label";
    label.textContent = definition.label;
    const description = document.createElement("span");
    description.className = "rsl-quick-setting-card__description";
    description.id = `rsl-quick-setting-description-${definition.alias}`;
    description.textContent = definition.description;
    const information = document.createElement("span");
    information.id = `rsl-quick-setting-info-${definition.alias}`;
    information.className = "rsl-quick-setting-info tooltip-container";
    information.tabIndex = 0;
    information.setAttribute("role", "button");
    information.setAttribute("aria-label", `About ${definition.label}`);
    information.setAttribute("aria-describedby", description.id);
    const informationIcon = document.createElement("span");
    informationIcon.className = "icon-moreinfo-16x16";
    informationIcon.setAttribute("aria-hidden", "true");
    const tooltip = document.createElement("span");
    tooltip.className = "rsl-quick-setting-tooltip fade in tooltip bottom";
    tooltip.setAttribute("role", "tooltip");
    const tooltipArrow = document.createElement("span");
    tooltipArrow.className = "tooltip-arrow";
    const tooltipInner = document.createElement("span");
    tooltipInner.className = "tooltip-inner";
    tooltipInner.textContent = definition.description;
    tooltip.append(tooltipArrow, tooltipInner);
    information.append(informationIcon, tooltip);
    labelRow.append(label, information);
    text.append(labelRow, description);

    const select = document.createElement("select");
    select.id = `rsl-quick-setting-${definition.alias}`;
    select.className = "rsl-quick-setting-select";
    select.setAttribute("aria-describedby", description.id);
    label.htmlFor = select.id;
    const options = setting?.options || [];
    if (setting && !options.includes(setting.value)) {
      const current = document.createElement("option");
      current.value = setting.value;
      current.textContent = QUICK_SETTING_VALUE_LABELS[setting.value];
      select.append(current);
    }
    for (const optionValue of options) {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = QUICK_SETTING_VALUE_LABELS[optionValue];
      select.append(option);
    }
    if (!select.options.length) {
      const unavailable = document.createElement("option");
      unavailable.value = "";
      unavailable.textContent = quickSettingsLoadState === "loading"
        ? "Loading..."
        : "Unavailable";
      select.append(unavailable);
    }
    select.value = setting?.value || "";
    select.disabled = disabled;
    select.addEventListener("change", (event) => {
      if (
        event.isTrusted !== true ||
        disabled ||
        !setting ||
        !isQuickSettingEnabled(definition.alias)
      ) {
        return;
      }
      const requestedValue = select.value;
      if (
        requestedValue === setting.value ||
        !setting.options.includes(requestedValue)
      ) {
        return;
      }
      if (definition.alias === "onlineStatus") {
        void updateOnlineStatus(requestedValue);
      } else {
        void updateQuickSetting(
          definition.alias,
          setting.value,
          requestedValue,
          definition.label
        );
      }
    });
    card.append(text, select);
    return card;
  }

  function syncQuickSettingsCollapsedState(section) {
    if (!section) {
      return;
    }
    section.toggleAttribute(
      "data-rsl-quick-settings-collapsed",
      quickSettingsCollapsed
    );
    const controls = section.querySelector(".rsl-quick-settings__controls");
    if (controls) {
      controls.hidden = quickSettingsCollapsed;
    }
    section
      .querySelectorAll("[data-rsl-quick-settings-expanded-only]")
      .forEach((element) => {
        element.hidden = quickSettingsCollapsed;
      });
    const toggle = section.querySelector("#rsl-quick-settings-toggle");
    if (toggle) {
      const nextToggleText = quickSettingsCollapsed ? "Show" : "Hide";
      if (toggle.textContent !== nextToggleText) {
        toggle.textContent = nextToggleText;
      }
      toggle.setAttribute("aria-expanded", String(!quickSettingsCollapsed));
      toggle.setAttribute("aria-controls", "rsl-quick-settings-controls");
      toggle.setAttribute(
        "aria-label",
        quickSettingsCollapsed ? "Show Quick Settings" : "Hide Quick Settings"
      );
    }
  }

  function applyHomeFriendsCollapsedStorageValue(collapsed) {
    const nextCollapsed = collapsed === true;
    const stateChanged = homeFriendsCollapsed !== nextCollapsed;
    homeFriendsCollapsed = nextCollapsed;
    homeFriendsCollapsedConfirmed = nextCollapsed;
    if (!stateChanged || !featureSettingsLoaded) {
      return;
    }
    const nativeCarousel = findNativeHomeFriendsCarousel();
    const body = nativeCarousel?.querySelector(
      `[${HOME_FRIENDS_BODY_ATTRIBUTE}]`
    );
    const toggle = nativeCarousel?.querySelector(
      `[${HOME_FRIENDS_TOGGLE_ATTRIBUTE}]`
    );
    const shouldRestoreToggleFocus = Boolean(
      nextCollapsed &&
      body?.contains(document.activeElement) &&
      document.activeElement !== toggle
    );
    mountHomeFriendsCollapseControl();
    if (shouldRestoreToggleFocus) {
      const mountedToggle = document.getElementById("rsl-home-friends-toggle");
      try {
        mountedToggle?.focus({ preventScroll: true });
      } catch {
        mountedToggle?.focus();
      }
    }
  }

  function applyDeferredHomeFriendsCollapsedStorageValue() {
    if (
      homeFriendsCollapsedPendingWrites > 0 ||
      homeFriendsCollapsedDeferredStorageValue === null
    ) {
      return;
    }
    const deferredValue = homeFriendsCollapsedDeferredStorageValue;
    homeFriendsCollapsedDeferredStorageValue = null;
    applyHomeFriendsCollapsedStorageValue(deferredValue);
  }

  function setHomeFriendsCollapsed(collapsed) {
    const nextCollapsed = collapsed === true;
    if (homeFriendsCollapsed === nextCollapsed) {
      return Promise.resolve();
    }
    const operationId = ++homeFriendsCollapsedWriteGeneration;
    homeFriendsCollapsed = nextCollapsed;
    mountHomeFriendsCollapseControl();

    homeFriendsCollapsedPendingWrites += 1;
    const write = homeFriendsCollapsedWriteTail
      .catch(() => undefined)
      .then(async () => {
        await homeFriendsCollapsedStorageSet(nextCollapsed);
        homeFriendsCollapsedConfirmed = nextCollapsed;
      });
    const settledWrite = write
      .catch((error) => {
        if (operationId === homeFriendsCollapsedWriteGeneration) {
          homeFriendsCollapsed = homeFriendsCollapsedConfirmed;
          mountHomeFriendsCollapseControl();
        }
        console.error("[RoTool] Failed to save Home Friends layout", error);
      })
      .finally(() => {
        homeFriendsCollapsedPendingWrites = Math.max(
          0,
          homeFriendsCollapsedPendingWrites - 1
        );
        applyDeferredHomeFriendsCollapsedStorageValue();
      });
    homeFriendsCollapsedWriteTail = settledWrite;
    return settledWrite;
  }

  function applyQuickSettingsCollapsedStorageValue(collapsed) {
    const nextCollapsed = collapsed === true;
    const stateChanged = quickSettingsCollapsed !== nextCollapsed;
    quickSettingsCollapsed = nextCollapsed;
    quickSettingsCollapsedConfirmed = nextCollapsed;
    // chrome.storage.onChanged also echoes this tab's own successful write.
    // Confirming the value must not run placement a second time; only a real
    // state change (for example, one made in another tab) needs a remount.
    if (!stateChanged) {
      return;
    }
    if (!featureSettingsLoaded) {
      return;
    }
    const section = document.querySelector(`[${QUICK_SETTINGS_ATTRIBUTE}]`);
    const toggle = section?.querySelector("#rsl-quick-settings-toggle");
    const shouldRestoreToggleFocus = Boolean(
      nextCollapsed &&
      section?.contains(document.activeElement) &&
      document.activeElement !== toggle
    );
    bestFriendsScrollLockUntil = 0;
    window.clearTimeout(bestFriendsScrollSettleTimer);
    bestFriendsScrollSettleTimer = null;
    mountBestFriendsCarousel();
    if (shouldRestoreToggleFocus) {
      const toggle = document.getElementById("rsl-quick-settings-toggle");
      try {
        toggle?.focus({ preventScroll: true });
      } catch {
        toggle?.focus();
      }
    }
  }

  function applyDeferredQuickSettingsCollapsedStorageValue() {
    if (
      quickSettingsCollapsedPendingWrites > 0 ||
      quickSettingsCollapsedDeferredStorageValue === null
    ) {
      return;
    }
    const deferredValue = quickSettingsCollapsedDeferredStorageValue;
    quickSettingsCollapsedDeferredStorageValue = null;
    applyQuickSettingsCollapsedStorageValue(deferredValue);
  }

  function setQuickSettingsCollapsed(collapsed) {
    const nextCollapsed = collapsed === true;
    if (quickSettingsCollapsed === nextCollapsed) {
      return Promise.resolve();
    }
    const operationId = ++quickSettingsCollapsedWriteGeneration;
    quickSettingsCollapsed = nextCollapsed;
    bestFriendsScrollLockUntil = 0;
    window.clearTimeout(bestFriendsScrollSettleTimer);
    bestFriendsScrollSettleTimer = null;
    mountBestFriendsCarousel();

    quickSettingsCollapsedPendingWrites += 1;
    const write = quickSettingsCollapsedWriteTail
      .catch(() => undefined)
      .then(async () => {
        await quickSettingsCollapsedStorageSet(nextCollapsed);
        quickSettingsCollapsedConfirmed = nextCollapsed;
      });
    const settledWrite = write
      .catch((error) => {
        if (operationId === quickSettingsCollapsedWriteGeneration) {
          quickSettingsCollapsed = quickSettingsCollapsedConfirmed;
          mountBestFriendsCarousel();
        }
        console.error("[RoTool] Failed to save Quick Settings layout", error);
      })
      .finally(() => {
        quickSettingsCollapsedPendingWrites = Math.max(
          0,
          quickSettingsCollapsedPendingWrites - 1
        );
        applyDeferredQuickSettingsCollapsedStorageValue();
      });
    quickSettingsCollapsedWriteTail = settledWrite;
    return settledWrite;
  }

  function applyBestFriendsCollapsedStorageValue(collapsed) {
    const nextCollapsed = collapsed === true;
    const stateChanged = bestFriendsCollapsed !== nextCollapsed;
    bestFriendsCollapsed = nextCollapsed;
    bestFriendsCollapsedConfirmed = nextCollapsed;
    // Ignore this tab's own storage echo. The click already mounted the final
    // layout synchronously, so a second placement pass would only add jitter.
    if (!stateChanged || !featureSettingsLoaded) {
      return;
    }
    const carousel = document.querySelector(
      `[${BEST_FRIENDS_CAROUSEL_ATTRIBUTE}]`
    );
    const toggle = carousel?.querySelector(
      `[${BEST_FRIENDS_TOGGLE_ATTRIBUTE}]`
    );
    const body = carousel?.querySelector(`[${BEST_FRIENDS_BODY_ATTRIBUTE}]`);
    const shouldRestoreToggleFocus = Boolean(
      nextCollapsed &&
      (body?.contains(document.activeElement) ||
        bestFriendHoverCard?.contains(document.activeElement)) &&
      document.activeElement !== toggle
    );
    bestFriendsScrollLockUntil = 0;
    window.clearTimeout(bestFriendsScrollSettleTimer);
    bestFriendsScrollSettleTimer = null;
    mountBestFriendsCarousel();
    if (shouldRestoreToggleFocus) {
      const mountedToggle = document.getElementById("rsl-best-friends-toggle");
      try {
        mountedToggle?.focus({ preventScroll: true });
      } catch {
        mountedToggle?.focus();
      }
    }
  }

  function applyDeferredBestFriendsCollapsedStorageValue() {
    if (
      bestFriendsCollapsedPendingWrites > 0 ||
      bestFriendsCollapsedDeferredStorageValue === null
    ) {
      return;
    }
    const deferredValue = bestFriendsCollapsedDeferredStorageValue;
    bestFriendsCollapsedDeferredStorageValue = null;
    applyBestFriendsCollapsedStorageValue(deferredValue);
  }

  function setBestFriendsCollapsed(collapsed) {
    const nextCollapsed = collapsed === true;
    if (bestFriendsCollapsed === nextCollapsed) {
      return Promise.resolve();
    }
    const operationId = ++bestFriendsCollapsedWriteGeneration;
    bestFriendsCollapsed = nextCollapsed;
    bestFriendsScrollLockUntil = 0;
    window.clearTimeout(bestFriendsScrollSettleTimer);
    bestFriendsScrollSettleTimer = null;
    mountBestFriendsCarousel();

    bestFriendsCollapsedPendingWrites += 1;
    const write = bestFriendsCollapsedWriteTail
      .catch(() => undefined)
      .then(async () => {
        await bestFriendsCollapsedStorageSet(nextCollapsed);
        bestFriendsCollapsedConfirmed = nextCollapsed;
      });
    const settledWrite = write
      .catch((error) => {
        if (operationId === bestFriendsCollapsedWriteGeneration) {
          bestFriendsCollapsed = bestFriendsCollapsedConfirmed;
          mountBestFriendsCarousel();
        }
        console.error("[RoTool] Failed to save Best Friends layout", error);
      })
      .finally(() => {
        bestFriendsCollapsedPendingWrites = Math.max(
          0,
          bestFriendsCollapsedPendingWrites - 1
        );
        applyDeferredBestFriendsCollapsedStorageValue();
      });
    bestFriendsCollapsedWriteTail = settledWrite;
    return settledWrite;
  }

  function renderQuickSettings(carousel) {
    const enabledDefinitions = QUICK_SETTING_DEFINITIONS.filter(({ alias }) =>
      isQuickSettingEnabled(alias)
    );
    if (enabledDefinitions.length === 0) {
      carousel
        ?.querySelector?.(`:scope > [${QUICK_SETTINGS_ATTRIBUTE}]`)
        ?.remove();
      return null;
    }
    const section = ensureQuickSettingsSection(carousel);
    syncQuickSettingsCollapsedState(section);
    const signature = getQuickSettingsSignature();
    if (section.dataset.rslQuickSettingsSignature === signature) {
      return section;
    }
    const activeElement = document.activeElement;
    if (section.contains(activeElement) && activeElement?.id) {
      quickSettingsFocusRestoreId = activeElement.id;
    }

    const header = document.createElement("div");
    header.className = "rsl-quick-settings__header";
    const headingGroup = document.createElement("div");
    headingGroup.className = "rsl-quick-settings__heading-group";
    const heading = document.createElement("h2");
    heading.id = "rsl-quick-settings-title";
    heading.textContent = "Quick Settings";
    const status = document.createElement("span");
    status.className = "rsl-quick-settings__status";
    status.setAttribute("data-rsl-quick-settings-expanded-only", "");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    if (quickSettingsPendingOperations.size > 0) {
      status.textContent = "Saving...";
    } else if (quickSettingsLoadState === "loading") {
      status.textContent = "Loading...";
    } else if (quickSettingsLoadState === "refreshing") {
      status.textContent = "Refreshing...";
    } else if (quickSettingsErrorCode) {
      status.textContent = getQuickSettingsErrorMessage(quickSettingsErrorCode);
      status.classList.add("rsl-quick-settings__status--error");
    } else {
      status.textContent = quickSettingsNotice;
    }
    headingGroup.append(heading);

    const actions = document.createElement("div");
    actions.className = "rsl-quick-settings__actions";
    const refresh = document.createElement("button");
    refresh.type = "button";
    refresh.id = "rsl-quick-settings-refresh";
    refresh.className = "rsl-quick-settings__action";
    refresh.setAttribute("data-rsl-quick-settings-expanded-only", "");
    refresh.textContent = "Refresh";
    refresh.disabled =
      ["loading", "refreshing"].includes(quickSettingsLoadState) ||
      quickSettingsPendingOperations.size > 0;
    refresh.addEventListener("click", (event) => {
      if (event.isTrusted === true && !refresh.disabled) {
        void loadQuickSettings(true);
      }
    });
    const more = document.createElement("a");
    more.id = "rsl-quick-settings-more";
    more.className = "rsl-quick-settings__action";
    more.setAttribute("data-rsl-quick-settings-expanded-only", "");
    more.href = "/my/account#!/privacy";
    more.textContent = "More Settings";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.id = "rsl-quick-settings-toggle";
    toggle.className = "rsl-quick-settings__action rsl-quick-settings__toggle";
    toggle.addEventListener("click", (event) => {
      if (event.isTrusted === true) {
        void setQuickSettingsCollapsed(!quickSettingsCollapsed);
      }
    });
    actions.append(refresh, more, toggle);
    header.append(headingGroup, status, actions);

    const controls = document.createElement("div");
    controls.id = "rsl-quick-settings-controls";
    controls.className = "rsl-quick-settings__controls";
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", "Roblox Quick Settings");
    for (const definition of enabledDefinitions) {
      controls.append(makeQuickSettingCard(definition));
    }
    section.replaceChildren(header, controls);
    section.setAttribute(
      "aria-busy",
      String(
        ["loading", "refreshing"].includes(quickSettingsLoadState) ||
        quickSettingsPendingOperations.size > 0
      )
    );
    section.dataset.rslQuickSettingsSignature = signature;
    syncQuickSettingsCollapsedState(section);

    if (quickSettingsFocusRestoreId) {
      const focusTarget = document.getElementById(quickSettingsFocusRestoreId);
      const currentFocus = document.activeElement;
      const focusStayedInPanel =
        currentFocus === document.body ||
        currentFocus === document.documentElement ||
        section.contains(currentFocus);
      if (focusTarget && !focusTarget.disabled && focusStayedInPanel) {
        try {
          focusTarget.focus({ preventScroll: true });
        } catch {
          focusTarget.focus();
        }
        quickSettingsFocusRestoreId = "";
      } else if (!focusStayedInPanel) {
        quickSettingsFocusRestoreId = "";
      } else if (!focusTarget) {
        // A row can disappear while its select owns focus. Do not carry that
        // stale ID into a later unrelated render.
        quickSettingsFocusRestoreId = "";
      }
    }
    return section;
  }

  function loadQuickSettings(forceRefresh = false) {
    if (
      !isFeatureEnabled("quickSettings") ||
      getEnabledQuickSettingAliases().length === 0 ||
      !isHomePage()
    ) {
      return Promise.resolve();
    }
    if (quickSettingsRequestPromise) {
      return quickSettingsRequestPromise;
    }
    if (quickSettingsPendingOperations.size > 0) {
      return Promise.resolve();
    }
    if (
      !forceRefresh &&
      quickSettingsLoadState === "ready" &&
      hasQuickSettingsSnapshotForEnabledControls()
    ) {
      return Promise.resolve();
    }

    const requestId = ++quickSettingsMessageSequence;
    const operationId = ++quickSettingsReadOperationId;
    const lifecycleEpoch = quickSettingsLifecycleEpoch;
    const hadSnapshot = Object.keys(quickSettingsValues).length > 0;
    quickSettingsLoadState = hadSnapshot ? "refreshing" : "loading";
    quickSettingsErrorCode = "";
    quickSettingsNotice = "";
    queueMount();

    const request = sendQuickSettingsRuntimeMessage({
      type: QUICK_SETTINGS_READ_MESSAGE_TYPE,
      requestId
    })
      .then((response) => {
        if (
          operationId !== quickSettingsReadOperationId ||
          lifecycleEpoch !== quickSettingsLifecycleEpoch ||
          !isHomePage()
        ) {
          return;
        }
        if (!response?.ok || response.requestId !== requestId) {
          const error = new Error("Quick Settings request failed");
          error.code = response?.code || "NETWORK";
          throw error;
        }
        const snapshot = normalizeQuickSettingsSnapshot(response);
        if (!snapshot) {
          const error = new Error("Quick Settings response was invalid");
          error.code = "NETWORK";
          throw error;
        }
        quickSettingsViewerUserId = snapshot.viewerUserId;
        quickSettingsValues = snapshot.settings;
        quickSettingsLoadState = "ready";
        quickSettingsErrorCode = "";
        quickSettingsNotice = forceRefresh ? "Settings refreshed." : "";
      })
      .catch((error) => {
        if (
          operationId !== quickSettingsReadOperationId ||
          lifecycleEpoch !== quickSettingsLifecycleEpoch ||
          !isHomePage()
        ) {
          return;
        }
        quickSettingsLoadState = hadSnapshot ? "ready" : "error";
        quickSettingsErrorCode = error?.code || "NETWORK";
        quickSettingsNotice = "";
      })
      .finally(() => {
        if (quickSettingsRequestPromise === request) {
          quickSettingsRequestPromise = null;
          queueMount();
        }
      });
    quickSettingsRequestPromise = request;
    return request;
  }

  async function updateOnlineStatus(requestedValue) {
    const onlineStatus = quickSettingsValues.onlineStatus;
    const currentExperience = quickSettingsValues.currentExperience;
    if (
      !isHomePage() ||
      !isQuickSettingEnabled("onlineStatus") ||
      !quickSettingsViewerUserId ||
      quickSettingsLoadState !== "ready" ||
      !onlineStatus?.editable ||
      !onlineStatus.options.includes(requestedValue) ||
      requestedValue === onlineStatus.value ||
      !onlineStatus ||
      !currentExperience ||
      quickSettingsPendingOperations.size > 0
    ) {
      return;
    }

    const requestId = ++quickSettingsMessageSequence;
    const lifecycleEpoch = quickSettingsLifecycleEpoch;
    const operationToken = Object.freeze({ requestId, lifecycleEpoch });
    const viewerUserId = quickSettingsViewerUserId;
    quickSettingsPendingOperations.set("onlineStatus", operationToken);
    quickSettingsErrorCode = "";
    quickSettingsNotice = "";
    queueMount();
    try {
      const response = await sendQuickSettingsRuntimeMessage({
        type: ONLINE_STATUS_UPDATE_MESSAGE_TYPE,
        requestId,
        viewerUserId,
        expectedOnlineStatus: onlineStatus.value,
        expectedCurrentExperience: currentExperience.value,
        requestedOnlineStatus: requestedValue
      });
      if (
        !isHomePage() ||
        lifecycleEpoch !== quickSettingsLifecycleEpoch ||
        quickSettingsPendingOperations.get("onlineStatus") !== operationToken ||
        quickSettingsViewerUserId !== viewerUserId
      ) {
        return;
      }
      if (!response?.ok || response.requestId !== requestId) {
        const error = new Error("Online Status update failed");
        error.code = response?.code || "NETWORK";
        throw error;
      }
      const snapshot = normalizeQuickSettingsSnapshot(response);
      if (
        !snapshot ||
        snapshot.viewerUserId !== viewerUserId ||
        snapshot.settings.onlineStatus?.value !== requestedValue
      ) {
        const error = new Error("Online Status response was invalid");
        error.code = "UNCONFIRMED";
        throw error;
      }
      quickSettingsValues = snapshot.settings;
      quickSettingsLoadState = "ready";
      quickSettingsErrorCode = "";
      if (response.experienceRestore === "restored") {
        quickSettingsNotice = "Online Status saved. Current Experience restored.";
      } else if (response.experienceRestore === "notRemembered") {
        quickSettingsNotice =
          "Online Status saved, but Current Experience could not be remembered.";
      } else if (
        ["unknown", "unavailable", "failed"].includes(response.experienceRestore)
      ) {
        const currentExperienceLabel =
          QUICK_SETTING_VALUE_LABELS[
            snapshot.settings.currentExperience?.value
          ] || "its current value";
        quickSettingsNotice =
          `Online Status saved. Current Experience is now ${currentExperienceLabel}.`;
      } else {
        quickSettingsNotice = "Online Status saved.";
      }
    } catch (error) {
      if (
        isHomePage() &&
        lifecycleEpoch === quickSettingsLifecycleEpoch &&
        quickSettingsPendingOperations.get("onlineStatus") === operationToken &&
        quickSettingsViewerUserId === viewerUserId
      ) {
        quickSettingsErrorCode = error?.code || "NETWORK";
        quickSettingsNotice = "";
      }
    } finally {
      if (
        quickSettingsPendingOperations.get("onlineStatus") === operationToken
      ) {
        quickSettingsPendingOperations.delete("onlineStatus");
        queueMount();
      }
    }
  }

  async function updateQuickSetting(alias, expectedValue, requestedValue, label) {
    const setting = quickSettingsValues[alias];
    if (
      !isHomePage() ||
      !isQuickSettingEnabled(alias) ||
      !quickSettingsViewerUserId ||
      quickSettingsLoadState !== "ready" ||
      !setting?.editable ||
      setting.value !== expectedValue ||
      !setting.options.includes(requestedValue) ||
      quickSettingsPendingOperations.size > 0
    ) {
      return;
    }

    const requestId = ++quickSettingsMessageSequence;
    const lifecycleEpoch = quickSettingsLifecycleEpoch;
    const operationToken = Object.freeze({ requestId, lifecycleEpoch });
    const viewerUserId = quickSettingsViewerUserId;
    quickSettingsPendingOperations.set(alias, operationToken);
    quickSettingsErrorCode = "";
    quickSettingsNotice = "";
    queueMount();
    try {
      const response = await sendQuickSettingsRuntimeMessage({
        type: QUICK_SETTING_UPDATE_MESSAGE_TYPE,
        requestId,
        viewerUserId,
        alias,
        expectedValue,
        requestedValue
      });
      if (
        !isHomePage() ||
        lifecycleEpoch !== quickSettingsLifecycleEpoch ||
        quickSettingsPendingOperations.get(alias) !== operationToken ||
        quickSettingsViewerUserId !== viewerUserId
      ) {
        return;
      }
      if (!response?.ok || response.requestId !== requestId) {
        const error = new Error("Quick Setting update failed");
        error.code = response?.code || "NETWORK";
        throw error;
      }
      const snapshot = normalizeQuickSettingsSnapshot(response);
      if (!snapshot || snapshot.viewerUserId !== viewerUserId) {
        const error = new Error("Quick Setting response was invalid");
        error.code = "ACCOUNT_CHANGED";
        throw error;
      }
      quickSettingsValues = snapshot.settings;
      quickSettingsLoadState = "ready";
      quickSettingsErrorCode = "";
      quickSettingsNotice = `${label} saved.`;
    } catch (error) {
      if (
        isHomePage() &&
        lifecycleEpoch === quickSettingsLifecycleEpoch &&
        quickSettingsPendingOperations.get(alias) === operationToken &&
        quickSettingsViewerUserId === viewerUserId
      ) {
        quickSettingsErrorCode = error?.code || "NETWORK";
        quickSettingsNotice = "";
      }
    } finally {
      if (quickSettingsPendingOperations.get(alias) === operationToken) {
        quickSettingsPendingOperations.delete(alias);
        queueMount();
      }
    }
  }

  function getBestFriendsCarouselSignature() {
    // A background refresh is not a visual change. Treat it as the already
    // rendered ready state so the row and its loaded avatar elements survive
    // the refresh instead of restarting their shimmer twice every minute.
    const renderedLoadState =
      bestFriendsLoadState === "refreshing" ? "ready" : bestFriendsLoadState;
    return JSON.stringify([
      renderedLoadState,
      bestFriendsErrorCode,
      bestFriendsCanChat,
      bestFriendUserIds,
      bestFriendDetails.map((friend) => [
        friend.userId,
        friend.displayName,
        friend.username,
        friend.isVerified,
        friend.isRobloxPlus,
        friend.presenceType,
        friend.lastLocation,
        friend.placeId,
        friend.rootPlaceId,
        friend.universeId,
        friend.gameInstanceId,
        friend.headshotUrl
      ])
    ]);
  }

  function ensureBestFriendsCollapseControl(carousel) {
    const header = ensureBestFriendsHeader(carousel);
    const heading = header?.querySelector("h2");
    if (!header || !heading) {
      return null;
    }

    let headingGroup = header.querySelector(
      ":scope > .rsl-best-friends-heading-group"
    );
    if (!headingGroup) {
      headingGroup = document.createElement("div");
      headingGroup.className = "rsl-best-friends-heading-group";
      heading.replaceWith(headingGroup);
      headingGroup.append(heading);
    } else if (heading.parentElement !== headingGroup) {
      headingGroup.prepend(heading);
    }

    let toggle = headingGroup.querySelector(
      `:scope > [${BEST_FRIENDS_TOGGLE_ATTRIBUTE}]`
    );
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "rsl-best-friends-collapse-toggle";
      toggle.id = "rsl-best-friends-toggle";
      toggle.setAttribute(BEST_FRIENDS_TOGGLE_ATTRIBUTE, "");
      toggle.addEventListener("click", (event) => {
        if (event.isTrusted === true) {
          void setBestFriendsCollapsed(!bestFriendsCollapsed);
        }
      });
      headingGroup.append(toggle);
    }
    return toggle;
  }

  function syncBestFriendsCollapsedState(carousel) {
    if (!carousel) {
      return;
    }
    const featureVisible = !carousel.hasAttribute(
      "data-rsl-best-friends-disabled"
    );
    const collapsed = featureVisible && bestFriendsCollapsed;
    const header = ensureBestFriendsHeader(carousel);
    const toggle = ensureBestFriendsCollapseControl(carousel);
    const list = getNativeHomeFriendList(carousel);
    const body = list?.closest(".friends-carousel-container") || list;
    list?.setAttribute(BEST_FRIENDS_LIST_ATTRIBUTE, "");
    body?.setAttribute(BEST_FRIENDS_BODY_ATTRIBUTE, "");
    if (body) {
      body.id = "rsl-best-friends-home-body";
    }

    carousel.toggleAttribute(BEST_FRIENDS_COLLAPSED_ATTRIBUTE, collapsed);
    if (header) {
      header.hidden = !featureVisible;
      header.toggleAttribute("aria-hidden", !featureVisible);
    }
    for (const element of new Set([body, list])) {
      if (!element) {
        continue;
      }
      element.hidden = !featureVisible || collapsed;
      element.toggleAttribute("aria-hidden", !featureVisible || collapsed);
    }
    if (toggle) {
      toggle.hidden = !featureVisible;
      const nextToggleText = collapsed ? "Show" : "Hide";
      if (toggle.textContent !== nextToggleText) {
        toggle.textContent = nextToggleText;
      }
      toggle.setAttribute("aria-expanded", String(!collapsed));
      toggle.setAttribute("aria-controls", body?.id || "rsl-best-friends-home-body");
      toggle.setAttribute(
        "aria-label",
        collapsed ? "Show Best Friends" : "Hide Best Friends"
      );
    }
    if (!featureVisible || collapsed) {
      closeBestFriendHoverCard();
    }
  }

  function renderBestFriendsCarousel(carousel, nativeCarousel) {
    ensureBestFriendsCollapseControl(carousel);
    const list = getNativeHomeFriendList(carousel);
    if (!list) {
      delete carousel.dataset.rslBestFriendsSignature;
      return false;
    }
    list.setAttribute(BEST_FRIENDS_LIST_ATTRIBUTE, "");

    const signature = getBestFriendsCarouselSignature();
    if (carousel.dataset.rslBestFriendsSignature === signature) {
      return true;
    }

    const header = ensureBestFriendsHeader(carousel);
    const heading = header?.querySelector("h2");
    if (heading) {
      heading.replaceChildren(document.createTextNode("Best Friends"));
      const count = document.createElement("span");
      count.className = "friends-count";
      count.textContent = `(${bestFriendUserIds.length})`;
      heading.append(count);
    }

    closeBestFriendHoverCard();
    list.replaceChildren(makeBestFriendsAddTile(nativeCarousel));
    for (const friend of getPresenceSortedBestFriendDetails()) {
      list.append(makeBestFriendTile(nativeCarousel, friend));
    }
    list.setAttribute("aria-busy", String(bestFriendsLoadState === "loading"));

    const manage = carousel.querySelector("[data-rsl-manage-best-friends]");
    if (manage) {
      manage.textContent = "Manage";
      manage.title = bestFriendsErrorCode ? "Best Friends could not be refreshed" : "";
    }
    const seeAll = carousel.querySelector("[data-rsl-see-all-best-friends]");
    if (seeAll && seeAll.getAttribute("href") !== BEST_FRIENDS_DEEP_LINK) {
      seeAll.setAttribute("href", BEST_FRIENDS_DEEP_LINK);
    }
    carousel.dataset.rslBestFriendsSignature = signature;
    return true;
  }

  function setBestFriendsHomeVisibility(carousel, visible) {
    carousel.toggleAttribute("data-rsl-best-friends-disabled", !visible);
    syncBestFriendsCollapsedState(carousel);
  }

  function makeBestFriendsCarousel(
    nativeCarousel,
    bestFriendsEnabled = true,
    quickSettingsEnabled = true
  ) {
    const carousel = nativeCarousel.cloneNode(true);
    sanitizeBestFriendsClone(carousel);
    carousel.setAttribute(BEST_FRIENDS_CAROUSEL_ATTRIBUTE, "");
    carousel.classList.add("rsl-best-friends-carousel");

    const header = carousel.querySelector(":scope > .container-header");
    header?.setAttribute(BEST_FRIENDS_HEADER_ATTRIBUTE, "");
    const nativeAction = header?.querySelector(
      ":scope > a, :scope > .see-all-link-icon"
    );
    const actionClass =
      nativeAction?.className || "btn-secondary-xs btn-more see-all-link-icon";
    const actions = document.createElement("div");
    actions.className = "rsl-best-friends-header-actions";
    const manage = document.createElement("button");
    manage.type = "button";
    manage.className = actionClass;
    manage.setAttribute("data-rsl-manage-best-friends", "");
    manage.setAttribute("aria-label", "Manage Best Friends");
    manage.textContent = "Manage";
    manage.addEventListener("click", () => openBestFriendsDialog(manage));

    const seeAll = document.createElement("a");
    seeAll.className = actionClass;
    seeAll.setAttribute("data-rsl-see-all-best-friends", "");
    seeAll.setAttribute("aria-label", "See all Best Friends");
    seeAll.setAttribute("href", BEST_FRIENDS_DEEP_LINK);
    seeAll.textContent = "See All";
    actions.append(manage, seeAll);
    if (nativeAction) {
      nativeAction.replaceWith(actions);
    } else {
      header?.append(actions);
    }
    carousel.dataset.rslBestFriendsSignature = "";
    if (quickSettingsEnabled) {
      renderQuickSettings(carousel);
    }
    if (bestFriendsEnabled) {
      renderBestFriendsCarousel(carousel, nativeCarousel);
    }
    setBestFriendsHomeVisibility(carousel, bestFriendsEnabled);
    return carousel;
  }

  function findHomeHeading(nativeCarousel) {
    const home = nativeCarousel.closest("#HomeContainer, .home-container") || document;
    return Array.from(home.querySelectorAll("h1")).find(
      (heading) => normalizeVisibleText(heading) === "Home"
    ) || null;
  }

  function getHomeFriendTileVisualRect(item) {
    const visual = item?.querySelector?.(
      ".add-friends-icon-container, .avatar-card-image, [data-testid='avatar-card-container']"
    );
    return (visual || item)?.getBoundingClientRect?.() || null;
  }

  function getMedianMeasurement(values) {
    const sorted = values
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((left, right) => left - right);
    if (!sorted.length) {
      return 0;
    }
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function syncBestFriendsTileSpacing(carousel, nativeCarousel) {
    const nativeList = getNativeHomeFriendList(nativeCarousel);
    const bestFriendsList = getNativeHomeFriendList(carousel);
    const nativeItems = Array.from(nativeList?.children || []).filter(
      (item) => item.getBoundingClientRect().width > 0
    );
    if (nativeItems.length < 2) {
      return;
    }

    const nativeItemRects = nativeItems.map((item) => item.getBoundingClientRect());
    const nativeVisualRects = nativeItems
      .map(getHomeFriendTileVisualRect)
      .filter((rect) => rect && rect.width > 0);
    if (nativeVisualRects.length < 2) {
      return;
    }

    const centerSteps = [];
    for (let index = 1; index < nativeVisualRects.length; index += 1) {
      const previous = nativeVisualRects[index - 1];
      const current = nativeVisualRects[index];
      centerSteps.push(
        Math.abs(
          current.left + current.width / 2 -
          (previous.left + previous.width / 2)
        )
      );
    }

    const nativeTileWidth = getMedianMeasurement(
      nativeItemRects.map((rect) => rect.width)
    );
    const nativeCenterStep = getMedianMeasurement(centerSteps);
    if (!nativeTileWidth || !nativeCenterStep) {
      return;
    }

    const roundedWidth = Math.round(Math.min(nativeTileWidth, nativeCenterStep) * 10) / 10;
    const roundedGap =
      Math.round(Math.max(0, nativeCenterStep - roundedWidth) * 10) / 10;
    const nextWidth = `${roundedWidth}px`;
    const nextGap = `${roundedGap}px`;
    if (
      carousel.style.getPropertyValue("--rsl-best-friends-tile-width") !== nextWidth
    ) {
      carousel.style.setProperty("--rsl-best-friends-tile-width", nextWidth);
    }
    if (
      carousel.style.getPropertyValue("--rsl-best-friends-tile-gap") !== nextGap
    ) {
      carousel.style.setProperty("--rsl-best-friends-tile-gap", nextGap);
    }
    const bestFirstItem = bestFriendsList?.firstElementChild;
    const bestFirstVisual = getHomeFriendTileVisualRect(bestFirstItem);
    const nativeListRect = nativeList.getBoundingClientRect();
    const bestListRect = bestFriendsList?.getBoundingClientRect();
    if (
      !bestFirstVisual ||
      !bestListRect ||
      Math.abs(nativeList.scrollLeft) > 1 ||
      Math.abs(bestFriendsList.scrollLeft) > 1
    ) {
      return;
    }

    const direction = getComputedStyle(nativeList).direction;
    const centerFromInlineStart = (rect, listRect) => {
      const center = rect.left + rect.width / 2;
      return direction === "rtl" ? listRect.right - center : center - listRect.left;
    };
    const currentStartOffset =
      Number.parseFloat(
        carousel.style.getPropertyValue("--rsl-best-friends-start-offset")
      ) || 0;
    const nativeStart = centerFromInlineStart(nativeVisualRects[0], nativeListRect);
    const bestStartWithoutOffset =
      centerFromInlineStart(bestFirstVisual, bestListRect) - currentStartOffset;
    const measuredStartOffset = nativeStart - bestStartWithoutOffset;
    if (!Number.isFinite(measuredStartOffset)) {
      return;
    }

    const roundedStartOffset =
      Math.round(Math.max(-48, Math.min(48, measuredStartOffset)) * 10) / 10;
    const nextStartOffset = `${roundedStartOffset}px`;
    if (
      carousel.style.getPropertyValue("--rsl-best-friends-start-offset") !==
      nextStartOffset
    ) {
      carousel.style.setProperty(
        "--rsl-best-friends-start-offset",
        nextStartOffset
      );
    }
  }

  function getBestFriendsScopedOverlayWidth(
    left,
    top,
    width,
    height,
    nativeCarousel,
    heading
  ) {
    const scope = heading?.parentElement;
    if (!scope) {
      return width;
    }

    const right = left + width;
    const bottom = top + height;
    const maximumInspectedElements = 256;
    const semanticContentSelector =
      "img, picture, video, canvas, svg, button, input, select, textarea, " +
      "a[href], [role='alert'], [role='button'], [role='status']";
    const isHidden = (element) => {
      const style = getComputedStyle(element);
      return {
        hidden:
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.visibility === "collapse" ||
          Number.parseFloat(style.opacity || "1") <= 0.01,
        style
      };
    };
    const hasDirectTextInBand = (element) =>
      Array.from(element.childNodes || []).some((node) => {
        if (
          node.nodeType !== Node.TEXT_NODE ||
          !String(node.textContent || "").trim()
        ) {
          return false;
        }
        if (typeof document.createRange !== "function") {
          return true;
        }
        const range = document.createRange();
        range.selectNodeContents(node);
        const intersects = Array.from(range.getClientRects()).some(
          (textRect) =>
            textRect.right > left &&
            textRect.left < right &&
            textRect.bottom > top &&
            textRect.top < bottom
        );
        range.detach?.();
        return intersects;
      });
    let blockerLeft = right;
    let inspectedElements = 0;
    for (const sibling of Array.from(scope.children || [])) {
      if (
        !sibling ||
        sibling === heading ||
        heading.contains(sibling) ||
        nativeCarousel.contains(sibling) ||
        sibling.contains?.(nativeCarousel) ||
        sibling.contains?.(heading) ||
        isBestFriendsTransientPlacementOverlay(sibling) ||
        sibling.closest?.(
          `[${BEST_FRIENDS_CAROUSEL_ATTRIBUTE}], .rsl-dialog, ` +
            "[data-rsl-best-friend-hover-card]"
        )
      ) {
        continue;
      }
      const siblingRect = sibling.getBoundingClientRect?.();
      if (
        !siblingRect ||
        siblingRect.width <= 0 ||
        siblingRect.height <= 0 ||
        siblingRect.left >= right ||
        siblingRect.right <= left ||
        siblingRect.top >= bottom ||
        siblingRect.bottom <= top
      ) {
        continue;
      }
      if (isHidden(sibling).hidden) {
        continue;
      }

      let branchBlockerLeft = right;
      let branchHasVisibleContent = false;
      const queue = [sibling];
      for (
        let queueIndex = 0;
        queueIndex < queue.length && inspectedElements < maximumInspectedElements;
        queueIndex += 1
      ) {
        const element = queue[queueIndex];
        inspectedElements += 1;
        if (
          !element ||
          isBestFriendsTransientPlacementOverlay(element) ||
          element.closest?.(
            `[${BEST_FRIENDS_CAROUSEL_ATTRIBUTE}], .rsl-dialog, ` +
              "[data-rsl-best-friend-hover-card]"
          ) ||
          nativeCarousel.contains(element) ||
          element.contains?.(nativeCarousel) ||
          element.contains?.(heading)
        ) {
          continue;
        }
        const { hidden, style } = isHidden(element);
        if (hidden) {
          continue;
        }
        const rect = element.getBoundingClientRect?.();
        if (
          rect &&
          rect.width >= 24 &&
          rect.height >= 16 &&
          rect.left < right &&
          rect.right > left &&
          rect.top < bottom &&
          rect.bottom > top
        ) {
          const backgroundColor = String(style.backgroundColor || "")
            .trim()
            .toLowerCase();
          const hasPaintedSurface = Boolean(
            (backgroundColor &&
              backgroundColor !== "transparent" &&
              !/^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/.test(backgroundColor) &&
              !/^rgb\([^)]*\/\s*0(?:\.0+)?\s*\)$/.test(backgroundColor)) ||
              (style.backgroundImage && style.backgroundImage !== "none") ||
              (style.boxShadow && style.boxShadow !== "none") ||
              ["Top", "Right", "Bottom", "Left"].some(
                (side) =>
                  Number.parseFloat(style[`border${side}Width`]) > 0 &&
                  style[`border${side}Style`] !== "none"
              )
          );
          if (
            element.matches?.(semanticContentSelector) ||
            hasDirectTextInBand(element) ||
            hasPaintedSurface
          ) {
            branchHasVisibleContent = true;
            branchBlockerLeft = Math.min(branchBlockerLeft, rect.left);
          }
        }
        for (const child of Array.from(element.children || [])) {
          queue.push(child);
        }
      }

      if (!branchHasVisibleContent) {
        continue;
      }
      const isBoundedRightSibling =
        siblingRect.left > left + 200 &&
        siblingRect.width < width * 0.94;
      if (isBoundedRightSibling) {
        branchBlockerLeft = Math.min(branchBlockerLeft, siblingRect.left);
      }
      blockerLeft = Math.min(blockerLeft, branchBlockerLeft);

      if (inspectedElements >= maximumInspectedElements) {
        break;
      }
    }

    return Math.max(0, blockerLeft - left - (blockerLeft < right ? 16 : 0));
  }

  function isBestFriendsTransientPlacementOverlay(node) {
    if (!node) {
      return false;
    }
    const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!element?.closest) {
      return false;
    }

    if (
      element.closest(
        ".rsl-dialog, [data-rsl-best-friend-hover-card], " +
          "[data-rsl-friends-filters-menu], dialog[open], [popover], " +
          "[aria-modal='true'], [role='alertdialog'], [role='menu'], " +
          "[role='listbox'], [role='tooltip']"
      )
    ) {
      return true;
    }

    if (typeof document.querySelectorAll !== "function") {
      return false;
    }
    const popupIds = new Set();
    let ancestor = element;
    for (let depth = 0; ancestor && depth < 10; depth += 1) {
      if (typeof ancestor.id === "string" && ancestor.id) {
        popupIds.add(ancestor.id);
      }
      ancestor = ancestor.parentElement;
    }
    if (popupIds.size === 0) {
      return false;
    }

    const referenceAttributes = [
      "aria-controls",
      "aria-owns",
      "aria-describedby"
    ];
    return Array.from(document.querySelectorAll("[aria-haspopup]")).some(
      (trigger) => {
        const hasPopup = String(trigger.getAttribute?.("aria-haspopup") || "")
          .trim()
          .toLowerCase();
        if (!hasPopup || hasPopup === "false") {
          return false;
        }
        return referenceAttributes.some((attribute) =>
          String(trigger.getAttribute?.(attribute) || "")
            .split(/\s+/)
            .some((token) => popupIds.has(token))
        );
      }
    );
  }

  function getBestFriendsOverlayWidth(left, top, width, height, nativeCarousel, heading) {
    const scopedOverlayWidth = getBestFriendsScopedOverlayWidth(
      left,
      top,
      width,
      height,
      nativeCarousel,
      heading
    );
    if (typeof document.elementsFromPoint !== "function") {
      return scopedOverlayWidth;
    }

    if (!isBestFriendsViewportBandInspectable(top, height)) {
      return scopedOverlayWidth < width ? scopedOverlayWidth : null;
    }

    let blockerLeft = left + width;
    const sampleYs = [0.12, 0.35, 0.62, 0.88].map(
      (ratio) => top + height * ratio
    );
    for (const y of sampleYs) {
      for (
        let x = left + 240;
        x < left + Math.min(width, scopedOverlayWidth);
        x += 72
      ) {
        const blocker = document.elementsFromPoint(x, y).find((element) => {
          if (
            !element ||
            element === document.body ||
            element === document.documentElement ||
            element.closest?.(`[${BEST_FRIENDS_CAROUSEL_ATTRIBUTE}]`) ||
            element.closest?.("[data-rsl-best-friend-hover-card]") ||
            nativeCarousel.contains(element) ||
            heading?.contains(element) ||
            element.contains?.(nativeCarousel) ||
            element.contains?.(heading)
          ) {
            return false;
          }
          const rect = element.getBoundingClientRect?.();
          if (
            !rect ||
            rect.width < 80 ||
            rect.height < 50 ||
            rect.left <= left + 200 ||
            rect.left >= left + width ||
            rect.top >= top + height ||
            rect.bottom <= top
          ) {
            return false;
          }
          return isBestFriendsPaintedPointBlocker(
            element,
            rect,
            x,
            y,
            left,
            width
          );
        });
        if (blocker) {
          blockerLeft = Math.min(blockerLeft, blocker.getBoundingClientRect().left);
        }
      }
    }

    const hitTestWidth = Math.max(
      0,
      blockerLeft - left - (blockerLeft < left + width ? 16 : 0)
    );
    return Math.min(hitTestWidth, scopedOverlayWidth);
  }

  function isBestFriendsViewportBandInspectable(top, height) {
    return Boolean(
      Number.isFinite(top) &&
        Number.isFinite(height) &&
        height > 0 &&
        top >= 0 &&
        top + height <= window.innerHeight
    );
  }

  function isBestFriendsPaintedPointBlocker(
    element,
    rect,
    x,
    y,
    left,
    width
  ) {
    if (
      typeof isBestFriendsTransientPlacementOverlay === "function" &&
      isBestFriendsTransientPlacementOverlay(element)
    ) {
      return false;
    }
    if (
      element.closest?.(
        ".rsl-dialog, [data-rsl-best-friend-hover-card]"
      )
    ) {
      return false;
    }
    if (
      element.matches?.(
        "img, picture, video, canvas, svg, button, input, select, textarea, a[href], " +
        "[role='alert'], [role='dialog'], [role='button'], [role='status']"
      )
    ) {
      return true;
    }

    const style = getComputedStyle(element);
    const isBoundedSurface =
      rect.width < width - 32 ||
      rect.left > left + 16 ||
      rect.right < left + width - 16;
    const hasDirectTextAtPoint = Array.from(element.childNodes || []).some(
      (node) => {
        if (
          node.nodeType !== Node.TEXT_NODE ||
          !String(node.textContent || "").trim()
        ) {
          return false;
        }
        if (typeof document.createRange !== "function") {
          return (
            style.display === "inline" ||
            style.display === "inline-block" ||
            isBoundedSurface
          );
        }
        const range = document.createRange();
        range.selectNodeContents(node);
        const containsPoint = Array.from(range.getClientRects()).some(
          (textRect) =>
            x >= textRect.left &&
            x <= textRect.right &&
            y >= textRect.top &&
            y <= textRect.bottom
        );
        range.detach?.();
        return containsPoint;
      }
    );
    if (hasDirectTextAtPoint) {
      return true;
    }

    const backgroundColor = String(style.backgroundColor || "")
      .trim()
      .toLowerCase();
    const hasBackgroundColor = Boolean(
      backgroundColor &&
        backgroundColor !== "transparent" &&
        !/^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/.test(backgroundColor) &&
        !/^rgb\([^)]*\/\s*0(?:\.0+)?\s*\)$/.test(backgroundColor)
    );
    const hasBorder = ["Top", "Right", "Bottom", "Left"].some(
      (side) =>
        Number.parseFloat(style[`border${side}Width`]) > 0 &&
        style[`border${side}Style`] !== "none"
    );
    const hasPaintedSurface =
      hasBackgroundColor ||
      (style.backgroundImage && style.backgroundImage !== "none") ||
      (style.boxShadow && style.boxShadow !== "none") ||
      hasBorder;
    return isBoundedSurface && hasPaintedSurface;
  }

  function hasBestFriendsInterveningContent(
    left,
    top,
    width,
    bottom,
    carousel,
    nativeCarousel,
    heading
  ) {
    if (typeof document.elementsFromPoint !== "function" || bottom <= top) {
      return false;
    }
    if (!isBestFriendsViewportBandInspectable(top, bottom - top)) {
      return null;
    }

    const sampleXs = [32, 96, 192, 288]
      .map((offset) => left + Math.min(offset, Math.max(0, width - 32)))
      .filter((x, index, values) => values.indexOf(x) === index);
    for (let y = top; y < bottom; y += 32) {
      for (const x of sampleXs) {
        const blocker = document.elementsFromPoint(x, y).find((element) => {
          if (
            !element ||
            element === document.body ||
            element === document.documentElement ||
            carousel.contains(element) ||
            nativeCarousel.contains(element) ||
            heading?.contains(element) ||
            element.contains?.(carousel) ||
            element.contains?.(nativeCarousel) ||
            element.contains?.(heading)
          ) {
            return false;
          }
          const rect = element.getBoundingClientRect?.();
          if (
            !rect ||
            rect.width < 80 ||
            rect.height < 20 ||
            rect.bottom <= top ||
            rect.top >= bottom
          ) {
            return false;
          }
          return isBestFriendsPaintedPointBlocker(
            element,
            rect,
            x,
            y,
            left,
            width
          );
        });
        if (blocker) {
          return true;
        }
      }
    }
    return false;
  }

  function getBestFriendsObservedGeometrySignature(carousel, quickSettings) {
    const readSize = (element) => {
      const rect = element?.getBoundingClientRect?.();
      if (!rect) {
        return "none";
      }
      const width = Math.round(Math.max(0, rect.width || 0) * 10) / 10;
      const height = Math.round(Math.max(0, rect.height || 0) * 10) / 10;
      return `${width}x${height}`;
    };
    return `${readSize(carousel)}:${readSize(quickSettings)}`;
  }

  function observeBestFriendsGeometry(carousel) {
    if (typeof ResizeObserver !== "function") {
      return;
    }
    const quickSettings = carousel.querySelector(
      `:scope > [${QUICK_SETTINGS_ATTRIBUTE}]`
    );
    const committedGeometrySignature =
      getBestFriendsObservedGeometrySignature(carousel, quickSettings);
    if (
      observedBestFriendsGeometryCarousel === carousel &&
      observedBestFriendsGeometryQuickSettings === quickSettings
    ) {
      observedBestFriendsGeometrySignature = committedGeometrySignature;
      return;
    }
    bestFriendsGeometryObserver?.disconnect();
    observedBestFriendsGeometryCarousel = carousel;
    observedBestFriendsGeometryQuickSettings = quickSettings;
    observedBestFriendsGeometrySignature = committedGeometrySignature;
    if (!bestFriendsGeometryObserver) {
      bestFriendsGeometryObserver = new ResizeObserver((entries) => {
        if (
          entries.some(
            (entry) =>
              (entry.target === observedBestFriendsGeometryCarousel ||
                entry.target === observedBestFriendsGeometryQuickSettings) &&
              entry.target.isConnected
          )
        ) {
          const nextGeometrySignature =
            getBestFriendsObservedGeometrySignature(
              observedBestFriendsGeometryCarousel,
              observedBestFriendsGeometryQuickSettings
            );
          if (nextGeometrySignature === observedBestFriendsGeometrySignature) {
            return;
          }
          observedBestFriendsGeometrySignature = nextGeometrySignature;
          queueMount();
        }
      });
    }
    bestFriendsGeometryObserver.observe(carousel);
    if (quickSettings) {
      bestFriendsGeometryObserver.observe(quickSettings);
    }
  }

  function clearBestFriendsInitialLayoutRechecks() {
    for (const timer of bestFriendsInitialLayoutRecheckTimers) {
      window.clearTimeout(timer);
    }
    bestFriendsInitialLayoutRecheckTimers.clear();
  }

  function scheduleBestFriendsInitialLayoutRechecks(carousel) {
    clearBestFriendsInitialLayoutRechecks();
    for (const delay of BEST_FRIENDS_INITIAL_LAYOUT_RECHECK_DELAYS_MS) {
      const timer = window.setTimeout(() => {
        bestFriendsInitialLayoutRecheckTimers.delete(timer);
        if (
          isHomePage() &&
          carousel.isConnected &&
          document.querySelector(`[${BEST_FRIENDS_CAROUSEL_ATTRIBUTE}]`) ===
            carousel
        ) {
          queueMount();
        }
      }, delay);
      bestFriendsInitialLayoutRecheckTimers.add(timer);
    }
  }

  function hasOpenRoToolDialog() {
    return Boolean(document.querySelector(".rsl-dialog[open]"));
  }

  function clearBestFriendsPlacementStyles(carousel) {
    const placementProperties = [
      "--rsl-quick-settings-split-top",
      "--rsl-best-friends-header-width",
      "--rsl-best-friends-body-width",
      "padding-inline-end",
      "margin-bottom",
      "transform",
      "position",
      "visibility",
      "pointer-events",
      "width",
      "max-width",
      "height",
      "z-index",
      "inset",
      "top",
      "right",
      "bottom",
      "left"
    ];
    for (const property of placementProperties) {
      carousel.style.removeProperty(property);
    }
  }

  function placeBestFriendsCarousel(carousel, nativeCarousel) {
    const currentPlacement = carousel.dataset.rslBestFriendsPlacement || "";
    // A modal is rendered in Chromium's top layer, so elementsFromPoint() sees
    // the dialog instead of the Home content underneath it. Preserve an
    // established placement until the transient modal has closed.
    if (currentPlacement && hasOpenRoToolDialog()) {
      return;
    }
    const heading = findHomeHeading(nativeCarousel);
    const headingRect = heading?.getBoundingClientRect();
    let nativeRect = nativeCarousel.getBoundingClientRect();
    const overlayPlacementParts = currentPlacement.startsWith("overlay:")
      ? currentPlacement.split(":")
      : [];
    const splitPlacementParts = currentPlacement.startsWith("split:")
      ? currentPlacement.split(":")
      : [];
    const previousTranslateY = Number(overlayPlacementParts.at(-1)) || 0;
    const previousSplitTop = Number(splitPlacementParts.at(-1)) || 0;
    const isImmediatelyBefore =
      carousel.parentElement === nativeCarousel.parentElement &&
      carousel.nextElementSibling === nativeCarousel;
    const previousCarouselRect = carousel.getBoundingClientRect();
    const layoutBandTop = Math.min(
      headingRect?.top ?? nativeRect.top,
      nativeRect.top,
      previousCarouselRect.top
    );
    const layoutBandBottom = Math.max(
      nativeRect.bottom,
      previousCarouselRect.bottom
    );
    if (
      currentPlacement &&
      (Date.now() < bestFriendsScrollLockUntil ||
        layoutBandBottom <= 0 ||
        layoutBandTop >= window.innerHeight)
    ) {
      return;
    }
    // Measure established split layouts in their natural flow state. Removing
    // a class and restoring it in the same task does not paint an intermediate
    // frame, but it gives us authoritative margins and sibling positions.
    if (splitPlacementParts.length > 0) {
      carousel.classList.remove("rsl-best-friends-carousel--split");
      carousel.style.removeProperty("--rsl-quick-settings-split-top");
      nativeRect = nativeCarousel.getBoundingClientRect();
    }

    // Measure the combined Quick Settings + Best Friends stack only after it is
    // connected. A detached clone reports no useful height on its first pass.
    // Moving it only when needed also preserves controls during observer passes.
    if (!isImmediatelyBefore) {
      nativeCarousel.insertAdjacentElement("beforebegin", carousel);
    }
    const carouselRect = carousel.getBoundingClientRect();
    const hasBestFriendsRow = !Object.hasOwn(
      carousel.dataset,
      "rslBestFriendsDisabled"
    );
    const bestFriendsExpanded =
      hasBestFriendsRow &&
      !carousel.hasAttribute(BEST_FRIENDS_COLLAPSED_ATTRIBUTE);
    const minimumCarouselHeight = bestFriendsExpanded ? 120 : 0;
    const rowHeight = Math.max(
      minimumCarouselHeight,
      carouselRect.height || nativeRect.height || 0
    );
    const quickSettings = carousel.querySelector(
      `:scope > [${QUICK_SETTINGS_ATTRIBUTE}]`
    );
    const quickSettingsRect = quickSettings?.getBoundingClientRect();
    const currentTranslateY = overlayPlacementParts.length > 0
      ? previousTranslateY
      : 0;
    const naturalCarouselTop = carouselRect.top - currentTranslateY;
    const headingGap = 8;
    const targetTop = headingRect ? headingRect.bottom + headingGap : 0;
    const availableGap = headingRect
      ? naturalCarouselTop - headingRect.bottom
      : 0;
    const rootReusableHeight = headingRect
      ? Math.max(0, Math.min(rowHeight, availableGap - headingGap))
      : 0;
    const fallbackTranslateY = headingRect
      ? availableGap >= rowHeight + headingGap
        ? targetTop - naturalCarouselTop
        : -rootReusableHeight
      : 0;
    const hasQuickSettingsAnchor = Boolean(
      headingRect && quickSettingsRect?.height > 0
    );
    // Anchor every placement mode to the measured Quick Settings border box.
    // The cloned carousel root and an absolute child's containing block can be
    // a few pixels apart, so root-derived offsets visibly jump across modes.
    const candidateOffsetY = hasQuickSettingsAnchor
      ? targetTop - quickSettingsRect.top
      : fallbackTranslateY - currentTranslateY;
    const candidateTranslateY = currentTranslateY + candidateOffsetY;
    const candidateTop = carouselRect.top + candidateOffsetY;
    const reusableHeight = Math.max(
      0,
      Math.min(rowHeight, -candidateTranslateY)
    );
    const bestFriendsHeaderRect = hasBestFriendsRow
      ? carousel
          .querySelector(`:scope > [${BEST_FRIENDS_HEADER_ATTRIBUTE}]`)
          ?.getBoundingClientRect()
      : null;
    const bestFriendsBodyRect = bestFriendsExpanded
      ? carousel
          .querySelector(`[${BEST_FRIENDS_BODY_ATTRIBUTE}]`)
          ?.getBoundingClientRect()
      : null;
    const requiredQuickSettingsWidth = Math.min(
      nativeRect.width,
      Math.max(0, quickSettingsRect?.width || 0)
    );
    const getProjectedBandSafeWidth = (rect, probeWidth) => {
      if (!headingRect) return nativeRect.width;
      if (!rect || rect.height <= 0 || probeWidth <= 0) return null;
      return getBestFriendsOverlayWidth(
        nativeRect.left,
        rect.top + candidateOffsetY,
        probeWidth,
        rect.height,
        nativeCarousel,
        heading
      );
    };

    // Probe the actual projected bands instead of treating the entire stack as
    // one full-width rectangle. Expanded Quick Settings can sit in the free
    // left lane beside RoPro while the Best Friends row below stays full width.
    const quickSettingsSafeWidth = requiredQuickSettingsWidth > 0
      ? getProjectedBandSafeWidth(
          quickSettingsRect,
          requiredQuickSettingsWidth
        )
      : nativeRect.width;
    const bestFriendsHeaderSafeWidth = hasBestFriendsRow
      ? getProjectedBandSafeWidth(bestFriendsHeaderRect, nativeRect.width)
      : nativeRect.width;
    const bestFriendsBodySafeWidth = bestFriendsExpanded
      ? getProjectedBandSafeWidth(bestFriendsBodyRect, nativeRect.width)
      : nativeRect.width;
    const hasInterveningContent = headingRect
      ? hasBestFriendsInterveningContent(
          nativeRect.left,
          candidateTop,
          requiredQuickSettingsWidth || nativeRect.width,
          naturalCarouselTop - 4,
          carousel,
          nativeCarousel,
          heading
        )
      : false;
    const geometryIsUnknown =
      quickSettingsSafeWidth === null ||
      bestFriendsHeaderSafeWidth === null ||
      bestFriendsBodySafeWidth === null ||
      hasInterveningContent === null;
    if (geometryIsUnknown && currentPlacement) {
      if (splitPlacementParts.length > 0) {
        carousel.classList.add("rsl-best-friends-carousel--split");
        carousel.style.setProperty(
          "--rsl-quick-settings-split-top",
          `${previousSplitTop}px`
        );
      }
      return;
    }
    const quickSettingsBandFits =
      requiredQuickSettingsWidth <= 0 ||
      quickSettingsSafeWidth >= Math.max(0, requiredQuickSettingsWidth - 1);
    const bestFriendsHeaderBandFits =
      !hasBestFriendsRow ||
      bestFriendsHeaderSafeWidth >= Math.max(0, nativeRect.width - 1);
    const bestFriendsBodyBandFits =
      !bestFriendsExpanded ||
      bestFriendsBodySafeWidth >= Math.max(0, nativeRect.width - 1);
    const computedCarouselDirection =
      typeof getComputedStyle === "function"
        ? getComputedStyle(nativeCarousel).direction
        : "";
    const pageDirection = String(
      computedCarouselDirection ||
        document.documentElement?.dir ||
        document.body?.dir ||
        "ltr"
    ).toLowerCase();
    const laneDirectionIsSupported =
      pageDirection !== "rtl" || requiredQuickSettingsWidth <= 0;
    const canReuseGap =
      Boolean(headingRect) &&
      !geometryIsUnknown &&
      reusableHeight >= 8 &&
      (requiredQuickSettingsWidth > 0 || !hasBestFriendsRow) &&
      quickSettingsBandFits &&
      bestFriendsHeaderBandFits &&
      bestFriendsBodyBandFits &&
      laneDirectionIsSupported &&
      !hasInterveningContent;

    if (canReuseGap) {
      const renderedHeight = Math.max(
        minimumCarouselHeight,
        carousel.getBoundingClientRect().height || nativeRect.height || 0
      );
      const flowFootprint = Math.min(renderedHeight, reusableHeight);
      const translateY = Math.round(candidateTranslateY * 10) / 10;
      const roundedQuickSettingsSafeWidth =
        Math.round(quickSettingsSafeWidth * 10) / 10;
      const roundedHeaderSafeWidth =
        Math.round(bestFriendsHeaderSafeWidth * 10) / 10;
      const roundedBodySafeWidth =
        Math.round(bestFriendsBodySafeWidth * 10) / 10;
      const roundedHeight = Math.round(renderedHeight * 10) / 10;
      const roundedFootprint = Math.round(flowFootprint * 10) / 10;
      const placementKey =
        `overlay:${roundedQuickSettingsSafeWidth}:${roundedHeaderSafeWidth}:` +
        `${roundedBodySafeWidth}:` +
        `${roundedHeight}:${roundedFootprint}:${translateY}`;

      // Reassert every placement-owned property on each geometry pass. Other
      // extensions can rewrite inline layout without changing our signature.
      carousel.classList.remove("rsl-best-friends-carousel--split");
      carousel.style.removeProperty("--rsl-quick-settings-split-top");
      carousel.style.removeProperty("--rsl-best-friends-header-width");
      carousel.style.removeProperty("--rsl-best-friends-body-width");
      carousel.style.removeProperty("padding-inline-end");
      carousel.classList.add("rsl-best-friends-carousel--overlay");
      carousel.style.inset = "";
      carousel.style.top = "";
      carousel.style.right = "";
      carousel.style.bottom = "";
      carousel.style.left = "";
      carousel.style.position = "relative";
      carousel.style.visibility = "visible";
      carousel.style.pointerEvents = "none";
      carousel.style.width = "100%";
      carousel.style.maxWidth = "100%";
      carousel.style.height = "auto";
      carousel.style.setProperty(
        "margin-bottom",
        `-${roundedFootprint}px`,
        "important"
      );
      carousel.style.transform = `translateY(${translateY}px)`;
      carousel.style.zIndex = "1";
      carousel.dataset.rslBestFriendsFootprint = String(roundedFootprint);
      carousel.dataset.rslBestFriendsPlacement = placementKey;
      return;
    }

    // When only the Best Friends hitbox is obstructed, keep that row in its
    // full-width flow position and lift Quick Settings independently into the
    // clear header gap. Apply the candidate synchronously, then validate the
    // actual post-layout boxes before committing it.
    carousel.classList.remove("rsl-best-friends-carousel--overlay");
    clearBestFriendsPlacementStyles(carousel);
    delete carousel.dataset.rslBestFriendsFootprint;
    const canTrySplit = Boolean(
      hasBestFriendsRow &&
        headingRect &&
        quickSettings &&
        quickSettingsRect?.height > 0 &&
        requiredQuickSettingsWidth > 0 &&
        pageDirection !== "rtl"
    );
    if (canTrySplit) {
      carousel.classList.add("rsl-best-friends-carousel--split");
      // Resolve the absolute containing block's real origin first. Native
      // carousel styles can offset it from the root border box by a few pixels.
      carousel.style.setProperty(
        "--rsl-quick-settings-split-top",
        "0px"
      );
      const splitBaseQuickSettingsTop =
        quickSettings.getBoundingClientRect().top;
      const roundedSplitTop =
        Math.round((targetTop - splitBaseQuickSettingsTop) * 10) / 10;
      carousel.style.setProperty(
        "--rsl-quick-settings-split-top",
        `${roundedSplitTop}px`
      );

      const splitNativeRect = nativeCarousel.getBoundingClientRect();
      const splitQuickSettingsRect = quickSettings.getBoundingClientRect();
      const splitHeaderRect = carousel
        .querySelector(`:scope > [${BEST_FRIENDS_HEADER_ATTRIBUTE}]`)
        ?.getBoundingClientRect();
      const splitBodyRect = bestFriendsExpanded
        ? carousel
            .querySelector(`[${BEST_FRIENDS_BODY_ATTRIBUTE}]`)
            ?.getBoundingClientRect()
        : null;
      const splitQuickSettingsWidth = Math.min(
        splitNativeRect.width,
        Math.max(0, splitQuickSettingsRect.width || 0)
      );
      const splitQuickSettingsSafeWidth =
        splitQuickSettingsWidth > 0
          ? getBestFriendsOverlayWidth(
              splitNativeRect.left,
              splitQuickSettingsRect.top,
              splitQuickSettingsWidth,
              splitQuickSettingsRect.height,
              nativeCarousel,
              heading
            )
          : null;
      const splitHeaderSafeWidth = splitHeaderRect
        ? getBestFriendsOverlayWidth(
            splitNativeRect.left,
            splitHeaderRect.top,
            splitNativeRect.width,
            splitHeaderRect.height,
            nativeCarousel,
            heading
          )
        : null;
      const splitBodySafeWidth = bestFriendsExpanded && splitBodyRect
        ? getBestFriendsOverlayWidth(
            splitNativeRect.left,
            splitBodyRect.top,
            splitNativeRect.width,
            splitBodyRect.height,
            nativeCarousel,
            heading
          )
        : splitNativeRect.width;
      const firstBestFriendsTop = Math.min(
        splitHeaderRect?.top ?? Number.POSITIVE_INFINITY,
        bestFriendsExpanded
          ? splitBodyRect?.top ?? Number.POSITIVE_INFINITY
          : Number.POSITIVE_INFINITY
      );
      const splitHasInterveningContent = Number.isFinite(firstBestFriendsTop)
        ? hasBestFriendsInterveningContent(
            splitNativeRect.left,
            splitQuickSettingsRect.top,
            splitQuickSettingsWidth,
            firstBestFriendsTop - 4,
            carousel,
            nativeCarousel,
            heading
          )
        : null;
      const splitGeometryIsKnown =
        splitQuickSettingsSafeWidth !== null &&
        splitHeaderSafeWidth !== null &&
        (!bestFriendsExpanded || splitBodySafeWidth !== null) &&
        splitHasInterveningContent !== null;
      const splitFits =
        splitGeometryIsKnown &&
        splitQuickSettingsSafeWidth >=
          Math.max(0, splitQuickSettingsWidth - 1) &&
        splitHeaderSafeWidth >= Math.max(0, splitNativeRect.width - 1) &&
        (!bestFriendsExpanded ||
          splitBodySafeWidth >= Math.max(0, splitNativeRect.width - 1)) &&
        splitQuickSettingsRect.bottom + 12 <= firstBestFriendsTop &&
        !splitHasInterveningContent;
      if (splitFits) {
        const roundedSplitWidth =
          Math.round(splitQuickSettingsWidth * 10) / 10;
        const roundedSplitHeight =
          Math.round(splitQuickSettingsRect.height * 10) / 10;
        carousel.style.setProperty(
          "--rsl-quick-settings-split-top",
          `${roundedSplitTop}px`
        );
        carousel.dataset.rslBestFriendsPlacement =
          `split:${roundedSplitWidth}:${roundedSplitHeight}:` +
          `${roundedSplitTop}`;
        return;
      }

      if (splitPlacementParts.length > 0 && !splitGeometryIsKnown) {
        carousel.style.setProperty(
          "--rsl-quick-settings-split-top",
          `${previousSplitTop}px`
        );
        return;
      }
      carousel.classList.remove("rsl-best-friends-carousel--split");
      carousel.style.removeProperty("--rsl-quick-settings-split-top");
    }

    carousel.classList.remove("rsl-best-friends-carousel--split");
    clearBestFriendsPlacementStyles(carousel);
    carousel.dataset.rslBestFriendsPlacement = "flow";
  }

  function getBestFriendsPickerSearch() {
    return (
      document.querySelector(`#${BEST_FRIENDS_DIALOG_ID} [data-rsl-best-friends-search]`)
        ?.value || ""
    ).trim().toLowerCase().replace(/^@+/, "");
  }

  function renderBestFriendsPicker() {
    const dialog = document.getElementById(BEST_FRIENDS_DIALOG_ID);
    const list = dialog?.querySelector("[data-rsl-best-friends-picker-list]");
    const status = dialog?.querySelector("[data-rsl-best-friends-picker-status]");
    const save = dialog?.querySelector("[data-rsl-save-best-friends]");
    if (!dialog || !list || !status || !save) {
      return;
    }

    const query = getBestFriendsPickerSearch();
    const selectedOrder = new Map(
      Array.from(bestFriendsDraftIds, (userId, index) => [userId, index])
    );
    const visibleFriends = bestFriendsPickerFriends
      .filter((friend) =>
        !query || `${friend.displayName} ${friend.username}`.toLowerCase().includes(query)
      )
      .sort((left, right) => {
        const leftSelectedOrder = selectedOrder.get(left.userId);
        const rightSelectedOrder = selectedOrder.get(right.userId);
        const leftSelected = leftSelectedOrder !== undefined;
        const rightSelected = rightSelectedOrder !== undefined;
        if (leftSelected !== rightSelected) {
          return leftSelected ? -1 : 1;
        }
        if (leftSelected && rightSelected) {
          return leftSelectedOrder - rightSelectedOrder;
        }
        return left.displayName.localeCompare(right.displayName, undefined, {
          sensitivity: "base"
        });
      });
    status.textContent =
      bestFriendsPickerLoadState === "loading"
        ? "Loading all current friends..."
        : bestFriendsPickerLoadState === "error"
          ? "Your current friends could not be loaded."
          : `${bestFriendsDraftIds.size} selected`;
    save.disabled = bestFriendsPickerLoadState !== "ready";
    list.replaceChildren();

    if (bestFriendsPickerLoadState === "loading") {
      const loading = document.createElement("p");
      loading.className = "rsl-best-friends-picker__empty";
      loading.textContent = "Loading friends...";
      list.append(loading);
      return;
    }
    if (bestFriendsPickerLoadState === "error") {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "rsl-online-friends-retry";
      retry.textContent = "Retry";
      retry.addEventListener("click", () => void loadBestFriendsPickerFriends(true));
      list.append(retry);
      return;
    }
    if (visibleFriends.length === 0) {
      const empty = document.createElement("p");
      empty.className = "rsl-best-friends-picker__empty";
      empty.textContent = query ? "No friends match that search." : "No current friends found.";
      list.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const friend of visibleFriends) {
      const selected = bestFriendsDraftIds.has(friend.userId);
      const item = document.createElement("button");
      item.type = "button";
      item.className = "rsl-best-friends-picker__item";
      item.dataset.rslBestFriendsPickerId = friend.userId;
      item.setAttribute("aria-pressed", String(selected));
      item.setAttribute(
        "aria-label",
        `${selected ? "Remove" : "Add"} ${friend.displayName} ${selected ? "from" : "to"} Best Friends`
      );

      const image = document.createElement("img");
      image.className = "rsl-best-friends-picker__avatar";
      image.alt = "";
      image.loading = "lazy";
      image.referrerPolicy = "no-referrer";
      const imageFrame = document.createElement("span");
      imageFrame.className =
        "rsl-best-friends-picker__avatar-frame rsl-owned-thumbnail-frame";
      imageFrame.append(image);
      loadOwnedThumbnailImage(
        imageFrame,
        image,
        friend.headshotUrl,
        DEFAULT_AVATAR_URL
      );

      const names = document.createElement("span");
      names.className = "rsl-best-friends-picker__names";
      const displayNameLine = document.createElement("span");
      displayNameLine.className = "rsl-best-friends-picker__display-name-line";
      const displayName = document.createElement("strong");
      displayName.textContent = friend.displayName;
      const username = document.createElement("span");
      username.textContent = `@${friend.username}`;
      displayNameLine.append(displayName);
      appendFriendNameBadges(displayNameLine, friend);
      names.append(displayNameLine, username);

      const star = document.createElement("span");
      star.className = "rsl-best-friends-picker__star";
      star.setAttribute("aria-hidden", "true");
      star.textContent = selected ? "\u2605" : "\u2606";
      item.append(imageFrame, names, star);
      item.addEventListener("click", () => {
        if (bestFriendsDraftIds.has(friend.userId)) {
          bestFriendsDraftIds.delete(friend.userId);
        } else if (bestFriendsDraftIds.size < MAX_BEST_FRIENDS) {
          bestFriendsDraftIds.add(friend.userId);
        }
        renderBestFriendsPicker();
      });
      fragment.append(item);
    }
    list.append(fragment);
  }

  function rebuildBestFriendsPickerFromSnapshot() {
    const byId = new Map();
    for (const friend of [...allOnlineFriends, ...allOfflineFriends]) {
      byId.set(friend.userId, friend);
    }
    bestFriendsPickerFriends = Array.from(byId.values()).sort((left, right) =>
      left.displayName.localeCompare(right.displayName, undefined, {
        sensitivity: "base"
      })
    );
  }

  function refreshBestFriendsPickerAfterEnrichment(requestId, viewerUserId) {
    if (
      requestId !== bestFriendsPickerRequestId ||
      viewerUserId !== onlineFriendsViewerUserId
    ) {
      return;
    }
    rebuildBestFriendsPickerFromSnapshot();
    const dialog = document.getElementById(BEST_FRIENDS_DIALOG_ID);
    if (dialog?.open) {
      renderBestFriendsPicker();
    }
  }

  function loadBestFriendsPickerFriends(forceRefresh = false) {
    if (bestFriendsPickerPromise && !forceRefresh) {
      return bestFriendsPickerPromise;
    }

    const requestId = ++bestFriendsPickerRequestId;
    bestFriendsPickerLoadState = "loading";
    bestFriendsPickerErrorCode = "";
    renderBestFriendsPicker();
    const request = loadAllOnlineFriends(forceRefresh)
      .then(() => {
        if (requestId !== bestFriendsPickerRequestId) {
          return;
        }
        if (onlineFriendsLoadState === "error" || !onlineFriendsViewerUserId) {
          throw new Error(onlineFriendsErrorCode || "NETWORK");
        }
        if (
          bestFriendsViewerUserId &&
          bestFriendsViewerUserId !== onlineFriendsViewerUserId
        ) {
          bestFriendUserIds = [];
          bestFriendDetails = [];
          bestFriendsDraftIds = new Set();
        }
        bestFriendsViewerUserId = onlineFriendsViewerUserId;
        rebuildBestFriendsPickerFromSnapshot();
        bestFriendsPickerLoadState = "ready";
        bestFriendsPickerErrorCode = "";
        renderBestFriendsPicker();

        const viewerUserId = onlineFriendsViewerUserId;
        const detailRequests = [];
        if (onlineFriendsDetailsPromise) {
          detailRequests.push(onlineFriendsDetailsPromise);
        } else {
          detailRequests.push(
            loadOnlineFriendDetails(onlineFriendsRequestId, onlineFriendsViewerUserId)
          );
        }
        detailRequests.push(
          loadOfflineFriendDetails(onlineFriendsRequestId, onlineFriendsViewerUserId)
        );
        for (const detailRequest of detailRequests) {
          void Promise.resolve(detailRequest)
            .then(() => {
              refreshBestFriendsPickerAfterEnrichment(requestId, viewerUserId);
            })
            .catch(() => {
              // The base snapshot remains usable when decorative details fail.
            });
        }
      })
      .catch((error) => {
        if (requestId !== bestFriendsPickerRequestId) {
          return;
        }
        bestFriendsPickerLoadState = "error";
        bestFriendsPickerErrorCode = error?.message || "NETWORK";
      })
      .finally(() => {
        if (
          requestId === bestFriendsPickerRequestId &&
          bestFriendsPickerPromise === request
        ) {
          bestFriendsPickerPromise = null;
          renderBestFriendsPicker();
        }
      });
    bestFriendsPickerPromise = request;
    return request;
  }

  function createBestFriendsDialog() {
    const dialog = document.createElement("dialog");
    dialog.id = BEST_FRIENDS_DIALOG_ID;
    dialog.className =
      "rsl-dialog rsl-best-friends-dialog foundation-web-dialog-overlay padding-medium " +
      "foundation-web-portal-zindex bg-common-backdrop";
    dialog.setAttribute("aria-labelledby", "rsl-best-friends-dialog-title");
    dialog.setAttribute("aria-describedby", "rsl-best-friends-dialog-description");
    dialog.innerHTML = `
      <div class="rsl-dialog__surface rsl-best-friends-dialog__surface relative radius-large bg-surface-100 stroke-muted stroke-standard foundation-web-dialog-content shadow-transient-high" data-size="Medium">
        <div class="rsl-dialog__close-container absolute foundation-web-dialog-close-container">
          <button type="button" class="rsl-icon-button foundation-web-close-affordance" aria-label="Close" data-rsl-close-best-friends>
            <span aria-hidden="true" class="rsl-dialog__close-icon"></span>
          </button>
        </div>
        <div class="rsl-dialog__body rsl-best-friends-dialog__body">
          <div class="rsl-dialog__header">
            <h2 id="rsl-best-friends-dialog-title" class="content-emphasis text-title-large">Choose Best Friends</h2>
            <p id="rsl-best-friends-dialog-description" class="content-default text-body-medium">Choose people from your current Roblox friends.</p>
          </div>
          <label class="rsl-field rsl-best-friends-picker__search">
            <span class="rsl-sr-only">Search friends</span>
            <input type="search" placeholder="Search friends" autocomplete="off" data-rsl-best-friends-search>
          </label>
          <div class="rsl-best-friends-picker__status" aria-live="polite" data-rsl-best-friends-picker-status></div>
          <div class="rsl-best-friends-picker__list" role="list" data-rsl-best-friends-picker-list></div>
        </div>
        <div class="rsl-dialog__actions">
          <button type="button" class="rsl-button rsl-button--secondary" data-rsl-close-best-friends>Cancel</button>
          <button type="button" class="rsl-button rsl-button--primary" data-rsl-save-best-friends>Save</button>
        </div>
      </div>`;

    dialog.querySelectorAll("[data-rsl-close-best-friends]").forEach((button) => {
      button.addEventListener("click", () => dialog.close());
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        dialog.close();
      }
    });
    dialog.addEventListener("close", () => {
      bestFriendsDialogOpener?.focus?.({ preventScroll: true });
      bestFriendsDialogOpener = null;
      queueMount();
    });
    dialog.querySelector("[data-rsl-best-friends-search]")?.addEventListener(
      "input",
      renderBestFriendsPicker
    );
    dialog.querySelector("[data-rsl-save-best-friends]")?.addEventListener("click", async () => {
      if (!bestFriendsViewerUserId || bestFriendsPickerLoadState !== "ready") {
        return;
      }
      const orderedIds = [
        ...bestFriendUserIds.filter((userId) => bestFriendsDraftIds.has(userId)),
        ...bestFriendsPickerFriends
          .map((friend) => friend.userId)
          .filter(
            (userId) =>
              bestFriendsDraftIds.has(userId) && !bestFriendUserIds.includes(userId)
          )
      ].slice(0, MAX_BEST_FRIENDS);
      try {
        await persistBestFriendIds(bestFriendsViewerUserId, orderedIds);
        bestFriendUserIds = orderedIds;
        const detailsById = new Map(
          bestFriendsPickerFriends.map((friend) => [friend.userId, friend])
        );
        bestFriendDetails = orderedIds.map((userId) => detailsById.get(userId)).filter(Boolean);
        bestFriendsLoadState = "ready";
        dialog.close();
        queueMount();
        void loadBestFriendsContext(true);
      } catch {
        const status = dialog.querySelector("[data-rsl-best-friends-picker-status]");
        if (status) {
          status.textContent = "Best Friends could not be saved.";
        }
      }
    });
    document.body.append(dialog);
    return dialog;
  }

  function openBestFriendsDialog(opener) {
    if (!isHomePage()) {
      return;
    }
    let dialog = document.getElementById(BEST_FRIENDS_DIALOG_ID);
    if (!dialog) {
      dialog = createBestFriendsDialog();
    }

    const search = dialog.querySelector("[data-rsl-best-friends-search]");
    if (dialog.open) {
      search?.focus();
      return;
    }

    bestFriendsDialogOpener = opener || document.activeElement;
    bestFriendsDraftIds = new Set(bestFriendUserIds);
    if (search) {
      search.value = "";
    }
    renderBestFriendsPicker();
    dialog.showModal();
    search?.focus();
    void loadBestFriendsPickerFriends(false);
  }

  function cleanupQuickSettingsHome() {
    document
      .querySelectorAll(`[${QUICK_SETTINGS_ATTRIBUTE}]`)
      .forEach((section) => section.remove());
    const hadQuickSettingsState =
      quickSettingsRequestPromise ||
      quickSettingsViewerUserId ||
      quickSettingsLoadState !== "idle" ||
      quickSettingsPendingOperations.size > 0;
    if (!hadQuickSettingsState) {
      return;
    }
    quickSettingsLifecycleEpoch += 1;
    quickSettingsReadOperationId += 1;
    quickSettingsRequestPromise = null;
    quickSettingsViewerUserId = null;
    quickSettingsLoadState = "idle";
    quickSettingsValues = Object.create(null);
    quickSettingsErrorCode = "";
    quickSettingsNotice = "";
    quickSettingsFocusRestoreId = "";
    quickSettingsPendingOperations.clear();
  }

  function cleanupBestFriendsHome(preserveFriendData = false) {
    closeBestFriendHoverCard();
    clearBestFriendsInitialLayoutRechecks();
    bestFriendsGeometryObserver?.disconnect();
    observedBestFriendsGeometryCarousel = null;
    observedBestFriendsGeometryQuickSettings = null;
    observedBestFriendsGeometrySignature = "";
    bestFriendsScrollLockUntil = 0;
    window.clearTimeout(bestFriendsScrollSettleTimer);
    bestFriendsScrollSettleTimer = null;
    window.clearTimeout(bestFriendsHomeRefreshTimer);
    bestFriendsHomeRefreshTimer = null;
    document
      .querySelectorAll(`[${BEST_FRIENDS_CAROUSEL_ATTRIBUTE}]`)
      .forEach((carousel) => carousel.remove());

    const dialog = document.getElementById(BEST_FRIENDS_DIALOG_ID);
    if (dialog) {
      bestFriendsDialogOpener = null;
      if (dialog.open) {
        dialog.close();
      }
      dialog.remove();
    }

    const wasHomeActive = bestFriendsHomeActive;
    bestFriendsHomeActive = false;
    if (wasHomeActive) {
      bestFriendsPickerRequestId += 1;
      bestFriendsPickerPromise = null;
      bestFriendsPickerLoadState = "idle";
      bestFriendsPickerErrorCode = "";
      bestFriendsPickerFriends = [];
      bestFriendsDraftIds = new Set();
    }

    if (preserveFriendData) {
      return;
    }

    const hasBestFriendsState =
      wasHomeActive ||
      bestFriendsRequestPromise ||
      bestFriendsViewerUserId ||
      bestFriendUserIds.length > 0 ||
      bestFriendDetails.length > 0 ||
      bestFriendsLoadState !== "idle";
    if (!hasBestFriendsState) {
      return;
    }

    bestFriendsRequestId += 1;
    bestFriendsRequestPromise = null;
    bestFriendsViewerUserId = null;
    bestFriendsCanChat = false;
    bestFriendUserIds = [];
    bestFriendDetails = [];
    bestFriendsLoadState = "idle";
    bestFriendsErrorCode = "";
    bestFriendsFetchedAt = 0;
    bestFriendsLastRequestStartedAt = 0;
  }

  function mountBestFriendsCarousel() {
    const bestFriendsEnabled = isFeatureEnabled("bestFriends");
    const quickSettingsEnabled = getEnabledQuickSettingAliases().length > 0;
    if (!isHomePage() || (!bestFriendsEnabled && !quickSettingsEnabled)) {
      cleanupBestFriendsHome(isFriendsPage());
      cleanupQuickSettingsHome();
      return;
    }

    bestFriendsHomeActive = bestFriendsEnabled;
    const nativeCarousel = findNativeHomeFriendsCarousel();
    if (!nativeCarousel) {
      return;
    }
    const nativeList = getNativeHomeFriendList(nativeCarousel);
    if (!nativeList) {
      // Roblox can mount the Friends heading before its tile row. Preserve the
      // saved collapsed marker during that gap so the row cannot flash open
      // while the global mount observer waits for the remaining DOM.
      setHomeFriendsContentCollapsed(nativeCarousel, homeFriendsCollapsed);
      document
        .querySelectorAll(`[${BEST_FRIENDS_CAROUSEL_ATTRIBUTE}]`)
        .forEach((carousel) => carousel.remove());
      return;
    }
    if (quickSettingsEnabled && quickSettingsLoadState === "idle") {
      void loadQuickSettings(false);
    }
    if (bestFriendsEnabled && bestFriendsLoadState === "idle") {
      void loadBestFriendsContext(false);
    } else if (bestFriendsEnabled) {
      refreshBestFriendsHomeIfStale();
    }

    const mountedCarousels = Array.from(
      document.querySelectorAll(`[${BEST_FRIENDS_CAROUSEL_ATTRIBUTE}]`)
    );
    let carousel = mountedCarousels.shift() || null;
    mountedCarousels.forEach((duplicate) => duplicate.remove());
    if (carousel && !getNativeHomeFriendList(carousel)) {
      carousel.remove();
      carousel = null;
    }
    const createdCarousel = !carousel;
    if (createdCarousel) {
      carousel = makeBestFriendsCarousel(
        nativeCarousel,
        bestFriendsEnabled,
        quickSettingsEnabled
      );
    } else if (bestFriendsEnabled) {
      renderBestFriendsCarousel(carousel, nativeCarousel);
    }
    setBestFriendsHomeVisibility(carousel, bestFriendsEnabled);
    if (quickSettingsEnabled) {
      renderQuickSettings(carousel);
    } else {
      carousel
        .querySelector(`:scope > [${QUICK_SETTINGS_ATTRIBUTE}]`)
        ?.remove();
    }
    if (bestFriendsEnabled && !bestFriendsCollapsed) {
      // The native row is the authoritative tile-spacing template. Expose it
      // only around the synchronous measurement, and always restore the saved
      // state even if a third-party DOM mutation makes measurement fail.
      restoreHomeFriendsContentForMeasurement(nativeCarousel);
      try {
        syncBestFriendsTileSpacing(carousel, nativeCarousel);
      } finally {
        setHomeFriendsContentCollapsed(nativeCarousel, homeFriendsCollapsed);
      }
    } else if (bestFriendsEnabled) {
      setHomeFriendsContentCollapsed(nativeCarousel, homeFriendsCollapsed);
    }
    placeBestFriendsCarousel(carousel, nativeCarousel);
    if (createdCarousel) {
      scheduleBestFriendsInitialLayoutRechecks(carousel);
    }
    observeBestFriendsGeometry(carousel);
  }

  function normalizeQuickPlayPlaceId(rawValue) {
    const value = String(rawValue ?? "");
    if (!/^[1-9]\d{0,15}$/.test(value)) {
      return null;
    }
    const numericValue = Number(value);
    return Number.isSafeInteger(numericValue) && numericValue > 0 ? value : null;
  }

  function normalizeQuickPlayGameInstanceId(rawValue) {
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    )
      ? value
      : null;
  }

  function getQuickPlayPlaceId(link) {
    if (!link || link.localName !== "a") {
      return null;
    }
    let url;
    try {
      url = new URL(link.getAttribute("href") || "", window.location.origin);
    } catch {
      return null;
    }
    if (url.origin !== window.location.origin) {
      return null;
    }
    const segments = url.pathname.split("/").filter(Boolean);
    const gamesIndex = segments.findIndex((segment) => segment.toLowerCase() === "games");
    return gamesIndex >= 0
      ? normalizeQuickPlayPlaceId(segments[gamesIndex + 1])
      : null;
  }

  function findQuickPlayCardLink(thumbnail, root) {
    const candidates = [
      thumbnail.closest("a.game-card-link[href]"),
      thumbnail.closest("a[href]"),
      root.querySelector("a.game-card-link[href]"),
      root.querySelector('a[href*="/games/"]')
    ];
    return candidates.find((candidate) => getQuickPlayPlaceId(candidate)) || null;
  }

  function normalizeGameTileCcuPlaceId(rawValue) {
    const value = String(rawValue ?? "");
    if (!/^[1-9]\d{0,15}$/.test(value)) {
      return null;
    }
    const numericValue = Number(value);
    return Number.isSafeInteger(numericValue) && numericValue > 0 ? value : null;
  }

  function normalizeGameTileCcuUniverseId(rawValue) {
    const value = String(rawValue ?? "");
    return /^[1-9]\d{0,19}$/.test(value) ? value : null;
  }

  function getGameTileCcuLinkIdentity(link) {
    if (!link || link.localName !== "a") {
      return null;
    }
    let url;
    try {
      url = new URL(link.getAttribute("href") || "", window.location.origin);
    } catch {
      return null;
    }
    const hostname = url.hostname.toLowerCase();
    if (hostname !== "roblox.com" && !hostname.endsWith(".roblox.com")) {
      return null;
    }
    const segments = url.pathname.split("/").filter(Boolean);
    const gamesIndex = segments.findIndex((segment) => segment.toLowerCase() === "games");
    const placeId = gamesIndex >= 0
      ? normalizeGameTileCcuPlaceId(segments[gamesIndex + 1])
      : null;
    if (!placeId) {
      return null;
    }
    return {
      placeId,
      universeId: normalizeGameTileCcuUniverseId(url.searchParams.get("universeId"))
    };
  }

  function getGameTileCcuCardIdentity(root) {
    if (!root || root.isConnected === false || root.closest?.(".rsl-dialog")) {
      return null;
    }
    if (!root.matches?.(GAME_TILE_CCU_WIDE_CARD_SELECTOR)) {
      return null;
    }
    const candidates = [
      root.localName === "a" ? root : null,
      root.closest?.("a.game-card-link[href]"),
      root.closest?.('a[href*="/games/"]'),
      root.querySelector?.("a.game-card-link[href]"),
      root.querySelector?.('a[href*="/games/"]')
    ];
    for (const link of candidates) {
      const identity = getGameTileCcuLinkIdentity(link);
      if (!identity) {
        continue;
      }
      if (!identity.universeId) {
        const hoverUniverseId = normalizeGameTileCcuUniverseId(
          root.closest?.(".hover-game-tile[id]")?.id
        );
        if (hoverUniverseId) {
          identity.universeId = hoverUniverseId;
        }
      }
      return identity;
    }
    return null;
  }

  function getGameTileCcuOwnedRoot(node) {
    return node?.closest?.(GAME_TILE_CCU_WIDE_CARD_SELECTOR) || null;
  }

  function hasMeaningfulGameTileMetric(node) {
    const text = [
      node?.textContent,
      node?.getAttribute?.("aria-label"),
      node?.getAttribute?.("title")
    ].filter(Boolean).join(" ").trim();
    return /\p{Number}/u.test(text);
  }

  function findExternalGameTileCcu(root) {
    if (!root?.querySelectorAll) {
      return null;
    }
    const hasMeaningfulCount = (node) => {
      const text = [
        node?.textContent,
        node?.getAttribute?.("aria-label"),
        node?.getAttribute?.("title")
      ].filter(Boolean).join(" ").trim();
      return /\p{Number}/u.test(text);
    };
    const value = Array.from(
      root.querySelectorAll(
        `.playing-counts-label:not([${GAME_TILE_CCU_VALUE_ATTRIBUTE}])`
      )
    ).find(hasMeaningfulCount) || null;
    const icon = root.querySelector(
      `.icon-playing-counts-gray:not([${GAME_TILE_CCU_ICON_ATTRIBUTE}])`
    );
    if (value) {
      return { value, icon };
    }
    const companionValue = icon?.nextElementSibling || null;
    return icon &&
      companionValue &&
      companionValue.matches?.(".playing-counts-label, .info-label") &&
      !companionValue.hasAttribute(GAME_TILE_CCU_VALUE_ATTRIBUTE) &&
      !companionValue.hasAttribute(GAME_TILE_CCU_ICON_ATTRIBUTE) &&
      hasMeaningfulCount(companionValue)
      ? { value: companionValue, icon }
      : null;
  }

  function findExternalGameTileRating(root) {
    if (!root?.querySelectorAll) {
      return null;
    }
    return Array.from(
      root.querySelectorAll(
        `.vote-percentage-label:not([${GAME_TILE_RATING_VALUE_ATTRIBUTE}])`
      )
    ).find((node) => {
      const text = [
        node?.textContent,
        node?.getAttribute?.("aria-label"),
        node?.getAttribute?.("title")
      ].filter(Boolean).join(" ");
      return hasMeaningfulGameTileMetric(node) && text.includes("%");
    }) || null;
  }

  function normalizeSponsoredGameTileRatings(root) {
    if (!root?.querySelectorAll) {
      return null;
    }
    const sponsoredFooters = [
      ...(root.matches?.(GAME_TILE_SPONSORED_FOOTER_SELECTOR) ? [root] : []),
      ...Array.from(root.querySelectorAll(GAME_TILE_SPONSORED_FOOTER_SELECTOR))
    ].filter((footer) =>
      Array.from(footer.querySelectorAll?.(".sponsored-ad-label") || []).some(
        (label) => String(label.textContent || "").trim() === "Ad"
      )
    );
    const ratingLabels = new Set(
      Array.from(root.querySelectorAll(".vote-percentage-label")).filter(
        (label) => label.closest?.(".game-card-info")
      )
    );
    if (
      root.matches?.(".vote-percentage-label") &&
      root.closest?.(".game-card-info")
    ) {
      ratingLabels.add(root);
    }
    ratingLabels.forEach((label) => {
      // RoTool's own value already uses the compact visible text and keeps a
      // descriptive accessible label. Only normalize native/third-party text.
      if (label.hasAttribute(GAME_TILE_RATING_VALUE_ATTRIBUTE)) {
        return;
      }
      const currentText = String(label.textContent || "");
      const compactText = currentText.match(GAME_TILE_RATING_SUFFIX_PATTERN)?.[1] || "";
      if (compactText && compactText !== currentText) {
        label.setAttribute(
          SPONSORED_RATING_ORIGINAL_TEXT_ATTRIBUTE,
          currentText
        );
        label.textContent = compactText;
        if (label.hasAttribute(SPONSORED_RATING_ORIGINAL_ARIA_ATTRIBUTE)) {
          if (!label.getAttribute(SPONSORED_RATING_ORIGINAL_ARIA_ATTRIBUTE)) {
            label.setAttribute("aria-label", currentText.trim());
          }
        } else if (!label.hasAttribute("aria-label")) {
          // The vote icon is CSS-only, so preserve the meaning for assistive
          // technology even though the visible suffix is intentionally hidden.
          label.setAttribute(SPONSORED_RATING_ORIGINAL_ARIA_ATTRIBUTE, "");
          label.setAttribute("aria-label", currentText.trim());
        }
      } else if (label.hasAttribute(SPONSORED_RATING_ORIGINAL_TEXT_ATTRIBUTE)) {
        const expectedCompactText = String(
          label.getAttribute(SPONSORED_RATING_ORIGINAL_TEXT_ATTRIBUTE) || ""
        ).match(GAME_TILE_RATING_SUFFIX_PATTERN)?.[1] || "";
        if (currentText.trim() !== expectedCompactText) {
          label.removeAttribute(SPONSORED_RATING_ORIGINAL_TEXT_ATTRIBUTE);
          if (
            label.hasAttribute(SPONSORED_RATING_ORIGINAL_ARIA_ATTRIBUTE) &&
            !label.getAttribute(SPONSORED_RATING_ORIGINAL_ARIA_ATTRIBUTE)
          ) {
            label.removeAttribute("aria-label");
            label.removeAttribute(SPONSORED_RATING_ORIGINAL_ARIA_ATTRIBUTE);
          }
        }
      }
    });
    return sponsoredFooters.find(
      (footer) => footer.matches?.('[data-testid="wide-game-tile-sponsored-footer"]')
    ) || sponsoredFooters.find(
      (footer) => !footer.closest?.("[aria-hidden='true']")
    ) || sponsoredFooters[0] || null;
  }

  function restoreSponsoredGameTileRatings(root = document) {
    root?.querySelectorAll?.(
      `[${SPONSORED_RATING_ORIGINAL_TEXT_ATTRIBUTE}], ` +
        `[${SPONSORED_RATING_ORIGINAL_ARIA_ATTRIBUTE}], ` +
        `[${SPONSORED_RATING_ORIGINAL_TITLE_ATTRIBUTE}]`
    ).forEach((label) => {
      if (label.hasAttribute(SPONSORED_RATING_ORIGINAL_TEXT_ATTRIBUTE)) {
        label.textContent = label.getAttribute(
          SPONSORED_RATING_ORIGINAL_TEXT_ATTRIBUTE
        ) || "";
        label.removeAttribute(SPONSORED_RATING_ORIGINAL_TEXT_ATTRIBUTE);
      }
      if (label.hasAttribute(SPONSORED_RATING_ORIGINAL_ARIA_ATTRIBUTE)) {
        const originalAria = label.getAttribute(
          SPONSORED_RATING_ORIGINAL_ARIA_ATTRIBUTE
        ) || "";
        if (originalAria) {
          label.setAttribute("aria-label", originalAria);
        } else {
          label.removeAttribute("aria-label");
        }
        label.removeAttribute(SPONSORED_RATING_ORIGINAL_ARIA_ATTRIBUTE);
      }
      if (label.hasAttribute(SPONSORED_RATING_ORIGINAL_TITLE_ATTRIBUTE)) {
        label.setAttribute(
          "title",
          label.getAttribute(SPONSORED_RATING_ORIGINAL_TITLE_ATTRIBUTE) || ""
        );
        label.removeAttribute(SPONSORED_RATING_ORIGINAL_TITLE_ATTRIBUTE);
      }
    });
  }

  function syncExternalGameTileCcuState(root) {
    const external = findExternalGameTileCcu(root);
    if (external) {
      root?.setAttribute?.(GAME_TILE_CCU_EXTERNAL_ATTRIBUTE, "");
    } else {
      root?.removeAttribute?.(GAME_TILE_CCU_EXTERNAL_ATTRIBUTE);
    }
    return external;
  }

  function syncExternalGameTileRatingState(root) {
    const external = findExternalGameTileRating(root);
    if (external) {
      root?.setAttribute?.(GAME_TILE_RATING_EXTERNAL_ATTRIBUTE, "");
    } else {
      root?.removeAttribute?.(GAME_TILE_RATING_EXTERNAL_ATTRIBUTE);
    }
    return external;
  }

  function needsGameTileRating(root) {
    normalizeSponsoredGameTileRatings(root);
    return Boolean(
      root?.querySelector?.(".info-metadata-container") &&
      !findExternalGameTileRating(root)
    );
  }

  function removeOwnedGameTileCcu(root) {
    if (!root?.querySelectorAll) {
      return;
    }
    root.querySelectorAll(`[${GAME_TILE_CCU_CONTAINER_ATTRIBUTE}]`).forEach(
      (container) => container.remove()
    );
    root
      .querySelectorAll(
        `[${GAME_TILE_CCU_ATTRIBUTE}], ` +
          `[${GAME_TILE_CCU_ICON_ATTRIBUTE}], ` +
          `[${GAME_TILE_CCU_VALUE_ATTRIBUTE}], ` +
          `[${GAME_TILE_RATING_ICON_ATTRIBUTE}], ` +
          `[${GAME_TILE_RATING_VALUE_ATTRIBUTE}]`
      )
      .forEach((node) => node.remove());
  }

  function removeEmptyGameTileMetricsContainers(root) {
    root?.querySelectorAll?.(`[${GAME_TILE_CCU_CONTAINER_ATTRIBUTE}]`).forEach(
      (container) => {
        if (!container.querySelector(
          `[${GAME_TILE_CCU_ICON_ATTRIBUTE}], ` +
            `[${GAME_TILE_CCU_VALUE_ATTRIBUTE}], ` +
            `[${GAME_TILE_RATING_ICON_ATTRIBUTE}], ` +
            `[${GAME_TILE_RATING_VALUE_ATTRIBUTE}]`
        )) {
          container.remove();
        }
      }
    );
  }

  function removeOwnedGameTileCcuCount(root) {
    root?.querySelectorAll?.(
      `[${GAME_TILE_CCU_ICON_ATTRIBUTE}], ` +
        `[${GAME_TILE_CCU_VALUE_ATTRIBUTE}]`
    ).forEach((node) => node.remove());
    removeEmptyGameTileMetricsContainers(root);
  }

  function removeOwnedGameTileRating(root) {
    root?.querySelectorAll?.(
      `[${GAME_TILE_RATING_ICON_ATTRIBUTE}], ` +
        `[${GAME_TILE_RATING_VALUE_ATTRIBUTE}]`
    ).forEach((node) => node.remove());
    removeEmptyGameTileMetricsContainers(root);
  }

  function forgetGameTileCcuRoot(root) {
    gameTileCcuIdentityByRoot.delete(root);
    for (const [placeId, queued] of gameTileCcuQueuedByPlaceId) {
      queued.roots.delete(root);
      if (queued.roots.size === 0) {
        gameTileCcuQueuedByPlaceId.delete(placeId);
      }
    }
  }

  function isCurrentGameTileCcuRoot(
    root,
    expectedPlaceId,
    expectedUniverseId = undefined
  ) {
    const identity = getGameTileCcuCardIdentity(root);
    return Boolean(
      identity &&
      identity.placeId === expectedPlaceId &&
      (expectedUniverseId === undefined || identity.universeId === expectedUniverseId)
    );
  }

  function formatGameTileCcuCompactCount(playing) {
    try {
      return new Intl.NumberFormat("en-US", {
        notation: "compact",
        compactDisplay: "short",
        maximumFractionDigits: 1,
        useGrouping: false
      }).format(playing).replace(/\s+/g, "");
    } catch {
      if (playing < 1_000) {
        return String(playing);
      }
      const units = [
        [1_000_000_000_000, "T"],
        [1_000_000_000, "B"],
        [1_000_000, "M"],
        [1_000, "K"]
      ];
      const [divisor, suffix] = units.find(([value]) => playing >= value) ||
        units[units.length - 1];
      const rounded = Math.round((playing / divisor) * 10) / 10;
      return `${rounded.toFixed(1).replace(/\.0$/, "")}${suffix}`;
    }
  }

  function getGameTileCcuGraphRoot(node) {
    const root = node?.closest?.(GAME_TILE_CCU_GRAPH_CARD_SELECTOR) || null;
    return root && !root.closest?.(".rsl-dialog") ? root : null;
  }

  function getGameTileCcuGraphIdentity(root) {
    if (!root || root.isConnected === false) {
      return null;
    }
    const candidates = [
      root.localName === "a" ? root : null,
      root.closest?.("a.game-card-link[href]"),
      root.closest?.('a[href*="/games/"]'),
      root.querySelector?.("a.game-card-link[href]"),
      root.querySelector?.('a[href*="/games/"]')
    ];
    let identity = null;
    for (const link of candidates) {
      identity = getGameTileCcuLinkIdentity(link);
      if (identity) {
        if (!identity.universeId) {
          identity.universeId = normalizeGameTileCcuUniverseId(link?.id);
        }
        break;
      }
    }
    if (!identity) {
      return null;
    }
    if (!identity.universeId) {
      identity.universeId = normalizeGameTileCcuUniverseId(
        root.closest?.(".hover-game-tile[id]")?.id
      );
    }
    if (!identity.universeId) {
      const expectedIdentity = gameTileCcuIdentityByRoot.get(root);
      const cached = gameTileCcuCacheByPlaceId.get(identity.placeId);
      identity.universeId = normalizeGameTileCcuUniverseId(
        expectedIdentity?.universeId ||
          cached?.universeId ||
          gameTileCcuGraphUniverseByPlaceId.get(identity.placeId)
      );
    }
    return identity;
  }

  function findGameTileCcuGraphThumbnail(root) {
    if (!root?.querySelectorAll) {
      return null;
    }
    return Array.from(
      root.querySelectorAll(GAME_TILE_CCU_GRAPH_THUMBNAIL_SELECTOR)
    ).find((thumbnail) => getGameTileCcuGraphRoot(thumbnail) === root) || null;
  }

  function getGameTileCcuGraphTrigger(node) {
    const direct = node?.closest?.(
      `[${GAME_TILE_CCU_GRAPH_TRIGGER_ATTRIBUTE}]`
    );
    if (direct) {
      return direct;
    }
    const playingIcon = node?.closest?.(".icon-playing-counts-gray");
    if (!playingIcon) {
      return null;
    }
    const companion = playingIcon.nextElementSibling;
    if (companion?.hasAttribute?.(GAME_TILE_CCU_GRAPH_TRIGGER_ATTRIBUTE)) {
      return companion;
    }
    return playingIcon.parentElement?.querySelector?.(
      `[${GAME_TILE_CCU_GRAPH_TRIGGER_ATTRIBUTE}]`
    ) || null;
  }

  function getGameTileCcuGraphFocusTrigger(node) {
    const direct = getGameTileCcuGraphTrigger(node);
    if (direct) {
      return direct;
    }
    const root = getGameTileCcuGraphRoot(node);
    if (!root) {
      return null;
    }
    const gameLink = node?.closest?.(
      'a.game-card-link[href], a[href*="/games/"]'
    );
    const rootIsFocusTarget = node === root && root.hasAttribute?.("tabindex");
    if (!gameLink && !rootIsFocusTarget) {
      return null;
    }
    return Array.from(
      root.querySelectorAll?.(`[${GAME_TILE_CCU_GRAPH_TRIGGER_ATTRIBUTE}]`) || []
    ).find(isUsableGameTileCcuGraphTrigger) || null;
  }

  function isUsableGameTileCcuGraphTrigger(metric) {
    if (!isFeatureEnabled("gameCcuHoverGraph")) {
      return false;
    }
    const root = getGameTileCcuGraphRoot(metric);
    const ariaHiddenAncestor = metric?.closest?.('[aria-hidden="true"]');
    const hiddenOnlyByCardLink = Boolean(
      ariaHiddenAncestor?.matches?.(
        'a.game-card-link[href], a[href*="/games/"]'
      ) && getGameTileCcuGraphRoot(ariaHiddenAncestor) === root
    );
    const metricText = [
      metric?.textContent,
      metric?.getAttribute?.("aria-label"),
      metric?.getAttribute?.("title")
    ].filter(Boolean).join(" ");
    return Boolean(
      metric?.matches?.(".playing-counts-label") &&
      metric.isConnected !== false &&
      !metric.hidden &&
      !metric.closest?.("[hidden]") &&
      (!ariaHiddenAncestor || hiddenOnlyByCardLink) &&
      hasMeaningfulGameTileMetric(metric) &&
      !/[%\uFF05]/u.test(metricText) &&
      root &&
      getGameTileCcuGraphIdentity(root) &&
      findGameTileCcuGraphThumbnail(root)
    );
  }

  function restoreGameTileCcuGraphTrigger(metric) {
    if (!metric?.removeAttribute) {
      return;
    }
    if (metric.hasAttribute(GAME_TILE_CCU_GRAPH_TABINDEX_ATTRIBUTE)) {
      metric.removeAttribute("tabindex");
      metric.removeAttribute(GAME_TILE_CCU_GRAPH_TABINDEX_ATTRIBUTE);
    }
    metric.removeAttribute(GAME_TILE_CCU_GRAPH_TRIGGER_ATTRIBUTE);
  }

  function mountGameTileCcuGraphTriggers() {
    if (!isFeatureEnabled("gameCcuHoverGraph")) {
      if (
        gameTileCcuGraphEventsBound ||
        activeGameTileCcuGraph ||
        gameTileCcuGraphHoverIntent
      ) {
        cleanupGameTileCcuGraphDisplay();
      }
      return;
    }
    ensureGameTileCcuGraphEvents();
    const usableMetrics = new Set();
    document.querySelectorAll(".playing-counts-label").forEach((metric) => {
      if (!isUsableGameTileCcuGraphTrigger(metric)) {
        restoreGameTileCcuGraphTrigger(metric);
        return;
      }
      usableMetrics.add(metric);
      metric.setAttribute(GAME_TILE_CCU_GRAPH_TRIGGER_ATTRIBUTE, "");
      const owningCardControl = metric.closest?.(
        'a[href], button, [role="link"], [role="button"], [tabindex]'
      );
      if (!metric.hasAttribute("tabindex") && !owningCardControl) {
        metric.setAttribute("tabindex", "0");
        metric.setAttribute(GAME_TILE_CCU_GRAPH_TABINDEX_ATTRIBUTE, "");
      }
    });
    document
      .querySelectorAll(`[${GAME_TILE_CCU_GRAPH_TRIGGER_ATTRIBUTE}]`)
      .forEach((metric) => {
        if (!usableMetrics.has(metric)) {
          restoreGameTileCcuGraphTrigger(metric);
        }
      });
    validateActiveGameTileCcuGraph();
  }

  function normalizeGameTileCcuHistoryPoints(rawPoints) {
    if (!Array.isArray(rawPoints)) {
      return [];
    }
    const pointsByTimestamp = new Map();
    rawPoints.forEach((point) => {
      const timestamp = point?.timestamp;
      const playing = point?.playing;
      if (
        Number.isSafeInteger(timestamp) &&
        timestamp > 0 &&
        Number.isSafeInteger(playing) &&
        playing >= 0
      ) {
        pointsByTimestamp.set(timestamp, { timestamp, playing });
      }
    });
    return Array.from(pointsByTimestamp.values())
      .sort((left, right) => left.timestamp - right.timestamp)
      .slice(-GAME_TILE_CCU_GRAPH_MAX_POINTS);
  }

  function getCachedGameTileCcuHistory(universeId, now = Date.now()) {
    const cached = gameTileCcuGraphHistoryCache.get(universeId);
    if (!cached || cached.expiresAt <= now) {
      gameTileCcuGraphHistoryCache.delete(universeId);
      return null;
    }
    gameTileCcuGraphHistoryCache.delete(universeId);
    gameTileCcuGraphHistoryCache.set(universeId, cached);
    return cached.history;
  }

  function setCachedGameTileCcuHistory(universeId, history) {
    gameTileCcuGraphHistoryCache.delete(universeId);
    // A retained seven-day payload can still be empty in the visible twelve-hour
    // window. Do not let that foreground-negative result hide a new snapshot.
    const currentBucketTimestamp = Math.floor(
      Date.now() / GAME_TILE_CCU_GRAPH_BUCKET_MS
    ) * GAME_TILE_CCU_GRAPH_BUCKET_MS;
    const minimumWindowTimestamp = currentBucketTimestamp -
      GAME_TILE_CCU_GRAPH_WINDOW_MS;
    const hasVisiblePoint = Array.isArray(history?.points) &&
      history.points.some((point) =>
        Number.isSafeInteger(point?.timestamp) &&
        point.timestamp >= minimumWindowTimestamp &&
        point.timestamp <= currentBucketTimestamp
      );
    if (!hasVisiblePoint) {
      return false;
    }
    gameTileCcuGraphHistoryCache.set(universeId, {
      history,
      expiresAt: Date.now() + GAME_TILE_CCU_GRAPH_CACHE_TTL_MS
    });
    while (
      gameTileCcuGraphHistoryCache.size > GAME_TILE_CCU_GRAPH_CACHE_MAX_ENTRIES
    ) {
      gameTileCcuGraphHistoryCache.delete(
        gameTileCcuGraphHistoryCache.keys().next().value
      );
    }
    return true;
  }

  function requestGameTileCcuHistory(
    universeId,
    { bypassCache = false, placeId = null } = {}
  ) {
    universeId = normalizeGameTileCcuUniverseId(universeId);
    placeId = normalizeGameTileCcuPlaceId(placeId);
    if (!universeId && !placeId) {
      return Promise.reject(new Error("missing-identity"));
    }
    if (!bypassCache) {
      const cached = universeId
        ? getCachedGameTileCcuHistory(universeId)
        : null;
      if (cached) {
        return Promise.resolve({ ...cached, universeId });
      }
    }
    const requestKey = universeId ? `u:${universeId}` : `p:${placeId}`;
    const pending = gameTileCcuGraphHistoryRequests.get(requestKey);
    if (pending) {
      return pending;
    }
    gameTileCcuGraphRequestId = gameTileCcuGraphRequestId >= Number.MAX_SAFE_INTEGER
      ? 1
      : gameTileCcuGraphRequestId + 1;
    const requestId = gameTileCcuGraphRequestId;
    const lifecycleEpoch = gameTileCcuGraphLifecycleEpoch;
    const request = new Promise((resolve, reject) => {
      try {
        const message = {
          type: GAME_TILE_CCU_HISTORY_MESSAGE_TYPE,
          requestId,
          ...(universeId ? { universeId } : { placeId })
        };
        chrome.runtime.sendMessage(
          message,
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error("runtime-error"));
              return;
            }
            if (lifecycleEpoch !== gameTileCcuGraphLifecycleEpoch) {
              reject(new Error("stale-lifecycle"));
              return;
            }
            if (
              !response?.ok ||
              response.requestId !== requestId ||
              !normalizeGameTileCcuUniverseId(response.universeId) ||
              (universeId &&
                normalizeGameTileCcuUniverseId(response.universeId) !== universeId) ||
              !Array.isArray(response.points)
            ) {
              reject(new Error("invalid-response"));
              return;
            }
            const resolvedUniverseId = normalizeGameTileCcuUniverseId(
              response.universeId
            );
            const points = normalizeGameTileCcuHistoryPoints(response.points);
            const history = {
              universeId: resolvedUniverseId,
              points,
              tracked: response.tracked === true
                ? true
                : response.tracked === false
                  ? false
                  : points.length > 0
                    ? true
                    : null
            };
            if (placeId) {
              gameTileCcuGraphUniverseByPlaceId.delete(placeId);
              gameTileCcuGraphUniverseByPlaceId.set(placeId, resolvedUniverseId);
              while (
                gameTileCcuGraphUniverseByPlaceId.size >
                GAME_TILE_CCU_CACHE_MAX_ENTRIES
              ) {
                gameTileCcuGraphUniverseByPlaceId.delete(
                  gameTileCcuGraphUniverseByPlaceId.keys().next().value
                );
              }
            }
            setCachedGameTileCcuHistory(resolvedUniverseId, history);
            resolve(history);
          }
        );
      } catch {
        reject(new Error("runtime-error"));
      }
    });
    gameTileCcuGraphHistoryRequests.set(requestKey, request);
    void request.finally(() => {
      if (gameTileCcuGraphHistoryRequests.get(requestKey) === request) {
        gameTileCcuGraphHistoryRequests.delete(requestKey);
      }
    }).catch(() => {});
    return request;
  }

  function clearGameTileCcuGraphOverlay(overlay) {
    Array.from(overlay?.children || []).forEach((child) => child.remove());
    if (overlay) {
      overlay.textContent = "";
    }
  }

  function makeGameTileCcuGraphElement(tagName, className, text = "") {
    const element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (text) {
      element.textContent = text;
    }
    return element;
  }

  function makeGameTileCcuGraphSvgElement(tagName) {
    return typeof document.createElementNS === "function"
      ? document.createElementNS("http://www.w3.org/2000/svg", tagName)
      : document.createElement(tagName);
  }

  function findNearestGameTileCcuGraphPoint(points, timestamp) {
    if (!Array.isArray(points) || points.length === 0) {
      return { point: null, index: -1 };
    }
    let low = 0;
    let high = points.length - 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (points[middle].timestamp < timestamp) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    const rightIndex = low;
    const leftIndex = Math.max(0, rightIndex - 1);
    const index = Math.abs(points[leftIndex].timestamp - timestamp) <=
      Math.abs(points[rightIndex].timestamp - timestamp)
      ? leftIndex
      : rightIndex;
    return { point: points[index], index };
  }

  function hideGameTileCcuGraphPoint(interaction) {
    const model = gameTileCcuGraphInteractionModels.get(interaction);
    if (!model) {
      return false;
    }
    model.crosshair.hidden = true;
    interaction.removeAttribute("data-point-active");
    interaction.removeAttribute("data-gap-active");
    return true;
  }

  function showGameTileCcuGraphGapPoint(interaction, timestamp) {
    const model = gameTileCcuGraphInteractionModels.get(interaction);
    if (!model || model.points.length === 0) {
      return false;
    }
    const bucketTimestamp = Math.max(
      model.minimumTimestamp,
      Math.min(
        model.maximumTimestamp,
        Math.round(timestamp / GAME_TILE_CCU_GRAPH_BUCKET_MS) *
          GAME_TILE_CCU_GRAPH_BUCKET_MS
      )
    );
    const storedIndex = model.points.findIndex(
      (point) => point.timestamp === bucketTimestamp
    );
    // A half-bucket gap boundary can round onto a real observation. Prefer the
    // saved point so a stored bucket is never announced as missing data.
    if (storedIndex >= 0) {
      return showGameTileCcuGraphPoint(interaction, storedIndex);
    }
    const nearestIndex = findNearestGameTileCcuGraphPoint(
      model.points,
      bucketTimestamp
    ).index;
    const date = new Date(bucketTimestamp);
    const xPercent = (model.xFor(bucketTimestamp) / 300) * 100;
    model.crosshair.style.setProperty("--rsl-game-ccu-point-x", `${xPercent}%`);
    model.crosshair.toggleAttribute("data-tooltip-left", xPercent >= 50);
    model.crosshair.setAttribute("data-no-observation", "");
    model.crosshair.hidden = false;
    model.point.hidden = true;
    model.time.textContent = date.toLocaleString();
    model.time.setAttribute("datetime", date.toISOString());
    model.count.textContent = "No saved data";
    interaction.removeAttribute("data-point-active");
    interaction.setAttribute("data-gap-active", "");
    interaction.setAttribute("aria-valuenow", String(nearestIndex));
    interaction.setAttribute(
      "aria-valuetext",
      `No saved Chart CCU observation at ${date.toLocaleString()}`
    );
    interaction.closest?.(`[${GAME_TILE_CCU_GRAPH_OVERLAY_ATTRIBUTE}]`)
      ?.removeAttribute("data-point-index");
    if (activeGameTileCcuGraph?.overlay?.contains?.(interaction)) {
      activeGameTileCcuGraph.selectedPointIndex = null;
      activeGameTileCcuGraph.selectedPointTimestamp = null;
      activeGameTileCcuGraph.selectedGapTimestamp = bucketTimestamp;
    }
    model.selectedIndex = nearestIndex;
    return true;
  }

  function showGameTileCcuGraphPoint(interaction, index) {
    const model = gameTileCcuGraphInteractionModels.get(interaction);
    if (!model || model.points.length === 0) {
      return false;
    }
    const boundedIndex = Math.max(0, Math.min(model.points.length - 1, index));
    const point = model.points[boundedIndex];
    const xPercent = (model.xFor(point.timestamp) / 300) * 100;
    const yPercent = (model.yFor(point.playing) / 100) * 100;
    const exactCount = formatGameTileCcuGraphExactCount(point.playing);
    const date = new Date(point.timestamp);
    const pointLabel = `${exactCount} CCU at ${date.toLocaleString()}`;
    model.crosshair.style.setProperty("--rsl-game-ccu-point-x", `${xPercent}%`);
    model.crosshair.style.setProperty("--rsl-game-ccu-point-y", `${yPercent}%`);
    model.crosshair.toggleAttribute("data-tooltip-left", xPercent >= 50);
    model.crosshair.removeAttribute("data-no-observation");
    model.crosshair.hidden = false;
    model.point.hidden = false;
    model.time.textContent = date.toLocaleString();
    model.time.setAttribute("datetime", date.toISOString());
    model.count.textContent = `${exactCount} CCU`;
    interaction.setAttribute("data-point-active", "");
    interaction.removeAttribute("data-gap-active");
    interaction.setAttribute("data-point-index", String(boundedIndex));
    interaction.setAttribute("aria-valuenow", String(boundedIndex));
    interaction.setAttribute("aria-valuetext", pointLabel);
    interaction.closest?.(`[${GAME_TILE_CCU_GRAPH_OVERLAY_ATTRIBUTE}]`)
      ?.setAttribute("data-point-index", String(boundedIndex));
    if (activeGameTileCcuGraph?.overlay?.contains?.(interaction)) {
      activeGameTileCcuGraph.selectedPointIndex = boundedIndex;
      activeGameTileCcuGraph.selectedPointTimestamp = point.timestamp;
      activeGameTileCcuGraph.selectedGapTimestamp = null;
    }
    model.selectedIndex = boundedIndex;
    return true;
  }

  function handleGameTileCcuGraphInteractionPointerMove(event) {
    const interaction = event.currentTarget;
    const model = gameTileCcuGraphInteractionModels.get(interaction);
    if (!model || model.points.length === 0) {
      return;
    }
    const rect = interaction.getBoundingClientRect();
    const width = Math.max(1, rect.width || interaction.clientWidth || 1);
    const clientX = Number.isFinite(event.clientX) ? event.clientX : rect.left;
    const rawRatio = Math.max(0, Math.min(1, (clientX - rect.left) / width));
    const ratio = Math.max(0, Math.min(1, (rawRatio * 300 - 8) / 284));
    const timestamp = model.minimumTimestamp +
      ratio * (model.maximumTimestamp - model.minimumTimestamp);
    if (model.gapIntervals.some((gap) =>
      timestamp >= gap.start && timestamp <= gap.end
    )) {
      showGameTileCcuGraphGapPoint(interaction, timestamp);
      return;
    }
    const nearest = findNearestGameTileCcuGraphPoint(model.points, timestamp);
    showGameTileCcuGraphPoint(interaction, nearest.index);
  }

  function handleGameTileCcuGraphInteractionPointerLeave(event) {
    const interaction = event.currentTarget;
    if (document.activeElement !== interaction) {
      hideGameTileCcuGraphPoint(interaction);
    }
  }

  function handleGameTileCcuGraphInteractionFocus(event) {
    const interaction = event.currentTarget;
    const model = gameTileCcuGraphInteractionModels.get(interaction);
    if (model?.points.length) {
      showGameTileCcuGraphPoint(
        interaction,
        model.selectedIndex >= 0
          ? model.selectedIndex
          : model.points.length - 1
      );
    }
  }

  function handleGameTileCcuGraphInteractionBlur(event) {
    const interaction = event.currentTarget;
    queueMicrotask(() => {
      if (document.activeElement !== interaction) {
        hideGameTileCcuGraphPoint(interaction);
      }
    });
  }

  function handleGameTileCcuGraphInteractionKeyDown(event) {
    const interaction = event.currentTarget;
    const model = gameTileCcuGraphInteractionModels.get(interaction);
    if (!model?.points.length) {
      return;
    }
    const currentIndex = model.selectedIndex >= 0
      ? model.selectedIndex
      : model.points.length - 1;
    let nextIndex = currentIndex;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      nextIndex -= 1;
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      nextIndex += 1;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = model.points.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    showGameTileCcuGraphPoint(interaction, nextIndex);
  }

  function formatGameTileCcuGraphExactCount(playing) {
    return String(Math.max(0, Math.round(playing))).replace(
      /\B(?=(\d{3})+(?!\d))/g,
      "."
    );
  }

  function formatGameTileCcuGraphAxisCount(value, precision = null) {
    const roundedValue = Math.max(0, Math.round(value));
    if (roundedValue < 1_000) {
      return String(roundedValue);
    }
    const units = [
      [1_000_000_000_000, "T"],
      [1_000_000_000, "B"],
      [1_000_000, "M"],
      [1_000, "K"]
    ];
    const [divisor, suffix] = units.find(([minimum]) =>
      roundedValue >= minimum
    ) || units[units.length - 1];
    const scaled = roundedValue / divisor;
    const decimals = precision === null
      ? scaled >= 100
        ? 0
        : 1
      : precision;
    try {
      return `${new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals
      }).format(scaled)}${suffix}`;
    } catch {
      return `${scaled.toFixed(decimals).replace(/\.0+$/, "")}${suffix}`;
    }
  }

  function getNiceGameTileCcuGraphStep(rawStep) {
    if (!Number.isFinite(rawStep) || rawStep <= 1) {
      return 1;
    }
    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
    const fraction = rawStep / magnitude;
    const niceFraction = fraction <= 1
      ? 1
      : fraction <= 2
        ? 2
        : fraction <= 2.5
          ? 2.5
          : fraction <= 5
            ? 5
            : 10;
    return niceFraction * magnitude;
  }

  function formatGameTileCcuGraphAxisTime(
    timestamp,
    includeDate,
    includeSeconds,
    dateOnly = false
  ) {
    const date = new Date(timestamp);
    let calendar;
    try {
      calendar = new Intl.DateTimeFormat(undefined, {
        month: "numeric",
        day: "numeric"
      }).format(date);
    } catch {
      calendar = `${date.getMonth() + 1}/${date.getDate()}`;
    }
    if (includeDate && dateOnly) {
      return calendar;
    }
    let clock;
    try {
      clock = new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        ...(includeSeconds ? { second: "2-digit" } : {})
      }).format(date);
    } catch {
      clock = `${String(date.getHours()).padStart(2, "0")}:${String(
        date.getMinutes()
      ).padStart(2, "0")}${includeSeconds
        ? `:${String(date.getSeconds()).padStart(2, "0")}`
        : ""}`;
    }
    return includeDate
      ? `${calendar} ${clock}`
      : clock;
  }

  function getGameTileCcuGraphAxisModel(points, now = Date.now()) {
    const hasObservations = points.length > 0;
    const minimumPlaying = hasObservations
      ? Math.min(...points.map((point) => point.playing))
      : 0;
    const maximumPlaying = hasObservations
      ? Math.max(...points.map((point) => point.playing))
      : 0;
    const dataRange = Math.max(0, maximumPlaying - minimumPlaying);
    const minimumPadding = Math.max(1, Math.ceil(maximumPlaying * 0.02));
    const padding = Math.max(minimumPadding, Math.ceil(dataRange * 0.08));
    const paddedMinimum = Math.max(0, minimumPlaying - padding);
    const paddedMaximum = maximumPlaying + padding;
    let step = getNiceGameTileCcuGraphStep(
      Math.max(1, (paddedMaximum - paddedMinimum) / 4)
    );
    let minimum = Math.max(
      0,
      Math.floor(paddedMinimum / step) * step
    );
    for (
      let promotion = 0;
      promotion < 4 && minimum + step * 4 < paddedMaximum;
      promotion += 1
    ) {
      step = getNiceGameTileCcuGraphStep(step * (1 + 1e-9));
      minimum = Math.max(0, Math.floor(paddedMinimum / step) * step);
    }
    const maximum = hasObservations ? minimum + step * 4 : 1;
    const yValues = hasObservations
      ? [
          maximum,
          maximum - step,
          maximum - step * 2,
          maximum - step * 3,
          minimum
        ]
      : [];
    let yLabels = yValues.map((value) =>
      formatGameTileCcuGraphAxisCount(value)
    );
    if (new Set(yLabels).size !== yLabels.length) {
      yLabels = yValues.map((value) =>
        formatGameTileCcuGraphAxisCount(value, 2)
      );
    }
    if (new Set(yLabels).size !== yLabels.length) {
      yLabels = yValues.map((value) => String(Math.round(value)));
    }

    const currentBucketTimestamp = Math.floor(
      now / GAME_TILE_CCU_GRAPH_BUCKET_MS
    ) * GAME_TILE_CCU_GRAPH_BUCKET_MS;
    const firstTimestamp = currentBucketTimestamp -
      GAME_TILE_CCU_GRAPH_WINDOW_MS;
    const lastTimestamp = currentBucketTimestamp;
    const xTimestamps = [
      firstTimestamp,
      firstTimestamp + Math.floor((lastTimestamp - firstTimestamp) / 2),
      lastTimestamp
    ];
    let xLabels = xTimestamps.map((timestamp) =>
      formatGameTileCcuGraphAxisTime(timestamp, false, false)
    );
    if (new Set(xLabels).size !== xLabels.length) {
      xLabels = xTimestamps.map((timestamp) =>
        formatGameTileCcuGraphAxisTime(timestamp, false, true)
      );
    }
    xLabels[xLabels.length - 1] = "Now";
    return {
      minimum,
      maximum,
      minimumTimestamp: firstTimestamp,
      maximumTimestamp: lastTimestamp,
      yTicks: yValues.map((value, index) => ({ value, label: yLabels[index] })),
      xTicks: xTimestamps.map((timestamp, index) => ({
        timestamp,
        label: xLabels[index],
        datetime: new Date(timestamp).toISOString()
      }))
    };
  }

  function renderGameTileCcuGraphState(overlay, state, heading, detail) {
    clearGameTileCcuGraphOverlay(overlay);
    overlay.setAttribute("data-state", state);
    const content = makeGameTileCcuGraphElement(
      "div",
      "rsl-game-ccu-graph__state"
    );
    content.append(
      makeGameTileCcuGraphElement(
        "strong",
        "rsl-game-ccu-graph__state-title",
        heading
      ),
      makeGameTileCcuGraphElement(
        "span",
        "rsl-game-ccu-graph__state-detail",
        detail
      )
    );
    overlay.append(content);
    overlay.setAttribute("aria-label", `${heading}. ${detail}`);
  }

  function splitGameTileCcuGraphSegments(points) {
    const segments = [];
    points.forEach((point) => {
      const segment = segments[segments.length - 1];
      if (
        !segment ||
        point.timestamp - segment[segment.length - 1].timestamp >
          GAME_TILE_CCU_GRAPH_GAP_MS
      ) {
        segments.push([point]);
      } else {
        segment.push(point);
      }
    });
    return segments;
  }

  function getGameTileCcuGraphGapIntervals(
    points,
    minimumTimestamp,
    maximumTimestamp
  ) {
    if (!Number.isSafeInteger(maximumTimestamp)) {
      maximumTimestamp = minimumTimestamp;
      minimumTimestamp = points[0]?.timestamp ??
        maximumTimestamp - GAME_TILE_CCU_GRAPH_WINDOW_MS;
    }
    const domainPoints = points.filter(
      (point) =>
        point.timestamp >= minimumTimestamp &&
        point.timestamp <= maximumTimestamp
    );
    const intervals = [];
    if (domainPoints.length === 0) {
      return maximumTimestamp > minimumTimestamp
        ? [{
            start: minimumTimestamp,
            end: maximumTimestamp,
            leading: true,
            trailing: true
          }]
        : [];
    }
    const firstTimestamp = domainPoints[0].timestamp;
    const leadingEnd = Math.min(
      maximumTimestamp,
      firstTimestamp - GAME_TILE_CCU_GRAPH_BUCKET_MS / 2
    );
    if (leadingEnd > minimumTimestamp) {
      intervals.push({
        start: minimumTimestamp,
        end: leadingEnd,
        leading: true,
        trailing: false
      });
    }
    for (let index = 1; index < domainPoints.length; index += 1) {
      const previous = domainPoints[index - 1];
      const current = domainPoints[index];
      if (
        current.timestamp - previous.timestamp > GAME_TILE_CCU_GRAPH_GAP_MS
      ) {
        intervals.push({
          start: previous.timestamp + GAME_TILE_CCU_GRAPH_BUCKET_MS / 2,
          end: current.timestamp - GAME_TILE_CCU_GRAPH_BUCKET_MS / 2,
          leading: false,
          trailing: false
        });
      }
    }
    const latestTimestamp = domainPoints[domainPoints.length - 1].timestamp;
    const trailingStart = Math.max(
      minimumTimestamp,
      latestTimestamp + GAME_TILE_CCU_GRAPH_BUCKET_MS / 2
    );
    if (maximumTimestamp > trailingStart) {
      intervals.push({
        start: trailingStart,
        end: maximumTimestamp,
        leading: false,
        trailing: true
      });
    }
    return intervals;
  }

  function getGameTileCcuGraphEdgeTrend(previous, current) {
    if (!previous || !current) {
      return "flat";
    }
    return current.playing > previous.playing
      ? "up"
      : current.playing < previous.playing
        ? "down"
        : "flat";
  }

  function getGameTileCcuGraphLatestTrend(sourceSegments) {
    const latestSegment = sourceSegments[sourceSegments.length - 1] || [];
    if (latestSegment.length < 2) {
      return {
        trend: "neutral",
        delta: null,
        previous: null,
        current: latestSegment[latestSegment.length - 1] || null
      };
    }
    const previous = latestSegment[latestSegment.length - 2];
    const current = latestSegment[latestSegment.length - 1];
    return {
      trend: getGameTileCcuGraphEdgeTrend(previous, current),
      delta: current.playing - previous.playing,
      previous,
      current
    };
  }

  function getGameTileCcuGraphLatestPercentChange(sourceSegments) {
    const latestSegment = sourceSegments[sourceSegments.length - 1] || [];
    const latest = latestSegment[latestSegment.length - 1] || null;
    if (latestSegment.length < 2) {
      return {
        trend: "neutral",
        runTrend: "neutral",
        text: "\u2014",
        percentage: null,
        previousPlaying: null,
        baselinePlaying: null,
        latestPlaying: Number.isFinite(latest?.playing) ? latest.playing : null,
        baselineTimestamp: null,
        latestTimestamp: Number.isFinite(latest?.timestamp)
          ? latest.timestamp
          : null,
        elapsedMs: null,
        observationCount: latest ? 1 : 0,
        unavailableReason: "missing-previous"
      };
    }

    const finalEdgeTrend = getGameTileCcuGraphEdgeTrend(
      latestSegment[latestSegment.length - 2],
      latest
    );
    let baselineIndex = latestSegment.length - 2;
    while (
      baselineIndex > 0 &&
      getGameTileCcuGraphEdgeTrend(
        latestSegment[baselineIndex - 1],
        latestSegment[baselineIndex]
      ) === finalEdgeTrend
    ) {
      baselineIndex -= 1;
    }
    const baseline = latestSegment[baselineIndex];
    const baselinePlaying = baseline.playing;
    const latestPlaying = latest.playing;
    const runDelta = latestPlaying - baselinePlaying;
    const common = {
      runTrend: finalEdgeTrend,
      previousPlaying: baselinePlaying,
      baselinePlaying,
      latestPlaying,
      baselineTimestamp: baseline.timestamp,
      latestTimestamp: latest.timestamp,
      elapsedMs: Math.max(0, latest.timestamp - baseline.timestamp),
      observationCount: latestSegment.length - baselineIndex
    };
    if (runDelta === 0) {
      return {
        ...common,
        trend: "flat",
        text: "0%",
        percentage: 0,
        unavailableReason: null
      };
    }
    if (baselinePlaying === 0) {
      return {
        ...common,
        trend: "neutral",
        text: "\u2014",
        percentage: null,
        unavailableReason: "zero-baseline"
      };
    }

    const percentage = (runDelta / baselinePlaying) * 100;
    const magnitude = Math.abs(percentage);
    let magnitudeText;
    if (magnitude < 0.01) {
      magnitudeText = "<0.01";
    } else if (magnitude < 0.1) {
      const rounded = Number(magnitude.toFixed(2));
      magnitudeText = rounded >= 0.1 ? "0.1" : rounded.toFixed(2);
    } else if (magnitude < 10) {
      magnitudeText = magnitude.toFixed(1);
    } else {
      magnitudeText = formatGameTileCcuGraphExactCount(Math.round(magnitude));
    }
    return {
      ...common,
      trend: finalEdgeTrend,
      text: `${finalEdgeTrend === "up" ? "+" : "\u2212"}${magnitudeText}%`,
      percentage,
      unavailableReason: null
    };
  }

  function formatGameTileCcuGraphStoredElapsed(elapsedMs) {
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
      return null;
    }
    const totalMinutes = Math.max(0, Math.round(elapsedMs / 60_000));
    if (totalMinutes === 0) {
      return "less than 1 minute";
    }
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;
    return [
      days > 0 ? `${days} ${days === 1 ? "day" : "days"}` : "",
      hours > 0 ? `${hours} ${hours === 1 ? "hour" : "hours"}` : "",
      minutes > 0
        ? `${minutes} ${minutes === 1 ? "minute" : "minutes"}`
        : ""
    ].filter(Boolean).join(" ");
  }

  function formatGameTileCcuGraphCompactElapsed(elapsedMs) {
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
      return null;
    }
    const totalMinutes = Math.max(1, Math.round(elapsedMs / 60_000));
    if (totalMinutes < 60) {
      return `${totalMinutes}m`;
    }
    const totalHours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (totalHours < 24) {
      return `${totalHours}h${minutes ? ` ${minutes}m` : ""}`;
    }
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    return `${days}d${hours ? ` ${hours}h` : ""}`;
  }

  function formatGameTileCcuGraphFreshness(timestamp, now = Date.now()) {
    if (!Number.isFinite(timestamp)) {
      return null;
    }
    const elapsedMs = Math.max(0, now - timestamp);
    if (elapsedMs < 60_000) {
      return "<1m ago";
    }
    const choices = elapsedMs < 60 * 60_000
      ? [Math.max(1, Math.round(elapsedMs / 60_000)), "minute", "m"]
      : elapsedMs < 24 * 60 * 60_000
        ? [Math.max(1, Math.round(elapsedMs / (60 * 60_000))), "hour", "h"]
        : [Math.max(1, Math.round(elapsedMs / (24 * 60 * 60_000))), "day", "d"];
    try {
      return new Intl.RelativeTimeFormat(undefined, {
        numeric: "always",
        style: "narrow"
      }).format(-choices[0], choices[1]);
    } catch {
      return `${choices[0]}${choices[2]} ago`;
    }
  }

  function getGameTileCcuGraphLatestPercentLabel(change) {
    const latestCount = Number.isFinite(change.latestPlaying)
      ? formatGameTileCcuGraphExactCount(change.latestPlaying)
      : null;
    const baselineCount = Number.isFinite(change.baselinePlaying)
      ? formatGameTileCcuGraphExactCount(change.baselinePlaying)
      : null;
    const elapsed = formatGameTileCcuGraphStoredElapsed(change.elapsedMs);
    const storedRange = baselineCount === null
      ? ""
      : `Baseline stored observation: ${baselineCount} players. ` +
        `Latest stored observation: ${latestCount} players. ` +
        `Elapsed time between stored observations: ${elapsed}. `;
    if (change.unavailableReason === "zero-baseline") {
      return storedRange +
        "Percentage change is unavailable because the baseline count was zero.";
    }
    if (change.unavailableReason === "missing-previous") {
      return latestCount === null
        ? "Percentage change is unavailable because no adjacent stored observation exists."
        : `Latest stored observation: ${latestCount} players. ` +
          "Percentage change is unavailable because no adjacent stored observation exists.";
    }
    const sequenceDescription = change.runTrend === "up"
      ? "rising"
      : change.runTrend === "down"
        ? "falling"
        : "unchanged";
    return storedRange +
      `Change across the latest uninterrupted ${sequenceDescription} ` +
      `sequence of stored observations: ${change.text}.`;
  }

  function downsampleGameTileCcuGraphPoints(
    points,
    maximumPoints = GAME_TILE_CCU_GRAPH_MAX_VISUAL_POINTS
  ) {
    if (points.length <= maximumPoints || maximumPoints < 4) {
      return points.slice();
    }
    const sampled = [points[0]];
    const bucketCount = Math.max(1, Math.floor((maximumPoints - 2) / 2));
    const interiorLength = points.length - 2;
    for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex += 1) {
      const start = 1 + Math.floor((bucketIndex * interiorLength) / bucketCount);
      const end = 1 + Math.floor(
        ((bucketIndex + 1) * interiorLength) / bucketCount
      );
      const bucket = points.slice(start, Math.max(start + 1, end));
      let minimum = bucket[0];
      let maximum = bucket[0];
      bucket.forEach((point) => {
        if (point.playing < minimum.playing) {
          minimum = point;
        }
        if (point.playing > maximum.playing) {
          maximum = point;
        }
      });
      if (minimum.timestamp <= maximum.timestamp) {
        sampled.push(minimum);
        if (maximum !== minimum) sampled.push(maximum);
      } else {
        sampled.push(maximum, minimum);
      }
    }
    sampled.push(points[points.length - 1]);
    return Array.from(
      new Map(sampled.map((point) => [point.timestamp, point])).values()
    ).sort((left, right) => left.timestamp - right.timestamp)
      .slice(0, maximumPoints);
  }

  function downsampleGameTileCcuGraphSegments(
    points,
    segments,
    maximumPoints = GAME_TILE_CCU_GRAPH_MAX_VISUAL_POINTS
  ) {
    if (points.length <= maximumPoints) {
      return points.slice();
    }
    const requiredByTimestamp = new Map();
    segments.forEach((segment) => {
      const first = segment[0];
      const last = segment[segment.length - 1];
      if (first) requiredByTimestamp.set(first.timestamp, first);
      if (last) requiredByTimestamp.set(last.timestamp, last);
    });
    const remainingCapacity = maximumPoints - requiredByTimestamp.size;
    const sampled = remainingCapacity >= 4
      ? downsampleGameTileCcuGraphPoints(points, remainingCapacity)
      : [];
    const combined = new Map(
      sampled.map((point) => [point.timestamp, point])
    );
    requiredByTimestamp.forEach((point, timestamp) => {
      combined.set(timestamp, point);
    });
    // Gap endpoints are more important than the nominal visual cap: without
    // them a short resumed segment can disappear and make missing data look
    // continuous. The normalized response remains bounded by the seven-day
    // storage cap even though the visible graph uses a shorter window.
    return Array.from(combined.values()).sort(
      (left, right) => left.timestamp - right.timestamp
    );
  }

  function renderGameTileCcuGraph(overlay, rawPoints, now = Date.now()) {
    const normalizedPoints = normalizeGameTileCcuHistoryPoints(rawPoints);
    const maximumWindowTimestamp = Math.floor(
      now / GAME_TILE_CCU_GRAPH_BUCKET_MS
    ) * GAME_TILE_CCU_GRAPH_BUCKET_MS;
    const minimumWindowTimestamp = maximumWindowTimestamp -
      GAME_TILE_CCU_GRAPH_WINDOW_MS;
    const points = normalizedPoints.filter(
      (point) =>
        point.timestamp >= minimumWindowTimestamp &&
        point.timestamp <= maximumWindowTimestamp
    );
    clearGameTileCcuGraphOverlay(overlay);
    overlay.setAttribute(
      "data-state",
      points.length === 0
        ? "no-history"
        : points.length === 1
          ? "collecting"
          : "ready"
    );
    overlay.setAttribute("data-window-start", String(minimumWindowTimestamp));
    overlay.setAttribute("data-window-end", String(maximumWindowTimestamp));
    const latest = points[points.length - 1] || null;
    const sourceSegments = splitGameTileCcuGraphSegments(points);
    const visualPoints = downsampleGameTileCcuGraphSegments(
      points,
      sourceSegments
    );
    const exactLatest = latest
      ? formatGameTileCcuGraphExactCount(latest.playing)
      : "\u2014";
    const axisModel = getGameTileCcuGraphAxisModel(points, now);
    const latestTrend = getGameTileCcuGraphLatestTrend(sourceSegments);
    const latestPercentChange = getGameTileCcuGraphLatestPercentChange(
      sourceSegments
    );
    const heading = makeGameTileCcuGraphElement(
      "div",
      "rsl-game-ccu-graph__heading"
    );
    const titleGroup = makeGameTileCcuGraphElement(
      "span",
      "rsl-game-ccu-graph__title-group"
    );
    titleGroup.append(
      makeGameTileCcuGraphElement(
        "strong",
        "rsl-game-ccu-graph__label",
        "Chart CCU"
      ),
      makeGameTileCcuGraphElement(
        "span",
        "rsl-game-ccu-graph__window",
        "\u00b7 12h"
      )
    );
    const latestSummary = makeGameTileCcuGraphElement(
      "span",
      "rsl-game-ccu-graph__latest-summary"
    );
    const latestRow = makeGameTileCcuGraphElement(
      "span",
      "rsl-game-ccu-graph__latest-row"
    );
    const latestLabel = makeGameTileCcuGraphElement(
      "span",
      "rsl-game-ccu-graph__latest-label",
      "Latest"
    );
    const latestValue = makeGameTileCcuGraphElement(
      "strong",
      "rsl-game-ccu-graph__latest",
      exactLatest
    );
    latestRow.append(latestLabel, latestValue);
    latestRow.setAttribute(
      "aria-label",
      latest ? `Latest saved CCU: ${exactLatest}` : "No saved CCU observation"
    );
    const latestChange = makeGameTileCcuGraphElement(
      "span",
      `rsl-game-ccu-graph__latest-change ` +
        `rsl-game-ccu-graph__latest-change--${latestPercentChange.trend}`,
      latestPercentChange.text
    );
    const latestPercentLabel = getGameTileCcuGraphLatestPercentLabel(
      latestPercentChange
    );
    latestChange.setAttribute("data-trend", latestPercentChange.trend);
    latestChange.setAttribute("aria-label", latestPercentLabel);
    latestChange.title = latestPercentLabel;
    const latestChangeElapsed = formatGameTileCcuGraphCompactElapsed(
      latestPercentChange.elapsedMs
    );
    const latestChangePeriod = latestChangeElapsed
      ? makeGameTileCcuGraphElement(
          "span",
          "rsl-game-ccu-graph__change-period",
          `in ${latestChangeElapsed}`
        )
      : null;
    if (latestChangePeriod) {
      latestChangePeriod.title =
        `Change period between the baseline and latest stored observations: ` +
        `${formatGameTileCcuGraphStoredElapsed(latestPercentChange.elapsedMs)}.`;
      latestChangePeriod.setAttribute(
        "aria-label",
        `Percentage change covers ` +
          `${formatGameTileCcuGraphStoredElapsed(latestPercentChange.elapsedMs)}`
      );
    }
    const latestChangeSummary = makeGameTileCcuGraphElement(
      "span",
      "rsl-game-ccu-graph__change-summary"
    );
    latestChangeSummary.append(
      makeGameTileCcuGraphElement(
        "span",
        "rsl-game-ccu-graph__change-label",
        "Change"
      ),
      latestChange,
      ...(latestChangePeriod ? [latestChangePeriod] : [])
    );
    latestSummary.append(latestRow, latestChangeSummary);
    heading.append(titleGroup, ...(latest ? [latestSummary] : []));

    const svg = makeGameTileCcuGraphSvgElement("svg");
    svg.classList.add("rsl-game-ccu-graph__plot");
    svg.setAttribute("viewBox", "0 0 300 100");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    const minimumTimestamp = axisModel.minimumTimestamp;
    const maximumTimestamp = axisModel.maximumTimestamp;
    const xFor = (timestamp) =>
      8 + ((timestamp - minimumTimestamp) /
        Math.max(1, maximumTimestamp - minimumTimestamp)) * 284;
    const yFor = (playing) =>
      6 + (1 - (playing - axisModel.minimum) /
        Math.max(1, axisModel.maximum - axisModel.minimum)) * 88;

    const gapIntervals = getGameTileCcuGraphGapIntervals(
      points,
      minimumTimestamp,
      maximumTimestamp
    );
    overlay.setAttribute("data-gap-count", String(gapIntervals.length));
    if (gapIntervals.length > 0) {
      gameTileCcuGraphPatternId = gameTileCcuGraphPatternId >=
        Number.MAX_SAFE_INTEGER
        ? 1
        : gameTileCcuGraphPatternId + 1;
      const gapPatternId = `rsl-game-ccu-gap-${gameTileCcuGraphPatternId}`;
      const definitions = makeGameTileCcuGraphSvgElement("defs");
      const gapPattern = makeGameTileCcuGraphSvgElement("pattern");
      gapPattern.classList.add("rsl-game-ccu-graph__gap-pattern");
      gapPattern.setAttribute("id", gapPatternId);
      gapPattern.setAttribute("patternUnits", "userSpaceOnUse");
      gapPattern.setAttribute("width", "8");
      gapPattern.setAttribute("height", "8");
      const gapPatternBase = makeGameTileCcuGraphSvgElement("rect");
      gapPatternBase.classList.add("rsl-game-ccu-graph__gap-pattern-base");
      gapPatternBase.setAttribute("width", "8");
      gapPatternBase.setAttribute("height", "8");
      const gapPatternStripe = makeGameTileCcuGraphSvgElement("path");
      gapPatternStripe.classList.add("rsl-game-ccu-graph__gap-pattern-stripe");
      gapPatternStripe.setAttribute(
        "d",
        "M-2 2 L2 -2 M-2 10 L10 -2 M6 10 L10 6"
      );
      gapPattern.append(gapPatternBase, gapPatternStripe);
      definitions.append(gapPattern);
      svg.append(definitions);
      const gapBand = makeGameTileCcuGraphSvgElement("path");
      gapBand.classList.add("rsl-game-ccu-graph__gap-band");
      gapBand.setAttribute("fill", `url(#${gapPatternId})`);
      gapBand.setAttribute(
        "d",
        gapIntervals.map((gap) => {
          const startX = xFor(gap.start).toFixed(2);
          const endX = xFor(gap.end).toFixed(2);
          return `M${startX} 6 H${endX} V94 H${startX} Z`;
        }).join(" ")
      );
      svg.append(gapBand);
    }

    const grid = makeGameTileCcuGraphSvgElement("path");
    grid.classList.add("rsl-game-ccu-graph__grid");
    grid.setAttribute("data-y-guide-count", String(axisModel.yTicks.length));
    grid.setAttribute(
      "data-y-tick-values",
      axisModel.yTicks.map((tick) => String(tick.value)).join(",")
    );
    grid.setAttribute("d", axisModel.yTicks.map((tick) =>
      `M8 ${yFor(tick.value).toFixed(2)} H292`
    ).join(" "));
    svg.append(grid);

    const segments = sourceSegments.map((sourceSegment) => {
      const firstTimestamp = sourceSegment[0].timestamp;
      const lastTimestamp = sourceSegment[sourceSegment.length - 1].timestamp;
      return visualPoints.filter(
        (point) =>
          point.timestamp >= firstTimestamp && point.timestamp <= lastTimestamp
      );
    }).filter((segment) => segment.length > 0);
    const areaCommands = [];
    const edgePathCommands = {
      up: [],
      down: [],
      flat: []
    };
    const isolatedCommands = [];
    segments.forEach((segment) => {
      if (segment.length < 2) {
        const x = xFor(segment[0].timestamp).toFixed(2);
        const y = yFor(segment[0].playing).toFixed(2);
        isolatedCommands.push(
          `M${x} ${y} m-2 0 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0`
        );
        return;
      }
      const segmentCommands = segment.map((point, index) =>
        `${index === 0 ? "M" : "L"}${xFor(point.timestamp).toFixed(2)} ` +
        yFor(point.playing).toFixed(2)
      ).join(" ");
      const firstXValue = xFor(segment[0].timestamp);
      const lastXValue = xFor(segment[segment.length - 1].timestamp);
      // A very young fixed-window series can occupy less than a few viewBox
      // pixels. Closing an area polygon there looks like a stray vertical bar,
      // so keep the real line and observation markers without a false sliver.
      if (lastXValue - firstXValue >= 3) {
        const firstX = firstXValue.toFixed(2);
        const lastX = lastXValue.toFixed(2);
        areaCommands.push(`${segmentCommands} L${lastX} 94 L${firstX} 94 Z`);
      }
    });
    // Directional strokes must never classify an edge synthesized by
    // downsampling. Build them from every consecutive stored observation;
    // the normalized history cap bounds this to 2,015 compact M/L subpaths.
    sourceSegments.forEach((segment) => {
      let runTrend = null;
      let runCommand = "";
      const finishRun = () => {
        if (runTrend && runCommand) {
          edgePathCommands[runTrend].push(runCommand);
        }
        runTrend = null;
        runCommand = "";
      };
      for (let index = 1; index < segment.length; index += 1) {
        const previous = segment[index - 1];
        const current = segment[index];
        const trend = getGameTileCcuGraphEdgeTrend(previous, current);
        if (trend !== runTrend) {
          finishRun();
          runTrend = trend;
          runCommand =
            `M${xFor(previous.timestamp).toFixed(2)} ` +
            `${yFor(previous.playing).toFixed(2)}`;
        }
        runCommand +=
          ` L${xFor(current.timestamp).toFixed(2)} ` +
          yFor(current.playing).toFixed(2);
      }
      finishRun();
    });
    if (areaCommands.length > 0) {
      const area = makeGameTileCcuGraphSvgElement("path");
      area.classList.add("rsl-game-ccu-graph__area");
      area.setAttribute("d", areaCommands.join(" "));
      svg.append(area);
    }
    ["up", "down", "flat"].forEach((trend) => {
      if (edgePathCommands[trend].length === 0) {
        return;
      }
      const line = makeGameTileCcuGraphSvgElement("path");
      line.classList.add(
        "rsl-game-ccu-graph__line",
        `rsl-game-ccu-graph__line--${trend}`
      );
      line.setAttribute("data-trend", trend);
      line.setAttribute("d", edgePathCommands[trend].join(" "));
      svg.append(line);
    });
    if (isolatedCommands.length > 0) {
      const isolated = makeGameTileCcuGraphSvgElement("path");
      isolated.classList.add("rsl-game-ccu-graph__isolated-point");
      isolated.setAttribute("d", isolatedCommands.join(" "));
      svg.append(isolated);
    }
    overlay.setAttribute("data-latest-trend", latestTrend.trend);

    const yAxis = makeGameTileCcuGraphElement(
      "div",
      "rsl-game-ccu-graph__y-axis"
    );
    yAxis.setAttribute("aria-label", "CCU scale");
    axisModel.yTicks.forEach((tick) => {
      const label = makeGameTileCcuGraphElement(
        "span",
        "rsl-game-ccu-graph__y-tick",
        tick.label
      );
      label.title = `${formatGameTileCcuGraphExactCount(tick.value)} CCU`;
      yAxis.append(label);
    });
    const xAxis = makeGameTileCcuGraphElement(
      "div",
      "rsl-game-ccu-graph__x-axis"
    );
    xAxis.setAttribute("aria-label", "Observation time");
    axisModel.xTicks.forEach((tick) => {
      const label = makeGameTileCcuGraphElement(
        "time",
        "rsl-game-ccu-graph__x-tick",
        tick.label
      );
      label.setAttribute("datetime", tick.datetime);
      label.title = new Date(tick.timestamp).toLocaleString();
      xAxis.append(label);
    });
    const interaction = makeGameTileCcuGraphElement(
      "div",
      "rsl-game-ccu-graph__interaction"
    );
    if (points.length > 0) {
      interaction.setAttribute("tabindex", "0");
      interaction.setAttribute("role", "slider");
      interaction.setAttribute("aria-orientation", "horizontal");
      interaction.setAttribute("aria-label", "Inspect saved Chart CCU observations");
      interaction.setAttribute("aria-valuemin", "0");
      interaction.setAttribute("aria-valuemax", String(points.length - 1));
      interaction.setAttribute("aria-valuenow", String(points.length - 1));
      interaction.setAttribute(
        "aria-valuetext",
        `${formatGameTileCcuGraphExactCount(latest.playing)} CCU at ` +
          new Date(latest.timestamp).toLocaleString()
      );
    } else {
      interaction.setAttribute("tabindex", "0");
      interaction.setAttribute("role", "img");
      interaction.setAttribute(
        "aria-label",
        "No saved Chart CCU observations in this rolling 12-hour window."
      );
    }
    const crosshair = makeGameTileCcuGraphElement(
      "div",
      "rsl-game-ccu-graph__crosshair"
    );
    crosshair.hidden = true;
    const crosshairLine = makeGameTileCcuGraphElement(
      "span",
      "rsl-game-ccu-graph__crosshair-line"
    );
    const crosshairPoint = makeGameTileCcuGraphElement(
      "span",
      "rsl-game-ccu-graph__crosshair-point"
    );
    const pointTooltip = makeGameTileCcuGraphElement(
      "output",
      "rsl-game-ccu-graph__point-tooltip"
    );
    const pointTime = makeGameTileCcuGraphElement(
      "time",
      "rsl-game-ccu-graph__point-time"
    );
    const pointCount = makeGameTileCcuGraphElement(
      "strong",
      "rsl-game-ccu-graph__point-ccu"
    );
    pointTooltip.append(pointCount, pointTime);
    crosshair.append(crosshairLine, crosshairPoint, pointTooltip);
    interaction.append(crosshair);
    interaction.addEventListener(
      "pointermove",
      handleGameTileCcuGraphInteractionPointerMove
    );
    interaction.addEventListener(
      "pointerleave",
      handleGameTileCcuGraphInteractionPointerLeave
    );
    interaction.addEventListener("focus", handleGameTileCcuGraphInteractionFocus);
    interaction.addEventListener("blur", handleGameTileCcuGraphInteractionBlur);
    interaction.addEventListener(
      "keydown",
      handleGameTileCcuGraphInteractionKeyDown
    );
    gameTileCcuGraphInteractionModels.set(interaction, {
      points,
      minimumTimestamp,
      maximumTimestamp,
      xFor,
      yFor,
      gapIntervals,
      crosshair,
      point: crosshairPoint,
      time: pointTime,
      count: pointCount,
      selectedIndex: points.length - 1
    });
    const chart = makeGameTileCcuGraphElement(
      "div",
      "rsl-game-ccu-graph__chart"
    );
    chart.append(yAxis, svg, interaction, xAxis);
    if (points.length === 0) {
      chart.append(makeGameTileCcuGraphElement(
        "span",
        "rsl-game-ccu-graph__empty-note",
        "No saved CCU samples in the last 12h"
      ));
    }

    const footer = makeGameTileCcuGraphElement(
      "div",
      "rsl-game-ccu-graph__footer"
    );
    const footerMeta = makeGameTileCcuGraphElement(
      "span",
      "rsl-game-ccu-graph__footer-meta"
    );
    if (latest) {
      const latestTime = makeGameTileCcuGraphElement(
        "time",
        "rsl-game-ccu-graph__latest-time",
        `Last saved ${formatGameTileCcuGraphFreshness(latest.timestamp, now)}`
      );
      const latestDate = new Date(latest.timestamp);
      const localizedLatestDate = latestDate.toLocaleString();
      latestTime.setAttribute("datetime", latestDate.toISOString());
      latestTime.setAttribute(
        "aria-label",
        `Latest saved observation ${localizedLatestDate}`
      );
      latestTime.title = `Latest saved observation: ${localizedLatestDate}`;
      footerMeta.append(latestTime);
    }
    const cadence = makeGameTileCcuGraphElement(
      "span",
      "rsl-game-ccu-graph__cadence",
      "every ~5 min"
    );
    cadence.setAttribute(
      "aria-label",
      "Chart observations are normally sampled about every 5 minutes"
    );
    cadence.title =
      "Chart observations are normally sampled about every 5 minutes; " +
      "missing samples remain marked as no saved data.";
    footerMeta.append(cadence);
    footer.append(footerMeta);
    overlay.append(heading, chart, footer);
    const hasGaps = gapIntervals.length > 0;
    const latestTrendDetail = latestTrend.delta === null
      ? " No adjacent stored observation is available for the latest trend."
      : latestTrend.trend === "up"
        ? ` Latest stored change increased by ` +
          `${formatGameTileCcuGraphExactCount(latestTrend.delta)} players.`
        : latestTrend.trend === "down"
          ? ` Latest stored change decreased by ` +
            `${formatGameTileCcuGraphExactCount(Math.abs(latestTrend.delta))} players.`
          : " Latest stored change was unchanged.";
    const observationSummary = latest
      ? `Latest ${latest.playing} players at ` +
        `${new Date(latest.timestamp).toLocaleString()}.` +
        latestTrendDetail + ` ${latestPercentLabel}`
      : "No saved Chart CCU observations are available in this window.";
    overlay.setAttribute(
      "aria-label",
      `Rolling 12-hour locally stored Chart CCU history from ` +
        `${points.length} observations. ${observationSummary}` +
        (hasGaps
          ? ` The window contains ${gapIntervals.length} marked no-data ` +
            `${gapIntervals.length === 1 ? "interval" : "intervals"} where ` +
            "no Chart observation was stored."
          : "")
    );
    if (activeGameTileCcuGraph?.overlay === overlay) {
      if (activeGameTileCcuGraph.focusPlotWhenReady) {
        queueMicrotask(() => {
          if (activeGameTileCcuGraph?.overlay === overlay) {
            focusGameTileCcuGraphPlot(activeGameTileCcuGraph);
          }
        });
      }
      queueGameTileCcuGraphPosition(activeGameTileCcuGraph);
    }
    return points;
  }

  function restoreGameTileCcuGraphDescription(active) {
    const target = active?.descriptionTarget;
    if (!target?.removeAttribute) {
      return;
    }
    if (active.originalDescribedBy === null) {
      target.removeAttribute("aria-describedby");
    } else {
      target.setAttribute("aria-describedby", active.originalDescribedBy);
    }
  }

  function restoreGameTileCcuGraphControlState(active) {
    (active?.controlStates || []).forEach(({ target, attributes }) => {
      if (!target?.setAttribute) {
        return;
      }
      attributes.forEach(({ name, existed, value }) => {
        if (existed) {
          target.setAttribute(name, value ?? "");
        } else {
          target.removeAttribute(name);
        }
      });
    });
    if (active) {
      active.controlStates = [];
    }
  }

  function setGameTileCcuGraphControlState(active) {
    if (!active?.overlay?.id) {
      return false;
    }
    restoreGameTileCcuGraphControlState(active);
    const targets = Array.from(new Set([
      active.trigger,
      active.descriptionTarget
    ].filter((target) => target?.setAttribute)));
    active.controlStates = targets.map((target) => {
      const attributes = ["aria-controls", "aria-expanded", "aria-haspopup"]
        .map((name) => ({
          name,
          existed: target.hasAttribute?.(name) || false,
          value: target.getAttribute?.(name) ?? null
        }));
      target.setAttribute("aria-controls", active.overlay.id);
      target.setAttribute("aria-expanded", "true");
      target.setAttribute("aria-haspopup", "dialog");
      return { target, attributes };
    });
    return targets.length > 0;
  }

  function setGameTileCcuGraphDescriptionTarget(active, target) {
    if (!active || !target?.setAttribute) {
      return false;
    }
    restoreGameTileCcuGraphDescription(active);
    active.descriptionTarget = target;
    active.originalDescribedBy = target.getAttribute?.("aria-describedby") ?? null;
    target.setAttribute(
      "aria-describedby",
      [active.originalDescribedBy, active.overlay.id].filter(Boolean).join(" ")
    );
    setGameTileCcuGraphControlState(active);
    return true;
  }

  function isActiveGameTileCcuGraphCurrent(active = activeGameTileCcuGraph) {
    if (!active?.overlay?.isConnected || !active.trigger?.isConnected) {
      return false;
    }
    const root = getGameTileCcuGraphRoot(active.trigger);
    const identity = getGameTileCcuGraphIdentity(root);
    return Boolean(
      root === active.root &&
      identity &&
      identity.placeId === active.placeId &&
      identity.universeId === active.universeId
    );
  }

  function findReplacementGameTileCcuGraphTrigger(active) {
    if (!active || !document.querySelectorAll) {
      return null;
    }
    const anchor = active.anchorRect;
    const candidates = Array.from(document.querySelectorAll(
      `[${GAME_TILE_CCU_GRAPH_TRIGGER_ATTRIBUTE}]`
    )).filter((metric) => {
      if (!isUsableGameTileCcuGraphTrigger(metric)) {
        return false;
      }
      const identity = getGameTileCcuGraphIdentity(
        getGameTileCcuGraphRoot(metric)
      );
      return identity?.placeId === active.placeId &&
        identity?.universeId === active.universeId;
    });
    if (!anchor || candidates.length < 2) {
      return candidates[0] || null;
    }
    const anchorX = anchor.left + anchor.width / 2;
    const anchorY = anchor.top + anchor.height / 2;
    return candidates.sort((left, right) => {
      const leftRoot = getGameTileCcuGraphRoot(left);
      const rightRoot = getGameTileCcuGraphRoot(right);
      const leftAnchor = findGameTileCcuGraphThumbnail(leftRoot) || left;
      const rightAnchor = findGameTileCcuGraphThumbnail(rightRoot) || right;
      const leftRect = leftAnchor.getBoundingClientRect?.() || {};
      const rightRect = rightAnchor.getBoundingClientRect?.() || {};
      const leftX = Number(leftRect.left || 0) + Number(leftRect.width || 0) / 2;
      const leftY = Number(leftRect.top || 0) + Number(leftRect.height || 0) / 2;
      const rightX = Number(rightRect.left || 0) + Number(rightRect.width || 0) / 2;
      const rightY = Number(rightRect.top || 0) + Number(rightRect.height || 0) / 2;
      const leftDistance = (leftX - anchorX) ** 2 + (leftY - anchorY) ** 2;
      const rightDistance = (rightX - anchorX) ** 2 + (rightY - anchorY) ** 2;
      return leftDistance - rightDistance;
    })[0] || null;
  }

  function rebindActiveGameTileCcuGraph(active) {
    const replacement = findReplacementGameTileCcuGraphTrigger(active);
    if (!replacement) {
      return false;
    }
    const root = getGameTileCcuGraphRoot(replacement);
    if (!root) {
      return false;
    }
    restoreGameTileCcuGraphDescription(active);
    active.root?.removeAttribute?.(GAME_TILE_CCU_GRAPH_OPEN_ATTRIBUTE);
    active.trigger = replacement;
    active.root = root;
    active.host = findGameTileCcuGraphThumbnail(root);
    active.triggerHovered = false;
    active.anchorHovered = false;
    root.setAttribute(GAME_TILE_CCU_GRAPH_OPEN_ATTRIBUTE, "");
    setGameTileCcuGraphDescriptionTarget(active, replacement);
    return true;
  }

  function validateActiveGameTileCcuGraph() {
    const active = activeGameTileCcuGraph;
    if (!active) {
      return false;
    }
    if (isActiveGameTileCcuGraphCurrent(active)) {
      return true;
    }
    if (active.overlay?.isConnected && rebindActiveGameTileCcuGraph(active)) {
      queueGameTileCcuGraphPosition(active);
      return true;
    }
    closeGameTileCcuGraph();
    return false;
  }

  function positionGameTileCcuGraphPopover(active = activeGameTileCcuGraph) {
    if (!active || active !== activeGameTileCcuGraph ||
      !isActiveGameTileCcuGraphCurrent(active)) {
      return false;
    }
    const currentHost = findGameTileCcuGraphThumbnail(active.root);
    if (currentHost) {
      active.host = currentHost;
    }
    const anchorRect = active.host?.getBoundingClientRect?.();
    if (!anchorRect) {
      return false;
    }
    const anchorLeft = Number(anchorRect.left) || 0;
    const anchorTop = Number(anchorRect.top) || 0;
    const anchorWidth = Math.max(0, Number(anchorRect.width) || 0);
    const anchorHeight = Math.max(0, Number(anchorRect.height) || 0);
    const anchorRight = Number.isFinite(Number(anchorRect.right))
      ? Number(anchorRect.right)
      : anchorLeft + anchorWidth;
    const anchorBottom = Number.isFinite(Number(anchorRect.bottom))
      ? Number(anchorRect.bottom)
      : anchorTop + anchorHeight;
    const viewportWidth = Math.max(
      1,
      window.visualViewport?.width ||
        document.documentElement?.clientWidth || window.innerWidth || 1
    );
    const viewportHeight = Math.max(
      1,
      window.visualViewport?.height ||
        document.documentElement?.clientHeight || window.innerHeight || 1
    );
    const viewportLeft = window.visualViewport?.offsetLeft || 0;
    const viewportTop = window.visualViewport?.offsetTop || 0;
    const margin = GAME_TILE_CCU_GRAPH_VIEWPORT_MARGIN_PX;
    const width = Math.min(
      300,
      Math.max(1, viewportWidth - margin * 2)
    );
    const height = Math.min(
      168,
      Math.max(1, viewportHeight - margin * 2)
    );
    const viewportRight = viewportLeft + viewportWidth;
    const viewportBottom = viewportTop + viewportHeight;
    const availableBelow = viewportBottom - anchorBottom -
      GAME_TILE_CCU_GRAPH_ANCHOR_GAP_PX;
    const availableAbove = anchorTop - viewportTop -
      GAME_TILE_CCU_GRAPH_ANCHOR_GAP_PX;
    const placement = availableBelow >= height + margin ||
      availableBelow >= availableAbove
      ? "bottom"
      : "top";
    let top = placement === "bottom"
      ? anchorBottom + GAME_TILE_CCU_GRAPH_ANCHOR_GAP_PX
      : anchorTop - height - GAME_TILE_CCU_GRAPH_ANCHOR_GAP_PX;
    let left = anchorLeft + anchorWidth / 2 - width / 2;
    left = Math.max(
      viewportLeft + margin,
      Math.min(left, viewportRight - width - margin)
    );
    top = Math.max(
      viewportTop + margin,
      Math.min(top, viewportBottom - height - margin)
    );
    active.overlay.style.setProperty("left", `${Math.round(left)}px`);
    active.overlay.style.setProperty("top", `${Math.round(top)}px`);
    active.overlay.style.setProperty("width", `${Math.round(width)}px`);
    active.overlay.style.setProperty("max-height", `${Math.round(height)}px`);
    active.overlay.setAttribute("data-placement", placement);
    active.placement = placement;
    active.anchorRect = {
      left: anchorLeft,
      top: anchorTop,
      right: anchorRight,
      bottom: anchorBottom,
      width: anchorWidth,
      height: anchorHeight
    };
    return true;
  }

  function queueGameTileCcuGraphPosition(active = activeGameTileCcuGraph) {
    if (!active || active !== activeGameTileCcuGraph) {
      return false;
    }
    if (active.positionFrame !== null) {
      return true;
    }
    const callback = () => {
      active.positionFrame = null;
      if (active === activeGameTileCcuGraph) {
        positionGameTileCcuGraphPopover(active);
      }
    };
    if (typeof window.requestAnimationFrame === "function") {
      active.positionFrame = window.requestAnimationFrame(callback);
    } else {
      active.positionFrame = -1;
      callback();
    }
    return true;
  }

  function clearGameTileCcuGraphCloseTimer(active = activeGameTileCcuGraph) {
    if (!active) {
      return false;
    }
    if (active.closeTimer !== null) {
      window.clearTimeout(active.closeTimer);
    }
    active.closeTimer = null;
    active.closeDueAt = 0;
    return true;
  }

  function isGameTileCcuGraphFocusWithin(active) {
    const focused = document.activeElement;
    return Boolean(
      focused &&
      (active?.overlay?.contains?.(focused) ||
        focused === active?.descriptionTarget ||
        focused === active?.trigger)
    );
  }

  function getGameTileCcuGraphReturnFocusTarget(active) {
    const focusableSelector =
      'a[href], button, input, select, textarea, [tabindex]';
    const owningControl = active?.trigger?.closest?.(focusableSelector);
    return [active?.descriptionTarget, owningControl, active?.trigger].find(
      (target) =>
        target?.isConnected !== false &&
        typeof target?.focus === "function" &&
        (target === owningControl || target.matches?.(focusableSelector))
    ) || null;
  }

  function focusGameTileCcuGraphPlot(active = activeGameTileCcuGraph) {
    if (!active || active !== activeGameTileCcuGraph) {
      return false;
    }
    const interaction = active.overlay?.querySelector?.(
      ".rsl-game-ccu-graph__interaction[tabindex]"
    );
    if (!interaction?.focus) {
      active.focusPlotWhenReady = true;
      return false;
    }
    active.focusPlotWhenReady = false;
    try {
      interaction.focus({ preventScroll: true });
    } catch {
      interaction.focus();
    }
    return true;
  }

  function scheduleGameTileCcuGraphClose(
    active = activeGameTileCcuGraph,
    delay = GAME_TILE_CCU_GRAPH_CLOSE_DELAY_MS
  ) {
    if (!active || active !== activeGameTileCcuGraph || active.pinned ||
      active.triggerHovered || active.anchorHovered || active.popoverHovered ||
      isGameTileCcuGraphFocusWithin(active)) {
      return false;
    }
    if (active.closeTimer !== null) {
      return true;
    }
    clearGameTileCcuGraphCloseTimer(active);
    active.closeDueAt = Date.now() + delay;
    const timer = window.setTimeout(() => {
      if (active !== activeGameTileCcuGraph || active.closeTimer !== timer) {
        return;
      }
      active.closeTimer = null;
      active.closeDueAt = 0;
      if (!active.pinned && !active.triggerHovered &&
        !active.anchorHovered && !active.popoverHovered &&
        !isGameTileCcuGraphFocusWithin(active)) {
        closeGameTileCcuGraph();
      }
    }, delay);
    active.closeTimer = timer;
    return true;
  }

  function clearGameTileCcuGraphNotTrackedRetry(active = activeGameTileCcuGraph) {
    if (!active) {
      return false;
    }
    if (active.notTrackedRetryTimer !== null) {
      window.clearTimeout(active.notTrackedRetryTimer);
    }
    active.notTrackedRetryTimer = null;
    active.notTrackedRetryDueAt = 0;
    return true;
  }

  function scheduleGameTileCcuGraphNotTrackedRetry(
    active,
    now = Date.now()
  ) {
    if (
      !active ||
      active !== activeGameTileCcuGraph ||
      active.notTrackedRetryTimer !== null ||
      !isActiveGameTileCcuGraphCurrent(active)
    ) {
      return false;
    }
    const nextBucketAt =
      (Math.floor(now / GAME_TILE_CCU_GRAPH_BUCKET_MS) + 1) *
      GAME_TILE_CCU_GRAPH_BUCKET_MS;
    const delay = Math.max(
      GAME_TILE_CCU_GRAPH_RETRY_GRACE_MS,
      nextBucketAt - now + GAME_TILE_CCU_GRAPH_RETRY_GRACE_MS
    );
    active.notTrackedRetryDueAt = now + delay;
    const timer = window.setTimeout(() => {
      if (
        active !== activeGameTileCcuGraph ||
        active.notTrackedRetryTimer !== timer
      ) {
        return;
      }
      active.notTrackedRetryTimer = null;
      active.notTrackedRetryDueAt = 0;
      if (!isActiveGameTileCcuGraphCurrent(active)) {
        closeGameTileCcuGraph();
        return;
      }
      loadGameTileCcuGraphHistory(active, { bypassCache: true });
    }, delay);
    active.notTrackedRetryTimer = timer;
    return true;
  }

  function loadGameTileCcuGraphHistory(
    active,
    { showLoading = false, bypassCache = false } = {}
  ) {
    if (
      !active ||
      active !== activeGameTileCcuGraph ||
      !isFeatureEnabled("gameCcuHoverGraph") ||
      !isActiveGameTileCcuGraphCurrent(active)
    ) {
      return false;
    }
    const { overlay, universeId, placeId } = active;
    if (showLoading) {
      renderGameTileCcuGraphState(
        overlay,
        "loading",
        "Loading CCU history\u2026",
        "Reading saved Charts snapshots."
      );
      queueGameTileCcuGraphPosition(active);
    }
    requestGameTileCcuHistory(universeId, { bypassCache, placeId }).then(
      (history) => {
        if (
          active === activeGameTileCcuGraph &&
          !active.universeId &&
          normalizeGameTileCcuUniverseId(history.universeId)
        ) {
          active.universeId = normalizeGameTileCcuUniverseId(history.universeId);
          active.overlay.id = `rsl-game-ccu-graph-${active.universeId}`;
          setGameTileCcuGraphDescriptionTarget(
            active,
            active.descriptionTarget || active.trigger
          );
        }
        if (
          active !== activeGameTileCcuGraph ||
          !isActiveGameTileCcuGraphCurrent(active)
        ) {
          return;
        }
        // Even an empty or one-point response gets the real rolling twelve-hour
        // timeline. Hatched space is the honest visualization of time for
        // which no Charts observation has been stored yet.
        const visiblePoints = renderGameTileCcuGraph(overlay, history.points);
        // The worker deliberately retains seven days. Retry based on points in
        // the visible window, not older retained observations outside it.
        if (visiblePoints.length < 2) {
          scheduleGameTileCcuGraphNotTrackedRetry(active);
        } else {
          clearGameTileCcuGraphNotTrackedRetry(active);
        }
      },
      () => {
        if (
          active === activeGameTileCcuGraph &&
          isActiveGameTileCcuGraphCurrent(active)
        ) {
          renderGameTileCcuGraphState(
            overlay,
            "error",
            "CCU history unavailable",
            "Move away and hover again to retry."
          );
          queueGameTileCcuGraphPosition(active);
        }
      }
    );
    return true;
  }

  function closeGameTileCcuGraph({ restoreFocus = false } = {}) {
    clearGameTileCcuGraphHoverIntent();
    const active = activeGameTileCcuGraph;
    if (!active) {
      return false;
    }
    const returnFocusTarget = restoreFocus
      ? getGameTileCcuGraphReturnFocusTarget(active)
      : null;
    clearGameTileCcuGraphCloseTimer(active);
    clearGameTileCcuGraphNotTrackedRetry(active);
    if (active.positionFrame !== null && active.positionFrame !== -1 &&
      typeof window.cancelAnimationFrame === "function") {
      window.cancelAnimationFrame(active.positionFrame);
    }
    active.positionFrame = null;
    activeGameTileCcuGraph = null;
    active.overlay?.remove();
    active.host?.removeAttribute(GAME_TILE_CCU_GRAPH_HOST_ATTRIBUTE);
    active.root?.removeAttribute(GAME_TILE_CCU_GRAPH_OPEN_ATTRIBUTE);
    restoreGameTileCcuGraphControlState(active);
    restoreGameTileCcuGraphDescription(active);
    if (returnFocusTarget) {
      try {
        returnFocusTarget.focus({ preventScroll: true });
      } catch {
        returnFocusTarget.focus();
      }
    }
    return true;
  }

  function openGameTileCcuGraph(
    metric,
    { pinned = false, describedByTarget = metric } = {}
  ) {
    if (
      !isFeatureEnabled("gameCcuHoverGraph") ||
      !isUsableGameTileCcuGraphTrigger(metric)
    ) {
      return null;
    }
    if (
      activeGameTileCcuGraph?.trigger === metric &&
      isActiveGameTileCcuGraphCurrent()
    ) {
      activeGameTileCcuGraph.pinned = activeGameTileCcuGraph.pinned || pinned;
      clearGameTileCcuGraphCloseTimer(activeGameTileCcuGraph);
      if (
        describedByTarget &&
        activeGameTileCcuGraph.descriptionTarget !== describedByTarget
      ) {
        setGameTileCcuGraphDescriptionTarget(
          activeGameTileCcuGraph,
          describedByTarget
        );
      }
      queueGameTileCcuGraphPosition(activeGameTileCcuGraph);
      return activeGameTileCcuGraph.overlay;
    }
    if (activeGameTileCcuGraph?.pinned && !pinned) {
      return activeGameTileCcuGraph.overlay;
    }
    closeGameTileCcuGraph();
    const root = getGameTileCcuGraphRoot(metric);
    const identity = getGameTileCcuGraphIdentity(root);
    const host = findGameTileCcuGraphThumbnail(root);
    if (!identity || !host) {
      return null;
    }

    const overlay = makeGameTileCcuGraphElement(
      "div",
      "rsl-game-ccu-graph"
    );
    overlay.setAttribute(GAME_TILE_CCU_GRAPH_OVERLAY_ATTRIBUTE, "");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "false");
    overlay.setAttribute("aria-live", "polite");
    overlay.setAttribute("data-placement", "bottom");
    overlay.id = `rsl-game-ccu-graph-${identity.universeId || identity.placeId}`;
    root.setAttribute(GAME_TILE_CCU_GRAPH_OPEN_ATTRIBUTE, "");
    document.body.append(overlay);

    const descriptionTarget = describedByTarget || metric;
    activeGameTileCcuGraph = {
      root,
      host,
      trigger: metric,
      descriptionTarget: null,
      overlay,
      placeId: identity.placeId,
      universeId: identity.universeId,
      originalDescribedBy: null,
      pinned,
      triggerHovered: false,
      anchorHovered: false,
      popoverHovered: false,
      closeTimer: null,
      closeDueAt: 0,
      positionFrame: null,
      placement: "bottom",
      anchorRect: null,
      selectedPointIndex: null,
      selectedPointTimestamp: null,
      selectedGapTimestamp: null,
      notTrackedRetryTimer: null,
      notTrackedRetryDueAt: 0,
      controlStates: [],
      focusPlotWhenReady: false
    };
    setGameTileCcuGraphDescriptionTarget(
      activeGameTileCcuGraph,
      descriptionTarget
    );
    positionGameTileCcuGraphPopover(activeGameTileCcuGraph);
    queueGameTileCcuGraphPosition(activeGameTileCcuGraph);

    loadGameTileCcuGraphHistory(activeGameTileCcuGraph, {
      showLoading: true
    });
    return overlay;
  }

  function clearGameTileCcuGraphHoverIntent(trigger = null) {
    const intent = gameTileCcuGraphHoverIntent;
    if (!intent || (trigger && intent.trigger !== trigger)) {
      return false;
    }
    window.clearTimeout(intent.timer);
    gameTileCcuGraphHoverIntent = null;
    return true;
  }

  function scheduleGameTileCcuGraphHoverIntent(trigger) {
    if (
      !isFeatureEnabled("gameCcuHoverGraph") ||
      !isUsableGameTileCcuGraphTrigger(trigger)
    ) {
      return false;
    }
    if (gameTileCcuGraphHoverIntent?.trigger === trigger) {
      return true;
    }
    clearGameTileCcuGraphHoverIntent();
    const root = getGameTileCcuGraphRoot(trigger);
    const identity = getGameTileCcuGraphIdentity(root);
    if (!identity) {
      return false;
    }
    const intent = {
      trigger,
      placeId: identity.placeId,
      universeId: identity.universeId,
      dueAt: Date.now() + GAME_TILE_CCU_GRAPH_HOVER_DELAY_MS,
      timer: null
    };
    intent.timer = window.setTimeout(() => {
      if (gameTileCcuGraphHoverIntent !== intent) {
        return;
      }
      gameTileCcuGraphHoverIntent = null;
      const currentRoot = getGameTileCcuGraphRoot(trigger);
      const currentIdentity = getGameTileCcuGraphIdentity(currentRoot);
      if (!isUsableGameTileCcuGraphTrigger(trigger) ||
        currentIdentity?.placeId !== intent.placeId ||
        currentIdentity?.universeId !== intent.universeId) {
        return;
      }
      const overlay = openGameTileCcuGraph(trigger);
      if (overlay && activeGameTileCcuGraph?.trigger === trigger) {
        activeGameTileCcuGraph.triggerHovered = true;
        clearGameTileCcuGraphCloseTimer(activeGameTileCcuGraph);
      }
    }, GAME_TILE_CCU_GRAPH_HOVER_DELAY_MS);
    gameTileCcuGraphHoverIntent = intent;
    return true;
  }

  function isGameTileCcuGraphAnchorNode(active, node) {
    return Boolean(
      active?.host && node &&
      (node === active.host || active.host.contains?.(node))
    );
  }

  function handleGameTileCcuGraphPointerOver(event) {
    const active = activeGameTileCcuGraph;
    const popover = event.target?.closest?.(
      `[${GAME_TILE_CCU_GRAPH_OVERLAY_ATTRIBUTE}]`
    );
    if (active && popover === active.overlay) {
      active.popoverHovered = true;
      active.anchorHovered = false;
      clearGameTileCcuGraphCloseTimer(active);
      return;
    }
    if (active && isGameTileCcuGraphAnchorNode(active, event.target)) {
      active.anchorHovered = true;
      clearGameTileCcuGraphCloseTimer(active);
      return;
    }
    const trigger = getGameTileCcuGraphTrigger(event.target);
    if (!trigger) {
      return;
    }
    if (getGameTileCcuGraphTrigger(event.relatedTarget) === trigger) {
      return;
    }
    if (activeGameTileCcuGraph?.trigger === trigger &&
      isActiveGameTileCcuGraphCurrent(activeGameTileCcuGraph)) {
      activeGameTileCcuGraph.triggerHovered = true;
      clearGameTileCcuGraphCloseTimer(activeGameTileCcuGraph);
      return;
    }
    scheduleGameTileCcuGraphHoverIntent(trigger);
  }

  function handleGameTileCcuGraphPointerOut(event) {
    const active = activeGameTileCcuGraph;
    const popover = event.target?.closest?.(
      `[${GAME_TILE_CCU_GRAPH_OVERLAY_ATTRIBUTE}]`
    );
    if (active && popover === active.overlay) {
      if (active.overlay.contains?.(event.relatedTarget)) {
        return;
      }
      active.popoverHovered = false;
      if (getGameTileCcuGraphTrigger(event.relatedTarget) === active.trigger) {
        active.triggerHovered = true;
        clearGameTileCcuGraphCloseTimer(active);
      } else if (isGameTileCcuGraphAnchorNode(active, event.relatedTarget)) {
        active.anchorHovered = true;
        clearGameTileCcuGraphCloseTimer(active);
      } else {
        scheduleGameTileCcuGraphClose(active);
      }
      return;
    }
    if (active && isGameTileCcuGraphAnchorNode(active, event.target)) {
      if (isGameTileCcuGraphAnchorNode(active, event.relatedTarget)) {
        return;
      }
      active.anchorHovered = false;
      if (active.overlay.contains?.(event.relatedTarget)) {
        active.popoverHovered = true;
        clearGameTileCcuGraphCloseTimer(active);
      } else if (
        getGameTileCcuGraphTrigger(event.relatedTarget) === active.trigger
      ) {
        active.triggerHovered = true;
        clearGameTileCcuGraphCloseTimer(active);
      } else {
        scheduleGameTileCcuGraphClose(active);
      }
      return;
    }
    const trigger = getGameTileCcuGraphTrigger(event.target);
    if (trigger && getGameTileCcuGraphTrigger(event.relatedTarget) !== trigger) {
      clearGameTileCcuGraphHoverIntent(trigger);
    }
    if (
      !trigger ||
      active?.trigger !== trigger ||
      getGameTileCcuGraphTrigger(event.relatedTarget) === trigger
    ) {
      return;
    }
    active.triggerHovered = false;
    if (active.overlay.contains?.(event.relatedTarget)) {
      active.popoverHovered = true;
      clearGameTileCcuGraphCloseTimer(active);
    } else if (isGameTileCcuGraphAnchorNode(active, event.relatedTarget)) {
      active.anchorHovered = true;
      clearGameTileCcuGraphCloseTimer(active);
    } else {
      scheduleGameTileCcuGraphClose(active);
    }
  }

  function isGameTileCcuGraphPointerInside(node, clientX, clientY) {
    const rect = node?.getBoundingClientRect?.();
    if (!rect || !Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      return false;
    }
    const left = Number(rect.left) || 0;
    const top = Number(rect.top) || 0;
    const right = Number.isFinite(Number(rect.right))
      ? Number(rect.right)
      : left + (Number(rect.width) || 0);
    const bottom = Number.isFinite(Number(rect.bottom))
      ? Number(rect.bottom)
      : top + (Number(rect.height) || 0);
    return clientX >= left && clientX <= right &&
      clientY >= top && clientY <= bottom;
  }

  function handleGameTileCcuGraphPointerMove(event) {
    const active = activeGameTileCcuGraph;
    if (!active || !Number.isFinite(event.clientX) ||
      !Number.isFinite(event.clientY)) {
      return;
    }
    const overPopover = isGameTileCcuGraphPointerInside(
      active.overlay,
      event.clientX,
      event.clientY
    );
    const overTrigger = isGameTileCcuGraphPointerInside(
      active.trigger,
      event.clientX,
      event.clientY
    );
    const overAnchor = isGameTileCcuGraphPointerInside(
      active.host,
      event.clientX,
      event.clientY
    );
    active.popoverHovered = overPopover;
    active.triggerHovered = overTrigger;
    active.anchorHovered = overAnchor;
    active.overlay.toggleAttribute("data-pointer-within", overPopover);
    if (overPopover || overTrigger || overAnchor) {
      clearGameTileCcuGraphCloseTimer(active);
    } else {
      scheduleGameTileCcuGraphClose(active);
    }
  }

  function handleGameTileCcuGraphFocusIn(event) {
    if (activeGameTileCcuGraph?.overlay?.contains?.(event.target)) {
      clearGameTileCcuGraphCloseTimer(activeGameTileCcuGraph);
      return;
    }
    const trigger = getGameTileCcuGraphFocusTrigger(event.target);
    if (trigger) {
      clearGameTileCcuGraphHoverIntent();
      const overlay = openGameTileCcuGraph(trigger, {
        describedByTarget: event.target
      });
      if (overlay) {
        clearGameTileCcuGraphCloseTimer(activeGameTileCcuGraph);
      }
    }
  }

  function handleGameTileCcuGraphFocusOut(event) {
    if (activeGameTileCcuGraph?.overlay?.contains?.(event.target)) {
      queueMicrotask(() => {
        if (activeGameTileCcuGraph &&
          !isGameTileCcuGraphFocusWithin(activeGameTileCcuGraph)) {
          scheduleGameTileCcuGraphClose(activeGameTileCcuGraph);
        }
      });
      return;
    }
    const trigger = getGameTileCcuGraphFocusTrigger(event.target);
    if (!trigger || activeGameTileCcuGraph?.trigger !== trigger) {
      return;
    }
    queueMicrotask(() => {
      if (
        activeGameTileCcuGraph?.trigger === trigger &&
        !activeGameTileCcuGraph.pinned &&
        !isGameTileCcuGraphFocusWithin(activeGameTileCcuGraph)
      ) {
        scheduleGameTileCcuGraphClose(activeGameTileCcuGraph);
      }
    });
  }

  function togglePinnedGameTileCcuGraph(trigger) {
    if (
      activeGameTileCcuGraph?.trigger === trigger &&
      activeGameTileCcuGraph.pinned
    ) {
      closeGameTileCcuGraph();
    } else {
      openGameTileCcuGraph(trigger, { pinned: true });
    }
  }

  function handleGameTileCcuGraphClick(event) {
    if (activeGameTileCcuGraph?.overlay?.contains?.(event.target)) {
      clearGameTileCcuGraphCloseTimer(activeGameTileCcuGraph);
      return;
    }
    const trigger = getGameTileCcuGraphTrigger(event.target);
    if (!trigger) {
      if (activeGameTileCcuGraph) {
        closeGameTileCcuGraph();
      }
      return;
    }
    if (trigger.closest?.("a[href]")) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    togglePinnedGameTileCcuGraph(trigger);
  }

  function handleGameTileCcuGraphKeyDown(event) {
    if (event.key === "Escape" && activeGameTileCcuGraph) {
      const restoreFocus = Boolean(
        activeGameTileCcuGraph.overlay?.contains?.(event.target)
      );
      event.preventDefault();
      event.stopPropagation();
      closeGameTileCcuGraph({ restoreFocus });
      return;
    }
    const trigger = getGameTileCcuGraphFocusTrigger(event.target);
    if (trigger && (event.key === "ArrowDown" || event.key === "F2")) {
      event.preventDefault();
      event.stopPropagation();
      const overlay = openGameTileCcuGraph(trigger, {
        describedByTarget: event.target
      });
      if (overlay && activeGameTileCcuGraph?.trigger === trigger) {
        focusGameTileCcuGraphPlot(activeGameTileCcuGraph);
      }
      return;
    }
    if (trigger && !trigger.closest?.("a[href]") &&
      (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      event.stopPropagation();
      togglePinnedGameTileCcuGraph(trigger);
    }
  }

  function handleGameTileCcuGraphViewportChange() {
    if (validateActiveGameTileCcuGraph()) {
      queueGameTileCcuGraphPosition(activeGameTileCcuGraph);
    }
  }

  function ensureGameTileCcuGraphEvents() {
    if (
      gameTileCcuGraphEventsBound ||
      !isFeatureEnabled("gameCcuHoverGraph") ||
      !document.addEventListener
    ) {
      return;
    }
    gameTileCcuGraphEventsBound = true;
    document.addEventListener("pointerover", handleGameTileCcuGraphPointerOver, true);
    document.addEventListener("pointerout", handleGameTileCcuGraphPointerOut, true);
    document.addEventListener("pointermove", handleGameTileCcuGraphPointerMove, true);
    document.addEventListener("focusin", handleGameTileCcuGraphFocusIn, true);
    document.addEventListener("focusout", handleGameTileCcuGraphFocusOut, true);
    document.addEventListener("click", handleGameTileCcuGraphClick, true);
    document.addEventListener("keydown", handleGameTileCcuGraphKeyDown, true);
    window.addEventListener?.("resize", handleGameTileCcuGraphViewportChange);
    window.addEventListener?.("scroll", handleGameTileCcuGraphViewportChange, true);
    window.visualViewport?.addEventListener?.(
      "resize",
      handleGameTileCcuGraphViewportChange
    );
    window.visualViewport?.addEventListener?.(
      "scroll",
      handleGameTileCcuGraphViewportChange
    );
  }

  function removeGameTileCcuGraphEvents() {
    clearGameTileCcuGraphHoverIntent();
    if (!gameTileCcuGraphEventsBound || !document.removeEventListener) {
      gameTileCcuGraphEventsBound = false;
      return;
    }
    gameTileCcuGraphEventsBound = false;
    document.removeEventListener("pointerover", handleGameTileCcuGraphPointerOver, true);
    document.removeEventListener("pointerout", handleGameTileCcuGraphPointerOut, true);
    document.removeEventListener("pointermove", handleGameTileCcuGraphPointerMove, true);
    document.removeEventListener("focusin", handleGameTileCcuGraphFocusIn, true);
    document.removeEventListener("focusout", handleGameTileCcuGraphFocusOut, true);
    document.removeEventListener("click", handleGameTileCcuGraphClick, true);
    document.removeEventListener("keydown", handleGameTileCcuGraphKeyDown, true);
    window.removeEventListener?.("resize", handleGameTileCcuGraphViewportChange);
    window.removeEventListener?.("scroll", handleGameTileCcuGraphViewportChange, true);
    window.visualViewport?.removeEventListener?.(
      "resize",
      handleGameTileCcuGraphViewportChange
    );
    window.visualViewport?.removeEventListener?.(
      "scroll",
      handleGameTileCcuGraphViewportChange
    );
  }

  function cleanupGameTileCcuGraphDisplay() {
    gameTileCcuGraphLifecycleEpoch += 1;
    closeGameTileCcuGraph();
    removeGameTileCcuGraphEvents();
    gameTileCcuGraphHistoryRequests.clear();
    gameTileCcuGraphHistoryCache.clear();
    gameTileCcuGraphUniverseByPlaceId.clear();
    document
      .querySelectorAll(`[${GAME_TILE_CCU_GRAPH_TRIGGER_ATTRIBUTE}]`)
      .forEach(restoreGameTileCcuGraphTrigger);
    document
      .querySelectorAll(`[${GAME_TILE_CCU_GRAPH_OVERLAY_ATTRIBUTE}]`)
      .forEach((overlay) => overlay.remove());
    document
      .querySelectorAll(`[${GAME_TILE_CCU_GRAPH_HOST_ATTRIBUTE}]`)
      .forEach((host) => host.removeAttribute(GAME_TILE_CCU_GRAPH_HOST_ATTRIBUTE));
    document
      .querySelectorAll(`[${GAME_TILE_CCU_GRAPH_OPEN_ATTRIBUTE}]`)
      .forEach((root) => root.removeAttribute(GAME_TILE_CCU_GRAPH_OPEN_ATTRIBUTE));
  }

  function syncGameTileCcu(
    root,
    expectedPlaceId,
    playing,
    expectedUniverseId = undefined,
    ratingPercentage = null
  ) {
    const sponsoredFooter = normalizeSponsoredGameTileRatings(root);
    const external = syncExternalGameTileCcuState(root);
    if (
      !Number.isSafeInteger(playing) ||
      playing < 0 ||
      !isCurrentGameTileCcuRoot(root, expectedPlaceId, expectedUniverseId)
    ) {
      root?.querySelectorAll?.(
        `[${GAME_TILE_CCU_CONTAINER_ATTRIBUTE}], ` +
          `[${GAME_TILE_CCU_ATTRIBUTE}], ` +
          `[${GAME_TILE_CCU_ICON_ATTRIBUTE}], ` +
          `[${GAME_TILE_CCU_VALUE_ATTRIBUTE}], ` +
          `[${GAME_TILE_RATING_ICON_ATTRIBUTE}], ` +
          `[${GAME_TILE_RATING_VALUE_ATTRIBUTE}]`
      ).forEach((node) => node.remove());
      return false;
    }

    const externalRating = syncExternalGameTileRatingState(root);
    const validRating = Number.isSafeInteger(ratingPercentage) &&
      ratingPercentage >= 0 &&
      ratingPercentage <= 100;
    const shouldOwnCcu = !external;
    const shouldOwnRating = !externalRating && validRating;
    if (!shouldOwnCcu && !shouldOwnRating) {
      removeOwnedGameTileCcu(root);
      return false;
    }

    const metadata = root.querySelector(".wide-game-tile-metadata");
    const nativeStatsInfo = root.querySelector(
      '.wide-game-tile-metadata .base-metadata > ' +
        '.game-card-info[data-testid="game-tile-stats"]'
    );
    const externalRatingInfo = externalRating?.closest?.(".game-card-info") || null;
    const visibleExternalRatingInfo =
      externalRatingInfo &&
      externalRatingInfo.closest?.(".base-metadata")?.closest?.(
        ".wide-game-tile-metadata"
      ) &&
      !externalRatingInfo.closest?.('[aria-hidden="true"]')
        ? externalRatingInfo
        : null;
    const nativeMetricInfo =
      nativeStatsInfo && !nativeStatsInfo.closest?.('[aria-hidden="true"]')
        ? nativeStatsInfo
        : visibleExternalRatingInfo;
    let container = root.querySelector(`[${GAME_TILE_CCU_CONTAINER_ATTRIBUTE}]`);
    let info = null;
    if (sponsoredFooter) {
      // Keep the owned player count in Roblox's visible metric group. The
      // hidden sizing clone sits between that group and the end of the footer,
      // so appending to the footer itself bypasses Roblox's normal metric
      // spacing and makes sponsored rows look different from regular rows.
      info = Array.from(sponsoredFooter.children || []).find(
        (child) =>
          child.matches?.(".secondary-content:not(.bullet)") &&
          child.querySelector?.(".vote-percentage-label")
      ) || sponsoredFooter;
      container?.remove();
      container = null;
    } else if (nativeMetricInfo) {
      // A normal Roblox/BTR row can publish its vote metric before its player
      // count. Keep our temporary count in that same native row so the two
      // metrics never split between the footer and the game-name row while
      // the competing extension finishes loading.
      info = nativeMetricInfo;
      container?.remove();
      container = null;
    } else {
      if (!container) {
        container = document.createElement("div");
        container.setAttribute(GAME_TILE_CCU_CONTAINER_ATTRIBUTE, "");
        const fallbackHost = root.querySelector(".info-metadata-container") ||
          metadata ||
          root;
        fallbackHost.append(container);
      }
      const usesMetadataCorner =
        container.parentElement?.matches?.(".info-metadata-container") === true;
      container.className = usesMetadataCorner
        ? "rsl-game-tile-ccu-metadata rsl-game-tile-ccu-metadata--corner"
        : "rsl-game-tile-ccu-metadata";
      info = container.querySelector(`[${GAME_TILE_CCU_ATTRIBUTE}]`);
      if (!info) {
        info = document.createElement("div");
        info.className = "game-card-info";
        info.setAttribute(GAME_TILE_CCU_ATTRIBUTE, "");
        container.append(info);
      }
      info.setAttribute(GAME_TILE_CCU_PLACE_ID_ATTRIBUTE, expectedPlaceId);
      container.setAttribute(GAME_TILE_CCU_PLACE_ID_ATTRIBUTE, expectedPlaceId);
    }

    let ratingIcon = root.querySelector(`[${GAME_TILE_RATING_ICON_ATTRIBUTE}]`);
    let ratingValue = root.querySelector(`[${GAME_TILE_RATING_VALUE_ATTRIBUTE}]`);
    if (shouldOwnRating) {
      if (!ratingIcon) {
        ratingIcon = document.createElement("span");
        ratingIcon.className = "info-label icon-votes-gray";
        ratingIcon.setAttribute(GAME_TILE_RATING_ICON_ATTRIBUTE, "");
      }
      if (!ratingValue) {
        ratingValue = document.createElement("span");
        ratingValue.className = "info-label vote-percentage-label";
        ratingValue.setAttribute(GAME_TILE_RATING_VALUE_ATTRIBUTE, "");
      }
      ratingIcon.setAttribute("aria-hidden", "true");
      ratingIcon.setAttribute(GAME_TILE_CCU_PLACE_ID_ATTRIBUTE, expectedPlaceId);
      ratingValue.setAttribute(GAME_TILE_CCU_PLACE_ID_ATTRIBUTE, expectedPlaceId);
      const nextRatingText = `${ratingPercentage}%`;
      if (ratingValue.textContent !== nextRatingText) {
        ratingValue.textContent = nextRatingText;
      }
      ratingValue.setAttribute("aria-label", `${ratingPercentage}% rating`);
      ratingValue.title = `${ratingPercentage}% rating`;
    } else {
      ratingIcon?.remove();
      ratingValue?.remove();
      ratingIcon = null;
      ratingValue = null;
    }

    let icon = root.querySelector(`[${GAME_TILE_CCU_ICON_ATTRIBUTE}]`);
    let value = root.querySelector(`[${GAME_TILE_CCU_VALUE_ATTRIBUTE}]`);
    if (shouldOwnCcu) {
      if (!icon) {
        icon = document.createElement("span");
        icon.className = "info-label icon-playing-counts-gray";
        icon.setAttribute(GAME_TILE_CCU_ICON_ATTRIBUTE, "");
      }
      if (!value) {
        value = document.createElement("span");
        value.className = "info-label playing-counts-label";
        value.setAttribute(GAME_TILE_CCU_VALUE_ATTRIBUTE, "");
      }
    } else {
      icon?.remove();
      value?.remove();
      icon = null;
      value = null;
    }
    const metricNodes = [ratingIcon, ratingValue, icon, value].filter(Boolean);
    const infoChildren = Array.from(info.children || []);
    const metricsAreExactTail = metricNodes.length > 0 &&
      infoChildren.length >= metricNodes.length &&
      metricNodes.every(
        (node, index) =>
          infoChildren[infoChildren.length - metricNodes.length + index] === node
      );
    if (!metricsAreExactTail) {
      info.append(...metricNodes);
    }
    root.querySelectorAll(`[${GAME_TILE_CCU_ICON_ATTRIBUTE}]`).forEach((node) => {
      if (node !== icon) {
        node.remove();
      }
    });
    root.querySelectorAll(`[${GAME_TILE_CCU_VALUE_ATTRIBUTE}]`).forEach((node) => {
      if (node !== value) {
        node.remove();
      }
    });
    root.querySelectorAll(`[${GAME_TILE_RATING_ICON_ATTRIBUTE}]`).forEach((node) => {
      if (node !== ratingIcon) {
        node.remove();
      }
    });
    root.querySelectorAll(`[${GAME_TILE_RATING_VALUE_ATTRIBUTE}]`).forEach((node) => {
      if (node !== ratingValue) {
        node.remove();
      }
    });

    if (shouldOwnCcu) {
      let displayValue;
      let exactValue;
      try {
        displayValue = formatGameTileCcuCompactCount(playing);
        exactValue = new Intl.NumberFormat().format(playing);
      } catch {
        displayValue = formatGameTileCcuCompactCount(playing);
        exactValue = String(playing);
      }
      if (value.textContent !== displayValue) {
        value.textContent = displayValue;
      }
      icon.setAttribute("aria-hidden", "true");
      value.setAttribute("aria-label", `${exactValue} players playing`);
      value.title = `${exactValue} players playing`;
      icon.setAttribute(GAME_TILE_CCU_PLACE_ID_ATTRIBUTE, expectedPlaceId);
      value.setAttribute(GAME_TILE_CCU_PLACE_ID_ATTRIBUTE, expectedPlaceId);
    }
    return true;
  }

  function getCachedGameTileCcu(
    identity,
    now = Date.now(),
    needsRating = false
  ) {
    const cached = gameTileCcuCacheByPlaceId.get(identity.placeId);
    if (!cached) {
      return null;
    }
    if (cached.expiresAt <= now) {
      gameTileCcuCacheByPlaceId.delete(identity.placeId);
      return null;
    }
    if (
      identity.universeId &&
      cached.universeId &&
      identity.universeId !== cached.universeId
    ) {
      return null;
    }
    if (needsRating && cached.ratingAttempted !== true) {
      return null;
    }
    gameTileCcuCacheByPlaceId.delete(identity.placeId);
    gameTileCcuCacheByPlaceId.set(identity.placeId, cached);
    return cached;
  }

  function setCachedGameTileCcu(placeId, value) {
    gameTileCcuCacheByPlaceId.delete(placeId);
    gameTileCcuCacheByPlaceId.set(placeId, value);
    while (gameTileCcuCacheByPlaceId.size > GAME_TILE_CCU_CACHE_MAX_ENTRIES) {
      gameTileCcuCacheByPlaceId.delete(gameTileCcuCacheByPlaceId.keys().next().value);
    }
  }

  function scheduleGameTileCcuRefresh(dueAt) {
    if (!Number.isFinite(dueAt)) {
      return;
    }
    if (gameTileCcuRefreshTimer && gameTileCcuRefreshTimerDueAt <= dueAt) {
      return;
    }
    window.clearTimeout(gameTileCcuRefreshTimer);
    gameTileCcuRefreshTimerDueAt = dueAt;
    gameTileCcuRefreshTimer = window.setTimeout(() => {
      gameTileCcuRefreshTimer = null;
      gameTileCcuRefreshTimerDueAt = 0;
      if (isFeatureEnabled("gameCcu")) {
        mountGameTileCcu();
      }
    }, Math.max(0, dueAt - Date.now()));
  }

  function queueGameTileCcuRoot(root, identity) {
    let queued = gameTileCcuQueuedByPlaceId.get(identity.placeId);
    if (!queued) {
      queued = {
        placeId: identity.placeId,
        universeId: identity.universeId,
        roots: new Set()
      };
      gameTileCcuQueuedByPlaceId.set(identity.placeId, queued);
    }
    queued.roots.add(root);
  }

  function setGameTileCcuRetry(placeIds, now = Date.now()) {
    const retryAt = now + GAME_TILE_CCU_RETRY_DELAY_MS;
    placeIds.forEach((placeId) => gameTileCcuRetryAfterByPlaceId.set(placeId, retryAt));
    scheduleGameTileCcuRefresh(retryAt);
  }

  function sendGameTileCcuBatch(items, lifecycleEpoch) {
    items = items.flatMap((item) => {
      const roots = item.roots.filter((root) => {
        const identity = getGameTileCcuCardIdentity(root);
        const expectedIdentity = gameTileCcuIdentityByRoot.get(root);
        const external = syncExternalGameTileCcuState(root);
        const rootNeedsRating = needsGameTileRating(root);
        if (
          !identity ||
          !expectedIdentity ||
          identity.placeId !== item.placeId ||
          identity.universeId !== expectedIdentity.universeId ||
          (external && !rootNeedsRating)
        ) {
          removeOwnedGameTileCcu(root);
          return false;
        }
        if (external) {
          removeOwnedGameTileCcuCount(root);
        }
        return true;
      });
      return roots.length > 0
        ? [{
            ...item,
            needsRating: roots.some((root) => needsGameTileRating(root)),
            roots
          }]
        : [];
    });
    if (items.length === 0) {
      return Promise.resolve();
    }
    gameTileCcuRequestId = gameTileCcuRequestId >= Number.MAX_SAFE_INTEGER
      ? 1
      : gameTileCcuRequestId + 1;
    const requestId = gameTileCcuRequestId;
    items.forEach((item) => gameTileCcuPendingPlaceIds.add(item.placeId));

    return new Promise((resolve) => {
      const finishWithFailure = () => {
        if (lifecycleEpoch === gameTileCcuLifecycleEpoch) {
          items.forEach((item) => gameTileCcuPendingPlaceIds.delete(item.placeId));
          setGameTileCcuRetry(items.map((item) => item.placeId));
        }
        resolve();
      };
      try {
        chrome.runtime.sendMessage(
          {
            type: GAME_TILE_CCU_MESSAGE_TYPE,
            requestId,
            games: items.map(({ placeId, universeId, needsRating }) => ({
              placeId,
              universeId,
              needsRating: needsRating === true
            }))
          },
          (response) => {
            if (chrome.runtime.lastError) {
              finishWithFailure();
              return;
            }
            if (
              lifecycleEpoch !== gameTileCcuLifecycleEpoch ||
              !isFeatureEnabled("gameCcu")
            ) {
              resolve();
              return;
            }
            items.forEach((item) => gameTileCcuPendingPlaceIds.delete(item.placeId));
            if (
              !response?.ok ||
              response.requestId !== requestId ||
              !Array.isArray(response.games)
            ) {
              setGameTileCcuRetry(items.map((item) => item.placeId));
              resolve();
              return;
            }

            const rowsByPlaceId = new Map();
            response.games.forEach((row) => {
              const placeId = typeof row?.placeId === "string"
                ? normalizeGameTileCcuPlaceId(row.placeId)
                : null;
              const universeId = typeof row?.universeId === "string"
                ? normalizeGameTileCcuUniverseId(row.universeId)
                : null;
              if (
                placeId &&
                universeId &&
                Number.isSafeInteger(row.playing) &&
                row.playing >= 0 &&
                items.some(
                  (item) =>
                    item.placeId === placeId &&
                    (!item.universeId || item.universeId === universeId)
                )
              ) {
                const ratingKnown = row.ratingKnown === true &&
                  (row.ratingPercentage === null ||
                    (Number.isSafeInteger(row.ratingPercentage) &&
                      row.ratingPercentage >= 0 &&
                      row.ratingPercentage <= 100));
                rowsByPlaceId.set(placeId, {
                  universeId,
                  playing: row.playing,
                  ratingKnown,
                  ratingPercentage: ratingKnown ? row.ratingPercentage : null
                });
              }
            });

            const missingPlaceIds = [];
            const now = Date.now();
            items.forEach((item) => {
              const row = rowsByPlaceId.get(item.placeId);
              if (!row) {
                missingPlaceIds.push(item.placeId);
                return;
              }
              gameTileCcuRetryAfterByPlaceId.delete(item.placeId);
              setCachedGameTileCcu(item.placeId, {
                universeId: row.universeId,
                playing: row.playing,
                ratingAttempted: item.needsRating === true,
                ratingKnown: row.ratingKnown,
                ratingPercentage: row.ratingPercentage,
                expiresAt: now + GAME_TILE_CCU_CACHE_TTL_MS
              });
              item.roots.forEach((root) => {
                syncGameTileCcu(
                  root,
                  item.placeId,
                  row.playing,
                  item.universeId,
                  row.ratingPercentage
                );
              });
            });
            if (missingPlaceIds.length > 0) {
              setGameTileCcuRetry(missingPlaceIds, now);
            }
            scheduleGameTileCcuRefresh(now + GAME_TILE_CCU_CACHE_TTL_MS);
            resolve();
          }
        );
      } catch {
        finishWithFailure();
      }
    });
  }

  function flushGameTileCcuRequests(now = Date.now()) {
    if (!isFeatureEnabled("gameCcu")) {
      return Promise.resolve([]);
    }
    const requestItems = [];
    let nextRefreshAt = Infinity;

    for (const [placeId, queued] of gameTileCcuQueuedByPlaceId) {
      const readyRoots = [];
      for (const root of Array.from(queued.roots)) {
        const expectedIdentity = gameTileCcuIdentityByRoot.get(root);
        const identity = getGameTileCcuCardIdentity(root);
        if (
          !expectedIdentity ||
          !identity ||
          identity.placeId !== placeId ||
          expectedIdentity.placeId !== placeId ||
          expectedIdentity.universeId !== identity.universeId
        ) {
          queued.roots.delete(root);
          removeOwnedGameTileCcu(root);
          continue;
        }
        const external = syncExternalGameTileCcuState(root);
        const rootNeedsRating = needsGameTileRating(root);
        if (external) {
          removeOwnedGameTileCcuCount(root);
          if (!rootNeedsRating) {
            queued.roots.delete(root);
            gameTileCcuIdentityByRoot.delete(root);
            removeOwnedGameTileRating(root);
            continue;
          }
        }
        readyRoots.push(root);
        queued.roots.delete(root);
      }
      if (queued.roots.size === 0) {
        gameTileCcuQueuedByPlaceId.delete(placeId);
      }
      if (readyRoots.length === 0) {
        continue;
      }

      const identity = getGameTileCcuCardIdentity(readyRoots[0]);
      if (!identity) {
        continue;
      }
      const needsRating = readyRoots.some((root) => needsGameTileRating(root));
      const cached = getCachedGameTileCcu(identity, now, needsRating);
      if (cached) {
        readyRoots.forEach((root) =>
          syncGameTileCcu(
            root,
            placeId,
            cached.playing,
            identity.universeId,
            cached.ratingPercentage
          )
        );
        nextRefreshAt = Math.min(nextRefreshAt, cached.expiresAt);
        continue;
      }
      const retryAt = gameTileCcuRetryAfterByPlaceId.get(placeId) || 0;
      if (retryAt > now) {
        nextRefreshAt = Math.min(nextRefreshAt, retryAt);
        continue;
      }
      if (gameTileCcuPendingPlaceIds.has(placeId)) {
        continue;
      }
      requestItems.push({
        placeId,
        universeId: identity.universeId,
        needsRating,
        roots: readyRoots
      });
    }

    if (Number.isFinite(nextRefreshAt)) {
      scheduleGameTileCcuRefresh(nextRefreshAt);
    }
    const lifecycleEpoch = gameTileCcuLifecycleEpoch;
    const requests = [];
    for (let index = 0; index < requestItems.length; index += GAME_TILE_CCU_MAX_BATCH_SIZE) {
      requests.push(
        sendGameTileCcuBatch(
          requestItems.slice(index, index + GAME_TILE_CCU_MAX_BATCH_SIZE),
          lifecycleEpoch
        )
      );
    }
    if (requests.length === 0) {
      return Promise.resolve([]);
    }
    return Promise.all(requests).then((results) => {
      if (
        lifecycleEpoch === gameTileCcuLifecycleEpoch &&
        isFeatureEnabled("gameCcu")
      ) {
        mountGameTileCcu();
      }
      return results;
    });
  }

  function getGameTileCcuWideRoots() {
    const roots = new Set();
    document.querySelectorAll(GAME_TILE_CCU_WIDE_CARD_SELECTOR).forEach((root) => {
      if (
        root.matches?.("[data-testid='wide-game-tile'], .large-game-tile") &&
        root.querySelector?.(".featured-game-container, .large-game-tile")
      ) {
        return;
      }
      roots.add(root);
    });
    return roots;
  }

  function mountGameTileCcu() {
    if (!isFeatureEnabled("gameCcu")) {
      return;
    }
    normalizeSponsoredGameTileRatings(document);
    const now = Date.now();
    const mountedRoots = getGameTileCcuWideRoots();
    mountedRoots.forEach((root) => {
      const identity = getGameTileCcuCardIdentity(root);
      if (!identity) {
        forgetGameTileCcuRoot(root);
        removeOwnedGameTileCcu(root);
        return;
      }
      const external = syncExternalGameTileCcuState(root);
      const rootNeedsRating = needsGameTileRating(root);
      if (external) {
        removeOwnedGameTileCcuCount(root);
        if (!rootNeedsRating) {
          forgetGameTileCcuRoot(root);
          removeOwnedGameTileRating(root);
          return;
        }
      }

      let expectedIdentity = gameTileCcuIdentityByRoot.get(root);
      if (
        !expectedIdentity ||
        expectedIdentity.placeId !== identity.placeId ||
        expectedIdentity.universeId !== identity.universeId
      ) {
        forgetGameTileCcuRoot(root);
        removeOwnedGameTileCcu(root);
        expectedIdentity = {
          placeId: identity.placeId,
          universeId: identity.universeId
        };
        gameTileCcuIdentityByRoot.set(root, expectedIdentity);
      }

      const needsRating = rootNeedsRating;
      const cached = getCachedGameTileCcu(identity, now, needsRating);
      if (cached) {
        syncGameTileCcu(
          root,
          identity.placeId,
          cached.playing,
          identity.universeId,
          cached.ratingPercentage
        );
        scheduleGameTileCcuRefresh(cached.expiresAt);
        return;
      }
      if (!gameTileCcuPendingPlaceIds.has(identity.placeId)) {
        queueGameTileCcuRoot(root, identity);
      }
    });

    document
      .querySelectorAll(
        `[${GAME_TILE_CCU_CONTAINER_ATTRIBUTE}], ` +
          `[${GAME_TILE_CCU_ICON_ATTRIBUTE}], ` +
          `[${GAME_TILE_CCU_VALUE_ATTRIBUTE}], ` +
          `[${GAME_TILE_RATING_ICON_ATTRIBUTE}], ` +
          `[${GAME_TILE_RATING_VALUE_ATTRIBUTE}]`
      )
      .forEach((owned) => {
        const root = getGameTileCcuOwnedRoot(owned);
        if (!root || !mountedRoots.has(root)) {
          owned.remove();
        }
      });
    void flushGameTileCcuRequests(now);
  }

  function invalidateStaleGameTileCcuControls(mutations) {
    if (isFeatureEnabled("gameCcuHoverGraph")) {
      if (gameTileCcuGraphHoverIntent &&
        !isUsableGameTileCcuGraphTrigger(gameTileCcuGraphHoverIntent.trigger)) {
        clearGameTileCcuGraphHoverIntent();
      }
      validateActiveGameTileCcuGraph();
      const graphMetricChanged = mutations.some((mutation) => {
        const nodes = [
          mutation.target?.nodeType === Node.ELEMENT_NODE
            ? mutation.target
            : mutation.target?.parentElement,
          ...Array.from(mutation.addedNodes || []),
          ...Array.from(mutation.removedNodes || [])
        ].filter(Boolean);
        return nodes.some((node) => {
          const element = node?.nodeType === Node.ELEMENT_NODE
            ? node
            : node?.parentElement;
          return Boolean(
            element?.matches?.(".playing-counts-label") ||
            element?.closest?.(".playing-counts-label") ||
            element?.querySelector?.(".playing-counts-label")
          );
        });
      });
      if (graphMetricChanged) {
        mountGameTileCcuGraphTriggers();
      }
    }
    if (!isFeatureEnabled("gameCcu")) {
      return;
    }
    const touchedRatingScopes = new Set();
    const ratingScopeSelector =
      `.game-card-info, ${GAME_TILE_SPONSORED_FOOTER_SELECTOR}`;
    const collectRatingScopes = (node) => {
      const element = node?.nodeType === Node.ELEMENT_NODE
        ? node
        : node?.parentElement;
      if (!element) {
        return;
      }
      const closestScope = element.matches?.(ratingScopeSelector)
        ? element
        : element.closest?.(ratingScopeSelector);
      if (closestScope) {
        touchedRatingScopes.add(closestScope);
      }
      element.querySelectorAll?.(ratingScopeSelector).forEach(
        (scope) => touchedRatingScopes.add(scope)
      );
    };
    mutations.forEach((mutation) => {
      collectRatingScopes(mutation.target);
      mutation.addedNodes?.forEach(collectRatingScopes);
    });
    touchedRatingScopes.forEach((scope) =>
      normalizeSponsoredGameTileRatings(scope)
    );

    const affectedRoots = new Set();
    let shouldRemountGameTileCcu = false;
    mutations.forEach((mutation) => {
      const element = mutation.target?.nodeType === Node.ELEMENT_NODE
        ? mutation.target
        : mutation.target?.parentElement;
      const root = element?.closest?.(GAME_TILE_CCU_WIDE_CARD_SELECTOR);
      if (root) {
        affectedRoots.add(root);
      }
    });
    affectedRoots.forEach((root) => {
      const hadExternal = root.hasAttribute?.(GAME_TILE_CCU_EXTERNAL_ATTRIBUTE) === true;
      const hadExternalRating =
        root.hasAttribute?.(GAME_TILE_RATING_EXTERNAL_ATTRIBUTE) === true;
      normalizeSponsoredGameTileRatings(root);
      const external = syncExternalGameTileCcuState(root);
      const externalRating = syncExternalGameTileRatingState(root);
      if (external) {
        removeOwnedGameTileCcuCount(root);
      }
      if (externalRating) {
        removeOwnedGameTileRating(root);
      }
      if (
        hadExternal !== Boolean(external) ||
        hadExternalRating !== Boolean(externalRating)
      ) {
        shouldRemountGameTileCcu = true;
      }
      const owned = root.querySelector?.(
        `[${GAME_TILE_CCU_CONTAINER_ATTRIBUTE}], ` +
          `[${GAME_TILE_CCU_ICON_ATTRIBUTE}], ` +
          `[${GAME_TILE_CCU_VALUE_ATTRIBUTE}], ` +
          `[${GAME_TILE_RATING_ICON_ATTRIBUTE}], ` +
          `[${GAME_TILE_RATING_VALUE_ATTRIBUTE}]`
      );
      if (!owned) {
        return;
      }
      const expectedPlaceId = owned.getAttribute(GAME_TILE_CCU_PLACE_ID_ATTRIBUTE) ||
        owned.querySelector?.(`[${GAME_TILE_CCU_PLACE_ID_ATTRIBUTE}]`)?.getAttribute(
          GAME_TILE_CCU_PLACE_ID_ATTRIBUTE
        );
      const identity = getGameTileCcuCardIdentity(root);
      const expectedIdentity = gameTileCcuIdentityByRoot.get(root);
      if (
        !expectedPlaceId ||
        !identity ||
        identity.placeId !== expectedPlaceId ||
        (expectedIdentity && identity.universeId !== expectedIdentity.universeId)
      ) {
        forgetGameTileCcuRoot(root);
        removeOwnedGameTileCcu(root);
      }
    });
    if (shouldRemountGameTileCcu) {
      mountGameTileCcu();
    }
  }

  function cleanupGameTileCcuFeature() {
    gameTileCcuLifecycleEpoch += 1;
    window.clearTimeout(gameTileCcuRefreshTimer);
    gameTileCcuRefreshTimer = null;
    gameTileCcuRefreshTimerDueAt = 0;
    gameTileCcuIdentityByRoot = new WeakMap();
    gameTileCcuQueuedByPlaceId.clear();
    gameTileCcuPendingPlaceIds.clear();
    gameTileCcuRetryAfterByPlaceId.clear();
    document
      .querySelectorAll(
        `[${GAME_TILE_CCU_CONTAINER_ATTRIBUTE}], ` +
          `[${GAME_TILE_CCU_ATTRIBUTE}], ` +
          `[${GAME_TILE_CCU_ICON_ATTRIBUTE}], ` +
          `[${GAME_TILE_CCU_VALUE_ATTRIBUTE}], ` +
          `[${GAME_TILE_RATING_ICON_ATTRIBUTE}], ` +
          `[${GAME_TILE_RATING_VALUE_ATTRIBUTE}]`
      )
      .forEach((node) => node.remove());
    document.querySelectorAll(`[${GAME_TILE_CCU_EXTERNAL_ATTRIBUTE}]`).forEach(
      (root) => root.removeAttribute(GAME_TILE_CCU_EXTERNAL_ATTRIBUTE)
    );
    document.querySelectorAll(`[${GAME_TILE_RATING_EXTERNAL_ATTRIBUTE}]`).forEach(
      (root) => root.removeAttribute(GAME_TILE_RATING_EXTERNAL_ATTRIBUTE)
    );
    restoreSponsoredGameTileRatings();
  }

  function findQuickPlayRootThumbnail(root) {
    const markedThumbnail = Array.from(
      root.querySelectorAll(`[${QUICK_PLAY_THUMBNAIL_ATTRIBUTE}]`)
    ).find((thumbnail) => thumbnail.closest(QUICK_PLAY_CARD_ROOT_SELECTOR) === root);
    if (markedThumbnail) {
      return markedThumbnail;
    }
    return Array.from(root.querySelectorAll(QUICK_PLAY_NATIVE_HOST_SELECTOR)).find(
      (thumbnail) => thumbnail.closest(QUICK_PLAY_CARD_ROOT_SELECTOR) === root
    ) || null;
  }

  function getQuickPlayRootCurrentPlaceId(root) {
    if (!root?.isConnected) {
      return null;
    }
    const thumbnail = findQuickPlayRootThumbnail(root);
    return thumbnail
      ? getQuickPlayPlaceId(findQuickPlayCardLink(thumbnail, root))
      : null;
  }

  function isQuickPlayButtonCurrent(button, expectedPlaceId) {
    const surface = button?.closest?.(`[${QUICK_PLAY_SURFACE_ATTRIBUTE}]`);
    const root = surface?.parentElement;
    return Boolean(
      root?.hasAttribute(QUICK_PLAY_HOST_ATTRIBUTE) &&
      getQuickPlayRootCurrentPlaceId(root) === expectedPlaceId
    );
  }

  function invalidateStaleQuickPlayControls(mutations) {
    const affectedRoots = new Set();
    const collectClosestMountedRoot = (node) => {
      const element = node?.nodeType === Node.ELEMENT_NODE
        ? node
        : node?.parentElement;
      const root = element?.closest?.(`[${QUICK_PLAY_HOST_ATTRIBUTE}]`);
      if (root) {
        affectedRoots.add(root);
      }
    };

    mutations.forEach((mutation) => {
      collectClosestMountedRoot(mutation.target);
      mutation.addedNodes?.forEach((node) => {
        const element = node?.nodeType === Node.ELEMENT_NODE ? node : null;
        if (element?.matches?.(`[${QUICK_PLAY_HOST_ATTRIBUTE}]`)) {
          affectedRoots.add(element);
        }
        element?.querySelectorAll?.(`[${QUICK_PLAY_HOST_ATTRIBUTE}]`).forEach(
          (mountedRoot) => affectedRoots.add(mountedRoot)
        );
      });
    });
    affectedRoots.forEach((root) => {
      const mountedPlaceId = root.getAttribute(QUICK_PLAY_HOST_ATTRIBUTE);
      if (getQuickPlayRootCurrentPlaceId(root) !== mountedPlaceId) {
        removeQuickPlaySurface(root);
      }
    });
  }

  function getQuickPlayCardName(root, thumbnail) {
    const imageName = thumbnail.querySelector("img[alt]")?.getAttribute("alt")?.trim();
    if (imageName) {
      return imageName;
    }
    const titleElement = root.querySelector(
      "[data-testid='game-tile-game-title'], .game-card-name, .game-name-title"
    );
    return titleElement?.getAttribute("title")?.trim() ||
      titleElement?.textContent?.trim() ||
      "this experience";
  }

  function getQuickPlayBox(element) {
    let rect = null;
    try {
      rect = element.getBoundingClientRect();
    } catch {
      rect = null;
    }
    let width = Number(rect?.width) || element.offsetWidth || 0;
    let height = Number(rect?.height) || element.offsetHeight || 0;
    if (width < 1 || height < 1) {
      try {
        const style = window.getComputedStyle(element);
        width = width || Number.parseFloat(style.width) || 0;
        height = height || Number.parseFloat(style.height) || 0;
      } catch {
        // A later mount pass will retry cards that are not laid out yet.
      }
    }
    return { rect, width, height };
  }

  function syncQuickPlaySurfaceGeometry(surface, root, thumbnail) {
    const rootBox = getQuickPlayBox(root);
    const thumbnailBox = getQuickPlayBox(thumbnail);
    if (
      thumbnailBox.width < QUICK_PLAY_MIN_THUMBNAIL_WIDTH ||
      thumbnailBox.height < QUICK_PLAY_MIN_THUMBNAIL_HEIGHT
    ) {
      surface.hidden = true;
      return false;
    }

    const hasPlacedRects = Boolean(
      rootBox.rect?.width &&
      rootBox.rect?.height &&
      thumbnailBox.rect?.width &&
      thumbnailBox.rect?.height
    );
    const left = hasPlacedRects
      ? Math.max(0, thumbnailBox.rect.left - rootBox.rect.left)
      : 0;
    const top = hasPlacedRects
      ? Math.max(0, thumbnailBox.rect.top - rootBox.rect.top)
      : 0;
    const toCssPixels = (value) => `${Math.round(value * 1000) / 1000}px`;
    surface.style.left = toCssPixels(left);
    surface.style.top = toCssPixels(top);
    surface.style.width = toCssPixels(thumbnailBox.width);
    surface.style.height = toCssPixels(thumbnailBox.height);
    surface.hidden = false;
    surface.dataset.rslQuickPlayLayout =
      thumbnail.matches(".featured-game-icon-container, .large-game-tile-thumb-container") ||
      thumbnailBox.width / thumbnailBox.height >= 1.35 ||
      thumbnailBox.width >= 260
        ? "wide"
        : "compact";
    updatePrivateServerButtonVisibility(surface);
    try {
      surface.style.borderRadius = window.getComputedStyle(thumbnail).borderRadius;
    } catch {
      surface.style.borderRadius = "8px";
    }
    return true;
  }

  function getQuickPlayGeometryObserver() {
    if (quickPlayGeometryObserver || typeof ResizeObserver !== "function") {
      return quickPlayGeometryObserver;
    }
    quickPlayGeometryObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const thumbnail = entry.target;
        const root = thumbnail.closest?.(QUICK_PLAY_CARD_ROOT_SELECTOR);
        const surface = root
          ? Array.from(root.children).find((child) =>
              child.hasAttribute?.(QUICK_PLAY_SURFACE_ATTRIBUTE)
            )
          : null;
        if (!root || !surface || !thumbnail.isConnected) {
          quickPlayGeometryObserver?.unobserve(thumbnail);
          continue;
        }
        syncQuickPlaySurfaceGeometry(surface, root, thumbnail);
      }
    });
    return quickPlayGeometryObserver;
  }

  function clearQuickPlayFeedback(button) {
    const timer = quickPlayFeedbackTimers.get(button);
    if (timer) {
      window.clearTimeout(timer);
      quickPlayFeedbackTimers.delete(button);
    }
    button.disabled = false;
    button.removeAttribute("aria-busy");
    delete button.dataset.rslQuickPlayState;
  }

  function restoreGameEventJoinButton(button) {
    clearQuickPlayFeedback(button);
    button.textContent = "Join Game";
    button.setAttribute(
      "aria-label",
      button.dataset.rslGameEventsDefaultLabel || "Join Game"
    );
  }

  function handleGameEventJoinResult(button, code) {
    const timer = quickPlayFeedbackTimers.get(button);
    if (timer) {
      window.clearTimeout(timer);
      quickPlayFeedbackTimers.delete(button);
    }
    button.dataset.rslQuickPlayState = code === "started" ? "launching" : "error";
    button.textContent = code === "started" ? "Launching…" : "Try Again";
    button.setAttribute(
      "aria-label",
      code === "started" ? "Launching game" : "Game launch unavailable. Try again"
    );
    if (code === "started") {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
    }
    const feedbackTimer = window.setTimeout(() => {
      quickPlayFeedbackTimers.delete(button);
      if (button.isConnected) restoreGameEventJoinButton(button);
    }, QUICK_PLAY_FEEDBACK_MS);
    quickPlayFeedbackTimers.set(button, feedbackTimer);
  }

  function handleQuickPlayResult(event) {
    const button = event.target?.closest?.(`[${QUICK_PLAY_ACTION_ATTRIBUTE}]`);
    const gameEventSurface = button?.closest?.(`[${GAME_EVENTS_LAUNCH_SURFACE_ATTRIBUTE}]`);
    const quickPlaySurface = button?.closest?.(`[${QUICK_PLAY_SURFACE_ATTRIBUTE}]`);
    if (!button || (!gameEventSurface && !quickPlaySurface)) return;
    let result;
    try {
      result = JSON.parse(typeof event.detail === "string" ? event.detail : "");
    } catch {
      return;
    }
    const action = button.getAttribute(QUICK_PLAY_ACTION_ATTRIBUTE);
    if (gameEventSurface) {
      if (
        !isFeatureEnabled("gameEvents") ||
        action !== "play" ||
        result?.v !== 1 ||
        result?.action !== "play" ||
        !["started", "invalid", "unavailable", "failed"].includes(result?.code)
      ) {
        return;
      }
      handleGameEventJoinResult(button, result.code);
      return;
    }
    if (
      !isFeatureEnabled("quickPlay") ||
      !isQuickPlayActionEnabled(action) ||
      result?.v !== 1 ||
      result?.action !== action ||
      !["play", "random"].includes(action) ||
      !["started", "invalid", "unavailable", "failed", "empty"].includes(result?.code)
    ) {
      return;
    }

    clearQuickPlayFeedback(button);
    button.dataset.rslQuickPlayState = result.code === "started" ? "launching" : "error";
    button.setAttribute(
      "aria-label",
      result.code === "started"
        ? "Launching experience"
        : action === "random"
          ? "Random Server unavailable"
          : "Quick Play unavailable"
    );
    if (result.code === "started") {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
    }
    const timer = window.setTimeout(() => {
      quickPlayFeedbackTimers.delete(button);
      if (!button.isConnected) {
        return;
      }
      clearQuickPlayFeedback(button);
      button.setAttribute(
        "aria-label",
        button.dataset.rslQuickPlayDefaultLabel || "Quick Play"
      );
    }, QUICK_PLAY_FEEDBACK_MS);
    quickPlayFeedbackTimers.set(button, timer);
  }

  function dispatchRandomServerResponse(button, detail) {
    button.dispatchEvent(
      new CustomEvent(QUICK_PLAY_RANDOM_RESPONSE_EVENT, {
        bubbles: true,
        detail: JSON.stringify(detail)
      })
    );
  }

  function handleRandomServerRequest(event) {
    if (!isQuickPlayActionEnabled("random")) {
      return;
    }
    const button = event.target?.closest?.(`[${QUICK_PLAY_ACTION_ATTRIBUTE}="random"]`);
    if (
      !button ||
      event.target !== button ||
      !button.closest(`[${QUICK_PLAY_SURFACE_ATTRIBUTE}]`)
    ) {
      return;
    }

    let request;
    try {
      request = JSON.parse(typeof event.detail === "string" ? event.detail : "");
    } catch {
      return;
    }
    const placeId = normalizeQuickPlayPlaceId(request?.placeId);
    if (
      request?.v !== 1 ||
      !placeId ||
      placeId !== normalizeQuickPlayPlaceId(
        button.getAttribute(QUICK_PLAY_PLACE_ID_ATTRIBUTE)
      )
    ) {
      return;
    }
    if (!isQuickPlayButtonCurrent(button, placeId)) {
      dispatchRandomServerResponse(button, {
        v: 1,
        placeId,
        code: "invalid"
      });
      return;
    }

    clearQuickPlayFeedback(button);
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.dataset.rslQuickPlayState = "selecting";

    quickPlayRandomRequestId =
      quickPlayRandomRequestId >= Number.MAX_SAFE_INTEGER
        ? 1
        : quickPlayRandomRequestId + 1;
    const requestId = quickPlayRandomRequestId;
    chrome.runtime.sendMessage(
      {
        type: "rsl:get-random-public-server",
        placeId,
        requestId
      },
      (response) => {
        const runtimeError = chrome.runtime.lastError;
        if (!button.isConnected) {
          return;
        }
        if (!isQuickPlayButtonCurrent(button, placeId)) {
          dispatchRandomServerResponse(button, {
            v: 1,
            placeId,
            code: "invalid"
          });
          return;
        }

        const responsePlaceId = normalizeQuickPlayPlaceId(response?.placeId);
        const gameInstanceId = normalizeQuickPlayGameInstanceId(
          response?.gameInstanceId
        );
        if (
          !runtimeError &&
          response?.ok === true &&
          response?.requestId === requestId &&
          responsePlaceId === placeId &&
          gameInstanceId
        ) {
          dispatchRandomServerResponse(button, {
            v: 1,
            placeId,
            code: "ready",
            gameInstanceId
          });
          return;
        }

        const code = runtimeError
          ? "unavailable"
          : response?.code === "INVALID"
            ? "invalid"
            : response?.code === "NO_SERVERS"
              ? "empty"
              : response?.code === "RATE_LIMITED" ||
                  response?.code === "ROBLOX_UNAVAILABLE" ||
                  response?.code === "NETWORK"
                ? "unavailable"
                : "failed";
        dispatchRandomServerResponse(button, { v: 1, placeId, code });
      }
    );
  }

  function sendPrivateServerRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        const error = new Error("Roblox private server request timed out");
        error.code = "TIMEOUT";
        reject(error);
      }, PRIVATE_SERVER_REQUEST_TIMEOUT_MS);

      const settle = (callback, value) => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timeout);
        callback(value);
      };

      try {
        chrome.runtime.sendMessage(message, (response) => {
          const runtimeError = chrome.runtime.lastError;
          if (runtimeError) {
            settle(reject, new Error(runtimeError.message));
            return;
          }
          settle(resolve, response);
        });
      } catch (error) {
        settle(reject, error);
      }
    });
  }

  function updatePrivateServerButtonVisibility(surface) {
    const button = surface?.querySelector(
      `[${QUICK_PLAY_ACTION_ATTRIBUTE}="private"]`
    );
    const actionCount = surface?.querySelectorAll?.(
      `[${QUICK_PLAY_ACTION_ATTRIBUTE}]`
    )?.length || 0;
    const measuredWidth = Number.parseFloat(surface.style.width) ||
      getQuickPlayBox(surface).width;
    const useWideActionSize =
      surface.dataset.rslQuickPlayLayout === "wide" &&
      measuredWidth >= QUICK_PLAY_PRIVATE_WIDE_MIN_THUMBNAIL_WIDTH;
    surface.dataset.rslQuickPlayActionSize = useWideActionSize ? "wide" : "compact";
    if (!button) {
      surface.dataset.rslPrivateServerLayout = "two";
      if (surface.hasAttribute?.(PRIVATE_SUPPORT_TABINDEX_ATTRIBUTE)) {
        surface.removeAttribute?.("tabindex");
        surface.removeAttribute?.(PRIVATE_SUPPORT_TABINDEX_ATTRIBUTE);
      }
      surface.setAttribute?.("aria-label", "Experience launch controls");
      return;
    }
    const supported = surface.dataset.rslPrivateServerSupported === "true";
    const hasAllThreeActions = actionCount === 3;
    const wasThreeButtonLayout = surface.dataset.rslPrivateServerLayout === "three";
    const privateLayoutMinimumWidth = wasThreeButtonLayout
      ? QUICK_PLAY_PRIVATE_MIN_THUMBNAIL_WIDTH -
        QUICK_PLAY_PRIVATE_LAYOUT_HYSTERESIS_PX
      : QUICK_PLAY_PRIVATE_MIN_THUMBNAIL_WIDTH;
    const useThreeButtonLayout =
      supported && measuredWidth >= privateLayoutMinimumWidth;
    const showThreeButtonLayout = hasAllThreeActions && useThreeButtonLayout;
    button.hidden = !(supported && (!hasAllThreeActions || showThreeButtonLayout));
    surface.dataset.rslPrivateServerLayout = showThreeButtonLayout ? "three" : "two";
    const needsKeyboardTrigger = actionCount === 1 && button.hidden;
    if (needsKeyboardTrigger) {
      if (!surface.hasAttribute?.("tabindex")) {
        surface.setAttribute?.("tabindex", "0");
        surface.setAttribute?.(PRIVATE_SUPPORT_TABINDEX_ATTRIBUTE, "");
      }
      surface.setAttribute?.(
        "aria-label",
        supported === false
          ? "Private Servers unavailable; focus to check again"
          : "Check Private Servers availability"
      );
    } else {
      const ownedTabindex = surface.hasAttribute?.(
        PRIVATE_SUPPORT_TABINDEX_ATTRIBUTE
      );
      if (ownedTabindex) {
        surface.removeAttribute?.("tabindex");
        surface.removeAttribute?.(PRIVATE_SUPPORT_TABINDEX_ATTRIBUTE);
      }
      surface.setAttribute?.("aria-label", "Experience launch controls");
      if (
        !button.hidden &&
        typeof document !== "undefined" &&
        document.activeElement === surface
      ) {
        button.focus?.({ preventScroll: true });
      }
    }
  }

  function normalizePrivateServerPrice(value) {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }

  function readPrivateServerPriceFromSurface(surface) {
    const rawPrice = surface?.dataset.rslPrivateServerPrice;
    if (typeof rawPrice !== "string" || !/^(?:0|[1-9]\d*)$/.test(rawPrice)) {
      return null;
    }
    return normalizePrivateServerPrice(Number(rawPrice));
  }

  function applyPrivateServerSupport(surface, enabled, price = null) {
    if (!surface?.isConnected) {
      return;
    }
    const normalizedPrice =
      enabled === true ? normalizePrivateServerPrice(price) : null;
    surface.dataset.rslPrivateServerSupported =
      enabled === true ? "true" : enabled === false ? "false" : "unknown";
    if (normalizedPrice === null) {
      delete surface.dataset.rslPrivateServerPrice;
    } else {
      surface.dataset.rslPrivateServerPrice = String(normalizedPrice);
    }
    const placeId = getPrivateServerSupportSurfacePlaceId(surface);
    if (
      placeId &&
      placeId === privateServersPlaceId &&
      document.getElementById(PRIVATE_SERVERS_DIALOG_ID)?.open
    ) {
      privateServersPrice = normalizedPrice;
      renderPrivateServersPrice();
    }
    updatePrivateServerButtonVisibility(surface);
  }

  function drainPrivateServerSupportRequestQueue() {
    while (
      activePrivateServerSupportRequests <
        PRIVATE_SERVER_SUPPORT_MAX_CONCURRENT_REQUESTS &&
      privateServerSupportRequestQueue.length > 0
    ) {
      const task = privateServerSupportRequestQueue.shift();
      activePrivateServerSupportRequests += 1;
      void sendPrivateServerRuntimeMessage(task.message)
        .then(task.resolve, task.reject)
        .finally(() => {
          activePrivateServerSupportRequests -= 1;
          drainPrivateServerSupportRequestQueue();
        });
    }
  }

  function queuePrivateServerSupportRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
      privateServerSupportRequestQueue.push({ message, resolve, reject });
      drainPrivateServerSupportRequestQueue();
    });
  }

  function cancelQueuedPrivateServerSupportRequests() {
    const queued = privateServerSupportRequestQueue.splice(0);
    for (const task of queued) {
      const error = new Error("Private server support request cancelled");
      error.code = "CANCELLED";
      task.reject(error);
    }
  }

  function getPrivateServerSupportSurfacePlaceId(surface) {
    return normalizeQuickPlayPlaceId(
      surface?.dataset.rslQuickPlayPlaceId ||
        surface?.querySelector(`[${QUICK_PLAY_ACTION_ATTRIBUTE}]`)
          ?.getAttribute(QUICK_PLAY_PLACE_ID_ATTRIBUTE)
    );
  }

  function getPrivateServerSupportSurfaces(placeId, activatedOnly = false) {
    return Array.from(
      document.querySelectorAll(`[${QUICK_PLAY_SURFACE_ATTRIBUTE}]`)
    ).filter(
      (surface) =>
        surface.isConnected &&
        (!activatedOnly || surface.dataset.rslPrivateSupportActivated === "true") &&
        getPrivateServerSupportSurfacePlaceId(surface) === placeId
    );
  }

  function clearPrivateServerSupportRetry(placeId) {
    const retry = privateServerSupportRetryByPlaceId.get(placeId);
    if (retry?.timerId) {
      window.clearTimeout(retry.timerId);
    }
    privateServerSupportRetryByPlaceId.delete(placeId);
  }

  function schedulePrivateServerSupportRetry(placeId) {
    if (getPrivateServerSupportSurfaces(placeId, true).length === 0) {
      clearPrivateServerSupportRetry(placeId);
      return;
    }
    const previous = privateServerSupportRetryByPlaceId.get(placeId);
    if (previous?.timerId) {
      return;
    }
    const attempt = previous?.attempt || 0;
    const baseDelay =
      PRIVATE_SERVER_SUPPORT_RETRY_DELAYS_MS[attempt] ||
      PRIVATE_SERVER_SUPPORT_STEADY_RETRY_MS;
    const jitterRange = Math.round(
      baseDelay * PRIVATE_SERVER_SUPPORT_RETRY_JITTER_RATIO
    );
    const retryDelay = Math.max(
      250,
      baseDelay + Math.round((Math.random() * 2 - 1) * jitterRange)
    );
    const retry = {
      attempt: Math.min(attempt + 1, PRIVATE_SERVER_SUPPORT_RETRY_DELAYS_MS.length),
      timerId: 0
    };
    retry.timerId = window.setTimeout(() => {
      if (privateServerSupportRetryByPlaceId.get(placeId) !== retry) {
        return;
      }
      retry.timerId = 0;
      const surfaces = getPrivateServerSupportSurfaces(placeId, true);
      if (surfaces.length === 0) {
        privateServerSupportRetryByPlaceId.delete(placeId);
        return;
      }
      for (const surface of surfaces) {
        loadPrivateServerSupportForSurface(surface);
      }
    }, retryDelay);
    privateServerSupportRetryByPlaceId.set(placeId, retry);
  }

  function getCachedPrivateServerSupport(placeId) {
    const cached = privateServerSupportByPlaceId.get(placeId);
    if (cached?.expiresAt > Date.now() && typeof cached.enabled === "boolean") {
      return {
        enabled: cached.enabled,
        price: normalizePrivateServerPrice(cached.price)
      };
    }
    if (cached) {
      privateServerSupportByPlaceId.delete(placeId);
    }
    return null;
  }

  function requestPrivateServerSupport(placeId) {
    const cachedSupport = getCachedPrivateServerSupport(placeId);
    if (cachedSupport !== null) {
      return Promise.resolve({
        enabled: cachedSupport.enabled,
        price: cachedSupport.price,
        stale: false
      });
    }
    const pending = privateServerSupportRequestsByPlaceId.get(placeId);
    if (pending) {
      return pending;
    }

    quickPlayPrivateSupportRequestId =
      quickPlayPrivateSupportRequestId >= Number.MAX_SAFE_INTEGER
        ? 1
        : quickPlayPrivateSupportRequestId + 1;
    const requestId = quickPlayPrivateSupportRequestId;
    const request = queuePrivateServerSupportRuntimeMessage({
      type: "rsl:get-private-server-support",
      placeId,
      requestId
    })
      .then((response) => {
        const responsePrice = response?.price;
        if (
          response?.ok !== true ||
          response?.requestId !== requestId ||
          normalizeQuickPlayPlaceId(response?.placeId) !== placeId ||
          typeof response.enabled !== "boolean" ||
          typeof response.stale !== "boolean" ||
          (responsePrice !== undefined &&
            responsePrice !== null &&
            normalizePrivateServerPrice(responsePrice) === null)
        ) {
          throw new Error("Invalid private server support response");
        }
        const price = normalizePrivateServerPrice(responsePrice);
        if (!response.stale) {
          privateServerSupportByPlaceId.set(placeId, {
            enabled: response.enabled,
            price,
            expiresAt: Date.now() + PRIVATE_SERVER_SUPPORT_CACHE_TTL_MS
          });
        }
        return {
          enabled: response.enabled,
          price,
          stale: response.stale
        };
      })
      .finally(() => {
        if (privateServerSupportRequestsByPlaceId.get(placeId) === request) {
          privateServerSupportRequestsByPlaceId.delete(placeId);
        }
      });
    privateServerSupportRequestsByPlaceId.set(placeId, request);
    return request;
  }

  function loadPrivateServerSupportForSurface(surface) {
    if (
      !isQuickPlayActionEnabled("private") ||
      !surface?.querySelector?.(`[${QUICK_PLAY_ACTION_ATTRIBUTE}="private"]`) ||
      !surface.isConnected
    ) {
      return;
    }
    const placeId = getPrivateServerSupportSurfacePlaceId(surface);
    if (!placeId) {
      return;
    }
    void requestPrivateServerSupport(placeId)
      .then((support) => {
        const currentPlaceId = getPrivateServerSupportSurfacePlaceId(surface);
        if (currentPlaceId === placeId) {
          applyPrivateServerSupport(surface, support.enabled, support.price);
          if (support.stale) {
            schedulePrivateServerSupportRetry(placeId);
          } else {
            clearPrivateServerSupportRetry(placeId);
          }
        }
      })
      .catch(() => {
        // A failed lookup remains unknown and hidden. A later hover or keyboard
        // focus can retry it; only an explicit Roblox response is cached.
        const currentPlaceId = getPrivateServerSupportSurfacePlaceId(surface);
        if (currentPlaceId === placeId) {
          applyPrivateServerSupport(surface, null);
        }
        clearPrivateServerSupportRetry(placeId);
      });
  }

  function activatePrivateServerSupport(surface) {
    if (!isQuickPlayActionEnabled("private")) {
      return;
    }
    if (!surface?.isConnected) {
      return;
    }
    surface.dataset.rslPrivateSupportActivated = "true";
    loadPrivateServerSupportForSurface(surface);
  }

  function removePrivateServerSupportInteraction(surface) {
    if (!surface) {
      return;
    }
    const binding = privateServerSupportInteractionBindings.get(surface);
    if (!binding) {
      return;
    }
    binding.host.removeEventListener("pointerenter", binding.onPointerEnter);
    binding.host.removeEventListener("focusin", binding.onFocusIn);
    privateServerSupportInteractionBindings.delete(surface);
  }

  function observePrivateServerSupport(surface) {
    if (
      !isQuickPlayActionEnabled("private") ||
      !surface ||
      surface.dataset.rslPrivateSupportObserved === "true"
    ) {
      return;
    }
    surface.dataset.rslPrivateSupportObserved = "true";
    const host =
      surface.closest(`[${QUICK_PLAY_HOST_ATTRIBUTE}]`) ||
      surface.parentElement ||
      surface;
    const onPointerEnter = (event) => {
      if (event.isTrusted === true) {
        activatePrivateServerSupport(surface);
      }
    };
    const onFocusIn = (event) => {
      if (event.isTrusted === true) {
        activatePrivateServerSupport(surface);
      }
    };
    host.addEventListener("pointerenter", onPointerEnter, { passive: true });
    host.addEventListener("focusin", onFocusIn);
    privateServerSupportInteractionBindings.set(surface, {
      host,
      onPointerEnter,
      onFocusIn
    });
    const placeId = getPrivateServerSupportSurfacePlaceId(surface);
    const cachedSupport = placeId ? getCachedPrivateServerSupport(placeId) : null;
    if (cachedSupport !== null) {
      applyPrivateServerSupport(
        surface,
        cachedSupport.enabled,
        cachedSupport.price
      );
    }
    if (host.matches?.(":hover") || host.matches?.(":focus-within")) {
      activatePrivateServerSupport(surface);
    }
  }

  function normalizePrivateServerCursor(rawValue) {
    const value = typeof rawValue === "string" ? rawValue : "";
    return value && value.length <= 1_024 && !/[\u0000-\u001f\u007f]/.test(value)
      ? value
      : null;
  }

  function normalizePrivateServerAccessCode(rawValue) {
    const value = typeof rawValue === "string" ? rawValue : "";
    return value && value.length <= 512 && !/[\u0000-\u001f\u007f]/.test(value)
      ? value
      : null;
  }

  function formatPrivateServerPrice(price) {
    const normalizedPrice = normalizePrivateServerPrice(price);
    if (normalizedPrice === null) {
      return null;
    }
    return price === 0
      ? "Free"
      : `${price.toLocaleString()} Robux / month`;
  }

  function normalizePrivateServersSearchQuery(value) {
    return String(value || "")
      .trim()
      .toLocaleLowerCase()
      .replace(/^@+/, "")
      .slice(0, 100);
  }

  function createPrivateServerToken() {
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `private-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function normalizePrivateServer(entry) {
    const id = String(entry?.id ?? "");
    const accessCode = normalizePrivateServerAccessCode(entry?.accessCode);
    if (
      !id ||
      id.length > 128 ||
      /[\u0000-\u001f\u007f]/.test(id) ||
      !accessCode
    ) {
      return null;
    }
    const ownerId = String(entry?.owner?.id ?? "");
    const ownerName =
      typeof entry?.owner?.name === "string"
        ? entry.owner.name.trim().slice(0, 100)
        : "";
    const ownerDisplayName =
      typeof entry?.owner?.displayName === "string"
        ? entry.owner.displayName.trim().slice(0, 100)
        : "";
    const name =
      typeof entry?.name === "string" ? entry.name.trim().slice(0, 100) : "";
    const maxPlayers = Number.isSafeInteger(entry?.maxPlayers) && entry.maxPlayers >= 0
      ? Math.min(entry.maxPlayers, 1_000_000)
      : 0;
    const playing = Number.isSafeInteger(entry?.playing) && entry.playing >= 0
      ? Math.min(entry.playing, maxPlayers || 1_000_000)
      : 0;
    return {
      id,
      accessCode,
      token: createPrivateServerToken(),
      name: name || (ownerDisplayName ? `${ownerDisplayName}'s Server` : "Private Server"),
      owner: {
        id: /^[1-9]\d{0,19}$/.test(ownerId) ? ownerId : null,
        name: ownerName,
        displayName: ownerDisplayName || ownerName
      },
      playing,
      maxPlayers
    };
  }

  function getPrivateServersPageUrl(placeId = privateServersPlaceId) {
    return placeId
      ? `/games/${placeId}#!/game-instances`
      : "/home";
  }

  function matchesPrivateServerSearch(server, query) {
    if (!query) {
      return true;
    }
    const haystack = [
      server.name,
      server.owner.displayName,
      server.owner.name,
      server.owner.id,
      server.id
    ]
      .filter((value) => value !== null && value !== undefined)
      .join(" ")
      .toLocaleLowerCase();
    return query.split(/\s+/).every((token) => haystack.includes(token));
  }

  function makePrivateServersState(message) {
    const item = document.createElement("li");
    item.className = "rsl-private-servers-dialog__empty";
    const text = document.createElement("p");
    text.textContent = message;
    item.append(text);
    return item;
  }

  function restorePrivateServerJoinButtons(errorToken = null) {
    const dialog = document.getElementById(PRIVATE_SERVERS_DIALOG_ID);
    dialog?.querySelectorAll(`[${PRIVATE_SERVER_ACTION_ATTRIBUTE}="join"]`).forEach(
      (button) => {
        const token = button.getAttribute(PRIVATE_SERVER_TOKEN_ATTRIBUTE) || "";
        const server = privateServersByToken.get(token);
        const isFull = Boolean(
          server?.maxPlayers > 0 && server.playing >= server.maxPlayers
        );
        button.removeAttribute("aria-busy");
        button.disabled = privateServersGameJoinRestricted || isFull || !server;
        button.textContent = isFull
          ? "Full"
          : token === errorToken
            ? "Try again"
            : "Join";
      }
    );
  }

  function joinPrivateServer(button, expectedServer) {
    const dialog = button?.closest?.(`#${PRIVATE_SERVERS_DIALOG_ID}`);
    const token = button?.getAttribute(PRIVATE_SERVER_TOKEN_ATTRIBUTE) || "";
    const placeId = normalizeQuickPlayPlaceId(
      button?.getAttribute(PRIVATE_SERVER_PLACE_ID_ATTRIBUTE)
    );
    const server = privateServersByToken.get(token);
    const isFull = Boolean(
      server?.maxPlayers > 0 && server.playing >= server.maxPlayers
    );
    if (
      !dialog?.open ||
      !placeId ||
      placeId !== privateServersPlaceId ||
      !server ||
      server !== expectedServer ||
      !normalizePrivateServerAccessCode(server.accessCode) ||
      isFull ||
      privateServersGameJoinRestricted ||
      privateServerJoinPromise
    ) {
      return;
    }

    const requestId = ++privateServerJoinRequestId;
    privateServerJoiningToken = token;
    dialog.querySelectorAll(`[${PRIVATE_SERVER_ACTION_ATTRIBUTE}="join"]`).forEach(
      (joinButton) => {
        joinButton.disabled = true;
        if (joinButton === button) {
          joinButton.setAttribute("aria-busy", "true");
          joinButton.textContent = "Joining...";
        }
      }
    );

    let failed = false;
    const request = sendPrivateServerRuntimeMessage({
      type: PRIVATE_SERVER_JOIN_MESSAGE_TYPE,
      requestId,
      placeId,
      accessCode: server.accessCode
    })
      .then((response) => {
        if (
          requestId !== privateServerJoinRequestId ||
          privateServersPlaceId !== placeId
        ) {
          return;
        }
        if (
          response?.ok !== true ||
          response?.requestId !== requestId ||
          normalizeQuickPlayPlaceId(response?.placeId) !== placeId ||
          response?.code !== "started"
        ) {
          failed = true;
          return;
        }
        closePrivateServersDialog(false);
      })
      .catch(() => {
        failed = true;
      })
      .finally(() => {
        if (requestId !== privateServerJoinRequestId) {
          return;
        }
        privateServerJoinPromise = null;
        privateServerJoiningToken = null;
        if (!document.getElementById(PRIVATE_SERVERS_DIALOG_ID)?.open) {
          return;
        }
        restorePrivateServerJoinButtons(failed ? token : null);
        if (failed) {
          window.setTimeout(() => {
            if (
              privateServersPlaceId === placeId &&
              privateServerJoinRequestId === requestId
            ) {
              restorePrivateServerJoinButtons();
            }
          }, QUICK_PLAY_FEEDBACK_MS);
        }
      });
    privateServerJoinPromise = request;
  }

  function setBoundedPrivateServerOwnerThumbnail(userId, url) {
    privateServerOwnerThumbnailUnavailableUntil.delete(userId);
    privateServerOwnerThumbnailUrls.delete(userId);
    privateServerOwnerThumbnailUrls.set(userId, url);
    while (
      privateServerOwnerThumbnailUrls.size >
      PRIVATE_SERVER_OWNER_THUMBNAIL_CACHE_MAX_ENTRIES
    ) {
      const oldestUserId = privateServerOwnerThumbnailUrls.keys().next().value;
      privateServerOwnerThumbnailUrls.delete(oldestUserId);
    }
  }

  function markPrivateServerOwnerThumbnailUnavailable(userId) {
    privateServerOwnerThumbnailUrls.delete(userId);
    privateServerOwnerThumbnailUnavailableUntil.delete(userId);
    privateServerOwnerThumbnailUnavailableUntil.set(
      userId,
      Date.now() + PRIVATE_SERVER_OWNER_THUMBNAIL_UNAVAILABLE_TTL_MS
    );
    while (
      privateServerOwnerThumbnailUnavailableUntil.size >
      PRIVATE_SERVER_OWNER_THUMBNAIL_CACHE_MAX_ENTRIES
    ) {
      const oldestUserId =
        privateServerOwnerThumbnailUnavailableUntil.keys().next().value;
      privateServerOwnerThumbnailUnavailableUntil.delete(oldestUserId);
    }
  }

  function setPrivateServerThumbnailLoading(image, phase = "network") {
    const frame = image?.parentElement;
    if (!image || !frame) {
      return;
    }
    frame.classList.add("rsl-owned-thumbnail-frame");
    image.dataset.rslPrivateServerThumbnailLoading = phase;
    frame.dataset.rslThumbnailLoading = "true";
    frame.dataset.rslThumbnailState = "loading";
  }

  function finishPrivateServerThumbnailLoading(
    image,
    expectedKey = null,
    expectedPhase = null,
    finalState = "loaded"
  ) {
    if (
      !image ||
      (expectedKey && image.dataset.rslPrivateServerThumbnailKey !== expectedKey) ||
      (expectedPhase &&
        image.dataset.rslPrivateServerThumbnailLoading !== expectedPhase)
    ) {
      return;
    }
    delete image.dataset.rslPrivateServerThumbnailLoading;
    delete image.dataset.rslPrivateServerThumbnailLoadToken;
    const frame = image.parentElement;
    frame?.removeAttribute("data-rsl-thumbnail-loading");
    if (frame) {
      frame.dataset.rslThumbnailState = finalState;
    }
  }

  function applyPrivateServerThumbnail(image, url, expectedKey, expectedPlaceId) {
    const dialog = document.getElementById(PRIVATE_SERVERS_DIALOG_ID);
    if (
      !dialog?.open ||
      !image?.isConnected ||
      !dialog.contains(image) ||
      privateServersPlaceId !== expectedPlaceId ||
      image.dataset.rslPrivateServerThumbnailKey !== expectedKey ||
      !isSafeThumbnailImageUrl(url)
    ) {
      return false;
    }
    delete image.dataset.rslPrivateServerFallbackApplied;
    privateServerThumbnailLoadToken =
      privateServerThumbnailLoadToken >= Number.MAX_SAFE_INTEGER
        ? 1
        : privateServerThumbnailLoadToken + 1;
    const loadToken = String(privateServerThumbnailLoadToken);
    image.dataset.rslPrivateServerThumbnailLoadToken = loadToken;
    setPrivateServerThumbnailLoading(image, "image");
    const finishLoadedImage = () => {
      const activeDialog = document.getElementById(PRIVATE_SERVERS_DIALOG_ID);
      if (
        image.dataset.rslPrivateServerThumbnailLoadToken !== loadToken ||
        image.dataset.rslPrivateServerThumbnailKey !== expectedKey ||
        image.getAttribute("src") !== url ||
        !activeDialog?.open ||
        !image.isConnected ||
        !activeDialog.contains(image) ||
        privateServersPlaceId !== expectedPlaceId
      ) {
        image.removeEventListener("load", finishLoadedImage);
        return;
      }
      if (!image.complete || image.naturalWidth <= 0) {
        return;
      }
      image.removeEventListener("load", finishLoadedImage);
      finishPrivateServerThumbnailLoading(image, expectedKey, "image");
    };
    image.addEventListener("load", finishLoadedImage);
    image.src = url;
    if (image.complete) {
      queueMicrotask(finishLoadedImage);
    }
    return true;
  }

  function loadPrivateServerGameThumbnail(dialog, placeId) {
    const image = dialog?.querySelector("[data-rsl-private-servers-game-icon]");
    if (!image || !placeId) {
      return;
    }
    const thumbnailKey = `game:${placeId}`;
    image.dataset.rslPrivateServerThumbnailKey = thumbnailKey;
    delete image.dataset.rslPrivateServerFallbackApplied;
    image.src = DEFAULT_GAME_ICON_URL;
    setPrivateServerThumbnailLoading(image, "network");
    void sendPrivateServerRuntimeMessage({
      type: "rsl:get-thumbnail",
      kind: "game",
      id: placeId
    })
      .then((response) => {
        if (!applyPrivateServerThumbnail(image, response?.url, thumbnailKey, placeId)) {
          finishPrivateServerThumbnailLoading(
            image,
            thumbnailKey,
            "network",
            "fallback"
          );
        }
      })
      .catch(() => {
        finishPrivateServerThumbnailLoading(
          image,
          thumbnailKey,
          "network",
          "fallback"
        );
      });
  }

  function applyCachedPrivateServerOwnerThumbnails(dialog, placeId) {
    if (!dialog?.open || privateServersPlaceId !== placeId) {
      return;
    }
    dialog
      .querySelectorAll("[data-rsl-private-server-owner-id]")
      .forEach((image) => {
        const userId = image.getAttribute("data-rsl-private-server-owner-id") || "";
        const url = privateServerOwnerThumbnailUrls.get(userId);
        if (url) {
          applyPrivateServerThumbnail(image, url, `profile:${userId}`, placeId);
        }
      });
  }

  function requestPrivateServerOwnerThumbnailBatch(dialog, placeId, userIds) {
    privateServerOwnerThumbnailRequestId =
      privateServerOwnerThumbnailRequestId >= Number.MAX_SAFE_INTEGER
        ? 1
        : privateServerOwnerThumbnailRequestId + 1;
    const requestId = privateServerOwnerThumbnailRequestId;
    userIds.forEach((userId) => privateServerOwnerThumbnailPendingIds.add(userId));

    void sendPrivateServerRuntimeMessage({
      type: PRIVATE_SERVER_OWNER_THUMBNAILS_MESSAGE_TYPE,
      requestId,
      userIds
    })
      .then((response) => {
        if (
          response?.ok !== true ||
          response?.requestId !== requestId ||
          !Array.isArray(response.thumbnails)
        ) {
          return;
        }
        const requestedIds = new Set(userIds);
        const availableIds = new Set();
        for (const thumbnail of response.thumbnails.slice(0, userIds.length)) {
          const userId = String(thumbnail?.userId ?? "");
          if (requestedIds.has(userId) && isSafeThumbnailImageUrl(thumbnail?.url)) {
            setBoundedPrivateServerOwnerThumbnail(userId, thumbnail.url);
            availableIds.add(userId);
          }
        }
        userIds
          .filter((userId) => !availableIds.has(userId))
          .forEach(markPrivateServerOwnerThumbnailUnavailable);
        applyCachedPrivateServerOwnerThumbnails(dialog, placeId);
      })
      .catch(() => {
        // Rows stay usable with their immediate local avatar placeholders.
      })
      .finally(() => {
        userIds.forEach((userId) => {
          privateServerOwnerThumbnailPendingIds.delete(userId);
        });
        const activeDialog = document.getElementById(PRIVATE_SERVERS_DIALOG_ID);
        const activePlaceId = privateServersPlaceId;
        if (activeDialog?.open && activePlaceId) {
          applyCachedPrivateServerOwnerThumbnails(activeDialog, activePlaceId);
        }
        userIds.forEach((userId) => {
          activeDialog
            ?.querySelectorAll(
              `[data-rsl-private-server-owner-id="${userId}"]`
            )
            .forEach((image) =>
              finishPrivateServerThumbnailLoading(
                image,
                `profile:${userId}`,
                "network",
                "fallback"
              )
            );
        });
      });
  }

  function hydratePrivateServerOwnerThumbnails(dialog, placeId) {
    if (!dialog?.open || privateServersPlaceId !== placeId) {
      return;
    }
    const missingUserIds = [];
    const seenUserIds = new Set();
    dialog
      .querySelectorAll("[data-rsl-private-server-owner-id]")
      .forEach((image) => {
        const userId = image.getAttribute("data-rsl-private-server-owner-id") || "";
        const cachedUrl = privateServerOwnerThumbnailUrls.get(userId);
        if (cachedUrl) {
          applyPrivateServerThumbnail(image, cachedUrl, `profile:${userId}`, placeId);
          return;
        }
        const unavailableUntil =
          privateServerOwnerThumbnailUnavailableUntil.get(userId) || 0;
        if (unavailableUntil > Date.now()) {
          finishPrivateServerThumbnailLoading(
            image,
            `profile:${userId}`,
            "network",
            "fallback"
          );
          return;
        }
        privateServerOwnerThumbnailUnavailableUntil.delete(userId);
        if (
          /^[1-9]\d{0,19}$/.test(userId) &&
          !seenUserIds.has(userId) &&
          !privateServerOwnerThumbnailPendingIds.has(userId)
        ) {
          seenUserIds.add(userId);
          missingUserIds.push(userId);
        }
      });

    for (let index = 0; index < missingUserIds.length; index += 100) {
      requestPrivateServerOwnerThumbnailBatch(
        dialog,
        placeId,
        missingUserIds.slice(index, index + 100)
      );
    }
  }

  function makePrivateServerRow(server) {
    const item = document.createElement("li");
    item.className = "rsl-private-servers-dialog__row";

    const avatar = document.createElement("span");
    avatar.className =
      "rsl-private-servers-dialog__owner-avatar rsl-owned-thumbnail-frame";
    const avatarImage = document.createElement("img");
    avatarImage.alt = "";
    avatarImage.decoding = "async";
    avatarImage.loading = "lazy";
    avatarImage.referrerPolicy = "no-referrer";
    avatarImage.src = DEFAULT_AVATAR_URL;
    avatarImage.addEventListener("error", () => {
      if (avatarImage.dataset.rslPrivateServerFallbackApplied === "true") {
        finishPrivateServerThumbnailLoading(
          avatarImage,
          null,
          null,
          "fallback"
        );
        return;
      }
      const ownerId =
        avatarImage.getAttribute("data-rsl-private-server-owner-id") || "";
      if (
        ownerId &&
        privateServerOwnerThumbnailUrls.get(ownerId) ===
          avatarImage.getAttribute("src")
      ) {
        markPrivateServerOwnerThumbnailUnavailable(ownerId);
      }
      avatarImage.dataset.rslPrivateServerFallbackApplied = "true";
      avatarImage.src = DEFAULT_AVATAR_URL;
      finishPrivateServerThumbnailLoading(
        avatarImage,
        null,
        null,
        "fallback"
      );
    });
    if (server.owner.id) {
      avatarImage.setAttribute("data-rsl-private-server-owner-id", server.owner.id);
      avatarImage.dataset.rslPrivateServerThumbnailKey = `profile:${server.owner.id}`;
      setPrivateServerThumbnailLoading(avatarImage, "network");
    } else {
      avatar.dataset.rslThumbnailState = "fallback";
    }
    avatar.append(avatarImage);

    const info = document.createElement("div");
    info.className = "rsl-private-servers-dialog__info";
    const name = document.createElement("strong");
    name.className = "rsl-private-servers-dialog__name";
    name.textContent = server.name;
    name.title = server.name;
    const meta = document.createElement("span");
    meta.className = "rsl-private-servers-dialog__meta";
    if (server.owner.displayName) {
      meta.append(document.createTextNode("Owned by "));
      if (server.owner.id) {
        const ownerLink = document.createElement("a");
        ownerLink.className = "rsl-private-servers-dialog__owner-link";
        ownerLink.href = `/users/${server.owner.id}/profile`;
        ownerLink.textContent = server.owner.displayName;
        ownerLink.title = `View ${server.owner.displayName}'s profile`;
        meta.append(ownerLink);
      } else {
        meta.append(document.createTextNode(server.owner.displayName));
      }
      meta.append(document.createTextNode(" · "));
    }
    meta.append(
      document.createTextNode(`${server.playing}/${server.maxPlayers || "?"} players`)
    );
    info.append(name, meta);

    const join = document.createElement("button");
    join.type = "button";
    join.className =
      "rsl-private-servers-dialog__join foundation-web-button relative clip " +
      "cursor-pointer flex items-center justify-center radius-medium " +
      "bg-action-emphasis content-action-emphasis";
    join.setAttribute(PRIVATE_SERVER_ACTION_ATTRIBUTE, "join");
    join.setAttribute(PRIVATE_SERVER_TOKEN_ATTRIBUTE, server.token);
    join.setAttribute(PRIVATE_SERVER_PLACE_ID_ATTRIBUTE, privateServersPlaceId);
    const isFull = server.maxPlayers > 0 && server.playing >= server.maxPlayers;
    const isJoining = privateServerJoiningToken === server.token;
    join.setAttribute(
      "aria-label",
      isFull ? `${server.name} is full` : `Join ${server.name}`
    );
    join.textContent = isJoining ? "Joining..." : isFull ? "Full" : "Join";
    join.disabled =
      privateServersGameJoinRestricted || isFull || Boolean(privateServerJoinPromise);
    if (isJoining) {
      join.setAttribute("aria-busy", "true");
    }
    privateServersByToken.set(server.token, server);
    join.addEventListener("click", (event) => {
      if (event.isTrusted !== true) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      joinPrivateServer(join, server);
    });

    item.append(avatar, info, join);
    return item;
  }

  function renderPrivateServersPrice(
    dialog = document.getElementById(PRIVATE_SERVERS_DIALOG_ID)
  ) {
    const priceLine = dialog?.querySelector("[data-rsl-private-servers-price]");
    if (!priceLine) {
      return;
    }
    const formattedPrice = formatPrivateServerPrice(privateServersPrice);
    if (formattedPrice === null) {
      priceLine.hidden = true;
      priceLine.textContent = "";
      return;
    }
    priceLine.textContent = `Server cost: ${formattedPrice}`;
    priceLine.hidden = false;
  }

  function renderPrivateServersDialog() {
    const dialog = document.getElementById(PRIVATE_SERVERS_DIALOG_ID);
    const list = dialog?.querySelector("[data-rsl-private-servers-list]");
    const status = dialog?.querySelector("[data-rsl-private-servers-status]");
    if (!dialog || !list || !status) {
      return;
    }

    renderPrivateServersPrice(dialog);
    const visibleServers = privateServers.filter((server) =>
      matchesPrivateServerSearch(server, privateServersSearchQuery)
    );

    privateServersByToken.clear();
    list.replaceChildren();
    list.setAttribute(
      "aria-busy",
      String(privateServersLoadState === "loading" || privateServersLoadState === "loading-more")
    );

    if (privateServersLoadState === "loading" && privateServers.length === 0) {
      status.textContent = "Loading private servers…";
      list.append(makePrivateServersState("Loading private servers…"));
    } else if (privateServersLoadState === "error" && privateServers.length === 0) {
      status.textContent = "Private servers could not be loaded.";
      const state = makePrivateServersState("Private servers could not be loaded.");
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "rsl-button rsl-button--secondary";
      retry.textContent = "Retry";
      retry.addEventListener("click", () => void loadPrivateServersPage(true));
      state.append(retry);
      list.append(state);
    } else if (privateServers.length === 0) {
      status.textContent = "No private servers found.";
      list.append(
        makePrivateServersState(
          "Roblox did not return any private servers for this experience."
        )
      );
    } else if (visibleServers.length === 0) {
      const noMatchesMessage = privateServersLoadState === "loading-more"
        ? "No matches in the loaded servers yet. Loading the rest…"
        : privateServersLoadState === "error-more"
          ? "No matches in the servers that loaded. Some servers could not be loaded."
          : "No private servers match your search.";
      status.textContent = noMatchesMessage;
      list.append(makePrivateServersState(noMatchesMessage));
    } else {
      status.textContent = privateServersGameJoinRestricted
        ? "Your Roblox settings currently prevent joining this experience."
        : privateServersLoadState === "loading-more"
          ? privateServersSearchQuery
            ? `${visibleServers.length} matching private servers found. Loading the rest…`
            : `${privateServers.length} private servers found. Loading the rest…`
          : privateServersLoadState === "error-more"
            ? privateServersSearchQuery
              ? `Showing ${visibleServers.length} of ${privateServers.length} loaded private servers. The rest could not be loaded.`
              : `Showing ${privateServers.length} private servers. The rest could not be loaded.`
            : privateServersSearchQuery
              ? `${visibleServers.length} of ${privateServers.length} private servers shown.`
              : `${privateServers.length} private servers available.`;
      const fragment = document.createDocumentFragment();
      for (const server of visibleServers) {
        fragment.append(makePrivateServerRow(server));
      }
      list.append(fragment);
      hydratePrivateServerOwnerThumbnails(dialog, privateServersPlaceId);
    }
  }

  function loadPrivateServersPage(reset = false) {
    if (privateServersRequestPromise) {
      return privateServersRequestPromise;
    }
    const dialog = document.getElementById(PRIVATE_SERVERS_DIALOG_ID);
    const placeId = privateServersPlaceId;
    if (!dialog?.open || !placeId) {
      return Promise.resolve();
    }
    const cursor = reset ? null : privateServersNextPageCursor;
    if (!reset && !cursor) {
      return Promise.resolve();
    }
    if (
      !reset &&
      (privateServersLoadedPageCount >= PRIVATE_SERVER_MAX_AUTO_PAGES ||
        privateServersLoadedCursors.has(cursor))
    ) {
      privateServersLoadState = privateServers.length > 0 ? "error-more" : "error";
      privateServersErrorCode = "INVALID";
      renderPrivateServersDialog();
      return Promise.resolve();
    }

    const requestId = ++privateServersRequestId;
    if (reset) {
      privateServers = [];
      privateServersNextPageCursor = null;
      privateServersLoadedPageCount = 0;
      privateServersLoadedCursors.clear();
      privateServersGameJoinRestricted = false;
      privateServersLoadState = "loading";
    } else {
      privateServersLoadState = "loading-more";
    }
    privateServersErrorCode = "";
    renderPrivateServersDialog();

    const request = sendPrivateServerRuntimeMessage({
      type: "rsl:get-private-servers",
      placeId,
      requestId,
      cursor
    })
      .then((response) => {
        if (
          requestId !== privateServersRequestId ||
          !document.getElementById(PRIVATE_SERVERS_DIALOG_ID)?.open ||
          privateServersPlaceId !== placeId
        ) {
          return;
        }
        if (
          !privateServersDialogOpener?.isConnected ||
          !isQuickPlayButtonCurrent(privateServersDialogOpener, placeId)
        ) {
          closePrivateServersDialog(false);
          return;
        }
        if (
          response?.ok !== true ||
          response?.requestId !== requestId ||
          normalizeQuickPlayPlaceId(response?.placeId) !== placeId ||
          !Array.isArray(response.servers)
        ) {
          const error = new Error("Could not load private servers");
          error.code = response?.code || "NETWORK";
          throw error;
        }

        const incoming = response.servers
          .map(normalizePrivateServer)
          .filter(Boolean);
        const knownIds = new Set(privateServers.map((server) => server.id));
        for (const server of incoming) {
          if (!knownIds.has(server.id)) {
            knownIds.add(server.id);
            privateServers.push(server);
          }
        }
        const rawNextCursor = response.nextPageCursor;
        const nextCursor = normalizePrivateServerCursor(rawNextCursor);
        if (rawNextCursor != null && rawNextCursor !== "" && !nextCursor) {
          const error = new Error("Invalid private server cursor");
          error.code = "INVALID";
          throw error;
        }
        if (cursor) {
          privateServersLoadedCursors.add(cursor);
        }
        privateServersLoadedPageCount += 1;
        if (
          nextCursor &&
          (nextCursor === cursor ||
            privateServersLoadedCursors.has(nextCursor) ||
            privateServersLoadedPageCount >= PRIVATE_SERVER_MAX_AUTO_PAGES)
        ) {
          const error = new Error("Private server pagination did not terminate");
          error.code = "INVALID";
          throw error;
        }
        privateServersNextPageCursor = nextCursor;
        privateServersGameJoinRestricted =
          privateServersGameJoinRestricted || response.gameJoinRestricted === true;
        privateServersLoadState = "ready";
        privateServersErrorCode = "";
      })
      .catch((error) => {
        if (requestId !== privateServersRequestId || privateServersPlaceId !== placeId) {
          return;
        }
        privateServersErrorCode = error?.code || "NETWORK";
        privateServersLoadState = privateServers.length > 0 ? "error-more" : "error";
      })
      .finally(() => {
        const shouldLoadNext =
          requestId === privateServersRequestId &&
          privateServersLoadState === "ready" &&
          Boolean(privateServersNextPageCursor) &&
          document.getElementById(PRIVATE_SERVERS_DIALOG_ID)?.open &&
          privateServersPlaceId === placeId;
        if (requestId === privateServersRequestId) {
          privateServersRequestPromise = null;
          renderPrivateServersDialog();
        }
        if (shouldLoadNext) {
          void loadPrivateServersPage(false);
        }
      });
    privateServersRequestPromise = request;
    return request;
  }

  function resetPrivateServersDialogState() {
    privateServersRequestId += 1;
    privateServersRequestPromise = null;
    privateServerJoinRequestId += 1;
    privateServerJoinPromise = null;
    privateServerJoiningToken = null;
    privateServersByToken.clear();
    privateServersPlaceId = null;
    privateServersCardName = "";
    privateServersPrice = null;
    privateServersSearchQuery = "";
    privateServers = [];
    privateServersNextPageCursor = null;
    privateServersLoadedPageCount = 0;
    privateServersLoadedCursors.clear();
    privateServersLoadState = "idle";
    privateServersErrorCode = "";
    privateServersGameJoinRestricted = false;
  }

  function closePrivateServersDialog(restoreFocus = true) {
    const dialog = document.getElementById(PRIVATE_SERVERS_DIALOG_ID);
    if (dialog?.open) {
      dialog.dataset.rslRestorePrivateServerFocus = restoreFocus ? "true" : "false";
      dialog.close();
      return;
    }
    const opener = privateServersDialogOpener;
    privateServersDialogOpener = null;
    resetPrivateServersDialogState();
    if (restoreFocus && opener?.isConnected) {
      opener.focus({ preventScroll: true });
    }
  }

  function createPrivateServersDialog() {
    const dialog = document.createElement("dialog");
    dialog.id = PRIVATE_SERVERS_DIALOG_ID;
    dialog.className =
      "rsl-dialog rsl-private-servers-dialog foundation-web-dialog-overlay " +
      "padding-medium foundation-web-portal-zindex bg-common-backdrop";
    dialog.setAttribute("aria-labelledby", "rsl-private-servers-dialog-title");
    dialog.setAttribute("aria-describedby", "rsl-private-servers-dialog-description");
    dialog.innerHTML = `
      <div class="rsl-dialog__surface rsl-private-servers-dialog__surface relative radius-large bg-surface-100 stroke-muted stroke-standard foundation-web-dialog-content shadow-transient-high" data-size="Medium">
        <div class="rsl-dialog__close-container absolute foundation-web-dialog-close-container">
          <button type="button" class="rsl-icon-button foundation-web-close-affordance" aria-label="Close" data-rsl-close-private-servers>
            <span aria-hidden="true" class="rsl-dialog__close-icon"></span>
          </button>
        </div>
        <div class="rsl-dialog__body rsl-private-servers-dialog__body">
          <div class="rsl-dialog__header rsl-private-servers-dialog__header">
            <span class="rsl-private-servers-dialog__game-icon rsl-owned-thumbnail-frame" aria-hidden="true" data-rsl-thumbnail-state="fallback">
              <img src="${DEFAULT_GAME_ICON_URL}" alt="" decoding="async" referrerpolicy="no-referrer" data-rsl-private-servers-game-icon>
            </span>
            <div class="rsl-private-servers-dialog__header-copy">
              <h2 id="rsl-private-servers-dialog-title" class="content-emphasis text-title-large">Private Servers</h2>
              <p id="rsl-private-servers-dialog-description" class="content-default text-body-medium"></p>
              <p class="rsl-private-servers-dialog__price content-default text-body-medium" data-rsl-private-servers-price hidden></p>
            </div>
          </div>
          <label class="rsl-field rsl-private-servers-dialog__search">
            <span class="rsl-sr-only">Search private servers</span>
            <input type="search" class="rsl-private-servers-dialog__search-input" placeholder="Search private servers" autocomplete="off" maxlength="100" data-rsl-private-servers-search>
          </label>
          <div class="rsl-private-servers-dialog__status content-default text-body-medium" role="status" aria-live="polite" aria-atomic="true" data-rsl-private-servers-status></div>
          <ul class="rsl-private-servers-dialog__list" aria-label="Private servers" data-rsl-private-servers-list></ul>
        </div>
        <div class="rsl-dialog__actions rsl-private-servers-dialog__footer">
          <a class="rsl-button rsl-button--primary foundation-web-button relative flex items-center justify-center radius-medium" href="/home" data-rsl-private-servers-page-link>View Private Servers</a>
          <button type="button" class="rsl-button rsl-button--secondary" data-rsl-close-private-servers>Close</button>
        </div>
      </div>`;

    const gameIcon = dialog.querySelector("[data-rsl-private-servers-game-icon]");
    gameIcon?.addEventListener("error", () => {
      if (gameIcon.dataset.rslPrivateServerFallbackApplied === "true") {
        finishPrivateServerThumbnailLoading(gameIcon, null, null, "fallback");
        return;
      }
      gameIcon.dataset.rslPrivateServerFallbackApplied = "true";
      gameIcon.src = DEFAULT_GAME_ICON_URL;
      finishPrivateServerThumbnailLoading(gameIcon, null, null, "fallback");
    });

    dialog.querySelectorAll("[data-rsl-close-private-servers]").forEach((button) => {
      button.addEventListener("click", () => closePrivateServersDialog(true));
    });
    dialog.querySelector("[data-rsl-private-servers-search]")?.addEventListener(
      "input",
      (event) => {
        privateServersSearchQuery = normalizePrivateServersSearchQuery(
          event.currentTarget?.value
        );
        renderPrivateServersDialog();
      }
    );
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        closePrivateServersDialog(true);
      }
    });
    dialog.addEventListener("close", () => {
      const restoreFocus = dialog.dataset.rslRestorePrivateServerFocus !== "false";
      delete dialog.dataset.rslRestorePrivateServerFocus;
      const opener = privateServersDialogOpener;
      privateServersDialogOpener = null;
      resetPrivateServersDialogState();
      if (restoreFocus && opener?.isConnected) {
        opener.focus({ preventScroll: true });
      }
      queueMount();
    });
    document.body.append(dialog);
    return dialog;
  }

  function openPrivateServersDialog(opener, placeId, cardName, price = null) {
    if (!opener?.isConnected || !isQuickPlayButtonCurrent(opener, placeId)) {
      return;
    }
    let dialog = document.getElementById(PRIVATE_SERVERS_DIALOG_ID);
    if (!dialog) {
      dialog = createPrivateServersDialog();
    }
    if (dialog.open) {
      if (privateServersDialogOpener === opener && privateServersPlaceId === placeId) {
        privateServersPrice = normalizePrivateServerPrice(price);
        renderPrivateServersPrice(dialog);
        dialog.querySelector("[data-rsl-close-private-servers]")?.focus();
        return;
      }
      dialog.addEventListener(
        "close",
        () => {
          if (opener.isConnected) {
            openPrivateServersDialog(opener, placeId, cardName, price);
          }
        },
        { once: true }
      );
      closePrivateServersDialog(false);
      return;
    }

    privateServersDialogOpener = opener;
    privateServersPlaceId = placeId;
    privateServersCardName = String(cardName || "this experience").trim().slice(0, 150) ||
      "this experience";
    privateServersPrice = normalizePrivateServerPrice(price);
    privateServersSearchQuery = "";
    privateServers = [];
    privateServersNextPageCursor = null;
    privateServersLoadState = "loading";
    privateServersErrorCode = "";
    privateServersGameJoinRestricted = false;
    const description = dialog.querySelector("#rsl-private-servers-dialog-description");
    if (description) {
      const gameLink = document.createElement("a");
      gameLink.className = "rsl-private-servers-dialog__game-link";
      gameLink.href = `/games/${placeId}`;
      gameLink.textContent = privateServersCardName;
      gameLink.title = `View ${privateServersCardName}`;
      description.replaceChildren(
        document.createTextNode("Choose a private server for "),
        gameLink,
        document.createTextNode(".")
      );
    }
    const search = dialog.querySelector("[data-rsl-private-servers-search]");
    if (search) {
      search.value = "";
    }
    const pageLink = dialog.querySelector("[data-rsl-private-servers-page-link]");
    if (pageLink) {
      pageLink.href = getPrivateServersPageUrl(placeId);
    }
    renderPrivateServersDialog();
    loadPrivateServerGameThumbnail(dialog, placeId);
    dialog.showModal();
    dialog.querySelector("[data-rsl-close-private-servers]")?.focus();
    void loadPrivateServersPage(true);
  }

  function makeQuickPlaySurface(root, thumbnail, placeId) {
    const showPlay = isQuickPlayActionEnabled("play");
    const showPrivate = isQuickPlayActionEnabled("private");
    const showRandom = isQuickPlayActionEnabled("random");
    if (!showPlay && !showPrivate && !showRandom) {
      return null;
    }
    const surface = document.createElement("div");
    surface.setAttribute(QUICK_PLAY_SURFACE_ATTRIBUTE, "");
    surface.dataset.rslQuickPlayPlaceId = placeId;
    surface.dataset.rslPrivateServerSupported = "unknown";
    surface.setAttribute("role", "group");
    surface.setAttribute("aria-label", "Experience launch controls");

    const tray = document.createElement("div");
    tray.className = "rsl-quick-play-tray";
    tray.setAttribute(QUICK_PLAY_TRAY_ATTRIBUTE, "");

    const actions = document.createElement("div");
    actions.className = "rsl-quick-play-actions";

    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "btn-common-play-game-lg btn-primary-md btn-full-width rsl-quick-play-button";
    button.setAttribute(QUICK_PLAY_ACTION_ATTRIBUTE, "play");
    button.setAttribute(QUICK_PLAY_PLACE_ID_ATTRIBUTE, placeId);
    const label = `Quick Play ${getQuickPlayCardName(root, thumbnail)}`;
    button.dataset.rslQuickPlayDefaultLabel = label;
    button.setAttribute("aria-label", label);
    button.title = "Quick Play";
    button.innerHTML = '<span class="icon-common-play" aria-hidden="true"></span>';
    const stopCardPointerAction = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    button.addEventListener("pointerdown", (event) => event.stopPropagation());
    button.addEventListener("click", stopCardPointerAction);
    button.addEventListener("auxclick", stopCardPointerAction);

    const privateButton = document.createElement("button");
    privateButton.type = "button";
    privateButton.hidden = true;
    privateButton.className =
      "btn-common-play-game-lg btn-primary-md btn-full-width rsl-quick-play-button rsl-private-server-button";
    privateButton.setAttribute(QUICK_PLAY_ACTION_ATTRIBUTE, "private");
    privateButton.setAttribute(QUICK_PLAY_PLACE_ID_ATTRIBUTE, placeId);
    privateButton.setAttribute("aria-haspopup", "dialog");
    const privateLabel = `Private Servers ${getQuickPlayCardName(root, thumbnail)}`;
    privateButton.dataset.rslQuickPlayDefaultLabel = privateLabel;
    privateButton.setAttribute("aria-label", privateLabel);
    privateButton.title = "Private Servers";
    privateButton.innerHTML =
      '<span class="rsl-private-server-icon" aria-hidden="true">' +
      '<svg viewBox="0 0 32 32" fill="none" focusable="false" aria-hidden="true">' +
      '<g stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="2.5" y="3.5" width="27" height="6.5" rx="2.2"/>' +
      '<rect x="2.5" y="12.75" width="27" height="6.5" rx="2.2"/>' +
      '<rect x="2.5" y="22" width="27" height="6.5" rx="2.2"/>' +
      '</g><g stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M11.75 13v-2.25a4.25 4.25 0 0 1 8.5 0V13" stroke="var(--rsl-private-server-cutout, #335fff)" stroke-width="6"/>' +
      '<rect x="8.75" y="12" width="14.5" height="13.5" rx="3" fill="var(--rsl-private-server-cutout, #335fff)" stroke="var(--rsl-private-server-cutout, #335fff)" stroke-width="5"/>' +
      '<path d="M11.75 13v-2.25a4.25 4.25 0 0 1 8.5 0V13" stroke="currentColor" stroke-width="2.2"/>' +
      '<rect x="8.75" y="12" width="14.5" height="13.5" rx="3" fill="var(--rsl-private-server-cutout, #335fff)" stroke="currentColor" stroke-width="2.2"/>' +
      '<circle cx="16" cy="18.25" r="1.35" fill="currentColor"/>' +
      '<path d="M16 19.5v2.15" stroke="currentColor" stroke-width="2"/>' +
      '</g></svg></span>';
    privateButton.addEventListener("pointerdown", (event) => event.stopPropagation());
    privateButton.addEventListener("click", (event) => {
      stopCardPointerAction(event);
      if (event.isTrusted !== true) {
        return;
      }
      openPrivateServersDialog(
        privateButton,
        placeId,
        getQuickPlayCardName(root, thumbnail),
        readPrivateServerPriceFromSurface(
          privateButton.closest(`[${QUICK_PLAY_SURFACE_ATTRIBUTE}]`)
        )
      );
    });
    privateButton.addEventListener("auxclick", stopCardPointerAction);

    const randomButton = document.createElement("button");
    randomButton.type = "button";
    randomButton.className =
      "btn-common-play-game-lg btn-primary-md btn-full-width rsl-quick-play-button rsl-random-server-button";
    randomButton.setAttribute(QUICK_PLAY_ACTION_ATTRIBUTE, "random");
    randomButton.setAttribute(QUICK_PLAY_PLACE_ID_ATTRIBUTE, placeId);
    const randomLabel = `Random Server ${getQuickPlayCardName(root, thumbnail)}`;
    randomButton.dataset.rslQuickPlayDefaultLabel = randomLabel;
    randomButton.setAttribute("aria-label", randomLabel);
    randomButton.title = "Random Server";
    randomButton.innerHTML =
      '<span class="rsl-random-server-icon" aria-hidden="true">' +
      '<svg viewBox="0 0 32 32" fill="none" focusable="false" aria-hidden="true">' +
      '<g stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="2.5" y="3.5" width="27" height="6.5" rx="2.2"/>' +
      '<rect x="2.5" y="12.75" width="27" height="6.5" rx="2.2"/>' +
      '<rect x="2.5" y="22" width="27" height="6.5" rx="2.2"/>' +
      '</g><g>' +
      '<rect x="8.5" y="8.5" width="15" height="15" rx="3" fill="var(--rsl-random-server-cutout, #335fff)" stroke="var(--rsl-random-server-cutout, #335fff)" stroke-width="6"/>' +
      '<rect x="8.5" y="8.5" width="15" height="15" rx="3" fill="var(--rsl-random-server-cutout, #335fff)" stroke="currentColor" stroke-width="2.4"/>' +
      '<g fill="currentColor"><circle cx="12.25" cy="12.25" r="1.2"/><circle cx="19.75" cy="19.75" r="1.2"/><circle cx="16" cy="16" r="1.2"/></g></g></svg></span>';
    randomButton.addEventListener("pointerdown", (event) => event.stopPropagation());
    randomButton.addEventListener("click", stopCardPointerAction);
    randomButton.addEventListener("auxclick", stopCardPointerAction);

    if (showPrivate && showPlay && showRandom) {
      actions.append(privateButton, button, randomButton);
    } else {
      if (showPrivate) {
        actions.append(privateButton);
      }
      if (showPlay) {
        actions.append(button);
      }
      if (showRandom) {
        actions.append(randomButton);
      }
    }
    tray.append(actions);
    surface.append(tray);
    return surface;
  }

  function removeQuickPlaySurface(root) {
    const surface = Array.from(root.children).find((child) =>
      child.hasAttribute?.(QUICK_PLAY_SURFACE_ATTRIBUTE)
    );
    const supportPlaceId = getPrivateServerSupportSurfacePlaceId(surface);
    removePrivateServerSupportInteraction(surface);
    surface?.querySelectorAll(`[${QUICK_PLAY_ACTION_ATTRIBUTE}]`).forEach((button) =>
      clearQuickPlayFeedback(button)
    );
    if (surface && privateServersDialogOpener?.closest?.(`[${QUICK_PLAY_SURFACE_ATTRIBUTE}]`) === surface) {
      closePrivateServersDialog(false);
    }
    surface?.remove();
    if (
      supportPlaceId &&
      getPrivateServerSupportSurfaces(supportPlaceId).length === 0
    ) {
      clearPrivateServerSupportRetry(supportPlaceId);
    }
    root.removeAttribute(QUICK_PLAY_HOST_ATTRIBUTE);
    root.querySelectorAll(`[${QUICK_PLAY_THUMBNAIL_ATTRIBUTE}]`).forEach((thumbnail) => {
      quickPlayGeometryObserver?.unobserve(thumbnail);
      thumbnail.removeAttribute(QUICK_PLAY_THUMBNAIL_ATTRIBUTE);
    });
  }

  function hasCompetingQuickPlay(root, thumbnail) {
    return thumbnail.classList.contains("ropro-card-quick-play") ||
      Boolean(root.querySelector(".ropro-card-quick-play-options"));
  }

  function mountQuickPlayCard(thumbnail, mountedRoots) {
    const root = thumbnail.closest(QUICK_PLAY_CARD_ROOT_SELECTOR);
    if (!root || root.closest(".rsl-dialog")) {
      return;
    }
    if (hasCompetingQuickPlay(root, thumbnail)) {
      removeQuickPlaySurface(root);
      return;
    }

    const link = findQuickPlayCardLink(thumbnail, root);
    const placeId = getQuickPlayPlaceId(link);
    if (!link || !placeId) {
      removeQuickPlaySurface(root);
      return;
    }

    mountedRoots.add(root);
    const previousPlaceId = root.getAttribute(QUICK_PLAY_HOST_ATTRIBUTE);
    if (previousPlaceId && previousPlaceId !== placeId) {
      removeQuickPlaySurface(root);
    }
    root.setAttribute(QUICK_PLAY_HOST_ATTRIBUTE, placeId);
    thumbnail.setAttribute(QUICK_PLAY_THUMBNAIL_ATTRIBUTE, "");
    let surface = Array.from(root.children).find((child) =>
      child.hasAttribute?.(QUICK_PLAY_SURFACE_ATTRIBUTE)
    );
    if (!surface) {
      surface = makeQuickPlaySurface(root, thumbnail, placeId);
      if (!surface) {
        removeQuickPlaySurface(root);
        mountedRoots.delete(root);
        return;
      }
      root.append(surface);
    }
    const cardName = getQuickPlayCardName(root, thumbnail);
    surface.querySelectorAll(`[${QUICK_PLAY_ACTION_ATTRIBUTE}]`).forEach((button) => {
      const action = button.getAttribute(QUICK_PLAY_ACTION_ATTRIBUTE);
      const actionLabel = action === "private"
        ? "Private Servers"
        : action === "random"
          ? "Random Server"
          : "Quick Play";
      const label = `${actionLabel} ${cardName}`;
      button.setAttribute(QUICK_PLAY_PLACE_ID_ATTRIBUTE, placeId);
      button.dataset.rslQuickPlayDefaultLabel = label;
      if (!button.dataset.rslQuickPlayState) {
        button.setAttribute("aria-label", label);
      }
    });
    syncQuickPlaySurfaceGeometry(surface, root, thumbnail);
    getQuickPlayGeometryObserver()?.observe(thumbnail);
    const showPrivate = isQuickPlayActionEnabled("private");
    if (showPrivate) {
      observePrivateServerSupport(surface);
    } else {
      removePrivateServerSupportInteraction(surface);
    }
  }

  function mountQuickPlayControls() {
    const mountedRoots = new Set();
    document.querySelectorAll(QUICK_PLAY_NATIVE_HOST_SELECTOR).forEach((thumbnail) =>
      mountQuickPlayCard(thumbnail, mountedRoots)
    );
    document.querySelectorAll(`[${QUICK_PLAY_HOST_ATTRIBUTE}]`).forEach((root) => {
      if (!mountedRoots.has(root)) {
        removeQuickPlaySurface(root);
      }
    });
  }

  function cleanupQuickPlayFeature() {
    closePrivateServersDialog(false);
    document.querySelectorAll(`[${QUICK_PLAY_HOST_ATTRIBUTE}]`).forEach((root) => {
      removeQuickPlaySurface(root);
    });
    quickPlayGeometryObserver?.disconnect();
    quickPlayGeometryObserver = null;
    cancelQueuedPrivateServerSupportRequests();
    for (const placeId of Array.from(privateServerSupportRetryByPlaceId.keys())) {
      clearPrivateServerSupportRetry(placeId);
    }
  }

  function getRoToolLogoMarkup(className = "") {
    const robloxMarkPath = "M2 17.88L17.88 22L22 6.12L6.12 2zm8.86-7.81l3.07.79l-.79 3.07l-3.07-.79z";
    const hammerPath = "m280.16 242.79l-26.11-26.12a32 32 0 0 0-45.14-.12L27.38 384.08c-6.61 6.23-10.95 14.17-11.35 23.06a32.1 32.1 0 0 0 9.21 23.94l39 39.43A32.3 32.3 0 0 0 87 480h1.18c8.89-.33 16.85-4.5 23.17-11.17l168.7-180.7a32 32 0 0 0 .11-45.34M490 190l-.31-.31l-34.27-33.92a21.46 21.46 0 0 0-15.28-6.26a21.9 21.9 0 0 0-12.79 4.14c0-.43.06-.85.09-1.22c.45-6.5 1.15-16.32-5.2-25.22a258 258 0 0 0-24.8-28.74c-13.32-13.12-42.31-37.83-86.72-55.94A139.6 139.6 0 0 0 257.56 32C226 32 202 46.24 192.81 54.68a120 120 0 0 0-14.18 16.22a16 16 0 0 0 18.65 24.34a75 75 0 0 1 8.58-2.63a63.5 63.5 0 0 1 18.45-1.15c13.19 1.09 28.79 7.64 35.69 13.09c11.7 9.41 17.33 22.09 18.26 41.09c.18 3.82-7.72 18.14-20 34.48a16 16 0 0 0 1.45 21l34.41 34.41a16 16 0 0 0 22 .62c9.73-8.69 24.55-21.79 29.73-25c7.69-4.73 13.19-5.64 14.7-5.8a19.2 19.2 0 0 1 11.29 2.38a1.24 1.24 0 0 1-.31.95l-1.82 1.73a21.52 21.52 0 0 0 .05 30.54l34.26 33.91a21.45 21.45 0 0 0 15.28 6.25a21.7 21.7 0 0 0 15.22-6.2l55.5-54.82A21.87 21.87 0 0 0 490 190";
    return (
      `<svg class="${className}" viewBox="-16 -4 128 128" aria-hidden="true" focusable="false">` +
      '<g class="rsl-rotool-logo-hover-outline" fill="none" stroke="#fff" stroke-width="8" stroke-linejoin="round">' +
      '<path vector-effect="non-scaling-stroke" transform="translate(-7 5) scale(4.6)" d="' +
      robloxMarkPath +
      '"/>' +
      '<path vector-effect="non-scaling-stroke" transform="translate(5 20) scale(.18)" d="' +
      hammerPath +
      '"/>' +
      "</g>" +
      '<path fill="#18181b" fill-rule="evenodd" stroke="#fff" stroke-width="4" ' +
      'stroke-linejoin="round" paint-order="stroke fill" vector-effect="non-scaling-stroke" ' +
      'transform="translate(-7 5) scale(4.6)" d="' +
      robloxMarkPath +
      '"/>' +
      '<path fill="#fff" stroke="#18181b" stroke-width="4" stroke-linejoin="round" ' +
      'paint-order="stroke fill" vector-effect="non-scaling-stroke" ' +
      'transform="translate(5 20) scale(.18)" d="' +
      hammerPath +
      '"/>' +
      "</svg>"
    );
  }

  function findNativeHeaderSettingsItem() {
    const header = document.querySelector(
      "#header, header[role='navigation'], [role='navigation'].rbx-header"
    );
    if (!header) {
      return null;
    }
    const nativeItem =
      header.querySelector("#navbar-settings") ||
      header
        .querySelector(
          "#right-navigation-header button[aria-label='Settings'], " +
          ".rbx-navbar-right button[aria-label='Settings']"
        )
        ?.closest("li, [role='listitem']");
    return nativeItem?.parentElement ? nativeItem : null;
  }

  function syncFeatureSettingsButtonGeometry(item, nativeItem) {
    const button = item?.querySelector(".rsl-navbar-settings-button");
    const nativeButton = nativeItem?.querySelector("button");
    if (!button || !nativeButton) {
      return;
    }

    const itemRect = nativeItem.getBoundingClientRect();
    const buttonRect = nativeButton.getBoundingClientRect();
    const nativeIcon = nativeButton.querySelector(
      "#nav-settings, .icon-nav-settings, [data-testid='foundation-web-icon'], svg"
    );
    const iconRect = nativeIcon?.getBoundingClientRect?.() || null;
    const buttonWidth = buttonRect.width > 0 ? buttonRect.width : 36;
    const buttonHeight = buttonRect.height > 0 ? buttonRect.height : 36;
    const itemWidth = itemRect.width > 0 ? itemRect.width : buttonWidth;
    const itemHeight = itemRect.height > 0 ? itemRect.height : Math.max(40, buttonHeight);
    const measuredIconSize = Math.min(
      Number(iconRect?.width) || 0,
      Number(iconRect?.height) || 0
    );
    const iconSize =
      measuredIconSize >= 16 && measuredIconSize < Math.min(buttonWidth, buttonHeight)
        ? measuredIconSize
        : Math.max(20, Math.min(26, Math.min(buttonWidth, buttonHeight) - 8));

    item.style.setProperty("--rsl-navbar-item-width", `${itemWidth}px`);
    item.style.setProperty("--rsl-navbar-item-height", `${itemHeight}px`);
    item.style.setProperty("--rsl-navbar-button-width", `${buttonWidth}px`);
    item.style.setProperty("--rsl-navbar-button-height", `${buttonHeight}px`);
    item.style.setProperty("--rsl-navbar-logo-size", `${iconSize}px`);
  }

  function mountFeatureSettingsButton() {
    const nativeItem = findNativeHeaderSettingsItem();
    if (!nativeItem) {
      return;
    }

    const duplicates = Array.from(
      document.querySelectorAll(`#${FEATURE_SETTINGS_NAV_ID}`)
    );
    let item = duplicates.shift() || null;
    duplicates.forEach((duplicate) => duplicate.remove());
    if (!item) {
      item = document.createElement("li");
      item.id = FEATURE_SETTINGS_NAV_ID;
      item.className = "navbar-icon-item";
      item.setAttribute("data-rsl-control", "feature-settings");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "rsl-navbar-settings-button";
      button.setAttribute("aria-label", "RoTool Settings");
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-controls", FEATURE_SETTINGS_DIALOG_ID);
      button.setAttribute("aria-expanded", "false");
      button.innerHTML = getRoToolLogoMarkup("rsl-navbar-settings-logo");
      button.addEventListener("click", () => openFeatureSettingsDialog(button));
      item.append(button);
    }

    // Place RoTool directly to the right of Roblox's own gear in the same
    // native icon group.
    if (
      item.parentElement !== nativeItem.parentElement ||
      item.previousElementSibling !== nativeItem
    ) {
      nativeItem.insertAdjacentElement("afterend", item);
    }
    syncFeatureSettingsButtonGeometry(item, nativeItem);
  }

  function renderFeatureSettingsDialog() {
    const dialog = document.getElementById(FEATURE_SETTINGS_DIALOG_ID);
    if (!dialog) {
      return;
    }
    dialog.querySelectorAll("[data-rsl-feature-key]").forEach((input) => {
      const key = input.getAttribute("data-rsl-feature-key");
      const parentKey = input.getAttribute("data-rsl-feature-parent-key");
      input.checked = isFeatureEnabled(key);
      input.disabled =
        !featureSettingsLoaded ||
        Boolean(parentKey && !isFeatureEnabled(parentKey));
    });
    dialog.querySelectorAll("[data-rsl-feature-children]").forEach((children) => {
      const parentKey = children.getAttribute("data-rsl-feature-parent-key");
      children.toggleAttribute(
        "data-rsl-feature-parent-disabled",
        Boolean(parentKey && !isFeatureEnabled(parentKey))
      );
    });
    dialog.querySelectorAll("[data-rsl-feature-disclosure]").forEach((button) => {
      button.disabled = !featureSettingsLoaded;
    });
    dialog.querySelectorAll("[data-rsl-feature-bulk]").forEach((button) => {
      const parentKey = button.getAttribute("data-rsl-feature-bulk-parent");
      button.disabled =
        !featureSettingsLoaded ||
        Boolean(parentKey && !isFeatureEnabled(parentKey));
    });
    const reset = dialog.querySelector("[data-rsl-feature-reset]");
    if (reset) {
      reset.disabled =
        !featureSettingsLoaded ||
        featureSettingsEqual(featureSettings, DEFAULT_FEATURE_SETTINGS);
    }
    const status = dialog.querySelector("[data-rsl-feature-settings-status]");
    if (status) {
      status.textContent = !featureSettingsLoaded
        ? "Loading settings..."
        : featureSettingsSaving
          ? "Saving..."
          : featureSettingsNotice;
      status.classList.toggle(
        "rsl-feature-settings__status--error",
        !featureSettingsSaving && featureSettingsNoticeIsError
      );
    }
    renderFeatureSettingsUpdateStatus(dialog);
    dialog.setAttribute(
      "aria-busy",
      String(!featureSettingsLoaded)
    );
  }

  async function saveFeatureSettings(nextSettings, fallbackSettings) {
    if (!featureSettingsLoaded) {
      return;
    }
    const normalizedNext = normalizeFeatureSettings(
      serializeFeatureSettings(nextSettings)
    );
    featureSettings = normalizedNext;
    featureSettingsPendingWrites += 1;
    featureSettingsSaving = true;
    featureSettingsNotice = "";
    featureSettingsNoticeIsError = false;
    // Paint the switch first. Potentially expensive page reconciliation is
    // coalesced after that paint, while persistence stays serialized.
    renderFeatureSettingsDialog();
    scheduleFeatureSettingsReconcile();
    const savedSnapshot = { ...featureSettings };
    const write = featureSettingsSaveChain
      .catch(() => undefined)
      .then(() => featureSettingsStorageSet(savedSnapshot));
    featureSettingsSaveChain = write;
    try {
      await write;
      featureSettingsConfirmed = { ...savedSnapshot };
      if (featureSettingsEqual(featureSettings, savedSnapshot)) {
        featureSettingsNotice = "Saved automatically.";
      }
    } catch (error) {
      if (featureSettingsEqual(featureSettings, savedSnapshot)) {
        featureSettings = { ...featureSettingsConfirmed };
        featureSettingsNotice = "That setting could not be saved.";
        featureSettingsNoticeIsError = true;
        scheduleFeatureSettingsReconcile();
      }
      console.error("[RoTool] Failed to save feature settings", error);
    } finally {
      featureSettingsPendingWrites = Math.max(
        0,
        featureSettingsPendingWrites - 1
      );
      featureSettingsSaving = featureSettingsPendingWrites > 0;
      if (
        featureSettingsPendingWrites === 0 &&
        featureSettingsDeferredStorageValue
      ) {
        const deferred = featureSettingsDeferredStorageValue;
        featureSettingsDeferredStorageValue = null;
        // Local writes are authoritative while queued. A deferred value that
        // differs from the last confirmed snapshot is an older own-write event
        // (or a cross-tab race that the local write necessarily superseded).
        if (
          featureSettingsEqual(deferred, featureSettingsConfirmed) &&
          !featureSettingsEqual(featureSettings, deferred)
        ) {
          featureSettings = deferred;
          scheduleFeatureSettingsReconcile();
        }
      }
      renderFeatureSettingsDialog();
    }
  }

  function createFeatureSettingsDialog() {
    const dialog = document.createElement("dialog");
    dialog.id = FEATURE_SETTINGS_DIALOG_ID;
    dialog.className =
      "rsl-dialog rsl-feature-settings-dialog foundation-web-dialog-overlay padding-medium " +
      "foundation-web-portal-zindex bg-common-backdrop";
    dialog.innerHTML = `
      <div class="rsl-dialog__surface rsl-feature-settings-dialog__surface relative radius-large bg-surface-100 stroke-muted stroke-standard foundation-web-dialog-content shadow-transient-high" data-size="Medium">
        <div class="rsl-dialog__close-container absolute foundation-web-dialog-close-container">
          <button type="button" class="rsl-icon-button foundation-web-close-affordance flex stroke-none bg-none cursor-pointer relative clip group/interactable focus-visible:outline-focus disabled:outline-none bg-over-media-100 padding-small radius-circle" data-rsl-feature-settings-close aria-label="Close">
            <div aria-hidden="true" data-testid="foundation-web-state-layer" class="absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none"></div>
            <span aria-hidden="true" data-testid="foundation-web-icon" class="rsl-dialog__close-icon grow-0 shrink-0 basis-auto icon icon-regular-x size-[var(--icon-size-medium)]"></span>
          </button>
        </div>
        <div class="rsl-dialog__body rsl-feature-settings-dialog__body padding-x-xlarge padding-top-xlarge padding-bottom-xlarge">
          <div class="rsl-feature-settings__title-row">
            ${getRoToolLogoMarkup("rsl-feature-settings__logo")}
            <div class="rsl-dialog__header">
              <h2 id="rsl-feature-settings-title" class="content-emphasis text-title-large">RoTool Settings</h2>
              <p id="rsl-feature-settings-description" class="content-default text-body-medium">Choose which RoTool features appear on Roblox. Changes apply immediately.</p>
            </div>
          </div>
          <div class="rsl-feature-settings__update" data-rsl-feature-settings-update hidden>
            <span class="rsl-feature-settings__update-copy" role="status" aria-live="polite" aria-atomic="true">
              <strong id="rsl-feature-settings-update-title" class="content-emphasis text-label-large">Update available</strong>
              <span class="content-default text-body-medium" data-rsl-feature-settings-update-message></span>
            </span>
            <a class="rsl-feature-settings__update-link" data-rsl-feature-settings-update-link>How to update</a>
          </div>
          <div class="rsl-feature-settings__groups"></div>
        </div>
        <div class="rsl-dialog__actions rsl-feature-settings__footer padding-x-xlarge padding-bottom-xlarge flex gap-medium">
          <button type="button" class="rsl-button rsl-button--secondary foundation-web-button relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer flex items-center justify-center stroke-none padding-y-none select-none radius-medium text-label-large height-1200 padding-x-medium bg-action-standard content-action-standard" data-rsl-feature-reset>
            <div aria-hidden="true" data-testid="foundation-web-state-layer" class="absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none"></div>
            <span class="flex items-center min-width-0 gap-small"><span class="padding-y-xsmall text-truncate-end text-no-wrap">Reset defaults</span></span>
          </button>
          <span class="rsl-feature-settings__status" data-rsl-feature-settings-status role="status" aria-live="polite"></span>
          <button type="button" class="rsl-button rsl-button--primary foundation-web-button relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer flex items-center justify-center stroke-none padding-y-none select-none radius-medium text-label-large height-1200 padding-x-medium bg-action-emphasis content-action-emphasis" data-rsl-feature-settings-close>
            <div aria-hidden="true" data-testid="foundation-web-state-layer" class="absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none"></div>
            <span class="flex items-center min-width-0 gap-small"><span class="padding-y-xsmall text-truncate-end text-no-wrap">Done</span></span>
          </button>
        </div>
      </div>
    `;
    dialog.setAttribute("aria-labelledby", "rsl-feature-settings-title");
    dialog.setAttribute("aria-describedby", "rsl-feature-settings-description");

    const updateLink = dialog.querySelector(
      "[data-rsl-feature-settings-update-link]"
    );
    updateLink.href = EXTENSION_UPDATE_HOW_TO_URL;
    updateLink.target = "_blank";
    updateLink.rel = "noopener noreferrer";
    updateLink.referrerPolicy = "no-referrer";

    const groups = dialog.querySelector(".rsl-feature-settings__groups");
    const groupsByName = new Map();
    const createSettingRow = (definition) => {
      const parentKey = definition.parentKey || "";
      const row = document.createElement("label");
      row.className = parentKey
        ? "rsl-feature-settings__row rsl-feature-settings__row--child"
        : "rsl-feature-settings__row";
      const copy = document.createElement("span");
      copy.className = "rsl-feature-settings__copy";
      const label = document.createElement("strong");
      label.className = "content-emphasis text-label-large";
      label.textContent = definition.label;
      const description = document.createElement("span");
      description.className = "content-default text-body-medium";
      description.textContent = definition.description;
      copy.append(label, description);
      const input = document.createElement("input");
      input.type = "checkbox";
      input.className = "rsl-feature-settings__input rsl-sr-only";
      input.setAttribute("data-rsl-feature-key", definition.key);
      if (parentKey) {
        input.setAttribute("data-rsl-feature-parent-key", parentKey);
      }
      input.setAttribute("role", "switch");
      input.disabled =
        !featureSettingsLoaded ||
        Boolean(
          definition.parentKey && !isFeatureEnabled(definition.parentKey)
        );
      input.addEventListener("change", (event) => {
        if (
          event.isTrusted !== true ||
          !featureSettingsLoaded ||
          (parentKey && !isFeatureEnabled(parentKey))
        ) {
          renderFeatureSettingsDialog();
          return;
        }
        const previous = { ...featureSettings };
        const next = { ...featureSettings, [definition.key]: input.checked };
        void saveFeatureSettings(next, previous);
      });
      const visual = document.createElement("span");
      visual.className = "rsl-feature-settings__switch";
      visual.setAttribute("aria-hidden", "true");
      const thumb = document.createElement("span");
      thumb.className = "rsl-feature-settings__switch-thumb";
      visual.append(thumb);
      row.append(copy, input, visual);
      return row;
    };
    for (const definition of FEATURE_DEFINITIONS) {
      let section = groupsByName.get(definition.group);
      if (!section) {
        section = document.createElement("section");
        section.className = "rsl-feature-settings__group";
        const heading = document.createElement("h3");
        heading.className = "rsl-feature-settings__group-title content-default text-label-medium";
        heading.textContent = definition.group;
        const list = document.createElement("div");
        list.className = "rsl-feature-settings__list";
        section.append(heading, list);
        groups.append(section);
        groupsByName.set(definition.group, section);
      }

      const item = document.createElement("div");
      item.className = "rsl-feature-settings__item";
      item.append(createSettingRow(definition));
      if (definition.children?.length) {
        const childrenId = `rsl-feature-settings-${definition.key}-advanced`;
        const disclosure = document.createElement("button");
        disclosure.type = "button";
        disclosure.className = "rsl-feature-settings__disclosure";
        disclosure.setAttribute("data-rsl-feature-disclosure", definition.key);
        disclosure.setAttribute("aria-expanded", "false");
        disclosure.setAttribute("aria-controls", childrenId);
        disclosure.setAttribute(
          "aria-label",
          `Advanced settings for ${definition.label}`
        );
        disclosure.innerHTML =
          '<span>Advanced</span><span class="rsl-feature-settings__disclosure-icon" aria-hidden="true"></span>';
        const children = document.createElement("div");
        children.id = childrenId;
        children.className = "rsl-feature-settings__children";
        children.setAttribute("data-rsl-feature-children", definition.key);
        children.setAttribute("data-rsl-feature-parent-key", definition.key);
        children.setAttribute("role", "group");
        children.setAttribute("aria-label", `${definition.label} advanced settings`);
        children.hidden = true;
        if (definition.key === "sidebarShortcuts") {
          const toolbar = document.createElement("div");
          toolbar.className = "rsl-feature-settings__children-toolbar";
          const toolbarLabel = document.createElement("span");
          toolbarLabel.className = "rsl-feature-settings__children-summary";
          toolbarLabel.textContent = "Sidebar items";
          const actions = document.createElement("span");
          actions.className = "rsl-feature-settings__children-actions";
          for (const [action, labelText, enabled] of [
            ["enable", "Show all", true],
            ["disable", "Hide all", false]
          ]) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "rsl-feature-settings__bulk-action";
            button.textContent = labelText;
            button.setAttribute("data-rsl-feature-bulk", action);
            button.setAttribute("data-rsl-feature-bulk-parent", definition.key);
            button.setAttribute("aria-label", `${labelText} sidebar items`);
            button.addEventListener("click", (event) => {
              if (
                event.isTrusted !== true ||
                !featureSettingsLoaded ||
                !isFeatureEnabled(definition.key)
              ) {
                return;
              }
              const previous = { ...featureSettings };
              const next = { ...featureSettings };
              definition.children.forEach((child) => {
                next[child.key] = enabled;
              });
              void saveFeatureSettings(next, previous);
            });
            actions.append(button);
          }
          toolbar.append(toolbarLabel, actions);
          children.append(toolbar);
        }
        let currentSection = "";
        let currentSectionIndex = 0;
        for (const child of definition.children) {
          if (child.section && child.section !== currentSection) {
            currentSection = child.section;
            const sectionHeading = document.createElement("h4");
            sectionHeading.className = "rsl-feature-settings__children-heading";
            sectionHeading.textContent = currentSection;
            children.append(sectionHeading);
            currentSectionIndex = 0;
          }
          const childDefinition = FEATURE_SETTING_DEFINITIONS.find(
            (candidate) => candidate.key === child.key
          );
          if (childDefinition) {
            const childRow = createSettingRow(childDefinition);
            childRow.setAttribute(
              "data-rsl-feature-section-index",
              String(currentSectionIndex)
            );
            childRow.setAttribute(
              "data-rsl-feature-section-column",
              currentSectionIndex % 2 === 0 ? "left" : "right"
            );
            currentSectionIndex += 1;
            children.append(childRow);
          }
        }
        disclosure.addEventListener("click", () => {
          const expanded = disclosure.getAttribute("aria-expanded") === "true";
          disclosure.setAttribute("aria-expanded", String(!expanded));
          children.hidden = expanded;
        });
        item.append(disclosure, children);
      }
      section.querySelector(".rsl-feature-settings__list").append(item);
    }

    dialog.querySelectorAll("[data-rsl-feature-settings-close]").forEach((button) => {
      button.addEventListener("click", () => dialog.close());
    });
    dialog.querySelector("[data-rsl-feature-reset]")?.addEventListener("click", (event) => {
      if (
        event.isTrusted !== true ||
        !featureSettingsLoaded
      ) {
        return;
      }
      const previous = { ...featureSettings };
      void saveFeatureSettings({ ...DEFAULT_FEATURE_SETTINGS }, previous);
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        dialog.close();
      }
    });
    dialog.addEventListener("close", () => {
      const opener = featureSettingsDialogOpener?.isConnected
        ? featureSettingsDialogOpener
        : document.querySelector(`#${FEATURE_SETTINGS_NAV_ID} button`);
      featureSettingsDialogOpener = null;
      document
        .querySelector(`#${FEATURE_SETTINGS_NAV_ID} button`)
        ?.setAttribute("aria-expanded", "false");
      opener?.focus?.({ preventScroll: true });
      queueMount();
    });
    document.body.append(dialog);
    renderFeatureSettingsDialog();
    return dialog;
  }

  function openFeatureSettingsDialog(opener) {
    let dialog = document.getElementById(FEATURE_SETTINGS_DIALOG_ID);
    if (!dialog) {
      dialog = createFeatureSettingsDialog();
    }
    featureSettingsDialogOpener = opener || document.activeElement;
    renderFeatureSettingsDialog();
    if (!dialog.open) {
      dialog.showModal();
    }
    opener?.setAttribute?.("aria-expanded", "true");
    dialog.querySelector("[data-rsl-feature-key]")?.focus();
    void refreshFeatureSettingsUpdateStatus();
  }

  function normalizeGameEventId(rawValue) {
    const value = typeof rawValue === "string" || typeof rawValue === "number"
      ? String(rawValue).trim()
      : "";
    return /^(?:\d{1,40}|[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(
      value
    )
      ? (/^[0-9a-f-]{36}$/i.test(value) ? value.toLowerCase() : value)
      : null;
  }

  function normalizeGameEventTimestamp(rawValue) {
    if (typeof rawValue === "string" && rawValue.trim()) {
      const parsed = Date.parse(rawValue);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }
    const value = Number(rawValue);
    return Number.isFinite(value) && value > 0 && value < 9e15
      ? Math.round(value)
      : null;
  }

  function normalizeGameEventText(rawValue, fallback = "", maxLength = 180) {
    const value = typeof rawValue === "string"
      ? rawValue.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()
      : "";
    return (value || fallback).slice(0, maxLength);
  }

  function normalizeGameEventFavorite(rawValue) {
    if (!rawValue || typeof rawValue !== "object") return null;
    const universeId = normalizeQuickPlayPlaceId(rawValue.universeId);
    const placeId = normalizeQuickPlayPlaceId(rawValue.placeId);
    if (!universeId || !placeId) return null;
    return Object.freeze({
      universeId,
      placeId,
      name: normalizeGameEventText(rawValue.name, "Roblox experience", 150),
      addedAt: normalizeGameEventTimestamp(rawValue.addedAt) || 0
    });
  }

  function normalizeGameEvent(rawValue, now = Date.now()) {
    if (!rawValue || typeof rawValue !== "object") return null;
    const id = normalizeGameEventId(rawValue.id);
    const universeId = normalizeQuickPlayPlaceId(rawValue.universeId);
    const placeId = normalizeQuickPlayPlaceId(rawValue.placeId);
    const startAt = normalizeGameEventTimestamp(rawValue.startAt ?? rawValue.startUtc);
    const endAt = normalizeGameEventTimestamp(rawValue.endAt ?? rawValue.endUtc);
    if (!id || !universeId || !placeId || !startAt || !endAt || endAt <= startAt) {
      return null;
    }
    const currentTime = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    if (endAt <= currentTime) return null;
    const title = normalizeGameEventText(rawValue.title, "Roblox event", 180);
    const subtitle = normalizeGameEventText(rawValue.subtitle, "", 240);
    const mediaId = normalizeQuickPlayPlaceId(rawValue.mediaId);
    return Object.freeze({
      id,
      universeId,
      placeId,
      gameName: normalizeGameEventText(rawValue.gameName, "Roblox experience", 150),
      title,
      subtitle,
      startAt,
      endAt,
      status: startAt <= currentTime ? "live" : "upcoming",
      eventUrl: `https://www.roblox.com/events/${encodeURIComponent(id)}`,
      mediaId
    });
  }

  function normalizeGameEventsResponse(rawValue, now = Date.now()) {
    if (!rawValue || typeof rawValue !== "object" || rawValue.ok !== true) return null;
    const viewerUserId = normalizeQuickPlayPlaceId(rawValue.viewerUserId);
    if (!viewerUserId || rawValue.enabled === false) return null;
    const favorites = [];
    const seenUniverseIds = new Set();
    for (const rawFavorite of Array.isArray(rawValue.games) ? rawValue.games : []) {
      const favorite = normalizeGameEventFavorite(rawFavorite);
      if (!favorite || seenUniverseIds.has(favorite.universeId)) continue;
      seenUniverseIds.add(favorite.universeId);
      favorites.push(favorite);
      if (favorites.length >= GAME_EVENTS_MAX_FAVORITES) break;
    }
    const events = [];
    const seenEventIds = new Set();
    for (const rawEvent of Array.isArray(rawValue.events) ? rawValue.events : []) {
      const event = normalizeGameEvent(rawEvent, now);
      if (
        !event ||
        !seenUniverseIds.has(event.universeId) ||
        seenEventIds.has(event.id)
      ) continue;
      seenEventIds.add(event.id);
      events.push(event);
    }
    events.sort((left, right) => {
      if (left.status !== right.status) return left.status === "live" ? -1 : 1;
      return left.startAt - right.startAt || left.title.localeCompare(right.title);
    });
    const failures = Array.isArray(rawValue.failures)
      ? rawValue.failures.slice(0, favorites.length)
      : [];
    return Object.freeze({
      viewerUserId,
      favorites,
      events,
      partial: rawValue.partial === true,
      failures,
      usedCachedData: failures.some((failure) => failure?.usedCachedData === true)
    });
  }

  function getGameEventLocalDayOrdinal(timestamp) {
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime())) return null;
    return Math.floor(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000
    );
  }

  function formatGameEventDateGroupLabel(
    timestamp,
    now = Date.now(),
    locale = getRobloxPageLocale()
  ) {
    let displayLocale = "en-US";
    try {
      displayLocale = Intl.getCanonicalLocales(locale)[0] || "en-US";
    } catch {
      // Use the safe fallback.
    }
    const date = new Date(timestamp);
    const dayOrdinal = getGameEventLocalDayOrdinal(timestamp);
    const todayOrdinal = getGameEventLocalDayOrdinal(now);
    if (!Number.isFinite(date.getTime()) || dayOrdinal === null || todayOrdinal === null) {
      return "Unknown date";
    }
    const offset = dayOrdinal - todayOrdinal;
    if (offset === 0 || offset === 1) {
      const relative = new Intl.RelativeTimeFormat(displayLocale, { numeric: "auto" }).format(
        offset,
        "day"
      );
      return relative.charAt(0).toLocaleUpperCase(displayLocale) + relative.slice(1);
    }
    if (offset > 1 && offset <= 6) {
      return new Intl.DateTimeFormat(displayLocale, { weekday: "long" }).format(date);
    }
    return new Intl.DateTimeFormat(displayLocale, {
      year: "numeric",
      month: "long",
      day: "numeric"
    }).format(date);
  }

  function getGameEventStatus(event, now = Date.now()) {
    if (!event || !Number.isFinite(event.startAt) || !Number.isFinite(event.endAt)) {
      return "ended";
    }
    if (event.endAt <= now) return "ended";
    return event.startAt <= now ? "live" : "upcoming";
  }

  function filterGameEvents(
    events,
    status = "all",
    now = Date.now()
  ) {
    const requestedStatus = ["all", "live", "upcoming"].includes(status) ? status : "all";
    return (Array.isArray(events) ? events : []).filter((event) => {
      const currentStatus = getGameEventStatus(event, now);
      if (currentStatus === "ended") return false;
      return requestedStatus === "all" || currentStatus === requestedStatus;
    });
  }

  function compareGameEventTimelineOrder(left, right) {
    return left.startAt - right.startAt ||
      String(left.title || "").localeCompare(String(right.title || "")) ||
      String(left.id || "").localeCompare(String(right.id || ""));
  }

  function groupGameEventsByDate(
    events,
    now = Date.now(),
    locale = getRobloxPageLocale()
  ) {
    const groups = [];
    const groupsByKey = new Map();
    const sorted = [...(Array.isArray(events) ? events : [])]
      .sort(compareGameEventTimelineOrder);
    for (const event of sorted) {
      const live = getGameEventStatus(event, now) === "live";
      const dayOrdinal = getGameEventLocalDayOrdinal(event.startAt);
      const key = live ? "live" : String(dayOrdinal ?? "unknown");
      let group = groupsByKey.get(key);
      if (!group) {
        group = {
          key,
          dayOrdinal,
          label: live
            ? "Live Now"
            : formatGameEventDateGroupLabel(event.startAt, now, locale),
          events: []
        };
        groupsByKey.set(key, group);
        groups.push(group);
      }
      group.events.push(event);
    }
    groups.sort((left, right) => {
      if (left.key === "live") return -1;
      if (right.key === "live") return 1;
      return (left.dayOrdinal ?? Number.MAX_SAFE_INTEGER) -
        (right.dayOrdinal ?? Number.MAX_SAFE_INTEGER);
    });
    return groups;
  }

  function formatGameEventCountdown(milliseconds) {
    const elapsed = Math.max(0, milliseconds);
    if (elapsed < 60_000) return "<1m";
    const minutes = Math.ceil(elapsed / 60_000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours < 48) return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    return `${Math.ceil(hours / 24)}d`;
  }

  function formatGameEventTiming(
    event,
    now = Date.now(),
    locale = getRobloxPageLocale()
  ) {
    const start = new Date(event?.startAt);
    const end = new Date(event?.endAt);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      return Object.freeze({ status: "unknown", text: "Time unavailable", fullText: "Time unavailable" });
    }
    const timeFormatter = new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit"
    });
    const shortDateFormatter = new Intl.DateTimeFormat(locale, {
      ...(end.getFullYear() !== new Date(now).getFullYear() ? { year: "numeric" } : {}),
      month: "short",
      day: "numeric"
    });
    const status = getGameEventStatus(event, now);
    const endsToday = getGameEventLocalDayOrdinal(end) === getGameEventLocalDayOrdinal(now);
    const range = status === "live"
      ? `Ends ${endsToday ? timeFormatter.format(end) : shortDateFormatter.format(end)}`
      : status === "upcoming"
        ? `Starts ${timeFormatter.format(start)}`
        : `Ended ${shortDateFormatter.format(end)}`;
    const countdown = status === "live"
      ? `${formatGameEventCountdown(event.endAt - now)} left`
      : status === "upcoming"
        ? `Starts in ${formatGameEventCountdown(event.startAt - now)}`
        : "Ended";
    const text = status === "upcoming"
      ? countdown
      : status === "live"
        ? `${range} · ${countdown}`
        : range;
    const fullText = status === "live"
      ? `Live now. Started ${start.toLocaleString(locale)} and ends ${end.toLocaleString(locale)}.`
      : status === "upcoming"
        ? `Starts ${start.toLocaleString(locale)} and ends ${end.toLocaleString(locale)}.`
        : `Ended ${end.toLocaleString(locale)}.`;
    return Object.freeze({ status, range, countdown, text, fullText });
  }

  function sendGameEventsRuntimeMessage(message) {
    if (typeof gameEventsMessageSenderForTests === "function") {
      return Promise.resolve().then(() => gameEventsMessageSenderForTests(message));
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        const error = new Error("Game Events request timed out");
        error.code = "TIMEOUT";
        reject(error);
      }, GAME_EVENTS_REQUEST_TIMEOUT_MS);
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        callback(value);
      };
      try {
        chrome.runtime.sendMessage(message, (response) => {
          const runtimeError = chrome.runtime.lastError;
          if (runtimeError) finish(reject, new Error(runtimeError.message));
          else finish(resolve, response);
        });
      } catch (error) {
        finish(reject, error);
      }
    });
  }

  function getGameEventsErrorText(code) {
    switch (String(code || "").toUpperCase()) {
      case "UNAUTHENTICATED":
      case "AUTH":
        return "Sign in to Roblox to view Game Events.";
      case "DISABLED":
        return "Game Events is currently disabled in RoTool Settings.";
      case "ACCOUNT_CHANGED":
        return "Your Roblox account changed. Close and reopen Game Events.";
      case "RATE_LIMITED":
        return "Roblox is limiting event requests. Try again in a moment.";
      default:
        return "Game Events could not be loaded. Try again.";
    }
  }

  function requestGameEventThumbnail(image, event, epoch) {
    if (!image || !event?.universeId) return;
    const key = event.mediaId ? `event:${event.mediaId}` : `game:${event.universeId}`;
    const cachedUrl = gameEventsThumbnailByUniverseId.get(key);
    const frame = image.closest(".rsl-owned-thumbnail-frame");
    if (isSafeThumbnailImageUrl(cachedUrl)) {
      image.src = cachedUrl;
      setOwnedThumbnailState(frame, "loaded");
      return;
    }
    setOwnedThumbnailState(frame, "loading");
    let request = gameEventsThumbnailRequestByUniverseId.get(key);
    if (!request) {
      const requestOne = (kind, id) => new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage(
            { type: "rsl:get-thumbnail", kind, id },
            (response) => {
              if (chrome.runtime.lastError || !isSafeThumbnailImageUrl(response?.url)) {
                resolve(null);
              } else {
                resolve(response.url);
              }
            }
          );
        } catch {
          resolve(null);
        }
      });
      request = (async () => {
        const eventUrl = event.mediaId
          ? await requestOne("eventAsset", event.mediaId)
          : null;
        const url = eventUrl || await requestOne("gameUniverse", event.universeId);
        if (url) gameEventsThumbnailByUniverseId.set(key, url);
        return url;
      })().finally(() => gameEventsThumbnailRequestByUniverseId.delete(key));
      gameEventsThumbnailRequestByUniverseId.set(key, request);
    }
    void request.then((url) => {
      if (
        epoch !== gameEventsLifecycleEpoch ||
        !image.isConnected ||
        !document.getElementById(GAME_EVENTS_DIALOG_ID)?.open
      ) return;
      if (url) image.src = url;
      setOwnedThumbnailState(frame, url ? "loaded" : "fallback");
    });
  }

  function observeGameEventThumbnail(image, event, epoch) {
    if (!image || !event) return;
    if (typeof IntersectionObserver !== "function") {
      requestGameEventThumbnail(image, event, epoch);
      return;
    }
    if (!gameEventsThumbnailObserver) {
      gameEventsThumbnailObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            observer.unobserve(entry.target);
            const targetEvent = entry.target._rslGameEventThumbnailEvent;
            const targetEpoch = entry.target._rslGameEventThumbnailEpoch;
            delete entry.target._rslGameEventThumbnailEvent;
            delete entry.target._rslGameEventThumbnailEpoch;
            requestGameEventThumbnail(entry.target, targetEvent, targetEpoch);
          });
        },
        { rootMargin: "160px 0px" }
      );
    }
    image._rslGameEventThumbnailEvent = event;
    image._rslGameEventThumbnailEpoch = epoch;
    gameEventsThumbnailObserver.observe(image);
  }

  function getGameEventTimelineGap(
    previousTimestamp,
    currentTimestamp,
    maxGap = 144
  ) {
    const previous = Number(previousTimestamp);
    const current = Number(currentTimestamp);
    const safeMax = Math.max(0, Math.min(240, Number(maxGap) || 0));
    if (!Number.isFinite(previous) || !Number.isFinite(current) || current <= previous) {
      return 0;
    }
    const hours = (current - previous) / 3_600_000;
    return Math.min(safeMax, Math.round(18 * Math.log2(1 + hours)));
  }

  function getGameEventTimelineGapBefore(previousEvent, event, now = Date.now()) {
    if (!event || getGameEventStatus(event, now) === "ended") return 0;
    const origin = previousEvent?.startAt ?? now;
    return getGameEventTimelineGap(origin, event.startAt);
  }

  function getGameEventTimelineTailSpace(events, now = Date.now()) {
    const visible = (Array.isArray(events) ? events : [])
      .filter((event) => (
        Number.isFinite(event?.startAt) &&
        getGameEventStatus(event, now) !== "ended"
      ))
      .sort(compareGameEventTimelineOrder);
    if (visible.length === 0 || visible.some((event) => event.startAt > now)) return 36;
    const last = visible[visible.length - 1];
    return Math.max(36, Math.min(168,
      24 + getGameEventTimelineGap(last.startAt, now)
    ));
  }

  function formatGameEventAgendaMarker(
    event,
    now = Date.now(),
    locale = getRobloxPageLocale()
  ) {
    const start = new Date(event?.startAt);
    if (!Number.isFinite(start.getTime())) return "--:--";
    if (
      getGameEventStatus(event, now) === "live" &&
      getGameEventLocalDayOrdinal(event.startAt) !== getGameEventLocalDayOrdinal(now)
    ) {
      return new Intl.DateTimeFormat(locale, {
        ...(start.getFullYear() !== new Date(now).getFullYear()
          ? { year: "numeric" }
          : {}),
        month: "short",
        day: "numeric"
      }).format(start);
    }
    return new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit"
    }).format(start);
  }

  function getGameEventsTimelineNowPosition(
    events,
    now = Date.now()
  ) {
    const ordered = (Array.isArray(events) ? events : [])
      .filter((event) => (
        Number.isFinite(event?.startAt) &&
        event?.id &&
        getGameEventStatus(event, now) !== "ended"
      ))
      .sort(compareGameEventTimelineOrder);
    const clusters = [];
    ordered.forEach((event) => {
      const cluster = clusters.at(-1);
      if (cluster?.startAt === event.startAt) {
        cluster.last = event;
      } else {
        clusters.push({ startAt: event.startAt, first: event, last: event });
      }
    });
    if (clusters.length === 0) return Object.freeze({ visible: false });
    const nextIndex = clusters.findIndex((cluster) => cluster.startAt > now);
    if (nextIndex < 0) {
      const previous = clusters[clusters.length - 1].last;
      return Object.freeze({
        visible: true,
        beforeEventId: previous.id,
        afterEventId: null,
        progress: 1,
        nextEventId: null,
        nextInMs: 0
      });
    }
    const previousIndex = nextIndex - 1;
    const nextCluster = clusters[nextIndex];
    const next = nextCluster.first;
    if (previousIndex < 0) {
      return Object.freeze({
        visible: true,
        beforeEventId: null,
        afterEventId: next.id,
        progress: 0,
        nextEventId: next.id,
        nextInMs: Math.max(0, next.startAt - now)
      });
    }
    const previousCluster = clusters[previousIndex];
    const previous = previousCluster.last;
    let progress = 0;
    if (nextCluster.startAt > previousCluster.startAt) {
      progress = Math.max(0, Math.min(1,
        (now - previousCluster.startAt) /
          (nextCluster.startAt - previousCluster.startAt)
      ));
    }
    return Object.freeze({
      visible: true,
      beforeEventId: previous.id,
      afterEventId: next.id,
      progress,
      nextEventId: next.id,
      nextInMs: Math.max(0, next.startAt - now)
    });
  }

  function renderGameEventItem(
    event,
    now = Date.now(),
    { gapBefore = 0, groupLabel = "", groupHeadingId = "", variant = "timeline" } = {}
  ) {
    const livePanel = variant === "live-panel";
    const item = document.createElement("li");
    item.className = livePanel
      ? "rsl-game-events__live-item"
      : "rsl-game-events__item";
    item.setAttribute(
      livePanel ? "data-rsl-game-events-live-event-id" : "data-rsl-game-event-id",
      event.id
    );
    if (!livePanel) {
      item.style.setProperty(
        "--rsl-game-events-gap-before",
        `${Math.max(0, Math.min(144, Number(gapBefore) || 0))}px`
      );
    }
    const status = getGameEventStatus(event, now);
    item.classList.add(livePanel
      ? "rsl-game-events__live-item--active"
      : `rsl-game-events__item--${status}`);

    if (!livePanel && groupLabel) {
      const heading = document.createElement("h3");
      heading.className = "rsl-game-events__date-heading";
      if (status === "live") heading.classList.add("rsl-game-events__date-heading--live");
      heading.id = groupHeadingId;
      const headingLabel = document.createElement("span");
      headingLabel.className = "rsl-game-events__date-heading-label";
      headingLabel.textContent = groupLabel;
      heading.append(headingLabel);
      item.append(heading);
    }

    const row = document.createElement("div");
    row.className = "rsl-game-events__event-row";
    if (livePanel) row.classList.add("rsl-game-events__event-row--live-panel");

    let timeRail = null;
    if (!livePanel) {
      timeRail = document.createElement("div");
      timeRail.className = "rsl-game-events__time-rail";
      const marker = document.createElement("time");
      marker.className = "rsl-game-events__time-marker";
      marker.dateTime = new Date(event.startAt).toISOString();
      marker.textContent = formatGameEventAgendaMarker(
        event,
        now,
        getRobloxPageLocale()
      );
      marker.setAttribute("aria-hidden", "true");
      const markerDot = document.createElement("span");
      markerDot.className = "rsl-game-events__time-dot";
      markerDot.setAttribute("aria-hidden", "true");
      timeRail.append(marker, markerDot);
    }

    const thumbnail = document.createElement("span");
    thumbnail.className = "rsl-game-events__thumbnail rsl-owned-thumbnail-frame";
    thumbnail.dataset.rslThumbnailState = "fallback";
    thumbnail.setAttribute("aria-hidden", "true");
    const image = document.createElement("img");
    image.alt = "";
    image.decoding = "async";
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    thumbnail.append(image);

    const main = document.createElement("div");
    main.className = "rsl-game-events__main";
    const titleRow = document.createElement("div");
    titleRow.className = "rsl-game-events__title-row";
    const title = document.createElement("span");
    title.className = "rsl-game-events__title";
    title.textContent = event.title;
    title.title = event.subtitle ? `${event.title}\n${event.subtitle}` : event.title;
    titleRow.append(title);
    const context = document.createElement("div");
    context.className = "rsl-game-events__context";
    context.textContent = event.gameName;
    context.title = context.textContent;
    const accessibleSubtitle = document.createElement("span");
    accessibleSubtitle.className = "rsl-sr-only";
    accessibleSubtitle.textContent = event.subtitle
      ? `Event details: ${event.subtitle}`
      : "";
    const timing = document.createElement("time");
    timing.className = "rsl-game-events__timing";
    timing.dateTime = new Date(status === "live" ? event.endAt : event.startAt).toISOString();
    timing.setAttribute("data-rsl-game-events-timing", event.id);
    timing.setAttribute("aria-hidden", "true");
    const timingValue = formatGameEventTiming(event, now);
    timing.textContent = timingValue.text;
    timing.title = timingValue.fullText;
    const accessibleTiming = document.createElement("span");
    accessibleTiming.className = "rsl-sr-only";
    accessibleTiming.setAttribute("data-rsl-game-events-accessible-timing", event.id);
    accessibleTiming.textContent = timingValue.fullText;
    main.append(titleRow, context, accessibleSubtitle, accessibleTiming);
    if (!livePanel && status === "upcoming" && isFeatureEnabled("joinScheduler")) {
      const schedule = document.createElement("button");
      schedule.type = "button";
      schedule.className =
        "rsl-button rsl-button--secondary rsl-game-events__schedule";
      schedule.textContent = "Schedule";
      schedule.setAttribute(GAME_EVENTS_SCHEDULE_ATTRIBUTE, event.id);
      schedule.setAttribute(
        "aria-label",
        `Schedule ${event.title} in Join Scheduler`
      );
      schedule.setAttribute("aria-haspopup", "dialog");
      schedule.title = `Schedule ${event.title} in Join Scheduler`;
      schedule.addEventListener("click", (clickEvent) => {
        if (clickEvent.isTrusted !== true) return;
        void openJoinScheduler(
          {
            universeId: event.universeId,
            placeId: event.placeId,
            gameName: event.gameName,
            title: event.title,
            startAt: event.startAt,
            endAt: event.endAt,
            eventId: event.id
          },
          schedule
        );
      });
      main.append(schedule);
    }

    const actions = document.createElement("div");
    actions.className = "rsl-game-events__actions";
    actions.setAttribute(GAME_EVENTS_LAUNCH_SURFACE_ATTRIBUTE, "");

    const join = document.createElement("button");
    join.type = "button";
    join.className = "rsl-button rsl-button--primary rsl-game-events__join";
    join.textContent = "Join Game";
    join.setAttribute(QUICK_PLAY_ACTION_ATTRIBUTE, "play");
    join.setAttribute(QUICK_PLAY_PLACE_ID_ATTRIBUTE, event.placeId);
    join.setAttribute("data-rsl-game-events-join", event.id);
    join.dataset.rslGameEventsDefaultLabel = `Join Game: ${event.gameName}`;
    join.setAttribute("aria-label", join.dataset.rslGameEventsDefaultLabel);
    join.title = join.dataset.rslGameEventsDefaultLabel;

    const link = document.createElement("a");
    link.className = "rsl-button rsl-button--secondary rsl-game-events__view";
    link.href = event.eventUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "View Event";
    link.setAttribute("data-rsl-game-events-view", event.id);
    link.setAttribute("aria-label", `View Event: ${event.title}`);
    link.title = `View Event: ${event.title}`;
    link.addEventListener("click", (clickEvent) => {
      if (clickEvent.isTrusted !== true) clickEvent.preventDefault();
    });
    actions.append(join, link);

    if (livePanel) row.append(thumbnail, main, timing, actions);
    else row.append(timeRail, thumbnail, main, timing, actions);
    item.append(row);
    observeGameEventThumbnail(image, event, gameEventsLifecycleEpoch);
    return item;
  }

  function renderGameEventsFilters(dialog) {
    dialog.querySelectorAll("[data-rsl-game-events-status-filter]").forEach((button) => {
      const selected = button.getAttribute("data-rsl-game-events-status-filter") ===
        gameEventsStatusFilter;
      button.setAttribute("aria-pressed", String(selected));
      button.classList.toggle("rsl-game-events__chip--selected", selected);
    });
  }

  function normalizeGameEventSearchResult(rawValue) {
    if (!rawValue || typeof rawValue !== "object") return null;
    const universeId = normalizeQuickPlayPlaceId(rawValue.universeId);
    const placeId = normalizeQuickPlayPlaceId(rawValue.placeId);
    const name = normalizeGameEventText(rawValue.name, "", 150);
    if (!universeId || !name) return null;
    const playerCountValue = Number(rawValue.playerCount);
    return Object.freeze({
      universeId,
      placeId,
      name,
      creatorName: normalizeGameEventText(rawValue.creatorName, "", 100),
      playerCount: Number.isSafeInteger(playerCountValue) && playerCountValue >= 0
        ? playerCountValue
        : null
    });
  }

  function isGameEventsSearchableQuery(rawValue) {
    const query = normalizeGameEventText(rawValue, "", 300);
    return query.length >= 2 && query.length <= 100 &&
      !/^\d+$/.test(query) &&
      !/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(query);
  }

  function clearGameEventsSearch(invalidate = true) {
    if (gameEventsSearchTimer !== null) {
      window.clearTimeout(gameEventsSearchTimer);
      gameEventsSearchTimer = null;
    }
    if (invalidate) gameEventsSearchSequence += 1;
    gameEventsSearchState = "idle";
    gameEventsSearchErrorCode = "";
    gameEventsSearchResults = [];
    gameEventsSearchActiveIndex = -1;
    gameEventsSelectedSearchResult = null;
  }

  function renderGameEventsSearch(dialog) {
    if (!dialog) return;
    const input = dialog.querySelector("[data-rsl-game-events-add-input]");
    const list = dialog.querySelector("[data-rsl-game-events-search-results]");
    const status = dialog.querySelector("[data-rsl-game-events-search-status]");
    if (!input || !list || !status) return;
    list.querySelectorAll("img").forEach((image) => {
      gameEventsThumbnailObserver?.unobserve?.(image);
    });
    list.replaceChildren();
    let statusText = "";
    if (gameEventsSearchState === "loading") {
      statusText = "Searching Roblox experiences…";
    } else if (gameEventsSearchState === "error") {
      statusText = gameEventsSearchErrorCode === "ACCOUNT_CHANGED"
        ? getGameEventsErrorText("ACCOUNT_CHANGED")
        : "Suggestions are unavailable. You can still use a game link or ID.";
    } else if (gameEventsSearchState === "ready" && gameEventsSearchResults.length === 0) {
      statusText = "No matching experiences found. You can still use a game link or ID.";
    }
    status.textContent = statusText;
    gameEventsSearchResults.forEach((result, index) => {
      const option = document.createElement("li");
      option.className = "rsl-game-events__search-result";
      option.setAttribute("role", "presentation");
      option.id = `rsl-game-events-search-option-${index}`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "rsl-game-events__search-option";
      button.setAttribute("role", "option");
      button.id = `rsl-game-events-search-choice-${index}`;
      button.setAttribute("aria-selected", String(index === gameEventsSearchActiveIndex));
      button.setAttribute("data-rsl-game-events-search-option", String(index));
      const thumbnail = document.createElement("span");
      thumbnail.className = "rsl-game-events__search-thumbnail rsl-owned-thumbnail-frame";
      thumbnail.dataset.rslThumbnailState = "fallback";
      thumbnail.setAttribute("aria-hidden", "true");
      const image = document.createElement("img");
      image.alt = "";
      image.decoding = "async";
      image.loading = "lazy";
      image.referrerPolicy = "no-referrer";
      thumbnail.append(image);
      const copy = document.createElement("span");
      copy.className = "rsl-game-events__search-copy";
      const name = document.createElement("strong");
      name.textContent = result.name;
      const detail = document.createElement("span");
      const parts = [];
      if (result.creatorName) parts.push(`By ${result.creatorName}`);
      if (result.playerCount !== null) {
        parts.push(`${new Intl.NumberFormat(getRobloxPageLocale()).format(result.playerCount)} playing`);
      }
      detail.textContent = parts.join(" · ") || "Roblox experience";
      copy.append(name, detail);
      button.append(thumbnail, copy);
      option.append(button);
      list.append(option);
      observeGameEventThumbnail(image, result, gameEventsLifecycleEpoch);
    });
    const expanded = gameEventsAddPanelOpen &&
      (gameEventsSearchState !== "idle" || gameEventsSearchResults.length > 0);
    list.hidden = !expanded || gameEventsSearchResults.length === 0;
    status.hidden = !expanded || !statusText;
    input.setAttribute("aria-expanded", String(expanded && gameEventsSearchResults.length > 0));
    if (gameEventsSearchActiveIndex >= 0 && gameEventsSearchResults[gameEventsSearchActiveIndex]) {
      input.setAttribute("aria-activedescendant", `rsl-game-events-search-choice-${gameEventsSearchActiveIndex}`);
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }

  async function searchGameEventFavorites(query, sequence, epoch) {
    const requestId = ++gameEventsRequestSequence;
    const viewerUserId = gameEventsViewerUserId;
    try {
      const response = await sendGameEventsRuntimeMessage({
        type: GAME_EVENTS_SEARCH_MESSAGE_TYPE,
        requestId,
        query,
        ...(viewerUserId ? { viewerUserId } : {}),
        locale: getRobloxPageLocale()
      });
      const dialog = document.getElementById(GAME_EVENTS_DIALOG_ID);
      const input = dialog?.querySelector?.("[data-rsl-game-events-add-input]");
      if (
        epoch !== gameEventsLifecycleEpoch ||
        sequence !== gameEventsSearchSequence ||
        !dialog?.open ||
        !gameEventsAddPanelOpen ||
        normalizeGameEventText(input?.value, "", 300) !== query ||
        response?.requestId !== requestId
      ) return false;
      if (response?.ok !== true) {
        const error = new Error("Game Events search failed");
        error.code = response?.code || "INVALID";
        throw error;
      }
      const responseViewer = normalizeQuickPlayPlaceId(response.viewerUserId);
      if (!responseViewer || (viewerUserId && responseViewer !== viewerUserId)) {
        const error = new Error("Game Events account changed");
        error.code = "ACCOUNT_CHANGED";
        throw error;
      }
      gameEventsViewerUserId = responseViewer;
      const seen = new Set();
      gameEventsSearchResults = (Array.isArray(response.results) ? response.results : [])
        .map(normalizeGameEventSearchResult)
        .filter((result) => {
          if (!result || seen.has(result.universeId)) return false;
          seen.add(result.universeId);
          return true;
        })
        .slice(0, 8);
      gameEventsSearchState = "ready";
      gameEventsSearchErrorCode = "";
      gameEventsSearchActiveIndex = gameEventsSearchResults.length ? 0 : -1;
      renderGameEventsSearch(dialog);
      return true;
    } catch (error) {
      if (epoch !== gameEventsLifecycleEpoch || sequence !== gameEventsSearchSequence) {
        return false;
      }
      gameEventsSearchResults = [];
      gameEventsSearchActiveIndex = -1;
      gameEventsSearchState = "error";
      gameEventsSearchErrorCode = String(error?.code || "NETWORK").toUpperCase();
      if (gameEventsSearchErrorCode === "ACCOUNT_CHANGED") {
        gameEventsFavorites = [];
        gameEventsItems = [];
        gameEventsViewerUserId = null;
        gameEventsPartial = false;
        gameEventsLoadState = "error";
        gameEventsErrorCode = "ACCOUNT_CHANGED";
      }
      if (gameEventsSearchErrorCode === "ACCOUNT_CHANGED") {
        renderGameEventsDialog();
      } else {
        renderGameEventsSearch(document.getElementById(GAME_EVENTS_DIALOG_ID));
      }
      return false;
    }
  }

  function queueGameEventsSearch(rawValue) {
    const query = normalizeGameEventText(rawValue, "", 300);
    clearGameEventsSearch();
    const dialog = document.getElementById(GAME_EVENTS_DIALOG_ID);
    if (!dialog?.open || !gameEventsAddPanelOpen || !isGameEventsSearchableQuery(query)) {
      renderGameEventsSearch(dialog);
      return false;
    }
    const sequence = gameEventsSearchSequence;
    const epoch = gameEventsLifecycleEpoch;
    gameEventsSearchState = "loading";
    renderGameEventsSearch(dialog);
    gameEventsSearchTimer = window.setTimeout(() => {
      gameEventsSearchTimer = null;
      void searchGameEventFavorites(query, sequence, epoch);
    }, GAME_EVENTS_SEARCH_DEBOUNCE_MS);
    return true;
  }

  function selectGameEventsSearchResult(index, dialog) {
    const result = gameEventsSearchResults[Number(index)];
    const input = dialog?.querySelector?.("[data-rsl-game-events-add-input]");
    if (!result || !input) return false;
    gameEventsSelectedSearchResult = result;
    input.value = result.name;
    if (gameEventsSearchTimer !== null) window.clearTimeout(gameEventsSearchTimer);
    gameEventsSearchTimer = null;
    gameEventsSearchSequence += 1;
    gameEventsSearchState = "idle";
    gameEventsSearchResults = [];
    gameEventsSearchActiveIndex = -1;
    renderGameEventsSearch(dialog);
    input.focus({ preventScroll: true });
    return true;
  }

  function renderGameEventsFavorites(dialog) {
    const panel = dialog.querySelector("[data-rsl-game-events-manage-panel]");
    const addPanel = dialog.querySelector("[data-rsl-game-events-add-panel]");
    if (panel) panel.hidden = !gameEventsManagePanelOpen;
    if (addPanel) addPanel.hidden = !gameEventsAddPanelOpen;
    dialog.querySelector("[data-rsl-game-events-add-toggle]")?.setAttribute(
      "aria-expanded",
      String(gameEventsAddPanelOpen)
    );
    dialog.querySelector("[data-rsl-game-events-manage-toggle]")?.setAttribute(
      "aria-expanded",
      String(gameEventsManagePanelOpen)
    );
    renderGameEventsSearch(dialog);
    const list = dialog.querySelector("[data-rsl-game-events-favorites]");
    if (!list) return;
    const focusedRemoveUniverseId = document.activeElement?.getAttribute?.(
      "data-rsl-game-events-remove"
    );
    const previousScrollTop = list.scrollTop;
    list.replaceChildren();
    if (gameEventsFavorites.length === 0) {
      const empty = document.createElement("li");
      empty.className = "rsl-game-events__favorite-empty";
      empty.textContent = "No tracked games yet.";
      list.append(empty);
    } else {
      gameEventsFavorites.forEach((favorite) => {
        const item = document.createElement("li");
        item.className = "rsl-game-events__favorite";
        const name = document.createElement("span");
        name.textContent = favorite.name;
        name.title = favorite.name;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "rsl-button rsl-button--secondary rsl-game-events__remove";
        remove.textContent = gameEventsPendingAction === `remove:${favorite.universeId}`
          ? "Removing…"
          : "Remove";
        remove.disabled = gameEventsPendingAction !== null || gameEventsLoadState === "loading";
        remove.setAttribute("data-rsl-game-events-remove", favorite.universeId);
        remove.setAttribute("aria-label", `Remove ${favorite.name} from tracked games`);
        item.append(name, remove);
        list.append(item);
      });
    }
    list.scrollTop = previousScrollTop;
    if (focusedRemoveUniverseId && dialog.open && gameEventsManagePanelOpen) {
      list.querySelector(
        `[data-rsl-game-events-remove="${CSS.escape(focusedRemoveUniverseId)}"]`
      )?.focus?.({ preventScroll: true });
    }
    const input = dialog.querySelector("[data-rsl-game-events-add-input]");
    const submit = dialog.querySelector("[data-rsl-game-events-add-submit]");
    if (input) {
      input.disabled = gameEventsPendingAction !== null || gameEventsLoadState === "loading";
    }
    if (submit) {
      submit.disabled = gameEventsPendingAction !== null ||
        gameEventsLoadState === "loading" ||
        gameEventsFavorites.length >= GAME_EVENTS_MAX_FAVORITES;
      submit.textContent = gameEventsPendingAction === "add" ? "Adding…" : "Track Game";
    }
  }

  function renderGameEventsLiveSection(events, now = Date.now()) {
    const section = document.createElement("section");
    section.className = "rsl-game-events__live-section";
    section.setAttribute("aria-labelledby", "rsl-game-events-live-heading");
    section.classList.toggle(
      "rsl-game-events__live-section--collapsed",
      gameEventsLiveSectionCollapsed
    );
    const headingRow = document.createElement("div");
    headingRow.className = "rsl-game-events__section-heading";
    const heading = document.createElement("h3");
    heading.id = "rsl-game-events-live-heading";
    heading.textContent = "Live Now";
    const count = document.createElement("span");
    count.className = "rsl-game-events__live-count";
    count.textContent = `${events.length} active`;
    count.setAttribute(
      "aria-label",
      `${events.length} active ${events.length === 1 ? "event" : "events"}`
    );
    headingRow.append(heading, count);
    if (events.length > 0) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "rsl-game-events__live-toggle";
      toggle.textContent = gameEventsLiveSectionCollapsed ? "Show" : "Hide";
      toggle.setAttribute("data-rsl-game-events-live-toggle", "");
      toggle.setAttribute("aria-controls", "rsl-game-events-live-list");
      toggle.setAttribute("aria-expanded", String(!gameEventsLiveSectionCollapsed));
      toggle.setAttribute(
        "aria-label",
        gameEventsLiveSectionCollapsed ? "Show active events" : "Hide active events"
      );
      headingRow.append(toggle);
    }
    section.append(headingRow);
    if (events.length === 0) {
      const empty = document.createElement("p");
      empty.className = "rsl-game-events__section-empty";
      empty.textContent = "No events are live right now.";
      section.append(empty);
      return section;
    }
    const liveList = document.createElement("ul");
    liveList.id = "rsl-game-events-live-list";
    liveList.className = "rsl-game-events__live-list";
    liveList.setAttribute("data-rsl-game-events-live-list", "");
    liveList.setAttribute("aria-labelledby", heading.id);
    liveList.hidden = gameEventsLiveSectionCollapsed;
    [...events].sort(compareGameEventTimelineOrder).forEach((event) => {
      liveList.append(renderGameEventItem(event, now, { variant: "live-panel" }));
    });
    section.append(liveList);
    return section;
  }

  function syncGameEventsLiveSectionCollapse(dialog) {
    const targetDialog = dialog || document.getElementById(GAME_EVENTS_DIALOG_ID);
    const section = targetDialog?.querySelector?.(".rsl-game-events__live-section");
    const liveList = section?.querySelector?.("[data-rsl-game-events-live-list]");
    const toggle = section?.querySelector?.("[data-rsl-game-events-live-toggle]");
    if (!section || !liveList || !toggle) return false;
    section.classList.toggle(
      "rsl-game-events__live-section--collapsed",
      gameEventsLiveSectionCollapsed
    );
    liveList.hidden = gameEventsLiveSectionCollapsed;
    toggle.textContent = gameEventsLiveSectionCollapsed ? "Show" : "Hide";
    toggle.setAttribute("aria-expanded", String(!gameEventsLiveSectionCollapsed));
    toggle.setAttribute(
      "aria-label",
      gameEventsLiveSectionCollapsed ? "Show active events" : "Hide active events"
    );
    return true;
  }

  function renderGameEventsTimelineSection(events, now = Date.now()) {
    const section = document.createElement("section");
    section.className = "rsl-game-events__timeline-section";
    section.setAttribute("aria-labelledby", "rsl-game-events-timeline-heading");
    const heading = document.createElement("h3");
    heading.id = "rsl-game-events-timeline-heading";
    heading.className = "rsl-game-events__timeline-heading";
    heading.textContent = "Upcoming";
    section.append(heading);
    if (events.length === 0) {
      const empty = document.createElement("p");
      empty.className = "rsl-game-events__section-empty";
      empty.textContent = "No upcoming events are scheduled.";
      section.append(empty);
      return section;
    }
    const timeline = document.createElement("ol");
    timeline.className = "rsl-game-events__timeline";
    timeline.setAttribute("data-rsl-game-events-timeline", "");
    timeline.setAttribute("aria-labelledby", heading.id);
    timeline.style.setProperty(
      "--rsl-game-events-tail-space",
      `${getGameEventTimelineTailSpace(events, now)}px`
    );
    let previousEvent = null;
    groupGameEventsByDate(
      events,
      now,
      getRobloxPageLocale()
    ).forEach((group) => {
      group.events.forEach((event, index) => {
        timeline.append(renderGameEventItem(event, now, {
          gapBefore: getGameEventTimelineGapBefore(previousEvent, event, now),
          groupLabel: index === 0 ? group.label : "",
          groupHeadingId: index === 0 ? `rsl-game-events-date-${group.key}` : ""
        }));
        previousEvent = event;
      });
    });
    const nowMarker = document.createElement("li");
    nowMarker.className = "rsl-game-events__now-marker";
    nowMarker.setAttribute("data-rsl-game-events-now-marker", "");
    nowMarker.setAttribute("role", "presentation");
    nowMarker.setAttribute("aria-hidden", "true");
    nowMarker.hidden = true;
    const nowDot = document.createElement("span");
    nowDot.className = "rsl-game-events__now-dot";
    const nowLabel = document.createElement("span");
    nowLabel.className = "rsl-game-events__now-label";
    nowLabel.setAttribute("data-rsl-game-events-now-label", "");
    nowLabel.textContent = "NOW";
    nowMarker.append(nowDot, nowLabel);
    timeline.append(nowMarker);
    section.append(timeline);
    return section;
  }

  function renderGameEventsDialog() {
    const dialog = document.getElementById(GAME_EVENTS_DIALOG_ID);
    if (!dialog) return;
    const list = dialog.querySelector("[data-rsl-game-events-list]");
    const liveStatus = dialog.querySelector("[data-rsl-game-events-live-status]");
    if (!list || !liveStatus) return;
    const focusedEventAction = document.activeElement?.hasAttribute?.("data-rsl-game-events-join")
      ? "join"
      : document.activeElement?.hasAttribute?.("data-rsl-game-events-view")
        ? "view"
        : null;
    const focusedEventId = focusedEventAction
      ? document.activeElement.getAttribute(`data-rsl-game-events-${focusedEventAction}`)
      : null;
    const scrollTop = list.scrollTop;
    gameEventsThumbnailObserver?.disconnect();
    gameEventsThumbnailObserver = null;
    renderGameEventsFilters(dialog);
    renderGameEventsFavorites(dialog);
    liveStatus.classList.toggle("rsl-game-events__live-status--error", gameEventsLoadState === "error");
    if (gameEventsLoadState === "loading") {
      liveStatus.textContent = gameEventsItems.length ? "Refreshing events…" : "Loading events…";
    } else if (gameEventsLoadState === "error") {
      liveStatus.textContent = getGameEventsErrorText(gameEventsErrorCode);
    } else if (gameEventsNotice) {
      liveStatus.textContent = gameEventsNotice;
    } else if (gameEventsPartial) {
      liveStatus.textContent =
        "Some tracked games could not be refreshed. Available events are shown.";
    } else {
      liveStatus.textContent = "";
    }

    list.replaceChildren();
    if (gameEventsLoadState === "loading" && gameEventsItems.length === 0) {
      const loading = document.createElement("div");
      loading.className = "rsl-game-events__empty";
      loading.textContent = "Loading official Roblox events…";
      list.append(loading);
    } else if (gameEventsLoadState === "error" && gameEventsItems.length === 0) {
      const error = document.createElement("div");
      error.className = "rsl-game-events__empty rsl-game-events__empty--error";
      error.textContent = getGameEventsErrorText(gameEventsErrorCode);
      list.append(error);
    } else if (gameEventsFavorites.length === 0) {
      const empty = document.createElement("div");
      empty.className = "rsl-game-events__empty";
      const heading = document.createElement("strong");
      heading.textContent = "No tracked games yet";
      const detail = document.createElement("span");
      detail.textContent = "Add a game to see its official live and upcoming events here.";
      empty.append(heading, detail);
      list.append(empty);
    } else {
      const now = Date.now();
      const filtered = filterGameEvents(
        gameEventsItems,
        gameEventsStatusFilter,
        now
      );
      if (filtered.length === 0) {
        const empty = document.createElement("div");
        empty.className = "rsl-game-events__empty";
        const heading = document.createElement("strong");
        const detail = document.createElement("span");
        if (gameEventsItems.length === 0) {
          heading.textContent = "No live or upcoming events";
          detail.textContent =
            "Your tracked games have not published any official Roblox events right now.";
        } else {
          heading.textContent = gameEventsStatusFilter === "live"
            ? "No live events"
            : gameEventsStatusFilter === "upcoming"
              ? "No upcoming events"
              : "No events available";
          detail.textContent = "Try another status filter.";
        }
        empty.append(heading, detail);
        list.append(empty);
      } else {
        const feed = document.createElement("div");
        feed.className = "rsl-game-events__feed";
        const liveEvents = filterGameEvents(gameEventsItems, "live", now);
        const upcomingEvents = filterGameEvents(gameEventsItems, "upcoming", now);
        if (gameEventsStatusFilter !== "upcoming") {
          feed.append(renderGameEventsLiveSection(liveEvents, now));
        }
        if (gameEventsStatusFilter !== "live") {
          feed.append(renderGameEventsTimelineSection(upcomingEvents, now));
        }
        list.append(feed);
      }
    }
    list.setAttribute("aria-busy", String(gameEventsLoadState === "loading"));
    list.scrollTop = scrollTop;
    dialog.querySelectorAll("[data-rsl-game-events-refresh]").forEach((button) => {
      button.disabled = gameEventsLoadState === "loading" || gameEventsPendingAction !== null;
    });
    if (focusedEventAction && focusedEventId && dialog.open) {
      list.querySelector(
        `[data-rsl-game-events-${focusedEventAction}="${CSS.escape(focusedEventId)}"]`
      )?.focus?.({ preventScroll: true });
    }
    window.requestAnimationFrame?.(() => {
      if (dialog.open) refreshGameEventsTimelineNowMarker(dialog);
    });
  }

  function refreshGameEventsTimelineNowMarker(dialog, now = Date.now()) {
    const targetDialog = dialog || document.getElementById(GAME_EVENTS_DIALOG_ID);
    const list = targetDialog?.querySelector?.("[data-rsl-game-events-list]");
    const timeline = list?.querySelector?.("[data-rsl-game-events-timeline]");
    const marker = timeline?.querySelector?.("[data-rsl-game-events-now-marker]");
    if (!list || !timeline || !marker) return Object.freeze({ visible: false });
    const visibleEvents = [...timeline.querySelectorAll("[data-rsl-game-event-id]")]
      .map((item) => gameEventsItems.find(
        (event) => event.id === item.getAttribute("data-rsl-game-event-id")
      ))
      .filter(Boolean);
    const model = getGameEventsTimelineNowPosition(
      visibleEvents,
      now
    );
    if (!model.visible) {
      marker.hidden = true;
      marker.removeAttribute("data-rsl-game-events-now-positioned");
      return model;
    }
    timeline.style.setProperty(
      "--rsl-game-events-tail-space",
      `${getGameEventTimelineTailSpace(visibleEvents, now)}px`
    );
    const beforeDot = model.beforeEventId
      ? timeline.querySelector(
        `[data-rsl-game-event-id="${CSS.escape(model.beforeEventId)}"] .rsl-game-events__time-dot`
      )
      : null;
    const afterDot = model.afterEventId
      ? timeline.querySelector(
        `[data-rsl-game-event-id="${CSS.escape(model.afterEventId)}"] .rsl-game-events__time-dot`
      )
      : null;
    if ((model.beforeEventId && !beforeDot) || (model.afterEventId && !afterDot)) {
      marker.hidden = true;
      marker.removeAttribute("data-rsl-game-events-now-positioned");
      return Object.freeze({ visible: false });
    }
    const timelineRect = timeline.getBoundingClientRect();
    const dotY = (dot) => {
      const rect = dot.getBoundingClientRect();
      return rect.top + rect.height / 2 - timelineRect.top;
    };
    const beforeY = beforeDot ? dotY(beforeDot) : 12;
    const previousEvent = model.beforeEventId
      ? visibleEvents.find((event) => event.id === model.beforeEventId)
      : null;
    const nextEvent = model.afterEventId
      ? visibleEvents.find((event) => event.id === model.afterEventId)
      : null;
    let y;
    if (!beforeDot && afterDot) {
      y = Math.max(12,
        dotY(afterDot) - Math.max(18,
          12 + getGameEventTimelineGap(now, nextEvent?.startAt)
        )
      );
    } else if (beforeDot && !afterDot) {
      y = beforeY + Math.max(18,
        12 + getGameEventTimelineGap(previousEvent?.startAt, now)
      );
    } else {
      const afterY = dotY(afterDot);
      const progress = Math.max(0, Math.min(1, Number(model.progress) || 0));
      y = beforeY + (afterY - beforeY) * progress;
    }
    const firstPlacement = marker.hidden ||
      marker.getAttribute("data-rsl-game-events-now-positioned") !== "true";
    marker.style.setProperty("--rsl-game-events-now-y", `${Math.round(y * 10) / 10}px`);
    marker.hidden = false;
    if (firstPlacement) {
      marker.getBoundingClientRect();
      marker.setAttribute("data-rsl-game-events-now-positioned", "true");
    }
    return Object.freeze({ ...model, y });
  }

  function clearGameEventsTimers() {
    if (gameEventsMinuteTimer !== null) {
      window.clearTimeout(gameEventsMinuteTimer);
      gameEventsMinuteTimer = null;
    }
    if (gameEventsBoundaryTimer !== null) {
      window.clearTimeout(gameEventsBoundaryTimer);
      gameEventsBoundaryTimer = null;
    }
    gameEventsResizeObserver?.disconnect?.();
    gameEventsResizeObserver = null;
    window.removeEventListener("resize", refreshGameEventsTimelineAfterResize);
  }

  function refreshGameEventsTimelineAfterResize() {
    const dialog = document.getElementById(GAME_EVENTS_DIALOG_ID);
    if (!dialog?.open) return;
    window.requestAnimationFrame?.(() => {
      if (dialog.open) refreshGameEventsTimelineNowMarker(dialog);
    });
  }

  function observeGameEventsTimelineResize() {
    const dialog = document.getElementById(GAME_EVENTS_DIALOG_ID);
    const list = dialog?.querySelector?.("[data-rsl-game-events-list]");
    gameEventsResizeObserver?.disconnect?.();
    gameEventsResizeObserver = null;
    window.removeEventListener("resize", refreshGameEventsTimelineAfterResize);
    if (!dialog?.open || !list) return;
    if (typeof ResizeObserver === "function") {
      gameEventsResizeObserver = new ResizeObserver(refreshGameEventsTimelineAfterResize);
      gameEventsResizeObserver.observe(list);
    } else {
      window.addEventListener("resize", refreshGameEventsTimelineAfterResize, {
        passive: true
      });
    }
  }

  function refreshGameEventTimes() {
    const dialog = document.getElementById(GAME_EVENTS_DIALOG_ID);
    if (!dialog?.open) return;
    const now = Date.now();
    const byId = new Map(gameEventsItems.map((event) => [event.id, event]));
    dialog.querySelectorAll("[data-rsl-game-events-timing]").forEach((node) => {
      const id = node.getAttribute("data-rsl-game-events-timing");
      const event = byId.get(id);
      if (!event) return;
      const timing = formatGameEventTiming(event, now);
      node.textContent = timing.text;
      node.title = timing.fullText;
      dialog.querySelector(
        `[data-rsl-game-events-accessible-timing="${CSS.escape(id)}"]`
      )?.replaceChildren(document.createTextNode(timing.fullText));
    });
    refreshGameEventsTimelineNowMarker(dialog, now);
  }

  function scheduleGameEventsMinuteRefresh() {
    if (gameEventsMinuteTimer !== null) window.clearTimeout(gameEventsMinuteTimer);
    if (!document.getElementById(GAME_EVENTS_DIALOG_ID)?.open) return;
    const delay = Math.max(250, 60_000 - (Date.now() % 60_000) + 50);
    gameEventsMinuteTimer = window.setTimeout(() => {
      gameEventsMinuteTimer = null;
      if (!document.getElementById(GAME_EVENTS_DIALOG_ID)?.open) return;
      refreshGameEventTimes();
      scheduleGameEventsMinuteRefresh();
    }, delay);
  }

  function scheduleGameEventsBoundaryRefresh() {
    if (gameEventsBoundaryTimer !== null) window.clearTimeout(gameEventsBoundaryTimer);
    if (!document.getElementById(GAME_EVENTS_DIALOG_ID)?.open) return;
    const now = Date.now();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const boundaries = [nextMidnight.getTime()];
    gameEventsItems.forEach((event) => {
      if (event.startAt > now) boundaries.push(event.startAt);
      if (event.endAt > now) boundaries.push(event.endAt);
    });
    const nextBoundary = Math.min(...boundaries);
    const delay = Math.min(2_147_000_000, Math.max(250, nextBoundary - now + 100));
    gameEventsBoundaryTimer = window.setTimeout(() => {
      gameEventsBoundaryTimer = null;
      if (!document.getElementById(GAME_EVENTS_DIALOG_ID)?.open) return;
      gameEventsItems = gameEventsItems.filter((event) => event.endAt > Date.now());
      renderGameEventsDialog();
      scheduleGameEventsBoundaryRefresh();
    }, delay);
  }

  async function loadGameEvents(forceRefresh = false) {
    if (!isFeatureEnabled("gameEvents") || gameEventsPendingAction !== null) return false;
    const dialog = document.getElementById(GAME_EVENTS_DIALOG_ID);
    if (!dialog?.open) return false;
    const epoch = gameEventsLifecycleEpoch;
    const requestId = ++gameEventsRequestSequence;
    const expectedViewerUserId = gameEventsViewerUserId;
    const hadSnapshot = gameEventsFavorites.length > 0 || gameEventsItems.length > 0;
    gameEventsLoadState = "loading";
    gameEventsErrorCode = "";
    gameEventsNotice = "";
    renderGameEventsDialog();
    try {
      const response = await sendGameEventsRuntimeMessage({
        type: GAME_EVENTS_GET_MESSAGE_TYPE,
        requestId,
        ...(expectedViewerUserId ? { viewerUserId: expectedViewerUserId } : {}),
        locale: getRobloxPageLocale(),
        forceRefresh: forceRefresh === true
      });
      if (
        epoch !== gameEventsLifecycleEpoch ||
        !document.getElementById(GAME_EVENTS_DIALOG_ID)?.open ||
        response?.requestId !== requestId
      ) return false;
      if (response?.ok !== true) {
        const error = new Error("Game Events request failed");
        error.code = response?.code || "INVALID";
        throw error;
      }
      const normalized = normalizeGameEventsResponse(response);
      if (
        !normalized ||
        (expectedViewerUserId && normalized.viewerUserId !== expectedViewerUserId)
      ) {
        const error = new Error("Game Events account changed");
        error.code = expectedViewerUserId ? "ACCOUNT_CHANGED" : "INVALID";
        throw error;
      }
      gameEventsViewerUserId = normalized.viewerUserId;
      gameEventsFavorites = normalized.favorites;
      gameEventsItems = normalized.events;
      gameEventsPartial = normalized.partial;
      gameEventsLoadState = "ready";
      renderGameEventsDialog();
      scheduleGameEventsBoundaryRefresh();
      return true;
    } catch (error) {
      if (epoch !== gameEventsLifecycleEpoch) return false;
      gameEventsErrorCode = error?.code || "NETWORK";
      if (gameEventsErrorCode === "ACCOUNT_CHANGED") {
        gameEventsFavorites = [];
        gameEventsItems = [];
        gameEventsViewerUserId = null;
        gameEventsPartial = false;
        gameEventsLoadState = "error";
      } else if (hadSnapshot) {
        gameEventsLoadState = "ready";
        gameEventsPartial = true;
        gameEventsNotice = "Roblox could not refresh events. Showing the previous results.";
      } else {
        gameEventsLoadState = "error";
      }
      renderGameEventsDialog();
      return false;
    }
  }

  function validateGameEventsActionResponse(response, requestId, viewerUserId) {
    if (response?.requestId !== requestId || response?.ok !== true) {
      const error = new Error("Game Events action failed");
      error.code = response?.code || "INVALID";
      throw error;
    }
    const responseViewer = normalizeQuickPlayPlaceId(response.viewerUserId);
    if (!responseViewer || (viewerUserId && responseViewer !== viewerUserId)) {
      const error = new Error("Game Events account changed");
      error.code = "ACCOUNT_CHANGED";
      throw error;
    }
    return responseViewer;
  }

  async function addGameEventFavorite(inputValue, selectedUniverseId = null) {
    const input = normalizeGameEventText(inputValue, "", 300);
    if (
      !input ||
      gameEventsPendingAction !== null ||
      gameEventsLoadState === "loading" ||
      gameEventsFavorites.length >= GAME_EVENTS_MAX_FAVORITES ||
      !document.getElementById(GAME_EVENTS_DIALOG_ID)?.open
    ) return false;
    const epoch = gameEventsLifecycleEpoch;
    const requestId = ++gameEventsRequestSequence;
    const viewerUserId = gameEventsViewerUserId;
    gameEventsPendingAction = "add";
    gameEventsNotice = "";
    renderGameEventsDialog();
    let added = false;
    let accountChanged = false;
    try {
      const response = await sendGameEventsRuntimeMessage({
        type: GAME_EVENTS_ADD_MESSAGE_TYPE,
        requestId,
        ...(viewerUserId ? { viewerUserId } : {}),
        locale: getRobloxPageLocale(),
        input,
        ...(normalizeQuickPlayPlaceId(selectedUniverseId)
          ? { universeId: normalizeQuickPlayPlaceId(selectedUniverseId) }
          : {})
      });
      if (epoch !== gameEventsLifecycleEpoch) return false;
      gameEventsViewerUserId = validateGameEventsActionResponse(
        response,
        requestId,
        viewerUserId
      );
      const favorite = normalizeGameEventFavorite(response.game);
      if (!favorite) {
        const error = new Error("Invalid tracked game");
        error.code = "INVALID";
        throw error;
      }
      if (!gameEventsFavorites.some((game) => game.universeId === favorite.universeId)) {
        gameEventsFavorites = [...gameEventsFavorites, favorite];
      }
      const inputNode = document.querySelector("[data-rsl-game-events-add-input]");
      if (inputNode) inputNode.value = "";
      clearGameEventsSearch();
      gameEventsNotice = response.alreadyTracked
        ? `${favorite.name} is already tracked.`
        : `${favorite.name} was added.`;
      added = true;
      return true;
    } catch (error) {
      if (epoch !== gameEventsLifecycleEpoch) return false;
      const code = String(error?.code || "NETWORK").toUpperCase();
      if (code === "ACCOUNT_CHANGED") {
        accountChanged = true;
        gameEventsFavorites = [];
        gameEventsItems = [];
        gameEventsViewerUserId = null;
        gameEventsPartial = false;
        gameEventsLoadState = "error";
        gameEventsErrorCode = "ACCOUNT_CHANGED";
      }
      gameEventsNotice = code === "NOT_FOUND"
        ? "That game could not be found. Try its Roblox URL or ID."
        : code === "LIMIT_REACHED"
          ? `You can track up to ${GAME_EVENTS_MAX_FAVORITES} games.`
          : code === "ACCOUNT_CHANGED"
            ? getGameEventsErrorText(code)
            : "That game could not be added. Try again.";
      return false;
    } finally {
      if (epoch === gameEventsLifecycleEpoch) {
        gameEventsPendingAction = null;
        renderGameEventsDialog();
        if (!accountChanged && added && gameEventsFavorites.length > 0) {
          void loadGameEvents(true);
        }
      }
    }
  }

  async function removeGameEventFavorite(universeIdValue) {
    const universeId = normalizeQuickPlayPlaceId(universeIdValue);
    const favoriteIndex = gameEventsFavorites.findIndex(
      (game) => game.universeId === universeId
    );
    const favorite = favoriteIndex >= 0 ? gameEventsFavorites[favoriteIndex] : null;
    if (
      !favorite ||
      gameEventsPendingAction !== null ||
      gameEventsLoadState === "loading" ||
      !document.getElementById(GAME_EVENTS_DIALOG_ID)?.open
    ) return false;
    const epoch = gameEventsLifecycleEpoch;
    const requestId = ++gameEventsRequestSequence;
    const viewerUserId = gameEventsViewerUserId;
    gameEventsPendingAction = `remove:${universeId}`;
    gameEventsNotice = "";
    renderGameEventsDialog();
    let accountChanged = false;
    let removed = false;
    try {
      const response = await sendGameEventsRuntimeMessage({
        type: GAME_EVENTS_REMOVE_MESSAGE_TYPE,
        requestId,
        ...(viewerUserId ? { viewerUserId } : {}),
        locale: getRobloxPageLocale(),
        universeId
      });
      if (epoch !== gameEventsLifecycleEpoch) return false;
      gameEventsViewerUserId = validateGameEventsActionResponse(
        response,
        requestId,
        viewerUserId
      );
      gameEventsFavorites = gameEventsFavorites.filter(
        (game) => game.universeId !== universeId
      );
      gameEventsItems = gameEventsItems.filter((event) => event.universeId !== universeId);
      gameEventsNotice = `${favorite.name} was removed.`;
      removed = true;
      scheduleGameEventsBoundaryRefresh();
      return true;
    } catch (error) {
      if (epoch !== gameEventsLifecycleEpoch) return false;
      const code = String(error?.code || "").toUpperCase();
      if (code === "ACCOUNT_CHANGED") {
        accountChanged = true;
        gameEventsFavorites = [];
        gameEventsItems = [];
        gameEventsViewerUserId = null;
        gameEventsPartial = false;
        gameEventsLoadState = "error";
        gameEventsErrorCode = "ACCOUNT_CHANGED";
      }
      gameEventsNotice = code === "ACCOUNT_CHANGED"
        ? getGameEventsErrorText("ACCOUNT_CHANGED")
        : "That game could not be removed. Try again.";
      return false;
    } finally {
      if (epoch === gameEventsLifecycleEpoch) {
        gameEventsPendingAction = null;
        if (accountChanged) gameEventsManagePanelOpen = false;
        renderGameEventsDialog();
        if (!accountChanged && document.getElementById(GAME_EVENTS_DIALOG_ID)?.open) {
          const focusUniverseId = removed
            ? gameEventsFavorites[favoriteIndex]?.universeId ||
              gameEventsFavorites[favoriteIndex - 1]?.universeId ||
              null
            : universeId;
          const focusTarget = focusUniverseId
            ? document.querySelector(
                `[data-rsl-game-events-remove="${CSS.escape(focusUniverseId)}"]`
              )
            : document.querySelector("[data-rsl-game-events-manage-toggle]");
          focusTarget?.focus?.({ preventScroll: true });
        }
      }
    }
  }

  function resetGameEventsDialogState() {
    clearGameEventsTimers();
    gameEventsThumbnailObserver?.disconnect();
    gameEventsThumbnailObserver = null;
    gameEventsLifecycleEpoch += 1;
    gameEventsLoadState = "idle";
    gameEventsErrorCode = "";
    gameEventsFavorites = [];
    gameEventsItems = [];
    gameEventsViewerUserId = null;
    gameEventsPartial = false;
    gameEventsStatusFilter = "all";
    gameEventsLiveSectionCollapsed = false;
    gameEventsAddPanelOpen = false;
    gameEventsManagePanelOpen = false;
    gameEventsPendingAction = null;
    gameEventsNotice = "";
    clearGameEventsSearch();
  }

  function closeGameEventsDialog(restoreFocus = true) {
    const dialog = document.getElementById(GAME_EVENTS_DIALOG_ID);
    if (dialog?.open) {
      dialog.dataset.rslRestoreGameEventsFocus = restoreFocus ? "true" : "false";
      dialog.close();
      return;
    }
    const opener = gameEventsDialogOpener;
    gameEventsDialogOpener = null;
    resetGameEventsDialogState();
    if (restoreFocus && opener?.isConnected) opener.focus({ preventScroll: true });
  }

  function createGameEventsDialog() {
    const dialog = document.createElement("dialog");
    dialog.id = GAME_EVENTS_DIALOG_ID;
    dialog.className =
      "rsl-dialog rsl-game-events-dialog foundation-web-dialog-overlay " +
      "padding-medium foundation-web-portal-zindex bg-common-backdrop";
    dialog.setAttribute("aria-labelledby", "rsl-game-events-title");
    dialog.innerHTML = `
      <div class="rsl-dialog__surface rsl-game-events__surface relative radius-large bg-surface-100 stroke-muted stroke-standard foundation-web-dialog-content shadow-transient-high" data-size="Large">
        <div class="rsl-dialog__close-container absolute foundation-web-dialog-close-container">
          <button type="button" class="rsl-icon-button foundation-web-close-affordance" aria-label="Close Game Events" data-rsl-game-events-close><span aria-hidden="true" class="rsl-dialog__close-icon"></span></button>
        </div>
        <div class="rsl-dialog__body rsl-game-events__body">
          <header class="rsl-game-events__header">
            <div class="rsl-game-events__heading-row">
              <h2 id="rsl-game-events-title" class="content-emphasis text-title-large">Game Events</h2>
              <div class="rsl-game-events__heading-actions">
                <button type="button" class="rsl-button rsl-button--secondary" aria-expanded="false" aria-controls="rsl-game-events-add-panel" data-rsl-game-events-add-toggle>Add Game</button>
                <button type="button" class="rsl-button rsl-button--secondary" data-rsl-game-events-refresh>Refresh</button>
              </div>
            </div>
            <div class="rsl-game-events__live-status content-default text-body-medium" role="status" aria-live="polite" aria-atomic="true" data-rsl-game-events-live-status></div>
          </header>
          <section id="rsl-game-events-add-panel" class="rsl-game-events__panel" data-rsl-game-events-add-panel hidden>
            <form class="rsl-game-events__add-form" data-rsl-game-events-add-form>
              <label for="rsl-game-events-add-input">Add a game</label>
              <div class="rsl-game-events__add-row">
                <div class="rsl-game-events__search-box">
                  <input id="rsl-game-events-add-input" class="rsl-input" type="text" maxlength="300" autocomplete="off" spellcheck="false" required placeholder="Search games or paste a URL or ID" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="rsl-game-events-search-results" aria-describedby="rsl-game-events-add-help rsl-game-events-search-status" data-rsl-game-events-add-input>
                  <ul id="rsl-game-events-search-results" class="rsl-game-events__search-results" role="listbox" aria-label="Matching Roblox experiences" data-rsl-game-events-search-results hidden></ul>
                </div>
                <button type="submit" class="rsl-button rsl-button--primary" data-rsl-game-events-add-submit>Track Game</button>
              </div>
              <span id="rsl-game-events-add-help">Use a Roblox game URL, Place or Universe ID, or its name.</span>
              <span id="rsl-game-events-search-status" class="rsl-game-events__search-status" role="status" aria-live="polite" data-rsl-game-events-search-status hidden></span>
            </form>
          </section>
          <section id="rsl-game-events-manage-panel" class="rsl-game-events__panel" aria-labelledby="rsl-game-events-manage-heading" tabindex="-1" data-rsl-game-events-manage-panel hidden>
            <div class="rsl-game-events__manage-heading"><strong id="rsl-game-events-manage-heading">Tracked games</strong><span>Stored locally for this Roblox account</span></div>
            <ul class="rsl-game-events__favorites" data-rsl-game-events-favorites></ul>
          </section>
          <nav class="rsl-game-events__filters" aria-label="Filter game events">
            <div class="rsl-game-events__status-filters" role="group" aria-label="Event status">
              <button type="button" class="rsl-game-events__chip" data-rsl-game-events-status-filter="all" aria-pressed="true">All</button>
              <button type="button" class="rsl-game-events__chip" data-rsl-game-events-status-filter="live" aria-pressed="false">Live</button>
              <button type="button" class="rsl-game-events__chip" data-rsl-game-events-status-filter="upcoming" aria-pressed="false">Upcoming</button>
            </div>
          </nav>
          <div class="rsl-game-events__list" role="region" aria-label="Official game events" tabindex="0" data-rsl-game-events-list></div>
        </div>
        <footer class="rsl-dialog__actions rsl-game-events__footer">
          <button type="button" class="rsl-button rsl-button--secondary rsl-game-events__manage-button" aria-expanded="false" aria-controls="rsl-game-events-manage-panel" data-rsl-game-events-manage-toggle>Manage Tracked Games</button>
        </footer>
      </div>`;
    dialog.querySelectorAll("[data-rsl-game-events-close]").forEach((button) => {
      button.addEventListener("click", () => closeGameEventsDialog(true));
    });
    dialog.querySelector("[data-rsl-game-events-refresh]")?.addEventListener("click", (event) => {
      if (event.isTrusted !== true) return;
      void loadGameEvents(true);
    });
    dialog.querySelector("[data-rsl-game-events-add-toggle]")?.addEventListener(
      "click",
      (event) => {
        if (event.isTrusted !== true) return;
        gameEventsAddPanelOpen = !gameEventsAddPanelOpen;
        if (gameEventsAddPanelOpen) gameEventsManagePanelOpen = false;
        if (!gameEventsAddPanelOpen) clearGameEventsSearch();
        renderGameEventsFavorites(dialog);
        if (gameEventsAddPanelOpen) {
          dialog.querySelector("[data-rsl-game-events-add-input]")?.focus();
        }
      }
    );
    dialog.querySelector("[data-rsl-game-events-manage-toggle]")?.addEventListener(
      "click",
      (event) => {
        if (event.isTrusted !== true) return;
        gameEventsManagePanelOpen = !gameEventsManagePanelOpen;
        if (gameEventsManagePanelOpen) {
          gameEventsAddPanelOpen = false;
          clearGameEventsSearch();
        }
        renderGameEventsFavorites(dialog);
        if (gameEventsManagePanelOpen) {
          dialog.querySelector("[data-rsl-game-events-manage-panel]")
            ?.focus?.({ preventScroll: true });
        }
      }
    );
    dialog.querySelector("[data-rsl-game-events-list]")?.addEventListener(
      "click",
      (event) => {
        const toggle = event.target.closest?.("[data-rsl-game-events-live-toggle]");
        if (!toggle || event.isTrusted !== true) return;
        gameEventsLiveSectionCollapsed = !gameEventsLiveSectionCollapsed;
        syncGameEventsLiveSectionCollapse(dialog);
      }
    );
    dialog.querySelector("[data-rsl-game-events-add-form]")?.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();
        if (event.isTrusted !== true) return;
        const input = dialog.querySelector("[data-rsl-game-events-add-input]");
        if (!input?.value.trim()) {
          input?.setCustomValidity?.("Enter a Roblox game URL, ID, or name.");
          input?.reportValidity?.();
          input?.focus?.();
          return;
        }
        input.setCustomValidity?.("");
        void addGameEventFavorite(
          input?.value || "",
          gameEventsSelectedSearchResult?.universeId || null
        );
      }
    );
    dialog.querySelector("[data-rsl-game-events-add-input]")?.addEventListener(
      "input",
      (event) => {
        event.currentTarget?.setCustomValidity?.("");
        gameEventsSelectedSearchResult = null;
        queueGameEventsSearch(event.currentTarget?.value || "");
      }
    );
    dialog.querySelector("[data-rsl-game-events-add-input]")?.addEventListener(
      "keydown",
      (event) => {
        if (!gameEventsSearchResults.length) return;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const delta = event.key === "ArrowDown" ? 1 : -1;
          gameEventsSearchActiveIndex =
            (gameEventsSearchActiveIndex + delta + gameEventsSearchResults.length) %
            gameEventsSearchResults.length;
          renderGameEventsSearch(dialog);
          return;
        }
        if (event.key === "Home" || event.key === "End") {
          event.preventDefault();
          gameEventsSearchActiveIndex = event.key === "Home"
            ? 0
            : gameEventsSearchResults.length - 1;
          renderGameEventsSearch(dialog);
          return;
        }
        if (event.key === "Enter" && gameEventsSearchActiveIndex >= 0) {
          event.preventDefault();
          selectGameEventsSearchResult(gameEventsSearchActiveIndex, dialog);
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          clearGameEventsSearch();
          renderGameEventsSearch(dialog);
          return;
        }
        if (event.key === "Tab") {
          clearGameEventsSearch();
          renderGameEventsSearch(dialog);
        }
      }
    );
    dialog.querySelector("[data-rsl-game-events-search-results]")?.addEventListener(
      "click",
      (event) => {
        const option = event.target.closest?.("[data-rsl-game-events-search-option]");
        if (!option || event.isTrusted !== true) return;
        selectGameEventsSearchResult(
          option.getAttribute("data-rsl-game-events-search-option"),
          dialog
        );
      }
    );
    dialog.querySelector("[data-rsl-game-events-status-filter='all']")
      ?.parentElement?.addEventListener("click", (event) => {
        const button = event.target.closest?.("[data-rsl-game-events-status-filter]");
        if (!button || event.isTrusted !== true) return;
        gameEventsStatusFilter = button.getAttribute("data-rsl-game-events-status-filter");
        const list = dialog.querySelector("[data-rsl-game-events-list]");
        if (list) list.scrollTop = 0;
        renderGameEventsDialog();
      });
    dialog.querySelector("[data-rsl-game-events-favorites]")?.addEventListener(
      "click",
      (event) => {
        const button = event.target.closest?.("[data-rsl-game-events-remove]");
        if (!button || event.isTrusted !== true) return;
        void removeGameEventFavorite(button.getAttribute("data-rsl-game-events-remove"));
      }
    );
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeGameEventsDialog(true);
    });
    dialog.addEventListener("close", () => {
      const restoreFocus = dialog.dataset.rslRestoreGameEventsFocus !== "false";
      delete dialog.dataset.rslRestoreGameEventsFocus;
      const opener = gameEventsDialogOpener;
      gameEventsDialogOpener = null;
      resetGameEventsDialogState();
      if (restoreFocus && opener?.isConnected) opener.focus({ preventScroll: true });
      queueMount();
    });
    document.body.append(dialog);
    renderGameEventsDialog();
    return dialog;
  }

  function openGameEventsDialog(opener = null) {
    if (!isFeatureEnabled("gameEvents")) return null;
    let dialog = document.getElementById(GAME_EVENTS_DIALOG_ID);
    if (!dialog) dialog = createGameEventsDialog();
    if (dialog.open) {
      dialog.querySelector("[data-rsl-game-events-close]")?.focus();
      return dialog;
    }
    resetGameEventsDialogState();
    gameEventsDialogOpener = opener || document.activeElement;
    gameEventsLoadState = "loading";
    renderGameEventsDialog();
    dialog.showModal();
    scheduleGameEventsMinuteRefresh();
    scheduleGameEventsBoundaryRefresh();
    observeGameEventsTimelineResize();
    dialog.querySelector("[data-rsl-game-events-add-toggle]")?.focus();
    void loadGameEvents(false);
    return dialog;
  }

  function cleanupGameEventsFeature() {
    document.getElementById(GAME_EVENTS_ROW_ID)?.remove();
    closeGameEventsDialog(false);
    const dialog = document.getElementById(GAME_EVENTS_DIALOG_ID);
    if (dialog && !dialog.open) dialog.remove();
  }

  function normalizeServerHistoryOpaqueId(rawValue) {
    const value = typeof rawValue === "string" ? rawValue : "";
    return value === value.trim() && /^[A-Za-z0-9_-]{1,128}$/.test(value)
      ? value
      : null;
  }

  function normalizeServerHistoryTimestamp(rawValue) {
    const value = Number(rawValue);
    return Number.isFinite(value) && value > 0 && value < 9e15
      ? Math.round(value)
      : null;
  }

  function getRobloxPageLocale() {
    const rawLocale = typeof document !== "undefined" &&
      typeof document.documentElement?.lang === "string"
      ? document.documentElement.lang.trim().replace(/_/g, "-")
      : "";
    if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3}$/.test(rawLocale)) {
      return "en-US";
    }
    try {
      return Intl.getCanonicalLocales(rawLocale)[0] || "en-US";
    } catch {
      return "en-US";
    }
  }

  function normalizeServerHistorySession(rawValue) {
    if (!rawValue || typeof rawValue !== "object") return null;
    const sessionId = normalizeServerHistoryOpaqueId(rawValue.sessionId);
    const placeId = normalizeQuickPlayPlaceId(rawValue.placeId);
    const universeId = normalizeQuickPlayPlaceId(rawValue.universeId);
    const firstSeenAt = normalizeServerHistoryTimestamp(rawValue.firstSeenAt);
    const lastSeenAt = normalizeServerHistoryTimestamp(rawValue.lastSeenAt);
    if (!sessionId || !placeId || !firstSeenAt || !lastSeenAt) return null;
    const responseName = typeof rawValue.experienceName === "string"
      ? rawValue.experienceName
      : rawValue.name;
    const rawName = typeof responseName === "string"
      ? responseName.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()
      : "";
    return Object.freeze({
      sessionId,
      placeId,
      universeId,
      name: (rawName || "Roblox experience").slice(0, 150),
      firstSeenAt: Math.min(firstSeenAt, lastSeenAt),
      lastSeenAt: Math.max(firstSeenAt, lastSeenAt)
    });
  }

  function normalizeServerHistoryResponse(rawValue) {
    if (!rawValue || typeof rawValue !== "object" || rawValue.ok !== true) {
      return null;
    }
    const sessions = [];
    const seenIds = new Set();
    for (const rawSession of Array.isArray(rawValue.sessions) ? rawValue.sessions : []) {
      const session = normalizeServerHistorySession(rawSession);
      if (!session || seenIds.has(session.sessionId)) continue;
      seenIds.add(session.sessionId);
      sessions.push(session);
      if (sessions.length >= SERVER_HISTORY_LIMIT) break;
    }
    sessions.sort((left, right) => right.lastSeenAt - left.lastSeenAt);
    return Object.freeze({
      enabled: rawValue.enabled !== false,
      sessions
    });
  }

  function formatServerHistoryTimestamp(timestamp) {
    const date = new Date(timestamp);
    return Number.isFinite(date.getTime())
      ? date.toLocaleString(getRobloxPageLocale())
      : "Unknown";
  }

  function formatServerHistoryDuration(firstSeenAt, lastSeenAt) {
    const elapsed = Math.max(0, lastSeenAt - firstSeenAt);
    if (elapsed < 60_000) return "under 1 minute";
    const minutes = Math.round(elapsed / 60_000);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder
      ? `${hours}h ${remainder}m`
      : `${hours} hour${hours === 1 ? "" : "s"}`;
  }

  function formatServerHistoryCompactTimestamp(timestamp, timeOnly = false) {
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime())) return "Unknown";
    return timeOnly
      ? date.toLocaleTimeString(getRobloxPageLocale(), {
          hour: "2-digit",
          minute: "2-digit"
        })
      : date.toLocaleString(getRobloxPageLocale(), {
          year: "2-digit",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        });
  }

  function formatServerHistoryCompactDuration(firstSeenAt, lastSeenAt) {
    const elapsed = Math.max(0, lastSeenAt - firstSeenAt);
    if (elapsed < 60_000) return "<1m";
    const minutes = Math.round(elapsed / 60_000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
  }

  function formatServerHistoryRelativeLastSeen(
    timestamp,
    now = Date.now(),
    locale = getRobloxPageLocale()
  ) {
    const observedAt = new Date(timestamp).getTime();
    const currentTime = new Date(now).getTime();
    if (!Number.isFinite(observedAt) || !Number.isFinite(currentTime)) {
      return "Unknown";
    }
    const elapsed = Math.max(0, currentTime - observedAt);
    if (elapsed < 60_000) {
      try {
        return new Intl.RelativeTimeFormat(locale, {
          numeric: "auto",
          style: "narrow"
        }).format(0, "second");
      } catch {
        return "now";
      }
    }
    const [unit, unitMilliseconds, fallbackSuffix] = elapsed < 3_600_000
      ? ["minute", 60_000, "m"]
      : elapsed < 86_400_000
        ? ["hour", 3_600_000, "h"]
        : ["day", 86_400_000, "d"];
    const magnitude = Math.max(1, Math.floor(elapsed / unitMilliseconds));
    try {
      return new Intl.RelativeTimeFormat(locale, {
        numeric: "always",
        style: "narrow"
      }).format(-magnitude, unit);
    } catch {
      return `${magnitude}${fallbackSuffix} ago`;
    }
  }

  function getServerHistoryLocalDayOrdinal(timestamp) {
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime())) return null;
    const ordinal = Math.floor(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000
    );
    return Number.isFinite(ordinal) ? ordinal : null;
  }

  function formatServerHistoryDateGroupLabel(
    timestamp,
    now = Date.now(),
    locale = getRobloxPageLocale()
  ) {
    let displayLocale = "en-US";
    try {
      displayLocale = Intl.getCanonicalLocales(locale)[0] || "en-US";
    } catch {
      // Keep a deterministic fallback for malformed page locales.
    }
    const date = new Date(timestamp);
    const dayOrdinal = getServerHistoryLocalDayOrdinal(timestamp);
    const todayOrdinal = getServerHistoryLocalDayOrdinal(now);
    if (!Number.isFinite(date.getTime()) || dayOrdinal === null) {
      return "Unknown date";
    }
    const dayAge = todayOrdinal === null ? null : todayOrdinal - dayOrdinal;
    if (dayAge === 0 || dayAge === 1) {
      const relativeLabel = new Intl.RelativeTimeFormat(displayLocale, {
        numeric: "auto"
      }).format(
        -dayAge,
        "day"
      );
      return relativeLabel.charAt(0).toLocaleUpperCase(displayLocale) +
        relativeLabel.slice(1);
    }
    if (dayAge >= 2 && dayAge <= 6) {
      return new Intl.DateTimeFormat(displayLocale, { weekday: "long" }).format(date);
    }
    return new Intl.DateTimeFormat(displayLocale, {
      year: "numeric",
      month: "long",
      day: "numeric"
    }).format(date);
  }

  function groupServerHistorySessionsByDate(
    sessions,
    now = Date.now(),
    locale = getRobloxPageLocale()
  ) {
    const groups = [];
    const groupsByDay = new Map();
    const orderedSessions = Array.isArray(sessions)
      ? [...sessions].sort((left, right) => {
          const leftTimestamp = Number(left?.lastSeenAt);
          const rightTimestamp = Number(right?.lastSeenAt);
          if (!Number.isFinite(leftTimestamp) && !Number.isFinite(rightTimestamp)) {
            return 0;
          }
          if (!Number.isFinite(leftTimestamp)) return 1;
          if (!Number.isFinite(rightTimestamp)) return -1;
          return rightTimestamp - leftTimestamp;
        })
      : [];
    for (const session of orderedSessions) {
      const dayOrdinal = getServerHistoryLocalDayOrdinal(session?.lastSeenAt);
      const key = dayOrdinal === null ? "unknown" : String(dayOrdinal);
      let group = groupsByDay.get(key);
      if (!group) {
        group = {
          dayOrdinal,
          label: formatServerHistoryDateGroupLabel(
            session?.lastSeenAt,
            now,
            locale
          ),
          sessions: []
        };
        groupsByDay.set(key, group);
        groups.push(group);
      }
      group.sessions.push(session);
    }
    return groups;
  }

  function sendServerHistoryRuntimeMessage(message) {
    if (typeof serverHistoryMessageSenderForTests === "function") {
      return Promise.resolve().then(() => serverHistoryMessageSenderForTests(message));
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        const error = new Error("Server History request timed out");
        error.code = "TIMEOUT";
        reject(error);
      }, SERVER_HISTORY_REQUEST_TIMEOUT_MS);
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        callback(value);
      };
      try {
        chrome.runtime.sendMessage(message, (response) => {
          const runtimeError = chrome.runtime.lastError;
          if (runtimeError) {
            finish(reject, new Error(runtimeError.message));
          } else {
            finish(resolve, response);
          }
        });
      } catch (error) {
        finish(reject, error);
      }
    });
  }

  function getServerHistoryLoadErrorText(code) {
    const normalized = String(code || "").toUpperCase();
    if (normalized.includes("SIGNED") || normalized.includes("AUTH")) {
      return "Sign in to Roblox to view this account's Server History.";
    }
    if (normalized.includes("DISABLED")) {
      return "Server History is currently disabled in RoTool Settings.";
    }
    return "Server History could not be loaded. Try again.";
  }

  function requestServerHistoryThumbnail(image, universeId, epoch) {
    if (!image || !universeId) return;
    const cachedUrl = serverHistoryThumbnailByUniverseId.get(universeId);
    if (isSafeThumbnailImageUrl(cachedUrl)) {
      image.src = cachedUrl;
      image.closest(".rsl-owned-thumbnail-frame")?.setAttribute(
        "data-rsl-thumbnail-state",
        "loaded"
      );
      return;
    }
    const frame = image.closest(".rsl-owned-thumbnail-frame");
    setOwnedThumbnailState(frame, "loading");
    let request = serverHistoryThumbnailRequestByUniverseId.get(universeId);
    if (!request) {
      request = new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage(
            { type: "rsl:get-thumbnail", kind: "gameUniverse", id: universeId },
            (response) => {
              if (chrome.runtime.lastError || !isSafeThumbnailImageUrl(response?.url)) {
                resolve(null);
              } else {
                serverHistoryThumbnailByUniverseId.set(universeId, response.url);
                resolve(response.url);
              }
            }
          );
        } catch {
          resolve(null);
        }
      }).finally(() => {
        serverHistoryThumbnailRequestByUniverseId.delete(universeId);
      });
      serverHistoryThumbnailRequestByUniverseId.set(universeId, request);
    }
    void request.then((url) => {
      if (
        epoch !== serverHistoryLifecycleEpoch ||
        !image.isConnected ||
        !document.getElementById(SERVER_HISTORY_DIALOG_ID)?.open
      ) return;
      if (url) image.src = url;
      setOwnedThumbnailState(frame, url ? "loaded" : "fallback");
    });
  }

  function createServerHistoryActionButton(label, variant = "secondary") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `rsl-button rsl-button--${variant} rsl-server-history__action`;
    button.textContent = label;
    return button;
  }

  function renderServerHistorySession(session) {
    const item = document.createElement("li");
    item.className = "rsl-server-history__item";
    item.setAttribute("data-rsl-server-history-session-id", session.sessionId);

    const thumbnailFrame = document.createElement("span");
    thumbnailFrame.className = "rsl-server-history__thumbnail rsl-owned-thumbnail-frame";
    thumbnailFrame.setAttribute("aria-hidden", "true");
    thumbnailFrame.dataset.rslThumbnailState = "fallback";
    const image = document.createElement("img");
    image.alt = "";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    image.src = DEFAULT_GAME_ICON_URL;
    thumbnailFrame.append(image);

    const main = document.createElement("div");
    main.className = "rsl-server-history__main";
    const titleRow = document.createElement("div");
    titleRow.className = "rsl-server-history__title-row";
    const gameName = document.createElement("span");
    gameName.className = "rsl-server-history__game-name";
    gameName.textContent = session.name;
    gameName.title = session.name;
    titleRow.append(gameName);

    const timing = document.createElement("div");
    timing.className = "rsl-server-history__timing";
    timing.setAttribute("aria-hidden", "true");
    const firstDate = new Date(session.firstSeenAt);
    const lastDate = new Date(session.lastSeenAt);
    const sameLocalDay = firstDate.getFullYear() === lastDate.getFullYear() &&
      firstDate.getMonth() === lastDate.getMonth() &&
      firstDate.getDate() === lastDate.getDate();
    const relativeLastSeen = formatServerHistoryRelativeLastSeen(session.lastSeenAt);
    const timingSummary = document.createElement("div");
    timingSummary.className = "rsl-server-history__timing-summary";
    const relativeTime = document.createElement("time");
    relativeTime.className = "rsl-server-history__relative-time";
    relativeTime.dateTime = lastDate.toISOString();
    relativeTime.dataset.rslServerHistoryLastSeenAt = String(session.lastSeenAt);
    relativeTime.textContent = relativeLastSeen;
    timingSummary.append(
      relativeTime,
      document.createTextNode(
        ` · Played ${formatServerHistoryCompactDuration(
          session.firstSeenAt,
          session.lastSeenAt
        )}`
      )
    );
    const timeRange = document.createElement("div");
    timeRange.className = "rsl-server-history__time-range";
    const firstTime = document.createElement("time");
    firstTime.dateTime = firstDate.toISOString();
    firstTime.textContent = formatServerHistoryCompactTimestamp(
      session.firstSeenAt,
      sameLocalDay
    );
    const lastTime = document.createElement("time");
    lastTime.dateTime = lastDate.toISOString();
    lastTime.textContent = formatServerHistoryCompactTimestamp(
      session.lastSeenAt,
      sameLocalDay
    );
    timeRange.append(
      firstTime,
      document.createTextNode(" – "),
      lastTime
    );
    timing.append(timingSummary, timeRange);
    const fullTimingText =
      `First seen: ${formatServerHistoryTimestamp(session.firstSeenAt)} · ` +
      `Last seen: ${formatServerHistoryTimestamp(session.lastSeenAt)} · ` +
      `Observed for ${formatServerHistoryDuration(
        session.firstSeenAt,
        session.lastSeenAt
      )}`;
    timing.title = fullTimingText;
    const accessibleTiming = document.createElement("span");
    accessibleTiming.className = "rsl-sr-only";
    accessibleTiming.textContent = fullTimingText;

    main.append(titleRow, timing, accessibleTiming);

    const actions = document.createElement("div");
    actions.className = "rsl-server-history__actions";
    const open = document.createElement("a");
    open.className = "rsl-button rsl-button--secondary rsl-server-history__action";
    open.dataset.rslServerHistoryAction = "open";
    open.href = `/games/${session.placeId}`;
    open.textContent = "View Game";
    const viewGameDescription = `View ${session.name} game page on Roblox`;
    open.setAttribute("aria-label", viewGameDescription);
    open.title = viewGameDescription;
    const rejoinLabel = serverHistoryPendingRejoinId === session.sessionId
      ? "Opening…"
      : "Rejoin Server";
    const rejoin = createServerHistoryActionButton(rejoinLabel, "primary");
    rejoin.dataset.rslServerHistoryAction = "rejoin";
    const rejoinPending = serverHistoryPendingRejoinId !== null;
    rejoin.setAttribute("aria-disabled", String(rejoinPending));
    rejoin.setAttribute("aria-label", `Rejoin server for ${session.name}`);
    rejoin.title = `Rejoin server for ${session.name}`;
    rejoin.addEventListener("click", (event) => {
      if (event.isTrusted !== true || rejoinPending) return;
      void rejoinServerHistorySession(session.sessionId);
    });
    actions.append(open, rejoin);
    item.append(thumbnailFrame, main, actions);
    requestServerHistoryThumbnail(image, session.universeId, serverHistoryLifecycleEpoch);
    return item;
  }

  function renderServerHistoryDialog() {
    const dialog = document.getElementById(SERVER_HISTORY_DIALOG_ID);
    if (!dialog) return;
    const status = dialog.querySelector("[data-rsl-server-history-live-status]");
    const list = dialog.querySelector("[data-rsl-server-history-list]");
    if (!status || !list) return;
    const focusedControl = list.contains(document.activeElement)
      ? document.activeElement
      : null;
    const focusedSessionId = normalizeServerHistoryOpaqueId(
      focusedControl
        ?.closest?.("[data-rsl-server-history-session-id]")
        ?.getAttribute("data-rsl-server-history-session-id")
    );
    const focusedAction = focusedControl?.getAttribute?.(
      "data-rsl-server-history-action"
    );
    status.textContent = serverHistoryNotice;
    status.classList.toggle(
      "rsl-server-history__live-status--error",
      serverHistoryLoadState === "error"
    );
    list.replaceChildren();
    if (serverHistoryLoadState === "loading") {
      const loading = document.createElement("li");
      loading.className = "rsl-server-history__empty";
      loading.textContent = "Loading your recent servers…";
      list.append(loading);
    } else if (serverHistoryLoadState === "error") {
      const error = document.createElement("li");
      error.className = "rsl-server-history__empty rsl-server-history__empty--error";
      error.textContent = getServerHistoryLoadErrorText(serverHistoryErrorCode);
      list.append(error);
    } else if (serverHistorySessions.length === 0) {
      const empty = document.createElement("li");
      empty.className = "rsl-server-history__empty";
      empty.textContent = "No recent servers yet";
      list.append(empty);
    } else {
      const renderedAt = Date.now();
      const groups = groupServerHistorySessionsByDate(
        serverHistorySessions,
        renderedAt,
        getRobloxPageLocale()
      );
      groups.forEach((group) => {
        const groupItem = document.createElement("li");
        groupItem.className = "rsl-server-history__date-group";
        const heading = document.createElement("h3");
        heading.className = "rsl-server-history__date-heading";
        heading.id = `rsl-server-history-date-${
          group.dayOrdinal === null ? "unknown" : group.dayOrdinal
        }`;
        heading.textContent = group.label;
        const sessions = document.createElement("ul");
        sessions.className = "rsl-server-history__date-list";
        sessions.setAttribute("aria-labelledby", heading.id);
        group.sessions.forEach((session) => {
          sessions.append(renderServerHistorySession(session));
        });
        groupItem.append(heading, sessions);
        list.append(groupItem);
      });
    }
    list.setAttribute("aria-busy", String(serverHistoryLoadState === "loading"));
    const clearButton = dialog.querySelector("[data-rsl-server-history-clear]");
    if (clearButton) {
      clearButton.disabled = serverHistoryClearPending || serverHistorySessions.length === 0;
    }
    const confirm = dialog.querySelector("[data-rsl-server-history-clear-confirmation]");
    if (confirm) confirm.hidden = !serverHistoryConfirmClear;
    dialog.querySelectorAll("[data-rsl-server-history-refresh]").forEach((button) => {
      button.disabled = serverHistoryLoadState === "loading";
    });
    if (
      focusedSessionId &&
      ["open", "rejoin"].includes(focusedAction) &&
      dialog.open
    ) {
      const restoredControl = list.querySelector(
        `[data-rsl-server-history-session-id="${CSS.escape(focusedSessionId)}"] ` +
          `[data-rsl-server-history-action="${focusedAction}"]`
      );
      restoredControl?.focus?.({ preventScroll: true });
    }
  }

  function clearServerHistoryMidnightTimer() {
    if (serverHistoryMidnightTimer !== null) {
      window.clearTimeout(serverHistoryMidnightTimer);
      serverHistoryMidnightTimer = null;
    }
  }

  function clearServerHistoryRelativeTimeTimer() {
    if (serverHistoryRelativeTimeTimer !== null) {
      window.clearTimeout(serverHistoryRelativeTimeTimer);
      serverHistoryRelativeTimeTimer = null;
    }
  }

  function refreshServerHistoryRelativeTimes() {
    const dialog = document.getElementById(SERVER_HISTORY_DIALOG_ID);
    if (!dialog?.open) return;
    const now = Date.now();
    dialog.querySelectorAll("[data-rsl-server-history-last-seen-at]").forEach((node) => {
      const lastSeenAt = normalizeServerHistoryTimestamp(
        node.getAttribute("data-rsl-server-history-last-seen-at")
      );
      if (lastSeenAt !== null) {
        node.textContent = formatServerHistoryRelativeLastSeen(lastSeenAt, now);
      }
    });
  }

  function scheduleServerHistoryRelativeTimeRefresh() {
    clearServerHistoryRelativeTimeTimer();
    if (!document.getElementById(SERVER_HISTORY_DIALOG_ID)?.open) return;
    const delay = Math.max(250, 60_000 - (Date.now() % 60_000) + 50);
    serverHistoryRelativeTimeTimer = window.setTimeout(() => {
      serverHistoryRelativeTimeTimer = null;
      if (!document.getElementById(SERVER_HISTORY_DIALOG_ID)?.open) return;
      refreshServerHistoryRelativeTimes();
      scheduleServerHistoryRelativeTimeRefresh();
    }, delay);
  }

  function scheduleServerHistoryMidnightRefresh() {
    clearServerHistoryMidnightTimer();
    const dialog = document.getElementById(SERVER_HISTORY_DIALOG_ID);
    if (!dialog?.open) return;
    const nextMidnight = new Date();
    nextMidnight.setHours(24, 0, 0, 0);
    const delay = Math.max(1_000, nextMidnight.getTime() - Date.now() + 250);
    serverHistoryMidnightTimer = window.setTimeout(() => {
      serverHistoryMidnightTimer = null;
      if (!document.getElementById(SERVER_HISTORY_DIALOG_ID)?.open) return;
      renderServerHistoryDialog();
      scheduleServerHistoryMidnightRefresh();
    }, delay);
  }

  async function loadServerHistory() {
    if (!isFeatureEnabled("serverHistory")) return false;
    const dialog = document.getElementById(SERVER_HISTORY_DIALOG_ID);
    if (!dialog?.open) return false;
    const epoch = serverHistoryLifecycleEpoch;
    const requestId = ++serverHistoryRequestSequence;
    serverHistoryLoadState = "loading";
    serverHistoryErrorCode = "";
    serverHistoryNotice = "";
    renderServerHistoryDialog();
    try {
      const response = await sendServerHistoryRuntimeMessage({
        type: SERVER_HISTORY_GET_MESSAGE_TYPE,
        requestId,
        locale: getRobloxPageLocale()
      });
      if (
        epoch !== serverHistoryLifecycleEpoch ||
        !document.getElementById(SERVER_HISTORY_DIALOG_ID)?.open ||
        response?.requestId !== requestId
      ) return false;
      const normalized = normalizeServerHistoryResponse(response);
      if (!normalized || !normalized.enabled) {
        const error = new Error("Invalid Server History response");
        error.code = response?.errorCode ||
          response?.code ||
          (normalized ? "DISABLED" : "INVALID");
        throw error;
      }
      serverHistorySessions = normalized.sessions;
      serverHistoryLoadState = "ready";
      renderServerHistoryDialog();
      return true;
    } catch (error) {
      if (epoch !== serverHistoryLifecycleEpoch) return false;
      serverHistoryLoadState = "error";
      serverHistoryErrorCode = error?.code || "NETWORK";
      serverHistoryNotice = "";
      renderServerHistoryDialog();
      return false;
    }
  }

  async function rejoinServerHistorySession(sessionId) {
    const normalizedId = normalizeServerHistoryOpaqueId(sessionId);
    if (
      !normalizedId ||
      !serverHistorySessions.some((session) => session.sessionId === normalizedId) ||
      serverHistoryPendingRejoinId !== null ||
      !document.getElementById(SERVER_HISTORY_DIALOG_ID)?.open
    ) return false;
    const epoch = serverHistoryLifecycleEpoch;
    const requestId = ++serverHistoryRequestSequence;
    serverHistoryPendingRejoinId = normalizedId;
    serverHistoryNotice = "";
    renderServerHistoryDialog();
    try {
      const response = await sendServerHistoryRuntimeMessage({
        type: SERVER_HISTORY_REJOIN_MESSAGE_TYPE,
        requestId,
        sessionId: normalizedId
      });
      if (
        epoch !== serverHistoryLifecycleEpoch ||
        response?.requestId !== requestId ||
        normalizeServerHistoryOpaqueId(response?.sessionId) !== normalizedId
      ) return false;
      if (response?.ok === true) {
        serverHistoryNotice = "Opening Roblox…";
        return true;
      }
      const responseCode = response?.errorCode || response?.code;
      if (responseCode === "not-found") {
        serverHistoryNotice = "That saved history entry is no longer available.";
      } else {
        serverHistoryNotice = "Roblox could not open that server.";
      }
      return false;
    } catch {
      if (epoch === serverHistoryLifecycleEpoch) {
        serverHistoryNotice = "Roblox could not open that server.";
      }
      return false;
    } finally {
      if (epoch === serverHistoryLifecycleEpoch) {
        serverHistoryPendingRejoinId = null;
        renderServerHistoryDialog();
      }
    }
  }

  async function clearServerHistory() {
    if (
      serverHistoryClearPending ||
      !isFeatureEnabled("serverHistory") ||
      !document.getElementById(SERVER_HISTORY_DIALOG_ID)?.open
    ) return false;
    const epoch = serverHistoryLifecycleEpoch;
    const requestId = ++serverHistoryRequestSequence;
    const expectedSessionId = serverHistorySessions[0]?.sessionId || null;
    if (!expectedSessionId) return false;
    serverHistoryClearPending = true;
    serverHistoryNotice = "Clearing local history…";
    renderServerHistoryDialog();
    try {
      const response = await sendServerHistoryRuntimeMessage({
        type: SERVER_HISTORY_CLEAR_MESSAGE_TYPE,
        requestId,
        expectedSessionId
      });
      if (
        epoch !== serverHistoryLifecycleEpoch ||
        response?.requestId !== requestId ||
        response?.ok !== true
      ) throw new Error("History was not cleared");
      serverHistorySessions = [];
      serverHistoryConfirmClear = false;
      serverHistoryNotice = "Server History cleared from this device.";
      return true;
    } catch {
      if (epoch === serverHistoryLifecycleEpoch) {
        serverHistoryNotice = "Server History could not be cleared. Try again.";
      }
      return false;
    } finally {
      if (epoch === serverHistoryLifecycleEpoch) {
        serverHistoryClearPending = false;
        renderServerHistoryDialog();
      }
    }
  }

  function resetServerHistoryDialogState() {
    clearServerHistoryMidnightTimer();
    clearServerHistoryRelativeTimeTimer();
    serverHistoryLifecycleEpoch += 1;
    serverHistoryLoadState = "idle";
    serverHistoryErrorCode = "";
    serverHistorySessions = [];
    serverHistoryPendingRejoinId = null;
    serverHistoryConfirmClear = false;
    serverHistoryClearPending = false;
    serverHistoryNotice = "";
  }

  function closeServerHistoryDialog(restoreFocus = true) {
    const dialog = document.getElementById(SERVER_HISTORY_DIALOG_ID);
    if (dialog?.open) {
      dialog.dataset.rslRestoreServerHistoryFocus = restoreFocus ? "true" : "false";
      dialog.close();
      return;
    }
    const opener = serverHistoryDialogOpener;
    serverHistoryDialogOpener = null;
    resetServerHistoryDialogState();
    if (restoreFocus && opener?.isConnected) opener.focus({ preventScroll: true });
  }

  function createServerHistoryDialog() {
    const dialog = document.createElement("dialog");
    dialog.id = SERVER_HISTORY_DIALOG_ID;
    dialog.className =
      "rsl-dialog rsl-server-history-dialog foundation-web-dialog-overlay " +
      "padding-medium foundation-web-portal-zindex bg-common-backdrop";
    dialog.setAttribute("aria-labelledby", "rsl-server-history-title");
    dialog.innerHTML = `
      <div class="rsl-dialog__surface rsl-server-history__surface relative radius-large bg-surface-100 stroke-muted stroke-standard foundation-web-dialog-content shadow-transient-high" data-size="Large">
        <div class="rsl-dialog__close-container absolute foundation-web-dialog-close-container">
          <button type="button" class="rsl-icon-button foundation-web-close-affordance" aria-label="Close Server History" data-rsl-server-history-close><span aria-hidden="true" class="rsl-dialog__close-icon"></span></button>
        </div>
        <div class="rsl-dialog__body rsl-server-history__body">
          <header class="rsl-dialog__header rsl-server-history__header">
            <h2 id="rsl-server-history-title" class="content-emphasis text-title-large">Server History</h2>
            <div class="rsl-server-history__live-status content-default text-body-medium" role="status" aria-live="polite" aria-atomic="true" data-rsl-server-history-live-status></div>
          </header>
          <ul class="rsl-server-history__list" aria-label="Server sessions grouped by date" data-rsl-server-history-list></ul>
        </div>
        <div class="rsl-server-history__clear-confirmation" role="alertdialog" aria-modal="false" aria-live="assertive" aria-atomic="true" aria-labelledby="rsl-server-history-clear-confirmation-label" data-rsl-server-history-clear-confirmation hidden>
          <span id="rsl-server-history-clear-confirmation-label">Clear all locally saved Server History for this Roblox account?</span>
          <button type="button" class="rsl-button rsl-button--secondary" data-rsl-server-history-clear-cancel>Cancel</button>
          <button type="button" class="rsl-button rsl-button--danger" data-rsl-server-history-clear-confirm>Clear history</button>
        </div>
        <footer class="rsl-dialog__actions rsl-server-history__footer">
          <button type="button" class="rsl-button rsl-button--danger" data-rsl-server-history-clear>Clear history</button>
          <button type="button" class="rsl-button rsl-button--secondary" data-rsl-server-history-refresh>Refresh</button>
          <button type="button" class="rsl-button rsl-button--primary" data-rsl-server-history-close>Done</button>
        </footer>
      </div>`;
    dialog.querySelectorAll("[data-rsl-server-history-close]").forEach((button) => {
      button.addEventListener("click", () => closeServerHistoryDialog(true));
    });
    dialog.querySelector("[data-rsl-server-history-refresh]")?.addEventListener(
      "click",
      (event) => {
        if (event.isTrusted !== true) return;
        void loadServerHistory();
      }
    );
    dialog.querySelector("[data-rsl-server-history-clear]")?.addEventListener(
      "click",
      (event) => {
        if (event.isTrusted !== true || serverHistorySessions.length === 0) return;
        serverHistoryConfirmClear = true;
        renderServerHistoryDialog();
        dialog.querySelector("[data-rsl-server-history-clear-cancel]")?.focus();
      }
    );
    dialog.querySelector("[data-rsl-server-history-clear-cancel]")?.addEventListener(
      "click",
      (event) => {
        if (event.isTrusted !== true) return;
        serverHistoryConfirmClear = false;
        renderServerHistoryDialog();
        dialog.querySelector("[data-rsl-server-history-clear]")?.focus();
      }
    );
    dialog.querySelector("[data-rsl-server-history-clear-confirm]")?.addEventListener(
      "click",
      (event) => {
        if (event.isTrusted !== true) return;
        void clearServerHistory();
      }
    );
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      if (serverHistoryConfirmClear) {
        serverHistoryConfirmClear = false;
        renderServerHistoryDialog();
        dialog.querySelector("[data-rsl-server-history-clear]")?.focus();
      } else {
        closeServerHistoryDialog(true);
      }
    });
    dialog.addEventListener("cancel", (event) => {
      if (!serverHistoryConfirmClear) return;
      event.preventDefault();
      serverHistoryConfirmClear = false;
      renderServerHistoryDialog();
      dialog.querySelector("[data-rsl-server-history-clear]")?.focus();
    });
    dialog.addEventListener("close", () => {
      const restoreFocus = dialog.dataset.rslRestoreServerHistoryFocus !== "false";
      delete dialog.dataset.rslRestoreServerHistoryFocus;
      const opener = serverHistoryDialogOpener;
      serverHistoryDialogOpener = null;
      resetServerHistoryDialogState();
      if (restoreFocus && opener?.isConnected) opener.focus({ preventScroll: true });
      queueMount();
    });
    document.body.append(dialog);
    renderServerHistoryDialog();
    return dialog;
  }

  function openServerHistoryDialog(opener = null) {
    if (!isFeatureEnabled("serverHistory")) return null;
    let dialog = document.getElementById(SERVER_HISTORY_DIALOG_ID);
    if (!dialog) dialog = createServerHistoryDialog();
    if (dialog.open) {
      dialog.querySelector("[data-rsl-server-history-close]")?.focus();
      return dialog;
    }
    resetServerHistoryDialogState();
    serverHistoryDialogOpener = opener || document.activeElement;
    serverHistoryLoadState = "loading";
    renderServerHistoryDialog();
    dialog.showModal();
    scheduleServerHistoryMidnightRefresh();
    scheduleServerHistoryRelativeTimeRefresh();
    dialog.querySelector("[data-rsl-server-history-close]")?.focus();
    void loadServerHistory();
    return dialog;
  }

  function cleanupServerHistoryFeature() {
    document.getElementById(SERVER_HISTORY_ROW_ID)?.remove();
    closeServerHistoryDialog(false);
    const dialog = document.getElementById(SERVER_HISTORY_DIALOG_ID);
    if (dialog && !dialog.open) dialog.remove();
  }

  function mountExtensionFeatures() {
    mountFeatureSettingsButton();
    if (!featureSettingsLoaded) {
      return;
    }
    mountNativeEventScheduleButtons();
    if (isFeatureEnabled("sidebarShortcuts")) {
      syncNativeSidebarVisibility();
      mountGameEventsSidebarRow();
      mountJoinSchedulerSidebarRow();
      mountServerHistorySidebarRow();
      if (isFeatureEnabled("sidebarCustomShortcuts")) {
        mountSidebar();
      } else {
        cleanupSidebarFeature();
      }
    } else {
      cleanupSidebarFeature();
      document.getElementById(GAME_EVENTS_ROW_ID)?.remove();
      document.getElementById(JOIN_SCHEDULER_ROW_ID)?.remove();
      document.getElementById(SERVER_HISTORY_ROW_ID)?.remove();
      cleanupNativeSidebarVisibility();
    }
    if (!isFeatureEnabled("serverHistory")) {
      cleanupServerHistoryFeature();
    }
    if (!isFeatureEnabled("gameEvents")) {
      cleanupGameEventsFeature();
    }
    if (!isFeatureEnabled("joinScheduler")) {
      cleanupJoinSchedulerFeature();
    }
    mountOnlineFriendsFilter();
    mountBestFriendsCarousel();
    mountHomeFriendsCollapseControl();
    if (isFeatureEnabled("quickPlay")) {
      mountQuickPlayControls();
    } else {
      cleanupQuickPlayFeature();
    }
    if (isFeatureEnabled("gameCcu")) {
      mountGameTileCcu();
    } else {
      cleanupGameTileCcuFeature();
    }
    if (isFeatureEnabled("gameCcuHoverGraph")) {
      mountGameTileCcuGraphTriggers();
    } else {
      cleanupGameTileCcuGraphDisplay();
    }
  }

  function mountSidebar() {
    const native = findNativeRow();
    if (!native) {
      return;
    }

    const { list, row: templateRow } = native;
    let addRow = document.getElementById(ADD_ROW_ID);

    if (!addRow) {
      addRow = makeAddRow(templateRow);
    }

    const wantedIds = new Set(shortcuts.map((shortcut) => shortcut.id));
    document.querySelectorAll(`[${ROW_ATTRIBUTE}]`).forEach((row) => {
      if (!wantedIds.has(row.getAttribute(ROW_ATTRIBUTE))) {
        row.remove();
      }
    });

    // Move the whole extension block to the native-link boundary first. The
    // ordering pass below then pulls every saved shortcut in directly before
    // Add shortcut, even if an older build left those rows below a promo.
    placeAddRow(list, addRow);

    const orderedRows = [];

    for (const shortcut of shortcuts) {
      let row = document.querySelector(`[${ROW_ATTRIBUTE}="${CSS.escape(shortcut.id)}"]`);

      if (!row) {
        row = makeShortcutRow(templateRow, shortcut);
      } else {
        updateShortcutRow(row, shortcut);
      }

      orderedRows.push(row);
    }

    // Work backwards from the Add row so already-correct rows are not detached
    // and reinserted on every MutationObserver pass. Repeatedly moving the same
    // nodes causes visible flicker and can cancel pointer clicks.
    let nextRow = addRow;
    for (let index = orderedRows.length - 1; index >= 0; index -= 1) {
      const row = orderedRows[index];
      if (row.parentElement !== list || row.nextElementSibling !== nextRow) {
        list.insertBefore(row, nextRow);
      }
      nextRow = row;
    }

    placeAddRow(list, addRow);
  }

  function cleanupSidebarFeature() {
    document.getElementById(ADD_ROW_ID)?.remove();
    document.querySelectorAll(`[${ROW_ATTRIBUTE}]`).forEach((row) => row.remove());
    const dialog = document.getElementById(DIALOG_ID);
    if (dialog) {
      if (dialog.open) {
        dialog.close();
      }
      dialog.remove();
    }
  }

  function flushFeatureSettingsReconcile() {
    if (featureSettingsReconcileFrame !== null) {
      if (
        featureSettingsReconcileFrame !== -1 &&
        typeof window.cancelAnimationFrame === "function"
      ) {
        window.cancelAnimationFrame(featureSettingsReconcileFrame);
      }
      featureSettingsReconcileFrame = null;
    }
    if (featureSettingsReconcileTimer !== null) {
      window.clearTimeout(featureSettingsReconcileTimer);
      featureSettingsReconcileTimer = null;
    }
    featureSettingsReconcileScheduled = false;
    if (featureSettingsEqual(featureSettingsApplied, featureSettings)) {
      return false;
    }
    const previous = { ...featureSettingsApplied };
    const next = { ...featureSettings };
    featureSettingsApplied = next;
    reconcileFeatureSettings(previous, next);
    return true;
  }

  function scheduleFeatureSettingsReconcile() {
    if (!featureSettingsLoaded || featureSettingsReconcileScheduled) {
      return false;
    }
    featureSettingsReconcileScheduled = true;
    const afterPaint = () => {
      featureSettingsReconcileFrame = null;
      featureSettingsReconcileTimer = window.setTimeout(() => {
        featureSettingsReconcileTimer = null;
        flushFeatureSettingsReconcile();
      }, 0);
    };
    if (typeof window.requestAnimationFrame === "function") {
      featureSettingsReconcileFrame = window.requestAnimationFrame(afterPaint);
    } else {
      featureSettingsReconcileFrame = -1;
      featureSettingsReconcileTimer = window.setTimeout(() => {
        featureSettingsReconcileFrame = null;
        featureSettingsReconcileTimer = null;
        flushFeatureSettingsReconcile();
      }, 0);
    }
    return true;
  }

  function reconcileFeatureSettings(previousSettings, nextSettings) {
    if (!featureSettingsLoaded) {
      return;
    }
    if (
      previousSettings.sidebarShortcuts !== nextSettings.sidebarShortcuts ||
      previousSettings.sidebarCustomShortcuts !==
        nextSettings.sidebarCustomShortcuts
    ) {
      cleanupSidebarFeature();
    }
    if (
      previousSettings.sidebarShortcuts !== nextSettings.sidebarShortcuts ||
      previousSettings.sidebarServerHistory !== nextSettings.sidebarServerHistory
    ) {
      document.getElementById(SERVER_HISTORY_ROW_ID)?.remove();
    }
    if (
      previousSettings.sidebarShortcuts !== nextSettings.sidebarShortcuts ||
      previousSettings.sidebarGameEvents !== nextSettings.sidebarGameEvents
    ) {
      document.getElementById(GAME_EVENTS_ROW_ID)?.remove();
    }
    if (
      previousSettings.sidebarShortcuts !== nextSettings.sidebarShortcuts ||
      previousSettings.sidebarJoinScheduler !==
        nextSettings.sidebarJoinScheduler
    ) {
      document.getElementById(JOIN_SCHEDULER_ROW_ID)?.remove();
    }
    const sidebarVisibilityKeys = [
      "sidebarShortcuts",
      "sidebarHome",
      "sidebarProfile",
      "sidebarRobloxPlus",
      "sidebarMessages",
      "sidebarFriends",
      "sidebarAvatar",
      "sidebarInventory",
      "sidebarTrade",
      "sidebarCommunities",
      "sidebarBlog",
      "sidebarOfficialStore",
      "sidebarGiftCards"
    ];
    const sidebarVisibilityChanged = sidebarVisibilityKeys.some(
      (key) => previousSettings[key] !== nextSettings[key]
    );
    if (sidebarVisibilityChanged) {
      cleanupNativeSidebarVisibility();
    }
    if (
      previousSettings.friendFilters !== nextSettings.friendFilters ||
      previousSettings.bestFriends !== nextSettings.bestFriends
    ) {
      cleanupFriendsFiltersFeature();
    }
    if (previousSettings.bestFriends !== nextSettings.bestFriends) {
      cleanupBestFriendsHome(isFriendsPage() && nextSettings.bestFriends);
    }
    const quickSettingsKeys = [
      "quickSettings",
      "quickSettingsOnlineStatus",
      "quickSettingsCurrentExperience",
      "quickSettingsInventory"
    ];
    const quickSettingsChanged = quickSettingsKeys.some(
      (key) => previousSettings[key] !== nextSettings[key]
    );
    if (quickSettingsChanged) {
      const hadEnabledControls =
        getEnabledQuickSettingAliases(previousSettings).length > 0;
      const hasEnabledControls = getEnabledQuickSettingAliases().length > 0;
      // A child preference can change in another tab while the master is off.
      // When both effective states are empty, preserve it without touching a
      // Home surface that was already absent.
      if (hadEnabledControls && !hasEnabledControls) {
        cleanupQuickSettingsHome();
        // Re-measure the shared Home stack immediately after the last control
        // disappears; this keeps Best Friends in place without remounting any
        // unrelated feature.
        mountBestFriendsCarousel();
      } else if (hasEnabledControls) {
        // Preserve the current snapshot and live selects when possible. A newly
        // exposed control is loaded only if the existing snapshot did not
        // include it, while hiding a row never causes an unrelated remount.
        const carousel = document.querySelector(
          `[${BEST_FRIENDS_CAROUSEL_ATTRIBUTE}]`
        );
        if (carousel) {
          renderQuickSettings(carousel);
          const nativeCarousel = findNativeHomeFriendsCarousel();
          if (nativeCarousel) {
            placeBestFriendsCarousel(carousel, nativeCarousel);
            observeBestFriendsGeometry(carousel);
          }
        } else {
          mountBestFriendsCarousel();
        }
        if (
          !hadEnabledControls ||
          !hasQuickSettingsSnapshotForEnabledControls()
        ) {
          void loadQuickSettings(false);
        }
      }
    }
    const quickPlayActionsChanged =
      previousSettings.quickPlayActionPlay !== nextSettings.quickPlayActionPlay ||
      previousSettings.quickPlayActionPrivate !== nextSettings.quickPlayActionPrivate ||
      previousSettings.quickPlayActionRandom !== nextSettings.quickPlayActionRandom;
    if (quickPlayActionsChanged) {
      cleanupQuickPlayFeature();
    }
    if (previousSettings.quickPlay !== nextSettings.quickPlay) {
      cleanupQuickPlayFeature();
    }
    if (previousSettings.gameCcu !== nextSettings.gameCcu) {
      cleanupGameTileCcuFeature();
    }
    if (
      previousSettings.gameCcuHoverGraph !== nextSettings.gameCcuHoverGraph
    ) {
      cleanupGameTileCcuGraphDisplay();
    }
    if (
      previousSettings.serverHistory !== nextSettings.serverHistory &&
      nextSettings.serverHistory === false
    ) {
      cleanupServerHistoryFeature();
    }
    if (
      previousSettings.gameEvents !== nextSettings.gameEvents &&
      nextSettings.gameEvents === false
    ) {
      cleanupGameEventsFeature();
    }
    if (previousSettings.joinScheduler !== nextSettings.joinScheduler) {
      if (nextSettings.joinScheduler === false) {
        cleanupJoinSchedulerFeature();
      }
      const eventsDialog = document.getElementById(GAME_EVENTS_DIALOG_ID);
      if (eventsDialog?.open) renderGameEventsDialog();
    }

    const onlySidebarChanged = sidebarVisibilityChanged ||
      previousSettings.sidebarCustomShortcuts !==
        nextSettings.sidebarCustomShortcuts ||
      previousSettings.sidebarServerHistory !==
        nextSettings.sidebarServerHistory ||
      previousSettings.sidebarGameEvents !== nextSettings.sidebarGameEvents ||
      previousSettings.sidebarJoinScheduler !==
        nextSettings.sidebarJoinScheduler;
    const anyNonSidebarChange = FEATURE_SETTING_DEFINITIONS.some(
      ({ key }) =>
        ![
          ...sidebarVisibilityKeys,
          "sidebarCustomShortcuts",
          "sidebarServerHistory",
          "sidebarGameEvents",
          "sidebarJoinScheduler"
        ].includes(key) &&
        previousSettings[key] !== nextSettings[key]
    );
    if (onlySidebarChanged && !anyNonSidebarChange) {
      if (isFeatureEnabled("sidebarShortcuts")) {
        syncNativeSidebarVisibility();
        mountGameEventsSidebarRow();
        mountJoinSchedulerSidebarRow();
        mountServerHistorySidebarRow();
        if (isFeatureEnabled("sidebarCustomShortcuts")) {
          mountSidebar();
        }
      }
      return;
    }
    if (
      quickSettingsChanged &&
      FEATURE_SETTING_DEFINITIONS.every(
        ({ key }) =>
          quickSettingsKeys.includes(key) ||
          previousSettings[key] === nextSettings[key]
      )
    ) {
      return;
    }
    if (
      previousSettings.gameCcuHoverGraph !== nextSettings.gameCcuHoverGraph &&
      FEATURE_SETTING_DEFINITIONS.every(
        ({ key }) =>
          key === "gameCcuHoverGraph" ||
          previousSettings[key] === nextSettings[key]
      )
    ) {
      if (isFeatureEnabled("gameCcuHoverGraph")) {
        mountGameTileCcuGraphTriggers();
      }
      return;
    }
    mountExtensionFeatures();
  }

  function queueMount() {
    if (mountQueued) {
      return;
    }

    mountQueued = true;
    window.setTimeout(() => {
      mountQueued = false;
      mountExtensionFeatures();
    }, 80);
  }

  function normalizeUrl(rawValue) {
    let value = rawValue.trim();
    if (!value) {
      throw new Error("Enter a link.");
    }

    if (value.startsWith("/")) {
      value = new URL(value, "https://www.roblox.com").href;
    } else if (!/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value)) {
      value = `https://${value}`;
    }

    let url;
    try {
      url = new URL(value);
    } catch {
      throw new Error("Enter a valid link.");
    }

    if (url.protocol !== "https:") {
      throw new Error("Only secure https:// links are allowed.");
    }

    if (url.username || url.password) {
      throw new Error("Links containing usernames or passwords are not allowed.");
    }

    return url.href;
  }

  function createId() {
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function createDialog() {
    const dialog = document.createElement("dialog");
    dialog.id = DIALOG_ID;
    dialog.className =
      "rsl-dialog foundation-web-dialog-overlay padding-medium " +
      "foundation-web-portal-zindex bg-common-backdrop";
    dialog.innerHTML = `
      <div class="rsl-dialog__surface relative radius-large bg-surface-100 stroke-muted stroke-standard foundation-web-dialog-content shadow-transient-high" data-size="Medium">
        <div class="rsl-dialog__close-container absolute foundation-web-dialog-close-container">
          <button
            type="button"
            class="rsl-icon-button foundation-web-close-affordance flex stroke-none bg-none cursor-pointer relative clip group/interactable focus-visible:outline-focus disabled:outline-none bg-over-media-100 padding-small radius-circle"
            data-rsl-close
            aria-label="Close"
          >
            <div aria-hidden="true" data-testid="foundation-web-state-layer" class="absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none"></div>
            <span aria-hidden="true" data-testid="foundation-web-icon" class="rsl-dialog__close-icon grow-0 shrink-0 basis-auto icon icon-regular-x size-[var(--icon-size-medium)]"></span>
          </button>
        </div>

        <div class="rsl-dialog__body padding-x-xlarge padding-top-xlarge padding-bottom-xlarge">
          <div class="rsl-dialog__header">
            <h2 id="rsl-dialog-title" class="content-emphasis text-title-large">Sidebar shortcuts</h2>
            <p id="rsl-dialog-description" class="content-default text-body-medium">Add a Roblox page or another secure website.</p>
          </div>

          <form id="rsl-shortcut-form" class="rsl-dialog__form">
            <label class="rsl-field">
              <span class="content-emphasis text-label-medium">Name</span>
              <input class="rsl-field__input bg-surface-0 content-emphasis stroke-muted stroke-standard radius-medium height-1000 padding-x-medium" name="label" maxlength="32" autocomplete="off" placeholder="My favorite game" required>
            </label>

            <label class="rsl-field">
              <span class="content-emphasis text-label-medium">Link</span>
              <input class="rsl-field__input bg-surface-0 content-emphasis stroke-muted stroke-standard radius-medium height-1000 padding-x-medium" name="url" inputmode="url" autocomplete="off" placeholder="https://www.roblox.com/games/..." required>
            </label>

            <p class="rsl-error" role="alert"></p>
          </form>

          <section class="rsl-manager" aria-labelledby="rsl-manager-title">
            <h3 id="rsl-manager-title" class="content-emphasis text-title-medium">Your shortcuts</h3>
            <div class="rsl-manager__list" role="list"></div>
            <p class="rsl-sr-only" data-rsl-reorder-status role="status" aria-live="polite" aria-atomic="true"></p>
          </section>
        </div>

        <div class="rsl-dialog__actions padding-x-xlarge padding-bottom-xlarge flex gap-medium justify-end">
          <button type="button" class="rsl-button rsl-button--secondary foundation-web-button relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer flex items-center justify-center stroke-none padding-y-none select-none radius-medium text-label-large height-1200 padding-x-medium bg-action-standard content-action-standard" data-rsl-close>
            <div aria-hidden="true" data-testid="foundation-web-state-layer" class="absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none"></div>
            <span class="flex items-center min-width-0 gap-small"><span class="padding-y-xsmall text-truncate-end text-no-wrap">Cancel</span></span>
          </button>
          <button type="submit" form="rsl-shortcut-form" class="rsl-button rsl-button--primary foundation-web-button relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer flex items-center justify-center stroke-none padding-y-none select-none radius-medium text-label-large height-1200 padding-x-medium bg-action-emphasis content-action-emphasis">
            <div aria-hidden="true" data-testid="foundation-web-state-layer" class="absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none"></div>
            <span class="flex items-center min-width-0 gap-small"><span class="padding-y-xsmall text-truncate-end text-no-wrap">Add shortcut</span></span>
          </button>
        </div>
      </div>
    `;

    dialog.setAttribute("aria-labelledby", "rsl-dialog-title");
    dialog.setAttribute("aria-describedby", "rsl-dialog-description");

    const form = dialog.querySelector("form");
    const error = dialog.querySelector(".rsl-error");

    dialog.querySelectorAll("[data-rsl-close]").forEach((button) => {
      button.addEventListener("click", () => dialog.close());
    });

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        dialog.close();
      }
    });

    dialog.addEventListener("close", () => {
      const focusTarget = lastFocusedElement?.isConnected
        ? lastFocusedElement
        : document.querySelector(`#${ADD_ROW_ID} a, #${ADD_ROW_ID} button`);
      focusTarget?.focus?.({ preventScroll: true });
      lastFocusedElement = null;
      error.textContent = "";
      queueMount();
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.textContent = "";

      if (shortcuts.length >= MAX_SHORTCUTS) {
        error.textContent = `You can add up to ${MAX_SHORTCUTS} shortcuts.`;
        return;
      }

      const data = new FormData(form);
      const label = String(data.get("label") || "").trim();

      if (!label) {
        error.textContent = "Enter a name.";
        return;
      }

      try {
        const url = normalizeUrl(String(data.get("url") || ""));
        shortcuts = [...shortcuts, { id: createId(), label, url }];
        await storageSet(shortcuts);
        form.reset();
        renderManager();
        mountSidebar();
        form.elements.label.focus();
      } catch (problem) {
        error.textContent = problem instanceof Error ? problem.message : "Could not add that link.";
      }
    });

    document.body.append(dialog);
    return dialog;
  }

  function clearDragIndicators() {
    document.querySelectorAll(
      ".rsl-manager__item--dragging, .rsl-manager__item--drop-before, .rsl-manager__item--drop-after"
    ).forEach((item) => {
      item.classList.remove(
        "rsl-manager__item--dragging",
        "rsl-manager__item--drop-before",
        "rsl-manager__item--drop-after"
      );
    });
  }

  async function moveShortcut(fromIndex, toIndex, focusAction = "") {
    if (
      fromIndex < 0 ||
      fromIndex >= shortcuts.length ||
      toIndex < 0 ||
      toIndex >= shortcuts.length ||
      fromIndex === toIndex
    ) {
      return;
    }

    const reordered = [...shortcuts];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    shortcuts = reordered;

    renderManager();
    mountSidebar();

    const dialog = document.getElementById(DIALOG_ID);
    const status = dialog?.querySelector("[data-rsl-reorder-status]");
    if (status) {
      status.textContent = `Moved ${moved.label} to position ${toIndex + 1} of ${shortcuts.length}.`;
    }

    if (focusAction) {
      dialog
        ?.querySelector(
          `[data-rsl-manager-shortcut-id="${CSS.escape(moved.id)}"] [data-rsl-action="${focusAction}"]`
        )
        ?.focus();
    }

    await storageSet(shortcuts);
  }

  function renderManager() {
    const dialog = document.getElementById(DIALOG_ID);
    const list = dialog?.querySelector(".rsl-manager__list");
    if (!list) {
      return;
    }

    list.replaceChildren();

    if (shortcuts.length === 0) {
      const empty = document.createElement("p");
      empty.className = "rsl-manager__empty content-default text-body-medium";
      empty.textContent = "No shortcuts yet.";
      list.append(empty);
      return;
    }

    shortcuts.forEach((shortcut, index) => {
      const item = document.createElement("div");
      item.className = "rsl-manager__item bg-surface-0 radius-medium";
      item.dataset.rslManagerShortcutId = shortcut.id;
      item.setAttribute("role", "listitem");
      item.setAttribute("aria-posinset", String(index + 1));
      item.setAttribute("aria-setsize", String(shortcuts.length));

      const dragHandle = document.createElement("span");
      dragHandle.className = "rsl-drag-handle content-action-utility radius-medium";
      dragHandle.draggable = true;
      dragHandle.textContent = "⠿";
      dragHandle.title = `Drag to reorder ${shortcut.label}`;
      dragHandle.setAttribute("aria-hidden", "true");

      dragHandle.addEventListener("dragstart", (event) => {
        draggedShortcutId = shortcut.id;
        item.classList.add("rsl-manager__item--dragging");
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", shortcut.id);
        }
      });

      dragHandle.addEventListener("dragend", () => {
        draggedShortcutId = null;
        clearDragIndicators();
      });

      item.addEventListener("dragover", (event) => {
        if (!draggedShortcutId || draggedShortcutId === shortcut.id) {
          return;
        }

        event.preventDefault();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = "move";
        }

        const placeAfter = event.clientY > item.getBoundingClientRect().top + item.offsetHeight / 2;
        item.classList.toggle("rsl-manager__item--drop-before", !placeAfter);
        item.classList.toggle("rsl-manager__item--drop-after", placeAfter);
      });

      item.addEventListener("dragleave", () => {
        item.classList.remove(
          "rsl-manager__item--drop-before",
          "rsl-manager__item--drop-after"
        );
      });

      item.addEventListener("drop", (event) => {
        event.preventDefault();
        const draggedId = draggedShortcutId || event.dataTransfer?.getData("text/plain");
        const fromIndex = shortcuts.findIndex((entry) => entry.id === draggedId);
        const targetIndex = shortcuts.findIndex((entry) => entry.id === shortcut.id);
        const placeAfter = event.clientY > item.getBoundingClientRect().top + item.offsetHeight / 2;

        clearDragIndicators();
        draggedShortcutId = null;

        if (fromIndex < 0 || targetIndex < 0) {
          return;
        }

        let insertionIndex = targetIndex + (placeAfter ? 1 : 0);
        if (fromIndex < insertionIndex) {
          insertionIndex -= 1;
        }
        insertionIndex = Math.max(0, Math.min(insertionIndex, shortcuts.length - 1));
        void moveShortcut(fromIndex, insertionIndex);
      });

      const text = document.createElement("div");
      text.className = "rsl-manager__text";

      const name = document.createElement("strong");
      name.textContent = shortcut.label;

      const url = document.createElement("span");
      url.textContent = shortcut.url;
      url.title = shortcut.url;

      const controls = document.createElement("div");
      controls.className = "rsl-manager__controls";
      controls.setAttribute("role", "group");
      controls.setAttribute("aria-label", `Actions for ${shortcut.label}`);

      const moveUp = document.createElement("button");
      moveUp.className = "rsl-order-button content-action-utility radius-medium";
      moveUp.type = "button";
      moveUp.textContent = "↑";
      moveUp.dataset.rslAction = "up";
      moveUp.setAttribute("aria-disabled", String(index === 0));
      moveUp.setAttribute("aria-label", `Move ${shortcut.label} up`);
      moveUp.title = "Move up";
      moveUp.addEventListener("click", () => {
        if (index > 0) {
          void moveShortcut(index, index - 1, "up");
        }
      });

      const moveDown = document.createElement("button");
      moveDown.className = "rsl-order-button content-action-utility radius-medium";
      moveDown.type = "button";
      moveDown.textContent = "↓";
      moveDown.dataset.rslAction = "down";
      moveDown.setAttribute("aria-disabled", String(index === shortcuts.length - 1));
      moveDown.setAttribute("aria-label", `Move ${shortcut.label} down`);
      moveDown.title = "Move down";
      moveDown.addEventListener("click", () => {
        if (index < shortcuts.length - 1) {
          void moveShortcut(index, index + 1, "down");
        }
      });

      const remove = document.createElement("button");
      remove.className =
        "rsl-button rsl-button--danger foundation-web-button relative clip " +
        "group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer " +
        "flex items-center justify-center stroke-none padding-y-none select-none radius-medium " +
        "text-label-medium height-1000 padding-x-medium bg-action-standard content-action-standard";
      remove.type = "button";
      remove.innerHTML =
        '<div aria-hidden="true" data-testid="foundation-web-state-layer" ' +
        'class="absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] ' +
        'group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none"></div>' +
        '<span class="flex items-center min-width-0 gap-small"><span class="padding-y-xsmall ' +
        'text-truncate-end text-no-wrap">Remove</span></span>';
      remove.setAttribute("aria-label", `Remove ${shortcut.label}`);
      remove.addEventListener("click", async () => {
        shortcuts = shortcuts.filter((entry) => entry.id !== shortcut.id);
        await storageSet(shortcuts);
        renderManager();
        mountSidebar();
      });

      text.append(name, url);
      controls.append(moveUp, moveDown, remove);
      item.append(dragHandle, text, controls);
      list.append(item);
    });
  }

  function openDialog() {
    let dialog = document.getElementById(DIALOG_ID);
    if (!dialog) {
      dialog = createDialog();
    }

    if (dialog.open) {
      dialog.querySelector("input[name='label']")?.focus();
      return;
    }

    lastFocusedElement = document.activeElement;
    renderManager();
    dialog.showModal();
    dialog.querySelector("input[name='label']")?.focus();
  }

  let extensionUpdateFeedbackRequestId = 0;
  let extensionUpdateSettingsRequestId = 0;
  let extensionUpdateFeedbackRequestPromise = null;
  let extensionUpdateStatusTimer = null;
  let extensionUpdateStatusTimerDueAt = 0;
  let extensionUpdateStatusSnapshot = null;
  let extensionUpdateFeedbackPositionFrame = null;
  let extensionUpdateFeedbackNativeObserver = null;
  let extensionUpdateFeedbackObservedNativeSurfaces = new WeakSet();

  function normalizeExtensionUpdateVersion(value) {
    if (
      typeof value !== "string" ||
      !/^(?:0|[1-9]\d{0,8})\.(?:0|[1-9]\d{0,8})\.(?:0|[1-9]\d{0,8})$/.test(value)
    ) {
      return null;
    }
    return value;
  }

  function compareExtensionUpdateVersions(left, right) {
    const normalizedLeft = normalizeExtensionUpdateVersion(left);
    const normalizedRight = normalizeExtensionUpdateVersion(right);
    if (!normalizedLeft || !normalizedRight) {
      return 0;
    }

    const leftParts = normalizedLeft.split(".").map(Number);
    const rightParts = normalizedRight.split(".").map(Number);
    for (let index = 0; index < leftParts.length; index += 1) {
      if (leftParts[index] !== rightParts[index]) {
        return leftParts[index] > rightParts[index] ? 1 : -1;
      }
    }
    return 0;
  }

  function getInstalledExtensionVersion() {
    try {
      return normalizeExtensionUpdateVersion(
        chrome.runtime.getManifest?.().version
      );
    } catch {
      return null;
    }
  }

  function sendExtensionUpdateMessage(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(
            response && typeof response === "object" ? response : null
          );
        });
      } catch {
        resolve(null);
      }
    });
  }

  function normalizeExtensionUpdateTimestamp(value, allowNull = false) {
    if (allowNull && value === null) {
      return null;
    }
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }

  function normalizeExtensionUpdateStatus(status) {
    if (!status || typeof status !== "object" || status.ok !== true) {
      return null;
    }
    const current = normalizeExtensionUpdateVersion(status.current);
    const installed = getInstalledExtensionVersion();
    const latest = normalizeExtensionUpdateVersion(status.latest);
    if (
      !current ||
      installed !== current ||
      (status.latest !== null && !latest) ||
      typeof status.updateAvailable !== "boolean" ||
      typeof status.showNotice !== "boolean"
    ) {
      return null;
    }
    const updateAvailable = Boolean(
      latest && compareExtensionUpdateVersions(latest, current) > 0
    );
    if (status.updateAvailable !== updateAvailable) {
      return null;
    }
    const checkedAt = normalizeExtensionUpdateTimestamp(
      status.checkedAt,
      true
    );
    if (status.checkedAt !== null && checkedAt === null) {
      return null;
    }
    const nextCheckAt = normalizeExtensionUpdateTimestamp(status.nextCheckAt);
    const nextNoticeAt = normalizeExtensionUpdateTimestamp(
      status.nextNoticeAt,
      true
    );
    if (
      nextCheckAt === null ||
      (updateAvailable && nextNoticeAt === null) ||
      (!updateAvailable && status.nextNoticeAt !== null)
    ) {
      return null;
    }
    return Object.freeze({
      ok: true,
      current,
      latest,
      updateAvailable,
      showNotice: updateAvailable && status.showNotice === true,
      checkedAt,
      nextNoticeAt,
      nextCheckAt
    });
  }

  function renderFeatureSettingsUpdateStatus(
    dialog = document.getElementById(FEATURE_SETTINGS_DIALOG_ID)
  ) {
    const update = dialog?.querySelector?.(
      "[data-rsl-feature-settings-update]"
    );
    const message = update?.querySelector?.(
      "[data-rsl-feature-settings-update-message]"
    );
    if (!update || !message) {
      return;
    }
    const latest = extensionUpdateStatusSnapshot?.updateAvailable
      ? extensionUpdateStatusSnapshot.latest
      : null;
    if (!latest) {
      update.hidden = true;
      update.removeAttribute("data-rsl-extension-update-version");
      if (message.textContent) {
        message.textContent = "";
      }
      return;
    }
    if (
      update.getAttribute("data-rsl-extension-update-version") !== latest
    ) {
      message.textContent = `RoTool ${latest} is available.`;
      update.setAttribute("data-rsl-extension-update-version", latest);
    }
    update.hidden = false;
  }

  function applyExtensionUpdateStatus(status) {
    const normalized = normalizeExtensionUpdateStatus(status);
    if (!normalized) {
      return null;
    }
    const previous = extensionUpdateStatusSnapshot;
    if (
      previous &&
      Number.isSafeInteger(previous.checkedAt) &&
      Number.isSafeInteger(normalized.checkedAt)
    ) {
      if (normalized.checkedAt < previous.checkedAt) {
        return previous;
      }
      if (
        normalized.checkedAt === previous.checkedAt &&
        previous.latest &&
        (
          !normalized.latest ||
          compareExtensionUpdateVersions(previous.latest, normalized.latest) > 0
        )
      ) {
        return previous;
      }
    }
    if (
      previous?.updateAvailable &&
      normalized.latest === null &&
      normalized.checkedAt === null
    ) {
      return previous;
    }
    extensionUpdateStatusSnapshot = normalized;
    renderFeatureSettingsUpdateStatus();
    return normalized;
  }

  async function refreshFeatureSettingsUpdateStatus() {
    if (window.top !== window) {
      return null;
    }
    const requestId = ++extensionUpdateSettingsRequestId;
    const response = await sendExtensionUpdateMessage({
      type: EXTENSION_UPDATE_STATUS_MESSAGE_TYPE,
      pageVisible: document.visibilityState === "visible",
      claimNotice: false
    });
    if (requestId !== extensionUpdateSettingsRequestId || !response) {
      return null;
    }
    const normalized = applyExtensionUpdateStatus(response);
    renderFeatureSettingsUpdateStatus();
    return normalized;
  }

  function clearExtensionUpdateStatusTimer(resetDueAt = true) {
    if (extensionUpdateStatusTimer !== null) {
      window.clearTimeout(extensionUpdateStatusTimer);
      extensionUpdateStatusTimer = null;
    }
    if (resetDueAt) {
      extensionUpdateStatusTimerDueAt = 0;
    }
  }

  function replaceExtensionUpdateStatusTimer(nextAt) {
    const now = Date.now();
    const requestedAt = normalizeExtensionUpdateTimestamp(nextAt) ||
      now + EXTENSION_UPDATE_STATUS_RETRY_MS;
    const dueAt = Math.min(
      Math.max(requestedAt, now + EXTENSION_UPDATE_STATUS_MIN_TIMER_MS),
      now + EXTENSION_UPDATE_STATUS_MAX_TIMER_MS
    );
    clearExtensionUpdateStatusTimer(false);
    extensionUpdateStatusTimerDueAt = dueAt;
    extensionUpdateStatusTimer = window.setTimeout(() => {
      extensionUpdateStatusTimer = null;
      if (document.visibilityState !== "visible") {
        return;
      }
      extensionUpdateStatusTimerDueAt = 0;
      void refreshExtensionUpdateFeedback();
    }, dueAt - now);
  }

  function scheduleExtensionUpdateStatusTimer(status) {
    const candidates = [status?.nextCheckAt];
    if (status?.updateAvailable) {
      candidates.push(status.nextNoticeAt);
    }
    const validCandidates = candidates.filter(
      (value) => normalizeExtensionUpdateTimestamp(value) !== null
    );
    replaceExtensionUpdateStatusTimer(
      validCandidates.length > 0
        ? Math.min(...validCandidates)
        : Date.now() + EXTENSION_UPDATE_STATUS_RETRY_MS
    );
  }

  function removeExtensionUpdateFeedback() {
    document.getElementById(EXTENSION_UPDATE_FEEDBACK_ID)?.remove();
    if (extensionUpdateFeedbackPositionFrame !== null) {
      window.cancelAnimationFrame(extensionUpdateFeedbackPositionFrame);
      extensionUpdateFeedbackPositionFrame = null;
    }
    extensionUpdateFeedbackNativeObserver?.disconnect();
    extensionUpdateFeedbackNativeObserver = null;
    extensionUpdateFeedbackObservedNativeSurfaces = new WeakSet();
  }

  function observeNativeSystemFeedback() {
    if (!extensionUpdateFeedbackNativeObserver) {
      extensionUpdateFeedbackNativeObserver = new MutationObserver(() => {
        queueExtensionUpdateFeedbackPositionSync();
      });
    }

    document.querySelectorAll(".alert-system-feedback").forEach((inner) => {
      const surface = inner.closest?.(".sg-system-feedback") || inner;
      if (
        surface.id === EXTENSION_UPDATE_FEEDBACK_ID ||
        extensionUpdateFeedbackObservedNativeSurfaces.has(surface)
      ) {
        return;
      }
      extensionUpdateFeedbackObservedNativeSurfaces.add(surface);
      extensionUpdateFeedbackNativeObserver.observe(surface, {
        attributes: true,
        attributeFilter: ["class", "hidden", "style"],
        childList: true,
        subtree: true
      });
    });
  }

  function hasNativeExtensionUpdateFeedbackStyles(inner, alert, closeControl) {
    if (typeof window.getComputedStyle !== "function") {
      return false;
    }

    try {
      const innerStyle = window.getComputedStyle(inner);
      const alertStyle = window.getComputedStyle(alert);
      const closeStyle = window.getComputedStyle(closeControl);
      const alertHeight = Number.parseFloat(alertStyle.height);
      const alertFontSize = Number.parseFloat(alertStyle.fontSize);
      const closeWidth = Number.parseFloat(closeStyle.width);
      const closeHeight = Number.parseFloat(closeStyle.height);
      return (
        innerStyle.position === "relative" &&
        alertStyle.position === "fixed" &&
        Number.isFinite(alertHeight) &&
        alertHeight >= 44 &&
        alertHeight <= 52 &&
        Number.isFinite(alertFontSize) &&
        alertFontSize >= 18 &&
        typeof alertStyle.backgroundColor === "string" &&
        alertStyle.backgroundColor !== "" &&
        alertStyle.backgroundColor !== "transparent" &&
        alertStyle.backgroundColor !== "rgba(0, 0, 0, 0)" &&
        typeof closeStyle.backgroundImage === "string" &&
        closeStyle.backgroundImage !== "" &&
        closeStyle.backgroundImage !== "none" &&
        Number.isFinite(closeWidth) &&
        closeWidth >= 16 &&
        closeWidth <= 24 &&
        Number.isFinite(closeHeight) &&
        closeHeight >= 16 &&
        closeHeight <= 24
      );
    } catch {
      return false;
    }
  }

  function isActiveNativeSystemFeedbackAlert(nativeAlert) {
    if (!nativeAlert || nativeAlert.isConnected === false) {
      return false;
    }
    const nativeSurface =
      nativeAlert.closest?.(".sg-system-feedback") ||
      nativeAlert.closest?.(".alert-system-feedback");
    if (
      !nativeSurface ||
      nativeSurface.id === EXTENSION_UPDATE_FEEDBACK_ID ||
      nativeAlert.closest?.(`#${EXTENSION_UPDATE_FEEDBACK_ID}`) ||
      nativeSurface.isConnected === false ||
      nativeSurface.hidden ||
      nativeAlert.hidden ||
      nativeAlert.closest?.("[hidden]")
    ) {
      return false;
    }

    try {
      if (typeof window.getComputedStyle === "function") {
        const surfaceStyle = window.getComputedStyle(nativeSurface);
        const alertStyle = window.getComputedStyle(nativeAlert);
        if (
          surfaceStyle.display === "none" ||
          surfaceStyle.visibility === "hidden" ||
          alertStyle.display === "none" ||
          alertStyle.visibility === "hidden"
        ) {
          return false;
        }
      }
      const alertRect = nativeAlert.getBoundingClientRect();
      return (
        alertRect.width > 0 &&
        alertRect.height > 0 &&
        alertRect.bottom > 0 &&
        alertRect.top < window.innerHeight
      );
    } catch {
      return false;
    }
  }

  function syncExtensionUpdateFeedbackPosition() {
    const feedback = document.getElementById(EXTENSION_UPDATE_FEEDBACK_ID);
    if (!feedback) {
      return;
    }

    observeNativeSystemFeedback();
    const shouldDefer = Array.from(
      document.querySelectorAll(
        ".alert-system-feedback .alert.on"
      )
    ).some(isActiveNativeSystemFeedbackAlert);
    if (feedback.hidden !== shouldDefer) {
      feedback.hidden = shouldDefer;
    }
  }

  function enableExtensionUpdateFeedbackFallback(
    feedback,
    inner,
    alert,
    closeControl
  ) {
    if (
      !hasNativeExtensionUpdateFeedbackStyles(inner, alert, closeControl)
    ) {
      feedback.className += ` ${EXTENSION_UPDATE_FEEDBACK_FALLBACK_CLASS}`;
    }
  }

  function queueExtensionUpdateFeedbackPositionSync() {
    if (
      extensionUpdateFeedbackPositionFrame !== null ||
      !document.getElementById(EXTENSION_UPDATE_FEEDBACK_ID)
    ) {
      return;
    }
    extensionUpdateFeedbackPositionFrame = window.requestAnimationFrame(() => {
      extensionUpdateFeedbackPositionFrame = null;
      syncExtensionUpdateFeedbackPosition();
    });
  }

  function renderExtensionUpdateFeedback(status) {
    const current = normalizeExtensionUpdateVersion(status?.current);
    const latest = normalizeExtensionUpdateVersion(status?.latest);
    const installed = getInstalledExtensionVersion();
    const shouldShow =
      status?.ok === true &&
      status?.updateAvailable === true &&
      status?.showNotice === true &&
      current !== null &&
      latest !== null &&
      compareExtensionUpdateVersions(latest, current) > 0 &&
      installed === current &&
      window.top === window;

    if (!shouldShow) {
      removeExtensionUpdateFeedback();
      return null;
    }

    const existing = document.getElementById(EXTENSION_UPDATE_FEEDBACK_ID);
    if (existing?.dataset.rslExtensionUpdateVersion === latest) {
      queueExtensionUpdateFeedbackPositionSync();
      return existing;
    }
    if (existing) {
      removeExtensionUpdateFeedback();
    }

    const feedback = document.createElement("div");
    feedback.id = EXTENSION_UPDATE_FEEDBACK_ID;
    feedback.className =
      "sg-system-feedback rsl-extension-update-feedback";
    feedback.dataset.rslExtensionUpdateVersion = latest;

    const inner = document.createElement("div");
    inner.className =
      "alert-system-feedback rsl-extension-update-feedback__inner";

    const alert = document.createElement("div");
    alert.className =
      "alert alert-success on rsl-extension-update-feedback__alert";
    alert.setAttribute("role", "status");
    alert.setAttribute("aria-live", "polite");
    alert.setAttribute("aria-atomic", "true");

    const content = document.createElement("span");
    content.className =
      "alert-content rsl-extension-update-feedback__content";
    content.append(document.createTextNode(`RoTool ${latest} is available. `));

    const howToUpdate = document.createElement("a");
    howToUpdate.className = "rsl-extension-update-feedback__link";
    howToUpdate.href = EXTENSION_UPDATE_HOW_TO_URL;
    howToUpdate.target = "_blank";
    howToUpdate.rel = "noopener noreferrer";
    howToUpdate.referrerPolicy = "no-referrer";
    howToUpdate.textContent = "How to update";
    content.append(howToUpdate);

    const closeControl = document.createElement("span");
    closeControl.className =
      "icon-close-white rsl-extension-update-feedback__close";
    closeControl.setAttribute("role", "button");
    closeControl.setAttribute("tabindex", "0");
    closeControl.title = "Dismiss";
    closeControl.setAttribute(
      "aria-label",
      `Dismiss RoTool ${latest} update notice`
    );
    closeControl.addEventListener("click", (event) => {
      if (!event.isTrusted) {
        return;
      }
      removeExtensionUpdateFeedback();
    });
    closeControl.addEventListener("keydown", (event) => {
      if (
        !event.isTrusted ||
        (event.key !== "Enter" && event.key !== " ")
      ) {
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
      }
      removeExtensionUpdateFeedback();
    });

    alert.append(content, closeControl);
    inner.append(alert);
    feedback.append(inner);
    feedback.hidden = true;
    (document.body || document.documentElement).append(feedback);
    enableExtensionUpdateFeedbackFallback(
      feedback,
      inner,
      alert,
      closeControl
    );
    syncExtensionUpdateFeedbackPosition();
    return feedback;
  }

  function refreshExtensionUpdateFeedback() {
    if (window.top !== window) {
      removeExtensionUpdateFeedback();
      clearExtensionUpdateStatusTimer();
      return Promise.resolve(null);
    }
    if (extensionUpdateFeedbackRequestPromise) {
      return extensionUpdateFeedbackRequestPromise;
    }

    const requestId = ++extensionUpdateFeedbackRequestId;
    const request = (async () => {
      const response = await sendExtensionUpdateMessage({
        type: EXTENSION_UPDATE_STATUS_MESSAGE_TYPE,
        pageVisible: document.visibilityState === "visible",
        claimNotice: true
      });
      if (requestId !== extensionUpdateFeedbackRequestId) {
        return null;
      }
      if (!response) {
        replaceExtensionUpdateStatusTimer(
          Date.now() + EXTENSION_UPDATE_STATUS_RETRY_MS
        );
        return null;
      }
      const normalized = applyExtensionUpdateStatus(response);
      if (!normalized) {
        replaceExtensionUpdateStatusTimer(
          Date.now() + EXTENSION_UPDATE_STATUS_RETRY_MS
        );
        return null;
      }

      if (!normalized.updateAvailable) {
        removeExtensionUpdateFeedback();
      } else if (normalized.showNotice) {
        renderExtensionUpdateFeedback(normalized);
      } else {
        const existing = document.getElementById(
          EXTENSION_UPDATE_FEEDBACK_ID
        );
        if (
          existing &&
          existing.dataset.rslExtensionUpdateVersion !== normalized.latest
        ) {
          removeExtensionUpdateFeedback();
        }
      }
      scheduleExtensionUpdateStatusTimer(normalized);
      return normalized;
    })();
    const tracked = request.finally(() => {
      if (extensionUpdateFeedbackRequestPromise === tracked) {
        extensionUpdateFeedbackRequestPromise = null;
      }
    });
    extensionUpdateFeedbackRequestPromise = tracked;
    return tracked;
  }

  function requestExtensionUpdateStatusWhenVisible() {
    if (document.visibilityState !== "visible") {
      return;
    }
    const now = Date.now();
    if (extensionUpdateFeedbackRequestPromise) {
      return;
    }
    if (extensionUpdateStatusTimerDueAt > now) {
      if (extensionUpdateStatusTimer === null) {
        replaceExtensionUpdateStatusTimer(extensionUpdateStatusTimerDueAt);
      }
      return;
    }
    clearExtensionUpdateStatusTimer();
    void refreshExtensionUpdateFeedback();
  }

  function isInsideRoToolDialog(node) {
    const element = node?.nodeType === Node.ELEMENT_NODE
      ? node
      : node?.parentElement;
    return Boolean(element?.closest?.(".rsl-dialog"));
  }

  function isInsideRoToolMountIgnoredSurface(node) {
    const element = node?.nodeType === Node.ELEMENT_NODE
      ? node
      : node?.parentElement;
    if (
      typeof isBestFriendsTransientPlacementOverlay === "function" &&
      isBestFriendsTransientPlacementOverlay(element)
    ) {
      return true;
    }
    return Boolean(
      element?.closest?.(
        ".rsl-dialog, [data-rsl-best-friend-hover-card], " +
          "[data-rsl-friends-filters-menu], " +
          "[data-rsl-game-ccu-graph-overlay]"
      )
    );
  }

  function isInsideRoToolOwnedMountContent(node) {
    const element = node?.nodeType === Node.ELEMENT_NODE
      ? node
      : node?.parentElement;
    return Boolean(
      element?.closest?.(
        `[data-rsl-best-friends-carousel], [${NATIVE_EVENT_SCHEDULE_ATTRIBUTE}]`
      )
    );
  }

  function mutationsAffectExtensionMount(mutations) {
    return mutations.some((mutation) => {
      if (mutation.type === "characterData") {
        return false;
      }
      if (
        isInsideRoToolMountIgnoredSurface(mutation.target) ||
        isInsideRoToolOwnedMountContent(mutation.target)
      ) {
        return false;
      }
      const changedNodes = [
        ...Array.from(mutation.addedNodes || []),
        ...Array.from(mutation.removedNodes || [])
      ];
      return (
        changedNodes.length === 0 ||
        changedNodes.some(
          (node) => !isInsideRoToolMountIgnoredSurface(node)
        )
      );
    });
  }

  function initialize() {
    // Mount immediately so a delayed or unavailable storage response can never
    // prevent the Add Shortcut row from appearing.
    mountExtensionFeatures();

    const observer = new MutationObserver((mutations) => {
      if (document.getElementById(EXTENSION_UPDATE_FEEDBACK_ID)) {
        queueExtensionUpdateFeedbackPositionSync();
      }
      if (
        privateServersDialogOpener &&
        (!privateServersDialogOpener.isConnected ||
          !isQuickPlayButtonCurrent(
            privateServersDialogOpener,
            privateServersPlaceId
          ))
      ) {
        closePrivateServersDialog(false);
      }
      invalidateStaleGameTileCcuControls(mutations);
      invalidateStaleQuickPlayControls(mutations);
      if (mutationsAffectExtensionMount(mutations)) {
        queueMount();
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href"]
    });
    window.addEventListener("hashchange", () => {
      closeBestFriendHoverCard();
      closePrivateServersDialog(false);
      clearGameTileCcuGraphHoverIntent();
      queueMount();
    });
    window.addEventListener("popstate", () => {
      closeBestFriendHoverCard();
      closePrivateServersDialog(false);
      clearGameTileCcuGraphHoverIntent();
      queueMount();
    });
    window.addEventListener("resize", () => {
      queueExtensionUpdateFeedbackPositionSync();
      closeBestFriendHoverCard();
      bestFriendsScrollLockUntil = 0;
      window.clearTimeout(bestFriendsScrollSettleTimer);
      bestFriendsScrollSettleTimer = null;
      queueMount();
    }, { passive: true });
    window.addEventListener("scroll", (event) => {
      if (isInsideRoToolDialog(event.target)) {
        return;
      }
      bestFriendsScrollLockUntil = Date.now() + BEST_FRIENDS_SCROLL_SETTLE_MS;
      closeBestFriendHoverCard();
      window.clearTimeout(bestFriendsScrollSettleTimer);
      bestFriendsScrollSettleTimer = window.setTimeout(() => {
        bestFriendsScrollLockUntil = 0;
        bestFriendsScrollSettleTimer = null;
        queueMount();
      }, BEST_FRIENDS_SCROLL_SETTLE_MS);
    }, {
      capture: true,
      passive: true
    });
    document.addEventListener(
      "pointerdown",
      handleBestFriendHoverOutsidePointerDown,
      true
    );
    document.addEventListener("keydown", handleBestFriendHoverEscape, true);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        closeBestFriendHoverCard();
        return;
      }
      requestExtensionUpdateStatusWhenVisible();
      refreshBestFriendsHomeIfStale();
    });
    document.addEventListener(
      BEST_FRIEND_ACTION_RESULT_EVENT,
      handleBestFriendActionResult
    );
    document.addEventListener(QUICK_PLAY_RESULT_EVENT, handleQuickPlayResult);
    document.addEventListener(
      QUICK_PLAY_RANDOM_REQUEST_EVENT,
      handleRandomServerRequest
    );

    requestExtensionUpdateStatusWhenVisible();

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") {
        return;
      }

      let changed = false;
      if (changes[FEATURE_SETTINGS_STORAGE_KEY]) {
        featureSettingsLoadGeneration += 1;
        const nextSettings = normalizeFeatureSettings(
          changes[FEATURE_SETTINGS_STORAGE_KEY].newValue
        );
        if (featureSettingsPendingWrites > 0) {
          featureSettingsDeferredStorageValue = nextSettings;
        } else if (!featureSettingsEqual(featureSettings, nextSettings)) {
          featureSettings = nextSettings;
          featureSettingsConfirmed = { ...nextSettings };
          if (featureSettingsLoaded) {
            scheduleFeatureSettingsReconcile();
          }
          renderFeatureSettingsDialog();
        }
      }

      if (changes[QUICK_SETTINGS_COLLAPSED_STORAGE_KEY]) {
        quickSettingsCollapsedLoadGeneration += 1;
        const nextCollapsed =
          changes[QUICK_SETTINGS_COLLAPSED_STORAGE_KEY].newValue === true;
        if (quickSettingsCollapsedPendingWrites > 0) {
          quickSettingsCollapsedDeferredStorageValue = nextCollapsed;
        } else {
          applyQuickSettingsCollapsedStorageValue(nextCollapsed);
        }
      }

      if (changes[BEST_FRIENDS_COLLAPSED_STORAGE_KEY]) {
        bestFriendsCollapsedLoadGeneration += 1;
        const nextCollapsed =
          changes[BEST_FRIENDS_COLLAPSED_STORAGE_KEY].newValue === true;
        if (bestFriendsCollapsedPendingWrites > 0) {
          bestFriendsCollapsedDeferredStorageValue = nextCollapsed;
        } else {
          applyBestFriendsCollapsedStorageValue(nextCollapsed);
        }
      }

      if (changes[HOME_FRIENDS_COLLAPSED_STORAGE_KEY]) {
        homeFriendsCollapsedLoadGeneration += 1;
        const nextCollapsed =
          changes[HOME_FRIENDS_COLLAPSED_STORAGE_KEY].newValue === true;
        if (homeFriendsCollapsedPendingWrites > 0) {
          homeFriendsCollapsedDeferredStorageValue = nextCollapsed;
        } else {
          applyHomeFriendsCollapsedStorageValue(nextCollapsed);
        }
      }

      if (changes[STORAGE_KEY]) {
        const nextValue = changes[STORAGE_KEY].newValue;
        const nextShortcuts = Array.isArray(nextValue)
          ? nextValue.slice(0, MAX_SHORTCUTS)
          : [];
        if (!shortcutListsEqual(shortcuts, nextShortcuts)) {
          shortcuts = nextShortcuts;
          renderManager();
          changed = true;
        }
      }

      if (changes[BEST_FRIENDS_STORAGE_KEY]) {
        const storedByViewer = changes[BEST_FRIENDS_STORAGE_KEY].newValue;
        const nextIds = bestFriendsViewerUserId
          ? normalizeBestFriendIds(
              storedByViewer && typeof storedByViewer === "object"
                ? storedByViewer[bestFriendsViewerUserId]
                : []
            )
          : null;

        if (!nextIds || !bestFriendListsEqual(bestFriendUserIds, nextIds)) {
          bestFriendsRequestId += 1;
          bestFriendsRequestPromise = null;
          if (nextIds) {
            const detailsById = new Map(
              bestFriendDetails.map((friend) => [friend.userId, friend])
            );
            bestFriendUserIds = nextIds;
            bestFriendDetails = nextIds
              .map((userId) => detailsById.get(userId))
              .filter(Boolean);
          }
          bestFriendsLoadState = "idle";
          bestFriendsErrorCode = "";
          changed = true;

          if (
            isFeatureEnabled("bestFriends") &&
            (isHomePage() ||
            (isFriendsPage() &&
              activeFriendsPresenceFilter === BEST_FRIENDS_FILTER_VALUE))
          ) {
            void loadBestFriendsContext(true);
          }
        }
      }

      if (changed) {
        queueMount();
      }
    });

    const featureLoadGeneration = featureSettingsLoadGeneration;
    const collapsedLoadGeneration = quickSettingsCollapsedLoadGeneration;
    const bestFriendsCollapsedGeneration = bestFriendsCollapsedLoadGeneration;
    const homeFriendsCollapsedGeneration = homeFriendsCollapsedLoadGeneration;
    Promise.all([
      featureSettingsStorageGet().catch((error) => {
        console.error("[RoTool] Failed to load feature settings", error);
        return { ...DEFAULT_FEATURE_SETTINGS };
      }),
      quickSettingsCollapsedStorageGet().catch((error) => {
        console.error("[RoTool] Failed to load Quick Settings layout", error);
        return false;
      }),
      bestFriendsCollapsedStorageGet().catch((error) => {
        console.error("[RoTool] Failed to load Best Friends layout", error);
        return false;
      }),
      homeFriendsCollapsedStorageGet().catch((error) => {
        console.error("[RoTool] Failed to load Home Friends layout", error);
        return false;
      })
    ])
      .then(([
        storedFeatureSettings,
        storedCollapsed,
        storedBestFriendsCollapsed,
        storedHomeFriendsCollapsed
      ]) => {
        if (featureLoadGeneration === featureSettingsLoadGeneration) {
          featureSettings = storedFeatureSettings;
          featureSettingsConfirmed = { ...storedFeatureSettings };
        }
        if (collapsedLoadGeneration === quickSettingsCollapsedLoadGeneration) {
          quickSettingsCollapsed = storedCollapsed;
          quickSettingsCollapsedConfirmed = storedCollapsed;
        }
        if (
          bestFriendsCollapsedGeneration ===
          bestFriendsCollapsedLoadGeneration
        ) {
          bestFriendsCollapsed = storedBestFriendsCollapsed;
          bestFriendsCollapsedConfirmed = storedBestFriendsCollapsed;
        }
        if (
          homeFriendsCollapsedGeneration ===
          homeFriendsCollapsedLoadGeneration
        ) {
          homeFriendsCollapsed = storedHomeFriendsCollapsed;
          homeFriendsCollapsedConfirmed = storedHomeFriendsCollapsed;
        }
      })
      .finally(() => {
        featureSettingsLoaded = true;
        featureSettingsApplied = { ...featureSettings };
        renderFeatureSettingsDialog();
        mountExtensionFeatures();
      });

    storageGet()
      .then((storedShortcuts) => {
        shortcuts = storedShortcuts.filter((shortcut) =>
          shortcut &&
          typeof shortcut.id === "string" &&
          typeof shortcut.label === "string" &&
          typeof shortcut.url === "string"
        ).slice(0, MAX_SHORTCUTS);
        renderManager();
        mountExtensionFeatures();
      })
      .catch((error) => {
        console.error("[RoTool] Failed to load shortcuts", error);
      });
  }

  const contentTestHooks = globalThis.__rslContentTestHooks;
  if (contentTestHooks && typeof contentTestHooks === "object") {
    contentTestHooks.extensionUpdateFeedbackConstants = Object.freeze({
      feedbackId: EXTENSION_UPDATE_FEEDBACK_ID,
      fallbackClass: EXTENSION_UPDATE_FEEDBACK_FALLBACK_CLASS,
      howToUpdateUrl: EXTENSION_UPDATE_HOW_TO_URL,
      statusRetryMs: EXTENSION_UPDATE_STATUS_RETRY_MS,
      statusMinTimerMs: EXTENSION_UPDATE_STATUS_MIN_TIMER_MS,
      statusMaxTimerMs: EXTENSION_UPDATE_STATUS_MAX_TIMER_MS,
      messageTypes: Object.freeze({
        status: EXTENSION_UPDATE_STATUS_MESSAGE_TYPE
      })
    });
    contentTestHooks.normalizeExtensionUpdateVersion =
      normalizeExtensionUpdateVersion;
    contentTestHooks.compareExtensionUpdateVersions =
      compareExtensionUpdateVersions;
    contentTestHooks.renderExtensionUpdateFeedback =
      renderExtensionUpdateFeedback;
    contentTestHooks.hasNativeExtensionUpdateFeedbackStyles =
      hasNativeExtensionUpdateFeedbackStyles;
    contentTestHooks.isActiveNativeSystemFeedbackAlert =
      isActiveNativeSystemFeedbackAlert;
    contentTestHooks.syncExtensionUpdateFeedbackPosition =
      syncExtensionUpdateFeedbackPosition;
    contentTestHooks.removeExtensionUpdateFeedback =
      removeExtensionUpdateFeedback;
    contentTestHooks.refreshExtensionUpdateFeedback =
      refreshExtensionUpdateFeedback;
    contentTestHooks.normalizeExtensionUpdateStatus =
      normalizeExtensionUpdateStatus;
    contentTestHooks.applyExtensionUpdateStatus =
      applyExtensionUpdateStatus;
    contentTestHooks.renderFeatureSettingsUpdateStatus =
      renderFeatureSettingsUpdateStatus;
    contentTestHooks.refreshFeatureSettingsUpdateStatus =
      refreshFeatureSettingsUpdateStatus;
    contentTestHooks.scheduleExtensionUpdateStatusTimer =
      scheduleExtensionUpdateStatusTimer;
    contentTestHooks.requestExtensionUpdateStatusWhenVisible =
      requestExtensionUpdateStatusWhenVisible;
    contentTestHooks.resetExtensionUpdateStatusForTests = () => {
      extensionUpdateFeedbackRequestId += 1;
      extensionUpdateSettingsRequestId += 1;
      extensionUpdateFeedbackRequestPromise = null;
      extensionUpdateStatusSnapshot = null;
      clearExtensionUpdateStatusTimer();
      removeExtensionUpdateFeedback();
      renderFeatureSettingsUpdateStatus();
    };
    contentTestHooks.observePrivateServerSupport = observePrivateServerSupport;
    contentTestHooks.normalizeFeatureSettings = normalizeFeatureSettings;
    contentTestHooks.serializeFeatureSettings = serializeFeatureSettings;
    contentTestHooks.featureDefinitions = FEATURE_DEFINITIONS;
    contentTestHooks.featureSettingDefinitions = FEATURE_SETTING_DEFINITIONS;
    contentTestHooks.defaultFeatureSettings = DEFAULT_FEATURE_SETTINGS;
    contentTestHooks.gameEventsConstants = Object.freeze({
      dialogId: GAME_EVENTS_DIALOG_ID,
      rowId: GAME_EVENTS_ROW_ID,
      maxFavorites: GAME_EVENTS_MAX_FAVORITES,
      searchDebounceMs: GAME_EVENTS_SEARCH_DEBOUNCE_MS,
      messageTypes: Object.freeze({
        get: GAME_EVENTS_GET_MESSAGE_TYPE,
        search: GAME_EVENTS_SEARCH_MESSAGE_TYPE,
        add: GAME_EVENTS_ADD_MESSAGE_TYPE,
        remove: GAME_EVENTS_REMOVE_MESSAGE_TYPE
      })
    });
    contentTestHooks.joinSchedulerConstants = Object.freeze({
      rowId: JOIN_SCHEDULER_ROW_ID,
      modalGlobal: JOIN_SCHEDULER_MODAL_GLOBAL,
      gameEventScheduleAttribute: GAME_EVENTS_SCHEDULE_ATTRIBUTE
    });
    contentTestHooks.nativeEventScheduleConstants = Object.freeze({
      attribute: NATIVE_EVENT_SCHEDULE_ATTRIBUTE,
      dataMessageType: NATIVE_EVENT_SCHEDULE_DATA_MESSAGE_TYPE,
      cardSelector: NATIVE_EVENT_SCHEDULE_CARD_SELECTOR,
      featuredSelector: NATIVE_EVENT_SCHEDULE_FEATURED_SELECTOR,
      maxEventIds: NATIVE_EVENT_SCHEDULE_MAX_EVENT_IDS,
      localeSegments: Object.freeze(
        Array.from(NATIVE_EVENT_SCHEDULE_LOCALE_SEGMENTS)
      ),
      refreshMs: NATIVE_EVENT_SCHEDULE_REFRESH_MS,
      failureRetryMs: NATIVE_EVENT_SCHEDULE_FAILURE_RETRY_MS
    });
    contentTestHooks.normalizeGameEventId = normalizeGameEventId;
    contentTestHooks.normalizeGameEventTimestamp = normalizeGameEventTimestamp;
    contentTestHooks.normalizeGameEventFavorite = normalizeGameEventFavorite;
    contentTestHooks.normalizeGameEvent = normalizeGameEvent;
    contentTestHooks.normalizeGameEventsResponse = normalizeGameEventsResponse;
    contentTestHooks.getGameEventLocalDayOrdinal = getGameEventLocalDayOrdinal;
    contentTestHooks.formatGameEventDateGroupLabel = formatGameEventDateGroupLabel;
    contentTestHooks.getGameEventStatus = getGameEventStatus;
    contentTestHooks.filterGameEvents = filterGameEvents;
    contentTestHooks.compareGameEventTimelineOrder = compareGameEventTimelineOrder;
    contentTestHooks.groupGameEventsByDate = groupGameEventsByDate;
    contentTestHooks.formatGameEventTiming = formatGameEventTiming;
    contentTestHooks.formatGameEventAgendaMarker = formatGameEventAgendaMarker;
    contentTestHooks.getGameEventTimelineGap = getGameEventTimelineGap;
    contentTestHooks.getGameEventTimelineGapBefore = getGameEventTimelineGapBefore;
    contentTestHooks.getGameEventTimelineTailSpace = getGameEventTimelineTailSpace;
    contentTestHooks.getGameEventsTimelineNowPosition = getGameEventsTimelineNowPosition;
    contentTestHooks.refreshGameEventsTimelineNowMarker = refreshGameEventsTimelineNowMarker;
    contentTestHooks.renderGameEventsLiveSection = renderGameEventsLiveSection;
    contentTestHooks.syncGameEventsLiveSectionCollapse = syncGameEventsLiveSectionCollapse;
    contentTestHooks.normalizeGameEventSearchResult = normalizeGameEventSearchResult;
    contentTestHooks.isGameEventsSearchableQuery = isGameEventsSearchableQuery;
    contentTestHooks.queueGameEventsSearch = queueGameEventsSearch;
    contentTestHooks.searchGameEventFavorites = searchGameEventFavorites;
    contentTestHooks.clearGameEventsSearch = clearGameEventsSearch;
    contentTestHooks.selectGameEventsSearchResult = selectGameEventsSearchResult;
    contentTestHooks.makeGameEventsSidebarRow = makeGameEventsSidebarRow;
    contentTestHooks.placeGameEventsSidebarRow = placeGameEventsSidebarRow;
    contentTestHooks.mountGameEventsSidebarRow = mountGameEventsSidebarRow;
    contentTestHooks.makeJoinSchedulerSidebarRow = makeJoinSchedulerSidebarRow;
    contentTestHooks.placeJoinSchedulerSidebarRow = placeJoinSchedulerSidebarRow;
    contentTestHooks.mountJoinSchedulerSidebarRow = mountJoinSchedulerSidebarRow;
    contentTestHooks.openJoinScheduler = openJoinScheduler;
    contentTestHooks.parseNativeEventScheduleGamePagePlaceId =
      parseNativeEventScheduleGamePagePlaceId;
    contentTestHooks.getNativeEventSchedulePageMetadata =
      getNativeEventSchedulePageMetadata;
    contentTestHooks.parseNativeEventScheduleLinkId =
      parseNativeEventScheduleLinkId;
    contentTestHooks.getNativeEventScheduleCardIdentity =
      getNativeEventScheduleCardIdentity;
    contentTestHooks.collectNativeEventScheduleCardIdentities =
      collectNativeEventScheduleCardIdentities;
    contentTestHooks.normalizeNativeEventScheduleResponse =
      normalizeNativeEventScheduleResponse;
    contentTestHooks.makeNativeEventScheduleDraft =
      makeNativeEventScheduleDraft;
    contentTestHooks.isNativeEventScheduleButtonCurrent =
      isNativeEventScheduleButtonCurrent;
    contentTestHooks.reconcileNativeEventScheduleButtons =
      reconcileNativeEventScheduleButtons;
    contentTestHooks.loadNativeEventScheduleData =
      loadNativeEventScheduleData;
    contentTestHooks.mountNativeEventScheduleButtons =
      mountNativeEventScheduleButtons;
    contentTestHooks.cleanupNativeEventScheduleFeature =
      cleanupNativeEventScheduleFeature;
    contentTestHooks.setNativeEventScheduleMessageSenderForTests = (sender) => {
      nativeEventScheduleMessageSenderForTests =
        typeof sender === "function" ? sender : null;
    };
    contentTestHooks.getNativeEventScheduleStateForTests = () => ({
      lifecycleEpoch: nativeEventScheduleLifecycleEpoch,
      requestSequence: nativeEventScheduleRequestSequence,
      routePlaceId: nativeEventScheduleRoutePlaceId,
      cardFingerprint: nativeEventScheduleCardFingerprint,
      requestPending: nativeEventScheduleRequestPending,
      nextRefreshAt: nativeEventScheduleNextRefreshAt,
      events: Array.from(nativeEventScheduleItemsById.values())
    });
    contentTestHooks.resetNativeEventScheduleStateForTests = () => {
      cleanupNativeEventScheduleFeature();
      nativeEventScheduleRequestSequence = 0;
      nativeEventScheduleMessageSenderForTests = null;
    };
    contentTestHooks.createGameEventsDialog = createGameEventsDialog;
    contentTestHooks.openGameEventsDialog = openGameEventsDialog;
    contentTestHooks.closeGameEventsDialog = closeGameEventsDialog;
    contentTestHooks.renderGameEventsDialog = renderGameEventsDialog;
    contentTestHooks.loadGameEvents = loadGameEvents;
    contentTestHooks.addGameEventFavorite = addGameEventFavorite;
    contentTestHooks.removeGameEventFavorite = removeGameEventFavorite;
    contentTestHooks.refreshGameEventTimes = refreshGameEventTimes;
    contentTestHooks.cleanupGameEventsFeature = cleanupGameEventsFeature;
    contentTestHooks.setGameEventsMessageSenderForTests = (sender) => {
      gameEventsMessageSenderForTests = typeof sender === "function" ? sender : null;
    };
    contentTestHooks.getGameEventsStateForTests = () => ({
      lifecycleEpoch: gameEventsLifecycleEpoch,
      requestSequence: gameEventsRequestSequence,
      loadState: gameEventsLoadState,
      errorCode: gameEventsErrorCode,
      favorites: gameEventsFavorites.slice(),
      events: gameEventsItems.slice(),
      viewerUserId: gameEventsViewerUserId,
      partial: gameEventsPartial,
      statusFilter: gameEventsStatusFilter,
      liveSectionCollapsed: gameEventsLiveSectionCollapsed,
      pendingAction: gameEventsPendingAction,
      notice: gameEventsNotice,
      searchSequence: gameEventsSearchSequence,
      searchState: gameEventsSearchState,
      searchErrorCode: gameEventsSearchErrorCode,
      searchResults: gameEventsSearchResults.slice(),
      searchActiveIndex: gameEventsSearchActiveIndex,
      selectedSearchResult: gameEventsSelectedSearchResult
    });
    contentTestHooks.resetGameEventsStateForTests = () => {
      cleanupGameEventsFeature();
      gameEventsRequestSequence = 0;
      gameEventsMessageSenderForTests = null;
      gameEventsThumbnailByUniverseId.clear();
      gameEventsThumbnailRequestByUniverseId.clear();
      gameEventsThumbnailObserver?.disconnect();
      gameEventsThumbnailObserver = null;
    };
    contentTestHooks.serverHistoryConstants = Object.freeze({
      dialogId: SERVER_HISTORY_DIALOG_ID,
      rowId: SERVER_HISTORY_ROW_ID,
      limit: SERVER_HISTORY_LIMIT,
      messageTypes: Object.freeze({
        get: SERVER_HISTORY_GET_MESSAGE_TYPE,
        clear: SERVER_HISTORY_CLEAR_MESSAGE_TYPE,
        rejoin: SERVER_HISTORY_REJOIN_MESSAGE_TYPE
      })
    });
    contentTestHooks.normalizeServerHistoryOpaqueId =
      normalizeServerHistoryOpaqueId;
    contentTestHooks.normalizeServerHistoryTimestamp =
      normalizeServerHistoryTimestamp;
    contentTestHooks.normalizeServerHistorySession = normalizeServerHistorySession;
    contentTestHooks.normalizeServerHistoryResponse = normalizeServerHistoryResponse;
    contentTestHooks.getRobloxPageLocale = getRobloxPageLocale;
    contentTestHooks.formatServerHistoryTimestamp = formatServerHistoryTimestamp;
    contentTestHooks.formatServerHistoryDuration = formatServerHistoryDuration;
    contentTestHooks.formatServerHistoryCompactTimestamp =
      formatServerHistoryCompactTimestamp;
    contentTestHooks.formatServerHistoryCompactDuration =
      formatServerHistoryCompactDuration;
    contentTestHooks.formatServerHistoryRelativeLastSeen =
      formatServerHistoryRelativeLastSeen;
    contentTestHooks.getServerHistoryLocalDayOrdinal =
      getServerHistoryLocalDayOrdinal;
    contentTestHooks.formatServerHistoryDateGroupLabel =
      formatServerHistoryDateGroupLabel;
    contentTestHooks.groupServerHistorySessionsByDate =
      groupServerHistorySessionsByDate;
    contentTestHooks.makeServerHistorySidebarRow = makeServerHistorySidebarRow;
    contentTestHooks.placeServerHistorySidebarRow = placeServerHistorySidebarRow;
    contentTestHooks.mountServerHistorySidebarRow = mountServerHistorySidebarRow;
    contentTestHooks.createServerHistoryDialog = createServerHistoryDialog;
    contentTestHooks.openServerHistoryDialog = openServerHistoryDialog;
    contentTestHooks.closeServerHistoryDialog = closeServerHistoryDialog;
    contentTestHooks.renderServerHistoryDialog = renderServerHistoryDialog;
    contentTestHooks.loadServerHistory = loadServerHistory;
    contentTestHooks.rejoinServerHistorySession = rejoinServerHistorySession;
    contentTestHooks.clearServerHistory = clearServerHistory;
    contentTestHooks.cleanupServerHistoryFeature = cleanupServerHistoryFeature;
    contentTestHooks.setServerHistoryMessageSenderForTests = (sender) => {
      serverHistoryMessageSenderForTests = typeof sender === "function" ? sender : null;
    };
    contentTestHooks.getServerHistoryStateForTests = () => ({
      lifecycleEpoch: serverHistoryLifecycleEpoch,
      requestSequence: serverHistoryRequestSequence,
      loadState: serverHistoryLoadState,
      errorCode: serverHistoryErrorCode,
      sessions: serverHistorySessions.slice(),
      pendingRejoinId: serverHistoryPendingRejoinId,
      clearPending: serverHistoryClearPending,
      confirmClear: serverHistoryConfirmClear,
      notice: serverHistoryNotice
    });
    contentTestHooks.resetServerHistoryStateForTests = () => {
      cleanupServerHistoryFeature();
      serverHistoryRequestSequence = 0;
      serverHistoryMessageSenderForTests = null;
      serverHistoryThumbnailByUniverseId.clear();
      serverHistoryThumbnailRequestByUniverseId.clear();
    };
    contentTestHooks.syncNativeSidebarVisibility = syncNativeSidebarVisibility;
    contentTestHooks.cleanupNativeSidebarVisibility =
      cleanupNativeSidebarVisibility;
    contentTestHooks.isQuickSettingEnabled = isQuickSettingEnabled;
    contentTestHooks.getEnabledQuickSettingAliases =
      getEnabledQuickSettingAliases;
    contentTestHooks.renderQuickSettings = renderQuickSettings;
    contentTestHooks.loadQuickSettings = loadQuickSettings;
    contentTestHooks.cleanupQuickSettingsHome = cleanupQuickSettingsHome;
    contentTestHooks.isQuickPlayActionEnabled = isQuickPlayActionEnabled;
    contentTestHooks.makeQuickPlaySurface = makeQuickPlaySurface;
    contentTestHooks.cancelQueuedPrivateServerSupportRequests =
      cancelQueuedPrivateServerSupportRequests;
    contentTestHooks.mountFeatureSettingsButton = mountFeatureSettingsButton;
    contentTestHooks.openFeatureSettingsDialog = openFeatureSettingsDialog;
    contentTestHooks.setFeatureSettingsForTests = (rawValue) => {
      featureSettings = normalizeFeatureSettings(rawValue);
      featureSettingsConfirmed = { ...featureSettings };
      featureSettingsApplied = { ...featureSettings };
      featureSettingsLoaded = true;
      renderFeatureSettingsDialog();
    };
    contentTestHooks.saveFeatureSettingsForTests = async (changedFlags) => {
      const previous = { ...featureSettings };
      await saveFeatureSettings(
        { ...featureSettings, ...(changedFlags || {}) },
        previous
      );
      flushFeatureSettingsReconcile();
      return serializeFeatureSettings(featureSettings);
    };
    contentTestHooks.flushFeatureSettingsReconcileForTests =
      flushFeatureSettingsReconcile;
    contentTestHooks.setBestFriendsHomeVisibility = setBestFriendsHomeVisibility;
    contentTestHooks.formatBestFriendExperienceLabel =
      formatBestFriendExperienceLabel;
    contentTestHooks.setBestFriendSublabel = setBestFriendSublabel;
    contentTestHooks.getRoToolLogoMarkup = getRoToolLogoMarkup;
    contentTestHooks.syncFeatureSettingsButtonGeometry =
      syncFeatureSettingsButtonGeometry;
    contentTestHooks.findExternalGameTileCcu = findExternalGameTileCcu;
    contentTestHooks.syncGameTileCcu = syncGameTileCcu;
    contentTestHooks.mountGameTileCcu = mountGameTileCcu;
    contentTestHooks.flushGameTileCcuRequests = flushGameTileCcuRequests;
    contentTestHooks.invalidateStaleGameTileCcuControls =
      invalidateStaleGameTileCcuControls;
    contentTestHooks.mutationsAffectExtensionMount = mutationsAffectExtensionMount;
    contentTestHooks.cleanupGameTileCcuFeature = cleanupGameTileCcuFeature;
    contentTestHooks.cleanupGameTileCcuGraphDisplay =
      cleanupGameTileCcuGraphDisplay;
    contentTestHooks.getGameTileCcuLinkIdentity = getGameTileCcuLinkIdentity;
    contentTestHooks.queueGameTileCcuRoot = queueGameTileCcuRoot;
    contentTestHooks.mountGameTileCcuGraphTriggers =
      mountGameTileCcuGraphTriggers;
    contentTestHooks.openGameTileCcuGraph = openGameTileCcuGraph;
    contentTestHooks.closeGameTileCcuGraph = closeGameTileCcuGraph;
    contentTestHooks.normalizeGameTileCcuHistoryPoints =
      normalizeGameTileCcuHistoryPoints;
    contentTestHooks.downsampleGameTileCcuGraphPoints =
      downsampleGameTileCcuGraphPoints;
    contentTestHooks.downsampleGameTileCcuGraphSegments =
      downsampleGameTileCcuGraphSegments;
    contentTestHooks.getGameTileCcuGraphAxisModel =
      getGameTileCcuGraphAxisModel;
    contentTestHooks.getGameTileCcuGraphGapIntervals =
      getGameTileCcuGraphGapIntervals;
    contentTestHooks.getGameTileCcuGraphEdgeTrend =
      getGameTileCcuGraphEdgeTrend;
    contentTestHooks.getGameTileCcuGraphLatestPercentChange =
      getGameTileCcuGraphLatestPercentChange;
    contentTestHooks.findNearestGameTileCcuGraphPoint =
      findNearestGameTileCcuGraphPoint;
    contentTestHooks.showGameTileCcuGraphPoint =
      showGameTileCcuGraphPoint;
    contentTestHooks.showGameTileCcuGraphGapPoint =
      showGameTileCcuGraphGapPoint;
    contentTestHooks.positionGameTileCcuGraphPopover =
      positionGameTileCcuGraphPopover;
    contentTestHooks.scheduleGameTileCcuGraphClose =
      scheduleGameTileCcuGraphClose;
    contentTestHooks.renderGameTileCcuGraph = renderGameTileCcuGraph;
    contentTestHooks.getGameTileCcuGraphStateForTests = () => ({
      active: Boolean(activeGameTileCcuGraph),
      placeId: activeGameTileCcuGraph?.placeId || null,
      universeId: activeGameTileCcuGraph?.universeId || null,
      pinned: activeGameTileCcuGraph?.pinned === true,
      placement: activeGameTileCcuGraph?.placement || null,
      triggerHovered: activeGameTileCcuGraph?.triggerHovered === true,
      anchorHovered: activeGameTileCcuGraph?.anchorHovered === true,
      popoverHovered: activeGameTileCcuGraph?.popoverHovered === true,
      closeScheduled: Boolean(
        activeGameTileCcuGraph && activeGameTileCcuGraph.closeTimer !== null
      ),
      closeDueAt: activeGameTileCcuGraph?.closeDueAt || 0,
      selectedPointIndex:
        activeGameTileCcuGraph?.selectedPointIndex ?? null,
      selectedPointTimestamp:
        activeGameTileCcuGraph?.selectedPointTimestamp ?? null,
      selectedGapTimestamp:
        activeGameTileCcuGraph?.selectedGapTimestamp ?? null,
      hoverIntentPending: Boolean(gameTileCcuGraphHoverIntent),
      hoverIntentDueAt: gameTileCcuGraphHoverIntent?.dueAt || 0,
      hoverIntentPlaceId: gameTileCcuGraphHoverIntent?.placeId || null,
      requestCount: gameTileCcuGraphRequestId,
      cachedUniverses: gameTileCcuGraphHistoryCache.size,
      pendingUniverses: gameTileCcuGraphHistoryRequests.size,
      notTrackedRetryScheduled: Boolean(
        activeGameTileCcuGraph &&
        activeGameTileCcuGraph.notTrackedRetryTimer !== null
      ),
      notTrackedRetryDueAt:
        activeGameTileCcuGraph?.notTrackedRetryDueAt || 0,
      historyRetryScheduled: Boolean(
        activeGameTileCcuGraph &&
        activeGameTileCcuGraph.notTrackedRetryTimer !== null
      ),
      historyRetryDueAt:
        activeGameTileCcuGraph?.notTrackedRetryDueAt || 0
    });
    contentTestHooks.getGameTileCcuStateForTests = () => ({
      queuedPlaceIds: gameTileCcuQueuedByPlaceId.size,
      pendingPlaceIds: gameTileCcuPendingPlaceIds.size,
      cachedPlaceIds: gameTileCcuCacheByPlaceId.size,
      retryPlaceIds: gameTileCcuRetryAfterByPlaceId.size,
      lifecycleEpoch: gameTileCcuLifecycleEpoch
    });
    contentTestHooks.resetGameTileCcuStateForTests = () => {
      cleanupGameTileCcuFeature();
      gameTileCcuCacheByPlaceId.clear();
      gameTileCcuRequestId = 0;
      gameTileCcuGraphRequestId = 0;
    };
  }
  if (contentTestHooks?.skipInitialize !== true) {
    initialize();
  }
})();
