"""Photos in calendar day cells, month switching, replacements and retired garden route."""
import base64
import os
import subprocess
import threading
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
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
  page.clock.install(time=datetime(2026,10,29,3,0,tzinfo=timezone.utc))
  page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='networkidle')
  images=['data:image/png;base64,'+base64.b64encode((ROOT/'assets'/file).read_bytes()).decode() for file in ['kotoba-forest.png','kotoba-lake.png','kotoba-sunset.png']]
  awaitable="""async ({images})=>{
    const {makeCard,saveCard}=await import('./haiku-store.js');
    const {dailyTopic}=await import('./haiku-catalog.js');
    for(let i=0;i<7;i++){
     const now=new Date(Date.UTC(2026,9,1+i*4,3)),day=now.toISOString().slice(0,10),topic=dailyTopic(day);
     await saveCard(makeCard({id:'photo-challenge-'+day,topicId:topic.id,topicDay:day,creation:'photo-challenge',image:images[i%images.length]},topic.lines,now));
    }
    localStorage.setItem('basho_manazashi_v3',JSON.stringify({view:'garden'}));
  }"""
  page.evaluate(awaitable,{'images':images})
  # Saved old garden navigation must migrate into the photo calendar.
  page.reload(wait_until='networkidle')
  expect(page.locator('.reading-mode-calendar')).to_be_visible()
  expect(page.locator('.tabbar [data-nav=garden]')).to_have_count(0)
  expect(page.locator('.reading-growth')).to_have_count(0)
  expect(page.locator('.reading-days .calendar-day-photo')).to_have_count(7)
  day=page.locator('[data-day="2026-10-05"]')
  expect(day.locator('.calendar-day-photo')).to_have_attribute('src',images[1])
  day.click()
  expect(page.locator('.saved-haiku .haiku-photo')).to_have_attribute('src',images[1])
  expect(page.locator('[data-day="2026-10-06"] .calendar-day-photo')).to_have_count(0)
  page.locator('[aria-label="前の月"]').click()
  expect(page.locator('.reading-days .calendar-day-photo')).to_have_count(0)
  page.locator('[aria-label="次の月"]').click()
  expect(page.locator('.reading-days .calendar-day-photo')).to_have_count(7)
  for width in [320,390]:
   page.set_viewport_size({'width':width,'height':844})
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.screenshot(path='/tmp/basho-calendar-photos.png',full_page=True)
  assert not errors,errors
  browser.close()
  print('PASS: seven photo day cells, selected detail, empty days, month switching, old garden redirect, mobile')
finally:server.shutdown()
