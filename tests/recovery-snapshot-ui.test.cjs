"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "recovery-snapshot.html"), "utf8");
const css = fs.readFileSync(path.join(root, "recovery-snapshot.css"), "utf8");
const source = fs.readFileSync(path.join(root, "recovery-snapshot.js"), "utf8");

const csp = html.match(
  /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i
)?.[1];
assert.ok(csp, "the embedded recovery page must declare a CSP");
for (const directive of [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "font-src https://css.rbxcdn.com",
  "img-src 'self' data:",
  "connect-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
]) {
  assert.ok(csp.includes(directive), `missing recovery-page CSP directive: ${directive}`);
}
assert.doesNotMatch(csp, /'unsafe-inline'|'unsafe-eval'|\*/i);
assert.doesNotMatch(
  csp,
  /frame-ancestors\s+'none'/i,
  "the web-accessible recovery page must remain embeddable by its guarded Roblox Home modal"
);

assert.match(
  html,
  /<link rel="stylesheet" href="styles\.css">[\s\S]*?<link rel="stylesheet" href="recovery-snapshot\.css">/,
  "the iframe must load RoTool's shared Foundation primitives before its content styles"
);
assert.match(html, /<body class="rsl-recovery-embed">/);
assert.match(
  html,
  /<main\s+id="content"\s+class="rsl-recovery-content"\s+aria-labelledby="page-title"\s+tabindex="-1"\s*>/
);
assert.match(
  html,
  /<h1 id="page-title" class="rsl-sr-only">Recovery Snapshot<\/h1>/,
  "the outer Roblox dialog owns the visible title; the iframe keeps an accessible heading"
);
assert.match(html, /<div class="rsl-recovery-viewport">/);
assert.match(html, /<footer class="rsl-recovery-footer" aria-label="Snapshot controls">/);
assert.match(
  html,
  /<button\s+id="create-snapshot"\s+class="rsl-button rsl-button--primary foundation-web-button"\s+type="button"\s*>[\s\S]*?data-testid="foundation-web-state-layer"[\s\S]*?<span id="create-snapshot-label" class="rsl-button__label">Create snapshot<\/span>/
);
assert.equal(
  (html.match(/data-testid="foundation-web-state-layer"/g) || []).length,
  3,
  "all Recovery Snapshot actions must use Roblox Foundation state layers"
);
assert.match(html, /<aside class="rsl-recovery-help" aria-labelledby="privacy-note-title">/);
assert.match(html, /Keep exported files private/);
assert.match(html, /<details class="rsl-recovery-options" open>/);
assert.match(html, /id="snapshot-option-summary"/);
assert.match(html, /Information to capture/);
assert.match(html, /Account identity and capture time are always requested\./);
assert.match(html, /Unchecked information\s+is not requested from Roblox\./);
assert.equal(
  (html.match(/data-rsl-recovery-section="[A-Za-z]+"/g) || []).length,
  8,
  "the setup disclosure must expose every optional support section"
);
assert.equal(
  (html.match(/\bchecked\b/g) || []).length,
  8,
  "all supported manual-capture sections must be requested by default"
);
assert.equal(
  (html.match(/class="rsl-recovery-checkbox__input"/g) || []).length,
  8,
  "manual capture choices must use checkbox semantics"
);
assert.doesNotMatch(html, /role="switch"|rsl-recovery-switch/);
assert.doesNotMatch(
  html,
  /rbx-topbar|rbx-sidebar|rbx-shell|rbx-global-nav|container-main|skip-to-main|Page navigation|Open Roblox/i,
  "the iframe must contain recovery content only, never a fake Roblox page shell"
);
assert.doesNotMatch(html, /<nav\b|icons\/rotool-32\.png|app-heading__icon|class="eyebrow"/i);
assert.doesNotMatch(html, /Private account record/i);
assert.doesNotMatch(html, /Support-focused account snapshot|Recovery document/i);
assert.doesNotMatch(
  html,
  /Account support evidence|paper-kicker|paper-description/,
  "the support document header must contain only its title and capture time"
);
assert.match(html, /<time id="capture-time" class="capture-time"><\/time>/);
assert.match(html, /font-src https:\/\/css\.rbxcdn\.com/);
assert.doesNotMatch(html, /include-email|account email/i);
assert.match(html, /id="create-snapshot"/);
assert.match(
  html,
  /<button\s+id="download-json"\s+class="rsl-button rsl-button--secondary foundation-web-button"[\s\S]*?disabled[\s\S]*?<span class="rsl-button__label">Download JSON<\/span>/
);
assert.match(
  html,
  /<button\s+id="print-snapshot"\s+class="rsl-button rsl-button--primary foundation-web-button"[\s\S]*?disabled[\s\S]*?hidden[\s\S]*?<span class="rsl-button__label">Print \/ Save PDF<\/span>/
);
assert.match(html, /<article class="paper">/);
assert.match(html, /id="snapshot-tables"/);
assert.match(html, /id="snapshot-collection-status"/);
assert.match(html, /id="snapshot-collection-status-list"/);
assert.match(html, /recovery-snapshot\.js" defer/);
assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i, "extension page must not use inline scripts");
assert.doesNotMatch(`${html}\n${css}\n${source}`, /generated by(?:\s+rotool)?/i);
assert.match(css, /--color-surface-100:\s*#191a1f/);
assert.match(css, /--color-surface-200:\s*#24262c/);
assert.match(css, /--color-content-default:\s*#b7bac3/);
assert.match(css, /--color-stroke-default:\s*#393b43/);
assert.equal(
  (css.match(/--color-action-emphasis-background:\s*#335fff;/g) || []).length,
  2,
  "primary Recovery Snapshot actions must use Roblox blue in both themes"
);
assert.equal(
  (css.match(/--color-action-emphasis-foreground:\s*#ffffff;/g) || []).length,
  2,
  "Roblox-blue actions must retain white labels in both themes"
);
assert.match(css, /:root\[data-theme="light"\]/);
assert.match(
  css,
  /\.rsl-recovery-content\s*\{[\s\S]*?display:\s*grid;[\s\S]*?height:\s*100%;[\s\S]*?grid-template-rows:\s*minmax\(0, 1fr\) auto;[\s\S]*?overflow:\s*hidden;/s,
  "the iframe must keep a stationary Roblox-style footer"
);
assert.match(
  css,
  /\.rsl-recovery-viewport\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow-y:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;/s
);
assert.match(
  css,
  /\.rsl-recovery-footer\s*\{[\s\S]*?display:\s*flex;[\s\S]*?min-height:\s*0;[\s\S]*?padding:\s*16px 24px 20px;[\s\S]*?justify-content:\s*space-between;[\s\S]*?gap:\s*12px;[\s\S]*?border-top:/s
);
assert.match(
  css,
  /\.rsl-recovery-actions\s*\{[\s\S]*?margin-left:\s*auto;[\s\S]*?gap:\s*12px;/s,
  "desktop actions must stay compact and right-aligned like RoTool's other dialog footers"
);
assert.match(css, /@media \(max-width: 520px\)/);
assert.doesNotMatch(css, /@media \(max-width: 620px\)/);
assert.match(
  css,
  /\.rsl-recovery-actions \.rsl-button\s*\{[\s\S]*?min-height:\s*48px;[\s\S]*?padding-inline:\s*16px;[\s\S]*?font-size:\s*16px;[\s\S]*?line-height:\s*24px;/s,
  "embedded Recovery actions must match the 16px label scale of shared dialog footers"
);
assert.match(css, /\.rsl-recovery-content \.rsl-button__state-layer\s*\{/);
assert.match(
  css,
  /\.rsl-recovery-content \.rsl-button:hover:not\(:disabled\) > \.rsl-button__state-layer\s*\{[\s\S]*?var\(--color-state-hover\)/s
);
assert.match(
  css,
  /\.rsl-recovery-content \.rsl-button:active:not\(:disabled\) > \.rsl-button__state-layer\s*\{[\s\S]*?var\(--color-state-press\)/s
);
assert.match(css, /https:\/\/css\.rbxcdn\.com\/3e19a797e2ce0522\.woff2/);
assert.match(css, /\.paper\s*\{[\s\S]*?width:\s*min\(900px, 100%\);/s);
const screenPaperRule = css.match(/\.paper\s*\{([^}]*)\}/s)?.[1] || "";
assert.doesNotMatch(screenPaperRule, /box-shadow:/);
assert.match(css, /\.table-scroll:focus-visible/);
assert.match(css, /\.rsl-recovery-options\s*\{/);
assert.match(
  css,
  /:root\[data-snapshot-view="document"\] \.rsl-recovery-help,\s*:root\[data-snapshot-view="document"\] \.rsl-recovery-options\s*\{\s*display:\s*none;/s,
  "inclusion choices belong to setup and must stay out of the exported document"
);
assert.match(css, /@font-face[\s\S]*?font-family:\s*"Builder Sans"/);
assert.doesNotMatch(
  css,
  /\.rbx-(?:topbar|sidebar|shell|global-nav)|\.container-main|margin-left:\s*288px|min-height:\s*100vh|height:\s*100vh|data-view="home-modal"/i,
  "content styles must not build and conditionally hide a standalone page shell"
);
assert.doesNotMatch(
  css,
  /\.rsl-dialog(?:\b|__)/,
  "the iframe must not duplicate the outer shared dialog chrome"
);
for (const remoteUrl of css.match(/https:\/\/[^"')]+/g) || []) {
  assert.match(remoteUrl, /^https:\/\/css\.rbxcdn\.com\//);
}
assert.doesNotMatch(css, /radial-gradient|window-shadow/);
assert.doesNotMatch(css, /@media\s*\(prefers-color-scheme:\s*light\)/);

assert.match(
  source,
  /const COLLECT_MESSAGE_TYPE = "rsl:account-recovery:collect";/
);
assert.match(source, /const PAGE_VIEW = "home-modal";/);
assert.match(
  source,
  /document\.documentElement\.dataset\.view = getPageView\(\)/
);
assert.match(
  source,
  /chrome\.runtime\.sendMessage\(\s*\{ type: COLLECT_MESSAGE_TYPE, requestId, sections \}/
);
assert.match(
  source,
  /elements\.create\.addEventListener\("click", \(event\) => \{\s*if \(event\.isTrusted === true && getPageView\(\) === PAGE_VIEW\)/s
);
assert.match(
  source,
  /elements\.download\.addEventListener\("click", \(event\) => \{\s*if \(event\.isTrusted === true\) downloadSnapshot\(\);/s
);
assert.match(
  source,
  /elements\.print\.addEventListener\("click", \(event\) => \{\s*if \(event\.isTrusted === true\) printSnapshot\(\);/s
);
assert.doesNotMatch(
  `${html}\n${source}`,
  /accountsettings\.roblox\.com|maskedEmailAddress|chrome\.permissions/,
  "the snapshot page must not request or export masked account email data"
);
assert.match(source, /new Blob\(\[body\], \{ type: "application\/json;charset=utf-8" \}\)/);
assert.match(source, /URL\.createObjectURL\(blob\)/);
assert.match(source, /URL\.revokeObjectURL\(objectUrl\)/);
assert.match(source, /`recovery-snapshot-\$\{username\}-\$\{timestamp\}\.json`/);
assert.match(source, /window\.print\(\)/);
assert.match(source, /document\.documentElement\.dataset\.theme = getPageTheme\(\)/);
assert.match(source, /document\.documentElement\.dataset\.snapshotView = "setup"/);
assert.match(source, /const PREVIEW_STATE_MESSAGE_TYPE = "rsl:account-recovery:preview-state"/);
assert.match(source, /parentWindow\.postMessage\([\s\S]*?hasSnapshot: Boolean\(hasSnapshot\)[\s\S]*?"\*"/s);
assert.match(source, /elements\.download\.hidden = !hasSnapshot/);
assert.match(source, /elements\.print\.hidden = !hasSnapshot/);
assert.match(source, /Exact UTC: \$\{timestamp\.exactUtc\}/);
assert.match(source, /scroll\.tabIndex = 0/);
assert.match(source, /elements\.captureTime\.dateTime = capturedAt\.toISOString\(\)/);
assert.match(source, /createLabel:\s*document\.getElementById\("create-snapshot-label"\)/);
assert.match(source, /elements\.createLabel\.textContent = collecting/);
assert.doesNotMatch(source, /elements\.create\.textContent\s*=/);
assert.match(source, /isDocumentIdField\(key\) && \(value === 0 \|\| value === "0"\)/);
assert.match(source, /response\.requestId !== requestId/);
assert.match(source, /response\.ok !== true/);
assert.match(source, /response\.snapshot/);
assert.match(source, /prepareSnapshotForDocument\(response\.snapshot\)/);
assert.match(source, /currentSnapshot = prepared\.documentSnapshot/);
assert.match(source, /textContent =/);
assert.doesNotMatch(source, /\.innerHTML\s*=/, "snapshot data must not be inserted as HTML");
assert.doesNotMatch(
  source,
  /(?:chrome\.)?storage\.|localStorage|sessionStorage|indexedDB/i,
  "the snapshot UI must not persist account data"
);
assert.doesNotMatch(source, /\bfetch\s*\(/, "the UI must use the guarded background collector");

assert.match(css, /@media print/);
assert.match(
  css,
  /\.rsl-recovery-footer,\s*\.rsl-recovery-help,\s*\.rsl-recovery-options,\s*\.rsl-recovery-print-hint,\s*\.collection-feedback\s*\{\s*display: none !important;/s,
  "collection failures and limitations must stay out of printed documents"
);
assert.match(css, /\.snapshot-table tr\s*\{\s*break-inside: avoid;/s);
assert.match(css, /\.section-heading\s*\{[\s\S]*?break-after:\s*avoid;/s);
assert.match(
  css,
  /@media print[\s\S]*?\.snapshot-table thead\s*\{\s*display:\s*table-header-group;/s
);

function makeElement() {
  const listeners = new Map();
  const list = { replaceChildren() {} };
  const classes = new Set();
  return {
    checked: false,
    dataset: {},
    disabled: false,
    hidden: false,
    textContent: "",
    classList: {
      toggle(name, force) {
        if (force === true) classes.add(name);
        else if (force === false) classes.delete(name);
        else if (classes.has(name)) classes.delete(name);
        else classes.add(name);
        return classes.has(name);
      }
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    dispatch(type, { isTrusted = false } = {}) {
      listeners.get(type)?.({ type, currentTarget: this, isTrusted });
    },
    focus() {},
    querySelector(selector) {
      assert.equal(selector, "ul");
      return list;
    },
    replaceChildren() {}
  };
}

async function runRuntimeContract() {
  const sectionKeys = [
    "usernameHistory",
    "twoStepVerification",
    "purchases",
    "currencyPurchases",
    "tradeHistory",
    "recentlyPlayed",
    "createdExperiences",
    "violations"
  ];
  const sectionInputs = sectionKeys.map((key) => {
    const input = makeElement();
    input.checked = true;
    input.dataset.rslRecoverySection = key;
    return input;
  });
  const ids = [
    "create-snapshot",
    "create-snapshot-label",
    "download-json",
    "print-snapshot",
    "snapshot-status",
    "snapshot-preview",
    "preview-title",
    "capture-time",
    "snapshot-tables",
    "snapshot-limitations",
    "snapshot-collection-status",
    "snapshot-collection-status-list",
    "snapshot-option-summary"
  ];
  const elements = new Map(ids.map((id) => [id, makeElement()]));
  const bodyAttributes = new Map();
  const sentMessages = [];
  const testHooks = {};
  const context = {
    URL,
    Blob,
    console,
    queueMicrotask,
    setTimeout,
    clearTimeout,
    location: {
      href:
        "chrome-extension://recovery-fixture/recovery-snapshot.html?theme=dark&view=home-modal"
    },
    __ROTOOL_RECOVERY_TEST_HOOKS__: testHooks,
    document: {
      title: "",
      documentElement: {
        dataset: {}
      },
      body: {
        append() {},
        setAttribute(name, value) {
          bodyAttributes.set(name, value);
        },
        removeAttribute(name) {
          bodyAttributes.delete(name);
        }
      },
      getElementById(id) {
        return elements.get(id) || null;
      },
      querySelectorAll(selector) {
        assert.equal(selector, "[data-rsl-recovery-section]");
        return sectionInputs;
      },
      createElement() {
        throw new Error("failed responses must not render snapshot data");
      }
    },
    window: {
      print() {}
    },
    chrome: {
      runtime: {
        lastError: null,
        sendMessage(message, callback) {
          sentMessages.push(message);
          queueMicrotask(() => callback({
            ok: false,
            requestId: message.requestId,
            code: "unavailable"
          }));
        }
      }
    }
  };
  vm.runInNewContext(source, context, { filename: "recovery-snapshot.js" });

  assert.equal(typeof testHooks.prepareSnapshotForDocument, "function");
  assert.equal(typeof testHooks.mapErrorCode, "function");
  assert.equal(
    testHooks.mapErrorCode("FEATURE_DISABLED"),
    "Recovery Snapshots are turned off in RoTool Settings.",
    "an already-open snapshot window needs a clear master-switch error"
  );
  assert.equal(testHooks.getPageTheme(), "dark");
  assert.equal(testHooks.getPageView(), "home-modal");
  assert.equal(context.document.documentElement.dataset.theme, "dark");
  assert.equal(context.document.documentElement.dataset.view, "home-modal");
  assert.deepEqual(
    JSON.parse(JSON.stringify(testHooks.getSelectedSnapshotSections())),
    sectionKeys
  );
  assert.equal(
    elements.get("snapshot-option-summary").textContent,
    "8 of 8 sections selected"
  );
  const recentlyPlayedInput = sectionInputs.find(
    (input) => input.dataset.rslRecoverySection === "recentlyPlayed"
  );
  recentlyPlayedInput.checked = false;
  recentlyPlayedInput.dispatch("change", { isTrusted: true });
  assert.deepEqual(
    JSON.parse(JSON.stringify(testHooks.getSelectedSnapshotSections())),
    sectionKeys.filter((key) => key !== "recentlyPlayed")
  );
  assert.equal(
    elements.get("snapshot-option-summary").textContent,
    "7 of 8 sections selected"
  );
  const timestampPresentation = testHooks.getTimestampPresentation(
    "2026-03-08T13:20:59.859Z",
    "purchasedAt",
    "en-GB",
    "Europe/Berlin"
  );
  assert.equal(timestampPresentation.exactUtc, "2026-03-08T13:20:59.859Z");
  assert.match(timestampPresentation.local, /14:20:59/);
  assert.equal(
    testHooks.getTimestampPresentation(
      "2026-03-08T13:20:59.859Z",
      "username"
    ),
    null
  );
  assert.equal(testHooks.humanizeKey("userId"), "User ID");
  assert.equal(testHooks.humanizeKey("profileUrl"), "Profile URL");
  assert.equal(
    testHooks.humanizeKey("twoStepVerification"),
    "Two-step verification"
  );
  assert.equal(testHooks.humanizeKey("currencyPurchases"), "Robux purchases");
  assert.equal(testHooks.humanizeKey("tradeHistory"), "Trade history");
  assert.equal(testHooks.humanizeKey("tradeId"), "Trade ID");
  assert.equal(testHooks.humanizeKey("tradeCreatedAt"), "Trade created");
  assert.equal(testHooks.humanizeKey("holdId"), "Hold ID");
  assert.equal(testHooks.humanizeKey("purchasedAt"), "Purchased");

  const rawSnapshot = {
    schemaVersion: 1,
    capturedAt: "2026-08-28T10:00:00.000Z",
    account: {
      userId: "123",
      username: "  Builder  ",
      displayName: "Builder Display",
      createdAt: "2018-02-03T04:05:06.000Z",
      accountStatus: "Active",
      isBanned: false,
      robux: 0,
      profileUrl: "https://www.roblox.com/users/123/profile",
      externalUrl: "https://example.com/not-roblox",
      emptyText: "   "
    },
    sections: {
      purchases: {
        status: "complete",
        code: null,
        count: 1,
        limit: 50,
        hasMore: false,
        capturedAt: "2026-08-28T10:00:00.000Z",
        coverage: "All 1 record returned by Roblox at capture time.",
        items: [{
          holdId: "777",
          purchasedAt: "2026-03-08T13:20:59.859Z",
          itemId: "456",
          itemName: "Sword",
          itemType: "Asset",
          robuxChange: -100,
          transactionId: 0,
          note: "Record-owned note",
          missing: undefined,
          gameUrl: "https://www.roblox.com/games/789",
          unsafeUrl: "https://evil.example/"
        }],
        note: "A complete-section caveat."
      },
      createdExperiences: {
        status: "partial",
        code: "PAGE_LIMIT",
        count: 1,
        limit: 1,
        hasMore: true,
        capturedAt: "2026-08-28T10:00:00.000Z",
        coverage: "Latest 1 created experience; more records exist.",
        items: [{
          name: "Builder World",
          universeId: "900",
          rootPlaceId: "901",
          createdAt: "2020-01-02T03:04:05.000Z",
          updatedAt: "2026-08-01T09:10:11.000Z",
          gameUrl: "https://www.roblox.com/games/901",
          visits: 99
        }],
        note: "More records may exist."
      },
      twoStepVerification: {
        status: "partial",
        count: 0,
        hasMore: false,
        items: [],
        note: "Profile details could not be loaded."
      },
      usernameHistory: {
        status: "complete",
        count: 0,
        limit: 100,
        hasMore: false,
        items: [],
        note: "Roblox returned no records."
      },
      currencyPurchases: {
        status: "unavailable",
        code: "ROBLOX_UNAVAILABLE",
        count: 0,
        limit: 50,
        hasMore: false,
        items: [],
        note: "The endpoint failed."
      },
      tradeHistory: {
        status: "complete",
        count: 1,
        limit: 100,
        hasMore: false,
        capturedAt: "2026-08-28T10:00:00.000Z",
        items: [{
          tradeId: "24680",
          tradeCreatedAt: "2026-02-15T10:20:30.000Z",
          partnerUserId: "987",
          partnerUsername: "TradePartner",
          partnerDisplayName: "Must not be exported",
          status: "Completed",
          expiration: "2026-02-19T10:20:30.000Z"
        }]
      },
      failedRecords: {
        status: "failed",
        code: "TIMEOUT",
        items: []
      },
      unconfirmedShape: {
        items: [{ secret: "must-not-leak" }]
      },
      recentlyPlayed: {
        status: "complete",
        count: 1,
        hasMore: false,
        coverage: "Continue row at capture time; play dates are unavailable.",
        items: [{
          name: "Example Game",
          universeId: "777",
          rootPlaceId: "778",
          gameUrl: "https://www.roblox.com/games/778"
        }],
        note: "Roblox does not return play dates."
      },
      unknownSuccessful: {
        status: "complete",
        items: [{ secret: "future-private-field" }]
      }
    },
    limitations: ["Attach receipts separately.", "", null]
  };

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
  }

  const before = JSON.stringify(rawSnapshot);
  deepFreeze(rawSnapshot);
  const prepared = testHooks.prepareSnapshotForDocument(rawSnapshot);
  assert.equal(JSON.stringify(rawSnapshot), before, "preparation must not mutate collector data");
  assert.deepEqual(
    JSON.parse(JSON.stringify(prepared.documentSnapshot)),
    {
      capturedAt: "2026-08-28T10:00:00.000Z",
      account: {
        userId: "123",
        username: "Builder",
        displayName: "Builder Display",
        createdAt: "2018-02-03T04:05:06.000Z"
      },
      sections: {
        purchases: {
          items: [{
            purchasedAt: "2026-03-08T13:20:59.859Z",
            itemId: "456",
            itemName: "Sword",
            itemType: "Asset",
            robuxChange: -100
          }]
        },
        tradeHistory: {
          items: [{
            tradeId: "24680",
            tradeCreatedAt: "2026-02-15T10:20:30.000Z",
            partnerUserId: "987",
            partnerUsername: "TradePartner"
          }]
        },
        createdExperiences: {
          items: [{
            name: "Builder World",
            universeId: "900",
            rootPlaceId: "901",
            createdAt: "2020-01-02T03:04:05.000Z",
            updatedAt: "2026-08-01T09:10:11.000Z"
          }],
          coverage: "Latest 1 created experience; more records exist."
        },
        recentlyPlayed: {
          items: [{
            name: "Example Game",
            universeId: "777",
            rootPlaceId: "778"
          }],
          coverage: "Continue row at capture time; play dates are unavailable."
        }
      }
    }
  );
  const exportedText = JSON.stringify(prepared.documentSnapshot);
  for (const forbidden of [
    "code",
    "limit",
    "hasMore",
    "limitations",
    "schemaVersion",
    "holdId",
    "profileUrl",
    "gameUrl",
    "future-private-field",
    "ROBLOX_UNAVAILABLE",
    "must-not-leak",
    "not-roblox",
    "evil.example"
  ]) {
    assert.equal(exportedText.includes(forbidden), false, `${forbidden} must stay out of export`);
  }
  assert.equal(exportedText.includes('"transactionId":0'), false);
  assert.equal(exportedText.includes("2026-03-08T13:20:59.859Z"), true);
  for (const section of Object.values(prepared.documentSnapshot.sections)) {
    for (const metadataKey of [
      "status",
      "code",
      "count",
      "limit",
      "hasMore",
      "note",
      "capturedAt"
    ]) {
      assert.equal(
        Object.hasOwn(section, metadataKey),
        false,
        `${metadataKey} section metadata must stay out of export`
      );
    }
  }
  assert.ok(prepared.disclosures.length >= 7);
  assert.ok(prepared.disclosures.some((entry) => entry.startsWith("Created experiences:")));
  assert.ok(prepared.disclosures.some((entry) => entry.startsWith("Two-step verification:")));
  assert.ok(prepared.disclosures.some((entry) => entry.startsWith("Robux purchases:")));
  assert.ok(prepared.disclosures.some((entry) => entry.startsWith("Failed Records:")));
  assert.ok(prepared.disclosures.some((entry) => entry.startsWith("Unconfirmed Shape:")));
  assert.deepEqual(
    JSON.parse(JSON.stringify(prepared.limitations)),
    ["Attach receipts separately."]
  );
  const bannedDocument = testHooks.prepareSnapshotForDocument({
    capturedAt: "2026-08-28T10:00:00.000Z",
    account: {
      userId: "123",
      username: "Builder",
      accountStatus: "Banned"
    },
    sections: {}
  }).documentSnapshot;
  assert.equal(
    bannedDocument.account.accountStatus,
    "Banned",
    "a positive Roblox ban state remains relevant moderation evidence"
  );

  elements.get("create-snapshot").dispatch("click");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    sentMessages.length,
    0,
    "a synthetic Create snapshot click must not request private account data"
  );

  context.location.href =
    "chrome-extension://recovery-fixture/recovery-snapshot.html?theme=dark&view=unsupported";
  elements.get("create-snapshot").dispatch("click", { isTrusted: true });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    sentMessages.length,
    0,
    "even a trusted click must be rejected outside the guarded Home-modal view"
  );

  context.location.href =
    "chrome-extension://recovery-fixture/recovery-snapshot.html?theme=dark&view=home-modal";
  elements.get("create-snapshot").dispatch("click", { isTrusted: true });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(
    JSON.parse(JSON.stringify(sentMessages[0])),
    {
      type: "rsl:account-recovery:collect",
      requestId: 1,
      sections: [
        "usernameHistory",
        "twoStepVerification",
        "purchases",
        "currencyPurchases",
        "tradeHistory",
        "createdExperiences",
        "violations"
      ]
    }
  );
  assert.equal(
    sentMessages[0].sections.includes("recentlyPlayed"),
    false,
    "an unchecked manual category must never be requested"
  );
  assert.equal(bodyAttributes.has("aria-busy"), false);
}

runRuntimeContract()
  .then(() => {
    console.log("PASS recovery snapshot Home-modal UI, privacy, export, and print contract");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
