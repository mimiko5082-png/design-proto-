import test from 'node:test';
import assert from 'node:assert/strict';
import { postDate, postcardMarkup } from '../photo-postcard.js';
test('postcard date is the original saved timestamp in Japan, with day fallback for old records',()=>{
 assert.equal(postDate({createdAt:Date.parse('2026-10-29T08:29:00Z')}),'2026.10.29 17:29');
 assert.equal(postDate({day:'2026-10-29'}),'2026.10.29');
 assert.equal(postDate({day:'2026-10-29',createdAt:null}),'2026.10.29');
});
test('framed cards preserve photograph, caption and prompt as text, never executable markup',()=>{
 const html=postcardMarkup({image:'data:image/png;base64,test',day:'2026-10-29',modern:'<光> & 風',caption:'<img src=x onerror=alert(1)>',createdAt:Date.parse('2026-10-29T08:29:00Z')});
 assert.match(html,/&lt;光&gt; &amp; 風/);
 assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
 assert.match(html,/2026\.10\.29 17:29/);
 assert.doesNotMatch(html,/<img src=x/);
});
