import {initializeApp} from 'firebase-admin/app';
import {getDatabase} from 'firebase-admin/database';
import {getMessaging} from 'firebase-admin/messaging';
import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {setGlobalOptions} from 'firebase-functions/v2';
import {withLiveDevice} from './live-device.mjs';
import {validRegistration,fcmMessage,japanDay,sendScheduled,SCHEDULES,terminalTokenError} from './delivery.mjs';
initializeApp({databaseURL:process.env.FIREBASE_DATABASE_URL||'https://basho-friends-default-rtdb.asia-southeast1.firebasedatabase.app'});
setGlobalOptions({region:'asia-northeast1',maxInstances:3});
const db=()=>getDatabase(),messaging=()=>getMessaging();
const callable={cors:['https://mimiko5082-png.github.io',/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/],timeoutSeconds:30};
function identity(request){
  if(!request.auth || request.auth.token.firebase?.sign_in_provider!=='google.com')throw new HttpsError('unauthenticated','Googleでログインしてください。');
  if(!/^[a-f0-9]{32}$/.test(request.data?.deviceId||''))throw new HttpsError('invalid-argument','端末情報を確認できません。');
  return {uid:request.auth.uid,deviceId:request.data.deviceId};
}
export const fcmRegisterDevice=onCall(callable,async request=>{
  const {uid,deviceId}=identity(request),data=request.data;
  if(!validRegistration(data))throw new HttpsError('invalid-argument','通知の登録情報が正しくありません。');
  const ref=db().ref(`fcmDevices/${deviceId}`);
  const devices=(await db().ref('fcmDevices').orderByChild('uid').equalTo(uid).limitToFirst(11).get()).val()||{};
  if(Object.keys(devices).length>=10&&!devices[data.deviceId])throw new HttpsError('resource-exhausted','登録できる端末は10台までです。不要な端末の通知を停止してください。');
  let forbidden=false;
  const result=await ref.transaction(current=>{
    if(current&&current.uid!==uid&&current.token!==data.token){forbidden=true;return;}
    return {uid,token:data.token,enabled:true,createdAt:current?.createdAt||Date.now(),updatedAt:Date.now(),testAt:current?.uid===uid?current.testAt||0:0,deliveries:current?.uid===uid?current.deliveries||{}:{}};
  });
  if(forbidden||!result.committed)throw new HttpsError('permission-denied','端末の通知情報を登録できません。');
  return {enabled:true,times:['08:00','23:50'],timeZone:'Asia/Tokyo'};
});
export const fcmDeviceStatus=onCall(callable,async request=>{
  const {uid,deviceId}=identity(request),ref=db().ref(`fcmDevices/${deviceId}`),record=(await ref.get()).val();
  return {enabled:record?.uid===uid&&record.enabled===true,times:['08:00','23:50'],timeZone:'Asia/Tokyo'};
});
export const fcmDisableDevice=onCall(callable,async request=>{
  const {uid,deviceId}=identity(request),ref=db().ref(`fcmDevices/${deviceId}`);let forbidden=false;
  await ref.transaction(current=>{if(current&&current.uid!==uid){forbidden=true;return;}return null;});
  if(forbidden)throw new HttpsError('permission-denied','この端末の通知を停止できません。');
  return {enabled:false};
});
export const fcmTestNotification=onCall(callable,async request=>{
  const {uid,deviceId}=identity(request),ref=db().ref(`fcmDevices/${deviceId}`),at=Date.now();
  return withLiveDevice(ref,async()=>{
    const claim=await ref.transaction(current=>{
      if(!current?.enabled||current.uid!==uid||at-(current.testAt||0)<60000)return;
      return {...current,testAt:at};
    });
    if(!claim.committed)throw new HttpsError('failed-precondition','通知を有効にしてからお試しください。テストは1分に1回までです。');
    const record=claim.snapshot.val();
    try{await messaging().send(fcmMessage(record.token,'test',japanDay()));}
    catch(error){
      if(terminalTokenError(error))await ref.transaction(current=>current?.token===record.token?null:undefined);
      const code=/^[a-z-]+\/[a-z0-9-]+$/.test(error?.code||'')?error.code:'messaging/unknown-error';
      console.warn('FCM test send failed',{code});
      const reason=['messaging/authentication-error','messaging/mismatched-credential','messaging/sender-id-mismatch','app/invalid-credential'].includes(code)?'FCM_SERVER_PERMISSION':code==='messaging/third-party-auth-error'?'FCM_WEBPUSH_KEY':terminalTokenError(error)?'FCM_TOKEN_EXPIRED':'FCM_SEND_FAILED';
      throw new HttpsError('unavailable','テスト通知を送信できませんでした。',{reason,code});
    }
    return {accepted:true};
  });
});
async function daily(kind,event){
  // Use Scheduler's intended time, so retries after midnight do not use the next day.
  const time=Date.parse(event.scheduleTime);
  const counts=await sendScheduled(db(),message=>messaging().send(message),kind,Date.now,Number.isFinite(time)?time:Date.now());
  console.info('FCM scheduled delivery',kind,counts);
  if(counts.failed)throw new Error('Some notifications require retry');
}
const scheduler=kind=>({schedule:SCHEDULES[kind].schedule,timeZone:'Asia/Tokyo',retryCount:3,minBackoffSeconds:60,maxBackoffSeconds:300,timeoutSeconds:540});
export const fcmMorning=onSchedule(scheduler('morning'),event=>daily('morning',event));
export const fcmNight=onSchedule(scheduler('night'),event=>daily('night',event));
