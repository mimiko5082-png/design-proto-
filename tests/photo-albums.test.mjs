import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhotoAlbums } from '../photo-albums.js';
const card = (n) => ({ id: `photo-${n}`, day: new Date(Date.UTC(2026,9,1)+n*2*86400000).toISOString().slice(0,10), image:'data:image/png;base64,test', createdAt:n });
test('seven distinct saved days unlock one album, with no consecutive-day requirement', () => {
  assert.deepEqual(buildPhotoAlbums([]), { photos:[],albums:[],pending:[],remaining:7 });
  const six=Array.from({length:6},(_,i)=>card(i));
  assert.equal(buildPhotoAlbums(six).remaining,1);
  const result=buildPhotoAlbums([...six,card(6)]);
  assert.equal(result.albums.length,1); assert.equal(result.pending.length,0);
  assert.equal(result.remaining,7); assert.equal(result.albums[0].photos.length,7);
  assert.equal(result.albums[0].start,'2026-10-01'); assert.equal(result.albums[0].end,'2026-10-13');
});
test('sorting, same-day replacements and extra photos cannot duplicate pages or change album identity', () => {
  const originals=Array.from({length:14},(_,i)=>card(i));
  const replacement={...card(3),id:'replacement',createdAt:99,image:'updated',reflection:'新しい気づき'};
  const result=buildPhotoAlbums([...originals].reverse().concat(replacement));
  assert.equal(result.photos.length,14); assert.equal(result.albums.length,2);
  assert.equal(result.albums[0].id,originals[0].id);
  assert.equal(result.albums[0].photos[3].image,'updated');
  assert.equal(result.albums[0].photos[3].reflection,'新しい気づき');
  assert.equal(originals[3].image,'data:image/png;base64,test');
  assert.equal(buildPhotoAlbums([...originals,card(14)]).remaining,6);
});
test('missing or invalid saved dates and missing photos never unlock an album', () => {
  assert.equal(buildPhotoAlbums([null,{day:'2026-02-30',image:'test'},{day:'2026-10-01'},{day:'2026-10-01',image:''},{}]).photos.length,0);
});
