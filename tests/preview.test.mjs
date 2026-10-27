import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
execFileSync(process.execPath, ['preview/build.mjs'], { cwd: root });
const dir=resolve(root,'preview/dist');
const text=file=>readFileSync(resolve(dir,file),'utf8');
test('preview build strips production credentials, live Firebase and service worker registration',()=>{
 assert.equal(text('firebase-config.js'),'window.BASHO_FIREBASE = {};\n');
 assert.equal(text('image-config.js'),'window.BASHO_IMAGES = {endpoint:"https://preview.invalid"};\n');
 assert.doesNotMatch(text('basho-app.js'),/gstatic\.com\/firebasejs/);
 assert.doesNotMatch(text('index.html'),/serviceWorker\.register|notification-settings\.js/);
 assert.match(text('index.html'),/preview-runtime\.js/);
 assert.match(text('haiku-store.js'),/basho-haiku-preview-only/);
 assert.ok(!existsSync(resolve(dir,'sw.js')));
 assert.ok(!existsSync(resolve(dir,'ai-service')));
});
test('all emitted relative JS module dependencies exist',()=>{
 for(const file of readdirSync(dir).filter(name=>name.endsWith('.js'))) {
  const matches=text(file).matchAll(/(?:from\s*|import\s*\()\s*["'](\.\/[^"']+)["']/g);
  for(const match of matches) assert.ok(existsSync(resolve(dir,match[1].split('?')[0])),`${file}: ${match[1]}`);
 }
});
test('static preview targets only the preview worker and prevents caching/external connections',()=>{
 const config=JSON.parse(readFileSync(resolve(root,'preview/wrangler.jsonc'),'utf8'));
 assert.equal(config.name,'basho-preview'); assert.equal(config.assets.directory,'./dist');
 assert.equal(config.ai,undefined);assert.equal(config.d1_databases,undefined);assert.equal(config.triggers,undefined);
 assert.match(text('_headers'),/Cache-Control: no-store/);
 assert.match(text('_headers'),/connect-src 'none'/);
 assert.match(text('_headers'),/worker-src 'none'/);
});
