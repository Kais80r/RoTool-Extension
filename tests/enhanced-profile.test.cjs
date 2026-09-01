"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const contentPath = path.join(projectRoot, "content.js");
const content = fs.readFileSync(contentPath, "utf8");
const manifest = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "manifest.json"), "utf8")
);

globalThis.__rslContentTestHooks = { skipInitialize: true };
require(contentPath);
const hooks = globalThis.__rslContentTestHooks;

assert.deepEqual(
  hooks.parseEnhancedProfileRoute("https://www.roblox.com/users/123/profile"),
  { userId: "123", standardView: false }
);
assert.deepEqual(
  hooks.parseEnhancedProfileRoute(
    "https://www.roblox.com/de/users/123/profile/?foo=bar#creations"
  ),
  { userId: "123", standardView: false }
);
assert.deepEqual(
  hooks.parseEnhancedProfileRoute(
    "https://www.roblox.com/users/123?rotoolProfile=standard"
  ),
  { userId: "123", standardView: true }
);
assert.equal(
  hooks.getEnhancedProfileUrlWithoutStandardQueryForTests(
    "https://www.roblox.com/de/users/123/profile?foo=bar&rotoolProfile=standard#creations"
  ),
  "https://www.roblox.com/de/users/123/profile?foo=bar#creations"
);
assert.equal(
  hooks.parseEnhancedProfileRoute("https://www.roblox.com/users/123/inventory"),
  null
);
assert.equal(
  hooks.parseEnhancedProfileRoute("https://evil.example/users/123/profile"),
  null
);
assert.deepEqual(
  hooks.parseEnhancedProfileRoute("https://www.roblox.com/users/9007199254740992/profile"),
  { userId: "9007199254740992", standardView: false }
);
assert.equal(
  hooks.parseEnhancedProfileRoute("https://www.roblox.com/users/123456789012345678901/profile"),
  null
);

assert.equal(
  hooks.isSafeEnhancedProfileImageUrl("https://tr.rbxcdn.com/image.webp"),
  true
);
for (const unsafeUrl of [
  "javascript:alert(1)",
  "data:image/png;base64,AA==",
  "https://rbxcdn.com.evil.example/image.webp",
  "http://tr.rbxcdn.com/image.webp"
]) {
  assert.equal(hooks.isSafeEnhancedProfileImageUrl(unsafeUrl), false, unsafeUrl);
}

const normalized = hooks.normalizeEnhancedProfileResponse({
  ok: true,
  requestId: 4,
  userId: "123",
  fetchedAt: 1234,
  sections: {
    identity: {
      status: "ready",
      data: {
        userId: "123",
        username: "Fixture",
        displayName: "Fixture <script>alert(1)</script>",
        description: "<img src=x onerror=alert(1)>",
        createdAt: "2020-01-01T00:00:00.000Z",
        headshotUrl: "javascript:alert(1)",
        avatarUrl: "https://tr.rbxcdn.com/avatar.webp"
      }
    },
    presence: {
      status: "ready",
      data: { type: "offline", lastOnline: "2026-08-29T10:00:00.000Z" }
    },
    counts: {
      status: "ready",
      data: { friends: 1, followers: 2, following: 3, complete: true }
    },
    usernames: {
      status: "ready",
      data: { items: ["Old", "Old", "Older"], hasMore: false }
    },
    wearing: {
      status: "ready",
      data: {
        items: [{
          assetId: "7001",
          name: "Hat",
          price: 72,
          iconUrl: "https://tr.rbxcdn.com/hat.webp"
        }, {
          itemType: "Bundle",
          itemId: "667",
          name: "Oldschool Animation Pack",
          price: null,
          priceStatus: "Off Sale",
          iconUrl: "https://tr.rbxcdn.com/bundle.webp"
        }]
      }
    },
    experiences: {
      status: "ready",
      data: {
        items: [{
          universeId: "10",
          rootPlaceId: "11",
          name: "Game",
          ratingPercent: 91,
          iconUrl: "https://tr.rbxcdn.com/game.webp"
        }],
        totalCount: 12,
        countIsExact: true
      }
    },
    favorites: { status: "ready", data: { items: [] } },
    friends: {
      status: "ready",
      data: {
        items: [{
          userId: "456",
          username: "Friend",
          displayName: "Friend",
          headshotUrl: "https://evil.example/a.webp"
        }]
      }
    },
    relationships: {
      status: "ready",
      data: {
        mutualFriendsCount: 2,
        mutualFriendsAvailable: true,
        profileLimited: false,
        mutualGroupsCount: 4,
        isFriend: true,
        canChat: true,
        hasMore: true,
        items: [{
          userId: "789",
          username: "Mutual",
          displayName: "Mutual Friend",
          headshotUrl: "https://evil.example/mutual.webp"
        }]
      }
    },
    communities: {
      status: "ready",
      data: {
        items: [{
          communityId: "8001",
          name: "Community",
          memberCount: 100,
          role: "Member",
          iconUrl: "javascript:alert(1)"
        }],
        totalCount: 8,
        ownedCount: 2
      }
    },
    badges: {
      status: "ready",
      data: {
        items: [{
          badgeId: "9001",
          name: "Badge",
          iconUrl: "https://tr.rbxcdn.com/badge.webp"
        }],
        totalCount: 245,
        countIsExact: true
      }
    },
    inventory: {
      status: "ready",
      data: { visibility: "public" }
    }
  }
}, 4, "123");

assert.ok(normalized);
assert.equal(normalized.sections.identity.data.headshotUrl, null);
assert.equal(
  normalized.sections.identity.data.avatarUrl,
  "https://tr.rbxcdn.com/avatar.webp"
);
assert.equal(normalized.sections.friends.data.items[0].headshotUrl, null);
assert.equal(normalized.sections.relationships.data.mutualFriendsCount, 2);
assert.equal(normalized.sections.relationships.data.mutualFriendsAvailable, true);
assert.equal(normalized.sections.relationships.data.profileLimited, false);
assert.equal(normalized.sections.relationships.data.mutualGroupsCount, 4);
assert.equal(normalized.sections.relationships.data.isFriend, true);
assert.equal(normalized.sections.relationships.data.canChat, true);
assert.equal(normalized.sections.relationships.data.items[0].headshotUrl, null);
assert.equal(normalized.sections.communities.data.items[0].iconUrl, null);
assert.equal(normalized.sections.communities.data.totalCount, 8);
assert.equal(normalized.sections.communities.data.ownedCount, 2);
assert.equal(normalized.sections.wearing.data.items[0].price, 72);
assert.equal(normalized.sections.wearing.data.items[0].itemType, "Asset");
assert.equal(normalized.sections.wearing.data.items[0].itemId, "7001");
assert.equal(normalized.sections.wearing.data.items[1].itemType, "Bundle");
assert.equal(normalized.sections.wearing.data.items[1].itemId, "667");
assert.equal(normalized.sections.wearing.data.items[1].priceStatus, "Off Sale");
assert.deepEqual(
  normalized.sections.usernames.data.items,
  ["Old", "Older"]
);
assert.equal(normalized.sections.experiences.data.items[0].ratingPercent, 91);
assert.equal(normalized.sections.experiences.data.totalCount, 12);
assert.equal(normalized.sections.experiences.data.countIsExact, true);
assert.equal(normalized.sections.badges.data.totalCount, 245);
assert.equal(normalized.sections.badges.data.countIsExact, true);
assert.equal(normalized.sections.badges.data.countStatus, "ready");
assert.equal(normalized.sections.inventory.data.visibility, "public");
assert.equal(
  hooks.getEnhancedProfileBadgeCountLabelForTests(normalized.sections.badges),
  "245"
);

const pendingBadgeResponse = JSON.parse(JSON.stringify(normalized));
pendingBadgeResponse.ok = true;
pendingBadgeResponse.requestId = 5;
pendingBadgeResponse.sections.badges.data.totalCount = 100;
pendingBadgeResponse.sections.badges.data.countIsExact = false;
pendingBadgeResponse.sections.badges.data.countStatus = "pending";
const pendingBadges = hooks.normalizeEnhancedProfileResponse(
  pendingBadgeResponse,
  5,
  "123"
).sections.badges;
assert.equal(pendingBadges.status, "ready");
assert.equal(pendingBadges.data.totalCount, 100);
assert.equal(pendingBadges.data.countStatus, "pending");
assert.equal(
  hooks.getEnhancedProfileBadgeCountLabelForTests(pendingBadges),
  "100+"
);
pendingBadges.data.countStatus = "unavailable";
assert.equal(
  hooks.getEnhancedProfileBadgeCountLabelForTests(pendingBadges),
  "100+",
  "a failed exact count keeps the last verified lower bound"
);
assert.equal(
  hooks.getEnhancedProfileBadgeCountLabelForTests({
    status: "ready",
    data: {
      items: [],
      hasMore: false,
      totalCount: null,
      countIsExact: false,
      countStatus: "private"
    }
  }),
  "Private"
);
assert.deepEqual(
  hooks.normalizeEnhancedProfileBadgeCountResponse({
    ok: true,
    requestId: 6,
    userId: "123",
    totalCount: 350,
    countIsExact: true,
    countStatus: "ready",
    fetchedAt: 4321
  }, 6, "123", 300),
  {
    totalCount: 350,
    countIsExact: true,
    countStatus: "ready",
    fetchedAt: 4321
  }
);
assert.equal(
  hooks.normalizeEnhancedProfileBadgeCountResponse({
    ok: true,
    requestId: 6,
    userId: "999",
    totalCount: 350,
    countIsExact: true,
    countStatus: "ready"
  }, 6, "123", 300),
  null
);
const invalidRelationshipResponse = JSON.parse(JSON.stringify(normalized));
invalidRelationshipResponse.ok = true;
invalidRelationshipResponse.requestId = 4;
invalidRelationshipResponse.sections.relationships.data.canChat = "yes";
assert.equal(
  hooks.normalizeEnhancedProfileResponse(
    invalidRelationshipResponse,
    4,
    "123"
  ).sections.relationships.status,
  "unavailable"
);
const privateRelationshipResponse = JSON.parse(JSON.stringify(normalized));
privateRelationshipResponse.ok = true;
privateRelationshipResponse.requestId = 4;
privateRelationshipResponse.sections.relationships.data.mutualFriendsAvailable = false;
privateRelationshipResponse.sections.relationships.data.profileLimited = true;
assert.equal(
  hooks.normalizeEnhancedProfileResponse(
    privateRelationshipResponse,
    4,
    "123"
  ).sections.relationships.data.mutualFriendsAvailable,
  false
);
assert.equal(
  hooks.normalizeEnhancedProfileResponse(
    privateRelationshipResponse,
    4,
    "123"
  ).sections.relationships.data.profileLimited,
  true
);
assert.equal(
  hooks.normalizeEnhancedProfileResponse({ ...normalized, ok: true }, 4, "999"),
  null
);

assert.match(
  content,
  /key: "enhancedProfiles"[\s\S]*?group: "Interface"[\s\S]*?label: "Enhanced Profiles"/
);
assert.match(content, /attachShadow\(\{ mode: "closed" \}\)/);
assert.match(content, /rsl:get-enhanced-profile-badge-count/);
assert.match(content, /rsl:enhanced-profile-badge-count-progress/);
assert.match(content, /rsl:get-enhanced-profile-relationships/);
assert.match(content, /rtp-robux-icon/);
assert.match(
  content,
  /function makeEnhancedProfileGameFallback\(\) \{\s*return makeEnhancedProfileLandscapeFallback\("rtp-game-fallback"\);\s*\}/
);
assert.match(
  content,
  /function makeEnhancedProfileBaseFallback\(\) \{\s*return makeEnhancedProfileLandscapeFallback\("rtp-base-fallback"\);\s*\}/
);
assert.equal(
  (content.match(/M4 5a2 2 0 0 1 2-2h12/g) || []).length,
  1,
  "game and general image fallbacks share the same landscape artwork"
);
assert.doesNotMatch(content, /function makeEnhancedProfilePresenceIcon\(/);
assert.match(content, /"game icon-game"/);
assert.match(content, /"studio icon-studio"/);
assert.match(content, /"online icon-online"/);
assert.match(content, /status\.className = "avatar-status"/);
assert.match(content, /icon\.dataset\.testid = "presence-icon"/);
assert.match(
  content,
  /\$\{presenceRoot\} > \.avatar\.avatar-card-fullbody \{[\s\S]*?width: 100% !important;[\s\S]*?height: 100% !important;/
);
assert.match(content, /"View standard profile"/);
assert.doesNotMatch(content, /View standard Roblox profile/);
assert.match(content, /viewBox", "0 0 20 20"/);
assert.match(content, /M15\.6 5\.1C16\.5 5\.6/);
assert.match(content, /color: #bdbebe/);
assert.doesNotMatch(content, /viewBox="0 112 28 28"/);
assert.doesNotMatch(content, /function makeEnhancedProfileMutualFriendsSection/);
assert.match(
  content,
  /#content > \[\$\{ENHANCED_PROFILE_SUPPRESSED_ATTRIBUTE\}\][\s\S]*?display: none !important/
);
assert.match(
  content,
  /child\.matches\?\.\([\s\S]*?profile-platform-container\[data-profile-type=/
);
assert.match(content, /element\.textContent = String\(textValue\)/);
const enhancedSource = content.slice(
  content.indexOf("  const ENHANCED_PROFILE_CSS"),
  content.indexOf("  function mountExtensionFeatures()")
);
assert.doesNotMatch(
  enhancedSource,
  /document\.getElementById\("content"\)\?\.remove|content\.replaceChildren/
);
assert.ok(
  manifest.host_permissions.includes("https://users.roblox.com/*") &&
  manifest.host_permissions.includes("https://friends.roblox.com/*") &&
  manifest.host_permissions.includes("https://presence.roblox.com/*") &&
  manifest.host_permissions.includes("https://games.roblox.com/*") &&
  manifest.host_permissions.includes("https://avatar.roblox.com/*") &&
  manifest.host_permissions.includes("https://catalog.roblox.com/*") &&
  manifest.host_permissions.includes("https://groups.roblox.com/*") &&
  manifest.host_permissions.includes("https://badges.roblox.com/*") &&
  manifest.host_permissions.includes("https://thumbnails.roblox.com/*")
);
assert.equal(
  manifest.host_permissions.includes("https://inventory.roblox.com/*"),
  true,
  "the public can-view-inventory endpoint powers the profile visibility label"
);

delete globalThis.__rslContentTestHooks;
console.log("PASS Enhanced Profile routes, response allowlist, security, and isolation config");
