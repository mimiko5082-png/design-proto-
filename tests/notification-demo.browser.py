"""Visual 08:00 simulation never requests notification permission or writes a photo."""
import os
import subprocess
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parent.parent
subprocess.run(['npm','--prefix','preview','run','share'],cwd=ROOT,check=True)
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT/'preview')))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':390,'height':844})
  errors=[];external=[]
  origin=f'http://127.0.0.1:{server.server_port}'
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.on('request',lambda req:external.append(req.url) if req.url.startswith(('http://','https://')) and not req.url.startswith(origin+'/') else None)
  page.add_init_script("window.permissionRequests=0;Object.defineProperty(window,'Notification',{value:class {static requestPermission(){window.permissionRequests++;throw Error('No real notification permission in demo');}}});")
  page.goto(origin+'/share.html?notification=morning',wait_until='networkidle')
  expect(page.locator('.notification-demo-dialog')).to_be_visible()
  expect(page.locator('.notification-demo-clock')).to_have_text('8:00')
  expect(page.locator('.notification-demo-card strong')).to_have_text('今日のお題、のぞいてみよう。')
  expect(page.locator('.notification-demo-body')).to_contain_text('まだ気づいていない一枚')
  original=page.locator('.photo-modern').inner_text()
  page.screenshot(path='/tmp/basho-morning-notification.png',full_page=True)
  page.locator('[data-demo-open]').click()
  expect(page.locator('.notification-demo-dialog')).to_have_count(0)
  expect(page.locator('[data-haiku-action=camera]')).to_be_visible()
  expect(page.locator('.photo-modern')).to_have_text(original)
  expect(page.locator('.haiku-photo')).to_have_count(0)
  for width in [320,390]:
   page.set_viewport_size({'width':width,'height':700})
   page.locator('[data-notification-demo]').click()
   expect(page.locator('.notification-demo-dialog')).to_be_visible()
   assert page.locator('.notification-demo-dialog').evaluate('(el)=>el.scrollWidth<=el.clientWidth')
   page.keyboard.press('Escape')
   expect(page.locator('.notification-demo-dialog')).to_have_count(0)
  assert page.evaluate('permissionRequests')==0
  assert not errors,errors
  assert not external,external
  browser.close()
  print('PASS: 08:00 preview auto-opens, matches notification copy, taps through to today, reopens and closes; no real push or external calls')
finally:server.shutdown()
