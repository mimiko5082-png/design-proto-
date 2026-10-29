"""The built, auto-update preview must work without any real remote services."""
import json
import os
import subprocess
import threading
from datetime import datetime,timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent.parent
subprocess.run(['node','preview/build.mjs'],cwd=ROOT,check=True)
HEADERS="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'; worker-src 'none'; object-src 'none'"
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):
  self.send_header('Cache-Control','no-store')
  self.send_header('Content-Security-Policy',HEADERS)
  super().end_headers()
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT/'preview/dist')))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
  context=browser.new_context(viewport={'width':390,'height':844})
  page=context.new_page(); errors=[];external=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  base=f'http://127.0.0.1:{server.server_port}'
  page.on('request',lambda req:external.append(req.url) if req.url.startswith(('http://','https://')) and not req.url.startswith(base+'/') else None)
  page.clock.install(time=datetime(2026,10,27,3,0,tzinfo=timezone.utc))
  page.goto(base+'/',wait_until='networkidle')
  expect(page.locator('.preview-banner')).to_contain_text('本番とは別')
  expect(page.locator('.haiku-topic')).to_be_visible()
  expect(page.locator('[data-haiku-lines]')).to_have_count(0)
  expect(page.locator('[data-haiku-action=save]')).to_be_disabled()
  opening=page.locator('.photo-modern').inner_text()
  page.locator('[data-haiku-photo]').set_input_files(str(ROOT/'assets/kotoba-forest.png'))
  expect(page.locator('basho-haiku .haiku-photo')).to_be_visible()
  page.locator('[data-haiku-action=save]').click()
  expect(page.locator('.post-complete-dialog')).to_be_visible()
  page.locator('.post-later').click()
  page.locator('.tabbar [data-nav=home]').click()
  expect(page.locator('[data-haiku-action=save]')).to_have_text('今日の写真を保存済み')
  page.locator('.tabbar [data-nav=calendar]').click()
  expect(page.locator('.saved-haiku')).to_contain_text(opening)
  page.reload(wait_until='networkidle')
  expect(page.locator('.saved-haiku')).to_have_count(1)
  page.locator('.tabbar [data-nav=home]').click()
  expect(page.locator('[data-haiku-action=save]')).to_have_text('今日の写真を保存済み')
  expect(page.locator('[data-haiku-photo]')).to_have_count(1)

  assert page.evaluate('async()=> (await navigator.serviceWorker.getRegistrations()).length')==0
  assert not external,external
  assert not errors,errors
  browser.close()
  print('PASS: built preview, modern prompt, photo, daily limit, save, calendar, reload; zero external requests and no service worker')
finally:
 server.shutdown()
