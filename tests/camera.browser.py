"""A browser-owned fake camera tests opening, capture, cancellation and track cleanup."""
import os
import subprocess
import threading
from datetime import datetime,timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent.parent
SHARE=os.environ.get('CAMERA_TEST_SHARE')=='1'
subprocess.run(['npm','--prefix','preview','run','share'] if SHARE else ['node','preview/build.mjs'],cwd=ROOT,check=True)
policy=(ROOT/'preview/dist/_headers').read_text().split('Content-Security-Policy: ')[1].strip()
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def end_headers(self):
  self.send_header('Content-Security-Policy',policy)
  super().end_headers()
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT/'preview' if SHARE else ROOT/'preview/dist')))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
  context=browser.new_context(viewport={'width':390,'height':844},permissions=['camera'])
  page=context.new_page();errors=[];external=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  origin=f'http://127.0.0.1:{server.server_port}'
  page.on('request',lambda req:external.append(req.url) if req.url.startswith(('http://','https://')) and not req.url.startswith(origin+'/') else None)
  page.add_init_script("""window.cameraCalls=0;window.cameraTracks=[];
   const native=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
   window.realGetCamera=async constraints=>{window.cameraCalls++;window.cameraConstraints=constraints;const stream=await native(constraints);window.cameraTracks.push(...stream.getTracks());return stream;};
   navigator.mediaDevices.getUserMedia=window.realGetCamera;""")
  page.clock.install(time=datetime(2026,10,29,3,0,tzinfo=timezone.utc))
  page.goto(origin+('/share.html' if SHARE else '/'),wait_until='networkidle')
  expect(page.locator('[data-haiku-action=camera]')).to_be_enabled()
  assert page.evaluate('window.cameraCalls')==0
  page.locator('[data-haiku-action=camera]').click()
  expect(page.locator('.photo-camera-dialog')).to_be_visible()
  expect(page.locator('[data-haiku-action=camera-shoot]')).to_be_enabled(timeout=15000)
  assert page.evaluate('window.cameraCalls')==1
  assert page.evaluate('window.cameraConstraints.audio')==False
  assert page.evaluate('window.cameraConstraints.video.facingMode.ideal')=='environment'
  page.screenshot(path='/tmp/basho-direct-camera.png',full_page=True)
  page.locator('[data-haiku-action=camera-shoot]').click()
  expect(page.locator('.photo-camera-dialog')).to_have_count(0)
  expect(page.locator('basho-haiku .haiku-photo')).to_be_visible()
  expect(page.locator('[data-haiku-action=save]')).to_have_text('投稿する')
  assert page.evaluate('window.cameraTracks.every(t=>t.readyState==="ended")')
  first=page.locator('basho-haiku .haiku-photo').get_attribute('src')
  # Closing retake preserves the existing photograph; Escape also stops tracks.
  page.locator('[data-haiku-action=retake]').click()
  expect(page.locator('[data-haiku-action=camera-shoot]')).to_be_enabled(timeout=15000)
  page.keyboard.press('Escape')
  expect(page.locator('.photo-camera-dialog')).to_have_count(0)
  expect(page.locator('basho-haiku .haiku-photo')).to_have_attribute('src',first)
  assert page.evaluate('window.cameraTracks.every(t=>t.readyState==="ended")')
  # Retake captures a new frame, but nothing is saved until the submit button.
  page.locator('[data-haiku-action=retake]').click()
  expect(page.locator('[data-haiku-action=camera-shoot]')).to_be_enabled(timeout=15000)
  page.locator('[data-haiku-action=camera-shoot]').click()
  expect(page.locator('.photo-camera-dialog')).to_have_count(0)
  expect(page.locator('[data-photo-caption]')).to_be_enabled()
  expect(page.locator('[data-haiku-action=save]')).to_be_enabled()
  page.locator('[data-photo-caption]').fill('いつもの道の光がきれい。')
  assert page.locator('basho-haiku').evaluate('(node)=>node.caption')=='いつもの道の光がきれい。'
  page.locator('[data-haiku-action=save]').click()
  expect(page.locator('.post-complete-dialog')).to_be_visible()
  page.locator('.post-later').click()
  page.locator('.tabbar [data-nav=home]').click()
  expect(page.locator('[data-haiku-action=save]')).to_have_text('今日の写真を保存済み')
  assert page.locator('basho-haiku').evaluate('(node)=>node.card.caption')=='いつもの道の光がきれい。'
  saved=page.locator('basho-haiku .haiku-photo').get_attribute('src')
  # A denied permission has a clear recovery and keeps the saved photograph.
  page.evaluate("() => { navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('denied','NotAllowedError')}; }")
  page.locator('[data-haiku-action=retake]').click()
  expect(page.locator('.reading-error')).to_contain_text('カメラへのアクセスを許可')
  expect(page.locator('basho-haiku .haiku-photo')).to_have_attribute('src',saved)
  with page.expect_file_chooser() as picker:page.locator('[data-haiku-action=pick-file]').click()
  picker.value.set_files([])
  # Permission granted after cancellation must stop its stale stream immediately.
  page.evaluate("() => { navigator.mediaDevices.getUserMedia=async constraints=>{await new Promise(resolve=>window.releaseCamera=resolve);return window.realGetCamera(constraints)}; }")
  page.locator('[data-haiku-action=retake]').click()
  expect(page.locator('.photo-camera-dialog')).to_be_visible()
  page.locator('[data-haiku-action=camera-close]').first.click()
  count=page.evaluate('window.cameraTracks.length')
  page.evaluate('window.releaseCamera()')
  page.wait_for_function('count => window.cameraTracks.length === count + 1 && window.cameraTracks.every(t=>t.readyState==="ended")',arg=count)
  expect(page.locator('.photo-camera-dialog')).to_have_count(0)
  # Routing away must release active camera resources.
  page.evaluate('() => { navigator.mediaDevices.getUserMedia=window.realGetCamera; }')
  page.locator('[data-haiku-action=retake]').click()
  expect(page.locator('[data-haiku-action=camera-shoot]')).to_be_enabled(timeout=15000)
  page.locator('.tabbar [data-nav=calendar]').evaluate('button=>button.click()')
  expect(page.locator('.reading-mode-calendar')).to_be_visible()
  assert page.evaluate('window.cameraTracks.every(t=>t.readyState==="ended")')
  expect(page.locator('.saved-haiku')).to_have_count(1)
  expect(page.locator('.saved-photo-caption')).to_have_text('いつもの道の光がきれい。')
  page.locator('.tabbar [data-nav=friends]').click()
  expect(page.locator('.friend-own-caption')).to_have_text('いつもの道の光がきれい。')
  assert not errors,errors
  assert not external,external
  browser.close()
  print('PASS: direct camera opening, rear preference, capture, retake/cancel, permission denial, stale grant and navigation track cleanup; no uploads')
finally:server.shutdown()
