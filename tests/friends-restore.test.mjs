import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreFriendsGroup,syncFriendsGroup,GROUP_KEY} from '../friends-membership.js';
function fixture(data={},initial={}){
 const values=new Map(Object.entries(initial)),writes=[];
 const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 const session={db:{},dbSDK:{ref:(db,path)=>path,async get(path){const value=data[path];if(value instanceof Error)throw value;return {val:()=>value,exists:()=>value!=null};},async set(path,value){writes.push({path,value});}}};
 return {session,storage,writes};
}
test('a fresh home-screen context restores only the signed-in user’s verified group',async()=>{
 const {session,storage,writes}=fixture({'userGroups/alice':{groupId:'friends'},'groups/friends/members/alice':{name:'Alice'}});
 assert.equal(await restoreFriendsGroup(session,'alice',storage),'friends');
 assert.equal(storage.getItem(GROUP_KEY+':alice'),'friends');assert.equal(storage.getItem(GROUP_KEY+':bob'),null);assert.equal(writes.length,0);
});
test('legacy Safari membership is checked before being copied into the account index',async()=>{
 const {session,storage,writes}=fixture({'groups/friends/members/alice':{name:'Alice'}},{[GROUP_KEY+':alice']:'friends'});
 assert.equal(await restoreFriendsGroup(session,'alice',storage),'friends');
 assert.deepEqual(writes,[{path:'userGroups/alice',value:{groupId:'friends'}}]);
});
test('stale pointers and account switches cannot grant membership or cache another account’s group',async()=>{
 const stale=fixture({'userGroups/alice':{groupId:'friends'}});
 assert.equal(await restoreFriendsGroup(stale.session,'alice',stale.storage),'');assert.equal(stale.writes.length,0);
 const changed=fixture({'userGroups/alice':{groupId:'friends'},'groups/friends/members/alice':{name:'Alice'}});
 assert.equal(await restoreFriendsGroup(changed.session,'alice',changed.storage,()=>false),'');assert.equal(changed.storage.getItem(GROUP_KEY+':alice'),null);
});
test('network errors preserve local membership; old rules still permit the existing local membership flow',async()=>{
 const unavailable=fixture({'userGroups/alice':new Error('network')},{[GROUP_KEY+':alice']:'friends'});
 await assert.rejects(restoreFriendsGroup(unavailable.session,'alice',unavailable.storage),/network/);
 assert.equal(unavailable.storage.getItem(GROUP_KEY+':alice'),'friends');
 const old=fixture({'userGroups/alice':Object.assign(new Error('PERMISSION_DENIED'),{code:'PERMISSION_DENIED'}),'groups/friends/members/alice':{name:'Alice'}},{[GROUP_KEY+':alice']:'friends'});
 old.session.dbSDK.set=async()=>{throw new Error('PERMISSION_DENIED');};
 assert.equal(await restoreFriendsGroup(old.session,'alice',old.storage),'friends');
});

test('an offline index write cannot indefinitely block an otherwise successful participation',async()=>{
 const session={db:{},dbSDK:{ref:(db,path)=>path,set:()=>new Promise(()=>{})}};
 assert.equal(await syncFriendsGroup(session,'alice','friends',5),false);
});
