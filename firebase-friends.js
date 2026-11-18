import { sharedPhotoDay, readSharedCalendar } from './sharing-calendar.js?v=76';
import { REACTIONS, namedReactions } from './friend-reactions.js';
import { japanDay } from './reading-store.js';
import { dailyTopic, topicById } from './haiku-catalog.js';
import {GROUP_KEY,restoreFriendsGroup,syncFriendsGroup} from './friends-membership.js?v=83';
import {readPendingInvite,rememberInvite,forgetInvite,readInviteMeta,forgetInviteMeta} from './friends-invites.js?v=83';
let sessionPromise, currentUser=null, ready=false;
export class FriendsError extends Error {}
const changed=()=>window.dispatchEvent(new Event('basho-sharing-updated'));
export function friendsProfile(){return currentUser?{id:currentUser.uid,name:currentUser.displayName||'友達',confirmed:true}:null;}
export function friendsGroup(){return currentUser?(localStorage.getItem(`${GROUP_KEY}:${currentUser.uid}`)||''):'';}
export function friendsConfigured(){const c=window.BASHO_FRIENDS_FIREBASE;return c?.projectId==='basho-friends' && !!c.apiKey && !!c.appId && /^https:\/\/basho-friends[-a-z0-9]*\.asia-southeast1\.firebasedatabase\.app\/?$/.test(c.databaseURL||'') && c.authDomain==='basho-friends.firebaseapp.com';}
export function pendingInvite(){return readPendingInvite(location.href,localStorage);}
// Inviter name, member count and expiry carried by the link; a label for the invitation screen, never an authority.
export function pendingInviteMeta(){const token=pendingInvite();return token?readInviteMeta(location.href,localStorage,token):null;}
// The person chose not to use the invitation: drop it from this device and from the address bar.
export function discardFriendsInvite(){const token=pendingInvite();forgetInvite(localStorage,token);forgetInviteMeta(localStorage,token);const url=new URL(location.href);url.hash='';url.searchParams.delete('invite');history.replaceState(null,'',url.href);changed();}
export function stageFriendsInvite(value){const token=rememberInvite(value,location.href,localStorage);if(!token)throw new FriendsError('友達から届いた招待リンクを、そのまま貼り付けてください。');try{readInviteMeta(new URL(String(value).trim(),location.href).href,localStorage,token);}catch{}const url=new URL(location.href);url.hash=new URLSearchParams({invite:token}).toString();history.replaceState(null,'',url.href);changed();return token;}
export async function friendsSession(){
  if(!friendsConfigured())throw new FriendsError('Firebaseの接続設定待ちです。basho-friends のWebアプリ設定を登録後に利用できます。');
  if(!sessionPromise)sessionPromise=(async()=>{
    const base='https://www.gstatic.com/firebasejs/12.11.0/';
    const [appSDK,authSDK,dbSDK]=await Promise.all(['firebase-app.js','firebase-auth.js','firebase-database.js'].map(file=>import(/* @vite-ignore */base+file)));
    const app=appSDK.initializeApp(window.BASHO_FRIENDS_FIREBASE,'basho-friends');
    const auth=authSDK.getAuth(app),db=dbSDK.getDatabase(app);
    const session={auth,db,authSDK,dbSDK};
    await new Promise((resolve,reject)=>{authSDK.onAuthStateChanged(auth,user=>{currentUser=user;window.dispatchEvent(new Event('basho-auth-changed'));
      const restore=user?restoreFriendsGroup(session,user.uid,localStorage,()=>currentUser?.uid===user.uid):Promise.resolve('');
      restore.catch(()=>{}).finally(()=>{resolve();if(ready)changed();});
    },reject);});
    ready=true;return session;
  })().catch(error=>{sessionPromise=null;throw error;});
  return sessionPromise;
}
export async function friendsSignIn(){
  const s=await friendsSession();
  if(!currentUser){const provider=new s.authSDK.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await s.authSDK.signInWithPopup(s.auth,provider);currentUser=s.auth.currentUser;}
  changed();return true;
}
export async function refreshFriendsGroup(){const s=await friendsSession(),uid=currentUser?.uid;if(!uid)return;const before=friendsGroup();await restoreFriendsGroup(s,uid,localStorage,()=>currentUser?.uid===uid);if(currentUser?.uid===uid&&before!==friendsGroup())changed();}
export async function friendsSignOut(){const s=await friendsSession();await s.authSDK.signOut(s.auth);currentUser=null;changed();}
async function authorized(){const s=await friendsSession();if(!currentUser)throw new FriendsError('Googleでログインしてください。');return s;}
const key=()=>crypto.randomUUID().replaceAll('-','');
export async function createFriendsGroup(){
  const s=await authorized(),id=key(),uid=currentUser.uid,name=currentUser.displayName||'友達';
  await s.dbSDK.set(s.dbSDK.ref(s.db,`groups/${id}`),{owner:uid,createdAt:s.dbSDK.serverTimestamp(),members:{[uid]:{name,joinedAt:s.dbSDK.serverTimestamp()}}});
  if(currentUser?.uid!==uid)throw new FriendsError('ログイン中のアカウントが変わりました。もう一度操作してください。');
  localStorage.setItem(`${GROUP_KEY}:${uid}`,id);await syncFriendsGroup(s,uid,id);changed();return id;
}
export async function friendsServerNow(session, clock=Date.now){
  // .info values live in the SDK's local information tree, not normal database data.
  const snapshot=await new Promise((resolve,reject)=>{
    let stop=()=>{};
    const timer=setTimeout(()=>{stop();reject(new FriendsError('サーバーの時刻を取得できませんでした。接続を確認してもう一度お試しください。'));},10000);
    try{stop=session.dbSDK.onValue(session.dbSDK.ref(session.db,'.info/serverTimeOffset'),value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);},{onlyOnce:true});}
    catch(error){clearTimeout(timer);reject(error);}
  });
  const offset=snapshot.val();
  if(typeof offset!=='number' || !Number.isFinite(offset))throw new FriendsError('サーバーの時刻を確認できませんでした。接続を確認してもう一度お試しください。');
  return clock()+offset;
}
export async function readFriendsMembership(session, group, uid){
  return (await session.dbSDK.get(session.dbSDK.ref(session.db,`groups/${group}/members/${uid}`))).exists();
}
export async function readFriendsMembers(session, group, uid, posted){
  // `posted` maps a member to the time of today's photograph; the identifiers themselves never leave this function.
  const snapshot=await session.dbSDK.get(session.dbSDK.ref(session.db,`groups/${group}/members`));
  return Object.entries(snapshot.val()||{}).map(([id,member])=>({
    name:typeof member?.name==='string'?member.name:'友達',
    joinedAt:typeof member?.joinedAt==='number' && Number.isFinite(member.joinedAt) && member.joinedAt>0 && member.joinedAt<=8640000000000000?member.joinedAt:null,
    own:id===uid,
    ...(posted?{postedAt:Number.isFinite(posted[id])?posted[id]:null}:{}),
  })).sort((a,b)=>(a.joinedAt??Infinity)-(b.joinedAt??Infinity)||a.name.localeCompare(b.name,'ja'));
}
async function requireFriendsMembership(session){
  const group=friendsGroup();
  if(!group)throw new FriendsError('招待リンクで参加するか、友達のグループを作成してください。');
  let member;
  try{member=await readFriendsMembership(session,group,currentUser.uid);}
  catch(error){
    if(/permission.denied/i.test(String(error?.code||error?.message||'')))throw new FriendsError('参加情報の読み取りがFirebaseに拒否されました。basho-friendsの公開済みルールを確認してください。');
    throw error;
  }
  if(!member){
    localStorage.removeItem(`${GROUP_KEY}:${currentUser.uid}`);
    throw new FriendsError('この端末の参加情報を確認できません。招待された方は、新しいグループを作らず、このアプリ内に友達の招待リンクを貼り付けて参加してください。');
  }
  return group;
}
export async function createFriendsInvite(){
  const s=await authorized(),id=await requireFriendsMembership(s),uid=currentUser.uid,from=currentUser.displayName||'';
  let count=0;try{count=(await readFriendsMembers(s,id,uid)).length;}catch{/* The link still works without the member count. */}
  const token=key()+key(),expiresAt=await friendsServerNow(s)+7*86400000-60000;
  try{await s.dbSDK.set(s.dbSDK.ref(s.db,`invites/${token}`),{groupId:id,owner:currentUser.uid,expiresAt});}
  catch(error){
    if(/permission.denied/i.test(String(error?.code||error?.message||'')))throw new FriendsError('グループへの参加は確認できましたが、招待リンクの保存が拒否されました。basho-friendsの公開済みルールのinvites部分を確認してください。');
    throw error;
  }
  // The name, count and expiry let the invitation screen greet the friend before login.
  const url=new URL(location.href);url.search='';url.hash=new URLSearchParams({invite:token,...(from?{from:Array.from(from).slice(0,20).join('')}:{}),...(count?{n:String(count)}:{}),exp:String(expiresAt)}).toString();return url.href;
}
export const LAST_MEMBER='このグループにいるのは、いまあなただけです。一人のときは抜けられません。別のグループには、招待リンクから参加できます。';
// Leaving removes only one's own membership. Photographs already sent stay with the group.
export async function leaveFriendsGroup(){
  const s=await authorized(),uid=currentUser.uid,group=friendsGroup();
  if(!group)throw new FriendsError('参加しているグループがありません。');
  // The last person stays: nobody could open or delete the group's photographs afterwards.
  let alone=false;try{alone=(await readFriendsMembers(s,group,uid)).length<2;}catch{}
  if(alone)throw new FriendsError(LAST_MEMBER);
  try{await s.dbSDK.remove(s.dbSDK.ref(s.db,`groups/${group}/members/${uid}`));}
  catch(error){
    if(/permission.denied/i.test(String(error?.code||error?.message||'')))throw new FriendsError('グループを抜ける操作が拒否されました。時間をおいてもう一度お試しください。');
    throw error;
  }
  try{await s.dbSDK.remove(s.dbSDK.ref(s.db,`userGroups/${uid}`));}catch{/* The pointer is checked against membership on restore, so a stale one grants nothing. */}
  localStorage.removeItem(`${GROUP_KEY}:${uid}`);changed();return true;
}
export async function joinFriendsGroup(){
  const s=await authorized(),uid=currentUser.uid,name=currentUser.displayName||'友達',token=pendingInvite();if(!/^[a-f0-9]{64}$/.test(token))throw new FriendsError('有効な招待リンクから開いてください。');
  let snap;try{snap=await s.dbSDK.get(s.dbSDK.ref(s.db,`invites/${token}`));}
  catch(error){if(/permission.denied/i.test(String(error?.code||error?.message||'')))throw new FriendsError('招待リンクを確認できません。期限切れの場合は、友達に新しい招待リンクを作ってもらってください。');throw error;}
  const invite=snap.val();
  if(!invite || invite.expiresAt<=await friendsServerNow(s))throw new FriendsError('招待リンクの期限が切れています。新しいリンクを送ってもらってください。');
  const member=s.dbSDK.ref(s.db,`groups/${invite.groupId}/members/${uid}`);
  const existing=await s.dbSDK.get(member);
  if(currentUser?.uid!==uid)throw new FriendsError('ログイン中のアカウントが変わりました。もう一度参加してください。');
  if(!existing.exists())await s.dbSDK.set(member,{name,joinedAt:s.dbSDK.serverTimestamp(),invite:token});
  if(currentUser?.uid!==uid)throw new FriendsError('ログイン中のアカウントが変わりました。もう一度参加してください。');
  localStorage.setItem(`${GROUP_KEY}:${uid}`,invite.groupId);const synced=await syncFriendsGroup(s,uid,invite.groupId);
  forgetInvite(localStorage,token);forgetInviteMeta(localStorage,token);const url=new URL(location.href);url.hash='';url.searchParams.delete('invite');history.replaceState(null,'',url.href);changed();return {synced};
}
export function friendlyError(error){
  if(error instanceof FriendsError)return error;
  const code=String(error?.code||error?.message||'');
  if(/permission.denied|PERMISSION_DENIED/i.test(code))return new FriendsError('グループに参加していないか、Firebaseのルールが未設定です。招待リンクと設定を確認してください。');
  if(/popup.blocked/i.test(code))return new FriendsError('ログイン画面を開けませんでした。ポップアップを許可してもう一度お試しください。');
  if(/popup.closed|cancelled.popup/i.test(code))return new FriendsError('Googleログインをキャンセルしました。');
  if(/unauthorized.domain/i.test(code))return new FriendsError('このプレビューのドメインをFirebaseの承認済みドメインに追加してください。');
  const detail=String(error?.message||error?.code||'原因不明').replace(/https?:\/\/\S+/g,'[URL]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[メールアドレス]').replace(/[A-Za-z0-9_-]{24,}/g,'[ID]').slice(0,160);
  return new FriendsError(`Firebaseの処理に失敗しました。詳細：${detail}`);
}
export async function firebaseSharingAPI(action,data={}){
  try{
    const s=await authorized(),group=friendsGroup();if(!group)throw new FriendsError('招待リンクで参加するか、友達のグループを作成してください。');
    const {ref,get,set,remove,query,orderByChild,equalTo}=s.dbSDK,base=`groups/${group}`,uid=currentUser.uid,day=japanDay();
    const photoPath=`${base}/photos/${data.photoId}`;
    const decorate=post=>({...post,own:post.author===uid,original:(topicById(post.topicId)||dailyTopic(post.day)).original,modern:(topicById(post.topicId)||dailyTopic(post.day)).modern,lines:(topicById(post.topicId)||dailyTopic(post.day)).lines,stampCount:Object.values(post.stamps||{}).reduce((n,v)=>n+Object.keys(v).length,0),commentCount:Object.keys(post.comments||{}).length});
    if(action==='members'){
      await requireFriendsMembership(s);
      const posted={};
      try{const today=(await get(query(ref(s.db,`${base}/photos`),orderByChild('day'),equalTo(day)))).val()||{};for(const post of Object.values(today))if(typeof post?.author==='string')posted[post.author]=post.createdAt;}
      catch{/* The member list is still useful without today's status. */}
      return {members:await readFriendsMembers(s,group,uid,posted)};
    }
    if(action==='calendar'){
      await requireFriendsMembership(s);
      const result=await readSharedCalendar(s,group,data.month,data.cursor);
      return {...result,posts:result.posts.map(decorate)};
    }
    if(action==='feed'){
      await requireFriendsMembership(s);
      const snap=await get(query(ref(s.db,`${base}/photos`),orderByChild('day'),equalTo(day)));
      return {day,posts:Object.entries(snap.val()||{}).map(([id,p])=>decorate({...p,id})).sort((a,b)=>b.createdAt-a.createdAt),nextCursor:null};
    }
    if(action==='publish'){
      const postDay=sharedPhotoDay(data.day,day);
      if(!topicById(data.topicId))throw new FriendsError('記録の日付に合う写真を選択してください。');
      if(!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data.image||'') || data.image.length>1100000)throw new FriendsError('写真は1MB以内のJPEG・PNG・WebPを選んでください。');
      if((data.caption||'').length>120)throw new FriendsError('ひとことは120文字までです。');
      const id=`${postDay}_${uid}`,path=`${base}/photos/${id}`;
      // Update photo fields separately, preserving friends' comments and stamps.
      await s.dbSDK.update(ref(s.db,path),{author:uid,name:currentUser.displayName||'友達',day:postDay,topicId:data.topicId,image:data.image,caption:data.caption||'',createdAt:s.dbSDK.serverTimestamp()});return {id};
    }
    if(!/^[A-Za-z0-9_-]{1,180}$/.test(data.photoId||''))throw new FriendsError('写真を選択してください。');
    if(action==='detail'){
      const post=(await get(ref(s.db,photoPath))).val();if(!post)throw new FriendsError('写真は削除されています。');
      const members=(await get(ref(s.db,`${base}/members`))).val()||{};
      return namedReactions(post,members,uid);
    }
    if(action==='stamp'){
      if(!REACTIONS.some(r=>r.id===data.stamp))throw new FriendsError('スタンプを選択してください。');
      await set(ref(s.db,`${photoPath}/stamps/${data.stamp}/${uid}`),data.active?true:null);return {};
    }
    if(action==='comment'){
      if(!/^[a-f0-9]{32}$/.test(data.commentId||'') || !data.text?.trim() || data.text.length>120)throw new FriendsError('ひとことは1〜120文字で入力してください。');
      await set(ref(s.db,`${photoPath}/comments/${data.commentId}`),{author:uid,name:currentUser.displayName||'友達',text:data.text.trim(),createdAt:s.dbSDK.serverTimestamp()});return {};
    }
    if(action==='delete-comment'){
      if(!/^[a-f0-9]{32}$/.test(data.commentId||''))throw new FriendsError('ひとことを選択してください。');
      await remove(ref(s.db,`${photoPath}/comments/${data.commentId}`));return {};
    }
    if(action==='delete'){await remove(ref(s.db,photoPath));return {};}
    throw new FriendsError('この操作は利用できません。');
  }catch(error){throw friendlyError(error);}
}
