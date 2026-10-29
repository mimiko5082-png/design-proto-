import { dailyTopic } from './haiku-catalog.js';
import { japanDay } from './reading-store.js';
import { preparePhoto } from './haiku-service.js';
import { makeCard, saveCard, loadCards } from './haiku-store.js';
const esc = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

import { sharePhotoCard } from './photo-sharing.js';
class HaikuCards extends HTMLElement {
  connectedCallback() {
    this.day = japanDay(); this.topic = dailyTopic(this.day);
    this.busy = false; this.message = ''; this.error = ''; this.selection = 0;
    this.onClick = event => {
      const action = event.target.closest('[data-haiku-action]')?.dataset.haikuAction;
      if (action === 'save') this.save();
      if (action === 'share') this.share();
      if (action === 'simulate') { this.message = '今日のお題が届きました！ 下のお題に合う景色を撮ってみよう。これはプレビュー内の通知体験です。'; this.render(); }
    };
    this.onChange = event => { if (event.target.matches('[data-haiku-photo]')) this.selectPhoto(event.target.files[0]); };
    this.addEventListener('click', this.onClick); this.addEventListener('change', this.onChange);
    this.render(); this.restore();
  }
  disconnectedCallback() {
    this.selection++; this.removeEventListener('click', this.onClick); this.removeEventListener('change', this.onChange);
  }
  async restore() {
    const revision = this.selection;
    try {
      const cards = await loadCards();
      if (!this.isConnected || revision !== this.selection) return;
      const card = cards.find(card => card.id === `photo-challenge-${this.day}`);
      if (card) { this.card = card; this.image = card.image; this.saved = true; this.render(); }
    } catch { this.error = '写真の保存領域を開けません。ブラウザの保存設定をご確認ください。'; this.render(); }
  }
  async selectPhoto(file) {
    if (this.busy || this.saved || !file) return;
    const revision = ++this.selection;
    this.busy = true; this.error = ''; this.render();
    try { const image = await preparePhoto(file); if (revision === this.selection) this.image = image; }
    catch (error) { this.error = error.message; }
    finally { this.busy = false; if (this.isConnected) this.render(); }
  }
  async save() {
    if (this.busy || this.saved || !this.image) return;
    if (japanDay() !== this.day) { this.error = '日付が変わりました。今日のお題を開き直してください。'; this.render(); return; }
    this.busy = true; this.error = ''; this.render();
    try {
      const draft = { id: `photo-challenge-${this.day}`, topicDay: this.day, topicId: this.topic.id, creation: 'photo-challenge', image: this.image };
      const card = makeCard(draft, this.topic.lines);
      const added = await saveCard(card);
      // Another tab may have saved today's photo first. Keep that photo as canonical.
      this.card = added ? card : (await loadCards()).find(item => item.id === draft.id);
      if (!this.card) throw Error('Save failed');
      this.image = this.card.image; this.saved = true;
      this.message = added ? '今日の写真を保存しました。＋1ことば。カレンダーにも残りました。友達への共有は下のボタンから。' : '今日の写真は保存済みです。';
      window.dispatchEvent(new Event('basho-reading-updated'));
    } catch { this.error = '保存できませんでした。空き容量やブラウザの保存設定を確認してください。'; }
    finally { this.busy = false; if (this.isConnected) this.render(); }
  }
  async share() {
    if (!this.card || this.busy) return;
    this.busy = true;
    try { this.message = await sharePhotoCard(this.card); this.error = ''; }
    catch (error) { if (error.name !== 'AbortError') this.error = '共有画面を開けませんでした。もう一度お試しください。'; }
    finally { this.busy = false; if (this.isConnected) this.render(); }
  }
  render() {
    this.innerHTML = `<section class="haiku-create"><header class="reading-intro"><div><span class="reading-eyebrow">1日1枚 · 芭蕉フォト</span><h1>芭蕉のことばを、<br>今日の一枚に。</h1><p>一日のどこかで、ふいにお題が届く。友達は、同じことばから何を見つけるだろう。</p></div></header>
    <article class="reading-poem haiku-topic"><span class="reading-eyebrow">${esc(this.day)} · 今日の写真のお題</span><p class="photo-modern">${esc(this.topic.modern)}</p><small>芭蕉の俳句を、今のことばで意訳したお題です。</small><p class="haiku-hint">${esc(this.topic.photoHint)}</p><details><summary>もとの俳句を見る</summary><p class="reading-verse">${this.topic.lines.map(line=>`<span>${esc(line)}</span>`).join('')}</p><small>${esc(this.topic.source)}</small></details></article>
    <p>30秒ほど周りを見渡して、お題に合う景色を一枚。俳句を書く必要はありません。</p>
    <section class="haiku-photo-box">${!this.saved ? `<label class="haiku-file-label">お題に合う写真を撮る・選ぶ<input type="file" data-haiku-photo accept="image/jpeg,image/png,image/webp" capture="environment" ${this.busy?'disabled':''}></label><small>JPEG・PNG・WebP／4MiBまで。撮影・選択だけでは誰にも送信されません。</small>` : '<strong>今日の一枚</strong>'}${this.image ? `<img class="haiku-photo" src="${esc(this.image)}" alt="今日のお題に合わせた写真">` : ''}</section>
    <button type="button" class="main-button" data-haiku-action="save" ${!this.image||this.busy||this.saved?'disabled':''}>${this.saved?'今日の写真を保存済み':'今日の一枚を保存 ＋1ことば'}</button>
    ${this.saved ? '<button type="button" class="main-button" data-haiku-action="share">写真とお題を友達に送る</button><button type="button" class="outline-button" data-nav="calendar">写真カレンダーを見る →</button><p class="reading-help">共有先は自分で選べます。LINEなど端末の共有機能を使います。アプリ内の友達限定フィードは準備中です。</p>' : ''}
    <p class="haiku-status" role="status" aria-live="polite">${esc(this.message)}</p>${this.error?`<p class="reading-error" role="alert">${esc(this.error)}</p>`:''}
    <p class="reading-help">同じ日のお題はみんな共通。保存は1日1枚、日本時間です。写真はこのブラウザに残り、共有ボタンを押すまで外部には送信しません。</p>
    ${window.BASHO_PHOTO_PREVIEW ? '<button type="button" class="outline-button" data-haiku-action="simulate">プレビューでお題の通知を体験する</button><p class="reading-help">プレビューでは実際のプッシュ通知は届きません。お題は今すぐ試せます。</p>' : ''}</section>`;
  }
}
customElements.define('basho-haiku', HaikuCards);
