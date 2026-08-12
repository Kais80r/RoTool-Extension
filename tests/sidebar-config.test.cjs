"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "manifest.json"), "utf8"));
const contentSource = fs.readFileSync(path.join(projectRoot, "content.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(projectRoot, "styles.css"), "utf8");
const readme = fs.readFileSync(path.join(projectRoot, "README.md"), "utf8");

assert.equal(manifest.version, "0.16.29");
assert.match(contentSource, /function findSidebarInsertBoundary\(list, addRow\)/);
assert.match(contentSource, /const peerClassCandidates = \[/);
assert.match(contentSource, /const anchor = row\.querySelector\(":scope > a\[href\]"\)/);
assert.match(contentSource, /if \(!row\.matches\?\.\("li"\) \|\| isExtensionRow\(row\)\)/);
assert.match(contentSource, /while \(boundary && isExtensionRow\(boundary\)\)/);
assert.match(contentSource, /return findPremiumRow\(list\);/);
assert.match(contentSource, /pathname === "\/plus"/);
assert.match(contentSource, /placeAddRow\(list, addRow\);/);
const mountSidebarSource = contentSource.slice(
  contentSource.indexOf("function mountSidebar()"),
  contentSource.indexOf("function queueMount()")
);
assert.ok(
  mountSidebarSource.indexOf("placeAddRow(list, addRow);") <
    mountSidebarSource.indexOf("const orderedRows = [];")
);
assert.ok(
  mountSidebarSource.lastIndexOf("placeAddRow(list, addRow);") >
    mountSidebarSource.indexOf("const orderedRows = [];")
);
assert.match(
  stylesSource,
  /\.rsl-sidebar-icon--plus::before,[\s\S]*?width: 16px;\s*height: 2px;/
);
assert.doesNotMatch(
  stylesSource,
  /\.rsl-sidebar-icon--plus::before,[\s\S]*?width: 16px;\s*height: 10px;/
);
assert.match(readme, /immediately above any promotional card/);

console.log("PASS RoTool sidebar promo boundary and thin Add shortcut plus configuration");
