import { ObservationTimer } from './observation-timer.js';
import { dailyTopic, PREPARED_EXAMPLES } from './haiku-catalog.js';
import { japanDay } from './reading-store.js';
import { preparePhoto, requestHaiku } from './haiku-service.js';
import { makeCard, saveCard } from './haiku-store.js';
const esc = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
class HaikuCards extends HTMLElement {
  connectedCallback() {
    let storage; try { storage = sessionStorage; } catch {}
    this.observation = new ObservationTimer(storage);
    this.day = this.observation.day || japanDay(); this.topic = dailyTopic(this.day);
    this.linesText = this.topic.lines[0] + '\n'; this.showExample = false;
    this.tick = setInterval(() => {
      if (this.observation.startedAt === null || this.observationRevealed) return;
      if (this.observation.ready()) { this.observationRevealed = true; this.render(); }
      else { const counter = this.querySelector('[data-haiku-countdown]'); if (counter) counter.textContent = this.observation.remaining(); }
    }, 250);
    this.message = ''; this.error = ''; this.busy = false; this.saved = false; this.selection = 0;
    this.onChange = event => { if (event.target.matches('[data-haiku-photo]')) this.selectPhoto(event.target.files[0]); };
    this.onClick = event => {
      const action = event.target.closest('[data-haiku-action]')?.dataset.haikuAction;
      if (action === 'observe') { this.observation.start(); this.day = this.observation.day; this.topic = dailyTopic(this.day); this.linesText = this.topic.lines[0] + '\n'; this.render(); }
      if (action === 'example' && this.observation.ready()) { this.showExample = !this.showExample; this.render(); }
      if (action === 'generate') this.generate();
      if (action === 'save') this.save();
    };
    this.onInput = event => { if (event.target.matches('[data-haiku-lines]')) this.linesText = this.topic.lines[0] + '\n' + event.target.value; };
    this.addEventListener('change', this.onChange); this.addEventListener('click', this.onClick); this.addEventListener('input', this.onInput);
    this.render();
  }
  disconnectedCallback() {
    this.controller?.abort(); this.selection++; clearInterval(this.tick);
    this.removeEventListener('change',this.onChange); this.removeEventListener('click',this.onClick); this.removeEventListener('input',this.onInput);
  }
  async selectPhoto(file) {
    if (this.busy || !this.observation.ready()) return;
    const selection = ++this.selection;
    this.draft = null; this.image = null; this.saved = false; this.error = ''; this.message = '';
    if (!file) { this.render(); return; }
    this.busy = true; this.message = '写真を確認しています…'; this.render();
    try {
      const image = await preparePhoto(file);
      if (selection !== this.selection || !this.isConnected) return;
      this.image = image;
      this.message = '写真を選びました。まだAIには送信していません。';
    } catch (error) { this.error = error.message; }
    finally { if (selection === this.selection && this.isConnected) { this.busy = false; this.render(); } }
  }
  async generate() {
    if (!this.image || this.busy || !this.observation.ready()) return;
    this.error = ''; this.message = '写真を見ながら、新しい一句を考えています…'; this.busy = true;
    this.draft = null; this.saved = false; this.render();
    this.controller = new AbortController();
    const timeout = setTimeout(()=>this.controller.abort(),55000);
    try {
      let endpoint = window.BASHO_IMAGES?.endpoint || '';
      try { endpoint = localStorage.getItem('basho_image_endpoint') || endpoint; } catch {}
      const result = await requestHaiku(endpoint, this.image, this.topic.id, { signal: this.controller.signal });
      if (!this.isConnected) return;
      if (result.lines[0] !== this.topic.lines[0]) throw new Error("お題の書き出しに合う提案を受け取れませんでした。もう一度お試しください。");
      this.draft = { id: crypto.randomUUID(), topicId: this.topic.id, topicDay: this.day, aiLines: result.lines, creation: 'photo-ai', observed: result.observed, image: this.image };
      this.linesText = result.lines.join('\n');
      this.message = 'AIの創作案です。自分の言葉に直してから保存できます。';
    } catch (error) {
      if (!this.isConnected) return;
      this.error = error.name === 'AbortError' ? '時間がかかりすぎたため中断しました。もう一度お試しください。' : error.message;
      this.message = '';
    } finally { clearTimeout(timeout); this.busy = false; if (this.isConnected) this.render(); }
  }
  async save() {
    if (!this.image || this.busy || this.saved || !this.observation.ready()) return;
    this.error = ''; this.busy = true;
    try {
      const lines = this.linesText.trim().split(/\r?\n/).map(line=>line.trim());
      if (lines.length !== 3 || lines.some(line=>!line || [...line].length > 40)) throw new Error('俳句を3行で入力してください。各行40文字までです。');
      if (lines[0] !== this.topic.lines[0]) throw new Error('俳句の書き出しは今日のお題のままにしてください。');
      if (!this.draft) this.draft = { id: crypto.randomUUID(), topicId: this.topic.id, topicDay: this.day, aiLines: null, creation: 'user', observed: '', image: this.image };
      const card = makeCard(this.draft, lines);
      this.render();
      const added = await saveCard(card);
      this.saved = true;
      this.message = added ? '読み札を保存しました。＋1ことば。今日のカレンダーにも残りました。' : 'この読み札は保存済みです。';
      window.dispatchEvent(new Event('basho-reading-updated'));
    } catch (error) {
      this.error = error.message.startsWith('俳句を') ? error.message : '読み札を保存できませんでした。ブラウザの保存設定・空き容量を確認し、再試行してください。';
    } finally { this.busy = false; if (this.isConnected) this.render(); }
  }
  render() {
    if (!this.observation.ready()) {
      const running = this.observation.startedAt !== null;
      this.innerHTML = `<section class="haiku-create haiku-observation"><span class="reading-eyebrow">01 · 自分の目と耳で、先に観察</span><h1>まずは、30秒。<br>まわりを見てみよう。</h1><p>スマホを下ろして、光・音・動きに気づく時間。お題は観察が終わってから現れます。</p>${running ? `<div class="haiku-countdown" role="timer" aria-label="観察の残り秒数"><span data-haiku-countdown>${this.observation.remaining()}</span><small>秒 · 画面は見なくて大丈夫</small></div>` : '<button class="main-button" type="button" data-haiku-action="observe">30秒の観察をはじめる</button>'}<p class="reading-help">観察中に操作は必要ありません。30秒たつと、お題と創作画面が開きます。</p></section>`;
      return;
    }
    const example = PREPARED_EXAMPLES[this.topic.id];
    this.innerHTML = `<section class="haiku-create"><header class="reading-intro"><div><span class="reading-eyebrow">02 · 見つけた景色を、ことばに</span><h1>この書き出しから、<br>あなたの一句を。</h1></div></header><article class="reading-poem haiku-topic"><span class="reading-eyebrow">${esc(this.day)} · 今日のお題</span><p class="reading-verse">${esc(this.topic.lines[0])}</p><p class="reading-author">${esc(this.topic.source)} の書き出し</p><p class="haiku-hint">30秒で気づいたものを、あとの七音・五音につなげてみましょう。音数は目安。一語からでも大丈夫です。</p></article><section class="haiku-examples"><button type="button" class="outline-button" data-haiku-action="example" aria-expanded="${this.showExample}">${this.showExample ? 'サンプルを閉じる' : '迷ったら、AIが作ったサンプルを見る'}</button>${this.showExample ? `<article class="reading-poem"><small>AIがあらかじめ作った例 · あなたの写真の解析ではありません</small><p class="reading-verse">${example.map(line=>`<span>${esc(line)}</span>`).join('')}</p><p>たとえば、こんなふうにつなげられます。まねをする必要はありません。</p><small>芭蕉の実作ではありません。サンプルを見るだけでは保存・育成に加算されません。</small></article>` : ''}</section><section class="haiku-photo-box"><label class="haiku-file-label">気づいた景色を一枚、添える<input type="file" data-haiku-photo accept="image/jpeg,image/png,image/webp" ${this.busy?'disabled':''}></label><small>JPEG・PNG・WebP／4MiB・2000万画素以下。写真を選ぶだけではAIに送信しません。</small>${this.image ? `<img class="haiku-photo" src="${this.image}" alt="読み札にする、選択した観察写真">` : ''}</section><section class="haiku-draft"><span class="reading-eyebrow">03 · 自分のことばで、続きを詠む</span><h2>何が心に残りましたか？</h2><p class="haiku-opening">${esc(this.topic.lines[0])}</p><label>続きの2行（各行40文字まで）<textarea data-haiku-lines rows="2" maxlength="81" placeholder="見つけたもの・感じたことを&#10;短いことばで" ${this.busy||this.saved?'disabled':''}>${esc(this.linesText.split('\n').slice(1).join('\n'))}</textarea></label><small>上のお題に、あなたの七音・五音をつなげます。保存には写真を添えてください。</small><button type="button" class="outline-button" data-haiku-action="generate" ${!this.image||this.busy?'disabled':''}>${this.busy?'処理しています…':'写真からAIに続きを提案してもらう（任意）'}</button><p class="reading-help">このボタンを押したときだけ写真とお題を外部AIへ送信。AI案は編集できます。無料枠の上限では停止します。</p>${this.draft?.aiLines ? `<p class="haiku-observed"><strong>写真で見えること（AIの認識）</strong><br>${esc(this.draft.observed)}</p><small>AIによる創作案です。音数や認識には誤りがあり得ます。芭蕉の実作ではありません。</small>` : ''}<button type="button" class="main-button" data-haiku-action="save" ${!this.image||this.busy||this.saved?'disabled':''}>${this.saved?'読み札を保存済み':'この一句で読み札を残す ＋1ことば'}</button>${this.saved?'<button type="button" class="outline-button" data-nav="calendar">今日の読み札を見る →</button>':''}</section><details class="reading-hint"><summary>芭蕉の原句を読む</summary><p class="reading-verse">${this.topic.lines.map(line=>`<span>${esc(line)}</span>`).join('')}</p><small>${esc(this.topic.source)}。新しい句と原句は区別して記録します。</small></details><p class="haiku-status" role="status" aria-live="polite">${esc(this.message)}</p>${this.error?`<p class="reading-error" role="alert">${esc(this.error)}</p>`:''}<p class="reading-help">写真と一句はこのブラウザに保存され、共有句帳には公開されません。未保存の写真・句は画面移動で消えます。</p></section>`;
  }
}
customElements.define('basho-haiku',HaikuCards);
