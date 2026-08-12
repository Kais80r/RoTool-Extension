(() => {
  "use strict";

  const INSTALL_FLAG = "__rotoolBestFriendActionsV1";
  const CARD_ATTRIBUTE = "data-rsl-best-friend-hover-card";
  const ACTION_ATTRIBUTE = "data-rsl-best-friend-action";
  const USER_ID_ATTRIBUTE = "data-rsl-best-friend-user-id";
  const GAME_INSTANCE_ATTRIBUTE = "data-rsl-best-friend-game-instance-id";
  const RESULT_EVENT = "rotool:best-friend-action-result:v1";
  const QUICK_PLAY_SURFACE_ATTRIBUTE = "data-rsl-quick-play-surface";
  const QUICK_PLAY_ACTION_ATTRIBUTE = "data-rsl-quick-play-action";
  const QUICK_PLAY_PLACE_ID_ATTRIBUTE = "data-rsl-quick-play-place-id";
  const QUICK_PLAY_RESULT_EVENT = "rotool:quick-play-result:v1";
  const RANDOM_SERVER_REQUEST_EVENT = "rotool:random-server-request:v1";
  const RANDOM_SERVER_RESPONSE_EVENT = "rotool:random-server-response:v1";
  const RANDOM_SERVER_AUTHORIZATION_MS = 25_000;
  const RANDOM_SERVER_FAILURE_CODES = new Set([
    "empty",
    "failed",
    "invalid",
    "unavailable"
  ]);

  if (globalThis[INSTALL_FLAG] === true) {
    return;
  }
  Object.defineProperty(globalThis, INSTALL_FLAG, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });

  // A response from the isolated content script is only actionable while the
  // exact button that received a real user click owns a live, one-shot entry.
  // Keeping this in MAIN-world closure state prevents an unsolicited response
  // event elsewhere on the page from launching a server.
  const randomServerAuthorizations = new WeakMap();
  const quickPlaySurfaceLocks = new WeakMap();
  const quickPlayButtonLocks = new WeakMap();

  function parseUserId(rawValue) {
    const value = String(rawValue ?? "");
    if (!/^[1-9]\d{0,19}$/.test(value)) {
      return null;
    }
    const numericValue = Number(value);
    return Number.isSafeInteger(numericValue) && numericValue > 0 ? numericValue : null;
  }

  function parseGameInstanceId(rawValue) {
    const value = String(rawValue ?? "");
    if (!value) {
      return "";
    }
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    )
      ? value
      : null;
  }

  function parsePlaceId(rawValue) {
    const value = String(rawValue ?? "");
    if (!/^[1-9]\d{0,15}$/.test(value)) {
      return null;
    }
    const numericValue = Number(value);
    return Number.isSafeInteger(numericValue) && numericValue > 0 ? numericValue : null;
  }

  function queueResult(button, action, code) {
    const dispatch = () => {
      delete button.dataset.rslBestFriendActionPending;
      button.dispatchEvent(
        new CustomEvent(RESULT_EVENT, {
          bubbles: true,
          detail: JSON.stringify({ v: 1, action, code })
        })
      );
    };

    if (typeof queueMicrotask === "function") {
      queueMicrotask(dispatch);
    } else {
      Promise.resolve().then(dispatch);
    }
  }

  function settleAction(button, action, result) {
    if (result && typeof result.then === "function") {
      Promise.resolve(result).then(
        () => queueResult(button, action, "started"),
        () => queueResult(button, action, "failed")
      );
      return;
    }
    queueResult(button, action, "started");
  }

  function restoreAttribute(element, name, snapshot) {
    if (snapshot.present) {
      element.setAttribute(name, snapshot.value);
    } else {
      element.removeAttribute(name);
    }
  }

  function acquireQuickPlaySurfaceLock(surface, button, action) {
    if (quickPlaySurfaceLocks.has(surface)) {
      return false;
    }

    const ownedButtons = Array.from(
      surface.querySelectorAll(`button[${QUICK_PLAY_ACTION_ATTRIBUTE}]`)
    ).filter(
      (candidate) =>
        candidate.closest(`[${QUICK_PLAY_SURFACE_ATTRIBUTE}]`) === surface
    );
    if (!ownedButtons.includes(button)) {
      ownedButtons.push(button);
    }
    const lock = {
      action,
      button,
      surface,
      surfaceBusy: {
        present: surface.hasAttribute("aria-busy"),
        value: surface.getAttribute("aria-busy")
      },
      buttonStates: ownedButtons.map((candidate) => ({
        button: candidate,
        disabled: candidate.disabled,
        busy: {
          present: candidate.hasAttribute("aria-busy"),
          value: candidate.getAttribute("aria-busy")
        }
      }))
    };
    quickPlaySurfaceLocks.set(surface, lock);
    quickPlayButtonLocks.set(button, lock);
    surface.setAttribute("aria-busy", "true");
    for (const state of lock.buttonStates) {
      state.button.disabled = true;
    }
    button.setAttribute("aria-busy", "true");
    return true;
  }

  function releaseQuickPlaySurfaceLock(button) {
    const lock = quickPlayButtonLocks.get(button);
    if (!lock || quickPlaySurfaceLocks.get(lock.surface) !== lock) {
      return false;
    }
    quickPlayButtonLocks.delete(lock.button);
    quickPlaySurfaceLocks.delete(lock.surface);
    restoreAttribute(lock.surface, "aria-busy", lock.surfaceBusy);
    for (const state of lock.buttonStates) {
      state.button.disabled = state.disabled;
      restoreAttribute(state.button, "aria-busy", state.busy);
    }
    return true;
  }

  function queueQuickPlayResult(button, action, code) {
    const dispatch = () => {
      releaseQuickPlaySurfaceLock(button);
      delete button.dataset.rslQuickPlayPending;
      button.dispatchEvent(
        new CustomEvent(QUICK_PLAY_RESULT_EVENT, {
          bubbles: true,
          detail: JSON.stringify({ v: 1, action, code })
        })
      );
    };
    if (typeof queueMicrotask === "function") {
      queueMicrotask(dispatch);
    } else {
      Promise.resolve().then(dispatch);
    }
  }

  function settleQuickPlay(button, action, result) {
    if (result && typeof result.then === "function") {
      Promise.resolve(result).then(
        () => queueQuickPlayResult(button, action, "started"),
        () => queueQuickPlayResult(button, action, "failed")
      );
      return;
    }
    queueQuickPlayResult(button, action, "started");
  }

  function runQuickPlay(button, placeId) {
    const gameLauncher = globalThis.Roblox?.GameLauncher;
    const joinMultiplayerGame = gameLauncher?.joinMultiplayerGame;
    if (typeof joinMultiplayerGame === "function") {
      try {
        const result = Reflect.apply(joinMultiplayerGame, gameLauncher, [placeId]);
        settleQuickPlay(button, "play", result);
      } catch {
        queueQuickPlayResult(button, "play", "failed");
      }
      return;
    }

    const assign = globalThis.location?.assign;
    if (typeof assign !== "function") {
      queueQuickPlayResult(button, "play", "unavailable");
      return;
    }
    try {
      Reflect.apply(assign, globalThis.location, [
        `roblox://experiences/start?placeId=${placeId}`
      ]);
      queueQuickPlayResult(button, "play", "started");
    } catch {
      queueQuickPlayResult(button, "play", "failed");
    }
  }

  function clearRandomServerAuthorization(button, expectedAuthorization) {
    const authorization = randomServerAuthorizations.get(button);
    if (!authorization || (expectedAuthorization && authorization !== expectedAuthorization)) {
      return false;
    }
    randomServerAuthorizations.delete(button);
    globalThis.clearTimeout?.(authorization.timeoutId);
    return true;
  }

  function requestRandomServer(button, surface, placeId) {
    clearRandomServerAuthorization(button);
    const authorization = {
      placeId,
      surface,
      expiresAt: Date.now() + RANDOM_SERVER_AUTHORIZATION_MS,
      timeoutId: null
    };
    try {
      authorization.timeoutId = globalThis.setTimeout(() => {
        if (clearRandomServerAuthorization(button, authorization)) {
          queueQuickPlayResult(button, "random", "failed");
        }
      }, RANDOM_SERVER_AUTHORIZATION_MS);
      randomServerAuthorizations.set(button, authorization);
      button.dispatchEvent(
        new CustomEvent(RANDOM_SERVER_REQUEST_EVENT, {
          bubbles: true,
          detail: JSON.stringify({ v: 1, placeId })
        })
      );
    } catch {
      clearRandomServerAuthorization(button, authorization);
      queueQuickPlayResult(button, "random", "failed");
    }
  }

  function runRandomServer(button, placeId, gameInstanceId) {
    const gameLauncher = globalThis.Roblox?.GameLauncher;
    const joinGameInstance = gameLauncher?.joinGameInstance;
    if (typeof joinGameInstance === "function") {
      try {
        const result = Reflect.apply(joinGameInstance, gameLauncher, [
          placeId,
          gameInstanceId
        ]);
        settleQuickPlay(button, "random", result);
      } catch {
        queueQuickPlayResult(button, "random", "failed");
      }
      return;
    }

    const assign = globalThis.location?.assign;
    if (typeof assign !== "function") {
      queueQuickPlayResult(button, "random", "unavailable");
      return;
    }
    try {
      Reflect.apply(assign, globalThis.location, [
        `roblox://experiences/start?placeId=${placeId}&gameInstanceId=${encodeURIComponent(
          gameInstanceId
        )}`
      ]);
      queueQuickPlayResult(button, "random", "started");
    } catch {
      queueQuickPlayResult(button, "random", "failed");
    }
  }

  function handleRandomServerResponse(event) {
    const button = event.target;
    const authorization = randomServerAuthorizations.get(button);
    if (!authorization) {
      return;
    }
    if (Date.now() >= authorization.expiresAt) {
      clearRandomServerAuthorization(button, authorization);
      queueQuickPlayResult(button, "random", "failed");
      return;
    }

    const surface = button.closest?.(`[${QUICK_PLAY_SURFACE_ATTRIBUTE}]`);
    const placeId = parsePlaceId(button.getAttribute?.(QUICK_PLAY_PLACE_ID_ATTRIBUTE));
    if (
      button.localName !== "button" ||
      button.getAttribute?.(QUICK_PLAY_ACTION_ATTRIBUTE) !== "random" ||
      surface !== authorization.surface ||
      placeId !== authorization.placeId
    ) {
      return;
    }

    let response;
    try {
      response = JSON.parse(typeof event.detail === "string" ? event.detail : "");
    } catch {
      return;
    }
    const responsePlaceId = parsePlaceId(response?.placeId);
    if (response?.v !== 1 || responsePlaceId !== authorization.placeId) {
      return;
    }

    if (response.code !== "ready") {
      if (!RANDOM_SERVER_FAILURE_CODES.has(response.code)) {
        return;
      }
      clearRandomServerAuthorization(button, authorization);
      queueQuickPlayResult(button, "random", response.code);
      return;
    }

    const gameInstanceId = parseGameInstanceId(response.gameInstanceId);
    if (!gameInstanceId) {
      clearRandomServerAuthorization(button, authorization);
      queueQuickPlayResult(button, "random", "invalid");
      return;
    }
    clearRandomServerAuthorization(button, authorization);
    runRandomServer(button, authorization.placeId, gameInstanceId);
  }

  function handleTrustedQuickPlayClick(event) {
    const button = event.target.closest(`[${QUICK_PLAY_ACTION_ATTRIBUTE}]`);
    if (!button) {
      return false;
    }
    if (
      event.button !== 0 ||
      event.altKey === true ||
      event.ctrlKey === true ||
      event.metaKey === true ||
      event.shiftKey === true ||
      button.localName !== "button"
    ) {
      return false;
    }

    const action = button.getAttribute(QUICK_PLAY_ACTION_ATTRIBUTE);
    const surface = button.closest(`[${QUICK_PLAY_SURFACE_ATTRIBUTE}]`);
    if ((action !== "play" && action !== "random") || !surface) {
      return false;
    }

    const activeLock = quickPlaySurfaceLocks.get(surface);
    if (activeLock) {
      if (activeLock.button === button) {
        return false;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      return true;
    }
    if (button.disabled || button.dataset.rslQuickPlayPending === "true") {
      return false;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    button.dataset.rslQuickPlayPending = "true";
    const placeId = parsePlaceId(button.getAttribute(QUICK_PLAY_PLACE_ID_ATTRIBUTE));
    if (placeId === null) {
      queueQuickPlayResult(button, action, "invalid");
      return true;
    }
    if (!acquireQuickPlaySurfaceLock(surface, button, action)) {
      delete button.dataset.rslQuickPlayPending;
      return true;
    }
    if (action === "random") {
      requestRandomServer(button, surface, placeId);
    } else {
      runQuickPlay(button, placeId);
    }
    return true;
  }

  function runJoin(button, userId) {
    const gameInstanceId = parseGameInstanceId(
      button.getAttribute(GAME_INSTANCE_ATTRIBUTE)
    );
    if (gameInstanceId === null) {
      queueResult(button, "join", "invalid");
      return;
    }

    const protocolHandler = globalThis.Roblox?.ProtocolHandlerClientInterface;
    const followPlayerIntoGame = protocolHandler?.followPlayerIntoGame;
    if (typeof followPlayerIntoGame !== "function") {
      queueResult(button, "join", "unavailable");
      return;
    }

    try {
      const result = Reflect.apply(followPlayerIntoGame, protocolHandler, [
        {
          userId,
          joinAttemptId: gameInstanceId,
          joinAttemptOrigin: "JoinUser"
        }
      ]);
      settleAction(button, "join", result);
    } catch {
      queueResult(button, "join", "failed");
    }
  }

  function runChat(button, userId) {
    const chatService = globalThis.CoreRobloxUtilities?.chatService;
    const startChat = chatService?.startDesktopAndMobileWebChat;
    if (typeof startChat !== "function") {
      queueResult(button, "chat", "unavailable");
      return;
    }

    try {
      const result = Reflect.apply(startChat, chatService, [{ userId }]);
      settleAction(button, "chat", result);
    } catch {
      queueResult(button, "chat", "failed");
    }
  }

  function handleTrustedActionClick(event) {
    if (event.isTrusted !== true || typeof event.target?.closest !== "function") {
      return;
    }

    if (handleTrustedQuickPlayClick(event)) {
      return;
    }

    const button = event.target.closest(`[${ACTION_ATTRIBUTE}]`);
    if (
      !button ||
      button.localName !== "button" ||
      !button.closest(`[${CARD_ATTRIBUTE}]`) ||
      button.disabled ||
      button.dataset.rslBestFriendActionPending === "true"
    ) {
      return;
    }

    const action = button.getAttribute(ACTION_ATTRIBUTE);
    if (action !== "join" && action !== "chat") {
      return;
    }

    event.preventDefault();
    button.dataset.rslBestFriendActionPending = "true";
    const userId = parseUserId(button.getAttribute(USER_ID_ATTRIBUTE));
    if (userId === null) {
      queueResult(button, action, "invalid");
      return;
    }

    if (action === "join") {
      runJoin(button, userId);
    } else {
      runChat(button, userId);
    }
  }

  document.addEventListener("click", handleTrustedActionClick, true);
  document.addEventListener(
    RANDOM_SERVER_RESPONSE_EVENT,
    handleRandomServerResponse,
    true
  );
})();
