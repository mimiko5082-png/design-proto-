import { notificationSupport, pushAPI, applicationKey, newPushToken, endpointID } from "./notification-service.js";

class BashoNotifications extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `<section class="place-attach daily-notifications" aria-label="1日1回の通知">
      <h2>今日の写真のお題を通知</h2>
      <p data-notification-window>毎日、日本時間9〜21時のランダムなタイミングで1回。みんなに同じタイミングで、写真のお題を届けます。</p>
      <p>通知は任意です。端末の設定や通信状態によって、遅れたり届かない場合があります。</p>
      <p data-notification-status role="status" aria-live="polite">通知の設定を確認しています…</p>
      <button class="outline-button" type="button" data-notification-enable disabled>1日1回の通知を受け取る</button>
      <button class="outline-button" type="button" data-notification-disable hidden>通知を停止する</button>
      <button class="outline-button" type="button" data-notification-test hidden>テスト通知を送る（任意・通常通知とは別）</button>
      <button class="outline-button" type="button" data-notification-retry hidden>設定を再確認する</button>
    </section>`;
    this.endpoint = window.BASHO_NOTIFICATIONS?.endpoint || "";
    this.enabled = false; this.busy = false;
    this.button("enable").addEventListener("click", () => this.enable());
    this.button("disable").addEventListener("click", () => this.disable());
    this.button("test").addEventListener("click", () => this.test());
    this.button("retry").addEventListener("click", () => this.initialize());
    this.initialize();
  }
  button(name) { return this.querySelector(`[data-notification-${name}]`); }
  message(text) { if (this.isConnected) this.querySelector("[data-notification-status]").textContent = text; }
  paint() {
    if (!this.isConnected) return;
    this.button("enable").hidden = this.enabled;
    this.button("enable").disabled = this.busy || !this.config;
    this.button("disable").hidden = !this.record;
    this.button("test").hidden = !this.enabled;
    for (const name of ["disable", "test", "retry"]) this.button(name).disabled = this.busy;
  }
  async initialize() {
    this.config = null;
    this.button("retry").hidden = true;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const unsupported = notificationSupport({ ios, standalone: matchMedia("(display-mode: standalone)").matches || navigator.standalone,
      notifications: "Notification" in window, push: "PushManager" in window, serviceWorker: "serviceWorker" in navigator });
    if (unsupported) { this.message(unsupported); this.button("enable").hidden = true; return; }
    try {
      const scope = new URL("./", import.meta.url);
      this.storageKey = "basho_push_registration:" + this.endpoint + ":" + scope.href;
      this.record = JSON.parse(localStorage.getItem(this.storageKey) || "null");
      await navigator.serviceWorker.register(new URL("sw.js", scope).href, { scope: scope.href });
      this.registration = await navigator.serviceWorker.ready;
      const subscription = await this.registration.pushManager.getSubscription();
      this.enabled = !!(subscription && this.record?.confirmed && Notification.permission === "granted");
      this.config = await pushAPI(this.endpoint, "config");
      applicationKey(this.config.publicKey);
      if (!this.isConnected) return;
      this.querySelector("[data-notification-window]").textContent = `毎日、日本時間${this.config.startHour}〜${this.config.endHour}時のランダムなタイミングで1回。みんなに同じタイミングで、写真のお題を届けます。`;
      this.message(this.enabled ? "この端末で1日1回の通知を受け取ります。" : Notification.permission === "denied" ? "通知がブロックされています。端末・ブラウザの設定から通知を許可してください。" : "通知を受け取りたい場合だけ、下のボタンから許可してください。");
    } catch (error) {
      this.config = null;
      this.message(error.message || "通知の設定を確認できませんでした。");
      if (this.isConnected) this.button("retry").hidden = false;
    }
    this.paint();
  }
  async enable() {
    if (this.busy || !this.config) return;
    // Ask synchronously from a user gesture, before network/registration awaits.
    const permission = Notification.requestPermission();
    this.busy = true; this.paint();
    try {
      if (await permission !== "granted") { this.message("通知は許可されませんでした。必要なときに端末の設定から変更できます。"); return; }
      let subscription = await this.registration.pushManager.getSubscription();
      // If local management information was lost, retire that subscription.
      if (subscription && !this.record) { await subscription.unsubscribe(); subscription = null; }
      if (!subscription) subscription = await this.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationKey(this.config.publicKey) });
      const id = await endpointID(subscription.endpoint);
      this.record = { id, token: this.record?.id === id ? this.record.token : newPushToken(), confirmed: false };
      // Persist before the POST so a lost HTTP response can be retried safely.
      localStorage.setItem(this.storageKey, JSON.stringify(this.record));
      await pushAPI(this.endpoint, "subscribe", { ...this.record, endpoint: subscription.endpoint });
      this.record.confirmed = true;
      localStorage.setItem(this.storageKey, JSON.stringify(this.record));
      this.enabled = true;
      this.message("登録しました。日本時間の通知時間帯に、1日1回の通知を受け取ります。");
    } catch { this.message("通知を登録できませんでした。通信状態と端末の通知設定を確認し、もう一度お試しください。"); }
    finally { this.busy = false; this.paint(); }
  }
  async disable() {
    if (this.busy || !this.record) return;
    this.busy = true; this.paint();
    try {
      const subscription = await this.registration.pushManager.getSubscription();
      if (subscription) await subscription.unsubscribe();
      let serverDeleted = true;
      try { await pushAPI(this.endpoint, "unsubscribe", this.record); } catch { serverDeleted = false; }
      localStorage.removeItem(this.storageKey);
      this.record = null; this.enabled = false;
      this.message(serverDeleted ? "この端末の通知を停止しました。" : "この端末の通知を停止しました。サーバー側の登録削除は未確認です。");
    } catch { this.message("通知を停止できませんでした。時間をおいて再試行してください。"); }
    finally { this.busy = false; this.paint(); }
  }
  async test() {
    if (this.busy || !this.enabled) return;
    this.busy = true; this.paint();
    try { await pushAPI(this.endpoint, "test", this.record); this.message("テスト通知の送信を依頼しました。届かない場合は端末の通知設定を確認してください。"); }
    catch (error) { this.message(error.message); }
    finally { this.busy = false; this.paint(); }
  }
}
customElements.define("basho-notifications", BashoNotifications);
