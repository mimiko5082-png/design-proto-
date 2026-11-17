import {friendsSession,friendsProfile} from './firebase-friends.js?v=76';
import {fcmSession,refreshFcmDevice,startFcmReceiver,stopFcmReceiver,notificationEnvironment} from './fcm-service.js';
let revision=0,busy=false,pending=false;
async function initialize(){
  if(busy){pending=true;return;}
  if(notificationEnvironment()||Notification.permission!=='granted')return;
  busy=true;const attempt=revision;
  try{
    await friendsSession();if(!friendsProfile())return;
    const session=await fcmSession();
    if(attempt!==revision)return;
    startFcmReceiver(session);
    await refreshFcmDevice(session);
  }catch{/* The settings screen reports failures and offers a retry. */}
  finally{busy=false;if(pending){pending=false;queueMicrotask(initialize);}}
}
window.addEventListener('basho-auth-changed',()=>{revision++;stopFcmReceiver();initialize();});
window.addEventListener('focus',initialize);
initialize();
