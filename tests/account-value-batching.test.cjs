const assert=require('node:assert/strict');
const {createScanner}=require('../account-value-background.js');
async function finish(scan){for(let i=0;i<30;i++){const result=await scan.step();if(result.done)return result;}throw Error('Too many steps');}
(async()=>{
 let batches=0,individuals=0;
 const get=async(url,options)=>{
   if(url.includes('/game-passes'))return {gamePasses:[]};
   if(url.includes('/inventory?'))return {data:Array.from({length:40},(_,i)=>({assetId:800000+i,name:'Item '+i})),nextPageCursor:null};
   if(url.endsWith('/catalog/items/details')){
     batches++;const items=JSON.parse(options.body).items;
     assert.ok(items.length<=20);
     return {data:items.map(item=>({id:item.id,price:10,itemRestrictions:[]}))};
   }
   if(url.includes('/catalog/items/')){individuals++;throw Error('Unexpected individual lookup');}
   return {data:[],nextPageCursor:null};
 };
 const first=await finish(createScanner('80',get));
 assert.equal(first.total,400);assert.equal(first.processed,40);assert.equal(batches,2);assert.equal(individuals,0);
 const second=await finish(createScanner('80',get));
 assert.equal(second.total,400);assert.equal(batches,2,'Recalculation should reuse fresh cached prices');
 let fallback=0;
 const partial=await finish(createScanner('81',async(url,options)=>{
   if(url.includes('/game-passes'))return {gamePasses:[]};
   if(url.includes('/inventory?'))return {data:[{assetId:810001},{assetId:810002}]};
   if(url.endsWith('/catalog/items/details'))return {data:[{id:810001,price:5}]};
   if(url.includes('/810002/details')){fallback++;return {price:7};}
   return {data:[]};
 }));
 assert.equal(partial.total,12);assert.equal(fallback,1,'Missing batch entries must be fetched individually');
 console.log('PASS 40 items: 2 batch requests, zero individual requests; cache reuse and partial-batch fallback');
})().catch(error=>{console.error(error);process.exitCode=1});
