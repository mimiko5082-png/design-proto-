// Isolated, explicitly labelled UI demonstration. No network or real people's posts.
import { dailyTopic } from './haiku-catalog.js';
import { japanDay } from './reading-store.js';
const KEY='public_sharing_ui_demo_v1';
function read() {
 const day=japanDay(),value=JSON.parse(localStorage.getItem(KEY)||'null');
 if(value?.day===day)return value;
 const topic=dailyTopic(day),time=Date.now();
 return {day,posts:[
  {id:'a'.repeat(64),memberId:'demo-aoi',day,topicId:topic.id,modern:topic.modern,image:'./assets/kotoba-forest.png',caption:'通り慣れた道にも、こんな緑があった。',name:'あおい（サンプル）',createdAt:time-120000,updatedAt:time-120000},
  {id:'b'.repeat(64),memberId:'demo-haru',day,topicId:topic.id,modern:topic.modern,image:'./assets/kotoba-lake.png',caption:'いつもより少し立ち止まって見てみた。',name:'はる（サンプル）',createdAt:time-240000,updatedAt:time-240000},
 ],details:{}};
}
function detail(state,id){return state.details[id] || (state.details[id]={stamps:[],mine:[],comments:[]});}
export async function demoAPI(action,input={}) {
 const state=read(),member=input.identity;
 if(action==='profile')return {member:{id:member.id,name:input.name.trim()}};
 if(action==='feed')return {day:state.day,posts:state.posts.map(post=>({...post,own:post.memberId===member?.id,stampCount:detail(state,post.id).mine.length,commentCount:detail(state,post.id).comments.length})),nextCursor:null};
 if(action==='publish') {
  const profile=JSON.parse(localStorage.getItem('basho_public_profile_v1')||'null');
  const existing=state.posts.find(post=>post.memberId===member.id),id=existing?.id || member.id.padEnd(64,'0');
  const topic=dailyTopic(state.day),now=Date.now();
  const post={id,memberId:member.id,name:profile.name,day:state.day,topicId:topic.id,modern:topic.modern,image:input.image,caption:input.caption,createdAt:existing?.createdAt || now,updatedAt:now};
  state.posts=[post,...state.posts.filter(post=>post.id!==id)];
  localStorage.setItem(KEY,JSON.stringify(state));return {published:true,id,day:state.day,updatedAt:now};
 }
 const record=state.posts.find(post=>post.id===input.photoId);if(!record)throw Error('このプレビューの投稿が見つかりません。');
 const result=detail(state,record.id);
 if(action==='detail')return result;
 if(action==='stamp') {
  result.mine=result.mine.filter(id=>id!==input.stamp);if(input.active)result.mine.push(input.stamp);
  result.stamps=result.mine.map(stamp=>({stamp,count:1}));
 }
 if(action==='comment') {
  if(!input.text?.trim())throw Error('ひとことを入力してください。');
  const profile=JSON.parse(localStorage.getItem('basho_public_profile_v1')||'null');
  if(!result.comments.some(comment=>comment.id===input.commentId))result.comments.push({id:input.commentId,text:input.text.trim().slice(0,120),name:profile.name,own:true,createdAt:Date.now()});
 }
 if(action==='delete-comment')result.comments=result.comments.filter(comment=>comment.id!==input.commentId);
 if(action==='delete') {if(record.memberId!==member?.id)throw Error('自分の投稿だけ削除できます。');state.posts=state.posts.filter(post=>post.id!==record.id);delete state.details[record.id];}
 localStorage.setItem(KEY,JSON.stringify(state));
 return {saved:true,deleted:action==='delete',reported:action==='report'};
}
