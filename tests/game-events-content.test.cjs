"use strict";

process.env.TZ = "Europe/Berlin";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const contentSource = fs.readFileSync(path.join(projectRoot, "content.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(projectRoot, "styles.css"), "utf8");
const readme = fs.readFileSync(path.join(projectRoot, "README.md"), "utf8");

globalThis.__rslContentTestHooks = { skipInitialize: true };
require(path.join(projectRoot, "content.js"));
const hooks = globalThis.__rslContentTestHooks;
const NOW = new Date(2026, 7, 13, 12, 0, 0, 0).getTime();

function event(overrides = {}) {
  return {
    id: "1001",
    universeId: "2001",
    placeId: "3001",
    gameName: "Fixture Game",
    title: "Summer Event",
    subtitle: "Double XP",
    startAt: NOW + 60 * 60_000,
    endAt: NOW + 3 * 60 * 60_000,
    eventUrl: "https://evil.invalid/untrusted",
    ...overrides
  };
}

function sourceBetween(start, end) {
  const startIndex = contentSource.indexOf(start);
  const endIndex = contentSource.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing source boundary: ${start}`);
  assert.notEqual(endIndex, -1, `missing source boundary: ${end}`);
  return contentSource.slice(startIndex, endIndex);
}

function cssBlock(source, selector, fromIndex = 0) {
  const selectorIndex = source.indexOf(selector, fromIndex);
  assert.notEqual(selectorIndex, -1, `missing CSS selector: ${selector}`);
  const openIndex = source.indexOf("{", selectorIndex);
  const closeIndex = source.indexOf("}", openIndex + 1);
  assert.notEqual(openIndex, -1, `missing CSS block start: ${selector}`);
  assert.notEqual(closeIndex, -1, `missing CSS block end: ${selector}`);
  return source.slice(openIndex + 1, closeIndex);
}

function lastCssBlock(source, selector) {
  const selectorIndex = source.lastIndexOf(selector);
  assert.notEqual(selectorIndex, -1, `missing final CSS selector: ${selector}`);
  return cssBlock(source, selector, selectorIndex);
}

const gameEventsStylesStart = stylesSource.indexOf("/* Game Events");
const gameEventsMobileStart = stylesSource.indexOf("@media (max-width: 640px)", gameEventsStylesStart);
const narrowBreakpointMatch = stylesSource
  .slice(gameEventsMobileStart + 1)
  .match(/@media\s*\(max-width:\s*(?:3\d\d|4[0-4]\d)px\)/);
const gameEventsNarrowStart = narrowBreakpointMatch
  ? gameEventsMobileStart + 1 + narrowBreakpointMatch.index
  : -1;
const gameEventsReducedMotionStart = stylesSource.indexOf(
  "@media (prefers-reduced-motion: reduce)",
  gameEventsNarrowStart
);
assert.notEqual(gameEventsStylesStart, -1, "missing Game Events stylesheet section");
assert.notEqual(gameEventsMobileStart, -1, "missing Game Events mobile breakpoint");
assert.notEqual(gameEventsNarrowStart, -1, "missing Game Events narrow breakpoint");
assert.notEqual(gameEventsReducedMotionStart, -1, "missing Game Events reduced-motion section");
const gameEventsBaseStyles = stylesSource.slice(gameEventsStylesStart, gameEventsMobileStart);
const gameEventsMobileStyles = stylesSource.slice(gameEventsMobileStart, gameEventsNarrowStart);
const gameEventsNarrowStyles = stylesSource.slice(gameEventsNarrowStart, gameEventsReducedMotionStart);

assert.deepEqual(hooks.gameEventsConstants.messageTypes, {
  get: "rsl:get-game-events",
  add: "rsl:add-game-event-favorite",
  remove: "rsl:remove-game-event-favorite",
  search: "rsl:search-game-events-games"
});
assert.equal(hooks.gameEventsConstants.searchDebounceMs, 300);
assert.equal(hooks.gameEventsConstants.maxFavorites, 30);
assert.equal(hooks.gameEventsConstants.rowId, "rsl-game-events-row");
assert.equal(hooks.gameEventsConstants.dialogId, "rsl-game-events-dialog");
assert.equal(hooks.defaultFeatureSettings.gameEvents, true);
assert.equal(hooks.defaultFeatureSettings.sidebarGameEvents, true);
const initialGameEventsState = hooks.getGameEventsStateForTests();
assert.equal(Object.hasOwn(initialGameEventsState, "dateFilter"), false);
assert.equal(Object.hasOwn(initialGameEventsState, "calendarOffset"), false,
  "the continuous feed keeps no obsolete calendar-selection state");
assert.equal(initialGameEventsState.liveSectionCollapsed, false,
  "each newly opened Events dialog starts with its active cards visible");
assert.equal(
  hooks.featureSettingDefinitions.find(({ key }) => key === "sidebarGameEvents")?.parentKey,
  "sidebarShortcuts"
);

for (const legacy of [null, { version: 1 }, { version: 1, flags: {} }]) {
  const normalized = hooks.normalizeFeatureSettings(legacy);
  assert.equal(normalized.gameEvents, true);
  assert.equal(normalized.sidebarGameEvents, true);
  assert.equal(normalized.serverHistory, false, "adding Events must not opt into activity history");
}
const configured = hooks.normalizeFeatureSettings({
  version: 1,
  flags: {
    gameEvents: false,
    sidebarGameEvents: false,
    sidebarCustomShortcuts: true,
    sidebarServerHistory: true
  }
});
assert.equal(configured.gameEvents, false);
assert.equal(configured.sidebarGameEvents, false);
assert.equal(configured.sidebarCustomShortcuts, true);
assert.equal(configured.sidebarServerHistory, true);
assert.equal(hooks.serializeFeatureSettings(configured).flags.gameEvents, false);

const normalizedEvent = hooks.normalizeGameEvent(event({
  title: "  Summer\n\t Event  ",
  subtitle: " Double\r\n XP ",
  displayTitle: "Do not use this",
  displaySubtitle: "Do not use this either"
}), NOW);
assert.equal(normalizedEvent.id, "1001");
assert.equal(normalizedEvent.title, "Summer Event");
assert.equal(normalizedEvent.subtitle, "Double XP");
assert.equal(normalizedEvent.status, "upcoming");
assert.equal(normalizedEvent.eventUrl, "https://www.roblox.com/events/1001");
assert.equal(Object.hasOwn(normalizedEvent, "displayTitle"), false);
assert.equal(hooks.normalizeGameEvent(event({ endAt: NOW }), NOW), null);
assert.equal(hooks.normalizeGameEvent(event({ startAt: NOW + 100, endAt: NOW + 50 }), NOW), null);
assert.equal(hooks.normalizeGameEvent({ ...event(), id: "<script>" }, NOW), null);

assert.deepEqual(hooks.normalizeGameEventSearchResult({
  universeId: 7001,
  placeId: 8001,
  name: "  Murder\n Mystery 2  ",
  creatorName: "  Nikilis  ",
  playerCount: 12345
}), {
  universeId: "7001",
  placeId: "8001",
  name: "Murder Mystery 2",
  creatorName: "Nikilis",
  playerCount: 12345
});
assert.equal(hooks.normalizeGameEventSearchResult({ universeId: "bad", name: "Game" }), null);
assert.equal(hooks.normalizeGameEventSearchResult({ universeId: 1, name: "  " }), null);
assert.equal(hooks.isGameEventsSearchableQuery("Murder Mystery"), true);
for (const directOrTooShort of [
  "",
  "x",
  "x".repeat(101),
  "123456",
  "https://www.roblox.com/games/123/name"
]) {
  assert.equal(hooks.isGameEventsSearchableQuery(directOrTooShort), false,
    `picker must bypass suggestions for ${JSON.stringify(directOrTooShort)}`);
}

const normalizedResponse = hooks.normalizeGameEventsResponse({
  ok: true,
  enabled: true,
  viewerUserId: 501,
  games: [
    { universeId: 2001, placeId: 3001, name: " Fixture\nGame ", addedAt: NOW },
    { universeId: 2001, placeId: 9999, name: "Duplicate", addedAt: NOW },
    ...Array.from({ length: 35 }, (_, index) => ({
      universeId: 2100 + index,
      placeId: 3100 + index,
      name: `Game ${index}`,
      addedAt: NOW
    }))
  ],
  events: [event(), event(), event({ id: "1002", startAt: NOW - 60_000 })],
  partial: true,
  failures: [{ universeId: "2002", code: "NETWORK", usedCachedData: true }]
}, NOW);
assert.equal(normalizedResponse.viewerUserId, "501");
assert.equal(normalizedResponse.favorites.length, 30);
assert.equal(new Set(normalizedResponse.favorites.map(({ universeId }) => universeId)).size, 30);
assert.equal(normalizedResponse.favorites[0].name, "Fixture Game");
assert.equal(normalizedResponse.events.length, 2);
assert.deepEqual(normalizedResponse.events.map(({ status }) => status), ["live", "upcoming"]);
assert.equal(normalizedResponse.partial, true);
assert.equal(hooks.normalizeGameEventsResponse({ ok: false }, NOW), null);
assert.equal(hooks.normalizeGameEventsResponse({ ok: true, enabled: false }, NOW), null);

function localTimestamp(year, monthIndex, day, hour = 12, minute = 0) {
  return new Date(year, monthIndex, day, hour, minute, 0, 0).getTime();
}

const springStart = localTimestamp(2026, 2, 29, 0);
const springEnd = localTimestamp(2026, 2, 30, 0);
assert.equal((springEnd - springStart) / 3_600_000, 23);
assert.equal(
  hooks.getGameEventLocalDayOrdinal(springEnd) - hooks.getGameEventLocalDayOrdinal(springStart),
  1
);
const autumnStart = localTimestamp(2026, 9, 25, 0);
const autumnEnd = localTimestamp(2026, 9, 26, 0);
assert.equal((autumnEnd - autumnStart) / 3_600_000, 25);
assert.equal(
  hooks.getGameEventLocalDayOrdinal(autumnEnd) - hooks.getGameEventLocalDayOrdinal(autumnStart),
  1
);

const todayOrdinal = String(hooks.getGameEventLocalDayOrdinal(NOW));
const tomorrowAt = localTimestamp(2026, 7, 14, 10);
const tomorrowOrdinal = String(hooks.getGameEventLocalDayOrdinal(tomorrowAt));
const timeline = [
  hooks.normalizeGameEvent(event({
    id: "2001",
    title: "Live",
    startAt: NOW - 60_000,
    endAt: tomorrowAt + 60_000
  }), NOW),
  hooks.normalizeGameEvent(event({ id: "2002", title: "Today", startAt: NOW + 60_000 }), NOW),
  hooks.normalizeGameEvent(event({ id: "2003", title: "Tomorrow", startAt: tomorrowAt, endAt: tomorrowAt + 60_000 }), NOW),
  { ...event({ id: "2004" }), startAt: NOW - 120_000, endAt: NOW - 60_000 }
];
assert.deepEqual(
  hooks.filterGameEvents(timeline, "all", NOW).map(({ id }) => id),
  ["2001", "2002", "2003"],
  "the continuous feed includes every non-ended event without a selected-day gate"
);
assert.deepEqual(
  hooks.filterGameEvents(timeline, "live", NOW).map(({ id }) => id),
  ["2001"]
);
assert.deepEqual(
  hooks.filterGameEvents(timeline, "upcoming", NOW).map(({ id }) => id),
  ["2002", "2003"]
);
const timelineGroups = hooks.groupGameEventsByDate(
  hooks.filterGameEvents(timeline, "all", NOW),
  NOW,
  "en-US"
);
assert.deepEqual(
  timelineGroups.map(({ key, label, events }) => ({
    key,
    label,
    ids: events.map(({ id }) => id)
  })),
  [
    { key: "live", label: "Live Now", ids: ["2001"] },
    { key: todayOrdinal, label: "Today", ids: ["2002"] },
    { key: tomorrowOrdinal, label: "Tomorrow", ids: ["2003"] }
  ],
  "one feed automatically groups live, today, and later events in chronological sections"
);
const saturdayAt = localTimestamp(2026, 7, 15, 10);
const sundayAt = localTimestamp(2026, 7, 16, 10);
const saturdayOrdinal = String(hooks.getGameEventLocalDayOrdinal(saturdayAt));
const sundayOrdinal = String(hooks.getGameEventLocalDayOrdinal(sundayAt));
const exactWeekdayEvents = [
  event({ id: "sat", startAt: saturdayAt, endAt: saturdayAt + 60_000 }),
  event({ id: "sun", startAt: sundayAt, endAt: sundayAt + 60_000 }),
  event({
    id: "weekend-span",
    startAt: saturdayAt - 60_000,
    endAt: sundayAt + 60_000
  })
];
assert.deepEqual(
  hooks.groupGameEventsByDate(
    hooks.filterGameEvents(exactWeekdayEvents, "all", NOW),
    NOW,
    "en-US"
  ).map(({ key, events }) => ({ key, ids: events.map(({ id }) => id) })),
  [
    { key: saturdayOrdinal, ids: ["weekend-span", "sat"] },
    { key: sundayOrdinal, ids: ["sun"] }
  ],
  "a multi-day event appears once under its start day instead of being duplicated across days"
);
const tomorrowMidnight = localTimestamp(2026, 7, 14, 0);
const midnightBoundaryEvents = [
  event({ id: "ends-at-midnight", startAt: NOW + 60_000, endAt: tomorrowMidnight }),
  event({
    id: "starts-at-midnight",
    startAt: tomorrowMidnight,
    endAt: tomorrowMidnight + 60_000
  })
];
assert.deepEqual(
  hooks.groupGameEventsByDate(midnightBoundaryEvents, NOW, "en-US")
    .map(({ label, events }) => ({ label, ids: events.map(({ id }) => id) })),
  [
    { label: "Today", ids: ["ends-at-midnight"] },
    { label: "Tomorrow", ids: ["starts-at-midnight"] }
  ],
  "automatic date groups change exactly at local midnight"
);
assert.equal(
  hooks.formatGameEventDateGroupLabel(tomorrowAt, NOW, "en-US"),
  "Tomorrow",
  "centering the date heading keeps the concise localized relative-day copy"
);
assert.equal(hooks.formatGameEventDateGroupLabel(tomorrowAt, NOW, "de-DE"), "Morgen");
assert.equal(hooks.formatGameEventDateGroupLabel(saturdayAt, NOW, "en-US"), "Saturday");
assert.equal(hooks.formatGameEventDateGroupLabel(sundayAt, NOW, "en-US"), "Sunday");
assert.equal(hooks.formatGameEventDateGroupLabel(sundayAt, NOW, "de-DE"), "Sonntag",
  "visual heading changes never replace Roblox's localized weekday text");
assert.match(
  hooks.formatGameEventDateGroupLabel(localTimestamp(2026, 7, 20, 10), NOW, "en-US"),
  /August 20, 2026/,
  "later feed groups use an unambiguous full local date"
);
const timing = hooks.formatGameEventTiming(timeline[0], NOW, "en-US");
assert.equal(timing.status, "live");
assert.match(timing.text, /^Ends\b/,
  "a live row leads with its relevant end instead of repeating an old start range");
assert.match(timing.text, /left$/);
assert.match(timing.range, /^Ends\b/);
assert.match(timing.countdown, /left$/);
assert.doesNotMatch(timing.text, /Starts in|\s[â€“–-]\s.*\s[â€“–-]\s/,
  "live timing does not combine a historical start/end range with a countdown");
assert.ok(timing.text.length <= 40, "live timing stays compact enough for one agenda line");
assert.match(timing.fullText, /Live now/);
assert.match(timing.fullText, /Started/);
assert.ok(timing.fullText.includes(new Date(timeline[0].startAt).toLocaleString("en-US")),
  "assistive timing preserves the historical start that the compact live row omits");
assert.match(
  hooks.formatGameEventAgendaMarker(timeline[0], NOW, "de-DE"),
  /\d{2}:\d{2}/,
  "a live event point retains its scheduled start while the separate solid dot marks NOW"
);
assert.match(
  hooks.formatGameEventAgendaMarker(event({
    id: "old-live-marker",
    startAt: NOW - 60 * 24 * 60 * 60_000,
    endAt: NOW + 24 * 60 * 60_000
  }), NOW, "en-US"),
  /[A-Za-z]{3}\s+\d{1,2}/,
  "a long-running cross-date live event uses a compact start date instead of a misleading clock"
);
assert.match(
  hooks.formatGameEventAgendaMarker(timeline[1], NOW, "de-DE"),
  /\d{2}:\d{2}/,
  "an upcoming event keeps its fixed local start clock"
);
const carriedUpcoming = event({
  id: "carried-upcoming",
  startAt: NOW + 60_000,
  endAt: tomorrowAt + 60_000
});
assert.match(
  hooks.formatGameEventAgendaMarker(carriedUpcoming, NOW, "en-US"),
  /\d{1,2}:\d{2}/,
  "a multi-day event still shows its real start clock because it appears only once"
);
assert.ok(
  hooks.formatGameEventTiming(carriedUpcoming, NOW, "en-US").fullText.includes(
    new Date(carriedUpcoming.startAt).toLocaleString("en-US")
  ),
  "the concise marker does not alter the event's complete accessible timing"
);
const upcomingTiming = hooks.formatGameEventTiming(timeline[1], NOW, "en-US");
assert.equal(upcomingTiming.status, "upcoming");
assert.match(upcomingTiming.text, /^Starts in\s+(?:<1m|\d+[mhd])/i,
  "an upcoming row explicitly says its countdown is until the start");
assert.doesNotMatch(upcomingTiming.text, /\bEnds?\b/i,
  "a future event never presents its start countdown as time until it ends");
assert.match(upcomingTiming.range, /^Starts\b/,
  "the internal compact range also describes the relevant upcoming boundary");
assert.match(upcomingTiming.countdown, /^Starts in\b/i);
assert.ok(upcomingTiming.text.length <= 40,
  "an upcoming time range and relative cue stay on one concise line");
assert.ok(upcomingTiming.fullText.length > upcomingTiming.text.length,
  "the short visual timing does not replace its complete accessible description");
const crossDayUpcomingTiming = hooks.formatGameEventTiming(event({
  id: "cross-day",
  startAt: tomorrowAt,
  endAt: tomorrowAt + 7 * 24 * 60 * 60_000
}), NOW, "en-US");
assert.match(crossDayUpcomingTiming.range, /^Starts\b/,
  "a multi-day future event still describes its next relevant boundary as its start");
assert.match(crossDayUpcomingTiming.countdown, /^Starts in\b/i);
assert.doesNotMatch(crossDayUpcomingTiming.text, /\bEnds?\b/i);
assert.ok(crossDayUpcomingTiming.text.length <= 40);

const axisEvents = [
  event({ id: "axis-1", startAt: NOW - 60 * 60_000, endAt: NOW + 5 * 60 * 60_000 }),
  event({ id: "axis-2", startAt: NOW + 60 * 60_000, endAt: NOW + 6 * 60 * 60_000 })
];
assert.deepEqual(hooks.getGameEventsTimelineNowPosition(axisEvents, NOW), {
  visible: true,
  beforeEventId: "axis-1",
  afterEventId: "axis-2",
  progress: 0.5,
  nextEventId: "axis-2",
  nextInMs: 60 * 60_000
});

const compressedGaps = [
  15 * 60_000,
  6 * 60 * 60_000,
  24 * 60 * 60_000,
  7 * 24 * 60 * 60_000,
  30 * 24 * 60 * 60_000
].map((duration) => hooks.getGameEventTimelineGap(NOW, NOW + duration));
assert.ok(
  compressedGaps.every((gap, index) => index === 0 || gap > compressedGaps[index - 1]),
  "larger waits receive monotonically more vertical space until the cap"
);
assert.equal(compressedGaps[compressedGaps.length - 1], 144,
  "month-long waits stop at the desktop spacing cap instead of creating huge blank areas");
assert.equal(hooks.getGameEventTimelineGap(NOW, NOW), 0);
assert.equal(hooks.getGameEventTimelineGap(NOW, NOW - 1), 0);
assert.equal(hooks.getGameEventTimelineGap("bad", NOW), 0);
assert.equal(hooks.getGameEventTimelineGap(NOW, NOW + 365 * 24 * 60 * 60_000, 72), 72,
  "the same helper supports the smaller responsive cap");

const previousUpcoming = event({
  id: "previous-upcoming",
  startAt: NOW + 15 * 60_000,
  endAt: NOW + 45 * 60_000
});
const oneHourAhead = event({
  id: "one-hour-ahead",
  startAt: NOW + 60 * 60_000,
  endAt: NOW + 2 * 60 * 60_000
});
assert.equal(
  hooks.getGameEventTimelineGapBefore(previousUpcoming, oneHourAhead, NOW),
  hooks.getGameEventTimelineGap(previousUpcoming.startAt, oneHourAhead.startAt),
  "consecutive upcoming starts participate in the same monotonic compressed scale"
);
const firstAtSix = event({
  id: "first-at-six",
  startAt: localTimestamp(2026, 7, 13, 18),
  endAt: localTimestamp(2026, 7, 13, 19)
});
assert.equal(
  hooks.getGameEventTimelineGapBefore(null, firstAtSix, NOW),
  hooks.getGameEventTimelineGap(NOW, firstAtSix.startAt),
  "the first future event is spaced by its remaining wait rather than time since midnight"
);
assert.equal(hooks.getGameEventTimelineTailSpace([oneHourAhead], NOW), 36,
  "an axis with a future anchor needs only its compact baseline tail");
const justStartedTimelineEvent = event({
  id: "just-started-timeline-event",
  startAt: NOW - 5 * 60_000,
  endAt: NOW + 60 * 60_000
});
assert.ok(hooks.getGameEventTimelineTailSpace([justStartedTimelineEvent], NOW) <= 168,
  "an after-last NOW point gets a visible but bounded tail");

const futureOnlyAtSix = hooks.getGameEventsTimelineNowPosition([firstAtSix], NOW);
assert.equal(futureOnlyAtSix.visible, true);
assert.equal(futureOnlyAtSix.beforeEventId, null);
assert.equal(futureOnlyAtSix.afterEventId, "first-at-six");
assert.equal(futureOnlyAtSix.progress, 0,
  "a future-only model uses a virtual point before the first rendered event");
const futureOnlyOneHourLater = hooks.getGameEventsTimelineNowPosition(
  [firstAtSix],
  NOW + 60 * 60_000
);
assert.equal(futureOnlyOneHourLater.progress, 0);
assert.ok(
  hooks.getGameEventTimelineGap(NOW + 60 * 60_000, firstAtSix.startAt) <
    hooks.getGameEventTimelineGap(NOW, firstAtSix.startAt),
  "the virtual point moves toward the first event as its compressed remaining gap shrinks"
);

const justBeforeMidnight = localTimestamp(2026, 7, 13, 23, 59);
const justAfterMidnight = localTimestamp(2026, 7, 14, 0, 1);
const morningAfterMidnight = localTimestamp(2026, 7, 14, 10);
assert.ok(
  hooks.getGameEventTimelineGap(justAfterMidnight, morningAfterMidnight) <=
    hooks.getGameEventTimelineGap(justBeforeMidnight, morningAfterMidnight),
  "crossing midnight keeps advancing toward the same first event instead of resetting the point"
);

const tomorrowOnly = event({
  id: "axis-tomorrow-only",
  startAt: tomorrowAt,
  endAt: tomorrowAt + 60 * 60_000
});
const tomorrowOnlyPosition = hooks.getGameEventsTimelineNowPosition([tomorrowOnly], NOW);
assert.equal(tomorrowOnlyPosition.visible, true);
assert.equal(tomorrowOnlyPosition.beforeEventId, null);
assert.equal(tomorrowOnlyPosition.afterEventId, "axis-tomorrow-only");
assert.equal(tomorrowOnlyPosition.progress, 0,
  "NOW remains on a virtual pre-event segment when its first visible event is tomorrow");

const equalStartAlpha = event({
  id: "equal-alpha",
  title: "Alpha",
  startAt: firstAtSix.startAt,
  endAt: firstAtSix.endAt
});
const equalStartZulu = event({
  id: "equal-zulu",
  title: "Zulu",
  startAt: firstAtSix.startAt,
  endAt: firstAtSix.endAt
});
assert.ok(hooks.compareGameEventTimelineOrder(equalStartAlpha, equalStartZulu) < 0,
  "equal timestamps have a deterministic title/id row order");
for (const equalInput of [
  [equalStartAlpha, equalStartZulu],
  [equalStartZulu, equalStartAlpha]
]) {
  const futureEqualPosition = hooks.getGameEventsTimelineNowPosition(equalInput, NOW);
  assert.equal(futureEqualPosition.afterEventId, "equal-alpha",
    "a future equal-time cluster targets its deterministic first rendered row");
  const passedEqualPosition = hooks.getGameEventsTimelineNowPosition(
    equalInput,
    firstAtSix.startAt + 1
  );
  assert.equal(passedEqualPosition.beforeEventId, "equal-zulu",
    "after passing an equal-time cluster, its deterministic last rendered row anchors NOW");
}
assert.equal(
  hooks.getGameEventTimelineGapBefore(equalStartAlpha, equalStartZulu, NOW),
  0,
  "equal-time rows do not invent elapsed-time whitespace"
);

assert.deepEqual(
  hooks.getGameEventsTimelineNowPosition(axisEvents, NOW + 2 * 60 * 60_000),
  {
    visible: true,
    beforeEventId: "axis-2",
    afterEventId: null,
    progress: 1,
    nextEventId: null,
    nextInMs: 0
  },
  "after the final start, NOW stays visible on the bounded tail of an active timeline"
);
const crossDatePosition = hooks.getGameEventsTimelineNowPosition([
  axisEvents[0],
  event({ id: "axis-tomorrow", startAt: tomorrowAt, endAt: tomorrowAt + 60_000 })
], NOW);
assert.equal(crossDatePosition.visible, true);
assert.equal(crossDatePosition.beforeEventId, "axis-1");
assert.equal(crossDatePosition.afterEventId, "axis-tomorrow");
assert.ok(crossDatePosition.progress > 0 && crossDatePosition.progress < 1,
  "the moving point interpolates across date headings instead of stopping at midnight");
assert.deepEqual(hooks.getGameEventsTimelineNowPosition([], NOW), {
  visible: false
});
assert.deepEqual(hooks.getGameEventsTimelineNowPosition([
  event({ id: "ended-axis", startAt: NOW - 2 * 60_000, endAt: NOW - 60_000 })
], NOW), { visible: false },
"ended-only data has no visible time axis");

const dstNow = new Date("2026-03-29T03:00:00+02:00").getTime();
const dstAxis = hooks.getGameEventsTimelineNowPosition([
  event({ id: "dst-before", startAt: new Date("2026-03-29T01:00:00+01:00").getTime() }),
  event({ id: "dst-after", startAt: new Date("2026-03-29T04:00:00+02:00").getTime() })
], dstNow);
assert.equal(dstAxis.progress, 0.5,
  "timeline progress uses real elapsed instants through the local DST jump");

const sidebarSource = sourceBetween(
  "  function makeGameEventsSidebarRow(",
  "  function setServerHistorySidebarIcon("
);
assert.match(sidebarSource, /row\.id = GAME_EVENTS_ROW_ID/);
assert.match(sidebarSource, /row\.dataset\.rslControl = "game-events"/);
assert.match(sidebarSource, /anchor\.setAttribute\("aria-haspopup", "dialog"\)/);
assert.match(sidebarSource, /anchor\.setAttribute\("aria-controls", GAME_EVENTS_DIALOG_ID\)/);
assert.match(sidebarSource, /anchor\.setAttribute\("aria-label", "Open Game Events"\)/);
assert.match(sidebarSource, /anchor\.title = "Events"/);
assert.match(sidebarSource, /label\.textContent = "Events"/);
assert.match(sidebarSource, /event\.isTrusted !== true/);
assert.match(sidebarSource, /!isFeatureEnabled\("gameEvents"\)/);
assert.match(sidebarSource, /!isFeatureEnabled\("sidebarShortcuts"\)/);
assert.match(sidebarSource, /!isFeatureEnabled\("sidebarGameEvents"\)/);
assert.match(sidebarSource, /duplicates\.forEach\(\(duplicate\) => duplicate\.remove\(\)\)/);
assert.match(sidebarSource, /historyRow/);
assert.match(sidebarSource, /firstOwnedCustomRow/);

const mountSource = sourceBetween(
  "  function mountExtensionFeatures(",
  "  function flushFeatureSettingsReconcile("
);
assert.ok(
  mountSource.indexOf("mountGameEventsSidebarRow();") <
    mountSource.indexOf("mountServerHistorySidebarRow();"),
  "Events must be a fixed row immediately before Server History"
);
assert.ok(
  mountSource.indexOf("mountServerHistorySidebarRow();") <
    mountSource.indexOf('if (isFeatureEnabled("sidebarCustomShortcuts"))'),
  "both fixed rows must be independent of custom shortcuts"
);
assert.match(mountSource, /cleanupGameEventsFeature/);
assert.match(mountSource, /GAME_EVENTS_ROW_ID/);

const dialogSource = sourceBetween(
  "  function createGameEventsDialog(",
  "  function normalizeServerHistoryOpaqueId("
);
const featureRuntimeSource = sourceBetween(
  "  function sendGameEventsRuntimeMessage(",
  "  function normalizeServerHistoryOpaqueId("
);
const renderDialogRuntimeSource = sourceBetween(
  "  function renderGameEventsDialog()",
  "  function refreshGameEventsTimelineNowMarker("
);
const liveSectionRuntimeSource = sourceBetween(
  "  function renderGameEventsLiveSection(",
  "  function syncGameEventsLiveSectionCollapse("
);
const liveCollapseRuntimeSource = sourceBetween(
  "  function syncGameEventsLiveSectionCollapse(",
  "  function renderGameEventsTimelineSection("
);
const timelineSectionRuntimeSource = sourceBetween(
  "  function renderGameEventsTimelineSection(",
  "  function renderGameEventsDialog()"
);
const eventItemRuntimeSource = sourceBetween(
  "  function renderGameEventItem(",
  "  function renderGameEventsFilters("
);
const gameEventJoinFeedbackSource = sourceBetween(
  "  function restoreGameEventJoinButton(",
  "  function dispatchRandomServerResponse("
);
const searchRuntimeSource = sourceBetween(
  "  function normalizeGameEventSearchResult(",
  "  function renderGameEventsFavorites("
);
const addPanelToggleRuntimeSource = sourceBetween(
  '    dialog.querySelector("[data-rsl-game-events-add-toggle]")?.addEventListener(',
  '    dialog.querySelector("[data-rsl-game-events-manage-toggle]")?.addEventListener('
);
const managePanelToggleRuntimeSource = sourceBetween(
  '    dialog.querySelector("[data-rsl-game-events-manage-toggle]")?.addEventListener(',
  '    dialog.querySelector("[data-rsl-game-events-list]")?.addEventListener('
);
const liveToggleRuntimeSource = sourceBetween(
  '    dialog.querySelector("[data-rsl-game-events-list]")?.addEventListener(',
  '    dialog.querySelector("[data-rsl-game-events-add-form]")?.addEventListener('
);
assert.match(dialogSource, /document\.createElement\("dialog"\)/);
assert.match(dialogSource, /aria-labelledby/);
assert.match(dialogSource, /role="status" aria-live="polite" aria-atomic="true"/);
assert.match(dialogSource, /aria-label="Filter game events"/);
assert.match(dialogSource, /aria-label="Event status"/);
assert.match(dialogSource,
  /class="rsl-game-events__list" role="region" aria-label="Official game events" tabindex="0" data-rsl-game-events-list/,
  "the one scrolling viewport is a named, keyboard-focusable region");
assert.equal(
  (dialogSource.match(/data-rsl-game-events-status-filter="/g) || []).length,
  3,
  "All, Live, and Upcoming are the only feed selectors"
);
assert.ok(
  dialogSource.indexOf('aria-label="Event status"') <
    dialogSource.indexOf('aria-label="Official game events"'),
  "status filters appear directly before the combined live-and-upcoming feed"
);
assert.doesNotMatch(dialogSource,
  /data-rsl-game-events-date-(?:filter|filters|page)|aria-label="(?:Choose a date|Event date|Show previous dates|Show later dates)"/,
  "the dialog has no date cards, date selection, or paging arrows");
assert.doesNotMatch(contentSource,
  /gameEventsDateFilter|gameEventsCalendarOffset|getGameEventDateChips|getGameEventLocalDayRange/,
  "the removed calendar has no retained state or helper path");
assert.match(dialogSource, /dialog\.showModal\(\)/);
assert.match(dialogSource, /opener\.focus\(\{ preventScroll: true \}\)/);
assert.match(featureRuntimeSource, /locale: getRobloxPageLocale\(\)/,
  "content must send the Roblox page locale");
assert.match(featureRuntimeSource, /expectedViewerUserId/);
assert.match(featureRuntimeSource, /epoch !== gameEventsLifecycleEpoch/);
assert.match(featureRuntimeSource, /response\?\.requestId !== requestId/);
assert.match(featureRuntimeSource, /forceRefresh: forceRefresh === true/);
assert.match(featureRuntimeSource, /gameEventsStatusFilter = "all"/);
assert.match(featureRuntimeSource, /button\.setAttribute\("aria-pressed", String\(selected\)\)/);
assert.match(renderDialogRuntimeSource,
  /const filtered = filterGameEvents\(\s*gameEventsItems,\s*gameEventsStatusFilter,\s*now\s*\)[\s\S]*?const liveEvents = filterGameEvents\(gameEventsItems, "live", now\)[\s\S]*?const upcomingEvents = filterGameEvents\(gameEventsItems, "upcoming", now\)/,
  "the selected status is checked before live and upcoming events are split into distinct views");
assert.match(renderDialogRuntimeSource,
  /if \(gameEventsStatusFilter !== "upcoming"\) \{[\s\S]*?renderGameEventsLiveSection\(liveEvents, now\)[\s\S]*?if \(gameEventsStatusFilter !== "live"\) \{[\s\S]*?renderGameEventsTimelineSection\(upcomingEvents, now\)/,
  "All shows both sections, Live shows only the active panel, and Upcoming shows only the timeline");
assert.equal(
  (timelineSectionRuntimeSource.match(/document\.createElement\("ol"\)/g) || []).length,
  1,
  "the upcoming section creates exactly one flat ordered timeline"
);
assert.doesNotMatch(renderDialogRuntimeSource, /document\.createElement\("ul"\)/,
  "the render coordinator cannot introduce nested date lists or nested scrolling frames");
assert.equal(
  (liveSectionRuntimeSource.match(/document\.createElement\("ul"\)/g) || []).length,
  1,
  "the active panel owns one semantic list without nesting it into the timeline"
);
assert.match(renderDialogRuntimeSource,
  /feed\.className = "rsl-game-events__feed"[\s\S]*?feed\.append\(renderGameEventsLiveSection\(liveEvents, now\)\)[\s\S]*?feed\.append\(renderGameEventsTimelineSection\(upcomingEvents, now\)\)[\s\S]*?list\.append\(feed\)/,
  "the compact live panel precedes the upcoming timeline inside one outer feed");
assert.match(liveSectionRuntimeSource,
  /section\.className = "rsl-game-events__live-section"[\s\S]*?aria-labelledby", "rsl-game-events-live-heading"[\s\S]*?liveList\.className = "rsl-game-events__live-list"[\s\S]*?variant: "live-panel"/,
  "active events use a named compact list instead of the time-scaled axis");
assert.match(liveSectionRuntimeSource,
  /if \(events\.length > 0\)[\s\S]*?document\.createElement\("button"\)[\s\S]*?toggle\.type = "button"[\s\S]*?className = "rsl-game-events__live-toggle"[\s\S]*?data-rsl-game-events-live-toggle[\s\S]*?aria-controls", "rsl-game-events-live-list"[\s\S]*?aria-expanded", String\(!gameEventsLiveSectionCollapsed\)[\s\S]*?Show active events[\s\S]*?Hide active events/,
  "Live Now exposes an accessible Hide/Show disclosure only when active cards exist");
assert.match(liveSectionRuntimeSource,
  /liveList\.id = "rsl-game-events-live-list"[\s\S]*?data-rsl-game-events-live-list[\s\S]*?liveList\.hidden = gameEventsLiveSectionCollapsed/,
  "the disclosure controls the stable active-card list without hiding its heading or count");
assert.match(liveCollapseRuntimeSource,
  /section\.classList\.toggle\([\s\S]*?rsl-game-events__live-section--collapsed[\s\S]*?gameEventsLiveSectionCollapsed[\s\S]*?liveList\.hidden = gameEventsLiveSectionCollapsed[\s\S]*?toggle\.textContent = gameEventsLiveSectionCollapsed \? "Show" : "Hide"[\s\S]*?aria-expanded", String\(!gameEventsLiveSectionCollapsed\)[\s\S]*?Show active events[\s\S]*?Hide active events/,
  "collapsing Live Now synchronizes the list and every visible and accessible button state in place");
assert.doesNotMatch(liveCollapseRuntimeSource,
  /renderGameEventsDialog|replaceChildren|data-rsl-game-events-timeline|scrollTop\s*=|\.focus\(/,
  "the collapse helper cannot rebuild or disturb the upcoming axis, scroll position, or keyboard focus");
assert.match(timelineSectionRuntimeSource,
  /section\.className = "rsl-game-events__timeline-section"[\s\S]*?aria-labelledby", "rsl-game-events-timeline-heading"[\s\S]*?timeline\.className = "rsl-game-events__timeline"[\s\S]*?timeline\.append\(nowMarker\)[\s\S]*?section\.append\(timeline\)/,
  "upcoming events and the decorative NOW point share the separately named timeline");
assert.match(timelineSectionRuntimeSource, /heading\.textContent = "Upcoming"/,
  "the axis starts under a short, clear Upcoming heading");
assert.match(eventItemRuntimeSource,
  /if \(!livePanel && groupLabel\)[\s\S]*?document\.createElement\("h3"\)[\s\S]*?heading\.id = groupHeadingId[\s\S]*?item\.append\(heading\)/,
  "automatic date labels remain real headings inside the upcoming timeline");
assert.match(eventItemRuntimeSource,
  /document\.createElement\("h3"\)[\s\S]*?document\.createElement\("span"\)[\s\S]*?className = "rsl-game-events__date-heading-label"[\s\S]*?textContent = groupLabel[\s\S]*?heading\.append\([^)]*\)[\s\S]*?item\.append\(heading\)/,
  "each semantic date heading owns a compact label that can ellipsize without clipping its rail connector");
assert.match(featureRuntimeSource, /detail\.textContent = "Try another status filter\."/);
assert.doesNotMatch(featureRuntimeSource, /No events on this date|Try another date|another status or date/,
  "empty states never imply that a day was selected");
assert.match(featureRuntimeSource, /className = "rsl-game-events__time-rail"/);
assert.match(featureRuntimeSource, /className = "rsl-game-events__time-marker"/);
assert.match(featureRuntimeSource, /className = "rsl-game-events__time-dot"/);
assert.match(featureRuntimeSource, /className = "rsl-game-events__now-marker"/);
assert.match(eventItemRuntimeSource,
  /const livePanel = variant === "live-panel"[\s\S]*?livePanel \? "data-rsl-game-events-live-event-id" : "data-rsl-game-event-id"/,
  "live cards use a distinct event attribute so NOW geometry cannot discover them");
assert.match(eventItemRuntimeSource,
  /if \(!livePanel\) \{[\s\S]*?--rsl-game-events-gap-before[\s\S]*?let timeRail = null;[\s\S]*?if \(!livePanel\) \{[\s\S]*?className = "rsl-game-events__time-rail"/,
  "live cards omit both proportional timeline gaps and scheduled-start rail markers");
assert.match(eventItemRuntimeSource,
  /if \(livePanel\) row\.append\(thumbnail, main, timing, actions\);\s*else row\.append\(timeRail, thumbnail, main, timing, actions\)/,
  "live-card source order contains no hidden rail column");
assert.doesNotMatch(eventItemRuntimeSource, /time-rail--live/,
  "the detached active panel cannot retain a misleading live timeline dot");
assert.match(featureRuntimeSource, /nowMarker\.hidden = true/,
  "the moving point cannot flash before its global-axis position is measured");
assert.doesNotMatch(timelineSectionRuntimeSource, /data-rsl-game-events-now-positioned/,
  "a marker created by any full data/add/remove render cannot inherit a transition-ready state");
assert.doesNotMatch(featureRuntimeSource, /className = "rsl-game-events__next-countdown"/,
  "the next-event countdown must not create a visible full-row overlay");
assert.doesNotMatch(featureRuntimeSource, /`Next in \$\{formatGameEventCountdown\(model\.nextInMs\)\}`/,
  "the moving point must not duplicate each row's Starts-in timing");
assert.match(featureRuntimeSource, /refreshGameEventsTimelineNowMarker\(dialog, now\)/,
  "the minute tick updates the Now point without rebuilding the event list");
const timelinePositionSource = sourceBetween(
  "  function getGameEventsTimelineNowPosition(",
  "  function renderGameEventItem("
);
assert.doesNotMatch(timelinePositionSource,
  /getGameEventLocalDayOrdinal\(event\.startAt\) === todayDay/,
  "the moving point must not discard cross-date anchors");
assert.match(timelinePositionSource,
  /if \(previousIndex < 0\)[\s\S]*?beforeEventId: null[\s\S]*?afterEventId: next\.id[\s\S]*?progress: 0/,
  "future-only feeds expose a virtual segment before their first event");
assert.doesNotMatch(timelinePositionSource, /setHours\(0, 0, 0, 0\)|localDayStart|originTime/,
  "the virtual point cannot jump backward when the local date changes");
assert.match(timelinePositionSource,
  /ordered\.forEach\(\(event\) => \{[\s\S]*?const cluster = clusters\.at\(-1\)[\s\S]*?cluster\?\.startAt === event\.startAt[\s\S]*?cluster\.last = event[\s\S]*?clusters\.push\(\{ startAt: event\.startAt, first: event, last: event \}\)/,
  "equal-time clusters retain deterministic first and last rendered row endpoints");
assert.match(timelinePositionSource,
  /const next = nextCluster\.first[\s\S]*?const previous = previousCluster\.last/,
  "NOW approaches the first row of a future cluster and leaves from the last row of a passed cluster");
assert.match(timelinePositionSource,
  /if \(nextIndex < 0\)[\s\S]*?beforeEventId: previous\.id[\s\S]*?afterEventId: null[\s\S]*?progress: 1/,
  "after-last feeds retain NOW on a bounded tail instead of making it disappear");
assert.doesNotMatch(timelinePositionSource, /selectedDateKey|dateFilter/);
assert.doesNotMatch(featureRuntimeSource, /"CONT\."/,
  "events are shown once, so the feed has no carried-in marker state");
const nowMarkerRefreshSource = sourceBetween(
  "  function refreshGameEventsTimelineNowMarker(",
  "  function clearGameEventsTimers()"
);
assert.match(featureRuntimeSource, /nowLabel\.textContent = "NOW"/,
  "the rail marker uses a tiny stable label instead of a long current-clock overlay");
assert.match(featureRuntimeSource,
  /nowMarker\.setAttribute\("role", "presentation"\)[\s\S]*?nowMarker\.setAttribute\("aria-hidden", "true"\)/,
  "the visual minute marker stays silent because each event retains full accessible timing");
assert.match(eventItemRuntimeSource,
  /marker\.setAttribute\("aria-hidden", "true"\)[\s\S]*?markerDot\.setAttribute\("aria-hidden", "true"\)/,
  "fixed clock labels and decorative event points do not duplicate accessible timing");
assert.doesNotMatch(nowMarkerRefreshSource,
  /Intl\.DateTimeFormat|toLocaleTimeString|currentDate|Next in/,
  "the moving point does not render clock or countdown text over a row");
assert.doesNotMatch(nowMarkerRefreshSource,
  /replaceChildren|scrollTop\s*=|\.focus\(/,
  "measuring the global point never rebuilds the feed, changes scroll, or steals focus");
assert.match(nowMarkerRefreshSource,
  /if \(!model\.visible\) \{[\s\S]*?marker\.hidden = true[\s\S]*?marker\.removeAttribute\("data-rsl-game-events-now-positioned"\)[\s\S]*?return model/,
  "an unavailable NOW point is hidden and loses its transition-ready state");
assert.match(nowMarkerRefreshSource,
  /if \(\(model\.beforeEventId && !beforeDot\) \|\| \(model\.afterEventId && !afterDot\)\) \{[\s\S]*?marker\.hidden = true[\s\S]*?marker\.removeAttribute\("data-rsl-game-events-now-positioned"\)/,
  "missing geometry cannot leave a stale positioned marker visible");
assert.match(nowMarkerRefreshSource,
  /const firstPlacement = marker\.hidden \|\|[\s\S]*?data-rsl-game-events-now-positioned[\s\S]*?marker\.style\.setProperty\("--rsl-game-events-now-y"[\s\S]*?marker\.hidden = false[\s\S]*?if \(firstPlacement\) \{[\s\S]*?marker\.getBoundingClientRect\(\)[\s\S]*?marker\.setAttribute\("data-rsl-game-events-now-positioned", "true"\)/,
  "a new marker receives its final position while hidden before transitions are enabled");
assert.ok(
  nowMarkerRefreshSource.indexOf('marker.style.setProperty("--rsl-game-events-now-y"') <
    nowMarkerRefreshSource.indexOf("marker.hidden = false"),
  "the first visible frame is already at the measured NOW position"
);
assert.match(nowMarkerRefreshSource,
  /const timeline = list\?\.querySelector\?\.\("\[data-rsl-game-events-timeline\]"\)[\s\S]*?beforeY[\s\S]*?afterY[\s\S]*?\(afterY - beforeY\) \* progress/,
  "the point uses measured positions on the complete rendered axis");
assert.match(nowMarkerRefreshSource,
  /\[\.\.\.timeline\.querySelectorAll\("\[data-rsl-game-event-id\]"\)\]/,
  "NOW derives geometry only from upcoming rows inside the timeline");
assert.doesNotMatch(nowMarkerRefreshSource, /data-rsl-game-events-live-event-id/,
  "old live start times cannot pull NOW upward or create enormous axis gaps");
assert.match(nowMarkerRefreshSource,
  /if \(!beforeDot && afterDot\)[\s\S]*?dotY\(afterDot\) - Math\.max\(18,\s*12 \+ getGameEventTimelineGap\(now, nextEvent\?\.startAt\)\s*\)/,
  "before-first NOW is offset upward only by the compressed remaining wait, with no midnight origin");
assert.match(nowMarkerRefreshSource,
  /else if \(beforeDot && !afterDot\)[\s\S]*?beforeY \+ Math\.max\(18,\s*12 \+ getGameEventTimelineGap\(previousEvent\?\.startAt, now\)\s*\)/,
  "after-last NOW uses a small explicit compressed-time tail measured from the final point");
assert.doesNotMatch(nowMarkerRefreshSource, /timeline\.scrollHeight/,
  "after-last placement cannot jump to the bottom of an otherwise tall viewport");
assert.match(eventItemRuntimeSource,
  /main\.append\(titleRow, context, accessibleSubtitle, accessibleTiming\)[\s\S]*?actions\.append\(join, link\)[\s\S]*?row\.append\(timeRail, thumbnail, main, timing, actions\)[\s\S]*?item\.append\(row\)/,
  "each event keeps two clean copy lines, timing, and a dedicated action group in source order");
assert.match(eventItemRuntimeSource, /title\.textContent = event\.title/);
assert.match(eventItemRuntimeSource,
  /title\.title = event\.subtitle \? `\$\{event\.title\}\\n\$\{event\.subtitle\}` : event\.title/,
  "an ellipsized event title retains its full title and hidden subtitle on hover");
assert.doesNotMatch(eventItemRuntimeSource, /rsl-game-events__live-badge|textContent = "LIVE"/,
  "the green rail state already identifies live events without a duplicate badge");
assert.match(eventItemRuntimeSource, /context\.textContent = event\.gameName/,
  "the context row stays readable by showing only the game name");
assert.match(eventItemRuntimeSource, /context\.title = context\.textContent/,
  "an ellipsized game name retains its full text on hover");
assert.doesNotMatch(eventItemRuntimeSource,
  /context\.textContent\s*=\s*event\.subtitle|\$\{event\.gameName\}[^`]*\$\{event\.subtitle\}/,
  "long event subtitles must not be concatenated into the game-name row");
assert.match(eventItemRuntimeSource,
  /accessibleSubtitle\.className = "rsl-sr-only"[\s\S]*?`Event details: \$\{event\.subtitle\}`/,
  "hiding promotional subtitle clutter does not discard that event detail for assistive technology");
assert.match(eventItemRuntimeSource, /timing\.title = timingValue\.fullText/);
assert.match(eventItemRuntimeSource, /accessibleTiming\.textContent = timingValue\.fullText/,
  "the concise visible timing retains a complete screen-reader description");
assert.match(contentSource,
  /const GAME_EVENTS_LAUNCH_SURFACE_ATTRIBUTE = "data-rsl-game-events-launch-surface"/,
  "Game Events owns a narrowly scoped MAIN-world launch surface");
assert.match(eventItemRuntimeSource,
  /actions\.className = "rsl-game-events__actions"[\s\S]*?actions\.setAttribute\(GAME_EVENTS_LAUNCH_SURFACE_ATTRIBUTE, ""\)/,
  "each event action group explicitly opts into the trusted launch bridge");
assert.match(eventItemRuntimeSource,
  /const join = document\.createElement\("button"\)[\s\S]*?join\.type = "button"[\s\S]*?rsl-button--primary rsl-game-events__join[\s\S]*?join\.textContent = "Join Game"[\s\S]*?join\.setAttribute\(QUICK_PLAY_ACTION_ATTRIBUTE, "play"\)[\s\S]*?join\.setAttribute\(QUICK_PLAY_PLACE_ID_ATTRIBUTE, event\.placeId\)[\s\S]*?join\.setAttribute\("data-rsl-game-events-join", event\.id\)/,
  "every official event exposes a clear primary Join Game button backed by its normalized Place ID");
assert.match(eventItemRuntimeSource,
  /join\.dataset\.rslGameEventsDefaultLabel = `Join Game: \$\{event\.gameName\}`[\s\S]*?join\.setAttribute\("aria-label", join\.dataset\.rslGameEventsDefaultLabel\)/,
  "Join Game has a game-specific accessible name and a stable feedback restore label");
assert.doesNotMatch(eventItemRuntimeSource,
  /isFeatureEnabled\("quickPlay"\)|isQuickPlayActionEnabled/,
  "Event joining must remain available when the separate game-card Quick Play feature is disabled");
assert.match(eventItemRuntimeSource,
  /link\.className = "rsl-button rsl-button--secondary rsl-game-events__view"/,
  "View Event remains the secondary action beside Join Game");
assert.match(gameEventJoinFeedbackSource,
  /button\.textContent = "Join Game"[\s\S]*?button\.dataset\.rslQuickPlayState = code === "started" \? "launching" : "error"[\s\S]*?button\.textContent = code === "started" \? "Launching[^\"]*" : "Try Again"/,
  "Join Game reports both launch progress and a retryable failure without replacing the row");
assert.match(gameEventJoinFeedbackSource,
  /if \(gameEventSurface\) \{[\s\S]*?!isFeatureEnabled\("gameEvents"\)[\s\S]*?action !== "play"[\s\S]*?result\?\.action !== "play"[\s\S]*?handleGameEventJoinResult\(button, result\.code\)[\s\S]*?return;[\s\S]*?!isFeatureEnabled\("quickPlay"\)/,
  "Game Events validates its own play result before the independent Quick Play feature gate");
assert.match(renderDialogRuntimeSource,
  /focusedEventAction = document\.activeElement\?\.hasAttribute\?\.\("data-rsl-game-events-join"\)[\s\S]*?`\[data-rsl-game-events-\$\{focusedEventAction\}="\$\{CSS\.escape\(focusedEventId\)\}"\]`[\s\S]*?focus\?\.\(\{ preventScroll: true \}\)/,
  "minute, filter, and data rerenders restore focus to either Join Game or View Event");
const minuteRefreshSource = sourceBetween(
  "  function refreshGameEventTimes()",
  "  function scheduleGameEventsMinuteRefresh()"
);
assert.doesNotMatch(minuteRefreshSource, /renderGameEventsDialog|list\.replaceChildren|scrollTop|\.focus\(/,
  "the moving point must not reset list scroll or keyboard focus each minute");
assert.match(featureRuntimeSource,
  /new ResizeObserver\(refreshGameEventsTimelineAfterResize\)[\s\S]*?gameEventsResizeObserver\.observe\(list\)/,
  "responsive row changes recompute the proportional Now position");
assert.match(featureRuntimeSource,
  /window\.addEventListener\("resize", refreshGameEventsTimelineAfterResize/,
  "older browsers retain a passive resize fallback");
assert.match(featureRuntimeSource,
  /gameEventsResizeObserver\?\.disconnect\?\.\(\)[\s\S]*?window\.removeEventListener\("resize", refreshGameEventsTimelineAfterResize\)/,
  "closing Events cleans up every feed resize observer/listener");
const minuteScheduleSource = sourceBetween(
  "  function scheduleGameEventsMinuteRefresh()",
  "  function scheduleGameEventsBoundaryRefresh()"
);
assert.match(minuteScheduleSource,
  /60_000 - \(Date\.now\(\) % 60_000\)/,
  "the moving point targets the next minute boundary instead of drifting");
assert.match(minuteScheduleSource,
  /refreshGameEventTimes\(\);[\s\S]*?scheduleGameEventsMinuteRefresh\(\);/,
  "the targeted minute callback reschedules itself while the dialog stays open");

assert.match(searchRuntimeSource, /window\.setTimeout\([\s\S]*?GAME_EVENTS_SEARCH_DEBOUNCE_MS/,
  "name suggestions are debounced");
assert.match(searchRuntimeSource, /type: GAME_EVENTS_SEARCH_MESSAGE_TYPE/);
assert.match(searchRuntimeSource, /query,[\s\S]*?viewerUserId[\s\S]*?locale: getRobloxPageLocale\(\)/,
  "suggestions carry the exact query, viewer, and Roblox page locale");
assert.match(searchRuntimeSource,
  /epoch !== gameEventsLifecycleEpoch[\s\S]*?sequence !== gameEventsSearchSequence[\s\S]*?input\?\.value[\s\S]*?response\?\.requestId !== requestId/,
  "late, stale-query, closed-dialog, and mismatched replies are ignored");
assert.match(searchRuntimeSource, /responseViewer !== viewerUserId/,
  "suggestions cannot cross Roblox account boundaries");
assert.match(searchRuntimeSource, /Searching Roblox experiences/);
assert.match(searchRuntimeSource, /No matching experiences found/);
assert.match(searchRuntimeSource, /Suggestions are unavailable/);
assert.match(searchRuntimeSource, /className = "rsl-game-events__search-thumbnail/);
assert.match(searchRuntimeSource, /name\.textContent = result\.name/);
assert.match(searchRuntimeSource, /role", "option"/);
assert.match(searchRuntimeSource, /aria-selected/);
assert.match(searchRuntimeSource, /aria-activedescendant/);
assert.match(searchRuntimeSource, /gameEventsSelectedSearchResult = result/);
assert.match(searchRuntimeSource, /gameEventsSearchSequence \+= 1/,
  "choosing or clearing a result invalidates an in-flight reply");

assert.match(dialogSource, /role="combobox"/);
assert.match(dialogSource, /aria-autocomplete="list"/);
assert.match(dialogSource, /role="listbox"/);
assert.match(dialogSource, /data-rsl-game-events-search-status/);
assert.match(dialogSource, /event\.key === "ArrowDown" \|\| event\.key === "ArrowUp"/);
assert.match(dialogSource, /event\.key === "Home" \|\| event\.key === "End"/);
assert.match(dialogSource, /event\.key === "Enter"[\s\S]*?selectGameEventsSearchResult/);
assert.match(dialogSource, /event\.key === "Escape"[\s\S]*?clearGameEventsSearch/);
assert.match(dialogSource,
  /data-rsl-game-events-search-results[\s\S]*?event\.isTrusted !== true[\s\S]*?selectGameEventsSearchResult/,
  "only a trusted suggestion click selects a game");
assert.match(dialogSource,
  /addGameEventFavorite\([\s\S]*?gameEventsSelectedSearchResult\?\.universeId \|\| null/,
  "a chosen suggestion adds its exact Universe ID while raw link/ID submission stays available");
assert.match(dialogSource,
  /data-rsl-game-events-status-filter[\s\S]*?event\.isTrusted !== true[\s\S]*?gameEventsStatusFilter = button\.getAttribute[\s\S]*?list\.scrollTop = 0[\s\S]*?renderGameEventsDialog\(\)/,
  "a trusted status change restarts the continuous feed at its first group");
assert.doesNotMatch(dialogSource,
  /data-rsl-game-events-date-(?:filter|filters|page)|gameEventsCalendarOffset/);
assert.match(featureRuntimeSource,
  /normalizeQuickPlayPlaceId\(selectedUniverseId\)[\s\S]*?\{ universeId: normalizeQuickPlayPlaceId\(selectedUniverseId\) \}/,
  "the exact selected Universe ID is sent to the trusted background resolver");
assert.match(dialogSource, /data-rsl-game-events-add-input/);
assert.match(dialogSource, /data-rsl-game-events-remove/);
assert.equal((featureRuntimeSource.match(/link\.textContent = "View Event"/g) || []).length, 1);
assert.match(featureRuntimeSource, /link\.setAttribute\("aria-label", `View Event: \$\{event\.title\}`\)/);
assert.match(dialogSource,
  /<button type="button" class="rsl-button rsl-button--secondary rsl-game-events__manage-button" aria-expanded="false" aria-controls="rsl-game-events-manage-panel" data-rsl-game-events-manage-toggle>Manage Tracked Games<\/button>/,
  "the footer uses a proper disclosed secondary action without an ambiguous Manage Games label");
assert.match(dialogSource,
  /id="rsl-game-events-manage-panel"[^>]*aria-labelledby="rsl-game-events-manage-heading"[^>]*tabindex="-1"[^>]*data-rsl-game-events-manage-panel/,
  "the controlled management panel is a named programmatic focus destination");
assert.match(managePanelToggleRuntimeSource,
  /event\.isTrusted !== true[\s\S]*?gameEventsManagePanelOpen = !gameEventsManagePanelOpen[\s\S]*?renderGameEventsFavorites\(dialog\)[\s\S]*?data-rsl-game-events-manage-panel[\s\S]*?focus\?\.\(\{ preventScroll: true \}\)/,
  "opening Manage Tracked Games updates only its controls and moves focus into the revealed panel");
assert.doesNotMatch(managePanelToggleRuntimeSource,
  /renderGameEventsDialog|replaceChildren|data-rsl-game-events-list|scrollTop\s*=/,
  "opening or closing Manage cannot rebuild the event feed or reset its scroll position");
assert.match(addPanelToggleRuntimeSource,
  /event\.isTrusted !== true[\s\S]*?gameEventsAddPanelOpen = !gameEventsAddPanelOpen[\s\S]*?renderGameEventsFavorites\(dialog\)/,
  "the adjacent Add Game disclosure also leaves the already rendered feed in place");
assert.doesNotMatch(addPanelToggleRuntimeSource, /renderGameEventsDialog|replaceChildren|scrollTop\s*=/);
assert.match(liveToggleRuntimeSource,
  /event\.target\.closest\?\.\("\[data-rsl-game-events-live-toggle\]"\)[\s\S]*?event\.isTrusted !== true[\s\S]*?gameEventsLiveSectionCollapsed = !gameEventsLiveSectionCollapsed[\s\S]*?syncGameEventsLiveSectionCollapse\(dialog\)/,
  "a trusted Hide/Show click changes only the existing live-card section");
assert.doesNotMatch(liveToggleRuntimeSource,
  /renderGameEventsDialog|replaceChildren|data-rsl-game-events-timeline|scrollTop\s*=|\.focus\(/,
  "Hide/Show preserves the upcoming timeline DOM, list scroll, and focused disclosure button");
assert.match(featureRuntimeSource,
  /function resetGameEventsDialogState\(\)[\s\S]*?gameEventsLiveSectionCollapsed = false/,
  "Live Now collapse lasts for the current dialog session but resets on close");
assert.ok(
  dialogSource.indexOf("data-rsl-game-events-refresh") <
    dialogSource.indexOf('<footer class="rsl-dialog__actions rsl-game-events__footer">'),
  "Refresh stays in the compact feed heading"
);
assert.doesNotMatch(dialogSource, /rsl-game-events__manage-link/,
  "the old unfinished-looking text link is removed");
assert.doesNotMatch(dialogSource, /data-rsl-game-events-close>Close<\/button>/,
  "the compact feed uses the close affordance instead of a second footer close button");
assert.doesNotMatch(dialogSource, /RSVP|Notify Me|Join Event|Past Events/i);
assert.doesNotMatch(dialogSource, /innerHTML\s*=\s*event\.|insertAdjacentHTML\([^)]*event\./);

assert.match(stylesSource, /\.rsl-game-events__surface/);
assert.match(stylesSource, /\.rsl-game-events__feed/);
assert.match(stylesSource, /\.rsl-game-events__live-section/);
assert.match(stylesSource, /\.rsl-game-events__live-list/);
assert.match(stylesSource, /\.rsl-game-events__live-item/);
assert.match(stylesSource, /\.rsl-game-events__timeline-section/);
assert.match(stylesSource, /\.rsl-game-events__date-heading/);
assert.match(stylesSource, /\.rsl-game-events__item/);
assert.match(stylesSource, /\.rsl-game-events__time-rail/);
assert.match(stylesSource, /\.rsl-game-events__time-marker/);
assert.match(stylesSource, /\.rsl-game-events__now-marker/);
assert.match(stylesSource, /\.rsl-game-events__actions/);
assert.match(stylesSource, /\.rsl-game-events__join/);
assert.match(stylesSource, /\.rsl-game-events__search-results/);
assert.match(stylesSource, /\.rsl-game-events__search-option/);
assert.match(stylesSource, /\.rsl-game-events__search-thumbnail/);
assert.doesNotMatch(stylesSource,
  /\.rsl-game-events__(?:calendar|date-filters|date-card|date-label|date-number|date-page)\b/,
  "no calendar-selector CSS remains at any viewport or accessibility mode");

const agendaSurfaceStyles = cssBlock(
  gameEventsBaseStyles,
  ".rsl-game-events__surface.foundation-web-dialog-content[data-size=\"Large\"]"
);
const agendaDialogStyles = cssBlock(gameEventsBaseStyles, ".rsl-game-events-dialog {");
const agendaBodyStyles = cssBlock(gameEventsBaseStyles, ".rsl-game-events__body");
const agendaListStyles = cssBlock(gameEventsBaseStyles, ".rsl-game-events__list {");
const agendaFeedStyles = cssBlock(gameEventsBaseStyles, ".rsl-game-events__feed {");
const liveSectionStyles = cssBlock(gameEventsBaseStyles, ".rsl-game-events__live-section {");
const liveListStyles = cssBlock(gameEventsBaseStyles, ".rsl-game-events__live-list {");
const liveItemStyles = cssBlock(gameEventsBaseStyles, ".rsl-game-events__live-item {");
const liveEventRowStyles = cssBlock(
  gameEventsBaseStyles,
  ".rsl-game-events__event-row--live-panel"
);
const timelineSectionStyles = lastCssBlock(
  gameEventsBaseStyles,
  ".rsl-game-events__timeline-section"
);
const agendaTimelineStyles = cssBlock(gameEventsBaseStyles, ".rsl-game-events__timeline {");
const agendaTrackStyles = cssBlock(gameEventsBaseStyles, ".rsl-game-events__timeline::before");
const dateHeadingStyles = cssBlock(gameEventsBaseStyles, ".rsl-game-events__date-heading {");
const dateHeadingConnectorStyles = cssBlock(
  gameEventsBaseStyles,
  ".rsl-game-events__date-heading::before"
);
const dateHeadingLabelStyles = cssBlock(
  gameEventsBaseStyles,
  ".rsl-game-events__date-heading-label"
);
const agendaItemStyles = cssBlock(gameEventsBaseStyles, ".rsl-game-events__item");
const agendaEventRowStyles = cssBlock(gameEventsBaseStyles, ".rsl-game-events__event-row");
const agendaMainStyles = cssBlock(gameEventsBaseStyles, ".rsl-game-events__main");
const agendaTitleRowStyles = cssBlock(gameEventsBaseStyles, ".rsl-game-events__title-row");
const agendaActionsStyles = cssBlock(gameEventsBaseStyles, ".rsl-game-events__actions");
const agendaJoinStyles = cssBlock(gameEventsBaseStyles, ".rsl-game-events__join");
const agendaViewStyles = cssBlock(gameEventsBaseStyles, ".rsl-game-events__view");
const agendaFooterStyles = cssBlock(gameEventsBaseStyles, ".rsl-game-events__footer");
const agendaManageButtonStyles = cssBlock(gameEventsBaseStyles, ".rsl-game-events__manage-button");
const timeLabelStyles = cssBlock(gameEventsBaseStyles, ".rsl-game-events__time-marker");
const timeDotStyles = cssBlock(gameEventsBaseStyles, ".rsl-game-events__time-dot");
const nowMarkerStyles = cssBlock(gameEventsBaseStyles, ".rsl-game-events__now-marker");
const positionedNowMarkerStyles = cssBlock(
  gameEventsBaseStyles,
  '.rsl-game-events__now-marker[data-rsl-game-events-now-positioned="true"]'
);
const nowDotStyles = cssBlock(gameEventsBaseStyles, ".rsl-game-events__now-dot");
const desktopWidth = agendaSurfaceStyles.match(/width:\s*min\((\d+)px,\s*(?:calc\()?100(?:d?vw|%)/);
const desktopHeight = agendaSurfaceStyles.match(/height:\s*min\((\d+)px,\s*calc\(100d?vh\s*-/);
const desktopMaxHeight = agendaSurfaceStyles.match(
  /max-height:\s*min\((\d+)px,\s*calc\(100d?vh\s*-\s*24px\)\)/
);
assert.equal(Number(desktopWidth?.[1]), 760,
  "the Events window matches the 760px RoTool Settings surface instead of the native 640px cap");
assert.match(agendaSurfaceStyles, /width:\s*min\(760px,\s*calc\(100vw\s*-\s*24px\)\)\s*!important/,
  "the Settings-sized surface keeps a safe 12px gutter when the viewport is narrower");
assert.match(agendaSurfaceStyles, /max-width:\s*none\s*!important/,
  "Roblox's native Foundation dialog width cannot cap the requested surface");
assert.match(agendaSurfaceStyles,
  /inline-size:\s*min\(760px,\s*calc\(100vw\s*-\s*24px\)\)\s*!important/,
  "logical sizing matches the physical width in every writing mode");
assert.match(agendaSurfaceStyles, /max-inline-size:\s*none\s*!important/,
  "Roblox's logical native dialog cap is also cleared");
assert.equal(Number(desktopHeight?.[1]), 880,
  "the combined events feed gets the requested larger 880px desktop height");
assert.equal(Number(desktopMaxHeight?.[1]), Number(desktopHeight[1]),
  "the larger window remains clamped to the viewport rather than overflowing it");
assert.match(agendaDialogStyles, /padding:\s*12px\s*!important/,
  "desktop dialog padding matches the viewport clamp");
assert.match(agendaFeedStyles, /gap:\s*22px/,
  "the live panel is visually separated from the timeline without a horizontal rule");
assert.match(liveSectionStyles, /gap:\s*8px/);
assert.match(liveListStyles,
  /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(520px,\s*100%\),\s*1fr\)\)/,
  "active events use responsive compact desktop cards above the axis");
assert.match(liveItemStyles, /min-width:\s*0/,
  "a live card can shrink without widening the one feed scroller");
assert.match(liveEventRowStyles,
  /grid-template-columns:\s*56px\s+minmax\(0,\s*1fr\)\s+minmax\(112px,\s*150px\)\s+110px/,
  "desktop live cards omit the timeline rail column");
assert.match(liveEventRowStyles, /background:\s*var\(--color-surface-200/,
  "active events read as a compact panel rather than axis points");
assert.match(liveEventRowStyles, /border:\s*0/);
assert.match(timelineSectionStyles, /gap:\s*4px/,
  "the Upcoming Timeline heading stays attached to its axis");
const railWidthMatch = agendaTimelineStyles.match(/--rsl-game-events-rail-width:\s*(\d+)px/);
const railXMatch = agendaTimelineStyles.match(/--rsl-game-events-rail-x:\s*(\d+)px/);
assert.ok(railWidthMatch && railXMatch, "the one ordered timeline owns explicit rail geometry");
const railWidth = Number(railWidthMatch[1]);
const railX = Number(railXMatch[1]);
const rowColumns = agendaEventRowStyles.match(
  /grid-template-columns:\s*var\(--rsl-game-events-rail-width\)\s+56px\s+minmax\(0,\s*1fr\)\s+minmax\((\d+)px,\s*(\d+)px\)\s+(\d+)px/s
);
assert.ok(rowColumns,
  "desktop rows use fixed rail/thumbnail/action columns plus flexible copy and concise timing");
assert.equal(railWidth, 96,
  "the desktop rail reserves readable clock labels without wasting event-copy width");
assert.equal(railX, 70,
  "all desktop points share the audited rail coordinate");
assert.ok(railX > 0 && railX < railWidth, "the rail point stays inside its own column");
assert.ok(Number(rowColumns[1]) >= 120 && Number(rowColumns[2]) <= 200,
  "the timing column is bounded so it cannot consume the event title");
assert.match(agendaItemStyles, /min-width:\s*0/);
assert.match(agendaEventRowStyles, /min-height:\s*98px/,
  "agenda rows reserve a stable height for the two-button action stack");
assert.doesNotMatch(agendaEventRowStyles, /max-content/,
  "long button or title text cannot resize one row differently from the others");
assert.match(agendaEventRowStyles, /border:\s*0/,
  "event rows have no decorative horizontal separators");
assert.doesNotMatch(agendaEventRowStyles, /border-(?:top|bottom)\s*:/,
  "the timeline line and time spacing provide structure without horizontal rules");
assert.match(agendaItemStyles,
  /margin-block-start:\s*min\(var\(--rsl-game-events-gap-before,\s*0px\),\s*144px\)/,
  "desktop event spacing consumes the bounded time-gap variable");
assert.match(eventItemRuntimeSource,
  /--rsl-game-events-gap-before[\s\S]*?Math\.max\(0, Math\.min\(144, Number\(gapBefore\) \|\| 0\)\)/,
  "invalid values cannot inject or expand a row gap");
assert.match(agendaBodyStyles, /overflow:\s*hidden/);
assert.match(agendaListStyles, /flex:\s*1\s+1\s+(?:0|auto)/,
  "the event feed owns the remaining dialog height");
assert.match(agendaListStyles, /min-height:\s*0/);
assert.match(agendaListStyles, /overflow-x:\s*hidden/,
  "the agenda clips layout overflow instead of adding a horizontal scrollbar");
assert.match(agendaListStyles, /overflow-y:\s*auto/,
  "the combined live panel and ordered timeline have exactly one vertical scrolling viewport");
assert.match(agendaListStyles, /overscroll-behavior:\s*contain/);
assert.match(agendaListStyles, /scrollbar-gutter:\s*stable/,
  "the viewport reserves its scrollbar without shifting the time axis");
assert.match(agendaTimelineStyles,
  /padding:\s*12px\s+0\s+var\(--rsl-game-events-tail-space,\s*36px\)/,
  "the axis exposes a bounded tail for NOW after its final start");
assert.doesNotMatch(gameEventsBaseStyles,
  /\.rsl-game-events__date-(?:group|list)\s*\{[^}]*overflow-y:\s*(?:auto|scroll)/s,
  "nested date groups never become separate scroll frames");
for (const [name, block] of [
  ["feed", agendaFeedStyles],
  ["live section", liveSectionStyles],
  ["live list", liveListStyles],
  ["timeline section", timelineSectionStyles],
  ["timeline", agendaTimelineStyles]
]) {
  assert.doesNotMatch(block, /overflow-y:\s*(?:auto|scroll)/,
    `the ${name} cannot become a second vertical scroller`);
}
assert.match(agendaMainStyles, /min-width:\s*0/);
assert.match(agendaMainStyles, /overflow:\s*hidden/);
assert.match(agendaTitleRowStyles, /min-width:\s*0/);
assert.match(agendaTitleRowStyles, /overflow:\s*hidden/);
assert.match(gameEventsBaseStyles,
  /\.rsl-game-events__title,\s*\n\.rsl-game-events__context,\s*\n\.rsl-game-events__timing\s*\{[^}]*overflow:\s*hidden[^}]*text-overflow:\s*ellipsis[^}]*white-space:\s*nowrap/s,
  "event title, game name, and separate timing column independently truncate to one line");
assert.match(cssBlock(gameEventsBaseStyles, ".rsl-game-events__title {"),
  /flex:\s*1\s+1\s+auto/,
  "emoji-heavy event titles shrink and ellipsize inside their own copy column");
const timingStyles = lastCssBlock(gameEventsBaseStyles, ".rsl-game-events__timing {");
assert.match(timingStyles, /text-align:\s*end/,
  "desktop timing aligns consistently in its dedicated column");
const actionWidth = Number(rowColumns[3]);
assert.equal(actionWidth, 110,
  "the final desktop grid column reserves the audited two-button action width");
assert.match(agendaActionsStyles, /display:\s*grid/);
assert.match(agendaActionsStyles, /width:\s*110px/);
assert.match(agendaActionsStyles, /gap:\s*6px/);
assert.doesNotMatch(agendaActionsStyles, /grid-template-columns:\s*repeat\(2/,
  "Join Game and View Event use the grid's one-column desktop flow");
assert.match(agendaJoinStyles, /min-height:\s*36px/);
assert.match(agendaViewStyles, /min-height:\s*36px/);
assert.match(agendaJoinStyles, /width:\s*100%/);
assert.match(agendaViewStyles, /width:\s*100%/,
  "both event actions align to the same desktop width");
assert.match(agendaFooterStyles, /justify-content:\s*flex-start/,
  "the management action sits in a conventional left-aligned footer position");
assert.doesNotMatch(agendaManageButtonStyles, /margin-inline-start:\s*auto/,
  "Manage Tracked Games is no longer stranded at the far-right edge");

function requiredPx(block, property, description) {
  const match = block.match(new RegExp(`(?:^|\\n)\\s*${property}:\\s*(-?\\d+(?:\\.\\d+)?)px`, "m"));
  assert.ok(match, description);
  return Number(match[1]);
}

const timeLabelWidth = requiredPx(timeLabelStyles, "width", "time labels need a bounded width");
assert.equal(timeLabelWidth, 60,
  "desktop time labels fit complete localized clock text instead of ending in an ellipsis");
assert.match(timeLabelStyles, /font-variant-numeric:\s*tabular-nums/,
  "clock labels keep equal-width digits as the timeline updates");
const timeLabelLeftMatch = timeLabelStyles.match(
  /(?:^|\n)\s*left:\s*(-?\d+(?:\.\d+)?)(?:px)?\s*;/m
);
const timeLabelRightInsetMatch = timeLabelStyles.match(
  /(?:^|\n)\s*right:\s*(-?\d+(?:\.\d+)?)(?:px)?\s*;/m
);
assert.ok(timeLabelLeftMatch || timeLabelRightInsetMatch, "time labels need a deterministic rail position");
const timeLabelRightEdge = timeLabelLeftMatch
  ? Number(timeLabelLeftMatch[1]) + timeLabelWidth
  : railWidth - Number(timeLabelRightInsetMatch[1]);
const timeDotWidth = requiredPx(timeDotStyles, "width", "event dots need a fixed diameter");
assert.match(timeDotStyles,
  new RegExp(`left:\\s*calc\\(var\\(--rsl-game-events-rail-x\\)\\s*-\\s*${timeDotWidth / 2}px\\)`),
  "event dots are centered on the shared rail x-position");
assert.ok(railX >= timeLabelRightEdge + 4,
  "the rail dot sits beyond the time label instead of overlapping it");
assert.equal(
  (gameEventsBaseStyles.match(/\.rsl-game-events__timeline::before/g) || []).length,
  1,
  "one global pseudo-element draws the time axis"
);
assert.match(agendaTrackStyles, /top:\s*12px/);
assert.match(agendaTrackStyles, /bottom:\s*12px/);
const trackWidth = requiredPx(agendaTrackStyles, "width", "the global track needs a fixed width");
assert.equal(trackWidth, 2);
assert.match(agendaTrackStyles,
  new RegExp(`left:\\s*calc\\(var\\(--rsl-game-events-rail-x\\)\\s*-\\s*${trackWidth / 2}px\\)`),
  "the uninterrupted line is centered on the shared rail x-coordinate");
assert.match(dateHeadingStyles, /position:\s*relative/);
assert.match(dateHeadingStyles, /z-index:\s*2/);
assert.match(dateHeadingStyles, /display:\s*flex/);
assert.match(dateHeadingStyles, /width:\s*100%/,
  "the date heading spans the full timeline instead of sitting beside the rail");
assert.match(dateHeadingStyles, /min-width:\s*0/);
assert.match(dateHeadingStyles, /max-width:\s*none/);
assert.match(dateHeadingStyles, /margin:\s*0\s+0\s+10px/,
  "the larger heading keeps a clear but compact gap above its first event");
assert.match(dateHeadingStyles, /padding:\s*0/);
assert.match(dateHeadingStyles, /overflow:\s*visible/,
  "the heading does not clip a wrapped localized date");
assert.match(dateHeadingStyles, /justify-content:\s*center/);
assert.match(dateHeadingStyles, /text-align:\s*center/,
  "the heading and its text are centered across the complete timeline width");
assert.match(dateHeadingStyles,
  /color:\s*var\(--color-content-emphasis,\s*var\(--rsl-fallback-content\)\)/,
  "the larger date uses heading emphasis rather than a small muted tag");
assert.match(dateHeadingConnectorStyles, /content:\s*none/);
assert.doesNotMatch(dateHeadingConnectorStyles,
  /(?:width|height|background|border(?:-top|-bottom)?|transform)\s*:/,
  "the centered heading cannot draw a connector or horizontal divider across the timeline");
assert.doesNotMatch(gameEventsBaseStyles, /\.rsl-game-events__date-heading--live::before/,
  "no obsolete date connector survives through a live-heading override");
assert.match(dateHeadingLabelStyles, /display:\s*block/);
assert.match(dateHeadingLabelStyles, /box-sizing:\s*border-box/);
assert.match(dateHeadingLabelStyles, /min-width:\s*0/);
assert.match(dateHeadingLabelStyles,
  /max-width:\s*min\(\s*32ch,\s*calc\(\s*100%\s*-\s*var\(--rsl-game-events-rail-x\)\s*-\s*var\(--rsl-game-events-rail-x\)\s*-\s*24px\s*\)\s*\)/,
  "the centered label uses equal rail-safe space on both sides at desktop and mobile widths");
assert.match(dateHeadingLabelStyles, /padding:\s*0/);
assert.match(dateHeadingLabelStyles, /overflow:\s*visible/);
assert.match(dateHeadingLabelStyles, /color:\s*inherit/);
assert.match(dateHeadingLabelStyles, /background:\s*transparent/);
assert.match(dateHeadingLabelStyles, /border:\s*0/);
assert.match(dateHeadingLabelStyles, /border-radius:\s*0/,
  "the date reads as a heading, not as a detached pill or badge");
assert.match(dateHeadingLabelStyles, /font-size:\s*15px/);
assert.match(dateHeadingLabelStyles, /font-weight:\s*750/);
assert.match(dateHeadingLabelStyles, /line-height:\s*20px/,
  "the date heading is visibly larger than the former 11px tag");
assert.match(dateHeadingLabelStyles, /overflow-wrap:\s*anywhere/);
assert.match(dateHeadingLabelStyles, /text-align:\s*center/);
assert.match(dateHeadingLabelStyles, /white-space:\s*normal/,
  "long localized dates wrap responsively instead of being ellipsized or overflowing");
assert.doesNotMatch(dateHeadingLabelStyles, /text-overflow:\s*ellipsis/);
assert.doesNotMatch(stylesSource, /\.rsl-game-events__time-rail::after/,
  "per-row line fragments cannot reintroduce breaks at date headings or time gaps");
assert.match(timeDotStyles,
  /background:\s*var\(--color-surface-100/,
  "scheduled event points remain hollow instead of competing with the solid NOW point");
assert.match(nowMarkerStyles, /(?:width|inline-size):\s*0(?:px)?\s*;/,
  "the moving NOW marker is a point on the rail, not a row-wide overlay");
assert.doesNotMatch(nowMarkerStyles, /transition\s*:/,
  "a newly rendered marker has no top transition that could replay from the timeline origin");
assert.match(positionedNowMarkerStyles, /transition:\s*top\s+180ms\s+linear/,
  "only a marker placed for at least one frame glides during later minute updates");
assert.doesNotMatch(nowMarkerStyles, /(?:^|\n)\s*right\s*:/m);
assert.doesNotMatch(nowMarkerStyles, /(?:^|\n)\s*border(?:-top)?\s*:/m,
  "the moving point must not draw a horizontal rule across event content");
assert.match(nowMarkerStyles, /left:\s*var\(--rsl-game-events-rail-x\)/,
  "the moving NOW point follows the same vertical rail as event dots");
const nowDotWidth = requiredPx(nowDotStyles, "width", "the NOW point needs a fixed diameter");
assert.match(nowDotStyles, new RegExp(`left:\\s*-${nowDotWidth / 2}px`),
  "the solid NOW point is centered on that same rail coordinate");
const nowLabelStyles = cssBlock(gameEventsBaseStyles, ".rsl-game-events__now-label");
assert.match(nowLabelStyles, /left:\s*9px/);
assert.match(nowLabelStyles, /right:\s*auto/,
  "the desktop NOW label sits beside the dot rather than colliding with time labels");
assert.ok(railX > 0 && railX < railWidth,
  "the moving point is confined to the rail column");
assert.doesNotMatch(gameEventsBaseStyles, /\.rsl-game-events__now-marker::(?:before|after)/,
  "the rail point cannot recreate a full-width line through a pseudo-element");
assert.doesNotMatch(stylesSource, /\.rsl-game-events__next-countdown\b/,
  "there is no visible right-side countdown overlay at any viewport size");
assert.match(gameEventsBaseStyles,
  /@media\s*\(max-width:\s*900px\)[\s\S]*?\.rsl-game-events__live-list\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
  "the active panel becomes one compact column before the desktop cards get cramped");

const mobileSurfaceStyles = cssBlock(
  gameEventsMobileStyles,
  ".rsl-game-events__surface.foundation-web-dialog-content[data-size=\"Large\"]"
);
const mobileBodyStyles = cssBlock(
  gameEventsMobileStyles,
  ".rsl-game-events-dialog .rsl-game-events__body"
);
const mobileItemStyles = cssBlock(gameEventsMobileStyles, ".rsl-game-events__item");
const mobileTimelineStyles = cssBlock(gameEventsMobileStyles, ".rsl-game-events__timeline {");
const mobileEventRowStyles = cssBlock(gameEventsMobileStyles, ".rsl-game-events__event-row");
const mobileLiveEventRowStyles = cssBlock(
  gameEventsMobileStyles,
  ".rsl-game-events__event-row--live-panel"
);
const mobileRailStyles = cssBlock(gameEventsMobileStyles, ".rsl-game-events__time-rail");
const mobileTimeLabelStyles = cssBlock(gameEventsMobileStyles, ".rsl-game-events__time-marker");
const mobileTimingStyles = cssBlock(gameEventsMobileStyles, ".rsl-game-events__timing {");
const mobileLiveTimingStyles = cssBlock(
  gameEventsMobileStyles,
  ".rsl-game-events__event-row--live-panel .rsl-game-events__timing"
);
const mobileActionsStyles = cssBlock(gameEventsMobileStyles, ".rsl-game-events__actions");
const mobileLiveActionsStyles = cssBlock(
  gameEventsMobileStyles,
  ".rsl-game-events__event-row--live-panel .rsl-game-events__actions"
);
const mobileJoinStyles = cssBlock(gameEventsMobileStyles, ".rsl-game-events__join");
const mobileFooterStyles = cssBlock(
  gameEventsMobileStyles,
  ".rsl-game-events-dialog .rsl-game-events__footer"
);
const mobileManageButtonStyles = cssBlock(
  gameEventsMobileStyles,
  ".rsl-game-events__manage-button"
);
const mobileNowLabelStyles = cssBlock(gameEventsMobileStyles, ".rsl-game-events__now-label");
assert.match(mobileSurfaceStyles, /width:\s*100%\s*!important/);
assert.match(mobileSurfaceStyles, /inline-size:\s*100%\s*!important/,
  "the native logical-width override remains explicit on mobile");
assert.match(mobileSurfaceStyles, /height:\s*calc\(100d?vh\s*-\s*12px\)\s*!important/,
  "the larger desktop window still clamps to the mobile viewport");
assert.match(mobileSurfaceStyles, /max-height:\s*calc\(100d?vh\s*-\s*12px\)\s*!important/);
assert.match(mobileBodyStyles, /padding:\s*18px\s+14px\s+14px/,
  "Game Events retains its compact mobile body inset");
assert.match(mobileItemStyles,
  /margin-block-start:\s*min\(var\(--rsl-game-events-gap-before,\s*0px\),\s*72px\)/,
  "time-proportional whitespace is compressed further on small screens");
const mobileColumns = mobileEventRowStyles.match(
  /grid-template-columns:\s*var\(--rsl-game-events-rail-width\)\s+48px\s+minmax\(0,\s*1fr\)/
);
assert.ok(mobileColumns,
  "mobile rows retain separate rail, thumbnail, and truncating copy columns");
assert.match(mobileEventRowStyles, /grid-template-rows:\s*auto\s+auto\s+auto/,
  "mobile timing and action get their own rows");
assert.match(mobileLiveEventRowStyles,
  /grid-template-columns:\s*48px\s+minmax\(0,\s*1fr\)/,
  "mobile live cards keep only thumbnail and content columns, with no empty rail space");
assert.match(mobileLiveEventRowStyles, /grid-template-rows:\s*auto\s+auto\s+auto/,
  "live timing and action stack safely inside the compact card");
assert.match(mobileLiveEventRowStyles, /padding:\s*10px/);
assert.match(mobileRailStyles, /grid-row:\s*1\s*\/\s*4/,
  "the rail spans the compact mobile row without entering content columns");
assert.match(mobileTimingStyles, /grid-column:\s*3/);
assert.match(mobileTimingStyles, /grid-row:\s*2/);
assert.match(mobileLiveTimingStyles, /grid-column:\s*2/,
  "live timing stays in the card content column rather than inheriting the absent rail column");
assert.match(mobileActionsStyles, /grid-column:\s*3/);
assert.match(mobileActionsStyles, /grid-row:\s*3/,
  "the mobile action group follows timing instead of overlapping event copy");
assert.match(mobileActionsStyles,
  /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  "Join Game and View Event share one balanced mobile row");
assert.match(mobileActionsStyles, /width:\s*min\(230px,\s*100%\)/,
  "the two mobile actions stay useful without widening the feed");
assert.match(mobileLiveActionsStyles, /grid-column:\s*2/,
  "the live-card action group stays aligned below its copy");
assert.match(mobileJoinStyles, /min-height:\s*44px/);
assert.match(gameEventsMobileStyles,
  /\.rsl-game-events__join,\s*\n\s*\.rsl-game-events__view,[\s\S]*?\{[^}]*min-height:\s*44px/,
  "both mobile actions meet the same touch-target height");
assert.doesNotMatch(mobileActionsStyles, /position:\s*absolute/);
assert.match(mobileFooterStyles, /display:\s*flex/);
assert.match(mobileFooterStyles, /padding:\s*10px\s+14px\s+14px/,
  "the mobile management footer aligns with the compact Events body inset");
assert.match(mobileManageButtonStyles, /width:\s*100%/);
assert.match(mobileManageButtonStyles, /min-height:\s*44px/,
  "Manage Tracked Games becomes a full-width touch target on mobile");

const gameEventsMobileBodyRuleIndex = stylesSource.indexOf(
  ".rsl-game-events-dialog .rsl-game-events__body",
  gameEventsMobileStart
);
const gameEventsMobileFooterRuleIndex = stylesSource.indexOf(
  ".rsl-game-events-dialog .rsl-game-events__footer",
  gameEventsMobileStart
);
const laterSharedDialogMobileStart = stylesSource.indexOf(
  "@media (max-width: 520px)",
  gameEventsReducedMotionStart
);
const laterSharedBodyRuleIndex = stylesSource.indexOf(
  ".rsl-dialog__body {",
  laterSharedDialogMobileStart
);
const laterSharedActionsRuleIndex = stylesSource.indexOf(
  ".rsl-dialog__actions {",
  laterSharedDialogMobileStart
);
assert.ok(
  gameEventsMobileBodyRuleIndex >= gameEventsMobileStart &&
    gameEventsMobileBodyRuleIndex < gameEventsReducedMotionStart &&
    laterSharedBodyRuleIndex > gameEventsMobileBodyRuleIndex,
  "the known shared <=520 body rule remains later in source, exercising the real cascade"
);
assert.ok(
  gameEventsMobileFooterRuleIndex >= gameEventsMobileStart &&
    gameEventsMobileFooterRuleIndex < gameEventsReducedMotionStart &&
    laterSharedActionsRuleIndex > gameEventsMobileFooterRuleIndex,
  "the known shared <=520 actions rule remains later in source, exercising the real cascade"
);
assert.ok(
  laterSharedDialogMobileStart > gameEventsReducedMotionStart &&
    laterSharedBodyRuleIndex > laterSharedDialogMobileStart &&
    laterSharedActionsRuleIndex > laterSharedDialogMobileStart,
  "both later shared overrides belong to the same <=520 dialog breakpoint"
);
assert.match(gameEventsMobileStyles,
  /\.rsl-game-events-dialog\s+\.rsl-game-events__body\s*\{[^}]*padding:\s*18px\s+14px\s+14px[^}]*\}/s,
  "the two-class Events body selector outranks the later one-class shared body selector");
assert.match(gameEventsMobileStyles,
  /\.rsl-game-events-dialog\s+\.rsl-game-events__footer\s*\{[^}]*padding:\s*10px\s+14px\s+14px[^}]*\}/s,
  "the two-class Events footer selector outranks the later one-class shared actions selector");
const mobileRailWidth = requiredPx(
  mobileTimelineStyles,
  "--rsl-game-events-rail-width",
  "mobile needs a bounded rail width"
);
const mobileRailX = requiredPx(
  mobileTimelineStyles,
  "--rsl-game-events-rail-x",
  "mobile needs a bounded rail point"
);
assert.ok(mobileRailX > 0 && mobileRailX < mobileRailWidth,
  "the mobile NOW point cannot overlap the thumbnail or event copy");
assert.equal(mobileRailWidth, 72,
  "the compact rail still reserves enough room for its complete clock label");
assert.equal(mobileRailX, 64,
  "the mobile dots remain centered on the audited rail position");
assert.equal(requiredPx(mobileTimeLabelStyles, "width", "mobile time labels need a fixed width"), 54,
  "mobile start labels keep the complete clock text visible");
assert.match(mobileNowLabelStyles, /display:\s*none/,
  "the optional NOW word is hidden on mobile while its solid point remains visible");
const narrowActionsStyles = cssBlock(gameEventsNarrowStyles, ".rsl-game-events__actions");
const narrowLiveActionsStyles = cssBlock(
  gameEventsNarrowStyles,
  ".rsl-game-events__event-row--live-panel .rsl-game-events__actions"
);
assert.match(narrowActionsStyles, /width:\s*100%/);
assert.match(narrowActionsStyles, /grid-column:\s*2\s*\/\s*-1/,
  "the narrowest action group uses the available content width without horizontal overflow");
assert.match(narrowLiveActionsStyles, /grid-column:\s*1\s*\/\s*-1/,
  "narrow live actions span the entire two-column card without overflow");
assert.match(
  stylesSource,
  /\.rsl-game-events-dialog\s+:is\(button, a, input, \[data-rsl-game-events-list\], \[data-rsl-game-events-manage-panel\]\):focus-visible/,
  "the feed, management panel, every Events chip, and every action have a visible keyboard focus ring"
);
assert.match(stylesSource, /@media\s*\(max-width:\s*\d+px\)[\s\S]*?rsl-game-events/);
assert.match(stylesSource, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?rsl-game-events/);
assert.match(stylesSource,
  /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.rsl-game-events-dialog \*[\s\S]*?transition-duration:\s*0s\s*!important[\s\S]*?animation-duration:\s*0s\s*!important/,
  "the entire feed, including the moving Now point, respects reduced motion");
assert.match(stylesSource,
  /@media\s*\(forced-colors:\s*active\)[\s\S]*?rsl-game-events/,
  "status selection, timeline markers, and feed focus remain visible in forced colors");
assert.match(stylesSource,
  /@media\s*\(forced-colors:\s*active\)[\s\S]*?\.rsl-game-events__time-dot\s*\{[^}]*background:\s*Canvas[^}]*border-color:\s*CanvasText[\s\S]*?\.rsl-game-events__now-dot\s*\{[^}]*background:\s*Highlight/s,
  "forced colors preserve hollow scheduled points and a solid current-time point");
assert.match(stylesSource,
  /@media\s*\(forced-colors:\s*active\)[\s\S]*?\.rsl-game-events__timeline::before\s*\{[^}]*background:\s*CanvasText/s,
  "the one continuous line remains visible in high-contrast mode");
assert.match(stylesSource,
  /@media\s*\(forced-colors:\s*active\)[\s\S]*?\.rsl-game-events__date-heading-label\s*\{[^}]*forced-color-adjust:\s*none[^}]*color:\s*CanvasText[^}]*background:\s*transparent[^}]*border:\s*0/s,
  "the plain centered heading remains readable without becoming a badge in high-contrast mode");
assert.doesNotMatch(stylesSource,
  /@media\s*\(forced-colors:\s*active\)[\s\S]*?\.rsl-game-events__date-heading::before\s*\{/s,
  "forced colors cannot revive the removed horizontal connector");
assert.doesNotMatch(gameEventsMobileStyles,
  /rsl-game-events__(?:date-card|date-page)/,
  "mobile adds no hidden calendar controls back into the layout");

assert.match(readme, /Game Events/);
assert.match(readme, /official[^.\n]{0,80}events/i);
assert.match(readme, /live and upcoming/i);
assert.match(readme, /stored locally/i);
assert.match(readme, /up to 30|latest 30|30 tracked/i);
assert.match(readme, /does not|doesn't|no background/i);
assert.match(readme, /one extra-wide scrolling feed/i,
  "the user documentation describes the single larger viewport");
assert.match(readme,
  /currently active events[\s\S]*compact[^.]*Live Now[^.]*top[\s\S]*uninterrupted upcoming-event timeline underneath/i,
  "the documentation explains the active panel followed by the upcoming axis");
assert.match(readme, /Live[^.]*Upcoming[^.]*either part alone/i,
  "the status-filter behavior is documented");
assert.match(readme, /Upcoming events are labeled[^.]*Today[^.]*Tomorrow/i,
  "the documentation explains automatic upcoming date headings");
assert.match(readme, /Farther-away starts receive more vertical space[\s\S]*?cap/i,
  "the documentation explains compressed time-proportional spacing");
assert.match(readme, /Now[^.]*represents the current time[^.]*moves toward the next event[^.]*upcoming axis/i,
  "the documentation explains the moving time point belongs only to upcoming events");
assert.match(readme, /Live cards do not use their old start dates as timeline gaps/i,
  "the documentation explains why live events are detached from the axis");
assert.match(readme, /event rows use spacing instead of horizontal divider lines/i,
  "the removed horizontal rules are intentional and documented");
assert.doesNotMatch(readme,
  /five rolling|date cards?|choose (?:a )?date|selected (?:local )?(?:date|day)|strict (?:date|day)|day intersection/i,
  "the documentation must not describe a removed date picker");
assert.doesNotMatch(readme, /raw title and subtitle/i,
  "the documentation must not promise promotional subtitle clutter that the row hides");
assert.doesNotMatch(readme, /all Roblox events|complete event history|past events/i);

console.log("PASS Game Events live panel, upcoming timeline, game search, accessibility, and privacy");
