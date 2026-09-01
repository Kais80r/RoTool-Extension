"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const manifest = JSON.parse(read("manifest.json"));
const packageFiles = JSON.parse(read("updater/package-files.json"));
const html = read("popup.html");
const css = read("popup.css");
const source = read("popup.js");

assert.equal(manifest.action.default_popup, "popup.html");
assert.equal(manifest.action.default_title, "RoTool");
for (const asset of ["popup.html", "popup.css", "popup.js"]) {
  assert.equal(
    packageFiles.filter((entry) => entry === asset).length,
    1,
    `${asset} must be packaged exactly once`
  );
}

const csp = html.match(
  /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i
)?.[1];
assert.ok(csp, "the toolbar popup must declare a CSP");
for (const directive of [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "connect-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
]) {
  assert.ok(csp.includes(directive), `missing popup CSP directive: ${directive}`);
}
assert.doesNotMatch(csp, /'unsafe-inline'|'unsafe-eval'|\*/i);
assert.match(html, /<script src="popup\.js" defer><\/script>/);
assert.match(html, /<link rel="stylesheet" href="popup\.css">/);
assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
assert.equal((html.match(/data-popup-action=/g) || []).length, 2);
assert.match(html, /data-popup-action="settings"[\s\S]*?RoTool Settings/);
assert.match(html, /data-popup-action="archive"[\s\S]*?Recovery Snapshots/);
assert.match(html, /Recovery Snapshots[\s\S]*?View or create snapshots/);
assert.doesNotMatch(
  html,
  /data-popup-action="archive"[^>]*\bhidden\b/,
  "the archive action must remain visible when the toolbar popup opens"
);
assert.doesNotMatch(html, /Open Roblox/i, "the compact popup must not duplicate Settings navigation");
assert.match(html, /aria-label="RoTool menu"/);
assert.match(css, /width:\s*328px/);
assert.match(css, /\.rsl-popup__item:focus-visible/);
assert.match(css, /min-height:\s*58px/);
assert.doesNotMatch(source, /innerHTML|outerHTML|insertAdjacentHTML|eval\s*\(|new Function|fetch\s*\(/);
assert.doesNotMatch(source, /actions\[0\]\?\.focus\(\)/,
  "the popup must not paint a keyboard focus ring before keyboard navigation");
assert.doesNotMatch(source, /rslFeatureSettingsV1|chrome\.storage/,
  "the toolbar archive launcher must not depend on the Recovery master setting");
assert.match(source, /rsl:toolbar-popup:open-recovery-snapshots/);
assert.match(source, /chrome\.runtime\.sendMessage\(\s*\{ type: TOOLBAR_POPUP_SETTINGS_MESSAGE_TYPE \}/s);

class FakeButton {
  constructor(action, document) {
    this.dataset = { popupAction: action };
    this.disabled = false;
    this.hidden = false;
    this.document = document;
  }

  closest(selector) {
    return selector === "[data-popup-action]" ? this : null;
  }

  focus() {
    this.document.activeElement = this;
  }
}

function createFixture({
  messageResponse = null,
  archiveMessageResponse = null,
  runtimeError = null,
  incognitoContext = false
} = {}) {
  const menuListeners = new Map();
  const documentListeners = new Map();
  const status = { textContent: "", hidden: true };
  const menu = {
    attributes: new Map(),
    addEventListener(type, listener) { menuListeners.set(type, listener); },
    setAttribute(name, value) { this.attributes.set(name, value); }
  };
  const document = {
    activeElement: null,
    getElementById(id) {
      if (id === "popup-menu") return menu;
      if (id === "popup-status") return status;
      return null;
    },
    querySelectorAll(selector) {
      return selector === "[data-popup-action]" ? actions : [];
    },
    addEventListener(type, listener) { documentListeners.set(type, listener); }
  };
  const actions = [
    new FakeButton("settings", document),
    new FakeButton("archive", document)
  ];
  const sentMessages = [];
  const createdTabs = [];
  let closeCount = 0;
  const chrome = {
    extension: { inIncognitoContext: incognitoContext },
    runtime: {
      lastError: null,
      getURL(relativePath) {
        return `chrome-extension://toolbar-popup-fixture/${relativePath}`;
      },
      sendMessage(message, callback) {
        sentMessages.push(structuredClone(message));
        this.lastError = runtimeError;
        const response = message.type ===
          "rsl:toolbar-popup:open-recovery-snapshots"
          ? archiveMessageResponse
          : messageResponse;
        callback?.(response && structuredClone(response));
        this.lastError = null;
      }
    }
  };
  const sandbox = {
    chrome,
    document,
    HTMLButtonElement: FakeButton,
    window: { close() { closeCount += 1; } },
    structuredClone
  };
  vm.runInNewContext(source, sandbox, { filename: "popup.js" });
  return {
    actions,
    chrome,
    createdTabs,
    document,
    documentListeners,
    menu,
    menuListeners,
    sentMessages,
    status,
    get closeCount() { return closeCount; },
    click(index) {
      menuListeners.get("click")?.({ target: actions[index] });
    },
    keydown(key) {
      let prevented = false;
      menuListeners.get("keydown")?.({
        key,
        preventDefault() { prevented = true; }
      });
      return prevented;
    }
  };
}

{
  const fixture = createFixture({
    messageResponse: {
      ok: true,
      type: "rsl:toolbar-popup:open-settings"
    }
  });
  assert.equal(fixture.document.activeElement, null,
    "opening the popup must not show an initial focus ring");
  fixture.click(0);
  assert.deepEqual(fixture.sentMessages, [{
    type: "rsl:toolbar-popup:open-settings"
  }]);
  assert.equal(fixture.createdTabs.length, 0);
  assert.equal(fixture.closeCount, 1, "Settings launch did not close the popup");
}

{
  const fixture = createFixture({
    archiveMessageResponse: {
      ok: true,
      type: "rsl:toolbar-popup:open-recovery-snapshots"
    }
  });
  fixture.click(1);
  assert.deepEqual(fixture.sentMessages, [{
    type: "rsl:toolbar-popup:open-recovery-snapshots"
  }]);
  assert.equal(fixture.createdTabs.length, 0,
    "the popup unexpectedly opened the archive without using the background");
  assert.equal(fixture.closeCount, 1, "archive launch did not close the popup");
}

{
  const fixture = createFixture({
    archiveMessageResponse: {
      ok: true,
      type: "rsl:toolbar-popup:open-recovery-snapshots"
    }
  });
  assert.equal(fixture.actions[0].hidden, false);
  assert.equal(fixture.actions[0].disabled, false);
  assert.equal(fixture.actions[1].hidden, false);
  assert.equal(fixture.actions[1].disabled, false);
  fixture.click(1);
  assert.deepEqual(fixture.sentMessages, [{
    type: "rsl:toolbar-popup:open-recovery-snapshots"
  }]);
  assert.equal(fixture.closeCount, 1);
}

{
  const fixture = createFixture({ incognitoContext: true });
  fixture.click(1);
  assert.equal(fixture.sentMessages.length, 0);
  assert.equal(fixture.closeCount, 0);
  assert.equal(fixture.status.hidden, false);
  assert.match(fixture.status.textContent, /unavailable in InPrivate browsing/);
}

{
  const fixture = createFixture({ messageResponse: { ok: true } });
  fixture.click(0);
  assert.equal(fixture.closeCount, 0, "an untyped response closed the popup");
  assert.equal(fixture.status.hidden, false);
  assert.match(fixture.status.textContent, /could not open Settings/);
  assert.ok(fixture.actions.every((action) => action.disabled === false));
}

{
  const fixture = createFixture();
  assert.equal(fixture.keydown("ArrowDown"), true);
  assert.equal(fixture.document.activeElement, fixture.actions[0]);
  assert.equal(fixture.keydown("ArrowUp"), true);
  assert.equal(fixture.document.activeElement, fixture.actions[1]);
}

console.log("PASS compact secure RoTool toolbar popup menu");
