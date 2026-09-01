"use strict";

(() => {
  const COLLECT_MESSAGE_TYPE = "rsl:account-recovery:collect";
  const PREVIEW_STATE_MESSAGE_TYPE = "rsl:account-recovery:preview-state";
  const PAGE_VIEW = "home-modal";
  const SNAPSHOT_SECTION_KEYS = Object.freeze([
    "usernameHistory",
    "twoStepVerification",
    "purchases",
    "currencyPurchases",
    "tradeHistory",
    "recentlyPlayed",
    "createdExperiences",
    "violations"
  ]);
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
  const MAX_TABLE_COLUMNS = 16;
  const MAX_PREVIEW_STRING_LENGTH = 8_000;
  const MAX_PREVIEW_COLLECTION_ITEMS = 50;
  const MAX_PREVIEW_OBJECT_FIELDS = 32;
  const MAX_PREVIEW_NESTING_DEPTH = 4;
  const OMIT_FROM_DOCUMENT = Symbol("omit-from-document");
  const SUCCESSFUL_SECTION_STATUSES = new Set(["complete", "partial"]);
  const TIMESTAMP_FIELD_KEYS = new Set([
    "capturedAt",
    "createdAt",
    "updatedAt",
    "purchasedAt",
    "tradeCreatedAt",
    "reviewedAt",
    "appealDeadline"
  ]);
  const DISPLAY_LABEL_OVERRIDES = new Map([
    ["twoStepVerification", "Two-step verification"],
    ["currencyPurchases", "Robux purchases"],
    ["tradeHistory", "Trade history"],
    ["purchases", "Item purchases"],
    ["recentlyPlayed", "Recently played"],
    ["createdExperiences", "Created experiences"],
    ["usernameHistory", "Username history"],
    ["accountStatus", "Account status"],
    ["holdId", "Hold ID"],
    ["purchasedAt", "Purchased"],
    ["createdAt", "Created"],
    ["updatedAt", "Last updated"],
    ["reviewedAt", "Reviewed"],
    ["appealDeadline", "Appeal deadline"],
    ["robuxChange", "Robux change"],
    ["robuxReceived", "Robux received"],
    ["tradeId", "Trade ID"],
    ["tradeCreatedAt", "Trade created"],
    ["partnerUserId", "Trade partner User ID"],
    ["partnerUsername", "Trade partner username"]
  ]);

  function getPageTheme() {
    try {
      const theme = new URL(globalThis.location?.href || "").searchParams.get(
        "theme"
      );
      return theme === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  }

  function getPageView() {
    try {
      return new URL(globalThis.location?.href || "").searchParams.get("view") ===
        PAGE_VIEW
        ? PAGE_VIEW
        : "unsupported";
    } catch {
      return "unsupported";
    }
  }

  if (document.documentElement) {
    document.documentElement.dataset.theme = getPageTheme();
    document.documentElement.dataset.view = getPageView();
    document.documentElement.dataset.snapshotView = "setup";
  }

  function setSnapshotView(hasSnapshot) {
    const snapshotView = hasSnapshot ? "document" : "setup";
    if (document.documentElement) {
      document.documentElement.dataset.snapshotView = snapshotView;
    }
    elements.download.hidden = !hasSnapshot;
    elements.print.hidden = !hasSnapshot;
    elements.create.classList.toggle("rsl-button--primary", !hasSnapshot);
    elements.create.classList.toggle("rsl-button--secondary", hasSnapshot);
    const parentWindow = globalThis.parent;
    if (
      parentWindow &&
      parentWindow !== globalThis &&
      typeof parentWindow.postMessage === "function"
    ) {
      parentWindow.postMessage(
        {
          type: PREVIEW_STATE_MESSAGE_TYPE,
          hasSnapshot: Boolean(hasSnapshot)
        },
        "*"
      );
    }
  }

  const elements = {
    create: document.getElementById("create-snapshot"),
    createLabel: document.getElementById("create-snapshot-label"),
    download: document.getElementById("download-json"),
    print: document.getElementById("print-snapshot"),
    status: document.getElementById("snapshot-status"),
    preview: document.getElementById("snapshot-preview"),
    previewTitle: document.getElementById("preview-title"),
    captureTime: document.getElementById("capture-time"),
    tables: document.getElementById("snapshot-tables"),
    limitations: document.getElementById("snapshot-limitations"),
    collectionStatus: document.getElementById("snapshot-collection-status"),
    collectionStatusList: document.getElementById("snapshot-collection-status-list"),
    optionSummary: document.getElementById("snapshot-option-summary"),
    sectionOptions: Array.from(
      document.querySelectorAll?.("[data-rsl-recovery-section]") || []
    )
  };

  let requestSequence = 0;
  let activeRequestId = 0;
  let currentSnapshot = null;

  function getSelectedSnapshotSections() {
    if (elements.sectionOptions.length === 0) {
      return [...SNAPSHOT_SECTION_KEYS];
    }
    const selected = new Set(
      elements.sectionOptions
        .filter((input) => input.checked === true)
        .map((input) => input.dataset?.rslRecoverySection)
    );
    return SNAPSHOT_SECTION_KEYS.filter((key) => selected.has(key));
  }

  function updateSnapshotOptionSummary() {
    if (!elements.optionSummary) return;
    const selectedCount = getSelectedSnapshotSections().length;
    elements.optionSummary.textContent =
      `${selectedCount} of ${SNAPSHOT_SECTION_KEYS.length} sections selected`;
  }

  function nextRequestId() {
    requestSequence = requestSequence >= Number.MAX_SAFE_INTEGER
      ? 1
      : requestSequence + 1;
    return requestSequence;
  }

  function normalizeText(value, fallback = "") {
    if (typeof value !== "string") return fallback;
    const normalized = value.trim();
    if (!normalized) return fallback;
    return normalized.length > MAX_PREVIEW_STRING_LENGTH
      ? `${normalized.slice(0, MAX_PREVIEW_STRING_LENGTH)}…`
      : normalized;
  }

  function humanizeKey(value) {
    const rawText = String(value || "");
    const override = DISPLAY_LABEL_OVERRIDES.get(rawText);
    if (override) return override;
    const text = normalizeText(rawText);
    if (!text) return "Details";
    const separated = text
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\bId\b/g, "ID")
      .replace(/\bUrl\b/g, "URL");
    return separated.charAt(0).toUpperCase() + separated.slice(1);
  }

  function isRecord(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function formatScalar(value, depth = 0) {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number" || typeof value === "bigint") {
      return String(value);
    }
    if (depth >= MAX_PREVIEW_NESTING_DEPTH) return "[Nested data]";
    if (Array.isArray(value)) {
      if (value.length === 0) return "—";
      const visible = value
        .slice(0, MAX_PREVIEW_COLLECTION_ITEMS)
        .map((entry) => formatScalar(entry, depth + 1));
      if (value.length > visible.length) visible.push(`… ${value.length - visible.length} more`);
      return normalizeText(visible.join(", "), "—");
    }
    if (isRecord(value)) {
      const entries = Object.entries(value);
      const parts = entries.slice(0, MAX_PREVIEW_OBJECT_FIELDS).map(
        ([key, entry]) => `${humanizeKey(key)}: ${formatScalar(entry, depth + 1)}`
      );
      if (entries.length > parts.length) parts.push(`… ${entries.length - parts.length} more`);
      return parts.length ? normalizeText(parts.join(" · "), "—") : "—";
    }
    return normalizeText(String(value), "—");
  }

  function safeRobloxUrl(rawValue) {
    if (typeof rawValue !== "string") return null;
    try {
      const url = new URL(rawValue);
      const hostname = url.hostname.toLowerCase();
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        !(hostname === "roblox.com" || hostname.endsWith(".roblox.com"))
      ) {
        return null;
      }
      return url.href;
    } catch {
      return null;
    }
  }

  function isDocumentUrlField(key) {
    return typeof key === "string" && /(?:url|uri)$/i.test(key);
  }

  function isDocumentIdField(key) {
    return typeof key === "string" && /id$/i.test(key);
  }

  function getTimestampPresentation(
    value,
    key,
    locale = undefined,
    timeZone = undefined
  ) {
    if (!TIMESTAMP_FIELD_KEYS.has(key) || typeof value !== "string") {
      return null;
    }
    const text = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/i.test(text)) {
      return null;
    }
    const timestamp = Date.parse(text);
    if (!Number.isFinite(timestamp)) return null;
    const date = new Date(timestamp);
    const exactUtc = date.toISOString();
    try {
      const options = {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short"
      };
      if (timeZone) options.timeZone = timeZone;
      return {
        dateTime: exactUtc,
        local: new Intl.DateTimeFormat(locale, options).format(date),
        exactUtc
      };
    } catch {
      return { dateTime: exactUtc, local: exactUtc, exactUtc };
    }
  }

  function sanitizeDocumentValue(value, key = "", activeObjects = new WeakSet()) {
    if (value === null || value === undefined) return OMIT_FROM_DOCUMENT;
    if (isDocumentIdField(key) && (value === 0 || value === "0")) {
      return OMIT_FROM_DOCUMENT;
    }
    if (typeof value === "boolean") return value;
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : OMIT_FROM_DOCUMENT;
    }
    if (typeof value === "bigint") return String(value);
    if (typeof value === "string") {
      const text = value.trim();
      if (!text) return OMIT_FROM_DOCUMENT;
      if (isDocumentUrlField(key)) {
        return safeRobloxUrl(text) || OMIT_FROM_DOCUMENT;
      }
      return text;
    }
    if (typeof value !== "object" || activeObjects.has(value)) {
      return OMIT_FROM_DOCUMENT;
    }

    activeObjects.add(value);
    if (Array.isArray(value)) {
      const sanitizedItems = [];
      for (const item of value) {
        const sanitizedItem = sanitizeDocumentValue(item, "", activeObjects);
        if (sanitizedItem !== OMIT_FROM_DOCUMENT) sanitizedItems.push(sanitizedItem);
      }
      activeObjects.delete(value);
      return sanitizedItems.length ? sanitizedItems : OMIT_FROM_DOCUMENT;
    }

    const sanitizedRecord = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      if (
        entryKey === "__proto__" ||
        entryKey === "prototype" ||
        entryKey === "constructor"
      ) {
        continue;
      }
      const sanitizedEntry = sanitizeDocumentValue(
        entryValue,
        entryKey,
        activeObjects
      );
      if (sanitizedEntry !== OMIT_FROM_DOCUMENT) {
        sanitizedRecord[entryKey] = sanitizedEntry;
      }
    }
    activeObjects.delete(value);
    return Object.keys(sanitizedRecord).length
      ? sanitizedRecord
      : OMIT_FROM_DOCUMENT;
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
    if (!itemFieldKeys || !Array.isArray(rawSection?.items)) {
      return OMIT_FROM_DOCUMENT;
    }
    const items = [];
    for (const rawItem of rawSection.items) {
      const item = sanitizeDocumentValue(
        projectDocumentFields(rawItem, itemFieldKeys),
        ""
      );
      if (item !== OMIT_FROM_DOCUMENT) items.push(item);
    }
    if (items.length === 0) return OMIT_FROM_DOCUMENT;

    const sectionData = { items };
    if (rawSection.hasMore === true || sectionKey === "recentlyPlayed") {
      const coverage = sanitizeDocumentValue(rawSection.coverage, "coverage");
      if (coverage !== OMIT_FROM_DOCUMENT) sectionData.coverage = coverage;
    }
    return sectionData;
  }

  function addDisclosure(disclosures, label, message, note = "") {
    const normalizedNote = normalizeText(note);
    disclosures.push(
      normalizedNote
        ? `${label}: ${message} ${normalizedNote}`
        : `${label}: ${message}`
    );
  }

  function prepareSnapshotForDocument(rawSnapshot) {
    const documentSnapshot = {};
    const disclosures = [];
    const limitations = [];
    if (!isRecord(rawSnapshot)) {
      return { documentSnapshot, disclosures, limitations };
    }

    const capturedAt = sanitizeDocumentValue(rawSnapshot.capturedAt, "capturedAt");
    if (capturedAt !== OMIT_FROM_DOCUMENT) {
      documentSnapshot.capturedAt = capturedAt;
    }

    const account = sanitizeAccountForDocument(rawSnapshot.account);
    if (account !== OMIT_FROM_DOCUMENT) documentSnapshot.account = account;

    const documentSections = {};
    const rawSections = isRecord(rawSnapshot.sections) ? rawSnapshot.sections : {};
    for (const [sectionKey, rawSection] of Object.entries(rawSections)) {
      const label = humanizeKey(sectionKey);
      if (!isRecord(rawSection)) {
        addDisclosure(
          disclosures,
          label,
          "No successful result was confirmed, so it is not included in the document."
        );
        continue;
      }

      const status = normalizeText(rawSection.status).toLowerCase();
      const isPartial = status === "partial" || rawSection.hasMore === true;
      const isSuccessful = SUCCESSFUL_SECTION_STATUSES.has(status);
      const note = normalizeText(rawSection.note);

      if (!isSuccessful) {
        const message = status === "not-requested"
          ? "This information was not requested and is not included in the document."
          : status === "unavailable" || status === "error" || status === "failed"
            ? "Roblox could not provide this information, so it is not included in the document."
            : "No successful result was confirmed, so it is not included in the document.";
        addDisclosure(disclosures, label, message, note);
        continue;
      }

      const sanitizedSection = sanitizeSectionForDocument(rawSection, sectionKey);
      if (sanitizedSection !== OMIT_FROM_DOCUMENT) {
        documentSections[sectionKey] = sanitizedSection;
      }

      if (isPartial) {
        addDisclosure(
          disclosures,
          label,
          "Roblox returned only part of the available information. Retrieved records are included in the document.",
          note
        );
      } else if (note) {
        addDisclosure(disclosures, label, note);
      }
    }
    if (Object.keys(documentSections).length) {
      documentSnapshot.sections = documentSections;
    }

    if (Array.isArray(rawSnapshot.limitations)) {
      for (const limitation of rawSnapshot.limitations) {
        const text = normalizeText(String(limitation || ""));
        if (text) limitations.push(text);
      }
    }

    return { documentSnapshot, disclosures, limitations };
  }

  function appendValue(cell, value, key = "") {
    const timestamp = getTimestampPresentation(value, key);
    if (timestamp) {
      const time = document.createElement("time");
      time.className = "snapshot-timestamp";
      time.dateTime = timestamp.dateTime;
      const local = document.createElement("span");
      local.className = "snapshot-timestamp__local";
      local.textContent = timestamp.local;
      const exact = document.createElement("span");
      exact.className = "snapshot-timestamp__exact";
      exact.textContent = `Exact UTC: ${timestamp.exactUtc}`;
      time.append(local, exact);
      cell.append(time);
      return;
    }
    const text = formatScalar(value);
    const safeUrl = safeRobloxUrl(text);
    if (!safeUrl) {
      cell.textContent = text;
      return;
    }
    const link = document.createElement("a");
    link.href = safeUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = safeUrl;
    cell.append(link);
  }

  function makeTableShell(label) {
    const scroll = document.createElement("div");
    scroll.className = "table-scroll";
    scroll.tabIndex = 0;
    scroll.setAttribute("role", "region");
    scroll.setAttribute("aria-label", `${label}; scroll horizontally if needed`);
    const table = document.createElement("table");
    table.className = "snapshot-table";
    table.setAttribute("aria-label", label);
    scroll.append(table);
    return { scroll, table };
  }

  function createKeyValueTable(record, label, omittedKeys = new Set()) {
    const { scroll, table } = makeTableShell(label);
    const tbody = document.createElement("tbody");
    for (const [key, value] of Object.entries(record)) {
      if (omittedKeys.has(key)) continue;
      const row = document.createElement("tr");
      const heading = document.createElement("th");
      heading.scope = "row";
      heading.textContent = humanizeKey(key);
      const cell = document.createElement("td");
      appendValue(cell, value, key);
      row.append(heading, cell);
      tbody.append(row);
    }
    if (!tbody.childElementCount) return null;
    table.append(tbody);
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
    const recordItems = items.filter(isRecord);
    if (recordItems.length !== items.length) {
      return createKeyValueTable(
        Object.fromEntries(items.map((item, index) => [String(index + 1), item])),
        label
      );
    }
    const columns = getItemColumns(recordItems);
    if (columns.length === 0) return null;
    const { scroll, table } = makeTableShell(label);
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    for (const column of columns) {
      const heading = document.createElement("th");
      heading.scope = "col";
      heading.textContent = humanizeKey(column);
      headerRow.append(heading);
    }
    thead.append(headerRow);
    const tbody = document.createElement("tbody");
    for (const item of recordItems) {
      const row = document.createElement("tr");
      for (const column of columns) {
        const cell = document.createElement("td");
        appendValue(cell, item[column], column);
        row.append(cell);
      }
      tbody.append(row);
    }
    table.append(thead, tbody);
    return scroll;
  }

  function makeSection(title) {
    const section = document.createElement("section");
    section.className = "snapshot-section";
    const heading = document.createElement("div");
    heading.className = "section-heading";
    const titleElement = document.createElement("h3");
    titleElement.textContent = title;
    heading.append(titleElement);
    section.append(heading);
    return section;
  }

  function appendEmpty(section, message = "No records returned.") {
    const empty = document.createElement("p");
    empty.className = "empty-section";
    empty.textContent = message;
    section.append(empty);
  }

  function renderSection(key, rawSection) {
    const data = isRecord(rawSection) ? rawSection : { value: rawSection };
    const section = makeSection(humanizeKey(key));
    const items = Array.isArray(data.items) ? data.items : null;
    const metadata = createKeyValueTable(
      data,
      `${humanizeKey(key)} summary`,
      new Set(["items"])
    );
    if (metadata) section.append(metadata);
    const itemTable = createItemsTable(items, `${humanizeKey(key)} records`);
    if (itemTable) {
      section.append(itemTable);
    } else if (items) {
      appendEmpty(
        section,
        "No records were returned for this section."
      );
    } else if (!metadata) {
      appendEmpty(section);
    }
    return section;
  }

  function getCapturedAt(snapshot) {
    for (const key of ["capturedAt", "createdAt", "snapshotTime", "generatedAt"]) {
      const value = normalizeText(snapshot?.[key]);
      if (!value) continue;
      const timestamp = Date.parse(value);
      if (Number.isFinite(timestamp)) return new Date(timestamp);
    }
    return new Date();
  }

  function renderCollectionFeedback(disclosures, limitations) {
    if (elements.collectionStatus && elements.collectionStatusList) {
      elements.collectionStatusList.replaceChildren();
      for (const disclosure of disclosures) {
        const item = document.createElement("li");
        item.textContent = disclosure;
        elements.collectionStatusList.append(item);
      }
      elements.collectionStatus.hidden = disclosures.length === 0;
    }

    const limitationList = elements.limitations?.querySelector("ul");
    if (elements.limitations && limitationList) {
      limitationList.replaceChildren();
      for (const limitation of limitations) {
        const item = document.createElement("li");
        item.textContent = limitation;
        limitationList.append(item);
      }
      elements.limitations.hidden = limitations.length === 0;
    }
  }

  function renderSnapshot(snapshot) {
    elements.tables.replaceChildren();
    const account = isRecord(snapshot.account) ? snapshot.account : null;
    if (account) {
      const accountSection = makeSection("Account details");
      const accountTable = createKeyValueTable(account, "Account details");
      if (accountTable) accountSection.append(accountTable);
      else appendEmpty(accountSection);
      elements.tables.append(accountSection);
    }

    const sections = isRecord(snapshot.sections) ? snapshot.sections : {};
    for (const [key, section] of Object.entries(sections)) {
      elements.tables.append(renderSection(key, section));
    }

    const reserved = new Set([
      "schemaVersion",
      "capturedAt",
      "createdAt",
      "snapshotTime",
      "generatedAt",
      "captureDurationMs",
      "account",
      "sections",
      "limitations"
    ]);
    for (const [key, value] of Object.entries(snapshot)) {
      if (reserved.has(key)) continue;
      elements.tables.append(renderSection(key, value));
    }

    if (!elements.tables.childElementCount) {
      const emptySection = makeSection("Snapshot details");
      appendEmpty(emptySection, "The snapshot did not contain any displayable records.");
      elements.tables.append(emptySection);
    }

    const capturedAt = getCapturedAt(snapshot);
    const capturedPresentation = getTimestampPresentation(
      capturedAt.toISOString(),
      "capturedAt"
    );
    elements.captureTime.dateTime = capturedAt.toISOString();
    elements.captureTime.textContent = capturedPresentation
      ? `Captured ${capturedPresentation.local}\nExact UTC: ${capturedPresentation.exactUtc}`
      : `Captured ${capturedAt.toISOString()}`;
    const username = normalizeText(account?.username);
    document.title = username
      ? `Recovery Snapshot - ${username}`
      : "Recovery Snapshot";
    elements.preview.hidden = false;
    setSnapshotView(true);
  }

  function setStatus(message, kind = "") {
    elements.status.textContent = message;
    if (kind) elements.status.dataset.kind = kind;
    else delete elements.status.dataset.kind;
  }

  function setCollecting(collecting) {
    elements.create.disabled = collecting;
    elements.createLabel.textContent = collecting
      ? "Creating snapshot…"
      : currentSnapshot
        ? "Refresh snapshot"
        : "Create snapshot";
    elements.download.disabled = collecting || !currentSnapshot;
    elements.print.disabled = collecting || !currentSnapshot;
    for (const input of elements.sectionOptions) input.disabled = collecting;
    if (collecting) document.body.setAttribute("aria-busy", "true");
    else document.body.removeAttribute("aria-busy");
  }

  function mapErrorCode(code) {
    const normalizedCode = normalizeText(code)
      .toUpperCase()
      .replace(/[-\s]+/g, "_");
    switch (normalizedCode) {
      case "UNAUTHENTICATED":
      case "SIGNED_OUT":
        return "Sign in to Roblox, then try again.";
      case "ACCOUNT_CHANGED":
        return "The signed-in Roblox account changed. No snapshot was kept.";
      case "FEATURE_DISABLED":
        return "Recovery Snapshots are turned off in RoTool Settings.";
      case "RATE_LIMITED":
        return "Roblox is temporarily limiting requests. Wait a little, then try again.";
      case "TOO_LARGE":
      case "RESPONSE_TOO_LARGE":
        return "Roblox returned more data than this snapshot can safely process.";
      case "INVALID":
        return "The snapshot request was rejected as invalid.";
      default:
        return "The snapshot could not be created right now. Please try again.";
    }
  }

  function clearSnapshot() {
    currentSnapshot = null;
    setSnapshotView(false);
    elements.preview.hidden = true;
    elements.tables.replaceChildren();
    if (elements.collectionStatus) elements.collectionStatus.hidden = true;
    elements.collectionStatusList?.replaceChildren();
    if (elements.limitations) elements.limitations.hidden = true;
    elements.limitations?.querySelector("ul")?.replaceChildren();
    elements.download.disabled = true;
    elements.print.disabled = true;
    document.title = "Recovery Snapshot";
  }

  function sendCollectRequest(requestId, sections) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: COLLECT_MESSAGE_TYPE, requestId, sections },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, requestId, code: "UNAVAILABLE" });
            return;
          }
          resolve(response);
        }
      );
    });
  }

  async function collectSnapshot() {
    const requestId = nextRequestId();
    const selectedSections = getSelectedSnapshotSections();
    activeRequestId = requestId;
    clearSnapshot();
    setCollecting(true);
    setStatus("Requesting account records from Roblox…");
    try {
      const response = await sendCollectRequest(requestId, selectedSections);
      if (activeRequestId !== requestId) return;
      if (
        !response ||
        response.ok !== true ||
        response.requestId !== requestId ||
        !isRecord(response.snapshot)
      ) {
        setStatus(mapErrorCode(response?.code), "error");
        return;
      }
      const prepared = prepareSnapshotForDocument(response.snapshot);
      currentSnapshot = prepared.documentSnapshot;
      renderSnapshot(currentSnapshot);
      renderCollectionFeedback(prepared.disclosures, prepared.limitations);
      setStatus(
        prepared.disclosures.length
          ? "Document ready. Review the collection details below; unavailable information is not included in the document."
          : "Document ready. Review it before downloading or printing.",
        "success"
      );
      elements.previewTitle.focus({ preventScroll: false });
    } catch {
      if (activeRequestId === requestId) {
        setStatus("The snapshot could not be created right now. Please try again.", "error");
      }
    } finally {
      if (activeRequestId === requestId) setCollecting(false);
    }
  }

  function sanitizeFilenamePart(value, fallback) {
    const normalized = normalizeText(value)
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    return normalized || fallback;
  }

  function makeSnapshotFilename(snapshot) {
    const username = sanitizeFilenamePart(snapshot?.account?.username, "account");
    const timestamp = getCapturedAt(snapshot)
      .toISOString()
      .replace(/\.\d{3}Z$/, "Z")
      .replace(/[:]/g, "-");
    return `recovery-snapshot-${username}-${timestamp}.json`;
  }

  function downloadSnapshot() {
    if (!currentSnapshot) return;
    const body = `${JSON.stringify(currentSnapshot, null, 2)}\n`;
    const blob = new Blob([body], { type: "application/json;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = makeSnapshotFilename(currentSnapshot);
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    setStatus("JSON download started.", "success");
  }

  function printSnapshot() {
    if (!currentSnapshot) return;
    window.print();
  }

  if (isRecord(globalThis.__ROTOOL_RECOVERY_TEST_HOOKS__)) {
    Object.assign(globalThis.__ROTOOL_RECOVERY_TEST_HOOKS__, {
      getPageTheme,
      getPageView,
      getTimestampPresentation,
      getSelectedSnapshotSections,
      humanizeKey,
      mapErrorCode,
      prepareSnapshotForDocument,
      safeRobloxUrl
    });
  }

  elements.create.addEventListener("click", (event) => {
    if (event.isTrusted === true && getPageView() === PAGE_VIEW) {
      void collectSnapshot();
    }
  });
  elements.download.addEventListener("click", (event) => {
    if (event.isTrusted === true) downloadSnapshot();
  });
  elements.print.addEventListener("click", (event) => {
    if (event.isTrusted === true) printSnapshot();
  });
  for (const input of elements.sectionOptions) {
    input.addEventListener("change", (event) => {
      if (event.isTrusted !== true) return;
      updateSnapshotOptionSummary();
    });
  }
  updateSnapshotOptionSummary();
  setCollecting(false);
})();
