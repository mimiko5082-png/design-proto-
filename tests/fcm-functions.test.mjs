import test from 'node:test';
import assert from 'node:assert/strict';
// Import installed production entry point: auth failures must stop before any Admin call.
let functions;
try{functions=await import('../firebase/functions/index.mjs');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
test('FCM callable endpoints reject anonymous/non-Google callers and invalid device IDs', {skip:!functions},async()=>{
 for(const name of ['fcmRegisterDevice','fcmDeviceStatus','fcmDisableDevice','fcmTestNotification']){
  for(const auth of [null,{uid:'eve',token:{firebase:{sign_in_provider:'password'}}}]){
   await assert.rejects(functions[name].run({auth,data:{deviceId:'a'.repeat(32)}}),error=>error.code==='unauthenticated');
  }
  await assert.rejects(functions[name].run({auth:{uid:'alice',token:{firebase:{sign_in_provider:'google.com'}}},data:{deviceId:'../alice'}}),error=>error.code==='invalid-argument');
 }
 await assert.rejects(functions.fcmRegisterDevice.run({auth:{uid:'alice',token:{firebase:{sign_in_provider:'google.com'}}},data:{deviceId:'a'.repeat(32),token:'bad'}}),error=>error.code==='invalid-argument');
 for(const delaySeconds of [-1,1,11,600,'10'])await assert.rejects(functions.fcmTestNotification.run({auth:{uid:'alice',token:{firebase:{sign_in_provider:'google.com'}}},data:{deviceId:'a'.repeat(32),delaySeconds}}),error=>error.code==='invalid-argument');
});
