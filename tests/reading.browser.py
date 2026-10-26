"""Own tanka compose/save/calendar/growth regression in a mobile browser."""
import os
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT = Path(__file__).resolve().parent.parent
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args): pass
server = ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':390,'height':844},service_workers='block')
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.route('**/api/notifications/config',lambda route:route.fulfill(status=503,content_type='application/json',body='{}'))
        page.route('**/firebase-config.js*',lambda route:route.fulfill(content_type='application/javascript',body='window.BASHO_FIREBASE = {};'))
        def firebase(route):
            names=['initializeApp'] if 'firebase-app.js' in route.request.url else ['getDatabase','ref','onValue','set','update','get']
            route.fulfill(content_type='application/javascript',body='\n'.join(f'export function {name}() {{ throw Error("Unexpected Firebase access"); }}' for name in names))
        page.route('https://www.gstatic.com/firebasejs/**',firebase)
        # Old reading history must never become an authored poem or award growth.
        page.add_init_script("localStorage.setItem('basho_reading_v1',JSON.stringify({version:1,reads:[{day:'2026-10-20',poemId:'hyakunin-1'}]}));")
        page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='networkidle')
        expect(page.get_by_text('今日、読む短歌',exact=True)).to_have_count(0)
        expect(page.locator('[data-reading-action="read"]')).to_have_count(0)
        expect(page.locator('.reading-xp')).to_have_text('0 首 詠んだ')
        expect(page.locator('.tanka-form')).to_have_count(0)
        expect(page.get_by_text('景色から、一首詠む',exact=True)).to_have_count(0)
        page.locator('.tabbar [data-nav="calendar"]').click()
        submit=page.get_by_role('button',name='カレンダーに記録する',exact=True)
        submit.click()
        expect(page.locator('.reading-date-records .reading-poem')).to_have_count(0)
        poem='朝の道\n木の影のびて風の声\n昨日と違う光を見つける'
        page.get_by_label('自分で詠んだ短歌').fill(poem)
        page.get_by_label('詠んだ日',exact=True).fill('2026-10-20')
        submit.click()
        expect(page.locator('.reading-feedback')).to_contain_text('記録しました')
        expect(page.locator('.reading-date-records .reading-poem')).to_have_count(1)
        # Duplicate save cannot increase growth.
        page.get_by_label('自分で詠んだ短歌').fill(poem)
        submit.click()
        expect(page.locator('.reading-feedback')).to_contain_text('すでに記録')
        expect(page.locator('.reading-date-records .reading-poem')).to_have_count(1)
        page.get_by_label('詠んだ日',exact=True).fill('2026-10-20')
        page.get_by_label('自分で詠んだ短歌').fill('夕暮れの\n小さな短歌')
        page.get_by_role('button',name='カレンダーに記録する',exact=True).click()
        expect(page.locator('.reading-date-records .reading-poem')).to_have_count(2)
        expect(page.locator('.reading-date-records')).to_contain_text('昨日と違う光')
        expect(page.locator('[data-day="2026-10-20"]')).to_contain_text('2首')
        page.reload(wait_until='networkidle')
        # Return to the recorded date via the form after reloading.
        page.get_by_label('詠んだ日',exact=True).fill('2026-10-20')
        page.get_by_label('自分で詠んだ短歌').fill(poem)
        page.get_by_role('button',name='カレンダーに記録する',exact=True).click()
        expect(page.locator('.reading-date-records .reading-poem')).to_have_count(2)
        for i in range(3):
            page.get_by_label('自分で詠んだ短歌').fill(f'景色から生まれた歌 {i}')
            page.get_by_role('button',name='カレンダーに記録する',exact=True).click()
        expect(page.locator('.reading-feedback')).to_contain_text('累計5首')
        page.locator('.tabbar [data-nav="garden"]').click()
        expect(page.locator('.reading-growth h2')).to_have_text('小さな芽')
        expect(page.locator('.reading-xp')).to_have_text('5 首 詠んだ')
        page.locator('.tabbar [data-nav="calendar"]').click()
        # Storage failure keeps the draft available for retry.
        page.get_by_label('自分で詠んだ短歌').fill('消えないでほしい下書き')
        page.evaluate("() => { window.originalSet=Storage.prototype.setItem; Storage.prototype.setItem=function(){throw Error('quota')}; }")
        page.get_by_role('button',name='カレンダーに記録する',exact=True).click()
        expect(page.locator('.reading-error')).to_be_visible()
        expect(page.get_by_label('自分で詠んだ短歌')).to_have_value('消えないでほしい下書き')
        page.evaluate('() => { Storage.prototype.setItem=window.originalSet; }')
        for width in [320,390]:
            page.set_viewport_size({'width':width,'height':844})
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),'horizontal overflow'
        page.screenshot(path='/workspace/work/composed-tanka-mobile.png',full_page=True)
        assert not errors,errors
        browser.close()
        print('PASS: own poems only, explicit save, dates, duplicates, calendar, reload, five-poem growth, failed-save draft and mobile widths')
finally:
    server.shutdown()
