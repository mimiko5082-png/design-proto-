// Classic service-worker script. A push has no payload or user-supplied URL.
self.addEventListener("push", event => {
  const japan = new Date(Date.now() + 9 * 3600000);
  const day = japan.toISOString().slice(0, 10);
  const night = japan.getUTCHours() === 23 && japan.getUTCMinutes() >= 50;
  event.waitUntil(self.registration.showNotification(night ? "今日の景色、1枚残してみない？" : "今日のお題、のぞいてみよう。", {
    body: night ? "まだなら、身近なところで一枚。撮った写真がある人は、今日の発見を振り返ってみよう。" : "いつもの道に、まだ気づいていない一枚があるかも。芭蕉のお題をヒントに探してみよう。",
    icon: new URL("assets/kotoba-icon-192.png", self.registration.scope).href,
    badge: new URL("assets/kotoba-icon-192.png", self.registration.scope).href,
    tag: "basho-daily-" + day + (night ? "-night" : "-morning"),
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
