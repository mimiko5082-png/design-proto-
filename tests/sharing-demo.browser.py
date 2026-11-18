"""The new public-sharing UI can be reviewed with labelled, isolated sample posts."""
import os,subprocess,threading
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
def go(page,target):
 # No tab bar. みんなの記録 (the former friends feed and calendar) opens from the calendar button on the camera
 # screen and returns through the camera button at the bottom centre.
 # Like the old tab press, every call mounts the destination afresh.
 if page.locator('.screen-nav').count():
  page.locator('.screen-nav [data-nav=home]').click()
  if target=='home':return
 page.locator('.capture-stage [data-nav=friends]').click()
 if target=='home':page.locator('.screen-nav [data-nav=home]').click()
ROOT=Path(__file__).resolve().parent.parent
subprocess.run(['npm','--prefix','preview','run','share'],cwd=ROOT,check=True)
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT/'preview')))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':390,'height':844});errors=[];requests=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.on('request',lambda request:requests.append(request.url) if request.url.startswith(('http://','https://')) else None)
  origin=f'http://127.0.0.1:{server.server_port}'
  page.goto(origin+'/share.html?sharing=demo',wait_until='networkidle')
  expect(page.locator('.public-feed')).to_be_visible()
  expect(page.locator('.feed-post')).to_have_count(2)
  expect(page.locator('.public-retention')).to_contain_text('プレビューでは');expect(page.locator('.records-friends')).to_contain_text('＋ 招待')
  expect(page.locator('.feed-post-author').first).to_contain_text('サンプル')
  page.locator('.friend-photo-tile').first.click()
  expect(page.locator('[data-stamp=heart]')).to_be_visible()
  page.locator('[data-stamp=heart]').click()
  expect(page.locator('.sharing-profile-dialog')).to_contain_text('実際の利用者には公開されません')
  page.locator('.sharing-profile-dialog input').fill('おためし')
  page.locator('.sharing-profile-dialog [type=submit]').click()
  expect(page.locator('[data-stamp=heart]')).to_have_attribute('aria-pressed','true')
  page.locator('[data-public-comment]').fill('その見方すき！')
  page.locator('[data-public-form] .main-button').click()
  expect(page.locator('.friend-comments')).to_contain_text('その見方すき！')
  page.locator('[data-public-action=close]').click()
  expect(page.locator('.public-reaction-count').first).to_contain_text('リアクション 1 · ひとこと 1')
  page.screenshot(path='/tmp/basho-sharing-ui-demo.png',full_page=True)
  go(page,'home')
  expect(page.locator('[data-haiku-action=camera]')).to_be_enabled()
  page.locator('[data-haiku-photo]').set_input_files(str(ROOT/'assets/kotoba-sunset.png'))
  # Nothing is sent until the send button; sending moves to みんなの記録.
  expect(page.locator('[data-haiku-action=save]')).to_have_text('投稿する')
  page.locator('[data-photo-caption]').fill('プレビューの一枚')
  page.locator('[data-haiku-action=save]').click()
  expect(page.locator('.feed-heading h1')).to_have_text('みんなの記録')
  expect(page.locator('.post-complete-dialog')).to_contain_text('プレビューに投稿しました')
  page.locator('.post-later').click()
  expect(page.locator('.feed-post')).to_have_count(3)
  expect(page.locator('.friend-own-caption')).to_have_text('プレビューの一枚')
  page.reload(wait_until='networkidle')
  expect(page.locator('.feed-post')).to_have_count(3)
  for width in [320,390]:
   page.set_viewport_size({'width':width,'height':844})
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert not errors,errors
  assert all(url.startswith(origin+'/share.html') for url in requests),requests
  browser.close()
  print('PASS: labelled sharing preview opens the new UI, registers a demo identity, stamps/comments/publishes locally, reloads and makes no remote requests')
finally:server.shutdown()
