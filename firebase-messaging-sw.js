// Loaded by the existing, correctly scoped GitHub Pages service worker.
// Register our click handler before Firebase's own listeners.
self.addEventListener('notificationclick',event=>{
  event.stopImmediatePropagation();
  event.notification.close();
  const target=new URL('./',self.registration.scope).href;
  event.waitUntil((async()=>{
    for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true})){
      const url=new URL(client.url),scope=new URL(self.registration.scope);
      if(url.origin===scope.origin&&url.pathname.startsWith(scope.pathname)){
        await client.navigate(target);return client.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
function showFcmNotification(payload){
  const data={...payload.data,...payload.notification};
  if(typeof data.title!=='string'||typeof data.body!=='string')return;
  return self.registration.showNotification(data.title.slice(0,120),{
    body:data.body.slice(0,300),tag:String(data.tag||'basho-fcm').slice(0,100),renotify:false,
    icon:new URL('assets/kotoba-icon-192.png',self.registration.scope).href,
    badge:new URL('assets/kotoba-icon-192.png',self.registration.scope).href,
    data:{url:new URL('./',self.registration.scope).href},
  });
}
let firebaseReady=false;
self.addEventListener('push',event=>{
  if(firebaseReady||!event.data)return;
  // Native fallback for both notification and legacy data-only messages.
  event.waitUntil((async()=>{let payload;try{payload=event.data.json();}catch{return;}await showFcmNotification(payload);})());
});
try{
  importScripts('./firebase-friends-config.js','https://www.gstatic.com/firebasejs/12.11.0/firebase-app-compat.js','https://www.gstatic.com/firebasejs/12.11.0/firebase-messaging-compat.js');
  firebase.initializeApp(globalThis.BASHO_FRIENDS_FIREBASE);
  firebase.messaging().onBackgroundMessage(payload=>{
    // The SDK has already displayed notification payloads before this callback.
    // Older deployed senders may still send data-only payloads.
    if(!payload.notification)return showFcmNotification(payload);
  });
  firebaseReady=true;
}catch{
  console.warn('FCM SDK unavailable; using the native data-message notification handler.');
}
