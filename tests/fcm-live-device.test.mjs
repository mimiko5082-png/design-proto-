import test from 'node:test';
import assert from 'node:assert/strict';
import {withLiveDevice} from '../firebase/functions/live-device.mjs';
import {deliverDevice} from '../firebase/functions/delivery.mjs';
function coldDevice(value){
 let cached=null,watching=false,detached=0;
 return {on(event,listener){assert.equal(event,'value');watching=true;queueMicrotask(()=>{cached=structuredClone(value);listener({val:()=>cached});});},off(){watching=false;cached=null;detached++;},get detached(){return detached;},
 async transaction(update){const result=update(watching?structuredClone(cached):null);if(result===undefined)return {committed:false};value=structuredClone(result);cached=structuredClone(result);return {committed:true,snapshot:{val:()=>result}};}};
}
test('a guarded transaction waits for the server value on a cold process',async()=>{
 const ref=coldDevice({enabled:true,uid:'alice'});
 assert.equal((await ref.transaction(value=>value?.enabled?{...value,testAt:123}:undefined)).committed,false);
 const result=await withLiveDevice(ref,()=>ref.transaction(value=>value?.enabled?{...value,testAt:123}:undefined));
 assert.equal(result.committed,true);assert.equal(result.snapshot.val().testAt,123);assert.equal(ref.detached,1);
});
test('scheduled delivery sends and records its acknowledgement before dropping a cold cache',async()=>{
 const record={enabled:true,uid:'alice',token:'mock-token',updatedAt:1000},ref=coldDevice(record);let sent=0;
 const options={clock:()=>1000,send:async()=>sent++};
 assert.equal(await deliverDevice(ref,record,'morning','2026-11-17',options),'sent');
 assert.equal(await deliverDevice(ref,record,'morning','2026-11-17',options),'skipped');
 assert.equal(sent,1);assert.equal(ref.detached,2);
});
test('listener failure, timeout and operation failure all release the watch',async()=>{
 let off=0;
 const timeout={on(){},off(){off++;}};
 await assert.rejects(withLiveDevice(timeout,()=>assert.fail('must not start'),5),error=>error.code==='fcm/device-timeout');
 const failed={on(event,listener,reject){reject(new Error('network'));},off(){off++;}};
 await assert.rejects(withLiveDevice(failed,()=>assert.fail('must not start')),/network/);
 const ref=coldDevice({enabled:true});await assert.rejects(withLiveDevice(ref,()=>{throw new Error('send failed');}),/send failed/);
 assert.equal(off,2);assert.equal(ref.detached,1);
});
