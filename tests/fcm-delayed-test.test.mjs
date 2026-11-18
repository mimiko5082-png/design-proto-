import test from 'node:test';
import assert from 'node:assert/strict';
import {delayedTestRecord} from '../firebase/functions/delayed-test.mjs';

test('background test waits on the server and reads the latest registration before sending',async()=>{
  const record={uid:'alice',enabled:true,token:'mock-token'};let waited=false;
  const ref={get:async()=>{assert.equal(waited,true);return {val:()=>record};}};
  assert.deepEqual(await delayedTestRecord(ref,record,async ms=>{assert.equal(ms,10000);waited=true;}),{record});
});
test('stopping, replacing or transferring a registration during the delay prevents sending',async()=>{
  const record={uid:'alice',enabled:true,token:'mock-token'};
  for(const [latest,reason] of [[null,'FCM_DEVICE_MISSING'],[{...record,enabled:false},'FCM_DEVICE_DISABLED'],[{...record,uid:'bob'},'FCM_DEVICE_ACCOUNT'],[{...record,token:'new-token'},'FCM_TEST_CONFLICT']]){
    const ref={get:async()=>({val:()=>latest})};
    assert.deepEqual(await delayedTestRecord(ref,record,async()=>{}),{reason});
  }
});
