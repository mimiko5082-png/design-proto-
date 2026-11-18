"""Real friends client across isolated Safari/PWA contexts with a local fake Firebase SDK."""
import os,json,threading,time
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent.parent
TOKEN='a'*64;GROUP='f'*32
now=int(time.time()*1000)
data={f'invites/{TOKEN}':{'groupId':GROUP,'owner':'owner','expiresAt':now+86400000},f'groups/{GROUP}/members/owner':{'name':'友達','joinedAt':now},f'groups/{GROUP}/photos':{}}
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
APP="export const initializeApp=(config,name)=>({name});"
AUTH='''
const user=()=>({uid:window.TEST_UID||'alice',displayName:'参加する人'});let listener;
export const getAuth=app=>window.testAuth={app,currentUser:window.SIGNED_OUT&&!sessionStorage.getItem('fake_signed_in')?null:user()};
export const onAuthStateChanged=(auth,callback)=>{listener=callback;queueMicrotask(()=>callback(auth.currentUser));return ()=>{};};
export class GoogleAuthProvider{setCustomParameters(){}}
export async function signInWithPopup(auth){sessionStorage.setItem('fake_signed_in','1');auth.currentUser=user();history.replaceState(null,'',location.pathname);listener(auth.currentUser);return {user:auth.currentUser};}
export async function signOut(auth){sessionStorage.removeItem('fake_signed_in');auth.currentUser=null;listener(null);}
'''
DB='''
export const getDatabase=()=>({});export const ref=(db,path)=>({path});export const serverTimestamp=()=>Date.now();
function snapshot(value){return {val:()=>value,exists:()=>value!=null,forEach:fn=>Object.entries(value||{}).forEach(([key,item])=>fn({key,val:()=>item}))};}
export async function get(reference){
 if(window.INDEX_DENIED&&reference.path.startsWith('userGroups/'))throw {code:'PERMISSION_DENIED'};
 let value=await (await fetch('/test-db?path='+encodeURIComponent(reference.path))).json();
 for(const clause of reference.clauses||[]){if(clause.type==='equal')value=Object.fromEntries(Object.entries(value||{}).filter(([id,item])=>item.day===clause.value));}
 return snapshot(value);
}
export async function set(reference,value){if(window.INDEX_DENIED&&reference.path.startsWith('userGroups/'))throw {code:'PERMISSION_DENIED'};await fetch('/test-db',{method:'POST',body:JSON.stringify({path:reference.path,value})});}
export const onValue=(reference,callback)=>{queueMicrotask(()=>callback(snapshot(0)));return ()=>{};};
export const query=(reference,...clauses)=>({...reference,clauses});export const orderByChild=value=>({type:'order',value});export const equalTo=value=>({type:'equal',value});
export const startAt=value=>({type:'start',value});export const endAt=value=>({type:'end',value});export const limitToFirst=value=>({type:'limit',value});
export const update=async()=>{};export async function remove(reference){await fetch('/test-db',{method:'POST',body:JSON.stringify({path:reference.path,value:null})});}
'''
def api(route):
 if route.request.method=='POST':
  body=json.loads(route.request.post_data)
  if body['value'] is None:data.pop(body['path'],None)
  else:data[body['path']]=body['value']
  route.fulfill(content_type='application/json',body='{}')
 else:
  from urllib.parse import urlparse,parse_qs
  key=parse_qs(urlparse(route.request.url).query)['path'][0]
  value=data.get(key)
  if value is None and key.endswith('/members'):value={path.rsplit('/',1)[1]:item for path,item in data.items() if path.startswith(key+'/')} or None
  route.fulfill(content_type='application/json',body=json.dumps(value))
def context(browser,init=''):
 ctx=browser.new_context(viewport={'width':390,'height':844});ctx.add_init_script(init or 'window.TEST_UID="alice";')
 ctx.route('**/test-db*',api)
 for name,code in [('firebase-app',APP),('firebase-auth',AUTH),('firebase-database',DB)]:
  ctx.route(f'https://www.gstatic.com/firebasejs/**/{name}.js',lambda route,request,code=code:route.fulfill(content_type='text/javascript',body=code))
 ctx.route('**/join-test*',lambda route:route.fulfill(content_type='text/html',body='<link rel="stylesheet" href="/basho-styles.css"><script src="/firebase-friends-config.js"></script><script>window.inviteRoutes=[];for(const name of ["basho-show-posts","basho-show-calendar","basho-show-invite"])window.addEventListener(name,()=>window.inviteRoutes.push(name));window.moves=[];window.addEventListener("basho-navigate",event=>window.moves.push(event.detail));</script><script type="module" src="/friends-bootstrap.js"></script><script type="module" src="/flow-screens.js"></script>'+('<basho-invited></basho-invited>' if 'screen=invited' in route.request.url else '<basho-friends-screen></basho-friends-screen>')))
 return ctx
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None,args=['--no-sandbox'])
  base=f'http://127.0.0.1:{server.server_port}';errors=[]
  safari=context(browser);page=safari.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
  # An opened link lands on the invitation screen, which names the inviter carried by the link without trusting it as markup.
  from urllib.parse import quote
  page.goto(base+'/join-test?screen=invited#invite='+TOKEN+'&from='+quote('みほ<img src=x onerror=alert(1)>')+'&n=3&exp='+str(now+3*86400000),wait_until='networkidle')
  assert page.evaluate('window.inviteRoutes')==['basho-show-invite']
  expect(page.locator('.invited-page h1')).to_contain_text('みほimg src=x onerror=さんから')
  expect(page.locator('.invited-page img')).to_have_count(0)
  expect(page.locator('.invited-group')).to_contain_text('3人が参加しています')
  expect(page.locator('.invited-page')).to_contain_text('まで有効です')
  page.get_by_role('button',name='このグループに参加する',exact=True).click()
  page.wait_for_function('window.moves.length>0')
  assert page.evaluate('window.moves')==[{'view':'guide','mode':'first'}] # first launch continues to the guide
  assert data['userGroups/alice']=={'groupId':GROUP}
  assert page.evaluate('location.hash')==''
  assert page.evaluate("localStorage.getItem('basho_firebase_invite_meta_v1')") is None
  # A home-screen app has a separate storage area but the same authenticated account.
  pwa=context(browser);home=pwa.new_page();home.on('pageerror',lambda error:errors.append(str(error)))
  home.goto(base+'/join-test',wait_until='networkidle')
  expect(home.get_by_role('button',name='招待リンクを送る',exact=True)).to_be_visible()
  expect(home.locator('[data-invite-input]')).to_have_count(0)
  expect(home.locator('.people-list li')).to_have_count(2)
  assert home.evaluate("localStorage.getItem('basho_firebase_friends_group_v1:alice')")==GROUP
  # An unrelated account cannot inherit Alice's membership; paste and confirm within the PWA.
  other=context(browser,'window.TEST_UID="bob";window.SIGNED_OUT=true;window.INDEX_DENIED=true;')
  invite=other.new_page();invite.on('pageerror',lambda error:errors.append(str(error)))
  invite.goto(base+'/join-test',wait_until='networkidle')
  expect(invite.get_by_role('button',name='招待リンクを送る',exact=True)).to_have_count(0)
  # Joining waits for login: the link field unlocks once the person has signed in.
  expect(invite.get_by_role('button',name='このリンクで参加',exact=True)).to_be_disabled()
  invite.get_by_role('button',name='Googleでログイン',exact=True).click()
  field=invite.get_by_role('textbox',name='友達から届いたリンク',exact=True)
  expect(field).to_be_enabled()
  field.fill(base+'/join-test#invite='+TOKEN)
  invite.get_by_role('button',name='このリンクで参加',exact=True).click()
  expect(invite.locator('.flow-status')).to_contain_text('このアプリで友達に参加できました')
  assert data[f'groups/{GROUP}/members/bob']['name']=='参加する人'
  assert invite.evaluate('location.hash')==''
  assert invite.evaluate("localStorage.getItem('basho_firebase_friends_group_v1:bob')")==GROUP
  invite.reload(wait_until='networkidle')
  expect(invite.get_by_role('button',name='招待リンクを送る',exact=True)).to_be_visible()
  # A made link carries the inviter's name, the member count and the expiry beside the token.
  invite.evaluate("navigator.share=async data=>{window.shared=data;}")
  invite.get_by_role('button',name='招待リンクを送る',exact=True).click()
  invite.wait_for_function('window.shared')
  link=invite.evaluate('window.shared.url');params=invite.evaluate("Object.fromEntries(new URLSearchParams(new URL(window.shared.url).hash.slice(1)))")
  assert link.startswith(base+'/join-test#invite=') and len(params['invite'])==64 and params['from']=='参加する人' and params['n']=='3' and int(params['exp'])>now,params
  assert data['invites/'+params['invite']]['groupId']==GROUP
  # Leaving removes only this person's membership and returns the screen to the join choices.
  invite.get_by_role('button',name='このグループを抜ける',exact=True).click()
  expect(invite.get_by_role('dialog',name='グループを抜ける確認')).to_be_visible()
  invite.get_by_role('button',name='やめる',exact=True).click()
  expect(invite.get_by_role('dialog',name='グループを抜ける確認')).to_have_count(0)
  invite.get_by_role('button',name='このグループを抜ける',exact=True).click()
  invite.get_by_role('button',name='抜ける',exact=True).click()
  expect(invite.locator('.flow-status')).to_contain_text('グループを抜けました')
  assert data.get(f'groups/{GROUP}/members/bob') is None and f'groups/{GROUP}/members/owner' in data
  assert invite.evaluate("localStorage.getItem('basho_firebase_friends_group_v1:bob')") is None
  expect(invite.get_by_role('button',name='グループを作って招待する',exact=True)).to_be_visible()
  for width in [320,390]:
   invite.set_viewport_size({'width':width,'height':844})
   assert invite.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert not errors,errors
  browser.close()
  print('PWA invitation: the invitation screen joins and escapes the inviter label, isolated storage restores the verified account, pasted links wait for login and survive URL loss, made links carry name/count/expiry, and leaving removes only one membership.')
finally:server.shutdown()
