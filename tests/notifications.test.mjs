import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import vm from "node:vm";
import { notificationRequest, sendDailyNotifications, japanTime, notificationWindow } from "../ai-service/notifications.mjs";
import { allowedPushEndpoint, base64url, unbase64, vapidAuthorization, hash } from "../ai-service/web-push.mjs";
import { notificationSupport, pushAPI } from "../notification-service.js";
import { handleRequest } from "../ai-service/worker.mjs";

const schema = readFileSync(new URL("../ai-service/migrations/0001_notifications.sql", import.meta.url), "utf8");
const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const publicKey = base64url(new Uint8Array(await crypto.subtle.exportKey("raw", keys.publicKey)));
const privateKey = base64url(new Uint8Array(await crypto.subtle.exportKey("pkcs8", keys.privateKey)));
const endpoint = "https://fcm.googleapis.com/fcm/send/test-only-endpoint";
const token = base64url(new Uint8Array(32).fill(8));
const id = await hash(endpoint);
const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "https://mimiko5082-png.github.io" };
function environment() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON;" + schema);
  const db = { prepare(sql) {
    let values = [];
    const statement = sqlite.prepare(sql);
    const query = {
      bind(...input) { values = input; return query; },
      async first() { return statement.get(...values) || null; },
      async all() { return { results: statement.all(...values) }; },
      async run() { return { meta: { changes: Number(statement.run(...values).changes) } }; },
    };
    return query;
  } };
  return { NOTIFICATIONS_DB: db, VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, PUSH_RATE_LIMITER: { limit: async () => ({ success: true }) } };
}
const api = (action, data, env, fetcher) => notificationRequest(new Request(`https://worker.test/api/notifications/${action}`, {
  method: data ? "POST" : "GET", headers: { "Content-Type": "application/json" }, body: data ? JSON.stringify(data) : undefined,
}), env, headers, fetcher);
const registration = { id, token, endpoint };
const today = Date.parse("2026-10-20T03:00:00Z"); // Noon in Japan.
async function ready(env, day = "2026-10-20") {
  assert.equal((await api("subscribe", registration, env)).status, 200);
  await env.NOTIFICATIONS_DB.prepare("INSERT INTO notification_days (day, minute) VALUES (?, ?)").bind(day, 600).run();
}

test("endpoint allowlist rejects SSRF, credentials, alternate ports and redirects", async () => {
  for (const value of ["http://fcm.googleapis.com/x", "https://fcm.googleapis.com.attacker.test/x", "https://127.0.0.1/x", "https://fcm.googleapis.com:444/x", "https://x@fcm.googleapis.com/x"]) assert.equal(allowedPushEndpoint(value), false);
  for (const value of [endpoint,"https://web.push.apple.com/x","https://updates.push.services.mozilla.com/wpush/x","https://wns2.notify.windows.com/x"]) assert.equal(allowedPushEndpoint(value), true);
});

test("VAPID is a verifiable ES256 signature scoped to the actual push provider", async () => {
  const auth = await vapidAuthorization(environment(), endpoint, today);
  const jwt = /^vapid t=(.+), k=/.exec(auth)[1];
  const [header, payload, signature] = jwt.split(".");
  const data = JSON.parse(new TextDecoder().decode(unbase64(payload)));
  assert.equal(data.aud, "https://fcm.googleapis.com");
  assert.equal(data.exp, Math.floor(today / 1000) + 3600);
  assert.equal(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, keys.publicKey, unbase64(signature), new TextEncoder().encode(header + "." + payload)), true);
  assert.doesNotMatch(auth, new RegExp(privateKey));
});

test("configuration reveals only public values and allows existing AI without notification setup", async () => {
  const env = environment();
  const response = await api("config", null, env);
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.match(text, /Asia\/Tokyo/); assert.doesNotMatch(text, new RegExp(privateKey));
  assert.equal((await api("config", null, {})).status, 503);
  const request = new Request("https://worker.test/api/notifications/config", { headers: { Origin: "https://mimiko5082-png.github.io" } });
  assert.equal((await handleRequest(request, env)).status, 200);
  assert.deepEqual(await sendDailyNotifications({}, today), { configured: false, attempted: 0 });
});

test("subscription management requires an unguessable token and never stores it in clear text", async () => {
  const env = environment();
  assert.equal((await api("subscribe", registration, env)).status, 200);
  const row = await env.NOTIFICATIONS_DB.prepare("SELECT * FROM push_subscriptions WHERE id = ?").bind(id).first();
  assert.notEqual(row.token_hash, token); assert.equal(row.token_hash, await hash(token));
  const wrong = { ...registration, token: base64url(new Uint8Array(32).fill(9)) };
  assert.equal((await api("subscribe", wrong, env)).status, 403);
  assert.equal((await api("unsubscribe", wrong, env)).status, 403);
  assert.equal((await api("test", wrong, env)).status, 403);
  assert.equal((await api("unsubscribe", registration, env)).status, 200);
  assert.equal((await api("unsubscribe", registration, env)).status, 200);
  assert.equal(await env.NOTIFICATIONS_DB.prepare("SELECT * FROM push_subscriptions WHERE id = ?").bind(id).first(), null);
});

test("oversized, malformed, off-origin and rate-limited requests never send a push", async () => {
  const env = environment();
  let sends = 0;
  const fetcher = async () => { sends++; return new Response(null, { status: 201 }); };
  assert.equal((await api("subscribe", { ...registration, endpoint: "https://127.0.0.1/" }, env, fetcher)).status, 400);
  assert.equal((await api("subscribe", { ...registration, x: "a".repeat(9000) }, env, fetcher)).status, 413);
  assert.equal((await api("subscribe", { ...registration, token: "short" }, env, fetcher)).status, 400);
  env.PUSH_RATE_LIMITER.limit = async () => ({ success: false });
  assert.equal((await api("subscribe", registration, env, fetcher)).status, 429);
  const denied = new Request("https://worker.test/api/notifications/config", { headers: { Origin: "https://evil.test" } });
  assert.equal((await handleRequest(denied, env)).status, 403); assert.equal(sends, 0);
});

test("daily schedule is random within 9-21 JST and persists across repeated Cron calls", async () => {
  const env = environment();
  const morning = Date.parse("2026-10-20T23:00:00Z"); // 08:00 on the next local day.
  assert.equal((await sendDailyNotifications(env, morning)).attempted, 0);
  const day = japanTime(morning).day;
  assert.equal(day, "2026-10-21");
  const first = await env.NOTIFICATIONS_DB.prepare("SELECT minute FROM notification_days WHERE day = ?").bind(day).first();
  assert.ok(first.minute >= 540 && first.minute < 1260);
  await sendDailyNotifications(env, morning);
  const second = await env.NOTIFICATIONS_DB.prepare("SELECT minute FROM notification_days WHERE day = ?").bind(day).first();
  assert.equal(first.minute, second.minute);
  assert.throws(() => notificationWindow({ NOTIFY_START_HOUR: "21", NOTIFY_END_HOUR: "9" }));
});

test("overlapping Cron calls send at most once per endpoint per Japanese day", async () => {
  const env = environment(); await ready(env);
  let count = 0;
  const fetcher = async (url, options) => {
    count++; assert.equal(url, endpoint); assert.equal(options.redirect, "manual");
    assert.equal(options.body, undefined); assert.ok(Number(options.headers.TTL) <= 9 * 3600);
    return new Response(null, { status: 201 });
  };
  await Promise.all([sendDailyNotifications(env, today, fetcher), sendDailyNotifications(env, today, fetcher)]);
  await sendDailyNotifications(env, today + 3600000, fetcher);
  assert.equal(count, 1);
  await env.NOTIFICATIONS_DB.prepare("INSERT INTO notification_days (day, minute) VALUES (?, ?)").bind("2026-10-21", 600).run();
  await sendDailyNotifications(env, today + 86400000, fetcher);
  assert.equal(count, 2);
});

test("before target, after 21:00, unsubscribe and expired endpoints do not receive daily retries", async () => {
  const env = environment(); await ready(env);
  let count = 0;
  const fetcher = async () => { count++; return new Response(null, { status: 410 }); };
  await sendDailyNotifications(env, Date.parse("2026-10-20T00:30:00Z"), fetcher);
  await sendDailyNotifications(env, Date.parse("2026-10-20T12:00:00Z"), fetcher);
  assert.equal(count, 0);
  await sendDailyNotifications(env, today, fetcher);
  await sendDailyNotifications(env, today, fetcher);
  assert.equal(count, 1);
  assert.equal(await env.NOTIFICATIONS_DB.prepare("SELECT * FROM push_subscriptions WHERE id = ?").bind(id).first(), null);
});

test("uncertain failed transmission is not retried that day", async () => {
  const env = environment(); await ready(env);
  let count = 0;
  const fetcher = async () => { count++; throw new Error("private provider error"); };
  await sendDailyNotifications(env, today, fetcher);
  await sendDailyNotifications(env, today + 60000, fetcher);
  assert.equal(count, 1);
});

test("late registrations wait until tomorrow and fan-out continues in bounded batches", async () => {
  const env = environment(); await ready(env);
  await env.NOTIFICATIONS_DB.prepare("UPDATE push_subscriptions SET created_at = ? WHERE id = ?").bind(today, id).run();
  let sends = 0;
  const fetcher = async () => { sends++; return new Response(null, { status: 201 }); };
  await sendDailyNotifications(env, today, fetcher);
  assert.equal(sends, 0); // Created at noon, after the 10:00 target.
  for (let i = 0; i < 11; i++) {
    const address = endpoint + i;
    await env.NOTIFICATIONS_DB.prepare("INSERT INTO push_subscriptions (id, endpoint, token_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .bind(await hash(address), address, await hash(token), 1, 1).run();
  }
  assert.equal((await sendDailyNotifications(env, today, fetcher)).attempted, 10);
  assert.equal((await sendDailyNotifications(env, today + 60000, fetcher)).attempted, 1);
  assert.equal(sends, 11);
});

test("manual test requires a registered token and does not mark daily delivery", async () => {
  const env = environment(); await ready(env);
  assert.equal((await api("test", registration, env, async () => new Response(null, { status: 201 }))).status, 200);
  assert.equal((await env.NOTIFICATIONS_DB.prepare("SELECT COUNT(*) AS count FROM notification_deliveries").first()).count, 0);
});

test("iPhone needs home-screen installation and unsupported browsers do not request permission", () => {
  assert.match(notificationSupport({ ios: true, standalone: false }), /ホーム画面/);
  assert.match(notificationSupport({ ios: false, notifications: false }), /対応していません/);
  assert.equal(notificationSupport({ ios: true, standalone: true, notifications: true, push: true, serviceWorker: true }), "");
});

test("client hides raw errors and service-worker notification ignores payload URLs", async () => {
  await assert.rejects(pushAPI("https://worker.test", "config", null, async () => new Response("private account details", { status: 503 })), /準備中/);
  const listeners = {}, notifications = [], opened = [];
  const context = vm.createContext({ URL, Date, self: {
    addEventListener(name, callback) { listeners[name] = callback; },
    registration: { scope: "https://example.test/design-proto-/", showNotification: async (title, options) => notifications.push({ title, options }) },
    clients: { matchAll: async () => [], openWindow: async url => opened.push(url) },
  } });
  vm.runInContext(readFileSync(new URL("../notification-push.js", import.meta.url), "utf8"), context);
  let pending;
  listeners.push({ data: { url: "https://evil.test" }, waitUntil(value) { pending = value; } }); await pending;
  assert.equal(notifications.length, 1); assert.match(notifications[0].options.tag, /^basho-daily-/);
  listeners.notificationclick({ notification: { close() {} }, waitUntil(value) { pending = value; } }); await pending;
  assert.deepEqual(opened, ["https://example.test/design-proto-/index.html"]);
});
