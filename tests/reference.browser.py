"""Reference visual flow and the real framed PNG export, with isolated sample data."""
import os
import subprocess
import threading
from datetime import datetime,timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent.parent
subprocess.run(['node','preview/build.mjs'],cwd=ROOT,check=True)
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT/'preview/dist')))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':390,'height':844});errors=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.clock.install(time=datetime(2026,10,29,8,29,tzinfo=timezone.utc))
  page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='networkidle')
  expect(page.locator('[data-haiku-action=camera]')).to_be_enabled()
  assert page.locator('.photo-modern').evaluate('el=>getComputedStyle(el).color')=='rgb(50, 185, 110)'
  page.screenshot(path='/tmp/basho-reference-1-camera.png',full_page=True)
  page.locator('[data-haiku-photo]').set_input_files(str(ROOT/'assets/kotoba-sunset.png'))
  expect(page.locator('.haiku-photo')).to_be_visible()
  page.locator('[data-photo-caption]').fill('駅前のバス停、まだ日なたが暑い')
  expect(page.locator('[data-haiku-action=save]')).to_have_text('投稿する')
  page.screenshot(path='/tmp/basho-reference-2-compose.png',full_page=True)
  page.locator('[data-haiku-action=save]').click()
  expect(page.locator('.post-complete-dialog')).to_be_visible()
  page.screenshot(path='/tmp/basho-reference-3-complete.png',full_page=True)
  page.evaluate('() => { navigator.canShare=()=>false; }')
  with page.expect_download() as download:page.locator('[data-post-share]').click()
  assert download.value.suggested_filename=='basho-post-2026-10-29.png'
  with Image.open(download.value.path()) as image:
   assert image.size==(1080,1800) and image.format=='PNG'
   assert image.convert('RGB').getpixel((0,0))==(50,185,110)
  expect(page.locator('.friends-feature')).to_be_visible()
  expect(page.locator('.friend-own-caption')).to_have_text('駅前のバス停、まだ日なたが暑い')
  expect(page.locator('.friend-own-photo .postcard-prompt')).to_have_text(page.locator('.friend-photo-tile .postcard-prompt').first.inner_text())
  page.screenshot(path='/tmp/basho-reference-4-feed.png',full_page=True)
  page.locator('.tabbar [data-nav=calendar]').click()
  expect(page.locator('[data-day="2026-10-29"] .calendar-day-photo')).to_have_count(1)
  expect(page.locator('.saved-photo-caption')).to_have_text('駅前のバス停、まだ日なたが暑い')
  page.screenshot(path='/tmp/basho-reference-5-calendar.png',full_page=True)
  for width in [320,390,768]:
   page.set_viewport_size({'width':width,'height':844})
   assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
  assert not errors,errors
  browser.close()
  print('PASS: black/green camera, compose, completion, framed PNG export, same-prompt posts, photo calendar and responsive width')
finally:server.shutdown()
