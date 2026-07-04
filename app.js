const SAVE_KEY = "baito_reward_carpet_v1";
const MINUTES_FOR_BREAK = 360;

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
  breakEnd: "12:30",
  progressPercent: 58,
  leftMinutes: 260,
  restSeconds: 1530,
  ticketCount: 0,
  cheerIndex: 0,
  claimedToday: false,
  claimedDate: "",
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
normalizeState();
render();
setInterval(tickRestTimer, 1000);
setInterval(tickShiftMinute, 1000);

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
  if (!canTakeBreak() && (view === "break" || view === "rest")) {
    view = "progress";
  }
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

function todayKey() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

function canTakeBreak() {
  return minutesBetween(state.shiftStart, state.shiftEnd) >= MINUTES_FOR_BREAK;
}

function hasClaimedCakeToday() {
  return state.claimedDate === todayKey();
}

function normalizeState() {
  if (!state.breakEnd) {
    syncBreakEndFromDuration();
  } else {
    syncBreakDurationFromTimes();
  }

  if (!state.claimedDate && state.claimedToday) {
    state.claimedDate = todayKey();
  }

  if (!canTakeBreak() && (state.view === "break" || state.view === "rest")) {
    state.view = "progress";
  }

  if (hasClaimedCakeToday()) {
    state.claimedToday = true;
  }
}

function syncShiftProgress(resetProgress = false) {
  const total = minutesBetween(state.shiftStart, state.shiftEnd);
  if (resetProgress) {
    state.progressPercent = 0;
    state.leftMinutes = total;
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

function breakEndTime() {
  return state.breakEnd || addMinutes(state.selectedSlot, state.selectedBreak);
}

function syncBreakEndFromDuration() {
  state.breakEnd = addMinutes(state.selectedSlot, state.selectedBreak);
}

function syncBreakDurationFromTimes() {
  const duration = minutesBetween(state.selectedSlot, breakEndTime());
  state.selectedBreak = Math.max(1, Math.min(240, duration));
  state.breakEnd = addMinutes(state.selectedSlot, state.selectedBreak);
}

function hasShiftTimeLeft() {
  return state.leftMinutes > 0;
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
    finishRestAndContinue();
  }
}

function tickShiftMinute() {
  if (state.view !== "progress" || !hasShiftTimeLeft()) return;

  advanceShift(1);
  if (hasShiftTimeLeft()) {
    saveState();
    render();
    return;
  }

  state.progressPercent = 100;
  saveState();
  setView("arrival");
  showToast("バイト終了！ごほうび会場に到着しました");
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
  const breakAvailable = canTakeBreak();
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
        <button class="main-button" type="button" data-action="${breakAvailable ? "start" : "go-progress"}">★ レッドカーペット開始</button>
        ${
          breakAvailable
            ? '<button class="sub-button" type="button" data-action="open-break">休憩時間をえらぶ</button>'
            : '<p class="pill">6時間未満なので休憩なしで進みます</p>'
        }
      </div>
    </article>
  `;
}

function renderBreakChoice() {
  const optionButtons = breakOptions
    .map(
      (minutes) => `
        <button class="break-option ${minutes === state.selectedBreak ? "active" : ""}" type="button" data-action="select-break" data-minutes="${minutes}">
          <span>${minutes}</span>分
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
      <div class="slot-grid break-time-grid">
        <label class="time-box time-edit">
          <span class="time-icon">◷</span>
          <span>
            <span class="time-label">休憩開始</span>
            <input class="time-input" type="time" data-field="breakStart" value="${state.selectedSlot}" />
          </span>
        </label>
        <label class="time-box time-edit">
          <span class="time-icon">◴</span>
          <span>
            <span class="time-label">休憩終了</span>
            <input class="time-input" type="time" data-field="breakEnd" value="${breakEndTime()}" />
          </span>
        </label>
      </div>

      <section class="rest-summary card">
        <div class="clock-face">⏰</div>
        <div>
          <strong>休憩時間</strong>
          <p>${state.selectedSlot}〜${breakEndTime()} / ${state.selectedBreak}分</p>
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
  const breakAvailable = canTakeBreak();
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
        <button class="main-button" type="button" data-action="${breakAvailable ? "enter-rest" : "finish-no-break"}">
          ${breakAvailable ? "休憩に入る" : "ごほうび会場へ"}
        </button>
        <button class="sub-button" type="button" data-action="advance">1分進める</button>
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
  const claimed = hasClaimedCakeToday();
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
        <p>今日のケーキ券 <strong>${claimed ? "受け取り済み" : "1枚"}</strong></p>
      </section>

      <div class="button-stack">
        <button class="main-button" type="button" data-action="claim">${claimed ? "今日は受け取り済み" : "ケーキ券を受け取る"}</button>
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
        <p>今日の受け取り ${hasClaimedCakeToday() ? "1/1" : "0/1"}</p>
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
          <strong>今日の受け取り</strong>
          <span>${hasClaimedCakeToday() ? "1/1" : "0/1"}</span>
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

function finishRestAndContinue() {
  advanceShift(state.selectedBreak);

  if (hasShiftTimeLeft()) {
    setView("progress");
    showToast("休憩終了。バイトに戻ります");
    return;
  }

  setView("arrival");
  showToast("バイト終了！ごほうび会場に到着しました");
}

screen.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const action = button.dataset.action;

  if (action === "start" || action === "open-break") {
    if (canTakeBreak()) {
      setView("break");
      showToast("休憩時間をえらびましょう");
    } else {
      advanceShift(0);
      setView("progress");
      showToast("6時間未満なので休憩なしで進みます");
    }
  }

  if (action === "select-break") {
    state.selectedBreak = Number(button.dataset.minutes);
    syncBreakEndFromDuration();
    saveState();
    render();
  }

  if (action === "select-slot") {
    state.selectedSlot = button.dataset.slot;
    syncBreakEndFromDuration();
    saveState();
    render();
  }

  if (action === "go-progress") {
    advanceShift(0);
    setView("progress");
    showToast("レッドカーペットへ向かっています！");
  }

  if (action === "advance") {
    advanceShift(1);
    saveState();
    if (hasShiftTimeLeft()) {
      render();
      showToast("1分進みました");
    } else {
      state.progressPercent = 100;
      setView("arrival");
      showToast("バイト終了！ごほうび会場に到着しました");
    }
  }

  if (action === "enter-rest") {
    if (canTakeBreak()) {
      prepareRestTimer();
      setView("rest");
      showToast("休憩に入りました");
    } else {
      setView("arrival");
      showToast("ごほうび会場に到着しました！");
    }
  }

  if (action === "finish-no-break") {
    setView("arrival");
    showToast("ごほうび会場に到着しました！");
  }

  if (action === "add-rest-minute") {
    state.selectedBreak += 1;
    syncBreakEndFromDuration();
    state.restSeconds += 60;
    saveState();
    render();
    showToast("1分だけ延長しました");
  }

  if (action === "finish-rest") {
    finishRestAndContinue();
  }

  if (action === "claim") {
    let message = "ケーキ券は今日は受け取り済みです";
    if (!hasClaimedCakeToday()) {
      state.ticketCount += 1;
      state.claimedToday = true;
      state.claimedDate = todayKey();
      message = "ケーキ券を受け取りました！";
    }
    state.cheerIndex = Math.floor(Math.random() * cheerCards.length);
    setView("get");
    showToast(message);
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
    state.cheerIndex = 0;
    saveState();
    render();
    showToast("今日の記録をリセットしました");
  }
});

screen.addEventListener("change", (event) => {
  const input = event.target.closest("[data-field]");
  if (!input) return;

  const field = input.dataset.field;
  if (!["shiftStart", "shiftEnd", "breakStart", "breakEnd"].includes(field)) return;
  if (!input.value) return;

  if (field === "shiftStart" || field === "shiftEnd") {
    state[field] = input.value;
    syncShiftProgress(true);
    state.selectedSlot = buildBreakSlots()[0];
    syncBreakEndFromDuration();
  }

  if (field === "breakStart") {
    state.selectedSlot = input.value;
    syncBreakDurationFromTimes();
  }

  if (field === "breakEnd") {
    state.breakEnd = input.value;
    syncBreakDurationFromTimes();
  }

  state.restSeconds = Math.max(60, state.selectedBreak * 60);
  saveState();
  render();
  showToast(field === "breakStart" || field === "breakEnd" ? "休憩時間を更新しました" : "バイト時間を更新しました");
});

tabbar.addEventListener("click", (event) => {
  const button = event.target.closest("[data-nav]");
  if (!button) return;
  if (button.dataset.nav === "nominate" && !canTakeBreak()) {
    showToast("6時間未満なので休憩はありません");
    setView("progress");
    return;
  }
  setView(navToView[button.dataset.nav] || "home");
});
