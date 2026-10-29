import { decodeImageData, MAX_AI_IMAGE_BYTES } from './image-validation.js';
export const escapeText = value => String(value || '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function postDate(card) {
  const time=Number(card.createdAt);
  if(card.createdAt != null && Number.isFinite(time)) {
    const date=new Date(time+9*3600000);
    return `${date.toISOString().slice(0,10).replaceAll('-','.')} ${date.toISOString().slice(11,16)}`;
  }
  return String(card.day || '').replaceAll('-','.');
}
export function postcardMarkup(card, {imageClass='',captionClass='',className=''}={}) {
  const esc=escapeText;
  return `<figure class="photo-postcard ${className}"><img class="postcard-image ${imageClass}" src="${esc(card.image)}" alt="${esc(card.day)}の写真"><figcaption class="postcard-prompt">${esc(card.modern || '')}</figcaption><time class="postcard-date">${esc(postDate(card))}</time>${card.caption?`<p class="postcard-caption ${captionClass}">${esc(card.caption)}</p>`:''}</figure>`;
}
function wrap(ctx,text,width) {
  const lines=[];for(const paragraph of String(text||'').split('\n')) {let line='';for(const char of paragraph){if(line&&ctx.measureText(line+char).width>width){lines.push(line);line=char;}else line+=char;}lines.push(line);}return lines;
}
export async function createPostcardFile(card) {
  decodeImageData(card.image,MAX_AI_IMAGE_BYTES);
  const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Photo unavailable'));img.src=card.image;});
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1800;const ctx=canvas.getContext('2d');
  if(!ctx)throw Error('Canvas unavailable');
  const green='#32b96e',border=24;
  ctx.fillStyle=green;ctx.fillRect(0,0,1080,1800);
  const iw=1080-border*2,ih=1800-border*2;
  ctx.save();ctx.beginPath();ctx.rect(border,border,iw,ih);ctx.clip();
  const scale=Math.max(iw/image.width,ih/image.height),sw=iw/scale,sh=ih/scale;
  ctx.drawImage(image,(image.width-sw)/2,(image.height-sh)/2,sw,sh,border,border,iw,ih);
  const gradient=ctx.createLinearGradient(0,border,0,700);gradient.addColorStop(0,'#050805dd');gradient.addColorStop(1,'#05080500');ctx.fillStyle=gradient;ctx.fillRect(border,border,iw,700);
  ctx.fillStyle=green;ctx.font='bold italic 62px sans-serif';const titleLines=wrap(ctx,card.modern,iw-100);
  for(let i=0;i<titleLines.length;i++)ctx.fillText(titleLines[i],border+42,145+i*86);
  if(card.caption){ctx.font='bold italic 46px sans-serif';const lines=wrap(ctx,card.caption,iw-140);const height=lines.length*65+85;ctx.fillStyle='#090d09ed';ctx.fillRect(border,1800-border-height,iw,height);ctx.fillStyle=green;lines.forEach((line,i)=>ctx.fillText(line,border+42,1800-border-height+65+i*65));}
  ctx.translate(1080-border-30,Math.min(1510,1800-border-60));ctx.rotate(Math.PI/2);ctx.fillStyle=green;ctx.font='bold 25px sans-serif';ctx.fillText(postDate(card),-360,0);ctx.restore();
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('Image export failed')),'image/png'));
  return new File([blob],`basho-post-${card.day}.png`,{type:'image/png'});
}
export function openPostCompletion(card) {
  const dialog=document.createElement('dialog');dialog.className='post-complete-dialog';
  dialog.innerHTML='<h2>今日の投稿を保存しました！</h2><strong>SNSでシェアしませんか？</strong><p>写真・お題・ひとことが入った一枚を、そのまま共有できます。</p><button type="button" class="main-button" data-post-share>シェアする</button><button type="button" class="post-later">あとで</button><p role="status" class="post-share-status"></p>';
  document.body.append(dialog);dialog.showModal();
  const close=()=>{dialog.close();dialog.remove();window.dispatchEvent(new Event('basho-show-posts'));};
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
