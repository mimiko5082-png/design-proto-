"""Member list UI, isolated from Firebase using a local module fixture."""
import os,subprocess,threading
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
MOCK='''
export class FriendsError extends Error {}
window.testUser={id:'me',name:'自分',confirmed:true};
window.testMembers=[{name:'自分',joinedAt:Date.parse('2026-11-16T16:00:00Z'),own:true},{name:'未投稿の友達 <img src=x onerror=alert(1)>',joinedAt:null,own:false}];
export const friendsProfile=()=>window.testUser;
export const friendsGroup=()=>window.testUser?'test-group':'';
export const friendsSession=async()=>({});
export const pendingInvite=()=>'';
export const friendlyError=e=>e;
export const friendsSignIn=async()=>true;
export const friendsSignOut=async()=>{window.testUser=null;window.dispatchEvent(new Event('basho-auth-changed'));};
export const createFriendsGroup=async()=>{};
export const createFriendsInvite=async()=>'';
export const joinFriendsGroup=async()=>{};
export async function firebaseSharingAPI(action){
 if(action==='members'){
  if(window.testWait)await new Promise(resolve=>window.resolveMembers=resolve);
  if(window.testError)throw new Error('参加者を取得できませんでした');
  return {members:window.testMembers};
 }
 return {day:'2026-11-17',posts:[],nextCursor:null};
}
'''
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('BASHO_TEST_CHROMIUM') or None,args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':390,'height':844});errors=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  base=f'http://127.0.0.1:{server.server_port}'
  page.route('**/firebase-friends.js*',lambda route:route.fulfill(content_type='text/javascript',body=MOCK))
  page.route('**/members-test',lambda route:route.fulfill(content_type='text/html',body='<link rel="stylesheet" href="/basho-styles.css"><script type="module" src="/public-feed.js"></script><basho-public-feed></basho-public-feed>'))
  page.goto(base+'/members-test',wait_until='networkidle')
  button=page.get_by_role('button',name='参加中の友達を見る',exact=True)
  button.click()
  panel=page.get_by_role('region',name='参加中の友達',exact=True)
  expect(panel).to_contain_text('参加中の友達（2人）')
  expect(panel).to_contain_text('未投稿の友達 <img src=x onerror=alert(1)>')
  expect(panel.locator('img')).to_have_count(0)
  expect(panel).to_contain_text('自分 · あなた')
  expect(panel).to_contain_text('2026年11月17日 参加')
  expect(panel).to_contain_text('参加日不明')
  page.evaluate('window.testError=true')
  panel.get_by_role('button',name='参加者を更新').click()
  expect(panel.get_by_role('alert')).to_contain_text('参加者を取得できませんでした')
  expect(panel.locator('li')).to_have_count(0)
  page.evaluate('window.testError=false;window.testMembers.push({name:"新しい友達",joinedAt:123,own:false})')
  panel.get_by_role('button',name='もう一度読み込む').click()
  expect(panel).to_contain_text('参加中の友達（3人）')
  for width in [320,390]:
   page.set_viewport_size({'width':width,'height':844})
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  # Closing and signing out discard any delayed response.
  page.get_by_role('button',name='参加中の友達を閉じる').click()
  page.evaluate('window.testWait=true')
  page.get_by_role('button',name='参加中の友達を見る',exact=True).click()
  expect(panel).to_contain_text('参加者を読み込んでいます')
  page.get_by_role('button',name='ログアウト',exact=True).click()
  page.evaluate('window.resolveMembers()')
  expect(panel).to_have_count(0)
  expect(page.get_by_role('button',name='参加中の友達を見る',exact=True)).to_have_count(0)
  assert not errors,errors
  browser.close()
  print('Member UI: unposted friend, Japanese date, escaped names, retry, mobile layout and delayed response after signout passed.')
finally:server.shutdown()
