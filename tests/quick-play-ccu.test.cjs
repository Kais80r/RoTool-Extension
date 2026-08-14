"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const contentSource = fs.readFileSync(path.join(projectRoot, "content.js"), "utf8");
const backgroundSource = fs.readFileSync(path.join(projectRoot, "background.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(projectRoot, "styles.css"), "utf8");

function getNamedFunctionSource(source, name) {
  const start = source.indexOf(`  function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  const next = source.indexOf("\n  function ", start + 12);
  return source.slice(start, next === -1 ? source.length : next);
}

function getCssDeclaration(ruleBody, property) {
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|;)\\s*${escapedProperty}:\\s*([^;\\r\\n]+)`, "i")
    .exec(ruleBody)?.[1]?.trim() || "";
}

function parseCssColor(value) {
  const text = String(value || "").trim().toLowerCase();
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/.exec(text)?.[1];
  if (hex) {
    const normalized = hex.length === 3
      ? hex.split("").map((channel) => channel + channel).join("")
      : hex;
    return {
      channels: [0, 2, 4].map((offset) =>
        Number.parseInt(normalized.slice(offset, offset + 2), 16)
      ),
      alpha: 1
    };
  }
  const functional = /^rgba?\(([^)]+)\)$/.exec(text)?.[1];
  if (!functional) {
    return null;
  }
  const [channelText, alphaText] = functional.split("/").map((part) => part.trim());
  const channelTokens = channelText.split(/[\s,]+/).filter(Boolean);
  if (channelTokens.length !== 3) {
    return null;
  }
  const channels = channelTokens.map((token) => token.endsWith("%")
    ? Number.parseFloat(token) * 2.55
    : Number.parseFloat(token));
  const alpha = !alphaText
    ? 1
    : alphaText.endsWith("%")
      ? Number.parseFloat(alphaText) / 100
      : Number.parseFloat(alphaText);
  if (![...channels, alpha].every(Number.isFinite)) {
    return null;
  }
  return { channels, alpha };
}

function compositeCssColor(foreground, background, opacityMultiplier = 1) {
  const alpha = Math.max(0, Math.min(1, foreground.alpha * opacityMultiplier));
  return foreground.channels.map((channel, index) =>
    channel * alpha + background[index] * (1 - alpha)
  );
}

function relativeLuminance(channels) {
  const linear = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(first, second) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05);
}

function rgbDistance(first, second) {
  return Math.hypot(...first.map((channel, index) => channel - second[index]));
}

// RoTool owns only its own metric. Coexistence is based on meaningful page
// metadata, not the identity or load timing of a particular extension.
assert.match(
  contentSource,
  /(?:const|let|var)\s+GAME_TILE_CCU_ATTRIBUTE\s*=\s*["']data-rsl-game-tile-ccu["']/,
  "game-tile CCU must have an explicit RoTool ownership marker"
);
assert.match(
  contentSource,
  /(?:const|let|var)\s+GAME_TILE_CCU_VALUE_ATTRIBUTE\s*=\s*["']data-rsl-game-tile-ccu-value["']/,
  "the owned CCU value must be distinguishable from BTRoblox's value label"
);

const wideSelectorStart = contentSource.indexOf(
  "  const GAME_TILE_CCU_WIDE_CARD_SELECTOR = ["
);
assert.notEqual(wideSelectorStart, -1, "game-tile CCU needs an explicit wide-card selector");
const wideSelectorSource = contentSource.slice(
  wideSelectorStart,
  contentSource.indexOf("].join", wideSelectorStart)
);
assert.match(wideSelectorSource, /\.featured-game-container/);
assert.match(wideSelectorSource, /\.large-game-tile/);
assert.match(wideSelectorSource, /wide-game-tile/);
assert.doesNotMatch(
  wideSelectorSource,
  /\.game-card-container|game-card-thumbnail|experience-card-thumbnail/,
  "square/compact cards must not be included in the CCU scan"
);

const mountFeaturesSource = getNamedFunctionSource(contentSource, "mountExtensionFeatures");
assert.match(
  mountFeaturesSource,
  /if \(isFeatureEnabled\("quickPlay"\)\) \{[\s\S]*?\} else \{[\s\S]*?cleanupQuickPlayFeature\(\);[\s\S]*?\}\s*if \(isFeatureEnabled\("gameCcu"\)\) \{[\s\S]*?mountGameTileCcu\(\);[\s\S]*?\} else \{[\s\S]*?cleanupGameTileCcuFeature\(\);/,
  "Player Counts must mount under its own feature switch, after the independent Quick Play branch"
);
const reconcileFeaturesSource = getNamedFunctionSource(
  contentSource,
  "reconcileFeatureSettings"
);
assert.match(
  reconcileFeaturesSource,
  /previousSettings\.quickPlay !== nextSettings\.quickPlay[\s\S]*?cleanupQuickPlayFeature\(\);[\s\S]*?previousSettings\.gameCcu !== nextSettings\.gameCcu[\s\S]*?cleanupGameTileCcuFeature\(\);/,
  "Quick Play and Player Counts must reconcile independently"
);
const standaloneCcuStart = contentSource.indexOf(
  "  function normalizeGameTileCcuPlaceId("
);
const standaloneCcuEnd = contentSource.indexOf(
  "  function findQuickPlayRootThumbnail(",
  standaloneCcuStart
);
assert.ok(standaloneCcuStart >= 0 && standaloneCcuEnd > standaloneCcuStart);
const standaloneCcuSource = contentSource.slice(standaloneCcuStart, standaloneCcuEnd);
assert.doesNotMatch(
  standaloneCcuSource,
  /isFeatureEnabled\("quickPlay"\)|QUICK_PLAY_HOST_ATTRIBUTE|QUICK_PLAY_SURFACE_ATTRIBUTE/,
  "the Player Counts lifecycle must not depend on Quick Play being mounted"
);

assert.match(
  contentSource,
  /\.wide-game-tile-metadata/,
  "CCU mounting must recognize wide-card metadata supplied by Roblox or BTRoblox"
);
assert.match(
  contentSource,
  /\.playing-counts-label/,
  "CCU mounting must recognize an existing playing-count label"
);
assert.match(
  contentSource,
  /\.icon-playing-counts-gray/,
  "CCU mounting must recognize the playing-count icon used by BTRoblox"
);

const externalCcuHelperStart = contentSource.search(
  /function\s+(?:find|has|get)[A-Za-z0-9]*(?:External|Existing|Competing)[A-Za-z0-9]*(?:Ccu|CCU)\s*\(/
);
assert.notEqual(
  externalCcuHelperStart,
  -1,
  "CCU must have a dedicated helper that distinguishes external metadata"
);
const externalCcuHelperSource = contentSource.slice(
  externalCcuHelperStart,
  contentSource.indexOf("\n  function ", externalCcuHelperStart + 12)
);
assert.match(externalCcuHelperSource, /playing-counts-label/);
assert.match(
  externalCcuHelperSource,
  /GAME_TILE_CCU_VALUE_ATTRIBUTE|data-rsl-game-tile-ccu-value/,
  "RoTool's own value must not be mistaken for an external value"
);
assert.match(
  externalCcuHelperSource,
  /\\p\{Number\}|hasMeaningfulGameTileMetric/,
  "an empty external placeholder must not suppress RoTool's player count"
);
assert.match(
  externalCcuHelperSource,
  /nextElementSibling/,
  "a fallback value must be paired after the playing icon, not borrowed from vote metadata"
);
assert.doesNotMatch(
  externalCcuHelperSource,
  /closest\?\.\(["']\.game-card-info["']\)[\s\S]*querySelectorAll\(["']\.info-label["']\)/,
  "a vote percentage elsewhere in game-card-info must not masquerade as CCU"
);

const ccuSyncSource = getNamedFunctionSource(contentSource, "syncGameTileCcu");
const ccuFormatSource = getNamedFunctionSource(
  contentSource,
  "formatGameTileCcuCompactCount"
);
assert.doesNotMatch(
  ccuFormatSource,
  /Intl\.NumberFormat\(\s*(?:undefined|null)?\s*,\s*\{[\s\S]*?notation:\s*["']compact["']/,
  "compact CCU must not inherit the browser's decimal separator or locale-specific compact rules"
);
assert.match(
  ccuFormatSource,
  /(?:["']en(?:-US)?["']|toFixed\(1\)[\s\S]*?replace\(\/\\\.0)/,
  "compact CCU needs an ASCII-decimal formatting path"
);
assert.match(
  ccuSyncSource,
  /(?:find|has|get|sync)[A-Za-z0-9]*(?:External|Existing|Competing)[A-Za-z0-9]*(?:Ccu|CCU)[A-Za-z0-9]*\s*\(/,
  "every CCU reconciliation must check for external metadata first"
);
assert.match(
  ccuSyncSource,
  /GAME_TILE_CCU_ATTRIBUTE|data-rsl-game-tile-ccu/,
  "CCU reconciliation must find/reuse the owned metric instead of appending duplicates"
);
assert.match(
  ccuSyncSource,
  /\.remove\(\)/,
  "late BTRoblox metadata must remove a previously mounted RoTool metric"
);
assert.match(
  ccuSyncSource,
  /aria-label/,
  "the compact CCU display must retain an exact accessible playing-count label"
);
assert.match(
  ccuSyncSource,
  /aria-hidden/,
  "the decorative playing-count icon must be hidden from assistive technology"
);

const ccuMountSource = getNamedFunctionSource(contentSource, "mountGameTileCcu");
const ccuFlushSource = getNamedFunctionSource(
  contentSource,
  "flushGameTileCcuRequests"
);
const ccuSendSource = getNamedFunctionSource(contentSource, "sendGameTileCcuBatch");
assert.ok(
  ccuSendSource.indexOf("syncExternalGameTileCcuState(root)") >= 0 &&
    ccuSendSource.indexOf("syncExternalGameTileCcuState(root)") <
      ccuSendSource.indexOf("chrome.runtime.sendMessage("),
  "each batch must recheck meaningful external CCU immediately before sendMessage"
);
assert.match(
  ccuMountSource,
  /syncExternalGameTileCcuState\(root\)[\s\S]*?rootNeedsRating[\s\S]*?if \(external\)[\s\S]*?removeOwnedGameTileCcuCount\(root\)[\s\S]*?if \(!rootNeedsRating\)/,
  "external CCU must suppress only RoTool's count while still allowing a missing rating"
);
assert.match(
  ccuFlushSource,
  /syncExternalGameTileCcuState\(root\)[\s\S]*?rootNeedsRating[\s\S]*?if \(external\)[\s\S]*?removeOwnedGameTileCcuCount\(root\)[\s\S]*?if \(!rootNeedsRating\)/,
  "the flush must recheck external CCU without dropping a requested rating"
);
assert.doesNotMatch(
  standaloneCcuSource,
  /GAME_TILE_CCU_EXTERNAL_GRACE_MS|gameTileCcuGrace/,
  "cards without a meaningful external count must not wait for a specific extension"
);
assert.match(
  ccuMountSource,
  /queueGameTileCcuRoot\(root, identity\)[\s\S]*?flushGameTileCcuRequests\(now\)/,
  "an eligible uncached card must enter the immediate request flush"
);
assert.match(
  ccuFlushSource,
  /for \(let index = 0; index < requestItems\.length; index \+= GAME_TILE_CCU_MAX_BATCH_SIZE\)[\s\S]*?requestItems\.slice\(index, index \+ GAME_TILE_CCU_MAX_BATCH_SIZE\)/,
  "every eligible card must drain through automatic bounded chunks"
);
assert.match(
  ccuSendSource,
  /syncGameTileCcu\(\s*root,\s*item\.placeId,\s*row\.playing,\s*item\.universeId(?:,|\s*\))/s,
  "a place-only link must validate the response against its original null universe identity"
);
assert.doesNotMatch(
  ccuSendSource,
  /syncGameTileCcu\(\s*root,\s*item\.placeId,\s*row\.playing,\s*row\.universeId(?:,|\s*\))/s,
  "the resolved universe must not make a still-valid place-only card look recycled"
);

const ccuInvalidateSource = getNamedFunctionSource(
  contentSource,
  "invalidateStaleGameTileCcuControls"
);
assert.match(ccuInvalidateSource, /identity\.placeId\s*!==\s*expectedPlaceId/);
assert.match(ccuInvalidateSource, /expectedIdentity/);
const initializeSource = getNamedFunctionSource(contentSource, "initialize");
assert.match(
  initializeSource,
  /MutationObserver\(\(mutations\) => \{[\s\S]*?invalidateStaleGameTileCcuControls\(mutations\)/,
  "recycled-card href mutations must invalidate stale CCU before remounting"
);
assert.match(
  initializeSource,
  /characterData:\s*true/,
  "late external count text updates must be observed"
);
const mutationsAffectMountSource = getNamedFunctionSource(
  contentSource,
  "mutationsAffectExtensionMount"
);
assert.match(
  mutationsAffectMountSource,
  /mutation\.type\s*===\s*["']characterData["'][\s\S]*?return false/,
  "ordinary text updates must not queue an extension-wide remount"
);
const ccuCleanupSource = getNamedFunctionSource(
  contentSource,
  "cleanupGameTileCcuFeature"
);
assert.match(ccuCleanupSource, /gameTileCcuLifecycleEpoch \+= 1/);
assert.match(ccuCleanupSource, /clearTimeout\(gameTileCcuRefreshTimer\)/);
assert.match(ccuCleanupSource, /gameTileCcuIdentityByRoot\s*=\s*new WeakMap\(\)/);
assert.match(ccuCleanupSource, /gameTileCcuQueuedByPlaceId\.clear\(\)/);
assert.match(ccuCleanupSource, /gameTileCcuPendingPlaceIds\.clear\(\)/);
assert.match(ccuCleanupSource, /GAME_TILE_CCU_(?:CONTAINER_|VALUE_|ICON_)?ATTRIBUTE/);
assert.match(ccuCleanupSource, /GAME_TILE_CCU_EXTERNAL_ATTRIBUTE/);

assert.match(
  ccuSyncSource,
  /fallbackHost[\s\S]*?\.info-metadata-container[\s\S]*?fallbackHost\.append\(container\)/,
  "wide fallback CCU must use the card's metadata area instead of a title or description leaf"
);
assert.match(
  ccuSyncSource,
  /rsl-game-tile-ccu-metadata--corner/,
  "metadata-hosted fallback CCU needs its own corner slot"
);

// CSS suppression may only follow JavaScript's namespaced, meaningful-count
// decision. An empty external icon or label is not enough.
assert.match(
  stylesSource,
  /\[data-rsl-game-tile-ccu-external\][^{]*[\s\S]*?\[data-rsl-game-tile-ccu(?:-container|-icon|-value)?\][^{]*\{[^}]*display:\s*none\s*!important/s,
  "a JavaScript-confirmed external count must suppress RoTool's duplicate"
);
const ownedMetricInfoResetRule = stylesSource.match(
  /\.rsl-game-tile-ccu-metadata\s*>\s*\.game-card-info\s*\{([^}]*)\}/s
);
assert.ok(
  ownedMetricInfoResetRule,
  "owned fallback metadata needs a direct game-card-info reset rule"
);
assert.match(
  ownedMetricInfoResetRule[1],
  /position:\s*static\s*!important/,
  "Roblox's global game-card-info positioning must not lift owned metrics"
);
assert.match(ownedMetricInfoResetRule[1], /inset:\s*auto\s*!important/);
assert.match(
  ownedMetricInfoResetRule[1],
  /bottom:\s*auto\s*!important/,
  "the live bottom: 6px rule must be explicitly neutralized"
);
assert.match(ownedMetricInfoResetRule[1], /width:\s*auto\s*!important/);
assert.match(ownedMetricInfoResetRule[1], /margin:\s*0\s*!important/);

const sponsoredOwnedCcuGapRule = stylesSource.match(
  /\.game-card-info\.sponsored-footer\s*>\s*\.secondary-content:not\(\.bullet\)\s*>\s*\[data-rsl-game-tile-ccu-icon\]\s*\{([^}]*)\}/s
);
assert.ok(
  sponsoredOwnedCcuGapRule,
  "the visible sponsored metric group needs an owned-CCU spacing rule"
);
assert.match(
  sponsoredOwnedCcuGapRule[1],
  /margin-inline-start:\s*12px\s*!important/,
  "sponsored rating and CCU must retain the native 12px inter-metric gap"
);

const ownedMetricTitleRowRule = stylesSource.match(
  /\.info-metadata-container:has\(\s*>\s*\.rsl-game-tile-ccu-metadata--corner\s*\)\s*\{([^}]*)\}/s
);
assert.ok(
  ownedMetricTitleRowRule,
  "owned wide-card metrics need an explicit title-row layout host"
);
assert.match(
  ownedMetricTitleRowRule[1],
  /display:\s*grid\s*!important/,
  "the title and owned metrics must participate in one non-overlapping row"
);
assert.match(
  ownedMetricTitleRowRule[1],
  /grid-template-columns:\s*minmax\(\s*0\s*,\s*1fr\s*\)\s+max-content/,
  "the title must yield only the space actually occupied by rating and CCU"
);
assert.match(
  ownedMetricTitleRowRule[1],
  /align-items:\s*center/,
  "title text and metrics must share the same vertical center"
);
assert.match(
  ownedMetricTitleRowRule[1],
  /column-gap:\s*(?!0(?:\D|$))[^;]+/,
  "the title and metrics need an explicit non-zero separation"
);

const ownedMetricCornerRule = stylesSource.match(
  /\.info-metadata-container\s*>\s*\.rsl-game-tile-ccu-metadata--corner\s*\{([^}]*)\}/s
);
assert.ok(ownedMetricCornerRule, "owned metrics need a dedicated title-row cell");
assert.match(ownedMetricCornerRule[1], /grid-column:\s*2(?:\s*\/\s*3)?/);
assert.match(ownedMetricCornerRule[1], /grid-row:\s*1(?:\s*\/\s*2)?/);
assert.match(
  ownedMetricCornerRule[1],
  /align-self:\s*center/,
  "rating and CCU must be centered against the game-name line"
);
assert.doesNotMatch(
  ownedMetricCornerRule[1],
  /position:\s*absolute/,
  "an absolute corner can overlap narrow MM2-style titles and drift above their baseline"
);

const ownedMetricTitleRule = stylesSource.match(
  /\.info-metadata-container:has\(\s*>\s*\.rsl-game-tile-ccu-metadata--corner\s*\)[\s\S]*?>\s*\.game-card-name\s*\{([^}]*)\}/s
);
assert.ok(ownedMetricTitleRule, "the game name needs an explicit title-row cell");
assert.match(ownedMetricTitleRule[1], /grid-column:\s*1(?:\s*\/\s*2)?/);
assert.match(ownedMetricTitleRule[1], /grid-row:\s*1(?:\s*\/\s*2)?/);
assert.match(
  ownedMetricTitleRule[1],
  /min-width:\s*0/,
  "a long game name must shrink inside its own cell instead of colliding with metrics"
);

const ownedMetricMetadataRule = stylesSource.match(
  /\.info-metadata-container:has\(\s*>\s*\.rsl-game-tile-ccu-metadata--corner\s*\)[\s\S]*?>\s*\.wide-game-tile-metadata\s*\{([^}]*)\}/s
);
assert.ok(
  ownedMetricMetadataRule,
  "the existing description/friends metadata must receive a row below the title"
);
assert.match(ownedMetricMetadataRule[1], /grid-column:\s*1\s*\/\s*-1/);
assert.match(ownedMetricMetadataRule[1], /grid-row:\s*2(?:\s*\/\s*3)?/);

assert.match(
  backgroundSource,
  /games\.roblox\.com[\s\S]*?\/v1\/games\/votes|\/v1\/games\/votes[\s\S]*?games\.roblox\.com/,
  "large-card ratings must come from Roblox's batched universe-votes metadata"
);
assert.match(
  backgroundSource,
  /upVotes[\s\S]*?downVotes|downVotes[\s\S]*?upVotes/,
  "the rating percentage must be derived from Roblox up-vote and down-vote totals"
);

// CCU is public universe metadata. It should be fetched by the extension worker
// (not page JavaScript), validate the value, and never issue one request per
// remount of the same card.
assert.match(backgroundSource, /rsl:get-(?:game-tile-)?ccu/i);
assert.match(backgroundSource, /https:\/\/games\.roblox\.com/i);
assert.match(backgroundSource, /["']\/v1\/games["']/i);
assert.match(backgroundSource, /Number\.isSafeInteger\([^)]*playing[^)]*\)/);
assert.match(backgroundSource, /playing\s*>=\s*0/);
assert.match(
  backgroundSource,
  /(?:ccu|gameTileCcu)[A-Za-z0-9]*(?:Cache|Pending|Promise)/i,
  "CCU lookups must be cached or shared so remounts cannot multiply requests"
);

assert.match(backgroundSource, /const\s+GAME_CCU_(?:MAX_GAMES|BATCH_SIZE)\s*=\s*50\s*;/);
assert.match(backgroundSource, /const\s+GAME_CCU_CACHE_TTL_MS\s*=\s*30_000\s*;/);

// Exercise the semantic external-count predicate without coupling it to a
// browser DOM implementation.
const externalHelperSandbox = { result: null };
vm.runInNewContext(
  `const GAME_TILE_CCU_VALUE_ATTRIBUTE = "data-rsl-game-tile-ccu-value";\n` +
    `const GAME_TILE_CCU_ICON_ATTRIBUTE = "data-rsl-game-tile-ccu-icon";\n` +
    `${externalCcuHelperSource}\n` +
    `globalThis.result = findExternalGameTileCcu;`,
  externalHelperSandbox
);
const findExternalGameTileCcu = externalHelperSandbox.result;

function makeMetricNode(text, classes = [], attributes = {}) {
  const attrs = new Map(Object.entries(attributes));
  return {
    textContent: text,
    nextElementSibling: null,
    getAttribute(name) { return attrs.get(name) ?? null; },
    hasAttribute(name) { return attrs.has(name); },
    matches(selector) {
      return selector.split(",").some((part) =>
        classes.includes(part.trim().replace(/^\./, ""))
      );
    },
    closest() { return null; }
  };
}

function makeExternalRoot(labels, icon) {
  return {
    querySelectorAll(selector) {
      return selector.includes("playing-counts-label") ? labels : [];
    },
    querySelector(selector) {
      return selector.includes("icon-playing-counts-gray") ? icon : null;
    }
  };
}

const numericLabel = makeMetricNode("5.2K", ["info-label", "playing-counts-label"]);
assert.equal(
  findExternalGameTileCcu(makeExternalRoot([numericLabel], null))?.value,
  numericLabel,
  "a generic non-owned compact numeric player count must win"
);
const emptyLabel = makeMetricNode("", ["info-label", "playing-counts-label"]);
const playingIcon = makeMetricNode("", ["info-label", "icon-playing-counts-gray"]);
const voteLabel = makeMetricNode("66%", ["info-label", "vote-percentage-label"]);
playingIcon.nextElementSibling = emptyLabel;
playingIcon.closest = () => ({ querySelectorAll: () => [voteLabel, playingIcon, emptyLabel] });
assert.equal(
  findExternalGameTileCcu(makeExternalRoot([emptyLabel], playingIcon)),
  null,
  "an empty count placeholder plus an unrelated vote percentage must not suppress CCU"
);
const pairedCount = makeMetricNode("١٥٥", ["info-label"]);
playingIcon.nextElementSibling = pairedCount;
assert.equal(
  findExternalGameTileCcu(makeExternalRoot([], playingIcon))?.value,
  pairedCount,
  "a numeric value immediately paired after the playing icon is meaningful in any locale"
);

// A small DOM fixture exercises the content-side lifecycle itself. It models
// only the selectors and node operations used by the CCU helpers, keeping the
// test independent from a particular browser or third-party extension.
function splitSelectorList(selector) {
  const parts = [];
  let start = 0;
  let squareDepth = 0;
  let roundDepth = 0;
  let quote = "";
  for (let index = 0; index < selector.length; index += 1) {
    const character = selector[index];
    if (quote) {
      if (character === quote && selector[index - 1] !== "\\") quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "[") {
      squareDepth += 1;
    } else if (character === "]") {
      squareDepth -= 1;
    } else if (character === "(") {
      roundDepth += 1;
    } else if (character === ")") {
      roundDepth -= 1;
    } else if (character === "," && squareDepth === 0 && roundDepth === 0) {
      parts.push(selector.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(selector.slice(start).trim());
  return parts.filter(Boolean);
}

function splitDescendantSelector(selector) {
  const parts = [];
  let start = 0;
  let squareDepth = 0;
  let roundDepth = 0;
  let quote = "";
  for (let index = 0; index < selector.length; index += 1) {
    const character = selector[index];
    if (quote) {
      if (character === quote && selector[index - 1] !== "\\") quote = "";
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === "[") squareDepth += 1;
    else if (character === "]") squareDepth -= 1;
    else if (character === "(") roundDepth += 1;
    else if (character === ")") roundDepth -= 1;
    else if (/\s/.test(character) && squareDepth === 0 && roundDepth === 0) {
      if (index > start) parts.push(selector.slice(start, index).trim());
      while (/\s/.test(selector[index + 1] || "")) index += 1;
      start = index + 1;
    }
  }
  if (start < selector.length) parts.push(selector.slice(start).trim());
  return parts.filter((part) => part && part !== ">");
}

function dataAttributeKey(name) {
  return name
    .slice(5)
    .replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

class CcuFixtureNode {
  static ELEMENT_NODE = 1;

  constructor(nodeType, ownerDocument) {
    this.nodeType = nodeType;
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this._listeners = new Map();
  }

  get parentElement() {
    return this.parentNode instanceof CcuFixtureElement ? this.parentNode : null;
  }

  addEventListener(type, listener) {
    if (typeof listener !== "function") return;
    const listeners = this._listeners.get(type) || new Set();
    listeners.add(listener);
    this._listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this._listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event) {
    if (!event || typeof event.type !== "string") return true;
    if (!event.target) event.target = this;
    event.currentTarget = this;
    event.defaultPrevented = event.defaultPrevented === true;
    event.preventDefault ||= function preventDefault() {
      this.defaultPrevented = true;
    };
    event.stopPropagation ||= function stopPropagation() {};
    event.composedPath ||= () => {
      const path = [];
      for (let node = event.target; node; node = node.parentNode) path.push(node);
      return path;
    };
    for (const listener of this._listeners.get(event.type) || []) listener.call(this, event);
    return !event.defaultPrevented;
  }
}

class CcuFixtureText extends CcuFixtureNode {
  constructor(text, ownerDocument) {
    super(3, ownerDocument);
    this.textContent = String(text);
  }
}

function matchesCompound(element, rawSelector) {
  let selector = rawSelector.trim();
  for (const match of selector.matchAll(/:not\(([^()]*)\)/g)) {
    if (matchesFixtureSelector(element, match[1])) return false;
  }
  selector = selector.replace(/:not\([^()]*\)/g, "");

  const tag = /^([a-z][a-z0-9-]*|\*)/i.exec(selector)?.[1];
  if (tag && tag !== "*" && element.localName !== tag.toLowerCase()) return false;
  for (const match of selector.matchAll(/#([a-z0-9_-]+)/gi)) {
    if (element.id !== match[1]) return false;
  }
  for (const match of selector.matchAll(/\.([a-z0-9_-]+)/gi)) {
    if (!element.classList.contains(match[1])) return false;
  }
  for (const match of selector.matchAll(
    /\[([^\]\s~|^$*!=]+)\s*(?:(\*=|\^=|\$=|=)\s*(["']?)(.*?)\3)?\]/g
  )) {
    const [, name, operator, , expected = ""] = match;
    if (!element.hasAttribute(name)) return false;
    const actual = element.getAttribute(name) || "";
    if (operator === "=" && actual !== expected) return false;
    if (operator === "*=" && !actual.includes(expected)) return false;
    if (operator === "^=" && !actual.startsWith(expected)) return false;
    if (operator === "$=" && !actual.endsWith(expected)) return false;
  }
  return true;
}

function matchesComplexSelector(element, selector) {
  const compounds = splitDescendantSelector(selector);
  if (compounds.length === 0 || !matchesCompound(element, compounds.at(-1))) {
    return false;
  }
  let ancestor = element.parentElement;
  for (let index = compounds.length - 2; index >= 0; index -= 1) {
    while (ancestor && !matchesCompound(ancestor, compounds[index])) {
      ancestor = ancestor.parentElement;
    }
    if (!ancestor) return false;
    ancestor = ancestor.parentElement;
  }
  return true;
}

function matchesFixtureSelector(element, selector) {
  return splitSelectorList(String(selector)).some((part) =>
    matchesComplexSelector(element, part)
  );
}

class CcuFixtureElement extends CcuFixtureNode {
  constructor(localName, ownerDocument) {
    super(1, ownerDocument);
    this.localName = String(localName).toLowerCase();
    this.tagName = this.localName.toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this.className = "";
    this.id = "";
    this._textContent = "";
    this.clientWidth = 320;
    this.clientHeight = 180;
    this._fixtureRect = null;
    this.style = {
      setProperty(name, value) { this[name] = String(value); },
      removeProperty(name) { delete this[name]; }
    };
    this.classList = {
      contains: (name) => this.className.split(/\s+/).filter(Boolean).includes(name),
      add: (...names) => {
        const values = new Set(this.className.split(/\s+/).filter(Boolean));
        names.forEach((name) => values.add(name));
        this.className = Array.from(values).join(" ");
      },
      remove: (...names) => {
        const removed = new Set(names);
        this.className = this.className
          .split(/\s+/)
          .filter((name) => name && !removed.has(name))
          .join(" ");
      },
      toggle: (name, force) => {
        const present = this.classList.contains(name);
        const wanted = force === undefined ? !present : Boolean(force);
        if (wanted) this.classList.add(name);
        else this.classList.remove(name);
        return wanted;
      }
    };
  }

  get dataset() {
    return new Proxy({}, {
      get: (_target, key) => this.getAttribute(
        `data-${String(key).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`
      ),
      set: (_target, key, value) => {
        this.setAttribute(
          `data-${String(key).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
          value
        );
        return true;
      }
    });
  }

  get textContent() {
    return this._textContent || this.children.map((child) => child.textContent || "").join("");
  }

  set textContent(value) {
    this._textContent = String(value ?? "");
  }

  get isConnected() {
    let node = this;
    while (node?.parentNode) node = node.parentNode;
    return node === this.ownerDocument;
  }

  get nextElementSibling() {
    const siblings = this.parentElement?.children || [];
    const index = siblings.indexOf(this);
    return index >= 0 ? siblings[index + 1] || null : null;
  }

  get previousElementSibling() {
    const siblings = this.parentElement?.children || [];
    const index = siblings.indexOf(this);
    return index > 0 ? siblings[index - 1] : null;
  }

  setAttribute(name, value) {
    const normalized = String(name).toLowerCase();
    const stringValue = String(value);
    if (normalized === "class") this.className = stringValue;
    else if (normalized === "id") this.id = stringValue;
    else this.attributes.set(normalized, stringValue);
  }

  getAttribute(name) {
    const normalized = String(name).toLowerCase();
    if (normalized === "class") return this.className || null;
    if (normalized === "id") return this.id || null;
    return this.attributes.has(normalized) ? this.attributes.get(normalized) : null;
  }

  hasAttribute(name) {
    return this.getAttribute(name) !== null;
  }

  removeAttribute(name) {
    const normalized = String(name).toLowerCase();
    if (normalized === "class") this.className = "";
    else if (normalized === "id") this.id = "";
    else this.attributes.delete(normalized);
  }

  append(...nodes) {
    for (let node of nodes) {
      if (!(node instanceof CcuFixtureNode)) {
        node = this.ownerDocument.createTextNode(String(node));
      }
      node.parentNode?.removeChild?.(node);
      node.parentNode = this;
      this.children.push(node);
    }
  }

  appendChild(node) {
    this.append(node);
    return node;
  }

  prepend(...nodes) {
    const normalized = nodes.map((node) =>
      node instanceof CcuFixtureNode ? node : this.ownerDocument.createTextNode(String(node))
    );
    for (const node of normalized) node.parentNode?.removeChild?.(node);
    for (const node of normalized) node.parentNode = this;
    this.children.unshift(...normalized);
  }

  replaceChildren(...nodes) {
    for (const child of this.children) child.parentNode = null;
    this.children.length = 0;
    this._textContent = "";
    this.append(...nodes);
  }

  removeChild(node) {
    const index = this.children.indexOf(node);
    if (index >= 0) this.children.splice(index, 1);
    node.parentNode = null;
    return node;
  }

  remove() {
    this.parentElement?.removeChild(this);
  }

  toggleAttribute(name, force) {
    const wanted = force === undefined ? !this.hasAttribute(name) : Boolean(force);
    if (wanted) this.setAttribute(name, "");
    else this.removeAttribute(name);
    return wanted;
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  blur() {
    if (this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = null;
  }

  setFixtureRect(rect = {}) {
    const left = Number(rect.left ?? rect.x ?? 0);
    const top = Number(rect.top ?? rect.y ?? 0);
    const width = Number(rect.width ??
      (Number.isFinite(rect.right) ? Number(rect.right) - left : this.clientWidth));
    const height = Number(rect.height ??
      (Number.isFinite(rect.bottom) ? Number(rect.bottom) - top : this.clientHeight));
    this.clientWidth = width;
    this.clientHeight = height;
    this._fixtureRect = {
      x: left,
      y: top,
      top,
      left,
      right: Number(rect.right ?? left + width),
      bottom: Number(rect.bottom ?? top + height),
      width,
      height
    };
    return this;
  }

  get offsetWidth() {
    return this.clientWidth;
  }

  get offsetHeight() {
    return this.clientHeight;
  }

  getBoundingClientRect() {
    if (this._fixtureRect) {
      return { ...this._fixtureRect };
    }
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: this.clientWidth,
      bottom: this.clientHeight,
      width: this.clientWidth,
      height: this.clientHeight
    };
  }

  contains(candidate) {
    for (let node = candidate; node; node = node.parentNode) {
      if (node === this) return true;
    }
    return false;
  }

  matches(selector) {
    return matchesFixtureSelector(this, selector);
  }

  closest(selector) {
    for (let node = this; node instanceof CcuFixtureElement; node = node.parentElement) {
      if (node.matches(selector)) return node;
    }
    return null;
  }

  querySelectorAll(selector) {
    const found = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (child instanceof CcuFixtureElement) {
          if (child.matches(selector)) found.push(child);
          visit(child);
        }
      }
    };
    visit(this);
    return found;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
}

class CcuFixtureDocument extends CcuFixtureNode {
  constructor() {
    super(9, null);
    this.ownerDocument = this;
    this.documentElement = new CcuFixtureElement("html", this);
    this.body = new CcuFixtureElement("body", this);
    this.documentElement.parentNode = this;
    this.documentElement.append(this.body);
    this.activeElement = null;
  }

  createElement(localName) {
    return new CcuFixtureElement(localName, this);
  }

  createElementNS(_namespace, localName) {
    return this.createElement(localName);
  }

  createTextNode(text) {
    return new CcuFixtureText(text, this);
  }

  querySelectorAll(selector) {
    const found = [];
    if (this.documentElement.matches(selector)) found.push(this.documentElement);
    return found.concat(this.documentElement.querySelectorAll(selector));
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  getElementById(id) {
    return this.querySelector(`#${id}`);
  }
}

function loadContentCcuFixture({
  IntlImplementation = Intl,
  viewportWidth = 1_280,
  viewportHeight = 720
} = {}) {
  const document = new CcuFixtureDocument();
  document.documentElement.clientWidth = viewportWidth;
  document.documentElement.clientHeight = viewportHeight;
  document.body.clientWidth = viewportWidth;
  document.body.clientHeight = viewportHeight;
  const calls = [];
  const timers = new Map();
  const animationFrames = new Map();
  let nextTimerId = 1;
  let nextAnimationFrameId = 1;
  const windowEvents = new CcuFixtureNode(0, document);
  const viewportEvents = new CcuFixtureNode(0, document);
  const chrome = {
    runtime: {
      lastError: null,
      sendMessage(message, callback) {
        const call = {
          message: structuredClone(message),
          reply(response) { callback?.(response); }
        };
        calls.push(call);
      }
    }
  };
  const hooks = { skipInitialize: true };
  const sandbox = {
    URL,
    URLSearchParams,
    Intl: IntlImplementation,
    console,
    chrome,
    document,
    Node: CcuFixtureNode,
    Element: CcuFixtureElement,
    HTMLElement: CcuFixtureElement,
    setTimeout(callback, delay = 0) {
      const timerId = nextTimerId++;
      timers.set(timerId, { callback, delay });
      return timerId;
    },
    clearTimeout(timerId) { timers.delete(timerId); },
    requestAnimationFrame(callback) {
      const frameId = nextAnimationFrameId++;
      animationFrames.set(frameId, callback);
      queueMicrotask(() => {
        const pending = animationFrames.get(frameId);
        if (!pending) return;
        animationFrames.delete(frameId);
        pending(Date.now());
      });
      return frameId;
    },
    cancelAnimationFrame(frameId) { animationFrames.delete(frameId); },
    queueMicrotask,
    structuredClone,
    __rslContentTestHooks: hooks,
    globalThis: null,
    window: null,
    location: new URL("https://www.roblox.com/home"),
    innerWidth: viewportWidth,
    innerHeight: viewportHeight,
    scrollX: 0,
    scrollY: 0,
    pageXOffset: 0,
    pageYOffset: 0,
    addEventListener: windowEvents.addEventListener.bind(windowEvents),
    removeEventListener: windowEvents.removeEventListener.bind(windowEvents),
    dispatchEvent: windowEvents.dispatchEvent.bind(windowEvents),
    getComputedStyle(element) { return element?.style || {}; },
    visualViewport: {
      width: viewportWidth,
      height: viewportHeight,
      offsetLeft: 0,
      offsetTop: 0,
      addEventListener: viewportEvents.addEventListener.bind(viewportEvents),
      removeEventListener: viewportEvents.removeEventListener.bind(viewportEvents),
      dispatchEvent: viewportEvents.dispatchEvent.bind(viewportEvents)
    }
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  vm.runInNewContext(contentSource, sandbox, { filename: "content.js" });
  return { calls, chrome, document, hooks, sandbox, timers, animationFrames };
}

function makeContentCcuCard(document, placeId, {
  wide = true,
  universeId = null
} = {}) {
  const root = document.createElement("div");
  root.className = wide ? "featured-game-container" : "game-card-container";
  const link = document.createElement("a");
  link.className = "game-card-link";
  link.setAttribute(
    "href",
    `/games/${placeId}/fixture${universeId ? `?universeId=${universeId}` : ""}`
  );
  const metadata = document.createElement("div");
  metadata.className = "wide-game-tile-metadata";
  root.append(link, metadata);
  document.body.append(root);
  return { root, link, metadata };
}

function appendExternalCount(card, text, {
  ariaLabel = "",
  title = "",
  includeIcon = false,
  labelClasses = "info-label playing-counts-label"
} = {}) {
  const info = card.root.ownerDocument.createElement("div");
  info.className = "game-card-info";
  let icon = null;
  if (includeIcon) {
    icon = card.root.ownerDocument.createElement("span");
    icon.className = "info-label icon-playing-counts-gray";
    info.append(icon);
  }
  const label = card.root.ownerDocument.createElement("span");
  label.className = labelClasses;
  label.textContent = text;
  if (ariaLabel) label.setAttribute("aria-label", ariaLabel);
  if (title) label.setAttribute("title", title);
  info.append(label);
  card.metadata.append(info);
  return { info, icon, label };
}

function makeContentCcuGraphCard(document, placeId, universeId, {
  external = true,
  wide = false
} = {}) {
  const root = document.createElement("div");
  root.className = wide ? "featured-game-container" : "game-card-container";
  const link = document.createElement("a");
  link.className = "game-card-link";
  link.setAttribute(
    "href",
    `/games/${placeId}/fixture?universeId=${universeId}`
  );
  const thumbnail = document.createElement("div");
  thumbnail.className = wide
    ? "featured-game-icon-container"
    : "game-card-thumb-container";
  const image = document.createElement("img");
  thumbnail.append(image);
  link.append(thumbnail);
  const metadata = document.createElement("div");
  metadata.className = wide ? "wide-game-tile-metadata" : "game-card-info";
  const label = document.createElement("span");
  label.className = "info-label playing-counts-label";
  label.textContent = "1.2K";
  if (!external) label.setAttribute("data-rsl-game-tile-ccu-value", "");
  metadata.append(label);
  root.append(link, metadata);
  document.body.append(root);
  return { root, link, thumbnail, image, metadata, label };
}

async function flushContentMicrotasks() {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
}

const commaDefaultIntl = {
  NumberFormat: class FixtureNumberFormat {
    constructor(locales, options = {}) {
      const locale = Array.isArray(locales) ? locales[0] : locales;
      this.asciiDecimal = typeof locale === "string" && /^en(?:-|$)/i.test(locale);
      this.options = options;
    }

    format(value) {
      if (this.options.notation !== "compact" || value < 1_000) {
        return String(value);
      }
      const units = [
        [1_000_000_000_000, "T"],
        [1_000_000_000, "B"],
        [1_000_000, "M"],
        [1_000, "K"]
      ];
      const [divisor, suffix] = units.find(([minimum]) => value >= minimum);
      const rounded = Math.round((value / divisor) * 10) / 10;
      const numeric = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
      return `${this.asciiDecimal ? numeric : numeric.replace(".", ",")}${suffix}`;
    }
  }
};

const germanDefaultIntl = {
  NumberFormat: class GermanDefaultNumberFormat {
    constructor(locales, options) {
      this.formatter = new Intl.NumberFormat(locales ?? "de-DE", options);
    }

    format(value) {
      return this.formatter.format(value);
    }
  },
  DateTimeFormat: class GermanDefaultDateTimeFormat {
    constructor(locales, options) {
      this.formatter = new Intl.DateTimeFormat(locales ?? "de-DE", options);
    }

    format(value) {
      return this.formatter.format(value);
    }

    formatToParts(value) {
      return this.formatter.formatToParts(value);
    }

    resolvedOptions() {
      return this.formatter.resolvedOptions();
    }
  }
};

function parseCompactAxisCount(rawValue) {
  const normalized = String(rawValue ?? "")
    .trim()
    .replace(/[\s\u00a0\u202f]/g, "")
    .toUpperCase();
  const match = /^(-?\d+(?:[.,]\d+)?)([KMBT]?)$/.exec(normalized);
  if (!match) return Number.NaN;
  const multipliers = { "": 1, K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
  return Number(match[1].replace(",", ".")) * multipliers[match[2]];
}

function assertSemanticGameCcuGraphAxes(overlay, messagePrefix) {
  const chart = overlay.querySelector(".rsl-game-ccu-graph__chart");
  const yAxis = overlay.querySelector(".rsl-game-ccu-graph__y-axis");
  const plot = overlay.querySelector(".rsl-game-ccu-graph__plot");
  const xAxis = overlay.querySelector(".rsl-game-ccu-graph__x-axis");
  assert.ok(chart && yAxis && plot && xAxis, `${messagePrefix}: chart regions must exist`);
  assert.equal(chart.contains(yAxis), true);
  assert.equal(chart.contains(plot), true);
  assert.equal(chart.contains(xAxis), true);

  const yTicks = yAxis.querySelectorAll(".rsl-game-ccu-graph__y-tick");
  assert.equal(yTicks.length, 5, `${messagePrefix}: exactly five Y ticks`);
  const yLabels = yTicks.map((tick) => tick.textContent.trim());
  const yValues = yLabels.map(parseCompactAxisCount);
  assert.equal(yValues.every(Number.isFinite), true, `${messagePrefix}: finite Y labels`);
  assert.equal(new Set(yLabels).size, 5, `${messagePrefix}: distinct Y labels`);
  assert.ok(
    yValues.every((value, index) => index === 0 || yValues[index - 1] > value),
    `${messagePrefix}: Y labels must descend from maximum to minimum`
  );

  const xTicks = xAxis.querySelectorAll(".rsl-game-ccu-graph__x-tick");
  assert.equal(xTicks.length, 3, `${messagePrefix}: exactly three X ticks`);
  assert.equal(
    xTicks.every((tick) => tick.localName === "time" && Boolean(tick.getAttribute("datetime"))),
    true,
    `${messagePrefix}: X ticks must be semantic dated time elements`
  );
  const xLabels = xTicks.map((tick) => tick.textContent.trim());
  assert.equal(new Set(xLabels).size, 3, `${messagePrefix}: distinct X labels`);
  assert.equal(xLabels.every((label) => label && !/NaN|Invalid/i.test(label)), true);
  return { chart, yLabels, yValues, yTicks, xLabels, xTicks };
}

async function runContentCcuBehaviorContracts() {
  for (const hookName of [
    "findExternalGameTileCcu",
    "syncGameTileCcu",
    "mountGameTileCcu",
    "flushGameTileCcuRequests",
    "invalidateStaleGameTileCcuControls",
    "cleanupGameTileCcuFeature",
    "getGameTileCcuStateForTests"
  ]) {
    const fixture = loadContentCcuFixture();
    assert.equal(typeof fixture.hooks[hookName], "function", `${hookName} must be testable`);
  }

  {
    const fixture = loadContentCcuFixture();
    fixture.hooks.setFeatureSettingsForTests({
      version: 1,
      flags: {
        quickPlay: false,
        gameCcu: false,
        gameCcuHoverGraph: true
      }
    });
    const nativeRecentlyPlayed = makeContentCcuGraphCard(
      fixture.document,
      "699",
      "9699",
      { external: true, wide: false }
    );
    nativeRecentlyPlayed.root.setAttribute("data-testid", "game-tile");
    nativeRecentlyPlayed.label.textContent = "3.7K";

    fixture.hooks.mountGameTileCcuGraphTriggers();
    assert.equal(
      nativeRecentlyPlayed.label.hasAttribute("data-rsl-game-ccu-graph-trigger"),
      true,
      "graph-only mode must bind Roblox's native Recently Played CCU"
    );
    assert.equal(
      nativeRecentlyPlayed.root.querySelector("[data-rsl-game-tile-ccu]"),
      null,
      "graph-only mode must not add a RoTool player-count container"
    );
    assert.equal(
      nativeRecentlyPlayed.root.querySelector("[data-rsl-game-tile-ccu-value]"),
      null,
      "graph-only mode must not add a second CCU value"
    );

    const overlay = fixture.hooks.openGameTileCcuGraph(nativeRecentlyPlayed.label);
    assert.ok(overlay, "the native CCU trigger must open the graph");
    assert.equal(fixture.calls.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(fixture.calls[0].message)), {
      type: "rsl:get-game-ccu-history",
      requestId: 1,
      universeId: "9699"
    });
    const currentBucket = Math.floor(Date.now() / (5 * 60_000)) * (5 * 60_000);
    fixture.calls[0].reply({
      ok: true,
      requestId: 1,
      universeId: "9699",
      tracked: true,
      points: [
        { timestamp: currentBucket - 5 * 60_000, playing: 3_650 },
        { timestamp: currentBucket, playing: 3_700 }
      ]
    });
    await flushContentMicrotasks();
    assert.ok(
      overlay.querySelector(".rsl-game-ccu-graph__chart"),
      "graph-only mode must render returned history"
    );

    fixture.hooks.cleanupGameTileCcuFeature();
    assert.equal(nativeRecentlyPlayed.label.isConnected, true);
    assert.equal(nativeRecentlyPlayed.label.textContent, "3.7K");
    assert.equal(
      nativeRecentlyPlayed.label.hasAttribute("data-rsl-game-ccu-graph-trigger"),
      true,
      "Player Counts cleanup must leave the graph trigger intact"
    );
    assert.equal(
      fixture.document.querySelector("[data-rsl-game-ccu-graph-overlay]"),
      overlay,
      "Player Counts cleanup must not close the independent graph"
    );

    fixture.hooks.setFeatureSettingsForTests({
      version: 1,
      flags: {
        quickPlay: false,
        gameCcu: false,
        gameCcuHoverGraph: false
      }
    });
    fixture.hooks.mountGameTileCcuGraphTriggers();
    assert.equal(nativeRecentlyPlayed.label.isConnected, true);
    assert.equal(nativeRecentlyPlayed.label.textContent, "3.7K");
    assert.equal(
      nativeRecentlyPlayed.label.hasAttribute("data-rsl-game-ccu-graph-trigger"),
      false,
      "disabling the graph must remove only RoTool's trigger marker"
    );
    assert.equal(
      fixture.document.querySelector("[data-rsl-game-ccu-graph-overlay]"),
      null,
      "disabling the graph must close its overlay"
    );
    assert.equal(fixture.calls.length, 1, "disabled graphs must send no new request");
  }

  {
    const fixture = loadContentCcuFixture();
    fixture.hooks.setFeatureSettingsForTests({
      version: 1,
      flags: { gameCcu: false, gameCcuHoverGraph: true }
    });
    const placeOnly = makeContentCcuGraphCard(
      fixture.document,
      "698",
      "unused",
      { external: true, wide: false }
    );
    placeOnly.link.setAttribute("href", "/games/698/recently-played");
    placeOnly.label.textContent = "842";
    const ratingLookalike = makeContentCcuGraphCard(
      fixture.document,
      "697",
      "9697",
      { external: true, wide: false }
    );
    ratingLookalike.label.textContent = "95%";
    ratingLookalike.label.setAttribute("aria-label", "95% Rating");

    fixture.hooks.mountGameTileCcuGraphTriggers();
    assert.equal(
      placeOnly.label.hasAttribute("data-rsl-game-ccu-graph-trigger"),
      true,
      "a native place-only Recently Played count must be graphable"
    );
    assert.equal(
      ratingLookalike.label.hasAttribute("data-rsl-game-ccu-graph-trigger"),
      false,
      "rating percentages must never be mistaken for CCU graph triggers"
    );

    const overlay = fixture.hooks.openGameTileCcuGraph(placeOnly.label);
    assert.ok(overlay);
    assert.deepEqual(JSON.parse(JSON.stringify(fixture.calls[0].message)), {
      type: "rsl:get-game-ccu-history",
      requestId: 1,
      placeId: "698"
    });
    const currentBucket = Math.floor(Date.now() / (5 * 60_000)) * (5 * 60_000);
    fixture.calls[0].reply({
      ok: true,
      requestId: 1,
      placeId: "698",
      universeId: "5698",
      tracked: true,
      points: [
        { timestamp: currentBucket - 5 * 60_000, playing: 820 },
        { timestamp: currentBucket, playing: 842 }
      ]
    });
    await flushContentMicrotasks();
    assert.equal(
      fixture.hooks.getGameTileCcuGraphStateForTests().universeId,
      "5698",
      "the resolved universe must become the active graph identity"
    );
    assert.equal(overlay.id, "rsl-game-ccu-graph-5698");
    assert.equal(overlay.getAttribute("data-state"), "ready");
    assert.ok(overlay.querySelector(".rsl-game-ccu-graph__chart"));
    assert.equal(
      placeOnly.root.querySelector("[data-rsl-game-tile-ccu-value]"),
      null,
      "place resolution for the graph must not add RoTool's count"
    );
    fixture.hooks.cleanupGameTileCcuGraphDisplay();
  }

  {
    const fixture = loadContentCcuFixture();
    fixture.hooks.setFeatureSettingsForTests({
      version: 1,
      flags: { quickPlay: false, gameCcu: true }
    });
    const eligible = makeContentCcuCard(fixture.document, "101");
    const compact = makeContentCcuCard(fixture.document, "102", { wide: false });
    const vote = fixture.document.createElement("span");
    vote.className = "info-label vote-percentage-label";
    vote.textContent = "66%";
    const placeholder = appendExternalCount(eligible, "", { includeIcon: true });
    placeholder.info.children.unshift(vote);
    vote.parentNode = placeholder.info;

    fixture.hooks.mountGameTileCcu();
    assert.equal(fixture.calls.length, 1, "Quick Play disabled must not disable Player Counts");
    assert.deepEqual(
      fixture.calls[0].message.games.map((game) => game.placeId),
      ["101"],
      "wide cards with only an empty placeholder must load, while compact cards stay untouched"
    );
    assert.equal(compact.root.querySelector("[data-rsl-game-tile-ccu]"), null);
    fixture.hooks.cleanupGameTileCcuFeature();
  }

  {
    const fixture = loadContentCcuFixture({
      IntlImplementation: commaDefaultIntl
    });
    const card = makeContentCcuCard(fixture.document, "150");
    for (const [playing, expected] of [
      [5_300, "5.3K"],
      [4_700, "4.7K"],
      [1_700, "1.7K"],
      [999, "999"],
      [0, "0"]
    ]) {
      assert.equal(fixture.hooks.syncGameTileCcu(card.root, "150", playing, null), true);
      assert.equal(
        card.root.querySelector("[data-rsl-game-tile-ccu-value]")?.textContent,
        expected,
        `${playing} must use stable ASCII compact formatting under a comma-decimal browser locale`
      );
    }
    fixture.hooks.cleanupGameTileCcuFeature();
  }

  {
    const fixture = loadContentCcuFixture();
    const fallbackCard = makeContentCcuCard(fixture.document, "175");
    const thumbnail = fixture.document.createElement("div");
    thumbnail.className = "featured-game-icon-container";
    const details = fixture.document.createElement("div");
    details.className = "info-metadata-container";
    const title = fixture.document.createElement("div");
    title.className = "game-card-name";
    title.textContent = "Full-width title";
    const description = fixture.document.createElement("div");
    description.className = "game-card-description";
    description.textContent = "Full-width description remains its own line";
    details.append(title, description);
    fallbackCard.link.append(thumbnail, details);

    assert.equal(
      fixture.hooks.syncGameTileCcu(fallbackCard.root, "175", 5_300, null),
      true
    );
    const fallback = fallbackCard.root.querySelector(
      "[data-rsl-game-tile-ccu-container]"
    );
    assert.ok(fallback);
    assert.equal(fallback.parentElement, details);
    assert.equal(fallback.classList.contains("rsl-game-tile-ccu-metadata--corner"), true);
    assert.equal(details.previousElementSibling, thumbnail);
    assert.deepEqual(details.children.slice(0, 2), [title, description]);
    assert.equal(title.textContent, "Full-width title");
    assert.equal(description.textContent, "Full-width description remains its own line");
    assert.equal(title.contains(fallback), false);
    assert.equal(description.contains(fallback), false);

    fixture.hooks.cleanupGameTileCcuFeature();
  }

  {
    // Regression fixture copied from Roblox's current editorial carousel DOM:
    // thumbnail -> info-container -> info-metadata-container -> title +
    // wide-game-tile-metadata/base-metadata/stats footer. The stats footer's
    // first label is editorial description copy, not a suitable CCU host.
    const fixture = loadContentCcuFixture({
      IntlImplementation: commaDefaultIntl
    });
    const card = makeContentCcuCard(fixture.document, "9756976552", {
      universeId: "3615728730"
    });
    const thumbnail = fixture.document.createElement("div");
    thumbnail.className = "featured-game-icon-container";
    const infoContainer = fixture.document.createElement("div");
    infoContainer.className = "info-container";
    const details = fixture.document.createElement("div");
    details.className = "info-metadata-container";
    const title = fixture.document.createElement("div");
    title.className = "game-card-name game-name-title";
    title.setAttribute("data-testid", "game-tile-game-title");
    title.textContent = "Derelict";
    const baseMetadata = fixture.document.createElement("div");
    baseMetadata.className = "base-metadata";
    const statsFooter = fixture.document.createElement("div");
    statsFooter.className = "game-card-info";
    statsFooter.setAttribute("data-testid", "game-tile-stats-text-footer");
    const description = fixture.document.createElement("span");
    description.className = "info-label";
    description.textContent = "Carve your path through a fractured world";
    statsFooter.append(description);
    baseMetadata.append(statsFooter);
    card.metadata.append(baseMetadata);
    details.append(title, card.metadata);
    infoContainer.append(details);
    card.link.append(thumbnail, infoContainer);

    assert.equal(
      fixture.hooks.syncGameTileCcu(card.root, "9756976552", 5_358, "3615728730"),
      true
    );
    const value = card.root.querySelector("[data-rsl-game-tile-ccu-value]");
    const corner = card.root.querySelector("[data-rsl-game-tile-ccu-container]");
    assert.equal(
      value?.textContent,
      "5.4K",
      "the attached editorial-card DOM must use an ASCII decimal point"
    );
    assert.ok(corner, "editorial cards need a dedicated owned CCU container");
    assert.equal(
      corner.parentElement,
      details,
      "CCU must sit in the metadata area immediately beneath the thumbnail"
    );
    assert.equal(
      corner.classList.contains("rsl-game-tile-ccu-metadata--corner"),
      true,
      "CCU must use the top-right corner slot opposite the title"
    );
    assert.equal(details.closest(".info-container")?.previousElementSibling, thumbnail);
    assert.equal(title.previousElementSibling, null, "the title must stay the first metadata row");
    assert.equal(title.nextElementSibling, card.metadata, "the description row must stay below the title");
    assert.equal(
      statsFooter.children.length,
      1,
      "CCU must not be appended to the editorial description footer"
    );
    assert.equal(statsFooter.children[0], description);
    assert.equal(description.textContent, "Carve your path through a fractured world");
    assert.equal(description.contains(corner), false);
    assert.equal(statsFooter.contains(value), false);
    fixture.hooks.cleanupGameTileCcuFeature();
  }

  {
    // MM2-like wide tiles use their second row for an online-friends facepile
    // instead of description or stats text. They are also much narrower than
    // the editorial cards above. Rating/CCU therefore need their own measured
    // title-row cell; putting them in the facepile or reserving a fixed corner
    // width either corrupts that row or needlessly truncates the game name.
    const fixture = loadContentCcuFixture({
      IntlImplementation: commaDefaultIntl
    });
    const card = makeContentCcuCard(fixture.document, "142823291", {
      universeId: "66654135"
    });
    const thumbnail = fixture.document.createElement("div");
    thumbnail.className = "featured-game-icon-container";
    const infoContainer = fixture.document.createElement("div");
    infoContainer.className = "info-container";
    const details = fixture.document.createElement("div");
    details.className = "info-metadata-container";
    const title = fixture.document.createElement("div");
    title.className = "game-card-name game-name-title";
    title.setAttribute("data-testid", "game-tile-game-title");
    title.setAttribute("title", "Murder Mystery 2");
    title.textContent = "Murder Mystery 2";
    const baseMetadata = fixture.document.createElement("div");
    baseMetadata.className = "base-metadata";
    const friendsFooter = fixture.document.createElement("div");
    friendsFooter.className = "game-card-info";
    friendsFooter.setAttribute(
      "data-testid",
      "game-tile-stats-online-friends-facepile"
    );
    const facepile = fixture.document.createElement("div");
    facepile.className = "info-avatar";
    const avatar = fixture.document.createElement("div");
    avatar.className = "avatar-card avatar-card-online";
    facepile.append(avatar);
    const friendNames = fixture.document.createElement("span");
    friendNames.className = "info-label";
    friendNames.textContent = "Thr3eSixty";
    friendsFooter.append(facepile, friendNames);
    baseMetadata.append(friendsFooter);
    card.metadata.append(baseMetadata);
    details.append(title, card.metadata);
    infoContainer.append(details);
    card.link.append(thumbnail, infoContainer);

    assert.equal(
      fixture.hooks.syncGameTileCcu(
        card.root,
        "142823291",
        837_700,
        "66654135",
        91
      ),
      true
    );
    const corner = card.root.querySelector("[data-rsl-game-tile-ccu-container]");
    const ratingValue = card.root.querySelector("[data-rsl-game-tile-rating-value]");
    const ccuValue = card.root.querySelector("[data-rsl-game-tile-ccu-value]");
    assert.ok(corner && ratingValue && ccuValue);
    assert.equal(ratingValue.textContent, "91%");
    assert.equal(ccuValue.textContent, "837.7K");
    assert.equal(
      corner.parentElement,
      details,
      "MM2 metrics must be anchored to the same title-row host as its game name"
    );
    assert.equal(
      corner.classList.contains("rsl-game-tile-ccu-metadata--corner"),
      true
    );
    assert.deepEqual(
      Array.from(details.children),
      [title, card.metadata, corner],
      "DOM order must remain title, native second-row metadata, then the owned grid cell"
    );
    assert.equal(title.textContent, "Murder Mystery 2");
    assert.equal(title.contains(corner), false, "metrics must not become part of ellipsized title text");
    assert.equal(title.nextElementSibling, card.metadata);
    assert.deepEqual(
      Array.from(friendsFooter.children),
      [facepile, friendNames],
      "the online-friends facepile row must remain byte-for-byte structurally untouched"
    );
    assert.equal(friendsFooter.contains(ratingValue), false);
    assert.equal(friendsFooter.contains(ccuValue), false);
    assert.equal(corner.contains(ratingValue), true);
    assert.equal(corner.contains(ccuValue), true);
    fixture.hooks.cleanupGameTileCcuFeature();
  }

  {
    // Roblox's sponsored wide footer includes the visible text "91% Rating".
    // Keep the Ad disclosure and native vote icon, but normalize the percentage
    // to the same compact metadata shape as ordinary tiles before adding CCU.
    const fixture = loadContentCcuFixture({
      IntlImplementation: commaDefaultIntl
    });
    const card = makeContentCcuCard(fixture.document, "15532962292", {
      universeId: "5361032378"
    });
    const details = fixture.document.createElement("div");
    details.className = "info-metadata-container";
    const title = fixture.document.createElement("div");
    title.className = "game-card-name game-name-title";
    title.textContent = "Sol's RNG";
    const baseMetadata = fixture.document.createElement("div");
    baseMetadata.className = "base-metadata";
    const sponsoredFooter = fixture.document.createElement("div");
    sponsoredFooter.className = "game-card-info sponsored-footer show-secondary";
    sponsoredFooter.setAttribute("data-testid", "wide-game-tile-sponsored-footer");
    const ad = fixture.document.createElement("span");
    ad.className = "info-label sponsored-ad-label";
    ad.textContent = "Ad";
    const bullet = fixture.document.createElement("span");
    bullet.className = "bullet secondary-content info-label";
    bullet.textContent = "•";
    const secondary = fixture.document.createElement("span");
    secondary.className = "secondary-content";
    const voteIcon = fixture.document.createElement("span");
    voteIcon.className = "info-label icon-votes-gray";
    const voteValue = fixture.document.createElement("span");
    voteValue.className = "info-label vote-percentage-label";
    voteValue.textContent = "91% Rating";
    voteValue.setAttribute("aria-label", "91% Rating");
    voteValue.setAttribute("title", "91% Rating");
    secondary.append(voteIcon, voteValue);
    const sizingClone = fixture.document.createElement("div");
    sizingClone.className = "game-card-info sponsored-footer show-secondary";
    sizingClone.setAttribute("aria-hidden", "true");
    const cloneVoteValue = fixture.document.createElement("span");
    cloneVoteValue.className = "info-label vote-percentage-label";
    cloneVoteValue.textContent = "91% Rating";
    sizingClone.append(cloneVoteValue);
    sponsoredFooter.append(ad, bullet, secondary, sizingClone);
    baseMetadata.append(sponsoredFooter);
    card.metadata.append(baseMetadata);
    details.append(title, card.metadata);
    card.link.append(details);

    assert.equal(
      fixture.hooks.syncGameTileCcu(
        card.root,
        "15532962292",
        48_861,
        "5361032378",
        91
      ),
      true
    );
    assert.equal(ad.textContent, "Ad", "the sponsored disclosure must never be removed");
    assert.equal(voteIcon.parentElement, secondary, "the native vote icon must be retained");
    assert.equal(voteValue.textContent, "91%", "visible ads must omit the redundant Rating word");
    assert.equal(
      voteValue.getAttribute("aria-label"),
      "91% Rating",
      "visible compaction must preserve Roblox's descriptive accessible label"
    );
    assert.equal(
      voteValue.getAttribute("title"),
      "91% Rating",
      "visible compaction must preserve Roblox's descriptive tooltip"
    );
    assert.equal(
      cloneVoteValue.textContent,
      "91%",
      "the hidden responsive sizing clone must use the same compact rating text"
    );
    assert.equal(
      card.root.querySelectorAll(".vote-percentage-label").some((node) =>
        /\bRating\b/i.test(node.textContent)
      ),
      false,
      "no sponsored vote label may retain the literal Rating suffix"
    );
    const ccuIcon = card.root.querySelector("[data-rsl-game-tile-ccu-icon]");
    const ccuValue = card.root.querySelector("[data-rsl-game-tile-ccu-value]");
    assert.ok(ccuIcon && ccuValue, "the ad must still receive the playing metric");
    assert.equal(ad.parentElement, sponsoredFooter);
    assert.equal(bullet.parentElement, sponsoredFooter);
    assert.equal(ad.nextElementSibling, bullet, "the Ad/bullet disclosure order must be preserved");
    assert.equal(
      bullet.nextElementSibling,
      secondary,
      "the visible sponsored metric group must remain immediately after Ad and its bullet"
    );
    assert.equal(
      ccuIcon.parentElement,
      secondary,
      "sponsored CCU must use the same visible native metric group as rating"
    );
    assert.equal(ccuValue.parentElement, secondary);
    assert.deepEqual(
      Array.from(secondary.children),
      [voteIcon, voteValue, ccuIcon, ccuValue],
      "an ad must expose the same adjacent rating/CCU leaf order as a normal stats row"
    );
    [voteIcon, voteValue, ccuIcon, ccuValue].forEach((leaf) => {
      assert.equal(
        leaf.classList.contains("info-label"),
        true,
        "sponsored metric spacing must continue to come from Roblox's native info-label leaves"
      );
    });
    assert.equal(ccuValue.previousElementSibling, ccuIcon, "CCU must remain an adjacent icon/value pair");
    assert.equal(
      card.root.querySelectorAll("[data-rsl-game-tile-ccu-value]").length,
      1,
      "normalizing an ad footer must not duplicate CCU"
    );
    fixture.hooks.cleanupGameTileCcuFeature();
    assert.equal(
      voteValue.textContent,
      "91% Rating",
      "feature cleanup must restore Roblox's original sponsored rating text"
    );
    assert.equal(voteValue.getAttribute("aria-label"), "91% Rating");
    assert.equal(voteValue.getAttribute("title"), "91% Rating");
    assert.equal(
      cloneVoteValue.textContent,
      "91% Rating",
      "cleanup must also restore Roblox's hidden responsive sizing clone"
    );
    assert.equal(
      voteValue.hasAttribute("data-rsl-sponsored-rating-original-text"),
      false,
      "cleanup must remove RoTool's reversible-normalization bookkeeping"
    );
  }

  {
    // Compact sponsored cards are intentionally outside the wide-card CCU
    // scan, but their native rating copy still needs the same reversible
    // normalization. React may then recycle the label with a newer rating.
    const fixture = loadContentCcuFixture();
    fixture.hooks.setFeatureSettingsForTests({
      version: 1,
      flags: { quickPlay: false, gameCcu: true }
    });
    const card = makeContentCcuCard(fixture.document, "5041144419", {
      wide: false,
      universeId: "1831293518"
    });
    const sponsoredFooter = fixture.document.createElement("div");
    sponsoredFooter.className = "game-card-info sponsored-footer show-secondary";
    sponsoredFooter.setAttribute("data-testid", "game-tile-sponsored-footer");
    const ad = fixture.document.createElement("span");
    ad.className = "info-label sponsored-ad-label";
    ad.textContent = "Ad";
    const secondary = fixture.document.createElement("span");
    secondary.className = "secondary-content";
    const voteIcon = fixture.document.createElement("span");
    voteIcon.className = "info-label icon-votes-gray";
    const voteValue = fixture.document.createElement("span");
    voteValue.className = "info-label vote-percentage-label";
    voteValue.textContent = "89% Rating";
    voteValue.setAttribute("aria-label", "89% Rating");
    voteValue.setAttribute("title", "89% Rating");
    secondary.append(voteIcon, voteValue);
    const sizingClone = fixture.document.createElement("div");
    sizingClone.className = "game-card-info sponsored-footer show-secondary";
    sizingClone.setAttribute("aria-hidden", "true");
    const cloneVoteValue = fixture.document.createElement("span");
    cloneVoteValue.className = "info-label vote-percentage-label";
    cloneVoteValue.textContent = "89% Rating";
    sizingClone.append(cloneVoteValue);
    sponsoredFooter.append(ad, secondary, sizingClone);
    card.metadata.append(sponsoredFooter);

    fixture.hooks.mountGameTileCcu();
    assert.equal(
      fixture.calls.length,
      0,
      "normalizing a compact sponsored card must not request CCU"
    );
    assert.equal(voteValue.textContent, "89%");
    assert.equal(voteValue.getAttribute("aria-label"), "89% Rating");
    assert.equal(voteValue.getAttribute("title"), "89% Rating");
    assert.equal(cloneVoteValue.textContent, "89%");
    assert.equal(
      card.root.querySelector("[data-rsl-game-tile-ccu]"),
      null,
      "compact sponsored cards must remain outside CCU rendering"
    );

    // Model Roblox/React reusing both nodes for a newly fetched percentage.
    // Invalidation must capture this value as the new original, normalize it,
    // and later restore that current value rather than the stale 89% copy.
    voteValue.textContent = "90% Rating";
    voteValue.setAttribute("aria-label", "90% Rating");
    voteValue.setAttribute("title", "90% Rating");
    cloneVoteValue.textContent = "90% Rating";
    fixture.hooks.invalidateStaleGameTileCcuControls([
      {
        type: "childList",
        target: sponsoredFooter,
        addedNodes: [voteValue, cloneVoteValue]
      }
    ]);
    assert.equal(voteValue.textContent, "90%");
    assert.equal(voteValue.getAttribute("aria-label"), "90% Rating");
    assert.equal(voteValue.getAttribute("title"), "90% Rating");
    assert.equal(cloneVoteValue.textContent, "90%");
    assert.equal(
      fixture.calls.length,
      0,
      "compact sponsored mutations must not enter the CCU request queue"
    );

    fixture.hooks.cleanupGameTileCcuFeature();
    assert.equal(
      voteValue.textContent,
      "90% Rating",
      "cleanup must restore the latest React-authored compact rating"
    );
    assert.equal(voteValue.getAttribute("aria-label"), "90% Rating");
    assert.equal(voteValue.getAttribute("title"), "90% Rating");
    assert.equal(cloneVoteValue.textContent, "90% Rating");
    assert.equal(
      voteValue.hasAttribute("data-rsl-sponsored-rating-original-text"),
      false,
      "cleanup must remove compact-rating normalization bookkeeping"
    );
  }

  {
    // Editorial cards have description copy rather than stats in their native
    // footer. Rating and CCU belong together in a separate native-shaped
    // top-right metric slot; the description must remain untouched below it.
    const fixture = loadContentCcuFixture({
      IntlImplementation: commaDefaultIntl
    });
    const card = makeContentCcuCard(fixture.document, "9756976552", {
      universeId: "3615728730"
    });
    const thumbnail = fixture.document.createElement("div");
    thumbnail.className = "featured-game-icon-container";
    const infoContainer = fixture.document.createElement("div");
    infoContainer.className = "info-container";
    const details = fixture.document.createElement("div");
    details.className = "info-metadata-container";
    const title = fixture.document.createElement("div");
    title.className = "game-card-name game-name-title";
    title.textContent = "Derelict";
    const baseMetadata = fixture.document.createElement("div");
    baseMetadata.className = "base-metadata";
    const descriptionFooter = fixture.document.createElement("div");
    descriptionFooter.className = "game-card-info";
    descriptionFooter.setAttribute("data-testid", "game-tile-stats-text-footer");
    const description = fixture.document.createElement("span");
    description.className = "info-label";
    description.textContent = "Carve your path through a fractured world";
    descriptionFooter.append(description);
    baseMetadata.append(descriptionFooter);
    card.metadata.append(baseMetadata);
    details.append(title, card.metadata);
    infoContainer.append(details);
    card.link.append(thumbnail, infoContainer);

    assert.equal(
      fixture.hooks.syncGameTileCcu(
        card.root,
        "9756976552",
        5_358,
        "3615728730",
        87
      ),
      true
    );
    const ratingIcon = card.root.querySelector(".icon-votes-gray");
    const ratingValue = card.root.querySelector(".vote-percentage-label");
    const ccuIcon = card.root.querySelector("[data-rsl-game-tile-ccu-icon]");
    const ccuValue = card.root.querySelector("[data-rsl-game-tile-ccu-value]");
    assert.ok(ratingIcon && ratingValue, "editorial cards must receive a native-shaped rating");
    assert.equal(ratingValue.textContent, "87%");
    assert.ok(ccuIcon && ccuValue, "editorial cards must retain CCU beside the rating");
    assert.equal(ratingIcon.parentElement, ratingValue.parentElement);
    assert.equal(ratingValue.parentElement, ccuIcon.parentElement);
    assert.equal(ccuIcon.parentElement, ccuValue.parentElement);
    const corner = ccuValue.closest("[data-rsl-game-tile-ccu-container]");
    assert.ok(corner, "editorial metrics need one owned corner container");
    assert.equal(corner.parentElement, details, "the metrics slot must be directly below the thumbnail");
    assert.equal(
      corner.classList.contains("rsl-game-tile-ccu-metadata--corner"),
      true,
      "rating and CCU must use the requested top-right slot"
    );
    assert.equal(descriptionFooter.children.length, 1);
    assert.equal(descriptionFooter.children[0], description);
    assert.equal(description.textContent, "Carve your path through a fractured world");
    assert.equal(descriptionFooter.contains(ratingValue), false);
    assert.equal(descriptionFooter.contains(ccuValue), false);
    assert.equal(card.root.querySelectorAll(".vote-percentage-label").length, 1);
    assert.equal(card.root.querySelectorAll("[data-rsl-game-tile-ccu-value]").length, 1);
    fixture.hooks.cleanupGameTileCcuFeature();
  }

  {
    // Roblox/BTRoblox can render the redundant "Rating" suffix on ordinary
    // stats rows too, not only sponsored cards. Normalize every native rating
    // while leaving RoTool-owned labels alone, and retain the newest native
    // value when React reuses a label.
    const fixture = loadContentCcuFixture();
    fixture.hooks.setFeatureSettingsForTests({
      version: 1,
      flags: { quickPlay: false, gameCcu: true }
    });

    const card = makeContentCcuCard(fixture.document, "675", {
      universeId: "9675"
    });
    const stats = fixture.document.createElement("div");
    stats.className = "game-card-info";
    stats.setAttribute("data-testid", "game-tile-stats");
    const voteIcon = fixture.document.createElement("span");
    voteIcon.className = "info-label icon-votes-gray";
    const voteValue = fixture.document.createElement("span");
    voteValue.className = "info-label vote-percentage-label";
    voteValue.textContent = "91% Rating";
    voteValue.setAttribute("aria-label", "91% Rating");
    voteValue.setAttribute("title", "91% Rating");
    const playingIcon = fixture.document.createElement("span");
    playingIcon.className = "info-label icon-playing-counts-gray";
    const playingValue = fixture.document.createElement("span");
    playingValue.className = "info-label playing-counts-label";
    playingValue.textContent = "856.2K";
    const ownedRating = fixture.document.createElement("span");
    ownedRating.className = "info-label vote-percentage-label";
    ownedRating.setAttribute("data-rsl-game-tile-rating-value", "");
    ownedRating.textContent = "88% Rating";
    ownedRating.setAttribute("aria-label", "88% Rating");
    ownedRating.setAttribute("title", "88% Rating");
    const generatedAriaRating = fixture.document.createElement("span");
    generatedAriaRating.className = "info-label vote-percentage-label";
    generatedAriaRating.textContent = "91% Rating";
    const strictRatingCases = [
      ["0% Rating", "0%"],
      ["100% Rating", "100%"],
      ["91.5% Rating", "91.5%"],
      ["91,5% Rating", "91,5%"],
      ["Content Rating", "Content Rating"],
      ["36 hours", "36 hours"],
      ["101% Rating", "101% Rating"],
      ["-1% Rating", "-1% Rating"],
      ["Rated 91% Rating", "Rated 91% Rating"],
      ["91% Rating details", "91% Rating details"]
    ].map(([source, expected]) => {
      const label = fixture.document.createElement("span");
      label.className = "info-label vote-percentage-label";
      label.textContent = source;
      label.setAttribute("aria-label", source);
      label.setAttribute("title", source);
      return { label, source, expected };
    });
    stats.append(
      voteIcon,
      voteValue,
      playingIcon,
      playingValue,
      ownedRating,
      generatedAriaRating,
      ...strictRatingCases.map(({ label }) => label)
    );
    card.metadata.append(stats);

    const sponsoredCard = makeContentCcuCard(fixture.document, "676", {
      wide: false,
      universeId: "9676"
    });
    const sponsoredFooter = fixture.document.createElement("div");
    sponsoredFooter.className = "game-card-info sponsored-footer show-secondary";
    sponsoredFooter.setAttribute("data-testid", "game-tile-sponsored-footer");
    const ad = fixture.document.createElement("span");
    ad.className = "info-label sponsored-ad-label";
    ad.textContent = "Ad";
    const bullet = fixture.document.createElement("span");
    bullet.className = "bullet secondary-content info-label";
    bullet.textContent = "\u2022";
    const sponsoredSecondary = fixture.document.createElement("span");
    sponsoredSecondary.className = "secondary-content";
    const sponsoredVoteIcon = fixture.document.createElement("span");
    sponsoredVoteIcon.className = "info-label icon-votes-gray";
    const sponsoredVoteValue = fixture.document.createElement("span");
    sponsoredVoteValue.className = "info-label vote-percentage-label";
    sponsoredVoteValue.textContent = "93% Rating";
    sponsoredVoteValue.setAttribute("aria-label", "93% Rating");
    sponsoredVoteValue.setAttribute("title", "93% Rating");
    sponsoredSecondary.append(sponsoredVoteIcon, sponsoredVoteValue);
    sponsoredFooter.append(ad, bullet, sponsoredSecondary);
    sponsoredCard.metadata.append(sponsoredFooter);

    fixture.hooks.mountGameTileCcu();
    assert.equal(
      fixture.calls.length,
      0,
      "existing normal metrics and compact ads must not issue a CCU request"
    );
    assert.equal(voteValue.textContent, "91%");
    assert.equal(voteValue.getAttribute("aria-label"), "91% Rating");
    assert.equal(voteValue.getAttribute("title"), "91% Rating");
    assert.equal(
      `${ad.textContent} ${bullet.textContent} ${sponsoredVoteValue.textContent}`,
      "Ad • 93%",
      "sponsored disclosure and separator must remain while its rating uses compact copy"
    );
    assert.equal(sponsoredVoteValue.getAttribute("aria-label"), "93% Rating");
    assert.equal(sponsoredVoteValue.getAttribute("title"), "93% Rating");
    assert.equal(
      ownedRating.textContent,
      "88% Rating",
      "generic native normalization must exclude RoTool-owned rating labels"
    );
    assert.equal(ownedRating.getAttribute("aria-label"), "88% Rating");
    assert.equal(ownedRating.getAttribute("title"), "88% Rating");
    assert.equal(generatedAriaRating.textContent, "91%");
    assert.equal(
      generatedAriaRating.getAttribute("aria-label"),
      "91% Rating",
      "compacting a native label without accessible text must generate a descriptive aria-label"
    );
    assert.equal(generatedAriaRating.hasAttribute("title"), false);
    strictRatingCases.forEach(({ label, source, expected }) => {
      assert.equal(
        label.textContent,
        expected,
        `visible native rating normalization must strictly classify ${JSON.stringify(source)}`
      );
      assert.equal(
        label.getAttribute("aria-label"),
        source,
        "normalization must not rewrite descriptive aria-label text"
      );
      assert.equal(
        label.getAttribute("title"),
        source,
        "normalization must not rewrite descriptive title text"
      );
    });

    // Model React rewriting the already-normalized native label in place.
    // The mutation path must immediately compact the new value and remember
    // that latest source value for feature cleanup.
    voteValue.textContent = "92% Rating";
    voteValue.setAttribute("aria-label", "92% Rating");
    voteValue.setAttribute("title", "92% Rating");
    generatedAriaRating.textContent = "92% Rating";
    fixture.hooks.invalidateStaleGameTileCcuControls([
      {
        type: "childList",
        target: stats,
        addedNodes: [voteValue, generatedAriaRating]
      }
    ]);
    assert.equal(voteValue.textContent, "92%");
    assert.equal(voteValue.getAttribute("aria-label"), "92% Rating");
    assert.equal(voteValue.getAttribute("title"), "92% Rating");
    assert.equal(generatedAriaRating.textContent, "92%");
    assert.equal(
      generatedAriaRating.getAttribute("aria-label"),
      "92% Rating",
      "React reuse must update an aria-label generated from the previous native rating"
    );

    // Model an entire BTRoblox stats card arriving after the initial mount.
    // Mutation invalidation runs before the deferred extension remount, so it
    // must normalize this card on its own.
    const dynamicCard = makeContentCcuCard(fixture.document, "677", {
      universeId: "9677"
    });
    const dynamicStats = fixture.document.createElement("div");
    dynamicStats.className = "game-card-info";
    dynamicStats.setAttribute("data-testid", "game-tile-stats");
    const dynamicVote = fixture.document.createElement("span");
    dynamicVote.className = "info-label vote-percentage-label";
    dynamicVote.textContent = "84% Rating";
    dynamicVote.setAttribute("aria-label", "84% Rating");
    dynamicVote.setAttribute("title", "84% Rating");
    const dynamicPlaying = fixture.document.createElement("span");
    dynamicPlaying.className = "info-label playing-counts-label";
    dynamicPlaying.textContent = "4.9K";
    dynamicStats.append(dynamicVote, dynamicPlaying);
    dynamicCard.metadata.append(dynamicStats);
    fixture.hooks.invalidateStaleGameTileCcuControls([
      { type: "childList", target: fixture.document.body, addedNodes: [dynamicCard.root] }
    ]);
    assert.equal(dynamicVote.textContent, "84%");
    assert.equal(dynamicVote.getAttribute("aria-label"), "84% Rating");
    assert.equal(dynamicVote.getAttribute("title"), "84% Rating");

    fixture.hooks.cleanupGameTileCcuFeature();
    assert.equal(
      voteValue.textContent,
      "92% Rating",
      "cleanup must restore the latest React-authored normal rating"
    );
    assert.equal(voteValue.getAttribute("aria-label"), "92% Rating");
    assert.equal(voteValue.getAttribute("title"), "92% Rating");
    assert.equal(sponsoredVoteValue.textContent, "93% Rating");
    assert.equal(sponsoredVoteValue.getAttribute("aria-label"), "93% Rating");
    assert.equal(sponsoredVoteValue.getAttribute("title"), "93% Rating");
    assert.equal(dynamicVote.textContent, "84% Rating");
    assert.equal(dynamicVote.getAttribute("aria-label"), "84% Rating");
    assert.equal(dynamicVote.getAttribute("title"), "84% Rating");
    assert.equal(generatedAriaRating.textContent, "92% Rating");
    assert.equal(
      generatedAriaRating.hasAttribute("aria-label"),
      false,
      "cleanup must remove an extension-generated aria-label instead of leaving an empty attribute"
    );
    assert.equal(generatedAriaRating.hasAttribute("title"), false);
    strictRatingCases.forEach(({ label, source }) => {
      assert.equal(
        label.textContent,
        source,
        "cleanup must restore each exact native rating string it visibly normalized"
      );
      assert.equal(label.getAttribute("aria-label"), source);
      assert.equal(label.getAttribute("title"), source);
    });
    assert.equal(
      ownedRating.textContent,
      "88% Rating",
      "cleanup must not alter a label that normalization never owned"
    );
  }

  {
    // Roblox can mount the standard stats row before it fills either metric.
    // That row is already the native second line, so owned rating/CCU leaves
    // must fill it in place without turning the title host into a corner grid.
    const fixture = loadContentCcuFixture();
    const card = makeContentCcuCard(fixture.document, "680", {
      universeId: "9680"
    });
    const details = fixture.document.createElement("div");
    details.className = "info-metadata-container";
    const title = fixture.document.createElement("div");
    title.className = "game-card-name game-name-title";
    title.textContent = "Native row placeholder";
    const baseMetadata = fixture.document.createElement("div");
    baseMetadata.className = "base-metadata";
    const stats = fixture.document.createElement("div");
    stats.className = "game-card-info";
    stats.setAttribute("data-testid", "game-tile-stats");
    baseMetadata.append(stats);
    card.metadata.append(baseMetadata);
    details.append(title, card.metadata);
    card.link.append(details);

    const originalTitleClass = title.className;
    const originalTitleStyle = title.getAttribute("style");
    assert.equal(
      fixture.hooks.syncGameTileCcu(card.root, "680", 2_345, "9680", 88),
      true
    );
    const ratingIcon = stats.querySelector("[data-rsl-game-tile-rating-icon]");
    const ratingValue = stats.querySelector("[data-rsl-game-tile-rating-value]");
    const ccuIcon = stats.querySelector("[data-rsl-game-tile-ccu-icon]");
    const ccuValue = stats.querySelector("[data-rsl-game-tile-ccu-value]");
    assert.ok(ratingIcon && ratingValue && ccuIcon && ccuValue);
    assert.equal(ratingValue.textContent, "88%");
    assert.equal(ccuValue.textContent, "2.3K");
    assert.deepEqual(
      Array.from(stats.children),
      [ratingIcon, ratingValue, ccuIcon, ccuValue],
      "an empty standard stats row must receive both owned metrics in native leaf order"
    );
    assert.equal(
      card.root.querySelector("[data-rsl-game-tile-ccu-container]"),
      null,
      "a standard stats-row placeholder must not create an owned corner container"
    );
    assert.deepEqual(Array.from(details.children), [title, card.metadata]);
    assert.equal(title.className, originalTitleClass);
    assert.equal(title.getAttribute("style"), originalTitleStyle);
    fixture.hooks.cleanupGameTileCcuFeature();
  }

  {
    // Live race: Roblox/BTR can publish the normal row and vote metric before
    // its player count. RoTool's temporary count belongs immediately after the
    // native rating, without a title-row corner that narrows every game name.
    const fixture = loadContentCcuFixture({
      IntlImplementation: commaDefaultIntl
    });
    const card = makeContentCcuCard(fixture.document, "690", {
      universeId: "9690"
    });
    const details = fixture.document.createElement("div");
    details.className = "info-metadata-container";
    const title = fixture.document.createElement("div");
    title.className = "game-card-name game-name-title";
    title.textContent = "A normal wide game with a long title";
    const baseMetadata = fixture.document.createElement("div");
    baseMetadata.className = "base-metadata";
    const stats = fixture.document.createElement("div");
    stats.className = "game-card-info";
    stats.setAttribute("data-testid", "game-tile-stats");
    const voteIcon = fixture.document.createElement("span");
    voteIcon.className = "info-label icon-votes-gray";
    const voteValue = fixture.document.createElement("span");
    voteValue.className = "info-label vote-percentage-label";
    voteValue.textContent = "91%";
    stats.append(voteIcon, voteValue);
    baseMetadata.append(stats);
    card.metadata.append(baseMetadata);
    details.append(title, card.metadata);
    card.link.append(details);

    const originalTitleClass = title.className;
    const originalTitleStyle = title.getAttribute("style");
    const originalDetailsClass = details.className;
    assert.equal(
      fixture.hooks.syncGameTileCcu(card.root, "690", 28_700, "9690", 91),
      true
    );
    const ccuIcon = card.root.querySelector("[data-rsl-game-tile-ccu-icon]");
    const ccuValue = card.root.querySelector("[data-rsl-game-tile-ccu-value]");
    assert.ok(ccuIcon && ccuValue, "the rating-only native row must receive temporary CCU");
    assert.equal(ccuValue.textContent, "28.7K");
    assert.deepEqual(
      Array.from(stats.children),
      [voteIcon, voteValue, ccuIcon, ccuValue],
      "owned CCU must be the adjacent icon/value pair directly after native rating"
    );
    assert.equal(voteIcon.parentElement, stats);
    assert.equal(voteValue.parentElement, stats);
    assert.equal(
      card.root.querySelector("[data-rsl-game-tile-rating-value]"),
      null,
      "RoTool must not duplicate a meaningful native rating"
    );
    assert.equal(
      card.root.querySelector("[data-rsl-game-tile-ccu-container]"),
      null,
      "a normal native stats row must not create the title-corner/grid container"
    );
    assert.equal(
      card.root.querySelector(".rsl-game-tile-ccu-metadata--corner"),
      null
    );
    assert.deepEqual(
      Array.from(details.children),
      [title, card.metadata],
      "native-row insertion must not add a title-layout sibling"
    );
    assert.equal(details.className, originalDetailsClass);
    assert.equal(title.className, originalTitleClass);
    assert.equal(
      title.getAttribute("style"),
      originalTitleStyle,
      "native-row CCU must preserve the title's full-width styling"
    );

    // Model the competing extension completing its row after our cached sync.
    const externalPlayingIcon = fixture.document.createElement("span");
    externalPlayingIcon.className = "info-label icon-playing-counts-gray";
    const externalPlayingValue = fixture.document.createElement("span");
    externalPlayingValue.className = "info-label playing-counts-label";
    const externalText = fixture.document.createTextNode("28.7K");
    externalPlayingValue.append(externalText);
    stats.append(externalPlayingIcon, externalPlayingValue);
    fixture.hooks.invalidateStaleGameTileCcuControls([
      { type: "characterData", target: externalText }
    ]);

    assert.equal(ccuIcon.isConnected, false);
    assert.equal(ccuValue.isConnected, false);
    assert.deepEqual(
      Array.from(stats.children),
      [voteIcon, voteValue, externalPlayingIcon, externalPlayingValue],
      "late external CCU must take over the native row without disturbing its rating"
    );
    assert.equal(card.root.hasAttribute("data-rsl-game-tile-ccu-external"), true);
    assert.equal(card.root.querySelector("[data-rsl-game-tile-ccu-icon]"), null);
    assert.equal(card.root.querySelector("[data-rsl-game-tile-ccu-value]"), null);
    assert.equal(card.root.querySelector("[data-rsl-game-tile-ccu-container]"), null);
    assert.equal(title.getAttribute("style"), originalTitleStyle);
    fixture.hooks.cleanupGameTileCcuFeature();
    assert.equal(voteValue.isConnected, true);
    assert.equal(externalPlayingValue.isConnected, true);
  }

  {
    // Native/BTRoblox-shaped metadata with both meaningful values is
    // authoritative. RoTool must neither replace it nor add a second pair.
    const fixture = loadContentCcuFixture();
    const card = makeContentCcuCard(fixture.document, "700");
    const info = fixture.document.createElement("div");
    info.className = "game-card-info";
    info.setAttribute("data-testid", "game-tile-stats");
    const voteIcon = fixture.document.createElement("span");
    voteIcon.className = "info-label icon-votes-gray";
    const voteValue = fixture.document.createElement("span");
    voteValue.className = "info-label vote-percentage-label";
    voteValue.textContent = "89%";
    const playingIcon = fixture.document.createElement("span");
    playingIcon.className = "info-label icon-playing-counts-gray";
    const playingValue = fixture.document.createElement("span");
    playingValue.className = "info-label playing-counts-label";
    playingValue.textContent = "1.2K";
    info.append(voteIcon, voteValue, playingIcon, playingValue);
    card.metadata.append(info);

    assert.equal(
      fixture.hooks.syncGameTileCcu(card.root, "700", 1_234, null, 92),
      false
    );
    assert.equal(voteValue.textContent, "89%");
    assert.equal(playingValue.textContent, "1.2K");
    assert.equal(card.root.querySelectorAll(".vote-percentage-label").length, 1);
    assert.equal(card.root.querySelectorAll(".playing-counts-label").length, 1);
    assert.equal(card.root.querySelector("[data-rsl-game-tile-ccu-container]"), null);
    assert.equal(card.root.querySelector("[data-rsl-game-tile-ccu-value]"), null);
    fixture.hooks.cleanupGameTileCcuFeature();
  }

  {
    // Replaying the same cached response is a common observer/remount path.
    // It must reuse the exact metric nodes in place instead of appending them
    // again, which would create needless child-list mutations and flicker.
    const fixture = loadContentCcuFixture();
    const card = makeContentCcuCard(fixture.document, "710", {
      universeId: "9710"
    });
    const details = fixture.document.createElement("div");
    details.className = "info-metadata-container";
    const title = fixture.document.createElement("div");
    title.className = "game-card-name game-name-title";
    title.textContent = "Stable metrics";
    details.append(title, card.metadata);
    card.link.append(details);

    assert.equal(
      fixture.hooks.syncGameTileCcu(card.root, "710", 5_358, "9710", 87),
      true
    );
    const container = card.root.querySelector("[data-rsl-game-tile-ccu-container]");
    const info = card.root.querySelector("[data-rsl-game-tile-ccu]");
    assert.ok(container && info);
    const originalMetricChildren = Array.from(info.children);
    const originalAppend = info.append.bind(info);
    const originalRemoveChild = info.removeChild.bind(info);
    let appendCalls = 0;
    let removeCalls = 0;
    info.append = (...nodes) => {
      appendCalls += 1;
      return originalAppend(...nodes);
    };
    info.removeChild = (node) => {
      removeCalls += 1;
      return originalRemoveChild(node);
    };

    assert.equal(
      fixture.hooks.syncGameTileCcu(card.root, "710", 5_358, "9710", 87),
      true
    );
    assert.equal(
      card.root.querySelector("[data-rsl-game-tile-ccu-container]"),
      container,
      "an identical cached sync must reuse the same corner container"
    );
    assert.equal(
      card.root.querySelector("[data-rsl-game-tile-ccu]"),
      info,
      "an identical cached sync must reuse the same native-shaped info row"
    );
    assert.equal(
      appendCalls,
      0,
      "an identical cached sync must not move already ordered metric children"
    );
    assert.equal(
      removeCalls,
      0,
      "an identical cached sync must not detach already ordered metric children"
    );
    assert.deepEqual(
      Array.from(info.children),
      originalMetricChildren,
      "metric node identity and order must remain stable across cached syncs"
    );
    originalMetricChildren.forEach((node) => assert.equal(node.parentElement, info));
    fixture.hooks.cleanupGameTileCcuFeature();
  }

  {
    // BTRoblox may contribute only CCU to an editorial text footer. Its count
    // remains authoritative, while RoTool may independently fill the missing
    // rating in the separate corner without creating another playing metric.
    const fixture = loadContentCcuFixture();
    const card = makeContentCcuCard(fixture.document, "720", {
      universeId: "9720"
    });
    const details = fixture.document.createElement("div");
    details.className = "info-metadata-container";
    const title = fixture.document.createElement("div");
    title.className = "game-card-name game-name-title";
    title.textContent = "Mixed ownership";
    const baseMetadata = fixture.document.createElement("div");
    baseMetadata.className = "base-metadata";
    const descriptionFooter = fixture.document.createElement("div");
    descriptionFooter.className = "game-card-info";
    descriptionFooter.setAttribute("data-testid", "game-tile-stats-text-footer");
    const description = fixture.document.createElement("span");
    description.className = "info-label";
    description.textContent = "Editorial description";
    const externalPlayingIcon = fixture.document.createElement("span");
    externalPlayingIcon.className = "info-label icon-playing-counts-gray";
    const externalPlayingValue = fixture.document.createElement("span");
    externalPlayingValue.className = "info-label playing-counts-label";
    externalPlayingValue.textContent = "1.2K";
    descriptionFooter.append(description, externalPlayingIcon, externalPlayingValue);
    baseMetadata.append(descriptionFooter);
    card.metadata.append(baseMetadata);
    details.append(title, card.metadata);
    card.link.append(details);

    assert.equal(
      fixture.hooks.syncGameTileCcu(card.root, "720", 1_234, "9720", 92),
      true,
      "an external count must not prevent filling a separately missing rating"
    );
    const ownedRating = card.root.querySelector("[data-rsl-game-tile-rating-value]");
    const corner = card.root.querySelector("[data-rsl-game-tile-ccu-container]");
    assert.ok(ownedRating, "the missing editorial rating must be filled");
    assert.equal(ownedRating.textContent, "92%");
    assert.ok(corner, "the owned rating must use the editorial corner slot");
    assert.equal(corner.parentElement, details);
    assert.equal(corner.contains(ownedRating), true);
    assert.equal(
      card.root.querySelectorAll(".playing-counts-label").length,
      1,
      "the BTRoblox count must remain the only playing value"
    );
    assert.equal(card.root.querySelector("[data-rsl-game-tile-ccu-value]"), null);
    assert.equal(externalPlayingIcon.parentElement, descriptionFooter);
    assert.equal(externalPlayingValue.parentElement, descriptionFooter);
    assert.equal(externalPlayingValue.textContent, "1.2K");
    assert.equal(descriptionFooter.children[0], description);
    fixture.hooks.cleanupGameTileCcuFeature();
    assert.equal(ownedRating.isConnected, false);
    assert.equal(externalPlayingValue.isConnected, true);
  }

  {
    // The global mutation observer still calls invalidation when this feature
    // is disabled. That path must be inert, including sponsored-label text.
    const fixture = loadContentCcuFixture();
    fixture.hooks.setFeatureSettingsForTests({
      version: 1,
      flags: { quickPlay: false, gameCcu: false }
    });
    const card = makeContentCcuCard(fixture.document, "730");
    const sponsoredFooter = fixture.document.createElement("div");
    sponsoredFooter.className = "game-card-info sponsored-footer show-secondary";
    sponsoredFooter.setAttribute("data-testid", "wide-game-tile-sponsored-footer");
    const voteValue = fixture.document.createElement("span");
    voteValue.className = "info-label vote-percentage-label";
    voteValue.textContent = "91% Rating";
    const textNode = fixture.document.createTextNode("91% Rating");
    voteValue.append(textNode);
    sponsoredFooter.append(voteValue);
    card.metadata.append(sponsoredFooter);

    fixture.hooks.invalidateStaleGameTileCcuControls([
      { type: "characterData", target: textNode }
    ]);
    assert.equal(
      voteValue.textContent,
      "91% Rating",
      "disabled-feature invalidation must not normalize sponsored text"
    );
    assert.equal(
      voteValue.hasAttribute("data-rsl-sponsored-rating-original-text"),
      false,
      "disabled invalidation must not write reversible-normalization markers"
    );
    assert.equal(card.root.querySelector("[data-rsl-game-tile-ccu-container]"), null);
    assert.equal(fixture.calls.length, 0);
  }

  {
    const fixture = loadContentCcuFixture();
    const presentBeforeMount = makeContentCcuCard(fixture.document, "201");
    const presentExternal = appendExternalCount(presentBeforeMount, "1.4K");
    const insertedBeforeSend = makeContentCcuCard(fixture.document, "202");
    const originalQueryAll = insertedBeforeSend.root.querySelectorAll.bind(
      insertedBeforeSend.root
    );
    let injected = false;
    insertedBeforeSend.root.querySelectorAll = (selector) => {
      const result = originalQueryAll(selector);
      if (!injected && String(selector).includes("playing-counts-label")) {
        injected = true;
        appendExternalCount(insertedBeforeSend, "987");
      }
      return result;
    };

    fixture.hooks.mountGameTileCcu();
    assert.equal(injected, true);
    assert.equal(
      fixture.calls.length,
      0,
      "meaningful external CCU present before discovery or inserted before send must cost zero requests"
    );
    assert.equal(
      presentBeforeMount.root.hasAttribute("data-rsl-game-tile-ccu-external"),
      true,
      "validated external state must use the namespaced CSS marker"
    );
    assert.equal(
      insertedBeforeSend.root.hasAttribute("data-rsl-game-tile-ccu-external"),
      true
    );

    presentExternal.label.textContent = "";
    const clearedText = fixture.document.createTextNode("");
    presentExternal.label.append(clearedText);
    fixture.hooks.invalidateStaleGameTileCcuControls([
      { type: "characterData", target: clearedText }
    ]);
    assert.equal(
      presentBeforeMount.root.hasAttribute("data-rsl-game-tile-ccu-external"),
      false,
      "clearing a previously meaningful external count must clear the marker"
    );
    assert.equal(
      fixture.calls.length,
      1,
      "external-count disappearance must trigger exactly one targeted CCU request"
    );
    assert.deepEqual(
      fixture.calls[0].message.games.map((game) => game.placeId),
      ["201"]
    );
    fixture.hooks.cleanupGameTileCcuFeature();
  }

  {
    const fixture = loadContentCcuFixture();
    for (let index = 0; index < 105; index += 1) {
      makeContentCcuCard(fixture.document, String(1_000 + index), {
        universeId: String(9_000 + index)
      });
    }
    fixture.hooks.mountGameTileCcu();
    assert.deepEqual(
      fixture.calls.map((call) => call.message.games.length),
      [50, 50, 5],
      "all eligible cards must load automatically through internal 50-card batches"
    );
    assert.equal(
      new Set(fixture.calls.flatMap((call) => call.message.games.map((game) => game.placeId))).size,
      105
    );
    fixture.hooks.cleanupGameTileCcuFeature();
  }

  {
    const fixture = loadContentCcuFixture();
    const card = makeContentCcuCard(fixture.document, "301");
    fixture.hooks.mountGameTileCcu();
    assert.equal(fixture.calls.length, 1);
    assert.equal(fixture.calls[0].message.games[0].universeId, null);
    fixture.calls[0].reply({
      ok: true,
      requestId: fixture.calls[0].message.requestId,
      games: [{ placeId: "301", universeId: "9301", playing: 321 }]
    });
    await flushContentMicrotasks();
    const value = card.root.querySelector("[data-rsl-game-tile-ccu-value]");
    assert.ok(value, "a place-only game link must render its resolved-universe response");
    assert.match(value.getAttribute("aria-label"), /321 players playing/);

    const external = appendExternalCount(card, "");
    const textNode = fixture.document.createTextNode("654");
    external.label.textContent = "654";
    external.label.append(textNode);
    fixture.hooks.invalidateStaleGameTileCcuControls([
      { type: "characterData", target: textNode }
    ]);
    assert.equal(
      card.root.querySelector("[data-rsl-game-tile-ccu-value]"),
      null,
      "a numeric characterData update must remove the now-duplicate owned value"
    );
    assert.equal(card.root.hasAttribute("data-rsl-game-tile-ccu-external"), true);
    fixture.hooks.cleanupGameTileCcuFeature();
  }

  {
    const fixture = loadContentCcuFixture();
    const card = makeContentCcuCard(fixture.document, "401");
    fixture.hooks.mountGameTileCcu();
    const pending = fixture.calls[0];
    card.link.setAttribute("href", "/games/402/recycled");
    fixture.hooks.invalidateStaleGameTileCcuControls([
      { type: "attributes", target: card.link, attributeName: "href" }
    ]);
    pending.reply({
      ok: true,
      requestId: pending.message.requestId,
      games: [{ placeId: "401", universeId: "9401", playing: 444 }]
    });
    await flushContentMicrotasks();
    assert.equal(
      card.root.querySelector("[data-rsl-game-tile-ccu-value]"),
      null,
      "a late response for a recycled card must never paint the previous game's count"
    );
    fixture.hooks.cleanupGameTileCcuFeature();
  }

  {
    const fixture = loadContentCcuFixture();
    const card = makeContentCcuCard(fixture.document, "501");
    fixture.hooks.mountGameTileCcu();
    const pending = fixture.calls[0];
    assert.equal(fixture.hooks.syncGameTileCcu(card.root, "501", 55, null), true);
    assert.ok(card.root.querySelector("[data-rsl-game-tile-ccu-value]"));
    fixture.hooks.cleanupGameTileCcuFeature();
    assert.equal(card.root.querySelector("[data-rsl-game-tile-ccu-value]"), null);
    assert.deepEqual(
      JSON.parse(JSON.stringify(fixture.hooks.getGameTileCcuStateForTests())),
      {
        queuedPlaceIds: 0,
        pendingPlaceIds: 0,
        cachedPlaceIds: 0,
        retryPlaceIds: 0,
        lifecycleEpoch: 1
      }
    );
    pending.reply({
      ok: true,
      requestId: pending.message.requestId,
      games: [{ placeId: "501", universeId: "9501", playing: 999 }]
    });
    await flushContentMicrotasks();
    assert.equal(
      card.root.querySelector("[data-rsl-game-tile-ccu-value]"),
      null,
      "cleanup must make an already in-flight response inert"
    );
  }
}

async function runContentCcuGraphBehaviorContracts() {
  const getDirectionalGraphLines = (overlay) =>
    Array.from(overlay.querySelectorAll(".rsl-game-ccu-graph__line"));
  const getDirectionalGraphPathData = (overlay) =>
    getDirectionalGraphLines(overlay)
      .map((path) => path.getAttribute("d") || "")
      .join(" ");
  const getDirectionalGraphEdges = (overlay) =>
    getDirectionalGraphLines(overlay).flatMap((path) => {
      const edges = [];
      let previous = null;
      for (const match of (path.getAttribute("d") || "").matchAll(
        /([ML])(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g
      )) {
        const current = { x: Number(match[2]), y: Number(match[3]) };
        if (match[1] === "M") {
          previous = current;
          continue;
        }
        if (previous) {
          edges.push({
            trend: path.getAttribute("data-trend"),
            x1: previous.x,
            y1: previous.y,
            x2: current.x,
            y2: current.y
          });
        }
        previous = current;
      }
      return edges;
    });
  const assertMetadataOnlyGraphFooter = (
    overlay,
    { expectFreshness, message }
  ) => {
    const footer = overlay.querySelector(".rsl-game-ccu-graph__footer");
    const footerMeta = footer?.querySelector(
      ".rsl-game-ccu-graph__footer-meta"
    );
    assert.ok(footer && footerMeta, `${message}: metadata footer must exist`);
    assert.equal(
      footer.children.length,
      1,
      `${message}: footer must contain only freshness/cadence metadata`
    );
    assert.equal(
      footer.children[0],
      footerMeta,
      `${message}: footer metadata must be the sole direct child`
    );
    assert.equal(
      overlay.querySelector(".rsl-game-ccu-graph__gap-key"),
      null,
      `${message}: striped gaps are explained interactively, not by a bottom-left legend`
    );
    assert.equal(
      overlay.querySelector(".rsl-game-ccu-graph__history-key"),
      null,
      `${message}: the footer must not reserve a redundant history label`
    );
    assert.ok(
      footerMeta.querySelector(".rsl-game-ccu-graph__cadence"),
      `${message}: normal sample cadence must remain visible`
    );
    assert.equal(
      Boolean(footerMeta.querySelector(".rsl-game-ccu-graph__latest-time")),
      expectFreshness,
      `${message}: freshness exists only when a saved observation exists`
    );
    assert.equal(
      footer.hasAttribute("data-has-gaps"),
      false,
      `${message}: removed legend must not leave a special split-footer layout state`
    );
  };
  const graphTriggerRule = /\[data-rsl-game-ccu-graph-trigger\]\s*\{([^}]*)\}/
    .exec(stylesSource)?.[1] || "";
  assert.doesNotMatch(
    graphTriggerRule,
    /cursor:\s*help/i,
    "the CCU graph trigger must not imply a help-tooltip interaction"
  );
  assert.match(graphTriggerRule, /cursor:\s*pointer/i);
  const graphPopoverRule = /\.rsl-game-ccu-graph\s*\{([^}]*)\}/
    .exec(stylesSource)?.[1] || "";
  assert.match(graphPopoverRule, /position:\s*fixed\s*!important/);
  assert.match(
    graphPopoverRule,
    /width:\s*min\(300px,\s*calc\(100vw\s*-\s*16px\)\)/,
    "the anchored history popover must stay compact while preserving responsive viewport margins"
  );
  assert.match(graphPopoverRule, /height:\s*168px/);
  assert.match(
    graphPopoverRule,
    /min-height:\s*0/,
    "the popup must be allowed to shrink inside a short viewport"
  );
  assert.match(graphPopoverRule, /box-sizing:\s*border-box/);
  assert.match(graphPopoverRule, /overflow:\s*hidden/);
  assert.match(
    graphPopoverRule,
    /pointer-events:\s*auto/,
    "the polished popover surface must remain interactive after the pointer leaves the CCU trigger"
  );
  assert.match(
    stylesSource,
    /\.rsl-game-ccu-graph__interaction\s*\{[^}]*pointer-events:\s*auto/,
    "only the explicit plot interaction layer should accept pointer input"
  );
  const graphChartRule = /\.rsl-game-ccu-graph__chart\s*\{([^}]*)\}/
    .exec(stylesSource)?.[1] || "";
  assert.match(
    graphChartRule,
    /display:\s*grid[^}]*grid-template-columns:/,
    "the improved chart layout must reserve a semantic axis column without pixel positioning"
  );
  assert.match(graphChartRule, /min-height:\s*0/);
  assert.match(graphChartRule, /grid-template-rows:\s*minmax\([^)]*\)\s+\d+px/);
  const graphPlotRule = /\.rsl-game-ccu-graph__plot\s*\{([^}]*)\}/
    .exec(stylesSource)?.[1] || "";
  assert.match(graphPlotRule, /min-height:\s*0/);
  assert.match(graphPlotRule, /overflow:\s*visible/);
  const plotBorder = /(?:^|;)\s*border:\s*([^;\r\n]+)/i
    .exec(graphPlotRule)?.[1]?.trim();
  assert.ok(
    !plotBorder || /^(?:0|none)\b/i.test(plotBorder),
    "data-aligned top and bottom guides must not be doubled by a decorative plot border"
  );
  const graphPointTooltipRule = /\.rsl-game-ccu-graph__point-tooltip\s*\{([^}]*)\}/
    .exec(stylesSource)?.[1] || "";
  assert.match(graphPointTooltipRule, /position:\s*absolute/);
  assert.match(graphPointTooltipRule, /right:\s*\d+px/);
  assert.match(graphPointTooltipRule, /max-width:\s*calc\(100%\s*-\s*\d+px\)/);
  assert.match(
    graphPointTooltipRule,
    /transform:\s*none/,
    "inspection text must be pinned inside the plot rather than translated beyond it"
  );
  assert.match(
    stylesSource,
    /\.rsl-game-ccu-graph__crosshair\[data-tooltip-left\][\s\S]*?\.rsl-game-ccu-graph__point-tooltip\s*\{[^}]*right:\s*auto[^}]*left:\s*\d+px[^}]*transform:\s*none/,
    "the opposite tooltip placement must also stay inside the plot"
  );
  for (const inspectorName of [
    "showGameTileCcuGraphGapPoint",
    "showGameTileCcuGraphPoint"
  ]) {
    assert.match(
      getNamedFunctionSource(contentSource, inspectorName),
      /toggleAttribute\(["']data-tooltip-left["'],\s*xPercent\s*>=\s*50\)/,
      `${inspectorName} must flip the pinned tooltip at the plot midpoint`
    );
  }
  const graphFooterRule = /(?:^|\})\s*\.rsl-game-ccu-graph__footer\s*\{([^}]*)\}/
    .exec(stylesSource)?.[1] || "";
  assert.match(
    stylesSource,
    /\.rsl-game-ccu-graph__heading\s*\{[^}]*(?:display:\s*(?:grid|flex))[^}]*\}/,
    "the compact heading needs a stable semantic summary hierarchy"
  );
  assert.match(graphFooterRule, /display:\s*flex/);
  assert.match(graphFooterRule, /white-space:\s*nowrap/);
  const graphYAxisRule = /\.rsl-game-ccu-graph__y-axis\s*\{([^}]*)\}/
    .exec(stylesSource)?.[1] || "";
  const graphXAxisRule = /\.rsl-game-ccu-graph__x-axis\s*\{([^}]*)\}/
    .exec(stylesSource)?.[1] || "";
  assert.match(
    stylesSource,
    /\.rsl-game-ccu-graph__y-axis\s*\{[^}]*grid-column:\s*1/,
    "Y labels must occupy the dedicated axis column"
  );
  assert.match(
    stylesSource,
    /\.rsl-game-ccu-graph__x-axis\s*\{[^}]*grid-column:\s*2[^}]*grid-row:\s*2/,
    "X labels must align structurally beneath the plot"
  );
  const gapBandRule = /\.rsl-game-ccu-graph__gap-band\s*\{([^}]*)\}/
    .exec(stylesSource)?.[1] || "";
  const gapPatternBaseRule =
    /\.rsl-game-ccu-graph__gap-pattern-base\s*\{([^}]*)\}/
      .exec(stylesSource)?.[1] || "";
  const gapFillHex = /fill:\s*#([\da-f]{6})/i
    .exec(gapPatternBaseRule)?.[1];
  assert.ok(gapFillHex, "missing Chart intervals need an explicit hatch base");
  const gapFillChannels = [0, 2, 4].map((offset) =>
    Number.parseInt(gapFillHex.slice(offset, offset + 2), 16)
  );
  assert.ok(
    gapFillChannels[0] > gapFillChannels[2] &&
      gapFillChannels[1] > gapFillChannels[2],
    "missing Chart intervals must remain amber without locking the design to one shade"
  );
  const gapStroke = /(?:^|;)\s*stroke:\s*([^;\r\n]+)/i
    .exec(gapBandRule)?.[1]?.trim();
  assert.ok(
    !gapStroke || gapStroke.toLowerCase() === "none",
    "missing-data bands must be fill-only so adjacent gaps cannot create stacked outlines"
  );
  assert.doesNotMatch(
    gapBandRule,
    /stroke-dasharray/i,
    "missing-data bands must not add dashed offset lines around the real series"
  );
  assert.doesNotMatch(
    gapPatternBaseRule,
    /fill:\s*#ff4d61/i,
    "the amber no-data band must remain visually distinct from the red CCU series"
  );
  const gapStripeRule = /\.rsl-game-ccu-graph__gap-pattern-stripe\s*\{([^}]*)\}/
    .exec(stylesSource)?.[1] || "";
  assert.match(
    gapStripeRule,
    /stroke:\s*#(?:[\da-f]{6})/i,
    "no-data hatching needs a visible amber stripe"
  );
  assert.match(
    gapStripeRule,
    /vector-effect:\s*non-scaling-stroke/i,
    "no-data hatching must stay legible when the compact SVG scales"
  );
  const graphSurfaceDeclaration = getCssDeclaration(
    graphPopoverRule,
    "background"
  );
  const graphSurfaceFallback =
    /var\([^,]+,\s*(#[\da-f]{3,6})\s*\)/i.exec(graphSurfaceDeclaration)?.[1] ||
    graphSurfaceDeclaration;
  const graphSurfacePaint = parseCssColor(graphSurfaceFallback);
  const plotBackgroundPaint = parseCssColor(
    getCssDeclaration(graphPlotRule, "background")
  );
  const gapBasePaint = parseCssColor(
    getCssDeclaration(gapPatternBaseRule, "fill")
  );
  const gapStripePaint = parseCssColor(
    getCssDeclaration(gapStripeRule, "stroke")
  );
  const gapBaseOpacity = Number.parseFloat(
    getCssDeclaration(gapPatternBaseRule, "fill-opacity") || "1"
  );
  const gapStripeOpacity = Number.parseFloat(
    getCssDeclaration(gapStripeRule, "stroke-opacity") || "1"
  );
  assert.ok(
    graphSurfacePaint && plotBackgroundPaint && gapBasePaint && gapStripePaint &&
      Number.isFinite(gapBaseOpacity) && Number.isFinite(gapStripeOpacity),
    "no-data contrast must be measurable from semantic base and hatch paints"
  );
  const plotBackgroundChannels = compositeCssColor(
    plotBackgroundPaint,
    graphSurfacePaint.channels
  );
  const gapBaseChannels = compositeCssColor(
    gapBasePaint,
    plotBackgroundChannels,
    gapBaseOpacity
  );
  const gapStripeChannels = compositeCssColor(
    gapStripePaint,
    gapBaseChannels,
    gapStripeOpacity
  );
  const gapBaseContrast = contrastRatio(
    gapBaseChannels,
    plotBackgroundChannels
  );
  const gapStripeContrast = contrastRatio(
    gapStripeChannels,
    plotBackgroundChannels
  );
  assert.ok(
    gapBaseContrast >= 1.08,
    `the full missing-data region needs a visible tint; received ${gapBaseContrast.toFixed(3)}:1`
  );
  assert.ok(
    gapStripeContrast >= 1.5 && gapStripeContrast >= gapBaseContrast + 0.35,
    `hatching must materially distinguish no-data from the plot; received ${gapStripeContrast.toFixed(3)}:1`
  );
  assert.doesNotMatch(
    stylesSource,
    /\.rsl-game-ccu-graph__gap-boundary\b/,
    "no-data intervals must not add offset-looking vertical boundaries"
  );
  const upLineRule = /\.rsl-game-ccu-graph__line--up\s*\{([^}]*)\}/
    .exec(stylesSource)?.[1] || "";
  const downLineRule = /\.rsl-game-ccu-graph__line--down\s*\{([^}]*)\}/
    .exec(stylesSource)?.[1] || "";
  const flatLineRule = /\.rsl-game-ccu-graph__line--flat\s*\{([^}]*)\}/
    .exec(stylesSource)?.[1] || "";
  const graphLineRule = /\.rsl-game-ccu-graph__line\s*\{([^}]*)\}/
    .exec(stylesSource)?.[1] || "";
  const upStrokePaint = parseCssColor(getCssDeclaration(upLineRule, "stroke"));
  const downStrokePaint = parseCssColor(
    getCssDeclaration(downLineRule, "stroke")
  );
  assert.ok(
    upStrokePaint && downStrokePaint,
    "directional paths need resolvable colors for semantic differentiation"
  );
  for (const noDataPaint of [gapBasePaint, gapStripePaint]) {
    assert.ok(
      rgbDistance(noDataPaint.channels, upStrokePaint.channels) >= 64 &&
        rgbDistance(noDataPaint.channels, downStrokePaint.channels) >= 64,
      "no-data pigments must stay distinct from both rising and falling trend paths"
    );
    assert.ok(
      noDataPaint.channels[0] > noDataPaint.channels[2] &&
        noDataPaint.channels[1] > noDataPaint.channels[2],
      "no-data pigments must remain non-red amber without pinning an exact shade"
    );
  }
  assert.doesNotMatch(
    stylesSource,
    /\.rsl-game-ccu-graph__(?:gap|history)-key\b/,
    "removed bottom-left graph keys must not retain dead layout or swatch CSS"
  );
  const noObservationCrosshairRule =
    /\.rsl-game-ccu-graph__crosshair\[data-no-observation\][\s\S]*?\.rsl-game-ccu-graph__crosshair-line\s*\{([^}]*)\}/
      .exec(stylesSource)?.[1] || "";
  const noObservationCrosshairPaint = parseCssColor(
    getCssDeclaration(noObservationCrosshairRule, "background")
  );
  assert.ok(
    noObservationCrosshairPaint &&
      rgbDistance(noObservationCrosshairPaint.channels, upStrokePaint.channels) >= 64 &&
      rgbDistance(noObservationCrosshairPaint.channels, downStrokePaint.channels) >= 64,
    "gap inspection must retain the no-data visual language instead of looking like trend data"
  );
  const graphLineWidth = Number(
    /stroke-width:\s*(\d+(?:\.\d+)?)/.exec(graphLineRule)?.[1]
  );
  assert.ok(
    graphLineWidth >= 1 && graphLineWidth <= 1.5,
    "the series should stay crisp without overpowering the compact plot"
  );
  assert.match(
    graphLineRule,
    /stroke-linecap:\s*round/i,
    "directional runs need soft endpoints at real turns and missing-data boundaries"
  );
  assert.match(
    graphLineRule,
    /stroke-linejoin:\s*round/i,
    "same-trend raw edges should meet with rounded joins inside their grouped run"
  );
  assert.match(upLineRule, /stroke:\s*#38c976/i, "rising edges must be green");
  assert.match(downLineRule, /stroke:\s*#ff4d61/i, "falling edges must be red");
  assert.match(flatLineRule, /stroke:\s*#aab1bd/i, "unchanged edges must be gray");
  assert.doesNotMatch(
    contentSource,
    /rsl-game-ccu-graph__latest-point/,
    "the saved series must not render a stuck endpoint cursor"
  );
  assert.doesNotMatch(
    stylesSource,
    /\.rsl-game-ccu-graph__latest-point(?:--[a-z]+)?\b/,
    "removed endpoint cursors must not retain dead CSS"
  );
  const areaRule = /\.rsl-game-ccu-graph__area\s*\{([^}]*)\}/
    .exec(stylesSource)?.[1] || "";
  const areaFillPaint = parseCssColor(getCssDeclaration(areaRule, "fill"));
  assert.ok(areaFillPaint, "the observed-data area fill must be measurable");
  const areaContrast = contrastRatio(
    compositeCssColor(areaFillPaint, plotBackgroundChannels),
    plotBackgroundChannels
  );
  assert.ok(
    gapStripeContrast >= areaContrast + 0.35,
    "the missing-data hatch must stand out materially more than the neutral observed-data area"
  );
  const areaOpacity = Number(
    /fill:\s*rgb\(174\s+181\s+194\s*\/\s*(\d+(?:\.\d+)?)%\)/i
      .exec(areaRule)?.[1]
  );
  assert.ok(
    areaOpacity >= 4 && areaOpacity <= 14,
    "the neutral area should provide depth without overpowering directional edges"
  );
  assert.doesNotMatch(
    stylesSource,
    /\.rsl-game-ccu-graph__area--(?:up|down|flat)/i,
    "direction belongs to real edges, not the area fill"
  );
  assert.doesNotMatch(
    stylesSource,
    /\[data-rsl-game-ccu-graph-open\][\s\S]{0,240}?\[data-rsl-quick-play-surface\][\s\S]{0,120}?visibility:\s*hidden/i,
    "a body-level history popover must not hide the card's independent Quick Play surface"
  );
  assert.match(
    getNamedFunctionSource(contentSource, "ensureGameTileCcuGraphEvents"),
    /addEventListener\(["']pointermove["'],\s*handleGameTileCcuGraphPointerMove/,
    "the click-through popover needs document-level geometry hover tracking"
  );
  assert.match(
    getNamedFunctionSource(contentSource, "removeGameTileCcuGraphEvents"),
    /removeEventListener\(["']pointermove["'],\s*handleGameTileCcuGraphPointerMove/,
    "feature cleanup must remove the geometry hover listener"
  );
  for (const hookName of [
    "mountGameTileCcuGraphTriggers",
    "openGameTileCcuGraph",
    "closeGameTileCcuGraph",
    "cleanupGameTileCcuGraphDisplay",
    "normalizeGameTileCcuHistoryPoints",
    "downsampleGameTileCcuGraphPoints",
    "downsampleGameTileCcuGraphSegments",
    "getGameTileCcuGraphAxisModel",
    "getGameTileCcuGraphGapIntervals",
    "getGameTileCcuGraphEdgeTrend",
    "getGameTileCcuGraphLatestPercentChange",
    "findNearestGameTileCcuGraphPoint",
    "showGameTileCcuGraphGapPoint",
    "showGameTileCcuGraphPoint",
    "positionGameTileCcuGraphPopover",
    "scheduleGameTileCcuGraphClose",
    "renderGameTileCcuGraph",
    "getGameTileCcuGraphStateForTests"
  ]) {
    const fixture = loadContentCcuFixture();
    assert.equal(typeof fixture.hooks[hookName], "function", `${hookName} must be testable`);
  }

  {
    const fixture = loadContentCcuFixture();
    const bucketMs = 5 * 60_000;
    const displayWindowMs = 12 * 60 * 60_000;
    const currentBucket = Math.floor(Date.now() / bucketMs) * bucketMs;
    const windowStart = currentBucket - displayWindowMs;
    const recentPoints = [
      { timestamp: currentBucket - 15 * 60_000, playing: 1_100 },
      { timestamp: currentBucket - 10 * 60_000, playing: 1_200 }
    ];
    const oldPoints = [
      { timestamp: currentBucket - 6 * 24 * 60 * 60_000, playing: 900 },
      { timestamp: currentBucket - 6 * 24 * 60 * 60_000 + bucketMs, playing: 950 }
    ];
    for (const points of [recentPoints, oldPoints]) {
      const axis = fixture.hooks.getGameTileCcuGraphAxisModel(points, currentBucket);
      assert.equal(axis.minimumTimestamp, windowStart);
      assert.equal(axis.maximumTimestamp, currentBucket);
      assert.deepEqual(
        JSON.parse(JSON.stringify(axis.xTicks.map((tick) => tick.timestamp))),
        [windowStart, windowStart + displayWindowMs / 2, currentBucket],
        "every graph must retain the same rolling 12-hour X domain"
      );
    }

    assert.deepEqual(
      JSON.parse(JSON.stringify(
        fixture.hooks.getGameTileCcuGraphGapIntervals(
          [],
          windowStart,
          currentBucket
        )
      )),
      [{
        start: windowStart,
        end: currentBucket,
        leading: true,
        trailing: true
      }],
      "before the first saved snapshot the entire rolling window is explicitly no-data"
    );
    const lonePoint = {
      timestamp: currentBucket - 6 * 60 * 60_000,
      playing: 777
    };
    assert.deepEqual(
      JSON.parse(JSON.stringify(
        fixture.hooks.getGameTileCcuGraphGapIntervals(
          [lonePoint],
          windowStart,
          currentBucket
        )
      )),
      [
        {
          start: windowStart,
          end: lonePoint.timestamp - bucketMs / 2,
          leading: true,
          trailing: false
        },
        {
          start: lonePoint.timestamp + bucketMs / 2,
          end: currentBucket,
          leading: false,
          trailing: true
        }
      ],
      "one stored point must be surrounded by honest leading and trailing no-data"
    );
    const exactCadence = [
      { timestamp: currentBucket - 15 * 60_000, playing: 10 },
      { timestamp: currentBucket - 10 * 60_000, playing: 11 }
    ];
    assert.deepEqual(
      JSON.parse(JSON.stringify(
        fixture.hooks.getGameTileCcuGraphGapIntervals(
          exactCadence,
          exactCadence[0].timestamp,
          exactCadence[1].timestamp
        )
      )),
      [],
      "exact five-minute observations are continuous"
    );
    const missedBucket = [
      exactCadence[0],
      { timestamp: exactCadence[0].timestamp + 10 * 60_000, playing: 12 }
    ];
    assert.deepEqual(
      JSON.parse(JSON.stringify(
        fixture.hooks.getGameTileCcuGraphGapIntervals(
          missedBucket,
          missedBucket[0].timestamp,
          missedBucket[1].timestamp
        )
      )),
      [{
        start: missedBucket[0].timestamp + bucketMs / 2,
        end: missedBucket[1].timestamp - bucketMs / 2,
        leading: false,
        trailing: false
      }],
      "one missed five-minute bucket must be a real internal no-data interval"
    );

    const emptyOverlay = fixture.document.createElement("div");
    fixture.hooks.renderGameTileCcuGraph(emptyOverlay, [], currentBucket);
    assert.equal(emptyOverlay.getAttribute("data-state"), "no-history");
    assert.equal(emptyOverlay.getAttribute("data-gap-count"), "1");
    assert.ok(emptyOverlay.querySelector(".rsl-game-ccu-graph__chart"));
    assert.ok(emptyOverlay.querySelector(".rsl-game-ccu-graph__gap-band"));
    assert.equal(
      emptyOverlay.querySelectorAll(".rsl-game-ccu-graph__x-tick").length,
      3,
      "an empty response must still render the fixed timeline"
    );
    assert.equal(
      emptyOverlay.querySelectorAll(".rsl-game-ccu-graph__y-tick").length,
      0,
      "an empty response must not invent a numeric CCU scale"
    );
    for (const selector of [
      ".rsl-game-ccu-graph__line",
      ".rsl-game-ccu-graph__area",
      ".rsl-game-ccu-graph__isolated-point",
      ".rsl-game-ccu-graph__latest-point"
    ]) {
      assert.equal(emptyOverlay.querySelector(selector), null);
    }
    assert.equal(
      emptyOverlay.querySelector(".rsl-game-ccu-graph__interaction")
        ?.getAttribute("role"),
      "img"
    );
    assert.match(
      emptyOverlay.querySelector(".rsl-game-ccu-graph__interaction")
        ?.getAttribute("aria-label") || "",
      /rolling 12-hour window/i,
      "the empty plot description must announce the same visible window"
    );
    assert.match(
      emptyOverlay.querySelector(".rsl-game-ccu-graph__empty-note")
        ?.textContent || "",
      /no saved (?:Chart |CCU )?(?:observations?|samples?|data).*(?:12\s*h|12 hours?)/i,
      "the empty state must describe the visible window without implying that the game was never tracked"
    );
    const emptyStateCopy =
      `${emptyOverlay.textContent} ${emptyOverlay.getAttribute("aria-label") || ""}`;
    assert.doesNotMatch(
      emptyStateCopy,
      /(?:\b0\s*(?:CCU|players?|users?)\b|\bzero\s+(?:CCU|players?|users?))/i,
      "missing observations must never be presented as a measured zero-player value"
    );
    assert.doesNotMatch(
      emptyStateCopy,
      /\b(?:live|current CCU|currently 0|right now)\b/i,
      "an empty saved window must not imply a live/current reading"
    );
    assert.match(
      emptyOverlay.getAttribute("aria-label") || "",
      /rolling 12-hour/i,
      "the graph dialog description must identify its 12-hour display window"
    );
    assert.doesNotMatch(
      `${emptyOverlay.textContent} ${emptyOverlay.getAttribute("aria-label") || ""}`,
      /7\s*days?|seven-day/i,
      "rendered graph copy must not describe the old seven-day display"
    );
    assertMetadataOnlyGraphFooter(emptyOverlay, {
      expectFreshness: false,
      message: "empty graph"
    });
    assert.equal(
      emptyOverlay.querySelector(".rsl-game-ccu-graph__footer-meta")
        ?.children.length,
      1,
      "an empty graph footer must contain cadence only"
    );

    const retainedOnlyOverlay = fixture.document.createElement("div");
    const retainedOnlyPoints = fixture.hooks.renderGameTileCcuGraph(
      retainedOnlyOverlay,
      oldPoints,
      currentBucket
    );
    assert.deepEqual(
      JSON.parse(JSON.stringify(retainedOnlyPoints)),
      [],
      "points retained for storage but older than 12 hours must stay outside the graph"
    );
    assert.equal(retainedOnlyOverlay.getAttribute("data-state"), "no-history");
    assert.equal(retainedOnlyOverlay.getAttribute("data-gap-count"), "1");
    assert.equal(
      retainedOnlyOverlay.getAttribute("data-window-start"),
      String(windowStart)
    );
    assert.equal(
      retainedOnlyOverlay.getAttribute("data-window-end"),
      String(currentBucket)
    );

    const singletonOverlay = fixture.document.createElement("div");
    fixture.hooks.renderGameTileCcuGraph(
      singletonOverlay,
      [lonePoint],
      currentBucket
    );
    assert.equal(singletonOverlay.getAttribute("data-state"), "collecting");
    assert.equal(singletonOverlay.getAttribute("data-gap-count"), "2");
    assert.ok(singletonOverlay.querySelector(".rsl-game-ccu-graph__isolated-point"));
    assert.equal(singletonOverlay.querySelector(".rsl-game-ccu-graph__line"), null);
    assert.equal(singletonOverlay.querySelector(".rsl-game-ccu-graph__area"), null);
    assert.equal(
      singletonOverlay.querySelector(".rsl-game-ccu-graph__interaction")
        ?.getAttribute("role"),
      "slider"
    );
    assertMetadataOnlyGraphFooter(singletonOverlay, {
      expectFreshness: true,
      message: "collecting graph with one saved observation"
    });

    const interactivePoints = [
      { timestamp: currentBucket - 30 * 60_000, playing: 1_001 },
      { timestamp: currentBucket - 25 * 60_000, playing: 1_111 },
      { timestamp: currentBucket - 10 * 60_000, playing: 1_333 }
    ];
    const nearestInGap = fixture.hooks.findNearestGameTileCcuGraphPoint(
      interactivePoints,
      currentBucket - 17.5 * 60_000
    );
    assert.equal(
      interactivePoints.includes(nearestInGap.point),
      true,
      "gap inspection may snap only to a real stored endpoint, never an interpolated value"
    );
    assert.equal(nearestInGap.point.playing, 1_111);

    const interactionOverlay = fixture.document.createElement("div");
    fixture.document.body.append(interactionOverlay);
    fixture.hooks.renderGameTileCcuGraph(
      interactionOverlay,
      interactivePoints,
      currentBucket
    );
    const interaction = interactionOverlay.querySelector(
      ".rsl-game-ccu-graph__interaction"
    );
    assert.equal(interaction.getAttribute("role"), "slider");
    assert.equal(
      interaction.getAttribute("aria-orientation"),
      "horizontal",
      "the observation inspector must announce the direction used by its arrow-key controls"
    );
    interaction.setFixtureRect({ left: 100, top: 100, width: 700, height: 220 });
    const gapTimestamp = currentBucket - 17.5 * 60_000;
    const gapDomainRatio = (gapTimestamp - windowStart) / displayWindowMs;
    const gapClientRatio = (8 + gapDomainRatio * 284) / 300;
    interaction.dispatchEvent({
      type: "pointermove",
      clientX: 100 + 700 * gapClientRatio
    });
    assert.equal(interaction.hasAttribute("data-gap-active"), true);
    assert.equal(interaction.hasAttribute("data-point-active"), false);
    assert.equal(
      interactionOverlay.querySelector(".rsl-game-ccu-graph__crosshair")
        ?.hasAttribute("data-no-observation"),
      true
    );
    assert.equal(
      interactionOverlay.querySelector(".rsl-game-ccu-graph__crosshair-point")
        ?.hidden,
      true
    );
    const gapTooltipValue = interactionOverlay.querySelector(
      ".rsl-game-ccu-graph__point-ccu"
    );
    const gapTooltipTime = interactionOverlay.querySelector(
      ".rsl-game-ccu-graph__point-time"
    );
    const expectedGapDate = new Date(
      Math.round(gapTimestamp / bucketMs) * bucketMs
    );
    const expectedGapTimestamp = expectedGapDate.toLocaleString();
    assert.equal(
      gapTooltipValue?.textContent,
      "No saved data",
      "pointer inspection inside a striped interval needs concise user-facing missing-data copy"
    );
    assert.equal(
      gapTooltipTime?.textContent,
      expectedGapTimestamp,
      "the no-data tooltip must retain the exact inspected timestamp"
    );
    assert.equal(
      gapTooltipTime?.getAttribute("datetime"),
      expectedGapDate.toISOString(),
      "the no-data timestamp must remain machine-readable"
    );
    assert.equal(
      gapTooltipTime?.localName,
      "time",
      "missing data still refers to a precise time on the graph"
    );
    const visibleGapTooltipCopy =
      `${gapTooltipValue?.textContent || ""} ${gapTooltipTime?.textContent || ""}`;
    assert.doesNotMatch(
      visibleGapTooltipCopy,
      /(?:\b0\s*(?:CCU|players?|users?)\b|\bzero\s+(?:CCU|players?|users?))/i,
      "a missing sample must never look like a measured zero-player value"
    );
    assert.doesNotMatch(
      visibleGapTooltipCopy,
      /\b(?:offline|live|current(?:ly)?|right now)\b/i,
      "missing saved data must not imply game availability or live state"
    );
    const gapAriaValue = Number(interaction.getAttribute("aria-valuenow"));
    assert.equal(Number.isInteger(gapAriaValue), true);
    assert.ok(
      gapAriaValue >= 0 && gapAriaValue < interactivePoints.length,
      "a slider must retain a valid real-observation index while its text describes a missing interval"
    );
    const gapAriaText = interaction.getAttribute("aria-valuetext") || "";
    assert.match(
      gapAriaText,
      /No saved (?:Chart )?(?:CCU )?(?:data|observation) at/i,
      "assistive technology must hear that this is an absence of saved data"
    );
    assert.match(
      gapAriaText,
      new RegExp(expectedGapTimestamp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      "the accessible no-data description must include the same exact timestamp"
    );
    assert.doesNotMatch(
      gapAriaText,
      /(?:\b0\s*(?:CCU|players?|users?)\b|\boffline\b|\blive\b|\bcurrent(?:ly)?\b)/i,
      "accessible gap copy must not imply zero players, offline status, or a live value"
    );

    const finalGapBoundary = interactivePoints[2].timestamp - bucketMs / 2;
    const boundaryDomainRatio = (finalGapBoundary - windowStart) / displayWindowMs;
    const boundaryClientRatio = (8 + boundaryDomainRatio * 284) / 300;
    interaction.dispatchEvent({
      type: "pointermove",
      clientX: 100 + 700 * boundaryClientRatio
    });
    assert.equal(
      interaction.hasAttribute("data-point-active"),
      true,
      "a gap boundary that resolves to a stored bucket must inspect that observation"
    );
    assert.equal(
      interactionOverlay.querySelector(".rsl-game-ccu-graph__point-ccu")
        ?.textContent,
      "1.333 CCU",
      "gap inspection must never label the timestamp of a real stored observation as missing"
    );
    interaction.focus();
    interaction.dispatchEvent({ type: "focus" });
    assert.equal(interaction.hasAttribute("data-gap-active"), false);
    assert.equal(interaction.getAttribute("data-point-index"), "2");
    assert.equal(
      interactionOverlay.querySelector(".rsl-game-ccu-graph__point-ccu")
        ?.textContent,
      "1.333 CCU"
    );
    assert.equal(
      interactionOverlay.querySelector(".rsl-game-ccu-graph__point-time")
        ?.getAttribute("datetime"),
      new Date(interactivePoints[2].timestamp).toISOString()
    );
    const pointTooltip = interactionOverlay.querySelector(
      ".rsl-game-ccu-graph__point-tooltip"
    );
    assert.equal(
      pointTooltip?.children[0]?.matches(".rsl-game-ccu-graph__point-ccu"),
      true,
      "the inspected value should lead the tooltip hierarchy"
    );
    assert.equal(
      pointTooltip?.children[1]?.matches(".rsl-game-ccu-graph__point-time"),
      true,
      "the localized observation time should remain the tooltip context"
    );
    assert.match(interaction.getAttribute("aria-valuetext") || "", /1\.333 CCU at/i);
    interaction.dispatchEvent({ type: "keydown", key: "Home" });
    assert.equal(interaction.getAttribute("data-point-index"), "0");
    interaction.dispatchEvent({ type: "keydown", key: "ArrowRight" });
    assert.equal(interaction.getAttribute("data-point-index"), "1");
    assert.equal(
      interactionOverlay.querySelector(".rsl-game-ccu-graph__point-ccu")
        ?.textContent,
      "1.111 CCU",
      "keyboard inspection must advance between exact stored observations"
    );
    interaction.dispatchEvent({ type: "keydown", key: "End" });
    assert.equal(interaction.getAttribute("data-point-index"), "2");
    interaction.dispatchEvent({ type: "pointerleave" });
    assert.equal(
      interaction.hasAttribute("data-point-active"),
      true,
      "pointer exit must not erase the keyboard user's focused observation"
    );

    const splitOverlay = fixture.document.createElement("div");
    fixture.hooks.renderGameTileCcuGraph(splitOverlay, [
      { timestamp: currentBucket - 20 * 60_000, playing: 100 },
      { timestamp: currentBucket - 15 * 60_000, playing: 110 },
      { timestamp: currentBucket - 5 * 60_000, playing: 90 },
      { timestamp: currentBucket, playing: 80 }
    ], currentBucket);
    assert.deepEqual(
      getDirectionalGraphEdges(splitOverlay).map((edge) => edge.trend).sort(),
      ["down", "up"],
      "directional paths must restart after a missed bucket instead of bridging the gap"
    );
  }

  {
    const fixture = loadContentCcuFixture();
    fixture.hooks.setFeatureSettingsForTests({
      version: 1,
      flags: { quickPlay: false, gameCcu: true }
    });
    const card = makeContentCcuGraphCard(fixture.document, "701", "9701");
    card.label.setFixtureRect({ left: 240, top: 260, width: 64, height: 20 });
    fixture.hooks.mountGameTileCcuGraphTriggers();
    assert.equal(card.label.hasAttribute("data-rsl-game-ccu-graph-trigger"), true);
    assert.equal(card.label.getAttribute("tabindex"), "0");

    fixture.document.dispatchEvent({
      type: "pointerover",
      target: card.label,
      relatedTarget: null
    });
    assert.equal(
      fixture.document.querySelector("[data-rsl-game-ccu-graph-overlay]"),
      null,
      "pointer hover must not flash a graph before the 100ms intent delay"
    );
    assert.equal(fixture.calls.length, 0);
    assert.equal(fixture.timers.size, 1);
    assert.equal(Array.from(fixture.timers.values())[0].delay, 100);
    assert.equal(
      fixture.hooks.getGameTileCcuGraphStateForTests().hoverIntentPending,
      true
    );
    fixture.document.dispatchEvent({
      type: "pointerover",
      target: card.label,
      relatedTarget: null
    });
    assert.equal(fixture.timers.size, 1, "repeated pointerover must reuse one intent timer");
    const [intentTimerId, intentTimer] = Array.from(fixture.timers.entries())[0];
    fixture.timers.delete(intentTimerId);
    intentTimer.callback();
    await flushContentMicrotasks();
    const overlay = fixture.document.querySelector(
      "[data-rsl-game-ccu-graph-overlay]"
    );
    assert.ok(overlay, "the graph must open when the 100ms hover intent matures");
    assert.equal(overlay.parentElement, fixture.document.body);
    assert.equal(overlay.getAttribute("role"), "dialog");
    assert.equal(overlay.getAttribute("aria-modal"), "false");
    assert.equal(card.label.getAttribute("aria-controls"), overlay.id);
    assert.equal(
      card.label.getAttribute("aria-expanded"),
      "true",
      "the graph trigger must expose the open non-modal dialog state"
    );
    assert.equal(overlay.getAttribute("data-state"), "loading");
    assert.match(
      overlay.querySelector(".rsl-game-ccu-graph__state-title")?.textContent || "",
      /loading.*(?:CCU|history)/i
    );
    assert.match(overlay.getAttribute("aria-label") || "", /loading.*CCU|CCU.*loading/i);
    assert.equal(fixture.calls.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(fixture.calls[0].message)), {
      type: "rsl:get-game-ccu-history",
      requestId: 1,
      universeId: "9701"
    });

    fixture.calls[0].reply({
      ok: true,
      requestId: 1,
      universeId: "9701",
      tracked: false,
      points: []
    });
    await flushContentMicrotasks();
    assert.equal(overlay.getAttribute("data-state"), "no-history");
    assert.ok(
      overlay.querySelector(".rsl-game-ccu-graph__chart"),
      "an honest empty response must replace loading with the real 12-hour shell"
    );
    assert.equal(overlay.querySelector(".rsl-game-ccu-graph__state"), null);
    assert.equal(overlay.getAttribute("data-gap-count"), "1");
    assert.equal(
      overlay.querySelector(".rsl-game-ccu-graph__latest-time"),
      null,
      "an empty window must not invent a latest-sample timestamp"
    );
    assert.equal(
      fixture.hooks.getGameTileCcuGraphStateForTests().cachedUniverses,
      0,
      "an empty result must not remain cached across a later Chart snapshot"
    );
    assert.equal(
      fixture.hooks.getGameTileCcuGraphStateForTests().notTrackedRetryScheduled,
      true
    );
    assert.ok(
      fixture.hooks.getGameTileCcuGraphStateForTests().notTrackedRetryDueAt >
        Date.now()
    );
    assert.equal(fixture.timers.size, 1, "one active empty graph needs one bucket retry");
    fixture.document.dispatchEvent({
      type: "pointerover",
      target: card.label,
      relatedTarget: null
    });
    assert.equal(fixture.calls.length, 1);
    assert.equal(fixture.timers.size, 1, "repeat hover must not duplicate the retry timer");

    const [retryTimerId, retryTimer] = Array.from(fixture.timers.entries())[0];
    assert.ok(retryTimer.delay >= 5_000);
    fixture.timers.delete(retryTimerId);
    retryTimer.callback();
    await flushContentMicrotasks();
    assert.equal(
      fixture.calls.length,
      2,
      "the next-bucket retry must bypass the prior empty result"
    );
    assert.deepEqual(JSON.parse(JSON.stringify(fixture.calls[1].message)), {
      type: "rsl:get-game-ccu-history",
      requestId: 2,
      universeId: "9701"
    });
    fixture.calls[1].reply({
      ok: true,
      requestId: 2,
      universeId: "9701",
      tracked: true,
      points: [
        {
          timestamp: Math.floor(Date.now() / (5 * 60_000)) * 5 * 60_000 -
            5 * 60_000,
          playing: 10
        },
        {
          timestamp: Math.floor(Date.now() / (5 * 60_000)) * 5 * 60_000,
          playing: 12
        }
      ]
    });
    await flushContentMicrotasks();
    assert.equal(overlay.getAttribute("data-state"), "ready");
    assert.equal(
      fixture.hooks.getGameTileCcuGraphStateForTests().notTrackedRetryScheduled,
      false
    );
    assert.equal(fixture.timers.size, 0);
    assert.equal(
      fixture.hooks.mutationsAffectExtensionMount([
        { type: "childList", target: overlay, addedNodes: [], removedNodes: [] }
      ]),
      false,
      "graph paint mutations must not schedule a global extension remount"
    );

    fixture.document.dispatchEvent({
      type: "pointerout",
      target: card.label,
      relatedTarget: overlay
    });
    assert.equal(fixture.timers.size, 0, "crossing from trigger into popover is a hover bridge");
    assert.equal(
      fixture.hooks.getGameTileCcuGraphStateForTests().popoverHovered,
      true
    );
    const interaction = overlay.querySelector(".rsl-game-ccu-graph__interaction");
    fixture.document.dispatchEvent({
      type: "pointerover",
      target: interaction,
      relatedTarget: card.label
    });
    fixture.document.dispatchEvent({
      type: "pointerout",
      target: interaction,
      relatedTarget: null
    });
    assert.ok(overlay.isConnected, "pointer exit must use a close delay");
    assert.equal(fixture.timers.size, 1);
    const [closeTimerId, closeTimer] = Array.from(fixture.timers.entries())[0];
    assert.equal(closeTimer.delay, 140);
    fixture.timers.delete(closeTimerId);
    closeTimer.callback();
    assert.equal(
      fixture.document.querySelector("[data-rsl-game-ccu-graph-overlay]"),
      null
    );
    assert.notEqual(card.label.getAttribute("aria-expanded"), "true");
    assert.equal(
      card.label.getAttribute("aria-controls"),
      null,
      "closing must not leave a dangling relationship to the removed popover"
    );
    fixture.hooks.cleanupGameTileCcuFeature();
    assert.equal(card.label.isConnected, true, "cleanup must preserve an external/BTR CCU label");
    assert.equal(
      card.label.hasAttribute("data-rsl-game-ccu-graph-trigger"),
      true,
      "Player Counts cleanup must preserve the independent graph trigger"
    );
    assert.equal(
      card.label.getAttribute("tabindex"),
      "0",
      "Player Counts cleanup must preserve graph-owned keyboard access"
    );
    fixture.hooks.setFeatureSettingsForTests({
      version: 1,
      flags: { gameCcu: false, gameCcuHoverGraph: false }
    });
    fixture.hooks.mountGameTileCcuGraphTriggers();
    assert.equal(card.label.hasAttribute("data-rsl-game-ccu-graph-trigger"), false);
    assert.equal(card.label.hasAttribute("tabindex"), false, "graph cleanup removes owned tabindex");
  }

  {
    const fixture = loadContentCcuFixture();
    fixture.hooks.setFeatureSettingsForTests({
      version: 1,
      flags: { quickPlay: false, gameCcu: true }
    });
    const card = makeContentCcuGraphCard(fixture.document, "706", "9706");
    const bucketMs = 5 * 60_000;
    const currentBucket = Math.floor(Date.now() / bucketMs) * bucketMs;
    fixture.hooks.mountGameTileCcuGraphTriggers();
    fixture.hooks.openGameTileCcuGraph(card.label);
    fixture.calls[0].reply({
      ok: true,
      requestId: fixture.calls[0].message.requestId,
      universeId: "9706",
      tracked: true,
      points: [
        { timestamp: currentBucket - 2 * 24 * 60 * 60_000, playing: 400 },
        {
          timestamp: currentBucket - 2 * 24 * 60 * 60_000 + bucketMs,
          playing: 425
        }
      ]
    });
    await flushContentMicrotasks();
    const overlay = fixture.document.querySelector(
      "[data-rsl-game-ccu-graph-overlay]"
    );
    assert.equal(overlay?.getAttribute("data-state"), "no-history");
    assert.equal(
      fixture.hooks.getGameTileCcuGraphStateForTests().cachedUniverses,
      0,
      "two retained points outside 12 hours must not cache an empty visible graph"
    );
    assert.equal(
      fixture.hooks.getGameTileCcuGraphStateForTests().historyRetryScheduled,
      true,
      "a retained-only payload must retry for the next visible Chart observation"
    );
    assert.equal(fixture.timers.size, 1);
    const [retryTimerId, retryTimer] = Array.from(fixture.timers.entries())[0];
    fixture.timers.delete(retryTimerId);
    retryTimer.callback();
    await flushContentMicrotasks();
    assert.equal(
      fixture.calls.length,
      2,
      "the visible-window retry must request history again instead of reusing retained-only data"
    );
    fixture.hooks.cleanupGameTileCcuFeature();
  }

  {
    const fixture = loadContentCcuFixture();
    fixture.hooks.setFeatureSettingsForTests({
      version: 1,
      flags: { quickPlay: false, gameCcu: true }
    });
    const first = makeContentCcuGraphCard(fixture.document, "711", "9711");
    const second = makeContentCcuGraphCard(fixture.document, "712", "9712");
    fixture.hooks.mountGameTileCcuGraphTriggers();

    fixture.document.dispatchEvent({
      type: "pointerover",
      target: first.label,
      relatedTarget: null
    });
    const abandonedByLeave = Array.from(fixture.timers.values())[0];
    fixture.document.dispatchEvent({
      type: "pointerout",
      target: first.label,
      relatedTarget: null
    });
    assert.equal(fixture.timers.size, 0);
    assert.equal(
      fixture.hooks.getGameTileCcuGraphStateForTests().hoverIntentPending,
      false
    );
    abandonedByLeave.callback();
    assert.equal(fixture.calls.length, 0, "leaving before 100ms makes the stale callback inert");

    fixture.document.dispatchEvent({
      type: "pointerover",
      target: first.label,
      relatedTarget: null
    });
    const abandonedBySwitch = Array.from(fixture.timers.values())[0];
    fixture.document.dispatchEvent({
      type: "pointerover",
      target: second.label,
      relatedTarget: first.label
    });
    assert.equal(fixture.timers.size, 1, "switching cards replaces, not duplicates, hover intent");
    assert.equal(
      fixture.hooks.getGameTileCcuGraphStateForTests().hoverIntentPlaceId,
      "712"
    );
    abandonedBySwitch.callback();
    assert.equal(fixture.calls.length, 0);
    const [secondIntentId, secondIntent] = Array.from(fixture.timers.entries())[0];
    fixture.timers.delete(secondIntentId);
    secondIntent.callback();
    await flushContentMicrotasks();
    assert.equal(fixture.calls.length, 1);
    assert.equal(fixture.hooks.getGameTileCcuGraphStateForTests().placeId, "712");
    fixture.hooks.cleanupGameTileCcuFeature();

    const cleanupFixture = loadContentCcuFixture();
    cleanupFixture.hooks.setFeatureSettingsForTests({
      version: 1,
      flags: { quickPlay: false, gameCcu: true }
    });
    const cleanupCard = makeContentCcuGraphCard(
      cleanupFixture.document,
      "713",
      "9713"
    );
    cleanupFixture.hooks.mountGameTileCcuGraphTriggers();
    cleanupFixture.document.dispatchEvent({
      type: "pointerover",
      target: cleanupCard.label,
      relatedTarget: null
    });
    const abandonedByCleanup = Array.from(cleanupFixture.timers.values())[0];
    cleanupFixture.hooks.cleanupGameTileCcuFeature();
    assert.equal(
      cleanupFixture.timers.size,
      1,
      "Player Counts cleanup must preserve independent graph hover intent"
    );
    cleanupFixture.hooks.setFeatureSettingsForTests({
      version: 1,
      flags: { quickPlay: false, gameCcu: false, gameCcuHoverGraph: false }
    });
    cleanupFixture.hooks.mountGameTileCcuGraphTriggers();
    assert.equal(cleanupFixture.timers.size, 0);
    abandonedByCleanup.callback();
    assert.equal(cleanupFixture.calls.length, 0);
    assert.equal(
      cleanupFixture.document.querySelector("[data-rsl-game-ccu-graph-overlay]"),
      null,
      "graph cleanup must cancel a pending hover intent"
    );
  }

  {
    const fixture = loadContentCcuFixture({
      viewportWidth: 800,
      viewportHeight: 600
    });
    fixture.hooks.setFeatureSettingsForTests({
      version: 1,
      flags: { quickPlay: false, gameCcu: true }
    });
    const card = makeContentCcuGraphCard(fixture.document, "721", "9721");
    card.thumbnail.setFixtureRect({ left: 220, top: 80, width: 240, height: 135 });
    card.label.setFixtureRect({ left: 300, top: 240, width: 60, height: 20 });
    fixture.hooks.mountGameTileCcuGraphTriggers();
    const overlay = fixture.hooks.openGameTileCcuGraph(card.label);
    await flushContentMicrotasks();
    assert.equal(overlay.parentElement, fixture.document.body);
    assert.equal(overlay.getAttribute("data-placement"), "bottom");
    const nominalWidth = Number.parseFloat(overlay.style.width);
    const nominalHeight = Number.parseFloat(overlay.style["max-height"]);
    assert.equal(nominalWidth, 300);
    assert.equal(nominalHeight, 168);
    assert.equal(
      Number.parseFloat(overlay.style.top),
      80 + 135 + 3,
      "below placement must begin just after the thumbnail while floating over the card rows"
    );
    assert.equal(
      Number.parseFloat(overlay.style.left),
      220 + 240 / 2 - nominalWidth / 2,
      "the panel must center on the thumbnail rather than the much narrower CCU text"
    );
    assert.equal(
      fixture.hooks.getGameTileCcuGraphStateForTests().placement,
      "bottom"
    );

    card.thumbnail.setFixtureRect({ left: -100, top: 80, width: 100, height: 135 });
    card.label.setFixtureRect({ left: 60, top: 240, width: 40, height: 20 });
    fixture.hooks.positionGameTileCcuGraphPopover();
    assert.equal(overlay.style.left, "8px", "left placement must clamp to the viewport margin");
    card.thumbnail.setFixtureRect({ left: 750, top: 80, width: 100, height: 135 });
    card.label.setFixtureRect({ left: 600, top: 240, width: 20, height: 20 });
    fixture.hooks.positionGameTileCcuGraphPopover();
    assert.equal(
      overlay.style.left,
      `${800 - 8 - nominalWidth}px`,
      "right placement must clamp using the measured popover width"
    );
    card.thumbnail.setFixtureRect({ left: 300, top: 500, width: 200, height: 112 });
    card.label.setFixtureRect({ left: 380, top: 470, width: 40, height: 20 });
    fixture.hooks.positionGameTileCcuGraphPopover();
    assert.equal(overlay.getAttribute("data-placement"), "top");
    assert.equal(
      Number.parseFloat(overlay.style.top),
      500 - nominalHeight - 3,
      "above placement must sit just beyond the thumbnail's top edge"
    );

    overlay.setFixtureRect({ left: 240, top: 180, width: 320, height: 180 });
    fixture.document.dispatchEvent({
      type: "pointermove",
      target: fixture.document.body,
      clientX: 260,
      clientY: 200
    });
    assert.equal(overlay.hasAttribute("data-pointer-within"), true);
    assert.equal(
      fixture.hooks.getGameTileCcuGraphStateForTests().popoverHovered,
      true,
      "the click-through heading/background must stay open through geometry hover"
    );
    fixture.document.dispatchEvent({
      type: "pointermove",
      target: fixture.document.body,
      clientX: 20,
      clientY: 20
    });
    assert.equal(fixture.hooks.getGameTileCcuGraphStateForTests().closeScheduled, true);
    fixture.document.dispatchEvent({
      type: "pointermove",
      target: fixture.document.body,
      clientX: 260,
      clientY: 200
    });
    assert.equal(fixture.hooks.getGameTileCcuGraphStateForTests().closeScheduled, false);

    const replacement = makeContentCcuGraphCard(
      fixture.document,
      "721",
      "9721"
    );
    replacement.thumbnail.setFixtureRect({ left: 40, top: 60, width: 160, height: 90 });
    replacement.label.setFixtureRect({ left: 100, top: 100, width: 50, height: 20 });
    card.root.remove();
    fixture.hooks.mountGameTileCcuGraphTriggers();
    await flushContentMicrotasks();
    assert.equal(
      fixture.document.querySelector("[data-rsl-game-ccu-graph-overlay]"),
      overlay,
      "virtualized remount of the same identity must preserve the active popover"
    );
    assert.equal(overlay.style.left, "8px");
    assert.equal(
      overlay.style.top,
      "153px",
      "a rebound popover must follow the replacement thumbnail, not the stale metric rect"
    );
    assert.match(replacement.label.getAttribute("aria-describedby") || "", /rsl-game-ccu-graph/);

    replacement.root.remove();
    fixture.hooks.mountGameTileCcuGraphTriggers();
    assert.equal(
      fixture.document.querySelector("[data-rsl-game-ccu-graph-overlay]"),
      null,
      "route/card teardown without a same-identity replacement must close the popover"
    );
    fixture.hooks.cleanupGameTileCcuFeature();
  }

  {
    const fixture = loadContentCcuFixture({
      viewportWidth: 280,
      viewportHeight: 148
    });
    fixture.hooks.setFeatureSettingsForTests({
      version: 1,
      flags: { quickPlay: false, gameCcu: true }
    });
    const card = makeContentCcuGraphCard(fixture.document, "725", "9725");
    card.thumbnail.setFixtureRect({ left: 230, top: 80, width: 60, height: 60 });
    card.label.setFixtureRect({ left: 252, top: 120, width: 24, height: 20 });
    fixture.hooks.mountGameTileCcuGraphTriggers();
    const overlay = fixture.hooks.openGameTileCcuGraph(card.label);
    await flushContentMicrotasks();
    assert.equal(
      overlay.style.width,
      "264px",
      "a narrow viewport must reduce the nominal 300px popup to viewport width minus both margins"
    );
    assert.equal(overlay.style.left, "8px");
    assert.equal(overlay.style.top, "8px");
    assert.equal(
      overlay.style["max-height"],
      "132px",
      "a short viewport must reduce the popup height without violating either 8px margin"
    );
    assert.equal(overlay.getAttribute("data-placement"), "top");
    const right = Number.parseFloat(overlay.style.left) +
      Number.parseFloat(overlay.style.width);
    const bottom = Number.parseFloat(overlay.style.top) +
      Number.parseFloat(overlay.style["max-height"]);
    assert.equal(right, 272);
    assert.equal(bottom, 140);
    fixture.hooks.cleanupGameTileCcuFeature();
  }

  {
    const fixture = loadContentCcuFixture();
    fixture.hooks.setFeatureSettingsForTests({
      version: 1,
      flags: { quickPlay: false, gameCcu: true }
    });
    const card = makeContentCcuGraphCard(fixture.document, "731", "9731");
    const currentBucket = Math.floor(Date.now() / (5 * 60_000)) * 5 * 60_000;
    fixture.hooks.mountGameTileCcuGraphTriggers();
    let overlay = fixture.hooks.openGameTileCcuGraph(card.label);
    fixture.calls[0].reply({
      ok: true,
      requestId: fixture.calls[0].message.requestId,
      universeId: "9731",
      tracked: true,
      points: [
        { timestamp: currentBucket - 5 * 60_000, playing: 70 },
        { timestamp: currentBucket, playing: 73 }
      ]
    });
    await flushContentMicrotasks();
    const interaction = overlay.querySelector(".rsl-game-ccu-graph__interaction");
    interaction.focus();
    fixture.document.dispatchEvent({ type: "focusin", target: interaction });
    fixture.document.dispatchEvent({
      type: "pointerout",
      target: overlay,
      relatedTarget: null
    });
    assert.equal(
      fixture.hooks.getGameTileCcuGraphStateForTests().closeScheduled,
      false,
      "focus inside the interactive plot must outlive pointer exit"
    );
    fixture.document.dispatchEvent({
      type: "keydown",
      key: "Escape",
      target: interaction
    });
    assert.equal(
      fixture.document.querySelector("[data-rsl-game-ccu-graph-overlay]"),
      null,
      "Escape must close a focused popover immediately"
    );
    assert.equal(
      fixture.document.activeElement,
      card.label,
      "Escape must return keyboard focus to the control that opened the graph"
    );

    fixture.document.activeElement = null;
    overlay = fixture.hooks.openGameTileCcuGraph(card.label);
    await flushContentMicrotasks();
    assert.ok(overlay?.isConnected);
    fixture.document.dispatchEvent({
      type: "click",
      target: fixture.document.body
    });
    assert.equal(
      fixture.document.querySelector("[data-rsl-game-ccu-graph-overlay]"),
      null,
      "an outside click must dismiss the unpinned popover"
    );
    fixture.hooks.cleanupGameTileCcuFeature();
  }

  {
    const fixture = loadContentCcuFixture();
    fixture.hooks.setFeatureSettingsForTests({
      version: 1,
      flags: { quickPlay: false, gameCcu: true }
    });
    const card = makeContentCcuGraphCard(fixture.document, "702", "9702");
    fixture.hooks.mountGameTileCcuGraphTriggers();
    fixture.hooks.openGameTileCcuGraph(card.label);
    fixture.calls[0].reply({
      ok: true,
      requestId: fixture.calls[0].message.requestId,
      universeId: "9702",
      tracked: false,
      points: []
    });
    await flushContentMicrotasks();
    assert.equal(fixture.timers.size, 1);
    const staleRetry = Array.from(fixture.timers.values())[0].callback;
    const staleOverlay = fixture.document.querySelector(
      "[data-rsl-game-ccu-graph-overlay]"
    );

    card.link.setAttribute("href", "/games/703/recycled?universeId=9703");
    fixture.hooks.mountGameTileCcuGraphTriggers();
    assert.equal(
      fixture.document.querySelector("[data-rsl-game-ccu-graph-overlay]"),
      null,
      "recycling the card must close its not-tracked overlay"
    );
    assert.equal(fixture.timers.size, 0, "closing a recycled card clears its retry");
    staleRetry();
    await flushContentMicrotasks();
    assert.equal(fixture.calls.length, 1, "a cleared stale callback must not requery");
    assert.equal(staleOverlay.isConnected, false);
    fixture.hooks.cleanupGameTileCcuFeature();
  }

  {
    const fixture = loadContentCcuFixture();
    fixture.hooks.setFeatureSettingsForTests({
      version: 1,
      flags: { quickPlay: true, gameCcu: true }
    });
    const card = makeContentCcuGraphCard(fixture.document, "702", "9702");
    const currentBucket = Math.floor(Date.now() / (5 * 60_000)) * 5 * 60_000;
    card.link.append(card.metadata);
    card.link.setAttribute("aria-describedby", "native-description");
    fixture.hooks.mountGameTileCcuGraphTriggers();
    assert.equal(
      card.label.hasAttribute("tabindex"),
      false,
      "a CCU metric inside the existing card link must not add a nested tab stop"
    );
    const clickEvent = {
      type: "click",
      target: card.label,
      defaultPrevented: false
    };
    fixture.document.dispatchEvent(clickEvent);
    assert.equal(
      clickEvent.defaultPrevented,
      false,
      "clicking a linked CCU metric must remain native navigation, not graph pinning"
    );

    fixture.document.activeElement = card.link;
    fixture.document.dispatchEvent({ type: "focusin", target: card.link });
    const overlay = fixture.document.querySelector("[data-rsl-game-ccu-graph-overlay]");
    assert.ok(overlay, "card-link focus must expose the body-level popover immediately");
    assert.equal(fixture.calls.length, 1);
    fixture.calls[0].reply({
      ok: true,
      requestId: fixture.calls[0].message.requestId,
      universeId: "9702",
      tracked: true,
      points: [{ timestamp: currentBucket - 5 * 60_000, playing: 12 }]
    });
    await flushContentMicrotasks();
    assert.equal(overlay.getAttribute("data-state"), "collecting");
    assert.ok(overlay.querySelector(".rsl-game-ccu-graph__chart"));
    assert.ok(overlay.querySelector(".rsl-game-ccu-graph__isolated-point"));
    assert.equal(
      overlay.querySelector(".rsl-game-ccu-graph__state"),
      null,
      "one real observation must use the timeline rather than a centered collecting state"
    );
    assert.equal(
      fixture.hooks.getGameTileCcuGraphStateForTests().cachedUniverses,
      1,
      "a valid singleton may be cached while its follow-up must still bypass that cache"
    );
    assert.equal(
      fixture.hooks.getGameTileCcuGraphStateForTests().historyRetryScheduled,
      true
    );
    assert.ok(fixture.hooks.getGameTileCcuGraphStateForTests().historyRetryDueAt > 0);
    assert.equal(fixture.timers.size, 1);
    fixture.document.dispatchEvent({ type: "focusin", target: card.link });
    assert.equal(fixture.calls.length, 1);
    assert.equal(fixture.timers.size, 1, "repeated focus must reuse the singleton retry");
    const [retryTimerId, retryTimer] = Array.from(fixture.timers.entries())[0];
    fixture.timers.delete(retryTimerId);
    retryTimer.callback();
    await flushContentMicrotasks();
    assert.equal(
      fixture.calls.length,
      2,
      "the singleton follow-up must bypass its otherwise valid history cache"
    );
    fixture.calls[1].reply({
      ok: true,
      requestId: fixture.calls[1].message.requestId,
      universeId: "9702",
      tracked: true,
      points: [
        { timestamp: currentBucket - 5 * 60_000, playing: 12 },
        { timestamp: currentBucket, playing: 15 }
      ]
    });
    await flushContentMicrotasks();
    assert.equal(overlay.getAttribute("data-state"), "ready");
    assert.equal(
      fixture.hooks.getGameTileCcuGraphStateForTests().historyRetryScheduled,
      false
    );
    assert.equal(fixture.timers.size, 0);
    fixture.hooks.cleanupGameTileCcuFeature();
    assert.equal(
      card.link.getAttribute("aria-describedby"),
      "native-description rsl-game-ccu-graph-9702",
      "Player Counts cleanup must preserve the independent graph description"
    );
    fixture.hooks.setFeatureSettingsForTests({
      version: 1,
      flags: { gameCcu: false, gameCcuHoverGraph: false }
    });
    fixture.hooks.mountGameTileCcuGraphTriggers();
    assert.equal(card.link.getAttribute("aria-describedby"), "native-description");
  }

  {
    const fixture = loadContentCcuFixture();
    fixture.hooks.setFeatureSettingsForTests({
      version: 1,
      flags: { quickPlay: false, gameCcu: true }
    });
    const card = makeContentCcuGraphCard(fixture.document, "704", "9704");
    const currentBucket = Math.floor(Date.now() / (5 * 60_000)) * 5 * 60_000;
    fixture.hooks.mountGameTileCcuGraphTriggers();
    fixture.hooks.openGameTileCcuGraph(card.label);
    fixture.calls[0].reply({
      ok: true,
      requestId: fixture.calls[0].message.requestId,
      universeId: "9704",
      tracked: true,
      points: [{ timestamp: currentBucket, playing: 20 }]
    });
    await flushContentMicrotasks();
    assert.equal(fixture.timers.size, 1);
    const recycledRetry = Array.from(fixture.timers.values())[0].callback;
    card.link.setAttribute("href", "/games/705/recycled?universeId=9705");
    fixture.hooks.mountGameTileCcuGraphTriggers();
    assert.equal(fixture.timers.size, 0);
    recycledRetry();
    await flushContentMicrotasks();
    assert.equal(
      fixture.calls.length,
      1,
      "a recycled singleton card must make its cleared follow-up callback inert"
    );
    assert.equal(
      fixture.document.querySelector("[data-rsl-game-ccu-graph-overlay]"),
      null
    );
    fixture.hooks.cleanupGameTileCcuFeature();
  }

  {
    const fixture = loadContentCcuFixture();
    const bucketMs = 5 * 60_000;
    const currentBucket = Math.floor(Date.now() / bucketMs) * bucketMs;
    const retentionBaseTimestamp = currentBucket - 7 * 24 * 60 * 60_000;
    const baseTimestamp = currentBucket - 60 * 60_000;
    const points = Array.from({ length: 2_016 }, (_, index) => ({
      timestamp: retentionBaseTimestamp + index * bucketMs,
      playing: index % 31 === 0 ? 50_000 : 1_000 + index
    }));
    const normalized = fixture.hooks.normalizeGameTileCcuHistoryPoints([
      { timestamp: retentionBaseTimestamp, playing: 1 },
      { timestamp: retentionBaseTimestamp, playing: 2 },
      ...points,
      { timestamp: -1, playing: 9 }
    ]);
    assert.equal(normalized.length, 2_016, "the UI must retain at most seven days of 5m points");
    const sampled = fixture.hooks.downsampleGameTileCcuGraphPoints(normalized);
    assert.ok(sampled.length <= 144, "rendering must apply the bounded visual sample cap");
    assert.equal(sampled[0].timestamp, normalized[0].timestamp);
    assert.equal(sampled.at(-1).timestamp, normalized.at(-1).timestamp);
    assert.equal(
      sampled.some((point) => point.playing === 50_000),
      true,
      "visual sampling must retain bucket extrema"
    );
    const denseOverlay = fixture.document.createElement("div");
    fixture.hooks.renderGameTileCcuGraph(
      denseOverlay,
      normalized,
      currentBucket
    );
    const densePlot = denseOverlay.querySelector(".rsl-game-ccu-graph__plot");
    assert.equal(
      denseOverlay.hasAttribute("data-marker-mode"),
      false,
      "dense history must not enable a per-observation marker mode"
    );
    assert.equal(
      denseOverlay.querySelector(".rsl-game-ccu-graph__observation-points"),
      null,
      "the graph must not turn a retained history payload into thousands of point markers"
    );
    assert.equal(
      densePlot.querySelectorAll("circle").length,
      0,
      "dense saved history must not reintroduce an endpoint cursor circle"
    );
    assert.ok(
      densePlot.children.length <= 10,
      "dense history should remain a bounded set of aggregate SVG paths"
    );
    assert.equal(
      denseOverlay.querySelector(".rsl-game-ccu-graph__latest-point"),
      null,
      "the graph line itself must be the only persistent series indicator"
    );

    const longSegment = Array.from({ length: 200 }, (_, index) => ({
      timestamp: baseTimestamp + index * 5 * 60_000,
      playing: 10_000 + index
    }));
    const resumedSegment = [
      {
        timestamp: longSegment.at(-1).timestamp + 15 * 60_000,
        playing: 25_000
      },
      {
        timestamp: longSegment.at(-1).timestamp + 20 * 60_000,
        playing: 25_100
      }
    ];
    const segmentSafeSample = fixture.hooks.downsampleGameTileCcuGraphSegments(
      [...longSegment, ...resumedSegment],
      [longSegment, resumedSegment],
      16
    );
    assert.equal(
      segmentSafeSample.includes(resumedSegment[0]) &&
        segmentSafeSample.includes(resumedSegment[1]),
      true,
      "downsampling must retain both ends of a short post-gap segment"
    );

    const cadencePoints = [
      { timestamp: currentBucket - 10 * 60_000, playing: 100 },
      { timestamp: currentBucket - 5 * 60_000, playing: 110 },
      { timestamp: currentBucket, playing: 120 }
    ];
    const cadenceOverlay = fixture.document.createElement("div");
    fixture.hooks.renderGameTileCcuGraph(cadenceOverlay, cadencePoints, currentBucket);
    const cadenceAxis = fixture.hooks.getGameTileCcuGraphAxisModel(
      cadencePoints,
      currentBucket
    );
    const cadenceAxes = assertSemanticGameCcuGraphAxes(
      cadenceOverlay,
      "data-aligned guide graph"
    );
    assert.deepEqual(
      cadenceAxes.yLabels,
      Array.from(cadenceAxis.yTicks, (tick) => tick.label),
      "the visible Y labels must come from the same axis model as the guides"
    );
    const cadenceTickSteps = cadenceAxis.yTicks.slice(1).map(
      (tick, index) => cadenceAxis.yTicks[index].value - tick.value
    );
    assert.ok(cadenceTickSteps[0] > 0);
    assert.equal(
      cadenceTickSteps.every((step) => step === cadenceTickSteps[0]),
      true,
      "the five meaningful CCU labels must use one consistent nice step"
    );
    const stepMagnitude = 10 ** Math.floor(Math.log10(cadenceTickSteps[0]));
    const normalizedStep = cadenceTickSteps[0] / stepMagnitude;
    assert.equal(
      [1, 2, 2.5, 5, 10].some(
        (niceStep) => Math.abs(normalizedStep - niceStep) < 1e-9
      ),
      true,
      "Y-axis intervals must use a readable nice-number ladder"
    );
    const gridPath = cadenceOverlay.querySelector(".rsl-game-ccu-graph__grid")
      ?.getAttribute("d")?.trim();
    const guidePattern = /M(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+H(-?\d+(?:\.\d+)?)/g;
    const guides = Array.from((gridPath || "").matchAll(guidePattern)).map(
      (match) => ({ left: Number(match[1]), y: Number(match[2]), right: Number(match[3]) })
    );
    assert.equal(guides.length, cadenceAxis.yTicks.length);
    assert.equal(guides.length, 5, "five displayed CCU values need five aligned guides");
    assert.equal(
      guides.every((guide) => guide.left === 8 && guide.right === 292),
      true,
      "every guide must span the same plot bounds"
    );
    const expectedGuideYs = cadenceAxis.yTicks.map((tick) =>
      6 + (1 - (tick.value - cadenceAxis.minimum) /
        Math.max(1, cadenceAxis.maximum - cadenceAxis.minimum)) * 88
    );
    assert.equal(
      guides.every((guide, index) =>
        Math.abs(guide.y - expectedGuideYs[index]) <= 0.011
      ),
      true,
      "every horizontal guide must derive from its displayed Y-axis CCU value"
    );
    assert.equal(
      (gridPath || "").replace(guidePattern, "").trim(),
      "",
      "the grid path must not contain decorative or offset commands"
    );
    assert.doesNotMatch(gridPath || "", /\bV/i, "the plot must not draw a vertical guide");
    const cadenceLine = getDirectionalGraphPathData(cadenceOverlay);
    assert.equal(
      (cadenceLine.match(/M/g) || []).length,
      1,
      "adjacent edges with the same trend must share one maximal directional run"
    );
    assert.equal((cadenceLine.match(/L/g) || []).length, 2);
    assert.equal(cadenceOverlay.getAttribute("data-gap-count"), "1");
    assert.ok(cadenceOverlay.querySelector(".rsl-game-ccu-graph__gap-band"));
    assert.deepEqual(
      JSON.parse(JSON.stringify(
        fixture.hooks.getGameTileCcuGraphGapIntervals(
          cadencePoints,
          cadencePoints[0].timestamp,
          cadencePoints.at(-1).timestamp
        )
      )),
      []
    );

    const completeWindowOverlay = fixture.document.createElement("div");
    const completeWindowPoints = Array.from({ length: 145 }, (_, index) => ({
      timestamp: currentBucket - (144 - index) * bucketMs,
      playing: 1_000 + index
    }));
    fixture.hooks.renderGameTileCcuGraph(
      completeWindowOverlay,
      completeWindowPoints,
      currentBucket
    );
    assert.equal(completeWindowOverlay.getAttribute("data-state"), "ready");
    assert.equal(completeWindowOverlay.getAttribute("data-gap-count"), "0");
    assertMetadataOnlyGraphFooter(completeWindowOverlay, {
      expectFreshness: true,
      message: "ready graph with a complete saved window"
    });

    const missedBucketPoints = [
      { timestamp: baseTimestamp, playing: 100 },
      { timestamp: baseTimestamp + 5 * 60_000, playing: 110 },
      { timestamp: baseTimestamp + 15 * 60_000, playing: 120 },
      { timestamp: baseTimestamp + 20 * 60_000, playing: 130 }
    ];
    const toleratedOverlay = fixture.document.createElement("div");
    fixture.hooks.renderGameTileCcuGraph(
      toleratedOverlay,
      missedBucketPoints,
      currentBucket
    );
    const toleratedLine = getDirectionalGraphPathData(toleratedOverlay);
    assert.equal((toleratedLine.match(/M/g) || []).length, 2);
    assert.equal((toleratedLine.match(/L/g) || []).length, 2);
    assert.equal(
      toleratedOverlay.getAttribute("data-gap-count"),
      "3",
      "the fixed window includes leading, missed-bucket, and trailing no-data ranges"
    );
    assert.ok(toleratedOverlay.querySelector(".rsl-game-ccu-graph__gap-band"));
    assert.equal(
      fixture.hooks.getGameTileCcuGraphGapIntervals(
        missedBucketPoints,
        missedBucketPoints[0].timestamp,
        missedBucketPoints.at(-1).timestamp
      ).length,
      1,
      "a ten-minute separation represents one missed five-minute observation"
    );

    const oneGapPoints = [
      { timestamp: baseTimestamp, playing: 100 },
      { timestamp: baseTimestamp + 5 * 60_000, playing: 100 },
      { timestamp: baseTimestamp + 20 * 60_000, playing: 900 },
      { timestamp: baseTimestamp + 25 * 60_000, playing: 900 }
    ];
    const oneGapOverlay = fixture.document.createElement("div");
    fixture.hooks.renderGameTileCcuGraph(oneGapOverlay, oneGapPoints, currentBucket);
    assert.equal(oneGapOverlay.getAttribute("data-state"), "ready");
    assert.equal(
      oneGapOverlay.getAttribute("data-gap-count"),
      "3",
      "one internal gap remains separate from the leading and trailing window gaps"
    );
    const oneGapBand = oneGapOverlay.querySelector(
      ".rsl-game-ccu-graph__gap-band"
    );
    assert.ok(oneGapBand?.getAttribute("d"), "a missed bucket needs a hatched no-data band");
    const oneGapPattern = oneGapOverlay.querySelector(
      ".rsl-game-ccu-graph__gap-pattern"
    );
    const oneGapPatternId = oneGapPattern?.getAttribute("id") || "";
    assert.match(oneGapPatternId, /^rsl-game-ccu-gap-\d+$/);
    assert.equal(
      oneGapPattern?.getAttribute("patternUnits"),
      "userSpaceOnUse",
      "the hatch must keep a stable visual scale when the graph stretches"
    );
    const patternWidth = Number(oneGapPattern?.getAttribute("width"));
    const patternHeight = Number(oneGapPattern?.getAttribute("height"));
    assert.ok(
      patternWidth >= 4 && patternWidth <= 16 &&
        patternHeight >= 4 && patternHeight <= 16,
      "the hatch cell must remain compact enough to read as a region"
    );
    const oneGapPatternBase = oneGapPattern?.querySelector(
      ".rsl-game-ccu-graph__gap-pattern-base"
    );
    const oneGapPatternStripe = oneGapPattern?.querySelector(
      ".rsl-game-ccu-graph__gap-pattern-stripe"
    );
    assert.ok(oneGapPatternBase, "the hatch needs a full-region base tint");
    const stripeCommands = Array.from(
      (oneGapPatternStripe?.getAttribute("d") || "").matchAll(
        /[ML](-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g
      ),
      (match) => ({ x: Number(match[1]), y: Number(match[2]) })
    );
    assert.ok(
      stripeCommands.some((point, index) => index > 0 &&
        point.x !== stripeCommands[index - 1].x &&
        point.y !== stripeCommands[index - 1].y),
      "the SVG hatch must be diagonal so it cannot resemble a time or CCU guide"
    );
    assert.equal(
      oneGapBand?.getAttribute("fill"),
      `url(#${oneGapPatternId})`,
      "the no-data band must use its overlay-local hatch"
    );
    assert.equal(
      oneGapOverlay.querySelectorAll(".rsl-game-ccu-graph__gap-pattern").length,
      1,
      "one graph needs exactly one shared hatch definition"
    );
    assert.equal(
      oneGapOverlay.querySelector(".rsl-game-ccu-graph__gap-boundary"),
      null,
      "no-data hatching must not introduce offset-looking boundary lines"
    );
    const oneGapLine = getDirectionalGraphPathData(oneGapOverlay);
    const lineCommands = Array.from(oneGapLine.matchAll(
      /([ML])(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g
    )).map((match) => ({
      command: match[1],
      x: Number(match[2]),
      y: Number(match[3])
    }));
    assert.deepEqual(
      lineCommands.map((command) => command.command),
      ["M", "L", "M", "L"],
      "a fifteen-minute separation must restart, never bridge, the directional series"
    );
    assert.equal(
      oneGapOverlay.querySelector(".rsl-game-ccu-graph__observation-points"),
      null,
      "sparse histories should not add a second layer of point-marker clutter"
    );
    assert.equal(
      lineCommands[2].y,
      lineCommands[3].y,
      "the resumed segment must begin at the fresh post-gap CCU value"
    );
    assert.notEqual(lineCommands[2].y, lineCommands[1].y);
    assert.equal(
      oneGapOverlay.querySelector(".rsl-game-ccu-graph__latest-point"),
      null,
      "an internal-gap graph must end with its real line rather than a cursor dot"
    );
    const oneGapIntervals = fixture.hooks.getGameTileCcuGraphGapIntervals(
      oneGapPoints,
      oneGapPoints[0].timestamp,
      oneGapPoints.at(-1).timestamp
    );
    assert.equal(oneGapIntervals.length, 1);
    assert.equal(oneGapIntervals[0].trailing, false);
    assert.equal(
      oneGapIntervals[0].start,
      baseTimestamp + 7.5 * 60_000,
      "the band begins halfway after the last stored observation"
    );
    assert.equal(
      oneGapIntervals[0].end,
      baseTimestamp + 17.5 * 60_000,
      "the band ends halfway before the resumed observation"
    );
    assertMetadataOnlyGraphFooter(oneGapOverlay, {
      expectFreshness: true,
      message: "ready graph with internal and window gaps"
    });
    assert.match(
      oneGapOverlay.getAttribute("aria-label"),
      /contains \d+ marked no-data intervals? where no Chart observation was stored/i
    );
    assert.doesNotMatch(
      oneGapOverlay.getAttribute("aria-label"),
      /\b(?:amber|blue|green|red)\b/i,
      "the graph description must explain missing data without color-only language"
    );
    const oneGapSvgChildren = oneGapOverlay
      .querySelector(".rsl-game-ccu-graph__plot").children;
    const oneGapDefinitions = oneGapOverlay.querySelector("defs");
    const oneGapGrid = oneGapOverlay.querySelector(
      ".rsl-game-ccu-graph__grid"
    );
    assert.ok(
      oneGapSvgChildren.indexOf(oneGapDefinitions) <
        oneGapSvgChildren.indexOf(oneGapBand) &&
        oneGapSvgChildren.indexOf(oneGapBand) <
          oneGapSvgChildren.indexOf(oneGapGrid),
      "the local hatch definition and no-data band must paint beneath guides and observations"
    );
    assert.ok(
      oneGapSvgChildren.indexOf(oneGapBand) <
        oneGapSvgChildren.indexOf(
          oneGapOverlay.querySelector(".rsl-game-ccu-graph__line")
        ),
      "the no-data band must paint behind the directional series"
    );

    const multipleGapPoints = [
      { timestamp: baseTimestamp, playing: 100 },
      { timestamp: baseTimestamp + 5 * 60_000, playing: 110 },
      { timestamp: baseTimestamp + 20 * 60_000, playing: 500 },
      { timestamp: baseTimestamp + 25 * 60_000, playing: 510 },
      { timestamp: baseTimestamp + 40 * 60_000, playing: 800 },
      { timestamp: baseTimestamp + 45 * 60_000, playing: 810 }
    ];
    const multipleGapOverlay = fixture.document.createElement("div");
    fixture.hooks.renderGameTileCcuGraph(
      multipleGapOverlay,
      multipleGapPoints,
      currentBucket
    );
    const multipleGapPatternId = multipleGapOverlay.querySelector(
      ".rsl-game-ccu-graph__gap-pattern"
    )?.getAttribute("id") || "";
    assert.notEqual(
      multipleGapPatternId,
      oneGapPatternId,
      "each graph overlay needs a unique SVG pattern identifier"
    );
    const multipleGapLine = getDirectionalGraphPathData(multipleGapOverlay);
    assert.equal((multipleGapLine.match(/M/g) || []).length, 3);
    assert.equal(
      multipleGapOverlay.getAttribute("data-gap-count"),
      "4",
      "two internal gaps remain separate from the fixed window's leading and trailing gaps"
    );
    assert.equal(
      multipleGapOverlay.querySelectorAll(".rsl-game-ccu-graph__gap-band").length,
      1,
      "multiple missing ranges should share one noninteractive SVG band path"
    );
    assert.equal(
      (multipleGapOverlay.querySelector(".rsl-game-ccu-graph__gap-band")
        ?.getAttribute("d").match(/M/g) || []).length,
      4
    );
    assert.equal(
      fixture.hooks.getGameTileCcuGraphGapIntervals(
        multipleGapPoints,
        multipleGapPoints[0].timestamp,
        multipleGapPoints.at(-1).timestamp
      ).length,
      2
    );

    const directionalPoints = [
      { timestamp: baseTimestamp, playing: 100 },
      { timestamp: baseTimestamp + 5 * 60_000, playing: 130 },
      { timestamp: baseTimestamp + 10 * 60_000, playing: 90 },
      { timestamp: baseTimestamp + 15 * 60_000, playing: 90 },
      { timestamp: baseTimestamp + 20 * 60_000, playing: 120 }
    ];
    const directionalOverlay = fixture.document.createElement("div");
    fixture.hooks.renderGameTileCcuGraph(
      directionalOverlay,
      directionalPoints
    );
    const directionalLines = getDirectionalGraphLines(directionalOverlay);
    const directionalEdges = getDirectionalGraphEdges(directionalOverlay);
    assert.deepEqual(
      directionalLines.map((path) => path.getAttribute("data-trend")).sort(),
      ["down", "flat", "up"],
      "rising, falling, and unchanged real edges need distinct semantic paths"
    );
    assert.deepEqual(
      directionalEdges.reduce((counts, edge) => {
        counts[edge.trend] += 1;
        return counts;
      }, { up: 0, down: 0, flat: 0 }),
      { up: 2, down: 1, flat: 1 }
    );
    assert.equal(
      (getDirectionalGraphPathData(directionalOverlay).match(/M/g) || []).length,
      4,
      "each reversal must begin a new same-trend run while preserving every raw edge"
    );
    assert.ok(
      directionalOverlay.querySelector(".rsl-game-ccu-graph__area"),
      "twenty minutes spans enough of a 12-hour plot to retain the neutral area"
    );
    assert.equal(
      directionalEdges.length,
      directionalPoints.length - 1,
      "area rendering must preserve every exact real-observation edge"
    );
    assert.equal(
      directionalOverlay.querySelector(".rsl-game-ccu-graph__latest-point"),
      null,
      "directional lines must not add a separate endpoint cursor"
    );
    assert.equal(directionalOverlay.getAttribute("data-latest-trend"), "up");
    assert.match(
      directionalOverlay.getAttribute("aria-label"),
      /latest stored change increased by 30 players/i,
      "screen readers need an explicit trend independent of the green stroke"
    );
    assert.doesNotMatch(
      directionalOverlay.getAttribute("aria-label"),
      /\b(?:green|red|gr[ae]y)\b/i,
      "directional meaning must not depend on naming a color"
    );

    for (const latestCase of [
      {
        values: [40, 70, 50],
        trend: "down",
        accessible: /latest stored change decreased by 20 players/i
      },
      {
        values: [40, 50, 50],
        trend: "flat",
        accessible: /latest stored change was unchanged/i
      }
    ]) {
      const caseOverlay = fixture.document.createElement("div");
      fixture.hooks.renderGameTileCcuGraph(
        caseOverlay,
        latestCase.values.map((playing, index) => ({
          timestamp: baseTimestamp + index * 5 * 60_000,
          playing
        }))
      );
      assert.equal(caseOverlay.getAttribute("data-latest-trend"), latestCase.trend);
      assert.equal(
        caseOverlay.querySelector(".rsl-game-ccu-graph__latest-point"),
        null,
        "trend changes must remain on the line and summary, not an endpoint dot"
      );
      assert.match(caseOverlay.getAttribute("aria-label"), latestCase.accessible);
    }

    for (const percentCase of [
      {
        values: [100, 125],
        trend: "up",
        text: "+25%",
        exactCounts: /Baseline stored observation: 100 players\. Latest stored observation: 125 players\. Elapsed time between stored observations: 5 minutes\./i
      },
      {
        values: [200, 150],
        trend: "down",
        text: "\u221225%",
        exactCounts: /Baseline stored observation: 200 players\. Latest stored observation: 150 players\. Elapsed time between stored observations: 5 minutes\./i
      },
      {
        values: [77, 77],
        trend: "flat",
        text: "0%",
        exactCounts: /Baseline stored observation: 77 players\. Latest stored observation: 77 players\. Elapsed time between stored observations: 5 minutes\./i
      }
    ]) {
      const percentOverlay = fixture.document.createElement("div");
      fixture.hooks.renderGameTileCcuGraph(
        percentOverlay,
        percentCase.values.map((playing, index) => ({
          timestamp: baseTimestamp + index * 5 * 60_000,
          playing
        }))
      );
      const latestChange = percentOverlay.querySelector(
        ".rsl-game-ccu-graph__latest-change"
      );
      assert.equal(latestChange?.textContent, percentCase.text);
      assert.equal(latestChange?.getAttribute("data-trend"), percentCase.trend);
      assert.match(latestChange?.getAttribute("aria-label") || "", percentCase.exactCounts);
      assert.equal(latestChange?.title, latestChange?.getAttribute("aria-label"));
      const changePeriod = percentOverlay.querySelector(
        ".rsl-game-ccu-graph__change-period"
      );
      assert.match(
        changePeriod?.textContent || "",
        /(?:over|across|during|in)\s+5\s*(?:m|min)/i,
        "a visible percentage must state the elapsed period it summarizes in plain language"
      );
      assert.match(
        changePeriod?.getAttribute("aria-label") || "",
        /(?:percentage )?change (?:covers|spans|is measured over) 5 minutes/i,
        "the compact change period needs a fully worded accessible explanation"
      );
      assert.match(
        percentOverlay.querySelector(".rsl-game-ccu-graph__change-label")
          ?.textContent || "",
        /^Change:?$/i,
        "the percentage must be explicitly labeled instead of appearing as an unexplained number"
      );
      const changeSummary = percentOverlay.querySelector(
        ".rsl-game-ccu-graph__change-summary"
      );
      assert.equal(
        changeSummary?.contains(latestChange),
        true,
        "the labeled change summary must own the exact percentage"
      );
      assert.equal(
        changeSummary?.contains(changePeriod),
        true,
        "the labeled change summary must keep its comparison period attached"
      );
      assert.doesNotMatch(
        changeSummary?.textContent || "",
        /\b(?:live|current|right now)\b/i,
        "a saved directional run must not be described as a live change"
      );
      assert.doesNotMatch(
        latestChange?.getAttribute("aria-label") || "",
        /\b(?:green|red|gr[ae]y)\b/i,
        "the exact percentage and counts must communicate direction without color"
      );
    }

    const zeroBaselineOverlay = fixture.document.createElement("div");
    fixture.hooks.renderGameTileCcuGraph(zeroBaselineOverlay, [
      { timestamp: baseTimestamp, playing: 0 },
      { timestamp: baseTimestamp + 5 * 60_000, playing: 5 }
    ]);
    const zeroBaselineChange = zeroBaselineOverlay.querySelector(
      ".rsl-game-ccu-graph__latest-change"
    );
    assert.equal(zeroBaselineChange?.textContent, "\u2014");
    assert.equal(zeroBaselineChange?.getAttribute("data-trend"), "neutral");
    assert.match(
      zeroBaselineChange?.getAttribute("aria-label") || "",
      /Baseline stored observation: 0 players\. Latest stored observation: 5 players\. Elapsed time between stored observations: 5 minutes\./i
    );
    assert.match(
      zeroBaselineChange?.getAttribute("aria-label") || "",
      /unavailable because the baseline count was zero/i
    );
    assert.doesNotMatch(
      `${zeroBaselineChange?.textContent} ${zeroBaselineChange?.title}`,
      /Infinity|NaN/i
    );

    const zeroFlatOverlay = fixture.document.createElement("div");
    fixture.hooks.renderGameTileCcuGraph(zeroFlatOverlay, [
      { timestamp: baseTimestamp, playing: 0 },
      { timestamp: baseTimestamp + 5 * 60_000, playing: 0 }
    ]);
    assert.equal(
      zeroFlatOverlay.querySelector(".rsl-game-ccu-graph__latest-change")
        ?.textContent,
      "0%",
      "zero to zero is a safe, explicitly flat percentage"
    );

    const tinyChangeOverlay = fixture.document.createElement("div");
    fixture.hooks.renderGameTileCcuGraph(tinyChangeOverlay, [
      { timestamp: baseTimestamp, playing: 1_000_000 },
      { timestamp: baseTimestamp + 5 * 60_000, playing: 1_000_001 }
    ]);
    const tinyChange = tinyChangeOverlay.querySelector(
      ".rsl-game-ccu-graph__latest-change"
    );
    assert.equal(tinyChange?.textContent, "+<0.01%");
    assert.notEqual(tinyChange?.textContent, "+0%");
    assert.match(
      tinyChange?.getAttribute("aria-label") || "",
      /Baseline stored observation: 1\.000\.000 players\. Latest stored observation: 1\.000\.001 players\. Elapsed time between stored observations: 5 minutes\./i
    );

    const risingRunPoints = [
      { timestamp: baseTimestamp, playing: 100 },
      { timestamp: baseTimestamp + 5 * 60_000, playing: 105 },
      { timestamp: baseTimestamp + 10 * 60_000, playing: 110 }
    ];
    const risingRunOverlay = fixture.document.createElement("div");
    fixture.hooks.renderGameTileCcuGraph(risingRunOverlay, risingRunPoints);
    const risingRunChange = risingRunOverlay.querySelector(
      ".rsl-game-ccu-graph__latest-change"
    );
    assert.equal(risingRunChange?.textContent, "+10%");
    assert.equal(risingRunChange?.getAttribute("data-trend"), "up");
    assert.match(
      risingRunChange?.getAttribute("aria-label") || "",
      /Baseline stored observation: 100 players\. Latest stored observation: 110 players\. Elapsed time between stored observations: 10 minutes\. Change across the latest uninterrupted rising sequence of stored observations: \+10%\./i
    );
    assert.match(
      risingRunOverlay.getAttribute("aria-label") || "",
      /Baseline stored observation: 100 players[\s\S]*Elapsed time between stored observations: 10 minutes/i,
      "the graph description must expose the same exact run baseline and duration"
    );

    const turningPointPoints = [
      { timestamp: baseTimestamp, playing: 100 },
      { timestamp: baseTimestamp + 5 * 60_000, playing: 120 },
      { timestamp: baseTimestamp + 10 * 60_000, playing: 110 }
    ];
    const turningPointOverlay = fixture.document.createElement("div");
    fixture.hooks.renderGameTileCcuGraph(turningPointOverlay, turningPointPoints);
    const turningPointChange = turningPointOverlay.querySelector(
      ".rsl-game-ccu-graph__latest-change"
    );
    assert.equal(turningPointChange?.textContent, "\u22128.3%");
    assert.equal(turningPointChange?.getAttribute("data-trend"), "down");
    assert.match(
      turningPointChange?.getAttribute("aria-label") || "",
      /Baseline stored observation: 120 players\. Latest stored observation: 110 players\. Elapsed time between stored observations: 5 minutes\. Change across the latest uninterrupted falling sequence of stored observations: \u22128\.3%\./i
    );
    assert.doesNotMatch(
      turningPointChange?.getAttribute("aria-label") || "",
      /Baseline stored observation: 100 players|\+10%/i,
      "a reversal must reset the percentage baseline at the shared turning point"
    );
    const turningPointModel = fixture.hooks.getGameTileCcuGraphLatestPercentChange([
      turningPointPoints
    ]);
    assert.equal(turningPointModel.baselinePlaying, 120);
    assert.equal(turningPointModel.latestPlaying, 110);
    assert.equal(turningPointModel.observationCount, 2);

    const fallingRunPoints = [
      ...turningPointPoints,
      { timestamp: baseTimestamp + 15 * 60_000, playing: 90 }
    ];
    const fallingRunOverlay = fixture.document.createElement("div");
    fixture.hooks.renderGameTileCcuGraph(fallingRunOverlay, fallingRunPoints);
    const fallingRunChange = fallingRunOverlay.querySelector(
      ".rsl-game-ccu-graph__latest-change"
    );
    assert.equal(fallingRunChange?.textContent, "\u221225%");
    assert.match(
      fallingRunChange?.getAttribute("aria-label") || "",
      /Baseline stored observation: 120 players\. Latest stored observation: 90 players\. Elapsed time between stored observations: 10 minutes/i,
      "same-direction edges must extend backward to their shared turning point"
    );

    const flatRunOverlay = fixture.document.createElement("div");
    fixture.hooks.renderGameTileCcuGraph(flatRunOverlay, [
      { timestamp: baseTimestamp, playing: 100 },
      { timestamp: baseTimestamp + 5 * 60_000, playing: 120 },
      { timestamp: baseTimestamp + 10 * 60_000, playing: 120 },
      { timestamp: baseTimestamp + 15 * 60_000, playing: 120 }
    ]);
    const flatRunChange = flatRunOverlay.querySelector(
      ".rsl-game-ccu-graph__latest-change"
    );
    assert.equal(flatRunChange?.textContent, "0%");
    assert.equal(flatRunChange?.getAttribute("data-trend"), "flat");
    assert.match(
      flatRunChange?.getAttribute("aria-label") || "",
      /Baseline stored observation: 120 players\. Latest stored observation: 120 players\. Elapsed time between stored observations: 10 minutes\. Change across the latest uninterrupted unchanged sequence of stored observations: 0%\./i
    );

    const missedBucketRunPoints = [
      { timestamp: baseTimestamp, playing: 100 },
      { timestamp: baseTimestamp + 5 * 60_000, playing: 90 },
      { timestamp: baseTimestamp + 15 * 60_000, playing: 100 },
      { timestamp: baseTimestamp + 20 * 60_000, playing: 110 }
    ];
    const missedBucketRunOverlay = fixture.document.createElement("div");
    fixture.hooks.renderGameTileCcuGraph(
      missedBucketRunOverlay,
      missedBucketRunPoints,
      currentBucket
    );
    const missedBucketRunChange = missedBucketRunOverlay.querySelector(
      ".rsl-game-ccu-graph__latest-change"
    );
    assert.equal(
      missedBucketRunOverlay.getAttribute("data-gap-count"),
      "3",
      "the missed bucket remains distinct from leading and trailing empty time"
    );
    assert.equal(missedBucketRunChange?.textContent, "+10%");
    assert.match(
      missedBucketRunChange?.getAttribute("aria-label") || "",
      /Baseline stored observation: 100 players\. Latest stored observation: 110 players\. Elapsed time between stored observations: 5 minutes/i,
      "a missed bucket resets the latest trend run at the resumed observation"
    );

    const longRawRunStart = currentBucket - 199 * bucketMs;
    const longRawRunPoints = Array.from({ length: 200 }, (_, index) => ({
      timestamp: longRawRunStart + index * bucketMs,
      playing: index <= 180
        ? 10_000 + index
        : 10_179 + (index - 181)
    }));
    assert.ok(
      fixture.hooks.downsampleGameTileCcuGraphPoints(longRawRunPoints).length <= 144
    );
    const longRawRunOverlay = fixture.document.createElement("div");
    fixture.hooks.renderGameTileCcuGraph(
      longRawRunOverlay,
      longRawRunPoints,
      currentBucket
    );
    const longRawRunChange = longRawRunOverlay.querySelector(
      ".rsl-game-ccu-graph__latest-change"
    );
    assert.equal(
      longRawRunChange?.textContent,
      "+0.2%",
      "visual downsampling must not erase the subtle raw reversal that starts the latest run"
    );
    assert.match(
      longRawRunChange?.getAttribute("aria-label") || "",
      /Baseline stored observation: 10\.179 players\. Latest stored observation: 10\.197 players\. Elapsed time between stored observations: 1 hour 30 minutes/i
    );
    const longRawRunModel = fixture.hooks.getGameTileCcuGraphLatestPercentChange([
      longRawRunPoints
    ]);
    assert.equal(longRawRunModel.baselineTimestamp, longRawRunPoints[181].timestamp);
    assert.equal(longRawRunModel.latestTimestamp, longRawRunPoints.at(-1).timestamp);
    assert.equal(longRawRunModel.elapsedMs, 90 * 60_000);
    assert.equal(longRawRunModel.observationCount, 19);

    const isolatedResumePoints = [
      { timestamp: baseTimestamp, playing: 100 },
      { timestamp: baseTimestamp + 5 * 60_000, playing: 200 },
      { timestamp: baseTimestamp + 20 * 60_000, playing: 50 }
    ];
    const isolatedResumeOverlay = fixture.document.createElement("div");
    fixture.hooks.renderGameTileCcuGraph(
      isolatedResumeOverlay,
      isolatedResumePoints
    );
    assert.deepEqual(
      getDirectionalGraphEdges(isolatedResumeOverlay).map((edge) => edge.trend),
      ["up"],
      "no falling edge may be synthesized across a missing-data interval"
    );
    assert.equal(
      isolatedResumeOverlay.getAttribute("data-latest-trend"),
      "neutral",
      "an isolated resumed point has no trend until its segment gets another sample"
    );
    assert.equal(
      isolatedResumeOverlay.querySelector(".rsl-game-ccu-graph__latest-point"),
      null,
      "an isolated saved sample must not gain a second endpoint cursor"
    );
    const isolatedResumeMarkerPath = isolatedResumeOverlay.querySelector(
      ".rsl-game-ccu-graph__isolated-point"
    )?.getAttribute("d") || "";
    const isolatedResumeMarkers = Array.from(isolatedResumeMarkerPath.matchAll(
      /M(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g
    ));
    assert.equal(
      isolatedResumeMarkers.length,
      1,
      "only the real isolated post-gap observation should receive an isolated marker"
    );
    assert.match(
      isolatedResumeOverlay.getAttribute("aria-label"),
      /no adjacent stored observation is available for the latest trend/i
    );
    const isolatedResumeChange = isolatedResumeOverlay.querySelector(
      ".rsl-game-ccu-graph__latest-change"
    );
    assert.equal(isolatedResumeChange?.textContent, "\u2014");
    assert.equal(isolatedResumeChange?.getAttribute("data-trend"), "neutral");
    assert.match(
      isolatedResumeChange?.getAttribute("aria-label") || "",
      /Latest stored observation: 50 players\./i
    );
    assert.doesNotMatch(
      isolatedResumeChange?.getAttribute("aria-label") || "",
      /Baseline stored observation: 200 players/i,
      "the point before a real gap is not the percentage baseline"
    );

    const resumedTrendPoints = [
      { timestamp: baseTimestamp, playing: 100 },
      { timestamp: baseTimestamp + 5 * 60_000, playing: 500 },
      { timestamp: baseTimestamp + 20 * 60_000, playing: 50 },
      { timestamp: baseTimestamp + 25 * 60_000, playing: 60 }
    ];
    const resumedTrendOverlay = fixture.document.createElement("div");
    fixture.hooks.renderGameTileCcuGraph(resumedTrendOverlay, resumedTrendPoints);
    assert.equal(getDirectionalGraphEdges(resumedTrendOverlay).length, 2);
    assert.equal(
      getDirectionalGraphEdges(resumedTrendOverlay).every(
        (edge) => edge.trend === "up"
      ),
      true,
      "only within-segment edges may classify the resumed series"
    );
    assert.equal(resumedTrendOverlay.getAttribute("data-latest-trend"), "up");
    assert.match(
      resumedTrendOverlay.getAttribute("aria-label"),
      /latest stored change increased by 10 players/i
    );
    assert.equal(
      resumedTrendOverlay.querySelector(".rsl-game-ccu-graph__latest-change")
        ?.textContent,
      "+20%",
      "the visible percentage must use the final two raw points of the resumed segment"
    );
    assert.match(
      resumedTrendOverlay.querySelector(".rsl-game-ccu-graph__latest-change")
        ?.getAttribute("aria-label") || "",
      /Baseline stored observation: 50 players\. Latest stored observation: 60 players\. Elapsed time between stored observations: 5 minutes/i,
      "a real gap must reset both the percentage baseline and elapsed run time"
    );

    const rawSeriesEnd = Math.floor(Date.now() / (5 * 60_000)) * 5 * 60_000;
    const alternatingRawPoints = Array.from({ length: 200 }, (_, index) => ({
      timestamp: rawSeriesEnd - (199 - index) * 5 * 60_000,
      playing: index % 2 === 0 ? 100 : 200
    }));
    const alternatingOverlay = fixture.document.createElement("div");
    fixture.hooks.renderGameTileCcuGraph(
      alternatingOverlay,
      alternatingRawPoints,
      rawSeriesEnd
    );
    const alternatingEdges = getDirectionalGraphEdges(alternatingOverlay);
    const displayWindowMs = 12 * 60 * 60_000;
    const visibleAlternatingPoints = alternatingRawPoints.filter(
      (point) => point.timestamp >= rawSeriesEnd - displayWindowMs
    );
    assert.equal(
      alternatingEdges.length,
      visibleAlternatingPoints.length - 1,
      "the 12-hour graph must preserve every visible raw edge without drawing retained off-window edges"
    );
    const indexedAlternatingEdges = alternatingEdges.map((edge) => {
      const domainStart = rawSeriesEnd - displayWindowMs;
      const indexForX = (x) => Math.round((
        domainStart + ((x - 8) / 284) * displayWindowMs -
          visibleAlternatingPoints[0].timestamp
      ) / bucketMs);
      return {
        ...edge,
        previousIndex: indexForX(edge.x1),
        currentIndex: indexForX(edge.x2)
      };
    }).sort((left, right) => left.previousIndex - right.previousIndex);
    indexedAlternatingEdges.forEach((edge, index) => {
      assert.equal(edge.previousIndex, index);
      assert.equal(
        edge.currentIndex,
        index + 1,
        "each colored edge must join consecutive raw observations"
      );
      assert.equal(
        edge.trend,
        fixture.hooks.getGameTileCcuGraphEdgeTrend(
          visibleAlternatingPoints[index],
          visibleAlternatingPoints[index + 1]
        )
      );
    });

    const stalePoints = [
      { timestamp: currentBucket - 20 * 60_000, playing: 300 },
      { timestamp: currentBucket - 15 * 60_000, playing: 320 }
    ];
    const staleOverlay = fixture.document.createElement("div");
    fixture.hooks.renderGameTileCcuGraph(staleOverlay, stalePoints);
    const trailingIntervals = fixture.hooks.getGameTileCcuGraphGapIntervals(
      stalePoints,
      currentBucket
    );
    assert.equal(trailingIntervals.length, 1);
    assert.equal(trailingIntervals[0].trailing, true);
    assert.equal(
      trailingIntervals[0].start,
      currentBucket - 12.5 * 60_000
    );
    assert.equal(
      trailingIntervals[0].end,
      currentBucket
    );
    assert.equal(
      staleOverlay.getAttribute("data-gap-count"),
      "2",
      "the fixed window includes both the pre-install and stale-tail no-data ranges"
    );
    assert.ok(staleOverlay.querySelector(".rsl-game-ccu-graph__gap-band"));
    assert.equal(
      staleOverlay.querySelectorAll(".rsl-game-ccu-graph__x-tick").at(-1)
        ?.getAttribute("datetime"),
      new Date(currentBucket).toISOString(),
      "a recent stale series should reserve the right-side no-data block through now"
    );
  }

  {
    const fixture = loadContentCcuFixture({ IntlImplementation: germanDefaultIntl });
    const currentBucket = Math.floor(Date.now() / (5 * 60_000)) * 5 * 60_000;
    const overlay = fixture.document.createElement("div");
    fixture.hooks.renderGameTileCcuGraph(overlay, [
      { timestamp: currentBucket - 30 * 60_000, playing: 901_025 },
      { timestamp: currentBucket - 15 * 60_000, playing: 920_100 },
      { timestamp: currentBucket, playing: 930_925 }
    ]);
    const axes = assertSemanticGameCcuGraphAxes(overlay, "sub-day graph");
    const titleGroup = overlay.querySelector(
      ".rsl-game-ccu-graph__title-group"
    );
    assert.match(
      titleGroup?.textContent || "",
      /CCU[\s\S]*12\s*(?:h|hours?)/i,
      "the compact heading must identify both the metric and fixed display window"
    );
    assert.match(
      overlay.querySelector(".rsl-game-ccu-graph__window")?.textContent || "",
      /12\s*(?:h|hours?)/i,
      "the graph window must remain separately identifiable from the metric"
    );
    assert.doesNotMatch(
      titleGroup?.textContent || "",
      /\b(?:live|current|real[- ]?time)\b/i,
      "the graph title must not describe locally saved history as live data"
    );
    assert.equal(
      overlay.querySelector(".rsl-game-ccu-graph__latest")?.textContent,
      "930.925",
      "the heading must use the exact default-locale count, not a compact approximation"
    );
    assert.doesNotMatch(
      overlay.querySelector(".rsl-game-ccu-graph__latest")?.textContent || "",
      /930[.,]9K|930,925/i
    );
    const latestRow = overlay.querySelector(
      ".rsl-game-ccu-graph__latest-row"
    );
    assert.match(
      overlay.querySelector(".rsl-game-ccu-graph__latest-label")?.textContent || "",
      /latest/i,
      "the exact number must be visibly labeled as the latest saved observation"
    );
    assert.match(
      latestRow?.getAttribute("aria-label") || "",
      /latest saved CCU:\s*930\.925/i,
      "the latest summary must expose the exact localized count to assistive technology"
    );
    assert.doesNotMatch(
      `${latestRow?.textContent || ""} ${latestRow?.getAttribute("aria-label") || ""}`,
      /\b(?:live|current|right now)\b/i,
      "a saved snapshot must never be presented as live/current data"
    );
    const latestTime = overlay.querySelector(
      ".rsl-game-ccu-graph__latest-time"
    );
    assert.equal(latestTime?.localName, "time");
    assert.equal(
      latestTime?.getAttribute("datetime"),
      new Date(currentBucket).toISOString(),
      "the visible freshness status must refer to the exact latest saved observation"
    );
    const localizedLatestTimestamp = new Date(currentBucket).toLocaleString();
    assert.equal(
      latestTime?.getAttribute("aria-label"),
      `Latest saved observation ${localizedLatestTimestamp}`,
      "the freshness element must expose the exact saved timestamp, not only a relative age"
    );
    assert.ok(
      latestTime?.textContent.trim(),
      "the exact CCU heading must not imply a live value without visible sample freshness"
    );
    assert.match(
      latestTime?.getAttribute("aria-label") || latestTime?.title || "",
      /latest|saved|observation|sample/i,
      "the sample timestamp needs an accessible explanation"
    );
    const cadence = overlay.querySelector(".rsl-game-ccu-graph__cadence");
    assert.notEqual(
      cadence,
      latestTime,
      "sample cadence and latest-sample freshness must remain separate semantic facts"
    );
    assert.match(
      latestTime?.textContent || "",
      /(?:last\s+)?saved/i,
      "freshness must visibly describe when data was saved"
    );
    assert.match(
      cadence?.textContent || "",
      /5\s*min/i,
      "cadence must visibly explain the normal sampling interval"
    );
    assert.match(
      cadence?.getAttribute("aria-label") || cadence?.title || "",
      /sampled?.*(?:about|approximately|every).*5 minutes|every.*5 minutes.*sampl/i,
      "cadence needs a standalone accessible explanation rather than looking like freshness"
    );
    assert.doesNotMatch(
      cadence?.textContent || "",
      /\bago\b/i,
      "sample cadence must not be mistaken for the age of the latest point"
    );
    assert.doesNotMatch(
      latestTime?.textContent || "",
      /sampl(?:e|ed|ing).*every|every.*sampl/i,
      "latest freshness must not be mistaken for the collection cadence"
    );
    const exactInspectorValue = overlay.querySelector(
      ".rsl-game-ccu-graph__interaction"
    )?.getAttribute("aria-valuetext") || "";
    assert.equal(
      exactInspectorValue,
      `930.925 CCU at ${localizedLatestTimestamp}`,
      "the graph inspector must expose the exact saved value and timestamp together"
    );
    assert.doesNotMatch(
      exactInspectorValue,
      /\b(?:ago|live|current|now)\b/i,
      "the exact inspector value must not substitute relative or live wording for its timestamp"
    );
    assert.equal(axes.xLabels.at(-1), "Now");
    assert.equal(
      axes.xLabels.slice(0, -1).every((label) => /^\d{1,2}:\d{2}$/.test(label)),
      true,
      "a 12-hour axis should use readable clock labels instead of multi-day dates"
    );
    assert.match(overlay.getAttribute("aria-label") || "", /rolling 12-hour/i);
    assert.doesNotMatch(
      `${overlay.textContent} ${overlay.getAttribute("aria-label") || ""}`,
      /7\s*days?|seven-day/i,
      "visible and accessible graph copy must consistently describe 12 hours"
    );
  }

  for (const flatPlaying of [0, 1]) {
    const fixture = loadContentCcuFixture();
    const currentBucket = Math.floor(Date.now() / (5 * 60_000)) * 5 * 60_000;
    const overlay = fixture.document.createElement("div");
    fixture.hooks.renderGameTileCcuGraph(overlay, [
      { timestamp: currentBucket - 10 * 60_000, playing: flatPlaying },
      { timestamp: currentBucket - 5 * 60_000, playing: flatPlaying },
      { timestamp: currentBucket, playing: flatPlaying }
    ]);
    const axes = assertSemanticGameCcuGraphAxes(
      overlay,
      `flat ${flatPlaying}-player graph`
    );
    assert.ok(
      axes.yValues[0] > flatPlaying && axes.yValues.at(-1) <= flatPlaying,
      "a flat low-count series needs a real padded Y domain"
    );
    assert.equal(
      overlay.querySelector(".rsl-game-ccu-graph__latest")?.textContent,
      String(flatPlaying),
      "zero and one are valid exact CCU values"
    );
  }

  {
    const fixture = loadContentCcuFixture();
    const currentBucket = Math.floor(Date.now() / (5 * 60_000)) * 5 * 60_000;
    const overlay = fixture.document.createElement("div");
    const visiblePoints = fixture.hooks.renderGameTileCcuGraph(overlay, [
      { timestamp: currentBucket - 3 * 24 * 60 * 60_000, playing: 10_000 },
      { timestamp: currentBucket - 24 * 60 * 60_000, playing: 12_000 },
      { timestamp: currentBucket, playing: 11_000 }
    ]);
    assert.deepEqual(
      JSON.parse(JSON.stringify(visiblePoints)),
      [{ timestamp: currentBucket, playing: 11_000 }],
      "a seven-day storage payload must be clipped to the rolling 12-hour display"
    );
    assert.equal(overlay.getAttribute("data-state"), "collecting");
    assert.equal(
      overlay.querySelector(".rsl-game-ccu-graph__interaction")
        ?.getAttribute("aria-valuemax"),
      "0",
      "off-window retained points must not be exposed by graph inspection"
    );
  }

  {
    const fixture = loadContentCcuFixture();
    fixture.hooks.setFeatureSettingsForTests({
      version: 1,
      flags: { quickPlay: false, gameCcu: true }
    });
    const first = makeContentCcuGraphCard(fixture.document, "801", "9801");
    const duplicate = makeContentCcuGraphCard(fixture.document, "802", "9801");
    const currentBucket = Math.floor(Date.now() / (5 * 60_000)) * 5 * 60_000;
    fixture.hooks.mountGameTileCcuGraphTriggers();
    fixture.hooks.openGameTileCcuGraph(first.label);
    fixture.hooks.openGameTileCcuGraph(duplicate.label);
    assert.equal(fixture.calls.length, 1, "duplicate cards for one universe must share a history read");
    fixture.calls[0].reply({
      ok: true,
      requestId: fixture.calls[0].message.requestId,
      universeId: "9801",
      tracked: true,
      points: [
        { timestamp: currentBucket - 5 * 60_000, playing: 300 },
        { timestamp: currentBucket, playing: 330 }
      ]
    });
    await flushContentMicrotasks();
    assert.equal(first.thumbnail.querySelector("[data-rsl-game-ccu-graph-overlay]"), null);
    assert.equal(
      fixture.document.querySelector("[data-rsl-game-ccu-graph-overlay]")
        ?.getAttribute("data-state"),
      "ready"
    );
    assert.equal(
      fixture.hooks.getGameTileCcuGraphStateForTests().placeId,
      "802",
      "the shared response must render only for the currently anchored duplicate card"
    );
    fixture.hooks.cleanupGameTileCcuFeature();
  }

  {
    const fixture = loadContentCcuFixture();
    fixture.hooks.setFeatureSettingsForTests({
      version: 1,
      flags: { quickPlay: false, gameCcu: true }
    });
    const card = makeContentCcuGraphCard(fixture.document, "901", "9901");
    fixture.hooks.mountGameTileCcuGraphTriggers();
    fixture.hooks.openGameTileCcuGraph(card.label);
    const pending = fixture.calls[0];
    card.link.setAttribute("href", "/games/902/recycled?universeId=9902");
    fixture.hooks.mountGameTileCcuGraphTriggers();
    assert.equal(
      fixture.document.querySelector("[data-rsl-game-ccu-graph-overlay]"),
      null,
      "recycling a card identity must close its stale overlay before the reply"
    );
    pending.reply({
      ok: true,
      requestId: pending.message.requestId,
      universeId: "9901",
      tracked: true,
      points: [
        { timestamp: 4_000_000, playing: 400 },
        { timestamp: 4_300_000, playing: 430 }
      ]
    });
    await flushContentMicrotasks();
    assert.equal(
      fixture.document.querySelector("[data-rsl-game-ccu-graph-overlay]"),
      null
    );

    fixture.hooks.openGameTileCcuGraph(card.label);
    const cleanupPending = fixture.calls.at(-1);
    fixture.hooks.cleanupGameTileCcuGraphDisplay();
    cleanupPending.reply({
      ok: true,
      requestId: cleanupPending.message.requestId,
      universeId: "9902",
      tracked: true,
      points: [
        { timestamp: 5_000_000, playing: 500 },
        { timestamp: 5_300_000, playing: 530 }
      ]
    });
    await flushContentMicrotasks();
    assert.equal(
      fixture.document.querySelector("[data-rsl-game-ccu-graph-overlay]"),
      null
    );
    assert.equal(fixture.hooks.getGameTileCcuGraphStateForTests().active, false);
  }
}

const hooks = {};
let runtimeListener = null;
let runtimeStartupListener = null;
let alarmListener = null;
let gamesFetchPaused = false;
let releaseGamesFetch = null;
let gamesFetchGate = Promise.resolve();
let chartsFixturePages = null;
let chartsFixtureLocalPages = null;
let chartsFixturePagesByFeed = null;
let chartsFixturePagesByAccessFeed = null;
let chartsFailureStatus = 0;
let chartsFailureFeed = null;
let chartsFailureCredentials = null;
const requestLog = [];
const requestDetails = [];

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

async function fixtureFetch(input, init = {}) {
  const url = new URL(String(input));
  requestLog.push(url.href);
  requestDetails.push({
    href: url.href,
    credentials: init?.credentials || null,
    headers: structuredClone(init?.headers || null)
  });
  if (
    url.origin === "https://apis.roblox.com" &&
    url.pathname === "/explore-api/v1/get-sorts"
  ) {
    const chartCountry = url.searchParams.has("country") ? "all" : "local";
    const chartDevice = url.searchParams.get("device") || "default";
    const chartFeed = `${chartDevice}/${chartCountry}`;
    const chartAccessFeed = `${init?.credentials || "omit"}:${chartFeed}`;
    if (
      chartsFailureStatus &&
      (!chartsFailureFeed ||
        chartsFailureFeed === chartFeed ||
        chartsFailureFeed === chartCountry) &&
      (!chartsFailureCredentials ||
        chartsFailureCredentials === init?.credentials)
    ) {
      return json({ errors: [{ message: "fixture Charts failure" }] }, chartsFailureStatus);
    }
    const fixturePages =
      chartsFixturePagesByAccessFeed?.[chartAccessFeed] ||
      chartsFixturePagesByFeed?.[chartFeed] ||
      (!url.searchParams.has("country") && Array.isArray(chartsFixtureLocalPages)
        ? chartsFixtureLocalPages
        : chartsFixturePages);
    assert.ok(Array.isArray(fixturePages), "Charts fetch requires fixture pages");
    const token = url.searchParams.get("sortsPageToken");
    const pageIndex = token ? Number(/^page-(\d+)$/.exec(token)?.[1]) : 0;
    assert.ok(Number.isSafeInteger(pageIndex) && fixturePages[pageIndex]);
    return json(fixturePages[pageIndex]);
  }
  const universeMatch = url.pathname.match(
    /^\/universes\/v1\/places\/([1-9]\d*)\/universe$/
  );
  if (url.origin === "https://apis.roblox.com" && universeMatch) {
    return json({ universeId: Number(universeMatch[1]) + 5_000 });
  }
  if (url.origin === "https://games.roblox.com" && url.pathname === "/v1/games") {
    if (gamesFetchPaused) await gamesFetchGate;
    const universeIds = (url.searchParams.get("universeIds") || "")
      .split(",")
      .filter(Boolean);
    return json({
      data: universeIds.map((id) => {
        if (id === "5001") return { id: 5001, playing: 0 };
        if (id === "5002") return { id: 5002, playing: -1 };
        if (id === "5003") return { id: 5003, playing: 1.5 };
        if (id === "5004") return { id: 5004, playing: 354 };
        return { id: Number(id), playing: Number(id) % 1_000 };
      })
    });
  }
  if (
    url.origin === "https://games.roblox.com" &&
    url.pathname === "/v1/games/votes"
  ) {
    const universeIds = (url.searchParams.get("universeIds") || "")
      .split(",")
      .filter(Boolean);
    return json({
      data: universeIds.map((id) => {
        if (id === "6001") return { id: 6001, upVotes: 93, downVotes: 7 };
        if (id === "6002") return { id: 6002, upVotes: 0, downVotes: 0 };
        if (id === "6003") return { id: 6003, upVotes: 1.5, downVotes: 1 };
        if (id === "6004") return { id: 6004, upVotes: 2, downVotes: 1 };
        return { id: Number(id), upVotes: 1, downVotes: 0 };
      })
    });
  }
  throw new Error(`Unexpected fixture fetch: ${url.href}`);
}

function makeStorageArea() {
  const values = Object.create(null);
  return {
    values,
    get(defaults, callback) {
      const result = defaults && typeof defaults === "object" && !Array.isArray(defaults)
        ? { ...defaults, ...values }
        : { ...values };
      callback?.(result);
      return Promise.resolve(result);
    },
    set(next, callback) {
      Object.assign(values, next);
      callback?.();
      return Promise.resolve();
    },
    remove(keys, callback) {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key];
      callback?.();
      return Promise.resolve();
    }
  };
}

const localStorageArea = makeStorageArea();
const sessionStorageArea = makeStorageArea();
const alarmCreates = [];
const alarmClears = [];

const chrome = {
  runtime: {
    id: "fixture-extension",
    lastError: null,
    onInstalled: { addListener() {} },
    onStartup: {
      addListener(listener) {
        runtimeStartupListener = listener;
      }
    },
    onMessage: {
      addListener(listener) {
        runtimeListener = listener;
      }
    }
  },
  storage: {
    local: localStorageArea,
    session: sessionStorageArea,
    onChanged: { addListener() {} }
  },
  alarms: {
    create(name, info) {
      alarmCreates.push({ name, info: structuredClone(info) });
    },
    clear(name, callback) {
      alarmClears.push(name);
      callback?.(true);
      return Promise.resolve(true);
    },
    onAlarm: {
      addListener(listener) {
        alarmListener = listener;
      }
    }
  },
  contextMenus: {
    create() {},
    removeAll(callback) { callback?.(); },
    onClicked: { addListener() {} }
  },
  scripting: { executeScript() { return Promise.resolve([]); } },
  tabs: { sendMessage() {} }
};

const sandbox = {
  URL,
  URLSearchParams,
  AbortController,
  TextDecoder,
  Response,
  Headers,
  Request,
  structuredClone,
  crypto,
  console,
  chrome,
  fetch: fixtureFetch,
  setTimeout,
  clearTimeout,
  queueMicrotask,
  globalThis: null,
  __rslBackgroundTestHooks: hooks
};
sandbox.globalThis = sandbox;
vm.runInNewContext(backgroundSource, sandbox, { filename: "background.js" });

assert.equal(typeof runtimeListener, "function");
for (const hookName of [
  "normalizeGameCcuRequestGames",
  "fetchGameCcuBatch",
  "fetchGameRatingBatch",
  "getGameCcuForRequest",
  "handleGameCcuMessage",
  "resetGameCcuStateForTests",
  "normalizeGameCcuHistoryObservation",
  "createGameCcuHistorySnapshot",
  "decodeGameCcuHistorySnapshot",
  "mergeGameCcuHistorySnapshots",
  "findGameCcuInHistorySnapshot",
  "buildGameCcuHistoryFromSnapshots",
  "loadGameCcuHistorySnapshotCache",
  "parseGameCcuChartsPage",
  "buildGameCcuChartsPageUrl",
  "fetchAllGameCcuChartsPages",
  "fetchMergedGameCcuChartsPages",
  "appendGameCcuHistoryObservations",
  "readGameCcuHistory",
  "runGameCcuHistoryCollection",
  "hasCurrentGameCcuHistoryPoint",
  "seedVisibleChartsGameCcuHistory",
  "getTrustedRobloxChartsTabId",
  "getGameCcuHistoryFeatureValue",
  "handleGameCcuHistoryMessage",
  "ensureGameCcuHistoryAlarm",
  "resetGameCcuHistoryStateForTests",
  "setGameCcuHistoryStorageOverrideForTests",
  "getGameCcuHistoryStateForTests"
]) {
  assert.equal(typeof hooks[hookName], "function", `${hookName} must be testable`);
}

const trustedSender = {
  id: chrome.runtime.id,
  frameId: 0,
  tab: { id: 17, url: "https://www.roblox.com/home" },
  url: "https://www.roblox.com/home"
};

const trustedChartsSender = {
  id: chrome.runtime.id,
  frameId: 0,
  tab: {
    id: 18,
    url: "https://www.roblox.com/charts?device=all&country=all"
  },
  url: "https://www.roblox.com/charts?device=all&country=all"
};

function sendCcu(games, requestId = 1) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("CCU fixture response timed out")), 2_000);
    let listenerReturned = false;
    let keepChannel = false;
    let responseReceived = false;
    let responseValue = null;
    const finish = () => {
      clearTimeout(timeout);
      resolve({ keepChannel, response: responseValue });
    };
    keepChannel = runtimeListener(
      { type: "rsl:get-game-tile-ccu", requestId, games },
      trustedSender,
      (response) => {
        responseReceived = true;
        responseValue = response;
        if (listenerReturned) finish();
      }
    );
    listenerReturned = true;
    if (responseReceived || !keepChannel) finish();
  });
}

function sendCcuHistory(identity, requestId = 1, sender = trustedSender) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("CCU history fixture response timed out")),
      2_000
    );
    let listenerReturned = false;
    let keepChannel = false;
    let responseReceived = false;
    let responseValue = null;
    const finish = () => {
      clearTimeout(timeout);
      resolve({ keepChannel, response: responseValue });
    };
    const identityFields = identity && typeof identity === "object"
      ? identity
      : { universeId: identity };
    keepChannel = runtimeListener(
      { type: "rsl:get-game-ccu-history", requestId, ...identityFields },
      sender,
      (response) => {
        responseReceived = true;
        responseValue = response;
        if (listenerReturned) finish();
      }
    );
    listenerReturned = true;
    if (responseReceived || !keepChannel) finish();
  });
}

function makeFiveChartsFixturePages() {
  return Array.from({ length: 5 }, (_, pageIndex) => ({
    sorts: [{
      topic: `fixture-page-${pageIndex + 1}`,
      games: [
        { universeId: 44_001, playerCount: 100 + pageIndex },
        { universeId: 45_000 + pageIndex, playerCount: 200 + pageIndex },
        ...(pageIndex === 2
          ? [{ universeId: 45_002, playerCount: 999 }]
          : [])
      ]
    }],
    nextSortsPageToken: pageIndex < 4 ? `page-${pageIndex + 1}` : null
  }));
}

function makeFourChartsFixtureFeeds() {
  const feeds = Object.create(null);
  [
    ["computer/local", 46_991, 801],
    ["computer/all", 46_992, 802],
    ["all/local", 46_993, 803],
    ["all/all", 46_994, 804]
  ].forEach(([key, uniqueUniverseId, sharedPlaying]) => {
    const pages = structuredClone(makeFiveChartsFixturePages());
    pages[0].sorts[0].games.push({
      universeId: uniqueUniverseId,
      playerCount: uniqueUniverseId % 1_000
    });
    pages[4].sorts[0].games[0].playerCount = sharedPlaying;
    feeds[key] = pages;
  });
  return feeds;
}

function makeAuthenticatedChartsFixtureFeeds() {
  const feeds = makeFourChartsFixtureFeeds();
  Object.entries(feeds).forEach(([key, pages], index) => {
    pages[1].sorts[0].games.push({
      universeId: 47_100 + index,
      playerCount: 900 + index
    });
  });
  return feeds;
}

function makeAccessScopedChartsFixtureFeeds() {
  const authenticated = makeAuthenticatedChartsFixtureFeeds();
  const anonymous = makeFourChartsFixtureFeeds();
  const feeds = Object.create(null);
  for (const key of Object.keys(authenticated)) {
    feeds[`include:${key}`] = authenticated[key];
    feeds[`omit:${key}`] = anonymous[key];
  }
  return feeds;
}

function chartsRequestsSince(start) {
  return requestLog.slice(start).filter((href) => {
    const url = new URL(href);
    return (
      url.origin === "https://apis.roblox.com" &&
      url.pathname === "/explore-api/v1/get-sorts"
    );
  });
}

function chartsRequestDetailsSince(start) {
  return requestDetails.slice(start).filter(({ href }) => {
    const url = new URL(href);
    return (
      url.origin === "https://apis.roblox.com" &&
      url.pathname === "/explore-api/v1/get-sorts"
    );
  });
}

function gameRequestsSince(start) {
  return requestLog.slice(start).filter((href) => {
    const url = new URL(href);
    return url.origin === "https://games.roblox.com" && url.pathname === "/v1/games";
  });
}

function ratingRequestsSince(start) {
  return requestLog.slice(start).filter((href) => {
    const url = new URL(href);
    return (
      url.origin === "https://games.roblox.com" &&
      url.pathname === "/v1/games/votes"
    );
  });
}

(async () => {
  await runContentCcuBehaviorContracts();
  await runContentCcuGraphBehaviorContracts();

  const historyConstants = hooks.gameCcuHistoryConstants;
  assert.equal(historyConstants.messageType, "rsl:get-game-ccu-history");
  assert.equal(historyConstants.alarmPeriodMinutes, 5);
  assert.equal(historyConstants.bucketMs, 5 * 60_000);
  assert.equal(
    historyConstants.retentionMs,
    7 * 24 * 60 * 60_000,
    "shortening the graph must not shorten local history retention"
  );
  assert.equal(
    historyConstants.maxPoints,
    2_016,
    "seven days of five-minute storage must remain available behind the 12-hour graph"
  );
  assert.equal(
    historyConstants.feedVersion,
    4,
    "authenticated-first four-feed snapshots must invalidate older public-only history"
  );
  assert.ok(historyConstants.maxChartPages >= 5);
  assert.equal(typeof alarmListener, "function", "the Charts collector must register an alarm listener");
  assert.equal(
    typeof runtimeStartupListener,
    "function",
    "the background must register startup freshness handling"
  );
  assert.equal(
    alarmCreates.some(
      (alarm) =>
        alarm.name === historyConstants.alarmName &&
        alarm.info.periodInMinutes === 5
    ),
    true,
    "Charts snapshots must be scheduled every five minutes"
  );

  {
    const clearsBefore = alarmClears.length;
    const createsBefore = alarmCreates.length;
    const requestsBefore = requestLog.length;
    hooks.applyGameCcuHistoryFeatureValue({
      version: 1,
      flags: { gameCcu: true, gameCcuHoverGraph: false }
    });
    assert.equal(hooks.getGameCcuHistoryStateForTests().featureEnabled, false);
    assert.equal(alarmClears.length, clearsBefore + 1);
    assert.equal(alarmClears.at(-1), historyConstants.alarmName);
    alarmListener({ name: historyConstants.alarmName });
    await flushContentMicrotasks();
    assert.equal(requestLog.length, requestsBefore, "a disabled feature must ignore its alarm");

    hooks.applyGameCcuHistoryFeatureValue({
      version: 1,
      flags: { gameCcu: false, gameCcuHoverGraph: true }
    });
    assert.equal(hooks.getGameCcuHistoryStateForTests().featureEnabled, true);
    assert.equal(alarmCreates.length, createsBefore + 1);
    assert.equal(alarmCreates.at(-1).info.periodInMinutes, 5);

    hooks.applyGameCcuHistoryFeatureValue({
      version: 1,
      flags: { gameCcu: false }
    });
    assert.equal(
      hooks.getGameCcuHistoryStateForTests().featureEnabled,
      true,
      "legacy settings without the graph flag must preserve default-on history"
    );
  }

  {
    const observedAt = 120 * historyConstants.bucketMs + 12_345;
    const snapshot = hooks.createGameCcuHistorySnapshot([
      { universeId: "40002", playing: 20 },
      { universeId: "40001", playing: 10 },
      { universeId: "40001", playing: 11 },
      { universeId: "0", playing: 99 },
      { universeId: "40003", playing: -1 }
    ], observedAt);
    const decoded = hooks.decodeGameCcuHistorySnapshot(snapshot);
    assert.ok(decoded, "a CCU-only Charts payload must produce a valid snapshot without votes");
    assert.equal(decoded.timestamp, observedAt - 12_345);
    assert.equal(decoded.universeIds.length, 2, "repeated universe IDs must be stored once");
    assert.equal(hooks.findGameCcuInHistorySnapshot(decoded, 40_001), 11);
    assert.equal(hooks.findGameCcuInHistorySnapshot(decoded, 40_002), 20);
    assert.equal(hooks.findGameCcuInHistorySnapshot(decoded, 40_003), null);

    const parsed = hooks.parseGameCcuChartsPage({
      sorts: [{ games: [
        { universeId: 41_001, playerCount: 101 },
        { universeId: 41_001, playerCount: 102 },
        { universeId: 41_002, playerCount: 0 }
      ] }],
      nextSortsPageToken: "page-1"
    });
    assert.equal(parsed.games.size, 2);
    assert.equal(parsed.games.get("41001").playing, 102);
    assert.equal(parsed.games.get("41002").playing, 0);
    assert.equal(parsed.nextSortsPageToken, "page-1");
    assert.throws(
      () => hooks.parseGameCcuChartsPage({ sorts: [{ games: [] }] }),
      /INVALID_SCHEMA/,
      "an empty or incompatible Charts schema must fail closed"
    );
  }

  {
    chartsFailureStatus = 0;
    chartsFixturePages = makeFiveChartsFixturePages();
    const logStart = requestLog.length;
    const snapshot = await hooks.fetchAllGameCcuChartsPages({
      credentials: "omit"
    });
    const chartRequests = chartsRequestsSince(logStart);
    const chartRequestDetails = chartsRequestDetailsSince(logStart);
    assert.equal(snapshot.pageCount, 5);
    assert.equal(snapshot.access, "anonymous");
    assert.equal(chartRequests.length, 5, "one Charts sweep must follow all five fixture pages");
    assert.equal(
      chartRequestDetails.every((request) => request.credentials === "omit"),
      true,
      "the low-level Charts fetcher must honor its explicit credential mode"
    );
    const urls = chartRequests.map((href) => new URL(href));
    assert.equal(new Set(urls.map((url) => url.searchParams.get("sessionId"))).size, 1);
    assert.equal(urls.every((url) => url.searchParams.get("country") === "all"), true);
    assert.equal(urls.every((url) => url.searchParams.get("device") === "computer"), true);
    assert.equal(urls[0].searchParams.has("sortsPageToken"), false);
    assert.deepEqual(
      urls.slice(1).map((url) => url.searchParams.get("sortsPageToken")),
      ["page-1", "page-2", "page-3", "page-4"]
    );
    assert.equal(snapshot.games.length, 6, "cross-page universe IDs must be globally deduplicated");
    assert.equal(snapshot.games.find((game) => game.universeId === "44001").playing, 104);
    assert.equal(snapshot.games.find((game) => game.universeId === "45002").playing, 999);
    await assert.rejects(
      () => hooks.fetchAllGameCcuChartsPages({ credentials: "same-origin" }),
      /INVALID/,
      "Charts credentials must be restricted to include or omit"
    );
  }

  {
    const baseTimestamp = 300 * historyConstants.bucketMs;
    assert.deepEqual(
      JSON.parse(JSON.stringify(hooks.buildGameCcuHistoryFromSnapshots(
        [],
        "42001",
        baseTimestamp
      ))),
      { universeId: "42001", tracked: false, points: [] },
      "first run must return an honest empty local-history state"
    );
    const snapshots = Array.from({ length: 2_020 }, (_, index) =>
      hooks.createGameCcuHistorySnapshot(
        [{ universeId: "42001", playing: index }],
        baseTimestamp + index * historyConstants.bucketMs
      )
    );
    snapshots.push(hooks.createGameCcuHistorySnapshot(
      [{ universeId: "42001", playing: 99_999 }],
      baseTimestamp + 2_019 * historyConstants.bucketMs
    ));
    const history = hooks.buildGameCcuHistoryFromSnapshots(
      snapshots,
      "42001",
      baseTimestamp + 2_019 * historyConstants.bucketMs
    );
    assert.equal(history.tracked, true);
    assert.equal(history.points.length, 2_016, "history queries must stay bounded to seven days");
    assert.equal(
      history.points[0].timestamp,
      baseTimestamp + 4 * historyConstants.bucketMs
    );
    assert.equal(history.points.at(-1).playing, 99_999, "same-bucket snapshots must dedupe");
    assert.equal(
      new Set(history.points.map((point) => point.timestamp)).size,
      history.points.length
    );
  }

  {
    const currentBucket = Math.floor(Date.now() / historyConstants.bucketMs) *
      historyConstants.bucketMs;
    const targetUniverseId = "47200";
    const targetSnapshots = [
      hooks.createGameCcuHistorySnapshot(
        [{ universeId: targetUniverseId, playing: 720 }],
        currentBucket - 20 * 60_000
      ),
      hooks.createGameCcuHistorySnapshot(
        [{ universeId: targetUniverseId, playing: 740 }],
        currentBucket - 15 * 60_000
      ),
      hooks.createGameCcuHistorySnapshot(
        [{ universeId: "47201", playing: 99 }],
        currentBucket
      )
    ];
    assert.equal(
      targetSnapshots[1].timestamp - targetSnapshots[0].timestamp,
      historyConstants.bucketMs,
      "consecutive Charts observations must retain the normal five-minute cadence"
    );
    assert.equal(
      hooks.findGameCcuInHistorySnapshot(targetSnapshots[2], targetUniverseId),
      null,
      "a later sweep where a game is absent must not synthesize a current observation"
    );
    const targetHistory = hooks.buildGameCcuHistoryFromSnapshots(
      targetSnapshots,
      targetUniverseId,
      currentBucket
    );
    assert.equal(targetHistory.tracked, true);
    assert.deepEqual(JSON.parse(JSON.stringify(targetHistory.points)), [
      { timestamp: currentBucket - 20 * 60_000, playing: 720 },
      { timestamp: currentBucket - 15 * 60_000, playing: 740 }
    ]);
    assert.equal(
      hooks.hasCurrentGameCcuHistoryPoint(targetHistory, currentBucket),
      false,
      "history queries must not forward-fill a game missing from the newest snapshot"
    );

    const contentFixture = loadContentCcuFixture();
    const overlay = contentFixture.document.createElement("div");
    contentFixture.hooks.renderGameTileCcuGraph(overlay, targetHistory.points);
    assert.equal(
      overlay.getAttribute("data-gap-count"),
      "2",
      "an absent later observation must render both leading and trailing no-data intervals"
    );
    assert.ok(overlay.querySelector(".rsl-game-ccu-graph__gap-band"));
    assert.equal(
      overlay.querySelectorAll(".rsl-game-ccu-graph__x-tick").at(-1)
        ?.getAttribute("datetime"),
      new Date(currentBucket).toISOString()
    );
  }

  {
    hooks.resetGameCcuHistoryStateForTests();
    const rawSnapshots = [
      hooks.createGameCcuHistorySnapshot(
        [{ universeId: "43001", playing: 31 }],
        500 * historyConstants.bucketMs
      )
    ];
    let getAllCalls = 0;
    const database = {
      transaction() {
        return {
          objectStore() {
            return {
              getAll() {
                getAllCalls += 1;
                const request = {};
                queueMicrotask(() => {
                  request.result = rawSnapshots;
                  request.onsuccess?.();
                });
                return request;
              }
            };
          }
        };
      }
    };
    const firstLoad = await hooks.loadGameCcuHistorySnapshotCache(database);
    const secondLoad = await hooks.loadGameCcuHistorySnapshotCache(database);
    assert.equal(getAllCalls, 1, "later card queries must reuse one decoded snapshot load");
    assert.equal(firstLoad, secondLoad);
    assert.equal(firstLoad.length, 1);
    assert.equal(hooks.getGameCcuHistoryStateForTests().cachedSnapshots, 1);
  }

  {
    hooks.resetGameCcuHistoryStateForTests();
    chartsFailureStatus = 0;
    chartsFixturePages = makeFiveChartsFixturePages();
    chartsFixturePagesByFeed = null;
    chartsFixturePagesByAccessFeed = makeAccessScopedChartsFixtureFeeds();
    let alarmSnapshot = null;
    let resolveAlarmSnapshot;
    const alarmSnapshotWritten = new Promise((resolve) => {
      resolveAlarmSnapshot = resolve;
    });
    hooks.setGameCcuHistoryStorageOverrideForTests({
      append(snapshot) {
        alarmSnapshot = snapshot;
        resolveAlarmSnapshot();
        return snapshot.universeIds.length;
      },
      read(universeId) {
        return { universeId, tracked: false, points: [] };
      }
    });
    const alarmLogStart = requestLog.length;
    alarmListener({ name: historyConstants.alarmName });
    await alarmSnapshotWritten;
    await flushContentMicrotasks();
    const alarmChartRequests = chartsRequestsSince(alarmLogStart);
    const alarmChartRequestDetails = chartsRequestDetailsSince(alarmLogStart);
    assert.equal(
      alarmChartRequests.length,
      20,
      "a headless alarm sweep must read five authenticated pages from every filter feed"
    );
    assert.equal(
      alarmChartRequestDetails.every((request) => request.credentials === "include"),
      true,
      "authenticated Charts data must be the primary source for every logical feed"
    );
    for (const request of alarmChartRequestDetails) {
      const url = new URL(request.href);
      assert.equal(url.username, "");
      assert.equal(url.password, "");
      assert.equal(url.hash, "");
      assert.equal(
        Array.from(url.searchParams.keys()).every((key) =>
          ["sessionId", "country", "device", "sortsPageToken"].includes(key)
        ),
        true,
        "credentials must never be copied into Charts query parameters"
      );
      assert.equal(
        Object.keys(request.headers || {}).some((key) =>
          /^(?:authorization|cookie|x-csrf-token)$/i.test(key)
        ),
        false,
        "the collector must rely on browser credential mode rather than leaking tokens into headers"
      );
    }
    const alarmUrls = alarmChartRequests.map((href) => new URL(href));
    const feedUrls = new Map();
    alarmUrls.forEach((url) => {
      const key = `${url.searchParams.get("device")}/` +
        `${url.searchParams.has("country") ? "all" : "local"}`;
      if (!feedUrls.has(key)) feedUrls.set(key, []);
      feedUrls.get(key).push(url);
    });
    assert.deepEqual(
      Array.from(feedUrls.keys()).sort(),
      ["all/all", "all/local", "computer/all", "computer/local"]
    );
    for (const [feed, urls] of feedUrls) {
      assert.equal(urls.length, 5, `${feed} must drain all five fixture pages`);
      assert.equal(
        new Set(urls.map((url) => url.searchParams.get("sessionId"))).size,
        1,
        `${feed} must keep one session across its pagination`
      );
      assert.equal(urls[0].searchParams.has("sortsPageToken"), false);
      assert.deepEqual(
        urls.slice(1).map((url) => url.searchParams.get("sortsPageToken")),
        ["page-1", "page-2", "page-3", "page-4"]
      );
    }
    assert.equal(
      new Set(alarmUrls.map((url) => url.searchParams.get("sessionId"))).size,
      4,
      "each filter combination needs an independent pagination session"
    );
    assert.equal(
      alarmSnapshot.universeIds.length,
      14,
      "the authenticated four-feed union must dedupe shared games while retaining signed-in-only cards"
    );
    assert.equal(
      hooks.findGameCcuInHistorySnapshot(alarmSnapshot, 44_001),
      804,
      "a universe repeated in every feed must appear once with the final valid feed value"
    );
    for (const universeId of [46_991, 46_992, 46_993, 46_994]) {
      assert.notEqual(
        hooks.findGameCcuInHistorySnapshot(alarmSnapshot, universeId),
        null,
        `the union must retain a game unique to feed ${universeId}`
      );
    }
    for (const universeId of [47_100, 47_101, 47_102, 47_103]) {
      assert.notEqual(
        hooks.findGameCcuInHistorySnapshot(alarmSnapshot, universeId),
        null,
        `a signed-in Charts card absent from the public fixture must still be tracked: ${universeId}`
      );
    }
    chartsFixturePagesByFeed = null;
    chartsFixturePagesByAccessFeed = null;
    chartsFixtureLocalPages = null;
  }

  {
    hooks.resetGameCcuHistoryStateForTests();
    chartsFailureStatus = 0;
    chartsFixturePages = makeFiveChartsFixturePages();
    hooks.setGameCcuHistoryStorageOverrideForTests({
      append(snapshot) { return snapshot.universeIds.length; },
      read(universeId) { return { universeId, tracked: false, points: [] }; }
    });
    const startupLogStart = requestLog.length;
    runtimeStartupListener();
    await flushContentMicrotasks();
    assert.equal(
      chartsRequestsSince(startupLogStart).length,
      0,
      "startup must not refetch when the current five-minute feed-version snapshot is fresh"
    );
  }

  {
    hooks.resetGameCcuHistoryStateForTests();
    chartsFixturePages = makeFiveChartsFixturePages();
    chartsFixturePagesByAccessFeed = null;
    chartsFailureStatus = 429;
    chartsFailureFeed = "computer/local";
    chartsFailureCredentials = null;
    const partialNow = 850 * historyConstants.bucketMs;
    let partialSnapshot = hooks.createGameCcuHistorySnapshot([
      { universeId: "44001", playing: 50 },
      { universeId: "46999", playing: 777 }
    ], partialNow);
    hooks.setGameCcuHistoryStorageOverrideForTests({
      append(snapshot, options) {
        assert.equal(
          options?.preserveExistingBucket,
          true,
          "a one-feed snapshot must preserve an existing same-bucket union"
        );
        partialSnapshot = hooks.mergeGameCcuHistorySnapshots(
          partialSnapshot,
          snapshot
        );
        assert.ok(partialSnapshot);
        return partialSnapshot.universeIds.length;
      },
      read(universeId) { return { universeId, tracked: false, points: [] }; }
    });
    const partialLogStart = requestLog.length;
    const partial = await hooks.runGameCcuHistoryCollection({
      now: partialNow
    });
    assert.equal(partial.ok, true);
    assert.equal(partial.partial, true);
    assert.deepEqual(JSON.parse(JSON.stringify(partial.feeds)), [
      { country: "all", device: "computer", access: "authenticated" },
      { country: "default", device: "all", access: "authenticated" },
      { country: "all", device: "all", access: "authenticated" }
    ]);
    assert.equal(partial.pages, 15);
    assert.equal(chartsRequestsSince(partialLogStart).length, 16);
    assert.equal(
      chartsRequestDetailsSince(partialLogStart)
        .every((request) => request.credentials === "include"),
      true,
      "a 429 must enter partial/backoff handling without an anonymous retry against the same quota"
    );
    assert.equal(partialSnapshot.universeIds.length, 7);
    assert.equal(
      hooks.findGameCcuInHistorySnapshot(partialSnapshot, 46_999),
      777,
      "a partial retry must not erase a game from the prior full union"
    );
    assert.equal(
      hooks.findGameCcuInHistorySnapshot(partialSnapshot, 44_001),
      104,
      "the newer partial observation may refresh games it did receive"
    );
    assert.equal(partial.games, 7);
    assert.equal(hooks.getGameCcuHistoryStateForTests().failureCount, 0);
    assert.equal(hooks.getGameCcuHistoryStateForTests().retryNotBefore, 0);
    chartsFailureStatus = 0;
    chartsFailureFeed = null;
    chartsFailureCredentials = null;
  }

  {
    hooks.resetGameCcuHistoryStateForTests();
    chartsFixturePages = makeFiveChartsFixturePages();
    chartsFixturePagesByFeed = null;
    chartsFixturePagesByAccessFeed = makeAccessScopedChartsFixtureFeeds();
    chartsFailureStatus = 401;
    chartsFailureFeed = "all/all";
    chartsFailureCredentials = "include";
    const fallbackLogStart = requestLog.length;
    const fallback = await hooks.fetchMergedGameCcuChartsPages();
    const fallbackRequests = chartsRequestDetailsSince(fallbackLogStart);
    assert.equal(fallback.partial, true);
    assert.equal(fallback.pageCount, 20);
    assert.equal(fallbackRequests.length, 21);
    assert.equal(
      fallbackRequests.filter((request) => request.credentials === "include").length,
      16,
      "three authenticated feeds should paginate while the rejected feed stops after page one"
    );
    assert.equal(
      fallbackRequests.filter((request) => request.credentials === "omit").length,
      5,
      "only the rejected logical feed may retry anonymously"
    );
    assert.deepEqual(JSON.parse(JSON.stringify(fallback.feeds)), [
      { country: "default", device: "computer", access: "authenticated" },
      { country: "all", device: "computer", access: "authenticated" },
      { country: "default", device: "all", access: "authenticated" },
      { country: "all", device: "all", access: "anonymous-fallback" }
    ]);
    assert.deepEqual(JSON.parse(JSON.stringify(fallback.fallbackFeeds)), [
      { country: "all", device: "all", code: "ROBLOX_UNAVAILABLE" }
    ]);
    assert.deepEqual(JSON.parse(JSON.stringify(fallback.failedFeeds)), []);
    assert.equal(
      new Set(fallbackRequests.map(({ href }) =>
        new URL(href).searchParams.get("sessionId")
      )).size,
      5,
      "the anonymous fallback must start a fresh session without disturbing the other feeds"
    );
    for (const universeId of ["47100", "47101", "47102"]) {
      assert.equal(
        fallback.games.some((game) => game.universeId === universeId),
        true,
        `successful authenticated feed data must survive a sibling fallback: ${universeId}`
      );
    }
    assert.equal(
      fallback.games.some((game) => game.universeId === "47103"),
      false,
      "the fallback feed must not pretend its authenticated-only card was observed"
    );
    assert.equal(
      fallback.games.some((game) => game.universeId === "46994"),
      true,
      "the anonymous fallback still contributes its honest public games"
    );
    chartsFixturePagesByAccessFeed = null;
    chartsFailureStatus = 0;
    chartsFailureFeed = null;
    chartsFailureCredentials = null;
  }

  {
    hooks.resetGameCcuHistoryStateForTests();
    hooks.setGameCcuHistoryStorageOverrideForTests({
      append(snapshot) { return snapshot.universeIds.length; },
      read(universeId) { return { universeId, tracked: false, points: [] }; }
    });
    chartsFixturePages = makeFiveChartsFixturePages();
    chartsFailureStatus = 429;
    chartsFailureFeed = null;
    chartsFailureCredentials = null;
    const failureNow = 900 * historyConstants.bucketMs;
    const failureLogStart = requestLog.length;
    const failure = await hooks.runGameCcuHistoryCollection({ now: failureNow });
    assert.equal(failure.ok, false);
    assert.equal(failure.code, "RATE_LIMITED");
    assert.ok(failure.retryAt >= failureNow + 5 * 60_000);
    assert.equal(chartsRequestsSince(failureLogStart).length, 4);
    assert.equal(
      chartsRequestDetailsSince(failureLogStart)
        .every((request) => request.credentials === "include"),
      true,
      "four authenticated 429s must not fan out into four anonymous retries"
    );
    assert.equal(hooks.getGameCcuHistoryStateForTests().failureCount, 1);
    const requestsAfterFailure = requestLog.length;
    chartsFailureStatus = 0;
    const skipped = await hooks.runGameCcuHistoryCollection({ now: failureNow + 1 });
    assert.equal(skipped.skipped, "BACKOFF");
    assert.equal(requestLog.length, requestsAfterFailure, "backoff must suppress network retries");
    const recovered = await hooks.runGameCcuHistoryCollection({ now: failure.retryAt });
    assert.equal(recovered.ok, true);
    assert.equal(recovered.pages, 20);
    assert.equal(hooks.getGameCcuHistoryStateForTests().failureCount, 0);
    assert.equal(chartsRequestsSince(failureLogStart).length, 24);
  }

  {
    hooks.resetGameCcuHistoryStateForTests();
    let appendedSnapshots = 0;
    let historyReads = 0;
    hooks.setGameCcuHistoryStorageOverrideForTests({
      append() {
        appendedSnapshots += 1;
        return 1;
      },
      read(universeId) {
        historyReads += 1;
        return {
          universeId,
          tracked: universeId === "7777",
          points: universeId === "7777"
            ? [
                { timestamp: 6_000_000, playing: 70 },
                { timestamp: 6_300_000, playing: 77 }
              ]
            : []
        };
      }
    });
    hooks.resetGameCcuStateForTests();
    const homeCount = await sendCcu([
      { placeId: "2777", universeId: "7777" }
    ], 7_777);
    assert.equal(homeCount.response.ok, true);
    assert.equal(
      appendedSnapshots,
      0,
      "ordinary Home player-count responses must never be merged into Charts history"
    );
    const gamesRequestsBeforeHistory = gameRequestsSince(0).length;
    const history = await sendCcuHistory("7777", 8_888);
    assert.equal(history.keepChannel, true);
    assert.deepEqual(JSON.parse(JSON.stringify(history.response)), {
      ok: true,
      requestId: 8_888,
      universeId: "7777",
      tracked: true,
      points: [
        { timestamp: 6_000_000, playing: 70 },
        { timestamp: 6_300_000, playing: 77 }
      ]
    });
    assert.equal(historyReads, 1);
    assert.equal(
      gameRequestsSince(0).length,
      gamesRequestsBeforeHistory,
      "a history query must read local snapshots without a fresh /v1/games request"
    );
    const untracked = await sendCcuHistory("8888", 8_889);
    assert.equal(untracked.response.tracked, false);
    assert.deepEqual(JSON.parse(JSON.stringify(untracked.response.points)), []);

    hooks.resetGameCcuHistoryStateForTests();
    hooks.setGameCcuHistoryStorageOverrideForTests({
      append() { return 1; },
      read(universeId) {
        return {
          universeId,
          tracked: true,
          points: [
            { timestamp: 6_600_000, playing: 820 },
            { timestamp: 6_900_000, playing: 842 }
          ]
        };
      }
    });
    const placeResolutionLogStart = requestLog.length;
    const placeOnlyHistory = await sendCcuHistory(
      { placeId: "698" },
      8_890
    );
    assert.equal(placeOnlyHistory.keepChannel, true);
    assert.deepEqual(JSON.parse(JSON.stringify(placeOnlyHistory.response)), {
      ok: true,
      requestId: 8_890,
      universeId: "5698",
      placeId: "698",
      tracked: true,
      points: [
        { timestamp: 6_600_000, playing: 820 },
        { timestamp: 6_900_000, playing: 842 }
      ]
    });
    assert.equal(
      requestLog.slice(placeResolutionLogStart).some((href) =>
        new URL(href).pathname === "/universes/v1/places/698/universe"
      ),
      true,
      "place-only native counts must resolve their universe in the background"
    );
  }

  {
    assert.equal(hooks.getTrustedRobloxChartsTabId(trustedChartsSender), 18);
    assert.equal(
      hooks.getTrustedRobloxChartsTabId({
        ...trustedChartsSender,
        tab: { id: 18, url: "https://www.roblox.com/charts/v2/top-playing" },
        url: "https://www.roblox.com/charts/v2/top-playing"
      }),
      18,
      "same-origin nested Charts routes are part of the trusted Charts surface"
    );
    for (const sender of [
      trustedSender,
      { ...trustedChartsSender, frameId: 1 },
      {
        ...trustedChartsSender,
        tab: { id: 18, url: "https://web.roblox.com/charts" },
        url: "https://web.roblox.com/charts"
      },
      {
        ...trustedChartsSender,
        tab: { id: 18, url: "https://www.roblox.com/charts-extra" },
        url: "https://www.roblox.com/charts-extra"
      },
      {
        ...trustedChartsSender,
        url: "https://www.roblox.com/home"
      }
    ]) {
      assert.equal(
        hooks.getTrustedRobloxChartsTabId(sender),
        null,
        "only a matching top-frame www.roblox.com Charts route may seed history"
      );
    }
  }

  {
    hooks.resetGameCcuHistoryStateForTests();
    hooks.resetGameCcuStateForTests();
    const currentBucket = Math.floor(Date.now() / historyConstants.bucketMs) *
      historyConstants.bucketMs;
    let storedPoint = null;
    const appendCalls = [];
    hooks.setGameCcuHistoryStorageOverrideForTests({
      append(snapshot, options) {
        appendCalls.push({ snapshot, options });
        storedPoint = {
          timestamp: snapshot.timestamp,
          playing: hooks.findGameCcuInHistorySnapshot(snapshot, 5_004)
        };
        return snapshot.universeIds.length;
      },
      read(universeId) {
        return {
          universeId,
          tracked: Boolean(storedPoint),
          points: storedPoint ? [storedPoint] : []
        };
      }
    });
    const seedLogStart = requestLog.length;
    const seeded = await sendCcuHistory("5004", 9_004, trustedChartsSender);
    assert.equal(seeded.keepChannel, true);
    assert.equal(gameRequestsSince(seedLogStart).length, 1);
    assert.equal(appendCalls.length, 1);
    assert.equal(appendCalls[0].options?.preserveExistingBucket, true);
    assert.equal(appendCalls[0].snapshot.timestamp, currentBucket);
    assert.deepEqual(JSON.parse(JSON.stringify(seeded.response)), {
      ok: true,
      requestId: 9_004,
      universeId: "5004",
      tracked: true,
      points: [{ timestamp: currentBucket, playing: 354 }]
    });
    assert.equal(
      hooks.hasCurrentGameCcuHistoryPoint(
        { points: seeded.response.points },
        currentBucket
      ),
      true
    );
  }

  {
    hooks.resetGameCcuHistoryStateForTests();
    hooks.resetGameCcuStateForTests();
    const currentBucket = Math.floor(Date.now() / historyConstants.bucketMs) *
      historyConstants.bucketMs;
    let appendCount = 0;
    hooks.setGameCcuHistoryStorageOverrideForTests({
      append() {
        appendCount += 1;
        return 1;
      },
      read(universeId) {
        return {
          universeId,
          tracked: true,
          points: [{ timestamp: currentBucket, playing: 123 }]
        };
      }
    });
    const freshLogStart = requestLog.length;
    const fresh = await sendCcuHistory("5004", 9_005, trustedChartsSender);
    assert.equal(fresh.response.tracked, true);
    assert.deepEqual(JSON.parse(JSON.stringify(fresh.response.points)), [
      { timestamp: currentBucket, playing: 123 }
    ]);
    assert.equal(gameRequestsSince(freshLogStart).length, 0);
    assert.equal(appendCount, 0, "a current-bucket point must make seeding a no-op");
  }

  {
    hooks.resetGameCcuHistoryStateForTests();
    hooks.resetGameCcuStateForTests();
    let appendCount = 0;
    hooks.setGameCcuHistoryStorageOverrideForTests({
      append() {
        appendCount += 1;
        return 1;
      },
      read(universeId) {
        return { universeId, tracked: false, points: [] };
      }
    });
    const homeLogStart = requestLog.length;
    const home = await sendCcuHistory("5004", 9_006, trustedSender);
    assert.equal(home.response.tracked, false);
    assert.deepEqual(JSON.parse(JSON.stringify(home.response.points)), []);
    assert.equal(gameRequestsSince(homeLogStart).length, 0);
    assert.equal(appendCount, 0, "Home and non-Charts pages must never seed snapshots");

    const gamePageSender = {
      ...trustedSender,
      tab: { id: 19, url: "https://www.roblox.com/games/5004/fixture" },
      url: "https://www.roblox.com/games/5004/fixture"
    };
    const gamePageLogStart = requestLog.length;
    const gamePage = await sendCcuHistory("5004", 9_010, gamePageSender);
    assert.equal(gamePage.response.tracked, false);
    assert.equal(gameRequestsSince(gamePageLogStart).length, 0);
    assert.equal(appendCount, 0);

    const invalidLogStart = requestLog.length;
    const invalid = await sendCcuHistory("5002", 9_007, trustedChartsSender);
    assert.equal(invalid.response.tracked, false);
    assert.deepEqual(JSON.parse(JSON.stringify(invalid.response.points)), []);
    assert.equal(gameRequestsSince(invalidLogStart).length, 1);
    assert.equal(
      appendCount,
      0,
      "a missing or invalid public count must preserve an honest empty history"
    );
  }

  {
    hooks.resetGameCcuHistoryStateForTests();
    hooks.resetGameCcuStateForTests();
    const currentBucket = Math.floor(Date.now() / historyConstants.bucketMs) *
      historyConstants.bucketMs;
    let storedPoint = null;
    const appendOptions = [];
    hooks.setGameCcuHistoryStorageOverrideForTests({
      append(snapshot, options) {
        appendOptions.push(options);
        storedPoint = {
          timestamp: snapshot.timestamp,
          playing: hooks.findGameCcuInHistorySnapshot(snapshot, 5_004)
        };
        return snapshot.universeIds.length;
      },
      read(universeId) {
        return {
          universeId,
          tracked: Boolean(storedPoint),
          points: storedPoint ? [storedPoint] : []
        };
      }
    });
    gamesFetchPaused = true;
    gamesFetchGate = new Promise((resolve) => { releaseGamesFetch = resolve; });
    const concurrentSeedLogStart = requestLog.length;
    const firstSeed = sendCcuHistory("5004", 9_008, trustedChartsSender);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const secondSeed = sendCcuHistory("5004", 9_009, trustedChartsSender);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(
      gameRequestsSince(concurrentSeedLogStart).length,
      1,
      "simultaneous Chart hovers must share the public count request"
    );
    releaseGamesFetch();
    const [firstSeeded, secondSeeded] = await Promise.all([firstSeed, secondSeed]);
    gamesFetchPaused = false;
    for (const result of [firstSeeded, secondSeeded]) {
      assert.equal(result.response.tracked, true);
      assert.deepEqual(JSON.parse(JSON.stringify(result.response.points)), [
        { timestamp: currentBucket, playing: 354 }
      ]);
    }
    assert.equal(
      appendOptions.every((options) => options?.preserveExistingBucket === true),
      true,
      "every coalesced seed write must safely merge its current bucket"
    );
  }

  hooks.resetGameCcuHistoryStateForTests();
  chartsFixturePages = null;
  chartsFixtureLocalPages = null;
  chartsFixturePagesByFeed = null;
  chartsFixturePagesByAccessFeed = null;
  chartsFailureStatus = 0;
  chartsFailureFeed = null;
  chartsFailureCredentials = null;

  const validGames = [
    ...Array.from({ length: 50 }, (_, index) => ({
      placeId: String(index + 1),
      universeId: String(index + 5_001)
    }))
  ];
  const normalized = hooks.normalizeGameCcuRequestGames(validGames);
  assert.equal(normalized.length, 50, "a content request must be capped at 50 valid cards");
  const deduplicated = hooks.normalizeGameCcuRequestGames([
    { placeId: "1", universeId: null },
    { placeId: "1", universeId: "5001" },
    { placeId: "2", universeId: "5002" }
  ]);
  assert.equal(
    deduplicated.filter((game) => game.placeId === "1").length,
    1,
    "repeated card/place IDs must be deduplicated before network work"
  );
  assert.equal(
    deduplicated[0].universeId,
    null,
    "the first valid place mapping must win deterministically"
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(hooks.normalizeGameCcuRequestGames([
      { placeId: "1", universeId: "5001" },
      { placeId: "1", universeId: "9999" }
    ]))),
    [{ placeId: "1", universeId: "5001" }],
    "a later duplicate must not replace the first mapping"
  );
  assert.equal(
    hooks.normalizeGameCcuRequestGames([
      ...Array.from({ length: 51 }, (_, index) => ({
        placeId: String(index + 1),
        universeId: String(index + 5_001)
      }))
    ]).length,
    50,
    "normalization must stop at the 50-card boundary"
  );
  assert.equal(
    hooks.normalizeGameCcuRequestGames([{ placeId: "0", universeId: "1" }]),
    null,
    "invalid identifiers must reject the request before any network work"
  );
  assert.equal(
    hooks.normalizeGameCcuRequestGames([{ placeId: 1, universeId: "5001" }]),
    null,
    "the content/background wire contract must not coerce numeric place IDs"
  );
  assert.equal(
    hooks.normalizeGameCcuRequestGames([{ placeId: "1", universeId: 5001 }]),
    null,
    "the content/background wire contract must not coerce numeric universe IDs"
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(hooks.normalizeGameCcuRequestGames([
      { placeId: "1", universeId: "5001", needsRating: true },
      { placeId: "2", universeId: "5002", needsRating: false }
    ]))),
    [
      { placeId: "1", universeId: "5001", needsRating: true },
      { placeId: "2", universeId: "5002" }
    ],
    "rating enrichment must be explicit while legacy CCU request rows stay unchanged"
  );

  hooks.resetGameCcuStateForTests();
  const validationLogStart = requestLog.length;
  const validation = await sendCcu([
    { placeId: "101", universeId: "5001" },
    { placeId: "102", universeId: "5002" },
    { placeId: "103", universeId: "5003" },
    { placeId: "104", universeId: "5004" },
    { placeId: "105", universeId: "5004" }
  ], 81);
  assert.equal(validation.keepChannel, true);
  assert.equal(validation.response?.ok, true);
  assert.equal(validation.response?.requestId, 81);
  assert.deepEqual(
    JSON.parse(JSON.stringify(validation.response.games)),
    [
      { placeId: "101", universeId: "5001", playing: 0 },
      { placeId: "104", universeId: "5004", playing: 354 },
      { placeId: "105", universeId: "5004", playing: 354 }
    ],
    "zero is valid, while negative and non-integer CCU rows must be omitted"
  );
  const validationRequests = gameRequestsSince(validationLogStart);
  assert.equal(validationRequests.length, 1, "all uncached universes must share one games request");
  assert.deepEqual(
    new URL(validationRequests[0]).searchParams.get("universeIds").split(","),
    ["5001", "5002", "5003", "5004"],
    "the batched games request must deduplicate universe IDs without changing order"
  );

  const cachedLogStart = requestLog.length;
  const cached = await sendCcu([
    { placeId: "201", universeId: "5001" },
    { placeId: "202", universeId: "5002" },
    { placeId: "203", universeId: "5003" },
    { placeId: "204", universeId: "5004" }
  ], 82);
  assert.equal(cached.response?.games?.[0]?.playing, 0);
  assert.equal(cached.response?.games?.[1]?.playing, 354);
  assert.equal(
    gameRequestsSince(cachedLogStart).length,
    0,
    "a remount inside the 30-second TTL must reuse valid and rejected CCU rows"
  );

  hooks.resetGameCcuStateForTests();
  gamesFetchPaused = true;
  gamesFetchGate = new Promise((resolve) => { releaseGamesFetch = resolve; });
  const concurrentLogStart = requestLog.length;
  const firstPending = sendCcu([{ placeId: "301", universeId: "5004" }], 83);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const secondPending = sendCcu([{ placeId: "302", universeId: "5004" }], 84);
  await new Promise((resolve) => setTimeout(resolve, 0));
  releaseGamesFetch();
  const [firstConcurrent, secondConcurrent] = await Promise.all([
    firstPending,
    secondPending
  ]);
  gamesFetchPaused = false;
  assert.equal(firstConcurrent.response?.games?.[0]?.playing, 354);
  assert.equal(secondConcurrent.response?.games?.[0]?.playing, 354);
  assert.equal(
    gameRequestsSince(concurrentLogStart).length,
    1,
    "simultaneous tabs/cards for one uncached universe must share in-flight work"
  );

  hooks.resetGameCcuStateForTests();
  const capLogStart = requestLog.length;
  const overCap = await sendCcu(
    Array.from({ length: 55 }, (_, index) => ({
      placeId: String(10_000 + index),
      universeId: String(20_000 + index)
    })),
    85
  );
  assert.equal(overCap.keepChannel, false);
  assert.equal(overCap.response?.ok, false);
  assert.equal(overCap.response?.code, "INVALID");
  assert.equal(
    requestLog.length,
    capLogStart,
    "an over-limit wire request must be rejected before any network work"
  );

  const capped = await sendCcu(
    Array.from({ length: 50 }, (_, index) => ({
      placeId: String(10_000 + index),
      universeId: String(20_000 + index)
    })),
    851
  );
  assert.equal(capped.keepChannel, true);
  assert.equal(capped.response?.ok, true);
  assert.equal(capped.response?.games?.length, 50);
  const capRequests = gameRequestsSince(capLogStart);
  assert.equal(
    capRequests.length,
    1,
    "one normalized request must produce one batched games lookup"
  );
  assert.equal(
    new URL(capRequests[0]).searchParams.get("universeIds").split(",").length,
    50,
    "Roblox's universe batch must never exceed 50 IDs"
  );

  hooks.resetGameCcuStateForTests();
  const resolutionLogStart = requestLog.length;
  const resolved = await sendCcu([
    { placeId: "401", universeId: "5004" },
    { placeId: "900", universeId: null }
  ], 86);
  assert.equal(resolved.response?.ok, true);
  const resolutionRequests = requestLog.slice(resolutionLogStart).filter((href) =>
    new URL(href).pathname.startsWith("/universes/v1/places/")
  );
  assert.deepEqual(
    resolutionRequests.map((href) => new URL(href).pathname),
    ["/universes/v1/places/900/universe"],
    "only cards without a usable universe ID should spend a place-resolution request"
  );

  hooks.resetGameCcuStateForTests();
  const ratingLogStart = requestLog.length;
  const enriched = await sendCcu([
    { placeId: "501", universeId: "6001", needsRating: true },
    { placeId: "502", universeId: "6002", needsRating: true },
    { placeId: "503", universeId: "6003", needsRating: true },
    { placeId: "504", universeId: "6004" }
  ], 87);
  assert.equal(enriched.response?.ok, true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(enriched.response?.games)),
    [
      {
        placeId: "501",
        universeId: "6001",
        playing: 1,
        ratingKnown: true,
        ratingPercentage: 93
      },
      {
        placeId: "502",
        universeId: "6002",
        playing: 2,
        ratingKnown: true,
        ratingPercentage: null
      },
      { placeId: "503", universeId: "6003", playing: 3 },
      { placeId: "504", universeId: "6004", playing: 4 }
    ],
    "only requested, strictly valid vote totals may enrich otherwise unchanged CCU rows"
  );
  const ratingRequests = ratingRequestsSince(ratingLogStart);
  assert.equal(ratingRequests.length, 1, "requested ratings must share one votes batch");
  assert.deepEqual(
    new URL(ratingRequests[0]).searchParams.get("universeIds").split(","),
    ["6001", "6002", "6003"],
    "the vote batch must omit cards that already have or do not need a rating"
  );
  const cachedRatingLogStart = requestLog.length;
  const cachedNoVotes = await sendCcu([
    { placeId: "602", universeId: "6002", needsRating: true }
  ], 88);
  assert.equal(cachedNoVotes.response?.games?.[0]?.ratingKnown, true);
  assert.equal(cachedNoVotes.response?.games?.[0]?.ratingPercentage, null);
  assert.equal(
    ratingRequestsSince(cachedRatingLogStart).length,
    0,
    "a known zero-vote rating must be cached instead of refetched"
  );

  console.log(
    "PASS game-tile CCU counts, Charts history, graph behavior, accessibility, and external coexistence"
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
