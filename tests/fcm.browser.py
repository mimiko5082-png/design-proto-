"""FCM settings using real client code and mocked Firebase SDK/callables; no real pushes."""
import os,json,threading
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent.parent
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
AUTH='''
window.fcmUser={id:'alice',name:'Alice',confirmed:true};
export const friendsProfile=()=>window.fcmUser;
export const friendsSession=async()=>({auth:{app:{name:'basho-friends'},currentUser:window.fcmUser}});
export const friendsSignIn=async()=>{window.fcmUser={id:'alice',confirmed:true};window.dispatchEvent(new Event('basho-auth-changed'));};
'''
MESSAGING='''
export const isSupported=async()=>!window.sdkUnsupported;
export const getMessaging=app=>({app});
export async function getToken(messaging,options){window.tokenOptions={vapidKey:options.vapidKey,scope:options.serviceWorkerRegistration.scope};return 'mock_fcm_token_'.repeat(5);}
export async function deleteToken(){window.deletedTokens=(window.deletedTokens||0)+1;return true;}
export function onMessage(messaging,fn){window.receiveFcm=fn;return ()=>{window.receiveFcm=null;};}
'''
FUNCTIONS='''
export const getFunctions=(app,region)=>{window.functionRegion=region;return {app,region};};
export const httpsCallable=(instance,name,options)=>async data=>{
 window.callOptions=options;
 if(name==='fcmTestNotification'&&window.holdTest)await new Promise(resolve=>window.releaseTest=resolve);
 window.calls.push({name,data});
 if(window.callError)throw {code:window.callError,details:window.callDetails,message:'DO_NOT_SHOW_SECRET'};
 if(name==='fcmDeviceStatus')return {data:{enabled:window.serverEnabled||false}};
 if(name==='fcmRegisterDevice'){window.serverEnabled=true;return {data:{enabled:true}};}
 if(name==='fcmDisableDevice'){window.serverEnabled=false;return {data:{enabled:false}};}
 return {data:{accepted:true}};
};
'''
INIT='''
window.calls=[];window.notices=[];window.permissionValue='default';window.permissionRequests=0;
window.Notification={get permission(){return window.permissionValue;},requestPermission(){window.permissionRequests++;window.permissionInGesture=navigator.userActivation.isActive;window.permissionValue=window.permissionResult||'granted';return Promise.resolve(window.permissionValue);}};
window.PushManager=function(){};
const registration={scope:location.origin+'/',pushManager:{getSubscription:async()=>window.oldSubscription||null},showNotification:async(title,options)=>{if(window.failDisplay)throw new Error('Display unavailable');window.notices.push({title,options});}};
Object.defineProperty(navigator,'serviceWorker',{value:{register:async(url,options)=>{window.workerURL=url;window.workerScope=options.scope;return registration;},ready:Promise.resolve(registration)}});
'''
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None,args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':390,'height':844});errors=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.add_init_script(INIT)
  page.route('**/firebase-friends.js*',lambda route:route.fulfill(content_type='text/javascript',body=AUTH))
  page.route('https://www.gstatic.com/firebasejs/**/firebase-messaging.js',lambda route:route.fulfill(content_type='text/javascript',body=MESSAGING))
  page.route('https://www.gstatic.com/firebasejs/**/firebase-functions.js',lambda route:route.fulfill(content_type='text/javascript',body=FUNCTIONS))
  page.route('**/fcm-test',lambda route:route.fulfill(content_type='text/html',body='<link rel="stylesheet" href="/basho-styles.css"><script src="/fcm-config.js"></script><script type="module" src="/fcm-settings.js"></script><basho-fcm-settings></basho-fcm-settings>'))
  base=f'http://127.0.0.1:{server.server_port}'
  page.goto(base+'/fcm-test',wait_until='networkidle')
  enable=page.get_by_role('button',name='通知を受け取る',exact=True)
  expect(enable).to_be_enabled()
  assert page.evaluate('window.permissionRequests')==0
  # An old VAPID subscription is retired only when the user opts into FCM.
  page.evaluate('window.oldSubscription={options:{applicationServerKey:new Uint8Array([1,2,3]).buffer},unsubscribe:async()=>{window.retired=true;return true;}}')
  enable.click()
  expect(page.locator('[data-fcm-status]')).to_contain_text('登録しました')
  assert page.evaluate('window.permissionInGesture')
  assert page.evaluate('window.retired')
  assert page.evaluate('window.functionRegion')=='asia-northeast1'
  assert page.evaluate('window.tokenOptions.vapidKey')==page.evaluate('window.BASHO_FCM.vapidKey')
  assert page.evaluate('window.calls.some(c=>c.name==="fcmRegisterDevice" && /^[a-f0-9]{32}$/.test(c.data.deviceId))')
  page.evaluate('window.holdTest=true')
  page.get_by_role('button',name='テスト通知を送る',exact=True).click()
  expect(page.locator('[data-fcm-status]')).to_contain_text('テスト通知を送信しています')
  expect(page.get_by_role('button',name='送信中…',exact=True)).to_be_disabled()
  page.wait_for_function('typeof window.releaseTest==="function"')
  page.evaluate('window.releaseTest();window.holdTest=false')
  expect(page.locator('[data-fcm-status]')).to_contain_text('端末での受信を確認')
  assert page.evaluate('window.callOptions.timeout')==15000
  page.evaluate('window.callError="functions/deadline-exceeded"')
  page.get_by_role('button',name='テスト通知を送る',exact=True).click()
  expect(page.locator('[data-fcm-status]')).to_contain_text('15秒以内')
  expect(page.get_by_role('button',name='テスト通知を送る',exact=True)).to_be_enabled()
  page.evaluate('window.callError="functions/unavailable";window.callDetails={reason:"FCM_SERVER_PERMISSION"}')
  page.get_by_role('button',name='テスト通知を送る',exact=True).click()
  expect(page.locator('[data-fcm-status]')).to_contain_text('送信権限')
  for reason,text in [('FCM_DEVICE_MISSING','サーバーにありません'),('FCM_DEVICE_ACCOUNT','アカウントが一致しません'),('FCM_DEVICE_DISABLED','停止されています'),('FCM_TEST_COOLDOWN','あと12秒'),('FCM_TEST_CONFLICT','同時に変更')]:
   page.evaluate('(reason)=>{window.callError="functions/failed-precondition";window.callDetails={reason,retryAfterSeconds:12};}',reason)
   page.get_by_role('button',name='テスト通知を送る',exact=True).click()
   expect(page.locator('[data-fcm-status]')).to_contain_text(text)
   expect(page.locator('[data-fcm-status]')).to_contain_text(reason)
  page.evaluate('window.callDetails=null')
  page.get_by_role('button',name='テスト通知を送る',exact=True).click()
  expect(page.locator('[data-fcm-status]')).to_contain_text('FCM_TEST_LEGACY')
  page.evaluate('window.callError="";window.callDetails=null')
  page.evaluate("window.receiveFcm({data:{title:'朝のお題',body:'お題を見よう',tag:'morning',url:'https://evil.example'}})")
  expect(page.locator('[data-fcm-status]')).to_contain_text('この端末で通知を受信しました')
  assert page.evaluate('window.notices.length')==1
  assert page.evaluate('window.notices[0].options.data.url')==base+'/'
  page.evaluate("window.failDisplay=true;window.receiveFcm({data:{title:'テスト',body:'表示失敗の確認'}})")
  expect(page.locator('[data-fcm-status]')).to_contain_text('端末で表示できませんでした')
  page.evaluate('window.failDisplay=false')
  page.get_by_role('button',name='この端末の通知を停止',exact=True).click()
  expect(page.locator('[data-fcm-status]')).to_contain_text('通知を停止しました')
  assert not page.evaluate('window.serverEnabled')
  # Permission denial never registers a device.
  before=page.evaluate('window.calls.filter(c=>c.name==="fcmRegisterDevice").length')
  page.evaluate('window.permissionValue="default";window.permissionResult="denied"')
  enable.click()
  expect(page.locator('[data-fcm-status]')).to_contain_text('許可されませんでした')
  assert page.evaluate('window.calls.filter(c=>c.name==="fcmRegisterDevice").length')==before
  # Server failures keep the UI retryable and do not leak raw exception details.
  page.evaluate('window.permissionValue="granted";window.callError="functions/unavailable"')
  page.get_by_role('button',name='設定を再確認',exact=True).click()
  expect(page.locator('[data-fcm-status]')).to_contain_text('デプロイ状況')
  expect(page.locator('body')).not_to_contain_text('DO_NOT_SHOW_SECRET')
  page.evaluate('window.callError=""')
  page.get_by_role('button',name='設定を再確認',exact=True).click()
  expect(enable).to_be_enabled()
  for width in [320,390]:
   page.set_viewport_size({'width':width,'height':844})
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.evaluate('window.fcmUser=null;window.dispatchEvent(new Event("basho-auth-changed"))')
  expect(page.get_by_role('button',name='Googleでログインする',exact=True)).to_be_visible()
  expect(enable).to_be_disabled()
  # The iPhone installation instruction is shown once, with no permission request.
  page.add_init_script("Object.defineProperty(navigator,'userAgent',{value:'iPhone'});Object.defineProperty(navigator,'standalone',{value:false});")
  page.reload(wait_until='networkidle')
  expect(page.locator('[data-fcm-status]')).to_contain_text('ホーム画面に追加')
  expect(page.locator('[data-fcm-ios-help]')).to_be_hidden()
  assert page.evaluate('window.permissionRequests')==0
  assert not errors,errors
  browser.close()
  print('FCM settings: consent, token/region/scope, migration, foreground display, test/stop, denial, retry, auth reset and mobile passed; no real FCM requests.')
finally:server.shutdown()
