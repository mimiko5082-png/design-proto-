"""Screens around みんなの記録 in the real app shell: 通知, 友達, the invitation and はじめての5枚. Firebase is a local module fixture."""
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
const query=new URL(location.href).searchParams,now=Date.now();
window.testUser=query.get('user')==='none'?null:{id:'me',name:'自分',confirmed:true};window.testJoined=query.get('group')!=='none';window.calls=[];
window.testMembers=[{name:'自分',joinedAt:Date.parse('2026-11-16T16:00:00Z'),own:true,postedAt:Date.parse('2026-11-18T03:31:00Z')},{name:'友達 <img src=x onerror=alert(1)>',joinedAt:null,own:false,postedAt:null}];
const invited=()=>location.hash.includes('invite=');
export const friendsProfile=()=>window.testUser;
export const friendsGroup=()=>window.testUser&&window.testJoined?'test-group':'';
export const friendsSession=async()=>({});
export const friendsConfigured=()=>true;
export const refreshFriendsGroup=async()=>{};
export const stageFriendsInvite=value=>{if(!String(value).includes('invite='))throw new FriendsError('友達から届いた招待リンクを、そのまま貼り付けてください。');window.calls.push('stage');};
export const pendingInvite=()=>invited()?'a'.repeat(64):'';
export const pendingInviteMeta=()=>invited()?{token:'a'.repeat(64),from:'みほ',count:3,expiresAt:now+6*86400000}:null;
export const discardFriendsInvite=()=>{window.calls.push('discard');history.replaceState(null,'',location.pathname+location.search);};
export const friendlyError=error=>error;
export const friendsSignIn=async()=>{window.testUser={id:'me',name:'自分',confirmed:true};window.dispatchEvent(new Event('basho-auth-changed'));return true;};
export const friendsSignOut=async()=>{window.testUser=null;window.dispatchEvent(new Event('basho-auth-changed'));};
export const createFriendsGroup=async()=>{window.calls.push('create');window.testJoined=true;};
export async function createFriendsInvite(){window.calls.push('invite');return new URL('#invite='+'a'.repeat(64),location.origin+'/').href;}
export const joinFriendsGroup=async()=>{window.calls.push('join');window.testJoined=true;history.replaceState(null,'',location.pathname+location.search);window.dispatchEvent(new Event('basho-sharing-updated'));return {synced:true};};
export const LAST_MEMBER='一人のときは抜けられません。';
export const leaveFriendsGroup=async()=>{window.calls.push('leave');window.testJoined=false;window.dispatchEvent(new Event('basho-sharing-updated'));return true;};
export async function firebaseSharingAPI(action){
 if(action==='members')return {members:window.testMembers};
 if(!window.testJoined||!window.testUser)throw new FriendsError('招待リンクで参加するか、友達のグループを作成してください。');
 return {day:'2026-11-18',month:'2026-11',posts:[],nextCursor:null};
}
'''
STUBS="window.shared=[];window.copied=[];navigator.share=async data=>{window.shared.push(data);};Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copied.push(text);},readText:async()=>location.origin+'/#invite='+'a'.repeat(64)}});"
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None,args=['--no-sandbox'])
  base=f'http://127.0.0.1:{server.server_port}';errors=[]
  def open_page(path,init=STUBS):
   context=browser.new_context(viewport={'width':390,'height':844},service_workers='block');context.add_init_script(init)
   page=context.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
   page.route('https://**/*',lambda route:route.abort())
   page.route('**/firebase-friends.js*',lambda route:route.fulfill(content_type='text/javascript',body=MOCK))
   page.goto(base+path,wait_until='networkidle');return page
  heading=lambda page:page.locator('.feed-heading h1')
  # --- A member: みんなの記録 leads to 通知, 友達 and the guide, each on its own screen. ---
  page=open_page('/')
  page.locator('.capture-stage [data-nav=friends]').click()
  expect(heading(page)).to_have_text('みんなの記録')
  expect(page.locator('details.place-attach, basho-fcm-settings')).to_have_count(0)
  page.get_by_role('button',name='通知の設定',exact=True).click()
  expect(page.locator('.flow-head h1')).to_have_text('通知')
  expect(page.locator('.notify-times')).to_contain_text('8:00');expect(page.locator('.notify-times')).to_contain_text('23:50')
  expect(page.locator('.screen-nav')).to_have_count(0)
  page.get_by_role('button',name='みんなの記録に戻る',exact=True).click()
  expect(heading(page)).to_have_text('みんなの記録')
  page.locator('.records-friends').click()
  expect(page.locator('.flow-head h1')).to_have_text('友達')
  people=page.get_by_role('list',name='いっしょに撮っている人')
  expect(people.locator('li')).to_have_count(2)
  expect(people).to_contain_text('自分・あなた');expect(people).to_contain_text('今日 12:31');expect(people).to_contain_text('今日はまだ')
  expect(people).to_contain_text('友達 <img src=x onerror=alert(1)>');expect(people.locator('img')).to_have_count(0)
  # Sending opens the share sheet with the link; copying puts the same link on the clipboard and shows it.
  page.get_by_role('button',name='招待リンクを送る',exact=True).click()
  page.wait_for_function('window.shared.length===1')
  link=base+'/#invite='+'a'*64
  assert page.evaluate('window.shared[0].url')==link and '自分さんから' in page.evaluate('window.shared[0].text')
  page.get_by_role('button',name='リンクをコピー',exact=True).click()
  expect(page.locator('.flow-status')).to_contain_text('コピーしました')
  assert page.evaluate('window.copied')==[link]
  expect(page.get_by_role('textbox',name='招待リンク',exact=True)).to_have_value(link)
  assert page.evaluate("window.calls.filter(call=>call==='invite').length")==1 # one link serves both
  # Leaving asks first; やめる keeps the membership. A person alone in the group is told why they stay.
  page.evaluate('window.kept=window.testMembers;window.testMembers=[window.kept[0]]');page.get_by_role('button',name='みんなの記録に戻る',exact=True).click();page.locator('.records-friends').click()
  expect(people.locator('li')).to_have_count(1)
  page.get_by_role('button',name='このグループを抜ける',exact=True).click()
  expect(page.get_by_role('alert')).to_contain_text('一人のときは抜けられません');expect(page.locator('dialog')).to_have_count(0)
  page.evaluate('window.testMembers=window.kept');page.get_by_role('button',name='みんなの記録に戻る',exact=True).click();page.locator('.records-friends').click()
  expect(people.locator('li')).to_have_count(2)
  page.get_by_role('button',name='このグループを抜ける',exact=True).click()
  sheet=page.get_by_role('dialog',name='グループを抜ける確認')
  expect(sheet).to_contain_text('あなたが送った写真は、グループに残ります')
  expect(page.get_by_role('button',name='やめる',exact=True)).to_be_focused()
  page.get_by_role('button',name='やめる',exact=True).click()
  expect(sheet).to_have_count(0);assert 'leave' not in page.evaluate('window.calls')
  page.get_by_role('button',name='このグループを抜ける',exact=True).click()
  page.get_by_role('button',name='抜ける',exact=True).click()
  expect(page.locator('.flow-status')).to_contain_text('グループを抜けました')
  # Out of a group: join by a pasted link, or make a group.
  expect(page.locator('.setup-step.is-done')).to_contain_text('ログイン済み')
  page.get_by_role('button',name='このリンクで参加',exact=True).click()
  expect(page.get_by_role('alert')).to_contain_text('そのまま貼り付けてください')
  page.get_by_role('button',name='貼り付け',exact=True).click()
  expect(page.get_by_role('textbox',name='友達から届いたリンク',exact=True)).to_have_value(link)
  page.get_by_role('button',name='このリンクで参加',exact=True).click()
  expect(page.locator('.flow-status')).to_contain_text('友達とつながりました')
  expect(page.get_by_role('button',name='招待リンクを送る',exact=True)).to_be_visible()
  # Logged out, the choices wait for the login.
  page.get_by_role('button',name='ログアウト',exact=True).click()
  expect(page.get_by_role('button',name='Googleでログイン',exact=True)).to_be_visible()
  expect(page.get_by_role('button',name='グループを作って招待する',exact=True)).to_be_disabled()
  page.get_by_role('button',name='みんなの記録に戻る',exact=True).click()
  expect(page.locator('.records-friends')).to_contain_text('友達とつながる')
  expect(page.locator('.public-feed .reading-error')).to_have_count(0)
  # The ？ button opens the guide as help: five steps, any exit returns to みんなの記録.
  page.get_by_role('button',name='使い方を見る',exact=True).click()
  guide=page.locator('.guide-page')
  expect(guide.locator('.guide-count')).to_have_text('1 / 5');expect(guide.locator('h1')).to_contain_text('芭蕉の句が')
  for step,text in [(2,'1日1枚'),(3,'今日が見える'),(4,'つながる'),(5,'お知らせ')]:
   guide.locator('[data-guide=next]').first.click()
   expect(guide.locator('.guide-count')).to_have_text(f'{step} / 5');expect(guide.locator('h1')).to_contain_text(text)
  page.get_by_role('button',name='2枚目へ',exact=True).click();expect(guide.locator('.guide-count')).to_have_text('2 / 5')
  for width in [320,390]:
   page.set_viewport_size({'width':width,'height':844})
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.get_by_role('button',name='とじる',exact=True).first.click()
  expect(heading(page)).to_have_text('みんなの記録')
  for target,title in [('.records-friends','友達'),('[data-nav=notify]','通知')]:
   page.locator(target).click();expect(page.locator('.flow-head h1')).to_have_text(title)
   for width in [320,390]:
    page.set_viewport_size({'width':width,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.get_by_role('button',name='みんなの記録に戻る',exact=True).click()
  page.context.close()
  # --- An opened invitation: its own screen first, the guide on request, joining, then the first-launch guide. ---
  page=open_page('/?user=none&group=none#invite='+'a'*64)
  invited=page.locator('.invited-page')
  expect(invited.locator('h1')).to_contain_text('みほさんから');expect(invited).to_contain_text('3人が参加しています');expect(invited).to_contain_text('まで有効です')
  page.get_by_role('button',name='先に使い方を見る',exact=True).click()
  expect(page.locator('.guide-count')).to_have_text('1 / 5')
  page.get_by_role('button',name='招待にもどる',exact=True).click()
  expect(invited.locator('h1')).to_contain_text('みほさんから')
  page.get_by_role('button',name='Googleでログインして参加',exact=True).click()
  expect(heading(page)).to_have_text('みんなの記録') # the guide was already seen from the invitation
  assert page.evaluate('window.calls')==['join']
  page.context.close()
  page=open_page('/?group=none#invite='+'a'*64)
  page.get_by_role('button',name='このグループに参加する',exact=True).click()
  expect(page.locator('.guide-count')).to_have_text('1 / 5') # joining before the guide continues into it
  page.get_by_role('button',name='スキップ',exact=True).click()
  expect(page.locator('.capture-stage')).to_be_visible()
  page.context.close()
  page=open_page('/?group=none#invite='+'a'*64)
  page.get_by_role('button',name='この招待を使わない',exact=True).click()
  assert page.evaluate('window.calls')==['discard'] and page.evaluate('location.hash')==''
  page.context.close()
  # --- First launch in an ordinary browser: the guide opens once and ends on the camera. ---
  page=open_page('/?group=none',STUBS+"Object.defineProperty(Navigator.prototype,'webdriver',{get:()=>false});")
  expect(page.locator('.guide-count')).to_have_text('1 / 5')
  for _ in range(3):page.locator('[data-guide=next]').first.click()
  expect(page.get_by_role('button',name='友達とつながる',exact=True)).to_be_visible()
  page.get_by_role('button',name='あとで',exact=True).click()
  page.get_by_role('button',name='あとで設定して、はじめる',exact=True).click()
  expect(page.locator('.capture-stage')).to_be_visible()
  page.reload(wait_until='networkidle')
  expect(page.locator('.capture-stage')).to_be_visible();expect(page.locator('.guide-page')).to_have_count(0)
  page.context.close()
  assert not errors,errors
  browser.close()
  print('Flow screens: 通知 and 友達 as their own screens, invite send/copy, leave with confirmation, paste-to-join, logged-out state, guide as help, invitation landing, join into the guide, discard, and the one-time first-launch guide passed.')
finally:server.shutdown()
