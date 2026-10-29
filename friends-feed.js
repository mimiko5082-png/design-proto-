import { dailyTopic, topicById } from './haiku-catalog.js';
import { japanDay } from './reading-store.js';
import { loadCards } from './haiku-store.js';
import { REACTIONS, loadReactions, toggleReaction, addComment, removeComment } from './friend-reactions.js';
const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const SAMPLES = [
  { id: 'sample-aoi', name: 'あおい', image: './assets/kotoba-forest.png', label: '緑の中で見つけた景色のサンプル', color: '#dce6d6' },
  { id: 'sample-haru', name: 'はる', image: './assets/kotoba-lake.png', label: '水辺で見つけた景色のサンプル', color: '#dce7e5' },
  { id: 'sample-midori', name: 'みどり', image: './assets/kotoba-sunset.png', label: '夕方に見つけた景色のサンプル', color: '#f1dfc8' },
];
class FriendsFeed extends HTMLElement {
  connectedCallback() {
    this.day = japanDay(); this.topic = dailyTopic(this.day);
    this.selected = null; this.commentDrafts = {}; this.status = ''; this.error = ''; this.revision = 0;
    this.onClick = event => this.handleClick(event);
    this.onInput = event => { if (event.target.matches('[data-friend-comment]')) this.commentDrafts[this.selected] = event.target.value; };
    this.onSubmit = event => { if (event.target.matches('[data-friend-comment-form]')) { event.preventDefault(); this.comment(); } };
    this.onRefresh = () => this.refresh();
    this.onDayCheck = () => { if (japanDay() !== this.day) this.refresh(); };
    this.addEventListener('click', this.onClick); this.addEventListener('input', this.onInput); this.addEventListener('submit', this.onSubmit);
    window.addEventListener('basho-reading-updated', this.onRefresh); window.addEventListener('storage', this.onRefresh);
    window.addEventListener('focus', this.onDayCheck); document.addEventListener('visibilitychange', this.onDayCheck);
    this.timer = setInterval(this.onDayCheck, 1000);
    this.refresh();
  }
  disconnectedCallback() {
    this.revision++; clearInterval(this.timer);
    this.removeEventListener('click', this.onClick); this.removeEventListener('input', this.onInput); this.removeEventListener('submit', this.onSubmit);
    window.removeEventListener('basho-reading-updated', this.onRefresh); window.removeEventListener('storage', this.onRefresh);
    window.removeEventListener('focus', this.onDayCheck); document.removeEventListener('visibilitychange', this.onDayCheck);
  }
  async refresh() {
    const revision = ++this.revision;
    const day = japanDay();
    if (day !== this.day) { this.selected = null; this.commentDrafts = {}; this.status = ''; this.error = ''; }
    this.day = day; this.topic = dailyTopic(day); this.own = null;
    try {
      const cards = await loadCards();
      if (revision !== this.revision || !this.isConnected) return;
      this.own = cards.find(card => card.creation === 'photo-challenge' && card.day === day) || null;
      if (this.own) this.topic = { ...(topicById(this.own.topicId) || this.topic), modern: this.own.modern || this.topic.modern };
      this.loadError = '';
    } catch { this.loadError = '自分の写真を読み込めませんでした。保存設定をご確認ください。'; }
    if (revision === this.revision && this.isConnected) this.render();
  }
  handleClick(event) {
    const button = event.target.closest('[data-friend-action]');
    if (!button) return;
    if (japanDay() !== this.day) { this.refresh(); return; }
    const action = button.dataset.friendAction;
    if (action === 'open') { this.selected = button.dataset.post; this.error = ''; this.status = ''; this.render(); this.querySelector('.friend-detail')?.scrollIntoView({block:'start',behavior:'smooth'}); }
    if (action === 'close') { this.selected = null; this.error = ''; this.render(); }
    if (action === 'phrase') {
      this.commentDrafts[this.selected] = button.dataset.phrase;
      const input = this.querySelector('[data-friend-comment]'); if (input) { input.value = button.dataset.phrase; input.focus(); }
    }
    if (action === 'stamp') this.mutate(() => toggleReaction(localStorage, this.day, this.topic.id, this.selected, button.dataset.stamp), 'リアクションをこの端末に保存しました。もう一度押すと取り消せます。');
    if (action === 'delete') this.mutate(() => removeComment(localStorage, this.day, this.topic.id, this.selected, button.dataset.comment), 'ひとことを取り消しました。');
  }
  mutate(operation, message) {
    if (!window.BASHO_FRIENDS_PREVIEW || !SAMPLES.some(post => post.id === this.selected)) return;
    try { operation(); this.error = ''; this.status = message; }
    catch { this.error = '保存できませんでした。保存設定や空き容量をご確認ください。'; this.status = ''; }
    this.render();
  }
  comment() {
    if (japanDay() !== this.day) { this.refresh(); return; }
    const text = this.commentDrafts[this.selected] || '';
    if (!text.trim()) { this.error = 'ひとことを入力するか、定型文を選んでください。'; this.render(); return; }
    this.mutate(() => { addComment(localStorage, this.day, this.topic.id, this.selected, text); this.commentDrafts[this.selected] = ''; }, 'ひとことをこの端末に保存しました。プレビューなので友達には送信されません。');
  }
  detail(post) {
    let reactions = {stamps:[],comments:[]}, storageError = '';
    try { reactions = loadReactions(localStorage, this.day, this.topic.id, post.id); }
    catch { storageError = 'リアクションの保存領域を読み込めません。'; }
    return `<section class="friend-detail" aria-label="${esc(post.name)}の写真へのリアクション"><header><div><span class="friend-avatar" style="background:${post.color}">${esc(post.name[0])}</span><strong>${esc(post.name)}</strong><small>サンプル</small></div><button type="button" class="friend-close" data-friend-action="close" aria-label="写真を閉じる">×</button></header><img class="friend-large-photo" src="${post.image}" alt="${esc(post.label)}"><p class="friend-sample-caption">写真が並ぶ画面の体験用サンプル画像です。</p><h3>どんなふうに感じた？</h3><div class="friend-stamps">${REACTIONS.map(stamp=>`<button type="button" data-friend-action="stamp" data-stamp="${stamp.id}" aria-pressed="${reactions.stamps.includes(stamp.id)}" aria-label="${stamp.label}" class="${reactions.stamps.includes(stamp.id)?'is-reacted':''}"><span>${stamp.emoji}</span><small>${stamp.label}</small>${reactions.stamps.includes(stamp.id)?'<b>1</b>':''}</button>`).join('')}</div><p class="reading-help">好きなスタンプを選んでね。もう一度押すと取り消せます。</p><h3>ひとことかける</h3><div class="friend-phrases">${['その見方すき','同じの見つけた','なるほど！'].map(text=>`<button type="button" data-friend-action="phrase" data-phrase="${text}">${text}</button>`).join('')}</div><form data-friend-comment-form><label>あなたのひとこと<textarea data-friend-comment rows="2" maxlength="120" placeholder="同じお題から、こんな景色が見えるんだ！">${esc(this.commentDrafts[post.id] || '')}</textarea></label><button type="submit" class="main-button">ひとことを残す</button><small>120文字まで。プレビューではこの端末だけに保存します。</small></form><ul class="friend-comments" aria-label="写真へのひとこと">${reactions.comments.map(comment=>`<li><span class="friend-comment-author">あなた · プレビュー</span><p>${esc(comment.text)}</p><button type="button" data-friend-action="delete" data-comment="${esc(comment.id)}" aria-label="このひとことを取り消す">取り消す</button></li>`).join('')}</ul>${storageError?`<p class="reading-error">${storageError}</p>`:''}</section>`;
  }
  render() {
    const preview = !!window.BASHO_FRIENDS_PREVIEW;
    const selected = SAMPLES.find(post => post.id === this.selected);
    this.innerHTML = `<section class="friends-feature"><header class="reading-heading"><span class="reading-eyebrow">同じことば、ちがうまなざし。</span><h1>友達の写真</h1><p>あなたは、どんな一枚を見つけた？</p></header><article class="friends-prompt"><small>${esc(this.day)} · みんな共通のお題</small><p>${esc(this.topic.modern)}</p></article>${preview?'<aside class="friends-preview-note"><strong>友達の写真のプレビュー</strong><p>友達の画像はサンプルです。実際の友達とは未接続で、ひとこと・スタンプはこの端末だけに保存されます。</p></aside>':'<p class="reading-help">友達との接続は準備中です。写真はまだ公開されていません。</p>'}<div class="friend-photo-grid">${this.own?`<article class="friend-own-photo"><img src="${esc(this.own.image)}" alt="今日のお題で撮った自分の写真"><div><strong>あなた</strong><small>この端末の写真</small></div></article>`:''}${preview?SAMPLES.map(post=>`<button type="button" class="friend-photo-tile ${post.id===this.selected?'selected':''}" data-friend-action="open" data-post="${post.id}" aria-label="${post.name}のサンプル写真を見る" aria-pressed="${post.id===this.selected}"><img src="${post.image}" alt="${esc(post.label)}"><span><strong>${esc(post.name)}</strong><small>サンプル · リアクションする →</small></span></button>`).join(''):''}</div>${!this.own?'<p class="reading-help">今日の写真を保存すると、あなたの一枚もここに並びます。自分用の気づきメモは表示しません。</p><button type="button" class="outline-button" data-nav="home">今日の一枚を撮る</button>':''}${preview&&!selected?'<p class="friend-tap-help">写真をタップして、ひとことやスタンプを添えてみよう。</p>':''}${preview&&selected?this.detail(selected):''}<p class="friend-status" role="status" aria-live="polite">${esc(this.status)}</p>${this.error?`<p class="reading-error" role="alert">${esc(this.error)}</p>`:''}${this.loadError?`<p class="reading-error" role="alert">${esc(this.loadError)}</p>`:''}</section>`;
  }
}
customElements.define('basho-friends',FriendsFeed);
