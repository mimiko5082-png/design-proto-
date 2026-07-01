const TOTAL_STEPS = 3;
const NAMES_KEY = "undiscovered_names_v1";
const LAST_PLACE_KEY = "undiscovered_last_place_v1";

const places = [
  {
    id: "quiet-cafe",
    distance: "徒歩6分",
    open: "営業中",
    safe: "安全にいける",
    kind: "昔ながらの喫茶店",
    seedNames: ["午後が好きになる場所", "帰り道が少し遅くなる場所"],
  },
  {
    id: "book-room",
    distance: "徒歩9分",
    open: "営業中",
    safe: "安全にいける",
    kind: "小さな本屋",
    seedNames: ["知らない棚に呼ばれる場所", "雨の日を待ちたくなる場所"],
  },
  {
    id: "corner-gallery",
    distance: "徒歩13分",
    open: "営業中",
    safe: "安全にいける",
    kind: "小さな個展",
    seedNames: ["誰かの午後をのぞく場所", "白い壁が静かな場所"],
  },
  {
    id: "evening-seat",
    distance: "徒歩5分",
    open: "営業中",
    safe: "安全にいける",
    kind: "夕方に寄れる場所",
    seedNames: ["帰る前に呼吸する場所", "空の色を持ち帰る場所"],
  },
];

const state = {
  current: 1,
  locationStatus: "idle",
  selectedPlaceIndex: -1,
  lastPlaceId: loadLastPlaceId(),
  notificationTime: makeRandomNotificationTime(),
  declined: false,
  proposedName: "",
  photoData: "",
  photoName: "",
  savedEntryId: "",
  names: loadNames(),
};

const screen = document.getElementById("screen");
const progress = document.getElementById("progress");
const toast = document.getElementById("toast");

function loadNames() {
  try {
    const raw = window.localStorage.getItem(NAMES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.placeId && item.name) : [];
  } catch {
    return [];
  }
}

function saveNames() {
  try {
    window.localStorage.setItem(NAMES_KEY, JSON.stringify(state.names));
  } catch {
    state.names = state.names.map((item) => ({ ...item, photoData: "" }));
    try {
      window.localStorage.setItem(NAMES_KEY, JSON.stringify(state.names));
    } catch {
      // The prototype still works if browser storage is unavailable.
    }
  }
}

function loadLastPlaceId() {
  try {
    return window.localStorage.getItem(LAST_PLACE_KEY) || "";
  } catch {
    return "";
  }
}

function saveLastPlaceId(placeId) {
  state.lastPlaceId = placeId;
  try {
    window.localStorage.setItem(LAST_PLACE_KEY, placeId);
  } catch {
    // The next candidate still changes within the current session.
  }
}

function makeRandomNotificationTime() {
  const hour = 8 + Math.floor(Math.random() * 14);
  const minute = Math.floor(Math.random() * 60);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function getTodayLabel() {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(new Date());
}

function getPlace() {
  if (state.selectedPlaceIndex < 0) return null;
  return places[state.selectedPlaceIndex];
}

function chooseCandidate() {
  const pool = places.filter((place) => place.id !== state.lastPlaceId);
  const choices = pool.length ? pool : places;
  const picked = choices[Math.floor(Math.random() * choices.length)];
  state.selectedPlaceIndex = places.findIndex((place) => place.id === picked.id);
  saveLastPlaceId(picked.id);
  return picked;
}

function getNamesForPlace(place) {
  const seeds = place.seedNames.map((name, index) => ({
    id: `seed-${place.id}-${index}`,
    name,
    photoData: "",
    mine: false,
  }));

  const added = state.names
    .filter((item) => item.placeId === place.id)
    .map((item) => ({ ...item, mine: item.id === state.savedEntryId }));

  return [...seeds, ...added];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function renderProgress() {
  progress.innerHTML = Array.from({ length: TOTAL_STEPS }, (_, index) => {
    const step = index + 1;
    return `<span><i style="width:${step <= state.current ? "100%" : "0%"}"></i></span>`;
  }).join("");
}

function header(step, title, text) {
  const mark = step === 1 ? "?" : step === 2 ? "名" : "店";
  return `
    <div class="screen-head">
      <div>
        <div class="step-label">PAGE ${step} / ${TOTAL_STEPS}</div>
        <h2>${escapeHtml(title)}</h2>
      </div>
      <div class="mark" aria-hidden="true">${mark}</div>
    </div>
    <p class="whisper">${escapeHtml(text)}</p>
  `;
}

function renderGate() {
  const place = getPlace();
  const hasCandidate = Boolean(place) && state.locationStatus === "ready";
  const statusText = {
    idle: "アプリ使用中のみ現在地を許可すると、候補を1つだけ決めます。",
    locating: "アプリ使用中の現在地を確認しています。",
    ready: "候補を1つ決めました。ここでは場所の名前を表示しません。",
    blocked: "アプリ使用中のみ現在地を許可しないと、このアプリは使えません。",
  }[state.locationStatus];

  const candidate = hasCandidate
    ? `
      <div class="secret-card">
        <span class="tiny-label">${escapeHtml(getTodayLabel())}</span>
        <strong>${escapeHtml(place.distance)}</strong>
        <p>まだ誰かの特別になってない場所です。</p>
      </div>

      <div class="status-row" aria-label="表示される情報">
        <span>${escapeHtml(place.distance)}</span>
        <span>${escapeHtml(place.open)}</span>
        <span>${escapeHtml(place.safe)}</span>
      </div>
    `
    : "";

  const decline = state.declined
    ? `
      <div class="quiet-reply">
        <strong>今日は見送りました。</strong>
        <p>また別のタイミングで、候補を1つだけ決められます。</p>
        <button class="btn subtle" data-action="reset" type="button">通知を待つ</button>
      </div>
    `
    : "";

  return `
    ${header(1, "今日の候補", "アプリ使用中のみ現在地を許可すると、候補を1つ決めます。")}
    <article class="panel">
      <div class="notice">
        <span class="eyebrow">UNDISCOVERED</span>
        <strong>今日の通知が届きました</strong>
        <p>${escapeHtml(state.notificationTime)} / ランダム通知</p>
      </div>

      ${candidate}

      <div class="location-card">
        <span class="tiny-label">現在地</span>
        <strong>${escapeHtml(statusText)}</strong>
        <button class="btn subtle" data-action="locate" type="button">
          ${hasCandidate ? "候補を決め直す" : "現在地のアプリ使用中のみ許可してはじめる"}
        </button>
      </div>

      <div class="place-card">
        <span class="tiny-label">名前</span>
        <strong>まだありません</strong>
      </div>

      ${decline}

      <div class="actions">
        <button class="btn primary" data-action="${hasCandidate ? "go-name" : "locate"}" type="button">
          ${hasCandidate ? "行ってみる" : "現在地のアプリ使用中のみ許可してはじめる"}
        </button>
        <button class="btn secondary" data-action="decline" type="button">また今度</button>
      </div>
    </article>
  `;
}

function renderNaming() {
  const place = getPlace();
  if (!place) return renderGate();

  const remaining = 20 - state.proposedName.length;
  const photo = state.photoData
    ? `<img class="photo-preview" src="${escapeHtml(state.photoData)}" alt="選んだ写真" />`
    : `<div class="photo-empty">写真1枚</div>`;

  return `
    ${header(2, "名前を付ける", "レビューの代わりに、ひとつだけ名前を残します。")}
    <article class="panel">
      <div class="place-card">
        <span class="tiny-label">到着した場所</span>
        <strong>未発見の場所</strong>
        <p>${escapeHtml(place.kind)}</p>
      </div>

      <label class="field-card">
        <span class="tiny-label">この場所の名前</span>
        <input data-field="name" maxlength="20" value="${escapeHtml(state.proposedName)}" placeholder="午後が好きになる場所" />
        <small>あと${remaining}字</small>
      </label>

      <label class="photo-card">
        <span class="tiny-label">写真は1枚だけ</span>
        ${photo}
        <input data-field="photo" accept="image/*" type="file" />
      </label>

      <div class="rule-row">
        <span>理由なし</span>
        <span>評価なし</span>
        <span>点数なし</span>
      </div>

      <div class="actions">
        <button class="btn primary" data-action="save-name" type="button">名前を残す</button>
        <button class="btn secondary" data-action="back" type="button">戻る</button>
      </div>
    </article>
  `;
}

function renderShop() {
  const place = getPlace();
  if (!place) return renderGate();

  const names = getNamesForPlace(place);
  const cards = names.map((entry) => `
    <article class="name-card ${entry.mine ? "mine" : ""}">
      ${entry.photoData ? `<img src="${escapeHtml(entry.photoData)}" alt="" />` : `<div class="name-thumb">名</div>`}
      <div>
        <span class="tiny-label">${entry.mine ? "あなたが付けた名前" : "誰かが付けた名前"}</span>
        <strong>${escapeHtml(entry.name)}</strong>
      </div>
    </article>
  `).join("");

  return `
    ${header(3, "お店を開く", "見えるのは、評価ではなく誰かが付けた名前です。")}
    <article class="panel">
      <div class="place-card">
        <span class="tiny-label">${escapeHtml(place.kind)}</span>
        <strong>未発見の場所</strong>
      </div>

      <div class="name-count">
        <span class="tiny-label">この場所に付いた名前</span>
        <strong>${names.length}個</strong>
      </div>

      <div class="name-list">${cards}</div>

      <div class="actions">
        <button class="btn primary" data-action="add-name" type="button">新しい名前を付ける</button>
        <button class="btn secondary" data-action="reset" type="button">次の通知</button>
      </div>
    </article>
  `;
}

function render() {
  renderProgress();
  const views = {
    1: renderGate,
    2: renderNaming,
    3: renderShop,
  };
  screen.innerHTML = views[state.current]();
}

function goTo(step) {
  state.current = Math.max(1, Math.min(TOTAL_STEPS, step));
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function locate() {
  if (!navigator.geolocation) {
    state.locationStatus = "blocked";
    render();
    showToast("現在地が使えない環境では利用できません。");
    return;
  }

  state.locationStatus = "locating";
  state.selectedPlaceIndex = -1;
  render();

  navigator.geolocation.getCurrentPosition(
    () => {
      const picked = chooseCandidate();
      state.locationStatus = "ready";
      render();
      showToast(`${picked.distance}の候補を1つ決めました。`);
    },
    () => {
      state.locationStatus = "blocked";
      state.selectedPlaceIndex = -1;
      render();
      showToast("アプリ使用中のみ現在地を許可しないと利用できません。");
    },
    { enableHighAccuracy: false, maximumAge: 300000, timeout: 6000 },
  );
}

function resetCandidate() {
  state.current = 1;
  state.locationStatus = "idle";
  state.selectedPlaceIndex = -1;
  state.declined = false;
  state.notificationTime = makeRandomNotificationTime();
  state.proposedName = "";
  state.photoData = "";
  state.photoName = "";
  state.savedEntryId = "";
  render();
}

function saveName() {
  const place = getPlace();
  const name = state.proposedName.trim();

  if (!place) {
    showToast("アプリ使用中のみ現在地を許可して候補を決めてください。");
    goTo(1);
    return;
  }

  if (!name) {
    showToast("20字までで名前を付けてください。");
    return;
  }

  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    placeId: place.id,
    name: name.slice(0, 20),
    photoData: state.photoData,
    photoName: state.photoName,
    createdAt: new Date().toISOString(),
  };

  state.names.push(entry);
  state.savedEntryId = entry.id;
  saveNames();
  goTo(3);
  showToast("名前がひとつ増えました。");
}

screen.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  if (action === "locate") locate();
  if (action === "go-name") goTo(2);
  if (action === "decline") {
    state.declined = true;
    render();
    showToast("今日はまた今度にしました。");
  }
  if (action === "save-name") saveName();
  if (action === "back") goTo(1);
  if (action === "add-name") {
    state.proposedName = "";
    state.photoData = "";
    state.photoName = "";
    goTo(2);
  }
  if (action === "reset") resetCandidate();
});

screen.addEventListener("input", (event) => {
  const input = event.target.closest("[data-field='name']");
  if (!input) return;

  state.proposedName = input.value.slice(0, 20);
  input.value = state.proposedName;
  const counter = input.parentElement.querySelector("small");
  if (counter) counter.textContent = `あと${20 - state.proposedName.length}字`;
});

screen.addEventListener("change", (event) => {
  const input = event.target.closest("[data-field='photo']");
  if (!input || !input.files || !input.files[0]) return;

  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = () => {
    state.photoData = String(reader.result || "");
    state.photoName = file.name;
    render();
  };
  reader.readAsDataURL(file);
});

render();

window.setTimeout(() => {
  showToast(`UNDISCOVERED ${state.notificationTime} に通知が届きました。`);
}, 800 + Math.floor(Math.random() * 1200));
