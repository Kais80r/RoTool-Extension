"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const uiSource = fs.readFileSync(path.join(projectRoot, "join-scheduler.js"), "utf8");
const templateSource = fs.readFileSync(
  path.join(projectRoot, "join-scheduler.html"),
  "utf8"
);
const styleSource = fs.readFileSync(
  path.join(projectRoot, "join-scheduler.css"),
  "utf8"
);
const backgroundSource = fs.readFileSync(
  path.join(projectRoot, "background.js"),
  "utf8"
);

assert.match(templateSource, /Reminder or join time/);
for (const minutes of [0, 5, 10, 15, 30]) {
  assert.match(
    templateSource,
    new RegExp(`data-event-offset-minutes="${minutes}"`)
  );
}
assert.match(templateSource, /data-event-time-presets/);
assert.match(templateSource, /id="event-time-presets-label"/);
assert.match(templateSource, /aria-labelledby="event-time-presets-label"/);
for (const minutes of [5, 10, 15, 30]) {
  assert.match(templateSource, new RegExp(`>${minutes} min before<`));
}
assert.match(styleSource, /\.event-time-presets__buttons/);
assert.match(styleSource, /button\[aria-pressed="true"\]/);

const applyOfficialDraft = uiSource.slice(
  uiSource.indexOf("function applyOfficialDraft"),
  uiSource.indexOf("function openEditorForDraft")
);
assert.match(
  applyOfficialDraft,
  /eventStartAt = Number\(draft\.eventStartAt \?\? draft\.startAt\)/
);
assert.match(
  applyOfficialDraft,
  /elements\.scheduleTime\.max = toDatetimeLocal\(officialDraft\.eventStartAt\)/
);
assert.doesNotMatch(applyOfficialDraft, /readOnly\s*=\s*true|aria-readonly/);

const validation = uiSource.slice(
  uiSource.indexOf("function validateFormSynchronously"),
  uiSource.indexOf("async function saveNewPrivateDestination")
);
assert.match(validation, /const startAt = selectedScheduleTime\(\)/);
assert.match(validation, /startAt > officialDraft\.eventStartAt/);
assert.match(validation, /at or before the official event start/);

const submit = uiSource.slice(
  uiSource.indexOf("async function submitSchedule"),
  uiSource.indexOf("async function validatePrivate")
);
assert.match(submit, /startAt: submitSnapshot\.startAt/);
assert.match(
  submit,
  /eventStartAt: submitSnapshot\.officialDraft\?\.eventStartAt \|\| null/
);
assert.doesNotMatch(
  submit,
  /startAt: submitSnapshot\.officialDraft\?\.startAt/
);

const edit = uiSource.slice(
  uiSource.indexOf("function openEditorForSchedule"),
  uiSource.indexOf("function closeEditor")
);
assert.match(edit, /eventStartAt: schedule\.eventStartAt \|\| schedule\.startAt/);
assert.match(edit, /setScheduleTimeValue\(schedule\.startAt\)/);

const revalidation = backgroundSource.slice(
  backgroundSource.indexOf("async function revalidateJoinSchedulerEvent"),
  backgroundSource.indexOf("function normalizeJoinSchedulerScheduleInput")
);
assert.match(
  revalidation,
  /event\.startAt !== \(scheduleOrDraft\.eventStartAt \|\| scheduleOrDraft\.startAt\)/
);
assert.match(
  uiSource,
  /const countdownTimer = setInterval\([\s\S]*?refreshScheduleCountdowns\(\)[\s\S]*?activeView === "editor" && officialDraft[\s\S]*?updateEventTimePresets\(\)/
);

console.log("PASS Join Scheduler editable official-event timing contract");
