// Private per-user pointer. Membership itself remains enforced by groups/$group rules.
export const GROUP_KEY='basho_firebase_friends_group_v1';
const valid=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(id);
export async function syncFriendsGroup(session,uid,group,timeoutMs=5000){
  if(!valid(group))return false;
  let timer;
  try{await Promise.race([session.dbSDK.set(session.dbSDK.ref(session.db,`userGroups/${uid}`),{groupId:group}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('index sync timeout')),timeoutMs);})]);return true;}
  catch{return false;}
  finally{clearTimeout(timer);} // Joining remains valid even if index rules are awaiting deployment.
}
export async function restoreFriendsGroup(session,uid,storage,isCurrent=()=>true){
  const {get,ref}=session.dbSDK;let remote;
  try{remote=(await get(ref(session.db,`userGroups/${uid}`))).val()?.groupId;}
  catch(error){if(!/permission.denied/i.test(String(error?.code||error?.message||'')))throw error;}
  const local=storage.getItem(`${GROUP_KEY}:${uid}`);
  for(const group of [...new Set([remote,local].filter(valid))]){
    const member=await get(ref(session.db,`groups/${group}/members/${uid}`));
    if(!isCurrent())return '';
    if(member.exists()){
      storage.setItem(`${GROUP_KEY}:${uid}`,group);
      if(group!==remote)await syncFriendsGroup(session,uid,group);
      return group;
    }
  }
  if(isCurrent()&&local)storage.removeItem(`${GROUP_KEY}:${uid}`);
  return '';
}
