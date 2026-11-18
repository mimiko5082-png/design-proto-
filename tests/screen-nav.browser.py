"""One photograph a day: shoot, send, land on みんなの記録, and find the camera screen fixed as today's record."""
import os
import subprocess
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent.parent
subprocess.run(['node','preview/build.mjs'],cwd=ROOT,check=True)
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT/'preview/dist')))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None,args=['--no-sandbox'])
  context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
  page=context.new_page();errors=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.route('https://**/*',lambda route:route.abort())
  page.goto(f'http://127.0.0.1:{server.server_port}/?sharing=demo',wait_until='networkidle')
  heading=page.locator('.feed-heading h1')
  # The demo opens on the single records screen; its only navigation is the camera button.
  expect(heading).to_have_text('みんなの記録')
  expect(page.locator('.screen-nav [data-nav]')).to_have_count(1)
  expect(page.locator('.shared-calendar')).to_be_visible()
  page.locator('.screen-nav [data-nav=home]').click()
  # Before today's photograph: the calendar button sits bottom-left, there is no prompt bubble, and the screen does not scroll.
  records=page.locator('.capture-records')
  expect(records).to_be_visible();expect(page.locator('.capture-bubble')).to_have_count(0)
  box=records.bounding_box();assert box['x']<80 and box['y']>700,box
  assert page.locator('.view').evaluate('view=>view.scrollHeight-view.clientHeight')==0
  expect(page.locator('.neo-capture .public-audience')).to_have_count(0)
  records.click();expect(heading).to_have_text('みんなの記録')
  page.locator('.screen-nav [data-nav=home]').click()
  # Choosing a photograph does not send it: the caption, retake and send controls wait for the person.
  expect(page.locator('[data-haiku-action=camera]')).to_be_enabled()
  page.locator('[data-haiku-photo]').set_input_files(str(ROOT/'assets/kotoba-forest.png'))
  expect(page.locator('basho-haiku .haiku-photo')).to_be_visible()
  expect(page.locator('[data-haiku-action=save]')).to_be_enabled();expect(page.locator('[data-haiku-action=retake]')).to_be_visible()
  expect(page.locator('.capture-stage')).to_be_visible();expect(records).to_be_visible()
  page.locator('[data-photo-caption]').fill('今日の一枚')
  # Sending moves to みんなの記録, where the day's photographs include one's own.
  page.locator('[data-haiku-action=save]').click()
  page.locator('.sharing-profile-dialog input').fill('テスト')
  page.locator('.sharing-profile-dialog button').first.click()
  expect(heading).to_have_text('みんなの記録')
  expect(page.locator('.post-complete-dialog')).to_be_visible()
  page.locator('.post-later').click()
  expect(heading).to_have_text('みんなの記録')
  expect(page.locator('.friend-own-photo .postcard-caption')).to_have_text('今日の一枚')
  # Back on the camera screen the day's record is fixed: no shutter, retake or send; the centre button is the calendar with its prompt.
  page.locator('.screen-nav [data-nav=home]').click()
  expect(page.locator('.capture-bubble')).to_contain_text('今日は記録済');expect(page.locator('.capture-bubble')).to_contain_text('他の人の記録を見てみよう')
  expect(page.locator('.photo-caption-fixed')).to_have_text('今日の一枚')
  expect(page.locator('[data-haiku-action=retake]')).to_be_hidden();expect(page.locator('[data-haiku-action=save]')).to_be_hidden()
  expect(page.locator('[data-haiku-action=camera-shoot],[data-haiku-action=camera],[data-photo-caption],video')).to_have_count(0)
  expect(records).to_have_count(0)
  # The fixed record survives a reload, and the centre calendar opens みんなの記録.
  page.reload(wait_until='networkidle')
  if page.locator('.screen-nav').count():page.locator('.screen-nav [data-nav=home]').click()
  expect(page.locator('.capture-bubble')).to_be_visible()
  page.locator('.capture-records-main').click();expect(heading).to_have_text('みんなの記録')
  # A horizontal swipe no longer changes the screen.
  cdp=context.new_cdp_session(page)
  cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':300,'y':400}]})
  for step in range(1,6):cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':300-44*step,'y':402}]})
  cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});page.wait_for_timeout(300)
  expect(heading).to_have_text('みんなの記録')
  assert not errors,errors
  browser.close()
  print('PASS: calendar button before the shot, explicit send, move to みんなの記録, fixed record with prompt, reload, no swipe paging')
finally:server.shutdown()
