import { allowedPushEndpoint, hash, pushConfigured, sendPush, vapidAuthorization } from "./web-push.mjs";
import { boundedJSON } from "./image-handlers.mjs";

export function japanTime(timestamp) {
  const date = new Date(timestamp + 9 * 3600000);
  return { day: date.toISOString().slice(0, 10), minute: date.getUTCHours() * 60 + date.getUTCMinutes() };
}

export function notificationSchedule() {
  return [
    { id: "morning", time: "08:00", minute: 480 },
    { id: "night", time: "23:50", minute: 1430 },
  ];
}

function validManagement(input) {
  return /^[a-f0-9]{64}$/.test(input?.id || "") && /^[A-Za-z0-9_-]{43}$/.test(input?.token || "");
}

export async function notificationRequest(request, env, headers, fetcher = fetch) {
  const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...headers, "X-Content-Type-Options": "nosniff" } });
  const action = new URL(request.url).pathname.slice("/api/notifications/".length);
  if (action === "config" && request.method === "GET") {
    try {
      const schedule = notificationSchedule();
      if (!pushConfigured(env)) return reply({ error: "通知サーバーは準備中です。" }, 503);
      return reply({ publicKey: env.VAPID_PUBLIC_KEY, schedule, timeZone: "Asia/Tokyo" });
    } catch { return reply({ error: "通知サーバーは準備中です。" }, 503); }
  }
  if (!["subscribe", "unsubscribe", "test"].includes(action)) return reply({ error: "APIが見つかりません。" }, 404);
  if (request.method !== "POST") return reply({ error: "POSTで送信してください。" }, 405);
  if (!pushConfigured(env)) return reply({ error: "通知サーバーは準備中です。" }, 503);
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) return reply({ error: "JSONで送信してください。" }, 415);
  try {
    const input = await boundedJSON(request, 8192);
    if (!validManagement(input)) return reply({ error: "通知の登録情報が不正です。" }, 400);
    if (action === "subscribe" && (!allowedPushEndpoint(input.endpoint) || await hash(input.endpoint) !== input.id)) return reply({ error: "通知の接続先が不正です。" }, 400);
    const ip = request.headers.get("CF-Connecting-IP") || "local";
    const perIP = await env.PUSH_RATE_LIMITER.limit({ key: `push:ip:${ip}` });
    const global = perIP.success && await env.PUSH_RATE_LIMITER.limit({ key: "push:global" });
    if (!perIP.success || !global.success) return reply({ error: "時間をおいて再試行してください。" }, 429);
    const db = env.NOTIFICATIONS_DB;
    const row = await db.prepare("SELECT id, endpoint, token_hash FROM push_subscriptions WHERE id = ?").bind(input.id).first();
    const tokenHash = await hash(input.token);
    if (row && row.token_hash !== tokenHash) return reply({ error: "通知の登録を確認できませんでした。" }, 403);
    if (action === "subscribe") {
      if (!row) {
        const count = await db.prepare("SELECT COUNT(*) AS count FROM push_subscriptions").first();
        if (count.count >= 500) return reply({ error: "通知の登録上限に達しました。" }, 429);
      }
      const now = Date.now();
      const result = await db.prepare(`INSERT INTO push_subscriptions (id, endpoint, token_hash, created_at, updated_at)
        SELECT ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM push_subscriptions) < 500 OR EXISTS (SELECT 1 FROM push_subscriptions WHERE id = ?)
        ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at WHERE token_hash = excluded.token_hash`)
        .bind(input.id, input.endpoint, tokenHash, now, now, input.id).run();
      if (!result.meta.changes) return reply({ error: "通知の登録を確認できませんでした。" }, 403);
      return reply({ registered: true });
    }
    if (action === "unsubscribe") {
      // Keep the token predicate even after the read to protect against races.
      await db.prepare("DELETE FROM push_subscriptions WHERE id = ? AND token_hash = ?").bind(input.id, tokenHash).run();
      return reply({ registered: false });
    }
    if (!row) return reply({ error: "先に通知を登録してください。" }, 404);
    const status = await sendPush(env, row.endpoint, { fetcher });
    if ([404, 410].includes(status)) {
      await db.prepare("DELETE FROM push_subscriptions WHERE id = ?").bind(input.id).run();
      return reply({ error: "通知の登録期限が切れました。一度停止してから登録し直してください。" }, 410);
    }
    return status >= 200 && status < 300 ? reply({ accepted: true }) : reply({ error: "テスト通知を送信できませんでした。" }, 502);
  } catch (error) { return reply({ error: "通知の処理を完了できませんでした。再試行してください。" }, [400, 413].includes(error?.status) ? error.status : 502); }
}

export async function sendDailyNotifications(env, timestamp = Date.now(), fetcher = fetch) {
  if (!pushConfigured(env)) return { configured: false, attempted: 0 };
  const { day, minute } = japanTime(timestamp);
  const slot = notificationSchedule().find(slot => minute >= slot.minute && minute < slot.minute + 10);
  if (!slot) return { attempted: 0 };
  const db = env.NOTIFICATIONS_DB;
  // Reuse the existing schema. A namespaced day is unique for each daily slot;
  // old YYYY-MM-DD random-delivery records cannot suppress either new slot.
  const deliveryDay = `${day}:${slot.id}`;
  const cutoff = japanTime(timestamp - 14 * 86400000).day;
  await db.prepare("DELETE FROM notification_deliveries WHERE day < ?").bind(cutoff).run();
  await db.prepare("DELETE FROM notification_days WHERE day < ?").bind(cutoff).run();
  const targetTime = Date.parse(day + "T00:00:00+09:00") + slot.minute * 60000;
  const { results } = await db.prepare(`SELECT s.id, s.endpoint FROM push_subscriptions s
    LEFT JOIN notification_deliveries d ON d.subscription_id = s.id AND d.day = ?
    WHERE d.subscription_id IS NULL AND s.created_at <= ? ORDER BY s.id LIMIT 50`).bind(deliveryDay, targetTime).all();
  let attempted = 0;
  const authorizations = new Map();
  const deliver = async row => {
    // Claim before transmission: a retry or overlapping Cron cannot duplicate a slot.
    const claim = await db.prepare("INSERT OR IGNORE INTO notification_deliveries (day, subscription_id, claimed_at) VALUES (?, ?, ?)").bind(deliveryDay, row.id, timestamp).run();
    if (!claim.meta.changes) return;
    attempted++;
    try {
      const origin = new URL(row.endpoint).origin;
      if (!authorizations.has(origin)) authorizations.set(origin, vapidAuthorization(env, row.endpoint, timestamp));
      const status = await sendPush(env, row.endpoint, { now: timestamp, ttl: (slot.minute + 10 - minute) * 60, fetcher, authorization: await authorizations.get(origin) });
      if ([404, 410].includes(status)) await db.prepare("DELETE FROM push_subscriptions WHERE id = ?").bind(row.id).run();
    } catch { /* Do not retry an uncertain transmission within this slot. */ }
  };
  // 50 per tick allows the 500-subscription cap to fit in the ten-minute window.
  for (let index = 0; index < results.length; index += 10) await Promise.all(results.slice(index, index + 10).map(deliver));
  return { attempted };
}
