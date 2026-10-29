// Preview interactions are local only and scoped to a post's Japanese day + topic.
export const REACTIONS = [
  { id: 'view', emoji: '👀', label: 'その見方すき' },
  { id: 'same', emoji: '🌱', label: '同じの見つけた' },
  { id: 'aha', emoji: '💡', label: 'なるほど！' },
  { id: 'heart', emoji: '💚', label: 'すてき' },
  { id: 'clap', emoji: '👏', label: 'いい発見' },
  { id: 'sparkle', emoji: '✨', label: 'きらきら' },
  { id: 'smile', emoji: '☺️', label: 'ほっこり' },
  { id: 'flower', emoji: '🌸', label: '季節を感じた' },
];
const keyFor = (day, topicId, postId) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^[a-z0-9-]{1,80}$/.test(topicId) || !/^sample-[a-z0-9-]{1,80}$/.test(postId)) throw Error('Invalid photo');
  return `basho_friend_preview_v1:${day}:${topicId}:${postId}`;
};
export function loadReactions(storage, day, topicId, postId) {
  const raw = storage.getItem(keyFor(day, topicId, postId));
  if (!raw) return { stamps: [], comments: [] };
  const value = JSON.parse(raw);
  if (!value || !Array.isArray(value.stamps) || !Array.isArray(value.comments)) throw Error('Invalid reactions');
  if (value.stamps.some(id => !REACTIONS.some(stamp => stamp.id === id)) || new Set(value.stamps).size !== value.stamps.length) throw Error('Invalid stamps');
  if (value.comments.length > 30 || value.comments.some(item => typeof item.id !== 'string' || typeof item.text !== 'string' || !item.text.trim() || item.text.length > 120)) throw Error('Invalid comments');
  return value;
}
export function toggleReaction(storage, day, topicId, postId, stampId) {
  if (!REACTIONS.some(stamp => stamp.id === stampId)) throw Error('Unknown reaction');
  const value = loadReactions(storage, day, topicId, postId);
  value.stamps = value.stamps.includes(stampId) ? value.stamps.filter(id => id !== stampId) : [...value.stamps, stampId];
  storage.setItem(keyFor(day, topicId, postId), JSON.stringify(value));
  return value;
}
export function addComment(storage, day, topicId, postId, text) {
  if (typeof text !== 'string' || !text.trim() || text.length > 120) throw Error('ひとことは1〜120文字で入力してください。');
  const value = loadReactions(storage, day, topicId, postId);
  if (value.comments.length >= 30) throw Error('この写真へのひとことは30件までです。');
  value.comments.push({ id: crypto.randomUUID(), text: text.trim() });
  storage.setItem(keyFor(day, topicId, postId), JSON.stringify(value));
  return value;
}
export function removeComment(storage, day, topicId, postId, id) {
  const value = loadReactions(storage, day, topicId, postId);
  value.comments = value.comments.filter(comment => comment.id !== id);
  storage.setItem(keyFor(day, topicId, postId), JSON.stringify(value));
  return value;
}
