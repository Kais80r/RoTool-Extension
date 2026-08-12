(() => {
  "use strict";

  const TOAST_ID = "rsl-context-copy-toast";
  const TOAST_VISIBLE_MS = 2_400;
  let toastTimer = null;

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

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) {
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
