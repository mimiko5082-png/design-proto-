// 芭蕉の原典と、現代向けのお題は区別して表示する。
export const BASHO_TOPICS = [
  { id: 'basho-shizukasa', lines: ['閑さや', '岩にしみ入る', '蝉の声'], source: '松尾芭蕉『おくのほそ道』立石寺', modern: '静かな場所に、蝉の声だけがじわーっと響いてる。', photoHint: '静けさや、小さな音を感じる景色を探してみよう。', hint: '音があるから気づく静けさ。耳をすませ、心に残った景色を一枚に。' },
  { id: 'basho-samidare', lines: ['五月雨を', 'あつめて早し', '最上川'], source: '松尾芭蕉『おくのほそ道』最上川', modern: '雨、全部ここに集まった？ 最上川、流れが速すぎ！', photoHint: '流れる水や、人の流れ。勢いを感じる一枚を。', hint: '流れや、集まるものに目を向けて。水でなくても、動きを感じる景色を探して。' },
  { id: 'basho-natsukusa', lines: ['夏草や', '兵どもが', '夢の跡'], source: '松尾芭蕉『おくのほそ道』平泉', modern: 'ここで夢に燃えてた人たち。今は草だけが生えてるんだなあ。', photoHint: '使いこまれたベンチや古い建物など、過ぎた時間が見える場所を。', hint: '誰かがここにいた痕跡。今あるものから、過ぎた時間を想像してみて。' },
  { id: 'basho-akaaka', lines: ['あかあかと', '日はつれなくも', '秋の風'], source: '松尾芭蕉『おくのほそ道』金沢', modern: '太陽、まだそんなギラギラしてんの？ 風はもう秋なんだけど。', photoHint: '強い日差しと、風に揺れるもの。季節のちぐはぐを一枚に。' },
  { id: 'basho-togarashi', lines: ['青くても', 'あるべきものを', '唐辛子'], source: '松尾芭蕉「青くてもあるべきものを唐辛子」', modern: '唐辛子、お前、青いままでもよかったやん。なにそんな真っ赤になってんの。', photoHint: '思わず目がいく赤いものや、色の変化を撮ってみよう。' },
  { id: 'basho-aoyagi', lines: ['青柳の', '泥にしだるる', '潮干かな'], source: '松尾芭蕉「青柳の泥にしだるる潮干かな」', modern: '潮が引いて、柳の枝が泥のところまでだら〜ん。', photoHint: '枝や影がのびる様子、いつもは見えない足元の景色を一枚に。' },
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
