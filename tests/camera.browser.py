"""A browser-owned fake camera tests the in-frame viewfinder, capture, cancellation and track cleanup."""
import re
import os
import subprocess
import threading
from datetime import datetime,timezone
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
  page.route('https://**/*',lambda route:route.abort())
  origin=f'http://127.0.0.1:{server.server_port}'
  page.on('request',lambda req:external.append(req.url) if req.url.startswith(('http://','https://')) and not req.url.startswith(origin+'/') else None)
  page.add_init_script("""window.cameraCalls=0;window.cameraTracks=[];
   const native=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
   window.realGetCamera=async constraints=>{window.cameraCalls++;window.cameraConstraints=constraints;const fakeConstraints=structuredClone(constraints);if(fakeConstraints.video.facingMode?.exact)delete fakeConstraints.video.facingMode;const stream=await native(fakeConstraints);for(const track of stream.getVideoTracks()){const settings=track.getSettings.bind(track);track.getSettings=()=>({...settings(),facingMode:constraints.video.facingMode?.exact || constraints.video.facingMode?.ideal || 'environment'});}window.cameraTracks.push(...stream.getTracks());return stream;};
   navigator.mediaDevices.getUserMedia=window.realGetCamera;""")
  page.clock.install(time=datetime(2026,10,29,3,0,tzinfo=timezone.utc))
  page.goto(origin+('/share.html' if SHARE else '/'),wait_until='networkidle')
  # Without today's photograph the viewfinder starts by itself inside the frame; there is no dialog.
  expect(page.locator('[data-haiku-action=camera-shoot]')).to_be_enabled(timeout=15000)
  expect(page.locator('.capture-stage.is-live video[data-camera-video]')).to_be_visible()
  expect(page.locator('dialog')).to_have_count(0)
  expect(page.locator('.capture-stage .photo-original')).to_be_visible()
  assert page.evaluate('window.cameraCalls')==1
  assert page.evaluate('window.cameraConstraints.audio')==False
  assert page.evaluate('window.cameraConstraints.video.facingMode.ideal')=='environment'
  # Switching lenses requests the other side explicitly and releases the old stream.
  page.locator('[data-haiku-action=camera-flip]').click()
  expect(page.locator('[data-haiku-action=camera-shoot]')).to_be_enabled(timeout=15000)
  assert page.evaluate('window.cameraConstraints.video.facingMode.exact')=='user'
  expect(page.locator('[data-camera-video]')).to_have_class(re.compile('is-front-camera'))
  expect(page.locator('[data-camera-status]')).to_contain_text('内カメ')
  assert page.evaluate('window.cameraTracks.slice(0,-1).every(t=>t.readyState==="ended")')
  page.locator('[data-haiku-action=camera-flip]').click()
  expect(page.locator('[data-haiku-action=camera-shoot]')).to_be_enabled(timeout=15000)
  assert page.evaluate('window.cameraConstraints.video.facingMode.exact')=='environment'
  expect(page.locator('[data-camera-video]')).not_to_have_class(re.compile('is-front-camera'))
  expect(page.locator('[data-camera-status]')).to_contain_text('外カメ')
  # A browser rejecting strict facingMode can still open that lens by preference.
  page.evaluate("""() => { window.nativeEnumerate=navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);navigator.mediaDevices.enumerateDevices=async()=>[];window.strictFailures=0;navigator.mediaDevices.getUserMedia=async constraints=>{if(constraints.video.facingMode?.exact){window.strictFailures++;throw new DOMException('unsupported constraint','OverconstrainedError');}return window.realGetCamera(constraints);}; }""")
  page.locator('[data-haiku-action=camera-flip]').click()
  expect(page.locator('[data-haiku-action=camera-shoot]')).to_be_enabled(timeout=15000)
  assert page.evaluate('window.strictFailures')==1
  assert page.evaluate('window.cameraConstraints.video.facingMode.ideal')=='user'
  expect(page.locator('[data-camera-status]')).to_contain_text('内カメ')
  page.evaluate('() => { navigator.mediaDevices.getUserMedia=window.realGetCamera;navigator.mediaDevices.enumerateDevices=window.nativeEnumerate; }')
  page.locator('[data-haiku-action=camera-flip]').click()
  expect(page.locator('[data-haiku-action=camera-shoot]')).to_be_enabled(timeout=15000)
  page.screenshot(path='/tmp/basho-direct-camera.png',full_page=True)
  page.locator('[data-haiku-action=camera-shoot]').click()
  expect(page.locator('[data-camera-video]')).to_have_count(0)
  expect(page.locator('basho-haiku .haiku-photo')).to_be_visible()
  expect(page.locator('[data-haiku-action=save]')).to_have_text('投稿する')
  assert page.evaluate('window.cameraTracks.every(t=>t.readyState==="ended")')
  first=page.locator('basho-haiku .haiku-photo').get_attribute('src')
  # Cancelling a retake returns to the existing photograph and stops the tracks.
  page.locator('[data-haiku-action=retake]').click()
  expect(page.locator('[data-haiku-action=camera-shoot]')).to_be_enabled(timeout=15000)
  page.locator('[data-haiku-action=camera-close]').click()
  expect(page.locator('[data-camera-video]')).to_have_count(0)
  expect(page.locator('basho-haiku .haiku-photo')).to_have_attribute('src',first)
  assert page.evaluate('window.cameraTracks.every(t=>t.readyState==="ended")')
  # Retake captures a new frame, but nothing is saved until the submit button.
  page.locator('[data-haiku-action=retake]').click()
  expect(page.locator('[data-haiku-action=camera-shoot]')).to_be_enabled(timeout=15000)
  page.locator('[data-haiku-action=camera-shoot]').click()
  expect(page.locator('[data-camera-video]')).to_have_count(0)
  expect(page.locator('[data-photo-caption]')).to_be_enabled()
  expect(page.locator('[data-haiku-action=save]')).to_be_enabled()
  page.locator('[data-photo-caption]').fill('いつもの道の光がきれい。')
  assert page.locator('basho-haiku').evaluate('(node)=>node.caption')=='いつもの道の光がきれい。'
  page.locator('[data-haiku-action=save]').click()
  expect(page.locator('.haiku-create [role=alert]')).to_contain_text('この端末には保存済み')
  expect(page.locator('.post-complete-dialog')).to_have_count(0)
  go(page,'home')
  expect(page.locator('[data-haiku-action=save]')).to_have_text('友達に投稿する')
  assert page.locator('basho-haiku').evaluate('(node)=>node.card.caption')=='いつもの道の光がきれい。'
  saved=page.locator('basho-haiku .haiku-photo').get_attribute('src')
  # A missing requested lens reports failure instead of silently using the other lens.
  page.evaluate("() => { navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('unavailable','OverconstrainedError')}; }")
  page.locator('[data-haiku-action=retake]').click()
  expect(page.locator('.reading-error')).to_contain_text('外カメを使えませんでした')
  expect(page.locator('basho-haiku .haiku-photo')).to_have_attribute('src',saved)
  expect(page.locator('[data-haiku-action=camera-user]')).to_be_visible()
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
  expect(page.locator('[data-haiku-action=camera-close]')).to_be_visible()
  page.locator('[data-haiku-action=camera-close]').first.click()
  count=page.evaluate('window.cameraTracks.length')
  page.evaluate('window.releaseCamera()')
  page.wait_for_function('count => window.cameraTracks.length === count + 1 && window.cameraTracks.every(t=>t.readyState==="ended")',arg=count)
  expect(page.locator('[data-camera-video]')).to_have_count(0)
  # Routing away must release active camera resources.
  page.evaluate('() => { navigator.mediaDevices.getUserMedia=window.realGetCamera; }')
  page.locator('[data-haiku-action=retake]').click()
  expect(page.locator('[data-haiku-action=camera-shoot]')).to_be_enabled(timeout=15000)
  page.locator('.capture-stage [data-nav=friends]').evaluate('button=>button.click()')
  expect(page.locator('.reading-mode-calendar')).to_be_visible()
  assert page.evaluate('window.cameraTracks.every(t=>t.readyState==="ended")')
  expect(page.locator('.local-calendar-photo')).to_have_count(1)
  expect(page.locator('.local-calendar-photo .postcard-caption')).to_have_text('いつもの道の光がきれい。')
  go(page,'friends')
  expect(page.locator('.friend-own-caption')).to_have_count(0)
  expect(page.get_by_role('button',name='Googleでログインする',exact=True)).to_be_visible()
  assert not errors,errors
  assert all(url.startswith('https://www.gstatic.com/firebasejs/') for url in external),external
  browser.close()
  print('PASS: in-frame viewfinder, rear preference, capture, retake/cancel, permission denial, stale grant and navigation track cleanup; no uploads')
finally:server.shutdown()
