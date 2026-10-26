import { japanDay, loadPoems, savePoem, growth, monthCells, shiftMonth } from './reading-store.js?v=47';
const esc = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
function tree(level) {
  const leaves = [[92,113],[143,95],[88,75],[153,59],[112,35],[68,49],[174,103]];
  return `<svg class="reading-tree" viewBox="0 0 240 200" role="img" aria-label="${esc(['土の中の種','芽が出たところ','双葉','若木','花の咲く木','実のなる木','大きな木'][level])}"><ellipse cx="120" cy="175" rx="75" ry="10" fill="#d8dec9"/>${level === 0 ? '<ellipse cx="120" cy="161" rx="11" ry="7" fill="#9c7552"/>' : `<path d="M120 172 Q116 125 ${level < 2 ? '121 123' : level < 3 ? '120 93' : '120 38'}" fill="none" stroke="#786747" stroke-width="${level > 4 ? 10 : 6}" stroke-linecap="round"/>${leaves.slice(0, level < 2 ? 2 : level < 3 ? 3 : level < 6 ? 5 : 7).map(([x,y], i) => `<path d="M120 ${Math.max(55,y+20)} Q${x} ${y+25} ${x} ${y}" stroke="#786747" stroke-width="3" fill="none"/><ellipse cx="${x}" cy="${y}" rx="${level > 2 ? 23 : 17}" ry="12" transform="rotate(${i%2 ? -30 : 30} ${x} ${y})" fill="${i%2 ? '#78966a' : '#4f7357'}"/>`).join('')}${level >= 4 ? [[85,70],[150,65],[117,35]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="10" fill="${level >= 5 ? '#d58a4b' : '#e8b5b2'}"/><circle cx="${x}" cy="${y}" r="3" fill="#fff0c5"/>`).join('') : ''}<circle cx="114" cy="147" r="2" fill="#383e31"/><circle cx="126" cy="147" r="2" fill="#383e31"/><path d="M116 154 Q120 158 124 154" fill="none" stroke="#383e31" stroke-width="2"/>`}</svg>`;
}
class ReadingGarden extends HTMLElement {
  connectedCallback() {
    this.selectedDay = japanDay(); this.month = this.selectedDay.slice(0,7);
    this.draft = ''; this.draftDay = this.selectedDay;
    this.message = ''; this.error = '';
    this.onClick = event => this.handleClick(event);
    this.onInput = event => {
      if (event.target.name === 'poem') this.draft = event.target.value;
      if (event.target.name === 'day') this.draftDay = event.target.value;
    };
    this.onSubmit = event => {
      if (!event.target.matches('.tanka-form')) return;
      event.preventDefault();
      this.save(event.target);
    };
    this.onUpdate = () => this.render();
    this.addEventListener('click', this.onClick);
    this.addEventListener('input', this.onInput);
    this.addEventListener('submit', this.onSubmit);
    window.addEventListener('basho-poems-updated', this.onUpdate);
    window.addEventListener('storage', this.onUpdate);
    this.render();
  }
  disconnectedCallback() {
    this.removeEventListener('click', this.onClick);
    this.removeEventListener('input', this.onInput);
    this.removeEventListener('submit', this.onSubmit);
    window.removeEventListener('basho-poems-updated', this.onUpdate);
    window.removeEventListener('storage', this.onUpdate);
  }
  handleClick(event) {
    const button = event.target.closest('[data-reading-action]');
    if (!button) return;
    const action = button.dataset.readingAction;
    if (action === 'day') { this.selectedDay = button.dataset.day; this.draftDay = this.selectedDay; }
    if (action === 'month') { this.month = shiftMonth(this.month, Number(button.dataset.delta)); this.selectedDay = `${this.month}-01`; this.draftDay = this.selectedDay; }
    if (action === 'today') { this.selectedDay = japanDay(); this.month = this.selectedDay.slice(0,7); this.draftDay = this.selectedDay; }
    this.message = '';
    this.render();
  }
  save(form) {
    const data = new FormData(form);
    this.draft = String(data.get('poem') || '');
    this.draftDay = String(data.get('day') || '');
    try {
      const before = growth(loadPoems(localStorage));
      const result = savePoem(localStorage, {text: this.draft, day: this.draftDay});
      const after = growth(result.poems);
      this.error = '';
      this.message = result.added ? (after.level > before.level ? `累計${after.xp}首。${after.stage.name}に育ちました！` : '自分で詠んだ短歌をカレンダーに記録しました。') : 'この日の同じ短歌は、すでに記録されています。';
      this.selectedDay = this.draftDay; this.month = this.draftDay.slice(0,7);
      this.draft = '';
      window.dispatchEvent(new Event('basho-poems-updated'));
    } catch {
      this.error = '短歌を保存できませんでした。入力内容とブラウザの保存設定・空き容量を確認し、もう一度お試しください。';
      this.render();
    }
  }
  composer() {
    return `<form class="tanka-form"><div class="reading-intro"><div><span class="reading-eyebrow">見つけた景色を、自分の言葉に</span><h2>短歌を記録する</h2></div></div><p class="reading-help">目の前の景色や、そこで感じたことを短歌にして残してみましょう。</p><label>詠んだ日<input type="date" name="day" value="${esc(this.draftDay)}" required></label><label>自分で詠んだ短歌<textarea name="poem" rows="5" maxlength="500" required placeholder="見た景色、聞こえた音、感じたことを一首に。改行して入力できます。">${esc(this.draft)}</textarea></label><button class="main-button" type="submit">カレンダーに記録する</button></form><div class="reading-feedback" role="status" aria-live="polite">${esc(this.message)}</div>`;
  }
  render() {
    let poems = [];
    try { poems = loadPoems(localStorage); }
    catch { this.error = '短歌の記録を読み込めません。ブラウザの保存設定をご確認ください。既存の記録は上書きしません。'; }
    const mode = this.getAttribute('mode') || 'home';
    const { xp, level, stage, next } = growth(poems);
    const today = japanDay();
    const todayPoems = poems.filter(poem => poem.day === today);
    const progress = next ? Math.round((xp-stage.xp)/(next.xp-stage.xp)*100) : 100;
    const garden = `<section class="reading-growth"><div><span class="reading-eyebrow">ことばの庭 · LEVEL ${level+1}</span><h2>${stage.name}</h2><p>${stage.message}</p><strong class="reading-xp">${xp}<small> 首 詠んだ</small></strong><div class="reading-progress" role="progressbar" aria-label="次の成長まで" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><i style="width:${progress}%"></i></div><small>${next ? `あと${next.xp-xp}首で「${next.name}」` : '大樹になっても、短歌の記録は増えていきます。'}</small></div>${tree(level)}</section>`;
    const help = '<p class="reading-help">自分で詠んだ短歌を5首記録するごとに、種から芽、双葉、若木、花、実、大樹へと育ちます。日付は日本時間です。記録はこのブラウザに保存され、他の端末とは同期しません。</p>';
    let content;
    if (mode === 'calendar') {
      const days = monthCells(this.month);
      const selected = poems.filter(poem => poem.day === this.selectedDay);
      content = `<header class="reading-heading"><span class="reading-eyebrow">景色から生まれた、ことばの記録</span><h1>短歌カレンダー</h1><p>自分で詠んだ一首と、その日の景色を振り返る。</p></header><section class="reading-calendar"><div class="reading-month"><button type="button" data-reading-action="month" data-delta="-1" aria-label="前の月">←</button><h2>${Number(this.month.slice(0,4))}年 ${Number(this.month.slice(5))}月</h2><button type="button" data-reading-action="month" data-delta="1" aria-label="次の月">→</button></div><button class="reading-today" type="button" data-reading-action="today">今日へ</button><div class="reading-week" aria-hidden="true">${'日月火水木金土'.split('').map(day=>`<span>${day}</span>`).join('')}</div><div class="reading-days">${days.map(day => {
        if (!day) return '<span></span>';
        const count = poems.filter(poem=>poem.day===day).length;
        return `<button type="button" class="${day === this.selectedDay ? 'selected' : ''} ${day === today ? 'is-today' : ''}" data-reading-action="day" data-day="${day}" aria-pressed="${day===this.selectedDay}" aria-label="${day}、${count}首${day===today?'、今日':''}"><span>${Number(day.slice(8))}</span><small>${count ? `${count}首` : '·'}</small></button>`;
      }).join('')}</div></section><section class="reading-date-records"><h2>${esc(this.selectedDay.replaceAll('-',' / '))} <small> · ${selected.length}首</small></h2>${selected.length ? selected.map(poem=>this.poemCard(poem)).join('') : '<p class="reading-empty">この日に詠んだ短歌はまだありません。<br>景色を見て生まれた一首を、下の欄から記録できます。</p>'}</section>${this.composer()}${help}`;
    } else if (mode === 'garden') {
      content = `<header class="reading-heading"><span class="reading-eyebrow">あなたと育つ、ことばの庭</span><h1>まなざしを育てる</h1></header>${garden}<div class="reading-stats"><p><strong>${new Set(poems.map(poem=>poem.day)).size}</strong>詠んだ日</p><p><strong>${poems.length}</strong>詠んだ短歌</p><p><strong>${todayPoems.length}</strong>今日の短歌</p></div><button class="outline-button" type="button" data-nav="calendar">カレンダーを見る</button>${help}`;
    } else {
      content = `${garden}<button class="reading-calendar-link" type="button" data-nav="calendar">詠んだ短歌のカレンダーへ →</button>${help}`;
    }
    this.innerHTML = `<div class="reading-feature reading-mode-${mode}">${content}${this.error ? `<p class="reading-error" role="alert">${esc(this.error)}</p>` : ''}</div>`;
  }
  poemCard(poem) {
    return `<article class="reading-poem"><span class="reading-eyebrow">自分で詠んだ短歌</span><p class="reading-verse">${poem.text.split('\n').map(line=>`<span>${esc(line)}</span>`).join('')}</p></article>`;
  }
}
customElements.define('basho-reading', ReadingGarden);
