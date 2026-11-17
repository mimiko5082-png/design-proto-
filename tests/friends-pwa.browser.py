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
export const update=async()=>{};export const remove=async()=>{};
'''
def api(route):
 if route.request.method=='POST':
  body=json.loads(route.request.post_data);data[body['path']]=body['value'];route.fulfill(content_type='application/json',body='{}')
 else:
  from urllib.parse import urlparse,parse_qs
  key=parse_qs(urlparse(route.request.url).query)['path'][0]
  route.fulfill(content_type='application/json',body=json.dumps(data.get(key)))
def context(browser,init=''):
 ctx=browser.new_context(viewport={'width':390,'height':844});ctx.add_init_script(init or 'window.TEST_UID="alice";')
 ctx.route('**/test-db*',api)
 for name,code in [('firebase-app',APP),('firebase-auth',AUTH),('firebase-database',DB)]:
  ctx.route(f'https://www.gstatic.com/firebasejs/**/{name}.js',lambda route,request,code=code:route.fulfill(content_type='text/javascript',body=code))
 ctx.route('**/join-test*',lambda route:route.fulfill(content_type='text/html',body='<link rel="stylesheet" href="/basho-styles.css"><script src="/firebase-friends-config.js"></script><script>window.inviteRoutes=[];for(const name of ["basho-show-posts","basho-show-calendar"])window.addEventListener(name,()=>window.inviteRoutes.push(name));</script><script type="module" src="/friends-bootstrap.js"></script><script type="module" src="/public-feed.js?v=77"></script><basho-public-feed></basho-public-feed>'))
 return ctx
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None,args=['--no-sandbox'])
  base=f'http://127.0.0.1:{server.server_port}';errors=[]
  safari=context(browser);page=safari.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
  page.goto(base+'/join-test?calendar=shared#invite='+TOKEN,wait_until='networkidle')
  assert page.evaluate('window.inviteRoutes')==['basho-show-posts']
  page.get_by_role('button',name='この招待で参加する',exact=True).click()
  expect(page.locator('.friend-status')).to_contain_text('友達とつながりました')
  assert data['userGroups/alice']=={'groupId':GROUP}
  assert page.evaluate('location.hash')==''
  # A home-screen app has a separate storage area but the same authenticated account.
  pwa=context(browser);home=pwa.new_page();home.on('pageerror',lambda error:errors.append(str(error)))
  home.goto(base+'/join-test',wait_until='networkidle')
  expect(home.get_by_role('button',name='友達の招待リンクを作る',exact=True)).to_be_visible()
  expect(home.get_by_role('button',name='この招待で参加する',exact=True)).to_have_count(0)
  assert home.evaluate("localStorage.getItem('basho_firebase_friends_group_v1:alice')")==GROUP
  # An unrelated account cannot inherit Alice's membership; paste and confirm within the PWA.
  other=context(browser,'window.TEST_UID="bob";window.SIGNED_OUT=true;window.INDEX_DENIED=true;')
  invite=other.new_page();invite.on('pageerror',lambda error:errors.append(str(error)))
  invite.goto(base+'/join-test',wait_until='networkidle')
  expect(invite.get_by_role('button',name='友達の招待リンクを作る',exact=True)).to_have_count(0)
  invite.get_by_role('textbox',name='友達の招待リンク',exact=True).fill(base+'/join-test#invite='+TOKEN)
  invite.get_by_role('button',name='このリンクで参加する',exact=True).click()
  expect(invite.locator('.friend-status')).to_contain_text('このアプリで友達に参加できました')
  assert data[f'groups/{GROUP}/members/bob']['name']=='参加する人'
  assert invite.evaluate('location.hash')==''
  assert invite.evaluate("localStorage.getItem('basho_firebase_friends_group_v1:bob')")==GROUP
  invite.reload(wait_until='networkidle')
  expect(invite.get_by_role('button',name='友達の招待リンクを作る',exact=True)).to_be_visible()
  for width in [320,390]:
   invite.set_viewport_size({'width':width,'height':844})
   assert invite.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert not errors,errors
  browser.close()
  print('PWA invitation: isolated storage restores the verified account, unrelated accounts do not inherit membership, pasted links survive login URL loss and work with old index rules.')
finally:server.shutdown()
