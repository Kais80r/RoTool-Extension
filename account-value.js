(() => {
  "use strict";
  let host, dialog, enabled = true, run = 0, activeUser = "", opener;
  let activeScanId = "";
  const groupViews = new Map();
  const labels = { limiteds: "Roblox Limiteds", ugcLimiteds: "UGC Limiteds", unclassifiedLimiteds: "Limiteds (creator unknown)", bundles: "Avatar bundles", avatar: "Avatar items & gear", passes: "Gamepasses" };
  const number = value => new Intl.NumberFormat(document.documentElement.lang || "en").format(value);
  function setStatusBadge(node, state, text) {
    if (node.dataset.state === state && node.textContent === text) return;
    node.dataset.state = state;
    const icon = document.createElement("span");
    icon.className = "status-icon"; icon.setAttribute("aria-hidden", "true");
    icon.textContent = state === "success" ? "✓" : state === "warning" || state === "paused" ? "!" : state === "pending" ? "·" : "";
    const label = document.createElement("span"); label.textContent = text;
    node.replaceChildren(icon, label);
  }
  function setScanStatus(state, text) {
    setStatusBadge(host.shadowRoot.getElementById("scan-state"), state, text);
  }
  function send(userId, action) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Object.assign(new Error("RoTool did not respond in time."), {retryable: true})), 60000);
      const offsets = Object.fromEntries([...groupViews].map(([key, view]) => [key, view.items.length]));
      chrome.runtime.sendMessage({ type: "rsl:account-value", userId, action, offsets, scanId: activeScanId }, response => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else if (!response?.ok) reject(Object.assign(new Error(response?.error || "Account Value is unavailable."), {
          retryable: response?.retryable === true, retryAfterMs: response?.retryAfterMs || 0, code: response?.code
        }));
        else resolve(response.result);
      });
    });
  }
  async function waitForRetry(userId, delay, token, status, attempt) {
    setScanStatus("waiting", "Waiting — retrying automatically");
    const until = Date.now() + delay;
    let lastHeartbeat = Date.now();
    while (token === run && dialog.open && Date.now() < until) {
      status.textContent = `Roblox is temporarily unavailable or limiting requests. Retrying automatically in ${Math.ceil((until - Date.now()) / 1000)}s (${attempt}/6). Your progress is kept.`;
      await new Promise(resolve => setTimeout(resolve, Math.min(1000, Math.max(0, until - Date.now()))));
      if (token !== run || !dialog.open) return;
      if (Date.now() - lastHeartbeat >= 15000) {
        // Keep the extension worker awake during a long Retry-After, without querying Roblox.
        await send(userId, "status");
        lastHeartbeat = Date.now();
      }
    }
  }
  function close() {
    run++;
    if (activeUser) void send(activeUser, "cancel").catch(() => {});
    activeUser = "";
    if (dialog?.open) dialog.close();
    if (opener?.isConnected) opener.focus();
  }
  function makeDialog() {
    if (host?.isConnected) return;
    host = document.createElement("div");
    host.id = "rsl-account-value-host";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>
      :host { font: 14px/1.5 Arial, sans-serif; color: #f7f7f8; }
      * { box-sizing: border-box; }
      dialog { color: #f7f7f8; background: #202227; border: 1px solid #494d5a; border-radius: 12px; padding: 24px; width: 540px; max-width: calc(100vw - 32px); max-height: 85vh; overflow: auto; }
      dialog::backdrop { background: #0009; }
      h2 { font-size: 22px; margin: 0; } p { margin: 10px 0; color: #bfc2ca; }
      header, footer, .row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
      button { border: 0; border-radius: 8px; padding: 10px 16px; font: inherit; font-weight: 600; background: #335fff; color: white; cursor: pointer; }
      button:disabled { opacity: .5; cursor: default; } button:focus-visible { outline: 2px solid white; outline-offset: 3px; }
      header button { background: transparent; font-size: 22px; padding: 0 8px; }
      .total { font-size: 30px; font-weight: 700; margin-top: 18px; }
      #price-note { padding: 10px 12px; border-radius: 8px; background: #ffffff08; font-size: 12px; line-height: 1.5; }
      .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; line-height: 1.4; color: #cbd8ff; background: #335fff26; }
      #scan-state { margin-top: 8px; padding: 8px 12px; font-size: 14px; }
      .category .status-badge { margin-left: 8px; vertical-align: middle; }
      .status-badge[data-state="success"] { color: #a0efbd; background: #26874b26; }
      .status-badge[data-state="warning"], .status-badge[data-state="waiting"], .status-badge[data-state="paused"] { color: #ffd18b; background: #c78d2826; }
      .status-badge[data-state="pending"] { color: #bfc2ca; background: #ffffff0c; }
      .status-icon { display: inline-flex; justify-content: center; align-items: center; width: 14px; height: 14px; flex: 0 0 14px; font-weight: 700; }
      [data-state="working"] > .status-icon, [data-state="waiting"] > .status-icon { border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: value-spin 1s linear infinite; }
      @keyframes value-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .status-icon { animation: none !important; } }
      .row { padding: 10px 0; border-bottom: 1px solid #393c44; }
      .row small { display: block; color: #bfc2ca; font-size: 12px; } .row strong { white-space: nowrap; }
      .category { margin: 0; }
      .category > summary::before { content: '›'; font-size: 22px; transition: transform .15s; }
      .category[open] > summary::before { transform: rotate(90deg); }
      .category > summary > span { flex: 1; }
      .item-list { margin: 0; padding: 0 0 0 22px; list-style: none; }
      .item-list li { display: flex; align-items: start; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid #34363e; font-size: 13px; }
      .item-list a { color: #dbe4ff; text-decoration: none; overflow-wrap: anywhere; min-width: 0; }
      .item-list a:hover { text-decoration: underline; }
      .item-list li > span { white-space: nowrap; }
      .item-list li > span small { display: block; text-align: right; color: #bfc2ca; font-size: 11px; }
      .show-more { margin: 10px 0 10px 22px; padding: 6px 12px; }
      details { margin: 16px 0; color: #bfc2ca; } summary { cursor: pointer; color: white; }
      #status { min-height: 42px; } #warnings, #total-note { color: #ffd18b; white-space: pre-line; } footer { justify-content: flex-end; margin-top: 16px; }
    </style><dialog aria-labelledby="title"><header><h2 id="title">Account Value</h2><button id="close" aria-label="Close">×</button></header>
      <p id="profile"></p><div id="scan-state" class="status-badge" role="status" aria-live="polite"></div><div class="total" id="total">—</div><p>Estimated Robux value · not an account sale price</p><p id="total-note" hidden></p>
      <p id="price-note">Based on current shop prices, not what you originally paid. Limiteds use RAP or current resale listings. Prices can change after purchase and affect this estimate.</p>
      <div id="groups"></div><p id="status" role="status" aria-live="polite"></p><p id="warnings"></p>
      <details><summary>How is this calculated?</summary><p>Roblox Limiteds and UGC Limiteds are separated by creator. Missing creator information is shown separately. Limiteds prefer recent average resale price (RAP); if unavailable, the lowest current resale listing is used and marked as Lowest resale. These are estimates before fees, not guaranteed sale proceeds.</p><p>Normal avatar items, gear, bundles and gamepasses use current listed prices, not what you originally paid. Non-tradable items are not cashable value. Bundle components and Limiteds are excluded from the normal item sum to avoid double-counting. Missing prices are unpriced, not zero. Free items can count as zero.</p><p>Robux balance, badges, account age, consumed developer products, private-server fees and items inside individual games are not included. Private inventories and unavailable categories make this a partial estimate. Maximum 20,000 inventory entries per scan; price cache lasts five minutes.</p></details>
      <footer><button id="resume" hidden>Resume</button><button id="restart">Recalculate</button><button id="done">Close</button></footer></dialog>`;
    dialog = shadow.querySelector("dialog");
    shadow.getElementById("close").onclick = close;
    shadow.getElementById("done").onclick = close;
    dialog.addEventListener("cancel", event => { event.preventDefault(); close(); });
    shadow.getElementById("restart").onclick = () => calculate(activeUser, "start");
    shadow.getElementById("resume").onclick = () => calculate(activeUser, "step");
    document.body.append(host);
  }
  function renderGroup(key, group) {
    if (key === "unclassifiedLimiteds" && !group.priced && !group.unknown && !groupViews.has(key)) return;
    let view = groupViews.get(key);
    if (!view) {
      const details = document.createElement("details"); details.className = "category";
      const summary = document.createElement("summary"); summary.className = "row";
      const label = document.createElement("span"); label.textContent = labels[key];
      const statusBadge = document.createElement("span"); statusBadge.className = "status-badge"; label.append(statusBadge);
      const count = document.createElement("small"); label.append(count);
      const value = document.createElement("strong"); summary.append(label, value);
      const list = document.createElement("ul"); list.className = "item-list";
      const more = document.createElement("button"); more.className = "show-more"; more.type = "button"; more.textContent = "Show more items";
      view = { details, count, value, list, more, statusBadge, items: [], limit: 100, rendered: 0 };
      more.onclick = () => { view.limit += 100; renderItems(key, view); };
      details.addEventListener("toggle", () => { if (details.open) renderItems(key, view); });
      details.append(summary, list, more);
      host.shadowRoot.getElementById("groups").append(details);
      groupViews.set(key, view);
    }
    const badgeState = group.status === "ready" ? "success" : group.status === "loading" ? "working" : group.status === "pending" ? "pending" : "warning";
    const badgeText = group.status === "ready" ? "Scan complete" : group.status === "loading" ? "Calculating" : group.status === "pending" ? "Waiting" : group.status === "unavailable" ? "Could not scan" : "Scan incomplete";
    setStatusBadge(view.statusBadge, badgeState, badgeText);
    view.count.textContent = `${number(group.priced)} items valued · ${number(group.unknown)} prices unavailable` + (group.excluded ? ` · ${number(group.excluded)} self-created passes excluded` : "");
    view.value.textContent = !group.priced && (group.unknown || group.status !== "ready") ? "—" : number(group.value) + " Robux";
    if ((group.offset ?? 0) !== view.items.length) {
      view.items = []; view.rendered = 0; view.list.replaceChildren();
    }
    view.items.push(...(group.items || []));
    if (group.items?.length) {
      view.dirty = true;
    }
    if (view.details.open) renderItems(key, view);
    else view.more.hidden = view.items.length <= view.limit;
  }
  function renderItems(key, view) {
    if (view.dirty) {
      view.items.sort((a, b) =>
        (b.price ?? -1) - (a.price ?? -1) ||
        a.name.localeCompare(b.name) || String(a.id).localeCompare(String(b.id))
      );
      view.rendered = 0;
      view.list.replaceChildren();
      view.dirty = false;
    }
    for (; view.rendered < Math.min(view.limit, view.items.length); view.rendered++) {
      const item = view.items[view.rendered];
      const row = document.createElement("li");
      const link = document.createElement("a");
      const route = key === "bundles" ? "bundles" : key === "passes" ? "game-pass" : "catalog";
      if (/^[1-9]\d*$/.test(item.id)) link.href = `https://www.roblox.com/${route}/${item.id}`;
      link.target = "_blank"; link.rel = "noopener noreferrer";
      link.textContent = item.name + (item.serial != null ? ` #${item.serial}` : "");
      const price = document.createElement("span");
      price.textContent = item.price === null ? "Price unavailable" : `${number(item.price)} Robux`;
      if (item.price !== null && ["RAP", "Lowest resale"].includes(item.priceSource)) {
        const source = document.createElement("small"); source.textContent = item.priceSource; price.append(source);
      }
      if (item.price === null) price.title = "No reliable price available; excluded from the total.";
      row.append(link, price); view.list.append(row);
    }
    view.more.hidden = view.rendered >= view.items.length;
  }
  async function calculate(userId, action) {
    const token = ++run;
    const shadow = host.shadowRoot;
    const status = shadow.getElementById("status");
    shadow.getElementById("restart").disabled = true;
    shadow.getElementById("resume").hidden = true;
    if (action === "start") {
      activeScanId = crypto.randomUUID();
      shadow.getElementById("total").textContent = "—";
      shadow.getElementById("groups").replaceChildren();
      groupViews.clear();
      shadow.getElementById("warnings").textContent = "";
      shadow.getElementById("total-note").hidden = true;
    }
    status.textContent = "Reading inventory…";
    setScanStatus("working", "Calculating — total is not final");
    let failures = 0;
    try {
      while (token === run && dialog.open) {
        let result;
        try {
          result = await send(userId, action);
          failures = 0;
        } catch (error) {
          if (token !== run || !dialog.open) return;
          if (!error.retryable || failures >= 6) throw error;
          failures++;
          const serverDelay = Number.isFinite(error.retryAfterMs) ? Math.max(0, error.retryAfterMs) : 0;
          const delay = Math.max(serverDelay, Math.min(60000, 5000 * 2 ** (failures - 1))) + Math.floor(Math.random() * 500);
          await waitForRetry(userId, delay, token, status, failures);
          continue;
        }
        if (token !== run) return;
        action = "step";
        const incompleteScan = Object.values(result.groups).some(group => ["partial", "unavailable"].includes(group.status));
        setScanStatus(result.done ? (incompleteScan ? "warning" : "success") : "working",
          result.done ? (incompleteScan ? "Scan ended — some categories incomplete" : "Scan complete") : "Calculating — total is not final");
        const totalNote = shadow.getElementById("total-note");
        totalNote.hidden = !result.unknown && !result.warnings.length;
        totalNote.textContent = [result.unknown ? `Total excludes ${number(result.unknown)} ${result.unknown === 1 ? "item" : "items"} with unavailable prices.` : "", result.warnings.length ? "Some inventory data could not be included or fully verified." : ""].filter(Boolean).join(" ");
        shadow.getElementById("total").textContent = result.done && !result.processed && result.warnings.length ? "Unavailable" : `${number(result.total)} Robux`;
        for (const [key, group] of Object.entries(result.groups)) {
          renderGroup(key, group);
        }
        shadow.getElementById("warnings").textContent = result.warnings.join("\n");
        status.textContent = result.done
          ? `${number(result.processed)} entries checked. ${number(result.unknown)} prices unavailable.`
          : `Calculating ${result.phase === "limiteds" ? "Limited inventory" : labels[result.phase] || result.phase}… ${number(result.processed)} entries checked. This is a running subtotal.`;
        if (result.done) break;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      if (token !== run) return;
      status.textContent = `Calculation paused. ${error.message} Any displayed value is incomplete.`;
      setScanStatus("paused", "Paused — calculation not finished");
      shadow.getElementById("resume").hidden = error.code === "SCAN_EXPIRED";
    } finally {
      if (token === run) shadow.getElementById("restart").disabled = false;
    }
  }
  function open(userId, trigger) {
    if (!enabled || !/^[1-9]\d*$/.test(String(userId))) return;
    close(); makeDialog(); activeUser = String(userId); opener = trigger;
    host.shadowRoot.getElementById("profile").textContent = `Profile ID: ${userId}`;
    dialog.showModal();
    void calculate(activeUser, "start");
  }
  globalThis.RoToolAccountValue = { open };
  let timer;
  function mount() {
    const userId = location.pathname.match(/\/users\/(\d+)\/profile\/?$/)?.[1];
    const header = document.querySelector(".user-profile-header-info, .profile-header-top");
    let button = document.getElementById("rsl-account-value-button");
    if (!enabled || !userId || !header || document.getElementById("rsl-enhanced-profile-host")?.getClientRects().length) { button?.remove(); return; }
    if (button) return;
    button = document.createElement("button"); button.type = "button";
    button.id = "rsl-account-value-button"; button.className = "btn-secondary-md";
    button.textContent = "Account Value";
    button.onclick = () => open(location.pathname.match(/\/users\/(\d+)\/profile/)?.[1], button);
    header.append(button);
  }
  function updateSettings(value) {
    enabled = value?.flags?.accountValue !== false;
    if (!enabled) close();
    mount();
  }
  chrome.storage.local.get({ rslFeatureSettingsV1: {} }, result => updateSettings(result.rslFeatureSettingsV1));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.rslFeatureSettingsV1) updateSettings(changes.rslFeatureSettingsV1.newValue);
  });
  new MutationObserver(() => {
    if (timer) return;
    timer = setTimeout(() => { timer = null; mount(); }, 300);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
