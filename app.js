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
  secondBreakStart: "15:00",
  secondBreakEnd: "15:15",
  activeBreakIndex: 0,
  break1Done: false,
  break2Done: false,
  restElapsedSeconds: 0,
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
  profile: "profile",
};

const viewToNav = {
  home: "home",
  break: "nominate",
  progress: "home",
  rest: "nominate",
  arrival: "home",
  get: "home",
  profile: "profile",
};

const screen = document.getElementById("screen");
const toast = document.getElementById("toast");
const tabbar = document.querySelector(".tabbar");

loadState();
normalizeState();
render();
setInterval(tickRestTimer, 1000);
setInterval(tickShiftMinute, 60000);

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

  if (!state.secondBreakStart || !state.secondBreakEnd) {
    const slots = buildBreakSlots();
    state.secondBreakStart = slots[1] || addMinutes(state.selectedSlot, state.selectedBreak + 90);
    state.secondBreakEnd = addMinutes(state.secondBreakStart, 15);
  }

  if (!state.claimedDate && state.claimedToday) {
    state.claimedDate = todayKey();
  }

  if (!canTakeBreak() && (state.view === "break" || state.view === "rest")) {
    state.view = "progress";
  }

  if (state.view === "cards") {
    state.view = "home";
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

function resetBreakTimesForShift() {
  const slots = buildBreakSlots();
  state.selectedSlot = slots[0] || addMinutes(state.shiftStart, 60);
  syncBreakEndFromDuration();
  state.secondBreakStart = slots[1] || addMinutes(state.selectedSlot, state.selectedBreak + 90);
  state.secondBreakEnd = addMinutes(state.secondBreakStart, 15);
  state.break1Done = false;
  state.break2Done = false;
  state.activeBreakIndex = 0;
  state.restElapsedSeconds = 0;
}

function breakEndTime() {
  return state.breakEnd || addMinutes(state.selectedSlot, state.selectedBreak);
}

function secondBreakDuration() {
  return Math.max(1, Math.min(240, minutesBetween(state.secondBreakStart, state.secondBreakEnd)));
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

function nextBreakIndex() {
  if (!canTakeBreak()) return -1;
  if (!state.break1Done) return 0;
  if (!state.break2Done) return 1;
  return -1;
}

function activeBreakDuration() {
  return state.activeBreakIndex === 1 ? secondBreakDuration() : state.selectedBreak;
}

function activeBreakLabel() {
  return state.activeBreakIndex === 1 ? "休憩2" : "休憩1";
}

function markActiveBreakDone() {
  if (state.activeBreakIndex === 1) {
    state.break2Done = true;
  } else {
    state.break1Done = true;
  }
}

function tickRestTimer() {
  if (state.view !== "rest" || state.restSeconds <= 0) return;
  state.restSeconds -= 1;
  state.restElapsedSeconds += 1;

  if (state.restElapsedSeconds % 60 === 0) {
    advanceShift(1);
    if (!hasShiftTimeLeft()) {
      state.progressPercent = 100;
      finishRestAndContinue();
      return;
    }
  }

  const timer = document.querySelector("[data-timer]");
  const fill = document.querySelector("[data-rest-fill]");
  if (timer) timer.textContent = formatTimer(state.restSeconds);
  if (fill) {
    const total = Math.max(60, activeBreakDuration() * 60);
    fill.style.width = `${Math.max(0, Math.min(100, (state.restSeconds / total) * 100))}%`;
  }
  if (state.restSeconds === 0) {
    finishRestAndContinue();
    return;
  }
  saveState();
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

function artPanel(name, label, extraClass = "") {
  const classes = ["art-panel", `art-${name}`, extraClass].filter(Boolean).join(" ");
  return `<figure class="${classes}" role="img" aria-label="${escapeHtml(label)}"></figure>`;
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
  const firstEnd = breakEndTime();
  const secondDuration = secondBreakDuration();
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

      <section class="break-edit-card card">
        <div class="break-card-head">
          <strong>休憩1</strong>
          <span>${state.selectedBreak}分</span>
        </div>
        <div class="break-options" aria-label="休憩1の長さ">${optionButtons}</div>
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
              <input class="time-input" type="time" data-field="breakEnd" value="${firstEnd}" />
            </span>
          </label>
        </div>
      </section>

      <section class="break-edit-card card">
        <div class="break-card-head">
          <strong>休憩2</strong>
          <span>${secondDuration}分</span>
        </div>
        <div class="slot-grid break-time-grid">
          <label class="time-box time-edit">
            <span class="time-icon">◷</span>
            <span>
              <span class="time-label">休憩開始</span>
              <input class="time-input" type="time" data-field="secondBreakStart" value="${state.secondBreakStart}" />
            </span>
          </label>
          <label class="time-box time-edit">
            <span class="time-icon">◴</span>
            <span>
              <span class="time-label">休憩終了</span>
              <input class="time-input" type="time" data-field="secondBreakEnd" value="${state.secondBreakEnd}" />
            </span>
          </label>
        </div>
      </section>

      <section class="rest-summary card">
        <div class="clock-face">⏰</div>
        <div>
          <strong>今日の休憩</strong>
          <p>休憩1 ${state.selectedSlot}〜${firstEnd} / 休憩2 ${state.secondBreakStart}〜${state.secondBreakEnd}</p>
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
  const breakIndex = nextBreakIndex();
  const breakButton = breakIndex >= 0
    ? `<button class="main-button" type="button" data-action="enter-rest" data-break-index="${breakIndex}">休憩${breakIndex + 1}に入る</button>`
    : '<p class="pill">バイト中は60秒ごとに1分進みます</p>';
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
        ${breakButton}
      </div>
    </article>
  `;
}

function renderRest() {
  const duration = activeBreakDuration();
  const total = Math.max(60, duration * 60);
  const card = cheerCards[state.cheerIndex];
  return `
    <article class="page">
      ${screenTitle("休憩中", "リフレッシュしよう！")}
      ${artPanel("rest", "休憩中のイラスト")}

      <section class="timer-card card">
        <strong>${activeBreakLabel()} 残り</strong>
        <div class="timer" data-timer>${formatTimer(state.restSeconds)}</div>
        <div class="meter">
          <div class="meter-fill" data-rest-fill style="width: ${Math.min(100, (state.restSeconds / total) * 100)}%"></div>
        </div>
        <p>休憩中も60秒ごとにバイト時間が進みます</p>
      </section>

      <section class="cheer-card rest-cheer">
        <strong>応援カード</strong>
        <p>${escapeHtml(card.body)}</p>
        <div class="star-row">${renderStars(card.stars)}</div>
      </section>

      <div class="button-stack">
        <p class="pill">休憩が終わると自動で戻ります</p>
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
      <div class="red-arrival-wrap">
        ${artPanel("arrival", "ごほうび到着のイラスト", "art-large")}
      </div>

      <section class="ticket-card">
        <strong>ごほうび到着！</strong>
        <div class="cake-ticket"></div>
      </section>

      <div class="button-stack">
        <button class="main-button" type="button" data-action="claim">ごほうびを受け取る</button>
      </div>
    </article>
  `;
}

function renderGet() {
  return `
    <article class="page">
      <h1 class="get-title">ごほうびGET!</h1>
      <p class="pill">レッドカーペット会場に到着しました！</p>
      ${artPanel("get", "ごほうびGETのイラスト", "art-large")}

      <section class="ticket-card ticket-large">
        <strong>ごほうびケーキ券</strong>
        <div class="cake-ticket"></div>
      </section>

      <div class="button-stack">
        <button class="main-button" type="button" data-action="home">ホームに戻る</button>
      </div>
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
  const breakRows = canTakeBreak()
    ? `
        <div class="profile-row">
          <strong>休憩1</strong>
          <span>${state.selectedSlot}〜${breakEndTime()} / ${state.selectedBreak}分</span>
        </div>
        <div class="profile-row">
          <strong>休憩2</strong>
          <span>${state.secondBreakStart}〜${state.secondBreakEnd} / ${secondBreakDuration()}分</span>
        </div>
      `
    : "";
  return `
    <article class="page">
      ${screenTitle("今日の記録", "バイトとごほうびのログ")}
      <section class="profile-card">
        <div class="profile-row">
          <strong>バイト予定</strong>
          <span>${state.shiftStart}〜${state.shiftEnd}</span>
        </div>
        ${breakRows}
        <div class="profile-row">
          <strong>進行度</strong>
          <span>${state.progressPercent}%</span>
        </div>
      </section>

      <div class="button-stack">
        <button class="main-button" type="button" data-action="home">ホームへ</button>
        <button class="sub-button" type="button" data-action="reset">今日をリセット</button>
      </div>
    </article>
  `;
}

function prepareRestTimer(index = 0) {
  state.activeBreakIndex = index === 1 ? 1 : 0;
  state.restElapsedSeconds = 0;
  state.restSeconds = Math.max(60, activeBreakDuration() * 60);
}

function advanceShift(minutes) {
  state.leftMinutes = Math.max(0, state.leftMinutes - minutes);
  const worked = minutesBetween(state.shiftStart, state.shiftEnd) - state.leftMinutes;
  state.progressPercent = Math.max(0, Math.min(100, Math.round((worked / minutesBetween(state.shiftStart, state.shiftEnd)) * 100)));
}

function finishRestAndContinue() {
  markActiveBreakDone();
  state.restElapsedSeconds = 0;
  state.restSeconds = 0;

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

  if (action === "enter-rest") {
    const breakIndex = Number(button.dataset.breakIndex ?? nextBreakIndex());
    if (canTakeBreak() && breakIndex >= 0) {
      prepareRestTimer(breakIndex);
      setView("rest");
      showToast(`${activeBreakLabel()}に入りました`);
    } else {
      setView("progress");
      showToast("今日の休憩は終わっています");
    }
  }

  if (action === "finish-no-break") {
    setView("arrival");
    showToast("ごほうび会場に到着しました！");
  }

  if (action === "claim") {
    let message = "今日のごほうびは受け取り済みです";
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

  if (action === "home") setView("home");

  if (action === "reset") {
    state.view = "home";
    state.selectedBreak = 30;
    state.selectedSlot = "12:00";
    state.breakEnd = "12:30";
    state.secondBreakStart = "15:00";
    state.secondBreakEnd = "15:15";
    state.break1Done = false;
    state.break2Done = false;
    state.activeBreakIndex = 0;
    state.restElapsedSeconds = 0;
    syncShiftProgress(true);
    state.restSeconds = 0;
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
  if (!["shiftStart", "shiftEnd", "breakStart", "breakEnd", "secondBreakStart", "secondBreakEnd"].includes(field)) return;
  if (!input.value) return;

  if (field === "shiftStart" || field === "shiftEnd") {
    state[field] = input.value;
    syncShiftProgress(true);
    resetBreakTimesForShift();
  }

  if (field === "breakStart") {
    state.selectedSlot = input.value;
    syncBreakDurationFromTimes();
  }

  if (field === "breakEnd") {
    state.breakEnd = input.value;
    syncBreakDurationFromTimes();
  }

  if (field === "secondBreakStart") {
    state.secondBreakStart = input.value;
  }

  if (field === "secondBreakEnd") {
    state.secondBreakEnd = input.value;
  }

  state.restSeconds = state.view === "rest" ? Math.max(60, activeBreakDuration() * 60) : state.restSeconds;
  saveState();
  render();
  showToast(field.includes("Break") || field === "breakStart" || field === "breakEnd" ? "休憩時間を更新しました" : "バイト時間を更新しました");
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
