// Preview-only: no AI/provider calls, notifications, or shared database writes.
(() => {
  try {
  const nativeStorage = window.localStorage;
  Object.defineProperty(window, 'localStorage', { value: {
    getItem: key => nativeStorage.getItem(`basho_git_preview_${key}`),
    setItem: (key, value) => nativeStorage.setItem(`basho_git_preview_${key}`, value),
    removeItem: key => nativeStorage.removeItem(`basho_git_preview_${key}`),
  } });
  } catch {}
  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.origin === 'https://preview.invalid' && url.pathname === '/api/images/haiku') {
      const { PREPARED_EXAMPLES, topicById } = await import('./haiku-catalog.js');
      let data; try { data = JSON.parse(options.body); } catch {}
      const topic = topicById(data?.topicId);
      if (!topic) return Response.json({ error: 'Invalid sample topic' }, { status: 400 });
      return Response.json({ lines: PREPARED_EXAMPLES[topic.id], observed: 'プレビューの固定サンプルです。写真の解析は行っていません。' });
    }
    return Response.json({ error: 'Preview: external services are disabled' }, { status: 503 });
  };
  customElements.define('basho-notifications', class extends HTMLElement {
    connectedCallback() { this.innerHTML = '<p class="reading-help">プレビューでは実際の通知・共有・AI接続は無効です。</p>'; }
  });
})();
