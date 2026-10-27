// Keep credentials in the child environment. Never print their values or put
// them in command arguments, repository files, or generated preview assets.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function normalizePreviewCredentials(environment) {
  const token = String(environment.CLOUDFLARE_API_TOKEN || '').trim();
  const account = String(environment.CLOUDFLARE_ACCOUNT_ID || '').trim();
  if (!token) throw new Error('CLOUDFLARE_PREVIEW_API_TOKEN が空です。GitHubのRepository SecretにAPIトークンの値だけを登録してください。');
  if (!/^[A-Za-z0-9._~+/=-]+$/.test(token) || token.length > 4096) {
    throw new Error('CLOUDFLARE_PREVIEW_API_TOKEN に改行・空白・引用符・余分な文章が含まれています。GitHubのRepository Secretを、APIトークンの英数字だけに更新してください。「使用例」のコマンド全体やAccount IDは入れないでください。');
  }
  if (!/^[a-fA-F0-9]{32}$/.test(account)) {
    throw new Error('CLOUDFLARE_PREVIEW_ACCOUNT_ID は32文字のアカウントIDだけを登録してください。使用例のコマンド・URL・APIトークンは入れないでください。');
  }
  return { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account };
}
export function deployPreview({ environment = process.env, spawn = spawnSync } = {}) {
  if (environment.GITHUB_REF !== 'refs/heads/codex-preview' || environment.GITHUB_REPOSITORY !== 'mimiko5082-png/design-proto-') {
    throw new Error('この公開処理は対象リポジトリのcodex-previewブランチだけで実行できます。');
  }
  const config = JSON.parse(readFileSync(resolve(root, 'preview/wrangler.jsonc'), 'utf8'));
  if (config.name !== 'basho-preview' || config.assets?.directory !== './dist' || config.main || config.triggers || config.routes) {
    throw new Error('プレビュー専用の公開先設定を確認してください。公開を中止しました。');
  }
  const credentials = normalizePreviewCredentials(environment);
  const result = spawn('npx', ['--yes', 'wrangler@4.151.0', 'deploy', '--config', 'preview/wrangler.jsonc'], {
    cwd: root, env: { ...environment, ...credentials }, stdio: 'inherit', shell: false,
  });
  if (result.error) throw new Error('Wranglerを起動できませんでした。Node.jsとnpxの設定を確認してください。');
  return typeof result.status === 'number' ? result.status : 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = deployPreview(); }
  catch (error) { console.error('::error::' + error.message); process.exitCode = 1; }
}
