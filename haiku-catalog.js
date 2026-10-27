// 芭蕉の原典と、現代向けのお題は区別して表示する。
export const BASHO_TOPICS = [
  { id: 'basho-shizukasa', lines: ['閑さや', '岩にしみ入る', '蝉の声'], source: '松尾芭蕉『おくのほそ道』立石寺', hint: '音があるから気づく静けさ。耳をすませ、心に残った景色を一枚に。' },
  { id: 'basho-samidare', lines: ['五月雨を', 'あつめて早し', '最上川'], source: '松尾芭蕉『おくのほそ道』最上川', hint: '流れや、集まるものに目を向けて。水でなくても、動きを感じる景色を探して。' },
  { id: 'basho-natsukusa', lines: ['夏草や', '兵どもが', '夢の跡'], source: '松尾芭蕉『おくのほそ道』平泉', hint: '誰かがここにいた痕跡。今あるものから、過ぎた時間を想像してみて。' },
];
export const topicById = id => BASHO_TOPICS.find(topic => topic.id === id);
export function dailyTopic(day) {
  return BASHO_TOPICS[Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000) % BASHO_TOPICS.length];
}
export function validateHaiku(value) {
  if (!value || !Array.isArray(value.lines) || value.lines.length !== 3 || value.lines.some(line => typeof line !== 'string' || !line.trim() || [...line].length > 40 || /[\n\r]/.test(line))) throw new Error('Invalid haiku');
  if (typeof value.observed !== 'string' || !value.observed.trim() || value.observed.length > 400) throw new Error('Invalid observation');
  return { lines: value.lines.map(line => line.trim()), observed: value.observed.trim() };
}
// AIがあらかじめ作成した創作例。写真の解析結果でも、芭蕉の実作でもない。
export const PREPARED_EXAMPLES = {
  'basho-shizukasa': ['閑さや', '信号かわる', '人の波'],
  'basho-samidare': ['五月雨を', '窓のむこうに', '聞くしじま'],
  'basho-natsukusa': ['夏草や', 'ベンチのすみに', '猫ねむる'],
};
