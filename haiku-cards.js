import { dailyTopic, topicById } from './haiku-catalog.js';
import { japanDay } from './reading-store.js';
import { preparePhoto } from './haiku-service.js';
import { makeCard, saveCard, loadCards, replaceCardPhoto } from './haiku-store.js';
const esc = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

class HaikuCards extends HTMLElement {
  connectedCallback() {
    this.day = japanDay(); this.topic = dailyTopic(this.day);
    this.reflection = ''; this.noteEdited = false; this.showHint = false; this.noteOpen = false; this.restoring = true;
    this.busy = false; this.message = ''; this.error = ''; this.selection = 0;
    this.onDayCheck = () => this.refreshDay();
    this.dayTimer = setInterval(this.onDayCheck, 1000);
    document.addEventListener('visibilitychange', this.onDayCheck);
    window.addEventListener('focus', this.onDayCheck);
    window.addEventListener('pageshow', this.onDayCheck);
    this.onClick = event => {
      if (this.refreshDay()) return;
      const action = event.target.closest('[data-haiku-action]')?.dataset.haikuAction;
      if (action === 'hint') {
        this.showHint = !this.showHint;
        const button = this.querySelector('[data-haiku-action=hint]');
        button.textContent = this.showHint ? 'ヒントを閉じる' : 'ヒントを見る';
        button.setAttribute('aria-expanded', String(this.showHint));
        this.querySelector('[data-photo-hint]').hidden = !this.showHint;
      }
      if (action === 'retake' && !this.busy && !this.restoring) {
        const input = this.querySelector('[data-haiku-photo]');
        input.value = ''; input.click();
      }
      if (action === 'save') this.save();
      if (action === 'cancel-photo' && !this.busy) { this.image = this.card.image; this.reflection = this.card.reflection || ''; this.message = '写真・メモの変更を取り消しました。'; this.error = ''; this.render(); }
    };
    this.onChange = event => { if (this.refreshDay()) return; if (event.target.matches('[data-haiku-photo]')) this.selectPhoto(event.target.files[0]); };
    this.onInput = event => {
      if (event.target.matches('[data-haiku-reflection]')) { this.reflection = event.target.value; this.noteEdited = true; this.paintDraftControls(); }
    };
    this.onToggle = event => { if (event.target.matches('[data-photo-note]')) this.noteOpen = event.target.open; };
    this.addEventListener('toggle', this.onToggle, true);
    this.addEventListener('input', this.onInput);
    this.addEventListener('click', this.onClick); this.addEventListener('change', this.onChange);
    this.render(); this.restore();
  }
  disconnectedCallback() {
    this.removeEventListener('toggle', this.onToggle, true);
    this.removeEventListener('input', this.onInput);
    clearInterval(this.dayTimer);
    document.removeEventListener('visibilitychange', this.onDayCheck);
    window.removeEventListener('focus', this.onDayCheck);
    window.removeEventListener('pageshow', this.onDayCheck);
    this.selection++; this.removeEventListener('click', this.onClick); this.removeEventListener('change', this.onChange);
  }
  refreshDay() {
    const day = japanDay();
    if (day === this.day) return false;
    this.selection++;
    this.day = day; this.topic = dailyTopic(day); this.showHint = false; this.noteOpen = false; this.restoring = true;
    this.card = null; this.image = null; this.reflection = ''; this.noteEdited = false; this.saved = false; this.busy = false; this.error = '';
    this.message = '新しい日になりました。今日のお題に切り替わりました。昨日までの保存済み写真はカレンダーに残っています。';
    this.render(); this.restore();
    window.dispatchEvent(new Event('basho-reading-updated'));
    return true;
  }
  async restore() {
    const revision = this.selection;
    try {
      const cards = await loadCards();
      if (!this.isConnected || revision !== this.selection) return;
      const card = cards.find(card => card.id === `photo-challenge-${this.day}`);
      if (card) {
        this.card = card; this.image = card.image; if (!this.noteEdited) this.reflection = card.reflection || ''; this.saved = true;
        const savedTopic = topicById(card.topicId);
        if (savedTopic) this.topic = { ...savedTopic, modern: card.modern || savedTopic.modern, original: card.original || savedTopic.original };
      }
    } catch { if (!this.isConnected || revision !== this.selection) return; this.error = '写真の保存領域を開けません。ブラウザの保存設定をご確認ください。'; }
    finally { if (revision === this.selection && this.isConnected) { this.restoring = false; this.render(); } }
  }
  async selectPhoto(file) {
    if (this.busy || this.restoring || !file) return;
    const revision = ++this.selection;
    this.busy = true; this.error = ''; this.render();
    try { const image = await preparePhoto(file); if (revision === this.selection) this.image = image; }
    catch (error) { if (revision === this.selection) this.error = error.message; }
    finally { if (revision === this.selection && this.isConnected) { this.busy = false; this.render(); } }
  }
  async save() {
    if (this.busy || this.restoring || !this.image || (this.saved && !this.hasPendingChanges())) return;
    if (this.refreshDay()) return;
    const revision = this.selection;
    this.busy = true; this.error = ''; this.render();
    try {
      if (this.saved) {
        const updated = await replaceCardPhoto(this.card.id, this.image, this.reflection);
        window.dispatchEvent(new Event('basho-reading-updated'));
        if (revision !== this.selection || !this.isConnected) return;
        const photoChanged = this.image !== this.card.image;
        this.card = updated;
        this.image = this.card.image; this.reflection = this.card.reflection || '';
        this.message = photoChanged ? '写真を変更しました。カレンダーにも反映しました。育成のポイントは変わりません。' : '気づきを保存しました。カレンダーでも見返せます。';
        window.dispatchEvent(new Event('basho-reading-updated'));
        return;
      }
      const draft = { id: `photo-challenge-${this.day}`, topicDay: this.day, topicId: this.topic.id, creation: 'photo-challenge', image: this.image, reflection: this.reflection };
      const card = makeCard(draft, this.topic.lines);
      const added = await saveCard(card);
      // Another tab may have saved today's photo first. Keep that photo as canonical.
      const savedCard = added ? card : (await loadCards()).find(item => item.id === draft.id);
      window.dispatchEvent(new Event('basho-reading-updated'));
      if (revision !== this.selection || !this.isConnected) return;
      this.card = savedCard;
      if (!this.card) throw Error('Save failed');
      this.image = this.card.image; this.reflection = this.card.reflection || ''; this.saved = true;
      this.message = added ? '今日の写真を保存しました。＋1ことば。カレンダーにも残りました。友達の写真の画面でも見返せます。' : '今日の写真は保存済みです。';
      window.dispatchEvent(new Event('basho-reading-updated'));
    } catch { if (revision === this.selection) this.error = '保存できませんでした。空き容量やブラウザの保存設定を確認してください。'; }
    finally { if (revision === this.selection && this.isConnected) { this.busy = false; this.render(); } }
  }
  hasPendingChanges() {
    return !!this.saved && (this.image !== this.card.image || this.reflection.trim() !== (this.card.reflection || ''));
  }
  saveLabel() {
    if (!this.saved) return '送信する';
    if (!this.hasPendingChanges()) return '今日の写真を保存済み';
    return this.image !== this.card.image ? '送信する' : '気づきを保存';
  }
  paintDraftControls() {
    const pending = this.hasPendingChanges();
    const save = this.querySelector('[data-haiku-action="save"]');
    save.textContent = this.saveLabel();
    save.disabled = !this.image || this.busy || (this.saved && !pending);
    for (const node of this.querySelectorAll('[data-pending-edit]')) node.hidden = !pending;
  }
  render() {
    const pending = this.hasPendingChanges();
    this.innerHTML = `<section class="haiku-create photo-capture-home">
    <article class="haiku-topic"><header><span class="reading-eyebrow">${esc(this.day)}</span><h1>今日のお題</h1></header><p class="photo-modern">${esc(this.topic.modern)}</p><div class="photo-topic-options"><button type="button" data-haiku-action="hint" aria-expanded="${this.showHint}" aria-controls="basho-photo-hint">${this.showHint?'ヒントを閉じる':'ヒントを見る'}</button><details><summary>もとの俳句</summary><p class="reading-verse">${esc(this.topic.original || this.topic.lines.join(''))}</p></details></div><p class="haiku-hint" id="basho-photo-hint" data-photo-hint ${this.showHint?'':'hidden'}>${esc(this.topic.photoHint)}</p></article>
    <section class="haiku-photo-box photo-capture-box"><input class="photo-capture-input" id="basho-photo-file" type="file" aria-label="写真を撮る・選ぶ" data-haiku-photo accept="image/jpeg,image/png,image/webp" capture="environment" ${this.busy||this.restoring?'disabled':''}>${this.image?`<img class="haiku-photo" src="${esc(this.image)}" alt="今日のお題に合わせた写真">`:`<label for="basho-photo-file" class="photo-capture-empty"><span aria-hidden="true">📷</span><strong>${this.restoring?'写真を読み込んでいます…':this.busy?'写真を準備しています…':'写真を撮る'}</strong></label>`}</section>
    <div class="photo-capture-actions" ${this.image?'':'hidden'}><button type="button" class="outline-button" data-haiku-action="retake" ${this.busy?'disabled':''}>撮り直す</button><button type="button" class="main-button" data-haiku-action="save" ${!this.image||this.busy||(this.saved&&!pending)?'disabled':''}>${this.saveLabel()}</button></div>
    ${this.image?`<p class="photo-capture-preview-note">プレビュー：送信するを押すと、この端末に保存します。友達への送信は未接続です。</p><details class="photo-reflection-details" data-photo-note ${this.noteOpen?'open':''}><summary>いつもは気づかなかったことを書く（任意）</summary><section class="photo-reflection"><label>いつもは気づかなかったこと <small>（任意）</small><textarea data-haiku-reflection rows="3" maxlength="280" placeholder="いつもの道なのに、葉っぱの影がこんなにきれいだと初めて気づいた。" ${this.busy?'disabled':''}>${esc(this.reflection)}</textarea></label><small>空欄でも大丈夫。280文字までの自分用メモです。</small></section></details>`:''}
    <button type="button" class="outline-button" data-haiku-action="cancel-photo" data-pending-edit ${pending?'':'hidden'}>変更をやめる</button>
    <p class="haiku-status" role="status" aria-live="polite">${esc(this.message)}</p>${this.error?`<p class="reading-error" role="alert">${esc(this.error)}</p>`:''}
    </section>`;
  }
}
customElements.define('basho-haiku', HaikuCards);
