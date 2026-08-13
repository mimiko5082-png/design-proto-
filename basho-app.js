import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, onValue, set, update, get } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

const STORAGE_KEY = "basho_manazashi_v3";
const ENTRIES_STORAGE_KEY = "basho_manazashi_entries_v1";
let bashoFirebaseDatabase = null;
let bashoRootRef = null;
let bashoEntriesRef = null;
let bashoFirebaseReady = false;
const screen = document.getElementById("screen");
const toast = document.getElementById("toast");
const tabbar = document.querySelector(".tabbar");

const gazes = [
  {
    id: "sound",
    prompt: "一番遠くの音を\n探す",
    homeNote: "芭蕉の観察を、今日の街歩きの手がかりに変えたものです。",
    inspiration: "着想：松尾芭蕉『おくのほそ道』",
    source: "松尾芭蕉『おくのほそ道』立石寺",
    sourceNote: "山寺で、物の音が聞こえないほどの静けさを感じた場面。",
    haiku: "閑さや\n岩にしみ入る\n蝉の声",
    observation: "静けさの中にある音を聴く",
    modernTask: "30秒立ち止まり、一番遠くの音を探す",
    encounterNote: "あなたの気づきは、静けさの中の音を聴くまなざしにつながります。",
    pauseTask: "いちばん遠い音を、ひとつ覚えてください。",
    noteExample: "電車が通ったあと、一瞬だけ町が静かになる。",
    category: "音",
    color: "#25496f",
    image: "./assets/kotoba-sunset.png",
  },
  {
    id: "flow",
    prompt: "流れが集まる場所を\n探す",
    homeNote: "芭蕉の観察を、今日の街歩きの手がかりに変えたものです。",
    inspiration: "着想：松尾芭蕉『おくのほそ道』",
    source: "松尾芭蕉『おくのほそ道』最上川",
    sourceNote: "雨の水を集めて速く流れる川を見た場面。",
    haiku: "五月雨を\nあつめて早し\n最上川",
    observation: "小さなものが集まり、景色の速さを変える",
    modernTask: "水・人・風が集まって流れる場所を見る",
    encounterNote: "あなたの気づきは、流れが景色を変えるまなざしにつながります。",
    pauseTask: "流れが集まっている場所を、ひとつ覚えてください。",
    noteExample: "細い道から人が集まって、角だけ少し速くなる。",
    category: "流れ",
    color: "#8d4234",
    image: "./assets/kotoba-lake.png",
  },
  {
    id: "trace",
    prompt: "時間の跡を\nひとつ見つける",
    homeNote: "芭蕉の観察を、今日の街歩きの手がかりに変えたものです。",
    inspiration: "着想：松尾芭蕉『おくのほそ道』",
    source: "松尾芭蕉『おくのほそ道』平泉",
    sourceNote: "かつての栄華が草の中に残っていると感じた場面。",
    haiku: "夏草や\n兵どもが\n夢の跡",
    observation: "過ぎた時間の痕跡を見る",
    modernTask: "古い看板、擦れた壁、残った跡をひとつ探す",
    encounterNote: "あなたの気づきは、時間の跡から場所を見るまなざしにつながります。",
    pauseTask: "時間が残っている跡を、ひとつ覚えてください。",
    noteExample: "消えかけた店名だけが、まだ壁に残っている。",
    category: "跡",
    color: "#5b6251",
    image: "./assets/kotoba-mist.png",
  },
];

const seeds = [
  {
    id: "seed-1",
    title: "閑さや 岩にしみ入る 蝉の声",
    task: "静けさの中にある音を聴く",
    body: "30秒立ち止まり、一番遠くの音を探す",
    source: "松尾芭蕉『おくのほそ道』立石寺",
    category: "音",
    image: "./assets/kotoba-sunset.png",
    x: 52,
    y: 48,
  },
  {
    id: "seed-2",
    title: "五月雨を あつめて早し 最上川",
    task: "流れが集まる場所を探す",
    body: "水・人・風が集まる場所を見る",
    source: "松尾芭蕉『おくのほそ道』最上川",
    category: "流れ",
    image: "./assets/kotoba-lake.png",
    x: 31,
    y: 32,
  },
  {
    id: "seed-3",
    title: "夏草や 兵どもが 夢の跡",
    task: "過ぎた時間の痕跡を見る",
    body: "古い看板や擦れた壁に残る時間を見る",
    source: "松尾芭蕉『おくのほそ道』平泉",
    category: "跡",
    image: "./assets/kotoba-mist.png",
    x: 70,
    y: 42,
  },
];

const sampleEntries = [
  {
    id: "sample-1",
    title: "電車が通ったあと、\n一瞬だけ町が静かになる。",
    body: "Aさんのまなざし：静けさの中の音を聴く",
    date: "5.12",
    category: "音",
    image: "./assets/kotoba-forest.png",
    x: 60,
    y: 36,
  },
  {
    id: "sample-2",
    title: "窓の反射が消えると、\n路地の奥の音が戻る。",
    body: "Bさんが借りて見つけた別の気づき",
    date: "5.13",
    category: "音",
    image: "./assets/kotoba-lake.png",
    x: 28,
    y: 28,
  },
  {
    id: "sample-3",
    title: "細い道から人が集まり、\n角だけ少し速くなる。",
    body: "流れが集まる場所を探す",
    date: "5.18",
    category: "流れ",
    image: "./assets/kotoba-sunset.png",
    x: 72,
    y: 58,
  },
];

const state = {
  view: "home",
  date: "",
  gazeId: "sound",
  timerStartedAt: 0,
  note: "",
  noteCategory: "音",
  notePhoto: "",
  entries: [],
  activeEntryId: "sample-1",
  notebookEditing: false,
  selectedEntryIds: [],
  deletedEntryIds: [],
  currentLocation: null,
  locationStatus: "idle",
  cloudStatus: "idle",
  cloudEmail: "",
  cloudUpdatedAt: 0,
  incomingManazashi: null,
  borrowedManazashi: null,
};

loadState();
ensureDaily();
processIncomingManazashi();
render();
initFirebaseSync();
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
    state.note = event.target.value.slice(0, 68);
    saveState();
  }
});

screen.addEventListener("change", (event) => {
  if (event.target.matches("[data-photo-input]")) {
    handlePhotoInput(event.target);
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
    classic: renderClassic,
    pause: renderPause,
    note: renderNote,
    encounter: renderEncounter,
    receive: renderReceive,
    seeds: renderSeeds,
    map: renderMap,
    notebook: renderNotebook,
    share: renderShare,
    book: renderBook,
  };
  screen.innerHTML = (views[state.view] || views.home)();
  updateTabs();
  updateTimer();
}

function renderHome() {
  const gaze = currentGaze();
  return `<div class="view home-view">
    <header class="topbar">
      <button class="round-button" type="button" aria-label="メニュー">☰</button>
      <button class="today-chip" type="button" data-action="today">今日の<br>まなざし</button>
    </header>
    <section class="manazashi-card source-home-card quiet-card">
      <span class="screen-label">今日のまなざし</span>
      <div class="ink-branch"></div>
      <p class="today-copy">今日は、</p>
      <h1>${lineBreak(gaze.prompt)}</h1>
      <i style="background:${escapeAttr(gaze.color)}"></i>
      <p>芭蕉の句から受け取った、いつもの街を見るための小さな視点です。</p>
      <span class="source-badge">1分以内で完了</span>
      <button class="main-button" type="button" data-nav="pause">30秒、まわりを見る</button>
    </section>
  </div>`;
}

function renderClassic() {
  const gaze = currentGaze();
  return `<div class="view classic-view">
    <header class="simple-head">
      <button class="back-button" type="button" data-nav="home" aria-label="戻る">←</button>
      <button class="menu-dots" type="button" aria-label="保存">□</button>
    </header>
    <section class="classic-card transform-card">
      <span class="screen-label">02　原典を読む</span>
      <article class="classic-slip">
        <div class="vertical-text">${vertical(gaze.haiku)}</div>
        <small>おくのほそ道</small>
      </article>
      <p>${escapeHtml(gaze.sourceNote)}</p>
      <section class="translation-card" aria-label="まなざしの変換">
        <div>
          <span>原典</span>
          <strong>${lineBreak(gaze.haiku)}</strong>
        </div>
        <b>↓</b>
        <div>
          <span>芭蕉の観察</span>
          <strong>${escapeHtml(gaze.observation)}</strong>
        </div>
        <b>↓</b>
        <div>
          <span>現代のまなざし</span>
          <strong>${escapeHtml(gaze.modernTask)}</strong>
        </div>
      </section>
      <button class="main-button classic-next-button" type="button" data-nav="pause">次に</button>
    </section>
  </div>`;
}

function renderPause() {
  const gaze = currentGaze();
  const remaining = timerRemaining();
  const progress = 1 - remaining / 30;
  const dash = Math.round(276 * progress);
  return `<div class="view feel-view">
    <header class="minimal-head">
      <button class="x-button" type="button" data-nav="home" aria-label="閉じる">×</button>
    </header>
    <section class="feel-paper quiet-card">
      <span class="screen-label">30秒、まわりを見る</span>
      <p>スマホを下ろして、<br>いつもの景色を見つめてみよう。</p>
      <div class="timer-ring" data-el="timer" style="--dash:${dash}">
        <strong>${remaining}</strong>
        <span>秒</span>
      </div>
      <p class="pause-task">${escapeHtml(gaze.modernTask)}</p>
      <small>${escapeHtml(gaze.pauseTask)}</small>
      <button class="outline-button" type="button" data-nav="note">気づきを残す</button>
    </section>
  </div>`;
}

function renderNote() {
  const gaze = currentGaze();
  const photo = state.notePhoto
    ? `<div class="note-photo-preview"><img src="${escapeAttr(state.notePhoto)}" alt="添付した写真" /><span>写真を変更</span></div>`
    : "";
  return `<div class="view note-view">
    <header class="simple-head">
      <button class="back-button" type="button" data-nav="pause" aria-label="戻る">←</button>
      <button class="save-link" type="button" data-action="save-note">保存</button>
    </header>
    <section class="note-paper note-board quiet-card">
      <span class="screen-label">何が気になりましたか？</span>
      <p class="note-lead">一語でも、一文でも。<br>今の気づきを残してください。</p>
      <label class="note-memory">
        <textarea data-note-input maxlength="68" placeholder="電車が通ったあと、&#10;一瞬だけ町が&#10;静かになる。">${escapeHtml(state.note)}</textarea>
      </label>
      <div class="category-line">
        <span>見つめたカテゴリ（複数可）</span>
        ${["音", "流れ", "跡", "光", "風", "匂い"].map((category) => `<button class="${state.noteCategory === category ? "active" : ""}" type="button" data-action="category" data-category="${escapeAttr(category)}">${escapeHtml(category)}</button>`).join("")}
      </div>
      <div class="memo-row photo-attach-row">
        <div>
          <strong>写真を添える</strong>
          <small>気づいた景色を1枚だけ添付できます。</small>
        </div>
        <label class="camera-mini photo-attach-button" aria-label="写真を添える">
          ${photo || `<span class="photo-add-icon">▧</span><b>写真を選ぶ</b>`}
          <input type="file" accept="image/*" data-photo-input hidden />
        </label>
      </div>
    </section>
  </div>`;
}

function renderEncounter() {
  const gaze = currentGaze();
  const entry = activeEntry();
  return `<div class="view encounter-view">
    <header class="simple-head">
      <button class="back-button" type="button" data-nav="note" aria-label="戻る">←</button>
      <button class="menu-dots" type="button" aria-label="メニュー">☰</button>
    </header>
    <section class="encounter-card saved-card quiet-card">
      <span class="screen-label">まなざしを残しました</span>
      <div class="wanderer-mark"></div>
      <p>今日のまなざしを<br>1つ残しました。</p>
      <article class="saved-note-preview">
        <strong>${lineBreak(entry.title)}</strong>
        <small>${escapeHtml(entry.date)}　${escapeHtml(entry.category)}</small>
      </article>
      <button class="main-button encounter-next-button" type="button" data-nav="notebook">句帳を見る</button>
    </section>
  </div>`;
}

function renderReceive() {
  const item = normalizeSharedManazashi(state.incomingManazashi) || normalizeSharedManazashi(state.borrowedManazashi);
  if (!item) {
    return `<div class="view receive-view">
      <section class="share-card receive-card quiet-card">
        <span class="screen-label">まなざしを受け取る</span>
        <p>届いたまなざしを読み込めませんでした。</p>
        <button class="main-button" type="button" data-nav="home">まなざしへ戻る</button>
      </section>
    </div>`;
  }
  return `<div class="view receive-view">
    <header class="simple-head">
      <button class="back-button" type="button" data-action="dismiss-manazashi" aria-label="閉じる">←</button>
      <button class="menu-dots" type="button" aria-label="メニュー">☰</button>
    </header>
    <section class="share-card receive-card quiet-card">
      <span class="screen-label">友達から届いたまなざし</span>
      <p>${escapeHtml(item.from)}から、<br>街を見るための小さな視点が届きました。</p>
      <article class="pass-card incoming-pass-card">
        <small>届いたまなざし</small>
        <strong>${lineBreak(item.title)}</strong>
        <span>${escapeHtml(item.date)}　${escapeHtml(item.category)}</span>
      </article>
      <p class="share-hint">同じ答えを探すのではなく、この視点を借りて30秒だけ街を見ます。</p>
      <div class="receive-actions">
        <button class="main-button" type="button" data-action="accept-manazashi">受け取る</button>
        <button class="outline-button" type="button" data-action="dismiss-manazashi">また今度</button>
      </div>
    </section>
  </div>`;
}

function renderSeeds() {
  const cards = seeds.map((seed) => `<button class="seed-row" type="button" data-action="open-seed" data-seed-id="${escapeAttr(seed.id)}">
    <strong>${escapeHtml(seed.title)}</strong>
    <span>${escapeHtml(seed.task)}</span>
    <small>${escapeHtml(seed.source)}</small>
  </button>`).join("");
  return `<div class="view seeds-view">
    <header class="map-head">
      <span>06　まなざしの種を見る</span>
      <button class="round-button" type="button" aria-label="絞り込み">☷</button>
    </header>
    <nav class="journal-filter-row seed-filter" aria-label="分類">
      <button class="active" type="button">すべて</button><button type="button">音</button><button type="button">流れ</button><button type="button">跡</button>
    </nav>
    <section class="seed-list">${cards}</section>
  </div>`;
}

function renderMap() {
  const entry = activeEntry();
  const location = state.currentLocation;
  const hasLocation = typeof location?.lat === "number" && typeof location?.lng === "number";
  const pins = hasLocation
    ? ""
    : mapEntries().map((item) => `<button class="map-dot ${item.id === entry.id ? "active" : ""}" style="left:${item.x}%;top:${item.y}%;" type="button" data-action="open-entry" data-entry-id="${escapeAttr(item.id)}"></button>`).join("");
  const locationStatusText =
    state.locationStatus === "loading"
      ? "現在地を取得しています"
      : hasLocation
        ? `現在地 ${formatCoordinate(location.lat)}, ${formatCoordinate(location.lng)}`
        : "現在地を取得すると、この地図が今いる場所に切り替わります。";
  const realMap = hasLocation
    ? `<iframe class="real-map-frame" title="現在地の地図" src="${escapeAttr(mapEmbedUrl(location))}" loading="lazy"></iframe><span class="current-location-pin">現在地</span>`
    : `<img src="./assets/kotoba-map.png" alt="まなざしの地図" />`;
  const mapLink = hasLocation
    ? `<a class="external-map-link" href="${escapeAttr(mapExternalUrl(location))}" target="_blank" rel="noopener">外部地図で開く</a>`
    : "";
  return `<div class="view map-view">
    <header class="map-head">
      <span>07　まなざしの地図</span>
      <button class="round-button" type="button" data-action="request-location" aria-label="現在地を表示">⌖</button>
    </header>
    <section class="location-status-card">
      <div>
        <strong>${hasLocation ? "現在地を表示中" : "現在地で見る"}</strong>
        <p>${escapeHtml(locationStatusText)}</p>
      </div>
      <button type="button" data-action="request-location">${hasLocation ? "更新" : "現在地を表示"}</button>
    </section>
    <section class="map-panel ${hasLocation ? "real-location-map" : ""}">
      ${realMap}
      <div class="map-layer"></div>
      ${pins}
      <article class="map-card">
        <img src="${escapeAttr(entry.image || "./assets/kotoba-sunset.png")}" alt="" />
        <div>
          <strong>${lineBreak(entry.title)}</strong>
          <p>${escapeHtml(entry.body)}</p>
          <small>${escapeHtml(entry.date)}　${escapeHtml(entry.category)}</small>
        </div>
      </article>
      <div class="map-actions ${hasLocation ? "has-location" : "no-location"}">
        ${mapLink}
        <button class="map-borrow-button" type="button" data-action="borrow-gaze">このまなざしを借りる</button>
      </div>
    </section>
  </div>`;
}

function renderNotebook() {
  const entries = allEntries().slice(0, 8);
  const todaySavedEntries = entries.filter(isTodaySavedEntry);
  const selectedIds = new Set(state.selectedEntryIds || []);
  const editLabel = state.notebookEditing ? "完了" : "☰";
  const syncCard = renderSyncCard();
  const rows = entries.length
    ? entries.map((entry) => {
        const selected = selectedIds.has(entry.id);
        const savedToday = isTodaySavedEntry(entry);
        return `<article class="journal-row ${selected ? "selected" : ""} ${savedToday ? "today-entry" : ""}">
          <button class="journal-open" type="button" data-action="open-entry" data-entry-id="${escapeAttr(entry.id)}">
            <img src="${escapeAttr(entry.image || "./assets/kotoba-mist.png")}" alt="" />
            <div>
              <strong>${lineBreak(entry.title)}</strong>
              <p>${escapeHtml(entry.body)}</p>
              <small>${escapeHtml(entry.date)}${savedToday ? "　今日保存" : ""}</small>
            </div>
            <span>${escapeHtml(entry.category)}</span>
          </button>
          <button class="journal-select" type="button" data-action="toggle-entry-select" data-entry-id="${escapeAttr(entry.id)}" aria-pressed="${selected ? "true" : "false"}" aria-label="削除する句を選ぶ">
            <span>${selected ? "✓" : ""}</span>
          </button>
        </article>`;
      }).join("")
    : `<div class="journal-empty">まだ句帳にまなざしはありません。</div>`;
  const deleteBar = state.notebookEditing
    ? `<div class="journal-delete-bar"><span>${selectedIds.size}件選択中</span><button type="button" data-action="delete-selected-entries" ${selectedIds.size ? "" : "disabled"}>選んだ句を削除</button></div>`
    : "";
  const todaySavedCard = todaySavedEntries.length
    ? `<section class="today-saved-card">
        <span>今日保存した句</span>
        <strong>${lineBreak(todaySavedEntries[0].title)}</strong>
        <small>句帳の先頭に反映されています。</small>
      </section>`
    : "";
  return `<div class="view notebook-view ${state.notebookEditing ? "editing" : ""}">
    <header class="journal-head">
      <button class="back-button" type="button" data-nav="map" aria-label="戻る">←</button>
      <div>
        <span>08　わたしの句帳</span>
        <h1>わたしの句帳</h1>
      </div>
      <button class="menu-dots" type="button" data-action="toggle-notebook-edit" aria-label="句帳を編集">${editLabel}</button>
    </header>
    <nav class="journal-filter-row" aria-label="句帳の分類">
      <button class="active" type="button">すべて</button><button type="button">気づき</button><button type="button">俳句風</button><button type="button">原典とつなぐ</button>
    </nav>
    ${syncCard}
    ${todaySavedCard}
    <section class="notebook-actions">
      <button type="button" data-nav="share">友達に渡す</button>
      <button type="button" data-nav="book">まなざし帖にする</button>
    </section>
    <section class="inheritance-card" aria-label="まなざしが受け継がれる例">
      <span>受け継ぎの例</span>
      <p><b>Aさん</b> 電車が通ったあと、一瞬だけ町が静かになる。</p>
      <strong>↓</strong>
      <p><b>Bさん</b> 同じ場所で、窓の反射が消えた瞬間の音に気づく。</p>
    </section>
    ${deleteBar}
    <section class="journal-list">${rows}</section>
  </div>`;
}

function renderSettings() {
  return `<div class="view settings-view">
    <header class="simple-head">
      <button class="back-button" type="button" data-nav="home" aria-label="戻る">←</button>
      <button class="menu-dots" type="button" aria-label="メニュー">☰</button>
    </header>
    <section class="source-flow-panel">
      <span class="screen-label">出典と変換</span>
      <h2>原典を、<br>街の見方に変える</h2>
      <div class="flow-icons">
        <span>原典：松尾芭蕉『おくのほそ道』</span><b>↓</b><span>芭蕉の観察を読む</span><b>↓</b><span>観察のしかたを抽出</span><b>↓</b><span>今日のまなざしに変換</span><b>↓</b><span>街で気づきを残す</span>
      </div>
      <p>「お題」は原文そのものではありません。芭蕉の観察を、今の街で試せる形に翻訳したものです。</p>
      <small>引用・底本：青空文庫　松尾芭蕉『おくのほそ道』　杉浦正一郎校註　作品ID 61619</small>
    </section>
  </div>`;
}

function renderSyncCard() {
  return "";
}

function renderShare() {
  const entry = activeEntry();
  return `<div class="view share-view">
    <header class="simple-head">
      <button class="back-button" type="button" data-nav="notebook" aria-label="戻る">←</button>
      <button class="menu-dots" type="button" aria-label="メニュー">☰</button>
    </header>
    <section class="share-card quiet-card">
      <span class="screen-label">まなざしを渡す</span>
      <p>このまなざしを、<br>次の人へ渡してみよう。</p>
      <article class="pass-card">
        <small>まなざしカード</small>
        <strong>${lineBreak(entry.title)}</strong>
        <span>from あなた</span>
      </article>
      <p class="share-hint">友達はこのまなざしで、30秒だけ街を見つめます。</p>
      <button class="main-button" type="button" data-action="share-manazashi">友達に渡す</button>
    </section>
  </div>`;
}

function renderBook() {
  const entries = allEntries().filter((entry) => entry.id?.startsWith("entry-")).slice(0, 4);
  const pages = [
    `<article class="book-page cover"><small>今日の</small><strong>まなざし帖</strong><span>${formatDate(new Date())}</span><div class="wanderer-mark small"></div></article>`,
    `<article class="book-page haiku"><small>芭蕉の句</small><strong>${escapeHtml(currentGaze().haiku)}</strong><span>松尾芭蕉</span></article>`,
    ...entries.map((entry, index) => `<article class="book-page note-page">
      <small>${index + 1}ページ目</small>
      ${entry.image ? `<img class="book-photo" src="${escapeAttr(entry.image)}" alt="" />` : ""}
      <strong>${lineBreak(entry.title)}</strong>
      <span>${escapeHtml(entry.date)}　${escapeHtml(entry.category)}</span>
    </article>`),
    `<article class="book-page back-cover"><strong>次のまなざしを<br>誰に渡しますか？</strong><div class="wanderer-mark small"></div></article>`,
  ];
  return `<div class="view book-view">
    <header class="simple-head">
      <button class="back-button" type="button" data-nav="notebook" aria-label="戻る">←</button>
      <button class="menu-dots" type="button" aria-label="メニュー">☰</button>
    </header>
    <section class="book-panel">
      <span class="screen-label">今日の記録を、まなざし帖にする</span>
      <div class="book-strip">${pages.join("")}</div>
      <button class="main-button" type="button" data-action="print-book">まなざし帖をつくる</button>
    </section>
  </div>`;
}

function handleAction(target) {
  const action = target.dataset.action;
  if (action === "today") {
    rotateGaze();
    return;
  }
  if (action === "category") {
    state.noteCategory = target.dataset.category || "音";
    saveState();
    render();
    return;
  }
  if (action === "save-note") {
    saveNote();
    return;
  }
  if (action === "open-seed") {
    const seed = seeds.find((item) => item.id === target.dataset.seedId);
    if (seed) {
      state.activeEntryId = seed.id;
      saveState();
    }
    navigate("map");
    return;
  }
  if (action === "borrow-gaze") {
    borrowActiveManazashi();
    return;
  }
  if (action === "accept-manazashi") {
    acceptSharedManazashi();
    return;
  }
  if (action === "dismiss-manazashi") {
    dismissSharedManazashi();
    return;
  }
  if (action === "request-location") {
    requestCurrentLocation();
    return;
  }
  if (action === "toggle-notebook-edit") {
    toggleNotebookEdit();
    return;
  }
  if (action === "toggle-entry-select") {
    toggleEntrySelection(target.dataset.entryId);
    return;
  }
  if (action === "delete-selected-entries") {
    deleteSelectedEntries();
    return;
  }
  if (action === "share-manazashi") {
    shareManazashi();
    return;
  }
  if (action === "print-book") {
    printBook();
    return;
  }
  if (action === "open-entry") {
    if (state.notebookEditing) {
      toggleEntrySelection(target.dataset.entryId);
      return;
    }
    state.activeEntryId = target.dataset.entryId;
    saveState();
    navigate("map");
  }
}

function rotateGaze() {
  const index = gazes.findIndex((item) => item.id === state.gazeId);
  const next = gazes[(index + 1 + gazes.length) % gazes.length];
  state.gazeId = next.id;
  state.noteCategory = next.category;
  state.date = todayKey();
  saveState();
  render();
}

function toggleNotebookEdit() {
  state.notebookEditing = !state.notebookEditing;
  state.selectedEntryIds = [];
  saveState();
  render();
}

function toggleEntrySelection(entryId) {
  if (!entryId) return;
  const selectedIds = new Set(state.selectedEntryIds || []);
  if (selectedIds.has(entryId)) selectedIds.delete(entryId);
  else selectedIds.add(entryId);
  state.selectedEntryIds = Array.from(selectedIds);
  saveState();
  render();
}

async function deleteSelectedEntries() {
  const selectedIds = new Set(state.selectedEntryIds || []);
  if (!selectedIds.size) {
    showToast("削除する句を選んでください。");
    return;
  }

  const idsToDelete = Array.from(selectedIds).filter(Boolean);
  state.entries = state.entries.filter((entry) => !selectedIds.has(entry.id));
  state.deletedEntryIds = Array.from(new Set([...(state.deletedEntryIds || []), ...idsToDelete]));
  state.selectedEntryIds = [];
  state.notebookEditing = false;
  if (!mapEntries().some((entry) => entry.id === state.activeEntryId)) {
    state.activeEntryId = mapEntries()[0]?.id || "";
  }
  saveEntriesOnly();
  saveState();
  render();

  const deletedOnline = await deleteEntriesFromFirebase(idsToDelete);
  showToast(deletedOnline ? "削除をほかの端末にも反映しました。" : "句帳から削除しました。");
}

function requestCurrentLocation() {
  if (!navigator.geolocation) {
    state.locationStatus = "error";
    saveState();
    showToast("この端末では現在地を使えません。");
    render();
    return;
  }

  state.locationStatus = "loading";
  saveState();
  render();

  navigator.geolocation.getCurrentPosition(
    (position) => {
      state.currentLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: Math.round(position.coords.accuracy || 0),
        updatedAt: Date.now(),
      };
      state.locationStatus = "ready";
      saveState();
      showToast("現在地を表示しました。");
      render();
    },
    () => {
      state.locationStatus = "error";
      saveState();
      showToast("位置情報を許可すると現在地を表示できます。");
      render();
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    }
  );
}

async function initFirebaseSync() {
  if (!isFirebaseConfigured()) {
    console.warn("Firebase設定が見つかりません。");
    state.cloudStatus = "error";
    saveState();
    return;
  }

  try {
    const app = initializeApp(window.BASHO_FIREBASE);
    bashoFirebaseDatabase = getDatabase(app);
    bashoRootRef = ref(bashoFirebaseDatabase);
    bashoEntriesRef = ref(bashoFirebaseDatabase, "entries");
    bashoFirebaseReady = true;
    state.cloudStatus = "syncing";
    saveState();

    // 先にクラウド側の削除履歴を読み、別端末で消した句を復活させないようにします。
    const initialSnapshot = await get(bashoRootRef);
    const initialValue = initialSnapshot.val() || {};
    const remoteDeletedIds = Object.keys(initialValue.deletedEntries || {});
    state.deletedEntryIds = Array.from(new Set([...(state.deletedEntryIds || []), ...remoteDeletedIds]));
    const deletedSet = new Set(state.deletedEntryIds);

    // この端末にだけ残っている既存の句は初回同期します。ただし削除済みの句は再アップロードしません。
    const localEntries = (state.entries || []).filter(
      (entry) => entry?.id?.startsWith("entry-") && !deletedSet.has(entry.id)
    );
    if (localEntries.length) {
      const updates = {};
      localEntries.forEach((entry) => {
        updates[`entries/${entry.id}`] = cloudEntry(entry);
      });
      await update(bashoRootRef, updates);
    }

    // entries と deletedEntries を同じスナップショットで監視し、保存も削除も全端末へ反映します。
    onValue(
      bashoRootRef,
      (snapshot) => {
        const value = snapshot.val() || {};
        const deletedIds = Object.keys(value.deletedEntries || {});
        const deletedIdsSet = new Set(deletedIds);
        const remoteEntries = Object.values(value.entries || {})
          .filter((entry) => entry && typeof entry === "object" && entry.id && !deletedIdsSet.has(entry.id))
          .map(normalizeSyncedEntry);

        state.deletedEntryIds = deletedIds;
        state.entries = uniqueEntriesById(remoteEntries);
        state.cloudStatus = "synced";
        state.cloudUpdatedAt = Date.now();
        saveEntriesOnly();
        saveState();
        if (state.view === "notebook" || state.view === "map") render();
      },
      (error) => {
        console.error(error);
        state.cloudStatus = "error";
        saveState();
      }
    );
  } catch (error) {
    console.error(error);
    state.cloudStatus = "error";
    saveState();
  }
}

async function saveEntryToFirebase(entry) {
  if (!bashoFirebaseReady || !bashoRootRef || !entry?.id) return false;
  try {
    await update(bashoRootRef, {
      [`entries/${entry.id}`]: cloudEntry(entry),
      [`deletedEntries/${entry.id}`]: null,
    });
    state.cloudStatus = "synced";
    state.cloudUpdatedAt = Date.now();
    saveState();
    return true;
  } catch (error) {
    console.error(error);
    state.cloudStatus = "error";
    saveState();
    showToast("オンライン保存に失敗しました。通信を確認してください。");
    return false;
  }
}

async function deleteEntriesFromFirebase(entryIds) {
  if (!bashoFirebaseReady || !bashoRootRef || !Array.isArray(entryIds) || !entryIds.length) return false;
  try {
    const deletedAt = Date.now();
    const updates = {};
    entryIds.forEach((id) => {
      updates[`entries/${id}`] = null;
      updates[`deletedEntries/${id}`] = deletedAt;
    });
    await update(bashoRootRef, updates);
    return true;
  } catch (error) {
    console.error(error);
    state.cloudStatus = "error";
    saveState();
    showToast("オンライン側の削除に失敗しました。通信を確認してください。");
    return false;
  }
}

function cloudEntry(entry) {
  return {
    id: String(entry.id || ""),
    title: String(entry.title || ""),
    body: String(entry.body || ""),
    date: String(entry.date || ""),
    savedAt: Number(entry.savedAt || 0),
    category: String(entry.category || ""),
    image: typeof entry.image === "string" ? entry.image : "",
    x: Number.isFinite(Number(entry.x)) ? Number(entry.x) : 50,
    y: Number.isFinite(Number(entry.y)) ? Number(entry.y) : 48,
  };
}

function normalizeSyncedEntry(entry) {
  return cloudEntry(entry);
}

function navigate(view) {
  state.view = view;
  state.notebookEditing = false;
  state.selectedEntryIds = [];
  if (view === "home") {
    state.incomingManazashi = null;
    state.borrowedManazashi = null;
  }
  if (view === "pause") state.timerStartedAt = Date.now();
  saveState();
  render();
}

function saveNote() {
  const gaze = currentGaze();
  const now = Date.now();
  const text = state.note.trim() || gaze.noteExample;
  const image = state.notePhoto || gaze.image;
  const entry = {
    id: `entry-${now}`,
    title: text,
    body: `${gaze.observation}から、街の${state.noteCategory}を見つける。`,
    date: formatDate(new Date(now)),
    savedAt: now,
    category: state.noteCategory || gaze.category,
    image,
    x: 35 + ((now / 17) % 42),
    y: 28 + ((now / 29) % 48),
  };
  state.entries.unshift(entry);
  state.entries = uniqueEntriesById(state.entries);
  state.activeEntryId = entry.id;
  state.note = "";
  state.notePhoto = "";
  state.incomingManazashi = null;
  state.borrowedManazashi = null;
  saveEntriesOnly();
  saveState();
  showToast("まなざしを残しました。");
  navigate("encounter");
  saveEntryToFirebase(entry);
}

function handlePhotoInput(input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      const maxSide = 900;
      const scale = Math.min(maxSide / image.width, maxSide / image.height, 1);
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, width, height);
      state.notePhoto = canvas.toDataURL("image/jpeg", 0.78);
      saveState();
      render();
    };
    image.onerror = () => showToast("写真を読み込めませんでした。");
    image.src = String(reader.result || "");
  };
  reader.onerror = () => showToast("写真を読み込めませんでした。");
  reader.readAsDataURL(file);
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

function ensureDaily() {
  const today = todayKey();
  const hasValidGaze = gazes.some((gaze) => gaze.id === state.gazeId);
  if (state.date === today && hasValidGaze) return;
  state.date = today;
  state.gazeId = gazes[dailyIndex(today)].id;
  state.noteCategory = currentGaze().category;
  saveState();
}

function dailyIndex(key) {
  return [...key].reduce((sum, char) => sum + char.charCodeAt(0), 0) % gazes.length;
}

function processIncomingManazashi() {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get("manazashi");
  if (!encoded) return;
  const incoming = decodeSharedManazashi(encoded);
  if (!incoming) {
    showToast("まなざしを読み込めませんでした。");
    return;
  }
  state.incomingManazashi = incoming;
  state.borrowedManazashi = null;
  state.view = "receive";
  saveState();
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("manazashi");
    window.history.replaceState({}, "", url);
  } catch {}
}

function currentGaze() {
  const borrowed = normalizeSharedManazashi(state.borrowedManazashi);
  if (borrowed && ["pause", "note"].includes(state.view)) return borrowedGaze(borrowed);
  return gazes.find((gaze) => gaze.id === state.gazeId) || gazes[0];
}

function borrowedGaze(item) {
  return {
    id: "borrowed",
    prompt: item.title,
    homeNote: "友達から受け取ったまなざしです。",
    inspiration: "友達から届いたまなざし",
    source: "友達から届いたまなざし",
    sourceNote: "誰かが街で残した気づきを、次の人の観察の入口にします。",
    haiku: item.title,
    observation: `${item.from}の気づきを借りる`,
    modernTask: `30秒立ち止まり、「${oneLine(item.title)}」という視点で街を見る`,
    encounterNote: "あなたの気づきは、次の誰かのまなざしになります。",
    pauseTask: "同じものを探すのではなく、その視点で別の気づきを見つけてください。",
    noteExample: item.title,
    category: item.category,
    color: "#4d684c",
    image: "./assets/kotoba-forest.png",
  };
}

function allEntries() {
  const deletedIds = new Set(state.deletedEntryIds || []);
  return [...state.entries, ...sampleEntries]
    .filter((entry) => !deletedIds.has(entry.id))
    .sort((a, b) => entrySortTime(b) - entrySortTime(a));
}

function mapEntries() {
  const deletedIds = new Set(state.deletedEntryIds || []);
  return [...state.entries, ...seeds, ...sampleEntries].filter((entry) => !deletedIds.has(entry.id));
}

function activeEntry() {
  const entries = mapEntries();
  return entries.find((entry) => entry.id === state.activeEntryId) || entries[0] || sampleEntries[0];
}

function borrowActiveManazashi() {
  const entry = activeEntry();
  state.incomingManazashi = sharedManazashiFromEntry(entry, "誰か");
  state.borrowedManazashi = null;
  saveState();
  navigate("receive");
}

function isTodaySavedEntry(entry) {
  if (!entry?.id?.startsWith("entry-")) return false;
  const savedAt = Number(entry.savedAt || entry.id.replace("entry-", ""));
  if (!Number.isFinite(savedAt)) return false;
  return formatDate(new Date(savedAt)) === formatDate(new Date());
}

function entrySortTime(entry) {
  if (entry?.savedAt) return Number(entry.savedAt);
  if (entry?.id?.startsWith("entry-")) {
    const idTime = Number(entry.id.replace("entry-", ""));
    if (Number.isFinite(idTime)) return idTime;
  }
  return 0;
}

function updateTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    const nav = tab.dataset.nav;
    const active =
      state.view === nav ||
      (["classic", "pause", "note", "encounter", "seeds"].includes(state.view) && nav === "home") ||
      (["share", "book"].includes(state.view) && nav === "notebook");
    tab.classList.toggle("active", active);
  });
}

async function shareManazashi() {
  const entry = activeEntry();
  const link = sharedManazashiLink(entry);
  const text = `芭蕉のまなざし\n${entry.title.replace(/\n/g, " ")}\n30秒だけ、このまなざしで街を見てみてください。\n${link}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: "友達から届いたまなざし", text, url: link });
      return;
    } catch {}
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast("受け取りリンクをコピーしました。");
  } catch {
    showToast("友達に渡すカードを作りました。");
  }
}

function sharedManazashiLink(entry) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("manazashi", encodeSharedManazashi(sharedManazashiFromEntry(entry, "友達")));
  return url.toString();
}

function sharedManazashiFromEntry(entry, from = "友達") {
  return normalizeSharedManazashi({
    title: entry?.title || "一番遠くの音を探す",
    category: entry?.category || "音",
    date: entry?.date || formatDate(new Date()),
    from,
  });
}

function encodeSharedManazashi(item) {
  const normalized = normalizeSharedManazashi(item);
  const json = JSON.stringify(normalized);
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeSharedManazashi(value) {
  try {
    const padded = String(value || "").replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(String(value || "").length / 4) * 4, "=");
    return normalizeSharedManazashi(JSON.parse(decodeURIComponent(escape(atob(padded)))));
  } catch {
    return null;
  }
}

function normalizeSharedManazashi(item) {
  if (!item || typeof item !== "object") return null;
  const title = String(item.title || "").trim().slice(0, 68);
  if (!title) return null;
  return {
    title,
    category: String(item.category || "音").trim().slice(0, 12) || "音",
    date: String(item.date || formatDate(new Date())).trim().slice(0, 16),
    from: String(item.from || "友達").trim().slice(0, 16) || "友達",
  };
}

function acceptSharedManazashi() {
  const item = normalizeSharedManazashi(state.incomingManazashi);
  if (!item) {
    showToast("まなざしを読み込めませんでした。");
    navigate("home");
    return;
  }
  state.borrowedManazashi = item;
  state.incomingManazashi = null;
  state.noteCategory = item.category;
  state.note = "";
  state.notePhoto = "";
  showToast("まなざしを受け取りました。");
  navigate("pause");
}

function dismissSharedManazashi() {
  state.incomingManazashi = null;
  state.borrowedManazashi = null;
  saveState();
  navigate("home");
}

function oneLine(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function printBook() {
  if (state.view !== "book") {
    navigate("book");
    requestAnimationFrame(() => window.print());
    return;
  }
  showToast("印刷画面を開きます。");
  requestAnimationFrame(() => window.print());
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    Object.assign(state, saved);
    state.entries = uniqueEntriesById([...(loadEntriesOnly() || []), ...(state.entries || [])]);
    const allowedViews = ["home", "classic", "pause", "note", "encounter", "receive", "seeds", "map", "notebook", "share", "book"];
    if (!allowedViews.includes(state.view)) state.view = "home";
    if (!Array.isArray(state.entries)) state.entries = [];
    if (!Array.isArray(state.selectedEntryIds)) state.selectedEntryIds = [];
    if (!Array.isArray(state.deletedEntryIds)) state.deletedEntryIds = [];
    if (typeof state.notePhoto !== "string") state.notePhoto = "";
    if (!state.currentLocation || typeof state.currentLocation.lat !== "number" || typeof state.currentLocation.lng !== "number") {
      state.currentLocation = null;
    }
    if (!["idle", "loading", "ready", "error"].includes(state.locationStatus)) state.locationStatus = "idle";
    if (state.locationStatus === "loading") state.locationStatus = state.currentLocation ? "ready" : "idle";
    if (!["idle", "signed-out", "syncing", "synced", "error"].includes(state.cloudStatus)) state.cloudStatus = "idle";
    if (state.cloudStatus === "syncing") state.cloudStatus = "idle";
    if (typeof state.cloudEmail !== "string") state.cloudEmail = "";
    if (typeof state.cloudUpdatedAt !== "number") state.cloudUpdatedAt = 0;
    state.incomingManazashi = normalizeSharedManazashi(state.incomingManazashi);
    state.borrowedManazashi = normalizeSharedManazashi(state.borrowedManazashi);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function saveState() {
  saveEntriesOnly();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    const leanState = {
      ...state,
      notePhoto: "",
      entries: state.entries.map(compactEntry),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(leanState));
    } catch {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...leanState, entries: [] }));
      } catch {}
    }
  }
}

function loadEntriesOnly() {
  try {
    const saved = JSON.parse(localStorage.getItem(ENTRIES_STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveEntriesOnly() {
  try {
    localStorage.setItem(ENTRIES_STORAGE_KEY, JSON.stringify((state.entries || []).map(compactEntry)));
  } catch {
    try {
      localStorage.setItem(ENTRIES_STORAGE_KEY, JSON.stringify((state.entries || []).map((entry) => compactEntry({ ...entry, image: "" }))));
    } catch {}
  }
}

function compactEntry(entry) {
  return {
    id: entry.id,
    title: entry.title,
    body: entry.body,
    date: entry.date,
    savedAt: entry.savedAt,
    category: entry.category,
    image: compactEntryImage(entry.image),
    x: entry.x,
    y: entry.y,
  };
}

function compactEntryImage(image) {
  if (typeof image !== "string") return "";
  return image.startsWith("data:") ? "" : image;
}

function uniqueEntriesById(entries) {
  const seen = new Set();
  return (entries || []).filter((entry) => {
    if (!entry?.id || seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function formatDate(date) {
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
}

function formatCoordinate(value) {
  return Number(value).toFixed(5);
}

function mapEmbedUrl(location) {
  const lat = Number(location.lat);
  const lng = Number(location.lng);
  const delta = 0.006;
  const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].map((value) => value.toFixed(6)).join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

function mapExternalUrl(location) {
  const lat = Number(location.lat).toFixed(6);
  const lng = Number(location.lng).toFixed(6);
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

function isFirebaseConfigured() {
  const config = window.BASHO_FIREBASE || {};
  return Boolean(config.apiKey && config.projectId && config.appId && config.databaseURL);
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
