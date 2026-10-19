export function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function unbase64(value) {
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), char => char.charCodeAt(0));
}

export function allowedPushEndpoint(value) {
  if (typeof value !== "string" || value.length > 4096) return false;
  try {
    const url = new URL(value);
    const host = url.hostname;
    return url.protocol === "https:" && !url.username && !url.password && !url.hash && !url.port && (
      host === "fcm.googleapis.com" || host === "web.push.apple.com" ||
      host === "updates.push.services.mozilla.com" || host.endsWith(".push.services.mozilla.com") ||
      host.endsWith(".notify.windows.com")
    );
  } catch { return false; }
}

export async function hash(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export function pushConfigured(env) {
  try {
    return !!env.NOTIFICATIONS_DB?.prepare && !!env.PUSH_RATE_LIMITER?.limit &&
      /^[A-Za-z0-9_-]{87}$/.test(env.VAPID_PUBLIC_KEY || "") && unbase64(env.VAPID_PUBLIC_KEY)[0] === 4 &&
      typeof env.VAPID_PRIVATE_KEY === "string" && unbase64(env.VAPID_PRIVATE_KEY).length >= 100;
  } catch { return false; }
}

export async function vapidAuthorization(env, endpoint, now = Date.now()) {
  const subject = env.VAPID_SUBJECT || "https://mimiko5082-png.github.io/design-proto-/";
  const url = new URL(subject);
  if (!["https:", "mailto:"].includes(url.protocol)) throw new Error("Invalid VAPID subject");
  const encode = value => base64url(new TextEncoder().encode(JSON.stringify(value)));
  const input = encode({ typ: "JWT", alg: "ES256" }) + "." + encode({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 3600, sub: subject });
  const key = await crypto.subtle.importKey("pkcs8", unbase64(env.VAPID_PRIVATE_KEY), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(input));
  return `vapid t=${input}.${base64url(new Uint8Array(signature))}, k=${env.VAPID_PUBLIC_KEY}`;
}

// No payload: the service worker shows a fixed observation prompt. No photos,
// observation records or subscription-management tokens go to the push service.
export async function sendPush(env, endpoint, { ttl = 60, now = Date.now(), fetcher = fetch, authorization: cachedAuthorization } = {}) {
  if (!allowedPushEndpoint(endpoint)) throw new Error("Invalid push endpoint");
  const authorization = cachedAuthorization || await vapidAuthorization(env, endpoint, now);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetcher(endpoint, {
      method: "POST", redirect: "manual", signal: controller.signal,
      headers: { Authorization: authorization, TTL: String(Math.max(0, Math.min(86400, ttl))), Urgency: "normal", "Content-Length": "0" },
    });
    const status = response.status;
    await response.body?.cancel();
    return status;
  } finally { clearTimeout(timer); }
}
