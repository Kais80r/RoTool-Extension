"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const content = fs.readFileSync(path.join(root, "content.js"), "utf8");
const background = fs.readFileSync(path.join(root, "background.js"), "utf8");

function between(start, end) {
  const startIndex = content.indexOf(start);
  const endIndex = content.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing ${start}`);
  assert.notEqual(endIndex, -1, `missing ${end}`);
  return content.slice(startIndex, endIndex);
}

const mountTriggers = between(
  "  function mountGameTileCcuGraphTriggers(",
  "  function normalizeGameTileCcuHistoryPoints("
);
assert.match(mountTriggers, /!isFeatureEnabled\("gameCcuHoverGraph"\)/);
assert.doesNotMatch(
  mountTriggers,
  /isFeatureEnabled\("gameCcu"\)/,
  "native Roblox player counts must remain graph triggers when RoTool Player Counts is off"
);
assert.ok(
  mountTriggers.indexOf('!isFeatureEnabled("gameCcuHoverGraph")') <
    mountTriggers.indexOf("ensureGameTileCcuGraphEvents()"),
  "disabled graphs must not bind hover/focus events"
);

const openGraph = between(
  "  function openGameTileCcuGraph(",
  "  function clearGameTileCcuGraphHoverIntent("
);
assert.match(openGraph, /!isFeatureEnabled\("gameCcuHoverGraph"\)[\s\S]*?return null/);
assert.ok(
  openGraph.indexOf('!isFeatureEnabled("gameCcuHoverGraph")') <
    openGraph.indexOf("document.body.append(overlay)"),
  "disabled graphs must not create an overlay"
);

const loadHistory = between(
  "  function loadGameTileCcuGraphHistory(",
  "  function closeGameTileCcuGraph("
);
assert.match(loadHistory, /!isFeatureEnabled\("gameCcuHoverGraph"\)[\s\S]*?return false/);
assert.ok(
  loadHistory.indexOf('!isFeatureEnabled("gameCcuHoverGraph")') <
    loadHistory.indexOf("requestGameTileCcuHistory("),
  "disabled graphs must not send a foreground history request"
);

const hoverIntent = between(
  "  function scheduleGameTileCcuGraphHoverIntent(",
  "  function isGameTileCcuGraphAnchorNode("
);
assert.match(hoverIntent, /!isFeatureEnabled\("gameCcuHoverGraph"\)/);
assert.match(hoverIntent, /openGameTileCcuGraph\(trigger\)/);

const eventBinding = between(
  "  function ensureGameTileCcuGraphEvents(",
  "  function removeGameTileCcuGraphEvents("
);
assert.match(eventBinding, /!isFeatureEnabled\("gameCcuHoverGraph"\)/);
assert.ok(
  eventBinding.indexOf('!isFeatureEnabled("gameCcuHoverGraph")') <
    eventBinding.indexOf('document.addEventListener("pointerover"'),
  "the graph guard must precede every document listener"
);

for (const [name, source] of [
  ["isUsableGameTileCcuGraphTrigger", between(
    "  function isUsableGameTileCcuGraphTrigger(",
    "  function restoreGameTileCcuGraphTrigger("
  )],
  ["openGameTileCcuGraph", openGraph],
  ["loadGameTileCcuGraphHistory", loadHistory],
  ["scheduleGameTileCcuGraphHoverIntent", hoverIntent],
  ["ensureGameTileCcuGraphEvents", eventBinding]
]) {
  assert.doesNotMatch(
    source,
    /isFeatureEnabled\("gameCcu"\)/,
    `${name} must not couple graph behavior to RoTool Player Counts`
  );
}

const cleanup = between(
  "  function cleanupGameTileCcuGraphDisplay(",
  "  function syncGameTileCcu("
);
for (const required of [
  "gameTileCcuGraphLifecycleEpoch += 1",
  "closeGameTileCcuGraph()",
  "removeGameTileCcuGraphEvents()",
  "gameTileCcuGraphHistoryRequests.clear()",
  "GAME_TILE_CCU_GRAPH_TRIGGER_ATTRIBUTE",
  "restoreGameTileCcuGraphTrigger",
  "GAME_TILE_CCU_GRAPH_OVERLAY_ATTRIBUTE",
  "GAME_TILE_CCU_GRAPH_HOST_ATTRIBUTE",
  "GAME_TILE_CCU_GRAPH_OPEN_ATTRIBUTE"
]) {
  assert.ok(cleanup.includes(required), `graph-only cleanup is missing ${required}`);
}
for (const countArtifact of [
  "GAME_TILE_CCU_CONTAINER_ATTRIBUTE",
  "GAME_TILE_CCU_ATTRIBUTE",
  "GAME_TILE_CCU_VALUE_ATTRIBUTE",
  "GAME_TILE_RATING_VALUE_ATTRIBUTE",
  "gameTileCcuQueuedByPlaceId.clear()",
  "gameTileCcuPendingPlaceIds.clear()"
]) {
  assert.equal(
    cleanup.includes(countArtifact),
    false,
    `turning off only the graph must leave player counts intact (${countArtifact})`
  );
}

const restoreTrigger = between(
  "  function restoreGameTileCcuGraphTrigger(",
  "  function mountGameTileCcuGraphTriggers("
);
assert.match(restoreTrigger, /GAME_TILE_CCU_GRAPH_TABINDEX_ATTRIBUTE/);
assert.match(restoreTrigger, /removeAttribute\("tabindex"\)/);
assert.match(restoreTrigger, /removeAttribute\(GAME_TILE_CCU_GRAPH_TRIGGER_ATTRIBUTE\)/);

const closeGraph = between(
  "  function closeGameTileCcuGraph(",
  "  function openGameTileCcuGraph("
);
assert.match(closeGraph, /clearGameTileCcuGraphHoverIntent\(\)/);
assert.match(closeGraph, /clearGameTileCcuGraphCloseTimer\(active\)/);
assert.match(closeGraph, /clearGameTileCcuGraphNotTrackedRetry\(active\)/);
assert.match(closeGraph, /cancelAnimationFrame/);
assert.match(closeGraph, /restoreGameTileCcuGraphControlState\(active\)/);
assert.match(closeGraph, /restoreGameTileCcuGraphDescription\(active\)/);

const mountCounts = between(
  "  function mountGameTileCcu()",
  "  function invalidateStaleGameTileCcuControls("
);
assert.match(mountCounts, /if \(!isFeatureEnabled\("gameCcu"\)\)/);
assert.doesNotMatch(
  mountCounts.slice(0, mountCounts.indexOf("mountGameTileCcuGraphTriggers()")),
  /return[^}]*gameCcuHoverGraph/,
  "the graph child must not gate player-count mounting or CCU requests"
);
assert.doesNotMatch(
  mountCounts,
  /mountGameTileCcuGraphTriggers|cleanupGameTileCcuGraphDisplay/,
  "the Player Counts mount lifecycle must not own the graph lifecycle"
);
assert.match(mountCounts, /flushGameTileCcuRequests/);

const cleanupCounts = between(
  "  function cleanupGameTileCcuFeature(",
  "  function findQuickPlayRootThumbnail("
);
for (const graphArtifact of [
  "cleanupGameTileCcuGraphDisplay",
  "GAME_TILE_CCU_GRAPH_TRIGGER_ATTRIBUTE",
  "GAME_TILE_CCU_GRAPH_OVERLAY_ATTRIBUTE",
  "gameTileCcuGraphHistoryRequests"
]) {
  assert.equal(
    cleanupCounts.includes(graphArtifact),
    false,
    `turning off Player Counts must leave the independent graph intact (${graphArtifact})`
  );
}

const mountFeatures = between(
  "  function mountExtensionFeatures(",
  "  function mountSidebar("
);
assert.match(
  mountFeatures,
  /if \(isFeatureEnabled\("gameCcu"\)\) \{[\s\S]*?mountGameTileCcu\(\)[\s\S]*?cleanupGameTileCcuFeature\(\)[\s\S]*?if \(isFeatureEnabled\("gameCcuHoverGraph"\)\) \{[\s\S]*?mountGameTileCcuGraphTriggers\(\)[\s\S]*?cleanupGameTileCcuGraphDisplay\(\)/,
  "Player Counts and CCU Hover Graph need separate mount and cleanup branches"
);

const reconcile = between(
  "  function reconcileFeatureSettings(",
  "  function queueMount("
);
assert.match(
  reconcile,
  /previousSettings\.gameCcuHoverGraph !== nextSettings\.gameCcuHoverGraph[\s\S]*?cleanupGameTileCcuGraphDisplay\(\)/
);
const graphOnlyBranchStart = reconcile.search(
  /if \(\r?\n\s+previousSettings\.gameCcuHoverGraph/
);
assert.ok(graphOnlyBranchStart >= 0, "the graph-only reconcile branch must exist");
const graphOnlyBranch = reconcile.slice(
  graphOnlyBranchStart,
  reconcile.lastIndexOf("mountExtensionFeatures()")
);
assert.match(graphOnlyBranch, /FEATURE_SETTING_DEFINITIONS\.every/);
assert.match(graphOnlyBranch, /mountGameTileCcuGraphTriggers\(\)/);
assert.match(graphOnlyBranch, /return;/);
assert.ok(
  graphOnlyBranch.lastIndexOf("return;") < reconcile.lastIndexOf("mountExtensionFeatures()"),
  "a graph-only toggle must return before the full feature/card remount"
);

const backgroundFeatureValue = background.slice(
  background.indexOf("function getGameCcuHistoryFeatureValue("),
  background.indexOf("function ensureGameCcuHistoryAlarm(")
);
assert.match(backgroundFeatureValue, /rawValue\.flags\.gameCcuHoverGraph !== false/);
assert.doesNotMatch(
  backgroundFeatureValue,
  /flags\.gameCcu(?:\W|$)/,
  "Player Counts alone must not keep graph-history collection running"
);

console.log(
  "PASS independent CCU Hover Graph gating, cleanup, and graph-owned collection"
);
