"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const backgroundSource = fs.readFileSync(path.join(projectRoot, "background.js"), "utf8");
const fixtureSource = fs.readFileSync(
  path.join(__dirname, "background-fixture-bootstrap.js"),
  "utf8"
);

const body = {
  dataset: {},
  append(script) {
    try {
      vm.runInContext(backgroundSource, context, { filename: "background.js" });
      queueMicrotask(() => script.listeners.get("load")?.());
    } catch (error) {
      queueMicrotask(() => script.listeners.get("error")?.(error));
    }
  }
};

const document = {
  body,
  title: "",
  createElement(tagName) {
    assert.equal(tagName, "script");
    return {
      src: "",
      listeners: new Map(),
      addEventListener(type, listener) {
        this.listeners.set(type, listener);
      }
    };
  }
};

const storageData = {};
const sessionStorageData = {};

function makeStorageArea(data) {
  return {
    get(keys, callback) {
      let result;
      if (keys === null || keys === undefined) {
        result = { ...data };
      } else if (typeof keys === "string") {
        result = { [keys]: data[keys] };
      } else if (Array.isArray(keys)) {
        result = Object.fromEntries(keys.map((key) => [key, data[key]]));
      } else {
        result = { ...keys };
        for (const key of Object.keys(keys)) {
          if (Object.hasOwn(data, key)) {
            result[key] = data[key];
          }
        }
      }
      callback?.(result);
      return Promise.resolve(result);
    },
    set(values, callback) {
      Object.assign(data, values);
      callback?.();
      return Promise.resolve();
    },
    remove(keys, callback) {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        delete data[key];
      }
      callback?.();
      return Promise.resolve();
    },
    clear(callback) {
      for (const key of Object.keys(data)) {
        delete data[key];
      }
      callback?.();
      return Promise.resolve();
    }
  };
}

const chrome = {
  runtime: {
    id: "fixture-extension",
    lastError: null,
    onInstalled: { addListener() {} },
    onMessage: { addListener() {} }
  },
  contextMenus: {
    create(_properties, callback) { callback?.(); },
    removeAll(callback) { callback?.(); },
    onClicked: { addListener() {} }
  },
  storage: {
    local: makeStorageArea(storageData),
    session: makeStorageArea(sessionStorageData)
  },
  tabs: { sendMessage() {} }
};

const sandbox = {
  URL,
  Response,
  Headers,
  AbortController,
  TextDecoder,
  console,
  chrome,
  document,
  fetch: globalThis.fetch,
  setTimeout,
  clearTimeout,
  queueMicrotask,
  globalThis: null
};
sandbox.globalThis = sandbox;
const context = vm.createContext(sandbox);

vm.runInContext(fixtureSource, context, { filename: "background-fixture-bootstrap.js" });

const deadline = Date.now() + 10_000;
const poll = setInterval(() => {
  if (!body.dataset.testResult && Date.now() < deadline) return;
  clearInterval(poll);
  assert.notEqual(body.dataset.testResult, undefined, "background fixture timed out");
  assert.equal(body.dataset.testResult, "pass", body.dataset.testMessage);
  console.log(`PASS ${body.dataset.testMessage}`);
}, 20);
