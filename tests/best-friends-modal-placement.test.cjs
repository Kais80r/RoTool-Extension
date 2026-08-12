"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "content.js"), "utf8");

const placementStart = source.indexOf("  function hasOpenRoToolDialog(");
const placementEnd = source.indexOf(
  "  function getBestFriendsPickerSearch(",
  placementStart
);
assert.ok(
  placementStart >= 0 && placementEnd > placementStart,
  "modal-aware placement functions must exist"
);

const fakeDocument = {
  openDialog: null,
  documentElement: { dir: "ltr" },
  body: { dir: "ltr" },
  querySelector(selector) {
    assert.equal(selector, ".rsl-dialog[open]");
    return this.openDialog;
  }
};
const placementPrelude =
  `const QUICK_SETTINGS_ATTRIBUTE = "data-rsl-quick-settings";\n` +
  `const BEST_FRIENDS_HEADER_ATTRIBUTE = "data-rsl-best-friends-header";\n` +
  `const BEST_FRIENDS_BODY_ATTRIBUTE = "data-rsl-best-friends-body";\n` +
  `const BEST_FRIENDS_COLLAPSED_ATTRIBUTE = "data-rsl-best-friends-collapsed";\n` +
  `let bestFriendsScrollLockUntil = 0;\n`;

function createPlacementHelpers(
  findHomeHeading,
  getBestFriendsOverlayWidth,
  hasBestFriendsInterveningContent
) {
  return new Function(
    "document",
    "window",
    "findHomeHeading",
    "getBestFriendsOverlayWidth",
    "hasBestFriendsInterveningContent",
    `${placementPrelude}${source.slice(placementStart, placementEnd)}\n` +
      `return {\n` +
      `  placeBestFriendsCarousel(carousel, nativeCarousel) {\n` +
      `    if (typeof carousel.hasAttribute !== "function") {\n` +
      `      carousel.hasAttribute = (name) =>\n` +
      `        name === BEST_FRIENDS_COLLAPSED_ATTRIBUTE &&\n` +
      `        Object.hasOwn(carousel.dataset || {}, "rslBestFriendsCollapsed");\n` +
      `    }\n` +
      `    return placeBestFriendsCarousel(carousel, nativeCarousel);\n` +
      `  }\n` +
      `};`
  )(
    fakeDocument,
    { innerHeight: 900 },
    findHomeHeading,
    getBestFriendsOverlayWidth,
    hasBestFriendsInterveningContent
  );
}

function createStyle(initial = {}) {
  return {
    ...initial,
    setProperty(name, value, priority = "") {
      this[name] = value;
      this[`${name}:priority`] = priority;
    },
    removeProperty(name) {
      const camelName = name.replace(/-([a-z])/g, (_match, letter) =>
        letter.toUpperCase()
      );
      delete this[name];
      delete this[camelName];
      delete this[`${name}:priority`];
    }
  };
}

function createClassList(initial = []) {
  const names = new Set(initial);
  return {
    add(name) {
      names.add(name);
    },
    remove(name) {
      names.delete(name);
    },
    contains(name) {
      return names.has(name);
    }
  };
}

function selectProjectedBands(quickSettings, header, body) {
  return (selector) => {
    if (selector.includes("data-rsl-quick-settings")) return quickSettings;
    if (selector.includes("data-rsl-best-friends-header")) return header;
    if (selector.includes("data-rsl-best-friends-body")) return body;
    return null;
  };
}

const placementHelpers = createPlacementHelpers(
  () => {
    throw new Error("placement geometry must not be read behind an open modal");
  },
  () => {
    throw new Error("point probing must not run behind an open modal");
  },
  () => {
    throw new Error("intervening-content probing must not run behind an open modal");
  }
);

for (const id of [
  "rsl-best-friends-dialog",
  "rsl-shortcut-dialog",
  "rsl-feature-settings-dialog"
]) {
  fakeDocument.openDialog = { id, open: true };
  const carousel = {
    dataset: {
      rslBestFriendsPlacement: "overlay:312:320:149:-149",
      rslBestFriendsFootprint: "149"
    }
  };
  const before = { ...carousel.dataset };
  placementHelpers.placeBestFriendsCarousel(carousel, {});
  assert.deepEqual(
    carousel.dataset,
    before,
    `${id} must not change an established Home placement`
  );
}

fakeDocument.openDialog = null;
const headingRect = {
  left: 27,
  right: 1070,
  top: 0,
  bottom: 50,
  width: 1043,
  height: 50
};
const sharedParent = {};
const heading = {
  contains() {
    return false;
  },
  getBoundingClientRect() {
    return headingRect;
  }
};
const findHeading = () => heading;

function createNativeCarousel(rect) {
  return {
    parentElement: sharedParent,
    contains() {
      return false;
    },
    getBoundingClientRect() {
      return rect;
    }
  };
}

function rect(left, top, width, height) {
  return { left, right: left + width, top, bottom: top + height, width, height };
}

function band(rectangle) {
  return {
    getBoundingClientRect() {
      return rectangle;
    }
  };
}

// Expanded Quick Settings intersects RoPro in the upper band, while the Best
// Friends header and body project below it and recover the complete row width.
const expandedNativeRect = rect(27, 730, 1043, 185);
const expandedCarouselRect = rect(27, 400, 1043, 330);
const expandedQuickSettingsRect = rect(27, 400, 336, 160);
const expandedHeaderRect = rect(27, 572, 1043, 30);
const expandedBodyRect = rect(27, 602, 1043, 128);
const expandedNativeCarousel = createNativeCarousel(expandedNativeRect);
const expandedStyle = createStyle();
const expandedClassList = createClassList();
const expandedCarousel = {
  parentElement: sharedParent,
  nextElementSibling: expandedNativeCarousel,
  dataset: { rslBestFriendsPlacement: "flow" },
  classList: expandedClassList,
  style: expandedStyle,
  querySelector: selectProjectedBands(
    band(expandedQuickSettingsRect),
    band(expandedHeaderRect),
    band(expandedBodyRect)
  ),
  getBoundingClientRect() {
    return expandedCarouselRect;
  }
};
const expandedProbeCalls = [];
const expandedPlacementHelpers = createPlacementHelpers(
  findHeading,
  (left, top, width, height) => {
    expandedProbeCalls.push({ left, top, width, height });
    return width;
  },
  () => false
);
expandedPlacementHelpers.placeBestFriendsCarousel(
  expandedCarousel,
  expandedNativeCarousel
);
assert.deepEqual(expandedProbeCalls, [
  { left: 27, top: 58, width: 336, height: 160 },
  { left: 27, top: 230, width: 1043, height: 30 },
  { left: 27, top: 260, width: 1043, height: 128 }
]);
assert.equal(
  expandedCarousel.dataset.rslBestFriendsPlacement,
  "overlay:336:1043:1043:330:330:-342",
  "expanded Quick Settings may occupy its own left lane while the lower Best Friends bands stay full width"
);
assert.equal("--rsl-best-friends-header-width" in expandedStyle, false);
assert.equal("--rsl-best-friends-body-width" in expandedStyle, false);
assert.equal("--rsl-quick-settings-split-top" in expandedStyle, false);
assert.equal(expandedStyle.transform, "translateY(-342px)");
assert.equal(expandedStyle["margin-bottom"], "-330px");
assert.equal(expandedCarousel.dataset.rslBestFriendsFootprint, "330");
assert.equal(
  expandedClassList.contains("rsl-best-friends-carousel--overlay"),
  true
);
assert.equal(
  expandedClassList.contains("rsl-best-friends-carousel--split"),
  false
);

// Collapsing Best Friends leaves its 30px header (including Hide/Show,
// Manage, and See All) visible below RoPro, but the hidden people body must
// disappear from both collision probes and the reserved overlay footprint.
const headerOnlyNativeRect = rect(27, 602, 1043, 185);
const headerOnlyCarouselRect = rect(27, 400, 1043, 202);
const headerOnlyQuickSettingsRect = rect(27, 400, 336, 160);
const headerOnlyHeaderRect = rect(27, 572, 1043, 30);
const headerOnlyNativeCarousel = createNativeCarousel(headerOnlyNativeRect);
const headerOnlyStyle = createStyle();
const headerOnlyClassList = createClassList();
const headerOnlyCarousel = {
  parentElement: sharedParent,
  nextElementSibling: headerOnlyNativeCarousel,
  dataset: {
    rslBestFriendsPlacement: "flow",
    rslBestFriendsCollapsed: ""
  },
  classList: headerOnlyClassList,
  style: headerOnlyStyle,
  querySelector: selectProjectedBands(
    band(headerOnlyQuickSettingsRect),
    band(headerOnlyHeaderRect),
    null
  ),
  getBoundingClientRect() {
    return headerOnlyCarouselRect;
  }
};
const headerOnlyProbeCalls = [];
createPlacementHelpers(
  findHeading,
  (left, top, width, height) => {
    headerOnlyProbeCalls.push({ left, top, width, height });
    return width;
  },
  () => false
).placeBestFriendsCarousel(headerOnlyCarousel, headerOnlyNativeCarousel);
assert.deepEqual(headerOnlyProbeCalls, [
  { left: 27, top: 58, width: 336, height: 160 },
  { left: 27, top: 230, width: 1043, height: 30 }
]);
assert.equal(
  headerOnlyCarousel.dataset.rslBestFriendsPlacement,
  "overlay:336:1043:1043:202:202:-342",
  "collapsed Best Friends must fit beside RoPro using only Quick Settings and the visible header"
);
assert.equal(
  headerOnlyCarousel.dataset.rslBestFriendsFootprint,
  "202",
  "the hidden people body must reserve no collapsed placement footprint"
);
assert.equal(headerOnlyClassList.contains("rsl-best-friends-carousel--overlay"), true);
assert.equal(headerOnlyClassList.contains("rsl-best-friends-carousel--split"), false);

// The first placement changes the boxes that the delayed ResizeObserver pass
// sees. Model those committed overlay boxes and require the second pass to be
// a fixed point instead of moving the stack again 80 ms later.
function createExpandedOverlayFixedPointFixture() {
  const classList = createClassList();
  const style = createStyle();
  const isOverlay = () =>
    classList.contains("rsl-best-friends-carousel--overlay");
  const translateY = () =>
    Number.parseFloat(String(style.transform || "").match(/-?\d+(?:\.\d+)?/)?.[0]) || 0;
  const visualTop = (flowTop) => flowTop + (isOverlay() ? translateY() : 0);
  const quickSettings = {
    getBoundingClientRect() {
      return rect(27, visualTop(400), 336, 160);
    }
  };
  const header = {
    getBoundingClientRect() {
      return rect(27, visualTop(572), 1043, 30);
    }
  };
  const body = {
    getBoundingClientRect() {
      return rect(27, visualTop(602), 1043, 128);
    }
  };
  const nativeCarousel = {
    parentElement: sharedParent,
    contains() {
      return false;
    },
    getBoundingClientRect() {
      // The committed negative margin removes the overlay's flow footprint.
      return isOverlay()
        ? rect(27, 400, 1043, 185)
        : rect(27, 730, 1043, 185);
    }
  };
  const carousel = {
    parentElement: sharedParent,
    nextElementSibling: nativeCarousel,
    dataset: { rslBestFriendsPlacement: "flow" },
    classList,
    style,
    querySelector: selectProjectedBands(quickSettings, header, body),
    getBoundingClientRect() {
      return rect(27, visualTop(400), 1043, 330);
    }
  };
  return {
    carousel,
    nativeCarousel,
    classList,
    style,
    quickSettings,
    header,
    body
  };
}

const expandedFixedPointFixture = createExpandedOverlayFixedPointFixture();
const expandedFixedPointProbes = [];
const expandedFixedPointHelpers = createPlacementHelpers(
  findHeading,
  (left, top, width, height) => {
    expandedFixedPointProbes.push({ left, top, width, height });
    return width;
  },
  () => false
);
expandedFixedPointHelpers.placeBestFriendsCarousel(
  expandedFixedPointFixture.carousel,
  expandedFixedPointFixture.nativeCarousel
);
const expandedFirstPassState = {
  placement:
    expandedFixedPointFixture.carousel.dataset.rslBestFriendsPlacement,
  footprint:
    expandedFixedPointFixture.carousel.dataset.rslBestFriendsFootprint,
  transform: expandedFixedPointFixture.style.transform,
  marginBottom: expandedFixedPointFixture.style["margin-bottom"],
  quickSettingsTop:
    expandedFixedPointFixture.quickSettings.getBoundingClientRect().top,
  headerRect: expandedFixedPointFixture.header.getBoundingClientRect(),
  bodyRect: expandedFixedPointFixture.body.getBoundingClientRect()
};
assert.equal(
  expandedFirstPassState.quickSettingsTop,
  headingRect.bottom + 8,
  "expanded overlay must use the same 8px Home-heading gap as split placement"
);
expandedFixedPointHelpers.placeBestFriendsCarousel(
  expandedFixedPointFixture.carousel,
  expandedFixedPointFixture.nativeCarousel
);
assert.deepEqual(
  {
    placement:
      expandedFixedPointFixture.carousel.dataset.rslBestFriendsPlacement,
    footprint:
      expandedFixedPointFixture.carousel.dataset.rslBestFriendsFootprint,
    transform: expandedFixedPointFixture.style.transform,
    marginBottom: expandedFixedPointFixture.style["margin-bottom"],
    quickSettingsTop:
      expandedFixedPointFixture.quickSettings.getBoundingClientRect().top,
    headerRect: expandedFixedPointFixture.header.getBoundingClientRect(),
    bodyRect: expandedFixedPointFixture.body.getBoundingClientRect()
  },
  expandedFirstPassState,
  "the delayed geometry pass must keep expanded overlay placement fixed"
);
assert.deepEqual(expandedFixedPointProbes, [
  { left: 27, top: 58, width: 336, height: 160 },
  { left: 27, top: 230, width: 1043, height: 30 },
  { left: 27, top: 260, width: 1043, height: 128 },
  { left: 27, top: 58, width: 336, height: 160 },
  { left: 27, top: 230, width: 1043, height: 30 },
  { left: 27, top: 260, width: 1043, height: 128 }
]);
assert.equal(expandedFirstPassState.headerRect.width, 1043);
assert.equal(expandedFirstPassState.bodyRect.width, 1043);

// Roblox variants can give the visible Quick Settings card a small offset
// from the cloned carousel's root box. Anchor the measured card itself, not an
// assumed root top, and keep that result stable on the observer replay.
function createOffsetExpandedOverlayFixture() {
  const classList = createClassList();
  const style = createStyle();
  const isOverlay = () =>
    classList.contains("rsl-best-friends-carousel--overlay");
  const translateY = () =>
    Number.parseFloat(String(style.transform || "").match(/-?\d+(?:\.\d+)?/)?.[0]) || 0;
  const visualTop = (flowTop) => flowTop + (isOverlay() ? translateY() : 0);
  const quickSettings = {
    getBoundingClientRect() {
      return rect(27, visualTop(403), 336, 160);
    }
  };
  const header = band(rect(27, 572, 1043, 30));
  const body = band(rect(27, 602, 1043, 128));
  const nativeCarousel = {
    parentElement: sharedParent,
    contains() {
      return false;
    },
    getBoundingClientRect() {
      return isOverlay()
        ? rect(27, 400, 1043, 185)
        : rect(27, 730, 1043, 185);
    }
  };
  const carousel = {
    parentElement: sharedParent,
    nextElementSibling: nativeCarousel,
    dataset: { rslBestFriendsPlacement: "flow" },
    classList,
    style,
    querySelector: selectProjectedBands(quickSettings, header, body),
    getBoundingClientRect() {
      return rect(27, visualTop(400), 1043, 330);
    }
  };
  return { carousel, nativeCarousel, quickSettings };
}

const offsetExpandedFixture = createOffsetExpandedOverlayFixture();
const offsetExpandedHelpers = createPlacementHelpers(
  findHeading,
  (_left, _top, probeWidth) => probeWidth,
  () => false
);
offsetExpandedHelpers.placeBestFriendsCarousel(
  offsetExpandedFixture.carousel,
  offsetExpandedFixture.nativeCarousel
);
const offsetExpandedFirstTop =
  offsetExpandedFixture.quickSettings.getBoundingClientRect().top;
offsetExpandedHelpers.placeBestFriendsCarousel(
  offsetExpandedFixture.carousel,
  offsetExpandedFixture.nativeCarousel
);
const offsetExpandedReplayTop =
  offsetExpandedFixture.quickSettings.getBoundingClientRect().top;

// Collapsed Quick Settings projects Best Friends into RoPro. The split mode
// must lift only Quick Settings and leave both Best Friends bands full-width in
// their natural flow position.
function createCollapsedBestFriendsFixture(initialMode = "flow") {
  const initialClasses =
    initialMode === "overlay"
      ? ["rsl-best-friends-carousel--overlay"]
      : initialMode === "split"
        ? ["rsl-best-friends-carousel--split"]
        : [];
  const classList = createClassList(initialClasses);
  const style = createStyle(
    initialMode === "overlay"
      ? {
          transform: "translateY(-342px)",
          "margin-bottom": "-204px",
          pointerEvents: "none",
          width: "100%",
          maxWidth: "100%"
        }
      : initialMode === "split"
        ? { "--rsl-quick-settings-split-top": "-342px" }
        : {}
  );
  const dataset =
    initialMode === "overlay"
      ? {
          rslBestFriendsPlacement: "overlay:336:483:483:204:204:-342",
          rslBestFriendsFootprint: "204"
        }
      : initialMode === "split"
        ? { rslBestFriendsPlacement: "split:336:34:-342" }
        : { rslBestFriendsPlacement: "flow" };
  const isSplit = () =>
    classList.contains("rsl-best-friends-carousel--split");
  const isOverlay = () =>
    classList.contains("rsl-best-friends-carousel--overlay");
  const splitTop = () =>
    Number.parseFloat(style["--rsl-quick-settings-split-top"]) || 0;
  const quickSettings = {
    getBoundingClientRect() {
      if (isSplit()) return rect(27, 400 + splitTop(), 336, 34);
      if (isOverlay()) return rect(27, 58, 336, 34);
      return rect(27, 400, 336, 34);
    }
  };
  const header = {
    getBoundingClientRect() {
      if (isSplit()) return rect(27, 400, 1043, 30);
      if (isOverlay()) return rect(27, 104, 1043, 30);
      return rect(27, 446, 1043, 30);
    }
  };
  const body = {
    getBoundingClientRect() {
      if (isSplit()) return rect(27, 430, 1043, 128);
      if (isOverlay()) return rect(27, 134, 1043, 128);
      return rect(27, 476, 1043, 128);
    }
  };
  const nativeCarousel = {
    parentElement: sharedParent,
    contains() {
      return false;
    },
    getBoundingClientRect() {
      return isSplit()
        ? rect(27, 558, 1043, 185)
        : rect(27, 604, 1043, 185);
    }
  };
  const carousel = {
    parentElement: sharedParent,
    nextElementSibling: nativeCarousel,
    dataset,
    classList,
    style,
    querySelector: selectProjectedBands(quickSettings, header, body),
    getBoundingClientRect() {
      if (isSplit()) return rect(27, 400, 1043, 158);
      if (isOverlay()) return rect(27, 58, 1043, 204);
      return rect(27, 400, 1043, 204);
    }
  };
  return {
    carousel,
    nativeCarousel,
    classList,
    style,
    quickSettings,
    header,
    body
  };
}

function createCollapsedPlacementHelpers(probeCalls = []) {
  return createPlacementHelpers(
    findHeading,
    (left, top, width, height) => {
      probeCalls.push({ left, top, width, height });
      if (width === 336) return 336;
      return top < 205 ? 483 : 1043;
    },
    () => false
  );
}

const collapsedFixture = createCollapsedBestFriendsFixture();
const collapsedProbeCalls = [];
createCollapsedPlacementHelpers(collapsedProbeCalls).placeBestFriendsCarousel(
  collapsedFixture.carousel,
  collapsedFixture.nativeCarousel
);
assert.deepEqual(collapsedProbeCalls, [
  { left: 27, top: 58, width: 336, height: 34 },
  { left: 27, top: 104, width: 1043, height: 30 },
  { left: 27, top: 134, width: 1043, height: 128 },
  { left: 27, top: 58, width: 336, height: 34 },
  { left: 27, top: 400, width: 1043, height: 30 },
  { left: 27, top: 430, width: 1043, height: 128 }
]);
assert.equal(
  collapsedFixture.carousel.dataset.rslBestFriendsPlacement,
  "split:336:34:-342",
  "collapsed Quick Settings must split upward while Best Friends remains in full-width flow"
);
assert.equal(
  collapsedFixture.style["--rsl-quick-settings-split-top"],
  "-342px"
);
assert.equal(
  collapsedFixture.classList.contains("rsl-best-friends-carousel--split"),
  true
);
assert.equal(
  collapsedFixture.classList.contains("rsl-best-friends-carousel--overlay"),
  false
);
assert.equal("transform" in collapsedFixture.style, false);
assert.equal("margin-bottom" in collapsedFixture.style, false);
assert.equal("rslBestFriendsFootprint" in collapsedFixture.carousel.dataset, false);
assert.equal("--rsl-best-friends-header-width" in collapsedFixture.style, false);
assert.equal("--rsl-best-friends-body-width" in collapsedFixture.style, false);
assert.equal(
  collapsedFixture.quickSettings.getBoundingClientRect().top,
  headingRect.bottom + 8,
  "collapsed split placement must use the unified 8px Home-heading gap"
);
const collapsedFirstPassState = {
  placement: collapsedFixture.carousel.dataset.rslBestFriendsPlacement,
  splitTop: collapsedFixture.style["--rsl-quick-settings-split-top"],
  quickSettingsRect: collapsedFixture.quickSettings.getBoundingClientRect(),
  headerRect: collapsedFixture.header.getBoundingClientRect(),
  bodyRect: collapsedFixture.body.getBoundingClientRect()
};
collapsedProbeCalls.length = 0;
createCollapsedPlacementHelpers(collapsedProbeCalls).placeBestFriendsCarousel(
  collapsedFixture.carousel,
  collapsedFixture.nativeCarousel
);
assert.deepEqual(
  {
    placement: collapsedFixture.carousel.dataset.rslBestFriendsPlacement,
    splitTop: collapsedFixture.style["--rsl-quick-settings-split-top"],
    quickSettingsRect: collapsedFixture.quickSettings.getBoundingClientRect(),
    headerRect: collapsedFixture.header.getBoundingClientRect(),
    bodyRect: collapsedFixture.body.getBoundingClientRect()
  },
  collapsedFirstPassState,
  "the delayed geometry pass must keep collapsed split placement fixed"
);
assert.deepEqual(collapsedProbeCalls, [
  { left: 27, top: 58, width: 336, height: 34 },
  { left: 27, top: 104, width: 1043, height: 30 },
  { left: 27, top: 134, width: 1043, height: 128 },
  { left: 27, top: 58, width: 336, height: 34 },
  { left: 27, top: 400, width: 1043, height: 30 },
  { left: 27, top: 430, width: 1043, height: 128 }
]);
assert.equal(collapsedFirstPassState.headerRect.width, 1043);
assert.equal(collapsedFirstPassState.bodyRect.width, 1043);

function createOffsetCollapsedSplitFixture() {
  const classList = createClassList();
  const style = createStyle();
  const isSplit = () =>
    classList.contains("rsl-best-friends-carousel--split");
  const splitTop = () =>
    Number.parseFloat(style["--rsl-quick-settings-split-top"]) || 0;
  const quickSettings = {
    getBoundingClientRect() {
      return isSplit()
        ? rect(27, 403 + splitTop(), 336, 34)
        : rect(27, 403, 336, 34);
    }
  };
  const header = {
    getBoundingClientRect() {
      return isSplit()
        ? rect(27, 400, 1043, 30)
        : rect(27, 446, 1043, 30);
    }
  };
  const body = {
    getBoundingClientRect() {
      return isSplit()
        ? rect(27, 430, 1043, 128)
        : rect(27, 476, 1043, 128);
    }
  };
  const nativeCarousel = {
    parentElement: sharedParent,
    contains() {
      return false;
    },
    getBoundingClientRect() {
      return isSplit()
        ? rect(27, 558, 1043, 185)
        : rect(27, 604, 1043, 185);
    }
  };
  const carousel = {
    parentElement: sharedParent,
    nextElementSibling: nativeCarousel,
    dataset: { rslBestFriendsPlacement: "flow" },
    classList,
    style,
    querySelector: selectProjectedBands(quickSettings, header, body),
    getBoundingClientRect() {
      return isSplit()
        ? rect(27, 400, 1043, 158)
        : rect(27, 400, 1043, 204);
    }
  };
  return { carousel, nativeCarousel, quickSettings };
}

const offsetCollapsedFixture = createOffsetCollapsedSplitFixture();
const offsetCollapsedHelpers = createPlacementHelpers(
  findHeading,
  (_left, probeTop, probeWidth) => {
    if (probeWidth === 336) return 336;
    return probeTop < 205 ? 483 : 1043;
  },
  () => false
);
offsetCollapsedHelpers.placeBestFriendsCarousel(
  offsetCollapsedFixture.carousel,
  offsetCollapsedFixture.nativeCarousel
);
const offsetCollapsedFirstTop =
  offsetCollapsedFixture.quickSettings.getBoundingClientRect().top;
offsetCollapsedHelpers.placeBestFriendsCarousel(
  offsetCollapsedFixture.carousel,
  offsetCollapsedFixture.nativeCarousel
);
const offsetCollapsedReplayTop =
  offsetCollapsedFixture.quickSettings.getBoundingClientRect().top;
assert.deepEqual(
  {
    overlayFirstMount: offsetExpandedFirstTop,
    overlayReplay: offsetExpandedReplayTop,
    splitFirstMount: offsetCollapsedFirstTop,
    splitReplay: offsetCollapsedReplayTop
  },
  {
    overlayFirstMount: headingRect.bottom + 8,
    overlayReplay: headingRect.bottom + 8,
    splitFirstMount: headingRect.bottom + 8,
    splitReplay: headingRect.bottom + 8
  },
  "overlay and split must anchor the measured Quick Settings card, not a root or containing block offset by 3px"
);

// Transitioning from the obsolete partial overlay to split mode must clear all
// carousel movement and footprint state before lifting Quick Settings alone.
const overlayToSplitFixture = createCollapsedBestFriendsFixture("overlay");
createCollapsedPlacementHelpers().placeBestFriendsCarousel(
  overlayToSplitFixture.carousel,
  overlayToSplitFixture.nativeCarousel
);
assert.equal(
  overlayToSplitFixture.carousel.dataset.rslBestFriendsPlacement,
  "split:336:34:-342"
);
assert.equal(
  overlayToSplitFixture.classList.contains("rsl-best-friends-carousel--overlay"),
  false
);
assert.equal(
  overlayToSplitFixture.classList.contains("rsl-best-friends-carousel--split"),
  true
);
for (const property of [
  "transform",
  "margin-bottom",
  "pointerEvents",
  "width",
  "maxWidth"
]) {
  assert.equal(property in overlayToSplitFixture.style, false);
}
assert.equal(
  "rslBestFriendsFootprint" in overlayToSplitFixture.carousel.dataset,
  false
);

// Expanding Quick Settings can move the complete stack above again. A previous
// split must be removed before the combined overlay styles are committed.
const splitToOverlayClassList = createClassList([
  "rsl-best-friends-carousel--split"
]);
const splitToOverlayStyle = createStyle({
  "--rsl-quick-settings-split-top": "-342px"
});
const splitToOverlayIsSplit = () =>
  splitToOverlayClassList.contains("rsl-best-friends-carousel--split");
const splitToOverlayQuickSettings = {
  getBoundingClientRect() {
    return splitToOverlayIsSplit()
      ? rect(27, 58, 336, 160)
      : expandedQuickSettingsRect;
  }
};
const splitToOverlayHeader = {
  getBoundingClientRect() {
    return splitToOverlayIsSplit()
      ? rect(27, 400, 1043, 30)
      : expandedHeaderRect;
  }
};
const splitToOverlayBody = {
  getBoundingClientRect() {
    return splitToOverlayIsSplit()
      ? rect(27, 430, 1043, 128)
      : expandedBodyRect;
  }
};
const splitToOverlayNative = {
  parentElement: sharedParent,
  contains() {
    return false;
  },
  getBoundingClientRect() {
    return splitToOverlayIsSplit()
      ? rect(27, 558, 1043, 185)
      : expandedNativeRect;
  }
};
const splitToOverlayCarousel = {
  parentElement: sharedParent,
  nextElementSibling: splitToOverlayNative,
  dataset: { rslBestFriendsPlacement: "split:336:160:-342" },
  classList: splitToOverlayClassList,
  style: splitToOverlayStyle,
  querySelector: selectProjectedBands(
    splitToOverlayQuickSettings,
    splitToOverlayHeader,
    splitToOverlayBody
  ),
  getBoundingClientRect() {
    return splitToOverlayIsSplit()
      ? rect(27, 400, 1043, 158)
      : expandedCarouselRect;
  }
};
createPlacementHelpers(findHeading, (_left, _top, width) => width, () => false)
  .placeBestFriendsCarousel(splitToOverlayCarousel, splitToOverlayNative);
assert.equal(
  splitToOverlayCarousel.dataset.rslBestFriendsPlacement,
  "overlay:336:1043:1043:330:330:-342"
);
assert.equal(
  splitToOverlayClassList.contains("rsl-best-friends-carousel--split"),
  false
);
assert.equal(
  splitToOverlayClassList.contains("rsl-best-friends-carousel--overlay"),
  true
);
assert.equal("--rsl-quick-settings-split-top" in splitToOverlayStyle, false);
assert.equal(splitToOverlayStyle.transform, "translateY(-342px)");
assert.equal(splitToOverlayStyle["margin-bottom"], "-330px");
assert.equal(splitToOverlayCarousel.dataset.rslBestFriendsFootprint, "330");

// With Quick Settings disabled, Best Friends must never be lifted or narrowed,
// even if its projected bands happen to be clear.
const bestFriendsOnlyClassList = createClassList([
  "rsl-best-friends-carousel--split"
]);
const bestFriendsOnlyStyle = createStyle({
  "--rsl-quick-settings-split-top": "-342px"
});
const bestFriendsOnlyNative = createNativeCarousel(rect(27, 558, 1043, 185));
const bestFriendsOnlyCarousel = {
  parentElement: sharedParent,
  nextElementSibling: bestFriendsOnlyNative,
  dataset: { rslBestFriendsPlacement: "split:336:34:-342" },
  classList: bestFriendsOnlyClassList,
  style: bestFriendsOnlyStyle,
  querySelector: selectProjectedBands(
    null,
    band(rect(27, 400, 1043, 30)),
    band(rect(27, 430, 1043, 128))
  ),
  getBoundingClientRect() {
    return rect(27, 400, 1043, 158);
  }
};
createPlacementHelpers(findHeading, (_left, _top, width) => width, () => false)
  .placeBestFriendsCarousel(bestFriendsOnlyCarousel, bestFriendsOnlyNative);
assert.equal(
  bestFriendsOnlyCarousel.dataset.rslBestFriendsPlacement,
  "flow",
  "Best Friends without Quick Settings must remain full-width in normal flow"
);
assert.equal(
  bestFriendsOnlyClassList.contains("rsl-best-friends-carousel--split"),
  false
);
assert.equal(
  bestFriendsOnlyClassList.contains("rsl-best-friends-carousel--overlay"),
  false
);
assert.equal("--rsl-quick-settings-split-top" in bestFriendsOnlyStyle, false);
assert.equal("transform" in bestFriendsOnlyStyle, false);

const quickSettingsOnlyRect = {
  left: 27,
  right: 363,
  top: 214,
  bottom: 248,
  width: 336,
  height: 34
};
const quickSettingsOnly = {
  getBoundingClientRect() {
    return quickSettingsOnlyRect;
  }
};
const quickSettingsOnlyNativeCarousel = createNativeCarousel(
  rect(27, 214, 1043, 185)
);
const quickSettingsOnlyCarousel = {
  parentElement: sharedParent,
  nextElementSibling: quickSettingsOnlyNativeCarousel,
  dataset: { rslBestFriendsDisabled: "" },
  classList: {
    add() {},
    remove() {}
  },
  style: createStyle(),
  querySelector() {
    return quickSettingsOnly;
  },
  getBoundingClientRect() {
    return quickSettingsOnlyRect;
  }
};
const quickSettingsOnlyPlacementHelpers = createPlacementHelpers(
  findHeading,
  () => 336,
  () => false
);
quickSettingsOnlyPlacementHelpers.placeBestFriendsCarousel(
  quickSettingsOnlyCarousel,
  quickSettingsOnlyNativeCarousel
);
assert.equal(
  quickSettingsOnlyCarousel.dataset.rslBestFriendsPlacement,
  "overlay:336:1043:1043:34:34:-156",
  "a minimized Quick Settings-only panel must reserve its real 34px height, not a 120px Best Friends row"
);

const paintedBlockerStart = source.indexOf(
  "  function isBestFriendsPaintedPointBlocker("
);
const paintedBlockerEnd = source.indexOf(
  "  function hasBestFriendsInterveningContent(",
  paintedBlockerStart
);
assert.ok(
  paintedBlockerStart >= 0 && paintedBlockerEnd > paintedBlockerStart,
  "painted placement-blocker classifier must exist"
);
const { isBestFriendsPaintedPointBlocker } = new Function(
  "getComputedStyle",
  "Node",
  `${source.slice(paintedBlockerStart, paintedBlockerEnd)}\n` +
    "return { isBestFriendsPaintedPointBlocker };"
)(
  () => {
    throw new Error("role=dialog surfaces must be classified before style probing");
  },
  { TEXT_NODE: 3 }
);
const hoverDialogSurface = {
  closest(selector) {
    return selector.includes("[data-rsl-best-friend-hover-card]")
      ? this
      : null;
  },
  matches(selector) {
    return selector.includes("[role='dialog']");
  }
};
const unrelatedDialogSurface = {
  closest() {
    return null;
  },
  matches(selector) {
    return selector.includes("[role='dialog']");
  }
};
const dialogSurfaceRect = rect(500, 100, 240, 96);
assert.equal(
  isBestFriendsPaintedPointBlocker(
    hoverDialogSurface,
    dialogSurfaceRect,
    540,
    130,
    27,
    1043
  ),
  false,
  "RoTool's body-mounted hover dialog must never become a Home placement blocker"
);
assert.equal(
  isBestFriendsPaintedPointBlocker(
    unrelatedDialogSurface,
    dialogSurfaceRect,
    540,
    130,
    27,
    1043
  ),
  true,
  "unrelated dialogs must remain placement blockers"
);

const mutationStart = source.indexOf("  function isInsideRoToolDialog(");
const mutationEnd = source.indexOf("  function initialize()", mutationStart);
assert.ok(
  mutationStart >= 0 && mutationEnd > mutationStart,
  "dialog mutation filter must exist"
);
const fakeNode = { ELEMENT_NODE: 1 };
const { mutationsAffectExtensionMount } = new Function(
  "Node",
  `${source.slice(mutationStart, mutationEnd)}\n` +
    "return { mutationsAffectExtensionMount };"
)(fakeNode);

const dialog = {
  nodeType: fakeNode.ELEMENT_NODE,
  closest(selector) {
    return selector.includes(".rsl-dialog") ? this : null;
  }
};
const dialogChild = {
  nodeType: fakeNode.ELEMENT_NODE,
  closest(selector) {
    return selector.includes(".rsl-dialog") ? dialog : null;
  }
};
const hoverCard = {
  nodeType: fakeNode.ELEMENT_NODE,
  closest(selector) {
    return selector.includes("[data-rsl-best-friend-hover-card]")
      ? this
      : null;
  }
};
const hoverCardChild = {
  nodeType: fakeNode.ELEMENT_NODE,
  closest(selector) {
    return selector.includes("[data-rsl-best-friend-hover-card]")
      ? hoverCard
      : null;
  }
};
const ownedCarousel = {
  nodeType: fakeNode.ELEMENT_NODE,
  closest(selector) {
    return selector.includes("[data-rsl-best-friends-carousel]")
      ? this
      : null;
  }
};
const ownedCarouselChild = {
  nodeType: fakeNode.ELEMENT_NODE,
  closest(selector) {
    return selector.includes("[data-rsl-best-friends-carousel]")
      ? ownedCarousel
      : null;
  }
};
const pageNode = {
  nodeType: fakeNode.ELEMENT_NODE,
  closest() {
    return null;
  }
};

assert.equal(
  mutationsAffectExtensionMount([
    { target: pageNode, addedNodes: [dialog], removedNodes: [] }
  ]),
  false,
  "appending a RoTool dialog must not remount Home"
);
assert.equal(
  mutationsAffectExtensionMount([
    { target: dialogChild, addedNodes: [dialogChild], removedNodes: [] }
  ]),
  false,
  "rendering inside a RoTool dialog must not remount Home"
);
assert.equal(
  mutationsAffectExtensionMount([
    { target: pageNode, addedNodes: [hoverCard], removedNodes: [] }
  ]),
  false,
  "showing RoTool's Best Friend hover card must not remount or move Home"
);
assert.equal(
  mutationsAffectExtensionMount([
    { target: hoverCardChild, addedNodes: [], removedNodes: [] }
  ]),
  false,
  "mutations inside the Best Friend hover card must stay placement-neutral"
);
assert.equal(
  mutationsAffectExtensionMount([
    { target: pageNode, addedNodes: [], removedNodes: [hoverCard] }
  ]),
  false,
  "closing the Best Friend hover card must not remount or move Home"
);
assert.equal(
  mutationsAffectExtensionMount([
    { target: ownedCarouselChild, addedNodes: [ownedCarouselChild], removedNodes: [] }
  ]),
  false,
  "RoTool's own Quick Settings and carousel renders must not queue a second placement pass"
);
assert.equal(
  mutationsAffectExtensionMount([
    { target: pageNode, addedNodes: [ownedCarousel], removedNodes: [] }
  ]),
  true,
  "adding or removing the complete owned carousel must remain observable for recovery"
);
assert.equal(
  mutationsAffectExtensionMount([
    { target: pageNode, addedNodes: [pageNode], removedNodes: [] }
  ]),
  true,
  "normal Roblox page mutations must continue to remount extension features"
);

console.log("PASS Best Friends placement ignores RoTool transient overlays");
