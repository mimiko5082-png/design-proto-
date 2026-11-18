// Keep an invitation through login/navigation; never log the token or send it to another origin.
const KEY='basho_firebase_pending_invite_v1',TTL=7*86400000;
const valid=token=>/^[a-f0-9]{64}$/.test(token||'');
export function inviteToken(value,base){
  const text=String(value||'').trim();if(valid(text))return text;
  let url;try{url=new URL(text,base);}catch{return '';}
  const current=new URL(base);
  const trusted=url.origin===current.origin || url.origin==='https://mimiko5082-png.github.io'&&url.pathname.startsWith('/design-proto-/') || url.origin==='https://basho-preview.mimiko5082.workers.dev';
  if(!trusted||!['http:','https:'].includes(url.protocol)||url.username||url.password)return '';
  const token=new URLSearchParams(url.hash.slice(1)).get('invite')||url.searchParams.get('invite');
  return valid(token)?token:'';
}
export function rememberInvite(value,base,storage,now=Date.now()){
  const token=inviteToken(value,base);if(!token)return '';
  try{storage.setItem(KEY,JSON.stringify({token,at:now}));}catch{/* URL still carries the invitation if storage is unavailable. */}
  return token;
}
export function readPendingInvite(href,storage,now=Date.now()){
  const token=inviteToken(href,href);if(token)return rememberInvite(token,href,storage,now);
  try{const saved=JSON.parse(storage.getItem(KEY)||'null');if(valid(saved?.token)&&Number.isFinite(saved.at)&&now>=saved.at&&now-saved.at<TTL)return saved.token;storage.removeItem(KEY);}catch{}
  return '';
}
export function forgetInvite(storage,token){
  try{const saved=JSON.parse(storage.getItem(KEY)||'null');if(!token||saved?.token===token)storage.removeItem(KEY);}catch{}
}
// What the invitation screen can say before login: who invited, how many take part, until when.
// It travels in the link beside the token, so it is only a label: the token alone decides the group.
const META_KEY='basho_firebase_invite_meta_v1';
const cleanName=value=>Array.from(String(value||'').replace(/[\u0000-\u001f\u007f<>]/g,'').trim()).slice(0,20).join('');
export function inviteMeta(value,base,now=Date.now()){
  const token=inviteToken(value,base);if(!token)return null;
  let params;try{const url=new URL(String(value).trim(),base);params=new URLSearchParams(url.hash.slice(1));if(params.get('invite')!==token)params=url.searchParams;}catch{return null;}
  const from=cleanName(params.get('from')),count=Number(params.get('n')),expires=Number(params.get('exp'));
  return {token,from,count:Number.isInteger(count)&&count>0&&count<1000?count:0,expiresAt:Number.isFinite(expires)&&expires>now&&expires<=now+8*86400000?expires:0};
}
export function readInviteMeta(href,storage,token,now=Date.now()){
  if(!valid(token))return null;
  const fresh=inviteMeta(href,href,now);
  if(fresh?.token===token&&(fresh.from||fresh.count||fresh.expiresAt)){try{storage.setItem(META_KEY,JSON.stringify(fresh));}catch{}return fresh;}
  try{
    const saved=JSON.parse(storage.getItem(META_KEY)||'null');
    if(saved?.token===token)return {token,from:cleanName(saved.from),count:Number.isInteger(saved.count)&&saved.count>0&&saved.count<1000?saved.count:0,expiresAt:Number.isFinite(saved.expiresAt)&&saved.expiresAt>now?saved.expiresAt:0};
  }catch{}
  return {token,from:'',count:0,expiresAt:0};
}
export function forgetInviteMeta(storage,token){
  try{const saved=JSON.parse(storage.getItem(META_KEY)||'null');if(!token||saved?.token===token)storage.removeItem(META_KEY);}catch{}
}
