"""Photo -> mocked AI -> edited haiku card -> IndexedDB -> calendar/growth.
No real AI requests or shared database writes. Also creates review screenshots.
"""
import base64
import json
import os
import threading
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parent.parent
OUT=Path('/tmp/basho-haiku-preview'); OUT.mkdir(exist_ok=True)
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':390,'height':844},service_workers='block')
        page=context.new_page(); errors=[]; calls=[]; held=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.route('**/api/notifications/config',lambda route:route.fulfill(status=503,content_type='application/json',body='{}'))
        page.route('**/firebase-config.js*',lambda route:route.fulfill(content_type='application/javascript',body='window.BASHO_FIREBASE={};'))
        def firebase(route):
            names=['initializeApp'] if 'firebase-app.js' in route.request.url else ['getDatabase','ref','onValue','set','update','get']
            route.fulfill(content_type='application/javascript',body='\n'.join(f'export function {name}(){{throw Error("Unexpected Firebase write");}}' for name in names))
        page.route('https://www.gstatic.com/firebasejs/**',firebase)
        def api(route):
            calls.append(route.request.post_data_json)
            held.append(route)
        page.route('**/api/images/haiku',api)
        page.clock.install(time=datetime(2026,10,26,3,0,tzinfo=timezone.utc))
        page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='networkidle')
        expect(page.locator('.haiku-topic')).to_have_count(0)
        expect(page.locator('[data-haiku-action=example]')).to_have_count(0)
        page.locator('[data-haiku-action=observe]').click()
        page.clock.fast_forward(30000)
        expect(page.locator('.haiku-topic')).to_contain_text('松尾芭蕉')
        page.locator('[data-haiku-action=example]').click()
        expect(page.locator('.haiku-examples')).to_contain_text('AIがあらかじめ作った例')
        expect(page.locator('.reading-xp')).to_have_text('0 ことば')
        assert not calls
        page.locator('[data-haiku-action=example]').click()
        original=page.locator('.haiku-topic .reading-verse').inner_text()
        expect(page.locator('[data-haiku-action=generate]')).to_be_disabled()
        expect(page.locator('[data-nav=map]')).to_have_count(0)
        # Validate file before any external call.
        page.locator('[data-haiku-photo]').set_input_files({'name':'bad.svg','mimeType':'image/svg+xml','buffer':b'<svg></svg>'})
        expect(page.locator('basho-haiku [role=alert]')).to_contain_text('JPEG')
        assert not calls
        page.locator('[data-haiku-photo]').set_input_files(str(ROOT/'assets/kotoba-forest.png'))
        expect(page.locator('basho-haiku .haiku-photo')).to_be_visible()
        assert not calls
        page.locator('#screen').evaluate('(el)=>el.scrollTop=0')
        page.screenshot(path=str(OUT/'topic.png'))
        page.locator('[data-haiku-action=generate]').click()
        expect(page.locator('[data-haiku-action=generate]')).to_be_disabled()
        page.wait_for_timeout(100)
        assert len(calls)==1
        assert calls[0]['image'].startswith('data:image/jpeg;base64,')
        held.pop().fulfill(status=502,content_type='application/json',body='{"error":"PRIVATE_SERVER_KEY"}')
        expect(page.locator('basho-haiku [role=alert]')).to_contain_text('再試行')
        assert 'PRIVATE_SERVER_KEY' not in page.locator('basho-haiku').inner_text()
        page.locator('[data-haiku-action=generate]').click()
        page.wait_for_timeout(100)
        ai={'lines':[original,'ひかりのしずく','ひとつ落つ'],'observed':'木の葉と水滴が写っています。'}
        held.pop().fulfill(content_type='application/json',body=json.dumps(ai))
        expect(page.locator('[data-haiku-lines]')).to_have_value('\n'.join(ai['lines'][1:]))
        expect(page.locator('.haiku-draft')).to_contain_text('芭蕉の実作ではありません')
        page.locator('[data-haiku-lines]').fill('一行だけ')
        page.locator('[data-haiku-action=save]').click()
        expect(page.locator('basho-haiku [role=alert]')).to_contain_text('3行')
        edited='小さな光\nひとつ落つ'
        page.locator('[data-haiku-lines]').fill(edited)
        # A failed storage transaction awards no growth and can be retried.
        page.evaluate('() => { window.realAdd=IDBObjectStore.prototype.add; IDBObjectStore.prototype.add=function(){throw new DOMException("quota","QuotaExceededError")}; }')
        page.locator('[data-haiku-action=save]').click()
        expect(page.locator('basho-haiku [role=alert]')).to_contain_text('保存できません')
        expect(page.locator('.reading-xp')).to_have_text('0 ことば')
        page.evaluate('() => { IDBObjectStore.prototype.add=window.realAdd; }')
        page.locator('[data-haiku-action=save]').click()
        expect(page.locator('[data-haiku-action=save]')).to_have_text('読み札を保存済み')
        expect(page.locator('.reading-xp')).to_have_text('1 ことば')
        expect(page.locator('[data-haiku-action=save]')).to_be_disabled()
        # Inspect complete saved card and duplicate handling through the public store.
        record=page.evaluate('async()=>{const {loadCards}=await import("./haiku-store.js"); return (await loadCards())[0]}')
        assert record['lines']==[original]+edited.split('\n') and record['aiLines']==ai['lines'] and record['edited']
        assert record['day']=='2026-10-26'
        assert page.evaluate('async()=>{const {loadCards,saveCard}=await import("./haiku-store.js"); return await saveCard((await loadCards())[0])}') is False
        page.locator('.haiku-draft').scroll_into_view_if_needed()
        page.screenshot(path=str(OUT/'draft.png'))
        page.locator('.tabbar [data-nav=calendar]').click()
        expect(page.locator('.saved-haiku')).to_have_count(1)
        expect(page.locator('.saved-haiku .reading-verse')).to_have_text(original+'小さな光ひとつ落つ')
        page.locator('.saved-haiku summary').click()
        expect(page.locator('.saved-haiku')).to_contain_text(ai['lines'][1])
        page.reload(wait_until='networkidle')
        expect(page.locator('.saved-haiku')).to_have_count(1)
        page.locator('#screen').evaluate('(el)=>el.scrollTop=0')
        page.screenshot(path=str(OUT/'calendar.png'))
        page.locator('.reading-date-records').evaluate('(el)=>el.scrollIntoView({block:"start"})')
        page.screenshot(path=str(OUT/'card.png'))
        page.locator('.tabbar [data-nav=garden]').click()
        expect(page.locator('.reading-xp')).to_have_text('1 ことば')
        expect(page.locator('.reading-stats')).to_contain_text('集めた読み札')
        page.screenshot(path=str(OUT/'garden.png'))
        page.locator('.tabbar [data-nav=home]').click()
        assert page.locator('.haiku-topic .reading-verse').inner_text()==original
        page.clock.set_system_time(datetime(2026,10,27,3,0,tzinfo=timezone.utc))
        page.reload(wait_until='networkidle')
        expect(page.locator('.haiku-topic')).to_have_count(0)
        page.locator('[data-haiku-action=observe]').click()
        page.clock.fast_forward(30000)
        assert page.locator('.haiku-topic .reading-verse').inner_text()!=original
        page.locator('.tabbar [data-nav=calendar]').click()
        expect(page.locator('.saved-haiku')).to_have_count(0)
        page.locator('[data-day="2026-10-26"]').click()
        expect(page.locator('.saved-haiku')).to_have_count(1)
        # Write independently after observation: AI is optional, and provenance stays human.
        page.locator('.tabbar [data-nav=home]').click()
        page.locator('[data-haiku-lines]').fill('信号かわる\n人の波')
        page.locator('[data-haiku-photo]').set_input_files(str(ROOT/'assets/kotoba-forest.png'))
        expect(page.locator('[data-haiku-lines]')).to_have_value('信号かわる\n人の波')
        page.locator('[data-haiku-action=save]').click()
        expect(page.locator('[data-haiku-action=save]')).to_have_text('読み札を保存済み')
        manual = page.evaluate('async()=>{const {loadCards}=await import("./haiku-store.js"); return (await loadCards())[0]}')
        assert manual['creation']=='user' and manual['aiLines'] is None
        assert len(calls)==2
        for width in [320,390]:
            page.set_viewport_size({'width':width,'height':844})
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert not errors,errors
        # Screenshot review sheet, explicitly labelled as simulated AI, not a live model result.
        figures=''.join(f'<figure><figcaption>{label}</figcaption><img src="data:image/png;base64,{base64.b64encode((OUT/f"{view}.png").read_bytes()).decode()}"></figure>' for view,label in [('topic','① 芭蕉の一句がお題'),('draft','② 写真からAIと詠む'),('card','③ 写真と俳句の読み札'),('garden','④ 集めるほど育つ')])
        sheet=browser.new_page(viewport={'width':1640,'height':960})
        sheet.set_content('<html lang="ja"><meta charset="utf-8"><style>body{margin:0;padding:20px;background:#f2eee5;color:#344735;font-family:sans-serif}h1{font-size:22px;margin:0 0 8px}p{font-size:13px;margin:0 0 18px}main{display:flex;gap:15px}figure{margin:0;width:388px}figcaption{font-size:15px;margin:0 0 10px}img{width:388px;border-radius:14px;box-shadow:0 2px 9px #0002}</style><h1>芭蕉の一句から、あなたの読み札へ。</h1><p>未公開プレビュー／写真・俳句は表示確認用のサンプル。AI応答はテスト用です。本番への公開・実AIへの送信はしていません。</p><main>'+figures+'</main></html>')
        sheet.screenshot(path=str(OUT/'preview.png'),full_page=True)
        browser.close()
        print('PASS: prompt rotation, photo validation, explicit send, AI error/retry, editing, quota failure, idempotent save, IndexedDB persistence, calendar, growth, provenance, mobile')
finally:
    server.shutdown()
