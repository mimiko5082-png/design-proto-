import { normalizeEndpoint, ImageServiceError } from './image-service.js';
import { validateHaiku } from './haiku-catalog.js';
export async function requestHaiku(endpoint, image, topicId, { signal, fetcher = fetch } = {}) {
  let response;
  try {
    response = await fetcher(`${normalizeEndpoint(endpoint)}/api/images/haiku`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image, topicId }), signal });
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof ImageServiceError) throw error;
    throw new Error('AIに接続できませんでした。通信状態を確認して再試行してください。');
  }
  if (!response.ok) {
    let code; try { code = (await response.json()).code; } catch {}
    if (response.status === 429 && code === 'FREE_QUOTA_EXCEEDED') throw new Error('本日のAI無料枠を使い切りました。枠が回復してから再度お試しください。');
    if (response.status === 429) throw new Error('利用上限です。1分ほど待ってから再試行してください。');
    if (response.status === 404) throw new Error('写真から俳句を提案するサーバー機能がまだ公開されていません。');
    if (response.status === 503) throw new Error('AIサーバーの接続設定を確認してください。');
    throw new Error('俳句を提案できませんでした。時間をおいて再試行してください。');
  }
  try { return validateHaiku(await response.json()); }
  catch { throw new Error('俳句の応答を読み取れませんでした。もう一度お試しください。'); }
}
export async function preparePhoto(file) {
  const { validateFile, validateImage, MAX_AI_IMAGE_BYTES } = await import('./image-validation.js');
  validateFile(file);
  validateImage(new Uint8Array(await file.arrayBuffer()), file.type);
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 768 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = 'white'; context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    for (const quality of [.75,.55,.35]) {
      const image = canvas.toDataURL('image/jpeg',quality);
      if ((image.length-image.indexOf(',')-1)*3/4 <= MAX_AI_IMAGE_BYTES) return image;
    }
    throw new Error('写真を小さくできませんでした。小さな画像を選んでください。');
  } finally { bitmap.close(); }
}
