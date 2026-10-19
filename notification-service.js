import { normalizeEndpoint } from "./image-service.js";

export function notificationSupport({ ios, standalone, notifications, push, serviceWorker }) {
  if (ios && !standalone) return "iPhone・iPadでは、Safariの共有メニューから「ホーム画面に追加」し、そのアイコンから開いてください（iOS/iPadOS 16.4以降）。";
  if (!notifications || !push || !serviceWorker) return "このブラウザはWeb通知に対応していません。対応する端末・ブラウザから開いてください。";
  return "";
}

export async function pushAPI(endpoint, action, body, fetcher = fetch) {
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(globalThis.location?.hostname);
  const base = normalizeEndpoint(endpoint, local);
  let response;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    response = await fetcher(`${base}/api/notifications/${action}`, body ? {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal,
    } : { method: "GET", signal: controller.signal });
  } catch { throw new Error("通知サーバーに接続できませんでした。時間をおいて再試行してください。"); }
  finally { clearTimeout(timer); }
  if (!response.ok) throw new Error(response.status === 429 ? "時間をおいて再試行してください。" : response.status === 503 ? "通知サーバーは準備中です。設定完了後に再試行してください。" : "通知の処理に失敗しました。再試行してください。");
  try { return await response.json(); } catch { throw new Error("通知サーバーの応答を確認できませんでした。"); }
}

export function applicationKey(value) {
  if (!/^[A-Za-z0-9_-]{87}$/.test(value || "")) throw new Error("通知用の公開鍵が未設定です。");
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
}

export function newPushToken() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function endpointID(endpoint) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
