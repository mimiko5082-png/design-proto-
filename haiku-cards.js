import { openPostCompletion, postDate } from './photo-postcard.js';
import { dailyTopic, topicById } from './haiku-catalog.js';
import { japanDay } from './reading-store.js';
import { preparePhoto } from './haiku-service.js';
import { makeCard, saveCard, loadCards, replaceCardPhoto } from './haiku-store.js';
const esc = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

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
      if (action === 'camera-flip' && !this.cameraOpening) { this.cameraFacing=this.cameraFacing==='environment'?'user':'environment'; this.stopCamera(); this.openCamera(); }
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
  cameraFailure(error) {
    if(error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return 'カメラを使うには、ブラウザでカメラへのアクセスを許可してください。';
    if(error?.name === 'NotFoundError') return 'カメラが見つかりませんでした。カメラのある端末で開いてください。';
    if(error?.name === 'NotReadableError') return 'カメラを開けませんでした。他のアプリで使用中でないか確認してください。';
    return 'カメラを開けませんでした。ブラウザのカメラ設定を確認してください。';
  }
  async openCamera() {
    if(this.busy || this.restoring || this.cameraOpening || this.cameraStream) return;
    this.cameraError=''; this.error='';
    if(!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      this.cameraError='このブラウザではカメラを直接開けません。HTTPSの画面を端末のブラウザで開いてください。';
      this.render(); return;
    }
    const session=++this.cameraSession;
    this.cameraOpening=true; this.render();
    try {
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:this.cameraFacing},width:{ideal:1280},height:{ideal:960}},audio:false});
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
      const shutter=this.querySelector('[data-haiku-action="camera-shoot"]'); if(shutter) shutter.disabled=false;
      const status=this.querySelector('[data-camera-status]'); if(status) status.textContent='景色を確かめて、撮影するを押してください。';
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
    <input class="photo-capture-input" id="basho-photo-file" type="file" aria-label="写真を撮る・選ぶ" data-haiku-photo accept="image/jpeg,image/png,image/webp" capture="environment" ${this.busy||this.restoring?'disabled':''}>
    <div class="capture-stage ${this.image?'has-photo':'no-photo'}">
    ${this.image?`<img class="haiku-photo capture-full-image" src="${esc(this.image)}" alt="今日のお題に合わせた写真">`:'<img class="capture-full-image capture-placeholder" src="./assets/kotoba-sunset.png" alt="撮影前の背景イメージ">'}
    <article class="haiku-topic capture-prompt"><h1 class="visually-hidden">今日のお題</h1><small>${esc(this.topic.original || this.topic.lines.join(''))}</small><p class="photo-modern">${esc(this.topic.modern)}</p><div class="photo-topic-options"><button type="button" data-haiku-action="hint" aria-expanded="${this.showHint}" aria-controls="basho-photo-hint">${this.showHint?'ヒントを閉じる':'ヒントを見る'}</button></div><p class="haiku-hint" id="basho-photo-hint" data-photo-hint ${this.showHint?'':'hidden'}>${esc(this.topic.photoHint)}</p></article>
    <time class="capture-date">${esc(this.saved?postDate(this.card):postDate({day:this.day,createdAt:Date.now()}))}</time>
    ${this.image?`<label class="photo-caption-field"><small>もう一言だけ</small><textarea data-photo-caption rows="2" maxlength="120" aria-label="写真にひとこと（任意）" placeholder="見つけたことを、ひとこと。" ${this.busy||this.cameraStream||this.cameraOpening?'disabled':''}>${esc(this.caption)}</textarea></label>`:`<button type="button" data-haiku-action="camera" class="photo-capture-empty" ${this.busy||this.restoring?'disabled':''}><span class="camera-shutter" aria-hidden="true"></span><strong>${this.restoring?'写真を読み込んでいます…':this.busy?'写真を準備しています…':'タップしてカメラを開く'}</strong></button>`}
    <div class="photo-capture-actions" ${this.image?'':'hidden'}><button type="button" class="outline-button" data-haiku-action="retake" ${this.busy||this.cameraStream||this.cameraOpening?'disabled':''}>撮り直す</button><button type="button" class="main-button" data-haiku-action="save" ${!this.image||this.busy||this.cameraStream||this.cameraOpening||(this.saved&&!pending)?'disabled':''}>${this.saveLabel()}</button></div>
    <div class="capture-extra-actions"><button type="button" data-nav="calendar" aria-label="自分の記録を開く">▦</button><button type="button" data-haiku-action="camera-flip" aria-label="カメラを切り替える">↻</button></div>
    </div>
    <button type="button" class="outline-button" data-haiku-action="cancel-photo" data-pending-edit ${pending?'':'hidden'}>変更をやめる</button>
    ${this.cameraError?`<p class="reading-error" role="alert">${esc(this.cameraError)}</p><button type="button" class="outline-button" data-haiku-action="pick-file">端末のカメラ・写真選択を使う</button>`:''}
    <p class="haiku-status" role="status" aria-live="polite">${esc(this.message)}</p>${this.error?`<p class="reading-error" role="alert">${esc(this.error)}</p>`:''}
    ${(this.cameraOpening||this.cameraStream)?`<dialog class="photo-camera-dialog" aria-label="写真を撮影"><header><strong>今日の一枚を撮る</strong><button type="button" data-haiku-action="camera-flip" aria-label="カメラを切り替える">↻</button><button type="button" data-haiku-action="camera-close" aria-label="カメラを閉じる">×</button></header><div class="photo-camera-view"><video data-camera-video autoplay muted playsinline></video></div><p data-camera-status role="status">${this.cameraOpening?'カメラを開いています…':'カメラの準備をしています…'}</p><div class="photo-camera-controls"><button type="button" class="outline-button" data-haiku-action="camera-close">やめる</button><button type="button" class="main-button" data-haiku-action="camera-shoot" disabled>撮影する</button></div></dialog>`:''}
    </section>`;
    const dialog=this.querySelector('.photo-camera-dialog');
    if(dialog) { dialog.addEventListener('cancel',event=>{event.preventDefault();this.closeCamera();}); if(dialog.showModal) dialog.showModal(); else dialog.setAttribute('open',''); }
  }
}
customElements.define('basho-haiku', HaikuCards);
