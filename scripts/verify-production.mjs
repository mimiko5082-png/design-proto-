// Compare deployed bytes with this checkout. Never print configuration contents.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base='https://mimiko5082-png.github.io/design-proto-/';
const files=['index.html','reading-garden.js','sharing-calendar.js','firebase-friends.js','public-feed.js','sharing-client.js','friends-bootstrap.js','friends-feed.js','haiku-cards.js','sw.js','fcm-config.js','fcm-service.js','fcm-settings.js','fcm-bootstrap.js','firebase-messaging-sw.js'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const expected=Object.fromEntries(await Promise.all(files.map(async file=>[file,hash(await readFile(new URL('../'+file,import.meta.url)))])));
for(let attempt=1;attempt<=24;attempt++){
  const results=await Promise.all(files.map(async file=>{
    try{
      const url=new URL(file,base);url.search=new URLSearchParams({v:'76',deployment:process.env.GITHUB_SHA||'local'});
      const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});
      return {file,ok:response.ok && hash(Buffer.from(await response.arrayBuffer()))===expected[file]};
    }catch{return {file,ok:false};}
  }));
  const pending=results.filter(result=>!result.ok).map(result=>result.file);
  if(!pending.length){console.log('Verified production release (including FCM): all '+files.length+' deployed files match the tested commit.');process.exit(0);}
  console.log(`Attempt ${attempt}: waiting for matching deployed files: ${pending.join(', ')}`);
  if(attempt<24)await new Promise(resolve=>setTimeout(resolve,10000));
}
throw new Error('Production asset verification did not pass. Do not report the new release as verified.');
