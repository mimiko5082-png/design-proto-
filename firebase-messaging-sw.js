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
    body:data.body.slice(0,300),tag:String(data.tag||'basho-fcm').slice(0,100),renotify:false,silent:false,vibrate:[200,100,200],
    icon:new URL('assets/kotoba-icon-192.png',self.registration.scope).href,
    badge:new URL('assets/kotoba-icon-192.png',self.registration.scope).href,
    data:{url:new URL('./',self.registration.scope).href},
  });
}
self.addEventListener('push',event=>{
  if(!event.data)return;
  // Always display from the push event itself, also while the Firebase SDK is available.
  // The SDK only forwards a message to the page while the app is visible, and iOS revokes a
  // subscription after pushes that end without a notification. The shared tag (renotify:false)
  // lets the SDK's or the page's own display replace this one without a second alert.
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
}catch{
  console.warn('FCM SDK unavailable; using the native data-message notification handler.');
}
