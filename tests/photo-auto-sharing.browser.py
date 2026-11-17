"""The capture button posts to friends, with local recovery after failure/cancellation."""
import json,os,threading
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent.parent
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
posts={};attempts=[]
MOCK='''
export class FriendsError extends Error {}
export const friendlyError=e=>e;
export const friendsProfile=()=>({id:'me',name:'自分',confirmed:true});
export const friendsGroup=()=> 'test-group';
export const friendsSession=async()=>({});
export const stageFriendsInvite=()=>{};
export const pendingInvite=()=>'';
export const friendsSignIn=async()=>!window.cancelSignIn;
export const friendsSignOut=async()=>{};
export const createFriendsGroup=async()=>{};
export const createFriendsInvite=async()=>'';
export const joinFriendsGroup=async()=>{};
export async function firebaseSharingAPI(action,data={}){
 if(action==='publish'){
  if(window.failPublish)throw new FriendsError('通信に失敗しました');
  if(window.holdPublish)await new Promise(resolve=>window.releasePublish=resolve);
  return await (await fetch('/test-posts',{method:'POST',body:JSON.stringify(data)})).json();
 }
 return await (await fetch('/test-posts')).json();
}
'''
def api(route):
 if route.request.method=='POST':
  data=json.loads(route.request.post_data);attempts.append(data)
  posts[data['day']]={**data,'id':data['day']+'_me','name':'撮影した友達','createdAt':1780000000000,'own':False,'stampCount':0,'commentCount':0}
  route.fulfill(content_type='application/json',body=json.dumps({'id':data['day']+'_me'}))
 else:route.fulfill(content_type='application/json',body=json.dumps({'day':next(iter(posts), '2026-11-17'),'posts':list(posts.values()),'nextCursor':None}))
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None,args=['--no-sandbox'])
  context=browser.new_context(viewport={'width':390,'height':844});errors=[]
  context.route('**/firebase-friends.js*',lambda route:route.fulfill(content_type='text/javascript',body=MOCK))
  context.route('**/test-posts',api)
  context.route('**/capture-test',lambda route:route.fulfill(content_type='text/html',body='<link rel="stylesheet" href="/basho-styles.css"><script type="module" src="/haiku-cards.js"></script><basho-haiku></basho-haiku>'))
  context.route('**/viewer-test',lambda route:route.fulfill(content_type='text/html',body='<script type="module" src="/public-feed.js"></script><basho-public-feed></basho-public-feed>'))
  base=f'http://127.0.0.1:{server.server_port}'
  page=context.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
  page.goto(base+'/capture-test',wait_until='networkidle')
  page.evaluate('window.holdPublish=true')
  page.locator('[data-haiku-photo]').set_input_files(str(ROOT/'assets/kotoba-forest.png'))
  expect(page.locator('[data-haiku-action=save]')).to_be_disabled()
  expect(page.locator('[data-haiku-action=save]')).to_have_text('投稿しています…')
  page.wait_for_function('typeof window.releasePublish==="function"')
  page.evaluate('document.querySelector("[data-haiku-action=save]").click();window.releasePublish()')
  expect(page.locator('.haiku-status')).to_contain_text('参加している友達に写真を共有しました')
  expect(page.locator('.post-complete-dialog')).to_have_count(0)
  assert len(attempts)==1
  assert attempts[0]['image'].startswith('data:image/')
  assert 'reflection' not in attempts[0]
  page.evaluate('window.holdPublish=false')
  page.locator('[data-photo-caption]').fill('友達に届く写真')
  page.locator('[data-haiku-action=save]').click()
  expect(page.locator('[data-haiku-action=save]')).to_have_text('友達に投稿済み')
  expect(page.locator('[data-haiku-action=save]')).to_be_disabled()
  viewer_context=browser.new_context()
  viewer_context.route('**/firebase-friends.js*',lambda route:route.fulfill(content_type='text/javascript',body=MOCK))
  viewer_context.route('**/test-posts',api)
  viewer_context.route('**/viewer-test',lambda route:route.fulfill(content_type='text/html',body='<script type="module" src="/public-feed.js"></script><basho-public-feed></basho-public-feed>'))
  viewer=viewer_context.new_page();viewer.on('pageerror',lambda error:errors.append(str(error)))
  viewer.goto(base+'/viewer-test',wait_until='networkidle')
  expect(viewer.locator('.postcard-caption')).to_have_text('友達に届く写真')
  expect(viewer.locator('[data-public-action=publish-local]')).to_have_count(0)
  viewer.evaluate("const calendar=document.createElement('basho-public-feed');calendar.setAttribute('calendar','');calendar.setAttribute('day','"+next(iter(posts))+"');document.querySelector('basho-public-feed').replaceWith(calendar)")
  expect(viewer.locator('.postcard-caption')).to_have_text('友達に届く写真')
  # Replacing the photo retains the previous shared version if uploading fails.
  page.evaluate('window.failPublish=true;window.holdPublish=false')
  page.locator('[data-haiku-photo]').set_input_files(str(ROOT/'assets/kotoba-lake.png'))
  expect(page.locator('[data-haiku-action=save]')).to_have_text('公開を再試行する')
  page.locator('[data-photo-caption]').fill('撮り直した写真')
  page.locator('[data-haiku-action=save]').click()
  expect(page.get_by_role('alert')).to_contain_text('この端末には保存済み')
  expect(page.locator('.post-complete-dialog')).to_have_count(0)
  expect(page.locator('[data-haiku-action=save]')).to_have_text('公開を再試行する')
  page.reload(wait_until='networkidle')
  expect(page.locator('[data-photo-caption]')).to_have_value('撮り直した写真')
  expect(page.locator('[data-haiku-action=save]')).to_have_text('友達に投稿する')
  expect(page.locator('[data-haiku-action=save]')).to_be_enabled()
  # Cancelling login leaves an explicit, retryable local-only result.
  page.evaluate('window.cancelSignIn=true')
  page.locator('[data-haiku-action=save]').click()
  expect(page.get_by_role('alert')).to_contain_text('友達への投稿はまだです')
  expect(page.locator('[data-haiku-action=save]')).to_be_enabled()
  page.evaluate('window.cancelSignIn=false')
  page.locator('[data-haiku-action=save]').click()
  expect(page.locator('[data-haiku-action=save]')).to_have_text('友達に投稿済み')
  assert len(attempts)==3 and len(posts)==1
  viewer.get_by_role('button',name='更新',exact=True).click()
  expect(viewer.locator('.postcard-caption')).to_have_text('撮り直した写真')
  assert not errors,errors
  browser.close()
  print('Automatic photo post: selecting a photo reaches friends and calendar without a post/share click, busy guard, local retention, reload retry, cancelled login and idempotent replacement passed.')
finally:server.shutdown()
