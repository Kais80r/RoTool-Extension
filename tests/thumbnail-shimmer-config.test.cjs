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

function splitSelectorList(selector) {
  const branches = [];
  let start = 0;
  let depth = 0;
  let quote = "";

  for (let index = 0; index < selector.length; index += 1) {
    const character = selector[index];
    if (quote) {
      if (character === quote && selector[index - 1] !== "\\") {
        quote = "";
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "(" || character === "[") {
      depth += 1;
    } else if (character === ")" || character === "]") {
      depth = Math.max(0, depth - 1);
    } else if (character === "," && depth === 0) {
      branches.push(selector.slice(start, index).trim());
      start = index + 1;
    }
  }
  branches.push(selector.slice(start).trim());
  return branches.filter(Boolean);
}

assert.match(
  content,
  /function setOwnedThumbnailState\(frame, state\)/,
  "RoTool thumbnails should share one owned loading-state helper"
);
assert.match(
  content,
  /bestFriendsLoadState === "refreshing" \? "ready" : bestFriendsLoadState/,
  "background Best Friends refreshes must preserve loaded avatar elements"
);
assert.match(
  content,
  /setOwnedThumbnailState\(icon, "loading"\)/,
  "sidebar shortcut thumbnails should use the RoTool shimmer lifecycle"
);
const sidebarRequestSource = getFunctionSource("requestThumbnail");
assert.match(sidebarRequestSource, /rslThumbnailState = "loaded"/);
assert.match(sidebarRequestSource, /rslThumbnailState = "failed"/);

for (const [name, label] of [
  ["makeOnlineFriendCard", "generated friend cards"],
  ["makeBestFriendTile", "Best Friends tiles"],
  ["renderBestFriendsPicker", "Best Friends picker avatars"]
]) {
  const source = getFunctionSource(name);
  assert.match(
    source,
    /rsl-owned-thumbnail-frame/,
    `${label} should be marked as RoTool-owned`
  );
  assert.match(
    source,
    /loadOwnedThumbnailImage\(/,
    `${label} should settle their loading state on image load or fallback`
  );
}
assert.match(
  content,
  /rsl-best-friends-picker__avatar-frame rsl-owned-thumbnail-frame/,
  "Best Friends picker avatars should use owned thumbnail frames"
);
assert.match(
  content,
  /thumbnail-2d-container width-full height-full rsl-owned-thumbnail-frame/,
  "Best Friend hover-card game images should use owned thumbnail frames"
);
assert.match(
  content,
  /rsl-private-servers-dialog__owner-avatar rsl-owned-thumbnail-frame/,
  "private-server owner avatars should use owned thumbnail frames"
);
assert.match(
  content,
  /rsl-private-servers-dialog__game-icon rsl-owned-thumbnail-frame/,
  "private-server game icons should use owned thumbnail frames"
);

const ownedImageLifecycleSource = getFunctionSource("loadOwnedThumbnailImage");
assert.match(ownedImageLifecycleSource, /beginOwnedThumbnailLoad\(/);
assert.match(ownedImageLifecycleSource, /addEventListener\("load"/);
assert.match(ownedImageLifecycleSource, /addEventListener\("error"/);
assert.match(ownedImageLifecycleSource, /finishOwnedThumbnailLoad\(/);
assert.match(ownedImageLifecycleSource, /"fallback"/);

const hoverRequestSource = getFunctionSource("requestBestFriendGameThumbnail");
assert.match(hoverRequestSource, /beginOwnedThumbnailLoad\(/);
assert.match(hoverRequestSource, /finishOwnedThumbnailLoad\(/);
assert.match(hoverRequestSource, /loadOwnedThumbnailImage\(/);

const privateLoadingSource = getFunctionSource("setPrivateServerThumbnailLoading");
assert.match(privateLoadingSource, /classList\.add\("rsl-owned-thumbnail-frame"\)/);
assert.match(privateLoadingSource, /rslThumbnailState = "loading"/);
const privateFinishSource = getFunctionSource("finishPrivateServerThumbnailLoading");
assert.match(privateFinishSource, /rslThumbnailState = finalState/);

assert.match(
  styles,
  /\.rsl-owned-thumbnail-frame\[data-rsl-thumbnail-state="loading"\]::after\s*\{[^}]*animation:\s*rsl-thumbnail-shimmer/s,
  "the animated shimmer must require RoTool's ownership marker"
);
assert.match(
  styles,
  /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.rsl-owned-thumbnail-frame\[data-rsl-thumbnail-state="loading"\]::after[\s\S]*animation:\s*none/,
  "reduced-motion users should not receive an animated shimmer"
);

const stylesWithoutComments = styles.replace(/\/\*[\s\S]*?\*\//g, "");
const animatedRules = Array.from(
  stylesWithoutComments.matchAll(
    /([^{}]+)\{[^{}]*animation:\s*rsl-thumbnail-shimmer[^{}]*\}/g
  ),
  (match) => match[1].trim()
);
assert.ok(animatedRules.length > 0, "the shimmer animation rule should exist");
for (const selector of animatedRules) {
  for (const branch of splitSelectorList(selector)) {
    assert.match(
      branch,
      /\.rsl-owned-thumbnail-frame\[data-rsl-thumbnail-state="loading"\]::after$/,
      `native or unscoped shimmer selector found: ${branch}`
    );
  }
}

const loadingStateRules = Array.from(
  stylesWithoutComments.matchAll(/([^{}]+)\{[^{}]*\}/g),
  (match) => match[1].trim()
).filter((selector) => selector.includes('[data-rsl-thumbnail-state="loading"]'));
assert.ok(loadingStateRules.length > 0, "owned loading-state styles should exist");
for (const selector of loadingStateRules) {
  for (const branch of splitSelectorList(selector)) {
    assert.match(
      branch,
      /\.rsl-owned-thumbnail-frame/,
      `loading-state styling escaped the ownership boundary: ${branch}`
    );
  }
}

assert.doesNotMatch(
  styles,
  /(?:\.thumbnail-2d-container|\.avatar-card-image|\.game-card-thumb-container)[^{]*data-rsl-thumbnail-state[^}]*animation:\s*rsl-thumbnail-shimmer/s,
  "native Roblox thumbnail classes must never activate RoTool's shimmer"
);

console.log("thumbnail shimmer config tests passed");
