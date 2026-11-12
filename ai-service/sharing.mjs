import { boundedJSON } from './image-handlers.mjs';
import { hash } from './web-push.mjs';
import { decodeImageData, MAX_AI_IMAGE_BYTES } from '../image-validation.js';
import { dailyTopic, topicById } from '../haiku-catalog.js';
import { japanTime } from './notifications.mjs';
const STAMPS = new Set(['view','same','aha','heart','clap','sparkle','smile','flower']);
const ID = /^[a-f0-9]{32}$/;
const PHOTO = /^[a-f0-9]{64}$/;
class PublicError extends Error { constructor(status, message) { super(message); this.status=status; } }
function text(value, max) {
  if(typeof value!=='string' || value.trim().length>max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new PublicError(400,'入力内容を確認してください。');
  return value.trim();
}
async function identity(db, input, required=true) {
  if(!input && !required) return null;
  if(!ID.test(input?.id || '') || !/^[A-Za-z0-9_-]{43}$/.test(input?.token || '')) throw new PublicError(401,'投稿者の登録が必要です。');
  const member=await db.prepare('SELECT id, token_hash, name FROM photo_members WHERE id = ?').bind(input.id).first();
  if(!member || member.token_hash!==await hash(input.token)) throw new PublicError(401,'投稿者の登録を確認できません。');
  return {id:member.id,name:member.name};
}
async function photo(db, id) {
  if(!PHOTO.test(id || '')) throw new PublicError(400,'写真の指定が不正です。');
  const row=await db.prepare('SELECT id, member_id, day FROM public_photos WHERE id = ?').bind(id).first();
  if(!row) throw new PublicError(404,'この投稿は削除されたか、保存期間が終了しました。');
  return row;
}
export async function sharingRequest(request, env, headers, now=Date.now()) {
  const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,'X-Content-Type-Options':'nosniff'}});
  const action=new URL(request.url).pathname.slice('/api/sharing/'.length);
  const db=env.NOTIFICATIONS_DB;
  if(!db?.prepare || !env.PUSH_RATE_LIMITER?.limit) return reply({error:'写真共有サーバーは準備中です。'},503);
  try {
    // A missing migration must be an honest unavailable state, never a sample feed.
    await db.prepare('SELECT id FROM public_photos LIMIT 1').first();
    if(action==='config' && request.method==='GET') return reply({enabled:true,audience:'public',retentionDays:30,maxImageBytes:MAX_AI_IMAGE_BYTES});
    if(!['profile','feed','publish','delete','detail','stamp','comment','delete-comment','report'].includes(action)) throw new PublicError(404,'共有APIが見つかりません。');
    if(request.method!=='POST') throw new PublicError(405,'POSTで送信してください。');
    if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) throw new PublicError(415,'JSONで送信してください。');
    const input=await boundedJSON(request,400*1024);
    if(!input || typeof input!=='object' || Array.isArray(input)) throw new PublicError(400,'入力内容を確認してください。');
    const ip=request.headers.get('CF-Connecting-IP') || 'local';
    const limited=await env.PUSH_RATE_LIMITER.limit({key:`photos:${['feed','detail'].includes(action)?'read':'write'}:${ip}`});
    if(!limited.success) throw new PublicError(429,'少し時間をおいてから再試行してください。');
    const {day}=japanTime(now);
    if(action==='profile') {
      if(!ID.test(input.identity?.id || '') || !/^[A-Za-z0-9_-]{43}$/.test(input.identity?.token || '')) throw new PublicError(400,'登録情報が不正です。');
      const name=text(input.name,20);
      if(!name) throw new PublicError(400,'表示名を入力してください。');
      const tokenHash=await hash(input.identity.token);
      const result=await db.prepare(`INSERT INTO photo_members (id,token_hash,name,created_at)
        SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM photo_members)<500 OR EXISTS(SELECT 1 FROM photo_members WHERE id=?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name WHERE photo_members.token_hash=excluded.token_hash`)
        .bind(input.identity.id,tokenHash,name,now,input.identity.id).run();
      if(!result.meta.changes) throw new PublicError(403,'登録を確認できないか、利用上限に達しています。');
      return reply({member:await identity(db,input.identity)});
    }
    const member=await identity(db,input.identity,!['feed','detail'].includes(action));
    if(action==='feed') {
      let cursor=null;
      if(input.cursor) {
        if(!PHOTO.test(input.cursor.id || '') || !Number.isSafeInteger(input.cursor.createdAt)) throw new PublicError(400,'続きの指定が不正です。');
        cursor=input.cursor;
      }
      const {results}=await db.prepare(`SELECT p.id,p.member_id,p.day,p.topic_id,p.image,p.caption,p.created_at,p.updated_at,m.name,
        (SELECT COUNT(*) FROM photo_stamps s WHERE s.photo_id=p.id) AS stamp_count,
        (SELECT COUNT(*) FROM photo_comments c WHERE c.photo_id=p.id) AS comment_count
        FROM public_photos p JOIN photo_members m ON m.id=p.member_id
        WHERE p.day=? AND (? IS NULL OR p.created_at < ? OR (p.created_at=? AND p.id < ?))
        ORDER BY p.created_at DESC,p.id DESC LIMIT 13`).bind(day,cursor?.createdAt??null,cursor?.createdAt??null,cursor?.createdAt??null,cursor?.id??'').all();
      const page=results.slice(0,12);
      const posts=page.map(row=>({id:row.id,day:row.day,topicId:row.topic_id,image:row.image,caption:row.caption,createdAt:row.created_at,updatedAt:row.updated_at,name:row.name,own:row.member_id===member?.id,modern:topicById(row.topic_id)?.modern || '',stampCount:row.stamp_count,commentCount:row.comment_count}));
      const last=page.at(-1);
      return reply({day,posts,nextCursor:results.length>12?{id:last.id,createdAt:last.created_at}:null});
    }
    if(action==='publish') {
      if(input.audience!=='public') throw new PublicError(400,'投稿の公開範囲を確認してください。');
      if(input.day!==day) throw new PublicError(409,'日付が変わりました。今日のお題で撮り直してください。');
      const topic=dailyTopic(day);
      if(input.topicId!==topic.id) throw new PublicError(409,'今日のお題を確認してから投稿してください。');
      const caption=text(input.caption??'',120);
      try{decodeImageData(input.image,MAX_AI_IMAGE_BYTES);}catch{throw new PublicError(400,'写真を読み込めません。撮り直してから投稿してください。');}
      const id=await hash(`${member.id}:${day}`);
      await db.prepare(`INSERT INTO public_photos (id,member_id,day,topic_id,image,caption,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)
        ON CONFLICT(member_id,day) DO UPDATE SET topic_id=excluded.topic_id,image=excluded.image,caption=excluded.caption,updated_at=excluded.updated_at`)
        .bind(id,member.id,day,topic.id,input.image,caption,now,now).run();
      return reply({published:true,id,day,updatedAt:now});
    }
    const post=await photo(db,input.photoId);
    if(action==='detail') {
      const stamps=(await db.prepare('SELECT stamp,COUNT(*) AS count FROM photo_stamps WHERE photo_id=? GROUP BY stamp').bind(post.id).all()).results;
      const mine=member?(await db.prepare('SELECT stamp FROM photo_stamps WHERE photo_id=? AND member_id=?').bind(post.id,member.id).all()).results.map(row=>row.stamp):[];
      const comments=(await db.prepare(`SELECT c.id,c.member_id,c.text,c.created_at,m.name FROM photo_comments c JOIN photo_members m ON m.id=c.member_id WHERE c.photo_id=? ORDER BY c.created_at,c.id LIMIT 100`).bind(post.id).all()).results.map(row=>({id:row.id,text:row.text,name:row.name,createdAt:row.created_at,own:row.member_id===member?.id}));
      return reply({stamps,mine,comments});
    }
    if(action==='delete') {
      if(post.member_id!==member.id) throw new PublicError(403,'自分の投稿だけ削除できます。');
      // Explicit deletes also work with SQLite foreign_keys disabled in D1 sessions.
      await db.batch([
        db.prepare('DELETE FROM photo_stamps WHERE photo_id=?').bind(post.id),
        db.prepare('DELETE FROM photo_comments WHERE photo_id=?').bind(post.id),
        db.prepare('DELETE FROM photo_reports WHERE photo_id=?').bind(post.id),
        db.prepare('DELETE FROM public_photos WHERE id=? AND member_id=?').bind(post.id,member.id),
      ]);
      return reply({deleted:true});
    }
    if(action==='stamp') {
      if(!STAMPS.has(input.stamp) || typeof input.active!=='boolean') throw new PublicError(400,'スタンプの指定が不正です。');
      if(input.active) await db.prepare('INSERT OR IGNORE INTO photo_stamps VALUES (?,?,?)').bind(post.id,member.id,input.stamp).run();
      else await db.prepare('DELETE FROM photo_stamps WHERE photo_id=? AND member_id=? AND stamp=?').bind(post.id,member.id,input.stamp).run();
      return reply({saved:true});
    }
    if(action==='comment') {
      if(!ID.test(input.commentId || '')) throw new PublicError(400,'ひとことの指定が不正です。');
      const body=text(input.text,120);if(!body) throw new PublicError(400,'ひとことを入力してください。');
      const existing=await db.prepare('SELECT member_id,photo_id,text FROM photo_comments WHERE id=?').bind(input.commentId).first();
      if(existing) {
        if(existing.member_id!==member.id || existing.photo_id!==post.id || existing.text!==body) throw new PublicError(409,'このひとことは送信済みです。');
      } else {
        const result=await db.prepare(`INSERT INTO photo_comments (id,photo_id,member_id,text,created_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM photo_comments WHERE photo_id=?)<100`).bind(input.commentId,post.id,member.id,body,now,post.id).run();
        if(!result.meta.changes) throw new PublicError(409,'この写真へのひとことは上限に達しました。');
      }
      return reply({saved:true});
    }
    if(action==='delete-comment') {
      if(!ID.test(input.commentId || '')) throw new PublicError(400,'ひとことの指定が不正です。');
      await db.prepare('DELETE FROM photo_comments WHERE id=? AND photo_id=? AND member_id=?').bind(input.commentId,post.id,member.id).run();
      return reply({deleted:true});
    }
    if(action==='report') {
      await db.prepare('INSERT OR IGNORE INTO photo_reports VALUES (?,?,?)').bind(post.id,member.id,now).run();
      return reply({reported:true});
    }
  } catch(error) {
    const status=error instanceof PublicError?error.status:([400,413].includes(error?.status)?error.status:503);
    return reply({error:error instanceof PublicError?error.message:status===413?'写真のサイズが大きすぎます。':'写真共有の処理を完了できませんでした。サーバーの設定または通信状態を確認してください。'},status);
  }
}
export async function expirePublicPhotos(env,now=Date.now()) {
  if(!env.NOTIFICATIONS_DB?.prepare) return;
  const cutoff=japanTime(now-30*86400000).day;
  const db=env.NOTIFICATIONS_DB;
  await db.batch([
    db.prepare('DELETE FROM photo_stamps WHERE photo_id IN (SELECT id FROM public_photos WHERE day < ?)').bind(cutoff),
    db.prepare('DELETE FROM photo_comments WHERE photo_id IN (SELECT id FROM public_photos WHERE day < ?)').bind(cutoff),
    db.prepare('DELETE FROM photo_reports WHERE photo_id IN (SELECT id FROM public_photos WHERE day < ?)').bind(cutoff),
    db.prepare('DELETE FROM public_photos WHERE day < ?').bind(cutoff),
  ]);
}
