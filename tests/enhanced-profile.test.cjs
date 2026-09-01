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
          creatorType: "group",
          creatorId: "8001",
          creatorName: "Fixture Studio",
          creatorIsVerified: true,
          iconUrl: "https://tr.rbxcdn.com/game.webp"
        }],
        hasMore: false,
        totalCount: 12,
        countIsExact: true,
        coverageIsComplete: true,
        coverageStatus: "complete"
      }
    },
    favorites: {
      status: "ready",
      data: {
        items: [],
        hasMore: false,
        totalCount: 0,
        countIsExact: true,
        coverageIsComplete: true,
        coverageStatus: "complete"
      }
    },
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
        mutualGroups: {
          hasMore: false,
          items: [{
            communityId: "8001",
            name: "Mutual Community",
            memberCount: 1234,
            role: "Member",
            isVerified: true,
            iconUrl: "javascript:alert(1)"
          }, {
            communityId: "8001",
            name: "Duplicate Community",
            memberCount: 10,
            role: "Guest",
            isVerified: false,
            iconUrl: "https://tr.rbxcdn.com/duplicate.webp"
          }, {
            communityId: "8002",
            name: "Second Mutual Community",
            memberCount: 42,
            role: "Owner",
            isVerified: false,
            iconUrl: "https://tr.rbxcdn.com/community.webp"
          }]
        },
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
        ownedCount: 2,
        ownedGroups: {
          hasMore: false,
          items: [{
            communityId: "8201",
            name: "Owned Community",
            memberCount: 500,
            role: "Owner",
            isVerified: true,
            iconUrl: "javascript:alert(1)"
          }, {
            communityId: "8201",
            name: "Duplicate Owned Community",
            memberCount: 1,
            role: "Owner",
            iconUrl: null
          }, {
            communityId: "8202",
            name: "Second Owned Community",
            memberCount: 42,
            role: "Owner",
            iconUrl: "https://tr.rbxcdn.com/owned-community.webp"
          }]
        }
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
assert.equal(normalized.sections.relationships.data.mutualGroups.items.length, 2);
assert.equal(
  normalized.sections.relationships.data.mutualGroups.items[0].communityId,
  "8001"
);
assert.equal(
  normalized.sections.relationships.data.mutualGroups.items[0].iconUrl,
  null
);
assert.equal(
  normalized.sections.relationships.data.mutualGroups.items[1].iconUrl,
  "https://tr.rbxcdn.com/community.webp"
);
assert.equal(normalized.sections.relationships.data.mutualGroups.hasMore, true);
assert.equal(normalized.sections.relationships.data.isFriend, true);
assert.equal(normalized.sections.relationships.data.canChat, true);
assert.equal(normalized.sections.relationships.data.items[0].headshotUrl, null);
assert.equal(normalized.sections.communities.data.items[0].iconUrl, null);
assert.equal(normalized.sections.communities.data.totalCount, 8);
assert.equal(normalized.sections.communities.data.ownedCount, 2);
assert.equal(normalized.sections.communities.data.ownedGroups.items.length, 2);
assert.equal(
  normalized.sections.communities.data.ownedGroups.items[0].iconUrl,
  null
);
assert.equal(
  normalized.sections.communities.data.ownedGroups.items[1].iconUrl,
  "https://tr.rbxcdn.com/owned-community.webp"
);
assert.equal(normalized.sections.communities.data.ownedGroups.hasMore, false);
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
assert.equal(normalized.sections.experiences.data.items[0].creatorType, "group");
assert.equal(normalized.sections.experiences.data.items[0].creatorId, "8001");
assert.equal(
  normalized.sections.experiences.data.items[0].creatorName,
  "Fixture Studio"
);
assert.equal(normalized.sections.experiences.data.items[0].creatorIsVerified, true);
assert.equal(normalized.sections.experiences.data.totalCount, 12);
assert.equal(normalized.sections.experiences.data.countIsExact, true);
assert.equal(
  normalized.sections.experiences.data.coverageIsComplete,
  true
);
assert.equal(
  normalized.sections.experiences.data.coverageStatus,
  "complete"
);
assert.equal(normalized.sections.badges.data.totalCount, 245);
assert.equal(normalized.sections.badges.data.countIsExact, true);
assert.equal(normalized.sections.badges.data.countStatus, "ready");
assert.equal(normalized.sections.inventory.data.visibility, "public");
assert.deepEqual(
  hooks.getEnhancedProfileLimitationsForTests(normalized),
  [],
  "a fully public profile must not be marked limited"
);
const limitedProfile = JSON.parse(JSON.stringify(normalized));
limitedProfile.sections.friends = { status: "unavailable", code: "PRIVATE" };
limitedProfile.sections.relationships.data.profileLimited = true;
limitedProfile.sections.communities = { status: "unavailable", code: "PRIVATE" };
limitedProfile.sections.inventory.data.visibility = "limited";
limitedProfile.sections.badges.data = {
  items: [],
  hasMore: false,
  totalCount: null,
  countIsExact: false,
  countStatus: "private"
};
limitedProfile.sections.experiences = { status: "unavailable", code: "PRIVATE" };
assert.deepEqual(
  hooks.getEnhancedProfileLimitationsForTests(limitedProfile),
  [
    { label: "Friends", status: "Private" },
    { label: "Mutual friends", status: "Limited" },
    { label: "Communities", status: "Private" },
    { label: "Inventory", status: "Private" },
    { label: "Badges", status: "Private" },
    { label: "Experiences", status: "Private" }
  ],
  "the disclosure must name each privacy-limited profile section"
);
const temporarilyUnavailableProfile = JSON.parse(JSON.stringify(normalized));
temporarilyUnavailableProfile.sections.badges = {
  status: "unavailable",
  code: "RATE_LIMITED"
};
temporarilyUnavailableProfile.sections.friends = {
  status: "unavailable",
  code: "NETWORK"
};
assert.deepEqual(
  hooks.getEnhancedProfileLimitationsForTests(temporarilyUnavailableProfile),
  [],
  "temporary Roblox API failures must not be presented as private profile sections"
);
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
const invalidMutualGroupCountResponse = JSON.parse(JSON.stringify(normalized));
invalidMutualGroupCountResponse.ok = true;
invalidMutualGroupCountResponse.requestId = 4;
invalidMutualGroupCountResponse.sections.relationships.data.mutualGroupsCount = 1;
assert.equal(
  hooks.normalizeEnhancedProfileResponse(
    invalidMutualGroupCountResponse,
    4,
    "123"
  ).sections.relationships.status,
  "unavailable",
  "a mutual-group count smaller than the normalized list must be rejected"
);
const invalidOwnedGroupCountResponse = JSON.parse(JSON.stringify(normalized));
invalidOwnedGroupCountResponse.ok = true;
invalidOwnedGroupCountResponse.requestId = 4;
invalidOwnedGroupCountResponse.sections.communities.data.ownedCount = 1;
assert.equal(
  hooks.normalizeEnhancedProfileResponse(
    invalidOwnedGroupCountResponse,
    4,
    "123"
  ).sections.communities.status,
  "unavailable",
  "an owned-group count smaller than the normalized list must be rejected"
);
const invalidExactGameCoverageResponse = JSON.parse(JSON.stringify(normalized));
invalidExactGameCoverageResponse.ok = true;
invalidExactGameCoverageResponse.requestId = 4;
invalidExactGameCoverageResponse.sections.experiences.data.coverageIsComplete =
  false;
assert.equal(
  hooks.normalizeEnhancedProfileResponse(
    invalidExactGameCoverageResponse,
    4,
    "123"
  ).sections.experiences.status,
  "unavailable",
  "an exact game count cannot claim incomplete source coverage"
);
assert.deepEqual(
  hooks.getEnhancedProfileAccountAgeDetailsForTests(
    "2019-01-16T12:00:00.000Z",
    Date.parse("2026-09-02T12:00:00.000Z")
  ),
  {
    createdAt: "2019-01-16T12:00:00.000Z",
    years: 7,
    months: 7,
    days: 17,
    totalDays: 2786
  }
);
assert.deepEqual(
  hooks.getEnhancedProfileAccountAgeDetailsForTests(
    "2020-02-29T12:00:00.000Z",
    Date.parse("2021-03-01T12:00:00.000Z")
  ),
  {
    createdAt: "2020-02-29T12:00:00.000Z",
    years: 1,
    months: 0,
    days: 1,
    totalDays: 366
  },
  "account age details must handle leap-day anniversaries"
);
assert.deepEqual(
  hooks.getEnhancedProfileAccountAgeDetailsForTests(
    "2024-01-31T12:00:00.000Z",
    Date.parse("2024-02-29T12:00:00.000Z")
  ),
  {
    createdAt: "2024-01-31T12:00:00.000Z",
    years: 0,
    months: 1,
    days: 0,
    totalDays: 29
  },
  "account age details must clamp end-of-month anniversaries"
);
assert.deepEqual(
  hooks.getEnhancedProfileAccountAgeDetailsForTests(
    "2020-06-15T12:00:00.000Z",
    Date.parse("2021-06-15T11:59:59.000Z")
  ),
  {
    createdAt: "2020-06-15T12:00:00.000Z",
    years: 0,
    months: 11,
    days: 30,
    totalDays: 364
  },
  "account age must not round up just before an anniversary"
);
assert.equal(
  hooks.getEnhancedProfileAccountAgeDetailsForTests(
    "not-a-date",
    Date.parse("2026-01-01T00:00:00.000Z")
  ),
  null
);
assert.equal(
  hooks.getEnhancedProfileAccountAgeDetailsForTests(
    "2027-01-01T00:00:00.000Z",
    Date.parse("2026-01-01T00:00:00.000Z")
  ),
  null,
  "future creation timestamps must not become clickable account ages"
);
const relationshipOnlyResponse = hooks.normalizeEnhancedProfileRelationshipsResponse({
  ok: true,
  requestId: 7,
  userId: "123",
  section: {
    status: "ready",
    data: {
      mutualFriendsCount: 0,
      mutualFriendsAvailable: true,
      profileLimited: false,
      items: [],
      hasMore: false,
      mutualGroupsCount: 15,
      mutualGroups: {
        hasMore: false,
        items: Array.from({ length: 15 }, (_, index) => ({
          communityId: String(9000 + index),
          name: `Mutual Community ${index + 1}`,
          memberCount: index,
          role: index === 0 ? "Owner" : "Member",
          isVerified: index === 0,
          iconUrl: null
        }))
      },
      isFriend: false,
      canChat: false
    }
  }
}, 7, "123");
assert.equal(relationshipOnlyResponse.status, "ready");
assert.equal(relationshipOnlyResponse.data.mutualGroups.items.length, 15);
assert.equal(relationshipOnlyResponse.data.mutualGroups.hasMore, false);
assert.equal(
  relationshipOnlyResponse.data.mutualGroups.items[0].communityId,
  "9000"
);
const oversizedRelationshipResponse = hooks.normalizeEnhancedProfileRelationshipsResponse({
  ok: true,
  requestId: 8,
  userId: "123",
  section: {
    status: "ready",
    data: {
      mutualFriendsCount: 0,
      mutualFriendsAvailable: true,
      profileLimited: false,
      mutualGroupsCount: 101,
      mutualGroups: {
        hasMore: true,
        items: Array.from({ length: 101 }, (_, index) => ({
          communityId: String(10000 + index),
          name: `Bounded Mutual Community ${index + 1}`,
          memberCount: index,
          role: "Member",
          isVerified: false,
          iconUrl: null
        }))
      },
      isFriend: false,
      canChat: false
    }
  }
}, 8, "123");
assert.equal(oversizedRelationshipResponse.status, "ready");
assert.equal(oversizedRelationshipResponse.data.mutualGroups.items.length, 100);
assert.equal(oversizedRelationshipResponse.data.mutualGroups.hasMore, true);
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
const favoriteCardSource = content.slice(
  content.indexOf("function makeEnhancedProfileGameCard("),
  content.indexOf("function appendEnhancedProfileGames(")
);
assert.doesNotMatch(
  favoriteCardSource,
  /rtp-game-source|getEnhancedProfileGameCreatorLabel/,
  "compact Favorite cards must not be cluttered with an Owned group line"
);
assert.match(
  content.slice(
    content.indexOf("function makeEnhancedProfileCollectionRow("),
    content.indexOf("function showEnhancedProfileDetailDialog(")
  ),
  /getEnhancedProfileGameCreatorLabel/,
  "the Games detail dialog must still explain group-owned experiences"
);
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
