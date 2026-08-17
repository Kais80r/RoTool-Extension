"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
assert.equal(manifest.name, "RoTool");
assert.equal(manifest.version, "0.19.6");
assert.ok(manifest.permissions.includes("contextMenus"));
assert.ok(manifest.permissions.includes("clipboardWrite"));
assert.ok(manifest.permissions.includes("scripting"));
assert.ok(manifest.host_permissions.includes("https://create.roblox.com/*"));
const contextCopyScript = manifest.content_scripts.find((entry) =>
  entry.js?.includes("context-copy.js")
);
assert.equal(contextCopyScript?.run_at, "document_start");
assert.deepEqual(contextCopyScript?.matches, [
  "https://www.roblox.com/*",
  "https://create.roblox.com/*"
]);

const created = [];
const sent = [];
const injected = [];
const fetched = [];
const hooks = {};
let onSend = () => ({ ok: false });
const chrome = {
  runtime: {
    id: "fixture-extension",
    lastError: null,
    onInstalled: { addListener() {} },
    onMessage: { addListener() {} }
  },
  contextMenus: {
    create(item, callback) { created.push({ ...item }); callback?.(); },
    removeAll(callback) { created.length = 0; callback?.(); },
    onClicked: { addListener() {} }
  },
  scripting: {
    insertCSS(details, callback) { injected.push(["css", details]); callback?.(); },
    executeScript(details, callback) { injected.push(["js", details]); callback?.(); }
  },
  tabs: {
    sendMessage(tabId, message, options, callback) {
      sent.push({ tabId, message: { ...message }, options: { ...options } });
      const result = onSend(message);
      if (result?.lastError) {
        chrome.runtime.lastError = { message: result.lastError };
        callback?.();
        chrome.runtime.lastError = null;
      } else {
        callback?.(result);
      }
    }
  }
};
const sandbox = {
  URL,
  Response,
  Headers,
  AbortController,
  TextDecoder,
  console,
  chrome,
  fetch: async (input, options = {}) => {
    const url = new URL(String(input));
    fetched.push({ url: url.href, options });
    if (/^\/universes\/v1\/places\/[1-9]\d*\/universe$/.test(url.pathname)) {
      return new Response(JSON.stringify({ universeId: 987654 }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    throw new Error(`Unexpected fetch ${url.href}`);
  },
  setTimeout,
  clearTimeout,
  globalThis: null,
  __rslBackgroundTestHooks: hooks
};
sandbox.globalThis = sandbox;
vm.runInNewContext(fs.readFileSync(path.join(root, "background.js"), "utf8"), sandbox, {
  filename: "background.js"
});

const actions = Array.from(hooks.contextMenuActions);
const gameRoots = actions.filter((item) => item.title === "Copy Game IDs");
assert.equal(gameRoots.length, 1, "Copy Game IDs must be one grouped root");
assert.deepEqual(
  Array.from(gameRoots[0].children, (child) => [child.key, child.title, child.action, child.route]),
  [
    ["place", "Copy Place ID", "placeId", "place"],
    ["universe", "Copy Universe ID / Game ID", "universeId", "universe"]
  ]
);
assert.equal(actions.some((item) => item.key === "place" || item.key === "universe"), false);

const parse = hooks.parseRobloxContextUrl;
assert.equal(parse("https://www.roblox.com/de/games/123/example")?.placeId, "123");
assert.equal(parse("https://www.roblox.com/PT-BR/users/456/profile")?.userId, "456");
for (const rejected of [
  "https://www.roblox.com:444/games/123/example",
  "https://www.roblox.com/zz/games/123/example",
  "https://www.roblox.com.evil.example/games/123/example",
  "https://name:password@www.roblox.com/games/123/example"
]) {
  assert.equal(parse(rejected), null, `accepted invalid route: ${rejected}`);
}

hooks.setupContextMenus();
const expectedCount = actions.reduce(
  (count, item) => count + 1 + (item.children?.length || 0),
  0
) * 2;
assert.equal(created.length, expectedCount);
for (const scope of ["page", "target"]) {
  const rootId = `rsl-context:${scope}:game-ids`;
  assert.equal(created.filter((item) => item.id === rootId).length, 1);
  const place = created.find((item) => item.id === `${rootId}-place`);
  const universe = created.find((item) => item.id === `${rootId}-universe`);
  assert.equal(place?.title, "Copy Place ID");
  assert.equal(universe?.title, "Copy Universe ID / Game ID");
  assert.equal(place?.parentId, rootId);
  assert.equal(universe?.parentId, rootId);
  const field = scope === "page" ? "documentUrlPatterns" : "targetUrlPatterns";
  assert.deepEqual(Array.from(place[field]), Array.from(hooks.contextMenuRoutePatterns.place));
  assert.deepEqual(
    Array.from(universe[field]),
    Array.from(hooks.contextMenuRoutePatterns.universe)
  );
}
assert.ok(
  Array.from(hooks.contextMenuRoutePatterns.place).includes("https://www.roblox.com/de/games/*")
);
assert.ok(
  Array.from(hooks.contextMenuRoutePatterns.universe).includes(
    "https://www.roblox.com/pt-br/games/*"
  )
);

assert.equal(hooks.getCopyRobloxIdsFeatureValue(null), true);
assert.equal(
  hooks.getCopyRobloxIdsFeatureValue({ version: 1, flags: { copyRobloxIds: false } }),
  false
);
hooks.setCopyRobloxIdsEnabledForTests(false);
hooks.setupContextMenus();
assert.equal(created.length, 0);
hooks.setCopyRobloxIdsEnabledForTests(true);

const tabUrl = "https://www.roblox.com/games/555/open-page";
const snapshot = (overrides = {}) => ({
  version: 1,
  capturedAt: Date.now(),
  pageUrl: tabUrl,
  sourceUrl: "https://www.roblox.com/games/222/card",
  ids: { placeId: "222", userId: null },
  ...overrides
});
const reset = () => { sent.length = 0; injected.length = 0; };
const copied = () => sent
  .filter((entry) => entry.message.type === "rsl:copy-context-text")
  .map((entry) => entry.message.text);
const ready = (target = null, copyOk = true) => {
  onSend = (message) => {
    if (message.type === "rsl:context-copy-ready") return { ok: true, version: 2 };
    if (message.type === "rsl:get-context-copy-target") {
      return { ok: true, version: 1, snapshot: target };
    }
    if (message.type === "rsl:copy-context-text") return { ok: copyOk };
    return { ok: true };
  };
};
const clickPlace = (extra = {}, tabExtra = {}) => hooks.handleContextMenuClick(
  {
    menuItemId: "rsl-context:target:game-ids-place",
    pageUrl: tabUrl,
    ...extra
  },
  { id: 41, url: tabUrl, ...tabExtra }
);

async function main() {
  reset(); ready(snapshot());
  await clickPlace({
    linkUrl: "https://www.roblox.com/games/111/link",
    srcUrl: "https://www.roblox.com/games/333/src"
  });
  assert.deepEqual(copied(), ["111"], "link must beat captured/src/page targets");
  assert.equal(injected.length, 0, "ready helper path reinjected files");

  reset(); ready(snapshot());
  await clickPlace({ srcUrl: "https://www.roblox.com/games/333/src" });
  assert.deepEqual(copied(), ["222"], "game card target was replaced by open page");

  reset(); ready(null);
  await clickPlace({ srcUrl: "https://www.roblox.com/games/333/src" });
  assert.deepEqual(copied(), ["333"], "src must beat page/tab");

  reset(); ready(null);
  await clickPlace(
    { pageUrl: "https://www.roblox.com/games/444/context-page" },
    { url: tabUrl }
  );
  assert.deepEqual(copied(), ["444"], "page must beat tab fallback");

  reset(); ready(snapshot());
  await clickPlace({ frameId: 19, linkUrl: "https://www.roblox.com/games/777/subframe" });
  assert.deepEqual(copied(), ["777"]);
  assert.ok(sent.every((entry) => entry.options.frameId === 0), "messages escaped top frame");

  reset();
  let readyCount = 0;
  onSend = (message) => {
    if (message.type === "rsl:context-copy-ready") {
      readyCount += 1;
      return readyCount === 1
        ? { lastError: "Receiving end does not exist" }
        : { ok: true, version: 2 };
    }
    if (message.type === "rsl:get-context-copy-target") {
      return { ok: true, version: 1, snapshot: null };
    }
    return { ok: true };
  };
  await clickPlace({ frameId: 9, linkUrl: "https://www.roblox.com/games/888/retry" });
  assert.equal(readyCount, 2);
  assert.deepEqual(injected.map(([kind]) => kind), ["css", "js"]);
  assert.ok(injected.every(([, details]) => details.target.frameIds[0] === 0));
  assert.deepEqual(copied(), ["888"], "recovery duplicated final copy");

  reset();
  let falseReadyCount = 0;
  onSend = (message) => {
    if (message.type === "rsl:context-copy-ready") {
      falseReadyCount += 1;
      return falseReadyCount === 1 ? { ok: false, version: 2 } : { ok: true, version: 2 };
    }
    if (message.type === "rsl:get-context-copy-target") {
      return { ok: true, version: 1, snapshot: null };
    }
    if (message.type === "rsl:copy-context-text") return { ok: false };
    return { ok: true };
  };
  await clickPlace({ linkUrl: "https://www.roblox.com/games/889/false" });
  assert.equal(falseReadyCount, 2, "{ok:false} readiness was treated as success");
  assert.deepEqual(injected.map(([kind]) => kind), ["css", "js"]);
  assert.deepEqual(copied(), ["889"], "{ok:false} caused duplicate copy delivery");

  const normalize = hooks.normalizeContextCopyTargetSnapshot;
  assert.equal(normalize(snapshot({ capturedAt: Date.now() - 31_000 }), tabUrl), null);
  assert.equal(
    normalize(snapshot({ pageUrl: "https://www.roblox.com/games/556/old" }), tabUrl),
    null
  );
  const hostile = "https://www.roblox.com.evil.example/games/555";
  assert.equal(normalize(snapshot({ pageUrl: hostile }), hostile), null);

  reset(); fetched.length = 0; ready(null);
  await hooks.handleContextMenuClick(
    {
      menuItemId: "rsl-context:target:game-ids-universe",
      linkUrl: "https://www.roblox.com/games/9001/lookup",
      pageUrl: tabUrl
    },
    { id: 41, url: tabUrl }
  );
  assert.deepEqual(copied(), ["987654"]);
  assert.equal(fetched.length, 1);
  assert.equal(fetched[0].url, "https://apis.roblox.com/universes/v1/places/9001/universe");
  assert.equal(fetched[0].options.credentials, "include");

  console.log("PASS RoTool context-menu grouping, target priority, recovery, and lookup");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
