import { REACTIONS } from './friend-reactions.js';
import { japanDay } from './reading-store.js';
import { dailyTopic } from './haiku-catalog.js';
const GROUP_KEY='basho_firebase_friends_group_v1';
let sessionPromise, currentUser=null, ready=false;
export class FriendsError extends Error {}
const changed=()=>window.dispatchEvent(new Event('basho-sharing-updated'));
export function friendsProfile(){return currentUser?{id:currentUser.uid,name:currentUser.displayName||'友達',confirmed:true}:null;}
export function friendsGroup(){return currentUser?(localStorage.getItem(`${GROUP_KEY}:${currentUser.uid}`)||''):'';}
export function friendsConfigured(){const c=window.BASHO_FRIENDS_FIREBASE;return c?.projectId==='basho-friends' && !!c.apiKey && !!c.appId && /^https:\/\/basho-friends[-a-z0-9]*\.asia-southeast1\.firebasedatabase\.app\/?$/.test(c.databaseURL||'') && c.authDomain==='basho-friends.firebaseapp.com';}
export function pendingInvite(){const p=new URLSearchParams(location.hash.slice(1));return p.get('invite')||'';}
export async function friendsSession(){
  if(!friendsConfigured())throw new FriendsError('Firebaseの接続設定待ちです。basho-friends のWebアプリ設定を登録後に利用できます。');
  if(!sessionPromise)sessionPromise=(async()=>{
    const base='https://www.gstatic.com/firebasejs/12.11.0/';
    const [appSDK,authSDK,dbSDK]=await Promise.all(['firebase-app.js','firebase-auth.js','firebase-database.js'].map(file=>import(/* @vite-ignore */base+file)));
    const app=appSDK.initializeApp(window.BASHO_FRIENDS_FIREBASE,'basho-friends');
    const auth=authSDK.getAuth(app),db=dbSDK.getDatabase(app);
    await new Promise((resolve,reject)=>{authSDK.onAuthStateChanged(auth,user=>{currentUser=user;window.dispatchEvent(new Event('basho-auth-changed'));resolve();if(ready)changed();},reject);});
    ready=true;return {auth,db,authSDK,dbSDK};
  })().catch(error=>{sessionPromise=null;throw error;});
  return sessionPromise;
}
export async function friendsSignIn(){
  const s=await friendsSession();
  if(!currentUser){const provider=new s.authSDK.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await s.authSDK.signInWithPopup(s.auth,provider);currentUser=s.auth.currentUser;}
  changed();return true;
}
export async function friendsSignOut(){const s=await friendsSession();await s.authSDK.signOut(s.auth);currentUser=null;changed();}
async function authorized(){const s=await friendsSession();if(!currentUser)throw new FriendsError('Googleでログインしてください。');return s;}
const key=()=>crypto.randomUUID().replaceAll('-','');
export async function createFriendsGroup(){
  const s=await authorized(),id=key();
  await s.dbSDK.set(s.dbSDK.ref(s.db,`groups/${id}`),{owner:currentUser.uid,createdAt:s.dbSDK.serverTimestamp(),members:{[currentUser.uid]:{name:currentUser.displayName||'友達',joinedAt:s.dbSDK.serverTimestamp()}}});
  localStorage.setItem(`${GROUP_KEY}:${currentUser.uid}`,id);changed();return id;
}
export async function createFriendsInvite(){
  const s=await authorized(),id=friendsGroup();if(!id)throw new FriendsError('先にグループを作成してください。');
  const token=key()+key();
  await s.dbSDK.set(s.dbSDK.ref(s.db,`invites/${token}`),{groupId:id,owner:currentUser.uid,expiresAt:Date.now()+7*86400000});
  const url=new URL(location.href);url.search='';url.hash=new URLSearchParams({invite:token}).toString();return url.href;
}
export async function joinFriendsGroup(){
  const s=await authorized(),token=pendingInvite();if(!/^[a-f0-9]{64}$/.test(token))throw new FriendsError('有効な招待リンクから開いてください。');
  const snap=await s.dbSDK.get(s.dbSDK.ref(s.db,`invites/${token}`)),invite=snap.val();
  if(!invite || invite.expiresAt<=Date.now())throw new FriendsError('招待リンクの期限が切れています。新しいリンクを送ってもらってください。');
  const member=s.dbSDK.ref(s.db,`groups/${invite.groupId}/members/${currentUser.uid}`);
  const existing=await s.dbSDK.get(member);
  if(!existing.exists())await s.dbSDK.set(member,{name:currentUser.displayName||'友達',joinedAt:s.dbSDK.serverTimestamp(),invite:token});
  localStorage.setItem(`${GROUP_KEY}:${currentUser.uid}`,invite.groupId);history.replaceState(null,'',location.pathname+location.search);changed();
}
export function friendlyError(error){
  if(error instanceof FriendsError)return error;
  const code=String(error?.code||error?.message||'');
  if(/permission.denied|PERMISSION_DENIED/i.test(code))return new FriendsError('グループに参加していないか、Firebaseのルールが未設定です。招待リンクと設定を確認してください。');
  if(/popup.blocked/i.test(code))return new FriendsError('ログイン画面を開けませんでした。ポップアップを許可してもう一度お試しください。');
  if(/popup.closed|cancelled.popup/i.test(code))return new FriendsError('Googleログインをキャンセルしました。');
  if(/unauthorized.domain/i.test(code))return new FriendsError('このプレビューのドメインをFirebaseの承認済みドメインに追加してください。');
  return new FriendsError('Firebaseへ接続できませんでした。通信環境と設定を確認して、もう一度お試しください。');
}
export async function firebaseSharingAPI(action,data={}){
  try{
    const s=await authorized(),group=friendsGroup();if(!group)throw new FriendsError('招待リンクで参加するか、友達のグループを作成してください。');
    const {ref,get,set,remove,query,orderByChild,equalTo}=s.dbSDK,base=`groups/${group}`,uid=currentUser.uid,day=japanDay();
    const photoPath=`${base}/photos/${data.photoId}`;
    const decorate=post=>({...post,own:post.author===uid,original:dailyTopic(post.day).original,modern:dailyTopic(post.day).modern,lines:dailyTopic(post.day).lines,stampCount:Object.values(post.stamps||{}).reduce((n,v)=>n+Object.keys(v).length,0),commentCount:Object.keys(post.comments||{}).length});
    if(action==='feed'){
      const snap=await get(query(ref(s.db,`${base}/photos`),orderByChild('day'),equalTo(day)));
      return {day,posts:Object.entries(snap.val()||{}).map(([id,p])=>decorate({...p,id})).sort((a,b)=>b.createdAt-a.createdAt),nextCursor:null};
    }
    if(action==='publish'){
      if(data.day!==day || data.topicId!==dailyTopic(day).id)throw new FriendsError('今日の写真を選択してください。');
      if(!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data.image||'') || data.image.length>1100000)throw new FriendsError('写真は1MB以内のJPEG・PNG・WebPを選んでください。');
      if((data.caption||'').length>120)throw new FriendsError('ひとことは120文字までです。');
      const id=`${day}_${uid}`,path=`${base}/photos/${id}`;
      // Update photo fields separately, preserving friends' comments and stamps.
      await s.dbSDK.update(ref(s.db,path),{author:uid,name:currentUser.displayName||'友達',day,topicId:data.topicId,image:data.image,caption:data.caption||'',createdAt:s.dbSDK.serverTimestamp()});return {id};
    }
    if(!/^[A-Za-z0-9_-]{1,180}$/.test(data.photoId||''))throw new FriendsError('写真を選択してください。');
    if(action==='detail'){
      const post=(await get(ref(s.db,photoPath))).val();if(!post)throw new FriendsError('写真は削除されています。');
      return {comments:Object.entries(post.comments||{}).map(([id,c])=>({...c,id,own:c.author===uid})).sort((a,b)=>a.createdAt-b.createdAt),stamps:REACTIONS.map(r=>({stamp:r.id,count:Object.keys(post.stamps?.[r.id]||{}).length})),mine:REACTIONS.filter(r=>post.stamps?.[r.id]?.[uid]===true).map(r=>r.id)};
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
