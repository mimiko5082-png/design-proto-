import {setTimeout as sleep} from 'node:timers/promises';

// The server owns the delay: a backgrounded iPhone may suspend page timers.
// Recheck registration after waiting so stopping notifications cancels this send.
export async function delayedTestRecord(ref,record,wait=sleep){
  await wait(10000);
  const current=(await ref.get()).val();
  if(!current)return {reason:'FCM_DEVICE_MISSING'};
  if(current.uid!==record.uid)return {reason:'FCM_DEVICE_ACCOUNT'};
  if(current.enabled!==true)return {reason:'FCM_DEVICE_DISABLED'};
  if(current.token!==record.token)return {reason:'FCM_TEST_CONFLICT'};
  return {record:current};
}
