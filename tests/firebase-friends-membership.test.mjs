import test from 'node:test';
import assert from 'node:assert/strict';
import { readFriendsMembership, readFriendsMembers } from '../firebase-friends.js';
const session=(exists,error)=>({db:{},dbSDK:{ref(db,path){assert.equal(path,'groups/saved-group/members/current-user');return path;},async get(){if(error)throw error;return {exists:()=>exists};}}});
test('membership recovery distinguishes missing stored groups from existing membership',async()=>{
  assert.equal(await readFriendsMembership(session(false),'saved-group','current-user'),false);
  assert.equal(await readFriendsMembership(session(true),'saved-group','current-user'),true);
});
test('member list includes friends without posts, sorts by joining time and omits private identifiers and invite tokens',async()=>{
  const data={bob:{name:'Bob',joinedAt:200,invite:'SECRET'},alice:{name:'Alice',joinedAt:100},old:{name:'Old',joinedAt:'invalid'}};
  const s={db:{},dbSDK:{ref(db,path){assert.equal(path,'groups/friends/members');return path;},async get(){return {val:()=>data};}}};
  assert.deepEqual(await readFriendsMembers(s,'friends','alice'),[
    {name:'Alice',joinedAt:100,own:true},{name:'Bob',joinedAt:200,own:false},{name:'Old',joinedAt:null,own:false},
  ]);
  // Today's posting time is attached by member without exposing who is who beyond the name.
  assert.deepEqual(await readFriendsMembers(s,'friends','alice',{bob:1234,stranger:5}),[
    {name:'Alice',joinedAt:100,own:true,postedAt:null},{name:'Bob',joinedAt:200,own:false,postedAt:1234},{name:'Old',joinedAt:null,own:false,postedAt:null},
  ]);
  s.dbSDK.get=async()=>{throw new Error('PERMISSION_DENIED');};
  await assert.rejects(readFriendsMembers(s,'friends','eve'),/PERMISSION_DENIED/);
});
test('permission or connection failures do not count as absent membership',async()=>{
  for(const code of ['PERMISSION_DENIED','NETWORK_ERROR']){
    const error=Object.assign(new Error(code),{code});
    await assert.rejects(readFriendsMembership(session(false,error),'saved-group','current-user'),error);
  }
});
