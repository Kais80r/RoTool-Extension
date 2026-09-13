"use strict";
const assert = require("node:assert/strict");
const { createScanner, amount, retryAfterMs, request } = require("../account-value-background.js");
const page = (data, nextPageCursor = null) => ({ data, nextPageCursor });
async function finish(scanner) {
  for (let i = 0; i < 50; i++) { const result = await scanner.step(); if (result.done) return result; }
  throw new Error("Scan did not finish");
}
(async () => {
  assert.equal(amount(null), null); assert.equal(amount(0), 0); assert.equal(amount(-5), null);
  assert.equal(retryAfterMs("12"), 12000);
  assert.equal(retryAfterMs("Wed, 21 Oct 2015 07:28:00 GMT", Date.parse("2015-10-21T07:27:00Z")), 60000);
  assert.equal(retryAfterMs("invalid"), 0);
  const originalFetch = global.fetch;
  global.fetch = async () => ({ok:false,status:429,headers:{get:()=>"20"}});
  await assert.rejects(request("https://catalog.roblox.com/test"), error => error.retryable && error.retryAfterMs===20000);
  global.fetch = async () => { throw new TypeError("Failed to fetch"); };
  await assert.rejects(request("https://catalog.roblox.com/test"), error => error.retryable && error.code === "NETWORK");
  global.fetch = originalFetch;
  let retry = true;
  const mock = async raw => {
    const url = new URL(raw);
    if (url.pathname.endsWith("/assets/collectibles")) return page([
      { assetId: 100, userAssetId: 1, recentAveragePrice: 50 },
      { assetId: 100, userAssetId: 2, recentAveragePrice: 50 },
      { assetId: 100, userAssetId: 2, recentAveragePrice: 50 }
    ]);
    if (url.pathname.endsWith("/bundles")) return page([{ id: 200 }]);
    if (url.pathname.includes("/100/details")) return { creatorType: "User", creatorTargetId: 1, itemRestrictions: ["Limited"] };
    if (url.pathname.endsWith("/bundles/200/details")) return { product: { isForSale: true, priceInRobux: 120 }, items: [{ type: "Asset", id: 300 }] };
    if (url.pathname.endsWith("/game-passes")) return { gamePasses: url.searchParams.has("exclusiveStartId") ? [] : [{ gamePassId: 500, isForSale: true, price: 75 }, { gamePassId: 501, isForSale: true, price: 999999, creator: { creatorType: "User", creatorId: 1 } }] };
    if (url.pathname.endsWith("/inventory")) return page([{ assetId: 100 }, { assetId: 300 }, { assetId: 400 }, { assetId: 401 }, { assetId: 402 }]);
    if (url.pathname.includes("/400/")) return { price: 25 };
    if (url.pathname.includes("/401/")) return { price: null, priceStatus: "Off Sale" };
    if (url.pathname.includes("/402/")) {
      if (retry) { retry = false; throw Object.assign(new Error("rate limited"), { status: 429 }); }
      return { price: 0, collectibleItemId: "ordinary-item" };
    }
    if (url.pathname.endsWith("/500/product-info")) return { IsForSale: true, PriceInRobux: 75 };
    throw new Error("Unexpected URL " + url);
  };
  const scanner = createScanner("1", mock);
  await assert.rejects(finish(scanner), /rate limited/);
  const result = await finish(scanner);
  assert.equal(result.total, 320);
  assert.equal(Object.values(result.groups).flatMap(group => group.items).length, result.processed);
  assert.equal(Object.values(result.groups).flatMap(group => group.items).reduce((sum, item) => sum + (item.price ?? 0), 0), result.total);
  assert.equal(result.groups.avatar.items.filter(item => item.price === null).length, 1);
  assert.equal(result.groups.limiteds.items.length, 2);
  assert.equal(result.groups.passes.status, "ready");
  assert.equal(result.groups.passes.excluded, 1);
  assert.equal(result.unknown, 1);
  assert.equal(result.groups.limiteds.priced, 2, "Count individual Limited copies once");
  assert.equal(result.groups.avatar.priced, 2, "Free items have a known zero price");
  assert.equal(result.skipped, 3, "Exclude Limiteds, bundle components and self-created passes");
  const privateResult = await finish(createScanner("2", async () => { throw Object.assign(new Error("private"), { status: 403 }); }));
  assert.equal(privateResult.warnings.length, 4);
  assert.equal(privateResult.total, 0);
  assert.equal(privateResult.groups.passes.status, "unavailable");
  const inaccessibleItem = await finish(createScanner("4", async raw => {
    if (raw.includes("/game-passes")) return { gamePasses: [] };
    if (raw.endsWith("/9999/details")) throw Object.assign(new Error("forbidden item"), {status:403});
    if (raw.includes("/bundles?")) return page([{id:9999,name:"Unavailable bundle"}]);
    return page([]);
  }));
  assert.equal(inaccessibleItem.groups.bundles.unknown, 1);
  assert.equal(inaccessibleItem.groups.avatar.status, "ready", "One inaccessible price must not block later categories");
  const repeated = await finish(createScanner("3", async raw => {
    if (raw.includes("collectibles")) return page([{ assetId: 900, userAssetId: 901, recentAveragePrice: 7 }], "repeat");
    if (raw.includes("/900/details")) return {creatorType:"User",creatorTargetId:1,itemRestrictions:["LimitedUnique"]};
    return raw.includes("/game-passes") ? { gamePasses: [] } : page([]);
  }));
  assert.equal(repeated.total, 7);
  assert.ok(repeated.warnings.some(warning => warning.includes("repeated")));
  const capped = await finish(createScanner("5", async raw => {
    if (raw.includes("/game-passes")) return { gamePasses: raw.includes("exclusiveStartId") ? [] : Array.from({length:19999},(_,i)=>({gamePassId:100000+i,isForSale:true,price:1})) };
    if (raw.includes("/bundles?")) return page([{id:99991},{id:99992}]);
    if (raw.includes("/bundles/99991/details")) return {product:{isForSale:true,priceInRobux:5},items:[]};
    return page([]);
  }));
  assert.equal(capped.processed, 20000, "Finish queued items before stopping at the cap");
  assert.equal(capped.groups.bundles.value, 5);
  assert.equal(capped.groups.avatar.status, "partial");
  const split = await finish(createScanner("6", async raw => {
    if (raw.includes("/game-passes")) return {gamePasses:[]};
    if (raw.includes("/inventory?")) return page([{assetId:14742730714,name:"Angry Duck Trophy"},{assetId:801,name:"Roblox collectible"},{assetId:802,name:"Unknown creator"}]);
    if (raw.includes("/14742730714/details")) return {creatorType:"Group",creatorTargetId:9781410,itemRestrictions:["Collectible"],price:0,lowestResalePrice:55};
    if (raw.includes("/801/details")) return {creatorType:"User",creatorTargetId:1,itemRestrictions:["Collectible"],lowestResalePrice:200};
    if (raw.includes("/802/details")) return {itemRestrictions:["Limited"],lowestResalePrice:25};
    if (raw.includes("/801/resale-data")) return {recentAveragePrice:80};
    if (raw.includes("resale-data")) throw Object.assign(new Error("not supported"),{status:400});
    return page([]);
  }));
  assert.equal(split.groups.ugcLimiteds.value,55);
  assert.equal(split.groups.ugcLimiteds.items[0].priceSource,"Lowest resale");
  assert.equal(split.groups.limiteds.value,80,"Roblox Collectibles must not be classified as UGC");
  assert.equal(split.groups.limiteds.items[0].priceSource,"RAP","Prefer RAP over listing price");
  assert.equal(split.groups.unclassifiedLimiteds.value,25);
  assert.equal(split.total,160);
  console.log("PASS totals, duplicates, bundle exclusion, free/unknown, retry, private inventory, cursor loop");
})().catch(error => { console.error(error); process.exitCode = 1; });
