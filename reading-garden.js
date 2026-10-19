import { TANKA, poemById } from './tanka-catalog.js';
import { japanDay, loadReads, markRead, growth, monthCells, shiftMonth } from './reading-store.js';
const esc = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
function tree(level) {
  const leaves = [[92,113],[143,95],[88,75],[153,59],[112,35],[68,49],[174,103]];
  return `<svg class="reading-tree" viewBox="0 0 240 200" role="img" aria-label="${esc(['土の中の種','芽が出たところ','双葉','若木','花の咲く木','実のなる木','大きな木'][level])}"><ellipse cx="120" cy="175" rx="75" ry="10" fill="#d8dec9"/>${level === 0 ? '<ellipse cx="120" cy="161" rx="11" ry="7" fill="#9c7552"/>' : `<path d="M120 172 Q116 125 ${level < 2 ? '121 123' : level < 3 ? '120 93' : '120 38'}" fill="none" stroke="#786747" stroke-width="${level > 4 ? 10 : 6}" stroke-linecap="round"/>${leaves.slice(0, level < 2 ? 2 : level < 3 ? 3 : level < 6 ? 5 : 7).map(([x,y], i) => `<path d="M120 ${Math.max(55,y+20)} Q${x} ${y+25} ${x} ${y}" stroke="#786747" stroke-width="3" fill="none"/><ellipse cx="${x}" cy="${y}" rx="${level > 2 ? 23 : 17}" ry="12" transform="rotate(${i%2 ? -30 : 30} ${x} ${y})" fill="${i%2 ? '#78966a' : '#4f7357'}"/>`).join('')}${level >= 4 ? [[85,70],[150,65],[117,35]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="10" fill="${level >= 5 ? '#d58a4b' : '#e8b5b2'}"/><circle cx="${x}" cy="${y}" r="3" fill="#fff0c5"/>`).join('') : ''}<circle cx="114" cy="147" r="2" fill="#383e31"/><circle cx="126" cy="147" r="2" fill="#383e31"/><path d="M116 154 Q120 158 124 154" fill="none" stroke="#383e31" stroke-width="2"/>`}</svg>`;
}
class ReadingGarden extends HTMLElement {
  connectedCallback() {
    this.poemId = TANKA[0].id;
    this.selectedDay = japanDay(); this.month = this.selectedDay.slice(0,7);
    this.message = ''; this.error = '';
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
    this.render();
  }
  render() {
    let reads = [];
    try { reads = loadReads(localStorage); }
    catch { this.error = '読書記録を読み込めません。ブラウザの保存設定をご確認ください。既存の記録は上書きしません。'; }
    const mode = this.getAttribute('mode') || 'home';
    const { xp, level, stage, next } = growth(reads);
    const today = japanDay();
    const todayReads = reads.filter(read => read.day === today);
    const progress = next ? Math.round((xp-stage.xp)/(next.xp-stage.xp)*100) : 100;
    const garden = `<section class="reading-growth"><div><span class="reading-eyebrow">ことばの庭 · LEVEL ${level+1}</span><h2>${stage.name}</h2><p>${stage.message}</p><strong class="reading-xp">${xp}<small> ことば</small></strong><div class="reading-progress" role="progressbar" aria-label="次の成長まで" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><i style="width:${progress}%"></i></div><small>${next ? `あと${next.xp-xp}首で「${next.name}」` : '大樹になっても、読書の記録は増えていきます。'}</small></div>${tree(level)}</section>`;
    const help = '<p class="reading-help">「読み終えた」で1ことば。同じ短歌は1日1回育ち、翌日はまた読めます。日付は日本時間です。記録はこのブラウザに保存され、他の端末とは同期しません。</p>';
    let content;
    if (mode === 'calendar') {
      const days = monthCells(this.month);
      const selected = reads.filter(read => read.day === this.selectedDay);
      content = `<header class="reading-heading"><span class="reading-eyebrow">読んだ日の、ことばの記録</span><h1>読書カレンダー</h1><p>一首と出会った日を、振り返る。</p></header><section class="reading-calendar"><div class="reading-month"><button type="button" data-reading-action="month" data-delta="-1" aria-label="前の月">←</button><h2>${Number(this.month.slice(0,4))}年 ${Number(this.month.slice(5))}月</h2><button type="button" data-reading-action="month" data-delta="1" aria-label="次の月">→</button></div><button class="reading-today" type="button" data-reading-action="today">今日へ</button><div class="reading-week" aria-hidden="true">${'日月火水木金土'.split('').map(day=>`<span>${day}</span>`).join('')}</div><div class="reading-days">${days.map(day => {
        if (!day) return '<span></span>';
        const count = reads.filter(read=>read.day===day).length;
        return `<button type="button" class="${day === this.selectedDay ? 'selected' : ''} ${day === today ? 'is-today' : ''}" data-reading-action="day" data-day="${day}" aria-pressed="${day===this.selectedDay}" aria-label="${day}、${count}首${day===today?'、今日':''}"><span>${Number(day.slice(8))}</span><small>${count ? `${count}首` : '·'}</small></button>`;
      }).join('')}</div></section><section class="reading-date-records"><h2>${esc(this.selectedDay.replaceAll('-',' / '))} <small> · ${selected.length}首</small></h2>${selected.length ? selected.map(read=>this.poemCard(poemById(read.poemId),false)).join('') : '<p class="reading-empty">この日の読書記録はまだありません。<br>短歌の「読み終えた」を押すと、読んだ日に残ります。</p>'}<button class="outline-button" type="button" data-nav="home">短歌を読みにいく</button></section>${help}`;
    } else if (mode === 'garden') {
      content = `<header class="reading-heading"><span class="reading-eyebrow">あなたと育つ、ことばの庭</span><h1>まなざしを育てる</h1></header>${garden}<div class="reading-stats"><p><strong>${new Set(reads.map(read=>read.day)).size}</strong>読んだ日</p><p><strong>${new Set(reads.map(read=>read.poemId)).size}</strong>出会った短歌</p><p><strong>${todayReads.length}</strong>今日の読書</p></div><button class="main-button" type="button" data-nav="home">もう一首、読もう</button><button class="outline-button" type="button" data-nav="calendar">カレンダーを見る</button>${help}`;
    } else {
      const poem = poemById(this.poemId);
      const done = todayReads.some(read=>read.poemId === poem.id);
      const nextPoem = TANKA.find(item => !todayReads.some(read => read.poemId === item.id));
      content = `${garden}<div class="reading-intro"><div><span class="reading-eyebrow">一首ずつ、景色がひらく</span><h2>今日、読む短歌</h2></div><span class="reading-count">今日 ${todayReads.length}首</span></div>${this.poemCard(poem,true)}<button class="main-button reading-complete" type="button" data-reading-action="read">${done ? '今日の記録済み · もう一度読む' : '読み終えた ＋1ことば'}</button>${done && nextPoem ? `<button class="outline-button reading-next" type="button" data-reading-action="poem" data-poem="${nextPoem.id}">次の短歌を読む →</button>` : done ? `<p class="reading-help">今日の8首を読み終えました。また明日、新しい気持ちで。</p>` : ''}<div class="reading-feedback" role="status" aria-live="polite">${esc(this.message)}</div><details class="reading-library"><summary>ほかの短歌を選ぶ <small>全${TANKA.length}首</small></summary>${TANKA.map(item=>`<button type="button" data-reading-action="poem" data-poem="${item.id}" aria-pressed="${item.id===poem.id}"><span>${item.lines[0]}</span><small>${item.author}${todayReads.some(read=>read.poemId===item.id)?' · 今日の記録済み':''}</small></button>`).join('')}</details><button class="reading-calendar-link" type="button" data-nav="calendar">読んだ日のカレンダーへ →</button>${help}`;
    }
    this.innerHTML = `<div class="reading-feature reading-mode-${mode}">${content}${this.error ? `<p class="reading-error" role="alert">${esc(this.error)}</p>` : ''}</div>`;
  }
  poemCard(poem, full) {
    return `<article class="reading-poem"><span class="reading-eyebrow">小倉百人一首 · 第${poem.number}番</span><p class="reading-verse">${poem.lines.map(line=>`<span>${esc(line)}</span>`).join('')}</p><p class="reading-author">${esc(poem.author)}</p>${full ? `<details class="reading-hint"><summary>読む手がかり</summary><p>${esc(poem.hint)}</p></details>` : ''}</article>`;
  }
}
customElements.define('basho-reading', ReadingGarden);
