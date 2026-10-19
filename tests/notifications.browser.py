"""UI checks with fake push registration: no real permissions or messages."""
import json
import os
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_args): pass
root = Path(__file__).resolve().parent.parent
server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=str(root)))
threading.Thread(target=server.serve_forever, daemon=True).start()
origin = f"http://127.0.0.1:{server.server_port}"
mock = """
window.permissionRequests=0;
class MockNotification { static permission='default'; static async requestPermission(){ window.permissionRequests++; this.permission='granted'; return 'granted'; } }
Object.defineProperty(window,'Notification',{value:MockNotification});
Object.defineProperty(window,'PushManager',{value:class {}});
let subscription=null;
const reg={pushManager:{async getSubscription(){return subscription;},async subscribe(options){
 if(!options.userVisibleOnly || options.applicationServerKey.length!==65)throw Error('Invalid registration');
 subscription={endpoint:'https://fcm.googleapis.com/fcm/send/ui-test',async unsubscribe(){subscription=null;return true;}};return subscription;
}}};
Object.defineProperty(navigator,'serviceWorker',{value:{async register(){return reg;},ready:Promise.resolve(reg)}});
"""
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"), args=["--no-sandbox"])
        page = browser.new_page(viewport={"width":390,"height":844})
        page.add_init_script(mock)
        page.route("**/firebase-config.js*",lambda route:route.fulfill(content_type="application/javascript",body="window.BASHO_FIREBASE={};"))
        def firebase(route):
            names=["initializeApp"] if "firebase-app.js" in route.request.url else ["getDatabase","ref","onValue","set","update","get"]
            route.fulfill(content_type="application/javascript",body="\n".join(f"export function {name}(){{throw Error('Unexpected Firebase');}}" for name in names))
        page.route("https://www.gstatic.com/firebasejs/**",firebase)
        actions=[]
        def api(route):
            action=route.request.url.split('/')[-1]
            if action=='config':
                route.fulfill(content_type="application/json",body=json.dumps({"publicKey":"B"+"A"*86,"startHour":9,"endHour":21,"timeZone":"Asia/Tokyo"}))
            else:
                actions.append((action,route.request.post_data_json))
                route.fulfill(content_type="application/json",body=json.dumps({"accepted":True,"registered":action=='subscribe'}))
        page.route("**/api/notifications/**",api)
        page.goto(origin+'/',wait_until='networkidle')
        expect(page.locator('[data-notification-enable]')).to_be_enabled()
        assert page.evaluate('permissionRequests')==0
        page.locator('[data-notification-enable]').click()
        expect(page.locator('[data-notification-status]')).to_contain_text('登録しました')
        assert page.evaluate('permissionRequests')==1
        assert actions[0][0]=='subscribe' and len(actions[0][1]['token'])==43
        page.locator('[data-notification-test]').click()
        expect(page.locator('[data-notification-status]')).to_contain_text('送信を依頼')
        page.reload(wait_until='networkidle')
        assert page.evaluate('permissionRequests')==0  # Reload never asks permission.
        # The fake platform starts without a subscription after reload; it can re-enable.
        page.locator('[data-notification-enable]').click()
        expect(page.locator('[data-notification-disable]')).to_be_visible()
        page.locator('[data-notification-disable]').click()
        expect(page.locator('[data-notification-status]')).to_contain_text('停止しました')
        assert actions[-1][0]=='unsubscribe'
        assert page.evaluate('!Object.keys(localStorage).some(k=>k.startsWith("basho_push_registration:"))')
        # Key setup never sends private material or writes it to browser storage.
        page.goto(origin+'/push-setup.html',wait_until='networkidle')
        page.locator('#generate').click()
        expect(page.locator('#keys')).to_be_visible()
        assert len(page.locator('#public').input_value())==87
        assert len(page.locator('#private').input_value())>100
        expect(page.locator('#private')).to_have_attribute('type','password')
        assert page.evaluate('!Object.values(localStorage).some(v=>v.includes(document.querySelector("#private").value))')
        print('PASS: opt-in only, token registration, manual test, stop, no permission on reload, local-only masked key generation')
        browser.close()
finally:
    server.shutdown()
