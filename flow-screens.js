// Screens around みんなの記録: 友達 (invite, join, leave), the invitation landing, and the five-step guide.
// They only arrange what firebase-friends.js already enforces; nothing here decides who may see a group.
import { friendsSession, friendsGroup, pendingInvite, pendingInviteMeta, discardFriendsInvite, stageFriendsInvite, createFriendsGroup, createFriendsInvite, joinFriendsGroup, leaveFriendsGroup, LAST_MEMBER, friendsSignOut, friendlyError } from './firebase-friends.js?v=83';
import { sharingAPI, sharingProfile, ensureSharingProfile } from './sharing-client.js?v=83';
import { escapeText as esc } from './photo-postcard.js';
import { dailyTopic } from './haiku-catalog.js';
import { japanDay } from './reading-store.js';

const GUIDE_KEY='basho_guide_seen_v1';
export function guideSeen(){try{return localStorage.getItem(GUIDE_KEY)==='1';}catch{return true;}}
export function markGuideSeen(){try{localStorage.setItem(GUIDE_KEY,'1');}catch{}}
const go=(view,mode)=>window.dispatchEvent(new CustomEvent('basho-navigate',{detail:mode?{view,mode}:view}));
const demo=()=>!!window.BASHO_SHARING_DEMO;
const TINTS=['#c9a24a','#9fb4c8','#d48f7a','#b7a5d6','#8fc7b4'];
const face=(member,index)=>`<span class="avatar${member.own?' avatar-own':''}" ${member.own?'':`style="background:${TINTS[(index+TINTS.length-1)%TINTS.length]}"`} aria-hidden="true">${member.own?'自':esc(Array.from(member.name||'友')[0])}</span>`;
const BACK='<button type="button" class="flow-back" data-nav="friends" aria-label="みんなの記録に戻る"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7"/></svg></button>';
const SHARE_ICON='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 15V4"/><path d="M8 8l4-4 4 4"/><path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>';
const CHECK='<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="完了"><path d="M4.5 12.5l5 5L19.5 7"/></svg>';
const profileOf=()=>{try{return sharingProfile();}catch{return null;}};
const dateText=timestamp=>new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'long',day:'numeric'}).format(timestamp);
const clock=timestamp=>{const text=new Date(timestamp+9*3600000).toISOString().slice(11,16);return Number(text.slice(0,2))+text.slice(2);};

class FriendsScreen extends HTMLElement {
  connectedCallback() {
    this.busy='';this.status='';this.error='';this.members=null;this.membersError='';this.inviteURL='';this.inviteDraft='';this.leaving=false;this.request=0;
    this.addEventListener('click',this.onClick=event=>this.handle(event));
    this.addEventListener('input',this.onInput=event=>{if(event.target.matches('[data-invite-input]'))this.inviteDraft=event.target.value;});
    this.onChange=()=>{if(this.busy)return;this.render();this.loadMembers();};
    this.onAuth=()=>{++this.request;this.members=null;this.inviteURL='';this.leaving=false;this.busy='';this.render();this.loadMembers();};
    window.addEventListener('basho-sharing-updated',this.onChange);window.addEventListener('basho-auth-changed',this.onAuth);
    this.render();
    if(demo())this.loadMembers();else friendsSession().then(()=>{if(this.isConnected){this.render();this.loadMembers();}}).catch(()=>{});
  }
  disconnectedCallback(){++this.request;window.removeEventListener('basho-sharing-updated',this.onChange);window.removeEventListener('basho-auth-changed',this.onAuth);}
  member(){return demo()||(!!profileOf()?.confirmed&&!!friendsGroup());}
  async loadMembers() {
    if(demo()){this.members=[{name:profileOf()?.name||'自分',own:true,joinedAt:null,postedAt:null},{name:'みほ',own:false,joinedAt:null,postedAt:null},{name:'ななみ',own:false,joinedAt:null,postedAt:null}];this.render();return;}
    if(!this.member())return;
    const request=++this.request,group=friendsGroup();
    try{const result=await sharingAPI('members');if(request===this.request&&this.isConnected&&group===friendsGroup()){this.members=result.members;this.membersError='';}}
    catch(error){if(request===this.request)this.membersError=friendlyError(error).message;}
    if(request===this.request&&this.isConnected&&!this.busy)this.render();
  }
  async invitation() {
    if(!this.inviteURL)this.inviteURL=await createFriendsInvite();
    return this.inviteURL;
  }
  async run(name,task) {
    if(this.busy)return;
    this.busy=name;this.error='';this.status='';this.render();
    try{await task();}catch(error){this.error=friendlyError(error).message;}
    finally{this.busy='';if(this.isConnected){this.render();this.loadMembers();}}
  }
  async handle(event) {
    const button=event.target.closest('[data-friends-action]');if(!button||this.busy)return;
    const action=button.dataset.friendsAction;
    if(demo()&&['share','copy','leave','signout'].includes(action)){this.leaving=false;this.status='プレビューでは、招待・参加・退出は実際には行いません。';this.render();return;}
    if(action==='login')return this.run('login',async()=>{await ensureSharingProfile();});
    if(action==='signout')return this.run('signout',async()=>{await friendsSignOut();this.members=null;this.inviteURL='';});
    if(action==='paste'){
      try{this.inviteDraft=(await navigator.clipboard.readText()).trim();this.error='';this.render();}
      catch{this.error='貼り付けられませんでした。入力欄を長押しして貼り付けてください。';this.render();}
      return;
    }
    if(action==='join'||action==='join-pending')return this.run('join',async()=>{
      if(action==='join')stageFriendsInvite(this.inviteDraft||this.querySelector('[data-invite-input]')?.value||'');
      if(!await ensureSharingProfile())return;
      const result=await joinFriendsGroup();this.inviteDraft='';
      this.status=result?.synced===false?'このアプリで友達に参加できました。他の端末でも参加する場合は、同じ招待リンクをアプリ内に貼り付けてください。':'友達とつながりました。友達の写真は「みんなの記録」で見られます。';
    });
    if(action==='create')return this.run('create',async()=>{
      if(!await ensureSharingProfile())return;
      await createFriendsGroup();this.inviteURL=await createFriendsInvite();
      this.status='グループを作りました。招待リンクを友達に送ってください。';
    });
    if(action==='share'||action==='copy') {
      // Sharing and copying need the tap that started them; a link made on a first tap is offered again for a second one.
      const ready=!!this.inviteURL;
      this.busy=action;this.error='';this.status='';if(!ready)this.render();
      try{
        const url=await this.invitation(),name=profileOf()?.name||'';
        if(action==='share'&&navigator.share){
          try{await navigator.share({title:'芭蕉のまなざし',text:`${name?name+'さんから、':''}「芭蕉のまなざし」への招待です。毎日ひとつの句をお題に、1日1枚の写真を見せ合います。`,url});this.status='招待リンクを送る画面を開きました。';}
          catch(error){if(error?.name!=='AbortError')this.status=ready?'送る画面を開けませんでした。下のリンクをコピーして送ってください。':'招待リンクを作りました。もう一度押すと送れます。';}
        }else{
          try{await navigator.clipboard.writeText(url);this.status=action==='share'?'この端末では共有メニューを使えないため、招待リンクをコピーしました。':'招待リンクをコピーしました。友達に貼り付けて送ってください。';}
          catch{this.status=ready?'コピーできませんでした。下のリンクを長押ししてコピーしてください。':'招待リンクを作りました。もう一度押すとコピーできます。';}
        }
      }catch(error){this.error=friendlyError(error).message;}
      finally{this.busy='';if(this.isConnected)this.render();}
      return;
    }
    if(action==='ask-leave'){if(!demo()&&this.members?.length===1){this.status='';this.error=LAST_MEMBER;this.render();return;}this.error='';this.leaving=true;this.render();return;}
    if(action==='cancel-leave'){this.leaving=false;this.render();return;}
    if(action==='leave'){this.leaving=false;return this.run('leave',async()=>{await leaveFriendsGroup();this.members=null;this.inviteURL='';this.status='グループを抜けました。';});}
  }
  notices(){return `<p class="flow-status" role="status">${esc(this.status)}</p>${this.error?`<p class="flow-error" role="alert">${esc(this.error)}</p>`:''}`;}
  joined() {
    const profile=profileOf(),members=this.members||[];
    const rows=members.map((member,index)=>`<li>${face(member,index)}<span class="people-name"><strong>${esc(member.name)}${member.own?'・あなた':''}</strong><small>${member.joinedAt?esc(dateText(member.joinedAt))+' 参加':''}</small></span>${demo()?'':member.postedAt?`<span class="people-today is-done">今日 ${clock(member.postedAt)}</span>`:'<span class="people-today">今日はまだ</span>'}</li>`).join('');
    return `<section class="invite-card" aria-label="友達を招待する"><h2>友達を招待する</h2><p>リンクを受け取った人が、このグループに参加できます。</p><button type="button" class="invite-send" data-friends-action="share" ${this.busy?'disabled':''}>${SHARE_ICON}${this.busy==='share'?'招待リンクを作っています…':'招待リンクを送る'}</button><button type="button" class="invite-copy" data-friends-action="copy" ${this.busy?'disabled':''}>${this.busy==='copy'?'招待リンクを作っています…':'リンクをコピー'}</button>${this.inviteURL?`<label class="invite-link">招待リンク<input aria-label="招待リンク" readonly value="${esc(this.inviteURL)}" onclick="this.select()"></label>`:''}<p class="invite-note">LINEやメッセージで送れます。リンクは7日間有効です。信頼する友達にだけ送ってください。</p></section>${this.notices()}<h2 class="flow-label">いっしょに撮っている人${members.length?'　'+members.length+'人':''}</h2>${this.membersError?`<p class="flow-error" role="alert">${esc(this.membersError)}</p>`:this.members?`<ul class="people-list" aria-label="いっしょに撮っている人">${rows}</ul>`:'<p class="flow-note" role="status">参加している人を読み込んでいます…</p>'}<div class="flow-foot"><button type="button" class="leave-link" data-friends-action="ask-leave" ${this.busy?'disabled':''}>このグループを抜ける</button><div class="account-line"><span>${demo()?'プレビュー（この端末だけ）':esc(profile?.name||'')+'（Google）でログイン中'}</span><button type="button" data-friends-action="signout" ${this.busy?'disabled':''}>ログアウト</button></div></div>`;
  }
  setup() {
    const profile=profileOf(),signedIn=!!profile?.confirmed,pending=!!pendingInvite(),canPaste=!!navigator.clipboard?.readText;
    const step1=signedIn?`<div class="setup-step is-done"><span class="step-number" aria-hidden="true">1</span><span class="step-text"><strong>ログイン済み</strong><small>${esc(profile.name)}（Google）</small></span>${CHECK}</div>`:`<div class="setup-step"><span class="step-number" aria-hidden="true">1</span><span class="step-text"><strong>Googleでログイン</strong><small>名前を出して写真を送るために使います。</small></span></div><button type="button" class="flow-primary" data-friends-action="login" ${this.busy?'disabled':''}>${this.busy==='login'?'ログインしています…':'Googleでログイン'}</button>`;
    const off=!signedIn||this.busy?'disabled':'';
    return `<p class="flow-lead">写真を見せ合うのは、招待リンクでつながった友達だけです。</p>${step1}<div class="setup-step is-plain"><span class="step-number" aria-hidden="true">2</span><span class="step-text"><strong>どちらかを選ぶ</strong>${signedIn?'':'<small>ログインのあとで選べます。</small>'}</span></div>${this.notices()}<section class="setup-card${signedIn?'':' is-locked'}" aria-label="招待リンクで参加する"><h2>招待リンクで参加する</h2>${pending?`<button type="button" class="flow-primary" data-friends-action="join-pending" ${off}>${this.busy==='join'?'参加しています…':'届いている招待で参加する'}</button>`:''}<label>友達から届いたリンク<input type="url" data-invite-input autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://…/#invite=…" value="${esc(this.inviteDraft)}" ${off}></label><div class="setup-row">${canPaste?`<button type="button" class="flow-outline" data-friends-action="paste" ${off}>貼り付け</button>`:''}<button type="button" class="flow-primary" data-friends-action="join" ${off}>${this.busy==='join'?'参加しています…':'このリンクで参加'}</button></div><p>リンクをそのまま開いても参加できます。ホーム画面のアプリでは、ここに貼り付けてください。</p></section><section class="setup-card${signedIn?'':' is-locked'}" aria-label="グループを作る"><h2>グループを作る</h2><p>最初の一人はこちら。作ったあと、招待リンクを友達に送ります。</p><button type="button" class="flow-outline" data-friends-action="create" ${off}>${this.busy==='create'?'グループを作っています…':'グループを作って招待する'}</button></section>${signedIn?`<div class="flow-foot"><div class="account-line"><span>${esc(profile.name)}（Google）でログイン中</span><button type="button" data-friends-action="signout" ${this.busy?'disabled':''}>ログアウト</button></div></div>`:''}`;
  }
  render() {
    const sheet=this.leaving?`<dialog class="leave-sheet" aria-label="グループを抜ける確認"><h2>このグループを<br>抜けますか？</h2><ul><li>グループの写真は見られなくなります。</li><li>あなたが送った写真は、グループに残ります。消したい写真は、先に「みんなの記録」から削除してください。</li><li>自分の端末の記録は残ります。</li><li>もう一度参加するには、新しい招待リンクが必要です。</li></ul><button type="button" class="leave-confirm" data-friends-action="leave">抜ける</button><button type="button" class="flow-primary" data-friends-action="cancel-leave" autofocus>やめる</button></dialog>`:'';
    this.innerHTML=`<section class="flow-page friends-page"><header class="flow-head">${BACK}<h1>友達</h1></header>${demo()?'<p class="flow-note">プレビューの見本です。招待・参加・退出は実際には行いません。</p>':''}${this.member()?this.joined():this.setup()}${sheet}</section>`;
    const dialog=this.querySelector('dialog.leave-sheet');
    if(dialog){dialog.addEventListener('cancel',event=>{event.preventDefault();this.leaving=false;this.render();});try{dialog.showModal();}catch{dialog.setAttribute('open','');}}
  }
}
customElements.define('basho-friends-screen',FriendsScreen);

class InvitedScreen extends HTMLElement {
  connectedCallback() {
    this.busy=false;this.error='';
    this.addEventListener('click',this.onClick=event=>this.handle(event));
    this.onChange=()=>{if(!this.busy)this.render();};
    window.addEventListener('basho-auth-changed',this.onChange);
    this.render();
    if(!demo())friendsSession().then(()=>{if(this.isConnected&&!this.busy)this.render();}).catch(()=>{});
  }
  disconnectedCallback(){window.removeEventListener('basho-auth-changed',this.onChange);}
  async handle(event) {
    const button=event.target.closest('[data-invited-action]');if(!button||this.busy)return;
    const action=button.dataset.invitedAction;
    if(action==='discard'){discardFriendsInvite();if(guideSeen())go('home');else go('guide','first');return;}
    if(action==='join'){
      this.busy=true;this.error='';this.render();
      try{
        if(!await ensureSharingProfile())return;
        await joinFriendsGroup();
        if(guideSeen())go('friends');else go('guide','first');return;
      }catch(error){this.error=friendlyError(error).message;}
      finally{this.busy=false;if(this.isConnected)this.render();}
    }
  }
  render() {
    if(!pendingInvite()){this.innerHTML='<section class="guide-page invited-page"><p class="guide-brand">芭蕉のまなざし</p><div class="guide-copy"><h1>招待は<br>見つかりません。</h1><p>招待リンクをもう一度開くか、「友達」の画面に貼り付けてください。</p></div><div class="guide-actions"><button type="button" class="flow-primary" data-nav="group">友達の画面を開く</button><button type="button" class="flow-outline" data-nav="home">撮影画面へ</button></div></section>';return;}
    const meta=pendingInviteMeta()||{},signedIn=!!profileOf()?.confirmed,switching=signedIn&&!!friendsGroup();
    const title=meta.from?`${esc(meta.from)}さんから<br>招待が<br>届いています。`:'招待が<br>届いています。';
    this.innerHTML=`<section class="guide-page invited-page"><p class="guide-brand">芭蕉のまなざし</p><div class="guide-copy"><h1>${title}</h1><p>毎日ひとつ届く芭蕉の句をお題に、1日1枚の写真を撮って見せ合うアプリです。</p></div><div class="invited-group">${meta.from?`<span class="avatar-stack" aria-hidden="true">${face({name:meta.from},1)}</span>`:''}<span><strong>${meta.from?esc(meta.from)+'さんのグループ':'友達のグループ'}</strong>${meta.count?`<small>${meta.count}人が参加しています</small>`:''}</span></div><ul class="guide-points"><li>写真が見えるのは、このグループの人だけです。</li><li>参加には、Googleでのログインが必要です。</li>${meta.expiresAt?`<li>この招待は ${esc(dateText(meta.expiresAt))} まで有効です。</li>`:'<li>招待リンクは、作ってから7日間有効です。</li>'}${switching?'<li>いま参加しているグループから、このグループに切り替わります。</li>':''}</ul>${this.error?`<p class="flow-error" role="alert">${esc(this.error)}</p>`:''}<div class="guide-actions"><button type="button" class="flow-primary" data-invited-action="join" ${this.busy?'disabled':''}>${this.busy?'参加しています…':signedIn?'このグループに参加する':'Googleでログインして参加'}</button><button type="button" class="flow-outline" data-nav="guide" ${this.busy?'disabled':''}>先に使い方を見る</button><p class="guide-small">参加したあと、使い方の案内（はじめての5枚）に進みます。</p><button type="button" class="flow-text" data-invited-action="discard" ${this.busy?'disabled':''}>この招待を使わない</button></div></section>`;
  }
}
customElements.define('basho-invited',InvitedScreen);

// はじめての5枚: shown once on first launch, and again from the ？ button as help.
// mode: "first" ends on the camera, "help" returns to みんなの記録, "invite" returns to the invitation.
class Onboarding extends HTMLElement {
  connectedCallback() {
    this.step=1;this.mode=['help','invite'].includes(this.getAttribute('mode'))?this.getAttribute('mode'):'first';
    this.addEventListener('click',this.onClick=event=>{
      const button=event.target.closest('[data-guide]');if(!button)return;
      const action=button.dataset.guide;
      if(action==='next'){this.step=Math.min(5,this.step+1);this.render();return;}
      if(action==='step'){this.step=Number(button.dataset.step)||1;this.render();return;}
      markGuideSeen();go(action);
    });
    this.render();
  }
  frame() {
    const topic=dailyTopic(japanDay()),lines=(topic.lines||[topic.original]).map(esc).join('<br>');
    return {lines,modern:esc(topic.modern||''),date:Number(japanDay().slice(5,7))+'.'+japanDay().slice(8)};
  }
  render() {
    const {lines,modern,date}=this.frame(),home=this.mode==='help'?'friends':this.mode==='invite'?'invited':'home';
    const connected=demo()||(!!profileOf()?.confirmed&&!!friendsGroup());
    const next='<button type="button" class="flow-primary" data-guide="next">つぎへ</button>';
    const steps={
      1:{title:'毎日ひとつ、<br>芭蕉の句が<br>届く。',lead:'その日の句と、いまの言葉での読みが、今日のお題です。句を手がかりに、いつもの景色を見てみよう。',
        body:`<div class="guide-frame" aria-hidden="true"><i class="guide-ground"></i><i class="guide-sun"></i><b class="guide-verse">${lines}</b><span class="guide-modern">${modern}</span><b class="guide-date">${date}</b></div><p class="guide-small">句は季節に合わせて毎日変わります。同じ日は、みんな同じ句です。</p>`,actions:next},
      2:{title:'枠ごしに、<br>1日1枚。',lead:'アプリを開くとカメラが起動します。句と日付の入った枠の中に、今日の一枚を。撮り直しは送る前までです。',
        body:`<div class="guide-frame is-camera" aria-hidden="true"><i class="guide-ground"></i><i class="guide-block one"></i><i class="guide-block two"></i><b class="guide-verse">${lines}</b><b class="guide-date">${date}</b><i class="guide-shutter"></i><i class="guide-records"></i></div><ul class="guide-points"><li>句をタップすると、撮影のヒントが出ます。</li><li>撮れるのは1日1枚。送ったら、その日はおしまい。</li></ul>`,actions:next},
      3:{title:'送ると、<br>みんなの<br>今日が見える。',lead:'ひとことを添えて送信。同じ日に友達が撮った写真が「みんなの記録」に並びます。',
        body:`<div class="guide-send" aria-hidden="true"><div class="guide-frame is-mine"><i class="guide-ground"></i><b class="guide-verse">${lines}</b><span class="guide-caption">帰り道の電線</span></div><i class="guide-arrow"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg></i><div class="guide-others"><div class="guide-frame is-other one"><span class="guide-caption">みほ</span></div><div class="guide-frame is-other two"><span class="guide-caption">ななみ</span></div></div></div><ul class="guide-points"><li>写真にはスタンプとひとことを返せます。</li><li>過去の日は、カレンダーから見返せます。</li><li>送ったあとの撮影画面は、その日の記録になります。</li></ul>`,actions:next},
      4:{title:'友達と<br>つながる。',lead:'写真を見せ合うのは、招待リンクでつながった友達だけです。知らない人には見えません。',
        body:`<ol class="guide-steps"><li><span class="step-number" aria-hidden="true">1</span><span><strong>Googleでログイン</strong><small>名前を出して写真を送るために使います。</small></span></li><li><span class="step-number" aria-hidden="true">2</span><span><strong>リンクで参加、またはグループを作る</strong><small>届いた招待リンクを開くか貼り付けます。最初の一人はグループを作ってリンクを送ります。</small></span></li></ol><p class="guide-small">${connected?'もう友達とつながっています。招待は「みんなの記録」の上にある友達の列から送れます。':'あとからでも、「みんなの記録」の上にある友達の列から設定できます。'}</p>`,
        actions:connected||this.mode==='invite'?next:`<button type="button" class="flow-primary" data-guide="group">友達とつながる</button><button type="button" class="flow-outline" data-guide="next">あとで</button>`},
      5:{title:'朝と夜に、<br>お知らせ。',lead:'一日のはじまりと終わりに、通知が届きます。',
        body:`<div class="guide-times"><div><b>8:00</b><span><strong>今日のお題</strong><small>新しい句が届いたお知らせ。</small></span></div><div><b>23:50</b><span><strong>今日の一枚、まだなら</strong><small>日付が変わる前のひと声。友達の写真も見返せます。</small></span></div></div><p class="guide-callout"><strong>iPhone・iPadの場合</strong><br>Safariの共有メニューから「ホーム画面に追加」して、そのアイコンから開くと通知を受け取れます。</p>`,
        actions:this.mode==='invite'?'<button type="button" class="flow-primary" data-guide="invited">招待にもどる</button>':`<button type="button" class="flow-primary" data-guide="notify">通知を設定する</button><button type="button" class="flow-outline" data-guide="${home}">${this.mode==='help'?'とじる':'あとで設定して、はじめる'}</button>`},
    };
    const current=steps[this.step];
    this.innerHTML=`<section class="guide-page" aria-label="使い方 ${this.step} / 5"><header class="guide-top"><span class="guide-count">${this.step} / 5</span><button type="button" class="guide-skip" data-guide="${home}">${this.mode==='help'?'とじる':this.mode==='invite'?'招待にもどる':'スキップ'}</button></header><div class="guide-copy"><h1>${current.title}</h1><p>${current.lead}</p></div>${current.body}<div class="guide-actions"><div class="guide-progress">${[1,2,3,4,5].map(n=>`<button type="button" class="${n<=this.step?'is-on':''}" data-guide="step" data-step="${n}" aria-label="${n}枚目へ" ${n===this.step?'aria-current="step"':''}></button>`).join('')}</div>${current.actions}</div></section>`;
    this.closest('.view')?.scrollTo?.({top:0});
  }
}
customElements.define('basho-onboarding',Onboarding);
