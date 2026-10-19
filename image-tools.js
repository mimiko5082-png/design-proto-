import { MAX_AI_IMAGE_BYTES, validateFile, validateImage, validatePrompt } from "./image-validation.js";
import { ImageServiceError, normalizeEndpoint, requestImageTask } from "./image-service.js";

class BashoImageTools extends HTMLElement {
  connectedCallback() {
    this.controllers = new Map();
    this.selection = 0;
    this.innerHTML = `
      <p>写真の認識と画像の生成を、それぞれ試せます。結果はこの画面だけに表示し、句帳や共有データベースには自動保存しません。</p>
      <p>Workers FreeのAI無料枠を使います。枠を使い切った場合は処理を停止し、有料APIには切り替えません。</p>
      <details class="place-attach"><summary>画像AIの接続設定</summary>
        <label>画像AIサーバーのURL<input type="url" data-image-endpoint placeholder="https://your-worker.workers.dev" autocomplete="off" /></label>
        <button type="button" class="outline-button" data-save-image-endpoint>接続先を保存</button>
        <p>入力するのは管理者のサーバーURLだけです。APIキーは入力しないでください。</p>
      </details>
      <p data-image-connection role="status"></p>
      <section class="image-tool" aria-labelledby="image-analyze-title">
        <h2 id="image-analyze-title">写真を読み取る</h2>
        <p>JPEG・PNG・WebP、4MiB以下、2000万画素以下（各辺10000px以下）。送信前に長辺768px以下へ縮小します。実行すると写真を外部AIへ送信します。</p>
        <form data-image-form="analyze">
          <label>解析する写真<input type="file" accept="image/jpeg,image/png,image/webp" data-image-file required /></label>
          <img data-image-preview hidden alt="選択した写真" />
          <button class="main-button" type="submit">写真を認識する</button>
        </form>
        <p data-image-status="analyze" role="status" aria-live="polite"></p>
        <div class="image-analysis-result" data-image-result="analyze" hidden><h3>AIの認識結果</h3><p></p><small>誤認識や推測を含むことがあります。現地での観察と比べてください。</small></div>
      </section>
      <section class="image-tool" aria-labelledby="image-generate-title">
        <h2 id="image-generate-title">言葉から画像を作る</h2>
        <form data-image-form="generate">
          <label>作りたい画像の説明<textarea data-image-prompt maxlength="1000" required rows="5" placeholder="木陰のベンチに雨粒が残る街角。水彩画のような柔らかい色で。"></textarea></label>
          <small>1〜1000文字。実行すると説明文を外部AIへ送信します。</small>
          <button class="main-button" type="submit">画像を生成する</button>
        </form>
        <p data-image-status="generate" role="status" aria-live="polite"></p>
        <figure data-image-result="generate" hidden><figcaption>AI生成画像 · 実際の観察写真ではありません</figcaption><img alt="説明文をもとにAIが生成した画像" /><a class="outline-button" download="basho-generated.png">画像を保存</a></figure>
      </section>`;
    this.local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
    let saved = "";
    try { saved = localStorage.getItem("basho_image_endpoint") || ""; } catch {}
    this.endpoint = saved || window.BASHO_IMAGES?.endpoint || "";
    this.querySelector("[data-image-endpoint]").value = this.endpoint;
    this.connectionStatus();
    this.querySelector("[data-save-image-endpoint]").addEventListener("click", () => {
      try {
        const endpoint = normalizeEndpoint(this.querySelector("[data-image-endpoint]").value.trim(), this.local);
        localStorage.setItem("basho_image_endpoint", endpoint);
        this.endpoint = endpoint;
        this.connectionStatus();
      } catch (error) { this.querySelector("[data-image-connection]").textContent = error.message; }
    });
    this.querySelector("[data-image-file]").addEventListener("change", () => this.selectFile());
    for (const task of ["analyze", "generate"]) {
      this.querySelector(`[data-image-form="${task}"]`).addEventListener("submit", event => { event.preventDefault(); this.run(task); });
    }
  }

  connectionStatus() {
    this.querySelector("[data-image-connection]").textContent = this.endpoint ? "接続先を設定済みです。実行時に通信を確認します。" : "画像AIは未接続です。接続設定に管理者のサーバーURLを登録してください。";
  }

  async selectFile() {
    const id = ++this.selection;
    this.image = null;
    this.querySelector('[data-image-result="analyze"]').hidden = true;
    const preview = this.querySelector("[data-image-preview]");
    preview.hidden = true; preview.removeAttribute("src");
    if (this.previewURL) URL.revokeObjectURL(this.previewURL);
    const file = this.querySelector("[data-image-file]").files[0];
    if (!file) return;
    this.querySelector('[data-image-status="analyze"]').textContent = "写真を確認しています…";
    try {
      validateFile(file);
      validateImage(new Uint8Array(await file.arrayBuffer()), file.type);
      const bitmap = await createImageBitmap(file);
      let data;
      try {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 768 / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext("2d");
        context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        for (const quality of [0.75, 0.55, 0.35]) {
          data = canvas.toDataURL("image/jpeg", quality);
          if ((data.length - data.indexOf(",") - 1) * 3 / 4 <= MAX_AI_IMAGE_BYTES) break;
        }
        if ((data.length - data.indexOf(",") - 1) * 3 / 4 > MAX_AI_IMAGE_BYTES) throw new Error("送信用の写真が大きすぎます。小さな画像を選んでください。");
      } finally { bitmap.close(); }
      if (id !== this.selection || !this.isConnected) return;
      this.image = data;
      this.previewURL = URL.createObjectURL(file);
      preview.src = this.previewURL; preview.hidden = false;
      this.querySelector('[data-image-status="analyze"]').textContent = "写真を選択しました。認識ボタンを押すまで外部へ送信しません。";
    } catch (error) {
      if (id === this.selection && this.isConnected) this.querySelector('[data-image-status="analyze"]').textContent = error.message;
    }
  }

  async run(task) {
    if (this.controllers.has(task)) return;
    const form = this.querySelector(`[data-image-form="${task}"]`);
    const button = form.querySelector('button[type="submit"]');
    const status = this.querySelector(`[data-image-status="${task}"]`);
    const result = this.querySelector(`[data-image-result="${task}"]`);
    result.hidden = true;
    let payload;
    try {
      normalizeEndpoint(this.endpoint, this.local);
      if (task === "analyze") {
        if (!this.image) throw new Error("対応する写真を選び、確認が終わってから実行してください。");
        payload = { image: this.image };
      } else payload = { prompt: validatePrompt(this.querySelector("[data-image-prompt]").value) };
    } catch (error) { status.textContent = error.message; return; }
    const controller = new AbortController();
    this.controllers.set(task, controller);
    const timeout = setTimeout(() => controller.abort(), task === "analyze" ? 55000 : 130000);
    form.setAttribute("aria-busy", "true");
    for (const field of form.elements) field.disabled = true;
    status.textContent = task === "analyze" ? "写真を認識しています…" : "画像を生成しています。少し時間がかかります…";
    try {
      const output = await requestImageTask(this.endpoint, task, payload, { signal: controller.signal, local: this.local });
      if (!this.isConnected) return;
      if (task === "analyze") result.querySelector("p").textContent = output;
      else {
        result.querySelector("img").src = output;
        result.querySelector("a").href = output;
        result.querySelector("a").download = "basho-generated." + (output.startsWith("data:image/jpeg;") ? "jpg" : output.startsWith("data:image/webp;") ? "webp" : "png");
      }
      result.hidden = false;
      status.textContent = "完了しました。";
    } catch (error) {
      if (!this.isConnected) return;
      status.textContent = error.name === "AbortError" ? "処理がタイムアウトしました。再試行してください。" : error instanceof ImageServiceError ? error.message : "処理に失敗しました。入力内容と接続設定を確認して再試行してください。";
      button.textContent = task === "analyze" ? "写真の認識を再試行" : "画像生成を再試行";
    } finally {
      clearTimeout(timeout); this.controllers.delete(task);
      if (this.isConnected) {
        form.removeAttribute("aria-busy");
        for (const field of form.elements) field.disabled = false;
      }
    }
  }

  disconnectedCallback() {
    this.selection++;
    for (const controller of this.controllers.values()) controller.abort();
    if (this.previewURL) URL.revokeObjectURL(this.previewURL);
    this.image = null;
  }
}

customElements.define("basho-image-tools", BashoImageTools);
