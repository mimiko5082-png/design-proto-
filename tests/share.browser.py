"""Test the self-contained preview used without Cloudflare or deployment secrets."""
import os
import subprocess
import threading
from datetime import datetime,timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent.parent
subprocess.run(['npm','--prefix','preview','run','share'],cwd=ROOT,check=True)
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT/'preview')))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
  context=browser.new_context(viewport={'width':390,'height':844})
  page=context.new_page();errors=[];requests=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.route('https://**/*',lambda route:route.abort())
  page.on('request',lambda request:requests.append(request.url) if request.url.startswith(('http://','https://')) else None)
  page.clock.install(time=datetime(2026,10,27,3,0,tzinfo=timezone.utc))
  page.goto(f'http://127.0.0.1:{server.server_port}/share.html',wait_until='networkidle')
  context.set_offline(True)
  page.locator('.tabbar [data-nav=home]').click()
  expect(page.locator('.haiku-topic')).to_be_visible()
  expect(page.locator('.home-view .reading-growth')).to_have_count(0)
  expect(page.locator('.tabbar [data-nav=garden]')).to_have_count(0)
  expect(page.locator('.tabbar .tab')).to_have_count(3)
  expect(page.locator('.home-view h1')).to_have_text('今日のお題')
  expect(page.locator('.photo-capture-actions')).to_be_hidden()
  expect(page.locator('[data-photo-note]')).to_have_count(0)
  expect(page.locator('[data-haiku-lines]')).to_have_count(0)
  expect(page.locator('[data-haiku-action=save]')).to_be_disabled()
  opening=page.locator('.photo-modern').inner_text()
  expect(page.locator('.haiku-topic')).not_to_contain_text('Wikisource')
  expect(page.locator('.haiku-topic')).not_to_contain_text('全集から選んだ60句')
  expect(page.locator('[data-photo-hint]')).to_be_hidden()
  page.locator('[data-haiku-action=hint]').click()
  expect(page.locator('[data-photo-hint]')).to_be_visible()
  expect(page.locator('[data-haiku-action=hint]')).to_have_attribute('aria-expanded','true')
  page.locator('[data-haiku-action=hint]').click()
  expect(page.locator('[data-photo-hint]')).to_be_hidden()
  page.locator('[data-haiku-photo]').set_input_files(str(ROOT/'assets/kotoba-forest.png'))
  expect(page.locator('basho-haiku .haiku-photo')).to_be_visible()
  caption='<帰り道> & 小さな光を見つけた。'
  page.locator('[data-photo-caption]').fill(caption)
  page.locator('[data-haiku-action=save]').click()
  expect(page.locator('.post-complete-dialog')).to_be_visible()
  page.locator('.post-later').click()
  page.locator('.tabbar [data-nav=home]').click()
  expect(page.locator('[data-haiku-action=save]')).to_have_text('今日の写真を保存済み')
  expect(page.locator('.photo-capture-preview-note')).to_have_count(0)
  expect(page.locator('[data-photo-note]')).to_have_count(0)
  original=page.locator('basho-haiku .haiku-photo').get_attribute('src')
  # Direct camera open/cancel/capture is covered by tests/camera.browser.py.
  page.locator('[data-haiku-photo]').set_input_files(str(ROOT/'assets/kotoba-lake.png'))
  expect(page.locator('[data-haiku-action=save]')).to_have_text('投稿する')
  page.locator('[data-haiku-action=cancel-photo]').click()
  expect(page.locator('basho-haiku .haiku-photo')).to_have_attribute('src',original)
  # A failed storage write must preserve the previous saved image and XP.
  page.locator('[data-haiku-photo]').set_input_files(str(ROOT/'assets/kotoba-lake.png'))
  expect(page.locator('[data-haiku-action=save]')).to_have_text('投稿する')
  page.evaluate("() => { window.originalPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function(){throw new DOMException('Quota','QuotaExceededError')}; }")
  page.locator('[data-haiku-action=save]').click()
  expect(page.locator('.reading-error')).to_contain_text('保存できませんでした')
  page.evaluate('() => { IDBObjectStore.prototype.put = window.originalPut; }')
  page.locator('.tabbar [data-nav=calendar]').click()
  expect(page.locator('.local-calendar-photo .postcard-image')).to_have_attribute('src',original)
  page.locator('.tabbar [data-nav=home]').click()
  expect(page.locator('[data-haiku-action=save]')).to_have_text('今日の写真を保存済み')
  page.locator('[data-haiku-photo]').set_input_files(str(ROOT/'assets/kotoba-lake.png'))
  expect(page.locator('[data-haiku-action=save]')).to_have_text('投稿する')
  replacement=page.locator('basho-haiku .haiku-photo').get_attribute('src')
  assert replacement != original
  page.locator('[data-haiku-action=save]').click()
  expect(page.locator('.haiku-status')).to_contain_text('写真を変更しました')
  page.locator('.tabbar [data-nav=calendar]').click()
  expect(page.locator('.local-calendar-photo')).to_have_count(1)
  expect(page.locator('.local-calendar-photo .postcard-caption')).to_have_text(caption)
  expect(page.locator('.local-calendar-photo .postcard-image')).to_have_attribute('src',replacement)
  expect(page.locator('[data-day="2026-10-27"] .calendar-day-photo')).to_have_attribute('src',replacement)
  context.set_offline(False);page.reload(wait_until='networkidle');context.set_offline(True)
  expect(page.locator('.local-calendar-photo')).to_have_count(1)
  expect(page.locator('.local-calendar-photo .postcard-caption')).to_have_text(caption)
  expect(page.locator('.local-calendar-photo .postcard-image')).to_have_attribute('src',replacement)
  expect(page.locator('[data-day="2026-10-27"] .calendar-day-photo')).to_have_attribute('src',replacement)
  page.locator('.tabbar [data-nav=home]').click()
  expect(page.locator('[data-haiku-action=save]')).to_have_text('今日の写真を保存済み')
  expect(page.locator('[data-haiku-photo]')).to_have_count(1)
  # The normal single-file preview now requires Firebase for friends sharing.
  # Offline, local photos remain readable and the login control stays available.
  page.locator('.tabbar [data-nav=friends]').click()
  expect(page.get_by_role('button',name='Googleでログインする',exact=True)).to_be_visible()
  expect(page.get_by_role('button',name='参加中の友達を見る',exact=True)).to_have_count(0)
  expect(page.locator('.public-local')).to_contain_text('この端末のカレンダーに保存しています')
  page.locator('.tabbar [data-nav=calendar]').click()
  expect(page.locator('.local-calendar-photo .postcard-caption')).to_have_text(caption)
  expect(page.locator('.local-calendar-photo .postcard-image')).to_have_attribute('src',replacement)
  for width in [320,390]:
   page.set_viewport_size({'width':width,'height':844})
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.screenshot(path='/tmp/basho-friends-preview.png',full_page=True)
  assert len([url for url in requests if url.endswith('/share.html')])==2,requests
  assert all(url.endswith('/share.html') or url.startswith('https://www.gstatic.com/firebasejs/') for url in requests),requests
  assert not errors,errors
  for width in [320,390]:
   page.set_viewport_size({'width':width,'height':844})
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  browser.close()
  print('PASS: single-file preview, photo save/replacement, daily limit, calendar, reload, mobile and offline Firebase fallback; external requests blocked')
finally:
 server.shutdown()
