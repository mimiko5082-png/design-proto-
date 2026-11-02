import { openPostCompletion, postDate } from './photo-postcard.js';
import { dailyTopic, topicById } from './haiku-catalog.js';
import { japanDay } from './reading-store.js';
import { preparePhoto } from './haiku-service.js';
import { makeCard, saveCard, loadCards, replaceCardPhoto } from './haiku-store.js';
const esc = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));


// Decorative city scene only: never used as a captured or saved photograph.
const CITY_BACKGROUND = `<svg class="ambient-city" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
<defs>
 <linearGradient id="city-sky" x2="0" y2="1"><stop stop-color="#061015"/><stop offset=".6" stop-color="#183c3a"/><stop offset="1" stop-color="#5d7863"/></linearGradient>
 <linearGradient id="city-road" x2="0" y2="1"><stop stop-color="#263c34"/><stop offset="1" stop-color="#060f13"/></linearGradient>
 <linearGradient id="city-glow" x2="0" y2="1"><stop stop-color="#ebc68a" stop-opacity=".5"/><stop offset="1" stop-color="#ebc68a" stop-opacity="0"/></linearGradient>
 <radialGradient id="city-haze"><stop stop-color="#a6c3a0" stop-opacity=".3"/><stop offset="1" stop-color="#a6c3a0" stop-opacity="0"/></radialGradient>
 <pattern id="city-windows" width="29" height="37" patternUnits="userSpaceOnUse"><path d="M9 11h10v15H9z" fill="#5a7969" opacity=".24"/><path d="M14 11v15" stroke="#172e2b"/></pattern>
</defs>
<path fill="url(#city-sky)" d="M0 0h400v800H0z"/>
<ellipse cx="239" cy="543" rx="183" ry="201" fill="url(#city-haze)"/>
<g fill="#253f3a"><path d="M132 458h35v157h-35zM174 485h26v130h-26zM202 468h34v147h-34zM242 493h22v122h-22zM271 444h35v171h-35z"/></g>
<g fill="#8da58b" opacity=".3"><path d="M181 507h5v9h-5zM214 488h5v10h-5zM248 529h5v8h-5zM284 478h6v11h-6z"/></g>
<path d="M0 345l92 33v230L0 691z" fill="#0a1b20"/><path d="M0 345l92 33v230L0 691z" fill="url(#city-windows)"/>
<path d="M92 412l49 21v167l-49 20z" fill="#152d2d"/><path d="M99 440l32 9v149l-32 13z" fill="url(#city-windows)"/>
<path d="M400 300l-88 64v251l88 85z" fill="#0c2023"/><path d="M400 300l-88 64v251l88 85z" fill="url(#city-windows)"/>
<path d="M312 424l-45 21v165l45 17z" fill="#1b3230"/><path d="M307 447l-34 14v145l34 13z" fill="url(#city-windows)"/>
<path d="M0 690l205-82h52l143 91v101H0z" fill="url(#city-road)"/>
<path d="M0 684l205-76M400 695l-143-87" stroke="#839e8555" stroke-width="2"/>
<path d="M226 616l-9 83h27l-8-83zM210 724l-12 76h63l-14-76z" fill="url(#city-glow)" opacity=".35"/>
<path d="M110 729l-50 71M302 743l36 57" stroke="#80998a" opacity=".14"/>
<g stroke="#061518" fill="none"><path d="M37 304v390M353 271v432" stroke-width="5"/><path d="M25 341h28M340 315h29" stroke-width="3"/><path d="M37 328Q189 428 353 302M37 345Q215 457 353 321" stroke-width="1.6"/><path d="M37 315L0 293M353 291l47-31"/></g>
<path d="M282 510h19v39h-19z" fill="#c8aa78" opacity=".85"/><path d="M291 511v37M283 530h17" stroke="#34483b" stroke-width="2"/>
<path d="M111 491h15v24h-15z" fill="#859779" opacity=".65"/>
<path d="M290 551l-23 182h46z" fill="url(#city-glow)" opacity=".15"/>
<g fill="#d7c18e"><circle cx="229" cy="588" r="2.4"/><circle cx="258" cy="579" r="1.7"/></g>
<path d="M206 625h36M189 644h40M165 677h31M271 686h24M146 755h30M265 781h45" stroke="#729384" stroke-width="1.5" opacity=".22"/>
</svg>`;

class HaikuCards extends HTMLElement {
  connectedCallback() {
    this.day = japanDay(); this.topic = dailyTopic(this.day);
    this.caption = '';
    this.reflection = ''; this.noteEdited = false; this.showHint = false; this.noteOpen = false; this.restoring = true;
    this.busy = false; this.message = ''; this.error = ''; this.selection = 0;
    this.cameraFacing = 'environment'; this.cameraSession = 0; this.cameraStream = null; this.cameraOpening = false; this.cameraReady = false;
    this.onDayCheck = () => this.refreshDay();
    this.dayTimer = setInterval(this.onDayCheck, 1000);
    this.onCameraVisibility = event => { if ((document.hidden || event?.type === 'pagehide') && (this.cameraStream || this.cameraOpening)) this.closeCamera(); };
    window.addEventListener('pagehide', this.onCameraVisibility);
    document.addEventListener('visibilitychange', this.onCameraVisibility);
    document.addEventListener('visibilitychange', this.onDayCheck);
    window.addEventListener('focus', this.onDayCheck);
    window.addEventListener('pageshow', this.onDayCheck);
    this.onClick = event => {
      if (this.refreshDay()) return;
      const action = event.target.closest('[data-haiku-action]')?.dataset.haikuAction;
      if (action === 'hint') {
        this.showHint = !this.showHint;
        const button = this.querySelector('[data-haiku-action=hint]');
        button.textContent = this.showHint ? 'ヒントを閉じる' : 'ヒントを見る';
        button.setAttribute('aria-expanded', String(this.showHint));
        this.querySelector('[data-photo-hint]').hidden = !this.showHint;
      }
      if (action === 'retake' || action === 'camera') this.openCamera();
      if (action === 'camera-flip') this.switchCamera(this.cameraFacing==='environment'?'user':'environment');
      if (action === 'camera-user') this.switchCamera('user');
      if (action === 'camera-environment') this.switchCamera('environment');
      if (action === 'camera-close') this.closeCamera();
      if (action === 'camera-shoot') this.capturePhoto();
      if (action === 'pick-file' && !this.busy && !this.restoring) { const input=this.querySelector('[data-haiku-photo]'); input.value=''; input.click(); }
      if (action === 'save') this.save();
      if (action === 'cancel-photo' && !this.busy) { this.image = this.card.image; this.caption = this.card.caption || ''; this.reflection = this.card.reflection || ''; this.message = '写真・メモの変更を取り消しました。'; this.error = ''; this.render(); }
    };
    this.onChange = event => { if (this.refreshDay()) return; if (event.target.matches('[data-haiku-photo]')) this.selectPhoto(event.target.files[0]); };
    this.onInput = event => {
      if (event.target.matches('[data-photo-caption]')) { this.caption = event.target.value; this.paintDraftControls(); }
    };
    this.onToggle = event => { if (event.target.matches('[data-photo-note]')) this.noteOpen = event.target.open; };
    this.addEventListener('toggle', this.onToggle, true);
    this.addEventListener('input', this.onInput);
    this.addEventListener('click', this.onClick); this.addEventListener('change', this.onChange);
    this.render(); this.restore();
  }
  disconnectedCallback() {
    this.stopCamera();
    window.removeEventListener('pagehide', this.onCameraVisibility);
    document.removeEventListener('visibilitychange', this.onCameraVisibility);
    this.removeEventListener('toggle', this.onToggle, true);
    this.removeEventListener('input', this.onInput);
    clearInterval(this.dayTimer);
    document.removeEventListener('visibilitychange', this.onDayCheck);
    window.removeEventListener('focus', this.onDayCheck);
    window.removeEventListener('pageshow', this.onDayCheck);
    this.selection++; this.removeEventListener('click', this.onClick); this.removeEventListener('change', this.onChange);
  }
  refreshDay() {
    const day = japanDay();
    if (day === this.day) return false;
    this.stopCamera(); this.cameraError = '';
    this.selection++;
    this.day = day; this.topic = dailyTopic(day); this.showHint = false; this.noteOpen = false; this.restoring = true;
    this.card = null; this.image = null; this.caption = ''; this.reflection = ''; this.noteEdited = false; this.saved = false; this.busy = false; this.error = '';
    this.message = '新しい日になりました。今日のお題に切り替わりました。昨日までの保存済み写真はカレンダーに残っています。';
    this.render(); this.restore();
    window.dispatchEvent(new Event('basho-reading-updated'));
    return true;
  }
  async restore() {
    const revision = this.selection;
    try {
      const cards = await loadCards();
      if (!this.isConnected || revision !== this.selection) return;
      const card = cards.find(card => card.id === `photo-challenge-${this.day}`);
      if (card) {
        this.card = card; this.image = card.image; this.caption = card.caption || ''; if (!this.noteEdited) this.reflection = card.reflection || ''; this.saved = true;
        const savedTopic = topicById(card.topicId);
        if (savedTopic) this.topic = { ...savedTopic, modern: card.modern || savedTopic.modern, original: card.original || savedTopic.original };
      }
    } catch { if (!this.isConnected || revision !== this.selection) return; this.error = '写真の保存領域を開けません。ブラウザの保存設定をご確認ください。'; }
    finally { if (revision === this.selection && this.isConnected) { this.restoring = false; this.render(); } }
  }
  stopCamera() {
    this.cameraSession++;
    this.cameraStream?.getTracks().forEach(track=>track.stop());
    this.cameraStream=null; this.cameraOpening=false; this.cameraReady=false; this.cameraCapturing=false;
  }
  closeCamera() { this.stopCamera(); if(this.isConnected) this.render(); }
  switchCamera(facing) {
    if(this.busy || this.restoring || this.cameraOpening || this.cameraCapturing) return;
    if(this.cameraStream && facing===this.cameraFacing) return;
    this.stopCamera(); this.cameraFacing=facing; this.openCamera(true);
  }
  cameraFailure(error) {
    if(error?.name === 'OverconstrainedError') return `${this.cameraFacing==='user'?'内カメ':'外カメ'}を使えませんでした。もう一方のカメラか、端末の写真選択をお試しください。`;
    if(error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return 'カメラを使うには、ブラウザでカメラへのアクセスを許可してください。';
    if(error?.name === 'NotFoundError') return '指定したカメラが見つかりませんでした。外カメのあるスマートフォンで、SafariまたはChromeから開いてください。';
    if(error?.name === 'NotReadableError') return 'カメラを開けませんでした。他のアプリで使用中でないか確認してください。';
    return 'カメラを開けませんでした。ブラウザのカメラ設定を確認してください。';
  }
  async requestCamera(session, explicitFacing) {
    const media=navigator.mediaDevices;
    const dimensions={width:{ideal:1280},height:{ideal:960}};
    const request=video=>media.getUserMedia({video:{...dimensions,...video},audio:false});
    const current=()=>session===this.cameraSession && this.isConnected;
    let stream;
    try { stream=await request({facingMode:explicitFacing?{exact:this.cameraFacing}:{ideal:this.cameraFacing}}); }
    catch(error) {
      if(!current() || !['OverconstrainedError','NotFoundError'].includes(error.name)) throw error;
      // Some mobile browsers reject facingMode.exact even though both cameras exist.
      let devices=[];
      try { devices=await media.enumerateDevices(); } catch { /* Preference request still works without enumeration. */ }
      if(!current()) throw new DOMException('Camera closed','AbortError');
      const pattern=this.cameraFacing==='environment'?/back|rear|environment|背面|外側|後面/i:/front|user|facetime|前面|内側/i;
      const device=devices.find(device=>device.kind==='videoinput' && pattern.test(device.label));
      stream=await request(device?{deviceId:{exact:device.deviceId}}:{facingMode:{ideal:this.cameraFacing}});
    }
    if(!current()) { stream.getTracks().forEach(track=>track.stop()); throw new DOMException('Camera closed','AbortError'); }
    const track=stream.getVideoTracks()[0];
    const settings=track?.getSettings?.() || {};
    const label=track?.label || '';
    const facing=settings.facingMode || (/back|rear|environment|背面|外側|後面/i.test(label)?'environment':/front|user|facetime|前面|内側/i.test(label)?'user':null);
    if(explicitFacing && facing && facing!==this.cameraFacing) {
      stream.getTracks().forEach(track=>track.stop());
      throw new DOMException('Requested camera unavailable','OverconstrainedError');
    }
    this.cameraFacingKnown=!!facing;
    if(facing) this.cameraFacing=facing;
    return stream;
  }
  async openCamera(explicitFacing=false) {
    if(this.busy || this.restoring || this.cameraOpening || this.cameraStream) return;
    this.cameraError=''; this.error='';
    if(!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      this.cameraError='このブラウザではカメラを直接開けません。HTTPSの画面を端末のブラウザで開いてください。';
      this.render(); return;
    }
    const session=++this.cameraSession;
    this.cameraOpening=true; this.render();
    try {
      const stream=await this.requestCamera(session,explicitFacing);
      if(session!==this.cameraSession || !this.isConnected) { stream.getTracks().forEach(track=>track.stop()); return; }
      this.cameraStream=stream; this.cameraOpening=false;
      for(const track of stream.getVideoTracks()) track.addEventListener('ended',()=>{
        if(session===this.cameraSession && this.isConnected) { this.stopCamera(); this.cameraError='カメラが停止しました。もう一度カメラを開いてください。'; this.render(); }
      });
      this.render();
      const video=this.querySelector('[data-camera-video]');
      video.srcObject=stream; await video.play();
      if(session!==this.cameraSession || !this.isConnected) return;
      this.cameraReady=true;
      const actualFacing=stream.getVideoTracks()[0]?.getSettings?.().facingMode;
      if(actualFacing==='user' || actualFacing==='environment') this.cameraFacing=actualFacing;
      video.classList.toggle('is-front-camera',this.cameraFacing==='user');
      for(const button of this.querySelectorAll('[data-camera-facing]')) {button.disabled=false;button.setAttribute('aria-pressed',String(button.dataset.cameraFacing===this.cameraFacing));}
      const shutter=this.querySelector('[data-haiku-action="camera-shoot"]'); if(shutter) shutter.disabled=false;
      const status=this.querySelector('[data-camera-status]'); if(status) status.textContent=this.cameraFacingKnown?`${this.cameraFacing==='user'?'内カメ':'外カメ'}で撮影中 · 撮影するを押してください。`:'カメラ映像を表示しています。外カメがない端末や切替に非対応のブラウザでは、外カメを使えない場合があります。';
    } catch(error) {
      if(session!==this.cameraSession || !this.isConnected) return;
      this.stopCamera(); this.cameraError=this.cameraFailure(error); this.render();
    }
  }
  async capturePhoto() {
    const video=this.querySelector('[data-camera-video]');
    if(!this.cameraReady || this.cameraCapturing || !video?.videoWidth) return;
    const session=this.cameraSession;
    this.cameraCapturing=true; this.querySelector('[data-haiku-action="camera-shoot"]').disabled=true;
    try {
      const canvas=document.createElement('canvas');
      const scale=Math.min(1,1280/Math.max(video.videoWidth,video.videoHeight));
      canvas.width=Math.max(1,Math.round(video.videoWidth*scale)); canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
      const ctx=canvas.getContext('2d'); if(!ctx) throw Error('Camera unavailable');
      ctx.drawImage(video,0,0,canvas.width,canvas.height);
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('Camera capture failed')),'image/jpeg',.9));
      if(session!==this.cameraSession || !this.isConnected) return;
      this.stopCamera(); this.cameraError='';
      await this.selectPhoto(new File([blob],'basho-camera.jpg',{type:'image/jpeg'}));
    } catch {
      if(session!==this.cameraSession || !this.isConnected) return;
      this.stopCamera(); this.cameraError='撮影できませんでした。もう一度カメラを開いてお試しください。'; this.render();
    }
  }
  async selectPhoto(file) {
    if (this.busy || this.restoring || this.cameraStream || this.cameraOpening || !file) return;
    const revision = ++this.selection;
    this.busy = true; this.error = ''; this.render();
    try { const image = await preparePhoto(file); if (revision === this.selection) { this.image = image; this.cameraError = ''; } }
    catch (error) { if (revision === this.selection) this.error = error.message; }
    finally { if (revision === this.selection && this.isConnected) { this.busy = false; this.render(); } }
  }
  async save() {
    if (this.busy || this.restoring || this.cameraStream || this.cameraOpening || !this.image || (this.saved && !this.hasPendingChanges())) return;
    if (this.refreshDay()) return;
    const revision = this.selection;
    this.busy = true; this.error = ''; this.render();
    try {
      if (this.saved) {
        const updated = await replaceCardPhoto(this.card.id, this.image, this.reflection, this.caption);
        window.dispatchEvent(new Event('basho-reading-updated'));
        if (revision !== this.selection || !this.isConnected) return;
        const photoChanged = this.image !== this.card.image;
        this.card = updated;
        this.image = this.card.image; this.caption = this.card.caption || ''; this.reflection = this.card.reflection || '';
        this.message = photoChanged ? '写真を変更しました。カレンダーにも反映しました。' : 'ひとことを保存しました。友達の写真の画面でも見返せます。';
        window.dispatchEvent(new Event('basho-reading-updated'));
        return;
      }
      const draft = { id: `photo-challenge-${this.day}`, topicDay: this.day, topicId: this.topic.id, creation: 'photo-challenge', image: this.image, reflection: this.reflection, caption: this.caption };
      const card = makeCard(draft, this.topic.lines);
      const added = await saveCard(card);
      // Another tab may have saved today's photo first. Keep that photo as canonical.
      const savedCard = added ? card : (await loadCards()).find(item => item.id === draft.id);
      window.dispatchEvent(new Event('basho-reading-updated'));
      if (revision !== this.selection || !this.isConnected) return;
      this.card = savedCard;
      if (!this.card) throw Error('Save failed');
      this.image = this.card.image; this.caption = this.card.caption || ''; this.reflection = this.card.reflection || ''; this.saved = true;
      this.message = added ? '今日の写真を保存しました。' : '今日の写真は保存済みです。';
      if(added) openPostCompletion(this.card);
      window.dispatchEvent(new Event('basho-reading-updated'));
    } catch { if (revision === this.selection) this.error = '保存できませんでした。空き容量やブラウザの保存設定を確認してください。'; }
    finally { if (revision === this.selection && this.isConnected) { this.busy = false; this.render(); } }
  }
  hasPendingChanges() {
    return !!this.saved && (this.image !== this.card.image || this.caption.trim() !== (this.card.caption || ''));
  }
  saveLabel() {
    if (!this.saved) return '投稿する';
    if (!this.hasPendingChanges()) return '今日の写真を保存済み';
    return '投稿する';
  }
  paintDraftControls() {
    const pending = this.hasPendingChanges();
    const save = this.querySelector('[data-haiku-action="save"]');
    save.textContent = this.saveLabel();
    save.disabled = !this.image || this.busy || this.cameraStream || this.cameraOpening || (this.saved && !pending);
    for (const node of this.querySelectorAll('[data-pending-edit]')) node.hidden = !pending;
  }
  render() {
    const pending = this.hasPendingChanges();
    this.innerHTML = `<section class="haiku-create photo-capture-home neo-capture">
    <input class="photo-capture-input" id="basho-photo-file" type="file" aria-label="写真を撮る・選ぶ" data-haiku-photo accept="image/jpeg,image/png,image/webp" capture="${this.cameraFacing}" ${this.busy||this.restoring?'disabled':''}>
    <div class="capture-stage ${this.image?'has-photo':'no-photo'}">
    ${this.image?`<img class="haiku-photo capture-full-image" src="${esc(this.image)}" alt="今日のお題に合わせた写真">`:`<div class="capture-full-image capture-ambient city-backdrop" role="img" aria-label="窓の明かりと雨上がりの路地を描いた撮影前の街の背景">${CITY_BACKGROUND}<span class="ambient-grain" aria-hidden="true"></span></div>`}
    <article class="haiku-topic capture-prompt"><h1 class="visually-hidden">今日のお題</h1><span class="photo-edition" aria-hidden="true">BASHO <i></i> DAILY FRAME</span><small>${esc(this.topic.original || this.topic.lines.join(''))}</small><p class="photo-modern">${esc(this.topic.modern)}</p><div class="photo-topic-options"><button type="button" data-haiku-action="hint" aria-expanded="${this.showHint}" aria-controls="basho-photo-hint">${this.showHint?'ヒントを閉じる':'ヒントを見る'}</button></div><p class="haiku-hint" id="basho-photo-hint" data-photo-hint ${this.showHint?'':'hidden'}>${esc(this.topic.photoHint)}</p></article>
    <time class="capture-date">${esc(this.saved?postDate(this.card):postDate({day:this.day,createdAt:Date.now()}))}</time>
    ${this.image?`<label class="photo-caption-field"><small>もう一言だけ</small><textarea data-photo-caption rows="2" maxlength="120" aria-label="写真にひとこと（任意）" placeholder="見つけたことを、ひとこと。" ${this.busy||this.cameraStream||this.cameraOpening?'disabled':''}>${esc(this.caption)}</textarea></label>`:`<button type="button" data-haiku-action="camera" class="photo-capture-empty" ${this.busy||this.restoring?'disabled':''}><span class="camera-shutter" aria-hidden="true"></span><strong>${this.restoring?'写真を読み込んでいます…':this.busy?'写真を準備しています…':'タップしてカメラを開く'}</strong></button>`}
    <div class="photo-capture-actions" ${this.image?'':'hidden'}><button type="button" class="outline-button" data-haiku-action="retake" ${this.busy||this.cameraStream||this.cameraOpening?'disabled':''}>撮り直す</button><button type="button" class="main-button" data-haiku-action="save" ${!this.image||this.busy||this.cameraStream||this.cameraOpening||(this.saved&&!pending)?'disabled':''}>${this.saveLabel()}</button></div>
    <div class="capture-extra-actions"><button type="button" data-nav="calendar" aria-label="自分の記録を開く">▦</button><button type="button" data-haiku-action="camera-flip" aria-label="カメラを切り替える">↻</button></div>
    </div>
    <button type="button" class="outline-button" data-haiku-action="cancel-photo" data-pending-edit ${pending?'':'hidden'}>変更をやめる</button>
    ${this.cameraError?`<p class="reading-error" role="alert">${esc(this.cameraError)}</p><div class="camera-facing-options" role="group" aria-label="カメラを選んで再試行"><button type="button" data-haiku-action="camera-environment">外カメを開く</button><button type="button" data-haiku-action="camera-user">内カメを開く</button></div><button type="button" class="outline-button" data-haiku-action="pick-file">端末のカメラ・写真選択を使う</button>`:''}
    <p class="haiku-status" role="status" aria-live="polite">${esc(this.message)}</p>${this.error?`<p class="reading-error" role="alert">${esc(this.error)}</p>`:''}
    ${(this.cameraOpening||this.cameraStream)?`<dialog class="photo-camera-dialog" aria-label="写真を撮影"><header><strong>今日の一枚を撮る</strong><button type="button" data-haiku-action="camera-close" aria-label="カメラを閉じる">×</button></header><div class="camera-facing-options" role="group" aria-label="使うカメラ"><button type="button" data-camera-facing="environment" data-haiku-action="camera-environment" aria-pressed="${this.cameraFacing==='environment'}" disabled>外カメ</button><button type="button" data-camera-facing="user" data-haiku-action="camera-user" aria-pressed="${this.cameraFacing==='user'}" disabled>内カメ</button></div><div class="photo-camera-view"><video data-camera-video autoplay muted playsinline></video></div><p data-camera-status role="status">${this.cameraOpening?'カメラを開いています…':'カメラの準備をしています…'}</p><div class="photo-camera-controls"><button type="button" class="outline-button" data-haiku-action="camera-close">やめる</button><button type="button" class="main-button" data-haiku-action="camera-shoot" disabled>撮影する</button></div></dialog>`:''}
    </section>`;
    const dialog=this.querySelector('.photo-camera-dialog');
    if(dialog) { dialog.addEventListener('cancel',event=>{event.preventDefault();this.closeCamera();}); if(dialog.showModal) dialog.showModal(); else dialog.setAttribute('open',''); }
  }
}
customElements.define('basho-haiku', HaikuCards);
