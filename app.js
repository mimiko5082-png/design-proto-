const STORAGE_KEY = "kotoba_forest_v1";
const screen = document.getElementById("screen");
const toast = document.getElementById("toast");
const tabbar = document.querySelector(".tabbar");

let cameraStream = null;
let cameraToken = 0;

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

const extraWords = [
  {
    id: "yuubae",
    word: "夕映え",
    reading: "ゆうばえ",
    image: "./assets/kotoba-sunset.png",
    place: "夕方の空",
    short: "夕日の光で、景色が美しく照り輝くこと。",
    origin: "夕方の光が建物や雲に映えて、いつもの景色を少し特別に見せる時に使われる言葉です。明るさの終わり際に残る美しさを含んでいます。",
    works: [["島崎藤村『千曲川のスケッチ』", "夕映えのなかで、川面は淡く光っていた。"], ["国木田独歩『武蔵野』", "野の色が夕日の中で静かに映えた。"]],
  },
  {
    id: "komorebi",
    word: "木漏れ日",
    reading: "こもれび",
    image: "./assets/kotoba-forest.png",
    place: "木の下の道",
    short: "木々の間からこぼれる、やわらかな光。",
    origin: "木の葉のすきまを通って地面に届く日の光を表す言葉です。光そのものだけでなく、葉の揺れや風の気配まで一緒に思い出させます。",
    works: [["国木田独歩『武蔵野』", "林の中に、細かな光が落ちていた。"], ["宮沢賢治『注文の多い料理店』", "木々の影が、明るい斑点をつくった。"]],
  },
  {
    id: "ryokuin",
    word: "緑陰",
    reading: "りょくいん",
    image: "./assets/kotoba-forest.png",
    place: "緑の木陰",
    short: "青々とした木々がつくる、涼しい影。",
    origin: "夏の強い光のなかで、草木の緑がつくる陰を表します。涼しさや休む場所の感覚も一緒に持った言葉です。",
    works: [["正岡子規『墨汁一滴』", "緑陰に腰をおろし、風を待った。"], ["寺田寅彦『柿の種』", "葉の影が、庭に濃く落ちていた。"]],
  },
  {
    id: "sokyu",
    word: "蒼穹",
    reading: "そうきゅう",
    image: "./assets/kotoba-lake.png",
    place: "広い空",
    short: "青く高く広がる空。",
    origin: "蒼は深い青、穹は弓なりに広がる空のこと。見上げた時に空の高さまで感じるような写真に向いています。",
    works: [["萩原朔太郎『月に吠える』", "蒼い空が、遠くまで張りつめていた。"], ["宮沢賢治『春と修羅』", "高い空の奥へ、光が吸い込まれた。"]],
  },
  {
    id: "seicho",
    word: "清澄",
    reading: "せいちょう",
    image: "./assets/kotoba-lake.png",
    place: "澄んだ水辺",
    short: "空気や水が、澄んで清らかなこと。",
    origin: "濁りがなく、すっきりと澄んでいる様子を表します。青空、水面、朝の光など、透明感のある景色に合う言葉です。",
    works: [["志賀直哉『暗夜行路』", "清澄な空気が、胸の奥まで届いた。"], ["芥川龍之介『蜜柑』", "明るく澄んだ景色が窓の外に広がった。"]],
  },
  {
    id: "shigure",
    word: "時雨",
    reading: "しぐれ",
    image: "./assets/kotoba-mist.png",
    place: "雨の通り道",
    short: "降ったり止んだりする、静かな通り雨。",
    origin: "短く降っては止む雨を表す言葉です。暗い空や濡れた道、少し冷たい空気の写真に寄り添います。",
    works: [["松尾芭蕉 俳句", "初しぐれ、空の気配が変わっていく。"], ["泉鏡花『高野聖』", "雨の音だけが、山道に残った。"]],
  },
  {
    id: "kirameki",
    word: "煌めき",
    reading: "きらめき",
    image: "./assets/kotoba-lake.png",
    place: "光る水面",
    short: "小さな光が、きらきらと瞬くこと。",
    origin: "光が細かく反射して、一瞬ごとに表情を変える様子を表します。水面、窓、夜景、強い日差しの写真に似合います。",
    works: [["谷崎潤一郎『陰翳礼讃』", "光は、暗がりの中で細くきらめいた。"], ["小川未明『赤いろうそくと人魚』", "海の面が小さく光った。"]],
  },
  {
    id: "kageboshi",
    word: "影法師",
    reading: "かげぼうし",
    image: "./assets/kotoba-mist.png",
    place: "影の伸びる道",
    short: "光に照らされてできる、人や物の影。",
    origin: "影を人の形になぞらえた言葉です。低い日差しや、濃い影が伸びる写真に少し物語を加えます。",
    works: [["小泉八雲『怪談』", "影法師だけが、道の上を長く歩いた。"], ["宮沢賢治『銀河鉄道の夜』", "黒い影が、灯りのそばに立っていた。"]],
  },
];

words.push(...extraWords);

const wordProfiles = {
  akane: { warm: 1.15, red: 1.1, bright: 0.45, vivid: 0.3 },
  kouka: { warm: 0.9, red: 1.2, vivid: 0.7, quiet: 0.2 },
  tasogare: { warm: 0.6, dark: 0.75, quiet: 0.6, contrast: 0.25 },
  hakumei: { quiet: 0.95, cool: 0.5, dark: 0.45, bright: 0.25 },
  yoin: { quiet: 0.9, warm: 0.35, dark: 0.3, contrast: 0.2 },
  yuubae: { warm: 1.05, bright: 0.85, red: 0.65, vivid: 0.35 },
  komorebi: { green: 1.15, bright: 0.7, warm: 0.25, contrast: 0.35 },
  ryokuin: { green: 1.25, dark: 0.35, quiet: 0.45 },
  sokyu: { blue: 1.25, bright: 0.65, vivid: 0.45 },
  seicho: { blue: 0.8, bright: 0.75, quiet: 0.55, vivid: 0.25 },
  shigure: { dark: 0.8, cool: 0.85, quiet: 0.65, blue: 0.35 },
  kirameki: { bright: 1, contrast: 0.75, vivid: 0.65 },
  kageboshi: { dark: 1, contrast: 0.95, warm: 0.25 }
};
const notificationMessages = [
  "いま見ている景色に、まだ知らない言葉があるかもしれません。",
  "森からの合図です。少しだけ空を見上げてみませんか。",
  "今日の景色を、ひとつの言葉で残してみましょう。",
  "いつもの道に、まだ名前のない色があるかもしれません。",
];

const state = {
  view: "home",
  selectedWordId: "",
  candidateWordIds: [],
  capturedPhoto: "",
  sceneAnalysis: null,
  activeEntryId: "",
  cameraFacing: "environment",
  cameraReady: false,
  cameraError: "",
  savingEntry: false,
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

screen.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.dataset.action !== "pick-photo") return;
  const file = target.files?.[0];
  if (!file) return;
  handlePhotoFile(file);
  target.value = "";
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
    if (Array.isArray(saved.candidateWordIds)) state.candidateWordIds = saved.candidateWordIds;
    if (saved.sceneAnalysis && typeof saved.sceneAnalysis === "object") state.sceneAnalysis = saved.sceneAnalysis;
    if (saved.notifications && typeof saved.notifications === "object") {
      state.notifications = {
        ...state.notifications,
        ...saved.notifications,
        times: Array.isArray(saved.notifications.times) ? saved.notifications.times : [],
        sent: Array.isArray(saved.notifications.sent) ? saved.notifications.sent : [],
      };
    }
    if (typeof saved.selectedWordId === "string") state.selectedWordId = saved.selectedWordId;
    if (typeof saved.capturedPhoto === "string") state.capturedPhoto = saved.capturedPhoto;
    if (typeof saved.activeEntryId === "string") state.activeEntryId = saved.activeEntryId;
    if (saved.cameraFacing === "user" || saved.cameraFacing === "environment") {
      state.cameraFacing = saved.cameraFacing;
    }
    if (typeof saved.view === "string") state.view = saved.view;
  } catch {
    state.view = "home";
  }

  if (!isKnownView(state.view)) state.view = "home";
  if (state.selectedWordId && !getWord(state.selectedWordId)) state.selectedWordId = "";
  state.candidateWordIds = state.candidateWordIds.filter((id) => getWord(id)).slice(0, 5);
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      view: state.view,
      selectedWordId: state.selectedWordId,
      candidateWordIds: state.candidateWordIds,
      capturedPhoto: state.capturedPhoto,
      sceneAnalysis: state.sceneAnalysis,
      activeEntryId: state.activeEntryId,
      cameraFacing: state.cameraFacing,
      entries: state.entries,
      notifications: state.notifications,
    })
  );
}

function isKnownView(view) {
  return ["home", "camera", "choose", "detail", "poll", "notebook", "map", "forest"].includes(view);
}

function navigate(view) {
  if (!isKnownView(view)) return;
  if (state.view === "camera" && view !== "camera") stopCamera();
  state.view = view;
  saveState();
  render();
}

function render() {
  ensureDailySchedule(false);
  if (state.view !== "camera") stopCamera();

  const views = {
    home: renderHome,
    camera: renderCamera,
    choose: renderChoose,
    detail: renderDetail,
    poll: renderPoll,
    notebook: renderNotebook,
    map: renderMap,
    forest: renderForest,
  };

  screen.innerHTML = views[state.view]();
  updateTabbar();

  if (state.view === "camera") {
    startCamera();
  }
}

function updateTabbar() {
  tabbar.hidden = state.view === "camera";
  tabbar.querySelectorAll(".tab").forEach((tab) => {
    const active =
      tab.dataset.nav === state.view ||
      (["choose", "detail", "poll"].includes(state.view) && tab.dataset.nav === "home");
    tab.classList.toggle("active", active);
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

  return `<div class="view home-view forest-home">
    <header class="app-header">
      <button class="icon-button" type="button" aria-label="メニュー">☰</button>
      <div class="brand">
        <span class="brand-kana">ことばの森</span>
        <span class="brand-title">世界を、美しく読む。</span>
      </div>
      <button class="icon-button" type="button" data-action="request-notifications" aria-label="通知">⌁</button>
    </header>

    <section class="hero forest-hero">
      <img src="./assets/kotoba-hero.png" alt="大きな木と空が広がる森の景色" />
      <div class="hero-content forest-hero-content">
        <div class="hero-copy forest-hero-copy">
          <span class="hero-badge">ことばの森</span>
          <h1>世界を、美しく読む。</h1>
          <p>見過ごしていた景色に、ことばが眠っている。</p>
        </div>
        <div class="home-actions">
          <button class="primary-button coral-button" type="button" data-action="open-camera">ことばの旅をはじめる</button>
        </div>
      </div>
    </section>

    ${renderNotificationCard()}
    ${recentSection}
  </div>`;
}

function renderNotificationCard() {
  const enabled = state.notifications.enabled;
  return `<section class="notification-card">
    <div class="notification-row">
      <div>
        <strong>${enabled ? "今日の森からの合図" : "通知は1日2回ランダム"}</strong>
        <p>${enabled ? "今日のどこかで2回、景色を見る合図が届きます。" : "許可すると、毎日ランダムな2回だけ合図が届きます。"}</p>
      </div>
      <button class="ghost-button" type="button" data-action="request-notifications">${enabled ? "ON" : "受け取る"}</button>
    </div>
  </section>`;
}

function renderRecentCard(entry) {
  return `<button class="recent-card" type="button" data-action="open-entry" data-entry-id="${escapeHtml(entry.entryId)}" data-word-id="${escapeHtml(entry.wordId)}">
    <img src="${escapeHtml(entry.image)}" alt="${escapeHtml(entry.word)}を見つけた景色" />
    <span>${escapeHtml(entry.word)}</span>
  </button>`;
}

function renderCamera() {
  return `
    <div class="view full-camera">
      <video
        id="cameraPreview"
        class="camera-photo ${state.cameraFacing === "user" ? "front-camera" : ""}"
        autoplay
        playsinline
        muted
      ></video>

      <div class="camera-overlay">
        <div class="camera-top">
          <button
            class="close-button"
            type="button"
            data-nav="home"
            aria-label="閉じる"
          >×</button>

          <span class="camera-question">
            気になる景色を見つけたらシャッターをタップ！
          </span>
        </div>

        <div class="camera-frame" aria-hidden="true"></div>

        <div class="camera-controls">
          <label class="gallery-button" aria-label="写真から選ぶ">
            <span aria-hidden="true">▧</span><small>アルバム</small>
            <input
              class="photo-input"
              type="file"
              accept="image/*"
              data-action="pick-photo"
            />
          </label>

          <button
            class="shutter-button"
            type="button"
            data-action="take-photo"
            aria-label="撮影する"
          ></button>

          <button
            class="camera-switch-button"
            type="button"
            data-action="switch-camera"
            aria-label="内カメと外カメを切り替える"
          ><span aria-hidden="true">⇄</span><small>${state.cameraFacing === "environment" ? "内カメ" : "外カメ"}</small></button>
        </div>
      </div>
    </div>
  `;
}
function renderChoose() {
  const candidateWords = getCandidateWords();
  const selectedId = candidateWords.some((word) => word.id === state.selectedWordId)
    ? state.selectedWordId
    : candidateWords[0]?.id || "";
  const photo = getCurrentPhoto();
  const selectedWord = getWord(selectedId) || candidateWords[0] || words[0];
  const sideWords = candidateWords.filter((word) => word.id !== selectedWord.id).slice(0, 2);
  return `<div class="view choose-view stage-view word-decision-view">
    <header class="story-step-header">
      <button class="back-button" type="button" data-nav="camera" aria-label="戻る">‹</button>
      <span class="step-number">03</span>
      <h1>この景色を表す言葉</h1>
    </header>

    <div class="stage-scroll choose-scroll">
      <p class="decision-lead">この景色にぴったりの言葉を見つけました！</p>
      <div class="word-card-stage">
        ${sideWords[0] ? renderSideWordCard(sideWords[0], "left") : ""}
        <button class="big-word-card" type="button" data-action="select-word" data-word-id="${selectedWord.id}">
          <img src="${escapeHtml(photo)}" alt="撮影した景色" />
          <span class="sparkle">✦</span>
          <strong>${selectedWord.word}</strong>
          <small>${selectedWord.reading}</small>
          <p>${selectedWord.short}</p>
        </button>
        ${sideWords[1] ? renderSideWordCard(sideWords[1], "right") : ""}
      </div>
      <div class="mini-word-strip" aria-label="候補の言葉">
        ${candidateWords.map((word) => renderWordChip(word, selectedId)).join("")}
      </div>
    </div>

    <div class="action-area stage-action decision-actions">
      <button class="round-action refresh-action" type="button" data-nav="camera"><span aria-hidden="true">↻</span><small>もう一度探す</small></button>
      <button class="heart-action" type="button" data-action="open-detail" ${selectedId ? "" : "disabled"}><span aria-hidden="true">♥</span><small>これに決定！</small></button>
    </div>
  </div>`;
}

function renderSideWordCard(word, side) {
  return `<button class="side-word-card ${side}" type="button" data-action="select-word" data-word-id="${word.id}">
    <img src="${word.image}" alt="${word.word}の景色" />
    <strong>${word.word}</strong>
    <small>${word.reading}</small>
  </button>`;
}

function renderWordChip(word, selectedId) {
  return `<button class="word-chip ${word.id === selectedId ? "active" : ""}" type="button" data-action="select-word" data-word-id="${word.id}">${word.word}</button>`;
}
function renderWordOption(word, selectedId) {
  const selected = word.id === selectedId;
  return `<button class="word-option ${selected ? "selected" : ""}" type="button" data-action="select-word" data-word-id="${word.id}">
    <img src="${word.image}" alt="${word.word}の景色" />
    <span class="word-option-copy">
      <strong>${word.word}<small>（${word.reading}）</small></strong>
      <small>${word.short}</small>
    </span>
    <span class="checkmark" aria-hidden="true">✓</span>
  </button>`;
}

function renderDetail() {
  const word = getSelectedWord() || getCandidateWords()[0] || words[0];
  const detailPhoto = getDetailPhoto(word);
  const isSavedEntry = Boolean(state.activeEntryId && getEntry(state.activeEntryId));
  return `<div class="view detail-view stage-view">
    <header class="detail-topbar">
      <button class="back-button" type="button" data-nav="${isSavedEntry ? "notebook" : "choose"}" aria-label="戻る">‹</button>
      <span class="step-number">04</span>
      <h1>ことばの世界</h1>
      <button class="icon-button" type="button" data-action="share-word" aria-label="共有">↗</button>
    </header>

    <div class="stage-scroll detail-scroll">
      <figure class="detail-photo-frame">
        <img class="detail-photo" src="${escapeHtml(detailPhoto)}" alt="${word.word}に近い景色" />
      </figure>

      <section class="dictionary-heading">
        <h1>${word.word}</h1>
        <span>${word.reading}</span>
        <p>${word.short}</p>
      </section>

      <section class="origin-card detail-card">
        <div class="card-label"><span class="card-mark">葉</span>ことばの由来</div>
        <p>${word.origin}</p>
      </section>

      <section class="connection-card detail-card">
        <div class="card-label"><span class="card-mark link-mark">結</span>ことばのつながり</div>
        <div class="connection-tags">
          ${getConnectionWords(word).map((item) => `<button type="button" data-action="select-word" data-word-id="${item.id}">${item.word}<small>${item.reading}</small></button>`).join("")}
        </div>
      </section>

      <section class="work-card detail-card">
        <div class="card-label"><span class="card-mark book-mark">本</span>この言葉が使われた作品</div>
        <div class="work-list">
          ${word.works.map((item) => renderWorkItem(item, word.image)).join("")}
        </div>
      </section>
    </div>

    ${
      isSavedEntry
        ? `<div class="action-area stage-action detail-action"><button class="danger-button" type="button" data-action="delete-entry" data-entry-id="${escapeHtml(state.activeEntryId)}">この保存を削除</button></div>`
        : `<div class="action-area stage-action detail-action"><button class="primary-button" type="button" data-action="save-word" ${state.savingEntry ? "disabled" : ""}>${state.savingEntry ? "保存しています" : "このことばを手帳に残す"}</button></div>`
    }
  </div>`;
}
function renderWorkItem(item, image) {
  return `<div class="work-item">
    <img src="${image}" alt="作品に添える景色" />
    <span><strong>${item[0]}</strong><small>「${item[1]}」</small></span>
  </div>`;
}

function renderPoll() {
  const rows = getPollRows();
  return `<div class="view poll-view feelings-view">
    <header class="simple-header">
      <button class="back-button" type="button" data-nav="detail" aria-label="戻る">‹</button>
      <h1 class="page-title">みんなは、どう感じた？</h1>
      <span class="step-number pink-step">05</span>
    </header>
    <section class="feelings-card">
      <h2>みんなの感じたこと</h2>
      <p>この景色と同じ言葉に寄せられた声</p>
      <div class="poll-list">
        ${rows.map(renderPollRow).join("")}
      </div>
    </section>
    <section class="origin-card flower-note">
      <div class="card-label">同じ景色でも、感じ方は人それぞれ。</div>
      <p>言葉が増えるほど、世界の見え方が少しずつ豊かになります。</p>
    </section>
    <div class="action-area split-actions">
      <button class="secondary-button pink-share-button" type="button" data-action="share-word">あなたの気持ちをシェアする</button>
      <button class="primary-button" type="button" data-nav="notebook">ことば帳へ</button>
    </div>
  </div>`;
}
function renderPollRow(row) {
  return `<div class="poll-row" style="--pct:${row.percent}%">
    <img src="${row.image}" alt="${row.word}の景色" />
    <span><strong>${row.feeling}</strong><small>${row.word}　${row.text}</small></span>
    <span class="percent">♥ ${row.hearts}</span>
  </div>`;
}

function renderNotebook() {
  const entries = state.entries;
  const list = entries.length
    ? `<div class="book-grid">${entries.map(renderBookRow).join("")}</div>`
    : `<section class="empty-card"><p>まだ手帳に残した言葉はありません。</p></section>`;
  const deleteAllButton = entries.length
    ? `<button class="clear-book-button" type="button" data-action="clear-notebook">全削除</button>`
    : `<span class="icon-button" aria-hidden="true">⌕</span>`;

  return `<div class="view notebook-view book-view">
    <header class="simple-header">
      <button class="back-button" type="button" data-nav="home" aria-label="戻る">‹</button>
      <h1 class="page-title">ことば帳</h1>
      ${deleteAllButton}
    </header>
    <section class="book-summary">
      <strong>集めたことば <span>${entries.length}</span></strong>
      <small>お気に入り ${Math.min(entries.length, 36)}</small>
    </section>
    <div class="filter-pills" aria-label="分類">
      <span class="filter-pill active">すべて</span>
      <span class="filter-pill">季節</span>
      <span class="filter-pill">色</span>
      <span class="filter-pill">時間</span>
      <span class="filter-pill">自然</span>
      <span class="filter-pill">気持ち</span>
    </div>
    ${list}
    <div class="book-toolbar">
      <button type="button" data-action="open-camera">選択</button>
      <button type="button" data-nav="map">移動</button>
      <button type="button" data-nav="forest">お気に入り</button>
      <button type="button" data-action="clear-notebook">削除</button>
    </div>
  </div>`;
}

function renderBookRow(entry) {
  return `<article class="book-card">
    <button class="book-open-button" type="button" data-action="open-entry" data-entry-id="${escapeHtml(entry.entryId)}" data-word-id="${escapeHtml(entry.wordId)}">
      <img src="${escapeHtml(entry.image)}" alt="${escapeHtml(entry.word)}を見つけた景色" />
      <span class="new-badge">NEW</span>
      <strong>${escapeHtml(entry.word)}</strong>
      <small>${escapeHtml(entry.reading)}<br />${escapeHtml(formatEntryDate(entry.createdAt))}</small>
    </button>
    <button class="delete-entry-button card-delete" type="button" data-action="delete-entry" data-entry-id="${escapeHtml(entry.entryId)}" aria-label="${escapeHtml(entry.word)}を削除">×</button>
  </article>`;
}

function renderMap() {
  const entries = state.entries.slice(0, 12);
  const locatedCount = entries.filter((entry) => entry.location).length;
  const pins = entries.map((entry, index) => {
    const [x, y] = getPinPosition(entry, entries, index);
    const isCurrent = entry.entryId === state.activeEntryId;
    return `<button class="map-pin ${isCurrent ? "current" : ""}" type="button" style="--x:${x}%;--y:${y}%" data-action="open-entry" data-entry-id="${escapeHtml(entry.entryId)}" data-word-id="${escapeHtml(entry.wordId)}">
      ${escapeHtml(entry.word)}<small>${escapeHtml(entry.location ? "今日撮った場所" : entry.place)}</small>
    </button>`;
  });

  return `<div class="view map-view forest-map-view">
    <header class="simple-header">
      <button class="back-button" type="button" data-nav="notebook" aria-label="戻る">‹</button>
      <h1 class="page-title">ことばの地図</h1>
      <span class="step-number green-step">07</span>
    </header>
    <p class="poll-intro">日本のどこかで、ことばが見つかっています。</p>
    <section class="map-card">
      <img src="./assets/kotoba-map.png" alt="ことばが咲いていく地図" />
      ${pins.join("")}
      ${pins.length ? `<div class="map-empty map-note">${locatedCount ? "今日撮った場所に保存しました。" : "地図上の仮の場所に保存しました。"}</div>` : `<div class="map-empty">まだ地図には何もありません。景色を撮ると、ここに言葉が増えていきます。</div>`}
    </section>
  </div>`;
}

function renderForest() {
  const stats = getForestStats();
  const growth = getForestGrowth(stats.photos);
  const todaysWord = state.entries[0]?.word || "まだなし";
  return `<div class="view forest-page">
    <header class="simple-header">
      <button class="back-button" type="button" data-nav="home" aria-label="戻る">‹</button>
      <h1 class="page-title">わたしの森</h1>
      <span class="step-number orange-step">08</span>
    </header>
    <section class="my-forest-card ${growth.className}">
      <h2>${growth.title}</h2>
      <p>${growth.message}</p>
      <img src="./assets/kotoba-hero.png" alt="育っていくことばの森" />
      <div class="growth-symbol" aria-hidden="true">${growth.symbol}</div>
      <div class="forest-stat-cloud left"><span>${stats.photos}</span><small>保存した写真</small></div>
      <div class="forest-stat-cloud right"><span>${todaysWord}</span><small>今日のことば</small></div>
      <div class="forest-stats">
        <span><strong>${stats.photos}</strong>撮った写真</span>
        <span><strong>${stats.words}</strong>集めたことば</span>
        <span><strong>${stats.places}</strong>訪れた場所</span>
      </div>
    </section>
    <button class="primary-button orange-button forest-cta" type="button" data-action="open-camera">${stats.photos ? "森をもっと育てる" : "最初の写真を撮る"}</button>
  </div>`;
}

function handleAction(target) {
  const action = target.dataset.action;
  if (action === "open-camera") openCameraView();
  if (action === "take-photo") takeCameraPhoto();
  if (action === "switch-camera") switchCameraFacing();
  if (action === "select-word") selectWord(target.dataset.wordId);
  if (action === "open-detail") openSelectedWordDetail();
  if (action === "save-word") saveSelectedWord();
  if (action === "delete-entry") deleteEntry(target.dataset.entryId);
  if (action === "clear-notebook") clearNotebook();
  if (action === "open-entry") openEntry(target.dataset.entryId, target.dataset.wordId);
  if (action === "request-notifications") requestNotifications();
  if (action === "share-word") shareSelectedWord();
}

function openCameraView() {
  stopCamera();
  state.view = "camera";
  state.selectedWordId = "";
  state.candidateWordIds = [];
  state.sceneAnalysis = null;
  state.activeEntryId = "";
  state.capturedPhoto = "";
  state.cameraReady = false;
  state.cameraError = "";
  state.savingEntry = false;
  saveState();
  render();
}

function stopCamera() {
  cameraToken += 1;
  if (!cameraStream) return;
  cameraStream.getTracks().forEach((track) => track.stop());
  cameraStream = null;
}

async function startCamera() {
  stopCamera();

  if (!navigator.mediaDevices?.getUserMedia) {
    showToast("このブラウザではカメラを使用できません。");
    return;
  }

  const token = ++cameraToken;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: state.cameraFacing },
        width: { ideal: 1280 },
        height: { ideal: 1920 },
      },
    });

    if (token !== cameraToken || state.view !== "camera") {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    const video = document.getElementById("cameraPreview");

    if (!video) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    cameraStream = stream;
    video.srcObject = stream;
    await video.play();

    state.cameraReady = true;
    state.cameraError = "";
  } catch (error) {
    console.error(error);

    state.cameraReady = false;
    state.cameraError = error?.name || "CameraError";

    if (error?.name === "NotAllowedError") {
      showToast("Safariの設定からカメラを許可してください。");
    } else {
      showToast("カメラを起動できませんでした。");
    }
  }
}

function switchCameraFacing() {
  if (state.view !== "camera") return;
  state.cameraFacing = state.cameraFacing === "environment" ? "user" : "environment";
  state.cameraReady = false;
  state.cameraError = "";
  saveState();
  render();
}

function takeCameraPhoto() {
  const video = document.getElementById("cameraPreview");

  if (!video || !video.videoWidth || !video.videoHeight) {
    showToast("カメラの準備中です。");
    return;
  }

  const maxWidth = 560;
  const scale = Math.min(maxWidth / video.videoWidth, 1);
  const width = Math.max(1, Math.round(video.videoWidth * scale));
  const height = Math.max(1, Math.round(video.videoHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (state.cameraFacing === "user") {
    context.translate(width, 0);
    context.scale(-1, 1);
  }
  context.drawImage(video, 0, 0, width, height);

  const analysis = analyzeScene(context, width, height);

  state.capturedPhoto = canvas.toDataURL("image/jpeg", 0.76);
  state.sceneAnalysis = analysis;
  state.candidateWordIds = chooseCandidateWordIds(analysis);
  state.selectedWordId = state.candidateWordIds[0] || "";
  state.activeEntryId = "";
  state.cameraReady = false;
  state.cameraError = "";

  stopCamera();
  saveState();

  if (navigator.vibrate) {
    navigator.vibrate(35);
  }

  navigate("choose");
}

function handlePhotoFile(file) {
  if (!file.type.startsWith("image/")) {
    showToast("写真ファイルを選んでください。");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => captureImageElement(image);
    image.onerror = () => showToast("写真を読み込めませんでした。");
    image.src = String(reader.result || "");
  };
  reader.onerror = () => showToast("写真を読み込めませんでした。");
  reader.readAsDataURL(file);
}

function captureImageElement(image) {
  const maxWidth = 560;
  const scale = Math.min(maxWidth / image.naturalWidth, 1);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, width, height);

  const analysis = analyzeScene(context, width, height);
  state.capturedPhoto = canvas.toDataURL("image/jpeg", 0.66);
  state.sceneAnalysis = analysis;
  state.candidateWordIds = chooseCandidateWordIds(analysis);
  state.selectedWordId = state.candidateWordIds[0] || "";
  state.activeEntryId = "";
  state.cameraReady = false;
  state.cameraError = "";
  state.savingEntry = false;
  stopCamera();
  saveState();
  if (navigator.vibrate) navigator.vibrate(35);
  navigate("choose");
}
function selectWord(wordId) {
  if (!getWord(wordId)) return;
  state.selectedWordId = wordId;
  state.activeEntryId = "";
  saveState();
  render();
}

function openSelectedWordDetail() {
  const candidateWords = getCandidateWords();
  const selectedWord = getSelectedWord();
  if (!selectedWord || !candidateWords.some((word) => word.id === selectedWord.id)) {
    const firstWord = candidateWords[0];
    if (!firstWord) {
      showToast("いちばん近い言葉をひとつ選んでください。");
      return;
    }
    state.selectedWordId = firstWord.id;
    saveState();
  }
  navigate("detail");
}

function openEntry(entryId, fallbackWordId) {
  const entry = getEntry(entryId) || state.entries.find((item) => item.wordId === fallbackWordId);
  if (!entry || !getWord(entry.wordId)) return;
  state.selectedWordId = entry.wordId;
  state.activeEntryId = entry.entryId;
  state.capturedPhoto = entry.image;
  state.sceneAnalysis = entry.analysis || null;
  state.candidateWordIds = entry.candidateWordIds || [entry.wordId];
  navigate("detail");
}

async function saveSelectedWord() {
  const word = getSelectedWord();
  if (!word) {
    showToast("近い言葉をひとつ選んでください。");
    return;
  }
  if (state.savingEntry) return;

  state.savingEntry = true;
  render();
  const location = await getCurrentLocation();

  const entry = {
    entryId: `${word.id}-${Date.now()}`,
    wordId: word.id,
    word: word.word,
    reading: word.reading,
    short: word.short,
    image: getCurrentPhoto(),
    place: location ? "今日撮った場所" : "撮影した景色",
    location,
    analysis: state.sceneAnalysis,
    candidateWordIds: state.candidateWordIds,
    createdAt: new Date().toISOString(),
  };

  state.entries = [entry, ...state.entries].slice(0, 12);
  state.activeEntryId = entry.entryId;
  state.savingEntry = false;
  state.view = "poll";
  saveState();
  showToast(location ? "ことばと場所を保存しました。" : "ことばを保存しました。");
  render();
}

function deleteEntry(entryId) {
  const id = entryId || state.activeEntryId;
  const entry = getEntry(id);
  if (!entry) {
    showToast("削除する保存が見つかりませんでした。");
    return;
  }

  state.entries = state.entries.filter((item) => item.entryId !== id);

  if (state.activeEntryId === id) {
    state.activeEntryId = "";
    state.capturedPhoto = "";
    state.sceneAnalysis = null;
    state.candidateWordIds = [];
  }

  if (state.view === "detail") {
    state.view = "notebook";
  }

  saveState();
  showToast("ことば帳から削除しました。");
  render();
}

function clearNotebook() {
  if (!state.entries.length) return;
  state.entries = [];
  state.activeEntryId = "";
  state.capturedPhoto = "";
  state.sceneAnalysis = null;
  state.candidateWordIds = [];
  state.selectedWordId = "";
  state.view = "notebook";
  saveState();
  showToast("ことば帳を空にしました。");
  render();
}

function shareSelectedWord() {
  const word = getSelectedWord();
  if (!word) return;
  const text = `ことばの森で「${word.word}」に出会いました。`;
  if (navigator.share) {
    navigator.share({ title: "ことばの森", text }).catch(() => {});
    return;
  }
  navigator.clipboard?.writeText(text);
  showToast("共有用の文章をコピーしました。");
}

function analyzeScene(context, width, height) {
  const data = context.getImageData(0, 0, width, height).data;
  const step = Math.max(12, Math.floor(Math.sqrt(width * height) / 32));
  let count = 0;
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let totalBrightness = 0;
  let totalSaturation = 0;
  const brightnessSamples = [];

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const brightness = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const saturation = rgbSaturation(r, g, b);
      count += 1;
      totalR += r;
      totalG += g;
      totalB += b;
      totalBrightness += brightness;
      totalSaturation += saturation;
      brightnessSamples.push(brightness);
    }
  }

  const avgR = totalR / count;
  const avgG = totalG / count;
  const avgB = totalB / count;
  const brightness = totalBrightness / count;
  const saturation = totalSaturation / count;
  const variance = brightnessSamples.reduce((sum, value) => sum + (value - brightness) ** 2, 0) / count;
  const contrast = clamp(Math.sqrt(variance) * 2.8);

  return {
    brightness,
    saturation,
    bright: clamp((brightness - 0.34) / 0.58),
    dark: clamp((0.72 - brightness) / 0.62),
    vivid: clamp(saturation * 1.35),
    quiet: clamp(1 - saturation * 1.15),
    warm: clamp((avgR * 1.08 + avgG * 0.28 - avgB * 1.08) / 190 + 0.34),
    cool: clamp((avgB + avgG * 0.25 - avgR * 0.9) / 180 + 0.34),
    green: clamp((avgG - Math.max(avgR, avgB) * 0.72) / 115 + 0.32),
    blue: clamp((avgB - avgR * 0.62 + (avgB - avgG) * 0.26) / 145 + 0.32),
    red: clamp((avgR - avgG * 0.78 - avgB * 0.52) / 125 + 0.32),
    contrast,
  };
}

function rgbSaturation(r, g, b) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === 0) return 0;
  return (max - min) / max;
}

function chooseCandidateWordIds(analysis) {
  return words
    .map((word, index) => ({ word, index, score: scoreWord(word, analysis) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 5)
    .map((item) => item.word.id);
}

function scoreWord(word, analysis) {
  const profile = wordProfiles[word.id] || {};
  return Object.entries(profile).reduce((score, [key, weight]) => score + (analysis[key] || 0) * weight, 0);
}

function getCandidateWords() {
  if (!state.candidateWordIds.length) {
    state.candidateWordIds = chooseCandidateWordIds(state.sceneAnalysis || defaultAnalysis());
  }
  return state.candidateWordIds.map(getWord).filter(Boolean).slice(0, 5);
}

function getPollRows() {
  const candidateIds = getCandidateWords().map((word) => word.id);
  const orderedIds = [state.selectedWordId, ...candidateIds.filter((id) => id !== state.selectedWordId)].filter(Boolean).slice(0, 4);
  const percents = [38, 26, 20, 16];
  const feelings = ["やさしい気持ちになった", "懐かしい気持ち", "明日も頑張れそう！", "物語の始まりみたい"];
  const hearts = [128, 96, 74, 58];
  return orderedIds.map((id, index) => {
    const word = getWord(id);
    return {
      word: word.word,
      reading: word.reading,
      text: word.short,
      image: index === 0 ? getCurrentPhoto() : word.image,
      percent: percents[index],
      feeling: feelings[index],
      hearts: hearts[index],
    };
  });
}

function getConnectionWords(word) {
  const candidates = getCandidateWords().filter((item) => item.id !== word.id);
  const fallback = words.filter((item) => item.id !== word.id);
  return [...candidates, ...fallback].filter((item, index, list) => list.findIndex((other) => other.id === item.id) === index).slice(0, 3);
}

function getForestStats() {
  const photoCount = state.entries.length;
  const places = new Set(state.entries.map((entry) => entry.place || entry.word)).size;
  return {
    photos: photoCount,
    words: photoCount,
    places: photoCount ? places : 0,
  };
}

function getForestGrowth(count) {
  if (count <= 0) {
    return {
      className: "growth-empty",
      symbol: "種",
      title: "まだ何もない森",
      message: "最初の景色を保存すると、小さな芽が出ます。",
    };
  }

  if (count === 1) {
    return {
      className: "growth-sprout",
      symbol: "芽",
      title: "小さな芽が出ました",
      message: "1枚目の写真が、あなたの森を育てはじめました。",
    };
  }

  if (count < 5) {
    return {
      className: "growth-young",
      symbol: "若葉",
      title: "若葉の森",
      message: "保存した景色の数だけ、ことばの葉が増えています。",
    };
  }

  return {
    className: "growth-rich",
    symbol: "森",
    title: "育ってきた森",
    message: "集めた景色が、あなただけの森になっています。",
  };
}

function defaultAnalysis() {
  return {
    brightness: 0.62,
    saturation: 0.45,
    bright: 0.55,
    dark: 0.28,
    vivid: 0.48,
    quiet: 0.48,
    warm: 0.62,
    cool: 0.34,
    green: 0.32,
    blue: 0.34,
    red: 0.46,
    contrast: 0.42,
  };
}

function getSelectedWord() {
  return getWord(state.selectedWordId);
}

function getWord(id) {
  return words.find((word) => word.id === id);
}

function getEntry(entryId) {
  return state.entries.find((entry) => entry.entryId === entryId);
}

function getCurrentPhoto() {
  return state.capturedPhoto || "./assets/kotoba-sunset.png";
}

function getDetailPhoto(word) {
  const entry = getEntry(state.activeEntryId);
  if (entry?.image) return entry.image;
  if (state.capturedPhoto) return state.capturedPhoto;
  return word.image;
}

function getCurrentLocation() {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: roundCoord(position.coords.latitude),
          longitude: roundCoord(position.coords.longitude),
          accuracy: Math.round(position.coords.accuracy || 0),
        });
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 180000 }
    );
  });
}

function getPinPosition(entry, entries, index) {
  if (!entry.location) return fallbackPinPosition(index);

  const locatedEntries = entries.filter((item) => item.location);
  const center = getMapCenter(locatedEntries);
  const offset = index * 4;
  const x = clamp(50 + (entry.location.longitude - center.longitude) * 85000 + offset, 16, 84);
  const y = clamp(45 - (entry.location.latitude - center.latitude) * 110000 + offset * 0.4, 16, 82);
  return [roundPercent(x), roundPercent(y)];
}

function getMapCenter(entries) {
  const latitude = entries.reduce((sum, entry) => sum + entry.location.latitude, 0) / entries.length;
  const longitude = entries.reduce((sum, entry) => sum + entry.location.longitude, 0) / entries.length;
  return { latitude, longitude };
}

function fallbackPinPosition(index) {
  const positions = [[52, 42], [67, 54], [34, 59], [56, 70], [42, 31], [73, 36]];
  return positions[index % positions.length];
}

function roundCoord(value) {
  return Math.round(value * 1000000) / 1000000;
}

function roundPercent(value) {
  return Math.round(value * 10) / 10;
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
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
























