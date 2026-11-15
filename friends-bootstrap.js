import { friendsSession, pendingInvite } from './firebase-friends.js';
// Prepare Google authentication before the user opens the sign-in popup.
friendsSession().catch(() => {});
// An invitation opens the participation screen after the application is ready.
window.addEventListener('load', () => {
  if (pendingInvite()) window.dispatchEvent(new Event('basho-show-posts'));
});
