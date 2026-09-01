"use strict";

const TOOLBAR_POPUP_SETTINGS_MESSAGE_TYPE =
  "rsl:toolbar-popup:open-settings";
const TOOLBAR_POPUP_RECOVERY_MESSAGE_TYPE =
  "rsl:toolbar-popup:open-recovery-snapshots";

const menu = document.getElementById("popup-menu");
const status = document.getElementById("popup-status");
const actions = Array.from(
  document.querySelectorAll("[data-popup-action]")
);
let popupBusy = false;

function showError(message) {
  status.textContent = message;
  status.hidden = false;
}

function clearError() {
  status.textContent = "";
  status.hidden = true;
}

function setBusy(busy) {
  popupBusy = busy;
  for (const action of actions) {
    action.disabled = busy;
  }
  menu?.setAttribute("aria-busy", busy ? "true" : "false");
}

function closePopup() {
  window.close();
}

function openRecoverySnapshots() {
  if (chrome.extension?.inIncognitoContext === true) {
    showError("Recovery Snapshots are unavailable in InPrivate browsing.");
    return;
  }
  clearError();
  setBusy(true);
  chrome.runtime.sendMessage(
    { type: TOOLBAR_POPUP_RECOVERY_MESSAGE_TYPE },
    (response) => {
      const keys = response && typeof response === "object" &&
        !Array.isArray(response)
        ? Object.keys(response).sort()
        : [];
      if (
        !chrome.runtime.lastError &&
        keys.length === 2 &&
        keys[0] === "ok" &&
        keys[1] === "type" &&
        response.ok === true &&
        response.type === TOOLBAR_POPUP_RECOVERY_MESSAGE_TYPE
      ) {
        closePopup();
        return;
      }
      setBusy(false);
      showError("RoTool could not open Recovery Snapshots.");
    }
  );
}

function openRoToolSettings() {
  if (chrome.extension?.inIncognitoContext === true) {
    showError("RoTool Settings are unavailable in InPrivate browsing.");
    return;
  }
  clearError();
  setBusy(true);
  chrome.runtime.sendMessage(
    { type: TOOLBAR_POPUP_SETTINGS_MESSAGE_TYPE },
    (response) => {
      const keys = response && typeof response === "object" &&
        !Array.isArray(response)
        ? Object.keys(response).sort()
        : [];
      if (
        !chrome.runtime.lastError &&
        keys.length === 2 &&
        keys[0] === "ok" &&
        keys[1] === "type" &&
        response.ok === true &&
        response.type === TOOLBAR_POPUP_SETTINGS_MESSAGE_TYPE
      ) {
        closePopup();
        return;
      }
      setBusy(false);
      showError("RoTool could not open Settings.");
    }
  );
}

function activate(action) {
  if (action === "settings") {
    openRoToolSettings();
    return;
  }
  if (action === "archive") {
    openRecoverySnapshots();
  }
}

menu?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-popup-action]");
  if (
    !(button instanceof HTMLButtonElement) ||
    button.disabled ||
    button.hidden
  ) {
    return;
  }
  activate(button.dataset.popupAction);
});

menu?.addEventListener("keydown", (event) => {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
    return;
  }
  event.preventDefault();
  const availableActions = actions.filter(
    (action) => !action.hidden && !action.disabled
  );
  if (availableActions.length === 0) return;
  const currentIndex = availableActions.indexOf(document.activeElement);
  let nextIndex = currentIndex;
  if (event.key === "Home") nextIndex = 0;
  if (event.key === "End") nextIndex = availableActions.length - 1;
  if (event.key === "ArrowDown") {
    nextIndex = (Math.max(currentIndex, -1) + 1) % availableActions.length;
  }
  if (event.key === "ArrowUp") {
    nextIndex = currentIndex <= 0
      ? availableActions.length - 1
      : currentIndex - 1;
  }
  availableActions[nextIndex]?.focus();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closePopup();
  }
});
