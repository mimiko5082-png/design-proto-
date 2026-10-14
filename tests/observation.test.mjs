import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { preparedPerspective, requestPerspective } from "../perspective.js";
import { normalizePlace, distanceMeters, mapGeometry } from "../place.js";
import worker, { handleRequest } from "../ai-service/worker.mjs";

function app(storage = new Map()) {
  const screen = { innerHTML: "", addEventListener() {} };
  const element = { addEventListener() {}, classList: { add() {}, remove() {} } };
  const tabbar = { ...element, hidden: false };
  const source = readFileSync(new URL("../basho-app.js", import.meta.url), "utf8").replace(/^import .*;\n/gm, "");
  let now = new Date(2026, 9, 14, 13).getTime();
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const context = vm.createContext({
    document: { getElementById: id => id === "screen" ? screen : element,
      querySelector: selector => selector === ".tabbar" ? tabbar : null,
      querySelectorAll: () => [], addEventListener() {} },
    window: { BASHO_PERSPECTIVE: { endpoint: "" }, location: { search: "", href: "https://example.test/" } },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    navigator: {}, console: { warn() {}, error() {} }, Date: Clock, URL, URLSearchParams,
    setInterval() {}, setTimeout() { return 1; }, clearTimeout() {}, requestPerspective, preparedPerspective, normalizePlace, distanceMeters, mapGeometry,
  });
  vm.runInContext(source + "\nglobalThis.api={state,navigate,saveNote,finishObservation,cloudEntry,compactEntry,render,renderMap,renderObservationTrace};", context);
  return { ...context.api, storage, screen, tabbar, advance: ms => { now += ms; } };
}

test("30 seconds gate both observation periods, then preserve the two records", async () => {
  const a = app();
  a.navigate("pause");
  assert.equal(a.tabbar.hidden, true);
  a.navigate("note");
  assert.equal(a.state.view, "pause");
  a.advance(30000); a.navigate("note");
  assert.equal(a.state.view, "note");
  a.state.note = "ベンチの端だけが濡れていない。";
  await a.saveNote();
  assert.equal(a.state.view, "perspective");
  assert.match(a.screen.innerHTML, /AI生成ではありません/);
  a.state.stance = "question";
  a.navigate("revisit"); a.navigate("update");
  assert.equal(a.state.view, "revisit");
  a.advance(30000); a.navigate("update");
  a.state.revisitNote = "ベンチの後ろに大きな木がある。";
  a.finishObservation();
  assert.equal(a.state.view, "encounter");
  const entry = a.state.entries[0];
  assert.equal(entry.observationTrace.firstNote, "ベンチの端だけが濡れていない。");
  assert.equal(entry.title, "ベンチの後ろに大きな木がある。");
  assert.equal(entry.observationTrace.stance, "question");
  assert.equal(entry.observationTrace.reobserved, true);
  assert.equal(entry.observationTrace.revisitSeconds, 30);
  a.finishObservation(); assert.equal(a.state.entries.length, 1);
  const reloaded = app(a.storage);
  assert.equal(reloaded.state.entries[0].observationTrace.firstNote, entry.observationTrace.firstNote);
  assert.deepEqual(a.cloudEntry(entry).observationTrace, a.compactEntry(entry).observationTrace);
});

test("blank records never become sample observations", async () => {
  const a = app(); a.state.view = "note"; a.state.note = "  ";
  await a.saveNote(); assert.equal(a.state.view, "note"); assert.equal(a.state.entries.length, 0);
});

test("reobservation needs a real record, skipping keeps the original", async () => {
  const a = app(); a.state.note = "小さな音。"; await a.saveNote();
  a.state.view = "update"; a.state.reobserved = true;
  a.finishObservation(); assert.equal(a.state.entries.length, 0);
  a.state.view = "perspective"; a.finishObservation(true);
  assert.equal(a.state.entries[0].title, "小さな音。");
  assert.equal(a.state.entries[0].observationTrace.reobserved, false);
});

test("a reload resumes a draft and clears an interrupted AI loading state", () => {
  const a = app(); a.state.note = "壁の跡。"; a.state.perspectiveLoading = true;
  a.navigate("perspective"); const b = app(a.storage);
  assert.equal(b.state.note, "壁の跡。"); assert.equal(b.state.perspectiveLoading, false);
  assert.equal(b.state.perspective.kind, "prepared");
});

test("user text and AI questions are escaped before display", () => {
  const a = app(); a.state.note = '<img src=x onerror="alert(1)">';
  a.state.perspective = { kind: "ai", hypotheses: ["<script>x</script>"], question: "<img src=x>" };
  a.navigate("perspective");
  assert.doesNotMatch(a.screen.innerHTML, /<script>x|<img src=x/);
  assert.match(a.screen.innerHTML, /&lt;script&gt;/);
});

test("unconfigured or failed AI uses a clearly identified prepared question", async () => {
  const gaze = { id: "presence", modernTask: "痕跡を探す" };
  assert.equal((await requestPerspective("ベンチ", gaze)).kind, "prepared");
  const result = await requestPerspective("ベンチ", gaze, "https://service.test", async () => { throw new Error(); });
  assert.equal(result.kind, "prepared"); assert.equal(result.reason, "unavailable");
});

test("real AI receives only the written record and task", async () => {
  const result = await requestPerspective("ベンチ", { id: "presence", modernTask: "痕跡を探す" }, "https://service.test", async (_url, options) => {
    assert.deepEqual(JSON.parse(options.body), { note: "ベンチ", prompt: "痕跡を探す" });
    return new Response(JSON.stringify({ hypotheses: ["木陰かもしれません。"], question: "ほかに手がかりは？" }));
  });
  assert.equal(result.kind, "ai"); assert.equal(result.basis, "ベンチ");
});

test("malformed AI responses fall back instead of being marked as AI", async () => {
  const result = await requestPerspective("壁", { id: "trace" }, "https://service.test", async () => new Response(JSON.stringify({ question: "", hypotheses: [] })));
  assert.equal(result.kind, "prepared");
});

test("old entries still load and maps distinguish examples from location data", () => {
  const a = app(); a.state.entries = [{ id: "entry-old", title: "昔の記録", category: "音" }];
  a.state.activeEntryId = "entry-old";
  assert.match(a.renderMap(), /昔の記録/); assert.match(a.renderMap(), /地図に配置しません/);
  a.state.currentLocation = { lat: 35, lng: 139 };
  assert.match(a.renderMap(), /場所が付いていません/);
});

const origin = "https://mimiko5082-png.github.io";
const request = data => new Request("https://service.test", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(data) });

test("AI service handles preflight and missing configuration", async () => {
  const preflight = await worker.fetch(new Request("https://service.test", { method: "OPTIONS", headers: { Origin: origin } }), {});
  assert.equal(preflight.status, 204);
  assert.equal((await worker.fetch(request({ note: "壁", prompt: "跡" }), {}, {})).status, 503);
});

test("AI service validates input, keeps provider secrets server side and formats output", async () => {
  const env = { OPENAI_API_KEY: "test-only-secret", OPENAI_MODEL: "test-model" };
  assert.equal((await handleRequest(request({ note: "", prompt: "跡" }), env)).status, 400);
  const result = await handleRequest(request({ note: "壁", prompt: "跡" }), env, async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(options.body);
    assert.equal(body.store, false); assert.equal(body.text.format.type, "json_schema");
    return new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ hypotheses: ["雨の跡かもしれません。"], question: "ほかの壁にもありますか？" }) }] }] }));
  });
  assert.equal(result.status, 200);
  const body = await result.text(); assert.doesNotMatch(body, /test-only-secret/); assert.match(body, /雨の跡/);
});

test("upstream failures produce a recoverable service error", async () => {
  const result = await handleRequest(request({ note: "壁", prompt: "跡" }), { OPENAI_API_KEY: "test", OPENAI_MODEL: "test" }, async () => new Response("unavailable", { status: 503 }));
  assert.equal(result.status, 502);
});


test("public place is rounded and survives cloud serialization; old entries never gain a place", () => {
  const a = app();
  const record = a.cloudEntry({ id: "entry-geo", place: {lat: 35.681234, lng: 139.767891} });
  assert.equal(record.place.lat, 35.681);
  assert.equal(record.place.lng, 139.768);
  assert.equal(a.compactEntry(record).place.lat, 35.681);
  assert.equal(a.cloudEntry({id: "old"}).place, undefined);
  for (const value of [{lat: NaN, lng: 139}, {lat: 90, lng: 139}, {lat: "35", lng: 139}]) assert.equal(normalizePlace(value), null);
});
test("map places only located entries and groups by distance, not category", () => {
  const a = app();
  a.state.entries = [
    {id:"entry-a", title:"光", category:"光", place:{lat:35, lng:139}},
    {id:"entry-b", title:"音", category:"音", place:{lat:35.001, lng:139}},
    {id:"entry-c", title:"遠い記録", category:"光", place:{lat:36, lng:139}},
    {id:"entry-d", title:"場所なし", category:"光"}
  ];
  a.state.activeEntryId = "entry-a";
  const html = a.renderMap();
  assert.match(html, /この場所のまなざし · 2件/);
  assert.equal(mapGeometry({lat:35,lng:139}, a.state.entries).pins.length, 2);
  assert.ok(distanceMeters({lat:35,lng:139}, {lat:35.001,lng:139}) < 200);
  assert.doesNotMatch(html, /iframe/);
});
