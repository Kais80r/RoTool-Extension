"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const contentSource = fs.readFileSync(path.join(projectRoot, "content.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(projectRoot, "styles.css"), "utf8");

globalThis.__rslContentTestHooks = { skipInitialize: true };
require(path.join(projectRoot, "content.js"));
const hooks = globalThis.__rslContentTestHooks;

const legacy = { id: "legacy", label: "Legacy", url: "https://www.roblox.com/home" };
assert.deepEqual(hooks.normalizeShortcut(legacy), {
  ...legacy,
  openInNewTab: false
});
assert.equal(hooks.normalizeShortcut({ ...legacy, openInNewTab: true }).openInNewTab, true);
for (const invalidFlag of ["true", 1, null, {}, []]) {
  assert.equal(
    hooks.normalizeShortcut({ ...legacy, openInNewTab: invalidFlag }).openInNewTab,
    false
  );
}
assert.equal(hooks.normalizeShortcut(null), null);
assert.equal(hooks.normalizeShortcut({ ...legacy, id: 1 }), null);

const moreThanTheLimit = Array.from({ length: 35 }, (_, index) => ({
  id: `shortcut-${index}`,
  label: `Shortcut ${index}`,
  url: `https://www.roblox.com/home?shortcut=${index}`,
  openInNewTab: index % 2 === 0
}));
assert.equal(hooks.normalizeShortcuts([null, ...moreThanTheLimit]).length, 30);
assert.deepEqual(hooks.normalizeShortcuts("invalid"), []);

assert.equal(hooks.shortcutListsEqual([legacy], [{ ...legacy, openInNewTab: false }]), true);
assert.equal(hooks.shortcutListsEqual([legacy], [{ ...legacy, openInNewTab: true }]), false);

function makeAnchor() {
  const attributes = new Map();
  return {
    href: "",
    title: "",
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    removeAttribute(name) {
      attributes.delete(name);
    }
  };
}

const anchor = makeAnchor();
hooks.syncShortcutNavigation(anchor, { ...legacy, openInNewTab: true });
assert.equal(anchor.href, legacy.url);
assert.equal(anchor.getAttribute("target"), "_blank");
assert.equal(anchor.getAttribute("rel"), "noopener noreferrer");
assert.match(anchor.title, /opens in a new tab/i);
assert.match(anchor.getAttribute("aria-label"), /opens in a new tab/i);

hooks.syncShortcutNavigation(anchor, { ...legacy, openInNewTab: false });
assert.equal(anchor.getAttribute("target"), null);
assert.equal(anchor.getAttribute("rel"), null);
assert.equal(anchor.title, legacy.label);
assert.equal(anchor.getAttribute("aria-label"), legacy.label);

assert.match(
  contentSource,
  /<input type="checkbox" name="openInNewTab">[\s\S]*?Open in a new tab/
);
assert.match(contentSource, /const openInNewTab = data\.has\("openInNewTab"\)/);
assert.match(
  contentSource,
  /\{ id: createId\(\), label, url, openInNewTab \}/
);
assert.match(
  contentSource,
  /function makeShortcutRow\([\s\S]*?syncShortcutNavigation\(anchor, shortcut\)/
);
assert.match(
  contentSource,
  /function syncShortcutNavigation\([\s\S]*?if \(anchor\.href !== shortcut\.url\) \{[\s\S]*?anchor\.href = shortcut\.url;/
);
assert.match(
  contentSource,
  /function updateShortcutRow\([\s\S]*?syncShortcutNavigation\(anchor, shortcut\)/
);
assert.match(contentSource, /newTabInput\.checked = shortcut\.openInNewTab === true/);
assert.match(contentSource, /newTabInput\.addEventListener\("change", async \(\) =>/);
assert.match(stylesSource, /\.rsl-shortcut-tab-option > input:focus-visible/);
assert.match(stylesSource, /\.rsl-manager__tab-option > input:focus-visible/);
assert.match(
  stylesSource,
  /@media \(max-width: 520px\)[\s\S]*?\.rsl-manager__controls\s*\{[\s\S]*?width: calc\(100% - 40px\);[\s\S]*?flex: 1 0 calc\(100% - 40px\);/
);

delete globalThis.__rslContentTestHooks;
console.log("PASS RoTool per-shortcut new-tab behavior");
