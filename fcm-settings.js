import {friendsSession,friendsSignIn,friendsProfile} from './firebase-friends.js?v=76';
import {notificationEnvironment,notificationError,fcmSession,refreshFcmDevice,enableFcm,disableFcm,startFcmReceiver} from './fcm-service.js';
class FcmSettings extends HTMLElement{
  connectedCallback(){
    this.revision=0;this.enabled=false;this.registered=false;this.busy=false;this.session=null;
    this.innerHTML=`<section class="place-attach daily-notifications" aria-label="プッシュ通知の設定"><h2>写真のお題をプッシュ通知</h2><p>毎日8:00と23:50（日本時間）にお知らせします。アプリを閉じていても受信できます。</p><p>iPhone・iPadでは、Safariの共有メニューから「ホーム画面に追加」し、そのアイコンから開いてください（iOS/iPadOS 16.4以降）。</p><p>端末の省電力設定・集中モードや通信状況により、配信が遅れる場合があります。</p><p data-fcm-status role="status" aria-live="polite">通知設定を確認しています…</p><button class="outline-button" data-fcm-login hidden>Googleでログインする</button><button class="outline-button" data-fcm-enable disabled>通知を受け取る</button><button class="outline-button" data-fcm-disable hidden>この端末の通知を停止</button><button class="outline-button" data-fcm-test hidden>テスト通知を送る</button><button class="outline-button" data-fcm-retry>設定を再確認</button></section>`;
    this.querySelector('[data-fcm-enable]').onclick=()=>this.enable();
    this.querySelector('[data-fcm-disable]').onclick=()=>this.disable();
    this.querySelector('[data-fcm-test]').onclick=()=>this.test();
    this.querySelector('[data-fcm-retry]').onclick=()=>this.initialize();
    this.querySelector('[data-fcm-login]').onclick=async()=>{try{await friendsSignIn();await this.initialize();}catch(error){this.message(notificationError(error));}};
    this.onAuth=()=>{++this.revision;this.session=null;this.enabled=false;this.registered=false;this.busy=false;this.paint();this.initialize();};
    window.addEventListener('basho-auth-changed',this.onAuth);
    this.initialize();
  }
  disconnectedCallback(){++this.revision;window.removeEventListener('basho-auth-changed',this.onAuth);}
  message(value){if(this.isConnected)this.querySelector('[data-fcm-status]').textContent=value;}
  paint(){
    if(!this.isConnected)return;
    for(const button of this.querySelectorAll('button'))button.disabled=this.busy;
    this.querySelector('[data-fcm-login]').hidden=!!friendsProfile()||!!this.unsupported;
    this.querySelector('[data-fcm-enable]').hidden=this.enabled||!!this.unsupported;
    this.querySelector('[data-fcm-enable]').disabled=this.busy||!this.session||Notification.permission==='denied';
    this.querySelector('[data-fcm-disable]').hidden=!this.registered;
    this.querySelector('[data-fcm-test]').hidden=!this.enabled;
  }
  async initialize(){
    const revision=++this.revision;this.busy=true;this.session=null;this.enabled=false;this.registered=false;
    this.unsupported=notificationEnvironment();
    if(this.unsupported){this.busy=false;this.message(this.unsupported);this.paint();return;}
    this.message('通知設定を確認しています…');this.paint();
    try{
      await friendsSession();if(revision!==this.revision||!this.isConnected)return;
      if(!friendsProfile()){this.message('Googleでログインしてから、この端末の通知を設定してください。');return;}
      const session=await fcmSession();const enabled=await refreshFcmDevice(session);
      if(revision!==this.revision||!this.isConnected)return;
      this.session=session;this.enabled=enabled;this.registered=session.registered;
      startFcmReceiver(session);
      this.message(this.enabled?'この端末は毎日8:00と23:50の通知を受け取ります。':Notification.permission==='denied'?'通知がブロックされています。端末・ブラウザの設定から許可してください。':'通知は任意です。「通知を受け取る」を押すと、通知の許可を確認します。');
    }catch(error){if(revision===this.revision)this.message(notificationError(error));}
    finally{if(revision===this.revision&&this.isConnected){this.busy=false;this.paint();}}
  }
  async enable(){
    if(this.busy||!this.session)return;
    const permission=Notification.requestPermission(); // Must start inside the button's user gesture.
    const revision=this.revision;this.busy=true;this.paint();
    try{
      if(await permission!=='granted'){this.message('通知は許可されませんでした。必要なときに端末の設定から変更できます。');return;}
      await enableFcm(this.session);if(revision!==this.revision)return;
      this.enabled=true;this.registered=true;this.message('登録しました。毎日8:00と23:50（日本時間）に通知します。');
    }catch(error){if(revision===this.revision)this.message(notificationError(error));}
    finally{if(revision===this.revision){this.busy=false;this.paint();}}
  }
  async disable(){
    if(this.busy||!this.session)return;const revision=this.revision;this.busy=true;this.paint();
    try{const removed=await disableFcm(this.session);if(revision!==this.revision)return;this.enabled=false;this.registered=false;this.message(removed?'この端末の通知を停止しました。':'通知の送信を停止しました。ブラウザ内の登録削除は未確認です。');}
    catch(error){if(revision===this.revision)this.message(notificationError(error));}
    finally{if(revision===this.revision){this.busy=false;this.paint();}}
  }
  async test(){
    if(this.busy||!this.enabled)return;const revision=this.revision;this.busy=true;this.paint();
    try{await this.session.call('fcmTestNotification');if(revision===this.revision)this.message('FCMにテスト通知の送信を依頼しました。端末での受信を確認してください。');}
    catch(error){if(revision===this.revision)this.message(notificationError(error));}
    finally{if(revision===this.revision){this.busy=false;this.paint();}}
  }
}
customElements.define('basho-fcm-settings',FcmSettings);
