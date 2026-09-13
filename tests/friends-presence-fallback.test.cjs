const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=(staged,normal)=>fs.readFileSync(path.join(root,fs.existsSync(path.join(root,staged))?staged:normal),'utf8');
const bg=read('friendship-background.js','background.js');
const content=read('friendship-content.js','content.js');
const ids=Array.from({length:562},(_,i)=>String(i+10));
const seed=new Map(ids.map(id=>[id,{names:{username:id==='10'?'void':'User'+id}}]));
const ctx={Date,Map,Set,onlineFriendsCache:null,friendIdsCache:{viewerUserId:'1',profilesByUserId:seed},
  ONLINE_FRIENDS_CACHE_TTL_MS:60000,onlineFriendsGeneration:0,
  getAuthenticatedViewerUserId:async()=> '1',fetchAllFriendIds:async()=>ids,
  fetchFriendPresences:async()=>{throw Object.assign(Error('rate limited'),{status:429})},
  makeOfflineFriend:(id,profile)=>({userId:id,username:profile.names.username,presenceType:'Offline'}),
  reuseOnlineFriendDetails:friend=>friend,startOnlineFriendsEnrichment:()=>{}};
vm.createContext(ctx);
vm.runInContext(bg.slice(bg.indexOf('async function fetchAllOnlineFriends('),bg.indexOf('function getAllOnlineFriends(')),ctx);
function extract(name,next){return content.slice(content.indexOf('  function '+name+'('),content.indexOf('  function '+next+'('))}
(async()=>{
  const result=await ctx.fetchAllOnlineFriends(true);
  assert.equal(result.ok,true);assert.equal(result.scannedFriendTotal,562);
  assert.equal(result.presenceComplete,false);assert.equal(result.offlineTotal,0);
  assert.equal(result.offlineFriends.length,562);assert.ok(result.offlineFriends.every(f=>f.presenceType==='Unknown'));
  assert.equal(result.offlineFriends[0].username,'void');
  ctx.fetchFriendPresences=async()=>new Map();
  const restored=await ctx.fetchAllOnlineFriends(true);
  assert.equal(restored.presenceComplete,true);assert.equal(restored.offlineTotal,562);
  ctx.fetchFriendPresences=async()=>{throw Object.assign(Error('signed out'),{status:401})};
  await assert.rejects(ctx.fetchAllOnlineFriends(true),error=>error.status===401);
  const ui={allOfflineFriends:result.offlineFriends,allOnlineFriends:[],allFriendUserIds:ids,
    BEST_FRIENDS_FILTER_VALUE:'best',ALL_FRIENDS_FILTER_VALUE:'all',activeFriendsPresenceFilter:'all',
    onlineFriendsLoadState:'ready',onlineFriendsErrorCode:'',bestFriendDetails:[]};
  vm.createContext(ui);
  vm.runInContext(extract('getBaseActivePresenceFriends','hasActiveFriendsAdvancedFilters')+
    extract('getActiveFriendsLoadState','getOnlineListSignature')+
    extract('getPresencePresentation','makeVerifiedFriendNameBadge'),ui);
  assert.equal(ui.getBaseActivePresenceFriends().length,562);
  assert.equal(ui.getActiveFriendsLoadState(),'ready');
  assert.equal(ui.getPresencePresentation(result.offlineFriends[0]).label,'Status unavailable');
  ui.activeFriendsPresenceFilter='offline';assert.equal(ui.getBaseActivePresenceFriends().length,0);
  assert.equal(ui.getActiveFriendsLoadState(),'error');assert.equal(ui.getActiveFriendsErrorCode(),'PRESENCE_UNAVAILABLE');
  console.log('PASS 562 searchable friends during presence outage, unknown status, filter isolation, recovery and authentication failure');
})().catch(e=>{console.error(e);process.exitCode=1});
