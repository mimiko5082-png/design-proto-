const STORAGE_KEY = "kotoba_forest_v1";
const screen = document.getElementById("screen");
const toast = document.getElementById("toast");
const tabbar = document.querySelector(".tabbar");

const words = [
  {
    id: "akane",
    word: "茜色",
    reading: "あかねいろ",
    image: "./assets/kotoba-sunset.png",
    place: "夕暮れの川辺",
    short: "夕暮れの空が、やわらかな赤に染まる色。",
    origin:
      "茜は、古くから赤い染料として使われてきた植物の名です。日が沈む前の空や雲に残る、深くやさしい赤を表す言葉になりました。",
    works: [
      ["夏目漱石『三四郎』", "茜色の空が、山の端を染めていた。"],
      ["宮沢賢治『銀河鉄道の夜』", "西の空の光が、頬を追いかけていた。"],
    ],
  },
  {
    id: "kouka",
    word: "紅霞",
    reading: "こうか",
    image: "./assets/kotoba-sunset.png",
    place: "夕方の橋",
    short: "夕焼けにたなびく、あざやかな霞。",
    origin:
      "紅は赤く美しい色、霞は遠くの景色をやわらかく包むもの。空全体が一枚の布のように染まる時に似合う言葉です。",
    works: [
      ["与謝野晶子『みだれ髪』", "紅い雲が、遠い町を静かに包んだ。"],
      ["北原白秋『思ひ出』", "暮れゆく空の色を、胸にしまった。"],
    ],
  },
  {
    id: "tasogare",
    word: "黄昏",
    reading: "たそがれ",
    image: "./assets/kotoba-lake.png",
    place: "水辺の帰り道",
    short: "日は沈み、昼と夜のあいだにある時間。",
    origin:
      "顔が見えにくくなり、誰そ彼とたずねたことに由来するといわれます。景色も気持ちも少しだけ境目に立つ言葉です。",
    works: [
      ["太宰治『津軽』", "町は黄昏の色に沈んでいた。"],
      ["島崎藤村『千曲川のスケッチ』", "川面に夕べの光が残っていた。"],
    ],
  },
  {
    id: "hakumei",
    word: "薄明",
    reading: "はくめい",
    image: "./assets/kotoba-mist.png",
    place: "朝の坂道",
    short: "夜明けや夕暮れの、かすかな光。",
    origin:
      "太陽が地平線の下にあっても、空に淡く残る明るさのこと。はっきりしないからこそ、景色の輪郭をやさしく見せます。",
    works: [
      ["堀辰雄『風立ちぬ』", "薄明のなかで、窓だけが静かに光った。"],
      ["梶井基次郎『檸檬』", "淡い明るさが街の角に残った。"],
    ],
  },
  {
    id: "yoin",
    word: "余韻",
    reading: "よいん",
    image: "./assets/kotoba-forest.png",
    place: "木漏れ日の道",
    short: "残された光や気配が、心に残る感覚。",
    origin:
      "音が鳴り終わったあとにも残る響きから、できごとや景色のあとに心へ残るものも表すようになりました。",
    works: [
      ["川端康成『雪国』", "景色のあとに、静かな気配だけが残った。"],
      ["中原中也『在りし日の歌』", "消えた光のあとにも、胸の奥で響いた。"],
    ],
  },
];

const pollRows = [
  { id: "seihitsu", word: "静謐", reading: "せいひつ", text: "静かで、心が落ち着く。", percent: 38, image: "./assets/kotoba-mist.png" },
  { id: "yoin", word: "余韻", reading: "よいん", text: "あとに残る、やさしい響き。", percent: 26, image: "./assets/kotoba-forest.png" },
  { id: "kyoshu", word: "郷愁", reading: "きょうしゅう", text: "なつかしく、胸があたたかくなる。", percent: 20, image: "./assets/kotoba-lake.png" },
  { id: "yakudo", word: "躍動", reading: "やくどう", text: "いのちが動き出すような感じ。", percent: 16, image: "./assets/kotoba-sunset.png" },
];

const notificationMessages = [
  "いま見ている景色に、まだ知らない言葉があるかもしれません。",
  "森からの合図です。少しだけ空を見上げてみませんか。",
  "今日の景色を、ひとつの言葉で残してみましょう。",
  "いつもの道に、まだ名前のない色があるかもしれません。",
];

const state = {
  view: "home",
  selectedWordId: "akane",
  entries: [],
  notifications: {
    enabled: false,
    date: "",
    times: [],
    sent: [],
    permission: "default",
  },
};

loadState();
ensureDailySchedule();
render();
setInterval(checkDueNotifications, 15000);
document.addEventListener("visibilitychange", checkDueNotifications);

screen.addEventListener("click", (event) => {
  const actionTarget = event.target.closest("[data-action]");
  if (actionTarget) {
    handleAction(actionTarget);
    return;
  }

  const navTarget = event.target.closest("[data-nav]");
  if (navTarget) {
    navigate(navTarget.dataset.nav);
  }
});

tabbar.addEventListener("click", (event) => {
  const target = event.target.closest("[data-nav]");
  if (!target) return;
  navigate(target.dataset.nav);
});

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (Array.isArray(saved.entries)) state.entries = saved.entries;
    if (saved.notifications && typeof saved.notifications === "object") {
      state.notifications = {
        ...state.notifications,
        ...saved.notifications,
        times: Array.isArray(saved.notifications.times) ? saved.notifications.times : [],
        sent: Array.isArray(saved.notifications.sent) ? saved.notifications.sent : [],
      };
    }
    if (typeof saved.selectedWordId === "string") state.selectedWordId = saved.selectedWordId;
    if (typeof saved.view === "string") state.view = saved.view;
  } catch {
    state.view = "home";
  }

  if (!isKnownView(state.view)) state.view = "home";
  if (!getWord(state.selectedWordId)) state.selectedWordId = words[0].id;
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      view: state.view,
      selectedWordId: state.selectedWordId,
      entries: state.entries,
      notifications: state.notifications,
    })
  );
}

function isKnownView(view) {
  return ["home", "camera", "choose", "detail", "poll", "notebook", "map"].includes(view);
}

function navigate(view) {
  if (!isKnownView(view)) return;
  state.view = view;
  saveState();
  render();
}

function render() {
  ensureDailySchedule(false);
  const views = {
    home: renderHome,
    camera: renderCamera,
    choose: renderChoose,
    detail: renderDetail,
    poll: renderPoll,
    notebook: renderNotebook,
    map: renderMap,
  };

  screen.innerHTML = views[state.view]();
  updateTabbar();
}

function updateTabbar() {
  tabbar.hidden = state.view === "camera";
  tabbar.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.nav === state.view || (state.view === "choose" && tab.dataset.nav === "home") || (state.view === "detail" && tab.dataset.nav === "home") || (state.view === "poll" && tab.dataset.nav === "home"));
  });
}

function renderHome() {
  const recent = state.entries.slice(0, 3);
  const recentSection = recent.length
    ? `<section class="recent-section">
        <div class="section-head">
          <h2>最近見つけたことば</h2>
          <button class="link-button" type="button" data-nav="notebook">すべて見る</button>
        </div>
        <div class="recent-grid">
          ${recent.map(renderRecentCard).join("")}
        </div>
      </section>`
    : "";

  return `<div class="view home-view">
    <header class="app-header">
      <button class="icon-button" type="button" aria-label="メニュー">☰</button>
      <div class="brand">
        <span class="brand-kana">ことばの森</span>
        <span class="brand-title">世界を、美しく読む。</span>
      </div>
      <button class="icon-button" type="button" data-action="request-notifications" aria-label="通知">⌁</button>
    </header>

    <section class="hero">
      <img src="./assets/kotoba-hero.png" alt="大きな木と空が広がる森の景色" />
      <div class="hero-content">
        <div class="hero-copy">
          <h1>言葉に出会う</h1>
          <p>写真を撮って、言葉を見つけよう</p>
        </div>
        <button class="primary-button" type="button" data-action="open-camera">景色を撮る</button>
      </div>
    </section>

    ${renderNotificationCard()}
    ${recentSection}
  </div>`;
}

function renderNotificationCard() {
  const times = state.notifications.times.length === 2 ? state.notifications.times : ["--:--", "--:--"];
  const enabled = state.notifications.enabled;
  return `<section class="notification-card">
    <div class="notification-row">
      <div>
        <strong>${enabled ? "今日の森からの合図" : "通知は1日2回ランダム"}</strong>
        <p>${enabled ? "今日のどこかで2回、景色を見る合図が届きます。" : "許可すると、毎日ランダムな2回だけ合図が届きます。"}</p>
        <div class="time-chips" aria-label="今日の通知予定">
          <span class="time-chip">${times[0]}</span>
          <span class="time-chip">${times[1]}</span>
        </div>
      </div>
      <button class="ghost-button" type="button" data-action="request-notifications">${enabled ? "ON" : "受け取る"}</button>
    </div>
  </section>`;
}

function renderRecentCard(entry) {
  return `<button class="recent-card" type="button" data-action="open-entry" data-word-id="${escapeHtml(entry.wordId)}">
    <img src="${escapeHtml(entry.image)}" alt="${escapeHtml(entry.word)}を見つけた景色" />
    <span>${escapeHtml(entry.word)}</span>
  </button>`;
}

function renderCamera() {
  return `<div class="view full-camera">
    <img class="camera-photo" src="./assets/kotoba-sunset.png" alt="撮影している夕暮れの景色" />
    <div class="camera-overlay">
      <div>
        <div class="camera-top">
          <button class="close-button" type="button" data-nav="home" aria-label="閉じる">×</button>
          <button class="camera-flash" type="button" aria-label="フラッシュ">⌁</button>
        </div>
        <div class="camera-prompt">この景色に、どんな言葉があるだろう？</div>
      </div>
      <div class="focus-frame" aria-hidden="true">
        <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>
      </div>
      <div class="camera-bottom">
        <img class="camera-thumb" src="./assets/kotoba-sunset.png" alt="直前の景色" />
        <button class="shutter" type="button" data-action="capture" aria-label="撮影する"></button>
        <span class="camera-icon" aria-hidden="true">▢</span>
      </div>
    </div>
  </div>`;
}

function renderChoose() {
  const selectedId = state.selectedWordId || words[0].id;
  return `<div class="view choose-view">
    <header class="simple-header">
      <button class="back-button" type="button" data-nav="camera" aria-label="戻る">‹</button>
      <h1 class="page-title">この景色を表す言葉</h1>
      <span class="icon-button" aria-hidden="true">5</span>
    </header>
    <div class="photo-card">
      <img src="./assets/kotoba-sunset.png" alt="夕暮れの川辺の景色" />
    </div>
    <div class="word-list">
      ${words.map((word) => renderWordOption(word, selectedId)).join("")}
    </div>
    <div class="action-area">
      <button class="primary-button" type="button" data-action="open-detail">いちばん近い言葉を選ぶ</button>
    </div>
  </div>`;
}

function renderWordOption(word, selectedId) {
  const selected = word.id === selectedId;
  return `<button class="word-option ${selected ? "selected" : ""}" type="button" data-action="select-word" data-word-id="${word.id}">
    <img src="${word.image}" alt="${word.word}の景色" />
    <span>
      <strong>${word.word}<small>（${word.reading}）</small></strong>
      <small>${word.short}</small>
    </span>
    <span class="checkmark" aria-hidden="true">✓</span>
  </button>`;
}

function renderDetail() {
  const word = getSelectedWord();
  return `<div class="view detail-view">
    <header class="simple-header">
      <button class="back-button" type="button" data-nav="choose" aria-label="戻る">‹</button>
      <h1 class="page-title">ことばの世界</h1>
      <button class="icon-button" type="button" data-action="share-word" aria-label="共有">↗</button>
    </header>

    <section class="word-detail-top">
      <img class="detail-photo" src="${word.image}" alt="${word.word}に近い景色" />
      <div class="word-heading">
        <h1>${word.word}</h1>
        <p>${word.reading}　${word.short}</p>
      </div>
    </section>

    <section class="origin-card">
      <div class="card-label">ことばの由来</div>
      <p>${word.origin}</p>
    </section>

    <section class="work-card">
      <div class="card-label">この言葉が使われた作品</div>
      <div class="work-list">
        ${word.works.map((item) => renderWorkItem(item, word.image)).join("")}
      </div>
    </section>

    <div class="action-area">
      <button class="primary-button" type="button" data-action="save-word">このことばを手帳に残す</button>
    </div>
  </div>`;
}

function renderWorkItem(item, image) {
  return `<div class="work-item">
    <img src="${image}" alt="作品に添える景色" />
    <span><strong>${item[0]}</strong><small>「${item[1]}」</small></span>
  </div>`;
}

function renderPoll() {
  return `<div class="view poll-view">
    <header class="simple-header">
      <button class="back-button" type="button" data-nav="detail" aria-label="戻る">‹</button>
      <h1 class="page-title">みんなは、どう感じた？</h1>
      <span class="icon-button" aria-hidden="true">%</span>
    </header>
    <p class="poll-intro">この景色に対して、みんなはどんな言葉を選んでいるでしょう。</p>
    <div class="poll-list">
      ${pollRows.map(renderPollRow).join("")}
    </div>
    <section class="origin-card">
      <div class="card-label">同じ景色でも、感じ方は人それぞれ。</div>
      <p>言葉が増えるほど、世界の見え方が少しずつ豊かになります。</p>
    </section>
    <div class="action-area">
      <button class="primary-button" type="button" data-nav="notebook">ことば帳を見る</button>
    </div>
  </div>`;
}

function renderPollRow(row) {
  return `<div class="poll-row" style="--pct:${row.percent}%">
    <img src="${row.image}" alt="${row.word}の景色" />
    <span><strong>${row.word}<small>（${row.reading}）</small></strong><small>${row.text}</small></span>
    <span class="percent">${row.percent}%</span>
  </div>`;
}

function renderNotebook() {
  const entries = state.entries;
  const list = entries.length
    ? `<div class="book-list">${entries.map(renderBookRow).join("")}</div>`
    : `<section class="empty-card"><p>まだ手帳に残した言葉はありません。</p></section>`;

  return `<div class="view notebook-view">
    <header class="simple-header">
      <button class="back-button" type="button" data-nav="home" aria-label="戻る">‹</button>
      <h1 class="page-title">ことば帳</h1>
      <span class="icon-button" aria-hidden="true">⌕</span>
    </header>
    <div class="filter-pills" aria-label="分類">
      <span class="filter-pill active">すべて</span>
      <span class="filter-pill">自然</span>
      <span class="filter-pill">心</span>
      <span class="filter-pill">時間</span>
      <span class="filter-pill">色</span>
    </div>
    ${list}
  </div>`;
}

function renderBookRow(entry) {
  return `<button class="book-row" type="button" data-action="open-entry" data-word-id="${escapeHtml(entry.wordId)}">
    <img src="${escapeHtml(entry.image)}" alt="${escapeHtml(entry.word)}を見つけた景色" />
    <span>
      <strong>${escapeHtml(entry.word)}<small>（${escapeHtml(entry.reading)}）</small></strong>
      <small>${escapeHtml(entry.short)}<br />${escapeHtml(formatEntryDate(entry.createdAt))}</small>
    </span>
    <span class="leaf-mark" aria-hidden="true">◇</span>
  </button>`;
}

function renderMap() {
  const pins = state.entries.slice(0, 4).map((entry, index) => {
    const positions = [
      ["50%", "33%"],
      ["67%", "51%"],
      ["34%", "58%"],
      ["56%", "70%"],
    ];
    const [x, y] = positions[index];
    return `<button class="map-pin" type="button" style="--x:${x};--y:${y}" data-action="open-entry" data-word-id="${escapeHtml(entry.wordId)}">
      ${escapeHtml(entry.word)}<small>${escapeHtml(entry.place)}</small>
    </button>`;
  });

  return `<div class="view map-view">
    <header class="simple-header">
      <button class="back-button" type="button" data-nav="home" aria-label="戻る">‹</button>
      <h1 class="page-title">ことばの地図</h1>
      <span class="icon-button" aria-hidden="true">⌖</span>
    </header>
    <p class="poll-intro">あなたが出会ったことばが、地図の上に咲いていきます。</p>
    <section class="map-card">
      <img src="./assets/kotoba-map.png" alt="ことばが咲いていく地図" />
      ${pins.join("")}
      ${pins.length ? "" : `<div class="map-empty">まだ地図には何もありません。景色を撮ると、ここに言葉が増えていきます。</div>`}
    </section>
  </div>`;
}

function handleAction(target) {
  const action = target.dataset.action;
  if (action === "open-camera") navigate("camera");
  if (action === "capture") captureScene();
  if (action === "select-word") selectWord(target.dataset.wordId);
  if (action === "open-detail") navigate("detail");
  if (action === "save-word") saveSelectedWord();
  if (action === "open-entry") openEntry(target.dataset.wordId);
  if (action === "request-notifications") requestNotifications();
  if (action === "share-word") shareSelectedWord();
}

function captureScene() {
  state.selectedWordId = "akane";
  saveState();
  if (navigator.vibrate) navigator.vibrate(35);
  navigate("choose");
}

function selectWord(wordId) {
  if (!getWord(wordId)) return;
  state.selectedWordId = wordId;
  saveState();
  render();
}

function openEntry(wordId) {
  if (!getWord(wordId)) return;
  state.selectedWordId = wordId;
  navigate("detail");
}

function saveSelectedWord() {
  const word = getSelectedWord();
  state.entries = [
    {
      entryId: `${word.id}-${Date.now()}`,
      wordId: word.id,
      word: word.word,
      reading: word.reading,
      short: word.short,
      image: word.image,
      place: word.place,
      createdAt: new Date().toISOString(),
    },
    ...state.entries,
  ].slice(0, 40);
  state.view = "poll";
  saveState();
  showToast("ことば帳に残しました。");
  render();
}

function shareSelectedWord() {
  const word = getSelectedWord();
  const text = `ことばの森で「${word.word}」に出会いました。`;
  if (navigator.share) {
    navigator.share({ title: "ことばの森", text }).catch(() => {});
    return;
  }
  navigator.clipboard?.writeText(text);
  showToast("共有用の文章をコピーしました。");
}

function getSelectedWord() {
  return getWord(state.selectedWordId) || words[0];
}

function getWord(id) {
  return words.find((word) => word.id === id);
}

function requestNotifications() {
  ensureDailySchedule();

  if (!("Notification" in window)) {
    state.notifications.enabled = true;
    state.notifications.permission = "unsupported";
    saveState();
    render();
    showToast("今日のランダム通知を設定しました。");
    return;
  }

  if (Notification.permission === "granted") {
    state.notifications.enabled = true;
    state.notifications.permission = "granted";
    saveState();
    render();
    showToast("通知をONにしました。今日はランダムに2回届きます。");
    return;
  }

  if (Notification.permission === "denied") {
    state.notifications.enabled = false;
    state.notifications.permission = "denied";
    saveState();
    render();
    showToast("ブラウザの設定から通知を許可してください。");
    return;
  }

  Notification.requestPermission().then((permission) => {
    state.notifications.permission = permission;
    state.notifications.enabled = permission === "granted";
    saveState();
    render();
    showToast(permission === "granted" ? "通知をONにしました。" : "通知は許可されませんでした。");
  });
}

function ensureDailySchedule(shouldSave = true) {
  const now = new Date();
  const key = getLocalDateKey(now);
  if (state.notifications.date === key && state.notifications.times.length === 2) return;

  const times = generateRandomTimes();
  const nowMinutes = getMinutes(now);
  state.notifications.date = key;
  state.notifications.times = times;
  state.notifications.sent = times.map((time) => timeToMinutes(time) < nowMinutes);
  if (shouldSave) saveState();
}

function generateRandomTimes() {
  const start = 8 * 60 + 30;
  const end = 21 * 60 + 30;
  let first = randomMinute(start, end);
  let second = randomMinute(start, end);
  let guard = 0;
  while (Math.abs(first - second) < 90 && guard < 80) {
    second = randomMinute(start, end);
    guard += 1;
  }
  return [first, second].sort((a, b) => a - b).map(minutesToTime);
}

function randomMinute(start, end) {
  return Math.floor(Math.random() * (end - start + 1)) + start;
}

function checkDueNotifications() {
  ensureDailySchedule();
  if (!state.notifications.enabled) return;

  const now = new Date();
  const nowMinutes = getMinutes(now);
  let changed = false;

  state.notifications.times.forEach((time, index) => {
    if (state.notifications.sent[index]) return;
    if (nowMinutes >= timeToMinutes(time)) {
      state.notifications.sent[index] = true;
      changed = true;
      sendForestNotification(time);
    }
  });

  if (changed) saveState();
}

function sendForestNotification(time) {
  const body = notificationMessages[Math.floor(Math.random() * notificationMessages.length)];
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("ことばの森", {
      body,
      tag: `kotoba-forest-${state.notifications.date}-${time}`,
    });
  }
  showToast(body);
}

function minutesToTime(minutes) {
  const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
  const minute = String(minutes % 60).padStart(2, "0");
  return `${hour}:${minute}`;
}

function timeToMinutes(time) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function getMinutes(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatEntryDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "今日";
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  }[char]));
}
