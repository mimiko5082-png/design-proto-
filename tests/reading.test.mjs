import test from 'node:test';
import assert from 'node:assert/strict';
import { japanDay, savePoem, loadPoems, growth, monthCells, shiftMonth, POEMS_KEY } from '../reading-store.js';
function storage() { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key,value) => data.set(key,value) }; }
test('only explicitly composed poems are recorded, with chosen date and duplicate protection', () => {
  const s = storage();
  s.setItem('basho_reading_v1', JSON.stringify({version:1,reads:[{day:'2026-10-20',poemId:'hyakunin-1'}]}));
  assert.deepEqual(loadPoems(s), []);
  assert.equal(japanDay(new Date('2026-10-19T15:01:00Z')), '2026-10-20');
  assert.equal(savePoem(s, {text:' 木の影が\n朝の歩道に伸びている ',day:'2026-10-20'}).added,true);
  assert.equal(savePoem(s, {text:'木の影が\n朝の歩道に伸びている',day:'2026-10-20'}).added,false);
  assert.equal(savePoem(s, {text:'夕焼けの短歌',day:'2026-10-20'}).added,true);
  assert.equal(savePoem(s, {text:'別の日の短歌',day:'2026-10-19'}).added,true);
  assert.deepEqual(loadPoems(s).map(p=>p.day), ['2026-10-20','2026-10-20','2026-10-19']);
  assert.equal(loadPoems(s)[0].text,'木の影が\n朝の歩道に伸びている');
  assert.equal(growth(loadPoems(s)).xp,3);
  assert.equal(growth([{day:'2026-10-20',poemId:'hyakunin-1'}]).xp,0);
});
test('invalid input and failed writes do not award growth', () => {
  const s = storage();
  for (const poem of [{text:'  ',day:'2026-10-20'}, {text:'歌',day:'2026-02-30'}, {text:'歌'.repeat(501),day:'2026-10-20'}]) assert.throws(()=>savePoem(s,poem));
  s.setItem = () => {throw Error('quota');};
  assert.throws(()=>savePoem(s,{text:'短歌',day:'2026-10-20'}));
  assert.deepEqual(loadPoems(s),[]);
});
test('corrupt or unsupported history is never overwritten', () => {
  const s=storage();
  for(const raw of ['{bad', '{"version":2,"poems":[]}', '{"version":1,"poems":[{"id":"a","day":"2026-02-30","text":"歌"}]}']) {
    s.setItem(POEMS_KEY,raw);
    assert.throws(()=>savePoem(s,{text:'短歌',day:'2026-10-20'}));
    assert.equal(s.getItem(POEMS_KEY),raw);
  }
});
test('calendar handles leap days and year rollover', () => {
  assert.equal(monthCells('2024-02')[4],'2024-02-01');
  assert.equal(monthCells('2024-02').at(-1),'2024-02-29');
  assert.equal(shiftMonth('2026-12',1),'2027-01');
  assert.equal(shiftMonth('2026-01',-1),'2025-12');
});
test('growth advances at each five composed poems and stops at the tree', () => {
  const poems=Array.from({length:35},(_,i)=>({id:String(i),day:'2026-10-20',text:`短歌${i}`}));
  const names=['まなざしの種','小さな芽','ひらく双葉','風にゆれる若木','花咲く木','実りの木','まなざしの大樹'];
  for(let count=0;count<=35;count++) {
    const result=growth(poems.slice(0,count));
    const level=Math.min(6,Math.floor(count/5));
    assert.equal(result.xp,count);
    assert.equal(result.stage.name,names[level]);
    assert.equal(result.next?.xp??null,level<6?(level+1)*5:null);
  }
  assert.equal(growth([poems[0],poems[0]]).xp,1);
});
