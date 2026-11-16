"""Historical calendar sharing and reactions, using isolated local sample data."""
import subprocess,threading
from datetime import datetime,timezone
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
  browser=p.chromium.launch(args=['--no-sandbox'])
  context=browser.new_context(viewport={'width':390,'height':844},service_workers='block')
  page=context.new_page();errors=[];external=[]
  base=f'http://127.0.0.1:{server.server_port}'
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.on('request',lambda req:external.append(req.url) if req.url.startswith(('http://','https://')) and not req.url.startswith(base+'/') else None)
  page.on('dialog',lambda dialog:dialog.accept())
  page.clock.install(time=datetime(2026,11,16,3,0,tzinfo=timezone.utc))
  page.goto(base+'/index.html?sharing=demo',wait_until='networkidle')
  expect(page.locator('.feed-post')).to_have_count(2)
  page.evaluate('''async()=>{
    const {saveCard}=await import('./haiku-store.js');const {dailyTopic}=await import('./haiku-catalog.js');const topic=dailyTopic('2026-11-14');
    await saveCard({id:'past-local-photo',day:'2026-11-14',topicDay:'2026-11-14',topicId:topic.id,lines:topic.lines,modern:topic.modern,original:topic.original,creation:'photo-challenge',createdAt:Date.parse('2026-11-14T03:00:00Z'),caption:'以前撮った自分の写真',reflection:'PRIVATE_REFLECTION_NOT_FOR_FRIENDS',image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='});
  }''')
  page.locator('.tabbar [data-nav=calendar]').click()
  page.locator('[data-reading-action=day][data-day="2026-11-14"]').click()
  expect(page.locator('.reading-date-records')).to_contain_text('以前撮った自分の写真')
  page.locator('[data-reading-action=share-card]').click()
  expect(page.locator('.sharing-profile-dialog')).to_be_visible()
  page.locator('.sharing-profile-dialog input').fill('自分サンプル')
  page.locator('.sharing-profile-dialog [type=submit]').click()
  expect(page.locator('.friend-status')).to_contain_text('この日の写真を友達に共有しました')
  page.locator('[data-reading-action=calendar-audience][data-audience=friends]').click()
  expect(page.locator('.shared-selected-date')).to_contain_text('2026 / 11 / 14')
  expect(page.locator('.feed-post')).to_have_count(1)
  expect(page.locator('.feed-post')).to_contain_text('以前撮った自分の写真')
  assert not page.evaluate("localStorage.getItem('public_sharing_ui_demo_v1').includes('PRIVATE_REFLECTION_NOT_FOR_FRIENDS')")
  page.locator('.friend-photo-tile').click()
  page.locator('[data-public-comment]').fill('過去の写真にもコメント')
  page.locator('[data-public-form] .main-button').click()
  expect(page.locator('.friend-comments')).to_contain_text('過去の写真にもコメント')
  page.locator('[data-public-action=stamp][data-stamp=heart]').click()
  expect(page.locator('[data-public-action=stamp][data-stamp=heart]')).to_have_attribute('aria-pressed','true')
  page.locator('[data-public-action=calendar-day][data-day="2026-11-15"]').click()
  expect(page.locator('.feed-post')).to_contain_text('はる（サンプル）')
  expect(page.locator('.feed-post')).to_contain_text('前に見つけた景色も')
  page.locator('[data-public-action=calendar-month][data-delta="-1"]').click()
  expect(page.locator('.reading-month h2')).to_contain_text('2026年 10月')
  page.locator('[data-public-action=calendar-day][data-day="2026-10-15"]').click()
  expect(page.locator('.feed-post')).to_contain_text('はる（サンプル）')
  page.locator('[data-public-action=calendar-today]').click()
  expect(page.locator('.feed-post')).to_have_count(2)
  page.locator('[data-reading-action=calendar-audience][data-audience=local]').click()
  page.locator('[data-reading-action=day][data-day="2026-11-14"]').click()
  expect(page.locator('.reading-date-records')).to_contain_text('以前撮った自分の写真')
  assert not errors,errors
  assert not external,external
  browser.close()
  print('Shared calendar: local history, explicit sharing, friend history, month changes, comments/stamps, and private-note isolation passed.')
finally:server.shutdown()
