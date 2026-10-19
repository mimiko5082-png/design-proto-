// Classic service-worker script. A push has no payload or user-supplied URL.
self.addEventListener("push", event => {
  const day = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  event.waitUntil(self.registration.showNotification("今日のまなざしの時間です", {
    body: "30秒、スマホを下ろして街を見てみよう。",
    icon: new URL("assets/kotoba-icon-192.png", self.registration.scope).href,
    badge: new URL("assets/kotoba-icon-192.png", self.registration.scope).href,
    tag: "basho-daily-" + day,
    renotify: false,
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const scope = new URL(self.registration.scope);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      const url = new URL(client.url);
      if (url.origin === scope.origin && url.pathname.startsWith(scope.pathname)) return client.focus();
    }
    return self.clients.openWindow(new URL("index.html", scope).href);
  })());
});
