const SAVE_KEY = "reward_carpet_proto_v1";

const awards = [
  {
    id: "smile",
    title: "笑顔使い切り賞",
    body: "ニコニコしすぎて、もう笑顔の在庫ゼロ！",
    medal: "★",
    color: "gold",
  },
  {
    id: "patience",
    title: "理不尽耐久賞",
    body: "理不尽にも負けず、よくがんばったで賞！",
    medal: "♛",
    color: "blue",
  },
  {
    id: "human",
    title: "5分で人間に戻った賞",
    body: "切り替えはやっ！さすがあなた！",
    medal: "♥",
    color: "red",
  },
];

const cheers = [
  "笑顔増量剤",
  "理不尽耐久茶",
  "なんとか乗り切れ",
  "スーパーほうち賞",
  "すみません金メダル賞",
  "5分で人間に戻った賞",
];

const state = {
  view: "home",
  level: 12,
  exp: 340,
  goal: 600,
  streak: 7,
  totalSteps: 2680,
  restSteps: 320,
  selectedAwardId: "smile",
  rouletteRotation: 0,
  rouletteResult: "",
  cakeClaimed: false,
};

const screen = document.getElementById("screen");
const toast = document.getElementById("toast");
const tabbar = document.querySelector(".tabbar");

loadState();
render();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
    Object.assign(state, saved);
  } catch {
    // This prototype still works without saved data.
  }
}

function saveState() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage limits in the prototype.
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

function selectedAward() {
  return awards.find((award) => award.id === state.selectedAwardId) || awards[0];
}

function percent(value, max) {
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}

function render() {
  const views = {
    home: renderHome,
    rest: renderRest,
    nominate: renderNominate,
    cheer: renderCheer,
    roulette: renderRoulette,
    profile: renderProfile,
    ceremony: renderCeremony,
  };

  screen.innerHTML = views[state.view] ? views[state.view]() : renderHome();
  updateTabs();
}

function updateTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    const isActive = tab.dataset.nav === state.view;
    tab.classList.toggle("active", isActive);
  });
}

function title(text, sub = "") {
  return `
    <h1 class="big-title"><span class="sparkle">✦</span> ${text} <span class="sparkle">✦</span></h1>
    ${sub ? `<p class="subtitle">${sub}</p>` : ""}
  `;
}

function characterScene() {
  return `
    <div class="red-carpet" aria-hidden="true">
      <div class="stage"></div>
      <div class="rail left"></div>
      <div class="rail right"></div>
      <div class="hero-row">
        <div class="runner"></div>
        <div class="cake-pal"><div class="cape"></div></div>
      </div>
    </div>
  `;
}

function renderHome() {
  return `
    <article class="page">
      <h1 class="hero-title">レッドカーペット<br />進行中</h1>
      <p class="subtitle">あと少しでごほうび！</p>

      ${characterScene()}

      <section class="progress-card" aria-label="レベル進行">
        <div class="progress-head">
          <span class="progress-title">レッドカーペット Lv.${state.level}</span>
          <span class="progress-number">${state.exp} / ${state.goal} XP</span>
        </div>
        <div class="meter">
          <div class="meter-fill" style="width: ${percent(state.exp, state.goal)}%"></div>
        </div>
      </section>

      <div class="home-grid">
        <section class="mini-card">
          <strong>${state.streak}日目！</strong>
          <span>連続ごほうび日数</span>
        </section>
        <section class="mini-card">
          <strong>ベリーGOOD!</strong>
          <span>今日の気分スタンプ</span>
        </section>
      </div>

      <div class="button-stack">
        <button class="main-button" type="button" data-action="walk">休憩会場へ進む</button>
        <button class="sub-button" type="button" data-action="nominate">今日のノミネートを見る</button>
      </div>
    </article>
  `;
}

function renderRest() {
  return `
    <article class="page">
      ${title("休憩中", "ケーキ会場へ移動中")}
      ${characterScene()}

      <section class="path-card">
        <div class="path-title">
          <span>目的地まで</span>
          <span class="flag">⚑</span>
        </div>
        <div class="meter">
          <div class="meter-fill" style="width: ${percent(1000 - state.restSteps, 1000)}%"></div>
        </div>
        <p class="subtitle">あと <strong>${state.restSteps}</strong> 歩 / 1,000歩</p>
      </section>

      <div class="home-grid">
        <section class="mini-card">
          <strong>${state.totalSteps.toLocaleString()}歩</strong>
          <span>今日の移動距離</span>
        </section>
        <section class="mini-card">
          <strong>あと${state.restSteps}歩</strong>
          <span>目標達成まで</span>
        </section>
      </div>

      <div class="button-stack">
        <button class="main-button" type="button" data-action="step-more">100歩すすむ</button>
        <button class="sub-button" type="button" data-action="nominate">ノミネートへ</button>
      </div>
    </article>
  `;
}

function renderNominate() {
  const cards = awards
    .map(
      (award) => `
        <button class="nominee-card" type="button" data-action="select-award" data-award="${award.id}">
          <span class="medal ${award.color}">${award.medal}</span>
          <span>
            <h2>${award.title}</h2>
            <p>${award.body}</p>
          </span>
        </button>
      `,
    )
    .join("");

  return `
    <article class="page">
      ${title("今日のノミネート", "がんばったあなたに、ぴったりの賞をどうぞ！")}
      <div class="nominee-list">${cards}</div>
      <p class="speech">どの賞もぜーんぶすごいよー！</p>
      <div class="button-stack">
        <button class="main-button" type="button" data-action="roulette">応援ルーレットへ</button>
      </div>
    </article>
  `;
}

function renderCheer() {
  const award = selectedAward();
  return `
    <article class="page">
      ${title("変な応援", "がんばり方は、ちょっと変でもいい")}
      ${characterScene()}

      <section class="wheel-card">
        <strong>${award.title}</strong>
        <p>${award.body}</p>
      </section>

      <div class="button-stack">
        <button class="main-button" type="button" data-action="roulette">ルーレットを回す</button>
        <button class="sub-button" type="button" data-action="ceremony">授賞式へ進む</button>
      </div>
    </article>
  `;
}

function renderRoulette() {
  const labels = cheers.map((label) => `<span class="wheel-label">${label}</span>`).join("");
  return `
    <article class="page">
      ${title("変な応援<br />ルーレット", "運だめし！どの応援が出るかな？")}
      <div class="roulette-wrap">
        <div class="pointer"></div>
        <div class="wheel" style="transform: rotate(${state.rouletteRotation}deg)">
          ${labels}
        </div>
      </div>

      <section class="wheel-card">
        <strong>${state.rouletteResult || "まだ回していません"}</strong>
        <p>${state.rouletteResult ? "今日のあなたに届いた応援です。" : "ボタンを押すと、今日の応援がひとつ届きます。"}</p>
      </section>

      <div class="button-stack">
        <button class="main-button" type="button" data-action="spin">回して応援を受け取る！</button>
        <button class="sub-button" type="button" data-action="ceremony">授賞式へ</button>
      </div>
    </article>
  `;
}

function renderCeremony() {
  const award = selectedAward();
  return `
    <article class="page ceremony">
      <div class="ribbon">授賞式</div>
      <p class="subtitle">本日の主役:</p>
      <h1 class="hero-you">あなた</h1>

      <div class="award-pal" aria-hidden="true">
        <div class="trophy">★</div>
        <div class="cake-pal"><div class="cape"></div></div>
      </div>

      <section class="ticket">
        <h2>ごほうびケーキ券</h2>
        <p>おつかれさまでした！<br />本日のごほうびケーキはこちら！</p>
        <div class="cake-icon"></div>
        <p><strong>${award.title}</strong></p>
      </section>

      <div class="button-stack">
        <button class="main-button" type="button" data-action="claim-cake">
          ${state.cakeClaimed ? "受け取り済み！" : "ケーキを受け取る！"}
        </button>
        <button class="link-button" type="button" data-action="reset-day">あとで受け取る</button>
      </div>
    </article>
  `;
}

function renderProfile() {
  return `
    <article class="page">
      ${title("マイページ", "今日のごほうび記録")}
      <section class="profile-card">
        <div class="profile-row">
          <strong>レベル</strong>
          <span>Lv.${state.level}</span>
        </div>
        <div class="profile-row">
          <strong>連続ごほうび</strong>
          <span>${state.streak}日</span>
        </div>
        <div class="profile-row">
          <strong>今日の歩数</strong>
          <span>${state.totalSteps.toLocaleString()}歩</span>
        </div>
        <div class="profile-row">
          <strong>今日の賞</strong>
          <span>${selectedAward().title}</span>
        </div>
        <div class="profile-row">
          <strong>ケーキ券</strong>
          <span>${state.cakeClaimed ? "受け取り済み" : "未受け取り"}</span>
        </div>
      </section>

      <div class="button-stack">
        <button class="main-button" type="button" data-action="ceremony">授賞式を見る</button>
        <button class="sub-button" type="button" data-action="reset-day">今日をリセット</button>
      </div>
    </article>
  `;
}

function stepMore() {
  state.restSteps = Math.max(0, state.restSteps - 100);
  state.totalSteps += 100;
  state.exp = Math.min(state.goal, state.exp + 35);
  if (state.restSteps === 0) {
    state.level += state.exp >= state.goal ? 1 : 0;
    state.exp = Math.min(state.goal, state.exp);
    state.view = "nominate";
    showToast("目的地に到着！ノミネート発表です");
  } else {
    showToast(`あと${state.restSteps}歩！休憩中も進んでる！`);
  }
  saveState();
  render();
}

function spinRoulette() {
  const index = Math.floor(Math.random() * cheers.length);
  state.rouletteResult = cheers[index];
  state.rouletteRotation += 1440 + index * 60 + Math.floor(Math.random() * 24);
  saveState();
  render();
  setTimeout(() => showToast(`${state.rouletteResult} が出ました！`), 650);
}

function resetDay() {
  state.view = "home";
  state.exp = 340;
  state.restSteps = 320;
  state.totalSteps = 2680;
  state.selectedAwardId = "smile";
  state.rouletteRotation = 0;
  state.rouletteResult = "";
  state.cakeClaimed = false;
  saveState();
  render();
  showToast("今日のごほうびをリセットしました");
}

screen.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const action = button.dataset.action;

  if (action === "walk") {
    state.view = "rest";
    saveState();
    render();
    showToast("休憩会場へ移動中！");
  }

  if (action === "step-more") stepMore();
  if (action === "nominate") setView("nominate");
  if (action === "roulette") setView("roulette");
  if (action === "ceremony") setView("ceremony");
  if (action === "spin") spinRoulette();
  if (action === "reset-day") resetDay();

  if (action === "select-award") {
    state.selectedAwardId = button.dataset.award;
    state.view = "cheer";
    saveState();
    render();
    showToast(`${selectedAward().title} に決まり！`);
  }

  if (action === "claim-cake") {
    state.cakeClaimed = true;
    state.exp = Math.min(state.goal, state.exp + 80);
    saveState();
    render();
    showToast("ごほうびケーキを受け取りました！");
  }
});

tabbar.addEventListener("click", (event) => {
  const button = event.target.closest("[data-nav]");
  if (!button) return;
  setView(button.dataset.nav);
});
