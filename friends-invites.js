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
