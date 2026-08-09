const STORAGE_KEY = "basho_manazashi_board_v1";
const screen = document.getElementById("screen");
const toast = document.getElementById("toast");
const tabbar = document.querySelector(".tabbar");

const prompts = [
  {
    id: "red",
    title: "赤いものを\n3つ見つける",
    short: "赤いものを3つ見つける",
    note: "街の中で、赤いものを3つ見つけて、その瞬間を覚えておいてください。",
    borrowed: "夕方だけ、この壁が金色になる。",
    category: "色",
  },
  {
    id: "sound",
    title: "聞こえた音を\nひとつ覚える",
    short: "聞こえた音をひとつ覚える",
    note: "いちばん近い音、いちばん遠い音、消えていった音を聞いてください。",
    borrowed: "この道だけ、鳥の声がよく聞こえる。",
    category: "音",
  },
  {
    id: "light",
    title: "光の変わる場所を\n見つける",
    short: "光の変わる場所を見つける",
    note: "影が薄くなる場所、光が止まって見える場所を探してください。",
    borrowed: "雨上がりだけ、石畳が鏡みたいになる。",
    category: "光",
  },
  {
    id: "wind",
    title: "風が抜ける角を\n探す",
    short: "風が抜ける角を探す",
    note: "髪や服が少し動く場所で、一度だけ足を止めてください。",
    borrowed: "この角で、風の向きが変わる。",
    category: "風",
  },
  {
    id: "old",
    title: "古いものと新しいものを\n並べて見る",
    short: "古いものと新しいものを見る",
    note: "ひび、貼り紙、新しい看板。街の時間が重なった場所を見つけてください。",
    borrowed: "古い看板の下に、新しい花が置かれていた。",
    category: "時",
  },
];

const haiku = [
  {
    id: "oldpond",
    promptId: "sound",
    text: "古池や蛙飛びこむ水の音",
    author: "松尾芭蕉",
    note: "芭蕉も「音」から景色を見ていたのかもしれません。",
  },
  {
    id: "silence",
    promptId: "sound",
    text: "閑さや岩にしみ入る蝉の声",
    author: "松尾芭蕉",
    note: "大きな音の奥にある静けさを、耳で見つける一句です。",
  },
  {
    id: "violet",
    promptId: "red",
    text: "山路来て何やらゆかしすみれ草",
    author: "松尾芭蕉",
    note: "足元の小さな色に、歩く速さを合わせる一句です。",
  },
  {
    id: "autumn",
    promptId: "wind",
    text: "秋深き隣は何をする人ぞ",
    author: "松尾芭蕉",
    note: "見えない人の気配まで、街の景色として感じる一句です。",
  },
  {
    id: "grass",
    promptId: "old",
    text: "夏草や兵どもが夢の跡",
    author: "松尾芭蕉",
    note: "今ある草の下に、過ぎた時間を重ねて見る一句です。",
  },
  {
    id: "moon",
    promptId: "light",
    text: "名月や池をめぐりて夜もすがら",
    author: "松尾芭蕉",
    note: "ひとつの光を、角度を変えながら見続ける一句です。",
  },
  {
    id: "sick",
    promptId: "wind",
    text: "旅に病んで夢は枯野をかけ廻る",
    author: "松尾芭蕉",
    note: "体は止まっていても、まなざしだけが歩いていく一句です。",
  },
];

const sampleEntries = [
  {
    id: "sample-1",
    title: "旅に病んで",
    body: "雨の日はもっと濃い。",
    date: "2024.5.12",
    category: "色",
    image: "./assets/kotoba-forest.png",
    promptId: "red",
    x: 52,
    y: 48,
  },
  {
    id: "sample-2",
    title: "風が抜けるたび",
    body: "線路のそばを過ぎたら。",
    date: "2024.5.10",
    category: "風",
    image: "./assets/kotoba-lake.png",
    promptId: "wind",
    x: 31,
    y: 32,
  },
  {
    id: "sample-3",
    title: "この道だけ",
    body: "鳥の声がよく聞こえる。",
    date: "2024.5.8",
    category: "音",
    image: "./assets/kotoba-mist.png",
    promptId: "sound",
    x: 70,
    y: 42,
  },
  {
    id: "sample-4",
    title: "夕方だけ",
    body: "この壁が金色になる。",
    date: "2024.5.7",
    category: "光",
    image: "./assets/kotoba-sunset.png",
    promptId: "light",
    x: 62,
    y: 69,
  },
];

const state = {
  view: "home",
  date: "",
  promptId: "",
  haikuId: "",
  note: "",
  mode: "ことば",
  timerStartedAt: 0,
  entries: [],
  activeEntryId: "sample-4",
};

loadState();
ensureDaily();
render();
setInterval(updateTimer, 1000);

screen.addEventListener("click", (event) => {
  const actionTarget = event.target.closest("[data-action]");
  if (actionTarget) {
    handleAction(actionTarget);
    return;
  }

  const navTarget = event.target.closest("[data-nav]");
  if (navTarget) navigate(navTarget.dataset.nav);
});

screen.addEventListener("input", (event) => {
  if (event.target.matches("[data-note-input]")) {
    state.note = event.target.value.slice(0, 54);
    saveState();
  }
});

tabbar.addEventListener("click", (event) => {
  const target = event.target.closest("[data-nav]");
  if (!target) return;
  navigate(target.dataset.nav);
});

function render() {
  const views = {
    home: renderHome,
    putaway: renderPutAway,
    feel: renderFeel,
    haiku: renderHaiku,
    note: renderNote,
    map: renderMap,
    borrow: renderBorrow,
    notebook: renderNotebook,
  };
  screen.innerHTML = (views[state.view] || views.home)();
  updateTabs();
  updateTimer();
}

function renderHome() {
  const prompt = currentPrompt();
  return `<div class="view home-view">
    <header class="topbar">
      <button class="round-button" type="button" aria-label="メニュー">☰</button>
      <button class="today-chip" type="button" data-action="today">今日の<br>まなざし</button>
    </header>

    <section class="manazashi-card">
      <span class="screen-label">01　まなざしを受け取る</span>
      <div class="ink-branch"></div>
      <h1>${lineBreak(prompt.title)}</h1>
      <i></i>
      <p>${escapeHtml(prompt.note)}</p>
      <button class="main-button" type="button" data-nav="putaway">歩きはじめる</button>
      <div class="page-dots" aria-hidden="true"><span class="active"></span><span></span><span></span><span></span><span></span></div>
    </section>
  </div>`;
}

function renderPutAway() {
  return `<div class="view dark-view putaway-view">
    <section class="photo-screen">
      <span class="screen-label light">02　スマホをしまう</span>
      <div class="dark-cover"></div>
      <div class="putaway-copy">
        <p>では、スマホを<br>しまってください。</p>
        <div class="phone-line" aria-hidden="true"></div>
        <small>10分後に、そっとお知らせします。</small>
      </div>
      <div class="bottom-stack">
        <button class="ghost-link" type="button" data-nav="home">やめる</button>
        <button class="quiet-next" type="button" data-nav="feel">10分後へ</button>
      </div>
    </section>
  </div>`;
}

function renderFeel() {
  const remaining = timerRemaining();
  const progress = 1 - remaining / 30;
  const dash = Math.round(276 * progress);
  return `<div class="view feel-view">
    <header class="minimal-head">
      <button class="x-button" type="button" data-nav="putaway" aria-label="閉じる">×</button>
    </header>
    <section class="feel-paper">
      <span class="screen-label">03　立ち止まり、感じる</span>
      <p>今いる場所で<br>30秒、立ち止まってください。</p>
      <div class="timer-ring" data-el="timer" style="--dash:${dash}">
        <strong>${remaining}</strong>
        <span>秒</span>
      </div>
      <small>風の音、遠くの音、足音、ひとの声。<br>いちばん心に残った音を、ひとつ、覚えておいてください。</small>
      <button class="outline-button" type="button" data-nav="haiku">終わった</button>
    </section>
  </div>`;
}

function renderHaiku() {
  const item = currentHaiku();
  return `<div class="view dark-view haiku-view">
    <section class="haiku-stage">
      <span class="screen-label light">04　芭蕉と出会う</span>
      <div class="haiku-backdrop"></div>
      <article class="haiku-slip">
        <div class="vertical-text">${vertical(item.text)}</div>
        <small>${escapeHtml(item.author)}</small>
        <b>印</b>
      </article>
      <p>${escapeHtml(item.note)}</p>
      <button class="main-button dark-button" type="button" data-action="go-note">次へ</button>
    </section>
  </div>`;
}

function renderNote() {
  const example = currentPrompt().borrowed;
  return `<div class="view note-view">
    <header class="simple-head">
      <button class="back-button" type="button" data-nav="haiku" aria-label="戻る">←</button>
      <button class="menu-dots" type="button" aria-label="メニュー">…</button>
    </header>
    <section class="note-paper">
      <span class="screen-label">05　自分の気づきを残す</span>
      <h2>この場所で、<br>あなたが気づいたことを<br>残してください。</h2>
      <label class="note-input">
        <span>例）${escapeHtml(example)}</span>
        <textarea data-note-input maxlength="54" placeholder="ここに残すことばを書く">${escapeHtml(state.note)}</textarea>
      </label>
      <div class="note-actions">
        <button type="button" data-action="mode" data-mode="ことば">ことばで残す</button>
        <button type="button" data-action="mode" data-mode="俳句">俳句にする</button>
        <button type="button" data-action="mode" data-mode="写真">写真を残す</button>
      </div>
      <button class="main-button" type="button" data-action="save-note">残す</button>
    </section>
  </div>`;
}

function renderMap() {
  const entry = activeEntry();
  const pins = allEntries().map((item) => `<button class="map-dot ${item.id === entry.id ? "active" : ""}" style="left:${item.x}%;top:${item.y}%;" type="button" data-action="open-entry" data-entry-id="${escapeAttr(item.id)}"></button>`).join("");
  return `<div class="view map-view">
    <header class="map-head">
      <span>まなざしの地図</span>
      <button class="round-button" type="button" aria-label="調整">☷</button>
    </header>
    <section class="map-panel">
      <span class="screen-label">06　他の人のまなざしを見る</span>
      <img src="./assets/kotoba-map.png" alt="まなざしの地図" />
      <div class="map-layer"></div>
      ${pins}
      <article class="map-card">
        <img src="${escapeAttr(entry.image || "./assets/kotoba-sunset.png")}" alt="" />
        <div>
          <strong>${escapeHtml(entry.title)}</strong>
          <p>${escapeHtml(entry.body)}</p>
          <small>${escapeHtml(entry.date)}　${escapeHtml(entry.category)}</small>
        </div>
      </article>
    </section>
    <nav class="filter-row">
      <button class="active">すべて</button><button>光</button><button>音</button><button>風</button><button>暮らし</button><button>季節</button>
    </nav>
  </div>`;
}

function renderBorrow() {
  const entry = activeEntry();
  return `<div class="view dark-view borrow-view">
    <section class="borrow-stage">
      <span class="screen-label light">07　誰かのまなざしを借りて歩く</span>
      <button class="back-float" type="button" data-nav="map">←</button>
      <button class="share-float" type="button" aria-label="共有">⇧</button>
      <div class="dark-cover"></div>
      <div class="borrow-copy">
        <small>この人のまなざしを借りて<br>歩いてみましょう。</small>
        <h2>${escapeHtml(entry.title)}<br>${escapeHtml(entry.body)}</h2>
        <p>ここで、その変化を<br>探してみてください。</p>
      </div>
      <button class="main-button dark-button" type="button" data-nav="notebook">この視点で歩きはじめる</button>
    </section>
  </div>`;
}

function renderNotebook() {
  const cards = allEntries().slice(0, 8).map((entry) => `<button class="journal-row" type="button" data-action="open-entry" data-entry-id="${escapeAttr(entry.id)}">
    <img src="${escapeAttr(entry.image || "./assets/kotoba-mist.png")}" alt="" />
    <div>
      <strong>${escapeHtml(entry.title)}</strong>
      <p>${escapeHtml(entry.body)}</p>
      <small>${escapeHtml(entry.date)}</small>
    </div>
    <span>${escapeHtml(entry.category)}</span>
  </button>`).join("");
  return `<div class="view notebook-view">
    <header class="journal-head">
      <div>
        <span>08　句帳にためる</span>
        <h1>わたしの句帳</h1>
      </div>
      <button class="round-button" type="button" aria-label="メニュー">☰</button>
    </header>
    <section class="journal-list">${cards}</section>
  </div>`;
}

function handleAction(target) {
  const action = target.dataset.action;
  if (action === "today") {
    ensureDaily(true);
    render();
  }
  if (action === "mode") {
    state.mode = target.dataset.mode || "ことば";
    showToast(`${state.mode}で残します。`);
    saveState();
  }
  if (action === "save-note") saveNote();
  if (action === "go-note") navigate("note");
  if (action === "open-entry") {
    state.activeEntryId = target.dataset.entryId;
    saveState();
    navigate("borrow");
  }
}

function navigate(view) {
  state.view = view;
  if (view === "feel") state.timerStartedAt = Date.now();
  saveState();
  render();
}

function saveNote() {
  const prompt = currentPrompt();
  const text = state.note.trim() || prompt.borrowed;
  const entry = {
    id: `entry-${Date.now()}`,
    title: text.length > 14 ? `${text.slice(0, 14)}。` : text,
    body: prompt.note.replace("ください。", "ました。"),
    date: formatDate(new Date()),
    category: prompt.category,
    image: "./assets/kotoba-sunset.png",
    promptId: prompt.id,
    x: 30 + ((Date.now() / 17) % 44),
    y: 28 + ((Date.now() / 29) % 48),
  };
  state.entries.unshift(entry);
  state.activeEntryId = entry.id;
  state.note = "";
  saveState();
  showToast("まなざしを残しました。");
  navigate("map");
}

function updateTimer() {
  const target = document.querySelector("[data-el='timer']");
  if (!target) return;
  const remaining = timerRemaining();
  const progress = 1 - remaining / 30;
  target.style.setProperty("--dash", Math.round(276 * progress));
  target.querySelector("strong").textContent = remaining;
}

function timerRemaining() {
  if (!state.timerStartedAt) return 30;
  const elapsed = Math.floor((Date.now() - state.timerStartedAt) / 1000);
  return Math.max(0, 30 - elapsed);
}

function ensureDaily(force = false) {
  const today = todayKey();
  if (!force && state.date === today && state.promptId && state.haikuId) return;
  const prompt = prompts[seededNumber(`${today}-prompt`, prompts.length)];
  const candidates = haiku.filter((item) => item.promptId === prompt.id);
  const list = candidates.length ? candidates : haiku;
  state.date = today;
  state.promptId = prompt.id;
  state.haikuId = list[seededNumber(`${today}-${prompt.id}-haiku`, list.length)].id;
  saveState();
}

function currentPrompt() {
  return prompts.find((prompt) => prompt.id === state.promptId) || prompts[0];
}

function currentHaiku() {
  return haiku.find((item) => item.id === state.haikuId) || haiku[0];
}

function allEntries() {
  return [...state.entries, ...sampleEntries];
}

function activeEntry() {
  return allEntries().find((entry) => entry.id === state.activeEntryId) || allEntries()[0];
}

function updateTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    const nav = tab.dataset.nav;
    const active =
      state.view === nav ||
      (["putaway", "feel", "haiku", "note", "borrow"].includes(state.view) && nav === "walk");
    tab.classList.toggle("active", active);
  });
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    Object.assign(state, saved);
    if (!Array.isArray(state.entries)) state.entries = [];
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function formatDate(date) {
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
}

function seededNumber(value, length) {
  let total = 0;
  for (let i = 0; i < value.length; i += 1) total += value.charCodeAt(i) * (i + 3);
  return total % length;
}

function lineBreak(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function vertical(value) {
  return escapeHtml(value).split("").map((char) => `<span>${char}</span>`).join("");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2100);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
