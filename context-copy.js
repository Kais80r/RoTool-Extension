(() => {
  "use strict";

  const RUNTIME_SENTINEL = "__rslContextCopyRuntimeV2";
  const RUNTIME_VERSION = 2;
  if (globalThis[RUNTIME_SENTINEL] === RUNTIME_VERSION) {
    return;
  }
  globalThis[RUNTIME_SENTINEL] = RUNTIME_VERSION;

  const TOAST_ID = "rsl-context-copy-toast";
  const TOAST_VISIBLE_MS = 2_400;
  const TARGET_SNAPSHOT_VERSION = 1;
  const TARGET_SNAPSHOT_MAX_AGE_MS = 30_000;
  const TARGET_URL_MAX_LENGTH = 2_048;
  const PLACE_ID_ATTRIBUTES = Object.freeze([
    "data-rsl-quick-play-place-id",
    "data-rsl-experience-place-id",
    "data-rsl-private-server-place-id",
    "data-rsl-game-tile-ccu-place-id",
    "data-rsl-quick-play-host"
  ]);
  const USER_ID_ATTRIBUTES = Object.freeze([
    "data-rsl-best-friend-id",
    "data-rsl-home-friends-owned-id"
  ]);
  const GAME_CARD_SELECTOR = [
    ".game-card-container",
    "[data-testid='game-tile']",
    "[data-testid='wide-game-tile']",
    ".large-game-tile",
    ".featured-game-container"
  ].join(", ");
  let toastTimer = null;
  let lastTargetSnapshot = null;

  function normalizeSnapshotId(value) {
    const id = String(value ?? "").trim();
    return /^[1-9]\d{0,19}$/.test(id) ? id : null;
  }

  function getContextMenuEventElements(event) {
    const path = typeof event?.composedPath === "function"
      ? event.composedPath()
      : [event?.target];
    return path.filter((node) => node?.nodeType === 1);
  }

  function findClosestFromPath(elements, selector) {
    for (const element of elements) {
      try {
        if (element.matches?.(selector)) {
          return element;
        }
        const closest = element.closest?.(selector);
        if (closest) {
          return closest;
        }
      } catch {
        // Ignore DOM supplied by a page experiment that disappeared mid-event.
      }
    }
    return null;
  }

  function readIdAttributeFromPath(elements, attributeNames) {
    for (const attributeName of attributeNames) {
      const owner = findClosestFromPath(elements, `[${attributeName}]`);
      const id = normalizeSnapshotId(owner?.getAttribute?.(attributeName));
      if (id) {
        return id;
      }
    }
    return null;
  }

  function getTargetSourceUrl(elements) {
    let anchor = findClosestFromPath(elements, "a[href]");
    if (!anchor) {
      const card = findClosestFromPath(elements, GAME_CARD_SELECTOR);
      anchor = card?.querySelector?.("a[href]") || null;
    }
    const href = typeof anchor?.href === "string" ? anchor.href : "";
    return href && href.length <= TARGET_URL_MAX_LENGTH ? href : null;
  }

  function captureContextMenuTarget(event) {
    if (event?.isTrusted !== true) {
      return;
    }
    const pageUrl = String(location.href || "");
    if (!pageUrl || pageUrl.length > TARGET_URL_MAX_LENGTH) {
      lastTargetSnapshot = null;
      return;
    }
    const elements = getContextMenuEventElements(event);
    const sourceUrl = getTargetSourceUrl(elements);
    const placeId = readIdAttributeFromPath(elements, PLACE_ID_ATTRIBUTES);
    const userId = readIdAttributeFromPath(elements, USER_ID_ATTRIBUTES);
    if (!sourceUrl && !placeId && !userId) {
      lastTargetSnapshot = null;
      return;
    }
    lastTargetSnapshot = Object.freeze({
      version: TARGET_SNAPSHOT_VERSION,
      capturedAt: Date.now(),
      pageUrl,
      sourceUrl,
      ids: Object.freeze({ placeId, userId })
    });
  }

  function consumeContextMenuTarget() {
    const snapshot = lastTargetSnapshot;
    lastTargetSnapshot = null;
    if (
      !snapshot ||
      snapshot.version !== TARGET_SNAPSHOT_VERSION ||
      Date.now() - snapshot.capturedAt > TARGET_SNAPSHOT_MAX_AGE_MS ||
      snapshot.pageUrl !== String(location.href || "")
    ) {
      return null;
    }
    return snapshot;
  }

  function getToast() {
    let toast = document.getElementById(TOAST_ID);
    if (toast) {
      return toast;
    }

    toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.className = "rsl-context-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.setAttribute("aria-atomic", "true");

    const icon = document.createElement("span");
    icon.className = "rsl-context-toast__icon";
    icon.setAttribute("aria-hidden", "true");

    const message = document.createElement("span");
    message.className = "rsl-context-toast__message";

    toast.append(icon, message);
    (document.body || document.documentElement).append(toast);
    return toast;
  }

  function showToast(message, kind = "success") {
    const toast = getToast();
    const messageNode = toast.querySelector(".rsl-context-toast__message");
    const iconNode = toast.querySelector(".rsl-context-toast__icon");

    toast.dataset.kind = kind === "error" ? "error" : kind === "progress" ? "progress" : "success";
    messageNode.textContent = String(message || "");
    iconNode.textContent = kind === "error" ? "!" : kind === "progress" ? "\u2026" : "\u2713";

    window.clearTimeout(toastTimer);
    toast.dataset.state = "open";

    const visibleFor = kind === "progress" ? 10_000 : TOAST_VISIBLE_MS;
    toastTimer = window.setTimeout(() => {
      toast.dataset.state = "closed";
    }, visibleFor);
  }

  function fallbackCopy(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.setAttribute("aria-hidden", "true");
    textarea.className = "rsl-context-copy-target";
    (document.body || document.documentElement).append(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } finally {
      textarea.remove();
    }
    return copied;
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // The browser can deny Clipboard API access even with a user-triggered
        // extension command. The hidden textarea path works on older builds.
      }
    }

    return fallbackCopy(text);
  }

  document.addEventListener("contextmenu", captureContextMenuTarget, true);

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) {
      return false;
    }

    if (message?.type === "rsl:context-copy-ready") {
      sendResponse({ ok: true, version: RUNTIME_VERSION });
      return false;
    }

    if (message?.type === "rsl:get-context-copy-target") {
      sendResponse({
        ok: true,
        version: TARGET_SNAPSHOT_VERSION,
        snapshot: consumeContextMenuTarget()
      });
      return false;
    }

    if (message?.type === "rsl:show-context-toast") {
      showToast(message.message, message.kind);
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type !== "rsl:copy-context-text" || typeof message.text !== "string") {
      return false;
    }

    const text = message.text;
    if (!text || text.length > 20_000) {
      showToast("That Roblox information could not be copied.", "error");
      sendResponse({ ok: false });
      return false;
    }

    copyText(text)
      .then((copied) => {
        if (!copied) {
          throw new Error("Clipboard write failed");
        }
        showToast(message.confirmation || "Roblox information copied.", "success");
        sendResponse({ ok: true });
      })
      .catch(() => {
        showToast("Your browser blocked the clipboard write.", "error");
        sendResponse({ ok: false });
      });

    return true;
  });
})();
