import {withLiveDevice} from './live-device.mjs';
export const APP_URL='https://mimiko5082-png.github.io/design-proto-/';
export const SCHEDULES={morning:{schedule:'0 8 * * *',time:'08:00'},night:{schedule:'50 23 * * *',time:'23:50'}};
export const DEVICE_TTL=90*86400000;
export function japanDay(time=Date.now()){return new Date(time+9*3600000).toISOString().slice(0,10);}
export function validRegistration(data){
  return !!data && /^[a-f0-9]{32}$/.test(data.deviceId||'') && typeof data.token==='string' && data.token.length>=20 && data.token.length<=4096 && /^[A-Za-z0-9_:\-]+$/.test(data.token);
}
export function notificationData(kind,day){
  const night=kind==='night';
  return {title:kind==='test'?'通知の設定ができました':night?'今日の景色、1枚残してみない？':'今日のお題、のぞいてみよう。',
    body:kind==='test'?'毎日8:00と23:50に、芭蕉のまなざしからお知らせします。':night?'今日の一枚を撮ったり、友達の写真を振り返ったりしてみよう。':'いつもの道に、まだ気づいていない一枚があるかも。今日のお題を見てみよう。',
    tag:`basho-fcm-${day}-${kind}`,url:APP_URL};
}
export function fcmMessage(token,kind,day,testId){
  // FCM's worker SDK displays notification payloads when no app window is visible.
  const data=notificationData(kind,day);
  // Separate test attempts must alert again rather than silently replace an old test.
  if(kind==='test'&&Number.isSafeInteger(testId))data.tag+=`-${testId}`;
  return {token,data,notification:{title:data.title,body:data.body},webpush:{
    headers:{TTL:kind==='test'?'300':'3600',Urgency:'high'},
    notification:{tag:data.tag,renotify:false,silent:false,vibrate:[200,100,200],icon:APP_URL+'assets/kotoba-icon-192.png',badge:APP_URL+'assets/kotoba-icon-192.png'},
    fcmOptions:{link:APP_URL},
  }};
}
export function terminalTokenError(error){return ['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(error?.code);}
export async function deliverDevice(ref,record,kind,day,{send,clock=Date.now}){
  return withLiveDevice(ref,async()=>{
    const claimAt=clock();
    const claimed=await ref.transaction(current=>{
      if(!current?.enabled||current.token!==record.token||current.updatedAt<claimAt-DEVICE_TTL)return;
      const last=current.deliveries?.[kind];
      if(last?.day===day && (last.state==='sent'||last.state==='sending'&&last.at>claimAt-300000))return;
      return {...current,deliveries:{...current.deliveries,[kind]:{day,state:'sending',at:claimAt}}};
    });
    if(!claimed.committed)return 'skipped';
    try{
      await send(fcmMessage(record.token,kind,day));
      await ref.transaction(current=>{
        if(!current||current.token!==record.token||current.deliveries?.[kind]?.at!==claimAt)return;
        return {...current,deliveries:{...current.deliveries,[kind]:{day,state:'sent',at:clock()}}};
      });
      return 'sent';
    }catch(error){
      await ref.transaction(current=>{
        if(!current||current.token!==record.token||current.deliveries?.[kind]?.at!==claimAt)return;
        if(terminalTokenError(error))return null;
        return {...current,deliveries:{...current.deliveries,[kind]:{day,state:'failed',at:clock()}}};
      });
      return terminalTokenError(error)?'expired':'failed';
    }
  });
}
export async function sendScheduled(db,send,kind,clock=Date.now,scheduledAt=clock()){
  const counts={sent:0,skipped:0,expired:0,failed:0},day=japanDay(scheduledAt);let after;
  for(;;){
    let query=db.ref('fcmDevices').orderByKey();if(after)query=query.startAfter(after);
    const snapshot=await query.limitToFirst(200).get(),rows=[];snapshot.forEach(child=>{rows.push(child);});
    if(!rows.length)break;
    for(let start=0;start<rows.length;start+=20){
      await Promise.all(rows.slice(start,start+20).map(async row=>{
        const record=row.val();
        if(record.updatedAt<clock()-DEVICE_TTL){await withLiveDevice(row.ref,()=>row.ref.transaction(current=>current?.updatedAt<clock()-DEVICE_TTL?null:undefined));counts.expired++;return;}
        const result=await deliverDevice(row.ref,record,kind,day,{send,clock});counts[result]++;
      }));
    }
    after=rows.at(-1).key;if(rows.length<200)break;
  }
  return counts;
}
