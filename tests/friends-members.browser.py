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
window.testUser={id:'me',name:'自分',confirmed:true};window.testJoined=!location.hash.includes('invite=');window.joinCount=0;window.testPosts=[];
window.testMembers=[{name:'自分',joinedAt:Date.parse('2026-11-16T16:00:00Z'),own:true},{name:'未投稿の友達 <img src=x onerror=alert(1)>',joinedAt:null,own:false}];
export const friendsProfile=()=>window.testUser;
export const friendsGroup=()=>window.testUser&&window.testJoined?'test-group':'';
export const friendsSession=async()=>({});
export const stageFriendsInvite=value=>{const url=new URL(location.href);url.hash='invite=test-invite';history.replaceState(null,'',url.href);};
export const pendingInvite=()=>location.hash.includes('invite=')?'test-invite':'';
export const friendlyError=e=>e;
export const friendsSignIn=async()=>true;
export const friendsSignOut=async()=>{window.testUser=null;window.dispatchEvent(new Event('basho-auth-changed'));};
export const createFriendsGroup=async()=>{};
export async function createFriendsInvite(...args){window.inviteArgs=args;return new URL('#invite=test-invite',location.href).href;}
export const joinFriendsGroup=async()=>{window.testJoined=true;window.joinCount++;history.replaceState(null,'',location.pathname);window.dispatchEvent(new Event('basho-sharing-updated'));};
export async function firebaseSharingAPI(action){
 if(action==='members'){
  if(window.testWait)await new Promise(resolve=>window.resolveMembers=resolve);
  if(window.testError)throw new Error('参加者を取得できませんでした');
  return {members:window.testMembers};
 }
 if(!window.testJoined)throw new Error('招待リンクから参加してください');
 return {day:'2026-11-17',posts:window.testPosts,nextCursor:null};
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
  # A single friends invitation connects both the feed and calendar.
  page.goto(base+'/members-test#invite=test-invite',wait_until='networkidle')
  page.reload(wait_until='networkidle')
  expect(page.get_by_role('button',name='この招待で参加する',exact=True)).to_be_visible()
  page.get_by_role('button',name='この招待で参加する',exact=True).click()
  expect(page.locator('.friend-status')).to_contain_text('友達の投稿とカレンダーの両方')
  page.evaluate("window.testPosts=[{id:'friend-photo',name:'招待した友達',day:'2026-11-17',image:'./assets/kotoba-forest.png',caption:'友達から届いた写真',createdAt:1794873600000,stampCount:0,commentCount:0}]")
  page.get_by_role('button',name='更新',exact=True).click()
  expect(page.locator('.postcard-caption')).to_have_text('友達から届いた写真')
  page.evaluate("const calendar=document.createElement('basho-public-feed');calendar.setAttribute('calendar','');calendar.setAttribute('day','2026-11-17');document.querySelector('basho-public-feed').replaceWith(calendar)")
  expect(page.locator('.postcard-caption')).to_have_text('友達から届いた写真')
  expect(page.get_by_role('button',name='この招待で参加する',exact=True)).to_have_count(0)
  expect(page.get_by_role('button',name='カレンダーの招待リンクを作る',exact=True)).to_have_count(0)
  page.get_by_role('button',name='友達の招待リンクを作る',exact=True).click()
  expect(page.get_by_role('textbox',name='招待リンク',exact=True)).to_have_value(base+'/members-test#invite=test-invite')
  assert page.evaluate('window.inviteArgs.length')==0
  assert page.evaluate('window.joinCount')==1
  assert not errors,errors
  browser.close()
  print('Member UI: unposted friend, Japanese date, escaped names, retry, mobile layout and delayed response after signout passed.')
finally:server.shutdown()
