import {friendsSession,pendingInvite,refreshFriendsGroup} from './firebase-friends.js?v=78';
pendingInvite(); // Preserve a link before login or navigation can remove its fragment.
if(!window.BASHO_SHARING_DEMO)friendsSession().catch(()=>{});
const openInvitation=()=>{
  if(pendingInvite())window.dispatchEvent(new Event('basho-show-posts'));
  else if(location.search.includes('calendar=shared'))window.dispatchEvent(new Event('basho-show-calendar'));
};
window.addEventListener('load',openInvitation);
window.addEventListener('hashchange',openInvitation);

window.addEventListener('focus',()=>{if(!window.BASHO_SHARING_DEMO)refreshFriendsGroup().catch(()=>{});});
