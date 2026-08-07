const STORAGE_KEY = "basho_manazashi_v1";
const screen = document.getElementById("screen");
const toast = document.getElementById("toast");
const tabbar = document.querySelector(".tabbar");

const sourceUrl = "https://www2.yamanashi-ken.ac.jp/~itoyo/basho/haikusyu/Default.htm";

const clues = [
  {
    id: "red",
    title: "赤いものを3つ見つける",
    short: "色を手がかりに歩く",
    icon: "紅",
    note: "信号、看板、夕日の端。赤だけを拾うと、街の句読点が見えてくる。",
  },
  {
    id: "still",
    title: "30秒立ち止まる",
    short: "余白を手がかりに歩く",
    icon: "間",
    note: "足を止めた場所で、最初に動いたものをひとつ覚える。",
  },
  {
    id: "sound",
    title: "聞こえた音を一句にする",
    short: "音を手がかりに歩く",
    icon: "音",
    note: "近い音、遠い音、消えたあとに残った音を聞く。",
  },
  {
    id: "shadow",
    title: "影の向きを見る",
    short: "光を手がかりに歩く",
    icon: "影",
    note: "影は街が書いた時間の線。濃さ、長さ、踏まれ方を見る。",
  },
  {
    id: "oldnew",
    title: "古いものと新しいものを探す",
    short: "時間を手がかりに歩く",
    icon: "時",
    note: "ひび、貼り紙、塗り直した壁。街の上書きを見る。",
  },
];

const bashoHaiku = [
  {
    id: "oldpond",
    clueId: "sound",
    text: "古池や蛙飛びこむ水の音",
    author: "松尾芭蕉",
    season: "春",
    place: "水辺",
    lens: "小さな音が、空間全体を変える瞬間を見る。",
    world: "ひとつの音が、静けさを壊すのではなく、静けさそのものを深くします。街でも、説明できない小さな音が景色の中心になることがあります。",
  },
  {
    id: "summergrass",
    clueId: "oldnew",
    text: "夏草や兵どもが夢の跡",
    author: "松尾芭蕉",
    season: "夏",
    place: "跡地",
    lens: "今あるものの下に、過ぎた時間を見る。",
    world: "ただの草むらに見える場所にも、かつて誰かがいた時間があります。街を歩く時、今の景色だけでなく、消えたものの気配も重ねて見ます。",
  },
  {
    id: "roughsea",
    clueId: "still",
    text: "荒海や佐渡によこたふ天河",
    author: "松尾芭蕉",
    season: "秋",
    place: "海辺",
    lens: "近くの荒さと、遠くの静けさを同時に見る。",
    world: "目の前の波と、空の遠さ。近いものだけに引っぱられず、遠くの気配も同時に置くと、景色に奥行きが生まれます。",
  },
  {
    id: "silence",
    clueId: "sound",
    text: "閑さや岩にしみ入る蝉の声",
    author: "松尾芭蕉",
    season: "夏",
    place: "山寺",
    lens: "うるさい音の奥にある静けさを聞く。",
    world: "音があるから静けさがわかる。街の騒音も、聞き方を変えると、場所の深さを知らせる手がかりになります。",
  },
  {
    id: "violet",
    clueId: "red",
    text: "山路来て何やらゆかしすみれ草",
    author: "松尾芭蕉",
    season: "春",
    place: "山路",
    lens: "小さく咲くものに歩幅を合わせる。",
    world: "大きな名所ではなく、足元の小さなものに心が止まる。その止まり方こそが、芭蕉のまなざしです。",
  },
  {
    id: "autumnneighbor",
    clueId: "still",
    text: "秋深き隣は何をする人ぞ",
    author: "松尾芭蕉",
    season: "秋",
    place: "住まい",
    lens: "見えない隣の気配を想像する。",
    world: "街は見えるものだけでできていません。壁の向こう、窓の灯り、聞こえない暮らしまで想像すると、道が少し人に近づきます。",
  },
  {
    id: "sickjourney",
    clueId: "shadow",
    text: "旅に病んで夢は枯野をかけ廻る",
    author: "松尾芭蕉",
    season: "冬",
    place: "旅路",
    lens: "体は止まっていても、まなざしだけは歩き続ける。",
    world: "歩くことは距離だけではありません。記憶や夢が、いまいる場所の外へ道を伸ばすこともあります。",
  },
  {
    id: "mogami",
    clueId: "oldnew",
    text: "五月雨をあつめて早し最上川",
    author: "松尾芭蕉",
    season: "夏",
    place: "川",
    lens: "小さな流れが集まって大きくなる様子を見る。",
    world: "雨、側溝、人の流れ、車の音。ばらばらに見えるものがひとつの流れになる時、街は動き出します。",
  },
  {
    id: "moonpond",
    clueId: "still",
    text: "名月や池をめぐりて夜もすがら",
    author: "松尾芭蕉",
    season: "秋",
    place: "池",
    lens: "ひとつの景色を、角度を変えて何度も見る。",
    world: "一度見て終わりにしない。同じ場所を回りながら見ることで、景色の方が少しずつ変わっていきます。",
  },
  {
    id: "crow",
    clueId: "shadow",
    text: "枯枝に烏のとまりけり秋の暮",
    author: "松尾芭蕉",
    season: "秋",
    place: "夕暮れ",
    lens: "余白の中にある、ひとつの形を見る。",
    world: "何もないように見える空間に、ひとつ形が置かれる。それだけで景色は句になります。",
  },
  {
    id: "firstshigure",
    clueId: "sound",
    text: "初しぐれ猿も小蓑をほしげ也",
    author: "松尾芭蕉",
    season: "冬",
    place: "山道",
    lens: "天気が変わる前の、街の表情を見る。",
    world: "雨が降る前、空気や人の歩き方が少し変わる。その変化に気づくと、天気もまなざしの一部になります。",
  },
  {
    id: "plum",
    clueId: "red",
    text: "梅が香にのつと日の出る山路かな",
    author: "松尾芭蕉",
    season: "春",
    place: "山路",
    lens: "見える前に届くものを頼りに歩く。",
    world: "匂いが先に来て、景色があとから現れる。目だけでなく、鼻や肌で街を見るための一句です。",
  },
];

const sampleEntries = [
  {
    id: "sample-1",
    sample: true,
    haikuId: "roughsea",
    clueId: "still",
    poem: "荒海や\n佐渡に横たふ\n天の河",
    feeling: "自然の壮大さ",
    place: "川沿いの橋",
    createdAt: "2026-08-01T17:42:00",
    x: 27,
    y: 62,
  },
  {
    id: "sample-2",
    sample: true,
    haikuId: "oldpond",
    clueId: "sound",
    poem: "古池や\n蛙飛びこむ\n水の音",
    feeling: "静けさ",
    place: "小さな公園",
    createdAt: "2026-08-03T08:18:00",
    x: 60,
    y: 37,
  },
  {
    id: "sample-3",
    sample: true,
    haikuId: "summergrass",
    clueId: "oldnew",
    poem: "夏草や\n兵どもが\n夢の跡",
    feeling: "歴史のつながり",
    place: "古い石段",
    createdAt: "2026-08-04T16:10:00",
    x: 47,
    y: 72,
  },
  {
    id: "sample-4",
    sample: true,
    haikuId: "autumnneighbor",
    clueId: "still",
    poem: "秋深き\n隣は何を\nする人ぞ",
    feeling: "人の気配",
    place: "住宅街の路地",
    createdAt: "2026-08-05T18:02:00",
    x: 75,
    y: 54,
  },
];

const feelingLabels = ["自然の壮大さ", "旅の静けさ", "時の重なり", "人の気配"];

const state = {
  view: "home",
  date: "",
  clueId: "",
  selectedHaikuId: "",
  selectedFeeling: "",
  draftLines: ["", "", ""],
  draftPlace: "",
  entries: [],
  selectedEntryIds: [],
  activeEntryId: "",
  lastSavedId: "",
};

loadState();
ensureToday();
render();

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

screen.addEventListener("input", (event) => {
  const target = event.target;
  if (target.matches("[data-line]")) {
    const index = Number(target.dataset.line);
    state.draftLines[index] = target.value.slice(0, 18);
    saveState();
  }
  if (target.matches("[data-place]")) {
    state.draftPlace = target.value.slice(0, 24);
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
    walk: renderClues,
    haiku: renderHaikuEncounter,
    world: renderHaikuWorld,
    feelings: renderFeelings,
    notebook: renderNotebook,
    map: renderMap,
    next: renderNextWalker,
    detail: renderDetail,
  };
  screen.innerHTML = (views[state.view] || views.home)();
  updateTabbar();
}

function renderHome() {
  const haiku = selectedHaiku();
  return `<div class="view home-view">
    <header class="app-header">
      <button class="icon-button" type="button" aria-label="メニュー">☰</button>
      <div class="brand">
        <span class="brand-kana">歩き、見つめ、ことばを置いていく</span>
        <span class="brand-title">芭蕉のまなざし</span>
      </div>
      <button class="icon-button seal" type="button" data-action="daily-reset" aria-label="今日の句">印</button>
    </header>

    <section class="opening-card">
      <img src="./assets/kotoba-mist.png" alt="水墨画のような街歩きの景色" />
      <div class="mist-layer"></div>
      <div class="opening-copy">
        <span>題は、いつも静かに街から届いている。</span>
        <div class="vertical-poem hero-poem">${verticalLines(haiku.text)}</div>
        <small>${haiku.author}</small>
      </div>
      <button class="primary-button start-button" type="button" data-nav="walk">はじめる</button>
    </section>

    <section class="concept-card">
      <span>CONCEPT</span>
      <p>AIが俳句を作るのではなく、芭蕉みたいに街を見るための仕組み。</p>
      <strong>「どこへ行くかを教える地図」ではなく、「どう街を見るかを変える地図」。</strong>
      <a href="${sourceUrl}" target="_blank" rel="noreferrer">芭蕉発句全集を開く</a>
    </section>
  </div>`;
}

function renderClues() {
  const cards = clues.map((clue) => {
    const active = clue.id === state.clueId;
    return `<button class="clue-row ${active ? "active" : ""}" type="button" data-action="select-clue" data-clue-id="${escapeAttr(clue.id)}">
      <span>${escapeHtml(clue.icon)}</span>
      <div>
        <strong>${escapeHtml(clue.title)}</strong>
        <small>${escapeHtml(clue.short)}</small>
      </div>
    </button>`;
  }).join("");

  return `<div class="view clue-view">
    <header class="simple-header">
      <button class="back-button" type="button" data-nav="home" aria-label="戻る">‹</button>
      <h1>今日の手がかり</h1>
      <span class="screen-number">02</span>
    </header>

    <section class="clue-paper">
      ${cards}
      <p>これは目的地ではなく、芭蕉のまなざしから生まれたヒントです。</p>
    </section>

    <button class="primary-button wide-button" type="button" data-nav="haiku">俳句と出会う</button>
  </div>`;
}

function renderHaikuEncounter() {
  const list = haikuForClue();
  const index = activeHaikuIndex(list);
  const active = list[index] || bashoHaiku[0];
  const cards = [-1, 0, 1].map((offset) => {
    const item = list[(index + offset + list.length) % list.length] || active;
    return `<button class="haiku-card offset-${offset + 1}" type="button" data-action="select-haiku" data-haiku-id="${escapeAttr(item.id)}">
      <div class="vertical-poem">${verticalLines(item.text)}</div>
      <small>${escapeHtml(item.author)}</small>
    </button>`;
  }).join("");

  return `<div class="view haiku-view">
    <header class="simple-header">
      <button class="back-button" type="button" data-nav="walk" aria-label="戻る">‹</button>
      <h1>俳句と出会う</h1>
      <button class="filter-button" type="button" data-action="rotate-haiku">すべて</button>
    </header>

    <section class="deck">
      ${cards}
    </section>

    <p class="swipe-hint">左右の札を押して、次の俳句へ。</p>

    <button class="primary-button wide-button" type="button" data-action="select-haiku" data-haiku-id="${escapeAttr(active.id)}">この句をひらく</button>
  </div>`;
}

function renderHaikuWorld() {
  const haiku = selectedHaiku();
  return `<div class="view world-view">
    <header class="simple-header">
      <button class="back-button" type="button" data-nav="haiku" aria-label="戻る">‹</button>
      <h1>俳句の世界</h1>
      <button class="icon-button" type="button" data-nav="notebook" aria-label="保存一覧">□</button>
    </header>

    <article class="world-paper">
      <div class="vertical-poem world-poem">${verticalLines(haiku.text)}</div>
      <small>${escapeHtml(haiku.author)}</small>
      <div class="world-meta">
        <span>季語　${escapeHtml(haiku.season)}</span>
        <span>場所　${escapeHtml(haiku.place)}</span>
      </div>
      <p>${escapeHtml(haiku.world)}</p>
      <div class="lens-box">
        <strong>今日のまなざし</strong>
        <span>${escapeHtml(haiku.lens)}</span>
      </div>
    </article>

    <button class="primary-button wide-button" type="button" data-nav="feelings">みんなの感じ方を見る</button>
  </div>`;
}

function renderFeelings() {
  const haiku = selectedHaiku();
  const rows = feelingLabels.map((label, index) => {
    const percent = feelingPercent(haiku.id, index);
    return `<button class="feeling-row ${state.selectedFeeling === label ? "active" : ""}" type="button" data-action="select-feeling" data-feeling="${escapeAttr(label)}">
      <span>${escapeHtml(label)}</span>
      <div><i style="width:${percent}%"></i></div>
      <b>${percent}%</b>
    </button>`;
  }).join("");

  return `<div class="view feelings-view">
    <header class="simple-header">
      <button class="back-button" type="button" data-nav="world" aria-label="戻る">‹</button>
      <h1>みんなの感じ方</h1>
      <span class="screen-number">05</span>
    </header>

    <section class="feeling-head">
      <div class="vertical-poem mini-vertical">${verticalLines(haiku.text)}</div>
      <p>この俳句から感じることは、人によって少しずつ違います。</p>
    </section>

    <section class="feeling-list">
      ${rows}
    </section>

    <section class="comment-paper">
      <strong>みんなのことば</strong>
      <p>荒れた海の向こうに、天の川を重ねたような見方。</p>
      <p>強い自然の中で、自分にも揺れがあるような気分。</p>
    </section>

    <button class="primary-button wide-button" type="button" data-nav="next">あなたのことばを置く</button>
  </div>`;
}

function renderNotebook() {
  const entries = state.entries;
  const body = entries.length ? entries.map(renderNotebookEntry).join("") : `<section class="empty-paper">
    <b>0</b>
    <strong>まだ句帳は白紙です</strong>
    <span>街にことばを置くと、最初の一枚がここに残ります。</span>
  </section>`;

  return `<div class="view notebook-view">
    <header class="simple-header">
      <button class="back-button" type="button" data-nav="home" aria-label="戻る">‹</button>
      <h1>わたしの句帳</h1>
      <button class="filter-button" type="button" data-action="clear-selection">編集</button>
    </header>

    <section class="notebook-grid">
      ${body}
    </section>

    ${entries.length ? `<button class="danger-button wide-button" type="button" data-action="delete-selected">選択した句を削除</button>` : ""}
  </div>`;
}

function renderMap() {
  const pins = allEntries().slice(0, 12).map((entry) => `<button class="map-pin ${entry.sample ? "sample" : "mine"}" style="left:${entry.x}%;top:${entry.y}%;" type="button" data-action="open-entry" data-entry-id="${escapeAttr(entry.id)}">
    <span>${escapeHtml(firstText(entry.poem))}</span>
  </button>`).join("");

  return `<div class="view map-view">
    <header class="simple-header">
      <button class="back-button" type="button" data-nav="home" aria-label="戻る">‹</button>
      <h1>どう街を見るかを変える地図</h1>
      <span class="screen-number">07</span>
    </header>

    <section class="map-board">
      <img src="./assets/kotoba-map.png" alt="句が置かれた街の地図" />
      <div class="map-grid"></div>
      ${pins}
    </section>

    <p class="map-note">地図は目的地を示すのではなく、まなざしの重なりを映し出すものです。</p>
  </div>`;
}

function renderNextWalker() {
  const saved = state.entries.find((entry) => entry.id === state.lastSavedId);
  return `<div class="view next-view">
    <header class="simple-header">
      <button class="back-button" type="button" data-nav="feelings" aria-label="戻る">‹</button>
      <h1>次の歩き手へ</h1>
      <span class="screen-number">08</span>
    </header>

    ${saved ? renderSavedEntry(saved) : renderComposePaper()}

    <section class="history-strip">
      <span>これまでの出会い</span>
      <div>
        ${allEntries().slice(0, 4).map((entry) => `<button type="button" data-action="open-entry" data-entry-id="${escapeAttr(entry.id)}">${escapeHtml(formatDate(entry.createdAt))}</button>`).join("")}
      </div>
    </section>
  </div>`;
}

function renderDetail() {
  const entry = allEntries().find((item) => item.id === state.activeEntryId) || allEntries()[0];
  if (!entry) return renderNotebook();
  const haiku = bashoHaiku.find((item) => item.id === entry.haikuId) || selectedHaiku();
  return `<div class="view detail-view">
    <header class="simple-header">
      <button class="back-button" type="button" data-nav="map" aria-label="戻る">‹</button>
      <h1>置かれたことば</h1>
      <span class="screen-number">句</span>
    </header>

    <article class="placed-paper">
      <div class="vertical-poem world-poem">${verticalLines(entry.poem.replace(/\n/g, ""))}</div>
      <small>${escapeHtml(entry.place)} ・ ${escapeHtml(formatDate(entry.createdAt))}</small>
      <p>${escapeHtml(haiku.lens)}</p>
    </article>
  </div>`;
}

function renderComposePaper() {
  const haiku = selectedHaiku();
  return `<section class="compose-paper">
    <span class="compose-label">あなたが置いたことば</span>
    <div class="vertical-poem compose-source">${verticalLines(haiku.text)}</div>
    <label><span>上</span><input data-line="0" maxlength="18" value="${escapeAttr(state.draftLines[0])}" placeholder="旅に病んで" /></label>
    <label><span>中</span><input data-line="1" maxlength="18" value="${escapeAttr(state.draftLines[1])}" placeholder="夢は枯野を" /></label>
    <label><span>下</span><input data-line="2" maxlength="18" value="${escapeAttr(state.draftLines[2])}" placeholder="かけ廻る" /></label>
    <label><span>場所</span><input data-place maxlength="24" value="${escapeAttr(state.draftPlace)}" placeholder="駅前の小道" /></label>
    <button class="primary-button wide-button" type="button" data-action="save-entry">次の誰かへ残す</button>
  </section>`;
}

function renderSavedEntry(entry) {
  return `<section class="saved-paper">
    <span>あなたが置いたことば</span>
    <div class="vertical-poem world-poem">${verticalLines(entry.poem.replace(/\n/g, ""))}</div>
    <small>${escapeHtml(entry.place)} ・ ${escapeHtml(formatDate(entry.createdAt))}</small>
    <div class="next-clue">
      <strong>次の歩き手へ手がかりを残す</strong>
      <p>${escapeHtml(clueById(entry.clueId).note)}</p>
    </div>
    <button class="secondary-button wide-button" type="button" data-action="new-entry">もう一度ことばを置く</button>
  </section>`;
}

function renderNotebookEntry(entry) {
  const selected = state.selectedEntryIds.includes(entry.id);
  return `<article class="notebook-card ${selected ? "selected" : ""}">
    <button class="check-button" type="button" data-action="toggle-entry" data-entry-id="${escapeAttr(entry.id)}">${selected ? "●" : "○"}</button>
    <button class="notebook-main" type="button" data-action="open-entry" data-entry-id="${escapeAttr(entry.id)}">
      <span>${escapeHtml(formatDate(entry.createdAt))}</span>
      <strong>${escapeHtml(entry.poem.replace(/\n/g, "　"))}</strong>
      <small>${escapeHtml(entry.place)}</small>
    </button>
  </article>`;
}

function handleAction(target) {
  const action = target.dataset.action;
  if (action === "daily-reset") chooseDaily();
  if (action === "select-clue") selectClue(target.dataset.clueId);
  if (action === "rotate-haiku") rotateHaiku();
  if (action === "select-haiku") selectHaiku(target.dataset.haikuId);
  if (action === "select-feeling") selectFeeling(target.dataset.feeling);
  if (action === "save-entry") saveEntry();
  if (action === "new-entry") newEntry();
  if (action === "open-entry") openEntry(target.dataset.entryId);
  if (action === "toggle-entry") toggleEntry(target.dataset.entryId);
  if (action === "delete-selected") deleteSelected();
  if (action === "clear-selection") clearSelection();
}

function navigate(view) {
  state.view = view;
  if (view === "haiku" && !state.selectedHaikuId) state.selectedHaikuId = haikuForClue()[0].id;
  saveState();
  render();
}

function chooseDaily() {
  state.clueId = clues[seededNumber(todayKey() + "clue", clues.length)].id;
  state.selectedHaikuId = haikuForClue()[0].id;
  state.selectedFeeling = "";
  saveState();
  showToast("今日のまなざしを選び直しました。");
  render();
}

function selectClue(clueId) {
  state.clueId = clueId;
  state.selectedHaikuId = haikuForClue()[0].id;
  state.selectedFeeling = "";
  saveState();
  render();
}

function rotateHaiku() {
  const list = haikuForClue();
  const index = activeHaikuIndex(list);
  state.selectedHaikuId = list[(index + 1) % list.length].id;
  saveState();
  render();
}

function selectHaiku(haikuId) {
  state.selectedHaikuId = haikuId;
  state.view = "world";
  saveState();
  render();
}

function selectFeeling(feeling) {
  state.selectedFeeling = feeling;
  saveState();
  showToast("感じ方を選びました。");
  render();
}

function saveEntry() {
  const lines = state.draftLines.map((line) => line.trim()).filter(Boolean);
  if (!lines.length) {
    showToast("ことばを書いてから残してください。");
    return;
  }
  const clue = currentClue();
  const entry = {
    id: `entry-${Date.now()}`,
    sample: false,
    haikuId: selectedHaiku().id,
    clueId: clue.id,
    poem: normalizePoem(state.draftLines),
    feeling: state.selectedFeeling || "まだ名前のない感じ",
    place: state.draftPlace.trim() || "歩いていた場所",
    createdAt: new Date().toISOString(),
    x: 16 + ((Date.now() / 7) % 68),
    y: 18 + ((Date.now() / 13) % 62),
  };
  state.entries.unshift(entry);
  state.lastSavedId = entry.id;
  state.activeEntryId = entry.id;
  state.draftLines = ["", "", ""];
  state.draftPlace = "";
  saveState();
  showToast("ことばを置きました。");
  render();
}

function newEntry() {
  state.lastSavedId = "";
  state.draftLines = ["", "", ""];
  state.draftPlace = "";
  saveState();
  render();
}

function openEntry(entryId) {
  state.activeEntryId = entryId;
  state.view = "detail";
  saveState();
  render();
}

function toggleEntry(entryId) {
  if (state.selectedEntryIds.includes(entryId)) {
    state.selectedEntryIds = state.selectedEntryIds.filter((id) => id !== entryId);
  } else {
    state.selectedEntryIds.push(entryId);
  }
  saveState();
  render();
}

function deleteSelected() {
  if (!state.selectedEntryIds.length) {
    showToast("削除する句を選んでください。");
    return;
  }
  state.entries = state.entries.filter((entry) => !state.selectedEntryIds.includes(entry.id));
  state.selectedEntryIds = [];
  saveState();
  showToast("選択した句を削除しました。");
  render();
}

function clearSelection() {
  state.selectedEntryIds = [];
  saveState();
  render();
}

function ensureToday() {
  if (state.date !== todayKey() || !state.clueId) {
    state.date = todayKey();
    state.clueId = clues[seededNumber(state.date, clues.length)].id;
    state.selectedHaikuId = haikuForClue()[0].id;
    state.selectedFeeling = "";
    saveState();
  }
}

function selectedHaiku() {
  return bashoHaiku.find((haiku) => haiku.id === state.selectedHaikuId) || haikuForClue()[0] || bashoHaiku[0];
}

function currentClue() {
  return clueById(state.clueId);
}

function clueById(id) {
  return clues.find((clue) => clue.id === id) || clues[0];
}

function haikuForClue() {
  const list = bashoHaiku.filter((haiku) => haiku.clueId === state.clueId);
  return list.length ? list : bashoHaiku.slice(0, 3);
}

function activeHaikuIndex(list) {
  const index = list.findIndex((haiku) => haiku.id === state.selectedHaikuId);
  return index >= 0 ? index : 0;
}

function allEntries() {
  return [...state.entries, ...sampleEntries];
}

function feelingPercent(seed, index) {
  const base = [48, 26, 16, 10];
  const wobble = seededNumber(seed + index, 9) - 4;
  return Math.max(8, Math.min(62, base[index] + wobble));
}

function normalizePoem(lines) {
  const clean = lines.map((line) => line.trim()).filter(Boolean);
  while (clean.length < 3) clean.push("");
  return clean.slice(0, 3).join("\n");
}

function firstText(poem) {
  return poem.replace(/\n/g, "").slice(0, 2) || "句";
}

function verticalLines(text) {
  return escapeHtml(text).split("").map((char) => `<span>${char}</span>`).join("");
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}.${date.getDate()}`;
}

function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function seededNumber(value, length) {
  let total = 0;
  for (let i = 0; i < value.length; i += 1) total += value.charCodeAt(i) * (i + 1);
  return total % length;
}

function updateTabbar() {
  document.querySelectorAll(".tab").forEach((tab) => {
    const nav = tab.dataset.nav;
    const active =
      state.view === nav ||
      (state.view === "haiku" && nav === "walk") ||
      (state.view === "world" && nav === "walk") ||
      (state.view === "feelings" && nav === "walk") ||
      (state.view === "next" && nav === "notebook") ||
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
    if (!Array.isArray(state.selectedEntryIds)) state.selectedEntryIds = [];
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
