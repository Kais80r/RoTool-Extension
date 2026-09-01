"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "content.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");

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

const location = { href: "https://www.roblox.com/users/123/friends#!/friends" };
const routeHelpers = new Function(
  "location",
  "URL",
  "URLSearchParams",
  `const ENHANCED_PROFILE_LOCALE_SEGMENTS = new Set(["de", "en-us"]);\n` +
    `const MUTUAL_FRIENDS_PAGE_MODE = "mutuals";\n` +
    `${extractFunction("getTargetFriendsPageRoute")}\n` +
    `${extractFunction("getMutualFriendsPageHref")}\n` +
    `return { getTargetFriendsPageRoute, getMutualFriendsPageHref };`
)(location, URL, URLSearchParams);

assert.deepEqual(
  routeHelpers.getTargetFriendsPageRoute(
    "https://www.roblox.com/de/users/123/friends#!/friends?rotool=mutuals"
  ),
  {
    targetUserId: "123",
    pathname: "/de/users/123/friends",
    subview: "friends",
    mutualsActive: true
  }
);
assert.equal(
  routeHelpers.getMutualFriendsPageHref(
    routeHelpers.getTargetFriendsPageRoute(
      "https://www.roblox.com/users/456/friends#!/followers"
    )
  ),
  "/users/456/friends#!/friends?rotool=mutuals"
);
assert.equal(
  routeHelpers.getTargetFriendsPageRoute(
    "https://www.roblox.com/users/123/friends#!/following"
  ).mutualsActive,
  false,
  "native tabs must leave Mutuals mode"
);
assert.equal(
  routeHelpers.getTargetFriendsPageRoute(
    "https://www.roblox.com/users/123/friends#!/friends#mutuals"
  ).mutualsActive,
  true,
  "RoPro's legacy Mutual Friends route must hand over to RoTool"
);
for (const invalid of [
  "https://www.roblox.com/users/friends#!/friends?rotool=mutuals",
  "https://www.roblox.com/users/123/profile#!/friends?rotool=mutuals",
  "https://evil.example/users/123/friends#!/friends?rotool=mutuals",
  "https://www.roblox.com/users/123/friends#!/unknown"
]) {
  assert.equal(routeHelpers.getTargetFriendsPageRoute(invalid), null);
}

const responseHelpers = new Function(
  "URL",
  `${extractFunction("isSafeAvatarUrl")}\n` +
    `${extractFunction("normalizeOnlineFriend")}\n` +
    `${extractFunction("normalizeMutualFriendsPageResponse")}\n` +
    `return { normalizeMutualFriendsPageResponse };`
)(URL);
const response = {
  ok: true,
  requestId: 7,
  viewerUserId: "999",
  targetUserId: "123",
  totalCount: 15,
  friends: Array.from({ length: 15 }, (_, index) => ({
    userId: String(1000 + index),
    username: `User_${index + 1}`,
    displayName: `User ${index + 1}`,
    presenceType: index === 0 ? "InGame" : "Offline",
    isVerified: index === 0,
    isVerifiedKnown: true,
    isRobloxPlus: false,
    isRobloxPlusKnown: true,
    headshotUrl:
      index === 1
        ? "https://evil.example/avatar.webp"
        : `https://tr.rbxcdn.com/avatar-${index}.webp`
  }))
};
const normalized = responseHelpers.normalizeMutualFriendsPageResponse(
  response,
  7,
  "123"
);
assert.equal(normalized.friends.length, 15, "Mutuals must not stop at 10 or 12");
assert.equal(normalized.friends[1].headshotUrl, null, "untrusted images must be removed");
assert.equal(
  responseHelpers.normalizeMutualFriendsPageResponse(
    {
      ...response,
      friends: [...response.friends.slice(0, 14), response.friends[0]]
    },
    7,
    "123"
  ),
  null,
  "duplicates must not make an incomplete list look exact"
);
assert.equal(
  responseHelpers.normalizeMutualFriendsPageResponse(
    { ...response, viewerUserId: "invalid" },
    7,
    "123"
  ),
  null,
  "the background viewer identity must be validated"
);

assert.match(
  source,
  /\/users\/\$\{identity\.userId\}\/friends#!\/friends\?rotool=mutuals/,
  "the profile Mutuals pill must deep-link directly into RoTool's Mutuals tab"
);
assert.match(
  source,
  /mountMutualFriendsPage\(\);\s*mountOnlineFriendsFilter\(\);/,
  "the dedicated target-profile page must mount before own-friends filters"
);
assert.match(
  styles,
  /\[data-rsl-mutual-friends-tabs\]\s*>\s*\*\s*\{[\s\S]*?width:\s*25%\s*!important/,
  "four top-level tabs must share the full width"
);
assert.match(
  styles,
  /\[data-rsl-mutual-friends-competing-hidden\][\s\S]*?display:\s*none\s*!important/,
  "RoPro's competing Mutuals control must yield to RoTool"
);
assert.match(
  styles,
  /\[data-rsl-mutual-friends-view-active\][\s\S]*?ul\.hlist\.avatar-cards:not\(\[data-rsl-mutual-friends-list\]\)[\s\S]*?display:\s*none\s*!important/,
  "late native list replacements must not flash below the Mutuals view"
);
assert.match(
  source,
  /cloneNode\(true\)[\s\S]*?MUTUAL_FRIENDS_SEARCH_ATTRIBUTE/,
  "Mutuals must use a listener-free cloned search field"
);
assert.match(
  styles,
  /data-rsl-mutual-friends-native-search-hidden/,
  "the untouched native search field must be hidden only during Mutuals mode"
);
assert.match(
  styles,
  /\[data-rsl-mutual-friends-native-panel-active\][\s\S]*?display:\s*block\s*!important[\s\S]*?\[data-rsl-mutual-friends-ropro-panel-hidden\][\s\S]*?display:\s*none\s*!important/,
  "RoTool must visibly and reversibly take over RoPro's Mutuals panel"
);

console.log("PASS Mutual Friends route, full-list normalization, priority, and isolation");
