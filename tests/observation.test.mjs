import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { preparedPerspective, requestPerspective } from "../perspective.js";
import { normalizePlace, distanceMeters, mapGeometry } from "../place.js";
import worker, { handleRequest } from "../ai-service/worker.mjs";
import { TEXT_MODEL } from "../ai-service/free-ai.mjs";

function app(storage = new Map(), perspectiveRequester = requestPerspective) {
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
    window: { addEventListener() {}, BASHO_PERSPECTIVE: { endpoint: "" }, location: { search: "", href: "https://example.test/" } },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    navigator: {}, console: { warn() {}, error() {} }, Date: Clock, URL, URLSearchParams,
    setInterval() {}, setTimeout() { return 1; }, clearTimeout() {}, requestPerspective: perspectiveRequester, preparedPerspective, normalizePlace, distanceMeters, mapGeometry,
  });
  vm.runInContext(source + "\nglobalThis.api={state,navigate,saveNote,finishObservation,cloudEntry,compactEntry,render,renderEntry,renderObservationTrace,studyCSV,saveEntryToFirebase,updateStudyReflection};", context);
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

test("old notebook entries open directly without a map or location permission", () => {
  const a = app(); a.state.entries = [{ id: "entry-old", title: "昔の記録", category: "音" }];
  a.state.activeEntryId = "entry-old";
  assert.match(a.renderEntry(), /昔の記録/);
  assert.doesNotMatch(a.renderEntry(), /tile.openstreetmap|request-location|地図/);
  a.navigate("entry"); assert.match(a.screen.innerHTML, /昔の記録/);
});

const origin = "https://mimiko5082-png.github.io";
const request = data => new Request("https://service.test", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(data) });

test("AI service handles preflight and missing configuration", async () => {
  const preflight = await worker.fetch(new Request("https://service.test", { method: "OPTIONS", headers: { Origin: origin } }), {});
  assert.equal(preflight.status, 204);
  assert.equal((await worker.fetch(request({ note: "壁", prompt: "跡" }), {}, {})).status, 503);
});

test("AI service validates input and formats free Workers AI output without secrets", async () => {
  const env = { IMAGE_RATE_LIMITER: { limit: async () => ({ success: true }) }, AI: { run: async (model, body) => {
    assert.equal(model, TEXT_MODEL);
    assert.deepEqual(JSON.parse(body.messages[1].content), { observation_prompt: "跡", user_record: "壁" });
    return { response: JSON.stringify({ hypotheses: ["雨の跡かもしれません。"], question: "ほかの壁にもありますか？" }) };
  } } };
  assert.equal((await handleRequest(request({ note: "", prompt: "跡" }), env)).status, 400);
  const result = await handleRequest(request({ note: "壁", prompt: "跡" }), env);
  assert.equal(result.status, 200);
  const body = await result.text(); assert.doesNotMatch(body, /test-only-secret/); assert.match(body, /雨の跡/);
});

test("upstream failures produce a recoverable service error", async () => {
  const result = await handleRequest(request({ note: "壁", prompt: "跡" }), {
    AI: { run: async () => { throw new Error("provider unavailable"); } }, IMAGE_RATE_LIMITER: { limit: async () => ({ success: true }) },
  });
  assert.equal(result.status, 502);
});

test("text requests fall back to prepared questions when the daily free quota is exhausted", async () => {
  const env = { AI: { run: async () => { throw Object.assign(new Error("private"), { code: 3036 }); } }, IMAGE_RATE_LIMITER: { limit: async () => ({ success: true }) } };
  const response = await handleRequest(request({ note: "壁", prompt: "跡" }), env);
  assert.equal(response.status, 429);
  const result = await requestPerspective("壁", { id: "trace", modernTask: "跡" }, "https://service.test", async () => response);
  assert.equal(result.kind, "prepared"); assert.equal(result.reason, "free-quota");
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
test("legacy map navigation migrates to the reading calendar", () => {
  const a = app(); a.navigate("map");
  assert.equal(a.state.view, "calendar");
  assert.match(a.screen.innerHTML, /basho-reading mode="calendar"/);
  const reloaded = app(a.storage);
  assert.equal(reloaded.state.view, "calendar");
});

test("condition A saves after the first observation without contacting AI or sharing study identity", async () => {
  let calls = 0;
  const a = app(new Map(), async () => { calls++; throw new Error("AI must not run in A"); });
  a.state.studySettings = { condition: "A", participant: "P01", place: "場所1", order: "BA" };
  a.navigate("pause");
  a.state.studySettings.condition = "B";
  a.advance(30000); a.navigate("note");
  a.state.note = "ベンチの端だけ乾いている。";
  await a.saveNote();
  assert.equal(calls, 0);
  assert.equal(a.state.view, "encounter");
  assert.equal(a.state.studyRecords.length, 1);
  const record = a.state.studyRecords[0];
  assert.equal(record.condition, "A");
  assert.equal(record.perspectiveKind, "none");
  assert.equal(record.reobserved, false);
  assert.equal(record.observationSeconds, 30);
  assert.equal(record.participant, "P01");
  const entry = a.state.entries[0];
  assert.equal(entry.localOnly, true);
  assert.equal(await a.saveEntryToFirebase(entry), false);
  assert.equal("participant" in a.cloudEntry(entry).observationTrace, false);
  assert.equal(app(a.storage).state.entries[0].localOnly, true);
  assert.equal(app(a.storage).state.studyRecords[0].condition, "A");
  assert.match(a.renderObservationTrace(entry), /問い返しは行っていません/);
});

test("condition B exports both observations with actual question provenance and stance", async () => {
  const a = app();
  a.state.studySettings = { condition: "B", participant: "P02", place: "場所2", order: "AB" };
  a.navigate("pause"); a.advance(30000); a.navigate("note");
  a.state.note = "人の足跡が残る。"; await a.saveNote();
  a.state.stance = "own";
  a.navigate("revisit"); a.advance(30000); a.navigate("update");
  a.state.revisitNote = "風が落ち葉を動かしていた。"; a.finishObservation();
  assert.equal(a.state.studyRecords[0].perspectiveKind, "prepared");
  assert.equal(a.state.studyRecords[0].stance, "own");
  assert.equal(a.state.studyRecords[0].revisitSeconds, 30);
  assert.equal(a.state.studyRecords[0].finalNote, "風が落ち葉を動かしていた。");
  const csv = a.studyCSV(a.state.studyRecords);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /"P02","B","AB","場所2"/);
  assert.match(csv, /風が落ち葉/);
  assert.equal(a.state.entries[0].localOnly, true);
});

test("study CSV preserves quotes and multiline notes and neutralizes spreadsheet formulas", () => {
  const a = app();
  const csv = a.studyCSV([{ participant: "=SUM(1,2)", firstNote: '一行目\n"二行目"', finalNote: "  @command" }]);
  assert.ok(csv.includes('"\'=SUM(1,2)"'));
  assert.ok(csv.includes('"一行目\n""二行目"""'));
  assert.ok(csv.includes('"\'  @command"'));
});

test("study reflections and event times survive reload and export without entering shared entries", async () => {
  const a = app();
  a.state.studySettings = { condition: "B", participant: "P03", place: "場所1", order: "BA" };
  a.navigate("pause"); a.advance(30000); a.navigate("note");
  a.state.note = "壁の跡。"; await a.saveNote();
  a.navigate("revisit"); a.advance(30000); a.navigate("update");
  a.state.revisitNote = "雨の流れが見える。";
  a.state.studyReflection = { stanceReason: "雨の跡という見方を確かめたかった。", placeMeaning: "壁が天気を覚えているように見えた。" };
  // Navigating persists the draft, including the optional reflection.
  a.navigate("update");
  const b = app(a.storage);
  assert.equal(b.state.studyReflection.placeMeaning, a.state.studyReflection.placeMeaning);
  assert.equal(b.state.activeStudy.events.length, a.state.activeStudy.events.length);
  b.finishObservation();
  const record = b.state.studyRecords[0];
  assert.equal(record.stanceReason, "雨の跡という見方を確かめたかった。");
  assert.ok(record.events.some(event => event.action === "prepared-question-ready"));
  assert.equal(record.events.at(-1).action, "saved-after-reobservation");
  assert.equal(record.events[1].at - record.events[0].at, 30000);
  assert.ok(record.events.every(event => Object.keys(event).sort().join() === "action,at,view"));
  assert.equal("placeMeaning" in b.cloudEntry(b.state.entries[0]).observationTrace, false);
  assert.match(b.studyCSV([record]), /壁が天気を覚えている/);
  assert.match(b.studyCSV([record]), /saved-after-reobservation/);
  assert.equal(app(b.storage).state.studyRecords[0].events.at(-1).action, "saved-after-reobservation");
});

test("a previous pending question cannot enter a new observation or block its request", async () => {
  const pending = [];
  const a = app(new Map(), () => new Promise(resolve => pending.push(resolve)));
  a.navigate("pause"); a.advance(30000); a.navigate("note");
  a.state.note = "同じ記録。"; const oldRequest = a.saveNote();
  assert.equal(a.state.perspectiveLoading, true);
  a.navigate("home"); a.navigate("pause");
  assert.equal(a.state.perspectiveLoading, false);
  a.advance(30000); a.navigate("note");
  const newRequest = a.saveNote();
  assert.equal(pending.length, 2);
  pending[0]({ kind: "ai", hypotheses: ["古い仮説"], question: "古い問い？" });
  await oldRequest;
  assert.equal(a.state.perspective, null);
  assert.equal(a.state.perspectiveLoading, true);
  pending[1]({ kind: "ai", hypotheses: ["新しい仮説"], question: "新しい問い？" });
  await newRequest;
  assert.equal(a.state.perspective.question, "新しい問い？");
  assert.equal(a.state.perspectiveLoading, false);
});

test("normal observation stays free of study questions and optional reflection text is escaped", async () => {
  const a = app(); a.state.note = "壁"; await a.saveNote();
  a.navigate("revisit"); a.advance(30000); a.navigate("update");
  assert.doesNotMatch(a.screen.innerHTML, /data-study-reflection/);
  a.state.activeStudy = { condition: "B", events: [] };
  a.state.studyReflection.stanceReason = '</textarea><script>alert(1)</script>';
  a.render();
  assert.doesNotMatch(a.screen.innerHTML, /<script>/);
  assert.match(a.screen.innerHTML, /&lt;script&gt;/);
});


test("both study conditions retain before/after place meaning locally and export it", async () => {
  for (const condition of ["A", "B"]) {
    const a = app();
    a.state.studySettings = { condition, participant: "P04", place: "道", order: "AB", beforePlaceMeaning: "通り過ぎるだけの道" };
    a.navigate("pause");
    assert.equal(a.state.studySettings.beforePlaceMeaning, "");
    a.advance(30000); a.navigate("note");
    a.state.note = "壁の跡"; await a.saveNote();
    if (condition === "B") a.finishObservation(true);
    const entry = a.state.entries[0];
    assert.match(a.screen.innerHTML, /通り過ぎるだけの道/);
    assert.match(a.screen.innerHTML, /data-completed-reflection="placeMeaning"/);
    assert.equal(a.screen.innerHTML.includes('data-completed-reflection="stanceReason"'), condition === "B");
    a.updateStudyReflection(entry.id, "placeMeaning", "雨の流れに気づける道");
    a.updateStudyReflection(entry.id, "stanceReason", "問いと違う手がかりを見た");
    const restored = app(a.storage);
    const record = restored.state.studyRecords[0];
    assert.equal(record.beforePlaceMeaning, "通り過ぎるだけの道");
    assert.equal(record.placeMeaning, "雨の流れに気づける道");
    assert.equal(Boolean(record.stanceReason), condition === "B");
    assert.ok(record.reflectionUpdatedAt);
    const csv = restored.studyCSV([record]);
    assert.match(csv, /通り過ぎるだけの道/);
    assert.match(csv, /雨の流れに気づける道/);
    assert.equal("beforePlaceMeaning" in a.cloudEntry(entry), false);
    assert.equal("placeMeaning" in a.cloudEntry(entry).observationTrace, false);
    a.navigate("home"); a.navigate("pause");
    assert.equal(a.state.activeStudy.beforePlaceMeaning, "");
  }
});

test("post-study editing is bounded, escaped and cannot change study identity", async () => {
  const a = app();
  a.state.studySettings = { condition: "A", participant: "P05", place: "道", order: "BA" };
  a.navigate("pause"); a.advance(30000); a.navigate("note");
  a.state.note = "光"; await a.saveNote();
  const id = a.state.entries[0].id;
  a.updateStudyReflection(id, "participant", "changed");
  a.updateStudyReflection("unknown", "placeMeaning", "wrong record");
  assert.equal(a.state.studyRecords[0].participant, "P05");
  assert.equal(a.state.studyRecords[0].placeMeaning, "");
  a.updateStudyReflection(id, "placeMeaning", "x".repeat(300));
  assert.equal(a.state.studyRecords[0].placeMeaning.length, 280);
  a.updateStudyReflection(id, "placeMeaning", '</textarea><script>alert(1)</script>');
  a.render();
  assert.doesNotMatch(a.screen.innerHTML, /<script>/);
  assert.match(a.screen.innerHTML, /&lt;script&gt;/);
});
