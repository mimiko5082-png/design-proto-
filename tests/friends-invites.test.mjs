import test from 'node:test';
import assert from 'node:assert/strict';
import {inviteToken,rememberInvite,readPendingInvite,forgetInvite} from '../friends-invites.js';
const base='https://mimiko5082-png.github.io/design-proto-/',token='a'.repeat(64);
const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
test('invitation survives losing the URL fragment during sign-in and clears only after successful participation',()=>{
 const store=storage();assert.equal(readPendingInvite(base+'#invite='+token,store,100),token);
 assert.equal(readPendingInvite(base,store,200),token);
 forgetInvite(store,token);assert.equal(readPendingInvite(base,store,300),'');
});
test('pasted invitations accept the app URL or code, reject unrelated sites and expire locally',()=>{
 assert.equal(inviteToken(base+'index.html#invite='+token,base),token);
 assert.equal(inviteToken(token,base),token);
 for(const value of ['https://evil.example/#invite='+token,'javascript:alert(1)','not-a-link',base+'#invite=bad'])assert.equal(inviteToken(value,base),'');
 const store=storage();rememberInvite(token,base,store,100);
 assert.equal(readPendingInvite(base,store,100+7*86400000),'');
});
test('completing an older invite does not delete a newer pending invite',()=>{
 const store=storage();rememberInvite('b'.repeat(64),base,store,100);forgetInvite(store,token);
 assert.equal(readPendingInvite(base,store,200),'b'.repeat(64));
});
