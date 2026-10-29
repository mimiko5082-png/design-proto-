import test from 'node:test';
import assert from 'node:assert/strict';
import { colorFamily, dominantPhotoColor, flowerSvg } from '../garden-colors.js';
const pixels=(colors)=>new Uint8ClampedArray(colors.flat());
test('photo colors classify vivid and neutral images without inventing a scene',()=>{
 for(const [r,g,b,id] of [[255,0,0,'red'],[255,140,0,'orange'],[255,240,0,'yellow'],[0,180,0,'green'],[0,90,255,'blue'],[140,0,255,'purple'],[255,180,210,'pink'],[100,60,25,'brown'],[255,255,255,'white'],[128,128,128,'gray'],[0,0,0,'black']]) {
  assert.equal(colorFamily(r,g,b),id);
  assert.equal(dominantPhotoColor(pixels([[r,g,b,255]])).id,id);
 }
});
test('dominant patch keeps broad color, ignores transparent pixels and handles all-white/empty images',()=>{
 assert.equal(dominantPhotoColor(pixels([[0,0,255,255],[255,255,255,255],[255,255,255,255]])).id,'blue');
 assert.equal(dominantPhotoColor(pixels([[255,0,0,0],[0,180,0,255]])).id,'green');
 assert.equal(dominantPhotoColor(pixels([[255,255,255,255]])).hex,'#ffffff');
 assert.equal(dominantPhotoColor(pixels([[255,0,0,0]])),null);
 assert.equal(dominantPhotoColor(pixels([])),null);
 assert.throws(()=>dominantPhotoColor([1,2]));
});
test('flower fill never interpolates an arbitrary CSS/image string',()=>{
 const svg=flowerSvg({hex:'url(https://bad.test)'},'photo');
 assert.doesNotMatch(svg,/bad\.test/);assert.match(svg,/#7a9a65/);
});
