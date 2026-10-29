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
  page.locator('[data-haiku-action=save]').click()
  expect(page.locator('[data-haiku-action=save]')).to_have_text('今日の写真を保存済み')
  expect(page.locator('.photo-capture-preview-note')).to_have_count(0)
  expect(page.locator('[data-photo-note]')).to_have_count(0)
  original=page.locator('basho-haiku .haiku-photo').get_attribute('src')
  # Retake opens the picker; dismissing it preserves the existing photo.
  with page.expect_file_chooser() as chooser:
   page.locator('[data-haiku-action=retake]').click()
  chooser.value.set_files([])
  expect(page.locator('basho-haiku .haiku-photo')).to_have_attribute('src',original)
  # Selecting a replacement is a draft; cancellation preserves the saved photo.
  with page.expect_file_chooser() as chooser:
   page.locator('[data-haiku-action=retake]').click()
  chooser.value.set_files(str(ROOT/'assets/kotoba-lake.png'))
  expect(page.locator('[data-haiku-action=save]')).to_have_text('送信する')
  page.locator('[data-haiku-action=cancel-photo]').click()
  expect(page.locator('basho-haiku .haiku-photo')).to_have_attribute('src',original)
  # A failed storage write must preserve the previous saved image and XP.
  page.locator('[data-haiku-photo]').set_input_files(str(ROOT/'assets/kotoba-lake.png'))
  expect(page.locator('[data-haiku-action=save]')).to_have_text('送信する')
  page.evaluate("() => { window.originalPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function(){throw new DOMException('Quota','QuotaExceededError')}; }")
  page.locator('[data-haiku-action=save]').click()
  expect(page.locator('.reading-error')).to_contain_text('保存できませんでした')
  page.evaluate('() => { IDBObjectStore.prototype.put = window.originalPut; }')
  page.locator('.tabbar [data-nav=calendar]').click()
  expect(page.locator('.saved-haiku .haiku-photo')).to_have_attribute('src',original)
  page.locator('.tabbar [data-nav=home]').click()
  expect(page.locator('[data-haiku-action=save]')).to_have_text('今日の写真を保存済み')
  page.locator('[data-haiku-photo]').set_input_files(str(ROOT/'assets/kotoba-lake.png'))
  expect(page.locator('[data-haiku-action=save]')).to_have_text('送信する')
  replacement=page.locator('basho-haiku .haiku-photo').get_attribute('src')
  assert replacement != original
  page.locator('[data-haiku-action=save]').click()
  expect(page.locator('.haiku-status')).to_contain_text('写真を変更しました')
  page.locator('.tabbar [data-nav=calendar]').click()
  expect(page.locator('.saved-haiku')).to_have_count(1)
  expect(page.locator('.saved-haiku .haiku-photo')).to_have_attribute('src',replacement)
  expect(page.locator('[data-day="2026-10-27"] .calendar-day-photo')).to_have_attribute('src',replacement)
  context.set_offline(False);page.reload(wait_until='networkidle');context.set_offline(True)
  expect(page.locator('.saved-haiku')).to_have_count(1)
  expect(page.locator('.saved-haiku .haiku-photo')).to_have_attribute('src',replacement)
  expect(page.locator('[data-day="2026-10-27"] .calendar-day-photo')).to_have_attribute('src',replacement)
  page.locator('.tabbar [data-nav=home]').click()
  expect(page.locator('[data-haiku-action=save]')).to_have_text('今日の写真を保存済み')
  expect(page.locator('[data-haiku-photo]')).to_have_count(1)
  # Same-prompt gallery, local-only sample reactions, comments, and their isolation.
  page.locator('.tabbar [data-nav=friends]').click()
  expect(page.locator('basho-friends')).to_be_visible()
  expect(page.locator('.friends-preview-note')).to_have_count(0)
  expect(page.locator('.friends-prompt')).to_contain_text(opening)
  expect(page.locator('.friend-own-photo')).to_have_count(1)
  expect(page.locator('.friend-photo-tile')).to_have_count(3)
  expect(page.locator('body')).not_to_contain_text('写真とお題を友達に送る')
  page.locator('[data-post=sample-aoi]').click()
  page.locator('[data-stamp=view]').click()
  expect(page.locator('[data-stamp=view]')).to_have_attribute('aria-pressed','true')
  page.locator('[data-stamp=view]').click()
  expect(page.locator('[data-stamp=view]')).to_have_attribute('aria-pressed','false')
  page.locator('[data-stamp=same]').click()
  page.locator('[data-friend-action=phrase]').filter(has_text='その見方すき').click()
  expect(page.locator('[data-friend-comment]')).to_have_value('その見方すき')
  page.locator('[data-friend-comment-form] button[type=submit]').click()
  expect(page.locator('.friend-comments')).to_contain_text('その見方すき')
  page.locator('[data-friend-comment]').fill('<img src=x onerror=alert(1)> & 発見！')
  page.locator('[data-friend-comment-form] button[type=submit]').click()
  expect(page.locator('.friend-comments li')).to_have_count(2)
  expect(page.locator('.friend-comments img')).to_have_count(0)
  page.locator('[data-post=sample-haru]').click()
  expect(page.locator('.friend-comments li')).to_have_count(0)
  expect(page.locator('[data-stamp=same]')).to_have_attribute('aria-pressed','false')
  context.set_offline(False);page.reload(wait_until='networkidle');context.set_offline(True)
  page.locator('[data-post=sample-aoi]').click()
  expect(page.locator('.friend-comments li')).to_have_count(2)
  expect(page.locator('[data-stamp=same]')).to_have_attribute('aria-pressed','true')
  page.locator('[data-friend-action=delete]').last.click()
  expect(page.locator('.friend-comments li')).to_have_count(1)
  # Tomorrow has its own prompt/reactions; yesterday's responses cannot leak into it.
  page.clock.fast_forward(86400000)
  expect(page.locator('.friends-prompt')).to_contain_text('2026-10-28')
  page.locator('[data-post=sample-aoi]').click()
  expect(page.locator('.friend-comments li')).to_have_count(0)
  expect(page.locator('[data-stamp=same]')).to_have_attribute('aria-pressed','false')
  for width in [320,390]:
   page.set_viewport_size({'width':width,'height':844})
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.screenshot(path='/tmp/basho-friends-preview.png',full_page=True)
  assert len(requests)==3 and all(url.endswith('/share.html') for url in requests),requests
  assert not errors,errors
  for width in [320,390]:
   page.set_viewport_size({'width':width,'height':844})
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  browser.close()
  print('PASS: single-file preview, modern prompt, photo, daily limit, save, photo calendar, reload, friends gallery, stamps, comments, mobile; no external requests')
finally:
 server.shutdown()
