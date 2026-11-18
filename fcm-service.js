import {friendsSession} from './firebase-friends.js?v=77';
import {notificationSupport,applicationKey} from './notification-service.js';
const VERSION='12.11.0',KEY='basho_fcm_device_v1';
export function notificationEnvironment(){
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  return notificationSupport({ios,standalone:matchMedia('(display-mode: standalone)').matches||navigator.standalone,
    notifications:'Notification' in window,push:'PushManager' in window,serviceWorker:'serviceWorker' in navigator});
}
export function deviceID(){
  let id=localStorage.getItem(KEY);
  if(!/^[a-f0-9]{32}$/.test(id||'')){id=crypto.randomUUID().replaceAll('-','');localStorage.setItem(KEY,id);}
  return id;
}
export function notificationError(error){
  const code=String(error?.code||'');
  if(error?.details?.reason==='FCM_DEVICE_MISSING')return 'この端末の通知登録がサーバーにありません（FCM_DEVICE_MISSING）。管理者にこの表示を伝えてください。';
  if(error?.details?.reason==='FCM_DEVICE_ACCOUNT')return '通知登録とログイン中のGoogleアカウントが一致しません（FCM_DEVICE_ACCOUNT）。通知を停止せず、登録したアカウントでログインしてください。';
  if(error?.details?.reason==='FCM_DEVICE_DISABLED')return 'この端末の通知登録が停止されています（FCM_DEVICE_DISABLED）。「通知を受け取る」から有効にしてください。';
  if(error?.details?.reason==='FCM_TEST_COOLDOWN'){
    const seconds=Number(error.details.retryAfterSeconds);
    const wait=Number.isFinite(seconds)?Math.max(1,Math.min(60,Math.ceil(seconds))):60;
    return `前のテスト送信から1分以内です。あと${wait}秒待って再試行してください（FCM_TEST_COOLDOWN）。`;
  }
  if(error?.details?.reason==='FCM_TEST_CONFLICT')return '通知登録が同時に変更されたため送信できませんでした（FCM_TEST_CONFLICT）。「設定を再確認」を押してください。';
  if(error?.details?.reason==='FCM_SERVER_PERMISSION')return '通知サーバーの送信権限を確認する必要があります。管理者にこの表示を伝えてください。';
  if(error?.details?.reason==='FCM_WEBPUSH_KEY')return 'Firebaseに登録したWeb Push公開鍵の確認が必要です。管理者にこの表示を伝えてください。';
  if(error?.details?.reason==='FCM_TOKEN_EXPIRED')return 'この端末の通知登録が失効しています。通知を停止してから、もう一度登録してください。';
  if(/deadline-exceeded/.test(code))return '15秒以内に送信結果を確認できませんでした。遅れて届く場合があります。1分待ってから再試行してください。';
  if(/permission-blocked|permission-default/.test(code))return '通知が許可されていません。端末・ブラウザの設定で通知を許可してください。';
  if(/unauthenticated/.test(code))return 'Googleでログインしてから通知を設定してください。';
  if(/resource-exhausted/.test(code))return '登録できる端末は10台までです。不要な端末の通知を停止してください。';
  if(/failed-precondition/.test(code))return '通知サーバーから詳しい停止理由を取得できませんでした（FCM_TEST_LEGACY）。管理者にこの表示を伝えてください。';
  if(/not-found|unavailable|internal/.test(code))return '通知サーバーに接続できません。設定・デプロイ状況と通信を確認して再試行してください。';
  if(/unsupported-browser/.test(code))return 'このブラウザではFCM通知を利用できません。対応ブラウザ、またはホーム画面に追加したアプリから開いてください。';
  return '通知の処理を完了できませんでした。通信・ブラウザの設定を確認して再試行してください。';
}
export async function fcmSession(){
  const session=await friendsSession();
  if(!session.auth.currentUser)throw Object.assign(new Error('Sign in required'),{code:'functions/unauthenticated'});
  const [sdk,functionsSDK]=await Promise.all(['firebase-messaging.js','firebase-functions.js'].map(file=>import(/* @vite-ignore */`https://www.gstatic.com/firebasejs/${VERSION}/${file}`)));
  if(!await sdk.isSupported())throw Object.assign(new Error('Unsupported'),{code:'messaging/unsupported-browser'});
  const messaging=sdk.getMessaging(session.auth.app),functions=functionsSDK.getFunctions(session.auth.app,window.BASHO_FCM?.region||'asia-northeast1');
  const registration=await navigator.serviceWorker.register(new URL('./sw.js?v=fcm7',import.meta.url),{scope:new URL('./',import.meta.url).href,updateViaCache:'none'});
  await navigator.serviceWorker.ready;
  const call=async(name,data={})=>(await functionsSDK.httpsCallable(functions,name,{timeout:15000})({deviceId:deviceID(),...data})).data;
  return {sdk,messaging,registration,call};
}
export async function refreshFcmDevice(session){
  const status=await session.call('fcmDeviceStatus');session.registered=!!status.enabled;
  if(status.enabled && Notification.permission==='granted'){
    const token=await session.sdk.getToken(session.messaging,{vapidKey:window.BASHO_FCM.vapidKey,serviceWorkerRegistration:session.registration});
    if(!token)throw new Error('Missing token');
    await session.call('fcmRegisterDevice',{token});
  }
  return status.enabled && Notification.permission==='granted';
}
export async function enableFcm(session){
  const existing=await session.registration.pushManager.getSubscription();
  if(existing){
    const expected=applicationKey(window.BASHO_FCM.vapidKey),actual=new Uint8Array(existing.options.applicationServerKey||[]);
    if(actual.length!==expected.length||actual.some((byte,index)=>byte!==expected[index])){await session.sdk.deleteToken(session.messaging);await existing.unsubscribe();}
  }
  const token=await session.sdk.getToken(session.messaging,{vapidKey:window.BASHO_FCM.vapidKey,serviceWorkerRegistration:session.registration});
  if(!token)throw new Error('Missing token');
  await session.call('fcmRegisterDevice',{token});
}
export async function disableFcm(session){
  // Stop server delivery first; a failed deletion remains retryable in the UI.
  await session.call('fcmDisableDevice');
  try{await session.sdk.deleteToken(session.messaging);return true;}catch{return false;}
}
let stopForeground;
export function stopFcmReceiver(){stopForeground?.();stopForeground=null;}
export function startFcmReceiver(session){
  stopFcmReceiver();
  stopForeground=session.sdk.onMessage(session.messaging,async payload=>{
    const data=payload.data||{};
    if(typeof data.title!=='string'||typeof data.body!=='string')return;
    try{await session.registration.showNotification(data.title.slice(0,120),{body:data.body.slice(0,300),tag:String(data.tag||'basho-fcm').slice(0,100),renotify:false,silent:false,vibrate:[200,100,200],icon:new URL('./assets/kotoba-icon-192.png',import.meta.url).href,data:{url:new URL('./',import.meta.url).href}});window.dispatchEvent(new Event('basho-fcm-received'));}
    catch{window.dispatchEvent(new Event('basho-fcm-display-error'));}
  });
}
