// Device-owned posting identity. Tokens never appear in a URL or another user's feed.
const KEY='basho_public_profile_v1';
export class SharingError extends Error { constructor(message,status=0){super(message);this.status=status;} }
export function sharingProfile() {
  const value=JSON.parse(localStorage.getItem(KEY)||'null');
  if(value && (!/^[a-f0-9]{32}$/.test(value.id||'') || !/^[A-Za-z0-9_-]{43}$/.test(value.token||''))) throw new SharingError('投稿者の登録情報を読み込めません。');
  return value;
}
export async function sharingAPI(action,data={}) {
  if(window.BASHO_PHOTO_PREVIEW) throw new SharingError('プレビューでは実際の写真共有は行いません。');
  const endpoint=window.BASHO_NOTIFICATIONS?.endpoint;
  if(!endpoint || !/^https:\/\//.test(endpoint)) throw new SharingError('写真共有サーバーは準備中です。');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try {
    const profile=sharingProfile();
    const identity=['feed','detail'].includes(action)&&!profile?.confirmed?null:profile;
    const response=await fetch(`${endpoint.replace(/\/$/,'')}/api/sharing/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,identity}),signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
    let result;try{result=await response.json();}catch{throw new SharingError('写真共有サーバーから応答を読み込めませんでした。',response.status);}
    if(!response.ok) throw new SharingError(result.error || '共有できませんでした。もう一度お試しください。',response.status);
    return result;
  } catch(error) {
    if(error instanceof SharingError) throw error;
    throw new SharingError('通信できず、公開結果を確認できませんでした。接続を確認して再送信してください。');
  } finally {clearTimeout(timer);}
}
export async function registerSharingProfile(name) {
  let profile=sharingProfile();
  if(!profile) {
    profile={id:crypto.randomUUID().replaceAll('-',''),token:btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=',''),name:''};
    // Save before registration so a lost response cannot orphan the device identity.
    localStorage.setItem(KEY,JSON.stringify(profile));
  }
  const result=await sharingAPI('profile',{name});
  const saved={...profile,name:result.member.name,confirmed:true};
  localStorage.setItem(KEY,JSON.stringify(saved));
  window.dispatchEvent(new Event('basho-sharing-updated'));
  return saved;
}
export function ensureSharingProfile() {
  if(sharingProfile()?.confirmed) return Promise.resolve(true);
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.className='sharing-profile-dialog';
    dialog.innerHTML='<form><h2>みんなに写真を公開する</h2><p>投稿すると、写真・ひとこと・表示名がアプリを使う全員に公開されます。</p><label>表示名<input name="name" maxlength="20" required autocomplete="nickname" placeholder="ニックネーム（20文字まで）"></label><p class="reading-help">写真は約30日間サーバーに保存されます。登録情報はこのブラウザに保存され、自分の投稿を編集・削除できます。ブラウザのデータを消すと、この登録では操作できなくなります。</p><p class="reading-error" role="alert"></p><button class="main-button" type="submit">この表示名で公開を始める</button><button type="button" data-profile-cancel class="outline-button">やめる</button></form>';
    document.body.append(dialog);dialog.showModal();
    const finish=value=>{dialog.close();dialog.remove();resolve(value);};
    dialog.querySelector('[data-profile-cancel]').onclick=()=>finish(false);
    dialog.oncancel=event=>{event.preventDefault();finish(false);};
    dialog.querySelector('form').onsubmit=async event=>{
      event.preventDefault();const button=dialog.querySelector('[type=submit]');button.disabled=true;
      try{await registerSharingProfile(dialog.querySelector('input').value);finish(true);}catch(error){dialog.querySelector('[role=alert]').textContent=error.message;button.disabled=false;}
    };
  });
}
export async function publishCard(card) {
  if(!await ensureSharingProfile()) return false;
  return sharingAPI('publish',{day:card.day,topicId:card.topicId,image:card.image,caption:card.caption||'',audience:'public'});
}
