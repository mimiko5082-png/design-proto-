// A visual simulation only. Never requests permission or invokes Web Push.
const morningTitle = '今日のお題、のぞいてみよう。';
const morningBody = 'いつもの道に、まだ気づいていない一枚があるかも。芭蕉のお題をヒントに探してみよう。';
const nightTitle = '今日の景色、1枚残してみない？';
const nightBody = 'まだなら、身近なところで一枚。撮った写真がある人は、今日の発見を振り返ってみよう。';
export function showNotificationDemo(mode = 'morning') {
  const night = mode === 'night';
  const label = night ? '23時50分' : '朝8時';
  if (document.querySelector('.notification-demo-dialog')) return;
  const previousFocus = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.className = 'notification-demo-dialog' + (night ? ' notification-demo-night' : '');
  dialog.setAttribute('aria-labelledby', 'notification-demo-title');
  dialog.innerHTML = `<header class="notification-demo-heading"><span id="notification-demo-title">${label}の通知プレビュー</span><button type="button" data-demo-close aria-label="通知プレビューを閉じる">×</button></header><div class="notification-demo-lockscreen"><div class="notification-demo-date"></div><div class="notification-demo-clock" aria-label="${label}">${night ? '23:50' : '8:00'}</div><span class="notification-demo-caption">${label}になったとしたら…</span><button type="button" class="notification-demo-card" data-demo-open><span class="notification-demo-app"><img src="./assets/kotoba-icon-192.png" alt=""><span>芭蕉のまなざし</span><time>今</time></span><strong>${night ? nightTitle : morningTitle}</strong><span class="notification-demo-body">${night ? nightBody : morningBody}</span><span class="notification-demo-tap">タップして今日のお題へ →</span></button><button type="button" class="notification-demo-switch" data-demo-switch>${night ? '朝8時' : '23時50分'}の通知も見る</button><p class="notification-demo-footnote">通知の見た目のイメージです。<br>実際の表示は端末によって異なります。</p></div>`;
  dialog.querySelector('.notification-demo-date').textContent = new Intl.DateTimeFormat('ja-JP', {timeZone:'Asia/Tokyo',month:'long',day:'numeric',weekday:'long'}).format(new Date());
  document.body.append(dialog);
  dialog.addEventListener('close', () => { dialog.remove(); previousFocus?.focus(); }, {once:true});
  dialog.querySelector('[data-demo-close]').addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-demo-open]').addEventListener('click', () => {
    document.querySelector('.tabbar [data-nav="home"]')?.click();
    dialog.close();
    document.querySelector('.capture-prompt')?.scrollIntoView({block:'start'});
  });
  dialog.querySelector('[data-demo-switch]').addEventListener('click', () => {
    dialog.close(); dialog.remove();
    showNotificationDemo(night ? 'morning' : 'night');
  });
  dialog.showModal();
}
document.querySelector('[data-notification-demo]')?.addEventListener('click', () => showNotificationDemo());
const initialMode = new URL(location.href).searchParams.get('notification');
if (initialMode === 'morning' || initialMode === 'night') showNotificationDemo(initialMode);

if (window.BASHO_SHARING_DEMO) document.querySelector('.tabbar [data-nav="friends"]')?.click();
