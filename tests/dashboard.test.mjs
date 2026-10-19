import test from "node:test";
import assert from "node:assert/strict";
import dashboard from "../ai-service/dashboard-worker.js";
import source from "../ai-service/worker.mjs";

const origin = "https://mimiko5082-png.github.io";
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const request = (path, body) => new Request("https://worker.test" + path, {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const env = {
  IMAGE_RATE_LIMITER: { limit: async () => ({ success: true }) },
  AI: { run: async model => model.includes("flux") ? { image: png } : { response: "写真の説明" } },
};

test("source and dashboard visits check bindings without invoking any AI", async () => {
  for (const worker of [source, dashboard]) {
    for (const configured of [false, true]) {
      const bindings = configured ? { ...env, AI: { run() { throw new Error("AI must not be called"); } } } : {};
      const response = await worker.fetch(new Request("https://worker.test/"), bindings);
      assert.equal(response.status, configured ? 200 : 503);
      assert.match(await response.text(), configured ? /設定を確認/ : /未設定/);
    }
  }
});

test("copy-paste bundle matches source for image generation, analysis, validation and CORS", async () => {
  for (const [path, body] of [["/api/images/generate", { prompt: "木陰" }], ["/api/images/analyze", { image: `data:image/png;base64,${png}` }], ["/", null]]) {
    const expected = await source.fetch(request(path, body), env);
    const actual = await dashboard.fetch(request(path, body), env);
    assert.equal(actual.status, expected.status);
    assert.deepEqual([...actual.headers], [...expected.headers]);
    assert.equal(await actual.text(), await expected.text());
  }
});

test("copy-paste bundle preserves free quota stop", async () => {
  const limited = { ...env, AI: { run: async () => { throw Object.assign(new Error("private account"), { code: 3036 }); } } };
  const response = await dashboard.fetch(request("/api/images/generate", { prompt: "木陰" }), limited);
  assert.equal(response.status, 429);
  const data = await response.json();
  assert.equal(data.code, "FREE_QUOTA_EXCEEDED");
  assert.doesNotMatch(JSON.stringify(data), /private/);
});
