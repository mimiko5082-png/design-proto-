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
  expect(page.locator('.haiku-topic')).to_have_count(0)
  page.locator('[data-haiku-action=observe]').click();page.clock.fast_forward(30000)
  expect(page.locator('.haiku-topic')).to_be_visible()
  page.locator('[data-haiku-action=example]').click()
  expect(page.locator('.haiku-examples')).to_contain_text('AIがあらかじめ作った例')
  page.locator('[data-haiku-photo]').set_input_files(str(ROOT/'assets/kotoba-forest.png'))
  expect(page.locator('basho-haiku .haiku-photo')).to_be_visible()
  page.locator('[data-haiku-action=generate]').click()
  expect(page.locator('.haiku-observed')).to_contain_text('写真の解析は行っていません')
  page.locator('[data-haiku-lines]').fill('小さな光\nひとつ落つ')
  page.locator('[data-haiku-action=save]').click()
  expect(page.locator('[data-haiku-action=save]')).to_have_text('読み札を保存済み')
  expect(page.locator('.reading-xp')).to_have_text('1 ことば')
  page.locator('.tabbar [data-nav=calendar]').click()
  expect(page.locator('.saved-haiku')).to_have_count(1)
  context.set_offline(False);page.reload(wait_until='networkidle');context.set_offline(True)
  expect(page.locator('.saved-haiku')).to_have_count(1)
  page.locator('.tabbar [data-nav=garden]').click()
  expect(page.locator('.reading-xp')).to_have_text('1 ことば')
  assert len(requests)==2 and all(url.endswith('/share.html') for url in requests),requests
  assert not errors,errors
  for width in [320,390]:
   page.set_viewport_size({'width':width,'height':844})
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  browser.close()
  print('PASS: single-file preview, observation, example, photo, mock AI, edit, save, calendar, reload, growth, mobile; no external requests')
finally:
 server.shutdown()
