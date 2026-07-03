const SAVE_KEY = "baito_reward_carpet_v1";

const breakOptions = [15, 30, 45, 60];
const cheerCards = [
  {
    title: "会場に到着しました",
    body: "今日のがんばりを、ちゃんとごほうびに変換しました。",
    stars: 1,
  },
  {
    title: "休憩をえらべたカード",
    body: "忙しい日でも、自分のペースを選べたのがえらい。",
    stars: 2,
  },
  {
    title: "レッドカーペット歩行賞",
    body: "出勤から退勤まで、あなたは今日も主役でした。",
    stars: 3,
  },
];

const state = {
  view: "home",
  shiftStart: "09:00",
  shiftEnd: "17:00",
  selectedBreak: 30,
  selectedSlot: "12:00",
  progressPercent: 58,
  leftMinutes: 260,
  restSeconds: 1530,
  ticketCount: 0,
  cheerIndex: 0,
  claimedToday: false,
};

const navToView = {
  home: "home",
  nominate: "break",
  cheer: "arrival",
  roulette: "cards",
  profile: "profile",
};

const viewToNav = {
  home: "home",
  break: "nominate",
  progress: "home",
  rest: "nominate",
  arrival: "cheer",
  get: "cheer",
  cards: "roulette",
  profile: "profile",
};

const screen = document.getElementById("screen");
const toast = document.getElementById("toast");
const tabbar = document.querySelector(".tabbar");

loadState();
render();
setInterval(tickRestTimer, 1000);

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
    Object.assign(state, saved);
  } catch {
    // The prototype can run without stored state.
  }
}

function saveState() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Ignore private browsing or storage limits.
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function setView(view) {
  state.view = view;
  saveState();
  render();
  screen.scrollTop = 0;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function minutesBetween(start, end) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMinutes = sh * 60 + sm;
  let endMinutes = eh * 60 + em;
  if (endMinutes <= startMinutes) endMinutes += 24 * 60;
  return endMinutes - startMinutes;
}

function addMinutes(time, minutes) {
  const [hour, minute] = time.split(":").map(Number);
  const total = (hour * 60 + minute + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}時間${String(mins).padStart(2, "0")}分`;
}

function formatTimer(seconds) {
  const safe = Math.max(0, seconds);
  const hh = Math.floor(safe / 3600);
  const mm = Math.floor((safe % 3600) / 60);
  const ss = safe % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function shiftLeftText() {
  const hours = Math.floor(state.leftMinutes / 60);
  const minutes = state.leftMinutes % 60;
  return `${hours}時間${minutes}分`;
}

function syncShiftProgress(resetProgress = false) {
  const total = minutesBetween(state.shiftStart, state.shiftEnd);
  if (resetProgress) {
    state.progressPercent = 0;
    state.leftMinutes = total;
    state.claimedToday = false;
    return;
  }
  state.leftMinutes = Math.max(0, Math.round(total * (1 - state.progressPercent / 100)));
}

function buildBreakSlots() {
  const total = minutesBetween(state.shiftStart, state.shiftEnd);
  const latestOffset = Math.max(15, total - state.selectedBreak);
  const firstOffset = Math.min(latestOffset, Math.max(30, Math.round(total * 0.38)));
  const secondOffset = Math.min(latestOffset, Math.max(firstOffset + state.selectedBreak, Math.round(total * 0.72)));
  const slots = [addMinutes(state.shiftStart, firstOffset), addMinutes(state.shiftStart, secondOffset)];
  return [...new Set(slots)];
}

function tickRestTimer() {
  if (state.view !== "rest" || state.restSeconds <= 0) return;
  state.restSeconds -= 1;
  const timer = document.querySelector("[data-timer]");
  const fill = document.querySelector("[data-rest-fill]");
  if (timer) timer.textContent = formatTimer(state.restSeconds);
  if (fill) {
    const total = Math.max(60, state.selectedBreak * 60);
    fill.style.width = `${Math.max(0, Math.min(100, (state.restSeconds / total) * 100))}%`;
  }
  if (state.restSeconds === 0) {
    showToast("休憩時間が終わりました。会場へ向かいます！");
    state.view = "arrival";
    saveState();
    render();
  }
}

function render() {
  const views = {
    home: renderHome,
    break: renderBreakChoice,
    progress: renderProgress,
    rest: renderRest,
    arrival: renderArrival,
    get: renderGet,
    cards: renderCards,
    profile: renderProfile,
  };

  screen.innerHTML = views[state.view] ? views[state.view]() : renderHome();
  updateTabs();
}

function updateTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.nav === viewToNav[state.view]);
  });
}

function mascot(extraClass = "") {
  return `
    <div class="mascot ${extraClass}" aria-hidden="true">
      <div class="cape"></div>
      <div class="heart-stick"></div>
    </div>
  `;
}

function artPanel(name, label) {
  return `<figure class="art-panel art-${name}" role="img" aria-label="${escapeHtml(label)}"></figure>`;
}

function screenTitle(title, kicker = "") {
  return `
    <h1 class="screen-title">${title}</h1>
    ${kicker ? `<p class="title-kicker">${kicker}</p>` : ""}
  `;
}

function renderHome() {
  const plannedMinutes = minutesBetween(state.shiftStart, state.shiftEnd);
  return `
    <article class="page">
      <h1 class="hero-title">今日の<br />バイト予定</h1>
      ${artPanel("home", "今日のバイト予定のイラスト")}

      <section class="schedule-card" aria-label="バイト予定">
        <label class="time-box time-edit">
          <span class="time-icon">◷</span>
          <span>
            <span class="time-label">バイト開始</span>
            <input class="time-input" type="time" data-field="shiftStart" value="${state.shiftStart}" />
          </span>
        </label>
        <label class="time-box time-edit">
          <span class="time-icon">◴</span>
          <span>
            <span class="time-label">バイト終了</span>
            <input class="time-input" type="time" data-field="shiftEnd" value="${state.shiftEnd}" />
          </span>
        </label>
        <div class="total-time">
          <span>予定時間</span>
          <span>${formatDuration(plannedMinutes)}</span>
        </div>
      </section>

      <div class="button-stack">
        <button class="main-button" type="button" data-action="start">★ レッドカーペット開始</button>
        <button class="sub-button" type="button" data-action="open-break">休憩時間をえらぶ</button>
      </div>
    </article>
  `;
}

function renderBreakChoice() {
  const breakSlots = buildBreakSlots();
  if (!breakSlots.includes(state.selectedSlot)) {
    state.selectedSlot = breakSlots[0];
  }

  const optionButtons = breakOptions
    .map(
      (minutes) => `
        <button class="break-option ${minutes === state.selectedBreak ? "active" : ""}" type="button" data-action="select-break" data-minutes="${minutes}">
          <span>${minutes}</span>分
        </button>
      `,
    )
    .join("");

  const slots = breakSlots
    .map(
      (slot) => `
        <button class="slot-button ${slot === state.selectedSlot ? "active" : ""}" type="button" data-action="select-slot" data-slot="${slot}">
          休憩の開始
          <span>${slot}</span>
          休憩の終了 ${addMinutes(slot, state.selectedBreak)}
        </button>
      `,
    )
    .join("");

  return `
    <article class="page">
      ${screenTitle("休憩時間をえらぶ", "自分のペースで、快適に進みます")}
      ${artPanel("break", "休憩時間をえらぶイラスト")}
      <p class="pill">自分のペースでがんばろう！</p>
      <div class="break-options" aria-label="休憩時間">${optionButtons}</div>
      <div class="slot-grid">${slots}</div>

      <section class="rest-summary card">
        <div class="clock-face">⏰</div>
        <div>
          <strong>休憩時間</strong>
          <p>${state.selectedSlot}〜${addMinutes(state.selectedSlot, state.selectedBreak)} / ${state.selectedBreak}分</p>
        </div>
      </section>

      <div class="button-stack">
        <button class="main-button" type="button" data-action="go-progress">この休憩で進む</button>
        <button class="ghost-button" type="button" data-action="home">予定に戻る</button>
      </div>
    </article>
  `;
}

function renderProgress() {
  return `
    <article class="page">
      ${screenTitle("進行中", "レッドカーペットへ向かおう！")}
      ${artPanel("progress", "レッドカーペット進行中のイラスト")}

      <section class="route-card">
        <div class="route-head">
          <span>バイト時間　${state.shiftStart}〜${state.shiftEnd}</span>
          <span>${state.progressPercent}%</span>
        </div>
        <div class="meter">
          <div class="meter-fill" style="width: ${state.progressPercent}%"></div>
        </div>
        <div class="route-stats">
          <div class="mini-stat">
            経過
            <span>${formatDuration(minutesBetween(state.shiftStart, state.shiftEnd) - state.leftMinutes)}</span>
          </div>
          <div class="mini-stat">
            残り
            <span>${shiftLeftText()}</span>
          </div>
        </div>
      </section>

      <div class="button-stack">
        <button class="main-button" type="button" data-action="enter-rest">休憩に入る</button>
        <button class="sub-button" type="button" data-action="advance">10分進める</button>
      </div>
    </article>
  `;
}

function renderRest() {
  return `
    <article class="page">
      ${screenTitle("休憩中", "リフレッシュしよう！")}
      ${artPanel("rest", "休憩中のイラスト")}

      <section class="timer-card card">
        <strong>休憩時間残り</strong>
        <div class="timer" data-timer>${formatTimer(state.restSeconds)}</div>
        <div class="meter">
          <div class="meter-fill" data-rest-fill style="width: ${Math.min(100, (state.restSeconds / (state.selectedBreak * 60)) * 100)}%"></div>
        </div>
      </section>

      <div class="button-stack">
        <button class="main-button" type="button" data-action="finish-rest">休憩を終える</button>
        <button class="sub-button" type="button" data-action="add-rest-minute">1分だけ延長</button>
      </div>
    </article>
  `;
}

function renderArrival() {
  return `
    <article class="page">
      <section class="notice-card">
        <span class="notice-icon">🍰</span>
        <span>
          <strong>レッドカーペット</strong>
          <p>おつかれさま！会場に到着しました</p>
        </span>
        <span class="notice-now">now</span>
      </section>

      <h1 class="hero-title">バイト<br />おつかれさま！</h1>
      ${artPanel("arrival", "ごほうび到着のイラスト")}

      <section class="ticket-card">
        <strong>ごほうび到着！</strong>
        <div class="cake-ticket"></div>
        <p>ケーキ券 <strong>1枚</strong></p>
      </section>

      <div class="button-stack">
        <button class="main-button" type="button" data-action="claim">ケーキ券を受け取る</button>
        <button class="ghost-button" type="button" data-action="cards">応援カードを見る</button>
      </div>
    </article>
  `;
}

function renderGet() {
  const card = cheerCards[state.cheerIndex];
  return `
    <article class="page">
      <h1 class="get-title">ごほうびGET!</h1>
      <p class="pill">レッドカーペット会場に到着しました！</p>
      ${artPanel("get", "ごほうびGETのイラスト")}

      <section class="ticket-card ticket-large">
        <strong>ケーキ券</strong>
        <div class="ticket-count">${state.ticketCount}枚</div>
        <div class="cake-ticket"></div>
      </section>

      <section class="cheer-card">
        <strong>応援カード</strong>
        <p>${escapeHtml(card.title)}</p>
        <div class="star-row">${renderStars(card.stars)}</div>
      </section>

      <div class="button-stack">
        <button class="main-button" type="button" data-action="home">ホームに戻る</button>
        <button class="sub-button" type="button" data-action="new-card">応援カードを引く</button>
      </div>
    </article>
  `;
}

function renderCards() {
  const cards = cheerCards
    .map(
      (card, index) => `
        <section class="cheer-card">
          <strong>${escapeHtml(card.title)}</strong>
          <p>${escapeHtml(card.body)}</p>
          <div class="star-row">${renderStars(card.stars)}</div>
          <button class="sub-button" type="button" data-action="pick-card" data-index="${index}">このカードにする</button>
        </section>
      `,
    )
    .join("");

  return `
    <article class="page">
      ${screenTitle("応援カード", "今日もがんばったね！")}
      <div class="card-list">${cards}</div>
    </article>
  `;
}

function renderStars(count) {
  return Array.from({ length: 3 }, (_, index) => {
    const cls = index < count ? "star" : "star empty";
    return `<span class="${cls}">★</span>`;
  }).join("");
}

function renderProfile() {
  return `
    <article class="page">
      ${screenTitle("今日の記録", "バイトとごほうびのログ")}
      <section class="profile-card">
        <div class="profile-row">
          <strong>バイト予定</strong>
          <span>${state.shiftStart}〜${state.shiftEnd}</span>
        </div>
        <div class="profile-row">
          <strong>選んだ休憩</strong>
          <span>${state.selectedBreak}分</span>
        </div>
        <div class="profile-row">
          <strong>進行度</strong>
          <span>${state.progressPercent}%</span>
        </div>
        <div class="profile-row">
          <strong>ケーキ券</strong>
          <span>${state.ticketCount}枚</span>
        </div>
        <div class="profile-row">
          <strong>応援カード</strong>
          <span>${cheerCards[state.cheerIndex].title}</span>
        </div>
      </section>

      <div class="button-stack">
        <button class="main-button" type="button" data-action="home">ホームへ</button>
        <button class="sub-button" type="button" data-action="reset">今日をリセット</button>
      </div>
    </article>
  `;
}

function prepareRestTimer() {
  const demoElapsed = 270;
  state.restSeconds = Math.max(60, state.selectedBreak * 60 - demoElapsed);
}

function advanceShift(minutes) {
  state.leftMinutes = Math.max(0, state.leftMinutes - minutes);
  const worked = minutesBetween(state.shiftStart, state.shiftEnd) - state.leftMinutes;
  state.progressPercent = Math.max(0, Math.min(100, Math.round((worked / minutesBetween(state.shiftStart, state.shiftEnd)) * 100)));
}

screen.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const action = button.dataset.action;

  if (action === "start" || action === "open-break") {
    setView("break");
    showToast("休憩時間をえらびましょう");
  }

  if (action === "select-break") {
    state.selectedBreak = Number(button.dataset.minutes);
    state.selectedSlot = buildBreakSlots()[0];
    saveState();
    render();
  }

  if (action === "select-slot") {
    state.selectedSlot = button.dataset.slot;
    saveState();
    render();
  }

  if (action === "go-progress") {
    advanceShift(0);
    setView("progress");
    showToast("レッドカーペットへ向かっています！");
  }

  if (action === "advance") {
    advanceShift(10);
    saveState();
    render();
    showToast("10分進みました");
  }

  if (action === "enter-rest") {
    prepareRestTimer();
    setView("rest");
    showToast("休憩に入りました");
  }

  if (action === "add-rest-minute") {
    state.restSeconds += 60;
    saveState();
    render();
    showToast("1分だけ延長しました");
  }

  if (action === "finish-rest") {
    advanceShift(state.selectedBreak);
    setView("arrival");
    showToast("ごほうび会場に到着しました！");
  }

  if (action === "claim") {
    if (!state.claimedToday) {
      state.ticketCount += 1;
      state.claimedToday = true;
    }
    state.cheerIndex = Math.floor(Math.random() * cheerCards.length);
    setView("get");
    showToast("ケーキ券を受け取りました！");
  }

  if (action === "new-card") {
    state.cheerIndex = (state.cheerIndex + 1) % cheerCards.length;
    saveState();
    render();
  }

  if (action === "pick-card") {
    state.cheerIndex = Number(button.dataset.index);
    saveState();
    setView("get");
    showToast("応援カードをセットしました");
  }

  if (action === "cards") setView("cards");
  if (action === "home") setView("home");

  if (action === "reset") {
    state.view = "home";
    state.selectedBreak = 30;
    state.selectedSlot = "12:00";
    state.progressPercent = 58;
    state.leftMinutes = 260;
    state.restSeconds = 1530;
    state.ticketCount = 0;
    state.cheerIndex = 0;
    state.claimedToday = false;
    saveState();
    render();
    showToast("今日の記録をリセットしました");
  }
});

screen.addEventListener("change", (event) => {
  const input = event.target.closest("[data-field]");
  if (!input) return;

  const field = input.dataset.field;
  if (field !== "shiftStart" && field !== "shiftEnd") return;
  if (!input.value) return;

  state[field] = input.value;
  syncShiftProgress(true);
  state.selectedSlot = buildBreakSlots()[0];
  state.restSeconds = Math.max(60, state.selectedBreak * 60 - 270);
  state.claimedToday = false;
  saveState();
  render();
  showToast("バイト時間を更新しました");
});

tabbar.addEventListener("click", (event) => {
  const button = event.target.closest("[data-nav]");
  if (!button) return;
  setView(navToView[button.dataset.nav] || "home");
});
