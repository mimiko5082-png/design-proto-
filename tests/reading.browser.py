"""Local browser regression for reading, growth, calendar and removal of maps."""
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
        browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
        context = browser.new_context(viewport={'width':390,'height':844},service_workers='block')
        page = context.new_page()
        errors, maps = [], []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda request: maps.append(request.url) if 'openstreetmap' in request.url else None)
        page.route('**/api/notifications/config',lambda route:route.fulfill(status=503,content_type='application/json',body='{}'))
        page.route('**/firebase-config.js*',lambda route:route.fulfill(content_type='application/javascript',body='window.BASHO_FIREBASE = {};'))
        def firebase(route):
            names = ['initializeApp'] if 'firebase-app.js' in route.request.url else ['getDatabase','ref','onValue','set','update','get']
            route.fulfill(content_type='application/javascript',body='\n'.join(f'export function {name}() {{ throw Error("Unexpected Firebase access"); }}' for name in names))
        page.route('https://www.gstatic.com/firebasejs/**',firebase)
        page.clock.install(time=1792440000)  # fixed date, use app's JST date to assert
        page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='networkidle')
        expect(page.locator('basho-reading[mode=summary]')).to_be_visible()
        page.locator('.legacy-reading > summary').click()
        expect(page.locator('.reading-xp')).to_contain_text('0')
        expect(page.locator('[data-nav="map"]')).to_have_count(0)
        page.locator('[data-reading-action="read"]').click()
        expect(page.locator('.reading-growth h2')).to_have_text('小さな芽')
        expect(page.locator('.reading-feedback')).to_contain_text('育ちました')
        page.locator('[data-reading-action="read"]').click()
        expect(page.locator('.reading-xp')).to_have_text('1 ことば')
        page.locator('.reading-next').click()
        page.locator('[data-reading-action="read"]').click()
        expect(page.locator('.reading-xp')).to_have_text('2 ことば')
        page.locator('.tabbar [data-nav="calendar"]').click()
        expect(page.locator('.reading-date-records .reading-poem')).to_have_count(2)
        expect(page.locator('.reading-date-records')).to_contain_text('天智天皇')
        expect(page.locator('.reading-date-records')).to_contain_text('持統天皇')
        page.reload(wait_until='networkidle')
        expect(page.locator('.reading-date-records .reading-poem')).to_have_count(2)
        page.locator('[aria-label="前の月"]').click()
        expect(page.locator('.reading-date-records .reading-poem')).to_have_count(0)
        page.locator('[data-reading-action="today"]').click()
        expect(page.locator('.reading-date-records .reading-poem')).to_have_count(2)
        page.locator('.tabbar [data-nav="garden"]').click()
        expect(page.locator('.reading-xp')).to_have_text('2 ことば')
        page.locator('.tabbar [data-nav="notebook"]').click()
        page.locator('[data-action="open-entry"]').first.click()
        expect(page.locator('.entry-view')).to_be_visible()
        page.locator('.tabbar [data-nav="home"]').click()
        page.locator('.legacy-reading > summary').click()
        page.locator('basho-reading[mode=library] .reading-library summary').click()
        page.locator('basho-reading[mode=library] .reading-library [data-poem="hyakunin-4"]').click()
        page.locator('[data-reading-action="read"]').click()
        expect(page.locator('.reading-growth h2')).to_have_text('ひらく双葉')
        # A new JST day permits the same poem again without changing yesterday's log.
        page.clock.set_system_time(1792526400)
        page.reload(wait_until='networkidle')
        page.locator('.legacy-reading > summary').click()
        expect(page.locator('.reading-count')).to_have_text('今日 0首')
        page.locator('[data-reading-action="read"]').click()
        expect(page.locator('.reading-xp')).to_have_text('4 ことば')
        page.locator('.tabbar [data-nav="calendar"]').click()
        expect(page.locator('.reading-date-records .reading-poem')).to_have_count(1)
        page.locator('.tabbar [data-nav="home"]').click()
        for width in [320,390]:
            page.set_viewport_size({'width':width,'height':844})
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'horizontal overflow'
        page.screenshot(path='/tmp/basho-reading-mobile.png',full_page=True)
        assert not errors, errors
        assert not maps, maps
        browser.close()
        print('PASS: reading, growth, daily duplicate prevention, calendar, reload, notebook detail, mobile and no map requests')
finally:
    server.shutdown()
