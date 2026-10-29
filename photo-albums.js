import { validDay } from './reading-store.js';
import { decodeImageData, MAX_AI_IMAGE_BYTES } from './image-validation.js';

// One photo per saved Japanese day. Seven days need not be consecutive.
// These are derived views: no duplicate photo records or extra growth awards.
export function buildPhotoAlbums(cards) {
  const days = new Map();
  const sorted = [...cards].filter(card => card && validDay(card.day) && typeof card.image === 'string' && card.image.length > 0)
    .sort((a,b) => a.day.localeCompare(b.day) || (Number(a.createdAt)||0)-(Number(b.createdAt)||0) || String(a.id).localeCompare(String(b.id)));
  for (const card of sorted) days.set(card.day,card);
  const photos = [...days.values()];
  const albums = [];
  for (let i=0; i+7<=photos.length; i+=7) {
    const pages = photos.slice(i,i+7);
    albums.push({ id: pages[0].id, number: albums.length+1, start: pages[0].day, end: pages[6].day, photos: pages });
  }
  return { photos, albums, pending: photos.slice(albums.length*7), remaining: 7-(photos.length%7) };
}
function linesFor(ctx, text, maxWidth) {
  const lines=[];
  for (const paragraph of String(text).split('\n')) {
    let line='';
    for (const char of paragraph) {
      if (line && ctx.measureText(line+char).width>maxWidth) { lines.push(line); line=char; }
      else line+=char;
    }
    lines.push(line);
  }
  return lines;
}
function loadImage(data) {
  // Saved image data only. Never request remote images while exporting a book.
  decodeImageData(data,MAX_AI_IMAGE_BYTES);
  return new Promise((resolve,reject)=>{
    const image = new Image();
    image.onload=()=>resolve(image); image.onerror=()=>reject(Error('Photo load failed'));
    image.src=data;
  });
}
export async function makeAlbumImage(album) {
  if (!album || album.photos.length!==7) throw Error('Seven photos are required');
  const images=await Promise.all(album.photos.map(card=>loadImage(card.image)));
  const canvas=document.createElement('canvas'); const ctx=canvas.getContext('2d');
  if (!ctx) throw Error('Canvas unavailable');
  const width=1400, margin=60, gap=36, cardWidth=(width-margin*2-gap)/2, imageHeight=350, textWidth=cardWidth-44;
  ctx.font='24px sans-serif';
  const pages=album.photos.map(card=>{
    const prompt=linesFor(ctx,card.modern || card.lines?.join(' ') || '',textWidth);
    const reflection=linesFor(ctx,card.reflection || '気づきのメモはありません。',textWidth);
    return {prompt,reflection,height:imageHeight+136+(prompt.length+reflection.length)*34};
  });
  const rows=Array.from({length:4},(_,i)=>Math.max(...pages.slice(i*2,i*2+2).map(page=>page.height)));
  canvas.width=width; canvas.height=260+rows.reduce((sum,h)=>sum+h+gap,0)+70;
  ctx.fillStyle='#f4efdf'; ctx.fillRect(0,0,width,canvas.height);
  ctx.fillStyle='#344c36'; ctx.font='bold 44px sans-serif'; ctx.fillText(`まなざしの写真帖 · 第${album.number}冊`,margin,86);
  ctx.font='26px sans-serif'; ctx.fillText(`${album.start} 〜 ${album.end} ／ 7枚の写真と気づき`,margin,140);
  ctx.font='23px sans-serif'; ctx.fillText('いつもの日常で、こんなものを見つけた。',margin,188);
  let y=240;
  for (let row=0;row<4;row++) {
    for (let col=0;col<2;col++) {
      const i=row*2+col; if(i>=7) continue;
      const x=margin+col*(cardWidth+gap), photo=images[i], page=pages[i];
      ctx.fillStyle='#fffdf6';ctx.fillRect(x,y,cardWidth,rows[row]);
      const scale=Math.max(cardWidth/photo.width,imageHeight/photo.height), cropWidth=cardWidth/scale,cropHeight=imageHeight/scale;
      ctx.drawImage(photo,(photo.width-cropWidth)/2,(photo.height-cropHeight)/2,cropWidth,cropHeight,x,y,cardWidth,imageHeight);
      ctx.fillStyle='#63745a'; ctx.font='22px sans-serif';ctx.fillText(`${i+1} / 7 · ${album.photos[i].day}`,x+22,y+imageHeight+40);
      ctx.fillStyle='#344c36';ctx.font='24px sans-serif';let textY=y+imageHeight+82;
      for(const line of page.prompt){ctx.fillText(line,x+22,textY);textY+=34;}
      ctx.fillStyle='#68765f';ctx.font='20px sans-serif';ctx.fillText('いつもは気づかなかったこと',x+22,textY+16);textY+=52;
      ctx.fillStyle='#344c36';ctx.font='24px sans-serif';
      for(const line of page.reflection){ctx.fillText(line,x+22,textY);textY+=34;}
    }
    y+=rows[row]+gap;
  }
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Image export failed')),'image/jpeg',0.92));
}
