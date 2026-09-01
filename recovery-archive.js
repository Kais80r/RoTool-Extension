"use strict";

(() => {
  const MESSAGE_PREFIX = "rsl:account-recovery-archive:";
  const MESSAGE_TYPES = Object.freeze({
    getState: `${MESSAGE_PREFIX}get-state`,
    captureNow: `${MESSAGE_PREFIX}capture-now`,
    getSnapshot: `${MESSAGE_PREFIX}get-snapshot`,
    deleteSnapshot: `${MESSAGE_PREFIX}delete-snapshot`,
    clearAll: `${MESSAGE_PREFIX}clear-all`
  });
  const SECTION_KEYS = Object.freeze([
    "usernameHistory",
    "twoStepVerification",
    "purchases",
    "currencyPurchases",
    "tradeHistory",
    "recentlyPlayed",
    "createdExperiences",
    "violations"
  ]);
  const SECTION_KEY_SET = new Set(SECTION_KEYS);
  const DOCUMENT_ACCOUNT_FIELD_KEYS = Object.freeze([
    "userId",
    "username",
    "displayName",
    "createdAt",
    "accountStatus"
  ]);
  const DOCUMENT_SECTION_ITEM_FIELD_KEYS = Object.freeze({
    usernameHistory: Object.freeze(["username"]),
    twoStepVerification: Object.freeze(["method", "role", "updatedAt"]),
    purchases: Object.freeze([
      "purchasedAt",
      "itemId",
      "itemName",
      "itemType",
      "robuxChange"
    ]),
    currencyPurchases: Object.freeze([
      "purchasedAt",
      "packageId",
      "packageName",
      "robuxReceived"
    ]),
    tradeHistory: Object.freeze([
      "tradeId",
      "tradeCreatedAt",
      "partnerUserId",
      "partnerUsername"
    ]),
    recentlyPlayed: Object.freeze(["name", "universeId", "rootPlaceId"]),
    createdExperiences: Object.freeze([
      "name",
      "universeId",
      "rootPlaceId",
      "createdAt",
      "updatedAt"
    ]),
    violations: Object.freeze([
      "violationId",
      "category",
      "consequence",
      "createdAt",
      "reviewedAt",
      "appealStatus",
      "canAppeal",
      "appealDeadline",
      "assetId",
      "assetName",
      "description"
    ])
  });
  const CAPABILITY_ERROR_CODES = new Set([
    "CAPABILITY_EXPIRED",
    "CAPABILITY_INVALID",
    "INVALID_CAPABILITY",
    "STALE_CAPABILITY"
  ]);
  const SUCCESSFUL_SECTION_STATUSES = new Set(["complete", "partial"]);
  const DOCUMENT_TIMESTAMP_KEYS = new Set([
    "capturedAt",
    "createdAt",
    "updatedAt",
    "purchasedAt",
    "tradeCreatedAt",
    "reviewedAt",
    "appealDeadline"
  ]);
  const DISPLAY_LABELS = new Map([
    ["account", "Account"],
    ["usernameHistory", "Username history"],
    ["twoStepVerification", "Two-step verification"],
    ["purchases", "Item purchases"],
    ["currencyPurchases", "Robux purchases"],
    ["tradeHistory", "Trade history"],
    ["recentlyPlayed", "Recently played"],
    ["createdExperiences", "Created experiences"],
    ["violations", "Violations & Appeals"],
    ["userId", "User ID"],
    ["universeId", "Universe ID"],
    ["rootPlaceId", "Root Place ID"],
    ["placeId", "Place ID"],
    ["assetId", "Asset ID"],
    ["packageId", "Package ID"],
    ["holdId", "Hold ID"],
    ["profileUrl", "Profile URL"],
    ["gameUrl", "Game URL"],
    ["createdAt", "Created"],
    ["updatedAt", "Last updated"],
    ["purchasedAt", "Purchased"],
    ["reviewedAt", "Reviewed"],
    ["appealDeadline", "Appeal deadline"],
    ["robuxChange", "Robux change"],
    ["robuxReceived", "Robux received"],
    ["tradeId", "Trade ID"],
    ["tradeCreatedAt", "Trade created"],
    ["partnerUserId", "Trade partner User ID"],
    ["partnerUsername", "Trade partner username"]
  ]);
  const MAX_SUMMARIES = 128;
  const MAX_TEXT_LENGTH = 8_000;
  const MAX_TABLE_COLUMNS = 16;
  const MAX_NESTED_FIELDS = 32;
  const MAX_NESTING_DEPTH = 6;
  const OMIT_VALUE = Symbol("omit-value");
  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

  class ArchiveUiError extends Error {
    constructor(code, message = "") {
      super(message || code || "ARCHIVE_UNAVAILABLE");
      this.name = "ArchiveUiError";
      this.code = normalizeCode(code) || "ARCHIVE_UNAVAILABLE";
    }
  }

  const elements = Object.freeze({
    window: document.getElementById("archive-window"),
    title: document.getElementById("archive-title"),
    subtitle: document.getElementById("archive-subtitle"),
    back: document.getElementById("archive-back"),
    close: document.getElementById("close-archive"),
    accountsView: document.getElementById("archive-accounts-view"),
    snapshotsView: document.getElementById("archive-snapshots-view"),
    accountList: document.getElementById("account-list"),
    create: document.getElementById("create-snapshot-now"),
    createLabel: document.getElementById("create-snapshot-now-label"),
    refresh: document.getElementById("refresh-archive"),
    status: document.getElementById("archive-status"),
    count: document.getElementById("snapshot-count"),
    clearAll: document.getElementById("clear-all-snapshots"),
    loading: document.getElementById("archive-loading"),
    empty: document.getElementById("archive-empty"),
    list: document.getElementById("snapshot-list"),
    preview: document.getElementById("snapshot-preview"),
    previewTitle: document.getElementById("preview-title"),
    previewCaptureTime: document.getElementById("preview-capture-time"),
    previewTables: document.getElementById("preview-tables"),
    download: document.getElementById("download-snapshot"),
    print: document.getElementById("print-snapshot"),
    deleteSnapshot: document.getElementById("delete-snapshot"),
    confirmDialog: document.getElementById("archive-confirm-dialog"),
    confirmTitle: document.getElementById("confirm-title"),
    confirmDescription: document.getElementById("confirm-description"),
    confirmCancel: document.getElementById("cancel-confirmation"),
    confirmAccept: document.getElementById("accept-confirmation")
  });

  let requestSequence = 0;
  let capability = "";
  let automaticSnapshotsEnabled = false;
  let snapshots = [];
  let archiveView = "accounts";
  let selectedAccountUserId = "";
  let selectedCaptureId = "";
  let currentSnapshot = null;
  let currentDocumentSnapshot = null;
  let pendingConfirmation = null;
  let activeOperations = 0;
  let previewRequestSequence = 0;
  let initialized = false;

  function isRecord(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function normalizeText(value, maxLength = MAX_TEXT_LENGTH) {
    if (typeof value !== "string") return "";
    const text = value
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .trim();
    if (!text) return "";
    return text.slice(0, maxLength);
  }

  function normalizeCode(value) {
    return normalizeText(value, 100)
      .toUpperCase()
      .replace(/[-\s]+/g, "_");
  }

  function normalizeOpaqueId(value, maxLength = 256) {
    const text = normalizeText(value, maxLength);
    return text && !/[\u0000-\u001f\u007f]/.test(text) ? text : "";
  }

  function normalizeCaptureId(value) {
    const text = typeof value === "string" ? value.trim() : "";
    return /^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/.test(text) ? text : "";
  }

  function getInitialCaptureId() {
    try {
      const url = new URL(window.location.href);
      const entries = [...url.searchParams.entries()];
      if (url.hash || entries.length === 0) return "";
      if (entries.length !== 1 || entries[0][0] !== "captureId") return "";
      const captureId = normalizeCaptureId(entries[0][1]);
      const canonical = captureId
        ? `${chrome.runtime.getURL("recovery-archive.html")}?captureId=${encodeURIComponent(captureId)}`
        : "";
      return canonical && canonical === url.href ? captureId : "";
    } catch {
      return "";
    }
  }

  function normalizeAccountUserId(value) {
    const text = typeof value === "number" && Number.isSafeInteger(value)
      ? String(value)
      : normalizeText(value, 24);
    return /^(?:0|[1-9]\d{0,19})$/.test(text) ? text : "";
  }

  function normalizeDate(value) {
    const text = normalizeText(value, 80);
    if (!text) return "";
    const time = Date.parse(text);
    if (!Number.isFinite(time)) return "";
    return new Date(time).toISOString();
  }

  function normalizeSectionSelection(value, fallback = []) {
    if (!Array.isArray(value)) return [...fallback];
    const selected = new Set();
    for (const key of value) {
      if (typeof key === "string" && SECTION_KEY_SET.has(key)) {
        selected.add(key);
      }
    }
    return SECTION_KEYS.filter((key) => selected.has(key));
  }

  function normalizeSnapshotSummary(value) {
    if (!isRecord(value)) return null;
    const captureId = normalizeCaptureId(value.captureId);
    const capturedAt = normalizeDate(value.capturedAt);
    if (!captureId || !capturedAt) return null;
    const byteLength = Number(value.byteLength);
    const trigger = normalizeText(value.trigger, 40).toLowerCase();
    return Object.freeze({
      captureId,
      accountUserId: normalizeAccountUserId(value.accountUserId),
      username: normalizeText(value.username, 100),
      displayName: normalizeText(value.displayName, 100),
      capturedAt,
      byteLength:
        Number.isSafeInteger(byteLength) && byteLength >= 0
          ? byteLength
          : null,
      requestedSections: normalizeSectionSelection(value.requestedSections, []),
      includedSections: normalizeSectionSelection(value.includedSections, []),
      trigger: trigger === "automatic" || trigger === "scheduled"
        ? "automatic"
        : "manual"
    });
  }

  function nextRequestId() {
    requestSequence = requestSequence >= Number.MAX_SAFE_INTEGER
      ? 1
      : requestSequence + 1;
    return requestSequence;
  }

  function updateCapability(response) {
    const nextCapability = normalizeOpaqueId(response?.capability, 512);
    if (nextCapability) capability = nextCapability;
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          const error = chrome.runtime.lastError;
          if (error) {
            reject(new ArchiveUiError("RUNTIME_UNAVAILABLE", error.message));
            return;
          }
          resolve(response);
        });
      } catch (error) {
        reject(
          new ArchiveUiError(
            "RUNTIME_UNAVAILABLE",
            normalizeText(error?.message, 300)
          )
        );
      }
    });
  }

  async function requestArchive(type, payload = {}, options = {}) {
    const requestId = nextRequestId();
    const message = { type, requestId };
    if (options.authorized === true) {
      if (!capability) throw new ArchiveUiError("CAPABILITY_REQUIRED");
      message.capability = capability;
    }
    for (const [key, value] of Object.entries(payload)) message[key] = value;
    const response = await sendRuntimeMessage(message);
    if (
      !isRecord(response) ||
      response.requestId !== requestId ||
      typeof response.ok !== "boolean"
    ) {
      throw new ArchiveUiError("INVALID_RESPONSE");
    }
    updateCapability(response);
    if (response.ok !== true) {
      throw new ArchiveUiError(response.code || "ARCHIVE_UNAVAILABLE");
    }
    return response;
  }

  async function refreshCapability() {
    const response = await requestArchive(MESSAGE_TYPES.getState);
    const nextCapability = normalizeOpaqueId(response.capability, 512);
    if (!nextCapability) throw new ArchiveUiError("INVALID_RESPONSE");
    capability = nextCapability;
  }

  async function requestAuthorized(type, payload = {}, allowRetry = true) {
    try {
      return await requestArchive(type, payload, { authorized: true });
    } catch (error) {
      if (
        allowRetry &&
        error instanceof ArchiveUiError &&
        CAPABILITY_ERROR_CODES.has(error.code)
      ) {
        await refreshCapability();
        return requestAuthorized(type, payload, false);
      }
      throw error;
    }
  }

  function beginOperation(kind = "") {
    activeOperations += 1;
    document.body.dataset.archiveBusy = "true";
    if (kind === "capture") {
      document.body.dataset.archiveCapturing = "true";
      elements.createLabel.textContent = "Creating snapshot…";
    }
    syncDisabledState();
  }

  function endOperation(kind = "") {
    activeOperations = Math.max(0, activeOperations - 1);
    if (kind === "capture") {
      delete document.body.dataset.archiveCapturing;
      elements.createLabel.textContent = "Create snapshot now";
    }
    if (activeOperations === 0) delete document.body.dataset.archiveBusy;
    syncDisabledState();
  }

  function isBusy() {
    return activeOperations > 0;
  }

  function setStatus(message, kind = "") {
    const text = normalizeText(message, 500);
    elements.status.textContent = text;
    elements.status.hidden = !text;
    if (kind) elements.status.dataset.kind = kind;
    else delete elements.status.dataset.kind;
  }

  function mapErrorMessage(error) {
    const code = error instanceof ArchiveUiError
      ? error.code
      : normalizeCode(error?.code);
    switch (code) {
      case "UNAUTHENTICATED":
      case "SIGNED_OUT":
        return "Sign in to Roblox to create a new snapshot. Your saved archive is still available.";
      case "FEATURE_DISABLED":
        return "Recovery Snapshots are turned off in RoTool Settings. Saved snapshots are still available.";
      case "RATE_LIMITED":
        return "Roblox is temporarily limiting requests. Wait a little, then try again.";
      case "ACCOUNT_CHANGED":
        return "The signed-in Roblox account changed during collection. No mixed snapshot was saved.";
      case "RESPONSE_TOO_LARGE":
      case "TOO_LARGE":
        return "The snapshot exceeded the safe local archive size and was not saved.";
      case "SNAPSHOT_NOT_FOUND":
      case "NOT_FOUND":
        return "That saved snapshot no longer exists. Refreshing the archive may help.";
      case "STORAGE_FULL":
      case "QUOTA_EXCEEDED":
        return "The local archive is full. Delete older snapshots, then try again.";
      case "CAPABILITY_REQUIRED":
      case "CAPABILITY_EXPIRED":
      case "CAPABILITY_INVALID":
      case "INVALID_CAPABILITY":
      case "STALE_CAPABILITY":
        return "The archive session expired. Refresh the page and try again.";
      case "INVALID_RESPONSE":
        return "RoTool returned an invalid archive response. Reload the extension and try again.";
      case "RUNTIME_UNAVAILABLE":
        return "The RoTool background service is unavailable. Reload the extension and reopen this page.";
      default:
        return "The archive action could not be completed right now. Please try again.";
    }
  }

  function formatLocalDate(value, options = {}) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "Unknown time";
    try {
      return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: options.compact ? "short" : "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short"
      }).format(date);
    } catch {
      try {
        return date.toLocaleString(undefined, { timeZoneName: "short" });
      } catch {
        return date.toLocaleString();
      }
    }
  }

  function formatByteLength(value) {
    if (!Number.isSafeInteger(value) || value < 0) return "Size unavailable";
    if (value < 1_024) return `${value} B`;
    if (value < 1_048_576) return `${(value / 1_024).toFixed(value < 10_240 ? 1 : 0)} KB`;
    return `${(value / 1_048_576).toFixed(1)} MB`;
  }

  function pluralize(value, singular, plural = `${singular}s`) {
    return `${value} ${value === 1 ? singular : plural}`;
  }

  function getSnapshotAccountKey(summary) {
    if (summary?.accountUserId) return summary.accountUserId;
    const username = normalizeText(summary?.username, 100).toLowerCase();
    return username ? `username:${username}` : "unknown-account";
  }

  function getArchiveAccounts() {
    const byKey = new Map();
    for (const summary of snapshots) {
      const key = getSnapshotAccountKey(summary);
      let account = byKey.get(key);
      if (!account) {
        account = {
          key,
          userId: summary.accountUserId,
          username: summary.username,
          displayName: summary.displayName,
          snapshots: []
        };
        byKey.set(key, account);
      }
      if (!account.username && summary.username) account.username = summary.username;
      if (!account.displayName && summary.displayName) {
        account.displayName = summary.displayName;
      }
      account.snapshots.push(summary);
    }
    return [...byKey.values()];
  }

  function getAccountTitle(account) {
    return normalizeText(account?.displayName, 100) ||
      normalizeText(account?.username, 100) ||
      "Roblox account";
  }

  function getAccountIdentity(account) {
    const parts = [];
    if (account?.username) parts.push(`@${account.username}`);
    if (account?.userId) parts.push(`User ID ${account.userId}`);
    return parts.join(" · ") || "Saved Roblox account";
  }

  function getAccountListIdentity(account) {
    const displayName = normalizeText(account?.displayName, 100);
    const username = normalizeText(account?.username, 100);
    const sameVisibleName = displayName && username &&
      displayName.localeCompare(username, undefined, { sensitivity: "accent" }) === 0;
    const parts = [];
    if (username && !sameVisibleName) parts.push(`@${username}`);
    if (account?.userId) parts.push(`User ID ${account.userId}`);
    return parts.join(" · ") || "Saved Roblox account";
  }

  function getSelectedArchiveAccount() {
    return getArchiveAccounts().find(
      (account) => account.key === selectedAccountUserId
    ) || null;
  }

  function setArchiveView(nextView, options = {}) {
    const normalizedView = ["accounts", "snapshots", "document"].includes(nextView)
      ? nextView
      : "accounts";
    archiveView = normalizedView;
    document.body.dataset.archiveView = normalizedView;
    elements.accountsView.hidden = normalizedView !== "accounts";
    elements.snapshotsView.hidden = normalizedView !== "snapshots";
    elements.preview.hidden = normalizedView !== "document";
    elements.back.hidden = normalizedView === "accounts";

    const account = getSelectedArchiveAccount();
    if (normalizedView === "accounts") {
      elements.title.textContent = "Recovery Snapshots";
      elements.subtitle.textContent = "Saved account recovery snapshots.";
      document.title = "Recovery Snapshots - RoTool";
    } else if (normalizedView === "snapshots") {
      elements.title.textContent = getAccountTitle(account);
      elements.subtitle.textContent = account
        ? `${getAccountIdentity(account)} · ${pluralize(account.snapshots.length, "snapshot")}`
        : "Saved recovery snapshots";
      document.title = `${getAccountTitle(account)} - Recovery Snapshots - RoTool`;
    } else {
      const summary = snapshots.find(
        (entry) => entry.captureId === selectedCaptureId
      );
      elements.title.textContent = "Recovery Snapshot";
      elements.subtitle.textContent = summary
        ? `${getAccountTitle(account)} · ${formatLocalDate(summary.capturedAt, { compact: true })}`
        : getAccountTitle(account);
    }

    if (options.scrollTop !== false) {
      document.querySelector(".rsl-archive-window__viewport")?.scrollTo?.({
        top: 0,
        behavior: options.smooth === true ? "smooth" : "auto"
      });
    }
  }

  function syncDisabledState() {
    const busy = isBusy();
    elements.create.disabled = busy || !initialized;
    elements.refresh.disabled = busy;
    elements.clearAll.disabled = busy || snapshots.length === 0;
    elements.download.disabled = busy || !currentDocumentSnapshot;
    elements.print.disabled = busy || !currentDocumentSnapshot;
    elements.deleteSnapshot.disabled = busy || !selectedCaptureId;
  }

  function clearPreview() {
    selectedCaptureId = "";
    currentSnapshot = null;
    currentDocumentSnapshot = null;
    previewRequestSequence += 1;
    elements.preview.hidden = true;
    elements.previewTables.replaceChildren();
    elements.previewCaptureTime.textContent = "";
    elements.list
      .querySelectorAll("[data-selected]")
      .forEach((item) => item.removeAttribute("data-selected"));
    syncDisabledState();
  }

  function makeTextElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  }

  function makeSvgIcon(kind, className = "") {
    const svg = document.createElementNS(SVG_NAMESPACE, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    if (className) svg.setAttribute("class", className);

    const pathDefinitions = kind === "delete"
      ? [
          "M5 7h14",
          "M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7",
          "M7.5 7l.8 13h7.4l.8-13",
          "M10 10.5v5.5M14 10.5v5.5"
        ]
      : ["M9 6l6 6-6 6"];
    for (const definition of pathDefinitions) {
      const path = document.createElementNS(SVG_NAMESPACE, "path");
      path.setAttribute("d", definition);
      svg.append(path);
    }
    return svg;
  }

  function getAccountInitial(account) {
    const title = getAccountTitle(account).replace(/^@+/, "").trim();
    return (Array.from(title)[0] || "R").toLocaleUpperCase();
  }

  function makeSnapshotListItem(summary) {
    const item = document.createElement("li");
    item.className = "rsl-archive-list__item";
    item.dataset.captureId = summary.captureId;
    if (summary.captureId === selectedCaptureId) item.dataset.selected = "true";

    const open = document.createElement("button");
    open.type = "button";
    open.className = "rsl-archive-list__open";
    open.dataset.openCaptureId = summary.captureId;
    open.setAttribute(
      "aria-label",
      `Open snapshot for ${summary.username || summary.displayName || "Roblox account"}, captured ${formatLocalDate(summary.capturedAt)}`
    );

    const copy = document.createElement("span");
    copy.className = "rsl-archive-list__copy";
    const capturedAt = makeTextElement(
      "time",
      "rsl-archive-list__title",
      formatLocalDate(summary.capturedAt, { compact: true })
    );
    capturedAt.dateTime = summary.capturedAt;

    const meta = document.createElement("span");
    meta.className = "rsl-archive-list__meta";
    meta.append(
      makeTextElement(
        "span",
        "rsl-archive-list__trigger",
        summary.trigger === "automatic" ? "Automatic" : "Manual"
      ),
      makeTextElement(
        "span",
        "",
        pluralize(summary.includedSections.length, "section")
      ),
      makeTextElement("span", "", formatByteLength(summary.byteLength))
    );
    copy.append(capturedAt, meta);
    open.append(
      copy,
      makeSvgIcon("chevron", "rsl-archive-row-chevron")
    );

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "rsl-archive-list__delete";
    remove.dataset.deleteCaptureId = summary.captureId;
    remove.setAttribute(
      "aria-label",
      `Delete snapshot captured ${formatLocalDate(summary.capturedAt)}`
    );
    remove.append(makeSvgIcon("delete", "rsl-archive-delete-icon"));
    item.append(open, remove);
    return item;
  }

  function makeAccountListItem(account) {
    const item = document.createElement("li");
    item.className = "rsl-archive-account-list__item";

    const open = document.createElement("button");
    open.type = "button";
    open.className = "rsl-archive-account-list__open";
    open.dataset.openAccountId = account.key;
    open.setAttribute(
      "aria-label",
      `View ${pluralize(account.snapshots.length, "snapshot")} for ${getAccountTitle(account)}`
    );

    const avatar = document.createElement("span");
    avatar.className = "rsl-archive-account-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = getAccountInitial(account);

    const copy = document.createElement("span");
    copy.className = "rsl-archive-account-list__copy";
    copy.append(
      makeTextElement("strong", "", getAccountTitle(account)),
      makeTextElement("small", "", getAccountListIdentity(account))
    );

    const count = makeTextElement(
      "span",
      "rsl-archive-account-list__count",
      pluralize(account.snapshots.length, "snapshot")
    );
    const chevron = makeSvgIcon("chevron", "rsl-archive-row-chevron");
    open.append(avatar, copy, count, chevron);
    item.append(open);
    return item;
  }

  function renderAccountList() {
    const accounts = getArchiveAccounts();
    const fragment = document.createDocumentFragment();
    for (const account of accounts) fragment.append(makeAccountListItem(account));
    elements.accountList.replaceChildren(fragment);
    elements.loading.hidden = true;
    elements.empty.hidden = snapshots.length !== 0;
    elements.count.textContent = snapshots.length === 0
      ? "No saved snapshots"
      : `${pluralize(accounts.length, "account")} · ${pluralize(snapshots.length, "snapshot")}`;
    elements.clearAll.disabled = isBusy() || snapshots.length === 0;
  }

  function renderSnapshotList() {
    const account = getSelectedArchiveAccount();
    const fragment = document.createDocumentFragment();
    for (const summary of account?.snapshots || []) {
      fragment.append(makeSnapshotListItem(summary));
    }
    elements.list.replaceChildren(fragment);
  }

  function parseStateResponse(response) {
    const nextCapability = normalizeOpaqueId(response?.capability, 512);
    if (!nextCapability) throw new ArchiveUiError("INVALID_RESPONSE");
    const nextSnapshots = Array.isArray(response.snapshots)
      ? response.snapshots
          .slice(0, MAX_SUMMARIES)
          .map(normalizeSnapshotSummary)
          .filter(Boolean)
      : [];
    nextSnapshots.sort(
      (left, right) =>
        Date.parse(right.capturedAt) - Date.parse(left.capturedAt) ||
        right.captureId.localeCompare(left.captureId)
    );
    return {
      capability: nextCapability,
      automaticSnapshotsEnabled:
        response?.recoverySnapshotsEnabled === true &&
        response?.preferences?.enabled === true,
      snapshots: nextSnapshots
    };
  }

  async function loadArchiveState(options = {}) {
    const previousView = archiveView;
    const previousAccountUserId = selectedAccountUserId;
    const previousSelection = normalizeCaptureId(
      options.preferredCaptureId ||
      (previousView === "document" ? selectedCaptureId : "")
    );
    beginOperation("load");
    elements.loading.hidden = snapshots.length > 0;
    try {
      const response = await requestArchive(MESSAGE_TYPES.getState);
      const state = parseStateResponse(response);
      capability = state.capability;
      snapshots = state.snapshots;
      automaticSnapshotsEnabled = state.automaticSnapshotsEnabled;
      initialized = true;
      renderAccountList();

      const preferred = snapshots.find(
        (summary) => summary.captureId === previousSelection
      ) || null;
      if (preferred) {
        selectedAccountUserId = getSnapshotAccountKey(preferred);
        renderSnapshotList();
        await loadSnapshot(preferred.captureId, {
          focus: options.focusPreview === true,
          quiet: true
        });
      } else {
        clearPreview();
        if (options.requirePreferredCaptureId === true && previousSelection) {
          selectedAccountUserId = "";
          setArchiveView("accounts");
          setStatus(mapErrorMessage(new ArchiveUiError("NOT_FOUND")), "error");
          return;
        }
        const previousAccount = getArchiveAccounts().find(
          (account) => account.key === previousAccountUserId
        );
        if (previousView === "snapshots" && previousAccount) {
          selectedAccountUserId = previousAccount.key;
          renderSnapshotList();
          setArchiveView("snapshots");
        } else {
          selectedAccountUserId = "";
          setArchiveView("accounts");
        }
      }
      if (options.quiet !== true) {
        setStatus("");
      }
    } catch (error) {
      initialized = false;
      elements.loading.hidden = true;
      if (snapshots.length === 0) elements.empty.hidden = false;
      elements.count.textContent = "Archive unavailable";
      setArchiveView("accounts");
      setStatus(mapErrorMessage(error), "error");
    } finally {
      endOperation("load");
    }
  }

  async function captureSnapshotNow() {
    if (!initialized || isBusy()) return;
    beginOperation("capture");
    setStatus("Requesting selected account records from Roblox…");
    try {
      const response = await requestAuthorized(MESSAGE_TYPES.captureNow);
      const result = isRecord(response.result) ? response.result : null;
      const status = normalizeText(result?.status, 40).toLowerCase();
      if (status === "signed-out") {
        setStatus(
          "Sign in to Roblox to create a new snapshot. Your saved archive is still available.",
          "warning"
        );
        return;
      }
      if (status !== "saved" && status !== "unchanged") {
        throw new ArchiveUiError("INVALID_RESPONSE");
      }
      const captureId = normalizeCaptureId(result.captureId);
      setStatus(
        status === "unchanged"
          ? "The account evidence has not changed, so RoTool kept the existing saved snapshot."
          : "Snapshot saved to this browser profile.",
        "success"
      );
      await loadArchiveState({
        preferredCaptureId: captureId,
        focusPreview: true,
        quiet: true
      });
    } catch (error) {
      setStatus(mapErrorMessage(error), "error");
    } finally {
      endOperation("capture");
    }
  }

  function humanizeKey(value) {
    const raw = normalizeText(String(value || ""), 100);
    if (!raw) return "Details";
    if (DISPLAY_LABELS.has(raw)) return DISPLAY_LABELS.get(raw);
    const separated = raw
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\bId\b/g, "ID")
      .replace(/\bUrl\b/g, "URL");
    return separated.charAt(0).toUpperCase() + separated.slice(1);
  }

  function isDocumentIdField(key) {
    return /(?:^|_)(?:id|.*Id)$/i.test(String(key || ""));
  }

  function isDocumentUrlField(key) {
    return /(?:url|link)$/i.test(String(key || ""));
  }

  function safeRobloxUrl(value) {
    if (typeof value !== "string") return "";
    try {
      const url = new URL(value);
      const hostname = url.hostname.toLowerCase();
      if (
        url.protocol !== "https:" ||
        url.port ||
        url.username ||
        url.password ||
        !(
          hostname === "roblox.com" ||
          hostname.endsWith(".roblox.com")
        )
      ) {
        return "";
      }
      return url.href;
    } catch {
      return "";
    }
  }

  function sanitizeDocumentValue(
    value,
    key = "",
    activeObjects = new WeakSet(),
    depth = 0
  ) {
    if (value === null || value === undefined || depth > MAX_NESTING_DEPTH) {
      return OMIT_VALUE;
    }
    if (isDocumentIdField(key) && (value === 0 || value === "0")) {
      return OMIT_VALUE;
    }
    if (typeof value === "boolean") return value;
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : OMIT_VALUE;
    }
    if (typeof value === "bigint") return String(value);
    if (typeof value === "string") {
      const text = normalizeText(value);
      if (!text) return OMIT_VALUE;
      if (isDocumentUrlField(key)) return safeRobloxUrl(text) || OMIT_VALUE;
      return text;
    }
    if (typeof value !== "object" || activeObjects.has(value)) {
      return OMIT_VALUE;
    }

    activeObjects.add(value);
    if (Array.isArray(value)) {
      const result = [];
      for (const entry of value) {
        const normalized = sanitizeDocumentValue(
          entry,
          "",
          activeObjects,
          depth + 1
        );
        if (normalized !== OMIT_VALUE) result.push(normalized);
      }
      activeObjects.delete(value);
      return result.length ? result : OMIT_VALUE;
    }

    const result = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      if (
        entryKey === "__proto__" ||
        entryKey === "prototype" ||
        entryKey === "constructor"
      ) {
        continue;
      }
      const normalized = sanitizeDocumentValue(
        entryValue,
        entryKey,
        activeObjects,
        depth + 1
      );
      if (normalized !== OMIT_VALUE) result[entryKey] = normalized;
    }
    activeObjects.delete(value);
    return Object.keys(result).length ? result : OMIT_VALUE;
  }

  function projectDocumentFields(rawRecord, allowedKeys) {
    if (!isRecord(rawRecord)) return {};
    const projected = {};
    for (const key of allowedKeys) {
      if (Object.hasOwn(rawRecord, key)) projected[key] = rawRecord[key];
    }
    return projected;
  }

  function sanitizeAccountForDocument(rawAccount) {
    const accountData = projectDocumentFields(
      rawAccount,
      DOCUMENT_ACCOUNT_FIELD_KEYS
    );
    if (accountData.accountStatus !== "Banned") {
      delete accountData.accountStatus;
    }
    return sanitizeDocumentValue(accountData, "account");
  }

  function sanitizeSectionForDocument(rawSection, sectionKey) {
    const itemFieldKeys = DOCUMENT_SECTION_ITEM_FIELD_KEYS[sectionKey];
    if (!itemFieldKeys || !Array.isArray(rawSection?.items)) return OMIT_VALUE;
    const items = [];
    for (const rawItem of rawSection.items) {
      const item = sanitizeDocumentValue(
        projectDocumentFields(rawItem, itemFieldKeys),
        ""
      );
      if (item !== OMIT_VALUE) items.push(item);
    }
    if (items.length === 0) return OMIT_VALUE;

    const sectionData = { items };
    if (rawSection.hasMore === true || sectionKey === "recentlyPlayed") {
      const coverage = sanitizeDocumentValue(rawSection.coverage, "coverage");
      if (coverage !== OMIT_VALUE) sectionData.coverage = coverage;
    }
    return sectionData;
  }

  function prepareSnapshotForDocument(rawSnapshot) {
    const result = {};
    if (!isRecord(rawSnapshot)) return result;
    const capturedAt = sanitizeDocumentValue(rawSnapshot.capturedAt, "capturedAt");
    if (capturedAt !== OMIT_VALUE) result.capturedAt = capturedAt;
    const account = sanitizeAccountForDocument(rawSnapshot.account);
    if (account !== OMIT_VALUE) result.account = account;

    const documentSections = {};
    const sourceSections = isRecord(rawSnapshot.sections)
      ? rawSnapshot.sections
      : {};
    for (const sectionKey of SECTION_KEYS) {
      const section = sourceSections[sectionKey];
      if (!isRecord(section)) continue;
      const status = normalizeText(section.status, 40).toLowerCase();
      if (!SUCCESSFUL_SECTION_STATUSES.has(status)) continue;
      const normalized = sanitizeSectionForDocument(section, sectionKey);
      if (normalized !== OMIT_VALUE) documentSections[sectionKey] = normalized;
    }
    if (Object.keys(documentSections).length) result.sections = documentSections;
    return result;
  }

  function getTimestampPresentation(value, key) {
    if (!DOCUMENT_TIMESTAMP_KEYS.has(key) || typeof value !== "string") {
      return null;
    }
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    const exactUtc = date.toISOString();
    return {
      dateTime: exactUtc,
      local: formatLocalDate(exactUtc),
      exactUtc
    };
  }

  function formatScalar(value, depth = 0) {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number" || typeof value === "bigint") return String(value);
    if (typeof value === "string") return normalizeText(value) || "—";
    if (depth >= MAX_NESTING_DEPTH) return "[Nested data]";
    if (Array.isArray(value)) {
      if (value.length === 0) return "—";
      return value
        .map((entry) => formatScalar(entry, depth + 1))
        .join(", ")
        .slice(0, MAX_TEXT_LENGTH);
    }
    if (isRecord(value)) {
      const entries = Object.entries(value);
      const parts = entries
        .slice(0, MAX_NESTED_FIELDS)
        .map(
          ([key, entry]) =>
            `${humanizeKey(key)}: ${formatScalar(entry, depth + 1)}`
        );
      if (entries.length > parts.length) {
        parts.push(`… ${entries.length - parts.length} more`);
      }
      return parts.join(" · ").slice(0, MAX_TEXT_LENGTH) || "—";
    }
    return "—";
  }

  function appendDocumentValue(cell, value, key = "") {
    const timestamp = getTimestampPresentation(value, key);
    if (timestamp) {
      const time = document.createElement("time");
      time.className = "rsl-archive-timestamp";
      time.dateTime = timestamp.dateTime;
      time.append(
        makeTextElement("span", "", timestamp.local),
        makeTextElement(
          "span",
          "rsl-archive-timestamp__exact",
          `Exact UTC: ${timestamp.exactUtc}`
        )
      );
      cell.append(time);
      return;
    }
    const text = formatScalar(value);
    const url = safeRobloxUrl(text);
    if (!url) {
      cell.textContent = text;
      return;
    }
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.referrerPolicy = "no-referrer";
    link.textContent = url;
    cell.append(link);
  }

  function makeTable(label) {
    const scroll = document.createElement("div");
    scroll.className = "rsl-archive-table-scroll";
    scroll.tabIndex = 0;
    scroll.setAttribute("role", "region");
    scroll.setAttribute(
      "aria-label",
      `${label}; scroll horizontally if needed`
    );
    const table = document.createElement("table");
    table.className = "rsl-archive-table";
    table.setAttribute("aria-label", label);
    scroll.append(table);
    return { scroll, table };
  }

  function createKeyValueTable(record, label, omitted = new Set()) {
    if (!isRecord(record)) return null;
    const { scroll, table } = makeTable(label);
    const body = document.createElement("tbody");
    for (const [key, value] of Object.entries(record)) {
      if (omitted.has(key)) continue;
      const row = document.createElement("tr");
      const heading = document.createElement("th");
      heading.scope = "row";
      heading.textContent = humanizeKey(key);
      const cell = document.createElement("td");
      appendDocumentValue(cell, value, key);
      row.append(heading, cell);
      body.append(row);
    }
    if (!body.childElementCount) return null;
    table.append(body);
    return scroll;
  }

  function getItemColumns(items) {
    const columns = [];
    const seen = new Set();
    for (const item of items) {
      if (!isRecord(item)) continue;
      for (const key of Object.keys(item)) {
        if (seen.has(key)) continue;
        seen.add(key);
        columns.push(key);
        if (columns.length >= MAX_TABLE_COLUMNS) return columns;
      }
    }
    return columns;
  }

  function createItemsTable(items, label) {
    if (!Array.isArray(items) || items.length === 0) return null;
    if (!items.every(isRecord)) {
      return createKeyValueTable(
        Object.fromEntries(items.map((value, index) => [String(index + 1), value])),
        label
      );
    }
    const columns = getItemColumns(items);
    if (columns.length === 0) return null;
    const { scroll, table } = makeTable(label);
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    for (const key of columns) {
      const heading = document.createElement("th");
      heading.scope = "col";
      heading.textContent = humanizeKey(key);
      headRow.append(heading);
    }
    head.append(headRow);
    const body = document.createElement("tbody");
    for (const item of items) {
      const row = document.createElement("tr");
      for (const key of columns) {
        const cell = document.createElement("td");
        appendDocumentValue(cell, item[key], key);
        row.append(cell);
      }
      body.append(row);
    }
    table.append(head, body);
    return scroll;
  }

  function createDocumentSection(label) {
    const section = document.createElement("section");
    section.className = "rsl-archive-document-section";
    section.append(makeTextElement("h3", "", label));
    return section;
  }

  function renderDocumentSection(key, value) {
    const label = humanizeKey(key);
    const section = createDocumentSection(label);
    if (!isRecord(value)) {
      const table = createKeyValueTable({ details: value }, label);
      if (table) section.append(table);
      return section;
    }
    if (typeof value.coverage === "string") {
      section.append(makeTextElement("p", "", normalizeText(value.coverage)));
    }
    const details = createKeyValueTable(
      value,
      `${label} details`,
      new Set(["items", "coverage"])
    );
    if (details) section.append(details);
    const items = Array.isArray(value.items) ? value.items : null;
    const itemsTable = createItemsTable(items, `${label} records`);
    if (itemsTable) {
      section.append(itemsTable);
    } else if (items && items.length === 0 && !details) {
      section.append(
        makeTextElement(
          "p",
          "rsl-archive-document-empty",
          "No records were returned at capture time."
        )
      );
    }
    return section;
  }

  function renderSnapshotDocument(snapshot, summary) {
    elements.previewTables.replaceChildren();
    const account = isRecord(snapshot.account) ? snapshot.account : null;
    if (account) {
      const accountSection = createDocumentSection("Account");
      const table = createKeyValueTable(account, "Account details");
      if (table) accountSection.append(table);
      elements.previewTables.append(accountSection);
    }
    const sections = isRecord(snapshot.sections) ? snapshot.sections : {};
    for (const [key, value] of Object.entries(sections)) {
      elements.previewTables.append(renderDocumentSection(key, value));
    }
    if (!elements.previewTables.childElementCount) {
      const empty = createDocumentSection("Snapshot details");
      empty.append(
        makeTextElement(
          "p",
          "rsl-archive-document-empty",
          "This snapshot does not contain any displayable records."
        )
      );
      elements.previewTables.append(empty);
    }

    const capturedAt = normalizeDate(snapshot.capturedAt) || summary?.capturedAt;
    const local = capturedAt ? formatLocalDate(capturedAt) : "Unknown capture time";
    elements.previewCaptureTime.dateTime = capturedAt || "";
    elements.previewCaptureTime.textContent = capturedAt
      ? `Captured ${local}\nExact UTC: ${capturedAt}`
      : local;
    const username = normalizeText(account?.username, 100) || summary?.username;
    elements.previewTitle.textContent = "Recovery Snapshot";
    document.title = username
      ? `Recovery Snapshot - ${username}`
      : "Recovery Snapshot";
    setArchiveView("document", { scrollTop: true });
    syncDisabledState();
  }

  async function loadSnapshot(captureId, options = {}) {
    const normalizedCaptureId = normalizeCaptureId(captureId);
    if (!normalizedCaptureId) return;
    const previewRequestId = ++previewRequestSequence;
    selectedCaptureId = normalizedCaptureId;
    currentSnapshot = null;
    currentDocumentSnapshot = null;
    renderSnapshotList();
    elements.preview.hidden = true;
    beginOperation("preview");
    if (options.quiet !== true) setStatus("Opening saved snapshot…");
    try {
      const response = await requestAuthorized(MESSAGE_TYPES.getSnapshot, {
        captureId: normalizedCaptureId
      });
      if (
        previewRequestId !== previewRequestSequence ||
        selectedCaptureId !== normalizedCaptureId
      ) {
        return;
      }
      const returnedCaptureId = normalizeCaptureId(response.captureId);
      if (
        returnedCaptureId !== normalizedCaptureId ||
        !isRecord(response.snapshot)
      ) {
        throw new ArchiveUiError("INVALID_RESPONSE");
      }
      const summary = snapshots.find(
        (entry) => entry.captureId === normalizedCaptureId
      ) || null;
      currentSnapshot = response.snapshot;
      currentDocumentSnapshot = prepareSnapshotForDocument(response.snapshot);
      renderSnapshotDocument(currentDocumentSnapshot, summary);
      if (options.quiet !== true) setStatus("");
      if (options.focus === true) {
        elements.preview.scrollIntoView({ behavior: "smooth", block: "start" });
        elements.previewTitle.focus({ preventScroll: true });
      }
    } catch (error) {
      if (previewRequestId === previewRequestSequence) {
        clearPreview();
        setStatus(mapErrorMessage(error), "error");
      }
    } finally {
      endOperation("preview");
    }
  }

  function getSummary(captureId) {
    return snapshots.find((summary) => summary.captureId === captureId) || null;
  }

  function openConfirmation(kind, captureId = "") {
    if (isBusy()) return;
    if (kind === "delete") {
      const summary = getSummary(captureId);
      if (!summary) return;
      pendingConfirmation = { kind, captureId: summary.captureId };
      elements.confirmTitle.textContent = "Delete this snapshot?";
      elements.confirmDescription.textContent =
        `The snapshot for ${summary.username ? `@${summary.username}` : "this Roblox account"}, captured ${formatLocalDate(summary.capturedAt)}, will be permanently removed from this browser profile.`;
      elements.confirmAccept.textContent = "Delete snapshot";
    } else if (kind === "clear") {
      if (snapshots.length === 0) return;
      pendingConfirmation = { kind };
      elements.confirmTitle.textContent = "Clear the entire archive?";
      const automaticNote = automaticSnapshotsEnabled
        ? " Automatic snapshots stay enabled and may save a new one on the next scheduled check."
        : "";
      elements.confirmDescription.textContent =
        `All ${pluralize(snapshots.length, "saved snapshot")} across every Roblox account will be permanently removed from this browser profile.${automaticNote}`;
      elements.confirmAccept.textContent = "Clear all";
    } else {
      return;
    }
    elements.confirmDialog.returnValue = "";
    elements.confirmDialog.showModal();
  }

  async function deleteOneSnapshot(captureId) {
    const summary = getSummary(captureId);
    if (!summary) return;
    const accountKey = getSnapshotAccountKey(summary);
    beginOperation("delete");
    setStatus("Deleting saved snapshot…");
    try {
      await requestAuthorized(MESSAGE_TYPES.deleteSnapshot, {
        captureId: summary.captureId
      });
      if (selectedCaptureId === summary.captureId) {
        clearPreview();
        selectedAccountUserId = accountKey;
        setArchiveView("snapshots");
      }
      setStatus("Snapshot deleted from this browser profile.", "success");
      await loadArchiveState({ quiet: true });
    } catch (error) {
      setStatus(mapErrorMessage(error), "error");
    } finally {
      endOperation("delete");
    }
  }

  async function clearAllSnapshots() {
    if (snapshots.length === 0) return;
    beginOperation("clear");
    setStatus("Clearing the local archive…");
    try {
      await requestAuthorized(MESSAGE_TYPES.clearAll);
      snapshots = [];
      clearPreview();
      selectedAccountUserId = "";
      renderAccountList();
      renderSnapshotList();
      setArchiveView("accounts");
      setStatus("All saved snapshots were removed from this browser profile.", "success");
      await loadArchiveState({ quiet: true });
    } catch (error) {
      setStatus(mapErrorMessage(error), "error");
    } finally {
      endOperation("clear");
    }
  }

  function sanitizeFilenamePart(value, fallback) {
    const text = normalizeText(value, 100)
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    return text || fallback;
  }

  function makeDownloadFilename(snapshot) {
    const username = sanitizeFilenamePart(snapshot?.account?.username, "account");
    const capturedAt = normalizeDate(snapshot?.capturedAt) || new Date().toISOString();
    const timestamp = capturedAt
      .replace(/\.\d{3}Z$/, "Z")
      .replace(/:/g, "-");
    return `recovery-snapshot-${username}-${timestamp}.json`;
  }

  function downloadCurrentSnapshot() {
    if (!currentDocumentSnapshot) return;
    const body = `${JSON.stringify(currentDocumentSnapshot, null, 2)}\n`;
    const blob = new Blob([body], { type: "application/json;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = makeDownloadFilename(currentDocumentSnapshot);
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    setStatus("JSON download started.", "success");
  }

  function openAccountSnapshots(accountKey) {
    const account = getArchiveAccounts().find(
      (candidate) => candidate.key === accountKey
    );
    if (!account) return;
    clearPreview();
    selectedAccountUserId = account.key;
    renderSnapshotList();
    setArchiveView("snapshots");
    elements.title.focus?.({ preventScroll: true });
  }

  function navigateArchiveBack() {
    if (isBusy()) return;
    setStatus("");
    if (archiveView === "document") {
      clearPreview();
      renderSnapshotList();
      setArchiveView(getSelectedArchiveAccount() ? "snapshots" : "accounts");
      return;
    }
    if (archiveView === "snapshots") {
      selectedAccountUserId = "";
      clearPreview();
      setArchiveView("accounts");
    }
  }

  function closeArchivePage() {
    try {
      if (chrome?.tabs?.getCurrent && chrome.tabs?.remove) {
        chrome.tabs.getCurrent((tab) => {
          const error = chrome.runtime?.lastError;
          if (!error && Number.isSafeInteger(tab?.id) && tab.id >= 0) {
            chrome.tabs.remove(tab.id, () => {
              void chrome.runtime?.lastError;
            });
            return;
          }
          window.close();
        });
        return;
      }
    } catch {
      // Fall through to the ordinary close attempt.
    }
    window.close();
  }

  elements.create.addEventListener("click", (event) => {
    if (event.isTrusted === true) void captureSnapshotNow();
  });
  elements.refresh.addEventListener("click", (event) => {
    if (event.isTrusted === true && !isBusy()) {
      void loadArchiveState({ preferredCaptureId: selectedCaptureId });
    }
  });
  elements.accountList.addEventListener("click", (event) => {
    if (event.isTrusted !== true || isBusy()) return;
    const target = event.target?.nodeType === 1
      ? event.target
      : event.target?.parentElement;
    const open = target?.closest?.("[data-open-account-id]");
    if (open) openAccountSnapshots(open.dataset.openAccountId);
  });
  elements.list.addEventListener("click", (event) => {
    if (event.isTrusted !== true || isBusy()) return;
    const target = event.target?.nodeType === 1
      ? event.target
      : event.target?.parentElement;
    const open = target?.closest?.("[data-open-capture-id]");
    if (open) {
      void loadSnapshot(open.dataset.openCaptureId, { focus: true });
      return;
    }
    const remove = target?.closest?.("[data-delete-capture-id]");
    if (remove) openConfirmation("delete", remove.dataset.deleteCaptureId);
  });
  elements.clearAll.addEventListener("click", (event) => {
    if (event.isTrusted === true) openConfirmation("clear");
  });
  elements.deleteSnapshot.addEventListener("click", (event) => {
    if (event.isTrusted === true && selectedCaptureId) {
      openConfirmation("delete", selectedCaptureId);
    }
  });
  elements.download.addEventListener("click", (event) => {
    if (event.isTrusted === true && !isBusy()) downloadCurrentSnapshot();
  });
  elements.print.addEventListener("click", (event) => {
    if (event.isTrusted === true && !isBusy() && currentDocumentSnapshot) {
      window.print();
    }
  });
  elements.confirmAccept.addEventListener("click", (event) => {
    if (event.isTrusted !== true || !pendingConfirmation) return;
    event.preventDefault();
    const confirmation = pendingConfirmation;
    pendingConfirmation = null;
    elements.confirmDialog.close("confirm");
    if (confirmation.kind === "delete") {
      void deleteOneSnapshot(confirmation.captureId);
    } else if (confirmation.kind === "clear") {
      void clearAllSnapshots();
    }
  });
  elements.confirmDialog.addEventListener("close", () => {
    pendingConfirmation = null;
  });
  elements.confirmDialog.addEventListener("cancel", () => {
    pendingConfirmation = null;
  });
  elements.back.addEventListener("click", (event) => {
    if (event.isTrusted === true) navigateArchiveBack();
  });
  elements.close.addEventListener("click", (event) => {
    if (event.isTrusted === true) closeArchivePage();
  });

  renderAccountList();
  renderSnapshotList();
  setArchiveView("accounts", { scrollTop: false });
  syncDisabledState();
  const initialCaptureId = getInitialCaptureId();
  void loadArchiveState({
    preferredCaptureId: initialCaptureId,
    focusPreview: Boolean(initialCaptureId),
    requirePreferredCaptureId: Boolean(initialCaptureId)
  });
})();
