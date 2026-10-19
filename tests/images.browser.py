"""Optional UI smoke test: python3 tests/images.browser.py

Requires Python Playwright and Chromium. External AI and Firebase are isolated;
this test makes no billable API calls or shared database writes.
"""
import base64
import json
import os
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"), args=["--no-sandbox"])
        context = browser.new_context(viewport={"width": 390, "height": 844}, service_workers="block")
        page = context.new_page()
        errors, held, requests = [], [], []
        generation_calls = [0]
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.route("**/api/notifications/config", lambda route: route.fulfill(status=503, content_type="application/json", body='{}'))
        page.route("**/firebase-config.js*", lambda route: route.fulfill(content_type="application/javascript", body="window.BASHO_FIREBASE = {};"))
        # Throw if image tooling accidentally invokes a shared Firebase operation.
        def firebase(route):
            names = ["initializeApp"] if "firebase-app.js" in route.request.url else ["getDatabase", "ref", "onValue", "set", "update", "get"]
            route.fulfill(content_type="application/javascript", body="\n".join(f'export function {name}() {{ throw Error("Unexpected Firebase access"); }}' for name in names))
        page.route("https://www.gstatic.com/firebasejs/**", firebase)

        def api(route):
            requests.append(route.request.post_data_json)
            if route.request.url.endswith("/analyze"):
                held.append(route)
            else:
                generation_calls[0] += 1
                if generation_calls[0] == 1:
                    route.fulfill(status=500, content_type="application/json", body='{"error":"DO_NOT_EXPOSE_PROVIDER_SECRET"}')
                elif generation_calls[0] == 3:
                    route.fulfill(status=429, content_type="application/json", body='{"code":"FREE_QUOTA_EXCEEDED","error":"PRIVATE_QUOTA_ACCOUNT"}')
                else:
                    route.fulfill(content_type="application/json", body=json.dumps({"image": "data:image/png;base64," + base64.b64encode(PNG).decode(), "kind": "generated"}))
        page.route("https://images.example.test/api/images/**", api)
        page.goto(f"http://127.0.0.1:{server.server_port}/", wait_until="networkidle")
        expect(page.locator(".basic-experience li")).to_have_count(4)
        page.locator('[data-nav="images"]').click()
        expect(page.locator("basho-image-tools")).to_be_visible()
        page.locator("basho-image-tools summary").click()
        page.locator("[data-image-endpoint]").fill("https://images.example.test")
        page.locator("[data-save-image-endpoint]").click()
        file_input = page.locator("[data-image-file]")
        file_input.set_input_files({"name": "fake.svg", "mimeType": "image/svg+xml", "buffer": b"<svg/>"})
        expect(page.locator('[data-image-status="analyze"]')).to_contain_text("JPEG")
        file_input.set_input_files({"name": "large.png", "mimeType": "image/png", "buffer": bytes(4*1024*1024+1)})
        expect(page.locator('[data-image-status="analyze"]')).to_contain_text("4MiB")
        assert not requests
        file_input.set_input_files({"name": "photo.png", "mimeType": "image/png", "buffer": PNG})
        expect(page.locator('[data-image-status="analyze"]')).to_contain_text("写真を選択しました")
        analyze = page.locator('[data-image-form="analyze"] button')
        generate = page.locator('[data-image-form="generate"] button')
        analyze.click()
        expect(analyze).to_be_disabled()
        expect(generate).to_be_enabled()
        page.locator('[data-image-prompt]').fill("木陰のベンチを水彩で")
        generate.click()
        expect(page.locator('[data-image-status="generate"]')).to_contain_text("再試行")
        assert "DO_NOT_EXPOSE" not in page.locator("basho-image-tools").inner_text()
        generate.click()
        expect(page.locator('[data-image-result="generate"]')).to_be_visible()
        expect(page.locator('[data-image-result="generate"] figcaption')).to_contain_text("AI生成")
        expect(analyze).to_be_disabled()  # Independent requests and loading states.
        assert held
        photo = next(item['image'] for item in requests if 'image' in item)
        assert photo.startswith('data:image/jpeg;base64,')
        assert len(base64.b64decode(photo.split(',', 1)[1])) <= 256 * 1024
        held.pop().fulfill(content_type="application/json", body=json.dumps({"text": '<img src=x onerror="alert(1)"> 木陰のベンチ。'}))
        expect(page.locator('[data-image-result="analyze"] p')).to_contain_text("<img")
        expect(page.locator('[data-image-result="analyze"] img')).to_have_count(0)
        expect(analyze).to_be_enabled()
        expect(page.locator('[data-image-result="generate"] img')).to_have_js_property("naturalWidth", 1)
        with page.expect_download() as download:
            page.locator('[data-image-result="generate"] a').click()
        assert Path(download.value.path()).read_bytes() == PNG
        generate.click()
        expect(page.locator('[data-image-status="generate"]')).to_contain_text("本日のAI無料枠")
        expect(page.locator('[data-image-result="generate"]')).to_be_hidden()
        assert "PRIVATE_QUOTA_ACCOUNT" not in page.locator("basho-image-tools").inner_text()
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        assert page.evaluate("!Object.values(localStorage).some(v => v.includes('data:image/'))")
        page.reload(wait_until="networkidle")
        expect(page.locator('[data-image-result="generate"]')).to_be_hidden()
        assert page.locator('[data-image-endpoint]').input_value() == "https://images.example.test"
        page.locator('.tabbar [data-nav="home"]').click()
        expect(page.locator('[data-nav="pause"]')).to_be_visible()
        assert not errors, errors
        print("PASS: mobile upload validation/compression, independent tasks, loading, retry, free-quota stop, safe text, download, transient images and home navigation")
        browser.close()
finally:
    server.shutdown()
