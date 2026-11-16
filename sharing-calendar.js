import { validDay, japanDay } from './reading-store.js';
export function sharedPhotoDay(day,today=japanDay()){
  if(!validDay(day)||day>today)throw new Error('今日までの記録を選択してください。');
  return day;
}
export function calendarRange(month,cursor=null){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month||'')||!validDay(month+'-01'))throw new Error('表示する月を選択してください。');
  if(cursor && (!validDay(cursor.day)||!cursor.day.startsWith(month+'-')||!/^[A-Za-z0-9_-]{1,180}$/.test(cursor.id||'')))throw new Error('カレンダーを再読み込みしてください。');
  return {first:month+'-01',last:month+'-31',cursor};
}
const cmp=(a,b)=>a<b?-1:a>b?1:0;
export function calendarPage(records,cursor=null,size=60){
  const rows=Object.entries(records||{}).map(([id,post])=>({...post,id})).sort((a,b)=>cmp(a.day,b.day)||cmp(a.id,b.id)).filter(p=>!cursor || cmp(p.day,cursor.day)>0 || p.day===cursor.day && cmp(p.id,cursor.id)>0);
  const posts=rows.slice(0,size),last=posts.at(-1);
  return {posts,nextCursor:rows.length>size?{day:last.day,id:last.id}:null};
}
export async function readSharedCalendar(session,group,month,cursor=null){
  const range=calendarRange(month,cursor),sdk=session.dbSDK;
  const lower=cursor?sdk.startAt(cursor.day,cursor.id):sdk.startAt(range.first);
  const snapshot=await sdk.get(sdk.query(sdk.ref(session.db,`groups/${group}/photos`),sdk.orderByChild('day'),lower,sdk.endAt(range.last),sdk.limitToFirst(cursor?62:61)));
  return calendarPage(snapshot.val(),cursor);
}
export function unsharedMonthCards(cards,month,posts,today=japanDay()){
  const unique=[...new Map([...cards].sort((a,b)=>(Number(a.createdAt)||0)-(Number(b.createdAt)||0)).map(card=>[card.day,card])).values()];
  return unique.filter(card=>['photo-challenge','photo-ai'].includes(card.creation) && validDay(card.day) && card.day<=today && card.day.startsWith(month+'-') && typeof card.image==='string' && !posts.some(p=>p.own && p.day===card.day));
}
