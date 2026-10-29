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
  page.locator('.tabbar [data-nav=garden]').click()
  expect(page.locator('.reading-mode-garden [data-nav=home]')).to_have_text('今日の一枚を撮ろう')
  page.locator('.tabbar [data-nav=home]').click()
  expect(page.locator('.haiku-topic')).to_be_visible()
  expect(page.locator('[data-haiku-lines]')).to_have_count(0)
  expect(page.locator('[data-haiku-action=save]')).to_be_disabled()
  opening=page.locator('.photo-modern').inner_text()
  expect(page.locator('.haiku-topic a')).to_have_attribute('href','https://ja.wikisource.org/wiki/芭蕉俳句全集')
  expect(page.locator('.haiku-topic details')).to_contain_text('全集から選んだ60句')
  page.locator('[data-haiku-action=simulate]').click()
  expect(page.locator('.haiku-status')).to_contain_text('プレビュー内の通知体験')
  note = 'いつもの道の影が、葉っぱの形になっていた。\n<気づき> & 光'
  page.locator('[data-haiku-reflection]').fill(note)
  page.locator('[data-haiku-photo]').set_input_files(str(ROOT/'assets/kotoba-forest.png'))
  expect(page.locator('basho-haiku .haiku-photo')).to_be_visible()
  page.locator('[data-haiku-action=save]').click()
  expect(page.locator('[data-haiku-action=save]')).to_have_text('今日の写真を保存済み')
  expect(page.locator('[data-haiku-reflection]')).to_have_value(note)
  original=page.locator('basho-haiku .haiku-photo').get_attribute('src')
  # Selecting a replacement is a draft; cancellation preserves the saved photo.
  page.locator('[data-haiku-photo]').set_input_files(str(ROOT/'assets/kotoba-lake.png'))
  expect(page.locator('[data-haiku-action=save]')).to_have_text('この写真に変更')
  expect(page.locator('[data-haiku-action=share]')).to_be_disabled()
  page.locator('[data-haiku-action=cancel-photo]').click()
  expect(page.locator('basho-haiku .haiku-photo')).to_have_attribute('src',original)
  # A failed storage write must preserve the previous saved image and XP.
  page.locator('[data-haiku-photo]').set_input_files(str(ROOT/'assets/kotoba-lake.png'))
  expect(page.locator('[data-haiku-action=save]')).to_have_text('この写真に変更')
  page.evaluate("() => { window.originalPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function(){throw new DOMException('Quota','QuotaExceededError')}; }")
  page.locator('[data-haiku-action=save]').click()
  expect(page.locator('.reading-error')).to_contain_text('保存できませんでした')
  page.evaluate('() => { IDBObjectStore.prototype.put = window.originalPut; }')
  page.locator('.tabbar [data-nav=calendar]').click()
  expect(page.locator('.saved-haiku .haiku-photo')).to_have_attribute('src',original)
  page.locator('.tabbar [data-nav=home]').click()
  expect(page.locator('[data-haiku-action=save]')).to_have_text('今日の写真を保存済み')
  page.locator('[data-haiku-photo]').set_input_files(str(ROOT/'assets/kotoba-lake.png'))
  expect(page.locator('[data-haiku-action=save]')).to_have_text('この写真に変更')
  replacement=page.locator('basho-haiku .haiku-photo').get_attribute('src')
  assert replacement != original
  page.locator('[data-haiku-action=save]').click()
  expect(page.locator('.haiku-status')).to_contain_text('写真を変更しました')
  expect(page.locator('.reading-xp')).to_have_text('1 ことば')
  page.evaluate("""() => {
    navigator.canShare = ({files}) => files.length === 1 && files[0].type.startsWith('image/');
    navigator.share = async data => { window.shared = {text:data.text, name:data.files[0].name, size:data.files[0].size}; };
  }""")
  page.locator('[data-haiku-action=share]').click()
  expect(page.locator('.haiku-status')).to_contain_text('共有画面を開きました')
  assert opening in page.evaluate('window.shared.text')
  assert note not in page.evaluate('window.shared.text')
  assert page.evaluate('window.shared.size') > 0
  expect(page.locator('.reading-xp')).to_have_text('1 ことば')
  page.locator('.tabbar [data-nav=calendar]').click()
  expect(page.locator('.saved-haiku')).to_have_count(1)
  expect(page.locator('.photo-reflection-saved p')).to_have_text(note)
  expect(page.locator('.saved-haiku .haiku-photo')).to_have_attribute('src',replacement)
  context.set_offline(False);page.reload(wait_until='networkidle');context.set_offline(True)
  expect(page.locator('.saved-haiku')).to_have_count(1)
  expect(page.locator('.photo-reflection-saved p')).to_have_text(note)
  expect(page.locator('.saved-haiku .haiku-photo')).to_have_attribute('src',replacement)
  page.evaluate('navigator.canShare = () => false')
  with page.expect_download() as download:
   page.locator('[data-reading-action=share-photo]').click()
  assert download.value.suggested_filename.startswith('basho-2026-10-27')
  page.locator('.tabbar [data-nav=home]').click()
  expect(page.locator('[data-haiku-action=save]')).to_have_text('今日の写真を保存済み')
  expect(page.locator('[data-haiku-photo]')).to_have_count(1)
  expect(page.locator('[data-haiku-reflection]')).to_have_value(note)
  page.locator('[data-haiku-reflection]').fill('追記だけでも保存できる')
  expect(page.locator('[data-haiku-action=save]')).to_have_text('気づきを保存')
  page.locator('[data-haiku-action=cancel-photo]').click()
  expect(page.locator('[data-haiku-reflection]')).to_have_value(note)
  # Empty is valid: a saved note can be removed without creating a new photo/XP.
  page.locator('[data-haiku-reflection]').fill('')
  page.locator('[data-haiku-action=save]').click()
  expect(page.locator('.haiku-status')).to_contain_text('気づきを保存しました')
  page.locator('.tabbar [data-nav=calendar]').click()
  expect(page.locator('.photo-reflection-saved')).to_have_count(0)

  page.locator('.tabbar [data-nav=garden]').click()
  expect(page.locator('.reading-xp')).to_have_text('1 ことば')
  expect(page.locator('.reading-mode-garden [data-nav=home]')).to_have_text('今日の写真を保存済み')
  assert len(requests)==2 and all(url.endswith('/share.html') for url in requests),requests
  assert not errors,errors
  for width in [320,390]:
   page.set_viewport_size({'width':width,'height':844})
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  browser.close()
  print('PASS: single-file preview, modern prompt, photo, native sharing, download fallback, daily limit, save, calendar, reload, growth, mobile; no external requests')
finally:
 server.shutdown()
