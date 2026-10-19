// Fixed Workers AI models from Cloudflare's free-allocation catalog.
// There is deliberately no OpenAI, paid-model or AI Gateway fallback.
export const VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
export const IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";
export const TEXT_MODEL = "@cf/meta/llama-3.2-3b-instruct";

export class AITimeout extends Error {}

export async function runAI(env, model, input, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      env.AI.run(model, input),
      new Promise((_resolve, reject) => { timer = setTimeout(() => reject(new AITimeout()), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}

export function aiFailure(error) {
  // Inspect known codes, but never return provider messages or account details.
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  const hasCode = value => code === value || new RegExp(`\\b${value}\\b`).test(message);
  if (hasCode("3036")) return { status: 429, code: "FREE_QUOTA_EXCEEDED", error: "本日のAI無料枠を使い切りました。枠が回復してから再度お試しください。" };
  if (hasCode("3040")) return { status: 429, code: "AI_BUSY", error: "AIが混み合っています。時間をおいて再試行してください。" };
  if (hasCode("5016")) return { status: 503, code: "MODEL_SETUP_REQUIRED", error: "管理者によるAIモデル利用規約の確認が必要です。" };
  if (hasCode("5035")) return { status: 503, code: "PAID_MODEL_REJECTED", error: "このモデルは無料プランで利用できません。処理を停止しました。" };
  if (error instanceof AITimeout || hasCode("3007")) return { status: 504, code: "AI_TIMEOUT", error: "処理がタイムアウトしました。再試行してください。" };
  return { status: 502, code: "AI_UNAVAILABLE", error: "AI処理を完了できませんでした。時間をおいて再試行してください。" };
}
