"""Historical calendar sharing and reactions, using isolated local sample data."""
import os,subprocess,threading
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
subprocess.run(['node','preview/build.mjs'],cwd=ROOT,check=True)
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT/'preview/dist')))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('BASHO_TEST_CHROMIUM') or None,args=['--no-sandbox'])
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
    await saveCard({id:'same-day-local-photo',day:'2026-11-15',topicDay:'2026-11-15',topicId:topic.id,lines:topic.lines,modern:topic.modern,creation:'photo-challenge',createdAt:Date.parse('2026-11-15T03:00:00Z'),caption:'友達と同じ日の自分の写真',image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='});
  }''')
  go(page,'calendar')
  expect(page.locator('.calendar-audience')).to_have_count(0)
  page.locator('[data-public-action=calendar-day][data-day="2026-11-14"]').click()
  expect(page.locator('.friend-photo-grid')).to_contain_text('以前撮った自分の写真')
  page.locator('.local-calendar-photo [data-public-action=publish-local]').click()
  expect(page.locator('.sharing-profile-dialog')).to_be_visible()
  page.locator('.sharing-profile-dialog input').fill('自分サンプル')
  page.locator('.sharing-profile-dialog [type=submit]').click()
  expect(page.locator('.friend-status')).to_contain_text('参加している友達に写真を共有しました')
  expect(page.locator('.shared-selected-date')).to_contain_text('2026 / 11 / 14')
  expect(page.locator('.feed-post')).to_have_count(1)
  expect(page.locator('.feed-post')).to_contain_text('以前撮った自分の写真')
  assert not page.evaluate("localStorage.getItem('public_sharing_ui_demo_v1').includes('PRIVATE_REFLECTION_NOT_FOR_FRIENDS')")
  page.locator('.friend-photo-tile').click()
  page.locator('[data-public-comment]').fill('過去の写真にもコメント')
  page.locator('[data-public-form] .main-button').click()
  expect(page.locator('.friend-comments')).to_contain_text('過去の写真にもコメント')
  expect(page.locator('.friend-comments strong')).to_contain_text('自分サンプル · あなた')
  page.locator('[data-public-action=stamp][data-stamp=heart]').click()
  expect(page.locator('[data-public-action=stamp][data-stamp=heart]')).to_have_attribute('aria-pressed','true')
  expect(page.get_by_role('region',name='リアクションしてくれた友達')).to_contain_text('自分サンプル · あなた')
  page.locator('[data-public-action=calendar-day][data-day="2026-11-15"]').click()
  expect(page.locator('.feed-post')).to_have_count(2)
  expect(page.locator('.friend-photo-grid')).to_contain_text('はる（サンプル）')
  expect(page.locator('.friend-photo-grid')).to_contain_text('前に見つけた景色も')
  expect(page.locator('.friend-photo-grid')).to_contain_text('友達と同じ日の自分の写真')
  expect(page.locator('[data-day="2026-11-15"]')).to_have_attribute('aria-label','2026-11-15、写真2枚')
  page.locator('[data-public-action=calendar-month][data-delta="-1"]').click()
  expect(page.locator('.reading-month h2')).to_contain_text('2026年 10月')
  page.locator('[data-public-action=calendar-day][data-day="2026-10-15"]').click()
  expect(page.locator('.feed-post')).to_contain_text('はる（サンプル）')
  page.locator('[data-public-action=calendar-today]').click()
  expect(page.locator('.feed-post')).to_have_count(2)
  page.locator('[data-public-action=calendar-day][data-day="2026-11-14"]').click()
  expect(page.locator('.friend-photo-grid')).to_contain_text('以前撮った自分の写真')
  page.locator('[data-public-action=calendar-day][data-day="2026-11-13"]').click()
  expect(page.locator('.feed-post')).to_have_count(0)
  expect(page.locator('.public-empty')).to_contain_text('この日の投稿はまだありません')
  for width in [320,390]:
   page.set_viewport_size({'width':width,'height':844})
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert not errors,errors
  assert not external,external
  # Device photos remain available when Firebase SDK/authentication cannot load.
  page.route('https://**/*',lambda route:route.abort())
  page.goto(base+'/index.html',wait_until='networkidle')
  go(page,'calendar')
  page.locator('[data-public-action=calendar-day][data-day="2026-11-15"]').click()
  expect(page.locator('.local-calendar-photo')).to_contain_text('友達と同じ日の自分の写真')
  expect(page.get_by_role('button',name='Googleでログインする',exact=True)).to_be_visible()
  browser.close()
  print('Unified calendar: mixed own/friend day, no duplicate after sharing, empty day, month changes, comments/stamps, private-note isolation, mobile and local photos without Firebase passed.')
finally:server.shutdown()
