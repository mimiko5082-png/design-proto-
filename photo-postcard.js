import { decodeImageData, MAX_AI_IMAGE_BYTES } from './image-validation.js';
import { topicById } from './haiku-catalog.js';
export const escapeText = value => String(value || '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function postDate(card) {
  const time=Number(card.createdAt);
  if(card.createdAt != null && Number.isFinite(time)) {
    const date=new Date(time+9*3600000);
    return `${date.toISOString().slice(0,10).replaceAll('-','.')} ${date.toISOString().slice(11,16)}`;
  }
  return String(card.day || '').replaceAll('-','.');
}
// The date is split into parts so a frame can set the day large; the text still reads "2026.11.18 19:05".
export function dateMarkup(card, className) {
  const text=postDate(card),match=/^(\d{4})\.(\d{2})\.(\d{2})(?: (\d{2}:\d{2}))?$/.exec(text);
  if(!match) return `<time class="${className}">${escapeText(text)}</time>`;
  const weekday='日月火水木金土'[new Date(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]))).getUTCDay()];
  return `<time class="${className}" aria-label="${text}" data-weekday="${weekday}"><span class="date-year">${match[1]}.</span><span class="date-day"><span class="date-month">${match[2]}</span>.<span class="date-date">${match[3]}</span></span>${match[4]?` <span class="date-time">${match[4]}</span>`:''}</time>`;
}
// The verse is set as three stacked lines (5-7-5) when the topic is known, otherwise as one block.
export const verseLines = (topic, original) => Array.isArray(topic?.lines) && topic.lines.length ? topic.lines : [original || topic?.original || ''].filter(Boolean);
export const verseMarkup = lines => lines.map(line=>`<span>${escapeText(line)}</span>`).join('');
// Longest line in characters: the verse is sized so that this line fills the width beside the date.
export const verseChars = lines => Math.max(1, ...lines.map(line=>Array.from(line).length));
export function postcardMarkup(card, {imageClass='',captionClass='',className=''}={}) {
  const esc=escapeText;
  return `<figure class="photo-postcard ${className}"><img class="postcard-image ${imageClass}" src="${esc(card.image)}" alt="${esc(card.day)}の写真"><figcaption class="postcard-words"><span class="postcard-original" style="--verse-chars:${verseChars(verseLines(topicById(card.topicId),card.original))}">${verseMarkup(verseLines(topicById(card.topicId),card.original))}</span><span class="postcard-prompt">${esc(card.modern || '')}</span></figcaption>${dateMarkup(card,'postcard-date')}${card.caption?`<p class="postcard-caption ${captionClass}">${esc(card.caption)}</p>`:''}</figure>`;
}
function wrap(ctx,text,width) {
  const lines=[];for(const paragraph of String(text||'').split('\n')) {let line='';for(const char of paragraph){if(line&&ctx.measureText(line+char).width>width){lines.push(line);line=char;}else line+=char;}lines.push(line);}return lines;
}
export async function createPostcardFile(card) {
  decodeImageData(card.image,MAX_AI_IMAGE_BYTES);
  const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Photo unavailable'));img.src=card.image;});
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1800;const ctx=canvas.getContext('2d');
  if(!ctx)throw Error('Canvas unavailable');
  // Same poster frame as on screen: thick green border, every word in the border's colour,
  // heavy italic, no shadow, set against the edge.
  const green='#32b96e',W=1080,H=1800,border=Math.round(W*.03),iw=W-border*2,ih=H-border*2;
  const face='-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif';
  const type=(size,spacing=0)=>{ctx.font=`italic 900 ${size}px ${face}`;if('letterSpacing' in ctx)ctx.letterSpacing=`${(spacing*size).toFixed(1)}px`;};
  ctx.fillStyle=green;ctx.fillRect(0,0,W,H);
  ctx.save();ctx.beginPath();ctx.rect(border,border,iw,ih);ctx.clip();
  const scale=Math.max(iw/image.width,ih/image.height),sw=iw/scale,sh=ih/scale;
  ctx.drawImage(image,(image.width-sw)/2,(image.height-sh)/2,sw,sh,border,border,iw,ih);
  const top=ctx.createLinearGradient(0,border,0,border+ih*.4);top.addColorStop(0,'#00000073');top.addColorStop(1,'#00000000');ctx.fillStyle=top;ctx.fillRect(border,border,iw,ih*.4);
  const foot=ctx.createLinearGradient(0,border+ih*.6,0,H-border);foot.addColorStop(0,'#00000000');foot.addColorStop(1,'#0000008c');ctx.fillStyle=foot;ctx.fillRect(border,border+ih*.6,iw,ih*.4);
  ctx.fillStyle=green;ctx.textBaseline='top';
  const dateColumn=182,verse=verseLines(topicById(card.topicId),card.original),verseSize=Math.min((iw-dateColumn)/(verseChars(verse)*.957),155);
  let y=border-verseSize*.04;
  type(verseSize,-.045);for(const line of verse){ctx.fillText(line,border,y);y+=verseSize*1.04;}
  type(47,-.01);y+=26;for(const line of wrap(ctx,card.modern,iw-dateColumn-10)){ctx.fillText(line,border+8,y);y+=47*1.32;}
  if(card.caption){type(66,-.02);const lines=wrap(ctx,card.caption,iw-dateColumn);let cy=H-border-12-lines.length*66*1.22;for(const line of lines){ctx.fillText(line,border+8,cy);cy+=66*1.22;}}
  // The date runs down the right edge, the day set large.
  const stamp=/^(\d{4})\.(\d{2})\.(\d{2})(?: (\d{2}:\d{2}))?$/.exec(postDate(card));
  ctx.translate(W-border,border);ctx.rotate(Math.PI/2);
  let x=4;
  if(stamp){
    const weekday='日月火水木金土'[new Date(Date.UTC(Number(stamp[1]),Number(stamp[2])-1,Number(stamp[3]))).getUTCDay()];
    for(const [text,size] of [[stamp[1]+'.',44],[`${stamp[2]}.${stamp[3]}`,144],[stamp[4]||'',44],[weekday,44]]){
      if(!text)continue;type(size,size>100?-.04:.02);ctx.fillText(text,x,size>100?-6:(144-size)/2);x+=ctx.measureText(text).width+24;
    }
  }else{type(44,.02);ctx.fillText(postDate(card),x,0);}
  ctx.restore();
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('Image export failed')),'image/png'));
  return new File([blob],`basho-post-${card.day}.png`,{type:'image/png'});
}
export function openPostCompletion(card, {published=false}={}) {
  const dialog=document.createElement('dialog');dialog.className='post-complete-dialog';
  dialog.innerHTML='<h2>今日の投稿を保存しました！</h2><strong>SNSでシェアしませんか？</strong><p>写真・お題・ひとことが入った一枚を、そのまま共有できます。</p><button type="button" class="main-button" data-post-share>シェアする</button><button type="button" class="post-later">あとで</button><p role="status" class="post-share-status"></p>';
  if(published) dialog.querySelector('h2').textContent='写真を友達に共有しました！';
  document.body.append(dialog);dialog.showModal();
  const close=()=>{dialog.close();dialog.remove();};
  dialog.querySelector('.post-later').addEventListener('click',close);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.querySelector('[data-post-share]').addEventListener('click',async event=>{
    event.target.disabled=true;
    try {
      const file=await createPostcardFile(card);
      if(navigator.share&&navigator.canShare?.({files:[file]}))await navigator.share({title:'今日のまなざし',files:[file]});
      else {const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
      close();
    } catch(error) {if(error.name!=='AbortError')dialog.querySelector('.post-share-status').textContent='画像を作れませんでした。もう一度お試しください。';}
    finally {if(dialog.isConnected)event.target.disabled=false;}
  });
  return dialog;
}
