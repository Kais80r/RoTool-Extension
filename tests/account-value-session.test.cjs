const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let listener,fetches=0,rateLimit=true,gate=null;
const context={URL,AbortController,setTimeout,clearTimeout,console,chrome:{
 runtime:{onMessage:{addListener(fn){listener=fn}}},tabs:{onRemoved:{addListener(){}}},
 storage:{local:{get:async()=>{if(gate)await gate;return {rslFeatureSettingsV1:{}}}}}
},getTrustedRobloxTopFrameTabId:()=>1,fetch:async()=>{
 fetches++;
 if(rateLimit){rateLimit=false;return {ok:false,status:429,headers:{get:()=>"1"}};}
 return {ok:true,json:async()=>({gamePasses:[]})};
}};
vm.createContext(context);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../account-value-background.js'),'utf8'),context);
const send=(action,scanId='scan-test-123')=>new Promise(resolve=>listener({type:'rsl:account-value',userId:'1',scanId,action},{tab:{id:1}},resolve));
(async()=>{
 assert.equal((await send('start')).retryable,true);
 const success=await send('start');assert.equal(success.ok,true);assert.equal(success.result.groups.passes.status,'ready');
 const before=fetches;await send('status');assert.equal(fetches,before,'Heartbeat must not hit Roblox');
 await send('cancel');assert.equal((await send('step')).code,'SCAN_EXPIRED');assert.equal(fetches,before);
 let unlock;gate=new Promise(resolve=>{unlock=resolve});
 const pending=send('start','scan-race-123');await send('cancel','scan-race-123');unlock();gate=null;
 assert.equal((await pending).code,'SCAN_EXPIRED');assert.equal(fetches,before,'Cancel during settings load must prevent requests');
 console.log('PASS rate-limit metadata, heartbeat, expired session and cancel race');
})().catch(error=>{console.error(error);process.exitCode=1});
