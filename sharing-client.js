import * as demo from './legacy-sharing-client.js';
import { firebaseSharingAPI, friendsProfile, friendsSignIn, friendlyError } from './firebase-friends.js';
export { FriendsError as SharingError } from './firebase-friends.js';
export function sharingProfile(){return window.BASHO_SHARING_DEMO?demo.sharingProfile():friendsProfile();}
export async function sharingAPI(action,data={}){return window.BASHO_SHARING_DEMO?demo.sharingAPI(action,data):firebaseSharingAPI(action,data);}
export async function registerSharingProfile(name){return window.BASHO_SHARING_DEMO?demo.registerSharingProfile(name):friendsSignIn();}
export async function ensureSharingProfile(){
  if(window.BASHO_SHARING_DEMO)return demo.ensureSharingProfile();
  try{return await friendsSignIn();}catch(error){throw friendlyError(error);}
}
export async function publishCard(card){
  if(!await ensureSharingProfile())return false;
  return sharingAPI('publish',{day:card.day,topicId:card.topicId,image:card.image,caption:card.caption||''});
}
