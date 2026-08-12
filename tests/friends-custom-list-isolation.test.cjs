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
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = "";
      }
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

function findRuleContaining(selectorPattern) {
  for (const match of styles.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (selectorPattern.test(match[1])) {
      return { selectors: match[1], declarations: match[2] };
    }
  }
  return null;
}

// Fixture for the visible-strip regression:
// 1. RoTool has already mounted its custom one-result list.
// 2. Roblox React replaces the old native list with a fresh list.
// 3. The replacement has not received data-rsl-native-friends-hidden yet,
//    because queueMount has not reconciled the mutation.
const lateNativeListFixture = {
  activeAncestor: true,
  classes: ["hlist", "avatar-cards"],
  customListAttribute: false,
  hiddenAttribute: false,
  cards: [{ userId: "native-1" }, { userId: "native-2" }, { userId: "native-3" }]
};
const customOneResultFixture = {
  activeAncestor: true,
  classes: ["hlist", "avatar-cards", "rsl-online-friends-list"],
  customListAttribute: true,
  hiddenAttribute: false,
  cards: [{ userId: "filtered-match" }]
};

const activeNativeListRule = findRuleContaining(
  /\[data-rsl-online-view-active\][\s\S]*?\.friends-content[\s\S]*?ul\.hlist\.avatar-cards:not\(\[data-rsl-online-friends-list\]\)/
);
assert.ok(
  activeNativeListRule,
  "while the custom Friends view is active, CSS must immediately target every native friends list, including a late React replacement that does not have the per-node hidden attribute yet"
);
assert.match(
  activeNativeListRule.declarations,
  /display\s*:\s*none\s*!important\s*;/i,
  "late native lists must be removed from layout, not merely clipped or made transparent"
);

function hiddenByActiveViewContract(fixture) {
  return Boolean(
    activeNativeListRule &&
    /display\s*:\s*none\s*!important\s*;/i.test(activeNativeListRule.declarations) &&
    fixture.activeAncestor &&
    fixture.classes.includes("hlist") &&
    fixture.classes.includes("avatar-cards") &&
    !fixture.customListAttribute
  );
}

assert.equal(
  hiddenByActiveViewContract(lateNativeListFixture),
  true,
  "a newly inserted native list must never flash below the filtered result while waiting for remount"
);
assert.equal(
  hiddenByActiveViewContract(customOneResultFixture),
  false,
  "the active-view guard must exclude RoTool's custom filtered list"
);

for (const pagerSelector of [".pager-holder", ".pager-container", ".friends-pager"]) {
  const escapedSelector = pagerSelector.replace(".", "\\.");
  const pagerRule = findRuleContaining(
    new RegExp(
      `\\[data-rsl-online-view-active\\][\\s\\S]*?\\.friends-content[\\s\\S]*?${escapedSelector}`
    )
  );
  assert.ok(
    pagerRule,
    `${pagerSelector} must be hidden by the persistent active-view ancestor, even before a late pager receives its per-node hidden attribute`
  );
  assert.match(
    pagerRule.declarations,
    /display\s*:\s*none\s*!important\s*;/i,
    `${pagerSelector} must reserve no layout space below the custom list`
  );
}

// Keep the reconciliation fallback too: existing and newly discovered native
// nodes should still receive explicit hidden attributes on the next pass.
const reconcileSource = extractFunction("reconcileOnlineFriendCards");
assert.match(
  reconcileSource,
  /mount\.setAttribute\("data-rsl-online-view-active",\s*""\)/,
  "reconciliation must establish the persistent active-view guard"
);
assert.match(
  reconcileSource,
  /nativeLists\.forEach\(\(list\)\s*=>\s*list\.setAttribute\(ONLINE_NATIVE_LIST_HIDDEN_ATTRIBUTE,\s*""\)\)/,
  "reconciliation must explicitly hide every native list it discovers"
);
assert.match(
  reconcileSource,
  /getNativeFriendsPaginationElements\(mount,\s*nativeList\)\.forEach\(\(element\)\s*=>[\s\S]*?ONLINE_NATIVE_PAGINATION_HIDDEN_ATTRIBUTE/,
  "reconciliation must explicitly hide every native pager it discovers"
);

assert.match(
  styles,
  /\[data-rsl-native-friends-hidden\][\s\S]*?display\s*:\s*none\s*!important/,
  "the per-node native-list hiding fallback must remain in place"
);
assert.match(
  styles,
  /\[data-rsl-native-pagination-hidden\][\s\S]*?display\s*:\s*none\s*!important/,
  "the per-node native-pager hiding fallback must remain in place"
);

console.log("PASS custom Friends list isolation during late Roblox React replacements");
