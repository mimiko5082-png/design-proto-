// A share sheet sends only the photo and prompt explicitly selected by its owner.
// It never posts to the public notebook or uploads photos in the background.
export function photoShareFile(card) {
  const [header, data] = card.image.split(',');
  const bytes = Uint8Array.from(atob(data), char => char.charCodeAt(0));
  const type = header.match(/^data:(image\/(?:jpeg|png|webp));base64$/)?.[1];
  if (!type) throw new Error('写真の形式を確認できませんでした。');
  return new File([bytes], `basho-${card.day}.${type === 'image/jpeg' ? 'jpg' : type.split('/')[1]}`, { type });
}
export async function sharePhotoCard(card) {
  const file = photoShareFile(card);
  const text = `${card.day} 今日の芭蕉フォト\n「${card.modern}」\n原句：${card.original || card.lines.join(' ')}\n松尾芭蕉（現代語のお題は意訳）`;
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title: '今日の芭蕉フォト', text, files: [file] });
    return '共有画面を開きました。送信結果は共有先のアプリで確認してください。';
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a'); a.href = url; a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return '写真をダウンロードしました。LINEなどで写真を選んで送ってください。お題は上の文章を添えられます。';
}
