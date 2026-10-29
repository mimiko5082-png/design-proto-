"""Garden/photos, 6->7 completion, notes, paging, JPEG export and rest without decay."""
import base64
import os
import subprocess
import threading
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from PIL import Image
ROOT=Path(__file__).resolve().parent.parent
subprocess.run(['node','preview/build.mjs'],cwd=ROOT,check=True)
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT/'preview/dist')))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
  context=browser.new_context(viewport={'width':390,'height':844})
  page=context.new_page();errors=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.clock.install(time=datetime(2026,10,29,3,0,tzinfo=timezone.utc))
  page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='networkidle')
  page.locator('.tabbar [data-nav=garden]').click()
  expect(page.locator('.album-progress')).to_contain_text('あと7枚')
  expect(page.locator('.garden-photo-decorations img')).to_have_count(0)
  images=['data:image/png;base64,'+base64.b64encode((ROOT/'assets'/file).read_bytes()).decode() for file in ['kotoba-forest.png','kotoba-lake.png','kotoba-sunset.png']]
  def add(start,end):
   page.evaluate("""async ({images,start,end})=>{
    const {makeCard,saveCard}=await import('./haiku-store.js');
    const {dailyTopic}=await import('./haiku-catalog.js');
    for(let i=start;i<end;i++){
     const now=new Date(Date.UTC(2026,9,1+i*2,3)),day=now.toISOString().slice(0,10),topic=dailyTopic(day);
     const draft={id:'photo-challenge-'+day,topicId:topic.id,topicDay:day,creation:'photo-challenge',image:images[i%images.length],reflection:'<気づき> & いつもの道の発見 '+(i+1)};
     await saveCard(makeCard(draft,topic.lines,now));
    }
    window.dispatchEvent(new Event('basho-reading-updated'));
   }""",{'images':images,'start':start,'end':end})
  add(0,6)
  expect(page.locator('.garden-photo-decorations img')).to_have_count(5)
  expect(page.locator('.album-progress')).to_contain_text('あと1枚')
  expect(page.locator('.album-cover')).to_have_count(0)
  add(6,7)
  expect(page.locator('.album-cover')).to_have_count(1)
  expect(page.locator('.reading-xp')).to_have_text('7 ことば')
  expect(page.locator('.garden-rest-note')).to_contain_text('休んでも、この庭は枯れません')
  page.locator('.album-cover').click()
  expect(page.locator('.album-reader')).to_be_visible()
  expect(page.locator('.album-page-note')).to_contain_text('<気づき> & いつもの道の発見 1')
  expect(page.locator('.album-page-note img')).to_have_count(0)
  expect(page.locator('[data-reading-action=album-page][data-delta="-1"]')).to_be_disabled()
  page.locator('[data-reading-action=album-page][data-delta="1"]').click()
  expect(page.locator('.album-paging')).to_contain_text('2 / 7')
  expect(page.locator('.album-page-note')).to_contain_text('いつもの道の発見 2')
  with page.expect_download() as download:
   page.locator('[data-reading-action=album-export]').click()
  exported=download.value
  assert exported.suggested_filename=='basho-photo-album-1-2026-10-01.jpg'
  with Image.open(exported.path()) as image:
   assert image.format=='JPEG' and image.width==1400 and image.height>2000
  for _ in range(5):page.locator('[data-reading-action=album-page][data-delta="1"]').click()
  expect(page.locator('.album-paging')).to_contain_text('7 / 7')
  expect(page.locator('[data-reading-action=album-page][data-delta="1"]')).to_be_disabled()
  page.screenshot(path='/tmp/basho-photo-album-reader.png',full_page=True)
  page.locator('[data-reading-action=album-close]').click()
  expect(page.locator('.album-reader')).to_have_count(0)
  # No streak/decay: a month without new photos keeps the garden and album intact.
  page.clock.set_system_time(datetime(2026,11,29,3,0,tzinfo=timezone.utc))
  page.reload(wait_until='networkidle')
  expect(page.locator('.reading-xp')).to_have_text('7 ことば')
  expect(page.locator('.album-cover')).to_have_count(1)
  expect(page.locator('.garden-photo-decorations img')).to_have_count(5)
  for width in [320,390]:
   page.set_viewport_size({'width':width,'height':844})
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.screenshot(path='/tmp/basho-photo-garden.png',full_page=True)
  assert not errors,errors
  browser.close()
  print('PASS: photo garden, 6->7 book completion, seven pages, literal notes, JPEG export, persistence and no decay')
finally:server.shutdown()
