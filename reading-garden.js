import { buildPhotoAlbums, makeAlbumImage } from './photo-albums.js';
import { loadCards } from './haiku-store.js';
import { topicById } from './haiku-catalog.js';
import { TANKA, poemById } from './tanka-catalog.js';
import { japanDay, loadReads, markRead, growth, growthForCount, monthCells, shiftMonth } from './reading-store.js';
const esc = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
function tree(level) {
  const leaves = [[92,113],[143,95],[88,75],[153,59],[112,35],[68,49],[174,103]];
  return `<svg class="reading-tree" viewBox="0 0 240 200" role="img" aria-label="${esc(['土の中の種','芽が出たところ','双葉','若木','花の咲く木','実のなる木','大きな木'][level])}"><ellipse cx="120" cy="175" rx="75" ry="10" fill="#d8dec9"/>${level === 0 ? '<ellipse cx="120" cy="161" rx="11" ry="7" fill="#9c7552"/>' : `<path d="M120 172 Q116 125 ${level < 2 ? '121 123' : level < 3 ? '120 93' : '120 38'}" fill="none" stroke="#786747" stroke-width="${level > 4 ? 10 : 6}" stroke-linecap="round"/>${leaves.slice(0, level < 2 ? 2 : level < 3 ? 3 : level < 6 ? 5 : 7).map(([x,y], i) => `<path d="M120 ${Math.max(55,y+20)} Q${x} ${y+25} ${x} ${y}" stroke="#786747" stroke-width="3" fill="none"/><ellipse cx="${x}" cy="${y}" rx="${level > 2 ? 23 : 17}" ry="12" transform="rotate(${i%2 ? -30 : 30} ${x} ${y})" fill="${i%2 ? '#78966a' : '#4f7357'}"/>`).join('')}${level >= 4 ? [[85,70],[150,65],[117,35]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="10" fill="${level >= 5 ? '#d58a4b' : '#e8b5b2'}"/><circle cx="${x}" cy="${y}" r="3" fill="#fff0c5"/>`).join('') : ''}<circle cx="114" cy="147" r="2" fill="#383e31"/><circle cx="126" cy="147" r="2" fill="#383e31"/><path d="M116 154 Q120 158 124 154" fill="none" stroke="#383e31" stroke-width="2"/>`}</svg>`;
}
class ReadingGarden extends HTMLElement {
  connectedCallback() {
    this.poemId = TANKA[0].id;
    this.selectedDay = japanDay(); this.month = this.selectedDay.slice(0,7);
    this.message = ''; this.error = ''; this.albumId = null; this.albumPage = 0; this.exportBusy = false;
    this.onClick = event => this.handleClick(event);
    this.onUpdate = () => this.render();
    this.addEventListener('click', this.onClick);
    window.addEventListener('basho-reading-updated', this.onUpdate);
    window.addEventListener('storage', this.onUpdate);
    this.render();
  }
  disconnectedCallback() {
    this.removeEventListener('click', this.onClick);
    window.removeEventListener('basho-reading-updated', this.onUpdate);
    window.removeEventListener('storage', this.onUpdate);
  }
  handleClick(event) {
    const button = event.target.closest('[data-reading-action]');
    if (!button) return;
    const action = button.dataset.readingAction;
    if (action === 'album-open') { this.albumId = button.dataset.album; this.albumPage = 0; this.error = ''; this.message = ''; }
    if (action === 'album-close') { this.albumId = null; this.message = ''; }
    if (action === 'album-page') this.albumPage = Math.max(0, Math.min(6,this.albumPage+Number(button.dataset.delta)));
    if (action === 'album-export') { this.exportAlbum(); return; }
    if (action === 'poem') { this.poemId = button.dataset.poem; this.message = ''; }
    if (action === 'day') this.selectedDay = button.dataset.day;
    if (action === 'month') { this.month = shiftMonth(this.month, Number(button.dataset.delta)); this.selectedDay = `${this.month}-01`; }
    if (action === 'today') { this.selectedDay = japanDay(); this.month = this.selectedDay.slice(0,7); }
    if (action === 'read') {
      try {
        const before = growth(loadReads(localStorage));
        const result = markRead(localStorage, this.poemId);
        const after = growth(result.reads);
        this.error = '';
        this.message = result.added ? (after.level > before.level ? `＋1ことば。${after.stage.name}に育ちました！` : '＋1ことば。今日のカレンダーに残しました。') : 'この短歌は今日のカレンダーに記録済みです。また明日も読めます。';
        window.dispatchEvent(new Event('basho-reading-updated'));
      } catch { this.error = '読書記録を保存できませんでした。ブラウザの保存設定・空き容量を確認し、もう一度お試しください。'; }
    }
    this.render().then(() => {
      if (action === 'album-open') this.querySelector('.album-reader')?.scrollIntoView({block:'start',behavior:'smooth'});
    });
  }
  async render() {
    const revision = (this.revision || 0) + 1; this.revision = revision;
    let cards = [];
    let cardError = '';
    try { cards = await loadCards(); }
    catch { cardError = '読み札の保存領域を開けません。ブラウザの保存設定をご確認ください。'; }
    if (revision !== this.revision || !this.isConnected) return;
    let reads = [];
    try { reads = loadReads(localStorage); }
    catch { this.error = '読書記録を読み込めません。ブラウザの保存設定をご確認ください。既存の記録は上書きしません。'; }
    this.cards = cards;
    const mode = this.getAttribute('mode') || 'home';
    this.photoAlbums = buildPhotoAlbums(cards);
    const { xp, level, stage, next } = growthForCount(reads.length + cards.length);
    const gardenVisual = mode === 'garden' ? this.photoGarden(level) : tree(level);
    const today = japanDay();
    const todayReads = reads.filter(read => read.day === today);
    const todayPhotoSaved = cards.some(card => card.creation === 'photo-challenge' && card.day === today);
    const progress = next ? Math.round((xp-stage.xp)/(next.xp-stage.xp)*100) : 100;
    const garden = `<section class="reading-growth"><div><span class="reading-eyebrow">ことばの庭 · LEVEL ${level+1}</span><h2>${stage.name}</h2><p>${stage.message}</p><strong class="reading-xp">${xp}<small> ことば</small></strong><div class="reading-progress" role="progressbar" aria-label="次の成長まで" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><i style="width:${progress}%"></i></div><small>${next ? `あと${next.xp-xp}ことばで「${next.name}」` : '大樹になっても、ことばの記録は増えていきます。'}</small></div>${gardenVisual}</section>`;
    const help = mode === 'library' ? '<p class="reading-help">「読み終えた」で1ことば。同じ短歌は1日1回育ち、翌日はまた読めます。日付は日本時間です。記録はこのブラウザに保存され、他の端末とは同期しません。</p>' : '<p class="reading-help">保存した読み札1枚で1ことば育ちます。同じ札の保存操作では重複加算しません。以前の短歌の読書記録も成長に残ります。日付は日本時間。写真と俳句はこの端末だけに保存され、閲覧データを削除すると消えます。</p>';
    let content;
    if (mode === 'summary') content = garden;
    else if (mode === 'calendar') {
      const days = monthCells(this.month);
      const selected = reads.filter(read => read.day === this.selectedDay);
      const selectedCards = cards.filter(card => card.day === this.selectedDay);
      content = `<header class="reading-heading"><span class="reading-eyebrow">写真と言葉で残す、日々のまなざし</span><h1>読み札カレンダー</h1><p>同じお題から見つけた、自分だけの景色。</p></header><section class="reading-calendar"><div class="reading-month"><button type="button" data-reading-action="month" data-delta="-1" aria-label="前の月">←</button><h2>${Number(this.month.slice(0,4))}年 ${Number(this.month.slice(5))}月</h2><button type="button" data-reading-action="month" data-delta="1" aria-label="次の月">→</button></div><button class="reading-today" type="button" data-reading-action="today">今日へ</button><div class="reading-week" aria-hidden="true">${'日月火水木金土'.split('').map(day=>`<span>${day}</span>`).join('')}</div><div class="reading-days">${days.map(day => {
        if (!day) return '<span></span>';
        const count = reads.filter(read=>read.day===day).length + cards.filter(card=>card.day===day).length;
        return `<button type="button" class="${day === this.selectedDay ? 'selected' : ''} ${day === today ? 'is-today' : ''}" data-reading-action="day" data-day="${day}" aria-pressed="${day===this.selectedDay}" aria-label="${day}、${count}件${day===today?'、今日':''}"><span>${Number(day.slice(8))}</span><small>${count ? `${count}件` : '·'}</small></button>`;
      }).join('')}</div></section><section class="reading-date-records"><h2>${esc(this.selectedDay.replaceAll('-',' / '))} <small> · ${selected.length + selectedCards.length}件</small></h2>${selectedCards.map(card=>this.haikuCard(card)).join('')}${selected.length ? selected.map(read=>this.poemCard(poemById(read.poemId),false)).join('') : selectedCards.length ? '' : '<p class="reading-empty">この日の読み札はまだありません。<br>お題に合う写真を保存すると、この日に残ります。</p>'}<button class="outline-button" type="button" data-nav="home">今日の読み札をつくる</button></section>${help}`;
    } else if (mode === 'garden') {
      content = `<header class="reading-heading"><span class="reading-eyebrow">あなたと育つ、ことばの庭</span><h1>まなざしを育てる</h1></header>${garden}<div class="reading-stats"><p><strong>${new Set([...reads,...cards].map(read=>read.day)).size}</strong>記録した日</p><p><strong>${cards.length}</strong>集めた読み札</p><p><strong>${todayReads.length + cards.filter(card=>card.day===today).length}</strong>今日のことば</p></div><button class="main-button" type="button" data-nav="home">${todayPhotoSaved ? '今日の写真を保存済み' : '今日の一枚を撮ろう'}</button>${this.albumShelf()}<button class="outline-button" type="button" data-nav="calendar">カレンダーを見る</button>${help}`;
    } else {
      const poem = poemById(this.poemId);
      const done = todayReads.some(read=>read.poemId === poem.id);
      const nextPoem = TANKA.find(item => !todayReads.some(read => read.poemId === item.id));
      content = `${mode === 'library' ? '' : garden}<div class="reading-intro"><div><span class="reading-eyebrow">一首ずつ、景色がひらく</span><h2>今日、読む短歌</h2></div><span class="reading-count">今日 ${todayReads.length}首</span></div>${this.poemCard(poem,true)}<button class="main-button reading-complete" type="button" data-reading-action="read">${done ? '今日の記録済み · もう一度読む' : '読み終えた ＋1ことば'}</button>${done && nextPoem ? `<button class="outline-button reading-next" type="button" data-reading-action="poem" data-poem="${nextPoem.id}">次の短歌を読む →</button>` : done ? `<p class="reading-help">今日の8首を読み終えました。また明日、新しい気持ちで。</p>` : ''}<div class="reading-feedback" role="status" aria-live="polite">${esc(this.message)}</div><details class="reading-library"><summary>ほかの短歌を選ぶ <small>全${TANKA.length}首</small></summary>${TANKA.map(item=>`<button type="button" data-reading-action="poem" data-poem="${item.id}" aria-pressed="${item.id===poem.id}"><span>${item.lines[0]}</span><small>${item.author}${todayReads.some(read=>read.poemId===item.id)?' · 今日の記録済み':''}</small></button>`).join('')}</details><button class="reading-calendar-link" type="button" data-nav="calendar">読んだ日のカレンダーへ →</button>${help}`;
    }
    this.innerHTML = `<div class="reading-feature reading-mode-${mode}">${content}${cardError ? `<p class="reading-error" role="alert">${esc(cardError)}</p>` : ''}${this.error ? `<p class="reading-error" role="alert">${esc(this.error)}</p>` : ''}</div>`;
  }
  photoGarden(level) {
    const photos = this.photoAlbums.photos.slice(-5);
    return `<div class="photo-garden-scene" aria-label="あなたの写真が飾られた庭">${tree(level)}<div class="garden-photo-decorations">${photos.map(card=>`<figure><img src="${esc(card.image)}" alt="${esc(card.day)}に見つけた景色"><figcaption>${esc(card.day.slice(5).replace('-',' / '))}</figcaption></figure>`).join('')}</div>${!photos.length?'<p class="garden-first-photo">最初の一枚を、庭に飾ろう。</p>':''}</div>`;
  }
  albumShelf() {
    const {photos,albums,pending,remaining}=this.photoAlbums;
    const selected=albums.find(album=>album.id===this.albumId);
    const page=selected?.photos[this.albumPage];
    return `<section class="garden-keepsake"><p class="garden-rest-note">休んでも、この庭は枯れません。<br>見つけた景色も、育った分も、ここに残ります。</p><header><span class="reading-eyebrow">7枚で、一冊のたからもの。</span><h2>小さな写真帖</h2><p>いつもの日常で、こんなものを見つけた。</p></header><div class="album-progress"><div class="album-progress-slots" aria-label="次の写真帖まで${pending.length}枚、あと${remaining}枚">${Array.from({length:7},(_,i)=>pending[i]?`<img src="${esc(pending[i].image)}" alt="${esc(pending[i].day)}の写真">`:'<span aria-hidden="true">✧</span>').join('')}</div><strong>あと${remaining}枚で${albums.length?'次の':'最初の'}写真帖ができます</strong><small>連続した日でなくて大丈夫。撮った日が7日分集まると、一冊になります。</small></div>${albums.length?`<div class="album-shelf">${[...albums].reverse().map(album=>`<button type="button" class="album-cover" data-reading-action="album-open" data-album="${esc(album.id)}" aria-label="第${album.number}冊を開く"><img src="${esc(album.photos[0].image)}" alt="第${album.number}冊の表紙"><span><small>7枚の写真と気づき</small><strong>まなざしの写真帖 · 第${album.number}冊</strong><small>${esc(album.start)} 〜 ${esc(album.end)}</small><b>写真帖を開く →</b></span></button>`).join('')}</div>`:'<p class="reading-help">写真が増えると、ここにあなたの写真帖が並びます。</p>'}${selected&&page?`<section class="album-reader" aria-label="第${selected.number}冊の写真帖"><header><div><small>まなざしの写真帖 · 第${selected.number}冊</small><h3>${esc(page.day)}</h3></div><button type="button" data-reading-action="album-close" aria-label="写真帖を閉じる">×</button></header><img class="album-page-photo" src="${esc(page.image)}" alt="${esc(page.day)}に見つけた景色"><p class="album-page-prompt">${esc(page.modern || page.lines?.join(' ') || '')}</p><section class="album-page-note"><small>いつもは気づかなかったこと</small><p>${esc(page.reflection || 'この日のメモはありません。写真だけでも、ひとつの発見。')}</p></section><nav class="album-paging" aria-label="写真帖のページ"><button type="button" data-reading-action="album-page" data-delta="-1" ${this.albumPage===0?'disabled':''}>← 前の写真</button><span>${this.albumPage+1} / 7</span><button type="button" data-reading-action="album-page" data-delta="1" ${this.albumPage===6?'disabled':''}>次の写真 →</button></nav><button type="button" class="main-button" data-reading-action="album-export" ${this.exportBusy?'disabled':''}>${this.exportBusy?'写真帖の画像を作っています…':'7枚の写真帖を画像で保存'}</button><small class="album-export-help">写真と気づきメモを含む1枚の画像になります。保存した画像は好きな相手に送れます。</small><p role="status" class="album-export-status">${esc(this.message)}</p></section>`:''}<small class="garden-album-total">${photos.length}日分の写真 · ${albums.length}冊の写真帖</small></section>`;
  }
  async exportAlbum() {
    const album=this.photoAlbums?.albums.find(item=>item.id===this.albumId);
    if (!album || this.exportBusy) return;
    this.exportBusy=true; this.error=''; this.message=''; this.render();
    try {
      const blob=await makeAlbumImage(album);
      if(!this.isConnected) return;
      const url=URL.createObjectURL(blob), link=document.createElement('a');
      link.href=url; link.download=`basho-photo-album-${album.number}-${album.start}.jpg`; link.click();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      this.message='写真帖の画像を作りました。端末のダウンロードをご確認ください。';
    } catch { this.error='写真帖を画像にできませんでした。もう一度お試しください。'; }
    finally { this.exportBusy=false; if(this.isConnected) this.render(); }
  }
  haikuCard(card) {
    const topic = topicById(card.topicId);
    if (card.creation === 'photo-challenge') return `<article class="reading-poem saved-haiku"><span class="reading-eyebrow">今日の芭蕉フォト · ${esc(card.day)}</span><p class="photo-modern">${esc(card.modern || topic?.modern || '')}</p><img class="haiku-photo" src="${esc(card.image)}" alt="お題に合わせて保存した写真">${card.reflection ? `<section class="photo-reflection-saved"><small>いつもは気づかなかったこと</small><p>${esc(card.reflection)}</p></section>` : ''}<small>原句：${esc(card.original || card.lines.join(' ／ '))} · 松尾芭蕉</small></article>`;
    return `<article class="reading-poem saved-haiku"><span class="reading-eyebrow">あなたの読み札 · ${card.creation === 'user' ? 'あなたが詠んだ一句' : card.edited ? 'AI案をあなたが編集' : 'AIとつくった一句'}</span><img class="haiku-photo" src="${esc(card.image)}" alt="この読み札に保存した写真"><p class="reading-verse">${card.lines.map(line=>`<span>${esc(line)}</span>`).join('')}</p><details class="reading-hint"><summary>お題とAIの提案を見る</summary><p>お題：${esc(topic?.lines.join(' ／ ') || '')}</p><p>${esc(topic?.source || '')} · ${esc(card.topicDay)}</p>${card.aiLines ? `<p>AIの元の案：${card.aiLines.map(esc).join(' ／ ')}</p>` : ''}${card.observed ? `<p>写真で見えること（AIの認識）：${esc(card.observed)}</p>` : ''}<small>新しい一句は創作です。芭蕉の実作ではありません。</small></details></article>`;
  }
  poemCard(poem, full) {
    return `<article class="reading-poem"><span class="reading-eyebrow">小倉百人一首 · 第${poem.number}番</span><p class="reading-verse">${poem.lines.map(line=>`<span>${esc(line)}</span>`).join('')}</p><p class="reading-author">${esc(poem.author)}</p>${full ? `<details class="reading-hint"><summary>読む手がかり</summary><p>${esc(poem.hint)}</p></details>` : ''}</article>`;
  }
}
customElements.define('basho-reading', ReadingGarden);
