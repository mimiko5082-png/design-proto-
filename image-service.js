import { decodeImageData } from "./image-validation.js";

export class ImageServiceError extends Error {}

export function normalizeEndpoint(value, local = false) {
  let url;
  try { url = new URL(value); } catch { throw new ImageServiceError("画像AIサーバーのURLを設定してください。"); }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(local && loopback && url.protocol === "http:")) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new ImageServiceError("接続先にはHTTPSのサーバーURLを入力してください（パス・認証情報は不要です）。");
  }
  return url.origin;
}

export async function requestImageTask(endpoint, task, payload, { signal, fetcher = fetch, local = false } = {}) {
  if (!["analyze", "generate"].includes(task)) throw new Error("画像処理の指定が不正です。");
  const base = normalizeEndpoint(endpoint, local);
  let response;
  try {
    response = await fetcher(`${base}/api/images/${task}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ImageServiceError("接続できませんでした。サーバーURLと通信状態を確認して再試行してください。");
  }
  if (!response.ok) {
    // Do not render raw proxy/provider responses or internal error details.
    let code;
    try { code = (await response.json())?.code; } catch {}
    if (response.status === 429 && code === "FREE_QUOTA_EXCEEDED") throw new ImageServiceError("本日のAI無料枠を使い切りました。枠が回復してから再度お試しください。");
    const messages = {
      400: "画像または説明文の形式・サイズを確認してください。", 413: "送信サイズが上限を超えています。",
      415: "対応していないデータ形式です。", 429: "利用上限です。時間をおいて再試行してください。",
      503: "Workers AIの接続設定・モデルの利用規約を管理者に確認してください。",
      504: "処理がタイムアウトしました。再試行してください。",
    };
    throw new ImageServiceError(messages[response.status] || "AI処理に失敗しました。時間をおいて再試行してください。");
  }
  let data;
  try { data = await response.json(); } catch { throw new ImageServiceError("AIの応答を読み取れませんでした。再試行してください。"); }
  if (!data || typeof data !== "object") throw new ImageServiceError("AIの応答を読み取れませんでした。再試行してください。");
  if (task === "analyze") {
    if (typeof data.text !== "string" || !data.text.trim() || data.text.length > 6000) throw new ImageServiceError("認識結果を読み取れませんでした。再試行してください。");
    return data.text;
  }
  try { decodeImageData(data.image, 8 * 1024 * 1024); } catch { throw new ImageServiceError("生成画像を読み取れませんでした。再試行してください。"); }
  return data.image;
}
