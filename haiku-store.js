import { decodeImageData, MAX_AI_IMAGE_BYTES } from './image-validation.js';
import { topicById, validateHaiku } from './haiku-catalog.js';
import { japanDay, validDay } from './reading-store.js';
const DB_NAME = 'basho-haiku-cards';
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('cards', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Database blocked'));
  });
}
export function makeCard(draft, lines, now = new Date()) {
  validateHaiku({ lines, observed: draft.observed || "自分の観察から作成" });
  if (draft.aiLines) validateHaiku({ lines: draft.aiLines, observed: draft.observed || "固定の創作例" });
  if (!topicById(draft.topicId) || !validDay(draft.topicDay) || typeof draft.id !== 'string' || !draft.id) throw new Error('Invalid draft');
  decodeImageData(draft.image, MAX_AI_IMAGE_BYTES);
  return { id: draft.id, day: japanDay(now), topicId: draft.topicId, topicDay: draft.topicDay, lines: lines.map(line=>line.trim()), aiLines: draft.aiLines ? [...draft.aiLines] : null, creation: draft.creation || 'photo-ai', modern: draft.creation === 'photo-challenge' ? topicById(draft.topicId).modern : null, observed: draft.observed || '', image: draft.image, createdAt: now.getTime(), edited: !!draft.aiLines && lines.map(line=>line.trim()).join('\n') !== draft.aiLines.join('\n') };
}
export async function loadCards() {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('cards', 'readonly');
      const request = tx.objectStore('cards').getAll();
      tx.oncomplete = () => resolve(request.result.sort((a,b)=>b.createdAt-a.createdAt));
      tx.onabort = tx.onerror = () => reject(tx.error || new Error('Storage read failed'));
    });
  } finally { db.close(); }
}
export async function saveCard(card) {
  // Idempotent: one generated draft can award growth only once.
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('cards', 'readwrite');
      const store = tx.objectStore('cards');
      const request = store.get(card.id);
      let added = false, writeError;
      request.onsuccess = () => {
        try { if (!request.result) { store.add(card); added = true; } }
        catch (error) { writeError = error; tx.abort(); }
      };
      tx.oncomplete = () => resolve(added);
      tx.onabort = tx.onerror = () => reject(writeError || tx.error || new Error('Storage write failed'));
    });
  } finally { db.close(); }
}
