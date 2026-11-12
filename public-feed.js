import { postcardMarkup, escapeText as esc } from './photo-postcard.js';
import { REACTIONS } from './friend-reactions.js';
import { dailyTopic } from './haiku-catalog.js';
import { japanDay } from './reading-store.js';
import { loadCards } from './haiku-store.js';
import { sharingAPI, sharingProfile, ensureSharingProfile, publishCard } from './sharing-client.js';
class PublicFeed extends HTMLElement {
  connectedCallback() {
    this.posts=[];this.day=japanDay();this.selected=null;this.details=null;this.error='';this.status='';this.loading=false;this.busy=false;this.draft='';this.revision=0;
    this.addEventListener('click',this.click=e=>this.handle(e));
    this.addEventListener('input',this.input=e=>{if(e.target.matches('[data-public-comment]')){this.draft=e.target.value;this.commentId=null;}});
    this.addEventListener('submit',this.submit=e=>{if(e.target.matches('[data-public-form]')){e.preventDefault();this.mutate('comment',{commentId:this.commentId || (this.commentId=crypto.randomUUID().replaceAll('-','')),text:this.draft},'ひとことを送りました。');}});
    this.refresh=()=>{if(!document.hidden && !this.busy && !this.loading){if(japanDay()!==this.day){this.selected=null;this.details=null;this.draft='';this.load();}else if(this.selected){if(!this.querySelector('[data-public-comment]:focus'))this.loadDetail(true);}else this.load();}};
    window.addEventListener('focus',this.refresh);window.addEventListener('basho-reading-updated',this.refresh);window.addEventListener('basho-sharing-updated',this.refresh);
    this.timer=setInterval(this.refresh,30000);this.load();
  }
  disconnectedCallback(){this.revision++;clearInterval(this.timer);window.removeEventListener('focus',this.refresh);window.removeEventListener('basho-reading-updated',this.refresh);window.removeEventListener('basho-sharing-updated',this.refresh);}
  async load(more=false) {
    const revision=++this.revision;this.loading=true;this.error='';this.render();
    try {
      const result=await sharingAPI('feed',{cursor:more?this.cursor:null});
      if(revision!==this.revision || !this.isConnected)return;
      if(this.day!==result.day){this.selected=null;this.details=null;this.draft='';more=false;}
      this.day=result.day;this.posts=more?[...this.posts,...result.posts.filter(post=>!this.posts.some(item=>item.id===post.id))]:result.posts;this.cursor=result.nextCursor;
      this.local=(await loadCards()).find(card=>card.day===this.day&&card.creation==='photo-challenge')||null;
    }catch(error){if(revision===this.revision)this.error=error.message;}
    finally{if(revision===this.revision&&this.isConnected){this.loading=false;this.render();}}
  }
  async handle(event) {
    const button=event.target.closest('[data-public-action]');if(!button || this.busy)return;
    const action=button.dataset.publicAction;
    if(action==='refresh')return this.load();if(action==='more')return this.load(true);
    if(action==='profile'){try{if(await ensureSharingProfile())await this.load();}catch(error){this.error=error.message;this.render();}return;}
    if(action==='publish-local') {
      this.busy=true;this.error='';this.render();
      try{const result=await publishCard(this.local);if(result)this.status='写真を全員に公開しました。';}catch(error){this.error=error.message;}
      finally{this.busy=false;const failure=this.error;await this.load();if(failure){this.error=failure;this.render();}}return;
    }
    if(action==='open'){this.selected=button.dataset.photo;this.details=null;this.draft='';this.commentId=null;await this.loadDetail();return;}
    if(action==='close'){this.selected=null;this.details=null;this.render();return;}
    if(action==='phrase'){this.draft=button.dataset.text;this.commentId=null;this.querySelector('[data-public-comment]').value=this.draft;return;}
    if(action==='stamp')return this.mutate('stamp',{stamp:button.dataset.stamp,active:!this.details?.mine.includes(button.dataset.stamp)},'リアクションを送りました。');
    if(action==='delete-comment')return this.mutate('delete-comment',{commentId:button.dataset.comment},'ひとことを削除しました。');
    if(action==='delete-photo') {
      if(!confirm('この写真を全員の投稿から削除しますか？端末のカレンダーには残ります。'))return;
      this.selected=button.dataset.photo;await this.mutate('delete',{},'公開した写真を削除しました。');return;
    }
    if(action==='report')return this.mutate('report',{},'通報を受け付けました。運営による確認待ちです。');
  }
  async loadDetail(quiet=false) {
    const id=this.selected;this.busy=true;this.error='';if(!quiet)this.render();
    try{const detail=await sharingAPI('detail',{photoId:id});if(this.isConnected && id===this.selected)this.details=detail;}catch(error){this.error=error.message;}
    finally{this.busy=false;if(this.isConnected){this.render();if(!quiet)this.querySelector('.friend-detail')?.scrollIntoView({block:'start',behavior:'smooth'});}}
  }
  async mutate(action,data,message) {
    this.busy=true;this.error='';this.render();
    try{
      if(!await ensureSharingProfile())return;
      await sharingAPI(action,{photoId:this.selected,...data});this.status=message;
      if(action==='comment'){this.draft='';this.commentId=null;}
      if(action==='delete'){this.selected=null;this.details=null;await this.load();}
      else this.details=await sharingAPI('detail',{photoId:this.selected});
    }catch(error){this.error=error.message;}
    finally{this.busy=false;if(this.isConnected)this.render();}
  }
  detail(post) {
    const detail=this.details;if(!detail)return '<p class="reading-help">リアクションを読み込んでいます…</p>';
    return `<section class="friend-detail"><header><h3>${esc(post.name)}の写真</h3><button class="friend-close" data-public-action="close" aria-label="閉じる">×</button></header><h3>どんなふうに感じた？</h3><div class="friend-stamps">${REACTIONS.map(stamp=>`<button data-public-action="stamp" data-stamp="${stamp.id}" aria-pressed="${detail.mine.includes(stamp.id)}" ${this.busy?'disabled':''}><span>${stamp.emoji}</span><small>${stamp.label}</small><b>${detail.stamps.find(item=>item.stamp===stamp.id)?.count||0}</b></button>`).join('')}</div><div class="friend-phrases">${['その見方すき','同じの見つけた','なるほど！'].map(text=>`<button data-public-action="phrase" data-text="${text}">${text}</button>`).join('')}</div><form data-public-form><label>ひとこと<textarea data-public-comment maxlength="120" rows="2" required>${esc(this.draft)}</textarea></label><button class="main-button" ${this.busy?'disabled':''}>ひとことを送る</button></form><ul class="friend-comments">${detail.comments.map(comment=>`<li><strong>${esc(comment.name)}${comment.own?' · あなた':''}</strong><p>${esc(comment.text)}</p>${comment.own?`<button data-public-action="delete-comment" data-comment="${comment.id}">削除</button>`:''}</li>`).join('')}</ul>${!post.own?'<button class="outline-button" data-public-action="report">この投稿を通報する</button>':''}</section>`;
  }
  render() {
    let profile=null;try{profile=sharingProfile();}catch(error){this.error=error.message;}
    this.innerHTML=`<section class="friends-feature public-feed"><header class="feed-heading"><h1>みんなの投稿</h1><button class="outline-button" data-public-action="refresh" ${this.loading?'disabled':''}>更新</button></header><article class="friends-prompt"><p>${esc(dailyTopic(this.day).original)}</p></article><p class="public-audience">アプリを使う全員に公開される写真です。</p>${profile?.confirmed?`<p class="public-identity">投稿者：${esc(profile.name)}</p>`:'<button class="outline-button" data-public-action="profile">表示名を登録して参加する</button>'}${this.local?`<div class="public-local"><p>今日の写真を、この端末のカレンダーに保存しています。</p><button class="outline-button" data-public-action="publish-local" ${this.busy?'disabled':''}>${this.posts.some(post=>post.own)?'保存した写真で公開を更新する':'保存した写真を全員に公開する'}</button></div>`:''}<p class="friend-status" role="status">${esc(this.status)}</p>${this.error?`<p class="reading-error" role="alert">${esc(this.error)}</p>`:''}${this.loading?'<p class="reading-help">投稿を読み込んでいます…</p>':''}${!this.loading&&!this.error&&!this.posts.length?'<p class="public-empty">今日の投稿はまだありません。最初の一枚を撮ってみよう。</p>':''}<div class="friend-photo-grid">${this.posts.map(post=>`<article class="feed-post ${post.own?'friend-own-photo':''}"><header class="feed-post-author"><span>${esc(Array.from(post.name)[0])}</span><strong>${esc(post.name)}${post.own?' · あなた':''}</strong><small>${new Date(post.createdAt+9*3600000).toISOString().slice(11,16)}</small>${post.own?`<button data-public-action="delete-photo" data-photo="${post.id}">削除</button>`:''}</header><button class="friend-photo-tile" data-public-action="open" data-photo="${post.id}" aria-label="${esc(post.name)}の写真へのリアクションを開く">${postcardMarkup(post,{captionClass:post.own?'friend-own-caption':''})}</button><button class="public-reaction-count" data-public-action="open" data-photo="${post.id}">リアクション ${post.stampCount} · ひとこと ${post.commentCount}</button>${this.selected===post.id?this.detail(post):''}</article>`).join('')}</div>${this.cursor?`<button class="outline-button" data-public-action="more" ${this.loading?'disabled':''}>もっと見る</button>`:''}<small class="public-retention">公開した写真は約30日後にサーバーから削除されます。端末に保存した写真はカレンダーに残ります。</small></section>`;
  }
}
customElements.define('basho-public-feed',PublicFeed);
