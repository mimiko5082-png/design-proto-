import test from 'node:test';
import assert from 'node:assert/strict';
import {inviteToken,rememberInvite,readPendingInvite,forgetInvite,inviteMeta,readInviteMeta,forgetInviteMeta} from '../friends-invites.js';
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
test('the link carries a label for the invitation screen: cleaned, bounded and never required',()=>{
 const now=1000,exp=now+3*86400000;
 const link=base+'#'+new URLSearchParams({invite:token,from:'みほ<script>',n:'3',exp:String(exp)});
 assert.deepEqual(inviteMeta(link,base,now),{token,from:'みほscript',count:3,expiresAt:exp});
 assert.equal(inviteToken(link,base),token);
 assert.deepEqual(inviteMeta(base+'#invite='+token,base,now),{token,from:'',count:0,expiresAt:0});
 const wild=base+'#'+new URLSearchParams({invite:token,from:'あ'.repeat(60),n:'-4',exp:String(now+90*86400000)});
 assert.deepEqual(inviteMeta(wild,base,now),{token,from:'あ'.repeat(20),count:0,expiresAt:0});
 assert.equal(inviteMeta('https://evil.example/#invite='+token+'&from=x',base,now),null);
});
test('the label survives the URL losing its fragment, belongs to one token and is cleared with it',()=>{
 const store=storage(),now=1000,exp=now+86400000;
 const link=base+'#'+new URLSearchParams({invite:token,from:'みほ',n:'2',exp:String(exp)});
 assert.equal(readInviteMeta(link,store,token,now).from,'みほ');
 assert.deepEqual(readInviteMeta(base,store,token,now),{token,from:'みほ',count:2,expiresAt:exp});
 assert.equal(readInviteMeta(base,store,token,exp+1).expiresAt,0);
 assert.deepEqual(readInviteMeta(base,store,'b'.repeat(64),now),{token:'b'.repeat(64),from:'',count:0,expiresAt:0});
 assert.equal(readInviteMeta(base,store,'bad',now),null);
 forgetInviteMeta(store,'b'.repeat(64));assert.equal(readInviteMeta(base,store,token,now).from,'みほ');
 forgetInviteMeta(store,token);assert.equal(readInviteMeta(base,store,token,now).from,'');
});
