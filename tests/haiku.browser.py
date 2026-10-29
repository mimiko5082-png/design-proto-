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
        expect(page.locator('.haiku-topic')).to_be_visible()
        expect(page.locator('[data-haiku-action=save]')).to_be_disabled()
        prompt=page.locator('.photo-modern').inner_text()
        # Photos are required, but poetry composition and AI calls are not.
        page.locator('[data-haiku-photo]').set_input_files(str(ROOT/'assets/kotoba-forest.png'))
        expect(page.locator('basho-haiku .haiku-photo')).to_be_visible()
        page.locator('[data-haiku-action=save]').click()
        expect(page.locator('[data-haiku-action=save]')).to_have_text('今日の写真を保存済み')
        expect(page.locator('.reading-xp')).to_have_text('1 ことば')
        page.locator('.tabbar [data-nav=calendar]').click()
        expect(page.locator('.saved-haiku')).to_contain_text(prompt)
        page.reload(wait_until='networkidle')
        expect(page.locator('.saved-haiku')).to_have_count(1)
        page.locator('.tabbar [data-nav=home]').click()
        expect(page.locator('[data-haiku-photo]')).to_have_count(1)
        expect(page.locator('[data-haiku-action=save]')).to_be_disabled()
        page.screenshot(path=str(OUT/'photo-challenge.png'),full_page=True)
        # A new Japanese date gets a different prompt and an empty camera input.
        page.clock.fast_forward(86400000)
        page.reload(wait_until='networkidle')
        expect(page.locator('[data-haiku-photo]')).to_have_count(1)
        assert page.locator('.photo-modern').inner_text()!=prompt
        page.locator('[data-haiku-photo]').set_input_files({'name':'bad.png','mimeType':'image/png','buffer':b'not an image'})
        expect(page.locator('.reading-error')).to_be_visible()
        expect(page.locator('[data-haiku-action=save]')).to_be_disabled()
        assert not calls, calls
        assert not errors, errors
        browser.close()
        print('PASS: real app photo challenge, save, calendar, daily limit, rollover, invalid image; no AI or shared database writes')
finally:
    server.shutdown()
