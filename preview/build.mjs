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
  'reading-garden.js', 'photo-albums.js', 'garden-colors.js', 'photo-postcard.js', 'reading-store.js', 'tanka-catalog.js',
  'haiku-cards.js', 'haiku-catalog.js', 'haiku-service.js', 'haiku-store.js',
  'observation-timer.js', 'photo-sharing.js', 'friends-feed.js', 'friend-reactions.js', 'public-feed.js', 'sharing-client.js',
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
  if(file==='friends-feed.js') content=content.replace('if (!window.BASHO_FRIENDS_PREVIEW)', 'if (!window.BASHO_FRIENDS_PREVIEW || window.BASHO_SHARING_DEMO)');
  if(file==='sharing-client.js') {
    content=content.replace('  if(window.BASHO_PHOTO_PREVIEW) throw', "  if(window.BASHO_PHOTO_PREVIEW && window.BASHO_SHARING_DEMO) return (await import('./sharing-demo.js')).demoAPI(action,{...data,identity:sharingProfile()});\n  if(window.BASHO_PHOTO_PREVIEW) throw");
    content=content.replace('みんなに写真を公開する','プレビューで投稿を試す').replace('投稿すると、写真・ひとこと・表示名がアプリを使う全員に公開されます。','このプレビューでは投稿・ひとこと・スタンプをこの端末内だけに保存します。実際の利用者には公開されません。').replace('この表示名で公開を始める','この表示名で試す').replace('写真は約30日間サーバーに保存されます。','プレビューの写真と登録情報はこの端末内だけに保存します。');
  }
  if(file==='haiku-cards.js') content=content.replace('if(window.BASHO_PHOTO_PREVIEW) return false;', 'if(window.BASHO_PHOTO_PREVIEW && !window.BASHO_SHARING_DEMO) return false;').replace('写真を全員に公開しました。','プレビューに投稿しました。実際には公開されません。');
  if(file==='photo-postcard.js') content=content.replace('写真をみんなに公開しました！','プレビューに投稿しました！');
  if(file==='public-feed.js') content=content.replace('アプリを使う全員に公開される写真です。','共有画面の体験用です。サンプル投稿を表示し、操作はこの端末内だけに保存します。').replace('公開した写真は約30日後にサーバーから削除されます。端末に保存した写真はカレンダーに残ります。','プレビューでは実際のサーバーへの公開・送信は行いません。').replace('通報を受け付けました。運営による確認待ちです。','プレビューで通報操作を試しました。実際には送信されません。').replace('写真を全員に公開しました。','プレビューに投稿しました。実際には公開されません。');
  writeFileSync(join(out, file), content);
}
cpSync(join(root, 'assets'), join(out, 'assets'), { recursive: true });
cpSync(join(here, 'runtime.js'), join(out, 'preview-runtime.js'));
cpSync(join(here, 'notification-demo.js'), join(out, 'notification-demo.js'));
cpSync(join(here, 'sharing-demo.js'), join(out, 'sharing-demo.js'));
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
html = html.replace('<body>', '<body><aside class="preview-banner"><strong>本番とは別のプレビュー</strong> · 写真や反応はこの端末内<button type="button" data-notification-demo>通知を試す</button></aside>');
html = html.replace('</body>', '<script type="module" src="./notification-demo.js"></script></body>');
html = html.replace('</head>', `<style>
${readFileSync(join(here, 'notification-demo.css'), 'utf8')}
.preview-banner { position:fixed; top:0; left:0; right:0; z-index:100; padding:6px 8px; background:#102418; color:#b9d8c1; font:10px/1.6 sans-serif; text-align:center; }
.app-shell { padding-top:42px; }
.phone { height:calc(100svh - 56px); min-height:calc(100svh - 56px); }
@media(min-width:600px){ .phone { height:min(900px,calc(100svh - 56px)); min-height:min(700px,calc(100svh - 56px)); } }
</style></head>`);
writeFileSync(join(out, 'index.html'), html);
writeFileSync(join(out, '_headers'), `/*
  Cache-Control: no-store
  X-Robots-Tag: noindex, nofollow
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'
`);
console.log('Static preview built in preview/dist. Shared database, live AI, notifications and service worker disabled.');
