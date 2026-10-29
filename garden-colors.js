import { decodeImageData, MAX_AI_IMAGE_BYTES } from './image-validation.js';
export const FLOWER_COLORS = [
  {id:'red',name:'あかの花',hint:'赤い看板や、小さな実',color:'#bd5550'},
  {id:'orange',name:'だいだいの花',hint:'夕方の光や、あたたかな色',color:'#dc9555'},
  {id:'yellow',name:'きいろの花',hint:'日だまりや、黄色いもの',color:'#d7bd55'},
  {id:'green',name:'みどりの花',hint:'葉っぱや、道ばたの草',color:'#7a9a65'},
  {id:'blue',name:'あおの花',hint:'空や、水に映った色',color:'#719cba'},
  {id:'purple',name:'むらさきの花',hint:'花びらや、夕暮れの影',color:'#a081b2'},
  {id:'pink',name:'ももいろの花',hint:'やさしい色の花や物',color:'#d5a0ae'},
  {id:'brown',name:'ちゃいろの花',hint:'木の幹や、土の色',color:'#a18163'},
  {id:'white',name:'しろの花',hint:'雲や、白い壁',color:'#eee8d6'},
  {id:'gray',name:'はいいろの花',hint:'石や、曇り空の色',color:'#9c9f96'},
  {id:'black',name:'くろの花',hint:'影や、夜の色',color:'#50564e'},
];
export function colorFamily(r,g,b) {
  const max=Math.max(r,g,b)/255,min=Math.min(r,g,b)/255,delta=max-min,light=(max+min)/2;
  const saturation=delta===0?0:delta/(1-Math.abs(2*light-1));
  if(light<.12) return 'black';
  if(light>.88 && saturation<.22) return 'white';
  if(saturation<.16) return 'gray';
  let hue;
  if(max===r/255) hue=60*(((g-b)/255/delta)%6);
  else if(max===g/255) hue=60*((b-r)/255/delta+2);
  else hue=60*((r-g)/255/delta+4);
  hue=(hue+360)%360;
  if(hue>=15 && hue<70 && light<.43) return 'brown';
  if((hue>=300 || hue<20) && light>.67) return 'pink';
  if(hue<20 || hue>=345) return 'red';
  if(hue<48) return 'orange';
  if(hue<75) return 'yellow';
  if(hue<165) return 'green';
  if(hue<255) return 'blue';
  if(hue<300) return 'purple';
  return 'pink';
}
export function dominantPhotoColor(rgba) {
  if (!rgba || rgba.length%4) throw Error('Invalid pixels');
  const pixels=[];
  for(let i=0;i<rgba.length;i+=4) {
    if(rgba[i+3]<128) continue;
    const rgb=[rgba[i],rgba[i+1],rgba[i+2]];
    pixels.push({rgb,chromatic:Math.max(...rgb)-Math.min(...rgb)>35});
  }
  if(!pixels.length) return null;
  // Keep a broad patch of color from disappearing behind a white sky/background.
  const colorful=pixels.filter(pixel=>pixel.chromatic);
  const candidates=colorful.length>=pixels.length*.2?colorful:pixels;
  const bins=new Map();
  for(const {rgb} of candidates) {
    const key=rgb.map(channel=>Math.floor(channel/32)).join(',');
    const bin=bins.get(key)||{count:0,sum:[0,0,0]};
    bin.count++; rgb.forEach((channel,i)=>bin.sum[i]+=channel);bins.set(key,bin);
  }
  const best=[...bins.values()].sort((a,b)=>b.count-a.count)[0];
  const rgb=best.sum.map(sum=>Math.round(sum/best.count));
  const family=colorFamily(...rgb);
  return {...FLOWER_COLORS.find(color=>color.id===family),hex:'#'+rgb.map(n=>n.toString(16).padStart(2,'0')).join('')};
}
const cache=new Map();
export async function colorFromPhoto(data) {
  if(cache.has(data)) return cache.get(data);
  const task=(async()=>{
    decodeImageData(data,MAX_AI_IMAGE_BYTES);
    const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Photo unavailable'));img.src=data;});
    const canvas=document.createElement('canvas');canvas.width=24;canvas.height=24;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx) throw Error('Canvas unavailable');
    ctx.drawImage(image,0,0,24,24);
    return dominantPhotoColor(ctx.getImageData(0,0,24,24).data);
  })();
  cache.set(data,task);
  if(cache.size>512) cache.delete(cache.keys().next().value);
  try{return await task;}catch(error){cache.delete(data);throw error;}
}
export function flowerSvg(color, label) {
  // Color data is computed from pixels, never from an arbitrary CSS string.
  const hex=/^#[a-f0-9]{6}$/i.test(color.hex)?color.hex:'#7a9a65';
  return `<svg viewBox="0 0 60 80" role="img" aria-label="${label}"><path d="M30 72V36" stroke="#789269" stroke-width="3"/><ellipse cx="21" cy="56" rx="10" ry="4" transform="rotate(30 21 56)" fill="#94aa7c"/>${[0,60,120,180,240,300].map(angle=>`<ellipse cx="30" cy="17" rx="9" ry="12" transform="rotate(${angle} 30 30)" fill="${hex}" stroke="#68775f33"/>`).join('')}<circle cx="30" cy="30" r="7" fill="#f3d887"/></svg>`;
}
