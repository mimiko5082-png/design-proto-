// RTDB transactions run against the local cache first. Keep a live value listener
// until the operation finishes so an empty cold-start cache cannot abort a guard.
export async function withLiveDevice(ref,operation,timeoutMs=10000){
  let timer;let listener;
  try{
    await new Promise((resolve,reject)=>{
      listener=()=>{clearTimeout(timer);resolve();};
      timer=setTimeout(()=>reject(Object.assign(new Error('Device lookup timed out'),{code:'fcm/device-timeout'})),timeoutMs);
      ref.on('value',listener,reject);
    });
    return await operation();
  }finally{clearTimeout(timer);if(listener)ref.off('value',listener);}
}
