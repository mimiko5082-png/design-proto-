const STORAGE_KEY = "basho_walk_v1";
const screen = document.getElementById("screen");
const toast = document.getElementById("toast");
const tabbar = document.querySelector(".tabbar");

const challenges = [
  {
    id: "red-three",
    title: "赤いものを3つ見つける",
    eyebrow: "色で歩く",
    lead: "赤だけを頼りに、いつもの道を少し違う角度から見る。",
    time: 0,
    tasks: ["ひとつめの赤", "ふたつめの赤", "みっつめの赤"],
    hint: "信号、看板、誰かの傘。赤は街の句読点になる。",
    season: "色",
    accent: "vermilion",
  },
  {
    id: "stand-still",
    title: "30秒立ち止まる",
    eyebrow: "余白で歩く",
    lead: "歩くのをやめた時だけ、街の方から近づいてくるものがある。",
    time: 30,
    tasks: ["足を止める", "空気の動きを見る", "最初に動いたものを覚える"],
    hint: "目的地はない。止まった場所が、今日の小さな峠になる。",
    season: "間",
    accent: "indigo",
  },
  {
    id: "sound-line",
    title: "聞こえた音を一句にする",
    eyebrow: "音で歩く",
    lead: "目ではなく耳を先に歩かせる。街の音を、ひとつだけ持ち帰る。",
    time: 0,
    tasks: ["いちばん近い音", "いちばん遠い音", "消えたあと残った音"],
    hint: "車、足音、ドア、鳥、風。説明ではなく、響きを残す。",
    season: "音",
    accent: "blue",
  },
  {
    id: "shadow",
    title: "影の向きを見る",
    eyebrow: "光で歩く",
    lead: "影は、街がこっそり書いた矢印。どこにも案内しないけれど、時間だけは教えてくれる。",
    time: 0,
    tasks: ["長い影", "短い影", "自分の影"],
    hint: "影の濃さ、伸び方、踏まれ方を見る。",
    season: "光",
    accent: "gold",
  },
  {
    id: "old-new",
    title: "古いものと新しいものを探す",
    eyebrow: "時間で歩く",
    lead: "同じ角にある、昔から残るものと今日生まれたものを見る。",
    time: 0,
    tasks: ["古いもの", "新しいもの", "ふたつが並ぶ場所"],
    hint: "ひび、貼り紙、塗り直した壁。街は何度も上書きされている。",
    season: "時",
    accent: "green",
  },
  {
    id: "smell",
    title: "匂いのする角をひとつ選ぶ",
    eyebrow: "気配で歩く",
    lead: "パン、雨、土、洗剤、夕飯。見えないものが道を変える。",
    time: 0,
    tasks: ["匂いに気づく", "どこから来たか見る", "消える場所まで歩く"],
    hint: "理由は書かなくていい。匂いが消えた瞬間を一句にする。",
    season: "気配",
    accent: "rose",
  },
];

const bashoHaiku = [
  {
    id: "old-pond",
    text: "古池や蛙飛びこむ水の音",
    theme: "音",
    lens: "小さな音が、空間全体を変える瞬間を見る。",
    challengeId: "sound-line",
  },
  {
    id: "summer-grass",
    text: "夏草や兵どもが夢の跡",
    theme: "時間",
    lens: "今あるものの下に、過ぎた時間を見る。",
    challengeId: "old-new",
  },
  {
    id: "rough-sea",
    text: "荒海や佐渡によこたふ天河",
    theme: "遠さ",
    lens: "近くの景色と、遠くの気配を同時に見る。",
    challengeId: "stand-still",
  },
  {
    id: "quietness",
    text: "閑さや岩にしみ入る蝉の声",
    theme: "静けさ",
    lens: "うるさい音の奥にある静けさを聞く。",
    challengeId: "sound-line",
  },
  {
    id: "violet-path",
    text: "山路来て何やらゆかし菫草",
    theme: "ゆっくり",
    lens: "小さく咲くものに歩幅を合わせる。",
    challengeId: "stand-still",
  },
  {
    id: "horse-summer",
    text: "馬ぼくぼく我を絵に見る夏野かな",
    theme: "外から見る",
    lens: "自分も街の風景の一部として見る。",
    challengeId: "shadow",
  },
  {
    id: "first-rain",
    text: "初しぐれ猿も小蓑をほしげ也",
    theme: "気配",
    lens: "天気が変わる前の、街の表情を見る。",
    challengeId: "smell",
  },
  {
    id: "matsushima",
    text: "松島や鶴に身をかれほととぎす",
    theme: "姿",
    lens: "遠いものを、別の形に重ねて見る。",
    challengeId: "red-three",
  },
  {
    id: "mogami",
    text: "暑き日を海に入れたり最上川",
    theme: "大きな流れ",
    lens: "街の中を流れていくものを探す。",
    challengeId: "old-new",
  },
  {
    id: "plum-scent",
    text: "梅が香にのつと日の出る山路哉",
    theme: "匂い",
    lens: "見える前に届くものを頼りに歩く。",
    challengeId: "smell",
  },
  {
    id: "moon",
    text: "名月や池をめぐりて夜もすがら",
    theme: "めぐる",
    lens: "ひとつの景色を、角度を変えて何度も見る。",
    challengeId: "stand-still",
  },
  {
    id: "crow",
    text: "枯枝に烏のとまりけり秋の暮",
    theme: "形",
    lens: "余白の中にある、ひとつの形を見る。",
    challengeId: "shadow",
  },
];

const sampleEntries = [
  {
    id: "sample-1",
    sample: true,
    challengeId: "red-three",
    challengeTitle: "赤いものを3つ見つける",
    lines: ["自販機の", "赤だけ残る", "夕まぐれ"],
    note: "駅前の曲がり角",
    createdAt: "2026-08-01T17:42:00",
    mapX: 23,
    mapY: 62,
    accent: "vermilion",
  },
  {
    id: "sample-2",
    sample: true,
    challengeId: "sound-line",
    challengeTitle: "聞こえた音を一句にする",
    lines: ["信号の", "青にも朝の", "風がある"],
    note: "大通りの横断歩道",
    createdAt: "2026-08-03T08:18:00",
    mapX: 62,
    mapY: 35,
    accent: "blue",
  },
  {
    id: "sample-3",
    sample: true,
    challengeId: "stand-still",
    challengeTitle: "30秒立ち止まる",
    lines: ["立ち止まる", "靴音だけが", "先へ行く"],
    note: "商店街の入口",
    createdAt: "2026-08-04T16:10:00",
    mapX: 47,
    mapY: 71,
    accent: "indigo",
  },
  {
    id: "sample-4",
    sample: true,
    challengeId: "shadow",
    challengeTitle: "影の向きを見る",
    lines: ["ビル影に", "小さな夏の", "風通る"],
    note: "夕方の橋の近く",
    createdAt: "2026-08-05T18:02:00",
    mapX: 75,
    mapY: 54,
    accent: "gold",
  },
];

const state = {
  view: "home",
  date: "",
  challengeId: "",
  walkStartedAt: 0,
  completedTasks: [],
  draftLines: ["", "", ""],
  draftNote: "",
  selectedEntryId: "",
  lastSavedId: "",
  entries: [],
  saving: false,
};

loadState();
ensureToday();
render();
setInterval(updateLiveTime, 1000);

screen.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (target) {
    handleAction(target);
    return;
  }

  const navTarget = event.target.closest("[data-nav]");
  if (navTarget) {
    navigate(navTarget.dataset.nav);
  }
});

screen.addEventListener("input", (event) => {
  const target = event.target;
  if (target.matches("[data-line]")) {
    const index = Number(target.dataset.line);
    state.draftLines[index] = target.value.slice(0, 24);
    saveState();
    updateCount(index);
  }
  if (target.matches("[data-note]")) {
    state.draftNote = target.value.slice(0, 28);
    saveState();
  }
});

tabbar.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-nav]");
  if (!tab) return;
  navigate(tab.dataset.nav);
});

function render() {
  const views = {
    home: renderHome,
    walk: renderWalk,
    compose: renderCompose,
    guide: renderGuide,
    map: renderMap,
    notebook: renderNotebook,
    basho: renderBashoLibrary,
    detail: renderDetail,
  };
  screen.innerHTML = (views[state.view] || views.home)();
  updateTabbar();
  updateLiveTime();
}

function renderHome() {
  const challenge = currentChallenge();
  const userCount = state.entries.length;
  const recent = state.entries.slice(0, 2);
  const recentHtml = recent.length
    ? recent.map(renderMiniEntry).join("")
    : `<div class="empty-strip">
        <strong>まだ句はありません</strong>
        <span>今日の街で一句残すと、ここに最初の道しるべが置かれます。</span>
      </div>`;

  return `<div class="view home-view">
    <header class="app-header">
      <button class="icon-button" type="button" aria-label="メニュー">☰</button>
      <div class="brand">
        <span class="brand-kana">松尾芭蕉 × 街歩き</span>
        <span class="brand-title">BASHO WALK</span>
      </div>
      <button class="icon-button" type="button" data-action="reroll-challenge" aria-label="お題を変える">↻</button>
    </header>

    <section class="basho-hero">
      <img src="./assets/kotoba-sunset.png" alt="夕暮れの街を歩くための景色" />
      <div class="hero-shade"></div>
      <div class="hero-copy">
        <span class="paper-label">今日の見方</span>
        <h1>どこへ行くかではなく、どう見るか。</h1>
        <p>芭蕉みたいに、街の小さな気配から一句を拾う。</p>
      </div>
    </section>

    <section class="daily-letter ${challenge.accent}">
      <span class="letter-eyebrow">AIから届いたお題</span>
      <h2>${escapeHtml(challenge.title)}</h2>
      <p>${escapeHtml(challenge.lead)}</p>
      <div class="letter-actions">
        <button class="primary-button" type="button" data-action="start-challenge">この見方で歩く</button>
        <button class="text-button" type="button" data-action="reroll-challenge">別のお題</button>
      </div>
    </section>

    <section class="concept-band">
      <div>
        <strong>地図は目的地を教えない。</strong>
        <span>そのかわり、街の見方だけを変える。</span>
      </div>
      <b>${userCount}</b>
    </section>

    <section class="basho-invite">
      <div>
        <span class="paper-label">芭蕉発句全集より</span>
        <h2>${escapeHtml(todayBasho().text)}</h2>
        <p>${escapeHtml(todayBasho().lens)}</p>
      </div>
      <button class="secondary-button" type="button" data-nav="basho">俳句集を見る</button>
    </section>

    <section class="section-block">
      <div class="section-title">
        <h2>あなたの道しるべ</h2>
        <button class="small-link" type="button" data-nav="notebook">句帳へ</button>
      </div>
      ${recentHtml}
    </section>
  </div>`;
}

function renderWalk() {
  const challenge = currentChallenge();
  const haiku = bashoHaiku.find((item) => item.challengeId === challenge.id) || todayBasho();
  const elapsed = getElapsedSeconds();
  const progress = challenge.time ? Math.min(100, Math.round((elapsed / challenge.time) * 100)) : completionPercent(challenge);
  const timeText = challenge.time
    ? elapsed >= challenge.time
      ? "立ち止まれました"
      : `あと${formatSeconds(challenge.time - elapsed)}`
    : state.walkStartedAt
      ? `${formatSeconds(elapsed)} 歩いています`
      : "まだ歩きはじめていません";
  const taskHtml = challenge.tasks
    .map((task, index) => {
      const id = `${challenge.id}-${index}`;
      const done = state.completedTasks.includes(id);
      return `<button class="task-row ${done ? "done" : ""}" type="button" data-action="toggle-task" data-task-id="${id}">
        <span>${done ? "✓" : index + 1}</span>
        <strong>${escapeHtml(task)}</strong>
      </button>`;
    })
    .join("");

  return `<div class="view walk-view">
    <header class="simple-header">
      <button class="back-button" type="button" data-nav="home" aria-label="戻る">‹</button>
      <h1>街を見るお題</h1>
      <button class="icon-button" type="button" data-action="reroll-challenge" aria-label="お題を変える">↻</button>
    </header>

    <section class="walk-card ${challenge.accent}">
      <span class="paper-label">${escapeHtml(challenge.eyebrow)}</span>
      <h2>${escapeHtml(challenge.title)}</h2>
      <p>${escapeHtml(challenge.hint)}</p>
      <div class="progress-shell">
        <div class="progress-fill" style="width:${progress}%"></div>
      </div>
      <div class="walk-time" data-el="elapsed">${timeText}</div>
    </section>

    <section class="task-list">
      ${taskHtml}
    </section>

    <section class="basho-lens">
      <span>芭蕉の見方</span>
      <strong>${escapeHtml(haiku.text)}</strong>
      <p>${escapeHtml(haiku.lens)}</p>
    </section>

    <div class="bottom-actions">
      <button class="secondary-button" type="button" data-action="begin-walk">${state.walkStartedAt ? "歩いています" : "歩きはじめる"}</button>
      <button class="primary-button" type="button" data-action="open-compose">一句を書く</button>
    </div>
  </div>`;
}

function renderCompose() {
  const challenge = currentChallenge();
  const counts = state.draftLines.map((line) => countJapaneseUnits(line));
  return `<div class="view compose-view">
    <header class="simple-header">
      <button class="back-button" type="button" data-nav="walk" aria-label="戻る">‹</button>
      <h1>その場で詠む</h1>
      <span class="mini-mark">句</span>
    </header>

    <section class="compose-paper">
      <span class="paper-label">${escapeHtml(challenge.title)}</span>
      <label>
        <span>上の句</span>
        <input data-line="0" value="${escapeAttr(state.draftLines[0])}" maxlength="24" placeholder="例 夕風や" />
        <small data-count="0">${counts[0]}音</small>
      </label>
      <label>
        <span>中の句</span>
        <input data-line="1" value="${escapeAttr(state.draftLines[1])}" maxlength="24" placeholder="例 赤い看板" />
        <small data-count="1">${counts[1]}音</small>
      </label>
      <label>
        <span>下の句</span>
        <input data-line="2" value="${escapeAttr(state.draftLines[2])}" maxlength="24" placeholder="例 遠くなる" />
        <small data-count="2">${counts[2]}音</small>
      </label>
      <label>
        <span>場所のひとこと</span>
        <input data-note value="${escapeAttr(state.draftNote)}" maxlength="28" placeholder="駅前の角、雨上がりの道など" />
      </label>
    </section>

    <section class="quiet-note">
      <strong>AIは句を書きません。</strong>
      <span>お題だけが届きます。残す言葉は、歩いた人の目と耳から生まれます。</span>
    </section>

    <button class="secondary-button wide-button" type="button" data-nav="basho">芭蕉の句集を見てから書く</button>

    <button class="primary-button wide-button" type="button" data-action="save-haiku" ${state.saving ? "disabled" : ""}>
      ${state.saving ? "残しています..." : "この場所に句を残す"}
    </button>
  </div>`;
}

function renderGuide() {
  const challenge = currentChallenge();
  const entries = allEntries().filter((entry) => entry.challengeId === challenge.id);
  const fallback = allEntries().slice(0, 4);
  const visible = entries.length ? entries : fallback;
  const cards = visible.map(renderGuideEntry).join("");
  return `<div class="view guide-view">
    <header class="simple-header">
      <button class="back-button" type="button" data-nav="home" aria-label="戻る">‹</button>
      <h1>句の道しるべ</h1>
      <button class="icon-button" type="button" data-nav="map" aria-label="地図へ">⌖</button>
    </header>

    <section class="guide-head">
      <span class="paper-label">次の人へ残るもの</span>
      <h2>${escapeHtml(challenge.title)}</h2>
      <p>ここで詠まれた句が、次に歩く人の見方を少し変えます。</p>
    </section>

    <div class="guide-list">
      ${cards}
    </div>

    <button class="secondary-button wide-button" type="button" data-nav="map">見方の地図を見る</button>
  </div>`;
}

function renderMap() {
  const entries = allEntries();
  const pins = entries
    .slice(0, 10)
    .map((entry) => `<button class="map-pin ${entry.accent || "indigo"}" style="left:${entry.mapX}%; top:${entry.mapY}%;" type="button" data-action="open-entry" data-entry-id="${escapeAttr(entry.id)}">
      <span>${escapeHtml(entry.lines[0].slice(0, 2) || "句")}</span>
    </button>`)
    .join("");
  const latest = state.entries[0];
  return `<div class="view map-view">
    <header class="simple-header">
      <button class="back-button" type="button" data-nav="home" aria-label="戻る">‹</button>
      <h1>見方の地図</h1>
      <span class="mini-mark">道</span>
    </header>

    <section class="map-board">
      <img src="./assets/kotoba-map.png" alt="句が置かれた街の見方の地図" />
      <div class="map-wash"></div>
      ${pins}
    </section>

    <section class="map-caption">
      <strong>どこへ行くかを教える地図ではない。</strong>
      <span>誰かの一句が、その場所の見方を変える地図。</span>
    </section>

    ${latest ? renderLatestRoute(latest) : `<div class="empty-strip"><strong>あなたの句はまだありません</strong><span>一句残すと、この地図に新しい道しるべが増えます。</span></div>`}
  </div>`;
}

function renderNotebook() {
  const cards = state.entries.length
    ? state.entries.map(renderNotebookEntry).join("")
    : `<div class="empty-page">
        <b>0</b>
        <strong>まだ句帳は白紙です</strong>
        <span>街で一句残すと、最初のページが開きます。</span>
        <button class="primary-button" type="button" data-nav="walk">今日のお題へ</button>
      </div>`;
  return `<div class="view notebook-view">
    <header class="simple-header">
      <button class="back-button" type="button" data-nav="home" aria-label="戻る">‹</button>
      <h1>句帳</h1>
      <span class="mini-mark">${state.entries.length}</span>
    </header>

    <section class="notebook-stats">
      <div><strong>${state.entries.length}</strong><span>残した句</span></div>
      <div><strong>${uniqueChallengeCount()}</strong><span>歩いた見方</span></div>
      <div><strong>${state.entries.length ? "育つ" : "白紙"}</strong><span>道しるべ</span></div>
    </section>

    <div class="notebook-list">
      ${cards}
    </div>
  </div>`;
}

function renderBashoLibrary() {
  const cards = bashoHaiku.map(renderBashoCard).join("");
  return `<div class="view basho-view">
    <header class="simple-header">
      <button class="back-button" type="button" data-nav="home" aria-label="戻る">‹</button>
      <h1>芭蕉句集</h1>
      <span class="mini-mark">${bashoHaiku.length}</span>
    </header>

    <section class="library-head">
      <span class="paper-label">芭蕉発句全集</span>
      <h2>句を読むためではなく、街を見るために使う。</h2>
      <p>気になる一句を選ぶと、その句の見方に近い街歩きのお題へ進みます。</p>
      <a href="https://www2.yamanashi-ken.ac.jp/~itoyo/basho/haikusyu/Default.htm" target="_blank" rel="noreferrer">元の俳句集を開く</a>
    </section>

    <div class="basho-grid">
      ${cards}
    </div>
  </div>`;
}

function renderBashoCard(item) {
  return `<article class="basho-card">
    <span>${escapeHtml(item.theme)}</span>
    <strong>${escapeHtml(item.text)}</strong>
    <p>${escapeHtml(item.lens)}</p>
    <button class="text-button" type="button" data-action="walk-from-basho" data-challenge-id="${escapeAttr(item.challengeId)}">この見方で歩く</button>
  </article>`;
}

function renderDetail() {
  const entry = allEntries().find((item) => item.id === state.selectedEntryId) || allEntries()[0];
  if (!entry) return renderNotebook();
  return `<div class="view detail-view">
    <header class="simple-header">
      <button class="back-button" type="button" data-nav="guide" aria-label="戻る">‹</button>
      <h1>句の世界</h1>
      <button class="icon-button" type="button" data-nav="map" aria-label="地図へ">⌖</button>
    </header>

    <article class="poem-detail ${entry.accent || "indigo"}">
      <span class="paper-label">${escapeHtml(entry.challengeTitle)}</span>
      <div class="poem-lines">
        ${entry.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
      </div>
      <footer>
        <span>${escapeHtml(entry.note || "街のどこか")}</span>
        <time>${formatDate(entry.createdAt)}</time>
      </footer>
    </article>

    <section class="detail-copy">
      <strong>この句は道しるべです。</strong>
      <span>同じ場所を歩く人が、同じ景色を少し違う目で見られるように残っています。</span>
    </section>
  </div>`;
}

function renderMiniEntry(entry) {
  return `<button class="mini-entry" type="button" data-action="open-entry" data-entry-id="${escapeAttr(entry.id)}">
    <span>${escapeHtml(entry.lines.join(" / "))}</span>
    <small>${escapeHtml(entry.note || entry.challengeTitle)}</small>
  </button>`;
}

function renderGuideEntry(entry) {
  return `<button class="guide-entry ${entry.accent || "indigo"}" type="button" data-action="open-entry" data-entry-id="${escapeAttr(entry.id)}">
    <span>${entry.sample ? "誰かの句" : "あなたの句"}</span>
    <strong>${escapeHtml(entry.lines.join("　"))}</strong>
    <small>${escapeHtml(entry.note || "街のどこか")}</small>
  </button>`;
}

function renderNotebookEntry(entry) {
  return `<article class="notebook-entry">
    <button class="entry-main" type="button" data-action="open-entry" data-entry-id="${escapeAttr(entry.id)}">
      <span>${escapeHtml(entry.challengeTitle)}</span>
      <strong>${escapeHtml(entry.lines.join("　"))}</strong>
      <small>${escapeHtml(entry.note || "街のどこか")} ・ ${formatDate(entry.createdAt)}</small>
    </button>
    <button class="delete-button" type="button" data-action="delete-entry" data-entry-id="${escapeAttr(entry.id)}" aria-label="削除">×</button>
  </article>`;
}

function renderLatestRoute(entry) {
  return `<section class="latest-route">
    <span>最後に置いた道しるべ</span>
    <strong>${escapeHtml(entry.lines.join("　"))}</strong>
    <small>${escapeHtml(entry.note || "街のどこか")}</small>
  </section>`;
}

function handleAction(target) {
  const action = target.dataset.action;
  if (action === "start-challenge") {
    state.view = "walk";
    if (!state.walkStartedAt) state.walkStartedAt = Date.now();
    saveState();
    render();
  }
  if (action === "reroll-challenge") rerollChallenge();
  if (action === "begin-walk") beginWalk();
  if (action === "toggle-task") toggleTask(target.dataset.taskId);
  if (action === "open-compose") navigate("compose");
  if (action === "save-haiku") saveHaiku();
  if (action === "walk-from-basho") walkFromBasho(target.dataset.challengeId);
  if (action === "open-entry") openEntry(target.dataset.entryId);
  if (action === "delete-entry") deleteEntry(target.dataset.entryId);
}

function navigate(view) {
  state.view = view;
  saveState();
  render();
}

function beginWalk() {
  if (!state.walkStartedAt) {
    state.walkStartedAt = Date.now();
    showToast("歩きはじめました。");
  } else {
    showToast("このお題で歩いています。");
  }
  saveState();
  render();
}

function toggleTask(taskId) {
  if (state.completedTasks.includes(taskId)) {
    state.completedTasks = state.completedTasks.filter((id) => id !== taskId);
  } else {
    state.completedTasks.push(taskId);
  }
  saveState();
  render();
}

function rerollChallenge() {
  const currentIndex = challenges.findIndex((challenge) => challenge.id === state.challengeId);
  const next = challenges[(currentIndex + 1 + Math.floor(Math.random() * (challenges.length - 1))) % challenges.length];
  state.challengeId = next.id;
  state.walkStartedAt = 0;
  state.completedTasks = [];
  state.draftLines = ["", "", ""];
  state.draftNote = "";
  state.lastSavedId = "";
  saveState();
  showToast("新しいお題が届きました。");
  render();
}

function walkFromBasho(challengeId) {
  state.challengeId = challengeId || state.challengeId;
  state.walkStartedAt = Date.now();
  state.completedTasks = [];
  state.view = "walk";
  saveState();
  showToast("芭蕉の見方で歩きはじめます。");
  render();
}

async function saveHaiku() {
  const lines = state.draftLines.map((line) => line.trim()).filter(Boolean);
  if (!lines.length) {
    showToast("一句を書いてから残してください。");
    return;
  }

  state.saving = true;
  render();

  const challenge = currentChallenge();
  const location = await getLocationForEntry();
  const entry = {
    id: `entry-${Date.now()}`,
    challengeId: challenge.id,
    challengeTitle: challenge.title,
    lines: normalizeLines(state.draftLines),
    note: state.draftNote.trim() || location.label,
    createdAt: new Date().toISOString(),
    mapX: location.mapX,
    mapY: location.mapY,
    accent: challenge.accent,
  };

  state.entries.unshift(entry);
  state.selectedEntryId = entry.id;
  state.lastSavedId = entry.id;
  state.draftLines = ["", "", ""];
  state.draftNote = "";
  state.completedTasks = [];
  state.walkStartedAt = 0;
  state.saving = false;
  state.view = "guide";
  saveState();
  showToast("句を道しるべにしました。");
  render();
}

function openEntry(entryId) {
  state.selectedEntryId = entryId;
  state.view = "detail";
  saveState();
  render();
}

function deleteEntry(entryId) {
  state.entries = state.entries.filter((entry) => entry.id !== entryId);
  if (state.selectedEntryId === entryId) state.selectedEntryId = "";
  saveState();
  showToast("句帳から削除しました。");
  render();
}

function currentChallenge() {
  return challenges.find((challenge) => challenge.id === state.challengeId) || challenges[0];
}

function todayBasho() {
  const index = seededNumber(todayKey(), bashoHaiku.length);
  return bashoHaiku[index];
}

function ensureToday() {
  const today = todayKey();
  if (state.date !== today || !state.challengeId) {
    state.date = today;
    state.challengeId = challenges[seededNumber(today, challenges.length)].id;
    state.walkStartedAt = 0;
    state.completedTasks = [];
    state.draftLines = ["", "", ""];
    state.draftNote = "";
    saveState();
  }
}

function getElapsedSeconds() {
  if (!state.walkStartedAt) return 0;
  return Math.max(0, Math.floor((Date.now() - state.walkStartedAt) / 1000));
}

function updateLiveTime() {
  const challenge = currentChallenge();
  const elapsed = getElapsedSeconds();
  const target = document.querySelector("[data-el='elapsed']");
  if (!target || state.view !== "walk") return;
  target.textContent = challenge.time
    ? elapsed >= challenge.time
      ? "立ち止まれました"
      : `あと${formatSeconds(challenge.time - elapsed)}`
    : state.walkStartedAt
      ? `${formatSeconds(elapsed)} 歩いています`
      : "まだ歩きはじめていません";
}

function updateCount(index) {
  const count = document.querySelector(`[data-count="${index}"]`);
  if (count) count.textContent = `${countJapaneseUnits(state.draftLines[index])}音`;
}

function completionPercent(challenge) {
  if (!challenge.tasks.length) return 0;
  const done = challenge.tasks.filter((_, index) => state.completedTasks.includes(`${challenge.id}-${index}`)).length;
  return Math.round((done / challenge.tasks.length) * 100);
}

function normalizeLines(lines) {
  const filled = lines.map((line) => line.trim()).filter(Boolean);
  if (filled.length >= 3) return filled.slice(0, 3);
  if (filled.length === 2) return [filled[0], filled[1], ""];
  return [filled[0] || "", "", ""];
}

async function getLocationForEntry() {
  const fallback = randomMapPoint();
  if (!navigator.geolocation) {
    return { ...fallback, label: "街のどこか" };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude || 0;
        const lng = position.coords.longitude || 0;
        resolve({
          mapX: clamp(16 + Math.abs(Math.sin(lng)) * 68, 12, 86),
          mapY: clamp(18 + Math.abs(Math.cos(lat)) * 62, 14, 84),
          label: "いま立っていた場所",
        });
      },
      () => resolve({ ...fallback, label: "街のどこか" }),
      { enableHighAccuracy: false, timeout: 3200, maximumAge: 60000 }
    );
  });
}

function randomMapPoint() {
  const seed = Date.now() + state.entries.length * 37;
  return {
    mapX: 14 + (seed % 70),
    mapY: 18 + ((seed * 7) % 62),
  };
}

function allEntries() {
  return [...state.entries, ...sampleEntries];
}

function uniqueChallengeCount() {
  return new Set(state.entries.map((entry) => entry.challengeId)).size;
}

function updateTabbar() {
  document.querySelectorAll(".tab").forEach((tab) => {
    const nav = tab.dataset.nav;
    const active =
      state.view === nav ||
      (state.view === "compose" && nav === "walk") ||
      (state.view === "guide" && nav === "map") ||
      (state.view === "detail" && nav === "notebook");
    tab.classList.toggle("active", active);
  });
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    Object.assign(state, saved);
    if (!Array.isArray(state.entries)) state.entries = [];
    if (!Array.isArray(state.draftLines)) state.draftLines = ["", "", ""];
    if (!Array.isArray(state.completedTasks)) state.completedTasks = [];
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function seededNumber(value, length) {
  let total = 0;
  for (let i = 0; i < value.length; i += 1) total += value.charCodeAt(i) * (i + 1);
  return total % length;
}

function formatSeconds(total) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}.${date.getDate()}`;
}

function countJapaneseUnits(value) {
  return value.replace(/\s/g, "").length;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
