import { friendsSession, pendingInvite } from './firebase-friends.js?v=76';
// Prepare Google authentication before the user opens the sign-in popup.
if (!window.BASHO_SHARING_DEMO) friendsSession().catch(() => {});
// An invitation opens the participation screen after the application is ready.
window.addEventListener('load', () => {
  if (location.search.includes('calendar=shared')) window.dispatchEvent(new Event('basho-show-calendar'));
  else if (pendingInvite()) window.dispatchEvent(new Event('basho-show-posts'));
});
