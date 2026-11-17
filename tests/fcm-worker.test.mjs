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
 let finished;listeners.notificationclick({notification:{close(){}},waitUntil(task){finished=task;}});await finished;
 assert.deepEqual(opened,[self.registration.scope]);
});
test('offline Firebase CDN failure retains native FCM data-message delivery',async()=>{
 const listeners={},shown=[];
 const self={registration:{scope:'https://example.com/design-proto-/',async showNotification(title,options){shown.push({title,options});}},addEventListener(name,fn){listeners[name]=fn;}};
 vm.runInNewContext(code,{self,URL,console:{warn(){}},importScripts(){throw new Error('offline');}});
 let done;listeners.push({data:{json:()=>({data:{title:'夜の通知',body:'振り返ってみよう'}})},waitUntil(task){done=task;}});await done;
 assert.equal(shown.length,1);assert.equal(shown[0].title,'夜の通知');
});
