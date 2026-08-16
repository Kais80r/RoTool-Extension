"use strict";

(() => {
  const MESSAGE_PREFIX = "rsl:join-scheduler:";
  const SEARCH_DELAY_MS = 280;
  const MAX_SEARCH_RESULTS = 12;
  const TEMPLATE_PATH = "join-scheduler.html";
  const STYLE_PATH = "join-scheduler.css";
  const HOST_ID = "rsl-join-scheduler-host";
  const SHOW_MESSAGE_TYPE = "rsl:show-join-scheduler";
  const PRIVATE_URL_MAX_LENGTH = 2_048;
  // The longest read-only path is game search: four sequential fetchJson
  // budgets at 20.35s each (about 81.4s). Side-effecting requests deliberately
  // have no page-local timer: only the background response or a real runtime
  // disconnect may settle them, so the page can never report a timeout while a
  // save, schedule mutation, or launch is still able to complete later.
  const READ_ONLY_MESSAGE_TIMEOUT_MS = 120_000;
  const READ_ONLY_OPERATIONS = new Set([
    "get-state",
    "get-game-icons",
    "search-games",
    "validate-destination"
  ]);
  const ACTIVE_STATUSES = new Set(["pending", "claimed"]);
  const RESOURCE_MAX_BYTES = 180_000;

  const existingHooks = globalThis.__rslJoinSchedulerTestHooks || {};
  let modalAssetsPromise = null;
  let modalComponentPromise = null;
  let modalComponent = null;
  let modalLifecycleEpoch = 0;
  let modalOpener = null;

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function toDatetimeLocal(timestamp) {
    const date = new Date(Number(timestamp));
    if (!Number.isFinite(date.getTime())) return "";
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
      `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function parseDatetimeLocal(value) {
    if (typeof value !== "string" || !value.trim()) return null;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  function formatDateTime(timestamp, now = Date.now()) {
    const date = new Date(Number(timestamp));
    if (!Number.isFinite(date.getTime())) return "Unknown time";
    const today = new Date(now);
    const startOfToday = new Date(
      today.getFullYear(), today.getMonth(), today.getDate()
    ).getTime();
    const dayStart = new Date(
      date.getFullYear(), date.getMonth(), date.getDate()
    ).getTime();
    const dayDelta = Math.round((dayStart - startOfToday) / 86_400_000);
    const time = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
    if (dayDelta === 0) return `Today at ${time}`;
    if (dayDelta === 1) return `Tomorrow at ${time}`;
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  }

  function formatCountdown(timestamp, now = Date.now()) {
    const difference = Number(timestamp) - Number(now);
    if (!Number.isFinite(difference)) return "";
    if (difference <= 0) return "Scheduled time passed";
    const minutes = Math.max(1, Math.ceil(difference / 60_000));
    if (minutes < 60) return `in ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours < 24) {
      return remainingMinutes ? `in ${hours}h ${remainingMinutes}m` : `in ${hours}h`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours ? `in ${days}d ${remainingHours}h` : `in ${days}d`;
  }

  function errorMessage(code) {
    const messages = {
      UNAUTHENTICATED: "Sign in to Roblox, then close and reopen Join Scheduler.",
      ACCOUNT_CHANGED: "The Roblox account changed. Your previous account's data was cleared from this dialog.",
      DISABLED: "Join Scheduler is turned off in RoTool settings.",
      INVALID: "Check the game, time, and choices, then try again.",
      NETWORK: "Roblox could not be reached. Check your connection and try again.",
      RATE_LIMITED: "Roblox is receiving too many requests. Wait a moment and try again.",
      NOTIFICATIONS_REQUIRED: "Allow notifications so RoTool can warn you before the join.",
      CONSENT_REQUIRED: "Confirm the automatic join before scheduling it.",
      PRIVATE_LINK_INVALID: "Use an official HTTPS Roblox private-server link.",
      INVALID_PRIVATE_SERVER_URL: "Use an official HTTPS Roblox private-server link.",
      DUPLICATE_URL_PARAMETER: "Use an official HTTPS Roblox private-server link.",
      UNKNOWN_URL_PARAMETER: "Use an official HTTPS Roblox private-server link.",
      PRIVATE_LINK_UNVERIFIED: "That private-server link could not be verified.",
      PRIVATE_LINK_GAME_MISMATCH: "That private server belongs to a different game.",
      DESTINATION_GAME_MISMATCH: "The saved private server belongs to a different game.",
      DESTINATION_NOT_FOUND: "That saved destination no longer exists.",
      DESTINATION_LIMIT_REACHED: "You have reached the saved private-server limit.",
      SCHEDULE_LIMIT_REACHED: "You have reached the schedule limit. Remove an old schedule first.",
      SCHEDULE_NOT_FOUND: "That schedule no longer exists.",
      SCHEDULE_NOT_EDITABLE: "That schedule has already run and cannot be edited.",
      SCHEDULE_CHANGED: "That schedule changed. Review the latest version and try again.",
      EVENT_CHANGED: "Roblox changed this event's time. Open Game Events and schedule it again.",
      EVENT_UNAVAILABLE: "That Roblox event is no longer available.",
      NOT_ACTIONABLE: "This schedule cannot be joined now.",
      COLLISION: "Another scheduled join just ran. Try Join Now if you still want to switch.",
      PRESENCE_UNAVAILABLE: "RoTool could not safely check whether you are already playing.",
      SWITCH_NOT_ALLOWED: "You are in another game and this schedule did not allow switching.",
      UNAVAILABLE: "Join Scheduler is temporarily unavailable. Try again.",
      PERMISSION_DENIED: "Notifications were not allowed, so the schedule was not created."
    };
    return messages[String(code || "").toUpperCase()] || messages.UNAVAILABLE;
  }

  function normalizeGame(raw) {
    if (!raw || typeof raw !== "object") return null;
    const universeId = String(raw.universeId || "").trim();
    const placeId = String(raw.placeId || "").trim();
    const name = String(raw.name || raw.gameName || "").trim();
    if (
      !/^[1-9]\d{0,19}$/.test(universeId) ||
      !/^[1-9]\d{0,19}$/.test(placeId) ||
      !name
    ) {
      return null;
    }
    let thumbnailUrl = null;
    if (typeof raw.thumbnailUrl === "string") {
      try {
        const parsedThumbnail = new URL(raw.thumbnailUrl);
        const hostname = parsedThumbnail.hostname.toLowerCase();
        if (
          parsedThumbnail.protocol === "https:" &&
          !parsedThumbnail.username &&
          !parsedThumbnail.password &&
          (hostname === "rbxcdn.com" || hostname.endsWith(".rbxcdn.com"))
        ) {
          thumbnailUrl = parsedThumbnail.href;
        }
      } catch {
        thumbnailUrl = null;
      }
    }
    return {
      universeId,
      placeId,
      name: name.slice(0, 100),
      creatorName: String(raw.creatorName || "").trim().slice(0, 100),
      playerCount: Number.isSafeInteger(raw.playerCount) && raw.playerCount >= 0
        ? raw.playerCount
        : null,
      thumbnailUrl
    };
  }

  function normalizeGameIcon(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const keys = Object.keys(raw).sort();
    if (
      keys.length !== 2 ||
      keys[0] !== "thumbnailUrl" ||
      keys[1] !== "universeId"
    ) {
      return null;
    }
    const universeId = typeof raw.universeId === "string"
      ? raw.universeId
      : "";
    if (
      !/^[1-9]\d{0,19}$/.test(universeId) ||
      typeof raw.thumbnailUrl !== "string"
    ) {
      return null;
    }
    try {
      const thumbnailUrl = new URL(raw.thumbnailUrl);
      const hostname = thumbnailUrl.hostname.toLowerCase();
      if (
        thumbnailUrl.protocol !== "https:" ||
        thumbnailUrl.username ||
        thumbnailUrl.password ||
        thumbnailUrl.port ||
        thumbnailUrl.hash ||
        thumbnailUrl.href.length > 2_048 ||
        (hostname !== "rbxcdn.com" && !hostname.endsWith(".rbxcdn.com"))
      ) {
        return null;
      }
      return Object.freeze({ universeId, thumbnailUrl: thumbnailUrl.href });
    } catch {
      return null;
    }
  }

  function hydrateQuickSettingsHelpIcons(root) {
    if (!root || typeof root.querySelectorAll !== "function") return false;
    const host = root.host;
    if (!host || typeof host.append !== "function") return false;
    const slots = Array.from(root.querySelectorAll("slot[data-quick-settings-help-icon]"));
    if (!slots.length) return false;
    const ownerDocument = root.host?.ownerDocument || document;
    const ownerWindow = ownerDocument.defaultView || globalThis;
    if (typeof ownerWindow.getComputedStyle !== "function") return false;

    for (const child of Array.from(host.children)) {
      if (child.hasAttribute("data-rsl-scheduler-help-icon")) child.remove();
    }

    const assignments = [];
    const names = new Set();
    for (const slot of slots) {
      const name = String(slot.name || "").trim();
      if (!name || names.has(name)) continue;
      names.add(name);
      const information = ownerDocument.createElement("span");
      information.className = "rsl-quick-setting-info tooltip-container";
      information.slot = name;
      information.setAttribute("aria-hidden", "true");
      information.setAttribute("data-rsl-scheduler-help-icon", "");
      const icon = ownerDocument.createElement("span");
      icon.className = "icon-moreinfo-16x16";
      icon.setAttribute("aria-hidden", "true");
      information.append(icon);
      host.append(information);
      assignments.push({ information, icon });
    }

    const hasNativeSprite =
      assignments.length === slots.length &&
      assignments.every(({ icon }) => {
        const backgroundImage = ownerWindow.getComputedStyle(icon).backgroundImage;
        return Boolean(backgroundImage && backgroundImage !== "none");
      });
    if (!hasNativeSprite) {
      for (const { information } of assignments) information.remove();
      return false;
    }
    return true;
  }

  function bindHelpTips(root) {
    const emptyController = Object.freeze({
      closeAll: () => undefined,
      reposition: () => undefined,
      destroy: () => undefined
    });
    if (!root || typeof root.querySelectorAll !== "function") return emptyController;

    const ownerDocument = root.host?.ownerDocument || document;
    const ownerWindow = ownerDocument.defaultView || globalThis;
    const triggers = Array.from(root.querySelectorAll("[data-help-trigger]"));
    if (!triggers.length) return emptyController;

    const closeTimers = new Map();
    const cleanups = [];
    let destroyed = false;

    const listen = (target, type, listener, options) => {
      target?.addEventListener?.(type, listener, options);
      cleanups.push(() => target?.removeEventListener?.(type, listener, options));
    };

    const controlledTip = (trigger) => {
      const id = trigger?.getAttribute?.("aria-controls");
      return id ? root.getElementById?.(id) || root.querySelector(`#${id}`) : null;
    };

    const clearCloseTimer = (trigger) => {
      const timer = closeTimers.get(trigger);
      if (!timer) return;
      ownerWindow.clearTimeout(timer);
      closeTimers.delete(trigger);
    };

    const positionTip = (trigger) => {
      if (destroyed || trigger?.getAttribute?.("aria-expanded") !== "true") return;
      const tooltip = controlledTip(trigger);
      if (!tooltip || tooltip.hidden) return;
      const viewportWidth = ownerDocument.documentElement?.clientWidth ||
        ownerWindow.innerWidth || 0;
      const viewportHeight = ownerDocument.documentElement?.clientHeight ||
        ownerWindow.innerHeight || 0;
      const edge = 8;
      const gap = 5;
      const triggerRect = trigger.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const tooltipWidth = Math.min(
        tooltipRect.width,
        Math.max(0, viewportWidth - edge * 2)
      );
      const tooltipHeight = tooltipRect.height;
      const spaceAbove = triggerRect.top - gap - edge;
      const spaceBelow = viewportHeight - triggerRect.bottom - gap - edge;
      const placeAbove = spaceBelow < tooltipHeight && spaceAbove > spaceBelow;
      const preferredTop = placeAbove
        ? triggerRect.top - gap - tooltipHeight
        : triggerRect.bottom + gap;
      const left = Math.min(
        Math.max(edge, triggerRect.right - tooltipWidth),
        Math.max(edge, viewportWidth - tooltipWidth - edge)
      );
      const top = Math.min(
        Math.max(edge, preferredTop),
        Math.max(edge, viewportHeight - tooltipHeight - edge)
      );
      tooltip.style.left = `${Math.round(left)}px`;
      tooltip.style.top = `${Math.round(top)}px`;
    };

    const setOpen = (trigger, open) => {
      const tooltip = controlledTip(trigger);
      if (!tooltip) return;
      tooltip.hidden = !open;
      trigger.setAttribute("aria-expanded", String(open));
      if (open) positionTip(trigger);
    };

    const closeTrigger = (trigger) => {
      clearCloseTimer(trigger);
      const wrap = trigger?.closest?.(".scheduler-help");
      if (wrap) delete wrap.dataset.helpPinned;
      setOpen(trigger, false);
    };

    const closeAll = (except = null) => {
      for (const trigger of triggers) {
        if (trigger !== except) closeTrigger(trigger);
      }
    };

    const reposition = () => {
      for (const trigger of triggers) positionTip(trigger);
    };

    const scheduleTransientClose = (trigger) => {
      clearCloseTimer(trigger);
      const timer = ownerWindow.setTimeout(() => {
        closeTimers.delete(trigger);
        const wrap = trigger.closest(".scheduler-help");
        if (
          wrap?.dataset.helpPinned === "true" ||
          wrap?.matches?.(":hover") ||
          wrap?.contains?.(root.activeElement)
        ) {
          return;
        }
        setOpen(trigger, false);
      }, 120);
      closeTimers.set(trigger, timer);
    };

    for (const trigger of triggers) {
      const wrap = trigger.closest(".scheduler-help");
      if (!wrap || !controlledTip(trigger)) continue;
      listen(wrap, "pointerenter", () => {
        clearCloseTimer(trigger);
        closeAll(trigger);
        setOpen(trigger, true);
      });
      listen(wrap, "pointerleave", () => scheduleTransientClose(trigger));
      listen(trigger, "focus", () => {
        clearCloseTimer(trigger);
        closeAll(trigger);
        setOpen(trigger, true);
      });
      listen(trigger, "blur", () => scheduleTransientClose(trigger));
      listen(trigger, "click", () => {
        const wasPinned = wrap.dataset.helpPinned === "true";
        closeAll(trigger);
        if (wasPinned) {
          closeTrigger(trigger);
          return;
        }
        wrap.dataset.helpPinned = "true";
        clearCloseTimer(trigger);
        setOpen(trigger, true);
      });
      listen(trigger, "keydown", (event) => {
        if (event.key !== "Escape" || trigger.getAttribute("aria-expanded") !== "true") {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        closeTrigger(trigger);
      });
    }

    listen(root, "pointerdown", (event) => {
      if (!event.target?.closest?.(".scheduler-help")) closeAll();
    }, true);
    listen(root, "keydown", (event) => {
      if (
        event.key !== "Escape" ||
        !triggers.some((trigger) => trigger.getAttribute("aria-expanded") === "true")
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      closeAll();
    }, true);
    listen(root, "scroll", reposition, true);
    listen(ownerWindow, "resize", reposition);
    for (const dialog of root.querySelectorAll("[data-scheduler-dialog]")) {
      listen(dialog, "close", () => closeAll());
    }

    return Object.freeze({
      closeAll,
      reposition,
      destroy: () => {
        if (destroyed) return;
        closeAll();
        destroyed = true;
        for (const timer of closeTimers.values()) ownerWindow.clearTimeout(timer);
        closeTimers.clear();
        for (const cleanup of cleanups.splice(0)) cleanup();
      }
    });
  }

  function initialize(root, options = {}) {
    if (!root || typeof root.querySelector !== "function") return null;
    const ownerDocument = root.host?.ownerDocument || document;
    const query = (selector) => root.querySelector(selector);
    const queryAll = (selector) => Array.from(root.querySelectorAll(selector));

    function setFoundationButtonLabel(button, text) {
      if (!button) return;
      let label = button.querySelector("[data-rsl-button-label]");
      if (!label) {
        const stateLayer = ownerDocument.createElement("div");
        stateLayer.setAttribute("aria-hidden", "true");
        stateLayer.setAttribute("data-testid", "foundation-web-state-layer");
        stateLayer.className =
          "absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] " +
          "group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none";
        const content = ownerDocument.createElement("span");
        content.className = "flex items-center min-width-0 gap-small";
        content.setAttribute("data-rsl-button-content", "");
        label = ownerDocument.createElement("span");
        label.className = "padding-y-xsmall text-truncate-end text-no-wrap";
        label.setAttribute("data-rsl-button-label", "");
        content.append(label);
        button.replaceChildren(stateLayer, content);
      }
      label.textContent = String(text || "");
    }

    function decorateFoundationButton(button, labelText = null) {
      if (!button) return button;
      if (button.classList.contains("rsl-icon-button")) {
        button.classList.add(
          "foundation-web-close-affordance",
          "flex",
          "stroke-none",
          "bg-none",
          "cursor-pointer",
          "relative",
          "clip",
          "group/interactable",
          "focus-visible:outline-focus",
          "disabled:outline-none",
          "bg-over-media-100",
          "padding-small",
          "radius-circle"
        );
        if (!button.querySelector('[data-testid="foundation-web-state-layer"]')) {
          const stateLayer = ownerDocument.createElement("div");
          stateLayer.setAttribute("aria-hidden", "true");
          stateLayer.setAttribute("data-testid", "foundation-web-state-layer");
          stateLayer.className =
            "absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] " +
            "group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none";
          button.prepend(stateLayer);
        }
        return button;
      }
      if (!button.matches(".button, .rsl-button")) return button;
      button.classList.add(
        "rsl-button",
        "foundation-web-button",
        "relative",
        "clip",
        "group/interactable",
        "focus-visible:outline-focus",
        "disabled:outline-none",
        "cursor-pointer",
        "flex",
        "items-center",
        "justify-center",
        "stroke-none",
        "padding-y-none",
        "select-none",
        "radius-medium",
        "text-label-large",
        "height-1200",
        "padding-x-medium"
      );
      if (button.classList.contains("button--primary")) {
        button.classList.add(
          "rsl-button--primary",
          "bg-action-emphasis",
          "content-action-emphasis"
        );
      } else if (button.classList.contains("button--danger")) {
        button.classList.add("rsl-button--danger");
      } else {
        button.classList.add(
          "rsl-button--secondary",
          "bg-action-standard",
          "content-action-standard"
        );
      }
      const currentLabel = labelText === null
        ? button.textContent.trim()
        : String(labelText);
      setFoundationButtonLabel(button, currentLabel);
      return button;
    }

    queryAll("button").forEach((button) => decorateFoundationButton(button));
    const elements = {
      pageStatus: query("[data-page-status]"),
      summary: query("[data-upcoming-summary]"),
      loading: query("[data-loading]"),
      list: query("[data-schedule-list]"),
      empty: query("[data-empty-state]"),
      listView: query("[data-scheduler-view='list']"),
      editor: query("[data-editor]"),
      schedulerTitle: query("[data-scheduler-title]"),
      schedulerDescription: query("[data-scheduler-description]"),
      schedulerScroll: query("[data-scheduler-scroll]"),
      listFooterActions: query("[data-footer-actions='list']"),
      editorFooterActions: query("[data-footer-actions='editor']"),
      newSchedule: query("[data-action='new-schedule']"),
      editorTitle: query("[data-editor-title]"),
      form: query("[data-schedule-form]"),
      formStatus: query("[data-form-status]"),
      search: query("[data-game-search]"),
      searchStatus: query("[data-search-status]"),
      searchResults: query("[data-search-results]"),
      selectionHelp: query("[data-game-selection-help]"),
      selectedGame: query("[data-selected-game]"),
      selectedThumbnail: query("[data-selected-game-thumbnail]"),
      selectedName: query("[data-selected-game-name]"),
      selectedDetails: query("[data-selected-game-details]"),
      scheduleTime: query("[data-schedule-time]"),
      timeZone: query("[data-time-zone]"),
      officialEvent: query("[data-official-event]"),
      officialTitle: query("[data-official-event-title]"),
      officialTime: query("[data-official-event-time]"),
      destinationHeading: query("#destination-section-title"),
      privateFields: query("[data-private-fields]"),
      privateUrlInput: query("[data-private-url]"),
      validation: query("[data-destination-validation]"),
      unverifiedConfirm: query("[data-unverified-confirm]"),
      confirmUnverified: query("[data-confirm-unverified]"),
      savedDestinations: query("[data-saved-destinations]"),
      savedDestination: query("[data-saved-destination]"),
      testPrivate: query("[data-action='test-private']"),
      deletePrivate: query("[data-action='delete-private']"),
      autoConsent: query("[data-auto-consent]"),
      consentSummary: query("[data-consent-summary]"),
      autoJoinConsent: query("[data-auto-join-consent]"),
      allowSwitch: query("[data-allow-switch]"),
      submit: query("[data-submit-schedule]"),
      inlineConfirm: query("[data-inline-confirm]"),
      confirmTitle: query("[data-confirm-title]"),
      confirmCopy: query("[data-confirm-copy]"),
      confirmCancel: query("[data-action='cancel-confirm']"),
      confirmAction: query("[data-confirm-action]"),
      schedulerDialog: query("[data-scheduler-dialog]")
    };
    if (
      !elements.form ||
      !elements.list ||
      !elements.listView ||
      !elements.editor ||
      !elements.schedulerDialog ||
      !elements.inlineConfirm ||
      !elements.schedulerTitle ||
      !elements.schedulerDescription ||
      !elements.schedulerScroll ||
      !elements.listFooterActions ||
      !elements.editorFooterActions ||
      !elements.newSchedule ||
      !elements.destinationHeading ||
      !elements.confirmCancel ||
      !elements.confirmAction
    ) {
      return null;
    }
    const helpTips = bindHelpTips(root);

    let state = {
      viewerUserId: null,
      enabled: true,
      destinations: [],
      schedules: []
    };
    let selectedGame = null;
    let editingScheduleId = null;
    let editingScheduleRevision = null;
    let officialDraft = null;
    let searchTimer = null;
    let searchSequence = 0;
    let searchItems = [];
    let activeSearchIndex = -1;
    let requestSequence = 0;
    let openSequence = 0;
    let stateLoadSequence = 0;
    let gameIconLoadSequence = 0;
    let stateLoading = false;
    let destinationValidationSequence = 0;
    let submitting = false;
    let submitPhase = "idle";
    let validating = false;
    let lastFocus = null;
    let activeView = "list";
    let viewEpoch = 0;
    let listScrollTop = 0;
    let pendingConfirmation = null;
    let draftLoading = false;
    let destroyed = false;
    let interactionEpoch = 0;
    let pendingPrivateSecret = null;
    let pendingValidationSecret = null;
    const thumbnails = new Map();

    function invalidateInteraction() {
      interactionEpoch += 1;
      if (pendingPrivateSecret) pendingPrivateSecret.value = "";
      pendingPrivateSecret = null;
      if (pendingValidationSecret) pendingValidationSecret.value = "";
      pendingValidationSecret = null;
    }

    function isTrustedEvent(event) {
      if (event?.isTrusted === true) return true;
      event?.preventDefault?.();
      event?.stopImmediatePropagation?.();
      return false;
    }

    function setStatus(target, text, tone = "") {
      if (!target) return;
      target.textContent = text || "";
      if (tone) target.dataset.tone = tone;
      else delete target.dataset.tone;
    }

    function setBusy(button, busy, busyText = "Working...") {
      if (!button) return;
      if (busy) {
        if (!button.dataset.idleText) {
          button.dataset.idleText =
            button.querySelector("[data-rsl-button-label]")?.textContent ||
            button.textContent;
        }
        setFoundationButtonLabel(button, busyText);
        button.disabled = true;
      } else {
        if (button.dataset.idleText) {
          setFoundationButtonLabel(button, button.dataset.idleText);
        }
        button.disabled = false;
        delete button.dataset.idleText;
      }
    }

    function updateNewScheduleAvailability() {
      elements.newSchedule.disabled = Boolean(
        destroyed || stateLoading || !state.enabled || !state.viewerUserId
      );
    }

    function makeElement(tag, className, text) {
      const node = ownerDocument.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = String(text);
      return node;
    }

    function addThumbnail(container, url, label) {
      container.replaceChildren();
      const fallback = String(label || "?").trim().charAt(0).toUpperCase() || "?";
      if (url) {
        const image = ownerDocument.createElement("img");
        image.src = url;
        image.alt = "";
        image.referrerPolicy = "no-referrer";
        image.addEventListener("error", () => {
          if (image.parentElement === container) {
            container.replaceChildren();
            container.textContent = fallback;
          }
        }, { once: true });
        container.append(image);
      } else {
        container.textContent = fallback;
      }
    }

    function sendRuntimeMessage(message, options = {}) {
      return new Promise((resolve, reject) => {
        let settled = false;
        const timeoutMs = options.timeoutMs === null
          ? null
          : READ_ONLY_MESSAGE_TIMEOUT_MS;
        const timeoutId = timeoutMs === null ? null : setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(Object.assign(new Error("timeout"), { code: "UNAVAILABLE" }));
        }, timeoutMs);
        const finish = (response) => {
          if (settled) return;
          settled = true;
          if (timeoutId !== null) clearTimeout(timeoutId);
          const runtimeError = chrome.runtime?.lastError;
          if (runtimeError) reject(Object.assign(new Error("runtime"), { code: "UNAVAILABLE" }));
          else resolve(response);
        };
        try {
          const returned = chrome.runtime.sendMessage(message, finish);
          if (returned && typeof returned.then === "function") {
            returned.then(finish, () => {
              if (!settled) {
                settled = true;
                if (timeoutId !== null) clearTimeout(timeoutId);
                reject(Object.assign(new Error("runtime"), { code: "UNAVAILABLE" }));
              }
            });
          }
        } catch {
          settled = true;
          if (timeoutId !== null) clearTimeout(timeoutId);
          reject(Object.assign(new Error("runtime"), { code: "UNAVAILABLE" }));
        }
      });
    }

    async function api(operation, payload = {}, options = {}) {
      const requestId = ++requestSequence;
      const expectedViewerUserId = options.omitViewer ? null : state.viewerUserId;
      if (!options.omitViewer && !expectedViewerUserId) {
        throw Object.assign(new Error("account"), { code: "UNAUTHENTICATED" });
      }
      const message = {
        type: `${MESSAGE_PREFIX}${operation}`,
        requestId,
        ...payload
      };
      if (expectedViewerUserId) {
        message.viewerUserId = expectedViewerUserId;
      }
      const response = await sendRuntimeMessage(message, {
        timeoutMs: READ_ONLY_OPERATIONS.has(operation)
          ? READ_ONLY_MESSAGE_TIMEOUT_MS
          : null
      });
      if (!response || response.requestId !== requestId) {
        throw Object.assign(new Error("response"), { code: "UNAVAILABLE" });
      }
      if (!response.ok) {
        const error = Object.assign(new Error("scheduler"), {
          code: response.code || "UNAVAILABLE",
          viewerUserId: response.viewerUserId || null
        });
        throw error;
      }
      if (
        expectedViewerUserId &&
        response.viewerUserId !== expectedViewerUserId
      ) {
        throw Object.assign(new Error("account"), {
          code: "ACCOUNT_CHANGED",
          viewerUserId: response.viewerUserId || null
        });
      }
      return response;
    }

    function clearPrivateEntry() {
      destinationValidationSequence += 1;
      if (pendingValidationSecret) pendingValidationSecret.value = "";
      pendingValidationSecret = null;
      elements.privateUrlInput.value = "";
      elements.confirmUnverified.checked = false;
      elements.unverifiedConfirm.hidden = true;
      setStatus(elements.validation, "");
    }

    function clearSearch() {
      searchSequence += 1;
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = null;
      searchItems = [];
      activeSearchIndex = -1;
      elements.searchResults.replaceChildren();
      elements.searchResults.hidden = true;
      elements.search.setAttribute("aria-expanded", "false");
      elements.search.removeAttribute("aria-activedescendant");
      setStatus(elements.searchStatus, "");
    }

    function settleInlineConfirmation(confirmed, restoreFocus = true) {
      const pending = pendingConfirmation;
      if (!pending) return false;
      pendingConfirmation = null;
      const accepted = Boolean(
        confirmed &&
        !destroyed &&
        root.host?.isConnected === true &&
        activeView === pending.view &&
        viewEpoch === pending.viewEpoch &&
        interactionEpoch === pending.interactionEpoch &&
        state.viewerUserId === pending.viewerUserId &&
        (!pending.guard || pending.guard())
      );
      elements.inlineConfirm.hidden = true;
      if (pending.origin?.dataset) delete pending.origin.dataset.confirmOpen;
      for (const { control, disabled } of pending.controls) {
        control.disabled = disabled;
      }
      updateNewScheduleAvailability();
      elements.schedulerScroll.append(elements.inlineConfirm);
      pending.resolve(accepted);
      if (
        restoreFocus &&
        pending.focusTarget?.isConnected &&
        typeof pending.focusTarget.focus === "function"
      ) {
        pending.focusTarget.focus();
      }
      return true;
    }

    function setSchedulerView(view, title = null) {
      const nextView = view === "editor" ? "editor" : "list";
      const viewChanged = activeView !== nextView;
      if (pendingConfirmation && pendingConfirmation.view !== nextView) {
        settleInlineConfirmation(false, false);
      }
      if (viewChanged && activeView === "list") {
        listScrollTop = elements.schedulerScroll.scrollTop;
      }
      if (activeView === "editor" && nextView === "list") {
        if (draftLoading) {
          draftLoading = false;
          elements.editor.removeAttribute("aria-busy");
          elements.submit.disabled = false;
        }
        invalidateInteraction();
        clearPrivateEntry();
        clearSearch();
      }
      if (viewChanged) viewEpoch += 1;
      activeView = nextView;
      elements.schedulerDialog.dataset.schedulerView = nextView;
      elements.listView.hidden = nextView !== "list";
      elements.editor.hidden = nextView !== "editor";
      elements.listFooterActions.hidden = nextView !== "list";
      elements.editorFooterActions.hidden = nextView !== "editor";
      elements.pageStatus.hidden = nextView !== "list";
      elements.schedulerTitle.textContent = nextView === "editor"
        ? String(title || "New Schedule")
        : "Join Scheduler";
      elements.schedulerDescription.textContent = nextView === "editor"
        ? "Choose when and how you want to join."
        : "Plan a reminder or one automatic join attempt.";
      helpTips.closeAll();
      if (viewChanged) {
        elements.schedulerScroll.scrollTop = nextView === "editor" ? 0 : listScrollTop;
      }
    }

    function clearAccountSurface() {
      settleInlineConfirmation(false, false);
      invalidateInteraction();
      stateLoadSequence += 1;
      gameIconLoadSequence += 1;
      stateLoading = false;
      state = { viewerUserId: null, enabled: true, destinations: [], schedules: [] };
      selectedGame = null;
      editingScheduleId = null;
      editingScheduleRevision = null;
      officialDraft = null;
      thumbnails.clear();
      clearPrivateEntry();
      clearSearch();
      elements.list.replaceChildren();
      elements.empty.hidden = false;
      elements.summary.textContent = "No account data loaded";
      listScrollTop = 0;
      lastFocus = null;
      setSchedulerView("list");
      elements.schedulerScroll.scrollTop = 0;
      updateNewScheduleAvailability();
    }

    async function recoverFromAccountError(error) {
      if (!["ACCOUNT_CHANGED", "UNAUTHENTICATED"].includes(error?.code)) return false;
      clearAccountSurface();
      setStatus(elements.pageStatus, errorMessage(error.code), "error");
      if (error.code === "ACCOUNT_CHANGED") {
        await loadState(true).catch(() => undefined);
      }
      return true;
    }

    async function recoverFromStaleScheduleError(error, closeEditorAfterReload = false) {
      if (!["SCHEDULE_CHANGED", "SCHEDULE_NOT_FOUND", "SCHEDULE_NOT_EDITABLE"].includes(
        error?.code
      )) return false;
      try {
        await loadState();
        if (closeEditorAfterReload && activeView === "editor") closeEditor(true);
        setStatus(
          elements.pageStatus,
          error.code === "SCHEDULE_NOT_FOUND"
            ? "That schedule no longer exists. The list has been updated."
            : "That schedule changed. Review the latest version and try again.",
          "warning"
        );
      } catch {
        // loadState already presents an account or availability error.
      }
      return true;
    }

    function getDestination(destinationId) {
      return state.destinations.find((item) => item.id === destinationId) || null;
    }

    function getStatusLabel(schedule) {
      const labels = {
        pending: "Scheduled",
        claimed: "Starting",
        completed: "Completed",
        canceled: "Canceled",
        missed: "Missed",
        failed: "Failed"
      };
      return labels[schedule.status] || "Finished";
    }

    function renderSchedule(schedule) {
      const item = makeElement("li", "schedule-card");
      item.dataset.scheduleId = schedule.id;
      const identity = makeElement("div", "schedule-card__identity");
      const thumbnail = makeElement("span", "schedule-card__thumbnail");
      thumbnail.setAttribute("aria-hidden", "true");
      thumbnail.dataset.rslScheduleThumbnail = "";
      thumbnail.dataset.rslUniverseId = schedule.universeId;
      addThumbnail(thumbnail, thumbnails.get(schedule.universeId), schedule.gameName);
      const copy = makeElement("div", "schedule-card__copy");
      const topLine = makeElement("div", "schedule-card__topline");
      topLine.append(makeElement("strong", "", schedule.gameName));
      const event = makeElement("div", "schedule-card__event", schedule.title);
      const dateLine = makeElement("div", "schedule-card__date-line");
      const date = makeElement("time", "schedule-card__date", formatDateTime(schedule.startAt));
      date.dateTime = new Date(schedule.startAt).toISOString();
      dateLine.append(date);
      if (ACTIVE_STATUSES.has(schedule.status)) {
        const countdown = makeElement(
          "span", "schedule-card__countdown", formatCountdown(schedule.startAt)
        );
        countdown.dataset.scheduleCountdown = schedule.id;
        countdown.setAttribute("aria-hidden", "true");
        dateLine.append(countdown);
      }
      const destination = getDestination(schedule.destinationId);
      const meta = makeElement("div", "schedule-card__meta");
      meta.append(makeElement("span", "", schedule.mode === "auto" ? "Auto-join" : "Reminder"));
      meta.append(makeElement("span", "schedule-card__separator", "·"));
      meta.append(makeElement("span", "",
        destination?.type && destination.type !== "public" ? "Private server" : "Public game"
      ));
      if (destination?.requiresConfirmation) {
        meta.append(makeElement("span", "schedule-card__separator", "·"));
        meta.append(makeElement("span", "schedule-card__warning", "Unverified link"));
      }
      if (schedule.mode === "auto" && !schedule.allowSwitch) {
        meta.append(makeElement("span", "schedule-card__separator", "·"));
        meta.append(makeElement("span", "", "Won't switch games"));
      }
      if (!ACTIVE_STATUSES.has(schedule.status)) {
        meta.append(makeElement("span", "schedule-card__separator", "·"));
        meta.append(makeElement(
          "span",
          ["canceled", "missed", "failed"].includes(schedule.status)
            ? "schedule-card__warning"
            : "",
          getStatusLabel(schedule)
        ));
      }
      copy.append(topLine, event, dateLine, meta);
      identity.append(thumbnail, copy);

      const actions = makeElement("div", "schedule-card__actions");
      function action(label, actionName, className = "button button--secondary button--compact") {
        const button = makeElement("button", className);
        button.type = "button";
        button.dataset.scheduleAction = actionName;
        button.dataset.scheduleId = schedule.id;
        return decorateFoundationButton(button, label);
      }
      if (schedule.status === "pending") {
        actions.append(
          action("Join Now", "join", "button button--primary button--compact"),
          action("Edit", "edit"),
          action("Remove", "remove", "button button--quiet button--compact")
        );
      } else {
        actions.append(action("Remove", "remove", "button button--quiet button--compact"));
      }
      item.append(identity, actions);
      return item;
    }

    function renderSchedules() {
      if (pendingConfirmation?.view === "list") {
        settleInlineConfirmation(false, false);
      }
      elements.list.replaceChildren();
      const schedules = Array.isArray(state.schedules) ? state.schedules : [];
      for (const schedule of schedules) elements.list.append(renderSchedule(schedule));
      elements.loading.hidden = true;
      elements.empty.hidden = schedules.length !== 0;
      elements.list.hidden = schedules.length === 0;
      if (!schedules.length) elements.summary.textContent = "No schedules yet";
      else if (schedules.length === 1) elements.summary.textContent = "1 schedule";
      else elements.summary.textContent = `${schedules.length} schedules`;
    }

    function getGameIconRequestUniverseIds() {
      const universeIds = [];
      const seen = new Set();
      const add = (rawUniverseId) => {
        const universeId = String(rawUniverseId || "");
        if (
          !/^[1-9]\d{0,19}$/.test(universeId) ||
          seen.has(universeId) ||
          universeIds.length >= 50
        ) {
          return;
        }
        seen.add(universeId);
        universeIds.push(universeId);
      };
      add(selectedGame?.universeId);
      for (const schedule of Array.isArray(state.schedules) ? state.schedules : []) {
        add(schedule?.universeId);
      }
      return universeIds;
    }

    function repaintScheduleGameIcons() {
      for (const thumbnail of elements.list.querySelectorAll(
        "[data-rsl-schedule-thumbnail][data-rsl-universe-id]"
      )) {
        const universeId = thumbnail.dataset.rslUniverseId;
        const schedule = state.schedules.find(
          (item) => item.universeId === universeId
        );
        if (schedule) {
          addThumbnail(thumbnail, thumbnails.get(universeId), schedule.gameName);
        }
      }
    }

    async function hydrateGameIcons() {
      const universeIds = getGameIconRequestUniverseIds();
      const expectedViewerUserId = state.viewerUserId;
      if (!state.enabled || !expectedViewerUserId || universeIds.length === 0) {
        return null;
      }
      const sequence = ++gameIconLoadSequence;
      const expectedStateLoadSequence = stateLoadSequence;
      const selectedSnapshot = selectedGame ? Object.freeze({
        universeId: selectedGame.universeId,
        placeId: selectedGame.placeId,
        viewEpoch,
        interactionEpoch
      }) : null;
      const response = await api("get-game-icons", { universeIds });
      if (
        sequence !== gameIconLoadSequence ||
        expectedStateLoadSequence !== stateLoadSequence ||
        destroyed ||
        root.host?.isConnected !== true ||
        !elements.schedulerDialog.open ||
        state.viewerUserId !== expectedViewerUserId
      ) {
        return response;
      }
      const requested = new Set(universeIds);
      const seen = new Set();
      const rawIcons = response.gameIcons;
      if (!Array.isArray(rawIcons) || rawIcons.length > universeIds.length) {
        return response;
      }
      const icons = [];
      for (const rawIcon of rawIcons) {
        const icon = normalizeGameIcon(rawIcon);
        if (
          !icon ||
          !requested.has(icon.universeId) ||
          seen.has(icon.universeId)
        ) {
          return response;
        }
        seen.add(icon.universeId);
        icons.push(icon);
      }
      for (const icon of icons) {
        thumbnails.set(icon.universeId, icon.thumbnailUrl);
      }
      repaintScheduleGameIcons();
      if (
        selectedSnapshot &&
        activeView === "editor" &&
        viewEpoch === selectedSnapshot.viewEpoch &&
        interactionEpoch === selectedSnapshot.interactionEpoch &&
        selectedGame?.universeId === selectedSnapshot.universeId &&
        selectedGame?.placeId === selectedSnapshot.placeId
      ) {
        addThumbnail(
          elements.selectedThumbnail,
          thumbnails.get(selectedSnapshot.universeId),
          selectedGame.name
        );
      }
      return response;
    }

    function refreshScheduleCountdowns(now = Date.now()) {
      for (const node of elements.list.querySelectorAll("[data-schedule-countdown]")) {
        const schedule = state.schedules.find(
          (item) => item.id === node.dataset.scheduleCountdown
        );
        if (schedule && ACTIVE_STATUSES.has(schedule.status)) {
          node.textContent = formatCountdown(schedule.startAt, now);
        }
      }
    }

    function captureScheduleFocusIntent(schedule, action) {
      return Object.freeze({
        scheduleId: schedule.id,
        action,
        index: Math.max(0, state.schedules.findIndex((item) => item.id === schedule.id)),
        viewerUserId: state.viewerUserId
      });
    }

    function restoreScheduleFocus(intent) {
      if (
        !intent ||
        destroyed ||
        activeView !== "list" ||
        !elements.schedulerDialog.open
      ) return;
      const cards = Array.from(elements.list.querySelectorAll(".schedule-card"));
      let target = null;
      if (state.viewerUserId === intent.viewerUserId) {
        const sameCard = cards.find(
          (card) => card.dataset.scheduleId === intent.scheduleId
        );
        if (sameCard) {
          target = Array.from(sameCard.querySelectorAll("button[data-schedule-action]"))
            .find((button) => button.dataset.scheduleAction === intent.action) ||
            sameCard.querySelector("button[data-schedule-action]");
        } else if (cards.length) {
          const nearbyCard = cards[Math.min(intent.index, cards.length - 1)];
          target = nearbyCard?.querySelector("button[data-schedule-action]") || null;
        }
      }
      if (!target || target.disabled) {
        target = !elements.newSchedule.disabled
          ? elements.newSchedule
          : elements.schedulerTitle;
      }
      target?.focus?.();
    }

    async function loadState(omitViewer = false) {
      const sequence = ++stateLoadSequence;
      const expectedViewerUserId = omitViewer ? null : state.viewerUserId;
      stateLoading = true;
      updateNewScheduleAvailability();
      elements.loading.hidden = false;
      try {
        const response = await api("get-state", {}, { omitViewer });
        if (sequence !== stateLoadSequence) return response;
        if (
          expectedViewerUserId &&
          response.viewerUserId !== expectedViewerUserId
        ) {
          throw Object.assign(new Error("account"), { code: "ACCOUNT_CHANGED" });
        }
        state.viewerUserId = response.viewerUserId;
        state.enabled = response.enabled !== false;
        state.destinations = Array.isArray(response.destinations) ? response.destinations : [];
        state.schedules = Array.isArray(response.schedules) ? response.schedules : [];
        renderSchedules();
        void hydrateGameIcons().catch(() => undefined);
        if (!state.enabled) {
          setStatus(elements.pageStatus, errorMessage("DISABLED"), "warning");
        } else {
          setStatus(elements.pageStatus, "");
        }
        return response;
      } catch (error) {
        if (sequence !== stateLoadSequence) return null;
        elements.loading.hidden = true;
        if (!await recoverFromAccountError(error)) {
          setStatus(elements.pageStatus, errorMessage(error.code), "error");
        }
        throw error;
      } finally {
        if (sequence === stateLoadSequence) {
          stateLoading = false;
          updateNewScheduleAvailability();
        }
      }
    }

    function modeValue() {
      return elements.form.elements.namedItem("schedule-mode")?.value || "notify";
    }

    function destinationTypeValue() {
      return elements.form.elements.namedItem("destination-type")?.value || "public";
    }

    function updateSubmitCopy() {
      setFoundationButtonLabel(elements.submit, modeValue() === "auto"
        ? "Schedule Auto-Join"
        : "Schedule Reminder");
    }

    function updateMode() {
      const auto = modeValue() === "auto";
      elements.autoConsent.hidden = !auto;
      if (!auto) {
        elements.autoJoinConsent.checked = false;
        elements.allowSwitch.checked = false;
      }
      const destination = destinationTypeValue() === "private"
        ? "the selected private server"
        : "the public game";
      elements.consentSummary.textContent = selectedGame
        ? `At ${formatDateTime(parseDatetimeLocal(elements.scheduleTime.value))}, RoTool will try once to open ${selectedGame.name} in ${destination}.`
        : "Choose a game and time before confirming automatic joining.";
      updateSubmitCopy();
    }

    function compatiblePrivateDestinations() {
      if (!selectedGame) return [];
      return state.destinations.filter((destination) =>
        destination.universeId === selectedGame.universeId && destination.type !== "public"
      );
    }

    function updateSavedDestinationButtons() {
      const hasSelection = Boolean(elements.savedDestination.value);
      elements.testPrivate.hidden = !hasSelection;
      elements.deletePrivate.hidden = !hasSelection;
    }

    function restoreDestinationFocus() {
      if (
        destroyed ||
        activeView !== "editor" ||
        !elements.schedulerDialog.open
      ) return;
      const target = !elements.savedDestinations.hidden &&
        elements.savedDestination.options.length
        ? elements.savedDestination
        : elements.destinationHeading;
      target.focus();
    }

    function renderDestinations(preferredId = null) {
      const privateSelected = destinationTypeValue() === "private";
      elements.privateFields.hidden = !privateSelected;
      const destinations = compatiblePrivateDestinations();
      elements.savedDestination.replaceChildren();
      for (const destination of destinations) {
        const option = ownerDocument.createElement("option");
        option.value = destination.id;
        option.textContent = destination.requiresConfirmation
          ? `${destination.label} · unverified`
          : destination.label;
        elements.savedDestination.append(option);
      }
      if (preferredId && destinations.some((item) => item.id === preferredId)) {
        elements.savedDestination.value = preferredId;
      }
      elements.savedDestinations.hidden = !privateSelected || destinations.length === 0;
      updateSavedDestinationButtons();
      updateMode();
    }

    function showSelectedGame(game) {
      if (
        selectedGame &&
        (
          selectedGame.universeId !== game.universeId ||
          selectedGame.placeId !== game.placeId
        )
      ) {
        clearPrivateEntry();
      }
      selectedGame = game;
      elements.selectedGame.hidden = false;
      elements.search.hidden = true;
      elements.selectionHelp.hidden = true;
      elements.selectedName.textContent = game.name;
      const details = game.creatorName ? `By ${game.creatorName}` : `Universe ${game.universeId}`;
      elements.selectedDetails.textContent = details;
      addThumbnail(elements.selectedThumbnail, game.thumbnailUrl, game.name);
      if (game.thumbnailUrl) thumbnails.set(game.universeId, game.thumbnailUrl);
      else if (state.enabled && state.viewerUserId) {
        void hydrateGameIcons().catch(() => undefined);
      }
      clearSearch();
      renderDestinations();
      updateMode();
    }

    function resetEditor() {
      helpTips.closeAll();
      settleInlineConfirmation(false, false);
      invalidateInteraction();
      elements.form.reset();
      editingScheduleId = null;
      editingScheduleRevision = null;
      selectedGame = null;
      officialDraft = null;
      submitting = false;
      submitPhase = "idle";
      validating = false;
      draftLoading = false;
      elements.editor.removeAttribute("aria-busy");
      elements.search.hidden = false;
      elements.search.value = "";
      elements.selectionHelp.hidden = false;
      elements.selectedGame.hidden = true;
      elements.officialEvent.hidden = true;
      elements.scheduleTime.readOnly = false;
      elements.scheduleTime.removeAttribute("aria-readonly");
      elements.scheduleTime.min = toDatetimeLocal(Date.now() + 60_000);
      elements.scheduleTime.value = toDatetimeLocal(Date.now() + 3_600_000);
      elements.privateFields.hidden = true;
      elements.savedDestinations.hidden = true;
      elements.autoConsent.hidden = true;
      elements.submit.disabled = false;
      clearPrivateEntry();
      clearSearch();
      setStatus(elements.formStatus, "");
      updateSubmitCopy();
    }

    function focusEditorTarget(target = "search") {
      if (activeView !== "editor" || !elements.schedulerDialog.open) return;
      const focusTarget = target === "heading" ? elements.editorTitle : elements.search;
      focusTarget?.focus?.();
    }

    function openEditor(options = {}) {
      if (
        submitting ||
        pendingConfirmation ||
        (stateLoading && !options.allowUnloaded)
      ) return false;
      if (!options.allowUnloaded && !state.enabled) {
        setStatus(elements.pageStatus, errorMessage("DISABLED"), "warning");
        return false;
      }
      if (!options.allowUnloaded && !state.viewerUserId) {
        setStatus(elements.pageStatus, "Sign in to Roblox, then close and reopen Join Scheduler.", "error");
        return false;
      }
      lastFocus = root.activeElement;
      resetEditor();
      setSchedulerView("editor", options.title || "New Schedule");
      focusEditorTarget(options.focus || "search");
      return true;
    }

    function applyOfficialDraft(draft) {
      officialDraft = {
        universeId: String(draft.universeId),
        placeId: String(draft.placeId),
        gameName: String(draft.gameName || "Roblox game"),
        title: String(draft.title || draft.gameName || "Roblox event"),
        startAt: Number(draft.startAt),
        endAt: Number(draft.endAt) || null,
        eventId: draft.eventId ? String(draft.eventId) : null
      };
      showSelectedGame({
        universeId: officialDraft.universeId,
        placeId: officialDraft.placeId,
        name: officialDraft.gameName,
        creatorName: "",
        playerCount: null,
        thumbnailUrl: thumbnails.get(officialDraft.universeId) || null
      });
      elements.scheduleTime.value = toDatetimeLocal(officialDraft.startAt);
      elements.scheduleTime.readOnly = true;
      elements.scheduleTime.setAttribute("aria-readonly", "true");
      elements.officialEvent.hidden = false;
      elements.officialTitle.textContent = officialDraft.title;
      elements.officialTime.textContent = formatDateTime(officialDraft.startAt);
      updateMode();
    }

    function openEditorForDraft(draft, allowUnloaded = false) {
      if (!openEditor({
        focus: "heading",
        title: "New Schedule",
        allowUnloaded
      })) return false;
      applyOfficialDraft(draft);
      focusEditorTarget("heading");
      return true;
    }

    function openEditorForSchedule(schedule) {
      if (!openEditor({ focus: "heading", title: "Edit Schedule" })) return false;
      editingScheduleId = schedule.id;
      editingScheduleRevision = Number.isSafeInteger(schedule.revision) &&
        schedule.revision > 0 ? schedule.revision : null;
      showSelectedGame({
        universeId: schedule.universeId,
        placeId: schedule.placeId,
        name: schedule.gameName,
        creatorName: "",
        playerCount: null,
        thumbnailUrl: thumbnails.get(schedule.universeId) || null
      });
      elements.scheduleTime.value = toDatetimeLocal(schedule.startAt);
      const modeInput = elements.form.querySelector(
        `input[name="schedule-mode"][value="${schedule.mode === "auto" ? "auto" : "notify"}"]`
      );
      if (modeInput) modeInput.checked = true;
      const destination = getDestination(schedule.destinationId);
      const destinationValue = destination?.type && destination.type !== "public"
        ? "private"
        : "public";
      const destinationInput = elements.form.querySelector(
        `input[name="destination-type"][value="${destinationValue}"]`
      );
      if (destinationInput) destinationInput.checked = true;
      if (schedule.eventId) {
        applyOfficialDraft({
          universeId: schedule.universeId,
          placeId: schedule.placeId,
          gameName: schedule.gameName,
          title: schedule.title,
          startAt: schedule.startAt,
          endAt: schedule.endAt,
          eventId: schedule.eventId
        });
      }
      elements.autoJoinConsent.checked = false;
      elements.allowSwitch.checked = false;
      renderDestinations(schedule.destinationId);
      updateMode();
      focusEditorTarget("heading");
      return true;
    }

    function closeEditor(force = false) {
      if (activeView !== "editor") return;
      if (submitting && submitPhase !== "permission" && !force) {
        setStatus(elements.formStatus, "Wait for the current scheduling request to finish.", "warning");
        return;
      }
      if (draftLoading) elements.submit.disabled = false;
      draftLoading = false;
      elements.editor.removeAttribute("aria-busy");
      settleInlineConfirmation(false, false);
      const focusTarget = lastFocus;
      lastFocus = null;
      setSchedulerView("list");
      if (focusTarget?.isConnected && typeof focusTarget.focus === "function") {
        focusTarget.focus();
      } else {
        const fallback = !elements.newSchedule.disabled
          ? elements.newSchedule
          : elements.schedulerTitle;
        fallback.focus();
      }
    }

    function renderSearchResults(results) {
      elements.searchResults.replaceChildren();
      searchItems = results.slice(0, MAX_SEARCH_RESULTS);
      activeSearchIndex = searchItems.length ? 0 : -1;
      searchItems.forEach((game, index) => {
        const item = makeElement("li");
        item.setAttribute("role", "presentation");
        const button = makeElement("button", "search-result");
        button.type = "button";
        button.id = `game-search-result-${index}`;
        button.setAttribute("role", "option");
        button.setAttribute("aria-selected", index === activeSearchIndex ? "true" : "false");
        button.dataset.searchIndex = String(index);
        const thumbnail = makeElement("span", "search-result__thumbnail");
        thumbnail.setAttribute("aria-hidden", "true");
        addThumbnail(thumbnail, game.thumbnailUrl, game.name);
        const copy = makeElement("span");
        copy.append(makeElement("strong", "", game.name));
        const details = game.creatorName
          ? `By ${game.creatorName}`
          : `Universe ${game.universeId}`;
        copy.append(makeElement("small", "", details));
        button.append(thumbnail, copy);
        item.append(button);
        elements.searchResults.append(item);
      });
      elements.searchResults.hidden = searchItems.length === 0;
      elements.search.setAttribute("aria-expanded", searchItems.length ? "true" : "false");
      updateActiveSearchResult();
    }

    function updateActiveSearchResult() {
      const options = Array.from(elements.searchResults.querySelectorAll("[role='option']"));
      options.forEach((option, index) => {
        option.setAttribute("aria-selected", index === activeSearchIndex ? "true" : "false");
      });
      const active = options[activeSearchIndex];
      if (active) {
        elements.search.setAttribute("aria-activedescendant", active.id);
        active.scrollIntoView({ block: "nearest" });
      } else {
        elements.search.removeAttribute("aria-activedescendant");
      }
    }

    async function runSearch(rawQuery, sequence) {
      const searchQuery = rawQuery.replace(/\s+/g, " ").trim();
      if (searchQuery.length < 2) {
        clearSearch();
        return;
      }
      setStatus(elements.searchStatus, "Searching Roblox...");
      try {
        const response = await api("search-games", {
          query: searchQuery,
          locale: navigator.language || "en-US"
        });
        if (sequence !== searchSequence || elements.search.value.trim() !== rawQuery.trim()) return;
        const results = (Array.isArray(response.results) ? response.results : [])
          .map(normalizeGame)
          .filter(Boolean);
        renderSearchResults(results);
        setStatus(
          elements.searchStatus,
          results.length ? `${results.length} Roblox games found` : "No matching games found"
        );
      } catch (error) {
        if (sequence !== searchSequence) return;
        if (!await recoverFromAccountError(error)) {
          renderSearchResults([]);
          setStatus(elements.searchStatus, errorMessage(error.code));
        }
      }
    }

    function scheduleSearch() {
      const rawQuery = elements.search.value;
      selectedGame = null;
      officialDraft = null;
      elements.officialEvent.hidden = true;
      elements.confirmUnverified.checked = false;
      elements.unverifiedConfirm.hidden = true;
      setStatus(elements.validation, "");
      if (searchTimer) clearTimeout(searchTimer);
      const sequence = ++searchSequence;
      if (rawQuery.trim().length < 2) {
        renderSearchResults([]);
        setStatus(elements.searchStatus, rawQuery.trim() ? "Type at least 2 characters" : "");
        return;
      }
      searchTimer = setTimeout(() => {
        searchTimer = null;
        void runSearch(rawQuery, sequence);
      }, SEARCH_DELAY_MS);
    }

    function selectSearchIndex(index) {
      const game = searchItems[index];
      if (game) showSelectedGame(game);
    }

    function requestNotificationPermission() {
      return api("request-notification-permission", {}, { omitViewer: true })
        .then((response) => response.granted === true);
    }

    function validateFormSynchronously() {
      if (!state.viewerUserId) {
        setStatus(elements.formStatus, "Sign in to Roblox, then close and reopen Join Scheduler.", "error");
        return null;
      }
      if (!selectedGame) {
        setStatus(elements.formStatus, "Choose a Roblox game first.", "error");
        elements.search.hidden = false;
        elements.search.focus();
        return null;
      }
      const startAt = parseDatetimeLocal(elements.scheduleTime.value);
      if (!startAt || startAt <= Date.now()) {
        setStatus(elements.formStatus, "Choose a time in the future.", "error");
        elements.scheduleTime.setAttribute("aria-invalid", "true");
        elements.scheduleTime.focus();
        return null;
      }
      elements.scheduleTime.removeAttribute("aria-invalid");
      const mode = modeValue();
      if (mode === "auto" && !elements.autoJoinConsent.checked) {
        setStatus(elements.formStatus, "Confirm the automatic join attempt.", "error");
        elements.autoJoinConsent.focus();
        return null;
      }
      const destinationType = destinationTypeValue();
      const privateUrl = elements.privateUrlInput.value.trim() ||
        String(pendingValidationSecret?.value || "").trim();
      if (privateUrl.length > PRIVATE_URL_MAX_LENGTH) {
        setStatus(elements.formStatus, "That private-server link is too long.", "error");
        elements.privateUrlInput.focus();
        return null;
      }
      const hasNewPrivate = destinationType === "private" &&
        Boolean(privateUrl);
      const destinationId = elements.savedDestination.value || null;
      if (destinationType === "private" && !hasNewPrivate && !destinationId) {
        setStatus(elements.formStatus, "Paste a private-server link or choose a saved one.", "error");
        elements.privateUrlInput.focus();
        return null;
      }
      return {
        startAt,
        mode,
        destinationType,
        hasNewPrivate,
        destinationId,
        privateUrl
      };
    }

    async function saveNewPrivateDestination(rawUrl, snapshot) {
      const response = await api("save-destination", {
        universeId: snapshot.game.universeId,
        placeId: snapshot.game.placeId,
        gameName: snapshot.game.name,
        url: rawUrl,
        confirmUnverified: snapshot.confirmUnverified
      });
      if (response.requiresConfirmation) {
        elements.unverifiedConfirm.hidden = false;
        throw Object.assign(new Error("confirmation"), { code: "PRIVATE_LINK_UNVERIFIED" });
      }
      if (!response.destination?.id) {
        throw Object.assign(new Error("destination"), { code: "UNAVAILABLE" });
      }
      state.destinations = [
        response.destination,
        ...state.destinations.filter((item) => item.id !== response.destination.id)
      ];
      return response.destination.id;
    }

    async function submitSchedule(event) {
      if (!isTrustedEvent(event)) return;
      event.preventDefault();
      if (submitting || pendingConfirmation || draftLoading || stateLoading) return;
      setStatus(elements.formStatus, "");
      const formValues = validateFormSynchronously();
      if (!formValues) return;

      // This call starts synchronously inside the user's submit gesture.
      const permissionRequest = requestNotificationPermission();
      const privateSecret = {
        value: formValues.hasNewPrivate ? formValues.privateUrl : ""
      };
      pendingPrivateSecret = privateSecret;
      if (pendingValidationSecret) pendingValidationSecret.value = "";
      pendingValidationSecret = null;
      const submitSnapshot = Object.freeze({
        epoch: interactionEpoch,
        viewEpoch,
        viewerUserId: state.viewerUserId,
        game: Object.freeze({ ...selectedGame }),
        officialDraft: officialDraft ? Object.freeze({ ...officialDraft }) : null,
        scheduleId: editingScheduleId,
        expectedRevision: editingScheduleId ? editingScheduleRevision : null,
        startAt: formValues.startAt,
        mode: formValues.mode,
        destinationType: formValues.destinationType,
        destinationId: formValues.destinationId,
        hasNewPrivate: formValues.hasNewPrivate,
        confirmUnverified: !elements.unverifiedConfirm.hidden &&
          elements.confirmUnverified.checked,
        allowSwitch: formValues.mode === "auto" && elements.allowSwitch.checked,
        autoJoinConsent: formValues.mode === "auto" && elements.autoJoinConsent.checked
      });
      if (formValues.hasNewPrivate) elements.privateUrlInput.value = "";
      submitting = true;
      submitPhase = "permission";
      setBusy(elements.submit, true, "Scheduling...");
      try {
        const permissionGranted = await permissionRequest;
        if (!permissionGranted) {
          throw Object.assign(new Error("permission"), { code: "PERMISSION_DENIED" });
        }
        const contextIsCurrent = () =>
          !destroyed &&
          root.host?.isConnected === true &&
          submitting &&
          activeView === "editor" &&
          viewEpoch === submitSnapshot.viewEpoch &&
          interactionEpoch === submitSnapshot.epoch &&
          state.viewerUserId === submitSnapshot.viewerUserId;
        if (!contextIsCurrent()) return;
        submitPhase = "mutation";
        let destinationId = submitSnapshot.destinationId;
        if (submitSnapshot.hasNewPrivate) {
          const privateUrl = privateSecret.value;
          privateSecret.value = "";
          if (!privateUrl) return;
          destinationId = await saveNewPrivateDestination(privateUrl, submitSnapshot);
          elements.privateUrlInput.value = "";
        }
        if (!contextIsCurrent()) return;
        const response = await api("create-schedule", {
          scheduleId: submitSnapshot.scheduleId,
          expectedRevision: submitSnapshot.expectedRevision,
          universeId: submitSnapshot.game.universeId,
          placeId: submitSnapshot.game.placeId,
          gameName: submitSnapshot.game.name,
          title: submitSnapshot.officialDraft?.title || submitSnapshot.game.name,
          startAt: submitSnapshot.officialDraft?.startAt || submitSnapshot.startAt,
          endAt: submitSnapshot.officialDraft?.endAt || null,
          eventId: submitSnapshot.officialDraft?.eventId || null,
          mode: submitSnapshot.mode,
          allowSwitch: submitSnapshot.allowSwitch,
          autoJoinConsent: submitSnapshot.autoJoinConsent,
          destinationType: submitSnapshot.destinationType === "private" ? "saved" : "public",
          destinationId: submitSnapshot.destinationType === "private" ? destinationId : null
        });
        if (!contextIsCurrent()) return;
        if (response.schedule) {
          state.schedules = [
            ...state.schedules.filter((item) => item.id !== response.schedule.id),
            response.schedule
          ].sort((left, right) => left.startAt - right.startAt);
        }
        renderSchedules();
        closeEditor(true);
        void hydrateGameIcons().catch(() => undefined);
        setStatus(
          elements.pageStatus,
          submitSnapshot.mode === "auto" ? "Auto-join scheduled." : "Reminder scheduled.",
          "success"
        );
      } catch (error) {
        if (
          !await recoverFromStaleScheduleError(error, Boolean(submitSnapshot.scheduleId)) &&
          !await recoverFromAccountError(error)
        ) {
          const copy = error?.code === "PRIVATE_LINK_UNVERIFIED"
            ? "The link could not be matched to the game. Paste it again, press Check link, and confirm the warning."
            : errorMessage(error.code);
          setStatus(elements.formStatus, copy, error?.code === "PRIVATE_LINK_UNVERIFIED" ? "warning" : "error");
        }
      } finally {
        privateSecret.value = "";
        if (pendingPrivateSecret === privateSecret) pendingPrivateSecret = null;
        submitting = false;
        submitPhase = "idle";
        setBusy(elements.submit, false);
        updateSubmitCopy();
      }
    }

    async function validatePrivate(secretHolder, expectedInteractionEpoch) {
      if (validating) return;
      setStatus(elements.validation, "");
      if (!selectedGame) {
        if (secretHolder) secretHolder.value = "";
        if (pendingValidationSecret === secretHolder) pendingValidationSecret = null;
        setStatus(elements.validation, "Choose a game first.", "error");
        return;
      }
      const rawUrl = String(secretHolder?.value || "").trim();
      if (!rawUrl) {
        if (secretHolder) secretHolder.value = "";
        if (pendingValidationSecret === secretHolder) pendingValidationSecret = null;
        setStatus(elements.validation, "Paste a Roblox private-server link first.", "error");
        elements.privateUrlInput.focus();
        return;
      }
      if (rawUrl.length > PRIVATE_URL_MAX_LENGTH) {
        secretHolder.value = "";
        if (pendingValidationSecret === secretHolder) pendingValidationSecret = null;
        setStatus(elements.validation, "That private-server link is too long.", "error");
        elements.privateUrlInput.focus();
        return;
      }
      const button = query("[data-action='validate-private']");
      const sequence = ++destinationValidationSequence;
      const expectedUniverseId = selectedGame.universeId;
      const expectedPlaceId = selectedGame.placeId;
      validating = true;
      let retainSecret = false;
      setBusy(button, true, "Checking...");
      try {
        const pendingRequest = api("validate-destination", {
          universeId: expectedUniverseId,
          placeId: expectedPlaceId,
          url: rawUrl
        });
        const response = await pendingRequest;
        if (
          sequence !== destinationValidationSequence ||
          interactionEpoch !== expectedInteractionEpoch ||
          root.host?.isConnected !== true ||
          pendingValidationSecret !== secretHolder ||
          selectedGame?.universeId !== expectedUniverseId ||
          selectedGame?.placeId !== expectedPlaceId
        ) {
          return;
        }
        retainSecret = true;
        const destination = response.destination;
        elements.unverifiedConfirm.hidden = !destination?.requiresConfirmation;
        elements.confirmUnverified.checked = false;
        if (destination?.verified) {
          setStatus(elements.validation, "Link verified for this game.", "success");
        } else {
          setStatus(
            elements.validation,
            "Roblox did not expose the game behind this modern link. Confirm below to save it without public fallback.",
            "warning"
          );
        }
      } catch (error) {
        if (sequence !== destinationValidationSequence) return;
        if (!await recoverFromAccountError(error)) {
          elements.unverifiedConfirm.hidden = true;
          elements.confirmUnverified.checked = false;
          setStatus(elements.validation, errorMessage(error.code), "error");
        }
      } finally {
        if (!retainSecret) {
          secretHolder.value = "";
          if (pendingValidationSecret === secretHolder) pendingValidationSecret = null;
        }
        validating = false;
        setBusy(button, false);
      }
    }

    function confirmAction(title, copy, actionLabel, origin, guard = null) {
      if (
        destroyed ||
        pendingConfirmation ||
        !origin?.isConnected ||
        !elements.schedulerDialog.open
      ) {
        return Promise.resolve(false);
      }
      elements.confirmTitle.textContent = title;
      elements.confirmCopy.textContent = copy;
      setFoundationButtonLabel(elements.confirmAction, actionLabel);
      const focusTarget = root.activeElement;
      const viewRoot = activeView === "editor" ? elements.editor : elements.listView;
      const footerRoot = activeView === "editor"
        ? elements.editorFooterActions
        : elements.listFooterActions;
      origin.append(elements.inlineConfirm);
      origin.dataset.confirmOpen = "true";
      elements.inlineConfirm.hidden = false;
      const controls = [viewRoot, footerRoot]
        .flatMap((scope) => Array.from(scope.querySelectorAll("button, input, select")))
        .filter((control) => !elements.inlineConfirm.contains(control))
        .map((control) => ({ control, disabled: control.disabled }));
      for (const { control } of controls) control.disabled = true;
      return new Promise((resolve) => {
        const pending = {
          resolve,
          origin,
          controls,
          focusTarget,
          guard: typeof guard === "function" ? guard : null,
          interactionEpoch,
          viewEpoch,
          view: activeView,
          viewerUserId: state.viewerUserId
        };
        pendingConfirmation = pending;
        ownerDocument.defaultView?.setTimeout?.(() => {
          if (pendingConfirmation === pending) elements.confirmCancel.focus();
        }, 0);
      });
    }

    async function handleScheduleAction(button) {
      if (pendingConfirmation || stateLoading) return;
      const schedule = state.schedules.find((item) => item.id === button.dataset.scheduleId);
      if (!schedule) return;
      const action = button.dataset.scheduleAction;
      if (action === "edit") {
        openEditorForSchedule(schedule);
        return;
      }
      const focusIntent = captureScheduleFocusIntent(schedule, action);
      if (action === "remove") {
        const expectedViewerUserId = state.viewerUserId;
        const expectedRevision = schedule.revision;
        const confirmed = await confirmAction(
          "Remove schedule?",
          `${schedule.gameName} will no longer remind or join you, and it will be removed from this list.`,
          "Remove",
          button.closest(".schedule-card"),
          () => {
            const current = state.schedules.find((item) => item.id === schedule.id);
            return Boolean(
              current &&
              state.viewerUserId === expectedViewerUserId &&
              current.revision === expectedRevision
            );
          }
        );
        if (!confirmed) return;
      }
      setBusy(button, true, action === "join" ? "Joining..." : "Working...");
      try {
        if (action === "join") {
          await api("join-now", {
            scheduleId: schedule.id,
            expectedRevision: schedule.revision
          });
          setStatus(elements.pageStatus, "Join attempt started.", "success");
        } else if (action === "remove") {
          await api("delete-schedule", {
            scheduleId: schedule.id,
            expectedRevision: schedule.revision
          });
          setStatus(elements.pageStatus, "Schedule removed.", "success");
        }
        await loadState();
      } catch (error) {
        if (
          !await recoverFromStaleScheduleError(error) &&
          !await recoverFromAccountError(error)
        ) {
          setStatus(elements.pageStatus, errorMessage(error.code), "error");
        }
      } finally {
        setBusy(button, false);
        restoreScheduleFocus(focusIntent);
      }
    }

    async function testPrivateDestination() {
      const destinationId = elements.savedDestination.value;
      if (!destinationId) return;
      setBusy(elements.testPrivate, true, "Opening...");
      try {
        await api("join-now", { destinationId, testOnly: true });
        setStatus(elements.formStatus, "Private-server launch started.", "success");
      } catch (error) {
        if (!await recoverFromAccountError(error)) {
          setStatus(elements.formStatus, errorMessage(error.code), "error");
        }
      } finally {
        setBusy(elements.testPrivate, false);
      }
    }

    async function deletePrivateDestination() {
      if (pendingConfirmation) return;
      const destinationId = elements.savedDestination.value;
      if (!destinationId) return;
      const destination = getDestination(destinationId);
      const expectedViewerUserId = state.viewerUserId;
      clearPrivateEntry();
      const confirmed = await confirmAction(
        "Remove private server?",
        "Schedules using it will be canceled. The private-server code cannot be recovered from RoTool.",
        "Remove",
        elements.savedDestinations,
        () => Boolean(
          state.viewerUserId === expectedViewerUserId &&
          state.destinations.some((item) => item.id === destinationId)
        )
      );
      if (!confirmed) return;
      setBusy(elements.deletePrivate, true, "Removing...");
      try {
        const response = await api("delete-destination", { destinationId });
        state.destinations = state.destinations.filter((item) => item.id !== destinationId);
        renderDestinations();
        await loadState();
        setStatus(
          elements.formStatus,
          response.canceledSchedules
            ? `Private server removed; ${response.canceledSchedules} linked schedule(s) canceled.`
            : `${destination?.label || "Private server"} removed.`,
          "success"
        );
      } catch (error) {
        if (!await recoverFromAccountError(error)) {
          setStatus(elements.formStatus, errorMessage(error.code), "error");
        }
      } finally {
        setBusy(elements.deletePrivate, false);
        restoreDestinationFocus();
      }
    }

    elements.confirmCancel.addEventListener("click", (event) => {
      if (!isTrustedEvent(event)) return;
      settleInlineConfirmation(false);
    });
    elements.confirmAction.addEventListener("click", (event) => {
      if (!isTrustedEvent(event)) return;
      settleInlineConfirmation(true);
    });
    queryAll("[data-action='new-schedule']").forEach((button) => {
      button.addEventListener("click", (event) => {
        if (!isTrustedEvent(event) || pendingConfirmation || stateLoading) return;
        openEditor();
      });
    });
    queryAll("[data-action='close-editor']").forEach((button) => {
      button.addEventListener("click", (event) => {
        if (!isTrustedEvent(event)) return;
        if (pendingConfirmation) {
          settleInlineConfirmation(false);
          return;
        }
        closeEditor();
      });
    });
    query("[data-action='close-scheduler']")?.addEventListener("click", (event) => {
      if (!isTrustedEvent(event)) return;
      if (submitting && submitPhase !== "permission") {
        setStatus(
          activeView === "editor" ? elements.formStatus : elements.pageStatus,
          "Wait for the current scheduling request to finish.",
          "warning"
        );
        return;
      }
      options.onRequestClose?.();
    });
    query("[data-action='change-game']")?.addEventListener("click", (event) => {
      if (
        !isTrustedEvent(event) ||
        submitting ||
        pendingConfirmation ||
        draftLoading ||
        stateLoading
      ) return;
      invalidateInteraction();
      clearPrivateEntry();
      selectedGame = null;
      officialDraft = null;
      elements.selectedGame.hidden = true;
      elements.officialEvent.hidden = true;
      elements.scheduleTime.readOnly = false;
      elements.scheduleTime.removeAttribute("aria-readonly");
      elements.search.hidden = false;
      elements.selectionHelp.hidden = false;
      renderDestinations();
      elements.search.focus();
    });
    query("[data-action='validate-private']")?.addEventListener("click", (event) => {
      if (
        !isTrustedEvent(event) ||
        validating ||
        submitting ||
        pendingConfirmation ||
        draftLoading ||
        stateLoading
      ) return;
      const secretHolder = { value: elements.privateUrlInput.value.trim() };
      if (pendingValidationSecret) pendingValidationSecret.value = "";
      pendingValidationSecret = secretHolder;
      elements.privateUrlInput.value = "";
      void validatePrivate(secretHolder, interactionEpoch);
    });
    elements.testPrivate.addEventListener("click", (event) => {
      if (
        !isTrustedEvent(event) ||
        submitting ||
        pendingConfirmation ||
        draftLoading ||
        stateLoading
      ) return;
      void testPrivateDestination();
    });
    elements.deletePrivate.addEventListener("click", (event) => {
      if (
        !isTrustedEvent(event) ||
        submitting ||
        pendingConfirmation ||
        draftLoading ||
        stateLoading
      ) return;
      void deletePrivateDestination();
    });
    elements.form.addEventListener("submit", (event) => void submitSchedule(event));
    elements.form.addEventListener("change", (event) => {
      if (!isTrustedEvent(event)) return;
      if (event.target?.name === "schedule-mode") updateMode();
      if (event.target?.name === "destination-type") {
        if (destinationTypeValue() !== "private") clearPrivateEntry();
        renderDestinations();
      }
    });
    elements.scheduleTime.addEventListener("change", (event) => {
      if (!isTrustedEvent(event)) return;
      updateMode();
    });
    elements.savedDestination.addEventListener("change", (event) => {
      if (!isTrustedEvent(event)) return;
      updateSavedDestinationButtons();
      updateMode();
    });
    elements.privateUrlInput.addEventListener("input", (event) => {
      if (!isTrustedEvent(event)) return;
      if (pendingValidationSecret) pendingValidationSecret.value = "";
      pendingValidationSecret = null;
      destinationValidationSequence += 1;
      elements.confirmUnverified.checked = false;
      elements.unverifiedConfirm.hidden = true;
      setStatus(elements.validation, "");
    });
    elements.search.addEventListener("input", (event) => {
      if (!isTrustedEvent(event) || submitting) return;
      scheduleSearch();
    });
    elements.search.addEventListener("keydown", (event) => {
      if (!isTrustedEvent(event)) return;
      if (!searchItems.length) {
        if (event.key === "Enter") event.preventDefault();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        activeSearchIndex = (activeSearchIndex + direction + searchItems.length) % searchItems.length;
        updateActiveSearchResult();
      } else if (event.key === "Enter") {
        event.preventDefault();
        selectSearchIndex(activeSearchIndex);
      } else if (event.key === "Escape") {
        event.preventDefault();
        clearSearch();
      }
    });
    elements.search.addEventListener("blur", () => {
      setTimeout(() => {
        if (!elements.searchResults.contains(root.activeElement)) clearSearch();
      }, 120);
    });
    elements.searchResults.addEventListener("click", (event) => {
      if (!isTrustedEvent(event) || submitting) return;
      const button = event.target.closest("[data-search-index]");
      if (button) selectSearchIndex(Number(button.dataset.searchIndex));
    });
    elements.list.addEventListener("click", (event) => {
      if (!isTrustedEvent(event) || submitting) return;
      const button = event.target.closest("button[data-schedule-action]");
      if (button) void handleScheduleAction(button);
    });
    elements.schedulerDialog.addEventListener("cancel", (event) => {
      if (!isTrustedEvent(event)) return;
      event.preventDefault();
      if (!elements.searchResults.hidden && activeView === "editor") {
        clearSearch();
        elements.search.focus();
        return;
      }
      if (pendingConfirmation) {
        settleInlineConfirmation(false);
        return;
      }
      if (activeView === "editor") {
        closeEditor();
        return;
      }
      if (submitting && submitPhase !== "permission") {
        setStatus(elements.pageStatus, "Wait for the current scheduling request to finish.", "warning");
        return;
      }
      options.onRequestClose?.();
    });
    elements.schedulerDialog.addEventListener("click", (event) => {
      if (!isTrustedEvent(event)) return;
      if (
        event.target === elements.schedulerDialog &&
        (!submitting || submitPhase === "permission")
      ) {
        if (pendingConfirmation) settleInlineConfirmation(false);
        else if (activeView === "editor") closeEditor();
        else options.onRequestClose?.();
      }
    });
    elements.schedulerDialog.addEventListener("close", () => {
      if (!destroyed) {
        invalidateInteraction();
        options.onRequestClose?.();
      }
    });

    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    elements.timeZone.textContent = zone
      ? `Current time zone: ${zone}`
      : "Uses this device's current time zone.";
    resetEditor();
    setSchedulerView("list");
    updateNewScheduleAvailability();
    const countdownTimer = setInterval(() => {
      if (!ownerDocument.hidden) refreshScheduleCountdowns();
    }, 30_000);

    async function openScheduler(draft = null) {
      if (destroyed || root.host?.isConnected !== true) return false;
      const sequence = ++openSequence;
      const showDialog = () => {
        if (elements.schedulerDialog.open) return;
        if (typeof elements.schedulerDialog.showModal === "function") {
          elements.schedulerDialog.showModal();
        } else {
          elements.schedulerDialog.setAttribute("open", "");
        }
      };
      if (draft) {
        const openedEditor = openEditorForDraft(draft, true);
        if (!openedEditor && activeView !== "editor") setSchedulerView("list");
        showDialog();
        if (!openedEditor) {
          if (activeView === "editor") focusEditorTarget("heading");
          else elements.schedulerTitle.focus();
          return true;
        }
        draftLoading = true;
        elements.editor.setAttribute("aria-busy", "true");
        elements.submit.disabled = true;
        setStatus(elements.formStatus, "Loading your schedules...");
        focusEditorTarget("heading");
        const expectedViewEpoch = viewEpoch;
        const expectedInteractionEpoch = interactionEpoch;
        const finishDraftLoad = (loaded) => {
          if (
            sequence !== openSequence ||
            destroyed ||
            root.host?.isConnected !== true ||
            activeView !== "editor" ||
            viewEpoch !== expectedViewEpoch ||
            interactionEpoch !== expectedInteractionEpoch
          ) {
            return;
          }
          draftLoading = false;
          elements.editor.removeAttribute("aria-busy");
          elements.submit.disabled = false;
          if (!loaded || !state.viewerUserId || !state.enabled) {
            closeEditor(true);
            return;
          }
          renderDestinations();
          updateMode();
          setStatus(elements.formStatus, "");
        };
        void loadState(state.viewerUserId === null).then(
          () => finishDraftLoad(true),
          () => finishDraftLoad(false)
        );
        return true;
      }

      if (!elements.schedulerDialog.open) setSchedulerView("list");
      showDialog();
      const focusNewAfterLoad = activeView === "list";
      const expectedViewEpoch = viewEpoch;
      const pendingState = loadState(state.viewerUserId === null);
      if (focusNewAfterLoad) elements.schedulerTitle.focus();
      else focusEditorTarget("heading");
      void pendingState.catch(() => undefined).then(() => {
        if (
          sequence !== openSequence ||
          destroyed ||
          root.host?.isConnected !== true ||
          !elements.schedulerDialog.open ||
          activeView !== "list" ||
          viewEpoch !== expectedViewEpoch ||
          stateLoading ||
          elements.newSchedule.disabled
        ) return;
        elements.newSchedule.focus();
      });
      return true;
    }

    function destroyScheduler() {
      if (destroyed) return;
      settleInlineConfirmation(false, false);
      destroyed = true;
      openSequence += 1;
      invalidateInteraction();
      stateLoadSequence += 1;
      gameIconLoadSequence += 1;
      destinationValidationSequence += 1;
      searchSequence += 1;
      clearInterval(countdownTimer);
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = null;
      elements.privateUrlInput.value = "";
      elements.search.value = "";
      if (elements.schedulerDialog.open) elements.schedulerDialog.close();
      helpTips.destroy();
      root.replaceChildren();
    }

    return Object.freeze({
      open: openScheduler,
      destroy: destroyScheduler,
      isOpen: () => !destroyed && elements.schedulerDialog.open === true
    });
  }

  async function fetchOwnedResource(path) {
    const url = chrome.runtime.getURL(path);
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "omit",
      redirect: "error"
    });
    if (!response.ok || response.url !== url) throw new Error("scheduler-resource");
    const statedLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(statedLength) && statedLength > RESOURCE_MAX_BYTES) {
      throw new Error("scheduler-resource-size");
    }
    const text = await response.text();
    if (text.length > RESOURCE_MAX_BYTES) throw new Error("scheduler-resource-size");
    return text;
  }

  function parseOwnedTemplate(markup) {
    const parsed = new DOMParser().parseFromString(markup, "text/html");
    const template = parsed.getElementById("rsl-join-scheduler-template");
    const documentElements = [
      ...Array.from(parsed.head?.children || []),
      ...Array.from(parsed.body?.children || [])
    ];
    if (
      !template ||
      template.tagName !== "TEMPLATE" ||
      documentElements.length !== 1 ||
      documentElements[0] !== template
    ) {
      throw new Error("scheduler-template");
    }
    const content = template.content;
    if (
      content.querySelector(
        "script, link, style, iframe, frame, object, embed, base, meta, source, video, audio"
      )
    ) {
      throw new Error("scheduler-template-active-content");
    }
    for (const element of content.querySelectorAll("*")) {
      for (const attribute of Array.from(element.attributes)) {
        const name = attribute.name.toLowerCase();
        if (name.startsWith("on") || name === "action" || name === "formaction") {
          throw new Error("scheduler-template-handler");
        }
      }
    }
    return content;
  }

  function loadModalAssets() {
    if (!modalAssetsPromise) {
      modalAssetsPromise = Promise.all([
        fetchOwnedResource(TEMPLATE_PATH),
        fetchOwnedResource(STYLE_PATH)
      ]).then(([markup, css]) => {
        if (/@import\b|url\s*\(/i.test(css)) throw new Error("scheduler-style-resource");
        return Object.freeze({
          template: parseOwnedTemplate(markup),
          css
        });
      }).catch((error) => {
        modalAssetsPromise = null;
        throw error;
      });
    }
    return modalAssetsPromise;
  }

  function normalizeSchedulerDraft(raw) {
    if (!raw || typeof raw !== "object") return null;
    const universeId = String(raw.universeId || "").trim();
    const placeId = String(raw.placeId || "").trim();
    const gameName = String(raw.gameName || "").trim();
    const title = String(raw.title || gameName).trim();
    const startAt = Number(raw.startAt);
    const endAt = raw.endAt === null || raw.endAt === undefined
      ? null
      : Number(raw.endAt);
    const eventId = raw.eventId === null || raw.eventId === undefined
      ? null
      : String(raw.eventId).trim();
    if (
      !/^[1-9]\d{0,19}$/.test(universeId) ||
      !/^[1-9]\d{0,19}$/.test(placeId) ||
      !gameName ||
      !title ||
      !Number.isSafeInteger(startAt) ||
      startAt <= Date.now() ||
      (endAt !== null && (!Number.isSafeInteger(endAt) || endAt <= startAt)) ||
      (eventId !== null && !/^(?:\d{1,40}|[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(eventId))
    ) {
      return null;
    }
    return Object.freeze({
      universeId,
      placeId,
      gameName: gameName.slice(0, 100),
      title: title.slice(0, 200),
      startAt,
      endAt,
      eventId
    });
  }

  function detectRobloxTheme() {
    const root = document.documentElement;
    const body = document.body;
    const signal = [
      root?.getAttribute("data-theme"),
      body?.getAttribute("data-theme"),
      root?.className,
      body?.className
    ].filter((value) => typeof value === "string").join(" ");
    if (/\blight\b/i.test(signal)) return "light";
    if (/\bdark\b/i.test(signal)) return "dark";
    return globalThis.matchMedia?.("(prefers-color-scheme: light)")?.matches
      ? "light"
      : "dark";
  }

  function attachThemeSync(host) {
    const sync = () => {
      if (host.isConnected) host.dataset.theme = detectRobloxTheme();
    };
    sync();
    const observer = new MutationObserver(sync);
    if (document.documentElement) {
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-theme"]
      });
    }
    if (document.body) {
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ["class", "data-theme"]
      });
    }
    const colorScheme = globalThis.matchMedia?.("(prefers-color-scheme: light)") || null;
    colorScheme?.addEventListener?.("change", sync);
    return () => {
      observer.disconnect();
      colorScheme?.removeEventListener?.("change", sync);
    };
  }

  async function createModalComponent(expectedEpoch) {
    const assets = await loadModalAssets();
    if (expectedEpoch !== modalLifecycleEpoch) return null;
    const host = document.createElement("div");
    host.id = HOST_ID;
    host.setAttribute("data-rsl-owned", "join-scheduler");
    const shadowRoot = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = assets.css;
    shadowRoot.append(style, document.importNode(assets.template, true));
    (document.body || document.documentElement).append(host);
    hydrateQuickSettingsHelpIcons(shadowRoot);
    const detachTheme = attachThemeSync(host);
    const controller = initialize(shadowRoot, {
      onRequestClose: () => destroyJoinSchedulerModal(true)
    });
    if (!controller || expectedEpoch !== modalLifecycleEpoch) {
      controller?.destroy();
      detachTheme();
      host.remove();
      return null;
    }
    return Object.freeze({ host, controller, detachTheme });
  }

  function destroyJoinSchedulerModal(restoreFocus = true) {
    modalLifecycleEpoch += 1;
    const component = modalComponent;
    modalComponent = null;
    modalComponentPromise = null;
    if (component) {
      component.controller.destroy();
      component.detachTheme();
      component.host.remove();
    }
    const opener = modalOpener;
    modalOpener = null;
    if (restoreFocus && opener?.isConnected && typeof opener.focus === "function") {
      opener.focus();
    }
  }

  async function openJoinSchedulerModal(draft = null, trigger = null) {
    const safeDraft = draft === null ? null : normalizeSchedulerDraft(draft);
    if (draft !== null && !safeDraft) return false;
    if (trigger?.isConnected && typeof trigger.focus === "function") modalOpener = trigger;
    if (modalComponent && !modalComponent.host.isConnected) {
      modalComponent.controller.destroy();
      modalComponent.detachTheme();
      modalComponent = null;
    }
    if (!modalComponent) {
      const epoch = ++modalLifecycleEpoch;
      const pending = createModalComponent(epoch);
      modalComponentPromise = pending;
      const created = await pending.catch(() => null);
      if (modalComponentPromise === pending) modalComponentPromise = null;
      if (!created || epoch !== modalLifecycleEpoch) return false;
      modalComponent = created;
    }
    return modalComponent.controller.open(safeDraft);
  }

  const modalApi = Object.freeze({
    open: openJoinSchedulerModal,
    close: () => destroyJoinSchedulerModal(true),
    destroy: () => destroyJoinSchedulerModal(false),
    isOpen: () => modalComponent?.controller.isOpen() === true
  });

  function handleShowMessage(message, sender, sendResponse) {
    if (
      !message ||
      message.type !== SHOW_MESSAGE_TYPE ||
      sender?.id !== chrome.runtime.id
    ) {
      return false;
    }
    void openJoinSchedulerModal().then((opened) => {
      sendResponse(opened
        ? { ok: true, type: SHOW_MESSAGE_TYPE }
        : { ok: false, type: SHOW_MESSAGE_TYPE });
    }, () => {
      sendResponse({ ok: false, type: SHOW_MESSAGE_TYPE });
    });
    return true;
  }

  Object.assign(existingHooks, {
    toDatetimeLocal,
    parseDatetimeLocal,
    formatDateTime,
    formatCountdown,
    errorMessage,
    normalizeGame,
    normalizeGameIcon,
    bindHelpTips,
    hydrateQuickSettingsHelpIcons,
    normalizeSchedulerDraft,
    parseOwnedTemplate,
    timeoutContract: Object.freeze({
      readOnlyTimeoutMs: READ_ONLY_MESSAGE_TIMEOUT_MS,
      readOnlyOperations: Object.freeze(
        Array.from(READ_ONLY_OPERATIONS)
      )
    }),
    initialize,
    loadModalAssets,
    openJoinSchedulerModal,
    destroyJoinSchedulerModal,
    handleShowMessage,
    modalConstants: Object.freeze({
      hostId: HOST_ID,
      templatePath: TEMPLATE_PATH,
      stylePath: STYLE_PATH,
      showMessageType: SHOW_MESSAGE_TYPE,
      privateUrlMaxLength: PRIVATE_URL_MAX_LENGTH
    })
  });
  globalThis.__rslJoinSchedulerTestHooks = existingHooks;
  globalThis.__rslJoinSchedulerModal = modalApi;

  if (
    !existingHooks.skipInitialize &&
    typeof chrome !== "undefined" &&
    typeof chrome.runtime?.onMessage?.addListener === "function"
  ) {
    chrome.runtime.onMessage.addListener(handleShowMessage);
    globalThis.addEventListener?.("pagehide", () => {
      destroyJoinSchedulerModal(false);
    }, { once: true });
  }
})();
