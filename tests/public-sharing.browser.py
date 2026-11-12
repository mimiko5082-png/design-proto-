"""Two separate browsers share actual Worker/SQLite posts; no Firebase or real public service."""
import json,os,subprocess,threading,urllib.request,urllib.error
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent.parent
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
origin=f'http://127.0.0.1:{server.server_port}'
backend=subprocess.Popen(['node','tests/sharing-server.mjs',origin],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True)
port=json.loads(backend.stdout.readline())['port']
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
  contexts=[browser.new_context(viewport={'width':390,'height':844},service_workers='block') for _ in range(2)]
  errors=[]
  for context in contexts:
   context.route('**/firebase-config.js*',lambda route:route.fulfill(content_type='application/javascript',body='window.BASHO_FIREBASE={};'))
   context.route('**/notification-config.js*',lambda route:route.fulfill(content_type='application/javascript',body='window.BASHO_NOTIFICATIONS={endpoint:"https://sharing.test"};'))
   def firebase(route):
    names=['initializeApp'] if 'firebase-app.js' in route.request.url else ['getDatabase','ref','onValue','set','update','get']
    route.fulfill(content_type='application/javascript',body='\n'.join(f'export function {name}(){{throw Error("No legacy Firebase");}}' for name in names))
   context.route('https://www.gstatic.com/firebasejs/**',firebase)
   def api(route):
    if route.request.method=='OPTIONS':
     route.fulfill(status=204,headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS'});return
    path=route.request.url.split('sharing.test')[1]
    req=urllib.request.Request(f'http://127.0.0.1:{port}'+path,data=route.request.post_data.encode(),headers={'Content-Type':'application/json','Origin':origin},method='POST')
    try:response=urllib.request.urlopen(req)
    except urllib.error.HTTPError as error:response=error
    route.fulfill(status=response.code,body=response.read(),headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origin})
   context.route('https://sharing.test/api/sharing/**',api)
  a,b=[context.new_page() for context in contexts]
  for page in [a,b]:page.on('pageerror',lambda error:errors.append(str(error)));page.goto(origin+'/',wait_until='networkidle')
  b.locator('.tabbar [data-nav=friends]').click()
  expect(b.locator('.public-empty')).to_be_visible()
  # A captures and publishes to the actual local Worker, not a fixture feed.
  a.locator('[data-haiku-photo]').set_input_files(str(ROOT/'assets/kotoba-sunset.png'))
  a.locator('[data-photo-caption]').fill('いつもの駅前に緑の光')
  a.locator('[data-haiku-action=save]').click()
  expect(a.locator('.sharing-profile-dialog')).to_be_visible()
  a.locator('.sharing-profile-dialog input').fill('あおい')
  a.locator('.sharing-profile-dialog [type=submit]').click()
  expect(a.locator('.post-complete-dialog h2')).to_have_text('写真をみんなに公開しました！')
  a.locator('.post-later').click()
  expect(a.locator('.public-feed .friend-own-caption')).to_have_text('いつもの駅前に緑の光')
  b.locator('[data-public-action=refresh]').click()
  expect(b.locator('.public-feed .feed-post')).to_have_count(1)
  expect(b.locator('.postcard-caption')).to_have_text('いつもの駅前に緑の光')
  b.locator('[data-public-action=profile]').click()
  b.locator('.sharing-profile-dialog input').fill('はる')
  b.locator('.sharing-profile-dialog [type=submit]').click()
  expect(b.locator('.sharing-profile-dialog')).to_have_count(0)
  b.locator('.friend-photo-tile').click()
  expect(b.locator('[data-public-action=stamp][data-stamp=heart]')).to_be_visible()
  b.locator('[data-public-action=stamp][data-stamp=heart]').click()
  expect(b.locator('[data-stamp=heart]')).to_have_attribute('aria-pressed','true')
  b.locator('[data-public-comment]').fill('その見方すき！')
  b.locator('[data-public-form] .main-button').click()
  expect(b.locator('.friend-comments')).to_contain_text('その見方すき！')
  a.locator('.friend-photo-tile').click()
  expect(a.locator('[data-stamp=heart] b')).to_have_text('1')
  expect(a.locator('.friend-comments')).to_contain_text('はる')
  expect(a.locator('.friend-comments')).to_contain_text('その見方すき！')
  expect(a.locator('[data-public-action=delete-comment]')).to_have_count(0)
  a.screenshot(path='/tmp/basho-public-sharing.png',full_page=True)
  # Publication failure preserves local photo and never reports success.
  a.locator('.tabbar [data-nav=home]').click()
  a.locator('[data-photo-caption]').fill('通信に失敗しても保存する写真')
  a.route('https://sharing.test/api/sharing/publish',lambda route:route.fulfill(status=503,headers={'Access-Control-Allow-Origin':origin},content_type='application/json',body='{"error":"サーバーに接続できません。"}'))
  a.locator('[data-haiku-action=save]').click()
  expect(a.locator('.reading-error')).to_contain_text('公開結果を確認できません')
  expect(a.locator('[data-haiku-action=save]')).to_have_text('公開を再試行する')
  expect(a.locator('.haiku-photo')).to_be_visible()
  a.unroute('https://sharing.test/api/sharing/publish')
  a.locator('[data-haiku-action=save]').click()
  expect(a.locator('.haiku-status')).to_contain_text('全員に公開しました')
  b.locator('[data-public-action=close]').click()
  b.locator('[data-public-action=refresh]').click()
  expect(b.locator('.postcard-caption')).to_have_text('通信に失敗しても保存する写真')
  a.locator('.tabbar [data-nav=friends]').click()
  a.on('dialog',lambda dialog:dialog.accept())
  a.locator('[data-public-action=delete-photo]').click()
  expect(a.locator('.feed-post')).to_have_count(0)
  b.locator('[data-public-action=refresh]').click()
  expect(b.locator('.feed-post')).to_have_count(0)
  assert not errors,errors
  browser.close()
  print('PASS: two browser identities publish/read the same Worker-backed photo, exchange stamps/comments, retain local photo on failure, retry, and delete remotely')
finally:
 backend.terminate();backend.wait(timeout=10);server.shutdown()
