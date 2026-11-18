import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../firebase-messaging-sw.js',import.meta.url),'utf8');
test('FCM worker shows one data notification and restricts clicks to the GitHub Pages app scope',async()=>{
 const shown=[],listeners={},opened=[];let background;
 const self={registration:{scope:'https://mimiko5082-png.github.io/design-proto-/',async showNotification(title,options){shown.push({title,options});}},addEventListener(name,fn){listeners[name]=fn;},clients:{async matchAll(){return [{url:'https://mimiko5082-png.github.io/other/',focus(){assert.fail('other app must not focus');}}];},async openWindow(url){opened.push(url);}}};
 vm.runInNewContext(code,{self,URL,console,importScripts(){},firebase:{initializeApp(){},messaging(){return {onBackgroundMessage(fn){background=fn;}};}}});
 await background({data:{title:'お題',body:'朝のお知らせ',url:'https://evil.example',tag:'morning'}});
 assert.equal(shown.length,1);assert.equal(shown[0].options.data.url,self.registration.scope);assert.equal(shown[0].options.renotify,false);
 assert.equal(shown[0].options.silent,false);assert.deepEqual(Array.from(shown[0].options.vibrate),[200,100,200]);
 // Notification payloads are displayed by Firebase itself; the callback must not duplicate them.
 await background({notification:{title:'朝',body:'お題'},data:{title:'朝',body:'お題'}});
 assert.equal(shown.length,1);
 let finished,stopped=false;listeners.notificationclick({stopImmediatePropagation(){stopped=true;},notification:{close(){}},waitUntil(task){finished=task;}});await finished;
 assert.equal(stopped,true);
 assert.deepEqual(opened,[self.registration.scope]);
});
test('offline Firebase CDN failure retains native FCM data-message delivery',async()=>{
 const listeners={},shown=[];
 const self={registration:{scope:'https://example.com/design-proto-/',async showNotification(title,options){shown.push({title,options});}},addEventListener(name,fn){listeners[name]=fn;}};
 vm.runInNewContext(code,{self,URL,console:{warn(){}},importScripts(){throw new Error('offline');}});
 let done;listeners.push({data:{json:()=>({data:{title:'夜の通知',body:'振り返ってみよう'}})},waitUntil(task){done=task;}});await done;
 assert.equal(shown.length,1);assert.equal(shown[0].title,'夜の通知');
 listeners.push({data:{json:()=>({notification:{title:'朝の通知',body:'お題を見よう'},data:{tag:'morning'}})},waitUntil(task){done=task;}});await done;
 assert.equal(shown.length,2);assert.equal(shown[1].title,'朝の通知');assert.equal(shown[1].options.tag,'morning');
 assert.equal(shown[1].options.silent,false);
});
