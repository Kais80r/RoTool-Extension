"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const template = fs.readFileSync(path.join(projectRoot, "join-scheduler.html"), "utf8");
const controllerSource = fs.readFileSync(path.join(projectRoot, "join-scheduler.js"), "utf8");
const shadowStyles = fs.readFileSync(path.join(projectRoot, "join-scheduler.css"), "utf8");
const contentSource = fs.readFileSync(path.join(projectRoot, "content.js"), "utf8");
const siteStyles = fs.readFileSync(path.join(projectRoot, "styles.css"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "manifest.json"), "utf8"));

function sourceBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.notEqual(start, -1, `missing ${startNeedle}`);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.notEqual(end, -1, `missing ${endNeedle}`);
  return source.slice(start, end);
}

function tagWith(attribute) {
  const match = template.match(new RegExp(`<[^>]+\\b${attribute}\\b[^>]*>`, "i"));
  assert.ok(match, `missing element with ${attribute}`);
  return match[0];
}

function cssDeclarations(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(
    `(?:^|[},])\\s*${escapedSelector}\\s*(?:,|\\{)`,
    "m"
  ).exec(source);
  assert.ok(match, `missing CSS rule ${selector}`);
  const openBrace = source.indexOf("{", match.index);
  let depth = 1;
  let cursor = openBrace + 1;
  while (cursor < source.length && depth > 0) {
    if (source[cursor] === "{") depth += 1;
    if (source[cursor] === "}") depth -= 1;
    cursor += 1;
  }
  assert.equal(depth, 0, `unclosed CSS rule ${selector}`);
  const declarations = {};
  for (const declaration of source.slice(openBrace + 1, cursor - 1).split(";")) {
    const colon = declaration.indexOf(":");
    if (colon < 0) continue;
    const property = declaration.slice(0, colon).trim();
    const value = declaration.slice(colon + 1).trim().replace(/\s+/g, " ");
    if (property) declarations[property] = value;
  }
  return declarations;
}

function cssMediaDeclarations(source, condition, selector) {
  const escapedCondition = condition.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const mediaPattern = new RegExp(`@media\\s*\\(${escapedCondition}\\)\\s*\\{`, "g");
  for (const match of source.matchAll(mediaPattern)) {
    const openBrace = source.indexOf("{", match.index);
    let depth = 1;
    let cursor = openBrace + 1;
    while (cursor < source.length && depth > 0) {
      if (source[cursor] === "{") depth += 1;
      if (source[cursor] === "}") depth -= 1;
      cursor += 1;
    }
    assert.equal(depth, 0, `unclosed @media (${condition})`);
    const block = source.slice(openBrace + 1, cursor - 1);
    try {
      return cssDeclarations(block, selector);
    } catch (error) {
      if (!String(error?.message || "").includes("missing CSS rule")) throw error;
    }
  }
  assert.fail(`missing ${selector} inside @media (${condition})`);
}

function assertSharedCssRule(schedulerSelector, settingsSelector = schedulerSelector) {
  assert.deepEqual(
    cssDeclarations(shadowStyles, schedulerSelector),
    cssDeclarations(siteStyles, settingsSelector),
    `${schedulerSelector} must be the exact RoTool Settings ${settingsSelector} rule`
  );
}

function assertSharedCssProperties(
  schedulerSelector,
  settingsSelector,
  properties
) {
  const scheduler = cssDeclarations(shadowStyles, schedulerSelector);
  const settings = cssDeclarations(siteStyles, settingsSelector);
  for (const property of properties) {
    assert.equal(
      scheduler[property]?.replace(/\s*!important\s*$/i, ""),
      settings[property]?.replace(/\s*!important\s*$/i, ""),
      `${schedulerSelector} ${property} must match ${settingsSelector}`
    );
  }
}

function assertSharedMediaCssRule(condition, schedulerSelector, settingsSelector = schedulerSelector) {
  assert.deepEqual(
    cssMediaDeclarations(shadowStyles, condition, schedulerSelector),
    cssMediaDeclarations(siteStyles, condition, settingsSelector),
    `${schedulerSelector} must match Settings inside @media (${condition})`
  );
}

function assertSharedMediaCssProperties(
  condition,
  schedulerSelector,
  settingsSelector,
  properties
) {
  const scheduler = cssMediaDeclarations(shadowStyles, condition, schedulerSelector);
  const settings = cssMediaDeclarations(siteStyles, condition, settingsSelector);
  for (const property of properties) {
    assert.equal(
      scheduler[property]?.replace(/\s*!important\s*$/i, ""),
      settings[property]?.replace(/\s*!important\s*$/i, ""),
      `${schedulerSelector} ${property} must match Settings inside @media (${condition})`
    );
  }
}

const errorMessageSource = sourceBetween(
  controllerSource,
  "function errorMessage",
  "function normalizeGame"
);
assert.match(
  errorMessageSource,
  /UNAUTHENTICATED:\s*"Sign in to Roblox, then close and reopen Join Scheduler\."/
);
assert.doesNotMatch(errorMessageSource, /refresh (?:this )?dialog/i,
  "error copy cannot direct users to the removed Refresh control");

function findEdgeExecutable() {
  if (process.env.ROTOOL_SKIP_REAL_EDGE === "1") return null;
  const configured = process.env.ROTOOL_EDGE_BIN;
  if (configured && fs.existsSync(configured)) return configured;
  if (process.platform !== "win32") return null;
  const applicationRoots = [
    process.env["ProgramFiles(x86)"],
    process.env.ProgramFiles,
    process.env.LOCALAPPDATA
  ].filter(Boolean).map((root) => path.join(root, "Microsoft", "Edge", "Application"));
  for (const applicationRoot of applicationRoots) {
    if (!fs.existsSync(applicationRoot)) continue;
    const versioned = fs.readdirSync(applicationRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^\d+(?:\.\d+){3}$/.test(entry.name))
      .sort((left, right) => right.name.localeCompare(
        left.name,
        undefined,
        { numeric: true }
      ))
      .map((entry) => path.join(applicationRoot, entry.name, "msedge.exe"))
      .find((candidate) => fs.existsSync(candidate));
    if (versioned) return versioned;
    const direct = path.join(applicationRoot, "msedge.exe");
    if (fs.existsSync(direct)) return direct;
  }
  return null;
}

function runRealChromiumTemplateParserRegression() {
  const edge = findEdgeExecutable();
  if (!edge) {
    console.log("SKIP Join Scheduler real Chromium DOMParser regression (Edge unavailable)");
    return;
  }
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rsl-domparser-regression-"));
  assert.equal(path.dirname(path.resolve(temporaryRoot)), path.resolve(os.tmpdir()));
  const fixturePath = path.join(temporaryRoot, "fixture.html");
  const profilePath = path.join(temporaryRoot, "profile");
  const encodedController = Buffer.from(controllerSource, "utf8").toString("base64");
  const encodedTemplate = Buffer.from(template, "utf8").toString("base64");
  const encodedStyles = Buffer.from(shadowStyles, "utf8").toString("base64");
  const resourceUrls = {
    "join-scheduler.html": "https://fixture.invalid/join-scheduler.html",
    "join-scheduler.css": "https://fixture.invalid/join-scheduler.css"
  };
  const resourcePayloads = {
    [resourceUrls["join-scheduler.html"]]: encodedTemplate,
    [resourceUrls["join-scheduler.css"]]: encodedStyles
  };
  const fixtureSource = [
    "<!doctype html>",
    "<meta charset=\"utf-8\">",
    "<pre id=\"result\" data-result=\"pending\">pending</pre>",
    "<script>",
    "const decode = (value) => new TextDecoder().decode(Uint8Array.from(atob(value), (character) => character.charCodeAt(0)));",
    "const report = document.getElementById('result');",
    "const fail = (error) => { report.dataset.result = `error:${error?.message || error}`; report.textContent = String(error?.stack || error); };",
    "globalThis.addEventListener('error', (event) => fail(event.error || event.message));",
    "globalThis.addEventListener('unhandledrejection', (event) => fail(event.reason));",
    "globalThis.__rslJoinSchedulerTestHooks = { skipInitialize: true };",
    `const resourceUrls = ${JSON.stringify(resourceUrls)};`,
    `const resourcePayloads = ${JSON.stringify(resourcePayloads)};`,
    "globalThis.fetch = async (url) => { const normalizedUrl = String(url); const payload = resourcePayloads[normalizedUrl]; if (!payload) throw new TypeError('fixture-resource'); return { ok: true, url: normalizedUrl, headers: new Headers(), text: async () => decode(payload) }; };",
    "globalThis.chrome = { runtime: { id: 'fixture-extension', lastError: null, getURL: (resourcePath) => resourceUrls[resourcePath], onMessage: { addListener() {} }, sendMessage(message, callback) { queueMicrotask(() => callback({ ok: false, requestId: message.requestId, code: 'UNAUTHENTICATED' })); } } };",
    `(0, eval)(decode(${JSON.stringify(encodedController)}));`,
    `const markup = decode(${JSON.stringify(encodedTemplate)});`,
    "const parsed = new DOMParser().parseFromString(markup, 'text/html');",
    "const ownedTemplate = parsed.getElementById('rsl-join-scheduler-template');",
    "const content = globalThis.__rslJoinSchedulerTestHooks.parseOwnedTemplate(markup);",
    "const ensure = (condition, message) => { if (!condition) throw new Error(message); };",
    "const probeHost = document.createElement('div');",
    "const probeRoot = probeHost.attachShadow({ mode: 'open' });",
    "const probeContainer = document.createElement('div');",
    "for (const trigger of content.querySelectorAll('[data-help-trigger]')) probeContainer.append(trigger.closest('.scheduler-help').cloneNode(true));",
    "const outside = document.createElement('button'); outside.textContent = 'Outside'; probeContainer.append(outside);",
    "const probeDialog = document.createElement('dialog'); probeDialog.setAttribute('data-scheduler-dialog', '');",
    "probeRoot.append(probeContainer, probeDialog); document.body.append(probeHost);",
    "const helpController = globalThis.__rslJoinSchedulerTestHooks.bindHelpTips(probeRoot);",
    "const helpTriggers = Array.from(probeRoot.querySelectorAll('[data-help-trigger]'));",
    "ensure(helpTriggers.length === 3, 'expected exactly three help triggers');",
    "const firstHelp = helpTriggers[0]; const secondHelp = helpTriggers[1];",
    "firstHelp.dispatchEvent(new FocusEvent('focus')); ensure(firstHelp.getAttribute('aria-expanded') === 'true' && !probeRoot.getElementById(firstHelp.getAttribute('aria-controls')).hidden, 'focus must open help');",
    "firstHelp.click(); ensure(firstHelp.closest('.scheduler-help').dataset.helpPinned === 'true', 'native click must pin help for touch, Enter, and Space activation');",
    "secondHelp.dispatchEvent(new FocusEvent('focus')); ensure(firstHelp.getAttribute('aria-expanded') === 'false' && secondHelp.getAttribute('aria-expanded') === 'true', 'opening one help tip must close another');",
    "secondHelp.click(); outside.focus(); ensure(secondHelp.getAttribute('aria-expanded') === 'true', 'pinned help must survive focus moving away');",
    "const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); outside.dispatchEvent(escape);",
    "ensure(escape.defaultPrevented && secondHelp.getAttribute('aria-expanded') === 'false', 'root Escape must close pinned help after Tab-away');",
    "firstHelp.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' })); firstHelp.click();",
    "ensure(firstHelp.getAttribute('aria-expanded') === 'true', 'touch followed by native click must open help');",
    "outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' })); ensure(firstHelp.getAttribute('aria-expanded') === 'false', 'outside touch must close help');",
    "firstHelp.click(); probeDialog.dispatchEvent(new Event('close')); ensure(firstHelp.getAttribute('aria-expanded') === 'false', 'dialog close must reset help');",
    "helpController.destroy(); firstHelp.click(); ensure(firstHelp.getAttribute('aria-expanded') === 'false', 'destroy must detach help listeners'); probeHost.remove();",
    "globalThis.__rslJoinSchedulerModal.open().then((opened) => {",
    "  const host = document.getElementById('rsl-join-scheduler-host');",
    "  const outcome = { parent: ownedTemplate?.parentElement?.tagName || null, headChildren: parsed.head.children.length, bodyChildren: parsed.body.children.length, dialog: Boolean(content.querySelector('[data-scheduler-dialog]')), help: true, opened, host: Boolean(host), closedShadow: host?.shadowRoot === null, isOpen: globalThis.__rslJoinSchedulerModal.isOpen() };",
    "  globalThis.__rslJoinSchedulerModal.destroy();",
    "  report.dataset.result = 'ok';",
    "  report.textContent = JSON.stringify(outcome);",
    "}, fail);",
    "</script>"
  ].join("\n");
  fs.writeFileSync(fixturePath, fixtureSource, "utf8");
  let result;
  try {
    result = spawnSync(edge, [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      `--user-data-dir=${profilePath}`,
      "--virtual-time-budget=5000",
      "--dump-dom",
      pathToFileURL(fixturePath).href
    ], { encoding: "utf8", timeout: 30_000, windowsHide: true });
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.match(
    result.stdout,
    /data-result="ok"[^>]*>\{"parent":"HEAD","headChildren":1,"bodyChildren":0,"dialog":true,"help":true,"opened":true,"host":true,"closedShadow":true,"isOpen":true\}<\/pre>/,
    `The packaged template must pass the real Chromium parser and open path.\n${result.stdout}\n${result.stderr}`
  );
  console.log("PASS Join Scheduler real Chromium DOMParser, help interaction, asset, closed-shadow, and showModal contract");
}

// The packaged markup is an inert component template. It is not another page,
// iframe, or executable extension document.
assert.match(template, /^\s*<template\b[^>]*id="rsl-join-scheduler-template"[^>]*>/i);
assert.match(template, /<\/template>\s*$/i);
assert.equal((template.match(/<template\b/gi) || []).length, 1);
assert.doesNotMatch(
  template,
  /<!doctype|<html\b|<head\b|<body\b|<script\b|<link\b|<style\b|<iframe\b|<meta\b[^>]*http-equiv\s*=|\son[a-z]+\s*=|<form\b[^>]*\baction\s*=/i
);
assert.doesNotMatch(
  template,
  /\b(?:src|href)\s*=\s*["'](?!#|data:|https:|chrome-extension:)[^"']+["']/i,
  "the inert template cannot depend on an unresolved relative asset"
);

const outerDialog = tagWith("data-scheduler-dialog");
assert.match(outerDialog, /<dialog\b/i);
assert.match(outerDialog, /aria-labelledby="scheduler-title"/i);
assert.equal((template.match(/<dialog\b/gi) || []).length, 1,
  "Join Scheduler must own exactly one browser dialog");
assert.equal((template.match(/<\/dialog>/gi) || []).length, 1,
  "the one Scheduler dialog must be balanced");
assert.equal((template.match(/\brsl-dialog__surface\b/g) || []).length, 1,
  "list and editor must share one Settings surface");
assert.equal((template.match(/\bdata-size=["']Medium["']/gi) || []).length, 1,
  "the shared Scheduler surface declares Settings Medium geometry once");
assert.match(
  template,
  /<h1\b[^>]*id="scheduler-title"[^>]*\bdata-scheduler-title\b[^>]*\bdata-editor-title\b[^>]*\btabindex="-1"[^>]*>\s*Join Scheduler\s*<\/h1>/i,
  "the shared title is programmatically focusable and updates for either view"
);
assert.match(tagWith("data-page-status"), /role="status"/i);
assert.match(tagWith("data-page-status"), /aria-live="polite"/i);

const schedulerViews = Array.from(
  template.matchAll(/\bdata-scheduler-view=["']([^"']+)["']/gi),
  (match) => match[1]
);
assert.deepEqual(schedulerViews, ["list", "editor"],
  "the one surface has only list and editor views");
const listView = template.match(/<[^>]+\bdata-scheduler-view=["']list["'][^>]*>/i)?.[0];
const editorView = template.match(/<[^>]+\bdata-scheduler-view=["']editor["'][^>]*>/i)?.[0];
assert.ok(listView, "missing list view");
assert.ok(editorView, "missing editor view");
assert.match(listView, /<section\b/i);
assert.match(editorView, /<form\b/i);
assert.match(editorView, /\bdata-editor\b/i);
assert.match(editorView, /\bdata-schedule-form\b/i);
assert.match(editorView, /\bhidden\b/i,
  "the initial list must not flash the editor before state is chosen");
assert.doesNotMatch(template, /\bdata-scheduler-view=["']confirm["']|\bdata-confirm-dialog\b/i,
  "confirmation is inline at its originating action, never another view or dialog");
assert.doesNotMatch(template, /\baria-haspopup=["']dialog["']/i,
  "in-surface navigation must not claim that it opens another dialog");
assert.match(
  tagWith("data-inline-confirm"),
  /<div\b[^>]*\brole=["']group["'][^>]*\baria-labelledby=["']inline-confirm-title["'][^>]*\baria-describedby=["']inline-confirm-copy["'][^>]*\bhidden\b/i,
  "the reusable inline confirmation has a name, description, and inert initial state"
);
assert.equal((template.match(/\bdata-inline-confirm\b/gi) || []).length, 1,
  "one reusable confirmation panel moves to the originating action");
assert.match(
  template,
  /<button\b[^>]*\btype=["']button["'][^>]*\bdata-action=["']cancel-confirm["']/i
);
assert.match(tagWith("data-confirm-action"), /<button\b[^>]*\btype=["']button["']/i);

const scheduleList = tagWith("data-schedule-list");
assert.match(scheduleList, /<ul\b/i);
assert.match(scheduleList, /aria-label="Join schedules"/i);
assert.doesNotMatch(scheduleList, /aria-live=/i,
  "frequent countdown changes must not repeatedly announce the entire list");

// Keep the shared surface to one creation path and one removal lifecycle.
// Back returns from its in-surface editor; X remains the sole whole-window
// close control, and no manual Refresh duplicates authoritative reloads.
assert.equal(
  (template.match(/\bdata-action=["']new-schedule["']/gi) || []).length,
  1,
  "the Scheduler exposes one New Schedule action"
);
assert.match(
  template,
  /<button\b[^>]*\bdata-action=["']new-schedule["'][^>]*\bdisabled\b/i,
  "New Schedule fails safe before the first account-state response"
);
assert.equal(
  (template.match(/\bdata-action=["']close-editor["']/gi) || []).length,
  1,
  "the editor keeps one Back action"
);
assert.match(
  template,
  /<button\b[^>]*\bdata-action=["']close-editor["'][^>]*>\s*Back\s*<\/button>/i,
  "the editor action says Back because it changes views instead of closing a window"
);
assert.equal((template.match(/\bdata-action=["']close-scheduler["']/gi) || []).length, 1,
  "the shared X closes the whole Scheduler from every view");
assert.doesNotMatch(template, /\bdata-action=["']refresh["']/i);
assert.doesNotMatch(template, /Create your first schedule/i);
assert.doesNotMatch(template, /<h3\b[^>]*>\s*[1-4]\.\s*Choose\b/i,
  "the short editor headings must not regress to a numbered wizard");
assert.doesNotMatch(
  template,
  /<button\b[^>]*>\s*(?:Cancel|Delete|Refresh)\s*<\/button>/i,
  "stale cancel/delete/refresh buttons must not revive the old two-step lifecycle"
);

assert.doesNotMatch(tagWith("data-editor"), /<dialog\b/i,
  "the editor is a view inside the Scheduler, not a second window");
const scheduleForm = tagWith("data-schedule-form");
assert.match(scheduleForm, /<form\b/i);
assert.doesNotMatch(scheduleForm, /\bmethod\s*=/i,
  "the in-surface form must not carry obsolete dialog submission behavior");
assert.match(tagWith("data-game-search"), /role="combobox"/i);
assert.match(tagWith("data-game-search"), /aria-autocomplete="list"/i);
assert.match(tagWith("data-game-search"), /aria-expanded="false"/i);
assert.match(tagWith("data-game-search"), /aria-controls="game-search-results"/i);
const searchResultsList = tagWith("data-search-results");
assert.match(searchResultsList, /<ul\b/i);
assert.match(searchResultsList, /id="game-search-results"/i);
assert.match(searchResultsList, /role="listbox"/i);
assert.match(tagWith("data-schedule-time"), /type="datetime-local"/i);
assert.match(
  template,
  /<fieldset\b[^>]*data-mode-choices[\s\S]*?name="schedule-mode"[^>]*value="notify"[\s\S]*?name="schedule-mode"[^>]*value="auto"[\s\S]*?<\/fieldset>/i
);
assert.match(
  template,
  /name="schedule-mode"[^>]*value="notify"[^>]*[\s\S]*?<strong\b[^>]*>\s*Only notify me\s*<\/strong>/i,
  "notification-only mode must have a short, explicit label"
);
assert.match(
  template,
  /name="schedule-mode"[^>]*value="auto"[^>]*[\s\S]*?<strong\b[^>]*>\s*Try to join automatically\s*<\/strong>/i,
  "automatic mode must have a short, explicit label"
);
const modeChoiceMarkup = sourceBetween(
  template,
  '<fieldset class="rsl-feature-settings__list choice-grid" data-mode-choices>',
  "</fieldset>"
);
assert.doesNotMatch(
  modeChoiceMarkup,
  /Show a reminder|one automatic join attempt|does not open a game automatically/i,
  "mode cards must not regress to paragraphs of helper copy"
);

// Explanatory copy lives behind exactly three compact, fully operable info
// controls. The native-button interaction remains Scheduler-owned, while the
// visual itself is the same empty icon-moreinfo-16x16 span used by Quick
// Settings. Never substitute a text ? or circled-i glyph in the markup.
const helpCopyIds = [
  "action-help-copy",
  "destination-help-copy",
  "auto-consent-help-copy"
];
const helpButtonBlocks = Array.from(
  template.matchAll(/<button\b[^>]*\bdata-help-trigger\b[^>]*>[\s\S]*?<\/button>/gi),
  (match) => match[0]
);
const helpSlotNames = [];
assert.equal(helpButtonBlocks.length, helpCopyIds.length,
  "the simple editor must expose exactly three info controls");
for (const helpCopyId of helpCopyIds) {
  const button = helpButtonBlocks.find((block) =>
    new RegExp(`\\baria-controls=["']${helpCopyId}["']`, "i").test(block)
  );
  assert.ok(button, `missing info control for ${helpCopyId}`);
  assert.match(button, /<button\b/i, "info controls must be native buttons");
  assert.match(button, /\btype=["']button["']/i);
  assert.match(button, /\bclass=["'][^"']*\brsl-icon-button\b/i,
    "info controls must use the Settings icon-button primitive");
  assert.match(button, /\baria-label=["'][^"']+["']/i);
  assert.match(button, new RegExp(`\\baria-controls=["']${helpCopyId}["']`, "i"));
  assert.match(button, new RegExp(`\\baria-describedby=["']${helpCopyId}["']`, "i"));
  assert.match(button, /\baria-expanded=["']false["']/i);
  const iconMatch = button.match(
    /<span\b[^>]*\bclass=["'][^"']*\bscheduler-help__icon\b[^"']*["'][^>]*>[\s\S]*?<\/slot>\s*<\/span>/i
  );
  assert.ok(iconMatch, "info controls must expose one Scheduler-owned icon slot");
  assert.match(iconMatch[0], /\baria-hidden=["']true["']/i,
    "the decorative icon shell must stay out of the accessible name");
  const slotMatch = iconMatch[0].match(
    /<slot\b[^>]*\bname=["']([^"']+)["'][^>]*\bdata-quick-settings-help-icon\b[^>]*>\s*<span\b[^>]*\bclass=["'][^"']*\bscheduler-help__icon-fallback\b[^"']*["'][^>]*\baria-hidden=["']true["'][^>]*>\s*<\/span>\s*<\/slot>/i
  );
  assert.ok(slotMatch,
    "each control must use an empty named slot with an inaccessible empty fallback");
  helpSlotNames.push(slotMatch[1]);
  assert.doesNotMatch(iconMatch[0], /[?ⓘ]/,
    "neither the slot nor its fallback may package a visible text glyph");
  assert.doesNotMatch(button, /\brole=["']button["']|\btabindex=/i,
    "native buttons must not carry redundant role or manual tab stops");

  const copyTagMatch = template.match(
    new RegExp(`<span\\b[^>]*\\bid=["']${helpCopyId}["'][^>]*>`, "i")
  );
  assert.ok(copyTagMatch, `missing controlled help copy ${helpCopyId}`);
  assert.match(copyTagMatch[0], /\bclass=["'][^"']*\bscheduler-help__copy\b/i);
  assert.match(copyTagMatch[0], /\brole=["']tooltip["']/i);
  assert.match(copyTagMatch[0], /\bhidden\b/i);
  assert.equal(
    (template.match(new RegExp(`\\bid=["']${helpCopyId}["']`, "gi")) || []).length,
    1,
    `${helpCopyId} must be unique inside the closed shadow component`
  );
}
assert.deepEqual(
  helpSlotNames,
  [
    "scheduler-action-help-icon",
    "scheduler-destination-help-icon",
    "scheduler-auto-help-icon"
  ],
  "the three Quick Settings visuals need stable, unique slot assignments"
);
assert.match(
  template,
  /id="action-help-copy"[^>]*>Only notify me sends a reminder; nothing opens unless you press Join now\. Try to join automatically sends the same reminder and also makes one automatic launch attempt at the scheduled time\. Scheduling needs browser notification permission\.<\/span>/i,
  "Action info must distinguish reminder-only from automatic joining in one precise explanation"
);
assert.match(
  template,
  /id="destination-help-copy"[^>]*>Join now in the notification opens the selected destination\. If you choose automatic joining, the automatic attempt uses it too\. Public game uses Roblox matchmaking\. Private server uses your saved private-server link and never falls back to public matchmaking\.<\/span>/i,
  "Join location info must state the notification, automatic, public, and private behavior without changing by mode"
);
assert.doesNotMatch(
  template,
  /RoTool does not open a game automatically/i,
  "the old mode-specific sentence was easy to misread and must not return"
);
assert.match(
  template,
  /id="auto-consent-help-copy"[^>]*>[^<]*browser must be running[^<]*one launch attempt[^<]*never falls back from a private server to public matchmaking\.[^<]*<\/span>/i,
  "automatic-joining info must retain its operational limits"
);
assert.doesNotMatch(template, /class="permission-note"/i,
  "notification-permission copy belongs in Action info, not a permanent footer paragraph");
assert.match(
  template,
  /<fieldset\b[^>]*data-destination-choices[\s\S]*?name="destination-type"[^>]*value="public"[\s\S]*?name="destination-type"[^>]*value="private"[\s\S]*?<\/fieldset>/i
);
assert.match(
  template,
  /<h3\b[^>]*id="destination-section-title"[^>]*tabindex="-1"[^>]*>\s*Join location\s*<\/h3>/i,
  "destination deletion has a programmatic heading fallback when no saved server remains"
);

const privateInput = tagWith("data-private-url");
assert.match(privateInput, /type="password"/i);
assert.match(privateInput, /autocomplete="off"/i);
assert.match(privateInput, /spellcheck="false"/i);
assert.match(privateInput, /maxlength="2048"/i);
assert.doesNotMatch(privateInput, /\svalue\s*=/i);
assert.match(tagWith("data-destination-validation"), /role="status"/i);
assert.match(tagWith("data-auto-join-consent"), /type="checkbox"/i);
const allowSwitchInput = tagWith("data-allow-switch");
assert.match(allowSwitchInput, /type="checkbox"/i);
assert.match(allowSwitchInput, /id="allow-game-switch"/i);
assert.match(allowSwitchInput, /aria-describedby="allow-game-switch-help"/i);
assert.match(
  template,
  /<span>\s*Allow RoTool to switch away from a Roblox game I'm playing\.\s*<\/span>/i
);
assert.match(
  template,
  /<p\b[^>]*id="allow-game-switch-help"[^>]*>\s*Off blocks automatic switching; Join now still works\.\s*<\/p>/i,
  "the unchecked switch behavior must be explicit and programmatically associated"
);
assert.match(tagWith("data-inline-confirm"), /\brole=["']group["']/i);
assert.match(tagWith("data-inline-confirm"), /\baria-labelledby=["']inline-confirm-title["']/i);
assert.match(tagWith("data-inline-confirm"), /\baria-describedby=["']inline-confirm-copy["']/i);
assert.match(template, /one automatic launch attempt/i);
assert.match(template, /never falls back (?:to|from)[^<]*public/i);
assert.match(template, /browser must be running/i);
assert.match(
  template,
  /<label\b[^>]*check-row--important[^>]*>\s*<input\b[^>]*data-auto-join-consent[^>]*>\s*<span>[^<]*one automatic launch attempt[^<]*even if I am not at this window\.[^<]*<\/span>\s*<\/label>/i,
  "automatic joining needs a visible acknowledgement, not only tooltip copy"
);
assert.match(
  template,
  /<p\b[^>]*class="field-help"[^>]*>The server code stays hidden after you save it\. Roblox may show the link in your address bar or history while checking or joining\.<\/p>/i,
  "new private-link privacy/history behavior remains visible"
);
assert.match(
  template,
  /<label\b[^>]*data-unverified-confirm[^>]*hidden[^>]*>[\s\S]*?cannot be matched to the selected game[\s\S]*?without public-server fallback[\s\S]*?<\/label>/i,
  "the conditional unmatched-link warning remains an explicit acknowledgement"
);
assert.doesNotMatch(template, /Saved private links are masked\. RoTool never displays the server code again\./i,
  "the duplicate saved-link masking paragraph must not return");

const quickSettingsIconHydrationSource = sourceBetween(
  controllerSource,
  "function hydrateQuickSettingsHelpIcons",
  "function bindHelpTips"
);
assert.match(
  quickSettingsIconHydrationSource,
  /root\.querySelectorAll\("slot\[data-quick-settings-help-icon\]"\)/,
  "hydration must target only the Scheduler's three owned icon slots"
);
assert.match(quickSettingsIconHydrationSource, /const host = root\.host/,
  "the real Quick Settings visuals must stay in light DOM so Roblox sprite CSS reaches them");
assert.match(
  quickSettingsIconHydrationSource,
  /child\.hasAttribute\("data-rsl-scheduler-help-icon"\)[\s\S]*?child\.remove\(\)/,
  "rehydration must remove its previous light-DOM assignments before adding replacements"
);
assert.match(
  quickSettingsIconHydrationSource,
  /information\.className = "rsl-quick-setting-info tooltip-container"/,
  "the assigned wrapper must be the exact Quick Settings visual wrapper"
);
assert.match(quickSettingsIconHydrationSource, /information\.slot = name/);
assert.match(quickSettingsIconHydrationSource, /information\.setAttribute\("aria-hidden", "true"\)/);
assert.match(quickSettingsIconHydrationSource, /information\.setAttribute\("data-rsl-scheduler-help-icon", ""\)/);
assert.match(
  quickSettingsIconHydrationSource,
  /icon\.className = "icon-moreinfo-16x16"[\s\S]*?icon\.setAttribute\("aria-hidden", "true"\)[\s\S]*?information\.append\(icon\)/,
  "the assigned child must be Quick Settings' exact empty, decorative sprite span"
);
assert.doesNotMatch(
  quickSettingsIconHydrationSource,
  /(?:icon|information)\.(?:textContent|innerHTML|outerHTML)|insertAdjacentHTML|createElement\(["'](?:img|svg|script|link|iframe)["']\)/i,
  "icon hydration must not generate a text glyph, active content, or a substitute asset"
);
assert.match(
  quickSettingsIconHydrationSource,
  /getComputedStyle\(icon\)\.backgroundImage[\s\S]*?backgroundImage !== "none"/,
  "an assignment is usable only when Roblox actually supplied its sprite image"
);
assert.match(
  quickSettingsIconHydrationSource,
  /assignments\.length === slots\.length[\s\S]*?if \(!hasNativeSprite\)[\s\S]*?information\.remove\(\)[\s\S]*?return false/,
  "partial or missing sprites must remove every assignment and reveal the safe slot fallback"
);
assert.doesNotMatch(
  quickSettingsIconHydrationSource,
  /\bfetch\s*\(|chrome\.runtime\.getURL|\bURL\s*\(|\.(?:src|href|style\.backgroundImage)\s*=/,
  "the Scheduler must reuse the already-loaded Quick Settings sprite without fetching or exposing another resource"
);

const helpBinderSource = sourceBetween(
  controllerSource,
  "function bindHelpTips",
  "function initialize"
);
assert.match(helpBinderSource, /querySelectorAll\("\[data-help-trigger\]"\)/,
  "the binder owns every and only Scheduler info trigger");
assert.match(helpBinderSource, /getAttribute\?\.\("aria-controls"\)/,
  "a trigger must resolve only its explicitly controlled tooltip");
assert.match(helpBinderSource, /tooltip\.hidden = !open/);
assert.match(helpBinderSource, /setAttribute\("aria-expanded",\s*String\(open\)\)/);
for (const eventName of ["pointerenter", "pointerleave", "focus", "blur", "click"]) {
  assert.match(helpBinderSource, new RegExp(`listen\\([^\\n]+["']${eventName}["']`),
    `info controls must handle ${eventName}`);
}
assert.match(helpBinderSource, /setTimeout\([\s\S]*?,\s*120\)/,
  "hover/focus leave needs a short grace period instead of flicker");
assert.match(helpBinderSource, /root\.activeElement/,
  "transient help must stay open while keyboard focus remains inside its wrapper");
assert.match(helpBinderSource, /dataset\.helpPinned/,
  "click, touch, Enter, and Space must be able to pin a native button's tip");
assert.match(helpBinderSource, /event\.key !== "Escape"[\s\S]*?closeTrigger\(trigger\)/,
  "Escape must close a pinned info tip without closing the editor");
assert.match(
  helpBinderSource,
  /listen\(root,\s*"keydown"[\s\S]*?event\.key !== "Escape"[\s\S]*?aria-expanded"\) === "true"[\s\S]*?preventDefault\(\)[\s\S]*?stopPropagation\(\)[\s\S]*?closeAll\(\)[\s\S]*?true\)/,
  "Escape after Tab-away must close expanded help before the dialog sees the key"
);
assert.match(helpBinderSource, /listen\(root,\s*"pointerdown"[\s\S]*?closeAll\(\)/,
  "an outside pointer/touch press must dismiss pinned help");
assert.match(helpBinderSource, /listen\(root,\s*"scroll",\s*reposition,\s*true\)/);
assert.match(helpBinderSource, /listen\(ownerWindow,\s*"resize",\s*reposition\)/);
assert.match(helpBinderSource, /querySelectorAll\("\[data-scheduler-dialog\]"\)[\s\S]*?"close"[\s\S]*?closeAll\(\)/,
  "closing the sole Scheduler dialog must reset all help state");
assert.doesNotMatch(helpBinderSource, /\[data-editor\]/,
  "the help controller must not treat the in-surface editor as another dialog");
assert.match(helpBinderSource, /const viewportWidth[\s\S]*?const viewportHeight[\s\S]*?const edge = 8[\s\S]*?Math\.max\(edge[\s\S]*?tooltip\.style\.left[\s\S]*?tooltip\.style\.top/,
  "fixed tooltips must be clamped to the viewport instead of being clipped by the editor scroller");
assert.match(helpBinderSource, /destroy:[\s\S]*?closeAll\(\)[\s\S]*?clearTimeout[\s\S]*?cleanup/,
  "destroy must remove listeners, timers, and pinned state");

const updateModeHelpSource = sourceBetween(
  controllerSource,
  "function updateMode",
  "function compatiblePrivateDestinations"
);
assert.doesNotMatch(controllerSource, /destinationHelp/,
  "Join location help is one general explanation and must not mutate when mode changes");
assert.doesNotMatch(
  updateModeHelpSource,
  /notification opens|automatic attempt|public matchmaking|private-server link|helpTips\.reposition\(\)/i,
  "mode updates must not own or rewrite the static Join location explanation"
);

// Search must expose a useful set of real listbox options without weakening
// the combobox's active-descendant keyboard contract.
const maxSearchResultsMatch = controllerSource.match(
  /const MAX_SEARCH_RESULTS\s*=\s*(\d+)\s*;/
);
assert.ok(maxSearchResultsMatch, "missing MAX_SEARCH_RESULTS");
const maxSearchResults = Number(maxSearchResultsMatch[1]);
assert.ok(
  Number.isSafeInteger(maxSearchResults) && maxSearchResults >= 8,
  "game autocomplete must show at least eight useful suggestions"
);
const renderSearchSource = sourceBetween(
  controllerSource,
  "function renderSearchResults",
  "async function runSearch"
);
assert.match(renderSearchSource, /results\.slice\(0,\s*MAX_SEARCH_RESULTS\)/);
assert.match(renderSearchSource, /searchItems\.forEach\(\(game,\s*index\)\s*=>/);
assert.match(renderSearchSource, /item\.setAttribute\("role",\s*"presentation"\)/);
assert.match(renderSearchSource, /button\.id\s*=\s*`game-search-result-\$\{index\}`/);
assert.match(renderSearchSource, /button\.setAttribute\("role",\s*"option"\)/);
assert.match(renderSearchSource, /button\.setAttribute\("aria-selected"/);
assert.match(renderSearchSource, /elements\.searchResults\.append\(item\)/);
assert.match(renderSearchSource, /elements\.search\.setAttribute\("aria-expanded"/);
assert.match(renderSearchSource, /elements\.search\.setAttribute\("aria-activedescendant",\s*active\.id\)/);
assert.match(renderSearchSource, /elements\.search\.removeAttribute\("aria-activedescendant"\)/);

// Modal resources are fetched only from exact extension URLs, are size/status
// checked, and are parsed before entering the closed shadow tree.
const resourceSource = sourceBetween(
  controllerSource,
  "async function fetchOwnedResource",
  "function parseOwnedTemplate"
);
assert.match(resourceSource, /chrome\.runtime\.getURL\(path\)/);
assert.match(resourceSource, /fetch\(url,\s*\{[\s\S]*?credentials:\s*"omit"[\s\S]*?redirect:\s*"error"/);
assert.match(resourceSource, /!response\.ok\s*\|\|\s*response\.url !== url/);
assert.match(resourceSource, /content-length/);
assert.match(resourceSource, /statedLength > RESOURCE_MAX_BYTES/);
assert.match(resourceSource, /text\.length > RESOURCE_MAX_BYTES/);
const schedulerAccessibleResources = (manifest.web_accessible_resources || [])
  .flatMap((entry) => Array.isArray(entry?.resources) ? entry.resources : [])
  .filter((resource) => /(?:join-scheduler|moreinfo|help-icon|info-icon)/i.test(resource))
  .sort();
assert.deepEqual(
  schedulerAccessibleResources,
  ["join-scheduler.css", "join-scheduler.html"],
  "reusing Quick Settings must not add a separately exposed Scheduler icon resource"
);

const parserSource = sourceBetween(
  controllerSource,
  "function parseOwnedTemplate",
  "function loadModalAssets"
);
assert.match(parserSource, /new DOMParser\(\)\.parseFromString\(markup,\s*"text\/html"\)/);
assert.match(parserSource, /getElementById\("rsl-join-scheduler-template"\)/);
assert.match(
  parserSource,
  /const documentElements\s*=\s*\[[\s\S]*?parsed\.head\?\.children[\s\S]*?parsed\.body\?\.children[\s\S]*?\]/,
  "a top-level template may be placed in the parsed head or body by Chromium"
);
assert.match(parserSource, /documentElements\.length !== 1/);
assert.match(parserSource, /documentElements\[0\] !== template/);
assert.doesNotMatch(parserSource, /parsed\.body\.children\.length !== 1/);
assert.match(parserSource, /script, link, style, iframe, frame, object, embed, base, meta/);
assert.match(parserSource, /name\.startsWith\("on"\)[\s\S]*?name === "action"[\s\S]*?name === "formaction"/);
runRealChromiumTemplateParserRegression();

const assetSource = sourceBetween(
  controllerSource,
  "function loadModalAssets",
  "function normalizeSchedulerDraft"
);
assert.match(assetSource, /fetchOwnedResource\(TEMPLATE_PATH\)/);
assert.match(assetSource, /fetchOwnedResource\(STYLE_PATH\)/);
assert.match(assetSource, /@import\\b\|url\\s\*\\\(/);

const componentSource = sourceBetween(
  controllerSource,
  "async function createModalComponent",
  "function destroyJoinSchedulerModal"
);
assert.match(componentSource, /host\.attachShadow\(\{\s*mode:\s*"closed"\s*\}\)/);
assert.doesNotMatch(componentSource, /mode:\s*["']open["']/);
assert.match(componentSource, /style\.textContent\s*=\s*assets\.css/);
assert.match(componentSource, /document\.importNode\(assets\.template,\s*true\)/);
assert.match(componentSource, /initialize\(shadowRoot,/);
assert.doesNotMatch(
  controllerSource,
  /createElement\(\s*["']iframe["']\s*\)|<iframe\b|HTMLIFrameElement|window\.open\s*\(|chrome\.windows\./,
  "the content component never opens or embeds a second scheduler page");

// DOM ownership, dialog focus, and teardown stay inside the closed root.
const initializeSource = sourceBetween(
  controllerSource,
  "function initialize(root, options = {})",
  "async function fetchOwnedResource"
);
assert.match(initializeSource, /const query = \(selector\) => root\.querySelector\(selector\)/);
assert.match(initializeSource, /const queryAll = \(selector\) => Array\.from\(root\.querySelectorAll\(selector\)\)/);
assert.doesNotMatch(initializeSource, /document\.querySelector(?:All)?\s*\(/);
assert.doesNotMatch(initializeSource, /document\.activeElement/);
assert.match(initializeSource, /lastFocus\s*=\s*root\.activeElement/);
assert.match(initializeSource, /elements\.searchResults\.contains\(root\.activeElement\)/);
assert.match(
  initializeSource,
  /elements\.search\.addEventListener\("keydown"[\s\S]*?if \(!searchItems\.length\) \{[\s\S]*?return;[\s\S]*?event\.key === "ArrowDown"[\s\S]*?event\.key === "ArrowUp"[\s\S]*?updateActiveSearchResult\(\)[\s\S]*?event\.key === "Enter"[\s\S]*?selectSearchIndex\(activeSearchIndex\)[\s\S]*?event\.key === "Escape"[\s\S]*?clearSearch\(\)/,
  "the ARIA listbox remains keyboard-operable while closed-search Escape can reach the outer view controller"
);
assert.doesNotMatch(initializeSource, /elements\.editor\.addEventListener\("cancel"/,
  "an in-surface editor cannot own a second dialog cancel lifecycle");
const outerCancelSource = sourceBetween(
  initializeSource,
  'elements.schedulerDialog.addEventListener("cancel"',
  'elements.schedulerDialog.addEventListener("click"'
);
for (const expected of [
  "event.preventDefault()",
  "!elements.searchResults.hidden",
  "pendingConfirmation",
  'activeView === "editor"',
  "closeEditor()",
  "options.onRequestClose?.()"
]) {
  assert.match(outerCancelSource, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}
assert.ok(
  outerCancelSource.indexOf("!elements.searchResults.hidden") <
    outerCancelSource.indexOf("pendingConfirmation") &&
  outerCancelSource.indexOf("pendingConfirmation") <
    outerCancelSource.indexOf(
      'activeView === "editor"',
      outerCancelSource.indexOf("pendingConfirmation")
    ) &&
  outerCancelSource.indexOf("closeEditor()") <
    outerCancelSource.indexOf("options.onRequestClose?.()"),
  "Escape priority is open help/search, inline confirmation, editor Back, then list close"
);
assert.match(initializeSource, /event\.target === elements\.schedulerDialog[\s\S]*?options\.onRequestClose\?\.\(\)/);
assert.match(initializeSource, /elements\.privateUrlInput\.value\s*=\s*""[\s\S]*?clearInterval\(countdownTimer\)/s);
assert.equal((controllerSource.match(/\.showModal\s*\(/g) || []).length, 1,
  "only the outer Scheduler may invoke showModal");
assert.match(initializeSource, /elements\.schedulerDialog\.showModal\(\)/);
assert.doesNotMatch(initializeSource, /elements\.(?:editor|confirmDialog)\.(?:showModal|close)|\bconfirmDialog\b/,
  "editor and confirmation must not retain nested dialog APIs");
assert.match(
  initializeSource,
  /settleInlineConfirmation\(false, false\)[\s\S]*?destroyed = true[\s\S]*?invalidateInteraction\(\)[\s\S]*?elements\.schedulerDialog\.close\(\)/,
  "teardown rejects inline confirmation, zeros interaction state, and closes only the shared dialog"
);
assert.match(initializeSource, /root\.replaceChildren\(\)/);
assert.doesNotMatch(initializeSource, /data-action=['"]refresh['"]/,
  "state refreshes after mutations without a redundant manual Refresh control");

// Schedule cards render immediately with an accessible adjacent game name and
// a decorative initial, then repaint only from the validated read-only icon
// response. Image failure must restore that same initial without hiding text.
const addThumbnailSource = sourceBetween(
  initializeSource,
  "function addThumbnail",
  "function sendRuntimeMessage"
);
assert.match(addThumbnailSource,
  /const fallback = String\(label \|\| "\?"\)\.trim\(\)\.charAt\(0\)\.toUpperCase\(\) \|\| "\?"/);
assert.match(addThumbnailSource,
  /createElement\("img"\)[\s\S]*?image\.src = url[\s\S]*?image\.alt = ""[\s\S]*?image\.referrerPolicy = "no-referrer"/,
  "game icons are decorative and never send a Roblox-page referrer");
assert.match(addThumbnailSource,
  /image\.addEventListener\("error"[\s\S]*?image\.parentElement === container[\s\S]*?container\.replaceChildren\(\)[\s\S]*?container\.textContent = fallback[\s\S]*?once:\s*true/,
  "a broken image deterministically restores the game-name initial");
assert.doesNotMatch(addThumbnailSource, /innerHTML|insertAdjacentHTML|onerror\s*=/i);

const scheduleCardSource = sourceBetween(
  initializeSource,
  "function renderSchedule",
  "function renderSchedules"
);
assert.match(scheduleCardSource,
  /thumbnail\.setAttribute\("aria-hidden", "true"\)/,
  "the adjacent strong game name remains the card's accessible identity");
assert.match(scheduleCardSource,
  /thumbnail\.dataset\.rslScheduleThumbnail = ""[\s\S]*?thumbnail\.dataset\.rslUniverseId = schedule\.universeId[\s\S]*?addThumbnail\(thumbnail, thumbnails\.get\(schedule\.universeId\), schedule\.gameName\)/);
assert.match(scheduleCardSource,
  /topLine\.append\(makeElement\("strong", "", schedule\.gameName\)\)/);

const gameIconIdsSource = sourceBetween(
  initializeSource,
  "function getGameIconRequestUniverseIds",
  "function repaintScheduleGameIcons"
);
assert.match(gameIconIdsSource, /const seen = new Set\(\)/);
assert.match(gameIconIdsSource, /\^\[1-9\]\\d\{0,19\}\$/);
assert.match(gameIconIdsSource, /seen\.has\(universeId\)/);
assert.match(gameIconIdsSource, /universeIds\.length >= 50/);
assert.match(gameIconIdsSource, /add\(selectedGame\?\.universeId\)/,
  "an official Event draft requests its universe game icon");
assert.match(gameIconIdsSource,
  /for \(const schedule of Array\.isArray\(state\.schedules\)[\s\S]*?add\(schedule\?\.universeId\)/,
  "reopened saved schedules hydrate through the same deduplicated batch");
assert.doesNotMatch(gameIconIdsSource,
  /placeId|gameName|title|startAt|destination|private|viewer/i,
  "the icon payload builder collects only public universe IDs");

const repaintGameIconsSource = sourceBetween(
  initializeSource,
  "function repaintScheduleGameIcons",
  "async function hydrateGameIcons"
);
assert.match(repaintGameIconsSource,
  /\[data-rsl-schedule-thumbnail\]\[data-rsl-universe-id\]/);
assert.match(repaintGameIconsSource,
  /state\.schedules\.find\([\s\S]*?item\.universeId === universeId[\s\S]*?addThumbnail\(thumbnail, thumbnails\.get\(universeId\), schedule\.gameName\)/);

const hydrateGameIconsSource = sourceBetween(
  initializeSource,
  "async function hydrateGameIcons",
  "function refreshScheduleCountdowns"
);
assert.match(hydrateGameIconsSource,
  /const universeIds = getGameIconRequestUniverseIds\(\)[\s\S]*?const expectedViewerUserId = state\.viewerUserId/);
assert.match(hydrateGameIconsSource,
  /const sequence = \+\+gameIconLoadSequence[\s\S]*?const expectedStateLoadSequence = stateLoadSequence/);
assert.match(hydrateGameIconsSource,
  /selectedGame \? Object\.freeze\(\{[\s\S]*?universeId: selectedGame\.universeId[\s\S]*?placeId: selectedGame\.placeId[\s\S]*?viewEpoch,[\s\S]*?interactionEpoch/);
assert.match(hydrateGameIconsSource,
  /api\("get-game-icons", \{ universeIds \}\)/);
for (const staleGuard of [
  /sequence !== gameIconLoadSequence/,
  /expectedStateLoadSequence !== stateLoadSequence/,
  /destroyed/,
  /root\.host\?\.isConnected !== true/,
  /!elements\.schedulerDialog\.open/,
  /state\.viewerUserId !== expectedViewerUserId/
]) {
  assert.match(hydrateGameIconsSource, staleGuard,
    "a late icon batch cannot repaint a stale modal/account/state");
}
assert.match(hydrateGameIconsSource,
  /const rawIcons = response\.gameIcons[\s\S]*?!Array\.isArray\(rawIcons\)[\s\S]*?rawIcons\.length > universeIds\.length[\s\S]*?return response/,
  "the background cannot expand a bounded request or return a partial hostile shape");
assert.match(hydrateGameIconsSource,
  /const icon = normalizeGameIcon\(rawIcon\)[\s\S]*?!requested\.has\(icon\.universeId\)[\s\S]*?seen\.has\(icon\.universeId\)[\s\S]*?thumbnails\.set\(icon\.universeId, icon\.thumbnailUrl\)/,
  "only unique requested and locally revalidated icons reach the map");
assert.match(hydrateGameIconsSource, /repaintScheduleGameIcons\(\)/);
for (const editorGuard of [
  /activeView === "editor"/,
  /viewEpoch === selectedSnapshot\.viewEpoch/,
  /interactionEpoch === selectedSnapshot\.interactionEpoch/,
  /selectedGame\?\.universeId === selectedSnapshot\.universeId/,
  /selectedGame\?\.placeId === selectedSnapshot\.placeId/
]) {
  assert.match(hydrateGameIconsSource, editorGuard,
    "a late official/search icon cannot replace another editor selection");
}
assert.doesNotMatch(hydrateGameIconsSource,
  /destination|privateServer|accessCode|shareCode|canonicalUrl|startAt|eventId/i);

const iconStateLoadSource = sourceBetween(
  initializeSource,
  "async function loadState",
  "function modeValue"
);
const iconRenderIndex = iconStateLoadSource.indexOf("renderSchedules()");
const iconHydrationIndex = iconStateLoadSource.indexOf(
  "void hydrateGameIcons().catch(() => undefined)"
);
assert.ok(iconRenderIndex >= 0 && iconHydrationIndex > iconRenderIndex,
  "text and letter cards render before best-effort icon networking begins");
assert.match(iconStateLoadSource,
  /void hydrateGameIcons\(\)\.catch\(\(\) => undefined\)/,
  "unavailable/disabled icon hydration never suppresses state rendering");
const officialDraftSource = sourceBetween(
  initializeSource,
  "function applyOfficialDraft",
  "function openEditorForDraft"
);
assert.match(officialDraftSource,
  /universeId: officialDraft\.universeId[\s\S]*?placeId: officialDraft\.placeId[\s\S]*?thumbnailUrl: thumbnails\.get\(officialDraft\.universeId\) \|\| null/);
assert.match(initializeSource,
  /destroyed = true[\s\S]*?stateLoadSequence \+= 1[\s\S]*?gameIconLoadSequence \+= 1/,
  "destroy invalidates both pending state and pending icon work");
assert.match(controllerSource,
  /const READ_ONLY_OPERATIONS = new Set\(\[[\s\S]*?"get-state"[\s\S]*?"get-game-icons"[\s\S]*?"search-games"/,
  "icon hydration uses the existing side-effect-free timeout policy");

const viewSource = sourceBetween(
  controllerSource,
  "function setSchedulerView",
  "function clearAccountSurface"
);
assert.match(viewSource, /const nextView = view === "editor" \? "editor" : "list"/);
assert.match(viewSource, /if \(viewChanged\) viewEpoch \+= 1/,
  "every real view change invalidates async work captured by the prior view");
assert.match(
  viewSource,
  /activeView === "editor" && nextView === "list"[\s\S]*?invalidateInteraction\(\)[\s\S]*?clearPrivateEntry\(\)[\s\S]*?clearSearch\(\)/,
  "Back zeroes closure-held and DOM-held private data before revealing the list"
);
assert.match(viewSource, /elements\.listView\.hidden = nextView !== "list"/);
assert.match(viewSource, /elements\.editor\.hidden = nextView !== "editor"/);
assert.match(viewSource, /elements\.listFooterActions\.hidden = nextView !== "list"/);
assert.match(viewSource, /elements\.editorFooterActions\.hidden = nextView !== "editor"/);
assert.match(
  viewSource,
  /elements\.schedulerTitle\.textContent = nextView === "editor"[\s\S]*?: "Join Scheduler"[\s\S]*?elements\.schedulerDescription\.textContent = nextView === "editor"/,
  "the one shared accessible header follows the visible view"
);
assert.match(
  viewSource,
  /listScrollTop = elements\.schedulerScroll\.scrollTop[\s\S]*?elements\.schedulerScroll\.scrollTop = nextView === "editor" \? 0 : listScrollTop/,
  "editor starts at its top and Back restores the list position instead of jumping"
);

const focusAndEditorSource = sourceBetween(
  controllerSource,
  "function focusEditorTarget",
  "function renderSearchResults"
);
assert.match(
  focusAndEditorSource,
  /target === "heading" \? elements\.editorTitle : elements\.search[\s\S]*?focusTarget\?\.focus\?\.\(\)/,
  "the shared title and search are explicit editor focus targets"
);
assert.match(focusAndEditorSource, /openEditorForDraft\([\s\S]*?focus: "heading"[\s\S]*?focusEditorTarget\("heading"\)/);
assert.match(focusAndEditorSource, /openEditorForSchedule\([\s\S]*?focus: "heading"[\s\S]*?focusEditorTarget\("heading"\)/);
assert.match(
  focusAndEditorSource,
  /function closeEditor[\s\S]*?setSchedulerView\("list"\)[\s\S]*?focusTarget\?\.isConnected[\s\S]*?focusTarget\.focus\(\)[\s\S]*?const fallback = !elements\.newSchedule\.disabled[\s\S]*?\? elements\.newSchedule[\s\S]*?: elements\.schedulerTitle[\s\S]*?fallback\.focus\(\)/,
  "Back restores the originating control, with New Schedule as a safe fallback"
);

const closeButtonSource = sourceBetween(
  initializeSource,
  'query("[data-action=\'close-scheduler\']")',
  'query("[data-action=\'change-game\']")'
);
assert.match(closeButtonSource, /isTrustedEvent\(event\)/);
assert.match(closeButtonSource, /options\.onRequestClose\?\.\(\)/);
assert.doesNotMatch(closeButtonSource, /closeEditor|setSchedulerView|settleInlineConfirmation/,
  "X closes the whole Scheduler instead of acting like editor Back or Keep");

const changeGameSource = sourceBetween(
  initializeSource,
  'query("[data-action=\'change-game\']")',
  'query("[data-action=\'validate-private\']")'
);
const invalidateChangeIndex = changeGameSource.indexOf("invalidateInteraction()");
const clearPrivateChangeIndex = changeGameSource.indexOf("clearPrivateEntry()");
const clearSelectedGameIndex = changeGameSource.indexOf("selectedGame = null");
assert.ok(
  invalidateChangeIndex >= 0 &&
  clearPrivateChangeIndex > invalidateChangeIndex &&
  clearSelectedGameIndex > clearPrivateChangeIndex,
  "Change game synchronously zeroes closure-held and password-DOM private data before dropping game identity"
);
const showSelectedGameSource = sourceBetween(
  controllerSource,
  "function showSelectedGame",
  "function resetEditor"
);
assert.match(
  showSelectedGameSource,
  /selectedGame[\s\S]*?selectedGame\.universeId !== game\.universeId[\s\S]*?selectedGame\.placeId !== game\.placeId[\s\S]*?clearPrivateEntry\(\)[\s\S]*?selectedGame = game/,
  "every game-identity replacement independently clears a private link before adopting the new game"
);

const openSchedulerSource = sourceBetween(
  controllerSource,
  "async function openScheduler",
  "function destroyScheduler"
);
const stageDraftIndex = openSchedulerSource.indexOf("openEditorForDraft(draft, true)");
const showDraftIndex = openSchedulerSource.indexOf("showDialog()", stageDraftIndex);
const loadDraftIndex = openSchedulerSource.indexOf("loadState(", stageDraftIndex);
assert.ok(stageDraftIndex >= 0 && showDraftIndex > stageDraftIndex && loadDraftIndex > showDraftIndex,
  "an Event stages and shows the editor before async hydration, so the list cannot flash first");
assert.match(
  openSchedulerSource,
  /draftLoading = true[\s\S]*?elements\.editor\.setAttribute\("aria-busy", "true"\)[\s\S]*?elements\.submit\.disabled = true/,
  "the immediately visible Event editor is read-only while account state hydrates"
);
assert.match(
  openSchedulerSource,
  /const expectedViewEpoch = viewEpoch[\s\S]*?const expectedInteractionEpoch = interactionEpoch[\s\S]*?sequence !== openSequence[\s\S]*?activeView !== "editor"[\s\S]*?viewEpoch !== expectedViewEpoch[\s\S]*?interactionEpoch !== expectedInteractionEpoch/,
  "late Event hydration cannot write into a closed, replaced, or reopened editor"
);
assert.match(openSchedulerSource, /focusEditorTarget\("heading"\)/,
  "Event entry focuses the visible heading rather than a hidden search input");
assert.doesNotMatch(openSchedulerSource, /await loadState/,
  "opening an Event cannot wait behind state loading before showing its editor");

assert.match(initializeSource, /let stateLoading = false/);
const newScheduleAvailabilitySource = sourceBetween(
  controllerSource,
  "function updateNewScheduleAvailability",
  "function makeElement"
);
assert.match(
  newScheduleAvailabilitySource,
  /elements\.newSchedule\.disabled = Boolean\([\s\S]*?destroyed \|\| stateLoading \|\| !state\.enabled \|\| !state\.viewerUserId/,
  "New Schedule stays disabled until the current signed-in/enabled state is authoritative"
);
const stateLoadSource = sourceBetween(
  controllerSource,
  "async function loadState",
  "function modeValue"
);
assert.match(
  stateLoadSource,
  /const sequence = \+\+stateLoadSequence[\s\S]*?stateLoading = true;[\s\S]*?updateNewScheduleAvailability\(\)/,
  "state loading gates New synchronously before its first await"
);
assert.match(
  stateLoadSource,
  /finally \{[\s\S]*?sequence === stateLoadSequence[\s\S]*?stateLoading = false;[\s\S]*?updateNewScheduleAvailability\(\)/,
  "only the newest state request may lift the New Schedule gate"
);
assert.match(focusAndEditorSource, /stateLoading && !options\.allowUnloaded/,
  "manual editor entry is rejected while account state is unresolved");
assert.match(
  initializeSource,
  /data-action='new-schedule'[\s\S]*?addEventListener\("click"[\s\S]*?!isTrustedEvent\(event\) \|\| pendingConfirmation \|\| stateLoading[\s\S]*?openEditor\(\)/,
  "a fast New click cannot surface a false signed-out error while loading"
);
assert.match(
  openSchedulerSource,
  /showDialog\(\)[\s\S]*?const focusNewAfterLoad = activeView === "list"[\s\S]*?const pendingState = loadState\([\s\S]*?elements\.schedulerTitle\.focus\(\)[\s\S]*?pendingState\.catch[\s\S]*?sequence !== openSequence[\s\S]*?activeView !== "list"[\s\S]*?viewEpoch !== expectedViewEpoch[\s\S]*?stateLoading[\s\S]*?elements\.newSchedule\.disabled[\s\S]*?elements\.newSchedule\.focus\(\)/,
  "normal open focuses the shared heading during load, then the enabled New action only in the unchanged list context"
);

const staleScheduleRecoverySource = sourceBetween(
  controllerSource,
  "async function recoverFromStaleScheduleError",
  "function getDestination"
);
for (const staleCode of [
  "SCHEDULE_CHANGED",
  "SCHEDULE_NOT_FOUND",
  "SCHEDULE_NOT_EDITABLE"
]) {
  assert.match(staleScheduleRecoverySource, new RegExp(`["]${staleCode}["]`));
}
assert.equal(
  (staleScheduleRecoverySource.match(/await loadState\(\)/g) || []).length,
  1,
  "a stale revision reloads the authoritative list exactly once"
);
assert.match(
  staleScheduleRecoverySource,
  /closeEditorAfterReload && activeView === "editor"\) closeEditor\(true\)/,
  "a stale edit closes its old form after the latest revision is loaded"
);
assert.match(staleScheduleRecoverySource, /Review the latest version and try again/);
assert.doesNotMatch(staleScheduleRecoverySource, /\bapi\s*\(/,
  "stale recovery never repeats a mutation without a new trusted action and confirmation");

const destroyModalSource = sourceBetween(
  controllerSource,
  "function destroyJoinSchedulerModal",
  "async function openJoinSchedulerModal"
);
assert.match(destroyModalSource, /component\.controller\.destroy\(\)/);
assert.match(destroyModalSource, /component\.host\.remove\(\)/);
assert.match(destroyModalSource, /opener\?\.isConnected[\s\S]*?opener\.focus\(\)/);

// Notification permission is a user-gesture relay. The content UI never calls
// chrome.permissions itself and the relay carries only type + requestId.
assert.doesNotMatch(controllerSource, /chrome\.permissions\./);
const apiSource = sourceBetween(
  controllerSource,
  "async function api",
  "function clearPrivateEntry"
);
assert.match(apiSource, /const expectedViewerUserId = options\.omitViewer \? null : state\.viewerUserId/);
assert.match(apiSource, /!options\.omitViewer && !expectedViewerUserId[\s\S]*?code:\s*"UNAUTHENTICATED"/);
assert.match(apiSource, /response\.viewerUserId !== expectedViewerUserId[\s\S]*?code:\s*"ACCOUNT_CHANGED"/,
  "every account-scoped response is rejected if it belongs to another viewer");
const permissionSource = sourceBetween(
  controllerSource,
  "function requestNotificationPermission",
  "function validateFormSynchronously"
);
assert.match(
  permissionSource,
  /api\("request-notification-permission",\s*\{\},\s*\{\s*omitViewer:\s*true\s*\}\)/
);
assert.doesNotMatch(permissionSource, /viewerUserId|url|destination|schedule|private/i);

const submitSource = sourceBetween(
  controllerSource,
  "async function submitSchedule",
  "async function validatePrivate"
);
assert.match(submitSource, /if \(!isTrustedEvent\(event\)\) return;/,
  "synthetic submits cannot request permission or create schedules");
const permissionIndex = submitSource.indexOf("requestNotificationPermission()");
const firstAwaitIndex = submitSource.indexOf("await ");
const privateClearIndex = submitSource.indexOf('elements.privateUrlInput.value = ""');
assert.ok(permissionIndex >= 0 && firstAwaitIndex > permissionIndex,
  "permission relay begins synchronously in the submit gesture");
assert.ok(privateClearIndex > permissionIndex && privateClearIndex < firstAwaitIndex,
  "the password input is cleared before the permission promise can settle");
assert.match(submitSource, /const submitSnapshot = Object\.freeze\(\{/);
for (const field of [
  "epoch", "viewerUserId", "game", "officialDraft", "scheduleId",
  "expectedRevision", "startAt", "mode", "destinationType", "destinationId",
  "confirmUnverified", "allowSwitch", "autoJoinConsent"
]) {
  assert.match(submitSource, new RegExp(`\\b${field}:`), `submit snapshot is missing ${field}`);
}
assert.match(submitSource, /interactionEpoch === submitSnapshot\.epoch/);
assert.match(submitSource, /state\.viewerUserId === submitSnapshot\.viewerUserId/);
assert.ok((submitSource.match(/if \(!contextIsCurrent\(\)\) return;/g) || []).length >= 3,
  "account/editor context is rechecked after every privileged await boundary");
assert.match(submitSource, /finally\s*\{[\s\S]*?privateSecret\.value\s*=\s*""/);
assert.match(
  submitSource,
  /catch \(error\) \{[\s\S]*?recoverFromStaleScheduleError\(error, Boolean\(submitSnapshot\.scheduleId\)\)[\s\S]*?recoverFromAccountError\(error\)/,
  "a stale edit reloads state and closes its old editor instead of silently resubmitting"
);

// Check Link moves the bearer token out of the password DOM before its request
// starts. A successful validation may retain the closure cell for the user's
// later Schedule click; interaction changes and error exits zero it.
const validateSource = sourceBetween(
  controllerSource,
  "async function validatePrivate",
  "function confirmAction"
);
assert.match(validateSource, /validatePrivate\(secretHolder,\s*expectedInteractionEpoch\)/);
assert.match(validateSource, /const rawUrl = String\(secretHolder\?\.value \|\| ""\)\.trim\(\)/);
assert.match(validateSource, /const pendingRequest = api\("validate-destination"/);
assert.match(validateSource, /interactionEpoch !== expectedInteractionEpoch/);
assert.match(validateSource, /pendingValidationSecret !== secretHolder/);
assert.match(validateSource, /finally\s*\{[\s\S]*?if \(!retainSecret\)[\s\S]*?secretHolder\.value\s*=\s*""/);
assert.doesNotMatch(validateSource, /privateUrlInput\.value\.trim\(\)\s*!==\s*rawUrl/,
  "validation must bind to an epoch/snapshot after clearing the visible input");

// Every background mutation/launch is gated by a real interaction. A generic
// programmatic dialog.close("confirm") is not sufficient authorization.
assert.match(initializeSource, /elements\.form\.addEventListener\("submit",\s*\(event\)/);
const validateClickSource = sourceBetween(
  initializeSource,
  "query(\"[data-action='validate-private']\")",
  "elements.testPrivate.addEventListener"
);
assert.match(validateClickSource, /const secretHolder = \{\s*value:\s*elements\.privateUrlInput\.value\.trim\(\)\s*\}/);
assert.ok(
  validateClickSource.indexOf('elements.privateUrlInput.value = ""') <
    validateClickSource.indexOf("validatePrivate(secretHolder, interactionEpoch)"),
  "Check Link clears the password control before starting validation"
);
assert.match(initializeSource, /elements\.list\.addEventListener\("click",\s*\(event\)[\s\S]*?isTrustedEvent\(event\)[\s\S]*?handleScheduleAction/);
assert.match(initializeSource, /elements\.testPrivate\.addEventListener\("click",\s*\(event\)[\s\S]*?isTrustedEvent\(event\)[\s\S]*?testPrivateDestination/);
assert.match(initializeSource, /elements\.deletePrivate\.addEventListener\("click",\s*\(event\)[\s\S]*?isTrustedEvent\(event\)[\s\S]*?deletePrivateDestination/);
assert.match(initializeSource, /data-action=['"]validate-private['"][\s\S]*?addEventListener\("click",\s*\(event\)[\s\S]*?isTrustedEvent\(event\)[\s\S]*?validatePrivate/);

const scheduleRendererSource = sourceBetween(
  controllerSource,
  "function renderSchedule",
  "function renderSchedules"
);
assert.match(
  scheduleRendererSource,
  /if \(schedule\.status === "pending"\) \{[\s\S]*?action\("Join Now", "join"[\s\S]*?action\("Edit", "edit"[\s\S]*?action\("Remove", "remove"[\s\S]*?\} else \{[\s\S]*?action\("Remove", "remove"/,
  "pending cards keep Join Now/Edit/Remove while every final state still has Remove"
);
assert.doesNotMatch(
  scheduleRendererSource,
  /action\(["'](?:Cancel|Delete)["']\s*,\s*["'](?:cancel|delete)["']/,
  "cards must not recreate the cancel-then-delete lifecycle"
);
assert.doesNotMatch(scheduleRendererSource, /\bstatus-pill\b|schedule\.resultCode/,
  "cards omit redundant pills and raw backend result codes");
assert.match(scheduleRendererSource, /schedule\.mode === "auto" \? "Auto-join" : "Reminder"/);
assert.match(scheduleRendererSource, /"Private server" : "Public game"/);

const scheduleFocusSource = sourceBetween(
  controllerSource,
  "function captureScheduleFocusIntent",
  "async function loadState"
);
assert.match(
  scheduleFocusSource,
  /Object\.freeze\(\{[\s\S]*?scheduleId: schedule\.id[\s\S]*?action,[\s\S]*?index: Math\.max\(0, state\.schedules\.findIndex[\s\S]*?viewerUserId: state\.viewerUserId/,
  "schedule focus intent snapshots identity, action, list position, and account before rerender"
);
assert.match(
  scheduleFocusSource,
  /destroyed[\s\S]*?activeView !== "list"[\s\S]*?!elements\.schedulerDialog\.open[\s\S]*?state\.viewerUserId === intent\.viewerUserId/,
  "focus cannot be restored into a closed view or another account"
);
assert.match(
  scheduleFocusSource,
  /card\.dataset\.scheduleId === intent\.scheduleId[\s\S]*?button\.dataset\.scheduleAction === intent\.action[\s\S]*?sameCard\.querySelector\("button\[data-schedule-action\]"\)/,
  "Join returns to the same action, with the same card's first action as fallback"
);
assert.match(
  scheduleFocusSource,
  /cards\[Math\.min\(intent\.index, cards\.length - 1\)\][\s\S]*?!elements\.newSchedule\.disabled[\s\S]*?elements\.newSchedule[\s\S]*?: elements\.schedulerTitle[\s\S]*?target\?\.focus\?\.\(\)/,
  "removed cards focus the next/previous card, then enabled New, then the shared title"
);

const scheduleActionSource = sourceBetween(
  controllerSource,
  "async function handleScheduleAction",
  "async function testPrivateDestination"
);
assert.match(
  scheduleActionSource,
  /if \(action === "remove"\) \{[\s\S]*?const expectedViewerUserId = state\.viewerUserId[\s\S]*?const expectedRevision = schedule\.revision[\s\S]*?confirmAction\([\s\S]*?"Remove schedule\?"[\s\S]*?button\.closest\("\.schedule-card"\)[\s\S]*?state\.viewerUserId === expectedViewerUserId[\s\S]*?current\.revision === expectedRevision[\s\S]*?if \(!confirmed\) return;/,
  "Remove confirms inline on its card and rechecks the reviewed account/revision"
);
assert.match(
  scheduleActionSource,
  /else if \(action === "remove"\) \{[\s\S]*?api\("delete-schedule", \{[\s\S]*?scheduleId: schedule\.id[\s\S]*?expectedRevision: schedule\.revision/,
  "Remove directly deletes the reviewed schedule revision"
);
assert.doesNotMatch(
  scheduleActionSource,
  /action === ["'](?:cancel|delete)["']|api\(["']cancel-schedule["']/,
  "the page UI has no intermediate Cancel operation"
);
assert.match(
  scheduleActionSource,
  /catch \(error\) \{[\s\S]*?!await recoverFromStaleScheduleError\(error\)[\s\S]*?!await recoverFromAccountError\(error\)/,
  "stale Join/Remove actions reload before presenting an ordinary error"
);
assert.match(scheduleActionSource, /const focusIntent = captureScheduleFocusIntent\(schedule, action\)/);
assert.match(
  scheduleActionSource,
  /await loadState\(\)[\s\S]*?finally \{[\s\S]*?setBusy\(button, false\)[\s\S]*?restoreScheduleFocus\(focusIntent\)/,
  "Join and confirmed Remove restore logical focus after success, stale recovery, or another rerender"
);
assert.doesNotMatch(controllerSource, /api\(["']cancel-schedule["']/,
  "internal cancellation remains background-only"
);

const destinationFocusSource = sourceBetween(
  controllerSource,
  "function restoreDestinationFocus",
  "function renderDestinations"
);
assert.match(
  destinationFocusSource,
  /destroyed[\s\S]*?activeView !== "editor"[\s\S]*?!elements\.schedulerDialog\.open/,
  "destination focus cannot escape into a closed or replaced editor"
);
assert.match(
  destinationFocusSource,
  /!elements\.savedDestinations\.hidden[\s\S]*?elements\.savedDestination\.options\.length[\s\S]*?elements\.savedDestination[\s\S]*?: elements\.destinationHeading[\s\S]*?target\.focus\(\)/,
  "destination deletion returns to the visible saved-server select or Join location heading"
);
const deleteDestinationSource = sourceBetween(
  controllerSource,
  "async function deletePrivateDestination",
  'elements.confirmCancel.addEventListener("click"'
);
assert.match(
  deleteDestinationSource,
  /renderDestinations\(\)[\s\S]*?await loadState\(\)[\s\S]*?finally \{[\s\S]*?setBusy\(elements\.deletePrivate, false\)[\s\S]*?restoreDestinationFocus\(\)/,
  "private-destination removal restores focus after its controls and schedule list rerender"
);
const confirmSource = sourceBetween(
  controllerSource,
  "function confirmAction",
  "async function handleScheduleAction"
);
assert.match(confirmSource, /confirmAction\(title, copy, actionLabel, origin, guard = null\)/);
assert.match(confirmSource, /destroyed[\s\S]*?pendingConfirmation[\s\S]*?!origin\?\.isConnected[\s\S]*?!elements\.schedulerDialog\.open/);
assert.match(confirmSource, /origin\.append\(elements\.inlineConfirm\)/,
  "confirmation must move beside the action being reviewed");
assert.match(
  confirmSource,
  /const controls = \[viewRoot, footerRoot\][\s\S]*?querySelectorAll\("button, input, select"\)[\s\S]*?!elements\.inlineConfirm\.contains\(control\)[\s\S]*?control\.disabled = true/,
  "other controls in the current view and shared footer are inert while confirming"
);
for (const field of [
  "interactionEpoch", "viewEpoch", "view: activeView", "viewerUserId: state.viewerUserId"
]) {
  assert.match(confirmSource, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `inline confirmation snapshot is missing ${field}`);
}
assert.match(confirmSource, /if \(pendingConfirmation === pending\) elements\.confirmCancel\.focus\(\)/,
  "inline confirmation moves focus to its safe Keep action");

const settleConfirmationSource = sourceBetween(
  controllerSource,
  "function settleInlineConfirmation",
  "function setSchedulerView"
);
assert.match(
  settleConfirmationSource,
  /confirmed[\s\S]*?!destroyed[\s\S]*?root\.host\?\.isConnected === true[\s\S]*?activeView === pending\.view[\s\S]*?viewEpoch === pending\.viewEpoch[\s\S]*?interactionEpoch === pending\.interactionEpoch[\s\S]*?state\.viewerUserId === pending\.viewerUserId[\s\S]*?!pending\.guard \|\| pending\.guard\(\)/,
  "acceptance is bound to the connected account, view, interaction, and reviewed origin"
);
assert.match(settleConfirmationSource, /elements\.inlineConfirm\.hidden = true/);
assert.match(settleConfirmationSource, /control\.disabled = disabled/);
assert.match(settleConfirmationSource, /pending\.resolve\(accepted\)/);
assert.match(settleConfirmationSource, /pending\.focusTarget\?\.isConnected[\s\S]*?pending\.focusTarget\.focus\(\)/,
  "Keep, Escape, and completed confirmation restore focus to the initiating control");

assert.match(
  initializeSource,
  /elements\.confirmCancel\.addEventListener\("click",\s*\(event\) => \{[\s\S]*?isTrustedEvent\(event\)[\s\S]*?settleInlineConfirmation\(false\)/,
  "Keep is a trusted inline action"
);
assert.match(
  initializeSource,
  /elements\.confirmAction\.addEventListener\("click",\s*\(event\) => \{[\s\S]*?isTrustedEvent\(event\)[\s\S]*?settleInlineConfirmation\(true\)/,
  "only a trusted inline Remove click can authorize the pending mutation"
);
assert.doesNotMatch(controllerSource, /returnValue|data-confirm-dialog|confirmDialog/,
  "nested-dialog return values cannot authorize destructive work");

// Read races, destination races, revision checks, and countdown updates remain
// bound to the state the user actually reviewed.
assert.match(controllerSource, /let stateLoadSequence = 0/);
assert.match(controllerSource, /const sequence = \+\+stateLoadSequence/);
assert.match(controllerSource, /sequence !== stateLoadSequence/);
assert.match(controllerSource, /let destinationValidationSequence = 0/);
assert.match(controllerSource, /sequence !== destinationValidationSequence/);
assert.equal((controllerSource.match(/expectedRevision:/g) || []).length, 4,
  "Edit snapshots and writes plus Join Now and Remove carry reviewed revisions");
assert.match(controllerSource, /function refreshScheduleCountdowns\(/);
assert.match(controllerSource, /countdown\.setAttribute\("aria-hidden",\s*"true"\)/);
const countdownTimerSource = sourceBetween(
  controllerSource,
  "const countdownTimer = setInterval",
  "async function openScheduler"
);
assert.match(countdownTimerSource, /refreshScheduleCountdowns\(\)/);
assert.doesNotMatch(countdownTimerSource, /renderSchedules\(\)/);

// Content integration opens the isolated-world modal directly and sends only
// normalized public Event metadata. There is no popup/runtime opening bridge.
const openIntegration = sourceBetween(
  contentSource,
  "async function openJoinScheduler",
  "function makeJoinSchedulerSidebarRow"
);
assert.match(openIntegration, /globalThis\[JOIN_SCHEDULER_MODAL_GLOBAL\]/);
assert.match(openIntegration, /modalApi\.open\(draft,\s*button\)/);
assert.doesNotMatch(openIntegration, /chrome\.runtime\.sendMessage|window\.open|chrome\.windows/);

const sidebarSource = sourceBetween(
  contentSource,
  "function makeJoinSchedulerSidebarRow",
  "function placeJoinSchedulerSidebarRow"
);
assert.match(sidebarSource, /setAttribute\("role",\s*"button"\)/);
assert.match(sidebarSource, /setAttribute\("aria-haspopup",\s*"dialog"\)/);
assert.match(sidebarSource, /event\.isTrusted !== true/);
assert.match(sidebarSource, /event\.key !== " "/);

const eventItemSource = sourceBetween(
  contentSource,
  "function renderGameEventItem",
  "function renderGameEventsFilters"
);
assert.match(eventItemSource, /clickEvent\.isTrusted !== true/);
assert.match(eventItemSource, /const status\s*=\s*getGameEventStatus\(event,\s*now\)/);
assert.match(
  eventItemSource,
  /if \(!livePanel && status === "upcoming" && isFeatureEnabled\("joinScheduler"\)\)\s*\{[\s\S]*?setAttribute\(GAME_EVENTS_SCHEDULE_ATTRIBUTE,\s*event\.id\)[\s\S]*?aria-haspopup[\s\S]*?openJoinScheduler\(/,
  "only a future timeline Event exposes a Schedule button that opens the dialog"
);
assert.match(eventItemSource, /openJoinScheduler\(\s*\{[\s\S]*?universeId:\s*event\.universeId[\s\S]*?placeId:\s*event\.placeId[\s\S]*?gameName:\s*event\.gameName[\s\S]*?title:\s*event\.title[\s\S]*?startAt:\s*event\.startAt[\s\S]*?endAt:\s*event\.endAt[\s\S]*?eventId:\s*event\.id/);
assert.doesNotMatch(
  eventItemSource,
  /(?:status === "live"|status === "ended")[^\n{]*\{[\s\S]{0,500}?GAME_EVENTS_SCHEDULE_ATTRIBUTE/,
  "live and ended Events cannot create an already-invalid scheduled draft"
);
assert.doesNotMatch(eventItemSource, /privateServerLinkCode|accessCode|shareCode|canonicalUrl|private-url/i);
assert.match(contentSource, /function cleanupJoinSchedulerFeature\([\s\S]*?modalApi\.destroy\(\)/);
assert.doesNotMatch(contentSource, /rsl:open-join-scheduler/);

// Native Roblox game-detail Events get one independent RoTool action. Card
// identity comes from exact structural selectors and an official Event URL;
// localized action text is never used as data or status.
const nativeEventIntegration = sourceBetween(
  contentSource,
  "function parseNativeEventScheduleGamePagePlaceId",
  "function placeJoinSchedulerSidebarRow"
);
const nativeEventMetadataSource = sourceBetween(
  contentSource,
  "function getNativeEventSchedulePageMetadata",
  "function parseNativeEventScheduleLinkId"
);
assert.match(nativeEventMetadataSource, /querySelector\("#game-detail-page"\)/);
assert.match(nativeEventMetadataSource, /page\?\.dataset\?\.placeId/);
assert.match(nativeEventMetadataSource, /querySelector\("#game-detail-meta-data"\)/);
for (const field of ["placeId", "rootPlaceId", "universeId", "placeName"]) {
  assert.match(nativeEventMetadataSource, new RegExp(`metadata\\.dataset\\?\\.${field}`));
}
assert.match(
  nativeEventIntegration,
  /#game-details-about-tab-container \.virtual-event-game-details-container/
);
assert.match(
  nativeEventIntegration,
  /li\.experience-events-tile\.contained-tile\[data-testid="wide-game-tile"\]\[id\]/
);
const nativeCardIdentitySource = sourceBetween(
  contentSource,
  "function getNativeEventScheduleCardIdentity",
  "function collectNativeEventScheduleCardIdentities"
);
assert.match(nativeCardIdentitySource, /featured\.querySelectorAll\("a\.game-card-link\[href\]"\)/);
assert.match(nativeCardIdentitySource, /links\.length !== 1/);
assert.match(nativeCardIdentitySource, /link\.parentElement !== featured/);
assert.match(nativeCardIdentitySource, /linkId !== cardId/);
assert.match(nativeCardIdentitySource, /\.event-follow-button, \.event-unfollow-button/);
assert.doesNotMatch(nativeEventIntegration, /Notify Me|Join Event/i,
  "native Event eligibility cannot depend on localized Roblox labels");

const nativePlacementSource = sourceBetween(
  contentSource,
  "function placeNativeEventScheduleButton",
  "function makeNativeEventScheduleButton"
);
assert.match(
  nativePlacementSource,
  /identity\.link\.insertAdjacentElement\("afterend", button\)/,
  "the RoTool action must be a direct sibling after the native card link"
);
assert.doesNotMatch(
  nativePlacementSource,
  /(?:nativeAction|link)\.(?:remove|replaceWith|replaceChildren|append|prepend|before|after|addEventListener|removeEventListener|setAttribute|removeAttribute|toggleAttribute|classList|style)|(?:nativeAction|link)\.(?:className|textContent)\s*=/,
  "RoTool must not move, restyle, listen to, or rewrite Roblox's link/action subtree"
);
const nativeButtonSource = sourceBetween(
  contentSource,
  "function makeNativeEventScheduleButton",
  "function reconcileNativeEventScheduleButtons"
);
assert.match(nativeButtonSource, /document\.createElement\("button"\)/);
assert.match(nativeButtonSource, /button\.type = "button"/);
assert.match(
  nativeButtonSource,
  /button\.className = "btn-secondary-xs rsl-native-event-schedule"/,
  "the owned action uses Roblox's compact secondary-control class"
);
assert.match(nativeButtonSource, /button\.textContent = "Schedule with RoTool"/);
assert.match(nativeButtonSource, /setAttribute\("aria-haspopup", "dialog"\)/);
assert.match(nativeButtonSource, /setAttribute\("aria-label", `Schedule \$\{event\.title\} with RoTool`\)/);
assert.match(
  nativeButtonSource,
  /button\.title = "Set a RoTool reminder or automatic join for this event\."/
);
assert.doesNotMatch(
  nativeButtonSource,
  /innerHTML|insertAdjacentHTML|appendChild|replaceChildren/,
  "the owned action keeps a text-only DOM; its calendar is decorative CSS"
);
const trustedClickIndex = nativeButtonSource.indexOf("clickEvent.isTrusted !== true");
const preventClickIndex = nativeButtonSource.indexOf("clickEvent.preventDefault()", trustedClickIndex);
const stopClickIndex = nativeButtonSource.indexOf("clickEvent.stopPropagation()", preventClickIndex);
const currentClickIndex = nativeButtonSource.indexOf(
  "isNativeEventScheduleButtonCurrent(button, event)",
  stopClickIndex
);
const openClickIndex = nativeButtonSource.indexOf("openJoinScheduler(draft, button)", currentClickIndex);
assert.ok(
  trustedClickIndex >= 0 &&
    preventClickIndex > trustedClickIndex &&
    stopClickIndex > preventClickIndex &&
    currentClickIndex > stopClickIndex &&
    openClickIndex > currentClickIndex,
  "only a trusted, still-current future Event click may open Join Scheduler"
);

const nativeReconcileSource = sourceBetween(
  contentSource,
  "function reconcileNativeEventScheduleButtons",
  "async function loadNativeEventScheduleData"
);
assert.match(nativeReconcileSource, /querySelectorAll\(`\[\$\{NATIVE_EVENT_SCHEDULE_ATTRIBUTE\}\]`\)/);
assert.match(nativeReconcileSource, /button\.remove\(\)/);
assert.match(nativeReconcileSource, /existing\.shift\(\) \|\| makeNativeEventScheduleButton/);
assert.match(nativeReconcileSource, /existing\.forEach\(\(duplicate\) => duplicate\.remove\(\)\)/);
const nativeLoadSource = sourceBetween(
  contentSource,
  "async function loadNativeEventScheduleData",
  "function cleanupNativeEventScheduleFeature"
);
assert.match(
  nativeLoadSource,
  /type: NATIVE_EVENT_SCHEDULE_DATA_MESSAGE_TYPE,[\s\S]*?requestId,[\s\S]*?placeId,[\s\S]*?eventIds,[\s\S]*?locale: getRobloxPageLocale\(\)/
);
assert.match(
  nativeLoadSource,
  /lifecycleEpoch !== nativeEventScheduleLifecycleEpoch[\s\S]*?placeId !== nativeEventScheduleRoutePlaceId[\s\S]*?cardFingerprint !== nativeEventScheduleCardFingerprint[\s\S]*?response\?\.requestId !== requestId/,
  "a late response cannot cross a React remount or SPA route identity"
);
assert.match(
  nativeLoadSource,
  /getNativeEventSchedulePageMetadata\(placeId\)[\s\S]*?currentMetadata\.universeId !== expectedUniverseId/
);
const nativeMountSource = sourceBetween(
  contentSource,
  "function mountNativeEventScheduleButtons",
  "function placeJoinSchedulerSidebarRow"
);
assert.match(nativeMountSource, /!isFeatureEnabled\("joinScheduler"\)/);
assert.doesNotMatch(nativeMountSource, /isFeatureEnabled\("gameEvents"\)/,
  "the Scheduler integration remains independent from the optional Events dashboard");
assert.match(nativeMountSource, /getNativeEventSchedulePageMetadata\(placeId\)/);
assert.match(nativeMountSource, /`\$\{placeId\}:\$\{metadata\.universeId\}:\$\{eventIds\.join\(","\)\}`/);
assert.match(nativeMountSource, /nativeEventScheduleLifecycleEpoch \+= 1/);
assert.match(nativeMountSource, /removeNativeEventScheduleButtons\(\)/);
assert.match(nativeMountSource, /Date\.now\(\) >= nativeEventScheduleNextRefreshAt/);
const nativeCleanupSource = sourceBetween(
  contentSource,
  "function cleanupNativeEventScheduleFeature",
  "function mountNativeEventScheduleButtons"
);
assert.match(nativeCleanupSource, /nativeEventScheduleItemsById = new Map\(\)/);
assert.match(nativeCleanupSource, /clearNativeEventScheduleBoundaryTimer\(\)/);
assert.match(nativeCleanupSource, /clearNativeEventScheduleRefreshTimer\(\)/);
assert.match(nativeCleanupSource, /removeNativeEventScheduleButtons\(\)/);
assert.match(contentSource, /function cleanupJoinSchedulerFeature\([\s\S]*?cleanupNativeEventScheduleFeature\(\)/);
assert.match(contentSource, /function mountExtensionFeatures\(\)[\s\S]*?mountNativeEventScheduleButtons\(\)/);

const nativeEventStylesStart = siteStyles.indexOf(
  "/* An official Roblox event stays the source of truth."
);
const nativeEventStylesEnd = siteStyles.indexOf(
  "/* The sidebar rows themselves inherit Roblox's cloned classes and styles. */",
  nativeEventStylesStart
);
assert.ok(nativeEventStylesStart >= 0 && nativeEventStylesEnd > nativeEventStylesStart);
const nativeEventStyles = siteStyles.slice(nativeEventStylesStart, nativeEventStylesEnd);
const ownedEventDirectSibling =
  />\s*a\.game-card-link\s*\+\s*button\[data-rsl-native-event-schedule\]/;
assert.match(nativeEventStyles, ownedEventDirectSibling,
  "layout activation requires the owned action to be the anchor's direct sibling");
assert.match(nativeEventStyles, /\.game-details-page-events-grid:has\([\s\S]*?>\s*a\.game-card-link\s*\+\s*button\[data-rsl-native-event-schedule\][\s\S]*?\)\s*\{[\s\S]*?grid-auto-rows:\s*auto\s*!important[\s\S]*?\}/);
const verifiedEventCardSelectorSource = String.raw`li\.experience-events-tile\.contained-tile\[data-testid="wide-game-tile"\]:has\(\s*>\s*\.featured-game-container\.game-card-container\s*>\s*a\.game-card-link\s*\+\s*button\[data-rsl-native-event-schedule\]\s*\)`;
const affectedCardAutoHeightRule = nativeEventStyles.match(new RegExp(
  `${verifiedEventCardSelectorSource}\\s*,[\\s\\S]*?${verifiedEventCardSelectorSource}` +
    String.raw`\s*>\s*\.featured-game-container\.game-card-container\s*\{([^}]*)\}`
));
assert.ok(affectedCardAutoHeightRule,
  "only the verified card and its direct featured surface receive the height override");
for (const declaration of [
  /height:\s*auto\s*!important/,
  /max-height:\s*none\s*!important/,
  /overflow:\s*visible\s*!important/
]) {
  assert.match(affectedCardAutoHeightRule[1], declaration);
}
assert.match(
  nativeEventStyles,
  new RegExp(
    `${verifiedEventCardSelectorSource}\\s*>\\s*\\.featured-game-container\\.game-card-container\\s*\\{` +
      String.raw`[^}]*background-color:\s*var\(--color-surface-300\)\s*!important` +
      String.raw`[^}]*border-radius:\s*8px\s*!important[^}]*\}`
  ),
  "the footer margin stays inside one continuous rounded Roblox card surface"
);
assert.match(nativeEventStyles, /button\.btn-secondary-xs\[data-rsl-native-event-schedule\]\s*\{[\s\S]*?display:\s*inline-flex\s*!important[\s\S]*?width:\s*calc\(100% - 24px\)\s*!important[\s\S]*?min-height:\s*28px\s*!important[\s\S]*?margin:\s*0 12px 12px\s*!important[\s\S]*?white-space:\s*nowrap\s*!important/);
assert.match(nativeEventStyles, /button\.btn-secondary-xs\[data-rsl-native-event-schedule\]:focus-visible[\s\S]*?outline:\s*2px[\s\S]*?outline-offset:\s*2px/);
assert.match(nativeEventStyles, /button\.btn-secondary-xs\[data-rsl-native-event-schedule\]:disabled[\s\S]*?cursor:\s*wait\s*!important[\s\S]*?opacity:/);
assert.match(nativeEventStyles, /@media\s*\(max-width:\s*480px\)[\s\S]*?button\.btn-secondary-xs\[data-rsl-native-event-schedule\][\s\S]*?min-height:\s*44px\s*!important/);
assert.match(nativeEventStyles, /@media\s*\(forced-colors:\s*active\)[\s\S]*?ButtonText/);
assert.doesNotMatch(
  nativeEventStyles,
  /::(?:before|after)|grid-template-columns|height:\s*100%|overflow:\s*hidden|background(?:-color)?:\s*transparent|(?:align-items|align-self):\s*stretch|(?:align|justify)-content:\s*space-(?:between|around|evenly)|position:|transform:|margin(?:-(?:top|right|bottom|left|block(?:-start|-end)?|inline(?:-start|-end)?))?:\s*(?:auto\b|[^;]*-\d)|a\.game-card-link\s*\{|\.base-metadata\s*\{|\.event-(?:follow|unfollow)-button|\.wide-event-play-button/,
  "the unified footer must stay in unclipped natural flow without a transparent gap, overlay, nesting, or native-descendant styling"
);

// Exported hooks make the pure input boundary and stable content API testable.
globalThis.__rslJoinSchedulerTestHooks = { skipInitialize: true };
require(path.join(projectRoot, "join-scheduler.js"));
const hooks = globalThis.__rslJoinSchedulerTestHooks;
for (const name of [
  "initialize", "loadModalAssets", "openJoinSchedulerModal",
  "destroyJoinSchedulerModal", "handleShowMessage", "parseOwnedTemplate",
  "normalizeSchedulerDraft", "normalizeGameIcon", "bindHelpTips"
]) {
  assert.equal(typeof hooks[name], "function", `missing ${name} test hook`);
}
assert.deepEqual(hooks.modalConstants, {
  hostId: "rsl-join-scheduler-host",
  templatePath: "join-scheduler.html",
  stylePath: "join-scheduler.css",
  showMessageType: "rsl:show-join-scheduler",
  privateUrlMaxLength: 2_048
});
assert.equal(hooks.timeoutContract.readOnlyOperations.includes("get-game-icons"), true);
const normalizedGameIcon = hooks.normalizeGameIcon({
  universeId: "2001",
  thumbnailUrl: "https://images.rbxcdn.com/game.png?size=150"
});
assert.deepEqual(normalizedGameIcon, {
  universeId: "2001",
  thumbnailUrl: "https://images.rbxcdn.com/game.png?size=150"
});
assert.equal(Object.isFrozen(normalizedGameIcon), true);
for (const invalidIcon of [
  null,
  [],
  { universeId: "0", thumbnailUrl: "https://images.rbxcdn.com/game.png" },
  { universeId: 2001, thumbnailUrl: "https://images.rbxcdn.com/game.png" },
  { universeId: "2001", thumbnailUrl: "http://images.rbxcdn.com/game.png" },
  { universeId: "2001", thumbnailUrl: "https://user@images.rbxcdn.com/game.png" },
  { universeId: "2001", thumbnailUrl: "https://images.rbxcdn.com:444/game.png" },
  { universeId: "2001", thumbnailUrl: "https://images.rbxcdn.com/game.png#fragment" },
  { universeId: "2001", thumbnailUrl: "https://rbxcdn.com.evil.test/game.png" },
  { universeId: "2001", thumbnailUrl: `https://images.rbxcdn.com/${"x".repeat(2_100)}` },
  {
    universeId: "2001",
    thumbnailUrl: "https://images.rbxcdn.com/game.png",
    privateServerLinkCode: "must-not-survive"
  }
]) {
  assert.equal(hooks.normalizeGameIcon(invalidIcon), null);
}
assert.deepEqual(Object.keys(globalThis.__rslJoinSchedulerModal).sort(), [
  "close", "destroy", "isOpen", "open"
]);
const validDraft = {
  universeId: "2001",
  placeId: "1001",
  gameName: "Fixture Game",
  title: "Fixture Event",
  startAt: Date.now() + 3_600_000,
  endAt: Date.now() + 7_200_000,
  eventId: "123e4567-e89b-42d3-a456-426614174000",
  privateServerLinkCode: "must-not-survive"
};
const normalizedDraft = hooks.normalizeSchedulerDraft(validDraft);
assert.deepEqual(normalizedDraft, {
  universeId: validDraft.universeId,
  placeId: validDraft.placeId,
  gameName: validDraft.gameName,
  title: validDraft.title,
  startAt: validDraft.startAt,
  endAt: validDraft.endAt,
  eventId: validDraft.eventId
});
assert.equal(Object.isFrozen(normalizedDraft), true);
const normalizeSchedulerDraft = hooks.normalizeSchedulerDraft;
const numericEventDraft = hooks.normalizeSchedulerDraft({
  ...validDraft,
  eventId: "1234567890123456789012345678901234567890"
});
assert.equal(numericEventDraft?.eventId, "1234567890123456789012345678901234567890",
  "real Roblox numeric Event IDs up to 40 digits must open the Scheduler");
for (const invalidDraft of [
  null,
  { ...validDraft, universeId: "0" },
  { ...validDraft, placeId: "1.5" },
  { ...validDraft, startAt: Date.now() - 1 },
  { ...validDraft, endAt: validDraft.startAt },
  { ...validDraft, eventId: "not-an-event-id" },
  { ...validDraft, eventId: "1".repeat(41) }
]) {
  assert.equal(hooks.normalizeSchedulerDraft(invalidDraft), null);
}
delete globalThis.__rslJoinSchedulerModal;
delete globalThis.__rslJoinSchedulerTestHooks;

globalThis.__rslContentTestHooks = { skipInitialize: true };
require(path.join(projectRoot, "content.js"));
const contentHooks = globalThis.__rslContentTestHooks;
const eventFixtureNow = Date.now();
const normalizedGameEvent = contentHooks.normalizeGameEvent({
  id: "8675309",
  universeId: "2001",
  placeId: "1001",
  gameName: "Fixture Game",
  title: "Fixture Event",
  subtitle: "A real normalized Roblox Event",
  startAt: eventFixtureNow + 3_600_000,
  endAt: eventFixtureNow + 7_200_000
}, eventFixtureNow);
assert.ok(normalizedGameEvent, "the Game Events boundary must accept its numeric ID fixture");
const normalizedGameEventDraft = normalizeSchedulerDraft({
  universeId: normalizedGameEvent.universeId,
  placeId: normalizedGameEvent.placeId,
  gameName: normalizedGameEvent.gameName,
  title: normalizedGameEvent.title,
  startAt: normalizedGameEvent.startAt,
  endAt: normalizedGameEvent.endAt,
  eventId: normalizedGameEvent.id
});
assert.deepEqual(normalizedGameEventDraft, {
  universeId: normalizedGameEvent.universeId,
  placeId: normalizedGameEvent.placeId,
  gameName: normalizedGameEvent.gameName,
  title: normalizedGameEvent.title,
  startAt: normalizedGameEvent.startAt,
  endAt: normalizedGameEvent.endAt,
  eventId: normalizedGameEvent.id
}, "an actual normalized upcoming Game Event must survive the Scheduler draft boundary");
assert.equal(contentHooks.defaultFeatureSettings.joinScheduler, true);
assert.equal(contentHooks.defaultFeatureSettings.sidebarJoinScheduler, true);
assert.deepEqual(contentHooks.joinSchedulerConstants, {
  rowId: "rsl-join-scheduler-row",
  modalGlobal: "__rslJoinSchedulerModal",
  gameEventScheduleAttribute: "data-rsl-game-events-schedule"
});
const sidebarKeys = contentHooks.featureDefinitions
  .find(({ key }) => key === "sidebarShortcuts")
  .children.map(({ key }) => key);
assert.ok(
  sidebarKeys.indexOf("sidebarGameEvents") < sidebarKeys.indexOf("sidebarJoinScheduler") &&
    sidebarKeys.indexOf("sidebarJoinScheduler") < sidebarKeys.indexOf("sidebarServerHistory"),
  "the sidebar order is Events, Join Scheduler, then History"
);

const nativeConstants = contentHooks.nativeEventScheduleConstants;
assert.deepEqual(nativeConstants, {
  attribute: "data-rsl-native-event-schedule",
  dataMessageType: "rsl:get-native-event-schedule-data",
  cardSelector:
    '#game-details-about-tab-container .virtual-event-game-details-container ' +
    'li.experience-events-tile.contained-tile[data-testid="wide-game-tile"][id]',
  featuredSelector: ".featured-game-container.game-card-container",
  maxEventIds: 50,
  localeSegments: [
    "de", "en", "en-us", "es", "fr", "id", "it", "ja", "ko", "pl",
    "pt", "pt-br", "ru", "th", "tr", "vi", "zh-cn", "zh-tw"
  ],
  refreshMs: 10 * 60_000,
  failureRetryMs: 60_000
});

for (const url of [
  "https://www.roblox.com/games/1001",
  "https://www.roblox.com/games/1001/fixture-game/",
  "https://www.roblox.com/de/games/1001/fixture-game",
  "https://www.roblox.com/en-us/games/1001/fixture-game?tab=about#events",
  "https://www.roblox.com/PT-BR/games/1001/fixture-game"
]) {
  assert.equal(
    contentHooks.parseNativeEventScheduleGamePagePlaceId(url),
    "1001",
    `expected a strict Roblox game route: ${url}`
  );
}
for (const url of [
  "http://www.roblox.com/games/1001/fixture",
  "https://roblox.com/games/1001/fixture",
  "https://www.roblox.com.evil.test/games/1001/fixture",
  "https://user:pass@www.roblox.com/games/1001/fixture",
  "https://www.roblox.com:444/games/1001/fixture",
  "https://www.roblox.com/xx/games/1001/fixture",
  "https://www.roblox.com/de-de/games/1001/fixture",
  "https://www.roblox.com/de/games/1001/fixture/extra",
  "https://www.roblox.com/games/0/fixture",
  "https://www.roblox.com/games/01/fixture",
  "https://www.roblox.com/games/1001//",
  "https://www.roblox.com/catalog/1001"
]) {
  assert.equal(
    contentHooks.parseNativeEventScheduleGamePagePlaceId(url),
    null,
    `rejected lookalike game route: ${url}`
  );
}

const previousDocument = globalThis.document;
try {
  const page = { dataset: { placeId: "1001" } };
  const metadata = {
    dataset: {
      placeId: "1001",
      rootPlaceId: "1001",
      universeId: "2001",
      placeName: "  Fixture\n Game  "
    }
  };
  globalThis.document = {
    querySelector(selector) {
      if (selector === "#game-detail-page") return page;
      if (selector === "#game-detail-meta-data") return metadata;
      return null;
    }
  };
  const normalizedMetadata = contentHooks.getNativeEventSchedulePageMetadata("1001");
  assert.deepEqual(normalizedMetadata, {
    placeId: "1001",
    rootPlaceId: "1001",
    universeId: "2001",
    gameName: "Fixture Game"
  });
  assert.equal(Object.isFrozen(normalizedMetadata), true);
  page.dataset.placeId = "9999";
  assert.equal(contentHooks.getNativeEventSchedulePageMetadata("1001"), null,
    "the visible game shell must agree with the URL place");
  page.dataset.placeId = "1001";
  metadata.dataset.universeId = "0";
  assert.equal(contentHooks.getNativeEventSchedulePageMetadata("1001"), null,
    "malformed metadata cannot authorize an Event request");
} finally {
  if (previousDocument === undefined) delete globalThis.document;
  else globalThis.document = previousDocument;
}

function hrefFixture(href) {
  return { getAttribute(name) { return name === "href" ? href : null; } };
}
const UUID_EVENT_ID = "123e4567-e89b-42d3-a456-426614174000";
const NUMERIC_EVENT_ID = "1234567890123456789012345678901234567890";
assert.equal(
  contentHooks.parseNativeEventScheduleLinkId(hrefFixture(`/events/${NUMERIC_EVENT_ID}`)),
  NUMERIC_EVENT_ID
);
assert.equal(
  contentHooks.parseNativeEventScheduleLinkId(
    hrefFixture(`https://www.roblox.com/events/${UUID_EVENT_ID.toUpperCase()}/`)
  ),
  UUID_EVENT_ID
);
for (const href of [
  `/de/events/${NUMERIC_EVENT_ID}`,
  `/PT-BR/events/${UUID_EVENT_ID.toUpperCase()}/`,
  `https://www.roblox.com/de/events/${NUMERIC_EVENT_ID}`,
  `https://www.roblox.com/EN-US/events/${UUID_EVENT_ID}`
]) {
  assert.equal(
    contentHooks.parseNativeEventScheduleLinkId(hrefFixture(href)),
    href.includes(NUMERIC_EVENT_ID) ? NUMERIC_EVENT_ID : UUID_EVENT_ID,
    `accepted localized Event link: ${href}`
  );
}
for (const href of [
  "/events/",
  "/events/not-an-id",
  `/events/${"1".repeat(41)}`,
  `/events/${NUMERIC_EVENT_ID}/extra`,
  `/events/${NUMERIC_EVENT_ID}?from=game`,
  `/events/${NUMERIC_EVENT_ID}#details`,
  `/xx/events/${NUMERIC_EVENT_ID}`,
  `/de-de/events/${NUMERIC_EVENT_ID}`,
  `/de/en/events/${NUMERIC_EVENT_ID}`,
  `/de/events/${NUMERIC_EVENT_ID}/extra`,
  `/de/events/${NUMERIC_EVENT_ID}?from=game`,
  `/de/events/${NUMERIC_EVENT_ID}#details`,
  `https://roblox.com/events/${NUMERIC_EVENT_ID}`,
  `https://www.roblox.com.evil.test/events/${NUMERIC_EVENT_ID}`,
  `https://www.roblox.com:444/events/${NUMERIC_EVENT_ID}`
]) {
  assert.equal(contentHooks.parseNativeEventScheduleLinkId(hrefFixture(href)), null,
    `rejected Event-link lookalike: ${href}`);
}

function makeNativeCardFixture({
  cardId = NUMERIC_EVENT_ID,
  href = `/events/${cardId}`,
  linkCount = 1,
  directLink = true,
  hasNativeFollowAction = true,
  insideRegion = true,
  matchesCard = true
} = {}) {
  const card = {};
  const featured = {};
  const region = {};
  const makeLink = () => ({
    ...hrefFixture(href),
    parentElement: directLink ? featured : {},
    closest(selector) { return selector === "li" ? card : null; }
  });
  const links = Array.from({ length: linkCount }, makeLink);
  const nativeAction = hasNativeFollowAction
    ? { closest(selector) { return selector === "li" ? card : null; } }
    : null;
  card.id = cardId;
  card.matches = () => matchesCard;
  card.closest = () => insideRegion ? region : null;
  card.querySelector = (selector) =>
    selector === nativeConstants.featuredSelector ? featured : null;
  featured.closest = (selector) => selector === "li" ? card : null;
  featured.querySelectorAll = (selector) =>
    selector === "a.game-card-link[href]" ? links : [];
  featured.querySelector = () => nativeAction;
  return { card, featured, links, nativeAction };
}

const numericCard = makeNativeCardFixture();
const numericIdentity = contentHooks.getNativeEventScheduleCardIdentity(numericCard.card);
assert.equal(numericIdentity.id, NUMERIC_EVENT_ID);
assert.equal(numericIdentity.card, numericCard.card);
assert.equal(numericIdentity.link, numericCard.links[0]);
assert.equal(Object.isFrozen(numericIdentity), true);
const uuidCard = makeNativeCardFixture({
  cardId: UUID_EVENT_ID.toUpperCase(),
  href: `/events/${UUID_EVENT_ID}`
});
assert.equal(contentHooks.getNativeEventScheduleCardIdentity(uuidCard.card).id, UUID_EVENT_ID);
for (const fixture of [
  makeNativeCardFixture({ href: "/events/999" }),
  makeNativeCardFixture({ linkCount: 2 }),
  makeNativeCardFixture({ directLink: false }),
  makeNativeCardFixture({ insideRegion: false }),
  makeNativeCardFixture({ matchesCard: false }),
  makeNativeCardFixture({ hasNativeFollowAction: false }),
  makeNativeCardFixture({ href: "/events" })
]) {
  assert.equal(contentHooks.getNativeEventScheduleCardIdentity(fixture.card), null);
}

const nativeNow = Date.now();
const rawNativeEvent = (id, overrides = {}) => ({
  id,
  universeId: "2001",
  placeId: "1001",
  gameName: "Fixture Game",
  title: `Event ${id}`,
  startAt: nativeNow + 60_000,
  endAt: nativeNow + 120_000,
  status: "upcoming",
  ...overrides
});
const requestedNativeIds = Object.freeze([
  NUMERIC_EVENT_ID,
  UUID_EVENT_ID,
  "777",
  "778",
  "779",
  "780",
  "781"
]);
const normalizedNativeResponse = contentHooks.normalizeNativeEventScheduleResponse({
  ok: true,
  enabled: true,
  placeId: "1001",
  universeId: "2001",
  checkedAt: nativeNow,
  events: [
    rawNativeEvent(NUMERIC_EVENT_ID, { privateServerLinkCode: "must-not-survive" }),
    rawNativeEvent(UUID_EVENT_ID, { startAt: nativeNow + 90_000, endAt: nativeNow + 180_000 }),
    rawNativeEvent(NUMERIC_EVENT_ID, { title: "Duplicate" }),
    rawNativeEvent("777", { startAt: nativeNow - 1, endAt: nativeNow + 60_000 }),
    rawNativeEvent("778", { endAt: nativeNow + 60_000 }),
    rawNativeEvent("779", { universeId: "9999" }),
    rawNativeEvent("781", { status: "live" }),
    rawNativeEvent("999")
  ]
}, "1001", "2001", requestedNativeIds, nativeNow);
assert.ok(normalizedNativeResponse);
assert.equal(Object.isFrozen(normalizedNativeResponse), true);
assert.equal(Object.isFrozen(normalizedNativeResponse.events), true);
assert.deepEqual(
  normalizedNativeResponse.events.map(({ id }) => id),
  [NUMERIC_EVENT_ID, UUID_EVENT_ID],
  "only requested, uniquely matched, still-future official Events survive"
);
assert.ok(normalizedNativeResponse.events.every((event) =>
  event.status === "upcoming" && event.startAt > nativeNow
));
for (const invalidResponse of [
  { ...normalizedNativeResponse, ok: false },
  { ...normalizedNativeResponse, enabled: false },
  { ...normalizedNativeResponse, placeId: "9999" },
  { ...normalizedNativeResponse, universeId: "9999" },
  { ...normalizedNativeResponse, checkedAt: 0 }
]) {
  assert.equal(
    contentHooks.normalizeNativeEventScheduleResponse(
      invalidResponse,
      "1001",
      "2001",
      requestedNativeIds,
      nativeNow
    ),
    null
  );
}
const nativeDraft = contentHooks.makeNativeEventScheduleDraft(
  normalizedNativeResponse.events[0]
);
assert.deepEqual(nativeDraft, {
  universeId: "2001",
  placeId: "1001",
  gameName: "Fixture Game",
  title: `Event ${NUMERIC_EVENT_ID}`,
  startAt: nativeNow + 60_000,
  endAt: nativeNow + 120_000,
  eventId: NUMERIC_EVENT_ID
});
assert.deepEqual(Object.keys(nativeDraft).sort(), [
  "endAt", "eventId", "gameName", "placeId", "startAt", "title", "universeId"
]);
assert.equal(Object.isFrozen(nativeDraft), true);
assert.equal(Object.hasOwn(nativeDraft, "privateServerLinkCode"), false);
delete globalThis.__rslContentTestHooks;

// The Scheduler is a closed-shadow component, but its visual language is the
// existing RoTool Settings dialog. Keep the shared class/markup contract here
// so a standalone custom theme cannot silently return.
const settingsDialogSource = sourceBetween(
  contentSource,
  "function createFeatureSettingsDialog()",
  "function openFeatureSettingsDialog"
);
assert.match(settingsDialogSource, /rsl-dialog rsl-feature-settings-dialog/);
assert.match(settingsDialogSource, /rsl-dialog__surface rsl-feature-settings-dialog__surface/);
assert.match(settingsDialogSource, /rsl-dialog__body rsl-feature-settings-dialog__body/);
assert.match(settingsDialogSource, /rsl-feature-settings__title-row/);
assert.match(settingsDialogSource, /rsl-feature-settings__groups/);
assert.match(settingsDialogSource, /rsl-dialog__actions rsl-feature-settings__footer/);

assert.match(tagWith("data-scheduler-dialog"), /class="[^"]*\brsl-dialog\b/i,
  "the one outer element uses the RoTool Settings dialog shell");
assert.equal(
  (template.match(/\brsl-dialog__surface\b/g) || []).length,
  1,
  "list, editor, and inline confirmation stay on one Settings surface"
);
assert.equal(
  (template.match(/\brsl-feature-settings-dialog__surface\b/g) || []).length,
  1,
  "the Scheduler has one shared Medium Settings surface"
);
assert.equal(
  (template.match(/\bdata-size="Medium"/g) || []).length,
  1,
  "the shared surface declares its size only once"
);
for (const className of [
  "rsl-dialog__close-container",
  "rsl-icon-button",
  "rsl-dialog__close-icon",
  "rsl-dialog__body",
  "rsl-feature-settings-dialog__body",
  "rsl-feature-settings__title-row",
  "rsl-feature-settings__logo",
  "rsl-dialog__header",
  "rsl-feature-settings__groups",
  "rsl-feature-settings__group",
  "rsl-feature-settings__group-title",
  "rsl-feature-settings__list",
  "rsl-dialog__actions",
  "rsl-feature-settings__footer",
  "rsl-button",
  "rsl-button--primary",
  "rsl-button--secondary"
]) {
  assert.match(template, new RegExp(`\\b${className}\\b`),
    `Scheduler markup is missing the Settings class ${className}`);
}
assert.doesNotMatch(template, /\bscheduler-eyebrow\b|\beyebrow\b/i,
  "Settings has no custom RoTool eyebrow above its title");

const staticButtons = Array.from(template.matchAll(/<button\b[^>]*>/gi), (match) => match[0]);
for (const button of staticButtons) {
  assert.match(button, /class="[^"]*\brsl-(?:button|icon-button)\b/i,
    "every static button uses a Settings button class");
}
assert.match(initializeSource, /function decorateFoundationButton\(/);
assert.match(initializeSource, /data-testid["'],\s*["']foundation-web-state-layer/);
assert.match(initializeSource, /data-rsl-button-label/);
assert.match(initializeSource, /queryAll\("button"\)\.forEach\(\(button\) => decorateFoundationButton\(button\)\)/,
  "every static button receives the Settings state-layer and label structure");
assert.match(initializeSource, /return decorateFoundationButton\(button,\s*label\)/,
  "dynamically generated schedule actions receive the Settings button structure");

// Shared primitives use the same visual tokens and core geometry as Settings.
// Scheduler-only layout declarations remain free to support schedule cards and
// the editor without creating a second visual system.
for (const [schedulerSelector, settingsSelector, properties] of [
  [".rsl-dialog", ".rsl-dialog", [
    "--rsl-fallback-surface", "--rsl-fallback-raised", "--rsl-fallback-content",
    "--rsl-fallback-default", "--rsl-fallback-muted", "--rsl-fallback-stroke",
    "position", "inset", "width", "max-width", "height", "max-height", "margin",
    "padding", "overflow", "color", "background", "border", "font"
  ]],
  [".rsl-dialog::backdrop", ".rsl-dialog::backdrop", ["background"]],
  [".rsl-dialog__surface", ".rsl-dialog__surface", [
    "position", "overflow", "color", "background", "border", "border-radius", "box-shadow"
  ]],
  [".rsl-dialog__close-container", ".rsl-dialog__close-container", [
    "position", "top", "right", "z-index"
  ]],
  [".rsl-dialog__body", ".rsl-dialog__body", [
    "min-height", "padding", "overflow", "overscroll-behavior"
  ]],
  [".rsl-dialog__header", ".rsl-dialog__header", ["gap", "padding-right"]],
  [".rsl-icon-button", ".rsl-icon-button", [
    "width", "height", "padding", "color", "background", "border", "border-radius"
  ]],
  [".rsl-dialog__close-icon", ".rsl-dialog__close-icon", ["width", "height"]],
  [".rsl-dialog__actions", ".rsl-dialog__actions", [
    "padding", "justify-content", "gap", "background"
  ]],
  [".rsl-button", ".rsl-button", [
    "min-height", "padding", "color", "border", "border-radius", "font", "font-weight"
  ]],
  [".rsl-button--primary", ".rsl-button--primary", ["color", "background", "border-color"]],
  [".rsl-button--secondary", ".rsl-button--secondary", ["color", "background", "border-color"]],
  [".rsl-button--danger", ".rsl-button--danger", ["color", "background", "border-color"]],
  [".text-input", ".rsl-field input", [
    "min-height", "padding", "color", "background", "border", "border-radius", "outline", "font"
  ]],
  [".text-input::placeholder", ".rsl-field input::placeholder", ["color"]],
  [".text-input:focus", ".rsl-field input:focus", ["border-color", "box-shadow"]],
  ['.rsl-dialog .rsl-feature-settings-dialog__surface[data-size="Medium"]',
    '.rsl-dialog .rsl-feature-settings-dialog__surface[data-size="Medium"]',
    ["width", "max-width", "max-height", "overflow"]],
  [".rsl-feature-settings-dialog__body", ".rsl-feature-settings-dialog__body", ["min-height", "overflow"]],
  [".rsl-feature-settings__title-row", ".rsl-feature-settings__title-row", [
    "align-items", "gap", "padding-right"
  ]],
  [".rsl-feature-settings__logo", ".rsl-feature-settings__logo", ["width", "height"]],
  [".rsl-feature-settings__groups", ".rsl-feature-settings__groups", ["gap", "margin-top"]],
  [".rsl-feature-settings__group-title", ".rsl-feature-settings__group-title", ["margin", "color"]],
  [".rsl-feature-settings__list", ".rsl-feature-settings__list", [
    "overflow", "background", "border", "border-radius"
  ]],
  [".rsl-feature-settings__footer", ".rsl-feature-settings__footer", [
    "align-items", "justify-content", "padding", "border-top"
  ]]
]) {
  assertSharedCssProperties(schedulerSelector, settingsSelector, properties);
}
assertSharedCssProperties(
  ':host([data-theme="light"]) .rsl-dialog',
  ".light-theme .rsl-dialog",
  [
    "--rsl-fallback-surface", "--rsl-fallback-raised", "--rsl-fallback-content",
    "--rsl-fallback-default", "--rsl-fallback-muted", "--rsl-fallback-stroke"
  ]
);

const hostDeclarations = cssDeclarations(shadowStyles, ":host");
assert.equal(hostDeclarations.all, "initial");
assert.equal(hostDeclarations.font, "inherit");
assert.equal(hostDeclarations.color, "inherit");
assert.equal(hostDeclarations["font-family"], undefined,
  "Scheduler typography inherits Roblox just like Settings");

// The button remains a 24px native target. Its 16px slot either renders the
// exact light-DOM Quick Settings wrapper/sprite or the empty CSS fallback.
const helpButtonDeclarations = cssDeclarations(shadowStyles, ".scheduler-help__button");
assert.equal(helpButtonDeclarations.display, "inline-flex");
assert.equal(helpButtonDeclarations.width, "24px");
assert.equal(helpButtonDeclarations["min-width"], "24px");
assert.equal(helpButtonDeclarations.height, "24px");
assert.equal(helpButtonDeclarations.cursor, "help");
const helpIconDeclarations = cssDeclarations(shadowStyles, ".scheduler-help__icon");
assert.equal(helpIconDeclarations.position, "relative");
assert.equal(helpIconDeclarations.display, "inline-flex");
assert.equal(helpIconDeclarations.width, "16px");
assert.equal(helpIconDeclarations.height, "16px");
assert.equal(helpIconDeclarations.flex, "0 0 16px");
const slottedQuickSettingsDeclarations = cssDeclarations(
  shadowStyles,
  ".scheduler-help__icon > slot::slotted(.rsl-quick-setting-info)"
);
for (const property of ["width", "min-width", "height", "flex"]) {
  assert.equal(
    slottedQuickSettingsDeclarations[property].replace(/\s*!important\s*$/i, ""),
    cssDeclarations(siteStyles, ".rsl-quick-setting-info")[property],
    `the slotted Quick Settings wrapper must preserve its ${property}`
  );
}
assert.equal(slottedQuickSettingsDeclarations.margin, "0 !important");
assert.equal(slottedQuickSettingsDeclarations["pointer-events"], "none !important");
const nativeQuickSettingsIconDeclarations = cssDeclarations(
  siteStyles,
  ".rsl-quick-setting-info > .icon-moreinfo-16x16"
);
assert.equal(nativeQuickSettingsIconDeclarations.width, "16px");
assert.equal(nativeQuickSettingsIconDeclarations.height, "16px");
assert.equal(nativeQuickSettingsIconDeclarations.flex, "0 0 16px");
assert.equal(nativeQuickSettingsIconDeclarations.margin, "0");
assert.equal(nativeQuickSettingsIconDeclarations["background-position"], "0 -160px !important",
  "the slotted child must receive Quick Settings' real sprite frame");
const helpFallbackDeclarations = cssDeclarations(shadowStyles, ".scheduler-help__icon-fallback");
assert.equal(helpFallbackDeclarations.position, "absolute");
assert.equal(helpFallbackDeclarations.inset, "1px");
assert.equal(helpFallbackDeclarations.display, "grid");
assert.equal(helpFallbackDeclarations["place-items"], "center");
assert.equal(helpFallbackDeclarations["border-radius"], "50%");
assert.equal(helpFallbackDeclarations["line-height"], "1");
assert.equal(
  cssDeclarations(shadowStyles, ".scheduler-help__icon-fallback::before").content,
  '"?"',
  "when Roblox has no sprite, the empty slot must still have a deterministic non-resource fallback"
);
const helpCopyDeclarations = cssDeclarations(shadowStyles, ".scheduler-help__copy");
assert.equal(helpCopyDeclarations.position, "fixed",
  "tooltips inside the scrolling editor must use viewport positioning");
assert.equal(helpCopyDeclarations.top, "0");
assert.equal(helpCopyDeclarations.left, "0");
assert.equal(helpCopyDeclarations.width, "280px");
assert.match(helpCopyDeclarations["max-width"], /calc\(100vw - 32px\)/);
assert.ok(Number(helpCopyDeclarations["z-index"]) > 2,
  "help copy must layer above the Settings close affordance");
assert.equal(
  cssDeclarations(shadowStyles, ".scheduler-help__copy[hidden]").display,
  "none !important"
);
const helpFocusDeclarations = cssDeclarations(
  shadowStyles,
  ".scheduler-help__button:focus-visible"
);
assert.match(helpFocusDeclarations.outline, /^2px solid /);
assert.equal(helpFocusDeclarations["outline-offset"], "1px");

assert.doesNotMatch(shadowStyles, /\b(?:linear|radial|conic)-gradient\s*\(/i,
  "Settings does not use Scheduler-only gradients");
assert.doesNotMatch(shadowStyles, /\bbackdrop-filter\s*:/i,
  "Settings uses its normal backdrop token without a Scheduler-only blur");
assert.doesNotMatch(
  shadowStyles,
  /--(?:page|surface|surface-raised|surface-hover|border|border-strong|text|text-muted|text-faint|accent|accent-hover|accent-soft|success|success-soft|warning|warning-soft|danger|danger-hover|focus|shadow)\s*:/,
  "the retired Scheduler palette cannot coexist with Settings tokens"
);
assert.doesNotMatch(
  shadowStyles,
  /#0f1013|#202329|#292d35|#353943|#484e5b|#f4f5f7|#aeb3bf|#858b98|#4770ff|rgba\(51,\s*95,\s*255/i,
  "old Scheduler theme colors cannot leak into the Settings visual language"
);
assert.doesNotMatch(shadowStyles, /height:\s*calc\(100dvh - 12px\)/,
  "Scheduler-specific breakpoints cannot restore the old fixed-height shell");
assert.doesNotMatch(shadowStyles, /data-action=["']refresh["']/i,
  "removed Refresh UI must not leave layout-only CSS behind");

// The stylesheet remains shadow-scoped, responsive, keyboard-visible, and
// does not pull any page-relative resources into the component.
assert.match(shadowStyles, /^:host\s*\{/m);
assert.doesNotMatch(shadowStyles, /^\s*(?:html|body|:root)\b/m);
assert.doesNotMatch(shadowStyles, /@import\b|url\s*\(/i);
const mediumSurface = cssDeclarations(
  shadowStyles,
  '.rsl-dialog .rsl-feature-settings-dialog__surface[data-size="Medium"]'
);
assert.equal(mediumSurface.width.replace(/\s*!important\s*$/i, ""), "min(760px, calc(100vw - 32px))");
assert.equal(mediumSurface["max-height"].replace(/\s*!important\s*$/i, ""), "min(760px, calc(100dvh - 32px))");
assert.equal(mediumSurface.height, undefined,
  "Settings constrains max-height; Scheduler must not restore a fixed 760px height");

// Suggestions and inline confirmation expand in document flow. The one
// shared body is the sole scroll owner for both views, so desktop and mobile
// never get nested/clipped scrollers when content changes.
const searchResultsDeclarations = cssDeclarations(shadowStyles, ".search-results");
assert.equal(searchResultsDeclarations.width, "100%");
assert.equal(searchResultsDeclarations["max-height"], "none");
assert.equal(searchResultsDeclarations.margin, "8px 0 0");
assert.equal(searchResultsDeclarations.padding, "4px");
assert.equal(searchResultsDeclarations.overflow, "visible");
for (const forbiddenProperty of [
  "position", "z-index", "top", "right", "left", "overflow-y"
]) {
  assert.equal(
    searchResultsDeclarations[forbiddenProperty],
    undefined,
    `.search-results must not restore the nested scroll trap via ${forbiddenProperty}`
  );
}
const scrollOwnerTag = tagWith("data-scheduler-scroll");
assert.match(scrollOwnerTag, /class="[^"]*\brsl-dialog__body\b[^"]*"/i);
assert.match(scrollOwnerTag, /class="[^"]*\brsl-feature-settings-dialog__body\b[^"]*"/i);
assert.equal((template.match(/\bdata-scheduler-scroll\b/gi) || []).length, 1,
  "both views use one persistent body/scroll element");
assert.equal(cssDeclarations(shadowStyles, ".rsl-dialog__body").overflow, "auto");
assert.equal(cssDeclarations(shadowStyles, ".rsl-feature-settings-dialog__body").overflow, "auto");
assert.equal(cssDeclarations(shadowStyles, ".scheduler-scroll").overflow, "auto");
const autoScrollSelectors = Array.from(
  shadowStyles.matchAll(/([^{}]+)\{[^{}]*\boverflow:\s*auto\s*;/g),
  (match) => match[1].trim()
);
assert.deepEqual(
  autoScrollSelectors,
  [".rsl-dialog__body", ".rsl-feature-settings-dialog__body", ".scheduler-scroll"],
  "only the three classes on that same shared element may establish scrolling"
);
assert.doesNotMatch(shadowStyles, /\boverflow-y:\s*(?:auto|scroll)\b/i,
  "no list, editor, search result, or inline confirmation may add a nested vertical scroller");
assert.equal(cssDeclarations(shadowStyles, ".rsl-dialog__surface").overflow, "hidden",
  "the Settings surface clips only outside its scrolling body");
const inlineConfirmDeclarations = cssDeclarations(shadowStyles, ".inline-confirm");
assert.equal(inlineConfirmDeclarations.position, undefined,
  "confirmation stays inline rather than becoming another overlay");
assert.equal(inlineConfirmDeclarations.width, "100%");
assert.match(shadowStyles, /:focus-visible/);
assert.match(
  shadowStyles,
  /@media\s*\(max-width:\s*520px\)[\s\S]*?\.rsl-dialog\s*\{[^}]*padding:\s*12px;[\s\S]*?\.rsl-dialog__surface\s*\{[^}]*max-height:\s*calc\(100dvh - 24px\);/,
  "small screens use the same outer padding and max-height as Settings"
);
assert.match(shadowStyles, /@media\s*\(max-width:\s*520px\)/);
for (const [selector, properties] of [
  [".rsl-dialog", ["padding"]],
  [".rsl-dialog__surface", ["max-height"]],
  [".rsl-dialog__body", ["padding"]],
  [".rsl-dialog__actions", ["padding", "flex-wrap"]],
  [".rsl-dialog__actions .rsl-button", ["flex"]],
  ['.rsl-dialog .rsl-feature-settings-dialog__surface[data-size="Medium"]', ["width", "max-height"]],
  [".rsl-feature-settings__title-row", ["align-items", "gap"]],
  [".rsl-feature-settings__logo", ["width", "height"]],
  [".rsl-feature-settings__footer", ["padding"]]
]) {
  assertSharedMediaCssProperties("max-width: 520px", selector, selector, properties);
}
const mobileFooter = cssMediaDeclarations(
  shadowStyles,
  "max-width: 520px",
  ".rsl-feature-settings__footer"
);
assert.equal(mobileFooter.display, "grid");
assert.equal(mobileFooter["grid-template-columns"], "1fr");
assert.equal(mobileFooter["grid-template-areas"], '"status" "done"',
  "mobile footer stacks status above its single action");
assert.match(shadowStyles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
assert.match(shadowStyles, /@media\s*\(forced-colors:\s*active\)/);

console.log("PASS Join Scheduler Settings-parity modal, gesture, prefill, focus, responsive, and race contract");
