/* Read-only, on-demand inventory valuation. No external pricing service. */
(() => {
  "use strict";
  const TYPES = "TShirt,Hat,Shirt,Pants,Head,Face,Gear,Torso,RightArm,LeftArm,LeftLeg,RightLeg,HairAccessory,FaceAccessory,NeckAccessory,ShoulderAccessory,FrontAccessory,BackAccessory,WaistAccessory,ClimbAnimation,FallAnimation,IdleAnimation,JumpAnimation,RunAnimation,SwimAnimation,WalkAnimation,EmoteAnimation,TShirtAccessory,ShirtAccessory,PantsAccessory,JacketAccessory,SweaterAccessory,ShortsAccessory,LeftShoeAccessory,RightShoeAccessory,DressSkirtAccessory,EyebrowAccessory,EyelashAccessory,MoodAnimation,DynamicHead,FaceMakeup,LipMakeup,EyeMakeup,AvatarBackground";
  const MAX_ITEMS = 20000;
  const validId = value => /^[1-9]\d{0,19}$/.test(String(value));
  const amount = value => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
  function limitedCategory(data) {
    const creatorId = data?.creatorTargetId;
    if (!validId(creatorId) || !["User", "Group"].includes(data?.creatorType)) return "unclassifiedLimiteds";
    return data.creatorType === "User" && String(creatorId) === "1" ? "limiteds" : "ugcLimiteds";
  }
  const jobs = new Map();
  const sessions = new Map();
  const prices = new Map();
  const freshPrice = key => { const cached = prices.get(key); return cached && Date.now() - cached.at < 300000 ? cached : null; };
  function cachePrice(key, data) {
    prices.set(key, { data, at: Date.now() });
    while (prices.size > 5000) prices.delete(prices.keys().next().value);
  }
  function retryAfterMs(value, now = Date.now()) {
    if (!value) return 0;
    const seconds = Number(value);
    const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
    return Number.isFinite(delay) ? Math.max(0, delay) : 0;
  }
  async function request(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      let response = await fetch(url, { credentials: "include", ...options, signal: controller.signal });
      if (options.method === "POST" && response.status === 403) {
        const token = response.headers.get("x-csrf-token");
        if (token) response = await fetch(url, { credentials: "include", ...options,
          headers: { ...options.headers, "x-csrf-token": token }, signal: controller.signal });
      }
      if (!response.ok) {
        const error = new Error(response.status === 429 ? "Roblox rate limit. Please wait before resuming." : `Roblox request failed (${response.status}).`);
        error.status = response.status;
        error.retryable = [408, 425, 429].includes(response.status) || response.status >= 500;
        error.retryAfterMs = retryAfterMs(response.headers.get("retry-after"));
        throw error;
      }
      return await response.json();
    } catch (error) {
      if (error.name === "AbortError" || error instanceof TypeError) {
        error.retryable = true;
        error.code = "NETWORK";
      }
      throw error;
    } finally { clearTimeout(timer); }
  }
  function createScanner(userId, get = request) {
    const state = { userId, stage: 0, cursor: "", queue: [], seen: new Set(), cursors: new Set(),
      limitedIds: new Set(), bundleAssets: new Set(), processed: 0, skipped: 0,
      groups: Object.fromEntries(["limiteds", "ugcLimiteds", "unclassifiedLimiteds", "bundles", "avatar", "passes"].map(key => [key, { value: 0, priced: 0, unknown: 0, excluded: 0, status: "pending", items: [] }])),
      warnings: [], done: false, capped: false };
    const stages = ["passes", "limiteds", "bundles", "avatar"];
    const batchDisabled = new Set();
    const copyLookups = new Map();
    const warn = text => { if (!state.warnings.includes(text)) state.warnings.push(text); };
    const add = (group, price, item, priceSource = "Current price") => {
      state.processed++;
      state.groups[group].items.push({
        id: String(item.assetId || item.id || item.gamePassId),
        name: String(item.name || item.assetName || "Unnamed item").slice(0, 200),
        price,
        priceSource: price === null ? null : priceSource,
        serial: item.serialNumber ?? null
      });
      if (price === null) state.groups[group].unknown++;
      else { state.groups[group].value += price; state.groups[group].priced++; }
    };
    const advance = () => {
      if (state.groups[stages[state.stage]].status === "loading") state.groups[stages[state.stage]].status = "ready";
      if (state.capped) {
        state.groups[stages[state.stage]].status = "partial";
        for (const group of Object.values(state.groups)) if (group.status === "pending") group.status = "partial";
        state.done = true;
        return;
      }
      state.stage++; state.cursor = ""; state.cursors.clear(); if (state.stage >= stages.length) state.done = true;
    };
    function snapshot() {
      const groups = Object.fromEntries(Object.entries(state.groups).map(([key, value]) => [key, { ...value }]));
      // Limiteds can arrive from either the resale inventory or avatar inventory.
      const limitedStatus = state.done
        ? ([state.groups.limiteds.status, state.groups.avatar.status].every(status => status === "ready") ? "ready" : "partial")
        : state.stage === 0 ? "pending" : "loading";
      for (const key of ["limiteds", "ugcLimiteds", "unclassifiedLimiteds"]) groups[key].status = limitedStatus;
      return { userId, done: state.done, phase: stages[state.stage] || "finished", processed: state.processed,
        pending: state.queue.length, skipped: state.skipped, groups, warnings: state.warnings,
        total: Object.values(state.groups).reduce((sum, group) => sum + group.value, 0),
        unknown: Object.values(state.groups).reduce((sum, group) => sum + group.unknown, 0),
        updatedAt: Date.now() };
    }
    async function priceLimited(item, data) {
      const id = String(item.assetId || item.id);
      let rap = amount(item.recentAveragePrice);
      if (!(rap > 0)) {
        const cached = freshPrice(`RAP:${id}`);
        if (cached) rap = cached.data;
        else {
          try { rap = amount((await get(`https://economy.roblox.com/v1/assets/${id}/resale-data`)).recentAveragePrice); }
          catch (error) { if (![400, 403, 404].includes(error.status)) throw error; }
          cachePrice(`RAP:${id}`, rap);
        }
      }
      const resale = amount(data?.lowestResalePrice);
      const value = rap > 0 ? rap : resale > 0 ? resale : null;
      const category = limitedCategory(data);
      if (category === "unclassifiedLimiteds") warn("The creator of some Limiteds could not be verified; these are listed separately.");
      add(category, value, item, rap > 0 ? "RAP" : "Lowest resale");
    }
    async function priceLimitedCopies(item, data) {
      const id = String(item.assetId || item.id);
      let lookup = copyLookups.get(id);
      if (!lookup) {
        lookup = { cursor: "", cursors: new Set(), copies: new Map(), done: false, uncertain: false };
        copyLookups.set(id, lookup);
      }
      if (!lookup.done) {
        const url = new URL(`https://inventory.roblox.com/v1/users/${userId}/items/Asset/${id}`);
        url.searchParams.set("limit", "100");
        url.searchParams.set("sortOrder", "Asc");
        if (lookup.cursor) url.searchParams.set("cursor", lookup.cursor);
        let payload;
        try { payload = await get(url.href); }
        catch (error) {
          if (![400, 401, 403, 404].includes(error.status)) throw error;
          lookup.uncertain = true; lookup.done = true;
        }
        if (!lookup.done) {
          if (!Array.isArray(payload?.data)) { lookup.uncertain = true; lookup.done = true; }
          else {
            for (const copy of payload.data) {
              const instance = copy.instanceId ?? copy.userAssetId ?? copy.collectibleItemInstanceId;
              if (String(copy.assetId || copy.id) !== id || instance == null || !String(instance).trim()) {
                lookup.uncertain = true; continue;
              }
              if (lookup.copies.has(String(instance))) continue;
              if (lookup.copies.size >= Math.max(1, MAX_ITEMS - state.processed - state.queue.length + 1)) {
                lookup.uncertain = true; lookup.done = true; state.capped = true;
                warn("20,000-item scan limit reached. This is a partial estimate."); break;
              }
              lookup.copies.set(String(instance), { ...item, serialNumber: copy.serialNumber ?? item.serialNumber });
            }
            const cursor = payload.nextPageCursor;
            if (!lookup.done && typeof cursor === "string" && cursor) {
              if (lookup.cursors.has(cursor)) { lookup.uncertain = true; lookup.done = true; }
              else { lookup.cursor = cursor; lookup.cursors.add(cursor); return false; }
            } else lookup.done = true;
          }
        }
      }
      // Commit only after pagination and pricing succeed, so retries cannot duplicate copies.
      const copies = [...lookup.copies.values()];
      if (!copies.length) { copies.push(item); lookup.uncertain = true; }
      for (const copy of copies) await priceLimited(copy, data);
      if (lookup.uncertain) warn(`Limited ${id} (${String(item.name || item.assetName || data?.name || "Unnamed item").slice(0, 100)}): copy count could not be fully verified; counted ${copies.length}.`);
      copyLookups.delete(id);
      return true;
    }
    async function prefetchPrices(group) {
      const kind = group === "bundles" ? "Bundle" : "Asset";
      if (batchDisabled.has(kind)) return;
      const ids = [...new Set(state.queue.slice(0, 20).map(item => String(item.assetId || item.id)))].filter(id =>
        !freshPrice(`${kind}:${id}`) && !(group === "avatar" && (state.limitedIds.has(id) || state.bundleAssets.has(id)))
      );
      if (ids.length < 2) return;
      let payload;
      try {
        payload = kind === "Bundle"
          ? await get(`https://catalog.roblox.com/v1/bundles/details?bundleIds=${ids.join(",")}`)
          : await get("https://catalog.roblox.com/v1/catalog/items/details", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({items: ids.map(id => ({itemType: "Asset", id: Number(id)}))})
          });
      } catch (error) {
        if (error.retryable || [408,425,429].includes(error.status) || error.status >= 500) throw error;
        batchDisabled.add(kind); return;
      }
      const entries = kind === "Bundle" ? payload : payload?.data;
      if (!Array.isArray(entries)) { batchDisabled.add(kind); return; }
      for (const data of entries) {
        if (data && ids.includes(String(data.id))) cachePrice(`${kind}:${data.id}`, data);
      }
    }
    async function priceItem(item, group) {
      const id = String(item.assetId || item.id);
      if (group === "avatar" && (state.limitedIds.has(id) || state.bundleAssets.has(id))) { state.skipped++; return; }
      const key = `${group === "bundles" ? "Bundle" : "Asset"}:${id}`;
      let detail = freshPrice(key);
      if (!detail) {
        const url = group === "passes"
          ? `https://apis.roblox.com/game-passes/v1/game-passes/${id}/product-info`
          : group === "bundles" ? `https://catalog.roblox.com/v1/bundles/${id}/details`
          : `https://catalog.roblox.com/v1/catalog/items/${id}/details?itemType=asset`;
        try { detail = { data: await get(url), at: Date.now() }; }
        catch (error) {
          if ([400, 403, 404].includes(error.status)) {
            if (group === "limiteds") await priceLimited(item, null);
            else add(group, null, item);
            return;
          }
          throw error;
        }
        cachePrice(key, detail.data);
      }
      const data = detail.data;
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        if (group === "limiteds") await priceLimited(item, null);
        else add(group, null, item);
        return;
      }
      if (group === "limiteds") {
        await priceLimited(item, data);
      } else if (group === "bundles") {
        for (const child of Array.isArray(data.items) ? data.items : []) {
          if (child.type === "Asset" && validId(child.id)) state.bundleAssets.add(String(child.id));
        }
        add(group, data.product?.isForSale === true ? amount(data.product.priceInRobux) : null, item);
      } else if (group === "passes") {
        add(group, data.IsForSale === true ? amount(data.PriceInRobux) : null, item);
      } else if ((Array.isArray(data.itemRestrictions) ? data.itemRestrictions : []).some(value => /^(limited|limitedunique|collectible)$/i.test(value))) {
        // Never use a Limited's original sale price as its resale value.
        return await priceLimitedCopies(item, data);
      } else {
        add(group, data.priceStatus === "Off Sale" ? null : amount(data.price), item);
      }
    }
    async function step() {
      if (state.done) return snapshot();
      const group = stages[state.stage];
      if (state.groups[group].status !== "partial") state.groups[group].status = "loading";
      if (state.queue.length) {
        await prefetchPrices(group);
        const deadline = Date.now() + 8000;
        // Commit only successfully handled entries, so retry cannot double-count.
        for (let i = 0; i < 20 && state.queue.length; i++) {
          if (await priceItem(state.queue[0], group) === false) break;
          state.queue.shift();
          if (Date.now() >= deadline) break;
        }
        if (!state.queue.length && !state.cursor) advance();
        return snapshot();
      }
      let url;
      if (group === "limiteds") url = new URL(`https://inventory.roblox.com/v1/users/${userId}/assets/collectibles`);
      else if (group === "bundles") url = new URL(`https://catalog.roblox.com/v1/users/${userId}/bundles`);
      else if (group === "passes") url = new URL(`https://apis.roblox.com/game-passes/v1/users/${userId}/game-passes`);
      else url = new URL(`https://inventory.roblox.com/v2/users/${userId}/inventory`);
      url.searchParams.set("limit", "100");
      url.searchParams.set("sortOrder", "Desc");
      if (group === "avatar") url.searchParams.set("assetTypes", TYPES);
      if (state.cursor) url.searchParams.set("cursor", state.cursor);
      if (group === "passes") {
        url.search = "";
        url.searchParams.set("count", "100");
        if (state.cursor) url.searchParams.set("exclusiveStartId", state.cursor);
      }
      let payload;
      try { payload = await get(url.toString()); }
      catch (error) {
        if ([401, 403, 404].includes(error.status)) {
          state.groups[group].status = "unavailable";
          warn(`${group}: inventory is private, inaccessible, or this category is unavailable.`);
          advance();
          return snapshot();
        }
        throw error;
      }
      if (group === "passes") {
        if (!Array.isArray(payload.gamePasses)) throw new Error("Unexpected Roblox gamepass response.");
        payload = { data: payload.gamePasses.map(pass => ({ ...pass, assetId: pass.gamePassId })),
          nextPageCursor: payload.gamePasses.length ? String(payload.gamePasses.at(-1).gamePassId) : null };
      }
      if (!Array.isArray(payload.data)) throw new Error("Unexpected Roblox inventory response. Please try again.");
      for (const item of payload.data) {
        const id = String(item.assetId || item.id || "");
        if (!validId(id)) { warn("Roblox returned an item without a usable ID."); continue; }
        // Limited copies are valued separately, ordinary assets only once.
        const key = `${group}:${group === "limiteds" ? item.userAssetId || item.collectibleItemInstanceId || id : id}`;
        if (state.seen.has(key)) continue;
        if (state.seen.size >= MAX_ITEMS) { warn("20,000-item scan limit reached. This is a partial estimate."); state.groups[group].status = "partial"; state.capped = true; break; }
        state.seen.add(key);
        if (group === "limiteds") {
          state.limitedIds.add(id);
          state.queue.push(item);
        } else if (group === "passes") {
          // Self-created passes have arbitrary prices, not an acquisition value.
          if (item.creator?.creatorType === "User" && String(item.creator.creatorId) === userId) { state.skipped++; state.groups[group].excluded++; continue; }
          add(group, item.isForSale === true ? amount(item.price) : null, item);
        } else state.queue.push(item);
      }
      const cursor = !state.capped && typeof payload.nextPageCursor === "string" ? payload.nextPageCursor : "";
      if (cursor && state.cursors.has(cursor)) { warn(`${group}: Roblox repeated a page; this category is incomplete.`); state.groups[group].status = "partial"; state.cursor = ""; }
      else { state.cursor = cursor; if (cursor) state.cursors.add(cursor); }
      if (!state.queue.length && !state.cursor) advance();
      return snapshot();
    }
    return { step, snapshot };
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = { createScanner, amount, retryAfterMs, request, limitedCategory }; return; }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== "rsl:account-value") return;
    if (getTrustedRobloxTopFrameTabId(sender) === null || !validId(message.userId)) {
      respond({ ok: false, error: "Invalid profile request." }); return false;
    }
    const key = sender.tab.id;
    if (!["start", "step", "status", "cancel"].includes(message.action) || !/^[a-zA-Z0-9-]{8,80}$/.test(message.scanId || "")) {
      respond({ ok: false, error: "Invalid scan request." }); return false;
    }
    if (message.action === "cancel") {
      if (sessions.get(key) === message.scanId) { sessions.delete(key); jobs.delete(key); }
      respond({ ok: true }); return false;
    }
    if (message.action === "start") sessions.set(key, message.scanId);
    (async () => {
      const settings = await chrome.storage.local.get({ rslFeatureSettingsV1: {} });
      if (settings.rslFeatureSettingsV1?.flags?.accountValue === false) throw new Error("Account Value is disabled in RoTool settings.");
      if (sessions.get(key) !== message.scanId) throw Object.assign(new Error("This scan is no longer active. Choose Recalculate."), { code: "SCAN_EXPIRED" });
      let job = jobs.get(key);
      if (!job || job.userId !== String(message.userId) || job.scanId !== message.scanId) {
        if (message.action !== "start") throw Object.assign(new Error("The background scan was restarted. Choose Recalculate to start a fresh estimate."), {code:"SCAN_EXPIRED"});
        if (jobs.size >= 10 && !jobs.has(key)) throw new Error("Too many active scans. Close another Account Value window first.");
        job = { ...createScanner(String(message.userId)), userId: String(message.userId), scanId: message.scanId, pending: null };
        jobs.set(key, job);
      }
      if (message.action === "status") return job.snapshot();
      if (!job.pending) job.pending = job.step().finally(() => { job.pending = null; });
      return await job.pending;
    })().then(result => respond({ ok: true, result: { ...result,
      groups: Object.fromEntries(Object.entries(result.groups).map(([key, group]) => {
        const requested = message.offsets?.[key];
        const offset = message.action !== "start" && Number.isSafeInteger(requested) && requested >= 0 && requested <= group.items.length ? requested : 0;
        return [key, { ...group, offset, items: group.items.slice(offset) }];
      }))
    } }), error => respond({ ok: false, error: error.message || "Could not calculate account value.",
      code: error.code || "REQUEST_FAILED", retryable: error.retryable === true,
      retryAfterMs: error.retryAfterMs || 0 }));
    return true;
  });
  chrome.tabs.onRemoved.addListener(tabId => { jobs.delete(tabId); sessions.delete(tabId); });
})();
