import { monthCells, shiftMonth, validDay } from './reading-store.js';
import { calendarPosts } from './sharing-calendar.js?v=76';
import { friendsSession, friendsGroup, pendingInvite, stageFriendsInvite, createFriendsGroup, createFriendsInvite, joinFriendsGroup, friendsSignOut, friendlyError } from './firebase-friends.js?v=78';
import { postcardMarkup, escapeText as esc } from './photo-postcard.js';
import { REACTIONS } from './friend-reactions.js';
import { dailyTopic } from './haiku-catalog.js';
import { japanDay } from './reading-store.js';
import { loadCards } from './haiku-store.js';
import { sharingAPI, sharingProfile, ensureSharingProfile, publishCard } from './sharing-client.js?v=78';
class PublicFeed extends HTMLElement {
  connectedCallback() {
    this.calendar=this.hasAttribute('calendar');this.day=validDay(this.getAttribute('day'))?this.getAttribute('day'):japanDay();this.month=this.day.slice(0,7);this.localCards=[];this.posts=[];this.selected=null;this.details=null;this.error='';this.status='';this.loading=false;this.busy=false;this.draft='';this.revision=0;
    this.membersOpen=false;this.members=null;this.membersError='';this.membersLoading=false;this.membersRequest=(this.membersRequest||0)+1;
    this.addEventListener('click',this.click=e=>this.handle(e));
    this.addEventListener('input',this.input=e=>{if(e.target.matches('[data-public-comment]')){this.draft=e.target.value;this.commentId=null;}if(e.target.matches('[data-invite-input]'))this.inviteDraft=e.target.value;});
    this.addEventListener('submit',this.submit=e=>{if(e.target.matches('[data-public-form]')){e.preventDefault();this.mutate('comment',{commentId:this.commentId || (this.commentId=crypto.randomUUID().replaceAll('-','')),text:this.draft},'ひとことを送りました。');}});
    this.refresh=()=>{if(!document.hidden && !this.busy && !this.loading){if(!this.calendar && japanDay()!==this.day){this.selected=null;this.details=null;this.draft='';this.load();}else if(this.selected){if(!this.querySelector('[data-public-comment]:focus'))this.loadDetail(true);}else this.load();}};
    window.addEventListener('focus',this.refresh);window.addEventListener('basho-reading-updated',this.refresh);window.addEventListener('basho-sharing-updated',this.refresh);
    this.timer=setInterval(this.refresh,30000);this.load();
    if(!window.BASHO_SHARING_DEMO) friendsSession().then(()=>this.load()).catch(()=>{});
    this.authReset=()=>{++this.revision;++this.membersRequest;this.membersOpen=false;this.members=null;this.membersError='';this.membersLoading=false;this.loading=false;this.busy=false;this.posts=[];this.selected=null;this.details=null;this.inviteURL='';this.local=null;this.cursor=null;this.render();};
    window.addEventListener('basho-auth-changed',this.authReset);
  }
  disconnectedCallback(){window.removeEventListener('basho-auth-changed',this.authReset);this.revision++;this.membersRequest++;clearInterval(this.timer);window.removeEventListener('focus',this.refresh);window.removeEventListener('basho-reading-updated',this.refresh);window.removeEventListener('basho-sharing-updated',this.refresh);}
  async load(more=false) {
    if(this.membersOpen&&!this.membersLoading)this.loadMembers();
    const revision=++this.revision;this.loading=true;this.error='';this.render();
    try {
      try{const cards=await loadCards();if(revision!==this.revision || !this.isConnected)return;this.localCards=cards;this.localError='';}
      catch{this.localError='この端末の写真を読み込めませんでした。保存設定を確認して、更新してください。';}
      if(revision!==this.revision || !this.isConnected)return;
      this.local=this.localCards.find(card=>card.day===this.day&&['photo-challenge','photo-ai'].includes(card.creation))||null;
      this.render();
      const result=await sharingAPI(this.calendar?'calendar':'feed',{month:this.month,cursor:more?this.cursor:null});
      if(revision!==this.revision || !this.isConnected)return;
      if(!this.calendar && this.day!==result.day){this.selected=null;this.details=null;this.draft='';more=false;}
      if(!this.calendar)this.day=result.day;this.posts=more?[...this.posts,...result.posts.filter(post=>!this.posts.some(item=>item.id===post.id))]:result.posts;this.cursor=result.nextCursor;
      this.local=this.localCards.find(card=>card.day===this.day&&['photo-challenge','photo-ai'].includes(card.creation))||null;
    }catch(error){if(revision===this.revision){this.error=error.message;this.posts=[];this.selected=null;this.details=null;this.cursor=null;}}
    finally{if(revision===this.revision&&this.isConnected){this.loading=false;this.render();}}
  }
  async loadMembers() {
    const request=++this.membersRequest,group=friendsGroup(),uid=sharingProfile()?.id;
    this.membersLoading=true;this.membersError='';this.members=null;this.render();
    try{
      const result=await sharingAPI('members');
      if(request===this.membersRequest && this.isConnected && group===friendsGroup() && uid===sharingProfile()?.id)this.members=result.members;
    }catch(error){if(request===this.membersRequest)this.membersError=friendlyError(error).message;}
    finally{if(request===this.membersRequest&&this.isConnected){this.membersLoading=false;this.render();}}
  }
  membersPanel() {
    if(!this.membersOpen)return '';
    const joined=timestamp=>timestamp?new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'long',day:'numeric'}).format(timestamp)+' 参加':'参加日不明';
    return `<section class="friends-members" aria-label="参加中の友達" aria-busy="${this.membersLoading}"><h2>参加中の友達${this.members?'（'+this.members.length+'人）':''}</h2><p>このグループに参加している人だけが、共有した写真やひとことを見られます。</p>${this.membersLoading?'<p role="status">参加者を読み込んでいます…</p>':this.membersError?`<p role="alert">${esc(this.membersError)}</p><button class="outline-button" data-public-action="members-refresh">もう一度読み込む</button>`:`<ul>${(this.members||[]).map(member=>`<li><strong>${esc(member.name)}${member.own?' · あなた':''}</strong><small>${esc(joined(member.joinedAt))}</small></li>`).join('')}</ul>${this.members?.length?'':'<p>参加者が見つかりませんでした。</p>'}<button class="outline-button" data-public-action="members-refresh">参加者を更新</button>`}</section>`;
  }
  async handle(event) {
    const button=event.target.closest('[data-public-action]');if(!button || this.busy)return;
    let action=button.dataset.publicAction;
    if(action==='join-pasted'){
      try{stageFriendsInvite(this.inviteDraft||this.querySelector('[data-invite-input]')?.value||'');action='join';}
      catch(error){this.error=error.message;this.render();return;}
    }
    if(action==='members'){
      this.membersOpen=!this.membersOpen;
      if(this.membersOpen)return this.loadMembers();
      ++this.membersRequest;this.membersLoading=false;this.members=null;this.membersError='';this.render();return;
    }
    if(action==='members-refresh')return this.loadMembers();
    if(action==='calendar-day'){
      this.day=button.dataset.day;this.selected=null;this.details=null;this.draft='';this.status='';
      this.local=this.localCards.find(card=>card.day===this.day&&['photo-challenge','photo-ai'].includes(card.creation))||null;this.dispatchEvent(new CustomEvent('basho-calendar-day-changed',{bubbles:true,detail:this.day}));this.render();this.closest('.view')?.scrollTo?.({top:0});return;
    }
    if(action==='notifications'){
      // The settings live below this feed in the same screen; open them and bring them into view.
      const settings=this.closest('.view')?.querySelector('details.place-attach');
      if(settings){settings.open=true;settings.scrollIntoView({block:'start',behavior:'smooth'});settings.querySelector('summary')?.focus({preventScroll:true});}
      else{this.status=window.BASHO_PHOTO_PREVIEW?'プレビューでは通知の設定は使えません。':'通知の設定を開けませんでした。';this.render();}
      return;
    }
    if(action==='jump-calendar'){this.querySelector('.shared-calendar')?.scrollIntoView({block:'start',behavior:'smooth'});return;}
    if(action==='calendar-month'||action==='calendar-today'){
      this.month=action==='calendar-today'?japanDay().slice(0,7):shiftMonth(this.month,Number(button.dataset.delta));
      this.day=action==='calendar-today'?japanDay():this.month+'-01';this.selected=null;this.details=null;this.posts=[];this.status='';this.dispatchEvent(new CustomEvent('basho-calendar-day-changed',{bubbles:true,detail:this.day}));return this.load();
    }
    if(action==='copy-invite'){
      try{await navigator.clipboard.writeText(this.inviteURL);this.status='招待リンクをコピーしました。友達に貼り付けて送ってください。';}
      catch{this.querySelector('[aria-label="招待リンク"]')?.select();this.status='リンクを選択しました。長押しまたはCtrl+Cでコピーしてください。';return;}
      this.render();return;
    }
    if(['create-group','invite','join','signout'].includes(action)){
      this.busy=true;this.accessAction=action;this.error='';this.render();
      try{
        if(action==='signout'){await friendsSignOut();this.posts=[];this.details=null;this.selected=null;this.inviteURL='';this.local=null;}
        else if(await ensureSharingProfile()){
          if(action==='create-group'){await createFriendsGroup();this.inviteURL=await createFriendsInvite();this.status='グループと招待リンクを作成しました。リンクを友達に送ってください。';}
          if(action==='join'){const result=await joinFriendsGroup();this.inviteDraft='';this.status=result?.synced===false?'このアプリで友達に参加できました。他の端末でも参加する場合は、同じ招待リンクをアプリ内に貼り付けてください。':'友達とつながりました。友達の写真は「みんなの記録」で見られます。';}
          if(action==='invite'){this.inviteURL=await createFriendsInvite();this.status='招待リンクを作成しました。有効期限は約7日間です。';this.render();}
        }
      }catch(error){this.error=friendlyError(error).message;}
      finally{this.busy=false;this.accessAction=null;const failure=this.error;await this.load();if(failure){this.error=failure;this.render();}}return;
    }
    if(action==='refresh')return this.load();if(action==='more')return this.load(true);
    if(action==='profile'){try{if(await ensureSharingProfile())await this.load();}catch(error){this.error=error.message;this.render();}return;}
    if(action==='publish-local') {
      if(button.dataset.card&&!confirm(`${this.day}の写真とひとことを、参加している友達に共有しますか？`))return;
      this.busy=true;this.error='';this.render();
      const card=button.dataset.card?this.localCards.find(card=>card.id===button.dataset.card):this.local;
      if(!card){this.busy=false;return;}
      try{const result=await publishCard(card);if(result)this.status='参加している友達に写真を共有しました。';}catch(error){this.error=error.message;}
      finally{this.busy=false;const failure=this.error;await this.load();if(failure){this.error=failure;this.render();}}return;
    }
    if(action==='open'){this.selected=button.dataset.photo;this.details=null;this.draft='';this.commentId=null;await this.loadDetail();return;}
    if(action==='close'){this.selected=null;this.details=null;this.render();return;}
    if(action==='stamp')return this.mutate('stamp',{stamp:button.dataset.stamp,active:!this.details?.mine.includes(button.dataset.stamp)},'リアクションを送りました。');
    if(action==='delete-comment')return this.mutate('delete-comment',{commentId:button.dataset.comment},'ひとことを削除しました。');
    if(action==='delete-photo') {
      if(!confirm('この写真を友達の投稿から削除しますか？端末のカレンダーには残ります。'))return;
      this.selected=button.dataset.photo;await this.mutate('delete',{},'公開した写真を削除しました。');return;
    }
    if(action==='report')return this.mutate('report',{},'通報を受け付けました。運営による確認待ちです。');
  }
  updateCounts() {
    const post=this.posts.find(post=>post.id===this.selected);
    if(post && this.details){post.stampCount=this.details.stamps.reduce((sum,item)=>sum+item.count,0);post.commentCount=this.details.comments.length;}
  }
  async loadDetail(quiet=false) {
    const id=this.selected;this.busy=true;this.error='';if(!quiet)this.render();
    try{const detail=await sharingAPI('detail',{photoId:id});if(this.isConnected && id===this.selected){this.details=detail;this.updateCounts();}}catch(error){this.error=error.message;}
    finally{this.busy=false;if(this.isConnected){this.render();if(!quiet)this.querySelector('.friend-detail')?.scrollIntoView({block:'start',behavior:'smooth'});}}
  }
  async mutate(action,data,message) {
    this.busy=true;this.error='';this.render();
    try{
      if(!await ensureSharingProfile())return;
      await sharingAPI(action,{photoId:this.selected,...data});this.status=message;
      if(action==='comment'){this.draft='';this.commentId=null;}
      if(action==='delete'){this.selected=null;this.details=null;await this.load();}
      else {this.details=await sharingAPI('detail',{photoId:this.selected});this.updateCounts();}
    }catch(error){this.error=error.message;}
    finally{this.busy=false;if(this.isConnected)this.render();}
  }
  detail(post) {
    const detail=this.details;if(!detail)return '<p class="reading-help">リアクションを読み込んでいます…</p>';
    const received=detail.stamps.filter(item=>item.count>0);
    return `<section class="friend-detail"><header><h3>${esc(post.name)}の写真</h3><button class="friend-close" data-public-action="close" aria-label="閉じる">×</button></header><h3>どんなふうに感じた？</h3><div class="friend-stamps">${REACTIONS.map(stamp=>`<button data-public-action="stamp" data-stamp="${stamp.id}" aria-pressed="${detail.mine.includes(stamp.id)}" ${this.busy?'disabled':''}><span>${stamp.emoji}</span><small>${stamp.label}</small><b>${detail.stamps.find(item=>item.stamp===stamp.id)?.count||0}</b></button>`).join('')}</div><section class="friend-reactors" aria-label="リアクションしてくれた友達"><h3>リアクションしてくれた友達</h3>${received.length?`<ul>${received.map(item=>{const stamp=REACTIONS.find(stamp=>stamp.id===item.stamp);return `<li><strong>${esc(stamp?.emoji||'')} ${esc(stamp?.label||'リアクション')}（${item.count}）</strong><p>${item.members?.length?item.members.map(member=>esc(member.name)+(member.own?' · あなた':'')).join('、'):'名前を取得できませんでした。更新してお試しください。'}</p></li>`;}).join('')}</ul>`:'<p class="reading-help">まだリアクションはありません。</p>'}</section><h3>ひとことをくれた友達</h3><form data-public-form><label>ひとこと<textarea data-public-comment maxlength="120" rows="2" required>${esc(this.draft)}</textarea></label><button class="main-button" ${this.busy?'disabled':''}>ひとことを送る</button></form><ul class="friend-comments" aria-label="ひとことをくれた友達">${detail.comments.map(comment=>`<li><strong>${esc(comment.name)}${comment.own?' · あなた':''}</strong><p>${esc(comment.text)}</p>${comment.own?`<button data-public-action="delete-comment" data-comment="${comment.id}">削除</button>`:''}</li>`).join('')}</ul>${window.BASHO_SHARING_DEMO&&!post.own?'<button class="outline-button" data-public-action="report">この投稿を通報する</button>':''}</section>`;
  }
  localPost(post) {
    const card=this.localCards.find(card=>'local:'+card.id===post.id);
    return `<article class="feed-post friend-own-photo local-calendar-photo"><header class="feed-post-author"><span>自</span><strong>自分 · あなた</strong><small>端末に保存</small></header>${postcardMarkup({...post,createdAt:null})}<p class="reading-help">この写真は投稿待ちです。通信・ログイン状態を確認して再試行してください。</p>${['photo-challenge','photo-ai'].includes(card?.creation)?`<button class="outline-button" data-public-action="publish-local" data-card="${esc(card.id)}" ${this.busy?'disabled':''}>投稿を再試行する</button>`:''}</article>`;
  }
  render() {
    let profile=null;try{profile=sharingProfile();}catch(error){this.error=error.message;}
    const demo=window.BASHO_SHARING_DEMO;
    const controls=demo?'':`<div class="friends-access">${profile?.confirmed?`<button class="outline-button" data-public-action="signout">ログアウト</button>${pendingInvite()?'<p>招待されたグループに参加します。参加すると、「みんなの記録」で友達の写真を見られます。</p><button class="main-button" data-public-action="join">この招待で参加する</button>':friendsGroup()?`<button class="outline-button" data-public-action="invite" ${this.busy?'disabled':''}>${this.accessAction==='invite'?'招待リンクを作成中…':'友達の招待リンクを作る'}</button>`:'<details class="friends-create-group"><summary>最初にグループを作る方はこちら</summary><button class="outline-button" data-public-action="create-group">友達のグループを作る</button></details>'}`:'<p>Googleでログイン後、招待リンクから参加してください。最初の一人はグループを作成できます。</p>'}${this.inviteURL?`<label>招待リンク（約7日間有効）<input aria-label="招待リンク" readonly value="${esc(this.inviteURL)}" onclick="this.select()"></label><button type="button" class="main-button" data-public-action="copy-invite">リンクをコピー</button><p>このリンクを渡した人が参加できます。信頼する友達にだけ送ってください。</p>`:''}</div>`;
    const joinForm=!demo&&(!friendsGroup()||pendingInvite())?`<section class="friends-join" aria-label="友達の招待で参加"><h2>招待リンクを貼り付けて参加</h2><p>ホーム画面のアプリでは、友達から届いたリンクをここに貼り付けてください。Safariで参加済みの場合は、同じGoogleアカウントを使ってください。</p><label>友達の招待リンク<input type="url" data-invite-input autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://…/#invite=…" value="${esc(this.inviteDraft||'')}" ${this.busy?'disabled':''}></label><button type="button" class="main-button" data-public-action="join-pasted" ${this.busy?'disabled':''}>${this.accessAction==='join'?'参加しています…':'このリンクで参加する'}</button></section>`:'';
    const allPosts=this.calendar?calendarPosts(this.localCards,this.posts):this.posts;
    const today=japanDay();
    const shown=this.calendar?allPosts.filter(post=>post.day===this.day):this.posts;
    const monthView=this.calendar?`<section class="reading-calendar shared-calendar"><div class="reading-month"><button data-public-action="calendar-month" data-delta="-1" aria-label="前の月" ${this.loading||this.busy?'disabled':''}>←</button><h2>${this.month.replace('-','年 ')}月</h2><button data-public-action="calendar-month" data-delta="1" aria-label="次の月" ${this.loading||this.busy?'disabled':''}>→</button></div><button class="outline-button" data-public-action="calendar-today">今日へ</button><div class="reading-week" aria-hidden="true">${'日月火水木金土'.split('').map(d=>`<span>${d}</span>`).join('')}</div><div class="reading-days">${monthCells(this.month).map(day=>{
      if(!day)return '<span></span>';
      const photos=allPosts.filter(p=>p.day===day),photo=photos[0];
      return `<button class="${photo?'has-photo':''} ${day===this.day?'selected':''} ${day===today?'is-today':''}" data-public-action="calendar-day" data-day="${day}" aria-pressed="${day===this.day}" aria-label="${day}、写真${photos.length}枚">${photo?`<img class="calendar-day-photo" src="${esc(photo.image)}" alt="">`:''}<span class="calendar-day-number">${Number(day.slice(8))}</span><small class="shared-day-count">${photos.length?photos.length+'枚':'·'}</small></button>`;
    }).join('')}</div>${this.cursor?'<p class="reading-help">この月の投稿には続きがあります。下の「もっと見る」で追加してください。</p>':''}</section>`:'';
    const dateHeading=this.calendar?`<h2 class="shared-selected-date"><span>${esc(this.day.replaceAll('-',' / '))} · ${shown.length}枚</span><button type="button" data-public-action="jump-calendar">日付を選ぶ</button></h2>`:'';
    // みんなの記録: the chosen day's photographs first, then the month to pick another day, then account and invitations.
    // The heading carries two icon buttons: refresh, and (on みんなの記録) a bell that opens the notification settings below.
    const heading=`<header class="feed-heading"><small class="friends-release" aria-label="共有機能のバージョン">共有 v82</small><h1>みんなの記録</h1><button type="button" class="feed-icon-button" data-public-action="refresh" aria-label="更新" ${this.loading?'disabled':''}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 11a8 8 0 0 0-14.3-4.3L4 8.5"/><path d="M4 4v4.5h4.5"/><path d="M4 13a8 8 0 0 0 14.3 4.3L20 15.5"/><path d="M20 20v-4.5h-4.5"/></svg></button>${this.calendar?`<button type="button" class="feed-icon-button" data-public-action="notifications" aria-label="通知の設定"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 9.5a6 6 0 0 1 12 0c0 4.5 1.6 6 2 6.5H4c.4-.5 2-2 2-6.5z"/><path d="M10 19.5a2.2 2.2 0 0 0 4 0"/></svg></button>`:''}</header>`;
    const calendarHelp=this.calendar?'<p class="reading-help">日付を選ぶと、その日の自分と友達の写真を見られます。</p>':'';
    const prompt=`<article class="friends-prompt"><p>${esc(dailyTopic(this.day).original)}</p></article>`;
    const audience=`<p class="public-audience">${demo?'共有画面の体験用です。サンプル投稿を表示し、操作はこの端末内だけに保存します。':'Googleでログインし、招待リンクから参加した友達だけに共有されます。'}</p>`;
    const identity=`${profile?.confirmed?`<p class="public-identity">投稿者：${esc(profile.name)}</p>`:`<button class="outline-button" data-public-action="profile">${demo?'表示名を登録して参加する':'Googleでログインする'}</button>`}`;
    const members=`${!demo&&profile?.confirmed&&friendsGroup()?`<button class="outline-button" data-public-action="members" aria-expanded="${this.membersOpen}">${this.membersOpen?'参加中の友達を閉じる':'参加中の友達を見る'}</button>${this.membersPanel()}`:''}`;
    const notices=`<p class="friend-status" role="status">${esc(this.status)}</p>${this.localError?`<p class="reading-error" role="alert">${esc(this.localError)}</p>`:''}${this.error?`<p class="reading-error" role="alert">${esc(this.error)}</p>`:''}${this.loading?'<p class="reading-help">投稿を読み込んでいます…</p>':''}${!this.loading&&!this.error&&!shown.length?`<p class="public-empty">${this.calendar?'この日の投稿はまだありません。':'今日の投稿はまだありません。最初の一枚を撮ってみよう。'}</p>`:''}`;
    const posts=`<div class="friend-photo-grid">${shown.map(post=>post.localOnly?this.localPost(post):`<article class="feed-post ${post.own?'friend-own-photo':''}"><header class="feed-post-author"><span>${esc(Array.from(post.name)[0])}</span><strong>${esc(post.name)}${post.own?' · あなた':''}</strong><small>${new Date(post.createdAt+9*3600000).toISOString().slice(11,16)}</small>${post.own?`<button data-public-action="delete-photo" data-photo="${post.id}">削除</button>`:''}</header><button class="friend-photo-tile" data-public-action="open" data-photo="${post.id}" aria-label="${esc(post.name)}の写真へのリアクションを開く">${postcardMarkup(this.calendar?{...post,createdAt:null}:post,{captionClass:post.own?'friend-own-caption':''})}</button><button class="public-reaction-count" data-public-action="open" data-photo="${post.id}">リアクション ${post.stampCount} · ひとこと ${post.commentCount} · 名前を見る</button>${this.selected===post.id?this.detail(post):''}</article>`).join('')}</div>${this.cursor?`<button class="outline-button" data-public-action="more" ${this.loading?'disabled':''}>もっと見る</button>`:''}`;
    const retention=`<small class="public-retention">${demo?'プレビューでは実際のサーバーへの公開・送信は行いません。':'共有した写真は削除するまでグループに残ります。端末に保存した写真はカレンダーに残ります。'}</small>`;
    this.innerHTML=`<section class="friends-feature public-feed">${heading}${this.calendar?`${dateHeading}${notices}${posts}${monthView}${calendarHelp}<div class="calendar-account">${audience}${identity}${controls}${joinForm}${members}</div>`:`${prompt}${audience}${identity}${controls}${joinForm}${members}${notices}${posts}`}${retention}</section>`;
  }
}
customElements.define('basho-public-feed',PublicFeed);
