"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "content.js"), "utf8");
const helperStart = source.indexOf(
  "  function getBestFriendsScopedOverlayWidth("
);
const helperEnd = source.indexOf(
  "  function observeBestFriendsGeometry(",
  helperStart
);
assert.ok(helperStart >= 0 && helperEnd > helperStart, "layout helpers must exist");

const helperSource = source.slice(helperStart, helperEnd);
const fakeNode = { TEXT_NODE: 3 };
const viewport = { innerHeight: 727 };
const body = {};
const documentElement = {};
let elementsAtPoint = () => [];
let scopedOverlayChildren = [];
let popupTriggers = [];
const fakeDocument = {
  body,
  documentElement,
  elementsFromPoint(x, y) {
    return elementsAtPoint(x, y);
  },
  querySelectorAll(selector) {
    return selector === "[aria-haspopup]" ? popupTriggers : [];
  }
};

function transparentStyle(display = "block") {
  return {
    display,
    backgroundColor: "rgba(0, 0, 0, 0)",
    backgroundImage: "none",
    boxShadow: "none",
    borderTopWidth: "0px",
    borderRightWidth: "0px",
    borderBottomWidth: "0px",
    borderLeftWidth: "0px",
    borderTopStyle: "none",
    borderRightStyle: "none",
    borderBottomStyle: "none",
    borderLeftStyle: "none"
  };
}

const getComputedStyle = (element) => element.computedStyle || transparentStyle();
const makeHelpers = new Function(
  "document",
  "window",
  "getComputedStyle",
  "Node",
  `const BEST_FRIENDS_CAROUSEL_ATTRIBUTE = "data-rsl-best-friends-carousel";\n` +
    `${helperSource}\nreturn { getBestFriendsOverlayWidth, hasBestFriendsInterveningContent };`
);
const {
  getBestFriendsOverlayWidth,
  hasBestFriendsInterveningContent
} = makeHelpers(
  fakeDocument,
  viewport,
  getComputedStyle,
  fakeNode
);

const left = 27;
const width = 1526;
const nativeCarousel = {
  contains() {
    return false;
  }
};
const carousel = {
  contains() {
    return false;
  }
};
const headingScope = {
  get children() {
    return scopedOverlayChildren;
  },
  querySelectorAll() {
    throw new Error("the structural collision check must not scan an unbounded subtree");
  }
};
const heading = {
  parentElement: headingScope,
  contains() {
    return false;
  }
};

const transparentRoProWrapper = {
  textContent: "Your Most Played Death Timer Lumber Tycoon RIVALS Fisch",
  childNodes: [{ nodeType: 1, textContent: "Your Most Played" }],
  computedStyle: transparentStyle(),
  matches() {
    return false;
  },
  closest() {
    return null;
  },
  contains() {
    return false;
  },
  getBoundingClientRect() {
    return { left, right: left + width, top: 0, bottom: 195, width, height: 195 };
  }
};

elementsAtPoint = () => [transparentRoProWrapper];
assert.equal(
  hasBestFriendsInterveningContent(
    left,
    70,
    width,
    223,
    carousel,
    nativeCarousel,
    heading
  ),
  false,
  "a transparent full-width RoPro host must not block the empty left-side gap"
);

const roToolHoverCard = {
  childNodes: [],
  computedStyle: transparentStyle(),
  matches() {
    return true;
  },
  closest(selector) {
    return selector.includes("[data-rsl-best-friend-hover-card]")
      ? this
      : null;
  },
  contains() {
    return false;
  },
  getBoundingClientRect() {
    return {
      left: left + 300,
      right: left + 560,
      top: 70,
      bottom: 330,
      width: 260,
      height: 260
    };
  }
};
elementsAtPoint = () => [roToolHoverCard];
assert.equal(
  getBestFriendsOverlayWidth(
    left,
    70,
    width,
    174,
    nativeCarousel,
    heading
  ),
  width,
  "RoTool's own Best Friend hover card must never become a placement blocker"
);

const alertBanner = {
  childNodes: [],
  computedStyle: transparentStyle(),
  matches(selector) {
    return selector.includes("[role='alert']");
  },
  closest() {
    return null;
  },
  contains() {
    return false;
  },
  getBoundingClientRect() {
    return { left, right: left + width, top: 80, bottom: 190, width, height: 110 };
  }
};
elementsAtPoint = () => [alertBanner];
assert.equal(
  hasBestFriendsInterveningContent(
    left,
    70,
    width,
    223,
    carousel,
    nativeCarousel,
    heading
  ),
  true,
  "a real alert occupying the gap must still force safe normal flow"
);
elementsAtPoint = () => [roToolHoverCard, alertBanner];
assert.equal(
  hasBestFriendsInterveningContent(
    left,
    70,
    width,
    223,
    carousel,
    nativeCarousel,
    heading
  ),
  true,
  "ignoring RoTool's hover card must still expose a real blocker underneath it"
);

const navbarSettingsMenu = {
  id: "settings-popover-menu",
  childNodes: [],
  computedStyle: {
    ...transparentStyle(),
    backgroundColor: "rgb(39, 41, 48)",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)"
  },
  matches(selector) {
    return selector.includes("[role='menu']");
  },
  closest(selector) {
    return selector.includes("#settings-popover-menu") ||
      selector.includes("[role='menu']")
      ? this
      : null;
  },
  contains() {
    return false;
  },
  getBoundingClientRect() {
    return {
      left: left + width - 270,
      right: left + width,
      top: 42,
      bottom: 342,
      width: 270,
      height: 300
    };
  }
};
const navbarSettingsMenuItem = {
  childNodes: [{ nodeType: fakeNode.TEXT_NODE, textContent: "Settings" }],
  computedStyle: transparentStyle(),
  matches(selector) {
    return selector.includes("[role='button']");
  },
  closest(selector) {
    return selector.includes("#settings-popover-menu") ||
      selector.includes("[role='menu']")
      ? navbarSettingsMenu
      : null;
  },
  contains() {
    return false;
  },
  getBoundingClientRect() {
    return {
      left: left + width - 258,
      right: left + width - 12,
      top: 92,
      bottom: 132,
      width: 246,
      height: 40
    };
  }
};

elementsAtPoint = (x, y) =>
  x >= navbarSettingsMenu.getBoundingClientRect().left &&
  y >= navbarSettingsMenu.getBoundingClientRect().top &&
  y <= navbarSettingsMenu.getBoundingClientRect().bottom
    ? [navbarSettingsMenuItem, navbarSettingsMenu]
    : [];
assert.equal(
  getBestFriendsOverlayWidth(
    left,
    70,
    width,
    174,
    nativeCarousel,
    heading
  ),
  width,
  "the official navbar Settings dropdown must not move Best Friends or Quick Settings down while it is open"
);

const noRoleSettingsTrigger = {
  getAttribute(attribute) {
    if (attribute === "aria-haspopup") return "true";
    if (attribute === "aria-describedby") return "settings-popover";
    return null;
  }
};
const noRoleSettingsPopover = {
  id: "settings-popover",
  parentElement: null,
  childNodes: [],
  computedStyle: {
    ...transparentStyle(),
    backgroundColor: "rgb(39, 41, 48)",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)"
  },
  matches() {
    return false;
  },
  closest() {
    return null;
  },
  contains() {
    return false;
  },
  getBoundingClientRect() {
    return {
      left: left + width - 270,
      right: left + width,
      top: 42,
      bottom: 342,
      width: 270,
      height: 300
    };
  }
};
const noRoleSettingsPopoverItem = {
  parentElement: noRoleSettingsPopover,
  childNodes: [{ nodeType: fakeNode.TEXT_NODE, textContent: "Settings" }],
  computedStyle: transparentStyle(),
  matches() {
    return false;
  },
  closest() {
    return null;
  },
  contains() {
    return false;
  },
  getBoundingClientRect() {
    return {
      left: left + width - 258,
      right: left + width - 12,
      top: 92,
      bottom: 132,
      width: 246,
      height: 40
    };
  }
};
popupTriggers = [noRoleSettingsTrigger];
elementsAtPoint = (x, y) =>
  x >= noRoleSettingsPopover.getBoundingClientRect().left &&
  y >= noRoleSettingsPopover.getBoundingClientRect().top &&
  y <= noRoleSettingsPopover.getBoundingClientRect().bottom
    ? [noRoleSettingsPopoverItem, noRoleSettingsPopover]
    : [];
assert.equal(
  getBestFriendsOverlayWidth(
    left,
    70,
    width,
    174,
    nativeCarousel,
    heading
  ),
  width,
  "Roblox's no-role #settings-popover linked from aria-describedby must be treated as a transient overlay"
);
popupTriggers = [];

const persistentHomeWidget = {
  childNodes: [],
  computedStyle: {
    ...transparentStyle(),
    backgroundColor: "rgb(20, 21, 25)"
  },
  matches() {
    return false;
  },
  closest() {
    return null;
  },
  contains() {
    return false;
  },
  getBoundingClientRect() {
    return {
      left: left + width - 540,
      right: left + width,
      top: 70,
      bottom: 244,
      width: 540,
      height: 174
    };
  }
};
elementsAtPoint = (x, y) => {
  if (x < persistentHomeWidget.getBoundingClientRect().left) return [];
  const popupIsAbovePoint =
    x >= navbarSettingsMenu.getBoundingClientRect().left &&
    y >= navbarSettingsMenu.getBoundingClientRect().top &&
    y <= navbarSettingsMenu.getBoundingClientRect().bottom;
  return popupIsAbovePoint
    ? [navbarSettingsMenuItem, navbarSettingsMenu, persistentHomeWidget]
    : [persistentHomeWidget];
};
assert.equal(
  getBestFriendsOverlayWidth(
    left,
    70,
    width,
    174,
    nativeCarousel,
    heading
  ),
  970,
  "ignoring the transient Settings dropdown must still expose a persistent Home blocker beneath it"
);

elementsAtPoint = (x) =>
  x >= persistentHomeWidget.getBoundingClientRect().left
    ? [persistentHomeWidget]
    : [];
assert.equal(
  getBestFriendsOverlayWidth(
    left,
    70,
    width,
    174,
    nativeCarousel,
    heading
  ),
  970,
  "a persistent generic Home widget must remain a placement blocker"
);

const rightRoProPanel = {
  childNodes: [],
  computedStyle: {
    ...transparentStyle(),
    backgroundColor: "rgb(20, 21, 25)"
  },
  matches() {
    return false;
  },
  closest() {
    return null;
  },
  contains() {
    return false;
  },
  getBoundingClientRect() {
    return { left: 1013, right: 1553, top: 0, bottom: 195, width: 540, height: 195 };
  }
};
const transparentBoundedRoProRoot = {
  childNodes: [{ nodeType: 1, textContent: "Your Most Played" }],
  computedStyle: transparentStyle(),
  matches() {
    return false;
  },
  closest() {
    return null;
  },
  contains() {
    return false;
  },
  getBoundingClientRect() {
    return { left: 1013, right: 1553, top: 0, bottom: 205, width: 540, height: 205 };
  }
};
elementsAtPoint = (x, y) =>
  x >= 1013 && y < 205
    ? [transparentBoundedRoProRoot]
    : [transparentRoProWrapper];
assert.equal(
  getBestFriendsOverlayWidth(
    left,
    70,
    width,
    123,
    nativeCarousel,
    heading
  ),
  width,
  "RoPro's transparent bounded root must not narrow an otherwise safe band"
);
elementsAtPoint = (x, y) =>
  x >= 1013 && y < 195
    ? [rightRoProPanel, transparentBoundedRoProRoot]
    : [transparentRoProWrapper];
const quickSettingsSafeWidth = getBestFriendsOverlayWidth(
  left,
  70,
  width,
  123,
  nativeCarousel,
  heading
);
const bestFriendsTopSafeWidth = getBestFriendsOverlayWidth(
  left,
  70,
  width,
  174,
  nativeCarousel,
  heading
);
const bestFriendsSafeWidth = getBestFriendsOverlayWidth(
  left,
  215,
  width,
  174,
  nativeCarousel,
  heading
);
assert.ok(
  quickSettingsSafeWidth >= 336 && quickSettingsSafeWidth < width,
  "Quick Settings must fit in the left lane next to RoPro"
);
assert.ok(
  bestFriendsTopSafeWidth >= 420 && bestFriendsTopSafeWidth < width,
  "the collision probe must report that projected Best Friends would be partially obstructed by RoPro"
);
assert.equal(
  bestFriendsTopSafeWidth >= width - 1,
  false,
  "a partial projected band must trigger split or flow instead of narrowing Best Friends"
);
assert.equal(
  bestFriendsSafeWidth,
  width,
  "Best Friends must recover the full width below RoPro"
);
assert.equal(
  bestFriendsSafeWidth >= width - 1,
  true,
  "Best Friends may reuse a band only when its full-width hitbox is clear"
);

const genericRightPanel = {
  parentElement: headingScope,
  textContent: "A useful Home widget",
  childNodes: [],
  computedStyle: transparentStyle(),
  matches() {
    return false;
  },
  contains() {
    return false;
  },
  getBoundingClientRect() {
    return { left: 1013, right: 1553, top: 0, bottom: 205, width: 540, height: 205 };
  }
};
const genericRightPanelCard = {
  parentElement: genericRightPanel,
  children: [],
  childNodes: [],
  computedStyle: {
    ...transparentStyle(),
    backgroundColor: "rgb(20, 21, 25)"
  },
  matches() {
    return false;
  },
  contains() {
    return false;
  },
  getBoundingClientRect() {
    return { left: 1029, right: 1146, top: 35, bottom: 190, width: 117, height: 155 };
  }
};
genericRightPanel.children = [genericRightPanelCard];
scopedOverlayChildren = [genericRightPanel];
elementsAtPoint = () => [transparentRoProWrapper];
assert.equal(
  getBestFriendsOverlayWidth(
    left,
    70,
    width,
    174,
    nativeCarousel,
    heading
  ),
  970,
  "any bounded Home-header widget must reserve its lane even when hit testing only finds transparent wrappers"
);
assert.equal(
  getBestFriendsOverlayWidth(
    left,
    215,
    width,
    174,
    nativeCarousel,
    heading
  ),
  width,
  "a Home-header widget must not reduce Best Friends after its vertical band"
);

const genericColumn = {
  parentElement: headingScope,
  children: [],
  childNodes: [],
  computedStyle: transparentStyle(),
  matches() {
    return false;
  },
  contains() {
    return false;
  },
  getBoundingClientRect() {
    return { left: 1013, right: 1553, top: 0, bottom: 389, width: 540, height: 389 };
  }
};
const genericColumnCard = {
  parentElement: genericColumn,
  children: [],
  childNodes: [],
  computedStyle: {
    ...transparentStyle(),
    backgroundColor: "rgb(20, 21, 25)"
  },
  matches() {
    return false;
  },
  contains() {
    return false;
  },
  getBoundingClientRect() {
    return { left: 1013, right: 1553, top: 250, bottom: 389, width: 540, height: 139 };
  }
};
genericColumn.children = [genericColumnCard];
scopedOverlayChildren = [genericColumn];
assert.equal(
  getBestFriendsOverlayWidth(
    left,
    70,
    width,
    174,
    nativeCarousel,
    heading
  ),
  width,
  "a transparent wrapper must not reserve a band when its visible content is below that band"
);
assert.equal(
  getBestFriendsOverlayWidth(
    left,
    215,
    width,
    174,
    nativeCarousel,
    heading
  ),
  970,
  "the same generic wrapper must reserve the band that its visible content occupies"
);
genericColumn.computedStyle = { ...transparentStyle(), opacity: "0" };
assert.equal(
  getBestFriendsOverlayWidth(
    left,
    215,
    width,
    174,
    nativeCarousel,
    heading
  ),
  width,
  "an invisible sibling branch must not reserve space for painted descendants"
);
scopedOverlayChildren = [];

const quickSettingsPlacementWidth = 336;
const quickSettingsOnlySafeWidth = getBestFriendsOverlayWidth(
  left,
  70,
  quickSettingsPlacementWidth,
  123,
  nativeCarousel,
  heading
);
assert.equal(
  quickSettingsOnlySafeWidth,
  quickSettingsPlacementWidth,
  "content outside the exact Quick Settings rectangle must not affect placement"
);

console.log("PASS Best Friends reuses occupied Home-header space without hiding alerts");
