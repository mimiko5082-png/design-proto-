import test from 'node:test';
import assert from 'node:assert/strict';
import {deliverDevice,sendScheduled,validRegistration,fcmMessage,japanDay,SCHEDULES,DEVICE_TTL,APP_URL} from '../firebase/functions/delivery.mjs';
const token='test-token-'.repeat(8),now=Date.parse('2026-11-16T23:00:00Z');
function memoryRef(record){let value=structuredClone(record);return {on(event,listener){queueMicrotask(listener);},off(){},value:()=>structuredClone(value),async transaction(update){const result=update(structuredClone(value));if(result===undefined)return {committed:false,snapshot:{val:()=>value}};value=structuredClone(result);return {committed:true,snapshot:{val:()=>value}};}};}
const device=()=>({uid:'alice',token,enabled:true,updatedAt:now});
test('FCM schedule is exactly 08:00 and 23:50 in Japan, independent of UTC midnight',()=>{
 assert.equal(SCHEDULES.morning.schedule,'0 8 * * *');assert.equal(SCHEDULES.night.schedule,'50 23 * * *');
 assert.equal(japanDay(Date.parse('2026-11-16T15:00:00Z')),'2026-11-17');
 assert.equal(japanDay(Date.parse('2026-11-16T14:59:59Z')),'2026-11-16');
 const message=fcmMessage(token,'night','2026-11-17');
 assert.equal(message.data.url,APP_URL);assert.equal(message.notification,undefined);assert.equal(message.data.tag,'basho-fcm-2026-11-17-night');
 assert.equal(message.webpush.headers.TTL,'3600');assert.ok(!JSON.stringify(message.data).includes(token));
});
test('device registration validates tokens and rejects traversal and oversized requests',()=>{
 assert.ok(validRegistration({deviceId:'a'.repeat(32),token}));
 for(const data of [{deviceId:'../other',token},{deviceId:'a'.repeat(32),token:'short'},{deviceId:'a'.repeat(32),token:'x'.repeat(4097)},{deviceId:'a'.repeat(32),token:'https://example.com/token'}])assert.equal(validRegistration(data),false);
});
test('parallel retries claim each device once; both slots and the next day still deliver',async()=>{
 const ref=memoryRef(device());let sent=0,release;
 const pending=deliverDevice(ref,device(),'morning','2026-11-17',{clock:()=>now,send:()=>{sent++;return new Promise(resolve=>release=resolve);}});
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(await deliverDevice(ref,device(),'morning','2026-11-17',{clock:()=>now,send:async()=>sent++}),'skipped');
 release();assert.equal(await pending,'sent');
 assert.equal(await deliverDevice(ref,device(),'morning','2026-11-17',{clock:()=>now,send:async()=>sent++}),'skipped');
 await deliverDevice(ref,device(),'night','2026-11-17',{clock:()=>now,send:async()=>sent++});
 await deliverDevice(ref,device(),'morning','2026-11-18',{clock:()=>now,send:async()=>sent++});
 assert.equal(sent,3);
});
test('transient failure is retryable; invalid tokens are deleted; renewed tokens survive stale cleanup',async()=>{
 const ref=memoryRef(device());
 assert.equal(await deliverDevice(ref,device(),'morning','2026-11-17',{clock:()=>now,send:async()=>{throw new Error('network');}}),'failed');
 assert.equal(await deliverDevice(ref,device(),'morning','2026-11-17',{clock:()=>now,send:async()=>{}}),'sent');
 const invalid=memoryRef(device());
 assert.equal(await deliverDevice(invalid,device(),'morning','2026-11-17',{clock:()=>now,send:async()=>{throw {code:'messaging/registration-token-not-registered'};}}),'expired');
 assert.equal(invalid.value(),null);
 const rotated=memoryRef(device());
 await deliverDevice(rotated,device(),'morning','2026-11-17',{clock:()=>now,send:async()=>{await rotated.transaction(current=>({...current,token:'new-token'}));throw {code:'messaging/registration-token-not-registered'};}});
 assert.equal(rotated.value().token,'new-token');
});
test('disabled and stale devices are not sent; abandoned leases expire using actual retry time',async()=>{
 for(const record of [{...device(),enabled:false},{...device(),updatedAt:now-DEVICE_TTL-1}]){
  assert.equal(await deliverDevice(memoryRef(record),record,'morning','2026-11-17',{clock:()=>now,send:()=>assert.fail('must not send')}),'skipped');
 }
 const record={...device(),deliveries:{morning:{day:'2026-11-17',state:'sending',at:now-300001}}};
 assert.equal(await deliverDevice(memoryRef(record),record,'morning','2026-11-17',{clock:()=>now,send:async()=>{}}),'sent');
});
test('scheduled delivery pages through more than 200 devices and retains the intended date on retry',async()=>{
 const records=Array.from({length:205},(_,n)=>({key:String(n).padStart(4,'0'),ref:memoryRef(device()),val:device}));let sent=0;
 const db={ref(path){assert.equal(path,'fcmDevices');let after='';return {orderByKey(){return this;},startAfter(key){after=key;return this;},limitToFirst(size){return {async get(){return {forEach(fn){records.filter(row=>row.key>after).slice(0,size).forEach(fn);}};}};}};}};
 const counts=await sendScheduled(db,async message=>{sent++;assert.equal(message.data.tag,'basho-fcm-2026-11-16-night');},'night',()=>now,Date.parse('2026-11-16T14:50:00Z'));
 assert.equal(sent,205);assert.equal(counts.failed,0);
});
