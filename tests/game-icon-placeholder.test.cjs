"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const content = fs.readFileSync(path.join(root, "content.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function getFunctionSource(name) {
  const start = content.indexOf(`  function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const next = content.indexOf("\n  function ", start + 1);
  return content.slice(start, next === -1 ? content.length : next);
}

const definition = content.match(
  /const DEFAULT_GAME_ICON_URL\s*=\s*"(data:image\/svg\+xml,[^"]+)";/
);
assert.ok(definition, "the missing-game placeholder should remain an inline SVG");

const svg = decodeURIComponent(definition[1].slice("data:image/svg+xml,".length));
assert.match(svg, /^<svg xmlns='http:\/\/www\.w3\.org\/2000\/svg'/);
assert.match(
  svg,
  /viewBox='0 0 150 150'/,
  "the shared placeholder should keep the 150 by 150 game-icon canvas"
);
assert.doesNotMatch(
  svg,
  /<rect\b[^>]*\bwidth='150'[^>]*\bheight='150'[^>]*\bfill=/,
  "the SVG canvas should stay transparent so each theme-aware frame supplies its surface"
);
assert.match(
  svg,
  /<rect\b[^>]*\brx='9'[^>]*\bfill='none'[^>]*\bstroke='#8e919b'/,
  "the placeholder should use RoTool's neutral muted photo-frame outline"
);
assert.match(svg, /<circle\b[^>]*\bfill='#8e919b'/);
assert.match(svg, /<path\b[^>]*\bfill='#8e919b'/);
assert.doesNotMatch(
  svg,
  /roblox|rotool|<text\b|rotate\(|M45 33l72 18/i,
  "a missing thumbnail must not look like Roblox branding or RoTool identity"
);

assert.equal(
  (content.match(/\bDEFAULT_GAME_ICON_URL\b/g) || []).length,
  9,
  "all existing game-placeholder consumers should continue sharing one constant"
);

for (const [name, label] of [
  ["makeExperiencePlaceCard", "Experience Places"],
  ["makeInGameBestFriendHoverCard", "Best Friend hover cards"],
  ["createPrivateServersDialog", "Private Servers"],
  ["renderServerHistorySession", "Server History"]
]) {
  const source = getFunctionSource(name);
  assert.match(source, /(?:image\.alt\s*=\s*""|<img[^>]+alt="")/);
  if (label === "Private Servers" || label === "Server History") {
    assert.match(source, /(?:aria-hidden|setAttribute\("aria-hidden",\s*"true"\))/);
  }
}

for (const selector of [
  ".rsl-experience-places__thumbnail",
  ".rsl-owned-thumbnail-frame",
  ".rsl-private-servers-dialog__game-icon",
  ".rsl-server-history__thumbnail"
]) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(
    styles,
    new RegExp(`${escapedSelector}\\s*\\{[^}]*\\bbackground(?:-color)?\\s*:`, "s"),
    `${selector} should keep supplying a theme-aware surface behind the transparent SVG`
  );
}

console.log("game icon placeholder tests passed");
