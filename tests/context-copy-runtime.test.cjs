"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "context-copy.js"), "utf8");
let now = 1_000_000;
let execCopyResult = true;
let execCopyCalls = 0;

class Element {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.nodeType = 1;
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.className = "";
    this.id = "";
    this.textContent = "";
    this.value = "";
    this.href = "";
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === "href") this.href = String(value);
  }

  getAttribute(name) { return this.attributes.get(name) ?? null; }

  append(...nodes) {
    for (const node of nodes) {
      node.parentElement = this;
      this.children.push(node);
    }
  }

  matches(selector) {
    return selector.split(",").some((rawPart) => {
      const part = rawPart.trim();
      if (part === "a[href]") return this.tagName === "A" && Boolean(this.href);
      if (part.startsWith(".")) {
        return this.className.split(/\s+/).includes(part.slice(1));
      }
      const attribute = part.match(/^\[([^=\]]+)\]$/)?.[1];
      if (attribute) return this.attributes.has(attribute);
      const testId = part.match(/^\[data-testid='([^']+)'\]$/)?.[1];
      return testId ? this.getAttribute("data-testid") === testId : false;
    });
  }

  closest(selector) {
    for (let node = this; node; node = node.parentElement) {
      if (node.matches(selector)) return node;
    }
    return null;
  }

  querySelector(selector) {
    for (const child of this.children) {
      if (child.matches(selector)) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }

  select() {}
  setSelectionRange() {}
  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((node) => node !== this);
    this.parentElement = null;
  }
}

const documentListeners = new Map();
const document = {
  createElement(tagName) { return new Element(tagName, document); },
  addEventListener(type, listener) {
    const listeners = documentListeners.get(type) || [];
    listeners.push(listener);
    documentListeners.set(type, listeners);
  },
  getElementById(id) {
    const visit = (node) => {
      if (node.id === id) return node;
      for (const child of node.children) {
        const found = visit(child);
        if (found) return found;
      }
      return null;
    };
    return visit(document.documentElement);
  },
  execCommand(command) {
    assert.equal(command, "copy");
    execCopyCalls += 1;
    return execCopyResult;
  },
  body: null,
  documentElement: null
};
document.documentElement = new Element("html", document);
document.body = new Element("body", document);
document.documentElement.append(document.body);

const runtimeListeners = [];
const chrome = {
  runtime: {
    id: "fixture-extension",
    onMessage: { addListener(listener) { runtimeListeners.push(listener); } }
  }
};
const location = { href: "https://www.roblox.com/home" };
const navigator = { clipboard: { writeText: async () => undefined } };
class FakeDate extends Date { static now() { return now; } }
const sandbox = {
  chrome,
  document,
  location,
  navigator,
  Date: FakeDate,
  setTimeout: () => 1,
  clearTimeout() {},
  console,
  globalThis: null,
  window: null
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
const context = vm.createContext(sandbox);
vm.runInContext(source, context, { filename: "context-copy.js" });
vm.runInContext(source, context, { filename: "context-copy.js" });
assert.equal(runtimeListeners.length, 1, "runtime was not idempotent");
assert.equal(documentListeners.get("contextmenu")?.length, 1, "capture listener was duplicated");

async function message(message) {
  let response;
  let resolveResponse;
  const pending = new Promise((resolve) => { resolveResponse = resolve; });
  const keptOpen = runtimeListeners[0](
    message,
    { id: chrome.runtime.id },
    (value) => { response = value; resolveResponse(value); }
  );
  if (response !== undefined) return { keptOpen, response };
  return keptOpen === true
    ? { keptOpen, response: await pending }
    : { keptOpen, response: undefined };
}

function capture(element) {
  for (const listener of documentListeners.get("contextmenu") || []) {
    listener({ isTrusted: true, target: element, composedPath: () => [element] });
  }
}

async function main() {
  const readiness = await message({ type: "rsl:context-copy-ready" });
  assert.equal(readiness.keptOpen, false);
  assert.equal(readiness.response.ok, true);
  assert.equal(readiness.response.version, 2);

  const cardLink = new Element("a", document);
  cardLink.href = "https://www.roblox.com/games/222/card";
  cardLink.setAttribute("data-rsl-quick-play-place-id", "222");
  capture(cardLink);
  const first = await message({ type: "rsl:get-context-copy-target" });
  assert.equal(first.response.ok, true);
  assert.equal(first.response.snapshot.pageUrl, location.href);
  assert.equal(first.response.snapshot.sourceUrl, cardLink.href);
  assert.equal(first.response.snapshot.ids.placeId, "222");
  assert.equal(
    (await message({ type: "rsl:get-context-copy-target" })).response.snapshot,
    null,
    "snapshot was not consumed exactly once"
  );

  capture(cardLink);
  location.href = "https://www.roblox.com/charts#/spa-route";
  assert.equal(
    (await message({ type: "rsl:get-context-copy-target" })).response.snapshot,
    null,
    "snapshot survived a SPA navigation"
  );
  location.href = "https://www.roblox.com/home";
  capture(cardLink);
  now += 31_000;
  assert.equal(
    (await message({ type: "rsl:get-context-copy-target" })).response.snapshot,
    null,
    "expired snapshot was returned"
  );

  let clipboardText = "";
  navigator.clipboard.writeText = async (text) => { clipboardText = text; };
  execCopyCalls = 0;
  assert.equal((await message({ type: "rsl:copy-context-text", text: "123" })).response.ok, true);
  assert.equal(clipboardText, "123");
  assert.equal(execCopyCalls, 0);

  navigator.clipboard.writeText = async () => { throw new Error("denied"); };
  execCopyResult = true;
  assert.equal((await message({ type: "rsl:copy-context-text", text: "456" })).response.ok, true);
  assert.equal(execCopyCalls, 1, "Clipboard API denial did not use fallback copy");

  execCopyResult = false;
  assert.equal((await message({ type: "rsl:copy-context-text", text: "789" })).response.ok, false);
  assert.equal(execCopyCalls, 2);
  const toast = document.getElementById("rsl-context-copy-toast");
  assert.equal(toast.dataset.kind, "error");
  assert.equal(
    toast.querySelector(".rsl-context-toast__message").textContent,
    "Your browser blocked the clipboard write."
  );

  console.log("PASS RoTool context-copy runtime capture, expiry, and clipboard behavior");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
