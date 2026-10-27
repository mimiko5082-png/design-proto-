// Build a static preview of the actual app. No build dependencies or credentials.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const out = join(here, 'dist');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const files = [
  'basho-app.js', 'basho-styles.css', 'perspective.js', 'place.js',
  'image-tools.js', 'image-service.js', 'image-validation.js',
  'reading-garden.js', 'reading-store.js', 'tanka-catalog.js',
  'haiku-cards.js', 'haiku-catalog.js', 'haiku-service.js', 'haiku-store.js',
  'observation-timer.js',
];
for (const file of files) {
  let content = readFileSync(join(root, file), 'utf8');
  if (file === 'basho-app.js') {
    content = content.replace(/https:\/\/www\.gstatic\.com\/firebasejs\/[^"']+/g, './firebase-preview.js');
    if (content.includes('https://www.gstatic.com/firebasejs/')) throw Error('Firebase SDK was not isolated');
  }
  if (file === 'haiku-store.js') {
    if (!content.includes("'basho-haiku-cards'")) throw Error('Review storage isolation after changing haiku-store');
    content = content.replace("'basho-haiku-cards'", "'basho-haiku-preview-only'");
  }
  writeFileSync(join(out, file), content);
}
cpSync(join(root, 'assets'), join(out, 'assets'), { recursive: true });
cpSync(join(here, 'runtime.js'), join(out, 'preview-runtime.js'));
writeFileSync(join(out, 'firebase-preview.js'), ['initializeApp','getDatabase','ref','onValue','set','update','get'].map(name => `export function ${name}(){ throw Error('Shared Firebase is disabled in preview'); }`).join('\n'));
for (const [file, name] of [
  ['firebase-config.js', 'BASHO_FIREBASE'],
  ['perspective-config.js', 'BASHO_PERSPECTIVE'],
  ['image-config.js', 'BASHO_IMAGES'],
  ['notification-config.js', 'BASHO_NOTIFICATIONS'],
]) writeFileSync(join(out, file), `window.${name} = ${name === 'BASHO_IMAGES' ? '{endpoint:"https://preview.invalid"}' : '{}'};\n`);
let html = readFileSync(join(root, 'index.html'), 'utf8');
html = html.replace(/<script>\s*if \("serviceWorker" in navigator\) \{[\s\S]*?<\/script>/, '');
if (html.includes('serviceWorker.register')) throw Error('Service worker registration must be disabled in preview');
html = html.replace(/\s*<script type="module" src="\.\/notification-settings\.js[^>]*><\/script>/, '');
html = html.replace('<head>', '<head>\n<meta name="robots" content="noindex,nofollow">\n<script src="./preview-runtime.js"></script>');
html = html.replace('<title>芭蕉のまなざし</title>', '<title>プレビュー｜芭蕉の読み札</title>');
html = html.replace('<body>', '<body><aside class="preview-banner"><strong>本番とは別のプレビュー</strong> · AIは固定サンプル／写真の外部送信なし<br>30秒観察 → お題の書き出し → 自分の一句</aside>');
html = html.replace('</head>', `<style>
.preview-banner { position:fixed; top:0; left:0; right:0; z-index:100; padding:10px 12px; background:#344d38; color:#fff; font:12px/1.8 sans-serif; text-align:center; }
.app-shell { padding-top:82px; }
.phone { height:calc(100svh - 100px); min-height:calc(100svh - 100px); }
@media(min-width:600px){ .phone { height:min(900px,calc(100svh - 100px)); min-height:min(700px,calc(100svh - 100px)); } }
</style></head>`);
writeFileSync(join(out, 'index.html'), html);
writeFileSync(join(out, '_headers'), `/*
  Cache-Control: no-store
  X-Robots-Tag: noindex, nofollow
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'
`);
console.log('Static preview built in preview/dist. Shared database, live AI, notifications and service worker disabled.');
