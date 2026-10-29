import { dailyTopic, topicById } from './haiku-catalog.js';
import { japanDay } from './reading-store.js';
import { preparePhoto } from './haiku-service.js';
import { makeCard, saveCard, loadCards, replaceCardPhoto } from './haiku-store.js';
const esc = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

import { sharePhotoCard } from './photo-sharing.js';
class HaikuCards extends HTMLElement {
  connectedCallback() {
    this.day = japanDay(); this.topic = dailyTopic(this.day);
    this.reflection = ''; this.noteEdited = false;
    this.busy = false; this.message = ''; this.error = ''; this.selection = 0;
    this.onDayCheck = () => this.refreshDay();
    this.dayTimer = setInterval(this.onDayCheck, 1000);
    document.addEventListener('visibilitychange', this.onDayCheck);
    window.addEventListener('focus', this.onDayCheck);
    window.addEventListener('pageshow', this.onDayCheck);
    this.onClick = event => {
      if (this.refreshDay()) return;
      const action = event.target.closest('[data-haiku-action]')?.dataset.haikuAction;
      if (action === 'save') this.save();
      if (action === 'cancel-photo' && !this.busy) { this.image = this.card.image; this.reflection = this.card.reflection || ''; this.message = '写真・メモの変更を取り消しました。'; this.error = ''; this.render(); }
      if (action === 'share') this.share();
      if (action === 'simulate') { this.message = '今日のお題が届きました！ 下のお題に合う景色を撮ってみよう。これはプレビュー内の通知体験です。'; this.render(); }
    };
    this.onChange = event => { if (this.refreshDay()) return; if (event.target.matches('[data-haiku-photo]')) this.selectPhoto(event.target.files[0]); };
    this.onInput = event => {
      if (event.target.matches('[data-haiku-reflection]')) { this.reflection = event.target.value; this.noteEdited = true; this.paintDraftControls(); }
    };
    this.addEventListener('input', this.onInput);
    this.addEventListener('click', this.onClick); this.addEventListener('change', this.onChange);
    this.render(); this.restore();
  }
  disconnectedCallback() {
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
    this.day = day; this.topic = dailyTopic(day);
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
        this.render();
      }
    } catch { if (!this.isConnected || revision !== this.selection) return; this.error = '写真の保存領域を開けません。ブラウザの保存設定をご確認ください。'; this.render(); }
  }
  async selectPhoto(file) {
    if (this.busy || !file) return;
    const revision = ++this.selection;
    this.busy = true; this.error = ''; this.render();
    try { const image = await preparePhoto(file); if (revision === this.selection) this.image = image; }
    catch (error) { if (revision === this.selection) this.error = error.message; }
    finally { if (revision === this.selection && this.isConnected) { this.busy = false; this.render(); } }
  }
  async save() {
    if (this.busy || !this.image || (this.saved && !this.hasPendingChanges())) return;
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
      this.message = added ? '今日の写真を保存しました。＋1ことば。カレンダーにも残りました。友達への共有は下のボタンから。' : '今日の写真は保存済みです。';
      window.dispatchEvent(new Event('basho-reading-updated'));
    } catch { if (revision === this.selection) this.error = '保存できませんでした。空き容量やブラウザの保存設定を確認してください。'; }
    finally { if (revision === this.selection && this.isConnected) { this.busy = false; this.render(); } }
  }
  async share() {
    if (!this.card || this.busy || this.hasPendingChanges()) return;
    const revision = this.selection;
    this.busy = true;
    try { const message = await sharePhotoCard(this.card); if (revision === this.selection) { this.message = message; this.error = ''; } }
    catch (error) { if (revision === this.selection && error.name !== 'AbortError') this.error = '共有画面を開けませんでした。もう一度お試しください。'; }
    finally { if (revision === this.selection && this.isConnected) { this.busy = false; this.render(); } }
  }
  hasPendingChanges() {
    return !!this.saved && (this.image !== this.card.image || this.reflection.trim() !== (this.card.reflection || ''));
  }
  saveLabel() {
    if (!this.saved) return '今日の一枚を保存 ＋1ことば';
    if (!this.hasPendingChanges()) return '今日の写真を保存済み';
    return this.image !== this.card.image ? 'この写真に変更' : '気づきを保存';
  }
  paintDraftControls() {
    const pending = this.hasPendingChanges();
    const save = this.querySelector('[data-haiku-action="save"]');
    save.textContent = this.saveLabel();
    save.disabled = !this.image || this.busy || (this.saved && !pending);
    const share = this.querySelector('[data-haiku-action="share"]');
    if (share) share.disabled = pending || this.busy;
    for (const node of this.querySelectorAll('[data-pending-edit]')) node.hidden = !pending;
  }
  render() {
    const pending = this.hasPendingChanges();
    this.innerHTML = `<section class="haiku-create"><header class="reading-intro"><div><span class="reading-eyebrow">1日1枚 · 芭蕉フォト</span><h1>芭蕉のことばを、<br>今日の一枚に。</h1><p>一日のどこかで、ふいにお題が届く。友達は、同じことばから何を見つけるだろう。</p></div></header>
    <article class="reading-poem haiku-topic"><span class="reading-eyebrow">${esc(this.day)} · 今日の写真のお題</span><p class="photo-modern">${esc(this.topic.modern)}</p><small>芭蕉の俳句を、今のことばで意訳したお題です。</small><p class="haiku-hint">${esc(this.topic.photoHint)}</p><details><summary>もとの俳句を見る</summary><p class="reading-verse">${esc(this.topic.original || this.topic.lines.join(''))}</p><small>${esc(this.topic.source)}</small><p><a href="${esc(this.topic.sourceUrl)}" target="_blank" rel="noopener noreferrer">Wikisourceで出典を見る ↗</a></p><small>全集から選んだ60句を日替わりで。原句は掲載本文の表記、現代語訳と撮影ヒントは本アプリによるものです。</small></details></article>
    <p>30秒ほど周りを見渡して、お題に合う景色を一枚。俳句を書く必要はありません。</p>
    <section class="haiku-photo-box"><label class="haiku-file-label">${this.saved?'写真を変更する':'お題に合う写真を撮る・選ぶ'}<input type="file" data-haiku-photo accept="image/jpeg,image/png,image/webp" capture="environment" ${this.busy?'disabled':''}></label><small>JPEG・PNG・WebP／4MiBまで。${this.saved?'選び直したあと「この写真に変更」を押すと差し替わります。':'撮影・選択だけでは誰にも送信されません。'}</small>${this.image ? `<img class="haiku-photo" src="${esc(this.image)}" alt="今日のお題に合わせた写真">` : ''}</section>
    <section class="photo-reflection"><label>いつもは気づかなかったこと <small>（任意）</small><textarea data-haiku-reflection rows="3" maxlength="280" placeholder="いつもの道なのに、葉っぱの影がこんなにきれいだと初めて気づいた。" ${this.busy?'disabled':''}>${esc(this.reflection)}</textarea></label><small>ひとことでも、空欄でも大丈夫。280文字までの自分用メモです。</small></section>
    <button type="button" class="main-button" data-haiku-action="save" ${!this.image||this.busy||(this.saved&&!pending)?'disabled':''}>${this.saveLabel()}</button>
    <button type="button" class="outline-button" data-haiku-action="cancel-photo" data-pending-edit ${pending?'':'hidden'}>変更をやめる</button><p class="reading-help" data-pending-edit ${pending?'':'hidden'}>まだ変更は保存していません。保存すると写真とメモがカレンダーにも反映されます。</p>
    ${this.saved ? `<button type="button" class="main-button" data-haiku-action="share" ${pending||this.busy?'disabled':''}>写真とお題を友達に送る</button><button type="button" class="outline-button" data-nav="calendar">写真カレンダーを見る →</button><p class="reading-help">共有先は自分で選べます。LINEなど端末の共有機能を使います。アプリ内の友達限定フィードは準備中です。</p>` : ''}
    <p class="haiku-status" role="status" aria-live="polite">${esc(this.message)}</p>${this.error?`<p class="reading-error" role="alert">${esc(this.error)}</p>`:''}
    <p class="reading-help">お題は毎日、日本時間の午前0時に切り替わります。同じ日のお題はみんな共通で、昨日とは必ず別のお題。保存は1日1枚です。写真はこのブラウザに残り、共有ボタンを押すまで外部には送信しません。</p>
    ${window.BASHO_PHOTO_PREVIEW ? '<button type="button" class="outline-button" data-haiku-action="simulate">プレビューでお題の通知を体験する</button><p class="reading-help">プレビューでは実際のプッシュ通知は届きません。お題は今すぐ試せます。</p>' : ''}</section>`;
  }
}
customElements.define('basho-haiku', HaikuCards);
