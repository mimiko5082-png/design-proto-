import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, onValue, set, update, get } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { requestPerspective, preparedPerspective } from "./perspective.js?v=39";
import { normalizePlace } from "./place.js?v=39";

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
    id: "presence", prompt: "誰かがここにいた\n痕跡を探す",
    modernTask: "この場所に、誰かがいた痕跡を見つけてください。",
    observation: "人の気配と、環境が残した跡を見る",
    pauseTask: "理由を決めず、まず手がかりをひとつ。",
    noteExample: "ベンチの端だけが濡れていない。誰かが座っていたのかな。",
    source: "現代の観察のお題（本アプリ独自）", category: "跡", color: "#5b6251", image: "./assets/kotoba-mist.png",
  },
  {
    id: "yesterday", prompt: "昨日との違いを\nひとつ見つける",
    modernTask: "よく知っている場所で、昨日の記憶と違うところを探してください。",
    observation: "変化と、自分の記憶を見比べる",
    pauseTask: "初めての場所なら、変わりそうな細部をひとつ。",
    noteExample: "いつもの入口に、今日は小さな鉢が置かれている。",
    source: "現代の観察のお題（本アプリ独自）", category: "跡", color: "#8d4234", image: "./assets/kotoba-lake.png",
  },
  {
    id: "edge", prompt: "光と影の境目を\n見つめる",
    modernTask: "光と影の境目で、見え方が変わるものを探してください。",
    observation: "境目から、見慣れたものを見直す",
    pauseTask: "色、輪郭、温度の違いを、自分の感覚で。",
    noteExample: "壁のひびが、影の中でだけ濃く見える。",
    source: "現代の観察のお題（本アプリ独自）", category: "光", color: "#25496f", image: "./assets/kotoba-sunset.png",
  },
  {
    id: "sound",
    prompt: "一番遠くの音を\n探す",
    homeNote: "芭蕉の観察を、今日の街歩きの手がかりに変えたものです。",
    inspiration: "着想：松尾芭蕉『おくのほそ道』",
    source: "松尾芭蕉『おくのほそ道』立石寺",
    sourceNote: "山寺で、物の音が聞こえないほどの静けさを感じた場面。",
    haiku: "閑さや\n岩にしみ入る\n蝉の声",
    observation: "静けさの中にある音を聴く",
    modernTask: "立ち止まるか座って、30秒間、一番遠くの音を探す",
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
    body: "立ち止まるか座って、30秒間、一番遠くの音を探す",
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
  perspectiveEndpoint: "",
  observationPlace: null,
  placeLoading: false,
  perspective: null,
  perspectiveLoading: false,
  revisitNote: "",
  stance: "",
  reobserved: false,
  observationSeconds: 0,
  studySettings: { condition: "off", participant: "", place: "", order: "AB" },
  activeStudy: null,
  studyRecords: [],
  studyReflection: { stanceReason: "", placeMeaning: "" },
};
let perspectiveRequestId = 0;

loadState();
ensureDaily();
processIncomingManazashi();
render();
initFirebaseSync();
setInterval(updateTimer, 1000);
document.addEventListener("visibilitychange", updateTimer);

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
  if (event.target.matches("[data-completed-reflection]")) {
    updateStudyReflection(event.target.dataset.entryId, event.target.dataset.completedReflection, event.target.value);
  }
  if (event.target.matches("[data-study-reflection]")) {
    const key = event.target.dataset.studyReflection;
    if (["stanceReason", "placeMeaning"].includes(key)) {
      state.studyReflection[key] = event.target.value.slice(0, 280);
      saveState();
    }
  }
  if (event.target.matches("[data-note-input]")) {
    state.note = event.target.value.slice(0, 280);
    state.perspective = null;
    saveState();
  }
  if (event.target.matches("[data-revisit-input]")) {
    state.revisitNote = event.target.value.slice(0, 280);
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
    perspective: renderPerspective,
    revisit: renderPause,
    update: renderUpdate,
    receive: renderReceive,
    seeds: renderSeeds,
    calendar: () => `<div class="view"><basho-reading mode="calendar"></basho-reading></div>`,
    garden: () => `<div class="view"><basho-reading mode="garden"></basho-reading></div>`,
    entry: renderEntry,
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
      <button class="round-button basho-mark-button" type="button" aria-label="芭蕉">芭</button>
      <button class="today-chip" type="button" data-action="today">今日の<br>まなざし</button>
    </header>
    <basho-reading></basho-reading>
    <section class="manazashi-card source-home-card quiet-card">
      <span class="screen-label">今日のまなざし</span>
      <div class="ink-branch"></div>
      <p class="today-copy">今日は、</p>
      <h1>${lineBreak(gaze.prompt)}</h1>
      <i style="background:${escapeAttr(gaze.color)}"></i>
      <p>いつもの街を、自分の感覚で。<br>先に観察し、あとから別の見方に出会います。</p>
      <span class="source-badge">観察 → 記録 → 問い返し → 再観察</span>
      <button class="main-button" type="button" data-nav="pause">30秒、まわりを見る</button>
    </section>
    <basho-notifications></basho-notifications>
    <section class="experience-guide basic-experience" aria-label="街を観察して振り返る4つのステップ">
      <h2>いつもの街を見る、4つのステップ</h2>
      <ol>
        <li><strong>お題を受け取る</strong><span>気になるお題をひとつ選び、見過ごしていたものに目を向ける。</span></li>
        <li><strong>30秒、観察する</strong><span>安全な場所で立ち止まるか、ベンチなどに座って。スマホを下ろし、目や耳や肌で感じる。</span></li>
        <li><strong>気づきを残し、別の見方に出会う</strong><span>まずは自分の言葉で、一語や一文を記録する。俳句にしなくても大丈夫。そのあとに届く問いは、同意しても、疑っても。</span></li>
        <li><strong>もう一度見て、句帳で振り返る</strong><span>同じ場所をもう一度観察し、気づきの変化を残す。句帳で見比べ、ほかの人の見方にも出会う。</span></li>
      </ol>
    </section>
    <details class="prompt-options"><summary>ほかのお題を選ぶ</summary>
      ${gazes.map(item => `<button type="button" data-action="choose-gaze" data-gaze-id="${item.id}" aria-pressed="${item.id === gaze.id}">${escapeHtml(item.prompt.replace(/\n/g, ""))}</button>`).join("")}
    </details>
    <p class="lens-footnote">${escapeHtml(gaze.source)}<br>観察のお題は現代の街歩き向けに再構成したものです。</p>
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
  const revisiting = state.view === "revisit";
  const remaining = timerRemaining();
  const progress = 1 - remaining / 30;
  const dash = Math.round(276 * progress);
  return `<div class="view feel-view observation-view">
    <header class="minimal-head">
      <button class="x-button" type="button" data-nav="${revisiting ? "perspective" : "home"}" aria-label="閉じる">×</button>
    </header>
    <section class="feel-paper quiet-card">
      <span class="screen-label">${revisiting ? "同じ場所を、もう一度" : "30秒、まわりを見る"}</span>
      <p>安全な場所で立ち止まるか、ベンチなどに座ってみましょう。<br>スマホを下ろして、楽な姿勢でまわりを眺めてみてください。<br>画面を見続ける必要はありません。</p>
      <div class="timer-ring" data-el="timer" aria-hidden="true" style="--dash:${dash}">
        <strong>${remaining}</strong>
        <span>秒</span>
      </div>
      <p class="pause-task">${escapeHtml(revisiting ? state.perspective?.question || gaze.modernTask : gaze.modernTask)}</p>
      <small>${revisiting ? "問いに同意しなくても大丈夫。自分の感覚で確かめてください。" : escapeHtml(gaze.pauseTask)}</small>
      <p class="timer-status" data-el="timer-status">${remaining ? "30秒後、戻ったら気づきを残せます。" : "観察の時間が終わりました。戻ったら記録へ。"}</p>
      <button class="outline-button" type="button" data-el="timer-next" data-nav="${revisiting ? "update" : "note"}" ${remaining ? "disabled" : ""}>${revisiting ? "気づきの変化を残す" : "気づきを残す"}</button>
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
      <button class="back-button" type="button" data-nav="home" aria-label="戻る">←</button>
      <button class="save-link" type="button" data-action="save-note">次へ</button>
    </header>
    <section class="note-paper note-board quiet-card">
      <span class="screen-label">何が気になりましたか？</span>
      <p class="note-lead">一語でも、一文でも。<br>今の気づきを残してください。</p>
      <label class="note-memory">
        <textarea data-note-input aria-label="最初の気づき" maxlength="280" placeholder="${escapeAttr(gaze.noteExample)}">${escapeHtml(state.note)}</textarea>
      </label>
      <div class="category-line">
        <span>いちばん気になった感覚</span>
        ${["音", "流れ", "光", "風", "匂い"].map((category) => `<button class="${state.noteCategory === category ? "active" : ""}" type="button" data-action="category" data-category="${escapeAttr(category)}">${escapeHtml(category)}</button>`).join("")}
      </div>
      <p class="lens-footnote">俳句にしなくても大丈夫。見聞きしたことと、想像したことを自分の言葉で。</p>
      <button class="main-button" type="button" data-action="save-note">${state.activeStudy?.condition === "A" ? "この気づきを残す" : "別の見方に出会う"}</button>
      <p class="lens-footnote">${state.activeStudy?.condition === "A" ? "条件A：問い返しと再観察を行わず、記録をこの端末に残します。" : (state.perspectiveEndpoint || window.BASHO_PERSPECTIVE?.endpoint) ? "次へ進むと、お題と記録の文章をAIへ送ります。写真・位置情報は送りません。" : "現在は用意された問いを表示します。AIは未接続です。"}</p>
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

function renderPerspective() {
  const perspective = state.perspective;
  return `<div class="view reflection-view">
    <header class="simple-head"><button class="back-button" type="button" data-nav="note" aria-label="記録に戻る">←</button><span>もうひとつの視点</span></header>
    <section class="reflection-card quiet-card">
      <span class="screen-label">自分の気づきから、問いへ</span>
      <article class="evidence-card"><small>最初の記録 · あなたの言葉</small><p>${escapeHtml(state.note)}</p></article>
      ${state.perspectiveLoading ? `<p role="status">記録をもとに、問いを考えています…</p>` : perspective ? `
        <span class="perspective-label">${perspective.kind === "ai" ? "AIからの問い返し" : "用意された問い · AI生成ではありません"}</span>
        ${perspective.reason === "unavailable" ? `<p class="lens-footnote" role="status">AIに接続できなかったため、用意された問いを表示しています。</p>` : ""}
        ${perspective.reason === "free-quota" ? `<p class="lens-footnote" role="status">本日のAI無料枠を使い切ったため、用意された問いを表示しています。有料APIには切り替えません。</p>` : ""}
        <article class="hypothesis-card"><small>別の見方の仮説 · 未確認</small>${perspective.hypotheses.map(item => `<p>${escapeHtml(item)}</p>`).join("")}</article>
        <blockquote class="reflection-question">${escapeHtml(perspective.question)}</blockquote>
        <p class="lens-footnote">場所や写真を確認した解釈ではありません。あなたの記録から考えた可能性です。正解として受け取る必要はありません。</p>
        <fieldset class="stance-options"><legend>この問いを、どう受け取りましたか？（任意）</legend>
          ${[["agree", "なるほどと思う"], ["question", "違う気がする"], ["own", "自分の見方で進む"]].map(([value, label]) => `<button type="button" data-action="stance" data-stance="${value}" aria-pressed="${state.stance === value}">${label}</button>`).join("")}
        </fieldset>
        <button class="main-button" type="button" data-nav="revisit">同じ場所を、もう一度見る</button>
        <button class="outline-button" type="button" data-action="finish-observation" data-skip="true">再観察せず、最初の記録を残す</button>` : `<button class="main-button" type="button" data-action="save-note">問いを読み込む</button>`}
    </section>
  </div>`;
}

function renderUpdate() {
  return `<div class="view reflection-view">
    <header class="simple-head"><button class="back-button" type="button" data-nav="perspective" aria-label="問いに戻る">←</button><span>気づきを更新する</span></header>
    <section class="reflection-card quiet-card">
      <span class="screen-label">何が変わりましたか？</span>
      <article class="evidence-card"><small>最初の気づき</small><p>${escapeHtml(state.note)}</p></article>
      <blockquote class="reflection-question">${escapeHtml(state.perspective?.question || "もう一度見て、何が気になりましたか？")}</blockquote>
      <label class="note-memory"><span>もう一度見たあとの気づき</span><textarea data-revisit-input maxlength="280" placeholder="新しく見えたこと、問いと違ったこと、変わらなかったこと。">${escapeHtml(state.revisitNote)}</textarea></label>
      <p class="lens-footnote">変わらなかった、手がかりが見つからなかった、でも大丈夫です。</p>
      ${state.activeStudy ? `<details class="study-reflection"><summary>体験を振り返る（任意・この端末にだけ保存）</summary>
        <label>問いを受け入れた・疑った・使わなかった理由<textarea data-study-reflection="stanceReason" maxlength="280" placeholder="自分の手がかりと合っていた？ 違っていた？">${escapeHtml(state.studyReflection.stanceReason)}</textarea></label>
        <label>この場所は、体験する前と比べてどう見えますか？<textarea data-study-reflection="placeMeaning" maxlength="280" placeholder="変わったこと、変わらなかったことを自分の言葉で。">${escapeHtml(state.studyReflection.placeMeaning)}</textarea></label>
      </details>` : ""}
      <button class="main-button" type="button" data-action="finish-observation">ふたつの気づきを残す</button>
    </section>
  </div>`;
}

function renderObservationTrace(entry) {
  const trace = entry.observationTrace;
  if (!trace) return "";
  const stance = { agree: "なるほどと思う", question: "違う気がする", own: "自分の見方で進む" }[trace.stance] || "回答なし";
  return `<details class="observation-trace"><summary>まなざしの変化を見る</summary>
    <small>最初の気づき</small><p>${escapeHtml(trace.firstNote)}</p>
    ${trace.perspectiveKind === "none" ? `<p>条件A：問い返しは行っていません。</p>` : `<small>${trace.perspectiveKind === "ai" ? "AIからの問い" : "用意された問い"}</small><p>${escapeHtml(trace.question)}</p>
    <small>問いの受け取り方</small><p>${stance}</p>`}
    <small>再観察後の気づき</small><p>${escapeHtml(trace.reobserved ? trace.finalNote : "再観察は行っていません。")}</p>
  </details>`;
}

function renderCompletedStudyReflection(entry) {
  const record = state.studyRecords.find(item => item.entryId === entry.id);
  if (!record) return "";
  return `<section class="study-reflection" aria-label="体験後の振り返り">
    <h2>この場所は、どう見えましたか？</h2>
    <p>条件${escapeHtml(record.condition)}の振り返りです。入力は自動保存され、この端末の実験CSVにだけ含まれます。</p>
    ${record.beforePlaceMeaning ? `<article class="evidence-card"><small>観察前の場所の印象</small><p>${escapeHtml(record.beforePlaceMeaning)}</p></article>` : ""}
    <label>体験する前と比べて、この場所の見え方は変わりましたか？（任意）
      <textarea data-completed-reflection="placeMeaning" data-entry-id="${escapeAttr(entry.id)}" maxlength="280" placeholder="新しく気づいたこと、変わらなかったこと。">${escapeHtml(record.placeMeaning || "")}</textarea>
    </label>
    ${record.perspectiveKind !== "none" ? `<label>問いを受け入れた・疑った・使わなかった理由（任意）
      <textarea data-completed-reflection="stanceReason" data-entry-id="${escapeAttr(entry.id)}" maxlength="280" placeholder="自分が見た手がかりと、問いの見方を比べて。">${escapeHtml(record.stanceReason || "")}</textarea>
    </label>` : ""}
  </section>`;
}

function updateStudyReflection(entryId, key, value) {
  if (!["placeMeaning", "stanceReason"].includes(key)) return;
  const record = state.studyRecords.find(item => item.entryId === entryId);
  if (!record || (key === "stanceReason" && record.perspectiveKind === "none")) return;
  record[key] = String(value).slice(0, 280);
  record.reflectionUpdatedAt = Date.now();
  saveState();
}

function renderEncounter() {
  const gaze = currentGaze();
  const entry = activeEntry();
  return `<div class="view encounter-view">
    <header class="simple-head">
      <button class="back-button" type="button" data-nav="home" aria-label="まなざしへ戻る">←</button>
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
      ${renderObservationTrace(entry)}
      ${renderCompletedStudyReflection(entry)}
      <button class="outline-button" type="button" data-nav="notebook">句帳でまなざしを見る</button>
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

function renderEntry() {
  const entry = activeEntry();
  return `<div class="view entry-view"><header class="simple-head"><button class="back-button" type="button" data-nav="notebook" aria-label="句帳に戻る">←</button><span>まなざしの記録</span></header><section class="reflection-card quiet-card"><small>${escapeHtml(entry.date || entry.source || "")}</small><h1>${lineBreak(entry.title)}</h1><p>${escapeHtml(entry.body || entry.task || "")}</p>${renderObservationTrace(entry)}<button class="main-button" type="button" data-action="borrow-gaze">このまなざしで観察する</button></section></div>`;
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
      <button class="back-button" type="button" data-nav="home" aria-label="戻る">←</button>
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
  if (action === "choose-gaze") {
    if (gazes.some(item => item.id === target.dataset.gazeId)) {
      state.gazeId = target.dataset.gazeId;
      state.noteCategory = currentGaze().category;
      state.borrowedManazashi = null;
      state.perspective = null;
      state.date = todayKey();
      saveState();
      render();
    }
    return;
  }
  if (action === "stance") {
    state.stance = state.stance === target.dataset.stance ? "" : target.dataset.stance;
    saveState();
    render();
    return;
  }
  if (action === "finish-observation") {
    finishObservation(target.dataset.skip === "true");
    return;
  }
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
    navigate("entry");
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
  if (action === "set-study") {
    state.studySettings = normalizeStudy({
      condition: document.querySelector("[data-study-condition]").value,
      participant: document.querySelector("[data-study-participant]").value,
      place: document.querySelector("[data-study-place]").value,
      order: document.querySelector("[data-study-order]").value,
      beforePlaceMeaning: document.querySelector("[data-study-before]").value,
    });
    saveState(); render(); showToast("次の観察の条件を設定しました。"); return;
  }
  if (action === "export-study") { exportStudy(); return; }
  if (action === "set-ai-endpoint") {
    try {
      const url = new URL(document.querySelector("[data-endpoint-input]").value.trim());
      if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error();
      state.perspectiveEndpoint = url.href; saveState(); render(); showToast("AIの接続先を保存しました。");
    } catch { showToast("認証情報やクエリを含まないHTTPSのURLを入力してください。"); }
    return;
  }
  if (action === "clear-ai-endpoint") {
    state.perspectiveEndpoint = "";
    window.BASHO_PERSPECTIVE = { endpoint: "" };
    saveState(); render(); showToast("この端末のAI接続を解除しました。"); return;
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
    navigate("entry");
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
  if (!detailEntries().some((entry) => entry.id === state.activeEntryId)) {
    state.activeEntryId = detailEntries()[0]?.id || "";
  }
  saveEntriesOnly();
  saveState();
  render();

  const deletedOnline = await deleteEntriesFromFirebase(idsToDelete);
  showToast(deletedOnline ? "削除をほかの端末にも反映しました。" : "句帳から削除しました。");
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
      (entry) => entry?.id?.startsWith("entry-") && !entry.localOnly && !deletedSet.has(entry.id)
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
        state.entries = uniqueEntriesById([...state.entries.filter(entry => entry.localOnly), ...remoteEntries]);
        state.cloudStatus = "synced";
        state.cloudUpdatedAt = Date.now();
        saveEntriesOnly();
        saveState();
        if (state.view === "notebook" || state.view === "entry") render();
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
  if (entry?.localOnly || !bashoFirebaseReady || !bashoRootRef || !entry?.id) return false;
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
    ...(normalizePlace(entry.place) ? { place: normalizePlace(entry.place) } : {}),
    ...(entry.observationTrace ? { observationTrace: normalizeObservationTrace(entry.observationTrace) } : {}),
  };
}

function normalizeSyncedEntry(entry) {
  return cloudEntry(entry);
}

function logStudyEvent(action, view = state.view) {
  if (!state.activeStudy) return;
  const events = state.activeStudy.events || (state.activeStudy.events = []);
  events.push({ action, view, at: Date.now() });
}

function navigate(view) {
  if (view === "map") view = "calendar";
  if ((view === "note" && state.view === "pause") || (view === "update" && state.view === "revisit")) {
    if (timerRemaining() > 0) return;
    if (view === "note") state.observationSeconds = 30;
    else state.reobserved = true;
  }
  if ((view === "revisit" || view === "update") && !state.perspective) return;
  state.view = view;
  state.notebookEditing = false;
  state.selectedEntryIds = [];
  if (view === "home") {
    state.incomingManazashi = null;
    state.borrowedManazashi = null;
  }
  if (view === "pause") {
    // Invalidate an older response before starting a fresh observation.
    perspectiveRequestId++;
    state.perspectiveLoading = false;
    state.studyReflection = { stanceReason: "", placeMeaning: "" };
    state.activeStudy = state.studySettings.condition === "off" ? null : { ...normalizeStudy(state.studySettings), startedAt: Date.now(), events: [] };
    state.studySettings.beforePlaceMeaning = "";
    state.observationSeconds = 0;
    state.perspective = null;
    state.stance = "";
    state.reobserved = false;
    state.revisitNote = "";
  }
  if (view === "pause" || view === "revisit") state.timerStartedAt = Date.now();
  logStudyEvent("view", view);
  saveState();
  render();
}

async function saveNote() {
  if (state.perspectiveLoading) return;
  if (!state.note.trim()) {
    showToast("あなたが気づいたことを、一語でも残してください。");
    return;
  }
  if (state.activeStudy?.condition === "A") { finishObservation(true); return; }
  const note = state.note.trim();
  const gaze = currentGaze();
  const requestId = ++perspectiveRequestId;
  state.perspective = null;
  state.stance = "";
  state.revisitNote = "";
  state.reobserved = false;
  state.perspectiveLoading = true;
  navigate("perspective");
  logStudyEvent("question-requested");
  saveState();
  const perspective = await requestPerspective(note, gaze, state.perspectiveEndpoint || window.BASHO_PERSPECTIVE?.endpoint || "");
  if (requestId !== perspectiveRequestId) return;
  state.perspectiveLoading = false;
  if (state.note.trim() === note && currentGaze().id === gaze.id) {
    state.perspective = perspective;
    logStudyEvent(perspective.kind === "ai" ? "ai-question-ready" : "prepared-question-ready");
  }
  saveState();
  if (state.view === "perspective") render();
}

function normalizeObservationTrace(trace) {
  return {
    prompt: String(trace.prompt || ""), firstNote: String(trace.firstNote || ""),
    finalNote: String(trace.finalNote || ""), question: String(trace.question || ""),
    hypotheses: Array.isArray(trace.hypotheses) ? trace.hypotheses.map(String).slice(0, 3) : [],
    perspectiveKind: ["ai", "none"].includes(trace.perspectiveKind) ? trace.perspectiveKind : "prepared",
    stance: ["agree", "question", "own"].includes(trace.stance) ? trace.stance : "",
    reobserved: trace.reobserved === true, observationSeconds: Number(trace.observationSeconds || 0),
    revisitSeconds: trace.reobserved === true ? Number(trace.revisitSeconds || 0) : 0,
  };
}

function finishObservation(skip = false) {
  const conditionA = state.activeStudy?.condition === "A" && state.view === "note";
  if (!conditionA && (!["perspective", "update"].includes(state.view) || !state.perspective || state.perspectiveLoading)) return;
  if (!state.note.trim()) return;
  if (conditionA) skip = true;
  if (!skip && (!state.reobserved || !state.revisitNote.trim())) {
    showToast("もう一度見たあとの気づきを、一語でも残してください。");
    return;
  }
  const gaze = currentGaze();
  const now = Date.now();
  const firstNote = state.note.trim();
  const text = skip ? firstNote : state.revisitNote.trim();
  const image = state.notePhoto || gaze.image;
  const entry = {
    id: `entry-${now}`,
    ...(state.activeStudy ? { localOnly: true } : {}),
    title: text,
    body: `${gaze.observation}から、街の${state.noteCategory}を見つける。`,
    date: formatDate(new Date(now)),
    savedAt: now,
    category: state.noteCategory || gaze.category,
    image,
    x: 35 + ((now / 17) % 42),
    y: 28 + ((now / 29) % 48),
    ...(normalizePlace(state.observationPlace) ? { place: normalizePlace(state.observationPlace) } : {}),
    observationTrace: normalizeObservationTrace({
      prompt: gaze.modernTask, firstNote, finalNote: skip ? "" : text,
      question: state.perspective?.question || "", hypotheses: state.perspective?.hypotheses || [],
      perspectiveKind: conditionA ? "none" : state.perspective.kind, stance: state.stance,
      reobserved: !skip, observationSeconds: state.observationSeconds,
      revisitSeconds: skip ? 0 : 30,
    }),
  };
  if (state.activeStudy) {
    logStudyEvent(skip ? "saved-without-reobservation" : "saved-after-reobservation");
    state.studyRecords.push({ ...state.activeStudy, entryId: entry.id, savedAt: now, category: entry.category,
      ...entry.observationTrace, ...state.studyReflection });
  }
  state.activeStudy = null;
  state.studyReflection = { stanceReason: "", placeMeaning: "" };
  state.entries.unshift(entry);
  state.entries = uniqueEntriesById(state.entries);
  state.activeEntryId = entry.id;
  state.note = "";
  state.notePhoto = "";
  state.observationPlace = null;
  state.perspective = null;
  state.revisitNote = "";
  state.stance = "";
  state.reobserved = false;
  state.observationSeconds = 0;
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
  const next = document.querySelector("[data-el='timer-next']");
  if (next) next.disabled = remaining > 0;
  const status = document.querySelector("[data-el='timer-status']");
  if (status && !remaining) status.textContent = "観察の時間が終わりました。戻ったら記録へ。";
}

function timerRemaining() {
  if (!state.timerStartedAt) return 30;
  const elapsed = Math.floor((Date.now() - state.timerStartedAt) / 1000);
  return Math.max(0, 30 - elapsed);
}

function ensureDaily() {
  const today = todayKey();
  const hasValidGaze = gazes.some((gaze) => gaze.id === state.gazeId);
  // Keep an unfinished observation attached to its original task across midnight.
  if (hasValidGaze && state.note.trim() && ["note", "perspective", "revisit", "update"].includes(state.view)) return;
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
    modernTask: `立ち止まるか座って、30秒間、「${oneLine(item.title)}」という視点で街を見る`,
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

function detailEntries() {
  const deletedIds = new Set(state.deletedEntryIds || []);
  return [...state.entries, ...seeds, ...sampleEntries].filter((entry) => !deletedIds.has(entry.id));
}

function activeEntry() {
  const entries = detailEntries();
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
  tabbar.hidden = ["pause", "revisit"].includes(state.view);
  document.querySelectorAll(".tab").forEach((tab) => {
    const nav = tab.dataset.nav;
    const active =
      state.view === nav ||
      (["classic", "pause", "note", "perspective", "revisit", "update", "encounter", "seeds"].includes(state.view) && nav === "home") ||
      (["share", "book", "entry"].includes(state.view) && nav === "notebook");
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
  state.observationPlace = null;
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
    if (state.view === "map") state.view = "calendar";
    const allowedViews = ["home", "classic", "pause", "note", "perspective", "revisit", "update", "encounter", "receive", "seeds", "calendar", "garden", "entry", "notebook", "share", "book"];
    if (!allowedViews.includes(state.view)) state.view = "home";
    if (!Array.isArray(state.entries)) state.entries = [];
    state.studySettings = normalizeStudy(state.studySettings);
    if (!Array.isArray(state.studyRecords)) state.studyRecords = [];
    if (state.activeStudy) state.activeStudy = { ...normalizeStudy(state.activeStudy), startedAt: Number(state.activeStudy.startedAt || 0),
      events: Array.isArray(state.activeStudy.events) ? state.activeStudy.events : [] };
    state.studyReflection = { stanceReason: String(state.studyReflection?.stanceReason || "").slice(0, 280),
      placeMeaning: String(state.studyReflection?.placeMeaning || "").slice(0, 280) };
    if (!Array.isArray(state.selectedEntryIds)) state.selectedEntryIds = [];
    if (!Array.isArray(state.deletedEntryIds)) state.deletedEntryIds = [];
    if (typeof state.notePhoto !== "string") state.notePhoto = "";
    if (typeof state.note !== "string") state.note = "";
    if (typeof state.revisitNote !== "string") state.revisitNote = "";
    state.placeLoading = false;
    state.observationPlace = normalizePlace(state.observationPlace);
    state.perspectiveLoading = false;
    if (state.view === "perspective" && !state.perspective && state.note.trim()) {
      state.perspective = preparedPerspective(state.note.trim(), state.gazeId);
    }
    if (["revisit", "update"].includes(state.view) && !state.perspective) state.view = "note";
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
    ...(entry.localOnly ? { localOnly: true } : {}),
    title: entry.title,
    body: entry.body,
    date: entry.date,
    savedAt: entry.savedAt,
    category: entry.category,
    image: compactEntryImage(entry.image),
    x: entry.x,
    y: entry.y,
    ...(normalizePlace(entry.place) ? { place: normalizePlace(entry.place) } : {}),
    ...(entry.observationTrace ? { observationTrace: normalizeObservationTrace(entry.observationTrace) } : {}),
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


function normalizeStudy(value = {}) {
  return { condition: ["A", "B"].includes(value?.condition) ? value.condition : "off",
    participant: String(value?.participant || "").trim().slice(0, 40),
    beforePlaceMeaning: String(value?.beforePlaceMeaning || "").trim().slice(0, 280),
    place: String(value?.place || "").trim().slice(0, 80), order: value?.order === "BA" ? "BA" : "AB" };
}

function studyCSV(records) {
  const columns = ["entryId", "participant", "condition", "order", "place", "startedAt", "savedAt", "prompt", "category", "firstNote", "perspectiveKind", "question", "hypotheses", "stance", "reobserved", "observationSeconds", "revisitSeconds", "finalNote", "stanceReason", "placeMeaning", "events", "beforePlaceMeaning", "reflectionUpdatedAt"];
  const cell = value => {
    let text = Array.isArray(value) ? (value.some(item => typeof item === "object") ? JSON.stringify(value) : value.join(" / ")) : String(value ?? "");
    // Keep user text from being executed as a spreadsheet formula.
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  return "\uFEFF" + [columns, ...records.map(row => columns.map(key => row[key]))].map(row => row.map(cell).join(",")).join("\r\n");
}

function exportStudy() {
  if (!state.studyRecords.length) return;
  const blob = new Blob([studyCSV(state.studyRecords)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = "basho-study-" + todayKey() + ".csv";
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("実験記録を書き出しました。");
}
