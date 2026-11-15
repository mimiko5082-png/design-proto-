import test from 'node:test';
import assert from 'node:assert/strict';
import { readFriendsMembership } from '../firebase-friends.js';
const session=(exists,error)=>({db:{},dbSDK:{ref(db,path){assert.equal(path,'groups/saved-group/members/current-user');return path;},async get(){if(error)throw error;return {exists:()=>exists};}}});
test('membership recovery distinguishes missing stored groups from existing membership',async()=>{
  assert.equal(await readFriendsMembership(session(false),'saved-group','current-user'),false);
  assert.equal(await readFriendsMembership(session(true),'saved-group','current-user'),true);
});
test('permission or connection failures do not count as absent membership',async()=>{
  for(const code of ['PERMISSION_DENIED','NETWORK_ERROR']){
    const error=Object.assign(new Error(code),{code});
    await assert.rejects(readFriendsMembership(session(false,error),'saved-group','current-user'),error);
  }
});
