// No API key belongs in this public GitHub Pages module.
export function preparedPerspective(note, gazeId, reason = "unconfigured") {
  let hypotheses = ["見えているものだけでなく、周囲の環境がこの景色に関わっているかもしれません。"];
  let question = "最初に気になったものの周りに、別の手がかりはありますか？";
  if (/ベンチ|濡|乾/.test(note)) {
    hypotheses = ["誰かがいた痕跡かもしれません。", "木陰や日当たり、水のかかり方の違いかもしれません。"];
    question = "周りの地面や木陰にも、同じ違いはありますか？";
  } else if (gazeId === "sound") {
    hypotheses = ["音の大きさだけでなく、音と音の間の静けさが気になったのかもしれません。"];
    question = "その音が途切れるとき、ほかにどんな音が聞こえますか？";
  } else if (gazeId === "flow") {
    question = "流れのそばで、動かずに残っているものはありますか？";
  } else if (gazeId === "yesterday") {
    hypotheses = ["場所の変化だけでなく、時間帯や自分の立ち位置の違いかもしれません。"];
    question = "昨日の記憶と、いま確かめられることを分けると、何が残りますか？";
  } else if (gazeId === "trace" || gazeId === "presence") {
    question = "人の行為と、風・雨・時間が残した跡を見分ける手がかりはありますか？";
  }
  return { kind: "prepared", basis: note, hypotheses, question, reason };
}

export function normalizePerspective(data, note) {
  if (!data || typeof data.question !== "string" || !data.question.trim() || data.question.length > 240
      || !Array.isArray(data.hypotheses) || !data.hypotheses.length || data.hypotheses.length > 3
      || data.hypotheses.some(item => typeof item !== "string" || !item.trim() || item.length > 240)) {
    throw new Error("Invalid perspective response");
  }
  // The service sees the text only. Evidence is always the unmodified user record.
  return { kind: "ai", basis: note, hypotheses: data.hypotheses.map(item => item.trim()), question: data.question.trim() };
}

export async function requestPerspective(note, gaze, endpoint = "", fetcher = fetch) {
  if (!endpoint) return preparedPerspective(note, gaze.id);
  let url;
  try {
    url = new URL(endpoint);
    if (url.protocol !== "https:") throw new Error("HTTPS required");
  } catch {
    return preparedPerspective(note, gaze.id, "unavailable");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetcher(url.href, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note, prompt: gaze.modernTask }), signal: controller.signal,
    });
    if (!response.ok) throw new Error("Perspective service unavailable");
    return normalizePerspective(await response.json(), note);
  } catch {
    return preparedPerspective(note, gaze.id, "unavailable");
  } finally {
    clearTimeout(timeout);
  }
}
