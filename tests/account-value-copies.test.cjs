const assert = require('node:assert/strict');
const {createScanner} = require('../account-value-background.js');
const page = (data=[],nextPageCursor=null)=>({data,nextPageCursor});
async function run(mode) {
  let retry = mode === 'retry';
  let pages = 0;
  const scanner=createScanner('123',async raw=>{
    const url=new URL(raw);
    if(raw.includes('/game-passes'))return {gamePasses:[]};
    if(raw.includes('/inventory?'))return page([{assetId:7654321,name:'Test Limited'}]);
    if(raw.includes('/7654321/details'))return {creatorType:'Group',creatorTargetId:12,itemRestrictions:['Collectible'],lowestResalePrice:55};
    if(raw.includes('/resale-data'))throw Object.assign(new Error('unsupported'),{status:400});
    if(raw.includes('/items/Asset/7654321')) {
      pages++;
      if(mode==='private')throw Object.assign(new Error('private'),{status:403});
      if(mode==='empty')return page();
      if(!url.searchParams.has('cursor'))return page([{id:7654321,instanceId:11},{id:7654321,instanceId:12}],'next');
      if(retry){retry=false;throw Object.assign(new Error('rate limit'),{status:429,retryable:true})}
      return page([{id:7654321,instanceId:12},{id:7654321,instanceId:13}],mode==='loop'?'next':null);
    }
    return page();
  });
  for(let i=0;i<25;i++){
    let result;
    try{result=await scanner.step()}catch(error){assert.equal(error.status,429);assert.equal(scanner.snapshot().total,0);continue}
    if(result.done)return {result,pages};
  }
  throw Error('Scan did not finish');
}
(async()=>{
  for(const mode of ['normal','retry']) {
    const {result}=await run(mode);
    assert.equal(result.total,165);
    assert.equal(result.groups.ugcLimiteds.items.length,3);
    assert.equal(result.warnings.length,0);
  }
  for(const mode of ['private','empty']) {
    const {result}=await run(mode);
    assert.equal(result.total,55);
    assert.ok(result.warnings.some(text=>text.includes('7654321')&&text.includes('counted 1')));
  }
  const {result}=await run('loop');
  assert.equal(result.total,165);
  assert.ok(result.warnings.some(text=>text.includes('copy count')));
  console.log('PASS instance pagination, duplicate removal, retry without double-count, private/empty fallback and cursor loop');
})().catch(error=>{console.error(error);process.exitCode=1});
