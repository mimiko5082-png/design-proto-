const STORAGE_KEY = "basho_manazashi_board_v2";
const screen = document.getElementById("screen");
const toast = document.getElementById("toast");
const tabbar = document.querySelector(".tabbar");

const gazes = [
  {
    id: "sound",
    prompt: "赤いものを\n3つ見つける",
    homeNote: "青空文庫の原典から、今日のまなざしをひらきます。",
    source: "青空文庫「おくのほそ道」",
    sourceNote: "静けさの中の、音に耳を澄ます。",
    haiku: "閑さや\n岩にしみ入る\n蝉の声",
    encounterNote: "芭蕉も「音」から景色を見ていた。",
    pauseTask: "いちばん遠い音を、ひとつ覚えてください。",
    noteExample: "電車が通ったあと、一瞬だけ町が静かになる。",
    category: "音",
    color: "#25496f",
    image: "./assets/kotoba-sunset.png",
  },
  {
    id: "light",
    prompt: "光が変わる場所を\nひとつ見つける",
    homeNote: "青空文庫の原典から、今日のまなざしをひらきます。",
    source: "青空文庫「おくのほそ道」",
    sourceNote: "旅の道で、光の残り方を見る。",
    haiku: "五月雨を\nあつめて早し\n最上川",
    encounterNote: "芭蕉も「流れ」から景色を見ていた。",
    pauseTask: "いま一番明るい場所を、ひとつ覚えてください。",
    noteExample: "夕方だけ、この壁が金色になる。",
    category: "光",
    color: "#8d4234",
    image: "./assets/kotoba-forest.png",
  },
  {
    id: "wind",
    prompt: "風が抜ける角を\n探す",
    homeNote: "青空文庫の原典から、今日のまなざしをひらきます。",
    source: "青空文庫「おくのほそ道」",
    sourceNote: "旅の途中で、見えない気配を読む。",
    haiku: "旅に病んで\n夢は枯野を\nかけ廻る",
    encounterNote: "芭蕉も「風」から景色を見ていた。",
    pauseTask: "風が少し変わる場所を、ひとつ覚えてください。",
    noteExample: "風が抜けるたび、線が低くのびる。",
    category: "風",
    color: "#5b6251",
    image: "./assets/kotoba-lake.png",
  },
];

const seeds = [
  {
    id: "seed-1",
    title: "五月雨を あつめて早し 最上川",
    task: "流れが集まる場所を探す",
    source: "青空文庫",
    category: "季節",
    image: "./assets/kotoba-forest.png",
    x: 52,
    y: 48,
  },
  {
    id: "seed-2",
    title: "涼しさを 我宿にしてねまる也",
    task: "涼しさのある場所を見つける",
    source: "青空文庫",
    category: "暮らし",
    image: "./assets/kotoba-lake.png",
    x: 31,
    y: 32,
  },
  {
    id: "seed-3",
    title: "有難や 雪をかほらす 南谷",
    task: "季節が残っている場所を探す",
    source: "青空文庫",
    category: "光",
    image: "./assets/kotoba-mist.png",
    x: 70,
    y: 42,
  },
];

const sampleEntries = [
  {
    id: "sample-1",
    title: "赤いポストが、\n雨の日はもっと赤い。",
    body: "おくのほそ道から、街の色を見つける。",
    date: "2024.5.11",
    category: "色",
    image: "./assets/kotoba-forest.png",
    x: 60,
    y: 36,
  },
  {
    id: "sample-2",
    title: "風が抜けるたび、\n端がそっと透明になる。",
    body: "風に揺れるものを探す。",
    date: "2024.5.10",
    category: "風",
    image: "./assets/kotoba-lake.png",
    x: 28,
    y: 28,
  },
  {
    id: "sample-3",
    title: "夜の路地が、\n石の匂いをゆっくり返す。",
    body: "匂いに耳を澄ます。",
    date: "2024.4.30",
    category: "匂い",
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
    seeds: renderSeeds,
    map: renderMap,
    notebook: renderNotebook,
    settings: renderSettings,
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
    <section class="manazashi-card source-home-card">
      <span class="screen-label">01　まなざしを受け取る</span>
      <div class="ink-branch"></div>
      <h1>${lineBreak(gaze.prompt)}</h1>
      <i style="background:${escapeAttr(gaze.color)}"></i>
      <p>${escapeHtml(gaze.homeNote)}</p>
      <span class="source-badge">出典：${escapeHtml(gaze.source)}</span>
      <button class="main-button" type="button" data-nav="classic">この視点で歩き始める</button>
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
    <section class="classic-card">
      <span class="screen-label">02　原典を読む</span>
      <article class="classic-slip">
        <div class="vertical-text">${vertical(gaze.haiku)}</div>
        <small>（おくのほそ道より）</small>
      </article>
      <p>${escapeHtml(gaze.sourceNote)}</p>
      <button class="text-next" type="button" data-nav="pause">青空文庫で原文を読む　→</button>
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
      <button class="x-button" type="button" data-nav="classic" aria-label="閉じる">×</button>
    </header>
    <section class="feel-paper">
      <span class="screen-label">03　立ち止まる</span>
      <p>30秒、<br>ここで立ち止まる</p>
      <div class="timer-ring" data-el="timer" style="--dash:${dash}">
        <strong>${remaining}</strong>
        <span>秒</span>
      </div>
      <small>${escapeHtml(gaze.pauseTask)}</small>
      <button class="outline-button" type="button" data-nav="note">終わった</button>
    </section>
  </div>`;
}

function renderNote() {
  const gaze = currentGaze();
  const photo = state.notePhoto
    ? `<img class="mini-photo" src="${escapeAttr(state.notePhoto)}" alt="選択した写真" />`
    : "";
  return `<div class="view note-view">
    <header class="simple-head">
      <button class="back-button" type="button" data-nav="pause" aria-label="戻る">←</button>
      <button class="save-link" type="button" data-action="save-note">保存</button>
    </header>
    <section class="note-paper note-board">
      <span class="screen-label">04　気づきを残す</span>
      <p class="note-lead">いまの気づきを、ひとこと。<br>自由に書きとめましょう。</p>
      <label class="note-memory">
        <textarea data-note-input maxlength="68" placeholder="電車が通ったあと、&#10;一瞬だけ町が&#10;静かになる。">${escapeHtml(state.note)}</textarea>
      </label>
      <div class="category-line">
        <span>見つめたカテゴリ（複数可）</span>
        ${["音", "光", "風", "匂い"].map((category) => `<button class="${state.noteCategory === category ? "active" : ""}" type="button" data-action="category" data-category="${escapeAttr(category)}">${escapeHtml(category)}</button>`).join("")}
      </div>
      <div class="memo-row">
        <small>場所のメモ（任意）<br>例：駅のホーム、風鈴の角 など</small>
        <label class="camera-mini" aria-label="写真を添える">
          ${photo || "▧"}
          <input type="file" accept="image/*" data-photo-input hidden />
        </label>
      </div>
    </section>
  </div>`;
}

function renderEncounter() {
  const gaze = currentGaze();
  return `<div class="view encounter-view">
    <header class="simple-head">
      <button class="back-button" type="button" data-nav="note" aria-label="戻る">←</button>
      <button class="menu-dots" type="button" aria-label="メニュー">☰</button>
    </header>
    <section class="encounter-card">
      <span class="screen-label">05　芭蕉と出会う</span>
      <p>あなたの気づきは、<br>芭蕉のまなざしとつながります。</p>
      <article class="classic-slip small-slip">
        <div class="vertical-text">${vertical(gaze.haiku)}</div>
        <small>（おくのほそ道より）</small>
      </article>
      <p>${escapeHtml(gaze.encounterNote)}</p>
      <span class="source-badge">出典：${escapeHtml(gaze.source)}</span>
      <button class="main-button" type="button" data-nav="seeds">まなざしの種を見る</button>
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
      <button class="active" type="button">すべて</button><button type="button">音</button><button type="button">光</button><button type="button">季節</button><button type="button">暮らし</button>
    </nav>
    <section class="seed-list">${cards}</section>
  </div>`;
}

function renderMap() {
  const entry = activeEntry();
  const pins = mapEntries().map((item) => `<button class="map-dot ${item.id === entry.id ? "active" : ""}" style="left:${item.x}%;top:${item.y}%;" type="button" data-action="open-entry" data-entry-id="${escapeAttr(item.id)}"></button>`).join("");
  return `<div class="view map-view">
    <header class="map-head">
      <span>07　まなざしの地図</span>
      <button class="round-button" type="button" aria-label="絞り込み">▽</button>
    </header>
    <section class="map-panel">
      <img src="./assets/kotoba-map.png" alt="まなざしの地図" />
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
      <button class="map-borrow-button" type="button" data-action="borrow-gaze">このまなざしを借りる</button>
    </section>
  </div>`;
}

function renderNotebook() {
  const entries = allEntries().slice(0, 8);
  const selectedIds = new Set(state.selectedEntryIds || []);
  const editLabel = state.notebookEditing ? "完了" : "☰";
  const rows = entries.length
    ? entries.map((entry) => {
        const selected = selectedIds.has(entry.id);
        return `<article class="journal-row ${selected ? "selected" : ""}">
          <button class="journal-open" type="button" data-action="open-entry" data-entry-id="${escapeAttr(entry.id)}">
            <img src="${escapeAttr(entry.image || "./assets/kotoba-mist.png")}" alt="" />
            <div>
              <strong>${lineBreak(entry.title)}</strong>
              <p>${escapeHtml(entry.body)}</p>
              <small>${escapeHtml(entry.date)}</small>
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
      <span class="screen-label">出典の流れ</span>
      <h2>青空文庫<br>「おくのほそ道」</h2>
      <div class="flow-icons">
        <span>開く</span><b>↓</b><span>芭蕉の句を読む</span><b>↓</b><span>観察のしかたを抽出</span><b>↓</b><span>今日のまなざしに変換</span><b>↓</b><span>街で気づく</span>
      </div>
      <p>すべてのまなざしは、青空文庫の原典に基づきます。</p>
      <small>引用・出典：青空文庫　松尾芭蕉「おくのほそ道」</small>
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
    showToast("このまなざしを借りました。");
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

function deleteSelectedEntries() {
  const selectedIds = new Set(state.selectedEntryIds || []);
  if (!selectedIds.size) {
    showToast("削除する句を選んでください。");
    return;
  }
  state.entries = state.entries.filter((entry) => !selectedIds.has(entry.id));
  state.deletedEntryIds = Array.from(new Set([...(state.deletedEntryIds || []), ...selectedIds]));
  state.selectedEntryIds = [];
  state.notebookEditing = false;
  if (!mapEntries().some((entry) => entry.id === state.activeEntryId)) {
    state.activeEntryId = mapEntries()[0]?.id || "";
  }
  saveState();
  showToast("選んだ句を句帳から消しました。");
  render();
}

function navigate(view) {
  state.view = view;
  state.notebookEditing = false;
  state.selectedEntryIds = [];
  if (view === "pause") state.timerStartedAt = Date.now();
  saveState();
  render();
}

function saveNote() {
  const gaze = currentGaze();
  const text = state.note.trim() || gaze.noteExample;
  const entry = {
    id: `entry-${Date.now()}`,
    title: text,
    body: `${gaze.source}から、街の${state.noteCategory}を見つける。`,
    date: formatDate(new Date()),
    category: state.noteCategory || gaze.category,
    image: state.notePhoto || gaze.image,
    x: 35 + ((Date.now() / 17) % 42),
    y: 28 + ((Date.now() / 29) % 48),
  };
  state.entries.unshift(entry);
  state.activeEntryId = entry.id;
  state.note = "";
  state.notePhoto = "";
  saveState();
  showToast("気づきを残しました。");
  navigate("encounter");
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
  if (state.date === today && state.gazeId) return;
  state.date = today;
  state.gazeId = gazes[0].id;
  state.noteCategory = currentGaze().category;
  saveState();
}

function currentGaze() {
  return gazes.find((gaze) => gaze.id === state.gazeId) || gazes[0];
}

function allEntries() {
  const deletedIds = new Set(state.deletedEntryIds || []);
  return [...state.entries, ...sampleEntries].filter((entry) => !deletedIds.has(entry.id));
}

function mapEntries() {
  const deletedIds = new Set(state.deletedEntryIds || []);
  return [...state.entries, ...seeds, ...sampleEntries].filter((entry) => !deletedIds.has(entry.id));
}

function activeEntry() {
  const entries = mapEntries();
  return entries.find((entry) => entry.id === state.activeEntryId) || entries[0] || sampleEntries[0];
}

function updateTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    const nav = tab.dataset.nav;
    const active =
      state.view === nav ||
      (["classic", "pause", "note", "encounter", "seeds"].includes(state.view) && nav === "home");
    tab.classList.toggle("active", active);
  });
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    Object.assign(state, saved);
    const allowedViews = ["home", "classic", "pause", "note", "encounter", "seeds", "map", "notebook", "settings"];
    if (!allowedViews.includes(state.view)) state.view = "home";
    if (!Array.isArray(state.entries)) state.entries = [];
    if (!Array.isArray(state.selectedEntryIds)) state.selectedEntryIds = [];
    if (!Array.isArray(state.deletedEntryIds)) state.deletedEntryIds = [];
    if (typeof state.notePhoto !== "string") state.notePhoto = "";
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
