import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { validateFile, validateImage, decodeImageData, validatePrompt, MAX_IMAGE_BYTES } from "../image-validation.js";
import { normalizeEndpoint, requestImageTask } from "../image-service.js";
import { boundedJSON } from "../ai-service/image-handlers.mjs";
import { handleRequest } from "../ai-service/worker.mjs";
import { VISION_MODEL, IMAGE_MODEL } from "../ai-service/free-ai.mjs";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const image = `data:image/png;base64,${png}`;
const origin = "https://mimiko5082-png.github.io";
const request = (task, data, headers = {}) => new Request(`https://worker.test/api/images/${task}`, {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json", ...headers }, body: JSON.stringify(data),
});
const config = overrides => ({ AI: { run: async () => { throw new Error("Unexpected AI invocation"); } },
  IMAGE_RATE_LIMITER: { limit: async () => ({ success: true }) }, ...overrides });
const json = data => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });


test("image checks reject unsupported type, empty/large file, spoofed bytes and huge dimensions", () => {
  assert.throws(() => validateFile({ type: "image/svg+xml", size: 100 }));
  assert.throws(() => validateFile({ type: "image/png", size: 0 }));
  assert.throws(() => validateFile({ type: "image/png", size: MAX_IMAGE_BYTES + 1 }));
  assert.throws(() => validateImage(new TextEncoder().encode('<svg></svg>'), "image/png"));
  assert.throws(() => decodeImageData("data:image/svg+xml;base64,PHN2Zz4="));
  assert.throws(() => decodeImageData("https://untrusted.test/image.png"));
  assert.throws(() => decodeImageData("data:image/png;base64,!!!!"));
  const bytes = Uint8Array.from(Buffer.from(png, "base64"));
  assert.deepEqual(validateImage(bytes, "image/png"), { width: 1, height: 1 });
  assert.throws(() => validateImage(bytes, "image/jpeg"));
  new DataView(bytes.buffer).setUint32(16, 10001);
  assert.throws(() => validateImage(bytes, "image/png"));
});

test("JPEG and three WebP headers supply bounded dimensions", () => {
  const jpeg = Uint8Array.from([255,216,255,192,0,8,8,0,2,0,3,1]);
  assert.deepEqual(validateImage(jpeg, "image/jpeg"), { width: 3, height: 2 });
  for (const kind of ["VP8X", "VP8 ", "VP8L"]) {
    const bytes = new Uint8Array(32);
    bytes.set(new TextEncoder().encode('RIFF'), 0);
    bytes.set(new TextEncoder().encode('WEBP'+kind), 8);
    if (kind === "VP8 ") bytes.set([0x9d,1,0x2a,3,0,2,0], 23);
    else if (kind === "VP8L") { bytes[20] = 0x2f; new DataView(bytes.buffer).setUint32(21, 2 + (1 << 14), true); }
    else { bytes[24] = 2; bytes[27] = 1; }
    assert.deepEqual(validateImage(bytes, "image/webp"), { width: 3, height: 2 });
  }
});

test("prompt and endpoint validation rejects whitespace, overflow, credentials, unsafe protocols and paths", () => {
  assert.equal(validatePrompt(" 木陰 "), "木陰");
  for (const value of ["", " \n ", null, "a".repeat(1001)]) assert.throws(() => validatePrompt(value));
  assert.equal(normalizeEndpoint("https://worker.test/"), "https://worker.test");
  for (const value of ["javascript:alert(1)", "http://worker.test", "https://key@worker.test", "https://worker.test/api", "https://worker.test/?key=x"]) assert.throws(() => normalizeEndpoint(value));
  assert.equal(normalizeEndpoint("http://127.0.0.1:8787", true), "http://127.0.0.1:8787");
});

test("vision uses the free Workers AI binding without API keys", async () => {
  const env = config({ AI: { run: async (model, body) => {
    assert.equal(model, VISION_MODEL);
    assert.equal(body.max_tokens, 500);
    assert.equal(body.messages[1].content[1].image_url.url, image);
    return { response: "木陰のベンチが写っています。" };
  } } });
  const response = await handleRequest(request("analyze", { image }), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  assert.deepEqual(await response.json(), { text: "木陰のベンチが写っています。" });
});

test("generation calls FLUX with four steps and validates PNG and JPEG results", async () => {
  const jpeg = Buffer.from([255,216,255,192,0,8,8,0,2,0,3,1]).toString('base64');
  for (const [data, mime] of [[png,'png'],[jpeg,'jpeg']]) {
    const env = config({ AI: { run: async (model, body) => {
      assert.equal(model, IMAGE_MODEL); assert.deepEqual(body, { prompt: "木陰のベンチ", steps: 4 });
      return { image: data };
    } } });
    const response = await handleRequest(request("generate", { prompt: "木陰のベンチ" }), env);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { image: `data:image/${mime};base64,${data}`, kind: "generated" });
  }
});

test("invalid input and missing bindings never invoke AI or a paid fallback", async () => {
  let called = 0;
  const env = config({ AI: { run: async () => { called++; } }, OPENAI_API_KEY: 'unused-test-secret' });
  for (const [task, data, status] of [["analyze", { image:"data:image/png;base64,AAAA" },400], ["generate",{prompt:" "},400], ["generate",{prompt:"x".repeat(1001)},400], ["generate",null,400], ["unknown",{},404]]) {
    assert.equal((await handleRequest(request(task,data),env)).status,status);
  }
  for (const overrides of [{AI:undefined},{IMAGE_RATE_LIMITER:undefined}]) {
    assert.equal((await handleRequest(request("generate",{prompt:"木陰"}),{...env,...overrides})).status,503);
  }
  assert.equal((await handleRequest(request("analyze",{image}, {"Content-Type":"text/plain"}),env)).status,415);
  assert.equal((await handleRequest(request("generate",{prompt:"木陰"},{Origin:"https://attacker.test"}),env)).status,403);
  const preflight = new Request("https://worker.test/api/images/generate", {method:"OPTIONS",headers:{Origin:origin}});
  assert.equal((await handleRequest(preflight,env)).status,204);
  assert.equal(called, 0);
});

test("streamed and declared request limits reject before an upstream call", async () => {
  const large = request("generate", {prompt:"x".repeat(9000)});
  assert.equal((await handleRequest(large,config())).status,413);
  const declared = request("analyze", {image},{"Content-Length":"99999999"});
  assert.equal((await handleRequest(declared,config())).status,413);
  let cancelled = false;
  const response = new Response(new ReadableStream({ pull(c) { c.enqueue(new Uint8Array(10)); }, cancel() {cancelled=true;} }));
  await assert.rejects(boundedJSON(response,15));
  assert.equal(cancelled,true);
});

test("rate limits cap per-client and aggregate traffic and fail safely", async () => {
  let called=0;
  const ai={ run:async()=>called++ };
  const denied = config({AI:ai,IMAGE_RATE_LIMITER:{limit:async () => ({success:false})}});
  assert.equal((await handleRequest(request("generate",{prompt:"木陰"}),denied)).status,429);
  let limits=0;
  const globalDenied=config({AI:ai,IMAGE_RATE_LIMITER:{limit:async () => ({success:++limits===1})}});
  assert.equal((await handleRequest(request("generate",{prompt:"木陰"}),globalDenied)).status,429);
  assert.equal(called,0);
  const broken=config({AI:ai,IMAGE_RATE_LIMITER:{limit:async () => {throw Error('internal secret');}}});
  const response=await handleRequest(request("generate",{prompt:"木陰"}),broken);
  assert.equal(response.status,502); assert.doesNotMatch(await response.text(),/secret/);
});

test("provider errors and malformed images never expose internal data", async () => {
  for (const provider of [async()=>{throw Error('test-secret-must-not-leak');},async()=>({image:'<script>'}),async()=>({image:'invalid base64'})]) {
    const response=await handleRequest(request("generate",{prompt:"木陰"}),config({AI:{run:provider}}));
    assert.equal(response.status,502);
    assert.doesNotMatch(await response.text(),/test-secret|<script>|invalid base64/);
  }
  const response=await handleRequest(request("analyze",{image}),config({AI:{run:async()=>({response:''})}}));
  assert.equal(response.status,502);
});

test("free quota exhaustion and paid-only models stop without retrying another provider", async () => {
  for (const [code,status,publicCode] of [[3036,429,'FREE_QUOTA_EXCEEDED'],[5035,503,'PAID_MODEL_REJECTED'],[5016,503,'MODEL_SETUP_REQUIRED'],[3040,429,'AI_BUSY']]) {
    let calls=0;
    const env=config({OPENAI_API_KEY:'unused-secret',AI:{run:async()=>{
      calls++; const error=new Error(`AI_ERROR: ${code} private account details`); throw error;
    }}});
    const response=await handleRequest(request('generate',{prompt:'木陰'}),env);
    assert.equal(response.status,status); assert.equal(calls,1);
    const data=await response.json(); assert.equal(data.code,publicCode);
    assert.doesNotMatch(JSON.stringify(data),/private|secret/);
  }
});

test("vision timeout stops waiting and returns a safe retryable error", async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  let started;
  const ready=new Promise(resolve=>started=resolve);
  const pending=handleRequest(request("analyze",{image}),config({AI:{run:()=>new Promise(()=>started())}}));
  await ready; t.mock.timers.tick(45001);
  const response=await pending;
  assert.equal(response.status,504); assert.doesNotMatch(await response.text(),/secret/);
});

test("client validates outputs, hides internal errors and can retry", async () => {
  const endpoint="https://worker.test";
  await assert.rejects(requestImageTask(endpoint,"analyze",{image},{fetcher:async()=>new Response('private key',{status:500})}), /AI処理/);
  assert.equal(await requestImageTask(endpoint,"analyze",{image},{fetcher:async()=>json({text:'<img src=x onerror=alert(1)>'})}),'<img src=x onerror=alert(1)>');
  assert.equal(await requestImageTask(endpoint,"generate",{prompt:'木陰'},{fetcher:async()=>json({image})}),image);
  await assert.rejects(requestImageTask(endpoint,"generate",{prompt:'木陰'},{fetcher:async()=>json({image:'https://untrusted.test/x.svg'})}));
});

test("secret files are ignored, example is trackable and public scripts contain no credentials", () => {
  const paths=['.env.local','ai-service/.env.local','ai-service/.dev.vars'];
  const ignored=execFileSync('git',['check-ignore',...paths],{encoding:'utf8'}).trim().split('\n');
  assert.deepEqual(ignored,paths);
  assert.throws(()=>execFileSync('git',['check-ignore','ai-service/.env.example'],{stdio:'pipe'}));
  const publicFiles=['image-config.js','image-tools.js','image-service.js'];
  for (const path of publicFiles) assert.doesNotMatch(readFileSync(new URL('../'+path,import.meta.url),'utf8'),/OPENAI_API_KEY|Bearer /);
});


test("client explains free quota exhaustion without displaying raw provider messages", async () => {
  await assert.rejects(requestImageTask('https://worker.test','generate',{prompt:'木陰'},{
    fetcher:async()=>new Response(JSON.stringify({code:'FREE_QUOTA_EXCEEDED',error:'private-account-data'}),{status:429}),
  }), /本日のAI無料枠/);
});

test("deployed runtime has an AI binding and no paid provider endpoint or secret reference", () => {
  const config=JSON.parse(readFileSync(new URL('../ai-service/wrangler.jsonc',import.meta.url),'utf8'));
  assert.equal(config.ai.binding,'AI');
  for (const path of ['worker.mjs','image-handlers.mjs','free-ai.mjs']) {
    const source=readFileSync(new URL('../ai-service/'+path,import.meta.url),'utf8');
    assert.doesNotMatch(source,/api\.openai\.com|OPENAI_API_KEY|Bearer /);
  }
});
