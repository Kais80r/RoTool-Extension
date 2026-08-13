"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs
  .readFileSync(path.join(root, "content.js"), "utf8")
  .replace(/\r\n/g, "\n");
const styles = fs
  .readFileSync(path.join(root, "styles.css"), "utf8")
  .replace(/\r\n/g, "\n");

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `${name} must exist`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Could not extract ${name}`);
}

function extractRule(selectorFragment, fromIndex = 0) {
  const selectorStart = styles.indexOf(selectorFragment, fromIndex);
  assert.ok(selectorStart >= 0, `${selectorFragment} CSS rule must exist`);
  const bodyStart = styles.indexOf("{", selectorStart);
  assert.ok(bodyStart >= 0, `${selectorFragment} CSS rule must have a body`);
  const bodyEnd = styles.indexOf("}", bodyStart);
  assert.ok(bodyEnd > bodyStart, `${selectorFragment} CSS rule must close`);
  return styles.slice(bodyStart + 1, bodyEnd);
}

// Long text is retained for both the visible ellipsis and its native tooltip.
// This guards against solving clipping by shortening the actual friend/game data.
const tileSource = extractFunction("makeBestFriendTile");
assert.match(tileSource, /name\.textContent = friend\.displayName;/);
assert.match(tileSource, /name\.title = friend\.displayName;/);
assert.match(
  tileSource,
  /appendFriendNameBadges\(name\.parentElement, friend, true\);/,
  "0-, 1-, and 2-badge layouts must reserve space in the name row only"
);
assert.match(tileSource, /sublabel\.classList\.add\("friends-carousel-tile-experience"\);/);
assert.match(tileSource, /sublabel\.textContent = presence\.label;/);
assert.match(tileSource, /sublabel\.title = presence\.label;/);
assert.doesNotMatch(
  tileSource,
  /(?:const experience|experience\.className|sublabel\.append\(experience\))/,
  "experience text must stay directly in Roblox's native sublabel clamp"
);

// Exercise the content combinations that exposed the alignment bug: a long
// experience title with two badges, a short Online status with one badge, and
// a short Offline status with no badges. All three flow through the same
// sublabel; badges remain isolated to the independent name row.
const getPresencePresentation = new Function(
  `"use strict";\n${extractFunction("getPresencePresentation")}\n` +
    "return getPresencePresentation;"
)();
const badgeFactoryCalls = [];
const appendFriendNameBadges = new Function(
  "makeVerifiedFriendNameBadge",
  "makeRobloxPlusFriendNameBadge",
  `"use strict";\n${extractFunction("appendFriendNameBadges")}\n` +
    "return appendFriendNameBadges;"
)(
  (carouselLayout) => {
    badgeFactoryCalls.push({ kind: "verified", carouselLayout });
    return { kind: "verified" };
  },
  (carouselLayout) => {
    badgeFactoryCalls.push({ kind: "plus", carouselLayout });
    return { kind: "plus" };
  }
);

function makeBadgeContainer() {
  const attributes = new Map();
  const classStates = new Map();
  const children = [];
  return {
    attributes,
    children,
    classList: {
      toggle(name, enabled) {
        classStates.set(name, enabled);
      }
    },
    querySelectorAll() {
      return [];
    },
    append(child) {
      children.push(child);
    },
    setAttribute(name, value) {
      attributes.set(name, value);
    },
    isClassEnabled(name) {
      return classStates.get(name) === true;
    }
  };
}

const presenceAlignmentFixtures = [
  {
    description: "in-game tile with a long title and two badges",
    friend: {
      presenceType: "InGame",
      displayName: "Korn",
      username: "KornWithAnotherAccountName",
      lastLocation: "A deliberately long experience title that must ellipsize",
      rootPlaceId: "101",
      isVerified: true,
      isRobloxPlus: true
    },
    expectedLabel: "A deliberately long experience title that must ellipsize",
    expectedBadgeKinds: ["verified", "plus"]
  },
  {
    description: "online tile with a long name and one badge",
    friend: {
      presenceType: "Online",
      displayName: "A deliberately long Best Friend display name",
      username: "ShortUsername",
      isVerified: true,
      isRobloxPlus: false
    },
    expectedLabel: "Online",
    expectedBadgeKinds: ["verified"]
  },
  {
    description: "offline tile with no badges",
    friend: {
      presenceType: "Offline",
      displayName: "WaitingWait3r",
      username: "DifferentOfflineUsername",
      isVerified: false,
      isRobloxPlus: false
    },
    expectedLabel: "Offline",
    expectedBadgeKinds: []
  }
];

for (const fixture of presenceAlignmentFixtures) {
  const presentation = getPresencePresentation(fixture.friend);
  assert.equal(presentation.label, fixture.expectedLabel, fixture.description);

  badgeFactoryCalls.length = 0;
  const nameContainer = makeBadgeContainer();
  appendFriendNameBadges(nameContainer, fixture.friend, true);
  assert.equal(
    nameContainer.attributes.get("data-rsl-friend-name-badge-count"),
    String(fixture.expectedBadgeKinds.length),
    fixture.description
  );
  assert.deepEqual(
    nameContainer.children.map((badge) => badge.kind),
    fixture.expectedBadgeKinds,
    fixture.description
  );
  assert.deepEqual(
    badgeFactoryCalls.map((call) => call.carouselLayout),
    fixture.expectedBadgeKinds.map(() => true),
    `${fixture.description} must use carousel badge markup`
  );
}

// Best Friends derives its lane from the live native Friends row. Re-running the
// mount after a viewport resize also covers browser zoom, which changes CSS-pixel
// geometry and dispatches resize in Chromium.
const spacingSource = extractFunction("syncBestFriendsTileSpacing");
assert.match(spacingSource, /nativeCenterStep/);
assert.match(spacingSource, /--rsl-best-friends-tile-width/);
assert.match(spacingSource, /--rsl-best-friends-tile-gap/);
assert.doesNotMatch(
  spacingSource,
  /--rsl-best-friends-label-width/,
  "tile spacing must not replace Roblox's narrower native text lane"
);
assert.doesNotMatch(
  styles,
  /--rsl-best-friends-label-width/,
  "Best Friends labels must inherit the native responsive/zoom geometry"
);
assert.match(
  source,
  /window\.addEventListener\("resize", \(\) => \{[\s\S]*?queueMount\(\);[\s\S]*?\}, \{ passive: true \}\);/,
  "responsive and zoomed layouts must remeasure the native Friends row"
);
assert.match(
  source,
  /restoreHomeFriendsContentForMeasurement\(nativeCarousel\);\s*try \{\s*syncBestFriendsTileSpacing\(carousel, nativeCarousel\);/,
  "the visible native row must remain the authoritative Best Friends measurement"
);

const listRule = extractRule(
  ".rsl-best-friends-carousel .friends-carousel-list-container {"
);
assert.match(listRule, /max-width:\s*100%/);
assert.match(listRule, /min-width:\s*0/);
assert.match(listRule, /overflow-x:\s*auto/);
assert.match(listRule, /overflow-y:\s*hidden/);

const itemRule = extractRule(
  ".rsl-best-friends-carousel .friends-carousel-list-container > * {"
);
assert.match(itemRule, /box-sizing:\s*border-box/);
assert.match(itemRule, /width:\s*var\(--rsl-best-friends-tile-width/);
assert.match(itemRule, /min-width:\s*var\(--rsl-best-friends-tile-width/);
assert.match(itemRule, /max-width:\s*var\(--rsl-best-friends-tile-width/);
assert.match(itemRule, /flex:\s*0 0 var\(--rsl-best-friends-tile-width/);

const tileBoxRule = extractRule(
  ".rsl-best-friends-carousel .friends-carousel-list-container > .friends-carousel-tile,"
);
assert.match(tileBoxRule, /box-sizing:\s*border-box/);
assert.match(tileBoxRule, /width:\s*100%\s*!important/);
assert.match(tileBoxRule, /min-width:\s*0\s*!important/);
assert.match(tileBoxRule, /max-width:\s*100%\s*!important/);

// Roblox's cloned experience label can otherwise wrap onto a second visual
// line. Clamp the text itself, but keep its inherited native inner-lane width.
const clonedExperienceRule = extractRule(
  ".rsl-best-friends-carousel\n" +
    "  [data-rsl-best-friend-id]\n" +
    "  .friends-carousel-tile-experience {"
);
assert.match(clonedExperienceRule, /display:\s*block\s*!important/);
assert.match(clonedExperienceRule, /min-inline-size:\s*0/);
assert.match(clonedExperienceRule, /overflow:\s*hidden\s*!important/);
assert.match(clonedExperienceRule, /text-align:\s*center\s*!important/);
assert.match(clonedExperienceRule, /text-overflow:\s*ellipsis\s*!important/);
assert.match(clonedExperienceRule, /white-space:\s*nowrap\s*!important/);
assert.doesNotMatch(
  clonedExperienceRule,
  /(?:^|;)\s*(?:width|max-width|inline-size|max-inline-size)\s*:/,
  "the one-line game label must retain Roblox's inherited native width"
);
assert.doesNotMatch(
  clonedExperienceRule,
  /\b\d+(?:\.\d+)?(?:px|rem|em|vw|vh|%)\b/i,
  "status centering must not depend on a card width, viewport, or font-size measurement"
);

assert.match(
  source,
  /wrapper\.setAttribute\("data-rsl-best-friend-fallback", ""\);/,
  "only synthesized fallback tiles may receive replacement label geometry"
);

const fallbackBoxRule = extractRule(
  ".rsl-best-friends-carousel\n  [data-rsl-best-friend-fallback]\n  :is("
);
for (const nativeLabelClass of [
  ".friends-carousel-tile-labels",
  ".friends-carousel-tile-label",
  ".friends-carousel-tile-name",
  ".friends-carousel-tile-sublabel"
]) {
  assert.match(
    styles,
    new RegExp(
      "\\[data-rsl-best-friend-fallback\\][\\s\\S]*?:is\\([\\s\\S]*?" +
        nativeLabelClass.replaceAll(".", "\\.") +
        "[\\s\\S]*?\\)\\s*\\{"
    )
  );
}
assert.match(fallbackBoxRule, /width:\s*100%/);
assert.match(fallbackBoxRule, /min-width:\s*0\s*!important/);
assert.match(fallbackBoxRule, /max-width:\s*100%/);

const fallbackTextRule = extractRule(
  ".rsl-best-friends-carousel\n  [data-rsl-best-friend-fallback]\n  :is(.friends-carousel-display-name, .friends-carousel-tile-experience) {"
);
assert.match(fallbackTextRule, /max-width:\s*100%/);
assert.match(fallbackTextRule, /min-width:\s*0/);
assert.match(fallbackTextRule, /overflow:\s*hidden/);
assert.match(fallbackTextRule, /text-overflow:\s*ellipsis/);
assert.match(fallbackTextRule, /white-space:\s*nowrap/);

const flexNameRule = extractRule(
  '[data-rsl-friend-name-badges]:not([data-rsl-friend-name-badge-count="0"])\n  > :is(a, strong, .friends-carousel-display-name) {'
);
assert.match(flexNameRule, /min-(?:inline-size|width):\s*0/);
assert.match(flexNameRule, /flex:\s*0 1 auto\s*!important/);
assert.match(flexNameRule, /overflow:\s*hidden/);
assert.match(flexNameRule, /text-overflow:\s*ellipsis/);
assert.match(flexNameRule, /white-space:\s*nowrap/);

const badgeRule = extractRule("[data-rsl-friend-name-badge],");
assert.match(badgeRule, /flex:\s*0 0 auto\s*!important/);
assert.match(badgeRule, /overflow:\s*visible\s*!important/);

assert.match(
  styles,
  /\[data-rsl-friend-name-badges\]:not\(\[data-rsl-friend-name-badge-count="0"\]\)/,
  "one- and two-badge name rows must reserve their badge cluster"
);
assert.doesNotMatch(
  styles,
  /\[data-rsl-friend-name-badges\]\s*\{/,
  "zero-badge names must keep Roblox's natural native sizing"
);

const bestFriendStyleSection = styles.slice(
  styles.indexOf("/* Best Friends keeps Roblox's tile markup"),
  styles.indexOf(".rsl-best-friend-hover-card")
);
for (const nativeLabelClass of [
  ".friends-carousel-tile-labels",
  ".friends-carousel-tile-label",
  ".friends-carousel-tile-name",
  ".friends-carousel-tile-sublabel"
]) {
  const blanketRule = new RegExp(
    `\\[data-rsl-best-friend-id\\][^,{]*${nativeLabelClass.replaceAll(".", "\\.")}[^,{]*\\{[^}]*` +
      "(?:width|max-width):\\s*100%",
    "s"
  );
  assert.doesNotMatch(
    bestFriendStyleSection,
    blanketRule,
    `${nativeLabelClass} on cloned tiles must retain Roblox's native clamp width`
  );
}

// Keep every truncation/layout override local to the cloned Best Friends row;
// the native Friends row remains the visual reference and must not be changed.
assert.doesNotMatch(
  styles,
  /(?:^|\})\s*\.(?:friends-carousel-display-name|friends-carousel-tile-experience|friends-carousel-tile-labels)\s*\{/,
  "RoTool must not globally alter Roblox's native Friends card text"
);

// Any centering rule for this native Roblox class must remain under RoTool's
// cloned Best Friends scope. The normal Friends carousel is the measurement
// authority and must not inherit the alignment override.
const centeredExperienceSelectors = Array.from(
  styles.matchAll(/([^{}]+)\{([^{}]*text-align:\s*center\s*!important[^{}]*)\}/g)
)
  .filter((match) => match[1].includes(".friends-carousel-tile-experience"))
  .map((match) => match[1].trim());
assert.ok(centeredExperienceSelectors.length > 0, "Best Friends status centering must exist");
for (const selector of centeredExperienceSelectors) {
  assert.match(
    selector,
    /\.rsl-best-friends-carousel[\s\S]*\[data-rsl-best-friend-(?:id|fallback)\]/,
    `normal Friends must be unaffected by centered selector: ${selector}`
  );
}

console.log(
  "PASS Best Friends names and statuses share native lanes, center uniformly, and truncate without overflow"
);
